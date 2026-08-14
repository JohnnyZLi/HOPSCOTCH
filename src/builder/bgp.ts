import { interfacesForBuilderNode, normalizeBuilderIpv4, type BuilderAddressing } from './addressing.ts';
import type { BuilderGraph } from './model.ts';
import {
  DOCUMENTATION_ASNS,
  isDocumentationAsn,
  relationshipExportAllowed,
  type AsRelationship,
  type AsRole,
  type SimulatedAsGraph,
} from '../internet/asModel.ts';

export type BuilderBgpSessionMode = 'ebgp' | 'ibgp';
export type BuilderBgpExternalRelationship = 'peer' | 'customer-provider';
export type BuilderBgpLearnedRelationship = 'local' | 'customer' | 'peer' | 'provider';
export type BuilderBgpPolicyDirection = 'import' | 'export';
export type BuilderBgpPolicyAction = 'permit' | 'deny';

export interface BuilderBgpSession {
  id: string;
  linkId: string;
  aRouterId: string;
  bRouterId: string;
  enabled: boolean;
  relationship: 'internal' | BuilderBgpExternalRelationship;
  customerRouterId: string | null;
  nextHopSelf: boolean;
  allowRelationshipLeak: boolean;
}

export interface BuilderBgpOrigin {
  id: string;
  routerId: string;
  prefix: string;
  med: number;
  communities: string[];
  description: string;
}

export interface BuilderBgpPolicyRule {
  id: string;
  routerId: string;
  direction: BuilderBgpPolicyDirection;
  sessionId: string | null;
  order: number;
  action: BuilderBgpPolicyAction;
  prefix: string;
  setLocalPref: number | null;
  setMed: number | null;
  addCommunity: string | null;
  allowRelationshipLeak: boolean;
  description: string;
}

export interface BuilderBgpConfig {
  routerAsns: Record<string, number>;
  enabledRouterIds: string[];
  sessions: BuilderBgpSession[];
  origins: BuilderBgpOrigin[];
  policies: BuilderBgpPolicyRule[];
}

export interface BuilderBgpSessionState {
  id: string;
  linkId: string;
  aRouterId: string;
  bRouterId: string;
  aAsn: number;
  bAsn: number;
  mode: BuilderBgpSessionMode;
  state: 'ESTABLISHED' | 'IDLE';
  relationship: BuilderBgpSession['relationship'];
  reason: string;
}

export interface BuilderBgpRoute {
  id: string;
  routerId: string;
  prefix: string;
  originRouterId: string;
  originAsn: number;
  learnedFromRouterId: string | null;
  learnedSessionId: string | null;
  learnedVia: 'local' | BuilderBgpSessionMode;
  learnedFromRelationship: BuilderBgpLearnedRelationship;
  asPath: number[];
  localPref: number;
  med: number;
  nextHopRouterId: string;
  nextHopAddress: string;
  communities: string[];
  policyAnomaly: boolean;
  best: boolean;
  bestReason: string;
}

export interface BuilderBgpState {
  sessions: BuilderBgpSessionState[];
  routes: BuilderBgpRoute[];
  bestRoutes: BuilderBgpRoute[];
  convergenceRounds: number;
  leakedRouteIds: string[];
  multiOriginPrefixes: string[];
}

export interface BuilderBgpAsProjection {
  graph: SimulatedAsGraph;
  sourceAsn: number | null;
  destinationAsn: number | null;
  selectedPathAsns: number[];
  prefix: string | null;
}

interface PrefixValue { cidr: string; prefixLength: number; network: number; broadcast: number; }

