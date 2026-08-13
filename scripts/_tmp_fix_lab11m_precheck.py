from pathlib import Path
p=Path('scripts/builder-addressing-contract-check.mjs')
text=p.read_text(encoding='utf-8')
count=text.count('.version, 8)')
if count < 1:
    raise SystemExit('no stale addressing schema assertions found')
text=text.replace('.version, 8)', '.version, 9)')
p.write_text(text,encoding='utf-8')
print(f'Updated {count} stale addressing contract schema expectation(s) to v9.')
