# HOPSCOTCH — live visual, animation and code audit

8 October 2026 · Private design review · **Not ready for production approval**

The audit found real defects that previous static and synthetic checks missed. Shared fixes have been implemented and checked in the managed Chrome preview. Larger composition and protocol-presentation failures remain open. This report supersedes earlier broad claims that everything was visually audited or complete.

## Confirmed repairs

| Finding | Reusable correction | Verification |
| --- | --- | --- |
| Old and new caption text overlap during handoffs | Shared status controller finishes the outgoing fade before the incoming fade; replacement cancellation and reduced motion retain their existing lifecycle | Live settled Ping result and protocol captions; emitted-runtime interruption and cleanup checks |
| Compact labels appear over expanded packet fields while closing | Derive mutually exclusive compact/expanded text opacity and visibility from current detail progress; sequential layer-focus text handoff | Live TCP construction, reading and release; packet layer inspection; runtime sampled intermediate poses across seven families and four widths |
| DNS reader spends time on absent values | Filter scan targets from actual available source values; preserve zero and false | Live narrow dark referral scans delegation/record values rather than dashes; runtime target/source checks |
| Final local outcomes leave an empty stage | Final local outcomes end at a readable hold; real wire buffers still release. DNS complete-phase is classified as an outcome rather than a duplicate reply | Actual final DNS, TLS, provider and Journey screens; runtime final-local and final-physical-ACK contracts |
| Hidden or narrow map resizing loses the visible selection | Shared resize logic ignores zero dimensions and unchanged dimensions; on a real resize, minimally retain a previously visible measured anchor | Browser narrow map with APP revealed; runtime visible-anchor, deliberate-offscreen, zero-size and same-size contracts |
| Connected Journey rushes through source events | Cached content-derived presentation timeline stretches reading intervals while mapping seeks and return anchors to canonical source time | Live 22-second narrow-dark sample: early events receive roughly 2–3 seconds each; paused detail return restores canonical 4027 ms; all scenario presets checked in runtime |
| TLS cipher identifiers split into narrow fragments | Wider primary fact columns plus full-row promotion from measured unbroken text, independent of protocol/field names | Actual desktop light/dark and narrow dark TLS screens |
| Narrow outer review navigation wraps unpredictably | One horizontally scrollable, nonwrapping navigation row | Actual 390 px screens; native scrollbar remains a minor polish consideration |
| Nested CLI record output becomes one paragraph | Shared scalar renderer preserves source line breaks and gives multiline records a full row, retaining the same font | Actual 390 px light before/after; exact source text preserved in runtime |
| Connected microscope highlights only one byte of a selected field | Apply the existing field-range emphasis to all visible bytes from decoded byte ranges | Actual dark 390 px Destination MAC: offsets 0–5 highlighted, byte 0 remains the active selection; runtime range membership checks |

The earlier focused audit also corrected scanner/carrier coordinate origins, duplicate inspection before transmission, numeric-transfer origins and stale payload transforms. Those fixes were exercised again here; they are not a substitute for the unresolved design work below.

## What still blocks acceptance

### P1 — Scene, controls and retained state do not fit together

TLS reserves the maximum card height across its sequence. Small Finished and final-state cards sit inside large empty reservations. Packet construction similarly creates a tall scene, especially at 390 px. TCP numbers transfer into retained state beneath the console, frequently outside the visible scene. At that moment the user sees a number leave without seeing where its meaning lands.

Code cause: lifecycle `reflow` plans around maximum frame height, then places console and retained-state sections after the stage. Correct coordinates alone cannot repair an offscreen destination.

Required next design: a shared viewport-budgeted composition that allocates the primary object, dependable controls/explanation and a visible state destination together. Dense inspectors need a deliberate focus/continuation composition. Do not shrink the common font or place a large overlay console over packet content. Preserve canonical state updates independently of how much detail is visible.

Acceptance: at 320, 390, 1024 and 1440 px, play construction → read → retain → release without scrolling to understand the current operation. Every visible numeric transfer must arrive at a visible labelled destination. Reflow must preserve event identity and reading progress.

