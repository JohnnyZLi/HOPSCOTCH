# Track J — deterministic troubleshooting challenges

Track J turns the existing Builder into a troubleshooting-practice environment without creating a challenge-only network simulator.

This document records the **implemented Track J foundation and Layer-2 expansion**, not Track J closeout. The first slice proved the architecture with a missing IPv4 default gateway. The second slice extends the same contracts through canonical access-VLAN, trunk-pruning, and STP-loop failures.

## Product invariant

A challenge may choose, mutate, score, and explain canonical Builder truth. It may not invent a second forwarding model, hidden diagnostic state, or hand-authored answer path.

The network remains ordinary `SIMULATED` Builder truth:

- topology and addressing come from canonical Builder configuration,
- routed reachability is produced by the existing routing/OSPF model,
- Layer-2 reachability is produced by the existing Ethernet/VLAN/STP/ARP model,
- routed probes use the existing Builder Ping / Traceroute implementation,
- LAN troubleshooting uses the existing `SEND FRAME / PACKET` + ARP workflow,
- device facts come from the existing Device Workbench,
- repairs use the same canonical configuration controls available outside challenge mode.

Challenge metadata is deliberately separate session state:

- seed and challenge identity,
- evidence transcript,
- causal hypothesis,
- score and completion state.

None of those fields alter forwarding, protocol state, packet outcomes, or scenario provenance.

## Challenge families

### Missing default gateway

`gateway-*` seeds use the original routed challenge:

1. start from the canonical default Builder scenario,
2. enable the existing canonical OSPF model across the routed topology so the healthy baseline has end-to-end reachability,
3. select a routed endpoint deterministically from the seed,
4. clear exactly that endpoint's canonical IPv4 default gateway.

The objective endpoint becomes the routed challenge source. A healthy ordinary Builder ping succeeds and the broken ordinary Builder ping fails.

### Access-VLAN mismatch

`vlan-*` / `l2-vlan-*` seeds select one of the canonical VLAN-10 endpoint access links and change exactly that port membership from VLAN 10 to VLAN 20.

The endpoint's own interface stays in VLAN 10. Nothing is rewritten to make the answer convenient. As a result, the existing ARP path computation cannot cross the mismatched access port and the ordinary LAN workflow fails from canonical Ethernet truth.

The repair is the normal **ACCESS VLAN** control on the selected Builder LAN port.

### Trunk VLAN pruning

`trunk-*` / `l2-trunk-*` seeds choose a canonical trunk required by the PC-A → PC-C inter-VLAN path and remove VLAN 20 from that trunk's allow-list while leaving VLAN 10 intact.

The routed router-on-a-stick interfaces, endpoint addressing, and physical links remain healthy. The existing ARP/L2 path model shows where VLAN 20 disappears.

The repair is the normal **ALLOWED VLANs** control on the selected trunk.

### STP disabled on an existing cycle

`stp-*` / `l2-stp-*` seeds keep the canonical VLAN-10 triangle of SW1/SW2/SW3 physically intact and disable canonical STP.

ARP can still observe a reachable path, but `runBuilderEthernetFlow` independently rejects broadcast/unknown-unicast forwarding because VLAN 10 contains a live Layer-2 cycle with STP disabled. That distinction is intentional evidence: address resolution alone does not prove loop-safe forwarding.

The repair is the normal **ENABLE STP** control.

## Canonical one-fault contract

Every current challenge stores ordinary healthy and broken `BuilderAuthoringSnapshot` values.

For each family, restoring the exact mutated canonical field makes the broken snapshot equal to the healthy snapshot:

- gateway → endpoint default gateway,
- access VLAN → access-port VLAN ID,
- trunk → trunk allow-list,
- STP → `stp.enabled`.

There is no answer-only fault representation and no challenge-specific forwarding state.

Alternative edits may make some traffic appear healthy, but repair points require restoration of the exact canonical fault. Verification is scored separately.

