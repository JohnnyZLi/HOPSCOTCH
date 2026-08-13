import { builderStpState, cloneBuilderStpConfig, createDefaultBuilderStpConfig, validateBuilderStpConfig, type BuilderStpConfig } from './stp.ts';

export type BuilderEthernetDeviceKind = 'endpoint' | 'switch' | 'router';
export type BuilderEthernetPortMode = 'access' | 'trunk';

export interface BuilderEthernetVlan {
  id: number;
  name: string;
  cidr: string;
}

export interface BuilderEthernetInterface {
  vlanId: number;
  address: string;
  gateway?: string | null;
}

export interface BuilderEthernetDevice {
  id: string;
  label: string;
  kind: BuilderEthernetDeviceKind;
  mac: string;
  interfaces: BuilderEthernetInterface[];
}

export interface BuilderEthernetLink {
  id: string;
  a: string;
  b: string;
  mode: BuilderEthernetPortMode;
  accessVlan?: number;
  allowedVlans?: number[];
  failed: boolean;
}

export interface BuilderEthernetPoint { x: number; y: number }

export interface BuilderEthernetConfig {
  vlans: BuilderEthernetVlan[];
  devices: BuilderEthernetDevice[];
  links: BuilderEthernetLink[];
  layout: Record<string, BuilderEthernetPoint>;
  stp: BuilderStpConfig;
}

export interface BuilderEthernetFdbEntry {
  switchId: string;
  vlanId: number;
  mac: string;
  linkId: string;
  learnedFrom: string;
}

export interface BuilderEthernetFlowSegment {
  phase: 'same-vlan' | 'to-gateway' | 'from-router';
  vlanId: number;
  nodeIds: string[];
  linkIds: string[];
  disposition: 'FLOOD THEN LEARN' | 'UNICAST' | 'ROUTED UNICAST';
}

export interface BuilderEthernetFlowResult {
  sourceId: string;
  destinationId: string;
  sourceVlan: number | null;
  destinationVlan: number | null;
  success: boolean;
  routed: boolean;
  routedAt: string | null;
  ttlBefore: number;
  ttlAfter: number;
  segments: BuilderEthernetFlowSegment[];
  fdb: BuilderEthernetFdbEntry[];
  failureReason: string | null;
  summary: string;
}

