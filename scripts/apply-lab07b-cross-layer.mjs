import fs from 'node:fs';

function replaceOnce(path, search, replacement) {
  const source = fs.readFileSync(path, 'utf8');
  const count = source.split(search).length - 1;
  if (count !== 1) throw new Error(`${path}: expected one match, found ${count}: ${search.slice(0, 110)}`);
  fs.writeFileSync(path, source.replace(search, replacement));
}

const scenario = 'src/journey/scenario.ts';
const browser = 'src/journey/browser.ts';
const app = 'src/App.tsx';
const theater = 'src/JourneyTheaterV2.tsx';
const pkg = 'package.json';

replaceOnce(
  scenario,
  "const impairmentProfiles = new Set<JourneyImpairmentProfile>(['clean', 'single-loss', 'latency-spike']);",
  "const impairmentProfiles = new Set<JourneyImpairmentProfile>(['clean', 'single-loss', 'latency-spike', 'route-failure']);",
);

replaceOnce(
  browser,
  "impairmentProfile: storedImpairment === 'single-loss' || storedImpairment === 'latency-spike' ? storedImpairment : 'clean',",
  "impairmentProfile: storedImpairment === 'single-loss' || storedImpairment === 'latency-spike' || storedImpairment === 'route-failure' ? storedImpairment : 'clean',",
);

replaceOnce(
  app,
  "      dns: 'application', tcp: 'transport', tls: 'application', http: 'application', packet: 'packet',\n      builder: 'routing', internet: 'internet', physical: 'internet', observed: 'internet',",
  "      dns: 'application', tcp: 'transport', tls: 'application', http: 'application', packet: 'packet',\n      builder: 'routing', failure: 'routing', internet: 'internet', physical: 'internet', observed: 'internet',",
);

replaceOnce(
  app,
  "    setLayer(detailLayer[lab]);\n    setActiveLab(lab);",
  "    setLayer(detailLayer[lab]);\n    if (lab === 'failure') {\n      setTimeMs(1900);\n      setActiveLab('failure');\n      return;\n    }\n    setActiveLab(lab);",
);

replaceOnce(
  theater,
  "import type { InternetEvidenceError, InternetEvidenceSnapshot } from './internet/evidence';",
  "import type { InternetEvidenceError, InternetEvidenceSnapshot } from './internet/evidence';\nimport { JourneyLatencyPanel } from './JourneyLatencyPanel';",
);

replaceOnce(
  theater,
  "import './journey-branch.css';",
  "import './journey-branch.css';\nimport './journey-god-mode.css';",
);

replaceOnce(
  theater,
  "function initialImpairmentProfile(): JourneyImpairmentProfile {\n  if (typeof sessionStorage === 'undefined') return 'clean';\n  return sessionStorage.getItem(IMPAIRMENT_PROFILE_KEY) === 'single-loss' ? 'single-loss' : 'clean';\n}",
  "function initialImpairmentProfile(): JourneyImpairmentProfile {\n  if (typeof sessionStorage === 'undefined') return 'clean';\n  const stored = sessionStorage.getItem(IMPAIRMENT_PROFILE_KEY);\n  return stored === 'single-loss' || stored === 'latency-spike' || stored === 'route-failure' ? stored : 'clean';\n}",
);

