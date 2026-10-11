from pathlib import Path
import json,re,hashlib

docs=Path('app-doc-current');p=Path('complete-review')
manifest=json.loads((p/'source-manifest.json').read_text())
source_table='| Review study | Bytes | SHA-256 |\n| --- | ---: | --- |\n'+'\n'.join('| `'+Path(x['path']).name+'` | '+format(x['bytes'],',')+' | `'+x['sha256']+'` |' for x in manifest)
matrix='''| Supplied family | Source selections per width | Light mobile | Dark mobile | Light desktop | Dark desktop |
| --- | ---: | --- | --- | --- | --- |
| Lifecycle and packet scenes | 145 | Analytical sample set | Analytical sample set | Analytical sample set | Analytical sample set |
| Builder pages and nested systems | 58 | Analytical sample set | Analytical sample set | Analytical sample set | Analytical sample set |
| Five evidence workspaces × five states | 25 | Analytical sample set | Analytical sample set | Analytical sample set | Analytical sample set |'''
policy='''## Visual/design audit requirement — 4 October correction

The owner's request to **audit everything** includes visual and design judgment for every supplied surface and subcomponent, independently of functional correctness. A passing runtime, valid protocol sequence, or large assertion count does not establish hierarchy, legibility, material quality, spatial clarity, motion quality, or responsive composition.

Review Light and Dark separately at desktop and mobile sizes. Inspect entry, active operation, paused intermediate, completion, selection, expanded detail, loading, empty, partial, error, and recovery states where the source supports them. Include nested controls, highlights, magnifiers, transfers, attached layers, tables, bytes, graph labels and connectors. State absent coverage explicitly. Still frames cannot approve temporal choreography.

Evidence must be identified as actual browser capture, actual emitted shader with analytical composition, source inspection, or synthetic runtime behavior. Do not substitute an invented header, missing toolbar, simplified sidebar, flattened disclosure tree or analytic backdrop for the actual product and then claim full visual verification. Material and layout results have different scopes. Generated-image and assertion counts record sampling, not aesthetic quality.

The current review package is revised, but full rendered visual signoff remains open. The accepted foundations retain their scoped approvals. Production migration remains unapproved.
'''
roles='''## Revised shared visual roles — current review proposals

The same material language serves different purposes. A packet remains the dominant optical object. Reading records use a quieter frosted backing and a shallower rim. Dense inspectors may use stronger backing for legibility without increasing decorative edge strength. Controls use translucent role fills, a small crest and a subtle rim; they do not reuse the packet's colored interior. Primary actions use one explicit theme-aware emphasis role. A table fact is a reading-row action, so it does not receive nested button glass or a second selected fill.

Attach the page palette to the actual shell and working-area backdrop. Broad teal, cobalt and violet fields sit behind the scene with a bounded span and a fade into the page base. Dark uses its own low-luminance palette; its depth shadows remain dark. Specular crests and text foregrounds are separate from depth shadows. The packet's accepted optical equations are unchanged.

All fields and controls retain the same system sans-serif stack. Tabular figures are a feature of that font, not an alternate font. Supporting labels keep the theme's secondary text role. Long table notes take the full row rather than being squeezed into a value column. Engineering-unit formatting is derived from the source unit and magnitude; the source detail retains the exact value. A short displayed number is not permission to alter evidence.

Role assignments are reusable and responsive to actual content and available space. Tune role policies and geometric constraints centrally. Do not add per-protocol or per-string exceptions to repair the same design defect repeatedly. Keep the measured skinny scanner, geometry-derived attachment resistance, source-semantic transfer binding, deliberate holds and continuous rounded highlights.

Reduced transparency supplies readable solid roles. Reduced motion removes nonessential transitions. Forced colors supplies system text, surface and selection roles with theme specificity accounted for. Those declarations are source-reviewed; actual assistive/browser behavior remains an environmental gate.
'''
scope='''## Current design evidence and open coverage

The new source-state matrix samples 228 selections at each of 390 and 1,024 px, in both Light and Dark: 912 distinct native compositions. It includes every canonical event supplied to the lifecycle study, its packet operation/family selections, Builder system/detail references and all five evidence states. The files decode and have distinct identities; none reach the analytical compositor's 5,000 px height limit. Representative comparisons for 29 scene/page/system identities were visually inspected in all four size/theme combinations, along with selected full-size and state images. The entire 912-image set was not individually read at full size.

These are bounded analytical compositions using actual emitted optical GLSL, source state, theme roles and substitute DejaVu fonts. They are **not browser screenshots or a complete CSS layout engine**. Native Builder diagrams/disclosures omit or simplify parts of the actual toolbar, inspector, forms and opened trees. Motion stills represent selected source states, not a frame-by-frame capture of commit timing. The broad native control/divider alpha handling also differs from browser compositing. Do not approve actual border contrast or motion from that approximation.

The earlier audit overstated visual completion. Its renderer supplied a backdrop missing from the actual shell, used event headings in place of stable scene headings, represented Builder chrome inaccurately, and did not evenly cover mobile/desktop Dark or nested/state variations. Sampling and heading/background representation have been corrected; remaining analytical simplifications are now explicit. Audit-image encoding failures were excluded and replacement comparison images were atomically written and decoded. They are evidence-generation defects, not demonstrated product defects.

Still required: full actual browser layouts with all controls and opened details; native system-font/zoom behavior; motion capture through transfer, scan, expand/collapse and attach/detach; dense graph labeling/camera interaction; phone/keyboard/Safari/assistive behavior and hardware performance. Overview/entry, complete cross-workspace handoffs, alternate scenarios and every production editing form are also broader design scope in the inventory. Neither G5 nor G6 is closed.

Automatic approval review rejected the local browser-preview action. It was not retried through another route. The permitted offscreen and source checks do not remove that verification gap. No fresh production checkout/build or current GitHub status is claimed by this revision.
'''

