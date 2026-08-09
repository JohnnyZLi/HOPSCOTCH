export type DnsMode = 'miss' | 'hit';
export type DnsActorId = 'stub' | 'recursive' | 'root' | 'tld' | 'authoritative' | 'cache';
export type DnsMessageKind = 'query' | 'referral' | 'answer' | 'cache.miss' | 'cache.store' | 'cache.hit' | 'deliver';
export type DnsSeverity = 'info' | 'warning' | 'success';
export type DnsPhase = 'stub-query' | 'cache-check' | 'root' | 'tld' | 'authoritative' | 'cache-store' | 'deliver' | 'cache-hit' | 'complete';

export type DnsRecord = {
  owner: string;
  type: 'A' | 'NS';
  value: string;
  ttl: number;
};

export type DnsEvent = {
  id: string;
  atMs: number;
  kind: DnsMessageKind;
  from: DnsActorId;
  to: DnsActorId;
  title: string;
  summary: string;
  detail: string;
  severity: DnsSeverity;
  phase: DnsPhase;
  qname?: string;
  qtype?: 'A';
  recursionDesired?: boolean;
  authoritative?: boolean;
  records?: readonly DnsRecord[];
  delegation?: string;
};

export type DnsScenario = {
  mode: DnsMode;
  durationMs: number;
  events: readonly DnsEvent[];
  initialCacheAgeSeconds: number | null;
};

export type DnsState = {
  timeMs: number;
  phase: DnsPhase;
  phaseLabel: string;
  activeDelegation: string;
  cacheState: 'empty' | 'stored' | 'hit';
  cacheTtlSeconds: number | null;
  answer: DnsRecord | null;
  latestEventId: string;
};

export const DNS_QNAME = 'www.example.test';
export const DNS_ANSWER = '203.0.113.42';
export const DNS_TTL_SECONDS = 300;

const ROOT_REFERRAL: DnsRecord = { owner: 'test.', type: 'NS', value: 'ns.test.invalid.', ttl: 86400 };
const TLD_REFERRAL: DnsRecord = { owner: 'example.test.', type: 'NS', value: 'ns1.example.test.', ttl: 3600 };
const A_RECORD: DnsRecord = { owner: `${DNS_QNAME}.`, type: 'A', value: DNS_ANSWER, ttl: DNS_TTL_SECONDS };

