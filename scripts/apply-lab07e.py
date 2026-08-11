from pathlib import Path


def replace_once(path, old, new):
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise SystemExit(f'missing patch anchor in {path}: {old[:120]!r}')
    file.write_text(text.replace(old, new, 1))


def append_once(path, marker, addition):
    file = Path(path)
    text = file.read_text()
    if marker in text:
        return
    file.write_text(text + addition)


# model.ts — canonical ID, event/state types, metrics, reducer projection.
replace_once(
    'src/journey/model.ts',
    "export type JourneyModifierId = 'route-failure' | 'single-loss' | 'path-outage' | 'latency-spike';",
    "export type JourneyModifierId = 'route-failure' | 'single-loss' | 'path-outage' | 'latency-spike' | 'congestion';",
)
replace_once(
    'src/journey/model.ts',
    "  | 'transport.latency-cleared'\n  | 'tls.message'",
    "  | 'transport.latency-cleared'\n  | 'transport.queue-growth'\n  | 'transport.ecn-mark'\n  | 'transport.congestion-response'\n  | 'transport.congestion-cleared'\n  | 'tls.message'",
)
replace_once(
    'src/journey/model.ts',
    "export interface JourneyRouteMetrics {\n  primaryPathCost: number;",
    "export interface JourneyCongestionMetrics {\n  bottleneckRateMbps: number;\n  offeredRateMbps: number;\n  queueCapacityPackets: number;\n  queueOccupancyPackets: number;\n  queueDelayMs: number;\n  ecnCeMarks: number;\n  congestionWindowPackets: number;\n  slowStartThresholdPackets?: number;\n  signal: 'NONE' | 'CE' | 'ECE/CWR' | 'ACK_ECN';\n  droppedPackets: number;\n}\n\nexport interface JourneyRouteMetrics {\n  primaryPathCost: number;",
)
replace_once(
    'src/journey/model.ts',
    "  transportMetrics?: JourneyTransportMetrics;\n  routeMetrics?: JourneyRouteMetrics;",
    "  transportMetrics?: JourneyTransportMetrics;\n  congestionMetrics?: JourneyCongestionMetrics;\n  routeMetrics?: JourneyRouteMetrics;",
)
replace_once(
    'src/journey/model.ts',
    "export type JourneyImpairmentState = 'clean' | 'armed' | 'lost' | 'detected' | 'recovering' | 'recovered' | 'delayed' | 'estimating' | 'normalized' | 'route-failed' | 'route-recomputing' | 'route-ready';",
    "export type JourneyImpairmentState = 'clean' | 'armed' | 'lost' | 'detected' | 'recovering' | 'recovered' | 'delayed' | 'estimating' | 'normalized' | 'queueing' | 'ecn-signaled' | 'congestion-responding' | 'route-failed' | 'route-recomputing' | 'route-ready';",
)
replace_once(
    'src/journey/model.ts',
    "  transportMetrics: JourneyTransportMetrics | null;\n  routeMetrics: JourneyRouteMetrics | null;",
    "  transportMetrics: JourneyTransportMetrics | null;\n  congestionMetrics: JourneyCongestionMetrics | null;\n  routeMetrics: JourneyRouteMetrics | null;",
)
replace_once(
    'src/journey/model.ts',
    "  let transportMetrics: JourneyTransportMetrics | null = null;\n  let routeMetrics: JourneyRouteMetrics | null = null;",
    "  let transportMetrics: JourneyTransportMetrics | null = null;\n  let congestionMetrics: JourneyCongestionMetrics | null = null;\n  let routeMetrics: JourneyRouteMetrics | null = null;",
)
replace_once(
    'src/journey/model.ts',
    "      case 'transport.latency-cleared':\n        impairmentState = 'normalized';\n        transportMetrics = current.transportMetrics ?? transportMetrics;\n        break;\n      case 'tls.message':",
    "      case 'transport.latency-cleared':\n        impairmentState = 'normalized';\n        transportMetrics = current.transportMetrics ?? transportMetrics;\n        break;\n      case 'transport.queue-growth':\n        impairmentState = 'queueing';\n        transportMetrics = current.transportMetrics ?? transportMetrics;\n        congestionMetrics = current.congestionMetrics ?? congestionMetrics;\n        break;\n      case 'transport.ecn-mark':\n        impairmentState = 'ecn-signaled';\n        transportMetrics = current.transportMetrics ?? transportMetrics;\n        congestionMetrics = current.congestionMetrics ?? congestionMetrics;\n        break;\n      case 'transport.congestion-response':\n        impairmentState = 'congestion-responding';\n        transportMetrics = current.transportMetrics ?? transportMetrics;\n        congestionMetrics = current.congestionMetrics ?? congestionMetrics;\n        break;\n      case 'transport.congestion-cleared':\n        impairmentState = 'normalized';\n        transportMetrics = current.transportMetrics ?? transportMetrics;\n        congestionMetrics = current.congestionMetrics ?? congestionMetrics;\n        break;\n      case 'tls.message':",
)
replace_once(
    'src/journey/model.ts',
    "    transportMetrics,\n    routeMetrics,",
    "    transportMetrics,\n    congestionMetrics,\n    routeMetrics,",
)

