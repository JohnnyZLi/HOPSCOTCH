from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def replace_once(path: str, old: str, new: str) -> None:
    target = ROOT / path
    text = target.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected exactly one match, found {count}: {old[:120]!r}')
    target.write_text(text.replace(old, new, 1))

def write(path: str, content: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content)

write('src/builder/timeline.ts', r'''import { buildBuilderDeviceWorkbench, type BuilderDeviceRef, type BuilderDeviceWorkbenchInput, type BuilderDeviceWorkbenchSnapshot, type BuilderWorkbenchEventJournal, type BuilderWorkbenchRow } from './device-workbench.ts';

export const BUILDER_TIMELINE_TICK_MS = 1000;
export const BUILDER_TIMELINE_LIMIT = 160;

export type BuilderTimelineState = Omit<BuilderDeviceWorkbenchInput, 'events'>;

export interface BuilderTimelineSnapshot {
  eventId: string;
  sequence: number;
  atMs: number;
  category: string;
  summary: string;
  detail: string;
  state: BuilderTimelineState;
}

export interface BuilderTimeline {
  snapshots: BuilderTimelineSnapshot[];
}

export type BuilderTimelineDiffTruth = 'CONFIG' | 'STATE';
export type BuilderTimelineDiffChange = 'added' | 'removed' | 'changed';

export interface BuilderTimelineDiffEntry {
  id: string;
  truth: BuilderTimelineDiffTruth;
  section: string;
  label: string;
  change: BuilderTimelineDiffChange;
  before: string | null;
  after: string | null;
}

export interface BuilderTimelineDeviceDiff {
  sequence: number;
  previousSequence: number | null;
  entries: BuilderTimelineDiffEntry[];
  configChanges: number;
  stateChanges: number;
}

function cloneTimelineState(state: BuilderTimelineState): BuilderTimelineState {
  if (typeof structuredClone === 'function') return structuredClone(state);
  return JSON.parse(JSON.stringify(state)) as BuilderTimelineState;
}

function stateFromInput(input: BuilderDeviceWorkbenchInput): BuilderTimelineState {
  const { events: _events, ...state } = input;
  return state;
}

export function createBuilderTimeline(): BuilderTimeline {
  return { snapshots: [] };
}

export function captureBuilderTimelineSnapshot(timeline: BuilderTimeline, journal: BuilderWorkbenchEventJournal, input: BuilderDeviceWorkbenchInput): BuilderTimeline {
  const event = journal.at(-1);
  if (!event) return timeline;
  if (timeline.snapshots.some((snapshot) => snapshot.eventId === event.id)) return timeline;
  const snapshot: BuilderTimelineSnapshot = {
    eventId: event.id,
    sequence: event.sequence,
    atMs: event.sequence * BUILDER_TIMELINE_TICK_MS,
    category: event.category,
    summary: event.summary,
    detail: event.detail,
    state: cloneTimelineState(stateFromInput(input)),
  };
  return { snapshots: [...timeline.snapshots, snapshot].slice(-BUILDER_TIMELINE_LIMIT) };
}

export function builderTimelineSnapshotAtSequence(timeline: BuilderTimeline, sequence: number): BuilderTimelineSnapshot | null {
  let selected: BuilderTimelineSnapshot | null = null;
  for (const snapshot of timeline.snapshots) {
    if (snapshot.sequence > sequence) break;
    selected = snapshot;
  }
  return selected ?? timeline.snapshots[0] ?? null;
}

export function builderTimelineJournalThroughSequence(journal: BuilderWorkbenchEventJournal, sequence: number): BuilderWorkbenchEventJournal {
  return journal.filter((event) => event.sequence <= sequence);
}

export function builderTimelineWorkbenchAtSequence(timeline: BuilderTimeline, journal: BuilderWorkbenchEventJournal, sequence: number, device: BuilderDeviceRef): BuilderDeviceWorkbenchSnapshot | null {
  const snapshot = builderTimelineSnapshotAtSequence(timeline, sequence);
  if (!snapshot) return null;
  return buildBuilderDeviceWorkbench({ ...snapshot.state, events: builderTimelineJournalThroughSequence(journal, snapshot.sequence) }, device);
}

function flattenRows(snapshot: BuilderDeviceWorkbenchSnapshot, truth: BuilderTimelineDiffTruth): Map<string, { section: string; row: BuilderWorkbenchRow }> {
  const sections = truth === 'CONFIG' ? snapshot.configSections : snapshot.stateSections;
  const result = new Map<string, { section: string; row: BuilderWorkbenchRow }>();
  for (const section of sections) for (const row of section.rows) result.set(`${section.id}:${row.id}`, { section: section.title, row });
  return result;
}

function rowFingerprint(row: BuilderWorkbenchRow): string {
  return JSON.stringify([row.label, row.value, row.detail, row.status, row.why.map((step) => [step.source, step.label, step.detail])]);
}

function diffTruth(before: BuilderDeviceWorkbenchSnapshot | null, after: BuilderDeviceWorkbenchSnapshot, truth: BuilderTimelineDiffTruth): BuilderTimelineDiffEntry[] {
  const beforeRows = before ? flattenRows(before, truth) : new Map<string, { section: string; row: BuilderWorkbenchRow }>();
  const afterRows = flattenRows(after, truth);
  const keys = [...new Set([...beforeRows.keys(), ...afterRows.keys()])].sort();
  const entries: BuilderTimelineDiffEntry[] = [];
  for (const key of keys) {
    const prior = beforeRows.get(key);
    const next = afterRows.get(key);
    if (!prior && next) entries.push({ id: `${truth}:${key}:added`, truth, section: next.section, label: next.row.label, change: 'added', before: null, after: next.row.value });
    else if (prior && !next) entries.push({ id: `${truth}:${key}:removed`, truth, section: prior.section, label: prior.row.label, change: 'removed', before: prior.row.value, after: null });
    else if (prior && next && rowFingerprint(prior.row) !== rowFingerprint(next.row)) entries.push({ id: `${truth}:${key}:changed`, truth, section: next.section, label: next.row.label, change: 'changed', before: prior.row.value, after: next.row.value });
  }
  return entries;
}

export function diffBuilderTimelineDevice(timeline: BuilderTimeline, journal: BuilderWorkbenchEventJournal, sequence: number, device: BuilderDeviceRef): BuilderTimelineDeviceDiff | null {
  const currentIndex = timeline.snapshots.findIndex((snapshot) => snapshot.sequence === builderTimelineSnapshotAtSequence(timeline, sequence)?.sequence);
  if (currentIndex < 0) return null;
  const current = timeline.snapshots[currentIndex];
  const previous = currentIndex > 0 ? timeline.snapshots[currentIndex - 1] : null;
  const afterWorkbench = buildBuilderDeviceWorkbench({ ...current.state, events: builderTimelineJournalThroughSequence(journal, current.sequence) }, device);
  const beforeWorkbench = previous ? buildBuilderDeviceWorkbench({ ...previous.state, events: builderTimelineJournalThroughSequence(journal, previous.sequence) }, device) : null;
  const entries = [...diffTruth(beforeWorkbench, afterWorkbench, 'CONFIG'), ...diffTruth(beforeWorkbench, afterWorkbench, 'STATE')];
  return {
    sequence: current.sequence,
    previousSequence: previous?.sequence ?? null,
    entries,
    configChanges: entries.filter((entry) => entry.truth === 'CONFIG').length,
    stateChanges: entries.filter((entry) => entry.truth === 'STATE').length,
  };
}
''')

