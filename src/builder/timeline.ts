import { buildBuilderDeviceWorkbench, type BuilderDeviceRef, type BuilderDeviceWorkbenchInput, type BuilderDeviceWorkbenchSnapshot, type BuilderWorkbenchEventJournal, type BuilderWorkbenchEventKind, type BuilderWorkbenchRow } from './device-workbench.ts';
import type { BuilderIpv6LifecycleState } from './ipv6-lifecycle.ts';
import type { BuilderLinkProfiles } from './link-characteristics.ts';
import type { BuilderLayout } from './model.ts';

export const BUILDER_TIMELINE_TICK_MS = 1000;
export const BUILDER_TIMELINE_LIMIT = 160;

export type BuilderTimelineState = Omit<BuilderDeviceWorkbenchInput, 'events'> & {
  layout: BuilderLayout;
  linkProfiles: BuilderLinkProfiles;
  ipv6LifecycleState: BuilderIpv6LifecycleState;
};

export type BuilderTimelineCaptureInput = BuilderDeviceWorkbenchInput & Pick<BuilderTimelineState, 'layout' | 'linkProfiles' | 'ipv6LifecycleState'>;

export interface BuilderTimelineSnapshot {
  eventId: string;
  sequence: number;
  atMs: number;
  category: string;
  kind: BuilderWorkbenchEventKind;
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

function cloneValue<T>(value: T): T {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

function cloneTimelineState(state: BuilderTimelineState): BuilderTimelineState {
  return cloneValue(state);
}

function stateFromInput(input: BuilderTimelineCaptureInput): BuilderTimelineState {
  const { events: _events, ...state } = input;
  return state;
}

export function createBuilderTimeline(): BuilderTimeline {
  return { snapshots: [] };
}

export function captureBuilderTimelineSnapshot(timeline: BuilderTimeline, journal: BuilderWorkbenchEventJournal, input: BuilderTimelineCaptureInput): BuilderTimeline {
  const lastSequence=timeline.snapshots.at(-1)?.sequence??-1;
  const uncaptured=journal.filter((event)=>event.sequence>lastSequence);
  if(uncaptured.length===0)return timeline;
  const finalState=cloneTimelineState(stateFromInput(input));
  const priorState=timeline.snapshots.at(-1)?.state??null;
  const staged=Boolean(priorState&&uncaptured.some((event)=>event.projection));
  if(!staged){
    const snapshots=uncaptured.map((event):BuilderTimelineSnapshot=>({
      eventId:event.id,
      sequence:event.sequence,
      atMs:event.atMs??event.sequence*BUILDER_TIMELINE_TICK_MS,
      category:event.category,
      kind:event.kind??'action',
      summary:event.summary,
      detail:event.detail,
      state:finalState,
    }));
    return { snapshots: [...timeline.snapshots,...snapshots].slice(-BUILDER_TIMELINE_LIMIT) };
  }

  const beforeGraph=cloneValue(priorState!.graph);
  const afterGraph=finalState.graph;
  const stageDhcpLeases=uncaptured.some((event)=>event.projection?.dhcpLeases==='after'||Boolean(event.projection?.dhcpRemoveLeaseIds?.length));
  const stageDhcpSequence=uncaptured.some((event)=>event.projection?.dhcpSequence!==undefined);
  let truthGraphs={controlGraph:beforeGraph,ribGraph:beforeGraph,fibGraph:beforeGraph};
  let state:BuilderTimelineState={
    ...finalState,
    graph:beforeGraph,
    truthGraphs,
    ...(stageDhcpLeases?{dhcpLeases:cloneValue(priorState!.dhcpLeases)}:{}),
    ...(stageDhcpSequence?{dhcpSequence:priorState!.dhcpSequence}:{}),
  };
  const snapshots=uncaptured.map((event):BuilderTimelineSnapshot=>{
    const projection=event.projection;
    if(projection){
      const nextTruth={...truthGraphs};
      let graph=state.graph;
      if(projection.physical==='after')graph=afterGraph;
      if(projection.control==='after')nextTruth.controlGraph=afterGraph;
      if(projection.rib==='after')nextTruth.ribGraph=afterGraph;
      if(projection.fib==='after')nextTruth.fibGraph=afterGraph;
      let dhcpLeases=state.dhcpLeases;
      if(projection.dhcpRemoveLeaseIds?.length){
        const removed=new Set(projection.dhcpRemoveLeaseIds);
        dhcpLeases=dhcpLeases.filter((lease)=>!removed.has(lease.id));
      }
      if(projection.dhcpLeases==='after')dhcpLeases=finalState.dhcpLeases;
      const dhcpSequence=projection.dhcpSequence==='after'?finalState.dhcpSequence:(typeof projection.dhcpSequence==='number'?projection.dhcpSequence:state.dhcpSequence);
      truthGraphs=nextTruth;
      state={...state,graph,truthGraphs,dhcpLeases,dhcpSequence};
    }
    return {
      eventId:event.id,
      sequence:event.sequence,
      atMs:event.atMs??event.sequence*BUILDER_TIMELINE_TICK_MS,
      category:event.category,
      kind:event.kind??'action',
      summary:event.summary,
      detail:event.detail,
      state,
    };
  });
  return { snapshots: [...timeline.snapshots,...snapshots].slice(-BUILDER_TIMELINE_LIMIT) };
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
