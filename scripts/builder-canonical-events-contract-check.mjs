import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDefaultBuilderAddressing } from '../src/builder/addressing.ts';
import { createDefaultBuilderAclConfig } from '../src/builder/acl.ts';
import { clearBuilderArpCache, resolveBuilderEthernetFlowArp } from '../src/builder/arp.ts';
import { deriveBuilderCanonicalEventSpecs } from '../src/builder/canonical-events.ts';
import { applyBuilderDhcpState, createDefaultBuilderDhcpConfig, pruneBuilderDhcpLeases, releaseBuilderDhcpLease, renewBuilderDhcpLease, runBuilderDhcpAcquire, setBuilderDhcpClient, upsertBuilderDhcpPool } from '../src/builder/dhcp.ts';
import { appendBuilderWorkbenchEventBatch, appendBuilderWorkbenchMessageEvent, builderWorkbenchEventCausalChain, createBuilderWorkbenchEventJournal } from '../src/builder/device-workbench.ts';
import { createDefaultBuilderEthernetConfig, runBuilderEthernetFlow } from '../src/builder/ethernet.ts';
import { createBuilderIpv6ControlState } from '../src/builder/ipv6-control-plane.ts';
import { createBuilderIpv6LifecycleState } from '../src/builder/ipv6-lifecycle.ts';
import { createDefaultBuilderIpv6RoutingDepthState } from '../src/builder/ipv6-routing-depth.ts';
import { createDefaultBuilderIpv6Config } from '../src/builder/ipv6.ts';
import { createDefaultBuilderLinkProfiles } from '../src/builder/link-characteristics.ts';
import { cloneBuilderGraph, cloneBuilderLayout, defaultBuilderGraph, defaultBuilderLayout } from '../src/builder/model.ts';
import { createDefaultBuilderNatConfig } from '../src/builder/nat.ts';
import { runBuilderProbe } from '../src/builder/probes.ts';
import { createDefaultBuilderRoutingConfig, setBuilderOspfEverywhere } from '../src/builder/routing.ts';
import { captureBuilderTimelineSnapshot, createBuilderTimeline } from '../src/builder/timeline.ts';

const graph=cloneBuilderGraph(defaultBuilderGraph);
const addressing=createDefaultBuilderAddressing(graph);
const routing=setBuilderOspfEverywhere(graph,addressing,createDefaultBuilderRoutingConfig(),true);
const ethernet=createDefaultBuilderEthernetConfig();
const ipv6=createDefaultBuilderIpv6Config(graph,addressing,true);
const base={
  graph,addressing,routing,ipv6,
  ipv6ControlState:createBuilderIpv6ControlState(),
  ipv6LifecycleState:createBuilderIpv6LifecycleState(),
  ipv6RoutingDepth:createDefaultBuilderIpv6RoutingDepthState(graph),
  ethernet,ethernetFlow:null,
  arpCache:clearBuilderArpCache(),arpResolutions:[],
  acl:createDefaultBuilderAclConfig(),
  nat:createDefaultBuilderNatConfig(graph),natSessions:[],
  dhcp:createDefaultBuilderDhcpConfig(ethernet),dhcpLeases:[],dhcpSequence:1,
  probeHistory:[],sourceId:'client',destinationId:'app',
  layout:cloneBuilderLayout(defaultBuilderLayout),
  linkProfiles:createDefaultBuilderLinkProfiles(graph),
};

let journal=createBuilderWorkbenchEventJournal();
let timeline=createBuilderTimeline();
timeline=captureBuilderTimelineSnapshot(timeline,journal,{...base,events:journal});