function ipv4ToInt(value: string): number {
  return normalizeBuilderIpv4(value).split('.').reduce((result, part) => ((result << 8) | Number(part)) >>> 0, 0) >>> 0;
}
function intToIpv4(value: number): string { const n=value>>>0; return [24,16,8,0].map((shift)=>(n>>>shift)&255).join('.'); }
function parsePrefix(value: string): PrefixValue {
  const [rawAddress, rawLength, ...extra] = String(value ?? '').trim().split('/');
  if (!rawAddress || rawLength == null || extra.length || !/^\d{1,2}$/.test(rawLength)) throw new Error(`Invalid BGP IPv4 prefix ${value}.`);
  const prefixLength = Number(rawLength);
  if (!Number.isInteger(prefixLength) || prefixLength < 0 || prefixLength > 32) throw new Error('BGP prefixes must be /0 through /32.');
  const address = ipv4ToInt(rawAddress);
  const mask = prefixLength === 0 ? 0 : (0xffffffff << (32-prefixLength))>>>0;
  const network=(address&mask)>>>0; const broadcast=(network|(~mask>>>0))>>>0;
  return { cidr:`${intToIpv4(network)}/${prefixLength}`,prefixLength,network,broadcast };
}
function prefixContainsPrefix(parent: string, child: string): boolean {
  const a=parsePrefix(parent),b=parsePrefix(child); return a.prefixLength<=b.prefixLength && a.network<=b.network && a.broadcast>=b.broadcast;
}
function nodeIsRouter(graph:BuilderGraph,id:string):boolean{return graph.nodes.find((node)=>node.id===id)?.kind==='router';}
function directLink(graph:BuilderGraph,a:string,b:string){return graph.links.find((link)=>(link.a===a&&link.b===b)||(link.a===b&&link.b===a));}
function interfaceAddress(addressing:BuilderAddressing,linkId:string,nodeId:string):string|null{return addressing.segments[linkId]?.interfaces.find((entry)=>entry.nodeId===nodeId)?.address??null;}
function primaryAddress(addressing:BuilderAddressing,nodeId:string):string{return interfacesForBuilderNode(addressing,nodeId)[0]?.address??'0.0.0.0';}
function normalizeCommunities(values: readonly string[]): string[]{return [...new Set(values.map((value)=>String(value).trim()).filter((value)=>/^\d{1,10}:\d{1,10}$/.test(value)))].sort();}

export function createDefaultBuilderBgpConfig(): BuilderBgpConfig { return { routerAsns:{},enabledRouterIds:[],sessions:[],origins:[],policies:[] }; }
export function cloneBuilderBgpConfig(value:BuilderBgpConfig):BuilderBgpConfig{return{routerAsns:{...(value?.routerAsns??{})},enabledRouterIds:[...(value?.enabledRouterIds??[])],sessions:(value?.sessions??[]).map((entry)=>({...entry})),origins:(value?.origins??[]).map((entry)=>({...entry,communities:[...entry.communities]})),policies:(value?.policies??[]).map((entry)=>({...entry}))};}

export function builderBgpAsnForRouter(graph:BuilderGraph,config:BuilderBgpConfig,routerId:string):number{
  const explicit=config.routerAsns?.[routerId]; if(explicit&&isDocumentationAsn(explicit))return explicit;
  const routers=graph.nodes.filter((node)=>node.kind==='router').map((node)=>node.id).sort(); const index=Math.max(0,routers.indexOf(routerId)); return DOCUMENTATION_ASNS[index%DOCUMENTATION_ASNS.length];
}

