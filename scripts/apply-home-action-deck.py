from pathlib import Path
import json

root = Path('.')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one anchor, found {count}')
    return text.replace(old, new, 1)

app_path = root / 'src/App.tsx'
app = app_path.read_text()
app = replace_once(
    app,
    "import { HttpComparisonTheater } from './HttpComparisonTheater';\n",
    "import { HttpComparisonTheater } from './HttpComparisonTheater';\nimport { HomeActionDeck } from './HomeActionDeck';\n",
    'HomeActionDeck import',
)

overview_action = """  const overviewAction = layer === 'packet'
    ? { label: 'Open packet microscope', run: openPacketLab }
    : layer === 'transport'
      ? { label: 'Open TCP theater', run: openTcpLab }
      : layer === 'application'
        ? { label: 'Compare HTTP/2 vs HTTP/3', run: openHttpLab }
        : layer === 'routing'
          ? { label: 'Open network builder', run: openBuilderLab }
          : { label: 'Open physical Internet', run: openPhysicalInternet };

"""
app = replace_once(app, overview_action, '', 'legacy scale-dependent overview action')

legacy_actions = """              <motion.div className=\"hero-actions\" initial={reduceMotion ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38, duration: 0.65 }}>
                <motion.button className=\"primary-action\" type=\"button\" onClick={openJourney} whileHover={reduceMotion ? undefined : { y: -2, scale: 1.015 }} whileTap={reduceMotion ? undefined : { scale: 0.985 }}>Play URL journey<span aria-hidden=\"true\">↗</span></motion.button>
                <button className=\"explore-hero-action\" type=\"button\" onClick={() => setExploreOpen(true)}>Explore labs<span>12 labs ↗</span></button>
                <button className=\"text-action text-button\" type=\"button\" onClick={openMeasuredNetwork}>Inspect measured report</button>
                <button className=\"text-action text-button\" type=\"button\" onClick={overviewAction.run}>{overviewAction.label}</button>
                <button className=\"text-action text-button\" type=\"button\" onClick={() => setMode((current) => (current === 'overview' ? 'xray' : 'overview'))}>{mode === 'overview' ? 'Preview X-ray' : 'Hide X-ray'}</button>
                <a className=\"text-action\" href=\"https://github.com/JohnnyZLi/HOPSCOTCH\">Source</a>
              </motion.div>
"""
new_actions = """              <HomeActionDeck
                onWatch={openJourney}
                onBreak={() => openFailureLab(0, true)}
                onBuild={openBuilderLab}
                onExplore={() => setExploreOpen(true)}
                onMeasured={openMeasuredNetwork}
                onToggleXray={() => setMode((current) => (current === 'overview' ? 'xray' : 'overview'))}
                xrayActive={mode === 'xray'}
              />
"""
app = replace_once(app, legacy_actions, new_actions, 'hero action deck')
app_path.write_text(app)

explore_css_path = root / 'src/ExploreLauncher.css'
explore_css = explore_css_path.read_text()
legacy_explore_css = """.hero-actions {
  flex-wrap: wrap;
}

.explore-hero-action {
  display: inline-flex;
  align-items: center;
  gap: 20px;
  padding: 13px 16px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 4px;
  color: #e3e9ed;
  background: rgba(7, 11, 15, 0.62);
  cursor: pointer;
  font-size: 0.76rem;
  font-weight: 760;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  backdrop-filter: blur(14px);
}

.explore-hero-action span {
  color: #74808a;
  font-size: 0.58rem;
  letter-spacing: 0.09em;
}

.explore-hero-action:hover,
.explore-hero-action:focus-visible {
  border-color: rgba(121, 242, 218, 0.46);
  color: #ffffff;
  outline: none;
}

"""
explore_css = replace_once(explore_css, legacy_explore_css, '', 'legacy Explore hero CSS')
explore_css_path.write_text(explore_css)

styles_path = root / 'src/styles.css'
styles = styles_path.read_text()
styles = replace_once(
    styles,
    "  width: min(720px, calc(100% - 64px));\n  margin: clamp(90px, 12vh, 160px) 0 0 max(32px, calc((100vw - min(1500px, calc(100vw - 64px))) / 2));",
    "  width: min(820px, calc(100% - 64px));\n  margin: clamp(74px, 9vh, 118px) 0 0 max(32px, calc((100vw - min(1500px, calc(100vw - 64px))) / 2));",
    'hero width and vertical position',
)
legacy_primary = """.hero-actions {
  display: flex;
  align-items: center;
  gap: 24px;
  margin-top: 32px;
}

.primary-action {
  display: inline-flex;
  align-items: center;
  gap: 34px;
  padding: 14px 18px;
  border: 1px solid rgba(121, 242, 218, 0.55);
  border-radius: 4px;
  color: #07100e;
  background: var(--cyan);
  cursor: pointer;
  font-size: 0.78rem;
  font-weight: 760;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  box-shadow: 0 10px 44px rgba(121, 242, 218, 0.12);
}

"""
styles = replace_once(styles, legacy_primary, '', 'legacy flat hero action CSS')
styles_path.write_text(styles)

package_path = root / 'package.json'
package = json.loads(package_path.read_text())
scripts = package['scripts']
if 'test:home-action-deck-contract' in scripts:
    raise SystemExit('package already contains home action deck contract')