# modifiers.ts — canonical order + deterministic ECN queue episode.
replace_once(
    'src/journey/modifiers.ts',
    "  JourneyImpairmentProfile,\n  JourneyModifierId,",
    "  JourneyImpairmentProfile,\n  JourneyCongestionMetrics,\n  JourneyModifierId,",
)
replace_once(
    'src/journey/modifiers.ts',
    "const JOURNEY_MODIFIER_ORDER: readonly JourneyModifierId[] = ['route-failure', 'single-loss', 'path-outage', 'latency-spike'];",
    "const JOURNEY_MODIFIER_ORDER: readonly JourneyModifierId[] = ['route-failure', 'single-loss', 'path-outage', 'latency-spike', 'congestion'];",
)
replace_once(
    'src/journey/modifiers.ts',
    "  transportMetrics?: JourneyTransportMetrics;\n  routeMetrics?: JourneyRouteMetrics;",
    "  transportMetrics?: JourneyTransportMetrics;\n  congestionMetrics?: JourneyCongestionMetrics;\n  routeMetrics?: JourneyRouteMetrics;",
)

congestion_code = r'''

function latestTransportEpisodeEnd(events: JourneyEvent[]): JourneyEvent | undefined {
  return events
    .filter((current) => current.kind === 'transport.recovered' || current.kind === 'transport.latency-cleared')
    .sort((a, b) => b.atMs - a.atMs)[0];
}

function congestionMetrics(input: Partial<JourneyCongestionMetrics> = {}): JourneyCongestionMetrics {
  return {
    bottleneckRateMbps: 100,
    offeredRateMbps: 160,
    queueCapacityPackets: 32,
    queueOccupancyPackets: 8,
    queueDelayMs: 24,
    ecnCeMarks: 0,
    congestionWindowPackets: 12,
    slowStartThresholdPackets: 24,
    signal: 'NONE',
    droppedPackets: 0,
    ...input,
  };
}

function tcpCongestionEvents(baseAtMs: number): JourneyEvent[] {
  return [
    modifierEvent({ id: 'tcp-congestion-queue-start', atMs: baseAtMs + 160, kind: 'transport.queue-growth', scale: 'transport', zoom: 'out', protocol: 'TCP', phase: 'queue-growth', title: 'A bottleneck queue starts to build', summary: 'The sender offers about 160 Mb/s to a 100 Mb/s bottleneck, so packets begin waiting instead of disappearing.', detail: 'Queueing raises delay before it creates a transport loss signal. TCP still has a contiguous sequence space and no retransmission is justified.', actor: 'bottleneck queue', target: 'TCP flow', detailLab: 'tcp', transportMetrics: { baselineRttMs: 32, latestRttMs: 56, lossDetected: false }, congestionMetrics: congestionMetrics() }),
    modifierEvent({ id: 'tcp-congestion-queue-high', atMs: baseAtMs + 420, kind: 'transport.queue-growth', scale: 'transport', zoom: 'hold', protocol: 'TCP', phase: 'queue-high', title: 'Queueing delay grows before any drop', summary: 'The queue reaches 24 of 32 packets and contributes roughly 96 ms of delay.', detail: 'This is a congestion precursor, not packet loss. The receiver can still acknowledge a complete TCP byte stream.', actor: 'bottleneck queue', target: 'TCP ACK clock', detailLab: 'tcp', transportMetrics: { baselineRttMs: 32, latestRttMs: 128, lossDetected: false }, congestionMetrics: congestionMetrics({ queueOccupancyPackets: 24, queueDelayMs: 96 }) }),
    modifierEvent({ id: 'tcp-congestion-ecn', atMs: baseAtMs + 680, kind: 'transport.ecn-mark', scale: 'packet', zoom: 'in', protocol: 'IP ECN', phase: 'ecn-ce', title: 'ECN marks congestion without dropping the packet', summary: 'Three packets arrive with the IP CE codepoint while the queue approaches capacity.', detail: 'The curated bottleneck is ECN-capable: CE is an explicit congestion signal carried on delivered packets, not a missing TCP sequence range.', actor: 'ECN-capable bottleneck', target: 'TCP receiver', detailLab: 'packet', transportMetrics: { baselineRttMs: 32, latestRttMs: 136, lossDetected: false }, congestionMetrics: congestionMetrics({ queueOccupancyPackets: 26, queueDelayMs: 104, ecnCeMarks: 3, signal: 'CE' }) }),
    modifierEvent({ id: 'tcp-congestion-response', atMs: baseAtMs + 900, kind: 'transport.congestion-response', scale: 'transport', zoom: 'out', protocol: 'TCP ECN', phase: 'ecn-response', title: 'TCP ECE feedback cuts the congestion window', summary: 'ECE feedback causes the teaching cwnd to fall from 12 to 6 packets; the sender answers with CWR.', detail: 'There is no TCP sequence gap and no retransmission. Congestion control reduces sending pressure because ECN reported congestion before a drop was needed.', actor: 'TCP sender', target: 'bottleneck queue', detailLab: 'tcp', transportMetrics: { baselineRttMs: 32, latestRttMs: 104, lossDetected: false }, congestionMetrics: congestionMetrics({ offeredRateMbps: 78, queueOccupancyPackets: 20, queueDelayMs: 72, ecnCeMarks: 3, congestionWindowPackets: 6, slowStartThresholdPackets: 6, signal: 'ECE/CWR' }) }),
    modifierEvent({ id: 'tcp-congestion-cleared', atMs: baseAtMs + 1320, kind: 'transport.congestion-cleared', scale: 'application', zoom: 'out', protocol: 'HTTP/2', phase: 'queue-drained', title: 'The queue drains after TCP backs off', summary: 'With offered load below the bottleneck rate, occupancy falls to four packets and response pacing steadies.', detail: 'HTTP/2 continues on the same TCP/TLS connection. No packet was dropped and no repair transmission was required in this ECN episode.', actor: 'bottleneck queue', target: 'HTTP/2', detailLab: 'http', transportMetrics: { baselineRttMs: 32, latestRttMs: 44, lossDetected: false }, congestionMetrics: congestionMetrics({ offeredRateMbps: 78, queueOccupancyPackets: 4, queueDelayMs: 12, ecnCeMarks: 3, congestionWindowPackets: 6, slowStartThresholdPackets: 6, signal: 'NONE' }) }),
  ];
}

function quicCongestionEvents(baseAtMs: number): JourneyEvent[] {
  return [
    modifierEvent({ id: 'quic-congestion-queue-start', atMs: baseAtMs + 160, kind: 'transport.queue-growth', scale: 'transport', zoom: 'out', protocol: 'QUIC', phase: 'queue-growth', title: 'A bottleneck queue starts to build', summary: 'The QUIC sender offers about 160 Mb/s to a 100 Mb/s bottleneck, so packets spend longer waiting in the queue.', detail: 'Queueing changes ACK timing first. There is no packet-number gap, PTO recovery, or STREAM retransmission in this congestion-only episode.', actor: 'bottleneck queue', target: 'QUIC flow', detailLab: 'http', transportMetrics: { baselineRttMs: 32, latestRttMs: 56, ackDelayMs: 25, lossDetected: false }, congestionMetrics: congestionMetrics({ slowStartThresholdPackets: undefined }) }),
    modifierEvent({ id: 'quic-congestion-queue-high', atMs: baseAtMs + 420, kind: 'transport.queue-growth', scale: 'transport', zoom: 'hold', protocol: 'QUIC', phase: 'queue-high', title: 'Queueing delay grows before any drop', summary: 'The queue reaches 24 of 32 packets and latest_rtt rises as feedback spends longer in the path.', detail: 'The QUIC packet-number space remains contiguous from the receiver perspective. Higher RTT by itself is not a QUIC loss declaration.', actor: 'bottleneck queue', target: 'QUIC ACK timing', detailLab: 'http', transportMetrics: { baselineRttMs: 32, latestRttMs: 128, ackDelayMs: 25, lossDetected: false }, congestionMetrics: congestionMetrics({ queueOccupancyPackets: 24, queueDelayMs: 96, slowStartThresholdPackets: undefined }) }),
    modifierEvent({ id: 'quic-congestion-ecn', atMs: baseAtMs + 680, kind: 'transport.ecn-mark', scale: 'packet', zoom: 'in', protocol: 'IP ECN', phase: 'ecn-ce', title: 'ECN marks QUIC packets instead of dropping them', summary: 'The receiver observes three additional CE-marked packets while all packet numbers still arrive.', detail: 'The packet remains delivered. ACK_ECN can report increasing CE counters without inventing a packet-number gap or STREAM loss.', actor: 'ECN-capable bottleneck', target: 'QUIC receiver', detailLab: 'packet', transportMetrics: { baselineRttMs: 32, latestRttMs: 136, ackDelayMs: 25, lossDetected: false }, congestionMetrics: congestionMetrics({ queueOccupancyPackets: 26, queueDelayMs: 104, ecnCeMarks: 3, signal: 'CE', slowStartThresholdPackets: undefined }) }),
    modifierEvent({ id: 'quic-congestion-response', atMs: baseAtMs + 900, kind: 'transport.congestion-response', scale: 'transport', zoom: 'out', protocol: 'QUIC ACK_ECN', phase: 'ecn-response', title: 'ACK_ECN feedback reduces the QUIC congestion window', summary: 'Validated CE-counter growth causes the teaching congestion window to fall from 12 to 6 packets.', detail: 'There is no QUIC packet-number gap, retransmission, or PTO recovery here. The sender reduces in-flight pressure because ACK_ECN explicitly reported congestion.', actor: 'QUIC sender', target: 'bottleneck queue', detailLab: 'http', transportMetrics: { baselineRttMs: 32, latestRttMs: 104, ackDelayMs: 25, lossDetected: false }, congestionMetrics: congestionMetrics({ offeredRateMbps: 78, queueOccupancyPackets: 20, queueDelayMs: 72, ecnCeMarks: 3, congestionWindowPackets: 6, slowStartThresholdPackets: undefined, signal: 'ACK_ECN' }) }),
    modifierEvent({ id: 'quic-congestion-cleared', atMs: baseAtMs + 1320, kind: 'transport.congestion-cleared', scale: 'application', zoom: 'out', protocol: 'HTTP/3', phase: 'queue-drained', title: 'The queue drains after QUIC backs off', summary: 'Offered load falls below the bottleneck rate, occupancy returns to four packets, and request-stream pacing steadies.', detail: 'HTTP/3 continues on the same QUIC/TLS state. No packet or STREAM data was lost, so there is nothing to retransmit.', actor: 'bottleneck queue', target: 'HTTP/3', detailLab: 'http', transportMetrics: { baselineRttMs: 32, latestRttMs: 44, ackDelayMs: 25, lossDetected: false }, congestionMetrics: congestionMetrics({ offeredRateMbps: 78, queueOccupancyPackets: 4, queueDelayMs: 12, ecnCeMarks: 3, congestionWindowPackets: 6, slowStartThresholdPackets: undefined, signal: 'NONE' }) }),
  ];
}

const congestionModifier: JourneyModifier = {
  id: 'congestion',
  order: 120,
  apply(events, context) {
    const { data, packetFrame } = requireResponseAnchors(events, 'congestion');
    const priorEpisode = latestTransportEpisodeEnd(events);
    const baseAtMs = priorEpisode?.atMs ?? data.atMs;
    const addedDurationMs = 1700;
    const shifted = shiftPostAnchor(events, packetFrame.atMs, addedDurationMs);
    const injected = context.config.transportProfile === 'tcp-h2'
      ? tcpCongestionEvents(baseAtMs)
      : quicCongestionEvents(baseAtMs);
    return {
      events: [...shifted, ...injected].sort((a, b) => a.atMs - b.atMs),
      addedDurationMs,
      appliedModifierIds: ['congestion'],
    };
  },
};
'''
replace_once(
    'src/journey/modifiers.ts',
    "const modifiers: JourneyModifier[] = [routeFailureModifier, singleLossModifier, pathOutageModifier, latencySpikeModifier]",
    congestion_code + "\nconst modifiers: JourneyModifier[] = [routeFailureModifier, singleLossModifier, pathOutageModifier, latencySpikeModifier, congestionModifier]",
)

