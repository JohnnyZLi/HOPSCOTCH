import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildJourneyScenario, journeyStateAt } from '../src/journey/model.ts';

const component = readFileSync(new URL('../src/JourneyCausalWorld.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/JourneyCausalWorld.css', import.meta.url), 'utf8');
const polish = readFileSync(new URL('../src/JourneyMechanismPolish.css', import.meta.url), 'utf8');
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
assert.match(theater, /key=\{mode === 'causal-world' \? mode : `\$\{state\.scale\}:\$\{mode\}`\}/, 'Scale changes must not remount the persistent causal world.');
assert.doesNotMatch(theater, /<VisualWorkspaceShell[\s\S]{0,120}entrance=/, 'The Journey must animate its causal object at time zero without a title interstitial.');
assert.match(component, /data-journey-causal-world="true"/);
assert.match(component, /data-causal-object="request-01"/);
assert.match(component, /causal-object__mechanism/);
assert.match(component, /node-name/);
assert.match(component, /node-address/);
assert.match(component, /node-route/);
assert.match(component, /node-session/);
assert.match(component, /node-protection/);
assert.match(component, /data-packet-stage=\{packetProjection\.stage\}/);
assert.match(component, /data-route-target="true"/);
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

for (const token of [
  '.causal-object__mechanism',
  '.causal-mechanism-node',
  '.causal-route-target',
  '.causal-route-bits',
  '.causal-handoff-rail',
  '.journey-causal-world.is-packet-world > .causal-camera',
  '.packet-stage-application .causal-phase5-layer--assembly',
  '--causal-success:',
]) assert.ok(polish.includes(token), `Missing mechanism-polish contract: ${token}`);

assert.match(polish, /\.journey-causal-world\.is-packet-world > \.causal-camera\s*\{[^}]*opacity:\s*1;[^}]*filter:\s*none;/s, 'Packet handoff must retain the same visible causal camera instead of blur/fade replacement.');
assert.doesNotMatch(polish, /\.journey-causal-world\.is-packet-world > \.causal-camera\s*\{[^}]*opacity:\s*0/s, 'Mechanism polish must not reintroduce the old packet crossfade.');
assert.ok(css.includes('--causal-accent: #ff5a55'));
assert.doesNotMatch(css, /#72f4e3|rgba\(114, 244, 227/);

console.log('Journey causal-world contract passed: deterministic truth drives a persistent transformable request mechanism through DNS, route, transport, TLS, HTTP, and a visually continuous Phase 5 handoff.');
