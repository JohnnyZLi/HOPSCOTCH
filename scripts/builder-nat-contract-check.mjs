import assert from 'node:assert/strict';
import { defaultBuilderGraph } from '../src/builder/model.ts';
import { createDefaultBuilderAddressing, interfacesForBuilderNode } from '../src/builder/addressing.ts';
import { createDefaultBuilderRoutingConfig, setBuilderOspfEverywhere } from '../src/builder/routing.ts';
import {
  clearBuilderNatSessions,
  createDefaultBuilderNatConfig,
  pruneBuilderNatSessions,
  runBuilderNatInboundFlow,
  runBuilderNatOutboundFlow,
  upsertBuilderNatStaticMapping,
  validateBuilderNatConfig,
} from '../src/builder/nat.ts';

const graph = defaultBuilderGraph;
const addressing = createDefaultBuilderAddressing(graph);
const routing = setBuilderOspfEverywhere(graph, addressing, createDefaultBuilderRoutingConfig(), true);
let nat = createDefaultBuilderNatConfig(graph);
nat = validateBuilderNatConfig(graph, nat);
assert.equal(nat.boundaries.length, 1);
assert.equal(nat.boundaries[0].routerId, 'edge');
assert.deepEqual(nat.boundaries[0].insideLinkIds, ['client-edge']);
assert.ok(nat.boundaries[0].outsideLinkIds.includes('edge-r1'));
assert.ok(nat.boundaries[0].outsideLinkIds.includes('edge-r2'));
assert.equal(nat.boundaries[0].overloadAddress, '198.51.100.10');

const clientAddress = interfacesForBuilderNode(addressing, 'client')[0].address;
const appAddress = interfacesForBuilderNode(addressing, 'app')[0].address;

let sessions = clearBuilderNatSessions();
const outbound = runBuilderNatOutboundFlow(graph, addressing, routing, nat, sessions, 'client', 'app', 'tcp', 51515, 443, 1);
assert.equal(outbound.success, true);
assert.equal(outbound.boundaryId, 'nat-edge');
assert.equal(outbound.originalTuple.sourceAddress, clientAddress);
assert.equal(outbound.translatedTuple?.sourceAddress, '198.51.100.10');
assert.ok((outbound.translatedTuple?.sourcePort ?? 0) >= nat.patPortStart);
assert.ok((outbound.translatedTuple?.sourcePort ?? 0) <= nat.patPortEnd);
assert.equal(outbound.translation?.kind, 'pat');
assert.equal(outbound.sessions.length, 1);
sessions = outbound.sessions;

const repeated = runBuilderNatOutboundFlow(graph, addressing, routing, nat, sessions, 'client', 'app', 'tcp', 51515, 443, 2);
assert.equal(repeated.success, true);
assert.equal(repeated.translation?.id, outbound.translation?.id, 'same five-tuple reuses the PAT session');
assert.equal(repeated.translatedTuple?.sourcePort, outbound.translatedTuple?.sourcePort, 'PAT port stays deterministic for an active session');
sessions = repeated.sessions;

const inboundReply = runBuilderNatInboundFlow(
  graph,
  addressing,
  routing,
  nat,
  sessions,
  'app',
  '198.51.100.10',
  'tcp',
  443,
  repeated.translatedTuple?.sourcePort ?? null,
  3,
);
assert.equal(inboundReply.success, true);
assert.equal(inboundReply.translatedTuple?.destinationAddress, clientAddress);
assert.equal(inboundReply.translatedTuple?.destinationPort, 51515);
assert.equal(inboundReply.translation?.kind, 'pat');

const unsolicited = runBuilderNatInboundFlow(graph, addressing, routing, nat, [], 'app', '198.51.100.10', 'tcp', 443, 49999, 4);
assert.equal(unsolicited.success, false);
assert.equal(unsolicited.failureReason, 'NO NAT MAPPING');
assert.match(unsolicited.explanation, /Unsolicited inbound/);

nat = upsertBuilderNatStaticMapping(graph, nat, {
  id: 'static-client-https',
  routerId: 'edge',
  protocol: 'tcp',
  insideAddress: clientAddress,
  insidePort: 443,
  outsideAddress: '198.51.100.10',
  outsidePort: 8443,
  description: 'Publish client HTTPS teaching service',
});
const staticInbound = runBuilderNatInboundFlow(graph, addressing, routing, nat, [], 'app', '198.51.100.10', 'tcp', 53000, 8443, 5);
assert.equal(staticInbound.success, true);
assert.equal(staticInbound.translation?.kind, 'static');
assert.equal(staticInbound.translatedTuple?.destinationAddress, clientAddress);
assert.equal(staticInbound.translatedTuple?.destinationPort, 443);
assert.equal(staticInbound.sessions.length, 0, 'static mappings are configuration, not transient PAT sessions');

const udpOutbound = runBuilderNatOutboundFlow(graph, addressing, routing, nat, [], 'client', 'app', 'udp', 53530, 53, 6);
assert.equal(udpOutbound.success, true);
assert.notEqual(udpOutbound.translatedTuple?.sourcePort, 53530, 'PAT may rewrite the source port');
assert.equal(udpOutbound.translatedTuple?.destinationAddress, appAddress);
assert.equal(udpOutbound.translatedTuple?.destinationPort, 53);

const shortNat = { ...nat, sessionLifetime: 2 };
const shortFlow = runBuilderNatOutboundFlow(graph, addressing, routing, shortNat, [], 'client', 'app', 'tcp', 50100, 443, 10);
assert.equal(shortFlow.sessions.length, 1);
assert.equal(pruneBuilderNatSessions(shortNat, shortFlow.sessions, 12).length, 1);
assert.equal(pruneBuilderNatSessions(shortNat, shortFlow.sessions, 13).length, 0, 'PAT state expires deterministically by sequence');

const failoverGraph = {
  ...graph,
  links: graph.links.map((link) => link.id === 'edge-r1' ? { ...link, failed: true } : { ...link }),
};
const failover = runBuilderNatOutboundFlow(failoverGraph, addressing, routing, nat, [], 'client', 'app', 'tcp', 52000, 443, 20);
assert.equal(failover.success, true);
assert.ok(failover.forwarding?.hops.some((hop) => hop.nodeId === 'edge' && hop.linkId === 'edge-r2'), 'NAT boundary remains valid across OSPF failover because both EDGE outside links are explicit');
assert.equal(failover.translatedTuple?.sourceAddress, '198.51.100.10');

console.log('Builder NAT/PAT contract passed: explicit inside/outside boundary, deterministic PAT, session reuse/expiry, return-state matching, unsolicited inbound rejection, static port forwarding, UDP, and OSPF outside-link failover.');
