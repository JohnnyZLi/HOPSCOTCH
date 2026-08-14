from pathlib import Path

def replace_once(path, old, new):
    p=Path(path); s=p.read_text(encoding='utf-8'); c=s.count(old)
    if c != 1: raise SystemExit(f'{path}: expected 1 anchor, found {c}: {old[:100]!r}')
    p.write_text(s.replace(old,new,1),encoding='utf-8')

def replace_all(path, old, new, minimum=1):
    p=Path(path); s=p.read_text(encoding='utf-8'); c=s.count(old)
    if c < minimum: raise SystemExit(f'{path}: expected >= {minimum}, found {c}: {old[:100]!r}')
    p.write_text(s.replace(old,new),encoding='utf-8')

# Route overlay hook: advanced OSPFv3 can supply dynamic routes while physical forwarding still uses the real graph.
replace_once('src/builder/ipv6.ts',
"export interface BuilderIpv6NextHopOption {",
"export type BuilderIpv6RouteOverlay = Record<string, BuilderIpv6RouteTableEntry[]>;\n\nexport interface BuilderIpv6NextHopOption {")
replace_once('src/builder/ipv6.ts',
"export function routeTableForBuilderIpv6Router(graph: BuilderGraph, config: BuilderIpv6Config, routerId: string): BuilderIpv6RouteTableEntry[] {",
"export function routeTableForBuilderIpv6Router(graph: BuilderGraph, config: BuilderIpv6Config, routerId: string, routeOverlay?: BuilderIpv6RouteOverlay): BuilderIpv6RouteTableEntry[] {")
replace_once('src/builder/ipv6.ts',
"  const ospfv3 = ospfv3RoutesForRouter(graph, config, routerId);\n  return [...connected, ...statics, ...ospfv3]",
"  const ospfv3 = routeOverlay?.[routerId] ?? ospfv3RoutesForRouter(graph, config, routerId);\n  return [...connected, ...statics, ...ospfv3]")
replace_once('src/builder/ipv6.ts',
"export function traceBuilderIpv6Forwarding(graph: BuilderGraph, config: BuilderIpv6Config, sourceNodeId: string, destinationNodeId: string): BuilderIpv6ForwardingTrace {",
"export function traceBuilderIpv6Forwarding(graph: BuilderGraph, config: BuilderIpv6Config, sourceNodeId: string, destinationNodeId: string, routeOverlay?: BuilderIpv6RouteOverlay): BuilderIpv6ForwardingTrace {")
replace_once('src/builder/ipv6.ts',
"    const selected = selectBuilderIpv6Route(routeTableForBuilderIpv6Router(graph, config, currentNodeId), destinationAddress);",
"    const selected = selectBuilderIpv6Route(routeTableForBuilderIpv6Router(graph, config, currentNodeId, routeOverlay), destinationAddress);")

