import type { JourneyPacketLayerId } from './packet-visual.ts';
import type { JourneyPacketTransitStage, JourneyTransportProfile } from './model.ts';

export interface JourneyPhysicalLayer2Envelope {
  readonly id: 'lan' | 'wan';
  readonly sourceMac: string;
  readonly destinationMac: string;
  readonly ingressPort: string;
  readonly egressPort: string;
  readonly frameBytes: number;
  readonly wireBytes: number;
  readonly semanticSignature: string;
}

export interface JourneyPhysicalProjection {
  readonly stage: JourneyPacketTransitStage;
  readonly stageIndex: number;
  readonly activeDevice: 'client' | 'link-a' | 'switch' | 'router' | 'link-b';
  readonly focusLayer: JourneyPacketLayerId;
  readonly frameMode: 'structured' | 'serialized' | 'switching' | 'ip-only' | 'routing' | 're-encapsulated';
  readonly l2Envelope: 'lan' | 'none' | 'wan';
  readonly incoming: JourneyPhysicalLayer2Envelope;
  readonly outgoing: JourneyPhysicalLayer2Envelope;
  readonly sourceIp: string;
  readonly destinationIp: string;
  readonly ttlBefore: 64;
  readonly ttlAfter: 63;
  readonly currentTtl: 64 | 63;
  readonly checksumBefore: string;
  readonly checksumAfter: string;
  readonly currentChecksum: string;
  readonly continuityId: string;
  readonly selectedField: 'FRAME' | 'DESTINATION MAC' | 'DESTINATION IP' | 'TTL' | 'NEXT HOP';
  readonly decision: string;
  readonly semanticSignature: string;
}

const stageOrder: readonly JourneyPacketTransitStage[] = [
  'nic-serialize',
  'link-transmit',
  'switch-inspect',
  'switch-forward',
  'router-decapsulate',
  'router-ttl',
  'router-route',
  'router-reencapsulate',
  'next-link',
];

const incoming = Object.freeze({
  id: 'lan' as const,
  sourceMac: '02:48:4F:50:00:01',
  destinationMac: '02:48:4F:50:00:02',
  ingressPort: 'Gi0/3',
  egressPort: 'Gi0/24',
  frameBytes: 150,
  wireBytes: 154,
  semanticSignature: 'eth2:02-48-4f-50-00-01:02-48-4f-50-00-02:0800:150',
});

const outgoing = Object.freeze({
  id: 'wan' as const,
  sourceMac: '02:48:4F:50:10:01',
  destinationMac: '02:48:4F:50:10:02',
  ingressPort: 'lan0',
  egressPort: 'wan0',
  frameBytes: 150,
  wireBytes: 154,
  semanticSignature: 'eth2:02-48-4f-50-10-01:02-48-4f-50-10-02:0800:150',
});

function stageIndex(stage: JourneyPacketTransitStage): number {
  return stageOrder.indexOf(stage);
}

export function projectJourneyPhysicalState(input: {
  readonly profile: JourneyTransportProfile;
  readonly destinationAddress: string;
  readonly stage: JourneyPacketTransitStage;
}): JourneyPhysicalProjection {
  const index = stageIndex(input.stage);
  const activeDevice: JourneyPhysicalProjection['activeDevice'] = index <= 0
    ? 'client'
    : index === 1
      ? 'link-a'
      : index <= 3
        ? 'switch'
        : index <= 7
          ? 'router'
          : 'link-b';
  const routed = index >= 4;
  const mutated = index >= 5;
  const reEncapsulated = index >= 7;
  const checksumBefore = input.profile === 'quic-h3' ? '0xF224' : '0xF223';
  const checksumAfter = input.profile === 'quic-h3' ? '0xF324' : '0xF323';
  const l2Envelope: JourneyPhysicalProjection['l2Envelope'] = routed && !reEncapsulated ? 'none' : reEncapsulated ? 'wan' : 'lan';
  const focusLayer: JourneyPacketLayerId = index <= 3 || reEncapsulated ? 'link' : 'network';
  const frameMode: JourneyPhysicalProjection['frameMode'] = index <= 0
    ? 'structured'
    : index === 1 || index === 8
      ? 'serialized'
      : index <= 3
        ? 'switching'
        : index === 4 || index === 5
          ? 'ip-only'
          : index === 6
            ? 'routing'
            : 're-encapsulated';
  const selectedField: JourneyPhysicalProjection['selectedField'] = index <= 1
    ? 'FRAME'
    : index <= 3
      ? 'DESTINATION MAC'
      : index === 4 || index === 6
        ? 'DESTINATION IP'
        : index === 5
          ? 'TTL'
          : 'NEXT HOP';
  const decision = index <= 0
    ? 'Serialize 150 frame bytes; generate 4 wire FCS bytes'
    : index === 1
      ? 'Transmit toward access switch Gi0/3'
      : index === 2
        ? 'Look up 02:48:4F:50:00:02 in the MAC table'
        : index === 3
          ? 'Forward unchanged Ethernet header through Gi0/24'
          : index === 4
            ? 'Terminate LAN Ethernet; retain IPv4 continuity object'
            : index === 5
              ? `TTL 64 → 63; IPv4 checksum ${checksumBefore} → ${checksumAfter}`
              : index === 6
                ? `${input.destinationAddress} ∈ 203.0.113.0/24 → 198.51.100.2 / wan0`
                : index === 7
                  ? 'Construct WAN Ethernet header for next hop 198.51.100.2'
                  : 'Transmit the new hop-local frame toward 198.51.100.2';
  const currentTtl = mutated ? 63 : 64;
  const currentChecksum = mutated ? checksumAfter : checksumBefore;
  const continuityId = `ipv4:192.0.2.10>${input.destinationAddress}:${input.profile}:request-01`;

  return {
    stage: input.stage,
    stageIndex: index,
    activeDevice,
    focusLayer,
    frameMode,
    l2Envelope,
    incoming,
    outgoing,
    sourceIp: '192.0.2.10',
    destinationIp: input.destinationAddress,
    ttlBefore: 64,
    ttlAfter: 63,
    currentTtl,
    checksumBefore,
    checksumAfter,
    currentChecksum,
    continuityId,
    selectedField,
    decision,
    semanticSignature: [input.profile, input.destinationAddress, input.stage, continuityId, l2Envelope, currentTtl, currentChecksum].join('|'),
  };
}

export const JOURNEY_PHYSICAL_STAGES = stageOrder;
