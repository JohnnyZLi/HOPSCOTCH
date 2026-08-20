from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file_path = Path(path)
    text = file_path.read_text()
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected one anchor, found {count}: {old!r}")
    file_path.write_text(text.replace(old, new, 1))


# App: track direction of abstraction travel and animate the scale inspector as a system.
replace_once(
    'src/App.tsx',
    "  const [layer, setLayer] = useState<NetworkLayer>(initialAppRoute.destination ? workspaceDefinition(initialAppRoute.destination).layer : 'internet');\n",
    "  const [layer, setLayer] = useState<NetworkLayer>(initialAppRoute.destination ? workspaceDefinition(initialAppRoute.destination).layer : 'internet');\n  const [scaleDirection, setScaleDirection] = useState<'inward' | 'outward'>('inward');\n",
)

replace_once(
    'src/App.tsx',
    "  const seek = (nextTime: number) => { setPlaying(false); setTimeMs(nextTime); };\n\n  const activeWorkspace = activeLab ? workspaceDefinition(activeLab) : null;\n",
    "  const seek = (nextTime: number) => { setPlaying(false); setTimeMs(nextTime); };\n  const selectOverviewLayer = (nextLayer: NetworkLayer) => {\n    if (nextLayer === layer) return;\n    const currentIndex = layers.findIndex((item) => item.id === layer);\n    const nextIndex = layers.findIndex((item) => item.id === nextLayer);\n    setScaleDirection(nextIndex > currentIndex ? 'inward' : 'outward');\n    setLayer(nextLayer);\n  };\n\n  const activeWorkspace = activeLab ? workspaceDefinition(activeLab) : null;\n",
)

replace_once(
    'src/App.tsx',
    '    <main className="app-shell" data-layer={layer} data-mode={mode} data-lab={activeLab ? \'active\' : \'idle\'}>',
    '    <main className="app-shell" data-layer={layer} data-scale-direction={scaleDirection} data-mode={mode} data-lab={activeLab ? \'active\' : \'idle\'}>',
)

old_inspector = '''              <div className="scale-inspector" data-active-scale={layer}>\n                <motion.aside key={active.id} className="layer-card" aria-label={`${active.label} scale details`} initial={reduceMotion ? { opacity: 1 } : { opacity: 0, x: -10, filter: 'blur(6px)' }} animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }} transition={{ duration: 0.28 }}>\n                  <p>{active.description}</p><div className="card-rule" />\n                  <small>{layer === 'packet' ? 'PACKET MICROSCOPE READY' : layer === 'transport' ? 'TCP PROTOCOL THEATER READY' : layer === 'application' ? 'HTTP + TLS + DNS THEATER READY' : layer === 'routing' ? 'DYNAMIC NETWORK BUILDER READY' : 'PHYSICAL + SIMULATED + OBSERVED INTERNET MODES READY'}</small>\n                </motion.aside>\n                <nav className="scale-rail" aria-label="Network scale">\n                  {layers.map((item) => <motion.button key={item.id} type="button" className={layer === item.id ? 'active' : ''} onClick={() => setLayer(item.id)} whileHover={reduceMotion ? undefined : { x: 5 }} transition={{ type: 'spring', stiffness: 420, damping: 32 }}><span>{item.kicker}</span><strong>{item.label}</strong></motion.button>)}\n                </nav>\n              </div>'''

