from pathlib import Path
import json


def replace_once(path: str, old: str, new: str) -> None:
    file_path = Path(path)
    text = file_path.read_text()
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected one anchor, found {count}: {old[:160]!r}")
    file_path.write_text(text.replace(old, new, 1))


def append_once(path: str, marker: str, content: str) -> None:
    file_path = Path(path)
    text = file_path.read_text()
    if marker in text:
        return
    file_path.write_text(text.rstrip() + "\n\n" + content.strip() + "\n")


# App consumes the canonical workspace catalog instead of duplicating destination metadata.
replace_once(
    'src/App.tsx',
    "import { ExploreLauncher, type ExploreDestination } from './ExploreLauncher';",
    "import { ExploreLauncher } from './ExploreLauncher';\nimport { WORKSPACE_COUNT, workspaceDefinition, type ExploreDestination } from './workspace-catalog';",
)

app_path = Path('src/App.tsx')
app = app_path.read_text()
start = app.index("const DESTINATION_LAYERS: Readonly<Record<ExploreDestination, NetworkLayer>> = {")
end = app.index("\n\nconst browserHistoryRoutingAvailable", start)
app = app[:start] + app[end + 2:]
app_path.write_text(app)

replace_once(
    'src/App.tsx',
    "const [layer, setLayer] = useState<NetworkLayer>(initialAppRoute.destination ? DESTINATION_LAYERS[initialAppRoute.destination] : 'internet');",
    "const [layer, setLayer] = useState<NetworkLayer>(initialAppRoute.destination ? workspaceDefinition(initialAppRoute.destination).layer : 'internet');",
)
replace_once(
    'src/App.tsx',
    "      setLayer(DESTINATION_LAYERS[destination]);",
    "      setLayer(workspaceDefinition(destination).layer);",
)

# Keep specialized workspace setup, but source each workspace's presentation layer from one catalog.
for old, new in [
    ("setLayer('routing'); setTimeMs(atMs); setActiveLab('failure');", "setLayer(workspaceDefinition('failure').layer); setTimeMs(atMs); setActiveLab('failure');"),
    ("setPlaying(false); setLayer('packet'); setActiveLab('packet');", "setPlaying(false); setLayer(workspaceDefinition('packet').layer); setActiveLab('packet');"),
    ("setPlaying(false); setLayer('transport'); setActiveLab('tcp');", "setPlaying(false); setLayer(workspaceDefinition('tcp').layer); setActiveLab('tcp');"),
    ("setPlaying(false); setLayer('application'); setActiveLab('dns');", "setPlaying(false); setLayer(workspaceDefinition('dns').layer); setActiveLab('dns');"),
    ("setPlaying(false); setLayer('application'); setActiveLab('tls');", "setPlaying(false); setLayer(workspaceDefinition('tls').layer); setActiveLab('tls');"),
    ("setPlaying(false); setLayer('application'); setActiveLab('http');", "setPlaying(false); setLayer(workspaceDefinition('http').layer); setActiveLab('http');"),
    ("setPlaying(false); setLayer('routing'); setActiveLab('builder');", "setPlaying(false); setLayer(workspaceDefinition('builder').layer); setActiveLab('builder');"),
    ("setPlaying(false); setLayer('internet'); setActiveLab('internet');", "setPlaying(false); setLayer(workspaceDefinition('internet').layer); setActiveLab('internet');"),
    ("setPlaying(false); setLayer('internet'); setActiveLab('physical');", "setPlaying(false); setLayer(workspaceDefinition('physical').layer); setActiveLab('physical');"),
    ("setPlaying(false); setLayer('internet'); setActiveLab('observed');", "setPlaying(false); setLayer(workspaceDefinition('observed').layer); setActiveLab('observed');"),
    ("setPlaying(false); setLayer('internet'); setActiveLab('measured');", "setPlaying(false); setLayer(workspaceDefinition('measured').layer); setActiveLab('measured');"),
    ("setPlaying(false); setLayer('packet'); setActiveLab('capture');", "setPlaying(false); setLayer(workspaceDefinition('capture').layer); setActiveLab('capture');"),
]:
    if old in Path('src/App.tsx').read_text():
        replace_once('src/App.tsx', old, new)

