import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EXPLORE_GROUPS, FEATURED_WORKSPACE_IDS, WORKSPACE_COUNT, WORKSPACE_IDS, workspaceDefinition } from '../src/workspace-catalog.ts';

const launcher = readFileSync(new URL('../src/ExploreLauncher.tsx', import.meta.url), 'utf8');
const corner = readFileSync(new URL('../src/CornerNavigator.tsx', import.meta.url), 'utf8');
const kinetic = readFileSync(new URL('../src/KineticOverview.tsx', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');

assert.equal(WORKSPACE_COUNT, WORKSPACE_IDS.length);
assert.deepEqual(FEATURED_WORKSPACE_IDS, ['journey', 'failure', 'builder']);
assert.equal(EXPLORE_GROUPS.flatMap((group) => group.workspaceIds).length, WORKSPACE_COUNT - FEATURED_WORKSPACE_IDS.length);
for (const destination of WORKSPACE_IDS) {
  const workspace = workspaceDefinition(destination);
  assert.ok(workspace.exploreTitle.length > 0, `${destination} needs a navigation title`);
  assert.ok(app.includes(`${destination}:`) || app.includes(`activeLab === '${destination}'`), `App does not route/render ${destination}.`);
}

assert.match(launcher, /data-explore-destination={item\.id}/);
assert.match(launcher, /FEATURED_WORKSPACE_IDS\.map/);
assert.match(launcher, /EXPLORE_GROUPS\.map/);
assert.match(launcher, /WORKSPACE_IDS/);
assert.match(launcher, /type="search"/);
assert.match(launcher, /searchResults\.map/);
assert.match(launcher, /className=\{`explore-row/);
assert.doesNotMatch(launcher, /explore-featured-card|explore-card-lab|Pick something to do/);

assert.match(app, /const \[exploreOpen, setExploreOpen\] = useState\(false\);/);
assert.match(app, /<CornerNavigator open=\{exploreOpen\}/);
assert.match(app, /onSelect=\{selectExploreDestination\}/);
assert.match(app, /activeDestination=\{activeLab\}/);
assert.match(kinetic, /onOpenExplore/);
assert.match(corner, /aria-expanded=\{open\}/);
assert.match(corner, /aria-controls="explore-dialog"/);

assert.match(launcher, /event\.key === 'Escape'/);
assert.match(launcher, /event\.key !== 'Tab'/);
assert.match(launcher, /event\.shiftKey/);
assert.match(launcher, /previousFocusRef\.current\?\.focus/);
assert.match(launcher, /aria-modal="true"/);
assert.match(launcher, /aria-describedby="explore-description"/);
assert.ok(!launcher.includes("from './journey/") && !launcher.includes("from './simulation/") && !launcher.includes('fetch('));

console.log(`Explore launcher contract OK: ${WORKSPACE_COUNT} catalog-backed destinations behind one accessible corner navigator.`);
