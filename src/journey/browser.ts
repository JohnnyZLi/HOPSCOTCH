import type { JourneyScenarioConfig } from './model.ts';
import {
  impairmentProfileForModifiers,
  normalizeJourneyModifierIds,
  resolveJourneyModifierIds,
} from './modifiers.ts';
import {
  decodeJourneyQuery,
  scenarioConfigFromPortable,
  type PortableJourneyScenario,
} from './scenario.ts';

const TRANSPORT_KEY = 'hopscotch.journey.transport-profile';
const DNS_KEY = 'hopscotch.journey.dns-profile';
const IMPAIRMENT_KEY = 'hopscotch.journey.impairment-profile';
const MODIFIERS_KEY = 'hopscotch.journey.modifiers';
let journeyClockSuspended = false;

export interface JourneyBrowserBootstrap {
  scenario: PortableJourneyScenario | null;
  error: string | null;
}

export function readJourneyBrowserConfig(storage: Pick<Storage, 'getItem'> = sessionStorage): JourneyScenarioConfig {
  const transportProfile = storage.getItem(TRANSPORT_KEY) === 'quic-h3' ? 'quic-h3' : 'tcp-h2';
  const dnsProfile = storage.getItem(DNS_KEY) === 'cache-hit' ? 'cache-hit' : 'cache-miss';
  const storedModifiers = storage.getItem(MODIFIERS_KEY);

  if (storedModifiers !== null) {
    try {
      const parsed: unknown = JSON.parse(storedModifiers);
      if (!Array.isArray(parsed)) throw new Error('Stored Journey modifiers are not an array.');
      const modifierIds = normalizeJourneyModifierIds(parsed);
      const impairmentProfile = impairmentProfileForModifiers(modifierIds);
      if (modifierIds.length > 1) return { transportProfile, dnsProfile, impairmentProfile, modifierIds };
      return { transportProfile, dnsProfile, impairmentProfile };
    } catch {
      // Fall through to the schema-v1 storage key for backwards compatibility.
    }
  }

  const storedImpairment = storage.getItem(IMPAIRMENT_KEY);
  return {
    transportProfile,
    dnsProfile,
    impairmentProfile: storedImpairment === 'single-loss' || storedImpairment === 'latency-spike' || storedImpairment === 'route-failure' || storedImpairment === 'path-outage' || storedImpairment === 'congestion' ? storedImpairment : 'clean',
  };
}

export function writeJourneyBrowserConfig(config: JourneyScenarioConfig, storage: Pick<Storage, 'setItem'> = sessionStorage): void {
  const modifierIds = resolveJourneyModifierIds(config);
  const impairmentProfile = impairmentProfileForModifiers(modifierIds);
  storage.setItem(TRANSPORT_KEY, config.transportProfile);
  storage.setItem(DNS_KEY, config.dnsProfile);
  storage.setItem(MODIFIERS_KEY, JSON.stringify(modifierIds));
  storage.setItem(IMPAIRMENT_KEY, impairmentProfile === 'composed' ? 'clean' : impairmentProfile);
}

export function seedJourneyBrowserScenario(scenario: PortableJourneyScenario, storage: Pick<Storage, 'setItem'> = sessionStorage): void {
  writeJourneyBrowserConfig(scenarioConfigFromPortable(scenario), storage);
}

export function suspendJourneyClock(): void { journeyClockSuspended = true; }
export function resumeJourneyClock(): void { journeyClockSuspended = false; }
export function isJourneyClockSuspended(): boolean { return journeyClockSuspended; }

export function bootstrapJourneyFromSearch(search: string, storage: Pick<Storage, 'setItem'> = sessionStorage): JourneyBrowserBootstrap {
  try {
    const scenario = decodeJourneyQuery(search);
    if (scenario) seedJourneyBrowserScenario(scenario, storage);
    return { scenario, error: null };
  } catch (error) {
    return { scenario: null, error: error instanceof Error ? error.message : 'Invalid shared Journey link.' };
  }
}
