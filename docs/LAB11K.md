# Lab 11K — NAT / PAT

Lab 11K begins the Builder translation layer without collapsing routing, firewall policy, and stateful translation into one generic "connectivity" result.

## Implemented in the core model

- NAT boundaries attach to router nodes with explicit inside-link and outside-link sets.
- The default teaching boundary is EDGE: `client-edge` is inside, while both routed EDGE exits are outside so OSPF failover does not silently invalidate NAT classification.
- Dynamic PAT rewrites the inside source address to the configured documentation address and chooses a deterministic source port from a bounded pool.
- Reusing the same active five-tuple reuses the same PAT translation instead of allocating a new mapping.
- PAT state is session-only and expires deterministically by flow sequence; static mappings are configuration and never age as transient sessions.
- Unsolicited inbound traffic fails closed unless it matches an active PAT return session or an explicit static port-forward mapping.
- Static TCP/UDP port forwarding translates the published outside tuple back to the configured inside address/port.
- Inbound return traffic must still have a valid outside-to-inside Builder forwarding path through the configured NAT boundary. NAT state cannot invent a route.
- PAT port exhaustion is explicit instead of silently reusing a conflicting tuple.
- TCP, UDP, and bounded ICMP address translation are modeled; ICMP does not fabricate TCP/UDP ports.

## Truth boundaries

NAT does not alter weighted-path truth, OSPF SPF cost, link characteristics, VLAN/STP state, or the existing ACL model. A flow can therefore fail because of routing before translation, because no inbound translation exists, or because translated inside forwarding is unavailable.

The next Lab 11K integration steps are to persist NAT configuration in the Builder scenario schema, expose translation/session controls in the Builder UI, and document/evaluate ACL matching at explicit pre-NAT and post-NAT boundaries. Active probes can then consume the same translation state instead of maintaining a separate NAT approximation.
