# HOPSCOTCH moonshot roadmap

This file contains **long-horizon ideas that are deliberately beyond the active product roadmap**.

`docs/ROADMAP.md` is authoritative for current priorities. A moonshot moves into the active roadmap when a real vertical slice is being built and its truth boundary, performance ceiling, and integration path are concrete enough to own.

The invariant never changes: simulation truth remains deterministic, causal, inspectable, and separate from presentation. Captured/measured/public evidence retains provenance and uncertainty. Animation and AI may reveal or explain facts; neither may decide network behavior.

---

## Promotion note — former Track T

The old moonshot **Track T — cinematic captured-data replay** is no longer maintained here as a second roadmap.

Its first flagship slice shipped: local PCAP/PCAPNG import, deterministic capture replay, semantic events, provenance, exact-byte lineage, read-only Packet Microscope, and FOLLOW FLOW. Remaining capture work—TCP stream reconstruction, RTT observations, captured Protocol Theater, aggregate traffic views, worker/off-main-thread parsing, and capture comparison—is now consolidated into **Track H — captured evidence + replay** in `docs/ROADMAP.md`.

`docs/TRACKT.md` remains the implementation record for the shipped first slice.

---

## Moonshot principle — one living network model

The long-term experience should feel less like a collection of simulators and more like one living deterministic network model.

Topology, configuration, control plane, data plane, application traffic, evidence, time, causality, and visual abstraction should be different projections of shared truth. A user should eventually be able to build, observe, break, fork, query, verify, replay, and descend through a network from Internet scale to individual bytes without losing identity or history.

---

## Track M — counterfactual + branching simulation

- [ ] fork the complete deterministic simulation from any historical timestamp without mutating the original timeline
- [ ] compare `ACTUAL` and `COUNTERFACTUAL` branches with synchronized time controls
- [ ] bounded what-if mutations for link state, cost, VLAN membership, ACL action, MTU, gateway, routing policy, NAT rule, and service state
- [ ] preserve common causal ancestry and identify the **first divergent event**, not merely the final-state diff
- [ ] semantic branch diffs for routes/FIB, STP, ARP/ND, ACL, NAT, transport, and application outcomes
- [ ] forward-impact questions such as “what changes if this link fails?”
- [ ] inverse questions such as “what minimal modeled change would have prevented this outage?”
- [ ] named branches, branch history, deterministic export/share
- [ ] measured/captured evidence can be compared with a counterfactual but can never be overwritten by it

The regular-roadmap scenario-compare foundation is a useful precursor; it is not yet counterfactual simulation.

---

## Track N — semantic visualization system

### N1 — X-Ray lenses

- [ ] one topology can project PHYSICAL, L2, L3, CONTROL, POLICY, TRAFFIC, APPLICATION, and CAUSAL lenses
- [ ] every lens consumes the same canonical entities/events rather than creating a separate model
- [ ] transitions preserve entity identity across representations
- [ ] CAUSAL lens suppresses unrelated topology and shows only dependencies participating in the selected outcome
- [ ] bounded composable overlays such as L3 + POLICY or TRAFFIC + QUEUES without visual noise

### N2 — infinite semantic zoom

- [ ] continuous semantic navigation: world → AS → site → topology group → device → interface → flow → packet → header → raw bytes
- [ ] zoom level changes representation/abstraction, not just camera scale
- [ ] preserve selected entity, timestamp, scenario branch, and provenance while crossing renderer/workspace boundaries
- [ ] zoom into an in-flight packet with exact originating state; zoom back out to its route and context
- [ ] reduced-motion alternatives switch semantic views synchronously without losing truth

### N3 — control-plane shockwaves

- [ ] visualize propagation of actual canonical knowledge: STP changes, OSPF LSAs, BGP updates/withdrawals, ARP/ND effects, and downstream application consequences
- [ ] distinguish physical failure → discovery → control-plane propagation → RIB/FIB transition → restored traffic
- [ ] pause propagation and inspect what each device knows at that timestamp
- [ ] aggregate propagation fronts at scale while retaining drill-down to exact events

### N4 — network weather + temporal heatmaps

- [ ] aggregate utilization, latency, jitter, queue pressure, loss, ECN, retransmission intensity, and route churn into readable system-level fields
- [ ] low zoom shows “weather”; high zoom resolves exact links/queues/flows producing it
- [ ] time-window heatmaps for churn, loss, latency, policy drops, and control-plane activity
- [ ] every intensity has an inspectable numeric/semantic source and accessible non-color-only fallback

