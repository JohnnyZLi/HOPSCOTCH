import { interfacesForBuilderNode, type BuilderAddressing } from './addressing.ts';
import type { BuilderArpCacheEntry } from './arp.ts';
import type { BuilderEthernetFdbEntry, BuilderEthernetFlowResult } from './ethernet.ts';
import type { BuilderGraph } from './model.ts';
import type { BuilderProbeKind, BuilderProbeResult } from './probes.ts';
import { routeTableForBuilderRouter, type BuilderRouteTableEntry, type BuilderRoutingConfig } from './routing.ts';

export const BUILDER_CLI_SHOW_TARGETS = Object.freeze(['interfaces', 'route', 'arp', 'mac'] as const);
export const BUILDER_CLI_PROBE_VERBS = Object.freeze(['ping', 'traceroute'] as const);

export type BuilderCliShowTarget = (typeof BUILDER_CLI_SHOW_TARGETS)[number];
export type BuilderCliProbeVerb = (typeof BUILDER_CLI_PROBE_VERBS)[number];

export interface BuilderCliShowCommand {
  readonly verb: 'show';
  readonly target: BuilderCliShowTarget;
}

export interface BuilderCliProbeCommand {
  readonly verb: BuilderCliProbeVerb;
  readonly destination: string;
}

export type BuilderCliCommand = BuilderCliShowCommand | BuilderCliProbeCommand;

export type BuilderCliCommandErrorCode =
  | 'EMPTY_COMMAND'
  | 'AMBIGUOUS_COMMAND'
  | 'UNSUPPORTED_COMMAND'
  | 'UNSUPPORTED_SYNTAX'
  | 'EXECUTION_REQUIRED'
  | 'READ_ONLY_CONTEXT'
  | 'UNKNOWN_DESTINATION'
  | 'AMBIGUOUS_DESTINATION';

export class BuilderCliCommandError extends Error {
  readonly code: BuilderCliCommandErrorCode;

  constructor(code: BuilderCliCommandErrorCode, message: string) {
    super(message);
    this.name = 'BuilderCliCommandError';
    this.code = code;
  }
}

export interface BuilderCliInterfaceFact {
  readonly deviceId: string;
  readonly interfaceName: string;
  readonly address: string | null;
  readonly linkState: string;
  readonly protocolState: string;
}

export type BuilderCliRouteFact = Readonly<Pick<BuilderRouteTableEntry,
  | 'id'
  | 'routerId'
  | 'prefix'
  | 'prefixLength'
  | 'source'
  | 'administrativeDistance'
  | 'metric'
  | 'nextHop'
  | 'outgoingInterface'
  | 'active'
  | 'stateNote'
>>;

export type BuilderCliArpFact = Readonly<BuilderArpCacheEntry>;
export type BuilderCliMacFact = Readonly<BuilderEthernetFdbEntry>;

export interface BuilderCliState {
  readonly interfaces: readonly BuilderCliInterfaceFact[];
  readonly routes: readonly BuilderCliRouteFact[];
  readonly arpEntries: readonly BuilderCliArpFact[];
  readonly macEntries: readonly BuilderCliMacFact[];
}

export interface BuilderCliProjectionInput {
  readonly graph: BuilderGraph;
  readonly addressing: BuilderAddressing;
  readonly routing: BuilderRoutingConfig;
  readonly truthGraphs?: { readonly ribGraph: BuilderGraph } | null;
  readonly arpCache: readonly BuilderArpCacheEntry[];
  readonly ethernetFlow: Readonly<Pick<BuilderEthernetFlowResult, 'fdb'>> | null;
}

export interface BuilderCliProbeDestinationInput {
  readonly graph: BuilderGraph;
  readonly addressing: BuilderAddressing;
}

export interface BuilderCliResolvedDestination {
  readonly nodeId: string;
  readonly label: string;
  readonly address: string | null;
}

export interface BuilderCliExecutionContext {
  readonly state: BuilderCliState;
  readonly runProbe?: (command: BuilderCliProbeCommand) => BuilderProbeResult;
  readonly probeUnavailableReason?: string;
}

export interface BuilderCliExecutionResult {
  readonly command: BuilderCliCommand;
  readonly output: string;
  readonly probeResult: BuilderProbeResult | null;
}

function commandLabel(input: string): string {
  return JSON.stringify(input.trim());
}

