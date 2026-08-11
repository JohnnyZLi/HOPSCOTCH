from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise SystemExit(f'missing patch anchor in {path}: {old[:120]!r}')
    file.write_text(text.replace(old, new, 1))


def append_once(path: str, marker: str, content: str) -> None:
    file = Path(path)
    text = file.read_text()
    if marker in text:
        raise SystemExit(f'patch marker already present in {path}: {marker}')
    file.write_text(text + content)


# Model: explicit interdomain policy state and metrics.
replace_once(
    'src/journey/model.ts',
    "export type JourneyModifierId = 'dns-failure' | 'route-failure' | 'server-failure' | 'single-loss' | 'path-outage' | 'latency-spike' | 'congestion' | 'partition';",
    "export type JourneyModifierId = 'dns-failure' | 'route-failure' | 'route-leak' | 'server-failure' | 'single-loss' | 'path-outage' | 'latency-spike' | 'congestion' | 'partition';",
)
replace_once(
    'src/journey/model.ts',
    "  | 'internet.policy-path'\n  | 'internet.physical-context'",
    "  | 'internet.policy-path'\n  | 'internet.route-leak-advertised'\n  | 'internet.route-leak-selected'\n  | 'internet.policy-anomaly'\n  | 'internet.route-leak-withdrawn'\n  | 'internet.policy-restored'\n  | 'internet.physical-context'",
)
replace_once(
    'src/journey/model.ts',
    "export interface JourneyRouteMetrics {",
    "export interface JourneyPolicyMetrics {\n  legitimatePathAsns: number[];\n  leakedPathAsns: number[];\n  activePathAsns: number[];\n  legitimateTraversal: Array<'up' | 'peer' | 'down'>;\n  leakedTraversal: Array<'up' | 'peer' | 'down'>;\n  legitimateLocalPreference: number;\n  leakedLocalPreference: number;\n  activeLocalPreference: number;\n  leakSourceAsn: number;\n  decisionAsn: number;\n  destinationAsn: number;\n  learnedFrom: 'peer';\n  exportedTo: 'provider';\n  selectedPathPolicyCompliant: boolean;\n  exportPolicyCompliant: boolean;\n  reachable: boolean;\n}\n\nexport interface JourneyRouteMetrics {",
)
replace_once(
    'src/journey/model.ts',
    "  serverMetrics?: JourneyServerMetrics;\n  routeMetrics?: JourneyRouteMetrics;",
    "  serverMetrics?: JourneyServerMetrics;\n  policyMetrics?: JourneyPolicyMetrics;\n  routeMetrics?: JourneyRouteMetrics;",
)
replace_once(
    'src/journey/model.ts',
    "export type ServerJourneyState = 'healthy' | 'unavailable' | 'waiting' | 'ready';\nexport type PacketJourneyState",
    "export type ServerJourneyState = 'healthy' | 'unavailable' | 'waiting' | 'ready';\nexport type PolicyJourneyState = 'normal' | 'leak-advertised' | 'leaked' | 'anomaly' | 'restored';\nexport type PacketJourneyState",
)
replace_once(
    'src/journey/model.ts',
    " | 'route-ready' | 'partitioned'",
    " | 'route-ready' | 'policy-leak' | 'policy-anomaly' | 'policy-restored' | 'partitioned'",
)
replace_once(
    'src/journey/model.ts',
    "  serverMetrics: JourneyServerMetrics | null;\n  routeMetrics: JourneyRouteMetrics | null;",
    "  serverMetrics: JourneyServerMetrics | null;\n  policyMetrics: JourneyPolicyMetrics | null;\n  routeMetrics: JourneyRouteMetrics | null;",
)
replace_once(
    'src/journey/model.ts',
    "  server: ServerJourneyState;\n  packet: PacketJourneyState;",
    "  server: ServerJourneyState;\n  policy: PolicyJourneyState;\n  packet: PacketJourneyState;",
)
replace_once(
    'src/journey/model.ts',
    "  let server: ServerJourneyState = 'healthy';\n  let packet: PacketJourneyState = 'idle';",
    "  let server: ServerJourneyState = 'healthy';\n  let policy: PolicyJourneyState = 'normal';\n  let packet: PacketJourneyState = 'idle';",
)
replace_once(
    'src/journey/model.ts',
    "  let serverMetrics: JourneyServerMetrics | null = null;\n  let routeMetrics: JourneyRouteMetrics | null = null;",
    "  let serverMetrics: JourneyServerMetrics | null = null;\n  let policyMetrics: JourneyPolicyMetrics | null = null;\n  let routeMetrics: JourneyRouteMetrics | null = null;",
)
replace_once(
    'src/journey/model.ts',
    "      case 'internet.policy-path': route = 'internet-path-ready'; break;\n      case 'transport.segment':",
    "      case 'internet.policy-path': route = 'internet-path-ready'; policy = 'normal'; break;\n      case 'internet.route-leak-advertised':\n        policy = 'leak-advertised';\n        impairmentState = 'policy-leak';\n        policyMetrics = current.policyMetrics ?? policyMetrics;\n        break;\n      case 'internet.route-leak-selected':\n        policy = 'leaked';\n        impairmentState = 'policy-leak';\n        policyMetrics = current.policyMetrics ?? policyMetrics;\n        break;\n      case 'internet.policy-anomaly':\n        policy = 'anomaly';\n        impairmentState = 'policy-anomaly';\n        policyMetrics = current.policyMetrics ?? policyMetrics;\n        break;\n      case 'internet.route-leak-withdrawn':\n        policy = 'anomaly';\n        impairmentState = 'policy-anomaly';\n        policyMetrics = current.policyMetrics ?? policyMetrics;\n        break;\n      case 'internet.policy-restored':\n        policy = 'restored';\n        impairmentState = 'policy-restored';\n        policyMetrics = current.policyMetrics ?? policyMetrics;\n        break;\n      case 'internet.physical-context':\n        if (impairmentState === 'policy-restored') impairmentState = 'normalized';\n        break;\n      case 'transport.segment':",
)
replace_once(
    'src/journey/model.ts',
    "    serverMetrics,\n    routeMetrics,",
    "    serverMetrics,\n    policyMetrics,\n    routeMetrics,",
)
replace_once(
    'src/journey/model.ts',
    "    server,\n    packet,",
    "    server,\n    policy,\n    packet,",
)