export function validateBuilderBgpConfig(graph:BuilderGraph,value:BuilderBgpConfig|undefined):BuilderBgpConfig{
  const raw=value??createDefaultBuilderBgpConfig(); const routers=new Set(graph.nodes.filter((node)=>node.kind==='router').map((node)=>node.id));
  const routerAsns:Record<string,number>={}; for(const [routerId,rawAsn] of Object.entries(raw.routerAsns??{})){if(!routers.has(routerId))throw new Error(`BGP ASN override references non-router ${routerId}.`);const asn=Number(rawAsn);if(!isDocumentationAsn(asn))throw new Error(`BGP ASN ${asn} is outside HOPSCOTCH documentation ASN ranges.`);routerAsns[routerId]=asn;}
  const enabledRouterIds=[...new Set((raw.enabledRouterIds??[]).map(String))].sort();if(enabledRouterIds.some((id)=>!routers.has(id)))throw new Error('BGP can only be enabled on router nodes.');
  const sessionIds=new Set<string>();const sessions=(raw.sessions??[]).map((entry,index):BuilderBgpSession=>{if(!entry||typeof entry!=='object')throw new Error(`BGP session ${index+1} is invalid.`);const id=String(entry.id??'').trim();if(!id||sessionIds.has(id))throw new Error(`BGP session ${index+1} needs a unique id.`);sessionIds.add(id);const aRouterId=String(entry.aRouterId??''),bRouterId=String(entry.bRouterId??''),linkId=String(entry.linkId??'');if(!routers.has(aRouterId)||!routers.has(bRouterId)||aRouterId===bRouterId)throw new Error(`BGP session ${id} must connect two routers.`);const link=directLink(graph,aRouterId,bRouterId);if(!link||link.id!==linkId)throw new Error(`BGP session ${id} must use the direct Builder router link.`);const aAsn=builderBgpAsnForRouter(graph,{...raw,routerAsns},aRouterId),bAsn=builderBgpAsnForRouter(graph,{...raw,routerAsns},bRouterId);let relationship=entry.relationship as BuilderBgpSession['relationship'];let customerRouterId=entry.customerRouterId?String(entry.customerRouterId):null;if(aAsn===bAsn){relationship='internal';customerRouterId=null;}else{if(relationship!=='peer'&&relationship!=='customer-provider')relationship='peer';if(relationship==='customer-provider'&&customerRouterId!==aRouterId&&customerRouterId!==bRouterId)customerRouterId=aRouterId;if(relationship==='peer')customerRouterId=null;}return{id,linkId,aRouterId,bRouterId,enabled:entry.enabled!==false,relationship,customerRouterId,nextHopSelf:entry.nextHopSelf===true,allowRelationshipLeak:entry.allowRelationshipLeak===true};});
  const originIds=new Set<string>();const origins=(raw.origins??[]).map((entry,index):BuilderBgpOrigin=>{const routerId=String(entry.routerId??'');if(!routers.has(routerId))throw new Error(`BGP origin ${index+1} belongs to a non-router.`);const prefix=parsePrefix(String(entry.prefix??'')).cidr;const id=String(entry.id??`bgp-origin:${routerId}:${prefix}`).trim();if(!id||originIds.has(id))throw new Error(`BGP origin ${index+1} needs a unique id.`);originIds.add(id);const med=Math.max(0,Math.min(4294967295,Math.round(Number(entry.med)||0)));return{id,routerId,prefix,med,communities:normalizeCommunities(entry.communities??[]),description:String(entry.description??'').slice(0,100)};});
  const policyIds=new Set<string>();const policies=(raw.policies??[]).map((entry,index):BuilderBgpPolicyRule=>{const routerId=String(entry.routerId??'');if(!routers.has(routerId))throw new Error(`BGP policy ${index+1} belongs to a non-router.`);const direction=entry.direction==='export'?'export':'import';const sessionId=entry.sessionId==null?null:String(entry.sessionId);if(sessionId&&!sessionIds.has(sessionId))throw new Error(`BGP policy ${index+1} references unknown session ${sessionId}.`);const order=Math.max(1,Math.min(65535,Math.round(Number(entry.order)||10)));const prefix=parsePrefix(String(entry.prefix??'0.0.0.0/0')).cidr;const action=entry.action==='deny'?'deny':'permit';const id=String(entry.id??`bgp-policy:${routerId}:${direction}:${sessionId??'any'}:${order}`).trim();if(!id||policyIds.has(id))throw new Error(`BGP policy ${index+1} needs a unique id.`);policyIds.add(id);const local=entry.setLocalPref==null?null:Math.max(0,Math.min(4294967295,Math.round(Number(entry.setLocalPref)||0)));const med=entry.setMed==null?null:Math.max(0,Math.min(4294967295,Math.round(Number(entry.setMed)||0)));const community=entry.addCommunity&&/^\d{1,10}:\d{1,10}$/.test(String(entry.addCommunity).trim())?String(entry.addCommunity).trim():null;return{id,routerId,direction,sessionId,order,action,prefix,setLocalPref:local,setMed:med,addCommunity:community,allowRelationshipLeak:entry.allowRelationshipLeak===true,description:String(entry.description??'').slice(0,100)};}).sort((a,b)=>a.routerId.localeCompare(b.routerId)||a.direction.localeCompare(b.direction)||a.order-b.order||a.id.localeCompare(b.id));
  return{routerAsns,enabledRouterIds,sessions:sessions.sort((a,b)=>a.id.localeCompare(b.id)),origins:origins.sort((a,b)=>a.id.localeCompare(b.id)),policies};
}

export function reconcileBuilderBgpConfig(graph:BuilderGraph,current:BuilderBgpConfig):BuilderBgpConfig{
  const routers=new Set(graph.nodes.filter((node)=>node.kind==='router').map((node)=>node.id));const next=cloneBuilderBgpConfig(current??createDefaultBuilderBgpConfig());next.routerAsns=Object.fromEntries(Object.entries(next.routerAsns).filter(([id])=>routers.has(id)));next.enabledRouterIds=next.enabledRouterIds.filter((id)=>routers.has(id));next.sessions=next.sessions.filter((entry)=>routers.has(entry.aRouterId)&&routers.has(entry.bRouterId)&&directLink(graph,entry.aRouterId,entry.bRouterId)?.id===entry.linkId);const sessionIds=new Set(next.sessions.map((entry)=>entry.id));next.origins=next.origins.filter((entry)=>routers.has(entry.routerId));next.policies=next.policies.filter((entry)=>routers.has(entry.routerId)&&(!entry.sessionId||sessionIds.has(entry.sessionId)));return validateBuilderBgpConfig(graph,next);
}

