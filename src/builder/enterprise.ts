import { builderEthernetPathForVlan, cloneBuilderEthernetConfig, runBuilderEthernetFlow, validateBuilderEthernetConfig, type BuilderEthernetConfig, type BuilderEthernetDevice, type BuilderEthernetInterface, type BuilderEthernetLink } from './ethernet.ts';
import { builderStpState } from './stp.ts';

export type BuilderEnterpriseVrfId = string;

export interface BuilderLacpBundleState {
  id: string;
  protocol: 'lacp' | 'static';
  a: string;
  b: string;
  memberLinkIds: string[];
  activeMemberLinkIds: string[];
  forwardingMemberLinkId: string | null;
  state: 'UP' | 'DEGRADED' | 'DOWN';
  explanation: string;
}

export interface BuilderLldpNeighbor {
  id: string;
  localDeviceId: string;
  remoteDeviceId: string;
  linkId: string;
  linkMode: 'access' | 'trunk' | 'routed';
  bundleId: string | null;
  localPort: string;
  remotePort: string;
}

export type BuilderRstpRole = 'ROOT' | 'DESIGNATED' | 'ALTERNATE' | 'EDGE' | 'BUNDLE-MEMBER' | 'DOWN';
export type BuilderRstpPortStateName = 'DISCARDING' | 'LEARNING' | 'FORWARDING' | 'DOWN';

export interface BuilderRstpPortState {
  id: string;
  localDeviceId: string;
  remoteDeviceId: string;
  linkId: string;
  role: BuilderRstpRole;
  state: BuilderRstpPortStateName;
  transitionMs: number;
  reason: string;
}

export interface BuilderRstpState {
  vlanId: number;
  protocol: 'stp' | 'rstp';
  rootBridgeId: string | null;
  ports: BuilderRstpPortState[];
  blockedLinkIds: string[];
  convergenceMs: number;
  explanation: string;
}

export interface BuilderRstpTransitionEvent {
  atMs: number;
  kind: 'PHYSICAL_FAILURE' | 'ROLE_RECALC' | 'LEARNING' | 'FORWARDING';
  linkId: string;
  detail: string;
}

export interface BuilderRstpFailoverPlan {
  protocol: 'stp' | 'rstp';
  vlanId: number;
  failedLinkId: string;
  newlyForwardingPortIds: string[];
  convergedAtMs: number;
  events: BuilderRstpTransitionEvent[];
}

export interface BuilderNativeVlanState {
  linkId: string;
  a: string;
  b: string;
  nativeVlanA: number | null;
  nativeVlanB: number | null;
  preservedVlanIds: number[];
  mismatchedVlanIds: number[];
  state: 'PRESERVED' | 'MISMATCH';
  explanation: string;
}

export interface BuilderFirstHopMemberState {
  deviceId: string;
  address: string;
  priority: number;
  active: boolean;
}

export interface BuilderFirstHopGroupState {
  id: string;
  vlanId: number;
  vrfId: string;
  virtualGateway: string;
  virtualMac: string;
  members: BuilderFirstHopMemberState[];
  masterDeviceId: string | null;
  state: 'MASTERED' | 'DOWN';
  explanation: string;
}

export type BuilderVrfRouteSource = 'connected-svi' | 'connected-routed-port' | 'static';

export interface BuilderVrfRouteEntry {
  id: string;
  deviceId: string;
  vrfId: string;
  prefix: string;
  prefixLength: number;
  source: BuilderVrfRouteSource;
  outgoing: string;
  nextHopDeviceId: string | null;
  vlanId: number | null;
}

export interface BuilderVrfTable {
  deviceId: string;
  vrfId: string;
  routes: BuilderVrfRouteEntry[];
}

export interface BuilderEnterpriseRouteDecision {
  deviceId: string;
  vrfId: string;
  routeId: string;
  prefix: string;
  source: BuilderVrfRouteSource;
  nextHopDeviceId: string | null;
}

export interface BuilderEnterpriseFlowResult {
  sourceId: string;
  destinationId: string;
  success: boolean;
  vrfId: string | null;
  sourceGatewayDeviceId: string | null;
  sourceGatewayVirtual: boolean;
  l2IngressLinkIds: string[];
  routedLinkIds: string[];
  l2EgressLinkIds: string[];
  routeTrace: BuilderEnterpriseRouteDecision[];
  ttlBefore: number;
  ttlAfter: number;
  failureReason: string | null;
  summary: string;
}

function networkDevice(device: BuilderEthernetDevice | undefined): device is BuilderEthernetDevice {
  return Boolean(device && device.kind !== 'endpoint');
}

function switchingDevice(device: BuilderEthernetDevice | undefined): device is BuilderEthernetDevice {
  return Boolean(device && (device.kind === 'switch' || device.kind === 'l3-switch'));
}

function layer3Device(device: BuilderEthernetDevice | undefined): device is BuilderEthernetDevice {
  return Boolean(device && (device.kind === 'router' || device.kind === 'l3-switch'));
}

function vrfId(value: string | null | undefined): string {
  const text = value?.trim();
  return text ? text.toUpperCase() : 'DEFAULT';
}

function interfaceVrf(iface: BuilderEthernetInterface): string {
  return vrfId(iface.vrfId);
}

function linkVrf(link: BuilderEthernetLink): string {
  return vrfId(link.vrfId);
}

function linkPair(link: BuilderEthernetLink): string {
  return [link.a, link.b].sort().join('\u0000');
}


function validEnterprisePrefix(value: string): boolean { try { normalizePrefix(value); return true; } catch { return false; } }

