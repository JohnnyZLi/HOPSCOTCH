from pathlib import Path
import json

root = Path('.')
app_path = root / 'src/App.tsx'
app = app_path.read_text()


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one anchor, found {count}')
    return text.replace(old, new, 1)

app = replace_once(
    app,
    "import { NetworkField } from './NetworkField';\n",
    "import { NetworkField } from './NetworkField';\nimport { canonicalUrlForRoute, pathForDestination, resolveAppRoute } from './navigation';\n",
    'navigation import',
)

app = replace_once(
    app,
    "type ActiveLab = 'journey' | 'failure' | 'packet' | 'tcp' | 'dns' | 'tls' | 'http' | 'builder' | 'physical' | 'internet' | 'observed' | 'measured' | null;",
    "type ActiveLab = ExploreDestination | null;",
    'active lab type',
)

old_bootstrap = """const initialJourneyBootstrap = typeof window === 'undefined'
  ? { scenario: null, error: null }
  : bootstrapJourneyFromSearch(window.location.search);
"""
new_bootstrap = """const DESTINATION_LAYERS: Readonly<Record<ExploreDestination, NetworkLayer>> = {
  journey: 'application',
  failure: 'routing',
  builder: 'routing',
  packet: 'packet',
  tcp: 'transport',
  dns: 'application',
  tls: 'application',
  http: 'application',
  internet: 'internet',
  physical: 'internet',
  observed: 'internet',
  measured: 'internet',
};

const initialAppRoute = typeof window === 'undefined'
  ? resolveAppRoute('/', '')
  : resolveAppRoute(window.location.pathname, window.location.search);

const initialJourneyBootstrap = typeof window === 'undefined' || initialAppRoute.destination !== 'journey'
  ? { scenario: null, error: null }
  : bootstrapJourneyFromSearch(window.location.search);
"""
app = replace_once(app, old_bootstrap, new_bootstrap, 'initial route bootstrap')

app = replace_once(
    app,
    "  const [layer, setLayer] = useState<NetworkLayer>(initialSharedJourney ? 'application' : 'internet');",
    "  const [layer, setLayer] = useState<NetworkLayer>(initialAppRoute.destination ? DESTINATION_LAYERS[initialAppRoute.destination] : 'internet');",
    'initial layer',
)
app = replace_once(
    app,
    "  const [activeLab, setActiveLab] = useState<ActiveLab>(initialSharedJourney ? 'journey' : null);",
    "  const [activeLab, setActiveLab] = useState<ActiveLab>(initialAppRoute.destination);",
    'initial active lab',
)
app = replace_once(
    app,
    "  const [journeyStartPlaying, setJourneyStartPlaying] = useState(!initialSharedJourney);",
    "  const [journeyStartPlaying, setJourneyStartPlaying] = useState(initialAppRoute.destination === 'journey' && !initialSharedJourney);",
    'initial journey playback',
)

