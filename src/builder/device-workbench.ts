import { interfacesForBuilderNode, type BuilderAddressing } from './addressing.ts';
import { traceBuilderPolicy, type BuilderAclConfig } from './acl.ts';
import { builderBgpAsnForRouter, builderBgpState } from './bgp.ts';
import { applyBuilderDhcpState, pruneBuilderDhcpLeases, type BuilderDhcpConfig, type BuilderDhcpLeaseTable } from './dhcp.ts';
import { builderStpState, type BuilderStpState } from './stp.ts';
import type { BuilderEthernetConfig, BuilderEthernetFlowResult, BuilderEthernetFdbEntry } from './ethernet.ts';
import type { BuilderArpCache, BuilderArpResolution } from './arp.ts';
import { interfacesForBuilderNodeIpv6, routeTableForBuilderIpv6Router, type BuilderIpv6Config } from './ipv6.ts';
import { builderOspfv3DepthRouteOverlay, builderOspfv3DepthSummary, type BuilderIpv6RoutingDepthState } from './ipv6-routing-depth.ts';
import type { BuilderIpv6ControlState } from './ipv6-control-plane.ts';
import type { BuilderGraph } from './model.ts';
import type { BuilderNatConfig, BuilderNatSessionTable } from './nat.ts';
import type { BuilderProbeResult } from './probes.ts';
import { builderOspfState, routeTableForBuilderRouter, type BuilderRouteTableEntry, type BuilderRoutingConfig } from './routing.ts';

export type BuilderDevicePlane = 'routed' | 'ethernet';
export interface BuilderDeviceRef { plane: BuilderDevicePlane; id: string; }
export type BuilderWorkbenchStatus = 'normal' | 'good' | 'warn' | 'bad' | 'muted';
export type BuilderWorkbenchWhySource = 'CONFIG' | 'STATE' | 'EVENT' | 'TOPOLOGY';

export interface BuilderWorkbenchWhyStep {
  id: string;
  source: BuilderWorkbenchWhySource;
  label: string;
  detail: string;
}

export interface BuilderWorkbenchRow {
  id: string;
  label: string;
  value: string;
  detail: string;
  status: BuilderWorkbenchStatus;
  why: BuilderWorkbenchWhyStep[];
}

export interface BuilderWorkbenchSection {
  id: string;
  title: string;
  summary: string;
  rows: BuilderWorkbenchRow[];
}

export type BuilderWorkbenchEventCategory = 'session' | 'topology' | 'config' | 'routing' | 'policy' | 'neighbor' | 'switching' | 'nat' | 'dhcp' | 'probe' | 'ipv6';
export type BuilderWorkbenchEventKind = 'session' | 'action' | 'physical' | 'control-plane' | 'rib' | 'fib' | 'resolution' | 'forwarding' | 'policy' | 'translation' | 'flow';

export interface BuilderWorkbenchEventProjection {
  physical?: 'after';
  control?: 'after';
  rib?: 'after';
  fib?: 'after';
  dhcpLeases?: 'after';
  dhcpSequence?: 'after' | number;
  dhcpRemoveLeaseIds?: string[];
}

export interface BuilderWorkbenchEventSpec {
  key?: string;
  kind: BuilderWorkbenchEventKind;
  category: BuilderWorkbenchEventCategory;
  summary: string;
  detail: string;
  deviceRefs?: BuilderDeviceRef[];
  objectIds?: string[];
  offsetMs?: number;
  causeId?: string | null;
  causeKey?: string | null;
  projection?: BuilderWorkbenchEventProjection;
}

export interface BuilderWorkbenchEvent {
  id: string;
  sequence: number;
  atMs?: number;
  kind?: BuilderWorkbenchEventKind;
  category: BuilderWorkbenchEventCategory;
  summary: string;
  detail: string;
  deviceRefs: BuilderDeviceRef[];
  causeId: string | null;
  objectIds: string[];
  projection?: BuilderWorkbenchEventProjection;
}

export type BuilderWorkbenchEventJournal = BuilderWorkbenchEvent[];

export interface BuilderWorkbenchEventView extends BuilderWorkbenchEvent {
  causeChain: BuilderWorkbenchWhyStep[];
}

export interface BuilderDeviceOption extends BuilderDeviceRef {
  label: string;
  kind: string;
  group: string;
}

export interface BuilderDeviceWorkbenchSnapshot {
  device: BuilderDeviceOption;
  configSections: BuilderWorkbenchSection[];
  stateSections: BuilderWorkbenchSection[];
  events: BuilderWorkbenchEventView[];
  configRowCount: number;
  stateRowCount: number;
}

export interface BuilderWorkbenchTruthGraphs {
  controlGraph: BuilderGraph;
  ribGraph: BuilderGraph;
  fibGraph: BuilderGraph;
}

export interface BuilderDeviceWorkbenchInput {
  graph: BuilderGraph;
  truthGraphs?: BuilderWorkbenchTruthGraphs;
  addressing: BuilderAddressing;
  routing: BuilderRoutingConfig;
  ipv6: BuilderIpv6Config;
  ipv6ControlState: BuilderIpv6ControlState;
  ipv6RoutingDepth: BuilderIpv6RoutingDepthState;
  ethernet: BuilderEthernetConfig;
  ethernetFlow: BuilderEthernetFlowResult | null;
  arpCache: BuilderArpCache;
  arpResolutions: BuilderArpResolution[];
  acl: BuilderAclConfig;
  nat: BuilderNatConfig;
  natSessions: BuilderNatSessionTable;
  dhcp: BuilderDhcpConfig;
  dhcpLeases: BuilderDhcpLeaseTable;
  dhcpSequence: number;
  probeHistory: BuilderProbeResult[];
  sourceId: string;
  destinationId: string;
  events: BuilderWorkbenchEventJournal;
}

