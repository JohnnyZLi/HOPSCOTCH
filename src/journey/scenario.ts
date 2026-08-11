import {
  buildJourneyScenario,
  normalizeJourneyHostname,
  type JourneyDnsProfile,
  type JourneyImpairmentProfile,
  type JourneyScenarioConfig,
  type JourneyTransportProfile,
} from './model.ts';

export const JOURNEY_SCENARIO_SCHEMA = 'hopscotch.url-journey' as const;
export const JOURNEY_SCENARIO_VERSION = 1 as const;

export interface PortableJourneyScenarioV1 {
  schema: typeof JOURNEY_SCENARIO_SCHEMA;
  version: typeof JOURNEY_SCENARIO_VERSION;
  name?: string;
  hostname: string;
  transportProfile: JourneyTransportProfile;
  dnsProfile: JourneyDnsProfile;
  impairmentProfile: JourneyImpairmentProfile;
  timeMs: number;
}

const transportProfiles = new Set<JourneyTransportProfile>(['tcp-h2', 'quic-h3']);
const dnsProfiles = new Set<JourneyDnsProfile>(['cache-miss', 'cache-hit']);
const impairmentProfiles = new Set<JourneyImpairmentProfile>(['clean', 'single-loss', 'latency-spike', 'route-failure']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeName(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new Error('Scenario name must be a string.');
  const normalized = value.trim();
  if (!normalized) return undefined;
  if (normalized.length > 80) throw new Error('Scenario name must be 80 characters or fewer.');
  return normalized;
}

function normalizeTime(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value) || value < 0) throw new Error('Scenario timeMs must be a non-negative integer.');
  return value;
}

function normalizeTransport(value: unknown): JourneyTransportProfile {
  if (typeof value !== 'string' || !transportProfiles.has(value as JourneyTransportProfile)) throw new Error('Invalid Journey transport profile.');
  return value as JourneyTransportProfile;
}

function normalizeDns(value: unknown): JourneyDnsProfile {
  if (typeof value !== 'string' || !dnsProfiles.has(value as JourneyDnsProfile)) throw new Error('Invalid Journey DNS profile.');
  return value as JourneyDnsProfile;
}

function normalizeImpairment(value: unknown): JourneyImpairmentProfile {
  if (typeof value !== 'string' || !impairmentProfiles.has(value as JourneyImpairmentProfile)) throw new Error('Invalid Journey impairment profile.');
  return value as JourneyImpairmentProfile;
}

export function scenarioConfigFromPortable(scenario: PortableJourneyScenarioV1): JourneyScenarioConfig {
  return { transportProfile: scenario.transportProfile, dnsProfile: scenario.dnsProfile, impairmentProfile: scenario.impairmentProfile };
}

export function normalizePortableJourneyScenario(value: unknown): PortableJourneyScenarioV1 {
  if (!isRecord(value)) throw new Error('Journey scenario must be a JSON object.');
  if (value.schema !== JOURNEY_SCENARIO_SCHEMA) throw new Error('Unsupported Journey scenario schema.');
  if (value.version !== JOURNEY_SCENARIO_VERSION) throw new Error('Unsupported Journey scenario version.');
  const hostname = normalizeJourneyHostname(typeof value.hostname === 'string' ? value.hostname : '');
  const transportProfile = normalizeTransport(value.transportProfile);
  const dnsProfile = normalizeDns(value.dnsProfile);
  const impairmentProfile = normalizeImpairment(value.impairmentProfile);
  const requestedTimeMs = normalizeTime(value.timeMs);
  const name = normalizeName(value.name);
  const generated = buildJourneyScenario(hostname, { transportProfile, dnsProfile, impairmentProfile });
  const timeMs = Math.min(requestedTimeMs, generated.durationMs);
  return { schema: JOURNEY_SCENARIO_SCHEMA, version: JOURNEY_SCENARIO_VERSION, ...(name ? { name } : {}), hostname, transportProfile, dnsProfile, impairmentProfile, timeMs };
}

export function createPortableJourneyScenario(input: { name?: string; hostname: string; config: JourneyScenarioConfig; timeMs: number }): PortableJourneyScenarioV1 {
  return normalizePortableJourneyScenario({ schema: JOURNEY_SCENARIO_SCHEMA, version: JOURNEY_SCENARIO_VERSION, name: input.name, hostname: input.hostname, transportProfile: input.config.transportProfile, dnsProfile: input.config.dnsProfile, impairmentProfile: input.config.impairmentProfile, timeMs: input.timeMs });
}

export function serializeJourneyScenario(scenario: PortableJourneyScenarioV1): string {
  return JSON.stringify(normalizePortableJourneyScenario(scenario), null, 2);
}

export function parseJourneyScenarioJson(json: string): PortableJourneyScenarioV1 {
  let parsed: unknown;
  try { parsed = JSON.parse(json); } catch { throw new Error('Journey scenario file is not valid JSON.'); }
  return normalizePortableJourneyScenario(parsed);
}

export function encodeJourneyQuery(scenario: PortableJourneyScenarioV1): string {
  const normalized = normalizePortableJourneyScenario(scenario);
  const params = new URLSearchParams();
  params.set('journey', '1');
  params.set('host', normalized.hostname);
  params.set('transport', normalized.transportProfile);
  params.set('dns', normalized.dnsProfile);
  params.set('impairment', normalized.impairmentProfile);
  params.set('t', String(normalized.timeMs));
  if (normalized.name) params.set('name', normalized.name);
  return `?${params.toString()}`;
}

export function decodeJourneyQuery(search: string): PortableJourneyScenarioV1 | null {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  if (params.get('journey') !== '1') return null;
  const rawTime = params.get('t');
  if (rawTime === null || !/^\d+$/.test(rawTime)) throw new Error('Shared Journey time must be a non-negative integer.');
  return normalizePortableJourneyScenario({ schema: JOURNEY_SCENARIO_SCHEMA, version: JOURNEY_SCENARIO_VERSION, name: params.get('name') ?? undefined, hostname: params.get('host') ?? '', transportProfile: params.get('transport'), dnsProfile: params.get('dns'), impairmentProfile: params.get('impairment'), timeMs: Number(rawTime) });
}

export function buildJourneyShareUrl(baseUrl: string, scenario: PortableJourneyScenarioV1): string {
  const url = new URL(baseUrl);
  url.search = encodeJourneyQuery(scenario).slice(1);
  url.hash = '';
  return url.toString();
}
