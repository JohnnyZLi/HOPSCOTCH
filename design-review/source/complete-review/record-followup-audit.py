import hashlib
import json
import re
from pathlib import Path

base = Path('/workspace/scratch/0a09595e9300')
work = base / 'complete-review'
docs = base / 'app-doc-current'
manifest = json.loads((work / 'source-manifest.json').read_text())
final = json.loads((work / 'followup-causal-final-audit.json').read_text())
native = json.loads((work / 'native-composition-audit.json').read_text())
assert final['source_manifest'] == manifest
assert final['checks'] == 2030 and final['fullMotionChecks'] == 27284
for item in manifest:
    content = Path(item['path']).read_bytes()
    assert len(content) == item['bytes']
    assert hashlib.sha256(content).hexdigest() == item['sha256']
    assert len(content) < 1_000_000

evidence = (
    'The full-package matrix passed 124,358 assertions at 320, 390, 736, 1,024 and '
    '1,440 px, with reduced-motion and failed-graphics cases, immediately before '
    'the last ACK ownership, transfer semantics and durable import-error corrections. '
    'The final exact sources then passed 2,030 focused assertions across those five '
    'widths and 27,284 complete TCP-phase assertions, including 390 px reduced motion. '
    'These counts have separate source manifests; the predecessor matrix is not '
    'represented as an exact-final rerun. All execute the actual emitted review scripts '
    'and bundled domain functions in a synthetic DOM/font/WebGL contract environment.'
)
visual = (
    'The native evidence set contains 176 distinct offscreen compositions, including '
    '28 rerendered TCP/capture/structural/physical cases, and 8,437 cumulative substitute-font '
    'line measurements. All 176 PNGs decode successfully after four incomplete audit '
    'images were regenerated with atomic writes. The images use actual emitted GLSL '
    'with analytical surrounding layout/backdrop and DejaVu substitution. Reading-state '
    'TCP images include the corrected endpoint ownership; the final transfer-source '
    'arithmetic correction is covered by the exact-final runtime checks, not a claimed '
    'rerender of every earlier image. Neither method verifies real browser CSS/compositing, '
    'native system fonts, physical phones, Safari, assistive technology or hardware FPS.'
)
rows = '\n'.join(
    f"| `{Path(m['path']).name}` | {m['bytes']:,} | `{m['sha256']}` |"
    for m in manifest
)
source_table = '| Review source | Bytes | SHA-256 |\n| --- | ---: | --- |\n' + rows
contracts = '''| Shared system | Inputs | Automatically derived behavior |
| --- | --- | --- |
| Packet peers and state transfer | Stable conversation identities, direction, contributing field, previous/next canonical state and owning endpoint | Peers keep physical positions; responses reverse travel; only changed state receives its actual source field; retained value and any sequence delta follow source truth |
| Selection reconciliation | Current plane, visible category/target, available identities and current source revision | Removed or filtered selections resolve to valid current context; cross-plane reveal waits for that graph; exact matches precede partial matches |
| Camera | Previous camera, current viewport and requested zoom | Resize and zoom preserve the world center, independent of device count or specific coordinates |
| Recreated native controls | Stable semantic identity and current disclosure/focus state | Focus resolves to a connected current control; exact-byte disclosures remain open; disabled or removed controls use an enabled contextual fallback |
| Captured byte window | Actual width, byte-cell minimum and selected frame-relative offset | Visible columns and an eight-row mounting capacity follow width; any exact selected byte is revealed without copying or changing captured data |
| Dense command results | Existing command projection, record identity and field semantics | Records group by actual device using the shared font; readable rows and exact source transcript coexist; invalid commands retain valid results |
| Evidence acquisition | Current workspace/source epoch, native file read/parser result and previous valid evidence | Loading is explicit; obsolete completions are ignored; valid zero-frame captures clear anatomy; read/parser failures retain their cause and previous evidence |
'''
fixes = '''| Finding | Correction and review consequence |
| --- | --- |
| Response traffic could swap endpoint labels | Stable conversation orientation now controls labels and travel direction for TCP, TLS, DNS and Journey; a reply moves from its real sender |
| SYN-ACK transfer used an unrelated sequence number | ACK 1001 now travels from the actual ACK field into the client sender record; it is never depicted as SEQ 7000 plus one |
| Retained ACK was shown under the receiver | Highest ACK belongs to **Client · data sender**; the server keeps **Next expected byte** in **Server · data receiver** |
| Unchanged/opposite sequence-space values could be transferred | Source-state bindings require an actual relevant change; handshake-complete and final-ACK do not update unrelated client-data counters; contiguous sequence arithmetic uses the actual delta |
| Long endpoint labels could compete with the animation | Endpoint height is reserved from all measured labels at plan invalidation |
| Builder search could reveal an obsolete graph | Search covers both planes and actual interfaces, prioritizes exact identities, and defers reveal until the corresponding graph is ready |
| Undo/history/import could leave a removed selected device | A shared source-identity reconciliation selects an existing current context; unavailable plane/history authoring is explicit |
| Zoom displaced the inspected world position | The shared camera calculation preserves the world center |
| Dense CLI was difficult to read | Input precedes grouped device records; same sans-serif throughout; every canonical row and exact transcript retained; invalid commands keep valid output |
| Category or layer changes could retain stale evidence selection | Fact, field and byte selections are reconciled to the actual visible source and frame/layer |
| Valid empty PCAP retained an old packet | Zero-frame files now show parsed capture scope with no stale packet, bytes or frame timestamp |
| Byte inspection recreated controls and closed details | Semantic identity preserves connected focus and disclosure; field ranges are visibly emphasized; a width-derived bounded byte window reveals any exact offset |
| Pending file reads and read errors were not fully represented | Explicit loading, source-epoch cancellation and durable error reasons survive continued valid-evidence inspection |
| AS relationship changes reset the inspected relationship | The selected relationship remains identifiable after toggling its state |
'''