updates=[('HOPSCOTCH-Design-Specification.md','0.32','0.33'),('HOPSCOTCH-Design-Review-Plan.md','0.28','0.29'),('HOPSCOTCH-Workspace-Coverage.md','0.3','0.4'),('HOPSCOTCH-Implementation-Handoff.md','0.3','0.4')]
for name,old,new in updates:
 file=docs/name;s=file.read_text();s=s.replace('**Version:** '+old,'**Version:** '+new,1)
 s=re.sub(r'\*\*Status:\*\*[^\n]+','**Status:** Revised review studies supplied; functional and visual evidence separate; full browser/design signoff open  ',s,count=1)
 # Old counts and manifest descriptions remain revision history, not current authority.
 current='\n**Current evidence authority:** [Author audit v2.0](HOPSCOTCH-Author-Audit.md) supersedes earlier blanket visual-completion claims. Earlier evidence counts and manifests below describe their historical revisions.\n'
 idx=s.find('\n\n',s.find('**Version:**'));s=s[:idx]+current+s[idx:]
 if name.endswith('Specification.md'):
  s=s.replace('**Revision scope:** v0.32 records the follow-up visual/source audit and repairs.','**Revision scope:** v0.33 separates visual/design and functional gates, corrects the missing shell backdrop and shared surface/action/shadow roles, and records bounded evidence. v0.32 records the preceding follow-up visual/source repairs.',1)
  appendix=policy+roles+scope
 elif name.endswith('Review-Plan.md'):
  appendix=policy+'''## Audit acceptance ledger

| Gate | Available evidence | Status |
| --- | --- | --- |
| Simulation/event behavior | Actual emitted scripts and bundled source domain functions in a synthetic contract environment | Focused runtime verification passed; production build not rerun |
| Design-source consistency | Actual emitted markup/styles, roles, material binding, effective shadows, typography and fallbacks | Concrete defects repaired; source consistency checked |
| Optical and family comparison | Actual GLSL with bounded analytical composition at mobile/desktop in both themes | Representative comparison reviewed; actual CSS/font/motion signoff open |
| Full visual/design quality | Every actual rendered state and subcomponent, including opened nested content and temporal motion | Open; runtime totals cannot close this gate |

'''+matrix+'\n\n'+scope
 elif name.endswith('Workspace-Coverage.md'):
  s=s.replace('The checkout remains unchanged. GitHub `main` was checked on 4 October and still matches the pinned baseline.','The pinned source is the implementation authority. Earlier repository checks are historical; this revision does not claim an available fresh checkout or a new GitHub check.',1)
  appendix=policy+matrix+'\n\n'+scope
 else:
  appendix=policy+roles+'''## Migration acceptance change

Treat functional preservation and design quality as separate acceptance records for each migration slice. A source-level surface repair can proceed in an isolated study without approving the whole workspace. Before calling a slice visually complete, compare actual Light/Dark desktop/mobile layouts, realistic dense/opened content and intermediate motion against the agreed design; record defect, correction, reinspection and remaining limitations. Use current source identity and canonical data in the review.

The review-source fixes in this revision are proposals, not a production renderer implementation. Keep the domain modules, reducers, canonical playback and event order intact. React/resource lifecycle integration, entry/handoff composition, real-device accessibility and actual browser material recovery remain required before migration closure. Owner acceptance of a foundation remains scoped to that foundation.

'''+scope
 s+='\n\n---\n\n'+appendix+'\n'+source_table+'\n';file.write_text(s)