# Modifier: reuse the existing Lab 05 AS graph and policy enumerator.
replace_once(
    'src/journey/modifiers.ts',
    "  JourneyProvenance,\n  JourneyRouteMetrics,",
    "  JourneyProvenance,\n  JourneyPolicyMetrics,\n  JourneyRouteMetrics,",
)
replace_once(
    'src/journey/modifiers.ts',
    "} from './model.ts';\n",
    "} from './model.ts';\nimport { enumeratePolicyPaths, simulatedAsGraph, traversalFor } from '../internet/asModel.ts';\n",
)
replace_once(
    'src/journey/modifiers.ts',
    "const JOURNEY_MODIFIER_ORDER: readonly JourneyModifierId[] = ['dns-failure', 'route-failure', 'server-failure', 'single-loss', 'path-outage', 'latency-spike', 'congestion', 'partition'];",
    "const JOURNEY_MODIFIER_ORDER: readonly JourneyModifierId[] = ['dns-failure', 'route-failure', 'route-leak', 'server-failure', 'single-loss', 'path-outage', 'latency-spike', 'congestion', 'partition'];",
)
replace_once(
    'src/journey/modifiers.ts',
    "  serverMetrics?: JourneyServerMetrics;\n  routeMetrics?: JourneyRouteMetrics;",
    "  serverMetrics?: JourneyServerMetrics;\n  policyMetrics?: JourneyPolicyMetrics;\n  routeMetrics?: JourneyRouteMetrics;",
)

