import { buildPacket, type PacketField, type PacketSegment, type PacketSnapshot } from '../packet/model.ts';
import type { JourneyPacketAssemblyStage, JourneyTransportProfile } from './model.ts';

export type JourneyPacketLayerId = 'application' | 'security' | 'transport' | 'network' | 'link';

export interface JourneyPacketVisualField {
  id: string;
  label: string;
  value: string;
  byteStart: number | null;
  byteLength: number;
  derived: boolean;
  note: string | null;
}

export interface JourneyPacketVisualLayer {
  id: JourneyPacketLayerId;
  order: number;
  protocol: string;
  role: string;
  headline: string;
  detail: string;
  byteStart: number | null;
  byteLength: number;
  bytePreview: string;
  fields: readonly JourneyPacketVisualField[];
  visible: boolean;
  active: boolean;
}

export interface JourneyPacketCamera {
  scale: number;
  rotateX: number;
  rotateY: number;
  translateX: number;
  translateY: number;
}

export interface JourneyPacketVisualProjection {
  stage: JourneyPacketAssemblyStage;
  stageIndex: number;
  title: string;
  direction: 'CLIENT → ORIGIN';
  collapsed: boolean;
  exploded: boolean;
  frameBytes: number;
  wireBytes: number;
  payloadBytes: number;
  selectedLayerId: JourneyPacketLayerId;
  layers: readonly JourneyPacketVisualLayer[];
  camera: JourneyPacketCamera;
  semanticSignature: string;
  snapshot: PacketSnapshot;
}

const layerOrder: readonly JourneyPacketLayerId[] = ['application', 'security', 'transport', 'network', 'link'];
const stageIndex: Record<JourneyPacketAssemblyStage, number> = {
  idle: -1,
  application: 0,
  security: 1,
  transport: 2,
  network: 3,
  link: 4,
  collapsed: 5,
  exploded: 6,
};

const cameraByStage: Record<JourneyPacketAssemblyStage, JourneyPacketCamera> = {
  idle: { scale: .9, rotateX: 0, rotateY: 0, translateX: 0, translateY: 0 },
  application: { scale: 1.08, rotateX: 0, rotateY: -3, translateX: 0, translateY: 10 },
  security: { scale: 1.04, rotateX: 2, rotateY: -7, translateX: -8, translateY: 5 },
  transport: { scale: 1, rotateX: 5, rotateY: -10, translateX: -6, translateY: 0 },
  network: { scale: .96, rotateX: 7, rotateY: -12, translateX: 0, translateY: -2 },
  link: { scale: .92, rotateX: 8, rotateY: -13, translateX: 8, translateY: -4 },
  collapsed: { scale: 1.02, rotateX: 3, rotateY: -7, translateX: 0, translateY: 0 },
  exploded: { scale: .88, rotateX: 9, rotateY: -14, translateX: 8, translateY: 0 },
};

function hexPreview(segment: PacketSegment): string {
  return segment.bytes.slice(0, 10).map((byte) => byte.toString(16).padStart(2, '0').toUpperCase()).join(' ');
}

function projectFields(segment: PacketSegment): JourneyPacketVisualField[] {
  return segment.fields.map((field: PacketField) => ({
    id: field.id,
    label: field.label,
    value: field.value,
    byteStart: field.length > 0 ? segment.offset + field.offset : null,
    byteLength: field.length,
    derived: Boolean(field.derived),
    note: field.note ?? null,
  }));
}

function packetSnapshot(profile: JourneyTransportProfile, destinationAddress: string): PacketSnapshot {
  return buildPacket({
    family: 'ipv4',
    transport: profile === 'quic-h3' ? 'udp' : 'tcp',
    payloadBytes: 96,
    ttl: 64,
    sourcePort: 52133,
    destinationPort: 443,
    sourceMac: '02:48:4f:50:00:01',
    destinationMac: '02:48:4f:50:00:02',
    sourceIpv4: '192.0.2.10',
    destinationIpv4: destinationAddress,
  });
}