export function validateBuilderEnterpriseConfig(configInput: BuilderEthernetConfig): BuilderEthernetConfig {
  const config=validateBuilderEthernetConfig(configInput);
  const ip=(value:string|null|undefined)=>{if(!value||!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(value))return false;return value.split('.').every((part)=>Number(part)<=255);};
  const validVrf=(value:string|null|undefined)=>value==null||/^[A-Za-z0-9_.-]{1,24}$/.test(value.trim());
  for(const device of config.devices)for(const iface of device.interfaces)if(!validVrf(iface.vrfId)||(iface.virtualGateway!=null&&!ip(iface.virtualGateway))||(iface.gatewayPriority!=null&&(!Number.isInteger(iface.gatewayPriority)||iface.gatewayPriority<1||iface.gatewayPriority>255)))throw new Error(`Enterprise interface on ${device.id} has invalid VRF, virtual gateway, or priority.`);
  for(const link of config.links){
    if(link.mode==='trunk'){
      const allowed=link.allowedVlans??[];for(const native of [link.nativeVlanA,link.nativeVlanB])if(native!=null&&(!Number.isInteger(native)||!allowed.includes(native)))throw new Error(`Trunk ${link.id} native VLAN must be one of its allowed VLANs.`);
      if(link.bundleId!=null&&!/^[A-Za-z0-9_.-]{1,32}$/.test(link.bundleId))throw new Error(`Trunk ${link.id} has an invalid bundle id.`);if(link.bundleProtocol!=null&&(!link.bundleId||!['lacp','static'].includes(link.bundleProtocol)))throw new Error(`Trunk ${link.id} has invalid bundle protocol state.`);
    }else if(link.mode==='routed'){
      if(!ip(link.routedAAddress)||!ip(link.routedBAddress)||!Number.isInteger(link.routedPrefixLength)||link.routedPrefixLength!<8||link.routedPrefixLength!>31||!validVrf(link.vrfId)||link.bundleId||link.accessVlan!=null||link.allowedVlans?.length)throw new Error(`Routed link ${link.id} requires valid addresses, prefix, VRF, and exclusive routed-port semantics.`);
    }else if(link.bundleId)throw new Error(`Access link ${link.id} cannot be an EtherChannel member in this bounded enterprise slice.`);
  }
  const bundles=new Map<string,BuilderEthernetLink[]>();
  for(const link of config.links)if(link.bundleId){const members=bundles.get(link.bundleId)??[];members.push(link);bundles.set(link.bundleId,members);}
  for(const [bundleId,members] of bundles){
    const first=members[0]!;const pair=[first.a,first.b].sort().join('|');const vlans=JSON.stringify([...(first.allowedVlans??[])].sort((a,b)=>a-b));
    if(members.length<2||members.some((member)=>[member.a,member.b].sort().join('|')!==pair||member.mode!=='trunk'||member.bundleProtocol!==first.bundleProtocol||JSON.stringify([...(member.allowedVlans??[])].sort((a,b)=>a-b))!==vlans||member.nativeVlanA!==first.nativeVlanA||member.nativeVlanB!==first.nativeVlanB))throw new Error(`EtherChannel ${bundleId} members must be parallel trunk links with identical VLAN/native/protocol configuration.`);
  }
  const routeIds=new Set<string>();
  for(const route of config.vrfStaticRoutes??[]){
    const device=config.devices.find((entry)=>entry.id===route.deviceId),nextHop=config.devices.find((entry)=>entry.id===route.nextHopDeviceId),link=config.links.find((entry)=>entry.id===route.linkId),vrf=vrfId(route.vrfId);
    if(!route.id||routeIds.has(route.id)||!device||!nextHop||!layer3Device(device)||!layer3Device(nextHop)||!validEnterprisePrefix(route.prefix)||!link||link.mode!=='routed'||!((link.a===route.deviceId&&link.b===route.nextHopDeviceId)||(link.b===route.deviceId&&link.a===route.nextHopDeviceId))||linkVrf(link)!==vrf)throw new Error(`Enterprise VRF static route ${route.id||'UNKNOWN'} must use a unique id, valid prefix, and directly connected routed port in the same VRF.`);
    routeIds.add(route.id);
  }
  return config;
}

function activeBundleMember(config: BuilderEthernetConfig, bundleId: string): BuilderEthernetLink | null {
  return config.links.filter((link) => link.bundleId === bundleId && !link.failed).sort((a, b) => a.id.localeCompare(b.id))[0] ?? null;
}

export function builderLacpBundles(configInput: BuilderEthernetConfig): BuilderLacpBundleState[] {
  const config = validateBuilderEnterpriseConfig(configInput);
  const groups = new Map<string, BuilderEthernetLink[]>();
  for (const link of config.links) {
    if (!link.bundleId) continue;
    const entries = groups.get(link.bundleId) ?? [];
    entries.push(link);
    groups.set(link.bundleId, entries);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([id, links]) => {
    const members = [...links].sort((a, b) => a.id.localeCompare(b.id));
    const active = members.filter((link) => !link.failed);
    const protocol = members[0]?.bundleProtocol ?? 'lacp';
    const state: BuilderLacpBundleState['state'] = active.length === 0 ? 'DOWN' : active.length < members.length ? 'DEGRADED' : 'UP';
    return {
      id,
      protocol,
      a: members[0]?.a ?? '',
      b: members[0]?.b ?? '',
      memberLinkIds: members.map((link) => link.id),
      activeMemberLinkIds: active.map((link) => link.id),
      forwardingMemberLinkId: active[0]?.id ?? null,
      state,
      explanation: `${id.toUpperCase()} is one logical ${protocol === 'lacp' ? 'LACP' : 'static EtherChannel'} edge over ${members.length} physical member${members.length === 1 ? '' : 's'}; ${active.length} member${active.length === 1 ? '' : 's'} currently operational.`,
    };
  });
}

