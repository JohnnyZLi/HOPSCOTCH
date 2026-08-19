from pathlib import Path


def read(path):
    return Path(path).read_text()


def write(path, text):
    Path(path).write_text(text)


def replace_once(path, before, after):
    text = read(path)
    if after in text:
        return
    if before not in text:
        raise RuntimeError(f'Missing anchor in {path}: {before[:160]!r}')
    write(path, text.replace(before, after, 1))


def replace_all(path, before, after):
    text = read(path)
    if before not in text:
        return
    write(path, text.replace(before, after))


# ---------------------------------------------------------------------------
# Canonical hosted-service truth + truthful DNS / listener semantics.
# ---------------------------------------------------------------------------
application = 'src/builder/application.ts'
replace_once(application,
"export function upsertBuilderHostedService(graph: BuilderGraph, services: readonly BuilderHostedService[], service: BuilderHostedService): BuilderHostedService[] {\n  return validateBuilderHostedServices(graph, [...services.filter((candidate) => candidate.id !== service.id), service]);\n}\n",
"export function upsertBuilderHostedService(graph: BuilderGraph, services: readonly BuilderHostedService[], service: BuilderHostedService): BuilderHostedService[] {\n  return validateBuilderHostedServices(graph, [...services.filter((candidate) => candidate.id !== service.id), service]);\n}\n\nexport function cloneBuilderHostedServices(graph: BuilderGraph, services: readonly BuilderHostedService[]): BuilderHostedService[] {\n  return validateBuilderHostedServices(graph, services);\n}\n\nexport function reconcileBuilderHostedServices(graph: BuilderGraph, services: readonly BuilderHostedService[]): BuilderHostedService[] {\n  const endpointIds = new Set(graph.nodes.filter((node) => node.kind === 'endpoint').map((node) => node.id));\n  return validateBuilderHostedServices(graph, services.filter((service) => endpointIds.has(service.nodeId)));\n}\n")
replace_once(application,
"  const protocolEvents = journeyProtocolEvents(service);",
"  const protocolEvents = service.enabled ? journeyProtocolEvents(service) : [];")
replace_once(application,
"    const dnsOk = service.enabled && Boolean(service.hostname || service.kind === 'dns');\n    if (!dnsOk) firstBroken = 'DNS';\n    stages.push(stage(2, 'dns', 'DNS', 'SERVICE / DNS INTENT', dnsOk ? 'PASS' : 'FAIL', dnsOk ? `${service.hostname ?? service.nodeId} → ${destinationAddress}` : 'SERVICE NAME UNAVAILABLE', dnsOk ? `The hosted-service catalog resolves the selected deterministic service to ${nodeLabel(context.graph, destinationNodeId)}. No public DNS evidence is implied.` : 'The service is disabled or has no deterministic name mapping.', [destinationNodeId]));",
"    const dnsOk = Boolean(service.hostname || service.kind === 'dns');\n    if (!dnsOk) firstBroken = 'DNS';\n    stages.push(stage(2, 'dns', 'DNS', 'SERVICE / DNS INTENT', dnsOk ? 'PASS' : 'FAIL', dnsOk ? `${service.hostname ?? service.nodeId} → ${destinationAddress}` : 'SERVICE NAME UNAVAILABLE', dnsOk ? `The canonical hosted-service catalog resolves the selected deterministic service to ${nodeLabel(context.graph, destinationNodeId)}. Listener availability is a later transport boundary; no public DNS evidence is implied.` : 'Canonical hosted-service configuration has no deterministic name mapping for this service.', [destinationNodeId]));")
replace_once(application,
"  if (!firstBroken) {\n    const transportSummary = transport === 'tcp' ? (service.kind === 'https' && service.transportProfile === 'quic-h3' ? 'QUIC' : 'TCP') : service.kind === 'https' ? 'QUIC / UDP' : 'UDP';\n    stages.push(stage(7, 'transport', 'TRANSPORT', 'TRANSPORT', 'PASS', `${transportSummary} SESSION READY`, protocolEvents.length ? `${protocolEvents.filter((event) => event.kind.startsWith('transport.')).map((event) => event.title).join(' → ')}. These events are reused from the canonical Journey/Lab 03 model.` : `${service.kind.toUpperCase()} uses deterministic UDP datagram semantics; no fake TCP state is created.`, [sourceNodeId, destinationNodeId], requestLinks));\n  } else stages.push(notReached(7, 'transport', 'TRANSPORT', 'TRANSPORT', firstBroken));",
"  if (!firstBroken) {\n    const transportSummary = transport === 'tcp' ? (service.kind === 'https' && service.transportProfile === 'quic-h3' ? 'QUIC' : 'TCP') : service.kind === 'https' ? 'QUIC / UDP' : 'UDP';\n    const listenerReady = service.enabled;\n    if (!listenerReady) firstBroken = 'TRANSPORT';\n    stages.push(stage(7, 'transport', 'TRANSPORT', 'TRANSPORT', listenerReady ? 'PASS' : 'FAIL', listenerReady ? `${transportSummary} SESSION READY` : `${transportSummary} LISTENER UNAVAILABLE`, listenerReady ? (protocolEvents.length ? `${protocolEvents.filter((event) => event.kind.startsWith('transport.')).map((event) => event.title).join(' → ')}. These events are reused from the canonical Journey/Lab 03 model.` : `${service.kind.toUpperCase()} uses deterministic UDP datagram semantics; no fake TCP state is created.`) : `${nodeLabel(context.graph, destinationNodeId)} has no enabled ${service.kind.toUpperCase()} listener on ${transport.toUpperCase()}/${service.port}. Lower-layer routing and policy already reached the endpoint; no established transport event or packet bytes are fabricated.`, [sourceNodeId, destinationNodeId], requestLinks));\n  } else stages.push(notReached(7, 'transport', 'TRANSPORT', 'TRANSPORT', firstBroken));")

