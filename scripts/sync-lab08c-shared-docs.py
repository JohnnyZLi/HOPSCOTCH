from pathlib import Path


def patch(path_name: str, replacements: list[tuple[str, str]]) -> None:
    path = Path(path_name)
    text = path.read_text()
    for old, new in replacements:
        if old not in text:
            raise SystemExit(f'missing Lab 08C doc anchor in {path_name}: {old[:180]!r}')
        text = text.replace(old, new, 1)
    path.write_text(text)


patch('docs/ROADMAP.md', [
    ('- [ ] broader browser/GPU compatibility pass', '- [x] broader browser/GPU compatibility pass'),
])

patch('docs/ARCHITECTURE.md', [
    (
        '17. **High-density renderer contracts** — query-only deterministic fixtures exercise AS Canvas at 160/220, Builder at its real 32/96 authoring ceiling, the physical WebGL buffer at 2,000 SIMULATED points, and a 12×54 seek churn pass with separate hosted-baseline stress ceilings.\n',
        '17. **High-density renderer contracts** — query-only deterministic fixtures exercise AS Canvas at 160/220, Builder at its real 32/96 authoring ceiling, the physical WebGL buffer at 2,000 SIMULATED points, and a 12×54 seek churn pass with separate hosted-baseline stress ceilings.\n18. **Browser/GPU compatibility matrix** — the exact production artifact runs in hosted Chrome default, explicit SwiftShader, and WebGL-disabled modes plus a real Firefox/Gecko WebDriver + BiDi semantic pass. Renderer capability may select WebGL or the explicit fallback, but canonical network state must remain identical.\n',
    ),
    (
        '- preserve provenance under load: the 2,000-point globe fixture is explicitly SIMULATED/test-only and must never become `PUBLIC DATA` merely because it enters the same geometry renderer\n',
        '- preserve provenance under load: the 2,000-point globe fixture is explicitly SIMULATED/test-only and must never become `PUBLIC DATA` merely because it enters the same geometry renderer\n- treat browser engine, GPU backend, WebGL availability, viewport implementation, and reduced motion as renderer/runtime facts only; they must never mutate canonical Journey/model truth\n- exercise the real WebGL fallback in CI: WebGL-disabled Chrome and hosted headless Firefox may render `FALLBACK`, but must never substitute fake 3D success or lose inspectable fixture/data state\n- keep cross-browser claims evidence-bounded: current automated coverage is hosted Linux Chrome/Chromium and Firefox/Gecko, not Safari/WebKit or vendor-specific desktop/mobile GPU hardware\n',
    ),
    (
        'The original proof was one routed-link failure/recovery scenario. The architecture now spans packets, protocol theater, topology authoring, Internet-scale renderers, public evidence adapters, a cross-scale URL Journey, portable scenarios, deterministic multi-cause GOD MODE composition, cross-layer outage recovery, ECN queue/congestion response, DNS timeout/retry behavior, HTTP service-unavailable retry, terminal network partition behavior, BGP route-leak policy anomalies that keep reachability separate from policy correctness, a production-artifact performance budget that measures renderer cost without making frame timing part of simulation truth, and deterministic high-density stress fixtures that exercise the real Canvas/DOM-SVG/WebGL boundaries without changing default scenes.\n',
        'The original proof was one routed-link failure/recovery scenario. The architecture now spans packets, protocol theater, topology authoring, Internet-scale renderers, public evidence adapters, a cross-scale URL Journey, portable scenarios, deterministic multi-cause GOD MODE composition, cross-layer outage recovery, ECN queue/congestion response, DNS timeout/retry behavior, HTTP service-unavailable retry, terminal network partition behavior, BGP route-leak policy anomalies that keep reachability separate from policy correctness, a production-artifact performance budget that measures renderer cost without making frame timing part of simulation truth, deterministic high-density stress fixtures that exercise the real Canvas/DOM-SVG/WebGL boundaries without changing default scenes, and a Chrome/Firefox compatibility matrix that proves renderer/GPU fallback does not change semantic truth.\n',
    ),
    (
        '- native/measured data sources for facts browsers cannot legitimately observe\n- broader browser/GPU compatibility using the same semantic-state and renderer-budget invariants\n',
        '- native/measured data sources for facts browsers cannot legitimately observe\n',
    ),
])

patch('README.md', [
    (
        'Production performance budgets and deterministic high-density stress profiles now cover the normal product, the 160/220 AS Canvas fixture, Builder at its real 32/96 ceiling, a 2,000-point SIMULATED WebGL fixture, and repeated Journey churn. Current hardening work is **broader browser/GPU compatibility and future native/measured data sources for facts browsers cannot legitimately observe**.',
        'Production performance budgets, deterministic high-density stress profiles, and a production-artifact browser/GPU matrix now cover the normal product, the 160/220 AS Canvas fixture, Builder at its real 32/96 ceiling, a 2,000-point SIMULATED WebGL fixture, repeated Journey churn, Chrome default/SwiftShader/WebGL-disabled rendering, and Firefox/Gecko semantic compatibility with an honest WebGL fallback. The next major direction is **native/measured data sources for facts browsers cannot legitimately observe**.',
    ),
])

Path('scripts/sync-lab08c-shared-docs.py').unlink()
