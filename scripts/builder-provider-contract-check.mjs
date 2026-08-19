import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDefaultBuilderAddressing, interfacesForBuilderNode } from '../src/builder/addressing.ts';
import { createDefaultBuilderAclConfig } from '../src/builder/acl.ts';
import { setBuilderBgpRouterAsn, setBuilderBgpRouterEnabled, upsertBuilderBgpSession } from '../src/builder/bgp.ts';
import { createDefaultBuilderDhcpConfig } from '../src/builder/dhcp.ts';
import { createDefaultBuilderEthernetConfig } from '../src/builder/ethernet.ts';
import { createDefaultBuilderIpv6Config } from '../src/builder/ipv6.ts';
import { createDefaultBuilderLinkProfiles } from '../src/builder/link-characteristics.ts';
import { createDefaultBuilderNatConfig } from '../src/builder/nat.ts';
import {
  builderEvpnImetRoutes,
  builderEvpnRoutes,
  builderMplsForwardingTable,
  builderMplsLspState,
  builderProviderUnderlayTrace,
  builderTunnelPacketProjection,
  builderTunnelState,
  builderVxlanForwarding,
  builderVxlanVniState,
} from '../src/builder/provider.ts';
import { createDefaultBuilderProviderConfig } from '../src/builder/provider-config.ts';
import {
  createDefaultBuilderRoutingConfig,
  setBuilderOspfEverywhere,
  setBuilderProviderConfig,
  traceBuilderForwarding,
} from '../src/builder/routing.ts';
import { createBuilderScenario, deserializeBuilderScenario, serializeBuilderScenario } from '../src/builder/scenario.ts';

const graph={nodes:[
  {id:'pe1',label:'PE1',kind:'router',builtin:false},{id:'p1',label:'P1',kind:'router',builtin:false},{id:'p2',label:'P2',kind:'router',builtin:false},{id:'pe2',label:'PE2',kind:'router',builtin:false},
],links:[
  {id:'pe1-p1',a:'pe1',b:'p1',cost:10,failed:false,builtin:false},{id:'p1-p2',a:'p1',b:'p2',cost:10,failed:false,builtin:false},{id:'p2-pe2',a:'p2',b:'pe2',cost:10,failed:false,builtin:false},
]};
const layout={pe1:{x:10,y:50},p1:{x:35,y:50},p2:{x:65,y:50},pe2:{x:90,y:50}};
const addressing=createDefaultBuilderAddressing(graph);const profiles=createDefaultBuilderLinkProfiles(graph);let routing=setBuilderOspfEverywhere(graph,addressing,createDefaultBuilderRoutingConfig(),true);
for(const router of graph.nodes){routing={...routing,bgp:setBuilderBgpRouterAsn(graph,routing.bgp,router.id,64496)};routing={...routing,bgp:setBuilderBgpRouterEnabled(graph,routing.bgp,router.id,true)};}
for(const link of graph.links)routing={...routing,bgp:upsertBuilderBgpSession(graph,routing.bgp,link.id)};
const address=(id)=>interfacesForBuilderNode(addressing,id)[0].address;
const provider=createDefaultBuilderProviderConfig();
provider.tunnels=[
  {id:'gre-pe',kind:'gre',sourceRouterId:'pe1',destinationRouterId:'pe2',overlayPrefix:'172.31.255.0/30',localTunnelAddress:'172.31.255.1',remoteTunnelAddress:'172.31.255.2',enabled:true,securityState:'none',description:'GRE overlay'},
  {id:'ipsec-core',kind:'ipsec',sourceRouterId:'p1',destinationRouterId:'p2',overlayPrefix:'172.31.254.0/30',localTunnelAddress:'172.31.254.1',remoteTunnelAddress:'172.31.254.2',enabled:true,securityState:'ready',description:'IPsec-style semantic'},
];
provider.mpls.enabledRouterIds=['pe1','p1','p2','pe2'];provider.mpls.lsps=[{id:'lsp-pe1-pe2',ingressRouterId:'pe1',egressRouterId:'pe2',fecPrefix:'10.20.0.0/16',enabled:true,description:'Provider LSP'}];
provider.vxlan.vteps=[{routerId:'pe1',sourceAddress:address('pe1'),enabled:true},{routerId:'pe2',sourceAddress:address('pe2'),enabled:true}];provider.vxlan.vnis=[{id:'vni-10100',vni:10100,memberVtepRouterIds:['pe1','pe2'],routeTarget:'64496:10100',description:'Tenant 10'}];provider.vxlan.bindings=[{id:'host-a',vni:10100,vtepRouterId:'pe1',mac:'02:00:00:00:10:01',ip:'10.10.0.10',attachment:'SITE A',description:'Host A'},{id:'host-b',vni:10100,vtepRouterId:'pe2',mac:'02:00:00:00:10:02',ip:'10.10.0.20',attachment:'SITE B',description:'Host B'}];provider.vxlan.evpnEnabled=true;
routing=setBuilderProviderConfig(graph,addressing,routing,provider);

