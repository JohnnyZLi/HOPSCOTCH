import fs from 'node:fs';

function patch(path, transform) {
  const before = fs.readFileSync(path, 'utf8');
  const after = transform(before);
  if (after === before) throw new Error('No changes produced for ' + path);
  fs.writeFileSync(path, after);
}

function replaceOne(text, from, to, label) {
  const first = text.indexOf(from);
  if (first < 0) throw new Error('Missing patch anchor: ' + label);
  if (text.indexOf(from, first + from.length) >= 0) throw new Error('Patch anchor is not unique: ' + label);
  return text.slice(0, first) + to + text.slice(first + from.length);
}

patch('src/builder/challenges.ts', (input) => {
  let text = input;
  text = replaceOne(text,
    "import { validateBuilderEthernetConfig, type BuilderEthernetConfig } from './ethernet.ts';\nimport { validateBuilderNatConfig, type BuilderNatConfig } from './nat.ts';",
    "import { setBuilderDhcpClient, upsertBuilderDhcpPool, type BuilderDhcpConfig } from './dhcp.ts';\nimport { validateBuilderEthernetConfig, type BuilderEthernetConfig } from './ethernet.ts';\nimport { validateBuilderNatConfig, type BuilderNatConfig } from './nat.ts';",
    'DHCP import');
  text = replaceOne(text,
    "export type BuilderChallengeEvidenceKind = 'ping' | 'traceroute' | 'ethernet-flow' | 'arp-resolution' | 'nat-flow' | 'inspect-config' | 'inspect-state' | 'inspect-events';\nexport type BuilderChallengeFamily = 'gateway' | 'access-vlan' | 'trunk-vlan' | 'stp-loop' | 'static-route' | 'ospf-disabled' | 'acl-deny' | 'nat-disabled';",
    "export type BuilderChallengeEvidenceKind = 'ping' | 'traceroute' | 'ethernet-flow' | 'arp-resolution' | 'nat-flow' | 'dhcp-transaction' | 'inspect-config' | 'inspect-state' | 'inspect-events';\nexport type BuilderChallengeFamily = 'gateway' | 'access-vlan' | 'trunk-vlan' | 'stp-loop' | 'static-route' | 'ospf-disabled' | 'acl-deny' | 'nat-disabled' | 'dhcp-gateway';",
    'DHCP evidence/family');
  text = replaceOne(text,
    "export interface BuilderNatDisabledChallengeFault {\n  kind: 'nat-boundary-disabled';\n  boundary: 'POLICY';\n  plane: 'routed';\n  nodeId: string;\n  boundaryId: string;\n  expectedEnabled: true;\n}\n\nexport type BuilderChallengeFault = BuilderGatewayChallengeFault | BuilderAccessVlanChallengeFault | BuilderTrunkVlanChallengeFault | BuilderStpChallengeFault | BuilderStaticRouteChallengeFault | BuilderOspfDisabledChallengeFault | BuilderAclDenyChallengeFault | BuilderNatDisabledChallengeFault;\n\nexport interface BuilderChallengeVerification {\n  kind: 'routed-probe' | 'ethernet-flow' | 'nat-translation';",
    "export interface BuilderNatDisabledChallengeFault {\n  kind: 'nat-boundary-disabled';\n  boundary: 'POLICY';\n  plane: 'routed';\n  nodeId: string;\n  boundaryId: string;\n  expectedEnabled: true;\n}\n\nexport interface BuilderDhcpGatewayChallengeFault {\n  kind: 'dhcp-gateway-option-missing';\n  boundary: 'ADDRESSING';\n  plane: 'ethernet';\n  nodeId: string;\n  poolId: string;\n  clientDeviceId: string;\n  expectedGateway: string;\n}\n\nexport type BuilderChallengeFault = BuilderGatewayChallengeFault | BuilderAccessVlanChallengeFault | BuilderTrunkVlanChallengeFault | BuilderStpChallengeFault | BuilderStaticRouteChallengeFault | BuilderOspfDisabledChallengeFault | BuilderAclDenyChallengeFault | BuilderNatDisabledChallengeFault | BuilderDhcpGatewayChallengeFault;\n\nexport interface BuilderChallengeVerification {\n  kind: 'routed-probe' | 'ethernet-flow' | 'nat-translation' | 'dhcp-configuration';",
    'DHCP fault/verification');

  const generator = [
    "export function createDhcpGatewayChallenge(seedInput: string): BuilderChallenge {",
    "  const seed = normalizeSeed(seedInput);",
    "  const hash = hashSeed(seed);",
    "  const healthy = defaultHealthySnapshot();",
    "  const clientDeviceId = 'lan-a';",
    "  const pool = healthy.dhcp.pools.find((entry) => entry.id === 'dhcp-lan-r1-v10');",
    "  if (!pool || !pool.gateway) throw new Error('The DHCP challenge requires the canonical VLAN 10 pool with a default gateway.');",
    "  healthy.dhcp = setBuilderDhcpClient(healthy.ethernet, healthy.dhcp, clientDeviceId, true);",
    "  const expectedGateway = pool.gateway;",
    "  const broken = createBuilderAuthoringSnapshot(healthy);",
    "  const brokenPool = broken.dhcp.pools.find((entry) => entry.id === pool.id);",
    "  if (!brokenPool) throw new Error('The DHCP challenge pool disappeared while cloning canonical truth.');",
    "  broken.dhcp = upsertBuilderDhcpPool(broken.ethernet, broken.dhcp, { ...brokenPool, gateway: null });",
    "  return {",
    "    schema: BUILDER_CHALLENGE_SCHEMA, version: BUILDER_CHALLENGE_VERSION, id: 'dhcp-' + hash.toString(16).padStart(8, '0'), seed, family: 'dhcp-gateway',",
    "    title: 'DHCP ACK MISSES THE GATEWAY',",
    "    objective: 'Restore a complete DHCP configuration for PC-A. DORA may still ACK an address; use the ordinary DHCP transaction, pool config, and Device Workbench to identify the missing default-gateway option, repair it, and reacquire a configuration-ready lease.',",
    "    difficulty: 'FOUNDATION', healthy, broken, verification: { kind: 'dhcp-configuration', sourceId: clientDeviceId, destinationId: pool.serverDeviceId },",
    "    fault: { kind: 'dhcp-gateway-option-missing', boundary: 'ADDRESSING', plane: 'ethernet', nodeId: pool.serverDeviceId, poolId: pool.id, clientDeviceId, expectedGateway },",
    "  };",
    "}",
    ""
  ].join('\n');
  text = replaceOne(text, "export function createBuilderChallenge(seedInput: string): BuilderChallenge {", generator + "\nexport function createBuilderChallenge(seedInput: string): BuilderChallenge {", 'DHCP generator');
  text = replaceOne(text,
    "  if (lowered.startsWith('nat-') || lowered.startsWith('pat-')) return createNatDisabledChallenge(seed);\n  return createDefaultGatewayChallenge(seed);",
    "  if (lowered.startsWith('nat-') || lowered.startsWith('pat-')) return createNatDisabledChallenge(seed);\n  if (lowered.startsWith('dhcp-')) return createDhcpGatewayChallenge(seed);\n  return createDefaultGatewayChallenge(seed);",
    'DHCP dispatch');
  text = replaceOne(text,
    "export function builderChallengeIsRepaired(challenge: BuilderChallenge, addressing: BuilderAddressing, ethernet: BuilderEthernetConfig, routing: BuilderRoutingConfig, acl: BuilderAclConfig = challenge.broken.acl, nat: BuilderNatConfig = challenge.broken.nat): boolean {",
    "export function builderChallengeIsRepaired(challenge: BuilderChallenge, addressing: BuilderAddressing, ethernet: BuilderEthernetConfig, routing: BuilderRoutingConfig, acl: BuilderAclConfig = challenge.broken.acl, nat: BuilderNatConfig = challenge.broken.nat, dhcp: BuilderDhcpConfig = challenge.broken.dhcp): boolean {",
    'DHCP repair signature');
  text = replaceOne(text,
    "  if (fault.kind === 'acl-objective-deny') return !acl.rules.some((rule) => rule.id === fault.blockingRule.id);\n  const boundary = nat.boundaries.find((entry) => entry.id === fault.boundaryId && entry.routerId === fault.nodeId);\n  return boundary?.enabled === fault.expectedEnabled;",
    "  if (fault.kind === 'acl-objective-deny') return !acl.rules.some((rule) => rule.id === fault.blockingRule.id);\n  if (fault.kind === 'nat-boundary-disabled') {\n    const boundary = nat.boundaries.find((entry) => entry.id === fault.boundaryId && entry.routerId === fault.nodeId);\n    return boundary?.enabled === fault.expectedEnabled;\n  }\n  const pool = dhcp.pools.find((entry) => entry.id === fault.poolId && entry.serverDeviceId === fault.nodeId);\n  return pool?.gateway === fault.expectedGateway;",
    'DHCP repair predicate');
  text = replaceOne(text,
    "  if (fault.kind === 'acl-objective-deny') return `${fault.nodeId.toUpperCase()} had an explicit ICMP deny for the challenge source/destination. Removing the canonical blocking rule restored policy permission and the post-repair probe verified reachability.`;\n  return `${fault.nodeId.toUpperCase()} had the canonical NAT boundary disabled. Re-enabling it restored PAT translation; the post-repair NAT flow proved the tuple was translated rather than merely routed.`;",
    "  if (fault.kind === 'acl-objective-deny') return `${fault.nodeId.toUpperCase()} had an explicit ICMP deny for the challenge source/destination. Removing the canonical blocking rule restored policy permission and the post-repair probe verified reachability.`;\n  if (fault.kind === 'nat-boundary-disabled') return `${fault.nodeId.toUpperCase()} had the canonical NAT boundary disabled. Re-enabling it restored PAT translation; the post-repair NAT flow proved the tuple was translated rather than merely routed.`;\n  return `${fault.nodeId.toUpperCase()} ACKed the DHCP lease without a default-gateway option. Restoring ${fault.expectedGateway} to the canonical pool and reacquiring produced a configuration-ready lease.`;",
    'DHCP solved explanation');
  text = replaceOne(text,
    "  acl: BuilderAclConfig = challenge.broken.acl,\n  nat: BuilderNatConfig = challenge.broken.nat,\n): BuilderChallengeScore {",
    "  acl: BuilderAclConfig = challenge.broken.acl,\n  nat: BuilderNatConfig = challenge.broken.nat,\n  dhcp: BuilderDhcpConfig = challenge.broken.dhcp,\n): BuilderChallengeScore {",
    'DHCP score signature');
  text = replaceOne(text,
    "  } else {\n    const missingTranslation = hasEvidence(evidence, (entry) => entry.kind === 'nat-flow' && isObjectiveEvidence(challenge, entry) && entry.success === false && !entry.repaired);\n    evidenceScore = (missingTranslation ? 20 : 0) + (inspectedState ? 10 : 0) + (inspectedConfig ? 10 : 0);\n    hasPrimaryDiagnostic = missingTranslation;\n  }",
    "  } else if (challenge.verification.kind === 'nat-translation') {\n    const missingTranslation = hasEvidence(evidence, (entry) => entry.kind === 'nat-flow' && isObjectiveEvidence(challenge, entry) && entry.success === false && !entry.repaired);\n    evidenceScore = (missingTranslation ? 20 : 0) + (inspectedState ? 10 : 0) + (inspectedConfig ? 10 : 0);\n    hasPrimaryDiagnostic = missingTranslation;\n  } else {\n    const incompleteConfiguration = hasEvidence(evidence, (entry) => entry.kind === 'dhcp-transaction' && isObjectiveEvidence(challenge, entry) && entry.success === false && !entry.repaired);\n    evidenceScore = (incompleteConfiguration ? 20 : 0) + (inspectedState ? 10 : 0) + (inspectedConfig ? 10 : 0);\n    hasPrimaryDiagnostic = incompleteConfiguration;\n  }",
    'DHCP evidence scoring');
  text = replaceOne(text,
    "  const repaired = builderChallengeIsRepaired(challenge, addressing, ethernet, routing, acl, nat);",
    "  const repaired = builderChallengeIsRepaired(challenge, addressing, ethernet, routing, acl, nat, dhcp);",
    'DHCP score repair');
  text = replaceOne(text,
    "    : challenge.verification.kind === 'ethernet-flow'\n      ? hasEvidence(evidence, (entry) => entry.kind === 'ethernet-flow' && isObjectiveEvidence(challenge, entry) && entry.success === true && entry.repaired)\n      : hasEvidence(evidence, (entry) => entry.kind === 'nat-flow' && isObjectiveEvidence(challenge, entry) && entry.success === true && entry.repaired);",
    "    : challenge.verification.kind === 'ethernet-flow'\n      ? hasEvidence(evidence, (entry) => entry.kind === 'ethernet-flow' && isObjectiveEvidence(challenge, entry) && entry.success === true && entry.repaired)\n      : challenge.verification.kind === 'nat-translation'\n        ? hasEvidence(evidence, (entry) => entry.kind === 'nat-flow' && isObjectiveEvidence(challenge, entry) && entry.success === true && entry.repaired)\n        : hasEvidence(evidence, (entry) => entry.kind === 'dhcp-transaction' && isObjectiveEvidence(challenge, entry) && entry.success === true && entry.repaired);",
    'DHCP verification');
  return text;
});

