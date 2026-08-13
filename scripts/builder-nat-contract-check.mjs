import assert from 'node:assert/strict';
import { defaultBuilderGraph, defaultBuilderLayout } from '../src/builder/model.ts';
import { createDefaultBuilderAddressing, interfacesForBuilderNode } from '../src/builder/addressing.ts';
import { createDefaultBuilderRoutingConfig, setBuilderOspfEverywhere } from '../src/builder/routing.ts';
import { createDefaultBuilderAclConfig, upsertBuilderAclRule } from '../src/builder/acl.ts';
import { createDefaultBuilderLinkProfiles } from '../src/builder/link-characteristics.ts';
import { createDefaultBuilderEthernetConfig } from '../src/builder/ethernet.ts';
import { createBuilderScenario, deserializeBuilderScenario, serializeBuilderScenario } from '../src/builder/scenario.ts';
import { runBuilderProbe } from '../src/builder/probes.ts';
import {
  clearBuilderNatSessions,
  createDefaultBuilderNatConfig,
  pruneBuilderNatSessions,
  runBuilderNatInboundFlow,
  runBuilderNatOutboundFlow,
  upsertBuilderNatStaticAddress,
  upsertBuilderNatStaticMapping,
  validateBuilderNatConfig,
} from '../src/builder/nat.ts';

const graph = defaultBuilderGraph;
const addressing = createDefaultBuilderAddressing(graph);
const routing = setBuilderOspfEverywhere(graph, addressing, createDefaultBuilderRoutingConfig(), true);
const linkProfiles = createDefaultBuilderLinkProfiles(graph);
const defaultAcl = createDefaultBuilderAclConfig();
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
assert.ok(outbound.policyStages.some((stage) => stage.routerId === 'edge' && stage.phase === 'pre-nat' && stage.boundary));
assert.ok(outbound.policyStages.some((stage) => stage.routerId === 'edge' && stage.phase === 'post-nat' && stage.boundary));
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
assert.equal(staticInbound.translation?.kind, 'static-port');
assert.equal(staticInbound.translatedTuple?.destinationAddress, clientAddress);
assert.equal(staticInbound.translatedTuple?.destinationPort, 443);
assert.equal(staticInbound.sessions.length, 0, 'static mappings are configuration, not transient PAT sessions');

nat = upsertBuilderNatStaticAddress(graph, nat, {
  id: 'static-client-address',
  routerId: 'edge',
  insideAddress: clientAddress,
  outsideAddress: '198.51.100.20',
  description: 'One-to-one client publication',
});
const oneToOneOutbound = runBuilderNatOutboundFlow(graph, addressing, routing, nat, [], 'client', 'app', 'tcp', 52001, 443, 6);
assert.equal(oneToOneOutbound.success, true);
assert.equal(oneToOneOutbound.translation?.kind, 'static-address');
assert.equal(oneToOneOutbound.translatedTuple?.sourceAddress, '198.51.100.20');
assert.equal(oneToOneOutbound.translatedTuple?.sourcePort, 52001, 'one-to-one NAT preserves transport ports');
assert.equal(oneToOneOutbound.sessions.length, 0, 'static one-to-one NAT is configuration, not session state');
const oneToOneInbound = runBuilderNatInboundFlow(graph, addressing, routing, nat, [], 'app', '198.51.100.20', 'udp', 53000, 5353, 7);
assert.equal(oneToOneInbound.success, true);
assert.equal(oneToOneInbound.translation?.kind, 'static-address');
assert.equal(oneToOneInbound.translatedTuple?.destinationAddress, clientAddress);
assert.equal(oneToOneInbound.translatedTuple?.destinationPort, 5353);

const natWithoutOneToOne = { ...nat, staticAddresses: [] };
const udpOutbound = runBuilderNatOutboundFlow(graph, addressing, routing, natWithoutOneToOne, [], 'client', 'app', 'udp', 53530, 53, 8);
assert.equal(udpOutbound.success, true);
assert.notEqual(udpOutbound.translatedTuple?.sourcePort, 53530, 'PAT may rewrite the source port');
assert.equal(udpOutbound.translatedTuple?.destinationAddress, appAddress);
assert.equal(udpOutbound.translatedTuple?.destinationPort, 53);

const shortNat = { ...natWithoutOneToOne, sessionLifetime: 2 };
const shortFlow = runBuilderNatOutboundFlow(graph, addressing, routing, shortNat, [], 'client', 'app', 'tcp', 50100, 443, 10);
assert.equal(shortFlow.sessions.length, 1);
assert.equal(pruneBuilderNatSessions(shortNat, shortFlow.sessions, 12).length, 1);
assert.equal(pruneBuilderNatSessions(shortNat, shortFlow.sessions, 13).length, 0, 'PAT state expires deterministically by sequence');

