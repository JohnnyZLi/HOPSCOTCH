from pathlib import Path
import re


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 occurrence, found {count}')
    return text.replace(old, new, 1)

p = Path('src/NetworkBuilder.tsx')
s = p.read_text()

s = replace_once(
    s,
    "import { cloneBuilderDhcpConfig, createDefaultBuilderDhcpConfig, type BuilderDhcpConfig } from './builder/dhcp.ts';\nimport './NetworkBuilder.css';",
    "import { applyBuilderDhcpState, clearBuilderDhcpLeases, cloneBuilderDhcpConfig, createDefaultBuilderDhcpConfig, type BuilderDhcpConfig, type BuilderDhcpLeaseTable } from './builder/dhcp.ts';\nimport { BuilderDhcpPanel } from './BuilderDhcpPanel.tsx';\nimport { BuilderDeviceWorkbench } from './BuilderDeviceWorkbench.tsx';\nimport { appendBuilderWorkbenchMessageEvent, buildBuilderDeviceWorkbench, builderWorkbenchDeviceOptions, classifyBuilderWorkbenchMessage, createBuilderWorkbenchEventJournal, type BuilderDeviceRef, type BuilderWorkbenchEventJournal } from './builder/device-workbench.ts';\nimport './NetworkBuilder.css';",
    'NetworkBuilder imports',
)

s = replace_once(
    s,
    "  const [dhcp, setDhcp] = useState<BuilderDhcpConfig>(() => cloneBuilderDhcpConfig(initialDhcp ?? createDefaultBuilderDhcpConfig(initialEthernet ?? (stressLabel ? createEmptyBuilderEthernetConfig() : createDefaultBuilderEthernetConfig()))));\n  const [natSessions, setNatSessions] = useState<BuilderNatSessionTable>(() => clearBuilderNatSessions());",
    "  const [dhcp, setDhcp] = useState<BuilderDhcpConfig>(() => cloneBuilderDhcpConfig(initialDhcp ?? createDefaultBuilderDhcpConfig(initialEthernet ?? (stressLabel ? createEmptyBuilderEthernetConfig() : createDefaultBuilderEthernetConfig()))));\n  const [dhcpLeases, setDhcpLeases] = useState<BuilderDhcpLeaseTable>(() => clearBuilderDhcpLeases());\n  const [dhcpSequence, setDhcpSequence] = useState(1);\n  const [natSessions, setNatSessions] = useState<BuilderNatSessionTable>(() => clearBuilderNatSessions());",
    'DHCP runtime state',
)

s = replace_once(
    s,
    "  const [message, setMessage] = useState('Graph truth and layout are separate. Dragging never changes route cost.');",
    "  const [message, setMessageState] = useState('Graph truth and layout are separate. Dragging never changes route cost.');\n  const [workbenchEvents, setWorkbenchEvents] = useState<BuilderWorkbenchEventJournal>(() => createBuilderWorkbenchEventJournal());\n  const [workbenchDevice, setWorkbenchDevice] = useState<BuilderDeviceRef>(() => ({ plane: 'routed', id: initialSourceId }));",
    'message/event journal state',
)

