import { normalizeBuilderIpv4, type BuilderAddressing } from './addressing.ts';
import { cloneBuilderGraph, type BuilderGraph } from './model.ts';

export type BuilderRedistributionSource = 'connected' | 'static' | 'ospf' | 'bgp' | 'isis';
export type BuilderRedistributionTarget = 'ospf' | 'bgp' | 'isis';
export type BuilderPbrProtocol = 'ip' | 'icmp' | 'tcp' | 'udp';
export type BuilderEcmpHashMode = 'l3' | 'l4' | 'full';
export type BuilderSummarySource = BuilderRedistributionSource;
export type BuilderSummaryTarget = 'none' | BuilderRedistributionTarget;
export type BuilderIsisLevel = 'L1' | 'L2' | 'L1L2';

export interface BuilderRedistributionRule {
  id: string;
  routerId: string;
  source: BuilderRedistributionSource;
  target: BuilderRedistributionTarget;
  prefix: string;
  metric: number;
  routeTag: number;
  enabled: boolean;
  allowFeedback: boolean;
  description: string;
}

export interface BuilderPbrRule {
  id: string;
  routerId: string;
  order: number;
  sourcePrefix: string;
  destinationPrefix: string;
  protocol: BuilderPbrProtocol;
  sourcePort: number | null;
  destinationPort: number | null;
  nextHop: string;
  enabled: boolean;
  description: string;
}

export interface BuilderEcmpProfile {
  routerId: string;
  hashMode: BuilderEcmpHashMode;
  maxPaths: number;
}

export interface BuilderRouteSummary {
  id: string;
  routerId: string;
  source: BuilderSummarySource;
  prefix: string;
  advertiseInto: BuilderSummaryTarget;
  metric: number;
  discard: boolean;
  description: string;
}

export interface BuilderOspfInterfaceTimer {
  id: string;
  routerId: string;
  linkId: string;
  helloIntervalMs: number;
  deadIntervalMs: number;
}

export interface BuilderIsisRouterConfig {
  routerId: string;
  enabled: boolean;
  areaId: string;
  level: BuilderIsisLevel;
}

export interface BuilderIsisLinkConfig {
  linkId: string;
  level: BuilderIsisLevel;
}

export interface BuilderIsisConfig {
  routers: BuilderIsisRouterConfig[];
  links: BuilderIsisLinkConfig[];
}

export interface BuilderRoutingPolicyConfig {
  redistributions: BuilderRedistributionRule[];
  pbrRules: BuilderPbrRule[];
  ecmpProfiles: BuilderEcmpProfile[];
  summaries: BuilderRouteSummary[];
  ospfTimers: BuilderOspfInterfaceTimer[];
  isis: BuilderIsisConfig;
}

export interface BuilderRedistributionHazard {
  id: string;
  routerId: string;
  protocols: string[];
  ruleIds: string[];
  severity: 'LOOP RISK' | 'FEEDBACK ALLOWED';
  detail: string;
}

export interface BuilderPbrPacketKey {
  sourceAddress: string;
  destinationAddress: string;
  protocol: string;
  sourcePort: number | null;
  destinationPort: number | null;
}

export interface BuilderPbrDecision {
  matched: boolean;
  rule: BuilderPbrRule | null;
  reason: string;
}

interface PrefixValue { cidr: string; prefixLength: number; network: number; broadcast: number }

const PROTOCOLS: BuilderRedistributionSource[] = ['connected', 'static', 'ospf', 'bgp', 'isis'];
const TARGETS: BuilderRedistributionTarget[] = ['ospf', 'bgp', 'isis'];
const HASH_MODES: BuilderEcmpHashMode[] = ['l3', 'l4', 'full'];
const ISIS_LEVELS: BuilderIsisLevel[] = ['L1', 'L2', 'L1L2'];

