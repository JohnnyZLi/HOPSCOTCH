from pathlib import Path

replacement = "expected: ['32 NODES · 96 LINKS', 'GRAPH PATH', 'YES · COST', 'L3 FORWARDING', 'NO ROUTE']"

for filename in ['scripts/performance-profile.mjs', 'scripts/firefox-compatibility.mjs']:
    path = Path(filename)
    text = path.read_text()
    old = "expected: ['32 NODES · 96 LINKS', 'ROUTE INSTALLED']"
    if text.count(old) != 1:
        raise SystemExit(f'{filename}: expected exactly one legacy Builder semantic assertion, found {text.count(old)}')
    path.write_text(text.replace(old, replacement, 1))
    print(f'{filename}: Builder stress semantics now assert GRAPH PATH separately from L3 FORWARDING NO ROUTE.')