const IPV4_RE = /^(?:\d{1,3}\.){3}\d{1,3}$/;
const MAC_RE = /^(?:[0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}$/;

function cloneInterface(entry: BuilderEthernetInterface): BuilderEthernetInterface {
  return { ...entry };
}

export function cloneBuilderEthernetConfig(config: BuilderEthernetConfig): BuilderEthernetConfig {
  return {
    vlans: config.vlans.map((vlan) => ({ ...vlan })),
    devices: config.devices.map((device) => ({ ...device, interfaces: device.interfaces.map(cloneInterface) })),
    links: config.links.map((link) => ({ ...link, allowedVlans: link.allowedVlans ? [...link.allowedVlans] : undefined })),
    layout: Object.fromEntries(Object.entries(config.layout).map(([id, point]) => [id, { ...point }])),
    stp: cloneBuilderStpConfig(config.stp),
  };
}

export function createEmptyBuilderEthernetConfig(): BuilderEthernetConfig {
  return { vlans: [], devices: [], links: [], layout: {}, stp: createDefaultBuilderStpConfig() };
}

export function createDefaultBuilderEthernetConfig(): BuilderEthernetConfig {
  return {
    vlans: [
      { id: 10, name: 'USERS', cidr: '10.10.0.0/24' },
      { id: 20, name: 'SERVERS', cidr: '10.20.0.0/24' },
    ],
    devices: [
      { id: 'lan-a', label: 'PC-A', kind: 'endpoint', mac: '02:48:4f:10:00:0a', interfaces: [{ vlanId: 10, address: '10.10.0.10', gateway: '10.10.0.1' }] },
      { id: 'lan-b', label: 'PC-B', kind: 'endpoint', mac: '02:48:4f:10:00:0b', interfaces: [{ vlanId: 10, address: '10.10.0.11', gateway: '10.10.0.1' }] },
      { id: 'lan-c', label: 'PC-C', kind: 'endpoint', mac: '02:48:4f:20:00:0c', interfaces: [{ vlanId: 20, address: '10.20.0.10', gateway: '10.20.0.1' }] },
      { id: 'lan-sw1', label: 'SW1', kind: 'switch', mac: '02:48:4f:00:01:01', interfaces: [] },
      { id: 'lan-sw2', label: 'SW2', kind: 'switch', mac: '02:48:4f:00:02:02', interfaces: [] },
      { id: 'lan-sw3', label: 'SW3', kind: 'switch', mac: '02:48:4f:00:03:03', interfaces: [] },
      { id: 'lan-r1', label: 'RTR', kind: 'router', mac: '02:48:4f:00:fe:01', interfaces: [
        { vlanId: 10, address: '10.10.0.1' },
        { vlanId: 20, address: '10.20.0.1' },
      ] },
    ],
    links: [
      { id: 'lan-a-sw1', a: 'lan-a', b: 'lan-sw1', mode: 'access', accessVlan: 10, failed: false },
      { id: 'lan-sw1-sw2', a: 'lan-sw1', b: 'lan-sw2', mode: 'trunk', allowedVlans: [10, 20], failed: false },
      { id: 'lan-sw1-sw3', a: 'lan-sw1', b: 'lan-sw3', mode: 'trunk', allowedVlans: [10], failed: false },
      { id: 'lan-sw2-sw3', a: 'lan-sw2', b: 'lan-sw3', mode: 'trunk', allowedVlans: [10], failed: false },
      { id: 'lan-b-sw2', a: 'lan-b', b: 'lan-sw2', mode: 'access', accessVlan: 10, failed: false },
      { id: 'lan-c-sw2', a: 'lan-c', b: 'lan-sw2', mode: 'access', accessVlan: 20, failed: false },
      { id: 'lan-sw1-r1', a: 'lan-sw1', b: 'lan-r1', mode: 'trunk', allowedVlans: [10, 20], failed: false },
    ],
    layout: {
      'lan-a': { x: 8, y: 18 }, 'lan-sw1': { x: 35, y: 35 }, 'lan-sw2': { x: 66, y: 35 }, 'lan-sw3': { x: 58, y: 68 },
      'lan-b': { x: 92, y: 16 }, 'lan-c': { x: 92, y: 68 }, 'lan-r1': { x: 30, y: 82 },
    },
    stp: createDefaultBuilderStpConfig(),
  };
}

function validIpv4(value: string): boolean {
  if (!IPV4_RE.test(value)) return false;
  return value.split('.').every((part) => Number(part) >= 0 && Number(part) <= 255);
}

function validCidr(value: string): boolean {
  const [address, prefix] = value.split('/');
  return Boolean(address && validIpv4(address) && /^\d{1,2}$/.test(prefix ?? '') && Number(prefix) >= 8 && Number(prefix) <= 30);
}

export function validateBuilderEthernetConfig(input: BuilderEthernetConfig): BuilderEthernetConfig {
  if (!input || !Array.isArray(input.vlans) || !Array.isArray(input.devices) || !Array.isArray(input.links) || !input.layout || typeof input.layout !== 'object') {
    throw new Error('Ethernet fabric must contain VLAN, device, link, and layout collections.');
  }
  if (input.devices.length === 0 && input.links.length === 0 && input.vlans.length === 0) return createEmptyBuilderEthernetConfig();
  if (input.devices.length > 24 || input.links.length > 48 || input.vlans.length > 32) throw new Error('Ethernet teaching fabric exceeds its 24-device / 48-link / 32-VLAN ceiling.');

  const vlanIds = new Set<number>();
  for (const vlan of input.vlans) {
    if (!Number.isInteger(vlan.id) || vlan.id < 1 || vlan.id > 4094 || vlanIds.has(vlan.id)) throw new Error(`VLAN ${vlan.id} must be unique and within 1–4094.`);
    if (!vlan.name || vlan.name.length > 32 || !validCidr(vlan.cidr)) throw new Error(`VLAN ${vlan.id} requires a short name and valid IPv4 CIDR.`);
    vlanIds.add(vlan.id);
  }

  const deviceIds = new Set<string>();
  for (const device of input.devices) {
    if (!/^[a-zA-Z0-9_-]+$/.test(device.id) || deviceIds.has(device.id)) throw new Error(`Ethernet device id ${device.id} is invalid or duplicated.`);
    if (!device.label || device.label.length > 32 || !['endpoint','switch','router'].includes(device.kind) || !MAC_RE.test(device.mac)) throw new Error(`Ethernet device ${device.id} metadata is invalid.`);
    if (device.kind === 'switch' && device.interfaces.length !== 0) throw new Error(`Switch ${device.id} cannot own routed IPv4 interfaces in this teaching slice.`);
    if (device.kind === 'endpoint' && device.interfaces.length !== 1) throw new Error(`Endpoint ${device.id} must have exactly one access-VLAN interface.`);
    const localVlans = new Set<number>();
    for (const iface of device.interfaces) {
      if (!vlanIds.has(iface.vlanId) || localVlans.has(iface.vlanId) || !validIpv4(iface.address) || (iface.gateway != null && !validIpv4(iface.gateway))) throw new Error(`Ethernet interface on ${device.id} is invalid.`);
      localVlans.add(iface.vlanId);
    }
    deviceIds.add(device.id);
  }

  const linkIds = new Set<string>();
  const pairs = new Set<string>();
  for (const link of input.links) {
    if (!/^[a-zA-Z0-9_-]+$/.test(link.id) || linkIds.has(link.id) || !deviceIds.has(link.a) || !deviceIds.has(link.b) || link.a === link.b) throw new Error(`Ethernet link ${link.id} is invalid.`);
    const pair = [link.a, link.b].sort().join('|');
    if (pairs.has(pair)) throw new Error(`Duplicate Ethernet link ${pair}.`);
    pairs.add(pair); linkIds.add(link.id);
    const a = input.devices.find((device) => device.id === link.a)!;
    const b = input.devices.find((device) => device.id === link.b)!;
    if (link.mode === 'access') {
      if (!Number.isInteger(link.accessVlan) || !vlanIds.has(link.accessVlan!)) throw new Error(`Access link ${link.id} needs an existing VLAN.`);
    } else if (link.mode === 'trunk') {
      if (a.kind === 'endpoint' || b.kind === 'endpoint') throw new Error(`Endpoint links cannot be trunks (${link.id}).`);
      const allowed = [...new Set(link.allowedVlans ?? [])].sort((x,y)=>x-y);
      if (allowed.length === 0 || allowed.some((id) => !vlanIds.has(id))) throw new Error(`Trunk ${link.id} must allow at least one existing VLAN.`);
    } else throw new Error(`Ethernet link ${link.id} mode must be access or trunk.`);
  }

  for (const device of input.devices) {
    const point = input.layout[device.id];
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y) || point.x < 0 || point.x > 100 || point.y < 0 || point.y > 100) throw new Error(`Ethernet layout is missing ${device.id}.`);
  }
  const normalized = cloneBuilderEthernetConfig({ ...input, stp: cloneBuilderStpConfig(input.stp) });
  normalized.stp = validateBuilderStpConfig(normalized, input.stp);
  return normalized;
}

