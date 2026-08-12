# Lab 09F — Explicit loopback diagnostics bridge

Lab 09F adds an optional, user-initiated transport from HOPSCOTCH to a locally running Network Diagnostics bridge without adding automatic LAN discovery or a second measurement truth path.

## Why loopback-only

The public HOPSCOTCH site must not behave like a network scanner. The first bridge transport therefore accepts only explicit loopback origins:

- `localhost`
- `127.0.0.0/8`
- `::1`

Private LAN addresses, `.local` hosts, arbitrary public hostnames, credentials, URL paths, query strings, and fragments are rejected before any fetch occurs.

This is deliberately narrower than what browsers may technically allow. It keeps 09F about an explicitly running companion service on the same host rather than discovery of devices or services on the surrounding network.

## Two separate user actions

`CONNECT` and `REFRESH REPORT` are different operations.

1. Connect performs exactly one fixed handshake request.
2. A connected bridge exposes identity/version only after the handshake passes validation.
3. Refresh Report performs exactly one fixed report request.
4. That report is passed through the existing Network Diagnostics report-v2 adapter, native provenance validator, and measured-state projection.

Connecting does not itself create measured facts. Refreshing a report is the explicit measurement replacement action.

## Fixed transport surface

Default origin:

```text
http://127.0.0.1:8765
```

Fixed endpoints:

```text
GET /api/hopscotch/v1/handshake
GET /api/hopscotch/v1/report
```

Requests use CORS, omit credentials, disable cache reuse, reject redirects, request JSON, and use a bounded abort signal. There is no WebSocket, EventSource, interval, or background polling path.

## Handshake v1

A valid handshake contains only:

```text
schema = hopscotch.network-diagnostics-bridge
version = 1
application = Network Diagnostics Suite
reportSchemaVersion = 2.0
reportPath = /api/hopscotch/v1/report
bridgeVersion = <non-empty bounded string>
capabilities = [report-v2]
```

Unknown fields fail closed. In particular, the handshake cannot carry measured facts or a caller-controlled report URL.

## Truth boundary

The bridge client imports no Journey code. A successful report response is consumed only by `ingestNetworkDiagnosticsReportV2()`, which already enforces the 09C → 09A → 09B path.

The bridge cannot directly populate React measured facts, Journey events, modifiers, reducer state, or semantic scenes.

## Workspace behavior

Lab 09 keeps file import and the optional bridge as parallel acquisition methods for the same measured-state slot.

- file import remains available
- Connect validates only the bridge
- Refresh Report may replace the measured session state
- failed refresh preserves the previous valid measurement
- Disconnect removes bridge connection state but does not erase the last valid report
- Clear erases measured report state but does not implicitly connect/disconnect anything

## Out of scope

- automatic localhost port scanning
- mDNS or LAN discovery
- RFC1918/ULA device targets
- background polling
- live streaming
- native bridge/server implementation in Network Diagnostics Suite
- credentials or cookie-bearing bridge requests
- bypassing browser CORS/local-network permission behavior

The first merge gate is the pure loopback/handshake/report contract plus the promoted workspace UI passing the full existing correctness suite. Production browser interaction coverage and shared-doc synchronization follow only after that source gate is green.
