import { readFileSync, writeFileSync } from 'node:fs';

function load(path){ return readFileSync(path,'utf8'); }
function save(path,text){ writeFileSync(path,text); }
function replaceOnce(path,before,after){
  const text=load(path);
  const first=text.indexOf(before);
  if(first<0) throw new Error(`Missing patch anchor in ${path}: ${before.slice(0,120)}`);
  if(text.indexOf(before,first+before.length)>=0) throw new Error(`Patch anchor is not unique in ${path}`);
  save(path,text.slice(0,first)+after+text.slice(first+before.length));
}
function assertIncludes(path,needle){
  if(!load(path).includes(needle)) throw new Error(`Expected ${path} to include ${needle}`);
}

replaceOnce('src/builder/device-workbench.ts',
`export type BuilderWorkbenchEventCategory = 'session' | 'topology' | 'config' | 'routing' | 'policy' | 'neighbor' | 'switching' | 'nat' | 'dhcp' | 'probe' | 'ipv6';
export type BuilderWorkbenchEventKind = 'session' | 'action' | 'physical' | 'control-plane' | 'rib' | 'fib' | 'resolution' | 'forwarding' | 'policy' | 'translation' | 'flow';

export interface BuilderWorkbenchEventSpec {`,
`export type BuilderWorkbenchEventCategory = 'session' | 'topology' | 'config' | 'routing' | 'policy' | 'neighbor' | 'switching' | 'nat' | 'dhcp' | 'probe' | 'ipv6';
export type BuilderWorkbenchEventKind = 'session' | 'action' | 'physical' | 'control-plane' | 'rib' | 'fib' | 'resolution' | 'forwarding' | 'policy' | 'translation' | 'flow';

export interface BuilderWorkbenchEventProjection {
  physical?: 'after';
  control?: 'after';
  rib?: 'after';
  fib?: 'after';
}

export interface BuilderWorkbenchEventSpec {`);

replaceOnce('src/builder/device-workbench.ts',
`  causeId?: string | null;
  causeKey?: string | null;
}

export interface BuilderWorkbenchEvent {`,
`  causeId?: string | null;
  causeKey?: string | null;
  projection?: BuilderWorkbenchEventProjection;
}

export interface BuilderWorkbenchEvent {`);

replaceOnce('src/builder/device-workbench.ts',
`  causeId: string | null;
  objectIds: string[];
}

export type BuilderWorkbenchEventJournal = BuilderWorkbenchEvent[];`,
`  causeId: string | null;
  objectIds: string[];
  projection?: BuilderWorkbenchEventProjection;
}

export type BuilderWorkbenchEventJournal = BuilderWorkbenchEvent[];`);

replaceOnce('src/builder/device-workbench.ts',
`export interface BuilderDeviceWorkbenchInput {
  graph: BuilderGraph;`,
`export interface BuilderWorkbenchTruthGraphs {
  controlGraph: BuilderGraph;
  ribGraph: BuilderGraph;
  fibGraph: BuilderGraph;
}

export interface BuilderDeviceWorkbenchInput {
  graph: BuilderGraph;
  truthGraphs?: BuilderWorkbenchTruthGraphs;`);

replaceOnce('src/builder/device-workbench.ts',
`      causeId,
      objectIds:[...new Set((entry.objectIds??[]).filter(Boolean))].slice(0,16),
    };`,
`      causeId,
      objectIds:[...new Set((entry.objectIds??[]).filter(Boolean))].slice(0,16),
      projection:entry.projection?{...entry.projection}:undefined,
    };`);

