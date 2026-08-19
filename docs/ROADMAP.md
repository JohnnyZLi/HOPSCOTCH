# HOPSCOTCH roadmap

This is the **active product roadmap**. It is intentionally shorter than the original lab-by-lab checklist.

The detailed lab and track documents remain the implementation record; this file answers four questions:

1. what is already a completed product foundation,
2. what is actively being deepened,
3. what should be built next,
4. what belongs in the separate moonshot roadmap.

HOPSCOTCH still grows as deterministic vertical slices. A slice is complete only when its model truth is explicit, presentation cannot create network state, provenance is preserved, repository contracts are green, and the production artifact remains inside compatibility/performance ceilings.

---

## Completed foundation — lab series through Lab 11

**The implemented lab sequence through Lab 11 is complete.** The old roadmap carried hundreds of completed checkboxes; those are now treated as shipped history rather than active planning work.

### Shipped product foundation

- **Lab 00 — Foundation:** React/TypeScript/Vite, deterministic reducer/event architecture, Motion + Anime.js, Cloudflare runtime/deployment, reduced motion, CI, compatibility, performance budgets.
- **Lab 01 — Failure + recovery:** routed failure injection, OSPF-style convergence, route recomputation, traffic failover, causal replay.
- **Lab 02 — Packet Microscope:** deterministic Ethernet/IP/TCP/UDP packets, exact bytes, checksum/length derivation, layer peeling, field-to-byte inspection.
- **Lab 03 — Protocol Theater:** TCP, DNS, TLS 1.3, HTTP/2, HTTP/3/QUIC teaching models with explicit truth boundaries.
- **Lab 04 — Network Builder foundation:** deterministic graph truth, topology authoring, persistence, import/export, route/path explanation.
- **Lab 05 — Internet scale:** simulated AS policy, observed/public routing evidence, physical-Internet facility globe, explicit `PUBLIC DATA` / `INFERRED` separation.
- **Lab 06 — URL Journey:** one deterministic HTTPS story across application, DNS, routing, Internet, transport, TLS, packets, time, sharing, and replay.
- **Lab 07 — GOD MODE:** composable deterministic DNS/routing/BGP/server/loss/outage/latency/congestion/partition modifiers over one Journey truth model.
- **Measured/native foundation:** explicit `LOCAL MEASURED` provenance, Network Diagnostics report import, measured workspace, bounded loopback-only bridge contract.
- **Lab 10 — Product surface:** Explore launcher, canonical deep links/history, action-first overview, scenario gallery.
- **Lab 11 — Deeper Network Builder:** L3 addressing; connected/static routing; OSPF/OSPFv3; BGP; ping/traceroute; Ethernet switching; VLANs/trunks/inter-VLAN routing; ARP/ND; STP; deterministic link characteristics; ACLs; NAT/PAT; DHCP/DHCPv6; IPv6/dual stack; timed convergence; ECMP; multi-area OSPF/OSPFv3; ABRs/summarization; stub/NSSA behavior; bounded static→OSPF redistribution; device CONFIG / STATE / EVENTS inspection.

Lab 11 closed with the stub/NSSA + bounded redistribution slice. General connected/static/OSPF/BGP redistribution remains later routing-policy depth; it is not hidden Lab 11 work.

Detailed implementation notes remain in the corresponding `docs/LAB*.md` files, especially `docs/LAB11M.md` for the final OSPF closeout.

### Completed active track — Track H captured evidence + replay

Track H promoted the original captured-data moonshot into a complete evidence-analysis product track without weakening the local/session-only boundary.

