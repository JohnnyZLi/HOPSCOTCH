from pathlib import Path
p=Path('docs/ROADMAP.md')
text=p.read_text()
old="""## Current priority order

With captured evidence, end-to-end application truth, causal replay, authoring, enterprise L2/L3 depth, data-plane realism, and routing-policy depth closed, the next highest-value work is explicit underlay/overlay and service-provider behavior.

### 1. Track G — service-provider + overlay networking

- [ ] GRE / IP-in-IP with explicit underlay/overlay separation
- [ ] IPsec-style and WireGuard-style encrypted-tunnel semantics without pretending to implement production cryptography
- [ ] MPLS label push/swap/pop, LSP state, and label forwarding tables
- [ ] VXLAN VNI/VTEP overlays with distinct underlay and overlay reachability
- [ ] EVPN MAC/IP learning after VXLAN/BGP foundations are mature

---

## Remaining regular tracks

These remain real product work. They should follow Track G unless a bounded dependency requires a different order.

### Track I — native companion integration
"""
new="""### Completed active track — Track G service-provider + overlay networking

Track G adds explicit service-provider and overlay behavior while preserving the existing Builder topology/RIB/FIB as underlay truth.

- [x] GRE / IP-in-IP with explicit inner-vs-outer addressing, canonical underlay link paths, encapsulation overhead, and effective tunnel MTU
- [x] IPsec-style and WireGuard-style authentication/handshake/overhead semantics without storing key material or pretending to implement production cryptography
- [x] MPLS label push/swap/pop, bounded LSP state, and per-router label forwarding rows derived from the canonical underlay path
- [x] VXLAN VNI/VTEP overlays with explicit UDP/4789 outer state and underlay-driven UP / DEGRADED / DOWN reachability
- [x] EVPN Type-2 MAC/IP and Type-3 IMET teaching state with route-target/VTEP provenance, Track F iBGP split-horizon / route-reflector behavior, and independent underlay reachability

Unknown-MAC ingress replication is observable but never treated as proof of destination delivery. Overlay learning never rewrites or substitutes for the underlay RIB/FIB. Provider configuration remains additive to scenario v9, while the heavier tunnel/MPLS/VXLAN/EVPN algorithms and UI stay behind the existing lazy routing-policy workspace. `docs/TRACKG.md` is the closeout architecture record.

---

## Current priority order

With captured evidence, end-to-end application truth, causal replay, authoring, enterprise L2/L3 depth, data-plane realism, routing-policy depth, and service-provider overlays closed, the next highest-value work is correlating local native measurements with the existing provenance-aware network model.

### 1. Track I — native companion integration
"""
if old not in text: raise SystemExit('Track G priority block not found')
text=text.replace(old,new,1)
old2="""- [ ] retain the no-credentials, no-scanning/discovery, no-hidden-background-collection boundary

### Track J — troubleshooting challenges
"""
new2="""- [ ] retain the no-credentials, no-scanning/discovery, no-hidden-background-collection boundary

---

## Remaining regular tracks

These remain real product work. They should follow Track I unless a bounded dependency requires a different order.

### Track J — troubleshooting challenges
"""
if old2 not in text: raise SystemExit('Track I/J boundary not found')
text=text.replace(old2,new2,1)
p.write_text(text)
Path('scripts/track-g-roadmap-closeout.py').unlink()
Path('scripts/track-g-roadmap-trigger.txt').unlink(missing_ok=True)
Path('.github/workflows/ci.yml').write_text("""name: CI

on:
  push:
    branches: [main]
  pull_request:

permissions:
  contents: read

jobs:
  build:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm run check
      - name: Upload production build
        if: github.event_name == 'pull_request'
        uses: actions/upload-artifact@v4
        with:
          name: hopscotch-dist
          path: dist
          if-no-files-found: error
          retention-days: 3
""")
