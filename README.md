# HOPSCOTCH

**See the Internet happen.**

HOPSCOTCH is an interactive network-systems laboratory for making invisible behavior visible—from individual packet bytes and transport recovery to enterprise routing, overlays, public Internet evidence, troubleshooting, CLI operations, deterministic explanations, and a complete application request moving through a canonical network.

It is not a Packet Tracer clone. HOPSCOTCH treats **time, causality, abstraction, and provenance** as first-class parts of the model. Animation and explanation are projections of canonical state; neither creates network truth.

## Product model

HOPSCOTCH deliberately keeps different kinds of truth separate:

- `SIMULATED` — deterministic Builder, Journey, protocol, packet, routing, policy, queue, overlay, troubleshooting, CLI, and explanation state.
- `CAPTURED` — immutable bytes and fields decoded from an explicitly selected PCAP/PCAPNG file.
- `INFERRED` — relationships or conclusions derived from evidence without pretending they were directly observed.
- `IMPORTED EVIDENCE` — user-selected runtime evidence such as traceroute, route-table, interface, or device-state snapshots.
- `PARSED CONFIG` — bounded Cisco, Juniper, and FRR configuration facts, explicitly distinct from runtime state.
- `LOCAL MEASURED` — Network Diagnostics observations from the local host.
- `EDGE OBSERVED`, `PUBLIC COLLECTOR`, and `PUBLIC DATA` — independently sourced Internet evidence that never becomes simulated forwarding truth.

The central architectural rule is simple: **presentation may explain truth, but presentation cannot manufacture it.**

## What is implemented

### Network Builder

The Builder is the main deterministic network workbench. Its canonical scenario format is currently **schema v9**, with migration from older scenario versions.

Implemented depth includes:

- topology authoring, persistence, import/export, templates, copy/paste, multi-select, alignment, minimap, annotations, search, snapshots, compare, and bounded undo/redo
- IPv4 and IPv6 addressing, connected/static routing, route selection, RIB/FIB projection, ECMP, PBR, summarization/discard routes, and active ping/traceroute probes
- OSPF/OSPFv3 including timed convergence, multiple areas, ABRs, summarization, stub/NSSA behavior, redistribution, and interface timer policy
- BGP including policy, communities, AS prepend, route reflectors, withdrawal behavior, redistribution provenance, and public-facing AS projection
- bounded IS-IS L1/L2/L1L2
- Ethernet switching, VLANs, trunks, native VLAN behavior, ARP/ND, STP/RSTP, LLDP, LACP/EtherChannel, SVIs, routed switch ports, FHRP, and VRFs
- ACLs, NAT/PAT, DHCP/DHCPv6, IPv6 lifecycle/control-plane state, and PMTU behavior
- deterministic application transactions through addressing → L2 → resolution → routing → policy/NAT → transport → TLS → application
- packet queues, serialization delay, ECN/tail drop, bandwidth sharing, traffic generators, fragmentation/PTB/PMTUD, and transport congestion response
- GRE/IP-in-IP, bounded encrypted-tunnel semantics, MPLS, VXLAN, and EVPN
- a Builder-wide deterministic time machine, historical state, protocol databases/counters, and causal `WHY?` diagnosis from the first broken truth boundary
- deterministic troubleshooting challenges that mutate ordinary canonical configuration and score evidence, reasoning, repair, and objective verification
- a vendor-neutral terminal for canonical inspection, IPv4/IPv6 probes, routed device context, and bounded configuration changes through the same Builder mutation paths as the GUI
- an `EXPLAIN` workspace that projects structured cause/effect facts and exact evidence references for network, route, OSPF, policy, packet, application, and event outcomes

The Builder does not maintain separate hidden simulators for application traffic, overlays, troubleshooting, CLI, explanation, or presentation. Those surfaces consume the same canonical state and existing protocol/data-plane engines.


At the product-shell level, one canonical workspace catalog now owns workspace identity, deep links, scale placement, lab/track labels, status copy, Explore grouping, and browser titles. Navigation surfaces consume that catalog rather than maintaining independent copies that can drift. Explore is keyboard-contained and restores focus when closed, and permanent visual corrections live in their owning stylesheets rather than late `*-audit.css` patches.