function refKey(ref: BuilderDeviceRef): string { return `${ref.plane}:${ref.id}`; }
function sameRef(a: BuilderDeviceRef, b: BuilderDeviceRef): boolean { return a.plane === b.plane && a.id === b.id; }
function uniqueRefs(values: readonly BuilderDeviceRef[]): BuilderDeviceRef[] {
  const seen = new Set<string>();
  return values.filter((value) => { const key = refKey(value); if (seen.has(key)) return false; seen.add(key); return true; });
}
function row(id:string,label:string,value:string,detail:string,status:BuilderWorkbenchStatus='normal',why:BuilderWorkbenchWhyStep[]=[]):BuilderWorkbenchRow{return{id,label,value,detail,status,why};}
function why(id:string,source:BuilderWorkbenchWhySource,label:string,detail:string):BuilderWorkbenchWhyStep{return{id,source,label,detail};}
function section(id:string,title:string,rows:BuilderWorkbenchRow[],emptySummary='No applicable state for this device.'):BuilderWorkbenchSection{return{id,title,summary:rows.length===0?emptySummary:`${rows.length} item${rows.length===1?'':'s'}`,rows};}
function linkState(graph:BuilderGraph,linkId:string):string{return graph.links.find((link)=>link.id===linkId)?.failed?'DOWN':'UP';}
function routedLabel(graph:BuilderGraph,id:string):string{return graph.nodes.find((node)=>node.id===id)?.label??id.toUpperCase();}
function ethernetLabel(ethernet:BuilderEthernetConfig,id:string):string{return ethernet.devices.find((device)=>device.id===id)?.label??id.toUpperCase();}

export function builderWorkbenchDeviceOptions(graph:BuilderGraph,ethernet:BuilderEthernetConfig):BuilderDeviceOption[]{
  const routed=graph.nodes.map((node)=>({plane:'routed' as const,id:node.id,label:node.label,kind:node.kind.toUpperCase(),group:'ROUTED GRAPH'}));
  const lan=ethernet.devices.map((device)=>({plane:'ethernet' as const,id:device.id,label:device.label,kind:device.kind.toUpperCase(),group:'ETHERNET FABRIC'}));
  return [...routed,...lan];
}

export function createBuilderWorkbenchEventJournal():BuilderWorkbenchEventJournal{
  return [{id:'wb-event-0000',sequence:0,atMs:0,kind:'session',category:'session',summary:'BUILDER SESSION INITIALIZED',detail:'Canonical configuration loaded. Derived runtime state and the event journal are session-only.',deviceRefs:[],causeId:null,objectIds:[]}];
}

export function classifyBuilderWorkbenchMessage(message:string):BuilderWorkbenchEventCategory{
  const text=message.toUpperCase();
  if(/^(PING|TRACEROUTE|PROBE)\b/.test(text))return'probe';
  if(/DHCP/.test(text))return'dhcp';
  if(/NAT|PAT|TRANSLAT/.test(text))return'nat';
  if(/ARP|NEIGHBOR|ND |NUD|DAD|SLAAC|RA |ROUTER SOLICIT/.test(text))return'neighbor';
  if(/VLAN|LAN |STP|FDB|FRAME|TRUNK|ACCESS PORT|MAC /.test(text))return'switching';
  if(/ACL|FIREWALL|POLICY|DENY|PERMIT/.test(text))return'policy';
  if(/IPV6|OSPFV3|PMTU|PACKET TOO BIG/.test(text))return'ipv6';
  if(/PING|TRACEROUTE|PROBE|ICMP/.test(text))return'probe';
  if(/OSPF|BGP|STATIC ROUTE|ROUTE TABLE|FIB|RIB|NEXT HOP/.test(text))return'routing';
  if(/TOPOLOGY|LINK |NODE |ROUTER |ENDPOINT |DELETED|ADDED|RESET/.test(text))return'topology';
  return'config';
}

function causalCategory(category:BuilderWorkbenchEventCategory):boolean{return['routing','policy','neighbor','switching','nat','dhcp','probe','ipv6'].includes(category);}

export function appendBuilderWorkbenchMessageEvent(journal:BuilderWorkbenchEventJournal,message:string,deviceRefs:readonly BuilderDeviceRef[]=[]):BuilderWorkbenchEventJournal{
  const category=classifyBuilderWorkbenchMessage(message);
  const sequence=(journal.at(-1)?.sequence??-1)+1;
  const previous=journal.at(-1)??null;
  const priorAtMs=previous?.atMs??((previous?.sequence??0)*1000);
  const cause=causalCategory(category)?[...journal].reverse().find((event)=>['topology','config','routing','policy','nat','dhcp','ipv6'].includes(event.category))??null:null;
  const summary=(message.split('·')[0]?.trim()||message.trim()||'BUILDER EVENT').slice(0,96);
  const objectIds=[...new Set((message.match(/[A-Za-z][A-Za-z0-9_-]{2,}/g)??[]).filter((value)=>value.length<=64))].slice(0,12);
  const event:BuilderWorkbenchEvent={id:'wb-event-'+String(sequence).padStart(4,'0'),sequence,atMs:priorAtMs+1000,kind:'action',category,summary,detail:message,deviceRefs:uniqueRefs(deviceRefs),causeId:cause?.id??null,objectIds};
  return [...journal,event].slice(-160);
}

export function appendBuilderWorkbenchEventBatch(journal:BuilderWorkbenchEventJournal,specs:readonly BuilderWorkbenchEventSpec[]):BuilderWorkbenchEventJournal{
  if(specs.length===0)return journal;
  const baseEvent=journal.at(-1)??null;
  const baseAtMs=baseEvent?.atMs??((baseEvent?.sequence??0)*1000);
  const ordered=specs.map((entry,index)=>({entry,index})).sort((a,b)=>(a.entry.offsetMs??0)-(b.entry.offsetMs??0)||a.index-b.index);
  const idsByKey=new Map<string,string>();
  let next=[...journal];
  for(const item of ordered){
    const entry=item.entry;
    const sequence=(next.at(-1)?.sequence??-1)+1;
    const previous=next.at(-1)??baseEvent;
    const requestedAtMs=baseAtMs+Math.max(0,Math.round(entry.offsetMs??item.index+1));
    const atMs=Math.max(previous?.atMs??baseAtMs,requestedAtMs);
    const id='wb-event-'+String(sequence).padStart(4,'0');
    let causeId: string|null;
    if(entry.causeId!==undefined)causeId=entry.causeId;
    else if(entry.causeKey)causeId=idsByKey.get(entry.causeKey)??baseEvent?.id??null;
    else causeId=baseEvent?.id??null;
    const event:BuilderWorkbenchEvent={
      id,sequence,atMs,kind:entry.kind,category:entry.category,
      summary:(entry.summary.trim()||'BUILDER EVENT').slice(0,96),
      detail:entry.detail.trim()||entry.summary.trim()||'Builder state changed.',
      deviceRefs:uniqueRefs(entry.deviceRefs??[]),
      causeId,
      objectIds:[...new Set((entry.objectIds??[]).filter(Boolean))].slice(0,16),
      projection:entry.projection?{...entry.projection,dhcpRemoveLeaseIds:entry.projection.dhcpRemoveLeaseIds?[...entry.projection.dhcpRemoveLeaseIds]:undefined}:undefined,
    };
    next.push(event);
    if(entry.key)idsByKey.set(entry.key,id);
  }
  return next.slice(-160);
}