write('src/BuilderTimeMachine.tsx', r'''import { useEffect, useState } from 'react';
import { builderTimelineSnapshotAtSequence, type BuilderTimeline } from './builder/timeline.ts';
import './BuilderTimeMachine.css';

function formatTime(ms:number):string{const seconds=Math.floor(ms/1000);return`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}.000`;}

export function BuilderTimeMachine({timeline,cursor,onSeek}:{timeline:BuilderTimeline;cursor:number|null;onSeek:(sequence:number|null)=>void;}){
  const [playing,setPlaying]=useState(false);
  const snapshots=timeline.snapshots;
  const latest=snapshots.at(-1)??null;
  const selected=cursor==null?latest:builderTimelineSnapshotAtSequence(timeline,cursor);
  const selectedIndex=selected?snapshots.findIndex((snapshot)=>snapshot.sequence===selected.sequence):-1;
  const isLive=cursor==null;

  useEffect(()=>{
    if(!playing||snapshots.length<2)return;
    const timer=window.setInterval(()=>{
      const current=cursor==null?0:Math.max(0,snapshots.findIndex((snapshot)=>snapshot.sequence===cursor));
      const nextIndex=cursor==null?0:current+1;
      if(nextIndex>=snapshots.length){setPlaying(false);onSeek(null);return;}
      onSeek(snapshots[nextIndex].sequence);
    },650);
    return()=>window.clearInterval(timer);
  },[playing,cursor,snapshots,onSeek]);

  if(!latest||!selected)return <section className="builder-time-machine"><div className="control-title"><span>BUILDER TIME MACHINE</span><strong>CAPTURING</strong></div><small className="builder-routing-note">WAITING FOR THE INITIAL CANONICAL SNAPSHOT.</small></section>;

  const previous=selectedIndex>0?snapshots[selectedIndex-1]:null;
  const next=selectedIndex>=0&&selectedIndex<snapshots.length-1?snapshots[selectedIndex+1]:null;
  const startPlayback=()=>{if(snapshots.length<2)return;if(isLive)onSeek(snapshots[0].sequence);setPlaying(true);};

  return <section className={`builder-time-machine ${isLive?'is-live':'is-history'}`} data-builder-timeline-sequence={selected.sequence}>
    <div className="control-title"><span>BUILDER TIME MACHINE</span><strong>{isLive?'LIVE':`HISTORY · #${String(selected.sequence).padStart(3,'0')}`}</strong></div>
    <div className="builder-time-readout"><span>EVENT CLOCK</span><strong>{formatTime(selected.atMs)}</strong><small>#{String(selected.sequence).padStart(3,'0')} · {selected.category.toUpperCase()}</small></div>
    <div className="builder-time-event"><strong>{selected.summary}</strong><p>{selected.detail}</p></div>
    <input aria-label="Builder historical event timeline" type="range" min={snapshots[0].sequence} max={latest.sequence} step="1" value={selected.sequence} onChange={(event)=>{setPlaying(false);onSeek(Number(event.currentTarget.value));}} disabled={snapshots.length<2}/>
    <div className="builder-time-controls">
      <button type="button" disabled={!previous} onClick={()=>{setPlaying(false);if(previous)onSeek(previous.sequence);}}>←</button>
      <button type="button" disabled={snapshots.length<2} onClick={()=>playing?setPlaying(false):startPlayback()}>{playing?'Ⅱ':'▶'}</button>
      <button type="button" disabled={!next} onClick={()=>{setPlaying(false);if(next)onSeek(next.sequence);}}>→</button>
      <button type="button" className={isLive?'active':''} onClick={()=>{setPlaying(false);onSeek(null);}}>LIVE</button>
    </div>
    <div className="builder-time-markers" aria-hidden="true">{snapshots.slice(-20).map((snapshot)=><i key={snapshot.eventId} className={snapshot.sequence<=selected.sequence?'passed':''} title={`#${snapshot.sequence} ${snapshot.summary}`}/>)}</div>
    <small className="builder-routing-note">DETERMINISTIC EVENT CLOCK · ONE LOGICAL SECOND PER CANONICAL BUILDER EVENT · HISTORY IS READ-ONLY AND NEVER MUTATES LIVE CONFIGURATION.</small>
  </section>;
}
''')

