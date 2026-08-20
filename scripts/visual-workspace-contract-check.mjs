import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const shared = readFileSync(new URL('../src/VisualWorkspace.tsx', import.meta.url), 'utf8');
const sharedCss = readFileSync(new URL('../src/VisualWorkspace.css', import.meta.url), 'utf8');
const journey = readFileSync(new URL('../src/JourneyTheaterV2.tsx', import.meta.url), 'utf8');
const journeyCss = readFileSync(new URL('../src/JourneyTheater.css', import.meta.url), 'utf8');
const failure = readFileSync(new URL('../src/FailureStoryWorkspace.tsx', import.meta.url), 'utf8');
const failureCss = readFileSync(new URL('../src/FailureStoryWorkspace.css', import.meta.url), 'utf8');
const tcp = readFileSync(new URL('../src/TcpTheater.tsx', import.meta.url), 'utf8');
const dns = readFileSync(new URL('../src/DnsTheater.tsx', import.meta.url), 'utf8');
const tls = readFileSync(new URL('../src/TlsTheater.tsx', import.meta.url), 'utf8');
const http = readFileSync(new URL('../src/HttpComparisonTheater.tsx', import.meta.url), 'utf8');
const tcpCss = readFileSync(new URL('../src/tcp.css', import.meta.url), 'utf8');
const dnsCss = readFileSync(new URL('../src/dns.css', import.meta.url), 'utf8');
const protocolCss = readFileSync(new URL('../src/protocol-workspaces.css', import.meta.url), 'utf8');
const asTheater = readFileSync(new URL('../src/InternetScaleTheater.tsx', import.meta.url), 'utf8');
const asCss = readFileSync(new URL('../src/InternetScaleTheater.phase3.css', import.meta.url), 'utf8');
const physical = readFileSync(new URL('../src/PhysicalInternetGlobe.tsx', import.meta.url), 'utf8');
const physicalCss = readFileSync(new URL('../src/PhysicalInternetGlobe.phase3.css', import.meta.url), 'utf8');
const packet = readFileSync(new URL('../src/PacketMicroscope.tsx', import.meta.url), 'utf8');
const capturedPacket = readFileSync(new URL('../src/CapturedPacketMicroscope.tsx', import.meta.url), 'utf8');
const packetCss = readFileSync(new URL('../src/packet.phase3.css', import.meta.url), 'utf8');
const builder = readFileSync(new URL('../src/NetworkBuilder.tsx', import.meta.url), 'utf8');
const builderCss = readFileSync(new URL('../src/NetworkBuilder.phase3.css', import.meta.url), 'utf8');
const builderApplication = readFileSync(new URL('../src/BuilderApplicationDataPlaneWorkspace.tsx', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');

assert.match(shared, /export function VisualWorkspaceShell/);
assert.match(shared, /export function VisualTimeRail/);
assert.match(shared, /export function VisualDrawerTabs/);
assert.match(shared, /export function VisualOverlayDrawer/);
assert.match(shared, /export function VisualEntranceTransition/);
assert.match(shared, /export function useVisualDrawerFocus/);
assert.match(shared, /aria-modal="true"/);
assert.match(shared, /event\.key === 'Escape'/);
assert.match(shared, /event\.key !== 'Tab'/);
assert.match(shared, /previousFocus\?\.focus\(\)/);
assert.match(shared, /useReducedMotion/);
assert.match(sharedCss, /@media \(prefers-reduced-motion: reduce\)/);

assert.match(sharedCss, /\.visual-workspace__stage \{/);
assert.match(sharedCss, /\.visual-drawer \{[\s\S]*position: absolute;/);
assert.match(sharedCss, /\.visual-drawer-backdrop \{[\s\S]*position: absolute;/);
assert.match(sharedCss, /\.visual-workspace__toolbar \{[\s\S]*position: absolute;/);
assert.match(sharedCss, /\.visual-workspace__hud \{[\s\S]*position: absolute;/);
assert.match(sharedCss, /height: calc\(100dvh - 89px\)/);
assert.ok(!sharedCss.includes('grid-template-columns: minmax(0, 1fr) 350px'), 'shared visual shell must not reserve a permanent inspector column');
assert.match(sharedCss, /\.visual-workspace \{[\s\S]*width: calc\(100% - 20px\);[\s\S]*max-width: none;/);

for (const [name, source] of [
  ['Journey', journey],
  ['Failure Story', failure],
  ['TCP', tcp],
  ['DNS', dns],
  ['TLS', tls],
  ['HTTP', http],
]) {
  const toggle = source.match(/const togglePlayback = \(\) => \{([\s\S]*?)\n  \};/)?.[1] ?? '';
  assert.ok(toggle, `${name} must expose a playback toggle`);
  assert.ok(!toggle.includes('setActiveDrawer'), `${name} pause/play must not open or close a drawer`);
}

assert.match(journey, /className="journey-visual-workspace"/);
assert.match(journey, /activeDrawer=\{activeDrawer\}/);
assert.match(journey, /id: 'config'/);
assert.match(journey, /id: 'events'/);
assert.match(journey, /id: 'evidence'/);
assert.match(journey, /id: 'inspect'/);
assert.match(journey, /PROVENANCE/);
assert.match(journey, /timelineMilestones/);
assert.ok(!journey.includes('className="journey-main"'), 'Journey must not render the legacy dashboard grid');
assert.ok(!journey.includes('className="journey-heading"'), 'Journey title must be entrance choreography, not persistent document flow');
assert.ok(!journey.includes('className="journey-rail"'), 'Journey must not reserve a permanent causal/evidence rail');
assert.ok(!journey.includes('className="journey-stage-meta"'), 'Journey must not recreate the old metadata strip');

assert.match(journeyCss, /\.journey-cinematic-stage \{[\s\S]*position: absolute;/);
assert.match(journeyCss, /\.journey-depth-overlay \{[\s\S]*position: absolute;/);
assert.match(journeyCss, /\.journey-callout-overlay \{[\s\S]*position: absolute;/);

assert.match(failure, /className="failure-visual-workspace"/);
assert.match(failure, /failure-object-annotation/);
assert.match(failure, /id: 'events'/);
assert.match(failure, /id: 'inspect'/);
assert.match(failure, /PROVENANCE/);
assert.match(failure, /timelineMilestones/);
assert.match(failureCss, /\.failure-cinematic-stage \{[\s\S]*position: absolute;/);
assert.match(failureCss, /\.failure-object-annotation \{[\s\S]*position: absolute;/);
assert.ok(!failure.includes('className="event-inspector"'), 'Failure Story must not reserve the legacy permanent causal inspector');
assert.ok(!failure.includes('className="lab-heading"'), 'Failure Story title must be entrance choreography, not persistent document flow');

const protocolTheaters = [
  { name: 'TCP', source: tcp, className: 'tcp-visual-workspace', forbidden: ['className="tcp-heading"', 'className="tcp-inspector"', 'className="tcp-stage-meta"', 'className="time-machine tcp-time-machine"'] },
  { name: 'DNS', source: dns, className: 'dns-visual-workspace', forbidden: ['className="dns-heading"', 'className="dns-inspector"', 'className="dns-stage-meta"', 'className="time-machine dns-time-machine"'] },
  { name: 'TLS', source: tls, className: 'tls-visual-workspace', forbidden: ['className="tls-heading"', 'className="tls-inspector"', 'className="tls-stage-meta"', 'className="time-machine tls-time-machine"'] },
  { name: 'HTTP', source: http, className: 'http-visual-workspace', forbidden: ['className="http-heading"', 'className="http-inspector"', 'className="http-stage-meta"', 'className="time-machine http-time-machine"'] },
];

for (const theater of protocolTheaters) {
  assert.ok(theater.source.includes(`className="protocol-visual-workspace ${theater.className}"`), `${theater.name} must use the shared visual workspace shell`);
  assert.match(theater.source, /activeDrawer=\{activeDrawer\}/);
  assert.match(theater.source, /PROVENANCE/);
  assert.match(theater.source, /timelineMilestones/);
  assert.match(theater.source, /VisualDrawerTabs/);
  assert.match(theater.source, /VisualTimeRail/);
  for (const forbidden of theater.forbidden) assert.ok(!theater.source.includes(forbidden), `${theater.name} must not retain ${forbidden}`);
}

assert.match(tcp, /tcp-sequence-space/);
assert.match(tcp, /tcp-congestion-panel/);
assert.match(dns, /dns-namespace-ladder/);
assert.match(dns, /data-dns-actor/);
assert.match(tls, /tls-key-schedule/);
assert.match(tls, /tls-cipher-field/);
assert.match(http, /http-divergence-axis/);
assert.match(http, /<Lane lane="h2"/);
assert.match(http, /<Lane lane="h3"/);
assert.match(sharedCss, /\.protocol-cinematic-stage \{[\s\S]*position: absolute;/);
assert.match(sharedCss, /\.protocol-scene-annotation \{[\s\S]*position: absolute;/);
assert.match(tcpCss, /\.tcp-workspace-stage \{[\s\S]*height: 100%;/);
assert.match(dnsCss, /\.dns-workspace-map \{[\s\S]*height: 100%;/);
assert.match(protocolCss, /\.tls-workspace-stage \{[\s\S]*height: 100%;/);
assert.match(protocolCss, /\.http-workspace-stage \{[\s\S]*height: 100%;/);
assert.match(protocolCss, /@media \(max-width: 680px\)/);

assert.match(asTheater, /className="as-visual-workspace interactive-world-workspace"/);
assert.match(asTheater, /activeDrawer=\{activeDrawer\}/);
assert.match(asTheater, /as-selection-card/);
assert.match(asTheater, /SIMULATED WINNER/);
assert.ok(!asTheater.includes('className="internet-main"'), 'AS Routing must not reserve the legacy graph + controls grid');
assert.ok(!asTheater.includes('className="internet-heading"'), 'AS Routing title must be entrance choreography');
assert.match(asCss, /\.as-cinematic-stage \{[\s\S]*position: absolute;/);
assert.match(asCss, /\.as-cinematic-stage > \.internet-canvas-wrap \{[\s\S]*position: absolute;/);
assert.match(asCss, /\.as-visual-workspace \{[\s\S]*width: calc\(100% - 20px\);[\s\S]*max-width: none;/);
assert.match(asCss, /\.as-visual-workspace \{[\s\S]*height: calc\(100dvh - 89px\);/);
assert.match(asCss, /@media \(max-width: 680px\)[\s\S]*\.as-visual-workspace \.interactive-world-hud > \.interactive-world-hud__truth \{ display: grid; \}/);

assert.match(physical, /className="physical-visual-workspace interactive-world-workspace"/);
assert.match(physical, /activeDrawer=\{activeDrawer\}/);
assert.match(physical, /physical-selection-card/);
assert.match(physical, /SIMULATED STRESS POINTS · NOT PUBLIC DATA/);
assert.ok(!physical.includes('className="physical-main"'), 'Physical Atlas must not reserve the legacy globe + controls grid');
assert.ok(!physical.includes('className="physical-heading"'), 'Physical Atlas title must be entrance choreography');
assert.match(physicalCss, /\.physical-cinematic-stage,[\s\S]*position: absolute;/);
assert.match(physicalCss, /\.physical-cinematic-stage > \.globe-viewport[\s\S]*inset: 0;/);
assert.ok(!physical.includes('SELECT TWO FACILITIES'), 'Physical Atlas must not reserve an inactive corridor card');
assert.match(physical, /\{\(corridorA \|\| corridorB\) && <article className=\{`physical-corridor-card/);
assert.match(physicalCss, /\.physical-visual-workspace \{[\s\S]*width: calc\(100% - 20px\);[\s\S]*max-width: none;/);
assert.match(physicalCss, /\.physical-visual-workspace \{[\s\S]*height: calc\(100dvh - 89px\);/);
assert.match(physicalCss, /@media \(max-width: 680px\)[\s\S]*\.physical-visual-workspace \.interactive-world-hud > \.interactive-world-hud__truth \{ display: grid; \}/);

assert.match(packet, /className="packet-visual-workspace interactive-world-workspace"/);
assert.match(packet, /packet-field-lens/);
assert.match(packet, /data-packet-provenance="SIMULATED"/);
assert.match(capturedPacket, /captured-packet-workspace/);
assert.match(capturedPacket, /data-packet-provenance="CAPTURED"/);
assert.match(capturedPacket, /CAPTURED · READ ONLY/);
assert.match(capturedPacket, /TRACK H · PACKET EVIDENCE/);
assert.ok(!/Track T|TRACK T/.test(capturedPacket), 'captured Packet Microscope must use the canonical Track H product identity');
assert.match(packetCss, /\.packet-visual-workspace \.packet-stage \{[\s\S]*position: absolute;/);
assert.match(packetCss, /\.packet-visual-workspace \.visual-workspace__stage > \.packet-inspector \{[\s\S]*display: none;/);
assert.match(packetCss, /\.packet-inspector\.packet-drawer-panel/);
assert.match(packetCss, /\.packet-visual-workspace \{[\s\S]*width: calc\(100% - 20px\);[\s\S]*max-width: none;/);
assert.match(packetCss, /\.packet-visual-workspace \{[\s\S]*height: calc\(100dvh - 89px\);/);

assert.match(builder, /builder-visual-workspace interactive-world-workspace/);
assert.match(builder, /data-builder-drawer=\{builderDrawer \?\? 'closed'\}/);
assert.match(builder, /data-scene-panel=\{scenePanel \?\? 'graph'\}/);
assert.match(builder, /builder-scene-switcher/);
assert.match(builder, /builder-selection-card/);
assert.match(builderCss, /\.builder-visual-workspace \.builder-canvas \{[\s\S]*position: absolute;/);
assert.match(builderCss, /\.builder-visual-workspace \.builder-canvas-viewport \{[\s\S]*position: absolute;[\s\S]*inset: 0;/);
assert.match(builderApplication, /className="builder-application-surfaces"/);
assert.match(builderCss, /\.builder-visual-workspace \.builder-application-surfaces,[\s\S]*display: none;/);
assert.match(builderCss, /\.builder-context-drawer \{[\s\S]*position: absolute;/);
assert.match(builderCss, /\.builder-context-drawer\.open/);
assert.ok(!builderCss.includes('grid-template-columns:minmax(0,1fr)360px'), 'Phase 3 Builder must not restore the permanent controls column');
assert.match(builder, /useVisualDrawerFocus<HTMLElement>\(Boolean\(builderDrawer\)/);
assert.match(builder, /ref=\{builderDrawerRef\}/);
assert.match(builder, /ref=\{builderDrawerCloseRef\}/);
const builderToolbar = builder.match(/<div className="builder-world-tools"[\s\S]*?<\/div>/)?.[0] ?? '';
for (const label of ['INSPECT', 'TOPOLOGY', 'SYSTEMS', 'FAIL LINK', 'CLI']) assert.ok(builderToolbar.includes(label), `Builder toolbar must expose accurate ${label} behavior`);
for (const misleading of ['>SELECT<', '>NODE<', '>LINK<', '>PROBE<', '>FAULT<', '>MORE<']) assert.ok(!builderToolbar.includes(misleading), `Builder toolbar must not retain misleading ${misleading.slice(1, -1)} mode copy`);
const builderHud = builder.match(/<div className="builder-stage-meta">([\s\S]*?)<div ref=\{canvasRef\}/)?.[1] ?? '';
for (const state of ['PATH', 'FORWARDING', 'PROBE', 'OSPF', 'GRAPH']) assert.ok(builderHud.includes(`>${state}<`), `Builder HUD must retain high-value ${state} state`);
for (const redundant of ['ROUTED POLICY', '>STATIC<', 'NAT/PAT']) assert.ok(!builderHud.includes(redundant), `Builder HUD must keep ${redundant.replaceAll(/[><]/g, '')} contextual`);
assert.match(builderCss, /\.builder-workspace\.builder-visual-workspace \{[\s\S]*width: calc\(100% - 20px\);[\s\S]*max-width: none;/);
assert.match(builderCss, /\.builder-workspace\.builder-visual-workspace \{[\s\S]*height: calc\(100dvh - 89px\);/);

assert.match(app, /<FailureStoryWorkspace/);
assert.ok(!app.includes('className="lab-workspace"'), 'App must not retain the legacy Failure Story dashboard shell');

console.log('Visual workspace contract passed: Journey, Failure Story, protocol theaters, AS Routing, Physical Atlas, Packet Microscope, and Builder are scene-first with contextual overlays and explicit provenance.');
