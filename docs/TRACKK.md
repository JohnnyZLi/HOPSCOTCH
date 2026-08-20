# Track K — vendor-neutral HOPSCOTCH CLI

Track K is complete.

The Builder terminal is a vendor-neutral operational surface over canonical HOPSCOTCH truth. It does not emulate IOS, Junos, FRR, Linux, or any other device image, and it never owns routing, switching, neighbor, policy, forwarding, NAT, or protocol truth.

## Product invariant

> The CLI may parse, scope, delegate, format, and invoke canonical mutations. It never becomes a second network model.

That invariant now holds across inspection, probes, device context, and bounded configuration.

## Completed command surface

### Canonical inspection

The terminal projects existing Builder/runtime state through:

- `show interfaces`
- `show route`
- `show arp`
- `show mac`
- `show ospf neighbors`
- `show bgp`
- `show acl`
- `show nat`

The original interface/RIB/ARP/FDB views still use `projectBuilderCliState(...)`. Operational protocol/policy views consume the same canonical OSPF, BGP, ACL, NAT, and NAT-session structures used by Builder panels and Device Workbench.

Historical Time Machine snapshots keep staged truth boundaries: route views honor the historical RIB graph and OSPF/BGP inspection uses the historical control-plane graph rather than present-day physical truth.

### Device context

`use <device>` creates terminal-local operational context. A device can be selected by canonical node id or unique label. `use global` returns to the unscoped view.

Context changes presentation and command perspective only:

- core and protocol inspection can be scoped to one device,
- active probes originate from the selected routed device,
- device-bound configuration requires explicit context,
- no canonical network state changes merely because terminal context changed.

The Builder's existing selected node, topology, routes, sessions, and event truth remain separate from this local terminal perspective.

### Active probes

Supported forms are:

- `ping <destination>`
- `traceroute <destination>`
- `ping ipv4 <destination>`
- `traceroute ipv4 <destination>`
- `ping ipv6 <destination>`
- `traceroute ipv6 <destination>`

The two-token forms remain backwards-compatible IPv4 commands. Explicit address-family syntax is required for IPv6.

IPv4 destinations resolve by node id, unique label, or configured IPv4 interface address. IPv6 destinations resolve by node id, unique label, or configured global IPv6 address.

The CLI does not implement packets. It delegates to the existing `runBuilderProbe(...)` or `runBuilderIpv6Probe(...)` path through the shared Builder probe executor. Therefore CLI probes inherit the same:

- RIB/FIB and default-gateway truth,
- OSPF/BGP-derived reachability,
- ACL behavior,
- NAT/PAT translation and session state,
- link latency/jitter/loss/MTU behavior,
- IPv6 ND/PMTU/control-plane lifecycle,
- probe history and selected attempt,
- Workbench/timeline events,
- Track J challenge evidence and objective verification.

The returned `BuilderProbeResult` is formatted; it is never reinterpreted by the CLI.

### Bounded canonical configuration

Track K intentionally closes with a small command set rather than a vendor grammar:

- `set ospf on|off`
- `set bgp on|off`
- `set gateway <ipv4|none>`
- `set link <link-id> up|down`
- `set static-route <prefix> via <next-hop> [metric <1-999>]`
- `delete static-route <prefix>`

OSPF/BGP, gateway, and static-route commands require `use <device>` first. Link state is explicitly keyed by canonical Builder link id.

Every command delegates to the same existing mutation functions or canonical graph commit path used by Builder controls:

- OSPF → `setBuilderOspfRouterEnabled(...)`
- BGP → `setBuilderBgpRouterEnabled(...)`
- endpoint default gateway → `replaceBuilderDefaultGateway(...)` plus normal addressing reconciliation
- routed link state → the normal canonical graph commit/reconcile path
- static routes → `upsertBuilderStaticRoute(...)` / `deleteBuilderStaticRoute(...)`

The CLI therefore cannot create an alternate configuration schema or repair path. Track J challenges can be diagnosed and repaired through the terminal only when these ordinary canonical mutations genuinely fix the challenged field.

## Time Machine boundary

Time Machine remains observation, not counterfactual execution.

Historical terminal sessions allow `use ...` and all `show ...` commands. Historical sessions reject Ping/Traceroute and all configuration commands with explicit `READ_ONLY_CONTEXT` behavior. No hidden present-day probe or configuration mutation is performed while viewing a historical snapshot.

## UX + performance boundary

The terminal remains a lazy full-width Builder dock. It is closed by default and absent from stress Builder, preserving the existing startup and DOM ceilings.

Session-only UX includes a bounded transcript, Up/Down command history, Ctrl/Cmd+L clear, Escape close, quick inspection/probe actions, and GLOBAL vs device-context prompt/header state. Terminal transcript and context are not scenario schema and are not saved as network truth.

## Deliberate non-goals

Track K does **not** attempt broad Cisco/Juniper/Arista/FRR/Linux syntax compatibility, vendor configuration modes, running/config storage emulation, device boot processes, NOS images or virtual appliances, terminal-specific routing/protocol algorithms, or unrestricted text-to-config mutation.

Those would either duplicate canonical state or turn HOPSCOTCH into a shallow CLI emulator. The shipped surface is intentionally small, deterministic, and composable with the rest of the product.

## Closeout

Track K now provides enough operational depth to diagnose, probe, scope, and perform bounded repairs from one terminal while preserving HOPSCOTCH's central architectural rule: **network truth exists once**.

The next regular product track is Track L — Explain This Network.
