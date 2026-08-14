from pathlib import Path

p=Path('package.json')
s=p.read_text()
old='"check": "npm run typecheck && npm run test:builder-contract && npm run test:builder-addressing-contract && npm run test:builder-routing-contract && npm run test:builder-ospf-contract && npm run test:builder-ospf-timing-contract && npm run test:builder-ospf-ecmp-contract && npm run test:builder-ospf-multiarea-contract && npm run test:builder-bgp-contract && npm run test:builder-bgp-projection-contract && npm run test:builder-ipv6-contract'
new='"check": "npm run typecheck && npm run test:builder-contract && npm run test:builder-addressing-contract && npm run test:builder-routing-contract && npm run test:builder-ospf-contract && npm run test:builder-ospf-timing-contract && npm run test:builder-ospf-ecmp-contract && npm run test:builder-ospf-multiarea-contract && npm run test:builder-bgp-contract && npm run test:builder-bgp-projection-contract && npm run test:builder-device-workbench-contract && npm run test:builder-ipv6-contract'
if s.count(old)!=1: raise SystemExit('check script anchor missing')
s=s.replace(old,new,1)
old='"test:builder-bgp-projection-contract": "node scripts/builder-bgp-projection-contract-check.mjs",\n    "test:builder-ipv6-contract"'
new='"test:builder-bgp-projection-contract": "node scripts/builder-bgp-projection-contract-check.mjs",\n    "test:builder-device-workbench-contract": "node scripts/builder-device-workbench-contract-check.mjs",\n    "test:builder-ipv6-contract"'
if s.count(old)!=1: raise SystemExit('contract script anchor missing')
s=s.replace(old,new,1)
p.write_text(s)
print('Wired builder-device-workbench-contract into npm run check.')
