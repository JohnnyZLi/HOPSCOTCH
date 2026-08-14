from pathlib import Path
p=Path('src/builder/device-workbench.ts')
s=p.read_text()
old="Import/export policy and relationship export allowed this route.')]));"
new="Import/export policy and relationship export allowed this route.')]))) ;"
if s.count(old)!=1: raise SystemExit(f'BGP route row closure expected once, found {s.count(old)}')
s=s.replace(old,new,1)
p.write_text(s)
print('Fixed generated Lab 11P BGP route row closure.')
