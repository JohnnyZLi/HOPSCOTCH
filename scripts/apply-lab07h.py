from pathlib import Path


def replace_once(path, old, new):
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise SystemExit(f'missing patch anchor in {path}: {old[:150]!r}')
    file.write_text(text.replace(old, new, 1))


def append_once(path, marker, addition):
    file = Path(path)
    text = file.read_text()
    if marker in text:
        return
    file.write_text(text + addition)


# Model: terminal route/transport/application failure state.
replace_once(
    'src/journey/model.ts',
    "export type JourneyModifierId = 'dns-failure' | 'route-failure' | 'server-failure' | 'single-loss' | 'path-outage' | 'latency-spike' | 'congestion';",
    "export type JourneyModifierId = 'dns-failure' | 'route-failure' | 'server-failure' | 'single-loss' | 'path-outage' | 'latency-spike' | 'congestion' | 'partition';",
)
replace_once(
    'src/journey/model.ts',
    "  | 'route.alternate-installed'\n  | 'internet.policy-path'",
    "  | 'route.alternate-installed'\n  | 'route.partition'\n  | 'route.partition-recompute'\n  | 'route.unreachable'\n  | 'internet.policy-path'",
)
replace_once(
    'src/journey/model.ts',
    "  | 'transport.congestion-cleared'\n  | 'tls.message'",
    "  | 'transport.congestion-cleared'\n  | 'transport.stalled'\n  | 'tls.message'",
)
replace_once(
    'src/journey/model.ts',
    "  | 'camera.pullback'\n  | 'journey.complete';",
    "  | 'camera.pullback'\n  | 'journey.complete'\n  | 'journey.failed';",
)
replace_once(
    'src/journey/model.ts',
    "  failedLinkId?: string;\n}",
    "  failedLinkId?: string;\n  failedLinkIds?: string[];\n  candidateRouteCount?: number;\n  recoveryAvailable?: boolean;\n}",
)
replace_once(
    'src/journey/model.ts',
    "export type RouteJourneyState = 'idle' | 'lookup' | 'gateway-ready' | 'failed' | 'recomputing' | 'alternate-ready' | 'internet-path-ready';",
    "export type RouteJourneyState = 'idle' | 'lookup' | 'gateway-ready' | 'failed' | 'recomputing' | 'alternate-ready' | 'internet-path-ready' | 'unreachable';",
)
replace_once(
    'src/journey/model.ts',
    "export type TransportJourneyState = 'closed' | 'handshake' | 'established' | 'complete';",
    "export type TransportJourneyState = 'closed' | 'handshake' | 'established' | 'stalled' | 'complete';",
)
replace_once(
    'src/journey/model.ts',
    "export type HttpJourneyState = 'idle' | 'control' | 'request-sent' | 'service-unavailable' | 'retry-wait' | 'headers' | 'streaming' | 'complete';",
    "export type HttpJourneyState = 'idle' | 'control' | 'request-sent' | 'service-unavailable' | 'retry-wait' | 'headers' | 'streaming' | 'stalled' | 'complete';",
)
replace_once(
    'src/journey/model.ts',
    "export type JourneyImpairmentState = 'clean' | 'armed' | 'dns-failed' | 'dns-retrying' | 'dns-masked' | 'server-unavailable' | 'server-waiting' | 'server-ready' | 'lost' | 'detected' | 'recovering' | 'recovered' | 'delayed' | 'estimating' | 'normalized' | 'queueing' | 'ecn-signaled' | 'congestion-responding' | 'route-failed' | 'route-recomputing' | 'route-ready';",
    "export type JourneyImpairmentState = 'clean' | 'armed' | 'dns-failed' | 'dns-retrying' | 'dns-masked' | 'server-unavailable' | 'server-waiting' | 'server-ready' | 'lost' | 'detected' | 'recovering' | 'recovered' | 'delayed' | 'estimating' | 'normalized' | 'queueing' | 'ecn-signaled' | 'congestion-responding' | 'route-failed' | 'route-recomputing' | 'route-ready' | 'partitioned' | 'partition-recomputing' | 'unreachable';",
)
replace_once(
    'src/journey/model.ts',
    "  responseReady: boolean;\n  journeyComplete: boolean;",
    "  responseReady: boolean;\n  journeyComplete: boolean;\n  journeyFailed: boolean;\n  failureReason: 'network-unreachable' | null;",
)
replace_once(
    'src/journey/model.ts',
    "  let responseReady = false;\n  let journeyComplete = false;",
    "  let responseReady = false;\n  let journeyComplete = false;\n  let journeyFailed = false;\n  let failureReason: 'network-unreachable' | null = null;",
)
replace_once(
    'src/journey/model.ts',
    "      case 'route.alternate-installed':\n        route = 'alternate-ready';\n        impairmentState = 'route-ready';\n        routeMetrics = current.routeMetrics ?? routeMetrics;\n        break;\n      case 'internet.policy-path':",
    "      case 'route.alternate-installed':\n        route = 'alternate-ready';\n        impairmentState = 'route-ready';\n        routeMetrics = current.routeMetrics ?? routeMetrics;\n        break;\n      case 'route.partition':\n        route = 'failed';\n        impairmentState = 'partitioned';\n        routeMetrics = current.routeMetrics ?? routeMetrics;\n        break;\n      case 'route.partition-recompute':\n        route = 'recomputing';\n        impairmentState = 'partition-recomputing';\n        routeMetrics = current.routeMetrics ?? routeMetrics;\n        break;\n      case 'route.unreachable':\n        route = 'unreachable';\n        impairmentState = 'unreachable';\n        routeMetrics = current.routeMetrics ?? routeMetrics;\n        break;\n      case 'internet.policy-path':",
)
replace_once(
    'src/journey/model.ts',
    "      case 'transport.congestion-cleared':\n        impairmentState = 'normalized';\n        transportMetrics = current.transportMetrics ?? transportMetrics;\n        congestionMetrics = current.congestionMetrics ?? congestionMetrics;\n        break;\n      case 'tls.message':",
    "      case 'transport.congestion-cleared':\n        impairmentState = 'normalized';\n        transportMetrics = current.transportMetrics ?? transportMetrics;\n        congestionMetrics = current.congestionMetrics ?? congestionMetrics;\n        break;\n      case 'transport.stalled':\n        transport = 'stalled';\n        impairmentState = 'unreachable';\n        routeMetrics = current.routeMetrics ?? routeMetrics;\n        break;\n      case 'tls.message':",
)
replace_once(
    'src/journey/model.ts',
    "      case 'journey.complete': journeyComplete = true; break;",
    "      case 'journey.complete': journeyComplete = true; break;\n      case 'journey.failed':\n        route = 'unreachable';\n        transport = 'stalled';\n        http = 'stalled';\n        responseReady = false;\n        journeyComplete = false;\n        journeyFailed = true;\n        failureReason = 'network-unreachable';\n        impairmentState = 'unreachable';\n        routeMetrics = current.routeMetrics ?? routeMetrics;\n        break;",
)
replace_once(
    'src/journey/model.ts',
    "    responseReady,\n    journeyComplete,",
    "    responseReady,\n    journeyComplete,\n    journeyFailed,\n    failureReason,",
)

