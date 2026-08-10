import assert from 'node:assert/strict';

const worker = (await import('../worker/index.ts')).default;
const env = { ASSETS: { fetch: async () => new Response('asset') } };

function requestWithCf(url, cf = {}) {
  const request = new Request(url);
  Object.defineProperty(request, 'cf', { configurable: true, value: cf });
  return request;
}

async function readJson(response) {
  return JSON.parse(await response.text());
}

const edgeResponse = await worker.fetch(requestWithCf('https://hopscotch.test/api/internet/edge', {
  asn: 64512,
  asOrganization: 'Fixture Access',
  colo: 'LAX',
  country: 'US',
  region: 'California',
  city: 'Los Angeles',
  clientQuicRtt: 18,
}), env);
assert.equal(edgeResponse.status, 200);
const edge = await readJson(edgeResponse);
assert.equal(edge.provenance, 'EDGE OBSERVED');
assert.equal(edge.asn, 64512);
assert.equal(edge.colo, 'LAX');
assert.equal(edge.transport, 'QUIC');
assert.equal(edge.transportRttMs, 18);
assert.equal('clientIp' in edge, false);
assert.equal('clientIP' in edge, false);
assert.equal('ip' in edge, false);

const badHostResponse = await worker.fetch(requestWithCf('https://hopscotch.test/api/internet/snapshot?host=https%3A%2F%2Fexample.com%2Fx'), env);
assert.equal(badHostResponse.status, 400);
const badHost = await readJson(badHostResponse);
assert.match(badHost.error, /hostname only/i);

const originalFetch = globalThis.fetch;
const calls = [];
const facilityFixture = [
  ...Array.from({ length: 160 }, (_, index) => ({
    id: index + 1,
    name: `Fixture Facility ${String(index + 1).padStart(3, '0')}`,
    city: index % 2 === 0 ? 'Los Angeles' : 'Tokyo',
    country: index % 2 === 0 ? 'US' : 'JP',
    latitude: -70 + (index % 140),
    longitude: -170 + ((index * 17) % 340),
    net_count: index + 4,
    ix_count: index % 7,
    status: 'ok',
  })),
  { id: 999, name: 'Bad latitude', city: 'Nowhere', country: 'ZZ', latitude: 120, longitude: 0, status: 'ok' },
  { id: 1000, name: '', city: 'Nowhere', country: 'ZZ', latitude: 10, longitude: 10, status: 'ok' },
];

globalThis.fetch = async (input) => {
  const url = String(input);
  calls.push(url);
  if (url.includes('peeringdb.com/api/fac')) return Response.json({ data: facilityFixture });
  if (url.includes('cloudflare-dns.com') && url.includes('type=A')) {
    return Response.json({ Status: 0, Answer: [{ type: 1, data: '203.0.113.42' }] });
  }
  if (url.includes('cloudflare-dns.com') && url.includes('type=AAAA')) {
    return Response.json({ Status: 0, Answer: [] });
  }
  if (url.includes('/network-info/')) {
    return Response.json({ data: { prefix: '203.0.113.0/24', asns: [64496] } });
  }
  if (url.includes('/bgp-state/')) {
    return Response.json({ data: { bgp_state: [{ source_id: '00-192.0.2.1', target_prefix: '203.0.113.0/24', path: [64500, 64500, 64496] }] } });
  }
  throw new Error(`Unexpected upstream ${url}`);
};

