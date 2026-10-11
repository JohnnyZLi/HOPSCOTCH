from pathlib import Path
import json,re

base=Path('app-doc-current')
versions={
 'HOPSCOTCH-Design-Specification.md':('0.34','0.35'),
 'HOPSCOTCH-Design-Review-Plan.md':('0.30','0.31'),
 'HOPSCOTCH-Workspace-Coverage.md':('0.5','0.6'),
 'HOPSCOTCH-Implementation-Handoff.md':('0.5','0.6'),
 'HOPSCOTCH-Author-Audit.md':('3.0','3.1'),
 'HOPSCOTCH-Final-Manual-Review.md':('1.0','1.1'),
}
notice='''## Current correction — shared Builder systems, 4 October 2026

Johnny's screenshots exposed real defects after the earlier author audit: the Builder header context was vertically offset, some network paths did not meet node outlines, the successful probe status looked like an unpadded square strip, and disclosure content/chevrons appeared abruptly. Earlier analytical checks did not establish actual browser design quality. This revision repairs the common presentation systems across the four studies and keeps final browser/owner acceptance open.

The current contracts and evidence are recorded in Author audit v3.1. Review the corrected header, connection endpoints, status surface and reversible disclosures first using Final manual review v1.1. Production, simulation functions, canonical event models and playback remain unchanged. Historical manifests below apply only to their named earlier revisions.

'''

contracts='''## Shared geometry and disclosure contract — v0.35

| System | Shared contract | Dynamic inputs and invalidation |
| --- | --- | --- |
| App header | One template owns identity and tool slots. Brand and context align in the identity slot; navigation/pickers/appearance occupy the tool slot. Content labels with bottom margins are not header components. | Available width governs wrapping. Compact layouts reserve host-control space once. Same slots apply to all four studies. |
| Network scene | Nodes and connections occupy one world parent with one camera transform. The SVG viewBox equals world dimensions; host max-width/height rules cannot independently resize the SVG. HTML nodes and SVG paths use the same coordinates. | Node boxes are measured with the actual native button class and inherited font before planning. Label, font, viewport-dependent cap and topology changes invalidate geometry. Panning/zooming only transform the world. |
| Rounded ports | Connections terminate on measured node boundaries, on flat portions clear of corner radii. Port count automatically increases the relevant box side. | Measured width/height/radius and side-port counts determine dimensions and anchors; no per-device or per-label position recipes. |
| Crossings | Ordinary links use one continuous theme-defined route stroke. Only genuine crossings receive short local knockout marks and continuous overpasses. | Deterministic planned segments determine crossings. A whole-link pale backing stroke must not erase nearby connections. |
| Status region | The generic announcement surface has inherited foregrounds, common 18 px padding/radius, and quieter supporting frost. It is not a miniature packet. Ping and traceroute use accurate presentation headings. | Exact current result text updates immediately. Previous visual text is briefly crossfaded as an inert, aria-hidden copy; height changes animate and superseded effects cancel. |
| Disclosure | One controller upgrades native details/summary. It measures the natural inner content and animates a clipping wrapper, content opacity/small travel, and a continuous chevron rotation. | Natural content height and current openness determine travel and bounded duration. ResizeObserver follows the natural inner, not the animated wrapper. Rapid reversal starts at the current pose. |
| Disclosure retention | Logical intent and current progress are separate from the native open flag, which stays true during closing. Same-context rerenders retain intent/progress; another semantic context restores its own settled state. | Semantic/structural keys remain bounded. Programmatic native changes reconcile before redraw. Closing content becomes inert/hidden to assistive reading while the summary remains actionable. |
| Pane reservations | Reserve final content geometry without cloning on camera-only updates. Coalesce disclosure-triggered layout work and use the shared motion duration for reservation changes. | Cache by width and content generation; invalidate on semantic redraw/font/width changes. Measurement clones settle to logical target state. |

Disclosure full-travel durations use one distance policy: clamp(160 + 6√heightDistance, 180, 300) ms. Reversal scales by remaining openness with a 0.2 floor. Easing is continuous cubic ease-out. This policy is shared; it is not a custom timing recipe for Why, Builder sections or captured bytes. Motion affects presentation only. Reduced motion settles directly to the final semantic state.

Graph route roles are defined in both themes and forced colors. Shared button measurement is cached within planning and removed afterward; font changes invalidate plans. Actual platform font layout, native keyboard semantics, intermediate clipping/compositing and performance still require the live-environment gate.

'''