function nodeIsRouter(graph: BuilderGraph, id: string): boolean { return graph.nodes.find((node) => node.id === id)?.kind === 'router'; }
function linkById(graph: BuilderGraph, id: string) { return graph.links.find((link) => link.id === id) ?? null; }
function ipv4ToInt(value: string): number { return normalizeBuilderIpv4(value).split('.').reduce((result, part) => ((result << 8) | Number(part)) >>> 0, 0) >>> 0; }
function intToIpv4(value: number): string { const n=value>>>0; return [24,16,8,0].map((shift)=>(n>>>shift)&255).join('.'); }
export function parseBuilderPolicyPrefix(value: string): PrefixValue {
  const [rawAddress, rawLength, ...extra] = String(value ?? '').trim().split('/');
  if (!rawAddress || rawLength == null || extra.length || !/^\d{1,2}$/.test(rawLength)) throw new Error(`Invalid IPv4 prefix ${value}.`);
  const prefixLength = Number(rawLength);
  if (!Number.isInteger(prefixLength) || prefixLength < 0 || prefixLength > 32) throw new Error('IPv4 prefixes must be /0 through /32.');
  const address = ipv4ToInt(rawAddress);
  const mask = prefixLength === 0 ? 0 : (0xffffffff << (32-prefixLength))>>>0;
  const network=(address&mask)>>>0, broadcast=(network|(~mask>>>0))>>>0;
  return { cidr:`${intToIpv4(network)}/${prefixLength}`,prefixLength,network,broadcast };
}
export function builderPolicyPrefixContains(prefix: string, address: string): boolean { const p=parseBuilderPolicyPrefix(prefix), a=ipv4ToInt(address); return a>=p.network&&a<=p.broadcast; }
export function builderPolicyPrefixContainsPrefix(parent: string, child: string): boolean { const a=parseBuilderPolicyPrefix(parent),b=parseBuilderPolicyPrefix(child);return a.prefixLength<=b.prefixLength&&a.network<=b.network&&a.broadcast>=b.broadcast; }

export function createDefaultBuilderRoutingPolicyConfig(): BuilderRoutingPolicyConfig {
  return { redistributions: [], pbrRules: [], ecmpProfiles: [], summaries: [], ospfTimers: [], isis: { routers: [], links: [] } };
}

export function cloneBuilderRoutingPolicyConfig(value: BuilderRoutingPolicyConfig | undefined): BuilderRoutingPolicyConfig {
  const current=value??createDefaultBuilderRoutingPolicyConfig();
  return {
    redistributions:(current.redistributions??[]).map((entry)=>({...entry})),
    pbrRules:(current.pbrRules??[]).map((entry)=>({...entry})),
    ecmpProfiles:(current.ecmpProfiles??[]).map((entry)=>({...entry})),
    summaries:(current.summaries??[]).map((entry)=>({...entry})),
    ospfTimers:(current.ospfTimers??[]).map((entry)=>({...entry})),
    isis:{routers:(current.isis?.routers??[]).map((entry)=>({...entry})),links:(current.isis?.links??[]).map((entry)=>({...entry}))},
  };
}

function validPort(value: unknown): number | null { if(value==null||value==='')return null;const n=Number(value);if(!Number.isInteger(n)||n<1||n>65535)throw new Error('PBR ports must be 1–65535.');return n; }
function directNextHop(graph: BuilderGraph,addressing:BuilderAddressing,routerId:string,address:string):boolean{
  const normalized=normalizeBuilderIpv4(address);
  return graph.links.some((link)=>{if(link.a!==routerId&&link.b!==routerId)return false;return Boolean(addressing.segments[link.id]?.interfaces.some((entry)=>entry.nodeId!==routerId&&entry.address===normalized));});
}