### P1 — Generic metadata hides protocol behavior

Journey repeatedly displays “URL dependency event” and Protocol / Actor / Target / Scale fields. TCP assembly, IPv4 wrapping, NIC serialization and Ethernet attachment are described in captions but represented by generic local cards. Journey DNS queries/referrals/answers are classified as local operations because the wire-kind list recognizes only four kinds. TCP congestion changes also display Sequence / Acknowledgment / Flags / Data length instead of the actual congestion-state change. TLS final state shows Protection / Actor / Phase rather than a clear authenticated-channel outcome.

Code cause: generic normalized field fallbacks and a small hard-coded wire-kind list in `sourceFrameAdapter`.

Required next design: typed presentation adapters with explicit capabilities for wire exchange, local decision, assembly, encapsulation and retained result. Project actual source payload/state; avoid inventing bytes, headers or secrets where the source provides only a semantic event. Shared geometry and motion then consume those capabilities. Local before/after state should show the relevant changed values.

Acceptance: the scene alone identifies what was sent, read or changed; DNS wire exchanges travel between their peers; local operations do not impersonate packets. Test clean and failure/loss variants against actual source event identity.

### P1 — Provider captions promise physical operations the scene does not show

“An outer envelope attaches” replaces the inner-packet card with a GRE envelope card. The inner packet does not visibly remain enclosed. MPLS push/swap/pop is rendered as operation rows to scan, rather than label operations around a preserved payload. The corrected final underlay-failure result stays visible, but does not solve this causality gap.

Required next design: preserve inner object identity while a separate outer envelope approaches and seats; apply the approved contact law. Represent labels as separate envelopes with source-backed push/swap/pop. Distinguish absent byte data from semantic encapsulation rather than fabricating packet contents.

Acceptance: pause anywhere during wrapping/unwrapping and still identify the inner packet. Label changes must follow the source LFIB operations, and MTU/underlay failure must prevent a false successful delivery.

### P1 — Connected entries are not complete integrated workspaces

All thirteen entries were opened. Several are explicitly reference projections: HTTP comparison has a title/summary card without the reviewed two-lane behavior; AS/physical/measured entries show source facts or empty states, with detailed interactions supplied only by companion studies. The footnote says this accurately. These entry screens cannot be treated as completed production coverage.

Required next design: connect each route to the approved reusable workspace behavior, or explicitly define the remaining integration work in the migration scope. Keep one source-time/selection handoff and exact return anchor; do not implement a second copy of the animation model.

Acceptance: route from overview/catalog and from Journey, use the actual workspace controls, return with exact event/time/selection intact, and repeat on narrow panes and in both themes.

### P2 — Dense record presentation needs another editorial pass

Preserving CLI line breaks fixes flattening, but raw proportional-text columns still wrap on narrow screens. Existing structured command results are clearer. Builder system records use deeply nested disclosures and generic item titles in some views. Source field names containing underscores remain on some Connected reference cards. These are readability/hierarchy refinements, not grounds for another per-field font or theme.

Use the existing semantic label and structured table/row systems where the source supplies schema. Keep raw source output available as evidence. Avoid guessing table columns from arbitrary text.

## Actual browser coverage

This was a broad family audit, **not every permutation**. The browser ran Chrome in the managed preview. Narrow widths are desktop Chrome iframe compositions, not physical iPhone/Safari emulation. Screenshot sampling can miss sub-frame defects. Screenshots captured immediately after actions sometimes contain the previous compositor frame; settled follow-up observations were used before treating a contrast/layout issue as persistent.

