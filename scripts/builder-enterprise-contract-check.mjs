import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cloneBuilderEthernetConfig, createDefaultBuilderEthernetConfig, validateBuilderEthernetConfig } from '../src/builder/ethernet.ts';
import {
  builderFhrpState,
  builderLacpSelectMember,
  builderLacpState,
  builderLldpNeighbors,
  builderResolveEnterpriseGateway,
  builderRstpConvergence,
  builderEnterpriseStpState,
  builderVlanEncapsulation,
  builderVrfRouteTables,
  createEnterpriseCampusFixture,
  runBuilderEnterpriseEthernetFlow,
  validateBuilderEthernetEnterpriseConfig,
} from '../src/builder/enterprise.ts';
import { createBuilderScenario, deserializeBuilderScenario, serializeBuilderScenario } from '../src/builder/scenario.ts';
import { createDefaultBuilderAddressing } from '../src/builder/addressing.ts';
import { createDefaultBuilderRoutingConfig } from '../src/builder/routing.ts';
import { createDefaultBuilderLinkProfiles } from '../src/builder/link-characteristics.ts';
import { createDefaultBuilderAclConfig } from '../src/builder/acl.ts';
import { createDefaultBuilderNatConfig } from '../src/builder/nat.ts';
import { createDefaultBuilderDhcpConfig } from '../src/builder/dhcp.ts';
import { createDefaultBuilderIpv6Config } from '../src/builder/ipv6.ts';
import { defaultBuilderGraph, defaultBuilderLayout } from '../src/builder/model.ts';

const base = createDefaultBuilderEthernetConfig();
let campus = createEnterpriseCampusFixture(base);
campus.enterprise = validateBuilderEthernetEnterpriseConfig(campus, campus.enterprise);
campus = validateBuilderEthernetConfig(campus);
assert.equal(campus.stp.protocol, 'rstp');
assert.equal(campus.devices.filter((device) => device.kind === 'l3-switch').length, 2, 'campus fixture must use canonical Layer-3 switch devices');
assert.ok(campus.enterprise?.lacpBundles.length === 2);
assert.ok(campus.enterprise?.fhrpGroups.length === 2);

const po10 = builderLacpState(campus, 'po10');
assert.equal(po10.up, true);
assert.equal(po10.activeMemberLinkIds.length, 2);
assert.ok(builderLacpSelectMember(campus, 'po10', '10.10.0.10:49152>10.20.0.10:443'));
const oneMemberDown = structuredClone(campus);
oneMemberDown.links.find((link) => link.id === 'sw1-dist-a-1').failed = true;
assert.equal(builderLacpState(oneMemberDown, 'po10').up, true, 'minLinks=1 must preserve logical bundle with one live member');
const allMembersDown = structuredClone(oneMemberDown);
allMembersDown.links.find((link) => link.id === 'sw1-dist-a-2').failed = true;
assert.equal(builderLacpState(allMembersDown, 'po10').up, false);
const passive = structuredClone(campus);
passive.enterprise.lacpBundles[0].modeA = 'passive'; passive.enterprise.lacpBundles[0].modeB = 'passive';
assert.equal(builderLacpState(passive, 'po10').negotiated, false, 'passive/passive cannot invent an LACP adjacency');

const lldp = builderLldpNeighbors(campus);
assert.equal(lldp.length, campus.links.length * 2, 'LLDP state must be derived from each configured physical adjacency in both directions');
assert.ok(lldp.some((row) => row.bundleId === 'po10'), 'LLDP must retain physical-member lineage underneath a logical bundle');

const vlan10 = builderFhrpState(campus, 'vlan10-gw');
assert.equal(vlan10.masterDeviceId, 'dist-a');
assert.equal(builderResolveEnterpriseGateway(campus, 'lan-a').gatewayDeviceId, 'dist-a');
const distAFailed = structuredClone(campus);
for (const link of distAFailed.links) if (link.a === 'dist-a' || link.b === 'dist-a') link.failed = true;
assert.equal(builderFhrpState(distAFailed, 'vlan10-gw').masterDeviceId, 'dist-b', 'first-hop master must fail over to the highest-priority available member');
assert.equal(builderResolveEnterpriseGateway(distAFailed, 'lan-a').gatewayDeviceId, 'dist-b');

const routed = structuredClone(campus);
routed.links.push({ id: 'dist-core-routed', a: 'dist-a', b: 'dist-b', mode: 'routed', failed: false, routed: { cidr: '172.16.0.0/30', aAddress: '172.16.0.1', bAddress: '172.16.0.2', vrfId: 'default', aName: 'Eth1/49', bName: 'Eth1/49' } });
routed.enterprise.vrfs.push({ id: 'tenant-b', label: 'TENANT B' });
routed.vlans.push({ id: 30, name: 'TENANT-A-USERS', cidr: '10.10.0.0/24' });
routed.devices.find((device) => device.id === 'dist-a').interfaces.push({ vlanId: 30, address: '10.10.0.2', vrfId: 'tenant-a', name: 'Vlan30' });
const routedValidated = validateBuilderEthernetConfig(routed);
const clonedRouted=cloneBuilderEthernetConfig(routedValidated);
clonedRouted.links.find((link)=>link.id==='dist-core-routed').routed.aAddress='172.16.0.9';
assert.equal(routedValidated.links.find((link)=>link.id==='dist-core-routed').routed.aAddress,'172.16.0.1','routed-port clone must not alias nested config');
const routeRows = builderVrfRouteTables(routedValidated);
assert.ok(routeRows.some((row) => row.source === 'ROUTED PORT' && row.prefix === '172.16.0.0/30'));
assert.ok(routeRows.some((row) => row.vrfId === 'default' && row.prefix === '10.10.0.0/24'));
assert.ok(routeRows.some((row) => row.vrfId === 'tenant-a' && row.prefix === '10.10.0.0/24'), 'overlapping prefixes must remain valid because route tables are VRF-separated');