export function validateBuilderRoutingPolicyConfig(graph: BuilderGraph,addressing:BuilderAddressing,value:BuilderRoutingPolicyConfig|undefined):BuilderRoutingPolicyConfig{
  const raw=value??createDefaultBuilderRoutingPolicyConfig();
  const ids=new Set<string>();
  const redistributions=(raw.redistributions??[]).map((entry,index):BuilderRedistributionRule=>{
    const id=String(entry?.id??'').trim();if(!id||ids.has(id)||!/^[a-zA-Z0-9_.:-]+$/.test(id))throw new Error(`Redistribution rule ${index+1} needs a unique id.`);ids.add(id);
    const routerId=String(entry.routerId??'');if(!nodeIsRouter(graph,routerId))throw new Error(`Redistribution ${id} belongs to a non-router.`);
    const source=entry.source as BuilderRedistributionSource,target=entry.target as BuilderRedistributionTarget;if(!PROTOCOLS.includes(source)||!TARGETS.includes(target)||source===target)throw new Error(`Redistribution ${id} needs two different supported protocols.`);
    const metric=Math.max(1,Math.min(16_777_215,Math.round(Number(entry.metric)||1)));const routeTag=Math.max(0,Math.min(4_294_967_295,Math.round(Number(entry.routeTag)||0)));
    return{id,routerId,source,target,prefix:parseBuilderPolicyPrefix(entry.prefix??'0.0.0.0/0').cidr,metric,routeTag,enabled:entry.enabled!==false,allowFeedback:entry.allowFeedback===true,description:String(entry.description??'').slice(0,100)};
  }).sort((a,b)=>a.routerId.localeCompare(b.routerId)||a.source.localeCompare(b.source)||a.target.localeCompare(b.target)||a.id.localeCompare(b.id));
  const pbrIds=new Set<string>();
  const pbrRules=(raw.pbrRules??[]).map((entry,index):BuilderPbrRule=>{
    const id=String(entry?.id??'').trim();if(!id||pbrIds.has(id)||!/^[a-zA-Z0-9_.:-]+$/.test(id))throw new Error(`PBR rule ${index+1} needs a unique id.`);pbrIds.add(id);const routerId=String(entry.routerId??'');if(!nodeIsRouter(graph,routerId))throw new Error(`PBR ${id} belongs to a non-router.`);
    const protocol=(['icmp','tcp','udp'].includes(entry.protocol)?entry.protocol:'ip') as BuilderPbrProtocol;const nextHop=normalizeBuilderIpv4(String(entry.nextHop??''));if(!directNextHop(graph,addressing,routerId,nextHop))throw new Error(`PBR ${id} next hop ${nextHop} must be directly connected to ${routerId}.`);
    return{id,routerId,order:Math.max(1,Math.min(65535,Math.round(Number(entry.order)||10))),sourcePrefix:parseBuilderPolicyPrefix(entry.sourcePrefix??'0.0.0.0/0').cidr,destinationPrefix:parseBuilderPolicyPrefix(entry.destinationPrefix??'0.0.0.0/0').cidr,protocol,sourcePort:validPort(entry.sourcePort),destinationPort:validPort(entry.destinationPort),nextHop,enabled:entry.enabled!==false,description:String(entry.description??'').slice(0,100)};
  }).sort((a,b)=>a.routerId.localeCompare(b.routerId)||a.order-b.order||a.id.localeCompare(b.id));
  const ecmpSeen=new Set<string>();
  const ecmpProfiles=(raw.ecmpProfiles??[]).map((entry):BuilderEcmpProfile=>{const routerId=String(entry.routerId??'');if(!nodeIsRouter(graph,routerId)||ecmpSeen.has(routerId))throw new Error(`ECMP profile ${routerId||'UNKNOWN'} is invalid or duplicated.`);ecmpSeen.add(routerId);const hashMode=HASH_MODES.includes(entry.hashMode)?entry.hashMode:'full';return{routerId,hashMode,maxPaths:Math.max(1,Math.min(16,Math.round(Number(entry.maxPaths)||8)))};}).sort((a,b)=>a.routerId.localeCompare(b.routerId));
  const summaryIds=new Set<string>();
  const summaries=(raw.summaries??[]).map((entry,index):BuilderRouteSummary=>{const id=String(entry?.id??'').trim();if(!id||summaryIds.has(id)||!/^[a-zA-Z0-9_.:-]+$/.test(id))throw new Error(`Summary ${index+1} needs a unique id.`);summaryIds.add(id);const routerId=String(entry.routerId??'');if(!nodeIsRouter(graph,routerId))throw new Error(`Summary ${id} belongs to a non-router.`);const source=entry.source as BuilderSummarySource;if(!PROTOCOLS.includes(source))throw new Error(`Summary ${id} source is unsupported.`);const advertiseInto=(entry.advertiseInto??'none') as BuilderSummaryTarget;if(advertiseInto!=='none'&&!TARGETS.includes(advertiseInto))throw new Error(`Summary ${id} target is unsupported.`);return{id,routerId,source,prefix:parseBuilderPolicyPrefix(entry.prefix).cidr,advertiseInto,metric:Math.max(1,Math.min(16_777_215,Math.round(Number(entry.metric)||1))),discard:entry.discard!==false,description:String(entry.description??'').slice(0,100)};}).sort((a,b)=>a.routerId.localeCompare(b.routerId)||a.prefix.localeCompare(b.prefix)||a.id.localeCompare(b.id));
  const timerIds=new Set<string>();
  const ospfTimers=(raw.ospfTimers??[]).map((entry,index):BuilderOspfInterfaceTimer=>{const routerId=String(entry.routerId??''),linkId=String(entry.linkId??'');const link=linkById(graph,linkId);if(!nodeIsRouter(graph,routerId)||!link||(link.a!==routerId&&link.b!==routerId))throw new Error(`OSPF timer ${index+1} must reference a router interface.`);const id=String(entry.id??`ospf-timer:${routerId}:${linkId}`);if(timerIds.has(id))throw new Error(`Duplicate OSPF timer ${id}.`);timerIds.add(id);const helloIntervalMs=Math.max(100,Math.min(120_000,Math.round(Number(entry.helloIntervalMs)||10_000))),deadIntervalMs=Math.max(100,Math.min(600_000,Math.round(Number(entry.deadIntervalMs)||40_000)));if(deadIntervalMs<helloIntervalMs)throw new Error(`OSPF timer ${id} dead interval must be >= hello interval.`);return{id,routerId,linkId,helloIntervalMs,deadIntervalMs};}).sort((a,b)=>a.linkId.localeCompare(b.linkId)||a.routerId.localeCompare(b.routerId));
  const isisRouterSeen=new Set<string>();
  const isisRouters=(raw.isis?.routers??[]).map((entry):BuilderIsisRouterConfig=>{const routerId=String(entry.routerId??'');if(!nodeIsRouter(graph,routerId)||isisRouterSeen.has(routerId))throw new Error(`IS-IS router ${routerId||'UNKNOWN'} is invalid or duplicated.`);isisRouterSeen.add(routerId);const areaId=String(entry.areaId??'49.0001').trim();if(!/^49\.\d{4}$/.test(areaId))throw new Error(`IS-IS area ${areaId} must use teaching format 49.xxxx.`);const level=ISIS_LEVELS.includes(entry.level)?entry.level:'L2';return{routerId,enabled:entry.enabled!==false,areaId,level};}).sort((a,b)=>a.routerId.localeCompare(b.routerId));
  const isisLinkSeen=new Set<string>();
  const isisLinks=(raw.isis?.links??[]).map((entry):BuilderIsisLinkConfig=>{const linkId=String(entry.linkId??'');const link=linkById(graph,linkId);if(!link||!nodeIsRouter(graph,link.a)||!nodeIsRouter(graph,link.b)||isisLinkSeen.has(linkId))throw new Error(`IS-IS link ${linkId||'UNKNOWN'} is invalid or duplicated.`);isisLinkSeen.add(linkId);return{linkId,level:ISIS_LEVELS.includes(entry.level)?entry.level:'L2'};}).sort((a,b)=>a.linkId.localeCompare(b.linkId));
  return{redistributions,pbrRules,ecmpProfiles,summaries,ospfTimers,isis:{routers:isisRouters,links:isisLinks}};
}