| Area | Actually inspected | Limits |
| --- | --- | --- |
| TCP lifecycle | Light desktop playback sample; dark 2× construction, receipt, scalar reading, ACKs, loss/retransmit/recovery and teardown samples through completion | Long run split into observation batches with gaps; retained-state targets remain offscreen. Not a continuous every-frame recording |
| Packet anatomy | Moving dark 390 px Ethernet → IPv4 → TCP inspection; completed payload view; layer text transition check | Completion arrived between observation batches; not every variant/layer field continuously watched |
| Packet build/modify | Full short dark desktop 1× study recorded: attachment, Version/TTL/destination read, TTL/checksum changes, append, removal and detachment | Other family/transport combinations remain platform acceptance work |
| Failure and HTTP comparison | Complete short 1× light desktop studies recorded, including recovery and loss divergence | Additional mobile variants not all played continuously |
| DNS | Narrow light/dark playback samples, referral target recheck, completed retained outcome | Cache-hit/expiry alternatives not fully watched this round |
| TLS | Dark desktop moving samples, long cipher fields, Finished and final outcome; completed dark 390 px result | Maximum-height composition failure remains; full narrow handshake not continuously watched |
| Lifecycle Journey | Five narrow-dark 2× observation batches across the clean request sequence; final outcome | Gaps between batches; generic semantic presentation remains; failure variants not all visually audited |
| Provider | Dark desktop moving samples across inner/GRE/MTU/MPLS/underlay outcome; narrow dark final recheck | Encapsulation storytelling fails acceptance |
| Builder | All six tabs; all twelve system families; dark desktop and light/dark narrow views; ping, CLI result, history, broken challenge, repair and verified ping; map selection; disclosures | Not every authoring command, schema record or user input was exhaustively exercised visually |
| Evidence | All five workspaces across populated/empty/loading/partial/error in light/dark desktop/390 px matrix; settled scene/details follow-ups; 320 px dark measured scene/details | Matrix contains transition snapshots as well as settled images. Physical device/globe interaction performance unverified |
| Connected | Overview/catalog and all thirteen entry workspaces; light/dark desktop/narrow samples; Journey playback/detail return; capture → microscope → capture; field/byte selection | Several entries are intentionally static reference projections. Catalogue narrow completeness and all route combinations not exhaustive |

Evidence is actual browser imagery, not generated mockups or synthetic screenshots. The archive contains curated stills, sampled playback sequences and observation status/timing logs. Sampling gaps are preserved, not filled with invented frames. Functional reports are labelled separately.

## Code and functional verification

Affected emitted scripts were executed in a synthetic DOM/font/WebGL contract environment. These checks complement browser inspection; they do not certify CSS compositor behavior, real platform fonts, assistive technology or hardware performance.

- Shared pacing/camera/caption regressions: 18,830 assertions, including canonical boundaries, monotonic seeking, source immutability and cancellation.
- Animation readability regression: 125,546 checks across seven motion families and widths 320/390/1024/1440, including intermediate compact/expanded visibility, valid scan targets, local outcome retention and physical ACK release.
- Related-motion regression: 28 scene/width cases covering visible boundaries, seek-history invariance, payload cleanup, repeated Play, Pause and source preservation.
- Shared Builder regression: 447 checks across five widths.
- Connected regression: 35,464 assertions across five widths after field-range emphasis; exact source range membership and return context checked.

The exact emitted artifact hashes and source fixture/domain hashes accompany the report. Simulation source events, bytes and canonical timestamps are not rewritten by the presentation repairs. Production repository/application deployment remains untouched; changes are confined to the private design review.

## Design assessment and next sequence

The approved colorful packet optics, distinctive dark palette, consistent field font, skinny content-following reader and flush-seated separate pieces remain strong. Many empty/error/evidence screens also communicate source boundaries clearly. The remaining problems are structural: predictable composition, visible destinations and semantic object identity. Extra gradients, blur or decorative motion would not address them.

Next work should proceed in this order: (1) prototype the reusable bounded scene/control/state composition in TCP and dense TLS; (2) define and apply source-backed semantic adapters to Journey/local decisions; (3) model preserved inner identity for GRE/MPLS; (4) integrate Connected routes with companion behaviors; (5) repeat moving browser audits, including interruptions, seek/replay, theme/width changes and long variants. Physical Safari/iPhone and assistive-technology checks remain separate acceptance gates before production migration.
