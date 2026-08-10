import type { JourneyScenarioConfig } from './model.ts';
import { decodeJourneyQuery, type PortableJourneyScenarioV1 } from './scenario.ts';

const TRANSPORT_KEY = 'hopscotch.journey.transport-profile';
const DNS_KEY = 'hopscotch.journey.dns-profile';
const IMPAIRMENT_KEY = 'hopscotch.journey.impairment-profile';
let journeyClockSuspended = false;

export interface JourneyBrowserBootstrap {
  scenario: PortableJourneyScenarioV1 | null;
  error: string | null;
}

export function readJourneyBrowserConfig(storage: Pick<Storage, 'getItem'> = sessionStorage): JourneyScenarioConfig {
  return {
    transportProfile: storage.getItem(TRANSPORT_KEY) === 'quic-h3' ? 'quic-h3' : 'tcp-h2',
    dnsProfile: storage.getItem(DNS_KEY) === 'cache-hit' ? 'cache-hit' : 'cache-miss',
    impairmentProfile: storage.getItem(IMPAIRMENT_KEY) === 'single-loss' ? 'single-loss' : 'clean',
  };
}

export function writeJourneyBrowserConfig(
  config: JourneyScenarioConfig,
  storage: Pick<Storage, 'setItem'> = sessionStorage,
): void {
  storage.setItem(TRANSPORT_KEY, config.transportProfile);
  storage.setItem(DNS_KEY, config.dnsProfile);
  storage.setItem(IMPAIRMENT_KEY, config.impairmentProfile);
}

export function seedJourneyBrowserScenario(
  scenario: PortableJourneyScenarioV1,
  storage: Pick<Storage, 'setItem'> = sessionStorage,
): void {
  writeJourneyBrowserConfig({
    transportProfile: scenario.transportProfile,
    dnsProfile: scenario.dnsProfile,
    impairmentProfile: scenario.impairmentProfile,
  }, storage);
}

export function suspendJourneyClock(): void {
  journeyClockSuspended = true;
}

export function resumeJourneyClock(): void {
  journeyClockSuspended = false;
}

export function isJourneyClockSuspended(): boolean {
  return journeyClockSuspended;
}

export function bootstrapJourneyFromSearch(
  search: string,
  storage: Pick<Storage, 'setItem'> = sessionStorage,
): JourneyBrowserBootstrap {
  try {
    const scenario = decodeJourneyQuery(search);
    if (scenario) seedJourneyBrowserScenario(scenario, storage);
    return { scenario, error: null };
  } catch (error) {
    return {
      scenario: null,
      error: error instanceof Error ? error.message : 'Invalid shared Journey link.',
    };
  }
}