const canonical=traceBuilderForwarding(graph,addressing,routing,'pe1','pe2',graph,{protocol:'udp',sourcePort:45000,destinationPort:4789,discriminator:'track-g-underlay'});const underlay=builderProviderUnderlayTrace(graph,addressing,routing,'pe1','pe2');assert.equal(underlay.reachable,true);assert.deepEqual(underlay.hops.map((hop)=>hop.linkId),canonical.hops.map((hop)=>hop.linkId),'Track G must consume the canonical forwarding path rather than calculate another underlay');
const gre=builderTunnelState(graph,addressing,routing,profiles,routing.provider.tunnels.find((entry)=>entry.id==='gre-pe'));assert.equal(gre.state,'UP');assert.equal(gre.underlayReachable,true);assert.equal(gre.overlayReachable,true);assert.equal(gre.encapsulationOverheadBytes,24);assert.equal(gre.effectiveOverlayMtuBytes,1476);assert.deepEqual(gre.underlayLinkIds,['pe1-p1','p1-p2','p2-pe2']);
const packet=builderTunnelPacketProjection(graph,addressing,routing,profiles,routing.provider.tunnels[0],{source:'172.31.255.1',destination:'172.31.255.2',bytes:1400});assert.equal(packet.state,'ENCAPSULATED');assert.equal(packet.outer.protocol,'GRE');assert.equal(packet.outer.bytes,1424);assert.notEqual(packet.outer.source,packet.inner.source);assert.notEqual(packet.outer.destination,packet.inner.destination);
const tooLarge=builderTunnelPacketProjection(graph,addressing,routing,profiles,routing.provider.tunnels[0],{source:'172.31.255.1',destination:'172.31.255.2',bytes:1480});assert.equal(tooLarge.state,'DROP');assert.equal(tooLarge.fragmentationRequired,true);
const ipsec=routing.provider.tunnels.find((entry)=>entry.id==='ipsec-core');assert.equal(builderTunnelState(graph,addressing,routing,profiles,ipsec).state,'UP');const authFailed=structuredClone(ipsec);authFailed.securityState='auth-failed';const authState=builderTunnelState(graph,addressing,routing,profiles,authFailed);assert.equal(authState.underlayReachable,true);assert.equal(authState.overlayReachable,false);assert.match(authState.reason,/AUTH FAILED/);assert.doesNotMatch(JSON.stringify(routing.provider),/private.?key|pre.?shared.?key|secret/i,'Track G config must not store production cryptographic key material');

const lsp=builderMplsLspState(graph,addressing,routing,routing.provider.mpls.lsps[0]);assert.equal(lsp.state,'UP');assert.deepEqual(lsp.routerPath,['pe1','p1','p2','pe2']);assert.deepEqual(lsp.operations.map((row)=>row.operation),['PUSH','SWAP','SWAP','POP']);assert.ok(lsp.operations.every((row,index)=>index===lsp.operations.length-1||row.outLabel!=null));assert.equal(builderMplsForwardingTable(graph,addressing,routing,'p1')[0].operation,'SWAP');assert.deepEqual(lsp.linkIds,gre.underlayLinkIds,'MPLS and tunnel projections should follow the same canonical underlay when their endpoints match');

