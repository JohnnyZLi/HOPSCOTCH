from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    s = p.read_text(encoding='utf-8')
    count = s.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one anchor, found {count}: {old[:120]!r}')
    p.write_text(s.replace(old, new, 1), encoding='utf-8')


# Exact BGP route projection: include the selected best route and use its origin ASN.
p = Path('src/builder/bgp.ts')
s = p.read_text(encoding='utf-8')
old_projection_interface = r'''export interface BuilderBgpAsProjection {
  graph: SimulatedAsGraph;
  sourceAsn: number | null;
  destinationAsn: number | null;
  selectedPathAsns: number[];
  prefix: string | null;
}'''
new_projection_interface = r'''export interface BuilderBgpAsProjection {
  graph: SimulatedAsGraph;
  sourceAsn: number | null;
  destinationAsn: number | null;
  selectedPathAsns: number[];
  prefix: string | null;
  selectedRoute: BuilderBgpRoute | null;
}'''
if s.count(old_projection_interface) != 1:
    raise SystemExit('BGP projection interface anchor missing')
s = s.replace(old_projection_interface, new_projection_interface, 1)
start = s.index('export function projectBuilderBgpToAsGraph(')
new_projection_function = r'''export function projectBuilderBgpToAsGraph(graph:BuilderGraph,config:BuilderBgpConfig,state?:BuilderBgpState,sourceRouterId?:string,destinationRouterId?:string,prefix?:string):BuilderBgpAsProjection{
  const validated=validateBuilderBgpConfig(graph,config);
  const asns=[...new Set(validated.enabledRouterIds.map((id)=>builderBgpAsnForRouter(graph,validated,id)))].sort((a,b)=>a-b);
  const eSessions=validated.sessions.filter((session)=>sessionMode(graph,validated,session)==='ebgp');
  const degree=new Map<number,number>();
  for(const session of eSessions){const a=builderBgpAsnForRouter(graph,validated,session.aRouterId),b=builderBgpAsnForRouter(graph,validated,session.bRouterId);degree.set(a,(degree.get(a)??0)+1);degree.set(b,(degree.get(b)??0)+1);}
  const originAsns=new Set(validated.origins.map((origin)=>builderBgpAsnForRouter(graph,validated,origin.routerId)));
  const nodes=asns.map((asn,index)=>{const angle=(Math.PI*2*index)/Math.max(1,asns.length)-Math.PI/2;const role:AsRole=originAsns.has(asn)?'content':(degree.get(asn)??0)>=3?'transit':(degree.get(asn)??0)>=2?'regional':'access';return{asn,label:`AS${asn}`,role,x:50+38*Math.cos(angle),y:50+38*Math.sin(angle)};});
  const relMap=new Map<string,AsRelationship>();
  for(const session of eSessions){const a=builderBgpAsnForRouter(graph,validated,session.aRouterId),b=builderBgpAsnForRouter(graph,validated,session.bRouterId);if(a===b)continue;const key=[a,b].sort((x,y)=>x-y).join(':');if(relMap.has(key))continue;if(session.relationship==='customer-provider'&&session.customerRouterId){const customer=builderBgpAsnForRouter(graph,validated,session.customerRouterId),provider=customer===a?b:a;relMap.set(key,{id:`builder-cp:${customer}:${provider}`,kind:'customer-provider',customer,provider});}else relMap.set(key,{id:`builder-peer:${Math.min(a,b)}:${Math.max(a,b)}`,kind:'peer',a:Math.min(a,b),b:Math.max(a,b)});}
  const sourceAsn=sourceRouterId&&nodeIsRouter(graph,sourceRouterId)?builderBgpAsnForRouter(graph,validated,sourceRouterId):asns[0]??null;
  const winner=state&&sourceRouterId?state.bestRoutes.find((route)=>route.routerId===sourceRouterId&&(!prefix||route.prefix===parsePrefix(prefix).cidr)):null;
  const destinationAsn=destinationRouterId&&nodeIsRouter(graph,destinationRouterId)?builderBgpAsnForRouter(graph,validated,destinationRouterId):(winner?.originAsn??asns.at(-1)??null);
  const selectedPathAsns=winner&&sourceAsn?[sourceAsn,...winner.asPath].filter((asn,index,all)=>index===0||asn!==all[index-1]):[];
  const selectedRoute=winner?{...winner,asPath:[...winner.asPath],communities:[...winner.communities]}:null;
  return{graph:{nodes,relationships:[...relMap.values()].sort((a,b)=>a.id.localeCompare(b.id))},sourceAsn,destinationAsn,selectedPathAsns,prefix:winner?.prefix??(prefix?parsePrefix(prefix).cidr:null),selectedRoute};
}
'''
s = s[:start] + new_projection_function
p.write_text(s, encoding='utf-8')


