import type { EvidenceAvailability } from '../internet/evidence.ts';
import {
  parseNativeMeasurementSnapshot,
  type NativeMeasurementFact,
  type NativeMeasurementPlatform,
  type NativeMeasurementSnapshot,
  type NativeMeasurementTarget,
  type NativeMeasurementUnit,
  type NativeMeasurementValue,
} from './native.ts';
import { projectMeasuredSnapshot, type MeasuredSnapshotState } from './state.ts';

export interface NetworkDiagnosticsIngestion {
  snapshot: NativeMeasurementSnapshot;
  state: MeasuredSnapshotState;
  skippedSections: readonly string[];
}

interface ParsedRun {
  id: string;
  platform: string;
  profile: 'connection-check' | 'quick' | 'standard' | 'extended';
  transferMethod: 'compare' | 'single' | 'aggregate';
  startedAt: string;
  completedAt: string;
  includesLocalAddresses: boolean;
}

interface ParsedReport {
  root: Record<string, unknown>;
  generatedAt: string;
  run: ParsedRun;
  producer: Record<string, unknown> | null;
}

const PROFILE_VALUES = new Set<ParsedRun['profile']>(['connection-check', 'quick', 'standard', 'extended']);
const TRANSFER_VALUES = new Set<ParsedRun['transferMethod']>(['compare', 'single', 'aggregate']);
const KNOWN_ROOT_SECTIONS = new Set([
  'schemaVersion',
  'generatedAt',
  'producer',
  'run',
  'transferPlan',
  'internetTransfer',
  'deepDiagnostics',
  'localLink',
  'measurement',
  'findings',
  'browserEvidence',
  'loadLocalization',
  'dualStack',
  'networkChange',
  'hostResources',
  'annotations',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`${label} must be an object.`);
  return value;
}

function optionalRecord(value: unknown, label: string): Record<string, unknown> | null {
  if (value === undefined || value === null) return null;
  if (!isRecord(value)) throw new Error(`${label} must be an object when present.`);
  return value;
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`${label} must be a non-empty string.`);
  return value.trim();
}

function optionalString(value: unknown, label: string): string | null {
  if (value === undefined || value === null) return null;
  return requiredString(value, label);
}

