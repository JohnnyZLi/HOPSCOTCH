import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workspace = readFileSync(new URL('../src/MeasuredNetworkWorkspace.tsx', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');

assert.match(workspace, /ingestNetworkDiagnosticsReportV2/, 'workspace must use the permanent 09C ingestion path');
assert.match(workspace, /measuredFreshnessAt/, 'workspace freshness must use the permanent 09B helper');
assert.match(workspace, /type="file"[^>]*accept="\.json,application\/json"/, 'workspace must expose an explicit JSON file input');
assert.match(workspace, /await file\.text\(\)/, 'workspace must read the explicitly selected local file in-browser');
assert.match(workspace, /JSON\.parse\(text\)/, 'workspace must parse the selected JSON before 09C validation');
assert.match(workspace, /setIngestion\(next\)/, 'successful import must replace measured workspace state only after ingestion succeeds');
assert.match(workspace, /setIngestion\(null\)/, 'Clear must drop the imported measured state');
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

assert.match(app, /'measured'/, 'App active-lab model must include the measured workspace');
assert.match(app, /Inspect measured report/, 'overview must expose the measured workspace without replacing the URL Journey primary action');
assert.match(app, /LAB 09/, 'top bar must identify the measured workspace as Lab 09');
assert.match(app, /LOCAL MEASUREMENT WORKSPACE ACTIVE/, 'top bar must identify measured workspace state');
assert.match(app, /<MeasuredNetworkWorkspace[^>]*onExit=/, 'App must render the measured workspace with normal lab exit behavior');
assert.match(app, /Play URL journey/, 'URL Journey must remain present as the primary product entry');

const primaryIndex = app.indexOf('className="primary-action"');
const journeyIndex = app.indexOf('Play URL journey');
const measuredIndex = app.indexOf('Inspect measured report');
assert.ok(primaryIndex >= 0 && journeyIndex > primaryIndex && measuredIndex > journeyIndex, 'measured report must remain a secondary action after the primary URL Journey');

console.log('Measured workspace boundary contract passed: explicit session-only 09C import, visible LOCAL MEASURED scope, no persistence/upload/Journey coupling.');