export function builderWorkbenchEventCausalChain(journal:BuilderWorkbenchEventJournal,eventId:string,maxDepth=8):BuilderWorkbenchEvent[]{
  const byId=new Map(journal.map((event)=>[event.id,event]));const result:BuilderWorkbenchEvent[]=[];const seen=new Set<string>();let current=byId.get(eventId)??null;
  while(current&&result.length<maxDepth&&!seen.has(current.id)){seen.add(current.id);result.push(current);current=current.causeId?byId.get(current.causeId)??null:null;}
  return result.reverse();
}

function routeWhy(graph:BuilderGraph,addressing:BuilderAddressing,routing:BuilderRoutingConfig,entry:BuilderRouteTableEntry):BuilderWorkbenchWhyStep[]{
  const steps:BuilderWorkbenchWhyStep[]=[];
  if(entry.source==='connected')steps.push(why(`${entry.id}:config`,'CONFIG','CONNECTED PREFIX',`${entry.prefix} exists because ${entry.outgoingInterface} is configured on ${entry.linkId}.`));
  if(entry.source==='static')steps.push(why(`${entry.id}:config`,'CONFIG','STATIC ROUTE',`${entry.prefix} via ${entry.nextHop} metric ${entry.metric} is explicitly configured.`));
  if(entry.source==='ospf')steps.push(why(`${entry.id}:ospf`,'STATE',entry.ospfRouteType==='inter-area'?'OSPF INTER-AREA':'OSPF SPF',`${entry.stateNote}. OSPF AD ${entry.administrativeDistance}, metric ${entry.metric}.`));
  if(entry.source==='bgp'){
    const bgp=builderBgpState(graph,addressing,routing.bgp);
    const learned=bgp.bestRoutes.find((candidate)=>candidate.routerId===entry.routerId&&candidate.prefix===entry.prefix);
    steps.push(why(`${entry.id}:bgp`,'STATE','BGP BEST PATH',learned?.bestReason??`${entry.stateNote}. BGP route projected into the IPv4 RIB.`));
  }
  steps.push(why(`${entry.id}:select`,'STATE','ROUTE SELECTION',`Prefix length ${entry.prefixLength} → AD ${entry.administrativeDistance} → metric ${entry.metric}; ${entry.active?'candidate is active':'candidate is inactive'}.`));
  steps.push(why(`${entry.id}:link`,'TOPOLOGY',`LINK ${linkState(graph,entry.linkId)}`,`${entry.outgoingInterface} exits through ${entry.linkId}.`));
  return steps;
}

