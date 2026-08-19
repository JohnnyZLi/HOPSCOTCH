import { builderStpState, type BuilderStpState } from './stp.ts';
import { builderEthernetPathForVlan } from './ethernet.ts';
import type {
  BuilderEthernetConfig,
  BuilderEthernetDevice,
  BuilderEthernetLink,
  BuilderEthernetEnterpriseConfig,
  BuilderEthernetFlowResult,
  BuilderFhrpGroup,
  BuilderLacpBundle,
  BuilderVrf,
} from './ethernet.ts';

export interface BuilderLacpState {
  bundleId: string;
  logicalId: string;
  a: string;
  b: string;
  negotiated: boolean;
  up: boolean;
  minLinks: number;
  activeMemberLinkIds: string[];
  inactiveMemberLinkIds: string[];
  reason: string;
}

export interface BuilderLldpNeighbor {
  localDeviceId: string;
  remoteDeviceId: string;
  linkId: string;
  bundleId: string | null;
  localLabel: string;
  remoteLabel: string;
  state: 'UP' | 'DOWN';
}

export interface BuilderVrfRouteEntry {
  deviceId: string;
  vrfId: string;
  source: 'SVI' | 'ROUTED PORT';
  prefix: string;
  interfaceLabel: string;
  nextHop: null;
}

export interface BuilderFhrpState {
  groupId: string;
  vlanId: number;
  vrfId: string;
  virtualIp: string;
  masterDeviceId: string | null;
  backupDeviceIds: string[];
  unavailableDeviceIds: string[];
  reason: string;
}

export interface BuilderVlanEncapsulation {
  linkId: string;
  vlanId: number;
  a: 'TAGGED' | 'UNTAGGED' | 'NOT CARRIED';
  b: 'TAGGED' | 'UNTAGGED' | 'NOT CARRIED';
  mismatch: boolean;
  reason: string;
}

export interface BuilderRstpTransition {
  atMs: number;
  linkId: string;
  state: 'DISCARDING' | 'LEARNING' | 'FORWARDING' | 'DOWN';
  reason: string;
}

export interface BuilderRstpConvergence {
  vlanId: number;
  protocol: 'STP' | 'RSTP';
  failedLinkId: string;
  before: BuilderStpState;
  after: BuilderStpState;
  transitions: BuilderRstpTransition[];
  convergenceMs: number;
  explanation: string;
}

export interface BuilderEnterpriseGatewayResolution {
  endpointId: string;
  vlanId: number;
  vrfId: string;
  gatewayIp: string | null;
  gatewayDeviceId: string | null;
  viaFhrpGroupId: string | null;
  reason: string;
}

export function createDefaultBuilderEthernetEnterpriseConfig(): BuilderEthernetEnterpriseConfig {
  return { vrfs: [{ id: 'default', label: 'DEFAULT' }], lacpBundles: [], fhrpGroups: [] };
}

export function cloneBuilderEthernetEnterpriseConfig(input: BuilderEthernetEnterpriseConfig | undefined): BuilderEthernetEnterpriseConfig {
  const config = input ?? createDefaultBuilderEthernetEnterpriseConfig();
  return {
    vrfs: config.vrfs.map((vrf) => ({ ...vrf })),
    lacpBundles: config.lacpBundles.map((bundle) => ({ ...bundle, memberLinkIds: [...bundle.memberLinkIds] })),
    fhrpGroups: config.fhrpGroups.map((group) => ({ ...group, members: group.members.map((member) => ({ ...member })) })),
  };
}

function id(value: string, label: string): string {
  if (!/^[a-zA-Z0-9_-]+$/.test(value) || value.length > 48) throw new Error(`${label} must use 1–48 letters, numbers, _ or -.`);
  return value;
}

function deviceById(config: BuilderEthernetConfig, deviceId: string): BuilderEthernetDevice | undefined {
  return config.devices.find((device) => device.id === deviceId);
}

function vrfById(config: BuilderEthernetEnterpriseConfig, vrfId: string): BuilderVrf | undefined {
  return config.vrfs.find((vrf) => vrf.id === vrfId);
}

function interfaceVrfId(device: BuilderEthernetDevice, vlanId: number): string {
  return device.interfaces.find((entry) => entry.vlanId === vlanId)?.vrfId ?? 'default';
}