replaceOnce(
  theater,
  "function provenanceClass(value: string): string {\n  return value.toLowerCase().replaceAll(' ', '-');\n}\n",
  "function provenanceClass(value: string): string {\n  return value.toLowerCase().replaceAll(' ', '-');\n}\n\nfunction isLossEvent(kind: string): boolean {\n  return kind.startsWith('transport.loss') || kind === 'transport.retransmit' || kind === 'transport.recovered';\n}\n\nfunction isLatencyEvent(kind: string): boolean {\n  return kind === 'transport.latency' || kind === 'transport.rtt-update' || kind === 'transport.latency-cleared';\n}\n\nfunction isRouteFailureEvent(kind: string): boolean {\n  return kind === 'route.failure' || kind === 'route.invalidated' || kind === 'route.recompute' || kind === 'route.alternate-installed';\n}\n\nfunction stateToneClass(state: JourneyState): string {\n  if (state.impairmentState === 'lost' || state.impairmentState === 'detected' || state.impairmentState === 'recovering') return 'impairment-active';\n  if (state.impairmentState === 'delayed' || state.impairmentState === 'estimating') return 'latency-active';\n  if (state.impairmentState === 'route-failed') return 'route-failed';\n  if (state.impairmentState === 'route-recomputing') return 'route-recomputing';\n  if (state.impairmentState === 'route-ready') return 'route-ready';\n  return '';\n}\n\nfunction calloutToneClass(state: JourneyState): string {\n  if (state.impairmentState === 'lost' || state.impairmentState === 'detected' || state.impairmentState === 'recovering') return 'impairment-callout';\n  if (state.impairmentState === 'delayed' || state.impairmentState === 'estimating') return 'latency-callout';\n  if (state.impairmentState === 'route-failed') return 'route-failure-callout';\n  if (state.impairmentState === 'route-recomputing') return 'route-recompute-callout';\n  if (state.impairmentState === 'route-ready') return 'route-ready-callout';\n  return '';\n}\n",
);

const oldRouting = `function RoutingScene({ state, address }: { state: JourneyState; address: string }) {\n  const ready = state.route === 'gateway-ready' || state.route === 'internet-path-ready';\n  return <div className="journey-scene routing-scene">\n    <div className="route-topology"><div className="route-node endpoint"><span>HOST</span><strong>CLIENT</strong></div><i className="route-link active"/><div className={\`route-node \${ready ? 'active' : ''}\`}><span>NEXT HOP</span><strong>EDGE</strong></div><i className={\`route-link \${ready ? 'active' : ''}\`}/><div className={\`route-node \${ready ? 'active' : ''}\`}><span>ROUTE</span><strong>CORE</strong></div><i className={\`route-link \${state.route === 'internet-path-ready' ? 'active' : ''}\`}/><div className="route-node endpoint destination"><span>DST</span><strong>{address}</strong></div></div>\n    <div className="route-table"><span>DESTINATION</span><span>NEXT HOP</span><span>STATE</span><strong>{address}/32</strong><strong>{ready ? 'DEFAULT GATEWAY' : 'LOOKUP…'}</strong><strong>{state.route.toUpperCase()}</strong></div>\n  </div>;\n}`;

const newRouting = `function RoutingScene({ state, address }: { state: JourneyState; address: string }) {\n  const ready = state.route === 'gateway-ready' || state.route === 'internet-path-ready';\n  if (state.impairmentProfile !== 'route-failure') {\n    return <div className="journey-scene routing-scene">\n      <div className="route-topology"><div className="route-node endpoint"><span>HOST</span><strong>CLIENT</strong></div><i className="route-link active"/><div className={\`route-node \${ready ? 'active' : ''}\`}><span>NEXT HOP</span><strong>EDGE</strong></div><i className={\`route-link \${ready ? 'active' : ''}\`}/><div className={\`route-node \${ready ? 'active' : ''}\`}><span>ROUTE</span><strong>CORE</strong></div><i className={\`route-link \${state.route === 'internet-path-ready' ? 'active' : ''}\`}/><div className="route-node endpoint destination"><span>DST</span><strong>{address}</strong></div></div>\n      <div className="route-table"><span>DESTINATION</span><span>NEXT HOP</span><span>STATE</span><strong>{address}/32</strong><strong>{ready ? 'DEFAULT GATEWAY' : 'LOOKUP…'}</strong><strong>{state.route.toUpperCase()}</strong></div>\n    </div>;\n  }\n\n  const failed = state.route === 'failed' || state.route === 'recomputing' || state.route === 'alternate-ready' || (state.route === 'internet-path-ready' && state.routeMetrics?.failedLinkId === 'r1-core');\n  const recomputing = state.route === 'recomputing';\n  const alternateActive = state.route === 'alternate-ready' || (state.route === 'internet-path-ready' && state.routeMetrics?.activePath === 'alternate');\n  const primaryActive = !failed && (state.route === 'gateway-ready' || state.route === 'lookup');\n  const activePath = state.routeMetrics?.activePath ?? (primaryActive ? 'primary' : 'primary');\n  return <div className="journey-scene routing-scene route-god-scene">\n    <div className="route-god-topology">\n      <div className="route-god-node"><span>HOST</span><strong>CLIENT</strong></div>\n      <div className="route-god-node"><span>NEXT HOP</span><strong>EDGE</strong></div>\n      <div className="route-branches">\n        <div className={\`route-branch-row primary \${primaryActive ? 'active' : ''} \${failed ? 'failed' : ''}\`}><span>R1 → CORE</span><i/><b>COST 22</b></div>\n        <div className={\`route-branch-row alternate \${recomputing ? 'recomputing' : ''} \${alternateActive ? 'active' : ''}\`}><span>R2 → CORE</span><i/><b>COST 52</b></div>\n      </div>\n      <div className="route-god-node destination"><span>DST</span><strong>{address}</strong></div>\n    </div>\n    <div className="route-god-metrics">\n      <div><span>PRIMARY</span><strong>22</strong></div>\n      <div><span>ALTERNATE</span><strong>52</strong></div>\n      <div className={failed && !alternateActive ? (recomputing ? 'warning' : 'danger') : alternateActive ? 'success' : ''}><span>ACTIVE PATH</span><strong>{activePath.toUpperCase()}</strong></div>\n      <div className={failed ? 'danger' : ''}><span>FAILED LINK</span><strong>{failed ? 'R1 → CORE' : 'NONE'}</strong></div>\n    </div>\n  </div>;\n}`;
replaceOnce(theater, oldRouting, newRouting);