scripts['test:home-action-deck-contract'] = 'node scripts/home-action-deck-contract-check.mjs'
needle = ' && npm run test:navigation-contract && npm run build'
replacement = ' && npm run test:navigation-contract && npm run test:home-action-deck-contract && npm run build'
if scripts['check'].count(needle) != 1:
    raise SystemExit('package check anchor missing or ambiguous')
scripts['check'] = scripts['check'].replace(needle, replacement, 1)
package_path.write_text(json.dumps(package, indent=2) + '\n')

roadmap_path = root / 'docs/ROADMAP.md'
roadmap = roadmap_path.read_text()
anchor = '- [x] permanent navigation contract wired into `npm run check`\n'
if roadmap.count(anchor) != 1:
    raise SystemExit('Lab 10B roadmap anchor missing or ambiguous')
addition = anchor + """

### 10C — Action-first overview
- [x] Watch a Request / Break the Network / Build a Network are the three first-class overview choices
- [x] Explore, measured evidence, X-Ray, and source move to a secondary utility row
- [x] remove the scale-dependent extra hero CTA so network scale and product navigation stay separate concepts
- [x] preserve the existing Explore launcher as the complete catalog rather than duplicating all 12 labs on the home screen
- [x] compact mobile action rows keep all three primary choices visible without a tall card stack
- [x] home action component stays presentation-only and cannot import Journey, simulation, or measurement truth
- [x] permanent home-action contract wired into `npm run check`
"""
roadmap = roadmap.replace(anchor, addition, 1)
roadmap_path.write_text(roadmap)

measured_contract_path = root / 'scripts/measured-workspace-contract-check.mjs'
measured_contract = measured_contract_path.read_text()
measured_contract = replace_once(
    measured_contract,
    "const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');\n",
    "const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');\nconst home = readFileSync(new URL('../src/HomeActionDeck.tsx', import.meta.url), 'utf8');\n",
    'measured contract home source',
)
measured_contract = replace_once(
    measured_contract,
    "assert.match(app, /Inspect measured report/, 'overview must expose the measured workspace without replacing the URL Journey primary action');\n",
    "assert.match(app, /onMeasured=\\{openMeasuredNetwork\\}/, 'overview must route the secondary measured action through the existing measured workspace opener');\nassert.match(home, /Inspect measured report/, 'overview utility row must visibly expose the measured workspace');\n",
    'measured overview exposure assertion',
)
measured_contract = replace_once(
    measured_contract,
    "assert.match(app, /Play URL journey/, 'URL Journey must remain present as the primary product entry');\n",
    "assert.match(app, /onWatch=\\{openJourney\\}/, 'overview must route its primary Watch action through the canonical URL Journey opener');\nassert.match(home, /Play URL journey/, 'URL Journey must remain visibly present as a first-class product entry');\n",
    'journey primary assertion',
)
legacy_order = """const primaryIndex = app.indexOf('className=\"primary-action\"');
const journeyIndex = app.indexOf('Play URL journey');
const measuredIndex = app.indexOf('Inspect measured report');
assert.ok(primaryIndex >= 0 && journeyIndex > primaryIndex && measuredIndex > journeyIndex, 'measured report must remain a secondary action after the primary URL Journey');
"""
new_order = """const watchIndex = home.indexOf("id: 'watch'");
const utilitiesIndex = home.indexOf('className=\"home-action-utilities\"');
const measuredIndex = home.indexOf('Inspect measured report');
assert.ok(watchIndex >= 0 && utilitiesIndex > watchIndex && measuredIndex > utilitiesIndex, 'measured report must remain in the secondary utility surface after the primary Watch/Journey experience');
"""
measured_contract = replace_once(measured_contract, legacy_order, new_order, 'measured primary-secondary ordering')
measured_contract_path.write_text(measured_contract)

explore_contract_path = root / 'scripts/explore-launcher-contract-check.mjs'
explore_contract = explore_contract_path.read_text()
explore_contract = replace_once(
    explore_contract,
    "const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');\n",
    "const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');\nconst home = readFileSync(new URL('../src/HomeActionDeck.tsx', import.meta.url), 'utf8');\n",
    'explore contract home source',
)
legacy_explore_assertion = """assert(
  app.includes('className=\"explore-trigger\"') && app.includes('className=\"explore-hero-action\"'),
  'Explore must be reachable from both the persistent header and the overview hero.',
);
"""
new_explore_assertion = """assert(
  app.includes('className=\"explore-trigger\"') && app.includes('onExplore={() => setExploreOpen(true)}'),
  'Explore must be reachable from both the persistent header and the overview product surface.',
);
assert(
  home.includes('Explore all 12 labs') && home.includes('onClick={onExplore}'),
  'Overview product surface must keep an explicit entry to the full Explore catalog.',
);
"""
explore_contract = replace_once(explore_contract, legacy_explore_assertion, new_explore_assertion, 'Explore overview entry contract')
explore_contract = replace_once(
    explore_contract,
    "console.log(`Explore launcher contract OK: ${destinations.length} direct destinations, persistent + hero entry points, and no truth-path imports.`);",
    "console.log(`Explore launcher contract OK: ${destinations.length} direct destinations, persistent + overview entry points, and no truth-path imports.`);",
    'Explore contract output wording',
)
explore_contract_path.write_text(explore_contract)

print('Applied Lab 10C action-first overview integration with updated product-boundary contracts.')
