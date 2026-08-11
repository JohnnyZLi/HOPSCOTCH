import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  adaptNetworkDiagnosticsReportV2,
  ingestNetworkDiagnosticsReportV2,
} from '../src/measurement/networkDiagnosticsAdapter.ts';
import { parseNativeMeasurementSnapshot } from '../src/measurement/native.ts';
import { buildJourneyScenario, journeyStateAt } from '../src/journey/model.ts';

const report = {
  schemaVersion: '2.0',
  generatedAt: '2026-08-11T22:00:05.000Z',
  producer: {
    application: 'desktop',
    version: '0.9.0',
    engine: 'Network Diagnostics Engine',
  },
  run: {
    id: 'run-09c-fixture',
    platform: 'macOS 15.6 arm64',
    architecture: 'arm64',
    profile: 'extended',
    transferMethod: 'compare',
    startedAt: '2026-08-11T22:00:00.000Z',
    completedAt: '2026-08-11T22:00:04.000Z',
    includesLocalAddresses: true,
  },
  measurement: {
    contractVersion: '2.0',
    engine: 'native-v2',
    engineVersion: '2.0.0',
    capabilities: ['interface-selection', 'http3'],
    selectedInterface: {
      id: 'en0',
      name: 'Wi-Fi',
      description: 'Wireless LAN',
      type: 'wireless',
      linkSpeedMbps: 866,
      bindingScope: 'explicit',
      sourceAddress: '192.168.1.20',
    },
    network: {
      edge: 'SJC',
      network: 'PUBLIC-NETWORK-NOT-LOCAL',
      asn: 64500,
      protocol: 'HTTP/3',
    },
    http3: {
      advertised: true,
      observedProtocol: 'h3',
      note: 'BROWSER-EVIDENCE-NOT-LOCAL',
    },
  },
  deepDiagnostics: {
    schemaVersion: '1.2',
    generatedAt: '2026-08-11T22:00:04.000Z',
    target: 'example.test',
    operatingSystem: 'macOS',
    architecture: 'arm64',
    includesLocalAddresses: true,
    interfaces: [
      {
        name: 'en0',
        description: 'Wi-Fi',
        type: 'wireless',
        linkSpeedMbps: 866,
        ipv4Mtu: 1500,
        supportsIpv4: true,
        supportsIpv6: true,
        unicastAddresses: ['192.168.1.20', '2001:db8::20'],
        gateways: ['192.168.1.1'],
        dnsServers: ['192.168.1.1'],
      },
    ],
    gatewayPing: {
      label: 'Default gateway',
      address: '192.168.1.1',
      statistics: {
        sent: 4,
        received: 4,
        lost: 0,
        lossPercent: 0,
        minimumMs: 1.1,
        maximumMs: 2.3,
        meanMs: 1.6,
        medianMs: 1.5,
        p95Ms: 2.2,
        jitterMs: 0.4,
        samples: [1.1, 1.5, 1.7, 2.3],
      },
    },
    internetPing: {
      label: 'Internet target',
      address: '1.1.1.1',
      statistics: {
        sent: 5,
        received: 4,
        lost: 1,
        lossPercent: 20,
        minimumMs: 18,
        maximumMs: 31,
        meanMs: 23,
        medianMs: 22,
        p95Ms: 30,
        jitterMs: 4,
        samples: [18, 21, null, 22, 31],
      },
    },
    traceRoute: {
      target: 'example.test',
      resolvedAddress: '198.51.100.80',
      maximumHops: 20,
      reachedDestination: true,
      hops: [
        { hop: 1, address: '192.168.1.1', hostname: 'gateway.lan', roundTripsMs: [1.2, 1.4, 1.3], reachedDestination: false },
        { hop: 2, address: '203.0.113.1', hostname: 'access.example', roundTripsMs: [8.2, null, 8.7], reachedDestination: false },
        { hop: 3, address: '198.51.100.80', hostname: 'example.test', roundTripsMs: [20.1, 20.4, 20.2], reachedDestination: true },
      ],
    },
    dnsResolvers: [
      { name: 'Local resolver', address: '192.168.1.1', attempts: 3, successful: 2, minimumMs: 4, medianMs: 5, p95Ms: 7, maximumMs: 7 },
      { name: 'Backup resolver', address: '1.1.1.1', attempts: 2, successful: 0, error: 'timeout' },
    ],
    pathMtu: { target: 'example.test', payloadBytes: 1472, estimatedIpv4Mtu: 1500, status: 'available' },
    serviceEndpoints: [
      { name: 'HTTPS target', host: 'example.test', reachable: true, dnsMs: 8, tcpMs: 17, tlsMs: 24, tlsProtocol: 'TLS 1.3', applicationProtocol: 'h2' },
      { name: 'Unavailable service', host: 'offline.example.test', reachable: false, error: 'connect failed' },
    ],
    routing: {
      status: 'available',
      entries: [
        { destination: '0.0.0.0/0', gateway: '192.168.1.1', interfaceName: 'en0', metric: 10, addressFamily: 'IPv4', isDefault: true },
        { destination: '2001:db8::/32', gateway: 'fe80::1', interfaceName: 'en0', metric: 20, addressFamily: 'IPv6', isDefault: false },
      ],
    },
  },
  internetTransfer: {
    origin: 'https://speed.example.test',
    idleLatency: { sent: 5, received: 5, lost: 0, lossPercent: 0, minimumMs: 20, maximumMs: 26, meanMs: 23, medianMs: 23, p95Ms: 25, jitterMs: 2, samples: [20, 22, 23, 24, 26] },
    download: { mbps: 500, steadyMbps: 470, bytes: 125000000, durationMs: 2000, peakMbps: 540, stabilityPercent: 94, capReached: false, qualification: 'qualified' },
    upload: { mbps: 120, steadyMbps: 115, bytes: 30000000, durationMs: 2000, peakMbps: 128, stabilityPercent: 91, capReached: false, qualification: 'qualified' },
    downloadLatency: { statistics: { sent: 4, received: 4, lost: 0, lossPercent: 0, minimumMs: 32, maximumMs: 41, meanMs: 36, medianMs: 35, p95Ms: 40, jitterMs: 3, samples: [32, 35, 36, 41] }, increaseMs: 12, grade: 'A' },
    uploadLatency: { statistics: { sent: 4, received: 4, lost: 0, lossPercent: 0, minimumMs: 39, maximumMs: 54, meanMs: 45, medianMs: 44, p95Ms: 52, jitterMs: 5, samples: [39, 43, 44, 54] }, increaseMs: 21, grade: 'B' },
    flowMeasurements: [],
    downloadScaling: [],
    dataUsedBytes: 155000000,
  },
  localLink: {
    target: 'nas.local',
    resolvedAddress: '192.168.1.50',
    port: 5201,
    durationMs: 1000,
    concurrency: 2,
    latency: { sent: 3, received: 3, lost: 0, lossPercent: 0, minimumMs: 0.7, maximumMs: 1.1, meanMs: 0.9, medianMs: 0.9, p95Ms: 1.0, jitterMs: 0.1, samples: [0.7, 0.9, 1.1] },
    downloadMbps: 930,
    downloadBytes: 116250000,
    uploadMbps: 910,
    uploadBytes: 113750000,
  },
  dualStack: {
    ipv4: { family: 'IPv4', addressAvailable: true, address: '198.51.100.80', pingAvailable: true, pingMedianMs: 22, tcpReachable: true, tcpConnectMs: 17, tlsReachable: true, tlsHandshakeMs: 24, tlsProtocol: 'TLS 1.3', applicationProtocol: 'h2', httpReachable: true, httpResponseMs: 42, httpStatusCode: 200 },
    ipv6: { family: 'IPv6', addressAvailable: true, address: '2001:db8::80', pingAvailable: false, pingMedianMs: null, tcpReachable: true, tcpConnectMs: 21, tlsReachable: true, tlsHandshakeMs: 29, tlsProtocol: 'TLS 1.3', applicationProtocol: 'h2', httpReachable: true, httpResponseMs: 47, httpStatusCode: 200 },
    preferredFamily: 'IPv4',
    nat64Suspected: false,
    status: 'available',
    dnsResolutionMs: 9,
    ipv4AddressCount: 2,
    ipv6AddressCount: 1,
    parallelConnectWinner: 'IPv4',
    parallelConnectDifferenceMs: 4,
  },
  findings: [
    { id: 'derived-finding', category: 'latency', severity: 'warning', confidence: 'high', title: 'DERIVED-FINDING-NOT-MEASURED', summary: 'Do not import this as a fact.', evidence: [], recommendations: [] },
  ],
  browserEvidence: {
    edge: { edge: 'SJC', network: 'BROWSER-EDGE-NOT-MEASURED', asn: 64501 },
    serviceChecks: [{ id: 'browser-check', name: 'Browser check', reachable: true, durationMs: 12 }],
  },
  loadLocalization: {
    status: 'localized',
    likelyBoundary: 'access-link',
    summary: 'DERIVED-LOCALIZATION-NOT-MEASURED',
    targets: [],
  },
  networkChange: {
    before: { interfaceName: 'en0', addressFamilies: ['IPv4', 'IPv6'], tunnelInterfaces: [] },
    after: { interfaceName: 'en0', addressFamilies: ['IPv4', 'IPv6'], tunnelInterfaces: [] },
    changed: false,
    changes: [],
    captivePortalSuspected: false,
    publicNetworkBefore: { edge: 'SJC', network: 'PUBLIC-CONTEXT-BEFORE', asn: 64500 },
    publicNetworkAfter: { edge: 'SJC', network: 'PUBLIC-CONTEXT-AFTER', asn: 64500 },
    publicNetworkChanged: false,
  },
  hostResources: {
    processCpuPercent: 12,
    peakWorkingSetBytes: 123456789,
    managedMemoryBeforeBytes: 10000000,
    managedMemoryAfterBytes: 11000000,
    interfaces: [],
    potentialClientBottleneck: false,
    tcpSegmentsSent: 100,
    tcpSegmentsRetransmitted: 1,
    tcpRetransmissionPercent: 1,
  },
  annotations: { label: 'fixture', tags: ['lab09c'] },
  customExperimentalSection: {
    secret: 'UNKNOWN-EXTENSION-MUST-NOT-BECOME-MEASURED',
  },
};

