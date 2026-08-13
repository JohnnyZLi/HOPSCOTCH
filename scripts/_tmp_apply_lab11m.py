from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]

def write(path: str, content: str):
    p = ROOT / path
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content, encoding='utf-8')

def replace_once(path: str, old: str, new: str):
    p = ROOT / path
    text = p.read_text(encoding='utf-8')
    if text.count(old) != 1:
        raise SystemExit(f'{path}: expected exactly one match, found {text.count(old)} for {old[:80]!r}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')

ospf_timing = r'''import { builderOspfState, traceBuilderForwarding, type BuilderForwardingTrace, type BuilderOspfState, type BuilderRoutingConfig } from './routing.ts';
import { cloneBuilderGraph, type BuilderGraph } from './model.ts';
import type { BuilderAddressing } from './addressing.ts';

export interface BuilderOspfTimingProfile {
  helloIntervalMs: number;
  deadIntervalMs: number;
  lsaFloodMs: number;
  spfDelayMs: number;
  ribInstallMs: number;
  fibInstallMs: number;
}

export const DEFAULT_BUILDER_OSPF_TIMING: BuilderOspfTimingProfile = {
  helloIntervalMs: 10_000,
  deadIntervalMs: 40_000,
  lsaFloodMs: 200,
  spfDelayMs: 500,
  ribInstallMs: 100,
  fibInstallMs: 100,
};

export type BuilderOspfConvergenceEventKind =
  | 'LINK_DOWN'
  | 'HELLO_MISSED'
  | 'DEAD_TIMER_EXPIRED'
  | 'ADJACENCY_DOWN'
  | 'LSA_ORIGINATED'
  | 'LSA_FLOODED'
  | 'SPF_SCHEDULED'
  | 'SPF_COMPLETE'
  | 'RIB_UPDATED'
  | 'FIB_UPDATED'
  | 'TRAFFIC_RECOVERED';

export interface BuilderOspfConvergenceEvent {
  id: string;
  atMs: number;
  kind: BuilderOspfConvergenceEventKind;
  summary: string;
}

export interface BuilderOspfConvergenceScenario {
  failedLinkId: string;
  failedRouterIds: [string, string];
  beforeGraph: BuilderGraph;
  afterGraph: BuilderGraph;
  addressing: BuilderAddressing;
  routing: BuilderRoutingConfig;
  sourceId: string;
  destinationId: string;
  profile: BuilderOspfTimingProfile;
  events: BuilderOspfConvergenceEvent[];
  deadAtMs: number;
  lsaFloodCompleteAtMs: number;
  spfCompleteAtMs: number;
  ribInstallAtMs: number;
  fibInstallAtMs: number;
}

export type BuilderOspfConvergencePhase =
  | 'PHYSICAL FAILURE · CONTROL PLANE STALE'
  | 'DEAD TIMER · ADJACENCY DOWN'
  | 'LSA FLOODING'
  | 'SPF RUNNING'
  | 'RIB UPDATED · FIB STALE'
  | 'FIB UPDATED · TRAFFIC RECOVERED';

export interface BuilderOspfConvergenceSnapshot {
  elapsedMs: number;
  phase: BuilderOspfConvergencePhase;
  controlState: BuilderOspfState;
  ribTrace: BuilderForwardingTrace;
  fibTrace: BuilderForwardingTrace;
  visibleEvents: BuilderOspfConvergenceEvent[];
  controlUsesFailedTopology: boolean;
  ribUsesFailedTopology: boolean;
  fibUsesFailedTopology: boolean;
}

function finiteInteger(value: number, label: string, min: number, max: number): number {
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${label} must be an integer from ${min} to ${max} ms.`);
  return value;
}

export function validateBuilderOspfTimingProfile(value: BuilderOspfTimingProfile): BuilderOspfTimingProfile {
  const profile = {
    helloIntervalMs: finiteInteger(value.helloIntervalMs, 'OSPF hello interval', 100, 120_000),
    deadIntervalMs: finiteInteger(value.deadIntervalMs, 'OSPF dead interval', 100, 600_000),
    lsaFloodMs: finiteInteger(value.lsaFloodMs, 'OSPF LSA flood delay', 0, 60_000),
    spfDelayMs: finiteInteger(value.spfDelayMs, 'OSPF SPF delay', 0, 60_000),
    ribInstallMs: finiteInteger(value.ribInstallMs, 'OSPF RIB install delay', 0, 60_000),
    fibInstallMs: finiteInteger(value.fibInstallMs, 'OSPF FIB install delay', 0, 60_000),
  };
  if (profile.deadIntervalMs < profile.helloIntervalMs) throw new Error('OSPF dead interval must be greater than or equal to the hello interval.');
  return profile;
}

function nodeKind(graph: BuilderGraph, nodeId: string) {
  return graph.nodes.find((node) => node.id === nodeId)?.kind ?? null;
}

export function createBuilderOspfLinkFailureScenario(
  graph: BuilderGraph,
  addressing: BuilderAddressing,
  routing: BuilderRoutingConfig,
  sourceId: string,
  destinationId: string,
  failedLinkId: string,
  timing: BuilderOspfTimingProfile = DEFAULT_BUILDER_OSPF_TIMING,
): BuilderOspfConvergenceScenario {
  const profile = validateBuilderOspfTimingProfile(timing);
  const link = graph.links.find((candidate) => candidate.id === failedLinkId);
  if (!link) throw new Error(`OSPF timing scenario cannot find link ${failedLinkId}.`);
  if (link.failed) throw new Error(`OSPF timing scenario requires ${failedLinkId} to begin UP.`);
  if (nodeKind(graph, link.a) !== 'router' || nodeKind(graph, link.b) !== 'router') throw new Error('OSPF timing scenarios require a router-router link.');
  const enabled = new Set(routing.ospf.enabledRouterIds);
  if (!enabled.has(link.a) || !enabled.has(link.b)) throw new Error('Both routers on the failed link must be OSPF-enabled.');

  const beforeGraph = cloneBuilderGraph(graph);
  const afterGraph = cloneBuilderGraph(graph);
  const failed = afterGraph.links.find((candidate) => candidate.id === failedLinkId);
  if (!failed) throw new Error('Failed link disappeared while building the convergence scenario.');
  failed.failed = true;

  const deadAtMs = profile.deadIntervalMs;
  const lsaFloodCompleteAtMs = deadAtMs + profile.lsaFloodMs;
  const spfCompleteAtMs = lsaFloodCompleteAtMs + profile.spfDelayMs;
  const ribInstallAtMs = spfCompleteAtMs + profile.ribInstallMs;
  const fibInstallAtMs = ribInstallAtMs + profile.fibInstallMs;
  const helloMissAt = Math.min(profile.helloIntervalMs, Math.max(1, deadAtMs - 1));
  const labels = [link.a, link.b].map((id) => graph.nodes.find((node) => node.id === id)?.label ?? id.toUpperCase());
  const events: BuilderOspfConvergenceEvent[] = [
    { id: 'link-down', atMs: 0, kind: 'LINK_DOWN', summary: `${labels[0]} ↔ ${labels[1]} carrier fails. The data plane sees the physical failure immediately.` },
    { id: 'hello-missed', atMs: helloMissAt, kind: 'HELLO_MISSED', summary: 'Expected OSPF Hello is missed, but the neighbor remains FULL until the dead timer expires.' },
    { id: 'dead-expired', atMs: deadAtMs, kind: 'DEAD_TIMER_EXPIRED', summary: 'Dead timer expires on the failed adjacency.' },
    { id: 'adj-down', atMs: deadAtMs, kind: 'ADJACENCY_DOWN', summary: `${labels[0]} ↔ ${labels[1]} transitions out of FULL.` },
    { id: 'lsa-originated', atMs: deadAtMs, kind: 'LSA_ORIGINATED', summary: 'Affected routers originate new link-state information.' },
    { id: 'lsa-flooded', atMs: lsaFloodCompleteAtMs, kind: 'LSA_FLOODED', summary: 'The Area 0 component has received the updated topology information.' },
    { id: 'spf-scheduled', atMs: lsaFloodCompleteAtMs, kind: 'SPF_SCHEDULED', summary: 'SPF is scheduled from the updated LSDB.' },
    { id: 'spf-complete', atMs: spfCompleteAtMs, kind: 'SPF_COMPLETE', summary: 'Deterministic SPF completes against the failed-link topology.' },
    { id: 'rib-updated', atMs: ribInstallAtMs, kind: 'RIB_UPDATED', summary: 'New OSPF routes are installed in the RIB; forwarding may still use stale FIB state.' },
    { id: 'fib-updated', atMs: fibInstallAtMs, kind: 'FIB_UPDATED', summary: 'Forwarding entries are programmed from the new RIB.' },
    { id: 'traffic-recovered', atMs: fibInstallAtMs, kind: 'TRAFFIC_RECOVERED', summary: 'New traffic consumes the reconverged OSPF forwarding path.' },
  ];

  return {
    failedLinkId,
    failedRouterIds: [link.a, link.b],
    beforeGraph,
    afterGraph,
    addressing,
    routing,
    sourceId,
    destinationId,
    profile,
    events,
    deadAtMs,
    lsaFloodCompleteAtMs,
    spfCompleteAtMs,
    ribInstallAtMs,
    fibInstallAtMs,
  };
}

export function snapshotBuilderOspfConvergence(
  scenario: BuilderOspfConvergenceScenario,
  elapsedMs: number,
): BuilderOspfConvergenceSnapshot {
  const elapsed = Math.max(0, Math.min(Math.round(elapsedMs), scenario.fibInstallAtMs + 10_000));
  const controlUsesFailedTopology = elapsed >= scenario.deadAtMs;
  const ribUsesFailedTopology = elapsed >= scenario.ribInstallAtMs;
  const fibUsesFailedTopology = elapsed >= scenario.fibInstallAtMs;
  const controlGraph = controlUsesFailedTopology ? scenario.afterGraph : scenario.beforeGraph;
  const ribGraph = ribUsesFailedTopology ? scenario.afterGraph : scenario.beforeGraph;
  const fibGraph = fibUsesFailedTopology ? scenario.afterGraph : scenario.beforeGraph;
  const controlState = builderOspfState(controlGraph, scenario.addressing, scenario.routing);
  const ribTrace = traceBuilderForwarding(scenario.afterGraph, scenario.addressing, scenario.routing, scenario.sourceId, scenario.destinationId, ribGraph);
  const fibTrace = traceBuilderForwarding(scenario.afterGraph, scenario.addressing, scenario.routing, scenario.sourceId, scenario.destinationId, fibGraph);

  let phase: BuilderOspfConvergencePhase;
  if (elapsed < scenario.deadAtMs) phase = 'PHYSICAL FAILURE · CONTROL PLANE STALE';
  else if (elapsed < scenario.lsaFloodCompleteAtMs) phase = 'DEAD TIMER · ADJACENCY DOWN';
  else if (elapsed < scenario.spfCompleteAtMs) phase = 'LSA FLOODING';
  else if (elapsed < scenario.ribInstallAtMs) phase = 'SPF RUNNING';
  else if (elapsed < scenario.fibInstallAtMs) phase = 'RIB UPDATED · FIB STALE';
  else phase = 'FIB UPDATED · TRAFFIC RECOVERED';

  return {
    elapsedMs: elapsed,
    phase,
    controlState,
    ribTrace,
    fibTrace,
    visibleEvents: scenario.events.filter((event) => event.atMs <= elapsed),
    controlUsesFailedTopology,
    ribUsesFailedTopology,
    fibUsesFailedTopology,
  };
}
'''
write('src/builder/ospf-timing.ts', ospf_timing)

