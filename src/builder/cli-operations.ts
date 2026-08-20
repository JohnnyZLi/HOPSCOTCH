import { interfacesForBuilderNode, type BuilderAddressing } from './addressing.ts';
import type { BuilderAclConfig } from './acl.ts';
import { builderBgpState } from './bgp.ts';
import {
  BuilderCliCommandError,
  formatBuilderCliCommand,
  parseBuilderCliCommand,
  projectBuilderCliState,
  resolveBuilderCliProbeDestination,
  type BuilderCliProjectionInput,
  type BuilderCliShowCommand,
  type BuilderCliState,
} from './cli.ts';
import type { BuilderGraph } from './model.ts';
import type { BuilderNatConfig, BuilderNatSessionTable } from './nat.ts';
import type { BuilderProbeResult } from './probes.ts';
import { builderOspfState, type BuilderRoutingConfig } from './routing.ts';
import { normalizeBuilderIpv6, type BuilderIpv6Config } from './ipv6.ts';

export type BuilderCliAddressFamily = 'ipv4' | 'ipv6';
export type BuilderCliOperationalShowTarget = 'ospf-neighbors' | 'bgp' | 'acl' | 'nat';

export interface BuilderCliOperationalShowCommand {
  readonly verb: 'show';
  readonly target: BuilderCliOperationalShowTarget;
}

export interface BuilderCliUseCommand {
  readonly verb: 'use';
  readonly device: string;
}

export interface BuilderCliOperationalProbeCommand {
  readonly verb: 'ping' | 'traceroute';
  readonly family: BuilderCliAddressFamily;
  readonly destination: string;
}

export interface BuilderCliSetOspfCommand {
  readonly verb: 'set';
  readonly target: 'ospf';
  readonly enabled: boolean;
}

export interface BuilderCliSetBgpCommand {
  readonly verb: 'set';
  readonly target: 'bgp';
  readonly enabled: boolean;
}

export interface BuilderCliSetGatewayCommand {
  readonly verb: 'set';
  readonly target: 'gateway';
  readonly address: string | null;
}

export interface BuilderCliSetLinkCommand {
  readonly verb: 'set';
  readonly target: 'link';
  readonly linkId: string;
  readonly failed: boolean;
}

export interface BuilderCliSetStaticRouteCommand {
  readonly verb: 'set';
  readonly target: 'static-route';
  readonly prefix: string;
  readonly nextHop: string;
  readonly metric: number;
}

export interface BuilderCliDeleteStaticRouteCommand {
  readonly verb: 'delete';
  readonly target: 'static-route';
  readonly prefix: string;
}

export type BuilderCliMutationCommand =
  | BuilderCliSetOspfCommand
  | BuilderCliSetBgpCommand
  | BuilderCliSetGatewayCommand
  | BuilderCliSetLinkCommand
  | BuilderCliSetStaticRouteCommand
  | BuilderCliDeleteStaticRouteCommand;

export type BuilderCliSessionCommand =
  | BuilderCliShowCommand
  | BuilderCliOperationalShowCommand
  | BuilderCliUseCommand
  | BuilderCliOperationalProbeCommand
  | BuilderCliMutationCommand;

export interface BuilderCliOperationalProjectionInput extends Omit<BuilderCliProjectionInput, 'truthGraphs'> {
  readonly truthGraphs?: {
    readonly controlGraph: BuilderGraph;
    readonly ribGraph: BuilderGraph;
    readonly fibGraph?: BuilderGraph;
  } | null;
  readonly ipv6: BuilderIpv6Config;
  readonly acl: BuilderAclConfig;
  readonly nat: BuilderNatConfig;
  readonly natSessions: BuilderNatSessionTable;
}

export interface BuilderCliOperationalState {
  readonly core: BuilderCliState;
  readonly graph: BuilderGraph;
  readonly addressing: BuilderAddressing;
  readonly routing: BuilderRoutingConfig;
  readonly ipv6: BuilderIpv6Config;
  readonly acl: BuilderAclConfig;
  readonly nat: BuilderNatConfig;
  readonly natSessions: BuilderNatSessionTable;
  readonly controlGraph: BuilderGraph;
}

