# Track F — Routing + policy depth

Track F closes the active-roadmap routing-policy slice by deepening the existing Builder RIB/FIB, OSPF, BGP, and forwarding contracts rather than introducing another network engine.

The central rule is unchanged:

> **configuration and protocol state decide route candidates; the canonical Builder route table decides destination preference; policy may alter a forwarding decision only where that policy is explicitly modeled and inspectable.**

Track F adds general redistribution, policy-based routing, configurable ECMP hashing, intentional summary black holes, deeper BGP policy/route reflection/withdrawal timing, OSPF interface timer policy, and a bounded IS-IS control plane.

## Canonical boundary

Track F lives inside the existing `BuilderRoutingConfig` and `routeTableForBuilderRouter(...)` / `traceBuilderForwarding(...)` pipeline.

It does **not** add:

- a second route table
- a second shortest-path forwarding engine
- policy-only packet paths that probes/application traffic cannot see
- a separate topology for IS-IS
- a hidden redistributed-route feedback loop
- UI state that can override protocol truth

All existing Builder consumers—Ping, Traceroute, ACL/NAT, Track D application traffic, causal diagnosis, and Track E data-plane work—continue to consume the same canonical forwarding trace.

## Additive routing-policy configuration

`BuilderRoutingConfig` now carries a `policy` object containing:

- redistribution rules
- PBR rules
- per-router ECMP profiles
- route summaries
- OSPF interface timers
- IS-IS router/link configuration

Validation, cloning, topology reconciliation, undo/restore, and scenario persistence treat this as canonical configuration. Track F remains additive to Builder scenario **v9**; no schema version is created simply to hold another nested routing configuration object.

Runtime/session state is still not persisted as configuration.

## General redistribution

`BuilderRedistributionRule` names:

- the origin router
- native source protocol
- target protocol
- prefix filter
- target metric
- route tag
- enabled state
- an explicit feedback teaching override

Supported native source families are:

- connected
- static
- OSPF
- BGP
- IS-IS

Supported target families are:

- OSPF
- BGP
- IS-IS

A rule may not redistribute a protocol into itself.

### Native-source guard

The important loop-safety rule is that redistribution consumes **protocol-native routes**, not routes that only exist because a previous Track F redistribution injected them.

Examples:

- static → BGP reads the configured/static RIB source
- BGP → OSPF reads the native configured BGP engine, including locally originated BGP routes
- OSPF → BGP reads native OSPF routes
- IS-IS → OSPF reads native IS-IS routes

A synthetic static→BGP route therefore does not silently become a BGP→OSPF source on a reciprocal rule.

This does not claim real networks are immune to redistribution loops. Instead HOPSCOTCH makes the potential policy hazard explicit while keeping the bounded simulator deterministic.

### Loop hazards

Reciprocal rules over the same prefix scope surface a structured redistribution hazard. The default is `LOOP RISK` with an explanation that redistributed routes are excluded from native-source inputs.

An explicit feedback teaching flag can acknowledge the edge as `FEEDBACK ALLOWED`, but the model still never performs unbounded recursive injection.

### Provenance

Redistributed canonical route rows preserve:

- `redistributedFrom`
- redistribution rule ID
- route tag
- target-protocol route type
- target-protocol metric

OSPF external rows preserve Type-5 / NSSA Type-7 truth. BGP-target routes carry a deterministic teaching community derived from the route tag and the resulting BGP route row is annotated with the source/rule/tag again so provenance is not hidden inside a community string. IS-IS injected routes preserve equivalent source/rule/tag metadata.

## Policy-based routing

PBR is deliberately modeled as a **post-FIB forwarding override**, not a replacement for destination-based route lookup.

For each routed hop HOPSCOTCH first records the normal canonical FIB decision:

- route source
- matched prefix
- normal next hop
- equal-best candidates

Only then is the ordered PBR rule list evaluated against the original packet tuple.

