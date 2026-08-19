import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDefaultBuilderAddressing, interfacesForBuilderNode } from '../src/builder/addressing.ts';
import { createDefaultBuilderAclConfig, upsertBuilderAclRule } from '../src/builder/acl.ts';
import { createDefaultBuilderHostedServices, runBuilderApplicationTransaction } from '../src/builder/application.ts';
import { clearBuilderArpCache } from '../src/builder/arp.ts';
import { deriveBuilderCanonicalEventSpecs } from '../src/builder/canonical-events.ts';
import { diagnoseBuilderApplicationTransaction } from '../src/builder/causal-diagnosis.ts';
import { clearBuilderDhcpLeases, createDefaultBuilderDhcpConfig } from '../src/builder/dhcp.ts';
import { appendBuilderWorkbenchEventBatch, appendBuilderWorkbenchMessageEvent, buildBuilderDeviceWorkbench, createBuilderWorkbenchEventJournal } from '../src/builder/device-workbench.ts';
import { createDefaultBuilderEthernetConfig } from '../src/builder/ethernet.ts';
import { createBuilderIpv6ControlState } from '../src/builder/ipv6-control-plane.ts';
import { createBuilderIpv6LifecycleState } from '../src/builder/ipv6-lifecycle.ts';
import { createDefaultBuilderIpv6RoutingDepthState } from '../src/builder/ipv6-routing-depth.ts';
import { createDefaultBuilderIpv6Config, setBuilderOspfv3Everywhere } from '../src/builder/ipv6.ts';
import { createDefaultBuilderLinkProfiles } from '../src/builder/link-characteristics.ts';
import { cloneBuilderLayout, defaultBuilderGraph, defaultBuilderLayout } from '../src/builder/model.ts';
import { clearBuilderNatSessions, createDefaultBuilderNatConfig } from '../src/builder/nat.ts';
import { createDefaultBuilderRoutingConfig, setBuilderOspfEverywhere } from '../src/builder/routing.ts';
import { builderTimelineJournalThroughSequence, builderTimelineSnapshotAtSequence, captureBuilderTimelineSnapshot, createBuilderTimeline } from '../src/builder/timeline.ts';
import { builderApplicationDiagnosisSection, builderProtocolDatabaseSection } from '../src/builder/workbench-depth.ts';

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