export function projectJourneyPacketVisual(input: {
  hostname: string;
  destinationAddress: string;
  profile: JourneyTransportProfile;
  stage: JourneyPacketAssemblyStage;
  selectedLayerId?: JourneyPacketLayerId | null;
}): JourneyPacketVisualProjection {
  const snapshot = packetSnapshot(input.profile, input.destinationAddress);
  const ethernet = snapshot.segments.find((segment) => segment.id === 'ethernet')!;
  const network = snapshot.segments.find((segment) => segment.id === 'network')!;
  const transport = snapshot.segments.find((segment) => segment.id === 'transport')!;
  const quic = input.profile === 'quic-h3';
  const currentStageIndex = stageIndex[input.stage];
  const selectedLayerId = input.selectedLayerId && layerOrder.includes(input.selectedLayerId) ? input.selectedLayerId : layerOrder[Math.max(0, Math.min(4, currentStageIndex))];
  const visibleThrough = currentStageIndex >= 5 ? 4 : currentStageIndex;
  const activeId: JourneyPacketLayerId = input.stage === 'exploded'
    ? selectedLayerId
    : layerOrder[Math.max(0, Math.min(4, currentStageIndex))];

  const layerInputs: Array<Omit<JourneyPacketVisualLayer, 'visible' | 'active'>> = [
    {
      id: 'application', order: 0, protocol: quic ? 'HTTP/3' : 'HTTP/2', role: 'APPLICATION MEANING',
      headline: `GET / · ${input.hostname}`,
      detail: quic ? 'Request fields enter a QUIC request stream.' : 'Request headers enter an HTTP/2 HEADERS frame.',
      byteStart: null, byteLength: 0, bytePreview: 'SEMANTIC VIEW',
      fields: [
        { id: 'app-method', label: 'Method', value: 'GET', byteStart: null, byteLength: 0, derived: false, note: 'Application semantics before packet-observation encryption.' },
        { id: 'app-authority', label: 'Authority', value: input.hostname, byteStart: null, byteLength: 0, derived: false, note: null },
        { id: 'app-path', label: 'Path', value: '/', byteStart: null, byteLength: 0, derived: false, note: null },
      ],
    },
    {
      id: 'security', order: 1, protocol: quic ? 'QUIC 1-RTT' : 'TLS 1.3', role: 'PROTECTION BOUNDARY',
      headline: quic ? 'PROTECTED STREAM DATA' : 'APPLICATION DATA RECORD',
      detail: quic ? 'TLS-derived keys protect QUIC payloads; there is no standalone TLS record layer.' : 'HTTP/2 bytes become opaque TLS application data on the wire.',
      byteStart: null, byteLength: snapshot.payloadBytes, bytePreview: 'OPAQUE · KEY MATERIAL NOT INVENTED',
      fields: [
        { id: 'security-state', label: 'Protection state', value: quic ? 'QUIC 1-RTT active' : 'TLS application keys active', byteStart: null, byteLength: 0, derived: true, note: 'HOPSCOTCH names the deterministic protection state without fabricating secrets or ciphertext.' },
        { id: 'security-observation', label: 'Packet observation', value: 'Application meaning opaque', byteStart: null, byteLength: 0, derived: true, note: null },
      ],
    },
    {
      id: 'transport', order: 2, protocol: quic ? 'QUIC / UDP' : 'TCP', role: 'TRANSPORT ENVELOPE',
      headline: quic ? '52133 → 443 · UDP' : '52133 → 443 · PSH ACK',
      detail: quic ? 'UDP carries a protected QUIC packet; QUIC owns connection and stream semantics.' : 'TCP owns sequence space, cumulative acknowledgment, flow control, and reliable delivery.',
      byteStart: transport.offset, byteLength: transport.length, bytePreview: hexPreview(transport), fields: projectFields(transport),
    },
    {
      id: 'network', order: 3, protocol: 'IPv4', role: 'ROUTED CONTINUITY',
      headline: `192.0.2.10 → ${input.destinationAddress}`,
      detail: 'This IP packet continues across routed hops. TTL and the header checksum may change; the destination IP remains the routing target.',
      byteStart: network.offset, byteLength: network.length, bytePreview: hexPreview(network), fields: projectFields(network),
    },
    {
      id: 'link', order: 4, protocol: 'ETHERNET II', role: 'HOP-LOCAL ENVELOPE',
      headline: '02:48:4F:50:00:01 → 02:48:4F:50:00:02',
      detail: 'These MAC addresses are valid only for this local hop. A router will remove this envelope and construct another.',
      byteStart: ethernet.offset, byteLength: ethernet.length, bytePreview: hexPreview(ethernet), fields: projectFields(ethernet),
    },
  ];

  const layers = layerInputs.map((layer) => ({
    ...layer,
    visible: layer.order <= visibleThrough,
    active: layer.id === activeId,
  }));

  const title = input.stage === 'collapsed'
    ? 'FRAME / READY'
    : input.stage === 'exploded'
      ? 'FRAME / EXPLODED'
      : `${String(Math.max(1, currentStageIndex + 1)).padStart(2, '0')} / ${activeId.toUpperCase()}`;

  return {
    stage: input.stage,
    stageIndex: currentStageIndex,
    title,
    direction: 'CLIENT → ORIGIN',
    collapsed: input.stage === 'collapsed',
    exploded: input.stage === 'exploded',
    frameBytes: snapshot.frameBytes,
    wireBytes: snapshot.frameBytes + 4,
    payloadBytes: snapshot.payloadBytes,
    selectedLayerId,
    layers,
    camera: cameraByStage[input.stage],
    semanticSignature: [input.profile, input.hostname, input.destinationAddress, input.stage, selectedLayerId, snapshot.networkChecksum, snapshot.transportChecksum].join(':'),
    snapshot,
  };
}
