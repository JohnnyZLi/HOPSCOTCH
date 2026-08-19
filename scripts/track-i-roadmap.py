from pathlib import Path
import re

path=Path('docs/ROADMAP.md')
text=path.read_text()
pattern=r"## Current priority order\n.*?(?=### Track K — vendor-neutral HOPSCOTCH CLI)"
replacement="""### Completed active track — Track I native companion integration

Track I connects the existing Network Diagnostics report-v2 / loopback companion evidence to HOPSCOTCH's public Internet evidence without collapsing provenance.

- [x] surface local interfaces, routes, DNS configuration, traceroute/ICMP, and bounded transport telemetry as `LOCAL MEASURED`
- [x] correlate local measurements with edge, public-routing, and public-facility context without conflating evidence sources
- [x] visualize local host → gateway → measured hops → explicit observation boundary → public observations → destination with provenance on every stage
- [x] retain the no-credentials, no-scanning/discovery, no-hidden-background-collection boundary

The existing report-v2 adapter already carried the required native facts, so Track I does not broaden the Network Diagnostics bridge or add a command API. Public context loads only after an explicit action and reuses the existing HOPSCOTCH Internet-evidence and PeeringDB APIs. Measured traceroute hops never inherit an ASN, facility, or location from independent public data; same-city facilities are context rather than proof of traversal. `docs/TRACKI.md` is the closeout architecture record.

---

## Current priority order

With captured evidence, application truth, causal replay, authoring, enterprise depth, data-plane realism, routing policy, provider overlays, and native/public evidence correlation closed, the next highest-value work is deterministic troubleshooting practice over canonical broken networks.

### 1. Track J — troubleshooting challenges

- [ ] generate deterministic broken networks from canonical configuration/state rather than hand-authored answer text
- [ ] cover addressing, gateway, VLAN, trunk, STP, ARP/ND, routing, OSPF, ACL, NAT, DHCP, MTU, DNS, transport, and BGP policy failures
- [ ] users diagnose with normal Builder inspectors/probes, not challenge-only shortcuts
- [ ] score evidence gathering and causal reasoning, not just the final repair
- [ ] reproducible challenge seeds and shareable scenarios

---

## Remaining regular tracks

These remain real product work. They should follow Track J unless a bounded dependency requires a different order.

"""
next_text,count=re.subn(pattern,replacement,text,flags=re.S)
if count!=1:
    raise SystemExit(f'roadmap section replacement count={count}')
path.write_text(next_text)

workflow=Path('.github/workflows/ci.yml')
workflow.write_text("""name: CI

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
Path(__file__).unlink()
