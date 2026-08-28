import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const css = read('../src/MechanismSecondPass.css');
const systemCss = read('../src/SiteEditorialWorkspaceSystem.css');
const dns = read('../src/DnsTheater.tsx');
const tcp = read('../src/TcpTheater.tsx');
const tls = read('../src/TlsTheater.tsx');
const http = read('../src/HttpComparisonTheater.tsx');
const packet = read('../src/PacketMicroscope.tsx');
const capture = read('../src/CaptureReplayWorkspace.tsx');
const observed = read('../src/ObservedInternet.tsx');
const measured = read('../src/MeasuredNetworkWorkspace.tsx');
const physical = read('../src/PhysicalInternetGlobe.tsx');
const explore = read('../src/ExploreLauncher.tsx');
const performanceProfile = read('./performance-profile.mjs');

assert.ok(systemCss.trimEnd().endsWith("@import './MechanismSecondPass.css';"), 'mechanism layer must load after every legacy workspace skin');

for (const [name, source, tokens] of [
  ['DNS', dns, ['dns-namespace-field', 'dns-query-core', "className={activeEvent.from === from"]],
  ['TCP', tcp, ['tcp-stream-ribbon', 'tcp-ack-gate', 'tcp-window-field', 'tcp-sequence-axis']],
  ['TLS', tls, ['tls-protection-shell', 'tls-record-core', 'tls-key-flow', 'tls-transcript-spine']],
  ['HTTP', http, ['http-mechanism-orbits', 'http-shared-order-gate', 'http-independent-stream-field', 'http-flow-window']],
  ['Packet', packet, ['packet-byte-river', '--packet-byte-index']],
  ['Capture', capture, ['capture-ingest-stream', 'capture-ingest-path']],
]) {
  for (const token of tokens) assert.ok(source.includes(token), `${name} is missing mechanism token ${token}`);
}

assert.ok(observed.includes("useState<VisualDrawerId | null>(null)"), 'Internet Evidence must not obscure its scene with a default-open drawer');
assert.ok(observed.includes('observed-dormant-field') && observed.includes('observed-dormant-gap'));
assert.ok(measured.includes('measured-dormant-field') && measured.includes('measured-dormant-pulse'));
assert.ok(physical.includes('globe-fallback-mechanism') && physical.includes("setActiveDrawer('tools')"));
assert.ok(explore.includes('type="search"') && explore.includes('searchResults.map'));
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
  '.packet-byte-river',
  '.capture-ingest-stream',
  '.capture-ingest-path',
  '.observed-dormant-field',
  '.measured-dormant-field',
  '.globe-fallback-mechanism',
  '.explore-search',
  '@media (max-width: 560px)',
  '@media (prefers-reduced-motion: reduce)',
]) assert.ok(css.includes(token), `second-pass CSS is missing ${token}`);

assert.doesNotMatch(css, /\.dns-workspace-map \.dns-actor[^{]*\{[^}]*border-radius:\s*[3-9]px/s);
assert.doesNotMatch(css, /\.tcp-message-token[^{]*\{[^}]*background:\s*rgba\(231/s);

console.log('Mechanism second-pass contract passed: protocols, bytes, evidence states, fallback, navigation search, responsive behavior, and reduced motion are locked.');
