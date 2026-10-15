import configuration from './provider-config.json';
import type {BuilderGraph} from '../builder/model';
import type {BuilderAddressing} from '../builder/addressing';
import type {BuilderRoutingConfig} from '../builder/routing';
import {builderTunnelState,builderTunnelPacketProjection,builderMplsLspState,builderVxlanVniState,builderEvpnRoutes,builderVxlanForwarding} from '../builder/provider';

export function createProviderData() {
 const graph=configuration.graph as BuilderGraph,addressing=configuration.addressing as unknown as BuilderAddressing,routing=configuration.routing as unknown as BuilderRoutingConfig,profiles=configuration.profiles;
 const tunnel=routing.provider!.tunnels[0],lsp=routing.provider!.mpls.lsps[0];
 const inner={source:'10.10.1.10',destination:'10.20.1.20',bytes:1200};
 const failed={...graph,links:graph.links.map((link,index)=>index===1?{...link,failed:true}:link)};
 return {graph,addressing,routing,profiles,layout:configuration.layout,
  gre:builderTunnelState(graph,addressing,routing,profiles,tunnel),
  packet:builderTunnelPacketProjection(graph,addressing,routing,profiles,tunnel,inner),
  tooLarge:builderTunnelPacketProjection(graph,addressing,routing,profiles,tunnel,{...inner,bytes:1600}),
  failedGre:builderTunnelState(failed,addressing,routing,profiles,tunnel),
  lsp:builderMplsLspState(graph,addressing,routing,lsp),
  vni:builderVxlanVniState(graph,addressing,routing,routing.provider!.vxlan.vnis[0]),
  evpn:builderEvpnRoutes(graph,addressing,routing,routing.provider!.vxlan.vteps[0].routerId),
  vxlan:builderVxlanForwarding(graph,addressing,routing,routing.provider!.vxlan.bindings[0],routing.provider!.vxlan.bindings[1].mac),
 };
}
