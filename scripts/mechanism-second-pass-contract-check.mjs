import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const css = read('../src/MechanismSecondPass.css');
const exploreCss = read('../src/ExploreLauncher.css');
const systemCss = read('../src/SiteEditorialWorkspaceSystem.css');
const dns = read('../src/DnsTheater.tsx');
const tcp = read('../src/TcpTheater.tsx');
const tls = read('../src/TlsTheater.tsx');
const http = read('../src/HttpComparisonTheater.tsx');
const packet = read('../src/PacketMicroscope.tsx');
const simulatedPacket = read('../src/SimulatedPacketMechanism.tsx');
const simulatedPacketCss = read('../src/SimulatedPacketMechanism.css');
const capture = read('../src/CaptureReplayWorkspace.tsx');
const observed = read('../src/ObservedInternet.tsx');
const measured = read('../src/MeasuredNetworkWorkspace.tsx');
const capturePhase4Css = read('../src/CaptureReplayWorkspace.phase4.css');
const evidenceShellCss = read('../src/KineticEvidenceWorkspaceShell.css');
const physical = read('../src/PhysicalInternetGlobe.tsx');
const explore = read('../src/ExploreLauncher.tsx');
const internetScale = read('../src/InternetScaleTheater.tsx');
const builder = read('../src/NetworkBuilder.tsx');
const performanceProfile = read('./performance-profile.mjs');

assert.ok(systemCss.includes("@import './MechanismSecondPass.css';"), 'shared mechanism layer must load after every legacy workspace skin');
assert.ok(systemCss.trimEnd().endsWith("@import './NetworkBuilderMechanismPass.css';"), 'Builder mechanism refinement must load after the shared mechanism layer');

for (const [name, source, tokens] of [
  ['DNS', dns, ['dns-namespace-field', 'dns-query-core', "className={activeEvent.from === from"]],
  ['TCP', tcp, ['tcp-stream-ribbon', 'tcp-ack-gate', 'tcp-window-field', 'tcp-sequence-axis']],
  ['TLS', tls, ['tls-protection-shell', 'tls-record-core', 'tls-key-flow', 'tls-transcript-spine']],
  ['HTTP', http, ['http-mechanism-orbits', 'http-shared-order-gate', 'http-independent-stream-field', 'http-flow-window']],
  ['Packet', packet, ['SimulatedPacketMechanism', 'simulated-packet-mechanism-stage', 'simulated-byte-workbench']],
  ['Capture', capture, ['capture-ingest-stream', 'capture-ingest-path']],
]) {
  for (const token of tokens) assert.ok(source.includes(token), `${name} is missing mechanism token ${token}`);
}

for (const token of ['data-simulated-packet-mechanism', 'simulated-packet-assembly', 'simulated-packet-dependencies', 'simulated-packet-byte-rail', 'SIMULATED · RECOMPUTED']) {
  assert.ok(simulatedPacket.includes(token), `simulated Packet mechanism is missing ${token}`);
}
for (const token of ['.simulated-packet-layer--ethernet', '.simulated-packet-layer--network', '.simulated-packet-layer--transport', '.simulated-packet-layer--payload', '@media (prefers-reduced-motion: reduce)']) {
  assert.ok(simulatedPacketCss.includes(token), `simulated Packet mechanism CSS is missing ${token}`);
}
assert.doesNotMatch(simulatedPacket, /requestAnimationFrame|setInterval|setTimeout/, 'simulated Packet mechanism must render deterministic generated state without owning semantic time');
assert.ok(!packet.includes('className="packet-origin-strip"'), 'simulated Packet Microscope must keep origin as a peripheral annotation');
assert.ok(!packet.includes('className="packet-object-wrap"'), 'simulated Packet Microscope must not restore generic packet slabs');
assert.ok(!packet.includes('className="packet-layer-shell'), 'simulated Packet Microscope must not restore generic layer cards');

