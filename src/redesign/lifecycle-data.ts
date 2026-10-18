import { tcpScenario, tcpStateAt } from '../protocol/tcp';
import { dnsScenario, dnsStateAt } from '../protocol/dns';
import { tlsEvents, tlsStateAt } from '../protocol/tls';
import { httpComparisonEvents, httpComparisonStateAt } from '../protocol/httpComparison';
import { lab01Scenario, lab01StateAt } from '../simulation/lab01';
import { buildPacket, defaultPacketConfig, type PacketConfig } from '../packet/model';
import { buildJourneyScenario, journeyStateAt } from '../journey/model';
import { decodeJourneyQuery, scenarioConfigFromPortable } from '../journey/scenario';
import { createProviderData } from './provider-data';
import { projectJourneyPacketVisual } from '../journey/packet-visual';
import { projectJourneyPhysicalState } from '../journey/physical-journey';

export function createLifecycleData(scene: string, search: string) {
  const portable = decodeJourneyQuery(search);
  const journey = buildJourneyScenario(portable?.hostname ?? 'example.test', portable ? scenarioConfigFromPortable(portable) : {transportProfile:'tcp-h2',dnsProfile:'cache-miss',impairmentProfile:'clean'});
  const packetVariants = (['ipv4','ipv6'] as const).flatMap(family => (['tcp','udp','icmp'] as const).map(transport => buildPacket({...defaultPacketConfig,family,transport})));
  const configs: PacketConfig[] = [defaultPacketConfig,{...defaultPacketConfig,ttl:63},{...defaultPacketConfig,ttl:63,payloadBytes:128},{...defaultPacketConfig,ttl:63,payloadBytes:16}];
  return {
    bootstrapScene: scene, bootstrapSourceTime: portable?.timeMs, referenceModels: [],
    tcp:{frames:tcpScenario.events.map(event => ({event,state:tcpStateAt(event.atMs)}))},
    dns:Object.fromEntries((['miss','hit'] as const).map(mode => [mode,{frames:dnsScenario(mode).events.map(event => ({event,state:dnsStateAt(mode,event.atMs)}))}])),
    tls:{frames:tlsEvents.map(event => ({event,state:tlsStateAt(event.atMs)}))},
    http:{frames:httpComparisonEvents.map(event => ({event,state:httpComparisonStateAt(event.atMs)}))},
    failure:{graph:{nodes:lab01Scenario.nodes,links:lab01Scenario.links},frames:lab01Scenario.events.map(event => ({event,state:lab01StateAt(event.atMs)}))},
    packetVariants,packetOperations:configs.map(buildPacket),
    journey:{context:{hostname:journey.hostname,requestId:journey.id,destinationAddress:journey.destinationAddress},frames:journey.events.map(event => {
      const state=journeyStateAt(journey,event.atMs);
      if(!event.kind.startsWith('packet.'))return {event,state};
      const physical=event.kind==='packet.transit'?projectJourneyPhysicalState({profile:journey.transportProfile,destinationAddress:journey.destinationAddress,stage:state.packetTransitStage}):null;
      const envelope=physical?(physical.l2Envelope==='wan'?physical.outgoing:physical.incoming):null;
      const packetVisual=projectJourneyPacketVisual({hostname:journey.hostname,destinationAddress:journey.destinationAddress,profile:journey.transportProfile,stage:state.packetAssemblyStage,selectedLayerId:physical?'network':undefined,ttl:physical?.currentTtl,sourceMac:envelope?.sourceMac,destinationMac:envelope?.destinationMac});
      return {event,state,packetVisual,physical};
    })},
    provider:createProviderData(),
  };
}