function carriesVlanRaw(link: BuilderEthernetLink, vlanId: number): boolean {
  if (link.failed || link.mode === 'routed') return false;
  if (link.mode === 'access') return link.accessVlan === vlanId;
  if (!link.allowedVlans?.includes(vlanId)) return false;
  const aNative = link.nativeVlanA === vlanId;
  const bNative = link.nativeVlanB === vlanId;
  return aNative === bNative;
}

function deviceAvailableOnVlan(config: BuilderEthernetConfig, deviceId: string, vlanId: number): boolean {
  const device = deviceById(config, deviceId);
  if (!device || !device.interfaces.some((entry) => entry.vlanId === vlanId)) return false;
  return config.links.some((link) => !link.failed && (link.a === deviceId || link.b === deviceId) && carriesVlanRaw(link, vlanId));
}

export function validateBuilderEthernetEnterpriseConfig(config: BuilderEthernetConfig, input: BuilderEthernetEnterpriseConfig | undefined): BuilderEthernetEnterpriseConfig {
  const next = cloneBuilderEthernetEnterpriseConfig(input);
  const ipv4=(value:string)=>/^(?:\d{1,3}\.){3}\d{1,3}$/.test(value)&&value.split('.').every((part)=>Number(part)>=0&&Number(part)<=255);
  const cidr=(value:string)=>{const [address,prefix]=value.split('/');return Boolean(address&&ipv4(address)&&/^\d{1,2}$/.test(prefix??'')&&Number(prefix)>=8&&Number(prefix)<=30);};
  for(const device of config.devices)for(const iface of device.interfaces){if(iface.vrfId!=null&&!/^[a-zA-Z0-9_-]{1,48}$/.test(iface.vrfId))throw new Error(`${device.id} has an invalid VRF id.`);if(iface.name!=null&&(iface.name.length<1||iface.name.length>32))throw new Error(`${device.id} has an invalid interface name.`);}
  for(const link of config.links){if(link.mode==='trunk'){const allowed=link.allowedVlans??[];for(const native of [link.nativeVlanA,link.nativeVlanB])if(native!=null&&!allowed.includes(native))throw new Error(`Trunk ${link.id} native VLAN must also be allowed.`);}if(link.mode==='routed'){const a=deviceById(config,link.a),b=deviceById(config,link.b),r=link.routed;if(!a||!b||!['router','l3-switch'].includes(a.kind)||!['router','l3-switch'].includes(b.kind)||!r||!cidr(r.cidr)||!ipv4(r.aAddress)||!ipv4(r.bAddress)||(r.vrfId!=null&&!/^[a-zA-Z0-9_-]{1,48}$/.test(r.vrfId)))throw new Error(`Routed link ${link.id} is invalid.`);}}

  if (next.vrfs.length === 0 || next.vrfs.length > 16) throw new Error('Enterprise fabric requires 1–16 VRFs.');
  if (next.lacpBundles.length > 16 || next.fhrpGroups.length > 16) throw new Error('Enterprise fabric supports at most 16 LACP bundles and 16 first-hop redundancy groups.');
  const vrfIds = new Set<string>();
  for (const vrf of next.vrfs) {
    id(vrf.id, 'VRF id');
    if (vrfIds.has(vrf.id)) throw new Error(`Duplicate VRF ${vrf.id}.`);
    if (!vrf.label || vrf.label.length > 32) throw new Error(`VRF ${vrf.id} needs a short label.`);
    vrfIds.add(vrf.id);
  }
  if (!vrfIds.has('default')) next.vrfs.unshift({ id: 'default', label: 'DEFAULT' });
  for (const device of config.devices) for (const iface of device.interfaces) {
    const vrfId = iface.vrfId ?? 'default';
    if (!vrfById(next, vrfId)) throw new Error(`${device.id} VLAN ${iface.vlanId} references unknown VRF ${vrfId}.`);
  }
  const linkById = new Map(config.links.map((link) => [link.id, link]));
  const claimedMembers = new Set<string>();
  const bundleIds = new Set<string>();
  for (const bundle of next.lacpBundles) {
    id(bundle.id, 'LACP bundle id');
    if (bundleIds.has(bundle.id)) throw new Error(`Duplicate LACP bundle ${bundle.id}.`);
    bundleIds.add(bundle.id);
    if (!['active', 'passive'].includes(bundle.modeA) || !['active', 'passive'].includes(bundle.modeB)) throw new Error(`LACP bundle ${bundle.id} modes must be active or passive.`);
    if (!Number.isInteger(bundle.minLinks) || bundle.minLinks < 1 || bundle.minLinks > 8) throw new Error(`LACP bundle ${bundle.id} minLinks must be 1–8.`);
    const members = [...new Set(bundle.memberLinkIds)].sort();
    if (members.length < 1 || members.length > 8) throw new Error(`LACP bundle ${bundle.id} needs 1–8 physical members.`);
    const first = linkById.get(members[0]);
    if (!first || first.mode === 'routed') throw new Error(`LACP bundle ${bundle.id} references an invalid member.`);
    const pair = [first.a, first.b].sort().join('|');
    for (const memberId of members) {
      if (claimedMembers.has(memberId)) throw new Error(`Physical link ${memberId} belongs to more than one LACP bundle.`);
      const link = linkById.get(memberId);
      if (!link || [link.a, link.b].sort().join('|') !== pair || link.mode !== first.mode) throw new Error(`LACP bundle ${bundle.id} members must join the same device pair with the same switchport mode.`);
      claimedMembers.add(memberId);
    }
    bundle.memberLinkIds = members;
  }
  const groupIds = new Set<string>();
  for (const group of next.fhrpGroups) {
    id(group.id, 'FHRP group id');
    if (groupIds.has(group.id)) throw new Error(`Duplicate FHRP group ${group.id}.`);
    groupIds.add(group.id);
    if (!config.vlans.some((vlan) => vlan.id === group.vlanId)) throw new Error(`FHRP group ${group.id} references unknown VLAN ${group.vlanId}.`);
    if (!vrfIds.has(group.vrfId ?? 'default')) throw new Error(`FHRP group ${group.id} references unknown VRF ${group.vrfId}.`);
    if (!/^(?:\d{1,3}\.){3}\d{1,3}$/.test(group.virtualIp)) throw new Error(`FHRP group ${group.id} requires an IPv4 virtual address.`);
    if (group.members.length < 2 || group.members.length > 8) throw new Error(`FHRP group ${group.id} needs 2–8 members.`);
    const members = new Set<string>();
    for (const member of group.members) {
      if (members.has(member.deviceId)) throw new Error(`FHRP group ${group.id} has duplicate member ${member.deviceId}.`);
      members.add(member.deviceId);
      const device = deviceById(config, member.deviceId);
      if (!device || !['router', 'l3-switch'].includes(device.kind) || !device.interfaces.some((entry) => entry.vlanId === group.vlanId && (entry.vrfId ?? 'default') === (group.vrfId ?? 'default'))) throw new Error(`FHRP member ${member.deviceId} must be a routed device with an SVI/interface in VLAN ${group.vlanId} VRF ${group.vrfId ?? 'default'}.`);
      if (!Number.isInteger(member.priority) || member.priority < 1 || member.priority > 254) throw new Error(`FHRP priority for ${member.deviceId} must be 1–254.`);
    }
  }
  return next;
}

