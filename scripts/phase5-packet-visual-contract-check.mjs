import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildJourneyScenario, journeyStateAt } from '../src/journey/model.ts';
import { projectJourneyPacketVisual } from '../src/journey/packet-visual.ts';

const profiles = ['tcp-h2', 'quic-h3'];
const stages = ['application', 'security', 'transport', 'network', 'link', 'collapsed'];

for (const profile of profiles) {
  const scenario = buildJourneyScenario('example.test', {
    transportProfile: profile,
    dnsProfile: 'cache-miss',
    impairmentProfile: 'clean',
  });
  const assembly = scenario.events.filter((event) => event.kind === 'packet.assembly');
  assert.deepEqual(assembly.map((event) => event.phase), stages);

  for (const [index, current] of assembly.entries()) {
    const stateA = journeyStateAt(scenario, current.atMs);
    const stateB = journeyStateAt(scenario, current.atMs);
    assert.deepEqual(stateA, stateB, `${profile} state must be repeatable at ${current.atMs} ms`);
    assert.equal(stateA.packetAssemblyStage, current.phase);

    const input = Object.freeze({
      hostname: scenario.hostname,
      destinationAddress: scenario.destinationAddress,
      profile,
      stage: stateA.packetAssemblyStage,
    });
    const before = structuredClone(input);
    const projectionA = projectJourneyPacketVisual(input);
    const projectionB = projectJourneyPacketVisual(input);
    assert.deepEqual(input, before, 'projection must not mutate its inputs');
    assert.deepEqual(projectionA, projectionB, 'same deterministic state must produce the same packet projection');
    assert.deepEqual(projectionA.layers.map((layer) => layer.visible), [0, 1, 2, 3, 4].map((order) => order <= Math.min(index, 4)));
    assert.equal(projectionA.layers.filter((layer) => layer.active).length, 1);
    assert.equal(projectionA.frameBytes + 4, projectionA.wireBytes, 'NIC FCS is wire overhead, not fabricated captured bytes');
  }

  const collapsed = projectJourneyPacketVisual({
    hostname: scenario.hostname,
    destinationAddress: scenario.destinationAddress,
    profile,
    stage: 'collapsed',
  });
  assert.equal(collapsed.collapsed, true);
  assert.ok(collapsed.layers.every((layer) => layer.visible));

  const exploded = projectJourneyPacketVisual({
    hostname: scenario.hostname,
    destinationAddress: scenario.destinationAddress,
    profile,
    stage: 'exploded',
    selectedLayerId: 'network',
  });
  assert.equal(exploded.exploded, true);
  assert.equal(exploded.selectedLayerId, 'network');
  assert.equal(exploded.layers.find((layer) => layer.id === 'network').active, true);

  for (const semanticLayer of exploded.layers.filter((layer) => layer.id === 'application' || layer.id === 'security')) {
    assert.equal(semanticLayer.byteStart, null);
    assert.ok(semanticLayer.fields.every((field) => field.byteStart === null));
  }

  const link = exploded.layers.find((layer) => layer.id === 'link');
  const network = exploded.layers.find((layer) => layer.id === 'network');
  const transport = exploded.layers.find((layer) => layer.id === 'transport');
  assert.equal(link.byteStart, 0);
  assert.ok(link.fields.some((field) => field.label === 'Destination MAC' && field.byteStart === 0 && field.byteLength === 6));
  assert.ok(network.fields.some((field) => field.label === 'TTL' && field.byteStart === 22 && field.byteLength === 1 && field.value === '64'));
  assert.ok(transport.fields.some((field) => field.label === 'Destination Port' && field.value.startsWith('443')));

  if (profile === 'tcp-h2') {
    assert.equal(transport.protocol, 'TCP');
    assert.ok(transport.fields.some((field) => field.label === 'Sequence'));
    assert.match(exploded.layers.find((layer) => layer.id === 'security').protocol, /TLS 1\.3/);
  } else {
    assert.equal(transport.protocol, 'QUIC / UDP');
    assert.ok(transport.fields.some((field) => field.label === 'Length'));
    assert.match(exploded.layers.find((layer) => layer.id === 'security').detail, /no standalone TLS record layer/i);
  }
}

const component = readFileSync(new URL('../src/JourneyPacketObject.tsx', import.meta.url), 'utf8');
const componentCss = readFileSync(new URL('../src/JourneyPacketObject.css', import.meta.url), 'utf8');
assert.match(component, /useReducedMotion/);
assert.match(component, /data-phase5-signature/);
assert.match(component, /phase5-frame-spine/);
assert.match(component, /NIC APPENDS/);
assert.match(component, /aria-label={`Packet assembly/);
assert.match(component, /type="button"/);
assert.doesNotMatch(component, /requestAnimationFrame|setInterval|setTimeout/);
assert.match(componentCss, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(componentCss, /\.phase5-packet-object\.reduce-motion/);

console.log('Phase 5 packet visual contract passed: deterministic assembly, exact byte provenance, TCP/QUIC semantics, accessibility, and reduced motion.');
