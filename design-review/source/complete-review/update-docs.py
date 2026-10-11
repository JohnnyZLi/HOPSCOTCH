from pathlib import Path
import json,re

base=Path('app-doc-current')
manifest=json.loads(Path('complete-review/source-manifest.json').read_text())
audit=json.loads(Path('complete-review/contract-final-verified.json').read_text())
native=json.loads(Path('complete-review/native-composition-audit.json').read_text())
counts=f"{audit['checks']:,} actual-emitted-script assertions at 320, 390, 736, 1,024 and 1,440 px, with reduced-motion and failed-graphics cases; {len(native['cases'])} native offscreen compositions and {len(native['text_bounds']):,} substitute-font line bounds"
refs='\n'.join(f"| `{Path(r['path']).name}` | {r['bytes']:,} | `{r['sha256']}` |" for r in manifest)
package='''
## Complete lifecycle, Builder and evidence review package — 4 October 2026 UTC

**Authorization and status:** Johnny requested all remaining items in the selected sequence so he can audit them together. This completes that isolated review package. It does not approve these new references, close the entire redesign, or authorize production migration. The accepted resilient desktop/mobile references are preserved byte-for-byte. Current GitHub `main` was checked during this pass and matches the pinned source baseline; the production checkout is unchanged.

### Supplied studies

| Study | Concrete review coverage | Deliberate boundary |
| --- | --- | --- |
| Causal lifecycle | One retained frame identity across compact travel and measured anatomy; six IPv4/IPv6 × TCP/UDP/ICMP variants; construction/reading/TTL/checksum/payload/attachment/removal; all 20 canonical TCP events through loss, duplicate ACKs, fast retransmission, congestion recovery and FIN/ACK teardown; all seven Failure Story events; source DNS/TLS/HTTP/Journey sequences and provider projections | Source event/state order is unchanged. Presentation time is independent. Static construction/provider projections have no invented model clock. Generic protocol projections establish shared behavior; they are not complete production editors or every alternate scenario. |
| Builder workbench | Topology and selected-device workbench; Config/State/Events/Why; all 12 nested families; validated interface change, actual forwarding/probes, supported CLI, canonical history locks, copy/paste/reconcile, alignment, undo/redo, sites/templates, scenario schema import/export, two broken challenge fixtures through real repair and verification | Systems inspect actual source records through reusable disclosure rather than flattened schema paths. Inspection coverage does not supply every future OSPF/BGP/NAT/DHCP/provider editing form. IPv6 control and provider use explicitly separate fixtures. Challenge repairs are review actions against actual model functions; they are not new production behavior. |
| Evidence workspaces | Measured report/target/fact/source/availability/freshness and local JSON import; multi-frame PCAP and PCAPNG, truncation, conversations, frame/layer/field/byte inspection and local capture import; populated/empty/loading/partial/error references; Observed independent evidence islands; Physical projected globe/selection; 32-AS true network with policy-valid paths, relationship failure and retained inspection | No remote query, bridge connection or live measurement was executed. Observed and Physical data are prominently labeled repository synthetic fixtures. Capture fixture repetitions are not a fabricated coherent TCP session. Captured checksums are displayed fields without verification claims. Capture playback/windowing and production detail handoffs remain implementation design work. |

### Motion and automatic adjustment contract

- **Identity before spectacle:** compact travel, fold/open and layer focus belong to one frame carrier. Receiving and responding are separate events and separate packet actors. Packet contents are processed into retained endpoint state before the buffer is released. A lost segment has no receipt/read/retain stage. Teardown's final wire exchange is explicit; native endpoint cleanup is outside the source model.
- **Read actual content:** the skinny reader consumes measured glyph line boxes. Its sweep, dwell, travel and emphasis come from actual text and semantic read targets, without short/medium/long cases. Text/font/width invalidation replans, preserving semantic position. Intermediate lens/emphasis shapes retain rounded masks.
- **Seat separate components:** Ethernet header, IP packet and trailer remain three touching shapes. One geometry-derived contact law provides quicker approach and stronger resistance near the seam, with complementary detachment. No connector bars, bounce, jiggle or per-instance keyframe recipe. The FCS slot is explicitly unavailable because the packet model does not supply FCS bytes.
- **Changes carry consequences:** source construction snapshots show payload 96 → 128 → 16 bytes, with actual derived lengths and checksums. The source microscope clamps payload to at least 16 bytes; the final state must not be labeled empty/zero. New chunks blend into retained content; removed chunks leave from their actual source region. Field copies land and blend into their receiving native text instead of vanishing.
- **Retain readable outcomes:** TCP sequence gaps, buffered ranges, congestion window and ACK state follow canonical commits. Failure break, control propagation, route installation and application recovery remain distinct. Attention/exposure timing remains semantic and geometry-driven on every layout, with user speed applied consistently.
- **Useful entry and preserved camera:** a new packet study opens with a visible prepared object; Replay retains the full construction sequence. The globe derives its initial center and nearest visible facility from the actual coordinates. A new AS layout focuses the inspected source; a shared camera-resize function preserves the same world center across viewport changes. Empty evidence cancels obsolete file/graph/globe work and remains empty after reflow.
- **Compute composition:** fields wrap from actual content; capsule width comes from the longest measured source label; envelope height comes from rendered text; inspection reserves measured alternate-pane space on compact layouts. Topology ports/routes use the accepted bounded planner. Full-map overviews reuse exact graph geometry and identify the readable camera window; overview dots are context, not a second topology or hidden route.
- **Inspect records semantically:** one Builder inspector derives headings from source identity/label/title/name, keeps primitive facts together and discloses nested collections. Existing workbench label/value/detail/Why records retain their semantic presentation. A schema path is not the user-facing label for an entire nested object.
- **Share the material and type systems:** the same system sans-serif stack covers fields, changing values, tables, byte cells and CLI. Light defaults; Dark/System use shared role-owned foregrounds and the accepted deliberate night/page/packet profiles. Primary packet depth and supporting frost remain distinct. Dynamic supporting owners register/unregister with one runtime. Primary resting cache is bounded to four entries; active morphology uses one session and a prepared backing capped at 1,048,576 pixels, subject to DPR/texture limits. These are implementation bounds, not measured hardware performance.

### Evidence, state and interaction contracts

Measured facts retain target, category, availability, unit, observation time, tool, adapter and vantage. Per-fact targets remain explicit in a multi-target report; the entire report is not collapsed into one destination. Invalid local imports retain the previously valid evidence. Asynchronous file results are invalidated after a workspace change. Bridge/reference state controls demonstrate presentation only; they do not probe local services.

Capture exact bytes are immutable copies from the actual parser's `ImmutableBytes`; overlapping bit/byte fields may legitimately share offsets. PCAPNG preserves original resolution and timestamp metadata. The truncated reference preserves 32 captured / 54 original bytes and does not reconstruct missing bytes. Frame/conversation chronology follows source ordering, not a new story invented from repeated SYN records.

Observed edge, destination inference, public origin context and three collector paths retain separate lineage. An explicit gap separates those from an unobserved browser forwarding path. Physical facilities are geography, never hops. The 160 synthetic worker fixtures use published Natural Earth topology from the official D3 repository, decoded locally and projected by official `d3-geo`; coordinates and fixture city names do not describe real infrastructure. AS paths use the actual valley-free evaluator and simulated documentation ASNs. Relationship failure removes real model candidates.

History inspection is read-only and cannot mutate configuration, probes, sites/templates or challenge state. Return to Live restores configuration and layout. Undo/redo journals describe restored facts. Scenario validation fails atomically. A challenge becomes solved only after the actual canonical repair and successful source-model verification, not a selected hypothesis or cosmetic score.

Controls are native and labeled, have approximately 44 px targets, preserve native focus, and keep essential actions available without hover. Captions announce meaningful states, not every frame. Reduced motion lands on useful committed states; it does not autoplay through spatial effects. These contracts are source/runtime evidence; assistive/native focus and physical-keyboard validation remain open.

### Exact package and author audit

| New reference | UTF-8 bytes | SHA-256 |
| --- | ---: | --- |
__REFS__

Author checks: __COUNTS__. The runtime harness executes the complete emitted scripts and actual bundled repository model functions in a synthetic DOM/font/WebGL environment. It covers every TCP/failure source event, canonical commit/loss boundaries, continuous value retention, one carrier through packet layers, construction source consequences, all Builder families/device contexts and mutation/error/history/challenge behavior, all evidence states, all capture bytes, invalid-import retention, projected basemap and AS routing contracts. Geometry/font stubs are not real DOM layout or Apple system-font metrics.

Offscreen compositions use actual emitted packet GLSL and the accepted supporting optical kernel, with analytical page/layout composition and DejaVu Sans substitution. Light and Dark, desktop and compact packet/operations/failure states, Builder source systems/CLI, and the five evidence workspaces were inspected. The audit also checks source hashes and unchanged accepted references. It is not browser screenshot evidence or a hardware frame-rate test. The previous unchanged-source `npm run check` passed application/worker types, model/integration checks and build; this pass did not rerun that baseline merely to repeat it.

**Preview restriction:** automatic review rejected the local browser-preview action. The denial was honored, with no alternate browser execution, loopback server, file/data URL or indirect workaround. Browser compositing/system-font, physical phone, Safari, assistive technology, software keyboard and hardware performance gates remain open. Author audits provide bounded evidence for owner review and do not close G5/G6.

### Owner review order and remaining gates

1. Causal lifecycle: complete TCP run, loss/buffering/fast recovery, FIN/ACK completion; then compact/anatomy and construction's read/modify/append/remove/seat/release. Judge identity, cause, readability, pacing and smooth subcomponents in Light and Dark.
2. Failure Story: break → propagation → recomputation → installed alternate → application recovery. Then DNS/TLS/HTTP/Journey/provider source projections for consistency and density, without interpreting them as every production scenario.
3. Builder: source selection/Workbench, Systems disclosure, actual interface validation/forwarding, CLI, historical locks, authoring undo/paste, broken challenge → inspection → repair → successful verification, scenario rejection/retention.
4. Evidence: per-target measured facts and rejection; PCAP/PCAPNG/truncation/bytes; all reference acquisition states; independent observed paths; synthetic geographic fixture and AS policy/failure. Confirm source/availability remains understandable without opening every detail.
5. Record accepted references and exceptions. Remaining overall entry/Explore composition, Journey modifiers/sharing/sidecars/detail returns, unrepresented alternate protocol outcomes, every nested editing form, large capture windowing/playback and real acquisition flows are tracked design/production tasks. Semantic protocol/layer palette assignments, native environment acceptance and migration scope still require closure.

After owner audit, revise this package as necessary. Production starts only after acceptance of a named baseline and explicit migration authorization; a finished document or passing contract harness is not that authorization.
'''.replace('__REFS__',refs).replace('__COUNTS__',counts)

