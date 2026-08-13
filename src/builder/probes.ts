import { interfacesForBuilderNode, type BuilderAddressing } from './addressing.ts';
import { traceBuilderForwarding, type BuilderForwardingTrace, type BuilderRoutingConfig } from './routing.ts';
import type { BuilderGraph } from './model.ts';
import { createDefaultBuilderLinkProfiles, deterministicBuilderPathDrop, builderPathCharacteristics, builderRoundTripCharacteristics, type BuilderLinkProfiles } from './link-characteristics.ts';
import { createDefaultBuilderAclConfig, traceBuilderPolicy, type BuilderAclConfig } from './acl.ts';
import { createEmptyBuilderNatConfig, runBuilderNatInboundFlow, runBuilderNatOutboundFlow, runBuilderNatRelatedIcmpInbound, type BuilderNatConfig, type BuilderNatFlowResult, type BuilderNatSessionTable } from './nat.ts';

export type BuilderProbeKind = 'ping' | 'traceroute';
export type BuilderProbeStatus = 'echo-reply' | 'time-exceeded' | 'timeout' | 'unreachable';
export interface BuilderProbePacketSeed { id:string; label:string; sourceAddress:string; destinationAddress:string; sourceMac:string; destinationMac:string; ttl:number; }
export interface BuilderProbeAttempt {
  index:number; ttl:number; status:BuilderProbeStatus; responderNodeId:string|null; responderAddress:string|null;
  requestNodeIds:string[]; requestLinkIds:string[]; responseNodeIds:string[]; responseLinkIds:string[]; detail:string; packet:BuilderProbePacketSeed|null;
  simulatedRttMs:number|null; jitterMs:number; bottleneckMbps:number|null; pathMtuBytes:number|null; pathLossPercent:number; dropLinkId:string|null;
  natDetail:string|null;
}
export interface BuilderProbeResult {
  id:string; sequence:number; kind:BuilderProbeKind; plane:'ROUTED IPV4'; sourceNodeId:string; destinationNodeId:string; sourceAddress:string|null; destinationAddress:string|null;
  success:boolean; attempts:BuilderProbeAttempt[]; summary:string; snapshotNote:string; natApplied:boolean; natTranslationId:string|null; natSessions:BuilderNatSessionTable;
}

const PROBE_PACKET_BYTES=84;
function nodeLabel(graph:BuilderGraph,nodeId:string):string{return graph.nodes.find((node)=>node.id===nodeId)?.label??nodeId.toUpperCase();}
function nodePath(trace:BuilderForwardingTrace):string[]{return[trace.sourceNodeId,...trace.hops.map((hop)=>hop.nextNodeId).filter((id):id is string=>Boolean(id))].filter((id,index,all)=>index===0||id!==all[index-1]);}
function linkPath(trace:BuilderForwardingTrace):string[]{return trace.hops.flatMap((hop)=>hop.linkId?[hop.linkId]:[]);}
function primaryAddress(addressing:BuilderAddressing,nodeId:string):string|null{return interfacesForBuilderNode(addressing,nodeId)[0]?.address??null;}
function inboundAddress(addressing:BuilderAddressing,nodeId:string,linkId:string|undefined):string|null{if(!linkId)return primaryAddress(addressing,nodeId);return addressing.segments[linkId]?.interfaces.find((entry)=>entry.nodeId===nodeId)?.address??primaryAddress(addressing,nodeId);}
function stableMac(nodeId:string,salt=''):string{const text=`${nodeId}:${salt}`;let hash=0x811c9dc5;for(let index=0;index<text.length;index+=1){hash^=text.charCodeAt(index);hash=Math.imul(hash,0x01000193)>>>0;}return[0x02,0x48,0x4f,(hash>>>16)&0xff,(hash>>>8)&0xff,hash&0xff].map((byte)=>byte.toString(16).padStart(2,'0')).join(':');}
function packetSeed(id:string,label:string,sourceNodeId:string,destinationNodeId:string,sourceAddress:string|null,destinationAddress:string|null,ttl:number):BuilderProbePacketSeed|null{if(!sourceAddress||!destinationAddress)return null;return{id,label,sourceAddress,destinationAddress,sourceMac:stableMac(sourceNodeId,'probe'),destinationMac:stableMac(destinationNodeId,'probe'),ttl};}
function metrics(profiles:BuilderLinkProfiles,requestLinkIds:string[],responseLinkIds:string[],hasResponse:boolean){const path=builderPathCharacteristics(profiles,[...requestLinkIds,...responseLinkIds]);const round=builderRoundTripCharacteristics(profiles,requestLinkIds,responseLinkIds);return{simulatedRttMs:hasResponse?Number(round.rttMs.toFixed(2)):null,jitterMs:Number(path.jitterMs.toFixed(2)),bottleneckMbps:path.bottleneckMbps,pathMtuBytes:path.pathMtuBytes,pathLossPercent:Number(path.lossPercent.toFixed(4))};}
function natNote(request:BuilderNatFlowResult|null,response:BuilderNatFlowResult|null):string|null{if(!request?.translation&&!response?.translation)return null;const parts=[];if(request?.translation)parts.push(`${request.translation.kind.toUpperCase()} ${request.originalTuple.sourceAddress} → ${request.translatedTuple?.sourceAddress}`);if(response?.translation)parts.push(`RETURN ${response.originalTuple.destinationAddress} → ${response.translatedTuple?.destinationAddress}`);return parts.join(' · ');}

