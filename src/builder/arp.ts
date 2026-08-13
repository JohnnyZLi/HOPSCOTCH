import {
  builderEthernetDeviceById,
  builderEthernetInterfaceFor,
  builderEthernetPathForVlan,
  type BuilderEthernetConfig,
} from './ethernet.ts';

export interface BuilderArpCacheEntry {
  ownerDeviceId: string;
  vlanId: number;
  address: string;
  mac: string;
  learnedFromDeviceId: string;
}

export type BuilderArpCache = BuilderArpCacheEntry[];

export interface BuilderArpResolution {
  ownerDeviceId: string;
  targetDeviceId: string | null;
  vlanId: number;
  targetAddress: string;
  targetMac: string | null;
  cacheHit: boolean;
  success: boolean;
  requestNodeIds: string[];
  requestLinkIds: string[];
  replyNodeIds: string[];
  replyLinkIds: string[];
  failureReason: string | null;
  summary: string;
}

function key(entry: Pick<BuilderArpCacheEntry,'ownerDeviceId'|'vlanId'|'address'>): string { return `${entry.ownerDeviceId}:${entry.vlanId}:${entry.address}`; }

export function cloneBuilderArpCache(cache: BuilderArpCache): BuilderArpCache { return cache.map((entry)=>({ ...entry })); }
export function clearBuilderArpCache(): BuilderArpCache { return []; }

function upsert(cache: BuilderArpCache, entry: BuilderArpCacheEntry): BuilderArpCache {
  return [...cache.filter((candidate)=>key(candidate)!==key(entry)),entry].sort((a,b)=>key(a).localeCompare(key(b)));
}

function targetForAddress(config: BuilderEthernetConfig, vlanId: number, address: string): string | null {
  return config.devices.filter((device)=>builderEthernetInterfaceFor(device,vlanId)?.address===address).sort((a,b)=>a.id.localeCompare(b.id))[0]?.id??null;
}

export function resolveBuilderArp(
  config: BuilderEthernetConfig,
  ownerDeviceId: string,
  vlanId: number,
  targetAddress: string,
  cacheInput: BuilderArpCache,
): { resolution: BuilderArpResolution; cache: BuilderArpCache } {
  const owner=builderEthernetDeviceById(config,ownerDeviceId);
  const ownerIf=builderEthernetInterfaceFor(owner,vlanId);
  const cache=cloneBuilderArpCache(cacheInput);
  const cached=cache.find((entry)=>entry.ownerDeviceId===ownerDeviceId&&entry.vlanId===vlanId&&entry.address===targetAddress);
  if(cached){
    return { cache, resolution:{ownerDeviceId,targetDeviceId:cached.learnedFromDeviceId,vlanId,targetAddress,targetMac:cached.mac,cacheHit:true,success:true,requestNodeIds:[],requestLinkIds:[],replyNodeIds:[],replyLinkIds:[],failureReason:null,summary:`ARP cache hit: ${targetAddress} is already mapped to ${cached.mac}.`} };
  }
  if(!owner||!ownerIf)return{cache,resolution:{ownerDeviceId,targetDeviceId:null,vlanId,targetAddress,targetMac:null,cacheHit:false,success:false,requestNodeIds:[],requestLinkIds:[],replyNodeIds:[],replyLinkIds:[],failureReason:`${ownerDeviceId} has no IPv4 interface in VLAN ${vlanId}.`,summary:`ARP cannot start without a local VLAN ${vlanId} interface.`}};
  const targetDeviceId=targetForAddress(config,vlanId,targetAddress);
  const target=targetDeviceId?builderEthernetDeviceById(config,targetDeviceId):undefined;
  if(!target)return{cache,resolution:{ownerDeviceId,targetDeviceId:null,vlanId,targetAddress,targetMac:null,cacheHit:false,success:false,requestNodeIds:[ownerDeviceId],requestLinkIds:[],replyNodeIds:[],replyLinkIds:[],failureReason:`No device owns ${targetAddress} in VLAN ${vlanId}.`,summary:`ARP Request for ${targetAddress} receives no reply.`}};
  const path=builderEthernetPathForVlan(config,ownerDeviceId,targetDeviceId,vlanId);
  if(!path)return{cache,resolution:{ownerDeviceId,targetDeviceId,vlanId,targetAddress,targetMac:null,cacheHit:false,success:false,requestNodeIds:[ownerDeviceId],requestLinkIds:[],replyNodeIds:[],replyLinkIds:[],failureReason:`VLAN ${vlanId} has no STP-forwarding Layer-2 path to ${target.label}.`,summary:`ARP broadcast cannot reach ${target.label}.`}};
  const reverse={nodeIds:[...path.nodeIds].reverse(),linkIds:[...path.linkIds].reverse()};
  const entry:BuilderArpCacheEntry={ownerDeviceId,vlanId,address:targetAddress,mac:target.mac,learnedFromDeviceId:targetDeviceId};
  const next=upsert(cache,entry);
  return { cache:next, resolution:{ownerDeviceId,targetDeviceId,vlanId,targetAddress,targetMac:target.mac,cacheHit:false,success:true,requestNodeIds:path.nodeIds,requestLinkIds:path.linkIds,replyNodeIds:reverse.nodeIds,replyLinkIds:reverse.linkIds,failureReason:null,summary:`ARP Request floods inside VLAN ${vlanId}; ${target.label} replies ${targetAddress} is ${target.mac}, then ${owner.label} caches the mapping.`} };
}

