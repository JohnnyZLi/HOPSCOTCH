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

## Truth boundary

This first slice does **not** claim that the entire Builder canvas has been rewound. The topology canvas and authoring controls remain the live system while the Device Workbench is in historical inspection mode. The UI states that boundary directly.

The next Track A slice should promote remaining control-plane transitions and forwarding decisions into explicit canonical events, then let the main Builder scene render from the same selected historical snapshot so the entire workspace—not only the workbench—becomes a synchronized time projection.
