import {buildJourneyScenario,journeyStateAt,DEFAULT_JOURNEY_CONFIG} from '../journey/model.ts';
import {projectJourneyPhysicalState} from '../journey/physical-journey.ts';
import {projectJourneyPacketVisual} from '../journey/packet-visual.ts';
import {createPortableJourneyScenario,encodeJourneyQuery} from '../journey/scenario.ts';

// A read-only window into the same request used by the full Journey. Source
// event times, packet continuity, fields and bytes are never authored by motion.
export function createHomeJourney(){
 const scenario=buildJourneyScenario('example.test',DEFAULT_JOURNEY_CONFIG);
 const phases=['switch-forward','router-decapsulate','router-ttl','router-route','router-reencapsulate','next-link'];
 const explanations:Record<string,[string,string,string[]]>={
  'switch-forward':['A request is on its way.','An IPv4 packet reaches the router.',[]],
  'router-decapsulate':['Every hop makes a decision.','The router opens the local frame to inspect the IP packet.',['ip-dst']],
  'router-ttl':['One hop. One less to live.','TTL decreases; the header checksum changes with it.',['ip-ttl','ip-checksum']],
  'router-route':['The destination decides the route.','The routing table selects the next hop for this address.',['ip-dst']],
  'router-reencapsulate':['Same IP packet. New Ethernet frame.','Ready for the next link.',[]],
  'next-link':['And the request continues.','The destination stays the same as the packet leaves this hop.',[]],
 };
 const steps=scenario.events.filter(e=>e.kind==='packet.transit'&&phases.includes(e.phase)).map(event=>{
  const state=journeyStateAt(scenario,event.atMs),physical=projectJourneyPhysicalState({profile:scenario.transportProfile,destinationAddress:scenario.destinationAddress,stage:state.packetTransitStage});
  const envelope=physical.l2Envelope==='wan'?physical.outgoing:physical.incoming;
  const projection=projectJourneyPacketVisual({hostname:scenario.hostname,destinationAddress:scenario.destinationAddress,profile:scenario.transportProfile,stage:state.packetAssemblyStage,selectedLayerId:'network',ttl:physical.currentTtl,sourceMac:envelope.sourceMac,destinationMac:envelope.destinationMac});
  const [title,detail,read]=explanations[event.phase];
  return {event,physical,packet:projection.snapshot,fields:projection.snapshot.segments.find(s=>s.id==='network')!.fields,title,detail,read};
 });
 return {scenario,steps,search:(index:number)=>encodeJourneyQuery(createPortableJourneyScenario({hostname:scenario.hostname,config:DEFAULT_JOURNEY_CONFIG,timeMs:steps[index].event.atMs}))};
}
