import type {
  CollectorPathObservation,
  EdgeObservation,
  InternetEvidenceSnapshot,
} from '../src/internet/evidence';
import type {
  PublicInfrastructureFacility,
  PublicInfrastructureSnapshot,
} from '../src/internet/infrastructure';

interface Env {
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
}

function json(value: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  if (!headers.has('cache-control')) headers.set('cache-control', 'no-store');
  headers.set('content-type', 'application/json; charset=utf-8');
  return Response.json(value, { ...init, headers });
}

function cacheableJson(value: unknown, maxAgeSeconds: number): Response {
  return json(value, {
    headers: {
      'cache-control': `public, max-age=${maxAgeSeconds}, s-maxage=${maxAgeSeconds}`,
    },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeHostname(input: string | null): string {
  const hostname = (input ?? '').trim().toLowerCase().replace(/\.$/, '');
  if (!hostname || hostname.length > 253) throw new Error('Hostname must contain 1–253 characters.');
  if (hostname.includes('://') || /[\/:?#\[\]@]/.test(hostname)) throw new Error('Enter a hostname only, not a URL, port, path, or IP literal.');
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)) throw new Error('Enter a hostname instead of an IP address.');
  const labels = hostname.split('.');
  if (labels.length < 2) throw new Error('Hostname must contain at least one dot.');
  for (const label of labels) {
    if (!label || label.length > 63 || !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) throw new Error(`Invalid hostname label: ${label || '(empty)'}.`);
  }
  return hostname;
}

async function fetchJson(url: string, timeoutMs = 4500, headers?: HeadersInit): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort('upstream timeout'), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, headers });
    if (!response.ok) throw new Error(`Upstream returned HTTP ${response.status}.`);
    const value: unknown = await response.json();
    if (!isRecord(value)) throw new Error('Upstream returned an unexpected payload.');
    return value;
  } finally {
    clearTimeout(timer);
  }
}

function edgeObservation(request: Request): EdgeObservation {
  const cf = request.cf;
  const tcpRtt = typeof cf?.clientTcpRtt === 'number' ? cf.clientTcpRtt : null;
  const quicRtt = typeof cf?.clientQuicRtt === 'number' ? cf.clientQuicRtt : null;
  const asn = typeof cf?.asn === 'number' ? cf.asn : null;
  const organization = typeof cf?.asOrganization === 'string' ? cf.asOrganization : null;
  const colo = typeof cf?.colo === 'string' ? cf.colo : null;
  const country = typeof cf?.country === 'string' ? cf.country : null;
  const region = typeof cf?.region === 'string' ? cf.region : null;
  const city = typeof cf?.city === 'string' ? cf.city : null;
  const availability = asn !== null || colo !== null ? 'available' : 'unavailable';
  return {
    provenance: 'EDGE OBSERVED',
    availability,
    asn,
    organization,
    colo,
    country,
    region,
    city,
    transportRttMs: quicRtt ?? tcpRtt,
    transport: quicRtt !== null ? 'QUIC' : tcpRtt !== null ? 'TCP' : null,
    observedAt: new Date().toISOString(),
    note: availability === 'available'
      ? 'Observed by the Cloudflare edge handling this HOPSCOTCH request. This does not reveal the route beyond that edge observation.'
      : 'Cloudflare request metadata is unavailable in this runtime/request context. Nothing was inferred to replace it.',
  };
}

function dnsAddresses(payload: Record<string, unknown>, expectedType: 1 | 28): string[] {
  const answers = Array.isArray(payload.Answer) ? payload.Answer : [];
  return answers.flatMap((answer) => {
    if (!isRecord(answer) || answer.type !== expectedType || typeof answer.data !== 'string') return [];
    return [answer.data];
  });
}

