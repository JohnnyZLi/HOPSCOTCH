import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const shared = readFileSync(new URL('../src/VisualWorkspace.tsx', import.meta.url), 'utf8');
const sharedCss = readFileSync(new URL('../src/VisualWorkspace.css', import.meta.url), 'utf8');
const journey = readFileSync(new URL('../src/JourneyTheaterV2.tsx', import.meta.url), 'utf8');
const journeyCss = readFileSync(new URL('../src/JourneyTheater.css', import.meta.url), 'utf8');
const failure = readFileSync(new URL('../src/FailureStoryWorkspace.tsx', import.meta.url), 'utf8');
const failureCss = readFileSync(new URL('../src/FailureStoryWorkspace.css', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');

assert.match(shared, /export function VisualWorkspaceShell/);
assert.match(shared, /export function VisualTimeRail/);
assert.match(shared, /export function VisualDrawerTabs/);
assert.match(shared, /aria-modal="true"/);
assert.match(shared, /event\.key === 'Escape'/);
assert.match(shared, /event\.key !== 'Tab'/);
assert.match(shared, /previousFocus\?\.focus\(\)/);
assert.match(shared, /useReducedMotion/);
assert.match(sharedCss, /@media \(prefers-reduced-motion: reduce\)/);

assert.match(sharedCss, /\.visual-workspace__stage \{/);
assert.match(sharedCss, /\.visual-drawer \{[\s\S]*position: absolute;/);
assert.match(sharedCss, /\.visual-drawer-backdrop \{[\s\S]*position: absolute;/);
assert.match(sharedCss, /\.visual-workspace__toolbar \{[\s\S]*position: absolute;/);
assert.match(sharedCss, /\.visual-workspace__hud \{[\s\S]*position: absolute;/);
assert.match(sharedCss, /height: calc\(100dvh - 86px\)/);
assert.ok(!sharedCss.includes('grid-template-columns: minmax(0, 1fr) 350px'), 'shared visual shell must not reserve a permanent inspector column');

assert.match(journey, /className="journey-visual-workspace"/);
assert.match(journey, /activeDrawer=\{activeDrawer\}/);
assert.match(journey, /id: 'config'/);
assert.match(journey, /id: 'events'/);
assert.match(journey, /id: 'evidence'/);
assert.match(journey, /id: 'inspect'/);
assert.match(journey, /PROVENANCE/);
assert.match(journey, /timelineMilestones/);
assert.ok(!journey.includes('className="journey-main"'), 'Journey must not render the legacy dashboard grid');
assert.ok(!journey.includes('className="journey-heading"'), 'Journey title must be entrance choreography, not persistent document flow');
assert.ok(!journey.includes('className="journey-rail"'), 'Journey must not reserve a permanent causal/evidence rail');
assert.ok(!journey.includes('className="journey-stage-meta"'), 'Journey must not recreate the old metadata strip');

assert.match(journeyCss, /\.journey-cinematic-stage \{[\s\S]*position: absolute;/);
assert.match(journeyCss, /\.journey-depth-overlay \{[\s\S]*position: absolute;/);
assert.match(journeyCss, /\.journey-callout-overlay \{[\s\S]*position: absolute;/);

assert.match(failure, /className="failure-visual-workspace"/);
assert.match(failure, /failure-object-annotation/);
assert.match(failure, /id: 'events'/);
assert.match(failure, /id: 'inspect'/);
assert.match(failure, /PROVENANCE/);
assert.match(failure, /timelineMilestones/);
assert.match(failureCss, /\.failure-cinematic-stage \{[\s\S]*position: absolute;/);
assert.match(failureCss, /\.failure-object-annotation \{[\s\S]*position: absolute;/);
assert.ok(!failure.includes('className="event-inspector"'), 'Failure Story must not reserve the legacy permanent causal inspector');
assert.ok(!failure.includes('className="lab-heading"'), 'Failure Story title must be entrance choreography, not persistent document flow');

assert.match(app, /<FailureStoryWorkspace/);
assert.ok(!app.includes('className="lab-workspace"'), 'App must not retain the legacy Failure Story dashboard shell');

console.log('Visual workspace contract passed: Journey and Failure Story are scene-first, use overlay inspection, preserve provenance, and share accessible drawer/time mechanics.');
