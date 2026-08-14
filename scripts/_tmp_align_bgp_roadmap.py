from pathlib import Path
p=Path('docs/ROADMAP.md')
s=p.read_text(encoding='utf-8')
s=s.replace('- [ ] advertise/withdraw prefixes through a deterministic path-vector control plane','- [ ] advertise and withdraw prefixes through a deterministic path-vector control plane')
s=s.replace('- [ ] expose AS_PATH, LOCAL_PREF, MED, NEXT_HOP, communities, and best-path reasoning','- [ ] expose `AS_PATH`, `LOCAL_PREF`, `MED`, `NEXT_HOP`, communities, and best-path reasoning')
s=s.replace('- [ ] route leaks and hijack-style teaching scenarios reuse the same policy truth as Lab 05 rather than a second BGP model','- [ ] route leaks and hijack-style teaching scenarios reuse the same policy truth as Lab 05 instead of creating a second BGP model')
p.write_text(s,encoding='utf-8')
print('Aligned Lab 11O roadmap anchors.')