export function builderLacpState(config: BuilderEthernetConfig, bundleId: string): BuilderLacpState {
  const bundle = config.enterprise?.lacpBundles.find((entry) => entry.id === bundleId);
  if (!bundle) throw new Error(`Unknown LACP bundle ${bundleId}.`);
  const links = bundle.memberLinkIds.flatMap((memberId) => {
    const link = config.links.find((entry) => entry.id === memberId);
    return link ? [link] : [];
  });
  const first = links[0];
  const negotiated = bundle.modeA === 'active' || bundle.modeB === 'active';
  const activeMemberLinkIds = negotiated ? links.filter((link) => !link.failed).map((link) => link.id).sort() : [];
  const inactiveMemberLinkIds = links.filter((link) => !activeMemberLinkIds.includes(link.id)).map((link) => link.id).sort();
  const up = activeMemberLinkIds.length >= bundle.minLinks;
  return {
    bundleId,
    logicalId: `po:${bundleId}`,
    a: first?.a ?? '',
    b: first?.b ?? '',
    negotiated,
    up,
    minLinks: bundle.minLinks,
    activeMemberLinkIds,
    inactiveMemberLinkIds,
    reason: !negotiated ? 'Both peers are passive, so no LACP negotiation starts.' : up ? `${activeMemberLinkIds.length} member${activeMemberLinkIds.length === 1 ? '' : 's'} satisfy minLinks ${bundle.minLinks}.` : `${activeMemberLinkIds.length} live member${activeMemberLinkIds.length === 1 ? '' : 's'} are below minLinks ${bundle.minLinks}.`,
  };
}