spec_path = docs / 'HOPSCOTCH-Design-Specification.md'
spec = spec_path.read_text()
spec = spec.replace('**Version:** 0.31', '**Version:** 0.32', 1)
spec = spec.replace('**Revision scope:** v0.31 supplies', '**Revision scope:** v0.32 records the follow-up visual/source audit and repairs. The preceding v0.31 supplies', 1)
spec = spec.replace('Capture playback/windowing and production detail handoffs', 'Capture timed playback and frame/conversation windowing, and production detail handoffs')
spec = spec.replace('large capture windowing/playback', 'large capture frame/conversation windowing and timed playback')
for item in manifest:
    name = Path(item['path']).name
    spec = re.sub(r'^\| `' + re.escape(name) + r'` \|.*$',
                  f"| `{name}` | {item['bytes']:,} | `{item['sha256']}` |", spec, flags=re.M)
spec = spec.replace('Author checks: 124,358', '**Initial package evidence, before the follow-up audit below:** 124,358', 1)
spec += '\n\n## Follow-up author audit and corrected contracts — v0.32, 4 October 2026 UTC\n\n'
spec += 'Johnny requested visual and source audits before his review. The audit found meaningful semantic and interaction defects that prior broad assertion counts had not detected. The revised review sources above now correspond to this follow-up; this is still isolated design work. See [Author audit](HOPSCOTCH-Author-Audit.md) for the compact finding record.\n\n'
spec += fixes + '\nThese changes extend shared systems with semantic inputs and calculated adaptation. They do not introduce per-value length buckets, per-event position recipes, a second font, or new simulation behavior. Existing optical/scanner/contact/transfer/pacing kernels and the accepted resilient references remain unchanged.\n\n'
spec += contracts + '\n' + evidence + '\n\n' + visual + '\n\n'
spec += 'The source bundles remain tied to the pinned repository baseline. The earlier production checkout is unavailable in this current scratch session; no fresh checkout/build/clean-status verification is claimed. No production source was edited. Automatic review rejected local browser preview; that denial was honored without a workaround. Real environment gates, owner acceptance of these revised studies, unrepresented workflows and G5/G6 remain open.\n'
spec_path.write_text(spec)

review_path = docs / 'HOPSCOTCH-Design-Review-Plan.md'
review = review_path.read_text().replace('**Version:** 0.27', '**Version:** 0.28', 1)
review = review.replace("Review specification v0.28's supporting edges beside the packet, mobile first, in Light and Dark. Require a related optical family, shallower record depth, one clean contour and retained backdrop transmission through receiving/retained states; then inspect desktop and router lookup. Once accepted, continue the deliberate mobile router/failure composition. Browser/phone, assistive reading, broader workspace coverage, G4 recovery/overlay, G5/G6 and production handoff remain open.",
    'Review the corrected specification v0.32 package: causal lifecycle/TCP/failure, Builder and evidence, in that order. The accepted resilient foundation is preserved. Review the author-audit findings below before judging the revised sources in Light/Dark and compact/wide compositions. Owner acceptance, broader unrepresented workflows, real browser/phone/accessibility/performance evidence and G5/G6 remain open.')