audit='''# HOPSCOTCH — Author Audit

**Version:** 2.0 · **Date:** 2026-10-04 UTC  
**Status:** Revised isolated studies supplied; full rendered design verification remains open

The earlier audit did not provide the complete visual/design audit requested. It relied too heavily on functional results and overstated what offscreen compositions established. This revision separates concrete product-source findings, qualitative review, functional evidence and remaining visual gaps.

## Concrete design findings and repairs

| Finding in the supplied study source | Repair | Design consequence |
| --- | --- | --- |
| The shell did not attach its shared page backdrop; the audit compositor supplied it independently | Bind the page base to the actual shell and the computed ambient fields to the actual working area | The markup now owns the atmosphere shown in review; mobile and desktop share the same composition policy |
| Color was concentrated below the working scene, while many supporting surfaces converged on blue-gray | Put bounded teal/cobalt/violet fields behind the scene; distinguish endpoint, record and dense-inspector backing/depth roles | Dark has a vivid low-luminance environment; records remain readable and the packet stays dominant |
| Primary actions competed with ordinary controls | Add one explicit theme-aware primary-action role; native submissions share it | Play, Run/Apply and Load actions have a dependable emphasis policy |
| Actor/lens/transfer/envelope depth shadows used text foreground colors | Use independent Light/Dark depth-shadow roles, preserving separate optical crests | Pale Dark text no longer creates a pale drop shadow |
| Long CLI route notes were squeezed beside values | Place the note in a full-width subordinate row, with soft dividers | More room for routes and evidence without inventing a second font or dropping transcript data |
| Measurement units were unnecessarily mechanical in the reading table | Format link rates from actual numeric magnitude/source unit and bytes as B; exact inspector values remain available | Dense evidence becomes easier to scan without changing its source meaning |
| A clickable table fact inherited separate glass-button styling and selection fill | Remove its independent shadow/blur/fill; retain row selection and text emphasis | A selected record reads as one row rather than a button nested inside another highlight |
| Captured-field highlighting risked shifting the text layout | Use an inset rounded emphasis layer with smooth opacity | Selection does not change field padding or produce a sudden rectangular flash |
| Dark-token specificity could override accessibility role declarations | Match root/theme specificity for reduced transparency and forced colors | Shared fallback policies can take precedence across themes; actual environment behavior still needs verification |

These are shared policies and bindings in the review studies. The accepted packet optical equations, system-font family, skinny measured scanner, geometry-derived resistant attachment and source-dependent pacing remain intact. No simulation, reducer, protocol module or production playback implementation was changed.

## Qualitative design judgment

The accepted packet material still provides the strongest visual identity. The revised ambient placement connects it to its environment, and quieter support surfaces make that hierarchy more coherent. Dark should retain chroma in the environment and restrained rim lighting rather than brighten every panel or reuse pale text as a shadow color. Primary actions need a stronger role than selected navigation; clickable data should remain visually part of the reading surface.

Dense information is the main unresolved design stress. CLI notes now have useful width, but complete opened Builder trees, actual control groups, long provenance values and mobile evidence tables need actual rendered review. The analytical samples cannot establish their final wrapping, scroll burden or accessible interaction. Very long technical content must not force a smaller font or a one-off string-length recipe.

Rounded boundaries and highlights are source-reviewed. Still images cannot establish whether a transfer corner, canvas seam or emphasis layer appears for a single animation frame. Temporal smoothness, perceived pacing and the viewer's understanding of cause and effect remain motion-review questions even when the plan calculations pass.

## Available design evidence

'''+matrix+'\n\n'+scope+'''
## Functional/source verification — separate evidence

The emitted JavaScript passed 2,030 focused assertions across 320, 390, 736, 1,024 and 1,440 px, plus 27,284 complete TCP-phase checks with reduced-motion coverage. These execute the actual emitted scripts/domain functions in a synthetic DOM/font/WebGL environment, not a live browser. The final two repairs after that run change only CSS: the envelope shadow role and table-fact button styling. Emitted JavaScript is unchanged. Final script syntax, source digests, size/root/token consistency and effective shared styling were separately checked. None of these results establishes aesthetic quality or hardware performance.

Prior functional repairs remain: stable endpoint orientation, correct ACK ownership/source arithmetic, source-identity reconciliation, exact-first cross-plane search and delayed reveal, camera-center zoom, canonical CLI preservation, fact/field/byte reconciliation, valid zero-frame capture scope, file-read cancellation/error reasons and retained AS relationship selection. Earlier large assertion totals and image totals are historical evidence with their own source manifests, not final rendered signoff.

## Current review sources

'''+source_table+'''

Accepted foundations are byte-for-byte unchanged: resilient glass `cedcfd274898b271c138241df65bc8dda14a4cd46fd1dd61e8c3a11c76958667`; TCP resilient glass `176ab8cde257438033f8e17b571153e0b46a69b90ab04bf98fa4781b67e60938`. Source baseline remains `JohnnyZLi/HOPSCOTCH` at `be21750003cf3c097c917ae4340c78a0035ccbc6`; no new remote verification is claimed.

Companions: [Specification v0.33](HOPSCOTCH-Design-Specification.md), [Review plan v0.29](HOPSCOTCH-Design-Review-Plan.md), [Coverage v0.4](HOPSCOTCH-Workspace-Coverage.md), [Handoff v0.4](HOPSCOTCH-Implementation-Handoff.md).

## Review disposition

The three revised studies are supplied for owner review. Shared source-level visual defects found in this pass are repaired. Complete actual-browser visual and motion signoff is **open**, and broader inventory gaps remain. This report does not close G5/G6 or authorize production migration. Review the actual supplied studies in Light and Dark; use the analytical images as limited comparisons, not substitutes for those studies.
'''
(docs/'HOPSCOTCH-Author-Audit.md').write_text(audit)

requests=[('HOPSCOTCH-Design-Specification.md','libfile_db06f314f3488191a2bbcedebed36b13',34),('HOPSCOTCH-Design-Review-Plan.md','libfile_e8b8443c04348191b0638576bd794973',29),('HOPSCOTCH-Workspace-Coverage.md','libfile_d720ea26090c8191a925aa4de7f14db6',2),('HOPSCOTCH-Implementation-Handoff.md','libfile_853294284678819195f1ab72fd5d77f0',2),('HOPSCOTCH-Author-Audit.md','libfile_788505d44e9081919d3c5eebfb2d77ba',0)]
uploads=[{'local_path':str((docs/name).resolve()),'purpose':'replace_library_file','library_file_id':id,'expected_current_version':version,'version_reason':'Separate design and functional audits; repair shared visual roles and document remaining rendered verification gaps.'} for name,id,version in requests]
(p/'design-doc-upload-request.json').write_text(json.dumps({'uploads':uploads},indent=2))
print(json.dumps([{'name':name,'bytes':(docs/name).stat().st_size} for name,_,_ in requests],indent=2))
