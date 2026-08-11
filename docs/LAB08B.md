# Lab 08B — Deterministic high-density renderer stress

Lab 08B uses the production performance budget established in Lab 08A to load-test HOPSCOTCH's real dense renderer boundaries without changing the default product scenes.

## Boundary

Stress fixtures are engineering inputs, not new network observations. They are deterministic, query-only, and selected before the normal App mounts. A normal HOPSCOTCH session still renders the same scenarios and public-data paths as before.

`main.tsx` recognizes only these explicit stress queries:

- `?stress=as-density`
- `?stress=builder-density`
- `?stress=physical-density`

Those queries mount `StressHarness`. Every normal URL continues into `App` unchanged.

The production renderers accept optional injected stress data but preserve their existing defaults. This keeps the benchmark on the same rendering/model code while preventing test fixtures from leaking into normal product truth.

## AS Canvas — 160 nodes / 220 relationships

The AS stress graph contains exactly **160 documentation-range teaching AS nodes** and **220 relationships**.

It has one deterministic valley-free backbone from AS4200000000 to AS4200000007:

`up → up → peer → down → down → down → down`

Additional customer/provider spokes and peer edges make the Canvas draw loop meaningfully denser without deliberately constructing a graph that makes policy-path enumeration explode combinatorially.

The fixture contract proves exact 160/220 counts and unique IDs, a reachable policy-compliant backbone, and stable relationship traversal.

Canvas remains the correct renderer at this density: the hosted browser mounted the 160/220 scene with only **403 DOM elements** because AS nodes/relationships are drawn rather than expanded into hundreds of React elements.

Hosted baseline: **403 DOM / ~5.09 MiB settled JS heap**.

Stress ceiling:

- DOM ≤ **500**
- settled JS heap ≤ **7 MiB**

## Builder — real 32-node / 96-link ceiling

The Builder stress fixture does not invent a larger unsupported topology. It exercises the product's actual authoring limits:

- **32 nodes**
- **96 links**

The deterministic graph has a fixed 8×4 layout, guaranteed connectivity, and a valid source-to-destination route. The Node contract runs the real Builder scenario validator and proves exact 32/96 fixture counts, route reachability, schema round-trip preservation, rejection at **33 nodes**, and rejection at **97 links**.

This is intentionally DOM/SVG rather than Canvas because Builder elements remain directly interactive and authorable. The product ceiling is therefore also a renderer-safety ceiling rather than an unbounded graph promise.

Hosted baseline: **762 DOM / ~5.47 MiB settled JS heap**.

Stress ceiling:

- DOM ≤ **900**
- settled JS heap ≤ **7 MiB**

The fact that Builder exceeds the normal 08A 700-element budget is not a weakening of that budget. The 700-element limit still protects representative normal product scenes; Builder-at-ceiling has its own explicit density contract.

## Physical globe — 2,000 simulated GPU points

The normal physical Internet view remains bounded to its existing public-data density choices, currently topping out at **250 visible PeeringDB facilities**.

The stress harness injects **2,000 deterministic simulated points** into the same `THREE.Points` renderer to exercise the WebGL buffer, raycasting data, camera, and resize path at a substantially higher point count.

The fixture is deliberately labeled:

- `SIMULATED · STRESS FIXTURE`
- `SIMULATED STRESS POINTS · NOT PUBLIC DATA`

These are not PeeringDB records, inferred facilities, measured infrastructure, or forwarding paths. The renderer's internal geometry types accept both public and simulated structural records, while provenance remains separate.

Hosted baseline: **188 DOM / ~6.15 MiB settled JS heap** for the 2,000-point scene.

Stress ceiling:

- DOM ≤ **250**
- settled JS heap ≤ **8 MiB**
- exact point count = **2,000**
- WebGL canvas must exist with nonzero backing dimensions

The low DOM count is the reason this scale belongs in WebGL rather than DOM/SVG.

## Journey churn — 648 deterministic seeks

Lab 08A already performs three passes through the maximum composed 54-event Journey. Lab 08B adds a higher-cycle stress pass:

**12 × 54 = 648 deterministic event seeks**

The test verifies event count and scenario identity never change, document `scrollY` remains zero, and post-GC heap growth remains bounded.

Hosted baseline after forced GC: **~+2.13 MiB** heap growth on the budget-validation run.

Stress ceiling:

- exact cycles = **12**
- exact events/cycle = **54**
- post-GC heap growth ≤ **4 MiB**

Elapsed wall-clock time remains diagnostic only; on hosted Chrome the 648-seek pass is roughly 18–20 seconds. Runner speed is not canonical simulation truth.

## Budget separation

Lab 08B does **not** loosen the Lab 08A normal-product limits.

`config/performance-budget.json` contains separate `stressBudgets` for the three renderer fixtures and the 12×54 churn test. The same Performance workflow now enforces both sets in one production-artifact run:

- normal 08A bundle/DOM/heap/overflow/semantic budgets
- high-density 08B renderer/churn budgets

A future density change must update the fixture and budget deliberately. Silent fixture shrinkage is caught by structural assertions; silent cost growth is caught by the stress ceilings.

## Hosted validation

The first complete hosted Chrome baseline measured:

| Profile | Density | DOM | Settled heap |
|---|---:|---:|---:|
| AS Canvas | 160 AS / 220 relationships | 403 | ~5.09 MiB |
| Builder | 32 nodes / 96 links | 762 | ~5.47 MiB |
| Physical WebGL | 2,000 simulated points | 188 | ~6.15 MiB |

The final budget-validation runs passed with both Lab 08A and Lab 08B budgets enforced simultaneously:

- normal 3×54 seek growth: roughly **+1.4–1.5 MiB**
- high-density 12×54 seek growth: roughly **+2.1–2.2 MiB**
- JS gzip: **319,571 bytes**, below the unchanged 08A **380,000-byte** limit
- CSS gzip: **25,068 bytes**, below the unchanged **32,000-byte** limit
- all renderer structural counts and stress-specific DOM/heap ceilings
- all semantic assertions
- no horizontal-overflow or document-scroll regressions
- no runtime/console failures

The renderer injection, deterministic fixtures, high-density contract, profiler extensions, and stress budgets have now been promoted into the permanent branch source. All transient apply helpers and `pretypecheck` have been removed, both workflows are back to their normal read-only forms, and ordinary CI plus ordinary Performance have passed on that permanent tree. The remaining completion step is synchronization of the shared ROADMAP/ARCHITECTURE/README state through the same validated gate.