export function reconcileBuilderRoutingPolicyConfig(graph:BuilderGraph,addressing:BuilderAddressing,value:BuilderRoutingPolicyConfig|undefined):BuilderRoutingPolicyConfig{
  const next=cloneBuilderRoutingPolicyConfig(value);const routers=new Set(graph.nodes.filter((node)=>node.kind==='router').map((node)=>node.id)),links=new Set(graph.links.map((link)=>link.id));
  next.redistributions=next.redistributions.filter((entry)=>routers.has(entry.routerId));next.pbrRules=next.pbrRules.filter((entry)=>routers.has(entry.routerId)&&directNextHop(graph,addressing,entry.routerId,entry.nextHop));next.ecmpProfiles=next.ecmpProfiles.filter((entry)=>routers.has(entry.routerId));next.summaries=next.summaries.filter((entry)=>routers.has(entry.routerId));next.ospfTimers=next.ospfTimers.filter((entry)=>routers.has(entry.routerId)&&links.has(entry.linkId));next.isis.routers=next.isis.routers.filter((entry)=>routers.has(entry.routerId));next.isis.links=next.isis.links.filter((entry)=>links.has(entry.linkId));return validateBuilderRoutingPolicyConfig(graph,addressing,next);
}

export function builderRedistributionHazards(config:BuilderRoutingPolicyConfig):BuilderRedistributionHazard[]{
  const hazards:BuilderRedistributionHazard[]=[];const byRouter=new Map<string,BuilderRedistributionRule[]>();for(const rule of config.redistributions.filter((entry)=>entry.enabled))byRouter.set(rule.routerId,[...(byRouter.get(rule.routerId)??[]),rule]);
  for(const [routerId,rules] of byRouter){for(const a of rules){const reverse=rules.find((b)=>b.id!==a.id&&b.source===a.target&&b.target===a.source&&builderPolicyPrefixContainsPrefix(a.prefix,b.prefix)&&builderPolicyPrefixContainsPrefix(b.prefix,a.prefix));if(!reverse||a.id.localeCompare(reverse.id)>0)continue;const feedback=a.allowFeedback||reverse.allowFeedback;hazards.push({id:`redist-hazard:${routerId}:${a.id}:${reverse.id}`,routerId,protocols:[a.source,a.target],ruleIds:[a.id,reverse.id],severity:feedback?'FEEDBACK ALLOWED':'LOOP RISK',detail:feedback?`${routerId.toUpperCase()} explicitly permits one bounded feedback edge between ${a.source.toUpperCase()} and ${a.target.toUpperCase()}; redistributed routes are still tagged and never iterate without bound.`:`${routerId.toUpperCase()} has reciprocal ${a.source.toUpperCase()} ↔ ${a.target.toUpperCase()} redistribution. HOPSCOTCH keeps redistributed routes out of native-source inputs by default, preventing recursive feedback.`});}}
  return hazards.sort((a,b)=>a.id.localeCompare(b.id));
}