export function resolveBuilderEthernetFlowArp(
  config: BuilderEthernetConfig,
  sourceId: string,
  destinationId: string,
  cacheInput: BuilderArpCache,
): { resolutions: BuilderArpResolution[]; cache: BuilderArpCache; success: boolean; failureReason: string | null } {
  const source=builderEthernetDeviceById(config,sourceId); const destination=builderEthernetDeviceById(config,destinationId);
  if(!source||!destination||source.kind!=='endpoint'||destination.kind!=='endpoint')return{resolutions:[],cache:cloneBuilderArpCache(cacheInput),success:false,failureReason:'ARP flow endpoints must be Ethernet endpoints.'};
  const sourceIf=source.interfaces[0],destinationIf=destination.interfaces[0];
  if(!sourceIf||!destinationIf)return{resolutions:[],cache:cloneBuilderArpCache(cacheInput),success:false,failureReason:'Endpoint IPv4/VLAN interfaces are incomplete.'};
  let cache=cloneBuilderArpCache(cacheInput); const resolutions:BuilderArpResolution[]=[];
  if(sourceIf.vlanId===destinationIf.vlanId){
    const first=resolveBuilderArp(config,sourceId,sourceIf.vlanId,destinationIf.address,cache);resolutions.push(first.resolution);cache=first.cache;
    return{resolutions,cache,success:first.resolution.success,failureReason:first.resolution.failureReason};
  }
  if(!sourceIf.gateway)return{resolutions,cache,success:false,failureReason:`${source.label} has no default gateway for off-subnet traffic.`};
  const toGateway=resolveBuilderArp(config,sourceId,sourceIf.vlanId,sourceIf.gateway,cache);resolutions.push(toGateway.resolution);cache=toGateway.cache;
  if(!toGateway.resolution.success)return{resolutions,cache,success:false,failureReason:toGateway.resolution.failureReason};
  const routerId=toGateway.resolution.targetDeviceId;
  if(!routerId)return{resolutions,cache,success:false,failureReason:'Gateway ARP did not resolve to a router device.'};
  const fromRouter=resolveBuilderArp(config,routerId,destinationIf.vlanId,destinationIf.address,cache);resolutions.push(fromRouter.resolution);cache=fromRouter.cache;
  return{resolutions,cache,success:fromRouter.resolution.success,failureReason:fromRouter.resolution.failureReason};
}
