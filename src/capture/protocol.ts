import { CaptureParseError, assertCapturedRange, deepFreeze } from './bytes.ts';
import {
  CAPTURE_LIMITS,
  type ByteRange,
  type CapturedDnsMessage,
  type CapturedDnsQuestion,
  type CapturedDnsRecord,
  type CapturedEndpoint,
  type CapturedField,
  type CapturedFieldValue,
  type CapturedFrameEvidence,
  type CapturedFrameRecord,
  type CapturedIcmpFacts,
  type CapturedLayer,
  type CapturedLayerProtocol,
  type CapturedTcpFacts,
  type CapturedTlsHello,
  type CapturedTlsMetadata,
  type CapturedTlsRecord,
  type CapturedTransport,
  type CapturedUdpFacts,
  type IpFamily,
} from './types.ts';

type MutableDecode = {
  layers: CapturedLayer[];
  issues: string[];
  sourceIp: string | null;
  destinationIp: string | null;
  ipFamily: IpFamily | null;
  transport: CapturedTransport | null;
  dns: CapturedDnsMessage | null;
  tls: CapturedTlsMetadata | null;
};

type IpPayload = {
  family: IpFamily;
  protocol: number;
  offset: number;
  end: number;
  source: string;
  destination: string;
  fragmented: boolean;
};

function range(offset: number, length: number): ByteRange {
  return { offset, length };
}

function field(
  frameLength: number,
  id: string,
  label: string,
  value: CapturedFieldValue,
  displayValue: string,
  byteRanges: readonly ByteRange[],
  note?: string,
): CapturedField {
  byteRanges.forEach((entry) => assertCapturedRange(frameLength, entry.offset, entry.length, `${id} byte range`));
  return { id, label, value, displayValue, byteRanges: [...byteRanges], provenance: 'CAPTURED', ...(note ? { note } : {}) };
}

function layer(
  frameLength: number,
  id: string,
  protocol: CapturedLayerProtocol,
  label: string,
  byteRange: ByteRange,
  fields: readonly CapturedField[],
  status: CapturedLayer['status'] = 'complete',
  note?: string,
): CapturedLayer {
  assertCapturedRange(frameLength, byteRange.offset, byteRange.length, `${id} layer`);
  return { id, protocol, label, byteRange, fields: [...fields], status, ...(note ? { note } : {}) };
}

function hex16(value: number): string {
  return `0x${value.toString(16).padStart(4, '0').toUpperCase()}`;
}

function hex32(value: number): string {
  return `0x${value.toString(16).padStart(8, '0').toUpperCase()}`;
}

function formatMac(frame: CapturedFrameRecord, offset: number): string {
  return Array.from({ length: 6 }, (_, index) => frame.bytes.at(offset + index).toString(16).padStart(2, '0')).join(':');
}

function formatIpv4(frame: CapturedFrameRecord, offset: number): string {
  return Array.from({ length: 4 }, (_, index) => frame.bytes.at(offset + index)).join('.');
}

function formatIpv6(frame: CapturedFrameRecord, offset: number): string {
  const groups: string[] = [];
  for (let index = 0; index < 16; index += 2) groups.push(frame.bytes.readUint16(offset + index, 'big').toString(16));
  return groups.join(':');
}

function ipProtocolLabel(protocol: number): string {
  if (protocol === 1) return 'ICMP';
  if (protocol === 6) return 'TCP';
  if (protocol === 17) return 'UDP';
  if (protocol === 58) return 'ICMPv6';
  return `Protocol ${protocol}`;
}

function etherTypeLabel(etherType: number): string {
  if (etherType === 0x0800) return 'IPv4';
  if (etherType === 0x86dd) return 'IPv6';
  if (etherType === 0x8100) return '802.1Q VLAN';
  if (etherType === 0x88a8) return '802.1ad VLAN';
  return 'UNKNOWN';
}

function parseEthernet(frame: CapturedFrameRecord, state: MutableDecode): { etherType: number; payloadOffset: number } | null {
  const length = frame.bytes.length;
  if (length < 14) {
    state.layers.push(layer(length, 'ethernet', 'ethernet', 'Ethernet II', range(0, length), [], 'truncated', 'Ethernet II requires a 14-byte header.'));
    state.issues.push('TRUNCATED ETHERNET HEADER');
    return null;
  }
  const destination = formatMac(frame, 0);
  const source = formatMac(frame, 6);
  const outerEtherType = frame.bytes.readUint16(12, 'big');
  let etherType = outerEtherType;
  let etherTypeOffset = 12;
  let vlanDepth = 0;
  while (etherType === 0x8100 || etherType === 0x88a8) {
    if (vlanDepth >= 2) {
      state.issues.push('MORE THAN TWO VLAN TAGS ARE NOT DECODED IN THIS SLICE');
      break;
    }
    if (length - etherTypeOffset < 6) throw new CaptureParseError('MALFORMED_PROTOCOL', 'Truncated VLAN tag', etherTypeOffset);
    const tci = frame.bytes.readUint16(etherTypeOffset + 2, 'big');
    const innerType = frame.bytes.readUint16(etherTypeOffset + 4, 'big');
    state.layers.push(layer(length, `vlan-${vlanDepth}`, 'vlan', vlanDepth === 0 ? '802.1Q VLAN' : 'Nested VLAN', range(etherTypeOffset, 6), [
      field(length, `vlan-${vlanDepth}.tpid`, 'Tag Protocol ID', etherType, `${hex16(etherType)} · ${etherTypeLabel(etherType)}`, [range(etherTypeOffset, 2)]),
      field(length, `vlan-${vlanDepth}.priority`, 'Priority Code Point', (tci >>> 13) & 0x7, String((tci >>> 13) & 0x7), [range(etherTypeOffset + 2, 2)]),
      field(length, `vlan-${vlanDepth}.drop-eligible`, 'Drop Eligible', (tci & 0x1000) !== 0, (tci & 0x1000) !== 0 ? 'YES' : 'NO', [range(etherTypeOffset + 2, 2)]),
      field(length, `vlan-${vlanDepth}.id`, 'VLAN ID', tci & 0x0fff, String(tci & 0x0fff), [range(etherTypeOffset + 2, 2)]),
      field(length, `vlan-${vlanDepth}.ether-type`, 'Inner EtherType', innerType, `${hex16(innerType)} · ${etherTypeLabel(innerType)}`, [range(etherTypeOffset + 4, 2)]),
    ]));
    etherType = innerType;
    etherTypeOffset += 4;
    vlanDepth += 1;
  }
  const payloadOffset = etherTypeOffset + 2;
  state.layers.unshift(layer(length, 'ethernet', 'ethernet', 'Ethernet II', range(0, payloadOffset), [
    field(length, 'ethernet.destination', 'Destination MAC', destination, destination, [range(0, 6)]),
    field(length, 'ethernet.source', 'Source MAC', source, source, [range(6, 6)]),
    field(length, 'ethernet.ether-type', vlanDepth > 0 ? 'Outer EtherType' : 'EtherType', outerEtherType, `${hex16(outerEtherType)} · ${etherTypeLabel(outerEtherType)}`, [range(12, 2)]),
    ...(vlanDepth > 0 ? [field(length, 'ethernet.payload-ether-type', 'Payload EtherType', etherType, `${hex16(etherType)} · ${etherTypeLabel(etherType)}`, [range(etherTypeOffset, 2)])] : []),
  ]));
  return { etherType, payloadOffset };
}