# Scenario/browser compatibility.
replace_once(
    'src/journey/scenario.ts',
    "const impairmentProfiles = new Set<JourneyLegacyImpairmentProfile>(['clean', 'single-loss', 'latency-spike', 'route-failure', 'path-outage']);",
    "const impairmentProfiles = new Set<JourneyLegacyImpairmentProfile>(['clean', 'single-loss', 'latency-spike', 'route-failure', 'path-outage', 'congestion']);",
)
replace_once(
    'src/journey/browser.ts',
    "storedImpairment === 'single-loss' || storedImpairment === 'latency-spike' || storedImpairment === 'route-failure' || storedImpairment === 'path-outage' ? storedImpairment : 'clean'",
    "storedImpairment === 'single-loss' || storedImpairment === 'latency-spike' || storedImpairment === 'route-failure' || storedImpairment === 'path-outage' || storedImpairment === 'congestion' ? storedImpairment : 'clean'",
)

# Journey theater wiring.
replace_once(
    'src/JourneyTheaterV2.tsx',
    "import { JourneyLatencyPanel } from './JourneyLatencyPanel';",
    "import { JourneyCongestionPanel } from './JourneyCongestionPanel';\nimport { JourneyLatencyPanel } from './JourneyLatencyPanel';",
)
replace_once(
    'src/JourneyTheaterV2.tsx',
    "function isRouteFailureEvent(kind: string): boolean {\n  return kind === 'route.failure' || kind === 'route.invalidated' || kind === 'route.recompute' || kind === 'route.alternate-installed';\n}\n\nfunction modifierLabel",
    "function isRouteFailureEvent(kind: string): boolean {\n  return kind === 'route.failure' || kind === 'route.invalidated' || kind === 'route.recompute' || kind === 'route.alternate-installed';\n}\n\nfunction isCongestionEvent(kind: string): boolean {\n  return kind === 'transport.queue-growth' || kind === 'transport.ecn-mark' || kind === 'transport.congestion-response' || kind === 'transport.congestion-cleared';\n}\n\nfunction modifierLabel",
)
replace_once(
    'src/JourneyTheaterV2.tsx',
    "  return modifierIds.map((id) => id === 'route-failure' ? 'ROUTE' : id === 'single-loss' ? 'LOSS' : id === 'latency-spike' ? 'LATENCY' : 'OUTAGE').join(' + ');",
    "  return modifierIds.map((id) => id === 'route-failure' ? 'ROUTE' : id === 'single-loss' ? 'LOSS' : id === 'latency-spike' ? 'LATENCY' : id === 'path-outage' ? 'OUTAGE' : 'CONGESTION').join(' + ');",
)
replace_once(
    'src/JourneyTheaterV2.tsx',
    "  if (state.impairmentState === 'route-failed') return 'route-failed';",
    "  if (state.impairmentState === 'queueing' || state.impairmentState === 'ecn-signaled' || state.impairmentState === 'congestion-responding') return 'congestion-active';\n  if (state.impairmentState === 'route-failed') return 'route-failed';",
)
replace_once(
    'src/JourneyTheaterV2.tsx',
    "  if (state.impairmentState === 'route-failed') return 'route-failure-callout';",
    "  if (state.impairmentState === 'queueing' || state.impairmentState === 'ecn-signaled' || state.impairmentState === 'congestion-responding') return 'congestion-callout';\n  if (state.impairmentState === 'route-failed') return 'route-failure-callout';",
)
replace_once(
    'src/JourneyTheaterV2.tsx',
    "  const latencySelected = state.modifierIds.includes('latency-spike');",
    "  const latencySelected = state.modifierIds.includes('latency-spike');\n  const congestionSelected = state.modifierIds.includes('congestion');",
)
replace_once(
    'src/JourneyTheaterV2.tsx',
    "    {latencySelected && (state.activeEvent.kind === 'transport.latency' || state.activeEvent.kind === 'transport.rtt-update') && <JourneyLatencyPanel state={state}/>}\n    {detectingLoss ?",
    "    {latencySelected && (state.activeEvent.kind === 'transport.latency' || state.activeEvent.kind === 'transport.rtt-update') && <JourneyLatencyPanel state={state}/>}\n    {congestionSelected && isCongestionEvent(state.activeEvent.kind) && <JourneyCongestionPanel state={state}/>}\n    {detectingLoss ?",
)
replace_once(
    'src/JourneyTheaterV2.tsx',
    "  const retransmit = state.activeEvent.kind === 'transport.retransmit';\n  const layers =",
    "  const retransmit = state.activeEvent.kind === 'transport.retransmit';\n  const ecnMark = state.activeEvent.kind === 'transport.ecn-mark';\n  const layers =",
)
replace_once(
    'src/JourneyTheaterV2.tsx',
    "${retransmit ? 'packet-repair-scene' : ''}`}",
    "${retransmit ? 'packet-repair-scene' : ''} ${ecnMark ? 'packet-congestion-scene' : ''}`}",
)
replace_once(
    'src/JourneyTheaterV2.tsx',
    "</div>{(loss||retransmit)&&<div className=\"packet-impairment-card\">",
    "</div>{ecnMark&&<div className=\"packet-congestion-card\"><span>ECN CE MARK</span><strong>PACKET DELIVERED</strong><small>CONGESTION SIGNAL · NOT A DROP</small></div>}{(loss||retransmit)&&<div className=\"packet-impairment-card\">",
)
replace_once(
    'src/JourneyTheaterV2.tsx',
    "  const lossPhase = state.impairmentState === 'lost' || state.impairmentState === 'detected' || state.impairmentState === 'recovering';\n  const transportStateLabel = lossPhase ? `${state.transport.toUpperCase()} · ${state.impairmentState.toUpperCase()}` : state.transport.toUpperCase();",
    "  const transportImpairmentPhase = state.impairmentState === 'lost' || state.impairmentState === 'detected' || state.impairmentState === 'recovering' || state.impairmentState === 'queueing' || state.impairmentState === 'ecn-signaled' || state.impairmentState === 'congestion-responding';\n  const transportStateLabel = transportImpairmentPhase ? `${state.transport.toUpperCase()} · ${state.impairmentState.toUpperCase()}` : state.transport.toUpperCase();",
)
replace_once(
    'src/JourneyTheaterV2.tsx',
    "  const latencySelected = selectedModifiers.includes('latency-spike');",
    "  const latencySelected = selectedModifiers.includes('latency-spike');\n  const congestionSelected = selectedModifiers.includes('congestion');",
)
replace_once(
    'src/JourneyTheaterV2.tsx',
    "<button type=\"button\" className={outageSelected?'active':''} aria-pressed={outageSelected} onClick={()=>toggleModifier('path-outage')}>OUTAGE</button></div><button type=\"button\" className=\"context-button\"",
    "<button type=\"button\" className={outageSelected?'active':''} aria-pressed={outageSelected} onClick={()=>toggleModifier('path-outage')}>OUTAGE</button><button type=\"button\" className={congestionSelected?'active':''} aria-pressed={congestionSelected} onClick={()=>toggleModifier('congestion')}>CONGESTION</button></div><button type=\"button\" className=\"context-button\"",
)
replace_once(
    'src/JourneyTheaterV2.tsx',
    "className={lossSelected||latencySelected||outageSelected?toneClass:''}",
    "className={lossSelected||latencySelected||outageSelected||congestionSelected?toneClass:''}",
)
replace_once(
    'src/JourneyTheaterV2.tsx',
    "const routeEvent=isRouteFailureEvent(current.kind);return <button",
    "const routeEvent=isRouteFailureEvent(current.kind);const congestionEvent=isCongestionEvent(current.kind);return <button",
)
replace_once(
    'src/JourneyTheaterV2.tsx',
    "${routeEvent?'route-event':''}`} onClick",
    "${routeEvent?'route-event':''} ${congestionEvent?'congestion-event':''}`} onClick",
)
replace_once(
    'src/JourneyTheaterV2.tsx',
    "${isRouteFailureEvent(current.kind)?'route-marker':''}`} style=",
    "${isRouteFailureEvent(current.kind)?'route-marker':''} ${isCongestionEvent(current.kind)?'congestion-marker':''}`} style=",
)

