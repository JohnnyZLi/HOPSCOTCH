# Lab 08A — Production renderer performance budget

Lab 08A turns HOPSCOTCH performance into a repeatable production-artifact profile without allowing renderer timing to become simulation truth.

## Boundary

The performance harness lives outside the canonical model/reducer. It may observe bundle size, DOM density, heap use, viewport behavior, and browser timing counters, but it cannot alter events, modifier order, protocol state, routing outcomes, or reduced-motion semantics.

The harness profiles `dist/`, never Vite dev mode.

## Exact production-artifact browser path

`scripts/performance-profile.mjs` is dependency-free under Node 24. It:

1. reads `dist/index.html`
2. resolves the generated Vite JS/CSS assets
3. injects the exact production HTML/CSS into one CDP-controlled document
4. executes the exact self-contained built JS bytes through CDP `Runtime.evaluate`
5. launches an installed Chrome/Chromium through the Chrome DevTools Protocol
6. navigates to `about:blank` with a canonical Journey query and injects the production document with `Page.setDocumentContent`
7. exercises representative desktop/mobile/reduced-motion states
8. forces GC around a repeated event-seek stress pass
9. writes `artifacts/performance-profile.json`

This avoids depending on localhost serving behavior, proxy policy, or a Vite dev server. The explicit CDP JS execution path also avoids browser-version differences in whether a module script inserted through `Page.setDocumentContent` is evaluated; GitHub's Chrome 150 exposed that difference during the first workflow run. `CHROME_PATH` can override browser discovery; Linux and macOS Chrome/Chromium paths are discovered automatically when possible.

Hosted Chrome startup is also treated as infrastructure rather than product truth. A GitHub rerun showed one runner failing to expose its chosen CDP port while an identical rerun succeeded with the same code and budgets. The final harness therefore uses a bounded three-attempt startup policy with fresh ports/user-data directories, `--disable-dev-shm-usage`, and per-attempt diagnostics. If all attempts fail, the profile still fails closed instead of hiding the infrastructure error.

## Representative profiles

The initial profile matrix covers:

- a maximum representative composed GOD MODE story ending in terminal PARTITION
- TCP/H2 route-leak anomaly on desktop
- the same route-leak anomaly at 390 px mobile with all ten controls
- QUIC/H3 route-leak restoration under `prefers-reduced-motion: reduce`
- repeated seeks through every event in the maximum composed scenario

These are intentionally semantic checks as well as performance checks. The profiler fails closed if, for example, LEAK no longer shows `REACHABLE = YES / POLICY COMPLIANT = NO`, terminal PARTITION no longer shows NO ROUTE, mobile overflows, reduced motion changes state, event count mutates during seeks, or a runtime/console error appears.

## Baseline

The first budget document is anchored to the production artifact at main commit `8058e9ee0c0d70b626f0f5343cf176207d65a6d0` after Lab 07I.

Measured baseline values:

- JS gzip: **316,819 bytes**
- CSS gzip: **25,096 bytes**
- largest representative DOM: **557 elements**
- largest representative settled heap: about **2.85 MiB**
- two-pass 54-event seek stress after forced GC: about **+1.48 MiB**

The first successful GitHub-hosted Chrome 150 profile measured:

- JS gzip: **317,805 bytes**
- CSS gzip: **25,068 bytes**
- maximum composed DOM: **558 elements**
- maximum composed settled heap: **5.13 MiB**
- three-pass 54-event seek stress heap growth: **+1.54 MiB**

A later hardened run on hosted Chrome 151 reproduced the same structural envelope: 558 maximum DOM elements, about 5.13 MiB maximum settled heap, and about +1.51 MiB after three complete 54-event seek cycles. Chrome started on the first attempt in that run, so the retry mechanism was present but not needed.

The final read-only Performance run on the permanent branch source used hosted Chrome 150. Its first Chrome process announced a DevTools socket but the HTTP discovery endpoint did not become reachable inside the bounded startup window; the profiler recorded that failed attempt, started a fresh Chrome instance, and completed successfully on attempt two. The final profile again measured 558 maximum DOM elements, about 5.13 MiB maximum settled heap, and about +1.51 MiB heap growth after three complete 54-event seek cycles, with zero stable-budget or semantic failures.

Those hosted values remain inside the original budgets, so the limits were not widened after seeing CI results.

## Enforced stable budgets

`config/performance-budget.json` deliberately gives the baseline headroom:

- JS gzip ≤ **380,000 bytes**
- CSS gzip ≤ **32,000 bytes**
- representative DOM ≤ **700 elements**
- representative settled heap ≤ **7 MiB**
- repeated-seek heap growth after forced GC ≤ **6 MiB**
- zero horizontal overflow for every profile
- document `scrollY` remains zero during normal automatic event-rail behavior
- semantic assertions remain correct
- no runtime exceptions / console errors

These limits are regression tripwires, not claims that a browser becomes unusable one byte above them. A future budget change should be justified by a measured architectural change rather than silently raised to make CI pass.

## Diagnostic-only metrics

The JSON report also records values that are useful for trend analysis but too runner-sensitive to make simulation CI truth yet:

- browser/profile ready milliseconds
- ScriptDuration
- LayoutDuration
- RecalcStyleDuration
- TaskDuration
- repeated-seek elapsed milliseconds

Once enough GitHub Actions history exists, some of these can receive percentile-based budgets with evidence rather than guesses.

## Commands

Build first, then either profile or enforce:

```bash
npm run build
npm run performance:profile
npm run performance:check
```

Use a specific browser when necessary:

```bash
CHROME_PATH="/path/to/chrome" npm run performance:profile
```

Normal `npm run check` remains independent from Chrome availability.

## CI

`.github/workflows/performance.yml` runs separately on pull requests and `main`:

1. Node 24 + `npm ci`
2. production build
3. `npm run performance:check`
4. upload `hopscotch-performance-profile` for three days

The performance workflow is expected to fail when a stable budget or semantic browser invariant regresses, while still uploading the report when possible for diagnosis.

The Chrome 150 execution change and bounded startup retry logic are part of the permanent `scripts/performance-profile.mjs`; no validation patcher or write-enabled workflow remains in the product diff. Ordinary read-only CI and the ordinary read-only Performance workflow both pass on that permanent source unchanged.
