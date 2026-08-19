# Track A closeout — validation notes

This branch closes the remaining active-roadmap Track A depth by extending the existing Builder event clock rather than introducing a troubleshooting simulator.

The closeout is intentionally constrained:

- Track D remains the canonical application transaction and first-broken-boundary source.
- Track A projects that transaction into independent physical, L2, resolution, routing, policy, translation, link, transport, TLS, application, and response dimensions.
- `NOT_REACHED` is never promoted into failure.
- historical diagnosis is bounded by the selected application stage, so later success/failure cannot leak backward in time.
- completed application transactions are session-only and bounded; they are not added to scenario JSON.
- protocol database/counter rows are derived from the selected Builder snapshot.
- ARP, Ethernet flow, NAT, IPv6 runtime state, probes, and application history have explicit event-time projection boundaries.
- the diagnosis never reruns routing, forwarding, ACL/NAT, transport, or application behavior.

The permanent `builder-causal-diagnosis` contract is part of `npm run check`. This note is temporary working documentation and will be folded into `docs/TRACKA.md` before merge.
