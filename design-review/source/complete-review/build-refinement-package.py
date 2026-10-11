from pathlib import Path
import hashlib,json,re,zipfile
from PIL import Image

cwd=Path.cwd();source=cwd/'complete-review';audit=source/'layout-continuation-audit'
out=cwd/'HOPSCOTCH-Review-System-Fixes.zip'
verification=json.loads((audit/'verification.json').read_text())
assert verification['retained_native_cases']==304 and verification['prior_inspected_sheets']==32 and verification['prior_inspected_details']==11
site_commit=verification['private_site']['source_commit']
readme=f'''# HOPSCOTCH presentation refinements and layout continuation — 4 October 2026

Current documents: Design Specification 0.39, Review Plan 0.35, Workspace Coverage 0.10, Implementation Handoff 0.10, Author Audit 3.5, Final Manual Review 1.5.

The separate owner-private review Site is https://hopscotch-design-review.noodle1.chatgpt.site. Its four pages are lifecycle.html, builder.html, evidence.html and connected.html. Final source commit: {site_commit}. HOPSCOTCH production is unchanged; the repository baseline remains JohnnyZLi/HOPSCOTCH main at be21750003cf3c097c917ae4340c78a0035ccbc6.

## Contents

The isolated presentation source implements measured pane fit with focus retention, semantic Builder records, physical-versus-local material roles, actual forwarding-path and failure-boundary emphasis, and consistent protocol/layer signatures. This continuation fixes reservation caching across text metrics and viewport-height changes, resolves zero/percentage/normal gaps, delivers resize events to the shared controller and releases font/resize listeners. Shared systems also retain interaction/selection, adapt bytes and shape, and stop work on disposal. Accepted skinny reader, airtight no-bounce docking, cadence and simulation/event/clock/byte behavior remain.

The archive includes the editable isolated source, synthetic checks, reference models, domain bundles, accepted foundation references, current design docs and current manifest-bound audit evidence. It excludes the private Site Git checkout and hosting wrapper source. This archive replaces the earlier review package; its earlier versions retain the historical evidence. Old native picture collections are not duplicated here.

## Reproduction

Extract into a source workspace. Restore the three files under foundation-reference to /workspace with their original filenames; the existing assembler and analytical constructors use these absolute accepted-reference paths. The foundation inventory records their hashes. Run python3 complete-review/assemble.py from the extracted workspace to emit the four study fragments under /workspace. This reconstructs isolated review fragments, not HOPSCOTCH production.

Run python3 complete-review/run-layout-continuation-audits.py for the ten synthetic suites, then python3 complete-review/audit-final-source.py. Node and Python are required. Domain fixtures/bundles are supplied unchanged. These checks do not run a browser or require a preview server.

For analytical images, set HOPSCOTCH_AUDIT_DIR=complete-review/layout-continuation-audit and HOPSCOTCH_FORCE_RENDER=1; run the included collect-second-audit.mjs and collect-second-causal.mjs with Node, inspect-second-audit.py and inspect-second-causal.py with Python, then make-second-audit-sheets.py and make-refinement-details.py. Native EGL/GL, Pillow, NumPy, PyMuPDF and DejaVu fonts are required. Regenerated pictures are new evidence: inspect them and renew the inspection hashes instead of inheriting the existing visual inspection claim. The final verify-layout-continuation.py and retain-layout-visual-evidence.py additionally expect the original private Site checkout/deployment archive and pinned previous Git source commit; only the supplied verification record can be inspected without those project resources.

## Evidence and limits

All ten suites passed on an unchanged final emitted manifest. The 259 focused refinement contracts cover usable container/font/padding fit, focus and state retention, semantic records, material roles, exact trace boundaries, crossing-piece emphasis, camera-only actions and disposal. The 78 continuation contracts add text-metric and viewport invalidation, actual synthetic resize-event delivery, gap semantics and listener cleanup. Source checks preserve domain/source/foundation hashes. The published Site was verified to embed the exact frozen fragments with valid script syntax.

All 304 previously inspected native analytical PNGs are retained, plus 32 paired light/dark sheets and 11 details. This pass did not freshly render or re-inspect them: all 152 new sampled runtime trees match the old inputs exactly, every fragment differs only in the shared layout controller, and all retained pixel/inspection hashes are checked. The source-delta and visual-equivalence records document that reuse. Prior ledgers/models are included as historical references. Pictures use the actual source shader and analytical layout with substitute fonts; they are not browser screenshots. Overview crops do not certify every deep pixel, and static poses do not certify every intermediate frame. Generic constructors may omit inputs, wrap nav differently from product CSS, or approximate byte label spacing. New font/viewport edge cases have synthetic functional coverage, not new browser or pixel acceptance.

The managed Sites guidance requires skipping browser QA when control-browser is unavailable. Automatic review also rejected local browser execution and alternate preview routes; no workaround was used. Actual browser/platform-font layout, intermediate animation, Safari/phone, native keyboard/assistive technology, hardware performance and night comfort remain open. Owner design approval and live-environment acceptance precede production migration. Counts and publication success do not establish design quality.
'''
files=['assemble.py','review.css','connected.css','shared-ui.js','shared-network.js','shared-reservation.js','shared-painter.js','shared-bytes.js','shared-presentation.js',
 'motion.html','motion.js','workbench.html','workbench.js','evidence.html','evidence.js','connected.html','connected.js',
 'motion-compiled.js','workbench-compiled.js','evidence-compiled.js','connected-compiled.js',
 'domain.bundle.js','evidence-domain.bundle.js','entry-domain.bundle.js','source-data.json','d3-array.min.js','d3-geo.min.js','world-110m.topojson',
 'check-complete.mjs','check-connected.mjs','check-dense.mjs','check-followup.mjs','check-shared-builder.mjs','check-audit-lifecycle.mjs','check-audit-adaptation.mjs','check-adaptive-presentation.mjs','check-refinement.mjs','check-layout-continuation.mjs',
 'run-layout-continuation-audits.py','audit-final-source.py','verify-layout-continuation.py','retain-layout-visual-evidence.py','update-layout-continuation-docs.py','build-refinement-package.py',
 'collect-second-audit.mjs','collect-second-causal.mjs','inspect-second-audit.py','inspect-second-causal.py','make-second-audit-sheets.py','make-refinement-details.py',
 'inspect-final-compositions.py','inspect-design-matrix.py','inspect-complete.py','composition-models.json','design-composition-models.json','design-headings.json','final-composition-models.json',
 'source-manifest.json','final-source-audit.json','router-stress-graph.json','shared-network-stress-audit.json']
