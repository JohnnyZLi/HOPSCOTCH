from pathlib import Path
changed=[]
count=0
for p in sorted(Path('scripts').glob('builder-*-contract-check.mjs')):
    text=p.read_text(encoding='utf-8')
    n=text.count('.version, 8)')
    if not n:
        continue
    p.write_text(text.replace('.version, 8)', '.version, 9)'),encoding='utf-8')
    changed.append(str(p))
    count+=n
print(f'Updated {count} stale Builder schema assertion(s) to v9 across {len(changed)} contract file(s): {", ".join(changed)}')