function hashFlowKey(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return hash >>> 0;
}

export function builderLacpSelectMember(config: BuilderEthernetConfig, bundleId: string, flowKey: string): string | null {
  const state = builderLacpState(config, bundleId);
  if (!state.up || state.activeMemberLinkIds.length === 0) return null;
  return state.activeMemberLinkIds[hashFlowKey(flowKey) % state.activeMemberLinkIds.length] ?? null;
}

export function builderLldpNeighbors(config: BuilderEthernetConfig): BuilderLldpNeighbor[] {
  return config.links.flatMap((link) => {
    const a = deviceById(config, link.a);
    const b = deviceById(config, link.b);
    if (!a || !b) return [];
    const bundleId = config.enterprise?.lacpBundles.find((bundle) => bundle.memberLinkIds.includes(link.id))?.id ?? null;
    const state: 'UP' | 'DOWN' = link.failed ? 'DOWN' : 'UP';
    return [
      { localDeviceId: a.id, remoteDeviceId: b.id, linkId: link.id, bundleId, localLabel: a.label, remoteLabel: b.label, state },
      { localDeviceId: b.id, remoteDeviceId: a.id, linkId: link.id, bundleId, localLabel: b.label, remoteLabel: a.label, state },
    ];
  }).sort((left, right) => `${left.localDeviceId}:${left.remoteDeviceId}:${left.linkId}`.localeCompare(`${right.localDeviceId}:${right.remoteDeviceId}:${right.linkId}`));
}

export function builderVlanEncapsulation(link: BuilderEthernetLink, vlanId: number): BuilderVlanEncapsulation {
  if (link.failed || link.mode === 'routed') return { linkId: link.id, vlanId, a: 'NOT CARRIED', b: 'NOT CARRIED', mismatch: false, reason: link.failed ? 'Physical link is down.' : 'Routed ports do not carry VLAN tags.' };
  if (link.mode === 'access') {
    const carried = link.accessVlan === vlanId;
    return { linkId: link.id, vlanId, a: carried ? 'UNTAGGED' : 'NOT CARRIED', b: carried ? 'UNTAGGED' : 'NOT CARRIED', mismatch: false, reason: carried ? `Access VLAN ${vlanId} is untagged on the wire.` : `Access link belongs to VLAN ${link.accessVlan ?? 'NONE'}.` };
  }
  if (!link.allowedVlans?.includes(vlanId)) return { linkId: link.id, vlanId, a: 'NOT CARRIED', b: 'NOT CARRIED', mismatch: false, reason: `VLAN ${vlanId} is not in the trunk allow-list.` };
  const a = link.nativeVlanA === vlanId ? 'UNTAGGED' as const : 'TAGGED' as const;
  const b = link.nativeVlanB === vlanId ? 'UNTAGGED' as const : 'TAGGED' as const;
  const mismatch = a !== b;
  return { linkId: link.id, vlanId, a, b, mismatch, reason: mismatch ? `Native VLAN mismatch: ${link.a} sends ${a.toLowerCase()} while ${link.b} expects ${b.toLowerCase()}. HOPSCOTCH does not treat the VLAN as end-to-end equivalent.` : a === 'UNTAGGED' ? `VLAN ${vlanId} is the agreed native VLAN and crosses untagged.` : `VLAN ${vlanId} crosses the trunk with an 802.1Q tag.` };
}