replaceOnce('src/builder/device-workbench.ts',
`function routedStateSections(input:BuilderDeviceWorkbenchInput,deviceId:string):BuilderWorkbenchSection[]{
  const node=input.graph.nodes.find((candidate)=>candidate.id===deviceId);if(!node)return[];
  const routeRows:BuilderWorkbenchRow[]=[];
  if(node.kind==='router'){
    routeTableForBuilderRouter(input.graph,input.addressing,input.routing,deviceId).forEach((entry)=>routeRows.push(row(\`state:route4:\${entry.id}\`,\`IPV4 \${entry.source.toUpperCase()}\`,entry.prefix,\`\${entry.nextHop?\`via \${entry.nextHop}\`:'DIRECT'} · \${entry.outgoingInterface} · AD \${entry.administrativeDistance} · M \${entry.metric} · \${entry.stateNote}\`,entry.active?'good':'bad',routeWhy(input.graph,input.addressing,input.routing,entry))));`,
`function routedStateSections(input:BuilderDeviceWorkbenchInput,deviceId:string):BuilderWorkbenchSection[]{
  const node=input.graph.nodes.find((candidate)=>candidate.id===deviceId);if(!node)return[];
  const ribGraph=input.truthGraphs?.ribGraph??input.graph;
  const controlGraph=input.truthGraphs?.controlGraph??input.graph;
  const routeRows:BuilderWorkbenchRow[]=[];
  if(node.kind==='router'){
    routeTableForBuilderRouter(ribGraph,input.addressing,input.routing,deviceId).forEach((entry)=>routeRows.push(row(\`state:route4:\${entry.id}\`,\`IPV4 \${entry.source.toUpperCase()}\`,entry.prefix,\`\${entry.nextHop?\`via \${entry.nextHop}\`:'DIRECT'} · \${entry.outgoingInterface} · AD \${entry.administrativeDistance} · M \${entry.metric} · \${entry.stateNote}\`,entry.active?'good':'bad',routeWhy(input.graph,input.addressing,input.routing,entry))));`);

replaceOnce('src/builder/device-workbench.ts',
`    const ospf=builderOspfState(input.graph,input.addressing,input.routing);ospf.adjacencies.filter((entry)=>entry.aRouterId===deviceId||entry.bRouterId===deviceId).forEach((entry)=>controlRows.push(row(`,
`    const ospf=builderOspfState(controlGraph,input.addressing,input.routing);ospf.adjacencies.filter((entry)=>entry.aRouterId===deviceId||entry.bRouterId===deviceId).forEach((entry)=>controlRows.push(row(`);

replaceOnce('src/builder/canonical-events.ts',
`  BuilderWorkbenchEventKind,
  BuilderWorkbenchEventSpec,
} from './device-workbench.ts';`,
`  BuilderWorkbenchEventKind,
  BuilderWorkbenchEventProjection,
  BuilderWorkbenchEventSpec,
} from './device-workbench.ts';`);

replaceOnce('src/builder/canonical-events.ts',
`  objectIds: string[] = [],
  causeKey?: string | null,
): BuilderWorkbenchEventSpec {
  return { key, kind, category, summary, detail, offsetMs, deviceRefs, objectIds, causeKey };
}`,
`  objectIds: string[] = [],
  causeKey?: string | null,
  projection?: BuilderWorkbenchEventProjection,
): BuilderWorkbenchEventSpec {
  return { key, kind, category, summary, detail, offsetMs, deviceRefs, objectIds, causeKey, projection };
}`);

replaceOnce('src/builder/canonical-events.ts',
`function ospfEventKind(kind: BuilderOspfConvergenceEventKind): BuilderWorkbenchEventKind {
  if (kind === 'LINK_DOWN') return 'physical';
  if (kind === 'RIB_UPDATED') return 'rib';
  if (kind === 'FIB_UPDATED') return 'fib';
  if (kind === 'TRAFFIC_RECOVERED') return 'flow';
  return 'control-plane';
}`,
`function ospfEventKind(kind: BuilderOspfConvergenceEventKind): BuilderWorkbenchEventKind {
  if (kind === 'LINK_DOWN') return 'physical';
  if (kind === 'RIB_UPDATED') return 'rib';
  if (kind === 'FIB_UPDATED') return 'fib';
  if (kind === 'TRAFFIC_RECOVERED') return 'flow';
  return 'control-plane';
}

function ospfProjection(kind: BuilderOspfConvergenceEventKind): BuilderWorkbenchEventProjection | undefined {
  if (kind === 'LINK_DOWN') return { physical: 'after' };
  if (kind === 'ADJACENCY_DOWN') return { control: 'after' };
  if (kind === 'RIB_UPDATED') return { rib: 'after' };
  if (kind === 'FIB_UPDATED') return { fib: 'after' };
  return undefined;
}`);

replaceOnce('src/builder/canonical-events.ts',
`          [prior.id, event.kind],
          previousKey,
        ));`,
`          [prior.id, event.kind],
          previousKey,
          ospfProjection(event.kind),
        ));`);

replaceOnce('src/builder/timeline.ts',
`function cloneTimelineState(state: BuilderTimelineState): BuilderTimelineState {
  if (typeof structuredClone === 'function') return structuredClone(state);
  return JSON.parse(JSON.stringify(state)) as BuilderTimelineState;
}`,
`function cloneValue<T>(value: T): T {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

function cloneTimelineState(state: BuilderTimelineState): BuilderTimelineState {
  return cloneValue(state);
}`);