export function builderLldpNeighbors(configInput: BuilderEthernetConfig): BuilderLldpNeighbor[] {
  const config = validateBuilderEnterpriseConfig(configInput);
  const devices = new Map(config.devices.map((device) => [device.id, device]));
  const neighbors: BuilderLldpNeighbor[] = [];
  for (const link of [...config.links].sort((a, b) => a.id.localeCompare(b.id))) {
    if (link.failed) continue;
    const a = devices.get(link.a); const b = devices.get(link.b);
    if (!networkDevice(a) || !networkDevice(b)) continue;
    neighbors.push(
      { id: `${link.id}:${link.a}`, localDeviceId: link.a, remoteDeviceId: link.b, linkId: link.id, linkMode: link.mode, bundleId: link.bundleId ?? null, localPort: `${link.id}:A`, remotePort: `${link.id}:B` },
      { id: `${link.id}:${link.b}`, localDeviceId: link.b, remoteDeviceId: link.a, linkId: link.id, linkMode: link.mode, bundleId: link.bundleId ?? null, localPort: `${link.id}:B`, remotePort: `${link.id}:A` },
    );
  }
  return neighbors.sort((a, b) => a.localDeviceId.localeCompare(b.localDeviceId) || a.linkId.localeCompare(b.linkId) || a.remoteDeviceId.localeCompare(b.remoteDeviceId));
}

function trunkEncoding(link: BuilderEthernetLink, vlanId: number, side: 'a' | 'b'): 'tagged' | 'untagged' | 'not-carried' {
  if (link.mode !== 'trunk' || !link.allowedVlans?.includes(vlanId)) return 'not-carried';
  const native = side === 'a' ? link.nativeVlanA : link.nativeVlanB;
  return native === vlanId ? 'untagged' : 'tagged';
}

export function builderNativeVlanStates(configInput: BuilderEthernetConfig): BuilderNativeVlanState[] {
  const config = validateBuilderEnterpriseConfig(configInput);
  return config.links.filter((link) => link.mode === 'trunk').sort((a, b) => a.id.localeCompare(b.id)).map((link) => {
    const carried = [...new Set(link.allowedVlans ?? [])].sort((a, b) => a - b);
    const mismatched = carried.filter((vlanId) => trunkEncoding(link, vlanId, 'a') !== trunkEncoding(link, vlanId, 'b'));
    const preserved = carried.filter((vlanId) => !mismatched.includes(vlanId));
    return {
      linkId: link.id,
      a: link.a,
      b: link.b,
      nativeVlanA: link.nativeVlanA ?? null,
      nativeVlanB: link.nativeVlanB ?? null,
      preservedVlanIds: preserved,
      mismatchedVlanIds: mismatched,
      state: mismatched.length ? 'MISMATCH' : 'PRESERVED',
      explanation: mismatched.length ? `Native/tagged encoding differs for VLAN ${mismatched.join(', ')}; HOPSCOTCH fails closed instead of silently remapping VLAN truth.` : 'Both ends agree on tagged/native encoding for every allowed VLAN.',
    };
  });
}

function logicalStpRepresentative(config: BuilderEthernetConfig, link: BuilderEthernetLink, vlanId: number): string | null {
  if (!link.bundleId) return link.id;
  const candidates = config.links.filter((candidate) => candidate.bundleId === link.bundleId && !candidate.failed && candidate.mode !== 'routed' && (candidate.mode === 'access' ? candidate.accessVlan === vlanId : Boolean(candidate.allowedVlans?.includes(vlanId)))).sort((a, b) => a.id.localeCompare(b.id));
  return candidates[0]?.id ?? null;
}