camera_anchor = """  const cameraX = ((60 - focusX) / 60) * 14;
  const cameraY = ((36 - focusY) / 36) * 9;

  useEffect(() => {
    if (!playing || !failureLabActive) return;
"""
route_effect = """  const cameraX = ((60 - focusX) / 60) * 14;
  const cameraY = ((36 - focusY) / 36) * 9;

  const pushBrowserRoute = (destination: ExploreDestination | null) => {
    if (typeof window === 'undefined') return;
    const nextUrl = destination === null ? '/' : pathForDestination(destination);
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (currentUrl !== nextUrl) window.history.pushState({}, '', nextUrl);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const applyCurrentLocation = () => {
      const route = resolveAppRoute(window.location.pathname, window.location.search);
      const canonicalUrl = canonicalUrlForRoute(route, window.location.search);
      const currentUrl = `${window.location.pathname}${window.location.search}`;
      if (currentUrl !== canonicalUrl) window.history.replaceState(window.history.state, '', canonicalUrl);

      setExploreOpen(false);
      setPlaying(false);
      setJourneyReturnPending(false);

      if (route.destination === null) {
        setLayer('internet');
        setActiveLab(null);
        return;
      }

      const destination = route.destination;
      setLayer(DESTINATION_LAYERS[destination]);
      if (destination === 'failure') setTimeMs(0);

      if (destination === 'journey') {
        const bootstrap = bootstrapJourneyFromSearch(window.location.search);
        if (bootstrap.scenario) {
          setJourneyHostname(bootstrap.scenario.hostname);
          setJourneyTimeMs(bootstrap.scenario.timeMs);
          setJourneyStartPlaying(false);
          setJourneyScenarioName(bootstrap.scenario.name ?? '');
          setJourneyRenderKey((current) => current + 1);
        } else {
          setJourneyStartPlaying(false);
        }
      }

      setActiveLab(destination);
    };

    const initialCanonicalUrl = canonicalUrlForRoute(initialAppRoute, window.location.search);
    const initialCurrentUrl = `${window.location.pathname}${window.location.search}`;
    if (initialCurrentUrl !== initialCanonicalUrl) {
      window.history.replaceState(window.history.state, '', initialCanonicalUrl);
    }

    window.addEventListener('popstate', applyCurrentLocation);
    return () => window.removeEventListener('popstate', applyCurrentLocation);
  }, []);

  useEffect(() => {
    if (!playing || !failureLabActive) return;
"""
app = replace_once(app, camera_anchor, route_effect, 'history effect')

