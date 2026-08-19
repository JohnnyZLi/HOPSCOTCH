import assert from 'node:assert/strict';
import {
  appendBuilderChallengeEvidence,
  builderChallengeIsRepaired,
  builderChallengeToken,
  createDefaultGatewayChallenge,
  scoreBuilderChallenge,
  seedFromBuilderChallengeToken,
} from '../src/builder/challenges.ts';
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

const first = createDefaultGatewayChallenge('gateway-contract-001');
const repeated = createDefaultGatewayChallenge('gateway-contract-001');
assert.deepEqual(first, repeated, 'same seed must reproduce the exact challenge snapshot and answer boundary');
assert.equal(first.schema, 'hopscotch.builder.challenge');
assert.equal(first.version, 1);
assert.equal(first.fault.kind, 'missing-default-gateway');
assert.equal(first.fault.boundary, 'ADDRESSING');
assert.equal(first.broken.sourceId, first.fault.nodeId, 'faulted endpoint is the challenge source');
assert.notEqual(first.broken.sourceId, first.broken.destinationId);
assert.equal(first.broken.addressing.defaultGateways[first.fault.nodeId], null, 'broken truth is a canonical missing gateway, not answer text');
assert.equal(first.healthy.addressing.defaultGateways[first.fault.nodeId], first.fault.expectedGateway);
assert.equal(builderChallengeIsRepaired(first, first.broken.addressing), false);
assert.equal(builderChallengeIsRepaired(first, first.healthy.addressing), true);

const restored = structuredClone(first.broken);
restored.addressing.defaultGateways[first.fault.nodeId] = first.fault.expectedGateway;
assert.deepEqual(restored, first.healthy, 'the first challenge introduces exactly one canonical config fault');

const healthyPing = runPing(first.healthy);
const brokenPing = runPing(first.broken);
assert.equal(healthyPing.success, true, `healthy seeded baseline must have end-to-end reachability: ${healthyPing.summary}`);
assert.equal(brokenPing.success, false, 'removing the source default gateway must fail the ordinary Builder probe');

const token = builderChallengeToken(first);
assert.equal(seedFromBuilderChallengeToken(token), first.seed);
assert.deepEqual(createDefaultGatewayChallenge(seedFromBuilderChallengeToken(token)), first, 'share token must reproduce the same deterministic challenge');
assert.throws(() => seedFromBuilderChallengeToken('HOP-J9.nope'), /Unsupported HOPSCOTCH challenge token/);

let evidence = [];
const objectiveProbe = { sourceId: first.broken.sourceId, destinationId: first.broken.destinationId };
const record = (input) => { evidence = appendBuilderChallengeEvidence(evidence, input); };
record({ kind: 'ping', ...objectiveProbe, success: false, repaired: false, detail: brokenPing.summary });
record({ kind: 'traceroute', ...objectiveProbe, success: false, repaired: false, detail: 'Ordinary Builder traceroute fails before the first routed hop.' });
record({ kind: 'inspect-state', deviceId: first.fault.nodeId, repaired: false, detail: 'Inspected endpoint state.' });
record({ kind: 'inspect-config', deviceId: first.fault.nodeId, repaired: false, detail: 'Inspected endpoint config.' });

const correctHypothesis = { boundary: 'ADDRESSING', deviceId: first.fault.nodeId };
const beforeRepairScore = scoreBuilderChallenge(first, evidence, correctHypothesis, first.broken.addressing);
assert.deepEqual(beforeRepairScore, {
  evidence: 40,
  reasoning: 20,
  repair: 0,
  verification: 0,
  total: 60,
  repaired: false,
  verified: false,
  solved: false,
});

const repairedButUnverified = scoreBuilderChallenge(first, evidence, correctHypothesis, first.healthy.addressing);
assert.equal(repairedButUnverified.total, 85);
assert.equal(repairedButUnverified.solved, false, 'canonical repair alone is not enough; a post-repair probe must verify it');

record({ kind: 'ping', sourceId: first.broken.destinationId, destinationId: first.broken.sourceId, success: true, repaired: true, detail: 'A non-objective probe passed.' });
assert.equal(scoreBuilderChallenge(first, evidence, correctHypothesis, first.healthy.addressing).verified, false, 'a successful probe against a different endpoint pair cannot verify the objective');

record({ kind: 'ping', ...objectiveProbe, success: true, repaired: true, detail: healthyPing.summary });
const solved = scoreBuilderChallenge(first, evidence, correctHypothesis, first.healthy.addressing);
assert.deepEqual(solved, {
  evidence: 40,
  reasoning: 20,
  repair: 25,
  verification: 15,
  total: 100,
  repaired: true,
  verified: true,
  solved: true,
});

const wrongHypothesis = scoreBuilderChallenge(first, evidence, { boundary: 'POLICY', deviceId: first.broken.destinationId }, first.healthy.addressing);
assert.equal(wrongHypothesis.reasoning, 0);
assert.equal(wrongHypothesis.total, 80, 'successful repair does not retroactively award causal-reasoning points');

assert.deepEqual(evidence.map((entry) => entry.sequence), [1, 2, 3, 4, 5, 6]);
assert.deepEqual(evidence.map((entry) => entry.id), ['challenge-evidence-1', 'challenge-evidence-2', 'challenge-evidence-3', 'challenge-evidence-4', 'challenge-evidence-5', 'challenge-evidence-6']);

console.log('Builder Track J challenge contract passed: seeded canonical fault, healthy/broken probe truth, share token, objective-scoped evidence scoring, causal hypothesis, exact repair, and post-repair verification.');
