import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const observed = readFileSync(new URL('../src/ObservedInternet.tsx', import.meta.url), 'utf8');
const observedCss = readFileSync(new URL('../src/ObservedInternet.phase4.css', import.meta.url), 'utf8');
const measured = readFileSync(new URL('../src/MeasuredNetworkWorkspace.tsx', import.meta.url), 'utf8');
const measuredCss = readFileSync(new URL('../src/MeasuredNetworkWorkspace.phase4.css', import.meta.url), 'utf8');
const capture = readFileSync(new URL('../src/CaptureReplayWorkspace.tsx', import.meta.url), 'utf8');
const captureCss = readFileSync(new URL('../src/CaptureReplayWorkspace.phase4.css', import.meta.url), 'utf8');
const visualWorkspace = readFileSync(new URL('../src/VisualWorkspace.tsx', import.meta.url), 'utf8');
const packageDocument = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

assert.match(observed, /<VisualWorkspaceShell/);
assert.match(observed, /<VisualDrawerTabs/);
assert.match(observed, /id: 'config', label: 'Query'/);
assert.match(observed, /id: 'inspect', label: 'Collectors'/);
assert.match(observed, /id: 'evidence', label: 'Evidence'/);
assert.match(observed, /evidence-edge-island/);
assert.match(observed, /evidence-destination-island/);
assert.match(observed, /evidence-routing-island/);
assert.match(observed, /NO CONTINUOUS OBSERVATION/);
assert.match(observed, /Collector paths are never presented as the browser’s measured route/);
assert.match(observed, /setActiveDrawer\(null\)/, 'successful evidence load must return focus to the scene instead of retaining the query drawer');
assert.doesNotMatch(observed, /<section className="observed-main"[\s\S]*?<aside className="collector-panel"/, 'collector observations must not reserve a permanent world column');
assert.match(observedCss, /\.observed-internet\.visual-workspace\s*\{[\s\S]*?width:\s*calc\(100% - 20px\);[\s\S]*?max-width:\s*none;/);
assert.match(observedCss, /\.observed-internet\.visual-workspace\s*\{[\s\S]*?grid-template-rows:\s*minmax\(0, 1fr\) auto;/, 'legacy Internet Evidence rows must not collapse the shared visual stage');
assert.match(observedCss, /grid-template-columns:\s*minmax\(270px,[\s\S]*?minmax\(210px,[\s\S]*?minmax\(300px/);
assert.doesNotMatch(observedCss, /grid-template-columns:\s*minmax\(0,\s*1fr\)\s+390px/, 'Phase 4 evidence scene must not restore the permanent collector column');

assert.match(measured, /<VisualDrawerTabs/);
assert.match(measured, /<VisualOverlayDrawer/);
assert.match(measured, /id: 'config', label: 'Setup'/);
assert.match(measured, /id: 'evidence', label: 'Provenance'/);
assert.match(measured, /const setupDrawer =/);
assert.match(measured, /const provenanceDrawer =/);
assert.match(measured, /<MeasuredNativeCorrelationPanel measuredState=\{measuredState\}/, 'native/public correlation must remain available contextually');
assert.doesNotMatch(measured, /<div className="measured-main">[\s\S]*?<aside className="measured-provenance-panel">/, 'measured facts must not reserve a permanent provenance column');
assert.match(measured, /LOCAL MEASURED · BOUNDED · NOT GLOBAL/);
assert.match(measured, /NO CROSS-TARGET MERGE/);
assert.match(measured, /NOT STORED · NOT UPLOADED/);
assert.match(measuredCss, /\.measured-workspace\s*\{[\s\S]*?width:\s*calc\(100% - 20px\);[\s\S]*?max-width:\s*none;/);
assert.match(measuredCss, /\.measured-main\s*\{[\s\S]*?grid-template-columns:\s*220px minmax\(0, 1fr\)/);
assert.doesNotMatch(measuredCss, /grid-template-columns:\s*230px minmax\(0,\s*1fr\)\s*360px/, 'Phase 4 override must not reserve the legacy provenance width');

assert.match(capture, /type CaptureWorkspaceMode = 'replay' \| 'frame'/);
assert.match(capture, /type CaptureContextDrawer = 'flows' \| 'inspect' \| 'analysis'/);
assert.match(capture, /useVisualDrawerFocus<HTMLElement>\(activeDrawer !== null/);
assert.match(capture, /data-capture-mode=\{workspaceMode\}/);
assert.match(capture, /data-context-drawer=\{activeDrawer \?\? 'none'\}/);
assert.match(capture, /FRAME SPECIMEN/);
assert.match(capture, /EXACT CAPTURED STRUCTURE \+ BYTES/);
assert.match(capture, /inert=\{activeDrawer !== 'flows'\}/);
assert.match(capture, /role=\{activeDrawer === 'inspect' \? 'dialog'/);
assert.match(capture, /aria-modal=\{activeDrawer === 'analysis' \? 'true'/);
assert.match(capture, /setPlaying\(false\);\s*setActiveDrawer/, 'opening contextual Capture tools must pause playback without coupling reverse state');
assert.match(capture, /Track H · Captured evidence \+ replay/);
assert.doesNotMatch(capture, /Track T · Captured evidence/i);
assert.match(capture, /EXACT CAPTURED BYTES/);
assert.match(capture, /frame\.record\.bytes|selectedFrame\.record\.bytes/);
assert.match(captureCss, /\.capture-workspace-grid\s*\{[\s\S]*?position:\s*relative;[\s\S]*?display:\s*block;/);
assert.match(captureCss, /\.capture-flow-browser,[\s\S]*?\.capture-evidence-inspector,[\s\S]*?\.capture-analysis-drawer\s*\{[\s\S]*?position:\s*absolute;/);
assert.match(captureCss, /\.capture-evidence-inspector\.is-frame-stage\s*\{[\s\S]*?position:\s*relative;[\s\S]*?width:\s*100%;[\s\S]*?height:\s*100%;/);
assert.doesNotMatch(captureCss, /grid-template-columns:\s*270px minmax\(500px,\s*1fr\)\s*390px/, 'Phase 4 Capture override must not retain both permanent side columns');

assert.match(visualWorkspace, /activationKey: unknown = active/);
assert.match(visualWorkspace, /\[active, activationKey\]/, 'shared focus lifecycle must re-run when a contextual drawer changes in place');
assert.match(packageDocument.scripts['visual:phase4'], /--phase4-visual-review/);

console.log('Phase 4 evidence workspace contract passed: evidence islands, contextual collectors/setup/provenance, replay/frame modes, shared modal focus mechanics, exact bytes, full-bleed widths, and bounded truth remain explicit.');