export function builderRstpState(configInput: BuilderEthernetConfig, vlanId: number): BuilderRstpState {
  const config = validateBuilderEnterpriseConfig(configInput);
  const steady = builderStpState(config, vlanId);
  const protocol = config.stp.protocol ?? 'stp';
  const root = steady.rootBridgeId;
  const devices = new Map(config.devices.map((device) => [device.id, device]));
  const forwarding = new Set(steady.forwardingLinkIds);
  const adjacency = new Map<string, Array<{ id: string; linkId: string }>>();
  for (const device of config.devices.filter((device) => switchingDevice(device))) adjacency.set(device.id, []);
  for (const link of config.links) {
    if (!forwarding.has(link.id)) continue;
    if (!switchingDevice(devices.get(link.a)) || !switchingDevice(devices.get(link.b))) continue;
    adjacency.get(link.a)?.push({ id: link.b, linkId: link.id }); adjacency.get(link.b)?.push({ id: link.a, linkId: link.id });
  }
  const distance = new Map<string, number>();
  if (root) {
    const queue = [root]; distance.set(root, 0);
    while (queue.length) {
      const current = queue.shift()!;
      for (const edge of adjacency.get(current) ?? []) if (!distance.has(edge.id)) { distance.set(edge.id, (distance.get(current) ?? 0) + 1); queue.push(edge.id); }
    }
  }
  const steadyPorts = new Map(steady.ports.map((port) => [port.linkId, port]));
  const ports: BuilderRstpPortState[] = [];
  for (const link of [...config.links].sort((a, b) => a.id.localeCompare(b.id))) {
    const a = devices.get(link.a); const b = devices.get(link.b);
    if (link.failed) {
      for (const local of [a, b].filter((device): device is BuilderEthernetDevice => switchingDevice(device))) ports.push({ id: `${local.id}:${link.id}`, localDeviceId: local.id, remoteDeviceId: local.id === link.a ? link.b : link.a, linkId: link.id, role: 'DOWN', state: 'DOWN', transitionMs: 0, reason: 'Physical member is down.' });
      continue;
    }
    if (!switchingDevice(a) && !switchingDevice(b)) continue;
    const rep = logicalStpRepresentative(config, link, vlanId);
    if (link.bundleId && rep && rep !== link.id) {
      for (const local of [a, b].filter((device): device is BuilderEthernetDevice => switchingDevice(device))) ports.push({ id: `${local.id}:${link.id}`, localDeviceId: local.id, remoteDeviceId: local.id === link.a ? link.b : link.a, linkId: link.id, role: 'BUNDLE-MEMBER', state: 'FORWARDING', transitionMs: 0, reason: `Physical member forwards as part of logical bundle ${link.bundleId}; spanning tree runs on the bundle edge.` });
      continue;
    }
    if (!switchingDevice(a) || !switchingDevice(b)) {
      const local = switchingDevice(a) ? a : b!; const remote = local.id === link.a ? link.b : link.a;
      ports.push({ id: `${local.id}:${link.id}`, localDeviceId: local.id, remoteDeviceId: remote, linkId: link.id, role: 'EDGE', state: 'FORWARDING', transitionMs: 0, reason: 'Edge-facing segment does not require a redundant switch role.' });
      continue;
    }
    const stpPort = steadyPorts.get(link.id);
    for (const local of [a, b]) {
      const remote = local.id === link.a ? b : a;
      if (stpPort?.state === 'BLOCKING') {
        const alternate = stpPort.blockedAt === local.id;
        ports.push({ id: `${local.id}:${link.id}`, localDeviceId: local.id, remoteDeviceId: remote.id, linkId: link.id, role: alternate ? 'ALTERNATE' : 'DESIGNATED', state: alternate ? 'DISCARDING' : 'FORWARDING', transitionMs: alternate ? 0 : protocol === 'rstp' ? 400 : 30000, reason: alternate ? 'Alternate path retained without forwarding loops.' : 'Designated side forwards toward the segment.' });
      } else {
        const localDistance = distance.get(local.id) ?? Number.POSITIVE_INFINITY; const remoteDistance = distance.get(remote.id) ?? Number.POSITIVE_INFINITY;
        const role: BuilderRstpRole = localDistance > remoteDistance ? 'ROOT' : 'DESIGNATED';
        ports.push({ id: `${local.id}:${link.id}`, localDeviceId: local.id, remoteDeviceId: remote.id, linkId: link.id, role, state: 'FORWARDING', transitionMs: protocol === 'rstp' ? 400 : 30000, reason: role === 'ROOT' ? 'Best port toward the elected root bridge.' : 'Designated port for this tree segment.' });
      }
    }
  }
  return { vlanId, protocol, rootBridgeId: root, ports, blockedLinkIds: steady.blockedLinkIds, convergenceMs: protocol === 'rstp' ? 400 : 30000, explanation: protocol === 'rstp' ? `RSTP projects root/designated/alternate roles and a bounded 400 ms teaching convergence after a simple redundant-link failure.` : 'Classic STP steady state is preserved with a 30 s teaching transition window.' };
}

export function builderRstpFailoverPlan(configInput: BuilderEthernetConfig, vlanId: number, failedLinkId: string): BuilderRstpFailoverPlan {
  const config = validateBuilderEnterpriseConfig(configInput);
  const before = builderRstpState(config, vlanId);
  const next = cloneBuilderEthernetConfig(config);
  const link = next.links.find((entry) => entry.id === failedLinkId);
  if (!link) throw new Error(`Unknown Ethernet link ${failedLinkId}.`);
  link.failed = true;
  const after = builderRstpState(next, vlanId);
  const beforeForwarding = new Set(before.ports.filter((port) => port.state === 'FORWARDING').map((port) => port.id));
  const newlyForwarding = after.ports.filter((port) => port.state === 'FORWARDING' && !beforeForwarding.has(port.id)).map((port) => port.id).sort();
  const rapid = before.protocol === 'rstp';
  const convergedAtMs = rapid ? 400 : 30000;
  const promotedLink = newlyForwarding[0]?.split(':').slice(1).join(':') || failedLinkId;
  const events: BuilderRstpTransitionEvent[] = [
    { atMs: 0, kind: 'PHYSICAL_FAILURE', linkId: failedLinkId, detail: 'Physical member leaves the active topology.' },
    { atMs: rapid ? 120 : 15000, kind: 'ROLE_RECALC', linkId: promotedLink, detail: rapid ? 'Alternate/root roles recompute through proposal/agreement semantics.' : 'Classic STP waits through its listening interval.' },
    { atMs: rapid ? 250 : 15000, kind: 'LEARNING', linkId: promotedLink, detail: 'Replacement path may learn source MAC state without forwarding user traffic yet.' },
    { atMs: convergedAtMs, kind: 'FORWARDING', linkId: promotedLink, detail: 'Loop-free replacement path forwards user traffic.' },
  ];
  return { protocol: before.protocol, vlanId, failedLinkId, newlyForwardingPortIds: newlyForwarding, convergedAtMs, events };
}

function hashByte(text: string): number {
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) hash = ((hash * 33) ^ text.charCodeAt(index)) & 0xff;
  return hash;
}

function vlanLinkAvailable(config: BuilderEthernetConfig, deviceId: string, vlanId: number): boolean {
  return config.links.some((link) => !link.failed && link.mode !== 'routed' && (link.a === deviceId || link.b === deviceId) && (link.mode === 'access' ? link.accessVlan === vlanId : Boolean(link.allowedVlans?.includes(vlanId))));
}