write('src/BuilderTimeMachine.css', r'''.builder-time-machine{display:grid;gap:10px;border:1px solid rgba(122,156,255,.24)!important;background:linear-gradient(180deg,rgba(122,156,255,.055),rgba(7,11,16,.02))!important}.builder-time-machine.is-history{border-color:rgba(242,200,121,.34)!important;background:linear-gradient(180deg,rgba(242,200,121,.055),rgba(7,11,16,.02))!important}.builder-time-readout{display:grid;grid-template-columns:1fr auto;gap:3px 10px;align-items:baseline;padding:9px 10px;border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.02)}.builder-time-readout span,.builder-time-readout small{font:700 8px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.1em;color:#667985}.builder-time-readout strong{font:800 15px/1 ui-monospace,SFMono-Regular,Menlo,monospace;color:#d9e5eb}.builder-time-readout small{grid-column:1/-1}.builder-time-event{display:grid;gap:4px;min-width:0}.builder-time-event strong{font-size:10px;color:#d4dfe5}.builder-time-event p{margin:0;color:#7d8c95;font-size:9px;line-height:1.4}.builder-time-machine input[type=range]{width:100%;accent-color:#79f2da}.builder-time-machine.is-history input[type=range]{accent-color:#f2c879}.builder-time-controls{display:grid;grid-template-columns:34px 34px 34px 1fr;gap:5px}.builder-time-controls button{display:flex;min-width:0;min-height:32px;align-items:center;justify-content:center;padding:6px}.builder-time-controls button.active{border-color:rgba(121,242,218,.45);background:rgba(121,242,218,.09);color:#bffcef}.builder-time-markers{display:flex;height:6px;gap:3px;align-items:center}.builder-time-markers i{display:block;flex:1 1 0;height:2px;background:rgba(255,255,255,.08)}.builder-time-markers i.passed{background:rgba(121,242,218,.55)}.builder-time-machine.is-history .builder-time-markers i.passed{background:rgba(242,200,121,.55)}@media(max-width:760px){.builder-time-controls{grid-template-columns:40px 40px 40px 1fr}.builder-time-controls button{min-height:38px}}
''')