replaceOnce('src/builder/timeline.ts',
`export function captureBuilderTimelineSnapshot(timeline: BuilderTimeline, journal: BuilderWorkbenchEventJournal, input: BuilderTimelineCaptureInput): BuilderTimeline {
  const lastSequence=timeline.snapshots.at(-1)?.sequence??-1;
  const uncaptured=journal.filter((event)=>event.sequence>lastSequence);
  if(uncaptured.length===0)return timeline;
  const state=cloneTimelineState(stateFromInput(input));
  const snapshots=uncaptured.map((event):BuilderTimelineSnapshot=>({
    eventId:event.id,
    sequence:event.sequence,
    atMs:event.atMs??event.sequence*BUILDER_TIMELINE_TICK_MS,
    category:event.category,
    kind:event.kind??'action',
    summary:event.summary,
    detail:event.detail,
    state,
  }));
  return { snapshots: [...timeline.snapshots,...snapshots].slice(-BUILDER_TIMELINE_LIMIT) };
}`,
`export function captureBuilderTimelineSnapshot(timeline: BuilderTimeline, journal: BuilderWorkbenchEventJournal, input: BuilderTimelineCaptureInput): BuilderTimeline {
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
  let truthGraphs={controlGraph:beforeGraph,ribGraph:beforeGraph,fibGraph:beforeGraph};
  let state:BuilderTimelineState={...finalState,graph:beforeGraph,truthGraphs};
  const snapshots=uncaptured.map((event):BuilderTimelineSnapshot=>{
    const projection=event.projection;
    if(projection){
      const nextTruth={...truthGraphs};
      let graph=state.graph;
      if(projection.physical==='after')graph=afterGraph;
      if(projection.control==='after')nextTruth.controlGraph=afterGraph;
      if(projection.rib==='after')nextTruth.ribGraph=afterGraph;
      if(projection.fib==='after')nextTruth.fibGraph=afterGraph;
      truthGraphs=nextTruth;
      state={...state,graph,truthGraphs};
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
}`);

replaceOnce('src/builder/acl.ts',
`  destinationPort: number|null=null,
  flowKey: BuilderFlowKey | string | null = null,
): BuilderPolicyTrace {
  const config=validateBuilderAclConfig(graph,acl);
  const forwarding=traceBuilderForwarding(graph,addressing,routing,sourceNodeId,destinationNodeId,graph,flowKey);`,
`  destinationPort: number|null=null,
  flowKey: BuilderFlowKey | string | null = null,
  routingGraph: BuilderGraph = graph,
): BuilderPolicyTrace {
  const config=validateBuilderAclConfig(graph,acl);
  const forwarding=traceBuilderForwarding(graph,addressing,routing,sourceNodeId,destinationNodeId,routingGraph,flowKey);`);

replaceOnce('src/NetworkBuilder.tsx',
`  const sceneGraph = sceneState.graph;
  const sceneAddressing = sceneState.addressing;`,
`  const sceneGraph = sceneState.graph;
  const sceneControlGraph = sceneState.truthGraphs?.controlGraph ?? sceneGraph;
  const sceneRibGraph = sceneState.truthGraphs?.ribGraph ?? sceneGraph;
  const sceneFibGraph = sceneState.truthGraphs?.fibGraph ?? sceneGraph;
  const sceneAddressing = sceneState.addressing;`);

replaceOnce('src/NetworkBuilder.tsx',
`  const forwardingTrace = useMemo(() => traceBuilderForwarding(sceneGraph, sceneAddressing, sceneRouting, sceneSourceId, sceneDestinationId), [sceneGraph, sceneAddressing, sceneRouting, sceneSourceId, sceneDestinationId]);
  const policyTrace = useMemo(() => traceBuilderPolicy(sceneGraph, sceneAddressing, sceneRouting, sceneAcl, sceneSourceId, sceneDestinationId, 'icmp'), [sceneGraph, sceneAddressing, sceneRouting, sceneAcl, sceneSourceId, sceneDestinationId]);
  const ospfState = useMemo(() => builderOspfState(sceneGraph, sceneAddressing, sceneRouting), [sceneGraph, sceneAddressing, sceneRouting]);`,
`  const forwardingTrace = useMemo(() => traceBuilderForwarding(sceneGraph, sceneAddressing, sceneRouting, sceneSourceId, sceneDestinationId, sceneFibGraph), [sceneGraph, sceneAddressing, sceneRouting, sceneSourceId, sceneDestinationId, sceneFibGraph]);
  const policyTrace = useMemo(() => traceBuilderPolicy(sceneGraph, sceneAddressing, sceneRouting, sceneAcl, sceneSourceId, sceneDestinationId, 'icmp', null, null, sceneFibGraph), [sceneGraph, sceneAddressing, sceneRouting, sceneAcl, sceneSourceId, sceneDestinationId, sceneFibGraph]);
  const ospfState = useMemo(() => builderOspfState(sceneControlGraph, sceneAddressing, sceneRouting), [sceneControlGraph, sceneAddressing, sceneRouting]);`);

