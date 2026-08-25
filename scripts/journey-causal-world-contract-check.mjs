import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildJourneyScenario, journeyStateAt } from '../src/journey/model.ts';

const component = readFileSync(new URL('../src/JourneyCausalWorld.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/JourneyCausalWorld.css', import.meta.url), 'utf8');
const polish = readFileSync(new URL('../src/JourneyMechanismPolish.css', import.meta.url), 'utf8');
const motion = readFileSync(new URL('../src/JourneyMotionShape.css', import.meta.url), 'utf8');
const timing = readFileSync(new URL('../src/JourneyMotionTimingFixes.css', import.meta.url), 'utf8');
const refinement = readFileSync(new URL('../src/JourneyShapeRefinement.css', import.meta.url), 'utf8');
const tuning = readFileSync(new URL('../src/JourneyShapeTuning.css', import.meta.url), 'utf8');
const dnsLidMotion = readFileSync(new URL('../src/JourneyDnsLidMotion.css', import.meta.url), 'utf8');
const workspace = readFileSync(new URL('../src/VisualWorkspace.tsx', import.meta.url), 'utf8');
const entry = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8');
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

for (const token of [
  '--journey-motion-micro: 220ms',
  '--journey-motion-standard: 460ms',
  '--journey-motion-spatial: 640ms',
  '.phase5-packet-object .phase5c-transport',
  '.phase5-packet-object .phase5c-network-wing',
  '.phase5b-physical .phase5b-data-unit',
]) assert.ok(motion.includes(token), `Missing normalized motion/shape contract: ${token}`);

for (const token of [
  'dns-query-recursive 620ms',
  'dns-answer-return 680ms',
  'tcp-flight-forward 700ms',
  'http-flow 720ms linear',
]) assert.ok(timing.includes(token), `Missing normalized animation timing: ${token}`);

for (const token of [
  'application = payload plate',
  'TCP/UDP = header cap',
  'IPv4 = closing address brackets',
  'Ethernet = outer frame/header/trailer',
]) assert.ok(refinement.includes(token), `Missing semantic packet-shape contract: ${token}`);

for (const token of [
  '.journey-causal-world .causal-cache',
  '.journey-causal-world.causal-phase-route .causal-mechanism-node',
  '.journey-causal-world.causal-phase-tls.has-protection .node-protection',
  '.phase5-packet-object .phase5c-network',
  '.phase5-packet-object .phase5c-link',
]) assert.ok(tuning.includes(token), `Missing browser-audited Journey shape tuning: ${token}`);

assert.match(dnsLidMotion, /\.journey-causal-world \.causal-cache__lid\s*\{[\s\S]*transform:\s*translateY\(0\)\s*!important;/, 'Flat resolver drawer must have a deterministic closed lid state.');
assert.match(dnsLidMotion, /\.journey-causal-world\.causal-phase-dns \.causal-cache__lid\s*\{[\s\S]*transform:\s*translateY\(-10px\)\s*!important;/, 'DNS lookup must physically lift the flat cache lid.');
assert.doesNotMatch(dnsLidMotion, /rotateX|rotateY|perspective/, 'Flat resolver drawer must not regress to the old skewed 3D prop.');

assert.match(workspace, /const PRESENTATION_BASE_SLOWDOWN = 1\.2 \* PRESENTATION_READABILITY_SCALE;/, 'Sparse presentation segments must remain slower than raw model time.');
for (const dwell of ['neutral: 820', 'evidence: 880', 'success: 900', 'warning: 980', 'danger: 1100']) {
  assert.ok(workspace.includes(dwell), `Missing semantic presentation dwell contract: ${dwell}`);
}

for (const importPath of [
  "./JourneyMotionShape.css",
  "./JourneyMotionTimingFixes.css",
  "./JourneyShapeRefinement.css",
  "./JourneyShapeStateCorrections.css",
  "./JourneyShapeTuning.css",
  "./JourneyDnsLidMotion.css",
]) assert.ok(entry.includes(importPath), `Journey motion/shape layer is not loaded: ${importPath}`);

assert.match(polish, /\.journey-causal-world\.is-packet-world > \.causal-camera\s*\{[^}]*opacity:\s*1;[^}]*filter:\s*none;/s, 'Packet handoff must retain the same visible causal camera instead of blur/fade replacement.');
assert.doesNotMatch(polish, /\.journey-causal-world\.is-packet-world > \.causal-camera\s*\{[^}]*opacity:\s*0/s, 'Mechanism polish must not reintroduce the old packet crossfade.');
assert.ok(css.includes('--causal-accent: #ff5a55'));
assert.doesNotMatch(css, /#72f4e3|rgba\(114, 244, 227/);

console.log('Journey causal-world contract passed: deterministic truth drives one transformable request mechanism through normalized semantic pacing, protocol-specific shapes, a flat physically opening DNS cache, and a visually continuous Phase 5 handoff.');