const originalBytes = JSON.stringify(report);
const snapshot = adaptNetworkDiagnosticsReportV2(report);
assert.equal(JSON.stringify(report), originalBytes, 'adapter must not mutate the Network Diagnostics report');
assert.deepEqual(parseNativeMeasurementSnapshot(snapshot), snapshot, 'adapter output must pass the full 09A parser');
assert.equal(snapshot.schema, 'hopscotch.native-measurement');
assert.equal(snapshot.provenance, 'LOCAL MEASURED');
assert.equal(snapshot.source.adapter, 'network-diagnostics-suite-report-v2');
assert.equal(snapshot.source.adapterVersion, '1');
assert.equal(snapshot.source.platform, 'macos');
assert.equal(snapshot.source.tool, 'Network Diagnostics Engine');
assert.equal(snapshot.source.toolVersion, '0.9.0');
assert.deepEqual(snapshot.capture, { startedAt: report.run.startedAt, completedAt: report.run.completedAt });
assert.equal(snapshot.scope.target, null, 'combined reports must remain multi-target at the snapshot level');
assert.equal(snapshot.scope.globalComplete, false);
assert.ok(snapshot.scope.limitations.some((line) => line.includes('multi-target')));
assert.ok(snapshot.scope.limitations.some((line) => line.includes('run.completedAt')));