function runPing(graph:BuilderGraph,addressing:BuilderAddressing,routing:BuilderRoutingConfig,sourceNodeId:string,destinationNodeId:string,sequence:number,profiles:BuilderLinkProfiles,acl:BuilderAclConfig,nat:BuilderNatConfig,natSessions:BuilderNatSessionTable):BuilderProbeResult{
  const natEnabled=nat.boundaries.some((boundary)=>boundary.enabled);
  const ordinaryRequestPolicy=natEnabled?null:traceBuilderPolicy(graph,addressing,routing,acl,sourceNodeId,destinationNodeId,'icmp');
  const natRequest=natEnabled?runBuilderNatOutboundFlow(graph,addressing,routing,nat,natSessions,sourceNodeId,destinationNodeId,'icmp',null,null,sequence,acl):null;
  const request=natRequest?.forwarding??ordinaryRequestPolicy?.forwarding??traceBuilderForwarding(graph,addressing,routing,sourceNodeId,destinationNodeId);
  let workingSessions=natRequest?.sessions??natSessions;
  const sourceAddress=primaryAddress(addressing,sourceNodeId); const destinationAddress=request.destinationAddress??primaryAddress(addressing,destinationNodeId);
  let reply:BuilderForwardingTrace|null=null; let natReply:BuilderNatFlowResult|null=null; let status:BuilderProbeStatus='unreachable'; let responderNodeId:string|null=null; let detail=''; let dropLinkId:string|null=null;
  const requestLinks=linkPath(request); const requestPhysical=builderPathCharacteristics(profiles,requestLinks);
  if(!request.reachable){status='unreachable';responderNodeId=request.failureNodeId;detail=request.failureReason??'Forward request could not be delivered.';}
  else if(natRequest&&!natRequest.success){status='unreachable';responderNodeId=natRequest.deniedAtRouterId??natRequest.routerId;detail=`NAT / policy stopped the Echo Request: ${natRequest.explanation}`;}
  else if(ordinaryRequestPolicy&&!ordinaryRequestPolicy.permitted){status='unreachable';responderNodeId=ordinaryRequestPolicy.deniedAtRouterId;detail=`ACL / firewall policy denied the Echo Request: ${ordinaryRequestPolicy.explanation}`;}
  else if((requestPhysical.pathMtuBytes??PROBE_PACKET_BYTES)<PROBE_PACKET_BYTES){status='unreachable';responderNodeId=request.hops.find((hop)=>profiles[hop.linkId??'']?.mtuBytes<PROBE_PACKET_BYTES)?.nodeId??sourceNodeId;detail=`DF teaching probe is ${PROBE_PACKET_BYTES} bytes but path MTU is ${requestPhysical.pathMtuBytes}. Fragmentation is not fabricated.`;}
  else if((dropLinkId=deterministicBuilderPathDrop(profiles,requestLinks,`ping:${sequence}:request`))){status='timeout';responderNodeId=null;detail=`Echo Request was deterministically dropped on ${dropLinkId}; route, policy, and translation state were otherwise valid.`;}
  else{
    if(natRequest?.translation){
      natReply=runBuilderNatInboundFlow(graph,addressing,routing,nat,workingSessions,destinationNodeId,natRequest.translation.outsideAddress,'icmp',null,null,sequence+1,acl);
      reply=natReply.forwarding; workingSessions=natReply.sessions;
    }else{
      const replyPolicy=traceBuilderPolicy(graph,addressing,routing,acl,destinationNodeId,sourceNodeId,'icmp'); reply=replyPolicy.forwarding;
      if(!reply.reachable){status='timeout';responderNodeId=destinationNodeId;detail=`Echo Request reached ${nodeLabel(graph,destinationNodeId)}, but the Echo Reply cannot return: ${reply.failureReason??'reverse path unavailable'}.`;}
      else if(!replyPolicy.permitted){status='timeout';responderNodeId=destinationNodeId;detail=`Echo Request arrived, but reverse ACL / firewall policy denied the Echo Reply: ${replyPolicy.explanation}`;}
    }
    if(status!=='timeout'){
      const responseLinks=reply?linkPath(reply):[];
      if(natReply&&!natReply.success){status='timeout';responderNodeId=destinationNodeId;detail=`Echo Request arrived, but NAT / reverse policy cannot deliver the Echo Reply: ${natReply.explanation}`;}
      else if(!reply||!reply.reachable){status='timeout';responderNodeId=destinationNodeId;detail=`Echo Request reached ${nodeLabel(graph,destinationNodeId)}, but the Echo Reply has no usable reverse path.`;}
      else if((dropLinkId=deterministicBuilderPathDrop(profiles,responseLinks,`ping:${sequence}:reply`))){status='timeout';responderNodeId=destinationNodeId;detail=`Echo Reply was deterministically dropped on ${dropLinkId}.`;}
      else{status='echo-reply';responderNodeId=destinationNodeId;detail=natRequest?.translation?'ICMP Echo Request crossed the NAT boundary, reverse translation matched the same state, and both directions pass policy/MTU/loss checks.':'ICMP Echo Request and Echo Reply both pass forwarding, policy, MTU, and deterministic link-loss checks.';}
    }
  }
  const responseLinks=reply?linkPath(reply):[]; const m=metrics(profiles,requestLinks,responseLinks,status==='echo-reply');
  const attempt:BuilderProbeAttempt={index:0,ttl:64,status,responderNodeId,responderAddress:responderNodeId?primaryAddress(addressing,responderNodeId):null,requestNodeIds:nodePath(request),requestLinkIds:requestLinks,responseNodeIds:reply?nodePath(reply):[],responseLinkIds:responseLinks,detail,packet:packetSeed(`probe-${sequence}-echo`,'ICMP ECHO REQUEST',sourceNodeId,destinationNodeId,sourceAddress,destinationAddress,64),...m,dropLinkId,natDetail:natNote(natRequest,natReply)};
  return{id:`probe-${sequence}-ping`,sequence,kind:'ping',plane:'ROUTED IPV4',sourceNodeId,destinationNodeId,sourceAddress,destinationAddress,success:status==='echo-reply',attempts:[attempt],summary:status==='echo-reply'?`${nodeLabel(graph,destinationNodeId)} replied · simulated RTT ${m.simulatedRttMs} ms · path MTU ${m.pathMtuBytes}${natRequest?.translation?' · NAT state matched':''}.`:status==='timeout'?'Request/reply forwarding exists only partially; translation, policy, or link behavior prevented a returning Echo Reply.':`${nodeLabel(graph,responderNodeId??request.failureNodeId??sourceNodeId)} stopped the Echo Request.`,snapshotNote:'Probe history is session-only. RTT comes from explicit link latency, never OSPF cost. NAT-aware Ping consumes the same translation/session engine as Builder flows.',natApplied:Boolean(natRequest?.translation),natTranslationId:natRequest?.translation?.id??null,natSessions:workingSessions};
}