# Builder BGP panel exposes the exact projection as an explicit navigation action.
p = Path('src/BuilderBgpPanel.tsx')
s = p.read_text(encoding='utf-8')
s = s.replace("  type BuilderBgpPolicyDirection,\n", "  type BuilderBgpPolicyDirection,\n  type BuilderBgpAsProjection,\n", 1)
old_signature = "export function BuilderBgpPanel({graph,addressing,routing,selectedNodeId,selectedLinkId,destinationPrefix,onChange,onMessage}:{graph:BuilderGraph;addressing:BuilderAddressing;routing:BuilderRoutingConfig;selectedNodeId:string;selectedLinkId:string;destinationPrefix:string;onChange:(next:BuilderRoutingConfig)=>void;onMessage:(message:string)=>void;}){"
new_signature = "export function BuilderBgpPanel({graph,addressing,routing,selectedNodeId,selectedLinkId,destinationPrefix,onChange,onMessage,onOpenAsProjection}:{graph:BuilderGraph;addressing:BuilderAddressing;routing:BuilderRoutingConfig;selectedNodeId:string;selectedLinkId:string;destinationPrefix:string;onChange:(next:BuilderRoutingConfig)=>void;onMessage:(message:string)=>void;onOpenAsProjection?:(projection:BuilderBgpAsProjection)=>void;}){"
if s.count(old_signature) != 1:
    raise SystemExit('BuilderBgpPanel signature anchor missing')
s = s.replace(old_signature, new_signature, 1)
old_facts = r'''  <div className="builder-ospf-facts"><div><span>ANOMALIES</span><strong>{state.multiOriginPrefixes.length} MULTI-ORIGIN · {state.leakedRouteIds.length} LEAKED</strong></div><div><span>AS PROJECTION</span><strong>{projection.graph.nodes.length} AS · {projection.graph.relationships.length} REL</strong></div></div>{state.multiOriginPrefixes.length>0&&<small className="builder-routing-note">MULTI-ORIGIN / HIJACK TEACHING STATE · {state.multiOriginPrefixes.join(', ')} is originated by more than one ASN. Best-path policy decides which advertisement wins.</small>}'''
new_facts = r'''  <div className="builder-ospf-facts"><div><span>ANOMALIES</span><strong>{state.multiOriginPrefixes.length} MULTI-ORIGIN · {state.leakedRouteIds.length} LEAKED</strong></div><div><span>AS PROJECTION</span><strong>{projection.graph.nodes.length} AS · {projection.graph.relationships.length} REL</strong></div></div><div className="button-row"><button type="button" disabled={!onOpenAsProjection||!projection.selectedRoute||projection.selectedPathAsns.length===0} onClick={()=>projection.selectedRoute&&onOpenAsProjection?.(projection)}>OPEN AS PROJECTION ↗</button></div>{projection.selectedRoute&&<small className="builder-routing-note">PROJECTION READY · AS{projection.sourceAsn} → AS{projection.destinationAsn} · {projection.prefix} · exact Builder BEST path {projection.selectedPathAsns.map((asn)=>`AS${asn}`).join(' → ')}.</small>}{state.multiOriginPrefixes.length>0&&<small className="builder-routing-note">MULTI-ORIGIN / HIJACK TEACHING STATE · {state.multiOriginPrefixes.join(', ')} is originated by more than one ASN. Best-path policy decides which advertisement wins.</small>}'''
if s.count(old_facts) != 1:
    raise SystemExit('BuilderBgpPanel projection facts anchor missing')
s = s.replace(old_facts, new_facts, 1)
p.write_text(s, encoding='utf-8')