# IPv6 probes use the timed/area-aware route overlay and post-process ICMPv6 policy per direction.
replace_once('src/builder/ipv6-probes.ts',
"import { primaryBuilderIpv6Address, traceBuilderIpv6Forwarding, type BuilderIpv6Config, type BuilderIpv6ForwardingTrace } from './ipv6.ts';\n",
"import { primaryBuilderIpv6Address, traceBuilderIpv6Forwarding, type BuilderIpv6Config, type BuilderIpv6ForwardingTrace, type BuilderIpv6RouteOverlay } from './ipv6.ts';\nimport { builderOspfv3DepthRouteOverlay, evaluateBuilderIpv6Policy, reconcileBuilderIpv6RoutingDepthState, type BuilderIpv6IcmpType, type BuilderIpv6RoutingDepthState } from './ipv6-routing-depth.ts';\n")
replace_once('src/builder/ipv6-probes.ts',
"function runPing(graph: BuilderGraph, config: BuilderIpv6Config, sourceNodeId: string, destinationNodeId: string, sequence: number, profiles: BuilderLinkProfiles, natSessions: BuilderNatSessionTable, currentControl: BuilderIpv6ControlState, requestedPacketBytes: number): BuilderIpv6ProbeResult {",
"function runPing(graph: BuilderGraph, config: BuilderIpv6Config, sourceNodeId: string, destinationNodeId: string, sequence: number, profiles: BuilderLinkProfiles, natSessions: BuilderNatSessionTable, currentControl: BuilderIpv6ControlState, requestedPacketBytes: number, routeOverlay?: BuilderIpv6RouteOverlay): BuilderIpv6ProbeResult {")
replace_once('src/builder/ipv6-probes.ts',
"  const request = traceBuilderIpv6Forwarding(graph, config, sourceNodeId, destinationNodeId);",
"  const request = traceBuilderIpv6Forwarding(graph, config, sourceNodeId, destinationNodeId, routeOverlay);")
replace_once('src/builder/ipv6-probes.ts',
"        reply = traceBuilderIpv6Forwarding(graph, config, destinationNodeId, sourceNodeId);",
"        reply = traceBuilderIpv6Forwarding(graph, config, destinationNodeId, sourceNodeId, routeOverlay);")
replace_once('src/builder/ipv6-probes.ts',
"function runTraceroute(graph: BuilderGraph, config: BuilderIpv6Config, sourceNodeId: string, destinationNodeId: string, sequence: number, profiles: BuilderLinkProfiles, natSessions: BuilderNatSessionTable, currentControl: BuilderIpv6ControlState, requestedPacketBytes: number): BuilderIpv6ProbeResult {",
"function runTraceroute(graph: BuilderGraph, config: BuilderIpv6Config, sourceNodeId: string, destinationNodeId: string, sequence: number, profiles: BuilderLinkProfiles, natSessions: BuilderNatSessionTable, currentControl: BuilderIpv6ControlState, requestedPacketBytes: number, routeOverlay?: BuilderIpv6RouteOverlay): BuilderIpv6ProbeResult {")
replace_once('src/builder/ipv6-probes.ts',
"  const forward = traceBuilderIpv6Forwarding(graph, config, sourceNodeId, destinationNodeId);",
"  const forward = traceBuilderIpv6Forwarding(graph, config, sourceNodeId, destinationNodeId, routeOverlay);")
replace_once('src/builder/ipv6-probes.ts',
"    const response = traceBuilderIpv6Forwarding(graph, config, nodeId, sourceNodeId);",
"    const response = traceBuilderIpv6Forwarding(graph, config, nodeId, sourceNodeId, routeOverlay);")
replace_once('src/builder/ipv6-probes.ts',
"  const reply = traceBuilderIpv6Forwarding(graph, config, destinationNodeId, sourceNodeId);",
"  const reply = traceBuilderIpv6Forwarding(graph, config, destinationNodeId, sourceNodeId, routeOverlay);")

