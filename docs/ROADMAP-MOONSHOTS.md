# HOPSCOTCH moonshot roadmap

This document extends `docs/ROADMAP.md` with the deliberately extreme long-horizon ideas that should make HOPSCOTCH feel less like a polished browser simulator and more like a new class of visual, deterministic network-systems instrument.

The constraint does not change: simulation truth stays canonical, deterministic, causal, inspectable, and separate from presentation. Animation may reveal state; it never creates state. AI may explain derived facts; it never decides routing, forwarding, protocol state, packet outcomes, or evidence provenance.

## Moonshot product principle — one living network model

The long-term experience should feel like interacting with a living digital twin of a network. Topology, control plane, data plane, application traffic, time, evidence, and visual abstraction are different projections of shared truth rather than disconnected reenactments.

A user should eventually be able to build, observe, break, fork, query, verify, replay, and descend through any network from Internet scale to individual bytes while preserving the same causal history.

## Track M — counterfactual + branching simulation

- [ ] fork the complete deterministic simulation from any historical timestamp without mutating the original timeline
- [ ] compare `ACTUAL` and `COUNTERFACTUAL` branches side-by-side with synchronized time controls
- [ ] support bounded what-if mutations such as link state, metric/cost, VLAN membership, ACL action, MTU, routing policy, gateway, NAT rule, and service state
- [ ] preserve common causal ancestry so branch differences identify the first divergent event instead of merely diffing final state
- [ ] render semantic branch diffs for routes, FIB, STP, ARP/ND, ACL decisions, NAT, transport behavior, and application outcomes
- [ ] expose forward-impact queries such as “what changes if this link fails?” and inverse questions such as “what minimal change would have prevented this outage?”
- [ ] allow named scenario branches, branch history, and deterministic branch export/share
- [ ] never let a counterfactual overwrite or masquerade as measured/captured evidence

## Track N — semantic visualization system

### N1 — X-Ray lenses
- [ ] one topology can morph between PHYSICAL, L2, L3, CONTROL, POLICY, TRAFFIC, APPLICATION, and CAUSAL lenses
- [ ] every lens is a projection of the same canonical entities/events rather than a separate model
- [ ] transitions preserve object identity so a physical link can visually become VLAN lanes, routed adjacency, control-plane relationship, or active-flow corridor
- [ ] CAUSAL lens suppresses unrelated topology and shows only dependencies participating in the selected outcome
- [ ] allow composable overlays where useful, for example L3 + POLICY or TRAFFIC + QUEUES, without producing unreadable visual noise

### N2 — infinite semantic zoom
- [ ] continuous semantic navigation from world → AS → site → topology group → device → interface → flow → packet → header → raw bytes
- [ ] zoom level changes abstraction and representation rather than only camera scale
- [ ] preserve selected entity, timestamp, scenario branch, and provenance while crossing renderer/lab boundaries
- [ ] zooming into an in-flight packet can enter Packet Microscope with exact originating state; zooming back out restores its path and context
- [ ] support inverse pull-back from byte/header detail to device, site, AS, and physical-Internet context
- [ ] maintain reduced-motion alternatives that switch semantic views synchronously without losing state

### N3 — control-plane shockwaves
- [ ] visualize propagation of knowledge, not decorative particles: link events, STP topology changes, OSPF LSAs, BGP updates/withdrawals, ARP/ND effects, and application consequences
- [ ] propagation timing is driven by canonical protocol events and timers
- [ ] visually distinguish local physical failure, control-plane discovery, route recomputation, FIB installation, and restored data-plane traffic
- [ ] let users pause a shockwave and inspect what each device knows at that instant
- [ ] collapse to aggregate propagation fronts for large topologies while retaining drill-down to individual protocol events

### N4 — network weather + temporal heatmaps
- [ ] high-level topology can aggregate utilization, latency, jitter, queue pressure, loss, ECN, retransmission intensity, and route churn into readable visual fields
- [ ] low zoom shows system-level “weather”; high zoom resolves the exact links/queues/flows producing it
- [ ] temporal heatmaps accumulate route churn, loss, latency, policy drops, and control-plane activity across a selected time window
- [ ] all intensity encodings have numeric inspectable sources and accessible/non-color-only fallbacks
- [ ] no ambient animation that cannot be tied back to a measurable or simulated quantity

### N5 — flow cinematography
- [ ] cinematic FOLLOW FLOW mode automatically frames the currently relevant device/link/packet while the deterministic timeline runs
- [ ] director modes for FOLLOW PACKET, FOLLOW CONTROL PLANE, FOLLOW FAILURE, FOLLOW APPLICATION, and FOLLOW ROUTE CHANGE
- [ ] cinematic mode hides authoring chrome without hiding truth/provenance or changing simulation behavior
- [ ] camera cuts/morphs are derived from causal focus transitions, not a separate scripted reenactment
- [ ] deterministic replay can reproduce the same camera story for demos, teaching, and exported recordings

## Track O — intent + network verification