## Determinism and sharing

Challenge schema remains:

```text
hopscotch.builder.challenge · v1
```

Share token:

```text
HOP-J1.<encoded seed>
```

The token contains no answer. The seed prefix selects the bounded family while the complete seed reproduces the same healthy baseline, fault location, broken snapshot, objective pair, and expected repair.

Existing `gateway-*` tokens preserve the original gateway-family behavior.

Challenge evidence and score are session-only and are intentionally not embedded in the token.

## Diagnosis through normal Builder surfaces

Track J still does not add an "inspect fault" shortcut or challenge-specific packet engine.

### Routed objective evidence

- IPv4 **Ping** against the challenge source → destination objective,
- IPv4 **Traceroute** against the same objective,
- explicit **CONFIG** inspection in Device Workbench,
- explicit **STATE** inspection in Device Workbench.

### Ethernet objective evidence

- ordinary **SEND FRAME / PACKET** against the challenge LAN source → destination objective,
- the ARP observation produced by that same ordinary LAN attempt,
- explicit **CONFIG** inspection at the primary Ethernet fault location,
- explicit **STATE** inspection at the same location.

Device Workbench reports an inspection only when the user explicitly changes the selected device or selects CONFIG / STATE / EVENTS. Merely rendering the workbench does not earn evidence.

Verification is objective-scoped. A successful routed probe or LAN flow against a different endpoint pair cannot verify the repair.

## Causal hypothesis

The user locks two structured facts:

1. the first broken truth boundary,
2. the primary fault location.

The bounded boundary vocabulary is:

- `ADDRESSING`
- `L2`
- `ROUTING`
- `POLICY`
- `TRANSPORT`

Gateway challenges expect `ADDRESSING` on the affected routed endpoint. Current VLAN/trunk/STP challenges expect `L2` on the switch anchoring the mutated canonical configuration.

The challenge panel does not reveal the expected repair until the challenge is solved.

## Scoring

Every current family is capped at 100:

| Dimension | Routed objective | Ethernet objective | Points |
| --- | --- | --- | ---: |
| Evidence | failed Ping + failed Traceroute + target STATE + target CONFIG | failed LAN flow (15) + observed ARP evidence (5) + target STATE + target CONFIG | 40 |
| Reasoning | correct boundary + primary fault location after diagnostic + inspection evidence | same | 20 |
| Repair | exact healthy canonical field restored | exact healthy canonical field restored | 25 |
| Verification | successful post-repair objective Ping / Traceroute | successful post-repair objective LAN flow | 15 |

For Ethernet challenges, ARP evidence counts whether it succeeds or fails. A successful ARP in the STP challenge is useful narrowing evidence rather than proof that the data plane is safe.

Repair without verification is deliberately incomplete. Reaching a working state does not retroactively award causal-reasoning points for an incorrect hypothesis.

## Challenge lifecycle

Starting a challenge snapshots the user's current canonical Builder configuration, then loads the deterministic broken snapshot into the same Builder.

For Ethernet objectives the challenge also selects the correct LAN source/destination, focuses Device Workbench on the primary fault location, and selects the mutated link when the fault is link-scoped. Those selections are UI/session state; they do not alter network truth.

`RESTART SAME SEED` resets:

- canonical challenge configuration,
- runtime/session probe, ARP, FDB, and flow state,
- challenge evidence,
- hypothesis,
- timeline/workbench session state.

`EXIT CHALLENGE` restores the pre-challenge canonical Builder configuration and scenario name.

While a challenge is active, these configuration-replacement shortcuts are blocked:

- saved-scenario restore,
- scenario import,
- `RESET TOPOLOGY`,
- `RESET LAN`,
- the bulk authoring workspace.

The actual repair controls remain available: endpoint gateway, access VLAN, trunk allow-list, STP toggle, routed configuration, and normal diagnostic surfaces.

