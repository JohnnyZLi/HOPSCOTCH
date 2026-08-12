# Lab 11E — Ethernet LANs + switching foundation

Lab 11E adds a bounded Layer-2 teaching fabric inside Network Builder without corrupting the routed point-to-point graph introduced by Labs 11A–11D.

- Switches forward Ethernet within a VLAN/broadcast domain; they do not gain IPv4 route-table entries.
- Access links carry one VLAN untagged in this model.
- Unknown unicast is represented as VLAN-scoped flood-and-learn behavior; deterministic FDB entries are derived from the flow rather than persisted as configuration.
- A learned return path is unicast.
- Link failure or access-VLAN mismatch can make Layer 2 unreachable while the separate routed Builder graph remains unchanged.

This slice deliberately keeps ARP resolution symbolic: deterministic device MAC addresses let the lesson focus on switching/FDB behavior. ARP itself can become a later packet-level slice rather than being silently fabricated here.