# Packet-from-capture and Journey setup have extra state around the layer assignment.
replace_once(
    'src/App.tsx',
    "    setLayer('packet');\n    setActiveLab('packet');",
    "    setLayer(workspaceDefinition('packet').layer);\n    setActiveLab('packet');",
)
replace_once(
    'src/App.tsx',
    "    setLayer('application');\n    setJourneyTimeMs(0);",
    "    setLayer(workspaceDefinition('journey').layer);\n    setJourneyTimeMs(0);",
)
# launchScenarioPreset and importJourneyScenario each use the Journey layer.
app = Path('src/App.tsx').read_text()
app = app.replace("    setLayer('application');\n    setExploreOpen(false);\n    setActiveLab('journey');", "    setLayer(workspaceDefinition('journey').layer);\n    setExploreOpen(false);\n    setActiveLab('journey');")
app = app.replace("    setLayer('application');\n    setActiveLab('journey');\n    setJourneyRenderKey", "    setLayer(workspaceDefinition('journey').layer);\n    setActiveLab('journey');\n    setJourneyRenderKey")
Path('src/App.tsx').write_text(app)

# Journey detail cameras use the same destination-layer catalog.
app = Path('src/App.tsx').read_text()
detail_start = app.index("    const detailLayer: Record<JourneyDetailLab, NetworkLayer> = {")
detail_end = app.index("    };", detail_start) + len("    };")
app = app[:detail_start] + "    const detailDestination = lab as ExploreDestination;" + app[detail_end:]
app = app.replace("    setLayer(detailLayer[lab]);", "    setLayer(workspaceDefinition(detailDestination).layer);")
app = app.replace("    pushBrowserRoute(lab as ExploreDestination);", "    pushBrowserRoute(detailDestination);")
Path('src/App.tsx').write_text(app)

# Returning from a captured packet uses canonical capture metadata too.
app = Path('src/App.tsx').read_text().replace("      setLayer('packet');\n      setActiveLab('capture');", "      setLayer(workspaceDefinition('capture').layer);\n      setActiveLab('capture');")
Path('src/App.tsx').write_text(app)

# Deep links and browser tabs identify the active product surface consistently.
insert_anchor = "  useEffect(() => {\n    if (!playing || !failureLabActive) return;"
insert = """  useEffect(() => {
    document.title = activeLab
      ? `HOPSCOTCH — ${workspaceDefinition(activeLab).name}`
      : 'HOPSCOTCH — See the Internet happen';
  }, [activeLab]);

"""
replace_once('src/App.tsx', insert_anchor, insert + insert_anchor)

# Replace nested topbar metadata ternaries with catalog-backed metadata.
app = Path('src/App.tsx').read_text()
start = app.index("  const buildLabel = activeLab === 'capture'")
end = app.index("\n\n  return (", start)
replacement = """  const activeWorkspace = activeLab ? workspaceDefinition(activeLab) : null;
  const buildLabel = activeWorkspace?.lab ?? 'LAB 00';
  const buildStatus = failureLabActive ? labState.statusLabel : activeWorkspace?.status ?? 'FOUNDATION ONLINE';"""
app = app[:start] + replacement + app[end:]
Path('src/App.tsx').write_text(app)

replace_once(
    'src/App.tsx',
    '<button className="explore-trigger" type="button" onClick={() => setExploreOpen(true)}>EXPLORE <span>13 WORKSPACES</span></button>',
    '<button className="explore-trigger" type="button" aria-expanded={exploreOpen} aria-controls="explore-dialog" onClick={() => setExploreOpen(true)}>EXPLORE <span>{WORKSPACE_COUNT} WORKSPACES</span></button>',
)

# Fold permanent visual correction patches into canonical stylesheets, preserving late-cascade behavior.
for source, target, marker in [
    ('src/visual-audit.css', 'src/lab.css', 'Integrated visual hardening formerly isolated in visual-audit.css'),
    ('src/tcp-audit.css', 'src/tcp.css', 'Integrated TCP hardening formerly isolated in tcp-audit.css'),
    ('src/dns-audit.css', 'src/dns.css', 'Integrated DNS hardening formerly isolated in dns-audit.css'),
    ('src/journey-audit.css', 'src/JourneyTheater.css', 'Integrated Journey hardening formerly isolated in journey-audit.css'),
]:
    source_path = Path(source)
    if source_path.exists():
        append_once(target, marker, f"/* {marker} */\n" + source_path.read_text())
        source_path.unlink()

