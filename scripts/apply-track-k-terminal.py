from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file_path = Path(path)
    text = file_path.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one match, found {count}: {old[:120]!r}')
    file_path.write_text(text.replace(old, new, 1))


path = 'src/NetworkBuilder.tsx'
replace_once(
    path,
    "const BuilderChallengePanel = lazy(() => import('./BuilderChallengePanel.tsx'));\nconst BuilderOspfTimingPanel=lazy(()=>import('./BuilderOspfTimingPanel.tsx').then((m)=>({default:m.BuilderOspfTimingPanel})));",
    "const BuilderChallengePanel = lazy(() => import('./BuilderChallengePanel.tsx'));\nconst BuilderCliTerminal = lazy(() => import('./BuilderCliTerminal.tsx'));\nconst BuilderOspfTimingPanel=lazy(()=>import('./BuilderOspfTimingPanel.tsx').then((m)=>({default:m.BuilderOspfTimingPanel})));",
)
replace_once(
    path,
    "  const [challengeReturnScenarioName, setChallengeReturnScenarioName] = useState<string | null>(null);\n  const [authoringView, setAuthoringView] = useState<BuilderAuthoringSession>(() => ({ selection:[initialSourceId], ethernetLinkSelection:[], clipboard:null, sites:[], annotations:{}, showInterfaces:false, camera:{x:50,y:50,scale:1}, branches:[], baseline:null }));",
    "  const [challengeReturnScenarioName, setChallengeReturnScenarioName] = useState<string | null>(null);\n  const [cliOpen, setCliOpen] = useState(false);\n  const [authoringView, setAuthoringView] = useState<BuilderAuthoringSession>(() => ({ selection:[initialSourceId], ethernetLinkSelection:[], clipboard:null, sites:[], annotations:{}, showInterfaces:false, camera:{x:50,y:50,scale:1}, branches:[], baseline:null }));",
)
replace_once(
    path,
    "        <div className=\"builder-heading-actions\"><button className=\"lab-mode\" type=\"button\" onClick={onOpenFailureStory}>FAILURE STORY ↗</button><button className=\"lab-mode\" type=\"button\" onClick={onExit}>EXIT LAB</button></div>",
    "        <div className=\"builder-heading-actions\">{!stressLabel&&<button className=\"lab-mode\" type=\"button\" data-builder-cli-toggle aria-expanded={cliOpen} aria-controls=\"builder-cli-terminal\" onClick={()=>setCliOpen((current)=>!current)}>TERMINAL {cliOpen?'▴':'▾'}</button>}<button className=\"lab-mode\" type=\"button\" onClick={onOpenFailureStory}>FAILURE STORY ↗</button><button className=\"lab-mode\" type=\"button\" onClick={onExit}>EXIT LAB</button></div>",
)
replace_once(
    path,
    "      <div className=\"builder-main\">\n        <section className=\"builder-stage\">",
    "      <div className=\"builder-main\">\n        {!stressLabel&&cliOpen&&<Suspense fallback={null}><BuilderCliTerminal input={displayedWorkbenchInput} contextLabel={isHistorical?`HISTORY #${String(historicalTimelineSnapshot?.sequence??0).padStart(3,'0')}`:'LIVE'} onClose={()=>setCliOpen(false)}/></Suspense>}\n        <section className=\"builder-stage\">",
)

path = 'docs/ROADMAP.md'
replace_once(
    path,
    "- [x] CLI foundation consumes supplied canonical facts and rejects unsupported/configuration syntax rather than inventing behavior\n\n**Remaining**\n\n- [ ] actual CLI/terminal interaction surface in Builder\n- [ ] `show ospf neighbors`, `show bgp`, `show acl`, `show nat`, `ping`, and `traceroute`",
    "- [x] CLI foundation consumes supplied canonical facts and rejects unsupported/configuration syntax rather than inventing behavior\n- [x] lazy full-width Builder terminal surface with command transcript/history and explicit LIVE vs Time Machine context\n- [x] canonical live/historical state adapter for routed interfaces, RIB routes, session ARP, and learned FDB facts\n\n`docs/TRACKK.md` records the Track K architecture and first interactive slice.\n\n**Remaining**\n\n- [ ] `show ospf neighbors`, `show bgp`, `show acl`, `show nat`, `ping`, and `traceroute`",
)

print('Applied Track K Builder terminal integration.')
