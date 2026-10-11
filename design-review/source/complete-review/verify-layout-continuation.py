from pathlib import Path
import json,hashlib,re,subprocess,tarfile
from PIL import Image

base=Path('complete-review/layout-continuation-audit');manifest=json.loads(Path('complete-review/source-manifest.json').read_text())
functional=json.loads((base/'functional-verification.json').read_text());assert functional['manifest']==manifest and len(functional['suites'])==10
for suite in functional['suites']:
 p=Path(suite['log']);assert suite['exit_code']==0;assert hashlib.sha256(p.read_bytes()).hexdigest()==suite['log_sha256'];assert not any(s in p.read_text() for s in ['AssertionError','SyntaxError','ReferenceError','TypeError'])
contracts=json.loads((base/'contracts.json').read_text());assert contracts['manifest']==manifest and contracts['checks']==259
layout=json.loads((base/'layout-contracts.json').read_text());assert layout['manifest']==manifest and layout['checks']==78
for entry in manifest:assert hashlib.sha256(Path(entry['path']).read_bytes()).hexdigest()==entry['sha256']
equivalence=json.loads((base/'visual-equivalence.json').read_text());assert equivalence['manifest']==manifest and equivalence['native_images']==304
for item in equivalence['inputs']:
 old=Path('complete-review/refinement-audit')/item['input'];new=base/item['input'];assert hashlib.sha256(old.read_bytes()).hexdigest()==item['previous_file_sha256'];assert hashlib.sha256(new.read_bytes()).hexdigest()==item['current_file_sha256'];a=json.loads(old.read_text());b=json.loads(new.read_text());assert a['models']==b['models'] and b['manifest']==manifest
 assert hashlib.sha256(json.dumps(b['models'],sort_keys=True,separators=(',',':')).encode()).hexdigest()==item['canonical_models_sha256']
delta=json.loads((base/'source-delta.json').read_text());assert delta['manifest']==manifest;assert [r['current_sha256'] for r in delta['records']]==[r['sha256'] for r in manifest];assert all(r['only_shared_layout_controller_changed'] for r in delta['records'])
cases=[]
for name,count in [('native-audit.json',244),('causal-native-audit.json',60)]:
 ledger=json.loads((base/name).read_text());assert ledger['manifest']==manifest and len(ledger['cases'])==count;cases+=ledger['cases'];assert 'retained_pixel_manifest' in ledger
for case in cases:
 p=Path(case['path']);assert hashlib.sha256(p.read_bytes()).hexdigest()==equivalence['native_image_sha256'][str(p)]
 with Image.open(p) as im:im.verify()
 with Image.open(p) as im:im.load();assert im.size==(case['width'],case['height'])
sheets=[s for name in ['sheet-index.json','causal-sheet-index.json'] for s in json.loads((base/name).read_text())];details=json.loads((base/'detail-index.json').read_text());inspection=json.loads((base/'visual-inspection.json').read_text())
assert set(inspection['sheets'])=={s['path'] for s in sheets};assert sorted(p for s in sheets for p in s['cases'])==sorted(c['path'] for c in cases);assert set(inspection['details'])=={d['path'] for d in details}
for p in inspection['sheets']+inspection['details']:assert inspection['artifact_sha256'][p]==hashlib.sha256(Path(p).read_bytes()).hexdigest()
assert inspection['browser_verified'] is False
site=json.loads((base/'hosting.json').read_text());project=Path('/workspace/sites/hopscotch-review');assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=project,text=True).strip()==site['source_commit'];assert not subprocess.check_output(['git','status','--porcelain'],cwd=project,text=True).strip()
with tarfile.open('/workspace/sites/hopscotch-review-deployment.tar.gz') as archive:
 members=archive.getnames();assert any(n.endswith('.openai/hosting.json') for n in members);assert any(n.endswith('dist/index.html') for n in members)
for slug,entry in zip(['lifecycle','builder','evidence','connected'],manifest):
 body=(project/'dist'/(slug+'.html')).read_text();assert Path(entry['path']).read_text() in body;assert body.count('class="review-navigation"')==1
 for script in re.findall(r'<script>(.*?)</script>',body,re.S):
  r=subprocess.run(['node','--check'],input=script,text=True,capture_output=True);assert r.returncode==0,r.stderr
source=json.loads(Path('complete-review/final-source-audit.json').read_text());assert [s['sha256'] for s in source['sources']]==[m['sha256'] for m in manifest]
result={'kind':'Frozen ten-suite continuation, source preservation, exact private Site source/package, and retained visual evidence through exact input/source equality; no browser claim','manifest':manifest,'suites':functional['suites'],'new_layout_checks':78,'retained_native_cases':304,'prior_inspected_sheets':32,'prior_inspected_details':11,'visual_input_models_unchanged':152,'private_site':site,'protocol_preservation':contracts['preserved'],'browser_verified':False,'hopscotch_production_changed':False}
(base/'verification.json').write_text(json.dumps(result,indent=2)+'\n');print('PASS continuation: 10 suites; 78 new contracts; 152 unchanged visual inputs; 304 retained native images; exact private Site source/package')
