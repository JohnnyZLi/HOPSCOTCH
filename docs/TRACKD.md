# Track D — end-to-end application traffic inside Builder

Track D closes the gap between HOPSCOTCH's network configuration/control-plane simulator and its application/protocol teaching models.

The central rule is simple:

> An application exchange is not allowed to exist unless the same canonical Builder truth can deliver it.

Track D therefore does **not** add an HTTP demo, a second transport simulator, or an application animation that skips the network underneath it. A request is one deterministic transaction whose later layers are gated by earlier ones.

## Causal stack

A Track D transaction evaluates, in order:

1. DHCP / addressing
2. service and deterministic DNS intent
3. Ethernet / VLAN / STP plus ARP, or IPv6 Neighbor Discovery
4. routing / installed FIB truth
5. ACL and NAT/PAT policy
6. routed link latency, jitter, bandwidth, loss, MTU, and queue metadata
7. transport
8. TLS / QUIC crypto when required
9. application service
10. reverse forwarding / policy / translation / resolution and response delivery

The first failed boundary is preserved. Every later layer is `NOT_REACHED`; HOPSCOTCH does not convert a known Layer-2, route, policy, MTU, or return-path failure into a generic application timeout.

## Hosted services

`src/builder/application.ts` defines a bounded vendor-neutral service catalog. Builder endpoints can host:

- DNS
- HTTP
- HTTPS over TCP + TLS 1.3 + HTTP/2
- HTTPS over QUIC + TLS 1.3 + HTTP/3
- SSH reachability/session establishment
- generic TCP
- generic UDP

The default teaching topology exposes all of those service kinds on the built-in application endpoint. The model itself accepts services on any Builder endpoint.

Service configuration is deterministic simulation truth. It is not an observation of a real host and is not persisted as evidence.

## Access-segment reconciliation

Before Track D, Builder intentionally contained two separately useful models:

- the routed graph (`client → edge → ... → core → app`), and
- the explicit LAN/VLAN teaching fabric.

Track D does not pretend those are physically the same topology.

For each routed endpoint access segment:

- if the Ethernet model contains matching endpoint/router devices and matching interface addresses, the application transaction consumes that configured Ethernet/VLAN/STP truth directly;
- otherwise the existing routed endpoint↔router segment is projected as **its own Ethernet broadcast domain** for ARP and Layer-2 gating.

The projection introduces no hidden switch, path, or extra network hop. Its VLAN number is an internal namespace for reuse of the existing bounded Ethernet/STP/ARP engines, not a claim that an 802.1Q tag was configured on the routed link.

The UI labels this distinction as either `CONFIGURED ETHERNET` or `ROUTED ACCESS PROJECTION`.

## DHCP and addressing

If a source endpoint is an explicit Ethernet DHCP client, application forwarding requires an active lease from the existing DHCP state. Track D does not mint an application-only lease.

Otherwise the request consumes the endpoint's canonical static Builder address/default-gateway configuration.

This is intentionally `DHCP / ADDRESSING`: the source uses whichever canonical host-configuration mode is actually active.

## IPv4 forwarding, ACL, and NAT

IPv4 application requests use the same Builder forwarding and policy machinery already used elsewhere:

- `traceBuilderForwarding(...)`
- `runBuilderNatOutboundFlow(...)`
- ACL decisions at routed boundaries
- active PAT/static NAT state
- `runBuilderNatInboundFlow(...)` for translated return traffic

A translated request therefore cannot receive a response unless the reverse packet matches the actual translation state and current return path.

No application-specific routing table, ACL evaluator, or NAT table exists.

## IPv6 and Neighbor Discovery

IPv6 application transactions use:

- the existing IPv6 FIB and OSPFv3-depth route overlay,
- actual per-hop `resolveBuilderIpv6TraceNeighbors(...)` Neighbor Discovery state,
- existing IPv6 address-policy decisions,
- reverse-path FIB and ND truth.

Track D does not invent NAT66.

## Link truth

After route and policy success, the representative transport unit consumes the current Builder link profiles.

The transaction can therefore stop at the link boundary because of:

- deterministic configured loss,
- MTU smaller than the representative packet,
- or a later reverse-path deterministic drop.

Latency and bandwidth displayed by the transaction come from Builder link characteristics, never from route cost.

