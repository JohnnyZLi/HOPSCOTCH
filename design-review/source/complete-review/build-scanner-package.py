from pathlib import Path
import zipfile,json,hashlib,os

base=Path.cwd();audit=base/os.environ.get('HOPSCOTCH_AUDIT_DIR','complete-review/scanner-lifecycle-20261007')
verification=json.loads((audit/'verification.json').read_text())
manifest=verification['manifest'];out=base/'HOPSCOTCH-Review-System-Fixes.zip';temporary=out.with_suffix('.new.zip')
replacements={}
with zipfile.ZipFile(out) as prior:
 for name in prior.namelist():
  if name.startswith('complete-review/') and '/' not in name[len('complete-review/'):]:
   p=base/name
   if p.is_file():replacements[name]=p
  elif name.startswith('docs/'):
   p=base/'app-doc-current'/Path(name).name
   if p.is_file():replacements[name]=p
  elif name.endswith('.html'):
   p=Path('/workspace')/Path(name).name
   if p.is_file():replacements[name]=p
 additions=[base/'complete-review/check-scanner-lifecycle.mjs',base/'complete-review/check-scanner-existing.mjs',base/'complete-review/update-scanner-docs.py',Path(__file__).resolve(),*sorted(p for p in audit.rglob('*') if p.is_file())]
 for p in additions:replacements[str(p.relative_to(base))]=p
 for m in manifest:replacements['emitted/'+Path(m['path']).name]=Path(m['path'])
 for name in ['check-related-motion.mjs','check-origin-sweep.mjs','update-related-docs.py']:
  p=base/'complete-review'/name
  if p.is_file():replacements[str(p.relative_to(base))]=p
 readme='''# HOPSCOTCH review — scanner and lifecycle correction, 7 October 2026

The current isolated review fixes missing absolute-position origins and removes
the unnecessary expanded construction / fold before sending wire packets.
The lens uses current actor pose plus measured glyph-local positions. The
approved skinny aperture, type, palette, optics and docking remain intact.

Current authority: docs/HOPSCOTCH-Author-Audit.md v3.7, and
complete-review/scanner-lifecycle-20261007/verification.json.
All historical re-audit logs/images under reaudit-20261006 and earlier belong
to their historical manifests. They are retained as history, not current
browser acceptance. Those static analytical views missed this CSS origin bug.
The current correction has source CSS contracts and emitted-runtime synthetic
tests; no new browser captures or native visual renders are claimed.

Private review: https://hopscotch-design-review.noodle1.chatgpt.site/lifecycle.html
HOPSCOTCH repository/production remains untouched. Actual browser, platform
fonts and compositor playback acceptance remains open.
'''
 if (audit/'README.md').is_file():readme=(audit/'README.md').read_text()
 with zipfile.ZipFile(temporary,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
  z.writestr('README.md',readme)
  for name in prior.namelist():
   if name=='README.md':continue
   if name in replacements:z.write(replacements.pop(name),name)
   else:z.writestr(name,prior.read(name))
  for name,p in replacements.items():z.write(p,name)
with zipfile.ZipFile(temporary) as z:
 assert len(z.namelist())==len(set(z.namelist())) and z.testzip() is None
 for m in manifest:
  found=[name for name in z.namelist() if Path(name).name==Path(m['path']).name]
  assert len(found)==1,(m['path'],found)
  assert hashlib.sha256(z.read(found[0])).hexdigest()==m['sha256']
os.replace(temporary,out)
receipt={'path':str(out),'bytes':out.stat().st_size,'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'entries':len(z.namelist()),'browser_verified':False}
(audit/'package.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt))
