import assert from 'node:assert/strict';
import { createDefaultBuilderAddressing, interfacesForBuilderNode } from '../src/builder/addressing.ts';
import {
  builderOspfAreaType,
  createDefaultBuilderRoutingConfig,
  deleteBuilderOspfRedistribution,
  deleteBuilderStaticRoute,
  routeTableForBuilderRouter,
  selectBuilderRoute,
  setBuilderOspfAreaType,
  setBuilderOspfLinkArea,
  setBuilderOspfRouterEnabled,
  traceBuilderForwarding,
  upsertBuilderOspfRedistribution,
  upsertBuilderStaticRoute,
} from '../src/builder/routing.ts';
import { createBuilderScenario, deserializeBuilderScenario, serializeBuilderScenario } from '../src/builder/scenario.ts';

const graph = {
  nodes: [
    { id: 'client', label: 'CLIENT', kind: 'endpoint' },
    { id: 'r1', label: 'R1', kind: 'router' },
    { id: 'abr1', label: 'ABR1', kind: 'router' },
    { id: 'abr2', label: 'ABR2', kind: 'router' },
    { id: 'asbr', label: 'ASBR', kind: 'router' },
    { id: 'edge', label: 'EDGE', kind: 'router' },
    { id: 'service', label: 'SERVICE', kind: 'endpoint' },
  ],
  links: [
    { id: 'client-r1', a: 'client', b: 'r1', cost: 1, failed: false },
    { id: 'r1-abr1', a: 'r1', b: 'abr1', cost: 10, failed: false },
    { id: 'abr1-abr2', a: 'abr1', b: 'abr2', cost: 5, failed: false },
    { id: 'abr2-asbr', a: 'abr2', b: 'asbr', cost: 10, failed: false },
    { id: 'asbr-edge', a: 'asbr', b: 'edge', cost: 3, failed: false },
    { id: 'edge-service', a: 'edge', b: 'service', cost: 1, failed: false },
  ],
};
const layout = { client: { x: 3, y: 50 }, r1: { x: 18, y: 50 }, abr1: { x: 34, y: 50 }, abr2: { x: 52, y: 50 }, asbr: { x: 68, y: 50 }, edge: { x: 83, y: 50 }, service: { x: 97, y: 50 } };
const addressing = createDefaultBuilderAddressing(graph);
let routing = createDefaultBuilderRoutingConfig();
for (const routerId of ['r1', 'abr1', 'abr2', 'asbr']) routing = setBuilderOspfRouterEnabled(graph, addressing, routing, routerId, true);
routing = setBuilderOspfLinkArea(graph, addressing, routing, 'client-r1', '1');
routing = setBuilderOspfLinkArea(graph, addressing, routing, 'r1-abr1', '1');
routing = setBuilderOspfLinkArea(graph, addressing, routing, 'abr1-abr2', '0');
routing = setBuilderOspfLinkArea(graph, addressing, routing, 'abr2-asbr', '2');
routing = setBuilderOspfLinkArea(graph, addressing, routing, 'asbr-edge', '2');
routing = setBuilderOspfAreaType(graph, addressing, routing, '1', 'stub');
routing = setBuilderOspfAreaType(graph, addressing, routing, '2', 'nssa');

assert.equal(builderOspfAreaType(routing.ospf, '1'), 'stub');
assert.equal(builderOspfAreaType(routing.ospf, '2'), 'nssa');
assert.equal(builderOspfAreaType(routing.ospf, '0'), 'normal');
assert.throws(() => setBuilderOspfAreaType(graph, addressing, routing, '0', 'stub'), /Area 0 cannot be stub or NSSA/);

const serviceInterface = interfacesForBuilderNode(addressing, 'service')[0];
assert.ok(serviceInterface);
const servicePrefix = addressing.segments[serviceInterface.linkId].cidr;
const edgeNextHop = addressing.segments['asbr-edge'].interfaces.find((entry) => entry.nodeId === 'edge')?.address;
assert.ok(edgeNextHop);
routing = upsertBuilderStaticRoute(graph, addressing, routing, { routerId: 'asbr', prefix: servicePrefix, nextHop: edgeNextHop, metric: 7 });
const redistributedStatic = routing.staticRoutes.find((route) => route.routerId === 'asbr' && route.prefix === servicePrefix);
assert.ok(redistributedStatic);
assert.throws(() => upsertBuilderOspfRedistribution(graph, addressing, routing, { routerId: 'r1', staticRouteId: redistributedStatic.id, areaId: '1', metric: 20 }), /must reference a static route owned by r1/);

routing = upsertBuilderOspfRedistribution(graph, addressing, routing, { routerId: 'asbr', staticRouteId: redistributedStatic.id, areaId: '2', metric: 20 });
const redistribution = routing.ospf.redistributions?.[0];
assert.ok(redistribution);

