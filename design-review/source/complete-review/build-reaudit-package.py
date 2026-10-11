from pathlib import Path
import ast,hashlib,json,zipfile
from PIL import Image
cwd=Path.cwd();source=cwd/'complete-review';audit=source/'reaudit-20261006';out=cwd/'HOPSCOTCH-Review-System-Fixes.zip'
v=json.loads((audit/'verification.json').read_text());assert len(v['suites'])==11 and v['native_cases']==304
# Read inventories only; never execute the historical retained-evidence builder.
tree=ast.parse((source/'build-refinement-package.py').read_text());inventory={}
for n in tree.body:
 if isinstance(n,ast.Assign) and isinstance(n.value,ast.List):
  for t in n.targets:
   if isinstance(t,ast.Name) and t.id in ['files','root_files']:inventory[t.id]=ast.literal_eval(n.value)
files=[n for n in inventory['files'] if n not in ['run-layout-continuation-audits.py','verify-layout-continuation.py','retain-layout-visual-evidence.py','update-layout-continuation-docs.py','build-refinement-package.py','make-refinement-details.py']]
files+=['run-reaudit.py','check-reaudit-cleanup.mjs','verify-reaudit.py','update-reaudit-docs.py','build-reaudit-package.py','make-reaudit-details.py']
assert len(files)==len(set(files))
readme=f'''# HOPSCOTCH fresh presentation re-audit — 6 October 2026

Current documents: Design Specification 0.40, Review Plan 0.36, Workspace Coverage 0.11, Implementation Handoff 0.11, Author Audit 3.6, Final Manual Review 1.6.

Owner-private review Site: https://hopscotch-design-review.noodle1.chatgpt.site (lifecycle.html, builder.html, evidence.html, connected.html). Exact private review source commit: {v['private_site']['source_commit']}. This Site is separate from HOPSCOTCH production. Repository main was reverified at be21750003cf3c097c917ae4340c78a0035ccbc6; no HOPSCOTCH repository or production edit occurred.

## Changes

Two source defects were corrected: Connected now releases its scene observer and named font/material listeners, guards pending painting after disposal/disconnection, and disposes idempotently; collapsed packet protocol dots now use the same inherited accent background as expanded headings. The approved typography, palette, optics, measured layout, scanner, no-bounce airtight docking, cadence, domain bundles, source data and protocol-time boundary are preserved. The original ten suite files/budgets are unchanged; 32 new cleanup contracts supplement them.

## Evidence

All eleven synthetic suites passed on one frozen emitted manifest. The package contains current source, reference models, unchanged domain bundles and accepted foundations, suite logs, source comparison/diffs, current documents, 152 freshly exported runtime selections, 304 freshly rendered native analytical PNGs, 32 directly inspected paired theme sheets and 11 larger details. No old pixels were substituted in this pass. Source and inspection hashes bind the supplied verification record to the private review Site source. Historical image collections are not duplicated; earlier saved package versions retain them.

The native analytical constructor uses source shaders plus approximated layout/substitute fonts. These are not browser screenshots. Generic construction omits some inputs, protocol dots and arrow graphics and approximates captured-byte caption spacing. The dot fix is source-declaration-verified only. Dense overview crops establish broad hierarchy, not every deep pixel. Long TLS wrapping and byte caption spacing remain browser watch items. Static poses do not certify intermediate animation. Actual CSS/platform-font/compositor playback, Safari/phone, native accessibility, hardware performance and night comfort remain unverified; passing counts do not certify design quality. The managed Sites preview instructions require control-browser and forbid substitute paths when it is unavailable. Prior automatic approval review rejected alternate browser execution/routes. No workaround was used.

## Reproduction

Extract to a source workspace. Restore the three foundation-reference HTML files to /workspace under their original names (hashes in foundation-reference/inventory.json). Run python3 complete-review/assemble.py to emit four isolated /workspace study fragments; this is not a production build.

Run python3 complete-review/run-reaudit.py, then python3 complete-review/audit-final-source.py. The full runner waits for genuine process completion; do not use an early printed PASS as suite completion. Node and Python are required; domain fixtures are supplied. These are synthetic runtime contracts, not browser QA.

For fresh analytical imagery, set HOPSCOTCH_AUDIT_DIR=complete-review/reaudit-20261006 and HOPSCOTCH_FORCE_RENDER=1. Run collect-second-audit.mjs and collect-second-causal.mjs with Node; inspect-second-audit.py, inspect-second-causal.py, make-second-audit-sheets.py and make-reaudit-details.py with Python. Native EGL/GL, Pillow, NumPy, PyMuPDF and DejaVu fonts are required. Inspect regenerated sheets/details before renewing the visual-inspection hashes; do not inherit supplied inspection claims for new pixels.

verify-reaudit.py additionally expects the original clean private Site checkout at /workspace/sites/hopscotch-review and recorded hosting commit; the archive excludes that Git checkout/hosting wrapper. Its supplied verification record remains inspectable without those project resources. Actual-browser and owner approval remain open before production migration.
'''
ledgers=['contracts.json','layout-contracts.json','cleanup-contracts.json','functional-verification.json','compositions.json','causal-compositions.json','native-audit.json','causal-native-audit.json','sheet-index.json','causal-sheet-index.json','detail-index.json','visual-inspection.json','source-review.json','verification.json','hosting.json','repository-baseline.json','documentation.json']
images=[]
for name in ['native-audit.json','causal-native-audit.json']:images.extend(Path(c['path']) for c in json.loads((audit/name).read_text())['cases'])
for name in ['sheet-index.json','causal-sheet-index.json','detail-index.json']:images.extend(Path(c['path']) for c in json.loads((audit/name).read_text()))
assert len(images)==347 and len(set(images))==347
foundations=[]
for name in ['hopscotch-resilient-glass','hopscotch-tcp-resilient-glass','hopscotch-router-focused']:
 p=Path('/workspace',name+'.html');foundations.append({'path':str(p),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
 z.writestr('README.md',readme);z.writestr('foundation-reference/inventory.json',json.dumps(foundations,indent=2))
 for name in files:
  p=source/name;assert p.is_file(),p;z.write(p,'complete-review/'+name)
 for name in inventory['root_files']:
  p=cwd/name;assert p.is_file(),p;z.write(p,name)
 for p in sorted((cwd/'app-doc-current').glob('*.md')):z.write(p,'docs/'+p.name)
 for name in ledgers:
  p=audit/name;assert p.is_file(),p;z.write(p,str(p.relative_to(cwd)))
 for name in ['cleanup-before.log','connected.js.patch','review.css.patch','native-render.log','causal-render.log']:
  p=audit/name;assert p.is_file(),p;z.write(p,str(p.relative_to(cwd)))
 for p in sorted((audit/'before').glob('*')):z.write(p,str(p.relative_to(cwd)))
 for suite in v['suites']:
  p=Path(suite['log']);assert hashlib.sha256(p.read_bytes()).hexdigest()==suite['log_sha256'];z.write(p,str(p))
 for p in images:
  with Image.open(p) as im:im.verify()
  z.write(p,str(p))
 for f in foundations:
  p=Path(f['path']);z.write(p,'foundation-reference/'+p.name)
with zipfile.ZipFile(out) as z:assert len(z.namelist())==len(set(z.namelist())) and z.testzip() is None
r={'path':str(out),'bytes':out.stat().st_size,'entries':len(z.namelist()),'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'fresh_native_images':304,'inspected_paired_sheets':32,'inspected_details':11,'browser_verified':False,'site_git_checkout_included':False,'hopscotch_production_changed':False}
(audit/'package.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r))
