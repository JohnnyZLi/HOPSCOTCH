from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected one anchor, found {count}: {old!r}")
    p.write_text(text.replace(old, new, 1))

replace_once(
    'src/App.tsx',
    "  const active = layers.find((item) => item.id === layer) ?? layers[0];\n",
    "  const active = layers.find((item) => item.id === layer) ?? layers[0];\n  const activeLayerTop = 24.5 + Math.max(0, layers.findIndex((item) => item.id === layer)) * 52;\n",
)

old = '''                <motion.aside key={active.id} className="layer-card" aria-label={`${active.label} scale details`} initial={reduceMotion ? { opacity: 1 } : { opacity: 0, x: 18, y: scaleDirection === 'inward' ? -10 : 10, scale: 0.985, filter: 'blur(10px)' }} animate={{ opacity: 1, x: 0, y: 0, scale: 1, filter: 'blur(0px)' }} transition={{ duration: 0.52, ease: [0.16, 1, 0.3, 1] }}>\n                  <motion.i className="scale-connector" aria-hidden="true" initial={reduceMotion ? false : { opacity: 0, scaleX: 0 }} animate={{ opacity: 1, scaleX: 1 }} transition={{ delay: 0.04, duration: 0.34, ease: [0.16, 1, 0.3, 1] }} />\n                  <motion.p initial={reduceMotion ? false : { opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1, duration: 0.34 }}>{active.description}</motion.p>\n                  <motion.div className="card-rule" initial={reduceMotion ? false : { scaleX: 0, opacity: 0 }} animate={{ scaleX: 1, opacity: 1 }} transition={{ delay: 0.16, duration: 0.38, ease: [0.16, 1, 0.3, 1] }} />\n                  <motion.small initial={reduceMotion ? false : { opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24, duration: 0.3 }}>{layer === 'packet' ? 'PACKET MICROSCOPE READY' : layer === 'transport' ? 'TCP PROTOCOL THEATER READY' : layer === 'application' ? 'HTTP + TLS + DNS THEATER READY' : layer === 'routing' ? 'DYNAMIC NETWORK BUILDER READY' : 'PHYSICAL + SIMULATED + OBSERVED INTERNET MODES READY'}</motion.small>\n                </motion.aside>'''

new = '''                <motion.aside className="layer-card" aria-label={`${active.label} scale details`} initial={false} animate={{ top: activeLayerTop }} transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 220, damping: 27, mass: 0.75 }}>\n                  <motion.i className="scale-connector" aria-hidden="true" initial={false} animate={{ opacity: 1, scaleX: 1 }} transition={{ duration: reduceMotion ? 0 : 0.24 }} />\n                  <AnimatePresence mode="wait" initial={false}>\n                    <motion.div key={active.id} className="layer-card-copy" initial={reduceMotion ? { opacity: 1 } : { opacity: 0, x: 16, y: scaleDirection === 'inward' ? -8 : 8, filter: 'blur(9px)' }} animate={{ opacity: 1, x: 0, y: 0, filter: 'blur(0px)' }} exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -8, y: scaleDirection === 'inward' ? 5 : -5, filter: 'blur(5px)' }} transition={{ duration: reduceMotion ? 0 : 0.24, ease: [0.16, 1, 0.3, 1] }}>\n                      <motion.p initial={reduceMotion ? false : { opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.04, duration: 0.28 }}>{active.description}</motion.p>\n                      <motion.div className="card-rule" initial={reduceMotion ? false : { scaleX: 0, opacity: 0 }} animate={{ scaleX: 1, opacity: 1 }} transition={{ delay: 0.08, duration: 0.3, ease: [0.16, 1, 0.3, 1] }} />\n                      <motion.small initial={reduceMotion ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.13, duration: 0.24 }}>{layer === 'packet' ? 'PACKET MICROSCOPE READY' : layer === 'transport' ? 'TCP PROTOCOL THEATER READY' : layer === 'application' ? 'HTTP + TLS + DNS THEATER READY' : layer === 'routing' ? 'DYNAMIC NETWORK BUILDER READY' : 'PHYSICAL + SIMULATED + OBSERVED INTERNET MODES READY'}</motion.small>\n                    </motion.div>\n                  </AnimatePresence>\n                </motion.aside>'''
replace_once('src/App.tsx', old, new)

replace_once(
    'scripts/ui-stability-contract-check.mjs',
    "assert.ok(\n  app.includes('layoutId=\"overview-scale-marker\"') && app.includes('scale-depth-wave') && app.includes('scale-depth-ripple'),\n  'overview scale changes must expose a travelling cursor plus bounded transition wave/ripple',\n);\n",
    "assert.ok(\n  app.includes('layoutId=\"overview-scale-marker\"') && app.includes('scale-depth-wave') && app.includes('scale-depth-ripple'),\n  'overview scale changes must expose a travelling cursor plus bounded transition wave/ripple',\n);\nassert.ok(\n  app.includes('const activeLayerTop = 24.5 +') && app.includes('animate={{ top: activeLayerTop }}') && app.includes('className=\"layer-card-copy\"'),\n  'scale explanation and connector must physically travel between rows while their contents resolve independently',\n);\n",
)