p=base/'HOPSCOTCH-Design-Specification.md';text=p.read_text();text=text.replace('**Version:** 0.30 · **Date:** 2026-10-03 UTC · **Status:** Mobile router and source-backed workspace references in review; draft implementation handoff prepared','**Version:** 0.31 · **Date:** 2026-10-04 UTC · **Status:** Complete lifecycle/Builder/evidence review package supplied; owner audit and production approval open',1);text=re.sub(r'\*\*Revision scope:\*\*[^\n]+','**Revision scope:** v0.31 supplies the requested isolated lifecycle, full TCP recovery/teardown, complete failure sequence, nested Builder and populated/stateful evidence review package. Accepted optical/motion foundations are preserved. Author audits are bounded; this is review work, not production migration.',text,count=1);p.write_text(text+'\n'+package)

p=base/'HOPSCOTCH-Design-Review-Plan.md';text=p.read_text();text=text.replace('**Version:** 0.26 · **Date:** 2026-10-03 UTC · **Status:** Mobile router and source-backed workspace references in review; draft implementation handoff prepared','**Version:** 0.27 · **Date:** 2026-10-04 UTC · **Status:** Complete requested review package ready for owner audit',1);text=re.sub(r'\*\*Current review package:\*\*[^\n]+','**Current review package:** the accepted resilient references remain the foundation. Three new isolated studies now cover lifecycle/full TCP/failure, Builder and evidence. Review them together using the ordered audit below; full G5/G6 and production migration remain open.',text,count=1)
text+='''
## Complete package owner audit — 4 October 2026 UTC

Specification v0.31 records the exact sources, hashes, behavior and author evidence. These new studies are proposals; earlier acceptance applies to the preserved foundation only. The owner requested all items before his audit, so no production migration was started.

| Review pass | Inspect | Require |
| --- | --- | --- |
| TCP and identity | All 20 events; opening, mid-read, loss, buffered gap, duplicate ACKs, fast recovery, congestion and final FIN/ACK exchange; one compact carrier through anatomy | Same packet identity through transforms; each response visibly constructed separately; state retained before release; no lost packet at receiver; source-accurate outcome |
| Construction | Six packet variants; Version/TTL/destination reader; 96 → 128 → 16 byte payload changes; TTL/checksum consequences; three envelope pieces seating and detaching | Skinny measured-glyph scan, common font, continuous rounded transfer/highlights, content-derived fit, near-contact resistance; no fabricated FCS |
| Failure and protocol comparison | Seven source failure events; DNS cache miss/hit, TLS transcript/state, HTTP stream loss, Journey and provider source projections | Physical break distinct from control knowledge and installed recovery; retained state; comparable stream timing; honest projection/fixture scope |
| Builder | Topology/Workbench compact panes; 13 device references; Config/State/Events/Why; all 12 Systems families; CLI/history/scenario; source challenges | Selected context retained; grouped nested records; errors atomic; historical locks; actual model edits/probes; repaired challenge verified before solved |
| Evidence | All five workspaces × populated/empty/loading/partial/error; report/capture local import and invalid retention; PCAPNG/truncation; synthetic observations/geography; full AS graph and link failure | Source and availability visible; no invented missing bytes/path; independent collector lineage; geographic basemap sourced; readable camera plus exact complete overview |
| App-wide | Light/Dark/System, narrow/wide, enlarged text, rapid selection, theme/resize during playback, reduced motion and failed graphics | Shared typography/foreground/material roles; stable explanations/controls; cancel obsolete work; reusable systems derive geometry/timing without value-length buckets |

Author evidence: __COUNTS__. The native compositions use actual shader pixels with analytical surroundings and a substitute font. The complete emitted scripts run in a synthetic contract environment with the actual repository functions. Neither is a real-browser/native-font/phone verification.

Record each accepted study and any scoped exception. Keep semantic protocol/layer palette decisions and overall entry/handoff/alternate-workflow coverage accountable in the coverage inventory. The current source-backed inspection design does not silently remove production editing capability.

G5 remains open for unrepresented editing/alternate/handoff flows and real environment/accessibility/performance evidence. G6 remains open for owner acceptance of a named baseline and migration scope. Automatic review rejected local browser preview; no workaround was used. Once owner review is complete, address revisions and remaining gates before requesting production authorization.
'''.replace('__COUNTS__',counts);p.write_text(text)

