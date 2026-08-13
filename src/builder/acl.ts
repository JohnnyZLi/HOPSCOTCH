import { interfacesForBuilderNode, normalizeBuilderIpv4, type BuilderAddressing } from './addressing.ts';
import { traceBuilderForwarding, type BuilderForwardingTrace, type BuilderRoutingConfig } from './routing.ts';
import type { BuilderGraph } from './model.ts';

export type BuilderAclAction = 'permit' | 'deny';
export type BuilderAclProtocol = 'ip' | 'icmp' | 'tcp' | 'udp';

export interface BuilderAclRule {
  id: string;
  routerId: string;
  order: number;
  action: BuilderAclAction;
  protocol: BuilderAclProtocol;
  sourcePrefix: string;
  destinationPrefix: string;
  destinationPort: number | null;
  description: string;
}

export interface BuilderAclConfig {
  rules: BuilderAclRule[];
  defaultAction: BuilderAclAction;
}

export interface BuilderAclDecision {
  routerId: string;
  action: BuilderAclAction;
  ruleId: string | null;
  ruleDescription: string;
}

export interface BuilderPolicyTrace {
  forwarding: BuilderForwardingTrace;
  permitted: boolean;
  sourceAddress: string | null;
  destinationAddress: string | null;
  protocol: BuilderAclProtocol;
  destinationPort: number | null;
  decisions: BuilderAclDecision[];
  deniedAtRouterId: string | null;
  explanation: string;
}

interface ParsedPrefix { network: number; broadcast: number; cidr: string }

function ipv4ToInt(value: string): number {
  return normalizeBuilderIpv4(value).split('.').reduce((result, part) => ((result << 8) | Number(part)) >>> 0, 0) >>> 0;
}

function intToIpv4(value: number): string { const v=value>>>0; return [24,16,8,0].map((shift)=>(v>>>shift)&255).join('.'); }

function parsePrefix(value: string): ParsedPrefix {
  const [addressText, prefixText, ...extra] = value.trim().split('/');
  if (!addressText || prefixText == null || extra.length > 0 || !/^\d{1,2}$/.test(prefixText)) throw new Error(`Invalid ACL prefix ${value}.`);
  const length = Number(prefixText);
  if (!Number.isInteger(length) || length < 0 || length > 32) throw new Error('ACL prefixes must be /0 through /32.');
  const address = ipv4ToInt(addressText);
  const mask = length === 0 ? 0 : (0xffffffff << (32-length)) >>> 0;
  const network = (address & mask) >>> 0;
  const broadcast = (network | (~mask >>> 0)) >>> 0;
  return { network, broadcast, cidr: `${intToIpv4(network)}/${length}` };
}

function contains(prefix: string, address: string): boolean { const p=parsePrefix(prefix); const value=ipv4ToInt(address); return value>=p.network && value<=p.broadcast; }

export function createDefaultBuilderAclConfig(): BuilderAclConfig { return { rules: [], defaultAction: 'permit' }; }
export function cloneBuilderAclConfig(config: BuilderAclConfig): BuilderAclConfig { return { defaultAction: config.defaultAction, rules: config.rules.map((rule)=>({ ...rule })) }; }

export function validateBuilderAclConfig(graph: BuilderGraph, config: BuilderAclConfig): BuilderAclConfig {
  if (!config || !Array.isArray(config.rules) || !['permit','deny'].includes(config.defaultAction)) throw new Error('ACL config requires rules and a default action.');
  if (config.rules.length > 128) throw new Error('Builder ACL teaching model supports at most 128 rules.');
  const routerIds = new Set(graph.nodes.filter((node)=>node.kind==='router').map((node)=>node.id));
  const ids = new Set<string>();
  const rules = config.rules.map((raw,index):BuilderAclRule=>{
    if (!raw || typeof raw !== 'object') throw new Error(`ACL rule ${index+1} is invalid.`);
    if (!/^[a-zA-Z0-9_-]+$/.test(raw.id) || ids.has(raw.id)) throw new Error(`ACL rule id ${raw.id} is invalid or duplicated.`);
    if (!routerIds.has(raw.routerId)) throw new Error(`ACL rule ${raw.id} references a non-router.`);
    if (!Number.isInteger(raw.order) || raw.order < 1 || raw.order > 65535) throw new Error(`ACL rule ${raw.id} order must be 1–65535.`);
    if (!['permit','deny'].includes(raw.action) || !['ip','icmp','tcp','udp'].includes(raw.protocol)) throw new Error(`ACL rule ${raw.id} action/protocol is invalid.`);
    const sourcePrefix=parsePrefix(raw.sourcePrefix).cidr; const destinationPrefix=parsePrefix(raw.destinationPrefix).cidr;
    const destinationPort = raw.destinationPort == null ? null : Number(raw.destinationPort);
    if (destinationPort != null && (!Number.isInteger(destinationPort) || destinationPort < 1 || destinationPort > 65535)) throw new Error(`ACL rule ${raw.id} destination port is invalid.`);
    if (!['tcp','udp'].includes(raw.protocol) && destinationPort != null) throw new Error(`ACL rule ${raw.id} can match a port only for TCP/UDP.`);
    ids.add(raw.id);
    return { id:raw.id,routerId:raw.routerId,order:raw.order,action:raw.action,protocol:raw.protocol,sourcePrefix,destinationPrefix,destinationPort,description:String(raw.description??'').slice(0,80) };
  }).sort((a,b)=>a.routerId.localeCompare(b.routerId)||a.order-b.order||a.id.localeCompare(b.id));
  return { defaultAction: config.defaultAction, rules };
}

