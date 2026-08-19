import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  builderEthernetPathForVlan,
  cloneBuilderEthernetConfig,
  createDefaultBuilderEthernetConfig,
  runBuilderEthernetFlow,
  validateBuilderEthernetConfig,
} from '../src/builder/ethernet.ts';
import {
  builderFirstHopGroups,
  builderLacpBundles,
  builderLldpNeighbors,
  builderNativeVlanStates,
  builderRstpFailoverPlan,
  builderRstpState,
  builderVrfLookup,
  builderVrfTables,
  createBuilderEnterpriseDemo,
  runBuilderEnterpriseFlow,
  validateBuilderEnterpriseConfig,
} from '../src/builder/enterprise.ts';
import { defaultBuilderScenario, deserializeBuilderScenario, serializeBuilderScenario } from '../src/builder/scenario.ts';
import { createEmptyBuilderDhcpConfig } from '../src/builder/dhcp.ts';

// Existing Lab 11 switching truth remains intact by default.
const legacy = createDefaultBuilderEthernetConfig();
assert.equal(validateBuilderEthernetConfig(legacy).stp.protocol, undefined);
assert.equal(runBuilderEthernetFlow(legacy, 'lan-a', 'lan-c').success, true);

const demo = createBuilderEnterpriseDemo();
const clonedDemo=cloneBuilderEthernetConfig(demo); clonedDemo.links[0].failed=true; clonedDemo.vrfStaticRoutes[0].prefix='192.0.2.0/24';
assert.equal(demo.links[0].failed,false); assert.equal(demo.vrfStaticRoutes[0].prefix,'10.60.0.0/24');
assert.equal(demo.devices.filter((device) => device.kind === 'l3-switch').length, 3);
assert.equal(demo.links.filter((link) => link.mode === 'routed').length, 4);
assert.equal(demo.stp.protocol, 'rstp');
const badBundle=cloneBuilderEthernetConfig(demo); badBundle.links.find((link)=>link.id==='access-a-dist-a-2').allowedVlans=[110];
assert.throws(()=>validateBuilderEnterpriseConfig(badBundle),/EtherChannel/);
const badRoute=cloneBuilderEthernetConfig(demo); badRoute.vrfStaticRoutes[0].vrfId='RED';
assert.throws(()=>validateBuilderEnterpriseConfig(badRoute),/VRF static route/);

// LACP keeps logical bundle truth separate from physical member truth.
const bundles = builderLacpBundles(demo);
const accessBundle = bundles.find((bundle) => bundle.id === 'po-access-a');
assert.ok(accessBundle);
assert.equal(accessBundle.protocol, 'lacp');
assert.deepEqual(accessBundle.memberLinkIds, ['access-a-dist-a-1', 'access-a-dist-a-2']);
assert.equal(accessBundle.state, 'UP');
assert.equal(accessBundle.forwardingMemberLinkId, 'access-a-dist-a-1');
const oneMemberDown = cloneBuilderEthernetConfig(demo);
oneMemberDown.links.find((link) => link.id === 'access-a-dist-a-1').failed = true;
const degraded = builderLacpBundles(oneMemberDown).find((bundle) => bundle.id === 'po-access-a');
assert.equal(degraded.state, 'DEGRADED');
assert.equal(degraded.forwardingMemberLinkId, 'access-a-dist-a-2');
const bothMembersDown = cloneBuilderEthernetConfig(oneMemberDown);
bothMembersDown.links.find((link) => link.id === 'access-a-dist-a-2').failed = true;
assert.equal(builderLacpBundles(bothMembersDown).find((bundle) => bundle.id === 'po-access-a').state, 'DOWN');

