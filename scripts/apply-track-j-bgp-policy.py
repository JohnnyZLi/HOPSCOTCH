from pathlib import Path


def replace_once(path: str, before: str, after: str) -> None:
    p = Path(path)
    text = p.read_text()
    if before not in text:
        raise RuntimeError(f"Missing anchor in {path}: {before[:160]!r}")
    if text.count(before) != 1:
        raise RuntimeError(f"Expected one anchor in {path}, found {text.count(before)}: {before[:120]!r}")
    p.write_text(text.replace(before, after, 1))


# --- challenge model / generator ---
path = 'src/builder/challenges.ts'
replace_once(
    path,
    "import { upsertBuilderHostedService, type BuilderApplicationFamily, type BuilderApplicationTruthBoundary, type BuilderHostedService } from './application.ts';\n",
    "import { upsertBuilderHostedService, type BuilderApplicationFamily, type BuilderApplicationTruthBoundary, type BuilderHostedService } from './application.ts';\nimport { setBuilderBgpRouterAsn, updateBuilderBgpSession, upsertBuilderBgpOrigin, upsertBuilderBgpPolicy, upsertBuilderBgpSession, type BuilderBgpPolicyRule } from './bgp.ts';\n",
)
replace_once(
    path,
    "export type BuilderChallengeFamily = 'gateway' | 'access-vlan' | 'trunk-vlan' | 'stp-loop' | 'static-route' | 'ospf-disabled' | 'acl-deny' | 'nat-disabled' | 'dhcp-gateway' | 'ipv6-pmtu' | 'dns-name' | 'transport-listener';",
    "export type BuilderChallengeFamily = 'gateway' | 'access-vlan' | 'trunk-vlan' | 'stp-loop' | 'static-route' | 'ospf-disabled' | 'acl-deny' | 'nat-disabled' | 'dhcp-gateway' | 'ipv6-pmtu' | 'dns-name' | 'transport-listener' | 'bgp-import-policy';",
)
replace_once(
    path,
    "export interface BuilderTransportListenerChallengeFault {\n  kind: 'service-listener-disabled';\n  boundary: 'TRANSPORT';\n  plane: 'routed';\n  nodeId: string;\n  serviceId: string;\n  expectedEnabled: true;\n  port: number;\n}\n\nexport type BuilderChallengeFault = BuilderGatewayChallengeFault | BuilderAccessVlanChallengeFault | BuilderTrunkVlanChallengeFault | BuilderStpChallengeFault | BuilderStaticRouteChallengeFault | BuilderOspfDisabledChallengeFault | BuilderAclDenyChallengeFault | BuilderNatDisabledChallengeFault | BuilderDhcpGatewayChallengeFault | BuilderIpv6PmtuChallengeFault | BuilderDnsNameChallengeFault | BuilderTransportListenerChallengeFault;",
    "export interface BuilderTransportListenerChallengeFault {\n  kind: 'service-listener-disabled';\n  boundary: 'TRANSPORT';\n  plane: 'routed';\n  nodeId: string;\n  serviceId: string;\n  expectedEnabled: true;\n  port: number;\n}\n\nexport interface BuilderBgpImportPolicyChallengeFault {\n  kind: 'bgp-import-deny';\n  boundary: 'POLICY';\n  plane: 'routed';\n  nodeId: string;\n  sessionId: string;\n  targetPrefix: string;\n  blockingPolicy: BuilderBgpPolicyRule;\n}\n\nexport type BuilderChallengeFault = BuilderGatewayChallengeFault | BuilderAccessVlanChallengeFault | BuilderTrunkVlanChallengeFault | BuilderStpChallengeFault | BuilderStaticRouteChallengeFault | BuilderOspfDisabledChallengeFault | BuilderAclDenyChallengeFault | BuilderNatDisabledChallengeFault | BuilderDhcpGatewayChallengeFault | BuilderIpv6PmtuChallengeFault | BuilderDnsNameChallengeFault | BuilderTransportListenerChallengeFault | BuilderBgpImportPolicyChallengeFault;",
)

