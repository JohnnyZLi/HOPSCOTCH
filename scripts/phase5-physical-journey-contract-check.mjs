import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildJourneyScenario, journeyStateAt } from '../src/journey/model.ts';
import { projectJourneyPacketVisual } from '../src/journey/packet-visual.ts';
import { JOURNEY_PHYSICAL_STAGES, projectJourneyPhysicalState } from '../src/journey/physical-journey.ts';

for (const profile of ['tcp-h2', 'quic-h3']) {
  const scenario = buildJourneyScenario('example.test', {
    transportProfile: profile,
    dnsProfile: 'cache-miss',
    impairmentProfile: 'clean',
  });
  const transit = scenario.events.filter((event) => event.kind === 'packet.transit');
  assert.deepEqual(transit.map((event) => event.phase), JOURNEY_PHYSICAL_STAGES);
  assert.ok(transit[0].atMs > scenario.events.find((event) => event.id === 'packet-assembly-collapsed').atMs);
  assert.ok(transit.at(-1).atMs < scenario.events.find((event) => event.kind === 'http.response').atMs);
  assert.ok(transit.every((event) => event.provenance === 'SIMULATED'));

  const projections = transit.map((event) => {
    const stateA = journeyStateAt(scenario, event.atMs);
    const stateB = journeyStateAt(scenario, event.atMs);
    assert.deepEqual(stateA, stateB, `${profile} state must be repeatable at ${event.atMs} ms`);
    assert.equal(stateA.packet, 'transit');
    assert.equal(stateA.packetTransitStage, event.phase);
    const input = Object.freeze({ profile, destinationAddress: scenario.destinationAddress, stage: stateA.packetTransitStage });
    const before = structuredClone(input);
    const projectionA = projectJourneyPhysicalState(input);
    const projectionB = projectJourneyPhysicalState(input);
    assert.deepEqual(input, before, 'physical projection must not mutate its input');
    assert.deepEqual(projectionA, projectionB, 'physical projection must be deterministic');
    assert.ok(projectionA.semanticSignature.length > 40);
    return projectionA;
  });

  const byStage = Object.fromEntries(projections.map((projection) => [projection.stage, projection]));
  assert.deepEqual(
    JOURNEY_PHYSICAL_STAGES.map((stage) => byStage[stage].activeDevice),
    ['client', 'link-a', 'switch', 'switch', 'router', 'router', 'router', 'router', 'link-b'],
    'each deterministic stage must name exactly one active device or link locus',
  );
  assert.equal(byStage['switch-inspect'].selectedField, 'DESTINATION MAC');
  assert.match(byStage['switch-inspect'].decision, /02:48:4F:50:00:02/);
  assert.equal(byStage['switch-forward'].incoming.semanticSignature, byStage['switch-inspect'].incoming.semanticSignature, 'switch forwarding must retain the same Ethernet header semantics');
  assert.equal(byStage['router-decapsulate'].l2Envelope, 'none');
  assert.equal(byStage['router-decapsulate'].currentTtl, 64);
  assert.equal(byStage['router-ttl'].currentTtl, 63);
  assert.equal(byStage['router-ttl'].checksumBefore, profile === 'quic-h3' ? '0xF224' : '0xF223');
  assert.equal(byStage['router-ttl'].checksumAfter, profile === 'quic-h3' ? '0xF324' : '0xF323');
  assert.equal(byStage['router-route'].selectedField, 'DESTINATION IP');
  assert.match(byStage['router-route'].decision, /203\.0\.113\.0\/24/);
  assert.equal(byStage['router-reencapsulate'].l2Envelope, 'wan');
  assert.notEqual(byStage['router-reencapsulate'].incoming.semanticSignature, byStage['router-reencapsulate'].outgoing.semanticSignature, 'router must create a different hop-local Ethernet envelope');
  assert.equal(byStage['router-reencapsulate'].continuityId, byStage['switch-inspect'].continuityId, 'IPv4 continuity identity must survive the routed hop');

  const routedPacket = projectJourneyPacketVisual({
    hostname: scenario.hostname,
    destinationAddress: scenario.destinationAddress,
    profile,
    stage: 'exploded',
    selectedLayerId: 'network',
    ttl: byStage['router-ttl'].currentTtl,
  });
  const network = routedPacket.layers.find((layer) => layer.id === 'network');
  assert.ok(network.fields.some((field) => field.label === 'TTL' && field.value === '63' && field.byteStart === 22));
  assert.ok(network.fields.some((field) => field.label === 'Header Checksum' && field.value === byStage['router-ttl'].checksumAfter && field.byteStart === 24));

  const nextHopFrame = projectJourneyPacketVisual({
    hostname: scenario.hostname,
    destinationAddress: scenario.destinationAddress,
    profile,
    stage: 'exploded',
    selectedLayerId: 'link',
    ttl: 63,
    sourceMac: byStage['router-reencapsulate'].outgoing.sourceMac,
    destinationMac: byStage['router-reencapsulate'].outgoing.destinationMac,
  });
  const link = nextHopFrame.layers.find((layer) => layer.id === 'link');
  assert.ok(link.fields.some((field) => field.label === 'Source MAC' && field.value.toUpperCase() === byStage['router-reencapsulate'].outgoing.sourceMac));
  assert.ok(link.fields.some((field) => field.label === 'Destination MAC' && field.value.toUpperCase() === byStage['router-reencapsulate'].outgoing.destinationMac));
}

const component = readFileSync(new URL('../src/JourneyPhysicalJourney.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/JourneyPhysicalJourney.css', import.meta.url), 'utf8');
assert.match(component, /useReducedMotion/);
assert.match(component, /data-phase5b-signature/);
assert.match(component, /data-phase5b-incoming-frame/);
assert.match(component, /data-phase5b-outgoing-frame/);
assert.match(component, /data-locus="link-a"/);
assert.match(component, /data-locus="link-b"/);
assert.match(component, /type="button"/);
assert.match(component, /aria-label="Switch MAC table projection"/);
assert.match(component, /aria-label="Router forwarding projection"/);
assert.doesNotMatch(component, /requestAnimationFrame|setInterval|setTimeout/);
assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(css, /\.phase5b-physical\.reduce-motion/);

console.log('Phase 5 physical journey contract passed: deterministic NIC, link, switch, router, TTL, route, and re-encapsulation semantics.');
