import fs from 'node:fs';

function read(path){return fs.readFileSync(path,'utf8');}
function write(path,text){fs.writeFileSync(path,text);}
function replaceOnce(path,before,after){const text=read(path);if(text.includes(after))return;if(!text.includes(before))throw new Error(`Missing anchor in ${path}: ${before.slice(0,120)}`);write(path,text.replace(before,after));}
function replaceAll(path,before,after){const text=read(path);if(!text.includes(before))return;write(path,text.split(before).join(after));}

const challenges='src/builder/challenges.ts';
replaceOnce(challenges,
"import { validateBuilderNatConfig, type BuilderNatConfig } from './nat.ts';\n",
"import { validateBuilderNatConfig, type BuilderNatConfig } from './nat.ts';\nimport { updateBuilderLinkProfile, type BuilderLinkProfiles } from './link-characteristics.ts';\nimport { setBuilderOspfv3Everywhere } from './ipv6.ts';\n");
replaceOnce(challenges,
"export type BuilderChallengeEvidenceKind = 'ping' | 'traceroute' | 'ethernet-flow' | 'arp-resolution' | 'nat-flow' | 'dhcp-transaction' | 'inspect-config' | 'inspect-state' | 'inspect-events';",
"export type BuilderChallengeEvidenceKind = 'ping' | 'traceroute' | 'ethernet-flow' | 'arp-resolution' | 'nat-flow' | 'dhcp-transaction' | 'ipv6-nd' | 'inspect-config' | 'inspect-state' | 'inspect-events';");
replaceOnce(challenges,
"export type BuilderChallengeFamily = 'gateway' | 'access-vlan' | 'trunk-vlan' | 'stp-loop' | 'static-route' | 'ospf-disabled' | 'acl-deny' | 'nat-disabled' | 'dhcp-gateway';",
"export type BuilderChallengeFamily = 'gateway' | 'access-vlan' | 'trunk-vlan' | 'stp-loop' | 'static-route' | 'ospf-disabled' | 'acl-deny' | 'nat-disabled' | 'dhcp-gateway' | 'ipv6-pmtu';");
replaceOnce(challenges,
"export type BuilderChallengeFault = BuilderGatewayChallengeFault | BuilderAccessVlanChallengeFault | BuilderTrunkVlanChallengeFault | BuilderStpChallengeFault | BuilderStaticRouteChallengeFault | BuilderOspfDisabledChallengeFault | BuilderAclDenyChallengeFault | BuilderNatDisabledChallengeFault | BuilderDhcpGatewayChallengeFault;",
String.raw`export interface BuilderIpv6PmtuChallengeFault {
  kind: 'path-mtu-reduced';
  boundary: 'TRANSPORT';
  plane: 'routed';
  nodeId: string;
  linkId: string;
  expectedMtuBytes: number;
  brokenMtuBytes: number;
  packetBytes: number;
}

export type BuilderChallengeFault = BuilderGatewayChallengeFault | BuilderAccessVlanChallengeFault | BuilderTrunkVlanChallengeFault | BuilderStpChallengeFault | BuilderStaticRouteChallengeFault | BuilderOspfDisabledChallengeFault | BuilderAclDenyChallengeFault | BuilderNatDisabledChallengeFault | BuilderDhcpGatewayChallengeFault | BuilderIpv6PmtuChallengeFault;`);
replaceOnce(challenges,
"  kind: 'routed-probe' | 'ethernet-flow' | 'nat-translation' | 'dhcp-configuration';\n  sourceId: string;",
"  kind: 'routed-probe' | 'ethernet-flow' | 'nat-translation' | 'dhcp-configuration' | 'ipv6-pmtu';\n  sourceId: string;");
replaceOnce(challenges,
"  destinationId: string;\n}\n\nexport interface BuilderChallenge {",
"  destinationId: string;\n  packetBytes?: number;\n}\n\nexport interface BuilderChallenge {");
replaceOnce(challenges,
"  success?: boolean | null;\n  repaired: boolean;",
"  success?: boolean | null;\n  requestedBytes?: number | null;\n  effectiveBytes?: number | null;\n  pathMtuBytes?: number | null;\n  ndResolutionCount?: number | null;\n  repaired: boolean;");