export function parseBuilderCliCommand(input: string): BuilderCliCommand {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new BuilderCliCommandError('EMPTY_COMMAND', 'Unsupported command: the command is empty.');
  }

  const tokens = trimmed.split(/\s+/);
  const verb = tokens[0].toLowerCase();
  if (verb === 'show') {
    if (tokens.length === 1) {
      throw new BuilderCliCommandError(
        'AMBIGUOUS_COMMAND',
        `Ambiguous command ${commandLabel(input)}. Specify one of: ${BUILDER_CLI_SHOW_TARGETS.join(', ')}.`,
      );
    }
    if (tokens.length !== 2) {
      throw new BuilderCliCommandError(
        'UNSUPPORTED_SYNTAX',
        `Unsupported syntax ${commandLabel(input)}. Expected exactly "show <target>".`,
      );
    }
    const target = tokens[1].toLowerCase();
    if (!BUILDER_CLI_SHOW_TARGETS.some((candidate) => candidate === target)) {
      throw new BuilderCliCommandError(
        'UNSUPPORTED_COMMAND',
        `Unsupported show target ${JSON.stringify(tokens[1])}. Supported targets: ${BUILDER_CLI_SHOW_TARGETS.join(', ')}.`,
      );
    }
    return Object.freeze({ verb: 'show', target }) as BuilderCliShowCommand;
  }

  if (BUILDER_CLI_PROBE_VERBS.some((candidate) => candidate === verb)) {
    if (tokens.length === 1) {
      throw new BuilderCliCommandError(
        'AMBIGUOUS_COMMAND',
        `Ambiguous command ${commandLabel(input)}. Specify one routed destination by node id, label, or IPv4 address.`,
      );
    }
    if (tokens.length !== 2) {
      throw new BuilderCliCommandError(
        'UNSUPPORTED_SYNTAX',
        `Unsupported syntax ${commandLabel(input)}. Expected exactly "${verb} <destination>".`,
      );
    }
    return Object.freeze({ verb: verb as BuilderCliProbeVerb, destination: tokens[1] });
  }

  throw new BuilderCliCommandError(
    'UNSUPPORTED_COMMAND',
    `Unsupported command ${commandLabel(input)}. Supported verbs: show, ping, traceroute.`,
  );
}

function linkState(graph: BuilderGraph, linkId: string): 'UP' | 'DOWN' | 'UNKNOWN' {
  const link = graph.links.find((candidate) => candidate.id === linkId);
  return !link ? 'UNKNOWN' : link.failed ? 'DOWN' : 'UP';
}

export function projectBuilderCliState(input: BuilderCliProjectionInput): BuilderCliState {
  const ribGraph = input.truthGraphs?.ribGraph ?? input.graph;
  const interfaces = input.graph.nodes.flatMap((node) => interfacesForBuilderNode(input.addressing, node.id).map((entry) => {
    const physicalState = linkState(input.graph, entry.linkId);
    return {
      deviceId: node.id,
      interfaceName: entry.name,
      address: entry.address,
      linkState: physicalState,
      protocolState: physicalState === 'UP' ? 'UP' : 'DOWN',
    } satisfies BuilderCliInterfaceFact;
  }));
  const routes = ribGraph.nodes
    .filter((node) => node.kind === 'router')
    .flatMap((node) => routeTableForBuilderRouter(ribGraph, input.addressing, input.routing, node.id));
  return {
    interfaces,
    routes,
    arpEntries: input.arpCache.map((entry) => ({ ...entry })),
    macEntries: (input.ethernetFlow?.fdb ?? []).map((entry) => ({ ...entry })),
  };
}

function addressOnly(value: string): string {
  return value.trim().toLowerCase().split('/')[0] ?? value.trim().toLowerCase();
}

