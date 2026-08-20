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
    '''                {!reduceMotion && <motion.i key={`wave-${layer}`} className="scale-depth-wave" aria-hidden="true" initial={{ opacity: 0, scaleX: 0.03 }} animate={{ opacity: [0, 0.42, 0], scaleX: [0.03, 1, 1] }} transition={{ duration: 0.78, times: [0, 0.28, 1], ease: [0.16, 1, 0.3, 1] }} />}''',
    '''                {!reduceMotion && <i key={`wave-${layer}`} className="scale-depth-wave" aria-hidden="true" />}''',
)

replace_once(
    'src/styles.css',
    '''  box-shadow: 0 0 10px rgba(121, 242, 218, 0.58), 0 0 28px rgba(121, 242, 218, 0.22);\n  transform: translateY(-50%);\n  pointer-events: none;''',
    '''  margin-top: -14.5px;\n  box-shadow: 0 0 10px rgba(121, 242, 218, 0.58), 0 0 28px rgba(121, 242, 218, 0.22);\n  pointer-events: none;''',
)

replace_once(
    'src/styles.css',
    '''.scale-depth-wave {\n  position: absolute;\n  z-index: 0;\n  top: var(--scale-detail-y);\n  right: 141px;\n  width: min(48vw, 740px);\n  height: 1px;\n  background: linear-gradient(90deg, transparent 0%, rgba(122, 156, 255, 0.08) 48%, rgba(121, 242, 218, 0.62) 100%);\n  box-shadow: 0 0 18px rgba(121, 242, 218, 0.16);\n  transform-origin: right center;\n  pointer-events: none;\n}\n''',
    '''.scale-depth-wave {\n  position: absolute;\n  z-index: 0;\n  top: var(--scale-detail-y);\n  right: 141px;\n  width: min(48vw, 740px);\n  height: 1px;\n  opacity: 0;\n  background: linear-gradient(90deg, transparent 0%, rgba(122, 156, 255, 0.08) 48%, rgba(121, 242, 218, 0.62) 100%);\n  box-shadow: 0 0 18px rgba(121, 242, 218, 0.16);\n  transform: scaleX(0.03);\n  transform-origin: right center;\n  animation: scale-depth-wave-in 780ms cubic-bezier(0.16, 1, 0.3, 1) both;\n  pointer-events: none;\n}\n\n.scale-inspector[data-direction="outward"] .scale-depth-wave {\n  animation-name: scale-depth-wave-out;\n}\n\n@keyframes scale-depth-wave-in {\n  0% { opacity: 0; transform: scaleX(0.03); }\n  24% { opacity: 0.5; }\n  66% { opacity: 0.18; }\n  100% { opacity: 0; transform: scaleX(1); }\n}\n\n@keyframes scale-depth-wave-out {\n  0% { opacity: 0; transform: scaleX(1); }\n  24% { opacity: 0.44; }\n  66% { opacity: 0.16; }\n  100% { opacity: 0; transform: scaleX(0.03); }\n}\n''',
)

replace_once(
    'src/styles.css',
    '''  width: min(300px, calc(100% - 206px));\n  padding: 13px 16px 13px 0;\n  translate: 0 -50%;\n  border: 0;\n  border-radius: 0;\n  background: linear-gradient(90deg, rgba(5, 8, 12, 0.82), rgba(5, 8, 12, 0.46) 72%, rgba(5, 8, 12, 0));\n  backdrop-filter: blur(8px);\n}\n''',
    '''  width: min(300px, calc(100% - 206px));\n  padding: 0;\n  translate: 0 -50%;\n  border: 0;\n  border-radius: 0;\n  background: transparent;\n}\n\n.layer-card-copy {\n  padding: 13px 16px 13px 0;\n  background: linear-gradient(90deg, rgba(5, 8, 12, 0.82), rgba(5, 8, 12, 0.46) 72%, rgba(5, 8, 12, 0));\n  backdrop-filter: blur(8px);\n}\n''',
)

replace_once(
    'src/styles.css',
    '''  .scale-active-marker {\n    top: auto;\n    bottom: -2px;\n    left: 50%;\n    width: 28px;\n    height: 3px;\n    transform: translateX(-50%);\n  }''',
    '''  .scale-active-marker {\n    top: auto;\n    bottom: -2px;\n    left: 50%;\n    width: 28px;\n    height: 3px;\n    margin-top: 0;\n    margin-left: -14px;\n  }''',
)

replace_once(
    'scripts/ui-stability-contract-check.mjs',
    '''assert.ok(\n  app.includes('const activeLayerTop = 24.5 +') && app.includes('animate={{ top: activeLayerTop }}') && app.includes('className="layer-card-copy"'),\n  'scale explanation and connector must physically travel between rows while their contents resolve independently',\n);\n''',
    '''assert.ok(\n  app.includes('const activeLayerTop = 24.5 +') && app.includes('animate={{ top: activeLayerTop }}') && app.includes('className="layer-card-copy"'),\n  'scale explanation and connector must physically travel between rows while their contents resolve independently',\n);\nassert.ok(\n  styles.includes('margin-top: -14.5px;') && !styles.includes('transform: translateY(-50%);\\n  pointer-events: none;'),\n  'shared-layout scale marker must not let CSS transforms fight Motion layout transforms',\n);\nassert.ok(\n  styles.includes('.layer-card-copy {') && styles.includes('background: transparent;'),\n  'travelling scale instrument must not leave an opaque empty flyout while copy crossfades',\n);\nassert.ok(\n  styles.includes('@keyframes scale-depth-wave-in') && styles.includes('@keyframes scale-depth-wave-out'),\n  'scale direction must emit a deterministic keyed scan wave in both abstraction directions',\n);\n''',
)