static_anchor = """function defaultStaticHealthySnapshot(): BuilderAuthoringSnapshot {
  const scenario = defaultBuilderScenario();
  let routing = setBuilderOspfEverywhere(scenario.graph, scenario.addressing, scenario.routing, false);
  routing = installStaticRoutesForWeightedPath(scenario.graph, scenario.addressing, routing, 'client', 'app').routing;
  routing = installStaticRoutesForWeightedPath(scenario.graph, scenario.addressing, routing, 'app', 'client').routing;
  return createBuilderAuthoringSnapshot({
    graph: scenario.graph,
    addressing: scenario.addressing,
    routing,
    ethernet: scenario.ethernet,
    linkProfiles: scenario.linkProfiles,
    acl: scenario.acl,
    nat: scenario.nat,
    dhcp: scenario.dhcp,
    ipv6: scenario.ipv6,
    services: scenario.services,
    sourceId: 'client',
    destinationId: 'app',
    layout: scenario.layout,
  });
}
"""
bgp_helper = static_anchor + """

function defaultBgpHealthySnapshot(): BuilderAuthoringSnapshot {
  const scenario = defaultBuilderScenario();
  let routing = setBuilderOspfEverywhere(scenario.graph, scenario.addressing, scenario.routing, false);
  let bgp = routing.bgp;
  bgp = setBuilderBgpRouterAsn(scenario.graph, bgp, 'edge', 64496);
  bgp = setBuilderBgpRouterAsn(scenario.graph, bgp, 'r1', 64500);
  bgp = setBuilderBgpRouterAsn(scenario.graph, bgp, 'core', 65538);

  bgp = upsertBuilderBgpSession(scenario.graph, bgp, 'edge-r1', 'customer-provider');
  const edgeR1 = bgp.sessions.find((entry) => entry.linkId === 'edge-r1');
  if (!edgeR1) throw new Error('The BGP policy challenge requires the canonical EDGE ↔ R1 peering link.');
  bgp = updateBuilderBgpSession(scenario.graph, bgp, edgeR1.id, { relationship: 'customer-provider', customerRouterId: 'edge' });

  bgp = upsertBuilderBgpSession(scenario.graph, bgp, 'r1-core', 'customer-provider');
  const r1Core = bgp.sessions.find((entry) => entry.linkId === 'r1-core');
  if (!r1Core) throw new Error('The BGP policy challenge requires the canonical R1 ↔ CORE peering link.');
  bgp = updateBuilderBgpSession(scenario.graph, bgp, r1Core.id, { relationship: 'customer-provider', customerRouterId: 'r1' });

  const clientPrefix = scenario.addressing.segments['client-edge']?.cidr;
  const appPrefix = scenario.addressing.segments['core-app']?.cidr;
  if (!clientPrefix || !appPrefix) throw new Error('The BGP policy challenge requires canonical CLIENT and APP edge prefixes.');
  bgp = upsertBuilderBgpOrigin(scenario.graph, bgp, { routerId: 'edge', prefix: clientPrefix, med: 0, communities: ['64496:100'], description: 'CLIENT edge prefix' });
  bgp = upsertBuilderBgpOrigin(scenario.graph, bgp, { routerId: 'core', prefix: appPrefix, med: 0, communities: ['65538:100'], description: 'APP edge prefix' });
  routing = validateBuilderRoutingConfig(scenario.graph, scenario.addressing, { ...routing, bgp });

  return createBuilderAuthoringSnapshot({
    graph: scenario.graph,
    addressing: scenario.addressing,
    routing,
    ethernet: scenario.ethernet,
    linkProfiles: scenario.linkProfiles,
    acl: scenario.acl,
    nat: scenario.nat,
    dhcp: scenario.dhcp,
    ipv6: scenario.ipv6,
    services: scenario.services,
    sourceId: 'client',
    destinationId: 'app',
    layout: scenario.layout,
  });
}
"""
replace_once(path, static_anchor, bgp_helper)

