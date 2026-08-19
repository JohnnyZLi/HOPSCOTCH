# Track J — deterministic troubleshooting challenges

Track J turns the existing Builder into a troubleshooting-practice environment without creating a challenge-only network simulator.

This document records the **first vertical slice**, not Track J closeout. The first slice proves the challenge architecture with one bounded fault family: a missing IPv4 default gateway.

## Product invariant

A challenge may choose, mutate, score, and explain canonical Builder truth. It may not invent a second forwarding model, hidden diagnostic state, or hand-authored answer path.

The network remains ordinary `SIMULATED` Builder truth:

- topology and addressing come from canonical Builder configuration,
- routing is produced by the existing routing/OSPF model,
- probes use the existing Builder Ping / Traceroute implementation,
- device facts come from the existing Device Workbench,
- repairs use the same canonical configuration controls available outside challenge mode.

Challenge metadata is deliberately separate session state:

- seed and challenge identity,
- evidence transcript,
- causal hypothesis,
- score and completion state.

None of those fields alter forwarding, protocol state, packet outcomes, or scenario provenance.

## First slice — missing default gateway

`createDefaultGatewayChallenge(seed)` creates a deterministic challenge in four steps:

1. start from the canonical default Builder scenario,
2. enable the existing canonical OSPF model across the routed topology so the healthy baseline has end-to-end reachability,
3. select a routed endpoint deterministically from the seed,
4. clear exactly that endpoint's canonical IPv4 default gateway.

The healthy and broken snapshots are ordinary `BuilderAuthoringSnapshot` values. Restoring the expected gateway makes the broken canonical snapshot equal to the healthy snapshot; there is no answer-only representation of the failure.

The objective endpoint becomes the challenge source. The other routed endpoint is the destination. A healthy ordinary Builder ping must succeed and the broken ordinary Builder ping must fail.

## Determinism and sharing

Challenge schema:

```text
hopscotch.builder.challenge · v1
```

The compact first-slice share token is:

```text
HOP-J1.<encoded seed>
```

The token contains no answer. Replaying the same seed reproduces the same healthy baseline, objective pair, broken canonical configuration, and expected repair.

Challenge evidence and score are session-only and are intentionally not embedded in the token.

## Diagnosis through normal Builder surfaces

Track J does not add a shortcut such as "inspect fault" or a challenge-specific ping implementation.

Evidence can be earned through explicit ordinary actions:

- IPv4 **Ping** against the challenge source → destination objective,
- IPv4 **Traceroute** against the same objective,
- explicit **CONFIG** inspection in Device Workbench,
- explicit **STATE** inspection in Device Workbench.

Device Workbench reports an inspection only when the user explicitly changes the selected device or selects CONFIG / STATE / EVENTS. Merely rendering the workbench does not earn evidence.

Probe scoring is objective-scoped. A successful ping to an unrelated device cannot verify the repair.

## Causal hypothesis

The first slice asks the user to lock two structured facts:

1. the first broken truth boundary,
2. the responsible device.

The current bounded boundary vocabulary is:

- `ADDRESSING`
- `L2`
- `ROUTING`
- `POLICY`
- `TRANSPORT`

For the first fault family, the canonical answer is `ADDRESSING` on the endpoint whose default gateway was removed.

The challenge panel does not reveal that answer until the challenge is solved.

## Scoring

The first-slice score is deterministic and capped at 100:

| Dimension | Points | Requirement |
| --- | ---: | --- |
| Evidence | 40 | failed objective Ping, failed objective Traceroute, target STATE inspection, target CONFIG inspection |
| Reasoning | 20 | correct first-broken boundary and responsible device after probe + inspection evidence exists |
| Repair | 25 | current canonical gateway equals the exact healthy gateway |
| Verification | 15 | successful post-repair Ping or Traceroute against the original objective |

Repair without verification is deliberately incomplete. A user can restore the correct configuration and still remain unsolved until a normal post-repair probe proves the outcome.

Likewise, reaching a working state does not retroactively award causal-reasoning points for an incorrect hypothesis.

## Challenge lifecycle

Starting a challenge snapshots the user's current canonical Builder configuration, then loads the deterministic broken snapshot into the same Builder.

`RESTART SAME SEED` resets:

- canonical challenge configuration,
- runtime/session probe state,
- challenge evidence,
- hypothesis,
- timeline/workbench session state.

`EXIT CHALLENGE` restores the pre-challenge canonical Builder configuration and scenario name. Runtime investigation state remains session-local rather than being merged into the restored scenario.

While a challenge is active, saved-scenario restore, scenario import, and `RESET TOPOLOGY` are blocked so they cannot substitute an unrelated configuration for the exercise. Ordinary Builder configuration editing remains available because repair through the real Builder is the point of the exercise.

## Loading and performance boundary

The challenge generator/scoring core lives in `src/builder/challenges.ts` rather than `NetworkBuilder.tsx`.

The challenge panel is lazy-loaded and is never rendered in the Builder stress harness. Track J does not widen existing bundle, DOM, heap, or compatibility ceilings.

## Contract coverage

`npm run test:builder-challenge-contract` proves:

- same seed → same exact challenge,
- exactly one canonical gateway fault in the first slice,
- healthy ordinary Builder Ping succeeds,
- broken ordinary Builder Ping fails,
- share token round-trip reproduces the challenge,
- unrelated probes do not count toward the objective,
- evidence and causal-reasoning scoring,
- exact canonical repair requirement,
- post-repair objective verification requirement.

The test is part of `npm run check`.

## Remaining Track J work

The first gateway challenge establishes the subsystem; it does not complete Track J.

Next slices should reuse the same challenge/evidence/scoring contracts while adding deterministic canonical fault generators for:

- addressing beyond the default gateway,
- VLAN membership and trunk/native-VLAN failures,
- STP and ARP/ND failures,
- connected/static/dynamic routing failures,
- OSPF adjacency/policy failures,
- ACL and NAT failures,
- DHCP failures,
- MTU / PMTUD failures,
- DNS failures,
- transport failures,
- BGP policy failures.

As the catalog expands, difficulty should come from modeled topology, fault composition, observability, and protocol depth—not from hiding canonical facts or inventing misleading answer text.

The long-horizon procedural challenge generator remains Track S3 in `ROADMAP-MOONSHOTS.md`; Track J is the bounded product path that proves the experience first.