p=Path('src/builder/ipv6-probes.ts'); s=p.read_text(encoding='utf-8')
anchor="export function runBuilderIpv6Probe(graph: BuilderGraph, config: BuilderIpv6Config, kind: 'ping' | 'traceroute', sourceNodeId: string, destinationNodeId: string, sequence = 1, profiles: BuilderLinkProfiles = createDefaultBuilderLinkProfiles(graph), natSessions: BuilderNatSessionTable = [], controlState: BuilderIpv6ControlState = getBuilderIpv6SessionState(), requestedPacketBytes = getBuilderIpv6ProbePacketBytes()): BuilderIpv6ProbeResult {\n  return kind === 'ping'\n    ? runPing(graph, config, sourceNodeId, destinationNodeId, sequence, profiles, natSessions, controlState, requestedPacketBytes)\n    : runTraceroute(graph, config, sourceNodeId, destinationNodeId, sequence, profiles, natSessions, controlState, requestedPacketBytes);\n}"
replacement=r'''function applyPolicyToProbe(graph: BuilderGraph, config: BuilderIpv6Config, result: BuilderIpv6ProbeResult, depth: BuilderIpv6RoutingDepthState): BuilderIpv6ProbeResult {
  const sourceAddress = result.sourceAddress;
  const destinationAddress = result.destinationAddress;
  if (!sourceAddress || !destinationAddress) return result;
  let denied = false;
  const attempts = result.attempts.map((attempt) => {
    let denyDetail: string | null = null;
    for (const nodeId of attempt.requestNodeIds) {
      if (graph.nodes.find((node) => node.id === nodeId)?.kind !== 'router') continue;
      const decision = evaluateBuilderIpv6Policy(depth.policy, nodeId, sourceAddress, destinationAddress, 'echo-request');
      if (decision.action === 'deny') { denyDetail = `${nodeId.toUpperCase()} denied ICMPv6 Echo Request · ${decision.detail}`; break; }
    }
    if (!denyDetail && attempt.responseNodeIds.length) {
      const responseType: BuilderIpv6IcmpType = attempt.status === 'time-exceeded' ? 'time-exceeded' : result.summary.includes('PACKET TOO BIG') ? 'packet-too-big' : 'echo-reply';
      const responseSource = responseType === 'echo-reply' ? destinationAddress : (attempt.responderNodeId ? primaryBuilderIpv6Address(config.addressing, attempt.responderNodeId) : destinationAddress) ?? destinationAddress;
      for (const nodeId of attempt.responseNodeIds) {
        if (graph.nodes.find((node) => node.id === nodeId)?.kind !== 'router') continue;
        const decision = evaluateBuilderIpv6Policy(depth.policy, nodeId, responseSource, sourceAddress, responseType);
        if (decision.action === 'deny') { denyDetail = `${nodeId.toUpperCase()} denied ICMPv6 ${responseType.replaceAll('-', ' ').toUpperCase()} · ${decision.detail}`; break; }
      }
    }
    if (!denyDetail) return attempt;
    denied = true;
    return { ...attempt, status: attempt.status === 'time-exceeded' || attempt.status === 'echo-reply' ? 'timeout' as const : 'unreachable' as const, detail: `IPV6 POLICY · ${denyDetail}` };
  });
  return denied ? { ...result, success: false, attempts, summary: 'IPV6 POLICY DENY · routing/ND may be healthy while ICMPv6 policy independently blocks the selected direction or control reply.', snapshotNote: `${result.snapshotNote} IPv6 ACL/firewall policy is evaluated separately with first-match semantics.` } : result;
}

export function runBuilderIpv6Probe(graph: BuilderGraph, config: BuilderIpv6Config, kind: 'ping' | 'traceroute', sourceNodeId: string, destinationNodeId: string, sequence = 1, profiles: BuilderLinkProfiles = createDefaultBuilderLinkProfiles(graph), natSessions: BuilderNatSessionTable = [], controlState: BuilderIpv6ControlState = getBuilderIpv6SessionState(), requestedPacketBytes = getBuilderIpv6ProbePacketBytes(), routingDepth?: BuilderIpv6RoutingDepthState): BuilderIpv6ProbeResult {
  const depth = routingDepth ? reconcileBuilderIpv6RoutingDepthState(graph, routingDepth) : null;
  const routeOverlay = depth ? builderOspfv3DepthRouteOverlay(graph, config, depth) : undefined;
  const result = kind === 'ping'
    ? runPing(graph, config, sourceNodeId, destinationNodeId, sequence, profiles, natSessions, controlState, requestedPacketBytes, routeOverlay)
    : runTraceroute(graph, config, sourceNodeId, destinationNodeId, sequence, profiles, natSessions, controlState, requestedPacketBytes, routeOverlay);
  return depth ? applyPolicyToProbe(graph, config, result, depth) : result;
}'''
if s.count(anchor)!=1: raise SystemExit(f'ipv6-probes export anchor found {s.count(anchor)}')
p.write_text(s.replace(anchor,replacement,1),encoding='utf-8')

