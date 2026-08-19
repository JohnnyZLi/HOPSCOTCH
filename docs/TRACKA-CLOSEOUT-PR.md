## Goal

Close active-roadmap **Track A — Builder-wide time machine + causal troubleshooting** by making remaining runtime/protocol state time-native and projecting Track D application failures into independent causal truth dimensions.

## In progress

- compact protocol database/counter rows in Device Workbench
- event-time projections for ARP, Ethernet flow/FDB, NAT, IPv6 runtime state, probes, and application history
- canonical application-stage events chained into the existing Builder event clock
- deterministic causal diagnosis across physical, L2, resolution, routing, policy, translation, link, transport, TLS, application, and return-path truth
- historical visibility limits that prevent future transaction outcomes from leaking backward
- first-broken-boundary diagnosis reusing Track D canonical stages rather than rerunning the network
- permanent causal diagnosis contract

This PR remains draft until the full repository and production-browser matrix is green and the active roadmap is updated.