export function builderFhrpState(config: BuilderEthernetConfig, groupId: string): BuilderFhrpState {
  const group = config.enterprise?.fhrpGroups.find((entry) => entry.id === groupId);
  if (!group) throw new Error(`Unknown first-hop redundancy group ${groupId}.`);
  const available = group.members.filter((member) => deviceAvailableOnVlan(config, member.deviceId, group.vlanId));
  const unavailable = group.members.filter((member) => !available.includes(member));
  const ordered = [...available].sort((left, right) => right.priority - left.priority || left.deviceId.localeCompare(right.deviceId));
  const master = ordered[0]?.deviceId ?? null;
  return {
    groupId,
    vlanId: group.vlanId,
    vrfId: group.vrfId ?? 'default',
    virtualIp: group.virtualIp,
    masterDeviceId: master,
    backupDeviceIds: ordered.slice(1).map((member) => member.deviceId),
    unavailableDeviceIds: unavailable.map((member) => member.deviceId).sort(),
    reason: master ? `${deviceById(config, master)?.label ?? master} is master by highest available priority; ties use stable device id.` : 'No group member has an active attachment to this VLAN.',
  };
}

export function builderResolveEnterpriseGateway(config: BuilderEthernetConfig, endpointId: string): BuilderEnterpriseGatewayResolution {
  const endpoint = deviceById(config, endpointId);
  const iface = endpoint?.interfaces[0];
  if (!endpoint || endpoint.kind !== 'endpoint' || !iface) return { endpointId, vlanId: iface?.vlanId ?? 0, vrfId: iface?.vrfId ?? 'default', gatewayIp: iface?.gateway ?? null, gatewayDeviceId: null, viaFhrpGroupId: null, reason: 'Endpoint interface is incomplete.' };
  const vrfId = iface.vrfId ?? 'default';
  const gatewayIp = iface.gateway ?? null;
  if (!gatewayIp) return { endpointId, vlanId: iface.vlanId, vrfId, gatewayIp, gatewayDeviceId: null, viaFhrpGroupId: null, reason: 'Endpoint has no default gateway.' };
  const group = config.enterprise?.fhrpGroups.find((entry) => entry.vlanId === iface.vlanId && (entry.vrfId ?? 'default') === vrfId && entry.virtualIp === gatewayIp);
  if (group) {
    const state = builderFhrpState(config, group.id);
    return { endpointId, vlanId: iface.vlanId, vrfId, gatewayIp, gatewayDeviceId: state.masterDeviceId, viaFhrpGroupId: group.id, reason: state.masterDeviceId ? `Gateway resolves to ${state.masterDeviceId}, the active first-hop master.` : state.reason };
  }
  const direct = config.devices.filter((device) => ['router', 'l3-switch'].includes(device.kind) && device.interfaces.some((entry) => entry.vlanId === iface.vlanId && (entry.vrfId ?? 'default') === vrfId && entry.address === gatewayIp)).sort((a, b) => a.id.localeCompare(b.id))[0];
  return { endpointId, vlanId: iface.vlanId, vrfId, gatewayIp, gatewayDeviceId: direct?.id ?? null, viaFhrpGroupId: null, reason: direct ? `Gateway resolves directly to ${direct.label}.` : `No routed interface owns ${gatewayIp} in VLAN ${iface.vlanId} VRF ${vrfId}.` };
}

export function builderVrfRouteTables(config: BuilderEthernetConfig): BuilderVrfRouteEntry[] {
  const entries: BuilderVrfRouteEntry[] = [];
  for (const device of config.devices.filter((entry) => ['router', 'l3-switch'].includes(entry.kind))) {
    for (const iface of device.interfaces) {
      const vlan = config.vlans.find((entry) => entry.id === iface.vlanId);
      if (!vlan) continue;
      entries.push({ deviceId: device.id, vrfId: iface.vrfId ?? 'default', source: 'SVI', prefix: vlan.cidr, interfaceLabel: iface.name ?? `Vlan${iface.vlanId}`, nextHop: null });
    }
  }
  for (const link of config.links.filter((entry) => entry.mode === 'routed' && !entry.failed && entry.routed)) {
    const vrfId = link.routed?.vrfId ?? 'default';
    if (['router', 'l3-switch'].includes(deviceById(config, link.a)?.kind ?? '')) entries.push({ deviceId: link.a, vrfId, source: 'ROUTED PORT', prefix: link.routed!.cidr, interfaceLabel: link.routed!.aName ?? `${link.id}:a`, nextHop: null });
    if (['router', 'l3-switch'].includes(deviceById(config, link.b)?.kind ?? '')) entries.push({ deviceId: link.b, vrfId, source: 'ROUTED PORT', prefix: link.routed!.cidr, interfaceLabel: link.routed!.bName ?? `${link.id}:b`, nextHop: null });
  }
  return entries.sort((left, right) => `${left.deviceId}:${left.vrfId}:${left.prefix}:${left.interfaceLabel}`.localeCompare(`${right.deviceId}:${right.vrfId}:${right.prefix}:${right.interfaceLabel}`));
}