# Builder owns session-only advanced OSPFv3/policy state and feeds probes/UI.
replace_once('src/NetworkBuilder.tsx',
"import { createBuilderIpv6LifecycleState, materializeBuilderIpv6RuntimeConfig, reconcileBuilderIpv6LifecycleWithControl, type BuilderIpv6LifecycleState } from './builder/ipv6-lifecycle.ts';\n",
"import { createBuilderIpv6LifecycleState, materializeBuilderIpv6RuntimeConfig, reconcileBuilderIpv6LifecycleWithControl, type BuilderIpv6LifecycleState } from './builder/ipv6-lifecycle.ts';\nimport { createDefaultBuilderIpv6RoutingDepthState, reconcileBuilderIpv6RoutingDepthState, type BuilderIpv6RoutingDepthState } from './builder/ipv6-routing-depth.ts';\n")
replace_once('src/NetworkBuilder.tsx',
"  const [ipv6LifecycleState, setIpv6LifecycleState] = useState<BuilderIpv6LifecycleState>(() => createBuilderIpv6LifecycleState());\n  const [ipv6ProbePacketBytes, setIpv6ProbePacketBytes] = useState(1280);",
"  const [ipv6LifecycleState, setIpv6LifecycleState] = useState<BuilderIpv6LifecycleState>(() => createBuilderIpv6LifecycleState());\n  const [ipv6RoutingDepth, setIpv6RoutingDepth] = useState<BuilderIpv6RoutingDepthState>(() => createDefaultBuilderIpv6RoutingDepthState(scenario.graph));\n  const [ipv6ProbePacketBytes, setIpv6ProbePacketBytes] = useState(1280);")
replace_once('src/NetworkBuilder.tsx',
"      ? runBuilderIpv6Probe(graph, materializeBuilderIpv6RuntimeConfig(ipv6, ipv6LifecycleState), kind, sourceId, destinationId, probeHistory.length + 1, linkProfiles, natSessions, ipv6ControlState, ipv6ProbePacketBytes)",
"      ? runBuilderIpv6Probe(graph, materializeBuilderIpv6RuntimeConfig(ipv6, ipv6LifecycleState), kind, sourceId, destinationId, probeHistory.length + 1, linkProfiles, natSessions, ipv6ControlState, ipv6ProbePacketBytes, reconcileBuilderIpv6RoutingDepthState(graph, ipv6RoutingDepth))")
replace_all('src/NetworkBuilder.tsx',
"setIpv6ControlState(createBuilderIpv6ControlState()); setIpv6LifecycleState(createBuilderIpv6LifecycleState());",
"setIpv6ControlState(createBuilderIpv6ControlState()); setIpv6LifecycleState(createBuilderIpv6LifecycleState()); setIpv6RoutingDepth(createDefaultBuilderIpv6RoutingDepthState(",
minimum=1)
# The broad replacement above opens a function call; repair each known reset statement by line grammar.
p=Path('src/NetworkBuilder.tsx'); s=p.read_text(encoding='utf-8')
s=s.replace("setIpv6RoutingDepth(createDefaultBuilderIpv6RoutingDepthState( setProbeHistory", "setIpv6RoutingDepth(createDefaultBuilderIpv6RoutingDepthState(nextGraph)); setProbeHistory")
s=s.replace("setIpv6RoutingDepth(createDefaultBuilderIpv6RoutingDepthState( setNatSessions", "setIpv6RoutingDepth(createDefaultBuilderIpv6RoutingDepthState(next.graph)); setNatSessions")
s=s.replace("setIpv6RoutingDepth(createDefaultBuilderIpv6RoutingDepthState( setMessage", "setIpv6RoutingDepth(createDefaultBuilderIpv6RoutingDepthState(defaultBuilderGraph)); setMessage")
# Fallback repairs for reset contexts using current graph if exact names differ.
s=s.replace("setIpv6RoutingDepth(createDefaultBuilderIpv6RoutingDepthState( set", "setIpv6RoutingDepth(createDefaultBuilderIpv6RoutingDepthState(graph)); set")
p.write_text(s,encoding='utf-8')
replace_once('src/NetworkBuilder.tsx',
"<BuilderIpv6Panel graph={graph} ipv4={addressing} ipv6={ipv6} selectedNodeId={selectedNodeId} selectedLinkId={selectedLinkId} sourceId={sourceId} destinationId={destinationId} controlState={ipv6ControlState} onControlStateChange={setIpv6ControlState} lifecycleState={ipv6LifecycleState} onLifecycleStateChange={setIpv6LifecycleState} probePacketBytes={ipv6ProbePacketBytes} onProbePacketBytesChange={setIpv6ProbePacketBytes} onChange={setIpv6} onMessage={setMessage}/>",
"<BuilderIpv6Panel graph={graph} ipv4={addressing} ipv6={ipv6} selectedNodeId={selectedNodeId} selectedLinkId={selectedLinkId} sourceId={sourceId} destinationId={destinationId} controlState={ipv6ControlState} onControlStateChange={setIpv6ControlState} lifecycleState={ipv6LifecycleState} onLifecycleStateChange={setIpv6LifecycleState} routingDepth={ipv6RoutingDepth} onRoutingDepthChange={setIpv6RoutingDepth} probePacketBytes={ipv6ProbePacketBytes} onProbePacketBytesChange={setIpv6ProbePacketBytes} onChange={setIpv6} onMessage={setMessage}/>")