function parseIpv4(frame: CapturedFrameRecord, offset: number, state: MutableDecode): IpPayload | null {
  const frameLength = frame.bytes.length;
  if (frameLength - offset < 20) {
    state.layers.push(layer(frameLength, 'ipv4', 'ipv4', 'IPv4', range(offset, frameLength - offset), [], 'truncated', 'IPv4 requires at least 20 captured bytes.'));
    state.issues.push('TRUNCATED IPV4 HEADER');
    return null;
  }
  const first = frame.bytes.at(offset);
  const version = first >>> 4;
  const ihlWords = first & 0x0f;
  if (version !== 4) throw new CaptureParseError('MALFORMED_PROTOCOL', `EtherType declared IPv4 but version is ${version}`, offset);
  if (ihlWords < 5) throw new CaptureParseError('MALFORMED_PROTOCOL', `IPv4 IHL ${ihlWords} is smaller than 5`, offset);
  const headerLength = ihlWords * 4;
  if (headerLength > frameLength - offset) throw new CaptureParseError('MALFORMED_PROTOCOL', `IPv4 IHL ${headerLength} exceeds captured bytes`, offset);
  const totalLength = frame.bytes.readUint16(offset + 2, 'big');
  if (totalLength < headerLength) throw new CaptureParseError('MALFORMED_PROTOCOL', `IPv4 total length ${totalLength} is smaller than header length ${headerLength}`, offset + 2);
  const packetEnd = Math.min(frameLength, offset + totalLength);
  const truncated = offset + totalLength > frameLength;
  const flagsAndOffset = frame.bytes.readUint16(offset + 6, 'big');
  const fragmentOffset = flagsAndOffset & 0x1fff;
  const moreFragments = (flagsAndOffset & 0x2000) !== 0;
  const protocol = frame.bytes.at(offset + 9);
  const source = formatIpv4(frame, offset + 12);
  const destination = formatIpv4(frame, offset + 16);
  const dscpEcn = frame.bytes.at(offset + 1);
  state.layers.push(layer(frameLength, 'ipv4', 'ipv4', 'IPv4', range(offset, headerLength), [
    field(frameLength, 'ipv4.version-ihl', 'Version / IHL', first, `IPv4 · ${headerLength} byte header`, [range(offset, 1)]),
    field(frameLength, 'ipv4.dscp-ecn', 'DSCP / ECN', dscpEcn, `DSCP ${dscpEcn >>> 2} · ECN ${dscpEcn & 0x3}`, [range(offset + 1, 1)]),
    field(frameLength, 'ipv4.total-length', 'Total Length', totalLength, `${totalLength} bytes`, [range(offset + 2, 2)]),
    field(frameLength, 'ipv4.identification', 'Identification', frame.bytes.readUint16(offset + 4, 'big'), hex16(frame.bytes.readUint16(offset + 4, 'big')), [range(offset + 4, 2)]),
    field(frameLength, 'ipv4.flags-fragment', 'Flags / Fragment Offset', flagsAndOffset, `${(flagsAndOffset & 0x4000) !== 0 ? 'DF · ' : ''}${moreFragments ? 'MF · ' : ''}offset ${fragmentOffset * 8} bytes`, [range(offset + 6, 2)]),
    field(frameLength, 'ipv4.ttl', 'TTL', frame.bytes.at(offset + 8), String(frame.bytes.at(offset + 8)), [range(offset + 8, 1)]),
    field(frameLength, 'ipv4.protocol', 'Protocol', protocol, `${protocol} · ${ipProtocolLabel(protocol)}`, [range(offset + 9, 1)]),
    field(frameLength, 'ipv4.checksum', 'Header Checksum Field', frame.bytes.readUint16(offset + 10, 'big'), hex16(frame.bytes.readUint16(offset + 10, 'big')), [range(offset + 10, 2)], 'Captured field value only; this decoder does not claim checksum verification.'),
    field(frameLength, 'ipv4.source', 'Source Address', source, source, [range(offset + 12, 4)]),
    field(frameLength, 'ipv4.destination', 'Destination Address', destination, destination, [range(offset + 16, 4)]),
  ], truncated ? 'truncated' : 'complete', truncated ? 'The IPv4 total length extends beyond the captured frame; missing bytes were not fabricated.' : undefined));
  if (truncated) state.issues.push('IPV4 PAYLOAD TRUNCATED BY CAPTURE');
  state.sourceIp = source;
  state.destinationIp = destination;
  state.ipFamily = 'ipv4';
  return { family: 'ipv4', protocol, offset: offset + headerLength, end: packetEnd, source, destination, fragmented: fragmentOffset !== 0 || moreFragments };
}

function isIpv6Extension(nextHeader: number): boolean {
  return nextHeader === 0 || nextHeader === 43 || nextHeader === 44 || nextHeader === 51 || nextHeader === 60;
}

function ipv6ExtensionLabel(nextHeader: number): string {
  if (nextHeader === 0) return 'IPv6 Hop-by-Hop Options';
  if (nextHeader === 43) return 'IPv6 Routing Header';
  if (nextHeader === 44) return 'IPv6 Fragment Header';
  if (nextHeader === 51) return 'IP Authentication Header';
  if (nextHeader === 60) return 'IPv6 Destination Options';
  return `IPv6 Extension ${nextHeader}`;
}

function parseIpv6(frame: CapturedFrameRecord, offset: number, state: MutableDecode): IpPayload | null {
  const frameLength = frame.bytes.length;
  if (frameLength - offset < 40) {
    state.layers.push(layer(frameLength, 'ipv6', 'ipv6', 'IPv6', range(offset, frameLength - offset), [], 'truncated', 'IPv6 requires a 40-byte base header.'));
    state.issues.push('TRUNCATED IPV6 HEADER');
    return null;
  }
  const firstWord = frame.bytes.readUint32(offset, 'big');
  const version = firstWord >>> 28;
  if (version !== 6) throw new CaptureParseError('MALFORMED_PROTOCOL', `EtherType declared IPv6 but version is ${version}`, offset);
  const trafficClass = (firstWord >>> 20) & 0xff;
  const flowLabel = firstWord & 0x000fffff;
  const payloadLength = frame.bytes.readUint16(offset + 4, 'big');
  let nextHeader = frame.bytes.at(offset + 6);
  const source = formatIpv6(frame, offset + 8);
  const destination = formatIpv6(frame, offset + 24);
  const declaredEnd = payloadLength === 0 ? frameLength : offset + 40 + payloadLength;
  const packetEnd = Math.min(frameLength, declaredEnd);
  const truncated = declaredEnd > frameLength;
  state.layers.push(layer(frameLength, 'ipv6', 'ipv6', 'IPv6', range(offset, 40), [
    field(frameLength, 'ipv6.version', 'Version', version, 'IPv6', [range(offset, 1)]),
    field(frameLength, 'ipv6.traffic-class', 'Traffic Class', trafficClass, `${trafficClass}`, [range(offset, 2)]),
    field(frameLength, 'ipv6.flow-label', 'Flow Label', flowLabel, `0x${flowLabel.toString(16).padStart(5, '0').toUpperCase()}`, [range(offset + 1, 3)]),
    field(frameLength, 'ipv6.payload-length', 'Payload Length', payloadLength, `${payloadLength} bytes`, [range(offset + 4, 2)]),
    field(frameLength, 'ipv6.next-header', 'Next Header', nextHeader, `${nextHeader} · ${ipProtocolLabel(nextHeader)}`, [range(offset + 6, 1)]),
    field(frameLength, 'ipv6.hop-limit', 'Hop Limit', frame.bytes.at(offset + 7), String(frame.bytes.at(offset + 7)), [range(offset + 7, 1)]),
    field(frameLength, 'ipv6.source', 'Source Address', source, source, [range(offset + 8, 16)]),
    field(frameLength, 'ipv6.destination', 'Destination Address', destination, destination, [range(offset + 24, 16)]),
  ], truncated ? 'truncated' : 'complete', truncated ? 'The IPv6 payload length extends beyond the captured frame.' : undefined));
  if (payloadLength === 0) state.issues.push('IPV6 JUMBO PAYLOAD OPTION IS NOT INTERPRETED; CAPTURE BOUNDARY USED');
  if (truncated) state.issues.push('IPV6 PAYLOAD TRUNCATED BY CAPTURE');
  state.sourceIp = source;
  state.destinationIp = destination;
  state.ipFamily = 'ipv6';

  let cursor = offset + 40;
  let traversedBytes = 0;
  let traversedHeaders = 0;
  let fragmentedPayload = false;
  let nonInitialFragment = false;
  while (isIpv6Extension(nextHeader)) {
    if (traversedHeaders >= CAPTURE_LIMITS.maxIpv6ExtensionHeaders || traversedBytes >= CAPTURE_LIMITS.maxIpv6ExtensionBytes) {
      throw new CaptureParseError('MALFORMED_PROTOCOL', 'IPv6 extension chain exceeds bounded traversal limits', cursor);
    }
    if (cursor >= packetEnd) throw new CaptureParseError('MALFORMED_PROTOCOL', 'IPv6 extension header begins beyond the captured payload', cursor);
    const extensionType = nextHeader;
    let extensionLength: number;
    if (extensionType === 44) extensionLength = 8;
    else {
      if (packetEnd - cursor < 2) throw new CaptureParseError('MALFORMED_PROTOCOL', 'Truncated IPv6 extension header', cursor);
      extensionLength = extensionType === 51 ? (frame.bytes.at(cursor + 1) + 2) * 4 : (frame.bytes.at(cursor + 1) + 1) * 8;
    }
    if (extensionLength <= 0 || extensionLength > packetEnd - cursor) throw new CaptureParseError('MALFORMED_PROTOCOL', `IPv6 extension length ${extensionLength} exceeds packet bounds`, cursor);
    if (traversedBytes + extensionLength > CAPTURE_LIMITS.maxIpv6ExtensionBytes) {
      throw new CaptureParseError('MALFORMED_PROTOCOL', 'IPv6 extension chain exceeds the bounded byte limit', cursor);
    }
    const extensionNext = frame.bytes.at(cursor);
    const fields: CapturedField[] = [
      field(frameLength, `ipv6-extension-${traversedHeaders}.next-header`, 'Next Header', extensionNext, `${extensionNext} · ${ipProtocolLabel(extensionNext)}`, [range(cursor, 1)]),
    ];
    if (extensionType === 44) {
      const fragment = frame.bytes.readUint16(cursor + 2, 'big');
      const fragmentOffset = (fragment >>> 3) & 0x1fff;
      nonInitialFragment = fragmentOffset !== 0;
      fragmentedPayload = nonInitialFragment || (fragment & 1) !== 0;
      fields.push(
        field(frameLength, `ipv6-extension-${traversedHeaders}.fragment-offset`, 'Fragment Offset / M', fragment, `offset ${fragmentOffset * 8} bytes · more ${(fragment & 1) !== 0 ? 'YES' : 'NO'}`, [range(cursor + 2, 2)]),
        field(frameLength, `ipv6-extension-${traversedHeaders}.identification`, 'Identification', frame.bytes.readUint32(cursor + 4, 'big'), hex32(frame.bytes.readUint32(cursor + 4, 'big')), [range(cursor + 4, 4)]),
      );
    } else {
      fields.push(field(frameLength, `ipv6-extension-${traversedHeaders}.length`, 'Extension Length', extensionLength, `${extensionLength} bytes`, [range(cursor + 1, 1)]));
    }
    state.layers.push(layer(frameLength, `ipv6-extension-${traversedHeaders}`, 'ipv6-extension', ipv6ExtensionLabel(extensionType), range(cursor, extensionLength), fields));
    cursor += extensionLength;
    traversedBytes += extensionLength;
    traversedHeaders += 1;
    nextHeader = extensionNext;
    if (nonInitialFragment) {
      state.issues.push('NON-INITIAL IPV6 FRAGMENT; UPPER-LAYER HEADER NOT PRESENT AT THIS VANTAGE');
      break;
    }
  }
  if (nextHeader === 50) state.issues.push('IPSEC ESP PAYLOAD IS ENCRYPTED AND NOT DECODED');
  return { family: 'ipv6', protocol: nextHeader, offset: cursor, end: packetEnd, source, destination, fragmented: fragmentedPayload };
}

