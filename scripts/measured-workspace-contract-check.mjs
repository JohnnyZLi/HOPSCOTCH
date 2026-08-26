import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { workspaceDefinition } from '../src/workspace-catalog.ts';

const workspace = readFileSync(new URL('../src/MeasuredNetworkWorkspace.tsx', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const launcher = readFileSync(new URL('../src/ExploreLauncher.tsx', import.meta.url), 'utf8');
const kinetic = readFileSync(new URL('../src/KineticOverview.tsx', import.meta.url), 'utf8');

assert.match(workspace, /ingestNetworkDiagnosticsReportV2/, 'workspace must use the permanent 09C ingestion path');
assert.match(workspace, /measuredFreshnessAt/, 'workspace freshness must use the permanent 09B helper');
assert.match(workspace, /type="file"[^>]*accept="\.json,application\/json"/, 'workspace must expose an explicit JSON file input');
assert.match(workspace, /await file\.text\(\)/, 'workspace must read the explicitly selected local file in-browser');
assert.match(workspace, /JSON\.parse\(text\)/, 'workspace must parse the selected JSON before 09C validation');
assert.match(workspace, /onMeasuredStateChange\(next\.state\)/, 'successful import must publish only the validated 09B measured projection after 09C ingestion succeeds');
assert.match(workspace, /onMeasuredStateChange\(null\)/, 'Clear must drop the App-level measured session state');
assert.doesNotMatch(workspace, /setIngestion\(/, 'workspace must not maintain a second local ingestion-truth store after Lab 09E session lift');
assert.match(workspace, /setError\([^)]*Nothing was imported/, 'oversize report rejection must not replace measured state');
assert.match(workspace, /THE PREVIOUS VALID REPORT REMAINS ACTIVE/, 'invalid replacement must communicate that the previous valid report remains active');
assert.match(workspace, /LOCAL MEASURED · BOUNDED · NOT GLOBAL/, 'workspace must keep its provenance/scope boundary visible');
assert.match(workspace, /NOT STORED · NOT UPLOADED/, 'workspace must surface its session-only privacy behavior');
assert.match(workspace, /NO CROSS-TARGET MERGE/, 'workspace must state that target-scoped measurements are not merged globally');
assert.match(workspace, /measured-target-selector/, 'workspace must expose target-scope selection within multi-target categories');
assert.match(workspace, /activeTargetGroup/, 'workspace must render one active target group at a time rather than every target ledger simultaneously');
assert.match(workspace, /will not fill the gap from simulation/i, 'empty measured categories must remain explicitly unfilled');
assert.match(workspace, /10 \* 1024 \* 1024/, 'workspace must bound browser import size');

for (const forbidden of [
  /localStorage/,
  /sessionStorage/,
  /\bfetch\s*\(/,
  /XMLHttpRequest/,
  /WebSocket/,
  /sendBeacon/,
  /FormData/,
  /from ['"][^'"]*journey/i,
  /JourneyEvent|JourneyScenario|JourneyModifier|JourneyState/,
]) assert.doesNotMatch(workspace, forbidden, `measured workspace must not contain forbidden coupling/persistence/upload pattern ${forbidden}`);

const measuredProduct = workspaceDefinition('measured');
const journeyProduct = workspaceDefinition('journey');
assert.equal(measuredProduct.lab, 'LAB 09', 'canonical product metadata must identify measured workspace as Lab 09');
assert.equal(measuredProduct.status, 'LOCAL MEASURED ACTIVE', 'canonical product metadata must identify measured state concisely');
assert.equal(journeyProduct.featured?.actionLabel, 'Play URL journey', 'URL Journey must remain a first-class product action');
assert.match(app, /workspaceDefinition/, 'App must consume canonical workspace metadata rather than duplicate measured labels');
assert.match(app, /'measured'/, 'App active-lab model must include the measured workspace');
assert.match(app, /measured:\s*openMeasuredNetwork/, 'corner navigation must route to the existing measured workspace opener');
assert.match(launcher, /EXPLORE_GROUPS\.map/, 'measured must remain discoverable through catalog-backed navigation');
assert.match(app, /useState<MeasuredSnapshotState \| null>\(null\)/, 'App may retain only the validated measured projection as session-only cross-lab evidence');
assert.match(app, /measuredState=\{measuredSession\}/, 'App must pass the same measured session projection to presentation consumers');
assert.match(app, /onMeasuredStateChange=\{setMeasuredSession\}/, 'Lab 09 must be the explicit replace/clear surface for the session projection');
assert.match(app, /<MeasuredNetworkWorkspace[^>]*onExit=/, 'App must render the measured workspace with normal lab exit behavior');
assert.match(app, /<KineticOverview onRunJourney=\{openJourney\}/, 'overview must route its primary action through the canonical URL Journey opener');
assert.match(kinetic, /Run the request/, 'home must expose the canonical request journey as its primary action');
for (const forbidden of [/localStorage/, /sessionStorage/, /NetworkDiagnosticsIngestion/, /NativeMeasurementSnapshot/]) {
  assert.doesNotMatch(app, forbidden, `App-level measured session must not persist or retain raw-ingestion type ${forbidden}`);
}

console.log('Measured workspace boundary contract passed: explicit 09C import publishes only session-memory 09B state, while catalog-backed corner navigation preserves discovery without coupling overview truth.');
