import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DEFAULT_LOOPBACK_BRIDGE_ORIGIN,
  LOOPBACK_BRIDGE_HANDSHAKE_PATH,
  LOOPBACK_BRIDGE_REPORT_PATH,
  connectLoopbackBridge,
  fetchLoopbackBridgeReport,
  normalizeLoopbackBridgeOrigin,
  parseLoopbackBridgeHandshake,
} from '../src/measurement/loopbackBridge.ts';
import { buildJourneyScenario, journeyStateAt } from '../src/journey/model.ts';

const handshake = {
  schema: 'hopscotch.network-diagnostics-bridge',
  version: 1,
  application: 'Network Diagnostics Suite',
  reportSchemaVersion: '2.0',
  reportPath: LOOPBACK_BRIDGE_REPORT_PATH,
  bridgeVersion: '0.1.0',
  capabilities: ['report-v2'],
};

const report = {
  schemaVersion: '2.0',
  generatedAt: '2026-08-12T00:10:05.000Z',
  producer: {
    application: 'desktop',
    version: '0.9.0',
    engine: 'Network Diagnostics Engine',
  },
  run: {
    id: 'run-09f-fixture',
    platform: 'macOS 15.6 arm64',
    architecture: 'arm64',
    profile: 'quick',
    transferMethod: 'single',
    startedAt: '2026-08-12T00:10:00.000Z',
    completedAt: '2026-08-12T00:10:04.000Z',
    includesLocalAddresses: false,
  },
  measurement: {
    selectedInterface: {
      id: 'en0',
      name: 'Wi-Fi',
      type: 'wireless',
      linkSpeedMbps: 866,
      bindingScope: 'explicit',
    },
  },
};

assert.equal(DEFAULT_LOOPBACK_BRIDGE_ORIGIN, 'http://127.0.0.1:8765');
assert.equal(normalizeLoopbackBridgeOrigin('http://localhost:8765'), 'http://localhost:8765');
assert.equal(normalizeLoopbackBridgeOrigin('https://127.12.34.56:9443/'), 'https://127.12.34.56:9443');
assert.equal(normalizeLoopbackBridgeOrigin('http://[::1]:8765'), 'http://[::1]:8765');

for (const invalid of [
  'https://192.168.1.10:8765',
  'http://10.0.0.5:8765',
  'http://router.local:8765',
  'http://localhost.example:8765',
  'http://user:pass@localhost:8765',
  'ftp://localhost:8765',
  'http://localhost:8765/report',
  'http://localhost:8765/?target=other',
]) {
  assert.throws(() => normalizeLoopbackBridgeOrigin(invalid), undefined, `must reject non-loopback/arbitrary bridge origin: ${invalid}`);
}

assert.deepEqual(parseLoopbackBridgeHandshake(handshake), handshake);
for (const invalid of [
  { ...handshake, schema: 'other' },
  { ...handshake, version: 2 },
  { ...handshake, application: 'Other App' },
  { ...handshake, reportSchemaVersion: '3.0' },
  { ...handshake, reportPath: '/arbitrary/report' },
  { ...handshake, capabilities: ['report-v2', 'shell'] },
  { ...handshake, facts: [{ id: 'laundered' }] },
]) {
  assert.throws(() => parseLoopbackBridgeHandshake(invalid), undefined, 'invalid/expanded handshake must fail closed');
}

const calls = [];
const fetchImpl = async (url, init) => {
  calls.push({ url: String(url), init });
  const body = calls.length === 1 ? handshake : report;
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
};

const journeyBefore = buildJourneyScenario('example.test', {
  transportProfile: 'quic-h3',
  dnsProfile: 'cache-hit',
  impairmentProfile: 'clean',
});
const journeyBytesBefore = JSON.stringify(journeyBefore);
const stateBytesBefore = JSON.stringify(journeyStateAt(journeyBefore, Math.floor(journeyBefore.durationMs * 0.7)));