function routedConfigSections(input:BuilderDeviceWorkbenchInput,deviceId:string):BuilderWorkbenchSection[]{
  const node=input.graph.nodes.find((candidate)=>candidate.id===deviceId);if(!node)return[];
  const ipv4=interfacesForBuilderNode(input.addressing,deviceId).map((entry)=>row(`cfg4:${entry.linkId}`,'IPV4 INTERFACE',`${entry.name} · ${entry.address}`,`${input.addressing.segments[entry.linkId]?.cidr??'—'} · ${entry.linkId} · ${linkState(input.graph,entry.linkId)}`,linkState(input.graph,entry.linkId)==='UP'?'good':'bad',[why(`cfg4:${entry.linkId}:why`,'CONFIG','INTERFACE ADDRESS',`${entry.address} is canonical scenario configuration on ${entry.name}.`),why(`cfg4:${entry.linkId}:topology`,'TOPOLOGY',`LINK ${linkState(input.graph,entry.linkId)}`,`${entry.linkId} supplies physical adjacency.`)]));
  const ipv6=input.ipv6.enabled?interfacesForBuilderNodeIpv6(input.ipv6.addressing,deviceId).map((entry)=>row(`cfg6:${entry.linkId}`,'IPV6 INTERFACE',`${entry.name} · ${entry.globalAddress}`,`${entry.prefix} · LL ${entry.linkLocalAddress} · ${entry.addressOrigin.toUpperCase()}`,linkState(input.graph,entry.linkId)==='UP'?'good':'bad',[why(`cfg6:${entry.linkId}:why`,'CONFIG',`ADDRESS ORIGIN · ${entry.addressOrigin.toUpperCase()}`,`${entry.globalAddress} and ${entry.linkLocalAddress} belong to canonical IPv6 interface configuration.`)])):[];
  const gateway4=node.kind==='endpoint'?input.addressing.defaultGateways[deviceId]??null:null;
  const gateway6=node.kind==='endpoint'?input.ipv6.addressing.defaultGateways[deviceId]??null:null;
  const gateways:BuilderWorkbenchRow[]=[];
  if(node.kind==='endpoint')gateways.push(row('cfg:gw4','IPV4 DEFAULT GATEWAY',gateway4??'NONE','Endpoint off-link IPv4 forwarding uses this directly connected router.',gateway4?'normal':'warn',[why('cfg:gw4:why','CONFIG','HOST ROUTING',gateway4?'A canonical IPv4 default gateway is configured.':'No IPv4 default gateway is configured.')]),row('cfg:gw6','IPV6 DEFAULT ROUTER',gateway6?`${gateway6.address}%${gateway6.linkId}`:'NONE','IPv6 default-router scope is explicit and independent from IPv4.',gateway6?'normal':'warn',[why('cfg:gw6:why','CONFIG','HOST ROUTING',gateway6?'A scoped link-local default router is configured.':'No IPv6 default router is configured.')]));
  const routingRows:BuilderWorkbenchRow[]=[];
  if(node.kind==='router'){
    input.routing.staticRoutes.filter((entry)=>entry.routerId===deviceId).forEach((entry)=>routingRows.push(row(`cfg:static:${entry.id}`,'IPV4 STATIC',entry.prefix,`via ${entry.nextHop} · metric ${entry.metric}`,'normal',[why(`cfg:static:${entry.id}:why`,'CONFIG','STATIC ROUTE',`Explicit route ${entry.id} is persisted in scenario configuration.`)])));
    input.ipv6.routing.staticRoutes.filter((entry)=>entry.routerId===deviceId).forEach((entry)=>routingRows.push(row(`cfg:static6:${entry.id}`,'IPV6 STATIC',entry.prefix,`via ${entry.nextHop}%${entry.linkId} · metric ${entry.metric}`,'normal',[why(`cfg:static6:${entry.id}:why`,'CONFIG','STATIC IPV6 ROUTE',`Explicit IPv6 route ${entry.id} is persisted in scenario configuration.`)])));
    const ospfEnabled=input.routing.ospf.enabledRouterIds.includes(deviceId);routingRows.push(row('cfg:ospf','OSPF',ospfEnabled?'ENABLED':'DISABLED',`Areas are derived from configured routed-link area assignments.`,ospfEnabled?'good':'muted',[why('cfg:ospf:why','CONFIG','OSPF PROCESS',ospfEnabled?'Router is configured to participate in OSPF.':'Router is not configured for OSPF.')]));
    const ospfv3Enabled=input.ipv6.enabled&&input.ipv6.ospfv3.enabledRouterIds.includes(deviceId);routingRows.push(row('cfg:ospfv3','OSPFV3',ospfv3Enabled?'ENABLED':'DISABLED',`Areas ${builderOspfv3DepthSummary(input.graph,input.ipv6,input.ipv6RoutingDepth).routerAreas[deviceId]?.join(', ')||'—'}`,ospfv3Enabled?'good':'muted',[why('cfg:ospfv3:why','CONFIG','OSPFV3 PROCESS',ospfv3Enabled?'Router participates in the IPv6 link-state control plane.':'OSPFv3 is disabled on this router.')]));
    const bgpEnabled=input.routing.bgp.enabledRouterIds.includes(deviceId);routingRows.push(row('cfg:bgp','BGP',bgpEnabled?`ENABLED · AS${builderBgpAsnForRouter(input.graph,input.routing.bgp,deviceId)}`:'DISABLED',`${input.routing.bgp.sessions.filter((entry)=>entry.aRouterId===deviceId||entry.bRouterId===deviceId).length} sessions · ${input.routing.bgp.origins.filter((entry)=>entry.routerId===deviceId).length} origins`,bgpEnabled?'good':'muted',[why('cfg:bgp:why','CONFIG','BGP PROCESS',bgpEnabled?'ASN, sessions, origins, and policy are canonical Builder configuration.':'BGP is disabled on this router.')]));
  }
  const policyRows:BuilderWorkbenchRow[]=[];
  if(node.kind==='router'){
    input.acl.rules.filter((entry)=>entry.routerId===deviceId).forEach((entry)=>policyRows.push(row(`cfg:acl:${entry.id}`,'IPV4 ACL',`${entry.order} · ${entry.action.toUpperCase()} ${entry.protocol.toUpperCase()}`,`${entry.sourcePrefix} → ${entry.destinationPrefix}${entry.destinationPort?`:${entry.destinationPort}`:''} · ${entry.description||entry.id}`,entry.action==='deny'?'warn':'normal',[why(`cfg:acl:${entry.id}:why`,'CONFIG','FIRST-MATCH RULE',`Rule ${entry.id} is persisted and evaluated in ascending order.`)])));
    const acl6=input.ipv6RoutingDepth.policy.rules.filter((entry)=>entry.routerId===deviceId);acl6.forEach((entry)=>policyRows.push(row(`cfg:acl6:${entry.id}`,'IPV6 ACL',`${entry.order} · ${entry.action.toUpperCase()} · ${entry.icmpType.toUpperCase()}`,`${entry.sourcePrefix} → ${entry.destinationPrefix}`,entry.action==='deny'?'warn':'normal',[why(`cfg:acl6:${entry.id}:why`,'CONFIG','IPV6 FIRST-MATCH RULE',`Rule ${entry.id} is evaluated independently from IPv4 policy.`)])));
    const boundary=input.nat.boundaries.find((entry)=>entry.routerId===deviceId);if(boundary)policyRows.push(row(`cfg:nat:${boundary.id}`,'NAT BOUNDARY',boundary.enabled?'ENABLED':'DISABLED',`inside ${boundary.insideLinkIds.join(', ')} · outside ${boundary.outsideLinkIds.join(', ')} · overload ${boundary.overloadAddress}`,boundary.enabled?'good':'muted',[why(`cfg:nat:${boundary.id}:why`,'CONFIG','TRANSLATION BOUNDARY','Inside/outside interface roles and overload address are canonical NAT configuration.')]));
    input.nat.staticAddresses.filter((entry)=>entry.routerId===deviceId).forEach((entry)=>policyRows.push(row(`cfg:nat1:${entry.id}`,'STATIC NAT',entry.outsideAddress,`${entry.insideAddress} ↔ ${entry.outsideAddress} · ${entry.description}`,'normal',[why(`cfg:nat1:${entry.id}:why`,'CONFIG','ONE-TO-ONE MAPPING','Static mapping exists independent from active translation state.')]))) ;
    input.nat.staticMappings.filter((entry)=>entry.routerId===deviceId).forEach((entry)=>policyRows.push(row(`cfg:natp:${entry.id}`,'PORT FORWARD',`${entry.outsideAddress}:${entry.outsidePort}/${entry.protocol}`,`→ ${entry.insideAddress}:${entry.insidePort} · ${entry.description}`,'normal',[why(`cfg:natp:${entry.id}:why`,'CONFIG','STATIC PORT MAPPING','Published tuple is persisted; matching flow state remains derived.')]))) ;
  }
  return [section('interfaces','INTERFACES',[...ipv4,...ipv6,...gateways],'No routed interfaces are configured.'),section('routing-config','ROUTING / CONTROL PLANE',routingRows,'This endpoint has no router control-plane configuration.'),section('policy-config','POLICY / EDGE SERVICES',policyRows,'No explicit policy or edge-service configuration applies to this device.')];
}

