from pathlib import Path
p=Path('docs/ROADMAP.md')
text=p.read_text()
start=text.index('## Current priority order')
end=text.index('### Track G — service-provider + overlay networking', start)
replacement='''### Completed active track — Track E data-plane realism

Track E adds deterministic data-plane pressure after canonical Builder forwarding has already selected a path. It consumes existing link bandwidth, latency, MTU, and queue capacity rather than creating another routing or topology model.

- [x] packet queues, serialization delay, occupancy, capacity, deterministic scheduling
- [x] tail drop / ECN integrated with canonical Builder queue pressure
- [x] traffic generators: single flow, bulk TCP, competing flows, constant-rate UDP, bursts
- [x] deterministic bandwidth sharing and per-flow throughput/latency observations
- [x] IPv4 fragmentation, DF, ICMP Fragmentation Needed, IPv6 Packet Too Big, PMTU caches
- [x] PMTUD black-hole scenarios
- [x] transport congestion/recovery driven by actual Builder link/queue truth

Track E only runs on the exact link IDs from a successful Track D application transaction. TCP/QUIC sender pressure changes in-band from queue ECN/drop feedback; UDP remains explicitly non-responsive. IPv4 keeps bounded session PMTU state, while IPv6 reuses the pre-existing canonical `BuilderIpv6ControlState` PMTU cache and PTB reverse-route truth. The data-plane workspace remains behind the existing lazy application boundary. `docs/TRACKE.md` is the closeout architecture and validation record.

---

## Current priority order

With captured evidence, end-to-end application truth, causal replay, authoring, enterprise L2/L3 depth, and data-plane realism closed, the next highest-value work is deeper routing and policy composition on the canonical Builder RIB/FIB foundations.

### 1. Track F — routing + policy depth

- [ ] general redistribution between connected/static/OSPF/BGP with explicit provenance and loop hazards; Lab 11M's bounded static→OSPF slice is only the foundation
- [ ] policy-based routing without replacing destination-based forwarding truth
- [ ] ECMP forwarding/hash depth where additional protocol-specific behavior is useful
- [ ] route summarization and intentional black-hole scenarios
- [ ] deeper BGP policy, communities, withdrawal timing, and route-reflector concepts
- [ ] custom OSPF timer policy or DR/BDR broadcast-network behavior only when it materially improves troubleshooting
- [ ] IS-IS only after existing OSPF/BGP depth makes another IGP worthwhile

---

## Remaining regular tracks

These remain real product work. They should follow Track F unless a bounded dependency requires a different order.

'''
p.write_text(text[:start] + replacement + text[end:])