## Canonical transport and application models

TCP/H2 and QUIC/H3 sessions reuse `buildJourneyScenario(...)` from the canonical Journey/Lab 03 model.

Track D projects the existing deterministic Journey events into the Builder transaction for:

- TCP SYN / SYN-ACK / establishment,
- QUIC Initial / Handshake / establishment,
- TLS messages, validation, and keys,
- HTTP/2 control/request/response/data,
- HTTP/3 request/response/data,
- canonical packet-inspection moments and transfer completion.

Generic TCP and SSH reuse the canonical TCP establishment events, then stop at their own bounded application-service semantics. DNS and generic UDP use datagram semantics and deliberately do **not** manufacture a TCP/QUIC handshake.

The Builder graph remains authoritative for topology, addressing, FIB, ACL/NAT, and links. Journey remains authoritative for the TCP/QUIC/TLS/HTTP event vocabulary. They are cameras on one transaction, not competing simulators.

## Exact packet bytes

Once transport is reached, Track D creates representative transaction packets with the existing `PacketConfig` + `buildPacket(...)` model.

Packets can represent:

- source-access request state,
- post-NAT request state when translation occurs,
- delivered response-access state.

Each packet stores the exact `PacketConfig` and resulting `PacketSnapshot`. Opening Packet Microscope passes that exact configuration back to the existing microscope, so the displayed bytes and checksums are regenerated from the same canonical packet builder.

If the transaction fails before transport, there are no packet bytes to inspect. HOPSCOTCH does not fabricate a packet that never reached that causal boundary.

## Four cameras

The integrated Builder surface exposes the same transaction through four projections:

### Builder

Shows the ordered dependency stack with `PASS`, `FAIL`, and `NOT_REACHED`, including participating graph nodes and routed links.

### Protocol

Shows the canonical Journey/Lab 03 TCP/QUIC/TLS/HTTP events for the successfully reached transport/application model.

### Journey

Places Builder network stages and canonical protocol events on one causal rail. Builder supplies actual simulated network truth; Journey supplies protocol-native event semantics.

### Packet

Lists exact representative frames/packets and opens the existing Packet Microscope in-place.

Changing camera never runs a new simulation and never creates a new transaction.

## Session-state integration

`NetworkBuilder` passes its live canonical state into `BuilderApplicationPanel`.

After a transaction, the panel returns the derived session state to the same Builder instance:

- ARP cache
- NAT/PAT sessions
- DHCP lease state
- IPv6 control/ND state

This prevents Track D from becoming a private application-only state island.

Historical Builder scenes are read-only. The Track D run control is disabled while the time machine is not LIVE.

## Determinism and limits

Track D keeps bounded, deterministic behavior:

- at most 96 hosted services per validated catalog,
- stable ephemeral source-port selection from service + transaction sequence,
- deterministic routed link-loss decisions,
- bounded canonical Journey event projection,
- bounded representative packet payloads,
- no sockets, uploads, scanning, credentials, or external network access.

## Validation

`npm run test:builder-application-contract` is part of `npm run check`.

The permanent contract covers:

- all six hosted-service categories,
- full IPv4 HTTPS/TCP/H2/TLS application completion,
- edge PAT request + active-state return translation,
- QUIC/H3 reuse over UDP,
- DNS/generic UDP without fake handshakes,
- SSH using canonical TCP establishment,
- ACL denial with every later layer `NOT_REACHED`,
- OSPF reconvergence over an alternate route,
- partition/failure behavior before transport,
- IPv6 forwarding plus actual ND state,
- exact Packet model byte regeneration,
- the four shared transaction cameras,
- the explicit no-second-simulator boundary.

The production browser/performance matrix remains an additional closeout gate because Track D is mounted in the real Builder workspace.

## Closeout boundary

Track D is complete when:

- all active-roadmap Track D checkboxes are implemented by the shared transaction,
- the integrated Builder surface is present on the production path,
- the permanent contract is green,
- existing Builder/Journey/Packet contracts remain green,
- production performance and compatibility profiles remain inside existing budgets.

Deeper application protocols, real TCP queue coupling, richer payload serialization, and broader service authoring can continue under later tracks without reopening Track D's fundamental integration contract.