write('scripts/builder-timeline-contract-check.mjs', r'''import assert from 'node:assert/strict';
import { createDefaultBuilderAddressing } from '../src/builder/addressing.ts';
import { createDefaultBuilderAclConfig } from '../src/builder/acl.ts';
import { clearBuilderArpCache, resolveBuilderEthernetFlowArp } from '../src/builder/arp.ts';
import { createDefaultBuilderDhcpConfig } from '../src/builder/dhcp.ts';
import { appendBuilderWorkbenchMessageEvent, buildBuilderDeviceWorkbench, createBuilderWorkbenchEventJournal } from '../src/builder/device-workbench.ts';
import { createDefaultBuilderEthernetConfig } from '../src/builder/ethernet.ts';
import { createBuilderIpv6ControlState } from '../src/builder/ipv6-control-plane.ts';
import { createDefaultBuilderIpv6RoutingDepthState } from '../src/builder/ipv6-routing-depth.ts';
import { createDefaultBuilderIpv6Config } from '../src/builder/ipv6.ts';
import { cloneBuilderGraph, defaultBuilderGraph } from '../src/builder/model.ts';
import { createDefaultBuilderNatConfig } from '../src/builder/nat.ts';
import { createDefaultBuilderRoutingConfig, setBuilderOspfEverywhere } from '../src/builder/routing.ts';
import { builderTimelineJournalThroughSequence, builderTimelineSnapshotAtSequence, builderTimelineWorkbenchAtSequence, captureBuilderTimelineSnapshot, createBuilderTimeline, diffBuilderTimelineDevice } from '../src/builder/timeline.ts';

const graph=cloneBuilderGraph(defaultBuilderGraph);
const addressing=createDefaultBuilderAddressing(graph);
const routing=setBuilderOspfEverywhere(graph,addressing,createDefaultBuilderRoutingConfig(),true);
const ethernet=createDefaultBuilderEthernetConfig();
const ipv6=createDefaultBuilderIpv6Config(graph,addressing,true);
const base={graph,addressing,routing,ipv6,ipv6ControlState:createBuilderIpv6ControlState(),ipv6RoutingDepth:createDefaultBuilderIpv6RoutingDepthState(graph),ethernet,ethernetFlow:null,arpCache:clearBuilderArpCache(),arpResolutions:[],acl:createDefaultBuilderAclConfig(),nat:createDefaultBuilderNatConfig(graph),natSessions:[],dhcp:createDefaultBuilderDhcpConfig(ethernet),dhcpLeases:[],dhcpSequence:1,probeHistory:[],sourceId:'client',destinationId:'app'};
let journal=createBuilderWorkbenchEventJournal();
let timeline=createBuilderTimeline();
timeline=captureBuilderTimelineSnapshot(timeline,journal,{...base,events:journal});
assert.equal(timeline.snapshots.length,1);assert.equal(timeline.snapshots[0].sequence,0);assert.equal(timeline.snapshots[0].atMs,0);

const failedGraph={...graph,links:graph.links.map((link)=>link.id==='edge-r1'?{...link,failed:true}:link)};
journal=appendBuilderWorkbenchMessageEvent(journal,'TOPOLOGY CHANGED · EDGE ↔ R1 failed; OSPF recomputes from active adjacencies.',[{plane:'routed',id:'edge'},{plane:'routed',id:'r1'}]);
const failed={...base,graph:failedGraph};
timeline=captureBuilderTimelineSnapshot(timeline,journal,{...failed,events:journal});
assert.equal(timeline.snapshots.length,2);assert.equal(timeline.snapshots[1].atMs,1000);assert.equal(timeline.snapshots[0].state.graph.links.find((link)=>link.id==='edge-r1').failed,false,'captured state must be immutable after later changes');assert.equal(timeline.snapshots[1].state.graph.links.find((link)=>link.id==='edge-r1').failed,true);

const arp=resolveBuilderEthernetFlowArp(ethernet,'lan-a','lan-b',[]);assert.equal(arp.success,true);
journal=appendBuilderWorkbenchMessageEvent(journal,'ARP RESOLVED · PC-A learned the next-hop mapping.',[{plane:'ethernet',id:'lan-a'}]);
timeline=captureBuilderTimelineSnapshot(timeline,journal,{...failed,arpCache:arp.cache,arpResolutions:arp.resolutions,events:journal});
assert.equal(timeline.snapshots.length,3);assert.equal(timeline.snapshots[2].atMs,2000);
assert.equal(builderTimelineSnapshotAtSequence(timeline,1)?.sequence,1);assert.equal(builderTimelineJournalThroughSequence(journal,1).at(-1)?.sequence,1);

const edgePast=builderTimelineWorkbenchAtSequence(timeline,journal,0,{plane:'routed',id:'edge'});const edgeFailed=builderTimelineWorkbenchAtSequence(timeline,journal,1,{plane:'routed',id:'edge'});assert.ok(edgePast&&edgeFailed);assert.equal(edgePast.events.some((event)=>event.sequence===2),false,'future events must not leak into historical workbench state');assert.equal(edgeFailed.events.some((event)=>event.sequence===1),true);
const diff=diffBuilderTimelineDevice(timeline,journal,1,{plane:'routed',id:'edge'});assert.ok(diff);assert.equal(diff.previousSequence,0);assert.ok(diff.entries.length>0,'link failure must produce a deterministic device-state/config projection diff');
const lanPast=buildBuilderDeviceWorkbench({...timeline.snapshots[1].state,events:builderTimelineJournalThroughSequence(journal,1)},{plane:'ethernet',id:'lan-a'});const lanNow=buildBuilderDeviceWorkbench({...timeline.snapshots[2].state,events:builderTimelineJournalThroughSequence(journal,2)},{plane:'ethernet',id:'lan-a'});assert.equal(lanPast.stateSections.flatMap((section)=>section.rows).some((row)=>row.label==='ARP'),false);assert.equal(lanNow.stateSections.flatMap((section)=>section.rows).some((row)=>row.label==='ARP'),true);
const lanDiff=diffBuilderTimelineDevice(timeline,journal,2,{plane:'ethernet',id:'lan-a'});assert.ok(lanDiff?.entries.some((entry)=>entry.truth==='STATE'&&entry.label==='ARP'&&entry.change==='added'));

console.log('Builder timeline contract passed: immutable event snapshots, deterministic logical time, historical workbench inspection, future-event isolation, and per-device before/after diffs.');
''')