new_inspector = '''              <div className="scale-inspector" data-active-scale={layer} data-direction={scaleDirection}>\n                {!reduceMotion && <motion.i key={`wave-${layer}`} className="scale-depth-wave" aria-hidden="true" initial={{ opacity: 0, scaleX: 0.03 }} animate={{ opacity: [0, 0.42, 0], scaleX: [0.03, 1, 1] }} transition={{ duration: 0.78, times: [0, 0.28, 1], ease: [0.16, 1, 0.3, 1] }} />}\n                {!reduceMotion && <motion.i key={`ripple-${layer}`} className="scale-depth-ripple" aria-hidden="true" initial={{ opacity: 0.52, scale: 0.3 }} animate={{ opacity: 0, scale: 1.75 }} transition={{ duration: 0.72, ease: [0.16, 1, 0.3, 1] }} />}\n                <motion.aside key={active.id} className="layer-card" aria-label={`${active.label} scale details`} initial={reduceMotion ? { opacity: 1 } : { opacity: 0, x: 18, y: scaleDirection === 'inward' ? -10 : 10, scale: 0.985, filter: 'blur(10px)' }} animate={{ opacity: 1, x: 0, y: 0, scale: 1, filter: 'blur(0px)' }} transition={{ duration: 0.52, ease: [0.16, 1, 0.3, 1] }}>\n                  <motion.i className="scale-connector" aria-hidden="true" initial={reduceMotion ? false : { opacity: 0, scaleX: 0 }} animate={{ opacity: 1, scaleX: 1 }} transition={{ delay: 0.04, duration: 0.34, ease: [0.16, 1, 0.3, 1] }} />\n                  <motion.p initial={reduceMotion ? false : { opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1, duration: 0.34 }}>{active.description}</motion.p>\n                  <motion.div className="card-rule" initial={reduceMotion ? false : { scaleX: 0, opacity: 0 }} animate={{ scaleX: 1, opacity: 1 }} transition={{ delay: 0.16, duration: 0.38, ease: [0.16, 1, 0.3, 1] }} />\n                  <motion.small initial={reduceMotion ? false : { opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24, duration: 0.3 }}>{layer === 'packet' ? 'PACKET MICROSCOPE READY' : layer === 'transport' ? 'TCP PROTOCOL THEATER READY' : layer === 'application' ? 'HTTP + TLS + DNS THEATER READY' : layer === 'routing' ? 'DYNAMIC NETWORK BUILDER READY' : 'PHYSICAL + SIMULATED + OBSERVED INTERNET MODES READY'}</motion.small>\n                </motion.aside>\n                <nav className="scale-rail" aria-label="Network scale">\n                  {layers.map((item) => {\n                    const selected = layer === item.id;\n                    return <motion.button key={item.id} type="button" className={selected ? 'active' : ''} onClick={() => selectOverviewLayer(item.id)} animate={reduceMotion ? { opacity: selected ? 1 : 0.72 } : { x: selected ? -4 : 0, opacity: selected ? 1 : 0.68 }} whileHover={reduceMotion ? undefined : { x: selected ? -7 : 5, opacity: 1 }} transition={{ type: 'spring', stiffness: 360, damping: 28, mass: 0.65 }}>{selected && <motion.i className="scale-active-marker" layoutId="overview-scale-marker" aria-hidden="true" transition={{ type: 'spring', stiffness: 260, damping: 24, mass: 0.7 }} />}<span>{item.kicker}</span><strong>{item.label}</strong></motion.button>;\n                  })}\n                </nav>\n              </div>'''
replace_once('src/App.tsx', old_inspector, new_inspector)

# CSS: physical camera depth, travelling cursor, connector, scan wave and ripple.
replace_once(
    'src/styles.css',
    '''.network-field {\n  z-index: -4;\n  color: var(--cyan);\n  transform: scale(1.13) translateX(7%);\n  transition: filter 450ms ease, opacity 450ms ease;\n}\n''',
    '''.app-shell[data-lab="idle"][data-layer="internet"] { --network-depth-scale: 1.08; --network-depth-x: 4%; --grid-depth-scale: 0.96; }\n.app-shell[data-lab="idle"][data-layer="routing"] { --network-depth-scale: 1.14; --network-depth-x: 6%; --grid-depth-scale: 1; }\n.app-shell[data-lab="idle"][data-layer="transport"] { --network-depth-scale: 1.21; --network-depth-x: 9%; --grid-depth-scale: 1.045; }\n.app-shell[data-lab="idle"][data-layer="application"] { --network-depth-scale: 1.28; --network-depth-x: 12%; --grid-depth-scale: 1.085; }\n.app-shell[data-lab="idle"][data-layer="packet"] { --network-depth-scale: 1.36; --network-depth-x: 16%; --grid-depth-scale: 1.13; }\n\n.network-field {\n  z-index: -4;\n  color: var(--cyan);\n  transform-origin: 66% 46%;\n  transform: scale(var(--network-depth-scale, 1.13)) translateX(var(--network-depth-x, 7%));\n  transition: transform 900ms cubic-bezier(0.16, 1, 0.3, 1), filter 450ms ease, opacity 450ms ease;\n}\n''',
)

