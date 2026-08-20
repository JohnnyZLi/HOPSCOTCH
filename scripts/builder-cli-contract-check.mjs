import assert from 'node:assert/strict';
import { createDefaultBuilderAddressing, interfacesForBuilderNode } from '../src/builder/addressing.ts';
import { createDefaultBuilderAclConfig } from '../src/builder/acl.ts';
import { createDefaultBuilderNatConfig } from '../src/builder/nat.ts';
import { createDefaultBuilderIpv6Config } from '../src/builder/ipv6.ts';
import { setBuilderOspfEverywhere } from '../src/builder/routing.ts';
import {
  executeBuilderCliSessionCommand,
  formatBuilderCliSessionShow,
  parseBuilderCliSessionCommand,
  projectBuilderCliOperationalState,
  resolveBuilderCliOperationalProbeDestination,
  resolveBuilderCliSessionDevice,
} from '../src/builder/cli-operations.ts';
import {
  BuilderCliCommandError,
  executeBuilderCliCommand,
  formatBuilderCliCommand,
  formatBuilderCliProbeResult,
  parseBuilderCliCommand,
  projectBuilderCliCommand,
  projectBuilderCliState,
  resolveBuilderCliProbeDestination,
} from '../src/builder/cli.ts';
import { defaultBuilderGraph } from '../src/builder/model.ts';
import { createDefaultBuilderRoutingConfig } from '../src/builder/routing.ts';

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

const suppliedState = deepFreeze({
  interfaces: [
    { deviceId: 'edge', interfaceName: 'eth1', address: '10.0.0.9/30', linkState: 'UP', protocolState: 'UP' },
    { deviceId: 'core', interfaceName: 'eth2', address: null, linkState: 'ADMIN DOWN', protocolState: 'DOWN' },
    { deviceId: 'edge', interfaceName: 'eth0', address: '10.0.0.2/30', linkState: 'DOWN', protocolState: 'DOWN' },
  ],
  routes: [
    { id: 'static-edge-doc', routerId: 'edge', prefix: '203.0.113.0/24', prefixLength: 24, source: 'static', administrativeDistance: 1, metric: 50, nextHop: '10.0.0.10', outgoingInterface: 'eth1', active: false, stateNote: 'NEXT-HOP LINK DOWN' },
    { id: 'connected-core-app', routerId: 'core', prefix: '10.0.0.4/30', prefixLength: 30, source: 'connected', administrativeDistance: 0, metric: 0, nextHop: null, outgoingInterface: 'eth2', active: true, stateNote: 'DIRECTLY CONNECTED' },
    { id: 'ospf-edge-app', routerId: 'edge', prefix: '10.0.0.4/30', prefixLength: 30, source: 'ospf', administrativeDistance: 110, metric: 20, nextHop: '10.0.0.10', outgoingInterface: 'eth1', active: true, stateNote: 'OSPF O · AREA 0.0.0.0' },
  ],
  arpEntries: [
    { ownerDeviceId: 'lan-b', vlanId: 10, address: '10.10.0.10', mac: '02:48:4f:10:00:0a', learnedFromDeviceId: 'lan-a' },
    { ownerDeviceId: 'lan-a', vlanId: 10, address: '10.10.0.11', mac: '02:48:4f:10:00:0b', learnedFromDeviceId: 'lan-b' },
    { ownerDeviceId: 'lan-a', vlanId: 20, address: '10.20.0.1', mac: '02:48:4f:00:fe:01', learnedFromDeviceId: 'lan-r1' },
  ],
  macEntries: [
    { switchId: 'lan-sw2', vlanId: 10, mac: '02:48:4f:10:00:0b', linkId: 'lan-b-sw2', learnedFrom: 'lan-b' },
    { switchId: 'lan-sw1', vlanId: 20, mac: '02:48:4f:00:fe:01', linkId: 'lan-sw1-r1', learnedFrom: 'lan-r1' },
    { switchId: 'lan-sw1', vlanId: 10, mac: '02:48:4f:10:00:0a', linkId: 'lan-a-sw1', learnedFrom: 'lan-a' },
  ],
});

const beforeProjection = structuredClone(suppliedState);

