from pathlib import Path

# App: hold only the projected measured state in memory and pass it to Lab 09 / Journey.
path = Path('src/App.tsx')
text = path.read_text()
replacements = [
    (
        "import { MeasuredNetworkWorkspace } from './MeasuredNetworkWorkspace';\n",
        "import { MeasuredNetworkWorkspace } from './MeasuredNetworkWorkspace';\nimport type { MeasuredSnapshotState } from './measurement/state.ts';\n",
    ),
    (
        "  const [journeyEvidence, setJourneyEvidence] = useState<InternetEvidenceSnapshot | null>(null);\n",
        "  const [journeyEvidence, setJourneyEvidence] = useState<InternetEvidenceSnapshot | null>(null);\n  const [measuredSession, setMeasuredSession] = useState<MeasuredSnapshotState | null>(null);\n",
    ),
    (
        '<JourneyTheater key={`lab06-${journeyRenderKey}`} hostname={journeyHostname} timeMs={journeyTimeMs} startPlaying={journeyStartPlaying} evidence={journeyEvidence} onHostnameChange={setJourneyHostname} onTimeChange={setJourneyTimeMs} onEvidenceChange={setJourneyEvidence} onOpenDetail={openJourneyDetail} onExit={exitLabs} />',
        '<JourneyTheater key={`lab06-${journeyRenderKey}`} hostname={journeyHostname} timeMs={journeyTimeMs} startPlaying={journeyStartPlaying} evidence={journeyEvidence} measuredState={measuredSession} onHostnameChange={setJourneyHostname} onTimeChange={setJourneyTimeMs} onEvidenceChange={setJourneyEvidence} onOpenDetail={openJourneyDetail} onExit={exitLabs} />',
    ),
    (
        '<MeasuredNetworkWorkspace key="lab09-measured" onExit={exitActiveLab} />',
        '<MeasuredNetworkWorkspace key="lab09-measured" measuredState={measuredSession} onMeasuredStateChange={setMeasuredSession} onExit={exitActiveLab} />',
    ),
]
for old, new in replacements:
    if old not in text:
        raise SystemExit(f'Lab 09E App anchor missing: {old[:200]!r}')
    text = text.replace(old, new, 1)
path.write_text(text)

