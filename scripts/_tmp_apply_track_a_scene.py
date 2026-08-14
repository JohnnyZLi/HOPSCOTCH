from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def read(path: str) -> str:
    return (ROOT / path).read_text()

def write(path: str, content: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content)

def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected one match, found {count}')
    return text.replace(old, new, 1)

# 1) Extend timeline snapshots with scene-only truth that the Device Workbench does not consume.
path = 'src/builder/timeline.ts'
text = read(path)
text = replace_once(
    text,
    "import { buildBuilderDeviceWorkbench, type BuilderDeviceRef, type BuilderDeviceWorkbenchInput, type BuilderDeviceWorkbenchSnapshot, type BuilderWorkbenchEventJournal, type BuilderWorkbenchRow } from './device-workbench.ts';\n",
    "import { buildBuilderDeviceWorkbench, type BuilderDeviceRef, type BuilderDeviceWorkbenchInput, type BuilderDeviceWorkbenchSnapshot, type BuilderWorkbenchEventJournal, type BuilderWorkbenchRow } from './device-workbench.ts';\nimport type { BuilderIpv6LifecycleState } from './ipv6-lifecycle.ts';\nimport type { BuilderLinkProfiles } from './link-characteristics.ts';\nimport type { BuilderLayout } from './model.ts';\n",
    'timeline imports',
)
text = replace_once(
    text,
    "export type BuilderTimelineState = Omit<BuilderDeviceWorkbenchInput, 'events'>;\n",
    "export type BuilderTimelineState = Omit<BuilderDeviceWorkbenchInput, 'events'> & {\n  layout: BuilderLayout;\n  linkProfiles: BuilderLinkProfiles;\n  ipv6LifecycleState: BuilderIpv6LifecycleState;\n};\n\nexport type BuilderTimelineCaptureInput = BuilderDeviceWorkbenchInput & Pick<BuilderTimelineState, 'layout' | 'linkProfiles' | 'ipv6LifecycleState'>;\n",
    'timeline state type',
)
text = text.replace('function stateFromInput(input: BuilderDeviceWorkbenchInput): BuilderTimelineState {', 'function stateFromInput(input: BuilderTimelineCaptureInput): BuilderTimelineState {')
text = text.replace('export function captureBuilderTimelineSnapshot(timeline: BuilderTimeline, journal: BuilderWorkbenchEventJournal, input: BuilderDeviceWorkbenchInput): BuilderTimeline {', 'export function captureBuilderTimelineSnapshot(timeline: BuilderTimeline, journal: BuilderWorkbenchEventJournal, input: BuilderTimelineCaptureInput): BuilderTimeline {')
write(path, text)

