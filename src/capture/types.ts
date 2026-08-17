import type { CaptureByteOrder, ImmutableBytes } from './bytes.ts';

export const CAPTURE_LIMITS = Object.freeze({
  maxCaptureBytes: 64 * 1024 * 1024,
  maxFrames: 100_000,
  maxSemanticEvents: 500_000,
  maxFrameBytes: 16 * 1024 * 1024,
  maxPcapngBlockBytes: 32 * 1024 * 1024,
  maxPcapngBlocks: 250_000,
  maxPcapngInterfaces: 4096,
  maxIpv6ExtensionHeaders: 16,
  maxIpv6ExtensionBytes: 2048,
  maxDnsQuestions: 128,
  maxDnsRecords: 256,
  maxDnsPointerDepth: 32,
  maxTcpSequenceIntervalsPerDirection: 4096,
  maxTlsRecordsPerFrame: 64,
  maxTlsHandshakeMessagesPerFrame: 128,
  maxTlsExtensionsPerHello: 256,
  maxTlsNamesPerExtension: 128,
  maxTlsAlpnProtocols: 128,
  maxTlsSupportedVersions: 128,
});

export type CaptureProvenance = 'CAPTURED' | 'INFERRED';
export type CaptureContainerFormat = 'pcap' | 'pcapng';
export type CaptureTimestampUnit = 'microseconds' | 'nanoseconds' | 'decimal' | 'binary';
export type CaptureLayerStatus = 'complete' | 'truncated' | 'malformed' | 'unsupported';
export type IpFamily = 'ipv4' | 'ipv6';
export type TransportKind = 'tcp' | 'udp' | 'icmp' | 'icmpv6';

export interface ByteRange {
  readonly offset: number;
  readonly length: number;
}

export interface CaptureTimestampResolution {
  readonly unit: CaptureTimestampUnit;
  readonly exponent: number;
  readonly description: string;
}

export interface CapturedTimestamp {
  readonly epochNanoseconds: bigint;
  readonly originalSeconds: number | null;
  readonly originalFraction: number | null;
  readonly rawTicks: bigint;
  readonly resolution: CaptureTimestampResolution;
  readonly iso8601: string | null;
}

export interface CaptureInterfaceRecord {
  readonly id: string;
  readonly sectionIndex: number;
  readonly interfaceIndex: number;
  readonly linkType: number;
  readonly linkTypeLabel: string;
  readonly supported: boolean;
  readonly snapLength: number;
  readonly timestampResolution: CaptureTimestampResolution;
}

export interface CapturedFrameRecord {
  readonly id: string;
  readonly number: number;
  readonly sourceOrder: number;
  readonly timestamp: CapturedTimestamp;
  readonly relativeTimeNanoseconds: bigint;
  readonly relativeTimeMs: number;
  readonly capturedLength: number;
  readonly originalLength: number;
  readonly truncated: boolean;
  readonly linkType: number;
  readonly linkTypeLabel: string;
  readonly interfaceId: string;
  readonly sectionIndex: number;
  readonly bytes: ImmutableBytes;
  readonly provenance: 'CAPTURED';
}

export interface ParsedCaptureContainer {
  readonly format: CaptureContainerFormat;
  readonly byteOrder: CaptureByteOrder | 'mixed';
  readonly captureId: string;
  readonly byteLength: number;
  readonly frames: readonly CapturedFrameRecord[];
  readonly interfaces: readonly CaptureInterfaceRecord[];
  readonly warnings: readonly string[];
}

export type CapturedFieldValue = string | number | boolean | null;

export interface CapturedField {
  readonly id: string;
  readonly label: string;
  readonly value: CapturedFieldValue;
  readonly displayValue: string;
  readonly byteRanges: readonly ByteRange[];
  readonly provenance: 'CAPTURED';
  readonly note?: string;
}

export type CapturedLayerProtocol =
  | 'ethernet'
  | 'vlan'
  | 'ipv4'
  | 'ipv6'
  | 'ipv6-extension'
  | 'tcp'
  | 'udp'
  | 'icmp'
  | 'icmpv6'
  | 'dns'
  | 'tls'
  | 'payload'
  | 'unknown';

