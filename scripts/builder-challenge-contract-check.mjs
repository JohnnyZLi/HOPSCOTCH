import assert from 'node:assert/strict';
import {
  appendBuilderChallengeEvidence,
  builderChallengeIsRepaired,
  builderChallengeToken,
  createAccessVlanChallenge,
  createAclDenyChallenge,
  createBuilderChallenge,
  createDefaultGatewayChallenge,
  createDhcpGatewayChallenge,
  createMissingStaticRouteChallenge,
  createNatDisabledChallenge,
  createOspfDisabledChallenge,
  createStpLoopChallenge,
  createTrunkVlanChallenge,
  scoreBuilderChallenge,
  seedFromBuilderChallengeToken,
} from '../src/builder/challenges.ts';
import { resolveBuilderEthernetFlowArp } from '../src/builder/arp.ts';
import { runBuilderDhcpAcquire, upsertBuilderDhcpPool } from '../src/builder/dhcp.ts';
import { runBuilderEthernetFlow, validateBuilderEthernetConfig } from '../src/builder/ethernet.ts';
import { runBuilderNatOutboundFlow, validateBuilderNatConfig } from '../src/builder/nat.ts';
import { runBuilderProbe } from '../src/builder/probes.ts';
import { validateBuilderRoutingConfig } from '../src/builder/routing.ts';

function runPing(snapshot, sequence = 1) {
  return runBuilderProbe(
    snapshot.graph,
    snapshot.addressing,
    snapshot.routing,
    'ping',
    snapshot.sourceId,
    snapshot.destinationId,
    sequence,
    snapshot.linkProfiles,
    snapshot.acl,
    snapshot.nat,
    [],
  );
}

function runLan(snapshot, sourceId, destinationId) {
  const arp = resolveBuilderEthernetFlowArp(snapshot.ethernet, sourceId, destinationId, []);
  const flow = arp.success ? runBuilderEthernetFlow(snapshot.ethernet, sourceId, destinationId) : null;
  return { arp, flow, success: Boolean(arp.success && flow?.success), detail: arp.success ? (flow?.summary ?? 'LAN flow did not run.') : (arp.failureReason ?? 'ARP failed.') };
}

function recordInspection(evidence, challenge, tab) {
  return appendBuilderChallengeEvidence(evidence, {
    kind: `inspect-${tab}`,
    deviceId: challenge.fault.nodeId,
    devicePlane: challenge.fault.plane,
    repaired: false,
    detail: `Inspected ${tab.toUpperCase()} at the primary fault location.`,
  });
}

