import { deepFreeze } from './bytes.ts';

export const CAPTURE_SIDECAR_SCHEMA = 'hopscotch.capture-sidecar-evidence' as const;
export const CAPTURE_SIDECAR_VERSION = 1 as const;

export type ImportedEvidenceKind = 'traceroute' | 'route-table' | 'interface-snapshot' | 'device-state';
export type ParsedConfigVendor = 'cisco' | 'juniper' | 'frr';

export interface ImportedTracerouteHop {
  readonly hop: number;
  readonly address: string | null;
  readonly rttMs: readonly number[];
  readonly label: string | null;
}

export interface ImportedRouteEntry {
  readonly prefix: string;
  readonly nextHop: string | null;
  readonly interface: string | null;
  readonly metric: number | null;
  readonly protocol: string | null;
}

export interface ImportedInterfaceEntry {
  readonly name: string;
  readonly state: string | null;
  readonly mtu: number | null;
  readonly addresses: readonly string[];
  readonly mac: string | null;
}

export interface ImportedDeviceFact {
  readonly key: string;
  readonly value: string;
}

export type ImportedEvidenceSnapshot =
  | { readonly kind: 'traceroute'; readonly label: string; readonly observedAt: string | null; readonly hops: readonly ImportedTracerouteHop[]; readonly provenance: 'IMPORTED EVIDENCE' }
  | { readonly kind: 'route-table'; readonly label: string; readonly observedAt: string | null; readonly entries: readonly ImportedRouteEntry[]; readonly provenance: 'IMPORTED EVIDENCE' }
  | { readonly kind: 'interface-snapshot'; readonly label: string; readonly observedAt: string | null; readonly interfaces: readonly ImportedInterfaceEntry[]; readonly provenance: 'IMPORTED EVIDENCE' }
  | { readonly kind: 'device-state'; readonly label: string; readonly observedAt: string | null; readonly facts: readonly ImportedDeviceFact[]; readonly provenance: 'IMPORTED EVIDENCE' };

export interface CaptureSidecarEvidenceDocument {
  readonly schema: typeof CAPTURE_SIDECAR_SCHEMA;
  readonly version: typeof CAPTURE_SIDECAR_VERSION;
  readonly sourceLabel: string;
  readonly snapshots: readonly ImportedEvidenceSnapshot[];
  readonly provenance: 'IMPORTED EVIDENCE';
}

export interface ParsedConfigFact {
  readonly id: string;
  readonly vendor: ParsedConfigVendor;
  readonly lineNumber: number;
  readonly category: 'interface' | 'address' | 'route' | 'ospf' | 'bgp' | 'vlan' | 'policy' | 'nat' | 'state' | 'other';
  readonly scope: string | null;
  readonly key: string;
  readonly value: string;
  readonly rawLine: string;
  readonly provenance: 'PARSED CONFIG';
}

export interface ParsedNetworkConfiguration {
  readonly vendor: ParsedConfigVendor;
  readonly facts: readonly ParsedConfigFact[];
  readonly sourceLineCount: number;
  readonly ignoredLineCount: number;
  readonly provenance: 'PARSED CONFIG';
  readonly boundary: string;
}

const MAX_SNAPSHOTS = 64;
const MAX_ROWS = 4096;
const MAX_STRING = 2048;
const MAX_CONFIG_BYTES = 2 * 1024 * 1024;
const MAX_CONFIG_LINES = 20_000;
const MAX_CONFIG_FACTS = 10_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown, label: string, nullable = false): string | null {
  if (value === null && nullable) return null;
  if (typeof value !== 'string') throw new Error(`${label} must be a string${nullable ? ' or null' : ''}.`);
  const normalized = value.trim();
  if (!normalized && !nullable) throw new Error(`${label} cannot be empty.`);
  if (normalized.length > MAX_STRING) throw new Error(`${label} exceeds the ${MAX_STRING}-character evidence ceiling.`);
  return normalized || null;
}