replace_once(
    'src/styles.css',
    '''.grid-field {\n  z-index: -3;\n  opacity: 0.16;\n  background-image:\n    linear-gradient(rgba(255, 255, 255, 0.11) 1px, transparent 1px),\n    linear-gradient(90deg, rgba(255, 255, 255, 0.11) 1px, transparent 1px);\n  background-size: 64px 64px;\n  mask-image: radial-gradient(circle at 60% 44%, black, transparent 76%);\n}\n''',
    '''.grid-field {\n  z-index: -3;\n  opacity: 0.16;\n  transform-origin: 62% 44%;\n  transform: scale(var(--grid-depth-scale, 1));\n  background-image:\n    linear-gradient(rgba(255, 255, 255, 0.11) 1px, transparent 1px),\n    linear-gradient(90deg, rgba(255, 255, 255, 0.11) 1px, transparent 1px);\n  background-size: 64px 64px;\n  mask-image: radial-gradient(circle at 60% 44%, black, transparent 76%);\n  transition: transform 900ms cubic-bezier(0.16, 1, 0.3, 1), opacity 500ms ease;\n}\n''',
)

old_rail_markers = '''.scale-rail button::before {\n  content: "";\n  position: absolute;\n  top: 50%;\n  left: -2px;\n  width: 3px;\n  height: 0;\n  background: var(--cyan);\n  transform: translateY(-50%);\n  transition: height 240ms ease;\n}\n\n.scale-rail button::after {\n  content: "";\n  position: absolute;\n  top: 50%;\n  left: -33px;\n  width: 32px;\n  height: 1px;\n  opacity: 0;\n  background: linear-gradient(90deg, rgba(121, 242, 218, 0.22), rgba(121, 242, 218, 0.82));\n  transform: translateY(-50%) scaleX(0.25);\n  transform-origin: right center;\n  transition: opacity 180ms ease, transform 220ms ease;\n}\n\n.scale-rail button.active::before {\n  height: 28px;\n}\n\n.scale-rail button.active::after {\n  opacity: 1;\n  transform: translateY(-50%) scaleX(1);\n}\n'''

new_rail_markers = '''.scale-active-marker {\n  position: absolute;\n  z-index: 3;\n  top: 50%;\n  left: -2px;\n  width: 3px;\n  height: 29px;\n  border-radius: 999px;\n  background: var(--cyan);\n  box-shadow: 0 0 10px rgba(121, 242, 218, 0.58), 0 0 28px rgba(121, 242, 218, 0.22);\n  transform: translateY(-50%);\n  pointer-events: none;\n}\n\n.scale-active-marker::after {\n  content: "";\n  position: absolute;\n  top: 50%;\n  left: 50%;\n  width: 13px;\n  height: 13px;\n  border: 1px solid rgba(121, 242, 218, 0.34);\n  border-radius: 50%;\n  transform: translate(-50%, -50%);\n}\n\n.scale-depth-wave {\n  position: absolute;\n  z-index: 0;\n  top: var(--scale-detail-y);\n  right: 141px;\n  width: min(48vw, 740px);\n  height: 1px;\n  background: linear-gradient(90deg, transparent 0%, rgba(122, 156, 255, 0.08) 48%, rgba(121, 242, 218, 0.62) 100%);\n  box-shadow: 0 0 18px rgba(121, 242, 218, 0.16);\n  transform-origin: right center;\n  pointer-events: none;\n}\n\n.scale-depth-ripple {\n  position: absolute;\n  z-index: 0;\n  top: calc(var(--scale-detail-y) - 27px);\n  right: 115px;\n  width: 54px;\n  height: 54px;\n  border: 1px solid rgba(121, 242, 218, 0.34);\n  border-radius: 50%;\n  box-shadow: inset 0 0 18px rgba(121, 242, 218, 0.05), 0 0 28px rgba(121, 242, 218, 0.08);\n  pointer-events: none;\n}\n'''
replace_once('src/styles.css', old_rail_markers, new_rail_markers)