function logicalL2Config(config: BuilderEthernetConfig, vlanId: number): BuilderEthernetConfig {
  const next=structuredClone(config) as BuilderEthernetConfig;
  next.devices=next.devices.map((device)=>device.kind==='l3-switch'?{...device,kind:'switch',interfaces:[]}:device);
  const disabled=new Set<string>();
  for(const link of next.links){
    if(link.mode==='routed'||builderVlanEncapsulation(link,vlanId).mismatch)disabled.add(link.id);
  }
  for(const bundle of next.enterprise?.lacpBundles??[]){
    const state=builderLacpState(next,bundle.id);
    for(const member of bundle.memberLinkIds)disabled.add(member);
    const representative=state.up?state.activeMemberLinkIds[0]:null;
    if(representative)disabled.delete(representative);
  }
  next.links=next.links.map((link)=>disabled.has(link.id)?{...link,failed:true}:link);
  next.enterprise=undefined;
  return next;
}

function enterprisePath(config:BuilderEthernetConfig,sourceId:string,destinationId:string,vlanId:number){
  return builderEthernetPathForVlan(logicalL2Config(config,vlanId),sourceId,destinationId,vlanId);
}

function enterpriseFlowFail(sourceId:string,destinationId:string,sourceVlan:number|null,destinationVlan:number|null,reason:string):BuilderEthernetFlowResult{
  return{sourceId,destinationId,sourceVlan,destinationVlan,success:false,routed:false,routedAt:null,ttlBefore:64,ttlAfter:64,segments:[],fdb:[],failureReason:reason,summary:reason};
}

export function runBuilderEnterpriseEthernetFlow(configInput:BuilderEthernetConfig,sourceId:string,destinationId:string):BuilderEthernetFlowResult{
  const config=structuredClone(configInput) as BuilderEthernetConfig;
  config.enterprise=validateBuilderEthernetEnterpriseConfig(config,config.enterprise);
  const source=deviceById(config,sourceId),destination=deviceById(config,destinationId);
  if(!source||!destination||source.kind!=='endpoint'||destination.kind!=='endpoint'||sourceId===destinationId)return enterpriseFlowFail(sourceId,destinationId,null,null,'Choose two different Ethernet endpoints.');
  const sourceIf=source.interfaces[0],destinationIf=destination.interfaces[0];
  if(!sourceIf||!destinationIf)return enterpriseFlowFail(sourceId,destinationId,sourceIf?.vlanId??null,destinationIf?.vlanId??null,'Endpoint VLAN interfaces are incomplete.');
  const sourceVlan=sourceIf.vlanId,destinationVlan=destinationIf.vlanId;
  if(sourceVlan===destinationVlan){const path=enterprisePath(config,sourceId,destinationId,sourceVlan);return path?{sourceId,destinationId,sourceVlan,destinationVlan,success:true,routed:false,routedAt:null,ttlBefore:64,ttlAfter:64,segments:[{phase:'same-vlan',vlanId:sourceVlan,nodeIds:path.nodeIds,linkIds:path.linkIds,disposition:'FLOOD THEN LEARN'}],fdb:[],failureReason:null,summary:`VLAN ${sourceVlan} crosses the logical Layer-2 topology; LACP members project as one bundle and native-VLAN mismatches do not forward.`}:enterpriseFlowFail(sourceId,destinationId,sourceVlan,destinationVlan,`VLAN ${sourceVlan} has no active enterprise Layer-2 path.`);}
  const sourceVrf=sourceIf.vrfId??'default',destinationVrf=destinationIf.vrfId??'default';
  if(sourceVrf!==destinationVrf)return enterpriseFlowFail(sourceId,destinationId,sourceVlan,destinationVlan,`VRF isolation: ${source.label} is in ${sourceVrf} while ${destination.label} is in ${destinationVrf}. Overlapping addresses do not merge routing tables.`);
  const sourceGateway=builderResolveEnterpriseGateway(config,sourceId),destinationGateway=builderResolveEnterpriseGateway(config,destinationId);
  const router=sourceGateway.gatewayDeviceId?deviceById(config,sourceGateway.gatewayDeviceId):undefined;
  if(!router||!['router','l3-switch'].includes(router.kind)||!router.interfaces.some((entry)=>entry.vlanId===destinationVlan&&(entry.vrfId??'default')===sourceVrf))return enterpriseFlowFail(sourceId,destinationId,sourceVlan,destinationVlan,`VLAN ${sourceVlan} gateway cannot route to VLAN ${destinationVlan} inside VRF ${sourceVrf}.`);
  if(!destinationGateway.gatewayDeviceId)return enterpriseFlowFail(sourceId,destinationId,sourceVlan,destinationVlan,destinationGateway.reason);
  const toGateway=enterprisePath(config,sourceId,router.id,sourceVlan),fromRouter=enterprisePath(config,router.id,destinationId,destinationVlan);
  if(!toGateway)return enterpriseFlowFail(sourceId,destinationId,sourceVlan,destinationVlan,`VLAN ${sourceVlan} cannot reach active gateway ${router.label}.`);
  if(!fromRouter)return enterpriseFlowFail(sourceId,destinationId,sourceVlan,destinationVlan,`Routed hop ${router.label} cannot reach ${destination.label} through VLAN ${destinationVlan}.`);
  return{sourceId,destinationId,sourceVlan,destinationVlan,success:true,routed:true,routedAt:router.id,ttlBefore:64,ttlAfter:63,segments:[{phase:'to-gateway',vlanId:sourceVlan,nodeIds:toGateway.nodeIds,linkIds:toGateway.linkIds,disposition:'FLOOD THEN LEARN'},{phase:'from-router',vlanId:destinationVlan,nodeIds:fromRouter.nodeIds,linkIds:fromRouter.linkIds,disposition:'ROUTED UNICAST'}],fdb:[],failureReason:null,summary:`${router.label} routes VLAN ${sourceVlan} → VLAN ${destinationVlan} inside VRF ${sourceVrf}; FHRP, logical LACP and explicit tag truth are projections of the same Ethernet configuration.`};
}