export function parseBuilderAllowedVlans(text: string, config: BuilderEthernetConfig): number[] {
  const ids = [...new Set(text.split(',').map((part) => Number(part.trim())).filter((id) => Number.isInteger(id)))].sort((a,b)=>a-b);
  const existing = new Set(config.vlans.map((vlan) => vlan.id));
  if (ids.length === 0 || ids.some((id) => !existing.has(id))) throw new Error('Trunk allowed VLANs must be a comma-separated list of existing VLAN IDs.');
  return ids;
}

export function updateBuilderEthernetLink(config: BuilderEthernetConfig, linkId: string, patch: Partial<BuilderEthernetLink>): BuilderEthernetConfig {
  const current = config.links.find((link) => link.id === linkId);
  if (!current) throw new Error(`Unknown Ethernet link ${linkId}.`);
  const next = cloneBuilderEthernetConfig(config);
  next.links = next.links.map((link) => link.id === linkId ? { ...link, ...patch, allowedVlans: patch.allowedVlans ? [...patch.allowedVlans] : link.allowedVlans } : link);
  return validateBuilderEthernetConfig(next);
}

function linkCarriesVlanRaw(link: BuilderEthernetLink, vlanId: number): boolean {
  if (link.failed) return false;
  return link.mode === 'access' ? link.accessVlan === vlanId : Boolean(link.allowedVlans?.includes(vlanId));
}

function linkCarriesVlan(config: BuilderEthernetConfig, link: BuilderEthernetLink, vlanId: number): boolean {
  if (!linkCarriesVlanRaw(link, vlanId)) return false;
  return !builderStpState(config, vlanId).blockedLinkIds.includes(link.id);
}

