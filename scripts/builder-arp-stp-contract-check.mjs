import assert from 'node:assert/strict';
import { createDefaultBuilderEthernetConfig, runBuilderEthernetFlow, updateBuilderEthernetLink, validateBuilderEthernetConfig } from '../src/builder/ethernet.ts';
import { resolveBuilderEthernetFlowArp } from '../src/builder/arp.ts';
import { builderStpState } from '../src/builder/stp.ts';

const fabric=createDefaultBuilderEthernetConfig();
const validated=validateBuilderEthernetConfig(fabric);
assert.equal(validated.devices.filter((device)=>device.kind==='switch').length,3);
const stp10=builderStpState(fabric,10);
assert.equal(stp10.enabled,true);
assert.equal(stp10.rootBridgeId,'lan-sw1');
assert.equal(stp10.loopDetected,true);
assert.ok(stp10.blockedLinkIds.includes('lan-sw2-sw3'));

let arp=resolveBuilderEthernetFlowArp(fabric,'lan-a','lan-b',[]);
assert.equal(arp.success,true);
assert.equal(arp.resolutions.length,1);
assert.equal(arp.resolutions[0].cacheHit,false);
assert.equal(arp.resolutions[0].targetAddress,'10.10.0.11');
assert.deepEqual(arp.resolutions[0].requestNodeIds,['lan-a','lan-sw1','lan-sw2','lan-b']);
const cached=resolveBuilderEthernetFlowArp(fabric,'lan-a','lan-b',arp.cache);
assert.equal(cached.resolutions[0].cacheHit,true);
assert.equal(cached.resolutions[0].requestLinkIds.length,0);

const routedArp=resolveBuilderEthernetFlowArp(fabric,'lan-a','lan-c',[]);
assert.equal(routedArp.success,true);
assert.equal(routedArp.resolutions.length,2);
assert.equal(routedArp.resolutions[0].targetAddress,'10.10.0.1');
assert.equal(routedArp.resolutions[0].targetDeviceId,'lan-r1');
assert.equal(routedArp.resolutions[1].targetAddress,'10.20.0.10');

const noStp={...fabric,stp:{...fabric.stp,enabled:false}};
assert.equal(builderStpState(noStp,10).loopDetected,true);
const unsafe=runBuilderEthernetFlow(noStp,'lan-a','lan-b');
assert.equal(unsafe.success,false);
assert.match(unsafe.failureReason,/STP is disabled|Layer-2 cycle/);

const failedPrimary=updateBuilderEthernetLink(fabric,'lan-sw1-sw2',{failed:true});
const reconverged=builderStpState(failedPrimary,10);
assert.equal(reconverged.blockedLinkIds.includes('lan-sw2-sw3'),false);
const alternate=runBuilderEthernetFlow(failedPrimary,'lan-a','lan-b');
assert.equal(alternate.success,true);
assert.deepEqual(alternate.segments[0].nodeIds,['lan-a','lan-sw1','lan-sw3','lan-sw2','lan-b']);

console.log('Builder ARP/STP contract passed: host/gateway resolution, cache hits, deterministic root/blocking, unsafe loop detection, and trunk-failure reconvergence.');