route_leak_code = r'''
function routeLeakTraversal(asns: number[]): Array<'up' | 'peer' | 'down'> {
  const traversals: Array<'up' | 'peer' | 'down'> = [];
  for (let index = 0; index < asns.length - 1; index += 1) {
    const from = asns[index];
    const to = asns[index + 1];
    const relationship = simulatedAsGraph.relationships.find((candidate) => traversalFor(candidate, from, to) !== null);
    if (!relationship) throw new Error(`route-leak teaching path is missing AS${from} → AS${to} from the Lab 05 graph.`);
    const traversal = traversalFor(relationship, from, to);
    if (!traversal) throw new Error(`route-leak cannot derive traversal AS${from} → AS${to}.`);
    traversals.push(traversal);
  }
  return traversals;
}

function routeLeakMetricStates() {
  const legitimatePathAsns = [64504, 65540, 65538];
  const leakedPathAsns = [64504, 64500, 65538];
  const legitimate = enumeratePolicyPaths(simulatedAsGraph, 64504, 65538)
    .find((candidate) => candidate.asns.join(',') === legitimatePathAsns.join(','));
  if (!legitimate) throw new Error('route-leak requires the existing policy-compliant AS64504 → AS65540 → AS65538 candidate.');
  const legitimateTraversal = routeLeakTraversal(legitimatePathAsns);
  const leakedTraversal = routeLeakTraversal(leakedPathAsns);
  if (legitimateTraversal.join(',') !== 'peer,down') throw new Error('route-leak legitimate path no longer matches the Lab 05 peer → down teaching policy.');
  if (leakedTraversal.join(',') !== 'down,peer') throw new Error('route-leak leaked path must expose the down → peer valley violation.');
  if (enumeratePolicyPaths(simulatedAsGraph, 64504, 65538).some((candidate) => candidate.asns.join(',') === leakedPathAsns.join(','))) {
    throw new Error('route-leak leaked path unexpectedly passed the normal valley-free enumerator.');
  }
  const common = {
    legitimatePathAsns,
    leakedPathAsns,
    legitimateTraversal,
    leakedTraversal,
    legitimateLocalPreference: legitimate.localPreference,
    leakedLocalPreference: 300,
    leakSourceAsn: 64500,
    decisionAsn: 64504,
    destinationAsn: 65538,
    learnedFrom: 'peer' as const,
    exportedTo: 'provider' as const,
    reachable: true,
  };
  const normal: JourneyPolicyMetrics = {
    ...common,
    activePathAsns: legitimatePathAsns,
    activeLocalPreference: legitimate.localPreference,
    selectedPathPolicyCompliant: true,
    exportPolicyCompliant: true,
  };
  const advertised: JourneyPolicyMetrics = {
    ...normal,
    exportPolicyCompliant: false,
  };
  const leaked: JourneyPolicyMetrics = {
    ...common,
    activePathAsns: leakedPathAsns,
    activeLocalPreference: 300,
    selectedPathPolicyCompliant: false,
    exportPolicyCompliant: false,
  };
  return { normal, advertised, leaked, restored: normal };
}

function routeLeakEvents(asPathAtMs: number): JourneyEvent[] {
  const metrics = routeLeakMetricStates();
  return [
    modifierEvent({
      id: 'route-leak-advertised',
      atMs: asPathAtMs + 180,
      kind: 'internet.route-leak-advertised',
      scale: 'internet',
      zoom: 'hold',
      protocol: 'BGP policy model',
      phase: 'route-leak-advertised',
      title: 'AS64500 leaks a peer-learned route to its provider',
      summary: 'A route learned from peer AS65538 is incorrectly exported upward to provider AS64504.',
      detail: 'The export itself violates the curated valley-free teaching policy. Forwarding has not failed: the legitimate AS64504 → AS65540 → AS65538 path is still selected at this instant.',
      actor: 'AS64500',
      target: 'AS64504',
      detailLab: 'internet',
      policyMetrics: metrics.advertised,
    }),
    modifierEvent({
      id: 'route-leak-selected',
      atMs: asPathAtMs + 460,
      kind: 'internet.route-leak-selected',
      scale: 'internet',
      zoom: 'hold',
      protocol: 'BGP policy model',
      phase: 'route-leak-selected',
      title: 'AS64504 selects the leaked customer advertisement',
      summary: 'The deterministic teaching LOCAL_PREF changes from peer-learned 200 to customer-learned 300.',
      detail: 'AS64504 now forwards through AS64500 → AS65538. This is a curated policy demonstration, not a claim that every network implements identical BGP preference rules.',
      actor: 'AS64504 decision process',
      target: 'AS64500',
      detailLab: 'internet',
      policyMetrics: metrics.leaked,
    }),
    modifierEvent({
      id: 'route-leak-anomaly',
      atMs: asPathAtMs + 760,
      kind: 'internet.policy-anomaly',
      scale: 'internet',
      zoom: 'hold',
      protocol: 'BGP policy model',
      phase: 'policy-anomaly',
      title: 'Reachable path violates the valley-free export policy',
      summary: 'The selected path is AS64504 → AS64500 → AS65538: physically connected, but its down → peer relationship sequence is policy-invalid.',
      detail: 'This is the core lesson: reachability and policy correctness are separate dimensions. HOPSCOTCH keeps REACHABLE = YES while POLICY COMPLIANT = NO.',
      actor: 'policy monitor',
      target: 'selected AS path',
      detailLab: 'internet',
      policyMetrics: metrics.leaked,
    }),
    modifierEvent({
      id: 'route-leak-withdrawn',
      atMs: asPathAtMs + 1080,
      kind: 'internet.route-leak-withdrawn',
      scale: 'internet',
      zoom: 'hold',
      protocol: 'BGP policy model',
      phase: 'route-leak-withdrawn',
      title: 'The leaked advertisement is filtered and withdrawn',
      summary: 'AS64504 stops accepting the bad customer advertisement after the policy anomaly is contained.',
      detail: 'Containment removes the policy-invalid route; it does not require a local OSPF failure, packet retransmission, or transport reset.',
      actor: 'AS64504 policy filter',
      target: 'AS64500 advertisement',
      detailLab: 'internet',
      policyMetrics: metrics.leaked,
    }),
    modifierEvent({
      id: 'route-leak-restored',
      atMs: asPathAtMs + 1320,
      kind: 'internet.policy-restored',
      scale: 'internet',
      zoom: 'hold',
      protocol: 'BGP policy model',
      phase: 'policy-restored',
      title: 'Policy-compliant peer path is selected again',
      summary: 'AS64504 returns to AS64504 → AS65540 → AS65538 with teaching LOCAL_PREF 200.',
      detail: 'Reachability existed throughout the episode. What changed was which advertisement was considered policy-acceptable and therefore selected.',
      actor: 'AS64504 decision process',
      target: 'AS65540 peer route',
      detailLab: 'internet',
      policyMetrics: metrics.restored,
    }),
  ];
}

const routeLeakModifier: JourneyModifier = {
  id: 'route-leak',
  order: 92,
  apply(events) {
    const { asPath, transportStart } = requireRouteAnchors(events, 'route-leak');
    const physical = events.find((current) => current.id === 'physical-context');
    if (!physical || asPath.atMs >= physical.atMs || physical.atMs >= transportStart.atMs) {
      throw new Error('route-leak requires AS path < physical context < transport start.');
    }
    const addedDurationMs = 1600;
    const shifted = shiftPostAnchor(events, physical.atMs, addedDurationMs);
    const injected = routeLeakEvents(asPath.atMs);
    const nextEvents = [...shifted, ...injected].sort((a, b) => a.atMs - b.atMs);
    const restored = nextEvents.find((current) => current.kind === 'internet.policy-restored');
    const firstTransport = nextEvents.find((current) => current.kind === 'transport.segment');
    if (!restored || !firstTransport || restored.atMs >= firstTransport.atMs) throw new Error('route-leak must restore policy before transport begins.');
    if (firstTransport.atMs !== transportStart.atMs + addedDurationMs) throw new Error('route-leak shifted transport by an unexpected amount.');
    return { events: nextEvents, addedDurationMs, appliedModifierIds: ['route-leak'] };
  },
};

'''
replace_once(
    'src/journey/modifiers.ts',
    "const serverFailureModifier: JourneyModifier = {",
    route_leak_code + "const serverFailureModifier: JourneyModifier = {",
)
replace_once(
    'src/journey/modifiers.ts',
    "const modifiers: JourneyModifier[] = [dnsFailureModifier, routeFailureModifier, serverFailureModifier, singleLossModifier, pathOutageModifier, latencySpikeModifier, congestionModifier, partitionModifier]",
    "const modifiers: JourneyModifier[] = [dnsFailureModifier, routeFailureModifier, routeLeakModifier, serverFailureModifier, singleLossModifier, pathOutageModifier, latencySpikeModifier, congestionModifier, partitionModifier]",
)

