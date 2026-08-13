# Lab 11I — Link characteristics

Lab 11I separates routing cost from the physical/traffic properties of each routed Builder link.

Each routed link now owns deterministic teaching properties for:

- one-way propagation latency (ms)
- jitter envelope (ms)
- bandwidth (Mb/s)
- packet-loss probability (%)
- MTU (bytes)
- queue capacity (packets)

Routing and OSPF continue to use `link.cost` only. Link characteristics do not silently change SPF or static-route selection.

Active ICMP probes consume the selected forwarding path plus these link properties. Successful probes can therefore report simulated RTT, path MTU, bottleneck bandwidth, and jitter without pretending OSPF cost is time. Loss is sampled deterministically from probe identity/link identity so replay is stable. A probe larger than the path MTU fails as an explicit DF teaching probe; IP fragmentation is not fabricated.

Queue capacity is persisted and inspectable but queue occupancy is not invented without an offered-load model. Serialization delay, fragmentation/reassembly, ECMP packet hashing, and richer queue disciplines remain future slices.
