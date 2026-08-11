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


# Canonical model types and reducer state.
replace_once(
    'src/journey/model.ts',
    "export type JourneyModifierId = 'route-failure' | 'single-loss' | 'path-outage' | 'latency-spike' | 'congestion';",
    "export type JourneyModifierId = 'dns-failure' | 'route-failure' | 'single-loss' | 'path-outage' | 'latency-spike' | 'congestion';",
)
replace_once(
    'src/journey/model.ts',
    "  | 'dns.cache-store'\n  | 'route.lookup'",
    "  | 'dns.cache-store'\n  | 'dns.timeout'\n  | 'dns.retry'\n  | 'dns.failure-masked'\n  | 'route.lookup'",
)
replace_once(
    'src/journey/model.ts',
    "export type DnsJourneyState = 'idle' | 'cache-miss' | 'resolving' | 'resolved' | 'cached';",
    "export type DnsJourneyState = 'idle' | 'cache-miss' | 'resolving' | 'timeout' | 'retrying' | 'resolved' | 'cached';",
)
replace_once(
    'src/journey/model.ts',
    "export type JourneyImpairmentState = 'clean' | 'armed' | 'lost' | 'detected' | 'recovering' | 'recovered' | 'delayed' | 'estimating' | 'normalized' | 'queueing' | 'ecn-signaled' | 'congestion-responding' | 'route-failed' | 'route-recomputing' | 'route-ready';",
    "export type JourneyImpairmentState = 'clean' | 'armed' | 'dns-failed' | 'dns-retrying' | 'dns-masked' | 'lost' | 'detected' | 'recovering' | 'recovered' | 'delayed' | 'estimating' | 'normalized' | 'queueing' | 'ecn-signaled' | 'congestion-responding' | 'route-failed' | 'route-recomputing' | 'route-ready';",
)
replace_once(
    'src/journey/model.ts',
    "      case 'dns.query':\n      case 'dns.referral': dns = 'resolving'; break;\n      case 'dns.answer': dns = 'resolved'; resolvedAddress = scenario.destinationAddress; break;",
    "      case 'dns.query': dns = 'resolving'; break;\n      case 'dns.timeout':\n        dns = 'timeout';\n        impairmentState = 'dns-failed';\n        break;\n      case 'dns.retry':\n        dns = 'retrying';\n        impairmentState = 'dns-retrying';\n        break;\n      case 'dns.failure-masked':\n        impairmentState = 'dns-masked';\n        break;\n      case 'dns.referral':\n        dns = 'resolving';\n        if (impairmentState === 'dns-failed' || impairmentState === 'dns-retrying') impairmentState = 'normalized';\n        break;\n      case 'dns.answer': dns = 'resolved'; resolvedAddress = scenario.destinationAddress; break;",
)
replace_once(
    'src/journey/model.ts',
    "      case 'route.lookup': route = 'lookup'; break;",
    "      case 'route.lookup':\n        route = 'lookup';\n        if (impairmentState === 'dns-masked') impairmentState = 'normalized';\n        break;",
)

# Modifier pipeline: DNS failure is the earliest causal modifier.
replace_once(
    'src/journey/modifiers.ts',
    "const JOURNEY_MODIFIER_ORDER: readonly JourneyModifierId[] = ['route-failure', 'single-loss', 'path-outage', 'latency-spike', 'congestion'];",
    "const JOURNEY_MODIFIER_ORDER: readonly JourneyModifierId[] = ['dns-failure', 'route-failure', 'single-loss', 'path-outage', 'latency-spike', 'congestion'];",
)

