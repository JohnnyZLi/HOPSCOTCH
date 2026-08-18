import assert from 'node:assert/strict';
import { parseCaptureSession } from '../src/capture/session.ts';
import {
  concatBytes,
  dnsQuery,
  dnsResponse,
  ethernetFrame,
  icmpMessage,
  ipv4Packet,
  ipv6Packet,
  pcapCapture,
  tcpIpv4Frame,
  tcpSegment,
  tlsClientHello,
  tlsServerHello,
  u16,
  u32,
  udpDatagram,
  udpIpv4Frame,
} from './capture-fixtures.mjs';

function parseFrames(frames) {
  return parseCaptureSession(pcapCapture(frames.map((bytes, index) => ({ bytes, fraction: index * 1000 })))).frames;
}

function field(frame, fieldId) {
  for (const layer of frame.layers) {
    const found = layer.fields.find((candidate) => candidate.id === fieldId);
    if (found) return found;
  }
  assert.fail(`missing field ${fieldId}`);
}

const tcpOptions = concatBytes(
  Uint8Array.of(2, 4), u16(1460),
  Uint8Array.of(3, 3, 7, 1, 4, 2, 8, 10), u32(123456), u32(654321),
);
const tlsClientFrame = tcpIpv4Frame(tlsClientHello({ serverName: 'example.test', alpn: ['h2', 'http/1.1'] }), {
  sourcePort: 50000,
  destinationPort: 443,
  sequence: 1001,
  acknowledgment: 9001,
  flags: 0x18,
  options: tcpOptions,
  vlanTags: [37],
});
const tlsServerFrame = tcpIpv4Frame(tlsServerHello(), {
  sourceAddress: '198.51.100.42',
  destinationAddress: '192.0.2.10',
  sourcePort: 443,
  destinationPort: 50000,
  sequence: 9001,
  acknowledgment: 1001,
  flags: 0x18,
});
const dnsQueryFrame = udpIpv4Frame(dnsQuery(), { sourcePort: 53000, destinationPort: 53, sourceAddress: '192.0.2.10', destinationAddress: '192.0.2.53' });
const dnsResponseFrame = udpIpv4Frame(dnsResponse(), { sourcePort: 53, destinationPort: 53000, sourceAddress: '192.0.2.53', destinationAddress: '192.0.2.10' });
const [client, server, query, response] = parseFrames([tlsClientFrame, tlsServerFrame, dnsQueryFrame, dnsResponseFrame]);

assert.equal(field(client, 'ethernet.destination').displayValue, '02:00:00:00:00:02');
assert.equal(field(client, 'vlan-0.id').value, 37);
assert.deepEqual(field(client, 'vlan-0.id').byteRanges, [{ offset: 14, length: 2 }]);
assert.equal(field(client, 'ipv4.source').value, '192.0.2.10');
assert.deepEqual(field(client, 'ipv4.source').byteRanges, [{ offset: 30, length: 4 }]);
assert.equal(field(client, 'ipv4.destination').value, '198.51.100.42');
assert.equal(field(client, 'ipv4.protocol').displayValue, '6 · TCP');
assert.match(field(client, 'ipv4.checksum').note, /does not claim checksum verification/);
assert.equal(field(client, 'tcp.source-port').value, 50000);
assert.equal(field(client, 'tcp.destination-port').value, 443);
assert.equal(field(client, 'tcp.sequence').value, 1001);
assert.equal(field(client, 'tcp.acknowledgment').value, 9001);
assert.equal(client.transport.tcp.options.mss, 1460);
assert.equal(client.transport.tcp.options.windowScale, 7);
assert.equal(client.transport.tcp.options.sackPermitted, true);
assert.equal(client.transport.tcp.options.timestampValue, 123456);
assert.equal(client.transport.tcp.options.timestampEchoReply, 654321);
assert.match(field(client, 'tcp.checksum').note, /not asserted/);
assert.ok(client.transport.tcp.payloadRange.length > 0);
assert.equal(client.tls.records[0].hello.kind, 'client-hello');
assert.equal(client.tls.records[0].hello.serverName, 'example.test');
assert.deepEqual(client.tls.records[0].hello.alpnProtocols, ['h2', 'http/1.1']);
assert.deepEqual(client.tls.records[0].hello.supportedVersions, ['TLS 1.3', 'TLS 1.2']);
assert.equal(field(client, 'tls-record-0.hello.sni').displayValue, 'example.test');
assert.equal(server.tls.records[0].hello.kind, 'server-hello');
assert.equal(server.tls.records[0].hello.selectedCipherSuite, 'TLS_AES_128_GCM_SHA256');
assert.deepEqual(server.tls.records[0].hello.supportedVersions, ['TLS 1.3']);

