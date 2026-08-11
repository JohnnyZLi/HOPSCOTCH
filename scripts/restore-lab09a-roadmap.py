from pathlib import Path
import subprocess

result = subprocess.run(
    ['git', 'show', 'origin/main:docs/ROADMAP.md'],
    check=True,
    capture_output=True,
    text=True,
)
text = result.stdout
old = '- [ ] define native measurement provenance contract'
new = '- [x] define native measurement provenance contract'
if old not in text:
    raise SystemExit('main ROADMAP native provenance checkbox anchor not found')
text = text.replace(old, new, 1)
Path('docs/ROADMAP.md').write_text(text)
Path('scripts/restore-lab09a-roadmap.py').unlink()