replaceOnce(challenges,
"export function createBuilderChallenge(seedInput: string): BuilderChallenge {",
String.raw`export function createIpv6PmtuChallenge(seedInput: string): BuilderChallenge {
  const seed = normalizeSeed(seedInput);
  const hash = hashSeed(seed);
  const healthy = defaultHealthySnapshot();
  healthy.sourceId = 'client';
  healthy.destinationId = 'app';
  healthy.ipv6 = setBuilderOspfv3Everywhere(healthy.graph, healthy.addressing, healthy.ipv6, true);
  const candidates = [
    { linkId: 'edge-r1', nodeId: 'edge' },
    { linkId: 'r1-core', nodeId: 'r1' },
    { linkId: 'core-app', nodeId: 'core' },
  ];
  const target = candidates[hash % candidates.length];
  const healthyProfile = healthy.linkProfiles[target.linkId];
  if (!healthyProfile || healthyProfile.mtuBytes !== 1500) throw new Error('The PMTU challenge requires the canonical 1500-byte routed-link baseline.');
  const broken = createBuilderAuthoringSnapshot(healthy);
  broken.linkProfiles = updateBuilderLinkProfile(broken.graph, broken.linkProfiles, target.linkId, { mtuBytes: 1280 });
  return {
    schema: BUILDER_CHALLENGE_SCHEMA,
    version: BUILDER_CHALLENGE_VERSION,
    id: 'mtu-' + hash.toString(16).padStart(8, '0'),
    seed,
    family: 'ipv6-pmtu',
    title: 'IPV6 PATH MTU SHRINKS',
    objective: 'Restore full 1500-byte IPv6 delivery from CLIENT to APP. Use the ordinary IPv6 probe, Neighbor Discovery / PMTU state, Device Workbench, and selected-link characteristics; repair canonical MTU truth and prove that 1500 bytes are actually transmitted after stale PMTU state is cleared.',
    difficulty: 'FOUNDATION',
    healthy,
    broken,
    verification: { kind: 'ipv6-pmtu', sourceId: 'client', destinationId: 'app', packetBytes: 1500 },
    fault: { kind: 'path-mtu-reduced', boundary: 'TRANSPORT', plane: 'routed', nodeId: target.nodeId, linkId: target.linkId, expectedMtuBytes: 1500, brokenMtuBytes: 1280, packetBytes: 1500 },
  };
}

export function createBuilderChallenge(seedInput: string): BuilderChallenge {`);
replaceOnce(challenges,
"  if (lowered.startsWith('dhcp-')) return createDhcpGatewayChallenge(seed);\n  return createDefaultGatewayChallenge(seed);",
"  if (lowered.startsWith('dhcp-')) return createDhcpGatewayChallenge(seed);\n  if (lowered.startsWith('mtu-') || lowered.startsWith('pmtu-') || lowered.startsWith('ipv6-mtu-')) return createIpv6PmtuChallenge(seed);\n  return createDefaultGatewayChallenge(seed);");
replaceOnce(challenges,
"export function builderChallengeIsRepaired(challenge: BuilderChallenge, addressing: BuilderAddressing, ethernet: BuilderEthernetConfig, routing: BuilderRoutingConfig, acl: BuilderAclConfig = challenge.broken.acl, nat: BuilderNatConfig = challenge.broken.nat, dhcp: BuilderDhcpConfig = challenge.broken.dhcp): boolean {",
"export function builderChallengeIsRepaired(challenge: BuilderChallenge, addressing: BuilderAddressing, ethernet: BuilderEthernetConfig, routing: BuilderRoutingConfig, acl: BuilderAclConfig = challenge.broken.acl, nat: BuilderNatConfig = challenge.broken.nat, dhcp: BuilderDhcpConfig = challenge.broken.dhcp, linkProfiles: BuilderLinkProfiles = challenge.broken.linkProfiles): boolean {");
replaceOnce(challenges,
"  const pool = dhcp.pools.find((entry) => entry.id === fault.poolId && entry.serverDeviceId === fault.nodeId);\n  return pool?.gateway === fault.expectedGateway;",
"  if (fault.kind === 'dhcp-gateway-option-missing') {\n    const pool = dhcp.pools.find((entry) => entry.id === fault.poolId && entry.serverDeviceId === fault.nodeId);\n    return pool?.gateway === fault.expectedGateway;\n  }\n  return linkProfiles[fault.linkId]?.mtuBytes === fault.expectedMtuBytes;");
replaceOnce(challenges,
"  if (fault.kind === 'nat-boundary-disabled') return `${fault.nodeId.toUpperCase()} had the canonical NAT boundary disabled. Re-enabling it restored PAT translation; the post-repair NAT flow proved the tuple was translated rather than merely routed.`;\n  return `${fault.nodeId.toUpperCase()} ACKed the DHCP lease without a default-gateway option. Restoring ${fault.expectedGateway} to the canonical pool and reacquiring produced a configuration-ready lease.`;",
"  if (fault.kind === 'nat-boundary-disabled') return `${fault.nodeId.toUpperCase()} had the canonical NAT boundary disabled. Re-enabling it restored PAT translation; the post-repair NAT flow proved the tuple was translated rather than merely routed.`;\n  if (fault.kind === 'dhcp-gateway-option-missing') return `${fault.nodeId.toUpperCase()} ACKed the DHCP lease without a default-gateway option. Restoring ${fault.expectedGateway} to the canonical pool and reacquiring produced a configuration-ready lease.`;\n  return `${fault.linkId.toUpperCase()} was reduced to MTU ${fault.brokenMtuBytes}. Restoring MTU ${fault.expectedMtuBytes}, clearing stale PMTU state, and retransmitting ${fault.packetBytes} bytes proved full-size IPv6 delivery while Neighbor Discovery remained healthy.`;");
replaceOnce(challenges,
"  dhcp: BuilderDhcpConfig = challenge.broken.dhcp,\n): BuilderChallengeScore {",
"  dhcp: BuilderDhcpConfig = challenge.broken.dhcp,\n  linkProfiles: BuilderLinkProfiles = challenge.broken.linkProfiles,\n): BuilderChallengeScore {");
replaceOnce(challenges,
"  } else {\n    const incompleteConfiguration = hasEvidence(evidence, (entry) => entry.kind === 'dhcp-transaction' && isObjectiveEvidence(challenge, entry) && entry.success === false && !entry.repaired);\n    evidenceScore = (incompleteConfiguration ? 20 : 0) + (inspectedState ? 10 : 0) + (inspectedConfig ? 10 : 0);\n    hasPrimaryDiagnostic = incompleteConfiguration;\n  }",
"  } else if (challenge.verification.kind === 'ipv6-pmtu') {\n    const packetBytes = challenge.verification.packetBytes ?? 1500;\n    const packetTooBig = hasEvidence(evidence, (entry) => (entry.kind === 'ping' || entry.kind === 'traceroute') && isObjectiveEvidence(challenge, entry) && entry.success === false && !entry.repaired && entry.pathMtuBytes != null && entry.pathMtuBytes < packetBytes);\n    const observedNd = hasEvidence(evidence, (entry) => entry.kind === 'ipv6-nd' && isObjectiveEvidence(challenge, entry) && entry.success === true && !entry.repaired);\n    evidenceScore = (packetTooBig ? 15 : 0) + (observedNd ? 5 : 0) + (inspectedState ? 10 : 0) + (inspectedConfig ? 10 : 0);\n    hasPrimaryDiagnostic = packetTooBig;\n  } else {\n    const incompleteConfiguration = hasEvidence(evidence, (entry) => entry.kind === 'dhcp-transaction' && isObjectiveEvidence(challenge, entry) && entry.success === false && !entry.repaired);\n    evidenceScore = (incompleteConfiguration ? 20 : 0) + (inspectedState ? 10 : 0) + (inspectedConfig ? 10 : 0);\n    hasPrimaryDiagnostic = incompleteConfiguration;\n  }");
replaceOnce(challenges,
"  const repaired = builderChallengeIsRepaired(challenge, addressing, ethernet, routing, acl, nat, dhcp);",
"  const repaired = builderChallengeIsRepaired(challenge, addressing, ethernet, routing, acl, nat, dhcp, linkProfiles);");
replaceOnce(challenges,
"      : challenge.verification.kind === 'nat-translation'\n        ? hasEvidence(evidence, (entry) => entry.kind === 'nat-flow' && isObjectiveEvidence(challenge, entry) && entry.success === true && entry.repaired)\n        : hasEvidence(evidence, (entry) => entry.kind === 'dhcp-transaction' && isObjectiveEvidence(challenge, entry) && entry.success === true && entry.repaired);",
"      : challenge.verification.kind === 'nat-translation'\n        ? hasEvidence(evidence, (entry) => entry.kind === 'nat-flow' && isObjectiveEvidence(challenge, entry) && entry.success === true && entry.repaired)\n        : challenge.verification.kind === 'ipv6-pmtu'\n          ? hasEvidence(evidence, (entry) => (entry.kind === 'ping' || entry.kind === 'traceroute') && isObjectiveEvidence(challenge, entry) && entry.success === true && entry.repaired && entry.requestedBytes === (challenge.verification.packetBytes ?? 1500) && entry.effectiveBytes === (challenge.verification.packetBytes ?? 1500))\n          : hasEvidence(evidence, (entry) => entry.kind === 'dhcp-transaction' && isObjectiveEvidence(challenge, entry) && entry.success === true && entry.repaired);");

