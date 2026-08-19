import assert from 'node:assert/strict';
import { createDefaultBuilderAddressing, interfacesForBuilderNode } from '../src/builder/addressing.ts';
import {
  BuilderCliCommandError,
  formatBuilderCliCommand,
  parseBuilderCliCommand,
  projectBuilderCliCommand,
  projectBuilderCliState,
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
  ['configure terminal', 'UNSUPPORTED_COMMAND'],
  ['interface eth0', 'UNSUPPORTED_COMMAND'],
  ['no shutdown', 'UNSUPPORTED_COMMAND'],
  ['ping 10.0.0.1', 'UNSUPPORTED_COMMAND'],
  ['traceroute 203.0.113.1', 'UNSUPPORTED_COMMAND'],
];
for (const [command, code] of rejected) {
  assert.throws(
    () => projectBuilderCliCommand(command, suppliedState),
    (error) => error instanceof BuilderCliCommandError && error.code === code,
    `${JSON.stringify(command)} must fail closed with ${code}`,
  );
}

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

console.log('Builder CLI contract passed: four read-only show projections, deterministic parsing/order, canonical live/historical state adapter, explicit empty state, fail-closed syntax, and immutable supplied truth.');
