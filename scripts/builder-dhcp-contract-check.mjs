import assert from 'node:assert/strict';
import { createDefaultBuilderEthernetConfig, runBuilderEthernetFlow, updateBuilderEthernetLink } from '../src/builder/ethernet.ts';
import {
  applyBuilderDhcpState,
  builderDhcpClientReady,
  clearBuilderDhcpLeases,
  createDefaultBuilderDhcpConfig,
  pruneBuilderDhcpLeases,
  releaseBuilderDhcpLease,
  renewBuilderDhcpLease,
  runBuilderDhcpAcquire,
  setBuilderDhcpClient,
  upsertBuilderDhcpPool,
  upsertBuilderDhcpRelay,
  validateBuilderDhcpConfig,
} from '../src/builder/dhcp.ts';

const ethernet=createDefaultBuilderEthernetConfig();
let dhcp=createDefaultBuilderDhcpConfig(ethernet);
dhcp=validateBuilderDhcpConfig(ethernet,dhcp);
assert.equal(dhcp.pools.length,2);
assert.deepEqual(dhcp.pools.map((pool)=>pool.vlanId),[10,20]);
assert.ok(dhcp.pools.every((pool)=>pool.serverDeviceId==='lan-r1'));
assert.deepEqual(dhcp.clientDeviceIds,[],'DHCP must be opt-in so existing static LAN behavior remains stable');

dhcp=setBuilderDhcpClient(ethernet,dhcp,'lan-a',true);
assert.deepEqual(dhcp.clientDeviceIds,['lan-a']);
let leases=clearBuilderDhcpLeases();
const before=applyBuilderDhcpState(ethernet,dhcp,leases,1);
assert.equal(before.devices.find((device)=>device.id==='lan-a')?.interfaces[0].address,'0.0.0.0','DHCP client begins without an IPv4 lease');
assert.equal(before.devices.find((device)=>device.id==='lan-a')?.interfaces[0].gateway,null);
assert.equal(builderDhcpClientReady(dhcp,leases,'lan-a',1),false);

const acquired=runBuilderDhcpAcquire(ethernet,dhcp,leases,'lan-a',1);
assert.equal(acquired.success,true);
assert.equal(acquired.configurationReady,true);
assert.equal(acquired.relayed,false);
assert.deepEqual(acquired.events.map((event)=>event.kind),['DISCOVER','OFFER','REQUEST','ACK']);
assert.equal(acquired.lease?.address,'10.10.0.100');
assert.equal(acquired.lease?.gateway,'10.10.0.1');
assert.deepEqual(acquired.lease?.dnsServers,['1.1.1.1','8.8.8.8']);
assert.equal(acquired.lease?.subnetMask,'255.255.255.0');
leases=acquired.leases;
const after=applyBuilderDhcpState(ethernet,dhcp,leases,1);
assert.equal(after.devices.find((device)=>device.id==='lan-a')?.interfaces[0].address,'10.10.0.100');
assert.equal(after.devices.find((device)=>device.id==='lan-a')?.interfaces[0].gateway,'10.10.0.1');
assert.equal(builderDhcpClientReady(dhcp,leases,'lan-a',1),true);
assert.equal(runBuilderEthernetFlow(after,'lan-a','lan-c').success,true,'leased host configuration feeds existing ARP/L2/L3 Ethernet flow truth');

const renewAt=acquired.lease.renewAtSequence;
const renewed=renewBuilderDhcpLease(ethernet,dhcp,leases,'lan-a',renewAt);
assert.equal(renewed.success,true);
assert.equal(renewed.events[0].kind,'RENEW');
assert.ok(renewed.lease.expiresAtSequence>acquired.lease.expiresAtSequence);
leases=renewed.leases;

const released=releaseBuilderDhcpLease(leases,'lan-a',renewAt+1);
assert.equal(released.event?.kind,'RELEASE');
assert.equal(released.leases.length,0);
assert.equal(builderDhcpClientReady(dhcp,released.leases,'lan-a',renewAt+1),false);

const shortPool={...dhcp.pools.find((pool)=>pool.vlanId===10),leaseSteps:4};
let shortConfig=upsertBuilderDhcpPool(ethernet,dhcp,shortPool);
const short=runBuilderDhcpAcquire(ethernet,shortConfig,[],'lan-a',10);
assert.equal(short.success,true);
assert.equal(pruneBuilderDhcpLeases(short.leases,short.lease.expiresAtSequence).length,1);
assert.equal(pruneBuilderDhcpLeases(short.leases,short.lease.expiresAtSequence+1).length,0,'lease expires deterministically after the configured sequence horizon');

