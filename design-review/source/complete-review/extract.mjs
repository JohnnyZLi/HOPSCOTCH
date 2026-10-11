import fs from 'node:fs';
import {WORKSPACE_CATALOG} from '/workspace/scratch/8f1a24ac8c73/hopscotch/src/workspace-catalog.ts';
import {dnsScenarios,dnsStateAt} from '/workspace/scratch/8f1a24ac8c73/hopscotch/src/protocol/dns.ts';
import {tlsEvents,tlsDurationMs,tlsStateAt} from '/workspace/scratch/8f1a24ac8c73/hopscotch/src/protocol/tls.ts';
import {httpComparisonEvents,HTTP_COMPARISON_DURATION_MS,httpComparisonStateAt} from '/workspace/scratch/8f1a24ac8c73/hopscotch/src/protocol/httpComparison.ts';
import {tcpScenario,tcpStateAt} from '/workspace/scratch/8f1a24ac8c73/hopscotch/src/protocol/tcp.ts';
import {simulatedAsGraph,DEFAULT_AS_SOURCE,DEFAULT_AS_DESTINATION,enumeratePolicyPaths} from '/workspace/scratch/8f1a24ac8c73/hopscotch/src/internet/asModel.ts';
import {buildPacket,defaultPacketConfig} from '/workspace/scratch/8f1a24ac8c73/hopscotch/src/packet/model.ts';
import {buildJourneyScenario,journeyStateAt} from '/workspace/scratch/8f1a24ac8c73/hopscotch/src/journey/model.ts';
import {lab01Scenario,lab01StateAt} from '/workspace/scratch/8f1a24ac8c73/hopscotch/src/simulation/lab01.ts';
import {adaptNetworkDiagnosticsReportV2} from '/workspace/scratch/8f1a24ac8c73/hopscotch/src/measurement/networkDiagnosticsAdapter.ts';
import {projectMeasuredSnapshot} from '/workspace/scratch/8f1a24ac8c73/hopscotch/src/measurement/state.ts';
import {pcapCapture,tcpIpv4Frame} from '/workspace/scratch/8f1a24ac8c73/hopscotch/scripts/capture-fixtures.mjs';
import {parseCaptureSession} from '/workspace/scratch/8f1a24ac8c73/hopscotch/src/capture/session.ts';
const repo='/workspace/scratch/8f1a24ac8c73/hopscotch';
const measured=projectMeasuredSnapshot(adaptNetworkDiagnosticsReportV2(JSON.parse(fs.readFileSync(repo+'/scripts/fixtures/measured-workspace-v2.json'))));
const capture=parseCaptureSession(pcapCapture([{bytes:tcpIpv4Frame(),seconds:1,fraction:0}]));
const journey=buildJourneyScenario();
const data={baseline:'be21750003cf3c097c917ae4340c78a0035ccbc6',workspaces:Object.values(WORKSPACE_CATALOG),
 dns:Object.fromEntries(Object.entries(dnsScenarios).map(([mode,s])=>[mode,{duration:s.durationMs,events:s.events,frames:s.events.map(e=>({event:e,state:dnsStateAt(mode,e.atMs)}))}])),
 tls:{duration:tlsDurationMs,frames:tlsEvents.map(event=>({event,state:tlsStateAt(event.atMs)}))},
 http:{duration:HTTP_COMPARISON_DURATION_MS,frames:httpComparisonEvents.map(event=>({event,state:httpComparisonStateAt(event.atMs)}))},
 tcp:{duration:tcpScenario.durationMs,frames:tcpScenario.events.map(event=>({event,state:tcpStateAt(event.atMs)}))},
 internet:{graph:simulatedAsGraph,source:DEFAULT_AS_SOURCE,destination:DEFAULT_AS_DESTINATION,paths:enumeratePolicyPaths(simulatedAsGraph,DEFAULT_AS_SOURCE,DEFAULT_AS_DESTINATION)},
 packet:buildPacket(defaultPacketConfig),
 journey:{duration:journey.durationMs,frames:journey.events.map(event=>({event,state:journeyStateAt(journey,event.atMs)}))},
 failure:{duration:lab01Scenario.durationMs,graph:{nodes:lab01Scenario.nodes,links:lab01Scenario.links},frames:lab01Scenario.events.map(event=>({event,state:lab01StateAt(event.atMs)}))},
 measured,capture,captureFrameBytes:Array.from(tcpIpv4Frame())};

