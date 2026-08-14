from pathlib import Path
p=Path('src/builder/device-workbench.ts')
s=p.read_text()
for old,new,label in [
    ("Static mapping exists independent from active translation state.')]));", "Static mapping exists independent from active translation state.')]))) ;", 'static NAT row'),
    ("Published tuple is persisted; matching flow state remains derived.')]));", "Published tuple is persisted; matching flow state remains derived.')]))) ;", 'port-forward row'),
]:
    if s.count(old)!=1: raise SystemExit(f'{label}: expected once, found {s.count(old)}')
    s=s.replace(old,new,1)
# Remove the harmless spacing before the semicolons so the generated source stays tidy.
s=s.replace(")]))) ;", ")]))) ;")
p.write_text(s)
print('Fixed generated Lab 11P NAT configuration row closures.')
