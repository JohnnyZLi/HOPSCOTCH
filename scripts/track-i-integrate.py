from pathlib import Path

workspace = Path('src/MeasuredNetworkWorkspace.tsx')
text = workspace.read_text()
text = text.replace(
    "import { type ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';",
    "import { lazy, Suspense, type ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';",
)
marker = "const MAX_REPORT_BYTES = 10 * 1024 * 1024;\n"
insert = marker + "\nconst MeasuredNativeCorrelationPanel = lazy(() => import('./MeasuredNativeCorrelationPanel.tsx').then((module) => ({ default: module.MeasuredNativeCorrelationPanel })));\n"
if marker not in text:
    raise SystemExit('MAX_REPORT_BYTES marker not found')
text = text.replace(marker, insert, 1)
marker = "      </section>\n\n      <div className=\"measured-main\">"
insert = "      </section>\n\n      <Suspense fallback={null}><MeasuredNativeCorrelationPanel measuredState={measuredState} /></Suspense>\n\n      <div className=\"measured-main\">"
if marker not in text:
    raise SystemExit('capture strip marker not found')
text = text.replace(marker, insert, 1)
workspace.write_text(text)

package = Path('package.json')
text = package.read_text()
old = "npm run test:loopback-bridge-contract && npm run test:loopback-bridge-workspace-contract && npm run test:capture-contract"
new = "npm run test:loopback-bridge-contract && npm run test:loopback-bridge-workspace-contract && npm run test:native-companion-track-i-contract && npm run test:capture-contract"
if old not in text:
    raise SystemExit('package check marker not found')
text = text.replace(old, new, 1)
old = '    "test:loopback-bridge-workspace-contract": "node scripts/loopback-bridge-workspace-contract-check.mjs",\n'
new = old + '    "test:native-companion-track-i-contract": "node scripts/native-companion-track-i-contract-check.mjs",\n'
if old not in text:
    raise SystemExit('package script marker not found')
text = text.replace(old, new, 1)
package.write_text(text)

workflow = Path('.github/workflows/ci.yml')
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
