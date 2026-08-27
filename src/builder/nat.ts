import { interfacesForBuilderNode, normalizeBuilderIpv4, type BuilderAddressing } from './addressing.ts';
import { evaluateBuilderAclAtRouter, validateBuilderAclConfig, createDefaultBuilderAclConfig, type BuilderAclConfig, type BuilderAclDecision } from './acl.ts';
import { traceBuilderForwarding, type BuilderForwardingTrace, type BuilderRoutingConfig } from './routing.ts';
import type { BuilderGraph } from './model.ts';

export type BuilderNatProtocol = 'tcp' | 'udp' | 'icmp';
export type BuilderNatTranslationKind = 'pat' | 'static-port' | 'static-address';

export interface BuilderNatBoundary {
  id: string;
  routerId: string;
  insideLinkIds: string[];
  outsideLinkIds: string[];
  overloadAddress: string;
  enabled: boolean;
}

export interface BuilderNatStaticAddressMapping {
  id: string;
  routerId: string;
  insideAddress: string;
  outsideAddress: string;
  description: string;
}

export interface BuilderNatStaticMapping {
  id: string;
  routerId: string;
  protocol: 'tcp' | 'udp';
  insideAddress: string;
  insidePort: number;
  outsideAddress: string;
  outsidePort: number;
  description: string;
}

export interface BuilderNatConfig {
  boundaries: BuilderNatBoundary[];
  staticAddresses: BuilderNatStaticAddressMapping[];
  staticMappings: BuilderNatStaticMapping[];
  patPortStart: number;
  patPortEnd: number;
  sessionLifetime: number;
}

export interface BuilderNatTranslation {
  id: string;
  kind: BuilderNatTranslationKind;
  routerId: string;
  protocol: BuilderNatProtocol;
  insideAddress: string;
  insidePort: number | null;
  outsideAddress: string;
  outsidePort: number | null;
  remoteAddress: string;
  remotePort: number | null;
  createdSequence: number;
  lastUsedSequence: number;
  expiresAfterSequence: number | null;
}

export type BuilderNatSessionTable = BuilderNatTranslation[];

export interface BuilderNatTuple {
  sourceAddress: string;
  sourcePort: number | null;
  destinationAddress: string;
  destinationPort: number | null;
  protocol: BuilderNatProtocol;
}

export interface BuilderNatPolicyStage {
  phase: 'pre-nat' | 'post-nat';
  routerId: string;
  tuple: BuilderNatTuple;
  decision: BuilderAclDecision;
  boundary: boolean;
}

export interface BuilderNatFlowResult {
  direction: 'outbound' | 'inbound';
  success: boolean;
  forwarding: BuilderForwardingTrace | null;
  boundaryId: string | null;
  routerId: string | null;
  originalTuple: BuilderNatTuple;
  translatedTuple: BuilderNatTuple | null;
  translation: BuilderNatTranslation | null;
  sessions: BuilderNatSessionTable;
  policyStages: BuilderNatPolicyStage[];
  policyPermitted: boolean;
  deniedAtRouterId: string | null;
  failureReason: string | null;
  explanation: string;
}

function nodeById(graph: BuilderGraph, id: string) { return graph.nodes.find((node) => node.id === id); }
function linkById(graph: BuilderGraph, id: string) { return graph.links.find((link) => link.id === id); }
function primaryAddress(addressing: BuilderAddressing, nodeId: string): string | null { return interfacesForBuilderNode(addressing, nodeId)[0]?.address ?? null; }

function normalizePort(value: number | null, protocol: BuilderNatProtocol, label: string): number | null {
  if (protocol === 'icmp') {
    if (value != null) throw new Error(`${label} must be empty for ICMP in the HOPSCOTCH teaching model.`);
    return null;
  }
  if (!Number.isInteger(value) || value == null || value < 1 || value > 65535) throw new Error(`${label} must be 1–65535 for TCP/UDP.`);
  return value;
}

function uniqueSorted(values: readonly string[]): string[] { return [...new Set(values)].sort(); }

export function createEmptyBuilderNatConfig(): BuilderNatConfig {
  return { boundaries: [], staticAddresses: [], staticMappings: [], patPortStart: 40000, patPortEnd: 49999, sessionLifetime: 32 };
}

export function createDefaultBuilderNatConfig(graph: BuilderGraph = { nodes: [], links: [] }): BuilderNatConfig {
  const empty = createEmptyBuilderNatConfig();
  const edge = graph.nodes.find((node) => node.id === 'edge' && node.kind === 'router');
  const inside = graph.links.filter((link) => (link.a === 'edge' && link.b === 'client') || (link.b === 'edge' && link.a === 'client')).map((link) => link.id);
  const outside = graph.links.filter((link) => (link.a === 'edge' || link.b === 'edge') && !inside.includes(link.id)).map((link) => link.id);
  return {
    ...empty,
    boundaries: edge && inside.length > 0 && outside.length > 0 ? [{ id: 'nat-edge', routerId: 'edge', insideLinkIds: inside.sort(), outsideLinkIds: outside.sort(), overloadAddress: '198.51.100.10', enabled: true }] : [],
  };
}

