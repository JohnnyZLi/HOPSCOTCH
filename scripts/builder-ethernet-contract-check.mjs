import assert from 'node:assert/strict';
import { createDefaultBuilderEthernetConfig, parseBuilderAllowedVlans, runBuilderEthernetFlow, updateBuilderEthernetLink, validateBuilderEthernetConfig } from '../src/builder/ethernet.ts';
import { createDefaultBuilderAddressing } from '../src/builder/addressing.ts';
import { defaultBuilderGraph, defaultBuilderLayout } from '../src/builder/model.ts';
import { createDefaultBuilderRoutingConfig } from '../src/builder/routing.ts';
import { createBuilderScenario, deserializeBuilderScenario, serializeBuilderScenario } from '../src/builder/scenario.ts';

const fabric = createDefaultBuilderEthernetConfig();
assert.equal(validateBuilderEthernetConfig(fabric).devices.filter((d)=>d.kind==='switch').length,3);
assert.deepEqual(fabric.vlans.map((v)=>v.id),[10,20]);

const same = runBuilderEthernetFlow(fabric,'lan-a','lan-b');
assert.equal(same.success,true);
assert.equal(same.routed,false);
assert.equal(same.ttlAfter,64);
assert.deepEqual(same.segments[0].nodeIds,['lan-a','lan-sw1','lan-sw2','lan-b']);
assert.deepEqual(same.segments[0].linkIds,['lan-a-sw1','lan-sw1-sw2','lan-b-sw2']);
assert.ok(same.fdb.some((entry)=>entry.switchId==='lan-sw1'&&entry.vlanId===10&&entry.mac==='02:48:4f:10:00:0a'));
assert.ok(same.fdb.some((entry)=>entry.switchId==='lan-sw2'&&entry.vlanId===10&&entry.mac==='02:48:4f:10:00:0b'));

const routed = runBuilderEthernetFlow(fabric,'lan-a','lan-c');
assert.equal(routed.success,true);
assert.equal(routed.routed,true);
assert.equal(routed.routedAt,'lan-r1');
assert.equal(routed.ttlAfter,63);
assert.deepEqual(routed.segments.map((s)=>s.vlanId),[10,20]);
assert.deepEqual(routed.segments[0].nodeIds,['lan-a','lan-sw1','lan-r1']);
assert.deepEqual(routed.segments[1].nodeIds,['lan-r1','lan-sw1','lan-sw2','lan-c']);

const vlan20Blocked = updateBuilderEthernetLink(fabric,'lan-sw1-sw2',{allowedVlans:[10]});
const blocked = runBuilderEthernetFlow(vlan20Blocked,'lan-a','lan-c');
assert.equal(blocked.success,false);
assert.match(blocked.failureReason,/tagged\/access Layer-2 path/);
assert.equal(runBuilderEthernetFlow(vlan20Blocked,'lan-a','lan-b').success,true,'VLAN 10 remains permitted on the trunk');

const accessMismatch = updateBuilderEthernetLink(fabric,'lan-b-sw2',{accessVlan:20});
const isolated = runBuilderEthernetFlow(accessMismatch,'lan-a','lan-b');
assert.equal(isolated.success,false);
assert.match(isolated.failureReason,/no active Layer-2 path/);

const downTrunk = updateBuilderEthernetLink(fabric,'lan-sw1-sw2',{failed:true});
const stpFailover=runBuilderEthernetFlow(downTrunk,'lan-a','lan-b'); assert.equal(stpFailover.success,true); assert.deepEqual(stpFailover.segments[0].nodeIds,['lan-a','lan-sw1','lan-sw3','lan-sw2','lan-b']); assert.equal(runBuilderEthernetFlow(downTrunk,'lan-a','lan-c').success,false);
assert.deepEqual(parseBuilderAllowedVlans('20, 10,20',fabric),[10,20]);
assert.throws(()=>parseBuilderAllowedVlans('10,999',fabric),/existing VLAN/);
assert.throws(()=>updateBuilderEthernetLink(fabric,'lan-a-sw1',{mode:'trunk',allowedVlans:[10]}),/Endpoint links cannot be trunks/);

const scenario=createBuilderScenario('LAN persisted',defaultBuilderGraph,'client','app',defaultBuilderLayout,createDefaultBuilderAddressing(defaultBuilderGraph),createDefaultBuilderRoutingConfig(),undefined,fabric);
assert.equal(scenario.version,9);
const restored=deserializeBuilderScenario(serializeBuilderScenario(scenario));
assert.deepEqual(restored.ethernet.links.find((link)=>link.id==='lan-sw1-sw2')?.allowedVlans,[10,20]);
const legacyV5={...scenario,version:5}; delete legacyV5.ethernet; delete legacyV5.linkProfiles; delete legacyV5.acl; delete legacyV5.nat;
const migrated=deserializeBuilderScenario(JSON.stringify(legacyV5));
assert.equal(migrated.version,9); assert.equal(migrated.ethernet.devices.length,0,'legacy routed scenarios migrate without silently fabricating a LAN'); assert.equal(migrated.nat.boundaries.length,0,'legacy scenarios do not silently fabricate NAT');

console.log('Builder Ethernet/VLAN contract passed: access switching, VLAN-scoped learning, trunks, trunk filtering, router-on-a-stick inter-VLAN routing, TTL boundary, explicit isolation, and schema-v8 migration.');