assert.deepEqual(parseBuilderCliCommand('  ShOw\tRoUtE  '), { verb: 'show', target: 'route' });
assert.deepEqual(parseBuilderCliCommand('SHOW INTERFACES'), { verb: 'show', target: 'interfaces' });
assert.deepEqual(parseBuilderCliCommand(' PiNg\tAPP '), { verb: 'ping', destination: 'APP' });
assert.deepEqual(parseBuilderCliCommand('TRACEROUTE core'), { verb: 'traceroute', destination: 'core' });

const interfaceOutput = projectBuilderCliCommand('show interfaces', suppliedState);
const routeOutput = projectBuilderCliCommand('show route', suppliedState);
const arpOutput = projectBuilderCliCommand('show arp', suppliedState);
const macOutput = projectBuilderCliCommand('show mac', suppliedState);

assert.equal(interfaceOutput, [
  'DEVICE  INTERFACE  ADDRESS      LINK        PROTOCOL',
  'core    eth2       —            ADMIN DOWN  DOWN',
  'edge    eth0       10.0.0.2/30  DOWN        DOWN',
  'edge    eth1       10.0.0.9/30  UP          UP',
].join('\n'));

assert.equal(routeOutput, [
  'DEVICE  PREFIX          SOURCE     AD   METRIC  NEXT HOP   INTERFACE  STATE     DETAIL',
  'core    10.0.0.4/30     connected  0    0       —          eth2       ACTIVE    DIRECTLY CONNECTED',
  'edge    10.0.0.4/30     ospf       110  20      10.0.0.10  eth1       ACTIVE    OSPF O · AREA 0.0.0.0',
  'edge    203.0.113.0/24  static     1    50      10.0.0.10  eth1       INACTIVE  NEXT-HOP LINK DOWN',
].join('\n'));

assert.equal(arpOutput, [
  'DEVICE  VLAN  ADDRESS     MAC                LEARNED FROM',
  'lan-a   10    10.10.0.11  02:48:4f:10:00:0b  lan-b',
  'lan-a   20    10.20.0.1   02:48:4f:00:fe:01  lan-r1',
  'lan-b   10    10.10.0.10  02:48:4f:10:00:0a  lan-a',
].join('\n'));

assert.equal(macOutput, [
  'SWITCH   VLAN  MAC                PORT        LEARNED FROM',
  'lan-sw1  10    02:48:4f:10:00:0a  lan-a-sw1   lan-a',
  'lan-sw1  20    02:48:4f:00:fe:01  lan-sw1-r1  lan-r1',
  'lan-sw2  10    02:48:4f:10:00:0b  lan-b-sw2   lan-b',
].join('\n'));

const reorderedState = deepFreeze({
  interfaces: [...suppliedState.interfaces].reverse(),
  routes: [...suppliedState.routes].reverse(),
  arpEntries: [...suppliedState.arpEntries].reverse(),
  macEntries: [...suppliedState.macEntries].reverse(),
});
for (const command of ['show interfaces', 'show route', 'show arp', 'show mac']) {
  assert.equal(projectBuilderCliCommand(command, reorderedState), projectBuilderCliCommand(command, suppliedState), `${command} output must ignore supplied row order`);
}

const emptyState = deepFreeze({ interfaces: [], routes: [], arpEntries: [], macEntries: [] });
assert.equal(projectBuilderCliCommand('show interfaces', emptyState), 'No interface facts supplied.');
assert.equal(projectBuilderCliCommand('show route', emptyState), 'No route facts supplied.');
assert.equal(projectBuilderCliCommand('show arp', emptyState), 'No ARP facts supplied.');
assert.equal(projectBuilderCliCommand('show mac', emptyState), 'No MAC facts supplied.');

const rejected = [
  ['', 'EMPTY_COMMAND'],
  ['show', 'AMBIGUOUS_COMMAND'],
  ['show routes', 'UNSUPPORTED_COMMAND'],
  ['show route detail', 'UNSUPPORTED_SYNTAX'],
  ['ping', 'AMBIGUOUS_COMMAND'],
  ['ping app extra', 'UNSUPPORTED_SYNTAX'],
  ['traceroute', 'AMBIGUOUS_COMMAND'],
  ['configure terminal', 'UNSUPPORTED_COMMAND'],
  ['interface eth0', 'UNSUPPORTED_COMMAND'],
  ['no shutdown', 'UNSUPPORTED_COMMAND'],
];
for (const [command, code] of rejected) {
  assert.throws(
    () => parseBuilderCliCommand(command),
    (error) => error instanceof BuilderCliCommandError && error.code === code,
    `${JSON.stringify(command)} must fail closed with ${code}`,
  );
}
assert.throws(
  () => projectBuilderCliCommand('ping app', suppliedState),
  (error) => error instanceof BuilderCliCommandError && error.code === 'EXECUTION_REQUIRED',
  'active probe commands must not be projected as read-only show output',
);
assert.throws(
  () => executeBuilderCliCommand('traceroute app', { state: suppliedState, probeUnavailableReason: 'Time Machine is read only.' }),
  (error) => error instanceof BuilderCliCommandError && error.code === 'READ_ONLY_CONTEXT' && /Time Machine/.test(error.message),
  'active probes must fail closed when the execution context is read only',
);

