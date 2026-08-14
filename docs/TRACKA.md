# Track A — Builder time machine foundation

Track A starts by making time a first-class inspection axis for Network Builder without turning historical inspection into another simulator.

## Canonical event clock

The existing deterministic Builder event journal remains the event identity source. Each canonical event receives a logical timestamp derived only from its monotonic event sequence (`1 event = 1000 ms` on the teaching clock). This is explicitly **not wall-clock time**.

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

The next Track A depth is event granularity: promote control-plane transitions, forwarding decisions, resolution changes, and flow outcomes into explicit canonical events rather than only snapshotting after the higher-level Builder actions that currently generate the session journal.