export function builderEnterpriseStpState(config:BuilderEthernetConfig,vlanId:number):BuilderStpState{return builderStpState(logicalL2Config(config,vlanId),vlanId);}

export function builderRstpConvergence(config: BuilderEthernetConfig, vlanId: number, failedLinkId: string): BuilderRstpConvergence {
  const before = builderEnterpriseStpState(config, vlanId);
  const failed = config.links.find((link) => link.id === failedLinkId);
  if (!failed) throw new Error(`Unknown Ethernet link ${failedLinkId}.`);
  const next: BuilderEthernetConfig = { ...config, links: config.links.map((link) => link.id === failedLinkId ? { ...link, failed: true } : { ...link }) };
  const after = builderEnterpriseStpState(next, vlanId);
  const protocol = config.stp.protocol === 'rstp' ? 'RSTP' : 'STP';
  const recovering = after.forwardingLinkIds.filter((linkId) => !before.forwardingLinkIds.includes(linkId));
  const transitions: BuilderRstpTransition[] = [{ atMs: 0, linkId: failedLinkId, state: 'DOWN', reason: 'Physical member/link failure is observed.' }];
  const learningAt = protocol === 'RSTP' ? 300 : 15000;
  const forwardingAt = protocol === 'RSTP' ? 2000 : 30000;
  for (const linkId of recovering) {
    transitions.push({ atMs: learningAt, linkId, state: protocol === 'RSTP' ? 'DISCARDING' : 'LEARNING', reason: protocol === 'RSTP' ? 'Alternate role synchronizes rapidly before forwarding.' : 'Classic STP enters the learning phase after forward delay.' });
    transitions.push({ atMs: forwardingAt, linkId, state: 'FORWARDING', reason: protocol === 'RSTP' ? 'Rapid proposal/agreement convergence promotes the alternate path.' : 'Classic STP completes listening/learning delays.' });
  }
  return { vlanId, protocol, failedLinkId, before, after, transitions: transitions.sort((a, b) => a.atMs - b.atMs || a.linkId.localeCompare(b.linkId)), convergenceMs: recovering.length === 0 ? 0 : forwardingAt, explanation: recovering.length === 0 ? 'Failure does not require another blocked segment to enter forwarding.' : `${protocol} restores ${recovering.length} alternate segment${recovering.length === 1 ? '' : 's'} in ${forwardingAt} ms in this deterministic teaching model.` };
}