export interface CapturedLayer {
  readonly id: string;
  readonly protocol: CapturedLayerProtocol;
  readonly label: string;
  readonly byteRange: ByteRange;
  readonly fields: readonly CapturedField[];
  readonly status: CaptureLayerStatus;
  readonly note?: string;
}

export interface CapturedEndpoint {
  readonly family: IpFamily;
  readonly address: string;
  readonly port: number | null;
}

export interface CapturedTcpOptions {
  readonly mss: number | null;
  readonly windowScale: number | null;
  readonly sackPermitted: boolean;
  readonly timestampValue: number | null;
  readonly timestampEchoReply: number | null;
}

export interface CapturedTcpFacts {
  readonly sequenceNumber: number;
  readonly acknowledgmentNumber: number;
  readonly dataOffsetBytes: number;
  readonly flags: Readonly<{
    ns: boolean;
    cwr: boolean;
    ece: boolean;
    urg: boolean;
    ack: boolean;
    psh: boolean;
    rst: boolean;
    syn: boolean;
    fin: boolean;
  }>;
  readonly window: number;
  readonly checksum: number;
  readonly urgentPointer: number;
  readonly payloadRange: ByteRange;
  readonly options: CapturedTcpOptions;
}

export interface CapturedUdpFacts {
  readonly length: number;
  readonly checksum: number;
  readonly payloadRange: ByteRange;
}

export interface CapturedIcmpFacts {
  readonly type: number;
  readonly code: number;
  readonly label: string;
  readonly identifier: number | null;
  readonly sequence: number | null;
  readonly mtu: number | null;
}

export interface CapturedTransport {
  readonly kind: TransportKind;
  readonly source: CapturedEndpoint;
  readonly destination: CapturedEndpoint;
  readonly tcp: CapturedTcpFacts | null;
  readonly udp: CapturedUdpFacts | null;
  readonly icmp: CapturedIcmpFacts | null;
}

export interface CapturedDnsQuestion {
  readonly name: string;
  readonly type: number;
  readonly typeLabel: string;
  readonly class: number;
}

export interface CapturedDnsRecord {
  readonly name: string;
  readonly type: number;
  readonly typeLabel: string;
  readonly class: number;
  readonly ttl: number;
  readonly data: string;
}

export interface CapturedDnsMessage {
  readonly transactionId: number;
  readonly isResponse: boolean;
  readonly opcode: number;
  readonly authoritative: boolean;
  readonly truncated: boolean;
  readonly recursionDesired: boolean;
  readonly recursionAvailable: boolean;
  readonly rcode: number;
  readonly questions: readonly CapturedDnsQuestion[];
  readonly answers: readonly CapturedDnsRecord[];
  readonly authorities: readonly CapturedDnsRecord[];
  readonly additionals: readonly CapturedDnsRecord[];
}

export interface CapturedTlsHello {
  readonly kind: 'client-hello' | 'server-hello';
  readonly legacyVersion: string;
  readonly serverName: string | null;
  readonly alpnProtocols: readonly string[];
  readonly supportedVersions: readonly string[];
  readonly selectedCipherSuite: string | null;
}

export interface CapturedTlsRecord {
  readonly contentType: number;
  readonly contentTypeLabel: string;
  readonly legacyVersion: string;
  readonly length: number;
  readonly hello: CapturedTlsHello | null;
}

export interface CapturedTlsMetadata {
  readonly records: readonly CapturedTlsRecord[];
}

export interface CapturedFrameEvidence {
  readonly record: CapturedFrameRecord;
  readonly layers: readonly CapturedLayer[];
  readonly sourceIp: string | null;
  readonly destinationIp: string | null;
  readonly ipFamily: IpFamily | null;
  readonly transport: CapturedTransport | null;
  readonly dns: CapturedDnsMessage | null;
  readonly tls: CapturedTlsMetadata | null;
  readonly issues: readonly string[];
  readonly provenance: 'CAPTURED';
}

