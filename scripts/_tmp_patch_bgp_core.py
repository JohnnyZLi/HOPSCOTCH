from pathlib import Path

def replace_once(path, old, new):
    p=Path(path);s=p.read_text(encoding='utf-8');c=s.count(old)
    if c!=1:raise SystemExit(f'{path}: expected one anchor, found {c}: {old[:100]!r}')
    p.write_text(s.replace(old,new,1),encoding='utf-8')

def replace_all(path,old,new,minimum=1):
    p=Path(path);s=p.read_text(encoding='utf-8');c=s.count(old)
    if c<minimum:raise SystemExit(f'{path}: expected >= {minimum}, found {c}: {old[:100]!r}')
    p.write_text(s.replace(old,new),encoding='utf-8')

# Make the Lab 05 relationship policy reusable instead of inventing a second valley-free truth engine.
p=Path('src/internet/asModel.ts');s=p.read_text(encoding='utf-8')
s=s.replace("function documentationAsns(): number[] {\n  return [\n    ...Array.from({ length: 16 }, (_, index) => 64496 + index),\n    ...Array.from({ length: 16 }, (_, index) => 65536 + index),\n  ];\n}","export const DOCUMENTATION_ASNS: number[] = [\n  ...Array.from({ length: 16 }, (_, index) => 64496 + index),\n  ...Array.from({ length: 16 }, (_, index) => 65536 + index),\n];\n\nexport function isDocumentationAsn(asn: number): boolean { return DOCUMENTATION_ASNS.includes(Number(asn)); }\n\nexport type RouteRelationship = 'local' | 'customer' | 'peer' | 'provider';\nexport function relationshipExportAllowed(learnedFrom: RouteRelationship, advertiseTo: Exclude<RouteRelationship, 'local'>): boolean {\n  return learnedFrom === 'local' || learnedFrom === 'customer' || advertiseTo === 'customer';\n}\n\nfunction documentationAsns(): number[] { return [...DOCUMENTATION_ASNS]; }")
p.write_text(s,encoding='utf-8')

# Persist BGP configuration inside routing; all existing scenario-v9 readers get empty defaults when field is absent.
p=Path('src/builder/routing.ts');s=p.read_text(encoding='utf-8')
s=s.replace("import { findShortestPath, type BuilderGraph } from './model.ts';", "import { findShortestPath, type BuilderGraph } from './model.ts';\nimport { builderBgpState, cloneBuilderBgpConfig, createDefaultBuilderBgpConfig, reconcileBuilderBgpConfig, validateBuilderBgpConfig, type BuilderBgpConfig, type BuilderBgpRoute } from './bgp.ts';")
s=s.replace("export interface BuilderRoutingConfig {\n  staticRoutes: BuilderStaticRoute[];\n  ospf: BuilderOspfConfig;\n}","export interface BuilderRoutingConfig {\n  staticRoutes: BuilderStaticRoute[];\n  ospf: BuilderOspfConfig;\n  bgp: BuilderBgpConfig;\n}")
s=s.replace("export type BuilderRouteSource = 'connected' | 'static' | 'ospf';","export type BuilderRouteSource = 'connected' | 'static' | 'ospf' | 'bgp';")
s=s.replace("  ospfSummaryId?: string | null;\n}","  ospfSummaryId?: string | null;\n  bgpLearnedVia?: 'ebgp' | 'ibgp';\n  bgpAsPath?: number[];\n  bgpLocalPref?: number;\n  bgpMed?: number;\n  bgpCommunities?: string[];\n  bgpProtocolNextHop?: string;\n  bgpPolicyAnomaly?: boolean;\n}")
s=s.replace("return { staticRoutes: [], ospf: { enabledRouterIds: [], linkAreas: {}, summaries: [] } };","return { staticRoutes: [], ospf: { enabledRouterIds: [], linkAreas: {}, summaries: [] }, bgp: createDefaultBuilderBgpConfig() };")
s=s.replace("  const areaConfig = validateBuilderOspfAreaConfig(graph, { ...(value.ospf ?? { enabledRouterIds }), enabledRouterIds });\n  return { staticRoutes, ospf: { enabledRouterIds, linkAreas: areaConfig.linkAreas, summaries: areaConfig.summaries } };","  const areaConfig = validateBuilderOspfAreaConfig(graph, { ...(value.ospf ?? { enabledRouterIds }), enabledRouterIds });\n  const bgp = validateBuilderBgpConfig(graph, value.bgp ?? createDefaultBuilderBgpConfig());\n  return { staticRoutes, ospf: { enabledRouterIds, linkAreas: areaConfig.linkAreas, summaries: areaConfig.summaries }, bgp };" )
s=s.replace("    ospf: { enabledRouterIds: [...(value.ospf?.enabledRouterIds ?? [])], linkAreas: { ...(value.ospf?.linkAreas ?? {}) }, summaries: (value.ospf?.summaries ?? []).map((summary) => ({ ...summary })) },\n  };","    ospf: { enabledRouterIds: [...(value.ospf?.enabledRouterIds ?? [])], linkAreas: { ...(value.ospf?.linkAreas ?? {}) }, summaries: (value.ospf?.summaries ?? []).map((summary) => ({ ...summary })) },\n    bgp: cloneBuilderBgpConfig(value.bgp ?? createDefaultBuilderBgpConfig()),\n  };")
s=s.replace("  return validateBuilderRoutingConfig(graph, addressing, { staticRoutes: [...unique.values()], ospf: { enabledRouterIds, linkAreas: areaConfig.linkAreas, summaries: areaConfig.summaries } });","  return validateBuilderRoutingConfig(graph, addressing, { staticRoutes: [...unique.values()], ospf: { enabledRouterIds, linkAreas: areaConfig.linkAreas, summaries: areaConfig.summaries }, bgp: reconcileBuilderBgpConfig(graph, current.bgp ?? createDefaultBuilderBgpConfig()) });")
# Preserve BGP through OSPF-all spread object validation already happens through clone; no patch needed.