function tcpFlags(frame: CapturedFrameRecord, offset: number): CapturedTcpFacts['flags'] {
  const byte12 = frame.bytes.at(offset + 12);
  const byte13 = frame.bytes.at(offset + 13);
  return {
    ns: (byte12 & 0x01) !== 0,
    cwr: (byte13 & 0x80) !== 0,
    ece: (byte13 & 0x40) !== 0,
    urg: (byte13 & 0x20) !== 0,
    ack: (byte13 & 0x10) !== 0,
    psh: (byte13 & 0x08) !== 0,
    rst: (byte13 & 0x04) !== 0,
    syn: (byte13 & 0x02) !== 0,
    fin: (byte13 & 0x01) !== 0,
  };
}

function flagLabel(flags: CapturedTcpFacts['flags']): string {
  const labels = Object.entries(flags).filter(([, enabled]) => enabled).map(([name]) => name.toUpperCase());
  return labels.length > 0 ? labels.join(', ') : 'NONE';
}

function parseTcp(frame: CapturedFrameRecord, ip: IpPayload, state: MutableDecode): void {
  const frameLength = frame.bytes.length;
  const offset = ip.offset;
  if (ip.end - offset < 20) throw new CaptureParseError('MALFORMED_PROTOCOL', 'TCP header is shorter than 20 bytes', offset);
  const dataOffsetBytes = (frame.bytes.at(offset + 12) >>> 4) * 4;
  if (dataOffsetBytes < 20) throw new CaptureParseError('MALFORMED_PROTOCOL', `TCP data offset ${dataOffsetBytes} is smaller than 20`, offset + 12);
  if (dataOffsetBytes > ip.end - offset) throw new CaptureParseError('MALFORMED_PROTOCOL', `TCP data offset ${dataOffsetBytes} exceeds IP payload`, offset + 12);
  const sourcePort = frame.bytes.readUint16(offset, 'big');
  const destinationPort = frame.bytes.readUint16(offset + 2, 'big');
  const sequenceNumber = frame.bytes.readUint32(offset + 4, 'big');
  const acknowledgmentNumber = frame.bytes.readUint32(offset + 8, 'big');
  const flags = tcpFlags(frame, offset);
  const payloadRange = range(offset + dataOffsetBytes, ip.end - (offset + dataOffsetBytes));
  let mss: number | null = null;
  let windowScale: number | null = null;
  let sackPermitted = false;
  let timestampValue: number | null = null;
  let timestampEchoReply: number | null = null;
  const fields: CapturedField[] = [
    field(frameLength, 'tcp.source-port', 'Source Port', sourcePort, String(sourcePort), [range(offset, 2)]),
    field(frameLength, 'tcp.destination-port', 'Destination Port', destinationPort, String(destinationPort), [range(offset + 2, 2)]),
    field(frameLength, 'tcp.sequence', 'Sequence Number', sequenceNumber, String(sequenceNumber), [range(offset + 4, 4)]),
    field(frameLength, 'tcp.acknowledgment', 'Acknowledgment Number', acknowledgmentNumber, String(acknowledgmentNumber), [range(offset + 8, 4)]),
    field(frameLength, 'tcp.data-offset', 'Header / Data Offset', dataOffsetBytes, `${dataOffsetBytes} bytes`, [range(offset + 12, 1)]),
    field(frameLength, 'tcp.flags', 'Flags', frame.bytes.readUint16(offset + 12, 'big') & 0x01ff, flagLabel(flags), [range(offset + 12, 2)]),
    field(frameLength, 'tcp.window', 'Advertised Window', frame.bytes.readUint16(offset + 14, 'big'), String(frame.bytes.readUint16(offset + 14, 'big')), [range(offset + 14, 2)]),
    field(frameLength, 'tcp.checksum', 'Checksum Field', frame.bytes.readUint16(offset + 16, 'big'), hex16(frame.bytes.readUint16(offset + 16, 'big')), [range(offset + 16, 2)], 'Captured field value only; checksum validity is not asserted.'),
    field(frameLength, 'tcp.urgent-pointer', 'Urgent Pointer', frame.bytes.readUint16(offset + 18, 'big'), String(frame.bytes.readUint16(offset + 18, 'big')), [range(offset + 18, 2)]),
  ];
  let optionOffset = offset + 20;
  let optionIndex = 0;
  while (optionOffset < offset + dataOffsetBytes) {
    const kind = frame.bytes.at(optionOffset);
    if (kind === 0) {
      fields.push(field(frameLength, `tcp.option-${optionIndex}`, 'TCP Option', 0, 'END', [range(optionOffset, 1)]));
      break;
    }
    if (kind === 1) {
      fields.push(field(frameLength, `tcp.option-${optionIndex}`, 'TCP Option', 1, 'NOP', [range(optionOffset, 1)]));
      optionOffset += 1;
      optionIndex += 1;
      continue;
    }
    if (offset + dataOffsetBytes - optionOffset < 2) throw new CaptureParseError('MALFORMED_PROTOCOL', 'TCP option is missing its length byte', optionOffset);
    const optionLength = frame.bytes.at(optionOffset + 1);
    if (optionLength < 2 || optionLength > offset + dataOffsetBytes - optionOffset) throw new CaptureParseError('MALFORMED_PROTOCOL', `Invalid TCP option length ${optionLength}`, optionOffset + 1);
    let label = `OPTION ${kind}`;
    let value: CapturedFieldValue = kind;
    let display = `${optionLength} bytes`;
    if (kind === 2 && optionLength === 4) {
      mss = frame.bytes.readUint16(optionOffset + 2, 'big'); label = 'Maximum Segment Size'; value = mss; display = `${mss} bytes`;
    } else if (kind === 3 && optionLength === 3) {
      windowScale = frame.bytes.at(optionOffset + 2); label = 'Window Scale'; value = windowScale; display = String(windowScale);
    } else if (kind === 4 && optionLength === 2) {
      sackPermitted = true; label = 'SACK Permitted'; value = true; display = 'YES';
    } else if (kind === 8 && optionLength === 10) {
      timestampValue = frame.bytes.readUint32(optionOffset + 2, 'big');
      timestampEchoReply = frame.bytes.readUint32(optionOffset + 6, 'big');
      label = 'TCP Timestamps'; value = timestampValue; display = `TSval ${timestampValue} · TSecr ${timestampEchoReply}`;
    }
    fields.push(field(frameLength, `tcp.option-${optionIndex}`, label, value, display, [range(optionOffset, optionLength)]));
    optionOffset += optionLength;
    optionIndex += 1;
  }
  state.layers.push(layer(frameLength, 'tcp', 'tcp', 'TCP', range(offset, dataOffsetBytes), fields));
  const tcp: CapturedTcpFacts = {
    sequenceNumber,
    acknowledgmentNumber,
    dataOffsetBytes,
    flags,
    window: frame.bytes.readUint16(offset + 14, 'big'),
    checksum: frame.bytes.readUint16(offset + 16, 'big'),
    urgentPointer: frame.bytes.readUint16(offset + 18, 'big'),
    payloadRange,
    options: { mss, windowScale, sackPermitted, timestampValue, timestampEchoReply },
  };
  state.transport = {
    kind: 'tcp',
    source: { family: ip.family, address: ip.source, port: sourcePort },
    destination: { family: ip.family, address: ip.destination, port: destinationPort },
    tcp,
    udp: null,
    icmp: null,
  };
  if (payloadRange.length > 0) parseTcpApplication(frame, payloadRange, sourcePort, destinationPort, state);
}