const panel='src/BuilderChallengePanel.tsx';
replaceOnce(panel,
"  if (entry.kind === 'dhcp-transaction') return 'DHCP DORA';",
"  if (entry.kind === 'dhcp-transaction') return 'DHCP DORA';\n  if (entry.kind === 'ipv6-nd') return 'IPV6 ND';");
replaceOnce(panel,
"          : verificationKind === 'nat-translation'\n            ? 'Run the ordinary NAT RUN OUTBOUND tool and inspect CONFIG / STATE / EVENTS in Device Workbench. A delivered but untranslated tuple is still a failed objective. Repair the canonical NAT boundary, then rerun the same outbound flow to prove PAT translation.'\n            : 'Run the ordinary DHCP DORA / ACQUIRE flow and inspect CONFIG / STATE / EVENTS in Device Workbench. An ACK with incomplete options is failed objective evidence. Repair the pool default-gateway option, then reacquire a configuration-ready lease.'}</p>",
"          : verificationKind === 'nat-translation'\n            ? 'Run the ordinary NAT RUN OUTBOUND tool and inspect CONFIG / STATE / EVENTS in Device Workbench. A delivered but untranslated tuple is still a failed objective. Repair the canonical NAT boundary, then rerun the same outbound flow to prove PAT translation.'\n            : verificationKind === 'ipv6-pmtu'\n              ? 'Run the ordinary IPv6 Ping / Traceroute at the challenge packet size. Use NS/NA plus Packet Too Big / PMTU state to separate healthy neighbor resolution from the MTU failure, inspect CONFIG / STATE / EVENTS, repair the selected routed-link MTU, clear stale PMTU cache, then prove the same full-size packet is actually transmitted.'\n              : 'Run the ordinary DHCP DORA / ACQUIRE flow and inspect CONFIG / STATE / EVENTS in Device Workbench. An ACK with incomplete options is failed objective evidence. Repair the pool default-gateway option, then reacquire a configuration-ready lease.'}</p>");