p=base/'HOPSCOTCH-Workspace-Coverage.md';text=p.read_text().replace('**Version:** 0.1 · **Date:** 2026-10-03 UTC','**Version:** 0.2 · **Date:** 2026-10-04 UTC',1).replace('**Status:** Source-backed review inventory; new references await owner review','**Status:** Requested lifecycle/Builder/evidence package supplied; owner/environmental review open',1).replace('GitHub `main` was checked on 3 October','GitHub `main` was checked on 4 October',1)
anchor='| `hopscotch-workspace-references.html` | Shared type/material/inspector/table/byte/evidence treatment across 13 destinations and 121 source-backed frames | New reference snapshots; not complete motion implementations |'
text=text.replace(anchor,anchor+'''
| `hopscotch-causal-lifecycle.html` | Full 20-event TCP and seven-event failure sequences; compact/anatomy identity, six packet variants and computed structural operations; DNS/TLS/HTTP/Journey/provider source projections | New causal review proposal |
| `hopscotch-builder-workbench.html` | Six functional pages, all 12 nested families and source model workbench/edits/probes/CLI/history/authoring/challenge/schema behavior | New source-backed review proposal; not every production editing form |
| `hopscotch-evidence-workspaces.html` | All five evidence workspaces and five reference states; actual local report/capture imports; sourced globe and true AS graph | New review proposal; synthetic observed/physical fixtures explicitly labeled |
''',1)
rows={
'URL Journey':('45 canonical events in the causal study with retained request/source context','Modifiers, sharing/import, sidecars, alternate outcomes and full scale/detail-return composition'),
'Failure Story':('All seven source events animated: break/control knowledge/recompute/alternate install/application recovery; compact missing-route remains distinct','Owner audit and production inspection/control composition; real environment validation'),
'Network Builder':('Functional review study with topology/workbench, all 12 nested families, validated interface change, actual probes/CLI/authoring/history/scenario and challenge repair/verification','Every nested production editing form, broader challenge types, keyboard/touch authoring and long-label environment evidence'),
'Packet Microscope':('One frame carrier through compact travel/anatomy, six family/protocol variants and exact bytes; constructed read/change/append/remove/seating with source checksums','Options/alternate values, complete field-editor production forms, captured context handoff and environment metrics'),
'TCP Theater':('All 20 canonical events with separate object lifecycle, loss/no receipt, buffered ranges, ACK retention, congestion/retransmit/recovery and FIN/ACK completion','Owner audit; alternative scenarios and production controls/environment evidence'),
'DNS Theater':('Canonical miss and cache-hit source projections through shared causal lifecycle, retained cache/TTL/answer','Aging/retry/timeout alternatives, full production controls and handoff'),
'TLS 1.3 Theater':('13 source events and retained transcript/key/certificate/protection state through shared lifecycle','Failed negotiation/certificate alternatives, rich key/record-specific choreography and production handoff'),
'HTTP/2 vs HTTP/3':('10 source events with continuous stream progress/loss/congestion comparison at compact/wide layouts','Owner density/pacing judgment and production controls/environment evidence'),
'AS Routing Theater':('32-node true graph, exact shared port/routing planner, readable camera/full overview, actual valley-free path selection and relationship failure','Leak/BGP projection and cross-workspace handoff; larger fixtures and real browser performance'),
'Physical Internet Atlas':('160 clearly labeled synthetic facilities on published Natural Earth topology through official d3-geo, selection/rotation/detail, five reference states','Real public snapshot/query/fallback lifecycle, density/performance and environment; synthetic fixture is not actual infrastructure'),
'Internet Evidence':('Synthetic edge/destination/origin and three independent collector islands, unobserved forwarding gap, lineage/details and five state references','Real explicit query/collector acquisition controls, service results and production lifecycle'),
'Measured Network':('94 actual adapter facts with per-target scope, freshness/source/availability; real local JSON parsing and invalid retention; five state references and bridge presentation','Actual bridge integration, correlations/large-report/native companion and production clear/replace lifecycle'),
'Capture Replay':('Actual nine-frame PCAP/two-frame PCAPNG plus truncated32/54 reference; conversations/chronology/anatomy/immutable bytes, local file parsing and error retention','Production timed replay/windowing/large-file budgets and microscope-return handoff; repeated SYN fixture is not a coherent TCP exchange')}
lines=text.splitlines()
for i,line in enumerate(lines):
 if line.startswith('|'):
  cells=line.split('|')
  for name,(supplied,remaining) in rows.items():
   if len(cells)==6 and cells[1].strip().startswith(name):cells[3]=' '+supplied+' ';cells[4]=' '+remaining+' ';lines[i]='|'.join(cells)