# Modifier: terminalize the latest successful response path after prior modifiers have run.
replace_once(
    'src/journey/modifiers.ts',
    "const JOURNEY_MODIFIER_ORDER: readonly JourneyModifierId[] = ['dns-failure', 'route-failure', 'server-failure', 'single-loss', 'path-outage', 'latency-spike', 'congestion'];",
    "const JOURNEY_MODIFIER_ORDER: readonly JourneyModifierId[] = ['dns-failure', 'route-failure', 'server-failure', 'single-loss', 'path-outage', 'latency-spike', 'congestion', 'partition'];",
)

partition_code = r'''

function latestPartitionTrigger(events: JourneyEvent[]): JourneyEvent {
  const preferredKinds = new Set<JourneyEventKind>([
    'http.data',
    'transport.recovered',
    'transport.latency-cleared',
    'transport.congestion-cleared',
  ]);
  const candidates = events.filter((current) => preferredKinds.has(current.kind)).sort((a, b) => b.atMs - a.atMs);
  if (!candidates[0]) throw new Error('partition requires response-path activity before terminalizing the Journey.');
  return candidates[0];
}

function partitionRouteMetrics(): JourneyRouteMetrics {
  return {
    primaryPathCost: 22,
    alternatePathCost: 52,
    activePath: 'none',
    failedLinkId: 'r1-core',
    failedLinkIds: ['r1-core', 'r2-core'],
    candidateRouteCount: 0,
    recoveryAvailable: false,
  };
}

function partitionEvents(triggerAtMs: number, terminalAtMs: number, transportProfile: JourneyTransportProfile): JourneyEvent[] {
  const metrics = partitionRouteMetrics();
  const transportProtocol = transportProfile === 'quic-h3' ? 'QUIC' : 'TCP';
  const stalledDetail = transportProfile === 'quic-h3'
    ? 'The QUIC connection had valid 1-RTT state before the cut. With no IP route, probes cannot create reachability; stalled does not mean the connection is already closed.'
    : 'The TCP connection was established before the cut. With no IP route, bytes cannot make progress; stalled does not mean the connection is already closed.';
  const injected = [
    modifierEvent({
      id: 'partition-cut',
      atMs: triggerAtMs + 220,
      kind: 'route.partition',
      scale: 'routing',
      zoom: 'out',
      protocol: 'IP',
      phase: 'partition-cut',
      title: 'Both routed exits disappear across the partition',
      summary: 'R1 → CORE and R2 → CORE are both unavailable, so the installed forwarding path is no longer usable.',
      detail: 'This is not the recoverable ROUTE or OUTAGE story. The teaching topology has lost both of its destination-facing exits at once.',
      actor: 'network partition',
      target: 'R1 / R2 uplinks',
      detailLab: 'failure',
      routeMetrics: metrics,
    }),
    modifierEvent({
      id: 'partition-recompute',
      atMs: triggerAtMs + 520,
      kind: 'route.partition-recompute',
      scale: 'routing',
      zoom: 'hold',
      protocol: 'OSPF-style SPF',
      phase: 'partition-recompute',
      title: 'SPF runs with zero surviving candidates',
      summary: 'The route calculation sees no primary or alternate path capable of reaching the destination.',
      detail: 'Recomputation is still meaningful even when it cannot produce a route. Candidate route count is explicitly zero.',
      actor: 'routing process',
      target: 'forwarding table',
      detailLab: 'failure',
      routeMetrics: metrics,
    }),
    modifierEvent({
      id: 'partition-unreachable',
      atMs: triggerAtMs + 820,
      kind: 'route.unreachable',
      scale: 'routing',
      zoom: 'hold',
      protocol: 'IP',
      phase: 'unreachable',
      title: 'Destination is unreachable: no route is installed',
      summary: 'Active path becomes NONE and forwarding cannot choose a next hop toward the destination.',
      detail: 'The terminal truth is routing reachability. HOPSCOTCH does not invent a third path or silently restore one of the failed links.',
      actor: 'forwarding table',
      target: 'destination prefix',
      detailLab: 'failure',
      routeMetrics: metrics,
    }),
    modifierEvent({
      id: 'partition-transport-stalled',
      atMs: triggerAtMs + 1080,
      kind: 'transport.stalled',
      scale: 'transport',
      zoom: 'in',
      protocol: transportProtocol,
      phase: 'transport-stalled',
      title: `${transportProtocol} state remains, but IP progress stops`,
      summary: 'The existing transport state is stalled because there is no forwarding path on which packets can travel.',
      detail: stalledDetail,
      actor: `${transportProtocol} sender`,
      target: 'unreachable IP path',
      detailLab: transportProfile === 'quic-h3' ? 'http' : 'tcp',
      routeMetrics: metrics,
    }),
    modifierEvent({
      id: 'partition-terminal',
      atMs: terminalAtMs,
      kind: 'journey.failed',
      scale: 'application',
      zoom: 'out',
      protocol: 'URL',
      phase: 'network-unreachable',
      title: 'Journey ends without a route to the destination',
      summary: 'The request cannot reach response-ready because the simulated network remains partitioned.',
      detail: 'No route exists and no recovery event follows. Earlier DNS, TLS, HTTP, and transport history remains inspectable when the time machine is rewound.',
      actor: 'network stack',
      target: 'browser',
      detailLab: 'failure',
      routeMetrics: metrics,
    }),
  ];
  if (injected[injected.length - 2].atMs >= terminalAtMs) throw new Error('partition terminal boundary must follow routing and transport stall events.');
  return injected;
}

const partitionModifier: JourneyModifier = {
  id: 'partition',
  order: 130,
  apply(events, context) {
    const trigger = latestPartitionTrigger(events);
    const complete = events.find((current) => current.kind === 'journey.complete');
    if (!complete) throw new Error('partition requires the pre-terminal Journey completion boundary.');
    const injected = partitionEvents(trigger.atMs, complete.atMs, context.config.transportProfile);
    const cutAtMs = injected[0].atMs;
    const kept = events.filter((current) => current.atMs < cutAtMs);
    return {
      events: [...kept, ...injected].sort((a, b) => a.atMs - b.atMs),
      addedDurationMs: 0,
      appliedModifierIds: ['partition'],
    };
  },
};
'''
replace_once(
    'src/journey/modifiers.ts',
    "const modifiers: JourneyModifier[] = [dnsFailureModifier, routeFailureModifier, serverFailureModifier, singleLossModifier, pathOutageModifier, latencySpikeModifier, congestionModifier]",
    partition_code + "\nconst modifiers: JourneyModifier[] = [dnsFailureModifier, routeFailureModifier, serverFailureModifier, singleLossModifier, pathOutageModifier, latencySpikeModifier, congestionModifier, partitionModifier]",
)

