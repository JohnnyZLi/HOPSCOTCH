from pathlib import Path

root = Path('.')
app_path = root / 'src/App.tsx'
app = app_path.read_text()


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one anchor, found {count}')
    return text.replace(old, new, 1)

old = """const initialAppRoute = typeof window === 'undefined'
  ? resolveAppRoute('/', '')
  : resolveAppRoute(window.location.pathname, window.location.search);
"""
new = """const browserHistoryRoutingAvailable = typeof window !== 'undefined'
  && (window.location.protocol === 'http:' || window.location.protocol === 'https:');

const initialAppRoute = browserHistoryRoutingAvailable
  ? resolveAppRoute(window.location.pathname, window.location.search)
  : resolveAppRoute('/', '');
"""
app = replace_once(app, old, new, 'initial browser history guard')

app = replace_once(
    app,
    "  const pushBrowserRoute = (destination: ExploreDestination | null) => {\n    if (typeof window === 'undefined') return;",
    "  const pushBrowserRoute = (destination: ExploreDestination | null) => {\n    if (!browserHistoryRoutingAvailable) return;",
    'pushState history guard',
)

app = replace_once(
    app,
    "  useEffect(() => {\n    if (typeof window === 'undefined') return;\n\n    const applyCurrentLocation = () => {",
    "  useEffect(() => {\n    if (!browserHistoryRoutingAvailable) return;\n\n    const applyCurrentLocation = () => {",
    'history effect guard',
)

app_path.write_text(app)

contract_path = root / 'scripts/navigation-contract-check.mjs'
contract = contract_path.read_text()
anchor = "assert.match(app, /window\\.history\\.pushState/);\n"
if contract.count(anchor) != 1:
    raise SystemExit('navigation contract anchor missing or ambiguous')
contract = contract.replace(
    anchor,
    "assert.match(app, /window\\.location\\.protocol === 'http:' \\|\\| window\\.location\\.protocol === 'https:'/);\n" +
    "assert.match(app, /window\\.history\\.pushState/);\n",
    1,
)
contract_path.write_text(contract)

print('Applied non-HTTP history guard for exact-artifact browser harnesses.')