# ---------------------------------------------------------------------------
# Persist hosted services as a backward-compatible optional extension of v9.
# Old v9 files omitted this field because the UI derived the same default list.
# ---------------------------------------------------------------------------
scenario = 'src/builder/scenario.ts'
replace_once(scenario,
"import { cloneBuilderIpv6Config, createDefaultBuilderIpv6Config, createEmptyBuilderIpv6Config, validateBuilderIpv6Config, type BuilderIpv6Config } from './ipv6.ts';\n",
"import { cloneBuilderIpv6Config, createDefaultBuilderIpv6Config, createEmptyBuilderIpv6Config, validateBuilderIpv6Config, type BuilderIpv6Config } from './ipv6.ts';\nimport { cloneBuilderHostedServices, createDefaultBuilderHostedServices, validateBuilderHostedServices, type BuilderHostedService } from './application.ts';\n")
replace_once(scenario,
"export type BuilderScenarioV9=Omit<BuilderScenarioLegacyV8,'version'>&{version:9;dhcp:BuilderDhcpConfig;ipv6:BuilderIpv6Config};",
"export type BuilderScenarioV9=Omit<BuilderScenarioLegacyV8,'version'>&{version:9;dhcp:BuilderDhcpConfig;ipv6:BuilderIpv6Config;services:BuilderHostedService[]};")
replace_once(scenario,
"const ethernet=validateBuilderEthernetConfig(raw.ethernet as unknown as BuilderEthernetConfig);const ipv6=isRecord(raw.ipv6)?validateBuilderIpv6Config(graph,addressing,raw.ipv6 as unknown as BuilderIpv6Config):createEmptyBuilderIpv6Config(graph,addressing);return{schema:'hopscotch.builder',version:9,name:assertString(raw.name,'Scenario name',80),graph,addressing,routing:validateBuilderRoutingConfig(graph,addressing,raw.routing as unknown as BuilderRoutingConfig),ethernet,linkProfiles:validateBuilderLinkProfiles(graph,raw.linkProfiles as unknown as BuilderLinkProfiles),acl:validateBuilderAclConfig(graph,raw.acl as unknown as BuilderAclConfig),nat:validateBuilderNatConfig(graph,raw.nat as unknown as BuilderNatConfig),dhcp:validateBuilderDhcpConfig(ethernet,raw.dhcp as unknown as BuilderDhcpConfig),ipv6,sourceId,destinationId,layout:validateLayout(raw.layout,graph),createdAt:assertTimestamp(raw.createdAt,'createdAt'),updatedAt:assertTimestamp(raw.updatedAt,'updatedAt')};}",
"const ethernet=validateBuilderEthernetConfig(raw.ethernet as unknown as BuilderEthernetConfig);const ipv6=isRecord(raw.ipv6)?validateBuilderIpv6Config(graph,addressing,raw.ipv6 as unknown as BuilderIpv6Config):createEmptyBuilderIpv6Config(graph,addressing);const services=Array.isArray(raw.services)?validateBuilderHostedServices(graph,raw.services as unknown as BuilderHostedService[]):createDefaultBuilderHostedServices(graph);return{schema:'hopscotch.builder',version:9,name:assertString(raw.name,'Scenario name',80),graph,addressing,routing:validateBuilderRoutingConfig(graph,addressing,raw.routing as unknown as BuilderRoutingConfig),ethernet,linkProfiles:validateBuilderLinkProfiles(graph,raw.linkProfiles as unknown as BuilderLinkProfiles),acl:validateBuilderAclConfig(graph,raw.acl as unknown as BuilderAclConfig),nat:validateBuilderNatConfig(graph,raw.nat as unknown as BuilderNatConfig),dhcp:validateBuilderDhcpConfig(ethernet,raw.dhcp as unknown as BuilderDhcpConfig),ipv6,services,sourceId,destinationId,layout:validateLayout(raw.layout,graph),createdAt:assertTimestamp(raw.createdAt,'createdAt'),updatedAt:assertTimestamp(raw.updatedAt,'updatedAt')};}")
replace_once(scenario,
"export function createBuilderScenario(name:string,graph:BuilderGraph,sourceId:string,destinationId:string,layout:BuilderLayout,addressing:BuilderAddressing=createDefaultBuilderAddressing(graph),routing:BuilderRoutingConfig=createDefaultBuilderRoutingConfig(),existing?:BuilderScenarioV9,ethernet:BuilderEthernetConfig=createDefaultBuilderEthernetConfig(),linkProfiles:BuilderLinkProfiles=createDefaultBuilderLinkProfiles(graph),acl:BuilderAclConfig=createDefaultBuilderAclConfig(),nat:BuilderNatConfig=createDefaultBuilderNatConfig(graph),dhcp:BuilderDhcpConfig=createDefaultBuilderDhcpConfig(ethernet),ipv6:BuilderIpv6Config=createDefaultBuilderIpv6Config(graph,addressing)):BuilderScenarioV9{const now=new Date().toISOString();return validateV9({schema:'hopscotch.builder',version:9,name,graph:cloneBuilderGraph(graph),addressing,routing:cloneBuilderRoutingConfig(routing),ethernet:cloneBuilderEthernetConfig(ethernet),linkProfiles:cloneBuilderLinkProfiles(linkProfiles),acl:cloneBuilderAclConfig(acl),nat:cloneBuilderNatConfig(nat),dhcp:cloneBuilderDhcpConfig(dhcp),ipv6:cloneBuilderIpv6Config(ipv6),sourceId,destinationId,layout:layoutForGraph(layout,graph),createdAt:existing?.createdAt??now,updatedAt:now});}",
"export function createBuilderScenario(name:string,graph:BuilderGraph,sourceId:string,destinationId:string,layout:BuilderLayout,addressing:BuilderAddressing=createDefaultBuilderAddressing(graph),routing:BuilderRoutingConfig=createDefaultBuilderRoutingConfig(),existing?:BuilderScenarioV9,ethernet:BuilderEthernetConfig=createDefaultBuilderEthernetConfig(),linkProfiles:BuilderLinkProfiles=createDefaultBuilderLinkProfiles(graph),acl:BuilderAclConfig=createDefaultBuilderAclConfig(),nat:BuilderNatConfig=createDefaultBuilderNatConfig(graph),dhcp:BuilderDhcpConfig=createDefaultBuilderDhcpConfig(ethernet),ipv6:BuilderIpv6Config=createDefaultBuilderIpv6Config(graph,addressing),services:BuilderHostedService[]=createDefaultBuilderHostedServices(graph)):BuilderScenarioV9{const now=new Date().toISOString();return validateV9({schema:'hopscotch.builder',version:9,name,graph:cloneBuilderGraph(graph),addressing,routing:cloneBuilderRoutingConfig(routing),ethernet:cloneBuilderEthernetConfig(ethernet),linkProfiles:cloneBuilderLinkProfiles(linkProfiles),acl:cloneBuilderAclConfig(acl),nat:cloneBuilderNatConfig(nat),dhcp:cloneBuilderDhcpConfig(dhcp),ipv6:cloneBuilderIpv6Config(ipv6),services:cloneBuilderHostedServices(graph,services),sourceId,destinationId,layout:layoutForGraph(layout,graph),createdAt:existing?.createdAt??now,updatedAt:now});}")

# Scenario comparison must treat hosted services as configuration truth.
replace_once('src/builder/scenario-compare.ts',
"  'ipv6',\n  'sourceId',",
"  'ipv6',\n  'services',\n  'sourceId',")

# Authoring snapshots carry services when available while retaining compatibility
# with existing helper callers that construct snapshots directly.
authoring = 'src/builder/authoring.ts'
replace_once(authoring,
"import type { BuilderAclConfig } from './acl.ts';\n",
"import type { BuilderAclConfig } from './acl.ts';\nimport type { BuilderHostedService } from './application.ts';\n")
replace_once(authoring,
"  ipv6: BuilderIpv6Config;\n  sourceId: string;",
"  ipv6: BuilderIpv6Config;\n  services?: BuilderHostedService[];\n  sourceId: string;")

# ---------------------------------------------------------------------------
# Application workspace: consume/edit canonical service config.
# ---------------------------------------------------------------------------
panel = 'src/BuilderApplicationPanel.tsx'
replace_once(panel,
"import type { BuilderApplicationContext, BuilderApplicationTransaction } from './builder/application.ts';",
"import type { BuilderApplicationContext, BuilderApplicationTransaction, BuilderHostedService } from './builder/application.ts';")
replace_once(panel,
"  sourceNodeId: string;\n  historical: boolean;",
"  sourceNodeId: string;\n  services: BuilderHostedService[];\n  onServicesChange: (services: BuilderHostedService[]) => void;\n  preferredServiceId?: string | null;\n  historical: boolean;")

workspace = 'src/BuilderApplicationWorkspace.tsx'
replace_once(workspace,
"import { useMemo, useState } from 'react';",
"import { useEffect, useMemo, useState } from 'react';")
replace_once(workspace,
"  createDefaultBuilderHostedServices,\n  runBuilderApplicationTransaction,",
"  runBuilderApplicationTransaction,\n  upsertBuilderHostedService,")
replace_once(workspace,
"export function BuilderApplicationWorkspace({ context, sourceNodeId, historical, onSessionState, onTransaction, onMessage }: BuilderApplicationPanelProps) {\n  const services = useMemo(() => createDefaultBuilderHostedServices(context.graph), [context.graph]);\n  const [serviceId, setServiceId] = useState(() => services[0]?.id ?? '');",
"export function BuilderApplicationWorkspace({ context, sourceNodeId, services, onServicesChange, preferredServiceId, historical, onSessionState, onTransaction, onMessage }: BuilderApplicationPanelProps) {\n  const [serviceId, setServiceId] = useState(() => preferredServiceId ?? services[0]?.id ?? '');")
replace_once(workspace,
"  const selectedService = services.find((service) => service.id === serviceId) ?? services[0] ?? null;\n  const selectedPacket",
"  const selectedService = services.find((service) => service.id === serviceId) ?? services[0] ?? null;\n  useEffect(() => { if (preferredServiceId && services.some((service) => service.id === preferredServiceId)) setServiceId(preferredServiceId); }, [preferredServiceId, services]);\n  useEffect(() => { if (!services.some((service) => service.id === serviceId)) setServiceId(services[0]?.id ?? ''); }, [services, serviceId]);\n  const selectedPacket")
replace_once(workspace,
"      <div className=\"builder-service-strip\">{services.map((service) => <span key={service.id} data-enabled={service.enabled}><b>{service.kind.toUpperCase()}</b>{serviceProtocol(service)} · {service.hostname ?? service.nodeId}</span>)}</div>",
"      {selectedService && <div className=\"builder-service-config\"><div><span>CANONICAL HOSTED SERVICE</span><strong>{selectedService.label} · {selectedService.nodeId.toUpperCase()}</strong><small>DNS name and listener availability are persisted scenario configuration. Editing them changes application truth, not challenge metadata.</small></div><label>HOSTNAME<input key={`${selectedService.id}:${selectedService.hostname ?? 'none'}`} disabled={historical} defaultValue={selectedService.hostname ?? ''} placeholder=\"NO DETERMINISTIC NAME\" onBlur={(event)=>{try{onServicesChange(upsertBuilderHostedService(context.graph,services,{...selectedService,hostname:event.currentTarget.value.trim()||null}));onMessage(`SERVICE CONFIG · ${selectedService.label} hostname ${event.currentTarget.value.trim()||'cleared'}.`);}catch(cause){onMessage(`SERVICE CONFIG REJECTED · ${cause instanceof Error?cause.message:String(cause)}`);event.currentTarget.value=selectedService.hostname??'';}}}/></label><button type=\"button\" disabled={historical} data-enabled={selectedService.enabled} onClick={()=>{const enabled=!selectedService.enabled;onServicesChange(upsertBuilderHostedService(context.graph,services,{...selectedService,enabled}));onMessage(`SERVICE CONFIG · ${selectedService.label} listener ${enabled?'enabled':'disabled'} on ${serviceProtocol(selectedService)}.`);}}>{selectedService.enabled?'DISABLE LISTENER':'ENABLE LISTENER'}</button></div>}\n      <div className=\"builder-service-strip\">{services.map((service) => <span key={service.id} data-enabled={service.enabled}><b>{service.kind.toUpperCase()}</b>{serviceProtocol(service)} · {service.hostname ?? 'NO NAME'} · {service.enabled?'LISTENING':'CLOSED'}</span>)}</div>")