anchor = "  const selectedRouterAclRules = selectedNode?.kind === 'router' ? acl.rules.filter((rule) => rule.routerId === selectedNode.id).sort((a,b)=>a.order-b.order||a.id.localeCompare(b.id)) : [];\n"
addition = """  const selectedRouterAclRules = selectedNode?.kind === 'router' ? acl.rules.filter((rule) => rule.routerId === selectedNode.id).sort((a,b)=>a.order-b.order||a.id.localeCompare(b.id)) : [];
  const runtimeEthernet = useMemo(() => applyBuilderDhcpState(ethernet, dhcp, dhcpLeases, dhcpSequence), [ethernet, dhcp, dhcpLeases, dhcpSequence]);
  const workbenchOptions = useMemo(() => builderWorkbenchDeviceOptions(graph, ethernet), [graph, ethernet]);
  const effectiveWorkbenchDevice = workbenchOptions.some((option) => option.plane === workbenchDevice.plane && option.id === workbenchDevice.id)
    ? workbenchDevice
    : ({ plane: workbenchOptions[0]?.plane ?? 'routed', id: workbenchOptions[0]?.id ?? selectedNodeId } as BuilderDeviceRef);
  const workbenchSnapshot = useMemo(() => buildBuilderDeviceWorkbench({ graph, addressing, routing, ipv6, ipv6ControlState, ipv6RoutingDepth, ethernet, ethernetFlow, arpCache, arpResolutions, acl, nat, natSessions, dhcp, dhcpLeases, dhcpSequence, probeHistory, sourceId, destinationId, events: workbenchEvents }, effectiveWorkbenchDevice), [graph, addressing, routing, ipv6, ipv6ControlState, ipv6RoutingDepth, ethernet, ethernetFlow, arpCache, arpResolutions, acl, nat, natSessions, dhcp, dhcpLeases, dhcpSequence, probeHistory, sourceId, destinationId, workbenchEvents, effectiveWorkbenchDevice.plane, effectiveWorkbenchDevice.id]);
  const setMessage = (nextMessage: string) => {
    setMessageState(nextMessage);
    const category = classifyBuilderWorkbenchMessage(nextMessage);
    const routedRefs: BuilderDeviceRef[] = [
      ...(graph.nodes.some((node) => node.id === selectedNodeId) ? [{ plane: 'routed' as const, id: selectedNodeId }] : []),
      ...(graph.nodes.some((node) => node.id === sourceId) ? [{ plane: 'routed' as const, id: sourceId }] : []),
      ...(graph.nodes.some((node) => node.id === destinationId) ? [{ plane: 'routed' as const, id: destinationId }] : []),
    ];
    const lanRefs: BuilderDeviceRef[] = [
      ...(ethernet.devices.some((device) => device.id === ethernetSourceId) ? [{ plane: 'ethernet' as const, id: ethernetSourceId }] : []),
      ...(ethernet.devices.some((device) => device.id === ethernetDestinationId) ? [{ plane: 'ethernet' as const, id: ethernetDestinationId }] : []),
      ...((selectedEthernetLink ? [selectedEthernetLink.a, selectedEthernetLink.b] : []).map((id) => ({ plane: 'ethernet' as const, id }))),
    ];
    const refs = ['dhcp','neighbor','switching'].includes(category) ? lanRefs : routedRefs;
    setWorkbenchEvents((current) => appendBuilderWorkbenchMessageEvent(current, nextMessage, refs));
  };
"""
s = replace_once(s, anchor, addition, 'workbench derivation')

old_reset = "    const next = createDefaultBuilderEthernetConfig(); setEthernet(next); setEthernetSourceId('lan-a'); setEthernetDestinationId('lan-b'); setSelectedEthernetLinkId(next.links[0]?.id ?? ''); setEthernetFlow(null); setArpCache(clearBuilderArpCache()); setArpResolutions([]); setMessage('LAN FABRIC RESET · VLANs, STP, ARP cache, trunks, and router-on-a-stick interfaces restored.');"
new_reset = "    const next = createDefaultBuilderEthernetConfig(); setEthernet(next); setDhcp(createDefaultBuilderDhcpConfig(next)); setDhcpLeases(clearBuilderDhcpLeases()); setDhcpSequence(1); setEthernetSourceId('lan-a'); setEthernetDestinationId('lan-b'); setSelectedEthernetLinkId(next.links[0]?.id ?? ''); setEthernetFlow(null); setArpCache(clearBuilderArpCache()); setArpResolutions([]); setMessage('LAN FABRIC RESET · VLANs, STP, ARP/DHCP runtime state, trunks, and router-on-a-stick interfaces restored.');"
s = replace_once(s, old_reset, new_reset, 'reset LAN demo')

old_run = "  const runEthernet = () => { const arp=resolveBuilderEthernetFlowArp(ethernet,ethernetSourceId,ethernetDestinationId,arpCache); setArpCache(arp.cache); setArpResolutions(arp.resolutions); if(!arp.success){setEthernetFlow(null);setMessage(`ARP FAILED · ${arp.failureReason ?? 'Address resolution failed.'}`);return;} const result = runBuilderEthernetFlow(ethernet,ethernetSourceId,ethernetDestinationId); setEthernetFlow(result); setMessage(`LAN FABRIC · ${arp.resolutions.map((entry)=>entry.cacheHit?'ARP CACHE HIT':'ARP RESOLVED').join(' + ')} · ${result.summary}`); };"
new_run = "  const runEthernet = () => { const arp=resolveBuilderEthernetFlowArp(runtimeEthernet,ethernetSourceId,ethernetDestinationId,arpCache); setArpCache(arp.cache); setArpResolutions(arp.resolutions); if(!arp.success){setEthernetFlow(null);setMessage(`ARP FAILED · ${arp.failureReason ?? 'Address resolution failed.'}`);return;} const result = runBuilderEthernetFlow(runtimeEthernet,ethernetSourceId,ethernetDestinationId); setEthernetFlow(result); setMessage(`LAN FABRIC · ${arp.resolutions.map((entry)=>entry.cacheHit?'ARP CACHE HIT':'ARP RESOLVED').join(' + ')} · ${result.summary}`); };"
s = replace_once(s, old_run, new_run, 'runtime Ethernet flow')

