from pathlib import Path


def patch(path_name: str, replacements: list[tuple[str, str]]) -> None:
    path = Path(path_name)
    text = path.read_text()
    for old, new in replacements:
        if old not in text:
            raise SystemExit(f'missing Lab 09D doc anchor in {path_name}: {old[:180]!r}')
        text = text.replace(old, new, 1)
    path.write_text(text)


patch('docs/ROADMAP.md', [
    (
        '- [x] ingest native/network-diagnostics data without pretending it is globally complete\n- [ ] map measured facts into existing semantic scenes where appropriate',
        '- [x] ingest native/network-diagnostics data without pretending it is globally complete\n- [x] explicit session-only Network Diagnostics report import + provenance-first measured workspace\n- [ ] map measured facts into existing semantic scenes where appropriate',
    ),
])

patch('docs/ARCHITECTURE.md', [
    (
        'Network Diagnostics Suite report-v2 ingestion follows the same boundary. The adapter accepts the existing combined report shape, whitelists known direct/local scalar measurements, emits a schema-v1 `LOCAL MEASURED` snapshot, revalidates that snapshot through the native parser, and only then projects measured state. Browser/edge evidence, public-network context, derived findings/localization, annotations, unsupported host-resource values, and unknown report extensions are explicitly skipped rather than relabeled as local truth. Combined reports keep snapshot target `null` because they are multi-target; target scope remains per fact. Local-address disclosure flags also gate local prefixes, gateways, resolver/hop addresses, interface addresses, and LAN target identity.\n',
        'Network Diagnostics Suite report-v2 ingestion follows the same boundary. The adapter accepts the existing combined report shape, whitelists known direct/local scalar measurements, emits a schema-v1 `LOCAL MEASURED` snapshot, revalidates that snapshot through the native parser, and only then projects measured state. Browser/edge evidence, public-network context, derived findings/localization, annotations, unsupported host-resource values, and unknown report extensions are explicitly skipped rather than relabeled as local truth. Combined reports keep snapshot target `null` because they are multi-target; target scope remains per fact. Local-address disclosure flags also gate local prefixes, gateways, resolver/hop addresses, interface addresses, and LAN target identity.\n\nThe Lab 09 measured workspace is a presentation layer over that validated measured-state object, not a second adapter. Import is explicit and session-only: a user-selected JSON file is read in browser memory, passed through the permanent 09C ingestion function, and displayed only after validation/projection succeeds. The workspace does not persist report bytes/facts, upload them, poll localhost, or import Journey code. Invalid replacement imports leave the last valid measured state active. Category renderers group facts by their explicit target and refuse to visually concatenate separate targets into one observed end-to-end path.\n',
    ),
    (
        '21. **Network Diagnostics ingestion contract** — a realistic report-v2 fixture proves whitelist-only local measurement mapping, per-fact multi-target scope, exact throughput conversion, explicit-time bounding, local-address privacy suppression, absence-without-fabrication, public/browser/derived/unknown exclusion, 09A/09B validation, malformed-report rejection, and unchanged Journey construction/reducer state.\n',
        '21. **Network Diagnostics ingestion contract** — a realistic report-v2 fixture proves whitelist-only local measurement mapping, per-fact multi-target scope, exact throughput conversion, explicit-time bounding, local-address privacy suppression, absence-without-fabrication, public/browser/derived/unknown exclusion, 09A/09B validation, malformed-report rejection, and unchanged Journey construction/reducer state.\n22. **Measured workspace contract + production browser audit** — source checks prohibit persistence/upload/Journey coupling while compatibility-only Chrome profiles attach real valid/invalid JSON files to the actual input, prove previous-valid preservation and Clear behavior, verify target/provenance/value rendering, and enforce desktop/mobile/reduced-motion overflow/runtime invariants across default/SwiftShader/WebGL-disabled modes.\n',
    ),
    (
        'The original proof was one routed-link failure/recovery scenario. The architecture now spans packets, protocol theater, topology authoring, Internet-scale renderers, public evidence adapters, a cross-scale URL Journey, portable scenarios, deterministic multi-cause GOD MODE composition, cross-layer outage recovery, ECN queue/congestion response, DNS timeout/retry behavior, HTTP service-unavailable retry, terminal network partition behavior, BGP route-leak policy anomalies that keep reachability separate from policy correctness, a production-artifact performance budget that measures renderer cost without making frame timing part of simulation truth, deterministic high-density stress fixtures that exercise the real Canvas/DOM-SVG/WebGL boundaries without changing default scenes, a Chrome/Firefox compatibility matrix that proves renderer/GPU fallback does not change semantic truth, and a native-measurement architecture with fail-closed provenance validation, a separate measured-state projection, and whitelist-only Network Diagnostics Suite report-v2 ingestion that cannot rewrite Journey truth.\n',
        'The original proof was one routed-link failure/recovery scenario. The architecture now spans packets, protocol theater, topology authoring, Internet-scale renderers, public evidence adapters, a cross-scale URL Journey, portable scenarios, deterministic multi-cause GOD MODE composition, cross-layer outage recovery, ECN queue/congestion response, DNS timeout/retry behavior, HTTP service-unavailable retry, terminal network partition behavior, BGP route-leak policy anomalies that keep reachability separate from policy correctness, a production-artifact performance budget that measures renderer cost without making frame timing part of simulation truth, deterministic high-density stress fixtures that exercise the real Canvas/DOM-SVG/WebGL boundaries without changing default scenes, a Chrome/Firefox compatibility matrix that proves renderer/GPU fallback does not change semantic truth, and a native-measurement architecture with fail-closed provenance validation, a separate measured-state projection, whitelist-only Network Diagnostics Suite report-v2 ingestion, and an explicit session-only measured workspace that cannot rewrite Journey truth.\n',
    ),
    (
        '- native transport/discovery and report-import UX that feed only the validated Network Diagnostics adapter path\n- measured-mode semantic scenes that consume the separate measured-state model without mutating simulated Journey truth\n',
        '- native transport/discovery that feeds only the validated Network Diagnostics adapter path; explicit report-file import already exists\n- measured facts reused inside existing routing/DNS/transport semantic scenes where useful, without mutating simulated Journey truth or implying one continuous measured route\n',
    ),
])

