import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDefaultBuilderAddressing } from '../src/builder/addressing.ts';
import { createDefaultBuilderAclConfig } from '../src/builder/acl.ts';
import { clearBuilderArpCache, resolveBuilderEthernetFlowArp } from '../src/builder/arp.ts';
import { deriveBuilderCanonicalEventSpecs } from '../src/builder/canonical-events.ts';
import { createDefaultBuilderDhcpConfig, runBuilderDhcpAcquire, setBuilderDhcpClient } from '../src/builder/dhcp.ts';
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

const dhcpPanelSource=readFileSync(new URL('../src/BuilderDhcpPanel.tsx',import.meta.url),'utf8');
assert.match(dhcpPanelSource,/HISTORICAL DHCP STAGE/,'DHCP panel must render the selected historical stage instead of leaking live transaction UI');

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

console.log('Builder canonical-event contract passed: timed OSPF truth dimensions and protocol-native DHCP DORA stages preserve canonical order, causality, intermediate state, and bounded structural sharing.');