export function createEnterpriseCampusFixture(base: BuilderEthernetConfig): BuilderEthernetConfig {
  const next = structuredClone(base) as BuilderEthernetConfig;
  next.stp = { ...next.stp, protocol: 'rstp' };
  const ensureVrf = (vrf: BuilderVrf) => { next.enterprise ??= createDefaultBuilderEthernetEnterpriseConfig(); if (!next.enterprise.vrfs.some((entry) => entry.id === vrf.id)) next.enterprise.vrfs.push(vrf); };
  ensureVrf({ id: 'tenant-a', label: 'TENANT A' });
  if (!next.devices.some((device) => device.id === 'dist-a')) next.devices.push({ id: 'dist-a', label: 'DIST-A', kind: 'l3-switch', mac: '02:48:4f:00:da:01', interfaces: [{ vlanId: 10, address: '10.10.0.2', vrfId: 'default', name: 'Vlan10' }, { vlanId: 20, address: '10.20.0.2', vrfId: 'default', name: 'Vlan20' }] });
  if (!next.devices.some((device) => device.id === 'dist-b')) next.devices.push({ id: 'dist-b', label: 'DIST-B', kind: 'l3-switch', mac: '02:48:4f:00:db:01', interfaces: [{ vlanId: 10, address: '10.10.0.3', vrfId: 'default', name: 'Vlan10' }, { vlanId: 20, address: '10.20.0.3', vrfId: 'default', name: 'Vlan20' }] });
  next.layout['dist-a'] = { x: 34, y: 56 }; next.layout['dist-b'] = { x: 66, y: 56 };
  const addLink = (link: BuilderEthernetLink) => { if (!next.links.some((entry) => entry.id === link.id)) next.links.push(link); };
  addLink({ id: 'sw1-dist-a-1', a: 'lan-sw1', b: 'dist-a', mode: 'trunk', allowedVlans: [10, 20], nativeVlanA: 10, nativeVlanB: 10, failed: false });
  addLink({ id: 'sw1-dist-a-2', a: 'lan-sw1', b: 'dist-a', mode: 'trunk', allowedVlans: [10, 20], nativeVlanA: 10, nativeVlanB: 10, failed: false });
  addLink({ id: 'sw2-dist-b-1', a: 'lan-sw2', b: 'dist-b', mode: 'trunk', allowedVlans: [10, 20], nativeVlanA: 10, nativeVlanB: 10, failed: false });
  addLink({ id: 'sw2-dist-b-2', a: 'lan-sw2', b: 'dist-b', mode: 'trunk', allowedVlans: [10, 20], nativeVlanA: 10, nativeVlanB: 10, failed: false });
  next.enterprise ??= createDefaultBuilderEthernetEnterpriseConfig();
  const ensureBundle = (bundle: BuilderLacpBundle) => { if (!next.enterprise!.lacpBundles.some((entry) => entry.id === bundle.id)) next.enterprise!.lacpBundles.push(bundle); };
  ensureBundle({ id: 'po10', memberLinkIds: ['sw1-dist-a-1', 'sw1-dist-a-2'], modeA: 'active', modeB: 'active', minLinks: 1 });
  ensureBundle({ id: 'po20', memberLinkIds: ['sw2-dist-b-1', 'sw2-dist-b-2'], modeA: 'active', modeB: 'passive', minLinks: 1 });
  const ensureGroup = (group: BuilderFhrpGroup) => { if (!next.enterprise!.fhrpGroups.some((entry) => entry.id === group.id)) next.enterprise!.fhrpGroups.push(group); };
  ensureGroup({ id: 'vlan10-gw', vlanId: 10, vrfId: 'default', virtualIp: '10.10.0.1', members: [{ deviceId: 'dist-a', priority: 120, preempt: true }, { deviceId: 'dist-b', priority: 110, preempt: true }] });
  ensureGroup({ id: 'vlan20-gw', vlanId: 20, vrfId: 'default', virtualIp: '10.20.0.1', members: [{ deviceId: 'dist-b', priority: 120, preempt: true }, { deviceId: 'dist-a', priority: 110, preempt: true }] });
  return next;
}
