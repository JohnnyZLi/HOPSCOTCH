from pathlib import Path


def replace_once(path, old, new):
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise SystemExit(f'missing patch anchor in {path}: {old[:140]!r}')
    file.write_text(text.replace(old, new, 1))


def append_once(path, marker, addition):
    file = Path(path)
    text = file.read_text()
    if marker in text:
        return
    file.write_text(text + addition)


# Model types and reducer state.
replace_once(
    'src/journey/model.ts',
    "export type JourneyModifierId = 'dns-failure' | 'route-failure' | 'single-loss' | 'path-outage' | 'latency-spike' | 'congestion';",
    "export type JourneyModifierId = 'dns-failure' | 'route-failure' | 'server-failure' | 'single-loss' | 'path-outage' | 'latency-spike' | 'congestion';",
)
replace_once(
    'src/journey/model.ts',
    "  | 'http.request'\n  | 'http.response'",
    "  | 'http.request'\n  | 'server.unavailable'\n  | 'http.service-unavailable'\n  | 'http.retry-wait'\n  | 'server.recovered'\n  | 'http.retry'\n  | 'http.response'",
)
replace_once(
    'src/journey/model.ts',
    "export interface JourneyRouteMetrics {\n  primaryPathCost: number;",
    "export interface JourneyServerMetrics {\n  statusCode?: 503;\n  retryAfterMs: number;\n  requestMethod: 'GET';\n  idempotent: boolean;\n  retrySafe: boolean;\n  transportReused: boolean;\n}\n\nexport interface JourneyRouteMetrics {\n  primaryPathCost: number;",
)
replace_once(
    'src/journey/model.ts',
    "  congestionMetrics?: JourneyCongestionMetrics;\n  routeMetrics?: JourneyRouteMetrics;",
    "  congestionMetrics?: JourneyCongestionMetrics;\n  serverMetrics?: JourneyServerMetrics;\n  routeMetrics?: JourneyRouteMetrics;",
)
replace_once(
    'src/journey/model.ts',
    "export type HttpJourneyState = 'idle' | 'control' | 'request-sent' | 'headers' | 'streaming' | 'complete';",
    "export type HttpJourneyState = 'idle' | 'control' | 'request-sent' | 'service-unavailable' | 'retry-wait' | 'headers' | 'streaming' | 'complete';\nexport type ServerJourneyState = 'healthy' | 'unavailable' | 'waiting' | 'ready';",
)
replace_once(
    'src/journey/model.ts',
    "export type JourneyImpairmentState = 'clean' | 'armed' | 'dns-failed' | 'dns-retrying' | 'dns-masked' | 'lost'",
    "export type JourneyImpairmentState = 'clean' | 'armed' | 'dns-failed' | 'dns-retrying' | 'dns-masked' | 'server-unavailable' | 'server-waiting' | 'server-ready' | 'lost'",
)
replace_once(
    'src/journey/model.ts',
    "  congestionMetrics: JourneyCongestionMetrics | null;\n  routeMetrics: JourneyRouteMetrics | null;",
    "  congestionMetrics: JourneyCongestionMetrics | null;\n  serverMetrics: JourneyServerMetrics | null;\n  routeMetrics: JourneyRouteMetrics | null;",
)
replace_once(
    'src/journey/model.ts',
    "  http: HttpJourneyState;\n  packet: PacketJourneyState;",
    "  http: HttpJourneyState;\n  server: ServerJourneyState;\n  packet: PacketJourneyState;",
)
replace_once(
    'src/journey/model.ts',
    "  let http: HttpJourneyState = 'idle';\n  let packet: PacketJourneyState = 'idle';",
    "  let http: HttpJourneyState = 'idle';\n  let server: ServerJourneyState = 'healthy';\n  let packet: PacketJourneyState = 'idle';",
)
replace_once(
    'src/journey/model.ts',
    "  let congestionMetrics: JourneyCongestionMetrics | null = null;\n  let routeMetrics: JourneyRouteMetrics | null = null;",
    "  let congestionMetrics: JourneyCongestionMetrics | null = null;\n  let serverMetrics: JourneyServerMetrics | null = null;\n  let routeMetrics: JourneyRouteMetrics | null = null;",
)
replace_once(
    'src/journey/model.ts',
    "      case 'http.control': http = 'control'; break;\n      case 'http.request': http = 'request-sent'; break;\n      case 'http.response': http = 'headers'; break;",
    "      case 'http.control': http = 'control'; break;\n      case 'http.request': http = 'request-sent'; break;\n      case 'server.unavailable':\n        server = 'unavailable';\n        impairmentState = 'server-unavailable';\n        serverMetrics = current.serverMetrics ?? serverMetrics;\n        break;\n      case 'http.service-unavailable':\n        server = 'unavailable';\n        http = 'service-unavailable';\n        impairmentState = 'server-unavailable';\n        serverMetrics = current.serverMetrics ?? serverMetrics;\n        break;\n      case 'http.retry-wait':\n        server = 'waiting';\n        http = 'retry-wait';\n        impairmentState = 'server-waiting';\n        serverMetrics = current.serverMetrics ?? serverMetrics;\n        break;\n      case 'server.recovered':\n        server = 'ready';\n        impairmentState = 'server-ready';\n        serverMetrics = current.serverMetrics ?? serverMetrics;\n        break;\n      case 'http.retry':\n        server = 'ready';\n        http = 'request-sent';\n        impairmentState = 'server-ready';\n        serverMetrics = current.serverMetrics ?? serverMetrics;\n        break;\n      case 'http.response':\n        http = 'headers';\n        if (impairmentState === 'server-ready') { server = 'healthy'; impairmentState = 'normalized'; }\n        break;",
)
replace_once(
    'src/journey/model.ts',
    "    congestionMetrics,\n    routeMetrics,",
    "    congestionMetrics,\n    serverMetrics,\n    routeMetrics,",
)
replace_once(
    'src/journey/model.ts',
    "    tls,\n    http,\n    packet,",
    "    tls,\n    http,\n    server,\n    packet,",
)