- [ ] users can declare vendor-neutral intent such as reachability, isolation, required service ports, redundant-path requirements, latency/MTU bounds, and route-policy constraints
- [ ] intent is stored separately from configuration and runtime state
- [ ] verification computes PASS / FAIL / DEGRADED / UNKNOWN with explicit evidence and counterexamples
- [ ] reachability intent can be evaluated over exact protocol/port tuples instead of coarse device connectivity
- [ ] isolation intent proves prohibited paths are absent under the modeled state rather than only testing a happy-path flow
- [ ] resilience intent can require service continuity under all single-link or single-device failures
- [ ] semantic configuration diff explains behavioral consequence, e.g. “EDGE→APP now prefers R2” rather than only `cost 20 → 50`
- [ ] intent violations link directly to causal paths and minimal responsible configuration/state
- [ ] imported/observed evidence uses `UNKNOWN` where HOPSCOTCH lacks enough information instead of pretending a proof exists

## Track P — network query + investigation engine

- [ ] canonical query layer over topology, configuration, derived state, events, flows, packets, evidence, and scenario branches
- [ ] queries can return entities and simultaneously focus/highlight the visual network
- [ ] support operational forms such as `find flows where dropped = true`, `show routes changed after 12s`, `find devices reachable from VLAN20`, and `why PC-A -> SERVER-3 tcp/443`
- [ ] `why` queries walk backward through deterministic dependency edges to the first relevant causes
- [ ] `what-caused-by` / forward-impact queries walk from a selected change to all affected routes, flows, and applications
- [ ] query results can be pinned as investigation sets and compared across time/branches
- [ ] CLI, GUI search, challenge tooling, and future explanation tooling consume the same query engine
- [ ] queries over captured/measured evidence preserve uncertainty and provenance instead of asserting simulator-only causality

## Track Q — Network Universe

- [ ] unified navigable space joins physical Internet, AS policy, site topology, device state, application flows, protocol theater, and Packet Microscope
- [ ] search for a hostname, prefix, ASN, site, device, interface, flow, packet, or event and fly directly to the corresponding semantic scale
- [ ] world/AS/site/device transitions preserve timeline, branch, selected transaction, and provenance
- [ ] physical geography and logical routing remain visually distinct even when shown together
- [ ] facilities/sites can unfold into internal topology without implying public data reveals private internal structure
- [ ] renderer boundaries (DOM/SVG/Canvas/WebGL) become implementation details behind one semantic navigation system
- [ ] existing labs remain focused workspaces but can also act as zoom levels/cameras inside Universe mode

## Track R — collaboration + network war room

- [ ] multiple users can join one shared deterministic scenario with synchronized canonical state
- [ ] each user can have independent camera/lens/selection while sharing simulation time and configuration history
- [ ] configuration changes record author, timestamp, before/after state, and causal consequences
- [ ] investigation annotations attach to devices, flows, packets, events, timeline ranges, or scenario branches
- [ ] shared incident timeline can replay configuration changes and network consequences in order
- [ ] instructor mode can inject faults while students investigate using normal HOPSCOTCH tools
- [ ] support private per-user hypotheses/notes before optionally publishing them into the shared investigation
- [ ] collaboration transport never becomes simulation truth; the deterministic model remains authoritative

## Track S — procedural networks + resilience analysis

### S1 — procedural topology generation
- [ ] deterministic seeded generators for small office, campus, three-tier enterprise, dual-ISP edge, leaf/spine data center, ISP backbone, and intentionally bad networks
- [ ] generated networks include coherent addressing, VLANs, routing, gateways, policy, and services rather than decorative random graphs
- [ ] topology size and protocol complexity are bounded by explicit browser/performance ceilings
- [ ] deterministic seeds make generated labs reproducible and shareable
- [ ] generated faults are drawn from canonical failure mechanisms, not special-case challenge scripts

### S2 — automated failure-space exploration
- [ ] evaluate every single-link and single-device failure within bounded topologies
- [ ] optionally explore bounded two-failure combinations and selected configuration mutations
- [ ] classify states as service-preserving, degraded, policy-violating, or outage using declared intent/application outcomes
- [ ] compute single points of failure and minimal cut sets for selected services/endpoints where tractable
- [ ] resilience map clusters equivalent failure outcomes and links each cluster to representative causal traces
- [ ] compare resilience before/after a proposed network change using the same deterministic failure set
- [ ] never imply exhaustive proof when exploration was sampled or bounded; expose coverage explicitly

### S3 — deterministic troubleshooting challenge generation
- [ ] generate multi-layer faults whose symptoms are consequences of the normal simulator rather than hand-authored text
- [ ] difficulty controls number of faults, observability, topology scale, protocol depth, and misleading-but-valid secondary symptoms
- [ ] challenge scoring can reward efficient evidence gathering and correct causal reasoning
- [ ] challenge seed reproduces the exact topology, state, fault set, and expected causal explanation

## Track T — cinematic captured-data replay

