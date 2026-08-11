import {
  buildJourneyScenario,
  normalizeJourneyHostname,
  type JourneyDnsProfile,
  type JourneyImpairmentProfile,
  type JourneyModifierId,
  type JourneyScenarioConfig,
  type JourneyTransportProfile,
} from './model.ts';
import {
  impairmentProfileForModifiers,
  normalizeJourneyModifierIds,
  resolveJourneyModifierIds,
} from './modifiers.ts';

export const JOURNEY_SCENARIO_SCHEMA = 'hopscotch.url-journey' as const;
export const JOURNEY_SCENARIO_VERSION = 1 as const;
export const JOURNEY_SCENARIO_VERSION_V2 = 2 as const;

type JourneyLegacyImpairmentProfile = Exclude<JourneyImpairmentProfile, 'composed'>;

interface PortableJourneyScenarioBase {
  schema: typeof JOURNEY_SCENARIO_SCHEMA;
  name?: string;
  hostname: string;
  transportProfile: JourneyTransportProfile;
  dnsProfile: JourneyDnsProfile;
  timeMs: number;
}

export interface PortableJourneyScenarioV1 extends PortableJourneyScenarioBase {
  version: typeof JOURNEY_SCENARIO_VERSION;
  impairmentProfile: JourneyLegacyImpairmentProfile;
}

export interface PortableJourneyScenarioV2 extends PortableJourneyScenarioBase {
  version: typeof JOURNEY_SCENARIO_VERSION_V2;
  modifiers: JourneyModifierId[];
}

export type PortableJourneyScenario = PortableJourneyScenarioV1 | PortableJourneyScenarioV2;

const transportProfiles = new Set<JourneyTransportProfile>(['tcp-h2', 'quic-h3']);
const dnsProfiles = new Set<JourneyDnsProfile>(['cache-miss', 'cache-hit']);
const impairmentProfiles = new Set<JourneyLegacyImpairmentProfile>(['clean', 'single-loss', 'latency-spike', 'route-failure', 'path-outage', 'congestion']);

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

function normalizeImpairment(value: unknown): JourneyLegacyImpairmentProfile {
  if (typeof value !== 'string' || !impairmentProfiles.has(value as JourneyLegacyImpairmentProfile)) throw new Error('Invalid Journey impairment profile.');
  return value as JourneyLegacyImpairmentProfile;
}

function normalizeCommon(value: Record<string, unknown>) {
  return {
    name: normalizeName(value.name),
    hostname: normalizeJourneyHostname(typeof value.hostname === 'string' ? value.hostname : ''),
    transportProfile: normalizeTransport(value.transportProfile),
    dnsProfile: normalizeDns(value.dnsProfile),
    requestedTimeMs: normalizeTime(value.timeMs),
  };
}

export function scenarioConfigFromPortable(scenario: PortableJourneyScenario): JourneyScenarioConfig {
  if (scenario.version === JOURNEY_SCENARIO_VERSION) {
    return {
      transportProfile: scenario.transportProfile,
      dnsProfile: scenario.dnsProfile,
      impairmentProfile: scenario.impairmentProfile,
    };
  }
  const modifierIds = normalizeJourneyModifierIds(scenario.modifiers);
  return {
    transportProfile: scenario.transportProfile,
    dnsProfile: scenario.dnsProfile,
    impairmentProfile: impairmentProfileForModifiers(modifierIds),
    modifierIds,
  };
}

export function normalizePortableJourneyScenario(value: unknown): PortableJourneyScenario {
  if (!isRecord(value)) throw new Error('Journey scenario must be a JSON object.');
  if (value.schema !== JOURNEY_SCENARIO_SCHEMA) throw new Error('Unsupported Journey scenario schema.');

  const common = normalizeCommon(value);

  if (value.version === JOURNEY_SCENARIO_VERSION) {
    const impairmentProfile = normalizeImpairment(value.impairmentProfile);
    const config: JourneyScenarioConfig = {
      transportProfile: common.transportProfile,
      dnsProfile: common.dnsProfile,
      impairmentProfile,
    };
    const generated = buildJourneyScenario(common.hostname, config);
    return {
      schema: JOURNEY_SCENARIO_SCHEMA,
      version: JOURNEY_SCENARIO_VERSION,
      ...(common.name ? { name: common.name } : {}),
      hostname: common.hostname,
      transportProfile: common.transportProfile,
      dnsProfile: common.dnsProfile,
      impairmentProfile,
      timeMs: Math.min(common.requestedTimeMs, generated.durationMs),
    };
  }

  if (value.version === JOURNEY_SCENARIO_VERSION_V2) {
    if (!Array.isArray(value.modifiers)) throw new Error('Journey schema v2 modifiers must be an array.');
    const modifiers = normalizeJourneyModifierIds(value.modifiers);
    if (modifiers.length < 2) throw new Error('Journey schema v2 requires at least two modifiers.');
    const config: JourneyScenarioConfig = {
      transportProfile: common.transportProfile,
      dnsProfile: common.dnsProfile,
      impairmentProfile: 'composed',
      modifierIds: modifiers,
    };
    const generated = buildJourneyScenario(common.hostname, config);
    return {
      schema: JOURNEY_SCENARIO_SCHEMA,
      version: JOURNEY_SCENARIO_VERSION_V2,
      ...(common.name ? { name: common.name } : {}),
      hostname: common.hostname,
      transportProfile: common.transportProfile,
      dnsProfile: common.dnsProfile,
      modifiers,
      timeMs: Math.min(common.requestedTimeMs, generated.durationMs),
    };
  }

  throw new Error('Unsupported Journey scenario version.');
}