review='''## Corrected-system review — v0.31

Review the four current studies against Author audit v3.1's exact source manifest. Start with the Builder: compare header alignment in compact/wide Light/Dark; pan/zoom and resize the network; run Ping and traceroute; rapidly reverse Selection and reusable authoring tools and nested Why disclosures. Then repeat disclosure, status and header checks in causal, evidence and connected studies.

Required visible outcomes: paths meet rounded node boundaries without a separate SVG scale; camera-only updates do not rebuild/reserve the inspector; result text has consistent padding and quiet supporting frost; arrow, content and reserved space move coherently in both directions. Rerendering during a closing motion must retain closing intent, not reopen because native details remains mounted. Keyboard focus and reduced-motion results must remain usable.

Current evidence: 447 focused shared-system contracts across five widths; 124,358 complete emitted-runtime contracts; 26,035 dense Builder/evidence contracts; 2,030 focused follow-up contracts; current connected regression results are recorded in Author audit v3.1. A 32-node/96-link planner stress case has no shared segments, node collisions, duplicate ports or rounded-boundary endpoint errors. These are synthetic/runtime/geometry checks, not browser acceptance.

Eight new native analytical resting compositions cover Builder at 390/736/1,024 px in both themes and paired rounded-port closeups. They use runtime-derived content and source material roles with analytical layout/substitute fonts. They cannot certify live browser layout or intermediate animation pixels. The previous local-browser automatic-review rejection remains respected. G5/G6 remain open for final owner/environment judgment.

'''

coverage='''## Corrected shared coverage — v0.6

| Family | Supplied in this correction | Remaining review |
| --- | --- | --- |
| All four study shells | Common identity/tool header slots; semantic supporting status surface; shared animated native disclosures | Actual baseline/wrapping, keyboard/focus, Dark/Light and platform fonts |
| Builder topology | Measured native node boxes, one world/camera mapping, rounded-safe dynamic ports, visible route tokens and local crossing marks | Real host/browser endpoints during pan/zoom/resize, long labels and dense graphs |
| Simulated AS topology | Same world, measurement and crossing systems; camera retained for surviving topology | Actual browser sizing, long-label/crossing readability |
| Builder results | Rounded/padded generic status surface; correct Ping and traceroute headings; semantic text plus bounded visual crossfade | Rapid updates, long result height, optical and assistive behavior |
| Builder/evidence disclosures | Reversible measured motion, logical intent/progress retention, cached/coalesced reservation work | Nested Why, captured bytes, rerender/reversal, keyboard and reduced motion |

This supplies the authorized review-demo corrections. It does not convert prototype authoring/acquisition controls into production implementations. User screenshots are evidence of defects missed by earlier analytical coverage; current functional/native checks remain bounded and cannot close actual environment acceptance.

'''