dns_modifier = r'''

function dnsFailureMissEvents(recursiveAtMs: number): JourneyEvent[] {
  return [
    modifierEvent({
      id: 'dns-primary-timeout',
      atMs: recursiveAtMs + 600,
      kind: 'dns.timeout',
      scale: 'application',
      zoom: 'hold',
      protocol: 'DNS',
      phase: 'resolver-timeout',
      title: 'Primary recursive resolver does not answer',
      summary: 'The first recursive A-query attempt produces no DNS response before the teaching timeout.',
      detail: 'A timeout is the absence of a response. HOPSCOTCH does not turn silence into NXDOMAIN or SERVFAIL, because neither response was received.',
      actor: 'primary recursive resolver',
      target: 'stub resolver',
      detailLab: 'dns',
    }),
    modifierEvent({
      id: 'dns-secondary-retry',
      atMs: recursiveAtMs + 900,
      kind: 'dns.retry',
      scale: 'application',
      zoom: 'hold',
      protocol: 'DNS',
      phase: 'resolver-retry',
      title: 'Stub retries through a secondary recursive resolver',
      summary: 'The same logical A question is sent through the configured secondary recursive path after the primary attempt times out.',
      detail: 'This curated retry uses a new transaction context and a secondary recursive resolver. It is not a replayed DNS answer and does not imply that every operating system uses identical fallback timing.',
      actor: 'stub resolver',
      target: 'secondary recursive resolver',
      detailLab: 'dns',
    }),
  ];
}

function dnsFailureMaskedEvent(cacheHitAtMs: number): JourneyEvent {
  return modifierEvent({
    id: 'dns-outage-masked',
    atMs: cacheHitAtMs + 180,
    kind: 'dns.failure-masked',
    scale: 'application',
    zoom: 'hold',
    protocol: 'DNS',
    phase: 'outage-masked',
    title: 'Cache hit masks the upstream DNS outage',
    summary: 'The local cached answer is already usable, so the unavailable upstream resolver path is never consulted.',
    detail: 'No upstream query is required, so HOPSCOTCH does not fabricate a timeout packet, DNS retry, or resolver delay. The cached TTL continues to age normally.',
    actor: 'local DNS cache',
    target: 'application',
    detailLab: 'dns',
  });
}

const dnsFailureModifier: JourneyModifier = {
  id: 'dns-failure',
  order: 70,
  apply(events, context) {
    if (context.config.dnsProfile === 'cache-hit') {
      const cacheHit = events.find((current) => current.kind === 'dns.cache-hit');
      const routeLookup = events.find((current) => current.kind === 'route.lookup');
      if (!cacheHit || !routeLookup || cacheHit.atMs >= routeLookup.atMs) throw new Error('dns-failure cache-hit path requires cache hit before route lookup.');
      const masked = dnsFailureMaskedEvent(cacheHit.atMs);
      if (masked.atMs >= routeLookup.atMs) throw new Error('dns-failure masked event must remain before route lookup.');
      return {
        events: [...events, masked].sort((a, b) => a.atMs - b.atMs),
        addedDurationMs: 0,
        appliedModifierIds: ['dns-failure'],
      };
    }

    const recursive = events.find((current) => current.id === 'dns-recursive');
    const root = events.find((current) => current.id === 'dns-root');
    if (!recursive || !root || recursive.atMs >= root.atMs) throw new Error('dns-failure cache-miss path requires recursive query before root referral.');
    const addedDurationMs = 1200;
    const shifted = shiftPostAnchor(events, root.atMs, addedDurationMs);
    const injected = dnsFailureMissEvents(recursive.atMs);
    if (!(recursive.atMs < injected[0].atMs && injected[0].atMs < injected[1].atMs && injected[1].atMs < root.atMs + addedDurationMs)) {
      throw new Error('dns-failure must order query < timeout < retry < root referral.');
    }
    return {
      events: [...shifted, ...injected].sort((a, b) => a.atMs - b.atMs),
      addedDurationMs,
      appliedModifierIds: ['dns-failure'],
    };
  },
};
'''
replace_once(
    'src/journey/modifiers.ts',
    "const modifiers: JourneyModifier[] = [routeFailureModifier, singleLossModifier, pathOutageModifier, latencySpikeModifier, congestionModifier]",
    dns_modifier + "\nconst modifiers: JourneyModifier[] = [dnsFailureModifier, routeFailureModifier, singleLossModifier, pathOutageModifier, latencySpikeModifier, congestionModifier]",
)