replaceOnce('src/NetworkBuilder.tsx',
`  const selectedRouteTable = selectedNode?.kind === 'router' ? routeTableForBuilderRouter(sceneGraph, sceneAddressing, sceneRouting, selectedNode.id) : [];`,
`  const selectedRouteTable = selectedNode?.kind === 'router' ? routeTableForBuilderRouter(sceneRibGraph, sceneAddressing, sceneRouting, selectedNode.id) : [];`);

replaceOnce('scripts/builder-canonical-events-contract-check.mjs',
`import assert from 'node:assert/strict';`,
`import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';`);

replaceOnce('scripts/builder-canonical-events-contract-check.mjs',
`const stateRefs=new Set(timeline.snapshots.slice(1).map((snapshot)=>snapshot.state));
assert.equal(stateRefs.size,1,'events captured from one committed Builder action should share one immutable state snapshot');`,
`const failed=(candidate)=>candidate.links.find((link)=>link.id==='edge-r1')?.failed===true;
const actionSnapshot=timeline.snapshots.find((snapshot)=>snapshot.eventId===action.id);
const linkDownSnapshot=timeline.snapshots.find((snapshot)=>snapshot.summary==='OSPF · LINK DOWN');
const helloSnapshot=timeline.snapshots.find((snapshot)=>snapshot.summary==='OSPF · HELLO MISSED');
const deadSnapshot=timeline.snapshots.find((snapshot)=>snapshot.summary==='OSPF · DEAD TIMER EXPIRED');
const adjacencySnapshot=timeline.snapshots.find((snapshot)=>snapshot.summary==='OSPF · ADJACENCY DOWN');
const ribSnapshot=timeline.snapshots.find((snapshot)=>snapshot.summary==='OSPF · RIB UPDATED');
const fibSnapshot=timeline.snapshots.find((snapshot)=>snapshot.summary==='OSPF · FIB UPDATED');
assert.ok(actionSnapshot&&linkDownSnapshot&&helloSnapshot&&deadSnapshot&&adjacencySnapshot&&ribSnapshot&&fibSnapshot);
assert.equal(failed(actionSnapshot.state.graph),false,'root action is inspectable before the physical transition is applied');
assert.equal(failed(linkDownSnapshot.state.graph),true,'physical link failure must project immediately at LINK DOWN');
assert.ok(linkDownSnapshot.state.truthGraphs,'timed convergence snapshots must carry independent truth graphs');
assert.equal(failed(linkDownSnapshot.state.truthGraphs.controlGraph),false,'OSPF control plane must remain stale immediately after carrier loss');
assert.equal(failed(linkDownSnapshot.state.truthGraphs.ribGraph),false,'RIB must remain stale immediately after carrier loss');
assert.equal(failed(linkDownSnapshot.state.truthGraphs.fibGraph),false,'FIB must remain stale immediately after carrier loss');
assert.equal(linkDownSnapshot.state,helloSnapshot.state,'events without a truth transition should continue sharing the same immutable scene state');
assert.equal(helloSnapshot.state,deadSnapshot.state,'dead-timer expiry alone must not allocate a duplicate scene state');
assert.equal(failed(adjacencySnapshot.state.truthGraphs.controlGraph),true,'ADJACENCY DOWN must advance control-plane truth to the failed topology');
assert.equal(failed(adjacencySnapshot.state.truthGraphs.ribGraph),false,'RIB must still be stale after control-plane convergence begins');
assert.equal(failed(ribSnapshot.state.truthGraphs.ribGraph),true,'RIB UPDATED must advance route-selection truth');
assert.equal(failed(ribSnapshot.state.truthGraphs.fibGraph),false,'FIB must remain stale until its own install event');
assert.equal(failed(fibSnapshot.state.truthGraphs.fibGraph),true,'FIB UPDATED must advance forwarding truth');

const builderSource=readFileSync(new URL('../src/NetworkBuilder.tsx',import.meta.url),'utf8');
assert.match(builderSource,/sceneState\\.truthGraphs\\?\\.controlGraph \\?\\? sceneGraph/);
assert.match(builderSource,/routeTableForBuilderRouter\\(sceneRibGraph/);
assert.match(builderSource,/traceBuilderForwarding\\(sceneGraph, sceneAddressing, sceneRouting, sceneSourceId, sceneDestinationId, sceneFibGraph\\)/);`);

