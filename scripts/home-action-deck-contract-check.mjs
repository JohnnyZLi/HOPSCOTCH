import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WORKSPACE_COUNT } from '../src/workspace-catalog.ts';

const component = readFileSync(new URL('../src/KineticOverview.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/KineticOverview.css', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');

assert.equal(WORKSPACE_COUNT, 13);
assert.match(component, /buildJourneyScenario\('example\.test'\)/, 'overview must derive timing from the canonical journey');
for (const kind of ['dns.query', 'route.lookup', 'transport.segment', 'packet.assembly', 'packet.transit', 'response.ready']) {
  assert.ok(component.includes(`'${kind}'`), `overview lost the ${kind} phase`);
}
assert.match(component, /createTimeline/);
assert.match(component, /svg\.createMotionPath/);
assert.match(component, /className="kinetic-machine"/);
assert.match(component, /className="kinetic-instrument"/);
assert.match(component, /className="kinetic-primary-action"/);
assert.match(component, /Run the request/);
assert.doesNotMatch(component, /home-action-card|LAB 0|GOD MODE|READY/);
assert.equal((component.match(/kinetic-primary-action/g) ?? []).length, 1, 'overview needs one primary action');

for (const forbidden of ['./measurement/', 'fetch(', 'XMLHttpRequest', 'WebSocket', 'localStorage', 'sessionStorage']) {
  assert.ok(!component.includes(forbidden), `kinetic overview crossed its presentation boundary with ${forbidden}`);
}

assert.match(css, /min-height:\s*100svh/);
assert.match(css, /\.kinetic-scene/);
assert.match(css, /\.kinetic-annotation/);
assert.match(css, /@media \(max-width: 640px\)/);
assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(app, /import \{ KineticOverview \}/);
assert.match(app, /<KineticOverview onRunJourney=\{openJourney\}/);
assert.doesNotMatch(app, /HomeActionDeck|scale-inspector|topbar|timeline-preview/);

console.log('Kinetic overview contract OK: canonical six-act choreography, one primary action, sparse instrumentation, responsive geometry, and reduced-motion fallback.');
