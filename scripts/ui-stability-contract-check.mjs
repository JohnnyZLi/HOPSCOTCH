import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const kinetic = readFileSync(new URL('../src/KineticOverview.tsx', import.meta.url), 'utf8');
const kineticCss = readFileSync(new URL('../src/KineticOverview.css', import.meta.url), 'utf8');
const cornerCss = readFileSync(new URL('../src/CornerNavigator.css', import.meta.url), 'utf8');
const exploreCss = readFileSync(new URL('../src/ExploreLauncher.css', import.meta.url), 'utf8');
const visualWorkspace = readFileSync(new URL('../src/VisualWorkspace.tsx', import.meta.url), 'utf8');
const visualWorkspaceCss = readFileSync(new URL('../src/VisualWorkspace.css', import.meta.url), 'utf8');
const journeySource = readFileSync(new URL('../src/JourneyTheaterV2.tsx', import.meta.url), 'utf8');
const journeyCss = readFileSync(new URL('../src/JourneyTheater.css', import.meta.url), 'utf8');
const failureSource = readFileSync(new URL('../src/FailureStoryWorkspace.tsx', import.meta.url), 'utf8');
const tcpSource = readFileSync(new URL('../src/TcpTheater.tsx', import.meta.url), 'utf8');
const dnsSource = readFileSync(new URL('../src/DnsTheater.tsx', import.meta.url), 'utf8');
const tlsSource = readFileSync(new URL('../src/TlsTheater.tsx', import.meta.url), 'utf8');
const httpSource = readFileSync(new URL('../src/HttpComparisonTheater.tsx', import.meta.url), 'utf8');
const protocolCss = readFileSync(new URL('../src/protocol-workspaces.css', import.meta.url), 'utf8');
const editorialCoreCss = readFileSync(new URL('../src/SiteEditorialCore.css', import.meta.url), 'utf8');
const editorialCss = readFileSync(new URL('../src/SiteEditorialLight.css', import.meta.url), 'utf8');
const editorialAuditCss = readFileSync(new URL('../src/SiteEditorialWorkspaceAudit.css', import.meta.url), 'utf8');
const editorialWorkspaceSystem = readFileSync(new URL('../src/SiteEditorialWorkspaceSystem.css', import.meta.url), 'utf8');
const kineticWorkspaceCss = readFileSync(new URL('../src/KineticWorkspaceShell.css', import.meta.url), 'utf8');
const kineticDeepWorkspaceCss = readFileSync(new URL('../src/KineticDeepWorkspaceShell.css', import.meta.url), 'utf8');
const kineticEvidenceWorkspaceCss = readFileSync(new URL('../src/KineticEvidenceWorkspaceShell.css', import.meta.url), 'utf8');
const mechanismSecondPassCss = readFileSync(new URL('../src/MechanismSecondPass.css', import.meta.url), 'utf8');
const editorialWorkspaceLoader = readFileSync(new URL('../src/SiteEditorialWorkspaceLoader.ts', import.meta.url), 'utf8');
const entry = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8');

