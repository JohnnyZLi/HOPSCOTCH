# Lab 11N — IPv6 + dual stack

Lab 11N now models an independent IPv6 data plane and the first real IPv6 control-plane behaviors beside the existing IPv4 stack. IPv4 and IPv6 share physical interfaces and link-failure truth, but addressing, neighbor resolution, routing, probes, and protocol state remain separate canonical truth.

## Dual-stack addressing and forwarding

- Every routed Builder link receives a deterministic documentation-only `2001:db8::/64`.
- Every routed interface receives a global IPv6 address plus a deterministic `fe80::/10` link-local address.
- IPv4 and IPv6 share the same `ethN` interface identity, but renumber independently.
- Endpoint IPv6 default routers use scoped link-local next hops.
- Routers install connected `C6` routes at AD 0, static `S6` routes at AD 1, and OSPFv3 `O6` routes at AD 110.
- Longest-prefix match remains upstream of administrative distance and metric, including support for `::/0`.
- Static IPv6 routes remain explicit snapshots and do not silently reconverge around failures.

## Neighbor Discovery

IPv6 forwarding no longer assumes that a configured next hop is magically available.

- Forwarding resolves the actual next-hop IPv6 address on every traversed link.
- Neighbor Solicitation targets the correct solicited-node multicast address (`ff02::1:ff00:0/104`).
- The corresponding multicast Ethernet destination is derived as `33:33:ff:xx:xx:xx`.
- Neighbor Advertisement returns a deterministic teaching MAC for the target interface.
- Neighbor-cache entries are scoped by node, link, and IPv6 address.
- Repeated probes reuse fresh cache entries instead of fabricating another NS/NA exchange.
- Failed links or invalid on-link targets fail closed rather than resolving a nonexistent neighbor.
- Neighbor cache and ND history are session-only observations, not persisted configuration truth.

## Router Solicitation, Router Advertisement, and SLAAC

- Router Advertisement can be enabled or disabled per router.
- An endpoint sends Router Solicitation to `ff02::2`.
- A live directly connected RA-enabled router advertises the connected `/64` from its link-local source address.
- SLAAC deterministically derives the endpoint address, marks the interface origin as `slaac`, and installs the advertising router's scoped link-local address as the IPv6 default router.
- The RA episode also teaches the endpoint the router's neighbor mapping.
- The teaching RA exposes router, preferred, and valid lifetimes explicitly; full lifetime expiry and renumbering state machines remain future depth rather than hidden behavior.

## ICMPv6 Packet Too Big and path-MTU discovery

IPv6 routers never fabricate in-path fragmentation.

- IPv6 probes carry an explicit packet-size control.
- When the selected forwarding path encounters a link MTU smaller than the packet, the responsible router generates an ICMPv6 Packet Too Big teaching event.
- A router-originated PTB must itself have a valid independent IPv6 reverse path to the source before it can update sender state.
- Delivered PTB information installs a session-only PMTU cache entry for the source/destination pair.
- Later oversized probes are constrained to the learned PMTU instead of repeating the same failure.
- PMTU state can be cleared explicitly to replay the discovery episode.
- Link MTU remains physical link truth; routing cost is never treated as MTU or latency.

## OSPFv3 foundation

- OSPFv3 can be enabled per router or across all Builder routers.
- This slice uses a deterministic single Area 0 teaching model.
- Live OSPFv3-enabled router links form `FULL` adjacencies; failed links become `DOWN`.
- Routers advertise connected IPv6 `/64`s and install deterministic `O6` routes at AD 110.
- OSPFv3 next hops are scoped link-local IPv6 addresses.
- Link failure withdraws the dead adjacency and recomputes IPv6 routes through the remaining topology.
- IPv4 OSPF enablement, routes, and convergence state are not mutated by OSPFv3.

## IPv6 active probes and Packet Microscope

- Builder Ping and Traceroute select IPv4 or IPv6 explicitly.
- IPv6 Ping requires independent Echo Request and Echo Reply IPv6 forwarding plus next-hop Neighbor Discovery.
- IPv6 Traceroute decrements Hop Limit only at routers and requires a separate IPv6 return route for each ICMPv6 Time Exceeded response.
- PMTU checks are applied to the actual selected IPv6 forwarding path.
- Packet Microscope receives the real Builder IPv6 source/destination addresses and ICMPv6 seed state.
- Link latency, jitter, loss, bandwidth, and MTU remain the source of physical probe observations.

## Persistence and truth boundaries

IPv6 configuration remains an additive field inside Builder scenario schema v9.

- v9 files containing IPv6 state round-trip their addressing, static routing, RA/SLAAC configuration, and OSPFv3 enablement.
- older v9 files with no IPv6 field load deterministic IPv6 state disabled so migration does not invent new reachability;
- current new Builder sessions create deterministic enabled IPv6 addressing;
- neighbor cache, ND history, RA observations, PMTU cache/history, and probe results remain session-only derived state.

## Permanent contracts

- `builder-ipv6-contract` covers deterministic `/64` and link-local addressing, connected/static/default routing, bidirectional forwarding, link failures, IPv4 independence, and scenario-v9 compatibility.
- `builder-ipv6-control-plane-contract` covers RS/RA + SLAAC, solicited-node NS/NA resolution, neighbor-cache reuse, Packet Too Big delivery, and PMTU learning.
- `builder-ipv6-ospfv3-contract` covers Area 0 adjacencies, `O6` AD-110 routes, and failure reconvergence through the alternate routed path.

## Deliberately deferred

- Duplicate Address Detection and richer Neighbor Unreachability Detection state
- RA lifetime expiry, prefix deprecation, and renumbering
- DHCPv6
- IPv6 ACL/firewall policy and any explicitly justified IPv6 translation feature
- multi-area OSPFv3 and deeper OSPFv3 lifecycle timing
- IPv6 extension-header and fragmentation teaching depth

The important boundary is unchanged: HOPSCOTCH only animates protocol behavior that the deterministic model has actually derived. IPv6 UI, animation, and Packet Microscope views do not decide forwarding truth.

## Lifecycle depth slice

The next IPv6 slice adds state that only becomes visible over time rather than at initial configuration:

- Duplicate Address Detection explicitly tests tentative addresses before use and can demonstrate a deterministic duplicate without corrupting canonical addressing.
- Neighbor Unreachability Detection tracks REACHABLE, STALE, DELAY, PROBE, and FAILED states over a session clock. Reusing a stale entry drives the state machine; live Neighbor Advertisement can recover it.
- Router Advertisement state now carries preferred, valid, and router lifetimes. Prefixes become deprecated before expiry, and deterministic renumbering keeps the old prefix valid for a bounded grace period while a new documentation `/64` becomes preferred.
- Stateful DHCPv6 models SOLICIT → ADVERTISE → REQUEST → REPLY, T1/T2/valid lease timers, and runtime address materialization. The model deliberately does **not** learn the default router from DHCPv6; RA remains the source of default-router truth.
- DHCPv6 leases, DAD/NUD observations, and lifetime clocks are session state rather than persisted configuration. A saved scenario therefore cannot fabricate a lease that was never renewed after restore.

Timed/multi-area OSPFv3 and IPv6 ACL policy remain separate follow-on slices.