const timelineBase = {
  ...base,
  acl: deniedAcl,
  ipv6LifecycleState: createBuilderIpv6LifecycleState(),
  layout: cloneBuilderLayout(defaultBuilderLayout),
  ethernetFlow: null,
  arpResolutions: [],
  probeHistory: [],
  applicationHistory: [],
  applicationStageOrder: null,
  sourceId: 'client',
  destinationId: 'app',
};
let journal = createBuilderWorkbenchEventJournal();
let timeline = captureBuilderTimelineSnapshot(createBuilderTimeline(), journal, timelineBase);
journal = appendBuilderWorkbenchMessageEvent(journal, `APPLICATION · ${deniedTx.summary}`, [{ plane: 'routed', id: 'client' }, { plane: 'routed', id: 'edge' }, { plane: 'routed', id: 'app' }]);
const rootAction = journal.at(-1);
assert.ok(rootAction && rootAction.kind === 'action');
const finalTimelineState = {
  ...timelineBase,
  arpCache: deniedTx.arpCache,
  natSessions: deniedTx.natSessions,
  dhcpLeases: deniedTx.dhcpLeases,
  ipv6ControlState: deniedTx.ipv6ControlState,
  applicationHistory: [deniedTx],
};
const derived = deriveBuilderCanonicalEventSpecs(timeline.snapshots.at(-1).state, finalTimelineState, rootAction);
const applicationSpecs = derived.filter((entry) => entry.category === 'application');
const evaluatedStages = deniedTx.stages.filter((stage) => stage.status !== 'NOT_REACHED');
assert.equal(applicationSpecs.length, evaluatedStages.length, 'every evaluated Track D stage must have one canonical timeline event');
assert.equal(applicationSpecs[0].projection?.applicationHistory, 'after');
assert.deepEqual(applicationSpecs.map((entry) => entry.projection?.applicationStageOrder), [1, 2, 3, 4, null]);
assert.ok(applicationSpecs.slice(1).every((entry) => entry.causeKey), 'application stage events must form one deterministic causal chain');
journal = appendBuilderWorkbenchEventBatch(journal, derived);
timeline = captureBuilderTimelineSnapshot(timeline, journal, finalTimelineState);
const applicationEvents = journal.filter((event) => event.category === 'application');
const routingEvent = applicationEvents.find((event) => event.projection?.applicationStageOrder === 4);
const terminalEvent = applicationEvents.at(-1);
assert.ok(routingEvent && terminalEvent);
const routingSnapshot = builderTimelineSnapshotAtSequence(timeline, routingEvent.sequence);
const terminalSnapshot = builderTimelineSnapshotAtSequence(timeline, terminalEvent.sequence);
assert.ok(routingSnapshot && terminalSnapshot);
assert.equal(routingSnapshot.state.applicationStageOrder, 4);
assert.equal(routingSnapshot.state.applicationHistory.length, 1);
const routingDiagnosis = diagnoseBuilderApplicationTransaction(routingSnapshot.state.applicationHistory[0], routingSnapshot.state.graph, routingSnapshot.state.applicationStageOrder);
assert.equal(routingDiagnosis.firstBrokenDimension, null);
assert.equal(routingDiagnosis.dimensions.find((entry) => entry.id === 'POLICY')?.status, 'NOT_REACHED');
const routingInput = { ...routingSnapshot.state, events: builderTimelineJournalThroughSequence(journal, routingSnapshot.sequence) };
const historicalWorkbench = buildBuilderDeviceWorkbench(routingInput, { plane: 'routed', id: 'edge' });
assert.equal(historicalWorkbench.depthInput, routingInput, 'core workbench snapshot should pass through the exact selected canonical input without cloning another truth model');
const historicalCausality = builderApplicationDiagnosisSection(routingInput, historicalWorkbench.device);
assert.ok(historicalCausality);
assert.equal(historicalCausality.rows.some((entry) => entry.id === 'app:first-broken'), false, 'first broken truth cannot leak into the earlier routing snapshot');
const terminalInput = { ...terminalSnapshot.state, events: builderTimelineJournalThroughSequence(journal, terminalSnapshot.sequence) };
const terminalWorkbench = buildBuilderDeviceWorkbench(terminalInput, { plane: 'routed', id: 'edge' });
const terminalCausality = builderApplicationDiagnosisSection(terminalInput, terminalWorkbench.device);
assert.ok(terminalCausality?.rows.some((entry) => entry.id === 'app:first-broken' && entry.value === 'POLICY'));
const protocolDatabase = builderProtocolDatabaseSection(terminalWorkbench);
assert.ok(protocolDatabase && protocolDatabase.rows.length > 0, 'time-native protocol database/counter rows must summarize the selected canonical Device Workbench rows');

const workbenchCoreSource = readFileSync('src/builder/device-workbench.ts', 'utf8');
const workbenchWrapperSource = readFileSync('src/BuilderDeviceWorkbench.tsx', 'utf8');
const workbenchContentSource = readFileSync('src/BuilderDeviceWorkbenchContent.tsx', 'utf8');
const workbenchDepthSource = readFileSync('src/builder/workbench-depth.ts', 'utf8');
assert.doesNotMatch(workbenchCoreSource, /from ['"]\.\/workbench-depth\.ts['"]/, 'protocol/causal depth must not be statically reachable from the core workbench model');
assert.match(workbenchWrapperSource, /lazy\(\(\) => import\('\.\/BuilderDeviceWorkbenchContent\.tsx'\)/, 'the entire Device Workbench inspector must live behind an explicit lazy Builder boundary');
assert.match(workbenchContentSource, /import BuilderWorkbenchDepthPanel from ['"]\.\/BuilderWorkbenchDepthPanel\.tsx['"]/, 'causal/protocol depth must travel with the lazy Device Workbench inspector instead of the startup bundle');
assert.match(workbenchContentSource, /snapshot=\{snapshot\}/, 'lazy depth must consume the exact selected canonical workbench snapshot');
assert.doesNotMatch(workbenchDepthSource, /from ['"]\.\/(?:bgp|routing|stp|ipv6|ipv6-routing-depth)\.ts['"]/, 'depth summaries must count existing workbench facts instead of rerunning protocol engines or creating shared startup chunks');

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

console.log('Track A causal diagnosis contract passed: independent truth dimensions, canonical application-stage replay, time-native protocol/counter state, exact first-broken-boundary ranking, no future-state leakage, policy vs translation separation, IPv6 no-NAT66 truth, canonical causal chains, and a lazy Device Workbench boundary that keeps causal depth out of startup truth and bundle scope.');