# Panel uses area/timed OSPFv3 overlay for displayed route table and trace, plus exposes policy UI.
replace_once('src/BuilderIpv6Panel.tsx',
"import { BuilderIpv6LifecyclePanel } from './BuilderIpv6LifecyclePanel.tsx';\n",
"import { BuilderIpv6LifecyclePanel } from './BuilderIpv6LifecyclePanel.tsx';\nimport { builderOspfv3DepthRouteOverlay, type BuilderIpv6RoutingDepthState } from './builder/ipv6-routing-depth.ts';\nimport { BuilderIpv6RoutingDepthPanel } from './BuilderIpv6RoutingDepthPanel.tsx';\n")
replace_once('src/BuilderIpv6Panel.tsx',
"export function BuilderIpv6Panel({ graph, ipv4, ipv6, selectedNodeId, selectedLinkId, sourceId, destinationId, controlState, onControlStateChange, lifecycleState, onLifecycleStateChange, probePacketBytes, onProbePacketBytesChange, onChange, onMessage }: {",
"export function BuilderIpv6Panel({ graph, ipv4, ipv6, selectedNodeId, selectedLinkId, sourceId, destinationId, controlState, onControlStateChange, lifecycleState, onLifecycleStateChange, routingDepth, onRoutingDepthChange, probePacketBytes, onProbePacketBytesChange, onChange, onMessage }: {")
replace_once('src/BuilderIpv6Panel.tsx',
"  onLifecycleStateChange: (next: BuilderIpv6LifecycleState) => void;\n  probePacketBytes: number;",
"  onLifecycleStateChange: (next: BuilderIpv6LifecycleState) => void;\n  routingDepth: BuilderIpv6RoutingDepthState;\n  onRoutingDepthChange: (next: BuilderIpv6RoutingDepthState) => void;\n  probePacketBytes: number;")
replace_once('src/BuilderIpv6Panel.tsx',
"  const interfaces = selectedNode ? interfacesForBuilderNodeIpv6(ipv6.addressing, selectedNode.id) : [];\n  const routeTable = selectedNode?.kind === 'router' ? routeTableForBuilderIpv6Router(graph, ipv6, selectedNode.id) : [];",
"  const interfaces = selectedNode ? interfacesForBuilderNodeIpv6(ipv6.addressing, selectedNode.id) : [];\n  const ospfv3Overlay = useMemo(() => builderOspfv3DepthRouteOverlay(graph, ipv6, routingDepth), [graph, ipv6, routingDepth]);\n  const routeTable = selectedNode?.kind === 'router' ? routeTableForBuilderIpv6Router(graph, ipv6, selectedNode.id, ospfv3Overlay) : [];")
replace_once('src/BuilderIpv6Panel.tsx',
"  const trace = useMemo(() => traceBuilderIpv6Forwarding(graph, runtimeIpv6, sourceId, destinationId), [graph, runtimeIpv6, sourceId, destinationId]);",
"  const trace = useMemo(() => traceBuilderIpv6Forwarding(graph, runtimeIpv6, sourceId, destinationId, ospfv3Overlay), [graph, runtimeIpv6, sourceId, destinationId, ospfv3Overlay]);")
replace_once('src/BuilderIpv6Panel.tsx',
"    <div className=\"control-title\"><span>OSPFV3 · AREA 0</span><strong>{ospfv3.enabledRouterIds.length===0?'OFF':`${ospfv3.enabledRouterIds.length} RTR · ${ospfv3.fullAdjacencyCount} FULL`}</strong></div>",
"    <div className=\"control-title\"><span>OSPFV3 · CONFIG</span><strong>{ospfv3.enabledRouterIds.length===0?'OFF':`${ospfv3.enabledRouterIds.length} RTR · ${ospfv3.fullAdjacencyCount} PHYSICAL FULL`}</strong></div>")
replace_all('src/BuilderIpv6Panel.tsx', " · AREA 0 · COST ", " · AREA {routingDepth.linkAreas[entry.linkId] ?? 0} · COST ", minimum=1)
replace_once('src/BuilderIpv6Panel.tsx',
"    {selectedNode?.kind === 'router' && <><div className=\"control-title\"><span>IPV6 ROUTE TABLE</span>",
"    <BuilderIpv6RoutingDepthPanel graph={graph} ipv6={ipv6} selectedNodeId={selectedNodeId} selectedLinkId={selectedLinkId} sourceId={sourceId} destinationId={destinationId} state={routingDepth} onChange={onRoutingDepthChange} onMessage={onMessage}/>\n    {selectedNode?.kind === 'router' && <><div className=\"control-title\"><span>IPV6 ROUTE TABLE</span>")

