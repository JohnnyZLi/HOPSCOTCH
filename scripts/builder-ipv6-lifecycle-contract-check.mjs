import assert from 'node:assert/strict';
import { createDefaultBuilderAddressing } from '../src/builder/addressing.ts';
import { cloneBuilderGraph, defaultBuilderGraph } from '../src/builder/model.ts';
import { createDefaultBuilderIpv6Config, replaceBuilderIpv6DefaultGateway, setBuilderOspfv3Everywhere, traceBuilderIpv6Forwarding } from '../src/builder/ipv6.ts';
import { createBuilderIpv6ControlState, resolveBuilderIpv6TraceNeighbors, runBuilderIpv6RouterSolicitation } from '../src/builder/ipv6-control-plane.ts';
import {
  advanceBuilderIpv6Lifecycle,
  createBuilderIpv6LifecycleState,
  materializeBuilderIpv6RuntimeConfig,
  reconcileBuilderIpv6LifecycleWithControl,
  recordBuilderIpv6RaLifetime,
  renumberBuilderIpv6Link,
  runBuilderDhcpv6Client,
  runBuilderIpv6Dad,
  setBuilderDhcpv6Server,
  useBuilderIpv6Neighbor,
} from '../src/builder/ipv6-lifecycle.ts';

const graph = cloneBuilderGraph(defaultBuilderGraph);
const ipv4 = createDefaultBuilderAddressing(graph);
let ipv6 = setBuilderOspfv3Everywhere(graph, ipv4, createDefaultBuilderIpv6Config(graph, ipv4), true);
const endpoint = graph.nodes.find((node) => node.kind === 'endpoint');
assert.ok(endpoint);
const accessLink = graph.links.find((link) => [link.a, link.b].includes(endpoint.id) && graph.nodes.find((node) => node.id === (link.a === endpoint.id ? link.b : link.a))?.kind === 'router');
assert.ok(accessLink);
const routerId = accessLink.a === endpoint.id ? accessLink.b : accessLink.a;
const endpointInterface = ipv6.addressing.segments[accessLink.id].interfaces.find((entry) => entry.nodeId === endpoint.id);
const routerInterface = ipv6.addressing.segments[accessLink.id].interfaces.find((entry) => entry.nodeId === routerId);
assert.ok(endpointInterface && routerInterface);

let lifecycle = createBuilderIpv6LifecycleState();
let dad = runBuilderIpv6Dad(graph, ipv6, endpoint.id, accessLink.id, lifecycle);
assert.equal(dad.event.status, 'PREFERRED');
lifecycle = dad.state;
dad = runBuilderIpv6Dad(graph, ipv6, endpoint.id, accessLink.id, lifecycle, routerInterface.globalAddress);
assert.equal(dad.event.status, 'DUPLICATE');
assert.equal(dad.event.duplicateNodeId, routerId);
lifecycle = dad.state;

const remoteEndpoint = graph.nodes.filter((node) => node.kind === 'endpoint').find((node) => node.id !== endpoint.id);
assert.ok(remoteEndpoint);
const trace = traceBuilderIpv6Forwarding(graph, ipv6, endpoint.id, remoteEndpoint.id);
assert.equal(trace.reachable, true);
let control = createBuilderIpv6ControlState();
control = resolveBuilderIpv6TraceNeighbors(graph, ipv6, trace, control, 1).state;
lifecycle = reconcileBuilderIpv6LifecycleWithControl(control, lifecycle);
assert.ok(lifecycle.nud.length > 0);
lifecycle = advanceBuilderIpv6Lifecycle(lifecycle, 30);
assert.equal(lifecycle.nud[0].state, 'STALE');
lifecycle = useBuilderIpv6Neighbor(graph, control, lifecycle, lifecycle.nud[0].id);
assert.equal(lifecycle.nud[0].state, 'DELAY');
lifecycle = advanceBuilderIpv6Lifecycle(lifecycle, 5);
assert.equal(lifecycle.nud[0].state, 'PROBE');
lifecycle = useBuilderIpv6Neighbor(graph, control, lifecycle, lifecycle.nud[0].id);
assert.equal(lifecycle.nud[0].state, 'REACHABLE');

const clearedGateway = replaceBuilderIpv6DefaultGateway(graph, ipv4, ipv6, endpoint.id, null);
lifecycle = setBuilderDhcpv6Server(graph, clearedGateway, lifecycle, routerId, accessLink.id, true);
const dhcp = runBuilderDhcpv6Client(graph, clearedGateway, lifecycle, endpoint.id);
assert.equal(dhcp.event.success, true);
assert.deepEqual(dhcp.event.stages, ['SOLICIT','ADVERTISE','REQUEST','REPLY']);
lifecycle = dhcp.state;
let runtime = materializeBuilderIpv6RuntimeConfig(clearedGateway, lifecycle);
assert.equal(runtime.addressing.defaultGateways[endpoint.id], null, 'DHCPv6 must not invent a default router');
assert.equal(runtime.addressing.segments[accessLink.id].interfaces.find((entry) => entry.nodeId === endpoint.id)?.addressOrigin, 'dhcpv6');
assert.equal(runtime.addressing.segments[accessLink.id].interfaces.find((entry) => entry.nodeId === endpoint.id)?.globalAddress, dhcp.event.address);

const ra = runBuilderIpv6RouterSolicitation(graph, ipv4, clearedGateway, endpoint.id, control);
assert.equal(ra.event.success, true);
lifecycle = recordBuilderIpv6RaLifetime(lifecycle, ra.event);
assert.equal(lifecycle.prefixLifetimes.at(-1)?.status, 'PREFERRED');
lifecycle = advanceBuilderIpv6Lifecycle(lifecycle, 1800);
assert.equal(lifecycle.prefixLifetimes.at(-1)?.status, 'DEPRECATED');
lifecycle = advanceBuilderIpv6Lifecycle(lifecycle, 1800);
assert.equal(lifecycle.prefixLifetimes.at(-1)?.status, 'EXPIRED');
runtime = materializeBuilderIpv6RuntimeConfig(ra.config, lifecycle);
assert.equal(runtime.addressing.defaultGateways[endpoint.id], null, 'expired RA router lifetime must remove runtime default-router usability');

const before = ipv6.addressing.segments[accessLink.id].prefix;
const renumbered = renumberBuilderIpv6Link(graph, ipv4, ipv6, lifecycle, accessLink.id);
assert.notEqual(renumbered.config.addressing.segments[accessLink.id].prefix, before);
assert.ok(renumbered.state.prefixLifetimes.some((entry) => entry.prefix === before && entry.status === 'DEPRECATED'));
assert.ok(renumbered.state.prefixLifetimes.some((entry) => entry.prefix === renumbered.config.addressing.segments[accessLink.id].prefix && entry.status === 'PREFERRED'));

console.log('Builder IPv6 lifecycle contract passed: DAD conflict detection, NUD aging/probing, RA deprecation/expiry, deterministic renumbering, and DHCPv6 lease semantics.');