function deviceById(config: BuilderEthernetConfig, id: string): BuilderEthernetDevice | undefined { return config.devices.find((device) => device.id === id); }
function interfaceFor(device: BuilderEthernetDevice | undefined, vlanId: number): BuilderEthernetInterface | undefined { return device?.interfaces.find((iface) => iface.vlanId === vlanId); }
function neighbors(config: BuilderEthernetConfig, id: string, vlanId: number): Array<{ id: string; linkId: string }> {
  return config.links.filter((link) => linkCarriesVlan(config,link,vlanId) && (link.a===id || link.b===id)).map((link) => ({ id: link.a===id?link.b:link.a, linkId:link.id })).sort((a,b)=>a.id.localeCompare(b.id));
}

export function builderEthernetDeviceById(config: BuilderEthernetConfig, id: string): BuilderEthernetDevice | undefined { return deviceById(config,id); }
export function builderEthernetInterfaceFor(device: BuilderEthernetDevice | undefined, vlanId: number): BuilderEthernetInterface | undefined { return interfaceFor(device,vlanId); }

export function builderEthernetPathForVlan(config: BuilderEthernetConfig, sourceId: string, destinationId: string, vlanId: number): { nodeIds: string[]; linkIds: string[] } | null {
  if (sourceId === destinationId) return { nodeIds:[sourceId], linkIds:[] };
  const queue: Array<{id:string;nodes:string[];links:string[]}> = [{id:sourceId,nodes:[sourceId],links:[]}];
  const seen = new Set([sourceId]);
  while (queue.length) {
    const current = queue.shift()!;
    for (const next of neighbors(config,current.id,vlanId)) {
      if (seen.has(next.id)) continue;
      const nextDevice = deviceById(config,next.id);
      if (!nextDevice) continue;
      const nodes = [...current.nodes,next.id]; const links = [...current.links,next.linkId];
      if (next.id === destinationId) return {nodeIds:nodes,linkIds:links};
      if (nextDevice.kind !== 'switch') continue;
      seen.add(next.id); queue.push({id:next.id,nodes,links});
    }
  }
  return null;
}

function learn(config: BuilderEthernetConfig, path: {nodeIds:string[];linkIds:string[]}, vlanId:number, mac:string, learnedFrom:string, fdb:Map<string,BuilderEthernetFdbEntry>): void {
  path.nodeIds.forEach((nodeId,index) => {
    const device = deviceById(config,nodeId);
    if (device?.kind !== 'switch' || index === 0) return;
    const ingress = path.linkIds[index-1]; if (!ingress) return;
    fdb.set(`${nodeId}:${vlanId}:${mac}`, { switchId:nodeId,vlanId,mac,linkId:ingress,learnedFrom });
  });
}

function fail(sourceId:string,destinationId:string,sourceVlan:number|null,destinationVlan:number|null,reason:string): BuilderEthernetFlowResult {
  return { sourceId,destinationId,sourceVlan,destinationVlan,success:false,routed:false,routedAt:null,ttlBefore:64,ttlAfter:64,segments:[],fdb:[],failureReason:reason,summary:reason };
}