replaceOnce(
  theater,
  "    {detectingLoss ? <div className=\"loss-transport-panel\">",
  "    {state.impairmentProfile === 'latency-spike' && (state.activeEvent.kind === 'transport.latency' || state.activeEvent.kind === 'transport.rtt-update') && <JourneyLatencyPanel state={state}/>}\n    {detectingLoss ? <div className=\"loss-transport-panel\">",
);

replaceOnce(
  theater,
  "  const impairmentLabel = impairmentProfile === 'single-loss' ? 'LOSS' : 'CLEAN';",
  "  const impairmentLabel = impairmentProfile === 'single-loss' ? 'LOSS' : impairmentProfile === 'latency-spike' ? 'LATENCY' : impairmentProfile === 'route-failure' ? 'ROUTE' : 'CLEAN';",
);

replaceOnce(
  theater,
  "  const transportStateLabel = state.impairmentProfile === 'single-loss' && state.impairmentState !== 'armed' && state.impairmentState !== 'recovered' ? `${state.transport.toUpperCase()} · ${state.impairmentState.toUpperCase()}` : state.transport.toUpperCase();",
  "  const transportStateLabel = state.impairmentProfile === 'single-loss' && state.impairmentState !== 'armed' && state.impairmentState !== 'recovered' ? `${state.transport.toUpperCase()} · ${state.impairmentState.toUpperCase()}` : state.transport.toUpperCase();\n  const toneClass = stateToneClass(state);\n  const calloutClass = calloutToneClass(state);",
);

replaceOnce(
  theater,
  "<header className=\"journey-heading\"><div><p className=\"eyebrow\">Lab 06D · URL Journey</p><h1>ONE REQUEST.<br/><span>BREAK THE TRANSFER.</span></h1></div>",
  "<header className=\"journey-heading\"><div><p className=\"eyebrow\">Lab 07 · GOD MODE Journey</p><h1>ONE REQUEST.<br/><span>BREAK THE PATH.</span></h1></div>",
);

replaceOnce(
  theater,
  "<div className=\"journey-profile journey-impairment-profile\" role=\"group\" aria-label=\"Journey impairment profile\"><button type=\"button\" className={impairmentProfile==='clean'?'active':''} onClick={()=>chooseImpairmentProfile('clean')}>CLEAN</button><button type=\"button\" className={impairmentProfile==='single-loss'?'active':''} onClick={()=>chooseImpairmentProfile('single-loss')}>INJECT LOSS</button></div>",
  "<div className=\"journey-profile journey-impairment-profile\" role=\"group\" aria-label=\"Journey impairment profile\"><button type=\"button\" className={impairmentProfile==='clean'?'active':''} onClick={()=>chooseImpairmentProfile('clean')}>CLEAN</button><button type=\"button\" className={impairmentProfile==='single-loss'?'active':''} onClick={()=>chooseImpairmentProfile('single-loss')}>LOSS</button><button type=\"button\" className={impairmentProfile==='latency-spike'?'active':''} onClick={()=>chooseImpairmentProfile('latency-spike')}>LATENCY</button><button type=\"button\" className={impairmentProfile==='route-failure'?'active':''} onClick={()=>chooseImpairmentProfile('route-failure')}>ROUTE</button></div>",
);

