import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDefaultBuilderAddressing, interfacesForBuilderNode } from '../src/builder/addressing.ts';
import { createDefaultBuilderAclConfig, upsertBuilderAclRule } from '../src/builder/acl.ts';
import { createDefaultBuilderHostedServices, runBuilderApplicationTransaction } from '../src/builder/application.ts';
import { clearBuilderArpCache } from '../src/builder/arp.ts';
import { createDefaultBuilderDhcpConfig, clearBuilderDhcpLeases } from '../src/builder/dhcp.ts';
import { createDefaultBuilderEthernetConfig } from '../src/builder/ethernet.ts';
import { createBuilderIpv6ControlState } from '../src/builder/ipv6-control-plane.ts';
import { createDefaultBuilderIpv6RoutingDepthState } from '../src/builder/ipv6-routing-depth.ts';
import { createDefaultBuilderIpv6Config } from '../src/builder/ipv6.ts';
import { createDefaultBuilderLinkProfiles } from '../src/builder/link-characteristics.ts';
import { defaultBuilderGraph } from '../src/builder/model.ts';
import { clearBuilderNatSessions, createDefaultBuilderNatConfig } from '../src/builder/nat.ts';
import { createDefaultBuilderRoutingConfig, setBuilderOspfEverywhere } from '../src/builder/routing.ts';
import { buildPacket } from '../src/packet/model.ts';

const graph = defaultBuilderGraph;
const addressing = createDefaultBuilderAddressing(graph);
const routing = setBuilderOspfEverywhere(graph, addressing, createDefaultBuilderRoutingConfig(), true);
const ethernet = createDefaultBuilderEthernetConfig();
const ipv6 = createDefaultBuilderIpv6Config(graph, addressing, true);
const base = {
  graph,
  addressing,
  routing,
  ethernet,
  linkProfiles: createDefaultBuilderLinkProfiles(graph),
  acl: createDefaultBuilderAclConfig(),
  nat: createDefaultBuilderNatConfig(graph),
  natSessions: clearBuilderNatSessions(),
  dhcp: createDefaultBuilderDhcpConfig(ethernet),
  dhcpLeases: clearBuilderDhcpLeases(),
  dhcpSequence: 1,
  ipv6,
  ipv6ControlState: createBuilderIpv6ControlState(),
  ipv6RoutingDepth: createDefaultBuilderIpv6RoutingDepthState(graph),
  arpCache: clearBuilderArpCache(),
};

const services = createDefaultBuilderHostedServices(graph);
const kinds = new Set(services.map((service) => service.kind));
for (const kind of ['dns', 'http', 'https', 'ssh', 'tcp', 'udp']) assert.ok(kinds.has(kind), `default hosted-service catalog must exercise ${kind}`);
const h2 = services.find((service) => service.kind === 'https' && service.transportProfile === 'tcp-h2');
const h3 = services.find((service) => service.kind === 'https' && service.transportProfile === 'quic-h3');
const dns = services.find((service) => service.kind === 'dns');
const ssh = services.find((service) => service.kind === 'ssh');
const udp = services.find((service) => service.kind === 'udp');
assert.ok(h2 && h3 && dns && ssh && udp);

const transaction = runBuilderApplicationTransaction(base, services, 'client', h2.id, 'ipv4', 11);
assert.equal(transaction.success, true, transaction.summary);
assert.equal(transaction.firstBrokenBoundary, null);
assert.deepEqual(transaction.stages.map((stage) => stage.status), Array(transaction.stages.length).fill('PASS'));
assert.equal(transaction.l2.sourceMode, 'ROUTED ACCESS PROJECTION');
assert.equal(transaction.l2.destinationMode, 'ROUTED ACCESS PROJECTION');
assert.equal(transaction.l2.sourceResolution?.success, true);
assert.equal(transaction.l2.destinationResolution?.success, true);
assert.ok(transaction.ipv4Forwarding?.reachable);
assert.ok(transaction.natRequest?.success);
assert.ok(transaction.natRequest?.translation, 'default client→app request must consume existing edge PAT truth');
assert.ok(transaction.natResponse?.success, 'response must consume the active NAT session rather than bypass translation truth');
assert.ok(transaction.protocolEvents.some((event) => event.kind === 'transport.established'));
assert.ok(transaction.protocolEvents.some((event) => event.kind === 'tls.message'));
assert.ok(transaction.protocolEvents.some((event) => event.kind === 'http.request'));
assert.equal(transaction.projections.map((projection) => projection.camera).join(','), 'BUILDER,PROTOCOL,JOURNEY,PACKET');
assert.ok(transaction.packets.length >= 2);
for (const packet of transaction.packets) {
  assert.deepEqual(buildPacket(packet.config).bytes, packet.snapshot.bytes, 'Packet camera must reopen exact bytes from canonical PacketConfig');
  assert.equal(packet.provenance, 'SIMULATED');
}
assert.match(transaction.boundary, /no second transport or routing simulator/i);

const quic = runBuilderApplicationTransaction(base, services, 'client', h3.id, 'ipv4', 21);
assert.equal(quic.success, true, quic.summary);
assert.ok(quic.protocolEvents.some((event) => event.protocol === 'QUIC'));
assert.match(quic.protocolEvents.map((event) => event.protocol).join(' | '), /HTTP\/3/);
assert.equal(quic.natRequest?.originalTuple.protocol, 'udp');

for (const service of [dns, ssh, udp]) {
  const result = runBuilderApplicationTransaction(base, services, 'client', service.id, 'ipv4', 30 + service.port);
  assert.equal(result.success, true, `${service.label}: ${result.summary}`);
  if (service.kind === 'dns' || service.kind === 'udp') assert.equal(result.protocolEvents.length, 0, `${service.kind} must not invent a TCP/QUIC handshake`);
  if (service.kind === 'ssh') assert.ok(result.protocolEvents.some((event) => event.kind === 'transport.established'));
}