export function cloneBuilderNatConfig(config: BuilderNatConfig): BuilderNatConfig {
  return {
    boundaries: config.boundaries.map((boundary) => ({ ...boundary, insideLinkIds: [...boundary.insideLinkIds], outsideLinkIds: [...boundary.outsideLinkIds] })),
    staticAddresses: config.staticAddresses.map((mapping) => ({ ...mapping })),
    staticMappings: config.staticMappings.map((mapping) => ({ ...mapping })),
    patPortStart: config.patPortStart,
    patPortEnd: config.patPortEnd,
    sessionLifetime: config.sessionLifetime,
  };
}

export function cloneBuilderNatSessions(sessions: BuilderNatSessionTable): BuilderNatSessionTable { return sessions.map((session) => ({ ...session })); }
export function clearBuilderNatSessions(): BuilderNatSessionTable { return []; }

export function pruneBuilderNatSessions(config: BuilderNatConfig, sessions: BuilderNatSessionTable, sequence: number): BuilderNatSessionTable {
  if (!Number.isInteger(config.sessionLifetime) || config.sessionLifetime < 1) throw new Error('NAT session lifetime must be a positive integer.');
  return sessions.filter((session) => session.expiresAfterSequence == null || sequence <= session.expiresAfterSequence).map((session) => ({ ...session }));
}

export function validateBuilderNatConfig(graph: BuilderGraph, config: BuilderNatConfig, allowDetached = false): BuilderNatConfig {
  if (!config || !Array.isArray(config.boundaries) || !Array.isArray(config.staticAddresses) || !Array.isArray(config.staticMappings)) throw new Error('NAT config requires boundary, static-address, and static-port arrays.');
  if (!Number.isInteger(config.patPortStart) || !Number.isInteger(config.patPortEnd) || config.patPortStart < 1024 || config.patPortEnd > 65535 || config.patPortStart > config.patPortEnd) throw new Error('PAT range must be an ordered 1024–65535 port interval.');
  if (!Number.isInteger(config.sessionLifetime) || config.sessionLifetime < 1 || config.sessionLifetime > 100000) throw new Error('NAT session lifetime must be 1–100000 sequence steps.');
  if (config.boundaries.length > 32) throw new Error('Builder NAT teaching model supports at most 32 boundaries.');
  if (config.staticAddresses.length > 128 || config.staticMappings.length > 128) throw new Error('Builder NAT teaching model supports at most 128 mappings of each static kind.');

  const boundaryIds = new Set<string>();
  const boundaries = config.boundaries.map((raw, index): BuilderNatBoundary => {
    if (!raw || typeof raw !== 'object') throw new Error(`NAT boundary ${index + 1} is invalid.`);
    if (!/^[a-zA-Z0-9_-]+$/.test(raw.id) || boundaryIds.has(raw.id)) throw new Error(`NAT boundary id ${raw.id} is invalid or duplicated.`);
    const router = nodeById(graph, raw.routerId);
    if (!allowDetached && (!router || router.kind !== 'router')) throw new Error(`NAT boundary ${raw.id} references a non-router.`);
    const insideLinkIds = uniqueSorted(raw.insideLinkIds ?? []);
    const outsideLinkIds = uniqueSorted(raw.outsideLinkIds ?? []);
    if (insideLinkIds.length === 0 || outsideLinkIds.length === 0) throw new Error(`NAT boundary ${raw.id} needs at least one inside and one outside link.`);
    if (insideLinkIds.some((id) => outsideLinkIds.includes(id))) throw new Error(`NAT boundary ${raw.id} cannot classify one link as both inside and outside.`);
    if (!allowDetached) {
      for (const linkId of [...insideLinkIds, ...outsideLinkIds]) {
        const link = linkById(graph, linkId);
        if (!link || (link.a !== raw.routerId && link.b !== raw.routerId)) throw new Error(`NAT boundary ${raw.id} link ${linkId} is not attached to ${raw.routerId}.`);
      }
    }
    const overloadAddress = normalizeBuilderIpv4(raw.overloadAddress);
    boundaryIds.add(raw.id);
    return { id: raw.id, routerId: raw.routerId, insideLinkIds, outsideLinkIds, overloadAddress, enabled: raw.enabled !== false };
  }).sort((a, b) => a.id.localeCompare(b.id));

  const staticAddressIds = new Set<string>();
  const staticAddresses = config.staticAddresses.map((raw, index): BuilderNatStaticAddressMapping => {
    if (!raw || typeof raw !== 'object') throw new Error(`Static one-to-one NAT mapping ${index + 1} is invalid.`);
    if (!/^[a-zA-Z0-9_-]+$/.test(raw.id) || staticAddressIds.has(raw.id)) throw new Error(`Static one-to-one NAT mapping id ${raw.id} is invalid or duplicated.`);
    const boundary = boundaries.find((candidate) => candidate.routerId === raw.routerId);
    if (!allowDetached && !boundary) throw new Error(`Static one-to-one NAT mapping ${raw.id} references a router without a NAT boundary.`);
    const insideAddress = normalizeBuilderIpv4(raw.insideAddress);
    const outsideAddress = normalizeBuilderIpv4(raw.outsideAddress);
    if (boundary && outsideAddress === boundary.overloadAddress) throw new Error(`Static one-to-one NAT mapping ${raw.id} cannot reuse the PAT overload address.`);
    staticAddressIds.add(raw.id);
    return { id: raw.id, routerId: raw.routerId, insideAddress, outsideAddress, description: String(raw.description ?? '').slice(0, 80) };
  }).sort((a, b) => a.routerId.localeCompare(b.routerId) || a.outsideAddress.localeCompare(b.outsideAddress) || a.id.localeCompare(b.id));

  const addressOutsideKeys = new Set<string>();
  const addressInsideKeys = new Set<string>();
  for (const mapping of staticAddresses) {
    const outsideKey = `${mapping.routerId}:${mapping.outsideAddress}`;
    const insideKey = `${mapping.routerId}:${mapping.insideAddress}`;
    if (addressOutsideKeys.has(outsideKey)) throw new Error(`Static NAT outside address ${mapping.outsideAddress} is duplicated on ${mapping.routerId}.`);
    if (addressInsideKeys.has(insideKey)) throw new Error(`Static NAT inside address ${mapping.insideAddress} has multiple one-to-one mappings on ${mapping.routerId}.`);
    addressOutsideKeys.add(outsideKey); addressInsideKeys.add(insideKey);
  }

  const mappingIds = new Set<string>();
  const staticMappings = config.staticMappings.map((raw, index): BuilderNatStaticMapping => {
    if (!raw || typeof raw !== 'object') throw new Error(`Static port mapping ${index + 1} is invalid.`);
    if (!/^[a-zA-Z0-9_-]+$/.test(raw.id) || mappingIds.has(raw.id)) throw new Error(`Static port mapping id ${raw.id} is invalid or duplicated.`);
    if (raw.protocol !== 'tcp' && raw.protocol !== 'udp') throw new Error(`Static port mapping ${raw.id} protocol must be TCP or UDP.`);
    const boundary = boundaries.find((candidate) => candidate.routerId === raw.routerId);
    if (!allowDetached && !boundary) throw new Error(`Static port mapping ${raw.id} references a router without a NAT boundary.`);
    const insideAddress = normalizeBuilderIpv4(raw.insideAddress);
    const outsideAddress = normalizeBuilderIpv4(raw.outsideAddress);
    const insidePort = normalizePort(Number(raw.insidePort), raw.protocol, `Static mapping ${raw.id} inside port`)!;
    const outsidePort = normalizePort(Number(raw.outsidePort), raw.protocol, `Static mapping ${raw.id} outside port`)!;
    mappingIds.add(raw.id);
    return { id: raw.id, routerId: raw.routerId, protocol: raw.protocol, insideAddress, insidePort, outsideAddress, outsidePort, description: String(raw.description ?? '').slice(0, 80) };
  }).sort((a, b) => a.routerId.localeCompare(b.routerId) || a.outsideAddress.localeCompare(b.outsideAddress) || a.outsidePort - b.outsidePort || a.id.localeCompare(b.id));

  const published = new Set<string>();
  for (const mapping of staticMappings) {
    const key = `${mapping.routerId}:${mapping.protocol}:${mapping.outsideAddress}:${mapping.outsidePort}`;
    if (published.has(key)) throw new Error(`Static NAT outside tuple ${mapping.outsideAddress}:${mapping.outsidePort}/${mapping.protocol} is duplicated.`);
    published.add(key);
  }

  return { boundaries, staticAddresses, staticMappings, patPortStart: config.patPortStart, patPortEnd: config.patPortEnd, sessionLifetime: config.sessionLifetime };
}