replace_once('src/NetworkBuilder.tsx', "import { useMemo, useRef, useState } from 'react';", "import { useEffect, useMemo, useRef, useState } from 'react';")
replace_once('src/NetworkBuilder.tsx', "import { BuilderDeviceWorkbench } from './BuilderDeviceWorkbench.tsx';\nimport { appendBuilderWorkbenchMessageEvent, buildBuilderDeviceWorkbench, builderWorkbenchDeviceOptions, classifyBuilderWorkbenchMessage, createBuilderWorkbenchEventJournal, type BuilderDeviceRef, type BuilderWorkbenchEventJournal } from './builder/device-workbench.ts';", "import { BuilderDeviceWorkbench } from './BuilderDeviceWorkbench.tsx';\nimport { BuilderTimeMachine } from './BuilderTimeMachine.tsx';\nimport { appendBuilderWorkbenchMessageEvent, buildBuilderDeviceWorkbench, builderWorkbenchDeviceOptions, classifyBuilderWorkbenchMessage, createBuilderWorkbenchEventJournal, type BuilderDeviceRef, type BuilderDeviceWorkbenchInput, type BuilderWorkbenchEventJournal } from './builder/device-workbench.ts';\nimport { builderTimelineJournalThroughSequence, builderTimelineSnapshotAtSequence, captureBuilderTimelineSnapshot, createBuilderTimeline, diffBuilderTimelineDevice, type BuilderTimeline } from './builder/timeline.ts';")
replace_once('src/NetworkBuilder.tsx', "  const [workbenchEvents, setWorkbenchEvents] = useState<BuilderWorkbenchEventJournal>(() => createBuilderWorkbenchEventJournal());\n  const [workbenchDevice, setWorkbenchDevice] = useState<BuilderDeviceRef>(() => ({ plane: 'routed', id: initialSourceId }));", "  const [workbenchEvents, setWorkbenchEvents] = useState<BuilderWorkbenchEventJournal>(() => createBuilderWorkbenchEventJournal());\n  const [workbenchDevice, setWorkbenchDevice] = useState<BuilderDeviceRef>(() => ({ plane: 'routed', id: initialSourceId }));\n  const [timeline, setTimeline] = useState<BuilderTimeline>(() => createBuilderTimeline());\n  const [timelineCursor, setTimelineCursor] = useState<number | null>(null);")

old_block = """  const runtimeEthernet = useMemo(() => applyBuilderDhcpState(ethernet, dhcp, dhcpLeases, dhcpSequence), [ethernet, dhcp, dhcpLeases, dhcpSequence]);
  const workbenchOptions = useMemo(() => stressLabel ? [] : builderWorkbenchDeviceOptions(graph, ethernet), [graph, ethernet, stressLabel]);
  const effectiveWorkbenchDevice = workbenchOptions.some((option) => option.plane === workbenchDevice.plane && option.id === workbenchDevice.id)
    ? workbenchDevice
    : ({ plane: workbenchOptions[0]?.plane ?? 'routed', id: workbenchOptions[0]?.id ?? selectedNodeId } as BuilderDeviceRef);
  const workbenchSnapshot = useMemo(() => stressLabel ? null : buildBuilderDeviceWorkbench({ graph, addressing, routing, ipv6, ipv6ControlState, ipv6RoutingDepth, ethernet, ethernetFlow, arpCache, arpResolutions, acl, nat, natSessions, dhcp, dhcpLeases, dhcpSequence, probeHistory, sourceId, destinationId, events: workbenchEvents }, effectiveWorkbenchDevice), [stressLabel, graph, addressing, routing, ipv6, ipv6ControlState, ipv6RoutingDepth, ethernet, ethernetFlow, arpCache, arpResolutions, acl, nat, natSessions, dhcp, dhcpLeases, dhcpSequence, probeHistory, sourceId, destinationId, workbenchEvents, effectiveWorkbenchDevice.plane, effectiveWorkbenchDevice.id]);
"""
new_block = """  const runtimeEthernet = useMemo(() => applyBuilderDhcpState(ethernet, dhcp, dhcpLeases, dhcpSequence), [ethernet, dhcp, dhcpLeases, dhcpSequence]);
  const liveWorkbenchInput = useMemo<BuilderDeviceWorkbenchInput>(() => ({ graph, addressing, routing, ipv6, ipv6ControlState, ipv6RoutingDepth, ethernet, ethernetFlow, arpCache, arpResolutions, acl, nat, natSessions, dhcp, dhcpLeases, dhcpSequence, probeHistory, sourceId, destinationId, events: workbenchEvents }), [graph, addressing, routing, ipv6, ipv6ControlState, ipv6RoutingDepth, ethernet, ethernetFlow, arpCache, arpResolutions, acl, nat, natSessions, dhcp, dhcpLeases, dhcpSequence, probeHistory, sourceId, destinationId, workbenchEvents]);
  useEffect(() => {
    if (stressLabel) return;
    setTimeline((current) => captureBuilderTimelineSnapshot(current, workbenchEvents, liveWorkbenchInput));
  }, [stressLabel, workbenchEvents, liveWorkbenchInput]);
  const historicalTimelineSnapshot = timelineCursor == null ? null : builderTimelineSnapshotAtSequence(timeline, timelineCursor);
  const displayedWorkbenchInput = historicalTimelineSnapshot ? { ...historicalTimelineSnapshot.state, events: builderTimelineJournalThroughSequence(workbenchEvents, historicalTimelineSnapshot.sequence) } : liveWorkbenchInput;
  const workbenchOptions = useMemo(() => stressLabel ? [] : builderWorkbenchDeviceOptions(displayedWorkbenchInput.graph, displayedWorkbenchInput.ethernet), [displayedWorkbenchInput.graph, displayedWorkbenchInput.ethernet, stressLabel]);
  const effectiveWorkbenchDevice = workbenchOptions.some((option) => option.plane === workbenchDevice.plane && option.id === workbenchDevice.id)
    ? workbenchDevice
    : ({ plane: workbenchOptions[0]?.plane ?? 'routed', id: workbenchOptions[0]?.id ?? selectedNodeId } as BuilderDeviceRef);
  const workbenchSnapshot = useMemo(() => stressLabel ? null : buildBuilderDeviceWorkbench(displayedWorkbenchInput, effectiveWorkbenchDevice), [stressLabel, displayedWorkbenchInput, effectiveWorkbenchDevice.plane, effectiveWorkbenchDevice.id]);
  const workbenchTimelineDiff = useMemo(() => historicalTimelineSnapshot ? diffBuilderTimelineDevice(timeline, workbenchEvents, historicalTimelineSnapshot.sequence, effectiveWorkbenchDevice) : null, [historicalTimelineSnapshot, timeline, workbenchEvents, effectiveWorkbenchDevice.plane, effectiveWorkbenchDevice.id]);
"""
replace_once('src/NetworkBuilder.tsx', old_block, new_block)
replace_once('src/NetworkBuilder.tsx', "  const setMessage = (nextMessage: string) => {\n    setMessageState(nextMessage);", "  const setMessage = (nextMessage: string) => {\n    setTimelineCursor(null);\n    setMessageState(nextMessage);")
replace_once('src/NetworkBuilder.tsx', "        <aside className=\"builder-controls\">\n          {!stressLabel&&workbenchSnapshot&&<BuilderDeviceWorkbench snapshot={workbenchSnapshot} options={workbenchOptions} onSelect={(ref)=>{setWorkbenchDevice(ref);if(ref.plane==='routed')setSelectedNodeId(ref.id);}}/>}", "        <aside className=\"builder-controls\">\n          {!stressLabel&&<BuilderTimeMachine timeline={timeline} cursor={timelineCursor} onSeek={setTimelineCursor}/>}\n          {!stressLabel&&workbenchSnapshot&&<BuilderDeviceWorkbench snapshot={workbenchSnapshot} options={workbenchOptions} historicalSequence={historicalTimelineSnapshot?.sequence??null} diff={workbenchTimelineDiff} onSelect={(ref)=>{setWorkbenchDevice(ref);if(ref.plane==='routed'&&timelineCursor==null)setSelectedNodeId(ref.id);}}/>}")