export function builderFirstHopGroups(configInput: BuilderEthernetConfig): BuilderFirstHopGroupState[] {
  const config = validateBuilderEnterpriseConfig(configInput);
  const groups = new Map<string, Array<{ device: BuilderEthernetDevice; iface: BuilderEthernetInterface }>>();
  for (const device of config.devices.filter((device) => layer3Device(device))) {
    for (const iface of device.interfaces) {
      if (!iface.virtualGateway) continue;
      const key = `${iface.vlanId}\u0000${interfaceVrf(iface)}\u0000${iface.virtualGateway}`;
      const members = groups.get(key) ?? []; members.push({ device, iface }); groups.set(key, members);
    }
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, entries]) => {
    const [vlanText, vrf, virtualGateway] = key.split('\u0000'); const vlanId = Number(vlanText);
    const members = entries.map(({ device, iface }) => ({ deviceId: device.id, address: iface.address, priority: iface.gatewayPriority ?? 100, active: vlanLinkAvailable(config, device.id, vlanId) })).sort((a, b) => b.priority - a.priority || a.deviceId.localeCompare(b.deviceId));
    const master = members.find((member) => member.active) ?? null;
    const macByte = hashByte(`${vrf}:${vlanId}:${virtualGateway}`).toString(16).padStart(2, '0');
    return { id: `fh:${vrf}:${vlanId}:${virtualGateway}`, vlanId, vrfId: vrf, virtualGateway, virtualMac: `02:48:4f:ff:00:${macByte}`, members, masterDeviceId: master?.deviceId ?? null, state: master ? 'MASTERED' : 'DOWN', explanation: master ? `${master.deviceId} owns ${virtualGateway} in ${vrf}; backups remain separate members of the same first-hop group.` : `No active first-hop member can currently reach VLAN ${vlanId}.` };
  });
}

function ipv4ToInt(value: string): number {
  return value.split('.').reduce((result, part) => ((result << 8) | Number(part)) >>> 0, 0) >>> 0;
}

function intToIpv4(value: number): string {
  return [24, 16, 8, 0].map((shift) => ((value >>> 0) >>> shift) & 255).join('.');
}

function normalizePrefix(value: string): { cidr: string; prefixLength: number; network: number; broadcast: number } {
  const [address, prefixText] = value.split('/'); const prefixLength = Number(prefixText);
  if (!address || !Number.isInteger(prefixLength) || prefixLength < 0 || prefixLength > 32) throw new Error(`Invalid enterprise route prefix ${value}.`);
  const raw = ipv4ToInt(address); const mask = prefixLength === 0 ? 0 : (0xffffffff << (32 - prefixLength)) >>> 0; const network = (raw & mask) >>> 0; const broadcast = (network | (~mask >>> 0)) >>> 0;
  return { cidr: `${intToIpv4(network)}/${prefixLength}`, prefixLength, network, broadcast };
}

function contains(prefix: string, address: string): boolean {
  const parsed = normalizePrefix(prefix); const value = ipv4ToInt(address); return value >= parsed.network && value <= parsed.broadcast;
}

function routedPrefix(link: BuilderEthernetLink): string | null {
  if (link.mode !== 'routed' || !link.routedAAddress || !Number.isInteger(link.routedPrefixLength)) return null;
  return normalizePrefix(`${link.routedAAddress}/${link.routedPrefixLength}`).cidr;
}

export function builderVrfTables(configInput: BuilderEthernetConfig): BuilderVrfTable[] {
  const config = validateBuilderEnterpriseConfig(configInput);
  const byKey = new Map<string, BuilderVrfRouteEntry[]>();
  const push = (entry: BuilderVrfRouteEntry) => { const key = `${entry.deviceId}\u0000${entry.vrfId}`; const rows = byKey.get(key) ?? []; rows.push(entry); byKey.set(key, rows); };
  for (const device of config.devices.filter((device) => layer3Device(device))) {
    for (const iface of device.interfaces) {
      const vlan = config.vlans.find((entry) => entry.id === iface.vlanId); if (!vlan) continue;
      const parsed = normalizePrefix(vlan.cidr); push({ id: `connected:svi:${device.id}:${iface.vlanId}:${interfaceVrf(iface)}`, deviceId: device.id, vrfId: interfaceVrf(iface), prefix: parsed.cidr, prefixLength: parsed.prefixLength, source: 'connected-svi', outgoing: `SVI ${iface.vlanId}`, nextHopDeviceId: null, vlanId: iface.vlanId });
    }
  }
  for (const link of config.links.filter((link) => link.mode === 'routed')) {
    const prefix = routedPrefix(link); if (!prefix) continue; const parsed = normalizePrefix(prefix); const vrf = linkVrf(link);
    push({ id: `connected:routed:${link.a}:${link.id}`, deviceId: link.a, vrfId: vrf, prefix: parsed.cidr, prefixLength: parsed.prefixLength, source: 'connected-routed-port', outgoing: link.id, nextHopDeviceId: link.b, vlanId: null });
    push({ id: `connected:routed:${link.b}:${link.id}`, deviceId: link.b, vrfId: vrf, prefix: parsed.cidr, prefixLength: parsed.prefixLength, source: 'connected-routed-port', outgoing: link.id, nextHopDeviceId: link.a, vlanId: null });
  }
  for (const route of config.vrfStaticRoutes ?? []) {
    const parsed = normalizePrefix(route.prefix); push({ id: route.id, deviceId: route.deviceId, vrfId: vrfId(route.vrfId), prefix: parsed.cidr, prefixLength: parsed.prefixLength, source: 'static', outgoing: route.linkId, nextHopDeviceId: route.nextHopDeviceId, vlanId: null });
  }
  return [...byKey.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, routes]) => {
    const [deviceId, vrf] = key.split('\u0000');
    return { deviceId, vrfId: vrf, routes: routes.sort((a, b) => b.prefixLength - a.prefixLength || (a.source === 'connected-svi' ? -1 : b.source === 'connected-svi' ? 1 : 0) || a.id.localeCompare(b.id)) };
  });
}

export function builderVrfLookup(configInput: BuilderEthernetConfig, deviceId: string, vrf: string, destinationAddress: string): BuilderVrfRouteEntry | null {
  const table = builderVrfTables(configInput).find((entry) => entry.deviceId === deviceId && entry.vrfId === vrfId(vrf));
  return table?.routes.find((route) => contains(route.prefix, destinationAddress)) ?? null;
}

