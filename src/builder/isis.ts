import { interfacesForBuilderNode, parseBuilderIpv4Cidr, type BuilderAddressing } from './addressing.ts';
import type { BuilderGraph } from './model.ts';
import { builderPolicyPrefixContainsPrefix, type BuilderIsisConfig, type BuilderIsisLevel } from './routing-policy.ts';

export interface BuilderIsisAdjacency {
  id: string;
  linkId: string;
  aRouterId: string;
  bRouterId: string;
  level: BuilderIsisLevel;
  state: 'UP' | 'DOWN';
  reason: string;
}

export interface BuilderIsisLsp {
  id: string;
  routerId: string;
  areaId: string;
  prefix: string;
  linkId: string;
  metric: number;
  level: 'L1' | 'L2';
}

export interface BuilderIsisState {
  enabledRouterIds: string[];
  adjacencies: BuilderIsisAdjacency[];
  lsps: BuilderIsisLsp[];
  l1Areas: string[];
  l2RouterIds: string[];
}

export interface BuilderIsisInjectedRoute {
  id: string;
  originRouterId: string;
  prefix: string;
  metric: number;
  source: 'connected' | 'static' | 'ospf' | 'bgp' | 'summary';
  routeTag: number;
  redistributionRuleId: string | null;
  summaryId: string | null;
}

export interface BuilderIsisRouteEntry {
  id: string;
  routerId: string;
  prefix: string;
  prefixLength: number;
  administrativeDistance: 115;
  metric: number;
  nextHop: string;
  outgoingInterface: string;
  linkId: string;
  active: true;
  stateNote: string;
  isisLevel: 'L1' | 'L2';
  isisAreaId: string;
  isisOriginRouterId: string;
  redistributedFrom?: BuilderIsisInjectedRoute['source'];
  redistributionRuleId?: string | null;
  routeTag?: number;
  summaryId?: string | null;
}

interface Edge { neighbor:string; linkId:string; cost:number; level:'L1'|'L2' }
interface PathSet { reachable:boolean; totalCost:number; firstHops:Array<{nextRouterId:string;linkId:string}>; level:'L1'|'L2' }

function routerConfig(config:BuilderIsisConfig,routerId:string){return config.routers.find((entry)=>entry.routerId===routerId&&entry.enabled)??null;}
function linkLevel(config:BuilderIsisConfig,linkId:string):BuilderIsisLevel{return config.links.find((entry)=>entry.linkId===linkId)?.level??'L1L2';}
function permits(level:BuilderIsisLevel,target:'L1'|'L2'):boolean{return level===target||level==='L1L2';}
function nodeIsRouter(graph:BuilderGraph,id:string):boolean{return graph.nodes.find((node)=>node.id===id)?.kind==='router';}
function interfaceOn(addressing:BuilderAddressing,linkId:string,nodeId:string){return addressing.segments[linkId]?.interfaces.find((entry)=>entry.nodeId===nodeId)??null;}