const incompletePool={...dhcp.pools.find((pool)=>pool.vlanId===10),gateway:null,dnsServers:[]};
const incompleteConfig=upsertBuilderDhcpPool(ethernet,dhcp,incompletePool);
const incomplete=runBuilderDhcpAcquire(ethernet,incompleteConfig,[],'lan-a',20);
assert.equal(incomplete.success,true,'DORA can complete even when optional host configuration is incomplete');
assert.equal(incomplete.configurationReady,false);
assert.deepEqual(incomplete.optionsIssues,['DEFAULT GATEWAY MISSING','DNS OPTION MISSING']);
assert.match(incomplete.summary,/incomplete/i);

let tinyPool={...dhcp.pools.find((pool)=>pool.vlanId===10),startAddress:'10.10.0.200',endAddress:'10.10.0.200'};
let exhaustionConfig=upsertBuilderDhcpPool(ethernet,dhcp,tinyPool);
exhaustionConfig=setBuilderDhcpClient(ethernet,exhaustionConfig,'lan-b',true);
const firstTiny=runBuilderDhcpAcquire(ethernet,exhaustionConfig,[],'lan-a',30);
assert.equal(firstTiny.success,true);
assert.equal(firstTiny.lease.address,'10.10.0.200');
const exhausted=runBuilderDhcpAcquire(ethernet,exhaustionConfig,firstTiny.leases,'lan-b',31);
assert.equal(exhausted.success,false);
assert.match(exhausted.failureReason,/exhausted/i);

const remoteServerPool={
  ...dhcp.pools.find((pool)=>pool.vlanId===10),
  id:'dhcp-remote-v10',
  serverDeviceId:'lan-c',
  startAddress:'10.10.0.120',
  endAddress:'10.10.0.129',
};
let relayConfig={clientDeviceIds:['lan-a'],pools:[],relays:[]};
relayConfig=upsertBuilderDhcpRelay(ethernet,relayConfig,{id:'relay-v10-to-v20',routerId:'lan-r1',clientVlanId:10,serverDeviceId:'lan-c',serverVlanId:20});
relayConfig=upsertBuilderDhcpPool(ethernet,relayConfig,remoteServerPool);
const relayed=runBuilderDhcpAcquire(ethernet,relayConfig,[],'lan-a',40);
assert.equal(relayed.success,true);
assert.equal(relayed.relayed,true);
assert.equal(relayed.lease.serverDeviceId,'lan-c');
assert.ok(relayed.events.every((event)=>event.relayed));
assert.ok(relayed.events[0].nodeIds.includes('lan-r1'));
assert.ok(relayed.events[0].nodeIds.includes('lan-c'));

const brokenRelayFabric=updateBuilderEthernetLink(ethernet,'lan-c-sw2',{failed:true});
const relayTimeout=runBuilderDhcpAcquire(brokenRelayFabric,relayConfig,[],'lan-a',41);
assert.equal(relayTimeout.success,false);
assert.match(relayTimeout.failureReason,/cannot reach any configured server or relay path/i);

const relayedLease=relayed.lease;
const brokenRenew=renewBuilderDhcpLease(brokenRelayFabric,relayConfig,relayed.leases,'lan-a',relayedLease.renewAtSequence);
assert.equal(brokenRenew.success,false);
assert.match(brokenRenew.failureReason,/RENEW|timed out/i);
assert.equal(brokenRenew.leases.length,1,'failed renewal does not destroy a lease that is still valid');
const brokenRebind=renewBuilderDhcpLease(brokenRelayFabric,relayConfig,relayed.leases,'lan-a',relayedLease.rebindAtSequence);
assert.equal(brokenRebind.success,false);
assert.match(brokenRebind.failureReason,/REBIND/i);

assert.throws(()=>setBuilderDhcpClient(ethernet,dhcp,'lan-sw1',true),/endpoint/i);
assert.throws(()=>upsertBuilderDhcpPool(ethernet,dhcp,{...dhcp.pools[0],startAddress:'10.99.0.2'}),/inside VLAN|range/i);

console.log('Builder DHCP contract passed: opt-in unconfigured clients, DORA, lease application, renew/release/expiry, incomplete options, pool exhaustion, routed relay, relay failure/rebind timeout, and validation.');