function scoreLanChallenge(challenge, repairedEthernet) {
  const objective = challenge.verification;
  const brokenAttempt = runLan(challenge.broken, objective.sourceId, objective.destinationId);
  const healthyAttempt = runLan(challenge.healthy, objective.sourceId, objective.destinationId);
  assert.equal(healthyAttempt.success, true, `${challenge.family} healthy baseline must pass: ${healthyAttempt.detail}`);
  assert.equal(brokenAttempt.success, false, `${challenge.family} broken baseline must fail the ordinary LAN workflow`);

  let evidence = [];
  evidence = appendBuilderChallengeEvidence(evidence, {
    kind: 'ethernet-flow', sourceId: objective.sourceId, destinationId: objective.destinationId,
    success: false, repaired: false, detail: brokenAttempt.detail,
  });
  const arpObservation = brokenAttempt.arp.resolutions.at(-1);
  evidence = appendBuilderChallengeEvidence(evidence, {
    kind: 'arp-resolution', sourceId: objective.sourceId, destinationId: objective.destinationId,
    success: arpObservation?.success ?? brokenAttempt.arp.success, repaired: false,
    detail: arpObservation?.summary ?? brokenAttempt.arp.failureReason ?? 'ARP state observed during the LAN attempt.',
  });
  evidence = recordInspection(evidence, challenge, 'state');
  evidence = recordInspection(evidence, challenge, 'config');

  const hypothesis = { boundary: 'L2', deviceId: challenge.fault.nodeId };
  const before = scoreBuilderChallenge(challenge, evidence, hypothesis, challenge.broken.addressing, challenge.broken.ethernet, challenge.broken.routing);
  assert.deepEqual(before, { evidence: 40, reasoning: 20, repair: 0, verification: 0, total: 60, repaired: false, verified: false, solved: false });

  const fixed = scoreBuilderChallenge(challenge, evidence, hypothesis, challenge.broken.addressing, repairedEthernet, challenge.broken.routing);
  assert.equal(fixed.total, 85, 'exact canonical repair earns repair points but still requires verification');
  assert.equal(fixed.solved, false);

  evidence = appendBuilderChallengeEvidence(evidence, {
    kind: 'ethernet-flow', sourceId: objective.destinationId, destinationId: objective.sourceId,
    success: true, repaired: true, detail: 'A non-objective LAN flow passed.',
  });
  assert.equal(scoreBuilderChallenge(challenge, evidence, hypothesis, challenge.broken.addressing, repairedEthernet, challenge.broken.routing).verified, false, 'a different endpoint pair cannot verify the challenge objective');

  const repairedAttempt = runLan({ ...challenge.broken, ethernet: repairedEthernet }, objective.sourceId, objective.destinationId);
  assert.equal(repairedAttempt.success, true, `repaired ${challenge.family} objective must pass the normal LAN workflow`);
  evidence = appendBuilderChallengeEvidence(evidence, {
    kind: 'ethernet-flow', sourceId: objective.sourceId, destinationId: objective.destinationId,
    success: true, repaired: true, detail: repairedAttempt.detail,
  });
  const solved = scoreBuilderChallenge(challenge, evidence, hypothesis, challenge.broken.addressing, repairedEthernet, challenge.broken.routing);
  assert.deepEqual(solved, { evidence: 40, reasoning: 20, repair: 25, verification: 15, total: 100, repaired: true, verified: true, solved: true });
}

const gateway = createDefaultGatewayChallenge('gateway-contract-001');
assert.deepEqual(gateway, createBuilderChallenge('gateway-contract-001'), 'legacy gateway-prefixed seeds must preserve the first Track J family');
assert.deepEqual(gateway, createDefaultGatewayChallenge('gateway-contract-001'), 'same gateway seed must reproduce the exact challenge');
assert.equal(gateway.schema, 'hopscotch.builder.challenge');
assert.equal(gateway.version, 1);
assert.equal(gateway.family, 'gateway');
assert.equal(gateway.verification.kind, 'routed-probe');
assert.equal(gateway.fault.kind, 'missing-default-gateway');
assert.equal(gateway.fault.boundary, 'ADDRESSING');
assert.equal(gateway.fault.plane, 'routed');
assert.equal(gateway.broken.sourceId, gateway.fault.nodeId);
assert.equal(gateway.broken.addressing.defaultGateways[gateway.fault.nodeId], null);
assert.equal(builderChallengeIsRepaired(gateway, gateway.broken.addressing, gateway.broken.ethernet, gateway.broken.routing), false);
assert.equal(builderChallengeIsRepaired(gateway, gateway.healthy.addressing, gateway.healthy.ethernet, gateway.healthy.routing), true);

const restoredGateway = structuredClone(gateway.broken);
restoredGateway.addressing.defaultGateways[gateway.fault.nodeId] = gateway.fault.expectedGateway;
assert.deepEqual(restoredGateway, gateway.healthy, 'gateway challenge introduces exactly one canonical config fault');
const healthyPing = runPing(gateway.healthy);
const brokenPing = runPing(gateway.broken);
assert.equal(healthyPing.success, true);
assert.equal(brokenPing.success, false);

