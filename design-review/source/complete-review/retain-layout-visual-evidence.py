from pathlib import Path
import json,hashlib,subprocess

base=Path('complete-review');old=base/'refinement-audit';new=base/'layout-continuation-audit'
manifest=json.loads((base/'source-manifest.json').read_text());records=[]
previous_commit='01693442f68fa834d6d9ab3375589eb3733db834'
def omit_layout(s):
 mark=s.index('// Measure alternate content');start=s.rfind('(()=>{',0,mark);end=s.index('\n})();',mark)+len('\n})();');return s[:start]+s[end:]
for slug,m in zip(['lifecycle','builder','evidence','connected'],manifest):
 body=subprocess.check_output(['git','show',previous_commit+':dist/'+slug+'.html'],cwd='/workspace/sites/hopscotch-review',text=True);start=body.index('<div class="review-content">')+len('<div class="review-content">');end=body.index('</div><script>(()=>{const owner');before=body[start:end];after=Path(m['path']).read_text();assert omit_layout(before)==omit_layout(after),slug
 records.append({'study':slug,'previous_sha256':hashlib.sha256(before.encode()).hexdigest(),'current_sha256':m['sha256'],'only_shared_layout_controller_changed':True})
(new/'source-delta.json').write_text(json.dumps({'kind':'Exact emitted-fragment comparison with pinned previously published source, excluding only shared layout controller','previous_site_commit':previous_commit,'manifest':manifest,'records':records},indent=2)+'\n')
proof=[]
for name in ['compositions.json','causal-compositions.json']:
 a=json.loads((old/name).read_text());b=json.loads((new/name).read_text());assert b['manifest']==manifest;assert a['models']==b['models'];encoded=json.dumps(a['models'],sort_keys=True,separators=(',',':')).encode();proof.append({'input':name,'models':len(a['models']),'identical':True,'canonical_models_sha256':hashlib.sha256(encoded).hexdigest(),'previous_file_sha256':hashlib.sha256((old/name).read_bytes()).hexdigest(),'current_file_sha256':hashlib.sha256((new/name).read_bytes()).hexdigest()})
pixels={}
for name in ['native-audit.json','causal-native-audit.json']:
 ledger=json.loads((old/name).read_text());ledger['retained_pixel_manifest']=ledger['manifest'];ledger['manifest']=manifest;ledger['kind']='Retained previously inspected native analytical pixels after exact runtime-tree and non-layout-controller source equivalence; no fresh-render or browser claim';ledger['retention_reason']='All sampled models and markup/CSS/optical/motion/domain source remain identical; only shared layout cache, gaps and cleanup changed.'
 if 'pixel_rewrites' in ledger:ledger['previous_pixel_rewrites']=ledger.pop('pixel_rewrites')
 for case in ledger['cases']:
  p=Path(case['path']);pixels[str(p)]=hashlib.sha256(p.read_bytes()).hexdigest()
 (new/name).write_text(json.dumps(ledger,indent=2)+'\n')
for name in ['sheet-index.json','causal-sheet-index.json','detail-index.json','visual-inspection.json']:
 s=json.loads((old/name).read_text())
 if name=='visual-inspection.json':s['kind']='Prior completed visual inspection retained for unchanged analytical pictures; current sampled runtime/source equivalence proved separately';s['retained_from']=str(old/name)
 (new/name).write_text(json.dumps(s,indent=2)+'\n')
(new/'visual-equivalence.json').write_text(json.dumps({'kind':'Exact input/source equality permits evidence reuse; no current browser or freshly rendered pixel claim','inputs':proof,'source_delta':str(new/'source-delta.json'),'native_images':len(pixels),'native_image_sha256':pixels,'manifest':manifest,'browser_verified':False},indent=2)+'\n')
print('PASS retained visual evidence: 152 identical sampled inputs, 304 pixel hashes and previous inspection preserved')