# Portable schema/browser compatibility.
replace_once(
    'src/journey/scenario.ts',
    "const impairmentProfiles = new Set<JourneyLegacyImpairmentProfile>(['clean', 'single-loss', 'latency-spike', 'route-failure', 'path-outage', 'congestion']);",
    "const impairmentProfiles = new Set<JourneyLegacyImpairmentProfile>(['clean', 'dns-failure', 'single-loss', 'latency-spike', 'route-failure', 'path-outage', 'congestion']);",
)
replace_once(
    'src/journey/browser.ts',
    "storedImpairment === 'single-loss' || storedImpairment === 'latency-spike' || storedImpairment === 'route-failure' || storedImpairment === 'path-outage' || storedImpairment === 'congestion' ? storedImpairment : 'clean'",
    "storedImpairment === 'dns-failure' || storedImpairment === 'single-loss' || storedImpairment === 'latency-spike' || storedImpairment === 'route-failure' || storedImpairment === 'path-outage' || storedImpairment === 'congestion' ? storedImpairment : 'clean'",
)

# Journey UI semantics.
replace_once(
    'src/JourneyTheaterV2.tsx',
    "function isCongestionEvent(kind: string): boolean {\n  return kind === 'transport.queue-growth' || kind === 'transport.ecn-mark' || kind === 'transport.congestion-response' || kind === 'transport.congestion-cleared';\n}\n\nfunction modifierLabel",
    "function isCongestionEvent(kind: string): boolean {\n  return kind === 'transport.queue-growth' || kind === 'transport.ecn-mark' || kind === 'transport.congestion-response' || kind === 'transport.congestion-cleared';\n}\n\nfunction isDnsFailureEvent(kind: string): boolean {\n  return kind === 'dns.timeout' || kind === 'dns.retry' || kind === 'dns.failure-masked';\n}\n\nfunction modifierLabel",
)
replace_once(
    'src/JourneyTheaterV2.tsx',
    "  return modifierIds.map((id) => id === 'route-failure' ? 'ROUTE' : id === 'single-loss' ? 'LOSS' : id === 'latency-spike' ? 'LATENCY' : id === 'path-outage' ? 'OUTAGE' : 'CONGESTION').join(' + ');",
    "  return modifierIds.map((id) => id === 'dns-failure' ? 'DNS FAIL' : id === 'route-failure' ? 'ROUTE' : id === 'single-loss' ? 'LOSS' : id === 'latency-spike' ? 'LATENCY' : id === 'path-outage' ? 'OUTAGE' : 'CONGESTION').join(' + ');",
)
replace_once(
    'src/JourneyTheaterV2.tsx',
    "function stateToneClass(state: JourneyState): string {\n  if (state.impairmentState === 'lost'",
    "function stateToneClass(state: JourneyState): string {\n  if (state.impairmentState === 'dns-failed' || state.impairmentState === 'dns-retrying') return 'dns-failure-active';\n  if (state.impairmentState === 'dns-masked') return 'dns-masked-active';\n  if (state.impairmentState === 'lost'",
)
replace_once(
    'src/JourneyTheaterV2.tsx',
    "function calloutToneClass(state: JourneyState): string {\n  if (state.impairmentState === 'lost'",
    "function calloutToneClass(state: JourneyState): string {\n  if (state.impairmentState === 'dns-failed' || state.impairmentState === 'dns-retrying') return 'dns-failure-callout';\n  if (state.impairmentState === 'dns-masked') return 'dns-masked-callout';\n  if (state.impairmentState === 'lost'",
)

