# Lab 11G — ARP + Layer-2/Layer-3 resolution

Lab 11G makes next-hop MAC resolution explicit inside the bounded Ethernet/VLAN fabric.

- Same-subnet traffic ARPs for the destination IPv4 address.
- Off-subnet traffic ARPs for the configured default gateway, not the remote endpoint.
- After the router crosses a VLAN boundary it performs a separate ARP resolution for the destination host on the egress VLAN.
- ARP Request is a VLAN-scoped broadcast; ARP Reply is a unicast response over the current STP-forwarding topology.
- ARP cache state is session-only derived state. It is never persisted into Builder scenario files.
- Re-running a flow with an intact cache produces an explicit cache hit rather than fabricating another request/reply exchange.
- Clearing the cache forces resolution again without mutating VLAN, routing, or switching configuration.
- An unresolved gateway/host, blocked Layer-2 path, failed link, or unsafe STP-disabled loop causes ARP to fail closed.

Proxy ARP, gratuitous ARP conflict handling, dynamic aging timers, ARP inspection, and IPv6 Neighbor Discovery remain later slices.