export function reconcileBuilderNatConfig(graph: BuilderGraph, config: BuilderNatConfig): BuilderNatConfig {
  const routerIds = new Set(graph.nodes.filter((node) => node.kind === 'router').map((node) => node.id));
  const linkIds = new Set(graph.links.map((link) => link.id));
  const boundaries = config.boundaries.flatMap((boundary) => {
    if (!routerIds.has(boundary.routerId)) return [];
    const insideLinkIds = boundary.insideLinkIds.filter((id) => linkIds.has(id));
    const outsideLinkIds = boundary.outsideLinkIds.filter((id) => linkIds.has(id));
    if (insideLinkIds.length === 0 || outsideLinkIds.length === 0) return [];
    return [{ ...boundary, insideLinkIds, outsideLinkIds }];
  });
  const boundaryRouters = new Set(boundaries.map((boundary) => boundary.routerId));
  return validateBuilderNatConfig(graph, {
    ...cloneBuilderNatConfig(config),
    boundaries,
    staticAddresses: config.staticAddresses.filter((mapping) => boundaryRouters.has(mapping.routerId)),
    staticMappings: config.staticMappings.filter((mapping) => boundaryRouters.has(mapping.routerId)),
  });
}

export function upsertBuilderNatBoundary(graph: BuilderGraph, config: BuilderNatConfig, boundary: BuilderNatBoundary): BuilderNatConfig {
  const next = cloneBuilderNatConfig(config);
  next.boundaries = [...next.boundaries.filter((candidate) => candidate.id !== boundary.id && candidate.routerId !== boundary.routerId), { ...boundary, insideLinkIds: [...boundary.insideLinkIds], outsideLinkIds: [...boundary.outsideLinkIds] }];
  return validateBuilderNatConfig(graph, next);
}

export function deleteBuilderNatBoundary(graph: BuilderGraph, config: BuilderNatConfig, routerId: string): BuilderNatConfig {
  return validateBuilderNatConfig(graph, {
    ...cloneBuilderNatConfig(config),
    boundaries: config.boundaries.filter((boundary) => boundary.routerId !== routerId),
    staticAddresses: config.staticAddresses.filter((mapping) => mapping.routerId !== routerId),
    staticMappings: config.staticMappings.filter((mapping) => mapping.routerId !== routerId),
  });
}