review = review.replace('## Complete package owner audit — 4 October 2026 UTC', '## Initial complete package owner audit — 4 October 2026 UTC', 1)
review += '\n\n## Follow-up audit review — v0.28, 4 October 2026 UTC\n\n'
review += 'Use specification v0.32 hashes and [Author audit](HOPSCOTCH-Author-Audit.md), rather than the earlier package hashes/counts, to identify the revised review. Audit closure is bounded to the supplied studies, not whole-product readiness.\n\n'
review += '| Review focus | Concrete acceptance question |\n| --- | --- |\n| Response continuity | Do physical peers stay in place while SYN-ACK/DNS/TLS/Journey replies travel from the actual sender? |\n| Correct retained state | Does ACK 1001 land in the client sender record, with no false SEQ 7000 arithmetic or unrelated final-ACK update? |\n| Builder context | Do plane/search/undo/history/zoom preserve a valid, understandable device context? |\n| Dense records | Is CLI input first, output grouped/readable in the same font, and exact transcript available? |\n| Evidence context | Do zero-frame captures clear old anatomy; categories/layers select visible facts; bytes/focus/disclosure stay coherent? |\n| Acquisition state | Do loading, Clear, stale completion and file-read/parser errors preserve truthful source/availability and valid evidence? |\n\n'
review += evidence + '\n\n' + visual + '\n\n'
review += 'Prior assertion totals did not establish these semantics: review both contributing packet fields and the owning retained state. Automatic review rejected local browser preview; no workaround was used. Real browser/system-font/phone/assistive/hardware gates and final owner acceptance remain open. Production migration remains outside this audit authorization.\n'
review_path.write_text(review)

coverage_path = docs / 'HOPSCOTCH-Workspace-Coverage.md'
coverage = coverage_path.read_text().replace('**Version:** 0.2', '**Version:** 0.3', 1)
coverage = coverage.replace('## Current package audit — 4 October 2026 UTC', '## Initial package audit — 4 October 2026 UTC', 1)
coverage = coverage.replace('Production timed replay/windowing/large-file budgets', 'Production timed replay, frame/conversation windowing and large-file budgets')
coverage = coverage.replace('actual nine-frame PCAP/two-frame PCAPNG plus truncated32/54 reference;', 'actual nine-frame PCAP/two-frame PCAPNG plus truncated32/54 reference;', 1)
coverage += '\n\n## Follow-up audit coverage — v0.3, 4 October 2026 UTC\n\n'
coverage += 'Specification v0.32 and [Author audit](HOPSCOTCH-Author-Audit.md) identify the corrected final review sources. Stable protocol peers, proper ACK ownership/contributing-field arithmetic, Builder cross-plane search/selection/zoom and readable CLI, measured fact reconciliation, valid zero-frame capture, bounded exact-byte windows, retained native focus/disclosure, acquisition cancellation/durable error cause and AS relationship retention are supplied.\n\n'
coverage += 'Exact byte mounting is now width-derived and bounded; it is no longer an absent design. Large frame/conversation indexing, full timed capture playback, public/bridge acquisition, overall entry/detail returns, every nested configuration editor and alternate protocol branches remain separate work. Source-backed inspection does not remove that production capability.\n\n' + evidence + '\n\n' + visual + '\n\n'
coverage += 'No new production checkout/build verification is claimed: the earlier checkout is absent in the current session. Accepted foundations remain exact. Automatic review blocked local browser preview; real environment acceptance and G5/G6 remain open.\n'
coverage_path.write_text(coverage)

handoff_path = docs / 'HOPSCOTCH-Implementation-Handoff.md'
handoff = handoff_path.read_text().replace('**Version:** 0.2', '**Version:** 0.3', 1)
handoff = handoff.replace('## Current engineering review evidence', '## Prior engineering review evidence', 1)
handoff = handoff.replace('## Complete review package handoff additions — 4 October 2026 UTC', '## Initial complete review package handoff additions — 4 October 2026 UTC', 1)
handoff += '\n\n## Corrected handoff contracts — v0.3, 4 October 2026 UTC\n\n'
handoff += 'Use specification v0.32 final hashes and [Author audit](HOPSCOTCH-Author-Audit.md) for the revised package. Carry the following semantic/dynamic contracts into any later authorized implementation; do not copy isolated per-demo recipes.\n\n' + contracts + '\n'
handoff += 'In particular, do not infer endpoint state ownership from event-name prefixes. Bind actual contributing fields to the relevant changed canonical state and owning endpoint. Packet ACK numbers and sequence numbers occupy different sequence spaces; animation must not turn an unrelated number into a retained record by fabricated arithmetic.\n\n'
handoff += evidence + '\n\n' + visual + '\n\n'
handoff += 'The current scratch session has no production checkout, so this follow-up does not claim a fresh build or git clean-status check. No production file was edited. The accepted resilient sources and optical/motion kernels are unchanged. Automatic review rejected local browser preview; that restriction was honored. Owner acceptance and broader design/environment gates remain open, and this audit does not authorize migration, commits, PRs or publication.\n'
handoff_path.write_text(handoff)