# Portable v1 + browser migration accept a single route-leak modifier.
replace_once(
    'src/journey/scenario.ts',
    "['clean', 'dns-failure', 'server-failure', 'single-loss', 'latency-spike', 'route-failure', 'path-outage', 'congestion', 'partition']",
    "['clean', 'dns-failure', 'route-leak', 'server-failure', 'single-loss', 'latency-spike', 'route-failure', 'path-outage', 'congestion', 'partition']",
)
replace_once(
    'src/journey/browser.ts',
    "storedImpairment === 'dns-failure' || storedImpairment === 'server-failure'",
    "storedImpairment === 'dns-failure' || storedImpairment === 'route-leak' || storedImpairment === 'server-failure'",
)

# Journey renderer: policy-specific scene, control, state tone, rail, and scrubber semantics.
replace_once(
    'src/JourneyTheaterV2.tsx',
    "import { JourneyLatencyPanel } from './JourneyLatencyPanel';",
    "import { JourneyLatencyPanel } from './JourneyLatencyPanel';\nimport { JourneyPolicyLeakPanel } from './JourneyPolicyLeakPanel';",
)
replace_once(
    'src/JourneyTheaterV2.tsx',
    "function isPartitionEvent(kind: string): boolean {",
    "function isPolicyLeakEvent(kind: string): boolean {\n  return kind === 'internet.route-leak-advertised' || kind === 'internet.route-leak-selected' || kind === 'internet.policy-anomaly' || kind === 'internet.route-leak-withdrawn' || kind === 'internet.policy-restored';\n}\n\nfunction isPartitionEvent(kind: string): boolean {",
)
replace_once(
    'src/JourneyTheaterV2.tsx',
    "id === 'route-failure' ? 'ROUTE' : id === 'server-failure' ? 'SERVER'",
    "id === 'route-failure' ? 'ROUTE' : id === 'route-leak' ? 'LEAK' : id === 'server-failure' ? 'SERVER'",
)
replace_once(
    'src/JourneyTheaterV2.tsx',
    "  if (state.impairmentState === 'server-ready') return 'server-ready-active';\n  if (state.impairmentState === 'partitioned'",
    "  if (state.impairmentState === 'server-ready') return 'server-ready-active';\n  if (state.impairmentState === 'policy-leak' || state.impairmentState === 'policy-anomaly') return 'policy-leak-active';\n  if (state.impairmentState === 'policy-restored') return 'policy-restored-active';\n  if (state.impairmentState === 'partitioned'",
)
replace_once(
    'src/JourneyTheaterV2.tsx',
    "  if (state.impairmentState === 'server-ready') return 'server-ready-callout';\n  if (state.impairmentState === 'partitioned'",
    "  if (state.impairmentState === 'server-ready') return 'server-ready-callout';\n  if (state.impairmentState === 'policy-leak' || state.impairmentState === 'policy-anomaly') return 'policy-leak-callout';\n  if (state.impairmentState === 'policy-restored') return 'policy-restored-callout';\n  if (state.impairmentState === 'partitioned'",
)
replace_once(
    'src/JourneyTheaterV2.tsx',
    "function InternetScene({ state }: { state: JourneyState }) {\n  return <div className=\"journey-scene internet-scene\">",
    "function InternetScene({ state }: { state: JourneyState }) {\n  if (isPolicyLeakEvent(state.activeEvent.kind)) return <JourneyPolicyLeakPanel state={state}/>;\n  return <div className=\"journey-scene internet-scene\">",
)
replace_once(
    'src/JourneyTheaterV2.tsx',
    "  const serverFailureSelected = selectedModifiers.includes('server-failure');\n  const partitionSelected",
    "  const serverFailureSelected = selectedModifiers.includes('server-failure');\n  const routeLeakSelected = selectedModifiers.includes('route-leak');\n  const partitionSelected",
)
replace_once(
    'src/JourneyTheaterV2.tsx',
    "<button type=\"button\" className={partitionSelected?'active':''} aria-pressed={partitionSelected} onClick={()=>toggleModifier('partition')}>PARTITION</button></div>",
    "<button type=\"button\" className={partitionSelected?'active':''} aria-pressed={partitionSelected} onClick={()=>toggleModifier('partition')}>PARTITION</button><button type=\"button\" className={routeLeakSelected?'active':''} aria-pressed={routeLeakSelected} onClick={()=>toggleModifier('route-leak')}>LEAK</button></div>",
)
replace_once(
    'src/JourneyTheaterV2.tsx',
    "const partitionEvent=isPartitionEvent(current.kind);return <button",
    "const partitionEvent=isPartitionEvent(current.kind);const policyLeakEvent=isPolicyLeakEvent(current.kind);return <button",
)
replace_once(
    'src/JourneyTheaterV2.tsx',
    "${partitionEvent?'partition-event':''}`} onClick",
    "${partitionEvent?'partition-event':''} ${policyLeakEvent?'policy-leak-event':''}`} onClick",
)
replace_once(
    'src/JourneyTheaterV2.tsx',
    "${isPartitionEvent(current.kind)?'partition-marker':''}`} style=",
    "${isPartitionEvent(current.kind)?'partition-marker':''} ${isPolicyLeakEvent(current.kind)?'policy-leak-marker':''}`} style=",
)

