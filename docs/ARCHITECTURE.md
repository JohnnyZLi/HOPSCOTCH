# HOPSCOTCH architecture

HOPSCOTCH treats animation as a rendering concern, never as the source of simulation truth.

## Layers

### 1. Simulation core

Pure TypeScript state and deterministic events. A scenario is a time-ordered event stream. Given the same scenario and timestamp, HOPSCOTCH must reconstruct the same network state.

This layer should know nothing about React, Motion, Anime.js, SVG, Canvas, WebGL, or Cloudflare.

### 2. Presentation state

Maps simulation state into concepts the user can inspect: selected nodes, active path, protocol phase, failure state, current abstraction layer, and timeline position.

### 3. Motion system

**Motion** owns app-level behavior: panels, navigation, focus changes, layout movement, transitions between abstraction layers, gestures, and camera-like UI state.

**Anime.js** owns choreography inside a visualization: packet movement, protocol sequences, SVG drawing/morphing, propagation waves, topology pulses, and dense timelines.

The libraries should not simultaneously own the same transform/property on the same element.

### 4. Renderers

HOPSCOTCH will use the cheapest renderer that preserves clarity:

- DOM/CSS for controls and text
- SVG for small and medium topology/protocol diagrams
- Canvas/WebGL for high-density scenes and Internet-scale views

A future renderer boundary should allow a logical topology to appear in SVG at small scale and WebGL at large scale without changing simulation semantics.

### 5. Data adapters

Measured, inferred, and simulated data must remain visibly distinct. Real-world adapters may eventually consume traceroute, routing, ASN, IXP, submarine-cable, DNS, and other datasets, but the UI must never present inference as direct measurement.

### 6. Cloudflare edge

The first Worker serves static assets and reserves `/api/*` for future capabilities. Potential later uses include scenario persistence, shared sessions, cached public datasets, live data adapters, and collaboration state.

## Performance rules

- Prefer transforms and opacity for high-frequency DOM motion.
- Do not represent Internet-scale entities as thousands of DOM nodes.
- Keep simulation updates independent from animation frame rate.
- Make every continuous animation cancellable and clean it up on unmount.
- Respect `prefers-reduced-motion` from the start.
- Profile before adding visual density.

## First vertical slice

The first complete scenario should prove the architecture rather than protocol breadth. Proposed slice:

1. Small redundant routed topology.
2. Establish a visible application flow.
3. Fail one link.
4. Animate control-plane propagation and route recomputation.
5. Move traffic to the recovered path.
6. Allow the user to pause and scrub the full sequence.
7. Inspect the relevant packet/protocol events at any timestamp.

That single sequence exercises topology, protocol choreography, deterministic time, state transitions, and explanatory UI.