handoff='''## Corrected reusable-system handoff — v0.6

Port the contract as shared components/controllers, not copied markup and per-view animation recipes. The isolated reference sources are shared-ui.js, shared-network.js, shared-reservation.js, review.css and assemble.py. Build-time header assembly is a prototype mechanism; production should express the same identity/tool slots in its native component structure.

The network adapter accepts semantic graph data, measured native node boxes and the existing camera. One world holds the SVG and HTML nodes. Preserve the SVG sizing override against host max-width rules, font/label/viewport invalidation, measured radii and automatically sized port sides. Existing routes and authored topology remain model truth. Camera updates must not redo node measurement or pane cloning. Local crossing gaps and theme route tokens are presentation concerns.

The disclosure adapter owns native summary activation, logical requested state, natural-height observation, current pose, reversal, retained context, cancellation/disposal and reduced-motion settlement. Native open=true while closing is not the retained state. Clone-based reservation measurement must settle to logical target geometry. Avoid observing the animated wrapper or repeatedly measuring ancestor content during child motion. Keep bounded context memory, semantic keyboard behavior and exact content.

The status adapter updates exact live text immediately and animates only a bounded inert visual copy and height. The shared status surface owns radius/padding/material/foreground; result providers own accurate headings and content. Neither optical/disclosure callbacks nor layout settlement may alter source events, bytes, protocol state or canonical playback time.

Tests and the 32/96 graph audit are source/geometry contracts. Actual platform-font measurement, host SVG sizing, native details activation/focus, intermediate clipping, Safari/mobile and hardware performance must be checked when permitted browser access is available. The source archive preserves reusable templates/controllers and audit scripts; rebuilding still requires the two identified accepted foundation references, which are deliberately unchanged.

'''

for name,(old,new) in versions.items():
 p=base/name;s=p.read_text();assert f'**Version:** {old}' in s
 s=s.replace(f'**Version:** {old}',f'**Version:** {new}',1)
 s=s.replace('Author audit v3.0','Author audit v3.1')
 if name not in ['HOPSCOTCH-Author-Audit.md','HOPSCOTCH-Final-Manual-Review.md']:
  at=s.index('## Current review disposition')
  s=s[:at]+notice+s[at:]
  addition={'HOPSCOTCH-Design-Specification.md':contracts,'HOPSCOTCH-Design-Review-Plan.md':review,'HOPSCOTCH-Workspace-Coverage.md':coverage,'HOPSCOTCH-Implementation-Handoff.md':handoff}[name]
  s+='\n'+addition
 p.write_text(s)

p=base/'HOPSCOTCH-Author-Audit.md';s=p.read_text()
s=s.replace('## Defects found and repaired',notice+'## Defects found and repaired',1)
row='''| Builder context used a content-label bottom margin | Shared header identity/tool slots and zero-margin context | Shared source structure and five-width runtime contracts; browser baseline remains manual |
| Separate SVG sizing could detach paths from HTML nodes; route token was missing | One world/camera, explicit uncapped SVG sizing, measured button boxes and rounded-safe ports; defined route roles | Host CSS/source diagnosis, endpoint/world contracts and 32/96 geometry stress; screenshots require live recheck |
| Ping status was an unpadded square background strip; traceroute shared the Ping title | Shared rounded/padded status surface with quiet supporting frost and correct headings | Source/runtime semantics and paired native analytical compositions |
| Native disclosures and chevrons popped; closing rerenders could restore native open | Measured reversible controller, retained logical intent/progress, native semantics and reduced-motion settlement | Mid-motion reversal/rerender/property-change contracts; intermediate browser pixels remain manual |
'''
s=s.replace('| Earlier docs listed hypothetical',row+'| Earlier docs listed hypothetical',1)
s=s.replace('| Connected |','| Shared systems | 447 focused assertions at 320, 390, 736, 1,024 and 1,440 px: header/world mapping, rounded ports, camera-only cost, logical closing/rerender, rapid reversal, native property reconciliation and reduced motion |\n| Complete emitted runtime | 124,358 assertions across those five widths, reduced motion and failed-graphics cases; latest four-study emission |\n| Connected |',1)
s=s.replace('## Visual and design evidence','''## New visual and geometry evidence — v3.1

Eight additional native analytical compositions were inspected: Builder at 390, 736 and 1,024 px in Light/Dark plus paired rounded-port closeups. The final constructor follows the exported camera rather than artificially fitting a dense network into mobile, clips the map viewport, and reflects shared header slots. Inspection covers resting hierarchy, supporting-status padding/radius, theme foregrounds and continuous flat-edge attachments. This constructor is an analytical renderer, not browser DOM layout; its substitute fonts/material approximations do not verify actual controls or animated intermediate pixels.

The unchanged accepted 32-node/96-link graph was passed through the current shared planner: 0 shared segments, 0 node collisions, 0 duplicate ports, 0 contacts, 0 shallow crossings, 61 permitted crossings and 241 bends. Every endpoint passed the rounded flat-boundary contract. This is geometry evidence, not a universal proof for all graphs or a visual-quality score.

## Earlier visual and design evidence — v3.0
''',1)
manifest=json.load(open('complete-review/source-manifest.json'))
table='| Study | Bytes | SHA-256 |\n| --- | ---: | --- |\n'+''.join(f"| {x['path']} | {x['bytes']:,} | {x['sha256']} |\n" for x in manifest)
s=re.sub(r'\| Study \| Bytes \| SHA-256 \|.*?(?=\nAccepted resilient)',table,s,flags=re.S)
s=s.replace('Current scratch ledgers are complete-review/source-manifest.json,','Current correction ledgers are complete-review/shared-builder-audit.json, contract-audit.json, shared-network-stress-audit.json, builder-fix-native-audit.json and builder-fix-compositions.json. Current source manifest is complete-review/source-manifest.json. Supporting ledgers include')
p.write_text(s)