assert.equal(formatBuilderCliCommand({ verb: 'show', target: 'route' }, suppliedState), routeOutput);
assert.deepEqual(suppliedState, beforeProjection, 'the CLI projection must not mutate supplied canonical facts');

const graph = structuredClone(defaultBuilderGraph);
const addressing = createDefaultBuilderAddressing(graph);
const routing = createDefaultBuilderRoutingConfig();
const liveProjectionInput = deepFreeze({
  graph,
  addressing,
  routing,
  arpCache: suppliedState.arpEntries,
  ethernetFlow: { fdb: suppliedState.macEntries },
});
const liveProjectionBefore = structuredClone(liveProjectionInput);
const liveProjection = projectBuilderCliState(liveProjectionInput);
const expectedInterfaceCount = graph.nodes.reduce((total, node) => total + interfacesForBuilderNode(addressing, node.id).length, 0);
assert.equal(liveProjection.interfaces.length, expectedInterfaceCount, 'live projection must expose every canonical routed IPv4 interface');
assert.ok(liveProjection.routes.length > 0, 'live projection must derive router RIB facts from canonical routing state');
assert.deepEqual(liveProjection.arpEntries, suppliedState.arpEntries, 'live projection must expose supplied session ARP truth');
assert.deepEqual(liveProjection.macEntries, suppliedState.macEntries, 'live projection must expose supplied session FDB truth');
assert.notEqual(liveProjection.arpEntries, suppliedState.arpEntries, 'live projection must copy ARP rows rather than aliasing session state');
assert.notEqual(liveProjection.macEntries, suppliedState.macEntries, 'live projection must copy MAC rows rather than aliasing session state');
assert.deepEqual(liveProjectionInput, liveProjectionBefore, 'live CLI state projection must not mutate canonical/runtime input');

const firstInterface = liveProjection.interfaces[0];
assert.ok(firstInterface, 'default Builder graph must expose at least one routed interface');
const interfaceConfig = interfacesForBuilderNode(addressing, firstInterface.deviceId).find((entry) => entry.name === firstInterface.interfaceName);
assert.ok(interfaceConfig, 'projected interface must map back to canonical addressing truth');
const failedGraph = structuredClone(graph);
failedGraph.links = failedGraph.links.map((link) => link.id === interfaceConfig.linkId ? { ...link, failed: true } : link);
const failedProjection = projectBuilderCliState({ ...liveProjectionInput, graph: failedGraph });
const failedInterface = failedProjection.interfaces.find((entry) => entry.deviceId === firstInterface.deviceId && entry.interfaceName === firstInterface.interfaceName);
assert.equal(failedInterface?.linkState, 'DOWN', 'physical link failure must project as interface LINK DOWN');
assert.equal(failedInterface?.protocolState, 'DOWN', 'physical link failure must project as interface protocol DOWN');

const historicalProjection = projectBuilderCliState({ ...liveProjectionInput, graph: failedGraph, truthGraphs: { ribGraph: graph } });
assert.equal(historicalProjection.interfaces.find((entry) => entry.deviceId === firstInterface.deviceId && entry.interfaceName === firstInterface.interfaceName)?.linkState, 'DOWN');
assert.deepEqual(historicalProjection.routes, liveProjection.routes, 'historical CLI projection must honor an explicit RIB truth graph independently of physical interface state');
assert.match(projectBuilderCliCommand('show interfaces', liveProjection), /^DEVICE\s+INTERFACE\s+ADDRESS\s+LINK\s+PROTOCOL/m);

