# Lab 11M — OSPF depth + convergence timing

Lab 11M replaces the old “link down means every router instantly knows” shortcut with explicit deterministic convergence, then builds the remaining OSPF teaching depth on that same control-plane truth.

## Timed convergence foundation

- Physical carrier failure is visible to the data plane at `t=0`.
- The OSPF adjacency remains logically `FULL` until the dead timer expires; a missed Hello does not itself withdraw the neighbor.
- Dead-timer expiry, adjacency loss, LSA origination/flooding, SPF scheduling/completion, RIB installation, FIB programming, and traffic recovery are separate ordered events.
- The live physical graph and the OSPF topology used by the RIB/FIB are intentionally allowed to disagree during convergence.
- That disagreement is observable: immediately after `edge-r1` fails, the old FIB still chooses R1 and forwarding fails on the physical link; after FIB programming, the same flow uses R2 and recovers.
- Network Builder exposes a scrub-able convergence inspector with milestone controls and the event sequence.

## ECMP + deterministic per-flow forwarding

- SPF keeps every equal-cost first hop for a best OSPF prefix instead of collapsing ties to a lexical winner.
- Route selection still applies longest prefix, administrative distance, and metric first; hashing happens only inside that equal-best set.
- A stable FNV-1a flow hash selects one member from next hops sorted by stable route identity. Reordering the graph/link arrays cannot move a flow.
- The same flow key remains pinned to one ECMP member until the candidate set changes. Different flow keys can distribute across different members without per-packet spraying.
- If one ECMP member fails and OSPF recomputes, the surviving member becomes the only eligible next hop. Static AD 1 still outranks OSPF AD 110.
- Network Builder exposes an OSPF ECMP inspector with a user-editable flow key plus a small deterministic flow sample so equal-cost paths are visible rather than hidden in the route table.
- Active ICMP probes provide stable per-probe flow keys to ordinary routed/ACL forwarding. NAT-aware probes retain the NAT engine's existing tuple/session truth.

ECMP is forwarding behavior derived from OSPF route state, so it adds no new persisted scenario configuration and does not require a schema bump.

## Multi-area OSPF + ABR summarization

- Routed Builder links carry an OSPF area assignment. Area `0.0.0.0` remains the implicit default, so every existing scenario keeps its original single-area behavior.
- An enabled router attached to Area 0 and at least one non-backbone area is derived as an ABR. Adjacencies and LSDB components are tracked per area.
- Intra-area routes are marked `O`; inter-area routes are marked `O IA`. For the same prefix and AD, `O` is preferred before `O IA`, then metric and ECMP selection apply.
- A router outside the destination area reaches that area through a local ABR, the Area 0 backbone, and a destination-side ABR. A failed backbone path removes the inter-area route rather than fabricating cross-area reachability.
- ABRs can author explicit summary ranges with an explicit summary metric. Covered specifics remain visible inside the source area but are suppressed across that summarizing ABR boundary.
- Equal-cost intra-area or inter-area next hops still feed the deterministic per-flow ECMP engine from the previous slice.
- Area assignments and summaries persist as additive fields inside the existing Builder scenario-v9 routing object; older v9 documents with no area fields normalize to Area 0 and no summaries.

The Builder area inspector exposes per-link area assignment, derived ABR role, attached areas, and summary authoring without adding a second routing truth model.

## Stub / NSSA + bounded redistribution closeout

Lab 11M closes with explicit area behavior and a deliberately bounded redistribution slice rather than a generic protocol-to-protocol redistribution engine.

- Every non-backbone area can be `normal`, `stub`, or `nssa`; Area 0 is always `normal`.
- A non-ABR router inside a stub area receives a deterministic OSPF inter-area default toward a reachable ABR and does not receive OSPF external specifics.
- A non-ABR router inside an NSSA likewise receives an ABR default while retaining the ability to originate explicitly redistributed external information locally.
- The Lab 11 closeout redistribution boundary is **static → OSPF only**. A user selects an existing local static route, the OSPF origin area, and an explicit external metric.
- A static route originated inside a normal area is represented as a Type-5 / `O E1` external.
- A static route originated inside an NSSA is represented as Type-7 / `O N1` inside that NSSA and as a translated Type-5 / `O E1` external after crossing the ABR into normal/backbone OSPF scope.
- A stub area cannot originate external routes. External specifics are suppressed there instead of being silently leaked through the area boundary.
- External Type-1 teaching metrics are deterministic: internal path cost to the ASBR plus the configured redistribution metric.
- Redistribution provenance stays explicit on the route: the backing static route, ASBR, origin area, Type-5/Type-7 boundary, and redistribution identity remain inspectable.
- A redistributed route is withdrawn if the backing static route becomes inactive or is removed; deleting the static route reconciles away the stale redistribution rule.
- Area types and redistribution rules are additive routing fields inside Builder scenario v9; no schema bump or alternate routing truth is introduced.

The Builder OSPF inspector exposes area type plus static redistribution controls. This scope is intentionally narrower than long-term Track F, which still owns general redistribution between connected/static/OSPF/BGP and the associated provenance/loop-hazard work.

## Default teaching timers

- Hello: 10 s
- Dead: 40 s
- LSA flood delay: 200 ms
- SPF delay: 500 ms
- RIB install: 100 ms
- FIB install: 100 ms

These are deterministic teaching defaults, not a claim that every implementation uses these exact operational values.

## Truth boundaries

The convergence inspector is a deterministic counterfactual over the selected active OSPF router-router link. It does not mutate the live Builder graph. The “physical” graph used for actual packet forwarding is the failed-link graph while control/RIB/FIB knowledge advances independently through the event timeline.

Stub/NSSA and redistribution reuse the same canonical Builder routing configuration, area graph, route table, ECMP selection, and forwarding engine. They do not create an OSPF side simulator or bypass ordinary route selection.

This remains deliberately separate from the Builder-wide time machine. The important foundation is present: physical state, neighbor knowledge, LSDB/SPF, RIB, FIB, route provenance, and user traffic do not have to transition atomically.

## Lab 11M closeout boundary

Lab 11M is complete when the stub/NSSA + bounded static-redistribution contract, existing OSPF timing/ECMP/multi-area contracts, repository-wide CI, performance, and compatibility checks are green.

Two deeper OSPF behaviors are intentionally **not** Lab 11 acceptance criteria:

- per-interface/custom Hello/dead timer configuration
- DR/BDR election and broadcast-network adjacency behavior

The current Builder uses explicit deterministic teaching timers and routed point-to-point OSPF adjacency truth. If custom timer policy or broadcast-network DR/BDR behavior later adds material troubleshooting value, it belongs in the long-term routing/protocol-depth roadmap and must extend the existing timing engine rather than replace it.