transport_anchor = """export function createTransportListenerChallenge(seedInput: string): BuilderChallenge {
  const seed = normalizeSeed(seedInput);
  const hash = hashSeed(seed);
  const healthy = defaultHealthySnapshot();
  healthy.sourceId = 'client'; healthy.destinationId = 'app';
  const services = healthy.services ?? [];
  const candidates = services.filter((service) => service.nodeId === 'app' && service.enabled && Boolean(service.hostname) && ['http','https','ssh','tcp'].includes(service.kind) && !(service.kind === 'https' && service.transportProfile === 'quic-h3')).sort((a,b)=>a.id.localeCompare(b.id));
  const service = candidates[hash % candidates.length];
  if (!service) throw new Error('The transport challenge requires a canonical named TCP service on APP.');
  const broken = createBuilderAuthoringSnapshot(healthy);
  broken.services = upsertBuilderHostedService(broken.graph, broken.services ?? [], { ...service, enabled: false });
  return { schema: BUILDER_CHALLENGE_SCHEMA, version: BUILDER_CHALLENGE_VERSION, id: 'transport-' + hash.toString(16).padStart(8,'0'), seed, family: 'transport-listener', title: 'SERVICE PORT IS CLOSED', objective: `Restore the ${service.label} listener on APP. Use the ordinary application transaction to prove DNS, L2, routing, policy, and link truth reach the endpoint before transport fails; repair canonical listener configuration and rerun the exact service request.`, difficulty: 'FOUNDATION', healthy, broken, verification: { kind:'application-transaction', sourceId:'client', destinationId:'app', serviceId:service.id, family:'ipv4' }, fault: { kind:'service-listener-disabled', boundary:'TRANSPORT', plane:'routed', nodeId:'app', serviceId:service.id, expectedEnabled:true, port:service.port } };
}
"""
bgp_challenge = transport_anchor + """

export function createBgpImportPolicyChallenge(seedInput: string): BuilderChallenge {
  const seed = normalizeSeed(seedInput);
  const hash = hashSeed(seed);
  const healthy = defaultBgpHealthySnapshot();
  const edgeSession = healthy.routing.bgp.sessions.find((entry) => entry.linkId === 'edge-r1');
  const coreSession = healthy.routing.bgp.sessions.find((entry) => entry.linkId === 'r1-core');
  const clientPrefix = healthy.addressing.segments['client-edge']?.cidr;
  const appPrefix = healthy.addressing.segments['core-app']?.cidr;
  if (!edgeSession || !coreSession || !clientPrefix || !appPrefix) throw new Error('The BGP policy challenge requires canonical edge/core sessions and endpoint prefixes.');
  const candidates = [
    { nodeId: 'edge', sessionId: edgeSession.id, targetPrefix: appPrefix, label: 'APP service prefix' },
    { nodeId: 'core', sessionId: coreSession.id, targetPrefix: clientPrefix, label: 'CLIENT return prefix' },
  ];
  const target = candidates[hash % candidates.length];
  const blockingPolicy: BuilderBgpPolicyRule = {
    id: `challenge-bgp-import-${hash.toString(16).padStart(8, '0')}`,
    routerId: target.nodeId,
    direction: 'import',
    sessionId: target.sessionId,
    order: 5,
    action: 'deny',
    prefix: target.targetPrefix,
    setLocalPref: null,
    setMed: null,
    addCommunity: null,
    matchCommunity: null,
    removeCommunity: null,
    prependAsCount: 0,
    allowRelationshipLeak: false,
    description: `Track J deny ${target.label}`,
  };
  const broken = createBuilderAuthoringSnapshot(healthy);
  broken.routing = validateBuilderRoutingConfig(broken.graph, broken.addressing, {
    ...broken.routing,
    bgp: upsertBuilderBgpPolicy(broken.graph, broken.routing.bgp, blockingPolicy),
  });
  return {
    schema: BUILDER_CHALLENGE_SCHEMA,
    version: BUILDER_CHALLENGE_VERSION,
    id: `bgp-policy-${hash.toString(16).padStart(8, '0')}`,
    seed,
    family: 'bgp-import-policy',
    title: 'BGP IMPORT POLICY BLACKHOLES THE SERVICE',
    objective: `Restore CLIENT ↔ APP IPv4 reachability in a BGP-only routed baseline. One explicit import policy rejects the required ${target.label}; use ordinary Ping / Traceroute, BGP RIB/policy state, and Device Workbench before removing the canonical deny and proving the same objective again.`,
    difficulty: 'FOUNDATION',
    healthy,
    broken,
    verification: { kind: 'routed-probe', sourceId: 'client', destinationId: 'app' },
    fault: { kind: 'bgp-import-deny', boundary: 'POLICY', plane: 'routed', nodeId: target.nodeId, sessionId: target.sessionId, targetPrefix: target.targetPrefix, blockingPolicy },
  };
}
"""
replace_once(path, transport_anchor, bgp_challenge)
replace_once(
    path,
    "  if (lowered.startsWith('transport-') || lowered.startsWith('tcp-') || lowered.startsWith('listener-')) return createTransportListenerChallenge(seed);\n  return createDefaultGatewayChallenge(seed);",
    "  if (lowered.startsWith('transport-') || lowered.startsWith('tcp-') || lowered.startsWith('listener-')) return createTransportListenerChallenge(seed);\n  if (lowered.startsWith('bgp-') || lowered.startsWith('bgp-policy-')) return createBgpImportPolicyChallenge(seed);\n  return createDefaultGatewayChallenge(seed);",
)
replace_once(
    path,
    "  if (fault.kind === 'path-mtu-reduced') return linkProfiles[fault.linkId]?.mtuBytes === fault.expectedMtuBytes;\n  const service = services.find((entry) => entry.id === fault.serviceId && entry.nodeId === fault.nodeId);",
    "  if (fault.kind === 'path-mtu-reduced') return linkProfiles[fault.linkId]?.mtuBytes === fault.expectedMtuBytes;\n  if (fault.kind === 'bgp-import-deny') return !routing.bgp.policies.some((rule) => rule.id === fault.blockingPolicy.id);\n  const service = services.find((entry) => entry.id === fault.serviceId && entry.nodeId === fault.nodeId);",
)
replace_once(
    path,
    "  if (fault.kind === 'service-hostname-missing') return `${fault.serviceId} had no deterministic hostname. Restoring ${fault.expectedHostname} repaired the DNS intent boundary; the post-repair application transaction then traversed the normal lower-layer and service stack.`;\n  return `${fault.serviceId} had its canonical listener disabled on port ${fault.port}. Re-enabling the listener repaired the transport boundary after DNS/routing/policy/link truth had already reached ${fault.nodeId.toUpperCase()}.`;",
    "  if (fault.kind === 'service-hostname-missing') return `${fault.serviceId} had no deterministic hostname. Restoring ${fault.expectedHostname} repaired the DNS intent boundary; the post-repair application transaction then traversed the normal lower-layer and service stack.`;\n  if (fault.kind === 'service-listener-disabled') return `${fault.serviceId} had its canonical listener disabled on port ${fault.port}. Re-enabling the listener repaired the transport boundary after DNS/routing/policy/link truth had already reached ${fault.nodeId.toUpperCase()}.`;\n  return `${fault.nodeId.toUpperCase()} imported an explicit BGP deny for ${fault.targetPrefix} on ${fault.sessionId}. Removing that canonical policy restored the required best path, and the post-repair routed probe proved end-to-end reachability.`;",
)