A matching rule may choose a directly connected next hop. The forwarding-hop record preserves both truths:

- `fibRouteSource` / `fibMatchedPrefix` / `fibNextHop`
- `pbrRuleId` / `pbrNextHop`
- actual outgoing link/interface/next node

That distinction makes questions such as “why did this packet leave R2 when the FIB points at R1?” answerable without pretending the FIB itself changed.

PBR next hops must be directly connected. A missing/down policy next hop fails explicitly rather than silently falling back to destination routing.

## ECMP depth

Builder already had deterministic equal-cost forwarding. Track F promotes its hash inputs and width into explicit per-router configuration.

Each router may select:

- **L3** — source/destination IP
- **L4** — protocol + source/destination IP + source/destination port
- **FULL** — L4 tuple plus deterministic discriminator

`maxPaths` is bounded to 1–16.

The configured hash mode changes only which equal-best FIB member a flow selects. It never changes route preference, administrative distance, OSPF metric, or the set of routes considered equal-best.

Forwarding hops expose hash mode, candidate count, selected index, stable flow key, and flow hash.

## Route summarization and intentional black holes

Track F summaries are active only when the configured source protocol actually has a matching more-specific native route at the origin router.

A summary may:

- install a local discard aggregate
- advertise the aggregate into OSPF
- advertise it into BGP
- advertise it into IS-IS

The local discard route uses a deliberately poor administrative distance and an explicit `SUMMARY` source. More-specific routes therefore win normally through longest-prefix match.

Traffic that matches only the aggregate reaches an explicit:

`INTENTIONAL SUMMARY BLACK HOLE`

boundary instead of being reported as a generic missing route.

This makes the classic aggregation failure mode inspectable without manufacturing a destination-specific route.

## BGP policy depth

Track F extends the existing deterministic BGP fixed-point/best-path engine.

### Communities

Policies can now:

- match a community
- add a community
- remove a community
- match numeric teaching communities
- use `NO_EXPORT`
- use `NO_ADVERTISE`

`NO_EXPORT` does not cross an eBGP boundary. `NO_ADVERTISE` is not advertised to any neighbor.

These scopes are export behavior, not UI labels.

### AS-path prepend

Export policy may prepend the local ASN a bounded number of times before normal eBGP advertisement. The resulting AS path goes through the same existing BGP best-path comparison.

### Route reflection

Normal iBGP split horizon remains the default.

An iBGP session may explicitly mark the opposite endpoint as a route-reflector client. Reflection then permits the bounded client/non-client propagation patterns that ordinary iBGP split horizon would block.

Routes carry a deterministic reflection path so the teaching model cannot circulate a reflected route indefinitely.

Route reflection still uses the same BGP RIB, path attributes, next-hop behavior, and best-path engine.

### Withdrawal timing

BGP session configuration now includes a bounded hold timer.

`createBuilderBgpWithdrawalScenario(...)` projects a deterministic sequence:

1. peering transport is lost
2. previously learned routes remain stale before hold expiry
3. hold timer expires
4. routes learned only through that session are withdrawn
5. the normal BGP engine recomputes best paths from the remaining advertisements

The timing projection does not maintain a separate post-failure BGP implementation. Before expiry it presents the canonical pre-failure state as stale; after expiry it derives state using the same BGP engine with that session disabled.

## OSPF interface timer policy

Track F adds per-router/per-link Hello and Dead intervals.

A timer mismatch has a deliberately narrow consequence:

- the **physical Builder link remains UP**
- the OSPF control-plane adjacency is DOWN
- OSPF SPF/RIB/FIB exclude that control edge
- another routing protocol may still use the physical link if its own state permits it

The existing timed OSPF failure panel consumes the configured interface timing rather than always narrating a hard-coded default.

### Why no DR/BDR in Track F

The current routed Builder graph models router-router links as point-to-point adjacencies. OSPF DR/BDR election is a broadcast/NBMA multi-access concept.

