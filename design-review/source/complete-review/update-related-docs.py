from pathlib import Path
import json,re,hashlib
audit=Path('complete-review/related-motion-20261007')
manifest=json.loads(Path('complete-review/source-manifest.json').read_text())
motion=json.loads((audit/'contracts.json').read_text());scanner=json.loads((audit/'scanner-contracts.json').read_text())
assert motion['manifest']==scanner['manifest']==manifest
records=[]
for name in ['contracts-final','scanner','existing-motion','refinement','origin-sweep']:
 p=audit/(name+'.log');text=p.read_text();assert 'PASS' in text and 'Error' not in text
 records.append({'name':name,'completion':text.strip().splitlines()[-1],'log':str(p),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
deployment=json.loads((audit/'deployment.json').read_text());assert deployment['status']=='succeeded'
versions={'HOPSCOTCH-Design-Specification.md':'0.42','HOPSCOTCH-Design-Review-Plan.md':'0.38','HOPSCOTCH-Workspace-Coverage.md':'0.13','HOPSCOTCH-Implementation-Handoff.md':'0.13','HOPSCOTCH-Author-Audit.md':'3.8','HOPSCOTCH-Final-Manual-Review.md':'1.8'}
section='''## Current related-motion audit — 7 October 2026

A follow-up to the misplaced scanner found two additional implementation defects. The numeric-transfer overlay also used a CSS static origin with stage-relative translations; it now has explicit left/top anchors. That shared overlay is used for retained TCP values and packet-field changes. Separately, appended payload chunks retained a midpoint translateY(3px) after a seek to their settled hold. The assembly renderer now resets temporary chunk translation before deriving the current pose. These are shared coordinate/pose rules, not per-value geometry corrections.

The current audit compares neighbouring visible phases and the same target pose after different playback histories. Across seven motion families and four widths (320, 390, 1024, 1440), 1,912 visible phase boundaries and 248 history comparisons passed. Repeated Play requests advanced one clock; Pause stopped advancement. The previous scanner/lifecycle regression was rerun across 35 scene/width cases, including theme/font reflow. Existing motion checks at 390 and 1024 and reduced motion at 390, plus the unchanged refinement suite, passed on this emitted source. Source fixtures and domain bundles retain their bytes. Earlier audit outputs are historical and do not certify this manifest.

This is source and synthetic runtime evidence. No new browser captures or analytical visual renders are claimed. Live CSS layout, platform fonts and compositor playback remain unverified; the unavailable managed browser path still leaves that acceptance gate open. The original missed visual defects are the reason static images and high assertion counts cannot close it.

The [private review](https://hopscotch-design-review.noodle1.chatgpt.site) contains these corrections. HOPSCOTCH repository/production remains untouched. [Author audit v3.8](HOPSCOTCH-Author-Audit.md) is the current evidence authority; earlier dated “current” sections below are historical.

'''
for name,version in versions.items():
 p=Path('app-doc-current')/name;text=p.read_text();text=re.sub(r'\*\*Version:\*\* [\d.]+',f'**Version:** {version}',text,count=1)
 text=re.sub(r'\*\*(Status|Disposition):\*\*[^\n]+',r'**\1:** Related motion defects corrected; live browser and owner design acceptance remain open  ',text,count=1)
 text=text.replace('**Current evidence authority:** [Author audit v3.7]','**Current evidence authority:** [Author audit v3.8]',1)
 first=text.find('\n## ');assert first>=0
 extra=section
 if name=='HOPSCOTCH-Design-Specification.md':extra+='Pose contract: transient styles must be assigned from the current timeline state, including their settled values. Scrubbing, replaying and reversing cannot leave an earlier phase’s transform behind. A translated absolute overlay must explicitly own its origin; test all instances of that pattern rather than only the component reported by the owner.\n\n'
 if name=='HOPSCOTCH-Design-Review-Plan.md':extra+='Extend live review to numeric value extraction/landing and inserting/removing payload while scrubbing in both directions. Compare the finished packet after uninterrupted playback with the same point reached by seeking. Keep sequential playback inspection in addition to static endpoint views.\n\n'
 if name=='HOPSCOTCH-Author-Audit.md':
  extra+='| Current check | Completion |\n|---|---|\n'+''.join(f'| {r["name"]} | {r["completion"]} |\n' for r in records)+'\n'
  extra+='| Current study | Bytes | SHA-256 |\n|---|---:|---|\n'+''.join(f'| {Path(m["path"]).stem} | {m["bytes"]} | `{m["sha256"]}` |\n' for m in manifest)+'\n'
  extra+=f'Successful private review commit `{deployment["commit_sha"]}`; deployment `{deployment["id"]}`. Full original suites were not all rerun; the table above identifies the checks that certify this source revision.\n\n'
 p.write_text(text[:first]+'\n'+extra+text[first:])
(audit/'verification.json').write_text(json.dumps({'manifest':manifest,'suites':records,'motion_cases':len(motion['cases']),'scanner_cases':len(scanner['cases']),'visible_boundaries':1912,'history_comparisons':248,'repeat_play_pause':True,'browser_verified':False,'production_changed':False,'deployment':deployment},indent=2)+'\n')
print('Updated six documents with related-motion corrections and explicit audit limits')