# --- Device Workbench: make BGP policy visible as ordinary config evidence ---
path = 'src/builder/device-workbench.ts'
replace_once(
    path,
    "    input.acl.rules.filter((entry)=>entry.routerId===deviceId).forEach((entry)=>policyRows.push(row(`cfg:acl:${entry.id}`,'IPV4 ACL',`${entry.order} · ${entry.action.toUpperCase()} ${entry.protocol.toUpperCase()}`,`${entry.sourcePrefix} → ${entry.destinationPrefix}${entry.destinationPort?`:${entry.destinationPort}`:''} · ${entry.description||entry.id}`,entry.action==='deny'?'warn':'normal',[why(`cfg:acl:${entry.id}:why`,'CONFIG','FIRST-MATCH RULE',`Rule ${entry.id} is persisted and evaluated in ascending order.`)])));\n",
    "    input.acl.rules.filter((entry)=>entry.routerId===deviceId).forEach((entry)=>policyRows.push(row(`cfg:acl:${entry.id}`,'IPV4 ACL',`${entry.order} · ${entry.action.toUpperCase()} ${entry.protocol.toUpperCase()}`,`${entry.sourcePrefix} → ${entry.destinationPrefix}${entry.destinationPort?`:${entry.destinationPort}`:''} · ${entry.description||entry.id}`,entry.action==='deny'?'warn':'normal',[why(`cfg:acl:${entry.id}:why`,'CONFIG','FIRST-MATCH RULE',`Rule ${entry.id} is persisted and evaluated in ascending order.`)])));\n    input.routing.bgp.policies.filter((entry)=>entry.routerId===deviceId).forEach((entry)=>policyRows.push(row(`cfg:bgp-policy:${entry.id}`,'BGP POLICY',`${entry.order} · ${entry.direction.toUpperCase()} · ${entry.action.toUpperCase()}`,`${entry.prefix} · ${entry.sessionId??'ANY SESSION'} · LP ${entry.setLocalPref??'KEEP'} · MED ${entry.setMed??'KEEP'} · ${entry.description||entry.id}`,entry.action==='deny'?'warn':'normal',[why(`cfg:bgp-policy:${entry.id}:why`,'CONFIG','BGP IMPORT / EXPORT POLICY',`Rule ${entry.id} is canonical BGP policy and is evaluated against matching routes on the selected session.`)])));\n",
)