const ingestion = ingestNetworkDiagnosticsReportV2(report);
assert.deepEqual(ingestion.snapshot, snapshot);
assert.equal(ingestion.state.schema, 'hopscotch.measured-state');
assert.equal(ingestion.state.provenance, 'LOCAL MEASURED');
assert.equal(ingestion.state.snapshot.scope.globalComplete, false);
assert.equal(ingestion.state.snapshot.scope.target, null);
assert.ok(ingestion.skippedSections.some((line) => line.startsWith('browserEvidence:')));
assert.ok(ingestion.skippedSections.some((line) => line.startsWith('findings:')));
assert.ok(ingestion.skippedSections.some((line) => line.startsWith('unknown root fields ignored:')));

const factById = (id) => snapshot.facts.find((candidate) => candidate.id === id);
assert.equal(factById('selected-interface-name')?.value, 'Wi-Fi');
assert.equal(factById('selected-interface-link-speed')?.value, 866_000_000);
assert.equal(factById('selected-interface-link-speed')?.unit, 'bits-per-second');
assert.equal(factById('selected-interface-source-address')?.value, '192.168.1.20');
assert.deepEqual(factById('deep-interface-0-en0-unicastaddresses')?.value, ['192.168.1.20', '2001:db8::20']);
assert.equal(factById('route-0-0-0-0-0-0-gateway')?.value, '192.168.1.1');
assert.equal(factById('gateway-ping-median-ms')?.value, 1.5);
assert.equal(factById('internet-ping-loss-percent')?.value, 20);
assert.equal(factById('internet-ping-median-ms')?.availability, 'partial', 'partial ping delivery must remain partial');
assert.equal(factById('dns-resolver-0-local-resolver-median-ms')?.availability, 'partial');
assert.equal(factById('dns-resolver-1-backup-resolver-median-ms'), undefined, 'zero-success resolver must not fabricate a latency value');
assert.equal(factById('service-0-https-target-tls-ms')?.value, 24);
assert.equal(factById('internet-download-mbps')?.value, 500_000_000);
assert.equal(factById('internet-download-mbps')?.unit, 'bits-per-second');
assert.equal(factById('internet-data-used')?.value, 155_000_000);
assert.equal(factById('local-link-download')?.value, 930_000_000);
assert.equal(factById('dual-ipv4-tcp-connect')?.value, 17);
assert.equal(factById('dual-ipv6-ping-median'), undefined, 'missing optional timing must remain absent');