p=base/'HOPSCOTCH-Final-Manual-Review.md';s=p.read_text()
guide='''## Review the corrected shared systems first — v1.1

The earlier audit missed the defects shown in your Builder screenshots. This revision changes the current baseline; earlier images/counts do not certify these new components. Use Author audit v3.1 for exact hashes.

| Check | Actions | Required result |
| --- | --- | --- |
| Header | Compare Builder with the other three studies at compact/wide widths in both themes | Brand/context share a dependable alignment; tools wrap deliberately; no inherited eyebrow margin or doubled host-control reservation |
| Connections | Pan/zoom, resize, change labels/topology, inspect rounded corners; compare Builder and AS | HTML nodes and paths move together; every connection touches its node on a safe flat edge; labels fit; camera is retained for surviving context |
| Dense geometry | Inspect neighborhood/full network and high-port nodes | Distinct connections/crossings stay legible; overpass clearance is local; no full-length pale backing erases nearby lines |
| Results | Run Ping and traceroute; trigger a longer result then a short one in Light/Dark | Accurate heading; 18 px common padding/radius; quiet supporting glass; text/height crossfade without square strip, overlap or missing current result |
| Disclosure motion | Open/close Selection and reusable authoring tools, Why, and evidence byte records; rapidly reverse before settling | Arrow/content/space move together from the current pose with no pop or full restart; settled content is not clipped |
| Rerender and access | Close a disclosure then trigger a same-context redraw; use keyboard, focus and reduced motion; resize an opened/nested record | Closing intent persists, open context remains stable, summary is usable, hidden content cannot trap focus, reduced motion preserves exact meaning |

Actual browser/platform fonts, host sizing and intermediate motion remain the acceptance target. The new native compositions are analytical resting views with substitute fonts, and synthetic controllers do not establish native keyboard or screen-reader behavior.

'''
s=s.replace('## Review sequence',guide+'## Review sequence',1)
s=s.replace('The current code was inspected;','The current shared-system correction adds header slots, measured rounded-safe graph ports in one coordinate system, defined route tokens, padded/rounded result surfaces, correct probe headings and reversible measured disclosures with logical-state retention. The emitted runtime passes 447 focused shared contracts and 124,358 broad contracts. The 32/96 graph geometry stress case has no endpoint errors, collisions, shared segments or duplicate ports.\n\nThe current code was inspected;',1)
p.write_text(s)

for name in versions:
 s=(base/name).read_text();assert 'v3.0](HOPSCOTCH-Author-Audit.md)' not in s
 print(name,(base/name).stat().st_size)