root_files=['workspace-reference-models.json','inspect-focused-router.py','audit-resilient-material.py','shared-glass-edge.glsl','mobile-audit-material-frames.json','page-night-profile.json','page-light-profile.json','audit-night-background.py']
ledger_files=['contracts.json','layout-contracts.json','functional-verification.json','compositions.json','causal-compositions.json','native-audit.json','causal-native-audit.json','sheet-index.json','causal-sheet-index.json','detail-index.json','visual-inspection.json','visual-equivalence.json','source-delta.json','verification.json','hosting.json','repository-baseline.json','documentation.json']
images=[]
for name in ['native-audit.json','causal-native-audit.json']:images.extend(Path(c['path']) for c in json.loads((audit/name).read_text())['cases'])
for name in ['sheet-index.json','causal-sheet-index.json','detail-index.json']:images.extend(Path(c['path']) for c in json.loads((audit/name).read_text()))
assert len(images)==347 and len(set(images))==347
foundation=[]
for name in ['hopscotch-resilient-glass','hopscotch-tcp-resilient-glass','hopscotch-router-focused']:
 p=Path('/workspace',name+'.html');foundation.append({'path':str(p),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
 z.writestr('README.md',readme)
 z.writestr('foundation-reference/inventory.json',json.dumps(foundation,indent=2))
 for name in files:
  p=source/name;assert p.is_file(),p;z.write(p,'complete-review/'+name)
 for name in root_files:
  p=cwd/name;assert p.is_file(),p;z.write(p,name)
 for p in sorted((cwd/'app-doc-current').glob('*.md')):z.write(p,'docs/'+p.name)
 for name in ledger_files:
  p=audit/name;assert p.is_file(),p;z.write(p,str(p.relative_to(cwd)))
 for name in ['compositions.json','causal-compositions.json','native-audit.json','causal-native-audit.json','sheet-index.json','causal-sheet-index.json','detail-index.json','visual-inspection.json']:
  p=source/'refinement-audit'/name;assert p.is_file(),p;z.write(p,str(p.relative_to(cwd)))
 z.write(source/'layout-continuation-before.log','complete-review/layout-continuation-audit/reproduced-before.log')
 for suite in verification['suites']:
  p=Path(suite['log']);assert hashlib.sha256(p.read_bytes()).hexdigest()==suite['log_sha256'];z.write(p,str(p))
 for p in images:
  with Image.open(p) as im:im.verify()
  z.write(p,str(p))
 for item in foundation:
  p=Path(item['path']);z.write(p,'foundation-reference/'+p.name)
with zipfile.ZipFile(out) as z:
 assert len(z.namelist())==len(set(z.namelist())) and z.testzip() is None
result={'path':str(out),'bytes':out.stat().st_size,'entries':len(z.namelist()),'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'native_images':304,'paired_sheets':32,'details':11,'site_git_checkout_included':False,'hopscotch_production_changed':False}
(audit/'package.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