# Measured workspace: App owns the session-only projection; this component owns only transient import UI metadata.
path = Path('src/MeasuredNetworkWorkspace.tsx')
text = path.read_text()
replacements = [
    (
        "  ingestNetworkDiagnosticsReportV2,\n  type NetworkDiagnosticsIngestion,\n} from './measurement/networkDiagnosticsAdapter.ts';",
        "  ingestNetworkDiagnosticsReportV2,\n} from './measurement/networkDiagnosticsAdapter.ts';",
    ),
    (
        "  measuredFactsByCategory,\n  measuredFreshnessAt,\n  type MeasuredFreshness,\n} from './measurement/state.ts';",
        "  measuredFactsByCategory,\n  measuredFreshnessAt,\n  type MeasuredFreshness,\n  type MeasuredSnapshotState,\n} from './measurement/state.ts';",
    ),
    (
        "export function MeasuredNetworkWorkspace({ onExit }: { onExit: () => void }) {",
        "export function MeasuredNetworkWorkspace({ measuredState, onMeasuredStateChange, onExit }: { measuredState: MeasuredSnapshotState | null; onMeasuredStateChange: (state: MeasuredSnapshotState | null) => void; onExit: () => void }) {",
    ),
    (
        "  const [ingestion, setIngestion] = useState<NetworkDiagnosticsIngestion | null>(null);\n",
        "",
    ),
    (
        "    if (ingestion === null) return;\n",
        "    if (measuredState === null) return;\n",
    ),
    (
        "  }, [ingestion]);",
        "  }, [measuredState]);",
    ),
    (
        "    for (const category of CATEGORY_ORDER) counts.set(category, ingestion ? measuredFactsByCategory(ingestion.state, category).length : 0);\n",
        "    for (const category of CATEGORY_ORDER) counts.set(category, measuredState ? measuredFactsByCategory(measuredState, category).length : 0);\n",
    ),
    (
        "  }, [ingestion]);",
        "  }, [measuredState]);",
    ),
    (
        "    () => ingestion ? measuredFactsByCategory(ingestion.state, selectedCategory) : [],\n    [ingestion, selectedCategory],\n",
        "    () => measuredState ? measuredFactsByCategory(measuredState, selectedCategory) : [],\n    [measuredState, selectedCategory],\n",
    ),
    (
        "  const freshness = ingestion ? measuredFreshnessAt(ingestion.state, nowMs) : null;",
        "  const freshness = measuredState ? measuredFreshnessAt(measuredState, nowMs) : null;",
    ),
    (
        "  const chooseBestCategory = (next: NetworkDiagnosticsIngestion) => {",
        "  const chooseBestCategory = (next: MeasuredSnapshotState) => {",
    ),
    (
        "    const first = preferred.find((category) => measuredFactsByCategory(next.state, category).length > 0);",
        "    const first = preferred.find((category) => measuredFactsByCategory(next, category).length > 0);",
    ),
    (
        "      setIngestion(next);\n      setFileName(file.name);\n      setNowMs(Date.now());\n      chooseBestCategory(next);",
        "      onMeasuredStateChange(next.state);\n      setFileName(file.name);\n      setNowMs(Date.now());\n      chooseBestCategory(next.state);",
    ),
    (
        "    setIngestion(null);\n",
        "    onMeasuredStateChange(null);\n",
    ),
    (
        "data-measured-loaded={ingestion ? 'true' : 'false'}",
        "data-measured-loaded={measuredState ? 'true' : 'false'}",
    ),
    (
        "{ingestion ? 'IMPORT ANOTHER' : 'IMPORT REPORT'}",
        "{measuredState ? 'IMPORT ANOTHER' : 'IMPORT REPORT'}",
    ),
    (
        "{ingestion && <button className=\"lab-mode measured-clear\"",
        "{measuredState && <button className=\"lab-mode measured-clear\"",
    ),
    (
        "{error && <motion.div key={error} className=\"measured-error\"",
        "{error && <motion.div key={error} className=\"measured-error\"",
    ),
    (
        "{ingestion && <small>THE PREVIOUS VALID REPORT REMAINS ACTIVE.</small>}",
        "{measuredState && <small>THE PREVIOUS VALID REPORT REMAINS ACTIVE.</small>}",
    ),
    (
        "{!ingestion ? <section className=\"measured-empty\">",
        "{!measuredState ? <section className=\"measured-empty\">",
    ),
]
for old, new in replacements:
    if old not in text:
        raise SystemExit(f'Lab 09E workspace anchor missing: {old[:200]!r}')
    text = text.replace(old, new, 1)
# Remaining JSX references are direct measured-state fields.
text = text.replace('ingestion.snapshot.', 'measuredState.snapshot.')
text = text.replace('ingestion.state.', 'measuredState.')
text = text.replace('ingestion.state', 'measuredState')
text = text.replace('ingestion.skippedSections', 'skippedSections')
# Derive skipped-section presentation from the validated snapshot warnings.
anchor = "  const categoryCopy = CATEGORY_COPY[selectedCategory];\n"
addition = anchor + "  const skippedSections = measuredState?.snapshot.warnings.filter((warning) => warning.includes(':') || warning.startsWith('unknown root fields ignored:')) ?? [];\n"
if anchor not in text:
    raise SystemExit('Lab 09E skipped-section anchor missing')
text = text.replace(anchor, addition, 1)
path.write_text(text)

# Journey wrapper: optional measured state is a presentation-only prop.
path = Path('src/JourneyTheater.tsx')
text = path.read_text()
replacements = [
    (
        "import type { JourneyDetailLab } from './journey/model';\n",
        "import type { JourneyDetailLab } from './journey/model';\nimport type { MeasuredSnapshotState } from './measurement/state.ts';\n",
    ),
    (
        "export function JourneyTheater({ hostname, timeMs, startPlaying, evidence, onHostnameChange, onTimeChange, onEvidenceChange, onOpenDetail, onExit }: {",
        "export function JourneyTheater({ hostname, timeMs, startPlaying, evidence, measuredState, onHostnameChange, onTimeChange, onEvidenceChange, onOpenDetail, onExit }: {",
    ),
    (
        "  evidence: InternetEvidenceSnapshot | null;\n",
        "  evidence: InternetEvidenceSnapshot | null;\n  measuredState: MeasuredSnapshotState | null;\n",
    ),
    (
        "return <JourneyTheaterV2 hostname={hostname} timeMs={timeMs} startPlaying={startPlaying} evidence={evidence} onHostnameChange={onHostnameChange} onTimeChange={onTimeChange} onEvidenceChange={onEvidenceChange} onOpenDetail={onOpenDetail} onExit={onExit} />;",
        "return <JourneyTheaterV2 hostname={hostname} timeMs={timeMs} startPlaying={startPlaying} evidence={evidence} measuredState={measuredState} onHostnameChange={onHostnameChange} onTimeChange={onTimeChange} onEvidenceChange={onEvidenceChange} onOpenDetail={onOpenDetail} onExit={onExit} />;",
    ),
]
for old, new in replacements:
    if old not in text:
        raise SystemExit(f'Lab 09E Journey wrapper anchor missing: {old[:200]!r}')
    text = text.replace(old, new, 1)