assert.doesNotMatch(app, /topbar|scale-inspector|layer-card|home-action-card|timeline-preview/);
assert.match(app, /className="kinetic-overview-shell"/);
assert.match(kinetic, /onUpdate: \(self\) => root\.style\.setProperty\('--journey-progress'/);
assert.match(kinetic, /timelineRef\.current\?\.seek/);
assert.match(kinetic, /onPointerMove=\{handlePointerMove\}/);
assert.match(kinetic, /data-reduced-motion/);
assert.match(kineticCss, /overflow:\s*hidden/);
assert.match(kineticCss, /width:\s*min\(490px, calc\(100vw - 52px\)\)/);
assert.match(kineticCss, /@media \(max-width: 640px\)/);
assert.match(kineticCss, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(cornerCss, /position:\s*fixed/);
assert.match(cornerCss, /width 420ms cubic-bezier/);

assert.match(visualWorkspaceCss, /font-variant-numeric: tabular-nums/);
assert.match(visualWorkspaceCss, /grid-template-rows: minmax\(0, 1fr\) auto/);
assert.ok(visualWorkspaceCss.includes('.visual-drawer {') && visualWorkspaceCss.includes('position: absolute;'));
assert.ok(visualWorkspace.includes("event.key === 'Escape'") && visualWorkspace.includes("event.key !== 'Tab'") && visualWorkspace.includes('previousFocus?.focus()'));
assert.ok(journeySource.includes('className="journey-visual-workspace"') && !journeySource.includes('className="journey-stage-meta"'));
assert.ok(journeyCss.includes('.journey-cinematic-stage .journey-scene-transition') && journeyCss.includes('position: absolute;'));

for (const [name, source] of [['TCP', tcpSource], ['DNS', dnsSource], ['TLS', tlsSource], ['HTTP', httpSource]]) {
  assert.ok(source.includes('protocol-cinematic-stage') && source.includes('protocol-scene-annotation'), `${name} scene contract regressed`);
  const playbackToggle = source.match(/const togglePlayback = \(\) => \{([\s\S]*?)\n  \};/)?.[1] ?? '';
  assert.ok(playbackToggle && !playbackToggle.includes('setActiveDrawer'));
}
for (const [name, source] of [['Journey', journeySource], ['Failure', failureSource], ['TCP', tcpSource], ['DNS', dnsSource], ['TLS', tlsSource], ['HTTP', httpSource]]) {
  assert.ok(!source.includes('TIME MACHINE'), `${name} restored gamified timeline language`);
}
assert.ok(protocolCss.includes('.tls-workspace-stage') && protocolCss.includes('.http-workspace-stage') && protocolCss.includes('@media (max-width: 680px)'));

for (const token of ['--site-paper: #d9d4cf', '--site-ink: #292827', '--site-coral: #d84f49', '--site-instrument: #302e2c', 'html body .app-shell']) {
  assert.ok(editorialCoreCss.includes(token), `Missing editorial core token ${token}`);
}
for (const token of ['html body .builder-stage', 'html body .measured-workspace', 'html body .capture-replay']) assert.ok(editorialCss.includes(token));
for (const token of ['.packet-visual-workspace .packet-stage', '.capture-replay .capture-evidence-inspector.is-frame-stage', '.observed-internet .evidence-card', '.internet-scale .as-winner-readout']) assert.ok(editorialAuditCss.includes(token));
assert.ok(editorialWorkspaceSystem.includes("@import './SiteEditorialLight.css';") && editorialWorkspaceSystem.includes("@import './SiteEditorialWorkspaceAudit.css';"));
assert.ok(editorialWorkspaceSystem.includes("@import './MechanismSecondPass.css';"));
assert.ok(editorialWorkspaceSystem.trimEnd().endsWith("@import './NetworkBuilderMechanismPass.css';"));
for (const token of [
  '.app-shell[data-lab="active"]:has',
  'grid-template-rows: minmax(0, 1fr) !important',
  '.visual-time-rail {',
  'position: absolute !important',
  '.failure-visual-workspace .lab-node-ring',
  '.dns-workspace-map .dns-actor',
  '.tcp-workspace-stage :is(.tcp-endpoint',
  '.tls-workspace-stage :is(.tls-endpoint',
  '.http-workspace-stage .http-lane',
]) assert.ok(kineticWorkspaceCss.includes(token), `Missing cinematic workspace contract ${token}`);
for (const token of [
  '.as-visual-workspace',
  '.physical-visual-workspace',
  '.packet-visual-workspace',
  '.builder-visual-workspace',
  'height: 100dvh !important',
  '.packet-object-wrap',
  '.globe-viewport',
]) assert.ok(kineticDeepWorkspaceCss.includes(token), `Missing deep workspace contract ${token}`);
for (const token of [
  '.capture-replay',
  '.observed-internet.visual-workspace',
  '.measured-workspace',
  'height: 100dvh !important',
  '@keyframes evidence-probe-left',
  '@keyframes measured-fact-pulse',
]) assert.ok(kineticEvidenceWorkspaceCss.includes(token), `Missing evidence workspace contract ${token}`);
for (const token of [
  '.dns-namespace-field',
  '.tcp-stream-ribbon',
  '.tls-protection-shell',
  '.packet-byte-river',
  '.capture-ingest-path',
  '.observed-dormant-field',
  '.measured-dormant-field',
  '@media (prefers-reduced-motion: reduce)',
]) assert.ok(mechanismSecondPassCss.includes(token), `Missing second-pass mechanism contract ${token}`);
for (const token of ['.explore-search', '.explore-scale-map', '@media (prefers-reduced-motion: reduce)']) {
  assert.ok(exploreCss.includes(token), `Missing always-loaded navigation mechanism contract ${token}`);
}
assert.ok(editorialWorkspaceLoader.includes("import('./SiteEditorialWorkspaceSystem.css')"));
assert.ok(entry.includes("./SiteEditorialCore.css") && entry.includes("./SiteEditorialWorkspaceLoader"));
assert.ok(!entry.includes('./ScaleInspectorPolish.css') && !entry.includes('./OverviewLayoutStability.css'));

console.log('UI stability contract passed: full-viewport kinetic overview, compact corner navigation, reduced-motion coverage, and stable overlay-based workspaces.');
