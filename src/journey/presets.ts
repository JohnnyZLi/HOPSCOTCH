import type { ScenarioPresetId } from '../scenarios/catalog.ts';
import type { JourneyScenarioConfig } from './model.ts';
import { createPortableJourneyScenario, type PortableJourneyScenario } from './scenario.ts';

type PresetDefinition = {
  name: string;
  config: JourneyScenarioConfig;
};

const TCP_MISS = { transportProfile: 'tcp-h2', dnsProfile: 'cache-miss' } as const;

const PRESET_DEFINITIONS: Readonly<Record<ScenarioPresetId, PresetDefinition>> = {
  'dns-outage': {
    name: 'DNS resolver outage',
    config: { ...TCP_MISS, impairmentProfile: 'dns-failure' },
  },
  'route-failover': {
    name: 'Primary route failover',
    config: { ...TCP_MISS, impairmentProfile: 'route-failure' },
  },
  'path-outage': {
    name: 'Mid-transfer path outage',
    config: { ...TCP_MISS, impairmentProfile: 'path-outage' },
  },
  congestion: {
    name: 'Congestion with ECN feedback',
    config: { ...TCP_MISS, impairmentProfile: 'congestion' },
  },
  'route-leak': {
    name: 'BGP route leak',
    config: { ...TCP_MISS, impairmentProfile: 'route-leak' },
  },
  partition: {
    name: 'Terminal network partition',
    config: { ...TCP_MISS, impairmentProfile: 'partition' },
  },
  'server-503': {
    name: 'HTTP 503 safe retry',
    config: { ...TCP_MISS, impairmentProfile: 'server-failure' },
  },
  'quic-loss': {
    name: 'HTTP/3 packet loss recovery',
    config: { transportProfile: 'quic-h3', dnsProfile: 'cache-miss', impairmentProfile: 'single-loss' },
  },
};

export function scenarioForPreset(id: ScenarioPresetId): PortableJourneyScenario {
  const preset = PRESET_DEFINITIONS[id];
  return createPortableJourneyScenario({
    name: preset.name,
    hostname: 'example.test',
    config: preset.config,
    timeMs: 0,
  });
}