# 2) Make NetworkBuilder derive all visible truth from either LIVE or one historical snapshot.
path = 'src/NetworkBuilder.tsx'
text = read(path)
start = text.index('  const route = useMemo(')
end = text.index('  const setMessage =', start)
new_block = r'''  const runtimeEthernet = useMemo(() => applyBuilderDhcpState(ethernet, dhcp, dhcpLeases, dhcpSequence), [ethernet, dhcp, dhcpLeases, dhcpSequence]);
  const liveWorkbenchInput = useMemo<BuilderDeviceWorkbenchInput>(() => ({ graph, addressing, routing, ipv6, ipv6ControlState, ipv6RoutingDepth, ethernet, ethernetFlow, arpCache, arpResolutions, acl, nat, natSessions, dhcp, dhcpLeases, dhcpSequence, probeHistory, sourceId, destinationId, events: workbenchEvents }), [graph, addressing, routing, ipv6, ipv6ControlState, ipv6RoutingDepth, ethernet, ethernetFlow, arpCache, arpResolutions, acl, nat, natSessions, dhcp, dhcpLeases, dhcpSequence, probeHistory, sourceId, destinationId, workbenchEvents]);
  const liveTimelineInput = useMemo(() => ({ ...liveWorkbenchInput, layout, linkProfiles, ipv6LifecycleState }), [liveWorkbenchInput, layout, linkProfiles, ipv6LifecycleState]);
  useEffect(() => {
    if (stressLabel) return;
    setTimeline((current) => captureBuilderTimelineSnapshot(current, workbenchEvents, liveTimelineInput));
  }, [stressLabel, workbenchEvents, liveTimelineInput]);
  const historicalTimelineSnapshot = timelineCursor == null ? null : builderTimelineSnapshotAtSequence(timeline, timelineCursor);
  const isHistorical = historicalTimelineSnapshot != null;
  const sceneState = historicalTimelineSnapshot?.state ?? liveTimelineInput;
  const sceneGraph = sceneState.graph;
  const sceneAddressing = sceneState.addressing;
  const sceneRouting = sceneState.routing;
  const sceneIpv6 = sceneState.ipv6;
  const sceneIpv6ControlState = sceneState.ipv6ControlState;
  const sceneIpv6LifecycleState = sceneState.ipv6LifecycleState;
  const sceneIpv6RoutingDepth = sceneState.ipv6RoutingDepth;
  const sceneEthernet = sceneState.ethernet;
  const sceneEthernetFlow = sceneState.ethernetFlow;
  const sceneArpCache = sceneState.arpCache;
  const sceneArpResolutions = sceneState.arpResolutions;
  const sceneAcl = sceneState.acl;
  const sceneNat = sceneState.nat;
  const sceneNatSessions = sceneState.natSessions;
  const sceneDhcp = sceneState.dhcp;
  const sceneDhcpLeases = sceneState.dhcpLeases;
  const sceneDhcpSequence = sceneState.dhcpSequence;
  const sceneProbeHistory = sceneState.probeHistory;
  const sceneSourceId = sceneState.sourceId;
  const sceneDestinationId = sceneState.destinationId;
  const sceneLayout = sceneState.layout;
  const sceneLinkProfiles = sceneState.linkProfiles;
  const sceneSelectedNodeId = sceneGraph.nodes.some((node) => node.id === selectedNodeId) ? selectedNodeId : chooseValidNode(sceneGraph, sceneSourceId);
  const sceneSelectedLinkId = sceneGraph.links.some((link) => link.id === selectedLinkId) ? selectedLinkId : (sceneGraph.links[0]?.id ?? '');
  const sceneEthernetEndpoints = sceneEthernet.devices.filter((device) => device.kind === 'endpoint');
  const sceneEthernetSourceId = sceneEthernet.devices.some((device) => device.id === ethernetSourceId) ? ethernetSourceId : (sceneEthernetEndpoints[0]?.id ?? '');
  const sceneEthernetDestinationId = sceneEthernet.devices.some((device) => device.id === ethernetDestinationId) ? ethernetDestinationId : (sceneEthernetEndpoints.find((device) => device.id !== sceneEthernetSourceId)?.id ?? sceneEthernetSourceId);
  const sceneSelectedEthernetLinkId = sceneEthernet.links.some((link) => link.id === selectedEthernetLinkId) ? selectedEthernetLinkId : (sceneEthernet.links[0]?.id ?? '');
  const sceneRenderState = { ...sceneState, selectedNodeId: sceneSelectedNodeId, selectedLinkId: sceneSelectedLinkId, ethernetSourceId: sceneEthernetSourceId, ethernetDestinationId: sceneEthernetDestinationId, selectedEthernetLinkId: sceneSelectedEthernetLinkId };

  const route = useMemo(() => findShortestPath(sceneGraph, sceneSourceId, sceneDestinationId), [sceneGraph, sceneSourceId, sceneDestinationId]);
  const forwardingTrace = useMemo(() => traceBuilderForwarding(sceneGraph, sceneAddressing, sceneRouting, sceneSourceId, sceneDestinationId), [sceneGraph, sceneAddressing, sceneRouting, sceneSourceId, sceneDestinationId]);
  const policyTrace = useMemo(() => traceBuilderPolicy(sceneGraph, sceneAddressing, sceneRouting, sceneAcl, sceneSourceId, sceneDestinationId, 'icmp'), [sceneGraph, sceneAddressing, sceneRouting, sceneAcl, sceneSourceId, sceneDestinationId]);
  const ospfState = useMemo(() => builderOspfState(sceneGraph, sceneAddressing, sceneRouting), [sceneGraph, sceneAddressing, sceneRouting]);
  const selectedLink = sceneGraph.links.find((link) => link.id === sceneSelectedLinkId) ?? sceneGraph.links[0];
  const selectedLinkProfile = selectedLink ? sceneLinkProfiles[selectedLink.id] : undefined;
  const selectedNode = sceneGraph.nodes.find((node) => node.id === sceneSelectedNodeId) ?? sceneGraph.nodes[0];
  const selectedSegment = selectedLink ? sceneAddressing.segments[selectedLink.id] : undefined;
  const selectedNodeInterfaces = selectedNode ? interfacesForBuilderNode(sceneAddressing, selectedNode.id) : [];
  const selectedRouteTable = selectedNode?.kind === 'router' ? routeTableForBuilderRouter(sceneGraph, sceneAddressing, sceneRouting, selectedNode.id) : [];
  const selectedOspfEnabled = Boolean(selectedNode?.kind === 'router' && sceneRouting.ospf.enabledRouterIds.includes(selectedNode.id));
  const selectedOspfAdjacencies = selectedNode?.kind === 'router' ? ospfState.adjacencies.filter((adjacency) => adjacency.aRouterId === selectedNode.id || adjacency.bRouterId === selectedNode.id) : [];
  const selectedOspfComponent = selectedNode?.kind === 'router' ? ospfState.components.find((component) => component.includes(selectedNode.id)) : undefined;
  const selectedOspfPrefixCount = selectedOspfComponent ? new Set(ospfState.advertisements.filter((advertisement) => selectedOspfComponent.includes(advertisement.routerId)).map((advertisement) => advertisement.prefix)).size : 0;
  const selectedNextHopOptions = selectedNode?.kind === 'router' ? nextHopOptionsForBuilderRouter(sceneGraph, sceneAddressing, selectedNode.id) : [];
  const effectiveStaticNextHop = selectedNextHopOptions.some((option) => option.address === staticNextHop) ? staticNextHop : (selectedNextHopOptions[0]?.address ?? '');
  const destinationInterface = interfacesForBuilderNode(sceneAddressing, sceneDestinationId)[0];
  const destinationPrefix = destinationInterface ? (sceneAddressing.segments[destinationInterface.linkId]?.cidr ?? '0.0.0.0/0') : '0.0.0.0/0';
  const activeLinks = new Set(route.linkIds);
  const forwardingLinks = new Set(forwardingTrace.hops.flatMap((hop) => hop.linkId ? [hop.linkId] : []));
  const selectedProbe = sceneProbeHistory.find((probe) => probe.id === selectedProbeId) ?? sceneProbeHistory[0] ?? null;
  const selectedAttempt = selectedProbe?.attempts[Math.min(selectedProbeAttempt, Math.max(0, selectedProbe.attempts.length - 1))] ?? null;
  const probeLinks = new Set(selectedAttempt?.requestLinkIds ?? []);
  const selectedEthernetLink = sceneEthernet.links.find((link) => link.id === sceneSelectedEthernetLinkId) ?? sceneEthernet.links[0];
  const ethernetFlowLinks = new Set(sceneEthernetFlow?.segments.flatMap((segment) => segment.linkIds) ?? []);
  const ethernetSourceDevice = sceneEthernet.devices.find((device) => device.id === sceneEthernetSourceId);
  const ethernetSourceVlan = ethernetSourceDevice?.interfaces[0]?.vlanId ?? sceneEthernet.vlans[0]?.id ?? 1;
  const stpState = useMemo(() => builderStpState(sceneEthernet, ethernetSourceVlan), [sceneEthernet, ethernetSourceVlan]);
  const stpBlockedLinks = new Set(stpState.blockedLinkIds);
  const selectedRouterAclRules = selectedNode?.kind === 'router' ? sceneAcl.rules.filter((rule) => rule.routerId === selectedNode.id).sort((a,b)=>a.order-b.order||a.id.localeCompare(b.id)) : [];
  const displayedWorkbenchInput = historicalTimelineSnapshot ? { ...historicalTimelineSnapshot.state, events: builderTimelineJournalThroughSequence(workbenchEvents, historicalTimelineSnapshot.sequence) } : liveWorkbenchInput;
  const workbenchOptions = useMemo(() => stressLabel ? [] : builderWorkbenchDeviceOptions(displayedWorkbenchInput.graph, displayedWorkbenchInput.ethernet), [displayedWorkbenchInput.graph, displayedWorkbenchInput.ethernet, stressLabel]);
  const effectiveWorkbenchDevice = workbenchOptions.some((option) => option.plane === workbenchDevice.plane && option.id === workbenchDevice.id)
    ? workbenchDevice
    : ({ plane: workbenchOptions[0]?.plane ?? 'routed', id: workbenchOptions[0]?.id ?? sceneSelectedNodeId } as BuilderDeviceRef);
  const workbenchSnapshot = useMemo(() => stressLabel ? null : buildBuilderDeviceWorkbench(displayedWorkbenchInput, effectiveWorkbenchDevice), [stressLabel, displayedWorkbenchInput, effectiveWorkbenchDevice.plane, effectiveWorkbenchDevice.id]);
  const workbenchTimelineDiff = useMemo(() => historicalTimelineSnapshot ? diffBuilderTimelineDevice(timeline, workbenchEvents, historicalTimelineSnapshot.sequence, effectiveWorkbenchDevice) : null, [historicalTimelineSnapshot, timeline, workbenchEvents, effectiveWorkbenchDevice.plane, effectiveWorkbenchDevice.id]);
  const displayedMessage = historicalTimelineSnapshot ? `HISTORY #${String(historicalTimelineSnapshot.sequence).padStart(3,'0')} · ${historicalTimelineSnapshot.summary} · ${historicalTimelineSnapshot.detail}` : message;
'''
text = text[:start] + new_block + text[end:]