replaceOnce(
  theater,
  "'Loss, DNS, and transport choices are simulated configuration. Live/public evidence never rewrites them.'",
  "'GOD MODE, DNS, and transport choices are simulated configuration. Live/public evidence never rewrites them.'",
);

replaceOnce(
  theater,
  "<div><span>IMPAIRMENT</span><strong className={state.impairmentState==='lost'||state.impairmentState==='detected'||state.impairmentState==='recovering'?'impairment-active':''}>{state.impairmentState.toUpperCase()}</strong></div>",
  "<div><span>IMPAIRMENT</span><strong className={toneClass}>{state.impairmentState.toUpperCase()}</strong></div>",
);

replaceOnce(
  theater,
  "className={`journey-callout ${state.impairmentState==='lost'||state.impairmentState==='detected'||state.impairmentState==='recovering'?'impairment-callout':''}`}",
  "className={`journey-callout ${calloutClass}`}",
);

replaceOnce(
  theater,
  "<div><span>ROUTE</span><strong>{state.route.toUpperCase()}</strong></div><div><span>{profile==='quic-h3'?'QUIC':'TCP'}</span><strong className={state.impairmentState==='lost'||state.impairmentState==='detected'||state.impairmentState==='recovering'?'impairment-active':''}>{transportStateLabel}</strong></div>",
  "<div><span>ROUTE</span><strong className={state.impairmentProfile==='route-failure'?toneClass:''}>{state.route.toUpperCase()}</strong></div><div><span>{profile==='quic-h3'?'QUIC':'TCP'}</span><strong className={state.impairmentProfile==='single-loss'||state.impairmentProfile==='latency-spike'?toneClass:''}>{transportStateLabel}</strong></div>",
);

replaceOnce(
  theater,
  "const impairment=current.kind.startsWith('transport.loss')||current.kind==='transport.retransmit'||current.kind==='transport.recovered';return <button type=\"button\" key={current.id} className={`journey-event ${complete?'complete':''} ${active?'current':''} ${impairment?'impairment-event':''}`}",
  "const lossEvent=isLossEvent(current.kind);const latencyEvent=isLatencyEvent(current.kind);const routeEvent=isRouteFailureEvent(current.kind);return <button type=\"button\" key={current.id} className={`journey-event ${complete?'complete':''} ${active?'current':''} ${lossEvent?'impairment-event':''} ${latencyEvent?'latency-event':''} ${routeEvent?'route-event':''}`}",
);

replaceOnce(
  theater,
  "${current.atMs<=timeMs?'passed':''} ${current.kind.startsWith('transport.loss')||current.kind==='transport.retransmit'?'impairment-marker':''}",
  "${current.atMs<=timeMs?'passed':''} ${isLossEvent(current.kind)&&current.kind!=='transport.recovered'?'impairment-marker':''} ${isLatencyEvent(current.kind)?'latency-marker':''} ${isRouteFailureEvent(current.kind)?'route-marker':''}",
);

const packageJson = JSON.parse(fs.readFileSync(pkg, 'utf8'));
if (packageJson.scripts['test:journey-god-mode-contract']) throw new Error('package.json already contains GOD MODE contract script.');
packageJson.scripts['test:journey-god-mode-contract'] = 'node scripts/journey-god-mode-contract-check.mjs';
packageJson.scripts.check = packageJson.scripts.check.replace(' && npm run build', ' && npm run test:journey-god-mode-contract && npm run build');
fs.writeFileSync(pkg, `${JSON.stringify(packageJson, null, 2)}\n`);

console.log('Applied Lab 07B cross-layer codemod.');