panel = r'''import { useMemo, useState } from 'react';
import type { BuilderAddressing } from './builder/addressing.ts';
import type { BuilderGraph } from './builder/model.ts';
import type { BuilderRoutingConfig } from './builder/routing.ts';
import { createBuilderOspfLinkFailureScenario, DEFAULT_BUILDER_OSPF_TIMING, snapshotBuilderOspfConvergence } from './builder/ospf-timing.ts';

function labelFor(graph: BuilderGraph, id: string): string {
  return graph.nodes.find((node) => node.id === id)?.label ?? id.toUpperCase();
}

export function BuilderOspfTimingPanel({ graph, addressing, routing, sourceId, destinationId }: { graph: BuilderGraph; addressing: BuilderAddressing; routing: BuilderRoutingConfig; sourceId: string; destinationId: string }) {
  const eligible = useMemo(() => {
    const enabled = new Set(routing.ospf.enabledRouterIds);
    return graph.links.filter((link) => !link.failed && enabled.has(link.a) && enabled.has(link.b) && graph.nodes.find((node) => node.id === link.a)?.kind === 'router' && graph.nodes.find((node) => node.id === link.b)?.kind === 'router');
  }, [graph, routing]);
  const [preferredLinkId, setPreferredLinkId] = useState('edge-r1');
  const selectedLink = eligible.find((link) => link.id === preferredLinkId) ?? eligible[0] ?? null;
  const [elapsedMs, setElapsedMs] = useState(0);

  const scenario = useMemo(() => {
    if (!selectedLink) return null;
    try { return createBuilderOspfLinkFailureScenario(graph, addressing, routing, sourceId, destinationId, selectedLink.id); }
    catch { return null; }
  }, [graph, addressing, routing, sourceId, destinationId, selectedLink]);
  const snapshot = useMemo(() => scenario ? snapshotBuilderOspfConvergence(scenario, elapsedMs) : null, [scenario, elapsedMs]);

  if (routing.ospf.enabledRouterIds.length === 0) return null;
  if (!selectedLink || !scenario || !snapshot) return <section className="builder-ospf-timing-section"><div className="control-title"><span>OSPF CONVERGENCE</span><strong>NO ELIGIBLE LINK</strong></div><small className="builder-routing-note">Enable OSPF on both ends of an active router-router link to inspect timed convergence.</small></section>;

  const maxMs = scenario.fibInstallAtMs + 1000;
  const path = snapshot.fibTrace.hops.flatMap((hop, index) => index === 0 ? [hop.nodeId, hop.nextNodeId].filter(Boolean) : [hop.nextNodeId].filter(Boolean)) as string[];
  return <section className="builder-ospf-timing-section">
    <div className="control-title"><span>OSPF CONVERGENCE</span><strong>{snapshot.phase}</strong></div>
    <label>FAILURE LINK<select value={selectedLink.id} onChange={(event)=>{setPreferredLinkId(event.currentTarget.value);setElapsedMs(0);}}>{eligible.map((link)=><option key={link.id} value={link.id}>{labelFor(graph,link.a)} ↔ {labelFor(graph,link.b)} · COST {link.cost}</option>)}</select></label>
    <label>SIMULATION TIME · {(snapshot.elapsedMs/1000).toFixed(1)}s<input aria-label="OSPF convergence time" type="range" min={0} max={maxMs} step={100} value={Math.min(elapsedMs,maxMs)} onChange={(event)=>setElapsedMs(Number(event.currentTarget.value))}/></label>
    <div className="button-row"><button type="button" onClick={()=>setElapsedMs(0)}>LINK DOWN</button><button type="button" onClick={()=>setElapsedMs(scenario.deadAtMs)}>DEAD TIMER</button><button type="button" onClick={()=>setElapsedMs(scenario.spfCompleteAtMs)}>SPF DONE</button><button type="button" onClick={()=>setElapsedMs(scenario.fibInstallAtMs)}>FIB DONE</button></div>
    <div className="builder-ospf-timing-grid">
      <div><span>PHYSICAL</span><strong>LINK DOWN · t=0</strong></div>
      <div><span>NEIGHBOR</span><strong>{snapshot.controlUsesFailedTopology?'DOWN':'FULL · STALE'}</strong></div>
      <div><span>RIB</span><strong>{snapshot.ribUsesFailedTopology?'RECONVERGED':'OLD ROUTE'}</strong></div>
      <div><span>FIB</span><strong>{snapshot.fibUsesFailedTopology?'REPROGRAMMED':'OLD NEXT HOP'}</strong></div>
      <div><span>TRAFFIC</span><strong>{snapshot.fibTrace.reachable?'RECOVERED':snapshot.fibTrace.failureReason ?? 'INTERRUPTED'}</strong></div>
    </div>
    <div className={`builder-ospf-timing-path ${snapshot.fibTrace.reachable?'recovered':'failed'}`}><span>DATA PLANE AT THIS INSTANT</span><strong>{snapshot.fibTrace.reachable && path.length>0 ? path.map((id)=>labelFor(graph,id)).join(' → ') : `${snapshot.fibTrace.failureNodeId ? labelFor(graph,snapshot.fibTrace.failureNodeId) : 'FORWARDING'} · ${snapshot.fibTrace.failureReason ?? 'NO PROGRESS'}`}</strong><p>{snapshot.fibTrace.explanation}</p></div>
    <div className="builder-ospf-event-strip">{scenario.events.map((event)=><button type="button" key={event.id} className={event.atMs<=snapshot.elapsedMs?'visible':''} onClick={()=>setElapsedMs(event.atMs)}><b>{(event.atMs/1000).toFixed(1)}s · {event.kind.replaceAll('_',' ')}</b><span>{event.summary}</span></button>)}</div>
    <small className="builder-routing-note">TIMED TEACHING MODEL · HELLO {DEFAULT_BUILDER_OSPF_TIMING.helloIntervalMs/1000}s · DEAD {DEFAULT_BUILDER_OSPF_TIMING.deadIntervalMs/1000}s · PHYSICAL FAILURE, NEIGHBOR KNOWLEDGE, SPF, RIB, FIB, AND TRAFFIC RECOVERY STAY DISTINCT.</small>
  </section>;
}
'''
write('src/BuilderOspfTimingPanel.tsx', panel)