// LLDP is derived directly from active physical adjacency, including each bundle member.
const lldp = builderLldpNeighbors(demo);
assert.equal(lldp.filter((neighbor) => neighbor.bundleId === 'po-access-a').length, 4);
assert.ok(lldp.some((neighbor) => neighbor.localDeviceId === 'dist-a' && neighbor.remoteDeviceId === 'core' && neighbor.linkMode === 'routed'));
const failedLldp = builderLldpNeighbors(oneMemberDown);
assert.equal(failedLldp.some((neighbor) => neighbor.linkId === 'access-a-dist-a-1'), false);

// RSTP exposes explicit role/state and a materially faster bounded transition plan.
const rstp110 = builderRstpState(demo, 110);
assert.equal(rstp110.protocol, 'rstp');
assert.equal(rstp110.rootBridgeId, 'access-a');
assert.ok(rstp110.ports.some((port) => port.role === 'ALTERNATE' && port.state === 'DISCARDING'));
const rstpFailover = builderRstpFailoverPlan(demo, 110, 'access-a-dist-b');
assert.equal(rstpFailover.protocol, 'rstp');
assert.equal(rstpFailover.convergedAtMs, 400);
assert.ok(rstpFailover.events.some((event) => event.kind === 'LEARNING'));
assert.equal(rstpFailover.events.at(-1).kind, 'FORWARDING');
const classic = cloneBuilderEthernetConfig(demo); classic.stp.protocol = 'stp';
assert.equal(builderRstpFailoverPlan(classic, 110, 'access-a-dist-b').convergedAtMs, 30000);

// Native/tagged truth fails closed on an encoding mismatch rather than silently changing VLAN identity.
const mismatch = cloneBuilderEthernetConfig(legacy);
const trunk = mismatch.links.find((link) => link.id === 'lan-sw1-sw2');
trunk.nativeVlanA = 10; trunk.nativeVlanB = 20;
trunk.allowedVlans = [10, 20];
const mismatchState = builderNativeVlanStates(mismatch).find((entry) => entry.linkId === trunk.id);
assert.equal(mismatchState.state, 'MISMATCH');
assert.deepEqual(mismatchState.mismatchedVlanIds, [10, 20]);
const preservedAlternate = builderEthernetPathForVlan(mismatch, 'lan-a', 'lan-b', 10);
assert.ok(preservedAlternate);
assert.equal(preservedAlternate.linkIds.includes('lan-sw1-sw2'), false);

// Virtual first-hop ownership is deterministic and follows shared physical/L2 state.
const firstHop = builderFirstHopGroups(demo);
const blueGateway = firstHop.find((group) => group.vrfId === 'BLUE' && group.vlanId === 110);
const redGateway = firstHop.find((group) => group.vrfId === 'RED' && group.vlanId === 120);
assert.equal(blueGateway.virtualGateway, '10.50.0.1');
assert.equal(redGateway.virtualGateway, '10.50.0.1');
assert.equal(blueGateway.masterDeviceId, 'dist-a');
assert.equal(blueGateway.members[0].priority, 120);

// VRFs own genuinely separate route tables even when prefixes and endpoint addresses overlap.
const vrfTables = builderVrfTables(demo);
assert.ok(vrfTables.find((table) => table.deviceId === 'dist-a' && table.vrfId === 'BLUE').routes.some((route) => route.prefix === '10.50.0.0/24'));
assert.ok(vrfTables.find((table) => table.deviceId === 'dist-a' && table.vrfId === 'RED').routes.some((route) => route.prefix === '10.50.0.0/24'));
assert.equal(builderVrfLookup(demo, 'dist-a', 'BLUE', '10.60.0.10').id, 'blue-dist-a-apps');
assert.equal(builderVrfLookup(demo, 'dist-a', 'RED', '10.60.0.10').id, 'red-dist-a-apps');
const blueFlow = runBuilderEnterpriseFlow(demo, 'blue-client', 'blue-server');
assert.equal(blueFlow.success, true);
assert.equal(blueFlow.vrfId, 'BLUE');
assert.equal(blueFlow.sourceGatewayDeviceId, 'dist-a');
assert.equal(blueFlow.sourceGatewayVirtual, true);
assert.deepEqual(blueFlow.routedLinkIds, ['dist-a-core-blue']);
const redFlow = runBuilderEnterpriseFlow(demo, 'red-client', 'red-server');
assert.equal(redFlow.success, true);
assert.equal(redFlow.vrfId, 'RED');
assert.deepEqual(redFlow.routedLinkIds, ['dist-a-core-red']);
const leakAttempt = runBuilderEnterpriseFlow(demo, 'blue-client', 'red-server');
assert.equal(leakAttempt.success, false);
assert.match(leakAttempt.failureReason, /VRF|overlapping|destination VLAN|gateway/i);

