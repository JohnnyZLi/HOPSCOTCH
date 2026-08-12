from pathlib import Path
import json

root = Path('.')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one anchor, found {count}')
    return text.replace(old, new, 1)

explore_path = root / 'src/ExploreLauncher.tsx'
explore = explore_path.read_text()
explore = replace_once(
    explore,
    "import { useEffect, useRef } from 'react';\n",
    "import { useEffect, useRef } from 'react';\nimport { ScenarioGallery } from './ScenarioGallery';\nimport type { ScenarioPresetId } from './scenarios/catalog.ts';\n",
    'Explore scenario imports',
)
explore = replace_once(
    explore,
    "  onClose,\n  onSelect,\n}: {\n  open: boolean;\n  onClose: () => void;\n  onSelect: (destination: ExploreDestination) => void;\n}) {",
    "  onClose,\n  onSelect,\n  onScenarioSelect,\n}: {\n  open: boolean;\n  onClose: () => void;\n  onSelect: (destination: ExploreDestination) => void;\n  onScenarioSelect: (presetId: ScenarioPresetId) => void;\n}) {",
    'Explore scenario prop',
)
explore = replace_once(
    explore,
    "            </section>\n\n            <div className=\"explore-groups\">",
    "            </section>\n\n            <ScenarioGallery onSelect={onScenarioSelect} />\n\n            <div className=\"explore-groups\">",
    'Explore scenario gallery placement',
)
explore_path.write_text(explore)

app_path = root / 'src/App.tsx'
app = app_path.read_text()
app = replace_once(
    app,
    "import { bootstrapJourneyFromSearch, seedJourneyBrowserScenario } from './journey/browser.ts';\n",
    "import { bootstrapJourneyFromSearch, seedJourneyBrowserScenario } from './journey/browser.ts';\nimport { scenarioForPreset } from './journey/presets.ts';\n",
    'App preset import',
)
app = replace_once(
    app,
    "import type { PortableJourneyScenario } from './journey/scenario.ts';\n",
    "import { encodeJourneyQuery, type PortableJourneyScenario } from './journey/scenario.ts';\n",
    'App scenario query import',
)
app = replace_once(
    app,
    "import { lab01Scenario, lab01StateAt } from './simulation/lab01';\n",
    "import type { ScenarioPresetId } from './scenarios/catalog.ts';\nimport { lab01Scenario, lab01StateAt } from './simulation/lab01';\n",
    'App scenario preset type import',
)

open_journey_anchor = """  const openJourney = () => {
    pushBrowserRoute('journey');
    setPlaying(false);
    setLayer('application');
    setJourneyTimeMs(0);
    setJourneyStartPlaying(true);
    setJourneyReturnPending(false);
    setJourneyScenarioName('');
    setActiveLab('journey');
  };
"""
launch_preset = open_journey_anchor + """  const launchScenarioPreset = (presetId: ScenarioPresetId) => {
    const scenario = scenarioForPreset(presetId);
    seedJourneyBrowserScenario(scenario);
    if (browserHistoryRoutingAvailable) {
      const nextUrl = `/journey${encodeJourneyQuery(scenario)}`;
      const currentUrl = `${window.location.pathname}${window.location.search}`;
      if (currentUrl !== nextUrl) window.history.pushState({}, '', nextUrl);
    }
    setPlaying(false);
    setJourneyHostname(scenario.hostname);
    setJourneyTimeMs(scenario.timeMs);
    setJourneyStartPlaying(true);
    setJourneyReturnPending(false);
    setJourneyEvidence(null);
    setJourneyScenarioName(scenario.name ?? '');
    setLayer('application');
    setExploreOpen(false);
    setActiveLab('journey');
    setJourneyRenderKey((current) => current + 1);
  };
"""
app = replace_once(app, open_journey_anchor, launch_preset, 'App preset launcher')
app = replace_once(
    app,
    "      <ExploreLauncher open={exploreOpen} onClose={() => setExploreOpen(false)} onSelect={selectExploreDestination} />",
    "      <ExploreLauncher open={exploreOpen} onClose={() => setExploreOpen(false)} onSelect={selectExploreDestination} onScenarioSelect={launchScenarioPreset} />",
    'App Explore scenario callback',
)
app_path.write_text(app)

package_path = root / 'package.json'
package = json.loads(package_path.read_text())
scripts = package['scripts']
if 'test:scenario-gallery-contract' in scripts:
    raise SystemExit('package already contains scenario gallery contract')
scripts['test:scenario-gallery-contract'] = 'node scripts/scenario-gallery-contract-check.mjs'
needle = ' && npm run test:home-action-deck-contract && npm run build'
replacement = ' && npm run test:home-action-deck-contract && npm run test:scenario-gallery-contract && npm run build'
if scripts['check'].count(needle) != 1:
    raise SystemExit('package check anchor missing or ambiguous')
scripts['check'] = scripts['check'].replace(needle, replacement, 1)
package_path.write_text(json.dumps(package, indent=2) + '\n')

roadmap_path = root / 'docs/ROADMAP.md'
roadmap = roadmap_path.read_text()
anchor = '- [x] permanent home-action contract wired into `npm run check`\n'
if roadmap.count(anchor) != 1:
    raise SystemExit('Lab 10C roadmap anchor missing or ambiguous')
addition = anchor + """

### 10D — One-click scenario gallery
- [x] expose eight curated failure/protocol stories inside Explore without increasing the lab count
- [x] DNS outage, route failover, mid-transfer path outage, congestion, BGP route leak, terminal partition, HTTP 503, and QUIC loss presets
- [x] every preset maps to an existing canonical Journey modifier; no gallery-specific event generator exists
- [x] preset selection launches Journey from t=0 with autoplay so the causal story is visible from the beginning
- [x] preset URLs use the existing Journey share-query codec under `/journey?...`
- [x] scenario catalog/presentation stays separate from Journey construction truth
- [x] responsive gallery collapses from 4-column → 2-column → compact mobile rows
- [x] permanent scenario-gallery contract wired into `npm run check`
"""
roadmap = roadmap.replace(anchor, addition, 1)
roadmap_path.write_text(roadmap)

print('Applied Lab 10D scenario gallery integration.')