const token = builderChallengeToken(gateway);
assert.equal(seedFromBuilderChallengeToken(token), gateway.seed);
assert.deepEqual(createBuilderChallenge(seedFromBuilderChallengeToken(token)), gateway, 'share token must reproduce the same deterministic challenge family and truth');
assert.throws(() => seedFromBuilderChallengeToken('HOP-J9.nope'), /Unsupported HOPSCOTCH challenge token/);

let gatewayEvidence = [];
const gatewayObjective = gateway.verification;
const gatewayRecord = (input) => { gatewayEvidence = appendBuilderChallengeEvidence(gatewayEvidence, input); };
gatewayRecord({ kind: 'ping', sourceId: gatewayObjective.sourceId, destinationId: gatewayObjective.destinationId, success: false, repaired: false, detail: brokenPing.summary });
gatewayRecord({ kind: 'traceroute', sourceId: gatewayObjective.sourceId, destinationId: gatewayObjective.destinationId, success: false, repaired: false, detail: 'Traceroute fails before the first routed hop.' });
gatewayRecord({ kind: 'inspect-state', deviceId: gateway.fault.nodeId, devicePlane: 'routed', repaired: false, detail: 'Inspected endpoint state.' });
gatewayRecord({ kind: 'inspect-config', deviceId: gateway.fault.nodeId, devicePlane: 'routed', repaired: false, detail: 'Inspected endpoint config.' });
const gatewayHypothesis = { boundary: 'ADDRESSING', deviceId: gateway.fault.nodeId };
assert.deepEqual(scoreBuilderChallenge(gateway, gatewayEvidence, gatewayHypothesis, gateway.broken.addressing, gateway.broken.ethernet, gateway.broken.routing), { evidence: 40, reasoning: 20, repair: 0, verification: 0, total: 60, repaired: false, verified: false, solved: false });
gatewayRecord({ kind: 'ping', sourceId: gatewayObjective.sourceId, destinationId: gatewayObjective.destinationId, success: true, repaired: true, detail: healthyPing.summary });
assert.deepEqual(scoreBuilderChallenge(gateway, gatewayEvidence, gatewayHypothesis, gateway.healthy.addressing, gateway.healthy.ethernet, gateway.healthy.routing), { evidence: 40, reasoning: 20, repair: 25, verification: 15, total: 100, repaired: true, verified: true, solved: true });

const access = createAccessVlanChallenge('vlan-contract-001');
assert.equal(access.family, 'access-vlan');
assert.equal(access.fault.kind, 'access-vlan-mismatch');
assert.equal(access.fault.plane, 'ethernet');
assert.equal(access.verification.kind, 'ethernet-flow');
assert.deepEqual(access, createBuilderChallenge('vlan-contract-001'));
const restoredAccess = structuredClone(access.broken.ethernet);
const accessLink = restoredAccess.links.find((link) => link.id === access.fault.linkId);
assert.ok(accessLink && accessLink.mode === 'access');
accessLink.accessVlan = access.fault.expectedAccessVlan;
const repairedAccess = validateBuilderEthernetConfig(restoredAccess);
assert.deepEqual(repairedAccess, access.healthy.ethernet, 'access challenge introduces exactly one canonical switch-port fault');
assert.equal(builderChallengeIsRepaired(access, access.broken.addressing, access.broken.ethernet, access.broken.routing), false);
assert.equal(builderChallengeIsRepaired(access, access.broken.addressing, repairedAccess, access.broken.routing), true);
scoreLanChallenge(access, repairedAccess);

const trunk = createTrunkVlanChallenge('trunk-contract-001');
assert.equal(trunk.family, 'trunk-vlan');
assert.equal(trunk.fault.kind, 'trunk-vlan-pruned');
assert.deepEqual(trunk, createBuilderChallenge('trunk-contract-001'));
const restoredTrunk = structuredClone(trunk.broken.ethernet);
const trunkLink = restoredTrunk.links.find((link) => link.id === trunk.fault.linkId);
assert.ok(trunkLink && trunkLink.mode === 'trunk');
trunkLink.allowedVlans = [...trunk.fault.expectedAllowedVlans];
const repairedTrunk = validateBuilderEthernetConfig(restoredTrunk);
assert.deepEqual(repairedTrunk, trunk.healthy.ethernet, 'trunk challenge introduces exactly one canonical allow-list fault');
scoreLanChallenge(trunk, repairedTrunk);