function gatewayCandidates(config: BuilderEthernetConfig, endpoint: BuilderEthernetDevice): Array<{ device: BuilderEthernetDevice; iface: BuilderEthernetInterface; path: { nodeIds: string[]; linkIds: string[] }; virtual: boolean }> {
  const endpointIf = endpoint.interfaces[0]; if (!endpointIf) return [];
  return config.devices.filter((device) => layer3Device(device)).flatMap((device) => {
    const iface = device.interfaces.find((entry) => entry.vlanId === endpointIf.vlanId); if (!iface) return [];
    const physical = endpointIf.gateway === iface.address; const virtual = Boolean(iface.virtualGateway && endpointIf.gateway === iface.virtualGateway);
    if (!physical && !virtual) return [];
    const path = builderEthernetPathForVlan(config, endpoint.id, device.id, endpointIf.vlanId); if (!path) return [];
    return [{ device, iface, path, virtual }];
  }).sort((a, b) => (b.iface.gatewayPriority ?? 100) - (a.iface.gatewayPriority ?? 100) || a.device.id.localeCompare(b.device.id));
}

function routedLinkTo(config: BuilderEthernetConfig, from: string, to: string, vrf: string, linkId?: string): BuilderEthernetLink | null {
  return config.links.filter((link) => !link.failed && link.mode === 'routed' && linkVrf(link) === vrfId(vrf) && ((link.a === from && link.b === to) || (link.a === to && link.b === from)) && (!linkId || link.id === linkId)).sort((a, b) => a.id.localeCompare(b.id))[0] ?? null;
}

function enterpriseFail(sourceId: string, destinationId: string, reason: string, vrf: string | null = null): BuilderEnterpriseFlowResult {
  return { sourceId, destinationId, success: false, vrfId: vrf, sourceGatewayDeviceId: null, sourceGatewayVirtual: false, l2IngressLinkIds: [], routedLinkIds: [], l2EgressLinkIds: [], routeTrace: [], ttlBefore: 64, ttlAfter: 64, failureReason: reason, summary: reason };
}

export function runBuilderEnterpriseFlow(configInput: BuilderEthernetConfig, sourceId: string, destinationId: string): BuilderEnterpriseFlowResult {
  const config = validateBuilderEnterpriseConfig(configInput);
  const source = config.devices.find((device) => device.id === sourceId); const destination = config.devices.find((device) => device.id === destinationId);
  if (!source || !destination || source.kind !== 'endpoint' || destination.kind !== 'endpoint' || source.id === destination.id) return enterpriseFail(sourceId, destinationId, 'Choose two different enterprise endpoints.');
  const sourceIf = source.interfaces[0]; const destinationIf = destination.interfaces[0];
  if (!sourceIf || !destinationIf) return enterpriseFail(sourceId, destinationId, 'Endpoint interfaces are incomplete.');
  if (sourceIf.vlanId === destinationIf.vlanId) {
    const base = runBuilderEthernetFlow(config, sourceId, destinationId);
    return base.success ? { sourceId, destinationId, success: true, vrfId: null, sourceGatewayDeviceId: null, sourceGatewayVirtual: false, l2IngressLinkIds: base.segments[0]?.linkIds ?? [], routedLinkIds: [], l2EgressLinkIds: [], routeTrace: [], ttlBefore: 64, ttlAfter: 64, failureReason: null, summary: base.summary } : enterpriseFail(sourceId, destinationId, base.failureReason ?? 'Layer-2 forwarding failed.');
  }
  const gateways = gatewayCandidates(config, source);
  if (!gateways.length) return enterpriseFail(sourceId, destinationId, `${source.label} cannot reach any physical or virtual first-hop gateway for VLAN ${sourceIf.vlanId}.`);
  const gateway = gateways[0]; const vrf = interfaceVrf(gateway.iface);
  const destinationGatewayIfaces = config.devices.filter((device) => layer3Device(device)).flatMap((device) => device.interfaces.filter((iface) => iface.vlanId === destinationIf.vlanId && interfaceVrf(iface) === vrf).map((iface) => ({ device, iface })));
  if (!destinationGatewayIfaces.length) return enterpriseFail(sourceId, destinationId, `VRF ${vrf} has no Layer-3 interface for destination VLAN ${destinationIf.vlanId}.`, vrf);
  if (!destinationGatewayIfaces.some(({ iface }) => destinationIf.gateway === iface.address || destinationIf.gateway === iface.virtualGateway)) return enterpriseFail(sourceId, destinationId, `${destination.label} gateway ${destinationIf.gateway ?? 'NONE'} does not belong to VRF ${vrf}'s destination VLAN.`, vrf);

  let current = gateway.device.id; const visited = new Set<string>(); const routedLinks: string[] = []; const trace: BuilderEnterpriseRouteDecision[] = [];
  for (let hop = 0; hop < 16; hop += 1) {
    if (visited.has(current)) return enterpriseFail(sourceId, destinationId, `VRF ${vrf} static forwarding loop detected at ${current}.`, vrf);
    visited.add(current);
    const route = builderVrfLookup(config, current, vrf, destinationIf.address);
    if (!route) return { ...enterpriseFail(sourceId, destinationId, `${current} has no ${vrf} route to ${destinationIf.address}.`, vrf), sourceGatewayDeviceId: gateway.device.id, sourceGatewayVirtual: gateway.virtual, l2IngressLinkIds: gateway.path.linkIds, routedLinkIds: routedLinks, routeTrace: trace };
    trace.push({ deviceId: current, vrfId: vrf, routeId: route.id, prefix: route.prefix, source: route.source, nextHopDeviceId: route.nextHopDeviceId });
    if (route.source === 'connected-svi') {
      if (route.vlanId !== destinationIf.vlanId) return { ...enterpriseFail(sourceId, destinationId, `${current} matched ${route.prefix} in ${vrf}, but that connected prefix belongs to VLAN ${route.vlanId}; overlapping address space stays isolated.`, vrf), sourceGatewayDeviceId: gateway.device.id, sourceGatewayVirtual: gateway.virtual, l2IngressLinkIds: gateway.path.linkIds, routedLinkIds: routedLinks, routeTrace: trace };
      const egress = builderEthernetPathForVlan(config, current, destination.id, destinationIf.vlanId);
      if (!egress) return { ...enterpriseFail(sourceId, destinationId, `${current} owns the destination SVI but VLAN ${destinationIf.vlanId} has no active Layer-2 egress path.`, vrf), sourceGatewayDeviceId: gateway.device.id, sourceGatewayVirtual: gateway.virtual, l2IngressLinkIds: gateway.path.linkIds, routedLinkIds: routedLinks, routeTrace: trace };
      const ttlAfter = Math.max(1, 64 - trace.length);
      return { sourceId, destinationId, success: true, vrfId: vrf, sourceGatewayDeviceId: gateway.device.id, sourceGatewayVirtual: gateway.virtual, l2IngressLinkIds: gateway.path.linkIds, routedLinkIds: routedLinks, l2EgressLinkIds: egress.linkIds, routeTrace: trace, ttlBefore: 64, ttlAfter, failureReason: null, summary: `${source.label} enters ${vrf} through ${gateway.virtual ? 'virtual first-hop gateway' : 'physical gateway'} ${gateway.device.label}; ${trace.length} Layer-3 decision${trace.length === 1 ? '' : 's'} reach ${destination.label} without leaking into another VRF.` };
    }
    if (route.source !== 'static' || !route.nextHopDeviceId) return { ...enterpriseFail(sourceId, destinationId, `${current} matched a connected routed-port prefix that does not directly contain the endpoint; no implicit route is invented.`, vrf), sourceGatewayDeviceId: gateway.device.id, sourceGatewayVirtual: gateway.virtual, l2IngressLinkIds: gateway.path.linkIds, routedLinkIds: routedLinks, routeTrace: trace };
    const link = routedLinkTo(config, current, route.nextHopDeviceId, vrf, route.outgoing);
    if (!link) return { ...enterpriseFail(sourceId, destinationId, `${current} static route ${route.id} points to ${route.nextHopDeviceId}, but its ${vrf} routed port is down or absent.`, vrf), sourceGatewayDeviceId: gateway.device.id, sourceGatewayVirtual: gateway.virtual, l2IngressLinkIds: gateway.path.linkIds, routedLinkIds: routedLinks, routeTrace: trace };
    routedLinks.push(link.id); current = route.nextHopDeviceId;
  }
  return enterpriseFail(sourceId, destinationId, `VRF ${vrf} exceeded the bounded 16-hop forwarding ceiling.`, vrf);
}