- [ ] elevate PCAP/PCAPNG import into a flagship capture-replay experience rather than a table viewer
- [ ] reconstruct capture-bounded flows, TCP relationships, DNS exchanges, ICMP, retransmissions, RTT observations, and TLS metadata into a scrub-able event timeline
- [ ] `CAPTURED` packets remain immutable evidence; inferred relationships are separately marked `INFERRED`
- [ ] replay capture activity through Packet Microscope, protocol theater, flow timelines, and aggregate traffic views without fabricating unseen topology
- [ ] packet lineage links application/protocol interpretation back to exact captured frame numbers and bytes
- [ ] support comparison between two captures, before/after captures, or captured evidence versus a simulated counterfactual while keeping provenance visually obvious
- [ ] large captures use indexing/aggregation so users can move from traffic weather to flow to packet without rendering every packet at once
- [ ] capture replay can produce deterministic cinematic FOLLOW FLOW / FOLLOW FAILURE presentations

## Cross-cutting moonshot systems

### Packet + state lineage
- [ ] every simulated packet/segment/frame can expose its ancestry and downstream consequences
- [ ] lineage links application data → TLS/QUIC/TCP unit → IP packet → L2 frame → queue/transmission/drop → feedback/retransmission
- [ ] NAT lineage shows original/translated tuples and translation state responsible for each packet
- [ ] routing lineage links a forwarding decision to FIB entry → selected route → control-plane origin → causal protocol events
- [ ] policy lineage links a permit/drop to the exact ordered ACL/policy rule and pre/post-translation values used for matching
- [ ] captured evidence lineage never invents ancestors that are absent from the capture

### Network MRI / dependency cross-section
- [ ] for any source/destination/application tuple, show a layered dependency stack across physical, L2, next-hop resolution, routing, policy, translation, DNS, transport, TLS, and application
- [ ] identify the first broken dependency while keeping later layers `NOT REACHED` rather than falsely failed
- [ ] healthy layers remain inspectable so troubleshooting can distinguish “working prerequisite” from “unknown”
- [ ] click any layer to jump directly to the responsible topology/state/events
- [ ] cross-section can be evaluated at historical timestamps and on counterfactual branches

### Automated deterministic root-cause ranking
- [ ] for fully simulated scenarios, root-cause candidates derive from exact dependency truth rather than probabilistic guessing
- [ ] rank direct causes above secondary symptoms and explicitly explain why excluded candidates cannot cause the observed failure
- [ ] distinguish initiating cause, propagation mechanism, and user-visible symptom
- [ ] for partial real evidence, switch to evidence-weighted hypotheses with explicit uncertainty rather than fake certainty

### 3D physical/logical hierarchy where it adds information
- [ ] preserve 2D as the default logical Builder; do not turn ordinary topology editing into gratuitous 3D
- [ ] optional spatial hierarchy can represent world → facility → building/floor → rack → device where physical placement is meaningful
- [ ] logical overlays can appear over physical hierarchy while remaining independently toggleable
- [ ] physical and logical distances are never conflated with network latency/cost unless backed by modeled data
- [ ] WebXR/immersive presentation is a renderer-only future experiment, never a separate simulation engine

## Visual quality bar

- [ ] animation must encode state, causality, time, hierarchy, magnitude, or interaction; decorative motion alone does not qualify
- [ ] every animated quantity is inspectable numerically or semantically
- [ ] transitions preserve object identity whenever crossing abstraction levels so users understand that they are seeing the same entity from another view
- [ ] dense states progressively aggregate instead of becoming particle soup
- [ ] high-density views maintain readable focus/selection and graceful degradation on weaker GPUs
- [ ] mobile/reduced-motion modes preserve causal information even when cinematic choreography is simplified
- [ ] typography, spacing, topology geometry, status language, and interaction patterns stay coherent across all semantic scales
- [ ] the most dramatic visuals must also be the most explanatory: control-plane propagation, route convergence, congestion, packet lineage, failure recovery, and semantic zoom

## Moonshot north star

- [ ] build a network, run real simulated application traffic through it, and descend from user-visible outcome to exact packet bytes without changing the underlying scenario
- [ ] break any modeled layer and trace the consequence forward to affected users/services or backward to the exact responsible configuration/state/event
- [ ] fork any historical moment and compare what actually happened with deterministic counterfactual timelines
- [ ] declare network intent and verify reachability, isolation, redundancy, and policy against current and failure states
- [ ] query the network as data while query results remain directly navigable in the visual topology
- [ ] move continuously from world → AS → site → device → interface → flow → packet → header → bytes and back while preserving time, provenance, branch, and selection
- [ ] import captured/local/public evidence and replay it through the same visual language without ever confusing evidence with simulation or inference
- [ ] generate coherent networks/faults, explore bounded failure spaces, and expose single points of failure/minimal cuts where tractable
- [ ] collaborate on one shared investigation while preserving deterministic canonical truth and a complete change/event history
- [ ] use AI only as an explanation/query interface over structured canonical facts, never as the mechanism that decides network behavior

**Ultimate target:** HOPSCOTCH should let a user **build, observe, break, fork, query, verify, replay, and descend through a network from Internet scale to individual bytes—while every view remains a projection of one deterministic causal model.**
