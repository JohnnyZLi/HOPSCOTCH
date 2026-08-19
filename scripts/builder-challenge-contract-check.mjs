import assert from 'node:assert/strict';
import {
  appendBuilderChallengeEvidence,
  builderChallengeIsRepaired,
  builderChallengeRepairStage,
  builderChallengeToken,
  createAccessVlanChallenge,
  createAclDenyChallenge,
  createBuilderChallenge,
  createBgpImportPolicyChallenge,
  createComposedChallenge,
  createDefaultGatewayChallenge,
  createDhcpGatewayChallenge,
  createDnsNameChallenge,
  createIpv6PmtuChallenge,
  createMissingStaticRouteChallenge,
  createNatDisabledChallenge,
  createOspfDisabledChallenge,
  createStpLoopChallenge,
  createTrunkVlanChallenge,
  createTransportListenerChallenge,
  scoreBuilderChallenge,
  seedFromBuilderChallengeToken,
} from '../src/builder/challenges.ts';
import { deleteBuilderAclRule } from '../src/builder/acl.ts';
import { resolveBuilderEthernetFlowArp } from '../src/builder/arp.ts';
import { runBuilderApplicationTransaction, upsertBuilderHostedService } from '../src/builder/application.ts';
import { builderBgpState, deleteBuilderBgpPolicy } from '../src/builder/bgp.ts';
import { clearBuilderArpCache } from '../src/builder/arp.ts';
import { clearBuilderDhcpLeases } from '../src/builder/dhcp.ts';
import { createBuilderIpv6ControlState } from '../src/builder/ipv6-control-plane.ts';
import { createDefaultBuilderIpv6RoutingDepthState } from '../src/builder/ipv6-routing-depth.ts';
import { clearBuilderNatSessions } from '../src/builder/nat.ts';
import { runBuilderDhcpAcquire, upsertBuilderDhcpPool } from '../src/builder/dhcp.ts';
import { clearBuilderIpv6PmtuCache } from '../src/builder/ipv6-control-plane.ts';
import { runBuilderIpv6Probe } from '../src/builder/ipv6-probes.ts';
import { updateBuilderLinkProfile } from '../src/builder/link-characteristics.ts';
import { runBuilderEthernetFlow, validateBuilderEthernetConfig } from '../src/builder/ethernet.ts';
import { runBuilderNatOutboundFlow, validateBuilderNatConfig } from '../src/builder/nat.ts';
import { runBuilderProbe } from '../src/builder/probes.ts';
import { setBuilderOspfRouterEnabled, validateBuilderRoutingConfig } from '../src/builder/routing.ts';

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

function scoreSnapshot(challenge,evidence,hypothesis,snapshot){return scoreBuilderChallenge(challenge,evidence,hypothesis,snapshot.addressing,snapshot.ethernet,snapshot.routing,snapshot.acl,snapshot.nat,snapshot.dhcp,snapshot.linkProfiles,snapshot.services??[]);}

