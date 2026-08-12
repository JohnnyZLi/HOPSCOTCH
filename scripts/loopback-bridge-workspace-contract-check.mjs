import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workspace = readFileSync(new URL('../src/MeasuredNetworkWorkspace.tsx', import.meta.url), 'utf8');
const bridge = readFileSync(new URL('../src/measurement/loopbackBridge.ts', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');

assert.match(workspace, /connectLoopbackBridge/);
assert.match(workspace, /fetchLoopbackBridgeReport/);
assert.match(workspace, /data-bridge-status=\{bridgeStatus\}/);
assert.match(workspace, /EXPLICIT LOOPBACK CONNECTION/);
assert.match(workspace, /No scanning or background polling/);
assert.match(workspace, /REFRESH REPORT/);
assert.match(workspace, /DISCONNECT/);

const connectBody = workspace.match(/const connectBridge = async \(\) => \{([\s\S]*?)\n  \};\n\n  const refreshBridgeReport/)?.[1] ?? '';
const refreshBody = workspace.match(/const refreshBridgeReport = async \(\) => \{([\s\S]*?)\n  \};\n\n  const disconnectBridge/)?.[1] ?? '';
const disconnectBody = workspace.match(/const disconnectBridge = \(\) => \{([\s\S]*?)\n  \};\n\n  const clear/)?.[1] ?? '';
const clearBody = workspace.match(/const clear = \(\) => \{([\s\S]*?)\n  \};/)?.[1] ?? '';

assert.ok(connectBody, 'Connect handler must exist.');
assert.ok(refreshBody, 'Refresh handler must exist.');
assert.ok(disconnectBody, 'Disconnect handler must exist.');
assert.ok(clearBody, 'Clear handler must exist.');

assert.match(connectBody, /connectLoopbackBridge\(bridgeOrigin\)/);
assert.doesNotMatch(connectBody, /onMeasuredStateChange/, 'Connect handshake must not create or replace measured truth.');
assert.doesNotMatch(connectBody, /fetchLoopbackBridgeReport/, 'Connect and report refresh must remain separate user actions.');

assert.match(refreshBody, /fetchLoopbackBridgeReport\(bridgeConnection\)/);
assert.match(refreshBody, /onMeasuredStateChange\(next\.state\)/, 'Only validated 09C ingestion state may replace the measured session.');
assert.match(refreshBody, /chooseBestCategory\(next\.state\)/);

assert.match(disconnectBody, /setBridgeConnection\(null\)/);
assert.match(disconnectBody, /setBridgeStatus\('disconnected'\)/);
assert.doesNotMatch(disconnectBody, /onMeasuredStateChange/, 'Disconnect must not erase the last valid measured report.');

assert.match(clearBody, /onMeasuredStateChange\(null\)/);
assert.doesNotMatch(clearBody, /setBridgeConnection|setBridgeStatus|disconnectBridge/, 'Clear measured truth must not silently mutate bridge connection state.');

assert.match(bridge, /credentials:\s*'omit'/);
assert.doesNotMatch(bridge, /setInterval|WebSocket|EventSource/);
assert.match(bridge, /ingestNetworkDiagnosticsReportV2\(report\)/);
assert.doesNotMatch(bridge, /journey\//i);

assert.match(app, /measuredState=\{measuredSession\}/, 'App must continue sharing only the validated measured projection.');
assert.doesNotMatch(app, /LoopbackBridgeConnection|connectLoopbackBridge|fetchLoopbackBridgeReport/, 'Bridge transport state must stay inside Lab 09 rather than becoming app/Journey truth.');

console.log('Loopback bridge workspace contract passed: handshake, report refresh, disconnect, and measured Clear remain separate session concerns.');