const failedGraph={...graph,links:graph.links.map((link)=>link.id==='edge-r1'?{...link,failed:true}:link)};
journal=appendBuilderWorkbenchMessageEvent(journal,'TOPOLOGY CHANGED · EDGE ↔ R1 failed.',[{plane:'routed',id:'edge'},{plane:'routed',id:'r1'}]);
const action=journal.at(-1);
assert.equal(action.kind,'action');
const failedState={...base,graph:failedGraph};
const ospfSpecs=deriveBuilderCanonicalEventSpecs(base,failedState,action);
for(const required of ['OSPF · LINK DOWN','OSPF · DEAD TIMER EXPIRED','OSPF · ADJACENCY DOWN','OSPF · RIB UPDATED','OSPF · FIB UPDATED','OSPF · TRAFFIC RECOVERED']){
  assert.ok(ospfSpecs.some((entry)=>entry.summary===required),'missing canonical OSPF event '+required);
}
journal=appendBuilderWorkbenchEventBatch(journal,ospfSpecs);
const dead=journal.find((event)=>event.summary==='OSPF · DEAD TIMER EXPIRED');
assert.ok(dead);
assert.equal(dead.atMs-action.atMs,40000,'OSPF event clock must preserve the canonical 40 s dead timer');
const traffic=journal.find((event)=>event.summary==='OSPF · TRAFFIC RECOVERED');
assert.ok(traffic);
const chain=builderWorkbenchEventCausalChain(journal,traffic.id,20);
assert.equal(chain[0].id,action.id,'derived OSPF chain must lead back to the user-visible action');
assert.ok(chain.some((event)=>event.summary==='OSPF · FIB UPDATED'));
timeline=captureBuilderTimelineSnapshot(timeline,journal,{...failedState,events:journal});
assert.equal(timeline.snapshots.at(-1).eventId,journal.at(-1).id);
assert.equal(timeline.snapshots.at(-1).atMs,journal.at(-1).atMs);
assert.equal(timeline.snapshots.filter((snapshot)=>snapshot.sequence>0).length,journal.filter((event)=>event.sequence>0).length,'one capture pass must expose every canonical event');
const failed=(candidate)=>candidate.links.find((link)=>link.id==='edge-r1')?.failed===true;
const actionSnapshot=timeline.snapshots.find((snapshot)=>snapshot.eventId===action.id);
const linkDownSnapshot=timeline.snapshots.find((snapshot)=>snapshot.summary==='OSPF · LINK DOWN');
const helloSnapshot=timeline.snapshots.find((snapshot)=>snapshot.summary==='OSPF · HELLO MISSED');
const deadSnapshot=timeline.snapshots.find((snapshot)=>snapshot.summary==='OSPF · DEAD TIMER EXPIRED');
const adjacencySnapshot=timeline.snapshots.find((snapshot)=>snapshot.summary==='OSPF · ADJACENCY DOWN');
const ribSnapshot=timeline.snapshots.find((snapshot)=>snapshot.summary==='OSPF · RIB UPDATED');
const fibSnapshot=timeline.snapshots.find((snapshot)=>snapshot.summary==='OSPF · FIB UPDATED');
assert.ok(actionSnapshot&&linkDownSnapshot&&helloSnapshot&&deadSnapshot&&adjacencySnapshot&&ribSnapshot&&fibSnapshot);
assert.equal(failed(actionSnapshot.state.graph),false,'root action is inspectable before the physical transition is applied');
assert.equal(failed(linkDownSnapshot.state.graph),true,'physical link failure must project immediately at LINK DOWN');
assert.ok(linkDownSnapshot.state.truthGraphs,'timed convergence snapshots must carry independent truth graphs');
assert.equal(failed(linkDownSnapshot.state.truthGraphs.controlGraph),false,'OSPF control plane must remain stale immediately after carrier loss');
assert.equal(failed(linkDownSnapshot.state.truthGraphs.ribGraph),false,'RIB must remain stale immediately after carrier loss');
assert.equal(failed(linkDownSnapshot.state.truthGraphs.fibGraph),false,'FIB must remain stale immediately after carrier loss');
assert.equal(linkDownSnapshot.state,helloSnapshot.state,'events without a truth transition should continue sharing the same immutable scene state');
assert.equal(dead.atMs,40000+action.atMs,'dead timer remains at the canonical Lab 11M boundary');
const adjacency=journal.find((event)=>event.summary==='OSPF · ADJACENCY DOWN');
assert.ok(adjacency);
assert.equal(adjacency.atMs,dead.atMs,'dead expiry and adjacency down occur at the same model instant');
assert.ok(dead.sequence<adjacency.sequence,'same-time canonical events must preserve Lab 11M emission order instead of sorting lexically by key');
assert.equal(failed(deadSnapshot.state.truthGraphs.controlGraph),true,'DEAD TIMER EXPIRED must advance control-plane truth at the exact Lab 11M model boundary');
assert.equal(failed(deadSnapshot.state.truthGraphs.ribGraph),false,'RIB must remain stale when the dead timer expires');
assert.equal(deadSnapshot.state,adjacencySnapshot.state,'ADJACENCY DOWN occurs at the same model instant and should share the control-plane snapshot');
assert.equal(failed(adjacencySnapshot.state.truthGraphs.ribGraph),false,'RIB must still be stale after the adjacency leaves FULL');
assert.equal(failed(ribSnapshot.state.truthGraphs.ribGraph),true,'RIB UPDATED must advance route-selection truth');
assert.equal(failed(ribSnapshot.state.truthGraphs.fibGraph),false,'FIB must remain stale until its own install event');
assert.equal(failed(fibSnapshot.state.truthGraphs.fibGraph),true,'FIB UPDATED must advance forwarding truth');

