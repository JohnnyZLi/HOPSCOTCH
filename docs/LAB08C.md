# Lab 08C — Browser and GPU compatibility

Lab 08C completes the current renderer-hardening phase by testing the exact production artifact across materially different browser and GPU/runtime environments without allowing renderer capability to change canonical network truth.

## Truth boundary

Browser engine, GPU backend, WebGL availability, viewport implementation, and reduced-motion support are runtime/rendering facts. They must not change:

- Journey event ordering or scenario identity
- routing, transport, DNS, application, congestion, partition, or policy outcomes
- simulated/public/measured provenance
- modifier composition

A renderer may fall back. Canonical state may not silently change to accommodate that fallback.

## Chrome GPU matrix

The existing production CDP profiler was extended in a compatibility-only mode. The normal Performance workflow and Lab 08A/08B budgets remain separate.

Hosted Chrome is exercised in three process-level modes:

1. `default` — the hosted runner's normal WebGL path
2. `swiftshader` — explicit ANGLE + SwiftShader software rendering
3. `disabled` — WebGL/WebGL2 deliberately disabled

All three modes run the same representative semantic profiles:

- maximum composed terminal-partition Journey
- reachable-but-policy-invalid route leak
- mobile route-leak layout
- reduced-motion QUIC route-leak state
- 160-AS / 220-relationship Canvas stress fixture
- 32-node / 96-link Builder ceiling
- 2,000-point simulated Physical fixture

Default and SwiftShader require an actual Physical WebGL canvas. Disabled mode requires the existing product fallback instead:

- `RENDERER = FALLBACK`
- `WEBGL 2 UNAVAILABLE`
- no globe WebGL canvas
- the deterministic 2,000-point fixture remains inspectable as data
- HOPSCOTCH does not substitute a fake 3D renderer

The first complete hosted matrix passed in all three modes. The deliberate WebGL-disabled run reached the real fallback while Journey, Canvas, Builder, overflow, viewport-stability, and semantic assertions remained intact.

## Firefox as a real second engine

The hosted Ubuntu runner exposes:

- Firefox **152.0.6**
- GeckoDriver **0.37.0**
- a working headless WebDriver session
- WebDriver BiDi with `log.entryAdded` subscription

That is sufficient for genuine second-engine semantic coverage rather than treating Chrome flags as “cross-browser.”

The Firefox production runner injects the same exact Vite `dist/` HTML/CSS/JS artifact and verifies:

- terminal partition state at 1440 px
- route leak at 1440 px
- route leak at an exact **390 × 844** viewport using BiDi `browsingContext.setViewport`
- reduced-motion preference at the Firefox preference layer
- 160/220 AS Canvas structure
- 32/96 Builder structure
- 2,000-point Physical fixture provenance
- zero horizontal overflow and zero document auto-scroll
- BiDi error logs

On the hosted headless Firefox environment, the Physical scene honestly enters the existing WebGL fallback. Three WebGL/context diagnostics are classified as expected for that fallback; the non-Physical semantic/Canvas/Builder profiles emitted zero BiDi error logs. Firefox does not get credited with successful WebGL rendering on that runner.

## Coverage boundary

Lab 08C proves hosted Linux production-artifact behavior in:

- Chrome default renderer mode
- Chrome explicit SwiftShader software rendering
- Chrome with WebGL disabled
- Firefox/Gecko semantic rendering through raw WebDriver + BiDi

It does **not** claim coverage for:

- Safari/WebKit
- macOS/iOS GPU stacks
- Windows-specific GPU drivers
- discrete NVIDIA/AMD/Intel hardware combinations
- browser extensions or enterprise policies

Those environments remain valid future compatibility targets, but they are not inferred from the hosted Linux evidence.

## Completion gate

The candidate compatibility behavior has passed the hosted matrix. The remaining gate is promotion of the exact validated profiler/Firefox runner changes into permanent source, removal of transient patch/probe helpers, restoration of read-only workflows, shared ROADMAP/ARCHITECTURE/README synchronization, and a final clean-tree CI + Performance + Compatibility pass.
