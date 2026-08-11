from pathlib import Path

patches = {
    'src/App.tsx': [
        ("'LOCAL MEASUREMENT WORKSPACE ACTIVE'", "'LOCAL MEASURED ACTIVE'"),
    ],
    'scripts/measured-workspace-contract-check.mjs': [
        ("/LOCAL MEASUREMENT WORKSPACE ACTIVE/", "/LOCAL MEASURED ACTIVE/"),
        ("'top bar must identify measured workspace state'", "'top bar must identify measured workspace state concisely'"),
    ],
    'docs/LAB09D.md': [
        ('- `LOCAL MEASUREMENT WORKSPACE ACTIVE`', '- `LOCAL MEASURED ACTIVE`'),
        ('Facts inside the selected domain are grouped by their explicit target scope.\n', 'Facts inside the selected domain are grouped by their explicit target scope. When a domain has multiple targets, a compact target selector shows one target group at a time rather than rendering every target as one long ledger.\n'),
        ('5. verifies source/provenance/value text and non-empty measured facts\n', '5. verifies source/provenance text, selects the explicit transfer target scope, and verifies the expected measured value\n'),
    ],
}
for path_name, replacements in patches.items():
    path = Path(path_name)
    text = path.read_text()
    for old, new in replacements:
        if old not in text:
            raise SystemExit(f'Lab 09D header/doc anchor missing in {path_name}: {old!r}')
        text = text.replace(old, new, 1)
    path.write_text(text)
