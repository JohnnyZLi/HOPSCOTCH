from pathlib import Path
p=Path('package.json')
s=p.read_text(encoding='utf-8')
a='npm run test:builder-ospf-multiarea-contract && npm run test:builder-ipv6-contract && npm run test:builder-probes-contract'
b='npm run test:builder-ospf-multiarea-contract && npm run test:builder-ipv6-contract && npm run test:builder-ipv6-ospfv3-contract && npm run test:builder-probes-contract'
if s.count(a)!=1: raise SystemExit('check anchor not unique')
s=s.replace(a,b,1)
a='    "test:builder-ipv6-contract": "node scripts/builder-ipv6-contract-check.mjs",'
b='    "test:builder-ipv6-contract": "node scripts/builder-ipv6-contract-check.mjs",\n    "test:builder-ipv6-ospfv3-contract": "node scripts/builder-ipv6-ospfv3-contract-check.mjs",'
if s.count(a)!=1: raise SystemExit('script anchor not unique')
s=s.replace(a,b,1)
p.write_text(s,encoding='utf-8')
print('Package wired to OSPFv3 contract.')