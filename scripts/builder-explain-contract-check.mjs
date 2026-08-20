import assert from 'node:assert/strict';
import { defaultBuilderScenario } from '../src/builder/scenario.ts';
import { setBuilderOspfEverywhere } from '../src/builder/routing.ts';
import { createBuilderIpv6ControlState } from '../src/builder/ipv6-control-plane.ts';
import { createDefaultBuilderIpv6RoutingDepthState } from '../src/builder/ipv6-routing-depth.ts';
import { createBuilderWorkbenchEventJournal } from '../src/builder/device-workbench.ts';
import {
  BUILDER_EXPLAIN_SCHEMA,
  builderExplainCatalog,
  createBuilderExplanationQueryPack,
  explainBuilderNetwork,
} from '../src/builder/explain.ts';

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function primaryAddress(addressing, nodeId) {
  for (const segment of Object.values(addressing.segments)) {
    const found = segment.interfaces.find((entry) => entry.nodeId === nodeId);
    if (found) return found.address;
  }
  return null;
}

const scenario = defaultBuilderScenario();
const routing = setBuilderOspfEverywhere(scenario.graph, scenario.addressing, scenario.routing, true);
const routers = scenario.graph.nodes.filter((node) => node.kind === 'router');
assert.ok(routers.length >= 2, 'default scenario must contain routers for Track L route/OSPF coverage');
const routerId = routers[0].id;
const firstLink = scenario.graph.links.find((link) => link.a === routerId || link.b === routerId) ?? scenario.graph.links[0];
assert.ok(firstLink, 'default scenario must contain at least one routed link');

const baseEvents = createBuilderWorkbenchEventJournal();
const event1 = {
  id: 'wb-event-0001', sequence: 1, atMs: 1000, kind: 'physical', category: 'topology',
  summary: `LINK DOWN · ${firstLink.id.toUpperCase()}`, detail: `${firstLink.id} changed physical state.`,
  deviceRefs: [{ plane: 'routed', id: firstLink.a }, { plane: 'routed', id: firstLink.b }], causeId: null, objectIds: [firstLink.id],
};
const event2 = {
  id: 'wb-event-0002', sequence: 2, atMs: 2000, kind: 'control-plane', category: 'routing',
  summary: 'OSPF · ADJACENCY REEVALUATED', detail: 'OSPF re-evaluated the neighbor relationship after the topology event.',
  deviceRefs: [{ plane: 'routed', id: firstLink.a }, { plane: 'routed', id: firstLink.b }], causeId: event1.id, objectIds: [firstLink.id],
};

const probe = {
  id: 'probe-track-l', sequence: 9, kind: 'ping', plane: 'ROUTED IPV4',
  sourceNodeId: scenario.sourceId, destinationNodeId: scenario.destinationId,
  sourceAddress: primaryAddress(scenario.addressing, scenario.sourceId), destinationAddress: primaryAddress(scenario.addressing, scenario.destinationId),
  success: false,
  attempts: [{
    index: 0, ttl: 64, status: 'timeout', responderNodeId: null, responderAddress: null,
    requestNodeIds: [scenario.sourceId, firstLink.a === scenario.sourceId ? firstLink.b : firstLink.a].filter((id, index, all) => all.indexOf(id) === index),
    requestLinkIds: [firstLink.id], responseNodeIds: [], responseLinkIds: [],
    detail: `Echo Request was deterministically dropped on ${firstLink.id}.`, packet: null,
    simulatedRttMs: null, jitterMs: scenario.linkProfiles[firstLink.id]?.jitterMs ?? 0,
    bottleneckMbps: scenario.linkProfiles[firstLink.id]?.bandwidthMbps ?? null,
    pathMtuBytes: scenario.linkProfiles[firstLink.id]?.mtuBytes ?? 1500,
    pathLossPercent: scenario.linkProfiles[firstLink.id]?.lossPercent ?? 0,
    dropLinkId: firstLink.id, natDetail: null,
  }],
  summary: 'Recorded timeout for Track L contract.',
  snapshotNote: 'Immutable probe result used as Track L evidence.',
  natApplied: false, natTranslationId: null, natSessions: [],
};