css = 'src/BuilderApplicationPanel.css'
text = read(css)
marker = '.builder-service-config{'
if marker not in text:
    text += "\n.builder-service-config{display:grid;grid-template-columns:minmax(220px,1.4fr) minmax(220px,1fr) auto;gap:10px;align-items:end;padding:12px 20px;border-bottom:1px solid rgba(149,96,70,.13);background:rgba(104,84,72,.025)}.builder-service-config>div span,.builder-service-config label{font-size:8px;letter-spacing:.1em;font-weight:800;color:#806b60}.builder-service-config>div strong,.builder-service-config>div small{display:block}.builder-service-config>div strong{margin-top:5px;font-size:11px;color:#322d2a}.builder-service-config>div small{margin-top:4px;font-size:8px;line-height:1.4;color:#766860}.builder-service-config input{display:block;width:100%;box-sizing:border-box;margin-top:5px;border:1px solid rgba(149,96,70,.22);background:#fff;padding:8px;font:800 9px inherit}.builder-service-config button{border:1px solid #36302d;background:#36302d;color:#fff;padding:10px 12px;font:800 9px inherit;letter-spacing:.06em;cursor:pointer}.builder-service-config button[data-enabled=false]{background:#fff;color:#36302d}.builder-service-strip span[data-enabled=false]{opacity:.58;border-style:dashed}.builder-app-panel input:focus-visible{outline:2px solid #94634d;outline-offset:2px}@media(max-width:900px){.builder-service-config{grid-template-columns:1fr}.builder-service-config button{width:100%}}\n"
    write(css, text)