function stableHash(text: string): number {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) { hash ^= text.charCodeAt(index); hash = Math.imul(hash, 16777619) >>> 0; }
  return hash >>> 0;
}

function translationKey(translation: BuilderNatTranslation): string {
  return `${translation.routerId}:${translation.protocol}:${translation.outsideAddress}:${translation.outsidePort ?? 0}:${translation.remoteAddress}:${translation.remotePort ?? 0}`;
}

function choosePatPort(config: BuilderNatConfig, sessions: BuilderNatSessionTable, seed: string): number {
  const width = config.patPortEnd - config.patPortStart + 1;
  const used = new Set(sessions.filter((session) => session.kind === 'pat').map((session) => session.outsidePort).filter((port): port is number => port != null));
  const start = stableHash(seed) % width;
  for (let offset = 0; offset < width; offset += 1) {
    const candidate = config.patPortStart + ((start + offset) % width);
    if (!used.has(candidate)) return candidate;
  }
  throw new Error('PAT port pool is exhausted.');
}

function pathBoundary(graph: BuilderGraph, forwarding: BuilderForwardingTrace, config: BuilderNatConfig, direction: 'outbound' | 'inbound'): BuilderNatBoundary | null {
  const enabled = config.boundaries.filter((boundary) => boundary.enabled);
  for (let index = 0; index < forwarding.hops.length; index += 1) {
    const hop = forwarding.hops[index];
    const node = nodeById(graph, hop.nodeId);
    if (!node || node.kind !== 'router') continue;
    const incomingLinkId = index > 0 ? forwarding.hops[index - 1].linkId : null;
    const outgoingLinkId = hop.linkId;
    const boundary = enabled.find((candidate) => {
      if (candidate.routerId !== hop.nodeId || !incomingLinkId || !outgoingLinkId) return false;
      return direction === 'outbound'
        ? candidate.insideLinkIds.includes(incomingLinkId) && candidate.outsideLinkIds.includes(outgoingLinkId)
        : candidate.outsideLinkIds.includes(incomingLinkId) && candidate.insideLinkIds.includes(outgoingLinkId);
    });
    if (boundary) return boundary;
  }
  return null;
}

function ownerNodeForAddress(graph: BuilderGraph, addressing: BuilderAddressing, address: string): string | null {
  for (const node of graph.nodes) if (interfacesForBuilderNode(addressing, node.id).some((entry) => entry.address === address)) return node.id;
  return null;
}

function sessionForOutbound(config: BuilderNatConfig, sessions: BuilderNatSessionTable, boundary: BuilderNatBoundary, tuple: BuilderNatTuple, sequence: number): { translation: BuilderNatTranslation; sessions: BuilderNatSessionTable } {
  const active = pruneBuilderNatSessions(config, sessions, sequence);
  const existing = active.find((session) => session.kind === 'pat' && session.routerId === boundary.routerId && session.protocol === tuple.protocol && session.insideAddress === tuple.sourceAddress && session.insidePort === tuple.sourcePort && session.remoteAddress === tuple.destinationAddress && session.remotePort === tuple.destinationPort);
  if (existing) {
    const refreshed = { ...existing, lastUsedSequence: sequence, expiresAfterSequence: sequence + config.sessionLifetime };
    return { translation: refreshed, sessions: [...active.filter((session) => session.id !== existing.id), refreshed].sort((a, b) => translationKey(a).localeCompare(translationKey(b))) };
  }
  const outsidePort = tuple.protocol === 'icmp' ? null : choosePatPort(config, active, `${boundary.id}:${tuple.protocol}:${tuple.sourceAddress}:${tuple.sourcePort}:${tuple.destinationAddress}:${tuple.destinationPort}`);
  const translation: BuilderNatTranslation = {
    id: `nat:${boundary.id}:${sequence}:${stableHash(`${tuple.protocol}:${tuple.sourceAddress}:${tuple.sourcePort}:${tuple.destinationAddress}:${tuple.destinationPort}`).toString(16)}`,
    kind: 'pat', routerId: boundary.routerId, protocol: tuple.protocol,
    insideAddress: tuple.sourceAddress, insidePort: tuple.sourcePort,
    outsideAddress: boundary.overloadAddress, outsidePort,
    remoteAddress: tuple.destinationAddress, remotePort: tuple.destinationPort,
    createdSequence: sequence, lastUsedSequence: sequence, expiresAfterSequence: sequence + config.sessionLifetime,
  };
  return { translation, sessions: [...active, translation].sort((a, b) => translationKey(a).localeCompare(translationKey(b))) };
}

function staticPortTranslation(mapping: BuilderNatStaticMapping, remoteAddress: string, remotePort: number | null, sequence: number): BuilderNatTranslation {
  return {
    id: `static-port:${mapping.id}`, kind: 'static-port', routerId: mapping.routerId, protocol: mapping.protocol,
    insideAddress: mapping.insideAddress, insidePort: mapping.insidePort,
    outsideAddress: mapping.outsideAddress, outsidePort: mapping.outsidePort,
    remoteAddress, remotePort,
    createdSequence: sequence, lastUsedSequence: sequence, expiresAfterSequence: null,
  };
}

