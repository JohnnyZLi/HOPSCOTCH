from pathlib import Path
import hashlib, json, re, subprocess
from PIL import Image

base=Path('complete-review/reaudit-20261006')
manifest=json.loads(Path('complete-review/source-manifest.json').read_text())
functional=json.loads((base/'functional-verification.json').read_text())
assert functional['manifest']==manifest and len(functional['suites'])==11
for suite in functional['suites']:
    p=Path(suite['log'])
    assert suite['exit_code']==0 and hashlib.sha256(p.read_bytes()).hexdigest()==suite['log_sha256']
    assert not any(error in p.read_text() for error in ['AssertionError','SyntaxError','ReferenceError','TypeError'])
for name,count in [('contracts.json',259),('layout-contracts.json',78),('cleanup-contracts.json',32)]:
    ledger=json.loads((base/name).read_text())
    assert ledger['manifest']==manifest and ledger['checks']==count
for entry in manifest:
    assert hashlib.sha256(Path(entry['path']).read_bytes()).hexdigest()==entry['sha256']
cases=[]
for name,count in [('native-audit.json',244),('causal-native-audit.json',60)]:
    ledger=json.loads((base/name).read_text())
    assert ledger['manifest']==manifest and len(ledger['cases'])==count
    assert 'retained_pixel_manifest' not in ledger
    cases.extend(ledger['cases'])
    for case in ledger['cases']:
        with Image.open(case['path']) as image:image.verify()
        with Image.open(case['path']) as image:
            image.load(); assert image.size==(case['width'],case['height'])
models=[]
for name,count in [('compositions.json',122),('causal-compositions.json',30)]:
    ledger=json.loads((base/name).read_text())
    assert ledger['manifest']==manifest and len(ledger['models'])==count
    models.extend(ledger['models'])
sheets=[s for name in ['sheet-index.json','causal-sheet-index.json'] for s in json.loads((base/name).read_text())]
details=json.loads((base/'detail-index.json').read_text())
inspection=json.loads((base/'visual-inspection.json').read_text())
assert len(sheets)==32 and len(details)==11
assert set(inspection['sheets'])=={s['path'] for s in sheets}
assert set(inspection['details'])=={d['path'] for d in details}
assert sorted(p for s in sheets for p in s['cases'])==sorted(c['path'] for c in cases)
for p in inspection['sheets']+inspection['details']:
    assert inspection['artifact_sha256'][p]==hashlib.sha256(Path(p).read_bytes()).hexdigest()
assert inspection['browser_verified'] is False
review=json.loads((base/'source-review.json').read_text())
assert set(review['changed'])=={'complete-review/connected.js','complete-review/review.css'}
for item in review['reviewed']:
    assert hashlib.sha256(Path(item['path']).read_bytes()).hexdigest()==item['sha256']
assert review['protocol_marker_source_check']['expanded_and_collapsed_background_roles_equal']
source=json.loads(Path('complete-review/final-source-audit.json').read_text())
assert [s['sha256'] for s in source['sources']]==[m['sha256'] for m in manifest]
site=json.loads((base/'hosting.json').read_text())
project=Path('/workspace/sites/hopscotch-review')
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=project,text=True).strip()==site['source_commit']
assert not subprocess.check_output(['git','status','--porcelain'],cwd=project,text=True).strip()
for slug,entry in zip(['lifecycle','builder','evidence','connected'],manifest):
    body=(project/'dist'/(slug+'.html')).read_text()
    assert Path(entry['path']).read_text() in body
    for script in re.findall(r'<script>(.*?)</script>',body,re.S):
        result=subprocess.run(['node','--check'],input=script,text=True,capture_output=True)
        assert result.returncode==0,result.stderr
result={'kind':'Fresh frozen eleven-suite audit, source review and newly rendered/re-inspected native analytical compositions; no browser acceptance claim',
        'manifest':manifest,'suites':functional['suites'],'new_cleanup_checks':32,
        'native_cases':304,'inspected_sheets':32,'inspected_details':11,
        'runtime_selections':152,'private_site':site,'protocol_preservation':json.loads((base/'contracts.json').read_text())['preserved'],
        'browser_verified':False,'hopscotch_production_changed':False}
(base/'verification.json').write_text(json.dumps(result,indent=2)+'\n')
print('PASS fresh re-audit: eleven suites; 32 new cleanup contracts; 304 native images; 43 inspected sheets/details; exact private Site source')