const vni=builderVxlanVniState(graph,addressing,routing,routing.provider.vxlan.vnis[0]);assert.equal(vni.state,'UP');assert.equal(vni.pairs.length,1);assert.deepEqual(vni.pairs[0].linkIds,['pe1-p1','p1-p2','p2-pe2']);
const evpnAtPe1=builderEvpnRoutes(graph,addressing,routing,'pe1');const remoteType2=evpnAtPe1.find((row)=>row.mac==='02:00:00:00:10:02');assert.ok(remoteType2);assert.equal(remoteType2.learned,'BGP EVPN');assert.equal(remoteType2.nextHop,address('pe2'));assert.equal(remoteType2.routeTarget,'64496:10100');assert.equal(remoteType2.controlPlaneReachable,true);assert.equal(remoteType2.underlayReachable,true);assert.ok(builderEvpnImetRoutes(graph,addressing,routing,'pe1').some((row)=>row.originVtepRouterId==='pe2'&&row.learned==='BGP EVPN'));
const vxlan=builderVxlanForwarding(graph,addressing,routing,routing.provider.vxlan.bindings[0],'02:00:00:00:10:02');assert.equal(vxlan.mode,'EVPN UNICAST');assert.equal(vxlan.delivered,true);assert.deepEqual(vxlan.remoteVtepRouterIds,['pe2']);assert.equal(vxlan.outerPaths[0].udpPort,4789);assert.equal(vxlan.outerPaths[0].sourceAddress,address('pe1'));assert.equal(vxlan.outerPaths[0].destinationAddress,address('pe2'));
const unknown=builderVxlanForwarding(graph,addressing,routing,routing.provider.vxlan.bindings[0],'02:00:00:00:ff:ff');assert.equal(unknown.mode,'INGRESS REPLICATION');assert.equal(unknown.delivered,false,'unknown-MAC flooding must not invent proof of destination delivery');assert.equal(unknown.outerPaths.length,1);

const failedGraph=structuredClone(graph);failedGraph.links.find((link)=>link.id==='p1-p2').failed=true;const failedGre=builderTunnelState(failedGraph,addressing,routing,profiles,routing.provider.tunnels[0]);assert.equal(failedGre.underlayReachable,false);assert.equal(failedGre.overlayReachable,false);assert.equal(builderVxlanVniState(failedGraph,addressing,routing,routing.provider.vxlan.vnis[0]).state,'DOWN');assert.equal(builderEvpnRoutes(failedGraph,addressing,routing,'pe1').some((row)=>row.originVtepRouterId==='pe2'),false,'EVPN remote learning must not survive loss of required control/underlay reachability');

const ethernet=createDefaultBuilderEthernetConfig();const scenario=createBuilderScenario('Track G provider',graph,'pe1','pe2',layout,addressing,routing,undefined,ethernet,profiles,createDefaultBuilderAclConfig(),createDefaultBuilderNatConfig(graph),createDefaultBuilderDhcpConfig(ethernet),createDefaultBuilderIpv6Config(graph,addressing));assert.equal(scenario.version,9);const roundTrip=deserializeBuilderScenario(serializeBuilderScenario(scenario));assert.equal(roundTrip.version,9);assert.equal(roundTrip.routing.provider.tunnels[0].kind,'gre');assert.equal(roundTrip.routing.provider.mpls.lsps[0].id,'lsp-pe1-pe2');assert.equal(roundTrip.routing.provider.vxlan.vnis[0].vni,10100);assert.equal(roundTrip.routing.provider.vxlan.bindings[1].mac,'02:00:00:00:10:02');

const networkBuilder=readFileSync('src/NetworkBuilder.tsx','utf8'),routingPanel=readFileSync('src/BuilderRoutingPolicyPanel.tsx','utf8'),providerPanel=readFileSync('src/BuilderProviderPanel.tsx','utf8'),providerSource=readFileSync('src/builder/provider.ts','utf8');assert.doesNotMatch(networkBuilder,/builder\/provider|BuilderProviderPanel/,'Track G algorithms/UI must not enter the startup NetworkBuilder chunk directly');assert.match(networkBuilder,/BuilderRoutingPolicyPanel=lazy/);assert.match(routingPanel,/BuilderProviderPanel/);assert.match(providerPanel,/UNDERLAY TRUTH → ENCAPSULATION → OVERLAY/);assert.match(providerPanel,/SEMANTICS, NOT CRYPTOGRAPHY/);assert.match(providerPanel,/LABEL FORWARDING/);assert.match(providerPanel,/VNI \/ VTEP OVERLAY/);assert.match(providerPanel,/MAC\/IP CONTROL PLANE/);assert.match(providerSource,/traceBuilderForwarding/,'provider underlay must call canonical Builder forwarding');
console.log('Track G provider contract passed: canonical underlay tunnel separation, bounded encrypted-tunnel semantics, tunnel MTU overhead, MPLS push/swap/pop and LFIB state, VXLAN VTEP/VNI reachability, EVPN Type-2/Type-3 learning, unknown-MAC non-invention, underlay failure propagation, scenario-v9 persistence, and lazy product integration.');
