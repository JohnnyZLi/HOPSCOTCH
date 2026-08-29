import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WORKSPACE_PATHS, workspaceDefinition } from '../src/workspace-catalog.ts';
import './capture-track-h-contract-check.mjs';

const workspace = readFileSync(new URL('../src/CaptureReplayWorkspace.tsx', import.meta.url), 'utf8');
const frameMechanism = readFileSync(new URL('../src/CapturedFrameMechanism.tsx', import.meta.url), 'utf8');
const frameMechanismCss = readFileSync(new URL('../src/CapturedFrameMechanism.css', import.meta.url), 'utf8');
const replayMechanismCss = readFileSync(new URL('../src/CaptureReplayMechanismPass.css', import.meta.url), 'utf8');
const trackHPanel = readFileSync(new URL('../src/CaptureTrackHPanel.tsx', import.meta.url), 'utf8');
const asyncParser = readFileSync(new URL('../src/capture/parse-async.ts', import.meta.url), 'utf8');
const workerParser = readFileSync(new URL('../src/capture/parse-worker.ts', import.meta.url), 'utf8');
const capturedMicroscope = readFileSync(new URL('../src/CapturedPacketMicroscope.tsx', import.meta.url), 'utf8');
const capturedMicroscopeCss = readFileSync(new URL('../src/CapturedPacketMicroscopePass.css', import.meta.url), 'utf8');
const microscope = readFileSync(new URL('../src/PacketMicroscope.tsx', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const launcher = readFileSync(new URL('../src/ExploreLauncher.tsx', import.meta.url), 'utf8');
const navigation = readFileSync(new URL('../src/navigation.ts', import.meta.url), 'utf8');

assert.match(workspace, /type="file"/);
assert.match(workspace, /accept="\.pcap,\.pcapng/);
assert.match(workspace, /file\.arrayBuffer\(\)/);
assert.ok(workspace.includes('/\\.(pcap|pcapng)$/i'));
assert.match(workspace, /file\.size > CAPTURE_LIMITS\.maxCaptureBytes/);
assert.match(workspace, /The previous valid capture remains active\./);
assert.match(workspace, /parseCaptureSessionAsync\(buffer\)/);
assert.match(workspace, /<CaptureTrackHPanel session=\{session\} conversationId=\{activeConversation\.id\}/);
assert.match(workspace, /Capture evidence · immutable local session/);
assert.doesNotMatch(workspace, /parseCaptureSession\(buffer\)/, 'primary browser ingest must not silently return to synchronous parse/index work');

for (const forbidden of ['fetch(', 'XMLHttpRequest', 'WebSocket', 'sendBeacon', 'localStorage', 'sessionStorage', 'indexedDB']) {
  assert.ok(!workspace.includes(forbidden), `capture workspace crossed the local/session-only boundary with ${forbidden}`);
  assert.ok(!trackHPanel.includes(forbidden), `Track H evidence panel crossed the local/session-only boundary with ${forbidden}`);
}

assert.match(asyncParser, /new Worker\(new URL\('\.\/parse-worker\.ts'/);
assert.match(asyncParser, /worker\.postMessage\(\{ id: requestId, buffer \}, \[buffer\]\)/);
assert.match(workerParser, /serializeCaptureSessionWire/);
assert.match(workerParser, /parseCaptureSession\(request\.buffer\)/);
assert.match(workerParser, /\[wire\.byteSlab\.buffer\]/);

assert.match(workspace, /session\.eventAtOrBefore\(/);
assert.match(workspace, /SCRUB_UNITS = 100_000n/);
assert.match(workspace, /session\?\.lineage\(/);
assert.match(workspace, /session\.conversationForFrame\(/);
assert.match(workspace, /session\.frameByNumber\(/);
assert.match(workspace, /filteredConversations\.slice\(0, FLOW_RENDER_LIMIT\)/);
assert.match(workspace, /eventWindow\(events, currentEventIndex\)/);
assert.match(workspace, /BYTE_PAGE_SIZE = 256/);
assert.match(workspace, /FOLLOW FLOW/);
assert.match(workspace, /OPEN READ-ONLY PACKET MICROSCOPE/);
assert.match(workspace, /<CapturedFrameMechanism frame=\{selectedFrame\} event=\{selectedEvent\} mode="replay"/);
assert.match(workspace, /mode="frame"/);
assert.match(frameMechanism, /data-frame-mechanism/);
assert.match(frameMechanism, /frame\.record\.bytes\.copy/);
assert.match(frameMechanism, /frame\.layers\.map/);
assert.match(frameMechanism, /layer\.byteRange\.offset/);
assert.match(frameMechanism, /event\?\.direction \?\? 'UNKNOWN'/);
assert.match(frameMechanism, /NO SEMANTIC DIRECTION/);
assert.match(frameMechanism, /IMMUTABLE CAPTURE/);
assert.doesNotMatch(frameMechanism, /requestAnimationFrame/, 'captured-frame mechanism must visualize indexed state without owning semantic time');
assert.match(frameMechanismCss, /\[data-mechanism-mode="replay"\]/);
assert.match(frameMechanismCss, /\[data-mechanism-mode="frame"\]/);
assert.match(frameMechanismCss, /\[data-mechanism-mode="microscope"\]/);
assert.match(frameMechanismCss, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(replayMechanismCss, /\.capture-packet-mechanism/);
assert.match(replayMechanismCss, /\.capture-event-rail button::before/);
assert.match(replayMechanismCss, /html body \.capture-replay\.capture-replay\[data-capture-mode="frame"\]/);

for (const requiredSurface of [
  'PROTOCOL SEQUENCE', 'TCP STREAM + RTT', 'TRAFFIC OVERVIEW', 'COMPARE', 'SIDECAR EVIDENCE',
  'CAPTURE ↔ CAPTURE', 'CAPTURED ↔ SIMULATED COUNTERFACTUAL', 'PARSED DEVICE CONFIG',
]) assert.ok(trackHPanel.includes(requiredSurface), `Track H UI is missing ${requiredSurface}`);
assert.match(trackHPanel, /parseCaptureSessionAsync\(await file\.arrayBuffer\(\)\)/);
assert.match(trackHPanel, /parseCaptureSidecarEvidenceJson/);
assert.match(trackHPanel, /parseNetworkConfiguration/);
assert.match(trackHPanel, /compareCaptureSessions/);
assert.match(trackHPanel, /compareCaptureConversationToSimulation/);
assert.match(trackHPanel, /HOLES STAY HOLES/);
assert.match(trackHPanel, /PROVENANCE NEVER MERGES/);

assert.match(capturedMicroscope, /data-packet-provenance="CAPTURED"/);
assert.match(capturedMicroscope, /CAPTURED · READ ONLY/);
assert.match(frameMechanism, /frame\.record\.bytes\.copy/);
assert.match(capturedMicroscope, /Selection only changes focus/);
assert.match(capturedMicroscope, /<CapturedFrameMechanism/);
assert.match(capturedMicroscope, /mode="microscope"/);
assert.match(capturedMicroscope, /handoffId=\{`captured-frame-\$\{frame\.record\.id\}`\}/);
assert.match(capturedMicroscope, /captured-microscope-mechanism-stage/);
assert.match(capturedMicroscope, /captured-byte-workbench/);
assert.ok(!capturedMicroscope.includes('className="packet-origin-strip"'), 'captured Packet Microscope must not duplicate capture origin as a persistent strip');
assert.ok(!capturedMicroscope.includes('className="packet-object-wrap"'), 'captured Packet Microscope must not recreate the frame as generic packet slabs');
assert.ok(!capturedMicroscope.includes('className="packet-relations"'), 'captured Packet Microscope must not reserve a duplicate metadata band');
assert.ok(!capturedMicroscope.includes('className="packet-layer-shell'), 'captured Packet Microscope must use the continuous captured-frame mechanism');
assert.ok(!capturedMicroscope.includes('<aside className="packet-inspector"'), 'captured Packet Microscope must not retain a permanent legacy inspector');
assert.match(capturedMicroscopeCss, /html body \.captured-packet-workspace\.captured-packet-workspace \.packet-stage/);
assert.match(capturedMicroscopeCss, /grid-template-rows: minmax\(300px, 1\.45fr\) minmax\(185px, \.65fr\)/);
assert.match(capturedMicroscopeCss, /@media \(prefers-reduced-motion: reduce\)/);
assert.ok(!capturedMicroscope.includes('setConfig'), 'captured Packet Microscope must not expose simulated packet mutation');
assert.ok(!capturedMicroscope.includes('type="range"'), 'captured Packet Microscope must not expose packet mutation controls');
assert.match(microscope, /data-packet-provenance="SIMULATED"/);
assert.match(microscope, /SIMULATED · RECOMPUTED/);
assert.match(microscope, /if \(props\.capturedFrame\)/);

const captureProduct = workspaceDefinition('capture');
assert.equal(captureProduct.status, 'CAPTURED EVIDENCE ACTIVE', 'Capture Replay must expose its current product identity instead of an internal track number');
assert.equal(captureProduct.path, '/capture');
assert.equal(captureProduct.status, 'CAPTURED EVIDENCE ACTIVE');
assert.equal(WORKSPACE_PATHS.capture, '/capture');
assert.match(launcher, /EXPLORE_GROUPS/, 'Explore must consume the catalog group containing Capture Replay');
assert.match(launcher, /workspaceDefinition\(id\)/, 'Explore must resolve Capture Replay metadata from the canonical catalog');
assert.match(navigation, /WORKSPACE_PATHS/, 'navigation must consume catalog-owned capture path rather than duplicate it');
assert.match(app, /lazy\(\(\) => import\('\.\/CaptureReplayWorkspace\.tsx'\)/);
assert.match(app, /captureReturnPending/);
assert.match(app, /capturedFrame=\{capturedMicroscopeFrame \?\? undefined\}/);
assert.match(app, /workspaceDefinition/, 'App must consume catalog-owned Capture Replay status/lab metadata');

console.log('Track H workspace contract passed: explicit local import, worker-backed primary parsing, bounded analysis surfaces, preserved replay/microscopy, catalog-owned current product identity, local-only comparison and sidecars, and provenance-separated counterfactual inspection.');
