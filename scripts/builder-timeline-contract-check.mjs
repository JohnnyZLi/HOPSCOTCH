import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDefaultBuilderAddressing } from '../src/builder/addressing.ts';
import { createDefaultBuilderAclConfig } from '../src/builder/acl.ts';
import { clearBuilderArpCache, resolveBuilderEthernetFlowArp } from '../src/builder/arp.ts';
import { createDefaultBuilderDhcpConfig } from '../src/builder/dhcp.ts';
import { appendBuilderWorkbenchMessageEvent, buildBuilderDeviceWorkbench, createBuilderWorkbenchEventJournal } from '../src/builder/device-workbench.ts';
import { createDefaultBuilderEthernetConfig } from '../src/builder/ethernet.ts';
import { createBuilderIpv6ControlState } from '../src/builder/ipv6-control-plane.ts';
import { createBuilderIpv6LifecycleState } from '../src/builder/ipv6-lifecycle.ts';
import { createDefaultBuilderIpv6RoutingDepthState } from '../src/builder/ipv6-routing-depth.ts';
import { createDefaultBuilderIpv6Config } from '../src/builder/ipv6.ts';
import { createDefaultBuilderLinkProfiles } from '../src/builder/link-characteristics.ts';
import { cloneBuilderGraph, cloneBuilderLayout, defaultBuilderGraph, defaultBuilderLayout } from '../src/builder/model.ts';
import { createDefaultBuilderNatConfig } from '../src/builder/nat.ts';
import { createDefaultBuilderRoutingConfig, setBuilderOspfEverywhere } from '../src/builder/routing.ts';
import { builderTimelineJournalThroughSequence, builderTimelineSnapshotAtSequence, builderTimelineWorkbenchAtSequence, captureBuilderTimelineSnapshot, createBuilderTimeline, diffBuilderTimelineDevice } from '../src/builder/timeline.ts';

const graph=cloneBuilderGraph(defaultBuilderGraph);
const addressing=createDefaultBuilderAddressing(graph);
const routing=setBuilderOspfEverywhere(graph,addressing,createDefaultBuilderRoutingConfig(),true);
const ethernet=createDefaultBuilderEthernetConfig();
const ipv6=createDefaultBuilderIpv6Config(graph,addressing,true);
const base={graph,addressing,routing,ipv6,ipv6ControlState:createBuilderIpv6ControlState(),ipv6LifecycleState:createBuilderIpv6LifecycleState(),ipv6RoutingDepth:createDefaultBuilderIpv6RoutingDepthState(graph),ethernet,ethernetFlow:null,arpCache:clearBuilderArpCache(),arpResolutions:[],acl:createDefaultBuilderAclConfig(),nat:createDefaultBuilderNatConfig(graph),natSessions:[],dhcp:createDefaultBuilderDhcpConfig(ethernet),dhcpLeases:[],dhcpSequence:1,probeHistory:[],sourceId:'client',destinationId:'app',layout:cloneBuilderLayout(defaultBuilderLayout),linkProfiles:createDefaultBuilderLinkProfiles(graph)};
let journal=createBuilderWorkbenchEventJournal();
let timeline=createBuilderTimeline();
timeline=captureBuilderTimelineSnapshot(timeline,journal,{...base,events:journal});
assert.equal(timeline.snapshots.length,1);assert.equal(timeline.snapshots[0].sequence,0);assert.equal(timeline.snapshots[0].atMs,0);