### N5 — causal cinematography

- [ ] generalized FOLLOW FLOW across simulated and evidence-backed workspaces
- [ ] FOLLOW PACKET, FOLLOW CONTROL PLANE, FOLLOW FAILURE, FOLLOW APPLICATION, FOLLOW ROUTE CHANGE
- [ ] camera focus comes from causal transitions, not a parallel scripted reenactment
- [ ] deterministic replay reproduces the same camera story for demos/teaching/recording

Captured FOLLOW FLOW is a narrow shipped precursor, not completion of this generalized system.

---

## Track O — intent + network verification

- [ ] vendor-neutral intent for reachability, isolation, required ports/services, redundancy, latency/MTU bounds, and route-policy constraints
- [ ] intent stored separately from configuration and runtime state
- [ ] verification returns `PASS`, `FAIL`, `DEGRADED`, or `UNKNOWN` with explicit evidence/counterexamples
- [ ] reachability evaluated over exact protocol/port tuples, not coarse graph connectivity
- [ ] isolation proves modeled prohibited paths are absent rather than merely testing a happy path
- [ ] resilience intent can require continuity under every bounded single-link/device failure
- [ ] behavioral configuration diff: explain consequence such as “EDGE→APP now prefers R2,” not only `cost 20 → 50`
- [ ] violations link directly to causal paths and minimal responsible config/state
- [ ] partial real evidence uses `UNKNOWN` when proof is impossible

---

## Track P — network query + investigation engine

- [ ] one canonical query layer over topology, configuration, state, events, flows, packets, evidence, and scenario branches
- [ ] query results simultaneously focus/highlight the visual network
- [ ] operational forms such as `find flows where dropped = true`, `show routes changed after 12s`, `find devices reachable from VLAN20`, and `why PC-A -> SERVER-3 tcp/443`
- [ ] backward `why` queries traverse deterministic dependency edges to relevant causes
- [ ] forward-impact queries traverse one change to affected routes/flows/applications
- [ ] pin investigation sets and compare them across time/branches
- [ ] GUI search, CLI, challenge tooling, and explanation tooling consume the same query engine
- [ ] queries over captured/measured evidence retain uncertainty and provenance rather than asserting simulator-only causality

The regular roadmap's topology-search and CLI foundations are precursors, not this query engine.

---

## Track Q — Network Universe

- [ ] unified navigable space joins physical Internet, AS policy, site topology, device state, application flows, protocol theater, and Packet Microscope
- [ ] search hostname/prefix/ASN/site/device/interface/flow/packet/event and fly to the corresponding semantic scale
- [ ] world/AS/site/device transitions preserve timeline, branch, selected transaction, and provenance
- [ ] physical geography and logical routing remain visually distinct
- [ ] public facilities/sites can unfold into modeled/internal topology without implying public data revealed private structure
- [ ] DOM/SVG/Canvas/WebGL renderer boundaries disappear as product-navigation concerns
- [ ] focused existing labs remain usable as standalone workspaces and as cameras inside Universe mode

---

## Track R — collaboration + network war room

- [ ] multiple users share one deterministic scenario/canonical state
- [ ] each user has independent camera/lens/selection while sharing simulation time/configuration history
- [ ] configuration changes record author, timestamp, before/after state, and causal consequences
- [ ] annotations attach to devices, flows, packets, events, time ranges, and branches
- [ ] shared incident timeline replays config changes and network consequences
- [ ] instructor mode can inject faults while students use ordinary HOPSCOTCH tools
- [ ] private hypotheses/notes can later be published into the shared investigation
- [ ] collaboration transport never becomes simulation truth

---

## Track S — procedural networks + resilience analysis

### S1 — procedural topology generation

- [ ] deterministic seeded small-office, campus, three-tier enterprise, dual-ISP edge, leaf/spine, ISP-backbone, and intentionally-bad-network generators
- [ ] generated networks include coherent addressing, VLANs, routing, gateways, policy, and services—not decorative random graphs
- [ ] explicit browser/performance ceilings bound topology/protocol complexity
- [ ] seeds reproduce and share exact generated networks
- [ ] generated faults reuse canonical failure mechanisms

### S2 — automated failure-space exploration