export function builderPbrDecision(config:BuilderRoutingPolicyConfig,routerId:string,key:BuilderPbrPacketKey):BuilderPbrDecision{
  for(const rule of config.pbrRules.filter((entry)=>entry.enabled&&entry.routerId===routerId).sort((a,b)=>a.order-b.order||a.id.localeCompare(b.id))){if(!builderPolicyPrefixContains(rule.sourcePrefix,key.sourceAddress)||!builderPolicyPrefixContains(rule.destinationPrefix,key.destinationAddress))continue;if(rule.protocol!=='ip'&&rule.protocol!==key.protocol.toLowerCase())continue;if(rule.sourcePort!=null&&rule.sourcePort!==key.sourcePort)continue;if(rule.destinationPort!=null&&rule.destinationPort!==key.destinationPort)continue;return{matched:true,rule,reason:`PBR ${rule.id} matched before next-hop resolution. Destination FIB selection remains separately recorded.`};}
  return{matched:false,rule:null,reason:'No PBR rule matched; destination-based FIB forwarding applies.'};
}

export function builderEcmpProfile(config:BuilderRoutingPolicyConfig,routerId:string):BuilderEcmpProfile{return config.ecmpProfiles.find((entry)=>entry.routerId===routerId)??{routerId,hashMode:'full',maxPaths:8};}
export function builderCanonicalEcmpKey(mode:BuilderEcmpHashMode,key:BuilderPbrPacketKey,discriminator:string|number|null=null):string{
  const l3=`${key.sourceAddress}|${key.destinationAddress}`;if(mode==='l3')return l3;const l4=`${key.protocol.toLowerCase()}|${l3}|${key.sourcePort??''}|${key.destinationPort??''}`;return mode==='l4'?l4:`${l4}|${discriminator??''}`;
}

