import assert from 'node:assert/strict';
import { buildJourneyScenario, journeyStateAt } from '../src/journey/model.ts';
import {
  JOURNEY_SCENARIO_SCHEMA,
  JOURNEY_SCENARIO_VERSION,
  JOURNEY_SCENARIO_VERSION_V2,
  buildJourneyShareUrl,
  createPortableJourneyScenario,
  decodeJourneyQuery,
  encodeJourneyQuery,
  normalizePortableJourneyScenario,
  parseJourneyScenarioJson,
  scenarioConfigFromPortable,
  serializeJourneyScenario,
} from '../src/journey/scenario.ts';

const transports = ['tcp-h2', 'quic-h3'];
const dnsProfiles = ['cache-miss', 'cache-hit'];
const impairments = ['clean', 'single-loss', 'latency-spike', 'route-failure'];

// Every legacy zero/single-modifier scenario remains schema v1 byte/shape compatible.
for (const transportProfile of transports) {
  for (const dnsProfile of dnsProfiles) {
    for (const impairmentProfile of impairments) {
      const config = { transportProfile, dnsProfile, impairmentProfile };
      const generated = buildJourneyScenario('example.test', config);
      const requestedTime = Math.floor(generated.durationMs * 0.57);
      const portable = createPortableJourneyScenario({
        name: '  Failure story  ',
        hostname: 'Example.Test.',
        config,
        timeMs: requestedTime,
      });

      assert.equal(portable.schema, JOURNEY_SCENARIO_SCHEMA);
      assert.equal(portable.version, JOURNEY_SCENARIO_VERSION);
      assert.equal(portable.name, 'Failure story');
      assert.equal(portable.hostname, 'example.test');
      assert.equal(portable.transportProfile, transportProfile);
      assert.equal(portable.dnsProfile, dnsProfile);
      assert.equal(portable.impairmentProfile, impairmentProfile);
      assert.equal(portable.timeMs, requestedTime);

      const json = serializeJourneyScenario(portable);
      assert.deepEqual(parseJourneyScenarioJson(json), portable);

      const query = encodeJourneyQuery(portable);
      assert.match(query, /^\?journey=1&host=example\.test&transport=/);
      const queryParams = new URLSearchParams(query.slice(1));
      assert.equal(queryParams.get('transport'), transportProfile);
      assert.equal(queryParams.get('dns'), dnsProfile);
      assert.equal(queryParams.get('impairment'), impairmentProfile);
      assert.equal(queryParams.get('mods'), null);
      assert.deepEqual(decodeJourneyQuery(query), portable);

      const restoredConfig = scenarioConfigFromPortable(portable);
      assert.deepEqual(restoredConfig, config);
      const restoredScenario = buildJourneyScenario(portable.hostname, restoredConfig);
      assert.equal(restoredScenario.id, generated.id);
      assert.equal(journeyStateAt(restoredScenario, portable.timeMs).timeMs, requestedTime);
    }
  }
}

const quicLossConfig = {
  transportProfile: 'quic-h3',
  dnsProfile: 'cache-hit',
  impairmentProfile: 'single-loss',
};
const quicLoss = buildJourneyScenario('example.test', quicLossConfig);
assert.equal(quicLoss.durationMs, 17900);

const clampedV1 = normalizePortableJourneyScenario({
  schema: JOURNEY_SCENARIO_SCHEMA,
  version: JOURNEY_SCENARIO_VERSION,
  name: 'Beyond the end',
  hostname: 'example.test',
  ...quicLossConfig,
  timeMs: 999999,
});
assert.equal(clampedV1.version, 1);
assert.equal(clampedV1.timeMs, 17900);

const recovery = createPortableJourneyScenario({
  hostname: 'example.test',
  config: quicLossConfig,
  timeMs: 10950,
});
assert.equal(recovery.version, 1);
assert.equal(journeyStateAt(quicLoss, recovery.timeMs).activeEvent.id, 'quic-recovered');