assert.deepEqual(factById('route-0-0-0-0-0-0-family')?.target, { kind: 'prefix', value: '0.0.0.0/0' });
assert.deepEqual(factById('service-0-https-target-reachable')?.target, { kind: 'service', value: 'example.test' });
assert.deepEqual(factById('internet-download-mbps')?.target, { kind: 'service', value: 'https://speed.example.test' });
assert.deepEqual(factById('dual-ipv4-tcp-connect')?.target, { kind: 'ip', value: '198.51.100.80' });

for (const measuredFact of snapshot.facts) {
  assert.equal(measuredFact.provenance, 'LOCAL MEASURED');
  assert.equal(measuredFact.observedAt, report.run.completedAt, 'v2 metrics without per-fact time use the bounded run completion timestamp');
  assert.ok(measuredFact.value === null || ['string', 'number', 'boolean'].includes(typeof measuredFact.value) || (Array.isArray(measuredFact.value) && measuredFact.value.every((item) => typeof item === 'string')), 'adapter must never embed a raw nested report object');
}

const factBytes = JSON.stringify(snapshot.facts);
for (const forbidden of [
  'DERIVED-FINDING-NOT-MEASURED',
  'BROWSER-EDGE-NOT-MEASURED',
  'DERIVED-LOCALIZATION-NOT-MEASURED',
  'PUBLIC-CONTEXT-BEFORE',
  'PUBLIC-CONTEXT-AFTER',
  'UNKNOWN-EXTENSION-MUST-NOT-BECOME-MEASURED',
  'PUBLIC-NETWORK-NOT-LOCAL',
  'BROWSER-EVIDENCE-NOT-LOCAL',
]) assert.doesNotMatch(factBytes, new RegExp(forbidden), `${forbidden} must not be promoted into LOCAL MEASURED facts`);

