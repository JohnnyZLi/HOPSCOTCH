from pathlib import Path

lifecycle = r'''import type { BuilderAddressing } from './addressing.ts';
import type { BuilderGraph } from './model.ts';
import {
  cloneBuilderIpv6Config,
  normalizeBuilderIpv6,
  parseBuilderIpv6Cidr,
  validateBuilderIpv6Config,
  type BuilderIpv6Config,
} from './ipv6.ts';
import type { BuilderIpv6ControlState, BuilderIpv6RaEvent } from './ipv6-control-plane.ts';

export type BuilderIpv6NudState = 'REACHABLE' | 'STALE' | 'DELAY' | 'PROBE' | 'FAILED';
export type BuilderIpv6DadStatus = 'PREFERRED' | 'DUPLICATE';
export type BuilderIpv6PrefixStatus = 'PREFERRED' | 'DEPRECATED' | 'EXPIRED';
export type BuilderDhcpv6LeaseStatus = 'BOUND' | 'RENEW' | 'REBIND' | 'EXPIRED';

export interface BuilderIpv6NudEntry {
  id: string;
  nodeId: string;
  targetNodeId: string;
  linkId: string;
  address: string;
  mac: string;
  state: BuilderIpv6NudState;
  lastConfirmedAt: number;
  stateSince: number;
  probesSent: number;
  detail: string;
}

export interface BuilderIpv6DadEvent {
  id: string;
  sequence: number;
  nodeId: string;
  linkId: string;
  candidateAddress: string;
  status: BuilderIpv6DadStatus;
  duplicateNodeId: string | null;
  detail: string;
}

export interface BuilderIpv6PrefixLifetime {
  id: string;
  endpointId: string;
  routerId: string;
  linkId: string;
  prefix: string;
  address: string;
  preferredUntil: number;
  validUntil: number;
  routerUntil: number;
  status: BuilderIpv6PrefixStatus;
  source: 'RA' | 'RENUMBER';
}

export interface BuilderDhcpv6Server {
  id: string;
  routerId: string;
  linkId: string;
  prefix: string;
  enabled: boolean;
  preference: number;
}

export interface BuilderDhcpv6Lease {
  id: string;
  endpointId: string;
  routerId: string;
  linkId: string;
  address: string;
  prefix: string;
  obtainedAt: number;
  t1At: number;
  t2At: number;
  validUntil: number;
  status: BuilderDhcpv6LeaseStatus;
}

export interface BuilderDhcpv6Event {
  id: string;
  sequence: number;
  endpointId: string;
  routerId: string | null;
  linkId: string | null;
  success: boolean;
  stages: Array<'SOLICIT' | 'ADVERTISE' | 'REQUEST' | 'REPLY'>;
  address: string | null;
  detail: string;
}

export interface BuilderIpv6RenumberEvent {
  id: string;
  sequence: number;
  linkId: string;
  oldPrefix: string;
  newPrefix: string;
  deprecatedUntil: number;
  detail: string;
}

export interface BuilderIpv6LifecycleState {
  clockSeconds: number;
  sequence: number;
  nud: BuilderIpv6NudEntry[];
  dadHistory: BuilderIpv6DadEvent[];
  prefixLifetimes: BuilderIpv6PrefixLifetime[];
  dhcpServers: BuilderDhcpv6Server[];
  dhcpLeases: BuilderDhcpv6Lease[];
  dhcpHistory: BuilderDhcpv6Event[];
  renumberHistory: BuilderIpv6RenumberEvent[];
}

export function createBuilderIpv6LifecycleState(): BuilderIpv6LifecycleState {
  return { clockSeconds: 0, sequence: 0, nud: [], dadHistory: [], prefixLifetimes: [], dhcpServers: [], dhcpLeases: [], dhcpHistory: [], renumberHistory: [] };
}

function cloneState(value: BuilderIpv6LifecycleState): BuilderIpv6LifecycleState {
  return {
    clockSeconds: value.clockSeconds,
    sequence: value.sequence,
    nud: value.nud.map((entry) => ({ ...entry })),
    dadHistory: value.dadHistory.map((entry) => ({ ...entry })),
    prefixLifetimes: value.prefixLifetimes.map((entry) => ({ ...entry })),
    dhcpServers: value.dhcpServers.map((entry) => ({ ...entry })),
    dhcpLeases: value.dhcpLeases.map((entry) => ({ ...entry })),
    dhcpHistory: value.dhcpHistory.map((entry) => ({ ...entry, stages: [...entry.stages] })),
    renumberHistory: value.renumberHistory.map((entry) => ({ ...entry })),
  };
}

function labelFor(graph: BuilderGraph, nodeId: string): string {
  return graph.nodes.find((node) => node.id === nodeId)?.label ?? nodeId.toUpperCase();
}

function formatIpv6Value(value: bigint): string {
  const groups: number[] = [];
  for (let index = 0; index < 8; index += 1) groups.push(Number((value >> BigInt((7 - index) * 16)) & 0xffffn));
  let bestStart = -1;
  let bestLength = 0;
  for (let index = 0; index < groups.length;) {
    if (groups[index] !== 0) { index += 1; continue; }
    let end = index;
    while (end < groups.length && groups[end] === 0) end += 1;
    if (end - index >= 2 && end - index > bestLength) { bestStart = index; bestLength = end - index; }
    index = end;
  }
  if (bestStart < 0) return groups.map((group) => group.toString(16)).join(':');
  const before = groups.slice(0, bestStart).map((group) => group.toString(16)).join(':');
  const after = groups.slice(bestStart + bestLength).map((group) => group.toString(16)).join(':');
  return `${before}::${after}`;
}

function low64(address: string): bigint {
  return parseBuilderIpv6Cidr(`${normalizeBuilderIpv6(address)}/128`).addressValue & 0xffffffffffffffffn;
}

function addressInPrefix(prefix: string, iid: bigint): string {
  return formatIpv6Value(parseBuilderIpv6Cidr(prefix).network | (iid & 0xffffffffffffffffn));
}

function stableIid(seed: string): bigint {
  let hash = 0xcbf29ce484222325n;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= BigInt(seed.charCodeAt(index));
    hash = (hash * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return (hash & 0x00ffffffffffffffn) | 0xd600000000000000n;
}

function nextSequence(state: BuilderIpv6LifecycleState): number {
  return state.sequence + 1;
}

export function reconcileBuilderIpv6LifecycleWithControl(control: BuilderIpv6ControlState, current: BuilderIpv6LifecycleState): BuilderIpv6LifecycleState {
  const next = cloneState(current);
  next.nud = control.neighborCache.map((cache) => {
    const prior = current.nud.find((entry) => entry.id === cache.id);
    if (prior) return { ...prior, nodeId: cache.nodeId, targetNodeId: cache.targetNodeId, linkId: cache.linkId, address: cache.address, mac: cache.mac };
    return {
      id: cache.id,
      nodeId: cache.nodeId,
      targetNodeId: cache.targetNodeId,
      linkId: cache.linkId,
      address: cache.address,
      mac: cache.mac,
      state: 'REACHABLE',
      lastConfirmedAt: next.clockSeconds,
      stateSince: next.clockSeconds,
      probesSent: 0,
      detail: `${cache.address} confirmed reachable from ${cache.source}.`,
    };
  });
  return next;
}

export function advanceBuilderIpv6Lifecycle(current: BuilderIpv6LifecycleState, seconds: number): BuilderIpv6LifecycleState {
  const delta = Math.max(0, Math.min(86_400, Math.round(seconds)));
  const next = cloneState(current);
  next.clockSeconds += delta;
  next.sequence += 1;
  next.nud = next.nud.map((entry) => {
    if (entry.state === 'REACHABLE' && next.clockSeconds - entry.lastConfirmedAt >= 30) return { ...entry, state: 'STALE', stateSince: next.clockSeconds, detail: 'Reachable timer expired; the cached mapping is STALE until traffic needs it.' };
    if (entry.state === 'DELAY' && next.clockSeconds - entry.stateSince >= 5) return { ...entry, state: 'PROBE', stateSince: next.clockSeconds, detail: 'DELAY timer expired; unicast Neighbor Solicitation probes are now required.' };
    if (entry.state === 'PROBE' && next.clockSeconds - entry.stateSince >= 3) return { ...entry, state: 'FAILED', stateSince: next.clockSeconds, detail: 'NUD probes received no confirmation before the teaching timeout.' };
    return entry;
  });
  next.prefixLifetimes = next.prefixLifetimes.map((entry) => ({
    ...entry,
    status: next.clockSeconds >= entry.validUntil ? 'EXPIRED' : next.clockSeconds >= entry.preferredUntil ? 'DEPRECATED' : 'PREFERRED',
  }));
  next.dhcpLeases = next.dhcpLeases.map((entry) => ({
    ...entry,
    status: next.clockSeconds >= entry.validUntil ? 'EXPIRED' : next.clockSeconds >= entry.t2At ? 'REBIND' : next.clockSeconds >= entry.t1At ? 'RENEW' : 'BOUND',
  }));
  return next;
}

export function runBuilderIpv6Dad(graph: BuilderGraph, config: BuilderIpv6Config, nodeId: string, linkId: string, current: BuilderIpv6LifecycleState, candidateOverride?: string): { state: BuilderIpv6LifecycleState; event: BuilderIpv6DadEvent } {
  const next = cloneState(current);
  const sequence = nextSequence(next);
  next.sequence = sequence;
  const segment = config.addressing.segments[linkId];
  const local = segment?.interfaces.find((entry) => entry.nodeId === nodeId);
  if (!segment || !local) throw new Error(`${nodeId} has no IPv6 interface on ${linkId}.`);
  const candidateAddress = normalizeBuilderIpv6(candidateOverride ?? local.globalAddress);
  const duplicate = segment.interfaces.find((entry) => entry.nodeId !== nodeId && (entry.globalAddress === candidateAddress || entry.linkLocalAddress === candidateAddress)) ?? null;
  const event: BuilderIpv6DadEvent = {
    id: `dad6:${sequence}:${nodeId}:${linkId}`,
    sequence,
    nodeId,
    linkId,
    candidateAddress,
    status: duplicate ? 'DUPLICATE' : 'PREFERRED',
    duplicateNodeId: duplicate?.nodeId ?? null,
    detail: duplicate
      ? `${labelFor(graph, nodeId)} sent DAD Neighbor Solicitation from :: for ${candidateAddress}; ${labelFor(graph, duplicate.nodeId)} already owns that address, so it remains unusable.`
      : `${labelFor(graph, nodeId)} sent DAD Neighbor Solicitation from :: for ${candidateAddress}; no Neighbor Advertisement or conflicting NS answered, so the address becomes preferred.`,
  };
  next.dadHistory = [...next.dadHistory, event].slice(-48);
  return { state: next, event };
}

export function useBuilderIpv6Neighbor(graph: BuilderGraph, control: BuilderIpv6ControlState, current: BuilderIpv6LifecycleState, cacheId: string): BuilderIpv6LifecycleState {
  let next = reconcileBuilderIpv6LifecycleWithControl(control, current);
  const index = next.nud.findIndex((entry) => entry.id === cacheId);
  if (index < 0) return next;
  const entry = next.nud[index];
  const link = graph.links.find((candidate) => candidate.id === entry.linkId);
  let updated: BuilderIpv6NudEntry;
  if (!link || link.failed) {
    updated = { ...entry, state: 'FAILED', stateSince: next.clockSeconds, probesSent: entry.probesSent + 1, detail: `NUD cannot confirm ${entry.address}: ${entry.linkId.toUpperCase()} is down.` };
  } else if (entry.state === 'STALE') {
    updated = { ...entry, state: 'DELAY', stateSince: next.clockSeconds, detail: 'Traffic reused a STALE mapping; NUD entered DELAY before probing the neighbor.' };
  } else if (entry.state === 'DELAY') {
    updated = { ...entry, detail: 'NUD remains in DELAY until the 5-second teaching timer expires.' };
  } else if (entry.state === 'PROBE' || entry.state === 'FAILED') {
    updated = { ...entry, state: 'REACHABLE', lastConfirmedAt: next.clockSeconds, stateSince: next.clockSeconds, probesSent: entry.probesSent + 1, detail: `Unicast Neighbor Solicitation to ${entry.address} received Neighbor Advertisement; reachability is confirmed.` };
  } else {
    updated = { ...entry, detail: `${entry.address} is already REACHABLE; cached L2 reachability remains usable.` };
  }
  next.nud[index] = updated;
  next.sequence += 1;
  return next;
}

export function recordBuilderIpv6RaLifetime(current: BuilderIpv6LifecycleState, event: BuilderIpv6RaEvent): BuilderIpv6LifecycleState {
  if (!event.success || !event.routerId || !event.linkId || !event.prefix || !event.slaacAddress) return current;
  const next = cloneState(current);
  next.sequence += 1;
  const entry: BuilderIpv6PrefixLifetime = {
    id: `${event.endpointId}|${event.linkId}|${event.prefix}`,
    endpointId: event.endpointId,
    routerId: event.routerId,
    linkId: event.linkId,
    prefix: event.prefix,
    address: event.slaacAddress,
    preferredUntil: next.clockSeconds + event.preferredLifetimeSeconds,
    validUntil: next.clockSeconds + event.validLifetimeSeconds,
    routerUntil: next.clockSeconds + event.routerLifetimeSeconds,
    status: 'PREFERRED',
    source: 'RA',
  };
  next.prefixLifetimes = [...next.prefixLifetimes.filter((item) => item.id !== entry.id), entry].slice(-48);
  return next;
}

function nextDocumentationPrefix(config: BuilderIpv6Config): string {
  const used = new Set(Object.values(config.addressing.segments).flatMap((segment) => {
    try {
      const parsed = parseBuilderIpv6Cidr(segment.prefix);
      if (!segment.prefix.startsWith('2001:db8:')) return [];
      return [Number((parsed.network >> 64n) & 0xffffn)];
    } catch { return []; }
  }));
  for (let index = 1; index <= 0xffff; index += 1) if (!used.has(index)) return `2001:db8:${index.toString(16)}::/64`;
  throw new Error('No free documentation /64 remains for deterministic renumbering.');
}

export function renumberBuilderIpv6Link(graph: BuilderGraph, ipv4: BuilderAddressing, config: BuilderIpv6Config, current: BuilderIpv6LifecycleState, linkId: string): { config: BuilderIpv6Config; state: BuilderIpv6LifecycleState; event: BuilderIpv6RenumberEvent } {
  const segment = config.addressing.segments[linkId];
  if (!segment) throw new Error(`Unknown IPv6 segment ${linkId}.`);
  const nextConfig = cloneBuilderIpv6Config(config);
  const oldPrefix = segment.prefix;
  const newPrefix = nextDocumentationPrefix(config);
  const nextSegment = nextConfig.addressing.segments[linkId];
  nextSegment.prefix = newPrefix;
  nextSegment.interfaces = nextSegment.interfaces.map((entry) => ({ ...entry, globalAddress: addressInPrefix(newPrefix, low64(entry.globalAddress)) })) as typeof nextSegment.interfaces;
  const validated = validateBuilderIpv6Config(graph, ipv4, nextConfig);
  const next = cloneState(current);
  const sequence = nextSequence(next);
  next.sequence = sequence;
  for (const entry of segment.interfaces) {
    if (graph.nodes.find((node) => node.id === entry.nodeId)?.kind !== 'endpoint') continue;
    const routerId = segment.interfaces.find((candidate) => graph.nodes.find((node) => node.id === candidate.nodeId)?.kind === 'router')?.nodeId ?? '';
    const oldLifetime: BuilderIpv6PrefixLifetime = {
      id: `${entry.nodeId}|${linkId}|${oldPrefix}`,
      endpointId: entry.nodeId,
      routerId,
      linkId,
      prefix: oldPrefix,
      address: entry.globalAddress,
      preferredUntil: next.clockSeconds,
      validUntil: next.clockSeconds + 600,
      routerUntil: next.clockSeconds + 600,
      status: 'DEPRECATED',
      source: 'RENUMBER',
    };
    const newAddress = validated.addressing.segments[linkId].interfaces.find((candidate) => candidate.nodeId === entry.nodeId)?.globalAddress ?? entry.globalAddress;
    const newLifetime: BuilderIpv6PrefixLifetime = {
      id: `${entry.nodeId}|${linkId}|${newPrefix}`,
      endpointId: entry.nodeId,
      routerId,
      linkId,
      prefix: newPrefix,
      address: newAddress,
      preferredUntil: next.clockSeconds + 1800,
      validUntil: next.clockSeconds + 3600,
      routerUntil: next.clockSeconds + 1800,
      status: 'PREFERRED',
      source: 'RENUMBER',
    };
    next.prefixLifetimes = [...next.prefixLifetimes.filter((item) => item.id !== oldLifetime.id && item.id !== newLifetime.id), oldLifetime, newLifetime].slice(-48);
  }
  const event: BuilderIpv6RenumberEvent = {
    id: `renumber6:${sequence}:${linkId}`,
    sequence,
    linkId,
    oldPrefix,
    newPrefix,
    deprecatedUntil: next.clockSeconds + 600,
    detail: `${linkId.toUpperCase()} advertised ${newPrefix}; ${oldPrefix} became deprecated immediately but remains valid for 600 teaching seconds.`,
  };
  next.renumberHistory = [...next.renumberHistory, event].slice(-24);
  return { config: validated, state: next, event };
}

export function setBuilderDhcpv6Server(graph: BuilderGraph, config: BuilderIpv6Config, current: BuilderIpv6LifecycleState, routerId: string, linkId: string, enabled: boolean): BuilderIpv6LifecycleState {
  if (graph.nodes.find((node) => node.id === routerId)?.kind !== 'router') throw new Error(`${routerId} is not a router.`);
  const link = graph.links.find((candidate) => candidate.id === linkId);
  if (!link || ![link.a, link.b].includes(routerId)) throw new Error(`${linkId} is not attached to ${routerId}.`);
  const prefix = config.addressing.segments[linkId]?.prefix;
  if (!prefix) throw new Error(`${linkId} has no IPv6 /64.`);
  const next = cloneState(current);
  const id = `${routerId}|${linkId}`;
  if (enabled) next.dhcpServers = [...next.dhcpServers.filter((entry) => entry.id !== id), { id, routerId, linkId, prefix, enabled: true, preference: 100 }].sort((a, b) => a.id.localeCompare(b.id));
  else next.dhcpServers = next.dhcpServers.filter((entry) => entry.id !== id);
  next.sequence += 1;
  return next;
}

export function runBuilderDhcpv6Client(graph: BuilderGraph, config: BuilderIpv6Config, current: BuilderIpv6LifecycleState, endpointId: string): { state: BuilderIpv6LifecycleState; event: BuilderDhcpv6Event } {
  const next = cloneState(current);
  const sequence = nextSequence(next);
  next.sequence = sequence;
  const endpoint = graph.nodes.find((node) => node.id === endpointId);
  const candidate = endpoint?.kind === 'endpoint' ? graph.links.filter((link) => !link.failed && [link.a, link.b].includes(endpointId)).sort((a, b) => a.id.localeCompare(b.id)).flatMap((link) => {
    const routerId = link.a === endpointId ? link.b : link.a;
    const server = next.dhcpServers.find((entry) => entry.enabled && entry.routerId === routerId && entry.linkId === link.id);
    return server ? [{ link, server }] : [];
  })[0] : undefined;
  if (!config.enabled || !candidate) {
    const event: BuilderDhcpv6Event = { id: `dhcp6:${sequence}:${endpointId}`, sequence, endpointId, routerId: null, linkId: null, success: false, stages: ['SOLICIT'], address: null, detail: !config.enabled ? 'IPv6 is disabled; DHCPv6 cannot run.' : 'SOLICIT found no live directly connected DHCPv6 server.' };
    next.dhcpHistory = [...next.dhcpHistory, event].slice(-32);
    return { state: next, event };
  }
  const prefix = config.addressing.segments[candidate.link.id]?.prefix ?? candidate.server.prefix;
  const address = addressInPrefix(prefix, stableIid(`${endpointId}:${candidate.link.id}:dhcpv6`));
  const lease: BuilderDhcpv6Lease = {
    id: `${endpointId}|${candidate.link.id}`,
    endpointId,
    routerId: candidate.server.routerId,
    linkId: candidate.link.id,
    address,
    prefix,
    obtainedAt: next.clockSeconds,
    t1At: next.clockSeconds + 1800,
    t2At: next.clockSeconds + 3150,
    validUntil: next.clockSeconds + 3600,
    status: 'BOUND',
  };
  next.dhcpLeases = [...next.dhcpLeases.filter((entry) => entry.id !== lease.id), lease].slice(-48);
  const event: BuilderDhcpv6Event = {
    id: `dhcp6:${sequence}:${endpointId}:${candidate.server.routerId}`,
    sequence,
    endpointId,
    routerId: candidate.server.routerId,
    linkId: candidate.link.id,
    success: true,
    stages: ['SOLICIT', 'ADVERTISE', 'REQUEST', 'REPLY'],
    address,
    detail: `${labelFor(graph, endpointId)} completed SOLICIT → ADVERTISE → REQUEST → REPLY and leased ${address}. DHCPv6 did not install a default router; Router Advertisement remains authoritative for that.`,
  };
  next.dhcpHistory = [...next.dhcpHistory, event].slice(-32);
  return { state: next, event };
}

export function materializeBuilderIpv6RuntimeConfig(config: BuilderIpv6Config, lifecycle: BuilderIpv6LifecycleState): BuilderIpv6Config {
  const next = cloneBuilderIpv6Config(config);
  const activeLeases = lifecycle.dhcpLeases.filter((entry) => entry.status !== 'EXPIRED');
  for (const lease of activeLeases) {
    const segment = next.addressing.segments[lease.linkId];
    const iface = segment?.interfaces.find((entry) => entry.nodeId === lease.endpointId);
    if (iface) { iface.globalAddress = lease.address; iface.addressOrigin = 'dhcpv6'; }
  }
  const endpoints = new Set(lifecycle.prefixLifetimes.map((entry) => entry.endpointId));
  for (const endpointId of endpoints) {
    const lifetimes = lifecycle.prefixLifetimes.filter((entry) => entry.endpointId === endpointId).sort((a, b) => b.validUntil - a.validUntil);
    const current = lifetimes[0];
    if (current && (current.status === 'EXPIRED' || lifecycle.clockSeconds >= current.routerUntil)) next.addressing.defaultGateways[endpointId] = null;
  }
  return next;
}
'''

