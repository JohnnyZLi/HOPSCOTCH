# Lab 11M — OSPF depth + convergence timing

Lab 11M starts by replacing the old “link down means every router instantly knows” shortcut with an explicit deterministic convergence episode.

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

This is deliberately separate from the future Builder-wide time machine. The important foundation is already present: physical state, neighbor knowledge, LSDB/SPF, RIB, FIB, and user traffic no longer have to transition atomically.

## Deferred remainder of 11M

- per-interface/custom Hello/dead timer configuration
- DR/BDR and broadcast-network adjacency behavior
- multi-area OSPF, ABRs, inter-area routes, and summarization
- stub/NSSA behavior and redistribution

The timing engine should be reused when those features arrive rather than replaced with another convergence model.