# ---------------------------------------------------------------------------
# Workbench projects canonical hosted-service configuration.
# ---------------------------------------------------------------------------
workbench = 'src/builder/device-workbench.ts'
replace_once(workbench,
"import type { BuilderAddressing } from './addressing.ts';\n",
"import type { BuilderAddressing } from './addressing.ts';\nimport type { BuilderHostedService } from './application.ts';\n")
replace_once(workbench,
"  graph: BuilderGraph;\n  linkProfiles?: BuilderLinkProfiles;",
"  graph: BuilderGraph;\n  services?: BuilderHostedService[];\n  linkProfiles?: BuilderLinkProfiles;")
replace_once(workbench,
"  const policyRows:BuilderWorkbenchRow[]=[];\n  if(node.kind==='router'){
",
"  const serviceRows:BuilderWorkbenchRow[]=node.kind==='endpoint'?(input.services??[]).filter((service)=>service.nodeId===deviceId).map((service)=>row(`cfg:service:${service.id}`,'HOSTED SERVICE',`${service.label} · ${service.enabled?'LISTENING':'CLOSED'}`,`${service.hostname??'NO DETERMINISTIC NAME'} · ${service.kind.toUpperCase()}/${service.port}`,service.enabled&&service.hostname?'good':service.enabled||service.hostname?'warn':'bad',[why(`cfg:service:${service.id}:name`,'CONFIG','DNS NAME',service.hostname?`${service.hostname} is the canonical deterministic service name.`:'No deterministic hostname is configured; the application transaction stops at DNS.'),why(`cfg:service:${service.id}:listener`,'CONFIG','LISTENER',service.enabled?`${service.kind.toUpperCase()} listener is enabled on port ${service.port}.`:`Listener is disabled on port ${service.port}; lower layers may still reach this endpoint.`)])):[];\n  const policyRows:BuilderWorkbenchRow[]=[];\n  if(node.kind==='router'){
")
replace_once(workbench,
"  return [section('interfaces','INTERFACES',[...ipv4,...ipv6,...gateways],'No routed interfaces are configured.'),section('routing-config','ROUTING / CONTROL PLANE',routingRows,'This endpoint has no router control-plane configuration.'),section('policy-config','POLICY / EDGE SERVICES',policyRows,'No explicit policy or edge-service configuration applies to this device.')];",
"  return [section('interfaces','INTERFACES',[...ipv4,...ipv6,...gateways],'No routed interfaces are configured.'),section('services-config','HOSTED SERVICES',serviceRows,'No canonical hosted services are configured on this endpoint.'),section('routing-config','ROUTING / CONTROL PLANE',routingRows,'This endpoint has no router control-plane configuration.'),section('policy-config','POLICY / EDGE SERVICES',policyRows,'No explicit policy or edge-service configuration applies to this device.')];")

# ---------------------------------------------------------------------------
# Track J DNS + transport challenge producers/scoring.
# ---------------------------------------------------------------------------
challenges = 'src/builder/challenges.ts'
replace_once(challenges,
"import { interfacesForBuilderNode, validateBuilderAddressing, type BuilderAddressing } from './addressing.ts';\n",
"import { interfacesForBuilderNode, validateBuilderAddressing, type BuilderAddressing } from './addressing.ts';\nimport { upsertBuilderHostedService, type BuilderApplicationFamily, type BuilderApplicationTruthBoundary, type BuilderHostedService } from './application.ts';\n")
replace_once(challenges,
"export type BuilderChallengeBoundary = 'ADDRESSING' | 'L2' | 'ROUTING' | 'POLICY' | 'TRANSPORT';",
"export type BuilderChallengeBoundary = 'ADDRESSING' | 'DNS' | 'L2' | 'ROUTING' | 'POLICY' | 'TRANSPORT';")
replace_once(challenges,
"export type BuilderChallengeEvidenceKind = 'ping' | 'traceroute' | 'ethernet-flow' | 'arp-resolution' | 'nat-flow' | 'dhcp-transaction' | 'ipv6-nd' | 'inspect-config' | 'inspect-state' | 'inspect-events';",
"export type BuilderChallengeEvidenceKind = 'ping' | 'traceroute' | 'ethernet-flow' | 'arp-resolution' | 'nat-flow' | 'dhcp-transaction' | 'ipv6-nd' | 'application-transaction' | 'inspect-config' | 'inspect-state' | 'inspect-events';")
replace_once(challenges,
"export type BuilderChallengeFamily = 'gateway' | 'access-vlan' | 'trunk-vlan' | 'stp-loop' | 'static-route' | 'ospf-disabled' | 'acl-deny' | 'nat-disabled' | 'dhcp-gateway' | 'ipv6-pmtu';",
"export type BuilderChallengeFamily = 'gateway' | 'access-vlan' | 'trunk-vlan' | 'stp-loop' | 'static-route' | 'ospf-disabled' | 'acl-deny' | 'nat-disabled' | 'dhcp-gateway' | 'ipv6-pmtu' | 'dns-name' | 'transport-listener';")
replace_once(challenges,
"export type BuilderChallengeFault = BuilderGatewayChallengeFault | BuilderAccessVlanChallengeFault | BuilderTrunkVlanChallengeFault | BuilderStpChallengeFault | BuilderStaticRouteChallengeFault | BuilderOspfDisabledChallengeFault | BuilderAclDenyChallengeFault | BuilderNatDisabledChallengeFault | BuilderDhcpGatewayChallengeFault | BuilderIpv6PmtuChallengeFault;",
"export interface BuilderDnsNameChallengeFault {\n  kind: 'service-hostname-missing';\n  boundary: 'DNS';\n  plane: 'routed';\n  nodeId: string;\n  serviceId: string;\n  expectedHostname: string;\n}\n\nexport interface BuilderTransportListenerChallengeFault {\n  kind: 'service-listener-disabled';\n  boundary: 'TRANSPORT';\n  plane: 'routed';\n  nodeId: string;\n  serviceId: string;\n  expectedEnabled: true;\n  port: number;\n}\n\nexport type BuilderChallengeFault = BuilderGatewayChallengeFault | BuilderAccessVlanChallengeFault | BuilderTrunkVlanChallengeFault | BuilderStpChallengeFault | BuilderStaticRouteChallengeFault | BuilderOspfDisabledChallengeFault | BuilderAclDenyChallengeFault | BuilderNatDisabledChallengeFault | BuilderDhcpGatewayChallengeFault | BuilderIpv6PmtuChallengeFault | BuilderDnsNameChallengeFault | BuilderTransportListenerChallengeFault;")
replace_once(challenges,
"  kind: 'routed-probe' | 'ethernet-flow' | 'nat-translation' | 'dhcp-configuration' | 'ipv6-pmtu';\n  sourceId: string;\n  destinationId: string;\n  packetBytes?: number;",
"  kind: 'routed-probe' | 'ethernet-flow' | 'nat-translation' | 'dhcp-configuration' | 'ipv6-pmtu' | 'application-transaction';\n  sourceId: string;\n  destinationId: string;\n  packetBytes?: number;\n  serviceId?: string;\n  family?: BuilderApplicationFamily;")
replace_once(challenges,
"  ndResolutionCount?: number | null;\n  repaired: boolean;",
"  ndResolutionCount?: number | null;\n  serviceId?: string | null;\n  applicationBoundary?: BuilderApplicationTruthBoundary | null;\n  repaired: boolean;")
replace_all(challenges,
"    ipv6: scenario.ipv6,\n    sourceId:",
"    ipv6: scenario.ipv6,\n    services: scenario.services,\n    sourceId:")

# Insert application challenge factories before generic dispatch.
replace_once(challenges,
"export function createBuilderChallenge(seedInput: string): BuilderChallenge {",
"export function createDnsNameChallenge(seedInput: string): BuilderChallenge {\n  const seed = normalizeSeed(seedInput);\n  const hash = hashSeed(seed);\n  const healthy = defaultHealthySnapshot();\n  healthy.sourceId = 'client'; healthy.destinationId = 'app';\n  const services = healthy.services ?? [];\n  const candidates = services.filter((service) => service.nodeId === 'app' && service.kind !== 'dns' && Boolean(service.hostname)).sort((a,b)=>a.id.localeCompare(b.id));\n  const service = candidates[hash % candidates.length];\n  if (!service?.hostname) throw new Error('The DNS challenge requires a canonical named application service on APP.');\n  const expectedHostname = service.hostname;\n  const broken = createBuilderAuthoringSnapshot(healthy);\n  broken.services = upsertBuilderHostedService(broken.graph, broken.services ?? [], { ...service, hostname: null });\n  return { schema: BUILDER_CHALLENGE_SCHEMA, version: BUILDER_CHALLENGE_VERSION, id: 'dns-' + hash.toString(16).padStart(8,'0'), seed, family: 'dns-name', title: 'SERVICE NAME DOES NOT RESOLVE', objective: `Restore the deterministic DNS name for ${service.label} on APP. Use the ordinary application transaction and Device Workbench to prove lower layers were never reached, repair canonical hosted-service configuration, then rerun the exact service request.`, difficulty: 'FOUNDATION', healthy, broken, verification: { kind:'application-transaction', sourceId:'client', destinationId:'app', serviceId:service.id, family:'ipv4' }, fault: { kind:'service-hostname-missing', boundary:'DNS', plane:'routed', nodeId:'app', serviceId:service.id, expectedHostname } };\n}\n\nexport function createTransportListenerChallenge(seedInput: string): BuilderChallenge {\n  const seed = normalizeSeed(seedInput);\n  const hash = hashSeed(seed);\n  const healthy = defaultHealthySnapshot();\n  healthy.sourceId = 'client'; healthy.destinationId = 'app';\n  const services = healthy.services ?? [];\n  const candidates = services.filter((service) => service.nodeId === 'app' && service.enabled && Boolean(service.hostname) && ['http','https','ssh','tcp'].includes(service.kind) && !(service.kind === 'https' && service.transportProfile === 'quic-h3')).sort((a,b)=>a.id.localeCompare(b.id));\n  const service = candidates[hash % candidates.length];\n  if (!service) throw new Error('The transport challenge requires a canonical named TCP service on APP.');\n  const broken = createBuilderAuthoringSnapshot(healthy);\n  broken.services = upsertBuilderHostedService(broken.graph, broken.services ?? [], { ...service, enabled: false });\n  return { schema: BUILDER_CHALLENGE_SCHEMA, version: BUILDER_CHALLENGE_VERSION, id: 'transport-' + hash.toString(16).padStart(8,'0'), seed, family: 'transport-listener', title: 'SERVICE PORT IS CLOSED', objective: `Restore the ${service.label} listener on APP. Use the ordinary application transaction to prove DNS, L2, routing, policy, and link truth reach the endpoint before transport fails; repair canonical listener configuration and rerun the exact service request.`, difficulty: 'FOUNDATION', healthy, broken, verification: { kind:'application-transaction', sourceId:'client', destinationId:'app', serviceId:service.id, family:'ipv4' }, fault: { kind:'service-listener-disabled', boundary:'TRANSPORT', plane:'routed', nodeId:'app', serviceId:service.id, expectedEnabled:true, port:service.port } };\n}\n\nexport function createBuilderChallenge(seedInput: string): BuilderChallenge {")
replace_once(challenges,
"  if (lowered.startsWith('mtu-') || lowered.startsWith('pmtu-') || lowered.startsWith('ipv6-mtu-')) return createIpv6PmtuChallenge(seed);\n  return createDefaultGatewayChallenge(seed);",
"  if (lowered.startsWith('mtu-') || lowered.startsWith('pmtu-') || lowered.startsWith('ipv6-mtu-')) return createIpv6PmtuChallenge(seed);\n  if (lowered.startsWith('dns-')) return createDnsNameChallenge(seed);\n  if (lowered.startsWith('transport-') || lowered.startsWith('tcp-') || lowered.startsWith('listener-')) return createTransportListenerChallenge(seed);\n  return createDefaultGatewayChallenge(seed);")
replace_once(challenges,
"export function builderChallengeIsRepaired(challenge: BuilderChallenge, addressing: BuilderAddressing, ethernet: BuilderEthernetConfig, routing: BuilderRoutingConfig, acl: BuilderAclConfig = challenge.broken.acl, nat: BuilderNatConfig = challenge.broken.nat, dhcp: BuilderDhcpConfig = challenge.broken.dhcp, linkProfiles: BuilderLinkProfiles = challenge.broken.linkProfiles): boolean {",
"export function builderChallengeIsRepaired(challenge: BuilderChallenge, addressing: BuilderAddressing, ethernet: BuilderEthernetConfig, routing: BuilderRoutingConfig, acl: BuilderAclConfig = challenge.broken.acl, nat: BuilderNatConfig = challenge.broken.nat, dhcp: BuilderDhcpConfig = challenge.broken.dhcp, linkProfiles: BuilderLinkProfiles = challenge.broken.linkProfiles, services: readonly BuilderHostedService[] = challenge.broken.services ?? []): boolean {")
replace_once(challenges,
"  if (fault.kind === 'dhcp-gateway-option-missing') {\n    const pool = dhcp.pools.find((entry) => entry.id === fault.poolId && entry.serverDeviceId === fault.nodeId);\n    return pool?.gateway === fault.expectedGateway;\n  }\n  return linkProfiles[fault.linkId]?.mtuBytes === fault.expectedMtuBytes;",
"  if (fault.kind === 'dhcp-gateway-option-missing') {\n    const pool = dhcp.pools.find((entry) => entry.id === fault.poolId && entry.serverDeviceId === fault.nodeId);\n    return pool?.gateway === fault.expectedGateway;\n  }\n  if (fault.kind === 'path-mtu-reduced') return linkProfiles[fault.linkId]?.mtuBytes === fault.expectedMtuBytes;\n  const service = services.find((entry) => entry.id === fault.serviceId && entry.nodeId === fault.nodeId);\n  if (fault.kind === 'service-hostname-missing') return service?.hostname === fault.expectedHostname;\n  return service?.enabled === fault.expectedEnabled;")
replace_once(challenges,
"  if (fault.kind === 'dhcp-gateway-option-missing') return `${fault.nodeId.toUpperCase()} ACKed the DHCP lease without a default-gateway option. Restoring ${fault.expectedGateway} to the canonical pool and reacquiring produced a configuration-ready lease.`;\n  return `${fault.linkId.toUpperCase()} was reduced to MTU ${fault.brokenMtuBytes}. Restoring MTU ${fault.expectedMtuBytes}, clearing stale PMTU state, and retransmitting ${fault.packetBytes} bytes proved full-size IPv6 delivery while Neighbor Discovery remained healthy.`;",
"  if (fault.kind === 'dhcp-gateway-option-missing') return `${fault.nodeId.toUpperCase()} ACKed the DHCP lease without a default-gateway option. Restoring ${fault.expectedGateway} to the canonical pool and reacquiring produced a configuration-ready lease.`;\n  if (fault.kind === 'path-mtu-reduced') return `${fault.linkId.toUpperCase()} was reduced to MTU ${fault.brokenMtuBytes}. Restoring MTU ${fault.expectedMtuBytes}, clearing stale PMTU state, and retransmitting ${fault.packetBytes} bytes proved full-size IPv6 delivery while Neighbor Discovery remained healthy.`;\n  if (fault.kind === 'service-hostname-missing') return `${fault.serviceId} had no deterministic hostname. Restoring ${fault.expectedHostname} repaired the DNS intent boundary; the post-repair application transaction then traversed the normal lower-layer and service stack.`;\n  return `${fault.serviceId} had its canonical listener disabled on port ${fault.port}. Re-enabling the listener repaired the transport boundary after DNS/routing/policy/link truth had already reached ${fault.nodeId.toUpperCase()}.`;")
replace_once(challenges,
"function isObjectiveEvidence(challenge: BuilderChallenge, entry: BuilderChallengeEvidence): boolean {\n  return entry.sourceId === challenge.verification.sourceId && entry.destinationId === challenge.verification.destinationId;\n}",
"function isObjectiveEvidence(challenge: BuilderChallenge, entry: BuilderChallengeEvidence): boolean {\n  if (entry.sourceId !== challenge.verification.sourceId || entry.destinationId !== challenge.verification.destinationId) return false;\n  return challenge.verification.kind !== 'application-transaction' || entry.serviceId === challenge.verification.serviceId;\n}")
replace_once(challenges,
"  linkProfiles: BuilderLinkProfiles = challenge.broken.linkProfiles,\n): BuilderChallengeScore {",
"  linkProfiles: BuilderLinkProfiles = challenge.broken.linkProfiles,\n  services: readonly BuilderHostedService[] = challenge.broken.services ?? [],\n): BuilderChallengeScore {")
replace_once(challenges,
"  } else {\n    const incompleteConfiguration = hasEvidence(evidence, (entry) => entry.kind === 'dhcp-transaction' && isObjectiveEvidence(challenge, entry) && entry.success === false && !entry.repaired);\n    evidenceScore = (incompleteConfiguration ? 20 : 0) + (inspectedState ? 10 : 0) + (inspectedConfig ? 10 : 0);\n    hasPrimaryDiagnostic = incompleteConfiguration;\n  }",
"  } else if (challenge.verification.kind === 'application-transaction') {\n    const failedApplication = hasEvidence(evidence, (entry) => entry.kind === 'application-transaction' && isObjectiveEvidence(challenge, entry) && entry.success === false && entry.applicationBoundary === challenge.fault.boundary && !entry.repaired);\n    evidenceScore = (failedApplication ? 20 : 0) + (inspectedState ? 10 : 0) + (inspectedConfig ? 10 : 0);\n    hasPrimaryDiagnostic = failedApplication;\n  } else {\n    const incompleteConfiguration = hasEvidence(evidence, (entry) => entry.kind === 'dhcp-transaction' && isObjectiveEvidence(challenge, entry) && entry.success === false && !entry.repaired);\n    evidenceScore = (incompleteConfiguration ? 20 : 0) + (inspectedState ? 10 : 0) + (inspectedConfig ? 10 : 0);\n    hasPrimaryDiagnostic = incompleteConfiguration;\n  }")
replace_once(challenges,
"  const repaired = builderChallengeIsRepaired(challenge, addressing, ethernet, routing, acl, nat, dhcp, linkProfiles);",
"  const repaired = builderChallengeIsRepaired(challenge, addressing, ethernet, routing, acl, nat, dhcp, linkProfiles, services);")
replace_once(challenges,
"        : challenge.verification.kind === 'ipv6-pmtu'\n          ? hasEvidence(evidence, (entry) => (entry.kind === 'ping' || entry.kind === 'traceroute') && isObjectiveEvidence(challenge, entry) && entry.success === true && entry.repaired && entry.requestedBytes === (challenge.verification.packetBytes ?? 1500) && entry.effectiveBytes === (challenge.verification.packetBytes ?? 1500))\n          : hasEvidence(evidence, (entry) => entry.kind === 'dhcp-transaction' && isObjectiveEvidence(challenge, entry) && entry.success === true && entry.repaired);",
"        : challenge.verification.kind === 'ipv6-pmtu'\n          ? hasEvidence(evidence, (entry) => (entry.kind === 'ping' || entry.kind === 'traceroute') && isObjectiveEvidence(challenge, entry) && entry.success === true && entry.repaired && entry.requestedBytes === (challenge.verification.packetBytes ?? 1500) && entry.effectiveBytes === (challenge.verification.packetBytes ?? 1500))\n          : challenge.verification.kind === 'application-transaction'\n            ? hasEvidence(evidence, (entry) => entry.kind === 'application-transaction' && isObjectiveEvidence(challenge, entry) && entry.success === true && entry.repaired)\n            : hasEvidence(evidence, (entry) => entry.kind === 'dhcp-transaction' && isObjectiveEvidence(challenge, entry) && entry.success === true && entry.repaired);")

# Challenge panel exposes DNS hypothesis and application instructions.
challenge_panel = 'src/BuilderChallengePanel.tsx'
replace_once(challenge_panel,
"const BOUNDARIES: BuilderChallengeBoundary[] = ['ADDRESSING', 'L2', 'ROUTING', 'POLICY', 'TRANSPORT'];",
"const BOUNDARIES: BuilderChallengeBoundary[] = ['ADDRESSING', 'DNS', 'L2', 'ROUTING', 'POLICY', 'TRANSPORT'];")
replace_once(challenge_panel,
"  if (entry.kind === 'ipv6-nd') return 'IPV6 ND';",
"  if (entry.kind === 'ipv6-nd') return 'IPV6 ND';\n  if (entry.kind === 'application-transaction') return 'APP REQUEST';")
replace_once(challenge_panel,
"            : verificationKind === 'ipv6-pmtu'\n              ? 'Run the ordinary IPv6 Ping / Traceroute at the challenge packet size. Use NS/NA plus Packet Too Big / PMTU state to separate healthy neighbor resolution from the MTU failure, inspect CONFIG / STATE / EVENTS, repair the selected routed-link MTU, clear stale PMTU cache, then prove the same full-size packet is actually transmitted.'\n              : 'Run the ordinary DHCP DORA / ACQUIRE flow and inspect CONFIG / STATE / EVENTS in Device Workbench. An ACK with incomplete options is failed objective evidence. Repair the pool default-gateway option, then reacquire a configuration-ready lease.'}</p>",
"            : verificationKind === 'ipv6-pmtu'\n              ? 'Run the ordinary IPv6 Ping / Traceroute at the challenge packet size. Use NS/NA plus Packet Too Big / PMTU state to separate healthy neighbor resolution from the MTU failure, inspect CONFIG / STATE / EVENTS, repair the selected routed-link MTU, clear stale PMTU cache, then prove the same full-size packet is actually transmitted.'\n              : verificationKind === 'application-transaction'\n                ? 'Run the ordinary APPLICATION REQUEST for the selected challenge service and inspect APP CONFIG / STATE in Device Workbench. The causal stack identifies whether DNS or transport failed first. Repair the canonical hostname/listener in the normal hosted-service controls, then rerun the exact service objective.'\n                : 'Run the ordinary DHCP DORA / ACQUIRE flow and inspect CONFIG / STATE / EVENTS in Device Workbench. An ACK with incomplete options is failed objective evidence. Repair the pool default-gateway option, then reacquire a configuration-ready lease.'}</p>")

# ---------------------------------------------------------------------------
# NetworkBuilder owns/persists service state and records ordinary app evidence.
# ---------------------------------------------------------------------------
builder = 'src/NetworkBuilder.tsx'
replace_once(builder,
"import type { BuilderApplicationTransaction } from './builder/application.ts';",
"import { cloneBuilderHostedServices, createDefaultBuilderHostedServices, reconcileBuilderHostedServices, type BuilderApplicationTransaction, type BuilderHostedService } from './builder/application.ts';")
replace_once(builder,
"initialNat, initialDhcp, initialIpv6, initialSourceId",
"initialNat, initialDhcp, initialIpv6, initialServices, initialSourceId")
replace_once(builder,
"initialNat?: BuilderNatConfig; initialDhcp?: BuilderDhcpConfig; initialIpv6?: BuilderIpv6Config; initialSourceId?: string;",
"initialNat?: BuilderNatConfig; initialDhcp?: BuilderDhcpConfig; initialIpv6?: BuilderIpv6Config; initialServices?: BuilderHostedService[]; initialSourceId?: string;")
replace_once(builder,
"  const [dhcp, setDhcp] = useState<BuilderDhcpConfig>(() => cloneBuilderDhcpConfig(initialDhcp ?? createDefaultBuilderDhcpConfig(initialEthernet ?? (stressLabel ? createEmptyBuilderEthernetConfig() : createDefaultBuilderEthernetConfig()))));\n  const [dhcpLeases",
"  const [dhcp, setDhcp] = useState<BuilderDhcpConfig>(() => cloneBuilderDhcpConfig(initialDhcp ?? createDefaultBuilderDhcpConfig(initialEthernet ?? (stressLabel ? createEmptyBuilderEthernetConfig() : createDefaultBuilderEthernetConfig()))));\n  const [services, setServices] = useState<BuilderHostedService[]>(() => cloneBuilderHostedServices(initialGraph, initialServices ?? createDefaultBuilderHostedServices(initialGraph)));\n  const [dhcpLeases")
replace_once(builder,
"({ graph, linkProfiles, addressing, routing, ipv6, ipv6ControlState, ipv6RoutingDepth, ethernet, ethernetFlow, arpCache, arpResolutions, acl, nat, natSessions, dhcp, dhcpLeases, dhcpSequence, probeHistory, applicationHistory, applicationStageOrder:null, sourceId, destinationId, events: workbenchEvents }), [graph, linkProfiles, addressing, routing, ipv6, ipv6ControlState, ipv6RoutingDepth, ethernet, ethernetFlow, arpCache, arpResolutions, acl, nat, natSessions, dhcp, dhcpLeases, dhcpSequence, probeHistory, applicationHistory, sourceId, destinationId, workbenchEvents]",
"({ graph, services, linkProfiles, addressing, routing, ipv6, ipv6ControlState, ipv6RoutingDepth, ethernet, ethernetFlow, arpCache, arpResolutions, acl, nat, natSessions, dhcp, dhcpLeases, dhcpSequence, probeHistory, applicationHistory, applicationStageOrder:null, sourceId, destinationId, events: workbenchEvents }), [graph, services, linkProfiles, addressing, routing, ipv6, ipv6ControlState, ipv6RoutingDepth, ethernet, ethernetFlow, arpCache, arpResolutions, acl, nat, natSessions, dhcp, dhcpLeases, dhcpSequence, probeHistory, applicationHistory, sourceId, destinationId, workbenchEvents]")
replace_once(builder,
"challenge ? scoreBuilderChallenge(challenge, challengeEvidence, challengeHypothesis, addressing, ethernet, routing, acl, nat, dhcp, linkProfiles) : null",
"challenge ? scoreBuilderChallenge(challenge, challengeEvidence, challengeHypothesis, addressing, ethernet, routing, acl, nat, dhcp, linkProfiles, services) : null")
replace_once(builder,
"[challenge, challengeEvidence, challengeHypothesis, addressing, ethernet, routing, acl, nat, dhcp, linkProfiles]",
"[challenge, challengeEvidence, challengeHypothesis, addressing, ethernet, routing, acl, nat, dhcp, linkProfiles, services]")
replace_once(builder,
"    setNat(reconcileBuilderNatConfig(next, nat));\n    setNatSessions(clearBuilderNatSessions());",
"    setNat(reconcileBuilderNatConfig(next, nat));\n    setServices(reconcileBuilderHostedServices(next, services));\n    setNatSessions(clearBuilderNatSessions());")
replace_once(builder,
"setNat(cloneBuilderNatConfig(next.nat)); setDhcp(cloneBuilderDhcpConfig(next.dhcp));",
"setNat(cloneBuilderNatConfig(next.nat)); setDhcp(cloneBuilderDhcpConfig(next.dhcp)); setServices(cloneBuilderHostedServices(next.graph,next.services??createDefaultBuilderHostedServices(next.graph)));")
replace_once(builder,
"createBuilderAuthoringSnapshot({ graph, addressing, routing, ethernet, linkProfiles, acl, nat, dhcp, ipv6, sourceId, destinationId, layout })",
"createBuilderAuthoringSnapshot({ graph, addressing, routing, ethernet, linkProfiles, acl, nat, dhcp, ipv6, services, sourceId, destinationId, layout })")
replace_all(builder,
"builderChallengeIsRepaired(challenge,addressing,ethernet,routing,acl,nat,dhcp,linkProfiles)",
"builderChallengeIsRepaired(challenge,addressing,ethernet,routing,acl,nat,dhcp,linkProfiles,services)")
replace_all(builder,
"builderChallengeIsRepaired(challenge, addressing, ethernet, routing, acl, nat, dhcp, linkProfiles)",
"builderChallengeIsRepaired(challenge, addressing, ethernet, routing, acl, nat, dhcp, linkProfiles, services)")
replace_once(builder,
"}else if(next.verification.kind==='ipv6-pmtu'){setSourceId(next.verification.sourceId);setDestinationId(next.verification.destinationId);setProbeFamily('ipv6');setIpv6ProbePacketBytes(next.verification.packetBytes??1500);setWorkbenchDevice({plane:'routed',id:next.fault.nodeId});setSelectedNodeId(next.fault.nodeId);if('linkId' in next.fault)setSelectedLinkId(next.fault.linkId);}else{",
"}else if(next.verification.kind==='ipv6-pmtu'){setSourceId(next.verification.sourceId);setDestinationId(next.verification.destinationId);setProbeFamily('ipv6');setIpv6ProbePacketBytes(next.verification.packetBytes??1500);setWorkbenchDevice({plane:'routed',id:next.fault.nodeId});setSelectedNodeId(next.fault.nodeId);if('linkId' in next.fault)setSelectedLinkId(next.fault.linkId);}else if(next.verification.kind==='application-transaction'){setSourceId(next.verification.sourceId);setDestinationId(next.verification.destinationId);setWorkbenchDevice({plane:'routed',id:next.fault.nodeId});setSelectedNodeId(next.fault.nodeId);}else{")
replace_once(builder,
"}else if(challenge.verification.kind==='ipv6-pmtu'){setSourceId(challenge.verification.sourceId);setDestinationId(challenge.verification.destinationId);setProbeFamily('ipv6');setIpv6ProbePacketBytes(challenge.verification.packetBytes??1500);setWorkbenchDevice({plane:'routed',id:challenge.fault.nodeId});setSelectedNodeId(challenge.fault.nodeId);if('linkId' in challenge.fault)setSelectedLinkId(challenge.fault.linkId);}else{",
"}else if(challenge.verification.kind==='ipv6-pmtu'){setSourceId(challenge.verification.sourceId);setDestinationId(challenge.verification.destinationId);setProbeFamily('ipv6');setIpv6ProbePacketBytes(challenge.verification.packetBytes??1500);setWorkbenchDevice({plane:'routed',id:challenge.fault.nodeId});setSelectedNodeId(challenge.fault.nodeId);if('linkId' in challenge.fault)setSelectedLinkId(challenge.fault.linkId);}else if(challenge.verification.kind==='application-transaction'){setSourceId(challenge.verification.sourceId);setDestinationId(challenge.verification.destinationId);setWorkbenchDevice({plane:'routed',id:challenge.fault.nodeId});setSelectedNodeId(challenge.fault.nodeId);}else{")
# Persist services in save/export/BGP projection snapshots.
replace_all(builder,
"acl, nat, dhcp, ipv6);",
"acl, nat, dhcp, ipv6, services);")
replace_once(builder,
"Scenario v9 exported with dual-stack routed topology, OSPF/BGP control-plane configuration, link characteristics, ACL/NAT policy, Ethernet/STP, and DHCP configuration;",
"Scenario v9 exported with dual-stack routed topology, OSPF/BGP control-plane configuration, link characteristics, ACL/NAT policy, Ethernet/STP, DHCP, and hosted-service configuration;")
replace_once(builder,
"Restored “${scenario.name}”. IPv4/IPv6 routing, link characteristics, ACL/NAT, VLAN, and STP configuration restored;",
"Restored “${scenario.name}”. IPv4/IPv6 routing, link characteristics, ACL/NAT, VLAN/STP, DHCP, and hosted-service configuration restored;")
# Application panel props/evidence.
replace_once(builder,
"            context={{ graph, addressing, routing, ethernet, linkProfiles, acl, nat, natSessions, dhcp, dhcpLeases, dhcpSequence, ipv6, ipv6ControlState, ipv6RoutingDepth, arpCache }}\n            sourceNodeId={sourceId}\n            historical={isHistorical}\n            onSessionState={(next)=>{ setArpCache(next.arpCache); setNatSessions(next.natSessions); setDhcpLeases(next.dhcpLeases); setIpv6ControlState(next.ipv6ControlState); }}\n            onTransaction={(transaction)=>setApplicationHistory((current)=>[...current,transaction].slice(-24))}\n            onMessage={setMessage}",
"            context={{ graph, addressing, routing, ethernet, linkProfiles, acl, nat, natSessions, dhcp, dhcpLeases, dhcpSequence, ipv6, ipv6ControlState, ipv6RoutingDepth, arpCache }}\n            sourceNodeId={sourceId}\n            services={services}\n            onServicesChange={setServices}\n            preferredServiceId={challenge?.verification.kind==='application-transaction'?challenge.verification.serviceId??null:null}\n            historical={isHistorical}\n            onSessionState={(next)=>{ setArpCache(next.arpCache); setNatSessions(next.natSessions); setDhcpLeases(next.dhcpLeases); setIpv6ControlState(next.ipv6ControlState); }}\n            onTransaction={(transaction)=>{setApplicationHistory((current)=>[...current,transaction].slice(-24));if(!challenge||challenge.verification.kind!=='application-transaction'||isHistorical)return;const repaired=builderChallengeIsRepaired(challenge,addressing,ethernet,routing,acl,nat,dhcp,linkProfiles,services);setChallengeEvidence((current)=>appendBuilderChallengeEvidence(current,{kind:'application-transaction',sourceId:transaction.sourceNodeId,destinationId:transaction.destinationNodeId,serviceId:transaction.service.id,success:transaction.success,applicationBoundary:transaction.firstBrokenBoundary,repaired,detail:transaction.summary}));}}\n            onMessage={setMessage}")
# Launcher buttons and note.
replace_once(builder,
"<button type=\"button\" onClick={()=>setChallengeSeed('mtu-001')}>IPV6 MTU</button></div>",
"<button type=\"button\" onClick={()=>setChallengeSeed('mtu-001')}>IPV6 MTU</button><button type=\"button\" onClick={()=>setChallengeSeed('dns-001')}>DNS</button><button type=\"button\" onClick={()=>setChallengeSeed('transport-001')}>TRANSPORT</button></div>")
replace_once(builder,
"GATEWAY / VLAN / TRUNK / STP / STATIC / OSPF / ACL / NAT / DHCP / IPV6 MTU · NORMAL BUILDER PROBES, ARP/ND, LAN FLOW, NAT FLOW, DHCP DORA, PMTUD, POLICY/ROUTE STATE, WORKBENCH, AND CONFIG CONTROLS",
"GATEWAY / VLAN / TRUNK / STP / STATIC / OSPF / ACL / NAT / DHCP / IPV6 MTU / DNS / TRANSPORT · NORMAL BUILDER PROBES, ARP/ND, LAN FLOW, NAT FLOW, DHCP DORA, PMTUD, APPLICATION REQUESTS, POLICY/ROUTE STATE, WORKBENCH, AND CONFIG CONTROLS")

# ---------------------------------------------------------------------------
# Contract coverage.
# ---------------------------------------------------------------------------
app_test = 'scripts/builder-application-contract-check.mjs'
replace_once(app_test,
"import { createDefaultBuilderHostedServices, runBuilderApplicationTransaction } from '../src/builder/application.ts';",
"import { createDefaultBuilderHostedServices, runBuilderApplicationTransaction, upsertBuilderHostedService } from '../src/builder/application.ts';")
replace_once(app_test,
"const sourceAddress = interfacesForBuilderNode(addressing, 'client')[0]?.address;",
"const missingNameServices = upsertBuilderHostedService(graph, services, { ...h2, hostname: null });\nconst missingName = runBuilderApplicationTransaction(base, missingNameServices, 'client', h2.id, 'ipv4', 61);\nassert.equal(missingName.success, false);\nassert.equal(missingName.firstBrokenBoundary, 'DNS');\nassert.equal(missingName.stages.find((stage) => stage.id === 'dns')?.status, 'FAIL');\nfor (const id of ['l2-resolution','routing','policy-nat','link','transport','tls','application','response']) assert.equal(missingName.stages.find((stage)=>stage.id===id)?.status,'NOT_REACHED',`${id} must remain NOT_REACHED after DNS failure`);\nassert.equal(missingName.protocolEvents.length, 0, 'DNS failure must not project an established transport theater');\nassert.equal(missingName.packets.length, 0, 'DNS failure must not fabricate packet bytes beyond the unresolved service intent');\n\nconst closedListenerServices = upsertBuilderHostedService(graph, services, { ...h2, enabled: false });\nconst closedListener = runBuilderApplicationTransaction(base, closedListenerServices, 'client', h2.id, 'ipv4', 65);\nassert.equal(closedListener.success, false);\nassert.equal(closedListener.firstBrokenBoundary, 'TRANSPORT');\nassert.equal(closedListener.stages.find((stage) => stage.id === 'dns')?.status, 'PASS', 'listener state must not masquerade as DNS truth');\nfor (const id of ['l2-resolution','routing','policy-nat','link']) assert.equal(closedListener.stages.find((stage)=>stage.id===id)?.status,'PASS',`${id} must prove the endpoint is reachable before listener failure`);\nassert.equal(closedListener.stages.find((stage) => stage.id === 'transport')?.status, 'FAIL');\nfor (const id of ['tls','application','response']) assert.equal(closedListener.stages.find((stage)=>stage.id===id)?.status,'NOT_REACHED',`${id} must remain NOT_REACHED after listener failure`);\nassert.equal(closedListener.protocolEvents.length, 0, 'closed listener must not fabricate transport.established');\nassert.equal(closedListener.packets.length, 0, 'closed listener must not fabricate transport packet bytes');\n\nconst sourceAddress = interfacesForBuilderNode(addressing, 'client')[0]?.address;")
replace_once(app_test,
"console.log('Track D application contract passed: hosted DNS/HTTP/HTTPS/SSH/TCP/UDP services, shared DHCP/addressing→L2/ARP/ND→FIB→ACL/NAT→link→canonical TCP/QUIC/TLS/application truth, NOT_REACHED failure semantics, exact Packet bytes, lazy product integration, and Builder/Protocol/Journey/Packet cameras.');",
"console.log('Track D application contract passed: canonical hosted DNS/HTTP/HTTPS/SSH/TCP/UDP services, distinct DNS-name and transport-listener boundaries, shared DHCP/addressing→L2/ARP/ND→FIB→ACL/NAT→link→canonical TCP/QUIC/TLS/application truth, NOT_REACHED failure semantics, exact Packet bytes, lazy product integration, and Builder/Protocol/Journey/Packet cameras.');")

challenge_test = 'scripts/builder-challenge-contract-check.mjs'
replace_once(challenge_test,
"  createDefaultGatewayChallenge,\n  createDhcpGatewayChallenge,",
"  createDefaultGatewayChallenge,\n  createDhcpGatewayChallenge,\n  createDnsNameChallenge,")
replace_once(challenge_test,
"  createTrunkVlanChallenge,\n  scoreBuilderChallenge,",
"  createTrunkVlanChallenge,\n  createTransportListenerChallenge,\n  scoreBuilderChallenge,")
replace_once(challenge_test,
"import { resolveBuilderEthernetFlowArp } from '../src/builder/arp.ts';",
"import { resolveBuilderEthernetFlowArp } from '../src/builder/arp.ts';\nimport { runBuilderApplicationTransaction, upsertBuilderHostedService } from '../src/builder/application.ts';\nimport { clearBuilderArpCache } from '../src/builder/arp.ts';\nimport { clearBuilderDhcpLeases } from '../src/builder/dhcp.ts';\nimport { createBuilderIpv6ControlState } from '../src/builder/ipv6-control-plane.ts';\nimport { createDefaultBuilderIpv6RoutingDepthState } from '../src/builder/ipv6-routing-depth.ts';\nimport { clearBuilderNatSessions } from '../src/builder/nat.ts';")
# Avoid duplicate imports introduced above by collapsing known duplicates.
replace_all(challenge_test,
"import { clearBuilderIpv6PmtuCache, createBuilderIpv6ControlState } from '../src/builder/ipv6-control-plane.ts';",
"import { clearBuilderIpv6PmtuCache } from '../src/builder/ipv6-control-plane.ts';")
replace_all(challenge_test,
"import { runBuilderNatOutboundFlow, validateBuilderNatConfig } from '../src/builder/nat.ts';",
"import { runBuilderNatOutboundFlow, validateBuilderNatConfig } from '../src/builder/nat.ts';")
# Insert helper to run the canonical application transaction from a challenge snapshot.
replace_once(challenge_test,
"function runLan(snapshot, sourceId, destinationId) {",
"function runApplication(snapshot, serviceId, sequence = 1) {\n  return runBuilderApplicationTransaction({ graph:snapshot.graph, addressing:snapshot.addressing, routing:snapshot.routing, ethernet:snapshot.ethernet, linkProfiles:snapshot.linkProfiles, acl:snapshot.acl, nat:snapshot.nat, natSessions:clearBuilderNatSessions(), dhcp:snapshot.dhcp, dhcpLeases:clearBuilderDhcpLeases(), dhcpSequence:1, ipv6:snapshot.ipv6, ipv6ControlState:createBuilderIpv6ControlState(), ipv6RoutingDepth:createDefaultBuilderIpv6RoutingDepthState(snapshot.graph), arpCache:clearBuilderArpCache() }, snapshot.services ?? [], snapshot.sourceId, serviceId, 'ipv4', sequence);\n}\n\nfunction runLan(snapshot, sourceId, destinationId) {")
application_contract = """
const dnsChallenge=createDnsNameChallenge('dns-contract-001');
assert.equal(dnsChallenge.family,'dns-name');
assert.equal(dnsChallenge.fault.kind,'service-hostname-missing');
assert.deepEqual(dnsChallenge,createBuilderChallenge('dns-contract-001'));
const healthyDnsApp=runApplication(dnsChallenge.healthy,dnsChallenge.verification.serviceId,201);
const brokenDnsApp=runApplication(dnsChallenge.broken,dnsChallenge.verification.serviceId,202);
assert.equal(healthyDnsApp.success,true,healthyDnsApp.summary);
assert.equal(brokenDnsApp.success,false);
assert.equal(brokenDnsApp.firstBrokenBoundary,'DNS');
const brokenDnsService=(dnsChallenge.broken.services??[]).find((service)=>service.id===dnsChallenge.fault.serviceId);
assert.ok(brokenDnsService);
const repairedDnsServices=upsertBuilderHostedService(dnsChallenge.broken.graph,dnsChallenge.broken.services??[],{...brokenDnsService,hostname:dnsChallenge.fault.expectedHostname});
assert.deepEqual(repairedDnsServices,dnsChallenge.healthy.services,'DNS challenge removes exactly one canonical hostname');
let dnsEvidence=[];
dnsEvidence=appendBuilderChallengeEvidence(dnsEvidence,{kind:'application-transaction',sourceId:dnsChallenge.verification.sourceId,destinationId:dnsChallenge.verification.destinationId,serviceId:dnsChallenge.verification.serviceId,success:false,applicationBoundary:brokenDnsApp.firstBrokenBoundary,repaired:false,detail:brokenDnsApp.summary});
dnsEvidence=recordInspection(dnsEvidence,dnsChallenge,'state');dnsEvidence=recordInspection(dnsEvidence,dnsChallenge,'config');
const dnsHypothesis={boundary:'DNS',deviceId:dnsChallenge.fault.nodeId};
assert.deepEqual(scoreBuilderChallenge(dnsChallenge,dnsEvidence,dnsHypothesis,dnsChallenge.broken.addressing,dnsChallenge.broken.ethernet,dnsChallenge.broken.routing,dnsChallenge.broken.acl,dnsChallenge.broken.nat,dnsChallenge.broken.dhcp,dnsChallenge.broken.linkProfiles,dnsChallenge.broken.services),{evidence:40,reasoning:20,repair:0,verification:0,total:60,repaired:false,verified:false,solved:false});
assert.equal(scoreBuilderChallenge(dnsChallenge,dnsEvidence,dnsHypothesis,dnsChallenge.broken.addressing,dnsChallenge.broken.ethernet,dnsChallenge.broken.routing,dnsChallenge.broken.acl,dnsChallenge.broken.nat,dnsChallenge.broken.dhcp,dnsChallenge.broken.linkProfiles,repairedDnsServices).total,85);
const healthyDnsOther=(dnsChallenge.healthy.services??[]).find((service)=>service.id!==dnsChallenge.verification.serviceId&&service.hostname);
assert.ok(healthyDnsOther);
const unrelatedDnsApp=runApplication({...dnsChallenge.broken,services:repairedDnsServices},healthyDnsOther.id,203);
dnsEvidence=appendBuilderChallengeEvidence(dnsEvidence,{kind:'application-transaction',sourceId:dnsChallenge.verification.sourceId,destinationId:dnsChallenge.verification.destinationId,serviceId:healthyDnsOther.id,success:unrelatedDnsApp.success,applicationBoundary:unrelatedDnsApp.firstBrokenBoundary,repaired:true,detail:unrelatedDnsApp.summary});
assert.equal(scoreBuilderChallenge(dnsChallenge,dnsEvidence,dnsHypothesis,dnsChallenge.broken.addressing,dnsChallenge.broken.ethernet,dnsChallenge.broken.routing,dnsChallenge.broken.acl,dnsChallenge.broken.nat,dnsChallenge.broken.dhcp,dnsChallenge.broken.linkProfiles,repairedDnsServices).verified,false,'another healthy service cannot verify the DNS objective');
const repairedDnsApp=runApplication({...dnsChallenge.broken,services:repairedDnsServices},dnsChallenge.verification.serviceId,204);
dnsEvidence=appendBuilderChallengeEvidence(dnsEvidence,{kind:'application-transaction',sourceId:dnsChallenge.verification.sourceId,destinationId:dnsChallenge.verification.destinationId,serviceId:dnsChallenge.verification.serviceId,success:true,applicationBoundary:null,repaired:true,detail:repairedDnsApp.summary});
assert.deepEqual(scoreBuilderChallenge(dnsChallenge,dnsEvidence,dnsHypothesis,dnsChallenge.broken.addressing,dnsChallenge.broken.ethernet,dnsChallenge.broken.routing,dnsChallenge.broken.acl,dnsChallenge.broken.nat,dnsChallenge.broken.dhcp,dnsChallenge.broken.linkProfiles,repairedDnsServices),{evidence:40,reasoning:20,repair:25,verification:15,total:100,repaired:true,verified:true,solved:true});

const transportChallenge=createTransportListenerChallenge('transport-contract-001');
assert.equal(transportChallenge.family,'transport-listener');
assert.equal(transportChallenge.fault.kind,'service-listener-disabled');
assert.deepEqual(transportChallenge,createBuilderChallenge('transport-contract-001'));
const healthyTransportApp=runApplication(transportChallenge.healthy,transportChallenge.verification.serviceId,211);
const brokenTransportApp=runApplication(transportChallenge.broken,transportChallenge.verification.serviceId,212);
assert.equal(healthyTransportApp.success,true,healthyTransportApp.summary);
assert.equal(brokenTransportApp.success,false);
assert.equal(brokenTransportApp.firstBrokenBoundary,'TRANSPORT');
assert.equal(brokenTransportApp.stages.find((stage)=>stage.id==='dns')?.status,'PASS');
assert.equal(brokenTransportApp.protocolEvents.length,0,'disabled listener cannot produce established transport theater');
const brokenTransportService=(transportChallenge.broken.services??[]).find((service)=>service.id===transportChallenge.fault.serviceId);
assert.ok(brokenTransportService);
const repairedTransportServices=upsertBuilderHostedService(transportChallenge.broken.graph,transportChallenge.broken.services??[],{...brokenTransportService,enabled:true});
assert.deepEqual(repairedTransportServices,transportChallenge.healthy.services,'transport challenge changes exactly one canonical listener flag');
let transportEvidence=[];
transportEvidence=appendBuilderChallengeEvidence(transportEvidence,{kind:'application-transaction',sourceId:transportChallenge.verification.sourceId,destinationId:transportChallenge.verification.destinationId,serviceId:transportChallenge.verification.serviceId,success:false,applicationBoundary:brokenTransportApp.firstBrokenBoundary,repaired:false,detail:brokenTransportApp.summary});
transportEvidence=recordInspection(transportEvidence,transportChallenge,'state');transportEvidence=recordInspection(transportEvidence,transportChallenge,'config');
const transportHypothesis={boundary:'TRANSPORT',deviceId:transportChallenge.fault.nodeId};
assert.deepEqual(scoreBuilderChallenge(transportChallenge,transportEvidence,transportHypothesis,transportChallenge.broken.addressing,transportChallenge.broken.ethernet,transportChallenge.broken.routing,transportChallenge.broken.acl,transportChallenge.broken.nat,transportChallenge.broken.dhcp,transportChallenge.broken.linkProfiles,transportChallenge.broken.services),{evidence:40,reasoning:20,repair:0,verification:0,total:60,repaired:false,verified:false,solved:false});
assert.equal(scoreBuilderChallenge(transportChallenge,transportEvidence,transportHypothesis,transportChallenge.broken.addressing,transportChallenge.broken.ethernet,transportChallenge.broken.routing,transportChallenge.broken.acl,transportChallenge.broken.nat,transportChallenge.broken.dhcp,transportChallenge.broken.linkProfiles,repairedTransportServices).total,85);
const repairedTransportApp=runApplication({...transportChallenge.broken,services:repairedTransportServices},transportChallenge.verification.serviceId,213);
transportEvidence=appendBuilderChallengeEvidence(transportEvidence,{kind:'application-transaction',sourceId:transportChallenge.verification.sourceId,destinationId:transportChallenge.verification.destinationId,serviceId:transportChallenge.verification.serviceId,success:true,applicationBoundary:null,repaired:true,detail:repairedTransportApp.summary});
assert.deepEqual(scoreBuilderChallenge(transportChallenge,transportEvidence,transportHypothesis,transportChallenge.broken.addressing,transportChallenge.broken.ethernet,transportChallenge.broken.routing,transportChallenge.broken.acl,transportChallenge.broken.nat,transportChallenge.broken.dhcp,transportChallenge.broken.linkProfiles,repairedTransportServices),{evidence:40,reasoning:20,repair:25,verification:15,total:100,repaired:true,verified:true,solved:true});

"""
replace_once(challenge_test,
"for (const challenge of [access, trunk, stp, staticRoute, ospf, aclChallenge, natChallenge, dhcpChallenge, pmtuChallenge]) {",
application_contract + "for (const challenge of [access, trunk, stp, staticRoute, ospf, aclChallenge, natChallenge, dhcpChallenge, pmtuChallenge, dnsChallenge, transportChallenge]) {")
replace_once(challenge_test,
"console.log('Builder Track J challenge contract passed: gateway plus seeded access-VLAN, trunk-pruning, STP-loop, missing-static-route, OSPF-disabled, ACL-deny, NAT-disabled, DHCP-gateway, and IPv6-PMTU faults use canonical truth, ordinary probes/LAN+ARP/NAT/DHCP/ND+PMTUD evidence, exact repair, objective-scoped verification, causal scoring, and reproducible tokens.');",
"console.log('Builder Track J challenge contract passed: gateway plus seeded L2/routing/policy/DHCP/IPv6-PMTU/DNS-name/transport-listener faults use canonical truth, ordinary probe/LAN/NAT/DHCP/ND/PMTUD/application evidence, exact repair, objective-scoped verification, causal scoring, and reproducible tokens.');")

# Scenario v9 service persistence/migration contract.
addr_test = 'scripts/builder-addressing-contract-check.mjs'
replace_once(addr_test,
"import { createBuilderScenario, deserializeBuilderScenario, serializeBuilderScenario } from '../src/builder/scenario.ts';",
"import { createBuilderScenario, deserializeBuilderScenario, serializeBuilderScenario } from '../src/builder/scenario.ts';\nimport { createDefaultBuilderHostedServices } from '../src/builder/application.ts';")
replace_once(addr_test,
"assert.deepEqual(deserializeBuilderScenario(serializeBuilderScenario(scenario)).addressing, validated);",
"const scenarioRoundTrip=deserializeBuilderScenario(serializeBuilderScenario(scenario));\nassert.deepEqual(scenarioRoundTrip.addressing, validated);\nassert.deepEqual(scenarioRoundTrip.services,createDefaultBuilderHostedServices(graph),'schema v9 round trip must persist canonical hosted services');")
replace_once(addr_test,
"assert.deepEqual(migratedV2.nat.boundaries, [], 'legacy scenarios do not fabricate NAT boundaries');",
"assert.deepEqual(migratedV2.nat.boundaries, [], 'legacy scenarios do not fabricate NAT boundaries');\nassert.deepEqual(migratedV2.services,createDefaultBuilderHostedServices(graph),'legacy scenarios inherit the same deterministic hosted-service catalog the old UI derived at runtime');")

# Track J docs.
docs = 'docs/TRACKJ.md'
text = read(docs)
marker = '## Seventh slice — DNS names and transport listeners'
if marker not in text:
    text += """

## Seventh slice — DNS names and transport listeners

Track J now promotes the existing Track D hosted-service catalog from derived UI state into canonical Builder scenario configuration. This is a backward-compatible schema-v9 extension: new saves persist `services`, while old v9 scenarios that omit the field normalize to the same deterministic default catalog the application workspace already derived at runtime.

Two new seeded families use that truth:

- `dns-*`: exactly one named APP service loses its canonical hostname. The ordinary application transaction stops at **DNS**; L2, routing, policy, link, transport, TLS, application, and response remain `NOT_REACHED`. Repair is the normal hosted-service hostname editor.
- `transport-*` / `tcp-*` / `listener-*`: exactly one named TCP service keeps its DNS name but has its canonical listener disabled. Addressing, DNS, resolution, routing, policy/NAT, and link truth pass before **TRANSPORT** fails. No `transport.established` event or packet bytes are fabricated for the closed listener. Repair is the normal listener enable control.

Device Workbench CONFIG now projects hosted-service hostname and listener state on endpoint devices. Challenge application evidence is objective-scoped by source, destination, and service ID. An unrelated healthy service cannot verify the repair.

Both families retain the 100-point contract: failed ordinary application transaction at the exact expected first-broken boundary (20) + target STATE (10) + target CONFIG (10), causal hypothesis (20), exact canonical repair (25), and a successful post-repair request to the exact challenged service (15).

The service catalog remains networking truth rather than challenge metadata. Challenge code does not answer DNS queries, open sockets, or decide transaction outcomes; Track D's existing causal transaction consumes canonical service configuration and determines where the request stops.
"""
    write(docs, text)

print('Applied Track J DNS + transport canonical service slice.')