function routedStateSections(input:BuilderDeviceWorkbenchInput,deviceId:string):BuilderWorkbenchSection[]{
  const node=input.graph.nodes.find((candidate)=>candidate.id===deviceId);if(!node)return[];
  const ribGraph=input.truthGraphs?.ribGraph??input.graph;
  const controlGraph=input.truthGraphs?.controlGraph??input.graph;
  const routeRows:BuilderWorkbenchRow[]=[];
  if(node.kind==='router'){
    routeTableForBuilderRouter(ribGraph,input.addressing,input.routing,deviceId).forEach((entry)=>routeRows.push(row(`state:route4:${entry.id}`,`IPV4 ${entry.source.toUpperCase()}`,entry.prefix,`${entry.nextHop?`via ${entry.nextHop}`:'DIRECT'} · ${entry.outgoingInterface} · AD ${entry.administrativeDistance} · M ${entry.metric} · ${entry.stateNote}`,entry.active?'good':'bad',routeWhy(input.graph,input.addressing,input.routing,entry))));
    const overlay=builderOspfv3DepthRouteOverlay(input.graph,input.ipv6,input.ipv6RoutingDepth);
    routeTableForBuilderIpv6Router(input.graph,input.ipv6,deviceId,overlay).forEach((entry)=>routeRows.push(row(`state:route6:${entry.id}`,`IPV6 ${entry.source.toUpperCase()}`,entry.prefix,`${entry.nextHop?`via ${entry.nextHop}`:'DIRECT'} · ${entry.outgoingInterface} · AD ${entry.administrativeDistance} · M ${entry.metric} · ${entry.stateNote}`,entry.active?'good':'bad',[why(`state:route6:${entry.id}:source`,'STATE',entry.source.toUpperCase(),entry.stateNote),why(`state:route6:${entry.id}:selection`,'STATE','ROUTE SELECTION',`Prefix length ${entry.prefixLength} → AD ${entry.administrativeDistance} → metric ${entry.metric}.`),why(`state:route6:${entry.id}:link`,'TOPOLOGY',`LINK ${linkState(input.graph,entry.linkId)}`,`${entry.outgoingInterface} uses ${entry.linkId}.`)])));
  }else{
    const gateway=input.addressing.defaultGateways[deviceId]??null;routeRows.push(row('state:endpoint-routing','HOST FIB',gateway?`DEFAULT VIA ${gateway}`:'ON-LINK ONLY',gateway?'Off-link IPv4 traffic uses the configured gateway.':'No off-link IPv4 forwarding is possible without a gateway.',gateway?'normal':'warn',[why('state:endpoint-routing:why','CONFIG','HOST DEFAULT ROUTE',gateway?'Default-gateway configuration supplies endpoint FIB behavior.':'Only connected prefixes are usable.')]));
  }
  const controlRows:BuilderWorkbenchRow[]=[];
  if(node.kind==='router'){
    const ospf=builderOspfState(controlGraph,input.addressing,input.routing);ospf.adjacencies.filter((entry)=>entry.aRouterId===deviceId||entry.bRouterId===deviceId).forEach((entry)=>controlRows.push(row(`state:ospf:${entry.id}`,'OSPF NEIGHBOR',`${routedLabel(input.graph,entry.aRouterId===deviceId?entry.bRouterId:entry.aRouterId)} · ${entry.state}`,`AREA ${entry.areaId} · cost ${entry.cost} · ${entry.reason}`,entry.state==='FULL'?'good':'bad',[why(`state:ospf:${entry.id}:config`,'CONFIG','OSPF ENABLEMENT','Both router endpoints must participate in the configured area.'),why(`state:ospf:${entry.id}:topology`,'TOPOLOGY',`LINK ${linkState(input.graph,entry.linkId)}`,`${entry.linkId} carries the adjacency.`),why(`state:ospf:${entry.id}:state`,'STATE','ADJACENCY RESULT',entry.reason)])));
    const advertised=ospf.advertisements.filter((entry)=>entry.routerId===deviceId);if(advertised.length)controlRows.push(row('state:ospf:lsdb','OSPF LSDB / SELF LSA',`${advertised.length} PREFIXES`,advertised.map((entry)=>entry.prefix).join(' · '),'normal',[why('state:ospf:lsdb:why','STATE','LINK-STATE ORIGINATION','Active connected prefixes are originated by the selected router into its current LSDB view.')]));
    const ospfv3=builderOspfv3DepthSummary(input.graph,input.ipv6,input.ipv6RoutingDepth);ospfv3.adjacencies.filter((entry)=>entry.aRouterId===deviceId||entry.bRouterId===deviceId).forEach((entry)=>controlRows.push(row(`state:ospfv3:${entry.id}`,'OSPFV3 NEIGHBOR',`${routedLabel(input.graph,entry.aRouterId===deviceId?entry.bRouterId:entry.aRouterId)} · ${entry.phase}`,`AREA ${entry.area} · ${entry.detail}`,entry.phase==='FULL'?'good':entry.phase==='STALE FULL'?'warn':'bad',[why(`state:ospfv3:${entry.id}:clock`,'STATE',entry.failurePhase??'ADJACENCY',entry.detail),why(`state:ospfv3:${entry.id}:topology`,'TOPOLOGY',`LINK ${linkState(input.graph,entry.linkId)}`,`Physical state and timed control-plane knowledge remain separate.`)])));
    const bgp=builderBgpState(input.graph,input.addressing,input.routing.bgp);bgp.sessions.filter((entry)=>entry.aRouterId===deviceId||entry.bRouterId===deviceId).forEach((entry)=>controlRows.push(row(`state:bgp-session:${entry.id}`,'BGP SESSION',`${entry.mode.toUpperCase()} · ${entry.state}`,`AS${entry.aAsn} ↔ AS${entry.bAsn} · ${entry.relationship.toUpperCase()} · ${entry.reason}`,entry.state==='ESTABLISHED'?'good':'bad',[why(`state:bgp-session:${entry.id}:config`,'CONFIG','PEERING CONFIG',`Session ${entry.id} is authored on ${entry.linkId}.`),why(`state:bgp-session:${entry.id}:state`,'STATE','SESSION STATE',entry.reason),why(`state:bgp-session:${entry.id}:topology`,'TOPOLOGY',`LINK ${linkState(input.graph,entry.linkId)}`,`Peering depends on the direct Builder link.`)])));
    bgp.routes.filter((entry)=>entry.routerId===deviceId&&entry.best).forEach((entry)=>controlRows.push(row(`state:bgp-route:${entry.id}`,'BGP BEST',entry.prefix,`LP ${entry.localPref} · AS_PATH ${entry.asPath.join(' ')||'LOCAL'} · MED ${entry.med} · NEXT_HOP ${entry.nextHopAddress} · ${entry.communities.join(' ')||'NO COMM'}`,entry.policyAnomaly?'warn':'good',[why(`state:bgp-route:${entry.id}:best`,'STATE','BEST-PATH DECISION',entry.bestReason),why(`state:bgp-route:${entry.id}:learned`,'STATE',entry.learnedVia.toUpperCase(),entry.learnedFromRouterId?`Learned from ${routedLabel(input.graph,entry.learnedFromRouterId)} over ${entry.learnedSessionId}.`:'Locally originated NLRI.'),why(`state:bgp-route:${entry.id}:policy`,'CONFIG','BGP POLICY',entry.policyAnomaly?'Relationship leak override produced an explicit anomaly.':'Import/export policy and relationship export allowed this route.')]))) ;
  }
  const neighborRows=input.ipv6ControlState.neighborCache.filter((entry)=>entry.nodeId===deviceId).map((entry)=>row(`state:nd:${entry.id}`,'IPV6 NEIGHBOR',`${entry.address} → ${entry.mac}`,`${routedLabel(input.graph,entry.targetNodeId)} · ${entry.source} · seq ${entry.learnedSequence} · ${entry.linkId}`,'good',[why(`state:nd:${entry.id}:source`,'EVENT',entry.source,entry.source==='RA'?'Router Advertisement supplied the neighbor/default-router mapping.':'Neighbor Solicitation/Advertisement resolved the next hop.'),why(`state:nd:${entry.id}:link`,'TOPOLOGY',`LINK ${linkState(input.graph,entry.linkId)}`,`Neighbor state is scoped to ${entry.linkId}.`)]));
  const natRows=input.natSessions.filter((entry)=>entry.routerId===deviceId).map((entry)=>row(`state:nat:${entry.id}`,entry.kind.toUpperCase(),`${entry.insideAddress}${entry.insidePort?`:${entry.insidePort}`:''} → ${entry.outsideAddress}${entry.outsidePort?`:${entry.outsidePort}`:''}`,`${entry.protocol.toUpperCase()} · remote ${entry.remoteAddress}${entry.remotePort?`:${entry.remotePort}`:''} · seq ${entry.createdSequence}→${entry.lastUsedSequence}${entry.expiresAfterSequence==null?' · STATIC':` · EXP ${entry.expiresAfterSequence}`}`,'good',[why(`state:nat:${entry.id}:boundary`,'CONFIG','NAT BOUNDARY',`Translation belongs to ${entry.routerId}; static rules or PAT policy supplied the translated tuple.`),why(`state:nat:${entry.id}:runtime`,'STATE','TRANSLATION STATE',`Created at sequence ${entry.createdSequence}; last used at ${entry.lastUsedSequence}.`)]));
  const policy=input.graph.nodes.find((candidate)=>candidate.id===deviceId)?.kind==='router'?traceBuilderPolicy(input.graph,input.addressing,input.routing,input.acl,input.sourceId,input.destinationId,'icmp'):null;
  const policyRows=policy?.decisions.filter((entry)=>entry.routerId===deviceId).map((entry)=>row(`state:policy:${entry.routerId}:${entry.ruleId??'default'}`,'CURRENT ICMP POLICY',entry.action.toUpperCase(),entry.ruleDescription,entry.action==='permit'?'good':'bad',[why(`state:policy:${entry.routerId}:path`,'STATE','FLOW REACHED ROUTER',`Current ${input.sourceId} → ${input.destinationId} forwarding path crosses this router.`),why(`state:policy:${entry.routerId}:rule`,'CONFIG',entry.ruleId??'DEFAULT POLICY',entry.ruleDescription),why(`state:policy:${entry.routerId}:decision`,'STATE','FIRST MATCH WINS',`${entry.action.toUpperCase()} is the deterministic policy result for the current flow.`)]))??[];
  const probeRows=input.probeHistory.filter((probe)=>probe.sourceNodeId===deviceId||probe.destinationNodeId===deviceId||probe.attempts.some((attempt)=>attempt.requestNodeIds.includes(deviceId)||attempt.responseNodeIds.includes(deviceId))).slice(0,8).map((probe)=>row(`state:probe:${probe.id}`,`${probe.kind.toUpperCase()} · ${probe.plane.replace('ROUTED ','')}`,probe.success?'PASS':'FAIL',`${routedLabel(input.graph,probe.sourceNodeId)} → ${routedLabel(input.graph,probe.destinationNodeId)} · ${probe.summary}`,probe.success?'good':'warn',[why(`state:probe:${probe.id}:snapshot`,'STATE','SESSION SNAPSHOT',probe.snapshotNote),why(`state:probe:${probe.id}:result`,'EVENT','PROBE RESULT',probe.attempts.at(-1)?.detail??probe.summary)]));
  return [section('rib-fib','RIB / FIB',routeRows,'No route state applies to this device.'),section('control-state','DYNAMIC ROUTING STATE',controlRows,'No dynamic-routing state applies to this device.'),section('neighbor-state','NEIGHBOR / TRANSLATION STATE',[...neighborRows,...natRows],'No ND or NAT runtime state applies to this device.'),section('policy-flow-state','POLICY / FLOW STATE',[...policyRows,...probeRows],'No current policy decision or probe snapshot involves this device.')];
}

