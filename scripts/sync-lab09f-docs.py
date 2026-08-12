from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise SystemExit(f'anchor missing in {path}: {old[:80]!r}')
    if text.count(old) != 1:
        raise SystemExit(f'anchor is not unique in {path}: {old[:80]!r}')
    file.write_text(text.replace(old, new, 1))

replace_once(
    'docs/ROADMAP.md',
    '## Measured/native mode — future\n',
    '## Measured/native mode — ongoing\n',
)
replace_once(
    'docs/ROADMAP.md',
    '- [x] map measured facts into existing semantic scenes where appropriate\n',
    '- [x] map measured facts into existing semantic scenes where appropriate\n- [x] explicit loopback-only Network Diagnostics bridge transport with no scanning, polling, credentials, or alternate truth path\n',
)

workspace_paragraph = "The Lab 09 measured workspace is a presentation layer over that validated measured-state object, not a second adapter. Import is explicit and session-only: a user-selected JSON file is read in browser memory, passed through the permanent 09C ingestion function, and displayed only after validation/projection succeeds. The workspace does not persist report bytes/facts, upload them, poll localhost, or import Journey code. Invalid replacement imports leave the last valid measured state active. Category renderers group facts by their explicit target and refuse to visually concatenate separate targets into one observed end-to-end path.\n"
bridge_paragraph = workspace_paragraph + "\nLab 09F adds a second explicit acquisition method without changing that truth boundary: a loopback-only Network Diagnostics bridge. The client accepts only `localhost`, `127.0.0.0/8`, or `::1`, uses fixed handshake/report paths, omits credentials, rejects redirects, and performs no discovery, scanning, streaming, or background polling. `CONNECT` validates bridge identity/capability only; it cannot create measured facts. `REFRESH REPORT` is the separate action that fetches one report and must pass the existing Network Diagnostics report-v2 adapter → native parser → measured-state projection. Disconnecting transport does not erase the last measurement, and clearing measured state does not silently mutate bridge connection state.\n"
replace_once('docs/ARCHITECTURE.md', workspace_paragraph, bridge_paragraph)

validation_anchor = '23. **Measured semantic-sidecar contract + production browser audit** — pure target compatibility separates matched target, local context, and other-target evidence; source contracts keep Journey model/modifiers free of measured-state dependencies; compatibility-only Chrome imports a real report, crosses Lab 09 → Journey, proves routing/DNS/transport sidecar semantics, hides mismatched values, verifies Clear removes sidecars, and enforces viewport/runtime invariants on desktop, exact 390 px mobile, and reduced motion.\n'
replace_once(
    'docs/ARCHITECTURE.md',
    validation_anchor,
    validation_anchor + '24. **Loopback bridge transport + browser contract** — pure contracts reject non-loopback origins before fetch, enforce the fixed v1 handshake/report surface and no-credential bounded requests, require the existing 09C ingestion path, and keep Journey truth byte-identical; production Chrome then mocks network failure, rejected handshake, valid/invalid refresh, Clear, Disconnect, and request-option invariants on desktop, exact 390 px mobile, and reduced motion across default/SwiftShader/WebGL-disabled modes.\n',
)