const workbench='src/builder/device-workbench.ts';
replaceOnce(workbench,
"import type { BuilderGraph } from './model.ts';\n",
"import type { BuilderGraph } from './model.ts';\nimport type { BuilderLinkProfiles } from './link-characteristics.ts';\n");
replaceOnce(workbench,
"  graph: BuilderGraph;\n  truthGraphs?: BuilderWorkbenchTruthGraphs;",
"  graph: BuilderGraph;\n  linkProfiles?: BuilderLinkProfiles;\n  truthGraphs?: BuilderWorkbenchTruthGraphs;");
replaceOnce(workbench,
"  const ipv4=interfacesForBuilderNode(input.addressing,deviceId).map((entry)=>row(`cfg4:${entry.linkId}`,'IPV4 INTERFACE',`${entry.name} · ${entry.address}`,`${input.addressing.segments[entry.linkId]?.cidr??'—'} · ${entry.linkId} · ${linkState(input.graph,entry.linkId)}`,linkState(input.graph,entry.linkId)==='UP'?'good':'bad',[why(`cfg4:${entry.linkId}:why`,'CONFIG','INTERFACE ADDRESS',`${entry.address} is canonical scenario configuration on ${entry.name}.`),why(`cfg4:${entry.linkId}:topology`,'TOPOLOGY',`LINK ${linkState(input.graph,entry.linkId)}`,`${entry.linkId} supplies physical adjacency.`)]));",
"  const ipv4=interfacesForBuilderNode(input.addressing,deviceId).map((entry)=>{const profile=input.linkProfiles?.[entry.linkId];return row(`cfg4:${entry.linkId}`,'IPV4 INTERFACE',`${entry.name} · ${entry.address}`,`${input.addressing.segments[entry.linkId]?.cidr??'—'} · ${entry.linkId} · ${linkState(input.graph,entry.linkId)}${profile?` · MTU ${profile.mtuBytes} · ${profile.bandwidthMbps} Mb/s`:''}`,linkState(input.graph,entry.linkId)==='UP'?'good':'bad',[why(`cfg4:${entry.linkId}:why`,'CONFIG','INTERFACE ADDRESS',`${entry.address} is canonical scenario configuration on ${entry.name}.`),...(profile?[why(`cfg4:${entry.linkId}:profile`,'CONFIG','LINK CHARACTERISTICS',`MTU ${profile.mtuBytes} · latency ${profile.latencyMs} ms · jitter ${profile.jitterMs} ms · loss ${profile.lossPercent}% · queue ${profile.queuePackets}.`)]:[]),why(`cfg4:${entry.linkId}:topology`,'TOPOLOGY',`LINK ${linkState(input.graph,entry.linkId)}`,`${entry.linkId} supplies physical adjacency.`)]);});");
replaceOnce(workbench,
"  const ipv6=input.ipv6.enabled?interfacesForBuilderNodeIpv6(input.ipv6.addressing,deviceId).map((entry)=>row(`cfg6:${entry.linkId}`,'IPV6 INTERFACE',`${entry.name} · ${entry.globalAddress}`,`${entry.prefix} · LL ${entry.linkLocalAddress} · ${entry.addressOrigin.toUpperCase()}`,linkState(input.graph,entry.linkId)==='UP'?'good':'bad',[why(`cfg6:${entry.linkId}:why`,'CONFIG',`ADDRESS ORIGIN · ${entry.addressOrigin.toUpperCase()}`,`${entry.globalAddress} and ${entry.linkLocalAddress} belong to canonical IPv6 interface configuration.`)])):[];",
"  const ipv6=input.ipv6.enabled?interfacesForBuilderNodeIpv6(input.ipv6.addressing,deviceId).map((entry)=>{const profile=input.linkProfiles?.[entry.linkId];return row(`cfg6:${entry.linkId}`,'IPV6 INTERFACE',`${entry.name} · ${entry.globalAddress}`,`${entry.prefix} · LL ${entry.linkLocalAddress} · ${entry.addressOrigin.toUpperCase()}${profile?` · MTU ${profile.mtuBytes}`:''}`,linkState(input.graph,entry.linkId)==='UP'?'good':'bad',[why(`cfg6:${entry.linkId}:why`,'CONFIG',`ADDRESS ORIGIN · ${entry.addressOrigin.toUpperCase()}`,`${entry.globalAddress} and ${entry.linkLocalAddress} belong to canonical IPv6 interface configuration.`),...(profile?[why(`cfg6:${entry.linkId}:profile`,'CONFIG','LINK MTU',`This routed link is configured for MTU ${profile.mtuBytes}; IPv6 transit routers do not fragment packets.`)]:[])]);})) : [];");