# Render the existing JSX under a scene-state scope. This is the core anti-duplication mechanism.
text = replace_once(
    text,
    '  return (\n    <motion.section className="builder-workspace" data-stress-label={stressLabel} data-node-count={graph.nodes.length} data-link-count={graph.links.length}',
    "  const renderWorkspace = ({ graph, addressing, routing, ipv6, ipv6ControlState, ipv6LifecycleState, ipv6RoutingDepth, ethernet, ethernetFlow, arpCache, arpResolutions, acl, nat, natSessions, dhcp, dhcpLeases, dhcpSequence, probeHistory, sourceId, destinationId, layout, selectedNodeId, selectedLinkId, ethernetSourceId, ethernetDestinationId, selectedEthernetLinkId }: typeof sceneRenderState) => (\n    <motion.section className={`builder-workspace ${isHistorical ? 'builder-history-mode' : ''}`} data-builder-history-sequence={historicalTimelineSnapshot?.sequence ?? 'live'} data-stress-label={stressLabel} data-node-count={graph.nodes.length} data-link-count={graph.links.length}",
    'render scene scope',
)
text = replace_once(
    text,
    '          <div className="builder-stage-meta"><div><span>GRAPH PATH</span>',
    '          <div className="builder-stage-meta">{isHistorical&&<div className="builder-history-meta"><span>TIME MACHINE</span><strong>HISTORY #{String(historicalTimelineSnapshot?.sequence??0).padStart(3,\'0\')} · READ ONLY</strong></div>}<div><span>GRAPH PATH</span>',
    'history stage marker',
)
text = replace_once(text, 'className={`builder-node ${node.kind} ${onRoute ? \'on-route\' : \'\'} ${selectedNode?.id === node.id ? \'selected\' : \'\'}`} drag dragMomentum={false}', 'className={`builder-node ${node.kind} ${onRoute ? \'on-route\' : \'\'} ${selectedNode?.id === node.id ? \'selected\' : \'\'}`} drag={!isHistorical} dragMomentum={false}', 'disable historical drag')
text = replace_once(text, 'onDragEnd={(_, info) => onNodeDragEnd(node.id, info.offset.x, info.offset.y)}', 'onDragEnd={(_, info) => { if (!isHistorical) onNodeDragEnd(node.id, info.offset.x, info.offset.y); }}', 'guard historical drag end')
text = replace_once(text, '<button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => deleteNode(node.id)} aria-label={`Delete ${node.label}`}>×</button>', '<button type="button" disabled={isHistorical} onPointerDown={(event) => event.stopPropagation()} onClick={() => deleteNode(node.id)} aria-label={`Delete ${node.label}`}>×</button>', 'disable historical node delete')
text = replace_once(text, '<div className="builder-message">{message}</div>', '<div className="builder-message">{displayedMessage}</div>', 'historical message')
text = replace_once(
    text,
    "          {!stressLabel&&workbenchSnapshot&&<BuilderDeviceWorkbench snapshot={workbenchSnapshot} options={workbenchOptions} historicalSequence={historicalTimelineSnapshot?.sequence??null} diff={workbenchTimelineDiff} onSelect={(ref)=>{setWorkbenchDevice(ref);if(ref.plane==='routed'&&timelineCursor==null)setSelectedNodeId(ref.id);}}/>}\n          <section>",
    "          {!stressLabel&&workbenchSnapshot&&<BuilderDeviceWorkbench snapshot={workbenchSnapshot} options={workbenchOptions} historicalSequence={historicalTimelineSnapshot?.sequence??null} diff={workbenchTimelineDiff} onSelect={(ref)=>{setWorkbenchDevice(ref);if(ref.plane==='routed')setSelectedNodeId(ref.id);}}/>}\n          {!stressLabel&&isHistorical&&<div className=\"builder-history-lock\"><strong>HISTORICAL SCENE · READ ONLY</strong><span>Canvas, forwarding overlays, LAN/STP/ARP state, protocol panels, route tables, NAT/DHCP state, and the Device Workbench are all projected from event #{String(historicalTimelineSnapshot?.sequence??0).padStart(3,'0')}. Return to LIVE to edit.</span></div>}\n          <fieldset className=\"builder-live-controls\" disabled={isHistorical}>\n          <section>",
    'history authoring lock',
)
text = replace_once(
    text,
    '          <section className="reset-section"><div className="button-row"><button type="button" onClick={resetTopology}>RESET TOPOLOGY</button><button type="button" onClick={resetLayout}>RESET LAYOUT</button></div></section>\n        </aside>',
    '          <section className="reset-section"><div className="button-row"><button type="button" onClick={resetTopology}>RESET TOPOLOGY</button><button type="button" onClick={resetLayout}>RESET LAYOUT</button></div></section>\n          </fieldset>\n        </aside>',
    'close history fieldset',
)
text = replace_once(
    text,
    '      </div>\n    </motion.section>\n  );\n}',
    '      </div>\n    </motion.section>\n  );\n  return renderWorkspace(sceneRenderState);\n}',
    'return scene projection',
)
write(path, text)

