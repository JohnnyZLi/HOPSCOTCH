import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildJourneyScenario, journeyStateAt } from '../src/journey/model.ts';

const component = readFileSync(new URL('../src/JourneyCausalWorld.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/JourneyCausalWorld.css', import.meta.url), 'utf8');
const theater = readFileSync(new URL('../src/JourneyTheaterV2.tsx', import.meta.url), 'utf8');

for (const dnsProfile of ['cache-miss', 'cache-hit']) {
  const scenario = buildJourneyScenario('example.test', {
    transportProfile: 'tcp-h2',
    dnsProfile,
    impairmentProfile: 'clean',
  });
  const checkpoints = scenario.events.filter((event) => event.atMs <= (dnsProfile === 'cache-hit' ? 7540 : 9740));
  for (const checkpoint of checkpoints) {
    const first = journeyStateAt(scenario, checkpoint.atMs);
    const second = journeyStateAt(scenario, checkpoint.atMs);
    assert.deepEqual(first, second, `${dnsProfile}:${checkpoint.id} must be reconstructed from deterministic time.`);
    assert.equal(first.activeEvent.id, checkpoint.id);
  }

  const ids = scenario.events.map((event) => event.id);
  if (dnsProfile === 'cache-hit') {
    assert.ok(ids.includes('dns-hit'));
    assert.ok(!ids.some((id) => ['dns-recursive', 'dns-root', 'dns-tld', 'dns-answer', 'dns-store'].includes(id)));
  } else {
    for (const id of ['dns-cache', 'dns-recursive', 'dns-root', 'dns-tld', 'dns-answer', 'dns-store']) assert.ok(ids.includes(id));
  }
}

assert.match(theater, /function usesCausalWorld\(state: JourneyState\)/);
assert.match(theater, /if \(usesCausalWorld\(state\)\) return 'causal-world'/);
assert.match(theater, /<JourneyCausalWorld state=\{state\}/);
assert.match(theater, /journey-callout-anchor/, 'The causal stage must replace legacy narration cards with a non-visual geometry anchor.');
assert.doesNotMatch(theater, /<VisualWorkspaceShell[\s\S]{0,120}entrance=/, 'The Journey must animate its causal object at time zero without a title interstitial.');
assert.match(component, /data-journey-causal-world="true"/);
assert.match(component, /data-causal-object="request-01"/);
assert.match(component, /data-causal-cache=/);
assert.match(component, /data-dns-query=/);
assert.match(component, /data-causal-route=/);
assert.match(component, /data-tcp-flight=/);
assert.match(component, /data-causal-tls=/);
assert.match(component, /state\.transportProfile === 'quic-h3'/);
assert.match(component, /QUIC INITIAL/);
assert.match(component, /<JourneyPacketObject projection=\{packetProjection\}/);
assert.match(component, /<JourneyPhysicalJourney projection=\{physicalProjection\}/);
assert.match(component, /useReducedMotion/);
assert.doesNotMatch(component, /requestAnimationFrame|setInterval|setTimeout|onAnimationComplete|onTransitionEnd/);

for (const token of [
  '@keyframes causal-object-enter',
  '@keyframes dns-query-recursive',
  '@keyframes dns-answer-return',
  '@keyframes dns-answer-hit',
  '@keyframes tcp-flight-forward',
  '@keyframes tcp-flight-reverse',
  '.flight-initial',
  '.flight-server-initial',
  '.causal-route-fan',
  '.causal-tls-fields',
  '.payload-cipher',
  '.causal-phase5-layer',
  '@media (prefers-reduced-motion: reduce)',
]) assert.ok(css.includes(token), `Missing causal-world visual contract: ${token}`);

assert.ok(css.includes('--causal-accent: #ff5a55'));
assert.doesNotMatch(css, /#72f4e3|rgba\(114, 244, 227/);

console.log('Journey causal-world contract passed: deterministic truth drives one persistent intent, DNS, route, TCP, TLS, HTTP, and Phase 5 renderer with distinct cache-hit and reduced-motion choreography.');
