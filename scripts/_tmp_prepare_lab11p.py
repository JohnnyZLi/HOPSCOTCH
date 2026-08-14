from pathlib import Path
p=Path('docs/ROADMAP.md')
s=p.read_text()
old='- [ ] EVENTS answers what changed, when, and which upstream event caused it'
new='- [ ] EVENTS answers what changed, when it changed, and which upstream event caused the change'
if s.count(old)!=1: raise SystemExit(f'roadmap event anchor expected once, found {s.count(old)}')
p.write_text(s.replace(old,new,1))
print('Normalized Lab 11P roadmap event wording.')