old_direction = 'The original proof was one routed-link failure/recovery scenario. The architecture now spans packets, protocol theater, topology authoring, Internet-scale renderers, public evidence adapters, a cross-scale URL Journey, portable scenarios, deterministic multi-cause GOD MODE composition, cross-layer outage recovery, ECN queue/congestion response, DNS timeout/retry behavior, HTTP service-unavailable retry, terminal network partition behavior, BGP route-leak policy anomalies that keep reachability separate from policy correctness, a production-artifact performance budget that measures renderer cost without making frame timing part of simulation truth, deterministic high-density stress fixtures that exercise the real Canvas/DOM-SVG/WebGL boundaries without changing default scenes, a Chrome/Firefox compatibility matrix that proves renderer/GPU fallback does not change semantic truth, and a native-measurement architecture with fail-closed provenance validation, a separate measured-state projection, whitelist-only Network Diagnostics Suite report-v2 ingestion, an explicit session-only measured workspace that cannot rewrite Journey truth, and optional target-scoped measured sidecars that remain outside the canonical Journey event/reducer path.\n'
new_direction = 'The original proof was one routed-link failure/recovery scenario. The architecture now spans packets, protocol theater, topology authoring, Internet-scale renderers, public evidence adapters, a cross-scale URL Journey, portable scenarios, deterministic multi-cause GOD MODE composition, cross-layer outage recovery, ECN queue/congestion response, DNS timeout/retry behavior, HTTP service-unavailable retry, terminal network partition behavior, BGP route-leak policy anomalies that keep reachability separate from policy correctness, a production-artifact performance budget that measures renderer cost without making frame timing part of simulation truth, deterministic high-density stress fixtures that exercise the real Canvas/DOM-SVG/WebGL boundaries without changing default scenes, a Chrome/Firefox compatibility matrix that proves renderer/GPU fallback does not change semantic truth, and a native-measurement architecture with fail-closed provenance validation, a separate measured-state projection, whitelist-only Network Diagnostics Suite report-v2 ingestion, an explicit session-only measured workspace, optional target-scoped measured sidecars, and an explicit loopback-only bridge transport that all remain outside the canonical Journey event/reducer path.\n'
replace_once('docs/ARCHITECTURE.md', old_direction, new_direction)
replace_once(
    'docs/ARCHITECTURE.md',
    '- native transport/discovery that feeds only the validated Network Diagnostics adapter path; explicit report-file import and target-scoped semantic sidecars already exist\n',
    '- a native Network Diagnostics companion implementation may serve the fixed 09F loopback handshake/report contract, but HOPSCOTCH itself must not grow LAN discovery, port scanning, or a second measurement ingestion path\n',
)

old_status = 'Production performance budgets, deterministic high-density stress profiles, and a production-artifact browser/GPU matrix now cover the normal product, the 160/220 AS Canvas fixture, Builder at its real 32/96 ceiling, a 2,000-point SIMULATED WebGL fixture, repeated Journey churn, Chrome default/SwiftShader/WebGL-disabled rendering, and Firefox/Gecko semantic compatibility with an honest WebGL fallback. Native measurement now has a strict `LOCAL MEASURED` provenance/schema contract, a separate measured-state projection, whitelist-only Network Diagnostics Suite report-v2 ingestion, and an explicit session-only measured workspace with real JSON import and permanent desktop/mobile/reduced-motion browser coverage. Validated `LOCAL MEASURED` facts can now appear as optional target-scoped sidecars in Journey routing/DNS/transport phases without entering the simulated scenario, event log, reducer, or semantic-scene props. The remaining native work is **optional transport/discovery that feeds the same validated measured-state path rather than inventing a second truth channel**.'
new_status = 'Production performance budgets, deterministic high-density stress profiles, and a production-artifact browser/GPU matrix now cover the normal product, the 160/220 AS Canvas fixture, Builder at its real 32/96 ceiling, a 2,000-point SIMULATED WebGL fixture, repeated Journey churn, Chrome default/SwiftShader/WebGL-disabled rendering, and Firefox/Gecko semantic compatibility with an honest WebGL fallback. Native measurement now has a strict `LOCAL MEASURED` provenance/schema contract, a separate measured-state projection, whitelist-only Network Diagnostics Suite report-v2 ingestion, an explicit session-only measured workspace, and optional target-scoped Journey sidecars without entering simulated truth. Lab 09 can acquire the same validated report either by explicit JSON import or through an explicit loopback-only Network Diagnostics bridge with fixed endpoints, no credentials, no scanning/discovery, and no background polling. The remaining native-side work is **an optional companion bridge/server implementation outside HOPSCOTCH; the web app already has the bounded acquisition contract it needs**.'
replace_once('README.md', old_status, new_status)

print('Synchronized Lab 09F ROADMAP, ARCHITECTURE, and README.')