const service = scenario.services[0];
assert.ok(service, 'default scenario must include a hosted service');
const stages = [
  { order: 1, boundary: 'ADDRESSING', label: 'ADDRESSING', status: 'PASS', summary: 'ADDRESS READY', detail: 'Source addressing is ready.' },
  { order: 2, boundary: 'DNS', label: 'DNS', status: 'PASS', summary: 'NAME RESOLVED', detail: 'Service name resolved.' },
  { order: 3, boundary: 'L2', label: 'L2', status: 'PASS', summary: 'L2 READY', detail: 'Access and next-hop resolution passed.' },
  { order: 4, boundary: 'ROUTING', label: 'ROUTING', status: 'FAIL', summary: 'NO ROUTE', detail: 'The canonical FIB has no usable destination route.' },
  { order: 5, boundary: 'POLICY_NAT', label: 'POLICY', status: 'NOT_REACHED', summary: 'NOT REACHED', detail: 'Routing failed first.' },
  { order: 6, boundary: 'LINK', label: 'LINK', status: 'NOT_REACHED', summary: 'NOT REACHED', detail: 'Routing failed first.' },
  { order: 7, boundary: 'TRANSPORT', label: 'TRANSPORT', status: 'NOT_REACHED', summary: 'NOT REACHED', detail: 'Routing failed first.' },
  { order: 8, boundary: 'TLS', label: 'TLS', status: 'NOT_REACHED', summary: 'NOT REACHED', detail: 'Routing failed first.' },
  { order: 9, boundary: 'APPLICATION', label: 'APPLICATION', status: 'NOT_REACHED', summary: 'NOT REACHED', detail: 'Routing failed first.' },
  { order: 10, boundary: 'RESPONSE', label: 'RESPONSE', status: 'NOT_REACHED', summary: 'NOT REACHED', detail: 'Routing failed first.' },
].map((stage) => ({ ...stage, id: `track-l-stage-${stage.order}`, nodeIds: [scenario.sourceId, scenario.destinationId], linkIds: [], provenance: 'SIMULATED' }));
const application = {
  id: 'application-track-l', sequence: 4, service, family: 'ipv4', sourceNodeId: scenario.sourceId, destinationNodeId: scenario.destinationId,
  sourceAddress: primaryAddress(scenario.addressing, scenario.sourceId), destinationAddress: primaryAddress(scenario.addressing, scenario.destinationId),
  success: false, firstBrokenBoundary: 'ROUTING', summary: 'Application stopped at routing.', stages,
  protocolEvents: [], packets: [], projections: [], ipv4Forwarding: null, ipv6Forwarding: null, natRequest: null, natResponse: null,
  l2: { sourceMode: 'ROUTED ACCESS PROJECTION', destinationMode: 'ROUTED ACCESS PROJECTION', sourceResolution: null, destinationResolution: null, sourceStp: null, destinationStp: null, sourceVlan: null, destinationVlan: null },
  dhcpTransaction: null, arpCache: [], natSessions: [], dhcpLeases: [], ipv6ControlState: createBuilderIpv6ControlState(),
  boundary: 'Track L contract fixture uses immutable Track D-style stages.',
};

const input = deepFreeze({
  graph: scenario.graph,
  services: scenario.services,
  linkProfiles: scenario.linkProfiles,
  addressing: scenario.addressing,
  routing,
  ipv6: scenario.ipv6,
  ipv6ControlState: createBuilderIpv6ControlState(),
  ipv6RoutingDepth: createDefaultBuilderIpv6RoutingDepthState(scenario.graph),
  ethernet: scenario.ethernet,
  ethernetFlow: null,
  arpCache: [],
  arpResolutions: [],
  acl: scenario.acl,
  nat: scenario.nat,
  natSessions: [],
  dhcp: scenario.dhcp,
  dhcpLeases: [],
  dhcpSequence: 1,
  probeHistory: [probe],
  applicationHistory: [application],
  applicationStageOrder: null,
  sourceId: scenario.sourceId,
  destinationId: scenario.destinationId,
  events: [...baseEvents, event1, event2],
});
const before = structuredClone(input);

const novice = explainBuilderNetwork(input, { topic: 'network', level: 'novice' });
const operational = explainBuilderNetwork(input, { topic: 'network', level: 'operational' });
const protocol = explainBuilderNetwork(input, { topic: 'network', level: 'protocol' });
assert.equal(novice.schema, BUILDER_EXPLAIN_SCHEMA);
assert.deepEqual(novice.facts, operational.facts, 'wording levels must preserve exactly the same structured facts');
assert.deepEqual(operational.facts, protocol.facts, 'protocol detail must not change simulation/explanation facts');
assert.deepEqual(novice.citations, protocol.citations, 'wording levels must preserve exact canonical evidence references');
assert.notEqual(novice.summary, protocol.summary, 'wording levels should materially change presentation');