# Modifier pipeline and deterministic HTTP 503 episode.
replace_once(
    'src/journey/modifiers.ts',
    "  JourneyRouteMetrics,\n  JourneyScale,",
    "  JourneyRouteMetrics,\n  JourneyServerMetrics,\n  JourneyScale,",
)
replace_once(
    'src/journey/modifiers.ts',
    "const JOURNEY_MODIFIER_ORDER: readonly JourneyModifierId[] = ['dns-failure', 'route-failure', 'single-loss', 'path-outage', 'latency-spike', 'congestion'];",
    "const JOURNEY_MODIFIER_ORDER: readonly JourneyModifierId[] = ['dns-failure', 'route-failure', 'server-failure', 'single-loss', 'path-outage', 'latency-spike', 'congestion'];",
)
replace_once(
    'src/journey/modifiers.ts',
    "  congestionMetrics?: JourneyCongestionMetrics;\n  routeMetrics?: JourneyRouteMetrics;",
    "  congestionMetrics?: JourneyCongestionMetrics;\n  serverMetrics?: JourneyServerMetrics;\n  routeMetrics?: JourneyRouteMetrics;",
)

server_code = r'''

function serverMetrics(input: Partial<JourneyServerMetrics> = {}): JourneyServerMetrics {
  return {
    statusCode: 503,
    retryAfterMs: 1000,
    requestMethod: 'GET',
    idempotent: true,
    retrySafe: true,
    transportReused: true,
    ...input,
  };
}

function serverFailureEvents(requestAtMs: number, transportProfile: JourneyTransportProfile): JourneyEvent[] {
  const protocol = transportProfile === 'quic-h3' ? 'HTTP/3' : 'HTTP/2';
  const detailLab = 'http' as const;
  return [
    modifierEvent({
      id: 'server-service-unavailable',
      atMs: requestAtMs + 180,
      kind: 'server.unavailable',
      scale: 'application',
      zoom: 'hold',
      protocol,
      phase: 'service-unavailable',
      title: 'The application service becomes temporarily unavailable',
      summary: 'The request reached a healthy network endpoint, but the application service cannot produce the successful representation yet.',
      detail: 'DNS, IP routing, the established transport connection, and TLS keys remain valid. This failure lives at the HTTP/application boundary.',
      actor: 'application service',
      target: 'HTTP request',
      detailLab,
      serverMetrics: serverMetrics(),
    }),
    modifierEvent({
      id: 'server-http-503',
      atMs: requestAtMs + 340,
      kind: 'http.service-unavailable',
      scale: 'application',
      zoom: 'hold',
      protocol,
      phase: 'http-503',
      title: 'HTTP 503 Service Unavailable returns',
      summary: 'The reachable server returns a real HTTP 503 response with Retry-After: 1.',
      detail: 'Unlike DNS timeout silence, this is an application-layer response. The server is reachable enough to return status and retry guidance on the existing connection.',
      actor: 'HTTP server',
      target: 'browser',
      detailLab,
      serverMetrics: serverMetrics(),
    }),
    modifierEvent({
      id: 'server-retry-wait',
      atMs: requestAtMs + 520,
      kind: 'http.retry-wait',
      scale: 'application',
      zoom: 'hold',
      protocol,
      phase: 'retry-wait',
      title: 'Client honors Retry-After before replaying the GET',
      summary: 'The teaching client waits one second instead of hammering the unavailable service.',
      detail: 'The connection remains established during the wait. Retry safety comes from this canonical GET being idempotent; arbitrary requests must not be assumed safe to replay.',
      actor: 'browser',
      target: 'HTTP server',
      detailLab,
      serverMetrics: serverMetrics(),
    }),
    modifierEvent({
      id: 'server-service-ready',
      atMs: requestAtMs + 1240,
      kind: 'server.recovered',
      scale: 'application',
      zoom: 'hold',
      protocol,
      phase: 'service-ready',
      title: 'The application service becomes ready again',
      summary: 'Server-side availability recovers while the original client transport and TLS session remain usable.',
      detail: 'No DNS lookup, route change, TCP/QUIC handshake, or TLS handshake is needed to represent this service recovery.',
      actor: 'application service',
      target: 'HTTP endpoint',
      detailLab,
      serverMetrics: serverMetrics({ statusCode: undefined }),
    }),
    modifierEvent({
      id: 'server-get-retry',
      atMs: requestAtMs + 1340,
      kind: 'http.retry',
      scale: 'application',
      zoom: 'hold',
      protocol,
      phase: 'safe-get-retry',
      title: 'The idempotent GET is retried on the same connection',
      summary: 'Exactly one second after the 503, the canonical GET / is replayed using the already-established transport and TLS state.',
      detail: 'This teaching retry is safe because GET is idempotent. HOPSCOTCH does not imply arbitrary requests, especially non-idempotent writes, can always be retried automatically.',
      actor: 'browser',
      target: 'HTTP server',
      detailLab,
      serverMetrics: serverMetrics({ statusCode: undefined }),
    }),
  ];
}

const serverFailureModifier: JourneyModifier = {
  id: 'server-failure',
  order: 95,
  apply(events, context) {
    const request = events.find((current) => current.kind === 'http.request');
    const response = events.find((current) => current.kind === 'http.response');
    if (!request || !response || request.atMs >= response.atMs) throw new Error('server-failure requires an HTTP request before the successful response.');
    const addedDurationMs = 1700;
    const shifted = shiftPostAnchor(events, response.atMs, addedDurationMs);
    const injected = serverFailureEvents(request.atMs, context.config.transportProfile);
    const retry = injected.find((current) => current.kind === 'http.retry');
    if (!retry || retry.atMs >= response.atMs + addedDurationMs) throw new Error('server-failure retry must finish before successful response headers.');
    return {
      events: [...shifted, ...injected].sort((a, b) => a.atMs - b.atMs),
      addedDurationMs,
      appliedModifierIds: ['server-failure'],
    };
  },
};
'''
replace_once(
    'src/journey/modifiers.ts',
    "const modifiers: JourneyModifier[] = [dnsFailureModifier, routeFailureModifier, singleLossModifier, pathOutageModifier, latencySpikeModifier, congestionModifier]",
    server_code + "\nconst modifiers: JourneyModifier[] = [dnsFailureModifier, routeFailureModifier, serverFailureModifier, singleLossModifier, pathOutageModifier, latencySpikeModifier, congestionModifier]",
)