export function createBuilderEnterpriseDemo(): BuilderEthernetConfig {
  const config: BuilderEthernetConfig = {
    vlans: [
      { id: 110, name: 'BLUE-USERS', cidr: '10.50.0.0/24' }, { id: 120, name: 'RED-USERS', cidr: '10.50.0.0/24' },
      { id: 130, name: 'BLUE-APPS', cidr: '10.60.0.0/24' }, { id: 140, name: 'RED-APPS', cidr: '10.60.0.0/24' },
    ],
    devices: [
      { id: 'blue-client', label: 'BLUE CLIENT', kind: 'endpoint', mac: '02:48:4f:11:00:10', interfaces: [{ vlanId: 110, address: '10.50.0.10', gateway: '10.50.0.1' }] },
      { id: 'red-client', label: 'RED CLIENT', kind: 'endpoint', mac: '02:48:4f:12:00:10', interfaces: [{ vlanId: 120, address: '10.50.0.10', gateway: '10.50.0.1' }] },
      { id: 'blue-server', label: 'BLUE SERVER', kind: 'endpoint', mac: '02:48:4f:13:00:10', interfaces: [{ vlanId: 130, address: '10.60.0.10', gateway: '10.60.0.1' }] },
      { id: 'red-server', label: 'RED SERVER', kind: 'endpoint', mac: '02:48:4f:14:00:10', interfaces: [{ vlanId: 140, address: '10.60.0.10', gateway: '10.60.0.1' }] },
      { id: 'access-a', label: 'ACCESS-A', kind: 'switch', mac: '02:48:4f:00:11:01', interfaces: [] },
      { id: 'access-b', label: 'ACCESS-B', kind: 'switch', mac: '02:48:4f:00:12:01', interfaces: [] },
      { id: 'dist-a', label: 'DIST-A', kind: 'l3-switch', mac: '02:48:4f:00:21:01', interfaces: [
        { vlanId: 110, address: '10.50.0.2', vrfId: 'BLUE', virtualGateway: '10.50.0.1', gatewayPriority: 120 },
        { vlanId: 120, address: '10.50.0.2', vrfId: 'RED', virtualGateway: '10.50.0.1', gatewayPriority: 120 },
      ] },
      { id: 'dist-b', label: 'DIST-B', kind: 'l3-switch', mac: '02:48:4f:00:22:01', interfaces: [
        { vlanId: 110, address: '10.50.0.3', vrfId: 'BLUE', virtualGateway: '10.50.0.1', gatewayPriority: 110 },
        { vlanId: 120, address: '10.50.0.3', vrfId: 'RED', virtualGateway: '10.50.0.1', gatewayPriority: 110 },
      ] },
      { id: 'core', label: 'CORE', kind: 'l3-switch', mac: '02:48:4f:00:31:01', interfaces: [
        { vlanId: 130, address: '10.60.0.1', vrfId: 'BLUE' }, { vlanId: 140, address: '10.60.0.1', vrfId: 'RED' },
      ] },
    ],
    links: [
      { id: 'blue-client-access', a: 'blue-client', b: 'access-a', mode: 'access', accessVlan: 110, failed: false },
      { id: 'red-client-access', a: 'red-client', b: 'access-a', mode: 'access', accessVlan: 120, failed: false },
      { id: 'blue-server-access', a: 'blue-server', b: 'access-b', mode: 'access', accessVlan: 130, failed: false },
      { id: 'red-server-access', a: 'red-server', b: 'access-b', mode: 'access', accessVlan: 140, failed: false },
      { id: 'access-a-dist-a-1', a: 'access-a', b: 'dist-a', mode: 'trunk', allowedVlans: [110, 120], nativeVlanA: 110, nativeVlanB: 110, bundleId: 'po-access-a', bundleProtocol: 'lacp', failed: false },
      { id: 'access-a-dist-a-2', a: 'access-a', b: 'dist-a', mode: 'trunk', allowedVlans: [110, 120], nativeVlanA: 110, nativeVlanB: 110, bundleId: 'po-access-a', bundleProtocol: 'lacp', failed: false },
      { id: 'access-a-dist-b', a: 'access-a', b: 'dist-b', mode: 'trunk', allowedVlans: [110, 120], failed: false },
      { id: 'dist-a-dist-b', a: 'dist-a', b: 'dist-b', mode: 'trunk', allowedVlans: [110, 120], failed: false },
      { id: 'access-b-core', a: 'access-b', b: 'core', mode: 'trunk', allowedVlans: [130, 140], failed: false },
      { id: 'dist-a-core-blue', a: 'dist-a', b: 'core', mode: 'routed', routedAAddress: '172.16.0.0', routedBAddress: '172.16.0.1', routedPrefixLength: 31, vrfId: 'BLUE', failed: false },
      { id: 'dist-b-core-blue', a: 'dist-b', b: 'core', mode: 'routed', routedAAddress: '172.16.0.2', routedBAddress: '172.16.0.3', routedPrefixLength: 31, vrfId: 'BLUE', failed: false },
      { id: 'dist-a-core-red', a: 'dist-a', b: 'core', mode: 'routed', routedAAddress: '172.16.1.0', routedBAddress: '172.16.1.1', routedPrefixLength: 31, vrfId: 'RED', failed: false },
      { id: 'dist-b-core-red', a: 'dist-b', b: 'core', mode: 'routed', routedAAddress: '172.16.1.2', routedBAddress: '172.16.1.3', routedPrefixLength: 31, vrfId: 'RED', failed: false },
    ],
    layout: {
      'blue-client': { x: 5, y: 18 }, 'red-client': { x: 5, y: 40 }, 'access-a': { x: 24, y: 29 }, 'dist-a': { x: 46, y: 18 }, 'dist-b': { x: 46, y: 45 },
      core: { x: 68, y: 31 }, 'access-b': { x: 84, y: 31 }, 'blue-server': { x: 97, y: 18 }, 'red-server': { x: 97, y: 44 },
    },
    stp: { enabled: true, protocol: 'rstp', bridgePriorities: { 'access-a': 4096, 'dist-a': 8192, 'dist-b': 12288, 'access-b': 4096, core: 8192 } },
    vrfStaticRoutes: [
      { id: 'blue-dist-a-apps', deviceId: 'dist-a', vrfId: 'BLUE', prefix: '10.60.0.0/24', nextHopDeviceId: 'core', linkId: 'dist-a-core-blue' },
      { id: 'blue-dist-b-apps', deviceId: 'dist-b', vrfId: 'BLUE', prefix: '10.60.0.0/24', nextHopDeviceId: 'core', linkId: 'dist-b-core-blue' },
      { id: 'red-dist-a-apps', deviceId: 'dist-a', vrfId: 'RED', prefix: '10.60.0.0/24', nextHopDeviceId: 'core', linkId: 'dist-a-core-red' },
      { id: 'red-dist-b-apps', deviceId: 'dist-b', vrfId: 'RED', prefix: '10.60.0.0/24', nextHopDeviceId: 'core', linkId: 'dist-b-core-red' },
      { id: 'blue-core-users', deviceId: 'core', vrfId: 'BLUE', prefix: '10.50.0.0/24', nextHopDeviceId: 'dist-a', linkId: 'dist-a-core-blue' },
      { id: 'red-core-users', deviceId: 'core', vrfId: 'RED', prefix: '10.50.0.0/24', nextHopDeviceId: 'dist-a', linkId: 'dist-a-core-red' },
    ],
  };
  return validateBuilderEnterpriseConfig(config);
}