const builder='src/NetworkBuilder.tsx';
replaceOnce(builder,
"const liveWorkbenchInput = useMemo<BuilderDeviceWorkbenchInput>(() => ({ graph, addressing, routing, ipv6, ipv6ControlState, ipv6RoutingDepth, ethernet, ethernetFlow, arpCache, arpResolutions, acl, nat, natSessions, dhcp, dhcpLeases, dhcpSequence, probeHistory, applicationHistory, applicationStageOrder:null, sourceId, destinationId, events: workbenchEvents }), [graph, addressing, routing, ipv6, ipv6ControlState, ipv6RoutingDepth, ethernet, ethernetFlow, arpCache, arpResolutions, acl, nat, natSessions, dhcp, dhcpLeases, dhcpSequence, probeHistory, applicationHistory, sourceId, destinationId, workbenchEvents]);",
"const liveWorkbenchInput = useMemo<BuilderDeviceWorkbenchInput>(() => ({ graph, linkProfiles, addressing, routing, ipv6, ipv6ControlState, ipv6RoutingDepth, ethernet, ethernetFlow, arpCache, arpResolutions, acl, nat, natSessions, dhcp, dhcpLeases, dhcpSequence, probeHistory, applicationHistory, applicationStageOrder:null, sourceId, destinationId, events: workbenchEvents }), [graph, linkProfiles, addressing, routing, ipv6, ipv6ControlState, ipv6RoutingDepth, ethernet, ethernetFlow, arpCache, arpResolutions, acl, nat, natSessions, dhcp, dhcpLeases, dhcpSequence, probeHistory, applicationHistory, sourceId, destinationId, workbenchEvents]);");
replaceOnce(builder,
"const challengeScore = useMemo(() => challenge ? scoreBuilderChallenge(challenge, challengeEvidence, challengeHypothesis, addressing, ethernet, routing, acl, nat, dhcp) : null, [challenge, challengeEvidence, challengeHypothesis, addressing, ethernet, routing, acl, nat, dhcp]);",
"const challengeScore = useMemo(() => challenge ? scoreBuilderChallenge(challenge, challengeEvidence, challengeHypothesis, addressing, ethernet, routing, acl, nat, dhcp, linkProfiles) : null, [challenge, challengeEvidence, challengeHypothesis, addressing, ethernet, routing, acl, nat, dhcp, linkProfiles]);");
replaceAll(builder,
"builderChallengeIsRepaired(challenge,addressing,ethernet,routing,acl,nat,dhcp)",
"builderChallengeIsRepaired(challenge,addressing,ethernet,routing,acl,nat,dhcp,linkProfiles)");
replaceAll(builder,
"builderChallengeIsRepaired(challenge, addressing, ethernet, routing, acl, nat, dhcp)",
"builderChallengeIsRepaired(challenge, addressing, ethernet, routing, acl, nat, dhcp, linkProfiles)");
replaceOnce(builder,
String.raw`    if (challenge && probeFamily === 'ipv4' && !isHistorical) {
      const repaired = builderChallengeIsRepaired(challenge, addressing, ethernet, routing, acl, nat, dhcp, linkProfiles);
      setChallengeEvidence((current) => appendBuilderChallengeEvidence(current, { kind, sourceId, destinationId, success: result.success, repaired, detail: result.summary }));
    }`,
String.raw`    if (challenge && probeFamily === 'ipv4' && !isHistorical) {
      const repaired = builderChallengeIsRepaired(challenge, addressing, ethernet, routing, acl, nat, dhcp, linkProfiles);
      setChallengeEvidence((current) => appendBuilderChallengeEvidence(current, { kind, sourceId, destinationId, success: result.success, repaired, detail: result.summary }));
    } else if (challenge && probeFamily === 'ipv6' && challenge.verification.kind === 'ipv6-pmtu' && !isHistorical) {
      const ipv6Result = result as ReturnType<typeof runBuilderIpv6Probe>;
      const repaired = builderChallengeIsRepaired(challenge, addressing, ethernet, routing, acl, nat, dhcp, linkProfiles);
      const ndAdded = Math.max(0, ipv6Result.ipv6ControlState.ndHistory.length - ipv6ControlState.ndHistory.length);
      const pmtuAdded = ipv6Result.ipv6ControlState.pmtuHistory.length > ipv6ControlState.pmtuHistory.length ? ipv6Result.ipv6ControlState.pmtuHistory.at(-1) ?? null : null;
      const pathMtuBytes = pmtuAdded?.mtuBytes ?? ipv6Result.attempts.at(-1)?.pathMtuBytes ?? null;
      setChallengeEvidence((current) => {
        let next = appendBuilderChallengeEvidence(current, { kind, sourceId, destinationId, success: ipv6Result.success, requestedBytes: ipv6Result.requestedPacketBytes, effectiveBytes: ipv6Result.effectivePacketBytes, pathMtuBytes, repaired, detail: ipv6Result.summary });
        if (ndAdded > 0) next = appendBuilderChallengeEvidence(next, { kind:'ipv6-nd', sourceId, destinationId, success:true, ndResolutionCount:ndAdded, repaired, detail:'Neighbor Discovery completed ' + ndAdded + ' next-hop NS/NA observation' + (ndAdded===1?'':'s') + '; L2 neighbor resolution is not the failing boundary.' });
        return next;
      });
    }`);