contract = r'''import assert from 'node:assert/strict';
import { createDefaultBuilderAddressing } from '../src/builder/addressing.ts';
import { cloneBuilderGraph, defaultBuilderGraph } from '../src/builder/model.ts';
import { createDefaultBuilderRoutingConfig, setBuilderOspfEverywhere, traceBuilderForwarding } from '../src/builder/routing.ts';
import { createBuilderOspfLinkFailureScenario, DEFAULT_BUILDER_OSPF_TIMING, snapshotBuilderOspfConvergence, validateBuilderOspfTimingProfile } from '../src/builder/ospf-timing.ts';

const graph=cloneBuilderGraph(defaultBuilderGraph);
const addressing=createDefaultBuilderAddressing(graph);
let routing=createDefaultBuilderRoutingConfig();
routing=setBuilderOspfEverywhere(graph,addressing,routing,true);
const baseline=traceBuilderForwarding(graph,addressing,routing,'client','app');
assert.equal(baseline.reachable,true,'OSPF baseline must reach APP before the failure');
assert.ok(baseline.hops.some((hop)=>hop.nextNodeId==='r1'),'default SPF path should prefer R1 before failure');

const scenario=createBuilderOspfLinkFailureScenario(graph,addressing,routing,'client','app','edge-r1');
assert.equal(scenario.deadAtMs,DEFAULT_BUILDER_OSPF_TIMING.deadIntervalMs);
assert.ok(scenario.deadAtMs<scenario.spfCompleteAtMs);
assert.ok(scenario.spfCompleteAtMs<scenario.ribInstallAtMs);
assert.ok(scenario.ribInstallAtMs<scenario.fibInstallAtMs);
assert.deepEqual(scenario.events.map((event)=>event.kind),['LINK_DOWN','HELLO_MISSED','DEAD_TIMER_EXPIRED','ADJACENCY_DOWN','LSA_ORIGINATED','LSA_FLOODED','SPF_SCHEDULED','SPF_COMPLETE','RIB_UPDATED','FIB_UPDATED','TRAFFIC_RECOVERED']);

const immediate=snapshotBuilderOspfConvergence(scenario,0);
assert.equal(immediate.controlUsesFailedTopology,false,'neighbor remains logically FULL until dead timer');
assert.equal(immediate.fibUsesFailedTopology,false);
assert.equal(immediate.fibTrace.reachable,false,'physical link is down while the old FIB still points at it');
assert.match(immediate.fibTrace.failureReason ?? '',/LINK DOWN/i);
assert.equal(immediate.controlState.adjacencies.find((adj)=>adj.linkId==='edge-r1')?.state,'FULL');

const beforeDead=snapshotBuilderOspfConvergence(scenario,scenario.deadAtMs-1);
assert.equal(beforeDead.controlState.adjacencies.find((adj)=>adj.linkId==='edge-r1')?.state,'FULL');
const dead=snapshotBuilderOspfConvergence(scenario,scenario.deadAtMs);
assert.equal(dead.controlUsesFailedTopology,true);
assert.equal(dead.controlState.adjacencies.find((adj)=>adj.linkId==='edge-r1')?.state,'DOWN');
assert.equal(dead.fibTrace.reachable,false,'adjacency loss does not instantly rewrite forwarding state');

const rib=snapshotBuilderOspfConvergence(scenario,scenario.ribInstallAtMs);
assert.equal(rib.ribUsesFailedTopology,true);
assert.equal(rib.fibUsesFailedTopology,false);
assert.equal(rib.fibTrace.reachable,false,'RIB convergence precedes FIB programming');

const recovered=snapshotBuilderOspfConvergence(scenario,scenario.fibInstallAtMs);
assert.equal(recovered.fibUsesFailedTopology,true);
assert.equal(recovered.fibTrace.reachable,true,'traffic recovers only after the FIB consumes the new topology');
assert.ok(recovered.fibTrace.hops.some((hop)=>hop.nextNodeId==='r2'),'reconverged forwarding must use R2 after edge-r1 fails');
assert.equal(recovered.visibleEvents.at(-1)?.kind,'TRAFFIC_RECOVERED');

assert.throws(()=>createBuilderOspfLinkFailureScenario(graph,addressing,routing,'client','app','client-edge'),/router-router/i);
assert.throws(()=>validateBuilderOspfTimingProfile({...DEFAULT_BUILDER_OSPF_TIMING,deadIntervalMs:1000,helloIntervalMs:2000}),/dead interval/i);
console.log('Builder OSPF timing contract passed: physical failure, stale FULL state, dead timer, LSA/SPF, distinct RIB/FIB install, and R2 traffic recovery.');
'''
write('scripts/builder-ospf-timing-contract-check.mjs', contract)