export function setBuilderBgpRouterEnabled(graph:BuilderGraph,config:BuilderBgpConfig,routerId:string,enabled:boolean):BuilderBgpConfig{if(!nodeIsRouter(graph,routerId))throw new Error(`${routerId} is not a router.`);const next=reconcileBuilderBgpConfig(graph,config);const ids=new Set(next.enabledRouterIds);if(enabled)ids.add(routerId);else ids.delete(routerId);next.enabledRouterIds=[...ids].sort();return validateBuilderBgpConfig(graph,next);}
export function setBuilderBgpRouterAsn(graph:BuilderGraph,config:BuilderBgpConfig,routerId:string,asn:number):BuilderBgpConfig{if(!nodeIsRouter(graph,routerId))throw new Error(`${routerId} is not a router.`);if(!isDocumentationAsn(asn))throw new Error('Use RFC 5398 documentation ASNs: 64496–64511 or 65536–65551.');const next=reconcileBuilderBgpConfig(graph,config);next.routerAsns[routerId]=asn;return validateBuilderBgpConfig(graph,next);}

export function upsertBuilderBgpSession(graph:BuilderGraph,config:BuilderBgpConfig,linkId:string,relationship:BuilderBgpExternalRelationship='peer'):BuilderBgpConfig{const link=graph.links.find((entry)=>entry.id===linkId);if(!link||!nodeIsRouter(graph,link.a)||!nodeIsRouter(graph,link.b))throw new Error('BGP sessions require a direct router-router Builder link.');const next=reconcileBuilderBgpConfig(graph,config);const aAsn=builderBgpAsnForRouter(graph,next,link.a),bAsn=builderBgpAsnForRouter(graph,next,link.b);const id=`bgp-session:${link.id}`;const prior=next.sessions.find((entry)=>entry.id===id);const session:BuilderBgpSession={id,linkId:link.id,aRouterId:link.a,bRouterId:link.b,enabled:true,relationship:aAsn===bAsn?'internal':relationship,customerRouterId:aAsn===bAsn||relationship==='peer'?null:(prior?.customerRouterId??link.a),nextHopSelf:prior?.nextHopSelf??false,allowRelationshipLeak:prior?.allowRelationshipLeak??false};next.sessions=[...next.sessions.filter((entry)=>entry.id!==id),session];next.enabledRouterIds=[...new Set([...next.enabledRouterIds,link.a,link.b])].sort();return validateBuilderBgpConfig(graph,next);}
export function updateBuilderBgpSession(graph:BuilderGraph,config:BuilderBgpConfig,sessionId:string,patch:Partial<Pick<BuilderBgpSession,'enabled'|'relationship'|'customerRouterId'|'nextHopSelf'|'allowRelationshipLeak'>>):BuilderBgpConfig{const next=reconcileBuilderBgpConfig(graph,config);const prior=next.sessions.find((entry)=>entry.id===sessionId);if(!prior)throw new Error(`Unknown BGP session ${sessionId}.`);next.sessions=next.sessions.map((entry)=>entry.id===sessionId?{...entry,...patch}:entry);return validateBuilderBgpConfig(graph,next);}
export function deleteBuilderBgpSession(graph:BuilderGraph,config:BuilderBgpConfig,sessionId:string):BuilderBgpConfig{const next=reconcileBuilderBgpConfig(graph,config);next.sessions=next.sessions.filter((entry)=>entry.id!==sessionId);next.policies=next.policies.filter((entry)=>entry.sessionId!==sessionId);return validateBuilderBgpConfig(graph,next);}

