import assert from 'node:assert/strict';
import { createDefaultBuilderAddressing } from '../src/builder/addressing.ts';
import { createDefaultBuilderAclConfig } from '../src/builder/acl.ts';
import { clearBuilderArpCache, resolveBuilderEthernetFlowArp } from '../src/builder/arp.ts';
import { deriveBuilderCanonicalEventSpecs } from '../src/builder/canonical-events.ts';
import { createDefaultBuilderDhcpConfig } from '../src/builder/dhcp.ts';
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
const stateRefs=new Set(timeline.snapshots.slice(1).map((snapshot)=>snapshot.state));
assert.equal(stateRefs.size,1,'events captured from one committed Builder action should share one immutable state snapshot');

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

console.log('Builder canonical-event contract passed: action events expand from canonical model deltas into deterministic physical/control-plane/RIB/FIB/resolution/forwarding/translation/flow events, preserve model timing, causal links, and bounded shared-state timeline capture.');
