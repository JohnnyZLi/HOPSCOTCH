import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EXPLORE_GROUPS, FEATURED_WORKSPACE_IDS, WORKSPACE_COUNT, WORKSPACE_IDS, workspaceDefinition } from '../src/workspace-catalog.ts';

const launcher = readFileSync(new URL('../src/ExploreLauncher.tsx', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');

assert.equal(WORKSPACE_COUNT, WORKSPACE_IDS.length);
assert.deepEqual(FEATURED_WORKSPACE_IDS, ['journey', 'failure', 'builder']);
assert.equal(EXPLORE_GROUPS.flatMap((group) => group.workspaceIds).length, WORKSPACE_COUNT - FEATURED_WORKSPACE_IDS.length);

for (const destination of WORKSPACE_IDS) {
  const workspace = workspaceDefinition(destination);
  assert.ok(workspace.exploreTitle.length > 0, `${destination} needs an Explore title`);
  assert.ok(app.includes(`case '${destination}':`) || app.includes(`${destination}:`), `App does not route/render the ${destination} Explore destination.`);
}

assert.match(launcher, /data-explore-destination=\{item\.id\}/, 'Explore cards must expose stable destination attributes for browser coverage.');
assert.match(launcher, /FEATURED_WORKSPACE_IDS\.map/, 'featured Explore destinations must come from the canonical catalog');
assert.match(launcher, /EXPLORE_GROUPS\.map/, 'Explore groups must come from the canonical catalog');
assert.equal(workspaceDefinition('journey').exploreTitle, 'Watch a request');
assert.equal(workspaceDefinition('failure').exploreTitle, 'Break the network');
assert.equal(workspaceDefinition('builder').exploreTitle, 'Build a network');
assert.equal(workspaceDefinition('capture').lab, 'TRACK H');

assert.match(app, /const \[exploreOpen, setExploreOpen\] = useState\(false\);/, 'Explore launcher must have explicit App-owned open state.');
assert.match(app, /className="explore-trigger"/, 'persistent Explore trigger must remain in App');
assert.match(app, /onExplore=\{\(\) => setExploreOpen\(true\)\}/, 'overview product surface must open Explore');
assert.match(app, /onSelect=\{selectExploreDestination\}/, 'Explore launcher must use the single App routing boundary.');
assert.match(app, /aria-expanded=\{exploreOpen\}/, 'persistent Explore trigger must expose dialog state');
assert.match(app, /aria-controls="explore-dialog"/, 'persistent Explore trigger must point at the dialog');

assert.match(launcher, /event\.key === 'Escape'/, 'Explore must retain Escape close behavior');
assert.match(launcher, /event\.key !== 'Tab'/, 'Explore must contain Tab navigation');
assert.match(launcher, /event\.shiftKey/, 'Explore must contain reverse Tab navigation');
assert.match(launcher, /previousFocusRef\.current\?\.focus/, 'Explore must restore focus to its opener');
assert.match(launcher, /aria-modal="true"/);
assert.match(launcher, /aria-describedby="explore-description"/);

assert.ok(!launcher.includes("from './journey/") && !launcher.includes("from './simulation/") && !launcher.includes('fetch('), 'Explore launcher must remain presentation/navigation only and must not become simulation or network truth.');

console.log(`Explore launcher contract OK: ${WORKSPACE_COUNT} catalog-backed destinations, accessible contained dialog focus, persistent + overview entry points, and no truth-path imports.`);