function staticAddressTranslation(mapping: BuilderNatStaticAddressMapping, tuple: BuilderNatTuple, sequence: number): BuilderNatTranslation {
  return {
    id: `static-address:${mapping.id}`, kind: 'static-address', routerId: mapping.routerId, protocol: tuple.protocol,
    insideAddress: mapping.insideAddress, insidePort: tuple.sourcePort,
    outsideAddress: mapping.outsideAddress, outsidePort: tuple.sourcePort,
    remoteAddress: tuple.destinationAddress, remotePort: tuple.destinationPort,
    createdSequence: sequence, lastUsedSequence: sequence, expiresAfterSequence: null,
  };
}

function policyForNatPath(
  graph: BuilderGraph,
  aclInput: BuilderAclConfig,
  forwarding: BuilderForwardingTrace,
  boundary: BuilderNatBoundary,
  originalTuple: BuilderNatTuple,
  translatedTuple: BuilderNatTuple,
): { permitted: boolean; stages: BuilderNatPolicyStage[]; deniedAtRouterId: string | null; reason: string | null } {
  const acl = validateBuilderAclConfig(graph, aclInput);
  const stages: BuilderNatPolicyStage[] = [];
  let translated = false;
  for (const hop of forwarding.hops) {
    if (nodeById(graph, hop.nodeId)?.kind !== 'router') continue;
    if (hop.nodeId === boundary.routerId) {
      const preDecision = evaluateBuilderAclAtRouter(acl, hop.nodeId, originalTuple.sourceAddress, originalTuple.destinationAddress, originalTuple.protocol, originalTuple.destinationPort);
      stages.push({ phase: 'pre-nat', routerId: hop.nodeId, tuple: { ...originalTuple }, decision: preDecision, boundary: true });
      if (preDecision.action === 'deny') return { permitted: false, stages, deniedAtRouterId: hop.nodeId, reason: `${nodeById(graph, hop.nodeId)?.label ?? hop.nodeId} denied the pre-NAT tuple by ${preDecision.ruleId ?? 'default policy'}: ${preDecision.ruleDescription}.` };
      const postDecision = evaluateBuilderAclAtRouter(acl, hop.nodeId, translatedTuple.sourceAddress, translatedTuple.destinationAddress, translatedTuple.protocol, translatedTuple.destinationPort);
      stages.push({ phase: 'post-nat', routerId: hop.nodeId, tuple: { ...translatedTuple }, decision: postDecision, boundary: true });
      if (postDecision.action === 'deny') return { permitted: false, stages, deniedAtRouterId: hop.nodeId, reason: `${nodeById(graph, hop.nodeId)?.label ?? hop.nodeId} denied the post-NAT tuple by ${postDecision.ruleId ?? 'default policy'}: ${postDecision.ruleDescription}.` };
      translated = true;
      continue;
    }
    const tuple = translated ? translatedTuple : originalTuple;
    const decision = evaluateBuilderAclAtRouter(acl, hop.nodeId, tuple.sourceAddress, tuple.destinationAddress, tuple.protocol, tuple.destinationPort);
    stages.push({ phase: translated ? 'post-nat' : 'pre-nat', routerId: hop.nodeId, tuple: { ...tuple }, decision, boundary: false });
    if (decision.action === 'deny') return { permitted: false, stages, deniedAtRouterId: hop.nodeId, reason: `${nodeById(graph, hop.nodeId)?.label ?? hop.nodeId} denied the ${translated ? 'post-NAT' : 'pre-NAT'} tuple by ${decision.ruleId ?? 'default policy'}: ${decision.ruleDescription}.` };
  }
  return { permitted: true, stages, deniedAtRouterId: null, reason: null };
}

function noBoundaryPolicy(
  graph: BuilderGraph,
  aclInput: BuilderAclConfig,
  forwarding: BuilderForwardingTrace,
  tuple: BuilderNatTuple,
): { permitted: boolean; stages: BuilderNatPolicyStage[]; deniedAtRouterId: string | null; reason: string | null } {
  const acl = validateBuilderAclConfig(graph, aclInput);
  const stages: BuilderNatPolicyStage[] = [];
  for (const hop of forwarding.hops) {
    if (nodeById(graph, hop.nodeId)?.kind !== 'router') continue;
    const decision = evaluateBuilderAclAtRouter(acl, hop.nodeId, tuple.sourceAddress, tuple.destinationAddress, tuple.protocol, tuple.destinationPort);
    stages.push({ phase: 'pre-nat', routerId: hop.nodeId, tuple: { ...tuple }, decision, boundary: false });
    if (decision.action === 'deny') return { permitted: false, stages, deniedAtRouterId: hop.nodeId, reason: `${nodeById(graph, hop.nodeId)?.label ?? hop.nodeId} denied the untranslated tuple by ${decision.ruleId ?? 'default policy'}: ${decision.ruleDescription}.` };
  }
  return { permitted: true, stages, deniedAtRouterId: null, reason: null };
}

function failedResult(direction: 'outbound' | 'inbound', forwarding: BuilderForwardingTrace | null, originalTuple: BuilderNatTuple, sessions: BuilderNatSessionTable, failureReason: string, explanation: string, extra: Partial<BuilderNatFlowResult> = {}): BuilderNatFlowResult {
  return {
    direction, success: false, forwarding, boundaryId: null, routerId: null, originalTuple, translatedTuple: null, translation: null,
    sessions, policyStages: [], policyPermitted: true, deniedAtRouterId: null, failureReason, explanation, ...extra,
  };
}

