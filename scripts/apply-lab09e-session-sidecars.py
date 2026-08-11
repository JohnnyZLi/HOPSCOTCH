from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'Lab 09E anchor missing for {label}: {old[:180]!r}')
    return text.replace(old, new, 1)


# App owns only the projected measured-state object in memory.
path = Path('src/App.tsx')
text = path.read_text()
text = replace_once(text, "import { MeasuredNetworkWorkspace } from './MeasuredNetworkWorkspace';\n", "import { MeasuredNetworkWorkspace } from './MeasuredNetworkWorkspace';\nimport type { MeasuredSnapshotState } from './measurement/state.ts';\n", 'App measured-state import')
text = replace_once(text, "  const [journeyEvidence, setJourneyEvidence] = useState<InternetEvidenceSnapshot | null>(null);\n", "  const [journeyEvidence, setJourneyEvidence] = useState<InternetEvidenceSnapshot | null>(null);\n  const [measuredSession, setMeasuredSession] = useState<MeasuredSnapshotState | null>(null);\n", 'App measured session')
text = replace_once(text, 'evidence={journeyEvidence} onHostnameChange=', 'evidence={journeyEvidence} measuredState={measuredSession} onHostnameChange=', 'App Journey measured prop')
text = replace_once(text, '<MeasuredNetworkWorkspace key="lab09-measured" onExit={exitActiveLab} />', '<MeasuredNetworkWorkspace key="lab09-measured" measuredState={measuredSession} onMeasuredStateChange={setMeasuredSession} onExit={exitActiveLab} />', 'App measured workspace props')
path.write_text(text)

# Lab 09 keeps transient import UI metadata; App owns the validated session projection.
path = Path('src/MeasuredNetworkWorkspace.tsx')
text = path.read_text()
text = replace_once(text, "import {\n  ingestNetworkDiagnosticsReportV2,\n  type NetworkDiagnosticsIngestion,\n} from './measurement/networkDiagnosticsAdapter.ts';", "import { ingestNetworkDiagnosticsReportV2 } from './measurement/networkDiagnosticsAdapter.ts';", 'workspace ingestion import')
text = replace_once(text, "  type MeasuredFreshness,\n} from './measurement/state.ts';", "  type MeasuredFreshness,\n  type MeasuredSnapshotState,\n} from './measurement/state.ts';", 'workspace measured-state type import')
text = replace_once(text, "export function MeasuredNetworkWorkspace({ onExit }: { onExit: () => void }) {", "export function MeasuredNetworkWorkspace({ measuredState, onMeasuredStateChange, onExit }: { measuredState: MeasuredSnapshotState | null; onMeasuredStateChange: (state: MeasuredSnapshotState | null) => void; onExit: () => void }) {", 'workspace props')
text = replace_once(text, "  const [ingestion, setIngestion] = useState<NetworkDiagnosticsIngestion | null>(null);\n", "", 'workspace local ingestion state')
text = replace_once(text, "    if (ingestion === null) return;", "    if (measuredState === null) return;", 'workspace freshness effect guard')
text = replace_once(text, "  }, [ingestion]);", "  }, [measuredState]);", 'workspace freshness effect dependency')
text = replace_once(text, "    for (const category of CATEGORY_ORDER) counts.set(category, ingestion ? measuredFactsByCategory(ingestion.state, category).length : 0);", "    for (const category of CATEGORY_ORDER) counts.set(category, measuredState ? measuredFactsByCategory(measuredState, category).length : 0);", 'workspace category counts')
text = replace_once(text, "  }, [ingestion]);", "  }, [measuredState]);", 'workspace category dependency')
text = replace_once(text, "    () => ingestion ? measuredFactsByCategory(ingestion.state, selectedCategory) : [],\n    [ingestion, selectedCategory],", "    () => measuredState ? measuredFactsByCategory(measuredState, selectedCategory) : [],\n    [measuredState, selectedCategory],", 'workspace selected facts')
text = replace_once(text, "  const freshness = ingestion ? measuredFreshnessAt(ingestion.state, nowMs) : null;", "  const freshness = measuredState ? measuredFreshnessAt(measuredState, nowMs) : null;", 'workspace freshness')
text = replace_once(text, "  const categoryCopy = CATEGORY_COPY[selectedCategory];\n", "  const categoryCopy = CATEGORY_COPY[selectedCategory];\n  const skippedSections = measuredState?.snapshot.warnings.filter((warning) => warning.includes(':') || warning.startsWith('unknown root fields ignored:')) ?? [];\n", 'workspace skipped warnings')
text = replace_once(text, "  const chooseBestCategory = (next: NetworkDiagnosticsIngestion) => {", "  const chooseBestCategory = (next: MeasuredSnapshotState) => {", 'workspace choose category type')
text = replace_once(text, "measuredFactsByCategory(next.state, category)", "measuredFactsByCategory(next, category)", 'workspace choose category data')
text = replace_once(text, "      setIngestion(next);\n      setFileName(file.name);\n      setNowMs(Date.now());\n      chooseBestCategory(next);", "      onMeasuredStateChange(next.state);\n      setFileName(file.name);\n      setNowMs(Date.now());\n      chooseBestCategory(next.state);", 'workspace successful import')
text = replace_once(text, "    setIngestion(null);", "    onMeasuredStateChange(null);", 'workspace clear')
text = text.replace("ingestion.snapshot.", "measuredState.snapshot.")
text = text.replace("ingestion.state.", "measuredState.")
text = text.replace("ingestion.state", "measuredState")
text = text.replace("ingestion.skippedSections", "skippedSections")
text = text.replace("ingestion ? 'true' : 'false'", "measuredState ? 'true' : 'false'")
text = text.replace("ingestion ? 'IMPORT ANOTHER' : 'IMPORT REPORT'", "measuredState ? 'IMPORT ANOTHER' : 'IMPORT REPORT'")
text = text.replace("{ingestion && <button className=\"lab-mode measured-clear\"", "{measuredState && <button className=\"lab-mode measured-clear\"")
text = text.replace("{ingestion && <small>THE PREVIOUS VALID REPORT REMAINS ACTIVE.</small>}", "{measuredState && <small>THE PREVIOUS VALID REPORT REMAINS ACTIVE.</small>}")
text = text.replace("{!ingestion ? <section className=\"measured-empty\">", "{!measuredState ? <section className=\"measured-empty\">")
if 'setIngestion' in text or 'ingestion.' in text or 'NetworkDiagnosticsIngestion' in text:
    raise SystemExit('Lab 09E workspace still contains local ingestion state after patch')
