from pathlib import Path

path = Path('src/App.tsx')
text = path.read_text()
replacements = [
    (
        "import { ObservedInternet } from './ObservedInternet';\n",
        "import { ObservedInternet } from './ObservedInternet';\nimport { MeasuredNetworkWorkspace } from './MeasuredNetworkWorkspace';\n",
    ),
    (
        "type ActiveLab = 'journey' | 'failure' | 'packet' | 'tcp' | 'dns' | 'tls' | 'http' | 'builder' | 'physical' | 'internet' | 'observed' | null;",
        "type ActiveLab = 'journey' | 'failure' | 'packet' | 'tcp' | 'dns' | 'tls' | 'http' | 'builder' | 'physical' | 'internet' | 'observed' | 'measured' | null;",
    ),
    (
        "  const openObservedInternet = () => { setPlaying(false); setLayer('internet'); setActiveLab('observed'); };\n",
        "  const openObservedInternet = () => { setPlaying(false); setLayer('internet'); setActiveLab('observed'); };\n  const openMeasuredNetwork = () => { setPlaying(false); setLayer('internet'); setActiveLab('measured'); };\n",
    ),
    (
        "  const buildLabel = activeLab === 'journey'\n    ? 'LAB 07'",
        "  const buildLabel = activeLab === 'measured'\n    ? 'LAB 09'\n    : activeLab === 'journey'\n    ? 'LAB 07'",
    ),
    (
        "  const buildStatus = activeLab === 'journey'\n    ? 'GOD MODE JOURNEY ACTIVE'",
        "  const buildStatus = activeLab === 'measured'\n    ? 'LOCAL MEASUREMENT WORKSPACE ACTIVE'\n    : activeLab === 'journey'\n    ? 'GOD MODE JOURNEY ACTIVE'",
    ),
    (
        "                <motion.button className=\"primary-action\" type=\"button\" onClick={openJourney} whileHover={reduceMotion ? undefined : { y: -2, scale: 1.015 }} whileTap={reduceMotion ? undefined : { scale: 0.985 }}>Play URL journey<span aria-hidden=\"true\">↗</span></motion.button>\n                <button className=\"text-action text-button\" type=\"button\" onClick={overviewAction.run}>{overviewAction.label}</button>",
        "                <motion.button className=\"primary-action\" type=\"button\" onClick={openJourney} whileHover={reduceMotion ? undefined : { y: -2, scale: 1.015 }} whileTap={reduceMotion ? undefined : { scale: 0.985 }}>Play URL journey<span aria-hidden=\"true\">↗</span></motion.button>\n                <button className=\"text-action text-button\" type=\"button\" onClick={openMeasuredNetwork}>Inspect measured report</button>\n                <button className=\"text-action text-button\" type=\"button\" onClick={overviewAction.run}>{overviewAction.label}</button>",
    ),
    (
        "<span className=\"timeline-note\">Lab 01 failure · Lab 02 packet · Lab 03 protocols · Lab 04 builder · Lab 05 Internet · Lab 06 Journey</span>",
        "<span className=\"timeline-note\">Lab 01 failure · Lab 02 packet · Lab 03 protocols · Lab 04 builder · Lab 05 Internet · Lab 06 Journey · Lab 09 measured</span>",
    ),
    (
        "        ) : activeLab === 'observed' ? (\n          <ObservedInternet key=\"lab05-observed\" onExit={exitActiveLab} onOpenSimulated={openInternetLab} />\n        ) : (",
        "        ) : activeLab === 'observed' ? (\n          <ObservedInternet key=\"lab05-observed\" onExit={exitActiveLab} onOpenSimulated={openInternetLab} />\n        ) : activeLab === 'measured' ? (\n          <MeasuredNetworkWorkspace key=\"lab09-measured\" onExit={exitActiveLab} />\n        ) : (",
    ),
]
for old, new in replacements:
    if old not in text:
        raise SystemExit(f'Lab 09D App anchor missing: {old[:180]!r}')
    text = text.replace(old, new, 1)
path.write_text(text)

workspace = Path('src/MeasuredNetworkWorkspace.tsx')
workspace_text = workspace.read_text()
old = "{Array.from({ length: dots }, (_, index) => <i key={index} style={{ left: `${dots === 1 ? 50 : 8 + (index / (dots - 1)) * 84}%` }} />)}"
new = "{Array.from({ length: dots }, (_, index) => <i key={index} style={{ left: `${8 + (index / (dots - 1)) * 84}%` }} />)}"
if old not in workspace_text:
    raise SystemExit('Lab 09D semantic glyph anchor missing')
workspace.write_text(workspace_text.replace(old, new, 1))