patch('src/BuilderChallengePanel.tsx', (input) => {
  let text = input;
  text = replaceOne(text, "  if (entry.kind === 'nat-flow') return 'NAT FLOW';", "  if (entry.kind === 'nat-flow') return 'NAT FLOW';\n  if (entry.kind === 'dhcp-transaction') return 'DHCP DORA';", 'DHCP evidence label');
  text = replaceOne(text,
    "        : verificationKind === 'ethernet-flow'\n          ? 'Run the ordinary LAN SEND FRAME / PACKET flow, inspect its ARP result, and use CONFIG / STATE / EVENTS in Device Workbench. Repair the normal VLAN / trunk / STP controls, then rerun the exact LAN objective to prove the fix.'\n          : 'Run the ordinary NAT RUN OUTBOUND tool and inspect CONFIG / STATE / EVENTS in Device Workbench. A delivered but untranslated tuple is still a failed objective. Repair the canonical NAT boundary, then rerun the same outbound flow to prove PAT translation.'}</p>",
    "        : verificationKind === 'ethernet-flow'\n          ? 'Run the ordinary LAN SEND FRAME / PACKET flow, inspect its ARP result, and use CONFIG / STATE / EVENTS in Device Workbench. Repair the normal VLAN / trunk / STP controls, then rerun the exact LAN objective to prove the fix.'\n          : verificationKind === 'nat-translation'\n            ? 'Run the ordinary NAT RUN OUTBOUND tool and inspect CONFIG / STATE / EVENTS in Device Workbench. A delivered but untranslated tuple is still a failed objective. Repair the canonical NAT boundary, then rerun the same outbound flow to prove PAT translation.'\n            : 'Run the ordinary DHCP DORA / ACQUIRE flow and inspect CONFIG / STATE / EVENTS in Device Workbench. An ACK with incomplete options is failed objective evidence. Repair the pool default-gateway option, then reacquire a configuration-ready lease.'}</p>",
    'DHCP instructions');
  return text;
});