- [x] explicit local PCAP/PCAPNG import; no upload, sniffing, scanning, credentials, or hidden collection
- [x] immutable `CAPTURED` frames and separately labeled `INFERRED` relationships
- [x] deterministic conversations, semantic events, protocol decoding, provenance, exact-byte lineage, capture time machine, FOLLOW FLOW
- [x] read-only captured Packet Microscope
- [x] bounded parser/index/render limits and dedicated production-browser capture replay contract
- [x] bounded TCP byte-stream reconstruction that never invents missing bytes
- [x] retransmission/overlap/out-of-order/midstream/truncation handling with explicit incomplete-evidence states
- [x] RTT observations only where visible sequence/ACK or TCP timestamp evidence supports them; ambiguous ACK attribution is excluded
- [x] captured Protocol Theater projections with `NOT OBSERVED IN CAPTURE`, `CAPTURE STARTED MID-CONVERSATION`, and `INSUFFICIENT CAPTURE EVIDENCE` states
- [x] aggregate traffic views derived from captured frames/endpoints/conversations without inventing topology
- [x] primary browser parse/protocol/conversation/event/index work runs in a module Worker with deterministic non-Worker fallback
- [x] capture-vs-capture deterministic comparison
- [x] captured evidence vs canonical Journey simulated counterfactual comparison with provenance kept visually separate
- [x] strict traceroute, route-table, interface, and device-state sidecar imports as `IMPORTED EVIDENCE`
- [x] bounded Cisco/Juniper/FRR configuration parsing as `PARSED CONFIG`, distinct from observed runtime state

`docs/TRACKT.md` remains the historical first-slice record. `docs/TRACKH.md` is the Track H closeout architecture and validation record.

### Completed active track — Track D end-to-end application traffic inside Builder

Track D now projects one deterministic application transaction through existing Builder network truth and canonical Journey/Packet models instead of maintaining a parallel application simulator.

- [x] endpoints can host deterministic DNS, HTTP/HTTPS, SSH, generic TCP, and generic UDP services
- [x] one Builder application request consumes the existing DHCP/addressing → ARP/ND → Ethernet/VLAN/STP → routing → ACL/NAT → transport → TLS → application truth
- [x] Builder TCP/QUIC sessions reuse the canonical Lab 03/Journey protocol models instead of creating a second transport simulator
- [x] any frame/packet/segment can open Packet Microscope with exact originating Builder state and bytes
- [x] the same transaction can move between Builder, Protocol Theater, Journey, and Packet Microscope as different cameras on shared canonical truth

The integrated Builder workspace keeps later layers `NOT_REACHED` after the first broken truth boundary, writes ARP/NAT/DHCP/IPv6-control session state back into the same live Builder session, and lazy-loads the Track D workspace so initial production bundle budgets remain unchanged. `docs/TRACKD.md` is the closeout architecture and validation record.

### Completed active track — Track A Builder-wide time machine + causal troubleshooting

Track A makes canonical time and causal diagnosis shared Builder product behavior rather than an inspector-specific reenactment.

- [x] bounded immutable Builder snapshots on a deterministic logical event clock
- [x] scrub / step / replay / LIVE controls and read-only historical mode
- [x] entire Builder scene renders from the selected historical snapshot
- [x] historical CONFIG / STATE / EVENTS workbench and deterministic before/after row diffs
- [x] canonical derived event families across topology, routing, OSPF/BGP, RIB/FIB, STP/FDB, ARP/ND lifecycle, NAT, DHCP, IPv6, probes, L2 forwarding, application stages, and flow outcomes
- [x] timed OSPF convergence projects independent physical/control-plane/RIB/FIB historical truth
- [x] DHCP acquisition/lifecycle stages project protocol-native historical boundaries
- [x] time-native protocol database/counter rows in Device Workbench
- [x] explicit historical runtime projection boundaries for ARP, Ethernet flow/FDB, NAT, IPv6 state, probes, and application transaction history
- [x] causal `WHY?` chains from application outcome through transport, translation, policy, routing, resolution, L2, and underlying state
- [x] deterministic first-broken-truth-boundary diagnosis instead of generic `network down`
- [x] independent physical, L2, resolution, route, policy, translation, link, transport, TLS, application, and response dimensions with `NOT_REACHED` preserved