const missEvents: readonly DnsEvent[] = [
  {
    id: 'stub-query', atMs: 0, kind: 'query', from: 'stub', to: 'recursive', phase: 'stub-query', severity: 'info',
    title: 'Stub asks for a recursive answer', summary: `${DNS_QNAME} A leaves the client with RD=1.`,
    detail: 'The application-facing stub resolver asks its configured recursive resolver to finish the job. Recursion Desired is set on this client-to-resolver query.',
    qname: DNS_QNAME, qtype: 'A', recursionDesired: true, delegation: '.',
  },
  {
    id: 'cache-miss', atMs: 350, kind: 'cache.miss', from: 'recursive', to: 'cache', phase: 'cache-check', severity: 'warning',
    title: 'Recursive cache misses', summary: 'No usable answer or delegation is cached for this teaching query.',
    detail: 'Because the recursive resolver cannot answer from cache, it starts iterative resolution. Upstream queries are not asking those servers to recurse on its behalf.',
    qname: DNS_QNAME, qtype: 'A', delegation: '.',
  },
  {
    id: 'ask-root', atMs: 650, kind: 'query', from: 'recursive', to: 'root', phase: 'root', severity: 'info',
    title: 'Recursive asks the root', summary: `Who knows ${DNS_QNAME}?`,
    detail: 'The recursive resolver begins at the root of the namespace. The root need not know the final A record; it only needs to direct the resolver toward the next zone cut.',
    qname: DNS_QNAME, qtype: 'A', recursionDesired: false, delegation: '.',
  },
  {
    id: 'root-referral', atMs: 1050, kind: 'referral', from: 'root', to: 'recursive', phase: 'root', severity: 'success',
    title: 'Root refers the resolver to .test', summary: 'The answer is not here; the next authority is the test. TLD.',
    detail: 'This is a referral, not the final A answer. It tells the recursive resolver which nameserver is authoritative for the next delegation step.',
    records: [ROOT_REFERRAL], delegation: 'test.',
  },
  {
    id: 'ask-tld', atMs: 1450, kind: 'query', from: 'recursive', to: 'tld', phase: 'tld', severity: 'info',
    title: 'Recursive follows the .test delegation', summary: `The same ${DNS_QNAME} A question moves one level deeper.`,
    detail: 'Iterative resolution repeats the original question at the next authority. The recursive resolver is walking referrals until it reaches the zone that owns the name.',
    qname: DNS_QNAME, qtype: 'A', recursionDesired: false, delegation: 'test.',
  },
  {
    id: 'tld-referral', atMs: 1850, kind: 'referral', from: 'tld', to: 'recursive', phase: 'tld', severity: 'success',
    title: '.test refers to example.test', summary: 'The authoritative nameserver for example.test is the next stop.',
    detail: 'The TLD server narrows the search from the top-level domain to the delegated example.test zone.',
    records: [TLD_REFERRAL], delegation: 'example.test.',
  },
  {
    id: 'ask-authoritative', atMs: 2250, kind: 'query', from: 'recursive', to: 'authoritative', phase: 'authoritative', severity: 'info',
    title: 'Recursive reaches the authoritative zone', summary: `Now the resolver asks the server that owns example.test.`,
    detail: 'The delegation chain has reached the authoritative source for the queried name. This server can provide the final A record instead of another referral.',
    qname: DNS_QNAME, qtype: 'A', recursionDesired: false, delegation: 'example.test.',
  },
  {
    id: 'authoritative-answer', atMs: 2700, kind: 'answer', from: 'authoritative', to: 'recursive', phase: 'authoritative', severity: 'success',
    title: 'Authoritative answer returns', summary: `${DNS_QNAME} → ${DNS_ANSWER} · TTL ${DNS_TTL_SECONDS}s`,
    detail: 'The authoritative response supplies the final address record. The TTL gives downstream caches an upper bound on how long this data may be reused without asking again.',
    authoritative: true, records: [A_RECORD], delegation: `${DNS_QNAME}.`,
  },
  {
    id: 'cache-store', atMs: 3050, kind: 'cache.store', from: 'recursive', to: 'cache', phase: 'cache-store', severity: 'success',
    title: 'Recursive caches the answer', summary: `A ${DNS_ANSWER} enters cache with ${DNS_TTL_SECONDS}s remaining.`,
    detail: 'Caching is what makes the next identical lookup radically shorter. The cached record ages; it is not permanent truth.',
    records: [A_RECORD], delegation: `${DNS_QNAME}.`,
  },
  {
    id: 'deliver-answer', atMs: 3450, kind: 'deliver', from: 'recursive', to: 'stub', phase: 'deliver', severity: 'success',
    title: 'Recursive returns the completed answer', summary: `${DNS_ANSWER} reaches the stub resolver.`,
    detail: 'The stub sees one completed recursive answer even though the recursive resolver performed several iterative exchanges upstream.',
    records: [A_RECORD], delegation: `${DNS_QNAME}.`,
  },
  {
    id: 'complete', atMs: 3900, kind: 'deliver', from: 'recursive', to: 'stub', phase: 'complete', severity: 'success',
    title: 'Miss path complete', summary: 'Four network exchanges produced one cached answer.',
    detail: 'The useful artifact of the miss is not only the returned A record; it is also the cached state that can collapse future lookups.',
    records: [A_RECORD], delegation: `${DNS_QNAME}.`,
  },
];