doc = r'''# Lab 11M — OSPF convergence timing

Lab 11M starts by replacing the old “link down means every router instantly knows” shortcut with an explicit deterministic convergence episode.

## Implemented in this slice

- Physical carrier failure is visible to the data plane at `t=0`.
- The OSPF adjacency remains logically `FULL` until the dead timer expires; a missed Hello does not itself withdraw the neighbor.
- Dead-timer expiry, adjacency loss, LSA origination/flooding, SPF scheduling/completion, RIB installation, FIB programming, and traffic recovery are separate ordered events.
- The live physical graph and the OSPF topology used by the RIB/FIB are intentionally allowed to disagree during convergence.
- That disagreement is observable: immediately after `edge-r1` fails, the old FIB still chooses R1 and forwarding fails on the physical link; after FIB programming, the same flow uses R2 and recovers.
- Network Builder exposes a scrub-able convergence inspector with milestone controls and the event sequence.

## Default teaching timers

- Hello: 10 s
- Dead: 40 s
- LSA flood delay: 200 ms
- SPF delay: 500 ms
- RIB install: 100 ms
- FIB install: 100 ms

These are deterministic teaching defaults, not a claim that every implementation uses these exact operational values.

## Truth boundaries

The convergence inspector is a deterministic counterfactual over the selected active OSPF router-router link. It does not mutate the live Builder graph. The “physical” graph used for actual packet forwarding is the failed-link graph while control/RIB/FIB knowledge advances independently through the event timeline.

This is deliberately separate from the future Builder-wide time machine. The important foundation is already present: physical state, neighbor knowledge, LSDB/SPF, RIB, FIB, and user traffic no longer have to transition atomically.

## Deferred remainder of 11M

- per-interface/custom Hello/dead timer configuration
- DR/BDR and broadcast-network adjacency behavior
- equal-cost multipath with deterministic flow hashing
- multi-area OSPF, ABRs, inter-area routes, and summarization
- stub/NSSA behavior and redistribution

The timing engine should be reused when those features arrive rather than replaced with another convergence model.
'''
write('docs/LAB11M.md', doc)