# CSS — sixth control, congestion panel, rail/scrubber language, mobile 3x2 modifier grid.
append_once(
    'src/journey-god-mode.css',
    '.congestion-panel-wrap{',
    r'''

.journey-modifier-profile button:nth-child(6)[aria-pressed="true"]{background:rgba(96,176,255,.09);color:#acd6ff;box-shadow:inset 0 0 0 1px rgba(96,176,255,.28)}
.journey-impairment-profile{min-width:430px}
.congestion-panel-wrap{display:grid;gap:8px;width:100%}.congestion-queue{display:grid;gap:7px;padding:11px 12px;border:1px solid rgba(96,176,255,.16);border-radius:4px;background:rgba(96,176,255,.025)}.congestion-queue-heading,.congestion-queue-caption{display:flex;align-items:center;justify-content:space-between;gap:12px}.congestion-queue-heading span,.congestion-queue-caption span,.congestion-metrics span{color:#6f98bf;font-size:.42rem;font-weight:900;letter-spacing:.08em}.congestion-queue-heading strong,.congestion-queue-caption strong{color:#b8d9f7;font:700 .51rem ui-monospace,SFMono-Regular,Menlo,monospace}.congestion-queue-caption strong.overloaded{color:#ffb58f}.congestion-queue-caption strong.draining{color:#79f2da}.congestion-queue-track{height:9px;border:1px solid rgba(96,176,255,.16);border-radius:99px;overflow:hidden;background:#050a0e}.congestion-queue-track i{display:block;height:100%;background:linear-gradient(90deg,rgba(96,176,255,.45),rgba(96,176,255,.95));box-shadow:0 0 12px rgba(96,176,255,.28)}.congestion-metrics{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:6px}.congestion-metrics>div{display:grid;gap:4px;padding:9px;border:1px solid rgba(96,176,255,.11);border-radius:4px;background:rgba(4,8,11,.5)}.congestion-metrics strong{color:#b8d9f7;font:700 .52rem ui-monospace,SFMono-Regular,Menlo,monospace}.congestion-truth{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 11px;border:1px solid rgba(96,176,255,.16);border-radius:4px;background:rgba(96,176,255,.02)}.congestion-truth strong{color:#9dccfa;font-size:.46rem;letter-spacing:.075em}.congestion-truth small{color:#6c8296;font-size:.43rem}.journey-callout.congestion-callout{border-color:rgba(96,176,255,.22);box-shadow:inset 3px 0 0 rgba(96,176,255,.62)}.journey-stage-meta strong.congestion-active,.journey-state-strip strong.congestion-active{color:#8bc7ff}.journey-event.congestion-event{border-color:rgba(96,176,255,.06)}.journey-event.congestion-event.current{border-color:rgba(96,176,255,.32);background:rgba(96,176,255,.035)}.journey-scrubber i.congestion-marker{height:13px!important;top:-3px!important;background:#60b0ff!important;box-shadow:0 0 8px rgba(96,176,255,.42)}.packet-congestion-scene .packet-layers{border-color:rgba(96,176,255,.22)}.packet-congestion-card{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:12px;padding:12px 14px;border:1px solid rgba(96,176,255,.22);border-radius:5px;background:rgba(96,176,255,.025)}.packet-congestion-card span{color:#8bc7ff;font-size:.44rem;font-weight:950;letter-spacing:.1em}.packet-congestion-card strong{color:#c4e2ff;font:700 .6rem ui-monospace,SFMono-Regular,Menlo,monospace}.packet-congestion-card small{color:#7694b0;font-size:.43rem;font-weight:800;letter-spacing:.055em}
@media(max-width:1050px){.congestion-metrics{grid-template-columns:repeat(3,1fr)}}
@media(max-width:950px){.journey-modifier-profile{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));height:auto;min-width:0}.journey-modifier-profile button{height:30px}.congestion-truth{display:grid}.packet-congestion-card{grid-template-columns:1fr;text-align:center}}
@media(max-width:520px){.congestion-metrics{grid-template-columns:1fr 1fr}}
''',
)
