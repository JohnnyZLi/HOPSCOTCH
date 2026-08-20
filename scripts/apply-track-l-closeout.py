from pathlib import Path
import json


def replace_once(path: str, old: str, new: str) -> None:
    file_path = Path(path)
    text = file_path.read_text()
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected one anchor, found {count}: {old[:140]!r}")
    file_path.write_text(text.replace(old, new, 1))


# Fix the standalone explanation engine before integration.
path = 'src/builder/explain.ts'
text = Path(path).read_text()
old = "...forwarding.hops.map((hop) => hop.id ?? hop.linkId ?? '').filter(Boolean)"
if old in text:
    Path(path).write_text(text.replace(old, "...forwarding.hops.map((hop) => hop.linkId ?? '').filter(Boolean)", 1))

# Lazy Builder integration. Explanation remains absent from stress mode.
replace_once(
    'src/NetworkBuilder.tsx',
    "const BuilderCliTerminal = lazy(() => import('./BuilderCliTerminal.tsx'));\n",
    "const BuilderCliTerminal = lazy(() => import('./BuilderCliTerminal.tsx'));\nconst BuilderExplainPanel = lazy(() => import('./BuilderExplainPanel.tsx'));\n",
)
replace_once(
    'src/NetworkBuilder.tsx',
    "  const [cliOpen, setCliOpen] = useState(false);\n",
    "  const [cliOpen, setCliOpen] = useState(false);\n  const [explainOpen, setExplainOpen] = useState(false);\n",
)
replace_once(
    'src/NetworkBuilder.tsx',
    "onClick={()=>setCliOpen((current)=>!current)}>TERMINAL {cliOpen?'▴':'▾'}</button>}",
    "onClick={()=>{setExplainOpen(false);setCliOpen((current)=>!current);}}>TERMINAL {cliOpen?'▴':'▾'}</button>}{!stressLabel&&<button className=\"lab-mode\" type=\"button\" data-builder-explain-toggle aria-expanded={explainOpen} aria-controls=\"builder-explain-panel\" onClick={()=>{setCliOpen(false);setExplainOpen((current)=>!current);}}>EXPLAIN {explainOpen?'▴':'▾'}</button>}",
)
replace_once(
    'src/NetworkBuilder.tsx',
    "        {!stressLabel&&cliOpen&&<Suspense fallback={null}><BuilderCliTerminal input={displayedWorkbenchInput} contextLabel={isHistorical?`HISTORY #${String(historicalTimelineSnapshot?.sequence??0).padStart(3,'0')}`:'LIVE'} defaultProbeTarget={destinationId} defaultSourceId={sourceId} onProbe={isHistorical?undefined:runCliProbe} onMutation={isHistorical?undefined:applyCliMutation} activeUnavailableReason={isHistorical?'Time Machine is inspection-only. Return to LIVE before running probes or changing canonical configuration.':undefined} onClose={()=>setCliOpen(false)}/></Suspense>}\n        <section className=\"builder-stage\">",
    "        {!stressLabel&&cliOpen&&<Suspense fallback={null}><BuilderCliTerminal input={displayedWorkbenchInput} contextLabel={isHistorical?`HISTORY #${String(historicalTimelineSnapshot?.sequence??0).padStart(3,'0')}`:'LIVE'} defaultProbeTarget={destinationId} defaultSourceId={sourceId} onProbe={isHistorical?undefined:runCliProbe} onMutation={isHistorical?undefined:applyCliMutation} activeUnavailableReason={isHistorical?'Time Machine is inspection-only. Return to LIVE before running probes or changing canonical configuration.':undefined} onClose={()=>setCliOpen(false)}/></Suspense>}\n        {!stressLabel&&explainOpen&&<Suspense fallback={null}><BuilderExplainPanel input={displayedWorkbenchInput} historicalSequence={historicalTimelineSnapshot?.sequence??null} selectedNodeId={sceneSelectedNodeId} selectedProbeId={selectedProbe?.id??null} onClose={()=>setExplainOpen(false)}/></Suspense>}\n        <section className=\"builder-stage\">",
)

# Track L focused contract is a permanent part of npm check.
package_path = Path('package.json')
package = json.loads(package_path.read_text())
package['scripts']['test:builder-explain-contract'] = 'node scripts/builder-explain-contract-check.mjs'
needle = 'npm run test:builder-causal-diagnosis-contract && npm run test:builder-data-plane-contract'
replacement = 'npm run test:builder-causal-diagnosis-contract && npm run test:builder-explain-contract && npm run test:builder-data-plane-contract'
if needle not in package['scripts']['check']:
    raise RuntimeError('package.json: Track L check insertion anchor not found')
package['scripts']['check'] = package['scripts']['check'].replace(needle, replacement, 1)
package_path.write_text(json.dumps(package, indent=2) + '\n')

# Close Track L in the roadmap without inventing another lettered track.
replace_once(
    'docs/ROADMAP.md',
    """## Current priority order\n\n### 1. Track L — Explain This Network\n\nTrack K is complete. The next regular product priority is Track L: deterministic explanation of topology, protocol state, forwarding, policy, and failure causality from the canonical Builder model.\n""",
    """## Current priority order\n\n### Core regular-track roadmap complete\n\nTrack L is complete. The next priority is integrated product hardening: use the completed canonical simulation, evidence, troubleshooting, CLI, and explanation layers as one coherent system without inventing another lettered track merely to extend the roadmap.\n""",
)
replace_once(
    'docs/ROADMAP.md',
    """## Remaining regular tracks\n\nThese remain real product work. They should follow Track K unless a bounded dependency requires a different order.\n""",
    """## Completed regular tracks\n\nThe regular A–L product tracks are now implemented. The sections below retain their completion records and architectural boundaries.\n""",
)
replace_once(
    'docs/ROADMAP.md',
    """### Track L — explain-this-network layer\n\n- [ ] simulator emits structured cause/effect facts before natural-language explanation exists\n- [ ] explanations cite the exact canonical configuration/state/events they interpret\n- [ ] summarize why a route was selected, packet was dropped, adjacency changed, or application failed\n- [ ] novice / operational / protocol-detail explanation levels change wording, never simulation truth\n- [ ] AI may explain/query canonical facts but never decides routing, forwarding, packet outcomes, protocol state, or evidence provenance\n""",
    """### Track L — explain-this-network layer\n\n- [x] structured cause/effect facts are emitted before natural-language explanation\n- [x] explanations cite exact canonical configuration, state, immutable outcomes, and causal events\n- [x] NETWORK / ROUTE / OSPF / POLICY / PACKET / APPLICATION / EVENT targets explain the major canonical truth surfaces without adding a second network model\n- [x] route selection, packet/drop outcome, adjacency state/change, policy result, application failure/success, and event cause chains are grounded in existing engines/results\n- [x] NOVICE / OPERATIONAL / PROTOCOL DETAIL levels change wording only; structured facts and citations remain identical\n- [x] the AI query pack is advisory-only: it may summarize/query cited facts but cannot decide routing, forwarding, policy, protocol state, mutations, outcomes, or provenance\n- [x] Time Machine explanation uses the same staged control/RIB/FIB snapshot and truncated causal journal as the rest of Builder\n- [x] the explanation workspace remains lazy-loaded and absent from stress Builder\n\n`docs/TRACKL.md` is the Track L closeout architecture and validation record.\n""",
)
