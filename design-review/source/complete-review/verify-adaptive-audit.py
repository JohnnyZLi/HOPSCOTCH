from pathlib import Path
import json,hashlib
from PIL import Image

base=Path('complete-review/adaptive-audit');current=base/'final'
manifest=json.loads(Path('complete-review/source-manifest.json').read_text())
baseline_archive_sha256='017a091068d8108e1aa6012a709fe5f7c9cc5445656e86d27f3c85363f805eb4'
preserved={'domain.bundle.js':'428e415ba73a47bb247ec0bb255aeadd5feda1503c8e5140094f5b3feda3e58d','evidence-domain.bundle.js':'6bdda42d427e5743b42f564d71b6bf6029c613258276dcc82aa07ddf1d70dbf4','entry-domain.bundle.js':'7e12f09a35235d6bcb358121961717ab81b6871d7f86d6b97a69a2058fac0360','source-data.json':'3d727d60ec4605973a5fc2ff73958c2f720d0c1060b9a219cb573d9d98fe019e','d3-array.min.js':'8b5dfd8d07c71c44a5eeb290ef7dacdbf47cbe1e06e3c333c6c8132018f8f72f','d3-geo.min.js':'f68f1d07c7b9ea5db6f85f371e0076f6fe702c10f06012ce1e49edeb824c22ea','world-110m.topojson':'e5d20e03dc01a0aaf2e2434377fc26b421e8bf852957bcc8afadb44d320e92bb'}
for name,digest in preserved.items():assert hashlib.sha256(Path('complete-review',name).read_bytes()).hexdigest()==digest
for item in manifest:
 assert hashlib.sha256(Path(item['path']).read_bytes()).hexdigest()==item['sha256']
expected={'complete':124358,'connected':26860,'dense':26035,'followup':2030,'shared':447,'lifecycle':64,'adaptation':670}
logs={}
for name,count in expected.items():
 p=base/(name+'-frozen.log');text=p.read_text();assert str(count) in text,(p,'missing completion count');assert not any(e in text for e in ['AssertionError','SyntaxError','ReferenceError','TypeError']),p
 logs[name]={'path':str(p),'assertions':count}
assert '1092' in (base/'adaptive-final.log').read_text()
contracts=json.loads((base/'contracts.json').read_text());assert contracts['manifest']==manifest;assert contracts['count']==1092
cases=[]
for name,n in [('native-audit.json',224),('causal-native-audit.json',60)]:
 ledger=json.loads((current/name).read_text());assert ledger['manifest']==manifest;assert len(ledger['cases'])==n;cases.extend(ledger['cases'])
 if name=='native-audit.json':assert len(ledger['pixel_rewrites'])==224,'Final DOM images must all be regenerated, not reused'
assert len({c['path'] for c in cases})==284
for c in cases:
 with Image.open(c['path']) as im:im.verify()
 with Image.open(c['path']) as im:im.load();assert im.width==c['width'];assert im.height==c['height']
sheets=[s for name in ['sheet-index.json','causal-sheet-index.json'] for s in json.loads((current/name).read_text())]
assert len(sheets)==32
assert sorted(p for s in sheets for p in s['cases'])==sorted(c['path'] for c in cases)
inspected=json.loads((current/'visual-inspection.json').read_text());assert set(inspected['sheets'])=={s['path'] for s in sheets};assert inspected['browser_verified'] is False
details=json.loads((current/'detail-index.json').read_text());assert {d['path'] for d in details}==set(inspected['details'])
for p in [s['path'] for s in sheets]+[d['path'] for d in details]:
 assert inspected['artifact_sha256'][p]==hashlib.sha256(Path(p).read_bytes()).hexdigest(),('Inspected image changed',p)
 with Image.open(p) as im:im.verify()
 with Image.open(p) as im:im.load()
report={'kind':'Final manifest-bound synthetic/source and native analytical evidence, not browser acceptance','manifest':manifest,'regressions':logs,'adaptive_assertions':1092,'native_cases':284,'paired_sheets':32,'paired_details':len(details),'model_preservation':{'baseline_archive_sha256':baseline_archive_sha256,'unchanged_sha256':preserved},'production_changed':False,'browser_verified':False}
(base/'verification.json').write_text(json.dumps(report,indent=2));print('PASS frozen evidence:',len(logs)+1,'suites;',len(cases),'native cases;',len(sheets),'inspected sheets')