# 3) Visual history boundary and form locking.
path = 'src/NetworkBuilder.css'
text = read(path)
append = r'''
.builder-history-mode .builder-stage{border-color:rgba(242,200,121,.3);box-shadow:inset 0 0 0 1px rgba(242,200,121,.035)}
.builder-history-meta{min-width:max-content}.builder-history-meta span{color:#a98d5e!important}.builder-history-meta strong{color:#f2c879!important}
.builder-history-lock{display:grid;gap:4px;padding:10px 12px;border:1px solid rgba(242,200,121,.26);border-radius:7px;background:rgba(242,200,121,.055)}.builder-history-lock strong{color:#f2c879;font-size:.58rem;letter-spacing:.08em}.builder-history-lock span{color:#84765e;font-size:.48rem;line-height:1.45;letter-spacing:.035em}
.builder-live-controls{display:grid;gap:10px;min-inline-size:0;margin:0;padding:0;border:0}.builder-live-controls:disabled button,.builder-live-controls:disabled input,.builder-live-controls:disabled select,.builder-live-controls:disabled .file-button{cursor:not-allowed;opacity:.52}.builder-history-mode .builder-node{cursor:default}.builder-history-mode .builder-node:active{cursor:default}
'''
if '.builder-history-lock{' not in text:
    text += append