const destinationNode = graph.nodes.find((node) => node.id === 'app') ?? graph.nodes.at(-1);
assert.ok(destinationNode, 'default Builder graph must expose a routed destination');
const destinationAddress = interfacesForBuilderNode(addressing, destinationNode.id)[0]?.address;
assert.ok(destinationAddress, 'default routed destination must expose an IPv4 address');
assert.equal(resolveBuilderCliProbeDestination({ graph, addressing }, destinationNode.id.toUpperCase()).nodeId, destinationNode.id, 'node ids resolve case-insensitively');
assert.equal(resolveBuilderCliProbeDestination({ graph, addressing }, destinationNode.label.toUpperCase()).nodeId, destinationNode.id, 'unique labels resolve case-insensitively');
assert.equal(resolveBuilderCliProbeDestination({ graph, addressing }, destinationAddress).nodeId, destinationNode.id, 'configured IPv4 addresses resolve to routed nodes');
assert.equal(resolveBuilderCliProbeDestination({ graph, addressing }, `${destinationAddress}/30`).nodeId, destinationNode.id, 'CIDR-suffixed IPv4 input resolves by host address');
assert.throws(
  () => resolveBuilderCliProbeDestination({ graph, addressing }, 'not-a-node'),
  (error) => error instanceof BuilderCliCommandError && error.code === 'UNKNOWN_DESTINATION',
);
const ambiguousGraph = structuredClone(graph);
ambiguousGraph.nodes = ambiguousGraph.nodes.map((node, index) => index < 2 ? { ...node, label: 'DUPLICATE' } : node);
assert.throws(
  () => resolveBuilderCliProbeDestination({ graph: ambiguousGraph, addressing }, 'duplicate'),
  (error) => error instanceof BuilderCliCommandError && error.code === 'AMBIGUOUS_DESTINATION',
);

const fakePing = deepFreeze({
  id: 'probe-7-ping', sequence: 7, kind: 'ping', plane: 'ROUTED IPV4', sourceNodeId: 'client', destinationNodeId: destinationNode.id,
  sourceAddress: '10.0.0.1', destinationAddress, success: true,
  attempts: [{ index: 0, ttl: 64, status: 'echo-reply', responderNodeId: destinationNode.id, responderAddress: destinationAddress, requestNodeIds: ['client', 'edge', 'core', destinationNode.id], requestLinkIds: ['client-edge', 'edge-core', 'core-app'], responseNodeIds: [destinationNode.id, 'core', 'edge', 'client'], responseLinkIds: ['core-app', 'edge-core', 'client-edge'], detail: 'Existing Builder probe engine delivered an Echo Reply.', packet: null, simulatedRttMs: 3.25, jitterMs: 0.5, bottleneckMbps: 1000, pathMtuBytes: 1500, pathLossPercent: 0, dropLinkId: null, natDetail: null }],
  summary: 'APP replied.', snapshotNote: 'session only', natApplied: false, natTranslationId: null, natSessions: [],
});
const fakeTrace = deepFreeze({
  ...fakePing,
  id: 'probe-8-traceroute', sequence: 8, kind: 'traceroute',
  attempts: [
    { ...fakePing.attempts[0], index: 0, ttl: 1, status: 'time-exceeded', responderNodeId: 'edge', responderAddress: '10.0.0.2', simulatedRttMs: 1.1 },
    { ...fakePing.attempts[0], index: 1, ttl: 2, status: 'time-exceeded', responderNodeId: 'core', responderAddress: '10.0.0.5', simulatedRttMs: 2.2 },
    { ...fakePing.attempts[0], index: 2, ttl: 3, status: 'echo-reply', responderNodeId: destinationNode.id, responderAddress: destinationAddress, simulatedRttMs: 3.25 },
  ],
  summary: 'Destination reached at TTL 3.',
});
assert.match(formatBuilderCliProbeResult(fakePing), /^PING · client · 10\.0\.0\.1 → /);
assert.match(formatBuilderCliProbeResult(fakePing), /RESULT PASS · ECHO REPLY/);
assert.match(formatBuilderCliProbeResult(fakePing), /RTT 3\.25 ms · PATH MTU 1500 · LOSS 0\.0000%/);
assert.match(formatBuilderCliProbeResult(fakeTrace), /^TRACEROUTE · /);
assert.match(formatBuilderCliProbeResult(fakeTrace), /TTL\s+STATUS\s+RESPONDER\s+ADDRESS\s+RTT MS/);
assert.match(formatBuilderCliProbeResult(fakeTrace), /TIME EXCEEDED\s+edge/);