function stpStatesForDevice(ethernet:BuilderEthernetConfig,deviceId:string):BuilderStpState[]{
  return ethernet.vlans.map((vlan)=>builderStpState(ethernet,vlan.id)).filter((state)=>state.ports.some((port)=>port.a===deviceId||port.b===deviceId)||state.rootBridgeId===deviceId);
}

function ethernetConfigSections(input:BuilderDeviceWorkbenchInput,deviceId:string):BuilderWorkbenchSection[]{
  const device=input.ethernet.devices.find((candidate)=>candidate.id===deviceId);if(!device)return[];
  const identity=[row('cfg:lan:identity','DEVICE',`${device.kind.toUpperCase()} · ${device.mac}`,device.label,'normal',[why('cfg:lan:identity:why','CONFIG','DEVICE IDENTITY','Role, MAC address, and VLAN interfaces are canonical Ethernet configuration.')]),...device.interfaces.map((entry)=>row(`cfg:lan:if:${entry.vlanId}`,'L3 VLAN INTERFACE',`VLAN ${entry.vlanId} · ${entry.address}`,`gateway ${entry.gateway??'—'}`,'normal',[why(`cfg:lan:if:${entry.vlanId}:why`,'CONFIG','VLAN INTERFACE',`IPv4 interface belongs to VLAN ${entry.vlanId}.`)]))];
  const ports=input.ethernet.links.filter((link)=>link.a===deviceId||link.b===deviceId).map((link)=>row(`cfg:lan:port:${link.id}`,'PORT',`${link.id} · ${link.mode.toUpperCase()}`,link.mode==='access'?`ACCESS VLAN ${link.accessVlan} · ${link.failed?'DOWN':'UP'}`:`ALLOWED ${link.allowedVlans?.join(', ')||'NONE'} · ${link.failed?'DOWN':'UP'}`,link.failed?'bad':'normal',[why(`cfg:lan:port:${link.id}:mode`,'CONFIG',link.mode.toUpperCase(),link.mode==='access'?`Frames are untagged members of VLAN ${link.accessVlan}.`:`Only VLANs ${link.allowedVlans?.join(', ')||'NONE'} are carried.`),why(`cfg:lan:port:${link.id}:physical`,'TOPOLOGY',link.failed?'LINK DOWN':'LINK UP',`${ethernetLabel(input.ethernet,link.a)} ↔ ${ethernetLabel(input.ethernet,link.b)}`)]));
  const serviceRows:BuilderWorkbenchRow[]=[];
  const dhcpClient=input.dhcp.clientDeviceIds.includes(deviceId);if(device.kind==='endpoint')serviceRows.push(row('cfg:dhcp:client','IPV4 ADDRESS MODE',dhcpClient?'DHCP':'STATIC',dhcpClient?'No effective IPv4 is assumed until a lease ACK exists.':'Configured interface address remains authoritative.',dhcpClient?'normal':'muted',[why('cfg:dhcp:client:why','CONFIG','HOST BOOTSTRAP',dhcpClient?'Endpoint is persisted as a DHCP client.':'Endpoint uses static IPv4 configuration.')]));
  input.dhcp.pools.filter((pool)=>pool.serverDeviceId===deviceId).forEach((pool)=>serviceRows.push(row(`cfg:dhcp:pool:${pool.id}`,'DHCP POOL',`VLAN ${pool.vlanId} · ${pool.startAddress}–${pool.endAddress}`,`GW ${pool.gateway??'MISSING'} · DNS ${pool.dnsServers.join(', ')||'MISSING'} · lease ${pool.leaseSteps} steps`,'normal',[why(`cfg:dhcp:pool:${pool.id}:why`,'CONFIG','DHCP SERVER POOL',`Pool ${pool.id} is canonical service configuration.`)])));
  input.dhcp.relays.filter((relay)=>relay.routerId===deviceId||relay.serverDeviceId===deviceId).forEach((relay)=>serviceRows.push(row(`cfg:dhcp:relay:${relay.id}`,'DHCP RELAY',`VLAN ${relay.clientVlanId} → VLAN ${relay.serverVlanId}`,`${ethernetLabel(input.ethernet,relay.routerId)} → ${ethernetLabel(input.ethernet,relay.serverDeviceId)}`,'normal',[why(`cfg:dhcp:relay:${relay.id}:why`,'CONFIG','EXPLICIT RELAY','Broadcast does not cross the router; the configured relay forwards DHCP messages between VLANs.')])));
  if(device.kind==='switch')serviceRows.push(row('cfg:stp','STP',input.ethernet.stp.enabled?'ENABLED':'DISABLED',`bridge priority ${input.ethernet.stp.bridgePriorities[deviceId]??32768}`,input.ethernet.stp.enabled?'good':'warn',[why('cfg:stp:why','CONFIG','LOOP CONTROL',input.ethernet.stp.enabled?'Per-VLAN spanning trees are derived from canonical bridge priority and topology.':'Redundant Layer-2 cycles can become unsafe.')]));
  return [section('lan-identity','IDENTITY / INTERFACES',identity),section('lan-ports','PORTS / VLANS',ports,'No Ethernet links attach to this device.'),section('lan-services','L2 CONTROL / DHCP',serviceRows,'No STP or DHCP configuration applies to this device.')];
}