export function runBuilderNatOutboundFlow(
  graph: BuilderGraph,
  addressing: BuilderAddressing,
  routing: BuilderRoutingConfig,
  configInput: BuilderNatConfig,
  sessionsInput: BuilderNatSessionTable,
  sourceNodeId: string,
  destinationNodeId: string,
  protocol: BuilderNatProtocol,
  sourcePort: number | null,
  destinationPort: number | null,
  sequence = 1,
  aclInput: BuilderAclConfig = createDefaultBuilderAclConfig(),
): BuilderNatFlowResult {
  const config = validateBuilderNatConfig(graph, configInput);
  const sourceAddress = primaryAddress(addressing, sourceNodeId);
  const destinationAddress = primaryAddress(addressing, destinationNodeId);
  if (!sourceAddress || !destinationAddress) throw new Error('NAT flow endpoints require IPv4 interfaces.');
  const normalizedSourcePort = normalizePort(sourcePort, protocol, 'Source port');
  const normalizedDestinationPort = normalizePort(destinationPort, protocol, 'Destination port');
  const originalTuple: BuilderNatTuple = { sourceAddress, sourcePort: normalizedSourcePort, destinationAddress, destinationPort: normalizedDestinationPort, protocol };
  const forwarding = traceBuilderForwarding(graph, addressing, routing, sourceNodeId, destinationNodeId);
  const sessions = pruneBuilderNatSessions(config, sessionsInput, sequence);
  if (!forwarding.reachable) return failedResult('outbound', forwarding, originalTuple, sessions, forwarding.failureReason ?? 'ROUTING FAILED', `Routing failed before NAT: ${forwarding.failureReason ?? 'unreachable'}.`);
  const boundary = pathBoundary(graph, forwarding, config, 'outbound');
  if (!boundary) {
    const policy = noBoundaryPolicy(graph, aclInput, forwarding, originalTuple);
    if (!policy.permitted) return failedResult('outbound', forwarding, originalTuple, sessions, 'ACL DENY', policy.reason ?? 'ACL denied untranslated flow.', { policyStages: policy.stages, policyPermitted: false, deniedAtRouterId: policy.deniedAtRouterId });
    return { direction: 'outbound', success: true, forwarding, boundaryId: null, routerId: null, originalTuple, translatedTuple: originalTuple, translation: null, sessions, policyStages: policy.stages, policyPermitted: true, deniedAtRouterId: null, failureReason: null, explanation: 'Forwarding crosses no configured inside→outside NAT boundary; the tuple is unchanged.' };
  }

  const staticAddress = config.staticAddresses.find((mapping) => mapping.routerId === boundary.routerId && mapping.insideAddress === originalTuple.sourceAddress);
  let translation: BuilderNatTranslation;
  let nextSessions = sessions;
  if (staticAddress) {
    translation = staticAddressTranslation(staticAddress, originalTuple, sequence);
  } else {
    try {
      const sessionResult = sessionForOutbound(config, sessions, boundary, originalTuple, sequence);
      translation = sessionResult.translation; nextSessions = sessionResult.sessions;
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'PAT allocation failed.';
      return failedResult('outbound', forwarding, originalTuple, sessions, 'PAT ALLOCATION FAILED', reason, { boundaryId: boundary.id, routerId: boundary.routerId });
    }
  }

  const translatedTuple: BuilderNatTuple = { ...originalTuple, sourceAddress: translation.outsideAddress, sourcePort: translation.outsidePort };
  const policy = policyForNatPath(graph, aclInput, forwarding, boundary, originalTuple, translatedTuple);
  if (!policy.permitted) return failedResult('outbound', forwarding, originalTuple, nextSessions, 'ACL DENY', policy.reason ?? 'ACL denied translated flow.', { boundaryId: boundary.id, routerId: boundary.routerId, translatedTuple, translation, policyStages: policy.stages, policyPermitted: false, deniedAtRouterId: policy.deniedAtRouterId });

  const kindLabel = translation.kind === 'pat' ? 'PAT' : 'STATIC 1:1';
  return { direction: 'outbound', success: true, forwarding, boundaryId: boundary.id, routerId: boundary.routerId, originalTuple, translatedTuple, translation, sessions: nextSessions, policyStages: policy.stages, policyPermitted: true, deniedAtRouterId: null, failureReason: null, explanation: `${nodeById(graph, boundary.routerId)?.label ?? boundary.routerId} ${kindLabel} translates ${originalTuple.sourceAddress}${originalTuple.sourcePort == null ? '' : `:${originalTuple.sourcePort}`} → ${translatedTuple.sourceAddress}${translatedTuple.sourcePort == null ? '' : `:${translatedTuple.sourcePort}`}; remote destination is unchanged.` };
}

function translationForInbound(config: BuilderNatConfig, sessions: BuilderNatSessionTable, tuple: BuilderNatTuple, sequence: number): BuilderNatTranslation | null {
  const dynamic = sessions.find((session) => session.protocol === tuple.protocol && session.outsideAddress === tuple.destinationAddress && session.outsidePort === tuple.destinationPort && session.remoteAddress === tuple.sourceAddress && session.remotePort === tuple.sourcePort);
  if (dynamic) return dynamic;
  if (tuple.protocol !== 'icmp') {
    const portMapping = config.staticMappings.find((candidate) => candidate.protocol === tuple.protocol && candidate.outsideAddress === tuple.destinationAddress && candidate.outsidePort === tuple.destinationPort);
    if (portMapping) return staticPortTranslation(portMapping, tuple.sourceAddress, tuple.sourcePort, sequence);
  }
  const addressMapping = config.staticAddresses.find((candidate) => candidate.outsideAddress === tuple.destinationAddress);
  if (addressMapping) {
    return {
      id: `static-address:${addressMapping.id}`, kind: 'static-address', routerId: addressMapping.routerId, protocol: tuple.protocol,
      insideAddress: addressMapping.insideAddress, insidePort: tuple.destinationPort,
      outsideAddress: addressMapping.outsideAddress, outsidePort: tuple.destinationPort,
      remoteAddress: tuple.sourceAddress, remotePort: tuple.sourcePort,
      createdSequence: sequence, lastUsedSequence: sequence, expiresAfterSequence: null,
    };
  }
  return null;
}