let postNatAcl = createDefaultBuilderAclConfig();
postNatAcl = upsertBuilderAclRule(graph, postNatAcl, {
  id: 'deny-public-pat-source',
  routerId: 'edge',
  order: 10,
  action: 'deny',
  protocol: 'tcp',
  sourcePrefix: '198.51.100.10/32',
  destinationPrefix: '0.0.0.0/0',
  destinationPort: 443,
  description: 'Deny translated PAT source',
});
const postNatDenied = runBuilderNatOutboundFlow(graph, addressing, routing, natWithoutOneToOne, [], 'client', 'app', 'tcp', 54000, 443, 30, postNatAcl);
assert.equal(postNatDenied.success, false);
assert.equal(postNatDenied.failureReason, 'ACL DENY');
assert.equal(postNatDenied.deniedAtRouterId, 'edge');
assert.equal(postNatDenied.policyStages.at(-1)?.phase, 'post-nat');
assert.equal(postNatDenied.policyStages.at(-1)?.tuple.sourceAddress, '198.51.100.10');

let preNatAcl = createDefaultBuilderAclConfig();
preNatAcl = upsertBuilderAclRule(graph, preNatAcl, {
  id: 'deny-private-client',
  routerId: 'edge',
  order: 10,
  action: 'deny',
  protocol: 'tcp',
  sourcePrefix: `${clientAddress}/32`,
  destinationPrefix: '0.0.0.0/0',
  destinationPort: 443,
  description: 'Deny inside client before translation',
});
const preNatDenied = runBuilderNatOutboundFlow(graph, addressing, routing, natWithoutOneToOne, [], 'client', 'app', 'tcp', 54001, 443, 31, preNatAcl);
assert.equal(preNatDenied.success, false);
assert.equal(preNatDenied.policyStages.at(-1)?.phase, 'pre-nat');
assert.equal(preNatDenied.policyStages.at(-1)?.tuple.sourceAddress, clientAddress);

const failoverGraph = {
  ...graph,
  links: graph.links.map((link) => link.id === 'edge-r1' ? { ...link, failed: true } : { ...link }),
};
const failover = runBuilderNatOutboundFlow(failoverGraph, addressing, routing, natWithoutOneToOne, [], 'client', 'app', 'tcp', 52000, 443, 40);
assert.equal(failover.success, true);
assert.ok(failover.forwarding?.hops.some((hop) => hop.nodeId === 'edge' && hop.linkId === 'edge-r2'), 'NAT boundary remains valid across OSPF failover because both EDGE outside links are explicit');
assert.equal(failover.translatedTuple?.sourceAddress, '198.51.100.10');

const natPing = runBuilderProbe(graph, addressing, routing, 'ping', 'client', 'app', 50, linkProfiles, defaultAcl, natWithoutOneToOne, []);
assert.equal(natPing.success, true);
assert.equal(natPing.natApplied, true);
assert.ok(natPing.natTranslationId);
assert.equal(natPing.natSessions.length, 1, 'NAT-aware Ping returns the active translation state to the Builder owner');
assert.match(natPing.attempts[0].natDetail ?? '', /PAT/);
assert.match(natPing.attempts[0].detail, /NAT boundary|reverse translation/i);

const natTrace = runBuilderProbe(graph, addressing, routing, 'traceroute', 'client', 'app', 60, linkProfiles, defaultAcl, natWithoutOneToOne, []);
assert.equal(natTrace.success, true);
assert.equal(natTrace.natApplied, true);
assert.ok(natTrace.attempts.some((attempt) => attempt.status === 'time-exceeded' && /NAT|PAT|RETURN/.test(attempt.natDetail ?? '')), 'post-boundary traceroute responses must consume related NAT state');
assert.equal(natTrace.attempts.at(-1)?.status, 'echo-reply');
assert.match(natTrace.snapshotNote, /NAT is active|translation state/i);

const persistedScenario = createBuilderScenario(
  'NAT persisted', graph, 'client', 'app', defaultBuilderLayout, addressing, routing, undefined,
  createDefaultBuilderEthernetConfig(), linkProfiles, defaultAcl, nat,
);
assert.equal(persistedScenario.version, 9);
const persistedJson = serializeBuilderScenario(persistedScenario);
assert.doesNotMatch(persistedJson, /natSessions|createdSequence|lastUsedSequence/, 'dynamic translation state must never serialize with scenario configuration');
const restoredScenario = deserializeBuilderScenario(persistedJson);
assert.deepEqual(restoredScenario.nat, nat, 'NAT boundary + static config round-trip in schema v8');
assert.equal(restoredScenario.nat.staticAddresses.length, 1);
assert.equal(restoredScenario.nat.staticMappings.length, 1);

const legacyV7 = { ...persistedScenario, version: 7 };
delete legacyV7.nat;
const migratedV7 = deserializeBuilderScenario(JSON.stringify(legacyV7));
assert.equal(migratedV7.version, 9);
assert.deepEqual(migratedV7.nat.boundaries, [], 'schema v7 migration must not fabricate a NAT boundary');
assert.deepEqual(migratedV7.nat.staticAddresses, []);
assert.deepEqual(migratedV7.nat.staticMappings, []);

console.log('Builder NAT/PAT contract passed: explicit boundaries, deterministic PAT, session reuse/expiry, return-state matching, unsolicited inbound rejection, static port forwarding, static 1:1 NAT, UDP, pre/post-NAT ACL stages, NAT-aware Ping/Traceroute, OSPF outside-link failover, schema-v8 persistence, and session-state exclusion.');