export function builderIsisState(graph:BuilderGraph,addressing:BuilderAddressing,config:BuilderIsisConfig):BuilderIsisState{
  const enabledRouterIds=config.routers.filter((entry)=>entry.enabled&&nodeIsRouter(graph,entry.routerId)).map((entry)=>entry.routerId).sort();
  const enabled=new Set(enabledRouterIds);const adjacencies:BuilderIsisAdjacency[]=[];
  for(const link of graph.links){if(!enabled.has(link.a)||!enabled.has(link.b)||!nodeIsRouter(graph,link.a)||!nodeIsRouter(graph,link.b))continue;const a=routerConfig(config,link.a)!,b=routerConfig(config,link.b)!,ll=linkLevel(config,link.id);const l1=permits(a.level,'L1')&&permits(b.level,'L1')&&permits(ll,'L1')&&a.areaId===b.areaId;const l2=permits(a.level,'L2')&&permits(b.level,'L2')&&permits(ll,'L2');const level:BuilderIsisLevel=l1&&l2?'L1L2':l2?'L2':'L1';const compatible=l1||l2;adjacencies.push({id:`isis-adj:${link.id}`,linkId:link.id,aRouterId:link.a,bRouterId:link.b,level,state:link.failed||!compatible?'DOWN':'UP',reason:link.failed?'LINK DOWN':!compatible?'LEVEL / AREA MISMATCH':l1&&l2?'L1 + L2 ADJACENCY':l2?'L2 ADJACENCY':'L1 SAME-AREA ADJACENCY'});}
  const lsps:BuilderIsisLsp[]=[];
  for(const routerId of enabledRouterIds){const router=routerConfig(config,routerId)!;for(const iface of interfacesForBuilderNode(addressing,routerId)){const link=graph.links.find((entry)=>entry.id===iface.linkId);if(!link||link.failed)continue;const prefix=parseBuilderIpv4Cidr(iface.cidr).cidr;if(permits(router.level,'L1'))lsps.push({id:`isis-lsp:l1:${routerId}:${iface.linkId}`,routerId,areaId:router.areaId,prefix,linkId:iface.linkId,metric:link.cost,level:'L1'});if(permits(router.level,'L2'))lsps.push({id:`isis-lsp:l2:${routerId}:${iface.linkId}`,routerId,areaId:router.areaId,prefix,linkId:iface.linkId,metric:link.cost,level:'L2'});}}
  return{enabledRouterIds,adjacencies:adjacencies.sort((a,b)=>a.linkId.localeCompare(b.linkId)),lsps:lsps.sort((a,b)=>a.level.localeCompare(b.level)||a.routerId.localeCompare(b.routerId)||a.prefix.localeCompare(b.prefix)),l1Areas:[...new Set(config.routers.filter((entry)=>entry.enabled&&permits(entry.level,'L1')).map((entry)=>entry.areaId))].sort(),l2RouterIds:config.routers.filter((entry)=>entry.enabled&&permits(entry.level,'L2')).map((entry)=>entry.routerId).sort()};
}

function adjacency(config:BuilderIsisConfig,state:BuilderIsisState,level:'L1'|'L2',areaId:string|null):Map<string,Edge[]>{const map=new Map<string,Edge[]>();for(const id of state.enabledRouterIds)map.set(id,[]);for(const adj of state.adjacencies){if(adj.state!=='UP'||!permits(adj.level,level))continue;const a=routerConfig(config,adj.aRouterId),b=routerConfig(config,adj.bRouterId);if(!a||!b)continue;if(level==='L1'&&(a.areaId!==b.areaId||a.areaId!==areaId))continue;const cost=1;map.get(adj.aRouterId)?.push({neighbor:adj.bRouterId,linkId:adj.linkId,cost,level});map.get(adj.bRouterId)?.push({neighbor:adj.aRouterId,linkId:adj.linkId,cost,level});}for(const edges of map.values())edges.sort((a,b)=>a.neighbor.localeCompare(b.neighbor)||a.linkId.localeCompare(b.linkId));return map;}
function graphCost(graph:BuilderGraph,linkId:string):number{return graph.links.find((entry)=>entry.id===linkId)?.cost??1;}
function distances(graph:BuilderGraph,map:Map<string,Edge[]>,start:string):Map<string,number>{const dist=new Map<string,number>([...map.keys()].map((id)=>[id,Number.POSITIVE_INFINITY]));const done=new Set<string>();if(!map.has(start))return dist;dist.set(start,0);while(done.size<map.size){let current:string|null=null,cost=Number.POSITIVE_INFINITY;for(const[id,value]of dist){if(done.has(id))continue;if(value<cost||(value===cost&&current!==null&&id.localeCompare(current)<0)){current=id;cost=value;}}if(current===null||!Number.isFinite(cost))break;done.add(current);for(const edge of map.get(current)??[]){const next=cost+graphCost(graph,edge.linkId);if(next<(dist.get(edge.neighbor)??Infinity))dist.set(edge.neighbor,next);}}return dist;}
function pathSet(graph:BuilderGraph,config:BuilderIsisConfig,state:BuilderIsisState,source:string,destination:string):PathSet{
  if(source===destination)return{reachable:true,totalCost:0,firstHops:[],level:'L1'};const a=routerConfig(config,source),b=routerConfig(config,destination);if(!a||!b)return{reachable:false,totalCost:0,firstHops:[],level:'L2'};const level:'L1'|'L2'=a.areaId===b.areaId&&permits(a.level,'L1')&&permits(b.level,'L1')?'L1':'L2';const map=adjacency(config,state,level,level==='L1'?a.areaId:null);const from=distances(graph,map,source),to=distances(graph,map,destination),total=from.get(destination)??Infinity;if(!Number.isFinite(total))return{reachable:false,totalCost:0,firstHops:[],level};const first=(map.get(source)??[]).filter((edge)=>graphCost(graph,edge.linkId)+(to.get(edge.neighbor)??Infinity)===total).map((edge)=>({nextRouterId:edge.neighbor,linkId:edge.linkId})).sort((x,y)=>x.nextRouterId.localeCompare(y.nextRouterId)||x.linkId.localeCompare(y.linkId));return{reachable:first.length>0,totalCost:total,firstHops:first,level};
}

