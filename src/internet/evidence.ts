export type EvidenceProvenance = 'LOCAL MEASURED' | 'EDGE OBSERVED' | 'PUBLIC COLLECTOR' | 'INFERRED' | 'SIMULATED';
export type EvidenceAvailability = 'available' | 'unavailable' | 'partial';

export interface EvidenceFact<T> {
  provenance: EvidenceProvenance;
  availability: EvidenceAvailability;
  label: string;
  value: T | null;
  detail: string;
}

export interface EdgeObservation {
  provenance: 'EDGE OBSERVED';
  availability: EvidenceAvailability;
  asn: number | null;
  organization: string | null;
  colo: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  transportRttMs: number | null;
  transport: 'TCP' | 'QUIC' | null;
  observedAt: string;
  note: string;
}

export interface DestinationObservation {
  provenance: 'INFERRED';
  availability: EvidenceAvailability;
  hostname: string;
  addresses: string[];
  selectedAddress: string | null;
  note: string;
}

export interface PublicRoutingContext {
  provenance: 'PUBLIC COLLECTOR';
  availability: EvidenceAvailability;
  prefix: string | null;
  originAsns: number[];
  note: string;
}

export interface CollectorPathObservation {
  provenance: 'PUBLIC COLLECTOR';
  availability: 'available';
  sourceId: string;
  targetPrefix: string;
  asPath: number[];
  note: string;
}

export interface InferredBridge {
  provenance: 'INFERRED';
  availability: EvidenceAvailability;
  sourceAsn: number | null;
  destinationOriginAsns: number[];
  note: string;
}

export interface InternetEvidenceSnapshot {
  schema: 'hopscotch.internet-evidence';
  version: 1;
  generatedAt: string;
  edge: EdgeObservation;
  destination: DestinationObservation;
  routing: PublicRoutingContext;
  collectorPaths: CollectorPathObservation[];
  bridge: InferredBridge;
  warnings: string[];
}

export interface InternetEvidenceError {
  ok: false;
  error: string;
}