const connection = await connectLoopbackBridge('http://127.0.0.1:8765', { fetchImpl, timeoutMs: 1000 });
assert.equal(connection.origin, 'http://127.0.0.1:8765');
assert.equal(connection.handshakeUrl, `http://127.0.0.1:8765${LOOPBACK_BRIDGE_HANDSHAKE_PATH}`);
assert.equal(connection.reportUrl, `http://127.0.0.1:8765${LOOPBACK_BRIDGE_REPORT_PATH}`);
assert.deepEqual(connection.handshake, handshake);
assert.equal(calls.length, 1, 'connect must perform exactly one handshake request');

const ingestion = await fetchLoopbackBridgeReport(connection, { fetchImpl, timeoutMs: 1000 });
assert.equal(calls.length, 2, 'explicit report refresh must perform exactly one additional request');
assert.equal(ingestion.snapshot.schema, 'hopscotch.native-measurement');
assert.equal(ingestion.snapshot.provenance, 'LOCAL MEASURED');
assert.equal(ingestion.state.schema, 'hopscotch.measured-state');
assert.equal(ingestion.state.provenance, 'LOCAL MEASURED');
assert.equal(ingestion.snapshot.source.adapter, 'network-diagnostics-suite-report-v2');

for (const [index, call] of calls.entries()) {
  assert.equal(call.init.method, 'GET');
  assert.equal(call.init.mode, 'cors');
  assert.equal(call.init.credentials, 'omit');
  assert.equal(call.init.cache, 'no-store');
  assert.equal(call.init.redirect, 'error');
  assert.equal(call.init.headers.Accept, 'application/json');
  assert.ok(call.init.signal instanceof AbortSignal);
  if (index === 0) assert.ok(call.url.endsWith(LOOPBACK_BRIDGE_HANDSHAKE_PATH));
  else assert.ok(call.url.endsWith(LOOPBACK_BRIDGE_REPORT_PATH));
}

const journeyAfter = buildJourneyScenario('example.test', {
  transportProfile: 'quic-h3',
  dnsProfile: 'cache-hit',
  impairmentProfile: 'clean',
});
assert.equal(JSON.stringify(journeyAfter), journeyBytesBefore, 'bridge ingestion must not mutate Journey construction');
assert.equal(JSON.stringify(journeyStateAt(journeyAfter, Math.floor(journeyAfter.durationMs * 0.7))), stateBytesBefore, 'bridge ingestion must not mutate Journey reducer state');

const invalidReportFetch = async (url) => new Response(JSON.stringify(String(url).endsWith(LOOPBACK_BRIDGE_HANDSHAKE_PATH) ? handshake : { schemaVersion: '99.0' }), {
  status: 200,
  headers: { 'content-type': 'application/json' },
});
const invalidConnection = await connectLoopbackBridge('http://localhost:8765', { fetchImpl: invalidReportFetch, timeoutMs: 1000 });
await assert.rejects(() => fetchLoopbackBridgeReport(invalidConnection, { fetchImpl: invalidReportFetch, timeoutMs: 1000 }), /schemaVersion must be 2\.0/);

let nonLoopbackFetches = 0;
await assert.rejects(
  () => connectLoopbackBridge('http://192.168.1.50:8765', { fetchImpl: async () => { nonLoopbackFetches += 1; throw new Error('should not fetch'); } }),
  /loopback|localhost|127\.0\.0\.0\/8|::1/i,
);
assert.equal(nonLoopbackFetches, 0, 'non-loopback input must fail before any network request');

const source = readFileSync(new URL('../src/measurement/loopbackBridge.ts', import.meta.url), 'utf8');
assert.doesNotMatch(source, /setInterval\s*\(|setTimeout\s*\(/, 'bridge model must not implement polling or timer loops');
assert.doesNotMatch(source, /WebSocket|EventSource/, '09F bridge model must remain one-shot HTTP rather than streaming');
assert.match(source, /credentials:\s*'omit'/, 'bridge requests must omit credentials');
assert.match(source, /ingestNetworkDiagnosticsReportV2\(report\)/, 'bridge report must enter the existing 09C ingestion path');
assert.doesNotMatch(source, /journey\//i, 'bridge transport must not import Journey code');

console.log('Loopback bridge contract passed: loopback-only explicit fetches, strict handshake, fixed report path, omitted credentials, bounded requests, 09C ingestion, and unchanged Journey truth.');