function ethernetStateSections(input:BuilderDeviceWorkbenchInput,deviceId:string):BuilderWorkbenchSection[]{
  const device=input.ethernet.devices.find((candidate)=>candidate.id===deviceId);if(!device)return[];
  const runtime=applyBuilderDhcpState(input.ethernet,input.dhcp,input.dhcpLeases,input.dhcpSequence);
  const runtimeDevice=runtime.devices.find((candidate)=>candidate.id===deviceId);
  const hostRows=(runtimeDevice?.interfaces??[]).map((entry)=>row(`state:host:${entry.vlanId}`,'EFFECTIVE IPV4',entry.address,`VLAN ${entry.vlanId} · GW ${entry.gateway??'NONE'}${input.dhcp.clientDeviceIds.includes(deviceId)?' · DHCP RUNTIME':' · STATIC'}`,entry.address==='0.0.0.0'?'warn':'good',[why(`state:host:${entry.vlanId}:config`,'CONFIG','ADDRESS MODE',input.dhcp.clientDeviceIds.includes(deviceId)?'DHCP client configuration suppresses the static address until an ACK lease exists.':'Static interface configuration is effective immediately.'),why(`state:host:${entry.vlanId}:state`,'STATE','RUNTIME ADDRESS',entry.address==='0.0.0.0'?'No active DHCP lease currently materializes an IPv4 address.':`${entry.address} is the effective address used by the LAN data plane.`)]));
  const arpRows=input.arpCache.filter((entry)=>entry.ownerDeviceId===deviceId).map((entry)=>row(`state:arp:${entry.ownerDeviceId}:${entry.vlanId}:${entry.address}`,'ARP',`${entry.address} → ${entry.mac}`,`VLAN ${entry.vlanId} · learned from ${ethernetLabel(input.ethernet,entry.learnedFromDeviceId)}`,'good',[why(`state:arp:${entry.address}:request`,'EVENT','ARP RESOLUTION',input.arpResolutions.find((resolution)=>resolution.ownerDeviceId===deviceId&&resolution.targetAddress===entry.address)?.summary??'A prior ARP Request/Reply resolved this target.'),why(`state:arp:${entry.address}:cache`,'STATE','ARP CACHE',`Mapping is session-only and scoped to device ${deviceId}, VLAN ${entry.vlanId}.`)]));
  const fdb:BuilderEthernetFdbEntry[]=input.ethernetFlow?.fdb.filter((entry)=>entry.switchId===deviceId)??[];
  const fdbRows=fdb.map((entry)=>row(`state:fdb:${entry.switchId}:${entry.vlanId}:${entry.mac}`,'FDB',`${entry.mac} → ${entry.linkId}`,`VLAN ${entry.vlanId} · learned from ${ethernetLabel(input.ethernet,entry.learnedFrom)}`,'good',[why(`state:fdb:${entry.mac}:flow`,'EVENT','SOURCE MAC LEARNING',`The last canonical Ethernet flow observed ${entry.mac} arriving from ${entry.learnedFrom}.`),why(`state:fdb:${entry.mac}:vlan`,'STATE','VLAN-SCOPED FDB',`Entry exists only in VLAN ${entry.vlanId}; another VLAN may learn the same MAC independently.`)]));
  const stpRows=stpStatesForDevice(input.ethernet,deviceId).map((state)=>{const localPorts=state.ports.filter((port)=>port.a===deviceId||port.b===deviceId);return row(`state:stp:${state.vlanId}`,'STP',`VLAN ${state.vlanId} · ${state.rootBridgeId===deviceId?'ROOT':localPorts.some((port)=>port.state==='BLOCKING'&&port.blockedAt===deviceId)?'BLOCKING':'FORWARDING'}`,`${state.explanation} · ${localPorts.map((port)=>`${port.linkId}:${port.state}`).join(' · ')}`,state.enabled?(localPorts.some((port)=>port.state==='BLOCKING'&&port.blockedAt===deviceId)?'warn':'good'):(state.loopDetected?'bad':'muted'),[why(`state:stp:${state.vlanId}:election`,'STATE','ROOT / PORT ELECTION',state.explanation),...localPorts.map((port)=>why(`state:stp:${state.vlanId}:${port.linkId}`,'STATE',`${port.linkId} · ${port.state}`,port.reason))]);});
  const activeLeases=pruneBuilderDhcpLeases(input.dhcpLeases,input.dhcpSequence).filter((lease)=>lease.clientDeviceId===deviceId||lease.serverDeviceId===deviceId);
  const leaseRows=activeLeases.map((lease)=>row(`state:dhcp:${lease.id}`,'DHCP LEASE',`${ethernetLabel(input.ethernet,lease.clientDeviceId)} · ${lease.address}`,`VLAN ${lease.vlanId} · server ${ethernetLabel(input.ethernet,lease.serverDeviceId)} · T1 ${lease.renewAtSequence} · T2 ${lease.rebindAtSequence} · EXP ${lease.expiresAtSequence}`,'good',[why(`state:dhcp:${lease.id}:pool`,'CONFIG','POOL',`Lease came from ${lease.poolId} with gateway ${lease.gateway??'MISSING'} and DNS ${lease.dnsServers.join(', ')||'MISSING'}.`),why(`state:dhcp:${lease.id}:ack`,'EVENT','DHCP ACK',`Lease was acquired/renewed at sequence ${lease.renewedAtSequence}.`),why(`state:dhcp:${lease.id}:clock`,'STATE','LEASE TIMER',`Current sequence ${input.dhcpSequence}; lease expires at ${lease.expiresAtSequence}.`)]));
  const flowRows=input.ethernetFlow&&input.ethernetFlow.segments.some((segment)=>segment.nodeIds.includes(deviceId))?[row(`state:lan-flow:${input.ethernetFlow.sourceId}:${input.ethernetFlow.destinationId}`,'LAST LAN FLOW',input.ethernetFlow.success?'DELIVERED':'FAILED',input.ethernetFlow.summary,input.ethernetFlow.success?'good':'bad',[why('state:lan-flow:path','STATE','FORWARDING SEGMENTS',input.ethernetFlow.segments.map((segment)=>`VLAN ${segment.vlanId}: ${segment.nodeIds.map((id)=>ethernetLabel(input.ethernet,id)).join(' → ')} · ${segment.disposition}`).join(' | ')),why('state:lan-flow:boundary','TOPOLOGY','L2/L3 BOUNDARY',input.ethernetFlow.routed?`TTL ${input.ethernetFlow.ttlBefore} → ${input.ethernetFlow.ttlAfter} at ${ethernetLabel(input.ethernet,input.ethernetFlow.routedAt??'')}.`:'Same-VLAN switching did not decrement IP TTL.')])]:[];
  return [section('lan-host-state','HOST / ARP STATE',[...hostRows,...arpRows],'No host or ARP state applies to this device.'),section('lan-switch-state','FDB / STP STATE',[...fdbRows,...stpRows],'No switching state applies to this device.'),section('lan-service-state','DHCP / FLOW STATE',[...leaseRows,...flowRows],'No lease or recent LAN-flow state applies to this device.')];
}