import builder from './builder-device-workbench-reference.mjs';
import provider from './builder-provider-reference.mjs';
import ipv6Control from './builder-ipv6-control-plane-reference.mjs';
import observed from './observed-reference.mjs';
import {pcapngSection,udpIpv4Frame} from '/workspace/scratch/8f1a24ac8c73/hopscotch/scripts/capture-fixtures.mjs';
import {createDefaultGatewayChallenge,createMissingStaticRouteChallenge} from '/workspace/scratch/8f1a24ac8c73/hopscotch/src/builder/challenges.ts';
data.builder=builder;data.provider=provider;data.ipv6Control=ipv6Control;data.observed=observed;
data.packetVariants=[];
for(const family of ['ipv4','ipv6'])for(const transport of ['tcp','udp','icmp'])data.packetVariants.push(buildPacket({...defaultPacketConfig,family,transport}));
data.packetOperations=[buildPacket(defaultPacketConfig),buildPacket({...defaultPacketConfig,ttl:63}),buildPacket({...defaultPacketConfig,ttl:63,payloadBytes:128}),buildPacket({...defaultPacketConfig,ttl:63,payloadBytes:0})];
data.captureMulti=parseCaptureSession(pcapCapture(Array.from({length:9},(_,i)=>({bytes:i%3===2?udpIpv4Frame(new Uint8Array()):tcpIpv4Frame(),seconds:1+i,fraction:0}))));
data.captureNg=parseCaptureSession(pcapngSection({packets:[{bytes:tcpIpv4Frame(),ticks:1000000000n},{bytes:udpIpv4Frame(new Uint8Array()),ticks:1500000000n}]}));
data.captureTruncated=parseCaptureSession(pcapCapture([{bytes:tcpIpv4Frame().slice(0,32),seconds:1,fraction:0,originalLength:54}]));
data.captureMultiBytes=Array.from({length:9},(_,i)=>Array.from(i%3===2?udpIpv4Frame(new Uint8Array()):tcpIpv4Frame()));
data.captureNgBytes=[Array.from(tcpIpv4Frame()),Array.from(udpIpv4Frame(new Uint8Array()))];
data.captureTruncatedBytes=[Array.from(tcpIpv4Frame().slice(0,32))];
data.challenges=[createDefaultGatewayChallenge('design-review'),createMissingStaticRouteChallenge('design-review')];
data.physical={schema:'hopscotch.internet-infrastructure',version:1,provenance:'PUBLIC DATA',source:'PeeringDB',generatedAt:'2026-08-20T22:00:00.000Z',note:'Repository synthetic worker fixture. Geographic coordinates and names are test data, not real facilities.',facilities:Array.from({length:160},(_,index)=>({provenance:'PUBLIC DATA',id:index+1,name:`Fixture Facility ${String(index+1).padStart(3,'0')}`,city:index%2===0?'Los Angeles':'Tokyo',country:index%2===0?'US':'JP',latitude:-70+(index%140),longitude:-170+((index*17)%340),networkCount:index+4,exchangeCount:index%7}))};
fs.writeFileSync('/workspace/scratch/0a09595e9300/complete-review/source-data.json',JSON.stringify(data,(_,v)=>typeof v==='bigint'?v.toString():v,2));
console.log(JSON.stringify({tcp:data.tcp.frames.length,failure:data.failure.frames.length,builderDevices:builder.devices.length,packets:data.packetVariants.length,captureFrames:data.captureMulti.frames.length,pcapngFrames:data.captureNg.frames.length,physicalFixtureFacilities:data.physical.facilities.length}));