# Add BGP-derived FIB entries before sorting.
anchor="  entries.push(...ospfRouteEntriesForBuilderRouter(ospfTopologyGraph, addressing, routing, routerId));\n  return entries.sort((left, right) =>"
insert=r'''  entries.push(...ospfRouteEntriesForBuilderRouter(ospfTopologyGraph, addressing, routing, routerId));
  const bgpState = builderBgpState(graph, addressing, routing.bgp ?? createDefaultBuilderBgpConfig());
  for (const path of bgpState.bestRoutes.filter((route) => route.routerId === routerId && route.learnedVia !== 'local')) {
    const attachment = remoteInterfaceForNextHop(graph, addressing, routerId, path.nextHopAddress);
    const link = attachment ? linkById(graph, attachment.linkId) : null;
    const parsed = parseRoutePrefix(path.prefix);
    entries.push({
      id: `fib:${path.id}`,
      routerId,
      prefix: parsed.cidr,
      prefixLength: parsed.prefixLength,
      source: 'bgp',
      administrativeDistance: path.learnedVia === 'ebgp' ? 20 : 200,
      metric: path.asPath.length * 1000 + path.med,
      nextHop: path.nextHopAddress,
      outgoingInterface: attachment?.local.name ?? '—',
      linkId: attachment?.linkId ?? '—',
      active: Boolean(attachment && link && !link.failed),
      stateNote: `${path.learnedVia.toUpperCase()} · LP ${path.localPref} · AS_PATH ${path.asPath.length ? path.asPath.join(' ') : 'LOCAL'} · MED ${path.med} · BGP NEXT_HOP ${path.nextHopAddress}${path.communities.length ? ` · COMM ${path.communities.join(' ')}` : ''}${path.policyAnomaly ? ' · RELATIONSHIP LEAK' : ''}${!attachment ? ' · NEXT_HOP UNRESOLVED' : ''}`,
      bgpLearnedVia: path.learnedVia,
      bgpAsPath: [...path.asPath],
      bgpLocalPref: path.localPref,
      bgpMed: path.med,
      bgpCommunities: [...path.communities],
      bgpProtocolNextHop: path.nextHopAddress,
      bgpPolicyAnomaly: path.policyAnomaly,
    });
  }
  return entries.sort((left, right) =>'''
