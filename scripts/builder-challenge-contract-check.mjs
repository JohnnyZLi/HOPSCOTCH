import assert from 'node:assert/strict';
import {
  appendBuilderChallengeEvidence,
  builderChallengeIsRepaired,
  builderChallengeToken,
  createAccessVlanChallenge,
  createBuilderChallenge,
  createDefaultGatewayChallenge,
  createStpLoopChallenge,
  createTrunkVlanChallenge,
  scoreBuilderChallenge,
  seedFromBuilderChallengeToken,
} from '../src/builder/challenges.ts';
import { resolveBuilderEthernetFlowArp } from '../src/builder/arp.ts';
import { runBuilderEthernetFlow, validateBuilderEthernetConfig } from '../src/builder/ethernet.ts';
import { runBuilderProbe } from '../src/builder/probes.ts';

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
  const before = scoreBuilderChallenge(challenge, evidence, hypothesis, challenge.broken.addressing, challenge.broken.ethernet);
  assert.deepEqual(before, { evidence: 40, reasoning: 20, repair: 0, verification: 0, total: 60, repaired: false, verified: false, solved: false });

  const fixed = scoreBuilderChallenge(challenge, evidence, hypothesis, challenge.broken.addressing, repairedEthernet);
  assert.equal(fixed.total, 85, 'exact canonical repair earns repair points but still requires verification');
  assert.equal(fixed.solved, false);

  evidence = appendBuilderChallengeEvidence(evidence, {
    kind: 'ethernet-flow', sourceId: objective.destinationId, destinationId: objective.sourceId,
    success: true, repaired: true, detail: 'A non-objective LAN flow passed.',
  });
  assert.equal(scoreBuilderChallenge(challenge, evidence, hypothesis, challenge.broken.addressing, repairedEthernet).verified, false, 'a different endpoint pair cannot verify the challenge objective');

  const repairedAttempt = runLan({ ...challenge.broken, ethernet: repairedEthernet }, objective.sourceId, objective.destinationId);
  assert.equal(repairedAttempt.success, true, `repaired ${challenge.family} objective must pass the normal LAN workflow`);
  evidence = appendBuilderChallengeEvidence(evidence, {
    kind: 'ethernet-flow', sourceId: objective.sourceId, destinationId: objective.destinationId,
    success: true, repaired: true, detail: repairedAttempt.detail,
  });
  const solved = scoreBuilderChallenge(challenge, evidence, hypothesis, challenge.broken.addressing, repairedEthernet);
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
assert.equal(builderChallengeIsRepaired(gateway, gateway.broken.addressing, gateway.broken.ethernet), false);
assert.equal(builderChallengeIsRepaired(gateway, gateway.healthy.addressing, gateway.healthy.ethernet), true);

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
assert.deepEqual(scoreBuilderChallenge(gateway, gatewayEvidence, gatewayHypothesis, gateway.broken.addressing, gateway.broken.ethernet), { evidence: 40, reasoning: 20, repair: 0, verification: 0, total: 60, repaired: false, verified: false, solved: false });
gatewayRecord({ kind: 'ping', sourceId: gatewayObjective.sourceId, destinationId: gatewayObjective.destinationId, success: true, repaired: true, detail: healthyPing.summary });
assert.deepEqual(scoreBuilderChallenge(gateway, gatewayEvidence, gatewayHypothesis, gateway.healthy.addressing, gateway.healthy.ethernet), { evidence: 40, reasoning: 20, repair: 25, verification: 15, total: 100, repaired: true, verified: true, solved: true });

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
assert.equal(builderChallengeIsRepaired(access, access.broken.addressing, access.broken.ethernet), false);
assert.equal(builderChallengeIsRepaired(access, access.broken.addressing, repairedAccess), true);
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

for (const challenge of [access, trunk, stp]) {
  const challengeToken = builderChallengeToken(challenge);
  assert.deepEqual(createBuilderChallenge(seedFromBuilderChallengeToken(challengeToken)), challenge, `${challenge.family} token must reproduce exact deterministic truth`);
}

console.log('Builder Track J challenge contract passed: gateway plus seeded access-VLAN, trunk-pruning, and STP-loop faults use canonical truth, ordinary probes/LAN+ARP evidence, exact repair, objective-scoped verification, causal scoring, and reproducible tokens.');