# Portable schema/browser compatibility.
replace_once(
    'src/journey/scenario.ts',
    "const impairmentProfiles = new Set<JourneyLegacyImpairmentProfile>(['clean', 'dns-failure', 'single-loss', 'latency-spike', 'route-failure', 'path-outage', 'congestion']);",
    "const impairmentProfiles = new Set<JourneyLegacyImpairmentProfile>(['clean', 'dns-failure', 'server-failure', 'single-loss', 'latency-spike', 'route-failure', 'path-outage', 'congestion']);",
)
replace_once(
    'src/journey/browser.ts',
    "storedImpairment === 'dns-failure' || storedImpairment === 'single-loss' || storedImpairment === 'latency-spike' || storedImpairment === 'route-failure' || storedImpairment === 'path-outage' || storedImpairment === 'congestion' ? storedImpairment : 'clean'",
    "storedImpairment === 'dns-failure' || storedImpairment === 'server-failure' || storedImpairment === 'single-loss' || storedImpairment === 'latency-spike' || storedImpairment === 'route-failure' || storedImpairment === 'path-outage' || storedImpairment === 'congestion' ? storedImpairment : 'clean'",
)

# Journey theater wiring.
replace_once(
    'src/JourneyTheaterV2.tsx',
    "import { JourneyCongestionPanel } from './JourneyCongestionPanel';",
    "import { JourneyCongestionPanel } from './JourneyCongestionPanel';\nimport { JourneyServerFailurePanel } from './JourneyServerFailurePanel';",
)
replace_once(
    'src/JourneyTheaterV2.tsx',
    "function isDnsFailureEvent(kind: string): boolean {\n  return kind === 'dns.timeout' || kind === 'dns.retry' || kind === 'dns.failure-masked';\n}\n\nfunction modifierLabel",
    "function isDnsFailureEvent(kind: string): boolean {\n  return kind === 'dns.timeout' || kind === 'dns.retry' || kind === 'dns.failure-masked';\n}\n\nfunction isServerFailureEvent(kind: string): boolean {\n  return kind === 'server.unavailable' || kind === 'http.service-unavailable' || kind === 'http.retry-wait' || kind === 'server.recovered' || kind === 'http.retry';\n}\n\nfunction modifierLabel",
)
replace_once(
    'src/JourneyTheaterV2.tsx',
    "  return modifierIds.map((id) => id === 'dns-failure' ? 'DNS FAIL' : id === 'route-failure' ? 'ROUTE' : id === 'single-loss' ? 'LOSS' : id === 'latency-spike' ? 'LATENCY' : id === 'path-outage' ? 'OUTAGE' : 'CONGESTION').join(' + ');",
    "  return modifierIds.map((id) => id === 'dns-failure' ? 'DNS FAIL' : id === 'route-failure' ? 'ROUTE' : id === 'server-failure' ? 'SERVER' : id === 'single-loss' ? 'LOSS' : id === 'latency-spike' ? 'LATENCY' : id === 'path-outage' ? 'OUTAGE' : 'CONGESTION').join(' + ');",
)
replace_once(
    'src/JourneyTheaterV2.tsx',
    "  if (state.impairmentState === 'dns-masked') return 'dns-masked-active';",
    "  if (state.impairmentState === 'dns-masked') return 'dns-masked-active';\n  if (state.impairmentState === 'server-unavailable' || state.impairmentState === 'server-waiting') return 'server-failure-active';\n  if (state.impairmentState === 'server-ready') return 'server-ready-active';",
)
replace_once(
    'src/JourneyTheaterV2.tsx',
    "  if (state.impairmentState === 'dns-masked') return 'dns-masked-callout';",
    "  if (state.impairmentState === 'dns-masked') return 'dns-masked-callout';\n  if (state.impairmentState === 'server-unavailable' || state.impairmentState === 'server-waiting') return 'server-failure-callout';\n  if (state.impairmentState === 'server-ready') return 'server-ready-callout';",
)
replace_once(
    'src/JourneyTheaterV2.tsx',
    "function HttpScene({ state, hostname }: { state: JourneyState; hostname: string }) {\n  const h3 = state.transportProfile === 'quic-h3';\n  const recovered = state.activeEvent.kind === 'transport.recovered';",
    "function HttpScene({ state, hostname }: { state: JourneyState; hostname: string }) {\n  const h3 = state.transportProfile === 'quic-h3';\n  const recovered = state.activeEvent.kind === 'transport.recovered';\n  const serverEpisode = isServerFailureEvent(state.activeEvent.kind);",
)
replace_once(
    'src/JourneyTheaterV2.tsx',
    "  const progress = recovered ? 84 : state.http === 'streaming' ? 72 : state.http === 'complete' ? 100 : state.http === 'headers' ? 34 : state.http === 'request-sent' ? 16 : 5;",
    "  const progress = recovered ? 84 : serverEpisode ? (state.activeEvent.kind === 'http.retry' ? 24 : 18) : state.http === 'streaming' ? 72 : state.http === 'complete' ? 100 : state.http === 'headers' ? 34 : state.http === 'request-sent' ? 16 : 5;",
)
replace_once(
    'src/JourneyTheaterV2.tsx',
    "  const payloadLabel = recovered ? 'DELIVERY RESUMES' : state.http === 'request-sent' ? `GET / · ${hostname}` : state.http === 'headers' ? ':status 200' : state.http === 'streaming' || state.http === 'complete' ? 'RESPONSE DATA' : h3 ? 'CONTROL + QPACK' : 'SETTINGS';",
    "  const payloadLabel = recovered ? 'DELIVERY RESUMES' : state.activeEvent.kind === 'http.service-unavailable' ? ':status 503 · Retry-After: 1' : state.activeEvent.kind === 'http.retry-wait' ? 'WAITING · RETRY-AFTER' : state.activeEvent.kind === 'server.recovered' ? 'SERVICE READY' : state.activeEvent.kind === 'http.retry' ? `RETRY GET / · ${hostname}` : state.activeEvent.kind === 'server.unavailable' ? 'SERVICE UNAVAILABLE' : state.http === 'request-sent' ? `GET / · ${hostname}` : state.http === 'headers' ? ':status 200' : state.http === 'streaming' || state.http === 'complete' ? 'RESPONSE DATA' : h3 ? 'CONTROL + QPACK' : 'SETTINGS';",
)
replace_once(
    'src/JourneyTheaterV2.tsx',
    "<div className=\"http-request-line\"><span>{protocol}</span><strong>{payloadLabel}</strong></div>{recovered&&",
    "<div className=\"http-request-line\"><span>{protocol}</span><strong>{payloadLabel}</strong></div>{serverEpisode&&<JourneyServerFailurePanel state={state}/>} {recovered&&",
)
replace_once(
    'src/JourneyTheaterV2.tsx',
    "<p>{recovered ? (h3 ? 'The missing QUIC STREAM range has arrived in a new packet number; this request stream can advance again.' : 'TCP repaired the missing byte range; HTTP/2 can consume the ordered byte stream again.') : h3 ? 'HTTP/3 maps request/response data to QUIC streams; there is no TCP connection beneath it.' : 'Application frames remain encrypted on the wire and inherit TCP delivery behavior.'}</p>",
    "<p>{serverEpisode ? (state.activeEvent.kind === 'http.service-unavailable' ? 'The server returned a real HTTP 503 response while the existing connection stayed healthy.' : state.activeEvent.kind === 'http.retry' ? 'The canonical idempotent GET is replayed on the same established transport and TLS state.' : 'Application availability changes without becoming a routing, transport, or TLS failure.') : recovered ? (h3 ? 'The missing QUIC STREAM range has arrived in a new packet number; this request stream can advance again.' : 'TCP repaired the missing byte range; HTTP/2 can consume the ordered byte stream again.') : h3 ? 'HTTP/3 maps request/response data to QUIC streams; there is no TCP connection beneath it.' : 'Application frames remain encrypted on the wire and inherit TCP delivery behavior.'}</p>",
)
replace_once(
    'src/JourneyTheaterV2.tsx',
    "  const dnsFailureSelected = selectedModifiers.includes('dns-failure');",
    "  const dnsFailureSelected = selectedModifiers.includes('dns-failure');\n  const serverFailureSelected = selectedModifiers.includes('server-failure');",
)
replace_once(
    'src/JourneyTheaterV2.tsx',
    "<button type=\"button\" className={dnsFailureSelected?'active':''} aria-pressed={dnsFailureSelected} onClick={()=>toggleModifier('dns-failure')}>DNS FAIL</button></div><button type=\"button\" className=\"context-button\"",
    "<button type=\"button\" className={dnsFailureSelected?'active':''} aria-pressed={dnsFailureSelected} onClick={()=>toggleModifier('dns-failure')}>DNS FAIL</button><button type=\"button\" className={serverFailureSelected?'active':''} aria-pressed={serverFailureSelected} onClick={()=>toggleModifier('server-failure')}>SERVER</button></div><button type=\"button\" className=\"context-button\"",
)
replace_once(
    'src/JourneyTheaterV2.tsx',
    "const dnsFailureEvent=isDnsFailureEvent(current.kind);return <button",
    "const dnsFailureEvent=isDnsFailureEvent(current.kind);const serverFailureEvent=isServerFailureEvent(current.kind);return <button",
)
replace_once(
    'src/JourneyTheaterV2.tsx',
    "${dnsFailureEvent?'dns-failure-event':''}`} onClick",
    "${dnsFailureEvent?'dns-failure-event':''} ${serverFailureEvent?'server-failure-event':''}`} onClick",
)
replace_once(
    'src/JourneyTheaterV2.tsx',
    "${isDnsFailureEvent(current.kind)?'dns-failure-marker':''}`} style=",
    "${isDnsFailureEvent(current.kind)?'dns-failure-marker':''} ${isServerFailureEvent(current.kind)?'server-failure-marker':''}`} style=",
)