panel = r'''import { useMemo } from 'react';
import type { BuilderAddressing } from './builder/addressing.ts';
import type { BuilderIpv6ControlState } from './builder/ipv6-control-plane.ts';
import type { BuilderIpv6Config } from './builder/ipv6.ts';
import type { BuilderGraph } from './builder/model.ts';
import {
  advanceBuilderIpv6Lifecycle,
  reconcileBuilderIpv6LifecycleWithControl,
  renumberBuilderIpv6Link,
  runBuilderDhcpv6Client,
  runBuilderIpv6Dad,
  setBuilderDhcpv6Server,
  useBuilderIpv6Neighbor,
  type BuilderIpv6LifecycleState,
} from './builder/ipv6-lifecycle.ts';

function labelFor(graph: BuilderGraph, id: string): string { return graph.nodes.find((node) => node.id === id)?.label ?? id.toUpperCase(); }

export function BuilderIpv6LifecyclePanel({ graph, ipv4, ipv6, selectedNodeId, selectedLinkId, controlState, lifecycleState, onLifecycleStateChange, onIpv6Change, onMessage }: {
  graph: BuilderGraph;
  ipv4: BuilderAddressing;
  ipv6: BuilderIpv6Config;
  selectedNodeId: string;
  selectedLinkId: string;
  controlState: BuilderIpv6ControlState;
  lifecycleState: BuilderIpv6LifecycleState;
  onLifecycleStateChange: (next: BuilderIpv6LifecycleState) => void;
  onIpv6Change: (next: BuilderIpv6Config) => void;
  onMessage: (message: string) => void;
}) {
  const state = useMemo(() => reconcileBuilderIpv6LifecycleWithControl(controlState, lifecycleState), [controlState, lifecycleState]);
  const node = graph.nodes.find((entry) => entry.id === selectedNodeId) ?? null;
  const link = graph.links.find((entry) => entry.id === selectedLinkId) ?? null;
  const segment = link ? ipv6.addressing.segments[link.id] : null;
  const localInterface = segment?.interfaces.find((entry) => entry.nodeId === selectedNodeId) ?? null;
  const selectedNud = state.nud.find((entry) => entry.nodeId === selectedNodeId) ?? null;
  const selectedServer = node?.kind === 'router' && link ? state.dhcpServers.find((entry) => entry.routerId === node.id && entry.linkId === link.id) ?? null : null;
  const selectedLease = state.dhcpLeases.find((entry) => entry.endpointId === selectedNodeId) ?? null;
  const selectedPrefix = state.prefixLifetimes.filter((entry) => entry.endpointId === selectedNodeId).sort((a, b) => b.validUntil - a.validUntil)[0] ?? null;
  const lastDad = state.dadHistory.at(-1) ?? null;
  const lastDhcp = state.dhcpHistory.at(-1) ?? null;
  const lastRenumber = state.renumberHistory.at(-1) ?? null;
  const selectedLinkAttached = Boolean(node && link && [link.a, link.b].includes(node.id));

  const advance = (seconds: number) => {
    const next = advanceBuilderIpv6Lifecycle(state, seconds);
    onLifecycleStateChange(next);
    onMessage(`IPV6 CLOCK +${seconds}s · NUD, RA prefix lifetimes, router lifetime, and DHCPv6 lease timers advanced deterministically.`);
  };

  const dad = (duplicate: boolean) => {
    if (!node || !link || !localInterface) { onMessage('Select a device and one of its IPv6 links before running DAD.'); return; }
    const duplicateAddress = duplicate ? segment?.interfaces.find((entry) => entry.nodeId !== node.id)?.globalAddress : undefined;
    const result = runBuilderIpv6Dad(graph, ipv6, node.id, link.id, state, duplicateAddress);
    onLifecycleStateChange(result.state);
    onMessage(`DAD · ${result.event.detail}`);
  };

  const nud = () => {
    if (!selectedNud) { onMessage('No cached IPv6 neighbor is available on the selected device. Run an IPv6 probe first.'); return; }
    const next = useBuilderIpv6Neighbor(graph, controlState, state, selectedNud.id);
    onLifecycleStateChange(next);
    const updated = next.nud.find((entry) => entry.id === selectedNud.id);
    onMessage(`NUD ${updated?.state ?? 'UNKNOWN'} · ${updated?.detail ?? 'No neighbor state.'}`);
  };

  const toggleDhcp = () => {
    if (!node || node.kind !== 'router' || !link || !selectedLinkAttached) { onMessage('Select a router and one of its attached links before configuring DHCPv6.'); return; }
    const next = setBuilderDhcpv6Server(graph, ipv6, state, node.id, link.id, !selectedServer);
    onLifecycleStateChange(next);
    onMessage(`DHCPV6 SERVER · ${node.label} ${selectedServer ? 'stopped' : 'started'} stateful service on ${link.id.toUpperCase()}.`);
  };

  const runDhcp = () => {
    if (!node || node.kind !== 'endpoint') { onMessage('Select an endpoint before running DHCPv6.'); return; }
    const result = runBuilderDhcpv6Client(graph, ipv6, state, node.id);
    onLifecycleStateChange(result.state);
    onMessage(`DHCPV6 · ${result.event.detail}`);
  };

  const renumber = () => {
    if (!link) { onMessage('Select a routed link before renumbering IPv6.'); return; }
    try {
      const result = renumberBuilderIpv6Link(graph, ipv4, ipv6, state, link.id);
      onIpv6Change(result.config);
      onLifecycleStateChange(result.state);
      onMessage(`IPV6 RENUMBER · ${result.event.detail}`);
    } catch (error) { onMessage(`IPV6 RENUMBER REJECTED · ${error instanceof Error ? error.message : 'Unable to renumber link.'}`); }
  };

  return <section className="builder-ipv6-lifecycle-section">
    <div className="control-title"><span>IPV6 LIFECYCLE</span><strong>T+{state.clockSeconds}s · DAD / NUD / RA / DHCPV6</strong></div>
    <div className="button-row"><button type="button" onClick={() => advance(5)}>+5S</button><button type="button" onClick={() => advance(30)}>+30S</button><button type="button" onClick={() => advance(600)}>+10 MIN</button></div>
    {node && link && localInterface && selectedLinkAttached && <><div className="button-row"><button type="button" onClick={() => dad(false)}>RUN DAD</button><button type="button" onClick={() => dad(true)}>TEST DUPLICATE</button>{node.kind === 'router' && <button type="button" onClick={renumber}>RENUMBER /64</button>}</div><small className="builder-routing-note">DAD sends a tentative-address NS from :: before use. The duplicate test intentionally targets the neighbor's address without corrupting canonical addressing.</small></>}
    {selectedNud && <><div className="builder-ospf-facts"><div><span>NUD STATE</span><strong>{selectedNud.state}</strong></div><div><span>NEIGHBOR</span><strong>{selectedNud.address}</strong></div></div><button type="button" onClick={nud}>USE / PROBE NEIGHBOR</button><small className="builder-routing-note">{selectedNud.detail}</small></>}
    {node?.kind === 'router' && link && selectedLinkAttached && <div className="button-row"><button type="button" onClick={toggleDhcp}>{selectedServer ? 'DISABLE DHCPV6' : 'ENABLE DHCPV6'}</button></div>}
    {node?.kind === 'endpoint' && <div className="button-row"><button type="button" onClick={runDhcp}>RUN DHCPV6</button></div>}
    <div className="builder-ospf-facts"><div><span>PREFIX LIFETIME</span><strong>{selectedPrefix ? `${selectedPrefix.status} · ${selectedPrefix.prefix}` : 'NO RA LEASE'}</strong></div><div><span>DHCPV6 LEASE</span><strong>{selectedLease ? `${selectedLease.status} · ${selectedLease.address}` : 'NONE'}</strong></div></div>
    {selectedPrefix && <small className="builder-routing-note">PREFERRED UNTIL T+{selectedPrefix.preferredUntil}s · VALID UNTIL T+{selectedPrefix.validUntil}s · ROUTER UNTIL T+{selectedPrefix.routerUntil}s.</small>}
    {selectedLease && <small className="builder-routing-note">T1 T+{selectedLease.t1At}s · T2 T+{selectedLease.t2At}s · VALID T+{selectedLease.validUntil}s. DHCPv6 provides the address; RA still provides the default router.</small>}
    {lastDad && <small className="builder-routing-note">LAST DAD · {labelFor(graph,lastDad.nodeId)} · {lastDad.status} · {lastDad.candidateAddress}</small>}
    {lastDhcp && <small className="builder-routing-note">LAST DHCPV6 · {lastDhcp.success ? lastDhcp.stages.join(' → ') : 'SOLICIT ONLY'} · {lastDhcp.address ?? 'NO LEASE'}</small>}
    {lastRenumber && <small className="builder-routing-note">LAST RENUMBER · {lastRenumber.oldPrefix} → {lastRenumber.newPrefix} · old prefix valid until T+{lastRenumber.deprecatedUntil}s.</small>}
  </section>;
}
'''

