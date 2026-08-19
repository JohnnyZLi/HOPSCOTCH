# Track C — Enterprise Layer 2 / Layer 3 depth

Track C closes the active-roadmap enterprise networking slice by extending the existing Builder Ethernet configuration and forwarding truth. It does **not** introduce a second enterprise simulator, an editor-only topology, or vendor-specific hidden state.

## Canonical architecture

Track C remains additive to Builder scenario schema v9.

The existing `BuilderEthernetConfig` is the persistence boundary. Track C adds enterprise-capable state to that same configuration:

- Layer-3 switch devices
- routed switch ports
- SVI metadata on routed interfaces
- optional VRF identity on routed interfaces and routed links
- LACP bundle configuration over existing physical links
- FHRP groups over existing SVI/addressing truth
- explicit native-VLAN identity on each side of an existing trunk
- STP protocol selection (`stp` / `rstp`)

Older v9 scenarios remain valid because the new fields are optional/default-safe. The enterprise-specific validator is loaded with the enterprise workspace and fails closed before enterprise behavior is projected.

## Lazy product boundary

The enterprise engine and panel are intentionally kept out of the initial `NetworkBuilder` chunk.

Track C is reached through the already-lazy Builder authoring workspace. This keeps enterprise-only algorithms, validation, fixtures, and presentation from becoming unconditional startup cost.

The base Ethernet model preserves the additive configuration fields and legacy Ethernet/STP behavior. The enterprise module projects deeper behavior only when the Track C workspace is opened.

## RSTP

RSTP is a protocol mode over the existing spanning-tree topology truth rather than a second tree model.

`builderRstpConvergence(...)` projects deterministic convergence timing and role/state transitions from the same canonical Ethernet/STP state. Classic STP retains slower convergence semantics; RSTP exposes the materially faster transition boundary without claiming sub-second packet-level protocol emulation.

L3 switches participate in spanning-tree calculations on their switched links. Routed links do not participate in STP.

## LACP / EtherChannel

LACP preserves both dimensions of truth:

1. configured **physical member links**, and
2. derived **logical Port-Channel** state.

A bundle exposes:

- active/passive negotiation state
- `minLinks`
- live/inactive physical members
- logical bundle up/down state
- deterministic per-flow member selection

Passive/passive does not invent an adjacency. Member failure respects `minLinks`.

STP operates on the logical bundle edge for enterprise projection. Individual healthy physical members inside the same negotiated bundle are not presented as independent STP-blocked parallel links.

## LLDP-style neighbor state

LLDP neighbor rows are derived only from configured physical adjacency.

Each physical link produces directional neighbor evidence. A neighbor row can reference its parent logical bundle, but the logical bundle never creates a fake physical neighbor.

This preserves the distinction between physical topology and aggregation state.

## Layer-3 switches, SVIs, and routed ports

Track C adds Layer-3 switches to the same Ethernet device model used by switches, routers, and endpoints.

Layer-3 switches can own routed VLAN interfaces/SVIs. Routed switch-to-switch links carry explicit point-to-point addressing and do not silently participate in VLAN/STP forwarding.

The enterprise campus fixture demonstrates an access/distribution design with redundant Layer-3 distribution switches. Inter-VLAN traffic is routed by the selected first-hop device instead of being handed to a separate router-on-a-stick model.

## First-hop redundancy

FHRP is vendor-neutral and intentionally VRRP-style rather than pretending to emulate a particular vendor implementation.

A group binds:

- one VLAN
- one VRF
- one virtual IPv4 address
- bounded members with deterministic priority/preemption metadata

`builderFhrpState(...)` selects the canonical active first-hop member from available configured members. If the preferred distribution switch becomes unavailable, the next eligible member takes over.

Endpoint gateway resolution consumes this FHRP state, so failover changes the actual routed hop used by enterprise forwarding.

## VRFs

VRFs create genuinely separate connected routing tables.

Connected SVI and routed-port routes are keyed by VRF. Identical/overlapping IPv4 prefixes can coexist in different VRFs without collapsing into one global table.

Enterprise forwarding refuses cross-VRF traffic unless both endpoints are in the same routing context. Track C does not invent route leaking.

## Native, tagged, and untagged VLAN truth

A trunk can carry an explicit native VLAN independently on each side.

`builderVlanEncapsulation(...)` reports each VLAN as tagged or untagged from each endpoint's perspective. A native-VLAN mismatch is explicit and the affected VLAN is not silently treated as successfully carried.

This remains layered on the existing allowed-VLAN and STP truth.

## Enterprise forwarding

`runBuilderEnterpriseEthernetFlow(...)` composes the existing Ethernet forwarding boundary with Track C enterprise state.

For an inter-VLAN flow it preserves:

- source access VLAN
- switched path to the selected first-hop device
- FHRP master selection
- VRF isolation
- routed SVI hop
- destination VLAN forwarding
- STP/LACP/native-VLAN constraints

The result remains deterministic and retains the same Builder flow-result shape used by existing Ethernet consumers.

## Product surface

`BuilderEnterprisePanel` lives inside the lazy authoring workspace and exposes the enterprise model as inspection/authoring cameras rather than separate truth:

- campus fixture loading
- logical vs physical LACP state
- redundant gateway state
- separate VRF route tables
- tag/native-VLAN truth
- derived physical neighbors
- enterprise forwarding outcomes

## Determinism and boundedness

Track C remains bounded by the existing Builder ceilings plus enterprise-specific collection limits. Enterprise configuration validation rejects malformed references, invalid bundle membership, invalid FHRP/VRF relationships, and invalid routed-link/SVI metadata before those objects can affect enterprise behavior.

Flow hashing, FHRP master selection, route-table derivation, LLDP rows, RSTP convergence, and forwarding results are deterministic for the same canonical configuration.

## Permanent contract

`npm run test:builder-enterprise-contract` is part of `npm run check` and permanently covers:

- RSTP faster convergence semantics versus classic STP
- Layer-3 switch participation
- LACP negotiation, `minLinks`, member failure, passive/passive rejection, and deterministic member selection
- physical LLDP lineage under logical bundles
- logical Port-Channel STP projection without falsely blocking parallel member links
- FHRP preferred-master selection and failover
- gateway resolution through the active FHRP member
- routed switch ports and deep-clone isolation
- VRF route tables with overlapping prefixes
- explicit tagged/untagged/native-VLAN state and mismatch detection
- canonical enterprise inter-VLAN forwarding
- VRF isolation failure
- scenario-v9 serialization/deserialization
- lazy product integration that keeps Track C out of the startup `NetworkBuilder` chunk

## Closeout boundary

Track C is complete when the permanent contract, repository checks, production performance budgets, and compatibility/browser matrix all pass on the final PR head.

Further queueing, congestion, PMTU, fragmentation, and transport effects belong to Track E. General redistribution and deeper routing policy belong to Track F. Overlay/service-provider protocols belong to Track G.