export function builderEnterpriseRole(configInput: BuilderEthernetConfig, deviceId: string): 'ACCESS' | 'DISTRIBUTION' | 'CORE' | 'EDGE' | null {
  const config = validateBuilderEnterpriseConfig(configInput); const device = config.devices.find((entry) => entry.id === deviceId); if (!networkDevice(device)) return null;
  const links = config.links.filter((link) => link.a === deviceId || link.b === deviceId);
  const endpointLinks = links.filter((link) => networkDevice(config.devices.find((entry) => entry.id === (link.a === deviceId ? link.b : link.a))) === false && config.devices.find((entry) => entry.id === (link.a === deviceId ? link.b : link.a))?.kind === 'endpoint').length;
  const routed = links.filter((link) => link.mode === 'routed').length;
  if (endpointLinks > 0 && routed === 0) return 'ACCESS';
  if (device.kind === 'l3-switch' && routed > 0 && links.some((link) => link.mode === 'trunk')) return 'DISTRIBUTION';
  if (device.kind === 'l3-switch' && routed >= 2) return 'CORE';
  return 'EDGE';
}

export function builderEnterpriseBundleRepresentative(configInput: BuilderEthernetConfig, bundleId: string): string | null {
  const config = validateBuilderEnterpriseConfig(configInput); return activeBundleMember(config, bundleId)?.id ?? null;
}

export function builderEnterprisePhysicalPairKey(link: BuilderEthernetLink): string {
  return linkPair(link);
}
