# Track K — vendor-neutral HOPSCOTCH CLI

Track K gives the Builder a terminal interface without introducing a second network model or pretending to run Cisco, Juniper, Linux, or other vendor device images.

## Product invariant

> The CLI is a projection and control surface over canonical HOPSCOTCH truth. It never creates routing, switching, neighbor, policy, or forwarding truth of its own.

The command parser may decide whether syntax is supported. The formatter may decide how canonical facts are displayed. Neither may decide what the network did.

## First interactive slice — Builder terminal surface

The original read-only command model gained a real Builder UI surface with:

- `show interfaces`
- `show route`
- `show arp`
- `show mac`

`projectBuilderCliState(...)` projects the same routed interfaces, RIB state, session ARP cache, and learned FDB facts used elsewhere in Builder. Time Machine can supply a historical RIB truth graph independently from historical physical-link state.

The terminal is a lazy-loaded, full-width dock above the normal Builder stage/control row. It is closed by default and absent from stress Builder. Its capped transcript, command history, clear action, quick commands, and open/closed state are session-only UI state.

## Second interactive slice — active Ping + Traceroute

`ping <destination>` and `traceroute <destination>` are now first-class CLI commands, but the CLI still does not simulate them.

### Command boundary

The parser recognizes exactly one destination token. The destination can identify a routed Builder node by:

- canonical node id,
- unique node label,
- configured IPv4 interface address.

Resolution is deterministic and fails closed for unknown or ambiguous destinations. Broad hostname resolution, vendor aliases, source-interface switches, packet-size flags, and other CLI grammar are intentionally deferred.

### Existing probe engine only

In LIVE Builder, an active CLI command resolves the target node and delegates to the same IPv4 `runBuilderProbe(...)` path used by ordinary Builder Ping/Traceroute controls.

That means CLI probes inherit existing truth rather than duplicating it:

- current routed source selection,
- canonical addressing and RIB/FIB behavior,
- ACL policy,
- NAT/PAT translation and session state,
- link latency/jitter/loss/MTU behavior,
- probe history,
- Device Workbench / timeline probe events,
- Track J challenge evidence and verification when the command matches the objective.

The CLI receives the returned `BuilderProbeResult` and only formats it. Ping output exposes status, RTT, path MTU, loss, path, detail, and NAT state when present. Traceroute output formats the engine's actual TTL attempts and responders.

### Time Machine remains inspection-only

Time Machine continues to support the four `show` commands against the selected historical snapshot. Active `ping` and `traceroute` commands fail with `READ_ONLY_CONTEXT` instead of running a hypothetical probe against historical truth.

This is deliberate: historical replay is an observation of recorded state, not a counterfactual execution environment.

### Terminal state semantics

The distinction is now explicit:

- `show ...` changes no network/session state and creates no Builder event,
- terminal transcript/history remains local UI state,
- LIVE `ping` / `traceroute` are genuine Builder probe actions and therefore update the same probe/NAT/challenge/session state and event journal as the ordinary GUI controls,
- Time Machine never executes active probe commands.

## Deliberate non-goals

Track K does not aim to emulate a vendor CLI grammar, boot a NOS image, or reproduce every operational command. Syntax should remain small and coherent enough that the same command means the same HOPSCOTCH concept everywhere.

Configuration commands, when they arrive, must mutate the exact same canonical configuration objects as the GUI. Protocol inspection commands must project existing protocol state rather than deriving independent control-plane truth.

## Next slices

1. Add read-only protocol/policy inspection: `show ospf neighbors`, `show bgp`, `show acl`, and `show nat`.
2. Add device-scoped terminal context only where it improves operational clarity without fragmenting canonical truth.
3. Add bounded configuration commands against the same canonical configuration mutations used by Builder controls.
4. Extend active probes to IPv6 only through the existing IPv6 probe/control-plane engine, with syntax that makes address-family intent unambiguous.