# Visual language. Eight controls naturally form 4x2 below 950px.
append_once(
    'src/journey-god-mode.css',
    '.server-failure-panel-wrap{',
    r'''

.journey-modifier-profile button:nth-child(8)[aria-pressed="true"]{background:rgba(194,230,105,.09);color:#d7f1a0;box-shadow:inset 0 0 0 1px rgba(194,230,105,.28)}
.server-failure-panel-wrap{display:grid;gap:8px;width:100%}.server-failure-status{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:12px;padding:11px 12px;border:1px solid rgba(194,230,105,.2);border-radius:4px;background:rgba(194,230,105,.022)}.server-failure-status span{color:#b6d66d;font-size:.42rem;font-weight:950;letter-spacing:.09em}.server-failure-status strong{color:#d7edaa;font:700 .57rem ui-monospace,SFMono-Regular,Menlo,monospace;text-align:center}.server-failure-status small{color:#82945d;font-size:.42rem;font-weight:850;letter-spacing:.055em;text-align:right}.server-failure-status.failed{border-color:rgba(255,158,112,.22);background:rgba(255,158,112,.022)}.server-failure-status.failed span{color:#ffb48f}.server-failure-status.failed strong{color:#f1c4ad}.server-failure-status.waiting{border-color:rgba(242,200,121,.22);background:rgba(242,200,121,.022)}.server-failure-status.waiting span{color:#e7c876}.server-failure-status.waiting strong{color:#e7d4a5}.server-failure-metrics{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:6px}.server-failure-metrics>div{display:grid;gap:4px;padding:9px;border:1px solid rgba(194,230,105,.11);border-radius:4px;background:rgba(4,8,11,.5)}.server-failure-metrics span{color:#81965b;font-size:.41rem;font-weight:900;letter-spacing:.075em}.server-failure-metrics strong{color:#cfe59c;font:700 .5rem ui-monospace,SFMono-Regular,Menlo,monospace}.server-failure-truth{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 11px;border:1px solid rgba(194,230,105,.15);border-radius:4px;background:rgba(194,230,105,.018)}.server-failure-truth strong{color:#c7df90;font-size:.45rem;letter-spacing:.075em}.server-failure-truth small{color:#7c8b64;font-size:.42rem}.journey-stage-meta strong.server-failure-active{color:#ffb48f}.journey-stage-meta strong.server-ready-active{color:#c2e669}.journey-callout.server-failure-callout{border-color:rgba(255,158,112,.23);box-shadow:inset 3px 0 0 rgba(255,158,112,.58)}.journey-callout.server-ready-callout{border-color:rgba(194,230,105,.23);box-shadow:inset 3px 0 0 rgba(194,230,105,.58)}.journey-event.server-failure-event{border-color:rgba(194,230,105,.06)}.journey-event.server-failure-event.current{border-color:rgba(194,230,105,.3);background:rgba(194,230,105,.032)}.journey-scrubber i.server-failure-marker{height:13px!important;top:-3px!important;background:#c2e669!important;box-shadow:0 0 8px rgba(194,230,105,.4)}
@media(max-width:1050px){.server-failure-metrics{grid-template-columns:repeat(3,1fr)}}
@media(max-width:950px){.server-failure-status{grid-template-columns:1fr;text-align:center}.server-failure-status small{text-align:center}.server-failure-truth{display:grid}.journey-modifier-profile{grid-template-columns:repeat(4,minmax(0,1fr))}}
@media(max-width:520px){.server-failure-metrics{grid-template-columns:1fr 1fr}}
''',
)