replaceOnce(builder,
"if(next.verification.kind==='ethernet-flow'){setEthernetSourceId(next.verification.sourceId);setEthernetDestinationId(next.verification.destinationId);setWorkbenchDevice({plane:'ethernet',id:next.fault.nodeId});if('linkId' in next.fault)setSelectedEthernetLinkId(next.fault.linkId);}else if(next.verification.kind==='dhcp-configuration'){setWorkbenchDevice({plane:'ethernet',id:next.verification.sourceId});}else{setSourceId(next.verification.sourceId);setDestinationId(next.verification.destinationId);setWorkbenchDevice({plane:'routed',id:next.verification.sourceId});setSelectedNodeId(next.verification.sourceId);}",
"if(next.verification.kind==='ethernet-flow'){setEthernetSourceId(next.verification.sourceId);setEthernetDestinationId(next.verification.destinationId);setWorkbenchDevice({plane:'ethernet',id:next.fault.nodeId});if('linkId' in next.fault)setSelectedEthernetLinkId(next.fault.linkId);}else if(next.verification.kind==='dhcp-configuration'){setWorkbenchDevice({plane:'ethernet',id:next.verification.sourceId});}else if(next.verification.kind==='ipv6-pmtu'){setSourceId(next.verification.sourceId);setDestinationId(next.verification.destinationId);setProbeFamily('ipv6');setIpv6ProbePacketBytes(next.verification.packetBytes??1500);setWorkbenchDevice({plane:'routed',id:next.fault.nodeId});setSelectedNodeId(next.fault.nodeId);if('linkId' in next.fault)setSelectedLinkId(next.fault.linkId);}else{setSourceId(next.verification.sourceId);setDestinationId(next.verification.destinationId);setWorkbenchDevice({plane:'routed',id:next.verification.sourceId});setSelectedNodeId(next.verification.sourceId);}");
replaceOnce(builder,
"if(challenge.verification.kind==='ethernet-flow'){setEthernetSourceId(challenge.verification.sourceId);setEthernetDestinationId(challenge.verification.destinationId);setWorkbenchDevice({plane:'ethernet',id:challenge.fault.nodeId});if('linkId' in challenge.fault)setSelectedEthernetLinkId(challenge.fault.linkId);}else if(challenge.verification.kind==='dhcp-configuration'){setWorkbenchDevice({plane:'ethernet',id:challenge.verification.sourceId});}else{setSourceId(challenge.verification.sourceId);setDestinationId(challenge.verification.destinationId);setWorkbenchDevice({plane:'routed',id:challenge.verification.sourceId});setSelectedNodeId(challenge.verification.sourceId);}",
"if(challenge.verification.kind==='ethernet-flow'){setEthernetSourceId(challenge.verification.sourceId);setEthernetDestinationId(challenge.verification.destinationId);setWorkbenchDevice({plane:'ethernet',id:challenge.fault.nodeId});if('linkId' in challenge.fault)setSelectedEthernetLinkId(challenge.fault.linkId);}else if(challenge.verification.kind==='dhcp-configuration'){setWorkbenchDevice({plane:'ethernet',id:challenge.verification.sourceId});}else if(challenge.verification.kind==='ipv6-pmtu'){setSourceId(challenge.verification.sourceId);setDestinationId(challenge.verification.destinationId);setProbeFamily('ipv6');setIpv6ProbePacketBytes(challenge.verification.packetBytes??1500);setWorkbenchDevice({plane:'routed',id:challenge.fault.nodeId});setSelectedNodeId(challenge.fault.nodeId);if('linkId' in challenge.fault)setSelectedLinkId(challenge.fault.linkId);}else{setSourceId(challenge.verification.sourceId);setDestinationId(challenge.verification.destinationId);setWorkbenchDevice({plane:'routed',id:challenge.verification.sourceId});setSelectedNodeId(challenge.verification.sourceId);}");
replaceOnce(builder,
"<button type=\"button\" onClick={()=>setChallengeSeed('dhcp-001')}>DHCP</button>",
"<button type=\"button\" onClick={()=>setChallengeSeed('dhcp-001')}>DHCP</button><button type=\"button\" onClick={()=>setChallengeSeed('mtu-001')}>IPV6 MTU</button>");
replaceOnce(builder,
"SEED PREFIX SELECTS FAMILY · GATEWAY / VLAN / TRUNK / STP / STATIC / OSPF / ACL / NAT / DHCP · NORMAL BUILDER PROBES, LAN FLOW, NAT FLOW, DHCP DORA, POLICY/ROUTE STATE, WORKBENCH, AND CONFIG CONTROLS · SESSION-ONLY SCORE.",
"SEED PREFIX SELECTS FAMILY · GATEWAY / VLAN / TRUNK / STP / STATIC / OSPF / ACL / NAT / DHCP / IPV6 MTU · NORMAL BUILDER PROBES, ARP/ND, LAN FLOW, NAT FLOW, DHCP DORA, PMTUD, POLICY/ROUTE STATE, WORKBENCH, AND CONFIG CONTROLS · SESSION-ONLY SCORE.");

