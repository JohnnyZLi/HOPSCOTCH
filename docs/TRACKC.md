# Track C — enterprise Layer 2 / Layer 3 closeout

Track C deepens Network Builder from the Lab 11 Ethernet teaching fabric into a bounded enterprise LAN/L3 environment without creating a second network simulator.

## Product boundary

Track C extends the existing canonical Builder Ethernet configuration. Devices, physical links, VLAN membership, interface addressing, spanning-tree configuration, physical failure state, and enterprise L3 configuration remain one configuration graph. Enterprise views derive from that graph; they do not maintain independent protocol truth.

The scenario schema remains **v9**. New enterprise fields are additive and older scenarios retain their existing behavior.

## Canonical configuration added by Track C

The existing Ethernet model now admits:

- Layer-3 switches in addition to endpoints, Layer-2 switches, and routers,
- switched access/trunk links plus routed ports,
- optional trunk native VLANs,
- optional logical bundle identifiers and `lacp` / static bundle mode,
- SVI/interface VRF membership,
- virtual first-hop gateway and priority metadata,
- routed-port endpoint addresses, prefix length, and VRF,
- explicit VRF-scoped static routes.

`cloneBuilderEthernetConfig` uses a deep structured clone for the plain-data configuration and then normalizes spanning-tree defaults. Undo/redo, authoring branches, scenario restoration, and future additive Ethernet fields therefore cannot accidentally share nested mutable configuration objects.

## RSTP

Classic STP remains supported. Track C adds an RSTP projection over the same per-VLAN loop-free tree used by Ethernet forwarding.

The RSTP surface exposes:

- root, designated, alternate, edge, bundle-member, and down roles,
- discarding, learning, forwarding, and down states,
- deterministic failure/re-role/learning/forwarding events,
- a bounded **400 ms teaching convergence** for a simple redundant-link RSTP failover,
- a **30 s teaching transition** for the equivalent classic-STP comparison.

Those times are deterministic product semantics for causal visualization; HOPSCOTCH does not claim to emulate every vendor timer, BPDU field, topology-change optimization, or implementation-specific convergence path.

Track C also corrected core root election so a VLAN elects only among switches that actually participate in that VLAN. The old global-fabric root assumption was harmless in the original small fixture but incorrect once enterprise VLANs split the topology.

## LACP / EtherChannel

Physical members remain physical links. A configured bundle derives a logical forwarding edge from those members.

- member state comes from canonical physical link state,
- one deterministic active member represents the logical edge for bounded forwarding/tree calculations,
- one failed member produces `DEGRADED`,
- all failed members produce `DOWN`,
- member ordering is deterministic and independent of input array order,
- members must agree on endpoints, trunk VLANs, native VLANs, and bundle protocol.

This keeps physical failure evidence visible instead of replacing two links with an opaque synthetic cable.

## LLDP-style neighbor state

LLDP is a **derived direct-adjacency projection** only. An active physical network-device-to-network-device link yields two directional neighbor rows. A failed physical link removes those rows. Bundle members remain individually visible.

Track C does not infer hidden switches, chassis, cabling, or topology from LLDP-like evidence.

## Layer-3 switching

`l3-switch` devices participate in both switching and Layer-3 enterprise semantics.

Track C supports:

- SVIs through the same addressed interface collection used by the Ethernet fabric,
- routed switch ports as explicit `routed` physical links,
- access / distribution / core role projection for the enterprise workspace,
- L2 ingress and egress through the canonical VLAN/STP path,
- L3 forwarding only at explicit Layer-3 boundaries.

The original lightweight `runBuilderEthernetFlow` remains the small router-on-a-stick teaching path. Multi-hop L3-switch/VRF behavior is in the lazy enterprise projection rather than increasing every Builder startup path.

## First-hop redundancy

Track C models vendor-neutral first-hop ownership rather than pretending to implement a complete VRRP/HSRP wire protocol.

An SVI may declare a virtual gateway and priority. The first-hop projection derives:

- group identity from VRF + VLAN + virtual gateway,
- a deterministic locally administered virtual MAC,
- active members from shared physical/L2 reachability,
- the highest-priority reachable member as master,
- deterministic failover when that member loses VLAN reachability.

Endpoints continue to use an ordinary default-gateway address; the owning Layer-3 device changes without rewriting endpoint configuration.

## VRFs

VRFs are separate routing domains, not route labels painted over one global table.

Each `(device, VRF)` receives its own deterministic route table containing only:

- connected SVI prefixes,
- connected routed-port prefixes,
- explicit VRF-scoped static routes.

Lookup is longest-prefix-first inside that table only. Overlapping address space is therefore valid: the Track C fixture intentionally uses the same user and application prefixes in `BLUE` and `RED`. Cross-VRF traffic fails unless a future explicit route-leaking feature is added; Track C does not invent implicit leaking.

Enterprise forwarding is bounded to 16 Layer-3 decisions and fails explicitly on missing routes, dead next hops, loops, wrong VRFs, or unavailable destination VLANs.

## Native / tagged / untagged VLAN truth

A trunk preserves a VLAN only when both ends agree whether that VLAN is tagged or native/untagged.

If one end treats VLAN 10 as native while the other treats it as tagged, HOPSCOTCH marks an encoding mismatch and **fails closed** for that VLAN on that link. It does not silently translate the frame into another VLAN or imply a vendor-specific native-VLAN mismatch behavior.

The same VLAN-carriage helper is consumed by canonical Ethernet forwarding and spanning tree, so those two planes cannot disagree about whether a logical link carries a VLAN.

## UI and performance boundary

Enterprise tooling is nested inside the Track B authoring workbench and is closed by default. `BuilderEnterprisePanel` is dynamically imported only after `OPEN ENTERPRISE`.

The heavy enterprise module owns:

- bundle consistency validation,
- routed-port and VRF validation,
- RSTP role/timing projection,
- LLDP rows,
- first-hop ownership,
- VRF route tables and enterprise forwarding,
- the enterprise demo fixture.

Core startup retains only the small data types and L2 semantics needed by ordinary Ethernet/STP truth. This keeps Track C from becoming a tax on unrelated HOPSCOTCH views.

## Permanent acceptance contract

`npm run test:builder-enterprise-contract` is part of the repository-wide `npm run check` gate. It verifies:

- legacy Lab 11 Ethernet/STP behavior,
- Layer-3-switch and routed-port configuration,
- lazy enterprise validation of malformed bundles and VRF routes,
- deep-clone isolation of enterprise configuration,
- LACP `UP` / `DEGRADED` / `DOWN` states,
- LLDP physical-adjacency derivation,
- RSTP roles and 400 ms vs classic-STP 30 s failure projection,
- native-VLAN mismatch fail-closed behavior,
- deterministic virtual first-hop ownership,
- first-hop failover after shared physical/L2 failure,
- independent `BLUE` / `RED` route tables with overlapping prefixes,
- successful same-VRF multi-hop forwarding,
- rejection of cross-VRF leakage,
- scenario-v9 enterprise round-trip,
- enterprise UI remaining behind the lazy authoring boundary.

## Explicit non-goals

Track C does not add:

- vendor CLI or configuration syntax emulation,
- production BPDU/LACP/LLDP/VRRP packet implementations,
- MSTP/PVST dialect emulation,
- dynamic inter-VRF route leaking,
- chassis/stack/MLAG simulation,
- fabricated discovery beyond explicit physical links,
- a second routing or Ethernet truth model.

Those are only worth adding later when they produce a concrete troubleshooting or visualization capability that cannot be expressed through the existing canonical state.