# Portable schema/browser compatibility.
replace_once(
    'src/journey/scenario.ts',
    "const impairmentProfiles = new Set<JourneyLegacyImpairmentProfile>(['clean', 'dns-failure', 'server-failure', 'single-loss', 'latency-spike', 'route-failure', 'path-outage', 'congestion']);",
    "const impairmentProfiles = new Set<JourneyLegacyImpairmentProfile>(['clean', 'dns-failure', 'server-failure', 'single-loss', 'latency-spike', 'route-failure', 'path-outage', 'congestion', 'partition']);",
)
replace_once(
    'src/journey/browser.ts',
    "storedImpairment === 'dns-failure' || storedImpairment === 'server-failure' || storedImpairment === 'single-loss' || storedImpairment === 'latency-spike' || storedImpairment === 'route-failure' || storedImpairment === 'path-outage' || storedImpairment === 'congestion' ? storedImpairment : 'clean'",
    "storedImpairment === 'dns-failure' || storedImpairment === 'server-failure' || storedImpairment === 'single-loss' || storedImpairment === 'latency-spike' || storedImpairment === 'route-failure' || storedImpairment === 'path-outage' || storedImpairment === 'congestion' || storedImpairment === 'partition' ? storedImpairment : 'clean'",
)

# Journey theater: terminal routing, stalled transport, failure scene, ninth control.
replace_once(
    'src/JourneyTheaterV2.tsx',
    "function isServerFailureEvent(kind: string): boolean {\n  return kind === 'server.unavailable' || kind === 'http.service-unavailable' || kind === 'http.retry-wait' || kind === 'server.recovered' || kind === 'http.retry';\n}\n\nfunction modifierLabel",
    "function isServerFailureEvent(kind: string): boolean {\n  return kind === 'server.unavailable' || kind === 'http.service-unavailable' || kind === 'http.retry-wait' || kind === 'server.recovered' || kind === 'http.retry';\n}\n\nfunction isPartitionEvent(kind: string): boolean {\n  return kind === 'route.partition' || kind === 'route.partition-recompute' || kind === 'route.unreachable' || kind === 'transport.stalled' || kind === 'journey.failed';\n}\n\nfunction modifierLabel",
)
replace_once(
    'src/JourneyTheaterV2.tsx',
    "  return modifierIds.map((id) => id === 'dns-failure' ? 'DNS FAIL' : id === 'route-failure' ? 'ROUTE' : id === 'server-failure' ? 'SERVER' : id === 'single-loss' ? 'LOSS' : id === 'latency-spike' ? 'LATENCY' : id === 'path-outage' ? 'OUTAGE' : 'CONGESTION').join(' + ');",
    "  return modifierIds.map((id) => id === 'dns-failure' ? 'DNS FAIL' : id === 'route-failure' ? 'ROUTE' : id === 'server-failure' ? 'SERVER' : id === 'single-loss' ? 'LOSS' : id === 'latency-spike' ? 'LATENCY' : id === 'path-outage' ? 'OUTAGE' : id === 'congestion' ? 'CONGESTION' : 'PARTITION').join(' + ');",
)
replace_once(
    'src/JourneyTheaterV2.tsx',
    "  if (state.impairmentState === 'server-ready') return 'server-ready-active';",
    "  if (state.impairmentState === 'server-ready') return 'server-ready-active';\n  if (state.impairmentState === 'partitioned' || state.impairmentState === 'partition-recomputing' || state.impairmentState === 'unreachable') return 'partition-active';",
)
replace_once(
    'src/JourneyTheaterV2.tsx',
    "  if (state.impairmentState === 'server-ready') return 'server-ready-callout';",
    "  if (state.impairmentState === 'server-ready') return 'server-ready-callout';\n  if (state.impairmentState === 'partitioned' || state.impairmentState === 'partition-recomputing' || state.impairmentState === 'unreachable') return 'partition-callout';",
)
replace_once(
    'src/JourneyTheaterV2.tsx',
    "function sceneMode(state: JourneyState): string {\n  if (state.scale !== 'application')",
    "function sceneMode(state: JourneyState): string {\n  if (state.journeyFailed) return 'failure';\n  if (state.scale !== 'application')",
)
replace_once(
    'src/JourneyTheaterV2.tsx',
    "  const routeSelected = state.modifierIds.includes('route-failure') || state.modifierIds.includes('path-outage');",
    "  const routeSelected = state.modifierIds.includes('route-failure') || state.modifierIds.includes('path-outage') || state.modifierIds.includes('partition');",
)
replace_once(
    'src/JourneyTheaterV2.tsx',
    "  const failed = state.route === 'failed' || state.route === 'recomputing' || state.route === 'alternate-ready' || (state.route === 'internet-path-ready' && state.routeMetrics?.failedLinkId === 'r1-core');\n  const recomputing = state.route === 'recomputing';\n  const alternateActive = state.route === 'alternate-ready' || (state.route === 'internet-path-ready' && state.routeMetrics?.activePath === 'alternate');\n  const primaryActive = !failed && (state.route === 'gateway-ready' || state.route === 'lookup');",
    "  const failed = state.route === 'failed' || state.route === 'recomputing' || state.route === 'alternate-ready' || state.route === 'unreachable' || (state.route === 'internet-path-ready' && state.routeMetrics?.failedLinkId === 'r1-core');\n  const recomputing = state.route === 'recomputing';\n  const primaryFailed = state.routeMetrics?.failedLinkIds?.includes('r1-core') ?? failed;\n  const alternateFailed = state.routeMetrics?.failedLinkIds?.includes('r2-core') ?? false;\n  const alternateActive = !alternateFailed && (state.route === 'alternate-ready' || (state.route === 'internet-path-ready' && state.routeMetrics?.activePath === 'alternate'));\n  const primaryActive = !primaryFailed && (state.route === 'gateway-ready' || state.route === 'lookup');",
)
replace_once(
    'src/JourneyTheaterV2.tsx',
    "<div className={`route-branch-row primary ${primaryActive ? 'active' : ''} ${failed ? 'failed' : ''}`}><span>R1 → CORE</span><i/><b>COST 22</b></div>\n        <div className={`route-branch-row alternate ${recomputing ? 'recomputing' : ''} ${alternateActive ? 'active' : ''}`}><span>R2 → CORE</span><i/><b>COST 52</b></div>",
    "<div className={`route-branch-row primary ${primaryActive ? 'active' : ''} ${primaryFailed ? 'failed' : ''}`}><span>R1 → CORE</span><i/><b>COST 22</b></div>\n        <div className={`route-branch-row alternate ${recomputing ? 'recomputing' : ''} ${alternateActive ? 'active' : ''} ${alternateFailed ? 'failed' : ''}`}><span>R2 → CORE</span><i/><b>COST 52</b></div>",
)
replace_once(
    'src/JourneyTheaterV2.tsx',
    "<div className={failed ? 'danger' : ''}><span>FAILED LINK</span><strong>{failed ? 'R1 → CORE' : 'NONE'}</strong></div>",
    "<div className={failed ? 'danger' : ''}><span>{alternateFailed ? 'FAILED LINKS' : 'FAILED LINK'}</span><strong>{alternateFailed ? 'R1 + R2 → CORE' : failed ? 'R1 → CORE' : 'NONE'}</strong></div>",
)
replace_once(
    'src/JourneyTheaterV2.tsx',
    "function TransportScene({ state }: { state: JourneyState }) {\n  const quic = state.transportProfile === 'quic-h3';\n  const established = state.transport === 'established' || state.transport === 'complete';",
    "function TransportScene({ state }: { state: JourneyState }) {\n  const quic = state.transportProfile === 'quic-h3';\n  const stalled = state.transport === 'stalled';\n  const established = state.transport === 'established' || stalled || state.transport === 'complete';",
)
replace_once(
    'src/JourneyTheaterV2.tsx',
    "  const leftState = complete ? 'COMPLETE' : established ? '1-RTT READY' : quic ? 'INITIAL / HANDSHAKE' : 'SYN-SENT';\n  const rightState = complete ? 'COMPLETE' : established ? '1-RTT READY' : quic ? 'INITIAL / HANDSHAKE' : 'LISTEN';",
    "  const leftState = stalled ? 'STALLED · NO IP ROUTE' : complete ? 'COMPLETE' : established ? '1-RTT READY' : quic ? 'INITIAL / HANDSHAKE' : 'SYN-SENT';\n  const rightState = stalled ? 'STATE RETAINED' : complete ? 'COMPLETE' : established ? '1-RTT READY' : quic ? 'INITIAL / HANDSHAKE' : 'LISTEN';",
)
replace_once(
    'src/JourneyTheaterV2.tsx',
    "    {congestionSelected && isCongestionEvent(state.activeEvent.kind) && <JourneyCongestionPanel state={state}/>}\n    {detectingLoss ?",
    "    {congestionSelected && isCongestionEvent(state.activeEvent.kind) && <JourneyCongestionPanel state={state}/>}\n    {stalled&&<div className=\"partition-transport-panel\"><span>IP ROUTE</span><strong>NONE</strong><small>TRANSPORT STATE EXISTS · FORWARDING CANNOT PROGRESS</small></div>}\n    {detectingLoss ?",
)
# Insert terminal failure scene before ResponseScene and route ApplicationScene to it.
replace_once(
    'src/JourneyTheaterV2.tsx',
    "function ResponseScene({ hostname }: { hostname: string }) {",
    "function FailureScene({ state, hostname }: { state: JourneyState; hostname: string }) {\n  return <div className=\"journey-scene response-scene failure-scene\"><div className=\"browser-frame failure-frame\"><div><i/><i/><i/><span>{hostname}</span></div><section><b>NO ROUTE</b><strong>NETWORK UNREACHABLE</strong><p>Both routed exits are down. DNS, TLS, and earlier transport history still exist, but IP forwarding has no path to the destination.</p><small>JOURNEY TERMINATED · NO RECOVERY FABRICATED</small></section></div><div className=\"partition-terminal-facts\"><span>ACTIVE PATH <b>NONE</b></span><span>ROUTE CANDIDATES <b>{state.routeMetrics?.candidateRouteCount ?? 0}</b></span><span>TRANSPORT <b>STALLED</b></span></div></div>;\n}\n\nfunction ResponseScene({ hostname }: { hostname: string }) {",
)
replace_once(
    'src/JourneyTheaterV2.tsx',
    "function ApplicationScene({ state, hostname, address }: { state: JourneyState; hostname: string; address: string }) {\n  if (state.protocol === 'DNS')",
    "function ApplicationScene({ state, hostname, address }: { state: JourneyState; hostname: string; address: string }) {\n  if (state.journeyFailed) return <FailureScene state={state} hostname={hostname}/>;\n  if (state.protocol === 'DNS')",
)
replace_once(
    'src/JourneyTheaterV2.tsx',
    "  const serverFailureSelected = selectedModifiers.includes('server-failure');",
    "  const serverFailureSelected = selectedModifiers.includes('server-failure');\n  const partitionSelected = selectedModifiers.includes('partition');",
)
replace_once(
    'src/JourneyTheaterV2.tsx',
    "<button type=\"button\" className={serverFailureSelected?'active':''} aria-pressed={serverFailureSelected} onClick={()=>toggleModifier('server-failure')}>SERVER</button></div><button type=\"button\" className=\"context-button\"",
    "<button type=\"button\" className={serverFailureSelected?'active':''} aria-pressed={serverFailureSelected} onClick={()=>toggleModifier('server-failure')}>SERVER</button><button type=\"button\" className={partitionSelected?'active':''} aria-pressed={partitionSelected} onClick={()=>toggleModifier('partition')}>PARTITION</button></div><button type=\"button\" className=\"context-button\"",
)
replace_once(
    'src/JourneyTheaterV2.tsx',
    "className={lossSelected||latencySelected||outageSelected||congestionSelected?toneClass:''}",
    "className={lossSelected||latencySelected||outageSelected||congestionSelected||partitionSelected?toneClass:''}",
)
replace_once(
    'src/JourneyTheaterV2.tsx',
    "const serverFailureEvent=isServerFailureEvent(current.kind);return <button",
    "const serverFailureEvent=isServerFailureEvent(current.kind);const partitionEvent=isPartitionEvent(current.kind);return <button",
)
replace_once(
    'src/JourneyTheaterV2.tsx',
    "${serverFailureEvent?'server-failure-event':''}`} onClick",
    "${serverFailureEvent?'server-failure-event':''} ${partitionEvent?'partition-event':''}`} onClick",
)
replace_once(
    'src/JourneyTheaterV2.tsx',
    "${isServerFailureEvent(current.kind)?'server-failure-marker':''}`} style=",
    "${isServerFailureEvent(current.kind)?'server-failure-marker':''} ${isPartitionEvent(current.kind)?'partition-marker':''}`} style=",
)