patch('src/BuilderDhcpPanel.tsx', (input) => {
  let text = input;
  text = replaceOne(text,
    "  onMessage: (message: string, deviceIds?: string[]) => void;\n  historical?: boolean;",
    "  onMessage: (message: string, deviceIds?: string[]) => void;\n  onTransaction?: (transaction: BuilderDhcpTransaction, operation: 'acquire' | 'renew') => void;\n  historical?: boolean;",
    'DHCP callback prop');
  text = replaceOne(text,
    "export function BuilderDhcpPanel({ethernet,config,onConfigChange,leases,onLeasesChange,sequence,onSequenceChange,onMessage,historical=false,historicalStage=null}:BuilderDhcpPanelProps){",
    "export function BuilderDhcpPanel({ethernet,config,onConfigChange,leases,onLeasesChange,sequence,onSequenceChange,onMessage,onTransaction,historical=false,historicalStage=null}:BuilderDhcpPanelProps){",
    'DHCP callback destructure');
  text = replaceOne(text,
    "onLeasesChange(result.leases);setLastTransaction(result);onSequenceChange(sequence+1);const serverId=result.lease?.serverDeviceId??result.events.find((event)=>event.destinationDeviceId)?.destinationDeviceId??undefined;onMessage(`DHCP ${result.success?'ACK':'FAILED'} · ${result.summary}`",
    "onLeasesChange(result.leases);setLastTransaction(result);onSequenceChange(sequence+1);onTransaction?.(result,'acquire');const serverId=result.lease?.serverDeviceId??result.events.find((event)=>event.destinationDeviceId)?.destinationDeviceId??undefined;onMessage(`DHCP ${result.success?'ACK':'FAILED'} · ${result.summary}`",
    'DHCP acquire callback');
  text = replaceOne(text,
    "onLeasesChange(result.leases);setLastTransaction(result);onSequenceChange(sequence+1);const serverId=result.lease?.serverDeviceId??result.events.find((event)=>event.destinationDeviceId)?.destinationDeviceId??undefined;onMessage(`DHCP ${result.success?'RENEW':'TIMEOUT'} · ${result.summary}`",
    "onLeasesChange(result.leases);setLastTransaction(result);onSequenceChange(sequence+1);onTransaction?.(result,'renew');const serverId=result.lease?.serverDeviceId??result.events.find((event)=>event.destinationDeviceId)?.destinationDeviceId??undefined;onMessage(`DHCP ${result.success?'RENEW':'TIMEOUT'} · ${result.summary}`",
    'DHCP renew callback');
  return text;
});

