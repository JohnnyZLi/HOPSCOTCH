import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const component = readFileSync(new URL('../src/HomeActionDeck.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/HomeActionDeck.css', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');

for (const action of ['watch', 'break', 'build']) {
  assert.match(component, new RegExp(`data-home-action=\\{action\\.id\\}|id: '${action}'`));
}

for (const text of [
  'WATCH A REQUEST',
  'BREAK THE NETWORK',
  'BUILD A NETWORK',
  'Play URL journey',
  'Run failure story',
  'Open network builder',
  'Explore all 13 workspaces',
  'Inspect measured report',
  'Preview X-ray',
  'Source',
]) {
  assert.ok(component.includes(text), `home action deck lost ${JSON.stringify(text)}`);
}

for (const forbidden of [
  "./journey/",
  "./simulation/",
  "./measurement/",
  'fetch(',
  'XMLHttpRequest',
  'WebSocket',
  'localStorage',
  'sessionStorage',
]) {
  assert.ok(!component.includes(forbidden), `home action deck crossed presentation boundary with ${forbidden}`);
}

assert.match(css, /grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/);
assert.match(css, /@media \(max-width: 760px\)[\s\S]*grid-template-columns:\s*1fr/);
assert.match(css, /@media \(max-width: 420px\)[\s\S]*grid-template-columns:\s*1fr 1fr/);
assert.match(styles, /@media \(max-width: 760px\)\s*\{\s*\.scale-rail\s*\{\s*top:\s*94px;\s*bottom:\s*auto;/, 'mobile scale rail must stay above the action deck instead of overlapping it');

assert.match(app, /import \{ HomeActionDeck \} from '\.\/HomeActionDeck';/);
assert.match(app, /<HomeActionDeck/);
assert.match(app, /onWatch=\{openJourney\}/);
assert.match(app, /onBreak=\{\(\) => openFailureLab\(0, true\)\}/);
assert.match(app, /onBuild=\{openBuilderLab\}/);
assert.match(app, /onExplore=\{\(\) => setExploreOpen\(true\)\}/);
assert.match(app, /onMeasured=\{openMeasuredNetwork\}/);
assert.ok(!app.includes('const overviewAction ='), 'scale-dependent overviewAction should no longer compete in the hero');
assert.ok(!app.includes('className="hero-actions"'), 'legacy flat hero action list should be removed');

console.log('Lab 10C home action contract OK: watch/break/build are first-class, utilities are secondary, mobile scale controls stay clear, and presentation stays truth-path-free.');
