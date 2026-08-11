from pathlib import Path
import json

root = Path('.')

package_path = root / 'package.json'
package = json.loads(package_path.read_text())
scripts = package['scripts']
scripts['compatibility:chrome'] = 'node scripts/performance-profile.mjs --compatibility'
scripts['compatibility:firefox'] = 'node scripts/firefox-compatibility.mjs'
package_path.write_text(json.dumps(package, indent=2) + '\n')

compat_path = root / '.github/workflows/compatibility.yml'
compat = compat_path.read_text()
compat = compat.replace(
    "      - name: Apply Lab 08C profiler candidate\n        run: python3 scripts/apply-lab08c.py\n",
    "",
)
compat = compat.replace(
    "        run: node scripts/performance-profile.mjs --compatibility\n",
    "        run: npm run compatibility:chrome\n",
)
compat = compat.replace(
    "      - name: Probe hosted Firefox automation capability\n        run: node scripts/firefox-capability-probe.mjs\n",
    "",
)
compat = compat.replace(
    "      - name: Apply Firefox BiDi viewport candidate\n        run: python3 scripts/apply-lab08c-firefox.py\n",
    "",
)
compat = compat.replace(
    "        run: node scripts/firefox-compatibility.mjs\n",
    "        run: npm run compatibility:firefox\n",
)
compat = compat.replace(
    "          path: |\n            artifacts/firefox-capability.json\n            artifacts/firefox-compatibility.json\n",
    "          path: artifacts/firefox-compatibility.json\n",
)
compat_path.write_text(compat)

ci_path = root / '.github/workflows/ci.yml'
ci_path.write_text("""name: CI

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

for relative in [
    'scripts/apply-lab08c.py',
    'scripts/apply-lab08c-firefox.py',
    'scripts/firefox-capability-probe.mjs',
    'scripts/finalize-lab08c.py',
]:
    path = root / relative
    if path.exists():
        path.unlink()