panel = r'''import type { JourneyState } from './journey/model';

function pathLabel(asns: readonly number[]): string {
  return asns.map((asn) => `AS${asn}`).join(' → ');
}

export function JourneyPolicyLeakPanel({ state }: { state: JourneyState }) {
  const metrics = state.policyMetrics;
  if (!metrics) return <div className="journey-scene policy-leak-scene"><p>Interdomain policy state unavailable.</p></div>;
  const leakedSelected = !metrics.selectedPathPolicyCompliant;
  const exportBad = !metrics.exportPolicyCompliant;
  return <div className="journey-scene policy-leak-scene">
    <div className="policy-leak-paths">
      <div className={!leakedSelected ? 'active' : ''}><span>LEGITIMATE PATH</span><strong>{pathLabel(metrics.legitimatePathAsns)}</strong><small>{metrics.legitimateTraversal.join(' → ').toUpperCase()} · LOCAL_PREF {metrics.legitimateLocalPreference}</small></div>
      <div className={leakedSelected ? 'active leaked' : 'leaked'}><span>LEAKED PATH</span><strong>{pathLabel(metrics.leakedPathAsns)}</strong><small>{metrics.leakedTraversal.join(' → ').toUpperCase()} · LOCAL_PREF {metrics.leakedLocalPreference}</small></div>
    </div>
    <div className={`policy-leak-export ${exportBad ? 'bad' : 'restored'}`}><span>{exportBad ? 'BAD EXPORT' : 'EXPORT POLICY'}</span><strong>{exportBad ? 'AS64500 · PEER-LEARNED → PROVIDER AS64504' : 'LEAK WITHDRAWN · NORMAL EXPORT POLICY'}</strong></div>
    <div className="policy-leak-metrics">
      <div><span>ACTIVE LOCAL_PREF</span><strong>{metrics.activeLocalPreference}</strong></div>
      <div><span>REACHABLE</span><strong className="reachable">{metrics.reachable ? 'YES' : 'NO'}</strong></div>
      <div><span>POLICY COMPLIANT</span><strong className={metrics.selectedPathPolicyCompliant && metrics.exportPolicyCompliant ? 'reachable' : 'violated'}>{metrics.selectedPathPolicyCompliant && metrics.exportPolicyCompliant ? 'YES' : 'NO'}</strong></div>
      <div><span>POLICY STATE</span><strong>{state.policy.toUpperCase().replace('-', ' ')}</strong></div>
    </div>
    <p>{state.policy === 'anomaly' ? 'The route still forwards traffic. The failure is policy correctness, not reachability.' : state.policy === 'restored' ? 'The leaked advertisement is gone and the legitimate peer-learned path is selected again.' : 'A peer-learned route is being exported where the teaching valley-free policy says it should not be.'}</p>
  </div>;
}
'''
Path('src/JourneyPolicyLeakPanel.tsx').write_text(panel)

