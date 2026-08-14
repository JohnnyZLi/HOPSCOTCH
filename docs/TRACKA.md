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

This already covers the workbench projections for route/RIB/FIB state, OSPF/OSPFv3/BGP state, ARP/ND, FDB/STP, NAT translations, DHCP leases/effective addressing, policy decisions, probes, interfaces, and persisted configuration. Counters and protocol databases that are not yet fully represented as time-native workbench rows remain future Track A depth.

## Synchronized scene projection

The second Track A slice promotes the selected timeline snapshot from a Device Workbench-only projection to the render source for the entire Network Builder scene. The routed topology canvas, failed/restored links, weighted route, L3 forwarding overlay, policy result, probe snapshot, Ethernet/VLAN/STP/ARP view, route tables, OSPF/OSPFv3/BGP panels, ACL/NAT/DHCP state, IPv6 state, and Device Workbench now consume one selected immutable scene state.

Layout and link-characteristic truth are captured alongside the workbench model so a historical device can reappear at its historical position and a historical link can recover its prior physical characteristics. UI selection remains a camera concern: if the currently selected object did not exist at that event, inspection falls back deterministically to an object that did.

Historical mode is read-only across the Builder. Authoring controls are disabled, node dragging/deletion is disabled, and the scene is visually marked as historical. Returning to `LIVE` restores the mutable current state; scrubbing never writes a snapshot back into live configuration.

## Canonical event granularity

The third Track A slice stops treating one Builder UI message as the smallest unit of history. A committed Builder action remains the root event, then deterministic derived events are emitted from the canonical model delta for the truths that actually changed: physical topology, OSPF control-plane stages, RIB/FIB selection, BGP state, STP, ARP/ND/NUD/DAD resolution, NAT translations, DHCP leases, IPv6 control/lifecycle state, routed probe forwarding, Layer-2 forwarding, and terminal flow outcomes.

Timed OSPF link failure reuses the existing Lab 11M convergence model, including Hello/dead-timer, adjacency, LSA, SPF, RIB, FIB, and traffic-recovery events. The Builder event clock now accepts those model timestamps instead of pretending every event is exactly one second apart. Probe/LAN events are derived from the already-computed forwarding and resolution results; they never recalculate a second answer.

One React commit can therefore append several timeline events. Ordinary derived events still share one immutable post-action state snapshot. Timed OSPF is the first event family to go deeper: the timeline allocates a new lightweight scene-state shell only when a truth dimension actually advances, while the large unchanged Builder state remains structurally shared.

For timed OSPF link failure, physical topology, control-plane knowledge, RIB selection, and FIB forwarding each have an independent historical graph. LINK DOWN can therefore show carrier loss while the neighbor is still FULL and stale forwarding remains installed; DEAD TIMER EXPIRED advances control-plane truth and the same-instant ADJACENCY DOWN event observes that state; RIB UPDATED advances route selection while the FIB is still stale; and FIB UPDATED finally advances forwarding. The main canvas, OSPF state, route table, policy trace, forwarding overlay, and Device Workbench consume the appropriate truth dimension rather than collapsing all four into the final topology.

DHCP is now the second protocol family with native intermediate history. A successful acquisition replays the existing deterministic DHCP model from the pre-action snapshot and emits DISCOVER → OFFER → REQUEST → ACK as separate causal events, including the canonical local/relay path. DISCOVER/OFFER/REQUEST share the pre-lease state; ACK alone advances the lease table and deterministic DHCP sequence, so the DHCP panel and Device Workbench do not show an address before the ACK boundary. Renewal/rebinding uses the same replay path when a deterministic changed lease matches the existing model.

This is still the event-granularity foundation, not the claim that every protocol database is fully time-native yet. Full protocol-database row diffs/counters, DHCP failure/expiry episode depth, and equivalent per-stage historical projection for the remaining non-OSPF protocols remain follow-on Track A depth.