const failedGraph={...graph,links:graph.links.map((link)=>link.id==='edge-r1'?{...link,failed:true}:link)};
journal=appendBuilderWorkbenchMessageEvent(journal,'TOPOLOGY CHANGED · EDGE ↔ R1 failed; OSPF recomputes from active adjacencies.',[{plane:'routed',id:'edge'},{plane:'routed',id:'r1'}]);
const failedLayout={...base.layout,edge:{x:base.layout.edge.x+3,y:base.layout.edge.y+2}};
const failedProfiles={...base.linkProfiles,'edge-r1':{...base.linkProfiles['edge-r1'],latencyMs:base.linkProfiles['edge-r1'].latencyMs+7}};
const failed={...base,graph:failedGraph,layout:failedLayout,linkProfiles:failedProfiles};
timeline=captureBuilderTimelineSnapshot(timeline,journal,{...failed,events:journal});
assert.equal(timeline.snapshots.length,2);assert.equal(timeline.snapshots[1].atMs,1000);assert.equal(timeline.snapshots[0].state.graph.links.find((link)=>link.id==='edge-r1').failed,false,'captured state must be immutable after later changes');assert.equal(timeline.snapshots[1].state.graph.links.find((link)=>link.id==='edge-r1').failed,true);assert.notEqual(timeline.snapshots[0].state.layout.edge.x,timeline.snapshots[1].state.layout.edge.x,'historical layout must restore deleted/moved device placement');assert.notEqual(timeline.snapshots[0].state.linkProfiles['edge-r1'].latencyMs,timeline.snapshots[1].state.linkProfiles['edge-r1'].latencyMs,'historical link characteristics must stay snapshot-local');

const arp=resolveBuilderEthernetFlowArp(ethernet,'lan-a','lan-b',[]);assert.equal(arp.success,true);
journal=appendBuilderWorkbenchMessageEvent(journal,'ARP RESOLVED · PC-A learned the next-hop mapping.',[{plane:'ethernet',id:'lan-a'}]);
timeline=captureBuilderTimelineSnapshot(timeline,journal,{...failed,arpCache:arp.cache,arpResolutions:arp.resolutions,events:journal});
assert.equal(timeline.snapshots.length,3);assert.equal(timeline.snapshots[2].atMs,2000);
assert.equal(builderTimelineSnapshotAtSequence(timeline,1)?.sequence,1);assert.equal(builderTimelineJournalThroughSequence(journal,1).at(-1)?.sequence,1);

const edgePast=builderTimelineWorkbenchAtSequence(timeline,journal,0,{plane:'routed',id:'edge'});const edgeFailed=builderTimelineWorkbenchAtSequence(timeline,journal,1,{plane:'routed',id:'edge'});assert.ok(edgePast&&edgeFailed);assert.equal(edgePast.events.some((event)=>event.sequence===2),false,'future events must not leak into historical workbench state');assert.equal(edgeFailed.events.some((event)=>event.sequence===1),true);
const diff=diffBuilderTimelineDevice(timeline,journal,1,{plane:'routed',id:'edge'});assert.ok(diff);assert.equal(diff.previousSequence,0);assert.ok(diff.entries.length>0,'link failure must produce a deterministic device-state/config projection diff');
const lanPast=buildBuilderDeviceWorkbench({...timeline.snapshots[1].state,events:builderTimelineJournalThroughSequence(journal,1)},{plane:'ethernet',id:'lan-a'});const lanNow=buildBuilderDeviceWorkbench({...timeline.snapshots[2].state,events:builderTimelineJournalThroughSequence(journal,2)},{plane:'ethernet',id:'lan-a'});assert.equal(lanPast.stateSections.flatMap((section)=>section.rows).some((row)=>row.label==='ARP'),false);assert.equal(lanNow.stateSections.flatMap((section)=>section.rows).some((row)=>row.label==='ARP'),true);
const lanDiff=diffBuilderTimelineDevice(timeline,journal,2,{plane:'ethernet',id:'lan-a'});assert.ok(lanDiff?.entries.some((entry)=>entry.truth==='STATE'&&entry.label==='ARP'&&entry.change==='added'));

const builderSource=readFileSync(new URL('../src/NetworkBuilder.tsx',import.meta.url),'utf8');assert.match(builderSource,/const sceneState = historicalTimelineSnapshot\?\.state \?\? liveTimelineInput/);assert.match(builderSource,/const renderWorkspace = \(\{ graph, addressing, routing/);assert.match(builderSource,/disabled=\{isHistorical\}/);assert.match(builderSource,/drag=\{!isHistorical\}/);assert.match(builderSource,/return renderWorkspace\(sceneRenderState\)/);
console.log('Builder timeline contract passed: immutable event snapshots, deterministic logical time, synchronized historical scene projection, read-only authoring lock, historical workbench isolation, and per-device before/after diffs.');
