# Lab 11H — STP / Layer-2 loop control

Lab 11H adds a deterministic common-spanning-tree teaching model to the Ethernet fabric.

- Switches use explicit bridge priorities plus MAC address and stable device ID as deterministic bridge-ID tie breakers.
- The lowest bridge ID becomes root.
- Active switch-to-switch links form a per-VLAN topology; root-path selection is deterministic.
- Redundant switch segments are marked BLOCKING while tree edges remain FORWARDING.
- Failing a forwarding trunk recomputes the tree and can move a previously blocked redundant segment into forwarding state.
- Disabling STP while an active VLAN contains a switch cycle is treated as unsafe for broadcast/unknown-unicast traffic; ARP/data flows fail closed rather than pretending a looping frame terminates normally.
- STP state is derived from topology and persisted configuration; transient BPDU/timer state is not serialized.

This is intentionally a bounded STP teaching model, not vendor CLI emulation. RSTP timing, per-VLAN STP variants, BPDU Guard, Root Guard, PortFast, loop guard, MST regions, and topology-change timers remain later work.