assert.ok(observed.includes("useState<VisualDrawerId | null>(null)"), 'Internet Evidence must not obscure its scene with a default-open drawer');
assert.ok(observed.includes('observed-dormant-field') && observed.includes('observed-dormant-gap'));
assert.ok(observed.includes('EvidenceIslandSignal') && observed.includes('evidence-gap-engine') && observed.includes('snapshot.collectorPaths.length'), 'Internet Evidence must animate inside provenance islands while leaving the unobserved middle disconnected');
assert.ok(measured.includes('measured-dormant-field') && measured.includes('measured-dormant-pulse'));
assert.ok(measured.includes('MeasuredSignalField') && measured.includes("fact.availability !== 'unavailable'") && measured.includes('REPORT BOUNDARY'), 'Measured Network may emit kinetic traces only for accepted local facts inside the report boundary');
assert.ok(measured.includes('measured-setup-clear') && measured.includes('onClick={clear}'), 'Measured Network Setup must retain a reachable session-clear action when the compact toolbar hides Clear');
for (const token of ['capture-session-drawer', 'capture-session-replace', 'capture-session-clear', "openContextDrawer('session')"]) {
  assert.ok(capture.includes(token), `Capture Replay is missing compact session lifecycle control ${token}`);
}
assert.ok(capturePhase4Css.includes('.capture-heading-actions .capture-session { display: none; }') && evidenceShellCss.includes('html body .capture-heading-actions .capture-session') && evidenceShellCss.includes('display: inline-flex !important'), 'Capture Replay must promote Session into the compact toolbar without adding desktop chrome');
assert.ok(physical.includes('globe-fallback-mechanism') && physical.includes("setActiveDrawer('tools')"));
assert.ok(explore.includes('type="search"') && explore.includes('searchResults.map'));
for (const token of ['.explore-search', '.explore-scale-map', '@media (prefers-reduced-motion: reduce)']) {
  assert.ok(exploreCss.includes(token), `always-loaded navigation mechanism CSS is missing ${token}`);
}
assert.ok(internetScale.includes("useState('')") && internetScale.includes('ctx.lineDashOffset') && internetScale.includes("for (const offset of [0, .33, .66])"), 'AS Routing must begin without a permanent relationship card and animate only the computed winner');
assert.ok(builder.includes('builder-route-signal-track') && builder.includes('builder-selection-card'), 'Builder must keep its computed route signal and contextual selection instrument');
assert.ok(performanceProfile.includes(".observed-toolbar-controls .visual-drawer-tabs button', 'QUERY'"), 'Phase 4 browser review must open the now-contextual Query drawer before submitting');

for (const token of [
  '.dns-namespace-field',
  '.dns-link-layer line.is-active',
  '.tcp-stream-ribbon',
  '.tcp-ack-gate',
  '.tcp-window-field',
  '.tls-protection-shell',
  '.tls-key-flow',
  '.http-mechanism-orbits',
  '.http-shared-order-gate',
  '.http-flow-window',
  '.capture-ingest-stream',
  '.capture-ingest-path',
  '.observed-dormant-field',
  '.evidence-island-signal',
  '.evidence-gap-engine',
  '.measured-dormant-field',
  '.measured-signal-field',
  '.measured-signal-traces',
  '.globe-fallback-mechanism',
  '.internet-scale :is(.as-winner-readout, .as-selection-card)',
  '.builder-visual-workspace .builder-link.active',
  '.builder-visual-workspace .builder-selection-card',
  '@media (max-width: 560px)',
  '@media (prefers-reduced-motion: reduce)',
]) assert.ok(css.includes(token), `second-pass CSS is missing ${token}`);

assert.doesNotMatch(css, /\.dns-workspace-map \.dns-actor[^{]*\{[^}]*border-radius:\s*[3-9]px/s);
assert.doesNotMatch(css, /\.tcp-message-token[^{]*\{[^}]*background:\s*rgba\(231/s);

console.log('Mechanism second-pass contract passed: protocols, bytes, evidence states, compact session lifecycle, fallback, navigation search, responsive behavior, and reduced motion are locked.');