report = '# HOPSCOTCH — Author Audit\n\n**Version:** 1.0 · **Date:** 2026-10-04 UTC\n**Status:** Revised review package ready for owner audit; production migration unapproved\n\n'
report += 'The visual and source audit found and corrected protocol-presentation, context-retention and evidence-interaction defects. The accepted typography, glass materials, skinny scanner, resistant attachment and pacing remain the foundation. This report identifies the revised studies and distinguishes inspection evidence from real-browser verification.\n\n## Findings and repairs\n\n' + fixes
report += '\n## Verification and limits\n\n' + evidence + '\n\n' + visual + '\n\n'
report += 'The native compositions were visually inspected in Light and Dark, compact and desktop, including packet operations/TCP/failure, grouped Builder CLI, all evidence families, valid zero-frame captures and large exact-byte inspection. The audit also checked the shared policies and actual emitted source code. Earlier large check totals missed some semantic defects; the new focused checks explicitly assert contributing field, retained value, endpoint ownership and unchanged sequence spaces.\n\n'
report += 'Automatic approval review rejected local browser preview. That action was not retried through another route. Browser compositing/system-font, physical phone/Safari, assistive technology/software keyboard and hardware performance remain unverified. No fresh production checkout/build/status claim is made because the earlier checkout is unavailable in this session.\n\n## Revised review sources\n\n' + source_table + '\n\n'
report += 'Accepted foundations remain byte-for-byte identical: resilient glass `cedcfd274898b271c138241df65bc8dda14a4cd46fd1dd61e8c3a11c76958667`; TCP resilient glass `176ab8cde257438033f8e17b571153e0b46a69b90ab04bf98fa4781b67e60938`. Production simulation, protocol/event models and canonical playback were not edited.\n\n'
report += 'Design records: [Specification v0.32](HOPSCOTCH-Design-Specification.md), [Review plan v0.28](HOPSCOTCH-Design-Review-Plan.md), [Coverage v0.3](HOPSCOTCH-Workspace-Coverage.md), [Handoff v0.3](HOPSCOTCH-Implementation-Handoff.md).\n\n## Owner review\n\n'
report += 'Review causal lifecycle/TCP/failure, then Builder, then evidence in Light and Dark. The revised sources are proposals awaiting your judgment. Byte windowing is supplied; full capture time/frame/conversation scaling, real acquisition, overall entry/detail handoffs, alternate protocol branches and every nested editor remain broader work. G5/G6 and explicit production migration authorization remain open.\n'
(docs / 'HOPSCOTCH-Author-Audit.md').write_text(report)

native['final_followup_source_manifest'] = manifest
native['final_followup_provenance'] = ('Existing native source_manifest and retained_case_source_manifest remain the actual image provenance. The last causal change corrects only transfer-source/state binding and explanatory arithmetic; it is verified in followup-causal-final-audit.json. Reading-state images are not relabeled as a complete exact-final rerender.')
(work / 'native-composition-audit.json').write_text(json.dumps(native, indent=2))
identities = [
    ('HOPSCOTCH-Design-Specification.md', 'libfile_db06f314f3488191a2bbcedebed36b13', 33),
    ('HOPSCOTCH-Design-Review-Plan.md', 'libfile_e8b8443c04348191b0638576bd794973', 28),
    ('HOPSCOTCH-Workspace-Coverage.md', 'libfile_d720ea26090c8191a925aa4de7f14db6', 1),
    ('HOPSCOTCH-Implementation-Handoff.md', 'libfile_853294284678819195f1ab72fd5d77f0', 1),
]
uploads = [dict(local_path=str(docs/name), purpose='replace_library_file', library_file_id=identity, expected_current_version=version, version_reason='Follow-up visual and source audit; corrected semantic/dynamic contracts and exact evidence limits') for name, identity, version in identities]
uploads.append(dict(local_path=str(docs/'HOPSCOTCH-Author-Audit.md'), purpose='create_library_file', library_artifact_type='report'))
(work / 'followup-design-save-request.json').write_text(json.dumps({'uploads': uploads}, indent=2))
print('Updated four design records and authored the audit report; exact source manifests agree.')
