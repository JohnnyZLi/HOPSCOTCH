from pathlib import Path
import json,re,hashlib
base=Path('complete-review/reaudit-20261006')
v=json.loads((base/'verification.json').read_text());site=v['private_site']
versions={'Design-Specification':('0.39','0.40'),'Design-Review-Plan':('0.35','0.36'),'Workspace-Coverage':('0.10','0.11'),'Implementation-Handoff':('0.10','0.11'),'Author-Audit':('3.5','3.6'),'Final-Manual-Review':('1.5','1.6')}
common=f'''The [private four-study review]({site['url']}) contains two focused corrections: Connected releases its scene observer and font/material listeners on disposal, and collapsed protocol dots use the same inherited accent background as expanded packet headings. The approved typography, palette, packet optics, scanner, docking, cadence, domain bundles and source data are preserved. HOPSCOTCH production and repository remain untouched.

Eleven synthetic suites passed on the final frozen manifest, including 32 new disposal checks. This pass newly exported 152 runtime selections, rendered 304 native analytical images, and directly inspected all 32 paired light/dark sheets and 11 larger details. These are fresh analytical views, not browser screenshots or live playback acceptance. [Author audit v3.6](HOPSCOTCH-Author-Audit.md) is the current evidence authority; all previous sections below describe historical revisions where their source hashes or counts differ.

'''
sections={
'Design-Specification':'''Disposable presentation systems must own and release their observers and named font/material listeners. Both enqueue and frame execution must reject work after disposal or disconnection; repeated disposal is harmless. Keep this separate from canonical protocol time and source identity.

Protocol accents are inherited semantic material roles. A dot uses that role for its background, a heading for its marker background; text color alone must not be mistaken for a marker fill. The shared sans font still applies to all fields, addresses, numbers and bytes. Reusability includes dynamic measurement and adaptation, not only shared constants. No new choreography or device-specific exception is introduced.

''',
'Design-Review-Plan':'''This renewed review covered source lifetimes, theme/material roles, shared typography, rounded clips, adaptive panes/bytes/scanner/docking, retained identity, import cancellation, graph ports/crossings/path identity and canonical clock preservation. Fresh paired analytical views cover normal, empty, partial and error evidence states plus causal packet poses. Dense sheets establish broad hierarchy; eleven larger details sample TLS, Builder routing/topology, responsive capture and byte selection.

Actual browser/platform-font, intermediate animation, Safari/phone, native accessibility, hardware performance and night comfort remain open. Long TLS tokens and offset-caption spacing require live-browser review: analytical constructors approximate these layouts. The source marker correction is declaration-verified, because generic analytical constructors omit protocol dots. No owner approval is inferred from passing checks.

''',
'Workspace-Coverage':'''The new focused disposal matrix is Connected × 390/1024 widths × Light/Dark. It checks observer release, font listener release, late font/resize/material signals, no post-disposal painting or transitions, idempotent disposal and immutable source identity/anchor. The original ten suite files are unchanged. Fresh runtime exports comprise 122 workspace selections and 30 causal selections, each rendered in both themes. All 32 paired sheets and 11 larger details were inspected with their hashes recorded.

''',
'Implementation-Handoff':'''Carry the named scene observer and font callback plus guarded enqueue/frame logic with the Connected presenter. Release font/material listeners and disconnect the scene observer before canceling pending paint; reset the pending request ID and make disposal idempotent. Do not change playback time or source objects. Shared inherited protocol accents must drive actual marker background in both collapsed and expanded forms.

The new check-reaudit-cleanup.mjs supplements the unchanged ten suites. run-reaudit.py freezes emitted hashes before/after all eleven runs. verify-reaudit.py binds logs, focused contracts, source preservation, fresh analytical images, inspection hashes and exact private Site source. Synthetic contracts and native analytical images do not replace actual browser acceptance.

''',
'Author-Audit':'''Final packaging detected one lifecycle log that no longer matched its completion digest. The affected 64-contract suite was rerun without source changes; all eleven final logs now match their recorded hashes. The original completion and mismatch are retained in functional-verification.json. No assertion budget was changed.

Source inspection found a retained Connected scene ResizeObserver and unnamed font callback. A before-fix check reproduced one live observer after disposal. Named resources, listener removal, idempotent disposal and guards at paint enqueue/execution correct that lifetime defect. A separate CSS inspection found a protocol dot assigned text color instead of background; its fill now follows the shared accent role. The original ten check files and assertion budgets were preserved. The final eleven-suite run started after both corrections; interrupted earlier logs are not acceptance evidence.

''',
'Final-Manual-Review':'''The four linked studies remain the review surface when you are able to inspect them. This pass does not require immediate owner review. Check that collapsed protocol dots agree with their expanded layer identity, and that revisiting a workspace preserves focus/selection without stale painting. The approved glass, font and motion stay the comparison baseline.

Do not treat this renewed analytical review as live-browser or production approval. In an actual browser, specifically inspect long TLS tokens, captured-byte offset spacing, intermediate docking/scanning/disclosure transitions, and both themes on phone and desktop.

'''}
sections['Author-Audit']+='| Suite | Final completion | Result |\n|---|---|---|\n'+''.join(f"| {s['suite']} | {s['completion']} | Pass |\n" for s in v['suites'])+'\n'
sections['Author-Audit']+='| Study | Bytes | SHA-256 |\n|---|---:|---|\n'+''.join(f"| {n} | {m['bytes']:,} | `{m['sha256']}` |\n" for n,m in zip(['Lifecycle','Builder','Evidence','Connected'],v['manifest']))+'\n'
sections['Author-Audit']+=f'''GitHub main was reverified on 6 October 2026 at `be21750003cf3c097c917ae4340c78a0035ccbc6`. Domain/evidence/entry bundles, source-data.json and accepted glass/TCP references retain their digests. Private Site source commit: `{site['source_commit']}`; deployment `{site['deployment_id']}`; version `{site['version_id']}`; status succeeded. Exact emitted fragments and inline script syntax are verified in that clean Site source.

Fresh visual inspection found consistent theme hierarchy, primary field legibility in sampled poses, distinct packet/local material roles and separate rounded envelope/IP/FCS objects. Native topology samples attach paths at visible node edges. Evidence error states retain prior valid provenance. Overview crops do not certify every deep pixel. The generic analytical renderer uses substitute fonts, omits some inputs/dots/arrows and approximates byte-caption spacing. Long tokens wrap in native views; platform-font line breaks remain unverified. Static poses do not certify smooth intermediate animation.

The current [managed Sites preview instructions](skill://sites@openai-curated-remote/root/.codex/plugins/cache/openai-curated-remote/sites/0.1.75/skills/sites-building/references/preview/managed-linux.md) require: “If it is unavailable, do not improvise another browser-control path.” The required control-browser skill is unavailable. Prior automatic review also rejected alternative browser execution/routes. No workaround was used. Actual browser/CSS/compositor, Safari/phone, assistive technology, hardware performance and night comfort acceptance remain open. Production migration still requires owner design approval and live-environment acceptance; passing counts do not establish design quality.

'''
docs=[]
for name,(old,new) in versions.items():
 p=Path('app-doc-current/HOPSCOTCH-'+name+'.md');s=p.read_text();assert '**Version:** '+old in s[:600]
 s=s.replace('**Version:** '+old,'**Version:** '+new,1)
 s=re.sub(r'\*\*Date:\*\* 2026-10-04 UTC','**Date:** 2026-10-06 UTC',s,count=1)
 i=s.index('\n## ');j=s.index('\n',i+1);prior=s[i+1:j].replace('## Current ','## Historical — ',1)
 s=s[:i+1]+'## Current fresh re-audit — v'+new+'\n\n'+common+sections[name]+prior+s[j:]
 for target in re.findall(r'\]\((HOPSCOTCH-[^)]+\.md)\)',s):assert (p.parent/target).exists(),target
 p.write_text(s);docs.append({'name':p.name,'version':new,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
(base/'documentation.json').write_text(json.dumps({'kind':'Six renewed audit fronts; historical sections preserved; companion links checked','documents':docs},indent=2)+'\n')
print('Updated six current design/audit documents')