function optionalFiniteNumber(value: unknown, label: string): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${label} must be a finite number when present.`);
  return value;
}

function optionalBoolean(value: unknown, label: string): boolean | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'boolean') throw new Error(`${label} must be boolean when present.`);
  return value;
}

function optionalArray(value: unknown, label: string): unknown[] | null {
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value)) throw new Error(`${label} must be an array when present.`);
  return value;
}

function parseTimestamp(value: unknown, label: string): string {
  const timestamp = requiredString(value, label);
  if (Number.isNaN(Date.parse(timestamp))) throw new Error(`${label} must be an ISO-compatible timestamp.`);
  return timestamp;
}

function parseReport(value: unknown): ParsedReport {
  const root = requiredRecord(value, 'Network Diagnostics report');
  if (root.schemaVersion !== '2.0') throw new Error('Network Diagnostics report schemaVersion must be 2.0.');
  const generatedAt = parseTimestamp(root.generatedAt, 'generatedAt');
  const runRecord = requiredRecord(root.run, 'run');
  const profile = requiredString(runRecord.profile, 'run.profile') as ParsedRun['profile'];
  const transferMethod = requiredString(runRecord.transferMethod, 'run.transferMethod') as ParsedRun['transferMethod'];
  if (!PROFILE_VALUES.has(profile)) throw new Error('run.profile is unsupported.');
  if (!TRANSFER_VALUES.has(transferMethod)) throw new Error('run.transferMethod is unsupported.');
  const startedAt = parseTimestamp(runRecord.startedAt, 'run.startedAt');
  const completedAt = parseTimestamp(runRecord.completedAt, 'run.completedAt');
  if (Date.parse(completedAt) < Date.parse(startedAt)) throw new Error('run.completedAt must not precede run.startedAt.');
  if (Date.parse(generatedAt) < Date.parse(completedAt)) throw new Error('generatedAt must not precede run.completedAt.');
  const includesLocalAddresses = runRecord.includesLocalAddresses === true;

  return {
    root,
    generatedAt,
    producer: optionalRecord(root.producer, 'producer'),
    run: {
      id: requiredString(runRecord.id, 'run.id'),
      platform: requiredString(runRecord.platform, 'run.platform'),
      profile,
      transferMethod,
      startedAt,
      completedAt,
      includesLocalAddresses,
    },
  };
}

function platformFor(value: string): NativeMeasurementPlatform {
  const normalized = value.toLowerCase();
  if (normalized.includes('windows') || normalized.includes('win32')) return 'windows';
  if (normalized.includes('mac') || normalized.includes('darwin') || normalized.includes('os x')) return 'macos';
  if (normalized.includes('linux')) return 'linux';
  return 'unknown';
}

function target(kind: NativeMeasurementTarget['kind'], value: string | null): NativeMeasurementTarget | null {
  return value === null ? null : { kind, value };
}

function asTargetFromHost(value: unknown): NativeMeasurementTarget | null {
  const host = optionalString(value, 'target host');
  return host === null ? null : target('hostname', host);
}

function serviceTarget(value: unknown): NativeMeasurementTarget | null {
  const service = optionalString(value, 'service target');
  return service === null ? null : target('service', service);
}

function fact(
  id: string,
  category: NativeMeasurementFact['category'],
  subject: string,
  observedAt: string,
  value: NativeMeasurementValue,
  unit: NativeMeasurementUnit | null,
  note: string,
  factTarget: NativeMeasurementTarget | null = null,
  availability: EvidenceAvailability = 'available',
): NativeMeasurementFact {
  return {
    id,
    provenance: 'LOCAL MEASURED',
    category,
    subject,
    availability,
    observedAt,
    target: factTarget,
    value,
    unit,
    note,
  };
}

function safeIdPart(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'item';
}

function pushNumber(
  facts: NativeMeasurementFact[],
  id: string,
  category: NativeMeasurementFact['category'],
  subject: string,
  observedAt: string,
  value: unknown,
  unit: NativeMeasurementUnit,
  note: string,
  factTarget: NativeMeasurementTarget | null = null,
  availability: EvidenceAvailability = 'available',
): void {
  const numberValue = optionalFiniteNumber(value, subject);
  if (numberValue === null) return;
  facts.push(fact(id, category, subject, observedAt, numberValue, unit, note, factTarget, availability));
}

function pushString(
  facts: NativeMeasurementFact[],
  id: string,
  category: NativeMeasurementFact['category'],
  subject: string,
  observedAt: string,
  value: unknown,
  note: string,
  factTarget: NativeMeasurementTarget | null = null,
  availability: EvidenceAvailability = 'available',
): void {
  const stringValue = optionalString(value, subject);
  if (stringValue === null) return;
  facts.push(fact(id, category, subject, observedAt, stringValue, null, note, factTarget, availability));
}

function pushBoolean(
  facts: NativeMeasurementFact[],
  id: string,
  category: NativeMeasurementFact['category'],
  subject: string,
  observedAt: string,
  value: unknown,
  note: string,
  factTarget: NativeMeasurementTarget | null = null,
): void {
  const booleanValue = optionalBoolean(value, subject);
  if (booleanValue === null) return;
  facts.push(fact(id, category, subject, observedAt, booleanValue, null, note, factTarget));
}

function mbpsToBitsPerSecond(value: unknown, label: string): number | null {
  const mbps = optionalFiniteNumber(value, label);
  if (mbps === null) return null;
  if (mbps < 0) throw new Error(`${label} must be non-negative.`);
  return mbps * 1_000_000;
}

function pushMbps(
  facts: NativeMeasurementFact[],
  id: string,
  category: NativeMeasurementFact['category'],
  subject: string,
  observedAt: string,
  value: unknown,
  note: string,
  factTarget: NativeMeasurementTarget | null = null,
): void {
  const bps = mbpsToBitsPerSecond(value, subject);
  if (bps === null) return;
  facts.push(fact(id, category, subject, observedAt, bps, 'bits-per-second', note, factTarget));
}

function mapLatencyStatistics(
  facts: NativeMeasurementFact[],
  prefix: string,
  category: NativeMeasurementFact['category'],
  statsValue: unknown,
  observedAt: string,
  factTarget: NativeMeasurementTarget | null,
  notePrefix: string,
): void {
  if (statsValue === undefined || statsValue === null) return;
  const stats = requiredRecord(statsValue, `${prefix} latency statistics`);
  pushNumber(facts, `${prefix}-sent`, category, `${notePrefix} probes sent`, observedAt, stats.sent, 'count', `${notePrefix}: source-reported sent probe count.`, factTarget);
  pushNumber(facts, `${prefix}-received`, category, `${notePrefix} probes received`, observedAt, stats.received, 'count', `${notePrefix}: source-reported received probe count.`, factTarget);
  pushNumber(facts, `${prefix}-lost`, category, `${notePrefix} probes lost`, observedAt, stats.lost, 'count', `${notePrefix}: source-reported lost probe count.`, factTarget);
  pushNumber(facts, `${prefix}-loss-percent`, category, `${notePrefix} loss percent`, observedAt, stats.lossPercent, 'percent', `${notePrefix}: source-reported packet loss percentage.`, factTarget);
  const received = optionalFiniteNumber(stats.received, `${notePrefix} received`);
  const sent = optionalFiniteNumber(stats.sent, `${notePrefix} sent`);
  const availability: EvidenceAvailability = received === 0 ? 'unavailable' : sent !== null && received !== null && received < sent ? 'partial' : 'available';
  const latencyFields: Array<[string, string, unknown]> = [
    ['minimum', 'minimum latency', stats.minimumMs ?? stats.minMs],
    ['maximum', 'maximum latency', stats.maximumMs ?? stats.maxMs],
    ['mean', 'mean latency', stats.meanMs],
    ['median', 'median latency', stats.medianMs],
    ['p95', 'p95 latency', stats.p95Ms],
    ['jitter', 'jitter', stats.jitterMs],
  ];
  if (availability === 'unavailable') return;
  for (const [suffix, label, value] of latencyFields) {
    pushNumber(facts, `${prefix}-${suffix}-ms`, category, `${notePrefix} ${label}`, observedAt, value, 'ms', `${notePrefix}: source-reported ${label}.`, factTarget, availability);
  }
}

function mapSelectedInterface(facts: NativeMeasurementFact[], measurement: Record<string, unknown> | null, observedAt: string, allowAddresses: boolean): void {
  if (measurement === null) return;
  const selected = optionalRecord(measurement.selectedInterface, 'measurement.selectedInterface');
  if (selected === null) return;
  const name = optionalString(selected.name, 'measurement.selectedInterface.name');
  const id = optionalString(selected.id, 'measurement.selectedInterface.id');
  const interfaceTarget = target('interface', id ?? name);
  pushString(facts, 'selected-interface-name', 'interface', 'selected interface name', observedAt, selected.name, 'Network Diagnostics selected this local interface for the run.', interfaceTarget);
  pushString(facts, 'selected-interface-type', 'interface', 'selected interface type', observedAt, selected.type, 'Source-reported local interface type.', interfaceTarget);
  pushString(facts, 'selected-interface-binding-scope', 'interface', 'selected interface binding scope', observedAt, selected.bindingScope, 'Source-reported binding scope for the selected interface.', interfaceTarget);
  const linkSpeed = mbpsToBitsPerSecond(selected.linkSpeedMbps, 'selected interface link speed');
  if (linkSpeed !== null) facts.push(fact('selected-interface-link-speed', 'interface', 'selected interface link speed', observedAt, linkSpeed, 'bits-per-second', 'Exact conversion from the source-reported Mbps link speed.', interfaceTarget));
  if (allowAddresses) pushString(facts, 'selected-interface-source-address', 'interface', 'selected interface source address', observedAt, selected.sourceAddress, 'Local source address included only because the report explicitly permits local addresses.', interfaceTarget);
}

function mapDeepInterfaces(facts: NativeMeasurementFact[], deep: Record<string, unknown> | null, observedAt: string, allowAddresses: boolean): void {
  if (deep === null) return;
  const interfaces = optionalArray(deep.interfaces, 'deepDiagnostics.interfaces');
  if (interfaces === null) return;
  interfaces.forEach((entry, index) => {
    const current = requiredRecord(entry, `deepDiagnostics.interfaces[${index}]`);
    const name = requiredString(current.name, `deepDiagnostics.interfaces[${index}].name`);
    const key = `deep-interface-${index}-${safeIdPart(name)}`;
    const interfaceTarget = target('interface', name);
    pushString(facts, `${key}-type`, 'interface', `${name} interface type`, observedAt, current.type, 'Source-reported local interface type.', interfaceTarget);
    pushBoolean(facts, `${key}-ipv4`, 'interface', `${name} supports IPv4`, observedAt, current.supportsIpv4, 'Source-reported address-family capability.', interfaceTarget);
    pushBoolean(facts, `${key}-ipv6`, 'interface', `${name} supports IPv6`, observedAt, current.supportsIpv6, 'Source-reported address-family capability.', interfaceTarget);
    pushMbps(facts, `${key}-link-speed`, 'interface', `${name} link speed`, observedAt, current.linkSpeedMbps, 'Exact conversion from source-reported Mbps.', interfaceTarget);
    pushNumber(facts, `${key}-ipv4-mtu`, 'interface', `${name} IPv4 MTU`, observedAt, current.ipv4Mtu, 'bytes', 'Source-reported IPv4 interface MTU.', interfaceTarget);
    if (!allowAddresses) return;
    for (const [fieldName, subject] of [['unicastAddresses', 'unicast addresses'], ['gateways', 'gateway addresses'], ['dnsServers', 'DNS server addresses']] as const) {
      const values = optionalArray(current[fieldName], `${name} ${fieldName}`);
      if (values === null) continue;
      const strings = values.map((value, itemIndex) => requiredString(value, `${name} ${fieldName}[${itemIndex}]`));
      facts.push(fact(`${key}-${safeIdPart(fieldName)}`, 'interface', `${name} ${subject}`, observedAt, strings, null, 'Local address list included only because the report explicitly permits local addresses.', interfaceTarget));
    }
  });
}

function mapRouting(facts: NativeMeasurementFact[], deep: Record<string, unknown> | null, observedAt: string, allowAddresses: boolean): void {
  if (deep === null) return;
  const routing = optionalRecord(deep.routing, 'deepDiagnostics.routing');
  if (routing === null) return;
  const status = requiredString(routing.status, 'deepDiagnostics.routing.status');
  if (status.toLowerCase() === 'unavailable') {
    facts.push(fact('routing-availability', 'route', 'local routing table availability', observedAt, null, null, 'Network Diagnostics explicitly reported routing details unavailable.', null, 'unavailable'));
    return;
  }
  facts.push(fact('routing-availability', 'route', 'local routing table availability', observedAt, status, null, 'Source-reported routing detail status.'));
  const entries = optionalArray(routing.entries, 'deepDiagnostics.routing.entries') ?? [];
  entries.forEach((entry, index) => {
    const route = requiredRecord(entry, `deepDiagnostics.routing.entries[${index}]`);
    const destination = requiredString(route.destination, `deepDiagnostics.routing.entries[${index}].destination`);
    const routeTarget = target('prefix', destination);
    const prefix = `route-${index}-${safeIdPart(destination)}`;
    pushString(facts, `${prefix}-family`, 'route', `route ${destination} address family`, observedAt, route.addressFamily, 'Source-reported local route address family.', routeTarget);
    pushBoolean(facts, `${prefix}-default`, 'route', `route ${destination} is default`, observedAt, route.isDefault, 'Source-reported default-route flag.', routeTarget);
    pushNumber(facts, `${prefix}-metric`, 'route', `route ${destination} metric`, observedAt, route.metric, 'count', 'Source-reported local route metric; no cross-platform metric equivalence is implied.', routeTarget);
    pushString(facts, `${prefix}-interface`, 'route', `route ${destination} interface`, observedAt, route.interfaceName, 'Source-reported egress interface for this local route.', routeTarget);
    if (allowAddresses) pushString(facts, `${prefix}-gateway`, 'route', `route ${destination} gateway`, observedAt, route.gateway, 'Local gateway address included only because the report explicitly permits local addresses.', routeTarget);
  });
}

function mapPingTarget(facts: NativeMeasurementFact[], prefix: string, category: NativeMeasurementFact['category'], value: unknown, observedAt: string, allowAddresses: boolean): void {
  if (value === undefined || value === null) return;
  const ping = requiredRecord(value, prefix);
  const label = requiredString(ping.label, `${prefix}.label`);
  const address = allowAddresses ? optionalString(ping.address, `${prefix}.address`) : null;
  const pingTarget = address === null ? null : target('ip', address);
  mapLatencyStatistics(facts, prefix, category, ping.statistics, observedAt, pingTarget, label);
}

function mapTraceroute(facts: NativeMeasurementFact[], deep: Record<string, unknown> | null, observedAt: string, allowAddresses: boolean): void {
  if (deep === null) return;
  const trace = optionalRecord(deep.traceRoute, 'deepDiagnostics.traceRoute');
  if (trace === null) return;
  const traceTargetText = requiredString(trace.target, 'deepDiagnostics.traceRoute.target');
  const traceTarget = target('hostname', traceTargetText);
  pushNumber(facts, 'trace-maximum-hops', 'traceroute', 'traceroute maximum hops', observedAt, trace.maximumHops, 'hops', 'Source-configured traceroute hop ceiling.', traceTarget);
  pushBoolean(facts, 'trace-reached-destination', 'traceroute', 'traceroute reached destination', observedAt, trace.reachedDestination, 'Source-reported traceroute destination reachability.', traceTarget);
  const hops = optionalArray(trace.hops, 'deepDiagnostics.traceRoute.hops') ?? [];
  hops.forEach((entry, index) => {
    const hop = requiredRecord(entry, `deepDiagnostics.traceRoute.hops[${index}]`);
    const hopNumber = optionalFiniteNumber(hop.hop, `trace hop ${index} number`) ?? index + 1;
    const prefix = `trace-hop-${safeIdPart(String(hopNumber))}`;
    pushNumber(facts, `${prefix}-number`, 'traceroute', `traceroute hop ${hopNumber} index`, observedAt, hopNumber, 'hops', 'Source-reported traceroute hop index.', traceTarget);
    pushBoolean(facts, `${prefix}-destination`, 'traceroute', `traceroute hop ${hopNumber} reached destination`, observedAt, hop.reachedDestination, 'Source-reported destination flag for this hop.', traceTarget);
    if (allowAddresses && hop.addressRedacted !== true) {
      pushString(facts, `${prefix}-address`, 'traceroute', `traceroute hop ${hopNumber} address`, observedAt, hop.address, 'Observed hop address included only because local addresses are explicitly permitted and this hop is not marked redacted.', traceTarget);
      pushString(facts, `${prefix}-hostname`, 'traceroute', `traceroute hop ${hopNumber} hostname`, observedAt, hop.hostname, 'Observed hop hostname included under the report local-address disclosure policy.', traceTarget);
    }
    const roundTrips = optionalArray(hop.roundTripsMs, `traceroute hop ${hopNumber} roundTripsMs`) ?? [];
    roundTrips.forEach((sample, sampleIndex) => {
      if (sample === null) return;
      pushNumber(facts, `${prefix}-rtt-${sampleIndex + 1}`, 'traceroute', `traceroute hop ${hopNumber} RTT sample ${sampleIndex + 1}`, observedAt, sample, 'ms', 'One source-reported traceroute round-trip sample; no path symmetry is implied.', traceTarget);
    });
  });
}

function mapDns(facts: NativeMeasurementFact[], deep: Record<string, unknown> | null, observedAt: string, allowAddresses: boolean): void {
  if (deep === null) return;
  const resolvers = optionalArray(deep.dnsResolvers, 'deepDiagnostics.dnsResolvers');
  if (resolvers === null) return;
  resolvers.forEach((entry, index) => {
    const resolver = requiredRecord(entry, `deepDiagnostics.dnsResolvers[${index}]`);
    const name = requiredString(resolver.name, `deepDiagnostics.dnsResolvers[${index}].name`);
    const address = allowAddresses ? optionalString(resolver.address, `deepDiagnostics.dnsResolvers[${index}].address`) : null;
    const resolverTarget = address === null ? null : target('ip', address);
    const prefix = `dns-resolver-${index}-${safeIdPart(name)}`;
    const attempts = optionalFiniteNumber(resolver.attempts, `${name} attempts`);
    const successful = optionalFiniteNumber(resolver.successful, `${name} successful`);
    pushNumber(facts, `${prefix}-attempts`, 'dns', `${name} DNS attempts`, observedAt, resolver.attempts, 'count', 'Source-reported DNS query attempt count.', resolverTarget);
    pushNumber(facts, `${prefix}-successful`, 'dns', `${name} DNS successful attempts`, observedAt, resolver.successful, 'count', 'Source-reported successful DNS query count.', resolverTarget);
    const availability: EvidenceAvailability = successful === 0 ? 'unavailable' : attempts !== null && successful !== null && successful < attempts ? 'partial' : 'available';
    if (availability !== 'unavailable') {
      for (const [suffix, label, value] of [
        ['minimum', 'minimum DNS latency', resolver.minimumMs],
        ['median', 'median DNS latency', resolver.medianMs],
        ['p95', 'p95 DNS latency', resolver.p95Ms],
        ['maximum', 'maximum DNS latency', resolver.maximumMs],
      ] as const) pushNumber(facts, `${prefix}-${suffix}-ms`, 'dns', `${name} ${label}`, observedAt, value, 'ms', `Source-reported ${label}.`, resolverTarget, availability);
    }
  });
}

function mapServices(facts: NativeMeasurementFact[], deep: Record<string, unknown> | null, observedAt: string): void {
  if (deep === null) return;
  const endpoints = optionalArray(deep.serviceEndpoints, 'deepDiagnostics.serviceEndpoints');
  if (endpoints === null) return;
  endpoints.forEach((entry, index) => {
    const endpoint = requiredRecord(entry, `deepDiagnostics.serviceEndpoints[${index}]`);
    const host = requiredString(endpoint.host, `deepDiagnostics.serviceEndpoints[${index}].host`);
    const name = requiredString(endpoint.name, `deepDiagnostics.serviceEndpoints[${index}].name`);
    const endpointTarget = target('service', host);
    const prefix = `service-${index}-${safeIdPart(name)}`;
    pushBoolean(facts, `${prefix}-reachable`, 'transport', `${name} service reachable`, observedAt, endpoint.reachable, 'Source-reported end-to-end service reachability.', endpointTarget);
    pushNumber(facts, `${prefix}-dns-ms`, 'dns', `${name} DNS duration`, observedAt, endpoint.dnsMs, 'ms', 'Source-reported DNS phase duration for this service check.', endpointTarget);
    pushNumber(facts, `${prefix}-tcp-ms`, 'transport', `${name} TCP connect duration`, observedAt, endpoint.tcpMs, 'ms', 'Source-reported TCP connect duration for this service check.', endpointTarget);
    pushNumber(facts, `${prefix}-tls-ms`, 'transport', `${name} TLS handshake duration`, observedAt, endpoint.tlsMs, 'ms', 'Source-reported TLS handshake duration for this service check.', endpointTarget);
    pushString(facts, `${prefix}-tls-protocol`, 'transport', `${name} TLS protocol`, observedAt, endpoint.tlsProtocol, 'Source-reported TLS protocol for this service check.', endpointTarget);
    pushString(facts, `${prefix}-application-protocol`, 'transport', `${name} application protocol`, observedAt, endpoint.applicationProtocol, 'Source-reported negotiated application protocol.', endpointTarget);
  });
}

function mapThroughputSummary(facts: NativeMeasurementFact[], prefix: string, label: string, value: unknown, observedAt: string, factTarget: NativeMeasurementTarget | null): void {
  if (value === undefined || value === null) return;
  const summary = requiredRecord(value, label);
  pushMbps(facts, `${prefix}-mbps`, 'transport', `${label} throughput`, observedAt, summary.mbps, 'Exact conversion from source-reported Mbps.', factTarget);
  pushMbps(facts, `${prefix}-steady-mbps`, 'transport', `${label} steady throughput`, observedAt, summary.steadyMbps, 'Exact conversion from source-reported steady Mbps.', factTarget);
  pushMbps(facts, `${prefix}-peak-mbps`, 'transport', `${label} peak throughput`, observedAt, summary.peakMbps, 'Exact conversion from source-reported peak Mbps.', factTarget);
  pushNumber(facts, `${prefix}-bytes`, 'transport', `${label} bytes`, observedAt, summary.bytes, 'bytes', 'Source-reported transferred byte count.', factTarget);
  pushNumber(facts, `${prefix}-duration`, 'transport', `${label} duration`, observedAt, summary.durationMs, 'ms', 'Source-reported transfer duration.', factTarget);
  pushNumber(facts, `${prefix}-stability`, 'transport', `${label} stability`, observedAt, summary.stabilityPercent, 'percent', 'Source-reported throughput stability percentage.', factTarget);
  pushBoolean(facts, `${prefix}-cap-reached`, 'transport', `${label} transfer cap reached`, observedAt, summary.capReached, 'Source-reported transfer-cap status.', factTarget);
  pushString(facts, `${prefix}-qualification`, 'transport', `${label} qualification`, observedAt, summary.qualification, 'Source-reported throughput qualification.', factTarget);
}

function mapLoadedLatency(facts: NativeMeasurementFact[], prefix: string, label: string, value: unknown, observedAt: string, factTarget: NativeMeasurementTarget | null): void {
  if (value === undefined || value === null) return;
  const loaded = requiredRecord(value, label);
  mapLatencyStatistics(facts, `${prefix}-stats`, 'transport', loaded.statistics, observedAt, factTarget, label);
  pushNumber(facts, `${prefix}-increase-ms`, 'transport', `${label} latency increase`, observedAt, loaded.increaseMs, 'ms', 'Source-reported increase over idle latency.', factTarget);
  pushString(facts, `${prefix}-grade`, 'transport', `${label} grade`, observedAt, loaded.grade, 'Source-reported loaded-latency grade.', factTarget);
}

function mapInternetTransfer(facts: NativeMeasurementFact[], value: unknown, observedAt: string): void {
  if (value === undefined || value === null) return;
  const transfer = requiredRecord(value, 'internetTransfer');
  const origin = requiredString(transfer.origin, 'internetTransfer.origin');
  const transferTarget = serviceTarget(origin);
  mapLatencyStatistics(facts, 'internet-idle', 'transport', transfer.idleLatency, observedAt, transferTarget, 'Internet transfer idle latency');
  mapThroughputSummary(facts, 'internet-download', 'Internet download', transfer.download, observedAt, transferTarget);
  mapThroughputSummary(facts, 'internet-upload', 'Internet upload', transfer.upload, observedAt, transferTarget);
  mapLoadedLatency(facts, 'internet-download-loaded', 'Internet download loaded latency', transfer.downloadLatency, observedAt, transferTarget);
  mapLoadedLatency(facts, 'internet-upload-loaded', 'Internet upload loaded latency', transfer.uploadLatency, observedAt, transferTarget);
  pushNumber(facts, 'internet-data-used', 'transport', 'Internet transfer data used', observedAt, transfer.dataUsedBytes, 'bytes', 'Source-reported total data usage for the transfer run.', transferTarget);
}

function mapLocalLink(facts: NativeMeasurementFact[], value: unknown, observedAt: string): void {
  if (value === undefined || value === null) return;
  const link = requiredRecord(value, 'localLink');
  const targetName = requiredString(link.target, 'localLink.target');
  const port = optionalFiniteNumber(link.port, 'localLink.port');
  const linkTarget = target('service', port === null ? targetName : `${targetName}:${port}`);
  mapLatencyStatistics(facts, 'local-link-latency', 'transport', link.latency, observedAt, linkTarget, 'Local-link latency');
  pushMbps(facts, 'local-link-download', 'transport', 'local-link download throughput', observedAt, link.downloadMbps, 'Exact conversion from source-reported Mbps.', linkTarget);
  pushNumber(facts, 'local-link-download-bytes', 'transport', 'local-link download bytes', observedAt, link.downloadBytes, 'bytes', 'Source-reported local-link download bytes.', linkTarget);
  pushMbps(facts, 'local-link-upload', 'transport', 'local-link upload throughput', observedAt, link.uploadMbps, 'Exact conversion from source-reported Mbps.', linkTarget);
  pushNumber(facts, 'local-link-upload-bytes', 'transport', 'local-link upload bytes', observedAt, link.uploadBytes, 'bytes', 'Source-reported local-link upload bytes.', linkTarget);
}

function mapAddressFamily(facts: NativeMeasurementFact[], familyLabel: string, value: unknown, observedAt: string): void {
  const probe = requiredRecord(value, `${familyLabel} dual-stack probe`);
  const address = optionalString(probe.address, `${familyLabel} address`);
  const probeTarget = address === null ? null : target('ip', address);
  const prefix = `dual-${familyLabel.toLowerCase()}`;
  pushBoolean(facts, `${prefix}-address-available`, 'route', `${familyLabel} destination address available`, observedAt, probe.addressAvailable, 'Source-reported destination address-family availability.', probeTarget);
  pushBoolean(facts, `${prefix}-ping-available`, 'icmp', `${familyLabel} ping available`, observedAt, probe.pingAvailable, 'Source-reported ICMP reachability for this address family.', probeTarget);
  pushNumber(facts, `${prefix}-ping-median`, 'icmp', `${familyLabel} ping median`, observedAt, probe.pingMedianMs, 'ms', 'Source-reported median ping latency.', probeTarget);
  pushBoolean(facts, `${prefix}-tcp-reachable`, 'transport', `${familyLabel} TCP reachable`, observedAt, probe.tcpReachable, 'Source-reported TCP reachability.', probeTarget);
  pushNumber(facts, `${prefix}-tcp-connect`, 'transport', `${familyLabel} TCP connect duration`, observedAt, probe.tcpConnectMs, 'ms', 'Source-reported TCP connect duration.', probeTarget);
  pushBoolean(facts, `${prefix}-tls-reachable`, 'transport', `${familyLabel} TLS reachable`, observedAt, probe.tlsReachable, 'Source-reported TLS reachability.', probeTarget);
  pushNumber(facts, `${prefix}-tls-handshake`, 'transport', `${familyLabel} TLS handshake duration`, observedAt, probe.tlsHandshakeMs, 'ms', 'Source-reported TLS handshake duration.', probeTarget);
  pushString(facts, `${prefix}-tls-protocol`, 'transport', `${familyLabel} TLS protocol`, observedAt, probe.tlsProtocol, 'Source-reported TLS protocol.', probeTarget);
  pushString(facts, `${prefix}-application-protocol`, 'transport', `${familyLabel} application protocol`, observedAt, probe.applicationProtocol, 'Source-reported application protocol.', probeTarget);
  pushBoolean(facts, `${prefix}-http-reachable`, 'transport', `${familyLabel} HTTP reachable`, observedAt, probe.httpReachable, 'Source-reported HTTP reachability.', probeTarget);
  pushNumber(facts, `${prefix}-http-response`, 'transport', `${familyLabel} HTTP response duration`, observedAt, probe.httpResponseMs, 'ms', 'Source-reported HTTP response duration.', probeTarget);
  pushNumber(facts, `${prefix}-http-status`, 'transport', `${familyLabel} HTTP status code`, observedAt, probe.httpStatusCode, 'count', 'Source-reported HTTP status code represented as a scalar diagnostic value.', probeTarget);
}

function mapDualStack(facts: NativeMeasurementFact[], value: unknown, observedAt: string): void {
  if (value === undefined || value === null) return;
  const dual = requiredRecord(value, 'dualStack');
  mapAddressFamily(facts, 'IPv4', dual.ipv4, observedAt);
  mapAddressFamily(facts, 'IPv6', dual.ipv6, observedAt);
  pushString(facts, 'dual-preferred-family', 'route', 'preferred address family', observedAt, dual.preferredFamily, 'Source-reported address-family preference for this run.');
  pushBoolean(facts, 'dual-nat64-suspected', 'route', 'NAT64 suspected', observedAt, dual.nat64Suspected, 'Source-reported NAT64 suspicion flag; this is not a global topology claim.');
  pushNumber(facts, 'dual-dns-resolution', 'dns', 'dual-stack DNS resolution duration', observedAt, dual.dnsResolutionMs, 'ms', 'Source-reported dual-stack DNS resolution duration.');
  pushNumber(facts, 'dual-ipv4-address-count', 'dns', 'IPv4 destination address count', observedAt, dual.ipv4AddressCount, 'count', 'Source-reported resolved IPv4 address count.');
  pushNumber(facts, 'dual-ipv6-address-count', 'dns', 'IPv6 destination address count', observedAt, dual.ipv6AddressCount, 'count', 'Source-reported resolved IPv6 address count.');
  pushString(facts, 'dual-parallel-winner', 'transport', 'parallel connect winner', observedAt, dual.parallelConnectWinner, 'Source-reported address-family winner for the parallel connection attempt.');
  pushNumber(facts, 'dual-parallel-difference', 'transport', 'parallel connect difference', observedAt, dual.parallelConnectDifferenceMs, 'ms', 'Source-reported timing difference between parallel address-family connection attempts.');
}

function collectSkippedSections(report: ParsedReport): string[] {
  const skipped: string[] = [];
  const root = report.root;
  const explicitNonMeasured: Array<[string, string]> = [
    ['browserEvidence', 'browserEvidence is browser/edge evidence, not LOCAL MEASURED'],
    ['findings', 'findings are derived diagnostic conclusions, not direct measurements'],
    ['loadLocalization', 'loadLocalization is a derived localization conclusion'],
    ['hostResources', 'hostResources is outside the current 09A network measurement categories'],
    ['annotations', 'annotations are user/report metadata, not measurements'],
  ];
  for (const [key, reason] of explicitNonMeasured) if (root[key] !== undefined && root[key] !== null) skipped.push(`${key}: ${reason}`);
  const networkChange = optionalRecord(root.networkChange, 'networkChange');
  if (networkChange?.publicNetworkBefore !== undefined || networkChange?.publicNetworkAfter !== undefined) skipped.push('networkChange.publicNetwork*: public network context is not LOCAL MEASURED');
  const measurement = optionalRecord(root.measurement, 'measurement');
  if (measurement?.network !== undefined) skipped.push('measurement.network: edge/public network metadata is not LOCAL MEASURED');
  if (measurement?.http3 !== undefined) skipped.push('measurement.http3: browser HTTP/3 evidence is not LOCAL MEASURED');
  const unknownKeys = Object.keys(root).filter((key) => !KNOWN_ROOT_SECTIONS.has(key));
  if (unknownKeys.length > 0) skipped.push(`unknown root fields ignored: ${unknownKeys.sort().join(', ')}`);
  return skipped;
}

function localAddressDisclosure(report: ParsedReport, deep: Record<string, unknown> | null): boolean {
  if (!report.run.includesLocalAddresses) return false;
  if (deep === null || deep.includesLocalAddresses === undefined) return true;
  return deep.includesLocalAddresses === true;
}

export function adaptNetworkDiagnosticsReportV2(value: unknown): NativeMeasurementSnapshot {
  const report = parseReport(value);
  const observedAt = report.run.completedAt;
  const facts: NativeMeasurementFact[] = [];
  const measurement = optionalRecord(report.root.measurement, 'measurement');
  const deep = optionalRecord(report.root.deepDiagnostics, 'deepDiagnostics');
  const allowLocalAddresses = localAddressDisclosure(report, deep);
  const skipped = collectSkippedSections(report);

  mapSelectedInterface(facts, measurement, observedAt, allowLocalAddresses);
  mapDeepInterfaces(facts, deep, observedAt, allowLocalAddresses);
  mapRouting(facts, deep, observedAt, allowLocalAddresses);
  if (deep !== null) {
    mapPingTarget(facts, 'gateway-ping', 'icmp', deep.gatewayPing, observedAt, allowLocalAddresses);
    mapPingTarget(facts, 'internet-ping', 'icmp', deep.internetPing, observedAt, true);
  }
  mapTraceroute(facts, deep, observedAt, allowLocalAddresses);
  mapDns(facts, deep, observedAt, allowLocalAddresses);
  mapServices(facts, deep, observedAt);
  mapInternetTransfer(facts, report.root.internetTransfer, observedAt);
  mapLocalLink(facts, report.root.localLink, observedAt);
  mapDualStack(facts, report.root.dualStack, observedAt);

  const producerVersion = report.producer === null ? null : optionalString(report.producer.version, 'producer.version');
  const producerEngine = report.producer === null ? null : optionalString(report.producer.engine, 'producer.engine');
  const warnings = [
    'Imported from Network Diagnostics Suite report schema 2.0. This snapshot describes one local run and is not globally complete.',
    'The combined report is multi-target; snapshot-level target is intentionally null and target scope is carried per measured fact.',
    'Report v2 does not timestamp every metric individually; mapped facts use run.completedAt as the bounded observation timestamp.',
    'Absent optional report sections are omitted rather than fabricated as unavailable measurements.',
    'Only whitelisted direct/local measurement fields are mapped; public, browser, inferred, derived, and unknown fields are not promoted to LOCAL MEASURED.',
    ...(allowLocalAddresses ? [] : ['Local address-valued facts are withheld because the report does not explicitly permit local-address disclosure.']),
    ...skipped,
  ];

  const candidate: NativeMeasurementSnapshot = {
    schema: 'hopscotch.native-measurement',
    version: 1,
    provenance: 'LOCAL MEASURED',
    generatedAt: report.generatedAt,
    source: {
      adapter: 'network-diagnostics-suite-report-v2',
      adapterVersion: '1',
      platform: platformFor(report.run.platform),
      tool: producerEngine ?? 'Network Diagnostics Suite',
      toolVersion: producerVersion,
    },
    capture: {
      startedAt: report.run.startedAt,
      completedAt: report.run.completedAt,
    },
    scope: {
      vantage: 'local-host',
      completeness: 'bounded',
      globalComplete: false,
      target: null,
      limitations: warnings.slice(0, 6),
    },
    facts,
    warnings,
  };

  return parseNativeMeasurementSnapshot(candidate);
}

export function ingestNetworkDiagnosticsReportV2(value: unknown): NetworkDiagnosticsIngestion {
  const snapshot = adaptNetworkDiagnosticsReportV2(value);
  const skippedSections = snapshot.warnings.filter((warning) => warning.includes(':') || warning.startsWith('unknown root fields ignored:'));
  return {
    snapshot,
    state: projectMeasuredSnapshot(snapshot),
    skippedSections,
  };
}
