from pathlib import Path
import json


def replace(path, old, new, count=1):
    p=Path(path); text=p.read_text()
    found=text.count(old)
    if found < count:
        raise SystemExit(f'{path}: expected at least {count} matches, found {found}: {old[:120]!r}')
    text=text.replace(old,new,count)
    p.write_text(text)

# Provider forwarding must never claim unknown-MAC delivery merely because flood targets are reachable.
replace('src/builder/provider.ts', ":outerPaths.some((entry)=>entry.reachable);return{vni:network.vni", ":false;return{vni:network.vni")

routing=Path('src/builder/routing.ts')
text=routing.read_text()
anchor="import type { BuilderGraph } from './model.ts';\n"
provider_import="import { cloneBuilderProviderConfig, createDefaultBuilderProviderConfig, reconcileBuilderProviderConfig, validateBuilderProviderConfig, type BuilderProviderConfig } from './provider-config.ts';\n"
if provider_import not in text:
    if anchor not in text: raise SystemExit('routing import anchor missing')
    text=text.replace(anchor,anchor+provider_import,1)
text=text.replace("  policy: BuilderRoutingPolicyConfig;\n}","  policy: BuilderRoutingPolicyConfig;\n  provider?: BuilderProviderConfig;\n}",1)
text=text.replace("return { ...result, ospf: { ...result.ospf, areaTypes: {}, redistributions: [] }, policy: createDefaultBuilderRoutingPolicyConfig() };","return { ...result, ospf: { ...result.ospf, areaTypes: {}, redistributions: [] }, policy: createDefaultBuilderRoutingPolicyConfig(), provider: createDefaultBuilderProviderConfig() };",1)
text=text.replace("    policy: validateBuilderRoutingPolicyConfig(graph,addressing,value.policy),\n  };","    policy: validateBuilderRoutingPolicyConfig(graph,addressing,value.policy),\n    provider: validateBuilderProviderConfig(graph,addressing,value.provider),\n  };",1)
text=text.replace("    policy: cloneBuilderRoutingPolicyConfig(value.policy),\n  };","    policy: cloneBuilderRoutingPolicyConfig(value.policy),\n    provider: cloneBuilderProviderConfig(value.provider),\n  };",1)
text=text.replace("policy: reconcileBuilderRoutingPolicyConfig(graph,addressing,current.policy) });","policy: reconcileBuilderRoutingPolicyConfig(graph,addressing,current.policy), provider: reconcileBuilderProviderConfig(graph,addressing,current.provider) });",1)
text=text.replace("    policy: cloneBuilderRoutingPolicyConfig(source.policy),\n  });","    policy: cloneBuilderRoutingPolicyConfig(source.policy),\n    provider: cloneBuilderProviderConfig(source.provider),\n  });",1)
# Mutators that reconstruct from the legacy/base routing object must preserve provider configuration.
text=text.replace("policy: cloneBuilderRoutingPolicyConfig(routing.policy) });","policy: cloneBuilderRoutingPolicyConfig(routing.policy), provider: cloneBuilderProviderConfig(routing.provider) });")
# Add a canonical setter beside the Track F policy setter.
setter="export function setBuilderRoutingPolicyConfig(graph:BuilderGraph,addressing:BuilderAddressing,routing:BuilderRoutingConfig,policy:BuilderRoutingPolicyConfig):BuilderRoutingConfig{\n  return validateBuilderRoutingConfig(graph,addressing,{...cloneBuilderRoutingConfig(routing),policy});\n}\n"
provider_setter=setter+"\nexport function setBuilderProviderConfig(graph:BuilderGraph,addressing:BuilderAddressing,routing:BuilderRoutingConfig,provider:BuilderProviderConfig):BuilderRoutingConfig{\n  return validateBuilderRoutingConfig(graph,addressing,{...cloneBuilderRoutingConfig(routing),provider});\n}\n"
if 'export function setBuilderProviderConfig' not in text:
    if setter not in text: raise SystemExit('routing policy setter anchor missing')
    text=text.replace(setter,provider_setter,1)
routing.write_text(text)

panel=Path('src/BuilderRoutingPolicyPanel.tsx')
text=panel.read_text()
if "import BuilderProviderPanel from './BuilderProviderPanel.tsx';" not in text:
    text=text.replace("import type { BuilderGraph } from './builder/model.ts';\n","import type { BuilderGraph } from './builder/model.ts';\nimport type { BuilderLinkProfiles } from './builder/link-characteristics.ts';\nimport BuilderProviderPanel from './BuilderProviderPanel.tsx';\n",1)
text=text.replace("export default function BuilderRoutingPolicyPanel({graph,addressing,routing,selectedNodeId,selectedLinkId,sourceId,destinationId,historical,onChange,onMessage}:{graph:BuilderGraph;addressing:BuilderAddressing;routing:BuilderRoutingConfig;selectedNodeId:string;selectedLinkId:string;sourceId:string;destinationId:string;historical:boolean;onChange:(next:BuilderRoutingConfig)=>void;onMessage:(message:string)=>void;}){","export default function BuilderRoutingPolicyPanel({graph,addressing,routing,linkProfiles,selectedNodeId,selectedLinkId,sourceId,destinationId,historical,onChange,onMessage}:{graph:BuilderGraph;addressing:BuilderAddressing;routing:BuilderRoutingConfig;linkProfiles:BuilderLinkProfiles;selectedNodeId:string;selectedLinkId:string;sourceId:string;destinationId:string;historical:boolean;onChange:(next:BuilderRoutingConfig)=>void;onMessage:(message:string)=>void;}){",1)
text=text.replace('  return <section className="builder-routing-policy" aria-label="Track F routing and policy depth">','  return <><section className="builder-routing-policy" aria-label="Track F routing and policy depth">',1)
ending='  </section>;\n}'
replacement='  </section><BuilderProviderPanel graph={graph} addressing={addressing} routing={routing} linkProfiles={linkProfiles} selectedNodeId={selectedNodeId} historical={historical} onChange={onChange} onMessage={onMessage}/></>;\n}'
if ending not in text: raise SystemExit('routing panel ending anchor missing')
text=text.replace(ending,replacement,1)
panel.write_text(text)

nb=Path('src/NetworkBuilder.tsx'); text=nb.read_text()
old='<BuilderRoutingPolicyPanel graph={graph} addressing={addressing} routing={routing} selectedNodeId={selectedNodeId}'
new='<BuilderRoutingPolicyPanel graph={graph} addressing={addressing} routing={routing} linkProfiles={linkProfiles} selectedNodeId={selectedNodeId}'
if old not in text: raise SystemExit('NetworkBuilder Track F panel anchor missing')
text=text.replace(old,new,1); nb.write_text(text)

pkg=Path('package.json'); data=json.loads(pkg.read_text())
scripts=data['scripts']
scripts['test:builder-provider-contract']='node scripts/builder-provider-contract-check.mjs'
check=scripts['check']
needle='npm run test:builder-routing-policy-contract'
if 'npm run test:builder-provider-contract' not in check:
    if needle not in check: raise SystemExit('package check routing-policy anchor missing')
    check=check.replace(needle,needle+' && npm run test:builder-provider-contract',1)
scripts['check']=check
pkg.write_text(json.dumps(data,indent=2)+'\n')

# Remove this one-shot patcher and restore normal CI before the commit is pushed.
Path('scripts/track-g-integrate.py').unlink()
ci=Path('.github/workflows/ci.yml')
ci.write_text("""name: CI

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
