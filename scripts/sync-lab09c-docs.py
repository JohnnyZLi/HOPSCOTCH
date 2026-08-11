from pathlib import Path


def patch(path_name: str, replacements: list[tuple[str, str]]) -> None:
    path = Path(path_name)
    text = path.read_text()
    for old, new in replacements:
        if old not in text:
            raise SystemExit(f'missing Lab 09C doc anchor in {path_name}: {old[:180]!r}')
        text = text.replace(old, new, 1)
    path.write_text(text)


patch('docs/ROADMAP.md', [
    ('- [ ] ingest native/network-diagnostics data without pretending it is globally complete', '- [x] ingest native/network-diagnostics data without pretending it is globally complete'),
])

patch('docs/ARCHITECTURE.md', [
    (
        'Validated native snapshots project into a separate `hopscotch.measured-state` model. That model indexes and classifies measured facts only; it does not import Journey code, expose Journey event/modifier/scenario types, enter the modifier pipeline, or mutate canonical time/reducer state. Target-specific snapshots remain separate rather than being merged into a supposed global view. Capture freshness is presentation metadata computed from an explicit caller-supplied `now`, never a hidden model clock or a network outcome.\n',
        'Validated native snapshots project into a separate `hopscotch.measured-state` model. That model indexes and classifies measured facts only; it does not import Journey code, expose Journey event/modifier/scenario types, enter the modifier pipeline, or mutate canonical time/reducer state. Target-specific snapshots remain separate rather than being merged into a supposed global view. Capture freshness is presentation metadata computed from an explicit caller-supplied `now`, never a hidden model clock or a network outcome.\n\nNetwork Diagnostics Suite report-v2 ingestion follows the same boundary. The adapter accepts the existing combined report shape, whitelists known direct/local scalar measurements, emits a schema-v1 `LOCAL MEASURED` snapshot, revalidates that snapshot through the native parser, and only then projects measured state. Browser/edge evidence, public-network context, derived findings/localization, annotations, unsupported host-resource values, and unknown report extensions are explicitly skipped rather than relabeled as local truth. Combined reports keep snapshot target `null` because they are multi-target; target scope remains per fact. Local-address disclosure flags also gate local prefixes, gateways, resolver/hop addresses, interface addresses, and LAN target identity.\n',
    ),
    (
        '- cache policy for public infrastructure data\n',
        '- cache policy for public infrastructure data\n- bounded Network Diagnostics Suite report-v2 ingestion into the validated `LOCAL MEASURED` → measured-state path\n',
    ),
    (
        '20. **Measured-state separation contract** — projection/indexing, target isolation, partial/unavailable preservation, explicit-time freshness, zero Journey imports/types, and byte/deep-equal Journey reconstruction before/after measured snapshot replacement prove observational state cannot rewrite simulated truth.\n',
        '20. **Measured-state separation contract** — projection/indexing, target isolation, partial/unavailable preservation, explicit-time freshness, zero Journey imports/types, and byte/deep-equal Journey reconstruction before/after measured snapshot replacement prove observational state cannot rewrite simulated truth.\n21. **Network Diagnostics ingestion contract** — a realistic report-v2 fixture proves whitelist-only local measurement mapping, per-fact multi-target scope, exact throughput conversion, explicit-time bounding, local-address privacy suppression, absence-without-fabrication, public/browser/derived/unknown exclusion, 09A/09B validation, malformed-report rejection, and unchanged Journey construction/reducer state.\n',
    ),
    (
        'The original proof was one routed-link failure/recovery scenario. The architecture now spans packets, protocol theater, topology authoring, Internet-scale renderers, public evidence adapters, a cross-scale URL Journey, portable scenarios, deterministic multi-cause GOD MODE composition, cross-layer outage recovery, ECN queue/congestion response, DNS timeout/retry behavior, HTTP service-unavailable retry, terminal network partition behavior, BGP route-leak policy anomalies that keep reachability separate from policy correctness, a production-artifact performance budget that measures renderer cost without making frame timing part of simulation truth, deterministic high-density stress fixtures that exercise the real Canvas/DOM-SVG/WebGL boundaries without changing default scenes, a Chrome/Firefox compatibility matrix that proves renderer/GPU fallback does not change semantic truth, and a native-measurement architecture with both fail-closed provenance validation and a separate measured-state projection that cannot rewrite Journey truth.\n',
        'The original proof was one routed-link failure/recovery scenario. The architecture now spans packets, protocol theater, topology authoring, Internet-scale renderers, public evidence adapters, a cross-scale URL Journey, portable scenarios, deterministic multi-cause GOD MODE composition, cross-layer outage recovery, ECN queue/congestion response, DNS timeout/retry behavior, HTTP service-unavailable retry, terminal network partition behavior, BGP route-leak policy anomalies that keep reachability separate from policy correctness, a production-artifact performance budget that measures renderer cost without making frame timing part of simulation truth, deterministic high-density stress fixtures that exercise the real Canvas/DOM-SVG/WebGL boundaries without changing default scenes, a Chrome/Firefox compatibility matrix that proves renderer/GPU fallback does not change semantic truth, and a native-measurement architecture with fail-closed provenance validation, a separate measured-state projection, and whitelist-only Network Diagnostics Suite report-v2 ingestion that cannot rewrite Journey truth.\n',
    ),
    (
        '- native adapter/bridge integration that emits only validated `LOCAL MEASURED` snapshots\n- measured-mode semantic scenes that consume the separate measured-state model without mutating simulated Journey truth\n',
        '- native transport/discovery and report-import UX that feed only the validated Network Diagnostics adapter path\n- measured-mode semantic scenes that consume the separate measured-state model without mutating simulated Journey truth\n',
    ),
])

patch('README.md', [
    (
        'Production performance budgets, deterministic high-density stress profiles, and a production-artifact browser/GPU matrix now cover the normal product, the 160/220 AS Canvas fixture, Builder at its real 32/96 ceiling, a 2,000-point SIMULATED WebGL fixture, repeated Journey churn, Chrome default/SwiftShader/WebGL-disabled rendering, and Firefox/Gecko semantic compatibility with an honest WebGL fallback. Native measurement now has both a strict `LOCAL MEASURED` provenance/schema contract and a separate measured-state projection that is contractually unable to rewrite simulated Journey truth. The next step is **actual adapter/bridge ingestion for facts browsers cannot legitimately observe**.',
        'Production performance budgets, deterministic high-density stress profiles, and a production-artifact browser/GPU matrix now cover the normal product, the 160/220 AS Canvas fixture, Builder at its real 32/96 ceiling, a 2,000-point SIMULATED WebGL fixture, repeated Journey churn, Chrome default/SwiftShader/WebGL-disabled rendering, and Firefox/Gecko semantic compatibility with an honest WebGL fallback. Native measurement now has a strict `LOCAL MEASURED` provenance/schema contract, a separate measured-state projection, and whitelist-only ingestion of the existing Network Diagnostics Suite report-v2 format without promoting browser/public/derived/unknown report content into local truth. The next step is **transport/import UX plus measured semantic scenes on top of that validated ingestion path**.',
    ),
])

Path('scripts/sync-lab09c-docs.py').unlink()
