# Track A — Builder time machine foundation

Track A starts by making time a first-class inspection axis for Network Builder without turning historical inspection into another simulator.

## Canonical event clock

The existing deterministic Builder event journal remains the event identity source. Root Builder actions advance a deterministic logical clock; derived model events may carry finer logical offsets or, when a protocol model owns real teaching timers such as OSPF convergence, exact model timestamps. This is explicitly **not wall-clock time** and must not be interpreted as measured network latency.

After React commits the state changes associated with an event, the Builder captures one immutable snapshot of the complete workbench input truth: routed graph/addressing/routing, IPv6 state, Ethernet/VLAN/STP state, ACL/NAT/DHCP configuration and runtime tables, probes, and source/destination context. The event journal itself is stored separately so historical views cannot see future events.

Snapshots are session-only and bounded to the same 160-event horizon as the event journal. They are not serialized into scenario JSON.

## Historical inspection

The Builder sidebar now has a time-machine control with:

- deterministic logical event time,
- event summary and category,
- scrubber,
- previous/next stepping,
- replay across captured snapshots,
- explicit return to `LIVE`.

Historical mode is read-only. It projects an immutable past snapshot into the existing Device Workbench; it does not rewrite the live Builder state or silently fork the scenario. Any real Builder action returns the inspector to `LIVE` before recording the new event.

The workbench device selector is also historical: a device that existed at the selected event is inspected from that event's graph/fabric rather than from today's device list.

## Before / after diffs

For a historical event, the workbench derives a deterministic diff against the immediately preceding captured event. CONFIG and STATE rows are compared by stable section/row identity and expose added, removed, and changed values.

This covers the workbench projections for route/RIB/FIB state, OSPF/OSPFv3/BGP state, ARP/ND, FDB/STP, NAT translations, DHCP leases/effective addressing, policy decisions, probes, interfaces, and persisted configuration.

## Synchronized scene projection

The second Track A slice promotes the selected timeline snapshot from a Device Workbench-only projection to the render source for the entire Network Builder scene. The routed topology canvas, failed/restored links, weighted route, L3 forwarding overlay, policy result, probe snapshot, Ethernet/VLAN/STP/ARP view, route tables, OSPF/OSPFv3/BGP panels, ACL/NAT/DHCP state, IPv6 state, and Device Workbench consume one selected immutable scene state.

Layout and link-characteristic truth are captured alongside the workbench model so a historical device can reappear at its historical position and a historical link can recover its prior physical characteristics. UI selection remains a camera concern: if the currently selected object did not exist at that event, inspection falls back deterministically to an object that did.

Historical mode is read-only across the Builder. Authoring controls are disabled, node dragging/deletion is disabled, and the scene is visually marked as historical. Returning to `LIVE` restores the mutable current state; scrubbing never writes a snapshot back into live configuration.

## Canonical event granularity

The third Track A slice stops treating one Builder UI message as the smallest unit of history. A committed Builder action remains the root event, then deterministic derived events are emitted from the canonical model delta for the truths that actually changed: physical topology, OSPF control-plane stages, RIB/FIB selection, BGP state, STP, ARP/ND/NUD/DAD resolution, NAT translations, DHCP leases, IPv6 control/lifecycle state, routed probe forwarding, Layer-2 forwarding, and terminal flow outcomes.

Timed OSPF link failure reuses the existing Lab 11M convergence model, including Hello/dead-timer, adjacency, LSA, SPF, RIB, FIB, and traffic-recovery events. The Builder event clock accepts those model timestamps instead of pretending every event is exactly one second apart. Probe/LAN events are derived from the already-computed forwarding and resolution results; they never recalculate a second answer.

One React commit can therefore append several timeline events. Ordinary derived events share one immutable post-action state snapshot unless a protocol family declares a narrower runtime projection boundary. Timed OSPF allocates a new lightweight scene-state shell only when a truth dimension actually advances, while the large unchanged Builder state remains structurally shared.

For timed OSPF link failure, physical topology, control-plane knowledge, RIB selection, and FIB forwarding each have an independent historical graph. LINK DOWN can therefore show carrier loss while the neighbor is still FULL and stale forwarding remains installed; DEAD TIMER EXPIRED advances control-plane truth and the same-instant ADJACENCY DOWN event observes that state; RIB UPDATED advances route selection while the FIB is still stale; and FIB UPDATED finally advances forwarding. The main canvas, OSPF state, route table, policy trace, forwarding overlay, and Device Workbench consume the appropriate truth dimension rather than collapsing all four into the final topology.

DHCP is another protocol family with native intermediate state. A successful acquisition is replayed through the existing deterministic Builder DHCP model from the pre-action snapshot and expanded into separate DISCOVER, OFFER, REQUEST, and ACK events. DISCOVER/OFFER/REQUEST retain the pre-lease state; ACK is the explicit lease and deterministic-sequence boundary, so effective host IPv4/gateway/DNS state cannot appear before the server ACK. Renewal/rebinding transactions use the same model replay path when their committed lease matches canonical truth. Failed acquisition/renewal attempts retain model-native DISCOVER/TIMEOUT/EXPIRE evidence; the last emitted model event carries terminal failure context, while eventless failures get an explicit FAILED event. RELEASE removes only the released lease at its own event boundary.

