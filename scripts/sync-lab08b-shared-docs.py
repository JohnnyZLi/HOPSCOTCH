from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise SystemExit(f'missing Lab 08B docs anchor in {path}: {old[:160]!r}')
    file.write_text(text.replace(old, new, 1))

replace_once(
    'docs/ROADMAP.md',
    '- [ ] high-density stress scenarios',
    '- [x] high-density stress scenarios',
)

replace_once(
    'docs/ARCHITECTURE.md',
    '16. **Production performance profile** — a separate Chrome/Chromium CDP workflow exercises the exact built artifact, enforces versioned stable structural/semantic budgets, stress-seeks deterministic state, and uploads a machine-readable report.',
    '16. **Production performance profile** — a separate Chrome/Chromium CDP workflow exercises the exact built artifact, enforces versioned stable structural/semantic budgets, stress-seeks deterministic state, and uploads a machine-readable report.\n17. **High-density renderer contracts** — query-only deterministic fixtures exercise AS Canvas at 160/220, Builder at its real 32/96 authoring ceiling, the physical WebGL buffer at 2,000 SIMULATED points, and a 12×54 seek churn pass with separate hosted-baseline stress ceilings.',
)
replace_once(
    'docs/ARCHITECTURE.md',
    '- profile before increasing scene density\n- profile the exact production `dist/` artifact rather than Vite dev mode',
    '- profile before increasing scene density\n- keep high-density fixtures query-only so default product scenes and normal public-data density remain unchanged\n- keep renderer-specific stress ceilings separate from normal-product budgets: Canvas/WebGL should not be judged by Builder DOM density, and Builder-at-ceiling should not silently raise the normal scene limit\n- preserve provenance under load: the 2,000-point globe fixture is explicitly SIMULATED/test-only and must never become `PUBLIC DATA` merely because it enters the same geometry renderer\n- profile the exact production `dist/` artifact rather than Vite dev mode',
)
replace_once(
    'docs/ARCHITECTURE.md',
    'and a production-artifact performance budget that measures renderer cost without making frame timing part of simulation truth.',
    'a production-artifact performance budget that measures renderer cost without making frame timing part of simulation truth, and deterministic high-density stress fixtures that exercise the real Canvas/DOM-SVG/WebGL boundaries without changing default scenes.',
)
replace_once(
    'docs/ARCHITECTURE.md',
    '- high-density stress scenarios measured against the established production performance budget\n- broader browser/GPU compatibility using the same semantic-state invariants',
    '- broader browser/GPU compatibility using the same semantic-state and renderer-budget invariants',
)

replace_once(
    'README.md',
    'Current work is hardening the renderer for the next scale of the project: **production performance budgets, high-density stress scenarios, broader browser/GPU compatibility, and future native/measured data sources for facts browsers cannot legitimately observe**.',
    'Production performance budgets and deterministic high-density stress profiles now cover the normal product, the 160/220 AS Canvas fixture, Builder at its real 32/96 ceiling, a 2,000-point SIMULATED WebGL fixture, and repeated Journey churn. Current hardening work is **broader browser/GPU compatibility and future native/measured data sources for facts browsers cannot legitimately observe**.',
)