const route = explainBuilderNetwork(input, { topic: 'route', level: 'protocol', routerId });
assert.ok(route.facts.some((fact) => fact.id === 'route.selected'), 'route explanation must contain the canonical route selection outcome');
assert.ok(route.citations.some((citation) => citation.ref === `state:fib:${routerId}`), 'route explanation must cite the selected router FIB');

const adjacency = explainBuilderNetwork(input, { topic: 'adjacency', level: 'operational', routerId });
assert.ok(adjacency.facts.some((fact) => fact.id === 'adjacency.state') || adjacency.verdictCode === 'NO_ADJACENCY', 'OSPF explanation must expose exact adjacency state when available');
if (adjacency.verdictCode !== 'NO_ADJACENCY') assert.ok(adjacency.citations.some((citation) => citation.ref.startsWith('state:ospf:adjacency:')), 'adjacency explanation must cite canonical OSPF state');

const policy = explainBuilderNetwork(input, { topic: 'policy', level: 'operational' });
assert.ok(policy.facts.some((fact) => fact.id === 'policy.outcome'), 'policy explanation must expose canonical ACL trace outcome');
assert.ok(policy.citations.some((citation) => citation.ref === 'state:policy:outcome'));

const packet = explainBuilderNetwork(input, { topic: 'packet', level: 'operational', probeId: probe.id });
assert.ok(packet.facts.some((fact) => fact.id === 'packet.drop'), 'recorded deterministic link drop must remain visible as the packet cause');
assert.ok(packet.citations.some((citation) => citation.ref === `outcome:probe:${probe.id}:attempt:0`), 'packet explanation must cite immutable probe attempt evidence');
assert.ok(packet.citations.some((citation) => citation.ref === `config:link-profile:${firstLink.id}`), 'drop explanation must cite the exact configured link profile it interprets');

const applicationExplanation = explainBuilderNetwork(input, { topic: 'application', level: 'operational', applicationId: application.id });
assert.equal(applicationExplanation.verdictCode, 'ROUTING', 'application explanation must preserve the first broken Track A/Track D truth dimension');
assert.ok(applicationExplanation.facts.some((fact) => fact.id === 'application.dimension.routing' && fact.status === 'bad'));
assert.ok(applicationExplanation.citations.some((citation) => citation.ref === `outcome:application:${application.id}:stage:track-l-stage-4`));

const eventExplanation = explainBuilderNetwork(input, { topic: 'event', level: 'protocol', eventId: event2.id });
const eventFactIds = eventExplanation.facts.filter((fact) => fact.category === 'EVENT').map((fact) => fact.id);
assert.deepEqual(eventFactIds, [`event:${event1.id}`, `event:${event2.id}`], 'event explanation must preserve canonical causeId order');

const catalog = builderExplainCatalog(input);
assert.ok(catalog.routers.length >= 2);
assert.equal(catalog.probes[0]?.id, probe.id);
assert.equal(catalog.applications[0]?.id, application.id);
assert.equal(catalog.events[0]?.id, event2.id);

const queryPack = createBuilderExplanationQueryPack(packet);
assert.equal(queryPack.advisoryOnly, true);
assert.equal(queryPack.truthAuthority, 'CANONICAL_BUILDER');
assert.ok(queryPack.allowedUses.includes('ANSWER_FROM_CITED_FACTS'));
assert.ok(queryPack.forbiddenUses.includes('DECIDE_ROUTING'));
assert.ok(queryPack.forbiddenUses.includes('MUTATE_CANONICAL_STATE'));
assert.deepEqual(queryPack.facts, packet.facts, 'AI/query pack must expose facts rather than another decision model');

assert.deepEqual(input, before, 'Track L explanations must never mutate supplied canonical Builder truth');
console.log('Builder Track L explanation contract passed: structured facts precede prose, exact citations ground route/OSPF/policy/probe/application/event explanations, wording levels preserve truth, AI fact packs are advisory-only, and canonical inputs remain immutable.');
