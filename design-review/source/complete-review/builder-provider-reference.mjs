import { readFileSync } from 'node:fs';
import { createDefaultBuilderAddressing, interfacesForBuilderNode } from '/workspace/scratch/8f1a24ac8c73/hopscotch/src/builder/addressing.ts';
import { createDefaultBuilderAclConfig } from '/workspace/scratch/8f1a24ac8c73/hopscotch/src/builder/acl.ts';
import { setBuilderBgpRouterAsn, setBuilderBgpRouterEnabled, upsertBuilderBgpSession } from '/workspace/scratch/8f1a24ac8c73/hopscotch/src/builder/bgp.ts';
import { createDefaultBuilderDhcpConfig } from '/workspace/scratch/8f1a24ac8c73/hopscotch/src/builder/dhcp.ts';
import { createDefaultBuilderEthernetConfig } from '/workspace/scratch/8f1a24ac8c73/hopscotch/src/builder/ethernet.ts';
import { createDefaultBuilderIpv6Config } from '/workspace/scratch/8f1a24ac8c73/hopscotch/src/builder/ipv6.ts';
import { createDefaultBuilderLinkProfiles } from '/workspace/scratch/8f1a24ac8c73/hopscotch/src/builder/link-characteristics.ts';
import { createDefaultBuilderNatConfig } from '/workspace/scratch/8f1a24ac8c73/hopscotch/src/builder/nat.ts';
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
} from '/workspace/scratch/8f1a24ac8c73/hopscotch/src/builder/provider.ts';
import { createDefaultBuilderProviderConfig } from '/workspace/scratch/8f1a24ac8c73/hopscotch/src/builder/provider-config.ts';
import {
  createDefaultBuilderRoutingConfig,
  setBuilderOspfEverywhere,
  setBuilderProviderConfig,
  traceBuilderForwarding,
} from '/workspace/scratch/8f1a24ac8c73/hopscotch/src/builder/routing.ts';
import { createBuilderScenario, deserializeBuilderScenario, serializeBuilderScenario } from '/workspace/scratch/8f1a24ac8c73/hopscotch/src/builder/scenario.ts';

const graph={nodes:[
  {id:'pe1',label:'PE1',kind:'router',builtin:false},{id:'p1',label:'P1',kind:'router',builtin:false},{id:'p2',label:'P2',kind:'router',builtin:false},{id:'pe2',label:'PE2',kind:'router',builtin:false},
],links:[
  {id:'pe1-p1',a:'pe1',b:'p1',cost:10,failed:false,builtin:false},{id:'p1-p2',a:'p1',b:'p2',cost:10,failed:false,builtin:false},{id:'p2-pe2',a:'p2',b:'pe2',cost:10,failed:false,builtin:false},
]};
const layout={pe1:{x:10,y:50},p1:{x:35,y:50},p2:{x:65,y:50},pe2:{x:90,y:50}};
const addressing=createDefaultBuilderAddressing(graph);const profiles=createDefaultBuilderLinkProfiles(graph);let routing=setBuilderOspfEverywhere(graph,addressing,createDefaultBuilderRoutingConfig(),true);
for(const [index,router] of graph.nodes.entries()){routing={...routing,bgp:setBuilderBgpRouterAsn(graph,routing.bgp,router.id,64496+index)};routing={...routing,bgp:setBuilderBgpRouterEnabled(graph,routing.bgp,router.id,true)};}
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



const gre=builderTunnelState(graph,addressing,routing,profiles,routing.provider.tunnels[0]);
const packet=builderTunnelPacketProjection(graph,addressing,routing,profiles,routing.provider.tunnels[0],{source:'172.31.255.1',destination:'172.31.255.2',bytes:1400});
const tooLarge=builderTunnelPacketProjection(graph,addressing,routing,profiles,routing.provider.tunnels[0],{source:'172.31.255.1',destination:'172.31.255.2',bytes:1480});
const lsp=builderMplsLspState(graph,addressing,routing,routing.provider.mpls.lsps[0]);
const vni=builderVxlanVniState(graph,addressing,routing,routing.provider.vxlan.vnis[0]);
const evpn=builderEvpnRoutes(graph,addressing,routing,'pe1');
const vxlan=builderVxlanForwarding(graph,addressing,routing,routing.provider.vxlan.bindings[0],'02:00:00:00:10:02');
const failedGraph=structuredClone(graph);failedGraph.links.find(link=>link.id==='p1-p2').failed=true;
const failedGre=builderTunnelState(failedGraph,addressing,routing,profiles,routing.provider.tunnels[0]);
export default {graph,layout,addressing,routing,profiles,gre,packet,tooLarge,lsp,vni,evpn,vxlan,failedGre};