Application replay consumes Track D's canonical transaction and exposes only the stages visible at the selected event; future success/failure cannot leak backward. Diagnosis never reruns the network. `docs/TRACKA.md` is the architecture and validation record.

### Completed active track — Track B Builder authoring environment

Track B makes the existing Builder model practical to author at scale without creating editor-only network truth.

- [x] bounded undo/redo over canonical configuration snapshots with runtime-state reset on restore
- [x] modifier + marquee multi-select, routed topology copy/paste, alignment, and distribution
- [x] named presentation-only minimap sites plus reusable browser-local routed topology templates
- [x] topology-search UI consuming the shipped deterministic search engine, stable zoom/focus targets, minimap, annotations, and routed interface-name visibility
- [x] bulk canonical device-label, `ethN` interface-renumbering, routed-link cost/state, Ethernet access-VLAN, trunk-allowed-VLAN, and Ethernet link-state edits
- [x] clean authoring baseline plus bounded in-session named branch snapshots and restore
- [x] scenario compare UI consuming the shipped deterministic canonical-configuration compare engine
- [x] two-level lazy authoring boundary so the full editor is closed by default and does not become initial Builder startup cost

Selection, camera, sites, annotations, clipboard state, templates, undo cursor, and branch catalog remain authoring/session metadata. Scenario schema stays v9. `docs/TRACKB.md` is the architecture and validation record.

---

### Completed active track — Track C enterprise Layer 2 / Layer 3 depth

Track C extends the existing canonical Builder Ethernet/routing foundations with enterprise campus behavior without introducing a parallel simulator.

- [x] RSTP with explicit faster role/state transitions
- [x] LACP / EtherChannel with logical bundle vs physical-member truth
- [x] LLDP-style derived neighbor state
- [x] Layer-3 switches, SVIs, routed switch ports, access/distribution/core designs
- [x] vendor-neutral VRRP-style first-hop redundancy
- [x] VRFs with genuinely separate routing tables and overlapping address space
- [x] native/tagged/untagged VLAN behavior that preserves existing VLAN/STP truth

Enterprise state remains additive to scenario v9. Physical LACP members remain visible beneath the logical Port-Channel, FHRP selects the actual first-hop routed device, VRFs never collapse overlapping prefixes into one table, native-VLAN mismatches are explicit, and enterprise algorithms/UI remain behind the already-lazy Builder authoring boundary. `docs/TRACKC.md` is the closeout architecture and validation record.

---

### Completed active track — Track E data-plane realism

Track E adds deterministic data-plane pressure after canonical Builder forwarding has already selected a path. It consumes existing link bandwidth, latency, MTU, and queue capacity rather than creating another routing or topology model.

- [x] packet queues, serialization delay, occupancy, capacity, deterministic scheduling
- [x] tail drop / ECN integrated with canonical Builder queue pressure
- [x] traffic generators: single flow, bulk TCP, competing flows, constant-rate UDP, bursts
- [x] deterministic bandwidth sharing and per-flow throughput/latency observations
- [x] IPv4 fragmentation, DF, ICMP Fragmentation Needed, IPv6 Packet Too Big, PMTU caches
- [x] PMTUD black-hole scenarios
- [x] transport congestion/recovery driven by actual Builder link/queue truth

Track E only runs on the exact link IDs from a successful Track D application transaction. TCP/QUIC sender pressure changes in-band from queue ECN/drop feedback; UDP remains explicitly non-responsive. IPv4 keeps bounded session PMTU state, while IPv6 reuses the pre-existing canonical `BuilderIpv6ControlState` PMTU cache and PTB reverse-route truth. The data-plane workspace remains behind the existing lazy application boundary. `docs/TRACKE.md` is the closeout architecture and validation record.

---

### Completed active track — Track F routing + policy depth

Track F deepens the existing canonical Builder RIB/FIB and protocol state instead of adding another forwarding simulator.