### Packet Microscope

- Ethernet + IPv4/IPv6 + TCP/UDP/ICMP packet construction
- real IPv4 and transport checksum/length derivation
- raw-byte ↔ field mapping
- exact originating packet bytes from Builder application/probe state
- read-only captured-packet mode with exact evidence lineage

### Protocol Theater

- TCP handshake, loss, retransmission, congestion response, and teardown
- recursive DNS and cache behavior
- TLS 1.3 negotiation and encryption boundaries
- HTTP/2-over-TCP versus HTTP/3-over-QUIC behavior
- captured-protocol projections that keep missing or midstream evidence explicit rather than synthesizing a clean story

### URL Journey + GOD MODE

One canonical Journey explains a URL request across application, DNS, routing, Internet, transport, TLS, packets, time, sharing, and replay.

Composable deterministic modifiers include DNS failure, pre-transport route failure, BGP route leak, HTTP 503/retry, packet loss, active-path outage, latency spike, ECN congestion, and terminal partition state. Different failures retain different causal boundaries instead of collapsing into generic “network down.”

### Captured evidence · Track H

Track T remains the historical first PCAP/PCAPNG slice; the completed product track is **Track H**.

Track H includes:

- explicit local PCAP/PCAPNG import with no upload, sniffing, scanning, credentials, or silent persistence
- immutable captured frames with exact frame → field → byte lineage
- deterministic conversations, semantic events, capture time machine, and FOLLOW FLOW
- bounded TCP byte-stream reconstruction that never invents missing bytes
- retransmission, overlap, out-of-order, midstream, one-direction, and truncation handling
- capture-visible RTT/ACK-delay observations only when the evidence supports attribution
- worker-backed parse/protocol/conversation/index work with deterministic fallback
- aggregate captured-evidence views without inferred topology
- capture-vs-capture comparison
- captured evidence versus canonical simulated counterfactual comparison with provenance kept separate
- strict runtime-evidence sidecars and bounded `PARSED CONFIG` import

### Local measurement + public correlation · Track I

HOPSCOTCH consumes the existing Network Diagnostics report-v2 / loopback bridge as a bounded `LOCAL MEASURED` source.

It can surface local interface, route, DNS, ICMP, traceroute, and transport observations, then—only after an explicit user action—place independently sourced edge/public routing/facility context beyond an explicit observation boundary.

Measured traceroute hops never inherit ASN, facility, or geography claims from unrelated public data. Same-city facility data is context, not proof of traversal. The bridge remains loopback-only, credential-free, fixed-endpoint, explicit-action-only, and does not add LAN discovery or arbitrary command execution.

### Internet scale

- deterministic AS-policy simulation
- independently sourced edge/public-routing evidence with provenance
- PeeringDB-backed physical Internet facility context
- Three.js/WebGL physical Internet globe with honest fallback behavior
- explicit separation between observed/public evidence and inferred geometric corridors

### Troubleshooting challenges · Track J

Track J turns the ordinary Builder into a deterministic troubleshooting environment rather than adding a challenge-only simulator.

It includes single-fault families spanning addressing, DNS, L2, routing, policy, transport, BGP, DHCP, IPv6/PMTU, NAT, ACLs, and bounded two-fault composition. Challenge scoring rewards evidence gathering, causal reasoning, exact canonical repair, and objective post-repair verification. Shareable challenge tokens reproduce the same canonical broken state.

### Vendor-neutral Builder CLI · Track K

Track K provides one terminal over the same Builder truth used by the GUI and Device Workbench.

It supports canonical route/interface/ARP/MAC/OSPF/BGP/ACL/NAT inspection, terminal-local routed-device context, IPv4/IPv6 Ping and Traceroute through the existing probe engines, and bounded configuration commands for OSPF/BGP enablement, endpoint gateway, routed-link state, and static routes. Time Machine remains inspection-only. HOPSCOTCH deliberately does not emulate IOS, Junos, FRR, or device images.

### Explain This Network · Track L

Track L adds deterministic explanation without giving prose or AI authority over the simulator.