# --- challenge panel instructions ---
path = 'src/BuilderChallengePanel.tsx'
replace_once(
    path,
    "      <p>{verificationKind === 'routed-probe'\n        ? 'Run the ordinary Builder Ping / Traceroute tools and inspect CONFIG / STATE / EVENTS in Device Workbench. Repair the network with the normal Builder configuration controls, then prove the repair with another objective probe.'",
    "      <p>{challenge.family === 'bgp-import-policy'\n        ? 'Run the ordinary Builder Ping / Traceroute tools, inspect the BGP RIB and IMPORT / EXPORT POLICY panel, and inspect CONFIG / STATE / EVENTS on the suspected router in Device Workbench. Remove the blocking canonical BGP policy with the normal BGP control, then prove the repair with the same objective probe.'\n        : verificationKind === 'routed-probe'\n        ? 'Run the ordinary Builder Ping / Traceroute tools and inspect CONFIG / STATE / EVENTS in Device Workbench. Repair the network with the normal Builder configuration controls, then prove the repair with another objective probe.'",
)

# --- NetworkBuilder challenge focus and launcher ---
path = 'src/NetworkBuilder.tsx'
replace_once(
    path,
    "else if(next.verification.kind==='application-transaction'){setSourceId(next.verification.sourceId);setDestinationId(next.verification.destinationId);setWorkbenchDevice({plane:'routed',id:next.fault.nodeId});setSelectedNodeId(next.fault.nodeId);}else{setSourceId(next.verification.sourceId);setDestinationId(next.verification.destinationId);setWorkbenchDevice({plane:'routed',id:next.verification.sourceId});setSelectedNodeId(next.verification.sourceId);}",
    "else if(next.verification.kind==='application-transaction'){setSourceId(next.verification.sourceId);setDestinationId(next.verification.destinationId);setWorkbenchDevice({plane:'routed',id:next.fault.nodeId});setSelectedNodeId(next.fault.nodeId);}else if(next.fault.kind==='bgp-import-deny'){setSourceId(next.verification.sourceId);setDestinationId(next.verification.destinationId);setWorkbenchDevice({plane:'routed',id:next.fault.nodeId});setSelectedNodeId(next.fault.nodeId);const session=next.routing.bgp.sessions.find((entry)=>entry.id===next.fault.sessionId);if(session)setSelectedLinkId(session.linkId);}else{setSourceId(next.verification.sourceId);setDestinationId(next.verification.destinationId);setWorkbenchDevice({plane:'routed',id:next.verification.sourceId});setSelectedNodeId(next.verification.sourceId);}",
)
replace_once(
    path,
    "else if(challenge.verification.kind==='application-transaction'){setSourceId(challenge.verification.sourceId);setDestinationId(challenge.verification.destinationId);setWorkbenchDevice({plane:'routed',id:challenge.fault.nodeId});setSelectedNodeId(challenge.fault.nodeId);}else{setSourceId(challenge.verification.sourceId);setDestinationId(challenge.verification.destinationId);setWorkbenchDevice({plane:'routed',id:challenge.verification.sourceId});setSelectedNodeId(challenge.verification.sourceId);}",
    "else if(challenge.verification.kind==='application-transaction'){setSourceId(challenge.verification.sourceId);setDestinationId(challenge.verification.destinationId);setWorkbenchDevice({plane:'routed',id:challenge.fault.nodeId});setSelectedNodeId(challenge.fault.nodeId);}else if(challenge.fault.kind==='bgp-import-deny'){setSourceId(challenge.verification.sourceId);setDestinationId(challenge.verification.destinationId);setWorkbenchDevice({plane:'routed',id:challenge.fault.nodeId});setSelectedNodeId(challenge.fault.nodeId);const session=challenge.routing?.bgp?.sessions?.find?.((entry)=>entry.id===challenge.fault.sessionId);if(session)setSelectedLinkId(session.linkId);}else{setSourceId(challenge.verification.sourceId);setDestinationId(challenge.verification.destinationId);setWorkbenchDevice({plane:'routed',id:challenge.verification.sourceId});setSelectedNodeId(challenge.verification.sourceId);}",
)
# Fix the restart expression above to use the challenge snapshot rather than a nonexistent challenge.routing field.
p = Path(path)
text = p.read_text().replace("const session=challenge.routing?.bgp?.sessions?.find?.((entry)=>entry.id===challenge.fault.sessionId);", "const session=challenge.broken.routing.bgp.sessions.find((entry)=>entry.id===challenge.fault.sessionId);")
p.write_text(text)
replace_once(
    path,
    "<button type=\"button\" onClick={()=>setChallengeSeed('transport-001')}>TRANSPORT</button></div><button type=\"button\" disabled={isHistorical} onClick={()=>startChallenge(challengeSeed)}>START CHALLENGE</button><small className=\"builder-routing-note\">SEED PREFIX SELECTS FAMILY · GATEWAY / VLAN / TRUNK / STP / STATIC / OSPF / ACL / NAT / DHCP / IPV6 MTU / DNS / TRANSPORT · NORMAL BUILDER PROBES, ARP/ND, LAN FLOW, NAT FLOW, DHCP DORA, PMTUD, APPLICATION REQUESTS, POLICY/ROUTE STATE, WORKBENCH, AND CONFIG CONTROLS · SESSION-ONLY SCORE.</small>",
    "<button type=\"button\" onClick={()=>setChallengeSeed('transport-001')}>TRANSPORT</button><button type=\"button\" onClick={()=>setChallengeSeed('bgp-001')}>BGP POLICY</button></div><button type=\"button\" disabled={isHistorical} onClick={()=>startChallenge(challengeSeed)}>START CHALLENGE</button><small className=\"builder-routing-note\">SEED PREFIX SELECTS FAMILY · GATEWAY / VLAN / TRUNK / STP / STATIC / OSPF / ACL / NAT / DHCP / IPV6 MTU / DNS / TRANSPORT / BGP POLICY · NORMAL BUILDER PROBES, ARP/ND, LAN FLOW, NAT FLOW, DHCP DORA, PMTUD, APPLICATION REQUESTS, BGP/POLICY/ROUTE STATE, WORKBENCH, AND CONFIG CONTROLS · SESSION-ONLY SCORE.</small>",
)

