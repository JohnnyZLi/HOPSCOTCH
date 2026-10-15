import {defaultBuilderGraph,defaultBuilderLayout} from '../builder/model';
import {createDefaultBuilderAddressing} from '../builder/addressing';
import {createDefaultBuilderRoutingConfig} from '../builder/routing';
import {createDefaultBuilderIpv6Config} from '../builder/ipv6';
import {createBuilderIpv6ControlState} from '../builder/ipv6-control-plane';
import {createBuilderIpv6LifecycleState} from '../builder/ipv6-lifecycle';
import {createDefaultBuilderIpv6RoutingDepthState} from '../builder/ipv6-routing-depth';
import {createDefaultBuilderEthernetConfig,createEmptyBuilderEthernetConfig} from '../builder/ethernet';
import {createDefaultBuilderLinkProfiles} from '../builder/link-characteristics';
import {createDefaultBuilderAclConfig} from '../builder/acl';
import {createDefaultBuilderNatConfig} from '../builder/nat';
import {createDefaultBuilderDhcpConfig} from '../builder/dhcp';
import {createDefaultBuilderHostedServices} from '../builder/application';
import {createDefaultGatewayChallenge,createAccessVlanChallenge} from '../builder/challenges';
import {createProviderData} from './provider-data';

export async function createBuilderData(search='') {
 const stress=new URLSearchParams(search).get('stress')==='builder-density'?await import('../stress/fixtures'):null;
 const graph=structuredClone(stress?.denseBuilderStressGraph??defaultBuilderGraph),addressing=createDefaultBuilderAddressing(graph),routing=createDefaultBuilderRoutingConfig(),ethernet=stress?createEmptyBuilderEthernetConfig():createDefaultBuilderEthernetConfig(),ipv6=createDefaultBuilderIpv6Config(graph,addressing,!stress);
 const ipv6ControlState=createBuilderIpv6ControlState(),services=createDefaultBuilderHostedServices(graph);
 const input={graph,addressing,routing,ethernet,ipv6,ipv6ControlState,ipv6RoutingDepth:createDefaultBuilderIpv6RoutingDepthState(graph),linkProfiles:createDefaultBuilderLinkProfiles(graph),acl:createDefaultBuilderAclConfig(),nat:createDefaultBuilderNatConfig(graph),dhcp:createDefaultBuilderDhcpConfig(ethernet),services,
  sourceId:stress?.STRESS_BUILDER_SOURCE??'client',destinationId:stress?.STRESS_BUILDER_DESTINATION??'app',events:[],probeHistory:[],arpCache:[],arpResolutions:[],natSessions:[],dhcpLeases:[],dhcpSequence:1,applicationHistory:[],applicationStageOrder:null,ethernetFlow:null};
 return {builder:{input,layout:structuredClone(stress?.denseBuilderStressLayout??defaultBuilderLayout),services,lifecycle:createBuilderIpv6LifecycleState(),cli:[]},provider:createProviderData(),
  ipv6Control:{ra:{event:null},firstNd:{resolutions:[]},secondNd:{state:ipv6ControlState}},
  challenges:[createDefaultGatewayChallenge('hopscotch'),createAccessVlanChallenge('hopscotch')]};
}