export interface BuilderCliProbeRequest {
  readonly kind: 'ping' | 'traceroute';
  readonly family: BuilderCliAddressFamily;
  readonly sourceId: string;
  readonly destinationId: string;
}

export interface BuilderCliMutationRequest {
  readonly command: BuilderCliMutationCommand;
  readonly deviceId: string | null;
}

export interface BuilderCliSessionExecutionContext {
  readonly state: BuilderCliOperationalState;
  readonly currentDeviceId: string | null;
  readonly defaultSourceId: string;
  readonly runProbe?: (request: BuilderCliProbeRequest) => BuilderProbeResult;
  readonly mutate?: (request: BuilderCliMutationRequest) => string;
  readonly activeUnavailableReason?: string;
}

export interface BuilderCliSessionExecutionResult {
  readonly command: BuilderCliSessionCommand;
  readonly output: string;
  readonly nextDeviceId: string | null;
  readonly probeResult: BuilderProbeResult | null;
}

function commandLabel(input: string): string {
  return JSON.stringify(input.trim());
}

function parseEnabled(value: string, command: string): boolean {
  const normalized = value.toLowerCase();
  if (normalized === 'on') return true;
  if (normalized === 'off') return false;
  throw new BuilderCliCommandError('UNSUPPORTED_SYNTAX', `Unsupported syntax ${commandLabel(command)}. Expected ON or OFF.`);
}

export function parseBuilderCliSessionCommand(input: string): BuilderCliSessionCommand {
  const trimmed = input.trim();
  if (!trimmed) return parseBuilderCliCommand(trimmed) as BuilderCliShowCommand;
  const tokens = trimmed.split(/\s+/);
  const verb = tokens[0].toLowerCase();

  if (verb === 'show') {
    if (tokens.length === 3 && tokens[1].toLowerCase() === 'ospf' && tokens[2].toLowerCase() === 'neighbors') {
      return Object.freeze({ verb: 'show', target: 'ospf-neighbors' });
    }
    if (tokens.length === 2 && ['bgp', 'acl', 'nat'].includes(tokens[1].toLowerCase())) {
      return Object.freeze({ verb: 'show', target: tokens[1].toLowerCase() as Exclude<BuilderCliOperationalShowTarget, 'ospf-neighbors'> });
    }
    return parseBuilderCliCommand(trimmed) as BuilderCliShowCommand;
  }

  if (verb === 'use') {
    if (tokens.length !== 2) throw new BuilderCliCommandError('UNSUPPORTED_SYNTAX', `Unsupported syntax ${commandLabel(input)}. Expected exactly "use <device>" or "use global".`);
    return Object.freeze({ verb: 'use', device: tokens[1] });
  }

  if (verb === 'ping' || verb === 'traceroute') {
    if (tokens.length === 2) return Object.freeze({ verb, family: 'ipv4', destination: tokens[1] });
    if (tokens.length === 3 && (tokens[1].toLowerCase() === 'ipv4' || tokens[1].toLowerCase() === 'ipv6')) {
      return Object.freeze({ verb, family: tokens[1].toLowerCase() as BuilderCliAddressFamily, destination: tokens[2] });
    }
    throw new BuilderCliCommandError(
      tokens.length === 1 ? 'AMBIGUOUS_COMMAND' : 'UNSUPPORTED_SYNTAX',
      `Unsupported syntax ${commandLabel(input)}. Expected "${verb} <destination>" or "${verb} ipv4|ipv6 <destination>".`,
    );
  }

  if (verb === 'set') {
    const target = tokens[1]?.toLowerCase();
    if ((target === 'ospf' || target === 'bgp') && tokens.length === 3) {
      return Object.freeze({ verb: 'set', target, enabled: parseEnabled(tokens[2], input) }) as BuilderCliSetOspfCommand | BuilderCliSetBgpCommand;
    }
    if (target === 'gateway' && tokens.length === 3) {
      return Object.freeze({ verb: 'set', target: 'gateway', address: tokens[2].toLowerCase() === 'none' ? null : tokens[2] });
    }
    if (target === 'link' && tokens.length === 4 && (tokens[3].toLowerCase() === 'up' || tokens[3].toLowerCase() === 'down')) {
      return Object.freeze({ verb: 'set', target: 'link', linkId: tokens[2], failed: tokens[3].toLowerCase() === 'down' });
    }
    if (target === 'static-route' && (tokens.length === 5 || tokens.length === 7) && tokens[3].toLowerCase() === 'via') {
      let metric = 1;
      if (tokens.length === 7) {
        if (tokens[5].toLowerCase() !== 'metric') throw new BuilderCliCommandError('UNSUPPORTED_SYNTAX', `Unsupported syntax ${commandLabel(input)}. Expected "metric <1-999>".`);
        metric = Number(tokens[6]);
        if (!Number.isInteger(metric) || metric < 1 || metric > 999) throw new BuilderCliCommandError('UNSUPPORTED_SYNTAX', 'Static route metric must be an integer from 1 to 999.');
      }
      return Object.freeze({ verb: 'set', target: 'static-route', prefix: tokens[2], nextHop: tokens[4], metric });
    }
    throw new BuilderCliCommandError('UNSUPPORTED_SYNTAX', `Unsupported SET syntax ${commandLabel(input)}. Supported targets: ospf, bgp, gateway, link, static-route.`);
  }

  if (verb === 'delete') {
    if (tokens.length === 3 && tokens[1].toLowerCase() === 'static-route') return Object.freeze({ verb: 'delete', target: 'static-route', prefix: tokens[2] });
    throw new BuilderCliCommandError('UNSUPPORTED_SYNTAX', `Unsupported DELETE syntax ${commandLabel(input)}. Expected "delete static-route <prefix>".`);
  }

  throw new BuilderCliCommandError(
    'UNSUPPORTED_COMMAND',
    `Unsupported command ${commandLabel(input)}. Supported verbs: show, use, ping, traceroute, set, delete.`,
  );
}