patch('src/NetworkBuilder.tsx', (input) => {
  let text = input;
  text = replaceOne(text,
    "scoreBuilderChallenge(challenge, challengeEvidence, challengeHypothesis, addressing, ethernet, routing, acl, nat)",
    "scoreBuilderChallenge(challenge, challengeEvidence, challengeHypothesis, addressing, ethernet, routing, acl, nat, dhcp)",
    'live DHCP score');
  text = text.split('builderChallengeIsRepaired(challenge,addressing,ethernet,routing,acl,nat)').join('builderChallengeIsRepaired(challenge,addressing,ethernet,routing,acl,nat,dhcp)');
  text = text.split('builderChallengeIsRepaired(challenge, addressing, ethernet, routing, acl, nat)').join('builderChallengeIsRepaired(challenge, addressing, ethernet, routing, acl, nat, dhcp)');
  text = replaceOne(text,
    "if(next.verification.kind==='ethernet-flow'){setEthernetSourceId(next.verification.sourceId);setEthernetDestinationId(next.verification.destinationId);setWorkbenchDevice({plane:'ethernet',id:next.fault.nodeId});if('linkId' in next.fault)setSelectedEthernetLinkId(next.fault.linkId);}else{setSourceId(next.verification.sourceId);setDestinationId(next.verification.destinationId);setWorkbenchDevice({plane:'routed',id:next.verification.sourceId});setSelectedNodeId(next.verification.sourceId);}",
    "if(next.verification.kind==='ethernet-flow'){setEthernetSourceId(next.verification.sourceId);setEthernetDestinationId(next.verification.destinationId);setWorkbenchDevice({plane:'ethernet',id:next.fault.nodeId});if('linkId' in next.fault)setSelectedEthernetLinkId(next.fault.linkId);}else if(next.verification.kind==='dhcp-configuration'){setWorkbenchDevice({plane:'ethernet',id:next.verification.sourceId});}else{setSourceId(next.verification.sourceId);setDestinationId(next.verification.destinationId);setWorkbenchDevice({plane:'routed',id:next.verification.sourceId});setSelectedNodeId(next.verification.sourceId);}",
    'DHCP challenge start');
  text = replaceOne(text,
    "if(challenge.verification.kind==='ethernet-flow'){setEthernetSourceId(challenge.verification.sourceId);setEthernetDestinationId(challenge.verification.destinationId);setWorkbenchDevice({plane:'ethernet',id:challenge.fault.nodeId});if('linkId' in challenge.fault)setSelectedEthernetLinkId(challenge.fault.linkId);}else{setSourceId(challenge.verification.sourceId);setDestinationId(challenge.verification.destinationId);setWorkbenchDevice({plane:'routed',id:challenge.verification.sourceId});setSelectedNodeId(challenge.verification.sourceId);}",
    "if(challenge.verification.kind==='ethernet-flow'){setEthernetSourceId(challenge.verification.sourceId);setEthernetDestinationId(challenge.verification.destinationId);setWorkbenchDevice({plane:'ethernet',id:challenge.fault.nodeId});if('linkId' in challenge.fault)setSelectedEthernetLinkId(challenge.fault.linkId);}else if(challenge.verification.kind==='dhcp-configuration'){setWorkbenchDevice({plane:'ethernet',id:challenge.verification.sourceId});}else{setSourceId(challenge.verification.sourceId);setDestinationId(challenge.verification.destinationId);setWorkbenchDevice({plane:'routed',id:challenge.verification.sourceId});setSelectedNodeId(challenge.verification.sourceId);}",
    'DHCP challenge restart');
  text = replaceOne(text,
    "<button type=\"button\" onClick={()=>setChallengeSeed('nat-001')}>NAT</button></div><button type=\"button\" disabled={isHistorical} onClick={()=>startChallenge(challengeSeed)}>START CHALLENGE</button><small className=\"builder-routing-note\">SEED PREFIX SELECTS FAMILY · GATEWAY / VLAN / TRUNK / STP / STATIC / OSPF / ACL / NAT · NORMAL BUILDER PROBES, LAN FLOW, NAT FLOW, POLICY/ROUTE STATE, WORKBENCH, AND CONFIG CONTROLS · SESSION-ONLY SCORE.</small>",
    "<button type=\"button\" onClick={()=>setChallengeSeed('nat-001')}>NAT</button><button type=\"button\" onClick={()=>setChallengeSeed('dhcp-001')}>DHCP</button></div><button type=\"button\" disabled={isHistorical} onClick={()=>startChallenge(challengeSeed)}>START CHALLENGE</button><small className=\"builder-routing-note\">SEED PREFIX SELECTS FAMILY · GATEWAY / VLAN / TRUNK / STP / STATIC / OSPF / ACL / NAT / DHCP · NORMAL BUILDER PROBES, LAN FLOW, NAT FLOW, DHCP DORA, POLICY/ROUTE STATE, WORKBENCH, AND CONFIG CONTROLS · SESSION-ONLY SCORE.</small>",
    'DHCP launcher');
  text = replaceOne(text,
    "{!stressLabel&&<BuilderDhcpPanel ethernet={ethernet} config={dhcp} onConfigChange={setDhcp} leases={dhcpLeases} onLeasesChange={setDhcpLeases} sequence={dhcpSequence} onSequenceChange={setDhcpSequence} onMessage={setMessage} historical={isHistorical} historicalStage={historicalTimelineSnapshot?.category==='dhcp'?{summary:historicalTimelineSnapshot.summary,detail:historicalTimelineSnapshot.detail}:null}/>}",
    "{!stressLabel&&<BuilderDhcpPanel ethernet={ethernet} config={dhcp} onConfigChange={setDhcp} leases={dhcpLeases} onLeasesChange={setDhcpLeases} sequence={dhcpSequence} onSequenceChange={setDhcpSequence} onMessage={setMessage} onTransaction={(transaction,operation)=>{if(!challenge||challenge.verification.kind!=='dhcp-configuration'||isHistorical||operation!=='acquire')return;const serverId=transaction.lease?.serverDeviceId??transaction.events.find((event)=>event.destinationDeviceId)?.destinationDeviceId??null;if(!serverId)return;const repaired=builderChallengeIsRepaired(challenge,addressing,ethernet,routing,acl,nat,dhcp);setChallengeEvidence((current)=>appendBuilderChallengeEvidence(current,{kind:'dhcp-transaction',sourceId:transaction.clientDeviceId,destinationId:serverId,success:transaction.success&&transaction.configurationReady,repaired,detail:transaction.configurationReady?`CONFIGURATION READY · ${transaction.summary}`:`INCOMPLETE DHCP OPTIONS · ${transaction.summary}`}));}} historical={isHistorical} historicalStage={historicalTimelineSnapshot?.category==='dhcp'?{summary:historicalTimelineSnapshot.summary,detail:historicalTimelineSnapshot.detail}:null}/>}",
    'DHCP evidence integration');
  return text;
});