# routing.ts: let OSPF route derivation consume a topology snapshot separate from physical forwarding truth.
replace_once('src/builder/routing.ts',
'''function ospfRouteEntriesForBuilderRouter(\n  graph: BuilderGraph,\n  addressing: BuilderAddressing,\n  routing: BuilderRoutingConfig,\n  routerId: string,\n): BuilderRouteTableEntry[] {''',
'''function ospfRouteEntriesForBuilderRouter(\n  graph: BuilderGraph,\n  addressing: BuilderAddressing,\n  routing: BuilderRoutingConfig,\n  routerId: string,\n): BuilderRouteTableEntry[] {''')
# Above anchor intentionally verifies the expected function still exists.
replace_once('src/builder/routing.ts',
'''export function routeTableForBuilderRouter(\n  graph: BuilderGraph,\n  addressing: BuilderAddressing,\n  routing: BuilderRoutingConfig,\n  routerId: string,\n): BuilderRouteTableEntry[] {''',
'''export function routeTableForBuilderRouter(\n  graph: BuilderGraph,\n  addressing: BuilderAddressing,\n  routing: BuilderRoutingConfig,\n  routerId: string,\n  ospfTopologyGraph: BuilderGraph = graph,\n): BuilderRouteTableEntry[] {''')
replace_once('src/builder/routing.ts',
'''  entries.push(...ospfRouteEntriesForBuilderRouter(graph, addressing, routing, routerId));''',
'''  entries.push(...ospfRouteEntriesForBuilderRouter(ospfTopologyGraph, addressing, routing, routerId));''')
replace_once('src/builder/routing.ts',
'''export function traceBuilderForwarding(\n  graph: BuilderGraph,\n  addressing: BuilderAddressing,\n  routing: BuilderRoutingConfig,\n  sourceNodeId: string,\n  destinationNodeId: string,\n): BuilderForwardingTrace {''',
'''export function traceBuilderForwarding(\n  graph: BuilderGraph,\n  addressing: BuilderAddressing,\n  routing: BuilderRoutingConfig,\n  sourceNodeId: string,\n  destinationNodeId: string,\n  ospfTopologyGraph: BuilderGraph = graph,\n): BuilderForwardingTrace {''')
replace_once('src/builder/routing.ts',
'''    const table = routeTableForBuilderRouter(graph, addressing, routing, currentNodeId);''',
'''    const table = routeTableForBuilderRouter(graph, addressing, routing, currentNodeId, ospfTopologyGraph);''')