text='\n'.join(lines)+'\n'
text=text.replace('## Source-derived frame accounting','## Earlier gallery frame accounting — preserved 3 October reference',1)
start=text.index('## Remaining review order');end=text.index('## Source links',start)
text=text[:start]+'''## Remaining review order

1. Audit the complete lifecycle/full TCP/construction/failure study, then the Builder workbench, then the evidence workspaces in Light and Dark. The whole requested sequence is supplied for this owner audit.
2. Record accepted versions and revise concrete issues. Keep semantic palette assignments, overall entry and detail handoffs, alternate protocol outcomes and unrepresented nested editing forms on the broader checklist.
3. Obtain actual browser/system-font/phone/accessibility/performance evidence when the preview restriction is resolved. Offscreen and synthetic checks do not close these gates.
4. Approve a named baseline and explicit implementation scope before production migration. Preserve capability and canonical model/event/playback contracts throughout migration.

## Current package audit — 4 October 2026 UTC

__COUNTS__. Full audit scope, exact reference hashes, automatic-review preview restriction and fixtures are recorded in specification v0.31. The source checkout is unchanged; accepted resilient desktop/mobile references remain exact.

All 12 nested Builder families now have source-backed inspection and a consistent reusable record/disclosure language. Interface/scenario validation, canonical history/probes/CLI, authoring and two challenge repairs are functional against the actual model. This inspection coverage is distinct from authoring every possible OSPF/BGP/NAT/DHCP/provider configuration. Do not delete that production capability because its new form is not yet supplied.

Observed/Physical references are synthetic contract fixtures with explicit labels, not live/public observations. Measured/Capture fixtures use the actual adapters/parsers and preserve original scope/bytes. Real acquisition and production service lifecycle remain separate. Reference-state selectors are review controls, not new product APIs.

'''.replace('__COUNTS__',counts)+text[end:]
# Update nested cells with precise supplied scope without discarding required functions.
updates=[
'Actual shared graph/overview, selection/find, model copy/paste/reconcile, alignment, sites/templates and undo/redo; full drag/edit/distribute/annotation and touch/keyboard forms remain production work',
'All 13 routed/Ethernet references; Config/State/Events/Why selection with measured compact reserve and historical locks',
'Canonical source inspection, actual interface validation/recompute and missing-gateway/static-route challenge repair; every policy/route editor remains to implement',
'Source configuration/state/route Why disclosed consistently; complete protocol-specific edit forms/alternate causal sequences remain open',
'Canonical IPv6 and separately labeled RA/ND/cache/lifecycle fixtures supplied; OSPFv3/PMTU editing and production operations remain open',
'Source VLAN/port/STP/flow/FDB/ARP records, switched device workbench and shared topology selection supplied; full fabric editors remain open',
'Source config/session/lease inspection supplied with shared record grouping; every editing/timer/packet translation motion remains open',
'Separate contract fixture for tunnels/underlay/inner/outer/MPLS/VXLAN/EVPN/MTU/failure; semantic separation supplied, complete provider authoring remains open',
'Actual ping/traceroute and first-broken-boundary/forwarding, hosted service and application history records supplied; all transaction authoring remains open',
'Actual supported command grammar, same-font output and retained errors supplied; completion/history/software-keyboard environment audit remains open',
'Canonical snapshots/read-only locks/configuration comparisons/Why and return to Live supplied; production rewind/timeline detail handoffs remain open',
'Two source broken challenges through inspection/hypothesis/actual repair/verified score; source schema import/export with atomic invalid retention; broader save/delete/restart production lifecycle remains open']
start=text.index('## Builder nested coverage');end=text.index('## Earlier gallery frame accounting',start);chunk=text[start:end];lines=chunk.splitlines();ri=0
for i,line in enumerate(lines):
 if line.startswith('|') and len(line.split('|'))==5 and not line.startswith('| Surface') and not line.startswith('| ---'):
  cells=line.split('|');cells[3]=' '+updates[ri]+' ';lines[i]='|'.join(cells);ri+=1
