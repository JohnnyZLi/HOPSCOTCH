import assert from 'node:assert/strict';
import { createDefaultBuilderAddressing } from '../src/builder/addressing.ts';
import { cloneBuilderGraph, defaultBuilderGraph } from '../src/builder/model.ts';
import { createDefaultBuilderRoutingConfig, setBuilderOspfEverywhere } from '../src/builder/routing.ts';
import { runBuilderProbe } from '../src/builder/probes.ts';

const graph = cloneBuilderGraph(defaultBuilderGraph);
const addressing = createDefaultBuilderAddressing(graph);
const emptyRouting = createDefaultBuilderRoutingConfig();

const blockedPing = runBuilderProbe(graph, addressing, emptyRouting, 'ping', 'client', 'app', 1);
assert.equal(blockedPing.success, false);
assert.equal(blockedPing.attempts[0].status, 'unreachable');
assert.match(blockedPing.attempts[0].detail, /NO MATCHING ROUTE/);

const ospf = setBuilderOspfEverywhere(graph, addressing, emptyRouting, true);
const ping = runBuilderProbe(graph, addressing, ospf, 'ping', 'client', 'app', 2);
assert.equal(ping.success, true);
assert.equal(ping.attempts[0].status, 'echo-reply');
assert.deepEqual(ping.attempts[0].requestNodeIds, ['client', 'edge', 'r1', 'core', 'app']);
assert.deepEqual(ping.attempts[0].responseNodeIds, ['app', 'core', 'r1', 'edge', 'client']);
assert.equal(ping.attempts[0].packet?.ttl, 64);

const trace = runBuilderProbe(graph, addressing, ospf, 'traceroute', 'client', 'app', 3);
assert.equal(trace.success, true);
assert.deepEqual(trace.attempts.map((attempt) => attempt.ttl), [1, 2, 3, 4]);
assert.deepEqual(trace.attempts.map((attempt) => attempt.status), ['time-exceeded', 'time-exceeded', 'time-exceeded', 'echo-reply']);
assert.deepEqual(trace.attempts.map((attempt) => attempt.responderNodeId), ['edge', 'r1', 'core', 'app']);
assert.equal(trace.attempts[0].responderAddress, '10.0.0.2');
assert.equal(trace.attempts[1].responderAddress, '10.0.0.10');
assert.equal(trace.attempts[2].responderAddress, '10.0.0.18');

const failedGraph = cloneBuilderGraph(graph);
failedGraph.links = failedGraph.links.map((link) => link.id === 'edge-r1' ? { ...link, failed: true } : link);
const rerouted = runBuilderProbe(failedGraph, addressing, ospf, 'traceroute', 'client', 'app', 4);
assert.equal(rerouted.success, true);
assert.deepEqual(rerouted.attempts.map((attempt) => attempt.responderNodeId), ['edge', 'r2', 'core', 'app']);
assert.ok(rerouted.attempts.some((attempt) => attempt.requestLinkIds.includes('edge-r2')));
assert.ok(rerouted.attempts.every((attempt) => !attempt.requestLinkIds.includes('edge-r1')));

const partition = cloneBuilderGraph(graph);
partition.links = partition.links.map((link) => (link.id === 'r1-core' || link.id === 'r2-core') ? { ...link, failed: true } : link);
const dead = runBuilderProbe(partition, addressing, ospf, 'traceroute', 'client', 'app', 5);
assert.equal(dead.success, false);
assert.equal(dead.attempts.at(-1)?.status, 'unreachable');

console.log('Builder active-probe contract passed: ping request/reply truth, ICMP TTL expiry, traceroute reverse-path behavior, OSPF failover, and unreachable termination.');