replace_once(
    'src/styles.css',
    '''.layer-card::after {\n  content: "";\n  position: absolute;\n  top: 50%;\n  right: -2px;\n  width: 4px;\n  height: 4px;\n  border-radius: 50%;\n  background: rgba(121, 242, 218, 0.86);\n  box-shadow: 0 0 10px rgba(121, 242, 218, 0.28);\n  transform: translate(50%, -50%);\n}\n''',
    '''.layer-card::after {\n  content: "";\n  position: absolute;\n  top: 50%;\n  right: -2px;\n  width: 4px;\n  height: 4px;\n  border-radius: 50%;\n  background: rgba(121, 242, 218, 0.86);\n  box-shadow: 0 0 10px rgba(121, 242, 218, 0.28);\n  transform: translate(50%, -50%);\n}\n\n.scale-connector {\n  position: absolute;\n  top: 50%;\n  right: -33px;\n  width: 32px;\n  height: 1px;\n  background: linear-gradient(90deg, rgba(121, 242, 218, 0.28), rgba(121, 242, 218, 0.9));\n  box-shadow: 0 0 12px rgba(121, 242, 218, 0.16);\n  transform-origin: right center;\n  pointer-events: none;\n}\n''',
)

replace_once(
    'src/styles.css',
    '''  .scale-rail button::before {\n    top: auto;\n    bottom: -2px;\n    left: 50%;\n    width: 0;\n    height: 3px;\n    transform: translateX(-50%);\n    transition: width 240ms ease;\n  }\n\n  .scale-rail button::after {\n    display: none;\n  }\n\n  .scale-rail button.active::before {\n    width: 28px;\n    height: 3px;\n  }\n''',
    '''  .scale-active-marker {\n    top: auto;\n    bottom: -2px;\n    left: 50%;\n    width: 28px;\n    height: 3px;\n    transform: translateX(-50%);\n  }\n\n  .scale-active-marker::after,\n  .scale-depth-wave,\n  .scale-depth-ripple {\n    display: none;\n  }\n''',
)

# The mobile field intentionally keeps its stronger fixed crop; desktop depth transitions stay scoped above.

# Anime.js network-field response: every scale change injects energy into nodes/edges.
replace_once(
    'src/NetworkField.tsx',
    '''const layerBias: Record<NetworkLayer, string> = {\n  internet: '0.42',\n  routing: '0.72',\n  transport: '0.58',\n  application: '0.5',\n  packet: '0.82',\n};\n''',
    '''const layerBias: Record<NetworkLayer, string> = {\n  internet: '0.42',\n  routing: '0.72',\n  transport: '0.58',\n  application: '0.5',\n  packet: '0.82',\n};\n\nconst layerEnergy: Record<NetworkLayer, number> = {\n  internet: 0.92,\n  routing: 1,\n  transport: 1.06,\n  application: 1.12,\n  packet: 1.2,\n};\n\nconst layerDashTravel: Record<NetworkLayer, number> = {\n  internet: -10,\n  routing: -24,\n  transport: -40,\n  application: -58,\n  packet: -76,\n};\n\nconst layerPulseDuration: Record<NetworkLayer, number> = {\n  internet: 1900,\n  routing: 1650,\n  transport: 1420,\n  application: 1180,\n  packet: 920,\n};\n''',
)

replace_once(
    'src/NetworkField.tsx',
    "      scale: [0.78, mode === 'xray' ? 1.18 : 1],\n",
    "      scale: [0.78, (mode === 'xray' ? 1.18 : 1) * layerEnergy[layer]],\n",
)

replace_once(
    'src/NetworkField.tsx',
    "      strokeDashoffset: mode === 'xray' ? -56 : 0,\n",
    "      strokeDashoffset: [0, mode === 'xray' ? -84 : layerDashTravel[layer]],\n",
)