if s.count(anchor)!=1:raise SystemExit(f'routing FIB anchor found {s.count(anchor)}')
s=s.replace(anchor,insert,1)
p.write_text(s,encoding='utf-8')

# Network Builder gets the BGP authoring/RIB surface and route labels.
replace_once('src/NetworkBuilder.tsx',"import { BuilderIpv6Panel } from './BuilderIpv6Panel.tsx';\n","import { BuilderIpv6Panel } from './BuilderIpv6Panel.tsx';\nimport { BuilderBgpPanel } from './BuilderBgpPanel.tsx';\n")
replace_once('src/NetworkBuilder.tsx',"          <BuilderOspfTimingPanel graph={graph} addressing={addressing} routing={routing} sourceId={sourceId} destinationId={destinationId}/>\n          <section className=\"builder-acl-section\">","          <BuilderOspfTimingPanel graph={graph} addressing={addressing} routing={routing} sourceId={sourceId} destinationId={destinationId}/>\n          {!stressLabel&&<BuilderBgpPanel graph={graph} addressing={addressing} routing={routing} selectedNodeId={selectedNodeId} selectedLinkId={selectedLinkId} destinationPrefix={destinationPrefix} onChange={setRouting} onMessage={setMessage}/>}\n          <section className=\"builder-acl-section\">")
replace_once('src/NetworkBuilder.tsx',"entry.source==='connected'?'C':entry.source==='static'?'S':entry.ospfRouteType==='inter-area'?'O IA':'O'","entry.source==='connected'?'C':entry.source==='static'?'S':entry.source==='bgp'?(entry.bgpLearnedVia==='ebgp'?'B':'B i'):entry.ospfRouteType==='inter-area'?'O IA':'O'")
replace_once('src/NetworkBuilder.tsx',"CONNECT​ED AD 0 · STATIC AD 1 · OSPF AD 110.","CONNECTED AD 0 · STATIC AD 1 · eBGP AD 20 · OSPF AD 110 · iBGP AD 200.") if False else None
# Exact note without invisible typo.
p=Path('src/NetworkBuilder.tsx');s=p.read_text(encoding='utf-8');s=s.replace('CONNECTED AD 0 · STATIC AD 1 · OSPF AD 110.','CONNECTED AD 0 · STATIC AD 1 · eBGP AD 20 · OSPF AD 110 · iBGP AD 200.')
s=s.replace('Select a router to inspect connected, static, and OSPF routes.','Select a router to inspect connected, static, OSPF, and BGP routes.')
s=s.replace('Scenario v9 exported with dual-stack routed topology, link characteristics, ACL/NAT policy, and Ethernet/STP configuration;','Scenario v9 exported with dual-stack routed topology, OSPF/BGP control-plane configuration, link characteristics, ACL/NAT policy, and Ethernet/STP configuration;')
p.write_text(s,encoding='utf-8')

# Permanent BGP contract in normal checks.
p=Path('package.json');s=p.read_text(encoding='utf-8')
a='npm run test:builder-ospf-multiarea-contract && npm run test:builder-ipv6-contract'
b='npm run test:builder-ospf-multiarea-contract && npm run test:builder-bgp-contract && npm run test:builder-ipv6-contract'
if s.count(a)!=1:raise SystemExit('package check BGP anchor missing')
s=s.replace(a,b,1)
a='    "test:builder-ospf-multiarea-contract": "node scripts/builder-ospf-multiarea-contract-check.mjs",\n    "test:builder-ipv6-contract":'
b='    "test:builder-ospf-multiarea-contract": "node scripts/builder-ospf-multiarea-contract-check.mjs",\n    "test:builder-bgp-contract": "node scripts/builder-bgp-contract-check.mjs",\n    "test:builder-ipv6-contract":'
if s.count(a)!=1:raise SystemExit('package BGP script anchor missing')
p.write_text(s.replace(a,b,1),encoding='utf-8')