const sourceAddress = interfacesForBuilderNode(addressing, 'client')[0]?.address;
const appAddress = interfacesForBuilderNode(addressing, 'app')[0]?.address;
assert.ok(sourceAddress && appAddress);
const deniedAcl = upsertBuilderAclRule(graph, createDefaultBuilderAclConfig(), {
  routerId: 'edge', order: 10, action: 'deny', protocol: 'tcp', sourcePrefix: `${sourceAddress}/32`, destinationPrefix: `${appAddress}/32`, destinationPort: 443, description: 'Track D deterministic deny',
});
const denied = runBuilderApplicationTransaction({ ...base, acl: deniedAcl }, services, 'client', h2.id, 'ipv4', 71);
assert.equal(denied.success, false);
assert.equal(denied.firstBrokenBoundary, 'POLICY_NAT');
assert.equal(denied.stages.find((stage) => stage.id === 'policy-nat')?.status, 'FAIL');
for (const id of ['link', 'transport', 'tls', 'application', 'response']) assert.equal(denied.stages.find((stage) => stage.id === id)?.status, 'NOT_REACHED', `${id} must stay NOT_REACHED after ACL denial`);
assert.equal(denied.packets.length, 0, 'no transport packet bytes may be fabricated when policy fails first');

const brokenGraph = { ...graph, links: graph.links.map((link) => link.id === 'r1-core' ? { ...link, failed: true } : link) };
const brokenRouting = setBuilderOspfEverywhere(brokenGraph, addressing, createDefaultBuilderRoutingConfig(), true);
const broken = runBuilderApplicationTransaction({ ...base, graph: brokenGraph, routing: brokenRouting, linkProfiles: createDefaultBuilderLinkProfiles(brokenGraph), nat: createDefaultBuilderNatConfig(brokenGraph), ipv6RoutingDepth: createDefaultBuilderIpv6RoutingDepthState(brokenGraph) }, services, 'client', h2.id, 'ipv4', 81);
assert.equal(broken.success, true, 'OSPF should reconverge over the alternate r2 path instead of treating weighted graph failure as application failure');
assert.ok(broken.ipv4Forwarding?.hops.some((hop) => hop.nextNodeId === 'r2'));

const partitionedGraph = { ...graph, links: graph.links.map((link) => link.id === 'core-app' ? { ...link, failed: true } : link) };
const partitionedRouting = setBuilderOspfEverywhere(partitionedGraph, addressing, createDefaultBuilderRoutingConfig(), true);
const partitioned = runBuilderApplicationTransaction({ ...base, graph: partitionedGraph, routing: partitionedRouting, linkProfiles: createDefaultBuilderLinkProfiles(partitionedGraph), nat: createDefaultBuilderNatConfig(partitionedGraph), ipv6RoutingDepth: createDefaultBuilderIpv6RoutingDepthState(partitionedGraph) }, services, 'client', h2.id, 'ipv4', 91);
assert.equal(partitioned.success, false);
assert.ok(['L2', 'RESOLUTION', 'ROUTING'].includes(partitioned.firstBrokenBoundary ?? ''), partitioned.summary);
assert.equal(partitioned.stages.find((stage) => stage.id === 'transport')?.status, 'NOT_REACHED');

const ipv6Transaction = runBuilderApplicationTransaction({ ...base, ipv6ControlState: createBuilderIpv6ControlState() }, services, 'client', h3.id, 'ipv6', 101);
assert.equal(ipv6Transaction.success, true, ipv6Transaction.summary);
assert.ok(ipv6Transaction.ipv6Forwarding?.reachable);
assert.ok(ipv6Transaction.ipv6ControlState.ndHistory.length > 0, 'IPv6 application request must consume actual ND state');
assert.equal(ipv6Transaction.natRequest, null, 'Track D must not invent NAT66');

const panelSource = readFileSync(new URL('../src/BuilderApplicationPanel.tsx', import.meta.url), 'utf8');
const workspaceSource = readFileSync(new URL('../src/BuilderApplicationWorkspace.tsx', import.meta.url), 'utf8');
const builderSource = readFileSync(new URL('../src/NetworkBuilder.tsx', import.meta.url), 'utf8');
const applicationUi = `${panelSource}\n${workspaceSource}`;
assert.match(panelSource, /lazy\(\(\) => import\('\.\/BuilderApplicationWorkspace\.tsx'\)/);
assert.match(applicationUi, /ONE REQUEST · ONE CAUSAL TRUTH STACK/);
assert.match(applicationUi, /BUILDER.*PROTOCOL.*JOURNEY.*PACKET/s);
assert.match(applicationUi, /OPEN PACKET MICROSCOPE/);
assert.match(applicationUi, /initialConfig=\{packet\.config\}/);
assert.match(applicationUi, /historical/);
assert.match(builderSource, /<BuilderApplicationPanel/);
assert.match(builderSource, /onSessionState=\{\(next\)=>\{ setArpCache\(next\.arpCache\); setNatSessions\(next\.natSessions\); setDhcpLeases\(next\.dhcpLeases\); setIpv6ControlState\(next\.ipv6ControlState\); \}\}/);

console.log('Track D application contract passed: hosted DNS/HTTP/HTTPS/SSH/TCP/UDP services, shared DHCP/addressing→L2/ARP/ND→FIB→ACL/NAT→link→canonical TCP/QUIC/TLS/application truth, NOT_REACHED failure semantics, exact Packet bytes, lazy product integration, and Builder/Protocol/Journey/Packet cameras.');