export function runBuilderEthernetFlow(configInput: BuilderEthernetConfig, sourceId: string, destinationId: string): BuilderEthernetFlowResult {
  const config = validateBuilderEthernetConfig(configInput);
  const source = deviceById(config,sourceId); const destination = deviceById(config,destinationId);
  if (!source || !destination || source.kind !== 'endpoint' || destination.kind !== 'endpoint' || sourceId === destinationId) return fail(sourceId,destinationId,null,null,'Choose two different Ethernet endpoints.');
  const sourceIf = source.interfaces[0]; const destinationIf = destination.interfaces[0];
  const sourceVlan = sourceIf?.vlanId ?? null; const destinationVlan = destinationIf?.vlanId ?? null;
  if (!sourceIf || !destinationIf) return fail(sourceId,destinationId,sourceVlan,destinationVlan,'Endpoint VLAN interfaces are incomplete.');
  const fdb = new Map<string,BuilderEthernetFdbEntry>();

  const sourceStp = builderStpState(config, sourceVlan);
  if (!sourceStp.enabled && sourceStp.loopDetected) return fail(sourceId,destinationId,sourceVlan,destinationVlan,`STP is disabled while VLAN ${sourceVlan} contains a Layer-2 cycle. Broadcast/unknown-unicast forwarding is unsafe.`);
  const destinationStp = builderStpState(config, destinationVlan);
  if (!destinationStp.enabled && destinationStp.loopDetected) return fail(sourceId,destinationId,sourceVlan,destinationVlan,`STP is disabled while VLAN ${destinationVlan} contains a Layer-2 cycle. Broadcast/unknown-unicast forwarding is unsafe.`);

  if (sourceVlan === destinationVlan) {
    const path = builderEthernetPathForVlan(config,sourceId,destinationId,sourceVlan);
    if (!path) return fail(sourceId,destinationId,sourceVlan,destinationVlan,`VLAN ${sourceVlan} has no active Layer-2 path between the endpoints.`);
    const reverse = { nodeIds:[...path.nodeIds].reverse(), linkIds:[...path.linkIds].reverse() };
    learn(config,path,sourceVlan,source.mac,sourceId,fdb); learn(config,reverse,sourceVlan,destination.mac,destinationId,fdb);
    return { sourceId,destinationId,sourceVlan,destinationVlan,success:true,routed:false,routedAt:null,ttlBefore:64,ttlAfter:64,
      segments:[{phase:'same-vlan',vlanId:sourceVlan,nodeIds:path.nodeIds,linkIds:path.linkIds,disposition:'FLOOD THEN LEARN'}],fdb:[...fdb.values()].sort((a,b)=>`${a.switchId}:${a.mac}`.localeCompare(`${b.switchId}:${b.mac}`)),failureReason:null,
      summary:`VLAN ${sourceVlan} stays Layer 2: first unknown unicast floods only inside that VLAN, then learned MAC state enables unicast return.` };
  }

  const router = config.devices.filter((device) => device.kind==='router' && interfaceFor(device,sourceVlan) && interfaceFor(device,destinationVlan)).sort((a,b)=>a.id.localeCompare(b.id))[0];
  if (!router) return fail(sourceId,destinationId,sourceVlan,destinationVlan,`VLAN ${sourceVlan} and VLAN ${destinationVlan} are isolated: no router has interfaces in both broadcast domains.`);
  const sourceRouterIf = interfaceFor(router,sourceVlan)!; const destinationRouterIf = interfaceFor(router,destinationVlan)!;
  if (sourceIf.gateway !== sourceRouterIf.address) return fail(sourceId,destinationId,sourceVlan,destinationVlan,`${source.label} gateway ${sourceIf.gateway ?? 'NONE'} does not match ${router.label} VLAN ${sourceVlan} interface ${sourceRouterIf.address}.`);
  if (destinationIf.gateway !== destinationRouterIf.address) return fail(sourceId,destinationId,sourceVlan,destinationVlan,`${destination.label} gateway ${destinationIf.gateway ?? 'NONE'} does not match ${router.label} VLAN ${destinationVlan} interface ${destinationRouterIf.address}.`);
  const toGateway = builderEthernetPathForVlan(config,sourceId,router.id,sourceVlan);
  if (!toGateway) return fail(sourceId,destinationId,sourceVlan,destinationVlan,`VLAN ${sourceVlan} cannot reach the router trunk/access interface.`);
  const fromRouter = builderEthernetPathForVlan(config,router.id,destinationId,destinationVlan);
  if (!fromRouter) return fail(sourceId,destinationId,sourceVlan,destinationVlan,`Router can route to VLAN ${destinationVlan}, but its tagged/access Layer-2 path to ${destination.label} is blocked.`);
  learn(config,toGateway,sourceVlan,source.mac,sourceId,fdb); learn(config,{nodeIds:[...toGateway.nodeIds].reverse(),linkIds:[...toGateway.linkIds].reverse()},sourceVlan,router.mac,router.id,fdb);
  learn(config,fromRouter,destinationVlan,router.mac,router.id,fdb); learn(config,{nodeIds:[...fromRouter.nodeIds].reverse(),linkIds:[...fromRouter.linkIds].reverse()},destinationVlan,destination.mac,destinationId,fdb);
  return { sourceId,destinationId,sourceVlan,destinationVlan,success:true,routed:true,routedAt:router.id,ttlBefore:64,ttlAfter:63,
    segments:[
      {phase:'to-gateway',vlanId:sourceVlan,nodeIds:toGateway.nodeIds,linkIds:toGateway.linkIds,disposition:'FLOOD THEN LEARN'},
      {phase:'from-router',vlanId:destinationVlan,nodeIds:fromRouter.nodeIds,linkIds:fromRouter.linkIds,disposition:'ROUTED UNICAST'},
    ],fdb:[...fdb.values()].sort((a,b)=>`${a.switchId}:${a.vlanId}:${a.mac}`.localeCompare(`${b.switchId}:${b.vlanId}:${b.mac}`)),failureReason:null,
    summary:`${router.label} routes VLAN ${sourceVlan} → VLAN ${destinationVlan} using connected router-on-a-stick subinterfaces; IP TTL decreases once at the router.` };
}