const builderSource=readFileSync(new URL('../src/NetworkBuilder.tsx',import.meta.url),'utf8');
assert.match(builderSource,/sceneState\.truthGraphs\?\.controlGraph \?\? sceneGraph/);
assert.match(builderSource,/routeTableForBuilderRouter\(sceneRibGraph/);
assert.match(builderSource,/traceBuilderForwarding\(sceneGraph, sceneAddressing, sceneRouting, sceneSourceId, sceneDestinationId, sceneFibGraph\)/);

const dhcpConfig=setBuilderDhcpClient(ethernet,createDefaultBuilderDhcpConfig(ethernet),'lan-a',true);
const dhcpBefore={...base,dhcp:dhcpConfig,dhcpLeases:[],dhcpSequence:1};
const dhcpTransaction=runBuilderDhcpAcquire(ethernet,dhcpConfig,[], 'lan-a', 1);
assert.equal(dhcpTransaction.success,true,'DORA contract requires a successful deterministic acquisition');
assert.ok(dhcpTransaction.lease);
const dhcpAfter={...dhcpBefore,dhcpLeases:dhcpTransaction.leases,dhcpSequence:2};
let dhcpJournal=createBuilderWorkbenchEventJournal();
let dhcpTimeline=createBuilderTimeline();
dhcpTimeline=captureBuilderTimelineSnapshot(dhcpTimeline,dhcpJournal,{...dhcpBefore,events:dhcpJournal});
dhcpJournal=appendBuilderWorkbenchMessageEvent(dhcpJournal,'DHCP ACK · '+dhcpTransaction.summary,[{plane:'ethernet',id:'lan-a'},{plane:'ethernet',id:dhcpTransaction.lease.serverDeviceId}]);
const dhcpAction=dhcpJournal.at(-1);
const dhcpSpecs=deriveBuilderCanonicalEventSpecs(dhcpBefore,dhcpAfter,dhcpAction);
const dora=dhcpSpecs.filter((entry)=>entry.category==='dhcp'&&entry.summary.startsWith('DHCP · '));
assert.deepEqual(dora.map((entry)=>entry.summary.split(' · ')[1]),['DISCOVER','OFFER','REQUEST','ACK'],'DHCP acquisition must expose canonical DORA stage order');
assert.ok(dora.every((entry)=>entry.kind==='control-plane'),'DORA stages are DHCP control-plane transitions');
assert.equal(dora.at(-1).projection?.dhcpLeases,'after','ACK must be the lease-install boundary');
assert.equal(dora.at(-1).projection?.dhcpSequence,'after','ACK must advance the deterministic DHCP sequence state');
dhcpJournal=appendBuilderWorkbenchEventBatch(dhcpJournal,dhcpSpecs);
dhcpTimeline=captureBuilderTimelineSnapshot(dhcpTimeline,dhcpJournal,{...dhcpAfter,events:dhcpJournal});
const doraSnapshots=Object.fromEntries(['DISCOVER','OFFER','REQUEST','ACK'].map((kind)=>[kind,dhcpTimeline.snapshots.find((snapshot)=>snapshot.summary.startsWith('DHCP · '+kind+' ·'))]));
assert.ok(doraSnapshots.DISCOVER&&doraSnapshots.OFFER&&doraSnapshots.REQUEST&&doraSnapshots.ACK);
assert.equal(doraSnapshots.DISCOVER.state.dhcpLeases.length,0,'DISCOVER must not install a lease');
assert.equal(doraSnapshots.OFFER.state.dhcpLeases.length,0,'OFFER must not install a lease');
assert.equal(doraSnapshots.REQUEST.state.dhcpLeases.length,0,'REQUEST must not install a lease');
assert.equal(doraSnapshots.DISCOVER.state.dhcpSequence,1,'DORA pre-ACK stages stay on the transaction sequence');
assert.equal(doraSnapshots.REQUEST.state.dhcpSequence,1,'REQUEST still precedes lease commit');
assert.equal(doraSnapshots.ACK.state.dhcpLeases[0]?.address,dhcpTransaction.lease.address,'ACK installs the canonical lease');
assert.equal(doraSnapshots.ACK.state.dhcpSequence,2,'ACK advances the Builder DHCP sequence to the committed state');
assert.equal(doraSnapshots.DISCOVER.state,doraSnapshots.OFFER.state,'DORA stages without state mutation structurally share the same historical state');
assert.equal(doraSnapshots.OFFER.state,doraSnapshots.REQUEST.state,'REQUEST must not allocate a duplicate scene state before ACK');
assert.notEqual(doraSnapshots.REQUEST.state,doraSnapshots.ACK.state,'ACK creates the state boundary where the lease becomes visible');
const dhcpAckEvent=dhcpJournal.find((event)=>event.summary.startsWith('DHCP · ACK ·'));
assert.ok(dhcpAckEvent);
const dhcpChain=builderWorkbenchEventCausalChain(dhcpJournal,dhcpAckEvent.id,10);
assert.equal(dhcpChain[0].id,dhcpAction.id,'ACK causal chain must lead back to the user-visible DHCP action');
assert.ok(dhcpChain.some((event)=>event.summary.startsWith('DHCP · DISCOVER ·')),'ACK causal chain must retain DISCOVER provenance');

// DHCP release must be a protocol-native state boundary, not a generic lease disappearance.
const releaseBefore=dhcpAfter;
const releaseResult=releaseBuilderDhcpLease(releaseBefore.dhcpLeases,'lan-a',releaseBefore.dhcpSequence);
const releaseAfter={...releaseBefore,dhcpLeases:releaseResult.leases,dhcpSequence:releaseBefore.dhcpSequence+1};
let releaseJournal=createBuilderWorkbenchEventJournal();
let releaseTimeline=createBuilderTimeline();
releaseTimeline=captureBuilderTimelineSnapshot(releaseTimeline,releaseJournal,{...releaseBefore,events:releaseJournal});
releaseJournal=appendBuilderWorkbenchMessageEvent(releaseJournal,'DHCP RELEASE · '+releaseResult.event.detail,[{plane:'ethernet',id:'lan-a'},{plane:'ethernet',id:dhcpTransaction.lease.serverDeviceId}]);
const releaseAction=releaseJournal.at(-1);
const releaseSpecs=deriveBuilderCanonicalEventSpecs(releaseBefore,releaseAfter,releaseAction);
assert.equal(releaseSpecs.filter((entry)=>entry.summary.startsWith('DHCP · RELEASE · ')).length,1,'release must emit one protocol-native RELEASE event');
const releaseSpec=releaseSpecs.find((entry)=>entry.summary.startsWith('DHCP · RELEASE · '));
assert.deepEqual(releaseSpec.projection?.dhcpRemoveLeaseIds,[dhcpTransaction.lease.id],'RELEASE removes only the released lease at its own event boundary');
releaseJournal=appendBuilderWorkbenchEventBatch(releaseJournal,releaseSpecs);
releaseTimeline=captureBuilderTimelineSnapshot(releaseTimeline,releaseJournal,{...releaseAfter,events:releaseJournal});
const releaseActionSnapshot=releaseTimeline.snapshots.find((snapshot)=>snapshot.eventId===releaseAction.id);
const releasedSnapshot=releaseTimeline.snapshots.find((snapshot)=>snapshot.summary.startsWith('DHCP · RELEASE · '));
assert.ok(releaseActionSnapshot&&releasedSnapshot);
assert.equal(releaseActionSnapshot.state.dhcpLeases.length,1,'root release action remains inspectable before protocol state mutation');
assert.equal(releasedSnapshot.state.dhcpLeases.length,0,'RELEASE event removes the lease');
assert.equal(releasedSnapshot.state.dhcpSequence,3,'RELEASE advances deterministic DHCP sequence');
assert.equal(applyBuilderDhcpState(ethernet,dhcpConfig,releasedSnapshot.state.dhcpLeases,releasedSnapshot.state.dhcpSequence).devices.find((device)=>device.id==='lan-a')?.interfaces[0]?.address,'0.0.0.0','effective host IPv4 disappears at RELEASE');

// A clock jump must expose T1, T2, and expiry at their own sequence boundaries.
const defaultPool=dhcpConfig.pools.find((pool)=>pool.vlanId===ethernet.devices.find((device)=>device.id==='lan-a')?.interfaces[0]?.vlanId);
assert.ok(defaultPool);
const shortDhcpConfig=upsertBuilderDhcpPool(ethernet,dhcpConfig,{...defaultPool,leaseSteps:4});
const shortTransaction=runBuilderDhcpAcquire(ethernet,shortDhcpConfig,[],'lan-a',1);
assert.ok(shortTransaction.success&&shortTransaction.lease);
const clockBefore={...dhcpBefore,dhcp:shortDhcpConfig,dhcpLeases:shortTransaction.leases,dhcpSequence:2};
const clockAfter={...clockBefore,dhcpLeases:pruneBuilderDhcpLeases(clockBefore.dhcpLeases,10),dhcpSequence:10};
let clockJournal=createBuilderWorkbenchEventJournal();
let clockTimeline=createBuilderTimeline();
clockTimeline=captureBuilderTimelineSnapshot(clockTimeline,clockJournal,{...clockBefore,events:clockJournal});
clockJournal=appendBuilderWorkbenchMessageEvent(clockJournal,'DHCP CLOCK · advanced to sequence 10. Lease expiration is evaluated from deterministic sequence time.',[{plane:'ethernet',id:'lan-a'}]);
const clockAction=clockJournal.at(-1);
const clockSpecs=deriveBuilderCanonicalEventSpecs(clockBefore,clockAfter,clockAction);
for(const prefix of ['DHCP · T1 REACHED · ','DHCP · T2 REACHED · ','DHCP · EXPIRE · ','DHCP · CLOCK · SEQ 10'])assert.ok(clockSpecs.some((entry)=>entry.summary.startsWith(prefix)),'missing DHCP lifecycle event '+prefix);
clockJournal=appendBuilderWorkbenchEventBatch(clockJournal,clockSpecs);
clockTimeline=captureBuilderTimelineSnapshot(clockTimeline,clockJournal,{...clockAfter,events:clockJournal});
const t1Snapshot=clockTimeline.snapshots.find((snapshot)=>snapshot.summary.startsWith('DHCP · T1 REACHED · '));
const t2Snapshot=clockTimeline.snapshots.find((snapshot)=>snapshot.summary.startsWith('DHCP · T2 REACHED · '));
const expireSnapshot=clockTimeline.snapshots.find((snapshot)=>snapshot.summary.startsWith('DHCP · EXPIRE · '));
const clockFinalSnapshot=clockTimeline.snapshots.find((snapshot)=>snapshot.summary==='DHCP · CLOCK · SEQ 10');
assert.ok(t1Snapshot&&t2Snapshot&&expireSnapshot&&clockFinalSnapshot);
assert.equal(t1Snapshot.state.dhcpSequence,shortTransaction.lease.renewAtSequence,'T1 snapshot uses the exact DHCP model sequence');
assert.equal(t1Snapshot.state.dhcpLeases.length,1,'T1 does not remove the active lease');
assert.equal(t2Snapshot.state.dhcpSequence,shortTransaction.lease.rebindAtSequence,'T2 snapshot uses the exact DHCP model sequence');
assert.equal(t2Snapshot.state.dhcpLeases.length,1,'T2 does not remove the active lease');
assert.equal(expireSnapshot.state.dhcpSequence,shortTransaction.lease.expiresAtSequence+1,'expiry becomes effective on the first sequence after the inclusive lease-valid boundary');
assert.equal(expireSnapshot.state.dhcpLeases.length,0,'EXPIRE removes the lease exactly at the expiry transition');
assert.equal(applyBuilderDhcpState(ethernet,shortDhcpConfig,expireSnapshot.state.dhcpLeases,expireSnapshot.state.dhcpSequence).devices.find((device)=>device.id==='lan-a')?.interfaces[0]?.address,'0.0.0.0','expired historical state returns host IPv4 to unconfigured');
assert.equal(clockFinalSnapshot.state.dhcpSequence,10,'clock timeline reaches the user-requested final deterministic sequence');
assert.equal(clockFinalSnapshot.state.dhcpLeases.length,0,'final clock state preserves pruned lease truth');

// Failed renewal replays the canonical model and exposes TIMEOUT instead of collapsing to generic failure.
const renewSequence=dhcpTransaction.lease.renewAtSequence;
const renewPathLink=dhcpTransaction.events.find((event)=>event.kind==='REQUEST')?.linkIds[0]??dhcpTransaction.events[0]?.linkIds[0];
assert.ok(renewPathLink);
const brokenEthernet={...ethernet,links:ethernet.links.map((link)=>link.id===renewPathLink?{...link,failed:true}:link)};
const timeoutResult=renewBuilderDhcpLease(brokenEthernet,dhcpConfig,dhcpTransaction.leases,'lan-a',renewSequence);
assert.equal(timeoutResult.success,false,'fixture must produce a deterministic renewal timeout');
assert.equal(timeoutResult.events.at(-1)?.kind,'TIMEOUT');
const timeoutBefore={...dhcpAfter,ethernet:brokenEthernet,dhcpSequence:renewSequence,dhcpLeases:dhcpTransaction.leases};
const timeoutAfter={...timeoutBefore,dhcpSequence:renewSequence+1,dhcpLeases:timeoutResult.leases};
const timeoutAction=appendBuilderWorkbenchMessageEvent(createBuilderWorkbenchEventJournal(),'DHCP TIMEOUT · '+timeoutResult.summary,[{plane:'ethernet',id:'lan-a'},{plane:'ethernet',id:dhcpTransaction.lease.serverDeviceId}]).at(-1);
const timeoutSpecs=deriveBuilderCanonicalEventSpecs(timeoutBefore,timeoutAfter,timeoutAction);
const timeoutSpec=timeoutSpecs.find((entry)=>entry.summary.startsWith('DHCP · TIMEOUT · '));
assert.ok(timeoutSpec,'failed renewal must expose the model TIMEOUT event');
assert.equal(timeoutSpec.projection?.dhcpSequence,'after','TIMEOUT commits the attempted transaction sequence without fabricating lease removal');
assert.equal(timeoutSpec.projection?.dhcpLeases,undefined,'renew timeout keeps the still-valid lease structurally shared');

const dhcpPanelSource=readFileSync(new URL('../src/BuilderDhcpPanel.tsx',import.meta.url),'utf8');
assert.match(dhcpPanelSource,/HISTORICAL DHCP STAGE/,'DHCP panel must render the selected historical stage instead of leaking live transaction UI');
assert.ok(dhcpPanelSource.includes('pruneBuilderDhcpLeases(leases,next)'),'advancing the live DHCP clock must prune expired leases immediately instead of leaving stale panel state');

const probe=runBuilderProbe(graph,addressing,routing,'ping','client','app',1,base.linkProfiles,base.acl,base.nat,[]);
const probeAction=appendBuilderWorkbenchMessageEvent(createBuilderWorkbenchEventJournal(),'PING · '+probe.summary,[{plane:'routed',id:'client'},{plane:'routed',id:'app'}]).at(-1);
const probeSpecs=deriveBuilderCanonicalEventSpecs(base,{...base,probeHistory:[probe],natSessions:probe.natSessions},probeAction);
assert.ok(probeSpecs.some((entry)=>entry.kind==='forwarding'&&entry.category==='probe'),'probe must emit canonical forwarding decisions');
assert.ok(probeSpecs.some((entry)=>entry.kind==='flow'&&entry.category==='probe'),'probe must emit canonical flow outcomes');
if(probe.natApplied)assert.ok(probeSpecs.some((entry)=>entry.kind==='translation'),'NAT-aware probe must emit translation truth');

const arp=resolveBuilderEthernetFlowArp(ethernet,'lan-a','lan-b',[]);
assert.equal(arp.success,true);
const lanFlow=runBuilderEthernetFlow(ethernet,'lan-a','lan-b');
const lanAction=appendBuilderWorkbenchMessageEvent(createBuilderWorkbenchEventJournal(),'LAN FABRIC · '+lanFlow.summary,[{plane:'ethernet',id:'lan-a'},{plane:'ethernet',id:'lan-b'}]).at(-1);
const lanSpecs=deriveBuilderCanonicalEventSpecs(base,{...base,arpCache:arp.cache,arpResolutions:arp.resolutions,ethernetFlow:lanFlow},lanAction);
assert.ok(lanSpecs.some((entry)=>entry.kind==='resolution'&&entry.category==='neighbor'),'ARP must emit resolution truth');
assert.ok(lanSpecs.some((entry)=>entry.kind==='forwarding'&&entry.category==='switching'),'LAN flow must emit L2 forwarding truth');
assert.ok(lanSpecs.some((entry)=>entry.kind==='flow'&&entry.category==='switching'),'LAN flow must emit terminal outcome truth');

console.log('Builder canonical-event contract passed: timed OSPF truth dimensions plus DHCP acquisition, renewal failure, release, T1/T2, expiry, and clock projection preserve canonical causality and intermediate state.');