const legacyShareUrl = buildJourneyShareUrl('https://hopscotch.johnnyli.dev/?old=1#ignored', recovery);
const legacyParsedUrl = new URL(legacyShareUrl);
assert.equal(legacyParsedUrl.origin, 'https://hopscotch.johnnyli.dev');
assert.equal(legacyParsedUrl.pathname, '/');
assert.equal(legacyParsedUrl.hash, '');
assert.equal(legacyParsedUrl.searchParams.get('journey'), '1');
assert.equal(legacyParsedUrl.searchParams.get('host'), 'example.test');
assert.equal(legacyParsedUrl.searchParams.get('transport'), 'quic-h3');
assert.equal(legacyParsedUrl.searchParams.get('dns'), 'cache-hit');
assert.equal(legacyParsedUrl.searchParams.get('impairment'), 'single-loss');
assert.equal(legacyParsedUrl.searchParams.get('t'), '10950');
assert.deepEqual(decodeJourneyQuery(legacyParsedUrl.search), recovery);

// Composed scenarios use schema v2 and canonical modifier order regardless of input order.
const composedConfig = {
  transportProfile: 'quic-h3',
  dnsProfile: 'cache-hit',
  impairmentProfile: 'composed',
  modifierIds: ['latency-spike', 'route-failure', 'single-loss'],
};
const composedGenerated = buildJourneyScenario('example.test', composedConfig);
assert.equal(composedGenerated.durationMs, 20500);
assert.deepEqual(composedGenerated.modifierIds, ['route-failure', 'single-loss', 'latency-spike']);

const composed = createPortableJourneyScenario({
  name: '  Route loss latency  ',
  hostname: 'Example.Test.',
  config: composedConfig,
  timeMs: 10200,
});
assert.equal(composed.schema, JOURNEY_SCENARIO_SCHEMA);
assert.equal(composed.version, JOURNEY_SCENARIO_VERSION_V2);
assert.equal(composed.name, 'Route loss latency');
assert.equal(composed.hostname, 'example.test');
assert.equal(composed.transportProfile, 'quic-h3');
assert.equal(composed.dnsProfile, 'cache-hit');
assert.deepEqual(composed.modifiers, ['route-failure', 'single-loss', 'latency-spike']);
assert.equal(composed.timeMs, 10200);
assert.deepEqual(parseJourneyScenarioJson(serializeJourneyScenario(composed)), composed);

const composedQuery = encodeJourneyQuery(composed);
const composedParams = new URLSearchParams(composedQuery.slice(1));
assert.equal(composedParams.get('journey'), '2');
assert.equal(composedParams.get('host'), 'example.test');
assert.equal(composedParams.get('transport'), 'quic-h3');
assert.equal(composedParams.get('dns'), 'cache-hit');
assert.equal(composedParams.get('mods'), 'route-failure,single-loss,latency-spike');
assert.equal(composedParams.get('impairment'), null);
assert.equal(composedParams.get('t'), '10200');
assert.deepEqual(decodeJourneyQuery(composedQuery), composed);

const composedRestoredConfig = scenarioConfigFromPortable(composed);
assert.deepEqual(composedRestoredConfig, {
  transportProfile: 'quic-h3',
  dnsProfile: 'cache-hit',
  impairmentProfile: 'composed',
  modifierIds: ['route-failure', 'single-loss', 'latency-spike'],
});
const composedRestored = buildJourneyScenario(composed.hostname, composedRestoredConfig);
assert.equal(composedRestored.id, composedGenerated.id);
assert.deepEqual(composedRestored.modifierIds, composedGenerated.modifierIds);
assert.equal(journeyStateAt(composedRestored, composed.timeMs).timeMs, 10200);

const composedShareUrl = buildJourneyShareUrl('https://hopscotch.johnnyli.dev/?old=1#ignored', composed);
const composedParsedUrl = new URL(composedShareUrl);
assert.equal(composedParsedUrl.searchParams.get('journey'), '2');
assert.equal(composedParsedUrl.searchParams.get('mods'), 'route-failure,single-loss,latency-spike');
assert.equal(composedParsedUrl.hash, '');
assert.deepEqual(decodeJourneyQuery(composedParsedUrl.search), composed);

