function bytes(value) {
  return value instanceof Uint8Array ? value : Uint8Array.from(value);
}

export function concatBytes(...parts) {
  const normalized = parts.flat().map(bytes);
  const result = new Uint8Array(normalized.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of normalized) { result.set(part, offset); offset += part.length; }
  return result;
}

export function u16(value, order = 'big') {
  return order === 'big'
    ? Uint8Array.of((value >>> 8) & 0xff, value & 0xff)
    : Uint8Array.of(value & 0xff, (value >>> 8) & 0xff);
}

export function u24(value) {
  return Uint8Array.of((value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff);
}

export function u32(value, order = 'big') {
  const unsigned = Number(value) >>> 0;
  return order === 'big'
    ? Uint8Array.of((unsigned >>> 24) & 0xff, (unsigned >>> 16) & 0xff, (unsigned >>> 8) & 0xff, unsigned & 0xff)
    : Uint8Array.of(unsigned & 0xff, (unsigned >>> 8) & 0xff, (unsigned >>> 16) & 0xff, (unsigned >>> 24) & 0xff);
}

export function ipv4Address(value) {
  return Uint8Array.from(value.split('.').map(Number));
}

export function ipv6Address(groups) {
  return concatBytes(groups.map((group) => u16(typeof group === 'number' ? group : Number.parseInt(group, 16))));
}

export function checksum16(input) {
  const data = bytes(input);
  let sum = 0;
  for (let index = 0; index < data.length; index += 2) {
    sum += (data[index] << 8) | (data[index + 1] ?? 0);
    sum = (sum & 0xffff) + (sum >>> 16);
  }
  while (sum >>> 16) sum = (sum & 0xffff) + (sum >>> 16);
  return (~sum) & 0xffff;
}

export function ethernetFrame(payload, {
  etherType = 0x0800,
  source = [0x02, 0x00, 0x00, 0x00, 0x00, 0x01],
  destination = [0x02, 0x00, 0x00, 0x00, 0x00, 0x02],
  vlanTags = [],
} = {}) {
  const header = [bytes(destination), bytes(source)];
  for (const [index, vlan] of vlanTags.entries()) {
    header.push(u16(index === 0 ? 0x8100 : 0x88a8), u16(vlan & 0x0fff));
  }
  header.push(u16(etherType));
  return concatBytes(header, payload);
}

export function ipv4Packet(payload, {
  source = '192.0.2.10',
  destination = '198.51.100.42',
  protocol = 6,
  ttl = 64,
  identification = 0x1234,
  flagsFragment = 0x4000,
  ihlWords = 5,
  totalLength = null,
} = {}) {
  const headerLength = ihlWords * 4;
  const header = new Uint8Array(Math.max(20, headerLength));
  header[0] = (4 << 4) | ihlWords;
  header.set(u16(totalLength ?? (headerLength + payload.length)), 2);
  header.set(u16(identification), 4);
  header.set(u16(flagsFragment), 6);
  header[8] = ttl;
  header[9] = protocol;
  header.set(ipv4Address(source), 12);
  header.set(ipv4Address(destination), 16);
  if (headerLength >= 20) header.set(u16(checksum16(header.subarray(0, headerLength))), 10);
  return concatBytes(header.subarray(0, headerLength), payload);
}

export function ipv6Packet(payload, {
  source = [0x2001, 0x0db8, 0, 0, 0, 0, 0, 1],
  destination = [0x2001, 0x0db8, 0, 0, 0, 0, 0, 2],
  nextHeader = 17,
  hopLimit = 64,
  trafficClass = 0,
  flowLabel = 0,
  payloadLength = null,
} = {}) {
  const first = (6 * 0x10000000) + ((trafficClass & 0xff) * 0x100000) + (flowLabel & 0xfffff);
  return concatBytes(
    u32(first),
    u16(payloadLength ?? payload.length),
    Uint8Array.of(nextHeader, hopLimit),
    ipv6Address(source),
    ipv6Address(destination),
    payload,
  );
}

export function tcpSegment(payload = new Uint8Array(), {
  sourcePort = 50000,
  destinationPort = 443,
  sequence = 1000,
  acknowledgment = 0,
  flags = 0x02,
  window = 64240,
  options = new Uint8Array(),
  dataOffsetWords = null,
} = {}) {
  const paddedOptions = options.length % 4 === 0 ? bytes(options) : concatBytes(options, new Uint8Array(4 - (options.length % 4)));
  const headerLength = 20 + paddedOptions.length;
  const dataOffset = dataOffsetWords ?? (headerLength / 4);
  return concatBytes(
    u16(sourcePort), u16(destinationPort), u32(sequence), u32(acknowledgment),
    Uint8Array.of((dataOffset << 4) & 0xf0, flags & 0xff),
    u16(window), u16(0), u16(0), paddedOptions, payload,
  );
}

export function udpDatagram(payload, { sourcePort = 53000, destinationPort = 53, length = null } = {}) {
  return concatBytes(u16(sourcePort), u16(destinationPort), u16(length ?? (8 + payload.length)), u16(0), payload);
}

export function icmpMessage({ family = 'ipv4', type = null, code = 0, identifier = 0x4242, sequence = 1, mtu = 1280, payload = new Uint8Array() } = {}) {
  const resolvedType = type ?? (family === 'ipv4' ? 8 : 128);
  const tail = family === 'ipv6' && resolvedType === 2 ? u32(mtu) : concatBytes(u16(identifier), u16(sequence));
  const message = concatBytes(Uint8Array.of(resolvedType, code), u16(0), tail, payload);
  message.set(u16(checksum16(message)), 2);
  return message;
}

export function dnsName(value) {
  if (value === '.') return Uint8Array.of(0);
  return concatBytes(value.split('.').map((label) => concatBytes(Uint8Array.of(label.length), new TextEncoder().encode(label))), Uint8Array.of(0));
}

export function dnsQuery({ id = 0x4242, name = 'example.test', type = 1 } = {}) {
  return concatBytes(u16(id), u16(0x0100), u16(1), u16(0), u16(0), u16(0), dnsName(name), u16(type), u16(1));
}

export function dnsResponse({ id = 0x4242, name = 'example.test', address = '203.0.113.42', ttl = 300 } = {}) {
  const question = concatBytes(dnsName(name), u16(1), u16(1));
  const answer = concatBytes(u16(0xc00c), u16(1), u16(1), u32(ttl), u16(4), ipv4Address(address));
  return concatBytes(u16(id), u16(0x8180), u16(1), u16(1), u16(0), u16(0), question, answer);
}

function tlsExtension(type, data) {
  return concatBytes(u16(type), u16(data.length), data);
}

export function tlsClientHello({ serverName = 'example.test', alpn = ['h2'] } = {}) {
  const serverBytes = new TextEncoder().encode(serverName);
  const sniEntry = concatBytes(Uint8Array.of(0), u16(serverBytes.length), serverBytes);
  const sni = tlsExtension(0, concatBytes(u16(sniEntry.length), sniEntry));
  const alpnValues = concatBytes(alpn.map((value) => {
    const encoded = new TextEncoder().encode(value);
    return concatBytes(Uint8Array.of(encoded.length), encoded);
  }));
  const alpnExtension = tlsExtension(16, concatBytes(u16(alpnValues.length), alpnValues));
  const versions = tlsExtension(43, Uint8Array.of(4, 0x03, 0x04, 0x03, 0x03));
  const extensions = concatBytes(sni, alpnExtension, versions);
  const body = concatBytes(
    u16(0x0303), new Uint8Array(32).fill(0x11), Uint8Array.of(0),
    u16(2), u16(0x1301), Uint8Array.of(1, 0), u16(extensions.length), extensions,
  );
  const handshake = concatBytes(Uint8Array.of(1), u24(body.length), body);
  return concatBytes(Uint8Array.of(22), u16(0x0301), u16(handshake.length), handshake);
}

export function tlsServerHello() {
  const versions = tlsExtension(43, u16(0x0304));
  const body = concatBytes(
    u16(0x0303), new Uint8Array(32).fill(0x22), Uint8Array.of(0),
    u16(0x1301), Uint8Array.of(0), u16(versions.length), versions,
  );
  const handshake = concatBytes(Uint8Array.of(2), u24(body.length), body);
  return concatBytes(Uint8Array.of(22), u16(0x0303), u16(handshake.length), handshake);
}

export function pcapCapture(frames, { order = 'little', nanoseconds = false, linkType = 1, snapLength = 262144 } = {}) {
  const magic = order === 'little'
    ? (nanoseconds ? Uint8Array.of(0x4d, 0x3c, 0xb2, 0xa1) : Uint8Array.of(0xd4, 0xc3, 0xb2, 0xa1))
    : (nanoseconds ? Uint8Array.of(0xa1, 0xb2, 0x3c, 0x4d) : Uint8Array.of(0xa1, 0xb2, 0xc3, 0xd4));
  const global = concatBytes(magic, u16(2, order), u16(4, order), u32(0, order), u32(0, order), u32(snapLength, order), u32(linkType, order));
  const records = frames.map((frame, index) => {
    const data = bytes(frame.bytes);
    return concatBytes(
      u32(frame.seconds ?? 1_700_000_000, order),
      u32(frame.fraction ?? index * (nanoseconds ? 1_000_000 : 1_000), order),
      u32(frame.capturedLength ?? data.length, order),
      u32(frame.originalLength ?? data.length, order),
      data,
    );
  });
  return concatBytes(global, records);
}

function pad32(data) {
  const value = bytes(data);
  return value.length % 4 === 0 ? value : concatBytes(value, new Uint8Array(4 - (value.length % 4)));
}

function pcapngOption(code, data, order) {
  const value = bytes(data);
  return concatBytes(u16(code, order), u16(value.length, order), pad32(value));
}

function pcapngBlock(type, body, order) {
  const paddedBody = pad32(body);
  const length = 12 + paddedBody.length;
  return concatBytes(u32(type, order), u32(length, order), paddedBody, u32(length, order));
}

export function pcapngSection({ order = 'little', interfaces = [{ linkType: 1, snapLength: 262144, tsresol: 9 }], packets = [], includeUnknownBlock = false } = {}) {
  const sectionBody = concatBytes(u32(0x1a2b3c4d, order), u16(1, order), u16(0, order), new Uint8Array(8).fill(0xff));
  const section = pcapngBlock(0x0a0d0d0a, sectionBody, order);
  const idbs = interfaces.map((record) => {
    const options = record.tsresol === undefined
      ? new Uint8Array()
      : concatBytes(pcapngOption(9, Uint8Array.of(record.tsresol), order), pcapngOption(0, new Uint8Array(), order));
    return pcapngBlock(1, concatBytes(u16(record.linkType ?? 1, order), u16(0, order), u32(record.snapLength ?? 262144, order), options), order);
  });
  const unknown = includeUnknownBlock ? [pcapngBlock(0x00000bad, Uint8Array.of(1, 2, 3, 4), order)] : [];
  const epbs = packets.map((packet, index) => {
    const data = bytes(packet.bytes);
    const ticks = BigInt(packet.ticks ?? (1_700_000_000_000_000_000n + BigInt(index * 1_000_000)));
    const high = Number((ticks >> 32n) & 0xffffffffn);
    const low = Number(ticks & 0xffffffffn);
    const packetOptions = pcapngOption(0, new Uint8Array(), order);
    return pcapngBlock(6, concatBytes(
      u32(packet.interfaceId ?? 0, order), u32(high, order), u32(low, order),
      u32(packet.capturedLength ?? data.length, order), u32(packet.originalLength ?? data.length, order),
      pad32(data), packetOptions,
    ), order);
  });
  return concatBytes(section, idbs, unknown, epbs);
}

export function tcpIpv4Frame(payload = new Uint8Array(), options = {}) {
  const segment = tcpSegment(payload, options);
  return ethernetFrame(ipv4Packet(segment, {
    source: options.sourceAddress ?? '192.0.2.10',
    destination: options.destinationAddress ?? '198.51.100.42',
    protocol: 6,
    identification: options.identification ?? 0x1234,
  }), { vlanTags: options.vlanTags ?? [] });
}

export function udpIpv4Frame(payload, options = {}) {
  const datagram = udpDatagram(payload, options);
  return ethernetFrame(ipv4Packet(datagram, {
    source: options.sourceAddress ?? '192.0.2.53',
    destination: options.destinationAddress ?? '198.51.100.9',
    protocol: 17,
  }));
}