for import_line in [
    "import './visual-audit.css';\n",
    "import './tcp-audit.css';\n",
    "import './dns-audit.css';\n",
    "import './journey-audit.css';\n",
]:
    main_path = Path('src/main.tsx')
    main_path.write_text(main_path.read_text().replace(import_line, ''))

# Establish a consistent keyboard focus baseline without changing pointer hover presentation.
append_once(
    'src/styles.css',
    'Integrated keyboard focus contract',
    """/* Integrated keyboard focus contract */
:where(button, a[href], input, select, textarea, [tabindex]:not([tabindex=\"-1\"])):focus-visible {
  outline: 2px solid rgba(121, 242, 218, 0.92);
  outline-offset: 3px;
}
""",
)
append_once(
    'src/ExploreLauncher.css',
    'Explore focus containment ring',
    """/* Explore focus containment ring */
.explore-trigger:focus-visible,
.explore-close:focus-visible,
.explore-featured-card:focus-visible,
.explore-card:focus-visible {
  box-shadow: 0 0 0 2px #05070a, 0 0 0 4px rgba(121, 242, 218, 0.72);
}
""",
)

# Make product integration a permanent repository gate.
package_path = Path('package.json')
package = json.loads(package_path.read_text())
package['scripts']['test:product-integration-contract'] = 'node scripts/product-integration-contract-check.mjs'
needle = 'npm run test:home-action-deck-contract && npm run test:scenario-gallery-contract && npm run build'
replacement = 'npm run test:home-action-deck-contract && npm run test:scenario-gallery-contract && npm run test:product-integration-contract && npm run build'
if needle not in package['scripts']['check']:
    raise RuntimeError('package.json: product integration insertion anchor not found')
package['scripts']['check'] = package['scripts']['check'].replace(needle, replacement, 1)
package_path.write_text(json.dumps(package, indent=2) + '\n')

# Mark the post-track integration pass as active/complete work rather than inventing Track M.
roadmap = Path('docs/ROADMAP.md')
text = roadmap.read_text()
anchor = "---\n\n## Completed foundation — lab series through Lab 11"
section = """---

## Integrated product hardening after Tracks A–L

The regular A–L roadmap is complete. Product work now treats HOPSCOTCH as one integrated system instead of adding another lettered track by default.

- [x] one canonical workspace catalog owns destination IDs, deep links, scale/layer placement, lab/track labels, product titles, status copy, Explore grouping, and featured actions
- [x] stale navigation nomenclature is removed (`TRACK H` owns Capture Replay; the combined Journey surface is consistently `LAB 06 + 07`)
- [x] Explore is a contained keyboard dialog with initial focus, Tab/Shift+Tab trapping, Escape close, scroll lock, ARIA state, and focus restoration
- [x] browser document titles identify the active deep-linked workspace from the same catalog
- [x] permanent visual hardening rules are folded out of `*-audit.css` patch files into canonical owned stylesheets
- [x] product-wide keyboard focus visibility has a shared baseline while component-specific visual focus remains allowed
- [x] navigation, home actions, Explore, App metadata, and route paths are guarded by a permanent integration contract
- [x] no network truth, evidence provenance, scenario schema, or performance budget is changed by this pass

`docs/PRODUCT-HARDENING.md` records the integration contract and closeout validation. Future work should be evidence-driven maintenance, usability refinement, protocol depth, or deliberately selected moonshots—not a new track letter merely for roadmap continuity.

## Completed foundation — lab series through Lab 11"""
if anchor not in text:
    raise RuntimeError('docs/ROADMAP.md: foundation anchor not found')
roadmap.write_text(text.replace(anchor, section, 1))

# README exposes the integrated product contract at the architecture/product level.
readme = Path('README.md')
text = readme.read_text()
anchor = "The Builder does not maintain separate hidden simulators for application traffic, overlays, troubleshooting, or presentation. Those surfaces consume the same canonical state.\n"
addition = """

At the product-shell level, one canonical workspace catalog now owns workspace identity, deep links, scale placement, lab/track labels, status copy, Explore grouping, and browser titles. Navigation surfaces consume that catalog rather than maintaining independent copies that can drift. Explore is keyboard-contained and restores focus when closed, and permanent visual corrections live in their owning stylesheets rather than late `*-audit.css` patches.
"""
if anchor not in text:
    raise RuntimeError('README.md: Builder boundary anchor not found')
readme.write_text(text.replace(anchor, anchor + addition, 1))