const clampedV2 = normalizePortableJourneyScenario({
  schema: JOURNEY_SCENARIO_SCHEMA,
  version: JOURNEY_SCENARIO_VERSION_V2,
  hostname: 'example.test',
  transportProfile: 'quic-h3',
  dnsProfile: 'cache-hit',
  modifiers: ['single-loss', 'route-failure'],
  timeMs: 999999,
});
assert.equal(clampedV2.version, 2);
assert.deepEqual(clampedV2.modifiers, ['route-failure', 'single-loss']);
assert.equal(clampedV2.timeMs, 19300);

assert.equal(decodeJourneyQuery('?foo=bar'), null);
assert.equal(decodeJourneyQuery('?journey=0&host=example.test'), null);
assert.equal(decodeJourneyQuery('?journey=3&host=example.test'), null);

const baseV1 = {
  schema: JOURNEY_SCENARIO_SCHEMA,
  version: JOURNEY_SCENARIO_VERSION,
  hostname: 'example.test',
  transportProfile: 'tcp-h2',
  dnsProfile: 'cache-miss',
  impairmentProfile: 'clean',
  timeMs: 0,
};
assert.throws(() => normalizePortableJourneyScenario({ ...baseV1, schema: 'other' }), /schema/i);
assert.throws(() => normalizePortableJourneyScenario({ ...baseV1, version: 3 }), /version/i);
assert.throws(() => normalizePortableJourneyScenario({ ...baseV1, hostname: 'https://example.test/' }), /hostname only/i);
assert.throws(() => normalizePortableJourneyScenario({ ...baseV1, transportProfile: 'tcp-h3' }), /transport/i);
assert.throws(() => normalizePortableJourneyScenario({ ...baseV1, dnsProfile: 'maybe' }), /DNS profile/i);
assert.throws(() => normalizePortableJourneyScenario({ ...baseV1, impairmentProfile: 'random-loss' }), /impairment/i);
assert.throws(() => normalizePortableJourneyScenario({ ...baseV1, timeMs: -1 }), /timeMs/i);
assert.throws(() => normalizePortableJourneyScenario({ ...baseV1, timeMs: 1.5 }), /timeMs/i);
assert.throws(() => normalizePortableJourneyScenario({ ...baseV1, name: 'x'.repeat(81) }), /80 characters/i);
assert.throws(() => parseJourneyScenarioJson('{oops'), /valid JSON/i);

const baseV2 = {
  schema: JOURNEY_SCENARIO_SCHEMA,
  version: JOURNEY_SCENARIO_VERSION_V2,
  hostname: 'example.test',
  transportProfile: 'quic-h3',
  dnsProfile: 'cache-hit',
  modifiers: ['route-failure', 'single-loss'],
  timeMs: 0,
};
assert.throws(() => normalizePortableJourneyScenario({ ...baseV2, modifiers: ['single-loss'] }), /at least two modifiers/i);
assert.throws(() => normalizePortableJourneyScenario({ ...baseV2, modifiers: ['route-failure', 'unknown'] }), /unknown journey modifier/i);
assert.throws(() => normalizePortableJourneyScenario({ ...baseV2, modifiers: 'route-failure,single-loss' }), /must be an array/i);
assert.throws(() => decodeJourneyQuery('?journey=2&host=example.test&transport=quic-h3&dns=cache-hit&t=100'), /modifiers must be an array/i);
assert.throws(() => decodeJourneyQuery('?journey=1&host=example.test&transport=tcp-h2&dns=cache-miss&impairment=clean&t=-1'), /non-negative integer/i);
assert.throws(() => decodeJourneyQuery('?journey=2&host=example.test&transport=quic-h3&dns=cache-hit&mods=route-failure,single-loss&t=1.5'), /non-negative integer/i);

console.log('Journey sharing contract passed: schema v1 compatibility plus canonical schema v2 composed JSON/query round trips.');
