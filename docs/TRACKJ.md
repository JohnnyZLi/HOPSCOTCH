# Track J — deterministic troubleshooting challenges

Track J turns the existing Builder into a troubleshooting-practice environment without creating a challenge-only network simulator.

This document is the **Track J closeout record**. The track now spans deterministic single-fault troubleshooting across addressing, Layer 2, routing, policy, services, IPv6 PMTU, and BGP plus one bounded two-fault composition mode. Every challenge still consumes the same canonical Builder truth and ordinary diagnostic/repair surfaces.

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

The actual repair controls remain available: endpoint gateway, access VLAN, trunk allow-list, STP toggle, routed configuration, hosted-service hostname/listener configuration, and normal diagnostic surfaces.

## Loading and performance boundary

The challenge generator/scoring core remains in `src/builder/challenges.ts` rather than `NetworkBuilder.tsx`.

The challenge panel is lazy-loaded and is never rendered in the Builder stress harness. New family logic remains model-only until a challenge is started. Track J does not widen existing bundle, DOM, heap, or compatibility ceilings.

## Contract coverage

`npm run test:builder-challenge-contract` now proves:

- same seed → same exact challenge,
- `gateway-*` compatibility with the first slice,
- access-VLAN, trunk-pruning, and STP-loop seed dispatch,
- exactly one canonical fault per current family,
- healthy ordinary routed/LAN/application workflows succeed,
- each broken family fails through the ordinary canonical diagnostic path, including exact DNS vs transport first-broken boundaries,
- STP-disabled loop preserves the useful distinction between ARP reachability and unsafe forwarding,
- share-token round-trip reproduces every family,
- unrelated objective traffic does not count as verification,
- evidence and causal-reasoning scoring,
- exact canonical repair requirement,
- post-repair objective verification requirement.

The test remains part of `npm run check`.

## Track J closeout boundary

Track J is closed as the bounded deterministic troubleshooting product track. The shipped catalog covers gateway/addressing, VLAN/trunk/STP, static routing, OSPF participation, ACL, NAT/PAT, DHCP options, IPv6 PMTU/ND evidence, DNS naming, transport listeners, BGP import policy, and bounded two-fault composition.

Deeper protocol-specific cases remain valid future depth, but they are no longer blockers for Track J. Native-VLAN edge cases, DHCP relay, additional PMTUD variants, BGP best-path/relationship-policy puzzles, and larger procedural generators belong in later depth tracks or the moonshot roadmap.

Difficulty must continue to come from canonical topology, composition, observability, and protocol state—not hidden facts, answer-only state, or misleading text. The long-horizon procedural challenge generator remains Track S3 in `ROADMAP-MOONSHOTS.md`.


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


## Fifth slice — DHCP bootstrap options

Track J now includes a deterministic `dhcp-*` family. The canonical VLAN 10 DHCP client still completes DORA, but the server pool omits the default-gateway option. This is intentionally not modeled as a DHCP timeout: the ACK succeeds and allocates an address while `configurationReady` remains false with `DEFAULT GATEWAY MISSING`.

Diagnosis uses the ordinary DHCP DORA / ACQUIRE surface plus Device Workbench CONFIG / STATE / EVENTS. Repair uses the normal pool GATEWAY editor; the existing pool edit path clears affected leases, so the learner must reacquire and prove a configuration-ready ACK.

Challenge scoring treats an incomplete objective DHCP transaction as 20 points of primary evidence, plus target STATE and CONFIG inspection. The remaining 60 points retain the standard causal-hypothesis, exact canonical repair, and post-repair objective verification contract. DHCP leases and challenge evidence remain session-only; DHCP config remains canonical scenario truth.


## Sixth slice — IPv6 PMTU and neighbor resolution

Track J now includes a deterministic `mtu-*` / `pmtu-*` / `ipv6-mtu-*` family built entirely on the existing IPv6 forwarding, Neighbor Discovery, link-characteristics, and PMTU models.

- The healthy CLIENT → APP baseline enables the existing OSPFv3 control plane and keeps every routed-link MTU at 1500 bytes.
- The broken snapshot changes exactly one deterministic path link from MTU 1500 to 1280; topology, IPv6 addresses, routes, policy, and all other link characteristics stay unchanged.
- A normal 1500-byte IPv6 Ping performs ordinary NS/NA resolution, reaches the constraining hop, receives ICMPv6 Packet Too Big, and learns a session-only PMTU of 1280.
- Successful Neighbor Discovery is explicit narrowing evidence: it demonstrates that next-hop resolution is healthy while full-size delivery fails at the MTU boundary.
- Repair uses the existing selected-link MTU control. Device Workbench now projects routed-link MTU and physical link characteristics beside interface configuration.
- Restoring MTU 1500 earns canonical repair points, but a retry still constrained to 1280 by stale PMTU cache does not verify the objective. Verification requires clearing PMTU state and proving requested bytes = effective transmitted bytes = 1500.