## Loading and performance boundary

The challenge generator/scoring core remains in `src/builder/challenges.ts` rather than `NetworkBuilder.tsx`.

The challenge panel is lazy-loaded and is never rendered in the Builder stress harness. New family logic remains model-only until a challenge is started. Track J does not widen existing bundle, DOM, heap, or compatibility ceilings.

## Contract coverage

`npm run test:builder-challenge-contract` now proves:

- same seed → same exact challenge,
- `gateway-*` compatibility with the first slice,
- access-VLAN, trunk-pruning, and STP-loop seed dispatch,
- exactly one canonical fault per current family,
- healthy ordinary routed/LAN workflows succeed,
- each broken family fails through the ordinary canonical diagnostic path,
- STP-disabled loop preserves the useful distinction between ARP reachability and unsafe forwarding,
- share-token round-trip reproduces every family,
- unrelated objective traffic does not count as verification,
- evidence and causal-reasoning scoring,
- exact canonical repair requirement,
- post-repair objective verification requirement.

The test remains part of `npm run check`.

## Remaining Track J work

Gateway + the first L2 families establish the reusable challenge subsystem, but Track J is not closed.

Remaining canonical fault depth includes:

- addressing beyond the default gateway,
- native-VLAN and deeper STP behavior,
- dedicated ARP/ND failures beyond ARP as evidence,
- connected/static/dynamic routing failures,
- OSPF adjacency/policy failures,
- ACL and NAT failures,
- DHCP failures,
- MTU / PMTUD failures,
- DNS failures,
- transport failures,
- BGP policy failures,
- later bounded multi-fault composition after the single-fault catalog is trustworthy.

Difficulty should come from modeled topology, fault composition, observability, and protocol depth—not from hiding canonical facts or inventing misleading answer text.

The long-horizon procedural challenge generator remains Track S3 in `ROADMAP-MOONSHOTS.md`; Track J is the bounded product path that proves the experience first.


## Third slice — routing and OSPF

The routed troubleshooting catalog now includes two additional deterministic canonical fault families:

- `static-*` / `route-*`: a static-only healthy CLIENT ↔ APP baseline loses exactly one required edge/core static route. The ordinary route table and Device Workbench expose the missing route; repair uses the existing ADD / REPLACE STATIC control.
- `ospf-*`: the healthy all-OSPF baseline disables participation on one required edge/core router while physical links remain up. Ordinary Ping / Traceroute, OSPF neighbor/LSDB state, route tables, and Device Workbench expose the resulting control-plane boundary; repair uses the existing ENABLE ON ROUTER control.

Both families keep the same Track J evidence → hypothesis → exact canonical repair → objective verification scoring contract. No challenge-specific route lookup or OSPF state exists.


## Fourth slice — ACL and NAT policy

Track J now includes two deterministic policy families:

- `acl-*` / `firewall-*`: the healthy routed baseline gains one objective-specific ICMP deny on a deterministic EDGE/CORE router. Routing remains healthy; ordinary Ping / Traceroute and Device Workbench expose the policy failure. Repair uses the existing ACL delete control.
- `nat-*` / `pat-*`: the canonical EDGE NAT boundary is disabled. The underlying routed flow may still deliver untranslated, so the objective is explicitly PAT correctness rather than a fabricated reachability outage. The existing NAT RUN OUTBOUND surface produces structured challenge evidence; repair uses the normal ENABLE NAT control and verification requires an actual translated tuple.

The scoring contract remains 40 evidence + 20 causal reasoning + 25 canonical repair + 15 objective verification. NAT evidence awards the 20 diagnostic-flow points when the objective outbound flow is observed without translation, plus normal target STATE and CONFIG inspection.

Challenge scoring now consumes live ACL and NAT configuration in addition to addressing, Ethernet, and routing truth. Evidence and scores remain session-only and never influence ACL evaluation, NAT translation, forwarding, or provenance.