patch('README.md', [
    (
        'Production performance budgets, deterministic high-density stress profiles, and a production-artifact browser/GPU matrix now cover the normal product, the 160/220 AS Canvas fixture, Builder at its real 32/96 ceiling, a 2,000-point SIMULATED WebGL fixture, repeated Journey churn, Chrome default/SwiftShader/WebGL-disabled rendering, and Firefox/Gecko semantic compatibility with an honest WebGL fallback. Native measurement now has a strict `LOCAL MEASURED` provenance/schema contract, a separate measured-state projection, and whitelist-only ingestion of the existing Network Diagnostics Suite report-v2 format without promoting browser/public/derived/unknown report content into local truth. The next step is **transport/import UX plus measured semantic scenes on top of that validated ingestion path**.',
        'Production performance budgets, deterministic high-density stress profiles, and a production-artifact browser/GPU matrix now cover the normal product, the 160/220 AS Canvas fixture, Builder at its real 32/96 ceiling, a 2,000-point SIMULATED WebGL fixture, repeated Journey churn, Chrome default/SwiftShader/WebGL-disabled rendering, and Firefox/Gecko semantic compatibility with an honest WebGL fallback. Native measurement now has a strict `LOCAL MEASURED` provenance/schema contract, a separate measured-state projection, whitelist-only Network Diagnostics Suite report-v2 ingestion, and an explicit session-only measured workspace with real JSON import and permanent desktop/mobile/reduced-motion browser coverage. The remaining native work is **optional transport/discovery plus careful reuse of measured facts inside existing semantic scenes without turning them into simulated Journey truth**.',
    ),
])

Path('scripts/sync-lab09d-docs.py').unlink()