function eventViews(journal:BuilderWorkbenchEventJournal,device:BuilderDeviceRef):BuilderWorkbenchEventView[]{
  return journal.filter((event)=>event.deviceRefs.length===0||event.deviceRefs.some((ref)=>sameRef(ref,device))).slice(-40).reverse().map((event)=>({ ...event,causeChain:builderWorkbenchEventCausalChain(journal,event.id).map((cause)=>why(`${event.id}:cause:${cause.id}`,'EVENT',`#${String(cause.sequence).padStart(3,'0')} · ${cause.category.toUpperCase()}`,cause.detail)) }));
}

export function buildBuilderDeviceWorkbench(input:BuilderDeviceWorkbenchInput,requested:BuilderDeviceRef):BuilderDeviceWorkbenchSnapshot{
  const options=builderWorkbenchDeviceOptions(input.graph,input.ethernet);const device=options.find((candidate)=>sameRef(candidate,requested))??options[0]??{plane:'routed' as const,id:'none',label:'NO DEVICE',kind:'NONE',group:'NONE'};
  const configSections=device.plane==='routed'?routedConfigSections(input,device.id):ethernetConfigSections(input,device.id);
  const stateSections=device.plane==='routed'?routedStateSections(input,device.id):ethernetStateSections(input,device.id);
  return{device,configSections,stateSections,events:eventViews(input.events,device),configRowCount:configSections.reduce((sum,current)=>sum+current.rows.length,0),stateRowCount:stateSections.reduce((sum,current)=>sum+current.rows.length,0)};
}
