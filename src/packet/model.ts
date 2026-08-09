export type NetworkFamily = 'ipv4' | 'ipv6';
export type TransportProtocol = 'tcp' | 'udp';
export type PacketLayerId = 'ethernet' | 'network' | 'transport' | 'payload';

export type PacketConfig = {
  family: NetworkFamily;
  transport: TransportProtocol;
  payloadBytes: number;
  ttl: number;
  sourcePort: number;
  destinationPort: number;
};

export type PacketField = {
  id: string;
  label: string;
  value: string;
  offset: number;
  length: number;
  derived?: boolean;
  note?: string;
};

export type PacketSegment = {
  id: PacketLayerId;
  label: string;
  offset: number;
  length: number;
  bytes: readonly number[];
  fields: readonly PacketField[];
};

export type PacketSnapshot = {
  config: PacketConfig;
  bytes: readonly number[];
  segments: readonly PacketSegment[];
  frameBytes: number;
  networkBytes: number;
  transportBytes: number;
  payloadBytes: number;
  networkChecksum: number | null;
  transportChecksum: number;
};

export const defaultPacketConfig: PacketConfig = {
  family: 'ipv4',
  transport: 'tcp',
  payloadBytes: 96,
  ttl: 64,
  sourcePort: 51820,
  destinationPort: 443,
};

const SOURCE_MAC = [0x02, 0x48, 0x4f, 0x50, 0x00, 0x01];
const DEST_MAC = [0x02, 0x48, 0x4f, 0x50, 0x00, 0x02];
const SOURCE_IPV4 = [192, 0, 2, 10];
const DEST_IPV4 = [198, 51, 100, 42];
const SOURCE_IPV6 = [0x20, 0x01, 0x0d, 0xb8, 0x00, 0x01, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0x10];
const DEST_IPV6 = [0x20, 0x01, 0x0d, 0xb8, 0x00, 0x02, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0x42];

