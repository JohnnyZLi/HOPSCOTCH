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

## Permanent validation

`npm run check` includes both the pure loopback transport contract and the Lab 09 workspace separation contract. Together they prove loopback-only normalization, fixed endpoints, strict handshake parsing, omitted credentials, bounded one-shot requests, fail-before-fetch behavior for non-loopback input, mandatory 09C ingestion, unchanged Journey construction/reducer state, and independent Connect / Refresh / Disconnect / Clear state transitions.

The existing compatibility-only Chrome profiler now runs the bridge flow before the normal Lab 09 file-import flow on desktop, exact 390 px mobile, and reduced motion. Its mocked loopback transport covers:

- private-LAN origin rejection before `fetch`
- network/CORS-style `Failed to fetch` failure
- rejected wrong-schema handshake
- successful Connect with measured state still empty
- valid Refresh Report through the existing ingestion path
- invalid replacement preserving the previous valid measurement
- Clear while the bridge remains connected
- re-refresh after Clear
- Disconnect while the measured report remains active
- exact fixed handshake/report URLs plus CORS / `credentials: omit` / no-store / redirect-error request options

That flow is permanent under Chrome default, explicit SwiftShader, and WebGL-disabled compatibility jobs. Firefox/Gecko remains covered by the existing semantic compatibility pass.

## Exact production-artifact audit

Clean source head `ca03de0` produced CI artifact `hopscotch-dist` with digest `sha256:f57c8fc759f77c60dfa9529cc3fea8bd2f0f65cb6dde1ff6c64f602d5f621d81`.

The exact built Vite HTML/CSS/JS bytes were rendered directly in Linux Chromium with a mocked loopback bridge:

- desktop 1440: connected-before-refresh remains `data-measured-loaded=false`; valid refresh becomes measured without changing bridge state; invalid refresh keeps both connection and previous report
- exact 390 px mobile: bridge, capture strip, category grid, measured facts, and provenance panel stack without horizontal overflow
- reduced-motion 1280: valid bridge/report state renders synchronously with reduced motion enabled
- all audited states had `scrollWidth === innerWidth`, `scrollY === 0`, and zero page runtime errors
- the bridge remains a compact acquisition strip; the measured report remains the primary workspace after refresh

On the same clean head, ordinary CI, full Performance, Chrome default/SwiftShader/WebGL-disabled Compatibility, and Firefox/Gecko semantic Compatibility all passed.

## Out of scope

- automatic localhost port scanning
- mDNS or LAN discovery
- RFC1918/ULA device targets
- background polling
- live streaming
- native bridge/server implementation in Network Diagnostics Suite
- credentials or cookie-bearing bridge requests
- bypassing browser CORS/local-network permission behavior