This slice intentionally does not invent a standalone ND-only fault. The current canonical IPv6 model has no independent ND failure knob separate from link, addressing, and routing faults already represented elsewhere. ARP remains ordinary evidence in the existing VLAN/trunk/STP families for the same reason: challenge logic observes neighbor resolution; it does not manufacture it.

PMTU scoring preserves the 100-point contract: Packet Too Big evidence (15) + successful ND narrowing evidence (5) + target STATE (10) + target CONFIG (10), then 20 causal-reasoning points, 25 exact MTU-repair points, and 15 full-size post-repair verification points.


## Seventh slice — DNS names and transport listeners

Track J now promotes the existing Track D hosted-service catalog from derived UI state into canonical Builder scenario configuration. This is a backward-compatible schema-v9 extension: new saves persist `services`, while old v9 scenarios that omit the field normalize to the same deterministic default catalog the application workspace already derived at runtime.

Two new seeded families use that truth:

- `dns-*`: exactly one named APP service loses its canonical hostname. The ordinary application transaction stops at **DNS**; L2, routing, policy, link, transport, TLS, application, and response remain `NOT_REACHED`. Repair is the normal hosted-service hostname editor.
- `transport-*` / `tcp-*` / `listener-*`: exactly one named TCP service keeps its DNS name but has its canonical listener disabled. Addressing, DNS, resolution, routing, policy/NAT, and link truth pass before **TRANSPORT** fails. No `transport.established` event or packet bytes are fabricated for the closed listener. Repair is the normal listener enable control.

Device Workbench CONFIG now projects hosted-service hostname and listener state on endpoint devices. Challenge application evidence is objective-scoped by source, destination, and service ID. An unrelated healthy service cannot verify the repair.

Both families retain the 100-point contract: failed ordinary application transaction at the exact expected first-broken boundary (20) + target STATE (10) + target CONFIG (10), causal hypothesis (20), exact canonical repair (25), and a successful post-repair request to the exact challenged service (15).

The service catalog remains networking truth rather than challenge metadata. Challenge code does not answer DNS queries, open sockets, or decide transaction outcomes; Track D's existing causal transaction consumes canonical service configuration and determines where the request stops.


## Eighth slice — BGP import policy

Track J now includes a deterministic `bgp-*` / `bgp-policy-*` family built on the existing Builder BGP engine. The healthy snapshot is deliberately BGP-only for the CLIENT ↔ APP edge prefixes: OSPF is disabled, EDGE and CORE originate their directly attached endpoint prefixes, and two customer/provider eBGP sessions propagate those routes through R1.

The broken snapshot adds exactly one canonical import-policy object. Depending on the seed, either EDGE denies the APP service prefix on the EDGE ↔ R1 session or CORE denies the CLIENT return prefix on the R1 ↔ CORE session. BGP sessions remain ESTABLISHED; the failure is policy, not fabricated peering loss. Ordinary Ping / Traceroute exposes the reachability break, the BGP RIB and Device Workbench expose route/policy truth, and the existing BGP policy delete control performs the repair.

Scoring remains the common 40 evidence + 20 causal reasoning + 25 exact canonical repair + 15 post-repair objective verification contract. The challenge panel remains absent from stress mode, and no challenge-specific BGP route computation or policy evaluator exists.

## Ninth slice — bounded multi-fault composition and closeout

Track J closes with `multi-*` / `composed-*`, a deliberately bounded two-fault mode rather than a random fault pile.

Two deterministic compositions ship: missing CLIENT default gateway → objective-specific EDGE ACL deny, and disabled OSPF participation on EDGE → objective-specific EDGE ACL deny. Both use the same healthy OSPF-routed CLIENT → APP baseline. The first failure can mask the second; after exactly one repair the objective still fails from the remaining canonical fault.

The composed hypothesis contains two ordered boundary/device pairs. Evidence remains capped at 40: initial failed Ping (10), initial failed Traceroute (10), first-location inspection (5), second-location inspection (5), and a failed objective after exactly one repair (10). Reasoning remains 20 across both ordered hypotheses; exact repair remains 25 only after both faults are canonical; verification remains 15 only after the objective passes at repair stage `ALL`.

Challenge launch/restart no longer auto-focuses mutated devices or links. Every family now opens on the objective source (or LAN/DHCP source), so UI selection state cannot leak the answer location.

The schema/token stays `hopscotch.builder.challenge` v1 / `HOP-J1.<seed>`. Existing seeds preserve previous behavior; composed seeds add optional second-fault metadata and session-only repair-stage evidence.

### Closed Track J product contract

- challenge metadata never changes network truth,
- every fault is a canonical Builder configuration mutation,
- ordinary Builder surfaces provide evidence and perform repairs,
- evidence, hypotheses, scores, and repair stages remain session-only,
- verification is objective-scoped,
- single-fault and composed tokens are deterministic,
- challenge UI remains absent from stress Builder,
- no performance or compatibility ceiling is widened.

