# Track G — Service-provider + overlay networking

Track G adds explicit underlay/overlay and service-provider behavior on top of the canonical Builder topology, RIB/FIB, BGP state, and routed link characteristics.

The central rule is:

> **an overlay can only project behavior over underlay/control-plane truth that already exists; overlay configuration never manufactures reachability.**

Track G covers GRE/IP-in-IP, bounded encrypted-tunnel semantics, MPLS label switching, VXLAN VTEP/VNI overlays, and EVPN MAC/IP learning without introducing another route engine or another topology.

## Canonical configuration boundary

Track G configuration is an additive `provider` member of `BuilderRoutingConfig` and therefore participates in the same:

- validation and topology reconciliation,
- canonical routing snapshots,
- undo/restore and scenario comparison,
- Builder timeline snapshots,
- scenario-v9 JSON persistence.

The scenario schema remains **v9**. Runtime projections such as tunnel state, label operations, VTEP-pair reachability, and learned EVPN rows are derived from configuration plus current canonical network state; they are not persisted as configuration.

The compact provider configuration schema is synchronous. The heavier provider algorithms and product UI are imported only through the already-lazy routing-policy workspace.

## GRE and IP-in-IP

A tunnel names two existing routed Builder routers plus a distinct inner overlay prefix/address pair.

Tunnel state first calls the existing canonical `traceBuilderForwarding(...)` between the underlay endpoints. The resulting link IDs are the tunnel's **outer path**. Track G does not perform another shortest-path or route-table calculation.

The packet projection records two separate facts:

- **inner packet:** overlay source/destination and original bytes,
- **outer packet:** underlay endpoint addresses, encapsulation protocol, added bytes, and exact canonical underlay link IDs.

GRE adds a bounded 24-byte teaching overhead. IP-in-IP adds 20 bytes. The effective tunnel MTU is the canonical underlay path MTU minus the explicit encapsulation overhead. An inner packet above that effective MTU is reported as requiring fragmentation/PMTU handling rather than being silently accepted.

A healthy overlay therefore never implies the underlay is healthy. If the canonical underlay trace fails, tunnel overlay state is DOWN at that exact boundary.

## IPsec-style and WireGuard-style semantics

Track G intentionally does **not** implement production cryptography.

Encrypted-tunnel kinds reuse the same explicit inner/outer and underlay path model, then add bounded control state:

- ready,
- authentication failed,
- key missing,
- handshake down.

IPsec-style projection uses a bounded 58-byte overhead. WireGuard-style projection uses 60 bytes.

HOPSCOTCH stores no pre-shared keys, private keys, session secrets, certificates, cipher implementations, or cryptographic payload transformations. A tunnel may therefore have a perfectly healthy underlay while its encrypted overlay remains DOWN because authentication/handshake state is not ready.

This is a troubleshooting model for separating **transport reachability** from **secure-tunnel establishment**, not a cryptographic implementation.

## MPLS

Track G models a bounded label-switched path over the canonical routed underlay.

An LSP names:

- ingress router,
- egress router,
- FEC prefix,
- enabled state.

Every router on the resulting canonical underlay path must have MPLS enabled. The deterministic LSP projection then produces:

1. **PUSH** at ingress,
2. **SWAP** at each transit router,
3. **POP** at egress.

Each row records incoming label, outgoing label, FEC, outgoing canonical link, and next router. Per-router label forwarding tables are projections of those rows.

Track G does not claim LDP, RSVP-TE, segment routing, pseudowire, or production label-distribution behavior. Labels are deterministic teaching identifiers. The important truth is the separation between IP/FEC selection and the label operations executed along the already-selected underlay path.

## VXLAN

A VTEP is an existing routed Builder router plus a source address that the router actually owns. A VNI names at least two configured VTEPs and a route target.

For every VTEP pair in a VNI, HOPSCOTCH runs the canonical underlay forwarding trace. VNI state is:

- **UP** when all active VTEP pairs have underlay reachability,
- **DEGRADED** when only some pairs do,
- **DOWN** when the overlay has fewer than two active VTEPs or no usable pair connectivity.

VXLAN forwarding preserves the inner Ethernet destination MAC and creates explicit outer VTEP source/destination addresses with UDP destination port **4789**.

Known remote MACs may use EVPN unicast. Otherwise the bounded model uses ingress replication to reachable remote VTEPs. Critically, an unknown-MAC flood is **not** proof that the unknown destination was delivered; HOPSCOTCH records the flood operation while leaving destination delivery unproven.

## EVPN

Track G provides bounded BGP EVPN teaching state after the existing BGP and VXLAN foundations.

Local VTEP MAC/IP bindings create Type-2-style MAC/IP advertisements. VTEP membership creates Type-3-style IMET/flood-list advertisements.

Remote learning requires two independent truths:

1. an allowed path through established Builder BGP control-plane sessions,
2. canonical routed underlay reachability to the advertising VTEP.

A remote EVPN row records:

- local vs BGP-learned origin,
- origin VTEP,
- next-hop VTEP address,
- VNI,
- route distinguisher,
- route target,
- MAC and optional IP,
- control-plane and underlay reachability.

EVPN learning never changes the underlay RIB/FIB and never treats a learned MAC/IP as evidence that the VTEP next hop is reachable.

The bounded EVPN control-plane projection is intentionally narrower than a production RFC 7432 implementation. It does not claim DF election, Ethernet-segment multihoming, MAC mobility sequence depth, ESI-LAG, all-active/single-active multihoming, or full address-family policy syntax.

## Product surface

`BuilderProviderPanel` lives inside the existing lazy `BuilderRoutingPolicyPanel` workspace. It exposes:

- tunnel authoring and explicit underlay/overlay state,
- encrypted-tunnel security-state separation,
- effective tunnel MTU and encapsulation sample,
- MPLS enablement, LSP authoring, push/swap/pop path, and per-router LFIB rows,
- VTEP and VNI authoring with underlay pair state,
- EVPN enablement, local MAC/IP bindings, and learned Type-2 rows,
- VXLAN forwarding samples that distinguish EVPN unicast from ingress replication.

The main `NetworkBuilder` does not import `builder/provider.ts` or `BuilderProviderPanel` directly. This keeps advanced service-provider depth out of the startup bundle and out of stress-mode DOM.

## Permanent contract

`npm run test:builder-provider-contract` is part of `npm run check`.

It permanently covers:

- provider schema validation and canonical setter integration,
- tunnel underlay path equality with `traceBuilderForwarding(...)`,
- GRE inner/outer separation and overhead,
- effective tunnel MTU failure,
- encrypted-tunnel failure independent of healthy underlay,
- no secret-key material in canonical provider configuration,
- MPLS PUSH/SWAP/POP and per-router LFIB projection,
- MPLS and tunnel agreement when consuming the same underlay endpoints,
- VNI/VTEP underlay reachability,
- EVPN Type-2 and Type-3 learning,
- VXLAN UDP/4789 outer projection,
- unknown-MAC ingress replication without invented delivery,
- underlay failure propagating into tunnel/VXLAN/EVPN state,
- scenario-v9 round trip,
- lazy product integration and explicit truth-boundary language.

Every pre-existing Builder, Journey, evidence, Track A/B/C/D/E/F, compatibility, and performance contract remains part of the Track G closeout gate.

## Closeout boundary

Track G is complete only when:

- the full repository contract suite is green,
- production performance remains within the existing ceilings,
- Chrome default / disabled-GPU / SwiftShader compatibility is green,
- Firefox semantic compatibility is green,
- real PCAP/PCAPNG replay remains green,
- no temporary integration workflow/script remains,
- `docs/ROADMAP.md` records all five Track G items as completed and promotes Track I.

Track I owns native companion integration. Track G does not broaden local measurement permissions, perform discovery/scanning, or mix simulated provider state with `LOCAL MEASURED` evidence.
