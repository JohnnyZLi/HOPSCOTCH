import assert from 'node:assert/strict';
import { createDefaultBuilderAddressing } from '../src/builder/addressing.ts';
import { createDefaultBuilderAclConfig } from '../src/builder/acl.ts';
import { createDefaultBuilderBgpConfig, setBuilderBgpRouterAsn, updateBuilderBgpSession, upsertBuilderBgpOrigin, upsertBuilderBgpSession } from '../src/builder/bgp.ts';
import { createDefaultBuilderDhcpConfig, runBuilderDhcpAcquire, setBuilderDhcpClient } from '../src/builder/dhcp.ts';
import { appendBuilderWorkbenchMessageEvent, buildBuilderDeviceWorkbench, builderWorkbenchDeviceOptions, builderWorkbenchEventCausalChain, createBuilderWorkbenchEventJournal } from '../src/builder/device-workbench.ts';
import { createDefaultBuilderEthernetConfig, runBuilderEthernetFlow } from '../src/builder/ethernet.ts';
import { resolveBuilderEthernetFlowArp } from '../src/builder/arp.ts';
import { createDefaultBuilderIpv6Config } from '../src/builder/ipv6.ts';
import { createBuilderIpv6ControlState } from '../src/builder/ipv6-control-plane.ts';
import { createDefaultBuilderIpv6RoutingDepthState } from '../src/builder/ipv6-routing-depth.ts';
import { createDefaultBuilderLinkProfiles } from '../src/builder/link-characteristics.ts';
import { cloneBuilderGraph, defaultBuilderGraph, defaultBuilderLayout } from '../src/builder/model.ts';
import { createDefaultBuilderNatConfig } from '../src/builder/nat.ts';
import { runBuilderProbe } from '../src/builder/probes.ts';
import { createDefaultBuilderRoutingConfig, setBuilderOspfEverywhere } from '../src/builder/routing.ts';
import { createBuilderScenario, serializeBuilderScenario } from '../src/builder/scenario.ts';

const graph=cloneBuilderGraph(defaultBuilderGraph);
const addressing=createDefaultBuilderAddressing(graph);
let routing=setBuilderOspfEverywhere(graph,addressing,createDefaultBuilderRoutingConfig(),true);
let bgp=createDefaultBuilderBgpConfig();
bgp=setBuilderBgpRouterAsn(graph,bgp,'edge',64496);bgp=setBuilderBgpRouterAsn(graph,bgp,'r1',64500);bgp=setBuilderBgpRouterAsn(graph,bgp,'r2',64500);bgp=setBuilderBgpRouterAsn(graph,bgp,'core',65538);
bgp=upsertBuilderBgpSession(graph,bgp,'edge-r1','customer-provider');let edgeR1=bgp.sessions.find((entry)=>entry.linkId==='edge-r1');assert.ok(edgeR1);bgp=updateBuilderBgpSession(graph,bgp,edgeR1.id,{relationship:'customer-provider',customerRouterId:'edge'});
bgp=upsertBuilderBgpSession(graph,bgp,'r1-r2','peer');const r1r2=bgp.sessions.find((entry)=>entry.linkId==='r1-r2');assert.ok(r1r2);bgp=updateBuilderBgpSession(graph,bgp,r1r2.id,{nextHopSelf:true});
bgp=upsertBuilderBgpSession(graph,bgp,'r2-core','customer-provider');let r2core=bgp.sessions.find((entry)=>entry.linkId==='r2-core');assert.ok(r2core);bgp=updateBuilderBgpSession(graph,bgp,r2core.id,{relationship:'customer-provider',customerRouterId:'r2'});
const appPrefix=addressing.segments['core-app'].cidr;bgp=upsertBuilderBgpOrigin(graph,bgp,{routerId:'core',prefix:appPrefix,med:10,communities:['65538:110'],description:'Workbench app origin'});
routing={...routing,bgp};

const ethernet=createDefaultBuilderEthernetConfig();
const arp=resolveBuilderEthernetFlowArp(ethernet,'lan-a','lan-b',[]);assert.equal(arp.success,true);
const ethernetFlow=runBuilderEthernetFlow(ethernet,'lan-a','lan-b');assert.equal(ethernetFlow.success,true);assert.ok(ethernetFlow.fdb.length>0);
let dhcp=createDefaultBuilderDhcpConfig(ethernet);dhcp=setBuilderDhcpClient(ethernet,dhcp,'lan-a',true);
const dhcpTx=runBuilderDhcpAcquire(ethernet,dhcp,[], 'lan-a',1);assert.equal(dhcpTx.success,true);assert.ok(dhcpTx.lease);

