import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const styles = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const networkField = readFileSync(new URL('../src/NetworkField.tsx', import.meta.url), 'utf8');
const visualWorkspace = readFileSync(new URL('../src/VisualWorkspace.tsx', import.meta.url), 'utf8');
const visualWorkspaceCss = readFileSync(new URL('../src/VisualWorkspace.css', import.meta.url), 'utf8');
const journeySource = readFileSync(new URL('../src/JourneyTheaterV2.tsx', import.meta.url), 'utf8');
const journeyCss = readFileSync(new URL('../src/JourneyTheater.css', import.meta.url), 'utf8');
const tcpSource = readFileSync(new URL('../src/TcpTheater.tsx', import.meta.url), 'utf8');
const dnsSource = readFileSync(new URL('../src/DnsTheater.tsx', import.meta.url), 'utf8');
const tlsSource = readFileSync(new URL('../src/TlsTheater.tsx', import.meta.url), 'utf8');
const httpSource = readFileSync(new URL('../src/HttpComparisonTheater.tsx', import.meta.url), 'utf8');
const protocolCss = readFileSync(new URL('../src/protocol-workspaces.css', import.meta.url), 'utf8');
const editorialCss = readFileSync(new URL('../src/SiteEditorialLight.css', import.meta.url), 'utf8');
const editorialAuditCss = readFileSync(new URL('../src/SiteEditorialWorkspaceAudit.css', import.meta.url), 'utf8');
const entry = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8');
const internetScale = readFileSync(new URL('../src/InternetScaleTheater.tsx', import.meta.url), 'utf8');

// Keep the selected scale explanation structurally attached to the rail; production review covers all five rows.
assert.ok(
  styles.includes('.scale-inspector {'),
  'overview scale selector and explanation must share one scale-inspector positioning context',
);
assert.ok(
  styles.includes('top: clamp(240px, 31vh, 320px);'),
  'desktop scale inspector must occupy the open scene band rather than the launch-card row',
);
assert.ok(
  styles.includes('right: max(32px, calc((100vw - min(1500px, calc(100vw - 64px))) / 2));'),
  'scale inspector must retain the canonical viewport/content gutter anchor',
);
assert.ok(
  styles.includes('.scale-inspector[data-active-scale="packet"] { --scale-detail-y: 232.5px; }'),
  'scale explanation must track the selected rail row instead of floating at one fixed vertical position',
);
assert.ok(
  styles.includes('right: 174px;') && styles.includes('width: 32px;'),
  'scale explanation and active rail row must preserve the dedicated connector lane',
);
assert.ok(
  styles.includes('background: linear-gradient(90deg, rgba(5, 8, 12, 0.82), rgba(5, 8, 12, 0.46) 72%, rgba(5, 8, 12, 0));'),
  'scale explanation must use a lightweight scene flyout rather than a bordered dashboard card',
);
assert.ok(
  styles.includes('@media (max-width: 1380px) and (min-width: 1181px)') && styles.includes('display: none;'),
  'scale explanation must disappear before it can collide horizontally with the hero/action deck',
);

assert.ok(
  app.includes('layoutId="overview-scale-marker"') && app.includes('scale-depth-wave') && app.includes('scale-depth-ripple'),
  'overview scale changes must expose a travelling cursor plus bounded transition wave/ripple',
);
assert.ok(
  app.includes('const activeLayerTop = 24.5 +') && app.includes('animate={{ top: activeLayerTop }}') && app.includes('className="layer-card-copy"'),
  'scale explanation and connector must physically travel between rows while their contents resolve independently',
);
assert.ok(
  styles.includes('margin-top: -14.5px;') && !styles.includes('transform: translateY(-50%);\n  pointer-events: none;'),
  'shared-layout scale marker must not let CSS transforms fight Motion layout transforms',
);
assert.ok(
  styles.includes('.layer-card-copy {') && styles.includes('background: transparent;'),
  'travelling scale instrument must not leave an opaque empty flyout while copy crossfades',
);
assert.ok(
  styles.includes('@keyframes scale-depth-wave-in') && styles.includes('@keyframes scale-depth-wave-out'),
  'scale direction must emit a deterministic keyed scan wave in both abstraction directions',
);
assert.ok(
  app.includes("setScaleDirection(nextIndex > currentIndex ? 'inward' : 'outward')"),
  'overview scale motion must preserve whether the user is diving inward or pulling outward',
);
assert.ok(
  styles.includes('.app-shell[data-lab="idle"][data-layer="packet"] { --network-depth-scale: 1.36;') && styles.includes('transition: transform 900ms cubic-bezier(0.16, 1, 0.3, 1)'),
  'overview network scene must physically deepen as abstraction moves toward Packet',
);
assert.ok(
  networkField.includes('layerDashTravel') && networkField.includes('layerPulseDuration') && networkField.includes('coreAnimation'),
  'Anime.js network-field response must intensify deterministically with selected scale',
);
assert.ok(
  styles.includes('@media (prefers-reduced-motion: reduce)'),
  'scale spectacle must retain the global reduced-motion escape hatch',
);

