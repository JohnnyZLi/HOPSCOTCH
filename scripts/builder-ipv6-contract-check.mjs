import assert from 'node:assert/strict';
import { createDefaultBuilderAddressing, replaceBuilderSegmentCidr } from '../src/builder/addressing.ts';
import { cloneBuilderGraph, defaultBuilderGraph, defaultBuilderLayout } from '../src/builder/model.ts';
import {
  builderIpv6PrefixContains,
  createDefaultBuilderIpv6Config,
  createEmptyBuilderIpv6Config,
  installBuilderIpv6BidirectionalStaticPath,
  interfacesForBuilderNodeIpv6,
  nextHopOptionsForBuilderIpv6Router,
  normalizeBuilderIpv6,
  parseBuilderIpv6Cidr,
  routeTableForBuilderIpv6Router,
  selectBuilderIpv6Route,
  traceBuilderIpv6Forwarding,
  upsertBuilderIpv6StaticRoute,
  validateBuilderIpv6Config,
} from '../src/builder/ipv6.ts';
import { createBuilderScenario, deserializeBuilderScenario, serializeBuilderScenario } from '../src/builder/scenario.ts';

const graph = cloneBuilderGraph(defaultBuilderGraph);
const ipv4 = createDefaultBuilderAddressing(graph);
const fresh = createDefaultBuilderIpv6Config(graph, ipv4);
assert.equal(fresh.enabled, true);
assert.equal(Object.keys(fresh.addressing.segments).length, graph.links.length);
assert.equal(new Set(Object.values(fresh.addressing.segments).map((segment) => segment.prefix)).size, graph.links.length);
for (const segment of Object.values(fresh.addressing.segments)) {
  assert.equal(parseBuilderIpv6Cidr(segment.prefix).prefixLength, 64);
  assert.ok(segment.prefix.startsWith('2001:db8:'), `expected documentation prefix, got ${segment.prefix}`);
  for (const entry of segment.interfaces) {
    assert.ok(builderIpv6PrefixContains(segment.prefix, entry.globalAddress));
    assert.ok(entry.linkLocalAddress.startsWith('fe80:'), `expected link-local, got ${entry.linkLocalAddress}`);
    assert.equal(entry.name, ipv4.segments[segment.linkId].interfaces.find((item) => item.nodeId === entry.nodeId)?.name);
    assert.equal(normalizeBuilderIpv6(entry.globalAddress), entry.globalAddress);
  }
}
const clientGateway = fresh.addressing.defaultGateways.client;
assert.ok(clientGateway);
assert.ok(clientGateway.address.startsWith('fe80:'), 'endpoint IPv6 default router must use a link-local next hop');
assert.equal(clientGateway.linkId, 'client-edge');
assert.equal(fresh.addressing.segments['client-edge'].interfaces.find((entry) => entry.nodeId === 'edge')?.linkLocalAddress, clientGateway.address);

const noRoute = traceBuilderIpv6Forwarding(graph, fresh, 'client', 'app');
assert.equal(noRoute.reachable, false, 'IPv6 addressing alone must not fabricate routed reachability');
assert.match(noRoute.failureReason ?? '', /No active IPv6 route/);
const ipv4Snapshot = JSON.stringify(ipv4);
const installed = installBuilderIpv6BidirectionalStaticPath(graph, ipv4, fresh, 'client', 'app');
assert.equal(JSON.stringify(ipv4), ipv4Snapshot, 'installing IPv6 routes must not mutate IPv4 addressing truth');
const forward = traceBuilderIpv6Forwarding(graph, installed, 'client', 'app');
const reverse = traceBuilderIpv6Forwarding(graph, installed, 'app', 'client');
assert.equal(forward.reachable, true);
assert.equal(reverse.reachable, true);
assert.deepEqual(forward.hops.map((hop) => hop.nodeId), ['client', 'edge', 'r1', 'core']);
assert.deepEqual(reverse.hops.map((hop) => hop.nodeId), ['app', 'core', 'r1', 'edge']);
assert.ok(forward.hops.every((hop) => hop.routeSource === 'default-router' || hop.routeSource === 'static' || hop.routeSource === 'connected'));
assert.ok(installed.routing.staticRoutes.length >= 6, 'bidirectional routed path should install forward and reverse static state on transit routers');

