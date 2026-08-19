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

---

## Current priority order

The product no longer needs another pile of disconnected protocol demos. The highest-value work is **integration of the systems that already exist**.

### 1. Track B — Builder authoring environment

**Foundations already shipped**

- [x] pure deterministic topology-search engine with exact/prefix/substring ranking and stable zoom targets
- [x] pure deterministic scenario/config compare engine over canonical persisted configuration

**Product integration still required**

- [ ] undo/redo over canonical configuration edits
- [ ] copy/paste, multi-select, marquee selection, alignment, and distribution
- [ ] reusable topology groups/templates and collapsible sites
- [ ] topology-search UI, zoom-to-device, labels/annotations, interface-name visibility, and minimap
- [ ] bulk edits for interface/VLAN/link/device properties
- [ ] scenario snapshots and branches from a clean baseline
- [ ] scenario compare UI using the shipped deterministic compare engine

---

## Remaining regular tracks

These are real product work, but they should follow the integration priorities above unless a later slice depends on them.

### Track C — enterprise Layer 2 / Layer 3 depth

- [ ] RSTP with explicit faster role/state transitions
- [ ] LACP / EtherChannel with logical bundle vs physical-member truth
- [ ] LLDP-style derived neighbor state
- [ ] Layer-3 switches, SVIs, routed switch ports, access/distribution/core designs
- [ ] vendor-neutral VRRP-style first-hop redundancy
- [ ] VRFs with genuinely separate routing tables and overlapping address space
- [ ] native/tagged/untagged VLAN behavior only when it preserves current VLAN truth

### Track E — data-plane realism

- [ ] packet queues, serialization delay, occupancy, capacity, deterministic scheduling
- [ ] tail drop / ECN integrated with existing congestion concepts
- [ ] traffic generators: single flow, bulk TCP, competing flows, constant-rate UDP, bursts
- [ ] deterministic bandwidth sharing and per-flow throughput/latency observations
- [ ] IPv4 fragmentation, DF, ICMP Fragmentation Needed, IPv6 Packet Too Big, PMTU caches
- [ ] PMTUD black-hole scenarios
- [ ] transport congestion/recovery driven by actual Builder link/queue truth

### Track F — routing + policy depth

- [ ] general redistribution between connected/static/OSPF/BGP with explicit provenance and loop hazards; Lab 11M's bounded static→OSPF slice is only the foundation
- [ ] policy-based routing without replacing destination-based forwarding truth
- [ ] ECMP forwarding/hash depth where additional protocol-specific behavior is useful
- [ ] route summarization and intentional black-hole scenarios
- [ ] deeper BGP policy, communities, withdrawal timing, and route-reflector concepts
- [ ] custom OSPF timer policy or DR/BDR broadcast-network behavior only when it materially improves troubleshooting
- [ ] IS-IS only after existing OSPF/BGP depth makes another IGP worthwhile

### Track G — service-provider + overlay networking

- [ ] GRE / IP-in-IP with explicit underlay/overlay separation
- [ ] IPsec-style and WireGuard-style encrypted-tunnel semantics without pretending to implement production cryptography
- [ ] MPLS label push/swap/pop, LSP state, and label forwarding tables
- [ ] VXLAN VNI/VTEP overlays with distinct underlay and overlay reachability
- [ ] EVPN MAC/IP learning after VXLAN/BGP foundations are mature

### Track I — native companion integration

**Shipped boundary:** measured evidence and the loopback-only Network Diagnostics bridge already exist.

- [ ] surface local interfaces, routes, DNS configuration, traceroute/ICMP, and bounded transport telemetry as `LOCAL MEASURED`
- [ ] correlate local measurements with public routing/facility observations without conflating the evidence sources
- [ ] visualize local host → gateway → measured hops → public observations → destination with explicit provenance transitions
- [ ] retain the no-credentials, no-scanning/discovery, no-hidden-background-collection boundary

### Track J — troubleshooting challenges

- [ ] generate deterministic broken networks from canonical configuration/state rather than hand-authored answer text
- [ ] cover addressing, gateway, VLAN, trunk, STP, ARP/ND, routing, OSPF, ACL, NAT, DHCP, MTU, DNS, transport, and BGP policy failures
- [ ] users diagnose with normal Builder inspectors/probes, not challenge-only shortcuts
- [ ] score evidence gathering and causal reasoning, not just the final repair
- [ ] reproducible challenge seeds and shareable scenarios

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