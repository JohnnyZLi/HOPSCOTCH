import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import {
  EXPLORE_GROUPS,
  FEATURED_WORKSPACE_IDS,
  WORKSPACE_CATALOG,
  WORKSPACE_COUNT,
  WORKSPACE_IDS,
  WORKSPACE_PATHS,
  workspaceDefinition,
} from '../src/workspace-catalog.ts';
import { DESTINATION_PATHS, pathForDestination, resolveAppRoute } from '../src/navigation.ts';

assert.equal(WORKSPACE_COUNT, 13, 'the integrated product currently has exactly 13 canonical workspaces');
assert.equal(new Set(WORKSPACE_IDS).size, WORKSPACE_IDS.length, 'workspace ids must be unique');
assert.equal(new Set(Object.values(WORKSPACE_PATHS)).size, WORKSPACE_IDS.length, 'workspace deep links must be unique');
assert.deepEqual(DESTINATION_PATHS, WORKSPACE_PATHS, 'navigation paths must be the canonical workspace catalog paths');

for (const id of WORKSPACE_IDS) {
  const workspace = workspaceDefinition(id);
  assert.equal(workspace.id, id);
  assert.equal(pathForDestination(id), workspace.path);
  assert.equal(resolveAppRoute(workspace.path, '').destination, id);
  assert.ok(workspace.name.trim());
  assert.ok(workspace.exploreTitle.trim());
  assert.ok(workspace.lab.trim());
  assert.ok(workspace.status.trim());
}

assert.equal(WORKSPACE_CATALOG.capture.lab, 'TRACK H', 'Capture Replay belongs to completed Track H');
assert.equal(WORKSPACE_CATALOG.journey.lab, 'LAB 06 + 07', 'URL Journey and GOD MODE are one combined Lab 06 + 07 workspace');
assert.ok(!Object.values(WORKSPACE_CATALOG).some((workspace) => workspace.lab === 'TRACK T'), 'Track T must remain historical documentation, not current product navigation');

const featured = new Set(FEATURED_WORKSPACE_IDS);
assert.deepEqual([...featured], ['journey', 'failure', 'builder']);
for (const id of FEATURED_WORKSPACE_IDS) {
  assert.equal(WORKSPACE_CATALOG[id].group, 'featured');
  assert.ok(WORKSPACE_CATALOG[id].featured, `${id} must carry featured action metadata`);
}

const groupedIds = EXPLORE_GROUPS.flatMap((group) => [...group.workspaceIds]);
assert.equal(new Set(groupedIds).size, groupedIds.length, 'Explore groups must not duplicate a workspace');
assert.deepEqual(
  new Set(groupedIds),
  new Set(WORKSPACE_IDS.filter((id) => !featured.has(id))),
  'every non-featured workspace must appear in exactly one Explore group',
);
for (const group of EXPLORE_GROUPS) {
  for (const id of group.workspaceIds) assert.equal(WORKSPACE_CATALOG[id].group, group.id, `${id} catalog group must match Explore group ${group.id}`);
}

const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const launcher = readFileSync(new URL('../src/ExploreLauncher.tsx', import.meta.url), 'utf8');
const home = readFileSync(new URL('../src/HomeActionDeck.tsx', import.meta.url), 'utf8');
const catalog = readFileSync(new URL('../src/workspace-catalog.ts', import.meta.url), 'utf8');
const main = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
const labCss = readFileSync(new URL('../src/lab.css', import.meta.url), 'utf8');
const tcpCss = readFileSync(new URL('../src/tcp.css', import.meta.url), 'utf8');
const dnsCss = readFileSync(new URL('../src/dns.css', import.meta.url), 'utf8');
const protocolWorkspaceCss = readFileSync(new URL('../src/protocol-workspaces.css', import.meta.url), 'utf8');
const journeyCss = readFileSync(new URL('../src/JourneyTheater.css', import.meta.url), 'utf8');
const exploreCss = readFileSync(new URL('../src/ExploreLauncher.css', import.meta.url), 'utf8');

assert.match(app, /WORKSPACE_COUNT, workspaceDefinition, type ExploreDestination/);
assert.ok(!app.includes('DESTINATION_LAYERS'), 'App must not duplicate workspace-to-layer truth');
assert.ok(!app.includes('13 WORKSPACES'), 'App must not hardcode the workspace count');
assert.match(app, /document\.title = activeLab/);
assert.match(app, /workspaceDefinition\(activeLab\)\.name/);
assert.match(app, /aria-expanded=\{exploreOpen\}/);
assert.match(app, /aria-controls="explore-dialog"/);
assert.match(app, /\{WORKSPACE_COUNT\} WORKSPACES/);

assert.match(launcher, /EXPLORE_GROUPS/);
assert.match(launcher, /FEATURED_WORKSPACE_IDS/);
assert.match(launcher, /WORKSPACE_COUNT/);
assert.match(launcher, /id="explore-dialog"/);
assert.match(launcher, /aria-describedby="explore-description"/);
assert.match(launcher, /event\.key !== 'Tab'/);
assert.match(launcher, /event\.shiftKey/);
assert.match(launcher, /previousFocusRef\.current\?\.focus/);
assert.match(launcher, /closeRef\.current\?\.focus/);
assert.ok(!launcher.includes("lab: 'TRACK T'"), 'current Explore UI must not identify capture as Track T');

assert.match(home, /FEATURED_WORKSPACE_IDS/);
assert.match(home, /WORKSPACE_COUNT/);
assert.match(home, /Explore all \{WORKSPACE_COUNT\} workspaces/);
assert.ok(!home.includes("lab: 'LAB"), 'home actions must not duplicate lab metadata');

for (const forbidden of ['fetch(', 'XMLHttpRequest', 'WebSocket', 'localStorage', 'sessionStorage']) {
  assert.ok(!catalog.includes(forbidden), `workspace catalog crossed the presentation/navigation boundary with ${forbidden}`);
  assert.ok(!launcher.includes(forbidden), `Explore crossed the presentation/navigation boundary with ${forbidden}`);
  assert.ok(!home.includes(forbidden), `Home actions crossed the presentation/navigation boundary with ${forbidden}`);
}

for (const file of ['visual-audit.css', 'tcp-audit.css', 'dns-audit.css', 'journey-audit.css']) {
  assert.ok(!main.includes(file), `${file} must not remain a global late-cascade import`);
  assert.equal(existsSync(new URL(`../src/${file}`, import.meta.url)), false, `${file} should be removed after its rules are integrated`);
}
assert.match(labCss, /Integrated visual hardening formerly isolated in visual-audit\.css/);
assert.match(tcpCss, /Integrated TCP hardening formerly isolated in tcp-audit\.css/);
assert.match(dnsCss, /Integrated DNS hardening formerly isolated in dns-audit\.css/);
assert.match(journeyCss, /Integrated Journey hardening formerly isolated in journey-audit\.css/);
assert.match(main, /import '\.\/protocol-workspaces\.css';/);
assert.match(protocolWorkspaceCss, /Phase 2 scene-first overrides for TLS and HTTP comparison theaters/);
assert.match(styles, /Integrated keyboard focus contract/);
assert.match(styles, /:focus-visible/);
assert.match(exploreCss, /Explore focus containment ring/);

console.log(`Integrated product contract OK: ${WORKSPACE_COUNT} canonical workspaces, one navigation/catalog truth source, contained Explore focus, canonical CSS ownership, and no product-shell truth-path expansion.`);