const stp = createStpLoopChallenge('stp-contract-001');
assert.equal(stp.family, 'stp-loop');
assert.equal(stp.fault.kind, 'stp-disabled-loop');
assert.deepEqual(stp, createBuilderChallenge('stp-contract-001'));
const restoredStp = structuredClone(stp.broken.ethernet);
restoredStp.stp.enabled = true;
const repairedStp = validateBuilderEthernetConfig(restoredStp);
assert.deepEqual(repairedStp, stp.healthy.ethernet, 'STP challenge introduces exactly one canonical control-plane fault');
const brokenStpAttempt = runLan(stp.broken, stp.verification.sourceId, stp.verification.destinationId);
assert.equal(brokenStpAttempt.arp.success, true, 'STP-disabled cycle remains ARP-reachable before the flow safety check, which is useful narrowing evidence');
assert.equal(brokenStpAttempt.flow?.success, false, 'ordinary Ethernet flow must reject unsafe forwarding while STP is disabled on a cycle');
scoreLanChallenge(stp, repairedStp);

function scoreRoutedChallenge(challenge, repairedRouting) {
  const objective = challenge.verification;
  const healthyPing = runPing(challenge.healthy);
  const brokenPing = runPing(challenge.broken);
  assert.equal(healthyPing.success, true, `${challenge.family} healthy baseline must pass`);
  assert.equal(brokenPing.success, false, `${challenge.family} broken baseline must fail ordinary Ping`);
  let evidence = [];
  evidence = appendBuilderChallengeEvidence(evidence, { kind:'ping', sourceId:objective.sourceId, destinationId:objective.destinationId, success:false, repaired:false, detail:brokenPing.summary });
  evidence = appendBuilderChallengeEvidence(evidence, { kind:'traceroute', sourceId:objective.sourceId, destinationId:objective.destinationId, success:false, repaired:false, detail:'Objective traceroute fails in the broken routed state.' });
  evidence = recordInspection(evidence, challenge, 'state');
  evidence = recordInspection(evidence, challenge, 'config');
  const hypothesis = { boundary:'ROUTING', deviceId:challenge.fault.nodeId };
  assert.deepEqual(scoreBuilderChallenge(challenge,evidence,hypothesis,challenge.broken.addressing,challenge.broken.ethernet,challenge.broken.routing), { evidence:40, reasoning:20, repair:0, verification:0, total:60, repaired:false, verified:false, solved:false });
  assert.equal(scoreBuilderChallenge(challenge,evidence,hypothesis,challenge.broken.addressing,challenge.broken.ethernet,repairedRouting).total, 85);
  evidence = appendBuilderChallengeEvidence(evidence, { kind:'ping', sourceId:objective.destinationId, destinationId:objective.sourceId, success:true, repaired:true, detail:'Unrelated reverse objective.' });
  assert.equal(scoreBuilderChallenge(challenge,evidence,hypothesis,challenge.broken.addressing,challenge.broken.ethernet,repairedRouting).verified, false);
  const repairedSnapshot = { ...challenge.broken, routing: repairedRouting };
  const repairedPing = runPing(repairedSnapshot);
  assert.equal(repairedPing.success, true, `${challenge.family} repaired objective must pass ordinary Ping`);
  evidence = appendBuilderChallengeEvidence(evidence, { kind:'ping', sourceId:objective.sourceId, destinationId:objective.destinationId, success:true, repaired:true, detail:repairedPing.summary });
  assert.deepEqual(scoreBuilderChallenge(challenge,evidence,hypothesis,challenge.broken.addressing,challenge.broken.ethernet,repairedRouting), { evidence:40, reasoning:20, repair:25, verification:15, total:100, repaired:true, verified:true, solved:true });
}

