import assert from 'node:assert/strict';
import { createDefaultBuilderAddressing } from '../src/builder/addressing.ts';
import { createDefaultBuilderLinkProfiles, updateBuilderLinkProfile } from '../src/builder/link-characteristics.ts';
import { cloneBuilderGraph, defaultBuilderGraph } from '../src/builder/model.ts';
import {
  createDefaultBuilderIpv6Config,
  setBuilderIpv6RaRouterEnabled,
  setBuilderOspfv3Everywhere,
  traceBuilderIpv6Forwarding,
} from '../src/builder/ipv6.ts';
import {
  checkBuilderIpv6Pmtu,
  createBuilderIpv6ControlState,
  resolveBuilderIpv6TraceNeighbors,
  runBuilderIpv6RouterSolicitation,
} from '../src/builder/ipv6-control-plane.ts';

const graph = cloneBuilderGraph(defaultBuilderGraph);
const ipv4 = createDefaultBuilderAddressing(graph);
let ipv6 = createDefaultBuilderIpv6Config(graph, ipv4);
let control = createBuilderIpv6ControlState();

ipv6 = setBuilderIpv6RaRouterEnabled(graph, ipv4, ipv6, 'edge', true);
const ra = runBuilderIpv6RouterSolicitation(graph, ipv4, ipv6, 'client', control);
assert.equal(ra.event.success, true);
assert.equal(ra.event.routerId, 'edge');
assert.equal(ra.event.rsDestination, 'ff02::2');
assert.ok(ra.event.raSource?.startsWith('fe80:'));
assert.ok(ra.event.prefix?.startsWith('2001:db8:'));
assert.ok(ra.event.slaacAddress?.startsWith('2001:db8:'));
assert.equal(ra.config.autoconfig.slaacEndpointIds.includes('client'), true);
assert.equal(ra.config.addressing.segments[ra.event.linkId].interfaces.find((entry) => entry.nodeId === 'client')?.addressOrigin, 'slaac');
assert.equal(ra.state.neighborCache.some((entry) => entry.nodeId === 'client' && entry.targetNodeId === 'edge' && entry.source === 'RA'), true);
ipv6 = setBuilderOspfv3Everywhere(graph, ipv4, ra.config, true);
control = ra.state;

const trace = traceBuilderIpv6Forwarding(graph, ipv6, 'client', 'app');
assert.equal(trace.reachable, true);
assert.ok(trace.hops.some((hop) => hop.nodeId === 'edge'));

const firstNd = resolveBuilderIpv6TraceNeighbors(graph, ipv6, trace, control, control.clock + 1);
assert.equal(firstNd.success, true);
assert.ok(firstNd.resolutions.length > 0);
assert.ok(firstNd.resolutions.some((entry) => entry.cacheHit === false));
assert.ok(firstNd.resolutions.every((entry) => entry.solicitedNodeMulticast.startsWith('ff02::1:ff')));
assert.ok(firstNd.resolutions.every((entry) => entry.multicastMac.startsWith('33:33:ff:')));

const secondNd = resolveBuilderIpv6TraceNeighbors(graph, ipv6, trace, firstNd.state, firstNd.state.clock + 1);
assert.equal(secondNd.success, true);
assert.ok(secondNd.resolutions.length > 0);
assert.ok(secondNd.resolutions.every((entry) => entry.cacheHit === true));

let profiles = createDefaultBuilderLinkProfiles(graph);
const routedHop = trace.hops.find((hop) => hop.nodeId === 'edge' && hop.linkId);
assert.ok(routedHop?.linkId, 'Expected an EDGE forwarding hop for PMTU testing.');
profiles = updateBuilderLinkProfile(graph, profiles, routedHop.linkId, { mtuBytes: 1400 });
const firstPmtu = checkBuilderIpv6Pmtu(graph, ipv6, trace, profiles, 1500, secondNd.state, secondNd.state.clock + 1);
assert.equal(firstPmtu.blocked, true);
assert.equal(firstPmtu.event?.mtuBytes, 1400);
assert.equal(firstPmtu.event?.responderNodeId, 'edge');
assert.equal(firstPmtu.event?.delivered, true);
assert.equal(firstPmtu.state.pmtuCache.find((entry) => entry.sourceNodeId === 'client' && entry.destinationNodeId === 'app')?.pathMtuBytes, 1400);

const cachedPmtu = checkBuilderIpv6Pmtu(graph, ipv6, trace, profiles, 1500, firstPmtu.state, firstPmtu.state.clock + 1);
assert.equal(cachedPmtu.blocked, false);
assert.equal(cachedPmtu.cacheHit, true);
assert.equal(cachedPmtu.effectivePacketBytes, 1400);

console.log('Builder IPv6 control-plane contract passed: RS/RA + SLAAC, ND NS/NA caching, and ICMPv6 Packet Too Big PMTU learning.');