export function upsertBuilderBgpOrigin(graph:BuilderGraph,config:BuilderBgpConfig,input:Omit<BuilderBgpOrigin,'id'> & {id?:string}):BuilderBgpConfig{if(!nodeIsRouter(graph,input.routerId))throw new Error(`${input.routerId} is not a router.`);const prefix=parsePrefix(input.prefix).cidr;const next=reconcileBuilderBgpConfig(graph,config);const id=input.id?.trim()||`bgp-origin:${input.routerId}:${prefix}`.replace('/','_');next.origins=[...next.origins.filter((entry)=>entry.id!==id&&!(entry.routerId===input.routerId&&entry.prefix===prefix)),{id,routerId:input.routerId,prefix,med:Math.max(0,Math.round(input.med)),communities:normalizeCommunities(input.communities),description:input.description.slice(0,100)}];next.enabledRouterIds=[...new Set([...next.enabledRouterIds,input.routerId])].sort();return validateBuilderBgpConfig(graph,next);}
export function deleteBuilderBgpOrigin(graph:BuilderGraph,config:BuilderBgpConfig,originId:string):BuilderBgpConfig{const next=reconcileBuilderBgpConfig(graph,config);next.origins=next.origins.filter((entry)=>entry.id!==originId);return validateBuilderBgpConfig(graph,next);}
export function upsertBuilderBgpPolicy(graph:BuilderGraph,config:BuilderBgpConfig,input:Omit<BuilderBgpPolicyRule,'id'> & {id?:string}):BuilderBgpConfig{const next=reconcileBuilderBgpConfig(graph,config);const id=input.id?.trim()||`bgp-policy:${input.routerId}:${input.direction}:${input.sessionId??'any'}:${input.order}`;next.policies=[...next.policies.filter((entry)=>entry.id!==id),{...input,id,prefix:parsePrefix(input.prefix).cidr,communities:undefined} as never];return validateBuilderBgpConfig(graph,next);}
export function deleteBuilderBgpPolicy(graph:BuilderGraph,config:BuilderBgpConfig,policyId:string):BuilderBgpConfig{const next=reconcileBuilderBgpConfig(graph,config);next.policies=next.policies.filter((entry)=>entry.id!==policyId);return validateBuilderBgpConfig(graph,next);}

function relationshipFrom(routerId:string,session:BuilderBgpSession):'customer'|'peer'|'provider'{if(session.relationship==='peer')return'peer';if(session.relationship==='internal')throw new Error('Internal session has no external relationship.');return session.customerRouterId===routerId?'provider':'customer';}
function receivedRelationship(receiverId:string,session:BuilderBgpSession):BuilderBgpLearnedRelationship{if(session.relationship==='peer')return'peer';if(session.relationship==='internal')return'local';return session.customerRouterId===receiverId?'provider':'customer';}
function sessionMode(graph:BuilderGraph,config:BuilderBgpConfig,session:BuilderBgpSession):BuilderBgpSessionMode{return builderBgpAsnForRouter(graph,config,session.aRouterId)===builderBgpAsnForRouter(graph,config,session.bRouterId)?'ibgp':'ebgp';}

function firstPolicy(config:BuilderBgpConfig,routerId:string,direction:BuilderBgpPolicyDirection,sessionId:string,prefix:string):BuilderBgpPolicyRule|null{return config.policies.filter((rule)=>rule.routerId===routerId&&rule.direction===direction&&(!rule.sessionId||rule.sessionId===sessionId)&&prefixContainsPrefix(rule.prefix,prefix)).sort((a,b)=>a.order-b.order||a.id.localeCompare(b.id))[0]??null;}
function mutateAttrs(route:BuilderBgpRoute,rule:BuilderBgpPolicyRule|null):BuilderBgpRoute{if(!rule)return route;return{...route,localPref:rule.setLocalPref??route.localPref,med:rule.setMed??route.med,communities:normalizeCommunities(rule.addCommunity?[...route.communities,rule.addCommunity]:route.communities)};}
function routeFingerprint(route:BuilderBgpRoute):string{return[route.routerId,route.prefix,route.originRouterId,route.learnedFromRouterId??'',route.learnedSessionId??'',route.learnedVia,route.learnedFromRelationship,route.asPath.join(','),route.localPref,route.med,route.nextHopRouterId,route.nextHopAddress,route.communities.join(','),route.policyAnomaly].join('|');}
function compareRoute(left:BuilderBgpRoute,right:BuilderBgpRoute):number{return right.localPref-left.localPref||left.asPath.length-right.asPath.length||left.med-right.med||(['local','ebgp','ibgp'].indexOf(left.learnedVia)-['local','ebgp','ibgp'].indexOf(right.learnedVia))||left.nextHopRouterId.localeCompare(right.nextHopRouterId)||left.originRouterId.localeCompare(right.originRouterId)||left.id.localeCompare(right.id);}
function bestReason(route:BuilderBgpRoute):string{return`BEST · LOCAL_PREF ${route.localPref} → AS_PATH ${route.asPath.length} → MED ${route.med} → ${route.learnedVia.toUpperCase()} → STABLE ROUTER-ID TIE BREAK`;}