- [x] general redistribution between connected/static/OSPF/BGP/IS-IS with explicit source/rule/tag provenance and bounded reciprocal-loop hazards
- [x] policy-based routing that preserves the normal destination FIB decision while recording the policy next-hop override separately
- [x] configurable per-router ECMP hash depth (L3 / L4 / full discriminator) and bounded max-path width
- [x] route summarization with explicit low-preference discard aggregates and intentional black-hole outcomes
- [x] deeper BGP policy: community match/add/remove, NO_EXPORT / NO_ADVERTISE, bounded AS prepend, route-reflector clients, and hold-timer withdrawal/recompute projection
- [x] custom OSPF interface Hello/Dead timers with timer mismatch represented as control-plane adjacency failure while the physical link stays independent
- [x] bounded vendor-neutral IS-IS L1/L2/L1L2 over the same Builder graph/addressing/link-cost truth

Redistribution reads protocol-native routes by default so a route created only by redistribution does not recursively become another protocol's source. OSPF Type-5/Type-7, BGP, and IS-IS route rows retain redistribution provenance. PBR records both the selected FIB route and the actual policy next hop. Summary discard is an explicit failure boundary rather than generic no-route. Track F intentionally ships the roadmap's OSPF timer-policy branch instead of DR/BDR because the current routed Builder topology is point-to-point; a broadcast election without a canonical shared L3 segment would invent topology. Track F remains additive to scenario v9 and advanced UI stays lazy. `docs/TRACKF.md` is the closeout architecture and validation record.

---

### Completed active track — Track G service-provider + overlay networking

Track G adds explicit service-provider and overlay behavior while preserving the existing Builder topology/RIB/FIB as underlay truth.

- [x] GRE / IP-in-IP with explicit inner-vs-outer addressing, canonical underlay link paths, encapsulation overhead, and effective tunnel MTU
- [x] IPsec-style and WireGuard-style authentication/handshake/overhead semantics without storing key material or pretending to implement production cryptography
- [x] MPLS label push/swap/pop, bounded LSP state, and per-router label forwarding rows derived from the canonical underlay path
- [x] VXLAN VNI/VTEP overlays with explicit UDP/4789 outer state and underlay-driven UP / DEGRADED / DOWN reachability
- [x] EVPN Type-2 MAC/IP and Type-3 IMET teaching state with route-target/VTEP provenance, Track F iBGP split-horizon / route-reflector behavior, and independent underlay reachability

Unknown-MAC ingress replication is observable but never treated as proof of destination delivery. Overlay learning never rewrites or substitutes for the underlay RIB/FIB. Provider configuration remains additive to scenario v9, while the heavier tunnel/MPLS/VXLAN/EVPN algorithms and UI stay behind the existing lazy routing-policy workspace. `docs/TRACKG.md` is the closeout architecture record.

---

### Completed active track — Track I native companion integration

Track I connects the existing Network Diagnostics report-v2 / loopback companion evidence to HOPSCOTCH's public Internet evidence without collapsing provenance.

- [x] surface local interfaces, routes, DNS configuration, traceroute/ICMP, and bounded transport telemetry as `LOCAL MEASURED`
- [x] correlate local measurements with edge, public-routing, and public-facility context without conflating evidence sources
- [x] visualize local host → gateway → measured hops → explicit observation boundary → public observations → destination with provenance on every stage
- [x] retain the no-credentials, no-scanning/discovery, no-hidden-background-collection boundary

The existing report-v2 adapter already carried the required native facts, so Track I does not broaden the Network Diagnostics bridge or add a command API. Public context loads only after an explicit action and reuses the existing HOPSCOTCH Internet-evidence and PeeringDB APIs. Measured traceroute hops never inherit an ASN, facility, or location from independent public data; same-city facilities are context rather than proof of traversal. `docs/TRACKI.md` is the closeout architecture record.

---

## Current priority order

Captured evidence, application truth, causal replay, authoring, enterprise depth, data-plane realism, routing policy, provider overlays, native/public evidence correlation, and deterministic troubleshooting practice are now closed product tracks.

### Completed active track — Track J troubleshooting challenges

