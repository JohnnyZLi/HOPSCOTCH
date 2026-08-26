import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { EXPLORE_GROUPS, FEATURED_WORKSPACE_IDS, WORKSPACE_CATALOG, WORKSPACE_COUNT, WORKSPACE_IDS, WORKSPACE_PATHS, workspaceDefinition } from '../src/workspace-catalog.ts';
import { DESTINATION_PATHS, pathForDestination, resolveAppRoute } from '../src/navigation.ts';

assert.equal(WORKSPACE_COUNT, 13);
assert.equal(new Set(WORKSPACE_IDS).size, WORKSPACE_IDS.length);
assert.equal(new Set(Object.values(WORKSPACE_PATHS)).size, WORKSPACE_IDS.length);
assert.deepEqual(DESTINATION_PATHS, WORKSPACE_PATHS);
for (const id of WORKSPACE_IDS) {
  const workspace = workspaceDefinition(id);
  assert.equal(pathForDestination(id), workspace.path);
  assert.equal(resolveAppRoute(workspace.path, '').destination, id);
  assert.ok(workspace.name.trim() && workspace.exploreTitle.trim());
}
assert.equal(WORKSPACE_CATALOG.capture.lab, 'TRACK H');
assert.equal(WORKSPACE_CATALOG.journey.lab, 'LAB 06 + 07');
assert.ok(!WORKSPACE_CATALOG.journey.meta.includes('GOD MODE'));

const featured = new Set(FEATURED_WORKSPACE_IDS);
const groupedIds = EXPLORE_GROUPS.flatMap((group) => [...group.workspaceIds]);
assert.equal(new Set(groupedIds).size, groupedIds.length);
assert.deepEqual(new Set(groupedIds), new Set(WORKSPACE_IDS.filter((id) => !featured.has(id))));

const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const launcher = readFileSync(new URL('../src/ExploreLauncher.tsx', import.meta.url), 'utf8');
const kinetic = readFileSync(new URL('../src/KineticOverview.tsx', import.meta.url), 'utf8');
const corner = readFileSync(new URL('../src/CornerNavigator.tsx', import.meta.url), 'utf8');
const catalog = readFileSync(new URL('../src/workspace-catalog.ts', import.meta.url), 'utf8');
const main = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8');
const labCss = readFileSync(new URL('../src/lab.css', import.meta.url), 'utf8');
const tcpCss = readFileSync(new URL('../src/tcp.css', import.meta.url), 'utf8');
const dnsCss = readFileSync(new URL('../src/dns.css', import.meta.url), 'utf8');
const protocolWorkspaceCss = readFileSync(new URL('../src/protocol-workspaces.css', import.meta.url), 'utf8');
const journeyCss = readFileSync(new URL('../src/JourneyTheater.css', import.meta.url), 'utf8');
const exploreCss = readFileSync(new URL('../src/ExploreLauncher.css', import.meta.url), 'utf8');

assert.ok(!app.includes('DESTINATION_LAYERS'));
assert.ok(!app.includes('13 WORKSPACES'));
assert.match(app, /document\.title = activeLab/);
assert.match(app, /<CornerNavigator/);
assert.match(app, /<ExploreLauncher/);
assert.match(app, /<KineticOverview/);
assert.match(corner, /aria-expanded=\{open\}/);
assert.match(launcher, /WORKSPACE_COUNT/);
assert.match(launcher, /event\.key !== 'Tab'/);
assert.match(kinetic, /buildJourneyScenario/);

for (const forbidden of ['fetch(', 'XMLHttpRequest', 'WebSocket', 'localStorage', 'sessionStorage']) {
  assert.ok(!catalog.includes(forbidden));
  assert.ok(!launcher.includes(forbidden));
  assert.ok(!kinetic.includes(forbidden));
}

for (const file of ['visual-audit.css', 'tcp-audit.css', 'dns-audit.css', 'journey-audit.css']) {
  assert.ok(!main.includes(file));
  assert.equal(existsSync(new URL(`../src/${file}`, import.meta.url)), false);
}
assert.match(labCss, /Integrated visual hardening formerly isolated in visual-audit\.css/);
assert.match(tcpCss, /Integrated TCP hardening formerly isolated in tcp-audit\.css/);
assert.match(dnsCss, /Integrated DNS hardening formerly isolated in dns-audit\.css/);
assert.match(journeyCss, /Integrated Journey hardening formerly isolated in journey-audit\.css/);
assert.match(protocolWorkspaceCss, /Phase 2 scene-first overrides for TLS and HTTP comparison theaters/);
assert.match(exploreCss, /focus-visible/);

console.log(`Integrated product contract OK: ${WORKSPACE_COUNT} routes, one corner navigator, one kinetic canonical overview, and presentation-only navigation boundaries.`);