assert.equal(query.dns.isResponse, false);
assert.equal(query.dns.transactionId, 0x4242);
assert.equal(query.dns.questions[0].name, 'example.test');
assert.equal(query.dns.questions[0].typeLabel, 'A');
assert.equal(field(query, 'dns.query-response').displayValue, 'QUERY');
assert.equal(response.dns.isResponse, true);
assert.equal(response.dns.answers[0].name, 'example.test');
assert.equal(response.dns.answers[0].ttl, 300);
assert.equal(response.dns.answers[0].data, '203.0.113.42');
assert.equal(field(response, 'dns.answer-0.data').displayValue, '203.0.113.42');
assert.deepEqual(field(response, 'dns.answer-0.data').byteRanges.map(({ length }) => length), [4]);

const [nestedVlan] = parseFrames([tcpIpv4Frame(new Uint8Array(), { vlanTags: [37, 4094] })]);
assert.equal(field(nestedVlan, 'vlan-0.id').value, 37);
assert.equal(field(nestedVlan, 'vlan-1.id').value, 4094);

const ipv6Dns = udpDatagram(dnsQuery({ id: 0x1111, type: 28 }), { sourcePort: 53001, destinationPort: 53 });
const hopByHop = concatBytes(Uint8Array.of(17, 0), new Uint8Array(6), ipv6Dns);
const ipv6Frame = ethernetFrame(ipv6Packet(hopByHop, { nextHeader: 0 }), { etherType: 0x86dd });
const [ipv6] = parseFrames([ipv6Frame]);
assert.equal(field(ipv6, 'ipv6.version').value, 6);
assert.equal(field(ipv6, 'ipv6.source').value, '2001:db8:0:0:0:0:0:1');
assert.equal(field(ipv6, 'ipv6-extension-0.next-header').value, 17);
assert.equal(ipv6.transport.kind, 'udp');
assert.equal(ipv6.dns.questions[0].typeLabel, 'AAAA');

const icmp4Frame = ethernetFrame(ipv4Packet(icmpMessage({ family: 'ipv4', type: 8, identifier: 0x1234, sequence: 9 }), { protocol: 1 }));
const icmp6Frame = ethernetFrame(ipv6Packet(icmpMessage({ family: 'ipv6', type: 2, mtu: 1280 }), { nextHeader: 58 }), { etherType: 0x86dd });
const [icmp4, icmp6] = parseFrames([icmp4Frame, icmp6Frame]);
assert.equal(icmp4.transport.kind, 'icmp');
assert.equal(icmp4.transport.icmp.label, 'Echo Request');
assert.equal(icmp4.transport.icmp.identifier, 0x1234);
assert.equal(icmp4.transport.icmp.sequence, 9);
assert.equal(icmp6.transport.kind, 'icmpv6');
assert.equal(icmp6.transport.icmp.label, 'Packet Too Big');
assert.equal(icmp6.transport.icmp.mtu, 1280);
assert.deepEqual(field(icmp6, 'icmp.mtu').byteRanges.map(({ length }) => length), [4]);