function parseUdp(frame: CapturedFrameRecord, ip: IpPayload, state: MutableDecode): void {
  const frameLength = frame.bytes.length;
  const offset = ip.offset;
  if (ip.end - offset < 8) throw new CaptureParseError('MALFORMED_PROTOCOL', 'UDP header is shorter than 8 bytes', offset);
  const sourcePort = frame.bytes.readUint16(offset, 'big');
  const destinationPort = frame.bytes.readUint16(offset + 2, 'big');
  const udpLength = frame.bytes.readUint16(offset + 4, 'big');
  if (udpLength < 8) throw new CaptureParseError('MALFORMED_PROTOCOL', `UDP length ${udpLength} is smaller than 8`, offset + 4);
  const declaredEnd = offset + udpLength;
  const payloadEnd = Math.min(ip.end, declaredEnd);
  const truncated = declaredEnd > ip.end;
  const payloadRange = range(offset + 8, Math.max(0, payloadEnd - (offset + 8)));
  const checksum = frame.bytes.readUint16(offset + 6, 'big');
  state.layers.push(layer(frameLength, 'udp', 'udp', 'UDP', range(offset, 8), [
    field(frameLength, 'udp.source-port', 'Source Port', sourcePort, String(sourcePort), [range(offset, 2)]),
    field(frameLength, 'udp.destination-port', 'Destination Port', destinationPort, String(destinationPort), [range(offset + 2, 2)]),
    field(frameLength, 'udp.length', 'UDP Length', udpLength, `${udpLength} bytes`, [range(offset + 4, 2)]),
    field(frameLength, 'udp.checksum', 'Checksum Field', checksum, hex16(checksum), [range(offset + 6, 2)], 'Captured field value only; checksum validity is not asserted.'),
  ], truncated ? 'truncated' : 'complete', truncated ? 'UDP length extends beyond the capture/IP boundary.' : undefined));
  if (truncated) state.issues.push('UDP PAYLOAD TRUNCATED OR LENGTH INCONSISTENT');
  else if (declaredEnd < ip.end) state.issues.push('IP PAYLOAD CONTAINS BYTES BEYOND THE DECLARED UDP LENGTH; TRAILING BYTES WERE NOT ASSIGNED TO UDP');
  const udp: CapturedUdpFacts = { length: udpLength, checksum, payloadRange };
  state.transport = {
    kind: 'udp',
    source: { family: ip.family, address: ip.source, port: sourcePort },
    destination: { family: ip.family, address: ip.destination, port: destinationPort },
    tcp: null,
    udp,
    icmp: null,
  };
  if ((sourcePort === 53 || destinationPort === 53) && payloadRange.length > 0) parseDns(frame, payloadRange, state);
  else if (payloadRange.length > 0) addPayloadLayer(frame, payloadRange, state, 'UDP payload');
}

function icmpLabel(family: IpFamily, type: number, code: number): string {
  if (family === 'ipv4') {
    if (type === 8) return 'Echo Request';
    if (type === 0) return 'Echo Reply';
    if (type === 3) return code === 4 ? 'Destination Unreachable · Fragmentation Needed' : 'Destination Unreachable';
    if (type === 11) return 'Time Exceeded';
  } else {
    if (type === 128) return 'Echo Request';
    if (type === 129) return 'Echo Reply';
    if (type === 1) return 'Destination Unreachable';
    if (type === 2) return 'Packet Too Big';
    if (type === 3) return 'Time Exceeded';
  }
  return `${family === 'ipv4' ? 'ICMP' : 'ICMPv6'} type ${type} code ${code}`;
}

function parseIcmp(frame: CapturedFrameRecord, ip: IpPayload, state: MutableDecode): void {
  const frameLength = frame.bytes.length;
  const offset = ip.offset;
  if (ip.end - offset < 4) throw new CaptureParseError('MALFORMED_PROTOCOL', 'ICMP header is shorter than 4 bytes', offset);
  const type = frame.bytes.at(offset);
  const code = frame.bytes.at(offset + 1);
  const echo = (ip.family === 'ipv4' && (type === 8 || type === 0)) || (ip.family === 'ipv6' && (type === 128 || type === 129));
  const packetTooBig = ip.family === 'ipv6' && type === 2;
  const fragmentationNeeded = ip.family === 'ipv4' && type === 3 && code === 4;
  let identifier: number | null = null;
  let sequence: number | null = null;
  let mtu: number | null = null;
  const fields: CapturedField[] = [
    field(frameLength, 'icmp.type', 'Type', type, `${type} · ${icmpLabel(ip.family, type, code)}`, [range(offset, 1)]),
    field(frameLength, 'icmp.code', 'Code', code, String(code), [range(offset + 1, 1)]),
    field(frameLength, 'icmp.checksum', 'Checksum Field', frame.bytes.readUint16(offset + 2, 'big'), hex16(frame.bytes.readUint16(offset + 2, 'big')), [range(offset + 2, 2)], 'Captured field value only; checksum validity is not asserted.'),
  ];
  if (echo) {
    if (ip.end - offset < 8) throw new CaptureParseError('MALFORMED_PROTOCOL', 'ICMP echo header is shorter than 8 bytes', offset);
    identifier = frame.bytes.readUint16(offset + 4, 'big');
    sequence = frame.bytes.readUint16(offset + 6, 'big');
    fields.push(
      field(frameLength, 'icmp.identifier', 'Identifier', identifier, hex16(identifier), [range(offset + 4, 2)]),
      field(frameLength, 'icmp.sequence', 'Sequence', sequence, String(sequence), [range(offset + 6, 2)]),
    );
  } else if (packetTooBig) {
    if (ip.end - offset < 8) throw new CaptureParseError('MALFORMED_PROTOCOL', 'ICMPv6 Packet Too Big header is shorter than 8 bytes', offset);
    mtu = frame.bytes.readUint32(offset + 4, 'big');
    fields.push(field(frameLength, 'icmp.mtu', 'Next-hop MTU', mtu, `${mtu} bytes`, [range(offset + 4, 4)]));
  } else if (fragmentationNeeded) {
    if (ip.end - offset < 8) throw new CaptureParseError('MALFORMED_PROTOCOL', 'ICMP fragmentation-needed header is shorter than 8 bytes', offset);
    mtu = frame.bytes.readUint16(offset + 6, 'big');
    fields.push(field(frameLength, 'icmp.mtu', 'Next-hop MTU', mtu, `${mtu} bytes`, [range(offset + 6, 2)]));
  }
  const protocol = ip.family === 'ipv4' ? 'icmp' : 'icmpv6';
  state.layers.push(layer(frameLength, protocol, protocol, protocol === 'icmp' ? 'ICMP' : 'ICMPv6', range(offset, ip.end - offset), fields));
  const icmp: CapturedIcmpFacts = { type, code, label: icmpLabel(ip.family, type, code), identifier, sequence, mtu };
  state.transport = {
    kind: protocol,
    source: { family: ip.family, address: ip.source, port: null },
    destination: { family: ip.family, address: ip.destination, port: null },
    tcp: null,
    udp: null,
    icmp,
  };
}

function addPayloadLayer(frame: CapturedFrameRecord, payload: ByteRange, state: MutableDecode, labelText: string): void {
  if (payload.length <= 0) return;
  state.layers.push(layer(frame.bytes.length, `payload-${payload.offset}`, 'payload', labelText, payload, [
    field(frame.bytes.length, `payload-${payload.offset}.bytes`, 'Captured Payload', payload.length, `${payload.length} bytes`, [payload]),
  ]));
}

