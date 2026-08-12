# Lab 11D — Active probes: Ping + Traceroute

Lab 11D turns the Builder route table into an active diagnostic surface. Probes consume the existing Lab 11B/11C forwarding engine; they do not create a second routing algorithm.

## Truth boundaries

- **PING** is successful only when the ICMP Echo Request reaches the destination and an independently evaluated Echo Reply forwarding path returns to the source.
- **TRACEROUTE** uses an ICMP Echo teaching mode. TTL is decremented at routers only. Each TTL expiry returns ICMP Time Exceeded only when that router itself has a reverse forwarding path to the source.
- Builder link cost remains routing/control-plane cost. HOPSCOTCH does not convert it into fake milliseconds or RTT.
- Probe history is a session snapshot. Editing the topology later does not retroactively rewrite an earlier observation.

The default graph can therefore be physically reachable while a probe fails for the exact L3 reason already exposed by the forwarding engine: missing route, missing gateway, failed outgoing link, invalid next hop, forwarding loop, or hop-limit exhaustion.

## Packet microscope

Probe attempts can open a projected IPv4 ICMP Echo Request in Lab 02. The packet view receives the probe TTL and Builder source/destination addresses; the Builder remains authoritative for forwarding behavior.
