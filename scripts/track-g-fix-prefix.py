from pathlib import Path
p=Path('src/builder/provider-config.ts')
text=p.read_text()
old="return (ipInt(address)&p.mask)===p.network;"
new="return ((ipInt(address)&p.mask)>>>0)===p.network;"
if old not in text: raise SystemExit('prefix membership anchor missing')
p.write_text(text.replace(old,new,1))
Path('scripts/track-g-fix-prefix.py').unlink()
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