type DnsName = { name: string; nextOffset: number; ranges: readonly ByteRange[] };

function mergeRanges(ranges: readonly ByteRange[]): readonly ByteRange[] {
  const sorted = [...ranges].sort((a, b) => a.offset - b.offset || a.length - b.length);
  const merged: ByteRange[] = [];
  for (const current of sorted) {
    const previous = merged.at(-1);
    if (previous && current.offset <= previous.offset + previous.length) {
      const end = Math.max(previous.offset + previous.length, current.offset + current.length);
      merged[merged.length - 1] = { offset: previous.offset, length: end - previous.offset };
    } else merged.push({ ...current });
  }
  return merged;
}

function dnsLabel(frame: CapturedFrameRecord, offset: number, length: number): string {
  let text = '';
  for (let index = 0; index < length; index += 1) {
    const byte = frame.bytes.at(offset + index);
    text += byte >= 0x21 && byte <= 0x7e ? String.fromCharCode(byte) : `\\x${byte.toString(16).padStart(2, '0')}`;
  }
  return text;
}

function parseDnsName(frame: CapturedFrameRecord, start: number, messageStart: number, messageEnd: number): DnsName {
  let cursor = start;
  let nextOffset = start;
  let jumped = false;
  let depth = 0;
  let expandedLength = 0;
  const visited = new Set<number>();
  const labels: string[] = [];
  const ranges: ByteRange[] = [];
  while (true) {
    if (cursor < messageStart || cursor >= messageEnd) throw new CaptureParseError('MALFORMED_PROTOCOL', 'DNS name cursor is outside the message', cursor);
    const length = frame.bytes.at(cursor);
    if ((length & 0xc0) === 0xc0) {
      if (messageEnd - cursor < 2) throw new CaptureParseError('MALFORMED_PROTOCOL', 'Truncated DNS compression pointer', cursor);
      const pointer = ((length & 0x3f) << 8) | frame.bytes.at(cursor + 1);
      const target = messageStart + pointer;
      if (target < messageStart || target >= messageEnd) throw new CaptureParseError('MALFORMED_PROTOCOL', 'DNS compression pointer is outside the message', cursor);
      ranges.push(range(cursor, 2));
      if (!jumped) nextOffset = cursor + 2;
      if (visited.has(target)) throw new CaptureParseError('MALFORMED_PROTOCOL', 'Cyclic DNS compression pointer', cursor);
      visited.add(target);
      depth += 1;
      if (depth > CAPTURE_LIMITS.maxDnsPointerDepth) throw new CaptureParseError('MALFORMED_PROTOCOL', 'DNS compression pointer depth exceeded', cursor);
      cursor = target;
      jumped = true;
      continue;
    }
    if ((length & 0xc0) !== 0) throw new CaptureParseError('MALFORMED_PROTOCOL', `Invalid DNS label length byte ${length}`, cursor);
    ranges.push(range(cursor, 1));
    cursor += 1;
    if (length === 0) {
      if (!jumped) nextOffset = cursor;
      break;
    }
    if (length > 63 || length > messageEnd - cursor) throw new CaptureParseError('MALFORMED_PROTOCOL', `Invalid or truncated DNS label length ${length}`, cursor - 1);
    ranges.push(range(cursor, length));
    labels.push(dnsLabel(frame, cursor, length));
    expandedLength += length + 1;
    if (expandedLength > 255 || labels.length > 128) throw new CaptureParseError('MALFORMED_PROTOCOL', 'DNS name exceeds bounded decoded length', start);
    cursor += length;
    if (!jumped) nextOffset = cursor;
  }
  return { name: labels.length > 0 ? labels.join('.') : '.', nextOffset, ranges: mergeRanges(ranges) };
}

function dnsTypeLabel(type: number): string {
  const names: Readonly<Record<number, string>> = { 1: 'A', 2: 'NS', 5: 'CNAME', 6: 'SOA', 12: 'PTR', 15: 'MX', 16: 'TXT', 28: 'AAAA', 33: 'SRV', 41: 'OPT' };
  return names[type] ?? `TYPE${type}`;
}

function dnsRdata(frame: CapturedFrameRecord, type: number, offset: number, length: number, messageStart: number, messageEnd: number): string {
  const end = offset + length;
  if (end > messageEnd) throw new CaptureParseError('MALFORMED_PROTOCOL', 'DNS RDATA exceeds the message', offset);
  if (type === 1 && length === 4) return formatIpv4(frame, offset);
  if (type === 28 && length === 16) return formatIpv6(frame, offset);
  if ([2, 5, 12].includes(type)) {
    const parsed = parseDnsName(frame, offset, messageStart, messageEnd);
    if (parsed.nextOffset > end) throw new CaptureParseError('MALFORMED_PROTOCOL', 'DNS compressed-name RDATA exceeds RDLENGTH', offset);
    return parsed.name;
  }
  if (type === 15 && length >= 3) {
    const preference = frame.bytes.readUint16(offset, 'big');
    const parsed = parseDnsName(frame, offset + 2, messageStart, messageEnd);
    if (parsed.nextOffset > end) throw new CaptureParseError('MALFORMED_PROTOCOL', 'DNS MX RDATA exceeds RDLENGTH', offset);
    return `${preference} ${parsed.name}`;
  }
  if (type === 33 && length >= 7) {
    const priority = frame.bytes.readUint16(offset, 'big');
    const weight = frame.bytes.readUint16(offset + 2, 'big');
    const port = frame.bytes.readUint16(offset + 4, 'big');
    const parsed = parseDnsName(frame, offset + 6, messageStart, messageEnd);
    if (parsed.nextOffset > end) throw new CaptureParseError('MALFORMED_PROTOCOL', 'DNS SRV RDATA exceeds RDLENGTH', offset);
    return `${priority} ${weight} ${port} ${parsed.name}`;
  }
  if (type === 16) {
    const values: string[] = [];
    let cursor = offset;
    while (cursor < end) {
      const textLength = frame.bytes.at(cursor);
      cursor += 1;
      if (textLength > end - cursor) throw new CaptureParseError('MALFORMED_PROTOCOL', 'DNS TXT string exceeds RDLENGTH', cursor - 1);
      values.push(dnsLabel(frame, cursor, textLength));
      cursor += textLength;
    }
    return values.map((value) => `"${value}"`).join(' ');
  }
  const shown = Math.min(length, 32);
  return `${frame.bytes.hex(offset, shown)}${length > shown ? ' …' : ''}`;
}