- [x] deterministic broken networks come from canonical Builder configuration/state rather than hand-authored answer text
- [x] catalog spans gateway/addressing, VLAN, trunk, STP, ARP/ND evidence, static/OSPF routing, ACL, NAT, DHCP, IPv6 PMTU, DNS, transport, and BGP import policy
- [x] diagnosis and repair use ordinary Builder probes, inspectors, Workbench, and canonical controls
- [x] scoring separates evidence, causal reasoning, exact repair, and objective verification
- [x] reproducible `HOP-J1` seeds preserve deterministic truth
- [x] bounded two-fault composition requires ordered hypotheses and proof that a second fault remains after one repair
- [x] challenge launch no longer auto-focuses mutated devices/links

`docs/TRACKJ.md` is the closeout architecture and validation record.

---

## Current priority order

### 1. Track K — vendor-neutral HOPSCOTCH CLI

Track K is now the highest-value regular product track. Its read-only command model already exists; the next slice should expose the actual Builder terminal surface before expanding protocol commands.

---

## Remaining regular tracks

These remain real product work. They should follow Track K unless a bounded dependency requires a different order.

### Track K — vendor-neutral HOPSCOTCH CLI

**Shipped foundation**

- [x] read-only deterministic command model for `show interfaces`, `show route`, `show arp`, and `show mac`
- [x] CLI foundation consumes supplied canonical facts and rejects unsupported/configuration syntax rather than inventing behavior

**Remaining**

- [ ] actual CLI/terminal interaction surface in Builder
- [ ] `show ospf neighbors`, `show bgp`, `show acl`, `show nat`, `ping`, and `traceroute`
- [ ] later bounded configuration commands mutate the same canonical configuration as the GUI
- [ ] deliberately avoid broad Cisco/Juniper syntax emulation or device-image behavior

### Track L — explain-this-network layer

- [ ] simulator emits structured cause/effect facts before natural-language explanation exists
- [ ] explanations cite the exact canonical configuration/state/events they interpret
- [ ] summarize why a route was selected, packet was dropped, adjacency changed, or application failed
- [ ] novice / operational / protocol-detail explanation levels change wording, never simulation truth
- [ ] AI may explain/query canonical facts but never decides routing, forwarding, packet outcomes, protocol state, or evidence provenance

---

## Cross-track north star

The next era of HOPSCOTCH is complete when a workstation can:

1. obtain deterministic host configuration,
2. resolve its next hop,
3. cross switched and routed domains,
4. traverse routing policy / ACL / NAT,
5. resolve DNS,
6. establish TCP or QUIC + TLS,
7. exchange an application request,
8. expose the exact originating frames/packets/bytes,
9. replay the complete causal history,
10. explain why the observed outcome followed from configuration and state.

Every view should be a projection of shared canonical truth rather than a disconnected lab-specific reenactment. Failures remain composable across layers while preserving the exact boundary where each failure occurs. Time, causality, provenance, determinism, and inspectability remain first-class.

---

## Performance + rendering invariants

Already shipped and permanently enforced:

- DOM/CSS for controls and text
- SVG for focused topology/protocol scenes
- Canvas for dense AS scenes
- WebGL for physical-Internet scale
- explicit renderer/performance budgets
- high-density stress scenarios
- Chrome default / disabled GPU / SwiftShader, Firefox semantic, capture-replay, mobile, and reduced-motion coverage

New roadmap work must fit those ceilings or justify a deliberate architecture change; feature work should not silently solve regressions by widening budgets.

---

## Non-goals

- emulating every vendor CLI
- matching Packet Tracer device breadth for its own sake
- adding protocols only to increase protocol count
- pretending inferred Internet topology is ground truth
- presenting public collector observations as the viewer's measured forwarding path
- allowing animation, AI, or UI state to become simulation truth
- adding motion that does not explain state, causality, hierarchy, magnitude, time, or interaction

The deliberately extreme long-horizon work now lives only in `ROADMAP-MOONSHOTS.md`.