replaceOnce('scripts/builder-canonical-events-contract-check.mjs',
`console.log('Builder canonical-event contract passed: action events expand from canonical model deltas into deterministic physical/control-plane/RIB/FIB/resolution/forwarding/translation/flow events, preserve model timing, causal links, and bounded shared-state timeline capture.');`,
`console.log('Builder canonical-event contract passed: canonical model events preserve timing and causality while timed OSPF history independently projects physical, control-plane, RIB, and FIB truth with bounded structural sharing.');`);

replaceOnce('docs/ROADMAP.md',
`  - [x] third-slice foundation: canonical model deltas emit deterministic physical/control-plane/RIB/FIB/resolution/forwarding/translation/flow events, including timed OSPF convergence and probe/L2 outcomes
  - [ ] finish protocol-native stage coverage for DHCP transactions, complete protocol databases/counters, and per-stage historical scene projection`,
`  - [x] third-slice foundation: canonical model deltas emit deterministic physical/control-plane/RIB/FIB/resolution/forwarding/translation/flow events, including timed OSPF convergence and probe/L2 outcomes
  - [x] timed OSPF intermediate history projects physical, control-plane, RIB, and FIB truth independently, so stale control/route/forwarding state remains inspectable during convergence
  - [ ] finish protocol-native stage coverage for DHCP transactions, complete protocol databases/counters, and extend per-stage historical scene projection beyond timed OSPF`);

replaceOnce('docs/TRACKA.md',
`One React commit can therefore append several timeline events. The timeline captures every new event in that batch while sharing one immutable post-action state snapshot across the batch, so event granularity does not multiply the large Builder-state allocation. Cause links keep derived events rooted in the action that produced them, with the OSPF timed chain preserving its internal causal order.

This is the event-granularity foundation, not the claim that every protocol database is fully time-native yet. DHCP transaction stages, full protocol-database row diffs/counters, and per-stage historical scene projection remain follow-on Track A depth.`,
`One React commit can therefore append several timeline events. Ordinary derived events still share one immutable post-action state snapshot. Timed OSPF is the first event family to go deeper: the timeline allocates a new lightweight scene-state shell only when a truth dimension actually advances, while the large unchanged Builder state remains structurally shared.

For timed OSPF link failure, physical topology, control-plane knowledge, RIB selection, and FIB forwarding each have an independent historical graph. LINK DOWN can therefore show carrier loss while the neighbor is still FULL and stale forwarding remains installed; ADJACENCY DOWN advances control-plane truth; RIB UPDATED advances route selection while the FIB is still stale; and FIB UPDATED finally advances forwarding. The main canvas, OSPF state, route table, policy trace, forwarding overlay, and Device Workbench consume the appropriate truth dimension rather than collapsing all four into the final topology.

This is still the event-granularity foundation, not the claim that every protocol database is fully time-native yet. DHCP transaction stages, full protocol-database row diffs/counters, and equivalent per-stage historical projection for non-OSPF protocols remain follow-on Track A depth.`);

for(const [path,needle] of [
  ['src/builder/device-workbench.ts','projection:entry.projection?{...entry.projection}:undefined'],
  ['src/builder/canonical-events.ts','function ospfProjection'],
  ['src/builder/timeline.ts','truthGraphs={controlGraph:beforeGraph,ribGraph:beforeGraph,fibGraph:beforeGraph}'],
  ['src/NetworkBuilder.tsx','const sceneFibGraph = sceneState.truthGraphs?.fibGraph ?? sceneGraph'],
  ['scripts/builder-canonical-events-contract-check.mjs','independently projects physical, control-plane, RIB, and FIB truth'],
]) assertIncludes(path,needle);

console.log('Track A intermediate OSPF historical truth patch applied.');
