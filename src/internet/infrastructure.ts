export interface PublicInfrastructureFacility {
  provenance: 'PUBLIC DATA';
  id: number;
  name: string;
  city: string | null;
  country: string | null;
  latitude: number;
  longitude: number;
  networkCount: number | null;
  exchangeCount: number | null;
}

export interface PublicInfrastructureSnapshot {
  schema: 'hopscotch.internet-infrastructure';
  version: 1;
  provenance: 'PUBLIC DATA';
  source: 'PeeringDB';
  generatedAt: string;
  facilities: PublicInfrastructureFacility[];
  note: string;
}

export interface PublicInfrastructureError {
  ok: false;
  error: string;
}
