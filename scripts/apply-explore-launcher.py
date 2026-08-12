from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "src" / "App.tsx"
PACKAGE = ROOT / "package.json"
ROADMAP = ROOT / "docs" / "ROADMAP.md"


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one anchor, found {count}")
    return text.replace(old, new, 1)


app = APP.read_text()
app = replace_once(
    app,
    "import { DnsTheater } from './DnsTheater';\n",
    "import { DnsTheater } from './DnsTheater';\nimport { ExploreLauncher, type ExploreDestination } from './ExploreLauncher';\n",
    "Explore import",
)
app = replace_once(
    app,
    "  const [mode, setMode] = useState<DisplayMode>('overview');\n",
    "  const [mode, setMode] = useState<DisplayMode>('overview');\n  const [exploreOpen, setExploreOpen] = useState(false);\n",
    "Explore state",
)
journey_block = """  const openJourney = () => {
    setPlaying(false);
    setLayer('application');
    setJourneyTimeMs(0);
    setJourneyStartPlaying(true);
    setJourneyReturnPending(false);
    setJourneyScenarioName('');
    setActiveLab('journey');
  };
"""
explore_handler = journey_block + """  const selectExploreDestination = (destination: ExploreDestination) => {
    const openers: Record<ExploreDestination, () => void> = {
      journey: openJourney,
      failure: () => openFailureLab(0, true),
      builder: openBuilderLab,
      packet: openPacketLab,
      tcp: openTcpLab,
      dns: openDnsLab,
      tls: openTlsLab,
      http: openHttpLab,
      internet: openInternetLab,
      physical: openPhysicalInternet,
      observed: openObservedInternet,
      measured: openMeasuredNetwork,
    };
    setExploreOpen(false);
    openers[destination]();
  };
"""
app = replace_once(app, journey_block, explore_handler, "Explore destination routing")
app = replace_once(
    app,
    "  const exitLabs = () => { setPlaying(false); setJourneyReturnPending(false); setActiveLab(null); };\n",
    "  const exitLabs = () => { setPlaying(false); setJourneyReturnPending(false); setExploreOpen(false); setActiveLab(null); };\n",
    "Explore exit cleanup",
)
old_topbar = """        <div className=\"build-state\"><span>{buildLabel}</span><span className={`status-dot${failureLabActive ? ` phase-${labState.phase}` : ''}`}>{buildStatus}</span></div>
        {activeLab === 'journey' && <JourneyScenarioMenu hostname={journeyHostname} timeMs={journeyTimeMs} name={journeyScenarioName} onNameChange={setJourneyScenarioName} onImportScenario={importJourneyScenario} />}
"""
new_topbar = """        <div className=\"topbar-meta\">
          <button className=\"explore-trigger\" type=\"button\" onClick={() => setExploreOpen(true)}>EXPLORE <span>12 LABS</span></button>
          <div className=\"build-state\"><span>{buildLabel}</span><span className={`status-dot${failureLabActive ? ` phase-${labState.phase}` : ''}`}>{buildStatus}</span></div>
          {activeLab === 'journey' && <JourneyScenarioMenu hostname={journeyHostname} timeMs={journeyTimeMs} name={journeyScenarioName} onNameChange={setJourneyScenarioName} onImportScenario={importJourneyScenario} />}
        </div>
"""
app = replace_once(app, old_topbar, new_topbar, "Persistent Explore trigger")
old_primary = """                <motion.button className=\"primary-action\" type=\"button\" onClick={openJourney} whileHover={reduceMotion ? undefined : { y: -2, scale: 1.015 }} whileTap={reduceMotion ? undefined : { scale: 0.985 }}>Play URL journey<span aria-hidden=\"true\">↗</span></motion.button>
"""
new_primary = old_primary + """                <button className=\"explore-hero-action\" type=\"button\" onClick={() => setExploreOpen(true)}>Explore labs<span>12 labs ↗</span></button>
"""
app = replace_once(app, old_primary, new_primary, "Hero Explore trigger")
app = replace_once(
    app,
    "      </motion.header>\n\n      <AnimatePresence mode=\"wait\" initial={false}>\n",
    "      </motion.header>\n\n      <ExploreLauncher open={exploreOpen} onClose={() => setExploreOpen(false)} onSelect={selectExploreDestination} />\n\n      <AnimatePresence mode=\"wait\" initial={false}>\n",
    "Explore launcher mount",
)
APP.write_text(app)

package = json.loads(PACKAGE.read_text())
scripts = package["scripts"]
if "test:explore-launcher-contract" in scripts:
    raise RuntimeError("package.json already contains the Explore contract script")
check = scripts["check"]
needle = " && npm run build"
if check.count(needle) != 1:
    raise RuntimeError("package.json check script build anchor changed")
scripts["test:explore-launcher-contract"] = "node scripts/explore-launcher-contract-check.mjs"
scripts["check"] = check.replace(needle, " && npm run test:explore-launcher-contract && npm run build", 1)
PACKAGE.write_text(json.dumps(package, indent=2) + "\n")

roadmap = ROADMAP.read_text()
anchor = "## Performance + rendering — ongoing\n"
section = """## Lab 10 — Product surface

### 10A — Explore launcher
- [x] persistent Explore entry point in the global shell
- [x] overview hero exposes the full lab catalog directly
- [x] featured Watch / Break / Build starting points
- [x] direct one-click access to every major protocol, Internet, and measured workspace
- [x] launcher stays presentation/navigation-only and cannot become simulation truth
- [x] keyboard Escape, modal semantics, reduced-motion behavior, and mobile layout
- [x] permanent Explore routing contract wired into `npm run check`

"""
if section in roadmap:
    raise RuntimeError("ROADMAP already contains Lab 10A")
roadmap = replace_once(roadmap, anchor, section + anchor, "ROADMAP Lab 10 insertion")
ROADMAP.write_text(roadmap)

print("Explore launcher integration applied successfully.")