replace_once(
    'src/NetworkField.tsx',
    "      duration: 1800,\n",
    "      duration: layerPulseDuration[layer],\n",
)

replace_once(
    'src/NetworkField.tsx',
    '''    const pulseAnimation = animate(root.querySelectorAll('.network-pulse'), {\n      opacity: [0.12, 0.88],\n      scale: [0.72, 1.35],\n      delay: stagger(130, { from: 'center' }),\n      duration: layerPulseDuration[layer],\n      ease: 'inOutSine',\n      alternate: true,\n      loop: true,\n    });\n\n    return () => {\n      nodeAnimation.cancel();\n      edgeAnimation.cancel();\n      pulseAnimation.cancel();\n    };\n''',
    '''    const pulseAnimation = animate(root.querySelectorAll('.network-pulse'), {\n      opacity: [0.12, 0.88],\n      scale: [0.72, 1.35 * layerEnergy[layer]],\n      delay: stagger(130, { from: 'center' }),\n      duration: layerPulseDuration[layer],\n      ease: 'inOutSine',\n      alternate: true,\n      loop: true,\n    });\n\n    const coreAnimation = animate(root.querySelectorAll('.network-core'), {\n      opacity: [0.28, 1],\n      scale: [0.58, 1.42 * layerEnergy[layer], 1],\n      delay: stagger(34, { from: 'center' }),\n      duration: 720,\n      ease: 'outExpo',\n    });\n\n    return () => {\n      nodeAnimation.cancel();\n      edgeAnimation.cancel();\n      pulseAnimation.cancel();\n      coreAnimation.cancel();\n    };\n''',
)

# Contract: animation must preserve semantic attachment, depth progression and reduced-motion support.
replace_once(
    'scripts/ui-stability-contract-check.mjs',
    "const journey = readFileSync(new URL('../src/JourneyTheater.css', import.meta.url), 'utf8');\n",
    "const journey = readFileSync(new URL('../src/JourneyTheater.css', import.meta.url), 'utf8');\nconst app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');\nconst networkField = readFileSync(new URL('../src/NetworkField.tsx', import.meta.url), 'utf8');\n",
)

anchor = '''assert.ok(\n  styles.includes('@media (max-width: 1380px) and (min-width: 1181px)') && styles.includes('display: none;'),\n  'scale explanation must disappear before it can collide horizontally with the hero/action deck',\n);\n\n'''
insert = anchor + '''assert.ok(\n  app.includes('layoutId="overview-scale-marker"') && app.includes('scale-depth-wave') && app.includes('scale-depth-ripple'),\n  'overview scale changes must expose a travelling cursor plus bounded transition wave/ripple',\n);\nassert.ok(\n  app.includes("setScaleDirection(nextIndex > currentIndex ? 'inward' : 'outward')"),\n  'overview scale motion must preserve whether the user is diving inward or pulling outward',\n);\nassert.ok(\n  styles.includes('.app-shell[data-lab="idle"][data-layer="packet"] { --network-depth-scale: 1.36;') && styles.includes('transition: transform 900ms cubic-bezier(0.16, 1, 0.3, 1)'),\n  'overview network scene must physically deepen as abstraction moves toward Packet',\n);\nassert.ok(\n  networkField.includes('layerDashTravel') && networkField.includes('layerPulseDuration') && networkField.includes('coreAnimation'),\n  'Anime.js network-field response must intensify deterministically with selected scale',\n);\nassert.ok(\n  styles.includes('@media (prefers-reduced-motion: reduce)'),\n  'scale spectacle must retain the global reduced-motion escape hatch',\n);\n\n'''
replace_once('scripts/ui-stability-contract-check.mjs', anchor, insert)

replace_once(
    'scripts/ui-stability-contract-check.mjs',
    "console.log('UI stability contract passed: the attached scale inspector stays out of primary action space, and Journey timer metadata cannot reflow adjacent cells.');",
    "console.log('UI stability contract passed: attached scale motion preserves geometry, direction, depth, reduced-motion behavior, and Journey timer stability.');",
)
