from pathlib import Path


def replace_once(path_name: str, old: str, new: str) -> None:
    path = Path(path_name)
    text = path.read_text()
    if old not in text:
        raise SystemExit(f'missing Lab 09E docs anchor in {path_name}: {old[:160]!r}')
    path.write_text(text.replace(old, new, 1))


replace_once(
    'docs/ROADMAP.md',
    '- [ ] map measured facts into existing semantic scenes where appropriate',
    '- [x] map measured facts into existing semantic scenes where appropriate',
)

replace_once(
    'README.md',
    "- `INFERRED`\n",
    "- `INFERRED`\n- `LOCAL MEASURED` — local-host, capture-bounded evidence that never becomes simulated Journey truth\n",
)
replace_once(
    'README.md',
    'The remaining native work is **optional transport/discovery plus careful reuse of measured facts inside existing semantic scenes without turning them into simulated Journey truth**.',
    'Validated `LOCAL MEASURED` facts can now appear as optional target-scoped sidecars in Journey routing/DNS/transport phases without entering the simulated scenario, event log, reducer, or semantic-scene props. The remaining native work is **optional transport/discovery that feeds the same validated measured-state path rather than inventing a second truth channel**.',
)

workspace_anchor = 'The Lab 09 measured workspace is a presentation layer over that validated measured-state object, not a second adapter. Import is explicit and session-only: a user-selected JSON file is read in browser memory, passed through the permanent 09C ingestion function, and displayed only after validation/projection succeeds. The workspace does not persist report bytes/facts, upload them, poll localhost, or import Journey code. Invalid replacement imports leave the last valid measured state active. Category renderers group facts by their explicit target and refuse to visually concatenate separate targets into one observed end-to-end path.\n'
sidecar_paragraph = workspace_anchor + '\nMeasured evidence reuse remains one-way and target-scoped. App may retain one validated measured-state projection in session memory and pass it to presentation consumers, but Journey construction/reduction stays independent. A pure compatibility layer classifies routing/DNS/transport facts as `MATCHED TARGET`, `LOCAL CONTEXT`, or `OTHER TARGET` from the simulated hostname/documentation address without importing Journey code. The semantic scene continues to receive only simulated `JourneyState` plus simulated hostname/address; a separate compact sidecar renders compatible measured facts, labels them `LOCAL MEASURED · LOCAL HOST · NOT GLOBAL`, hides mismatched values, and states `SIMULATED STORY UNCHANGED`. Clearing the Lab 09 session removes the sidecars without changing Journey state.\n'
replace_once('docs/ARCHITECTURE.md', workspace_anchor, sidecar_paragraph)

validation_anchor = '22. **Measured workspace contract + production browser audit** — source checks prohibit persistence/upload/Journey coupling while compatibility-only Chrome profiles attach real valid/invalid JSON files to the actual input, prove previous-valid preservation and Clear behavior, verify target/provenance/value rendering, and enforce desktop/mobile/reduced-motion overflow/runtime invariants across default/SwiftShader/WebGL-disabled modes.\n'
validation_new = validation_anchor + '23. **Measured semantic-sidecar contract + production browser audit** — pure target compatibility separates matched target, local context, and other-target evidence; source contracts keep Journey model/modifiers free of measured-state dependencies; compatibility-only Chrome imports a real report, crosses Lab 09 → Journey, proves routing/DNS/transport sidecar semantics, hides mismatched values, verifies Clear removes sidecars, and enforces viewport/runtime invariants on desktop, exact 390 px mobile, and reduced motion.\n'
replace_once('docs/ARCHITECTURE.md', validation_anchor, validation_new)

replace_once(
    'docs/ARCHITECTURE.md',
    'and an explicit session-only measured workspace that cannot rewrite Journey truth.',
    'an explicit session-only measured workspace that cannot rewrite Journey truth, and optional target-scoped measured sidecars that remain outside the canonical Journey event/reducer path.',
)
replace_once(
    'docs/ARCHITECTURE.md',
    '- native transport/discovery that feeds only the validated Network Diagnostics adapter path; explicit report-file import already exists\n- measured facts reused inside existing routing/DNS/transport semantic scenes where useful, without mutating simulated Journey truth or implying one continuous measured route\n',
    '- native transport/discovery that feeds only the validated Network Diagnostics adapter path; explicit report-file import and target-scoped semantic sidecars already exist\n',
)

Path('scripts/sync-lab09e-docs.py').unlink()
