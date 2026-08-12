# Lab 11C — Single-area OSPF in Network Builder

Lab 11C adds a deterministic OSPF teaching control plane on top of the Builder's existing graph, IPv4 addressing, and connected/static forwarding layers.

## Truth boundaries

- **Weighted graph path** answers which physical path has the lowest configured link cost.
- **OSPF Area 0** derives neighbor adjacency, connected-prefix advertisements, SPF results, and OSPF RIB candidates only for routers explicitly enabled for OSPF.
- **L3 forwarding** remains the final hop-by-hop data-plane decision using connected, static, and OSPF routes.

The three layers are deliberately not aliases. A graph can be reachable while L3 forwarding has no route. A static route can override OSPF by administrative distance. OSPF can reconverge dynamically while the same static route remains broken.

## Teaching model

All enabled router interfaces participate in one Area 0. Router-router links become FULL adjacencies when both endpoints participate and the link is active. Failed links remain inspectable as DOWN adjacencies. Enabled routers advertise their active connected prefixes. Deterministic SPF uses the Builder link cost as the OSPF teaching cost and chooses one stable best path; ECMP is intentionally deferred.

Route preference is longest prefix, then administrative distance, then metric, then deterministic ID. Connected uses AD 0, static AD 1, and OSPF AD 110.

## Reconvergence

A link failure, restore, or cost edit changes the Area 0 topology immediately in this deterministic teaching slice. OSPF routes are re-derived from the new state. This is intentionally distinct from the timed Lab 01 failure story: 11C models the resulting control-plane truth rather than pretending to simulate Hello/dead timers, LSA pacing, or vendor-specific SPF scheduling.

## Persistence

Builder schema v5 persists only OSPF configuration (the set of participating routers) alongside graph, addressing, static routes, layout, and endpoint query state. Derived adjacencies, advertisements, SPF paths, and OSPF routes are recomputed after load. Legacy v1-v4 scenarios migrate with OSPF disabled.

## Deferred

- multi-area OSPF and ABRs
- Hello/dead timers and timed convergence
- DR/BDR election and network LSAs
- authentication
- route summarization, redistribution, and external LSAs
- ECMP installation
- vendor CLI emulation