# Roadmap 11O core items. Projection bridge remains for the follow-up PR.
p=Path('docs/ROADMAP.md');s=p.read_text(encoding='utf-8')
for old,new in [
('- [ ] author routers with documentation ASNs and explicit eBGP/iBGP sessions','- [x] author routers with documentation ASNs and explicit eBGP/iBGP sessions'),
('- [ ] advertise and withdraw prefixes through a deterministic path-vector control plane','- [x] advertise and withdraw prefixes through a deterministic path-vector control plane'),
('- [ ] expose `AS_PATH`, `LOCAL_PREF`, `MED`, `NEXT_HOP`, communities, and best-path reasoning','- [x] expose `AS_PATH`, `LOCAL_PREF`, `MED`, `NEXT_HOP`, communities, and best-path reasoning'),
('- [ ] prefix lists and route-policy controls affect import/export independently from physical reachability','- [x] prefix lists and route-policy controls affect import/export independently from physical reachability'),
('- [ ] route leaks and hijack-style teaching scenarios reuse the same policy truth as Lab 05 instead of creating a second BGP model','- [x] route leaks and hijack-style teaching scenarios reuse the same relationship-export policy truth as Lab 05 instead of creating a second BGP model')]:
    if old not in s:raise SystemExit(f'roadmap anchor missing: {old}')
    s=s.replace(old,new,1)
p.write_text(s,encoding='utf-8')

Path('docs/LAB11O.md').write_text('''# Lab 11O — BGP inside Network Builder\n\nLab 11O brings a deterministic path-vector control plane into the same Builder topology rather than treating Internet-scale policy as a disconnected theater.\n\n## BGP configuration\n\n- Builder routers use RFC 5398 documentation ASNs only (`64496–64511` and `65536–65551`).\n- Direct router-router links can carry explicit eBGP or iBGP sessions. Session type is derived from the endpoint ASNs.\n- eBGP sessions can be PEER or CUSTOMER/PROVIDER; iBGP sessions keep an explicit `NEXT-HOP-SELF` teaching control.\n- Networks, communities, MED, import/export rules, and relationship-leak overrides are persisted inside the existing additive routing configuration. Old schema-v9 files with no BGP field normalize to an empty BGP config.\n\n## Deterministic path vector\n\nThe BGP RIB is derived from local origins plus the currently ESTABLISHED sessions. Each convergence round advertises only the sender's current best path, so link/session failure removes the corresponding Adj-RIB-In route instead of preserving stale invented state. AS-loop rejection and iBGP split-horizon are explicit.\n\nHOPSCOTCH's teaching best-path order is:\n\n1. highest `LOCAL_PREF`;\n2. shortest `AS_PATH`;\n3. lowest `MED`;\n4. local over eBGP over iBGP;\n5. stable router/source tie break.\n\nThis is deliberately described as the HOPSCOTCH teaching comparator rather than a universal vendor decision process. For FIB precedence, eBGP AD 20 and iBGP AD 200 are also local teaching defaults, not BGP protocol attributes.\n\n## Policy and anomalies\n\nImport/export rules can permit/deny a prefix and mutate LOCAL_PREF, MED, or communities independently from physical link state. The customer/peer/provider export rule is shared from Lab 05's Internet policy model: local/customer-learned routes may be exported broadly, while peer/provider-learned routes export only to customers unless an explicit leak override is authored.\n\nBecause arbitrary network origination is allowed for teaching, the engine marks a prefix as multi-origin when different documentation ASNs originate the same NLRI. This creates a controlled hijack-style scenario without pretending it is legitimate ownership. Relationship-policy overrides mark resulting routes as leak anomalies.\n\n## Data plane\n\nBest BGP paths project into the IPv4 route table as `B` / `B i`. A BGP route is active only when its protocol NEXT_HOP is directly resolvable on the current Builder topology. This makes iBGP NEXT_HOP preservation versus NEXT-HOP-SELF visible instead of silently inventing recursive reachability. Existing Ping/Traceroute, NAT, and ACL code consume the same route table, so BGP is not a parallel forwarding engine.\n\n## Internet-scale projection\n\nThe BGP model already derives an AS-level projection from Builder ASNs and eBGP relationships. The follow-up 11O projection slice will carry that exact state into Lab 05 and back, preserving selected BGP path truth rather than asking the AS theater to recompute a different story.\n''',encoding='utf-8')
print('Patched shared AS policy, routing/FIB, Builder UI, contracts, and Lab 11O docs.')
