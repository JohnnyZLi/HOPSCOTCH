import type { BuilderArpCacheEntry } from './arp.ts';
import type { BuilderEthernetFdbEntry } from './ethernet.ts';
import type { BuilderRouteTableEntry } from './routing.ts';

export const BUILDER_CLI_SHOW_TARGETS = Object.freeze(['interfaces', 'route', 'arp', 'mac'] as const);

export type BuilderCliShowTarget = (typeof BUILDER_CLI_SHOW_TARGETS)[number];

export interface BuilderCliCommand {
  readonly verb: 'show';
  readonly target: BuilderCliShowTarget;
}

export type BuilderCliCommandErrorCode =
  | 'EMPTY_COMMAND'
  | 'AMBIGUOUS_COMMAND'
  | 'UNSUPPORTED_COMMAND'
  | 'UNSUPPORTED_SYNTAX';

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

function commandLabel(input: string): string {
  return JSON.stringify(input.trim());
}

export function parseBuilderCliCommand(input: string): BuilderCliCommand {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new BuilderCliCommandError('EMPTY_COMMAND', 'Unsupported command: the command is empty.');
  }

  const tokens = trimmed.split(/\s+/);
  if (tokens[0].toLowerCase() !== 'show') {
    throw new BuilderCliCommandError(
      'UNSUPPORTED_COMMAND',
      `Unsupported command ${commandLabel(input)}. This read-only slice accepts only explicit show commands.`,
    );
  }

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

  return Object.freeze({ verb: 'show', target }) as BuilderCliCommand;
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

export function formatBuilderCliCommand(command: BuilderCliCommand, state: BuilderCliState): string {
  switch (command.target) {
    case 'interfaces': return formatInterfaces(state);
    case 'route': return formatRoutes(state);
    case 'arp': return formatArp(state);
    case 'mac': return formatMac(state);
  }
}

export function projectBuilderCliCommand(input: string, state: BuilderCliState): string {
  return formatBuilderCliCommand(parseBuilderCliCommand(input), state);
}