assert ri==12
text=text[:start]+'\n'.join(lines)+'\n\n'+text[end:];p.write_text(text)

p=base/'HOPSCOTCH-Implementation-Handoff.md';text=p.read_text().replace('**Version:** 0.1 · **Date:** 2026-10-03 UTC','**Version:** 0.2 · **Date:** 2026-10-04 UTC',1).replace('**Status:** Draft migration plan ready for review; production implementation unapproved','**Status:** Complete requested review package supplied; conditional migration plan, production unapproved',1)
text=text.replace('New compact-router and workspace references await review.','New compact-router/workspace references and the complete lifecycle/Builder/evidence package await owner review.',1)
text=text.replace('| Compact packet identity and exact anatomy transition | Continuous compact/open/focused/reassembled forms, broader protocols and real bytes |','| Compact packet identity and exact anatomy transition | New one-carrier/six-variant/construction study supplied; owner and native-environment acceptance required |',1)
text=text.replace('| Broader causal operations | Full recovery/congestion/teardown, insertion/deletion/encapsulation and complete failure/recovery sequences |','| Broader causal operations | Full 20-event TCP, seven-event failure and structural operations supplied; owner audit and unrepresented alternate branches remain |',1)
text=text.replace('| Populated evidence and nested Builder | Source-backed public/physical/evidence states and the full nested inventory; no placeholder treated as a finished workspace |','| Populated evidence and nested Builder | All five evidence state families and 12 Builder inspection families supplied; synthetic source labels explicit; real acquisition/every production editor still require implementation |',1)
text+='''
## Complete review package handoff additions — 4 October 2026 UTC

The requested all-at-once review set is ready for owner audit: causal lifecycle/full TCP/failure, Builder and evidence. Specification v0.31 contains exact hashes and behavior; coverage v0.2 distinguishes supplied inspection/interaction evidence from remaining production editing/acquisition/handoff workflows. __COUNTS__ passed with the documented synthetic/offscreen limits. No repository file, event/model/protocol reducer or production playback logic was modified.

Carry these adapter boundaries into any authorized implementation:

| Shared system | Semantic input | Computed output and lifecycle |
| --- | --- | --- |
| Packet lifecycle | Identity, sender/receiver, canonical event/outcome, exact fields/bytes and operation intent | Measured compact/anatomy forms, one carrier across layer focus, loss/receipt/retain/release stages, exposure budget and reflow-preserved position |
| Structural operation | Previous/next source snapshots and semantic attach/detach/modify/append/remove | Actual glyph transfer/receiver blend, payload chunk regions, dependent source lengths/checksums, measured envelope size and geometry-derived near-contact resistance |
| Nested inspector | Primitive facts, record identities, collections and existing semantic workbench records | Meaningful computed headings, grouped facts, expandable depth, retained Why chains; no path-label flattening or per-system bespoke layout |
| Compact inspection | Active content, alternate pane content, selected context and actual width/font metrics | Measured maximum reservation, stable caption/control nodes, deliberate pane selection and invalidation |
| Network | Exact canonical nodes/links, measured labels and optional authored positions | Accepted bounded placement/port/path audit, camera at readable scale, exact complete overview, stable DOM on camera/selection and obsolete-plan cancellation |
| Evidence | Original report/capture/observation/facility/AS context and explicit acquisition/state | Source/vantage/availability/target/time remain attached, immutable captured bytes, genuine policy candidates, separate independent collector islands, published geometry projected locally |
| Material owner | Surface role, appearance, active rounded geometry, capability and visibility | Shared foregrounds/kernel, one prepared primary session, bounded resting cache/backing, dynamic record registration/removal, resting idle and coherent fallback |

Do not migrate the synthetic DOM harness, analytical font assumptions or native audit composition into product layout. The product reads actual DOM/canvas metrics at invalidation boundaries and renders from its cached plan. Hardware profiling and browser/phone/font/assistive validation are required before declaring these adaptations production-ready.

The review fragments deliberately do not issue remote measurement/bridge/collector/physical requests. Production acquisition continues to use the existing authorized request/event/service contracts. Preserve file cancellation, valid-result retention, honest missing bytes, and original timestamps/units/provenance. Synthetic fixture records must never become real observations in product labels.

Migration remains conditional on owner acceptance of a named baseline, agreed exceptions, outstanding workflow/environmental gates and explicit production authorization. Automatic review rejected local browser preview and that restriction was honored. The owner can now audit the complete supplied package before deciding its next scope.
'''.replace('__COUNTS__',counts);p.write_text(text)
print(json.dumps({'versions':['0.31','0.27','0.2','0.2'],'files':[{'path':str(p.resolve()),'bytes':p.stat().st_size} for p in [base/'HOPSCOTCH-Design-Specification.md',base/'HOPSCOTCH-Design-Review-Plan.md',base/'HOPSCOTCH-Workspace-Coverage.md',base/'HOPSCOTCH-Implementation-Handoff.md']]}))
