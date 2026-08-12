import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SCENARIO_PRESET_CARDS } from '../src/scenarios/catalog.ts';
import { scenarioForPreset } from '../src/journey/presets.ts';
import { decodeJourneyQuery, encodeJourneyQuery, scenarioConfigFromPortable } from '../src/journey/scenario.ts';
import { resolveJourneyModifierIds } from '../src/journey/modifiers.ts';

const gallery = readFileSync(new URL('../src/ScenarioGallery.tsx', import.meta.url), 'utf8');
const explore = readFileSync(new URL('../src/ExploreLauncher.tsx', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');

const expected = {
  'dns-outage': { modifier: 'dns-failure', transport: 'tcp-h2' },
  'route-failover': { modifier: 'route-failure', transport: 'tcp-h2' },
  'path-outage': { modifier: 'path-outage', transport: 'tcp-h2' },
  congestion: { modifier: 'congestion', transport: 'tcp-h2' },
  'route-leak': { modifier: 'route-leak', transport: 'tcp-h2' },
  partition: { modifier: 'partition', transport: 'tcp-h2' },
  'server-503': { modifier: 'server-failure', transport: 'tcp-h2' },
  'quic-loss': { modifier: 'single-loss', transport: 'quic-h3' },
};

assert.equal(SCENARIO_PRESET_CARDS.length, 8, 'scenario gallery must keep the curated eight-story set');
assert.deepEqual(SCENARIO_PRESET_CARDS.map((preset) => preset.id), Object.keys(expected));

for (const preset of SCENARIO_PRESET_CARDS) {
  const scenario = scenarioForPreset(preset.id);
  const expectation = expected[preset.id];
  assert.equal(scenario.hostname, 'example.test');
  assert.equal(scenario.timeMs, 0, `${preset.id} must start at the beginning of the causal story`);
  assert.equal(scenario.transportProfile, expectation.transport, `${preset.id} transport mismatch`);
  assert.equal(scenario.dnsProfile, 'cache-miss', `${preset.id} must retain the full DNS-to-application Journey`);
  assert.deepEqual(resolveJourneyModifierIds(scenarioConfigFromPortable(scenario)), [expectation.modifier], `${preset.id} must use exactly one existing canonical modifier`);
  const query = encodeJourneyQuery(scenario);
  assert.deepEqual(decodeJourneyQuery(query), scenario, `${preset.id} must round-trip through the canonical share-query codec`);
}

for (const forbidden of [
  "./journey/",
  "./simulation/",
  "./measurement/",
  'fetch(',
  'XMLHttpRequest',
  'WebSocket',
  'localStorage',
  'sessionStorage',
]) {
  assert.ok(!gallery.includes(forbidden), `ScenarioGallery crossed presentation boundary with ${forbidden}`);
}

assert.match(gallery, /SCENARIO_PRESET_CARDS\.map/);
assert.match(gallery, /data-scenario-preset=\{preset\.id\}/);
assert.match(explore, /<ScenarioGallery onSelect=\{onScenarioSelect\}/);
assert.match(app, /scenarioForPreset\(presetId\)/);
assert.match(app, /encodeJourneyQuery\(scenario\)/);
assert.match(app, /`\/journey\$\{encodeJourneyQuery\(scenario\)\}`/);
assert.match(app, /setJourneyStartPlaying\(true\)/);
assert.match(app, /onScenarioSelect=\{launchScenarioPreset\}/);

console.log('Lab 10D scenario gallery contract OK: eight one-click stories map to existing canonical Journey modifiers and share-query truth.');
