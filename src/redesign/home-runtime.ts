import {buildPacket,defaultPacketConfig} from '../packet/model';
import type {ExploreDestination} from '../workspace-catalog';
import {mountConnected} from './connected-runtime.js';

export function mountHome(element:HTMLElement,navigate:(id:ExploreDestination|null,search?:string)=>void) {
 const packet=buildPacket(defaultPacketConfig),network=packet.segments.find(segment=>segment.id==='network')!;
 return mountConnected(element,{referenceModels:[{id:'packet',frames:[{objectTitle:'IPv4',fields:network.fields}]}],captureMulti:{frames:[],conversations:[]},captureMultiBytes:[]},navigate);
}