s = replace_once(
    s,
    "    setEthernet(cloneBuilderEthernetConfig(initialEthernet ?? createDefaultBuilderEthernetConfig())); setEthernetFlow(null); setLinkProfiles(cloneBuilderLinkProfiles(initialLinkProfiles ?? createDefaultBuilderLinkProfiles(initialGraph))); setAcl(cloneBuilderAclConfig(initialAcl ?? createDefaultBuilderAclConfig())); setNat(cloneBuilderNatConfig(initialNat ?? createDefaultBuilderNatConfig(initialGraph))); setDhcp(cloneBuilderDhcpConfig(initialDhcp ?? createDefaultBuilderDhcpConfig(initialEthernet ?? createDefaultBuilderEthernetConfig()))); setNatSessions(clearBuilderNatSessions());",
    "    setEthernet(cloneBuilderEthernetConfig(initialEthernet ?? createDefaultBuilderEthernetConfig())); setEthernetFlow(null); setLinkProfiles(cloneBuilderLinkProfiles(initialLinkProfiles ?? createDefaultBuilderLinkProfiles(initialGraph))); setAcl(cloneBuilderAclConfig(initialAcl ?? createDefaultBuilderAclConfig())); setNat(cloneBuilderNatConfig(initialNat ?? createDefaultBuilderNatConfig(initialGraph))); setDhcp(cloneBuilderDhcpConfig(initialDhcp ?? createDefaultBuilderDhcpConfig(initialEthernet ?? createDefaultBuilderEthernetConfig()))); setDhcpLeases(clearBuilderDhcpLeases()); setDhcpSequence(1); setNatSessions(clearBuilderNatSessions());",
    'reset topology DHCP leases',
)

s = replace_once(
    s,
    "    setGraph(cloneBuilderGraph(scenario.graph)); setAddressing(cloneBuilderAddressing(scenario.addressing)); setRouting(cloneBuilderRoutingConfig(scenario.routing)); setIpv6(cloneBuilderIpv6Config(scenario.ipv6)); setEthernet(cloneBuilderEthernetConfig(scenario.ethernet)); setLinkProfiles(cloneBuilderLinkProfiles(scenario.linkProfiles)); setAcl(cloneBuilderAclConfig(scenario.acl)); setNat(cloneBuilderNatConfig(scenario.nat)); setDhcp(cloneBuilderDhcpConfig(scenario.dhcp)); setNatSessions(clearBuilderNatSessions());",
    "    setGraph(cloneBuilderGraph(scenario.graph)); setAddressing(cloneBuilderAddressing(scenario.addressing)); setRouting(cloneBuilderRoutingConfig(scenario.routing)); setIpv6(cloneBuilderIpv6Config(scenario.ipv6)); setEthernet(cloneBuilderEthernetConfig(scenario.ethernet)); setLinkProfiles(cloneBuilderLinkProfiles(scenario.linkProfiles)); setAcl(cloneBuilderAclConfig(scenario.acl)); setNat(cloneBuilderNatConfig(scenario.nat)); setDhcp(cloneBuilderDhcpConfig(scenario.dhcp)); setDhcpLeases(clearBuilderDhcpLeases()); setDhcpSequence(1); setNatSessions(clearBuilderNatSessions());",
    'restore scenario DHCP runtime clear',
)

s = replace_once(
    s,
    "                <motion.div className={`builder-node ${node.kind} ${onRoute ? 'on-route' : ''} ${selectedNode?.id === node.id ? 'selected' : ''}`} drag dragMomentum={false} dragElastic={0} onPointerDown={() => setSelectedNodeId(node.id)}",
    "                <motion.div className={`builder-node ${node.kind} ${onRoute ? 'on-route' : ''} ${selectedNode?.id === node.id ? 'selected' : ''}`} drag dragMomentum={false} dragElastic={0} onPointerDown={() => { setSelectedNodeId(node.id); setWorkbenchDevice({ plane: 'routed', id: node.id }); }}",
    'routed node workbench selection',
)

lan_pattern = re.compile(r"return <div key=\{device\.id\} className=\{`builder-lan-node \$\{device\.kind\}`\} style=\{\{left:`\$\{point\.x\}%`,top:`\$\{point\.y\}%`\}\}>")
match = lan_pattern.search(s)
if not match:
    raise SystemExit('LAN node workbench selection anchor missing')
replacement = "return <div key={device.id} role=\"button\" tabIndex={0} aria-label={`Inspect ${device.label}`} onClick={()=>setWorkbenchDevice({plane:'ethernet',id:device.id})} onKeyDown={(event)=>{if(event.key==='Enter'||event.key===' ')setWorkbenchDevice({plane:'ethernet',id:device.id});}} className={`builder-lan-node ${device.kind} ${effectiveWorkbenchDevice.plane==='ethernet'&&effectiveWorkbenchDevice.id===device.id?'workbench-selected':''}`} style={{left:`${point.x}%`,top:`${point.y}%`}}>"
s = s[:match.start()] + replacement + s[match.end():]