const edgeTable = routeTableForBuilderIpv6Router(graph, installed, 'edge');
assert.ok(edgeTable.some((entry) => entry.source === 'connected' && entry.administrativeDistance === 0));
assert.ok(edgeTable.some((entry) => entry.source === 'static' && entry.administrativeDistance === 1));
const appAddress = interfacesForBuilderNodeIpv6(installed.addressing, 'app')[0].globalAddress;
assert.equal(selectBuilderIpv6Route(edgeTable, appAddress)?.source, 'static');

const edgeNextHops = nextHopOptionsForBuilderIpv6Router(graph, installed, 'edge');
const r1 = edgeNextHops.find((entry) => entry.nodeId === 'r1');
assert.ok(r1);
const withDefault = upsertBuilderIpv6StaticRoute(graph, ipv4, installed, { routerId: 'edge', prefix: '::/0', nextHop: r1.address, linkId: r1.linkId, metric: 50, description: 'Teaching default' });
assert.equal(selectBuilderIpv6Route(routeTableForBuilderIpv6Router(graph, withDefault, 'edge'), '2001:db8:ffff::1234')?.prefix, '::/0');
assert.equal(selectBuilderIpv6Route(routeTableForBuilderIpv6Router(graph, withDefault, 'edge'), appAddress)?.prefix, interfacesForBuilderNodeIpv6(installed.addressing, 'app')[0].prefix, 'longest prefix must beat IPv6 default route');

const failed = cloneBuilderGraph(graph);
failed.links.find((link) => link.id === 'edge-r1').failed = true;
const broken = traceBuilderIpv6Forwarding(failed, installed, 'client', 'app');
assert.equal(broken.reachable, false, 'static IPv6 route must not reconverge around a failed member');
const rerouted = installBuilderIpv6BidirectionalStaticPath(failed, ipv4, { ...installed, routing: { staticRoutes: [] } }, 'client', 'app');
const rerouteTrace = traceBuilderIpv6Forwarding(failed, rerouted, 'client', 'app');
assert.equal(rerouteTrace.reachable, true);
assert.ok(rerouteTrace.hops.some((hop) => hop.nodeId === 'r2'));
assert.ok(!rerouteTrace.hops.some((hop) => hop.nodeId === 'r1'));

const renumberedIpv4 = replaceBuilderSegmentCidr(graph, ipv4, 'client-edge', '10.42.0.0/30');
const preservedIpv6 = validateBuilderIpv6Config(graph, renumberedIpv4, installed);
assert.equal(preservedIpv6.addressing.segments['client-edge'].prefix, installed.addressing.segments['client-edge'].prefix, 'IPv4 renumbering must not renumber IPv6');

const scenario = createBuilderScenario('IPv6 foundation', graph, 'client', 'app', defaultBuilderLayout, ipv4, undefined, undefined, undefined, undefined, undefined, undefined, undefined, installed);
assert.equal(scenario.version, 9, 'IPv6 is an additive backward-compatible v9 scenario extension');
const restored = deserializeBuilderScenario(serializeBuilderScenario(scenario));
assert.equal(restored.ipv6.enabled, true);
assert.equal(restored.ipv6.addressing.segments['client-edge'].prefix, installed.addressing.segments['client-edge'].prefix);
assert.equal(restored.ipv6.routing.staticRoutes.length, installed.routing.staticRoutes.length);
const legacy = JSON.parse(serializeBuilderScenario(scenario));
delete legacy.ipv6;
const migratedLegacy = deserializeBuilderScenario(JSON.stringify(legacy));
assert.equal(migratedLegacy.version, 9);
assert.equal(migratedLegacy.ipv6.enabled, false, 'pre-IPv6 v9 documents must not gain fabricated IPv6 reachability');
assert.equal(Object.keys(migratedLegacy.ipv6.addressing.segments).length, graph.links.length, 'legacy v9 gains deterministic but disabled IPv6 addressing for future opt-in');
const empty = createEmptyBuilderIpv6Config(graph, ipv4);
assert.equal(empty.enabled, false);

console.log('Builder IPv6 foundation contract passed: deterministic /64 + link-local addressing, link-local default routers, connected/static/default route lookup, bidirectional forwarding, link-failure behavior, IPv4 independence, and backward-compatible scenario-v9 persistence.');