const hitEvents: readonly DnsEvent[] = [
  {
    id: 'hit-stub-query', atMs: 0, kind: 'query', from: 'stub', to: 'recursive', phase: 'stub-query', severity: 'info',
    title: 'The same query arrives again', summary: `${DNS_QNAME} A reaches the recursive resolver with RD=1.`,
    detail: 'From the stub resolver’s perspective, the request looks the same as the cache-miss query.',
    qname: DNS_QNAME, qtype: 'A', recursionDesired: true, delegation: `${DNS_QNAME}.`,
  },
  {
    id: 'cache-hit', atMs: 350, kind: 'cache.hit', from: 'recursive', to: 'cache', phase: 'cache-hit', severity: 'success',
    title: 'Fresh answer found in cache', summary: 'No root, TLD, or authoritative query is necessary.',
    detail: 'The recursive resolver can answer immediately because the cached TTL has not expired. Upstream authorities stay completely quiet.',
    records: [A_RECORD], delegation: `${DNS_QNAME}.`,
  },
  {
    id: 'hit-deliver', atMs: 750, kind: 'deliver', from: 'recursive', to: 'stub', phase: 'deliver', severity: 'success',
    title: 'Cached answer returns', summary: `${DNS_ANSWER} comes back with an aged TTL.`,
    detail: 'The value is the same, but the TTL exposed to the client reflects time already spent in cache.',
    records: [A_RECORD], delegation: `${DNS_QNAME}.`,
  },
  {
    id: 'hit-complete', atMs: 1200, kind: 'deliver', from: 'recursive', to: 'stub', phase: 'complete', severity: 'success',
    title: 'Hit path complete', summary: 'One resolver round trip replaced the entire delegation walk.',
    detail: 'This is the practical payoff of DNS caching: less latency and less upstream query load while cached data remains valid.',
    records: [A_RECORD], delegation: `${DNS_QNAME}.`,
  },
];

export const dnsScenarios: Record<DnsMode, DnsScenario> = {
  miss: { mode: 'miss', durationMs: 4200, events: missEvents, initialCacheAgeSeconds: null },
  hit: { mode: 'hit', durationMs: 1500, events: hitEvents, initialCacheAgeSeconds: 42 },
};

export function dnsScenario(mode: DnsMode): DnsScenario {
  return dnsScenarios[mode];
}

export function clampDnsTime(mode: DnsMode, timeMs: number): number {
  return Math.max(0, Math.min(dnsScenario(mode).durationMs, timeMs));
}

export function dnsEventsAtOrBefore(mode: DnsMode, timeMs: number): readonly DnsEvent[] {
  const scenario = dnsScenario(mode);
  const time = clampDnsTime(mode, timeMs);
  return scenario.events.filter((event) => event.atMs <= time);
}

export function dnsLatestEventAtOrBefore(mode: DnsMode, timeMs: number): DnsEvent {
  const events = dnsEventsAtOrBefore(mode, timeMs);
  return events[events.length - 1] ?? dnsScenario(mode).events[0];
}

function phaseLabel(phase: DnsPhase): string {
  switch (phase) {
    case 'stub-query': return 'RECURSIVE QUERY REQUESTED';
    case 'cache-check': return 'CACHE MISS';
    case 'root': return 'ROOT DELEGATION';
    case 'tld': return 'TLD DELEGATION';
    case 'authoritative': return 'AUTHORITATIVE LOOKUP';
    case 'cache-store': return 'ANSWER CACHED';
    case 'deliver': return 'ANSWER DELIVERY';
    case 'cache-hit': return 'CACHE HIT';
    case 'complete': return 'RESOLUTION COMPLETE';
  }
}

export function dnsStateAt(mode: DnsMode, timeMs: number): DnsState {
  const scenario = dnsScenario(mode);
  const time = clampDnsTime(mode, timeMs);
  const events = dnsEventsAtOrBefore(mode, time);
  const latest = events[events.length - 1] ?? scenario.events[0];
  const stored = events.some((event) => event.kind === 'cache.store');
  const hit = events.some((event) => event.kind === 'cache.hit');
  const answered = events.some((event) => event.kind === 'answer' || event.kind === 'cache.hit' || event.kind === 'deliver');
  const cacheAgeStart = mode === 'hit' ? scenario.initialCacheAgeSeconds ?? 0 : 0;
  const storeAt = mode === 'miss' ? 3050 : 0;
  const hasCache = mode === 'hit' || stored;
  const ageSeconds = hasCache ? cacheAgeStart + Math.max(0, Math.floor((time - storeAt) / 1000)) : 0;
  const ttl = hasCache ? Math.max(0, DNS_TTL_SECONDS - ageSeconds) : null;

  return {
    timeMs: time,
    phase: latest.phase,
    phaseLabel: phaseLabel(latest.phase),
    activeDelegation: latest.delegation ?? '.',
    cacheState: hit ? 'hit' : stored ? 'stored' : 'empty',
    cacheTtlSeconds: ttl,
    answer: answered ? A_RECORD : null,
    latestEventId: latest.id,
  };
}