write('src/BuilderDeviceWorkbench.tsx', r'''import { useState } from 'react';
import type { BuilderDeviceOption, BuilderDeviceRef, BuilderDeviceWorkbenchSnapshot, BuilderWorkbenchRow } from './builder/device-workbench.ts';
import type { BuilderTimelineDeviceDiff } from './builder/timeline.ts';
import './BuilderDeviceWorkbench.css';

type WorkbenchTab = 'config' | 'state' | 'events';

function keyFor(ref:BuilderDeviceRef):string{return`${ref.plane}:${ref.id}`;}

function Why({row}:{row:BuilderWorkbenchRow}){
  if(row.why.length===0)return null;
  return <details className="device-workbench-why"><summary>WHY?</summary><div>{row.why.map((step)=><p key={step.id}><span>{step.source}</span><strong>{step.label}</strong><small>{step.detail}</small></p>)}</div></details>;
}

function Diff({diff}:{diff:BuilderTimelineDeviceDiff|null}){
  if(!diff)return null;
  return <div className="device-workbench-diff"><div><span>CHANGESET</span><strong>{diff.previousSequence==null?'INITIAL SNAPSHOT':`#${String(diff.previousSequence).padStart(3,'0')} → #${String(diff.sequence).padStart(3,'0')}`}</strong><small>{diff.configChanges} CONFIG · {diff.stateChanges} STATE</small></div>{diff.entries.length===0?<p>NO CONFIG OR STATE CHANGES FOR THIS DEVICE AT THIS EVENT.</p>:<div className="device-workbench-diff-list">{diff.entries.slice(0,10).map((entry)=><span key={entry.id} className={`change-${entry.change}`}><b>{entry.truth} · {entry.change.toUpperCase()}</b><strong>{entry.label}</strong><small>{entry.before??'∅'} → {entry.after??'∅'}</small></span>)}{diff.entries.length>10&&<small>+ {diff.entries.length-10} MORE CHANGES</small>}</div>}</div>;
}

export function BuilderDeviceWorkbench({snapshot,options,onSelect,historicalSequence=null,diff=null}:{snapshot:BuilderDeviceWorkbenchSnapshot;options:BuilderDeviceOption[];onSelect:(ref:BuilderDeviceRef)=>void;historicalSequence?:number|null;diff?:BuilderTimelineDeviceDiff|null;}){
  const [tab,setTab]=useState<WorkbenchTab>('state');
  const sections=tab==='config'?snapshot.configSections:snapshot.stateSections;
  const historical=historicalSequence!=null;
  return <section className={`builder-device-workbench ${historical?'is-historical':''}`} data-device-plane={snapshot.device.plane} data-device-id={snapshot.device.id} data-history-sequence={historicalSequence??'live'}>
    <div className="control-title"><span>DEVICE WORKBENCH</span><strong>{historical?`HISTORICAL #${String(historicalSequence).padStart(3,'0')}`:'CONFIG / STATE / EVENTS'}</strong></div>
    <label>DEVICE<select value={keyFor(snapshot.device)} onChange={(event)=>{const [plane,id]=event.currentTarget.value.split(':',2);onSelect({plane:plane as BuilderDeviceRef['plane'],id});}}>{['ROUTED GRAPH','ETHERNET FABRIC'].map((group)=><optgroup key={group} label={group}>{options.filter((option)=>option.group===group).map((option)=><option key={keyFor(option)} value={keyFor(option)}>{option.label} · {option.kind}</option>)}</optgroup>)}</select></label>
    <div className="device-workbench-identity"><span>{snapshot.device.group}</span><strong>{snapshot.device.label}</strong><small>{snapshot.device.kind} · {snapshot.device.id}{historical?` · READ-ONLY SNAPSHOT #${historicalSequence}`:''}</small></div>
    {historical&&<Diff diff={diff}/>} 
    <div className="device-workbench-tabs" role="tablist" aria-label="Device workbench view">
      <button type="button" role="tab" aria-selected={tab==='config'} className={tab==='config'?'active':''} onClick={()=>setTab('config')}>CONFIG <b>{snapshot.configRowCount}</b></button>
      <button type="button" role="tab" aria-selected={tab==='state'} className={tab==='state'?'active':''} onClick={()=>setTab('state')}>STATE <b>{snapshot.stateRowCount}</b></button>
      <button type="button" role="tab" aria-selected={tab==='events'} className={tab==='events'?'active':''} onClick={()=>setTab('events')}>EVENTS <b>{snapshot.events.length}</b></button>
    </div>
    {tab==='events'?<div className="device-workbench-events">{snapshot.events.length===0?<small>NO SESSION EVENTS FOR THIS DEVICE</small>:snapshot.events.map((event)=><article key={event.id} className={`category-${event.category}`}><div><span>#{String(event.sequence).padStart(3,'0')} · {event.category.toUpperCase()}</span>{event.causeId&&<i>CAUSE {event.causeId.replace('wb-event-','#')}</i>}</div><strong>{event.summary}</strong><p>{event.detail}</p>{event.causeChain.length>1&&<details><summary>CAUSAL CHAIN · {event.causeChain.length} EVENTS</summary><div className="device-workbench-event-chain">{event.causeChain.map((step)=><small key={step.id}><b>{step.label}</b>{step.detail}</small>)}</div></details>}</article>)}</div>:<div className="device-workbench-sections">{sections.map((section)=><section key={section.id}><div className="device-workbench-section-title"><span>{section.title}</span><strong>{section.summary}</strong></div>{section.rows.length===0?<small className="device-workbench-empty">{section.summary}</small>:section.rows.map((entry)=><article key={entry.id} className={`status-${entry.status}`}><div><span>{entry.label}</span><strong>{entry.value}</strong></div><p>{entry.detail}</p><Why row={entry}/></article>)}</section>)}</div>}
    <small className="builder-routing-note device-workbench-boundary">{historical?'HISTORICAL CONFIG / STATE / EVENTS COME FROM ONE IMMUTABLE CANONICAL SNAPSHOT · RETURN LIVE BEFORE EDITING.':'CONFIG IS PERSISTED CANONICAL TRUTH · STATE + EVENTS ARE DERIVED / SESSION-ONLY · WHY CHAINS FOLLOW STRUCTURED MODEL CAUSALITY, NOT GENERATED GUESSES.'}</small>
  </section>;
}
''')