export function builderOspfTimerFor(config:BuilderRoutingPolicyConfig,routerId:string,linkId:string):BuilderOspfInterfaceTimer{return config.ospfTimers.find((entry)=>entry.routerId===routerId&&entry.linkId===linkId)??{id:`ospf-timer:${routerId}:${linkId}:default`,routerId,linkId,helloIntervalMs:10_000,deadIntervalMs:40_000};}
export function builderOspfTimerCompatible(config:BuilderRoutingPolicyConfig,aRouterId:string,bRouterId:string,linkId:string):boolean{const a=builderOspfTimerFor(config,aRouterId,linkId),b=builderOspfTimerFor(config,bRouterId,linkId);return a.helloIntervalMs===b.helloIntervalMs&&a.deadIntervalMs===b.deadIntervalMs;}
export function builderOspfEffectiveGraph(graph:BuilderGraph,config:BuilderRoutingPolicyConfig,enabledRouterIds:readonly string[]):BuilderGraph{const enabled=new Set(enabledRouterIds);const next=cloneBuilderGraph(graph);next.links=next.links.map((link)=>!link.failed&&enabled.has(link.a)&&enabled.has(link.b)&&nodeIsRouter(graph,link.a)&&nodeIsRouter(graph,link.b)&&!builderOspfTimerCompatible(config,link.a,link.b,link.id)?{...link,failed:true}:link);return next;}

export function upsertBuilderPbrRule(config:BuilderRoutingPolicyConfig,rule:BuilderPbrRule):BuilderRoutingPolicyConfig{return{...cloneBuilderRoutingPolicyConfig(config),pbrRules:[...config.pbrRules.filter((entry)=>entry.id!==rule.id),{...rule}]};}
export function upsertBuilderRedistributionRule(config:BuilderRoutingPolicyConfig,rule:BuilderRedistributionRule):BuilderRoutingPolicyConfig{return{...cloneBuilderRoutingPolicyConfig(config),redistributions:[...config.redistributions.filter((entry)=>entry.id!==rule.id),{...rule}]};}
export function upsertBuilderRouteSummary(config:BuilderRoutingPolicyConfig,summary:BuilderRouteSummary):BuilderRoutingPolicyConfig{return{...cloneBuilderRoutingPolicyConfig(config),summaries:[...config.summaries.filter((entry)=>entry.id!==summary.id),{...summary}]};}
export function upsertBuilderEcmpProfile(config:BuilderRoutingPolicyConfig,profile:BuilderEcmpProfile):BuilderRoutingPolicyConfig{return{...cloneBuilderRoutingPolicyConfig(config),ecmpProfiles:[...config.ecmpProfiles.filter((entry)=>entry.routerId!==profile.routerId),{...profile}]};}
export function upsertBuilderOspfTimer(config:BuilderRoutingPolicyConfig,timer:BuilderOspfInterfaceTimer):BuilderRoutingPolicyConfig{return{...cloneBuilderRoutingPolicyConfig(config),ospfTimers:[...config.ospfTimers.filter((entry)=>!(entry.routerId===timer.routerId&&entry.linkId===timer.linkId)),{...timer}]};}
export function upsertBuilderIsisRouter(config:BuilderRoutingPolicyConfig,router:BuilderIsisRouterConfig):BuilderRoutingPolicyConfig{return{...cloneBuilderRoutingPolicyConfig(config),isis:{...cloneBuilderRoutingPolicyConfig(config).isis,routers:[...config.isis.routers.filter((entry)=>entry.routerId!==router.routerId),{...router}]}};}