write(path, text)

# 4) Time-machine copy now reflects the synchronized scene truth boundary.
path = 'src/BuilderTimeMachine.tsx'
text = read(path)
text = replace_once(
    text,
    'DETERMINISTIC EVENT CLOCK · WORKBENCH HISTORY ONLY IN THIS FOUNDATION SLICE · CANVAS + AUTHORING STAY LIVE · ANY REAL ACTION RETURNS TO LIVE.',
    'DETERMINISTIC EVENT CLOCK · THE ENTIRE BUILDER SCENE IS PROJECTED FROM THIS SNAPSHOT · AUTHORING IS LOCKED UNTIL LIVE.',
    'time machine boundary copy',
)
write(path, text)

# 5) Extend the existing contract with scene-only snapshots and UI wiring assertions.
path = 'scripts/builder-timeline-contract-check.mjs'
text = read(path)
text = replace_once(text, "import assert from 'node:assert/strict';\n", "import assert from 'node:assert/strict';\nimport { readFileSync } from 'node:fs';\n", 'contract fs import')
text = replace_once(text, "import { createBuilderIpv6ControlState } from '../src/builder/ipv6-control-plane.ts';\n", "import { createBuilderIpv6ControlState } from '../src/builder/ipv6-control-plane.ts';\nimport { createBuilderIpv6LifecycleState } from '../src/builder/ipv6-lifecycle.ts';\n", 'contract lifecycle import')
text = replace_once(text, "import { createDefaultBuilderIpv6Config } from '../src/builder/ipv6.ts';\n", "import { createDefaultBuilderIpv6Config } from '../src/builder/ipv6.ts';\nimport { createDefaultBuilderLinkProfiles } from '../src/builder/link-characteristics.ts';\n", 'contract link profile import')
text = replace_once(text, "import { cloneBuilderGraph, defaultBuilderGraph } from '../src/builder/model.ts';\n", "import { cloneBuilderGraph, cloneBuilderLayout, defaultBuilderGraph, defaultBuilderLayout } from '../src/builder/model.ts';\n", 'contract layout import')
old_base = "const base={graph,addressing,routing,ipv6,ipv6ControlState:createBuilderIpv6ControlState(),ipv6RoutingDepth:createDefaultBuilderIpv6RoutingDepthState(graph),ethernet,ethernetFlow:null,arpCache:clearBuilderArpCache(),arpResolutions:[],acl:createDefaultBuilderAclConfig(),nat:createDefaultBuilderNatConfig(graph),natSessions:[],dhcp:createDefaultBuilderDhcpConfig(ethernet),dhcpLeases:[],dhcpSequence:1,probeHistory:[],sourceId:'client',destinationId:'app'};"
new_base = "const base={graph,addressing,routing,ipv6,ipv6ControlState:createBuilderIpv6ControlState(),ipv6LifecycleState:createBuilderIpv6LifecycleState(),ipv6RoutingDepth:createDefaultBuilderIpv6RoutingDepthState(graph),ethernet,ethernetFlow:null,arpCache:clearBuilderArpCache(),arpResolutions:[],acl:createDefaultBuilderAclConfig(),nat:createDefaultBuilderNatConfig(graph),natSessions:[],dhcp:createDefaultBuilderDhcpConfig(ethernet),dhcpLeases:[],dhcpSequence:1,probeHistory:[],sourceId:'client',destinationId:'app',layout:cloneBuilderLayout(defaultBuilderLayout),linkProfiles:createDefaultBuilderLinkProfiles(graph)};"
text = replace_once(text, old_base, new_base, 'contract base scene state')
text = replace_once(
    text,
    "const failed={...base,graph:failedGraph};\n",
    "const failedLayout={...base.layout,edge:{x:base.layout.edge.x+3,y:base.layout.edge.y+2}};\nconst failedProfiles={...base.linkProfiles,'edge-r1':{...base.linkProfiles['edge-r1'],latencyMs:base.linkProfiles['edge-r1'].latencyMs+7}};\nconst failed={...base,graph:failedGraph,layout:failedLayout,linkProfiles:failedProfiles};\n",
    'contract changed scene state',
)
text = replace_once(
    text,
    "assert.equal(timeline.snapshots.length,2);assert.equal(timeline.snapshots[1].atMs,1000);assert.equal(timeline.snapshots[0].state.graph.links.find((link)=>link.id==='edge-r1').failed,false,'captured state must be immutable after later changes');assert.equal(timeline.snapshots[1].state.graph.links.find((link)=>link.id==='edge-r1').failed,true);\n",
    "assert.equal(timeline.snapshots.length,2);assert.equal(timeline.snapshots[1].atMs,1000);assert.equal(timeline.snapshots[0].state.graph.links.find((link)=>link.id==='edge-r1').failed,false,'captured state must be immutable after later changes');assert.equal(timeline.snapshots[1].state.graph.links.find((link)=>link.id==='edge-r1').failed,true);assert.notEqual(timeline.snapshots[0].state.layout.edge.x,timeline.snapshots[1].state.layout.edge.x,'historical layout must restore deleted/moved device placement');assert.notEqual(timeline.snapshots[0].state.linkProfiles['edge-r1'].latencyMs,timeline.snapshots[1].state.linkProfiles['edge-r1'].latencyMs,'historical link characteristics must stay snapshot-local');\n",
    'contract immutable scene assertions',
)
text = replace_once(
    text,
    "console.log('Builder timeline contract passed: immutable event snapshots, deterministic logical time, historical workbench inspection, future-event isolation, and per-device before/after diffs.');\n",
    "const builderSource=readFileSync(new URL('../src/NetworkBuilder.tsx',import.meta.url),'utf8');assert.match(builderSource,/const sceneState = historicalTimelineSnapshot\\?\\.state \\?\\? liveTimelineInput/);assert.match(builderSource,/const renderWorkspace = \\(\\{ graph, addressing, routing/);assert.match(builderSource,/disabled=\\{isHistorical\\}/);assert.match(builderSource,/drag=\\{!isHistorical\\}/);assert.match(builderSource,/return renderWorkspace\\(sceneRenderState\\)/);\nconsole.log('Builder timeline contract passed: immutable event snapshots, deterministic logical time, synchronized historical scene projection, read-only authoring lock, historical workbench isolation, and per-device before/after diffs.');\n",
    'contract scene wiring assertions',
)
write(path, text)