// Failure of DIST-A's user-VLAN attachment moves virtual gateway ownership and traffic to DIST-B.
const distAFailed = cloneBuilderEthernetConfig(demo);
for (const id of ['access-a-dist-a-1', 'access-a-dist-a-2', 'dist-a-dist-b']) distAFailed.links.find((link) => link.id === id).failed = true;
assert.equal(builderFirstHopGroups(distAFailed).find((group) => group.vrfId === 'BLUE' && group.vlanId === 110).masterDeviceId, 'dist-b');
const failoverFlow = runBuilderEnterpriseFlow(distAFailed, 'blue-client', 'blue-server');
assert.equal(failoverFlow.success, true);
assert.equal(failoverFlow.sourceGatewayDeviceId, 'dist-b');
assert.deepEqual(failoverFlow.routedLinkIds, ['dist-b-core-blue']);

// Enterprise configuration stays additive in canonical scenario v9.
const base = defaultBuilderScenario();
const scenarioText = serializeBuilderScenario({ ...base, name: 'Enterprise Track C', ethernet: demo, dhcp: createEmptyBuilderDhcpConfig() });
const restored = deserializeBuilderScenario(scenarioText);
assert.equal(restored.version, 9);
assert.equal(restored.ethernet.devices.find((device) => device.id === 'dist-a').kind, 'l3-switch');
assert.equal(restored.ethernet.links.find((link) => link.id === 'access-a-dist-a-1').bundleId, 'po-access-a');
assert.equal(restored.ethernet.links.find((link) => link.id === 'dist-a-core-blue').vrfId, 'BLUE');
assert.equal(restored.ethernet.stp.protocol, 'rstp');
assert.equal(restored.ethernet.vrfStaticRoutes.length, demo.vrfStaticRoutes.length);

// Product integration stays behind the already-lazy Builder authoring boundary.
const authoringSource = fs.readFileSync(new URL('../src/BuilderAuthoringPanelContent.tsx', import.meta.url), 'utf8');
const enterprisePanelSource = fs.readFileSync(new URL('../src/BuilderEnterprisePanel.tsx', import.meta.url), 'utf8');
assert.match(authoringSource, /lazy\(\(\) => import\('\.\/BuilderEnterprisePanel\.tsx'\)\)/);
assert.match(authoringSource, /enterpriseOpen&&<Suspense/);
assert.match(enterprisePanelSource, /RSTP \+ PHYSICAL LINKS/);
assert.match(enterprisePanelSource, /LACP \/ ETHERCHANNEL \+ LLDP/);
assert.match(enterprisePanelSource, /L3 SWITCHING \+ FIRST-HOP REDUNDANCY/);
assert.match(enterprisePanelSource, /VRFS \+ ROUTED PORTS/);
assert.match(enterprisePanelSource, /NATIVE \/ TAGGED \/ UNTAGGED VLAN TRUTH/);

console.log('Track C enterprise contract passed: RSTP timing/roles, LACP logical-vs-physical truth, LLDP derivation, L3 switching/SVIs/routed ports, virtual first-hop failover, VRF isolation with overlapping prefixes, native/tagged fail-closed semantics, scenario-v9 persistence, and lazy product integration.');
