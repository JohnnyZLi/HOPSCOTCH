# Lab 07I — BGP route leak and policy anomaly

Lab 07I adds a deterministic `route-leak` GOD MODE modifier that teaches a different failure class from every earlier Lab 07 story: **forwarding can remain reachable while the selected route violates interdomain policy.** This slice completes the curated Lab 07 GOD MODE modifier series.

## Reuse the Lab 05 policy model

The Journey does not invent a second BGP topology. It reuses the documentation-only AS graph and valley-free teaching rules in `src/internet/asModel.ts`.

The legitimate path at AS64504 is:

`AS64504 → AS65540 → AS65538`

Its relationship sequence is `peer → down`, so it is accepted by the existing valley-free enumerator. Under the existing teaching preference model, the first hop is peer-learned and receives LOCAL_PREF 200.

The leak uses relationships that already exist in the same graph:

1. AS64500 learns the destination from peer AS65538.
2. AS64500 incorrectly exports that peer-learned route to provider AS64504.
3. AS64504 therefore sees `AS64504 → AS64500 → AS65538` as a customer-learned advertisement.
4. The deterministic teaching LOCAL_PREF becomes 300, so the leaked advertisement wins over the legitimate peer route.
5. The resulting relationship sequence is `down → peer`, which is physically connected but rejected by the normal valley-free path enumerator.

This is a curated teaching policy, not a claim that every network implements identical BGP best-path preferences.

## Causal story

The canonical route-leak episode is:

1. normal policy-compliant interdomain path exists
2. peer-learned route is leaked upward from AS64500 to provider AS64504
3. AS64504 selects the customer-learned advertisement because teaching LOCAL_PREF changes 200 → 300
4. HOPSCOTCH shows `REACHABLE = YES` and `POLICY COMPLIANT = NO` at the same time
5. the anomaly is detected and the leaked advertisement is withdrawn
6. AS64504 returns to `AS64504 → AS65540 → AS65538`
7. transport begins only after policy has been restored

No local OSPF failure, packet loss, retransmission, RTO/PTO, TLS failure, HTTP 503, or partition is implied by LEAK alone.

## Modifier order

Canonical order becomes:

`DNS FAIL → ROUTE → ROUTE LEAK → SERVER → LOSS → OUTAGE → LATENCY → CONGESTION → PARTITION`

ROUTE LEAK occurs after local routing and before transport/application response modifiers. PARTITION remains terminal and last. ROUTE and OUTAGE remain mutually exclusive with each other.

## State boundary

The Journey exposes dedicated interdomain policy state and metrics rather than overloading local route metrics. The policy episode tracks:

- legitimate and leaked ASN paths
- legitimate `peer → down` versus leaked `down → peer` traversals
- legitimate LOCAL_PREF 200 versus leaked LOCAL_PREF 300
- leak source AS64500 and decision AS64504
- peer-learned → provider bad export
- selected-path policy compliance
- export-policy compliance
- forwarding reachability as an independent boolean

Policy state progresses through normal, leak advertised, leaked, anomaly, and restored phases while local route reachability remains healthy.

## UI

The Journey adds a tenth `LEAK` GOD MODE control and an Internet-scale policy panel showing the legitimate and leaked paths, the bad export, active LOCAL_PREF, reachability, and policy compliance. Route-leak events use their own rail/scrubber visual language so they are not confused with local ROUTE/PARTITION state.

## Validation

The permanent `journey-route-leak-contract-check.mjs` cross-checks the Journey against the actual Lab 05 `simulatedAsGraph`, `traversalFor()`, and `enumeratePolicyPaths()` implementation. It verifies the legitimate path is accepted, the leaked `down → peer` path is rejected by normal policy enumeration, reachability remains true through the anomaly, policy restoration occurs before transport, composition stays canonical, and v1/v2/browser persistence round-trip correctly.

The validated transformation has been promoted into the permanent branch source and normal read-only CI passes on that permanent tree.

The exact GitHub Actions production artifact was then exercised directly in Linux Chromium. Desktop TCP/H2 shows the leaked path with teaching LOCAL_PREF 300 while simultaneously displaying `REACHABLE = YES` and `POLICY COMPLIANT = NO`; withdrawal/restoration returns to the legitimate path at LOCAL_PREF 200 and policy compliance YES. QUIC/H3 preserves the same interdomain policy story. At 390 px, all ten GOD MODE controls fit without horizontal overflow as a balanced 4 + 4 + 2 grid, with PARTITION and LEAK sharing the final row; the policy panel stacks cleanly at full mobile width. Playback/event-rail follow keeps document `scrollY = 0`. Reduced motion preserves the restored QUIC state synchronously. No runtime exceptions or console errors were observed during the artifact audit.