const staticRoute = createMissingStaticRouteChallenge('static-contract-001');
assert.equal(staticRoute.family, 'static-route');
assert.equal(staticRoute.fault.kind, 'missing-static-route');
assert.deepEqual(staticRoute, createBuilderChallenge('static-contract-001'));
const restoredStatic = validateBuilderRoutingConfig(staticRoute.broken.graph, staticRoute.broken.addressing, { ...staticRoute.broken.routing, staticRoutes:[...staticRoute.broken.routing.staticRoutes, staticRoute.fault.expectedRoute] });
assert.deepEqual([...restoredStatic.staticRoutes].sort((a,b)=>a.id.localeCompare(b.id)), [...staticRoute.healthy.routing.staticRoutes].sort((a,b)=>a.id.localeCompare(b.id)), 'static challenge removes exactly one required canonical route independent of route-list insertion order');
assert.deepEqual({ ...restoredStatic, staticRoutes: [] }, { ...staticRoute.healthy.routing, staticRoutes: [] }, 'static repair leaves all non-route routing configuration unchanged');
assert.equal(builderChallengeIsRepaired(staticRoute, staticRoute.broken.addressing, staticRoute.broken.ethernet, staticRoute.broken.routing), false);
assert.equal(builderChallengeIsRepaired(staticRoute, staticRoute.broken.addressing, staticRoute.broken.ethernet, restoredStatic), true);
scoreRoutedChallenge(staticRoute, restoredStatic);

const ospf = createOspfDisabledChallenge('ospf-contract-001');
assert.equal(ospf.family, 'ospf-disabled');
assert.equal(ospf.fault.kind, 'ospf-router-disabled');
assert.deepEqual(ospf, createBuilderChallenge('ospf-contract-001'));
assert.equal(ospf.broken.routing.ospf.enabledRouterIds.includes(ospf.fault.nodeId), false);
assert.equal(builderChallengeIsRepaired(ospf, ospf.broken.addressing, ospf.broken.ethernet, ospf.broken.routing), false);
assert.equal(builderChallengeIsRepaired(ospf, ospf.healthy.addressing, ospf.healthy.ethernet, ospf.healthy.routing), true);
scoreRoutedChallenge(ospf, ospf.healthy.routing);