function runTraceroute(graph:BuilderGraph,addressing:BuilderAddressing,routing:BuilderRoutingConfig,sourceNodeId:string,destinationNodeId:string,sequence:number,profiles:BuilderLinkProfiles,acl:BuilderAclConfig,nat:BuilderNatConfig,natSessions:BuilderNatSessionTable):BuilderProbeResult{
  const natEnabled=nat.boundaries.some((boundary)=>boundary.enabled);
  const fullPolicy=natEnabled?null:traceBuilderPolicy(graph,addressing,routing,acl,sourceNodeId,destinationNodeId,'icmp');
  const natRequest=natEnabled?runBuilderNatOutboundFlow(graph,addressing,routing,nat,natSessions,sourceNodeId,destinationNodeId,'icmp',null,null,sequence,acl):null;
  const forward=natRequest?.forwarding??fullPolicy?.forwarding??traceBuilderForwarding(graph,addressing,routing,sourceNodeId,destinationNodeId);
  let workingSessions=natRequest?.sessions??natSessions;
  const sourceAddress=primaryAddress(addressing,sourceNodeId); const destinationAddress=forward.destinationAddress??primaryAddress(addressing,destinationNodeId);
  const nodes=nodePath(forward); const links=linkPath(forward); const attempts:BuilderProbeAttempt[]=[]; let ttl=1; let terminal=false;
  const natBoundaryRouterId=natRequest?.routerId??null; const boundaryNodeIndex=natBoundaryRouterId?nodes.indexOf(natBoundaryRouterId):-1;
  for(let nodeIndex=1;nodeIndex<nodes.length;nodeIndex+=1){
    const nodeId=nodes[nodeIndex]; const node=graph.nodes.find((candidate)=>candidate.id===nodeId); if(!node||node.kind!=='router')continue;
    const requestLinks=links.slice(0,nodeIndex); const packet=packetSeed(`probe-${sequence}-ttl-${ttl}`,`ICMP TRACE TTL ${ttl}`,sourceNodeId,destinationNodeId,sourceAddress,destinationAddress,ttl);
    const physical=builderPathCharacteristics(profiles,requestLinks);
    const deniedHere=(natRequest?.deniedAtRouterId??fullPolicy?.deniedAtRouterId)===nodeId;
    const natHardFailureHere=Boolean(natRequest&&!natRequest.success&&!natRequest.deniedAtRouterId&&natRequest.routerId===nodeId);
    if(deniedHere||natHardFailureHere){const m=metrics(profiles,requestLinks,[],false);const why=natRequest?.explanation??fullPolicy?.explanation??'policy denied';attempts.push({index:attempts.length,ttl,status:'unreachable',responderNodeId:nodeId,responderAddress:inboundAddress(addressing,nodeId,links[nodeIndex-1]),requestNodeIds:nodes.slice(0,nodeIndex+1),requestLinkIds:requestLinks,responseNodeIds:[],responseLinkIds:[],detail:`${nodeLabel(graph,nodeId)} stops the TTL-${ttl} probe: ${why}`,packet,...m,dropLinkId:null,natDetail:natNote(natRequest,null)});terminal=true;break;}
    if((physical.pathMtuBytes??PROBE_PACKET_BYTES)<PROBE_PACKET_BYTES){const m=metrics(profiles,requestLinks,[],false);attempts.push({index:attempts.length,ttl,status:'unreachable',responderNodeId:nodeId,responderAddress:inboundAddress(addressing,nodeId,links[nodeIndex-1]),requestNodeIds:nodes.slice(0,nodeIndex+1),requestLinkIds:requestLinks,responseNodeIds:[],responseLinkIds:[],detail:`DF traceroute probe exceeds path MTU ${physical.pathMtuBytes}.`,packet,...m,dropLinkId:null,natDetail:natNote(natRequest,null)});terminal=true;break;}
    const requestDrop=deterministicBuilderPathDrop(profiles,requestLinks,`trace:${sequence}:${ttl}:request`);
    if(requestDrop){const m=metrics(profiles,requestLinks,[],false);attempts.push({index:attempts.length,ttl,status:'timeout',responderNodeId:null,responderAddress:null,requestNodeIds:nodes.slice(0,nodeIndex+1),requestLinkIds:requestLinks,responseNodeIds:[],responseLinkIds:[],detail:`TTL-${ttl} probe was dropped on ${requestDrop}.`,packet,...m,dropLinkId:requestDrop,natDetail:natNote(natRequest,null)});ttl+=1;continue;}

    let response:BuilderForwardingTrace; let responsePermitted=true; let responseExplanation=''; let natResponse:BuilderNatFlowResult|null=null;
    if(natRequest?.translation&&boundaryNodeIndex>=0&&nodeIndex>boundaryNodeIndex){
      natResponse=natRequest.translation.kind==='pat'
        ? runBuilderNatRelatedIcmpInbound(graph,addressing,routing,nat,workingSessions,nodeId,natRequest.translation.id,sequence+ttl,acl)
        : runBuilderNatInboundFlow(graph,addressing,routing,nat,workingSessions,nodeId,natRequest.translation.outsideAddress,'icmp',null,null,sequence+ttl,acl);
      response=natResponse.forwarding??traceBuilderForwarding(graph,addressing,routing,nodeId,sourceNodeId); responsePermitted=natResponse.success; responseExplanation=natResponse.explanation; workingSessions=natResponse.sessions;
    }else{
      const responsePolicy=traceBuilderPolicy(graph,addressing,routing,acl,nodeId,sourceNodeId,'icmp'); response=responsePolicy.forwarding; responsePermitted=responsePolicy.permitted; responseExplanation=responsePolicy.explanation;
    }
    const responseLinks=linkPath(response); const responseDrop=response.reachable&&responsePermitted?deterministicBuilderPathDrop(profiles,responseLinks,`trace:${sequence}:${ttl}:reply`):null;
    const ok=response.reachable&&responsePermitted&&!responseDrop; const m=metrics(profiles,requestLinks,responseLinks,ok);
    attempts.push({index:attempts.length,ttl,status:ok?'time-exceeded':'timeout',responderNodeId:nodeId,responderAddress:inboundAddress(addressing,nodeId,links[nodeIndex-1]),requestNodeIds:nodes.slice(0,nodeIndex+1),requestLinkIds:requestLinks,responseNodeIds:ok?nodePath(response):[],responseLinkIds:ok?responseLinks:[],detail:ok?`${nodeLabel(graph,nodeId)} decrements TTL to zero and returns ICMP Time Exceeded${natResponse?.translation?' through related NAT state':''} · ${m.simulatedRttMs} ms simulated RTT.`:!response.reachable?`${nodeLabel(graph,nodeId)} expires TTL, but Time Exceeded has no reverse route.`:!responsePermitted?`Time Exceeded cannot traverse its reverse policy/NAT path: ${responseExplanation}`:`Time Exceeded was dropped on ${responseDrop}.`,packet,...m,dropLinkId:responseDrop,natDetail:natNote(natRequest,natResponse)}); ttl+=1;
  }
  if(!terminal){
    const forwardPermitted=natRequest?natRequest.success:(fullPolicy?.permitted??true);
    if(forward.reachable&&forwardPermitted){
      let reply:BuilderForwardingTrace; let replyPermitted=true; let replyExplanation=''; let natReply:BuilderNatFlowResult|null=null;
      if(natRequest?.translation){natReply=runBuilderNatInboundFlow(graph,addressing,routing,nat,workingSessions,destinationNodeId,natRequest.translation.outsideAddress,'icmp',null,null,sequence+ttl,acl);reply=natReply.forwarding??traceBuilderForwarding(graph,addressing,routing,destinationNodeId,sourceNodeId);replyPermitted=natReply.success;replyExplanation=natReply.explanation;workingSessions=natReply.sessions;}
      else{const replyPolicy=traceBuilderPolicy(graph,addressing,routing,acl,destinationNodeId,sourceNodeId,'icmp');reply=replyPolicy.forwarding;replyPermitted=replyPolicy.permitted;replyExplanation=replyPolicy.explanation;}
      const responseLinks=linkPath(reply);const requestDrop=deterministicBuilderPathDrop(profiles,links,`trace:${sequence}:${ttl}:request`);const responseDrop=!requestDrop&&reply.reachable&&replyPermitted?deterministicBuilderPathDrop(profiles,responseLinks,`trace:${sequence}:${ttl}:reply`):null;const ok=!requestDrop&&reply.reachable&&replyPermitted&&!responseDrop;const m=metrics(profiles,links,responseLinks,ok);attempts.push({index:attempts.length,ttl,status:ok?'echo-reply':'timeout',responderNodeId:destinationNodeId,responderAddress:destinationAddress,requestNodeIds:nodes,requestLinkIds:links,responseNodeIds:ok?nodePath(reply):[],responseLinkIds:ok?responseLinks:[],detail:ok?`${nodeLabel(graph,destinationNodeId)} returns Echo Reply${natReply?.translation?' through reverse NAT':''} · ${m.simulatedRttMs} ms simulated RTT.`:requestDrop?`Final Echo probe was dropped on ${requestDrop}.`:!reply.reachable?'Final Echo Reply has no reverse route.':!replyPermitted?`Final Echo Reply cannot traverse reverse policy/NAT: ${replyExplanation}`:`Final Echo Reply was dropped on ${responseDrop}.`,packet:packetSeed(`probe-${sequence}-ttl-${ttl}`,`ICMP TRACE TTL ${ttl}`,sourceNodeId,destinationNodeId,sourceAddress,destinationAddress,ttl),...m,dropLinkId:requestDrop??responseDrop,natDetail:natNote(natRequest,natReply)});
    }else if(!forward.reachable){const m=metrics(profiles,links,[],false);attempts.push({index:attempts.length,ttl,status:'unreachable',responderNodeId:forward.failureNodeId,responderAddress:forward.failureNodeId?primaryAddress(addressing,forward.failureNodeId):null,requestNodeIds:nodes,requestLinkIds:links,responseNodeIds:[],responseLinkIds:[],detail:`${nodeLabel(graph,forward.failureNodeId??sourceNodeId)} cannot continue the probe: ${forward.failureReason??'no route'}.`,packet:packetSeed(`probe-${sequence}-ttl-${ttl}`,`ICMP TRACE TTL ${ttl}`,sourceNodeId,destinationNodeId,sourceAddress,destinationAddress,ttl),...m,dropLinkId:null,natDetail:natNote(natRequest,null)});}
  }
  const success=attempts.at(-1)?.status==='echo-reply';
  return{id:`probe-${sequence}-traceroute`,sequence,kind:'traceroute',plane:'ROUTED IPV4',sourceNodeId,destinationNodeId,sourceAddress,destinationAddress,success,attempts,summary:success?`ICMP traceroute reached ${nodeLabel(graph,destinationNodeId)} after ${Math.max(0,attempts.length-1)} routed hop${attempts.length-1===1?'':'s'}${natRequest?.translation?' with NAT-aware return handling':''}.`:'Traceroute terminated without a returning destination Echo Reply.',snapshotNote:'TTL decrements only at routers. RTT/loss/MTU come from explicit link characteristics. When NAT is active, downstream Time Exceeded replies consume related translation state instead of bypassing it.',natApplied:Boolean(natRequest?.translation),natTranslationId:natRequest?.translation?.id??null,natSessions:workingSessions};
}

export function runBuilderProbe(
  graph:BuilderGraph,addressing:BuilderAddressing,routing:BuilderRoutingConfig,kind:BuilderProbeKind,sourceNodeId:string,destinationNodeId:string,sequence=1,
  profiles:BuilderLinkProfiles=createDefaultBuilderLinkProfiles(graph),acl:BuilderAclConfig=createDefaultBuilderAclConfig(),nat:BuilderNatConfig=createEmptyBuilderNatConfig(),natSessions:BuilderNatSessionTable=[],
):BuilderProbeResult{return kind==='ping'?runPing(graph,addressing,routing,sourceNodeId,destinationNodeId,sequence,profiles,acl,nat,natSessions):runTraceroute(graph,addressing,routing,sourceNodeId,destinationNodeId,sequence,profiles,acl,nat,natSessions);}
