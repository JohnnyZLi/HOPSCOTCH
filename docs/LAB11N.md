# Lab 11N — IPv6 + dual-stack foundation

Lab 11N begins by adding an IPv6 forwarding plane beside the existing IPv4 plane. This slice intentionally stops before Neighbor Discovery, SLAAC, Packet Too Big, IPv6 policy/NAT, or OSPFv3 so HOPSCOTCH does not pretend those mechanisms exist before their state machines are modeled.

## Implemented in this slice

### Dual-stack addressing

- Every routed Builder link receives a deterministic IPv6 `/64` from the documentation-only `2001:db8::/32` block.
- Every routed interface receives a deterministic global IPv6 address plus a deterministic `fe80::/10` link-local address.
- IPv4 and IPv6 share the same `ethN` interface identity, but renumbering one family does not renumber the other.
- Endpoint IPv6 default routers use the directly connected router's scoped link-local address, matching normal IPv6 next-hop practice.
- Normal new Builder sessions start IPv6 enabled. Existing schema-v9 scenarios that predate this field normalize to deterministic but **disabled** IPv6 state so migration does not fabricate new reachability.

### IPv6 FIB

- Routers install connected IPv6 routes at AD 0 and explicit static IPv6 routes at AD 1.
- Static routes carry an explicit outgoing link so link-local next hops are never treated as globally unscoped addresses.
- Longest-prefix match wins before administrative distance and metric; `::/0` is supported as a static default route.
- Static routes are snapshots and do not reconverge when a link fails.
- The Builder can install a bidirectional static path from the current live weighted topology for teaching and probe setup.
- IPv6 forwarding uses the same physical graph/link-failure truth as IPv4 but a separate address/FIB model.

### IPv6 active probes

- Builder Ping and Traceroute can select IPv4 or IPv6 explicitly.
- IPv6 Ping requires independent Echo Request and Echo Reply IPv6 forwarding.
- IPv6 Traceroute decrements Hop Limit only at routers and requires an independent IPv6 return route for each ICMPv6 Time Exceeded message.
- Explicit link latency, jitter, loss, bandwidth, and MTU continue to drive probe observations; OSPF cost never becomes latency.
- Packet Microscope accepts the actual Builder IPv6 source/destination addresses for ICMPv6 probe seeds.

## Persistence

IPv6 is stored as an additive `ipv6` field inside Builder scenario schema v9. This is deliberately backward-compatible:

- v9 files containing IPv6 state round-trip it exactly;
- older v9 files with no `ipv6` field load with IPv6 disabled;
- current new Builder sessions create deterministic enabled IPv6 state;
- active probe observations remain session-only.

## Deliberately deferred

- Neighbor Discovery / neighbor cache
- Router Solicitation, Router Advertisement, and SLAAC
- ICMPv6 Packet Too Big and a full path-MTU discovery episode
- IPv6 ACL/firewall policy and IPv6 NAT
- OSPFv3

Until Neighbor Discovery lands, this slice is explicitly an **L3 FIB teaching model**. A configured on-link/global or scoped next-hop address is treated as available to the L3 forwarding engine; HOPSCOTCH does not invent NS/NA exchanges in the background.
