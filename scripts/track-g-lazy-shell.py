from pathlib import Path

p=Path('src/BuilderProviderPanel.tsx')
text=p.read_text()
old="export default function BuilderProviderPanel({graph,addressing,routing,linkProfiles,selectedNodeId,historical,onChange,onMessage}:{graph:BuilderGraph;addressing:BuilderAddressing;routing:BuilderRoutingConfig;linkProfiles:BuilderLinkProfiles;selectedNodeId:string;historical:boolean;onChange:(next:BuilderRoutingConfig)=>void;onMessage:(message:string)=>void;}){"
new="function BuilderProviderPanelContent({graph,addressing,routing,linkProfiles,selectedNodeId,historical,onChange,onMessage}:{graph:BuilderGraph;addressing:BuilderAddressing;routing:BuilderRoutingConfig;linkProfiles:BuilderLinkProfiles;selectedNodeId:string;historical:boolean;onChange:(next:BuilderRoutingConfig)=>void;onMessage:(message:string)=>void;}){"
if old not in text: raise SystemExit('provider component declaration anchor missing')
text=text.replace(old,new,1)
append="""

export default function BuilderProviderPanel(props:Parameters<typeof BuilderProviderPanelContent>[0]){
  const [open,setOpen]=useState(false);
  const provider=props.routing.provider??createDefaultBuilderProviderConfig();
  if(!open)return <section className=\"builder-provider builder-provider-shell\" aria-label=\"Track G service provider and overlay networking\"><div className=\"builder-provider-title\"><div><span>TRACK G · SERVICE PROVIDER / OVERLAY</span><strong>UNDERLAY TRUTH → ENCAPSULATION → OVERLAY</strong></div><small>{provider.tunnels.length} TUNNELS · {provider.mpls.lsps.length} LSPS · {provider.vxlan.vnis.length} VNIS</small></div><button className=\"builder-provider-open\" onClick={()=>setOpen(true)}>OPEN TRACK G</button><small className=\"builder-provider-boundary\">ADVANCED PROVIDER PROJECTIONS STAY UNMOUNTED UNTIL OPENED · OSPF/BGP INSPECTION DOES NOT PAY TRACK G DOM OR COMPUTE COST.</small></section>;
  return <><button className=\"builder-provider-close\" onClick={()=>setOpen(false)}>CLOSE TRACK G</button><BuilderProviderPanelContent {...props}/></>;
}
"""
text=text.rstrip()+append
p.write_text(text)

css=Path('src/BuilderProviderPanel.css')
text=css.read_text()
text += "\n.builder-provider-shell{grid-template-columns:minmax(0,1fr) auto;align-items:center}.builder-provider-shell .builder-provider-title{grid-column:1}.builder-provider-shell .builder-provider-open{grid-column:2;grid-row:1}.builder-provider-shell .builder-provider-boundary{grid-column:1/-1}.builder-provider-close{display:block;margin:14px 0 0 auto;border:1px solid color-mix(in srgb,var(--accent) 45%,var(--line));border-radius:9px;background:var(--panel);color:var(--text);padding:7px 9px;font:inherit;font-size:.68rem;font-weight:800;letter-spacing:.05em;cursor:pointer}@media(max-width:700px){.builder-provider-shell{grid-template-columns:1fr}.builder-provider-shell .builder-provider-title,.builder-provider-shell .builder-provider-open{grid-column:1;grid-row:auto}}\n"
css.write_text(text)

contract=Path('scripts/builder-provider-contract-check.mjs')
text=contract.read_text()
anchor="assert.match(providerPanel,/UNDERLAY TRUTH → ENCAPSULATION → OVERLAY/);"
extra=anchor+"assert.match(providerPanel,/OPEN TRACK G/,'Track G must remain closed by default inside the lazy routing workspace');assert.match(providerPanel,/BuilderProviderPanelContent/,'full provider projections must mount behind the Track G shell');"
if anchor not in text: raise SystemExit('provider panel contract anchor missing')
contract.write_text(text.replace(anchor,extra,1))

doc=Path('docs/TRACKG.md')
text=doc.read_text()
old="The main `NetworkBuilder` does not import `builder/provider.ts` or `BuilderProviderPanel` directly. This keeps advanced service-provider depth out of the startup bundle and out of stress-mode DOM."
new="The main `NetworkBuilder` does not import `builder/provider.ts` or `BuilderProviderPanel` directly. The routing-policy workspace itself is lazy, and Track G adds a second closed-by-default shell inside it: tunnel/MPLS/VXLAN/EVPN projection hooks and the full provider editor do not mount until **OPEN TRACK G** is selected. This keeps advanced service-provider depth out of startup, stress-mode DOM, and unrelated OSPF/BGP inspection."
if old not in text: raise SystemExit('Track G lazy boundary doc anchor missing')
doc.write_text(text.replace(old,new,1))

Path('scripts/track-g-lazy-shell.py').unlink()
Path('scripts/track-g-lazy-shell-trigger.txt').unlink(missing_ok=True)
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