const aclChallenge = createAclDenyChallenge('acl-contract-001');
assert.equal(aclChallenge.family, 'acl-deny');
assert.equal(aclChallenge.fault.kind, 'acl-objective-deny');
assert.deepEqual(aclChallenge, createBuilderChallenge('acl-contract-001'));
assert.equal(runPing(aclChallenge.healthy).success, true, 'ACL healthy baseline must pass ordinary Ping');
assert.equal(runPing(aclChallenge.broken).success, false, 'ACL deny must fail ordinary Ping without challenge-only forwarding');
const repairedAcl = structuredClone(aclChallenge.broken.acl);
repairedAcl.rules = repairedAcl.rules.filter((rule) => rule.id !== aclChallenge.fault.blockingRule.id);
assert.deepEqual(repairedAcl, aclChallenge.healthy.acl, 'ACL challenge adds exactly one canonical blocking rule');
assert.equal(builderChallengeIsRepaired(aclChallenge, aclChallenge.broken.addressing, aclChallenge.broken.ethernet, aclChallenge.broken.routing, aclChallenge.broken.acl, aclChallenge.broken.nat), false);
assert.equal(builderChallengeIsRepaired(aclChallenge, aclChallenge.broken.addressing, aclChallenge.broken.ethernet, aclChallenge.broken.routing, repairedAcl, aclChallenge.broken.nat), true);
let aclEvidence = [];
aclEvidence = appendBuilderChallengeEvidence(aclEvidence,{kind:'ping',sourceId:'client',destinationId:'app',success:false,repaired:false,detail:'Objective Ping denied by policy.'});
aclEvidence = appendBuilderChallengeEvidence(aclEvidence,{kind:'traceroute',sourceId:'client',destinationId:'app',success:false,repaired:false,detail:'Objective Traceroute denied by policy.'});
aclEvidence = recordInspection(aclEvidence,aclChallenge,'state');
aclEvidence = recordInspection(aclEvidence,aclChallenge,'config');
const aclHypothesis={boundary:'POLICY',deviceId:aclChallenge.fault.nodeId};
assert.deepEqual(scoreBuilderChallenge(aclChallenge,aclEvidence,aclHypothesis,aclChallenge.broken.addressing,aclChallenge.broken.ethernet,aclChallenge.broken.routing,aclChallenge.broken.acl,aclChallenge.broken.nat),{evidence:40,reasoning:20,repair:0,verification:0,total:60,repaired:false,verified:false,solved:false});
assert.equal(scoreBuilderChallenge(aclChallenge,aclEvidence,aclHypothesis,aclChallenge.broken.addressing,aclChallenge.broken.ethernet,aclChallenge.broken.routing,repairedAcl,aclChallenge.broken.nat).total,85);
aclEvidence=appendBuilderChallengeEvidence(aclEvidence,{kind:'ping',sourceId:'client',destinationId:'app',success:true,repaired:true,detail:'Objective Ping passes after ACL repair.'});
assert.equal(scoreBuilderChallenge(aclChallenge,aclEvidence,aclHypothesis,aclChallenge.broken.addressing,aclChallenge.broken.ethernet,aclChallenge.broken.routing,repairedAcl,aclChallenge.broken.nat).total,100);

function runNatObjective(snapshot){return runBuilderNatOutboundFlow(snapshot.graph,snapshot.addressing,snapshot.routing,snapshot.nat,[],'client','app','tcp',51515,443,1,snapshot.acl);}
const natChallenge=createNatDisabledChallenge('nat-contract-001');
assert.equal(natChallenge.family,'nat-disabled');
assert.equal(natChallenge.fault.kind,'nat-boundary-disabled');
assert.deepEqual(natChallenge,createBuilderChallenge('nat-contract-001'));
const healthyNatFlow=runNatObjective(natChallenge.healthy);
const brokenNatFlow=runNatObjective(natChallenge.broken);
assert.equal(healthyNatFlow.success,true);
assert.ok(healthyNatFlow.translation,'healthy NAT objective must produce canonical PAT translation');
assert.equal(brokenNatFlow.success,true,'disabling NAT does not invent a routing outage');
assert.equal(brokenNatFlow.translation,null,'broken NAT objective must expose untranslated delivery');
const repairedNat=validateBuilderNatConfig(natChallenge.broken.graph,{...natChallenge.broken.nat,boundaries:natChallenge.broken.nat.boundaries.map((entry)=>entry.id===natChallenge.fault.boundaryId?{...entry,enabled:true}:entry)});
assert.deepEqual(repairedNat,natChallenge.healthy.nat,'NAT challenge changes exactly the canonical boundary enabled state');
let natEvidence=[];
natEvidence=appendBuilderChallengeEvidence(natEvidence,{kind:'nat-flow',sourceId:'client',destinationId:'app',success:false,repaired:false,detail:brokenNatFlow.explanation});
natEvidence=recordInspection(natEvidence,natChallenge,'state');
natEvidence=recordInspection(natEvidence,natChallenge,'config');
const natHypothesis={boundary:'POLICY',deviceId:natChallenge.fault.nodeId};
assert.deepEqual(scoreBuilderChallenge(natChallenge,natEvidence,natHypothesis,natChallenge.broken.addressing,natChallenge.broken.ethernet,natChallenge.broken.routing,natChallenge.broken.acl,natChallenge.broken.nat),{evidence:40,reasoning:20,repair:0,verification:0,total:60,repaired:false,verified:false,solved:false});
assert.equal(scoreBuilderChallenge(natChallenge,natEvidence,natHypothesis,natChallenge.broken.addressing,natChallenge.broken.ethernet,natChallenge.broken.routing,natChallenge.broken.acl,repairedNat).total,85);
natEvidence=appendBuilderChallengeEvidence(natEvidence,{kind:'nat-flow',sourceId:'app',destinationId:'client',success:true,repaired:true,detail:'Unrelated NAT observation.'});
assert.equal(scoreBuilderChallenge(natChallenge,natEvidence,natHypothesis,natChallenge.broken.addressing,natChallenge.broken.ethernet,natChallenge.broken.routing,natChallenge.broken.acl,repairedNat).verified,false,'unrelated NAT flow cannot verify the objective');
const repairedNatFlow=runNatObjective({...natChallenge.broken,nat:repairedNat});
assert.ok(repairedNatFlow.translation);
natEvidence=appendBuilderChallengeEvidence(natEvidence,{kind:'nat-flow',sourceId:'client',destinationId:'app',success:true,repaired:true,detail:repairedNatFlow.explanation});
assert.deepEqual(scoreBuilderChallenge(natChallenge,natEvidence,natHypothesis,natChallenge.broken.addressing,natChallenge.broken.ethernet,natChallenge.broken.routing,natChallenge.broken.acl,repairedNat),{evidence:40,reasoning:20,repair:25,verification:15,total:100,repaired:true,verified:true,solved:true});