s = replace_once(
    s,
    "        <aside className=\"builder-controls\">\n          <section><div className=\"control-title\"><span>ENDPOINTS</span><strong>GRAPH ↔ IP</strong></div>",
    "        <aside className=\"builder-controls\">\n          {!stressLabel&&<BuilderDeviceWorkbench snapshot={workbenchSnapshot} options={workbenchOptions} onSelect={(ref)=>{setWorkbenchDevice(ref);if(ref.plane==='routed')setSelectedNodeId(ref.id);}}/>}\n          <section><div className=\"control-title\"><span>ENDPOINTS</span><strong>GRAPH ↔ IP</strong></div>",
    'workbench panel insertion',
)

s = replace_once(
    s,
    "          <BuilderOspfAreaPanel graph={graph} addressing={addressing} routing={routing} selectedNodeId={selectedNodeId} selectedLinkId={selectedLinkId} onChange={(next, detail)=>{setRouting(next);setMessage(detail);}}/>",
    "          {!stressLabel&&<BuilderDhcpPanel ethernet={ethernet} config={dhcp} onConfigChange={setDhcp} leases={dhcpLeases} onLeasesChange={setDhcpLeases} sequence={dhcpSequence} onSequenceChange={setDhcpSequence} onMessage={setMessage}/>}\n          <BuilderOspfAreaPanel graph={graph} addressing={addressing} routing={routing} selectedNodeId={selectedNodeId} selectedLinkId={selectedLinkId} onChange={(next, detail)=>{setRouting(next);setMessage(detail);}}/>",
    'DHCP panel insertion',
)

s = replace_once(
    s,
    "      setMessage('Scenario v9 exported with dual-stack routed topology, OSPF/BGP control-plane configuration, link characteristics, ACL/NAT policy, and Ethernet/STP configuration; ARP/NAT-session/probe/FDB observations remain session-only.');",
    "      setMessage('Scenario v9 exported with dual-stack routed topology, OSPF/BGP control-plane configuration, link characteristics, ACL/NAT policy, Ethernet/STP, and DHCP configuration; ARP/ND/FDB/NAT translations/DHCP leases/probes/device events remain session-only.');",
    'export persistence message',
)

p.write_text(s)

# Fix route WHY to use the real addressing plane for BGP state.
p = Path('src/builder/device-workbench.ts')
s = p.read_text()
s = replace_once(s, "function routeWhy(graph:BuilderGraph,routing:BuilderRoutingConfig,entry:BuilderRouteTableEntry):BuilderWorkbenchWhyStep[]{", "function routeWhy(graph:BuilderGraph,addressing:BuilderAddressing,routing:BuilderRoutingConfig,entry:BuilderRouteTableEntry):BuilderWorkbenchWhyStep[]{", 'routeWhy signature')
s = replace_once(s, "    const bgp=builderBgpState(graph,{segments:{},defaultGateways:{}} as BuilderAddressing,routing.bgp);", "    const bgp=builderBgpState(graph,addressing,routing.bgp);", 'routeWhy BGP addressing')
s = replace_once(s, "routeWhy(input.graph,input.routing,entry)", "routeWhy(input.graph,input.addressing,input.routing,entry)", 'routeWhy invocation')
p.write_text(s)

# Roadmap: complete the canonical device-workbench slice, leave arbitrary historical timestamps for the later time machine.
p = Path('docs/ROADMAP.md')
s = p.read_text()
for old, new in [
    ('- [ ] every device exposes canonical configuration separately from derived runtime state', '- [x] every device exposes canonical configuration separately from derived runtime state'),
    ('- [ ] CONFIG covers interfaces, VLANs, routes, dynamic routing, ACLs, NAT, DHCP, and later service configuration', '- [x] CONFIG covers interfaces, VLANs, routes, dynamic routing, ACLs, NAT, DHCP, and later service configuration'),
    ('- [ ] STATE covers ARP/ND, FDB, RIB/FIB, OSPF neighbors/LSDB, BGP RIBs, NAT translations, and DHCP leases', '- [x] STATE covers ARP/ND, FDB, RIB/FIB, OSPF neighbors/LSDB, BGP RIBs, NAT translations, and DHCP leases'),
    ('- [ ] EVENTS answers what changed, when it changed, and which upstream event caused the change', '- [x] EVENTS answers what changed, when it changed, and which upstream event caused the change'),
    ('- [ ] route, packet, adjacency, FDB, and policy objects expose a deterministic “why?” chain', '- [x] route, packet, adjacency, FDB, and policy objects expose a deterministic “why?” chain'),
]:
    s = replace_once(s, old, new, f'roadmap {old[:24]}')
p.write_text(s)

print('Applied Lab 11P NetworkBuilder integration, DHCP runtime wiring, device workbench selection, model fix, and roadmap updates.')