let requestedProbe = null;
const executedPing = executeBuilderCliCommand(`ping ${destinationNode.id}`, {
  state: liveProjection,
  runProbe: (command) => { requestedProbe = command; return fakePing; },
});
assert.deepEqual(requestedProbe, { verb: 'ping', destination: destinationNode.id }, 'CLI execution must delegate the parsed probe request instead of deciding network truth');
assert.equal(executedPing.probeResult, fakePing, 'CLI execution must return the exact Builder probe result supplied by the engine callback');
assert.equal(executedPing.output, formatBuilderCliProbeResult(fakePing), 'CLI output must be a formatter over the supplied Builder probe result');
assert.deepEqual(liveProjectionInput, liveProjectionBefore, 'active-command parsing/formatting must not mutate canonical projection input');

// Track K closeout: operational inspection, context, bounded mutations, and explicit IPv6 probes.
assert.deepEqual(parseBuilderCliSessionCommand('show ospf neighbors'), { verb: 'show', target: 'ospf-neighbors' });
assert.deepEqual(parseBuilderCliSessionCommand('SHOW BGP'), { verb: 'show', target: 'bgp' });
assert.deepEqual(parseBuilderCliSessionCommand('show acl'), { verb: 'show', target: 'acl' });
assert.deepEqual(parseBuilderCliSessionCommand('show nat'), { verb: 'show', target: 'nat' });
assert.deepEqual(parseBuilderCliSessionCommand('ping ipv6 APP'), { verb: 'ping', family: 'ipv6', destination: 'APP' });
assert.deepEqual(parseBuilderCliSessionCommand('traceroute ipv4 app'), { verb: 'traceroute', family: 'ipv4', destination: 'app' });
assert.deepEqual(parseBuilderCliSessionCommand('set ospf on'), { verb: 'set', target: 'ospf', enabled: true });
assert.deepEqual(parseBuilderCliSessionCommand('set bgp off'), { verb: 'set', target: 'bgp', enabled: false });
assert.deepEqual(parseBuilderCliSessionCommand('set gateway none'), { verb: 'set', target: 'gateway', address: null });
assert.deepEqual(parseBuilderCliSessionCommand('set link edge-core down'), { verb: 'set', target: 'link', linkId: 'edge-core', failed: true });
assert.deepEqual(parseBuilderCliSessionCommand('set static-route 203.0.113.0/24 via 10.0.0.6 metric 7'), { verb: 'set', target: 'static-route', prefix: '203.0.113.0/24', nextHop: '10.0.0.6', metric: 7 });
assert.deepEqual(parseBuilderCliSessionCommand('delete static-route 203.0.113.0/24'), { verb: 'delete', target: 'static-route', prefix: '203.0.113.0/24' });
assert.throws(() => parseBuilderCliSessionCommand('set static-route 203.0.113.0/24 via 10.0.0.6 metric 0'), (error) => error instanceof BuilderCliCommandError && error.code === 'UNSUPPORTED_SYNTAX');

const operationalRouting = setBuilderOspfEverywhere(graph, addressing, routing, true);
const operationalIpv6 = createDefaultBuilderIpv6Config(graph, addressing, true);
const operationalInput = deepFreeze({
  graph, addressing, routing: operationalRouting, ipv6: operationalIpv6,
  acl: createDefaultBuilderAclConfig(), nat: createDefaultBuilderNatConfig(graph), natSessions: [],
  arpCache: suppliedState.arpEntries, ethernetFlow: { fdb: suppliedState.macEntries },
});
const operationalBefore = structuredClone(operationalInput);
const operationalState = projectBuilderCliOperationalState(operationalInput);
assert.match(formatBuilderCliSessionShow({ verb: 'show', target: 'ospf-neighbors' }, operationalState, null), /FULL/, 'OSPF CLI view must project canonical adjacency state');
assert.match(formatBuilderCliSessionShow({ verb: 'show', target: 'bgp' }, operationalState, null), /SESSION VIEWS/, 'BGP CLI view must project canonical BGP state even when empty');
assert.match(formatBuilderCliSessionShow({ verb: 'show', target: 'acl' }, operationalState, null), /DEFAULT PERMIT/, 'ACL CLI view must expose canonical default policy');
assert.match(formatBuilderCliSessionShow({ verb: 'show', target: 'nat' }, operationalState, null), /BOUNDARIES/, 'NAT CLI view must expose canonical boundary/session state');
const scopedRouteOutput = formatBuilderCliSessionShow({ verb: 'show', target: 'route' }, operationalState, 'edge');
assert.match(scopedRouteOutput, /edge/, 'device context must retain local route rows');
assert.doesNotMatch(scopedRouteOutput, /^core\s/m, 'device context must not leak other routers into scoped route output');
assert.equal(resolveBuilderCliSessionDevice(graph, 'EDGE'), 'edge');
assert.equal(resolveBuilderCliSessionDevice(graph, 'global'), null);
assert.equal(resolveBuilderCliOperationalProbeDestination(operationalState, 'ipv6', destinationNode.id).nodeId, destinationNode.id);
const destinationIpv6 = Object.values(operationalIpv6.addressing.segments).flatMap((segment) => segment.interfaces).find((entry) => entry.nodeId === destinationNode.id)?.globalAddress;
assert.ok(destinationIpv6, 'default Builder IPv6 plan must expose destination global address');
assert.equal(resolveBuilderCliOperationalProbeDestination(operationalState, 'ipv6', destinationIpv6).nodeId, destinationNode.id);