# Visual language and 3x3 mobile modifier grid.
append_once(
    'src/journey-god-mode.css',
    '.partition-transport-panel{',
    r'''

.journey-modifier-profile button:nth-child(9)[aria-pressed="true"]{background:rgba(226,235,241,.09);color:#eef4f7;box-shadow:inset 0 0 0 1px rgba(226,235,241,.3)}.journey-impairment-profile{min-width:500px}
.route-branch-row.alternate.failed{opacity:1;border-color:rgba(255,112,112,.3);background:rgba(255,112,112,.025)}.route-branch-row.alternate.failed i{background:#ff7070;box-shadow:0 0 10px rgba(255,112,112,.36)}.route-branch-row.alternate.failed:after{content:"×";position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);display:grid;place-items:center;width:18px;height:18px;border:1px solid rgba(255,112,112,.5);border-radius:50%;color:#ff8e8e;background:#17090c;font-size:.62rem;font-weight:900}.partition-transport-panel{display:grid;grid-template-columns:auto auto 1fr;align-items:center;gap:12px;padding:12px 14px;border:1px solid rgba(226,235,241,.2);border-radius:5px;background:rgba(226,235,241,.022)}.partition-transport-panel span{color:#91a0a8;font-size:.43rem;font-weight:950;letter-spacing:.1em}.partition-transport-panel strong{color:#f0f5f7;font:800 .68rem ui-monospace,SFMono-Regular,Menlo,monospace}.partition-transport-panel small{color:#77868e;font-size:.43rem;font-weight:800;letter-spacing:.055em;text-align:right}.journey-stage-meta strong.partition-active,.journey-state-strip strong.partition-active{color:#edf3f6}.journey-callout.partition-callout{border-color:rgba(226,235,241,.25);box-shadow:inset 3px 0 0 rgba(226,235,241,.7)}.journey-event.partition-event{border-color:rgba(226,235,241,.07)}.journey-event.partition-event.current{border-color:rgba(226,235,241,.36);background:rgba(226,235,241,.04)}.journey-scrubber i.partition-marker{height:15px!important;top:-4px!important;background:#e2ebf1!important;box-shadow:0 0 9px rgba(226,235,241,.45)}.failure-frame{border-color:rgba(255,112,112,.2)!important}.failure-frame section b{color:#ff8f8f!important}.failure-frame section strong{color:#f2f5f7!important}.failure-frame section small{display:block;margin-top:10px;color:#8f9ca3;font-size:.45rem;font-weight:900;letter-spacing:.08em}.partition-terminal-facts{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.partition-terminal-facts span{padding:9px 10px;border:1px solid rgba(226,235,241,.08);border-radius:4px;color:#708088;font-size:.42rem;font-weight:900;letter-spacing:.07em;text-align:center}.partition-terminal-facts b{color:#edf3f6;margin-left:6px}
@media(max-width:950px){.journey-impairment-profile{min-width:0}.journey-modifier-profile{grid-template-columns:repeat(3,minmax(0,1fr))}.partition-transport-panel{grid-template-columns:1fr;text-align:center}.partition-transport-panel small{text-align:center}}
@media(max-width:520px){.partition-terminal-facts{grid-template-columns:1fr}}
''',
)