const malformedIpv4 = tcpIpv4Frame(new Uint8Array());
malformedIpv4[14] = 0x44;
const malformedTcp = tcpIpv4Frame(new Uint8Array());
malformedTcp[14 + 20 + 12] = 0x40;
const cyclicDns = concatBytes(u16(0x2222), u16(0x0100), u16(1), u16(0), u16(0), u16(0), u16(0xc00c), u16(1), u16(1));
const cyclicDnsFrame = udpIpv4Frame(cyclicDns, { sourcePort: 53000, destinationPort: 53 });
const outOfBoundsDns = cyclicDns.slice();
outOfBoundsDns[12] = 0xc0;
outOfBoundsDns[13] = 0xff;
const outOfBoundsDnsFrame = udpIpv4Frame(outOfBoundsDns, { sourcePort: 53000, destinationPort: 53 });
const malformedTls = tlsClientHello();
malformedTls.set(u16(0xffff), 3);
const malformedTlsFrame = tcpIpv4Frame(malformedTls, { flags: 0x18 });
const malformedTlsVectorFrame = tcpIpv4Frame(tlsClientHello(), { flags: 0x18 });
const tlsBodyOffset = 14 + 20 + 20 + 5 + 4;
malformedTlsVectorFrame.set(u16(0xffff), tlsBodyOffset + 47);
const oversizedExtensionA = concatBytes(Uint8Array.of(60, 255), new Uint8Array(2046));
const oversizedExtensionB = concatBytes(Uint8Array.of(17, 255), new Uint8Array(2046));
const oversizedIpv6Extensions = ethernetFrame(ipv6Packet(concatBytes(oversizedExtensionA, oversizedExtensionB, udpDatagram(new Uint8Array())), { nextHeader: 60 }), { etherType: 0x86dd });
const inconsistentUdp = ethernetFrame(ipv4Packet(udpDatagram(Uint8Array.of(1, 2, 3), { length: 7 }), { protocol: 17 }));
const unknownProtocolFrame = ethernetFrame(ipv4Packet(Uint8Array.of(1, 2, 3), { protocol: 99 }));
const unknownEtherTypeFrame = ethernetFrame(Uint8Array.of(1, 2, 3, 4), { etherType: 0x88b5 });
const malformed = parseFrames([malformedIpv4, malformedTcp, cyclicDnsFrame, outOfBoundsDnsFrame, malformedTlsFrame, malformedTlsVectorFrame, oversizedIpv6Extensions, inconsistentUdp, unknownProtocolFrame, unknownEtherTypeFrame]);

assert.ok(malformed[0].issues.some((issue) => /IHL 4/.test(issue)));
assert.ok(malformed[1].issues.some((issue) => /data offset 16/.test(issue)));
assert.ok(malformed[2].issues.some((issue) => /Cyclic DNS/.test(issue)));
assert.ok(malformed[3].issues.some((issue) => /outside the message/.test(issue)));
assert.ok(malformed[4].issues.some((issue) => /TLS RECORD TRUNCATED/.test(issue)));
assert.ok(malformed[5].issues.some((issue) => /SNI list length/.test(issue)));
assert.ok(malformed[6].issues.some((issue) => /extension chain exceeds/.test(issue)));
assert.ok(malformed[7].issues.some((issue) => /UDP length 7/.test(issue)));
assert.ok(malformed[8].issues.some((issue) => /UNSUPPORTED IP PROTOCOL 99/.test(issue)));
assert.ok(malformed[9].issues.some((issue) => /UNKNOWN ETHERTYPE/.test(issue)));

for (const decoded of [client, server, query, response, ipv6, icmp4, icmp6, ...malformed]) {
  for (const layer of decoded.layers) {
    assert.ok(layer.byteRange.offset >= 0 && layer.byteRange.offset + layer.byteRange.length <= decoded.record.bytes.length);
    for (const capturedField of layer.fields) {
      assert.equal(capturedField.provenance, 'CAPTURED');
      for (const byteRange of capturedField.byteRanges) {
        assert.ok(byteRange.offset >= 0 && byteRange.offset + byteRange.length <= decoded.record.bytes.length, `${capturedField.id} range must remain capture-bounded`);
      }
    }
  }
}

console.log('Track T protocol contract passed: Ethernet/VLAN, IPv4/IPv6 extensions, TCP options, UDP, ICMP/v6, safe DNS compression, visible TLS metadata, exact ranges, and hostile packet bounds.');