function finiteNumber(value: unknown, label: string, nullable = false): number | null {
  if (value === null && nullable) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${label} must be a finite number${nullable ? ' or null' : ''}.`);
  return value;
}

function integerValue(value: unknown, label: string, minimum = 0): number {
  const number = finiteNumber(value, label);
  if (number === null || !Number.isSafeInteger(number) || number < minimum) throw new Error(`${label} must be an integer ≥ ${minimum}.`);
  return number;
}

function rowArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  if (value.length > MAX_ROWS) throw new Error(`${label} exceeds the ${MAX_ROWS.toLocaleString()}-row evidence ceiling.`);
  return value;
}

function observedAt(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  return stringValue(value, 'observedAt', true);
}

function normalizeSnapshot(value: unknown, index: number): ImportedEvidenceSnapshot {
  if (!isRecord(value)) throw new Error(`snapshots[${index}] must be an object.`);
  const kind = value.kind;
  const label = stringValue(value.label ?? String(kind ?? ''), `snapshots[${index}].label`) as string;
  const time = observedAt(value.observedAt);
  if (kind === 'traceroute') {
    const hops = rowArray(value.hops, `snapshots[${index}].hops`).map((hop, hopIndex) => {
      if (!isRecord(hop)) throw new Error(`traceroute hop ${hopIndex} must be an object.`);
      return deepFreeze({
        hop: integerValue(hop.hop, `hop ${hopIndex}.hop`, 1),
        address: stringValue(hop.address, `hop ${hopIndex}.address`, true),
        rttMs: rowArray(hop.rttMs ?? [], `hop ${hopIndex}.rttMs`).map((entry, rttIndex) => finiteNumber(entry, `hop ${hopIndex}.rttMs[${rttIndex}]`) as number),
        label: stringValue(hop.label ?? null, `hop ${hopIndex}.label`, true),
      });
    });
    return deepFreeze({ kind, label, observedAt: time, hops, provenance: 'IMPORTED EVIDENCE' });
  }
  if (kind === 'route-table') {
    const entries = rowArray(value.entries, `snapshots[${index}].entries`).map((entry, entryIndex) => {
      if (!isRecord(entry)) throw new Error(`route entry ${entryIndex} must be an object.`);
      return deepFreeze({
        prefix: stringValue(entry.prefix, `route ${entryIndex}.prefix`) as string,
        nextHop: stringValue(entry.nextHop ?? null, `route ${entryIndex}.nextHop`, true),
        interface: stringValue(entry.interface ?? null, `route ${entryIndex}.interface`, true),
        metric: finiteNumber(entry.metric ?? null, `route ${entryIndex}.metric`, true),
        protocol: stringValue(entry.protocol ?? null, `route ${entryIndex}.protocol`, true),
      });
    });
    return deepFreeze({ kind, label, observedAt: time, entries, provenance: 'IMPORTED EVIDENCE' });
  }
  if (kind === 'interface-snapshot') {
    const interfaces = rowArray(value.interfaces, `snapshots[${index}].interfaces`).map((entry, entryIndex) => {
      if (!isRecord(entry)) throw new Error(`interface ${entryIndex} must be an object.`);
      return deepFreeze({
        name: stringValue(entry.name, `interface ${entryIndex}.name`) as string,
        state: stringValue(entry.state ?? null, `interface ${entryIndex}.state`, true),
        mtu: finiteNumber(entry.mtu ?? null, `interface ${entryIndex}.mtu`, true),
        addresses: rowArray(entry.addresses ?? [], `interface ${entryIndex}.addresses`).map((address, addressIndex) => stringValue(address, `interface ${entryIndex}.addresses[${addressIndex}]`) as string),
        mac: stringValue(entry.mac ?? null, `interface ${entryIndex}.mac`, true),
      });
    });
    return deepFreeze({ kind, label, observedAt: time, interfaces, provenance: 'IMPORTED EVIDENCE' });
  }
  if (kind === 'device-state') {
    const facts = rowArray(value.facts, `snapshots[${index}].facts`).map((entry, entryIndex) => {
      if (!isRecord(entry)) throw new Error(`device fact ${entryIndex} must be an object.`);
      return deepFreeze({ key: stringValue(entry.key, `fact ${entryIndex}.key`) as string, value: stringValue(entry.value, `fact ${entryIndex}.value`) as string });
    });
    return deepFreeze({ kind, label, observedAt: time, facts, provenance: 'IMPORTED EVIDENCE' });
  }
  throw new Error(`Unsupported capture sidecar snapshot kind: ${String(kind)}.`);
}

export function parseCaptureSidecarEvidenceJson(json: string): CaptureSidecarEvidenceDocument {
  let value: unknown;
  try { value = JSON.parse(json); } catch { throw new Error('Capture sidecar evidence is not valid JSON.'); }
  if (!isRecord(value)) throw new Error('Capture sidecar evidence must be a JSON object.');
  if (value.schema !== CAPTURE_SIDECAR_SCHEMA || value.version !== CAPTURE_SIDECAR_VERSION) throw new Error('Unsupported capture sidecar evidence schema/version.');
  const snapshots = rowArray(value.snapshots, 'snapshots');
  if (snapshots.length > MAX_SNAPSHOTS) throw new Error(`Capture sidecar evidence exceeds the ${MAX_SNAPSHOTS}-snapshot ceiling.`);
  return deepFreeze({
    schema: CAPTURE_SIDECAR_SCHEMA,
    version: CAPTURE_SIDECAR_VERSION,
    sourceLabel: stringValue(value.sourceLabel, 'sourceLabel') as string,
    snapshots: snapshots.map(normalizeSnapshot),
    provenance: 'IMPORTED EVIDENCE',
  });
}

function fact(vendor: ParsedConfigVendor, lineNumber: number, category: ParsedConfigFact['category'], scope: string | null, key: string, value: string, rawLine: string): ParsedConfigFact {
  return deepFreeze({ id: `${vendor}:${lineNumber}:${category}:${key}`, vendor, lineNumber, category, scope, key, value, rawLine, provenance: 'PARSED CONFIG' });
}

function parseCiscoOrFrrLine(vendor: 'cisco' | 'frr', line: string, lineNumber: number, scope: { interfaceName: string | null; router: string | null }): ParsedConfigFact[] {
  const trimmed = line.trim();
  const result: ParsedConfigFact[] = [];
  const interfaceMatch = /^interface\s+(.+)$/i.exec(trimmed);
  if (interfaceMatch) {
    scope.interfaceName = interfaceMatch[1]?.trim() ?? null;
    scope.router = null;
    result.push(fact(vendor, lineNumber, 'interface', scope.interfaceName, 'interface', scope.interfaceName ?? '', trimmed));
    return result;
  }
  const routerMatch = /^router\s+(ospf|bgp)\s*(.*)$/i.exec(trimmed);
  if (routerMatch) {
    scope.router = `${routerMatch[1]?.toLowerCase()} ${routerMatch[2]?.trim() ?? ''}`.trim();
    scope.interfaceName = null;
    result.push(fact(vendor, lineNumber, routerMatch[1]?.toLowerCase() === 'bgp' ? 'bgp' : 'ospf', scope.router, 'router', scope.router, trimmed));
    return result;
  }
  if (/^(exit|end|!)$/i.test(trimmed)) { if (/^(exit|end)$/i.test(trimmed)) { scope.interfaceName = null; scope.router = null; } return result; }
  const ipAddress = /^ip\s+address\s+(.+)$/i.exec(trimmed);
  const ipv6Address = /^ipv6\s+address\s+(.+)$/i.exec(trimmed);
  if (scope.interfaceName && (ipAddress || ipv6Address)) result.push(fact(vendor, lineNumber, 'address', scope.interfaceName, ipAddress ? 'ipv4-address' : 'ipv6-address', (ipAddress ?? ipv6Address)?.[1]?.trim() ?? '', trimmed));
  else if (scope.interfaceName && /^shutdown$/i.test(trimmed)) result.push(fact(vendor, lineNumber, 'state', scope.interfaceName, 'shutdown', 'true', trimmed));
  else if (scope.interfaceName && /^description\s+(.+)$/i.test(trimmed)) result.push(fact(vendor, lineNumber, 'interface', scope.interfaceName, 'description', trimmed.replace(/^description\s+/i, ''), trimmed));
  else if (scope.interfaceName && /^switchport\s+access\s+vlan\s+(.+)$/i.test(trimmed)) result.push(fact(vendor, lineNumber, 'vlan', scope.interfaceName, 'access-vlan', trimmed.replace(/^switchport\s+access\s+vlan\s+/i, ''), trimmed));
  else if (scope.interfaceName && /^switchport\s+trunk\s+allowed\s+vlan\s+(.+)$/i.test(trimmed)) result.push(fact(vendor, lineNumber, 'vlan', scope.interfaceName, 'trunk-vlans', trimmed.replace(/^switchport\s+trunk\s+allowed\s+vlan\s+/i, ''), trimmed));
  else if (/^ip\s+route\s+|^ipv6\s+route\s+/i.test(trimmed)) result.push(fact(vendor, lineNumber, 'route', null, 'static-route', trimmed, trimmed));
  else if (scope.router?.startsWith('ospf')) result.push(fact(vendor, lineNumber, 'ospf', scope.router, 'statement', trimmed, trimmed));
  else if (scope.router?.startsWith('bgp')) result.push(fact(vendor, lineNumber, 'bgp', scope.router, 'statement', trimmed, trimmed));
  else if (/^(access-list|ip\s+access-list|ipv6\s+access-list)\b/i.test(trimmed)) result.push(fact(vendor, lineNumber, 'policy', null, 'acl', trimmed, trimmed));
  else if (/^ip\s+nat\b/i.test(trimmed)) result.push(fact(vendor, lineNumber, 'nat', scope.interfaceName, 'nat', trimmed, trimmed));
  else if (/^vlan\s+\d+/i.test(trimmed)) result.push(fact(vendor, lineNumber, 'vlan', null, 'vlan', trimmed, trimmed));
  return result;
}

function parseJuniperLine(line: string, lineNumber: number): ParsedConfigFact[] {
  const trimmed = line.trim();
  if (!/^set\s+/i.test(trimmed)) return [];
  let match = /^set\s+interfaces\s+(\S+)\s+(.+)$/i.exec(trimmed);
  if (match) {
    const name = match[1] ?? '';
    const body = match[2] ?? '';
    if (/\bfamily\s+(inet|inet6)\s+address\s+/i.test(body)) return [fact('juniper', lineNumber, 'address', name, 'address', body.replace(/^.*?\baddress\s+/i, ''), trimmed)];
    if (/\bdisable\b/i.test(body)) return [fact('juniper', lineNumber, 'state', name, 'disabled', 'true', trimmed)];
    return [fact('juniper', lineNumber, 'interface', name, 'statement', body, trimmed)];
  }
  match = /^set\s+routing-options\s+static\s+route\s+(.+)$/i.exec(trimmed);
  if (match) return [fact('juniper', lineNumber, 'route', null, 'static-route', match[1] ?? '', trimmed)];
  match = /^set\s+protocols\s+ospf\s+(.+)$/i.exec(trimmed);
  if (match) return [fact('juniper', lineNumber, 'ospf', null, 'statement', match[1] ?? '', trimmed)];
  match = /^set\s+protocols\s+bgp\s+(.+)$/i.exec(trimmed);
  if (match) return [fact('juniper', lineNumber, 'bgp', null, 'statement', match[1] ?? '', trimmed)];
  match = /^set\s+vlans\s+(.+)$/i.exec(trimmed);
  if (match) return [fact('juniper', lineNumber, 'vlan', null, 'statement', match[1] ?? '', trimmed)];
  match = /^set\s+firewall\s+(.+)$/i.exec(trimmed);
  if (match) return [fact('juniper', lineNumber, 'policy', null, 'firewall', match[1] ?? '', trimmed)];
  match = /^set\s+security\s+nat\s+(.+)$/i.exec(trimmed);
  if (match) return [fact('juniper', lineNumber, 'nat', null, 'nat', match[1] ?? '', trimmed)];
  return [];
}

export function parseNetworkConfiguration(text: string, vendor: ParsedConfigVendor): ParsedNetworkConfiguration {
  const byteLength = new TextEncoder().encode(text).length;
  if (byteLength > MAX_CONFIG_BYTES) throw new Error(`Configuration exceeds the ${MAX_CONFIG_BYTES / (1024 * 1024)} MiB parsed-config ceiling.`);
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  if (lines.length > MAX_CONFIG_LINES) throw new Error(`Configuration exceeds the ${MAX_CONFIG_LINES.toLocaleString()}-line parsed-config ceiling.`);
  const facts: ParsedConfigFact[] = [];
  const scope = { interfaceName: null as string | null, router: null as string | null };
  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index] ?? '';
    const parsed = vendor === 'juniper' ? parseJuniperLine(rawLine, index + 1) : parseCiscoOrFrrLine(vendor, rawLine, index + 1, scope);
    facts.push(...parsed);
    if (facts.length > MAX_CONFIG_FACTS) throw new Error(`Parsed configuration exceeds the ${MAX_CONFIG_FACTS.toLocaleString()}-fact ceiling.`);
  }
  return deepFreeze({
    vendor,
    facts,
    sourceLineCount: lines.length,
    ignoredLineCount: Math.max(0, lines.filter((line) => line.trim()).length - facts.length),
    provenance: 'PARSED CONFIG',
    boundary: 'Parsed configuration facts come only from explicit supported text statements. They are not runtime state, proof that the configuration was applied, or evidence that the device was reachable.',
  });
}
