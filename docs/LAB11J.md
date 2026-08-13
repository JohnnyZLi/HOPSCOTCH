# Lab 11J — ACL / firewall policy

Lab 11J adds an ordered routed-policy layer without corrupting routing truth.

- ACL rules attach to Builder routers and are evaluated in ascending sequence order.
- Rules match source prefix, destination prefix, protocol (`IP`, `ICMP`, `TCP`, `UDP`), and optional TCP/UDP destination port.
- First matching rule wins; an explicit global default action handles no-match traffic.
- Route existence and policy permission remain separate. A path may be fully routable while the packet is denied at a router.
- Active Ping/Traceroute consumes the same forwarding path and then evaluates ICMP policy at each routed boundary.
- Reverse ICMP replies/time-exceeded messages are evaluated independently, so asymmetric policy can produce request success with reply timeout.
- ACL configuration persists in Builder scenarios; decisions are derived at run time.

Stateful firewall sessions, connection tracking, zones, established/related semantics, NAT coupling, object groups, IPv6 ACLs, and vendor-specific syntax remain future work.
