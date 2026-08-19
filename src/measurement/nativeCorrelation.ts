import type { InternetEvidenceSnapshot } from '../internet/evidence.ts';
import type { PublicInfrastructureFacility, PublicInfrastructureSnapshot } from '../internet/infrastructure.ts';
import { measuredFactsByCategory, type MeasuredSnapshotState } from './state.ts';
import type { NativeMeasurementFact, NativeMeasurementTarget } from './native.ts';

export type NativeCorrelationProvenance = 'LOCAL MEASURED' | 'EDGE OBSERVED' | 'PUBLIC COLLECTOR' | 'PUBLIC DATA' | 'INFERRED';

export interface NativeCorrelationStage {
  id: string;
  label: string;
  value: string;
  provenance: NativeCorrelationProvenance;
  availability: 'available' | 'partial' | 'unavailable';
  detail: string;
}

export interface NativeLocalSummary {
  interfaceFacts: number;
  routeFacts: number;
  dnsFacts: number;
  icmpFacts: number;
  tracerouteFacts: number;
  transportFacts: number;
  sourceAddress: string | null;
  defaultGateway: string | null;
  dnsServers: string[];
  tracerouteHops: string[];
  targetHostname: string | null;
}

export interface NativeCorrelationProjection {
  schema: 'hopscotch.native-public-correlation';
  version: 1;
  targetHostname: string | null;
  local: NativeLocalSummary;
  stages: NativeCorrelationStage[];
  boundaryNote: string;
}

function stringValue(fact: NativeMeasurementFact | undefined): string | null {
  return fact && fact.availability !== 'unavailable' && typeof fact.value === 'string' ? fact.value : null;
}

function stringListValue(fact: NativeMeasurementFact | undefined): string[] {
  if (!fact || fact.availability === 'unavailable') return [];
  if (typeof fact.value === 'string') return [fact.value];
  return Array.isArray(fact.value) ? fact.value : [];
}