contract = r'''import assert from 'node:assert/strict';
import { createDefaultBuilderAddressing } from '../src/builder/addressing.ts';
import { cloneBuilderGraph, defaultBuilderGraph } from '../src/builder/model.ts';
import { createDefaultBuilderIpv6Config, replaceBuilderIpv6DefaultGateway, setBuilderOspfv3Everywhere, traceBuilderIpv6Forwarding } from '../src/builder/ipv6.ts';
import { createBuilderIpv6ControlState, resolveBuilderIpv6TraceNeighbors, runBuilderIpv6RouterSolicitation } from '../src/builder/ipv6-control-plane.ts';
import {
  advanceBuilderIpv6Lifecycle,
  createBuilderIpv6LifecycleState,
  materializeBuilderIpv6RuntimeConfig,
  reconcileBuilderIpv6LifecycleWithControl,
  recordBuilderIpv6RaLifetime,
  renumberBuilderIpv6Link,
  runBuilderDhcpv6Client,
  runBuilderIpv6Dad,
  setBuilderDhcpv6Server,
  useBuilderIpv6Neighbor,
} from '../src/builder/ipv6-lifecycle.ts';

const graph = cloneBuilderGraph(defaultBuilderGraph);
const ipv4 = createDefaultBuilderAddressing(graph);
let ipv6 = setBuilderOspfv3Everywhere(graph, ipv4, createDefaultBuilderIpv6Config(graph, ipv4), true);
const endpoint = graph.nodes.find((node) => node.kind === 'endpoint');
assert.ok(endpoint);
const accessLink = graph.links.find((link) => [link.a, link.b].includes(endpoint.id) && graph.nodes.find((node) => node.id === (link.a === endpoint.id ? link.b : link.a))?.kind === 'router');
assert.ok(accessLink);
const routerId = accessLink.a === endpoint.id ? accessLink.b : accessLink.a;
const endpointInterface = ipv6.addressing.segments[accessLink.id].interfaces.find((entry) => entry.nodeId === endpoint.id);
const routerInterface = ipv6.addressing.segments[accessLink.id].interfaces.find((entry) => entry.nodeId === routerId);
assert.ok(endpointInterface && routerInterface);

let lifecycle = createBuilderIpv6LifecycleState();
let dad = runBuilderIpv6Dad(graph, ipv6, endpoint.id, accessLink.id, lifecycle);
assert.equal(dad.event.status, 'PREFERRED');
lifecycle = dad.state;
dad = runBuilderIpv6Dad(graph, ipv6, endpoint.id, accessLink.id, lifecycle, routerInterface.globalAddress);
assert.equal(dad.event.status, 'DUPLICATE');
assert.equal(dad.event.duplicateNodeId, routerId);
lifecycle = dad.state;

const remoteEndpoint = graph.nodes.filter((node) => node.kind === 'endpoint').find((node) => node.id !== endpoint.id);
assert.ok(remoteEndpoint);
const trace = traceBuilderIpv6Forwarding(graph, ipv6, endpoint.id, remoteEndpoint.id);
assert.equal(trace.reachable, true);
let control = createBuilderIpv6ControlState();
control = resolveBuilderIpv6TraceNeighbors(graph, ipv6, trace, control, 1).state;
lifecycle = reconcileBuilderIpv6LifecycleWithControl(control, lifecycle);
assert.ok(lifecycle.nud.length > 0);
lifecycle = advanceBuilderIpv6Lifecycle(lifecycle, 30);
assert.equal(lifecycle.nud[0].state, 'STALE');
lifecycle = useBuilderIpv6Neighbor(graph, control, lifecycle, lifecycle.nud[0].id);
assert.equal(lifecycle.nud[0].state, 'DELAY');
lifecycle = advanceBuilderIpv6Lifecycle(lifecycle, 5);
assert.equal(lifecycle.nud[0].state, 'PROBE');
lifecycle = useBuilderIpv6Neighbor(graph, control, lifecycle, lifecycle.nud[0].id);
assert.equal(lifecycle.nud[0].state, 'REACHABLE');

const clearedGateway = replaceBuilderIpv6DefaultGateway(graph, ipv4, ipv6, endpoint.id, null);
lifecycle = setBuilderDhcpv6Server(graph, clearedGateway, lifecycle, routerId, accessLink.id, true);
const dhcp = runBuilderDhcpv6Client(graph, clearedGateway, lifecycle, endpoint.id);
assert.equal(dhcp.event.success, true);
assert.deepEqual(dhcp.event.stages, ['SOLICIT','ADVERTISE','REQUEST','REPLY']);
lifecycle = dhcp.state;
let runtime = materializeBuilderIpv6RuntimeConfig(clearedGateway, lifecycle);
assert.equal(runtime.addressing.defaultGateways[endpoint.id], null, 'DHCPv6 must not invent a default router');
assert.equal(runtime.addressing.segments[accessLink.id].interfaces.find((entry) => entry.nodeId === endpoint.id)?.addressOrigin, 'dhcpv6');
assert.equal(runtime.addressing.segments[accessLink.id].interfaces.find((entry) => entry.nodeId === endpoint.id)?.globalAddress, dhcp.event.address);

const ra = runBuilderIpv6RouterSolicitation(graph, ipv4, clearedGateway, endpoint.id, control);
assert.equal(ra.event.success, true);
lifecycle = recordBuilderIpv6RaLifetime(lifecycle, ra.event);
assert.equal(lifecycle.prefixLifetimes.at(-1)?.status, 'PREFERRED');
lifecycle = advanceBuilderIpv6Lifecycle(lifecycle, 1800);
assert.equal(lifecycle.prefixLifetimes.at(-1)?.status, 'DEPRECATED');
lifecycle = advanceBuilderIpv6Lifecycle(lifecycle, 1800);
assert.equal(lifecycle.prefixLifetimes.at(-1)?.status, 'EXPIRED');
runtime = materializeBuilderIpv6RuntimeConfig(ra.config, lifecycle);
assert.equal(runtime.addressing.defaultGateways[endpoint.id], null, 'expired RA router lifetime must remove runtime default-router usability');

const before = ipv6.addressing.segments[accessLink.id].prefix;
const renumbered = renumberBuilderIpv6Link(graph, ipv4, ipv6, lifecycle, accessLink.id);
assert.notEqual(renumbered.config.addressing.segments[accessLink.id].prefix, before);
assert.ok(renumbered.state.prefixLifetimes.some((entry) => entry.prefix === before && entry.status === 'DEPRECATED'));
assert.ok(renumbered.state.prefixLifetimes.some((entry) => entry.prefix === renumbered.config.addressing.segments[accessLink.id].prefix && entry.status === 'PREFERRED'));

console.log('Builder IPv6 lifecycle contract passed: DAD conflict detection, NUD aging/probing, RA deprecation/expiry, deterministic renumbering, and DHCPv6 lease semantics.');
'''

Path('src/builder/ipv6-lifecycle.ts').write_text(lifecycle, encoding='utf-8')
Path('src/BuilderIpv6LifecyclePanel.tsx').write_text(panel, encoding='utf-8')
Path('scripts/builder-ipv6-lifecycle-contract-check.mjs').write_text(contract, encoding='utf-8')
print('Wrote IPv6 lifecycle model, UI, and contract.')
