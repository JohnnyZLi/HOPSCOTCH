import {createHomeJourney} from './home-journey';
import {mountPacketScene} from './packet-scene.js';
let introduced=false;
export function mountHomePacket(root,scope,navigate){
 const journey=createHomeJourney(),primary=root.querySelector('.lh-primary');
 root.querySelector('.lh-next-address').textContent=journey.steps.at(-1).event.target.replace(/^next hop /,'');
 const explanations={'ip-src':'The original sender stays visible across this routed hop.','ip-dst':'Routers use this destination to select the next hop.','ip-ttl':'Each router decreases TTL so a packet cannot circulate forever.','ip-checksum':'The IPv4 header checksum is updated when TTL changes.'};
 const scene=mountPacketScene(root,scope,{steps:journey.steps,autoplay:!introduced,onSource:index=>{primary.setAttribute('href','/journey'+journey.search(index));},describeField:(_step,field)=>explanations[field.id]||field.note||field.label+': '+field.value});introduced=true;
 scope.listen(primary,'click',event=>{if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();scene.pause();navigate('journey',journey.search(scene.snapshot().index));});
 return scene;
}