async function resolveHostname(hostname: string): Promise<string[]> {
  const query = async (type: 'A' | 'AAAA', numericType: 1 | 28): Promise<string[]> => {
    const payload = await fetchJson(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=${type}`, 4000, { accept: 'application/dns-json' });
    if (typeof payload.Status === 'number' && payload.Status !== 0) return [];
    return dnsAddresses(payload, numericType);
  };
  const results = await Promise.allSettled([query('A', 1), query('AAAA', 28)]);
  const addresses = results.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
  if (addresses.length === 0 && results.every((result) => result.status === 'rejected')) throw new Error('DNS resolution upstream is unavailable.');
  return [...new Set(addresses)].slice(0, 8);
}

async function networkInfo(address: string): Promise<{ prefix: string | null; asns: number[] }> {
  const payload = await fetchJson(`https://stat.ripe.net/data/network-info/data.json?resource=${encodeURIComponent(address)}`);
  const data = isRecord(payload.data) ? payload.data : {};
  const prefix = typeof data.prefix === 'string' ? data.prefix : null;
  const asns = Array.isArray(data.asns) ? data.asns.filter((value): value is number => typeof value === 'number' && Number.isInteger(value)) : [];
  return { prefix, asns: [...new Set(asns)].slice(0, 8) };
}

function numericAsPath(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const path = value.filter((item): item is number => typeof item === 'number' && Number.isInteger(item) && item > 0);
  return path.filter((asn, index) => index === 0 || path[index - 1] !== asn);
}

async function collectorPaths(prefix: string): Promise<CollectorPathObservation[]> {
  const payload = await fetchJson(`https://stat.ripe.net/data/bgp-state/data.json?resource=${encodeURIComponent(prefix)}`, 5000);
  const data = isRecord(payload.data) ? payload.data : {};
  const state = Array.isArray(data.bgp_state) ? data.bgp_state : [];
  const seen = new Set<string>();
  const paths: CollectorPathObservation[] = [];
  for (const raw of state) {
    if (!isRecord(raw)) continue;
    const asPath = numericAsPath(raw.path);
    const sourceId = typeof raw.source_id === 'string' ? raw.source_id : 'RIS collector peer';
    const targetPrefix = typeof raw.target_prefix === 'string' ? raw.target_prefix : prefix;
    if (asPath.length === 0) continue;
    const key = `${sourceId}|${asPath.join('-')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    paths.push({
      provenance: 'PUBLIC COLLECTOR',
      availability: 'available',
      sourceId,
      targetPrefix,
      asPath,
      note: 'Observed from this RIPE RIS collector-peer vantage point. It is not the current browser’s exact forwarding path.',
    });
    if (paths.length >= 6) break;
  }
  return paths;
}

async function buildSnapshot(request: Request, hostname: string): Promise<InternetEvidenceSnapshot> {
  const warnings: string[] = [];
  const edge = edgeObservation(request);
  let addresses: string[] = [];
  try {
    addresses = await resolveHostname(hostname);
  } catch (error) {
    warnings.push(error instanceof Error ? error.message : 'DNS resolution unavailable.');
  }
  const selectedAddress = addresses[0] ?? null;
  let prefix: string | null = null;
  let originAsns: number[] = [];
  if (selectedAddress) {
    try {
      const info = await networkInfo(selectedAddress);
      prefix = info.prefix;
      originAsns = info.asns;
    } catch (error) {
      warnings.push(`RIPE network context unavailable: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }
  let paths: CollectorPathObservation[] = [];
  if (prefix) {
    try {
      paths = await collectorPaths(prefix);
      if (paths.length === 0) warnings.push('No usable RIS collector AS paths were returned for the selected prefix.');
    } catch (error) {
      warnings.push(`RIPE collector paths unavailable: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  return {
    schema: 'hopscotch.internet-evidence',
    version: 1,
    generatedAt: new Date().toISOString(),
    edge,
    destination: {
      provenance: 'INFERRED',
      availability: addresses.length > 0 ? 'available' : 'unavailable',
      hostname,
      addresses,
      selectedAddress,
      note: addresses.length > 0 ? 'Resolved by HOPSCOTCH through Cloudflare DNS-over-HTTPS. DNS resolution identifies destination addresses; it does not measure the packet path.' : 'No destination address was available, so downstream routing evidence was not invented.',
    },
    routing: {
      provenance: 'PUBLIC COLLECTOR',
      availability: prefix ? 'available' : 'unavailable',
      prefix,
      originAsns,
      note: prefix ? 'Prefix/origin context comes from RIPE RIS-derived public routing data.' : 'Public routing context is unavailable for this snapshot.',
    },
    collectorPaths: paths,
    bridge: {
      provenance: 'INFERRED',
      availability: edge.asn !== null && originAsns.length > 0 ? 'available' : 'partial',
      sourceAsn: edge.asn,
      destinationOriginAsns: originAsns,
      note: 'This bridge only connects independently observed endpoint context. No continuous end-to-end forwarding path was observed.',
    },
    warnings,
  };
}

function finiteCoordinate(value: unknown, min: number, max: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) return null;
  return value;
}

function nullableCount(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
}

async function publicInfrastructure(): Promise<PublicInfrastructureSnapshot> {
  const fields = 'id,name,city,country,latitude,longitude,net_count,ix_count,status';
  const payload = await fetchJson(
    `https://www.peeringdb.com/api/fac?limit=250&fields=${encodeURIComponent(fields)}`,
    5500,
    {
      accept: 'application/json',
      'user-agent': 'HOPSCOTCH/0.0.1 (+https://hopscotch.johnnyli.dev)',
    },
  );
  const data = Array.isArray(payload.data) ? payload.data : [];
  const facilities: PublicInfrastructureFacility[] = [];
  for (const raw of data) {
    if (!isRecord(raw) || raw.status === 'deleted') continue;
    if (typeof raw.id !== 'number' || !Number.isInteger(raw.id) || typeof raw.name !== 'string' || raw.name.length === 0) continue;
    const latitude = finiteCoordinate(raw.latitude, -90, 90);
    const longitude = finiteCoordinate(raw.longitude, -180, 180);
    if (latitude === null || longitude === null) continue;
    facilities.push({
      provenance: 'PUBLIC DATA',
      id: raw.id,
      name: raw.name.slice(0, 160),
      city: typeof raw.city === 'string' && raw.city.length > 0 ? raw.city.slice(0, 100) : null,
      country: typeof raw.country === 'string' && raw.country.length > 0 ? raw.country.slice(0, 8) : null,
      latitude,
      longitude,
      networkCount: nullableCount(raw.net_count),
      exchangeCount: nullableCount(raw.ix_count),
    });
  }
  return {
    schema: 'hopscotch.internet-infrastructure',
    version: 1,
    provenance: 'PUBLIC DATA',
    source: 'PeeringDB',
    generatedAt: new Date().toISOString(),
    facilities,
    note: 'Facility locations come from PeeringDB public interconnection data. A plotted facility is infrastructure context, not proof that any selected traffic traversed it.',
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/health') {
      return json({ ok: true, product: 'HOPSCOTCH', edge: 'cloudflare-workers' });
    }

    if (url.pathname === '/api/internet/edge') {
      if (request.method !== 'GET') return json({ ok: false, error: 'Method not allowed' }, { status: 405 });
      return json(edgeObservation(request));
    }

    if (url.pathname === '/api/internet/infrastructure') {
      if (request.method !== 'GET') return json({ ok: false, error: 'Method not allowed' }, { status: 405 });
      try {
        return cacheableJson(await publicInfrastructure(), 900);
      } catch (error) {
        return json({ ok: false, error: `Public infrastructure data is unavailable: ${error instanceof Error ? error.message : 'unknown upstream error'}` }, { status: 502 });
      }
    }

    if (url.pathname === '/api/internet/snapshot') {
      if (request.method !== 'GET') return json({ ok: false, error: 'Method not allowed' }, { status: 405 });
      let hostname: string;
      try {
        hostname = normalizeHostname(url.searchParams.get('host'));
      } catch (error) {
        return json({ ok: false, error: error instanceof Error ? error.message : 'Invalid hostname.' }, { status: 400 });
      }
      return json(await buildSnapshot(request, hostname));
    }

    if (url.pathname.startsWith('/api/')) return json({ ok: false, error: 'Not found' }, { status: 404 });
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