path.write_text(text)

# Wrapper type accepts measured state; rest props forward it to V2 automatically.
path = Path('src/JourneyTheater.tsx')
text = path.read_text()
text = replace_once(text, "import type { JourneyDetailLab } from './journey/model';\n", "import type { JourneyDetailLab } from './journey/model';\nimport type { MeasuredSnapshotState } from './measurement/state.ts';\n", 'Journey wrapper measured import')
text = replace_once(text, "  evidence: InternetEvidenceSnapshot | null;\n", "  evidence: InternetEvidenceSnapshot | null;\n  measuredState: MeasuredSnapshotState | null;\n", 'Journey wrapper measured prop type')
path.write_text(text)

# Journey V2 keeps SemanticScene simulation-only and renders a separate sidecar.
path = Path('src/JourneyTheaterV2.tsx')
text = path.read_text()
text = replace_once(text, "import { JourneyServerFailurePanel } from './JourneyServerFailurePanel';\n", "import { JourneyServerFailurePanel } from './JourneyServerFailurePanel';\nimport { MeasuredEvidenceSidecar } from './MeasuredEvidenceSidecar';\nimport type { MeasuredSnapshotState } from './measurement/state.ts';\n", 'Journey V2 measured imports')
text = replace_once(text, "export function JourneyTheater({ hostname, timeMs, startPlaying, evidence, onHostnameChange, onTimeChange, onEvidenceChange, onOpenDetail, onExit }: {", "export function JourneyTheater({ hostname, timeMs, startPlaying, evidence, measuredState, onHostnameChange, onTimeChange, onEvidenceChange, onOpenDetail, onExit }: {", 'Journey V2 measured prop destructure')
text = replace_once(text, "  evidence: InternetEvidenceSnapshot | null;\n", "  evidence: InternetEvidenceSnapshot | null;\n  measuredState: MeasuredSnapshotState | null;\n", 'Journey V2 measured prop type')
text = replace_once(text, "  const partitionSelected = selectedModifiers.includes('partition');\n", "  const partitionSelected = selectedModifiers.includes('partition');\n  const measuredScene = state.scale === 'routing' ? 'routing' : state.scale === 'transport' ? 'transport' : state.scale === 'application' && state.protocol === 'DNS' ? 'dns' : null;\n", 'Journey V2 measured scene')
old_shell = '<div className="journey-scene-shell"><div className="depth-rings" aria-hidden="true"><i/><i/><i/><i/></div><AnimatePresence mode="wait" initial={false}><motion.div key={`${state.scale}:${mode}`} className="journey-scene-transition"'
new_shell = '<div className={`journey-scene-shell ${measuredState && measuredScene ? \'measured-evidence-active\' : \'\'}`}><div className="depth-rings" aria-hidden="true"><i/><i/><i/><i/></div><AnimatePresence mode="wait" initial={false}><motion.div key={`${state.scale}:${mode}`} className="journey-scene-transition"'
text = replace_once(text, old_shell, new_shell, 'Journey V2 sidecar shell')
old_scene = '<SemanticScene state={state} hostname={scenario.hostname} address={scenario.destinationAddress}/></motion.div></AnimatePresence></div>\n          <AnimatePresence'
new_scene = '<SemanticScene state={state} hostname={scenario.hostname} address={scenario.destinationAddress}/></motion.div></AnimatePresence><MeasuredEvidenceSidecar measuredState={measuredState} scene={measuredScene} hostname={scenario.hostname} destinationAddress={scenario.destinationAddress}/></div>\n          <AnimatePresence'
text = replace_once(text, old_scene, new_scene, 'Journey V2 sidecar render')
if '<SemanticScene state={state} hostname={scenario.hostname} address={scenario.destinationAddress} measuredState=' in text:
    raise SystemExit('Lab 09E must never pass measured state into SemanticScene')
path.write_text(text)

# Sidecar reserves separate visual space beneath the simulated semantic renderer.
path = Path('src/MeasuredEvidenceSidecar.css')
text = path.read_text()
placement = ".journey-scene-shell.measured-evidence-active .journey-scene-transition{inset:18px 26px 122px}.journey-scene-shell>.journey-measured-sidecar{position:absolute;left:12px;right:12px;bottom:9px;margin:0}@media(max-width:720px){.journey-scene-shell.measured-evidence-active .journey-scene-transition{inset:14px 10px 184px}.journey-scene-shell>.journey-measured-sidecar{left:7px;right:7px;bottom:6px}}"
if placement not in text:
    text += "\n" + placement + "\n"
path.write_text(text)
