from pathlib import Path
p=Path('src/builder/provider.ts')
text=p.read_text()
old1="bgpControlReachable(graph,addressing,routing,viewerVtepRouterId,binding.vtepRouterId)"
new1="bgpControlReachable(graph,addressing,routing,binding.vtepRouterId,viewerVtepRouterId)"
old2="bgpControlReachable(graph,addressing,routing,viewerVtepRouterId,origin)"
new2="bgpControlReachable(graph,addressing,routing,origin,viewerVtepRouterId)"
if text.count(old1)!=1 or text.count(old2)!=1: raise SystemExit(f'EVPN directional anchors mismatch: {text.count(old1)} {text.count(old2)}')
p.write_text(text.replace(old1,new1,1).replace(old2,new2,1))
c=Path('scripts/builder-provider-contract-check.mjs'); text=c.read_text(); anchor="assert.match(providerSource,/traceBuilderForwarding/,'provider underlay must call canonical Builder forwarding');"; extra=anchor+"assert.match(providerSource,/bgpControlReachable\\(graph,addressing,routing,binding\\.vtepRouterId,viewerVtepRouterId\\)/,'EVPN Type-2 propagation must flow from advertising VTEP toward the viewing VTEP');"
if anchor not in text: raise SystemExit('contract source anchor missing')
c.write_text(text.replace(anchor,extra,1))
Path('scripts/track-g-direction.py').unlink()
Path('scripts/track-g-direction-trigger.txt').unlink(missing_ok=True)
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