function runApplication(snapshot, serviceId, sequence = 1) {
  return runBuilderApplicationTransaction({ graph:snapshot.graph, addressing:snapshot.addressing, routing:snapshot.routing, ethernet:snapshot.ethernet, linkProfiles:snapshot.linkProfiles, acl:snapshot.acl, nat:snapshot.nat, natSessions:clearBuilderNatSessions(), dhcp:snapshot.dhcp, dhcpLeases:clearBuilderDhcpLeases(), dhcpSequence:1, ipv6:snapshot.ipv6, ipv6ControlState:createBuilderIpv6ControlState(), ipv6RoutingDepth:createDefaultBuilderIpv6RoutingDepthState(snapshot.graph), arpCache:clearBuilderArpCache() }, snapshot.services ?? [], snapshot.sourceId, serviceId, 'ipv4', sequence);
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

function scoreRoutedChallenge(challenge, repairedRouting, boundary = 'ROUTING') {
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
  const hypothesis = { boundary, deviceId:challenge.fault.nodeId };
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


const bgpChallenges=['bgp-contract-001','bgp-contract-002'].map((seed)=>createBgpImportPolicyChallenge(seed));
assert.deepEqual(new Set(bgpChallenges.map((challenge)=>challenge.fault.nodeId)),new Set(['edge','core']),'deterministic BGP seeds must cover forward-prefix and return-prefix import policy faults');
for(const bgpChallenge of bgpChallenges){
  assert.equal(bgpChallenge.family,'bgp-import-policy');
  assert.equal(bgpChallenge.fault.kind,'bgp-import-deny');
  assert.equal(bgpChallenge.fault.boundary,'POLICY');
  assert.deepEqual(bgpChallenge,createBuilderChallenge(bgpChallenge.seed));
  const healthyState=builderBgpState(bgpChallenge.healthy.graph,bgpChallenge.healthy.addressing,bgpChallenge.healthy.routing.bgp);
  const brokenState=builderBgpState(bgpChallenge.broken.graph,bgpChallenge.broken.addressing,bgpChallenge.broken.routing.bgp);
  assert.equal(healthyState.sessions.filter((entry)=>entry.state==='ESTABLISHED').length,2,'BGP-only healthy baseline must establish both eBGP sessions');
  assert.equal(brokenState.sessions.filter((entry)=>entry.state==='ESTABLISHED').length,2,'import-policy fault must not fake a session failure');
  assert.ok(bgpChallenge.broken.routing.bgp.policies.some((rule)=>rule.id===bgpChallenge.fault.blockingPolicy.id),'broken BGP truth must contain the one explicit import deny');
  const repairedBgp=deleteBuilderBgpPolicy(bgpChallenge.broken.graph,bgpChallenge.broken.routing.bgp,bgpChallenge.fault.blockingPolicy.id);
  const repairedRouting=validateBuilderRoutingConfig(bgpChallenge.broken.graph,bgpChallenge.broken.addressing,{...bgpChallenge.broken.routing,bgp:repairedBgp});
  assert.deepEqual(repairedRouting,bgpChallenge.healthy.routing,'BGP policy challenge adds exactly one canonical policy object');
  assert.equal(builderChallengeIsRepaired(bgpChallenge,bgpChallenge.broken.addressing,bgpChallenge.broken.ethernet,bgpChallenge.broken.routing),false);
  assert.equal(builderChallengeIsRepaired(bgpChallenge,bgpChallenge.broken.addressing,bgpChallenge.broken.ethernet,repairedRouting),true);
  scoreRoutedChallenge(bgpChallenge,repairedRouting,'POLICY');
}


const composedChallenges=['multi-contract-001','multi-contract-002'].map((seed)=>createComposedChallenge(seed));
assert.deepEqual(new Set(composedChallenges.map((challenge)=>challenge.fault.kind)),new Set(['missing-default-gateway','ospf-router-disabled']));
for(const c of composedChallenges){
  assert.equal(c.family,'multi-fault');assert.equal(c.difficulty,'COMPOSED');assert.equal(c.secondaryFault?.kind,'acl-objective-deny');assert.deepEqual(c,createBuilderChallenge(c.seed));
  const initial=runPing(c.broken,302);assert.equal(runPing(c.healthy,301).success,true);assert.equal(initial.success,false);assert.equal(builderChallengeRepairStage(c,c.broken.addressing,c.broken.ethernet,c.broken.routing,c.broken.acl,c.broken.nat,c.broken.dhcp,c.broken.linkProfiles,c.broken.services??[]),'NONE');
  const one=structuredClone(c.broken);
  if(c.fault.kind==='missing-default-gateway')one.addressing=structuredClone(c.healthy.addressing);else one.routing=setBuilderOspfRouterEnabled(one.graph,one.addressing,one.routing,c.fault.nodeId,true);
  assert.equal(builderChallengeRepairStage(c,one.addressing,one.ethernet,one.routing,one.acl,one.nat,one.dhcp,one.linkProfiles,one.services??[]),'PRIMARY_ONLY');
  const masked=runPing(one,303);assert.equal(masked.success,false,'one repair must still expose the remaining policy failure');
  const fixed=structuredClone(one);if(c.secondaryFault?.kind!=='acl-objective-deny')throw new Error('Expected composed ACL fault');fixed.acl=deleteBuilderAclRule(fixed.graph,fixed.acl,c.secondaryFault.blockingRule.id);
  assert.equal(builderChallengeRepairStage(c,fixed.addressing,fixed.ethernet,fixed.routing,fixed.acl,fixed.nat,fixed.dhcp,fixed.linkProfiles,fixed.services??[]),'ALL');assert.deepEqual(fixed.addressing,c.healthy.addressing);assert.deepEqual(fixed.routing,c.healthy.routing);assert.deepEqual(fixed.acl,c.healthy.acl);assert.equal(runPing(fixed,304).success,true);
  const o=c.verification,h={boundary:c.fault.boundary,deviceId:c.fault.nodeId,secondaryBoundary:c.secondaryFault.boundary,secondaryDeviceId:c.secondaryFault.nodeId};let e=[];
  e=appendBuilderChallengeEvidence(e,{kind:'ping',sourceId:o.sourceId,destinationId:o.destinationId,success:false,repaired:false,repairStage:'NONE',detail:initial.summary});
  e=appendBuilderChallengeEvidence(e,{kind:'traceroute',sourceId:o.sourceId,destinationId:o.destinationId,success:false,repaired:false,repairStage:'NONE',detail:'Initial composed traceroute fails.'});
  e=appendBuilderChallengeEvidence(e,{kind:'inspect-config',deviceId:c.fault.nodeId,devicePlane:c.fault.plane,repaired:false,repairStage:'NONE',detail:'Inspected first fault.'});
  e=appendBuilderChallengeEvidence(e,{kind:'inspect-state',deviceId:c.secondaryFault.nodeId,devicePlane:c.secondaryFault.plane,repaired:false,repairStage:'NONE',detail:'Inspected second fault.'});
  assert.deepEqual(scoreSnapshot(c,e,h,c.broken),{evidence:30,reasoning:0,repair:0,verification:0,total:30,repaired:false,verified:false,solved:false});
  e=appendBuilderChallengeEvidence(e,{kind:'ping',sourceId:o.sourceId,destinationId:o.destinationId,success:false,repaired:false,repairStage:'PRIMARY_ONLY',detail:masked.summary});
  assert.deepEqual(scoreSnapshot(c,e,h,one),{evidence:40,reasoning:20,repair:0,verification:0,total:60,repaired:false,verified:false,solved:false});assert.equal(scoreSnapshot(c,e,h,fixed).total,85);
  e=appendBuilderChallengeEvidence(e,{kind:'ping',sourceId:o.sourceId,destinationId:o.destinationId,success:true,repaired:true,repairStage:'ALL',detail:'Fully repaired objective passed.'});
  assert.deepEqual(scoreSnapshot(c,e,h,fixed),{evidence:40,reasoning:20,repair:25,verification:15,total:100,repaired:true,verified:true,solved:true});
}

const pmtuChallenge=createIpv6PmtuChallenge('mtu-contract-001');
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


const dnsChallenge=createDnsNameChallenge('dns-contract-001');
assert.equal(dnsChallenge.family,'dns-name');
assert.equal(dnsChallenge.fault.kind,'service-hostname-missing');
assert.deepEqual(dnsChallenge,createBuilderChallenge('dns-contract-001'));
const healthyDnsApp=runApplication(dnsChallenge.healthy,dnsChallenge.verification.serviceId,201);
const brokenDnsApp=runApplication(dnsChallenge.broken,dnsChallenge.verification.serviceId,202);
assert.equal(healthyDnsApp.success,true,healthyDnsApp.summary);
assert.equal(brokenDnsApp.success,false);
assert.equal(brokenDnsApp.firstBrokenBoundary,'DNS');
const brokenDnsService=(dnsChallenge.broken.services??[]).find((service)=>service.id===dnsChallenge.fault.serviceId);
assert.ok(brokenDnsService);
const repairedDnsServices=upsertBuilderHostedService(dnsChallenge.broken.graph,dnsChallenge.broken.services??[],{...brokenDnsService,hostname:dnsChallenge.fault.expectedHostname});
assert.deepEqual(repairedDnsServices,dnsChallenge.healthy.services,'DNS challenge removes exactly one canonical hostname');
let dnsEvidence=[];
dnsEvidence=appendBuilderChallengeEvidence(dnsEvidence,{kind:'application-transaction',sourceId:dnsChallenge.verification.sourceId,destinationId:dnsChallenge.verification.destinationId,serviceId:dnsChallenge.verification.serviceId,success:false,applicationBoundary:brokenDnsApp.firstBrokenBoundary,repaired:false,detail:brokenDnsApp.summary});
dnsEvidence=recordInspection(dnsEvidence,dnsChallenge,'state');dnsEvidence=recordInspection(dnsEvidence,dnsChallenge,'config');
const dnsHypothesis={boundary:'DNS',deviceId:dnsChallenge.fault.nodeId};
assert.deepEqual(scoreBuilderChallenge(dnsChallenge,dnsEvidence,dnsHypothesis,dnsChallenge.broken.addressing,dnsChallenge.broken.ethernet,dnsChallenge.broken.routing,dnsChallenge.broken.acl,dnsChallenge.broken.nat,dnsChallenge.broken.dhcp,dnsChallenge.broken.linkProfiles,dnsChallenge.broken.services),{evidence:40,reasoning:20,repair:0,verification:0,total:60,repaired:false,verified:false,solved:false});
assert.equal(scoreBuilderChallenge(dnsChallenge,dnsEvidence,dnsHypothesis,dnsChallenge.broken.addressing,dnsChallenge.broken.ethernet,dnsChallenge.broken.routing,dnsChallenge.broken.acl,dnsChallenge.broken.nat,dnsChallenge.broken.dhcp,dnsChallenge.broken.linkProfiles,repairedDnsServices).total,85);
const healthyDnsOther=(dnsChallenge.healthy.services??[]).find((service)=>service.id!==dnsChallenge.verification.serviceId&&service.hostname);
assert.ok(healthyDnsOther);
const unrelatedDnsApp=runApplication({...dnsChallenge.broken,services:repairedDnsServices},healthyDnsOther.id,203);
dnsEvidence=appendBuilderChallengeEvidence(dnsEvidence,{kind:'application-transaction',sourceId:dnsChallenge.verification.sourceId,destinationId:dnsChallenge.verification.destinationId,serviceId:healthyDnsOther.id,success:unrelatedDnsApp.success,applicationBoundary:unrelatedDnsApp.firstBrokenBoundary,repaired:true,detail:unrelatedDnsApp.summary});
assert.equal(scoreBuilderChallenge(dnsChallenge,dnsEvidence,dnsHypothesis,dnsChallenge.broken.addressing,dnsChallenge.broken.ethernet,dnsChallenge.broken.routing,dnsChallenge.broken.acl,dnsChallenge.broken.nat,dnsChallenge.broken.dhcp,dnsChallenge.broken.linkProfiles,repairedDnsServices).verified,false,'another healthy service cannot verify the DNS objective');
const repairedDnsApp=runApplication({...dnsChallenge.broken,services:repairedDnsServices},dnsChallenge.verification.serviceId,204);
dnsEvidence=appendBuilderChallengeEvidence(dnsEvidence,{kind:'application-transaction',sourceId:dnsChallenge.verification.sourceId,destinationId:dnsChallenge.verification.destinationId,serviceId:dnsChallenge.verification.serviceId,success:true,applicationBoundary:null,repaired:true,detail:repairedDnsApp.summary});
assert.deepEqual(scoreBuilderChallenge(dnsChallenge,dnsEvidence,dnsHypothesis,dnsChallenge.broken.addressing,dnsChallenge.broken.ethernet,dnsChallenge.broken.routing,dnsChallenge.broken.acl,dnsChallenge.broken.nat,dnsChallenge.broken.dhcp,dnsChallenge.broken.linkProfiles,repairedDnsServices),{evidence:40,reasoning:20,repair:25,verification:15,total:100,repaired:true,verified:true,solved:true});

const transportChallenge=createTransportListenerChallenge('transport-contract-001');
assert.equal(transportChallenge.family,'transport-listener');
assert.equal(transportChallenge.fault.kind,'service-listener-disabled');
assert.deepEqual(transportChallenge,createBuilderChallenge('transport-contract-001'));
const healthyTransportApp=runApplication(transportChallenge.healthy,transportChallenge.verification.serviceId,211);
const brokenTransportApp=runApplication(transportChallenge.broken,transportChallenge.verification.serviceId,212);
assert.equal(healthyTransportApp.success,true,healthyTransportApp.summary);
assert.equal(brokenTransportApp.success,false);
assert.equal(brokenTransportApp.firstBrokenBoundary,'TRANSPORT');
assert.equal(brokenTransportApp.stages.find((stage)=>stage.id==='dns')?.status,'PASS');
assert.equal(brokenTransportApp.protocolEvents.length,0,'disabled listener cannot produce established transport theater');
const brokenTransportService=(transportChallenge.broken.services??[]).find((service)=>service.id===transportChallenge.fault.serviceId);
assert.ok(brokenTransportService);
const repairedTransportServices=upsertBuilderHostedService(transportChallenge.broken.graph,transportChallenge.broken.services??[],{...brokenTransportService,enabled:true});
assert.deepEqual(repairedTransportServices,transportChallenge.healthy.services,'transport challenge changes exactly one canonical listener flag');
let transportEvidence=[];
transportEvidence=appendBuilderChallengeEvidence(transportEvidence,{kind:'application-transaction',sourceId:transportChallenge.verification.sourceId,destinationId:transportChallenge.verification.destinationId,serviceId:transportChallenge.verification.serviceId,success:false,applicationBoundary:brokenTransportApp.firstBrokenBoundary,repaired:false,detail:brokenTransportApp.summary});
transportEvidence=recordInspection(transportEvidence,transportChallenge,'state');transportEvidence=recordInspection(transportEvidence,transportChallenge,'config');
const transportHypothesis={boundary:'TRANSPORT',deviceId:transportChallenge.fault.nodeId};
assert.deepEqual(scoreBuilderChallenge(transportChallenge,transportEvidence,transportHypothesis,transportChallenge.broken.addressing,transportChallenge.broken.ethernet,transportChallenge.broken.routing,transportChallenge.broken.acl,transportChallenge.broken.nat,transportChallenge.broken.dhcp,transportChallenge.broken.linkProfiles,transportChallenge.broken.services),{evidence:40,reasoning:20,repair:0,verification:0,total:60,repaired:false,verified:false,solved:false});
assert.equal(scoreBuilderChallenge(transportChallenge,transportEvidence,transportHypothesis,transportChallenge.broken.addressing,transportChallenge.broken.ethernet,transportChallenge.broken.routing,transportChallenge.broken.acl,transportChallenge.broken.nat,transportChallenge.broken.dhcp,transportChallenge.broken.linkProfiles,repairedTransportServices).total,85);
const repairedTransportApp=runApplication({...transportChallenge.broken,services:repairedTransportServices},transportChallenge.verification.serviceId,213);
transportEvidence=appendBuilderChallengeEvidence(transportEvidence,{kind:'application-transaction',sourceId:transportChallenge.verification.sourceId,destinationId:transportChallenge.verification.destinationId,serviceId:transportChallenge.verification.serviceId,success:true,applicationBoundary:null,repaired:true,detail:repairedTransportApp.summary});
assert.deepEqual(scoreBuilderChallenge(transportChallenge,transportEvidence,transportHypothesis,transportChallenge.broken.addressing,transportChallenge.broken.ethernet,transportChallenge.broken.routing,transportChallenge.broken.acl,transportChallenge.broken.nat,transportChallenge.broken.dhcp,transportChallenge.broken.linkProfiles,repairedTransportServices),{evidence:40,reasoning:20,repair:25,verification:15,total:100,repaired:true,verified:true,solved:true});

for (const challenge of [access, trunk, stp, staticRoute, ospf, aclChallenge, natChallenge, dhcpChallenge, ...bgpChallenges, ...composedChallenges, pmtuChallenge, dnsChallenge, transportChallenge]) {
  const challengeToken = builderChallengeToken(challenge);
  assert.deepEqual(createBuilderChallenge(seedFromBuilderChallengeToken(challengeToken)), challenge, `${challenge.family} token must reproduce exact deterministic truth`);
}

console.log('Builder Track J challenge contract passed: single-fault catalog plus bounded two-fault composition use canonical truth, ordinary diagnostic surfaces, exact repair, objective-scoped verification, causal scoring, reproducible tokens, and no challenge-only network model.');