function establishedSessions(graph:BuilderGraph,addressing:BuilderAddressing,config:BuilderBgpConfig):BuilderBgpSessionState[]{const enabled=new Set(config.enabledRouterIds);return config.sessions.map((session)=>{const aAsn=builderBgpAsnForRouter(graph,config,session.aRouterId),bAsn=builderBgpAsnForRouter(graph,config,session.bRouterId),mode:BuilderBgpSessionMode=aAsn===bAsn?'ibgp':'ebgp';const link=graph.links.find((entry)=>entry.id===session.linkId);const validAddresses=Boolean(interfaceAddress(addressing,session.linkId,session.aRouterId)&&interfaceAddress(addressing,session.linkId,session.bRouterId));const ok=session.enabled&&enabled.has(session.aRouterId)&&enabled.has(session.bRouterId)&&Boolean(link&&!link.failed)&&validAddresses;const state:BuilderBgpSessionState['state']=ok?'ESTABLISHED':'IDLE';return{id:session.id,linkId:session.linkId,aRouterId:session.aRouterId,bRouterId:session.bRouterId,aAsn,bAsn,mode,state,relationship:session.relationship,reason:!session.enabled?'ADMIN DOWN':!enabled.has(session.aRouterId)||!enabled.has(session.bRouterId)?'BGP DISABLED ON PEER':link?.failed?'LINK DOWN':!validAddresses?'NO IPV4 PEERING ADDRESS':'TCP/179 TEACHING SESSION ESTABLISHED'};}).sort((a,b)=>a.id.localeCompare(b.id));}

function localRoutes(graph:BuilderGraph,addressing:BuilderAddressing,config:BuilderBgpConfig):Map<string,Map<string,Map<string,BuilderBgpRoute>>>{const rib=new Map<string,Map<string,Map<string,BuilderBgpRoute>>>();for(const routerId of config.enabledRouterIds)rib.set(routerId,new Map());for(const origin of config.origins){if(!rib.has(origin.routerId))continue;const asn=builderBgpAsnForRouter(graph,config,origin.routerId);const route:BuilderBgpRoute={id:`bgp:${origin.routerId}:${origin.prefix}:local`,routerId:origin.routerId,prefix:origin.prefix,originRouterId:origin.routerId,originAsn:asn,learnedFromRouterId:null,learnedSessionId:null,learnedVia:'local',learnedFromRelationship:'local',asPath:[],localPref:100,med:origin.med,nextHopRouterId:origin.routerId,nextHopAddress:primaryAddress(addressing,origin.routerId),communities:[...origin.communities],policyAnomaly:false,best:false,bestReason:''};if(!rib.get(origin.routerId)!.has(origin.prefix))rib.get(origin.routerId)!.set(origin.prefix,new Map());rib.get(origin.routerId)!.get(origin.prefix)!.set(`local:${origin.id}`,route);}return rib;}
function cloneRib(source:Map<string,Map<string,Map<string,BuilderBgpRoute>>>):Map<string,Map<string,Map<string,BuilderBgpRoute>>>{const next=new Map<string,Map<string,Map<string,BuilderBgpRoute>>>();for(const [router,prefixes] of source){const p=new Map<string,Map<string,BuilderBgpRoute>>();for(const [prefix,routes] of prefixes)p.set(prefix,new Map([...routes].map(([key,route])=>[key,{...route,asPath:[...route.asPath],communities:[...route.communities]}])));next.set(router,p);}return next;}
function bestMap(rib:Map<string,Map<string,Map<string,BuilderBgpRoute>>>):Map<string,Map<string,BuilderBgpRoute>>{const result=new Map<string,Map<string,BuilderBgpRoute>>();for(const [router,prefixes] of rib){const map=new Map<string,BuilderBgpRoute>();for(const [prefix,routes] of prefixes){const best=[...routes.values()].sort(compareRoute)[0];if(best)map.set(prefix,best);}result.set(router,map);}return result;}
function ribFingerprint(rib:Map<string,Map<string,Map<string,BuilderBgpRoute>>>):string{return[...rib].flatMap(([router,prefixes])=>[...prefixes].flatMap(([prefix,routes])=>[...routes].map(([source,route])=>`${router}|${prefix}|${source}|${routeFingerprint(route)}`))).sort().join('\n');}