const contract='scripts/builder-challenge-contract-check.mjs';
replaceOnce(contract,
"  createDhcpGatewayChallenge,\n  createMissingStaticRouteChallenge,",
"  createDhcpGatewayChallenge,\n  createIpv6PmtuChallenge,\n  createMissingStaticRouteChallenge,");
replaceOnce(contract,
"import { runBuilderDhcpAcquire, upsertBuilderDhcpPool } from '../src/builder/dhcp.ts';\n",
"import { runBuilderDhcpAcquire, upsertBuilderDhcpPool } from '../src/builder/dhcp.ts';\nimport { clearBuilderIpv6PmtuCache, createBuilderIpv6ControlState } from '../src/builder/ipv6-control-plane.ts';\nimport { runBuilderIpv6Probe } from '../src/builder/ipv6-probes.ts';\nimport { updateBuilderLinkProfile } from '../src/builder/link-characteristics.ts';\n");
replaceOnce(contract,
"for (const challenge of [access, trunk, stp, staticRoute, ospf, aclChallenge, natChallenge, dhcpChallenge]) {",
String.raw`const pmtuChallenge=createIpv6PmtuChallenge('mtu-contract-001');
assert.equal(pmtuChallenge.family,'ipv6-pmtu');
assert.equal(pmtuChallenge.fault.kind,'path-mtu-reduced');
assert.deepEqual(pmtuChallenge,createBuilderChallenge('mtu-contract-001'));
const freshIpv6Control=createBuilderIpv6ControlState();
const brokenPmtuProbe=runBuilderIpv6Probe(pmtuChallenge.broken.graph,pmtuChallenge.broken.ipv6,'ping',pmtuChallenge.verification.sourceId,pmtuChallenge.verification.destinationId,1,pmtuChallenge.broken.linkProfiles,[],freshIpv6Control,pmtuChallenge.verification.packetBytes);
assert.equal(brokenPmtuProbe.success,false,'oversized IPv6 objective must trigger PMTUD before delivery');
const ptbEvent=brokenPmtuProbe.ipv6ControlState.pmtuHistory.at(-1);
assert.ok(ptbEvent&&ptbEvent.delivered,'Packet Too Big must return to the source');
assert.equal(ptbEvent.mtuBytes,pmtuChallenge.fault.brokenMtuBytes);
assert.ok(brokenPmtuProbe.ipv6ControlState.ndHistory.length>0,'ordinary IPv6 probe must expose successful ND while PMTU fails');
const repairedProfiles=updateBuilderLinkProfile(pmtuChallenge.broken.graph,pmtuChallenge.broken.linkProfiles,pmtuChallenge.fault.linkId,{mtuBytes:pmtuChallenge.fault.expectedMtuBytes});
assert.deepEqual(repairedProfiles,pmtuChallenge.healthy.linkProfiles,'PMTU challenge changes exactly one canonical link MTU');
assert.equal(builderChallengeIsRepaired(pmtuChallenge,pmtuChallenge.broken.addressing,pmtuChallenge.broken.ethernet,pmtuChallenge.broken.routing,pmtuChallenge.broken.acl,pmtuChallenge.broken.nat,pmtuChallenge.broken.dhcp,pmtuChallenge.broken.linkProfiles),false);
assert.equal(builderChallengeIsRepaired(pmtuChallenge,pmtuChallenge.broken.addressing,pmtuChallenge.broken.ethernet,pmtuChallenge.broken.routing,pmtuChallenge.broken.acl,pmtuChallenge.broken.nat,pmtuChallenge.broken.dhcp,repairedProfiles),true);
let pmtuEvidence=[];
pmtuEvidence=appendBuilderChallengeEvidence(pmtuEvidence,{kind:'ping',sourceId:pmtuChallenge.verification.sourceId,destinationId:pmtuChallenge.verification.destinationId,success:false,requestedBytes:pmtuChallenge.fault.packetBytes,effectiveBytes:pmtuChallenge.fault.packetBytes,pathMtuBytes:ptbEvent.mtuBytes,repaired:false,detail:brokenPmtuProbe.summary});
pmtuEvidence=appendBuilderChallengeEvidence(pmtuEvidence,{kind:'ipv6-nd',sourceId:pmtuChallenge.verification.sourceId,destinationId:pmtuChallenge.verification.destinationId,success:true,ndResolutionCount:brokenPmtuProbe.ipv6ControlState.ndHistory.length,repaired:false,detail:'ND succeeded while PMTU failed.'});
pmtuEvidence=recordInspection(pmtuEvidence,pmtuChallenge,'state');
pmtuEvidence=recordInspection(pmtuEvidence,pmtuChallenge,'config');
const pmtuHypothesis={boundary:'TRANSPORT',deviceId:pmtuChallenge.fault.nodeId};
assert.deepEqual(scoreBuilderChallenge(pmtuChallenge,pmtuEvidence,pmtuHypothesis,pmtuChallenge.broken.addressing,pmtuChallenge.broken.ethernet,pmtuChallenge.broken.routing,pmtuChallenge.broken.acl,pmtuChallenge.broken.nat,pmtuChallenge.broken.dhcp,pmtuChallenge.broken.linkProfiles),{evidence:40,reasoning:20,repair:0,verification:0,total:60,repaired:false,verified:false,solved:false});
assert.equal(scoreBuilderChallenge(pmtuChallenge,pmtuEvidence,pmtuHypothesis,pmtuChallenge.broken.addressing,pmtuChallenge.broken.ethernet,pmtuChallenge.broken.routing,pmtuChallenge.broken.acl,pmtuChallenge.broken.nat,pmtuChallenge.broken.dhcp,repairedProfiles).total,85);
const cachedAfterRepair=runBuilderIpv6Probe(pmtuChallenge.broken.graph,pmtuChallenge.broken.ipv6,'ping',pmtuChallenge.verification.sourceId,pmtuChallenge.verification.destinationId,2,repairedProfiles,[],brokenPmtuProbe.ipv6ControlState,pmtuChallenge.verification.packetBytes);
assert.equal(cachedAfterRepair.success,true,'repaired link can carry the PMTU-constrained retry');
assert.equal(cachedAfterRepair.effectivePacketBytes,pmtuChallenge.fault.brokenMtuBytes,'stale PMTU cache must keep constraining the retry until cleared');
pmtuEvidence=appendBuilderChallengeEvidence(pmtuEvidence,{kind:'ping',sourceId:pmtuChallenge.verification.sourceId,destinationId:pmtuChallenge.verification.destinationId,success:true,requestedBytes:cachedAfterRepair.requestedPacketBytes,effectiveBytes:cachedAfterRepair.effectivePacketBytes,pathMtuBytes:cachedAfterRepair.attempts.at(-1)?.pathMtuBytes??null,repaired:true,detail:cachedAfterRepair.summary});
assert.equal(scoreBuilderChallenge(pmtuChallenge,pmtuEvidence,pmtuHypothesis,pmtuChallenge.broken.addressing,pmtuChallenge.broken.ethernet,pmtuChallenge.broken.routing,pmtuChallenge.broken.acl,pmtuChallenge.broken.nat,pmtuChallenge.broken.dhcp,repairedProfiles).verified,false,'a cached 1280-byte retry cannot verify 1500-byte delivery');
const clearedPmtu=clearBuilderIpv6PmtuCache(cachedAfterRepair.ipv6ControlState);
const fullSizeAfterRepair=runBuilderIpv6Probe(pmtuChallenge.broken.graph,pmtuChallenge.broken.ipv6,'ping',pmtuChallenge.verification.sourceId,pmtuChallenge.verification.destinationId,3,repairedProfiles,[],clearedPmtu,pmtuChallenge.verification.packetBytes);
assert.equal(fullSizeAfterRepair.success,true);
assert.equal(fullSizeAfterRepair.effectivePacketBytes,pmtuChallenge.fault.packetBytes);
pmtuEvidence=appendBuilderChallengeEvidence(pmtuEvidence,{kind:'ping',sourceId:pmtuChallenge.verification.sourceId,destinationId:pmtuChallenge.verification.destinationId,success:true,requestedBytes:fullSizeAfterRepair.requestedPacketBytes,effectiveBytes:fullSizeAfterRepair.effectivePacketBytes,pathMtuBytes:fullSizeAfterRepair.attempts.at(-1)?.pathMtuBytes??null,repaired:true,detail:fullSizeAfterRepair.summary});
assert.deepEqual(scoreBuilderChallenge(pmtuChallenge,pmtuEvidence,pmtuHypothesis,pmtuChallenge.broken.addressing,pmtuChallenge.broken.ethernet,pmtuChallenge.broken.routing,pmtuChallenge.broken.acl,pmtuChallenge.broken.nat,pmtuChallenge.broken.dhcp,repairedProfiles),{evidence:40,reasoning:20,repair:25,verification:15,total:100,repaired:true,verified:true,solved:true});

for (const challenge of [access, trunk, stp, staticRoute, ospf, aclChallenge, natChallenge, dhcpChallenge, pmtuChallenge]) {`);
replaceOnce(contract,
"console.log('Builder Track J challenge contract passed: gateway plus seeded access-VLAN, trunk-pruning, STP-loop, missing-static-route, OSPF-disabled, ACL-deny, NAT-disabled, and DHCP-gateway faults use canonical truth, ordinary probes/LAN+ARP/NAT/DHCP evidence, exact repair, objective-scoped verification, causal scoring, and reproducible tokens.');",
"console.log('Builder Track J challenge contract passed: gateway plus seeded access-VLAN, trunk-pruning, STP-loop, missing-static-route, OSPF-disabled, ACL-deny, NAT-disabled, DHCP-gateway, and IPv6-PMTU faults use canonical truth, ordinary probes/LAN+ARP/NAT/DHCP/ND+PMTUD evidence, exact repair, objective-scoped verification, causal scoring, and reproducible tokens.');");