export function resolveBuilderCliProbeDestination(input: BuilderCliProbeDestinationInput, target: string): BuilderCliResolvedDestination {
  const normalized = target.trim().toLowerCase();
  const normalizedAddress = addressOnly(target);
  const matches = new Map<string, BuilderCliResolvedDestination>();

  for (const node of input.graph.nodes) {
    const interfaces = interfacesForBuilderNode(input.addressing, node.id);
    const matchingInterface = interfaces.find((entry) => addressOnly(entry.address) === normalizedAddress);
    if (node.id.toLowerCase() === normalized || node.label.toLowerCase() === normalized || matchingInterface) {
      matches.set(node.id, {
        nodeId: node.id,
        label: node.label,
        address: matchingInterface?.address ?? interfaces[0]?.address ?? null,
      });
    }
  }

  if (matches.size === 0) {
    throw new BuilderCliCommandError(
      'UNKNOWN_DESTINATION',
      `Unknown routed destination ${JSON.stringify(target)}. Use a Builder node id, unique label, or configured IPv4 address.`,
    );
  }
  if (matches.size > 1) {
    throw new BuilderCliCommandError(
      'AMBIGUOUS_DESTINATION',
      `Ambiguous routed destination ${JSON.stringify(target)}. Use a unique Builder node id or IPv4 address.`,
    );
  }
  return [...matches.values()][0];
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function firstDifference(...comparisons: number[]): number {
  return comparisons.find((comparison) => comparison !== 0) ?? 0;
}

function displayNullable(value: string | null): string {
  return value ?? '—';
}

function formatTable(headers: readonly string[], rows: readonly (readonly string[])[]): string {
  const widths = headers.map((header, columnIndex) => Math.max(
    header.length,
    ...rows.map((row) => (row[columnIndex] ?? '').length),
  ));
  return [headers, ...rows]
    .map((row) => row.map((cell, columnIndex) => cell.padEnd(widths[columnIndex] ?? cell.length)).join('  ').trimEnd())
    .join('\n');
}

function formatInterfaces(state: BuilderCliState): string {
  if (state.interfaces.length === 0) return 'No interface facts supplied.';
  const rows = [...state.interfaces]
    .sort((left, right) => firstDifference(
      compareText(left.deviceId, right.deviceId),
      compareText(left.interfaceName, right.interfaceName),
      compareText(displayNullable(left.address), displayNullable(right.address)),
      compareText(left.linkState, right.linkState),
      compareText(left.protocolState, right.protocolState),
    ))
    .map((entry) => [entry.deviceId, entry.interfaceName, displayNullable(entry.address), entry.linkState, entry.protocolState]);
  return formatTable(['DEVICE', 'INTERFACE', 'ADDRESS', 'LINK', 'PROTOCOL'], rows);
}

function formatRoutes(state: BuilderCliState): string {
  if (state.routes.length === 0) return 'No route facts supplied.';
  const rows = [...state.routes]
    .sort((left, right) => firstDifference(
      compareText(left.routerId, right.routerId),
      right.prefixLength - left.prefixLength,
      compareText(left.prefix, right.prefix),
      left.administrativeDistance - right.administrativeDistance,
      left.metric - right.metric,
      compareText(left.source, right.source),
      compareText(displayNullable(left.nextHop), displayNullable(right.nextHop)),
      compareText(left.outgoingInterface, right.outgoingInterface),
      Number(right.active) - Number(left.active),
      compareText(left.stateNote, right.stateNote),
      compareText(left.id, right.id),
    ))
    .map((entry) => [
      entry.routerId,
      entry.prefix,
      entry.source,
      String(entry.administrativeDistance),
      String(entry.metric),
      displayNullable(entry.nextHop),
      entry.outgoingInterface,
      entry.active ? 'ACTIVE' : 'INACTIVE',
      entry.stateNote,
    ]);
  return formatTable(['DEVICE', 'PREFIX', 'SOURCE', 'AD', 'METRIC', 'NEXT HOP', 'INTERFACE', 'STATE', 'DETAIL'], rows);
}

function formatArp(state: BuilderCliState): string {
  if (state.arpEntries.length === 0) return 'No ARP facts supplied.';
  const rows = [...state.arpEntries]
    .sort((left, right) => firstDifference(
      compareText(left.ownerDeviceId, right.ownerDeviceId),
      left.vlanId - right.vlanId,
      compareText(left.address, right.address),
      compareText(left.mac, right.mac),
      compareText(left.learnedFromDeviceId, right.learnedFromDeviceId),
    ))
    .map((entry) => [entry.ownerDeviceId, String(entry.vlanId), entry.address, entry.mac, entry.learnedFromDeviceId]);
  return formatTable(['DEVICE', 'VLAN', 'ADDRESS', 'MAC', 'LEARNED FROM'], rows);
}

function formatMac(state: BuilderCliState): string {
  if (state.macEntries.length === 0) return 'No MAC facts supplied.';
  const rows = [...state.macEntries]
    .sort((left, right) => firstDifference(
      compareText(left.switchId, right.switchId),
      left.vlanId - right.vlanId,
      compareText(left.mac, right.mac),
      compareText(left.linkId, right.linkId),
      compareText(left.learnedFrom, right.learnedFrom),
    ))
    .map((entry) => [entry.switchId, String(entry.vlanId), entry.mac, entry.linkId, entry.learnedFrom]);
  return formatTable(['SWITCH', 'VLAN', 'MAC', 'PORT', 'LEARNED FROM'], rows);
}

export function formatBuilderCliCommand(command: BuilderCliShowCommand, state: BuilderCliState): string {
  switch (command.target) {
    case 'interfaces': return formatInterfaces(state);
    case 'route': return formatRoutes(state);
    case 'arp': return formatArp(state);
    case 'mac': return formatMac(state);
  }
}

function probeStatusLabel(value: string): string {
  return value.replaceAll('-', ' ').toUpperCase();
}

function formatProbeMetric(value: number | null, suffix = ''): string {
  return value == null ? '—' : `${value}${suffix}`;
}

export function formatBuilderCliProbeResult(result: BuilderProbeResult): string {
  const source = `${result.sourceNodeId}${result.sourceAddress ? ` · ${result.sourceAddress}` : ''}`;
  const destination = `${result.destinationNodeId}${result.destinationAddress ? ` · ${result.destinationAddress}` : ''}`;
  if (result.kind === 'ping') {
    const attempt = result.attempts.at(-1) ?? null;
    const lines = [
      `PING · ${source} → ${destination}`,
      `RESULT ${result.success ? 'PASS' : 'FAIL'}${attempt ? ` · ${probeStatusLabel(attempt.status)}` : ''}`,
    ];
    if (attempt) {
      lines.push(`RTT ${formatProbeMetric(attempt.simulatedRttMs, ' ms')} · PATH MTU ${formatProbeMetric(attempt.pathMtuBytes)} · LOSS ${attempt.pathLossPercent.toFixed(4)}%`);
      if (attempt.requestNodeIds.length > 0) lines.push(`PATH ${attempt.requestNodeIds.join(' → ')}`);
      lines.push(`DETAIL ${attempt.detail}`);
    }
    if (result.natApplied) lines.push(`NAT ${result.natTranslationId ?? 'TRANSLATION APPLIED'}`);
    lines.push(`SUMMARY ${result.summary}`);
    return lines.join('\n');
  }

  const rows = result.attempts.map((attempt) => [
    String(attempt.ttl),
    probeStatusLabel(attempt.status),
    attempt.responderNodeId ?? '*',
    attempt.responderAddress ?? '—',
    formatProbeMetric(attempt.simulatedRttMs),
  ]);
  const lines = [
    `TRACEROUTE · ${source} → ${destination}`,
    rows.length > 0 ? formatTable(['TTL', 'STATUS', 'RESPONDER', 'ADDRESS', 'RTT MS'], rows) : 'No traceroute attempts produced.',
    `RESULT ${result.success ? 'PASS' : 'FAIL'}`,
  ];
  if (result.natApplied) lines.push(`NAT ${result.natTranslationId ?? 'TRANSLATION APPLIED'}`);
  lines.push(`SUMMARY ${result.summary}`);
  return lines.join('\n');
}

export function projectBuilderCliCommand(input: string, state: BuilderCliState): string {
  const command = parseBuilderCliCommand(input);
  if (command.verb !== 'show') {
    throw new BuilderCliCommandError(
      'EXECUTION_REQUIRED',
      `${command.verb.toUpperCase()} is an active probe command and must run through the Builder probe engine.`,
    );
  }
  return formatBuilderCliCommand(command, state);
}

export function executeBuilderCliCommand(input: string, context: BuilderCliExecutionContext): BuilderCliExecutionResult {
  const command = parseBuilderCliCommand(input);
  if (command.verb === 'show') {
    return { command, output: formatBuilderCliCommand(command, context.state), probeResult: null };
  }
  if (!context.runProbe) {
    throw new BuilderCliCommandError(
      'READ_ONLY_CONTEXT',
      context.probeUnavailableReason ?? 'Active probe commands are unavailable in this terminal context.',
    );
  }
  const probeResult = context.runProbe(command);
  return { command, output: formatBuilderCliProbeResult(probeResult), probeResult };
}