# Network Builder visible inspector.
replace_once('src/NetworkBuilder.tsx',
'''import { BuilderNatPanel } from './BuilderNatPanel.tsx';\nimport './NetworkBuilder.css';''',
'''import { BuilderNatPanel } from './BuilderNatPanel.tsx';\nimport { BuilderOspfTimingPanel } from './BuilderOspfTimingPanel.tsx';\nimport './NetworkBuilder.css';''')
replace_once('src/NetworkBuilder.tsx',
'''          <section className="builder-acl-section">''',
'''          <BuilderOspfTimingPanel graph={graph} addressing={addressing} routing={routing} sourceId={sourceId} destinationId={destinationId}/>\n          <section className="builder-acl-section">''')
replace_once('src/NetworkBuilder.tsx',
'''SINGLE-AREA TEACHING MODEL · ROUTER-ROUTER ADJACENCIES · DETERMINISTIC SPF · NO HELLO/DEAD TIMERS OR ECMP YET.''',
'''SINGLE-AREA BASE MODEL · ROUTER-ROUTER ADJACENCIES · TIMED FAILURE INSPECTOR BELOW · ECMP / MULTI-AREA STILL DEFERRED.''')

css_path=ROOT/'src/NetworkBuilder.css'
css=css_path.read_text(encoding='utf-8')
css += r'''

.builder-ospf-timing-section{display:grid;gap:.72rem}.builder-ospf-timing-section input[type="range"]{width:100%;accent-color:currentColor}.builder-ospf-timing-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:.45rem}.builder-ospf-timing-grid>div{border:1px solid var(--line);padding:.55rem;min-width:0}.builder-ospf-timing-grid span,.builder-ospf-timing-path>span{display:block;font-size:.64rem;letter-spacing:.12em;opacity:.62}.builder-ospf-timing-grid strong{display:block;margin-top:.25rem;font-size:.72rem;line-height:1.25}.builder-ospf-timing-path{border-left:2px solid currentColor;padding:.58rem .72rem}.builder-ospf-timing-path.failed{opacity:.82}.builder-ospf-timing-path strong{display:block;margin:.22rem 0;font-size:.84rem}.builder-ospf-timing-path p{margin:0;font-size:.75rem;opacity:.72}.builder-ospf-event-strip{display:grid;gap:.35rem}.builder-ospf-event-strip button{text-align:left;display:grid;grid-template-columns:minmax(8rem,.34fr) 1fr;gap:.6rem;opacity:.46}.builder-ospf-event-strip button.visible{opacity:1}.builder-ospf-event-strip b,.builder-ospf-event-strip span{font-size:.68rem;line-height:1.25}@media(max-width:760px){.builder-ospf-timing-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.builder-ospf-event-strip button{grid-template-columns:1fr}}
'''
css_path.write_text(css, encoding='utf-8')