function nativeOrigins(state:BuilderIsisState):Array<{routerId:string;prefix:string;metric:number;source:'connected';injected?:undefined}>{const by=new Map<string,{routerId:string;prefix:string;metric:number;source:'connected'}>();for(const lsp of state.lsps){const key=`${lsp.routerId}|${lsp.prefix}`;if(!by.has(key))by.set(key,{routerId:lsp.routerId,prefix:lsp.prefix,metric:lsp.metric,source:'connected'});}return[...by.values()];}

export function builderIsisRouteEntriesForRouter(graph:BuilderGraph,addressing:BuilderAddressing,config:BuilderIsisConfig,routerId:string,injected:readonly BuilderIsisInjectedRoute[]=[]):BuilderIsisRouteEntry[]{
  const viewer=routerConfig(config,routerId);if(!viewer)return[];const state=builderIsisState(graph,addressing,config);const origins=[...nativeOrigins(state),...injected.map((entry)=>({routerId:entry.originRouterId,prefix:entry.prefix,metric:entry.metric,source:entry.source,injected:entry}))];const entries:BuilderIsisRouteEntry[]=[];
  for(const origin of origins){if(origin.routerId===routerId)continue;const path=pathSet(graph,config,state,routerId,origin.routerId);if(!path.reachable)continue;for(const first of path.firstHops){const local=interfaceOn(addressing,first.linkId,routerId),remote=interfaceOn(addressing,first.linkId,first.nextRouterId);if(!local||!remote)continue;const parsed=parseBuilderIpv4Cidr(origin.prefix);const injectedRoute='injected'in origin?origin.injected:undefined;entries.push({id:`isis:${routerId}:${parsed.cidr}:${origin.routerId}:${first.linkId}${injectedRoute?`:${injectedRoute.id}`:''}`.replaceAll('/','_'),routerId,prefix:parsed.cidr,prefixLength:parsed.prefixLength,administrativeDistance:115,metric:path.totalCost+origin.metric,nextHop:remote.address,outgoingInterface:local.name,linkId:first.linkId,active:true,stateNote:`IS-IS ${path.level} · ORIGIN ${origin.routerId.toUpperCase()}${injectedRoute?` · REDISTRIBUTED ${injectedRoute.source.toUpperCase()} · TAG ${injectedRoute.routeTag}`:''}`,isisLevel:path.level,isisAreaId:viewer.areaId,isisOriginRouterId:origin.routerId,...(injectedRoute?{redistributedFrom:injectedRoute.source,redistributionRuleId:injectedRoute.redistributionRuleId,routeTag:injectedRoute.routeTag,summaryId:injectedRoute.summaryId}:{})});}}
  const byPrefix=new Map<string,BuilderIsisRouteEntry[]>();for(const entry of entries)byPrefix.set(entry.prefix,[...(byPrefix.get(entry.prefix)??[]),entry]);const winners:BuilderIsisRouteEntry[]=[];for(const candidates of byPrefix.values()){const best=Math.min(...candidates.map((entry)=>entry.metric));const equal=candidates.filter((entry)=>entry.metric===best).sort((a,b)=>a.id.localeCompare(b.id));winners.push(...equal.map((entry)=>({...entry,stateNote:`${entry.stateNote}${equal.length>1?` · ECMP ${equal.length}-WAY`:''}`})));}return winners.sort((a,b)=>b.prefixLength-a.prefixLength||a.metric-b.metric||a.id.localeCompare(b.id));
}

export function builderIsisMatchingNativePrefixes(state:BuilderIsisState,routerId:string,filter:string):string[]{return[...new Set(state.lsps.filter((entry)=>entry.routerId===routerId&&builderPolicyPrefixContainsPrefix(filter,entry.prefix)).map((entry)=>entry.prefix))].sort();}