- [ ] evaluate every bounded single-link and single-device failure
- [ ] optionally explore selected two-failure combinations/config mutations
- [ ] classify service-preserving, degraded, policy-violating, and outage states using declared intent/application outcomes
- [ ] compute single points of failure and minimal cut sets where tractable
- [ ] cluster equivalent failure outcomes and link each cluster to representative causal traces
- [ ] compare resilience before/after a network change using the same failure set
- [ ] expose exploration coverage; never imply exhaustive proof when analysis is sampled/bounded

### S3 — deterministic challenge generation

- [ ] generate multi-layer faults whose symptoms emerge from the normal simulator
- [ ] difficulty controls fault count, observability, topology scale, protocol depth, and misleading-but-valid secondary symptoms
- [ ] score efficient evidence gathering and causal reasoning
- [ ] seed reproduces exact topology, state, faults, and expected causal explanation

Regular Track J is the productized troubleshooting-challenge path; S3 is the procedural/large-scale endpoint.

---

## Cross-cutting moonshot systems

### Full packet + state lineage

Captured evidence already has exact frame/field/byte lineage. The moonshot is complete lineage across the **simulated** system:

- [ ] application data → TLS/QUIC/TCP unit → IP packet → L2 frame → queue/transmission/drop → feedback/retransmission
- [ ] NAT original/translated tuple lineage and translation state
- [ ] forwarding decision → FIB → selected route → control-plane origin → causal protocol events
- [ ] policy decision → exact ordered rule + pre/post-translation values
- [x] captured evidence never invents ancestors absent from the capture

### Network MRI / dependency cross-section

- [ ] source/destination/application tuple becomes a layered physical → L2 → resolution → routing → policy → translation → DNS → transport → TLS → application dependency stack
- [ ] identify the first broken dependency; later layers become `NOT REACHED`, not falsely failed
- [ ] healthy prerequisites remain inspectable and distinct from unknown evidence
- [ ] click a layer to jump to responsible topology/state/events
- [ ] evaluate the cross-section at historical timestamps and on counterfactual branches

### Automated deterministic root-cause ranking

- [ ] fully simulated scenarios rank causes from exact dependency truth, not probabilistic guessing
- [ ] distinguish initiating cause, propagation mechanism, and user-visible symptom
- [ ] explain why excluded candidates cannot cause the modeled observation
- [ ] partial real evidence switches to evidence-weighted hypotheses with explicit uncertainty

### Physical/logical hierarchy where 3D adds information

- [ ] keep 2D as the default logical Builder
- [ ] optional world → facility → building/floor → rack → device physical hierarchy
- [ ] independent logical overlays over physical hierarchy
- [ ] never conflate physical distance with latency/cost without modeled evidence
- [ ] WebXR/immersive work, if ever attempted, remains renderer-only

---

## Visual quality bar

These are acceptance principles, not independent feature goals:

- animation must encode state, causality, time, hierarchy, magnitude, or interaction
- every animated quantity must be numerically/semantically inspectable
- preserve object identity when crossing abstraction levels
- aggregate dense state progressively instead of producing particle soup
- maintain readable focus/selection and graceful degradation on weaker GPUs
- mobile/reduced-motion modes preserve causal information when choreography is simplified
- typography, spacing, topology geometry, status language, and interaction patterns stay coherent across semantic scales
- the most dramatic visuals should also be the most explanatory: convergence, congestion, lineage, failure recovery, and semantic zoom

---

## Moonshot north star

HOPSCOTCH eventually lets a user:

- build a network and run real deterministic simulated application traffic through it,
- descend from user-visible outcome to exact bytes without changing scenarios,
- break any modeled layer and trace consequences forward or causes backward,
- fork any historical moment and compare actual vs counterfactual timelines,
- declare network intent and verify reachability/isolation/resilience/policy,
- query the network as data while results remain visually navigable,
- move world → AS → site → device → interface → flow → packet → header → bytes and back while preserving time/provenance/branch/selection,
- replay captured/local/public evidence through the same visual language without confusing evidence, simulation, or inference,
- generate coherent networks/faults and explore bounded failure spaces,
- collaborate on one shared investigation while preserving canonical deterministic truth,
- use AI only as an explanation/query interface over structured facts.

**Ultimate target:** one deterministic causal network model that can be built, observed, broken, forked, queried, verified, replayed, and inspected from Internet scale to individual bytes.
