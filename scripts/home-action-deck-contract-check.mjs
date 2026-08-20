import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FEATURED_WORKSPACE_IDS, WORKSPACE_COUNT, workspaceDefinition } from '../src/workspace-catalog.ts';

const component = readFileSync(new URL('../src/HomeActionDeck.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/HomeActionDeck.css', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');

assert.deepEqual(FEATURED_WORKSPACE_IDS, ['journey', 'failure', 'builder']);
assert.equal(workspaceDefinition('journey').featured?.actionLabel, 'Play URL journey');
assert.equal(workspaceDefinition('failure').featured?.actionLabel, 'Run failure story');
assert.equal(workspaceDefinition('builder').featured?.actionLabel, 'Open network builder');

for (const action of ['watch', 'break', 'build']) assert.ok(component.includes(`${action}: '${action}'`) || component.includes('data-home-action={HOME_ACTION_IDS'), `home action deck lost ${action}`);
for (const text of ['Inspect measured report', 'Preview X-ray', 'Source']) assert.ok(component.includes(text), `home action deck lost ${JSON.stringify(text)}`);
assert.match(component, /Explore all \{WORKSPACE_COUNT\} workspaces/);
assert.equal(WORKSPACE_COUNT, 13);

for (const forbidden of ["./journey/", "./simulation/", "./measurement/", 'fetch(', 'XMLHttpRequest', 'WebSocket', 'localStorage', 'sessionStorage']) {
  assert.ok(!component.includes(forbidden), `home action deck crossed presentation boundary with ${forbidden}`);
}

assert.match(component, /FEATURED_WORKSPACE_IDS\.map/);
assert.match(component, /workspaceDefinition\(workspaceId\)/);
assert.ok(!component.includes("lab: 'LAB"), 'home actions must not duplicate lab labels outside the catalog');
assert.ok(!component.includes('Explore all 13 workspaces'), 'workspace count must not be hardcoded');

assert.match(css, /grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/);
assert.match(css, /@media \(max-width: 760px\)[\s\S]*grid-template-columns:\s*1fr/);
assert.match(css, /@media \(max-width: 420px\)[\s\S]*grid-template-columns:\s*1fr 1fr/);
assert.match(styles, /@media \(max-width: 760px\)\s*\{\s*\.scale-inspector\s*\{\s*top:\s*94px;/, 'mobile scale inspector must stay above the action deck instead of overlapping it');

assert.match(app, /import \{ HomeActionDeck \} from '\.\/HomeActionDeck';/);
assert.match(app, /<HomeActionDeck/);
assert.match(app, /onWatch=\{openJourney\}/);
assert.match(app, /onBreak=\{\(\) => openFailureLab\(0, true\)\}/);
assert.match(app, /onBuild=\{openBuilderLab\}/);
assert.match(app, /onExplore=\{\(\) => setExploreOpen\(true\)\}/);
assert.match(app, /onMeasured=\{openMeasuredNetwork\}/);
assert.ok(!app.includes('const overviewAction ='), 'scale-dependent overviewAction should no longer compete in the hero');
assert.ok(!app.includes('className="hero-actions"'), 'legacy flat hero action list should be removed');

console.log(`Home action contract OK: ${FEATURED_WORKSPACE_IDS.length} catalog-backed first-class actions, ${WORKSPACE_COUNT} discoverable workspaces, mobile separation, and presentation-only behavior.`);