export function createPortableJourneyScenario(input: { name?: string; hostname: string; config: JourneyScenarioConfig; timeMs: number }): PortableJourneyScenario {
  const modifierIds = resolveJourneyModifierIds(input.config);
  const impairmentProfile = impairmentProfileForModifiers(modifierIds);
  if (modifierIds.length <= 1) {
    if (impairmentProfile === 'composed') throw new Error('Single-modifier Journey unexpectedly resolved as composed.');
    return normalizePortableJourneyScenario({
      schema: JOURNEY_SCENARIO_SCHEMA,
      version: JOURNEY_SCENARIO_VERSION,
      name: input.name,
      hostname: input.hostname,
      transportProfile: input.config.transportProfile,
      dnsProfile: input.config.dnsProfile,
      impairmentProfile,
      timeMs: input.timeMs,
    });
  }
  return normalizePortableJourneyScenario({
    schema: JOURNEY_SCENARIO_SCHEMA,
    version: JOURNEY_SCENARIO_VERSION_V2,
    name: input.name,
    hostname: input.hostname,
    transportProfile: input.config.transportProfile,
    dnsProfile: input.config.dnsProfile,
    modifiers: modifierIds,
    timeMs: input.timeMs,
  });
}

export function serializeJourneyScenario(scenario: PortableJourneyScenario): string {
  return JSON.stringify(normalizePortableJourneyScenario(scenario), null, 2);
}

export function parseJourneyScenarioJson(json: string): PortableJourneyScenario {
  let parsed: unknown;
  try { parsed = JSON.parse(json); } catch { throw new Error('Journey scenario file is not valid JSON.'); }
  return normalizePortableJourneyScenario(parsed);
}

export function encodeJourneyQuery(scenario: PortableJourneyScenario): string {
  const normalized = normalizePortableJourneyScenario(scenario);
  const params = new URLSearchParams();
  params.set('journey', String(normalized.version));
  params.set('host', normalized.hostname);
  params.set('transport', normalized.transportProfile);
  params.set('dns', normalized.dnsProfile);
  if (normalized.version === JOURNEY_SCENARIO_VERSION) params.set('impairment', normalized.impairmentProfile);
  else params.set('mods', normalized.modifiers.join(','));
  params.set('t', String(normalized.timeMs));
  if (normalized.name) params.set('name', normalized.name);
  return `?${params.toString()}`;
}

export function decodeJourneyQuery(search: string): PortableJourneyScenario | null {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const journeyVersion = params.get('journey');
  if (journeyVersion !== '1' && journeyVersion !== '2') return null;
  const rawTime = params.get('t');
  if (rawTime === null || !/^\d+$/.test(rawTime)) throw new Error('Shared Journey time must be a non-negative integer.');

  if (journeyVersion === '1') {
    return normalizePortableJourneyScenario({
      schema: JOURNEY_SCENARIO_SCHEMA,
      version: JOURNEY_SCENARIO_VERSION,
      name: params.get('name') ?? undefined,
      hostname: params.get('host') ?? '',
      transportProfile: params.get('transport'),
      dnsProfile: params.get('dns'),
      impairmentProfile: params.get('impairment'),
      timeMs: Number(rawTime),
    });
  }

  const rawModifiers = params.get('mods');
  return normalizePortableJourneyScenario({
    schema: JOURNEY_SCENARIO_SCHEMA,
    version: JOURNEY_SCENARIO_VERSION_V2,
    name: params.get('name') ?? undefined,
    hostname: params.get('host') ?? '',
    transportProfile: params.get('transport'),
    dnsProfile: params.get('dns'),
    modifiers: rawModifiers === null ? null : rawModifiers.split(',').filter(Boolean),
    timeMs: Number(rawTime),
  });
}

export function buildJourneyShareUrl(baseUrl: string, scenario: PortableJourneyScenario): string {
  const url = new URL(baseUrl);
  url.search = encodeJourneyQuery(scenario).slice(1);
  url.hash = '';
  return url.toString();
}