# Builder snapshot/restore bridge. Persist every scenario field that can affect canonical truth.
p = Path('src/NetworkBuilder.tsx')
s = p.read_text(encoding='utf-8')
s = s.replace("import { BuilderBgpPanel } from './BuilderBgpPanel.tsx';\n", "import { BuilderBgpPanel } from './BuilderBgpPanel.tsx';\nimport type { BuilderBgpAsProjection } from './builder/bgp.ts';\nimport { cloneBuilderDhcpConfig, createDefaultBuilderDhcpConfig, type BuilderDhcpConfig } from './builder/dhcp.ts';\n", 1)
old_signature = "export function NetworkBuilder({ onExit, onOpenFailureStory, onOpenProbePacket, initialGraph = defaultBuilderGraph, initialLayout = defaultBuilderLayout, initialAddressing, initialRouting, initialEthernet, initialNat, initialIpv6, initialSourceId = 'client', initialDestinationId = 'app', stressLabel }: { onExit: () => void; onOpenFailureStory: () => void; onOpenProbePacket?: (seed: BuilderProbePacketSeed) => void; initialGraph?: BuilderGraph; initialLayout?: BuilderLayout; initialAddressing?: BuilderAddressing; initialRouting?: BuilderRoutingConfig; initialEthernet?: BuilderEthernetConfig; initialNat?: BuilderNatConfig; initialIpv6?: BuilderIpv6Config; initialSourceId?: string; initialDestinationId?: string; stressLabel?: string }) {"
new_signature = "export function NetworkBuilder({ onExit, onOpenFailureStory, onOpenProbePacket, onOpenBgpProjection, initialGraph = defaultBuilderGraph, initialLayout = defaultBuilderLayout, initialAddressing, initialRouting, initialEthernet, initialLinkProfiles, initialAcl, initialNat, initialDhcp, initialIpv6, initialSourceId = 'client', initialDestinationId = 'app', initialScenarioName = 'My topology', stressLabel }: { onExit: () => void; onOpenFailureStory: () => void; onOpenProbePacket?: (seed: BuilderProbePacketSeed) => void; onOpenBgpProjection?: (payload: { projection: BuilderBgpAsProjection; scenario: BuilderScenarioV8 }) => void; initialGraph?: BuilderGraph; initialLayout?: BuilderLayout; initialAddressing?: BuilderAddressing; initialRouting?: BuilderRoutingConfig; initialEthernet?: BuilderEthernetConfig; initialLinkProfiles?: BuilderLinkProfiles; initialAcl?: BuilderAclConfig; initialNat?: BuilderNatConfig; initialDhcp?: BuilderDhcpConfig; initialIpv6?: BuilderIpv6Config; initialSourceId?: string; initialDestinationId?: string; initialScenarioName?: string; stressLabel?: string }) {"
if s.count(old_signature) != 1:
    raise SystemExit('NetworkBuilder signature anchor missing')
s = s.replace(old_signature, new_signature, 1)
s = s.replace("  const [linkProfiles, setLinkProfiles] = useState<BuilderLinkProfiles>(() => createDefaultBuilderLinkProfiles(initialGraph));", "  const [linkProfiles, setLinkProfiles] = useState<BuilderLinkProfiles>(() => cloneBuilderLinkProfiles(initialLinkProfiles ?? createDefaultBuilderLinkProfiles(initialGraph)));", 1)
s = s.replace("  const [acl, setAcl] = useState<BuilderAclConfig>(() => createDefaultBuilderAclConfig());", "  const [acl, setAcl] = useState<BuilderAclConfig>(() => cloneBuilderAclConfig(initialAcl ?? createDefaultBuilderAclConfig()));", 1)
nat_state = "  const [nat, setNat] = useState<BuilderNatConfig>(() => cloneBuilderNatConfig(initialNat ?? (stressLabel ? createEmptyBuilderNatConfig() : createDefaultBuilderNatConfig(initialGraph))));"
if s.count(nat_state) != 1:
    raise SystemExit('NetworkBuilder NAT state anchor missing')
s = s.replace(nat_state, nat_state + "\n  const [dhcp, setDhcp] = useState<BuilderDhcpConfig>(() => cloneBuilderDhcpConfig(initialDhcp ?? createDefaultBuilderDhcpConfig(initialEthernet ?? (stressLabel ? createEmptyBuilderEthernetConfig() : createDefaultBuilderEthernetConfig()))));", 1)
s = s.replace("  const [scenarioName, setScenarioName] = useState('My topology');", "  const [scenarioName, setScenarioName] = useState(initialScenarioName);", 1)

old_reset = "    setEthernet(cloneBuilderEthernetConfig(initialEthernet ?? createDefaultBuilderEthernetConfig())); setEthernetFlow(null); setLinkProfiles(createDefaultBuilderLinkProfiles(initialGraph)); setAcl(createDefaultBuilderAclConfig()); setNat(cloneBuilderNatConfig(initialNat ?? createDefaultBuilderNatConfig(initialGraph))); setNatSessions(clearBuilderNatSessions());"
new_reset = "    setEthernet(cloneBuilderEthernetConfig(initialEthernet ?? createDefaultBuilderEthernetConfig())); setEthernetFlow(null); setLinkProfiles(cloneBuilderLinkProfiles(initialLinkProfiles ?? createDefaultBuilderLinkProfiles(initialGraph))); setAcl(cloneBuilderAclConfig(initialAcl ?? createDefaultBuilderAclConfig())); setNat(cloneBuilderNatConfig(initialNat ?? createDefaultBuilderNatConfig(initialGraph))); setDhcp(cloneBuilderDhcpConfig(initialDhcp ?? createDefaultBuilderDhcpConfig(initialEthernet ?? createDefaultBuilderEthernetConfig()))); setNatSessions(clearBuilderNatSessions());"
if s.count(old_reset) != 1:
    raise SystemExit('NetworkBuilder reset persisted-config anchor missing')
