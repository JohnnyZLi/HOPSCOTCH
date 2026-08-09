# HOPSCOTCH roadmap

## Lab 00 — Foundation

- [x] React/TypeScript/Vite shell
- [x] Motion + Anime.js installed as first-class dependencies
- [x] Initial animated topology field
- [x] Abstraction-scale navigation concept
- [x] Deterministic event model skeleton
- [x] Cloudflare Worker + Static Assets configuration
- [x] Production custom-domain declaration for `hopscotch.johnnyli.dev`
- [x] Lockfile and clean CI run
- [x] First Cloudflare deployment
- [ ] Cross-browser/performance baseline

## Lab 01 — Failure and recovery

- [x] Redundant six-node routed topology
- [x] Active traffic flow
- [x] Link failure injection
- [x] OSPF-style control-plane propagation
- [x] Route recomputation
- [x] Traffic failover
- [x] Timeline pause/scrub/replay
- [x] Event inspector explaining *why* the route changed
- [x] Linux Chromium desktop/mobile visual audit

## Lab 02 — Packet microscope

- [x] Ethernet + IPv4/IPv6 + TCP/UDP deterministic packet model
- [x] IPv4 header checksum and TCP/UDP pseudo-header checksum derivation
- [x] Expand/collapse headers without page changes
- [x] Raw bytes mapped back to selected header fields
- [x] Animate field changes and checksum/length relationships
- [x] Link the captured packet back to the Lab 01 recovery event
- [ ] CI/typecheck validation
- [ ] Linux Chromium desktop/mobile visual audit

## Lab 03 — Protocol theater

- TCP handshake and teardown
- Retransmission and loss
- Congestion-window visualization
- DNS resolution chain
- TLS handshake
- HTTP/2 and HTTP/3/QUIC comparison

## Lab 04 — Network builder

- Drag/drop nodes and links
- Deterministic topology state
- Saved scenarios
- Failure injection controls
- Explainable route selection

## Lab 05 — Internet scale

- Autonomous-system view
- Peering/transit relationships
- IXP/infrastructure overlays
- Measured vs inferred path distinction
- WebGL renderer for dense scenes

## Lab 06 — "What happens when I type a URL?"

A cinematic guided mode that moves through DNS, local neighbor resolution, routing, transport, TLS, HTTP, edge/origin behavior, and return traffic while automatically changing abstraction scale.

## Non-goals

- Emulating every vendor CLI
- Matching Packet Tracer device breadth
- Pretending inferred Internet topology is ground truth
- Adding animation that does not explain state, causality, scale, or interaction