function parseDns(frame: CapturedFrameRecord, payload: ByteRange, state: MutableDecode, tcpLengthPrefix = false): void {
  let messageStart = payload.offset;
  let messageLength = payload.length;
  if (tcpLengthPrefix) {
    if (messageLength < 2) throw new CaptureParseError('MALFORMED_PROTOCOL', 'DNS-over-TCP payload lacks the two-byte message length', messageStart);
    const declared = frame.bytes.readUint16(messageStart, 'big');
    messageStart += 2;
    messageLength -= 2;
    if (declared > messageLength) throw new CaptureParseError('MALFORMED_PROTOCOL', 'DNS-over-TCP message is truncated', messageStart);
    if (declared < messageLength) state.issues.push('ADDITIONAL DNS-OVER-TCP BYTES ARE PRESENT; THIS SLICE DECODES ONLY THE FIRST LENGTH-PREFIXED MESSAGE IN A FRAME');
    messageLength = declared;
  }
  const messageEnd = messageStart + messageLength;
  if (messageLength < 12) throw new CaptureParseError('MALFORMED_PROTOCOL', 'DNS header is shorter than 12 bytes', messageStart);
  const transactionId = frame.bytes.readUint16(messageStart, 'big');
  const flags = frame.bytes.readUint16(messageStart + 2, 'big');
  const questionCount = frame.bytes.readUint16(messageStart + 4, 'big');
  const answerCount = frame.bytes.readUint16(messageStart + 6, 'big');
  const authorityCount = frame.bytes.readUint16(messageStart + 8, 'big');
  const additionalCount = frame.bytes.readUint16(messageStart + 10, 'big');
  if (questionCount > CAPTURE_LIMITS.maxDnsQuestions) throw new CaptureParseError('MALFORMED_PROTOCOL', `DNS question count ${questionCount} exceeds the bounded limit`, messageStart + 4);
  if (answerCount + authorityCount + additionalCount > CAPTURE_LIMITS.maxDnsRecords) throw new CaptureParseError('MALFORMED_PROTOCOL', 'DNS record count exceeds the bounded limit', messageStart + 6);
  const fields: CapturedField[] = [
    field(frame.bytes.length, 'dns.transaction-id', 'Transaction ID', transactionId, hex16(transactionId), [range(messageStart, 2)]),
    field(frame.bytes.length, 'dns.query-response', 'Query / Response', (flags & 0x8000) !== 0, (flags & 0x8000) !== 0 ? 'RESPONSE' : 'QUERY', [range(messageStart + 2, 2)]),
    field(frame.bytes.length, 'dns.opcode', 'Opcode', (flags >>> 11) & 0xf, String((flags >>> 11) & 0xf), [range(messageStart + 2, 2)]),
    field(frame.bytes.length, 'dns.flags', 'AA / TC / RD / RA', flags, `AA ${(flags & 0x0400) !== 0 ? 1 : 0} · TC ${(flags & 0x0200) !== 0 ? 1 : 0} · RD ${(flags & 0x0100) !== 0 ? 1 : 0} · RA ${(flags & 0x0080) !== 0 ? 1 : 0}`, [range(messageStart + 2, 2)]),
    field(frame.bytes.length, 'dns.rcode', 'Response Code', flags & 0xf, String(flags & 0xf), [range(messageStart + 2, 2)]),
    field(frame.bytes.length, 'dns.question-count', 'Question Count', questionCount, String(questionCount), [range(messageStart + 4, 2)]),
    field(frame.bytes.length, 'dns.answer-count', 'Answer Count', answerCount, String(answerCount), [range(messageStart + 6, 2)]),
    field(frame.bytes.length, 'dns.authority-count', 'Authority Count', authorityCount, String(authorityCount), [range(messageStart + 8, 2)]),
    field(frame.bytes.length, 'dns.additional-count', 'Additional Count', additionalCount, String(additionalCount), [range(messageStart + 10, 2)]),
  ];
  const questions: CapturedDnsQuestion[] = [];
  const answers: CapturedDnsRecord[] = [];
  const authorities: CapturedDnsRecord[] = [];
  const additionals: CapturedDnsRecord[] = [];
  let cursor = messageStart + 12;
  for (let index = 0; index < questionCount; index += 1) {
    const name = parseDnsName(frame, cursor, messageStart, messageEnd);
    cursor = name.nextOffset;
    if (messageEnd - cursor < 4) throw new CaptureParseError('MALFORMED_PROTOCOL', 'Truncated DNS question tail', cursor);
    const type = frame.bytes.readUint16(cursor, 'big');
    const rrClass = frame.bytes.readUint16(cursor + 2, 'big');
    questions.push({ name: name.name, type, typeLabel: dnsTypeLabel(type), class: rrClass });
    fields.push(
      field(frame.bytes.length, `dns.question-${index}.name`, `Question ${index + 1} Name`, name.name, name.name, name.ranges),
      field(frame.bytes.length, `dns.question-${index}.type`, `Question ${index + 1} Type`, type, dnsTypeLabel(type), [range(cursor, 2)]),
      field(frame.bytes.length, `dns.question-${index}.class`, `Question ${index + 1} Class`, rrClass, String(rrClass), [range(cursor + 2, 2)]),
    );
    cursor += 4;
  }
  const parseRecords = (count: number, target: CapturedDnsRecord[], section: string) => {
    for (let index = 0; index < count; index += 1) {
      const name = parseDnsName(frame, cursor, messageStart, messageEnd);
      cursor = name.nextOffset;
      if (messageEnd - cursor < 10) throw new CaptureParseError('MALFORMED_PROTOCOL', `Truncated DNS ${section} record header`, cursor);
      const type = frame.bytes.readUint16(cursor, 'big');
      const rrClass = frame.bytes.readUint16(cursor + 2, 'big');
      const ttl = frame.bytes.readUint32(cursor + 4, 'big');
      const dataLength = frame.bytes.readUint16(cursor + 8, 'big');
      const dataOffset = cursor + 10;
      if (dataLength > messageEnd - dataOffset) throw new CaptureParseError('MALFORMED_PROTOCOL', `DNS ${section} RDATA exceeds the message`, dataOffset);
      const data = dnsRdata(frame, type, dataOffset, dataLength, messageStart, messageEnd);
      target.push({ name: name.name, type, typeLabel: dnsTypeLabel(type), class: rrClass, ttl, data });
      const prefix = `dns.${section}-${index}`;
      fields.push(
        field(frame.bytes.length, `${prefix}.name`, `${section} ${index + 1} Name`, name.name, name.name, name.ranges),
        field(frame.bytes.length, `${prefix}.type`, `${section} ${index + 1} Type`, type, dnsTypeLabel(type), [range(cursor, 2)]),
        field(frame.bytes.length, `${prefix}.ttl`, `${section} ${index + 1} TTL`, ttl, `${ttl} s`, [range(cursor + 4, 4)]),
        field(frame.bytes.length, `${prefix}.data`, `${section} ${index + 1} Data`, data, data, [range(dataOffset, dataLength)]),
      );
      cursor = dataOffset + dataLength;
    }
  };
  parseRecords(answerCount, answers, 'answer');
  parseRecords(authorityCount, authorities, 'authority');
  parseRecords(additionalCount, additionals, 'additional');
  state.layers.push(layer(frame.bytes.length, 'dns', 'dns', 'DNS', range(messageStart, messageLength), fields));
  state.dns = {
    transactionId,
    isResponse: (flags & 0x8000) !== 0,
    opcode: (flags >>> 11) & 0xf,
    authoritative: (flags & 0x0400) !== 0,
    truncated: (flags & 0x0200) !== 0,
    recursionDesired: (flags & 0x0100) !== 0,
    recursionAvailable: (flags & 0x0080) !== 0,
    rcode: flags & 0xf,
    questions,
    answers,
    authorities,
    additionals,
  };
}

function tlsVersion(value: number): string {
  if (value === 0x0304) return 'TLS 1.3';
  if (value === 0x0303) return 'TLS 1.2';
  if (value === 0x0302) return 'TLS 1.1';
  if (value === 0x0301) return 'TLS 1.0';
  return hex16(value);
}

function tlsContentType(value: number): string {
  return ({ 20: 'ChangeCipherSpec', 21: 'Alert', 22: 'Handshake', 23: 'Application Data', 24: 'Heartbeat' } as Record<number, string>)[value] ?? `Type ${value}`;
}

function cipherSuite(value: number): string {
  return ({ 0x1301: 'TLS_AES_128_GCM_SHA256', 0x1302: 'TLS_AES_256_GCM_SHA384', 0x1303: 'TLS_CHACHA20_POLY1305_SHA256' } as Record<number, string>)[value] ?? hex16(value);
}

function ascii(frame: CapturedFrameRecord, offset: number, length: number): string {
  let value = '';
  for (let index = 0; index < length; index += 1) {
    const byte = frame.bytes.at(offset + index);
    if (byte < 0x20 || byte > 0x7e) throw new CaptureParseError('MALFORMED_PROTOCOL', 'TLS text extension contains non-printable bytes', offset + index);
    value += String.fromCharCode(byte);
  }
  return value;
}

type TlsExtensions = {
  serverName: string | null;
  alpnProtocols: string[];
  supportedVersions: string[];
  fields: CapturedField[];
};

