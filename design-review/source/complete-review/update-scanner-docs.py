from pathlib import Path
import json,re,hashlib

audit=Path('complete-review/scanner-lifecycle-20261007')
manifest=json.loads(Path('complete-review/source-manifest.json').read_text())
regression=json.loads((audit/'regression.json').read_text())
names=['HOPSCOTCH-Design-Specification.md','HOPSCOTCH-Design-Review-Plan.md','HOPSCOTCH-Workspace-Coverage.md','HOPSCOTCH-Implementation-Handoff.md','HOPSCOTCH-Author-Audit.md','HOPSCOTCH-Final-Manual-Review.md']
versions=['0.41','0.37','0.12','0.12','3.7','1.7']
logs={n:(audit/(n+'.log')).read_text() for n in ['regression','existing-motion','refinement','lifecycle','adaptive']}
assert all('PASS' in t and 'Error' not in t for t in logs.values())
records=[{'suite':n,'completion':t.strip().splitlines()[-1],'log_sha256':hashlib.sha256((audit/(n+'.log')).read_bytes()).hexdigest()} for n,t in logs.items()]
deployment=json.loads((audit/'deployment.json').read_text())
assert deployment['status']=='succeeded'
current='''## Current scanner and lifecycle correction — 7 October 2026

The owner’s live screenshot exposed a scanner that appeared above the Sequence value and a packet sequence that expanded, closed for travel, reopened and closed again. Prior static analytical images and synthetic geometry did not establish correctness of this live sequence. Earlier “available audits complete” claims must not be treated as browser or playback acceptance.

The packet carrier was absolutely positioned without top/left anchors after the normal-flow endpoint row. The scanner used explicit stage coordinates. The magnified-copy wrapper also lacked explicit anchors. Both now have a zero origin; the scanner derives its world position from the current actor pose plus cached, measured glyph coordinates. No per-field offsets, text-length buckets or per-frame layout measurements were added. The skinny aperture, common field font, palette, glass optics and docking policy remain intact.

Normal wire playback now follows: compact construction at sender → compact travel → one opening on receipt → measured field reading → retained result → processed-buffer release. Construction no longer previews a full inspection and folds before transmission. Loss never opens a received inspector. Local operations and packet anatomy retain their distinct source semantics. The initial paused view remains a readable received packet; Replay starts from compact construction. Source events, bytes and model timestamps remain unchanged.

The new regression executes the old runtime to reproduce expanded construction and the pre-send fold; independently checks the old missing CSS anchors; and tests the corrected scanner and phase contracts across 35 scene/width cases. Theme/font reflow preserves source identity and reading progress. Prepared playback performs no new geometry reads. Existing motion, refinement and shared-lifecycle checks were rerun on the current emitted source. Historical image sets below belong to their historical manifests and were not rerendered or relabeled as current evidence.

Live browser CSS layout, system fonts, compositor frames and actual animated playback remain unverified. The CSS anchor regression is a source contract, not a browser layout test. The managed Sites preview requirement still blocks an alternative browser route when control-browser is unavailable. This correction addresses the reported causes; it does not certify that every presentation issue has been eliminated.

The current evidence authority is [Author audit v3.7](HOPSCOTCH-Author-Audit.md). All earlier “current” sections and evidence counts below are historical where they differ. The [private review](https://hopscotch-design-review.noodle1.chatgpt.site/lifecycle.html) contains this correction; HOPSCOTCH repository/production migration remains pending.

'''
for name,version in zip(names,versions):
 p=Path('app-doc-current')/name;text=p.read_text()
 text=re.sub(r'\*\*Version:\*\* [\d.]+',f'**Version:** {version}',text,count=1)
 text=text.replace('2026-10-06 UTC','2026-10-07 UTC',1)
 text=re.sub(r'\*\*(Status|Disposition):\*\*[^\n]+',r'**\1:** Scanner/lifecycle correction supplied; live browser and owner design acceptance remain open  ',text,count=1)
 text=text.replace('**Current evidence authority:** [Author audit v3.5]','**Current evidence authority:** [Author audit v3.7]',1)
 first=text.find('\n## ');assert first>=0
 appendix=current
 if name=='HOPSCOTCH-Design-Specification.md':
  appendix+='Reusable coordinate contract: every translated absolute carrier, lens crop and motion overlay must explicitly own its containing-block origin. Derive reading from rendered actor pose and measured value-local glyph runs. A static renderer that independently positions text cannot certify the runtime CSS contract. A delivered wire packet has one receive-side reading opening; inspector size does not imply a source packet transformation.\n\n'
 if name=='HOPSCOTCH-Design-Review-Plan.md':
  appendix+='Required live acceptance: check initial paused view and Replay separately; follow SYN → SYN-ACK → ACK without scrubbing; inspect the lens on short, numeric, address and wrapped values; repeat in Light/Dark and at narrow/wide widths; then change appearance/font/viewport during reading. Compare the highlighted field with the real glyphs underneath the lens throughout the movement. Source and synthetic passes cannot close this gate.\n\n'
 if name=='HOPSCOTCH-Author-Audit.md':
  appendix+='| Current check | Completion |\n|---|---|\n'+''.join(f'| {r["suite"]} | {r["completion"]} |\n' for r in records)+'\n'
  appendix+='| Current study | Bytes | SHA-256 |\n|---|---:|---|\n'+''.join(f'| {Path(m["path"]).stem} | {m["bytes"]} | `{m["sha256"]}` |\n' for m in manifest)+'\n'
  appendix+=f'Private review commit `{deployment["commit_sha"]}`; successful deployment `{deployment["id"]}`. No new native images or browser captures are claimed for this correction.\n\n'
 p.write_text(text[:first]+'\n'+appendix+text[first:])
(audit/'verification.json').write_text(json.dumps({'manifest':manifest,'suites':records,'regression_cases':len(regression['cases']),'browser_verified':False,'production_changed':False,'deployment':deployment},indent=2)+'\n')
print('Updated six design/audit documents; historical visual evidence explicitly separated')