const fakeIpv6Ping = deepFreeze({ ...fakePing, id: 'probe-9-ping6', sequence: 9, plane: 'ROUTED IPV6', sourceNodeId: 'edge', sourceAddress: '2001:db8:2::1', destinationAddress: destinationIpv6 });
let operationalProbeRequest = null;
const ipv6Execution = executeBuilderCliSessionCommand(`ping ipv6 ${destinationNode.id}`, {
  state: operationalState, currentDeviceId: 'edge', defaultSourceId: 'client',
  runProbe: (request) => { operationalProbeRequest = request; return fakeIpv6Ping; },
});
assert.deepEqual(operationalProbeRequest, { kind: 'ping', family: 'ipv6', sourceId: 'edge', destinationId: destinationNode.id }, 'device-scoped IPv6 CLI probe must delegate exact family/source/destination to existing engine callback');
assert.equal(ipv6Execution.probeResult, fakeIpv6Ping);
assert.match(ipv6Execution.output, /^PING ROUTED IPV6/);

const useExecution = executeBuilderCliSessionCommand('use edge', { state: operationalState, currentDeviceId: null, defaultSourceId: 'client' });
assert.equal(useExecution.nextDeviceId, 'edge');
assert.match(useExecution.output, /CONTEXT EDGE/);
const globalExecution = executeBuilderCliSessionCommand('use global', { state: operationalState, currentDeviceId: 'edge', defaultSourceId: 'client' });
assert.equal(globalExecution.nextDeviceId, null);

let mutationRequest = null;
const mutationExecution = executeBuilderCliSessionCommand('set ospf off', {
  state: operationalState, currentDeviceId: 'edge', defaultSourceId: 'client',
  mutate: (request) => { mutationRequest = request; return 'CLI OSPF · EDGE DISABLED'; },
});
assert.deepEqual(mutationRequest, { command: { verb: 'set', target: 'ospf', enabled: false }, deviceId: 'edge' }, 'configuration parser must delegate a bounded canonical mutation instead of mutating truth itself');
assert.match(mutationExecution.output, /DISABLED/);
assert.throws(
  () => executeBuilderCliSessionCommand('set ospf off', { state: operationalState, currentDeviceId: 'edge', defaultSourceId: 'client', activeUnavailableReason: 'Time Machine is inspection-only.' }),
  (error) => error instanceof BuilderCliCommandError && error.code === 'READ_ONLY_CONTEXT' && /Time Machine/.test(error.message),
  'historical CLI configuration must fail closed',
);
assert.throws(
  () => executeBuilderCliSessionCommand('set ospf on', { state: operationalState, currentDeviceId: null, defaultSourceId: 'client', mutate: () => 'unexpected' }),
  (error) => error instanceof BuilderCliCommandError && error.code === 'UNSUPPORTED_SYNTAX' && /use <device>/.test(error.message),
  'device-bound configuration must require explicit terminal context',
);
assert.deepEqual(operationalInput, operationalBefore, 'operational CLI projection/parsing must not mutate supplied canonical/runtime truth');

console.log('Builder CLI contract passed: deterministic core + OSPF/BGP/ACL/NAT projections, global/device context, IPv4/IPv6 probe delegation, bounded canonical mutation delegation, read-only Time Machine failure, fail-closed grammar, and immutable supplied truth.');