const dhcpChallenge=createDhcpGatewayChallenge('dhcp-contract-001');
assert.equal(dhcpChallenge.family,'dhcp-gateway');
assert.equal(dhcpChallenge.fault.kind,'dhcp-gateway-option-missing');
assert.deepEqual(dhcpChallenge,createBuilderChallenge('dhcp-contract-001'));
const healthyDhcp=runBuilderDhcpAcquire(dhcpChallenge.healthy.ethernet,dhcpChallenge.healthy.dhcp,[],dhcpChallenge.fault.clientDeviceId,1);
const brokenDhcp=runBuilderDhcpAcquire(dhcpChallenge.broken.ethernet,dhcpChallenge.broken.dhcp,[],dhcpChallenge.fault.clientDeviceId,1);
assert.equal(healthyDhcp.success,true);
assert.equal(healthyDhcp.configurationReady,true,'healthy DHCP baseline must return a configuration-ready ACK');
assert.equal(brokenDhcp.success,true,'missing gateway option must not invent a DORA timeout');
assert.equal(brokenDhcp.configurationReady,false,'broken DHCP ACK must remain explicitly incomplete');
assert.ok(brokenDhcp.optionsIssues.includes('DEFAULT GATEWAY MISSING'));
const brokenDhcpPool=dhcpChallenge.broken.dhcp.pools.find((entry)=>entry.id===dhcpChallenge.fault.poolId);
assert.ok(brokenDhcpPool);
const repairedDhcp=upsertBuilderDhcpPool(dhcpChallenge.broken.ethernet,dhcpChallenge.broken.dhcp,{...brokenDhcpPool,gateway:dhcpChallenge.fault.expectedGateway});
assert.deepEqual(repairedDhcp,dhcpChallenge.healthy.dhcp,'DHCP challenge removes exactly one canonical pool gateway option');
assert.equal(builderChallengeIsRepaired(dhcpChallenge,dhcpChallenge.broken.addressing,dhcpChallenge.broken.ethernet,dhcpChallenge.broken.routing,dhcpChallenge.broken.acl,dhcpChallenge.broken.nat,dhcpChallenge.broken.dhcp),false);
assert.equal(builderChallengeIsRepaired(dhcpChallenge,dhcpChallenge.broken.addressing,dhcpChallenge.broken.ethernet,dhcpChallenge.broken.routing,dhcpChallenge.broken.acl,dhcpChallenge.broken.nat,repairedDhcp),true);
let dhcpEvidence=[];
dhcpEvidence=appendBuilderChallengeEvidence(dhcpEvidence,{kind:'dhcp-transaction',sourceId:dhcpChallenge.verification.sourceId,destinationId:dhcpChallenge.verification.destinationId,success:false,repaired:false,detail:brokenDhcp.summary});
dhcpEvidence=recordInspection(dhcpEvidence,dhcpChallenge,'state');
dhcpEvidence=recordInspection(dhcpEvidence,dhcpChallenge,'config');
const dhcpHypothesis={boundary:'ADDRESSING',deviceId:dhcpChallenge.fault.nodeId};
assert.deepEqual(scoreBuilderChallenge(dhcpChallenge,dhcpEvidence,dhcpHypothesis,dhcpChallenge.broken.addressing,dhcpChallenge.broken.ethernet,dhcpChallenge.broken.routing,dhcpChallenge.broken.acl,dhcpChallenge.broken.nat,dhcpChallenge.broken.dhcp),{evidence:40,reasoning:20,repair:0,verification:0,total:60,repaired:false,verified:false,solved:false});
assert.equal(scoreBuilderChallenge(dhcpChallenge,dhcpEvidence,dhcpHypothesis,dhcpChallenge.broken.addressing,dhcpChallenge.broken.ethernet,dhcpChallenge.broken.routing,dhcpChallenge.broken.acl,dhcpChallenge.broken.nat,repairedDhcp).total,85);
dhcpEvidence=appendBuilderChallengeEvidence(dhcpEvidence,{kind:'dhcp-transaction',sourceId:'lan-b',destinationId:dhcpChallenge.verification.destinationId,success:true,repaired:true,detail:'A different DHCP client is ready.'});
assert.equal(scoreBuilderChallenge(dhcpChallenge,dhcpEvidence,dhcpHypothesis,dhcpChallenge.broken.addressing,dhcpChallenge.broken.ethernet,dhcpChallenge.broken.routing,dhcpChallenge.broken.acl,dhcpChallenge.broken.nat,repairedDhcp).verified,false,'a different DHCP client cannot verify the objective');
const repairedDhcpTx=runBuilderDhcpAcquire(dhcpChallenge.broken.ethernet,repairedDhcp,[],dhcpChallenge.fault.clientDeviceId,2);
assert.equal(repairedDhcpTx.configurationReady,true);
dhcpEvidence=appendBuilderChallengeEvidence(dhcpEvidence,{kind:'dhcp-transaction',sourceId:dhcpChallenge.verification.sourceId,destinationId:dhcpChallenge.verification.destinationId,success:true,repaired:true,detail:repairedDhcpTx.summary});
assert.deepEqual(scoreBuilderChallenge(dhcpChallenge,dhcpEvidence,dhcpHypothesis,dhcpChallenge.broken.addressing,dhcpChallenge.broken.ethernet,dhcpChallenge.broken.routing,dhcpChallenge.broken.acl,dhcpChallenge.broken.nat,repairedDhcp),{evidence:40,reasoning:20,repair:25,verification:15,total:100,repaired:true,verified:true,solved:true});

for (const challenge of [access, trunk, stp, staticRoute, ospf, aclChallenge, natChallenge, dhcpChallenge]) {
  const challengeToken = builderChallengeToken(challenge);
  assert.deepEqual(createBuilderChallenge(seedFromBuilderChallengeToken(challengeToken)), challenge, `${challenge.family} token must reproduce exact deterministic truth`);
}

console.log('Builder Track J challenge contract passed: gateway plus seeded access-VLAN, trunk-pruning, STP-loop, missing-static-route, OSPF-disabled, ACL-deny, NAT-disabled, and DHCP-gateway faults use canonical truth, ordinary probes/LAN+ARP/NAT/DHCP evidence, exact repair, objective-scoped verification, causal scoring, and reproducible tokens.');