function advertise(graph:BuilderGraph,addressing:BuilderAddressing,config:BuilderBgpConfig,session:BuilderBgpSession,senderId:string,receiverId:string,input:BuilderBgpRoute):BuilderBgpRoute|null{
  const mode=sessionMode(graph,config,session);if(mode==='ibgp'&&input.learnedVia==='ibgp')return null;
  const exportRule=firstPolicy(config,senderId,'export',session.id,input.prefix);if(exportRule?.action==='deny')return null;
  let route=mutateAttrs(input,exportRule);
  let anomaly=route.policyAnomaly;
  if(mode==='ebgp'){
    const advertiseTo=relationshipFrom(senderId,session);const allowed=relationshipExportAllowed(route.learnedFromRelationship,advertiseTo);if(!allowed&&!session.allowRelationshipLeak&&!exportRule?.allowRelationshipLeak)return null;if(!allowed)anomaly=true;
    const senderAsn=builderBgpAsnForRouter(graph,config,senderId),receiverAsn=builderBgpAsnForRouter(graph,config,receiverId);const asPath=[senderAsn,...route.asPath];if(asPath.includes(receiverAsn))return null;const nextHopAddress=interfaceAddress(addressing,session.linkId,senderId);if(!nextHopAddress)return null;route={...route,routerId:receiverId,learnedFromRouterId:senderId,learnedSessionId:session.id,learnedVia:'ebgp',learnedFromRelationship:receivedRelationship(receiverId,session),asPath,localPref:100,nextHopRouterId:senderId,nextHopAddress,policyAnomaly:anomaly,id:`bgp:${receiverId}:${route.prefix}:${session.id}:${senderId}`};
  }else{
    const nextHopSelf=session.nextHopSelf;const nextHopAddress=nextHopSelf?interfaceAddress(addressing,session.linkId,senderId):route.nextHopAddress;if(!nextHopAddress)return null;route={...route,routerId:receiverId,learnedFromRouterId:senderId,learnedSessionId:session.id,learnedVia:'ibgp',nextHopRouterId:nextHopSelf?senderId:route.nextHopRouterId,nextHopAddress,policyAnomaly:anomaly,id:`bgp:${receiverId}:${route.prefix}:${session.id}:${senderId}`};
  }
  const importRule=firstPolicy(config,receiverId,'import',session.id,route.prefix);if(importRule?.action==='deny')return null;route=mutateAttrs(route,importRule);return route;
}

export function builderBgpState(graph:BuilderGraph,addressing:BuilderAddressing,input:BuilderBgpConfig):BuilderBgpState{
  const config=validateBuilderBgpConfig(graph,input);const sessionStates=establishedSessions(graph,addressing,config);const established=new Set(sessionStates.filter((entry)=>entry.state==='ESTABLISHED').map((entry)=>entry.id));const locals=localRoutes(graph,addressing,config);let rib=cloneRib(locals);let rounds=0;
  for(let round=0;round<64;round+=1){rounds=round+1;const best=bestMap(rib);const next=cloneRib(locals);for(const session of config.sessions){if(!established.has(session.id))continue;for(const [sender,receiver] of [[session.aRouterId,session.bRouterId],[session.bRouterId,session.aRouterId]] as const){for(const route of best.get(sender)?.values()??[]){const advertised=advertise(graph,addressing,config,session,sender,receiver,route);if(!advertised)continue;if(!next.has(receiver))next.set(receiver,new Map());if(!next.get(receiver)!.has(advertised.prefix))next.get(receiver)!.set(advertised.prefix,new Map());next.get(receiver)!.get(advertised.prefix)!.set(`${session.id}:${sender}`,advertised);}}}if(ribFingerprint(next)===ribFingerprint(rib)){rib=next;break;}rib=next;}
  const best=bestMap(rib);const routes:BuilderBgpRoute[]=[];for(const [router,prefixes] of rib)for(const [prefix,candidates] of prefixes){const winner=best.get(router)?.get(prefix);for(const candidate of candidates.values())routes.push({...candidate,best:Boolean(winner&&routeFingerprint(winner)===routeFingerprint(candidate)),bestReason:winner&&routeFingerprint(winner)===routeFingerprint(candidate)?bestReason(candidate):'CANDIDATE · lost deterministic best-path comparison'});}routes.sort((a,b)=>a.routerId.localeCompare(b.routerId)||a.prefix.localeCompare(b.prefix)||(a.best?-1:1)||compareRoute(a,b));const bestRoutes=routes.filter((route)=>route.best);const originMap=new Map<string,Set<number>>();for(const origin of config.origins){const set=originMap.get(origin.prefix)??new Set<number>();set.add(builderBgpAsnForRouter(graph,config,origin.routerId));originMap.set(origin.prefix,set);}return{sessions:sessionStates,routes,bestRoutes,convergenceRounds:rounds,leakedRouteIds:routes.filter((route)=>route.policyAnomaly).map((route)=>route.id),multiOriginPrefixes:[...originMap].filter(([,asns])=>asns.size>1).map(([prefix])=>prefix).sort()};
}