# Permanent contract wiring.
p=Path('package.json'); s=p.read_text(encoding='utf-8')
a='npm run test:builder-ipv6-lifecycle-contract && npm run test:builder-ipv6-ospfv3-contract'
b='npm run test:builder-ipv6-lifecycle-contract && npm run test:builder-ipv6-routing-depth-contract && npm run test:builder-ipv6-ospfv3-contract'
if s.count(a)!=1: raise SystemExit('package check anchor missing')
s=s.replace(a,b,1)
a='    "test:builder-ipv6-lifecycle-contract": "node scripts/builder-ipv6-lifecycle-contract-check.mjs",\n    "test:builder-ipv6-ospfv3-contract":'
b='    "test:builder-ipv6-lifecycle-contract": "node scripts/builder-ipv6-lifecycle-contract-check.mjs",\n    "test:builder-ipv6-routing-depth-contract": "node scripts/builder-ipv6-routing-depth-contract-check.mjs",\n    "test:builder-ipv6-ospfv3-contract":'
if s.count(a)!=1: raise SystemExit('package scripts anchor missing')
p.write_text(s.replace(a,b,1),encoding='utf-8')

# Mark the advanced 11N depth complete and document the separation of routing/policy truth.
p=Path('docs/ROADMAP.md'); s=p.read_text(encoding='utf-8')
s=s.replace('- [ ] timed + multi-area OSPFv3 with ABRs and inter-area IPv6 route reasoning','- [x] timed + multi-area OSPFv3 with ABRs and inter-area IPv6 route reasoning')
s=s.replace('- [ ] IPv6 ACL/firewall policy with independent forward/reverse ICMPv6 evaluation','- [x] IPv6 ACL/firewall policy with independent forward/reverse ICMPv6 evaluation')
p.write_text(s,encoding='utf-8')
p=Path('docs/LAB11N.md'); s=p.read_text(encoding='utf-8')
append='''\n\n## Routing-depth slice\n\nLab 11N now carries IPv6 routing beyond a single instantaneous Area 0 view:\n\n- every routed Builder link can be assigned an OSPFv3 area; routers attached to Area 0 and at least one nonzero area are derived as ABRs;\n- inter-area `O6 IA` reachability is computed through an explicit Area 0 backbone state graph rather than treating all enabled routers as one flat SPF domain;\n- physical failure, dead-timer expiry, LSA flood, SPF, RIB installation, and FIB programming are distinct deterministic moments; before FIB programming, the route overlay can remain stale and point at a physically failed link;\n- IPv6 ACL/firewall policy is a separate first-match dimension with per-router defaults and explicit ICMPv6 Echo Request, Echo Reply, Time Exceeded, and Packet Too Big types;\n- active IPv6 Ping/Traceroute consumes the area/timing route overlay and policy result, so healthy routing can still produce an explicit policy failure and a failed physical link can still be selected by stale control-plane state.\n\nThe advanced OSPFv3 timing/area assignment and IPv6 policy workspace are session state in this slice. Canonical interface addressing and existing scenario-v9 configuration remain backward compatible.\n'''
if '## Routing-depth slice' not in s: s=s.rstrip()+append
p.write_text(s,encoding='utf-8')

print('Patched advanced OSPFv3/policy integration and docs.')