const acl=createDefaultBuilderAclConfig();
const nat=createDefaultBuilderNatConfig(graph);
const linkProfiles=createDefaultBuilderLinkProfiles(graph);
const probe=runBuilderProbe(graph,addressing,routing,'ping','client','app',1,linkProfiles,acl,nat,[]);
const ipv6=createDefaultBuilderIpv6Config(graph,addressing,true);
const ipv6ControlState=createBuilderIpv6ControlState();
const ipv6RoutingDepth=createDefaultBuilderIpv6RoutingDepthState(graph);
let events=createBuilderWorkbenchEventJournal();
events=appendBuilderWorkbenchMessageEvent(events,'TOPOLOGY CHANGED · OSPF recomputes from active links.',[{plane:'routed',id:'edge'}]);
events=appendBuilderWorkbenchMessageEvent(events,'PING · canonical forwarding and policy produced a probe snapshot.',[{plane:'routed',id:'edge'}]);
events=appendBuilderWorkbenchMessageEvent(events,'LAN FABRIC · ARP RESOLVED · frame delivered.',[{plane:'ethernet',id:'lan-sw1'},{plane:'ethernet',id:'lan-a'}]);
events=appendBuilderWorkbenchMessageEvent(events,'DHCP ACK · PC-A leased a runtime IPv4 address.',[{plane:'ethernet',id:'lan-a'}]);

const input={graph,addressing,routing,ipv6,ipv6ControlState,ipv6RoutingDepth,ethernet,ethernetFlow,arpCache:arp.cache,arpResolutions:arp.resolutions,acl,nat,natSessions:probe.natSessions,dhcp,dhcpLeases:dhcpTx.leases,dhcpSequence:2,probeHistory:[probe],sourceId:'client',destinationId:'app',events};
const options=builderWorkbenchDeviceOptions(graph,ethernet);assert.ok(options.some((entry)=>entry.plane==='routed'&&entry.id==='edge'));assert.ok(options.some((entry)=>entry.plane==='ethernet'&&entry.id==='lan-sw1'));

const edge=buildBuilderDeviceWorkbench(input,{plane:'routed',id:'edge'});
assert.equal(edge.device.id,'edge');assert.ok(edge.configSections.some((section)=>section.id==='interfaces'&&section.rows.length>0));
const edgeRoutes=edge.stateSections.find((section)=>section.id==='rib-fib')?.rows??[];assert.ok(edgeRoutes.length>0);assert.ok(edgeRoutes.every((entry)=>entry.why.length>=2),'every routed RIB/FIB object needs a structured why chain');
const dynamic=edge.stateSections.find((section)=>section.id==='control-state')?.rows??[];assert.ok(dynamic.some((entry)=>entry.label==='OSPF NEIGHBOR'));assert.ok(dynamic.some((entry)=>entry.label==='BGP BEST'),'Builder BGP BEST state should project into the selected device workbench');
assert.ok(edge.stateSections.flatMap((section)=>section.rows).some((entry)=>entry.label==='CURRENT ICMP POLICY'));
assert.ok(edge.events.some((event)=>event.category==='probe'));const probeEvent=edge.events.find((event)=>event.category==='probe');assert.ok(probeEvent?.causeChain.length>=2,'runtime event should retain its upstream causal event');

const sw=buildBuilderDeviceWorkbench(input,{plane:'ethernet',id:'lan-sw1'});assert.ok(sw.configSections.find((section)=>section.id==='lan-ports')?.rows.length);const fdbRows=sw.stateSections.find((section)=>section.id==='lan-switch-state')?.rows.filter((entry)=>entry.label==='FDB')??[];assert.ok(fdbRows.length>0);assert.ok(fdbRows.every((entry)=>entry.why.some((step)=>step.label==='SOURCE MAC LEARNING')));
const pc=buildBuilderDeviceWorkbench(input,{plane:'ethernet',id:'lan-a'});assert.ok(pc.stateSections.flatMap((section)=>section.rows).some((entry)=>entry.label==='DHCP LEASE'));assert.ok(pc.stateSections.flatMap((section)=>section.rows).some((entry)=>entry.label==='EFFECTIVE IPV4'&&entry.value===dhcpTx.lease.address));assert.ok(pc.stateSections.flatMap((section)=>section.rows).some((entry)=>entry.label==='ARP'));

const chain=builderWorkbenchEventCausalChain(events,events.find((event)=>event.category==='probe').id);assert.ok(chain.length>=2);assert.equal(chain.at(-1).category,'probe');
const scenario=createBuilderScenario('11P persistence boundary',graph,'client','app',defaultBuilderLayout,addressing,routing,undefined,ethernet,linkProfiles,acl,nat,dhcp,ipv6);
const serialized=serializeBuilderScenario(scenario);assert.match(serialized,/\"dhcp\"/);assert.doesNotMatch(serialized,/dhcpLeases|workbenchEvents|arpCache|natSessions|probeHistory/,'session STATE/EVENTS must not leak into scenario persistence');

console.log('Builder device workbench contract passed: CONFIG/STATE separation, routed RIB/FIB + OSPF/BGP/policy, Ethernet FDB/STP/ARP/DHCP, deterministic WHY chains, causal events, and config-only persistence.');