export function projectBuilderCliOperationalState(input: BuilderCliOperationalProjectionInput): BuilderCliOperationalState {
  return {
    core: projectBuilderCliState(input),
    graph: input.graph,
    addressing: input.addressing,
    routing: input.routing,
    ipv6: input.ipv6,
    acl: input.acl,
    nat: input.nat,
    natSessions: input.natSessions,
    controlGraph: input.truthGraphs?.controlGraph ?? input.graph,
  };
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function formatTable(headers: readonly string[], rows: readonly (readonly string[])[]): string {
  const widths = headers.map((header, columnIndex) => Math.max(header.length, ...rows.map((row) => (row[columnIndex] ?? '').length)));
  return [headers, ...rows].map((row) => row.map((cell, index) => cell.padEnd(widths[index] ?? cell.length)).join('  ').trimEnd()).join('\n');
}

function labelFor(graph: BuilderGraph, id: string): string {
  return graph.nodes.find((node) => node.id === id)?.label ?? id;
}

function filterCoreState(state: BuilderCliState, deviceId: string | null): BuilderCliState {
  if (!deviceId) return state;
  return {
    interfaces: state.interfaces.filter((entry) => entry.deviceId === deviceId),
    routes: state.routes.filter((entry) => entry.routerId === deviceId),
    arpEntries: state.arpEntries.filter((entry) => entry.ownerDeviceId === deviceId),
    macEntries: state.macEntries.filter((entry) => entry.switchId === deviceId),
  };
}

function formatOspfNeighbors(state: BuilderCliOperationalState, deviceId: string | null): string {
  const ospf = builderOspfState(state.controlGraph, state.addressing, state.routing);
  const rows = ospf.adjacencies.flatMap((adjacency) => [
    { local: adjacency.aRouterId, neighbor: adjacency.bRouterId, adjacency },
    { local: adjacency.bRouterId, neighbor: adjacency.aRouterId, adjacency },
  ]).filter((entry) => !deviceId || entry.local === deviceId)
    .sort((left, right) => compareText(left.local, right.local) || compareText(left.neighbor, right.neighbor) || compareText(left.adjacency.linkId, right.adjacency.linkId))
    .map((entry) => [
      entry.local,
      entry.neighbor,
      entry.adjacency.areaId,
      entry.adjacency.linkId,
      String(entry.adjacency.cost),
      entry.adjacency.state,
      entry.adjacency.reason,
    ]);
  if (rows.length === 0) return 'No OSPF neighbor facts in this context.';
  return formatTable(['LOCAL', 'NEIGHBOR', 'AREA', 'LINK', 'COST', 'STATE', 'DETAIL'], rows);
}

function formatBgp(state: BuilderCliOperationalState, deviceId: string | null): string {
  const bgp = builderBgpState(state.controlGraph, state.addressing, state.routing.bgp);
  const sessionRows = bgp.sessions.flatMap((session) => [
    { local: session.aRouterId, localAsn: session.aAsn, peer: session.bRouterId, peerAsn: session.bAsn, session },
    { local: session.bRouterId, localAsn: session.bAsn, peer: session.aRouterId, peerAsn: session.aAsn, session },
  ]).filter((entry) => !deviceId || entry.local === deviceId)
    .sort((a, b) => compareText(a.local, b.local) || compareText(a.peer, b.peer) || compareText(a.session.id, b.session.id))
    .map((entry) => [entry.local, String(entry.localAsn), entry.peer, String(entry.peerAsn), entry.session.mode.toUpperCase(), entry.session.state, entry.session.relationship.toUpperCase(), entry.session.reason]);
  const routeRows = bgp.bestRoutes.filter((route) => !deviceId || route.routerId === deviceId)
    .sort((a, b) => compareText(a.routerId, b.routerId) || compareText(a.prefix, b.prefix) || compareText(a.id, b.id))
    .map((route) => [
      route.routerId,
      route.prefix,
      route.learnedVia.toUpperCase(),
      route.learnedFromRouterId ?? 'LOCAL',
      route.asPath.length ? route.asPath.join(' ') : '—',
      String(route.localPref),
      String(route.med),
      route.nextHopAddress,
      route.policyAnomaly ? 'ANOMALY' : 'BEST',
    ]);
  const sections = [
    `SESSIONS · ${sessionRows.length / 2 === 0 && !deviceId ? bgp.sessions.length : sessionRows.length} VIEW${sessionRows.length === 1 ? '' : 'S'}`,
    sessionRows.length ? formatTable(['LOCAL', 'ASN', 'PEER', 'PEER ASN', 'MODE', 'STATE', 'REL', 'DETAIL'], sessionRows) : 'No BGP session facts in this context.',
    `BEST ROUTES · ${routeRows.length}`,
    routeRows.length ? formatTable(['DEVICE', 'PREFIX', 'VIA', 'FROM', 'AS PATH', 'LOCAL PREF', 'MED', 'NEXT HOP', 'STATE'], routeRows) : 'No BGP best-route facts in this context.',
  ];
  return sections.join('\n\n');
}

function formatAcl(state: BuilderCliOperationalState, deviceId: string | null): string {
  const rules = state.acl.rules.filter((rule) => !deviceId || rule.routerId === deviceId)
    .sort((a, b) => compareText(a.routerId, b.routerId) || a.order - b.order || compareText(a.id, b.id));
  if (rules.length === 0) return `No explicit ACL rules in this context. DEFAULT ${state.acl.defaultAction.toUpperCase()}.`;
  const rows = rules.map((rule) => [
    rule.routerId,
    String(rule.order),
    rule.action.toUpperCase(),
    rule.protocol.toUpperCase(),
    rule.sourcePrefix,
    rule.destinationPrefix,
    rule.destinationPort == null ? 'ANY' : String(rule.destinationPort),
    rule.id,
    rule.description || '—',
  ]);
  return `DEFAULT ${state.acl.defaultAction.toUpperCase()}\n${formatTable(['ROUTER', 'ORDER', 'ACTION', 'PROTO', 'SOURCE', 'DESTINATION', 'PORT', 'ID', 'DESCRIPTION'], rows)}`;
}

function formatNat(state: BuilderCliOperationalState, deviceId: string | null): string {
  const boundaries = state.nat.boundaries.filter((entry) => !deviceId || entry.routerId === deviceId);
  const sessions = state.natSessions.filter((entry) => !deviceId || entry.routerId === deviceId);
  const staticAddresses = state.nat.staticAddresses.filter((entry) => !deviceId || entry.routerId === deviceId);
  const staticPorts = state.nat.staticMappings.filter((entry) => !deviceId || entry.routerId === deviceId);
  const sections: string[] = [];
  sections.push('BOUNDARIES', boundaries.length ? formatTable(
    ['ROUTER', 'STATE', 'OVERLOAD', 'INSIDE LINKS', 'OUTSIDE LINKS', 'ID'],
    boundaries.map((entry) => [entry.routerId, entry.enabled ? 'ENABLED' : 'DISABLED', entry.overloadAddress, entry.insideLinkIds.join(','), entry.outsideLinkIds.join(','), entry.id]),
  ) : 'No NAT boundaries in this context.');
  sections.push('ACTIVE SESSIONS', sessions.length ? formatTable(
    ['ROUTER', 'KIND', 'PROTO', 'INSIDE', 'OUTSIDE', 'REMOTE', 'EXPIRES', 'ID'],
    sessions.map((entry) => [
      entry.routerId,
      entry.kind.toUpperCase(),
      entry.protocol.toUpperCase(),
      `${entry.insideAddress}${entry.insidePort == null ? '' : `:${entry.insidePort}`}`,
      `${entry.outsideAddress}${entry.outsidePort == null ? '' : `:${entry.outsidePort}`}`,
      `${entry.remoteAddress}${entry.remotePort == null ? '' : `:${entry.remotePort}`}`,
      entry.expiresAfterSequence == null ? 'STATIC' : String(entry.expiresAfterSequence),
      entry.id,
    ]),
  ) : 'No active NAT sessions in this context.');
  if (staticAddresses.length) sections.push('STATIC ADDRESSES', formatTable(['ROUTER', 'INSIDE', 'OUTSIDE', 'ID'], staticAddresses.map((entry) => [entry.routerId, entry.insideAddress, entry.outsideAddress, entry.id])));
  if (staticPorts.length) sections.push('STATIC PORTS', formatTable(['ROUTER', 'PROTO', 'INSIDE', 'OUTSIDE', 'ID'], staticPorts.map((entry) => [entry.routerId, entry.protocol.toUpperCase(), `${entry.insideAddress}:${entry.insidePort}`, `${entry.outsideAddress}:${entry.outsidePort}`, entry.id])));
  return sections.join('\n\n');
}

function operationalShowTarget(target: string): target is BuilderCliOperationalShowTarget {
  return target === 'ospf-neighbors' || target === 'bgp' || target === 'acl' || target === 'nat';
}

export function formatBuilderCliSessionShow(command: BuilderCliShowCommand | BuilderCliOperationalShowCommand, state: BuilderCliOperationalState, deviceId: string | null): string {
  if (!operationalShowTarget(command.target)) return formatBuilderCliCommand(command as BuilderCliShowCommand, filterCoreState(state.core, deviceId));
  switch (command.target) {
    case 'ospf-neighbors': return formatOspfNeighbors(state, deviceId);
    case 'bgp': return formatBgp(state, deviceId);
    case 'acl': return formatAcl(state, deviceId);
    case 'nat': return formatNat(state, deviceId);
  }
}

function normalizedIpv6Target(target: string): string | null {
  try { return normalizeBuilderIpv6(target.trim().split('/')[0] ?? target); }
  catch { return null; }
}

export function resolveBuilderCliSessionDevice(graph: BuilderGraph, target: string): string | null {
  if (target.trim().toLowerCase() === 'global') return null;
  const normalized = target.trim().toLowerCase();
  const matches = graph.nodes.filter((node) => node.id.toLowerCase() === normalized || node.label.toLowerCase() === normalized);
  if (matches.length === 0) throw new BuilderCliCommandError('UNKNOWN_DESTINATION', `Unknown Builder device ${JSON.stringify(target)}. Use a node id, unique label, or GLOBAL.`);
  if (matches.length > 1) throw new BuilderCliCommandError('AMBIGUOUS_DESTINATION', `Ambiguous Builder device ${JSON.stringify(target)}. Use a unique node id.`);
  return matches[0].id;
}

export function resolveBuilderCliOperationalProbeDestination(state: BuilderCliOperationalState, family: BuilderCliAddressFamily, target: string): { nodeId: string; address: string | null } {
  if (family === 'ipv4') {
    const resolved = resolveBuilderCliProbeDestination({ graph: state.graph, addressing: state.addressing }, target);
    return { nodeId: resolved.nodeId, address: resolved.address };
  }
  const normalized = target.trim().toLowerCase();
  const normalizedAddress = normalizedIpv6Target(target);
  const matches = new Map<string, { nodeId: string; address: string | null }>();
  for (const node of state.graph.nodes) {
    const interfaces = Object.values(state.ipv6.addressing.segments).flatMap((segment) => segment.interfaces.filter((entry) => entry.nodeId === node.id));
    const matchingInterface = normalizedAddress ? interfaces.find((entry) => normalizeBuilderIpv6(entry.globalAddress) === normalizedAddress) : undefined;
    if (node.id.toLowerCase() === normalized || node.label.toLowerCase() === normalized || matchingInterface) {
      matches.set(node.id, { nodeId: node.id, address: matchingInterface?.globalAddress ?? interfaces[0]?.globalAddress ?? null });
    }
  }
  if (matches.size === 0) throw new BuilderCliCommandError('UNKNOWN_DESTINATION', `Unknown routed IPv6 destination ${JSON.stringify(target)}. Use a Builder node id, unique label, or configured global IPv6 address.`);
  if (matches.size > 1) throw new BuilderCliCommandError('AMBIGUOUS_DESTINATION', `Ambiguous routed IPv6 destination ${JSON.stringify(target)}. Use a unique Builder node id or IPv6 address.`);
  return [...matches.values()][0];
}

function mutationRequiresDevice(command: BuilderCliMutationCommand): boolean {
  return command.target !== 'link';
}

export function executeBuilderCliSessionCommand(input: string, context: BuilderCliSessionExecutionContext): BuilderCliSessionExecutionResult {
  const command = parseBuilderCliSessionCommand(input);
  if (command.verb === 'use') {
    const nextDeviceId = resolveBuilderCliSessionDevice(context.state.graph, command.device);
    const node = nextDeviceId ? context.state.graph.nodes.find((entry) => entry.id === nextDeviceId) : null;
    return {
      command,
      output: nextDeviceId ? `CONTEXT ${nextDeviceId.toUpperCase()} · ${node?.label ?? nextDeviceId} · ${node?.kind.toUpperCase() ?? 'DEVICE'}` : 'CONTEXT GLOBAL · unscoped canonical view',
      nextDeviceId,
      probeResult: null,
    };
  }
  if (command.verb === 'show') {
    return { command, output: formatBuilderCliSessionShow(command, context.state, context.currentDeviceId), nextDeviceId: context.currentDeviceId, probeResult: null };
  }
  if (command.verb === 'ping' || command.verb === 'traceroute') {
    if (!context.runProbe) throw new BuilderCliCommandError('READ_ONLY_CONTEXT', context.activeUnavailableReason ?? 'Active probe commands are unavailable in this terminal context.');
    const sourceId = context.currentDeviceId ?? context.defaultSourceId;
    if (!context.state.graph.nodes.some((node) => node.id === sourceId)) throw new BuilderCliCommandError('UNKNOWN_DESTINATION', `Probe source ${JSON.stringify(sourceId)} no longer exists in the routed graph.`);
    const destination = resolveBuilderCliOperationalProbeDestination(context.state, command.family, command.destination);
    const probeResult = context.runProbe({ kind: command.verb, family: command.family, sourceId, destinationId: destination.nodeId });
    return { command, output: formatProbeResult(probeResult), nextDeviceId: context.currentDeviceId, probeResult };
  }
  if (!context.mutate) throw new BuilderCliCommandError('READ_ONLY_CONTEXT', context.activeUnavailableReason ?? 'Configuration commands are unavailable in this terminal context.');
  if (mutationRequiresDevice(command) && !context.currentDeviceId) {
    throw new BuilderCliCommandError('UNSUPPORTED_SYNTAX', `Command ${command.verb.toUpperCase()} ${command.target.toUpperCase()} requires device context. Run "use <device>" first.`);
  }
  return {
    command,
    output: context.mutate({ command, deviceId: context.currentDeviceId }),
    nextDeviceId: context.currentDeviceId,
    probeResult: null,
  };
}

function probeStatusLabel(value: string): string {
  return value.replaceAll('-', ' ').toUpperCase();
}

function metric(value: number | null, suffix = ''): string {
  return value == null ? '—' : `${value}${suffix}`;
}

export function formatProbeResult(result: BuilderProbeResult): string {
  const source = `${result.sourceNodeId}${result.sourceAddress ? ` · ${result.sourceAddress}` : ''}`;
  const destination = `${result.destinationNodeId}${result.destinationAddress ? ` · ${result.destinationAddress}` : ''}`;
  if (result.kind === 'ping') {
    const attempt = result.attempts.at(-1) ?? null;
    const lines = [`PING ${result.plane} · ${source} → ${destination}`, `RESULT ${result.success ? 'PASS' : 'FAIL'}${attempt ? ` · ${probeStatusLabel(attempt.status)}` : ''}`];
    if (attempt) {
      lines.push(`RTT ${metric(attempt.simulatedRttMs, ' ms')} · PATH MTU ${metric(attempt.pathMtuBytes)} · LOSS ${attempt.pathLossPercent.toFixed(4)}%`);
      if (attempt.requestNodeIds.length) lines.push(`PATH ${attempt.requestNodeIds.join(' → ')}`);
      lines.push(`DETAIL ${attempt.detail}`);
    }
    if (result.natApplied) lines.push(`NAT ${result.natTranslationId ?? 'TRANSLATION APPLIED'}`);
    lines.push(`SUMMARY ${result.summary}`);
    return lines.join('\n');
  }
  const rows = result.attempts.map((attempt) => [String(attempt.ttl), probeStatusLabel(attempt.status), attempt.responderNodeId ?? '*', attempt.responderAddress ?? '—', metric(attempt.simulatedRttMs)]);
  const lines = [`TRACEROUTE ${result.plane} · ${source} → ${destination}`, rows.length ? formatTable(['TTL', 'STATUS', 'RESPONDER', 'ADDRESS', 'RTT MS'], rows) : 'No traceroute attempts produced.', `RESULT ${result.success ? 'PASS' : 'FAIL'}`];
  if (result.natApplied) lines.push(`NAT ${result.natTranslationId ?? 'TRANSLATION APPLIED'}`);
  lines.push(`SUMMARY ${result.summary}`);
  return lines.join('\n');
}

export function builderCliContextLabel(state: BuilderCliOperationalState, deviceId: string | null): string {
  if (!deviceId) return 'GLOBAL';
  const node = state.graph.nodes.find((entry) => entry.id === deviceId);
  return node ? `${node.id.toUpperCase()} · ${node.label}` : deviceId.toUpperCase();
}

export function builderCliInterfaceCountForContext(state: BuilderCliOperationalState, deviceId: string | null): number {
  return deviceId ? interfacesForBuilderNode(state.addressing, deviceId).length : state.core.interfaces.length;
}