append_once(
    'src/journey-god-mode.css',
    '.journey-modifier-profile button:nth-child(10)',
    r'''

.journey-modifier-profile button:nth-child(10)[aria-pressed="true"]{background:rgba(184,243,107,.09);color:#cff99c;box-shadow:inset 0 0 0 1px rgba(184,243,107,.3)}
.policy-leak-scene{gap:12px}.policy-leak-paths{display:grid;grid-template-columns:1fr 1fr;gap:8px}.policy-leak-paths>div{display:grid;gap:6px;padding:13px;border:1px solid rgba(255,255,255,.065);border-radius:5px;background:rgba(4,8,11,.54);opacity:.48}.policy-leak-paths>div.active{opacity:1;border-color:rgba(121,242,218,.22)}.policy-leak-paths>div.leaked.active{border-color:rgba(184,243,107,.34);background:rgba(184,243,107,.025)}.policy-leak-paths span,.policy-leak-metrics span,.policy-leak-export span{color:#718071;font-size:.42rem;font-weight:950;letter-spacing:.085em}.policy-leak-paths strong{color:#c8d4ca;font:700 .56rem ui-monospace,SFMono-Regular,Menlo,monospace}.policy-leak-paths .leaked.active strong{color:#d7f5b0}.policy-leak-paths small{color:#66746a;font:650 .44rem ui-monospace,SFMono-Regular,Menlo,monospace}.policy-leak-export{display:grid;grid-template-columns:auto 1fr;align-items:center;gap:12px;padding:10px 12px;border:1px solid rgba(184,243,107,.2);border-radius:4px;background:rgba(184,243,107,.02)}.policy-leak-export.bad{border-color:rgba(255,159,110,.28);background:rgba(255,159,110,.025)}.policy-leak-export.bad span{color:#ffae84}.policy-leak-export strong{color:#cbe2ad;font:700 .5rem ui-monospace,SFMono-Regular,Menlo,monospace;text-align:right}.policy-leak-export.bad strong{color:#ffd0b7}.policy-leak-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:7px}.policy-leak-metrics>div{display:grid;gap:4px;padding:9px 10px;border:1px solid rgba(184,243,107,.1);border-radius:4px;background:rgba(4,8,11,.48)}.policy-leak-metrics strong{color:#c6d3c7;font:700 .52rem ui-monospace,SFMono-Regular,Menlo,monospace}.policy-leak-metrics strong.reachable{color:#79f2da}.policy-leak-metrics strong.violated{color:#ffae84}.policy-leak-scene>p{margin:0;color:#6f7d73;font-size:.54rem;line-height:1.45;text-align:center}.journey-stage-meta strong.policy-leak-active,.journey-state-strip strong.policy-leak-active{color:#c8f58e}.journey-stage-meta strong.policy-restored-active,.journey-state-strip strong.policy-restored-active{color:#79f2da}.journey-callout.policy-leak-callout{border-color:rgba(184,243,107,.25);box-shadow:inset 3px 0 0 rgba(184,243,107,.66)}.journey-callout.policy-restored-callout{border-color:rgba(121,242,218,.22);box-shadow:inset 3px 0 0 rgba(121,242,218,.58)}.journey-event.policy-leak-event{border-color:rgba(184,243,107,.065)}.journey-event.policy-leak-event.current{border-color:rgba(184,243,107,.34);background:rgba(184,243,107,.035)}.journey-scrubber i.policy-leak-marker{height:13px!important;top:-3px!important;background:#b8f36b!important;box-shadow:0 0 8px rgba(184,243,107,.42)}
@media(max-width:700px){.policy-leak-paths{grid-template-columns:1fr}.policy-leak-metrics{grid-template-columns:1fr 1fr}.policy-leak-export{grid-template-columns:1fr}.policy-leak-export strong{text-align:left}}
@media(max-width:520px){.journey-modifier-profile{grid-template-columns:repeat(4,minmax(0,1fr))}.journey-modifier-profile button:nth-child(9),.journey-modifier-profile button:nth-child(10){grid-column:span 2}}
''',
)
