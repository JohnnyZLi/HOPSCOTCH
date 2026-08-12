import assert from 'node:assert/strict';
import {
  builderIpv4IsUsableInCidr,
  cloneBuilderAddressing,
  createDefaultBuilderAddressing,
  interfacesForBuilderNode,
  parseBuilderIpv4Cidr,
  reconcileBuilderAddressing,
  replaceBuilderDefaultGateway,
  replaceBuilderInterfaceAddress,
  replaceBuilderSegmentCidr,
  validateBuilderAddressing,
} from '../src/builder/addressing.ts';
import { cloneBuilderGraph, defaultBuilderGraph, findShortestPath } from '../src/builder/model.ts';

const graph = cloneBuilderGraph(defaultBuilderGraph);
const routeBefore = findShortestPath(graph, 'client', 'app');
const addressing = createDefaultBuilderAddressing(graph);
const validated = validateBuilderAddressing(graph, addressing);

assert.equal(Object.keys(validated.segments).length, graph.links.length);
assert.equal(Object.keys(validated.defaultGateways).length, 2);
assert.equal(validated.defaultGateways.client, validated.segments['client-edge'].interfaces.find((entry) => entry.nodeId === 'edge')?.address);
assert.equal(validated.defaultGateways.app, validated.segments['core-app'].interfaces.find((entry) => entry.nodeId === 'core')?.address);
assert.ok(Object.values(validated.segments).every((segment) => segment.interfaces.every((entry) => builderIpv4IsUsableInCidr(entry.address, segment.cidr))));
assert.equal(interfacesForBuilderNode(validated, 'r1').length, 3);
assert.deepEqual(findShortestPath(graph, 'client', 'app'), routeBefore, 'adding IPv4 metadata must not mutate weighted route truth');

const parsed = parseBuilderIpv4Cidr('10.44.9.17/24');
assert.equal(parsed.cidr, '10.44.9.0/24');
assert.equal(parsed.networkAddress, '10.44.9.0');
assert.equal(parsed.broadcastAddress, '10.44.9.255');
assert.throws(() => parseBuilderIpv4Cidr('10.0.0.0/31'), /\/8 through \/30/);
assert.equal(builderIpv4IsUsableInCidr('10.44.9.1', '10.44.9.0/24'), true);
assert.equal(builderIpv4IsUsableInCidr('10.44.9.255', '10.44.9.0/24'), false);

const movedSegment = replaceBuilderSegmentCidr(graph, validated, 'client-edge', '10.44.9.0/30');
assert.equal(movedSegment.segments['client-edge'].cidr, '10.44.9.0/30');
assert.deepEqual(movedSegment.segments['client-edge'].interfaces.map((entry) => entry.address), ['10.44.9.1', '10.44.9.2']);
const edgeAddress = movedSegment.segments['client-edge'].interfaces.find((entry) => entry.nodeId === 'edge')?.address;
assert.equal(movedSegment.defaultGateways.client, edgeAddress, 'endpoint gateway must follow a segment renumber');
assert.equal(addressing.segments['client-edge'].cidr, '10.0.0.0/30', 'segment edits must not mutate the prior addressing object');

const clientEntry = movedSegment.segments['client-edge'].interfaces.find((entry) => entry.nodeId === 'client');
assert.ok(clientEntry);
const clientReaddressed = replaceBuilderInterfaceAddress(graph, movedSegment, 'client-edge', 'client', '10.44.9.2');
const clientAddress = clientReaddressed.segments['client-edge'].interfaces.find((entry) => entry.nodeId === 'client')?.address;
assert.equal(clientAddress, '10.44.9.2');
assert.throws(
  () => replaceBuilderInterfaceAddress(graph, movedSegment, 'client-edge', 'client', '10.99.0.2'),
  /not a usable host/,
);

assert.throws(
  () => replaceBuilderDefaultGateway(graph, movedSegment, 'client', '10.44.9.99'),
  /directly connected router interface/,
);
assert.equal(replaceBuilderDefaultGateway(graph, movedSegment, 'client', edgeAddress ?? null).defaultGateways.client, edgeAddress);
assert.throws(
  () => replaceBuilderDefaultGateway(graph, movedSegment, 'edge', '10.44.9.1'),
  /only valid for endpoint/,
);

const overlapping = cloneBuilderAddressing(validated);
overlapping.segments['r1-core'].cidr = validated.segments['client-edge'].cidr;
assert.throws(() => validateBuilderAddressing(graph, overlapping), /overlap/);

const duplicateIp = cloneBuilderAddressing(validated);
duplicateIp.segments['r1-core'].interfaces[0].address = duplicateIp.segments['client-edge'].interfaces[0].address;
assert.throws(() => validateBuilderAddressing(graph, duplicateIp), /already assigned|not a usable host/);

const expandedGraph = cloneBuilderGraph(graph);
expandedGraph.nodes.push({ id: 'r3', label: 'R3', kind: 'router' });
expandedGraph.links.push({ id: 'r2-r3', a: 'r2', b: 'r3', cost: 7, failed: false });
const expandedAddressing = reconcileBuilderAddressing(expandedGraph, validated);
assert.ok(expandedAddressing.segments['r2-r3']);
assert.equal(expandedAddressing.segments['client-edge'].cidr, validated.segments['client-edge'].cidr, 'adding topology must preserve existing segment addresses');
assert.equal(interfacesForBuilderNode(expandedAddressing, 'r3').length, 1);

const contractedGraph = {
  nodes: expandedGraph.nodes.filter((node) => node.id !== 'r3'),
  links: expandedGraph.links.filter((link) => link.a !== 'r3' && link.b !== 'r3'),
};
const contractedAddressing = reconcileBuilderAddressing(contractedGraph, expandedAddressing);
assert.equal(contractedAddressing.segments['r2-r3'], undefined);
assert.doesNotThrow(() => validateBuilderAddressing(contractedGraph, contractedAddressing));

console.log(`Builder L3 addressing contract passed: ${graph.links.length} deterministic segments, endpoint gateways, edit validation, and topology reconciliation without changing route truth.`);
