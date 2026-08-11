from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise SystemExit(f'missing docs anchor in {path}: {old[:140]!r}')
    file.write_text(text.replace(old, new, 1))

replace_once(
    'docs/ROADMAP.md',
    '- [ ] renderer performance budget and profiling harness',
    '- [x] renderer performance budget and profiling harness',
)

replace_once(
    'docs/ARCHITECTURE.md',
    '15. **Desktop/mobile/reduced-motion assertions** — overflow, semantic state, navigation, viewport stability, and runtime errors.',
    '15. **Desktop/mobile/reduced-motion assertions** — overflow, semantic state, navigation, viewport stability, and runtime errors.\n16. **Production performance profile** — a separate Chrome/Chromium CDP workflow exercises the exact built artifact, enforces versioned stable structural/semantic budgets, stress-seeks deterministic state, and uploads a machine-readable report.',
)
replace_once(
    'docs/ARCHITECTURE.md',
    '- profile before increasing scene density\n- preserve identical semantic results under reduced motion',
    '- profile before increasing scene density\n- profile the exact production `dist/` artifact rather than Vite dev mode\n- keep versioned bundle/DOM/heap/overflow/semantic budgets separate from runner-sensitive timing diagnostics\n- treat browser startup retries as bounded CI infrastructure handling, never as a reason to hide a semantic or budget failure\n- keep normal model/type/contract CI independent from whether a developer machine has Chrome installed\n- preserve identical semantic results under reduced motion',
)
replace_once(
    'docs/ARCHITECTURE.md',
    'terminal network partition behavior, and BGP route-leak policy anomalies that keep reachability separate from policy correctness.',
    'terminal network partition behavior, BGP route-leak policy anomalies that keep reachability separate from policy correctness, and a production-artifact performance budget that measures renderer cost without making frame timing part of simulation truth.',
)
replace_once(
    'docs/ARCHITECTURE.md',
    '- renderer/performance budgets for substantially denser scenarios',
    '- high-density stress scenarios measured against the established production performance budget\n- broader browser/GPU compatibility using the same semantic-state invariants',
)