s = s.replace(old_reset, new_reset, 1)
old_reset_ids = "    setSourceId(initialSourceId); setDestinationId(initialDestinationId); setSelectedNodeId(initialSourceId);"
new_reset_ids = "    setSourceId(initialSourceId); setDestinationId(initialDestinationId); setSelectedNodeId(initialSourceId); setScenarioName(initialScenarioName);"
if s.count(old_reset_ids) != 1:
    raise SystemExit('NetworkBuilder reset ids anchor missing')
s = s.replace(old_reset_ids, new_reset_ids, 1)

s = s.replace("createBuilderScenario(scenarioName.trim() || 'Untitled topology', graph, sourceId, destinationId, layout, addressing, routing, existing, ethernet, linkProfiles, acl, nat, undefined, ipv6)", "createBuilderScenario(scenarioName.trim() || 'Untitled topology', graph, sourceId, destinationId, layout, addressing, routing, existing, ethernet, linkProfiles, acl, nat, dhcp, ipv6)", 1)
restore_anchor = "setAcl(cloneBuilderAclConfig(scenario.acl)); setNat(cloneBuilderNatConfig(scenario.nat)); setNatSessions(clearBuilderNatSessions());"
if s.count(restore_anchor) != 1:
    raise SystemExit('NetworkBuilder restore DHCP anchor missing')
s = s.replace(restore_anchor, "setAcl(cloneBuilderAclConfig(scenario.acl)); setNat(cloneBuilderNatConfig(scenario.nat)); setDhcp(cloneBuilderDhcpConfig(scenario.dhcp)); setNatSessions(clearBuilderNatSessions());", 1)
s = s.replace("createBuilderScenario(scenarioName.trim() || 'Exported topology', graph, sourceId, destinationId, layout, addressing, routing, undefined, ethernet, linkProfiles, acl, nat, undefined, ipv6)", "createBuilderScenario(scenarioName.trim() || 'Exported topology', graph, sourceId, destinationId, layout, addressing, routing, undefined, ethernet, linkProfiles, acl, nat, dhcp, ipv6)", 1)

anchor = "  const onNodeDragEnd = (nodeId: string, offsetX: number, offsetY: number) => {"
if s.count(anchor) != 1:
    raise SystemExit('NetworkBuilder projection callback anchor missing')
projection_callback = r'''  const openBgpProjection = (projection: BuilderBgpAsProjection) => {
    if (!onOpenBgpProjection || !projection.selectedRoute) { setMessage('BGP AS PROJECTION · select a router/prefix with a concrete BEST route first.'); return; }
    try {
      const scenario = createBuilderScenario(scenarioName.trim() || 'BGP projection', graph, sourceId, destinationId, layout, addressing, routing, undefined, ethernet, linkProfiles, acl, nat, dhcp, ipv6);
      onOpenBgpProjection({ projection, scenario });
    } catch (error) { setMessage(`BGP PROJECTION REJECTED · ${error instanceof Error ? error.message : 'Unable to snapshot Builder truth.'}`); }
  };

  const onNodeDragEnd = (nodeId: string, offsetX: number, offsetY: number) => {'''
s = s.replace(anchor, projection_callback, 1)
old_panel = "<BuilderBgpPanel graph={graph} addressing={addressing} routing={routing} selectedNodeId={selectedNodeId} selectedLinkId={selectedLinkId} destinationPrefix={destinationPrefix} onChange={setRouting} onMessage={setMessage}/>"
new_panel = "<BuilderBgpPanel graph={graph} addressing={addressing} routing={routing} selectedNodeId={selectedNodeId} selectedLinkId={selectedLinkId} destinationPrefix={destinationPrefix} onChange={setRouting} onMessage={setMessage} onOpenAsProjection={openBgpProjection}/>"
if s.count(old_panel) != 1:
    raise SystemExit('NetworkBuilder BGP panel anchor missing')
s = s.replace(old_panel, new_panel, 1)
p.write_text(s, encoding='utf-8')

print('Applied clean BGP projection model and Builder snapshot bridge.')