try {
  const infrastructureResponse = await worker.fetch(requestWithCf('https://hopscotch.test/api/internet/infrastructure'), env);
  assert.equal(infrastructureResponse.status, 200);
  assert.match(infrastructureResponse.headers.get('cache-control') ?? '', /max-age=900/);
  const infrastructure = await readJson(infrastructureResponse);
  assert.equal(infrastructure.schema, 'hopscotch.internet-infrastructure');
  assert.equal(infrastructure.version, 1);
  assert.equal(infrastructure.provenance, 'PUBLIC DATA');
  assert.equal(infrastructure.source, 'PeeringDB');
  assert.equal(infrastructure.facilities.length, 160);
  assert.equal(infrastructure.facilities[0].provenance, 'PUBLIC DATA');
  assert.equal(infrastructure.facilities[0].networkCount, 4);
  assert.equal(infrastructure.facilities[0].exchangeCount, 0);
  assert.ok(infrastructure.facilities.every((facility) => facility.latitude >= -90 && facility.latitude <= 90));
  assert.ok(infrastructure.facilities.every((facility) => facility.longitude >= -180 && facility.longitude <= 180));
  const peeringCalls = calls.filter((url) => url.includes('peeringdb.com/api/fac'));
  assert.equal(peeringCalls.length, 1);
  assert.match(peeringCalls[0], /limit=250/);
  assert.match(decodeURIComponent(peeringCalls[0]), /fields=id,name,city,country,latitude,longitude,net_count,ix_count,status/);

  const snapshotResponse = await worker.fetch(requestWithCf('https://hopscotch.test/api/internet/snapshot?host=example.test', {
    asn: 64512,
    asOrganization: 'Fixture Access',
    colo: 'LAX',
    country: 'US',
    clientTcpRtt: 24,
  }), env);
  assert.equal(snapshotResponse.status, 200);
  const snapshot = await readJson(snapshotResponse);
  assert.equal(snapshot.schema, 'hopscotch.internet-evidence');
  assert.equal(snapshot.version, 1);
  assert.equal(snapshot.edge.provenance, 'EDGE OBSERVED');
  assert.equal(snapshot.destination.provenance, 'INFERRED');
  assert.equal(snapshot.routing.provenance, 'PUBLIC COLLECTOR');
  assert.equal(snapshot.bridge.provenance, 'INFERRED');
  assert.equal(snapshot.destination.selectedAddress, '203.0.113.42');
  assert.equal(snapshot.routing.prefix, '203.0.113.0/24');
  assert.deepEqual(snapshot.routing.originAsns, [64496]);
  assert.deepEqual(snapshot.collectorPaths[0].asPath, [64500, 64496]);
  assert.match(snapshot.collectorPaths[0].note, /not the current browser/i);
  assert.match(snapshot.bridge.note, /No continuous end-to-end forwarding path was observed/i);
  assert.equal(Object.keys(snapshot.edge).some((key) => /(?:client.?ip|address)/i.test(key)), false);
  assert.ok(calls.some((url) => url.includes('cloudflare-dns.com')));
  assert.ok(calls.some((url) => url.includes('/network-info/')));
  assert.ok(calls.some((url) => url.includes('/bgp-state/')));

  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes('peeringdb.com/api/fac')) throw new Error('fixture PeeringDB outage');
    if (url.includes('cloudflare-dns.com') && url.includes('type=A')) return Response.json({ Status: 0, Answer: [{ type: 1, data: '203.0.113.42' }] });
    if (url.includes('cloudflare-dns.com') && url.includes('type=AAAA')) return Response.json({ Status: 0, Answer: [] });
    if (url.includes('/network-info/')) return Response.json({ data: { prefix: '203.0.113.0/24', asns: [64496] } });
    if (url.includes('/bgp-state/')) throw new Error('fixture RIS outage');
    throw new Error(`Unexpected upstream ${url}`);
  };

  const infrastructureFailure = await worker.fetch(requestWithCf('https://hopscotch.test/api/internet/infrastructure'), env);
  assert.equal(infrastructureFailure.status, 502);
  const infrastructureFailureBody = await readJson(infrastructureFailure);
  assert.match(infrastructureFailureBody.error, /Public infrastructure data is unavailable/i);

  const partialResponse = await worker.fetch(requestWithCf('https://hopscotch.test/api/internet/snapshot?host=example.test'), env);
  assert.equal(partialResponse.status, 200);
  const partial = await readJson(partialResponse);
  assert.equal(partial.routing.prefix, '203.0.113.0/24');
  assert.equal(partial.collectorPaths.length, 0);
  assert.ok(partial.warnings.some((warning) => /collector paths unavailable/i.test(warning)));
} finally {
  globalThis.fetch = originalFetch;
}

console.log('Worker evidence and infrastructure contract checks passed.');