# --- contract coverage ---
path = 'scripts/builder-challenge-contract-check.mjs'
replace_once(
    path,
    "  createBuilderChallenge,\n  createDefaultGatewayChallenge,",
    "  createBuilderChallenge,\n  createBgpImportPolicyChallenge,\n  createDefaultGatewayChallenge,",
)
replace_once(
    path,
    "import { runBuilderApplicationTransaction, upsertBuilderHostedService } from '../src/builder/application.ts';\n",
    "import { runBuilderApplicationTransaction, upsertBuilderHostedService } from '../src/builder/application.ts';\nimport { builderBgpState, deleteBuilderBgpPolicy } from '../src/builder/bgp.ts';\n",
)
replace_once(
    path,
    "function scoreRoutedChallenge(challenge, repairedRouting) {",
    "function scoreRoutedChallenge(challenge, repairedRouting, boundary = 'ROUTING') {",
)
replace_once(
    path,
    "  const hypothesis = { boundary:'ROUTING', deviceId:challenge.fault.nodeId };",
    "  const hypothesis = { boundary, deviceId:challenge.fault.nodeId };",
)

bgp_contract = r'''
const bgpChallenges=['bgp-contract-001','bgp-contract-002'].map((seed)=>createBgpImportPolicyChallenge(seed));
assert.deepEqual(new Set(bgpChallenges.map((challenge)=>challenge.fault.nodeId)),new Set(['edge','core']),'deterministic BGP seeds must cover forward-prefix and return-prefix import policy faults');
for(const bgpChallenge of bgpChallenges){
  assert.equal(bgpChallenge.family,'bgp-import-policy');
  assert.equal(bgpChallenge.fault.kind,'bgp-import-deny');
  assert.equal(bgpChallenge.fault.boundary,'POLICY');
  assert.deepEqual(bgpChallenge,createBuilderChallenge(bgpChallenge.seed));
  const healthyState=builderBgpState(bgpChallenge.healthy.graph,bgpChallenge.healthy.addressing,bgpChallenge.healthy.routing.bgp);
  const brokenState=builderBgpState(bgpChallenge.broken.graph,bgpChallenge.broken.addressing,bgpChallenge.broken.routing.bgp);
  assert.equal(healthyState.sessions.filter((entry)=>entry.state==='ESTABLISHED').length,2,'BGP-only healthy baseline must establish both eBGP sessions');
  assert.equal(brokenState.sessions.filter((entry)=>entry.state==='ESTABLISHED').length,2,'import-policy fault must not fake a session failure');
  assert.ok(bgpChallenge.broken.routing.bgp.policies.some((rule)=>rule.id===bgpChallenge.fault.blockingPolicy.id),'broken BGP truth must contain the one explicit import deny');
  const repairedBgp=deleteBuilderBgpPolicy(bgpChallenge.broken.graph,bgpChallenge.broken.routing.bgp,bgpChallenge.fault.blockingPolicy.id);
  const repairedRouting=validateBuilderRoutingConfig(bgpChallenge.broken.graph,bgpChallenge.broken.addressing,{...bgpChallenge.broken.routing,bgp:repairedBgp});
  assert.deepEqual(repairedRouting,bgpChallenge.healthy.routing,'BGP policy challenge adds exactly one canonical policy object');
  assert.equal(builderChallengeIsRepaired(bgpChallenge,bgpChallenge.broken.addressing,bgpChallenge.broken.ethernet,bgpChallenge.broken.routing),false);
  assert.equal(builderChallengeIsRepaired(bgpChallenge,bgpChallenge.broken.addressing,bgpChallenge.broken.ethernet,repairedRouting),true);
  scoreRoutedChallenge(bgpChallenge,repairedRouting,'POLICY');
}

'''
replace_once(path, "const pmtuChallenge=createIpv6PmtuChallenge('mtu-contract-001');\n", bgp_contract + "const pmtuChallenge=createIpv6PmtuChallenge('mtu-contract-001');\n")
replace_once(
    path,
    "for (const challenge of [access, trunk, stp, staticRoute, ospf, aclChallenge, natChallenge, dhcpChallenge, pmtuChallenge, dnsChallenge, transportChallenge]) {",
    "for (const challenge of [access, trunk, stp, staticRoute, ospf, aclChallenge, natChallenge, dhcpChallenge, ...bgpChallenges, pmtuChallenge, dnsChallenge, transportChallenge]) {",
)
replace_once(
    path,
    "console.log('Builder Track J challenge contract passed: gateway plus seeded L2/routing/policy/DHCP/IPv6-PMTU/DNS-name/transport-listener faults use canonical truth, ordinary probe/LAN/NAT/DHCP/ND/PMTUD/application evidence, exact repair, objective-scoped verification, causal scoring, and reproducible tokens.');",
    "console.log('Builder Track J challenge contract passed: gateway plus seeded L2/routing/policy/BGP-import/DHCP/IPv6-PMTU/DNS-name/transport-listener faults use canonical truth, ordinary probe/LAN/NAT/DHCP/ND/PMTUD/application/BGP state evidence, exact repair, objective-scoped verification, causal scoring, and reproducible tokens.');",
)