old_openers = """  const openFailureLab = (atMs = 0, autoplay = true) => {
    setLayer('routing'); setTimeMs(atMs); setActiveLab('failure'); setPlaying(autoplay);
  };
  const openPacketLab = () => { setPlaying(false); setLayer('packet'); setActiveLab('packet'); };
  const openTcpLab = () => { setPlaying(false); setLayer('transport'); setActiveLab('tcp'); };
  const openDnsLab = () => { setPlaying(false); setLayer('application'); setActiveLab('dns'); };
  const openTlsLab = () => { setPlaying(false); setLayer('application'); setActiveLab('tls'); };
  const openHttpLab = () => { setPlaying(false); setLayer('application'); setActiveLab('http'); };
  const openBuilderLab = () => { setPlaying(false); setLayer('routing'); setActiveLab('builder'); };
  const openPhysicalInternet = () => { setPlaying(false); setLayer('internet'); setActiveLab('physical'); };
  const openInternetLab = () => { setPlaying(false); setLayer('internet'); setActiveLab('internet'); };
  const openObservedInternet = () => { setPlaying(false); setLayer('internet'); setActiveLab('observed'); };
  const openMeasuredNetwork = () => { setPlaying(false); setLayer('internet'); setActiveLab('measured'); };
  const openJourney = () => {
    setPlaying(false);
    setLayer('application');
    setJourneyTimeMs(0);
    setJourneyStartPlaying(true);
    setJourneyReturnPending(false);
    setJourneyScenarioName('');
    setActiveLab('journey');
  };
"""
new_openers = """  const openFailureLab = (atMs = 0, autoplay = true) => {
    pushBrowserRoute('failure');
    setLayer('routing'); setTimeMs(atMs); setActiveLab('failure'); setPlaying(autoplay);
  };
  const openPacketLab = () => { pushBrowserRoute('packet'); setPlaying(false); setLayer('packet'); setActiveLab('packet'); };
  const openTcpLab = () => { pushBrowserRoute('tcp'); setPlaying(false); setLayer('transport'); setActiveLab('tcp'); };
  const openDnsLab = () => { pushBrowserRoute('dns'); setPlaying(false); setLayer('application'); setActiveLab('dns'); };
  const openTlsLab = () => { pushBrowserRoute('tls'); setPlaying(false); setLayer('application'); setActiveLab('tls'); };
  const openHttpLab = () => { pushBrowserRoute('http'); setPlaying(false); setLayer('application'); setActiveLab('http'); };
  const openBuilderLab = () => { pushBrowserRoute('builder'); setPlaying(false); setLayer('routing'); setActiveLab('builder'); };
  const openPhysicalInternet = () => { pushBrowserRoute('physical'); setPlaying(false); setLayer('internet'); setActiveLab('physical'); };
  const openInternetLab = () => { pushBrowserRoute('internet'); setPlaying(false); setLayer('internet'); setActiveLab('internet'); };
  const openObservedInternet = () => { pushBrowserRoute('observed'); setPlaying(false); setLayer('internet'); setActiveLab('observed'); };
  const openMeasuredNetwork = () => { pushBrowserRoute('measured'); setPlaying(false); setLayer('internet'); setActiveLab('measured'); };
  const openJourney = () => {
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
app = replace_once(app, old_openers, new_openers, 'lab openers')

app = replace_once(
    app,
    "    setLayer(detailLayer[lab]);\n    if (lab === 'failure') {",
    "    setLayer(detailLayer[lab]);\n    pushBrowserRoute(lab as ExploreDestination);\n    if (lab === 'failure') {",
    'journey detail route',
)

app = replace_once(
    app,
    "  const importJourneyScenario = (scenario: PortableJourneyScenario) => {\n    seedJourneyBrowserScenario(scenario);",
    "  const importJourneyScenario = (scenario: PortableJourneyScenario) => {\n    seedJourneyBrowserScenario(scenario);\n    pushBrowserRoute('journey');",
    'scenario import route',
)

app = replace_once(
    app,
    "  const exitLabs = () => { setPlaying(false); setJourneyReturnPending(false); setExploreOpen(false); setActiveLab(null); };",
    "  const exitLabs = () => { pushBrowserRoute(null); setPlaying(false); setJourneyReturnPending(false); setExploreOpen(false); setActiveLab(null); };",
    'exit labs route',
)

app = replace_once(
    app,
    "      setJourneyReturnPending(false);\n      setJourneyStartPlaying(false);\n      setActiveLab('journey');",
    "      setJourneyReturnPending(false);\n      setJourneyStartPlaying(false);\n      pushBrowserRoute('journey');\n      setActiveLab('journey');",
    'return to journey route',
)

app_path.write_text(app)

package_path = root / 'package.json'
package = json.loads(package_path.read_text())
scripts = package['scripts']
if 'test:navigation-contract' in scripts:
    raise SystemExit('package already contains navigation contract')
scripts['test:navigation-contract'] = 'node scripts/navigation-contract-check.mjs'
needle = ' && npm run test:explore-launcher-contract && npm run build'
replacement = ' && npm run test:explore-launcher-contract && npm run test:navigation-contract && npm run build'
if scripts['check'].count(needle) != 1:
    raise SystemExit('package check anchor missing or ambiguous')
scripts['check'] = scripts['check'].replace(needle, replacement, 1)
package_path.write_text(json.dumps(package, indent=2) + '\n')

roadmap_path = root / 'docs/ROADMAP.md'
roadmap = roadmap_path.read_text()
anchor = '- [x] permanent Explore routing contract wired into `npm run check`\n'
if roadmap.count(anchor) != 1:
    raise SystemExit('roadmap Lab 10A anchor missing or ambiguous')
addition = anchor + """
### 10B — Canonical deep links + browser history
- [x] canonical URL for every major lab and Internet/evidence workspace
- [x] direct loads derive the initial lab from `window.location.pathname`
- [x] internal lab changes update browser history without reloading the simulation
- [x] browser Back / Forward restores the matching HOPSCOTCH workspace
- [x] old root-level `?journey=...` share links migrate to `/journey?...`
- [x] unknown and trailing-slash routes canonicalize deterministically
- [x] Cloudflare SPA fallback serves deep links while `/api/*` remains Worker-first
- [x] permanent navigation contract wired into `npm run check`
"""
roadmap = roadmap.replace(anchor, addition, 1)
roadmap_path.write_text(roadmap)

print('Applied Lab 10B deep-link navigation integration.')
