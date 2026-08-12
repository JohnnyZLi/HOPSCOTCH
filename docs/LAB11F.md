# Lab 11F — VLANs, trunks + inter-VLAN routing

Lab 11F extends the Ethernet fabric with 802.1Q-style teaching boundaries and router-on-a-stick forwarding.

- VLAN IDs are explicit (1–4094) and each VLAN owns a distinct IPv4 subnet in the demo.
- Trunks carry an explicit allowed-VLAN set; there is no implicit “all VLANs” escape hatch.
- Endpoints cannot be attached as trunk ports in this bounded model.
- Same-VLAN traffic stays at Layer 2 and does not decrement IP TTL.
- Different VLANs are isolated unless one router has an interface/subinterface in both VLANs and endpoint gateways match those router addresses.
- Inter-VLAN forwarding crosses the router once and decrements TTL exactly once.
- FDB state is keyed by switch + VLAN + MAC, so identical Layer-2 learning concepts stay scoped to their broadcast domain.

Native VLAN behavior, STP, LACP, ARP/ND, DHCP, routed SVIs, and dynamic routing redistribution between this LAN fabric and the existing routed graph remain explicit future slices rather than hidden assumptions.