export function runBuilderNatInboundFlow(
  graph: BuilderGraph,
  addressing: BuilderAddressing,
  routing: BuilderRoutingConfig,
  configInput: BuilderNatConfig,
  sessionsInput: BuilderNatSessionTable,
  outsideSourceNodeId: string,
  outsideDestinationAddress: string,
  protocol: BuilderNatProtocol,
  sourcePort: number | null,
  destinationPort: number | null,
  sequence = 1,
  aclInput: BuilderAclConfig = createDefaultBuilderAclConfig(),
): BuilderNatFlowResult {
  const config = validateBuilderNatConfig(graph, configInput);
  const sourceAddress = primaryAddress(addressing, outsideSourceNodeId);
  if (!sourceAddress) throw new Error('Inbound NAT source node requires an IPv4 interface.');
  const normalizedOutsideAddress = normalizeBuilderIpv4(outsideDestinationAddress);
  const normalizedSourcePort = normalizePort(sourcePort, protocol, 'Source port');
  const normalizedDestinationPort = normalizePort(destinationPort, protocol, 'Destination port');
  const originalTuple: BuilderNatTuple = { sourceAddress, sourcePort: normalizedSourcePort, destinationAddress: normalizedOutsideAddress, destinationPort: normalizedDestinationPort, protocol };
  const active = pruneBuilderNatSessions(config, sessionsInput, sequence);
  const translation = translationForInbound(config, active, originalTuple, sequence);
  if (!translation) return failedResult('inbound', null, originalTuple, active, 'NO NAT MAPPING', `Unsolicited inbound ${protocol.toUpperCase()} to ${normalizedOutsideAddress}${normalizedDestinationPort == null ? '' : `:${normalizedDestinationPort}`} has no active PAT session, static port mapping, or static one-to-one address mapping.`);
  const insideNodeId = ownerNodeForAddress(graph, addressing, translation.insideAddress);
  if (!insideNodeId) return failedResult('inbound', null, originalTuple, active, 'INSIDE ADDRESS HAS NO DEVICE', `NAT maps to ${translation.insideAddress}, but no Builder device owns that IPv4 address.`, { routerId: translation.routerId, translation });
  const forwarding = traceBuilderForwarding(graph, addressing, routing, outsideSourceNodeId, insideNodeId);
  const boundary = pathBoundary(graph, forwarding, config, 'inbound');
  if (!forwarding.reachable) return failedResult('inbound', forwarding, originalTuple, active, forwarding.failureReason ?? 'INSIDE FORWARDING FAILED', `NAT mapping exists, but translated inside forwarding fails: ${forwarding.failureReason ?? 'unreachable'}.`, { routerId: translation.routerId, translation });
  if (!boundary || boundary.routerId !== translation.routerId) return failedResult('inbound', forwarding, originalTuple, active, 'NAT BOUNDARY NOT ON RETURN PATH', 'A mapping exists, but the current outside→inside forwarding path does not cross the configured NAT boundary in the outside→inside direction.', { boundaryId: boundary?.id ?? null, routerId: translation.routerId, translation });
  const translatedTuple: BuilderNatTuple = { ...originalTuple, destinationAddress: translation.insideAddress, destinationPort: translation.insidePort };
  const policy = policyForNatPath(graph, aclInput, forwarding, boundary, originalTuple, translatedTuple);
  if (!policy.permitted) return failedResult('inbound', forwarding, originalTuple, active, 'ACL DENY', policy.reason ?? 'ACL denied translated inbound flow.', { boundaryId: boundary.id, routerId: boundary.routerId, translatedTuple, translation, policyStages: policy.stages, policyPermitted: false, deniedAtRouterId: policy.deniedAtRouterId });
  const refreshed = translation.kind === 'pat' ? { ...translation, lastUsedSequence: sequence, expiresAfterSequence: sequence + config.sessionLifetime } : translation;
  const sessions = translation.kind === 'pat' ? [...active.filter((session) => session.id !== translation.id), refreshed].sort((a, b) => translationKey(a).localeCompare(translationKey(b))) : active;
  const kindLabel = translation.kind === 'pat' ? 'active PAT state' : translation.kind === 'static-port' ? 'static port forwarding' : 'static one-to-one NAT';
  return { direction: 'inbound', success: true, forwarding, boundaryId: boundary.id, routerId: boundary.routerId, originalTuple, translatedTuple, translation: refreshed, sessions, policyStages: policy.stages, policyPermitted: true, deniedAtRouterId: null, failureReason: null, explanation: `${nodeById(graph, boundary.routerId)?.label ?? boundary.routerId} matches ${kindLabel} and translates destination ${originalTuple.destinationAddress}${originalTuple.destinationPort == null ? '' : `:${originalTuple.destinationPort}`} → ${translatedTuple.destinationAddress}${translatedTuple.destinationPort == null ? '' : `:${translatedTuple.destinationPort}`}.` };
}