css_append = r'''.builder-device-workbench.is-historical{border-color:rgba(242,200,121,.35)!important;background:linear-gradient(180deg,rgba(242,200,121,.055),rgba(7,11,16,.02))!important}.device-workbench-diff{display:grid;gap:7px;padding:9px 10px;border:1px solid rgba(242,200,121,.14);background:rgba(242,200,121,.025)}.device-workbench-diff>div:first-child{display:grid;grid-template-columns:1fr auto;gap:3px 8px}.device-workbench-diff>div:first-child span,.device-workbench-diff>div:first-child small{font:700 8px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.09em;color:#7f7560}.device-workbench-diff>div:first-child strong{font:700 9px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;color:#e7d9b8}.device-workbench-diff>div:first-child small{grid-column:1/-1}.device-workbench-diff>p{margin:0;color:#7d837f;font-size:9px}.device-workbench-diff-list{display:grid;gap:4px;max-height:180px;overflow:auto}.device-workbench-diff-list>span{display:grid;grid-template-columns:auto minmax(0,1fr);gap:2px 7px;padding:5px 7px;border-left:2px solid rgba(242,200,121,.35);background:rgba(255,255,255,.02)}.device-workbench-diff-list b{font:700 8px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;color:#b29d70}.device-workbench-diff-list strong{font-size:9px;color:#cfd8dc}.device-workbench-diff-list small{grid-column:1/-1;color:#77868e;overflow-wrap:anywhere}.device-workbench-diff-list .change-added{border-left-color:rgba(121,242,218,.55)}.device-workbench-diff-list .change-removed{border-left-color:rgba(236,104,104,.65)}
'''
with (ROOT/'src/BuilderDeviceWorkbench.css').open('a') as f: f.write(css_append)