function numericSuffix(subject: string, pattern: RegExp): number {
  const match = subject.match(pattern);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

function hostnameTarget(target: NativeMeasurementTarget | null): string | null {
  if (!target) return null;
  if (target.kind === 'hostname') return target.value;
  if (target.kind === 'service') {
    const host = target.value.replace(/^https?:\/\//i, '').split(/[/:]/, 1)[0]?.trim();
    return host && host.includes('.') ? host : null;
  }
  return null;
}

export function nativeCorrelationTarget(state: MeasuredSnapshotState): string | null {
  const scoped = hostnameTarget(state.snapshot.scope.target);
  if (scoped) return scoped;
  for (const category of ['traceroute', 'icmp', 'dns', 'transport'] as const) {
    for (const fact of measuredFactsByCategory(state, category)) {
      const host = hostnameTarget(fact.target);
      if (host) return host;
    }
  }
  return null;
}

function localSummary(state: MeasuredSnapshotState): NativeLocalSummary {
  const interfaceFacts = measuredFactsByCategory(state, 'interface');
  const routeFacts = measuredFactsByCategory(state, 'route');
  const dnsFacts = measuredFactsByCategory(state, 'dns');
  const icmpFacts = measuredFactsByCategory(state, 'icmp');
  const tracerouteFacts = measuredFactsByCategory(state, 'traceroute');
  const transportFacts = measuredFactsByCategory(state, 'transport');

  const sourceAddress = stringValue(interfaceFacts.find((fact) => fact.id === 'selected-interface-source-address'))
    ?? stringListValue(interfaceFacts.find((fact) => /unicast addresses$/i.test(fact.subject)))[0]
    ?? null;

  let defaultGateway: string | null = null;
  const defaultRoute = routeFacts.find((fact) => / is default$/i.test(fact.subject) && fact.value === true);
  if (defaultRoute) {
    const routeStem = defaultRoute.id.replace(/-default$/, '');
    defaultGateway = stringValue(routeFacts.find((fact) => fact.id === `${routeStem}-gateway`));
  }
  if (!defaultGateway) defaultGateway = stringListValue(interfaceFacts.find((fact) => /gateway addresses$/i.test(fact.subject)))[0] ?? null;

  const dnsServers = [...new Set(interfaceFacts
    .filter((fact) => /DNS server addresses$/i.test(fact.subject))
    .flatMap(stringListValue))].slice(0, 8);

  const tracerouteHops = tracerouteFacts
    .filter((fact) => /traceroute hop \d+ address$/i.test(fact.subject) && typeof fact.value === 'string')
    .sort((a, b) => numericSuffix(a.subject, /hop (\d+)/i) - numericSuffix(b.subject, /hop (\d+)/i))
    .map((fact) => fact.value as string)
    .slice(0, 64);

  return {
    interfaceFacts: interfaceFacts.length,
    routeFacts: routeFacts.length,
    dnsFacts: dnsFacts.length,
    icmpFacts: icmpFacts.length,
    tracerouteFacts: tracerouteFacts.length,
    transportFacts: transportFacts.length,
    sourceAddress,
    defaultGateway,
    dnsServers,
    tracerouteHops,
    targetHostname: nativeCorrelationTarget(state),
  };
}

function facilityContext(infrastructure: PublicInfrastructureSnapshot | null, evidence: InternetEvidenceSnapshot | null): PublicInfrastructureFacility[] {
  if (!infrastructure || infrastructure.provenance !== 'PUBLIC DATA' || !evidence || evidence.edge.availability === 'unavailable') return [];
  const city = evidence.edge.city?.trim().toLowerCase() ?? null;
  const country = evidence.edge.country?.trim().toLowerCase() ?? null;
  if (!city && !country) return [];
  return infrastructure.facilities
    .filter((facility) => {
      const sameCountry = country !== null && facility.country?.toLowerCase() === country;
      const sameCity = city !== null && facility.city?.trim().toLowerCase() === city;
      return sameCity && (country === null || sameCountry);
    })
    .slice(0, 3);
}

export function projectNativePublicCorrelation(
  state: MeasuredSnapshotState,
  evidence: InternetEvidenceSnapshot | null,
  infrastructure: PublicInfrastructureSnapshot | null = null,
): NativeCorrelationProjection {
  const local = localSummary(state);
  const stages: NativeCorrelationStage[] = [];

  stages.push({
    id: 'local-host',
    label: 'LOCAL HOST',
    value: local.sourceAddress ?? 'SOURCE ADDRESS NOT DISCLOSED',
    provenance: 'LOCAL MEASURED',
    availability: local.sourceAddress ? 'available' : 'partial',
    detail: `${local.interfaceFacts} interface facts · ${local.routeFacts} route facts · host-local observation only.`,
  });
  stages.push({
    id: 'local-gateway',
    label: 'DEFAULT GATEWAY',
    value: local.defaultGateway ?? 'NOT OBSERVED',
    provenance: 'LOCAL MEASURED',
    availability: local.defaultGateway ? 'available' : 'unavailable',
    detail: local.defaultGateway ? 'Gateway came from the local route/interface evidence.' : 'No gateway is invented when the report did not disclose one.',
  });

  local.tracerouteHops.forEach((hop, index) => stages.push({
    id: `measured-hop-${index + 1}`,
    label: `MEASURED HOP ${index + 1}`,
    value: hop,
    provenance: 'LOCAL MEASURED',
    availability: 'available',
    detail: 'Responded to the bounded local traceroute. This address is not automatically mapped to an AS, facility, or geographic site.',
  }));

  stages.push({
    id: 'measurement-boundary',
    label: 'OBSERVATION BOUNDARY',
    value: 'MEASURED PATH ENDS HERE',
    provenance: 'INFERRED',
    availability: evidence ? 'available' : 'partial',
    detail: 'The next stages are independently observed public/edge context. HOPSCOTCH does not splice them into one measured forwarding path.',
  });

  if (evidence) {
    stages.push({
      id: 'edge-observation',
      label: 'EDGE OBSERVATION',
      value: evidence.edge.availability === 'unavailable'
        ? 'EDGE METADATA UNAVAILABLE'
        : [evidence.edge.organization, evidence.edge.asn ? `AS${evidence.edge.asn}` : null, evidence.edge.colo].filter(Boolean).join(' · '),
      provenance: 'EDGE OBSERVED',
      availability: evidence.edge.availability,
      detail: evidence.edge.note,
    });
    stages.push({
      id: 'public-routing',
      label: 'PUBLIC ROUTING',
      value: evidence.routing.prefix
        ? `${evidence.routing.prefix}${evidence.routing.originAsns.length ? ` · ORIGIN ${evidence.routing.originAsns.map((asn) => `AS${asn}`).join(', ')}` : ''}`
        : 'PUBLIC ROUTING UNAVAILABLE',
      provenance: 'PUBLIC COLLECTOR',
      availability: evidence.routing.availability,
      detail: evidence.routing.note,
    });

    for (const facility of facilityContext(infrastructure, evidence)) {
      stages.push({
        id: `facility-${facility.id}`,
        label: 'PUBLIC FACILITY CONTEXT',
        value: `${facility.name}${facility.city ? ` · ${facility.city}` : ''}${facility.country ? ` · ${facility.country}` : ''}`,
        provenance: 'PUBLIC DATA',
        availability: 'available',
        detail: 'PeeringDB facility in the same observed edge city. Geographic co-location is context only; it is not evidence that this traffic traversed the facility.',
      });
    }

    stages.push({
      id: 'destination',
      label: 'DESTINATION',
      value: evidence.destination.selectedAddress
        ? `${evidence.destination.hostname} · ${evidence.destination.selectedAddress}`
        : evidence.destination.hostname,
      provenance: 'INFERRED',
      availability: evidence.destination.availability,
      detail: evidence.destination.note,
    });
  } else {
    stages.push({
      id: 'public-context-unavailable',
      label: 'PUBLIC CONTEXT',
      value: 'NOT LOADED',
      provenance: 'INFERRED',
      availability: 'unavailable',
      detail: 'Public context is fetched only after an explicit user action for the measured hostname.',
    });
  }

  return {
    schema: 'hopscotch.native-public-correlation',
    version: 1,
    targetHostname: local.targetHostname,
    local,
    stages,
    boundaryNote: 'LOCAL MEASURED, EDGE OBSERVED, PUBLIC COLLECTOR, PUBLIC DATA, and INFERRED remain separate evidence classes. Correlation never upgrades one into another.',
  };
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function fetchNativePublicContext(
  hostname: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ evidence: InternetEvidenceSnapshot; infrastructure: PublicInfrastructureSnapshot | null }> {
  const normalized = hostname.trim().toLowerCase();
  if (!normalized || normalized.length > 253 || normalized.includes('://') || !normalized.includes('.')) throw new Error('A measured hostname is required before public correlation can run.');
  const [evidenceResponse, infrastructureResponse] = await Promise.all([
    fetchImpl(`/api/internet/snapshot?host=${encodeURIComponent(normalized)}`, { method: 'GET', credentials: 'omit', cache: 'no-store' }),
    fetchImpl('/api/internet/infrastructure', { method: 'GET', credentials: 'omit' }),
  ]);
  if (!evidenceResponse.ok) throw new Error(`Public Internet evidence request failed with HTTP ${evidenceResponse.status}.`);
  const rawEvidence: unknown = await evidenceResponse.json();
  if (!record(rawEvidence) || rawEvidence.schema !== 'hopscotch.internet-evidence' || rawEvidence.version !== 1) throw new Error('Public Internet evidence response is invalid.');
  let infrastructure: PublicInfrastructureSnapshot | null = null;
  if (infrastructureResponse.ok) {
    const rawInfrastructure: unknown = await infrastructureResponse.json();
    if (record(rawInfrastructure) && rawInfrastructure.schema === 'hopscotch.internet-infrastructure' && rawInfrastructure.version === 1 && rawInfrastructure.provenance === 'PUBLIC DATA') {
      infrastructure = rawInfrastructure as unknown as PublicInfrastructureSnapshot;
    }
  }
  return { evidence: rawEvidence as unknown as InternetEvidenceSnapshot, infrastructure };
}
