from pathlib import Path


def patch(path_name: str, replacements: list[tuple[str, str]]) -> None:
    path = Path(path_name)
    text = path.read_text()
    for old, new in replacements:
        if old not in text:
            raise SystemExit(f'missing Lab 09A doc anchor in {path_name}: {old[:180]!r}')
        text = text.replace(old, new, 1)
    path.write_text(text)


patch('docs/ARCHITECTURE.md', [
    (
        '- `INFERRED` — explanatory connection/geometry not directly measured\n',
        '- `INFERRED` — explanatory connection/geometry not directly measured\n- `LOCAL MEASURED` — a native/local observation bounded to one host vantage, declared target, adapter/tool identity, and capture interval\n',
    ),
    (
        "A public collector path is not the viewer's packet path. Optional live evidence can decorate a simulated Journey but cannot silently rewrite transport, DNS, modifiers, forwarding path, or the causal event log.\n",
        "A public collector path is not the viewer's packet path. Optional live evidence can decorate a simulated Journey but cannot silently rewrite transport, DNS, modifiers, forwarding path, or the causal event log.\n\n`LOCAL MEASURED` is observational, not global truth. Native measurement schema v1 requires `vantage = local-host`, `completeness = bounded`, `globalComplete = false`, explicit limitations, adapter/tool identity, a bounded capture interval, and per-fact timestamps/targets. Arbitrary nested model objects are rejected as measured values so a native adapter cannot launder Journey events, modifiers, inferred topology, or other canonical state into the measured evidence channel.\n",
    ),
    (
        '18. **Browser/GPU compatibility matrix** — the exact production artifact runs in hosted Chrome default, explicit SwiftShader, and WebGL-disabled modes plus a real Firefox/Gecko WebDriver + BiDi semantic pass. Renderer capability may select WebGL or the explicit fallback, but canonical network state must remain identical.\n',
        '18. **Browser/GPU compatibility matrix** — the exact production artifact runs in hosted Chrome default, explicit SwiftShader, and WebGL-disabled modes plus a real Firefox/Gecko WebDriver + BiDi semantic pass. Renderer capability may select WebGL or the explicit fallback, but canonical network state must remain identical.\n19. **Native measurement provenance contract** — schema-v1 parsing/round trips and negative fixtures prove `LOCAL MEASURED` facts remain local-vantage, time-bounded, target-explicit, source-attributed, non-global, and structurally unable to embed canonical Journey/model objects as measured truth.\n',
    ),
    (
        'The original proof was one routed-link failure/recovery scenario. The architecture now spans packets, protocol theater, topology authoring, Internet-scale renderers, public evidence adapters, a cross-scale URL Journey, portable scenarios, deterministic multi-cause GOD MODE composition, cross-layer outage recovery, ECN queue/congestion response, DNS timeout/retry behavior, HTTP service-unavailable retry, terminal network partition behavior, BGP route-leak policy anomalies that keep reachability separate from policy correctness, a production-artifact performance budget that measures renderer cost without making frame timing part of simulation truth, deterministic high-density stress fixtures that exercise the real Canvas/DOM-SVG/WebGL boundaries without changing default scenes, and a Chrome/Firefox compatibility matrix that proves renderer/GPU fallback does not change semantic truth.\n',
        'The original proof was one routed-link failure/recovery scenario. The architecture now spans packets, protocol theater, topology authoring, Internet-scale renderers, public evidence adapters, a cross-scale URL Journey, portable scenarios, deterministic multi-cause GOD MODE composition, cross-layer outage recovery, ECN queue/congestion response, DNS timeout/retry behavior, HTTP service-unavailable retry, terminal network partition behavior, BGP route-leak policy anomalies that keep reachability separate from policy correctness, a production-artifact performance budget that measures renderer cost without making frame timing part of simulation truth, deterministic high-density stress fixtures that exercise the real Canvas/DOM-SVG/WebGL boundaries without changing default scenes, a Chrome/Firefox compatibility matrix that proves renderer/GPU fallback does not change semantic truth, and a fail-closed native provenance contract established before any local measurement adapter is connected.\n',
    ),
    (
        '- native/measured data sources for facts browsers cannot legitimately observe\n',
        '- native adapter/bridge integration that emits only validated `LOCAL MEASURED` snapshots\n- projection of measured facts into semantic scenes without mutating simulated Journey truth\n',
    ),
])

patch('README.md', [
    (
        'Production performance budgets, deterministic high-density stress profiles, and a production-artifact browser/GPU matrix now cover the normal product, the 160/220 AS Canvas fixture, Builder at its real 32/96 ceiling, a 2,000-point SIMULATED WebGL fixture, repeated Journey churn, Chrome default/SwiftShader/WebGL-disabled rendering, and Firefox/Gecko semantic compatibility with an honest WebGL fallback. The next major direction is **native/measured data sources for facts browsers cannot legitimately observe**.',
        'Production performance budgets, deterministic high-density stress profiles, and a production-artifact browser/GPU matrix now cover the normal product, the 160/220 AS Canvas fixture, Builder at its real 32/96 ceiling, a 2,000-point SIMULATED WebGL fixture, repeated Journey churn, Chrome default/SwiftShader/WebGL-disabled rendering, and Firefox/Gecko semantic compatibility with an honest WebGL fallback. The native-measurement phase has now begun with a strict `LOCAL MEASURED` provenance/schema contract; the next step is **adapter/bridge integration for facts browsers cannot legitimately observe, without allowing measured state to overwrite simulated Journey truth**.',
    ),
])

Path('scripts/sync-lab09a-docs.py').unlink()
