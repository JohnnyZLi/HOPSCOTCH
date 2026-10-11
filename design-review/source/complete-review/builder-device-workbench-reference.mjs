import { createDefaultBuilderAddressing } from '/workspace/scratch/8f1a24ac8c73/hopscotch/src/builder/addressing.ts';
import { createDefaultBuilderAclConfig } from '/workspace/scratch/8f1a24ac8c73/hopscotch/src/builder/acl.ts';
import { createDefaultBuilderBgpConfig, setBuilderBgpRouterAsn, updateBuilderBgpSession, upsertBuilderBgpOrigin, upsertBuilderBgpSession } from '/workspace/scratch/8f1a24ac8c73/hopscotch/src/builder/bgp.ts';
import { createDefaultBuilderDhcpConfig, runBuilderDhcpAcquire, setBuilderDhcpClient } from '/workspace/scratch/8f1a24ac8c73/hopscotch/src/builder/dhcp.ts';
import { appendBuilderWorkbenchMessageEvent, buildBuilderDeviceWorkbench, builderWorkbenchDeviceOptions, builderWorkbenchEventCausalChain, createBuilderWorkbenchEventJournal } from '/workspace/scratch/8f1a24ac8c73/hopscotch/src/builder/device-workbench.ts';
import { createDefaultBuilderEthernetConfig, runBuilderEthernetFlow } from '/workspace/scratch/8f1a24ac8c73/hopscotch/src/builder/ethernet.ts';
import { resolveBuilderEthernetFlowArp } from '/workspace/scratch/8f1a24ac8c73/hopscotch/src/builder/arp.ts';
import { createDefaultBuilderIpv6Config } from '/workspace/scratch/8f1a24ac8c73/hopscotch/src/builder/ipv6.ts';
import { createBuilderIpv6ControlState } from '/workspace/scratch/8f1a24ac8c73/hopscotch/src/builder/ipv6-control-plane.ts';
import { createDefaultBuilderIpv6RoutingDepthState } from '/workspace/scratch/8f1a24ac8c73/hopscotch/src/builder/ipv6-routing-depth.ts';
import { createDefaultBuilderLinkProfiles } from '/workspace/scratch/8f1a24ac8c73/hopscotch/src/builder/link-characteristics.ts';
import { cloneBuilderGraph, defaultBuilderGraph, defaultBuilderLayout } from '/workspace/scratch/8f1a24ac8c73/hopscotch/src/builder/model.ts';
import { createDefaultBuilderNatConfig } from '/workspace/scratch/8f1a24ac8c73/hopscotch/src/builder/nat.ts';
import { runBuilderProbe } from '/workspace/scratch/8f1a24ac8c73/hopscotch/src/builder/probes.ts';
import { createDefaultBuilderRoutingConfig, setBuilderOspfEverywhere } from '/workspace/scratch/8f1a24ac8c73/hopscotch/src/builder/routing.ts';
import { createBuilderScenario, serializeBuilderScenario } from '/workspace/scratch/8f1a24ac8c73/hopscotch/src/builder/scenario.ts';

const graph=cloneBuilderGraph(defaultBuilderGraph);
const addressing=createDefaultBuilderAddressing(graph);
let routing=setBuilderOspfEverywhere(graph,addressing,createDefaultBuilderRoutingConfig(),true);
let bgp=createDefaultBuilderBgpConfig();
bgp=setBuilderBgpRouterAsn(graph,bgp,'edge',64496);bgp=setBuilderBgpRouterAsn(graph,bgp,'r1',64500);bgp=setBuilderBgpRouterAsn(graph,bgp,'r2',64500);bgp=setBuilderBgpRouterAsn(graph,bgp,'core',65538);
bgp=upsertBuilderBgpSession(graph,bgp,'edge-r1','customer-provider');let edgeR1=bgp.sessions.find((entry)=>entry.linkId==='edge-r1');bgp=updateBuilderBgpSession(graph,bgp,edgeR1.id,{relationship:'customer-provider',customerRouterId:'edge'});
bgp=upsertBuilderBgpSession(graph,bgp,'r1-r2','peer');const r1r2=bgp.sessions.find((entry)=>entry.linkId==='r1-r2');bgp=updateBuilderBgpSession(graph,bgp,r1r2.id,{nextHopSelf:true});
bgp=upsertBuilderBgpSession(graph,bgp,'r2-core','customer-provider');let r2core=bgp.sessions.find((entry)=>entry.linkId==='r2-core');bgp=updateBuilderBgpSession(graph,bgp,r2core.id,{relationship:'customer-provider',customerRouterId:'r2'});
const appPrefix=addressing.segments['core-app'].cidr;bgp=upsertBuilderBgpOrigin(graph,bgp,{routerId:'core',prefix:appPrefix,med:10,communities:['65538:110'],description:'Workbench app origin'});
routing={...routing,bgp};

const ethernet=createDefaultBuilderEthernetConfig();
const arp=resolveBuilderEthernetFlowArp(ethernet,'lan-a','lan-b',[]);
const ethernetFlow=runBuilderEthernetFlow(ethernet,'lan-a','lan-b');
let dhcp=createDefaultBuilderDhcpConfig(ethernet);dhcp=setBuilderDhcpClient(ethernet,dhcp,'lan-a',true);
const dhcpTx=runBuilderDhcpAcquire(ethernet,dhcp,[], 'lan-a',1);

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


import { projectBuilderCliState, projectBuilderCliCommand } from '/workspace/scratch/8f1a24ac8c73/hopscotch/src/builder/cli.ts';
import { createDefaultBuilderHostedServices } from '/workspace/scratch/8f1a24ac8c73/hopscotch/src/builder/application.ts';
import { createBuilderIpv6LifecycleState } from '/workspace/scratch/8f1a24ac8c73/hopscotch/src/builder/ipv6-lifecycle.ts';
const options=builderWorkbenchDeviceOptions(graph,ethernet);
const devices=options.map(ref=>buildBuilderDeviceWorkbench(input,ref));
const cliState=projectBuilderCliState({graph,addressing,routing,ethernet,arpCache:arp.cache,ethernetFlow});
const commands=['show interfaces','show route','show arp','show mac'];
export default {input,options,devices,layout:defaultBuilderLayout,services:createDefaultBuilderHostedServices(graph),lifecycle:createBuilderIpv6LifecycleState(),cli:commands.map(command=>({command,output:projectBuilderCliCommand(command,cliState)}))};