export function builderBgpBestRoutesForRouter(state:BuilderBgpState,routerId:string):BuilderBgpRoute[]{return state.bestRoutes.filter((route)=>route.routerId===routerId).sort((a,b)=>parsePrefix(b.prefix).prefixLength-parsePrefix(a.prefix).prefixLength||a.prefix.localeCompare(b.prefix));}

export function projectBuilderBgpToAsGraph(graph:BuilderGraph,config:BuilderBgpConfig,state?:BuilderBgpState,sourceRouterId?:string,destinationRouterId?:string,prefix?:string):BuilderBgpAsProjection{
  const validated=validateBuilderBgpConfig(graph,config);const asns=[...new Set(validated.enabledRouterIds.map((id)=>builderBgpAsnForRouter(graph,validated,id)))].sort((a,b)=>a-b);const eSessions=validated.sessions.filter((session)=>sessionMode(graph,validated,session)==='ebgp');const degree=new Map<number,number>();for(const session of eSessions){const a=builderBgpAsnForRouter(graph,validated,session.aRouterId),b=builderBgpAsnForRouter(graph,validated,session.bRouterId);degree.set(a,(degree.get(a)??0)+1);degree.set(b,(degree.get(b)??0)+1);}const originAsns=new Set(validated.origins.map((origin)=>builderBgpAsnForRouter(graph,validated,origin.routerId)));const nodes=asns.map((asn,index)=>{const angle=(Math.PI*2*index)/Math.max(1,asns.length)-Math.PI/2;const role:AsRole=originAsns.has(asn)?'content':(degree.get(asn)??0)>=3?'transit':(degree.get(asn)??0)>=2?'regional':'access';return{asn,label:`AS${asn}`,role,x:50+38*Math.cos(angle),y:50+38*Math.sin(angle)};});const relMap=new Map<string,AsRelationship>();for(const session of eSessions){const a=builderBgpAsnForRouter(graph,validated,session.aRouterId),b=builderBgpAsnForRouter(graph,validated,session.bRouterId);if(a===b)continue;const key=[a,b].sort((x,y)=>x-y).join(':');if(relMap.has(key))continue;if(session.relationship==='customer-provider'&&session.customerRouterId){const customer=builderBgpAsnForRouter(graph,validated,session.customerRouterId),provider=customer===a?b:a;relMap.set(key,{id:`builder-cp:${customer}:${provider}`,kind:'customer-provider',customer,provider});}else relMap.set(key,{id:`builder-peer:${Math.min(a,b)}:${Math.max(a,b)}`,kind:'peer',a:Math.min(a,b),b:Math.max(a,b)});}const sourceAsn=sourceRouterId&&nodeIsRouter(graph,sourceRouterId)?builderBgpAsnForRouter(graph,validated,sourceRouterId):asns[0]??null;const destinationAsn=destinationRouterId&&nodeIsRouter(graph,destinationRouterId)?builderBgpAsnForRouter(graph,validated,destinationRouterId):asns.at(-1)??null;const winner=state&&sourceRouterId?state.bestRoutes.find((route)=>route.routerId===sourceRouterId&&(!prefix||route.prefix===parsePrefix(prefix).cidr)):null;const selectedPathAsns=winner&&sourceAsn?[sourceAsn,...winner.asPath].filter((asn,index,all)=>index===0||asn!==all[index-1]):[];return{graph:{nodes,relationships:[...relMap.values()].sort((a,b)=>a.id.localeCompare(b.id))},sourceAsn,destinationAsn,selectedPathAsns,prefix:winner?.prefix??(prefix?parsePrefix(prefix).cidr:null)};
}
