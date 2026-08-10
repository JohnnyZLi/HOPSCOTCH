import assert from 'node:assert/strict';
import { buildJourneyScenario, journeyStateAt } from '../src/journey/model.ts';
import {
  JOURNEY_SCENARIO_SCHEMA,
  JOURNEY_SCENARIO_VERSION,
  buildJourneyShareUrl,
  createPortableJourneyScenario,
  decodeJourneyQuery,
  encodeJourneyQuery,
  normalizePortableJourneyScenario,
  parseJourneyScenarioJson,
  scenarioConfigFromPortable,
  serializeJourneyScenario,
} from '../src/journey/scenario.ts';

const profiles = [
  ['tcp-h2', 'cache-miss', 'clean'],
  ['tcp-h2', 'cache-hit', 'clean'],
  ['quic-h3', 'cache-miss', 'clean'],
  ['quic-h3', 'cache-hit', 'clean'],
  ['tcp-h2', 'cache-miss', 'single-loss'],
  ['tcp-h2', 'cache-hit', 'single-loss'],
  ['quic-h3', 'cache-miss', 'single-loss'],
  ['quic-h3', 'cache-hit', 'single-loss'],
];

for (const [transportProfile, dnsProfile, impairmentProfile] of profiles) {
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
  assert.ok(query.includes(`transport=${transportProfile}`));
  assert.ok(query.includes(`dns=${dnsProfile}`));
  assert.ok(query.includes(`impairment=${impairmentProfile}`));
  assert.deepEqual(decodeJourneyQuery(query), portable);

  const restoredConfig = scenarioConfigFromPortable(portable);
  assert.deepEqual(restoredConfig, config);
  const restoredScenario = buildJourneyScenario(portable.hostname, restoredConfig);
  assert.equal(restoredScenario.id, generated.id);
  assert.equal(journeyStateAt(restoredScenario, portable.timeMs).timeMs, requestedTime);
}

const quicLossConfig = {
  transportProfile: 'quic-h3',
  dnsProfile: 'cache-hit',
  impairmentProfile: 'single-loss',
};
const quicLoss = buildJourneyScenario('example.test', quicLossConfig);
assert.equal(quicLoss.durationMs, 14400);

const clamped = normalizePortableJourneyScenario({
  schema: JOURNEY_SCENARIO_SCHEMA,
  version: JOURNEY_SCENARIO_VERSION,
  name: 'Beyond the end',
  hostname: 'example.test',
  ...quicLossConfig,
  timeMs: 999999,
});
assert.equal(clamped.timeMs, 14400);

const recovery = createPortableJourneyScenario({
  hostname: 'example.test',
  config: quicLossConfig,
  timeMs: 8300,
});
assert.equal(journeyStateAt(quicLoss, recovery.timeMs).activeEvent.id, 'quic-recovered');

const shareUrl = buildJourneyShareUrl('https://hopscotch.johnnyli.dev/?old=1#ignored', recovery);
const parsedUrl = new URL(shareUrl);
assert.equal(parsedUrl.origin, 'https://hopscotch.johnnyli.dev');
assert.equal(parsedUrl.pathname, '/');
assert.equal(parsedUrl.hash, '');
assert.equal(parsedUrl.searchParams.get('journey'), '1');
assert.equal(parsedUrl.searchParams.get('host'), 'example.test');
assert.equal(parsedUrl.searchParams.get('transport'), 'quic-h3');
assert.equal(parsedUrl.searchParams.get('dns'), 'cache-hit');
assert.equal(parsedUrl.searchParams.get('impairment'), 'single-loss');
assert.equal(parsedUrl.searchParams.get('t'), '8300');
assert.deepEqual(decodeJourneyQuery(parsedUrl.search), recovery);

assert.equal(decodeJourneyQuery('?foo=bar'), null);
assert.equal(decodeJourneyQuery('?journey=0&host=example.test'), null);

const base = {
  schema: JOURNEY_SCENARIO_SCHEMA,
  version: JOURNEY_SCENARIO_VERSION,
  hostname: 'example.test',
  transportProfile: 'tcp-h2',
  dnsProfile: 'cache-miss',
  impairmentProfile: 'clean',
  timeMs: 0,
};
assert.throws(() => normalizePortableJourneyScenario({ ...base, schema: 'other' }), /schema/i);
assert.throws(() => normalizePortableJourneyScenario({ ...base, version: 2 }), /version/i);
assert.throws(() => normalizePortableJourneyScenario({ ...base, hostname: 'https://example.test/' }), /hostname only/i);
assert.throws(() => normalizePortableJourneyScenario({ ...base, transportProfile: 'tcp-h3' }), /transport/i);
assert.throws(() => normalizePortableJourneyScenario({ ...base, dnsProfile: 'maybe' }), /DNS profile/i);
assert.throws(() => normalizePortableJourneyScenario({ ...base, impairmentProfile: 'random-loss' }), /impairment/i);
assert.throws(() => normalizePortableJourneyScenario({ ...base, timeMs: -1 }), /timeMs/i);
assert.throws(() => normalizePortableJourneyScenario({ ...base, timeMs: 1.5 }), /timeMs/i);
assert.throws(() => normalizePortableJourneyScenario({ ...base, name: 'x'.repeat(81) }), /80 characters/i);
assert.throws(() => parseJourneyScenarioJson('{oops'), /valid JSON/i);
assert.throws(() => decodeJourneyQuery('?journey=1&host=example.test&transport=tcp-h2&dns=cache-miss&impairment=clean&t=-1'), /non-negative integer/i);
assert.throws(() => decodeJourneyQuery('?journey=1&host=example.test&transport=tcp-h2&dns=cache-miss&impairment=clean&t=1.5'), /non-negative integer/i);

console.log('Journey sharing contract passed: schema v1 JSON + readable URL round trips across all 8 scenario combinations.');
