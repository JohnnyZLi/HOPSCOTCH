from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise SystemExit(f'missing docs anchor in {path}: {old[:120]!r}')
    file.write_text(text.replace(old, new, 1))


roadmap_section = '''### 07I — BGP route leak + policy anomaly
- [x] distinct `route-leak` modifier at the interdomain/BGP policy boundary
- [x] reuse the existing Lab 05 documentation-AS graph and valley-free policy enumerator instead of inventing a second BGP model
- [x] legitimate AS64504 → AS65540 → AS65538 path remains `peer → down` with teaching LOCAL_PREF 200
- [x] AS64500 leaks a peer-learned AS65538 route upward to provider AS64504
- [x] leaked AS64504 → AS64500 → AS65538 path is physically connected but `down → peer` and rejected by the normal valley-free enumerator
- [x] deterministic teaching LOCAL_PREF changes 200 → 300 while the leaked customer advertisement is selected
- [x] explicit policy metrics keep forwarding reachability separate from selected-path/export-policy compliance
- [x] UI simultaneously shows `REACHABLE = YES` and `POLICY COMPLIANT = NO`
- [x] anomaly containment withdraws the leak and restores the legitimate peer path before transport begins
- [x] LEAK-only scenarios fabricate no local route failure, partition, transport loss/recovery, RTO/PTO, TLS failure, or server failure
- [x] canonical DNS FAIL → ROUTE → LEAK → SERVER → LOSS → OUTAGE → LATENCY → CONGESTION → PARTITION composition is independent of UI selection order
- [x] schema-v1 single LEAK and schema-v2 composed sharing/persistence compatibility
- [x] tenth GOD MODE selector, Internet policy panel, distinct rail marker, and scrubber marker
- [x] mobile ten-control 4 + 4 + 2 layout remains collision- and overflow-free with viewport-stable playback
- [x] permanent route-leak/Lab-05-model/composition contract wired into `npm run check`
- [x] exact GitHub Actions production-artifact desktop/mobile/reduced-motion audit with zero runtime/console errors

**Lab 07 GOD MODE modifier series complete.** Reachability, policy correctness, routing reachability, transport recovery, latency, congestion, DNS availability, and application-service availability remain separate semantic dimensions.
'''
replace_once(
    'docs/ROADMAP.md',
    '### Later GOD MODE stories\n- [ ] route leak / policy anomaly teaching scenario',
    roadmap_section.rstrip(),
)

replace_once(
    'docs/ARCHITECTURE.md',
    '                   route-failure\n                   server-failure',
    '                   route-failure\n                   route-leak\n                   server-failure',
)
replace_once(
    'docs/ARCHITECTURE.md',
    '→ route-failure\n→ server-failure',
    '→ route-failure\n→ route-leak\n→ server-failure',
)
replace_once(
    'docs/ARCHITECTURE.md',
    '- Pre-transport route failure invalidates the primary route, runs SPF, installs the alternate, and converges before transport starts.\n- Server failure occurs after the canonical HTTP request',
    '- Pre-transport route failure invalidates the primary route, runs SPF, installs the alternate, and converges before transport starts.\n- Route leak is an interdomain policy anomaly built from the existing Lab 05 AS graph. AS64500 incorrectly exports a peer-learned route to provider AS64504; teaching LOCAL_PREF 300 temporarily beats the legitimate peer-learned 200 route even though the selected `down → peer` path violates the normal valley-free policy. Reachability stays true and policy correctness becomes false until the bad advertisement is withdrawn.\n- Server failure occurs after the canonical HTTP request',
)
replace_once(
    'docs/ARCHITECTURE.md',
    '- application-service state and HTTP 503 / Retry-After / idempotency / connection-reuse facts\n- TCP sequence/retransmission plus RTT/RTO state',
    '- application-service state and HTTP 503 / Retry-After / idempotency / connection-reuse facts\n- interdomain policy state: legitimate/leaked ASN paths, relationship traversals, LOCAL_PREF, leak source/decision AS, export-policy compliance, selected-path compliance, and reachability as an independent boolean\n- TCP sequence/retransmission plus RTT/RTO state',
)
replace_once(
    'docs/ARCHITECTURE.md',
    'New single-modifier path-outage, congestion, DNS-failure, server-failure, and partition scenarios also fit v1 without a schema bump.',
    'New single-modifier path-outage, congestion, DNS-failure, server-failure, route-leak, and partition scenarios also fit v1 without a schema bump.',
)
replace_once(
    'docs/ARCHITECTURE.md',
    '- Pre-transport route convergence does not fabricate RTO/PTO behavior.\n- Mid-transfer outage does not silently tear down an established connection.',
    '- Pre-transport route convergence does not fabricate RTO/PTO behavior.\n- A BGP route leak can remain forwarding-reachable while violating policy. The Journey reuses the Lab 05 valley-free model and never turns policy noncompliance into a fabricated local route failure or transport loss.\n- The curated leak demonstrates one teaching preference rule (customer 300 > peer 200 > provider 100); it is not presented as universal BGP best-path behavior.\n- Mid-transfer outage does not silently tear down an established connection.',
)
replace_once(
    'docs/ARCHITECTURE.md',
    '9. **Partition contracts** — dual-link failure, zero SPF candidates, stalled-not-closed transport, successful-tail removal, terminal failure state, composition, and persistence.\n10. **TypeScript checks**',
    '9. **Partition contracts** — dual-link failure, zero SPF candidates, stalled-not-closed transport, successful-tail removal, terminal failure state, composition, and persistence.\n10. **Route-leak contracts** — direct reuse of the Lab 05 AS graph/enumerator, legitimate peer→down acceptance, leaked down→peer rejection, 200→300 teaching preference, reachable-but-policy-invalid reducer state, restoration before transport, composition, and persistence.\n11. **TypeScript checks**',
)
replace_once('docs/ARCHITECTURE.md', '11. **Production build**', '12. **Production build**')
replace_once('docs/ARCHITECTURE.md', '12. **Worker contracts**', '13. **Worker contracts**')
replace_once('docs/ARCHITECTURE.md', '13. **Exact-artifact browser audit**', '14. **Exact-artifact browser audit**')
replace_once('docs/ARCHITECTURE.md', '14. **Desktop/mobile/reduced-motion assertions**', '15. **Desktop/mobile/reduced-motion assertions**')
replace_once(
    'docs/ARCHITECTURE.md',
    'HTTP service-unavailable retry, and terminal network partition behavior.',
    'HTTP service-unavailable retry, terminal network partition behavior, and BGP route-leak policy anomalies that keep reachability separate from policy correctness.',
)
replace_once(
    'docs/ARCHITECTURE.md',
    '- route leak / policy-anomaly stories that preserve the distinction between **reachability** and **policy correctness**\n- loss-based or AQM variants',
    '- loss-based or AQM variants',
)