const docs='docs/TRACKJ.md';
const marker='## MTU / PMTUD + neighbor-resolution slice';
if(!read(docs).includes(marker))write(docs,read(docs)+String.raw`

## MTU / PMTUD + neighbor-resolution slice

The `mtu-*` / `pmtu-*` family adds the first IPv6 data-plane troubleshooting challenge without adding a second simulator. The healthy baseline enables the existing OSPFv3 path from CLIENT to APP. The broken snapshot changes exactly one canonical routed-link characteristic: a 1500-byte MTU becomes 1280 bytes on one deterministic path link.

The objective deliberately distinguishes **reachability** from **full-size delivery**. A 1500-byte IPv6 Ping first performs ordinary Neighbor Discovery, reaches the constraining hop, receives ICMPv6 Packet Too Big, and caches PMTU 1280. That failed full-size probe plus observed NS/NA exchanges are challenge evidence: successful ND narrows the fault above neighbor resolution instead of being treated as noise. After the canonical MTU is restored, a retry can still succeed at only 1280 bytes because the PMTU cache is session state. Verification therefore requires clearing stale PMTU state and proving that the requested 1500 bytes are also the effective transmitted size.

Device Workbench now projects routed-link MTU and physical characteristics beside interface configuration so the challenged link can be inspected through the same CONFIG surface used by the rest of Track J. The existing access-VLAN, trunk, and STP families continue to use ordinary ARP observations as Layer-2 evidence. No standalone ND-only failure is fabricated in this slice: current canonical IPv6 configuration does not expose a truthful independent ND failure knob beyond route/link/addressing faults already represented elsewhere.
`);

console.log('Applied Track J IPv6 PMTU + neighbor-resolution challenge slice.');