patch('scripts/builder-challenge-contract-check.mjs', (input) => {
  let text = input;
  text = replaceOne(text, "  createDefaultGatewayChallenge,\n  createMissingStaticRouteChallenge,", "  createDefaultGatewayChallenge,\n  createDhcpGatewayChallenge,\n  createMissingStaticRouteChallenge,", 'DHCP contract import');
  text = replaceOne(text, "import { runBuilderEthernetFlow, validateBuilderEthernetConfig } from '../src/builder/ethernet.ts';", "import { runBuilderDhcpAcquire, upsertBuilderDhcpPool } from '../src/builder/dhcp.ts';\nimport { runBuilderEthernetFlow, validateBuilderEthernetConfig } from '../src/builder/ethernet.ts';", 'DHCP contract helper');

  const tests = [
    "",
    "const dhcpChallenge=createDhcpGatewayChallenge('dhcp-contract-001');",
    "assert.equal(dhcpChallenge.family,'dhcp-gateway');",
    "assert.equal(dhcpChallenge.fault.kind,'dhcp-gateway-option-missing');",
    "assert.deepEqual(dhcpChallenge,createBuilderChallenge('dhcp-contract-001'));",
    "const healthyDhcp=runBuilderDhcpAcquire(dhcpChallenge.healthy.ethernet,dhcpChallenge.healthy.dhcp,[],dhcpChallenge.fault.clientDeviceId,1);",
    "const brokenDhcp=runBuilderDhcpAcquire(dhcpChallenge.broken.ethernet,dhcpChallenge.broken.dhcp,[],dhcpChallenge.fault.clientDeviceId,1);",
    "assert.equal(healthyDhcp.success,true);",
    "assert.equal(healthyDhcp.configurationReady,true,'healthy DHCP baseline must return a configuration-ready ACK');",
    "assert.equal(brokenDhcp.success,true,'missing gateway option must not invent a DORA timeout');",
    "assert.equal(brokenDhcp.configurationReady,false,'broken DHCP ACK must remain explicitly incomplete');",
    "assert.ok(brokenDhcp.optionsIssues.includes('DEFAULT GATEWAY MISSING'));",
    "const brokenDhcpPool=dhcpChallenge.broken.dhcp.pools.find((entry)=>entry.id===dhcpChallenge.fault.poolId);",
    "assert.ok(brokenDhcpPool);",
    "const repairedDhcp=upsertBuilderDhcpPool(dhcpChallenge.broken.ethernet,dhcpChallenge.broken.dhcp,{...brokenDhcpPool,gateway:dhcpChallenge.fault.expectedGateway});",
    "assert.deepEqual(repairedDhcp,dhcpChallenge.healthy.dhcp,'DHCP challenge removes exactly one canonical pool gateway option');",
    "assert.equal(builderChallengeIsRepaired(dhcpChallenge,dhcpChallenge.broken.addressing,dhcpChallenge.broken.ethernet,dhcpChallenge.broken.routing,dhcpChallenge.broken.acl,dhcpChallenge.broken.nat,dhcpChallenge.broken.dhcp),false);",
    "assert.equal(builderChallengeIsRepaired(dhcpChallenge,dhcpChallenge.broken.addressing,dhcpChallenge.broken.ethernet,dhcpChallenge.broken.routing,dhcpChallenge.broken.acl,dhcpChallenge.broken.nat,repairedDhcp),true);",
    "let dhcpEvidence=[];",
    "dhcpEvidence=appendBuilderChallengeEvidence(dhcpEvidence,{kind:'dhcp-transaction',sourceId:dhcpChallenge.verification.sourceId,destinationId:dhcpChallenge.verification.destinationId,success:false,repaired:false,detail:brokenDhcp.summary});",
    "dhcpEvidence=recordInspection(dhcpEvidence,dhcpChallenge,'state');",
    "dhcpEvidence=recordInspection(dhcpEvidence,dhcpChallenge,'config');",
    "const dhcpHypothesis={boundary:'ADDRESSING',deviceId:dhcpChallenge.fault.nodeId};",
    "assert.deepEqual(scoreBuilderChallenge(dhcpChallenge,dhcpEvidence,dhcpHypothesis,dhcpChallenge.broken.addressing,dhcpChallenge.broken.ethernet,dhcpChallenge.broken.routing,dhcpChallenge.broken.acl,dhcpChallenge.broken.nat,dhcpChallenge.broken.dhcp),{evidence:40,reasoning:20,repair:0,verification:0,total:60,repaired:false,verified:false,solved:false});",
    "assert.equal(scoreBuilderChallenge(dhcpChallenge,dhcpEvidence,dhcpHypothesis,dhcpChallenge.broken.addressing,dhcpChallenge.broken.ethernet,dhcpChallenge.broken.routing,dhcpChallenge.broken.acl,dhcpChallenge.broken.nat,repairedDhcp).total,85);",
    "dhcpEvidence=appendBuilderChallengeEvidence(dhcpEvidence,{kind:'dhcp-transaction',sourceId:'lan-b',destinationId:dhcpChallenge.verification.destinationId,success:true,repaired:true,detail:'A different DHCP client is ready.'});",
    "assert.equal(scoreBuilderChallenge(dhcpChallenge,dhcpEvidence,dhcpHypothesis,dhcpChallenge.broken.addressing,dhcpChallenge.broken.ethernet,dhcpChallenge.broken.routing,dhcpChallenge.broken.acl,dhcpChallenge.broken.nat,repairedDhcp).verified,false,'a different DHCP client cannot verify the objective');",
    "const repairedDhcpTx=runBuilderDhcpAcquire(dhcpChallenge.broken.ethernet,repairedDhcp,[],dhcpChallenge.fault.clientDeviceId,2);",
    "assert.equal(repairedDhcpTx.configurationReady,true);",
    "dhcpEvidence=appendBuilderChallengeEvidence(dhcpEvidence,{kind:'dhcp-transaction',sourceId:dhcpChallenge.verification.sourceId,destinationId:dhcpChallenge.verification.destinationId,success:true,repaired:true,detail:repairedDhcpTx.summary});",
    "assert.deepEqual(scoreBuilderChallenge(dhcpChallenge,dhcpEvidence,dhcpHypothesis,dhcpChallenge.broken.addressing,dhcpChallenge.broken.ethernet,dhcpChallenge.broken.routing,dhcpChallenge.broken.acl,dhcpChallenge.broken.nat,repairedDhcp),{evidence:40,reasoning:20,repair:25,verification:15,total:100,repaired:true,verified:true,solved:true});",
    ""
  ].join('\n');
  text = replaceOne(text, "\nfor (const challenge of [access, trunk, stp, staticRoute, ospf, aclChallenge, natChallenge]) {", tests + "\nfor (const challenge of [access, trunk, stp, staticRoute, ospf, aclChallenge, natChallenge, dhcpChallenge]) {", 'DHCP contract tests');
  text = replaceOne(text,
    "console.log('Builder Track J challenge contract passed: gateway plus seeded access-VLAN, trunk-pruning, STP-loop, missing-static-route, OSPF-disabled, ACL-deny, and NAT-disabled faults use canonical truth, ordinary probes/LAN+ARP/NAT evidence, exact repair, objective-scoped verification, causal scoring, and reproducible tokens.');",
    "console.log('Builder Track J challenge contract passed: gateway plus seeded access-VLAN, trunk-pruning, STP-loop, missing-static-route, OSPF-disabled, ACL-deny, NAT-disabled, and DHCP-gateway faults use canonical truth, ordinary probes/LAN+ARP/NAT/DHCP evidence, exact repair, objective-scoped verification, causal scoring, and reproducible tokens.');",
    'DHCP contract summary');
  return text;
});

patch('docs/TRACKJ.md', (input) => input + "\n\n## Fifth slice — DHCP bootstrap options\n\nTrack J now includes a deterministic `dhcp-*` family. The canonical VLAN 10 DHCP client still completes DORA, but the server pool omits the default-gateway option. This is intentionally not modeled as a DHCP timeout: the ACK succeeds and allocates an address while `configurationReady` remains false with `DEFAULT GATEWAY MISSING`.\n\nDiagnosis uses the ordinary DHCP DORA / ACQUIRE surface plus Device Workbench CONFIG / STATE / EVENTS. Repair uses the normal pool GATEWAY editor; the existing pool edit path clears affected leases, so the learner must reacquire and prove a configuration-ready ACK.\n\nChallenge scoring treats an incomplete objective DHCP transaction as 20 points of primary evidence, plus target STATE and CONFIG inspection. The remaining 60 points retain the standard causal-hypothesis, exact canonical repair, and post-repair objective verification contract. DHCP leases and challenge evidence remain session-only; DHCP config remains canonical scenario truth.\n");

console.log('Applied Track J DHCP challenge slice.');
