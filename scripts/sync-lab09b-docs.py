from pathlib import Path


def patch(path_name: str, replacements: list[tuple[str, str]]) -> None:
    path = Path(path_name)
    text = path.read_text()
    for old, new in replacements:
        if old not in text:
            raise SystemExit(f'missing Lab 09B doc anchor in {path_name}: {old[:180]!r}')
        text = text.replace(old, new, 1)
    path.write_text(text)


patch('docs/ROADMAP.md', [
    ('- [ ] keep measured state separate from simulated Journey state', '- [x] keep measured state separate from simulated Journey state'),
])

patch('docs/ARCHITECTURE.md', [
    (
        '`LOCAL MEASURED` is observational, not global truth. Native measurement schema v1 requires `vantage = local-host`, `completeness = bounded`, `globalComplete = false`, explicit limitations, adapter/tool identity, a bounded capture interval, and per-fact timestamps/targets. Arbitrary nested model objects are rejected as measured values so a native adapter cannot launder Journey events, modifiers, inferred topology, or other canonical state into the measured evidence channel.\n',
        '`LOCAL MEASURED` is observational, not global truth. Native measurement schema v1 requires `vantage = local-host`, `completeness = bounded`, `globalComplete = false`, explicit limitations, adapter/tool identity, a bounded capture interval, and per-fact timestamps/targets. Arbitrary nested model objects are rejected as measured values so a native adapter cannot launder Journey events, modifiers, inferred topology, or other canonical state into the measured evidence channel.\n\nValidated native snapshots project into a separate `hopscotch.measured-state` model. That model indexes and classifies measured facts only; it does not import Journey code, expose Journey event/modifier/scenario types, enter the modifier pipeline, or mutate canonical time/reducer state. Target-specific snapshots remain separate rather than being merged into a supposed global view. Capture freshness is presentation metadata computed from an explicit caller-supplied `now`, never a hidden model clock or a network outcome.\n',
    ),
    (
        '19. **Native measurement provenance contract** — schema-v1 parsing/round trips and negative fixtures prove `LOCAL MEASURED` facts remain local-vantage, time-bounded, target-explicit, source-attributed, non-global, and structurally unable to embed canonical Journey/model objects as measured truth.\n',
        '19. **Native measurement provenance contract** — schema-v1 parsing/round trips and negative fixtures prove `LOCAL MEASURED` facts remain local-vantage, time-bounded, target-explicit, source-attributed, non-global, and structurally unable to embed canonical Journey/model objects as measured truth.\n20. **Measured-state separation contract** — projection/indexing, target isolation, partial/unavailable preservation, explicit-time freshness, zero Journey imports/types, and byte/deep-equal Journey reconstruction before/after measured snapshot replacement prove observational state cannot rewrite simulated truth.\n',
    ),
    (
        'The original proof was one routed-link failure/recovery scenario. The architecture now spans packets, protocol theater, topology authoring, Internet-scale renderers, public evidence adapters, a cross-scale URL Journey, portable scenarios, deterministic multi-cause GOD MODE composition, cross-layer outage recovery, ECN queue/congestion response, DNS timeout/retry behavior, HTTP service-unavailable retry, terminal network partition behavior, BGP route-leak policy anomalies that keep reachability separate from policy correctness, a production-artifact performance budget that measures renderer cost without making frame timing part of simulation truth, deterministic high-density stress fixtures that exercise the real Canvas/DOM-SVG/WebGL boundaries without changing default scenes, a Chrome/Firefox compatibility matrix that proves renderer/GPU fallback does not change semantic truth, and a fail-closed native provenance contract established before any local measurement adapter is connected.\n',
        'The original proof was one routed-link failure/recovery scenario. The architecture now spans packets, protocol theater, topology authoring, Internet-scale renderers, public evidence adapters, a cross-scale URL Journey, portable scenarios, deterministic multi-cause GOD MODE composition, cross-layer outage recovery, ECN queue/congestion response, DNS timeout/retry behavior, HTTP service-unavailable retry, terminal network partition behavior, BGP route-leak policy anomalies that keep reachability separate from policy correctness, a production-artifact performance budget that measures renderer cost without making frame timing part of simulation truth, deterministic high-density stress fixtures that exercise the real Canvas/DOM-SVG/WebGL boundaries without changing default scenes, a Chrome/Firefox compatibility matrix that proves renderer/GPU fallback does not change semantic truth, and a native-measurement architecture with both fail-closed provenance validation and a separate measured-state projection that cannot rewrite Journey truth.\n',
    ),
    (
        '- native adapter/bridge integration that emits only validated `LOCAL MEASURED` snapshots\n- projection of measured facts into semantic scenes without mutating simulated Journey truth\n',
        '- native adapter/bridge integration that emits only validated `LOCAL MEASURED` snapshots\n- measured-mode semantic scenes that consume the separate measured-state model without mutating simulated Journey truth\n',
    ),
])

patch('README.md', [
    (
        'Production performance budgets, deterministic high-density stress profiles, and a production-artifact browser/GPU matrix now cover the normal product, the 160/220 AS Canvas fixture, Builder at its real 32/96 ceiling, a 2,000-point SIMULATED WebGL fixture, repeated Journey churn, Chrome default/SwiftShader/WebGL-disabled rendering, and Firefox/Gecko semantic compatibility with an honest WebGL fallback. The native-measurement phase has now begun with a strict `LOCAL MEASURED` provenance/schema contract; the next step is **adapter/bridge integration for facts browsers cannot legitimately observe, without allowing measured state to overwrite simulated Journey truth**.',
        'Production performance budgets, deterministic high-density stress profiles, and a production-artifact browser/GPU matrix now cover the normal product, the 160/220 AS Canvas fixture, Builder at its real 32/96 ceiling, a 2,000-point SIMULATED WebGL fixture, repeated Journey churn, Chrome default/SwiftShader/WebGL-disabled rendering, and Firefox/Gecko semantic compatibility with an honest WebGL fallback. Native measurement now has both a strict `LOCAL MEASURED` provenance/schema contract and a separate measured-state projection that is contractually unable to rewrite simulated Journey truth. The next step is **actual adapter/bridge ingestion for facts browsers cannot legitimately observe**.',
    ),
])

Path('scripts/sync-lab09b-docs.py').unlink()
