# HOPSCOTCH

**See the Internet happen.**

HOPSCOTCH is an interactive, animated network and protocol laboratory built to make invisible network behavior visible—from packet structure and transport dynamics to routing convergence and Internet-scale topology.

The goal is not to recreate Packet Tracer. HOPSCOTCH is an explorable model of networking where motion is part of the explanation: packets, control-plane events, failures, recovery, timelines, and changes in abstraction should be understandable by watching them happen.

## Initial stack

- React + TypeScript + Vite
- Motion for interface, layout, gesture, and state transitions
- Anime.js for choreographed protocol, SVG, and topology animation
- A deterministic simulation/event model kept independent from rendering libraries
- Cloudflare Workers + Static Assets for deployment
- `hopscotch.johnnyli.dev` as the production custom domain

## Product direction

HOPSCOTCH is designed to grow across several scales:

1. **Packet microscope** — inspect and animate packet/header structure.
2. **Protocol theater** — visualize TCP, DNS, TLS, QUIC, ARP/NDP, and other protocol exchanges.
3. **Network sandbox** — build topologies, inject failures, and watch routing/control-plane behavior.
4. **Time machine** — pause, scrub, and replay network events deterministically.
5. **Internet view** — expand toward autonomous systems, peering, infrastructure, and measured/inferred paths.

The first milestone is intentionally vertical rather than broad: establish the rendering architecture, motion language, deterministic event timeline, and one polished end-to-end network scenario before expanding protocol breadth.

## Development

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```

Cloudflare local preview:

```bash
npm run build
npm run cf:dev
```

Cloudflare deployment:

```bash
npm run deploy
```

The production Worker is configured for `hopscotch.johnnyli.dev`. Cloudflare Custom Domains create the required DNS record and certificate when the Worker is deployed.

## Status

Early development. The architecture is being built around the final ambition, but features will be added as polished vertical slices rather than attempting to implement the entire Internet at once.
