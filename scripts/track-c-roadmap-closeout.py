from pathlib import Path

p = Path('docs/ROADMAP.md')
text = p.read_text()
start = text.index('## Current priority order')
marker = '### Track F — routing + policy depth'
end = text.index(marker, start)
replacement = '''### Completed active track — Track C enterprise Layer 2 / Layer 3 depth

Track C extends the existing canonical Builder Ethernet/routing foundations with enterprise campus behavior without introducing a parallel simulator.

- [x] RSTP with explicit faster role/state transitions
- [x] LACP / EtherChannel with logical bundle vs physical-member truth
- [x] LLDP-style derived neighbor state
- [x] Layer-3 switches, SVIs, routed switch ports, access/distribution/core designs
- [x] vendor-neutral VRRP-style first-hop redundancy
- [x] VRFs with genuinely separate routing tables and overlapping address space
- [x] native/tagged/untagged VLAN behavior that preserves existing VLAN/STP truth

Enterprise state remains additive to scenario v9. Physical LACP members remain visible beneath the logical Port-Channel, FHRP selects the actual first-hop routed device, VRFs never collapse overlapping prefixes into one table, native-VLAN mismatches are explicit, and enterprise algorithms/UI remain behind the already-lazy Builder authoring boundary. `docs/TRACKC.md` is the closeout architecture and validation record.

---

## Current priority order

With captured evidence, end-to-end application truth, causal replay, authoring, and enterprise L2/L3 depth closed, the next highest-value work is deeper data-plane behavior driven by canonical Builder link truth.

### 1. Track E — data-plane realism

- [ ] packet queues, serialization delay, occupancy, capacity, deterministic scheduling
- [ ] tail drop / ECN integrated with existing congestion concepts
- [ ] traffic generators: single flow, bulk TCP, competing flows, constant-rate UDP, bursts
- [ ] deterministic bandwidth sharing and per-flow throughput/latency observations
- [ ] IPv4 fragmentation, DF, ICMP Fragmentation Needed, IPv6 Packet Too Big, PMTU caches
- [ ] PMTUD black-hole scenarios
- [ ] transport congestion/recovery driven by actual Builder link/queue truth

---

## Remaining regular tracks

These remain real product work. They should follow Track E unless a bounded dependency requires a different order.

'''
p.write_text(text[:start] + replacement + text[end:])