const privacyReport = structuredClone(report);
privacyReport.run.includesLocalAddresses = false;
privacyReport.deepDiagnostics.includesLocalAddresses = false;
const privacySnapshot = adaptNetworkDiagnosticsReportV2(privacyReport);
const privacyIds = new Set(privacySnapshot.facts.map((candidate) => candidate.id));
for (const privateId of [
  'selected-interface-source-address',
  'deep-interface-0-en0-unicastaddresses',
  'deep-interface-0-en0-gateways',
  'deep-interface-0-en0-dnsservers',
  'route-0-0-0-0-0-0-gateway',
  'route-0-0-0-0-0-0-family',
  'trace-hop-1-address',
  'trace-hop-1-hostname',
]) assert.equal(privacyIds.has(privateId), false, `${privateId} must be suppressed when local addresses are not permitted`);
assert.equal(privacyIds.has('route-0-family'), true, 'route semantics remain inspectable with the destination prefix withheld');
assert.equal(factById('local-link-download')?.target?.value, 'nas.local:5201');
assert.equal(privacySnapshot.facts.find((candidate) => candidate.id === 'local-link-download')?.target, null, 'LAN target identity must be withheld with local addresses');
assert.equal(privacyIds.has('gateway-ping-median-ms'), true, 'gateway timing remains useful even when gateway address is withheld');
assert.equal(privacySnapshot.warnings.some((line) => line.includes('Local address-valued facts are withheld')), true);

const minimal = {
  schemaVersion: '2.0',
  generatedAt: '2026-08-11T22:10:02.000Z',
  run: {
    id: 'minimal',
    platform: 'Linux',
    profile: 'quick',
    transferMethod: 'single',
    startedAt: '2026-08-11T22:10:00.000Z',
    completedAt: '2026-08-11T22:10:01.000Z',
  },
};
const minimalSnapshot = adaptNetworkDiagnosticsReportV2(minimal);
assert.equal(minimalSnapshot.source.platform, 'linux');
assert.equal(minimalSnapshot.facts.length, 0, 'absent optional report sections must not fabricate unavailable facts');
assert.equal(minimalSnapshot.scope.globalComplete, false);

const rejects = (mutate, pattern) => {
  const candidate = structuredClone(report);
  mutate(candidate);
  assert.throws(() => adaptNetworkDiagnosticsReportV2(candidate), pattern);
};
rejects((value) => { value.schemaVersion = '1.2'; }, /schemaVersion must be 2\.0/);
rejects((value) => { value.run.profile = 'stress-everything'; }, /run\.profile is unsupported/);
rejects((value) => { value.run.transferMethod = 'magic'; }, /run\.transferMethod is unsupported/);
rejects((value) => { value.run.completedAt = '2026-08-11T21:59:59.000Z'; }, /must not precede/);
rejects((value) => { value.generatedAt = '2026-08-11T22:00:03.000Z'; }, /generatedAt must not precede/);
rejects((value) => { value.run.id = ''; }, /run\.id/);
rejects((value) => { value.internetTransfer.download.mbps = 'fast'; }, /Internet download throughput must be a finite number/);

const journeyConfig = {
  transportProfile: 'quic-h3',
  dnsProfile: 'cache-hit',
  impairmentProfile: 'composed',
  modifierIds: ['route-leak', 'congestion'],
};
const journeyBefore = buildJourneyScenario('example.test', journeyConfig);
const reducerBefore = journeyStateAt(journeyBefore, 5_500);
const journeyBytes = JSON.stringify({ journey: journeyBefore, state: reducerBefore });
ingestNetworkDiagnosticsReportV2(report);
const journeyAfter = buildJourneyScenario('example.test', journeyConfig);
const reducerAfter = journeyStateAt(journeyAfter, 5_500);
assert.deepEqual(journeyAfter, journeyBefore, 'Network Diagnostics ingestion cannot alter canonical Journey construction');
assert.deepEqual(reducerAfter, reducerBefore, 'Network Diagnostics ingestion cannot alter Journey reducer state');
assert.equal(JSON.stringify({ journey: journeyAfter, state: reducerAfter }), journeyBytes);

const adapterSource = readFileSync(new URL('../src/measurement/networkDiagnosticsAdapter.ts', import.meta.url), 'utf8');
assert.doesNotMatch(adapterSource, /from ['"][^'"]*journey/i, 'Network Diagnostics adapter must not import Journey model code');
assert.doesNotMatch(adapterSource, /facts\.push\([^\n]*(browserEvidence|findings)|map[A-Za-z]+\([^\n]*root\.(browserEvidence|findings)/i, 'excluded evidence classes must not feed a measured mapping');

console.log(`Network Diagnostics ingestion contract passed: ${snapshot.facts.length} whitelisted LOCAL MEASURED facts, excluded public/derived/browser/unknown sections, and preserved Journey truth.`);
