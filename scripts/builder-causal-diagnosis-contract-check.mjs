import assert from 'node:assert/strict';
import { createDefaultBuilderAddressing, interfacesForBuilderNode } from '../src/builder/addressing.ts';
import { createDefaultBuilderAclConfig, upsertBuilderAclRule } from '../src/builder/acl.ts';
import { createDefaultBuilderHostedServices, runBuilderApplicationTransaction } from '../src/builder/application.ts';
import { clearBuilderArpCache } from '../src/builder/arp.ts';
import { diagnoseBuilderApplicationTransaction } from '../src/builder/causal-diagnosis.ts';
import { clearBuilderDhcpLeases, createDefaultBuilderDhcpConfig } from '../src/builder/dhcp.ts';
import { createDefaultBuilderEthernetConfig } from '../src/builder/ethernet.ts';
import { createBuilderIpv6ControlState } from '../src/builder/ipv6-control-plane.ts';
import { createDefaultBuilderIpv6RoutingDepthState } from '../src/builder/ipv6-routing-depth.ts';
import { createDefaultBuilderIpv6Config, setBuilderOspfv3Everywhere } from '../src/builder/ipv6.ts';
import { createDefaultBuilderLinkProfiles } from '../src/builder/link-characteristics.ts';
import { defaultBuilderGraph } from '../src/builder/model.ts';
import { clearBuilderNatSessions, createDefaultBuilderNatConfig } from '../src/builder/nat.ts';
import { createDefaultBuilderRoutingConfig, setBuilderOspfEverywhere } from '../src/builder/routing.ts';

const graph = defaultBuilderGraph;
const addressing = createDefaultBuilderAddressing(graph);
const routing = setBuilderOspfEverywhere(graph, addressing, createDefaultBuilderRoutingConfig(), true);
const ethernet = createDefaultBuilderEthernetConfig();
const ipv6 = setBuilderOspfv3Everywhere(graph, addressing, createDefaultBuilderIpv6Config(graph, addressing, true), true);
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
const h2 = services.find((service) => service.kind === 'https' && service.transportProfile === 'tcp-h2');
const h3 = services.find((service) => service.kind === 'https' && service.transportProfile === 'quic-h3');
assert.ok(h2 && h3);

const successTx = runBuilderApplicationTransaction(base, services, 'client', h2.id, 'ipv4', 11);
const success = diagnoseBuilderApplicationTransaction(successTx, graph);
assert.equal(success.success, true);
assert.equal(success.firstBrokenDimension, null);
assert.match(success.summary, /ALL EVALUATED TRUTH BOUNDARIES PASSED/);
assert.equal(success.dimensions.find((entry) => entry.id === 'POLICY')?.status, 'PASS');
assert.equal(success.dimensions.find((entry) => entry.id === 'TRANSLATION')?.status, 'PASS');
assert.equal(success.dimensions.find((entry) => entry.id === 'TRANSPORT')?.status, 'PASS');
assert.equal(success.dimensions.find((entry) => entry.id === 'APPLICATION')?.status, 'PASS');
assert.ok(success.causalChain.every((step) => step.status !== 'NOT_REACHED'));
assert.match(success.boundary, /never reruns forwarding/i);

const stage4 = diagnoseBuilderApplicationTransaction(successTx, graph, 4);
assert.equal(stage4.terminal, false);
assert.equal(stage4.firstBrokenBoundary, null, 'historical replay must not leak a later terminal result');
assert.equal(stage4.dimensions.find((entry) => entry.id === 'ROUTING')?.status, 'PASS');
assert.equal(stage4.dimensions.find((entry) => entry.id === 'POLICY')?.status, 'NOT_REACHED');
assert.equal(stage4.dimensions.find((entry) => entry.id === 'TRANSPORT')?.status, 'NOT_REACHED');
assert.match(stage4.summary, /REPLAY IN PROGRESS/);

const sourceAddress = interfacesForBuilderNode(addressing, 'client')[0]?.address;
const appAddress = interfacesForBuilderNode(addressing, 'app')[0]?.address;
assert.ok(sourceAddress && appAddress);
const deniedAcl = upsertBuilderAclRule(graph, createDefaultBuilderAclConfig(), {
  routerId: 'edge', order: 10, action: 'deny', protocol: 'tcp', sourcePrefix: `${sourceAddress}/32`, destinationPrefix: `${appAddress}/32`, destinationPort: 443, description: 'Track A deterministic deny',
});
const deniedTx = runBuilderApplicationTransaction({ ...base, acl: deniedAcl }, services, 'client', h2.id, 'ipv4', 21);
const denied = diagnoseBuilderApplicationTransaction(deniedTx, graph);
assert.equal(denied.success, false);
assert.equal(denied.firstBrokenBoundary, 'POLICY_NAT');
assert.equal(denied.firstBrokenDimension, 'POLICY');
assert.equal(denied.dimensions.find((entry) => entry.id === 'POLICY')?.status, 'FAIL');
assert.equal(denied.dimensions.find((entry) => entry.id === 'TRANSLATION')?.status, 'NOT_REACHED');
assert.equal(denied.dimensions.find((entry) => entry.id === 'TRANSPORT')?.status, 'NOT_REACHED');
assert.equal(denied.causalChain.at(-1)?.dimension, 'POLICY');
assert.match(denied.summary, /FIRST BROKEN TRUTH BOUNDARY/);

const ipv6Tx = runBuilderApplicationTransaction(base, services, 'client', h3.id, 'ipv6', 31);
const ipv6Diagnosis = diagnoseBuilderApplicationTransaction(ipv6Tx, graph);
assert.equal(ipv6Diagnosis.success, true);
assert.equal(ipv6Diagnosis.dimensions.find((entry) => entry.id === 'POLICY')?.status, 'PASS');
assert.equal(ipv6Diagnosis.dimensions.find((entry) => entry.id === 'TRANSLATION')?.status, 'NOT_APPLICABLE');
assert.match(ipv6Diagnosis.dimensions.find((entry) => entry.id === 'TRANSLATION')?.summary ?? '', /NO NAT66/);

const partitionedGraph = { ...graph, links: graph.links.map((link) => link.id === 'core-app' ? { ...link, failed: true } : link) };
const partitionedRouting = setBuilderOspfEverywhere(partitionedGraph, addressing, createDefaultBuilderRoutingConfig(), true);
const partitionedTx = runBuilderApplicationTransaction({ ...base, graph: partitionedGraph, routing: partitionedRouting, linkProfiles: createDefaultBuilderLinkProfiles(partitionedGraph), nat: createDefaultBuilderNatConfig(partitionedGraph), ipv6RoutingDepth: createDefaultBuilderIpv6RoutingDepthState(partitionedGraph) }, services, 'client', h2.id, 'ipv4', 41);
const partitioned = diagnoseBuilderApplicationTransaction(partitionedTx, partitionedGraph);
assert.equal(partitioned.success, false);
assert.ok(partitioned.firstBrokenDimension, partitioned.summary);
assert.equal(partitioned.dimensions.find((entry) => entry.id === 'TRANSPORT')?.status, 'NOT_REACHED');
assert.ok(partitioned.causalChain.length >= 2);

console.log('Track A causal diagnosis contract passed: independent truth dimensions, exact first-broken-boundary ranking, no future-state leakage during historical replay, policy vs translation separation, IPv6 no-NAT66 truth, and canonical causal chains.');
