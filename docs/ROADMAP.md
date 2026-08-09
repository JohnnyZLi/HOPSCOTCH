# HOPSCOTCH roadmap

## Lab 00 — Foundation

- [x] React/TypeScript/Vite shell
- [x] Motion + Anime.js installed as first-class dependencies
- [x] Initial animated topology field
- [x] Abstraction-scale navigation concept
- [x] Deterministic event model skeleton
- [x] Cloudflare Worker + Static Assets configuration
- [x] Production custom-domain declaration for `hopscotch.johnnyli.dev`
- [ ] Lockfile and clean CI run
- [ ] First Cloudflare deployment
- [ ] Cross-browser/performance baseline

## Lab 01 — Failure and recovery

Build one polished scenario end to end:

- Redundant four-to-six-router topology
- Active traffic flow
- Link failure injection
- OSPF-style control-plane propagation
- Route recomputation
- Traffic failover
- Timeline pause/scrub/replay
- Event inspector explaining *why* the route changed

## Lab 02 — Packet microscope

- Ethernet + IPv4/IPv6 + TCP/UDP encapsulation
- Expand/collapse headers without page changes
- Animate field changes and checksum/length relationships
- Link packet objects back to events on the global timeline

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