replace_once('package.json', 'npm run test:builder-bgp-projection-contract && npm run test:builder-device-workbench-contract && npm run test:builder-ipv6-contract', 'npm run test:builder-bgp-projection-contract && npm run test:builder-device-workbench-contract && npm run test:builder-timeline-contract && npm run test:builder-ipv6-contract')
replace_once('package.json', '    "test:builder-device-workbench-contract": "node scripts/builder-device-workbench-contract-check.mjs",\n', '    "test:builder-device-workbench-contract": "node scripts/builder-device-workbench-contract-check.mjs",\n    "test:builder-timeline-contract": "node scripts/builder-timeline-contract-check.mjs",\n')

replace_once('docs/ROADMAP.md', '- [ ] state can be inspected at historical timestamps once Builder-wide time travel exists', '- [x] state can be inspected at historical Builder event timestamps through the canonical time-machine snapshot journal')
replace_once('docs/ROADMAP.md', '### Track A — Builder-wide time machine + causal troubleshooting\n- [ ] promote Builder configuration changes, control-plane transitions, forwarding decisions, and flow outcomes into one scrub-able deterministic event timeline', '### Track A — Builder-wide time machine + causal troubleshooting\n- [x] first slice: immutable Builder snapshots are captured after canonical session events on a deterministic logical event clock, with scrub / step / replay / LIVE controls\n- [x] first slice: the device workbench can inspect historical CONFIG / STATE / EVENTS and deterministic per-device before/after diffs without mutating live truth\n- [ ] promote every Builder configuration change, control-plane transition, forwarding decision, and flow outcome into one fully time-native deterministic event timeline')
replace_once('docs/ROADMAP.md', '- [ ] inspect every device’s historical state at any timestamp\n- [ ] before/after state diffs for route tables, FIB, ARP/ND, FDB, STP, ACL counters, NAT state, DHCP leases, and routing databases', '- [x] inspect every device’s historical workbench state at captured canonical Builder event timestamps\n- [ ] extend before/after diffs beyond current workbench-exposed CONFIG/STATE rows to time-native ACL counters and complete protocol databases')

# Correct stale roadmap checkboxes for already-shipped Labs 11K and 11L.
text=(ROOT/'docs/ROADMAP.md').read_text()
for heading,next_heading in [('### 11K — NAT / PAT','### 11L — DHCP + host bootstrap'),('### 11L — DHCP + host bootstrap','### 11M — OSPF depth + real convergence timing')]:
    start=text.index(heading);end=text.index(next_heading,start);chunk=text[start:end].replace('- [ ]','- [x]');text=text[:start]+chunk+text[end:]
(ROOT/'docs/ROADMAP.md').write_text(text)

write('docs/TRACKA.md', r'''# Track A — Builder time machine foundation

Track A starts by making time a first-class inspection axis for Network Builder without turning historical inspection into another simulator.

## Canonical event clock

The existing deterministic Builder event journal remains the event identity source. Each canonical event receives a logical timestamp derived only from its monotonic event sequence (`1 event = 1000 ms` on the teaching clock). This is explicitly **not wall-clock time**.

After React commits the state changes associated with an event, the Builder captures one immutable snapshot of the complete workbench input truth: routed graph/addressing/routing, IPv6 state, Ethernet/VLAN/STP state, ACL/NAT/DHCP configuration and runtime tables, probes, and source/destination context. The event journal itself is stored separately so historical views cannot see future events.

Snapshots are session-only and bounded to the same 160-event horizon as the event journal. They are not serialized into scenario JSON.

## Historical inspection

The Builder sidebar now has a time-machine control with:

- deterministic logical event time,
- event summary and category,
- scrubber,
- previous/next stepping,
- replay across captured snapshots,
- explicit return to `LIVE`.

Historical mode is read-only. It projects an immutable past snapshot into the existing Device Workbench; it does not rewrite the live Builder state or silently fork the scenario. Any real Builder action returns the inspector to `LIVE` before recording the new event.

The workbench device selector is also historical: a device that existed at the selected event is inspected from that event's graph/fabric rather than from today's device list.

## Before / after diffs

For a historical event, the workbench derives a deterministic diff against the immediately preceding captured event. CONFIG and STATE rows are compared by stable section/row identity and expose added, removed, and changed values.

This already covers the workbench projections for route/RIB/FIB state, OSPF/OSPFv3/BGP state, ARP/ND, FDB/STP, NAT translations, DHCP leases/effective addressing, policy decisions, probes, interfaces, and persisted configuration. Counters and protocol databases that are not yet fully represented as time-native workbench rows remain future Track A depth.

## Truth boundary

This first slice does **not** claim that the entire Builder canvas has been rewound. The topology canvas and authoring controls remain the live system while the Device Workbench is in historical inspection mode. The UI states that boundary directly.

The next Track A slice should promote remaining control-plane transitions and forwarding decisions into explicit canonical events, then let the main Builder scene render from the same selected historical snapshot so the entire workspace—not only the workbench—becomes a synchronized time projection.
''')

print('Track A patch applied.')