# Wire permanent contract into npm check.
pkg_path=ROOT/'package.json'
pkg=json.loads(pkg_path.read_text(encoding='utf-8'))
pkg['scripts']['test:builder-ospf-timing-contract']='node scripts/builder-ospf-timing-contract-check.mjs'
needle='npm run test:builder-ospf-contract && '
if needle not in pkg['scripts']['check']:
    raise SystemExit('package.json: OSPF contract position not found')
pkg['scripts']['check']=pkg['scripts']['check'].replace(needle, needle+'npm run test:builder-ospf-timing-contract && ',1)
pkg_path.write_text(json.dumps(pkg,indent=2)+'\n',encoding='utf-8')

# Mark only the completed 11M timing sub-slice. ECMP/multi-area remain intentionally unchecked.
road=ROOT/'docs/ROADMAP.md'
text=road.read_text(encoding='utf-8')
for old,new in [
('- [ ] explicit Hello/dead timers and adjacency lifecycle rather than instantaneous neighbor loss','- [x] explicit Hello/dead timers and adjacency lifecycle rather than instantaneous neighbor loss'),
('- [ ] LSA origination/flooding and per-router LSDB state','- [x] LSA origination/flooding and per-router LSDB state in deterministic link-failure convergence episodes'),
('- [ ] SPF scheduling, RIB installation, and FIB transition are distinct causal events','- [x] SPF scheduling, RIB installation, and FIB transition are distinct causal events'),
('- [ ] traffic can encounter stale state during convergence instead of teleporting directly to the final route','- [x] traffic can encounter stale state during convergence instead of teleporting directly to the final route'),
]:
    if old not in text: raise SystemExit(f'ROADMAP missing: {old}')
    text=text.replace(old,new,1)
road.write_text(text,encoding='utf-8')

print('Lab 11M timed OSPF slice applied.')