export type ConversationProtocol = 'TCP' | 'UDP' | 'DNS' | 'ICMP' | 'ICMPV6';
export type ConversationDirection = 'A_TO_B' | 'B_TO_A';

export interface ConversationFrameReference {
  readonly frameId: string;
  readonly frameNumber: number;
  readonly direction: ConversationDirection;
  readonly relativeTimeNanoseconds: bigint;
  readonly capturedLength: number;
}

export interface CaptureConversation {
  readonly id: string;
  readonly key: string;
  readonly protocol: ConversationProtocol;
  readonly applicationProtocol: 'DNS' | 'TLS' | null;
  readonly endpointA: CapturedEndpoint;
  readonly endpointB: CapturedEndpoint;
  readonly frameReferences: readonly ConversationFrameReference[];
  readonly eventIds: readonly string[];
  readonly frameCount: number;
  readonly capturedBytes: number;
  readonly directionCounts: Readonly<Record<ConversationDirection, number>>;
  readonly firstObservedNanoseconds: bigint;
  readonly lastObservedNanoseconds: bigint;
  readonly durationNanoseconds: bigint;
  readonly observedInitiator: 'A' | 'B' | null;
  readonly captureStartedMidConversation: boolean;
  readonly oneDirectionOnly: boolean;
  readonly truncatedFrameCount: number;
  readonly provenance: 'INFERRED';
}

export type CapturedEventKind =
  | 'tcp.syn'
  | 'tcp.syn-ack'
  | 'tcp.ack'
  | 'tcp.data'
  | 'tcp.fin'
  | 'tcp.rst'
  | 'tcp.established-observed'
  | 'tcp.duplicate-ack-observed'
  | 'tcp.retransmission-observed'
  | 'tcp.overlap-observed'
  | 'tcp.sequence-gap-visible'
  | 'udp.datagram'
  | 'dns.query'
  | 'dns.response'
  | 'tls.client-hello'
  | 'tls.server-hello'
  | 'icmp.echo-request'
  | 'icmp.echo-reply'
  | 'icmp.destination-unreachable'
  | 'icmp.time-exceeded'
  | 'icmp.packet-too-big'
  | 'icmp.message';

export interface CapturedFieldReference {
  readonly frameId: string;
  readonly layerId: string;
  readonly fieldId: string;
}

export interface SemanticCapturedEvent {
  readonly id: string;
  readonly conversationId: string;
  readonly kind: CapturedEventKind;
  readonly title: string;
  readonly summary: string;
  readonly detail: string;
  readonly relativeTimeNanoseconds: bigint;
  readonly relativeTimeMs: number;
  readonly primaryFrameId: string;
  readonly supportingFrameIds: readonly string[];
  readonly fieldReferences: readonly CapturedFieldReference[];
  readonly direction: ConversationDirection;
  readonly provenance: CaptureProvenance;
  readonly uncertainty: string | null;
}

export interface CapturedLineageField {
  readonly frameId: string;
  readonly frameNumber: number;
  readonly layerId: string;
  readonly layerLabel: string;
  readonly fieldId: string;
  readonly fieldLabel: string;
  readonly displayValue: string;
  readonly byteRanges: readonly ByteRange[];
  readonly bytes: readonly string[];
  readonly provenance: 'CAPTURED';
}

export interface CapturedEventLineage {
  readonly conversationId: string;
  readonly eventId: string;
  readonly provenance: CaptureProvenance;
  readonly frameIds: readonly string[];
  readonly fields: readonly CapturedLineageField[];
}

export interface CaptureSessionMetadata {
  readonly captureId: string;
  readonly format: CaptureContainerFormat;
  readonly byteLength: number;
  readonly frameCount: number;
  readonly conversationCount: number;
  readonly eventCount: number;
  readonly interfaceCount: number;
  readonly firstTimestamp: CapturedTimestamp | null;
  readonly lastTimestamp: CapturedTimestamp | null;
  readonly durationNanoseconds: bigint;
  readonly truncatedFrameCount: number;
  readonly unsupportedFrameCount: number;
}