export function reconcileBuilderAclConfig(graph: BuilderGraph, config: BuilderAclConfig): BuilderAclConfig {
  const routers = new Set(graph.nodes.filter((node)=>node.kind==='router').map((node)=>node.id));
  return validateBuilderAclConfig(graph, { defaultAction: config.defaultAction, rules: config.rules.filter((rule)=>routers.has(rule.routerId)) });
}

export function nextBuilderAclRuleId(config: BuilderAclConfig, routerId: string): string {
  let index=1; let id=`acl-${routerId}-${index}`; const ids=new Set(config.rules.map((rule)=>rule.id));
  while(ids.has(id)){index+=1;id=`acl-${routerId}-${index}`;} return id;
}

export function upsertBuilderAclRule(graph: BuilderGraph, config: BuilderAclConfig, rule: Omit<BuilderAclRule,'id'> & { id?: string }): BuilderAclConfig {
  const id=rule.id??nextBuilderAclRuleId(config,rule.routerId);
  const next=cloneBuilderAclConfig(config);
  const entry:BuilderAclRule={...rule,id};
  next.rules=[...next.rules.filter((candidate)=>candidate.id!==id),entry];
  return validateBuilderAclConfig(graph,next);
}

export function deleteBuilderAclRule(graph: BuilderGraph, config: BuilderAclConfig, id: string): BuilderAclConfig {
  return validateBuilderAclConfig(graph,{...config,rules:config.rules.filter((rule)=>rule.id!==id)});
}

function protocolMatches(rule: BuilderAclRule, protocol: BuilderAclProtocol): boolean { return rule.protocol==='ip' || rule.protocol===protocol; }
function portMatches(rule: BuilderAclRule, destinationPort: number | null): boolean { return rule.destinationPort==null || rule.destinationPort===destinationPort; }

export function evaluateBuilderAclAtRouter(config: BuilderAclConfig, routerId: string, sourceAddress: string, destinationAddress: string, protocol: BuilderAclProtocol, destinationPort: number | null): BuilderAclDecision {
  const normalizedSource=normalizeBuilderIpv4(sourceAddress); const normalizedDestination=normalizeBuilderIpv4(destinationAddress);
  const rules=config.rules.filter((rule)=>rule.routerId===routerId).sort((a,b)=>a.order-b.order||a.id.localeCompare(b.id));
  const match=rules.find((rule)=>protocolMatches(rule,protocol)&&portMatches(rule,destinationPort)&&contains(rule.sourcePrefix,normalizedSource)&&contains(rule.destinationPrefix,normalizedDestination));
  if(match)return{routerId,action:match.action,ruleId:match.id,ruleDescription:match.description||`${match.action.toUpperCase()} ${match.protocol.toUpperCase()} ${match.sourcePrefix} → ${match.destinationPrefix}`};
  return{routerId,action:config.defaultAction,ruleId:null,ruleDescription:`DEFAULT ${config.defaultAction.toUpperCase()}`};
}

function primaryAddress(addressing: BuilderAddressing, nodeId: string): string | null { return interfacesForBuilderNode(addressing,nodeId)[0]?.address??null; }

export function traceBuilderPolicy(
  graph: BuilderGraph,
  addressing: BuilderAddressing,
  routing: BuilderRoutingConfig,
  acl: BuilderAclConfig,
  sourceNodeId: string,
  destinationNodeId: string,
  protocol: BuilderAclProtocol='ip',
  destinationPort: number|null=null,
): BuilderPolicyTrace {
  const config=validateBuilderAclConfig(graph,acl);
  const forwarding=traceBuilderForwarding(graph,addressing,routing,sourceNodeId,destinationNodeId);
  const sourceAddress=primaryAddress(addressing,sourceNodeId);
  const destinationAddress=forwarding.destinationAddress??primaryAddress(addressing,destinationNodeId);
  if(!forwarding.reachable||!sourceAddress||!destinationAddress)return{forwarding,permitted:false,sourceAddress,destinationAddress,protocol,destinationPort,decisions:[],deniedAtRouterId:null,explanation:forwarding.failureReason??'Forwarding must succeed before ACL policy can be evaluated.'};
  const routerIds=[...new Set(forwarding.hops.map((hop)=>hop.nodeId).filter((id)=>graph.nodes.find((node)=>node.id===id)?.kind==='router'))];
  const decisions:BuilderAclDecision[]=[];
  for(const routerId of routerIds){
    const decision=evaluateBuilderAclAtRouter(config,routerId,sourceAddress,destinationAddress,protocol,destinationPort); decisions.push(decision);
    if(decision.action==='deny')return{forwarding,permitted:false,sourceAddress,destinationAddress,protocol,destinationPort,decisions,deniedAtRouterId:routerId,explanation:`${graph.nodes.find((node)=>node.id===routerId)?.label??routerId} denied ${protocol.toUpperCase()} by ${decision.ruleId??'default policy'}: ${decision.ruleDescription}.`};
  }
  return{forwarding,permitted:true,sourceAddress,destinationAddress,protocol,destinationPort,decisions,deniedAtRouterId:null,explanation:decisions.length===0?'No router ACL boundary was crossed.':`All ${decisions.length} routed ACL boundary${decisions.length===1?'':'ies'} permitted the flow.`};
}
