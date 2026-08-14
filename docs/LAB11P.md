# Lab 11P — Device CONFIG / STATE / EVENTS

Lab 11P turns the Network Builder's selected device into a causal workbench. It does **not** introduce another simulator, another routing table, or a vendor CLI shadow model. The workbench is a projection over configuration and runtime state that already drive Builder behavior.

## Three explicit truth classes

### CONFIG

CONFIG is canonical, persisted scenario truth. The workbench projects the configuration that already belongs to the device:

- routed IPv4 and IPv6 interfaces and endpoint default routers,
- static IPv4 and IPv6 routes,
- OSPF / OSPFv3 participation and areas,
- BGP ASN, sessions, originations, and policy,
- IPv4 and IPv6 ACL policy,
- NAT boundaries and static mappings,
- Ethernet device identity, access/trunk VLAN configuration, and STP settings,
- DHCP client, pool, and relay configuration.

Editing still happens through the existing Builder controls. The workbench is intentionally read-only so there is one canonical authoring path and one canonical configuration model.

### STATE

STATE is derived or session runtime truth. It is never written back into scenario JSON merely because the user inspected it. The workbench can project:

- IPv4 and IPv6 RIB/FIB entries from the same route-table functions used by active forwarding,
- OSPF neighbors and self-originated LSDB advertisements,
- timed, multi-area OSPFv3 neighbor state and the same route overlay used by IPv6 forwarding,
- BGP session state and the deterministic BEST RIB entries,
- IPv6 Neighbor Discovery cache state,
- ARP cache entries,
- switch FDB entries from the current Ethernet flow,
- per-VLAN STP root/port state,
- NAT translations,
- DHCP leases and the effective host IPv4 configuration produced by those leases,
- the current ACL decision and probe snapshots involving the selected routed device.

DHCP now feeds the LAN data plane through the effective runtime Ethernet view: a DHCP client with no ACK has `0.0.0.0`; after a lease ACK, ARP and Ethernet flows consume the leased address/gateway state. The persisted Ethernet interface configuration remains separate.

### EVENTS

EVENTS is a bounded, deterministic session journal. Every Builder status transition recorded through the shared message boundary becomes a monotonically sequenced event. Events use logical sequence numbers rather than wall-clock timestamps, so identical interaction order produces identical event ordering.

Events are classified as topology, configuration, routing, policy, neighbor, switching, NAT, DHCP, probe, or IPv6 activity. Runtime events link to the most recent relevant upstream configuration/topology/control event when one exists. The journal is not stored in schema-v9 scenario JSON.

## Deterministic WHY chains

Inspectable state rows expose structured `WHY?` chains. These chains are assembled from model relationships, not generated prose or AI inference. Examples:

- a route points back to its connected/static/OSPF/BGP source, route-selection precedence, and outgoing link state;
- an OSPF or OSPFv3 adjacency points back to protocol enablement, physical link state, area/timer state, and the resulting adjacency reason;
- a BGP BEST route points back to the learned session, attributes, deterministic best-path explanation, and policy anomaly state;
- an ARP/ND entry points back to the resolution exchange and its VLAN/link scope;
- an FDB entry points back to source-MAC learning in the observed Ethernet flow and its VLAN scope;
- a NAT translation points back to the configured boundary/mapping and its sequence lifetime;
- a DHCP lease points back to its pool, ACK/renew sequence, and lease timers;
- an ACL decision points back to the routed flow crossing the device and the exact first-match/default rule.

This keeps explanation downstream of canonical truth: the explanation can never decide forwarding or protocol state.

## Device coverage

The selector contains both routed-graph devices and the separate Ethernet teaching fabric. Clicking a routed node selects its routed workbench entry; clicking a LAN endpoint, switch, or router selects its Ethernet workbench entry. The two planes stay separate instead of pretending the routed `/30` graph and the VLAN switching fabric are one physical topology.

The workbench is omitted from the synthetic stress Builder so the historical high-density DOM contract continues to measure the same topology surface rather than sidebar inspection chrome.

## Persistence boundary

Schema v9 remains unchanged. Scenario serialization continues to contain configuration only. ARP/ND caches, FDB entries, NAT translations, DHCP leases, probe history, IPv6 lifecycle/control observations, and the Lab 11P event journal remain session-only.

## Deferred historical state

Lab 11P establishes the per-device CONFIG / STATE / EVENTS projection and causal object model, but it does not fabricate historical snapshots. Inspecting a device at an arbitrary past Builder timestamp remains part of the Builder-wide time-machine track. When that lands, historical workbench views should replay the same canonical reducer/event model rather than maintaining independent snapshots inside the workbench.

## Performance boundary

The workbench is deliberately not instantiated or derived inside the synthetic stress Builder. The normal product bundle grows because Lab 11P adds the structured projection model, causal explanations, event journal, and inspection UI; the enforced production ceilings move narrowly from 410,000 to 424,000 JS gzip bytes and from 33,500 to 34,500 CSS gzip bytes. DOM and heap ceilings are not relaxed for the feature.
