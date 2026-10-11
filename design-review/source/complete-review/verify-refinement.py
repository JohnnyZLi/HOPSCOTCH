from pathlib import Path
import json,hashlib,re,subprocess,tarfile
from PIL import Image

base=Path('complete-review/refinement-audit');manifest=json.loads(Path('complete-review/source-manifest.json').read_text())
functional=json.loads((base/'functional-verification.json').read_text());assert functional['manifest']==manifest;assert len(functional['suites'])==9
for suite in functional['suites']:
    p=Path(suite['log']);assert suite['exit_code']==0;assert hashlib.sha256(p.read_bytes()).hexdigest()==suite['log_sha256'];assert not any(s in p.read_text() for s in ['AssertionError','SyntaxError','ReferenceError','TypeError'])
contracts=json.loads((base/'contracts.json').read_text());assert contracts['manifest']==manifest;assert contracts['checks']==259
for entry in manifest:assert hashlib.sha256(Path(entry['path']).read_bytes()).hexdigest()==entry['sha256']
cases=[]
for name,count in [('native-audit.json',244),('causal-native-audit.json',60)]:
    ledger=json.loads((base/name).read_text());assert ledger['manifest']==manifest;assert len(ledger['cases'])==count;cases+=ledger['cases']
    if name=='native-audit.json':assert len(ledger['pixel_rewrites'])==244
assert len({c['path'] for c in cases})==304
for case in cases:
    with Image.open(case['path']) as im:im.verify()
    with Image.open(case['path']) as im:im.load();assert im.size==(case['width'],case['height'])
sheets=[s for name in ['sheet-index.json','causal-sheet-index.json'] for s in json.loads((base/name).read_text())]
inspection=json.loads((base/'visual-inspection.json').read_text());details=json.loads((base/'detail-index.json').read_text())
assert set(inspection['sheets'])=={s['path'] for s in sheets};assert sorted(p for s in sheets for p in s['cases'])==sorted(c['path'] for c in cases)
assert set(inspection['details'])=={d['path'] for d in details}
for path in inspection['sheets']+inspection['details']:assert inspection['artifact_sha256'][path]==hashlib.sha256(Path(path).read_bytes()).hexdigest()
assert inspection['browser_verified'] is False
site=json.loads((base/'hosting.json').read_text());project=Path('/workspace/sites/hopscotch-review')
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=project,text=True).strip()==site['source_commit']
assert not subprocess.check_output(['git','status','--porcelain'],cwd=project,text=True).strip()
with tarfile.open('/workspace/sites/hopscotch-review-deployment.tar.gz') as archive:
    members=archive.getnames();assert any(n.endswith('.openai/hosting.json') for n in members);assert any(n.endswith('dist/index.html') for n in members)
for slug,entry in zip(['lifecycle','builder','evidence','connected'],manifest):
    body=(project/'dist'/(slug+'.html')).read_text();original=Path(entry['path']).read_text();assert original in body
    assert body.count('class="review-navigation"')==1
    for script in re.findall(r'<script>(.*?)</script>',body,re.S):
        result=subprocess.run(['node','--check'],input=script,text=True,capture_output=True);assert result.returncode==0,result.stderr
source=json.loads(Path('complete-review/final-source-audit.json').read_text());assert [s['sha256'] for s in source['sources']]==[m['sha256'] for m in manifest]
result={'kind':'Manifest-bound source, synthetic behavior, inspected native analytical pictures, and exact private Site source/package verification; no actual-browser claim','manifest':manifest,'suites':functional['suites'],'native_cases':304,'inspected_sheets':len(sheets),'inspected_details':len(details),'private_site':site,'protocol_preservation':contracts['preserved'],'browser_verified':False,'hopscotch_production_changed':False}
(base/'verification.json').write_text(json.dumps(result,indent=2));print('PASS refinement evidence:',len(functional['suites']),'suites;',len(cases),'native images;',len(sheets),'inspected sheets;',len(details),'details; private Site source/package match')