path.write_text(text)

# Journey V2: scenes still receive only JourneyState; sidecar reads measured state separately.
path = Path('src/JourneyTheaterV2.tsx')
text = path.read_text()
replacements = [
    (
        "import { JourneyServerFailurePanel } from './JourneyServerFailurePanel';\n",
        "import { JourneyServerFailurePanel } from './JourneyServerFailurePanel';\nimport { MeasuredEvidenceSidecar } from './MeasuredEvidenceSidecar';\nimport type { MeasuredSnapshotState } from './measurement/state.ts';\n",
    ),
    (
        "export function JourneyTheater({ hostname, timeMs, startPlaying, evidence, onHostnameChange, onTimeChange, onEvidenceChange, onOpenDetail, onExit }: {",
        "export function JourneyTheater({ hostname, timeMs, startPlaying, evidence, measuredState, onHostnameChange, onTimeChange, onEvidenceChange, onOpenDetail, onExit }: {",
    ),
    (
        "  evidence: InternetEvidenceSnapshot | null;\n",
        "  evidence: InternetEvidenceSnapshot | null;\n  measuredState: MeasuredSnapshotState | null;\n",
    ),
    (
        "  const partitionSelected = selectedModifiers.includes('partition');\n",
        "  const partitionSelected = selectedModifiers.includes('partition');\n  const measuredScene = state.scale === 'routing' ? 'routing' : state.scale === 'transport' ? 'transport' : state.scale === 'application' && state.protocol === 'DNS' ? 'dns' : null;\n",
    ),
    (
        '<div className="journey-scene-shell"><div className="depth-rings" aria-hidden="true"><i/><i/><i/><i/></div><AnimatePresence mode="wait" initial={false}><motion.div key={`${state.scale}:${mode}`} className="journey-scene-transition"',
        '<div className={`journey-scene-shell ${measuredState && measuredScene ? \'measured-evidence-active\' : \'\'}`}><div className="depth-rings" aria-hidden="true"><i/><i/><i/><i/></div><AnimatePresence mode="wait" initial={false}><motion.div key={`${state.scale}:${mode}`} className="journey-scene-transition"',
    ),
    (
        '<SemanticScene state={state} hostname={scenario.hostname} address={scenario.destinationAddress}/></motion.div></AnimatePresence></div>\n          <AnimatePresence',
        '<SemanticScene state={state} hostname={scenario.hostname} address={scenario.destinationAddress}/></motion.div></AnimatePresence><MeasuredEvidenceSidecar measuredState={measuredState} scene={measuredScene} hostname={scenario.hostname} destinationAddress={scenario.destinationAddress}/></div>\n          <AnimatePresence',
    ),
]
for old, new in replacements:
    if old not in text:
        raise SystemExit(f'Lab 09E Journey V2 anchor missing: {old[:220]!r}')
    text = text.replace(old, new, 1)
path.write_text(text)

# Reserve semantic-scene space for the sidecar rather than covering the visualization.
path = Path('src/MeasuredEvidenceSidecar.css')
text = path.read_text()
text += "\n.journey-scene-shell.measured-evidence-active .journey-scene-transition{inset:18px 26px 122px}.journey-scene-shell>.journey-measured-sidecar{position:absolute;left:12px;right:12px;bottom:9px;margin:0}@media(max-width:720px){.journey-scene-shell.measured-evidence-active .journey-scene-transition{inset:14px 10px 184px}.journey-scene-shell>.journey-measured-sidecar{left:7px;right:7px;bottom:6px}}\n"
path.write_text(text)