replace_once(
    'src/JourneyTheaterV2.tsx',
    "function DnsScene({ state, hostname, address }: { state: JourneyState; hostname: string; address: string }) {\n  if (state.dnsProfile === 'cache-hit') {",
    "function DnsScene({ state, hostname, address }: { state: JourneyState; hostname: string; address: string }) {\n  const timedOut = state.activeEvent.kind === 'dns.timeout';\n  const retrying = state.activeEvent.kind === 'dns.retry';\n  const masked = state.activeEvent.kind === 'dns.failure-masked';\n  if (state.dnsProfile === 'cache-hit') {",
)
replace_once(
    'src/JourneyTheaterV2.tsx',
    "      <div className=\"dns-upstream-idle\"><span>RECURSIVE · IDLE</span><span>ROOT · IDLE</span><span>TLD · IDLE</span><span>AUTH · IDLE</span></div>\n      <p>Cache hit · TTL {state.dnsTtlSeconds ?? '—'}s. No upstream DNS traffic is generated.</p>",
    "      <div className=\"dns-upstream-idle\"><span>RECURSIVE · IDLE</span><span>ROOT · IDLE</span><span>TLD · IDLE</span><span>AUTH · IDLE</span></div>\n      {masked&&<div className=\"dns-failure-banner masked\"><span>UPSTREAM OUTAGE MASKED</span><strong>LOCAL CACHE SATISFIES THE LOOKUP</strong><small>NO QUERY · NO TIMEOUT · NO RETRY</small></div>}\n      <p>{masked ? 'The selected upstream outage exists in the simulated environment, but this cached answer prevents any dependency on it.' : `Cache hit · TTL ${state.dnsTtlSeconds ?? '—'}s. No upstream DNS traffic is generated.`}</p>",
)
replace_once(
    'src/JourneyTheaterV2.tsx',
    "  return <div className=\"journey-scene dns-scene\"><div className=\"dns-chain\">{nodes.map((node,index)=><div key={node} className={index <= Math.min(4, Math.max(0, state.activeEventIndex - 1)) ? 'active' : ''}><i/><span>{node}</span></div>)}</div><div className=\"dns-answer\"><span>{hostname}</span><b>→</b><strong>{state.resolvedAddress ?? 'RESOLVING…'}</strong></div><p>{state.dns === 'cached' ? `Resolver cache holds ${address} · TTL ${state.dnsTtlSeconds ?? '—'}s.` : 'Recursive resolution is walking authority state.'}</p></div>;",
    "  return <div className=\"journey-scene dns-scene\"><div className=\"dns-chain\">{nodes.map((node,index)=><div key={node} className={index <= Math.min(4, Math.max(0, state.activeEventIndex - 1)) ? 'active' : ''}><i/><span>{node}</span></div>)}</div><div className=\"dns-answer\"><span>{hostname}</span><b>→</b><strong>{timedOut ? 'NO RESPONSE' : retrying ? 'RETRYING…' : state.resolvedAddress ?? 'RESOLVING…'}</strong></div>{(timedOut||retrying)&&<div className={`dns-failure-banner ${retrying?'retrying':'timeout'}`}><span>{timedOut?'PRIMARY RECURSIVE · TIMEOUT':'SECONDARY RECURSIVE · RETRY'}</span><strong>{timedOut?'NO DNS ANSWER RECEIVED':'SAME A QUESTION · NEW TRANSACTION CONTEXT'}</strong><small>{timedOut?'SILENCE ≠ NXDOMAIN / SERVFAIL':'AUTHORITY WALK RESUMES AFTER RETRY'}</small></div>}<p>{timedOut ? 'The first recursive attempt is silent; no DNS answer exists to interpret.' : retrying ? 'The stub has moved the logical lookup to a secondary recursive resolver.' : state.dns === 'cached' ? `Resolver cache holds ${address} · TTL ${state.dnsTtlSeconds ?? '—'}s.` : 'Recursive resolution is walking authority state.'}</p></div>;",
)