The explanation engine first emits a versioned structured fact graph with exact `CONFIG`, `STATE`, `OUTCOME`, and `EVENT` citations. The lazy Builder workspace can explain:

- the current network objective and major protocol/policy state
- why a route won in the RIB and what the FIB is actually forwarding, including explicit convergence divergence
- why an OSPF adjacency is `FULL` or `DOWN`
- why ACL policy permitted or denied the current flow
- why a recorded Ping/Traceroute attempt produced its immutable packet outcome
- why an application transaction succeeded or stopped at its first broken dependency
- why a recorded causal event followed from earlier journal events

`NOVICE`, `OPERATIONAL`, and `PROTOCOL DETAIL` modes change wording only; they preserve the same structured facts and evidence references. A machine-readable query pack may be used by an AI to summarize or answer from cited facts, but it explicitly cannot decide routing, forwarding, policy, protocol state, mutations, outcomes, or provenance.

## Architecture

```text
configuration / captured evidence / measured evidence
        ↓
canonical truth or provenance-bounded evidence store
        ↓
deterministic reducers / protocol models / derived projections
        ↓
time + causal event model
        ↓
workspace-specific camera
        ↓
Motion / Anime.js / SVG / Canvas / WebGL presentation
```

Heavy workspaces are loaded behind lazy boundaries so the overview shell does not absorb Builder, protocol, measured, capture, CLI, explanation, or Three.js implementation cost at startup.

See `docs/ARCHITECTURE.md` for the system boundary, `docs/ROADMAP.md` for active product work, `docs/ROADMAP-MOONSHOTS.md` for deliberately long-horizon ideas, and the individual `docs/TRACK*.md` records for completed track architecture.

## Current roadmap

The completed active integration/depth tracks are:

- **Track H** — captured evidence + replay
- **Track D** — end-to-end application traffic inside Builder
- **Track A** — Builder-wide time machine + causal troubleshooting
- **Track B** — Builder authoring environment
- **Track C** — enterprise L2/L3 depth
- **Track E** — data-plane realism
- **Track F** — routing + policy depth
- **Track G** — service-provider + overlay networking
- **Track I** — native companion/public evidence correlation
- **Track J** — deterministic troubleshooting challenges
- **Track K** — vendor-neutral Builder CLI
- **Track L** — deterministic Explain This Network layer

The regular A–L product roadmap is implemented. The next priority is integrated product hardening: make the completed simulation, evidence, troubleshooting, CLI, and explanation layers work as one coherent product, while keeping the existing performance, provenance, and canonical-truth boundaries intact rather than inventing another lettered track by default.

## Performance and validation

The repository treats performance and compatibility as product contracts rather than informal targets.

`npm run check` runs TypeScript validation plus the Builder, Journey, capture, measurement, navigation/product, native-companion, CLI, troubleshooting, and explanation contract suites before the production build.

The dedicated production profiler enforces versioned structural/semantic budgets for:

- linked initial JavaScript and CSS
- representative DOM and heap use
- high-density Builder, AS, and physical-Internet fixtures
- repeated time-machine seek/churn behavior
- Chrome default, disabled-WebGL, and SwiftShader paths
- Firefox semantic compatibility
- real PCAP/PCAPNG replay

Timing values remain diagnostic; stable bundle/DOM/heap/semantic limits are the enforced gates.

## Stack

- React + TypeScript + Vite
- Motion for UI/layout/gesture/focus transitions
- Anime.js for protocol/topology choreography
- SVG for focused topology/protocol scenes
- Canvas for dense autonomous-system views
- Three.js / WebGL for physical Internet visualization
- Cloudflare Workers + Static Assets for production hosting and public-data adapters

Production is configured for `hopscotch.johnnyli.dev`.

## Development

```bash
npm ci
npm run dev
```

Full correctness/type/build validation:

```bash
npm run check
```

Production performance profiling:

```bash
npm run build
npm run performance:profile
npm run performance:check
```

Use `CHROME_PATH=/path/to/chrome` when browser auto-discovery is not appropriate.

Cloudflare local runtime:

```bash
npm run build
npm run cf:dev
```

Deploy:

```bash
npm run deploy
```