Deterministic DHCP clock jumps are staged rather than collapsed into the final sequence. Crossing T1 or T2 produces separate lifecycle events at the exact lease sequence while the lease remains active; advancing past the inclusive expiry boundary produces an EXPIRE event that removes only that lease and immediately returns effective host IPv4 to unconfigured. A later clock event carries the final requested sequence when necessary. The live DHCP panel prunes expired leases on clock advance, so live runtime truth and historical truth cannot disagree about an expired address. Historical DHCP inspection renders the selected timeline stage instead of leaking the live panel's last-transaction card into the past.

## Track A closeout — protocol state + causal troubleshooting

The closeout extends those rules to the remaining active-roadmap depth without creating a troubleshooting simulator alongside Builder.

### Time-native runtime families

ARP cache state, Ethernet flow/FDB state, NAT sessions, IPv6 control/lifecycle state, probe history, and application transaction history now have explicit event-time projection boundaries. Before the corresponding canonical event, the historical snapshot retains the prior runtime table; once the boundary is reached, the selected snapshot exposes the committed canonical state. Protocol families with meaningful internal stages—OSPF convergence, DHCP transactions/lifecycle, and application transactions—retain per-stage projections rather than leaking their terminal result backward.

Device Workbench adds compact **PROTOCOL DATABASES / COUNTERS** rows derived from the selected snapshot. Routed devices summarize OSPF neighbor/LSDB/RIB depth, independent OSPFv3 state, BGP session/path/best-path depth, and ND/NAT/probe runtime tables. Ethernet devices summarize STP VLAN participation, FDB, ARP, and DHCP runtime depth. These rows are derived views only; they do not create protocol state.

### Application transaction replay

Track D remains the application/network behavior authority. A completed Track D transaction is returned to Builder as bounded session history and expanded into canonical events for every stage that was actually evaluated. Addressing/service intent, L2/resolution, FIB, policy/NAT, link behavior, transport, TLS/QUIC crypto, application service, and response become ordered events in the same Builder clock.

A historical application snapshot carries an explicit visible-through stage. Scrubbing to ROUTING therefore leaves POLICY, TRANSLATION, TRANSPORT, TLS, APPLICATION, and RESPONSE as `NOT_REACHED`; the eventual success or failure cannot leak backward. The terminal evaluated stage clears that partial-stage marker and exposes the completed canonical transaction.

### Independent truth dimensions

Track A projects a transaction into independent diagnostic dimensions:

- host addressing,
- service/DNS intent,
- physical reachability,
- Layer-2 forwarding,
- next-hop resolution,
- route/FIB selection,
- policy permission,
- translation state,
- data-plane link behavior,
- transport,
- TLS/QUIC crypto,
- application service,
- return path/response.

`NOT_REACHED` is not failure. IPv6 translation is explicitly `NOT_APPLICABLE` when policy passes because Builder does not invent NAT66. Combined Track D stages are split only where existing canonical evidence supports the distinction—for example policy denial versus translation failure and L2 access versus ARP/ND resolution.

The first failing independent dimension becomes **FIRST BROKEN TRUTH BOUNDARY**. Device Workbench exposes the same ordered causal chain through its existing `WHY?` mechanism, so a user-visible application failure can be followed backward through the layers that actually passed until the first one that did not. Later dimensions remain `NOT_REACHED` rather than being mislabeled as additional failures.

The application workspace also shows a compact Track A diagnosis summary beside the Track D transaction cameras. It is a projection of the same transaction, not a second execution path.

### Truth boundary

Track A diagnosis never reruns routing, forwarding, ACL/NAT, transport, TLS, or application behavior. It consumes canonical Track D stages plus the selected Builder topology/runtime snapshot. Animation, UI state, natural-language wording, and future AI explanation cannot decide the outcome or replace `firstBrokenBoundary`.

Application transaction history remains session-only and bounded to 24 completed transactions. It is not added to scenario JSON and therefore does not change the persisted scenario schema.

### Permanent acceptance contract

`test:builder-causal-diagnosis-contract` is registered in `npm run check` and permanently verifies:

- independent truth-dimension success,
- exact first-broken policy diagnosis,
- policy versus translation separation,
- IPv6 `NO NAT66` semantics,
- partition failure before transport,
- stage-limited diagnosis with no future-result leakage,
- one canonical application event per evaluated Track D stage,
- deterministic application event causality,
- stage-by-stage timeline snapshots,
- historical Device Workbench behavior before and at the first broken boundary,
- protocol database/counter projection in Device Workbench.

**Track A is complete when this contract, the existing Builder timeline/canonical-event contracts, repository CI, production performance budgets, and browser compatibility matrix are green on the final closeout head.**

## Roadmap handoff

Track A closes the simulator's time/causality integration gap. The active roadmap now promotes **Track B — Builder authoring environment** as the next product priority; its authoring operations must continue to mutate the same canonical Builder configuration consumed by this time machine rather than introduce an editor-only state model.
