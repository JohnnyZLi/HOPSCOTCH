# Track K — vendor-neutral HOPSCOTCH CLI

Track K gives the Builder a terminal interface without introducing a second network model or pretending to run Cisco, Juniper, Linux, or other vendor device images.

## Product invariant

> The CLI is a projection and control surface over canonical HOPSCOTCH truth. It never creates routing, switching, neighbor, policy, or forwarding truth of its own.

The command parser may decide whether syntax is supported. The formatter may decide how canonical facts are displayed. Neither may decide what the network did.

## First interactive slice — Builder terminal surface

The existing read-only command model now has a real Builder UI surface.

Supported commands remain intentionally bounded:

- `show interfaces`
- `show route`
- `show arp`
- `show mac`

Unsupported configuration, probe, and vendor-specific syntax still fails closed. `ping`, `traceroute`, OSPF/BGP detail commands, ACL/NAT inspection, and configuration commands are later Track K slices.

### Canonical state adapter

`projectBuilderCliState(...)` converts the same Builder facts used by the rest of the product into the four existing CLI projections:

- routed IPv4 interfaces come from canonical Builder addressing plus physical routed-link state,
- route rows come from the canonical RIB graph and routing configuration,
- ARP rows come from the session ARP cache,
- MAC rows come from the learned FDB attached to the current Ethernet-flow session state.

The adapter copies session rows and never mutates its input.

Historical Time Machine scenes can provide a historical RIB truth graph independently from historical physical-link state. CLI queries therefore inspect the selected historical snapshot instead of silently recomputing current live state.

### Terminal UX

The terminal is a lazy-loaded, full-width dock above the normal Builder stage/control row. It is closed by default and absent from stress Builder.

The wide dock is deliberate: route and interface tables are operational data and should not be squeezed into the 360 px Builder control column.

Terminal behavior is session-only UI state:

- command transcript is capped,
- command history supports Up/Down,
- Ctrl/Cmd+L clears the local transcript,
- Escape closes the dock,
- quick-command buttons execute only the four supported `show` commands,
- each transcript entry records whether it queried LIVE or a Time Machine history snapshot,
- opening or using the terminal does not create canonical Builder events or alter network state.

## Deliberate non-goals

This track does not aim to emulate a vendor CLI grammar, boot a NOS image, or reproduce every operational command. Syntax should remain small and coherent enough that the same command means the same HOPSCOTCH concept everywhere.

Configuration commands, when they arrive, must mutate the exact same canonical configuration objects as the GUI. Probe commands must call the existing probe engines rather than implement terminal-specific packet logic.

## Next slices

1. Route `ping` and `traceroute` through the existing Builder probe engines.
2. Add read-only protocol/policy inspection: `show ospf neighbors`, `show bgp`, `show acl`, and `show nat`.
3. Add device-scoped terminal context only where it improves operational clarity without fragmenting canonical truth.
4. Add bounded configuration commands against the same canonical configuration mutations used by Builder controls.