assert.ok(
  app.includes("const buildName = activeWorkspace?.name ?? 'FOUNDATION ONLINE'") && app.includes('className="build-phase"'),
  'topbar must prioritize canonical workspace identity while preserving live failure phase state',
);
assert.ok(
  styles.includes('.build-state .status-dot {') && styles.includes('text-overflow: ellipsis;'),
  'workspace identity must remain readable without allowing long names to destabilize topbar geometry',
);

assert.ok(
  visualWorkspaceCss.includes('font-variant-numeric: tabular-nums'),
  'shared visual Time Rail must use tabular numerals so advancing time cannot shift controls',
);
assert.ok(
  visualWorkspaceCss.includes('grid-template-rows: minmax(0, 1fr) auto'),
  'shared visual workspaces must reserve only the Time Rail outside the scene',
);
assert.ok(
  visualWorkspaceCss.includes('.visual-drawer {') && visualWorkspaceCss.includes('position: absolute;'),
  'shared drawers must overlay rather than resize the stage',
);
assert.ok(
  visualWorkspace.includes("event.key === 'Escape'") && visualWorkspace.includes("event.key !== 'Tab'") && visualWorkspace.includes('previousFocus?.focus()'),
  'shared drawers must preserve Escape, focus containment, and focus restoration',
);
assert.ok(
  journeySource.includes('className="journey-visual-workspace"') && !journeySource.includes('className="journey-stage-meta"'),
  'Journey must use the scene-first shell instead of the unstable permanent metadata strip',
);
assert.ok(
  journeyCss.includes('.journey-cinematic-stage .journey-scene-transition') && journeyCss.includes('position: absolute;'),
  'Journey scale transitions must remain inside a stable full-stage positioning context',
);

for (const [name, source] of [['TCP', tcpSource], ['DNS', dnsSource], ['TLS', tlsSource], ['HTTP', httpSource]]) {
  assert.ok(
    source.includes('protocol-cinematic-stage') && source.includes('protocol-scene-annotation'),
    `${name} must keep its active explanation attached to the stable scene positioning context`,
  );
  const playbackToggle = source.match(/const togglePlayback = \(\) => \{([\s\S]*?)\n  \};/)?.[1] ?? '';
  assert.ok(playbackToggle && !playbackToggle.includes('setActiveDrawer'), `${name} playback must freeze/resume without mutating inspection state`);
  assert.ok(source.includes('const openDrawer') && source.includes('setActiveDrawer'), `${name} inspection controls must retain explicit drawer ownership`);
}
assert.ok(
  protocolCss.includes('.tls-workspace-stage') && protocolCss.includes('.http-workspace-stage') && protocolCss.includes('@media (max-width: 680px)'),
  'TLS and HTTP scene planes must own explicit full-stage and mobile geometry',
);

// The Journey editorial surface is now the default product language. Keep the
// paper/ink/coral system centralized and make dark surfaces explicit tools.
for (const token of [
  '--site-paper: #d9d4cf',
  '--site-ink: #292827',
  '--site-coral: #d84f49',
  '--site-instrument: #302e2c',
  'html body .app-shell',
  'html body .explore-panel',
  'html body .builder-stage',
  'html body .measured-workspace',
  'html body .capture-replay',
]) assert.ok(editorialCss.includes(token), `Missing site editorial-light contract: ${token}`);

for (const token of [
  '.packet-visual-workspace .packet-stage',
  '.capture-replay .capture-evidence-inspector.is-frame-stage',
  '.observed-internet .evidence-card',
  '.internet-scale .as-winner-readout',
]) assert.ok(editorialAuditCss.includes(token), `Missing browser-audited editorial workspace correction: ${token}`);

assert.ok(
  entry.includes("./SiteEditorialLight.css") && entry.includes("./SiteEditorialWorkspaceAudit.css"),
  'site editorial styles must be part of the application entry surface',
);
assert.ok(
  entry.indexOf("./SiteEditorialWorkspaceAudit.css") > entry.indexOf("./SiteEditorialLight.css"),
  'workspace audit corrections must load after the base editorial system',
);
assert.ok(
  internetScale.includes("ctx.fillStyle = '#d9d4cf'") && internetScale.includes("ctx.fillStyle = '#d84f49'"),
  'AS routing must draw on paper with the shared coral active path rather than a dark neon canvas',
);
assert.ok(
  !internetScale.includes("ctx.fillStyle = '#070b10'") && !internetScale.includes("ctx.shadowColor = '#79f2da'"),
  'AS routing must not regress to the old black/glowing canvas treatment',
);

console.log('UI stability contract passed: overview scale motion, editorial product surfaces, and all visual workspace overlays preserve geometry, focus, reduced motion, and Time Rail stability.');