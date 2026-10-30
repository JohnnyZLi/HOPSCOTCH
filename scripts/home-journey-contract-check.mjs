import assert from 'node:assert/strict';
import {createHomeJourney} from '../src/redesign/home-journey.ts';
import {buildJourneyScenario,journeyStateAt,DEFAULT_JOURNEY_CONFIG} from '../src/journey/model.ts';
import {projectJourneyPacketVisual} from '../src/journey/packet-visual.ts';
import {projectJourneyPhysicalState} from '../src/journey/physical-journey.ts';
import {decodeJourneyQuery} from '../src/journey/scenario.ts';
const home=createHomeJourney(),scenario=buildJourneyScenario('example.test',DEFAULT_JOURNEY_CONFIG),original=JSON.stringify(scenario);
assert.equal(home.steps.length,6);
assert.equal(new Set(home.steps.map(s=>s.physical.continuityId)).size,1,'One routed packet must survive every stage');
for(const [index,step] of home.steps.entries()){
 const event=scenario.events.find(e=>e.id===step.event.id);assert.deepEqual(step.event,event);
 const state=journeyStateAt(scenario,event.atMs),physical=projectJourneyPhysicalState({profile:scenario.transportProfile,destinationAddress:scenario.destinationAddress,stage:state.packetTransitStage}),envelope=physical.l2Envelope==='wan'?physical.outgoing:physical.incoming;
 const visual=projectJourneyPacketVisual({hostname:scenario.hostname,destinationAddress:scenario.destinationAddress,profile:scenario.transportProfile,stage:state.packetAssemblyStage,selectedLayerId:'network',ttl:physical.currentTtl,sourceMac:envelope.sourceMac,destinationMac:envelope.destinationMac});
 assert.deepEqual(step.packet,visual.snapshot,'Home and Journey must expose identical source bytes');assert.deepEqual(step.physical,physical);
 const portable=decodeJourneyQuery(home.search(index));assert.equal(portable.timeMs,event.atMs);assert.equal(portable.hostname,scenario.hostname);assert.equal(portable.transportProfile,scenario.transportProfile);
 assert.equal(step.packet.config.destinationIpv4,scenario.destinationAddress);
}
const before=home.steps[1],after=home.steps[2];assert.equal(before.packet.config.ttl,64);assert.equal(after.packet.config.ttl,63);assert.notEqual(before.packet.networkChecksum,after.packet.networkChecksum);
assert.deepEqual(before.packet.segments.find(s=>s.id==='transport').bytes,after.packet.segments.find(s=>s.id==='transport').bytes,'A routed hop must preserve the transport payload');
assert.deepEqual(home.steps.at(-1).packet.segments.find(s=>s.id==='ethernet').bytes,home.steps[4].packet.segments.find(s=>s.id==='ethernet').bytes);assert.notDeepEqual(before.packet.segments.find(s=>s.id==='ethernet').bytes,home.steps.at(-1).packet.segments.find(s=>s.id==='ethernet').bytes);
assert.equal(JSON.stringify(scenario),original,'Presentation must not mutate canonical events');
console.log('Home Journey contract passed: canonical event/byte parity, routed continuity, TTL/checksum consequence and portable handoff.');