function clampInteger(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function word16(value: number): [number, number] {
  return [(value >>> 8) & 0xff, value & 0xff];
}

function word32(value: number): [number, number, number, number] {
  return [
    (value >>> 24) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff,
  ];
}

export function checksum16(bytes: readonly number[]): number {
  let sum = 0;
  for (let index = 0; index < bytes.length; index += 2) {
    const high = bytes[index] ?? 0;
    const low = bytes[index + 1] ?? 0;
    sum += (high << 8) | low;
    sum = (sum & 0xffff) + (sum >>> 16);
  }
  while (sum >>> 16) {
    sum = (sum & 0xffff) + (sum >>> 16);
  }
  return (~sum) & 0xffff;
}

function payloadFor(length: number): number[] {
  const seed = new TextEncoder().encode('HOPSCOTCH/RECOVERY/');
  return Array.from({ length }, (_, index) => seed[index % seed.length]);
}

function formatMac(bytes: readonly number[]): string {
  return bytes.map((byte) => byte.toString(16).padStart(2, '0')).join(':');
}

function formatIpv4(bytes: readonly number[]): string {
  return bytes.join('.');
}

function formatIpv6(bytes: readonly number[]): string {
  const groups: string[] = [];
  for (let index = 0; index < 16; index += 2) {
    groups.push((((bytes[index] ?? 0) << 8) | (bytes[index + 1] ?? 0)).toString(16));
  }
  return groups.join(':').replace(/(^|:)0:0:0:0:0(?=:|$)/, '$1:');
}

export function hex16(value: number): string {
  return `0x${value.toString(16).padStart(4, '0').toUpperCase()}`;
}

function buildEthernet(family: NetworkFamily): { bytes: number[]; fields: PacketField[] } {
  const etherType = family === 'ipv4' ? 0x0800 : 0x86dd;
  const bytes = [...DEST_MAC, ...SOURCE_MAC, ...word16(etherType)];
  return {
    bytes,
    fields: [
      { id: 'eth-dst', label: 'Destination MAC', value: formatMac(DEST_MAC), offset: 0, length: 6 },
      { id: 'eth-src', label: 'Source MAC', value: formatMac(SOURCE_MAC), offset: 6, length: 6 },
      { id: 'eth-type', label: 'EtherType', value: family === 'ipv4' ? '0x0800 · IPv4' : '0x86DD · IPv6', offset: 12, length: 2, derived: true },
    ],
  };
}

function buildIpv4(config: PacketConfig, transportLength: number): { bytes: number[]; checksum: number; fields: PacketField[] } {
  const totalLength = 20 + transportLength + config.payloadBytes;
  const protocol = config.transport === 'tcp' ? 6 : 17;
  const bytes = [
    0x45,
    0x00,
    ...word16(totalLength),
    0x4a, 0x17,
    0x40, 0x00,
    config.ttl,
    protocol,
    0x00, 0x00,
    ...SOURCE_IPV4,
    ...DEST_IPV4,
  ];
  const checksum = checksum16(bytes);
  bytes[10] = (checksum >>> 8) & 0xff;
  bytes[11] = checksum & 0xff;
  return {
    bytes,
    checksum,
    fields: [
      { id: 'ip-version', label: 'Version / IHL', value: 'IPv4 · 20 byte header', offset: 0, length: 1 },
      { id: 'ip-length', label: 'Total Length', value: `${totalLength} bytes`, offset: 2, length: 2, derived: true, note: 'IPv4 header + transport header + payload' },
      { id: 'ip-id', label: 'Identification', value: '0x4A17', offset: 4, length: 2 },
      { id: 'ip-flags', label: 'Flags / Fragment', value: 'DF · offset 0', offset: 6, length: 2 },
      { id: 'ip-ttl', label: 'TTL', value: String(config.ttl), offset: 8, length: 1 },
      { id: 'ip-protocol', label: 'Protocol', value: config.transport === 'tcp' ? '6 · TCP' : '17 · UDP', offset: 9, length: 1, derived: true },
      { id: 'ip-checksum', label: 'Header Checksum', value: hex16(checksum), offset: 10, length: 2, derived: true, note: 'One’s-complement checksum of the IPv4 header only' },
      { id: 'ip-src', label: 'Source', value: formatIpv4(SOURCE_IPV4), offset: 12, length: 4 },
      { id: 'ip-dst', label: 'Destination', value: formatIpv4(DEST_IPV4), offset: 16, length: 4 },
    ],
  };
}

function buildIpv6(config: PacketConfig, transportLength: number): { bytes: number[]; fields: PacketField[] } {
  const payloadLength = transportLength + config.payloadBytes;
  const nextHeader = config.transport === 'tcp' ? 6 : 17;
  const bytes = [
    0x60, 0x00, 0x00, 0x00,
    ...word16(payloadLength),
    nextHeader,
    config.ttl,
    ...SOURCE_IPV6,
    ...DEST_IPV6,
  ];
  return {
    bytes,
    fields: [
      { id: 'ip6-version', label: 'Version / Flow', value: 'IPv6 · flow label 0', offset: 0, length: 4 },
      { id: 'ip6-length', label: 'Payload Length', value: `${payloadLength} bytes`, offset: 4, length: 2, derived: true, note: 'Transport header + application payload' },
      { id: 'ip6-next', label: 'Next Header', value: config.transport === 'tcp' ? '6 · TCP' : '17 · UDP', offset: 6, length: 1, derived: true },
      { id: 'ip6-hop', label: 'Hop Limit', value: String(config.ttl), offset: 7, length: 1 },
      { id: 'ip6-src', label: 'Source', value: formatIpv6(SOURCE_IPV6), offset: 8, length: 16 },
      { id: 'ip6-dst', label: 'Destination', value: formatIpv6(DEST_IPV6), offset: 24, length: 16 },
      { id: 'ip6-checksum', label: 'Header Checksum', value: 'None', offset: 0, length: 0, note: 'IPv6 deliberately removed the network-header checksum.' },
    ],
  };
}

function pseudoHeader(config: PacketConfig, transportLength: number): number[] {
  const protocol = config.transport === 'tcp' ? 6 : 17;
  if (config.family === 'ipv4') {
    return [
      ...SOURCE_IPV4,
      ...DEST_IPV4,
      0,
      protocol,
      ...word16(transportLength + config.payloadBytes),
    ];
  }
  return [
    ...SOURCE_IPV6,
    ...DEST_IPV6,
    ...word32(transportLength + config.payloadBytes),
    0, 0, 0,
    protocol,
  ];
}

function buildTransport(config: PacketConfig, payload: readonly number[]): { bytes: number[]; checksum: number; fields: PacketField[] } {
  const transportLength = config.transport === 'tcp' ? 20 : 8;
  const bytes = config.transport === 'tcp'
    ? [
        ...word16(config.sourcePort),
        ...word16(config.destinationPort),
        ...word32(0x1a2b3c4d),
        ...word32(0x55667788),
        0x50, 0x18,
        ...word16(64240),
        0x00, 0x00,
        0x00, 0x00,
      ]
    : [
        ...word16(config.sourcePort),
        ...word16(config.destinationPort),
        ...word16(8 + config.payloadBytes),
        0x00, 0x00,
      ];

  let checksum = checksum16([...pseudoHeader(config, transportLength), ...bytes, ...payload]);
  if (config.transport === 'udp' && checksum === 0) checksum = 0xffff;
  const checksumOffset = config.transport === 'tcp' ? 16 : 6;
  bytes[checksumOffset] = (checksum >>> 8) & 0xff;
  bytes[checksumOffset + 1] = checksum & 0xff;

  const commonFields: PacketField[] = [
    { id: 'trans-src', label: 'Source Port', value: String(config.sourcePort), offset: 0, length: 2 },
    { id: 'trans-dst', label: 'Destination Port', value: `${config.destinationPort}${config.destinationPort === 443 ? ' · HTTPS' : ''}`, offset: 2, length: 2 },
  ];

  const fields = config.transport === 'tcp'
    ? [
        ...commonFields,
        { id: 'tcp-seq', label: 'Sequence', value: '0x1A2B3C4D', offset: 4, length: 4 },
        { id: 'tcp-ack', label: 'Acknowledgment', value: '0x55667788', offset: 8, length: 4 },
        { id: 'tcp-flags', label: 'Flags', value: 'PSH, ACK', offset: 12, length: 2 },
        { id: 'tcp-window', label: 'Window', value: '64240', offset: 14, length: 2 },
        { id: 'tcp-checksum', label: 'Checksum', value: hex16(checksum), offset: 16, length: 2, derived: true, note: 'TCP header + payload + IP pseudo-header' },
      ]
    : [
        ...commonFields,
        { id: 'udp-length', label: 'Length', value: `${8 + config.payloadBytes} bytes`, offset: 4, length: 2, derived: true },
        { id: 'udp-checksum', label: 'Checksum', value: hex16(checksum), offset: 6, length: 2, derived: true, note: 'UDP header + payload + IP pseudo-header' },
      ];

  return { bytes, checksum, fields };
}

export function buildPacket(input: PacketConfig): PacketSnapshot {
  const config: PacketConfig = {
    family: input.family,
    transport: input.transport,
    payloadBytes: clampInteger(input.payloadBytes, 16, 1400),
    ttl: clampInteger(input.ttl, 1, 255),
    sourcePort: clampInteger(input.sourcePort, 1, 65535),
    destinationPort: clampInteger(input.destinationPort, 1, 65535),
  };

  const payload = payloadFor(config.payloadBytes);
  const transportHeaderLength = config.transport === 'tcp' ? 20 : 8;
  const ethernet = buildEthernet(config.family);
  const network = config.family === 'ipv4'
    ? buildIpv4(config, transportHeaderLength)
    : buildIpv6(config, transportHeaderLength);
  const transport = buildTransport(config, payload);

  const networkOffset = ethernet.bytes.length;
  const transportOffset = networkOffset + network.bytes.length;
  const payloadOffset = transportOffset + transport.bytes.length;

  const segments: PacketSegment[] = [
    { id: 'ethernet', label: 'Ethernet II', offset: 0, length: ethernet.bytes.length, bytes: ethernet.bytes, fields: ethernet.fields },
    { id: 'network', label: config.family === 'ipv4' ? 'IPv4' : 'IPv6', offset: networkOffset, length: network.bytes.length, bytes: network.bytes, fields: network.fields },
    { id: 'transport', label: config.transport.toUpperCase(), offset: transportOffset, length: transport.bytes.length, bytes: transport.bytes, fields: transport.fields },
    {
      id: 'payload',
      label: 'Payload',
      offset: payloadOffset,
      length: payload.length,
      bytes: payload,
      fields: [{ id: 'payload-data', label: 'Application Data', value: `${payload.length} bytes · deterministic HOPSCOTCH pattern`, offset: 0, length: payload.length, derived: true }],
    },
  ];

  return {
    config,
    bytes: [...ethernet.bytes, ...network.bytes, ...transport.bytes, ...payload],
    segments,
    frameBytes: ethernet.bytes.length + network.bytes.length + transport.bytes.length + payload.length,
    networkBytes: network.bytes.length + transport.bytes.length + payload.length,
    transportBytes: transport.bytes.length + payload.length,
    payloadBytes: payload.length,
    networkChecksum: config.family === 'ipv4' ? network.checksum : null,
    transportChecksum: transport.checksum,
  };
}