export function runBuilderNatRelatedIcmpInbound(
  graph: BuilderGraph,
  addressing: BuilderAddressing,
  routing: BuilderRoutingConfig,
  configInput: BuilderNatConfig,
  sessionsInput: BuilderNatSessionTable,
  outsideSourceNodeId: string,
  relatedTranslationId: string,
  sequence = 1,
  aclInput: BuilderAclConfig = createDefaultBuilderAclConfig(),
): BuilderNatFlowResult {
  const config = validateBuilderNatConfig(graph, configInput);
  const active = pruneBuilderNatSessions(config, sessionsInput, sequence);
  const related = active.find((session) => session.id === relatedTranslationId);
  const sourceAddress = primaryAddress(addressing, outsideSourceNodeId);
  if (!sourceAddress) throw new Error('Related ICMP source requires an IPv4 interface.');
  const originalTuple: BuilderNatTuple = { sourceAddress, sourcePort: null, destinationAddress: related?.outsideAddress ?? '0.0.0.0', destinationPort: null, protocol: 'icmp' };
  if (!related) return failedResult('inbound', null, originalTuple, active, 'NO RELATED NAT STATE', 'ICMP error cannot be translated because the quoted outbound transaction no longer has active NAT state.');
  const insideNodeId = ownerNodeForAddress(graph, addressing, related.insideAddress);
  if (!insideNodeId) return failedResult('inbound', null, originalTuple, active, 'INSIDE ADDRESS HAS NO DEVICE', `Related NAT state points to ${related.insideAddress}, but no Builder device owns that address.`, { translation: related, routerId: related.routerId });
  const forwarding = traceBuilderForwarding(graph, addressing, routing, outsideSourceNodeId, insideNodeId);
  const boundary = pathBoundary(graph, forwarding, config, 'inbound');
  if (!forwarding.reachable || !boundary || boundary.routerId !== related.routerId) return failedResult('inbound', forwarding, originalTuple, active, forwarding.failureReason ?? 'NAT BOUNDARY NOT ON RETURN PATH', forwarding.failureReason ? `Related ICMP error has NAT state, but translated inside forwarding fails: ${forwarding.failureReason}.` : 'Related ICMP error has NAT state, but the translated path does not cross the expected NAT boundary.', { translation: related, routerId: related.routerId, boundaryId: boundary?.id ?? null });
  const translatedTuple: BuilderNatTuple = { ...originalTuple, destinationAddress: related.insideAddress };
  const policy = policyForNatPath(graph, aclInput, forwarding, boundary, originalTuple, translatedTuple);
  if (!policy.permitted) return failedResult('inbound', forwarding, originalTuple, active, 'ACL DENY', policy.reason ?? 'ACL denied related ICMP.', { boundaryId: boundary.id, routerId: boundary.routerId, translatedTuple, translation: related, policyStages: policy.stages, policyPermitted: false, deniedAtRouterId: policy.deniedAtRouterId });
  const refreshed = related.kind === 'pat' ? { ...related, lastUsedSequence: sequence, expiresAfterSequence: sequence + config.sessionLifetime } : related;
  const sessions = related.kind === 'pat' ? [...active.filter((session) => session.id !== related.id), refreshed].sort((a, b) => translationKey(a).localeCompare(translationKey(b))) : active;
  return { direction: 'inbound', success: true, forwarding, boundaryId: boundary.id, routerId: boundary.routerId, originalTuple, translatedTuple, translation: refreshed, sessions, policyStages: policy.stages, policyPermitted: true, deniedAtRouterId: null, failureReason: null, explanation: `${nodeById(graph, boundary.routerId)?.label ?? boundary.routerId} recognizes ICMP as related to ${related.id} and translates the quoted NAT destination back to ${related.insideAddress}.` };
}

export function upsertBuilderNatStaticAddress(graph: BuilderGraph, config: BuilderNatConfig, mapping: BuilderNatStaticAddressMapping): BuilderNatConfig {
  const next = cloneBuilderNatConfig(config);
  next.staticAddresses = [...next.staticAddresses.filter((candidate) => candidate.id !== mapping.id), { ...mapping }];
  return validateBuilderNatConfig(graph, next);
}

export function deleteBuilderNatStaticAddress(graph: BuilderGraph, config: BuilderNatConfig, id: string): BuilderNatConfig {
  return validateBuilderNatConfig(graph, { ...cloneBuilderNatConfig(config), staticAddresses: config.staticAddresses.filter((mapping) => mapping.id !== id) });
}

export function upsertBuilderNatStaticMapping(graph: BuilderGraph, config: BuilderNatConfig, mapping: BuilderNatStaticMapping): BuilderNatConfig {
  const next = cloneBuilderNatConfig(config);
  next.staticMappings = [...next.staticMappings.filter((candidate) => candidate.id !== mapping.id), { ...mapping }];
  return validateBuilderNatConfig(graph, next);
}

export function deleteBuilderNatStaticMapping(graph: BuilderGraph, config: BuilderNatConfig, id: string): BuilderNatConfig {
  return validateBuilderNatConfig(graph, { ...cloneBuilderNatConfig(config), staticMappings: config.staticMappings.filter((mapping) => mapping.id !== id) });
}