# --- Track J documentation ---
path = 'docs/TRACKJ.md'
p = Path(path)
text = p.read_text()
text = text.replace('- BGP policy failures,', '- deeper BGP best-path / relationship-policy failures beyond the shipped import-deny family,')
if '## Eighth slice — BGP import policy' not in text:
    text += '''\n\n## Eighth slice — BGP import policy\n\nTrack J now includes a deterministic `bgp-*` / `bgp-policy-*` family built on the existing Builder BGP engine. The healthy snapshot is deliberately BGP-only for the CLIENT ↔ APP edge prefixes: OSPF is disabled, EDGE and CORE originate their directly attached endpoint prefixes, and two customer/provider eBGP sessions propagate those routes through R1.\n\nThe broken snapshot adds exactly one canonical import-policy object. Depending on the seed, either EDGE denies the APP service prefix on the EDGE ↔ R1 session or CORE denies the CLIENT return prefix on the R1 ↔ CORE session. BGP sessions remain ESTABLISHED; the failure is policy, not fabricated peering loss. Ordinary Ping / Traceroute exposes the reachability break, the BGP RIB and Device Workbench expose route/policy truth, and the existing BGP policy delete control performs the repair.\n\nScoring remains the common 40 evidence + 20 causal reasoning + 25 exact canonical repair + 15 post-repair objective verification contract. The challenge panel remains absent from stress mode, and no challenge-specific BGP route computation or policy evaluator exists.\n'''
p.write_text(text)

print('Applied Track J BGP import-policy troubleshooting slice.')
