from pathlib import Path
import json,re,hashlib

base=Path('complete-review/layout-continuation-audit');verification=json.loads((base/'verification.json').read_text());assert len(verification['suites'])==10
site=verification['private_site'];url=site['url']
versions={'Design-Specification':('0.38','0.39'),'Design-Review-Plan':('0.34','0.35'),'Workspace-Coverage':('0.9','0.10'),'Implementation-Handoff':('0.9','0.10'),'Author-Audit':('3.4','3.5'),'Final-Manual-Review':('1.4','1.5')}
common=f'''The [private four-study review]({url}) now includes a focused shared-layout correction. The visual direction, markup, CSS, packet optics, scanner/docking/cadence and domain source are unchanged. The established refinement contract below still applies where this addendum does not supersede its caching/cleanup rules. HOPSCOTCH production remains untouched.

Ten synthetic suites pass on the current frozen manifest, including 78 new text-metric/viewport/gap/cleanup contracts. All 152 sampled composition inputs exactly match the prior inspected baseline, and the four fragments differ only in the shared layout controller. The previous 304 native analytical images, 32 inspected paired sheets and 11 detail crops are retained with exact pixel/source-input hashes; they were not freshly rendered or re-inspected this pass. Actual-browser, intermediate-motion, native accessibility, Safari/phone, hardware and night-comfort acceptance remain open. [Author audit v3.5](HOPSCOTCH-Author-Audit.md) is the current evidence authority.

'''
sections={
'Design-Specification':'''The reservation cache must track current text metrics and viewport-height limits as well as width and source/disclosure epoch. A computed-font change invalidates retained height; a viewport resize event schedules the same shared fit controller even if width does not change. Repeated unchanged fits reuse their measurement.

Gap is the actual CSS layout gap: an explicit zero stays zero, normal grid gap has zero used width, and a percentage resolves against the component's usable content width. The same shared readability minima continue to decide parallel versus exclusive panes. Font loading invalidates measurement; disposal removes both the font and viewport listeners and cancels pending work. These are shared derived behaviors, not per-device cases or new motion choreography.

''',
'Design-Review-Plan':'''Review text scaling and viewport-height changes in Builder, Evidence and Connected, in both appearances. The focused pane and selection should persist while the reservation follows current readable content. Existing packet/motion/material review remains valid for unchanged nominal compositions; changed browser/font/height circumstances still need actual-browser review. Acceptance of the design and production migration remain separate owner decisions.

''',
'Workspace-Coverage':'''The new focused matrix covers three consumers × two appearances. Each case exercises same-width text scaling, real resize-event delivery at unchanged width, shorter/taller height, zero/percentage/normal gaps, stationary measurement reuse, both listener removals, no post-disposal layout scheduling, and immutable source state. The synthetic content-height fixture intentionally varies with text metrics; it does not pretend to be CSS layout.

''',
'Implementation-Handoff':'''Carry these fixes with shared-reservation, not as per-view resize handlers. Text-key inputs are computed font size/family/weight/stretch/features/variations, letter spacing and line height. A text-key change invalidates reservation measurements. The fit key and reservation cache also include the current height cap. Window resize schedules batched refresh; disposal disconnects observation and removes named font/resize listeners. Use the CSS gap's actual zero/percentage/normal meaning. Preserve shared policy minima and the established canonical-time boundary.

The harness now records window event listeners and dispatches a resize event in the focused tests. Those are explicit synthetic events; browser/device acceptance is still required. No tests or budgets were weakened. The private review source commit is recorded in the Author audit; it is not a HOPSCOTCH production commit.

''',
'Author-Audit':'''A source review found stale reservation caching: after same-width text scaling, a measured 400px content height could retain the previous 280px minimum. The new focused check reproduced that failure before correction. The controller now invalidates on computed text metrics and viewport height, receives actual window resize events in the synthetic harness, resolves zero/percentage/normal gaps, and releases font/resize listeners at disposal. The ten-suite run was restarted after the final source change; partial earlier logs are not acceptance evidence.

''',
'Final-Manual-Review':'''Use the same four study links in the prior review guide. The new spot check is layout responsiveness: change text scale with a control focused, change the window height without changing its width, then switch between Scene/Details or Network/Workbench. Focus and source selection should remain intact, and hidden long content should not leave a stale empty reservation. This pass adds no visual styling changes; the existing light/dark design review is still the relevant comparison.

'''}
suite_table='| Suite | Final completion | Result |\n|---|---|---|\n'+''.join(f"| {s['suite']} | {s['completion']} | Pass |\n" for s in verification['suites'])+'\n'
manifest_table='| Study | Bytes | SHA-256 |\n|---|---:|---|\n'+''.join(f"| {slug} | {m['bytes']:,} | `{m['sha256']}` |\n" for slug,m in zip(['Lifecycle','Builder','Evidence','Connected'],verification['manifest']))+'\n'
sections['Author-Audit']+=suite_table+manifest_table+f'''Source preservation and syntax checks pass. The unchanged repository baseline remains `be21750003cf3c097c917ae4340c78a0035ccbc6`. Private Site source commit: `{site['source_commit']}`; deployment `{site['deployment_id']}`; version `{site['version_id']}`; status succeeded. Exact source/package verification passes.

Visual evidence reuse is explicit: new current-runtime exports are byte-equivalent in all 152 sampled model trees to the previously inspected inputs, and the markup/CSS/optical/motion/domain source is exactly unchanged after excluding the one shared layout controller. Every retained native PNG and inspected sheet/detail digest is checked. This establishes unchanged analytical pictures for nominal cases, not correct browser layout in the newly tested circumstances. No actual-browser claim is added. The Sites/browser capability restriction from the previous audit still applies.

'''
documents=[];changes=[]
for name,(old,new) in versions.items():
 p=Path('app-doc-current/HOPSCOTCH-'+name+'.md');original=p.read_text();s=original;assert '**Version:** '+old in s[:600];s=s.replace('**Version:** '+old,'**Version:** '+new,1);i=s.index('\n## ');j=s.index('\n',i+1);front=s[:i+1].replace('Author audit v3.4','Author audit v3.5');previous=s[i+1:j].replace('## Current ','## Previous baseline — ',1);replacement=front+'## Current layout continuation — v'+new+'\n\n'+common+sections[name]+previous;original_end=original.index('\n',original.index('\n## ')+1);changes.append({'path':str(p.resolve()),'before':original[:original_end],'after':replacement});s=replacement+s[j:]
 for target in re.findall(r'\]\((HOPSCOTCH-[^)]+\.md)\)',s):assert (p.parent/target).exists(),target
 documents.append({'name':p.name,'version':new,'bytes':len(s.encode()),'sha256':hashlib.sha256(s.encode()).hexdigest()})
(base/'documentation.json').write_text(json.dumps({'kind':'Six current continuation fronts, version and companion-link checks','documents':documents},indent=2)+'\n');(base/'documentation-patch.json').write_text(json.dumps(changes));print('Prepared six design/audit document patches')