# 6) Documentation: the second Track A slice is now synchronized scene projection.
path = 'docs/TRACKA.md'
text = read(path)
old = "## Truth boundary\n\nThis first slice does **not** claim that the entire Builder canvas has been rewound. The topology canvas and authoring controls remain the live system while the Device Workbench is in historical inspection mode. The UI states that boundary directly.\n\nThe next Track A slice should promote remaining control-plane transitions and forwarding decisions into explicit canonical events, then let the main Builder scene render from the same selected historical snapshot so the entire workspace—not only the workbench—becomes a synchronized time projection.\n"
new = "## Synchronized scene projection\n\nThe second Track A slice promotes the selected timeline snapshot from a Device Workbench-only projection to the render source for the entire Network Builder scene. The routed topology canvas, failed/restored links, weighted route, L3 forwarding overlay, policy result, probe snapshot, Ethernet/VLAN/STP/ARP view, route tables, OSPF/OSPFv3/BGP panels, ACL/NAT/DHCP state, IPv6 state, and Device Workbench now consume one selected immutable scene state.\n\nLayout and link-characteristic truth are captured alongside the workbench model so a historical device can reappear at its historical position and a historical link can recover its prior physical characteristics. UI selection remains a camera concern: if the currently selected object did not exist at that event, inspection falls back deterministically to an object that did.\n\nHistorical mode is read-only across the Builder. Authoring controls are disabled, node dragging/deletion is disabled, and the scene is visually marked as historical. Returning to `LIVE` restores the mutable current state; scrubbing never writes a snapshot back into live configuration.\n\nThe next Track A depth is event granularity: promote control-plane transitions, forwarding decisions, resolution changes, and flow outcomes into explicit canonical events rather than only snapshotting after the higher-level Builder actions that currently generate the session journal.\n"
text = replace_once(text, old, new, 'Track A documentation')
write(path, text)

path = 'docs/ROADMAP.md'
text = read(path)
needle = "- [x] first slice: the device workbench can inspect historical CONFIG / STATE / EVENTS and deterministic per-device before/after diffs without mutating live truth\n"
replacement = needle + "- [x] second slice: the entire Builder scene renders from the selected immutable historical snapshot, including topology/link failures, route/forwarding overlays, LAN/STP/ARP, protocol panels, NAT/DHCP/IPv6 state, layout, and link characteristics; authoring is locked until LIVE\n"
text = replace_once(text, needle, replacement, 'Track A roadmap checkbox')
write(path, text)

print('Track A synchronized-scene patch applied.')
