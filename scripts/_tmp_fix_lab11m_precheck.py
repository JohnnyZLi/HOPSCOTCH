from pathlib import Path
import re
changed=[]
count=0
pattern=re.compile(r'(\.version\s*,\s*)8(\s*\))')
for p in sorted(Path('scripts').glob('builder-*-contract-check.mjs')):
    text=p.read_text(encoding='utf-8')
    next_text,n=pattern.subn(r'\g<1>9\g<2>',text)
    if not n:
        continue
    p.write_text(next_text,encoding='utf-8')
    changed.append(str(p))
    count+=n
print(f'Updated {count} stale Builder schema assertion(s) to v9 across {len(changed)} contract file(s): {", ".join(changed)}')