function parseTlsExtensions(frame: CapturedFrameRecord, offset: number, end: number, prefix: string, serverHello: boolean): TlsExtensions {
  let cursor = offset;
  let serverName: string | null = null;
  const alpnProtocols: string[] = [];
  const supportedVersions: string[] = [];
  const fields: CapturedField[] = [];
  let extensionIndex = 0;
  while (cursor < end) {
    if (extensionIndex >= CAPTURE_LIMITS.maxTlsExtensionsPerHello) throw new CaptureParseError('MALFORMED_PROTOCOL', 'TLS extension count exceeds the bounded decoder limit', cursor);
    if (end - cursor < 4) throw new CaptureParseError('MALFORMED_PROTOCOL', 'Truncated TLS extension header', cursor);
    const type = frame.bytes.readUint16(cursor, 'big');
    const length = frame.bytes.readUint16(cursor + 2, 'big');
    const dataOffset = cursor + 4;
    const dataEnd = dataOffset + length;
    if (dataEnd > end) throw new CaptureParseError('MALFORMED_PROTOCOL', `TLS extension ${type} exceeds its hello`, cursor);
    fields.push(field(frame.bytes.length, `${prefix}.extension-${extensionIndex}`, `Extension ${type}`, type, `${type} · ${length} bytes`, [range(cursor, 4)]));
    if (type === 0) {
      if (length < 2) throw new CaptureParseError('MALFORMED_PROTOCOL', 'TLS SNI extension lacks its list length', dataOffset);
      const listLength = frame.bytes.readUint16(dataOffset, 'big');
      if (listLength !== length - 2) throw new CaptureParseError('MALFORMED_PROTOCOL', 'TLS SNI list length does not match its extension', dataOffset);
      let nameCursor = dataOffset + 2;
      const listEnd = nameCursor + listLength;
      let nameCount = 0;
      while (nameCursor < listEnd) {
        if (nameCount >= CAPTURE_LIMITS.maxTlsNamesPerExtension) throw new CaptureParseError('MALFORMED_PROTOCOL', 'TLS SNI name count exceeds the bounded decoder limit', nameCursor);
        if (listEnd - nameCursor < 3) throw new CaptureParseError('MALFORMED_PROTOCOL', 'Truncated TLS SNI entry', nameCursor);
        const nameType = frame.bytes.at(nameCursor);
        const nameLength = frame.bytes.readUint16(nameCursor + 1, 'big');
        if (nameLength > listEnd - (nameCursor + 3)) throw new CaptureParseError('MALFORMED_PROTOCOL', 'TLS SNI name exceeds list', nameCursor + 1);
        if (nameType === 0 && serverName === null) {
          serverName = ascii(frame, nameCursor + 3, nameLength);
          fields.push(field(frame.bytes.length, `${prefix}.sni`, 'Server Name', serverName, serverName, [range(nameCursor + 3, nameLength)]));
        }
        nameCursor += 3 + nameLength;
        nameCount += 1;
      }
    } else if (type === 16) {
      if (length < 2) throw new CaptureParseError('MALFORMED_PROTOCOL', 'TLS ALPN extension lacks its list length', dataOffset);
      const listLength = frame.bytes.readUint16(dataOffset, 'big');
      if (listLength !== length - 2) throw new CaptureParseError('MALFORMED_PROTOCOL', 'TLS ALPN list length does not match its extension', dataOffset);
      let protocolCursor = dataOffset + 2;
      const listEnd = protocolCursor + listLength;
      while (protocolCursor < listEnd) {
        if (alpnProtocols.length >= CAPTURE_LIMITS.maxTlsAlpnProtocols) throw new CaptureParseError('MALFORMED_PROTOCOL', 'TLS ALPN protocol count exceeds the bounded decoder limit', protocolCursor);
        const protocolLength = frame.bytes.at(protocolCursor);
        protocolCursor += 1;
        if (protocolLength > listEnd - protocolCursor) throw new CaptureParseError('MALFORMED_PROTOCOL', 'TLS ALPN value exceeds list', protocolCursor - 1);
        const protocol = ascii(frame, protocolCursor, protocolLength);
        alpnProtocols.push(protocol);
        fields.push(field(frame.bytes.length, `${prefix}.alpn-${alpnProtocols.length - 1}`, 'ALPN Protocol', protocol, protocol, [range(protocolCursor, protocolLength)]));
        protocolCursor += protocolLength;
      }
    } else if (type === 43) {
      if (serverHello) {
        if (length !== 2) throw new CaptureParseError('MALFORMED_PROTOCOL', 'ServerHello supported_versions must be two bytes', dataOffset);
        supportedVersions.push(tlsVersion(frame.bytes.readUint16(dataOffset, 'big')));
        fields.push(field(frame.bytes.length, `${prefix}.supported-version`, 'Selected TLS Version', frame.bytes.readUint16(dataOffset, 'big'), supportedVersions[0] ?? '', [range(dataOffset, 2)]));
      } else {
        if (length < 1) throw new CaptureParseError('MALFORMED_PROTOCOL', 'ClientHello supported_versions is empty', dataOffset);
        const listLength = frame.bytes.at(dataOffset);
        if (listLength % 2 !== 0 || listLength !== length - 1) throw new CaptureParseError('MALFORMED_PROTOCOL', 'ClientHello supported_versions list is malformed', dataOffset);
        if (listLength / 2 > CAPTURE_LIMITS.maxTlsSupportedVersions) throw new CaptureParseError('MALFORMED_PROTOCOL', 'TLS supported-version count exceeds the bounded decoder limit', dataOffset);
        for (let versionOffset = dataOffset + 1; versionOffset < dataOffset + 1 + listLength; versionOffset += 2) {
          supportedVersions.push(tlsVersion(frame.bytes.readUint16(versionOffset, 'big')));
        }
        fields.push(field(frame.bytes.length, `${prefix}.supported-versions`, 'Supported TLS Versions', supportedVersions.join(', '), supportedVersions.join(', '), [range(dataOffset + 1, listLength)]));
      }
    }
    cursor = dataEnd;
    extensionIndex += 1;
  }
  return { serverName, alpnProtocols, supportedVersions, fields };
}

function parseTlsHello(frame: CapturedFrameRecord, type: number, bodyOffset: number, bodyEnd: number, prefix: string, fields: CapturedField[]): CapturedTlsHello | null {
  if (type !== 1 && type !== 2) return null;
  if (bodyEnd - bodyOffset < 35) throw new CaptureParseError('MALFORMED_PROTOCOL', 'TLS hello is shorter than its fixed fields', bodyOffset);
  const serverHello = type === 2;
  const legacyVersionValue = frame.bytes.readUint16(bodyOffset, 'big');
  let cursor = bodyOffset + 34;
  const sessionLength = frame.bytes.at(cursor);
  cursor += 1;
  if (sessionLength > bodyEnd - cursor) throw new CaptureParseError('MALFORMED_PROTOCOL', 'TLS session ID exceeds hello', cursor - 1);
  cursor += sessionLength;
  let selectedCipherSuite: string | null = null;
  if (serverHello) {
    if (bodyEnd - cursor < 3) throw new CaptureParseError('MALFORMED_PROTOCOL', 'Truncated ServerHello cipher/compression fields', cursor);
    const selected = frame.bytes.readUint16(cursor, 'big');
    selectedCipherSuite = cipherSuite(selected);
    fields.push(field(frame.bytes.length, `${prefix}.cipher-suite`, 'Selected Cipher Suite', selected, selectedCipherSuite, [range(cursor, 2)]));
    cursor += 3;
  } else {
    if (bodyEnd - cursor < 2) throw new CaptureParseError('MALFORMED_PROTOCOL', 'Truncated ClientHello cipher-suite length', cursor);
    const suitesLength = frame.bytes.readUint16(cursor, 'big');
    cursor += 2;
    if (suitesLength % 2 !== 0 || suitesLength > bodyEnd - cursor) throw new CaptureParseError('MALFORMED_PROTOCOL', 'ClientHello cipher-suite list is malformed', cursor - 2);
    fields.push(field(frame.bytes.length, `${prefix}.cipher-suites`, 'Offered Cipher Suites', suitesLength / 2, `${suitesLength / 2} suites`, [range(cursor, suitesLength)]));
    cursor += suitesLength;
    if (bodyEnd - cursor < 1) throw new CaptureParseError('MALFORMED_PROTOCOL', 'ClientHello lacks compression methods', cursor);
    const compressionLength = frame.bytes.at(cursor);
    cursor += 1;
    if (compressionLength > bodyEnd - cursor) throw new CaptureParseError('MALFORMED_PROTOCOL', 'ClientHello compression methods exceed hello', cursor - 1);
    cursor += compressionLength;
  }
  let extensions: TlsExtensions = { serverName: null, alpnProtocols: [], supportedVersions: [], fields: [] };
  if (cursor < bodyEnd) {
    if (bodyEnd - cursor < 2) throw new CaptureParseError('MALFORMED_PROTOCOL', 'TLS hello extension length is truncated', cursor);
    const extensionsLength = frame.bytes.readUint16(cursor, 'big');
    cursor += 2;
    if (extensionsLength !== bodyEnd - cursor) throw new CaptureParseError('MALFORMED_PROTOCOL', 'TLS extension length does not match the hello body', cursor - 2);
    extensions = parseTlsExtensions(frame, cursor, cursor + extensionsLength, prefix, serverHello);
    fields.push(...extensions.fields);
  }
  fields.push(field(frame.bytes.length, `${prefix}.legacy-version`, 'Legacy Version', legacyVersionValue, tlsVersion(legacyVersionValue), [range(bodyOffset, 2)], 'TLS 1.3 ClientHello/ServerHello retains a legacy version field; supported_versions carries the modern version signal.'));
  return {
    kind: serverHello ? 'server-hello' : 'client-hello',
    legacyVersion: tlsVersion(legacyVersionValue),
    serverName: extensions.serverName,
    alpnProtocols: extensions.alpnProtocols,
    supportedVersions: extensions.supportedVersions,
    selectedCipherSuite,
  };
}