replace_once(
    'src/JourneyTheaterV2.tsx',
    "  const congestionSelected = selectedModifiers.includes('congestion');",
    "  const congestionSelected = selectedModifiers.includes('congestion');\n  const dnsFailureSelected = selectedModifiers.includes('dns-failure');",
)
replace_once(
    'src/JourneyTheaterV2.tsx',
    "<button type=\"button\" className={congestionSelected?'active':''} aria-pressed={congestionSelected} onClick={()=>toggleModifier('congestion')}>CONGESTION</button></div><button type=\"button\" className=\"context-button\"",
    "<button type=\"button\" className={congestionSelected?'active':''} aria-pressed={congestionSelected} onClick={()=>toggleModifier('congestion')}>CONGESTION</button><button type=\"button\" className={dnsFailureSelected?'active':''} aria-pressed={dnsFailureSelected} onClick={()=>toggleModifier('dns-failure')}>DNS FAIL</button></div><button type=\"button\" className=\"context-button\"",
)
replace_once(
    'src/JourneyTheaterV2.tsx',
    "<div className=\"journey-state-strip\"><div><span>DNS</span><strong>{dnsStateLabel}</strong></div>",
    "<div className=\"journey-state-strip\"><div><span>DNS</span><strong className={dnsFailureSelected?toneClass:''}>{dnsStateLabel}</strong></div>",
)
replace_once(
    'src/JourneyTheaterV2.tsx',
    "const congestionEvent=isCongestionEvent(current.kind);return <button",
    "const congestionEvent=isCongestionEvent(current.kind);const dnsFailureEvent=isDnsFailureEvent(current.kind);return <button",
)
replace_once(
    'src/JourneyTheaterV2.tsx',
    "${congestionEvent?'congestion-event':''}`} onClick",
    "${congestionEvent?'congestion-event':''} ${dnsFailureEvent?'dns-failure-event':''}`} onClick",
)
replace_once(
    'src/JourneyTheaterV2.tsx',
    "${isCongestionEvent(current.kind)?'congestion-marker':''}`} style=",
    "${isCongestionEvent(current.kind)?'congestion-marker':''} ${isDnsFailureEvent(current.kind)?'dns-failure-marker':''}`} style=",
)

# Visual language and 7-control mobile layout.
append_once(
    'src/journey-god-mode.css',
    '.dns-failure-banner{',
    r'''

.journey-modifier-profile button:nth-child(7)[aria-pressed="true"]{background:rgba(240,140,255,.09);color:#f2b7ff;box-shadow:inset 0 0 0 1px rgba(240,140,255,.28)}
.dns-failure-banner{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:12px;padding:11px 12px;border:1px solid rgba(240,140,255,.22);border-radius:4px;background:rgba(240,140,255,.025)}.dns-failure-banner span{color:#ed9cff;font-size:.43rem;font-weight:950;letter-spacing:.09em}.dns-failure-banner strong{color:#efc8f7;font:700 .52rem ui-monospace,SFMono-Regular,Menlo,monospace;text-align:center}.dns-failure-banner small{color:#9875a0;font-size:.42rem;font-weight:850;letter-spacing:.055em;text-align:right}.dns-failure-banner.retrying{border-color:rgba(122,156,255,.22);background:rgba(122,156,255,.025)}.dns-failure-banner.retrying span{color:#aabaff}.dns-failure-banner.retrying strong{color:#c8d2ff}.dns-failure-banner.masked{border-color:rgba(121,242,218,.2);background:rgba(121,242,218,.022)}.dns-failure-banner.masked span{color:#79f2da}.dns-failure-banner.masked strong{color:#bdeee5}.dns-failure-banner.masked small{color:#6b958d}.journey-stage-meta strong.dns-failure-active,.journey-state-strip strong.dns-failure-active{color:#ef9fff}.journey-stage-meta strong.dns-masked-active,.journey-state-strip strong.dns-masked-active{color:#79f2da}.journey-callout.dns-failure-callout{border-color:rgba(240,140,255,.24);box-shadow:inset 3px 0 0 rgba(240,140,255,.62)}.journey-callout.dns-masked-callout{border-color:rgba(121,242,218,.22);box-shadow:inset 3px 0 0 rgba(121,242,218,.58)}.journey-event.dns-failure-event{border-color:rgba(240,140,255,.06)}.journey-event.dns-failure-event.current{border-color:rgba(240,140,255,.32);background:rgba(240,140,255,.035)}.journey-scrubber i.dns-failure-marker{height:13px!important;top:-3px!important;background:#f08cff!important;box-shadow:0 0 8px rgba(240,140,255,.42)}
@media(max-width:950px){.journey-modifier-profile{grid-template-columns:repeat(4,minmax(0,1fr))}.dns-failure-banner{grid-template-columns:1fr;text-align:center}.dns-failure-banner small{text-align:center}}
@media(max-width:420px){.journey-modifier-profile button{font-size:.44rem;padding:0 4px}}
''',
)