const r1Table = routeTableForBuilderRouter(graph, addressing, routing, 'r1');
const r1Default = selectBuilderRoute(r1Table, '203.0.113.10');
assert.equal(r1Default?.prefix, '0.0.0.0/0');
assert.equal(r1Default?.ospfRouteType, 'inter-area');
assert.match(r1Default?.stateNote ?? '', /STUB DEFAULT/);
assert.ok(!r1Table.some((entry) => entry.prefix === servicePrefix && entry.ospfExternalSource === 'static'), 'stub area must suppress specific OSPF external routes');

const abr1External = selectBuilderRoute(routeTableForBuilderRouter(graph, addressing, routing, 'abr1'), serviceInterface.address);
assert.equal(abr1External?.source, 'ospf');
assert.equal(abr1External?.ospfRouteType, 'external');
assert.equal(abr1External?.ospfExternalLsaType, 5);
assert.equal(abr1External?.ospfExternalSource, 'static');
assert.equal(abr1External?.ospfRedistributionId, redistribution.id);
assert.match(abr1External?.stateNote ?? '', /TYPE-5 TRANSLATED FROM NSSA/);

const abr2External = selectBuilderRoute(routeTableForBuilderRouter(graph, addressing, routing, 'abr2'), serviceInterface.address);
assert.equal(abr2External?.ospfRouteType, 'nssa-external');
assert.equal(abr2External?.ospfExternalLsaType, 7);
assert.equal(abr2External?.ospfExternalSource, 'static');
assert.match(abr2External?.stateNote ?? '', /O N1 · TYPE-7 NSSA/);

const trace = traceBuilderForwarding(graph, addressing, routing, 'client', 'service');
assert.equal(trace.reachable, true, trace.explanation);
assert.deepEqual(trace.hops.map((hop) => hop.nodeId), ['client', 'r1', 'abr1', 'abr2', 'asbr', 'edge']);
assert.equal(trace.hops.find((hop) => hop.nodeId === 'r1')?.matchedPrefix, '0.0.0.0/0');
assert.equal(trace.hops.find((hop) => hop.nodeId === 'abr1')?.routeSource, 'ospf');
assert.equal(trace.hops.find((hop) => hop.nodeId === 'asbr')?.routeSource, 'static');

const scenario = createBuilderScenario('Lab 11M closeout', graph, 'client', 'service', layout, addressing, routing);
assert.equal(scenario.version, 9, 'stub/NSSA and bounded redistribution remain additive scenario-v9 routing fields');
const restored = deserializeBuilderScenario(serializeBuilderScenario(scenario));
assert.equal(restored.routing.ospf.areaTypes?.['0.0.0.1'], 'stub');
assert.equal(restored.routing.ospf.areaTypes?.['0.0.0.2'], 'nssa');
assert.equal(restored.routing.ospf.redistributions?.length, 1);
assert.equal(restored.routing.ospf.redistributions?.[0].staticRouteId, redistributedStatic.id);

const withoutRedistribution = deleteBuilderOspfRedistribution(graph, addressing, routing, redistribution.id);
assert.ok(!routeTableForBuilderRouter(graph, addressing, withoutRedistribution, 'abr1').some((entry) => entry.prefix === servicePrefix && entry.ospfExternalSource === 'static'));
assert.equal(traceBuilderForwarding(graph, addressing, withoutRedistribution, 'client', 'service').reachable, false, 'stub default may reach the ABR, but the external specific must disappear when redistribution is removed');

const withoutStatic = deleteBuilderStaticRoute(graph, addressing, routing, redistributedStatic.id);
assert.equal(withoutStatic.ospf.redistributions?.length, 0, 'removing a backing static route must reconcile away its redistribution rule');

let normalAreaRouting = setBuilderOspfAreaType(graph, addressing, routing, '1', 'normal');
const r1NormalExternal = selectBuilderRoute(routeTableForBuilderRouter(graph, addressing, normalAreaRouting, 'r1'), serviceInterface.address);
assert.equal(r1NormalExternal?.ospfRouteType, 'external');
assert.equal(r1NormalExternal?.ospfExternalLsaType, 5);
assert.ok(!routeTableForBuilderRouter(graph, addressing, normalAreaRouting, 'r1').some((entry) => entry.prefix === '0.0.0.0/0' && /STUB|NSSA/.test(entry.stateNote)), 'normal area must not retain the stub/NSSA injected default');

console.log('Builder OSPF stub/NSSA closeout contract passed: Area 0 guardrail, stub external suppression + ABR default, NSSA Type-7 origination, Type-5 translation, bounded static redistribution provenance, end-to-end forwarding, scenario-v9 persistence, withdrawal, and reconciliation.');