function parseTls(frame: CapturedFrameRecord, payload: ByteRange, state: MutableDecode): void {
  const end = payload.offset + payload.length;
  if (payload.length < 3) return;
  const firstType = frame.bytes.at(payload.offset);
  const firstMajor = frame.bytes.at(payload.offset + 1);
  if (![20, 21, 22, 23, 24].includes(firstType) || firstMajor !== 3) return;
  const records: CapturedTlsRecord[] = [];
  let cursor = payload.offset;
  let recordIndex = 0;
  let handshakeCount = 0;
  while (cursor < end && recordIndex < CAPTURE_LIMITS.maxTlsRecordsPerFrame) {
    if (end - cursor < 5) {
      state.layers.push(layer(frame.bytes.length, `tls-record-${recordIndex}`, 'tls', 'TLS Record', range(cursor, end - cursor), [], 'truncated', 'TLS record header is incomplete in this frame.'));
      state.issues.push('TLS RECORD HEADER TRUNCATED IN CAPTURE');
      break;
    }
    const contentType = frame.bytes.at(cursor);
    const versionValue = frame.bytes.readUint16(cursor + 1, 'big');
    const recordLength = frame.bytes.readUint16(cursor + 3, 'big');
    const bodyOffset = cursor + 5;
    const recordEnd = bodyOffset + recordLength;
    const availableEnd = Math.min(end, recordEnd);
    const fields: CapturedField[] = [
      field(frame.bytes.length, `tls-record-${recordIndex}.content-type`, 'Record Content Type', contentType, `${contentType} · ${tlsContentType(contentType)}`, [range(cursor, 1)]),
      field(frame.bytes.length, `tls-record-${recordIndex}.legacy-version`, 'Record Version Field', versionValue, tlsVersion(versionValue), [range(cursor + 1, 2)]),
      field(frame.bytes.length, `tls-record-${recordIndex}.length`, 'Record Length', recordLength, `${recordLength} bytes`, [range(cursor + 3, 2)]),
    ];
    let hello: CapturedTlsHello | null = null;
    if (recordEnd > end) {
      state.layers.push(layer(frame.bytes.length, `tls-record-${recordIndex}`, 'tls', 'TLS Record', range(cursor, availableEnd - cursor), fields, 'truncated', `Declared TLS record length ${recordLength} exceeds captured TCP payload.`));
      state.issues.push('TLS RECORD TRUNCATED; CROSS-FRAME REASSEMBLY IS NOT CLAIMED');
      records.push({ contentType, contentTypeLabel: tlsContentType(contentType), legacyVersion: tlsVersion(versionValue), length: recordLength, hello: null });
      break;
    }
    if (contentType === 22) {
      let handshakeOffset = bodyOffset;
      while (handshakeOffset < recordEnd && handshakeCount < CAPTURE_LIMITS.maxTlsHandshakeMessagesPerFrame) {
        if (recordEnd - handshakeOffset < 4) throw new CaptureParseError('MALFORMED_PROTOCOL', 'TLS handshake header is truncated', handshakeOffset);
        const handshakeType = frame.bytes.at(handshakeOffset);
        const handshakeLength = frame.bytes.readUint24BE(handshakeOffset + 1);
        const handshakeBody = handshakeOffset + 4;
        const handshakeEnd = handshakeBody + handshakeLength;
        if (handshakeEnd > recordEnd) throw new CaptureParseError('MALFORMED_PROTOCOL', `TLS handshake length ${handshakeLength} exceeds its record`, handshakeOffset + 1);
        fields.push(field(frame.bytes.length, `tls-record-${recordIndex}.handshake-${handshakeCount}`, 'Handshake Message', handshakeType, handshakeType === 1 ? 'ClientHello' : handshakeType === 2 ? 'ServerHello' : `Type ${handshakeType}`, [range(handshakeOffset, 4)]));
        const parsedHello = parseTlsHello(frame, handshakeType, handshakeBody, handshakeEnd, `tls-record-${recordIndex}.hello`, fields);
        if (parsedHello && hello === null) hello = parsedHello;
        handshakeOffset = handshakeEnd;
        handshakeCount += 1;
      }
      if (handshakeOffset < recordEnd) state.issues.push('TLS HANDSHAKE MESSAGE COUNT EXCEEDED BOUNDED PER-FRAME DECODER LIMIT');
    }
    state.layers.push(layer(frame.bytes.length, `tls-record-${recordIndex}`, 'tls', 'TLS Record', range(cursor, recordEnd - cursor), fields));
    records.push({ contentType, contentTypeLabel: tlsContentType(contentType), legacyVersion: tlsVersion(versionValue), length: recordLength, hello });
    cursor = recordEnd;
    recordIndex += 1;
  }
  if (recordIndex >= CAPTURE_LIMITS.maxTlsRecordsPerFrame && cursor < end) state.issues.push('TLS RECORD COUNT EXCEEDED BOUNDED PER-FRAME DECODER LIMIT');
  if (records.length > 0) state.tls = { records };
}

function parseTcpApplication(frame: CapturedFrameRecord, payload: ByteRange, sourcePort: number, destinationPort: number, state: MutableDecode): void {
  if (sourcePort === 53 || destinationPort === 53) {
    parseDns(frame, payload, state, true);
    return;
  }
  if (sourcePort === 443 || destinationPort === 443 || sourcePort === 853 || destinationPort === 853) {
    parseTls(frame, payload, state);
    if (state.tls) return;
  }
  addPayloadLayer(frame, payload, state, 'TCP payload');
}

function parseUpperLayer(frame: CapturedFrameRecord, ip: IpPayload, state: MutableDecode): void {
  if (ip.fragmented) {
    state.issues.push('FRAGMENTED IP PAYLOAD; COMPLETE UPPER-LAYER MESSAGE IS NOT ASSUMED');
    return;
  }
  if (ip.offset > ip.end) throw new CaptureParseError('MALFORMED_PROTOCOL', 'IP upper-layer offset exceeds payload end', ip.offset);
  if (ip.protocol === 6) parseTcp(frame, ip, state);
  else if (ip.protocol === 17) parseUdp(frame, ip, state);
  else if ((ip.family === 'ipv4' && ip.protocol === 1) || (ip.family === 'ipv6' && ip.protocol === 58)) parseIcmp(frame, ip, state);
  else if (ip.protocol !== 59 && ip.protocol !== 50) state.issues.push(`UNSUPPORTED IP PROTOCOL ${ip.protocol}; BYTES REMAIN CAPTURED BUT UNINTERPRETED`);
}

export function decodeCapturedFrame(record: CapturedFrameRecord): CapturedFrameEvidence {
  const state: MutableDecode = {
    layers: [], issues: [], sourceIp: null, destinationIp: null, ipFamily: null, transport: null, dns: null, tls: null,
  };
  if (record.linkType !== 1) {
    state.layers.push(layer(record.bytes.length, 'unknown-link', 'unknown', record.linkTypeLabel, range(0, record.bytes.length), [], 'unsupported', 'Unsupported link type was not decoded as Ethernet.'));
    state.issues.push(`${record.linkTypeLabel.toUpperCase()} IS NOT DECODED`);
  } else {
    try {
      const ethernet = parseEthernet(record, state);
      if (ethernet) {
        const ip = ethernet.etherType === 0x0800
          ? parseIpv4(record, ethernet.payloadOffset, state)
          : ethernet.etherType === 0x86dd
            ? parseIpv6(record, ethernet.payloadOffset, state)
            : null;
        if (ip) parseUpperLayer(record, ip, state);
        else if (ethernet.etherType !== 0x0800 && ethernet.etherType !== 0x86dd) {
          state.issues.push(`UNKNOWN ETHERTYPE ${hex16(ethernet.etherType)}; PAYLOAD NOT INTERPRETED`);
        }
      }
    } catch (error) {
      if (error instanceof CaptureParseError) state.issues.push(`${error.code}: ${error.message}`);
      else state.issues.push(`MALFORMED_PROTOCOL: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return deepFreeze({
    record,
    layers: state.layers,
    sourceIp: state.sourceIp,
    destinationIp: state.destinationIp,
    ipFamily: state.ipFamily,
    transport: state.transport,
    dns: state.dns,
    tls: state.tls,
    issues: [...new Set(state.issues)],
    provenance: 'CAPTURED',
  });
}

export function endpointDisplay(endpoint: CapturedEndpoint): string {
  const address = endpoint.family === 'ipv6' && endpoint.port !== null ? `[${endpoint.address}]` : endpoint.address;
  return endpoint.port === null ? address : `${address}:${endpoint.port}`;
}
