# Lab 11K — NAT / PAT

Lab 11K adds a stateful IPv4 translation layer to Network Builder without collapsing routing, firewall policy, and translation into one generic connectivity result.

## Translation model

- NAT boundaries attach to router nodes with explicit inside-link and outside-link sets.
- The default teaching boundary is EDGE: `client-edge` is inside, while both routed EDGE exits are outside so OSPF failover does not silently invalidate NAT classification.
- Dynamic PAT rewrites the inside source address to the configured documentation address and chooses a deterministic source port from a bounded pool.
- Reusing the same active five-tuple reuses the same PAT translation instead of allocating a new mapping.
- PAT port exhaustion is explicit instead of silently reusing a conflicting tuple.
- PAT state is session-only and expires deterministically by sequence; clearing translation state immediately removes return reachability that depended on that state.
- Static one-to-one NAT preserves the transport port while translating the configured inside/outside IPv4 address pair in both directions.
- Static TCP/UDP port forwarding translates a published outside address/port to an explicit inside address/port.
- Unsolicited inbound traffic fails closed unless it matches an active PAT return session, a static port mapping, or a static one-to-one mapping.
- TCP, UDP, and bounded ICMP address translation are modeled. ICMP never fabricates TCP/UDP ports.

## Routing + policy boundaries

NAT does not create reachability. Outbound traffic must first have a real Builder forwarding path to cross an inside→outside NAT boundary, and inbound translated traffic must still have a real outside→inside forwarding path through the expected boundary.

ACL and NAT truth remain explicit. The NAT flow trace records the tuple before translation and after translation, and the boundary evaluates ordered ACL policy at both documented phases. This makes failures distinguishable as routing failure, pre-NAT policy denial, translation-state failure, post-NAT policy denial, or translated inside-forwarding failure.

Weighted graph truth, OSPF SPF cost, link latency/loss/MTU, Ethernet/VLAN/STP state, and NAT state remain separate dimensions.

## Active probes

The probe engine can consume the same NAT configuration and translation table:

- Ping creates or reuses outbound translation state and requires the returning Echo Reply to match reverse NAT/policy truth.
- Traceroute carries the same outbound translation context and models post-boundary ICMP Time Exceeded responses as related to the originating translation instead of allowing them to bypass NAT.
- Final Echo Reply handling uses the same reverse translation path as Ping.
- Probe results expose whether NAT participated and preserve NAT explanation alongside routing/link metrics.

The NAT contract permanently verifies NAT-aware Ping and Traceroute in addition to ordinary application-style TCP/UDP flows.

## Builder UI

The NAT/PAT control surface exposes:

- NAT router selection and explicit per-link INSIDE / OUTSIDE classification
- configurable overload/PAT address
- enable/disable/remove boundary controls
- TCP, UDP, and ICMP outbound flow testing
- explicit return-flow testing
- clear-session-state control
- static one-to-one publication
- static TCP/UDP port forwarding
- derived active translation table
- original versus translated tuples
- pre-NAT versus post-NAT ACL decision stages

The routed 32-node / 96-link stress fixture intentionally keeps the NAT panel and default NAT boundary absent so the established routed DOM benchmark remains comparable.

## Persistence

Builder scenario schema v8 persists NAT configuration: boundaries, overload addresses, static one-to-one mappings, static port mappings, PAT range, and deterministic session-lifetime configuration.

Dynamic translation entries are deliberately excluded from scenario JSON. Loading/restoring a scenario therefore restores configuration but begins with an empty translation table. v1–v7 scenarios migrate to v8 with empty NAT configuration rather than fabricating a boundary that did not exist in the original file.

## Permanent contracts

`test:builder-nat-contract` is part of `npm run check` and covers:

- boundary validation and OSPF outside-link failover
- deterministic PAT allocation, reuse, expiry, and return matching
- unsolicited inbound rejection
- static port forwarding
- static one-to-one NAT
- UDP and ICMP behavior
- pre/post-NAT ACL stages
- NAT-aware Ping and Traceroute
- schema-v8 round trip
- v7→v8 migration
- exclusion of transient NAT session state from persisted JSON