Adding an election without first adding a canonical shared L3 segment would create protocol state for a topology object that does not exist. Track F therefore ships the roadmap's **custom OSPF timer policy** branch and intentionally leaves DR/BDR for a future shared-segment model if that topology becomes useful.

## Bounded IS-IS

IS-IS is now worthwhile because Builder already has mature OSPF/BGP RIB/FIB behavior to compare it against.

Track F implements a bounded vendor-neutral IS-IS teaching model over the **same Builder graph**:

- L1
- L2
- L1/L2
- area identifiers
- per-link level compatibility
- physical-link failure
- deterministic SPF using canonical link cost
- equal-cost first hops
- AD 115 route installation
- redistribution source/target support

L1 adjacency/reachability remains area-scoped. L2 supplies inter-area reachability.

IS-IS does not receive a separate canvas, topology authoring model, addressing model, or forwarding trace. Its selected routes enter the same canonical Builder route table beside connected/static/OSPF/BGP routes.

This is intentionally not a complete ISO 10589 implementation: no pseudonode/LAN election system, authentication, overload-bit operational depth, or vendor CLI emulation is claimed.

## Product surface

`BuilderRoutingPolicyPanel` provides one compact advanced routing-policy workspace for:

- redistribution + hazard inspection
- PBR
- ECMP hash mode / width
- summary/discard behavior
- OSPF interface timers
- IS-IS enable/area/level state

The panel explicitly displays the FIB/PBR boundary and native-route redistribution boundary.

Track F also deepens the existing BGP and OSPF timing panels instead of creating duplicate protocol views.

## Lazy-loading and performance

Track E left essentially no initial-JavaScript headroom. Track F therefore treats code-splitting as an architecture requirement, not a budget exception.

The new routing-policy workspace is lazy. Existing BGP and OSPF depth panels are also moved behind lazy boundaries so advanced teaching UI does not become unconditional Builder startup cost.

The canonical routing/forwarding algorithms remain synchronously available because probes and application traffic must consume them immediately.

The artificial stress Builder omits two idle metadata boxes (`ACTIVE PROBE: IDLE` and `STATIC: 0 ROUTES`) that provide no stress-scenario information, reclaiming body-DOM room consumed by the new production chunk graph without widening the 900-node ceiling.

## Permanent contract

`npm run test:builder-routing-policy-contract` is part of `npm run check`.

It permanently covers:

- policy config validation/clone behavior
- static → OSPF redistribution with source/rule/tag provenance
- static → BGP redistribution with canonical BGP-row provenance
- locally originated native BGP → OSPF redistribution
- reciprocal redistribution hazard detection and native-source loop guard
- PBR preserving FIB truth while changing the actual next hop
- L3 vs L4 ECMP hash behavior and bounded path width
- summary discard behavior and longest-prefix precedence
- OSPF timer mismatch with independent physical-link truth
- alternate OSPF convergence around a timer-incompatible adjacency
- bounded IS-IS adjacency/RIB/FIB/forwarding behavior
- ordinary iBGP split horizon vs explicit route reflection
- community match/add/remove
- `NO_EXPORT`
- AS-path prepend
- BGP hold-timer stale/withdraw/recompute projection
- lazy Track F/BGP integration and truth-boundary wording

Every pre-existing Builder/Journey/evidence contract remains required before Track F can close.

## Closeout boundary

Track F is complete only when:

- the full repository contract suite is green
- production performance remains inside the existing ceilings
- Chrome default / disabled-GPU / SwiftShader compatibility is green
- Firefox semantic compatibility is green
- captured PCAP/PCAPNG replay remains green
- no temporary patch workflow/script remains in the PR

Track G owns service-provider and overlay networking. Track F does not pre-implement GRE, IPsec/WireGuard-style tunnel semantics, MPLS, VXLAN, or EVPN.