const trunk = campus.links.find((link) => link.id === 'sw1-dist-a-1');
assert.ok(trunk);
assert.equal(builderVlanEncapsulation(trunk, 10).a, 'UNTAGGED');
assert.equal(builderVlanEncapsulation(trunk, 20).a, 'TAGGED');
const mismatch = { ...trunk, nativeVlanB: 20 };
assert.equal(builderVlanEncapsulation(mismatch, 10).mismatch, true);
assert.equal(builderVlanEncapsulation(mismatch, 20).mismatch, true);

const rstp = builderRstpConvergence(campus, 10, 'lan-sw1-sw2');
const classicConfig = structuredClone(campus); classicConfig.stp.protocol = 'stp';
const classic = builderRstpConvergence(classicConfig, 10, 'lan-sw1-sw2');
assert.ok(rstp.convergenceMs <= 2000);
assert.ok(classic.convergenceMs === 0 || classic.convergenceMs >= 30000);
if (rstp.convergenceMs > 0 && classic.convergenceMs > 0) assert.ok(rstp.convergenceMs < classic.convergenceMs, 'RSTP must explicitly converge faster than classic STP');

const bundleStp=builderEnterpriseStpState(campus,10);
assert.equal(bundleStp.blockedLinkIds.includes('sw1-dist-a-2'),false,'physical LACP members must not masquerade as separately STP-blocked links');
const flow = runBuilderEnterpriseEthernetFlow(campus, 'lan-a', 'lan-c');
assert.equal(flow.success, true, flow.failureReason ?? 'enterprise inter-VLAN flow should succeed');
assert.equal(flow.routedAt, 'dist-a', 'source VLAN FHRP master must be the routed hop');
const vrfIsolated = structuredClone(campus);
vrfIsolated.devices.find((device) => device.id === 'lan-c').interfaces[0].vrfId = 'tenant-a';
assert.match(runBuilderEnterpriseEthernetFlow(vrfIsolated, 'lan-a', 'lan-c').failureReason ?? '', /VRF isolation/);

const graph = defaultBuilderGraph;
const addressing = createDefaultBuilderAddressing(graph);
const scenario = createBuilderScenario('Track C campus', graph, 'client', 'app', defaultBuilderLayout, addressing, createDefaultBuilderRoutingConfig(), undefined, campus, createDefaultBuilderLinkProfiles(graph), createDefaultBuilderAclConfig(), createDefaultBuilderNatConfig(graph), createDefaultBuilderDhcpConfig(campus), createDefaultBuilderIpv6Config(graph, addressing));
assert.equal(scenario.version, 9, 'Track C must remain additive to scenario v9');
const roundTrip = deserializeBuilderScenario(serializeBuilderScenario(scenario));
assert.equal(roundTrip.version, 9);
assert.equal(roundTrip.ethernet.stp.protocol, 'rstp');
assert.equal(roundTrip.ethernet.enterprise?.lacpBundles.length, 2);
assert.equal(roundTrip.ethernet.enterprise?.fhrpGroups[0].virtualIp, '10.10.0.1');

const networkBuilderSource = readFileSync('src/NetworkBuilder.tsx', 'utf8');
const authoringSource = readFileSync('src/BuilderAuthoringPanelContent.tsx', 'utf8');
const panelSource = readFileSync('src/BuilderEnterprisePanel.tsx', 'utf8');
assert.doesNotMatch(networkBuilderSource, /builder\/enterprise|BuilderEnterprisePanel/, 'Track C depth must stay out of the startup NetworkBuilder chunk');
assert.match(authoringSource, /BuilderEnterprisePanel/, 'Track C must be reachable from the existing lazy authoring workspace');
assert.match(panelSource, /LOAD CAMPUS/);
assert.match(panelSource, /LOGICAL VS PHYSICAL/);
assert.match(panelSource, /REDUNDANT GATEWAYS/);
assert.match(panelSource, /SEPARATE ROUTING TABLES/);
assert.match(panelSource, /TAG TRUTH/);
assert.match(panelSource, /DERIVED NEIGHBORS/);

console.log('Track C enterprise contract passed: RSTP timing, logical LACP bundles with physical-member lineage, derived LLDP, L3 switches/SVIs/routed ports, FHRP failover, VRF-separated overlapping prefixes, explicit native/tagged VLAN behavior, scenario-v9 round trip, canonical inter-VLAN forwarding, and lazy product integration.');
