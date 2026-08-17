import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workspace = readFileSync(new URL('../src/CaptureReplayWorkspace.tsx', import.meta.url), 'utf8');
const capturedMicroscope = readFileSync(new URL('../src/CapturedPacketMicroscope.tsx', import.meta.url), 'utf8');
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

for (const forbidden of ['fetch(', 'XMLHttpRequest', 'WebSocket', 'sendBeacon', 'localStorage', 'sessionStorage', 'indexedDB']) {
  assert.ok(!workspace.includes(forbidden), `capture workspace crossed the local/session-only boundary with ${forbidden}`);
}

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

assert.match(capturedMicroscope, /data-packet-provenance="CAPTURED"/);
assert.match(capturedMicroscope, /CAPTURED · READ ONLY/);
assert.match(capturedMicroscope, /frame\.record\.bytes\.copy/);
assert.match(capturedMicroscope, /Selection only changes focus/);
assert.ok(!capturedMicroscope.includes('setConfig'), 'captured Packet Microscope must not expose simulated packet mutation');
assert.ok(!capturedMicroscope.includes('type="range"'), 'captured Packet Microscope must not expose packet mutation controls');
assert.match(microscope, /data-packet-provenance="SIMULATED"/);
assert.match(microscope, /SIMULATED FRAME/);
assert.match(microscope, /if \(props\.capturedFrame\)/);

assert.match(launcher, /id: 'capture'/);
assert.match(navigation, /capture: '\/capture'/);
assert.match(app, /lazy\(\(\) => import\('\.\/CaptureReplayWorkspace\.tsx'\)/);
assert.match(app, /captureReturnPending/);
assert.match(app, /capturedFrame=\{capturedMicroscopeFrame \?\? undefined\}/);
assert.match(app, /CAPTURED EVIDENCE ACTIVE/);

console.log('Track T workspace contract passed: explicit local import, preserved valid replacement state, bounded rendering, deterministic session projections, captured read-only microscopy, lineage, and deep-link navigation.');
