from pathlib import Path
import json,re,zipfile

cwd=Path.cwd()
source=cwd/'complete-review'
out=cwd/'HOPSCOTCH-Review-System-Fixes.zip'
readme='''# HOPSCOTCH review-system corrections — 4 October 2026

This archive preserves the isolated review source and evidence through adaptive-code audit v3.3. The current pass replaces fixed byte-capacity guesses with native measured sizing/paging and observed reflow, duplicated inner-width pane guesses with a CSS-owned mode contract, and repeated resting paint radii with owner-derived circular shape. Earlier shared-header/network/status/disclosure corrections remain. Production was not changed. The pinned domain baseline is JohnnyZLi/HOPSCOTCH main at be21750003cf3c097c917ae4340c78a0035ccbc6.

## Contents and reproduction boundary

`complete-review` contains source templates/controllers, assembled JavaScript, domain bundles, source fixtures, checks and current evidence ledgers. `docs` contains the updated design contracts and manual review guide. `foundation-source` preserves extracted accepted CSS/JavaScript as reusable source references. It does not contain the inline review fragments themselves.

The original assembler expects `/workspace/hopscotch-resilient-glass.html` and the original check environment expects both that accepted foundation and `/workspace/hopscotch-tcp-resilient-glass.html`. Retrieve those accepted references before running the assembler/checks. Their exact hashes are recorded in final-source-audit.json. This archive does not claim to be a self-contained replacement for those conversation previews. The native constructors and harness are included, with their source models/kernel and extracted focused-router CSS/JavaScript reference. Their legacy path extraction still expects `/workspace/hopscotch-router-focused.html` as well as the accepted TCP reference. Restore the original referenced previews or adapt their source-loading to the extracted references before regenerating analytical pictures. Native EGL, Pillow, NumPy, PyMuPDF and DejaVu fonts are required. The included inspected results are not browser captures.

Run `python complete-review/assemble.py` from the source root once accepted foundations are present. This creates the four current preview fragments under `/workspace`. Execute `node complete-review/check-shared-builder.mjs`, `node complete-review/check-complete.mjs`, `node complete-review/check-connected.mjs`, `node complete-review/check-dense.mjs`, `node complete-review/check-followup.mjs`, `node complete-review/check-audit-lifecycle.mjs`, `node complete-review/check-audit-adaptation.mjs` and `python complete-review/audit-final-source.py` only in the permitted synthetic/source environment. Tests import the source harness; no browser server is required or authorized.

`complete-review/second-audit` preserves fresh case/source ledgers, regression logs, all 264 verified case PNGs, 26 paired overview sheets and inspected detail crops. Case/index lists are authoritative: unrelated stale or failed image files are excluded. Overview sheets crop tall pages and substitute font geometry; they do not certify every deep pixel or intermediate motion. Analytical renderer defects in whitespace/grid/vector-role resolution and PNG publication were corrected independently of product source. The original broad tests ran on the final JavaScript digests; the later shared line-height CSS addition does not change those scripts, and was checked by source audit and the fresh paired constructor pass.

The current adaptive source inventory, focused contracts and frozen regression logs are in `complete-review/adaptive-audit`. Run `node complete-review/check-adaptive-presentation.mjs` in addition to the existing seven suites. The latest `adaptive-audit/final` exports/native ledgers and 284 images/paired sheets cover all four families, scene/inspector modes and 760/761/800 px boundary cases. Byte-cell and exclusive-pane analytical renderer defects were corrected separately from product source. Reproduce them using the collector/constructor/sheet scripts with `HOPSCOTCH_AUDIT_DIR=complete-review/adaptive-audit/final` and `HOPSCOTCH_FORCE_RENDER=1` for an uncached native DOM redraw. The included generator can rebuild this archive once the referenced previews/dependencies are restored.

The current manifest identifies the exact four generated studies. Synthetic DOM/font/WebGL/CSS geometry contracts and native analytical resting compositions are bounded evidence. Automatic review rejected local browser execution; alternate browser routes were not used. Actual browser/platform-font layout, intermediate pixels, native keyboard/accessibility, phone/Safari and hardware performance remain manual acceptance items. Neither assertion counts nor native images certify design quality.

## Migration

See docs/HOPSCOTCH-Implementation-Handoff.md. Port shared components and controllers after named baseline/scope approval. Preserve domain events, protocol state, bytes and playback. Do not commit model state or advance canonical time from optical/layout callbacks.
'''
files=[
 'assemble.py','review.css','shared-ui.js','shared-network.js','shared-reservation.js','shared-painter.js','shared-bytes.js','build-review-fix-package.py',
 'motion.html','motion.js','workbench.html','workbench.js','evidence.html','evidence.js','connected.html','connected.js','connected.css',
 'motion-compiled.js','workbench-compiled.js','evidence-compiled.js','connected-compiled.js',
 'domain.bundle.js','evidence-domain.bundle.js','entry-domain.bundle.js','source-data.json','d3-array.min.js','d3-geo.min.js','world-110m.topojson',
 'check-shared-builder.mjs','check-complete.mjs','check-connected.mjs','check-dense.mjs','check-followup.mjs','audit-final-source.py',
 'export-builder-fixes.mjs','inspect-builder-fixes.py',
 'check-audit-lifecycle.mjs','check-audit-adaptation.mjs','check-adaptive-presentation.mjs','collect-second-audit.mjs','collect-second-causal.mjs',
 'inspect-second-audit.py','inspect-second-causal.py','make-second-audit-sheets.py','make-adaptive-detail-crops.py','verify-adaptive-audit.py',
 'inspect-final-compositions.py','inspect-design-matrix.py','inspect-complete.py',
 'composition-models.json','design-composition-models.json','design-headings.json','final-composition-models.json',
 'source-manifest.json','shared-builder-audit.json','contract-audit.json','connected-functional-audit.json','dense-functional-audit.json','followup-audit.json',
 'final-source-audit.json','shared-network-stress-audit.json','router-stress-graph.json','builder-fix-compositions.json','builder-fix-native-audit.json',
]
with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
 z.writestr('README.md',readme)
 for name in files:
  p=source/name;assert p.is_file(),p;z.write(p,'complete-review/'+name)
 z.write(cwd/'workspace-reference-models.json','workspace-reference-models.json')
 for p in (cwd/'app-doc-current').glob('*.md'):z.write(p,'docs/'+p.name)
 for p in (source/'builder-fix-native').glob('*.png'):z.write(p,'evidence/'+p.name)
 for name in ['inspect-focused-router.py','audit-resilient-material.py','shared-glass-edge.glsl','mobile-audit-material-frames.json']:
  z.write(cwd/name,name)
 for name in ['lifecycle.json','adaptation.json','compositions.json','causal-compositions.json','native-audit.json','causal-native-audit.json','sheet-index.json','causal-sheet-index.json','visual-inspection.json']:
  z.write(source/'second-audit'/name,'complete-review/second-audit/'+name)
 from PIL import Image
 evidence=[]
 for name in ['native-audit.json','causal-native-audit.json']:
  evidence.extend(Path(case['path']) for case in json.loads((source/'second-audit'/name).read_text())['cases'])
 for name in ['sheet-index.json','causal-sheet-index.json']:
  evidence.extend(Path(sheet['path']) for sheet in json.loads((source/'second-audit'/name).read_text()))
 evidence.extend((source/'second-audit/details').glob('*.png'))
 assert len(evidence)==len(set(evidence))
 for p in evidence:
  with Image.open(p) as im:im.verify()
  with Image.open(p) as im:im.load()
  z.write(p,str(p.resolve().relative_to(cwd)))
 for name in ['complete-final.log','connected-final.log','dense-final.log','shared-final.log','followup-final.log','lifecycle-final.log','adaptation-final.log']:
  z.write(source/'second-audit'/name,'complete-review/second-audit/'+name)
 for name in ['contracts.json','source-inventory.json','verification.json','adaptive-final.log','complete-frozen.log','connected-frozen.log','dense-frozen.log','shared-frozen.log','followup-frozen.log','lifecycle-frozen.log','adaptation-frozen.log']:
  p=source/'adaptive-audit'/name;assert p.is_file(),p;z.write(p,str(p.relative_to(cwd)))
 current=source/'adaptive-audit/final'
 for name in ['compositions.json','causal-compositions.json','native-audit.json','causal-native-audit.json','sheet-index.json','causal-sheet-index.json','visual-inspection.json','detail-index.json']:
  p=current/name;assert p.is_file(),p;z.write(p,str(p.relative_to(cwd)))
 current_images=[]
 for name in ['native-audit.json','causal-native-audit.json']:current_images.extend(Path(c['path']) for c in json.loads((current/name).read_text())['cases'])
 for name in ['sheet-index.json','causal-sheet-index.json']:current_images.extend(Path(c['path']) for c in json.loads((current/name).read_text()))
 current_images.extend(Path(c['path']) for c in json.loads((current/'detail-index.json').read_text()))
 assert len(current_images)==len(set(current_images))
 for p in current_images:
  with Image.open(p) as im:im.verify()
  with Image.open(p) as im:im.load()
  z.write(p,str(p.resolve().relative_to(cwd)))
 for name in ['hopscotch-resilient-glass','hopscotch-tcp-resilient-glass','hopscotch-router-focused']:
  text=Path('/workspace',name+'.html').read_text()
  for tag,ext in [('style','css'),('script','js')]:
   parts=re.findall('<'+tag+'>(.*?)</'+tag+'>',text,re.S)
   z.writestr('foundation-source/'+name+'.'+ext,'\n'.join(parts))
with zipfile.ZipFile(out) as z:
 assert z.testzip() is None
 print(out.name,out.stat().st_size,'bytes;',len(z.namelist()),'entries')
