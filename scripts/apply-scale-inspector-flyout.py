from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file_path = Path(path)
    text = file_path.read_text()
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected one anchor, found {count}: {old!r}")
    file_path.write_text(text.replace(old, new, 1))


replace_once(
    'src/App.tsx',
    '''              <nav className="scale-rail" aria-label="Network scale">\n                {layers.map((item) => <motion.button key={item.id} type="button" className={layer === item.id ? 'active' : ''} onClick={() => setLayer(item.id)} whileHover={reduceMotion ? undefined : { x: 5 }} transition={{ type: 'spring', stiffness: 420, damping: 32 }}><span>{item.kicker}</span><strong>{item.label}</strong></motion.button>)}\n              </nav>\n\n              <motion.aside key={active.id} className="layer-card" initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 16, filter: 'blur(8px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ duration: 0.34 }}>\n                <span>{active.kicker}</span><h2>{active.label}</h2><p>{active.description}</p><div className="card-rule" />\n                <small>{layer === 'packet' ? 'PACKET MICROSCOPE READY' : layer === 'transport' ? 'TCP PROTOCOL THEATER READY' : layer === 'application' ? 'HTTP + TLS + DNS THEATER READY' : layer === 'routing' ? 'DYNAMIC NETWORK BUILDER READY' : 'PHYSICAL + SIMULATED + OBSERVED INTERNET MODES READY'}</small>\n              </motion.aside>''',
    '''              <div className="scale-inspector" data-active-scale={layer}>\n                <motion.aside key={active.id} className="layer-card" aria-label={`${active.label} scale details`} initial={reduceMotion ? { opacity: 1 } : { opacity: 0, x: -10, filter: 'blur(6px)' }} animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }} transition={{ duration: 0.28 }}>\n                  <p>{active.description}</p><div className="card-rule" />\n                  <small>{layer === 'packet' ? 'PACKET MICROSCOPE READY' : layer === 'transport' ? 'TCP PROTOCOL THEATER READY' : layer === 'application' ? 'HTTP + TLS + DNS THEATER READY' : layer === 'routing' ? 'DYNAMIC NETWORK BUILDER READY' : 'PHYSICAL + SIMULATED + OBSERVED INTERNET MODES READY'}</small>\n                </motion.aside>\n                <nav className="scale-rail" aria-label="Network scale">\n                  {layers.map((item) => <motion.button key={item.id} type="button" className={layer === item.id ? 'active' : ''} onClick={() => setLayer(item.id)} whileHover={reduceMotion ? undefined : { x: 5 }} transition={{ type: 'spring', stiffness: 420, damping: 32 }}><span>{item.kicker}</span><strong>{item.label}</strong></motion.button>)}\n                </nav>\n              </div>''',
)

styles = Path('src/styles.css').read_text()
start = styles.index('.scale-rail {')
end = styles.index('.timeline-preview {')
replacement = '''.scale-inspector {\n  --scale-detail-y: 24.5px;\n  position: absolute;\n  z-index: 4;\n  top: clamp(240px, 31vh, 320px);\n  right: max(32px, calc((100vw - min(1500px, calc(100vw - 64px))) / 2));\n  width: min(500px, calc(100vw - 64px));\n}\n\n.scale-inspector[data-active-scale="routing"] { --scale-detail-y: 76.5px; }\n.scale-inspector[data-active-scale="transport"] { --scale-detail-y: 128.5px; }\n.scale-inspector[data-active-scale="application"] { --scale-detail-y: 180.5px; }\n.scale-inspector[data-active-scale="packet"] { --scale-detail-y: 232.5px; }\n\n.scale-rail {\n  position: relative;\n  z-index: 2;\n  display: grid;\n  width: 142px;\n  margin-left: auto;\n  gap: 3px;\n}\n\n.scale-rail button {\n  position: relative;\n  display: grid;\n  min-width: 142px;\n  min-height: 49px;\n  padding: 10px 0 10px 18px;\n  border: 0;\n  border-left: 1px solid rgba(255, 255, 255, 0.13);\n  text-align: left;\n  background: transparent;\n  cursor: pointer;\n}\n\n.scale-rail button::before {\n  content: "";\n  position: absolute;\n  top: 50%;\n  left: -2px;\n  width: 3px;\n  height: 0;\n  background: var(--cyan);\n  transform: translateY(-50%);\n  transition: height 240ms ease;\n}\n\n.scale-rail button::after {\n  content: "";\n  position: absolute;\n  top: 50%;\n  left: -33px;\n  width: 32px;\n  height: 1px;\n  opacity: 0;\n  background: linear-gradient(90deg, rgba(121, 242, 218, 0.22), rgba(121, 242, 218, 0.82));\n  transform: translateY(-50%) scaleX(0.25);\n  transform-origin: right center;\n  transition: opacity 180ms ease, transform 220ms ease;\n}\n\n.scale-rail button.active::before {\n  height: 28px;\n}\n\n.scale-rail button.active::after {\n  opacity: 1;\n  transform: translateY(-50%) scaleX(1);\n}\n\n.scale-rail strong {\n  color: #8d98a1;\n  font-size: 0.86rem;\n  letter-spacing: 0.04em;\n}\n\n.scale-rail button.active strong {\n  color: var(--ink);\n}\n\n.scale-rail span {\n  margin-bottom: 3px;\n  font-size: 0.56rem;\n}\n\n.layer-card {\n  position: absolute;\n  z-index: 1;\n  top: var(--scale-detail-y);\n  right: 174px;\n  width: min(300px, calc(100% - 206px));\n  padding: 13px 16px 13px 0;\n  translate: 0 -50%;\n  border: 0;\n  border-radius: 0;\n  background: linear-gradient(90deg, rgba(5, 8, 12, 0.82), rgba(5, 8, 12, 0.46) 72%, rgba(5, 8, 12, 0));\n  backdrop-filter: blur(8px);\n}\n\n.layer-card::after {\n  content: "";\n  position: absolute;\n  top: 50%;\n  right: -2px;\n  width: 4px;\n  height: 4px;\n  border-radius: 50%;\n  background: rgba(121, 242, 218, 0.86);\n  box-shadow: 0 0 10px rgba(121, 242, 218, 0.28);\n  transform: translate(50%, -50%);\n}\n\n.layer-card p {\n  max-width: 280px;\n  margin: 0;\n  color: #9aa4ac;\n  font-size: 0.78rem;\n  line-height: 1.5;\n}\n\n.card-rule {\n  width: min(220px, 86%);\n  height: 1px;\n  margin: 12px 0 9px;\n  background: linear-gradient(90deg, rgba(121, 242, 218, 0.46), transparent);\n}\n\n.layer-card small {\n  color: var(--cyan);\n  font-size: 0.54rem;\n  font-weight: 800;\n  letter-spacing: 0.13em;\n}\n\n'''
Path('src/styles.css').write_text(styles[:start] + replacement + styles[end:])

replace_once(
    'src/styles.css',
    '''@media (max-width: 1180px) {\n  .scale-rail {\n    top: 104px;\n    right: 32px;\n    bottom: auto;\n    grid-template-columns: repeat(5, auto);\n    transform: none;\n  }''',
    '''@media (max-width: 1380px) and (min-width: 1181px) {\n  .layer-card {\n    display: none;\n  }\n}\n\n@media (max-width: 1180px) {\n  .scale-inspector {\n    top: 104px;\n    right: 32px;\n    width: auto;\n  }\n\n  .scale-rail {\n    grid-template-columns: repeat(5, auto);\n  }''',
)

replace_once(
    'src/styles.css',
    '''  .scale-rail button::before {\n    top: auto;\n    bottom: -2px;\n    left: 50%;\n    width: 0;\n    height: 3px;\n    transform: translateX(-50%);\n    transition: width 240ms ease;\n  }''',
    '''  .scale-rail button::before {\n    top: auto;\n    bottom: -2px;\n    left: 50%;\n    width: 0;\n    height: 3px;\n    transform: translateX(-50%);\n    transition: width 240ms ease;\n  }\n\n  .scale-rail button::after {\n    display: none;\n  }''',
)

replace_once(
    'src/styles.css',
    '''  .scale-rail {\n    top: 110px;\n    transform: none;\n  }\n\n  .layer-card {\n    top: 122px;\n    bottom: auto;\n    translate: 0;\n  }''',
    '''  .scale-inspector {\n    top: 110px;\n  }''',
)

replace_once(
    'src/styles.css',
    '''@media (max-width: 760px) {\n  .scale-rail {\n    top: 94px;\n    bottom: auto;\n  }\n}''',
    '''@media (max-width: 760px) {\n  .scale-inspector {\n    top: 94px;\n  }\n}''',
)

contract = Path('scripts/ui-stability-contract-check.mjs').read_text()
old_start = contract.index("assert.ok(\n  styles.includes('right: max(206px")
old_end = contract.index("\nassert.ok(\n  journey.includes", old_start)
new_contract = '''assert.ok(\n  styles.includes('.scale-inspector {'),\n  'overview scale selector and explanation must share one scale-inspector positioning context',\n);\nassert.ok(\n  styles.includes('top: clamp(240px, 31vh, 320px);'),\n  'desktop scale inspector must occupy the open scene band rather than the launch-card row',\n);\nassert.ok(\n  styles.includes('right: max(32px, calc((100vw - min(1500px, calc(100vw - 64px))) / 2));'),\n  'scale inspector must retain the canonical viewport/content gutter anchor',\n);\nassert.ok(\n  styles.includes('.scale-inspector[data-active-scale="packet"] { --scale-detail-y: 232.5px; }'),\n  'scale explanation must track the selected rail row instead of floating at one fixed vertical position',\n);\nassert.ok(\n  styles.includes('right: 174px;') && styles.includes('width: 32px;'),\n  'scale explanation and active rail row must preserve the dedicated connector lane',\n);\nassert.ok(\n  styles.includes('background: linear-gradient(90deg, rgba(5, 8, 12, 0.82), rgba(5, 8, 12, 0.46) 72%, rgba(5, 8, 12, 0));'),\n  'scale explanation must use a lightweight scene flyout rather than a bordered dashboard card',\n);\nassert.ok(\n  styles.includes('@media (max-width: 1380px) and (min-width: 1181px)') && styles.includes('display: none;'),\n  'scale explanation must disappear before it can collide horizontally with the hero/action deck',\n);\n'''
contract = contract[:old_start] + new_contract + contract[old_end:]
contract = contract.replace(
    "UI stability contract passed: overview scale/card lanes are separated vertically and horizontally, and Journey timer metadata cannot reflow adjacent cells.",
    "UI stability contract passed: the attached scale inspector stays out of primary action space, and Journey timer metadata cannot reflow adjacent cells.",
)
Path('scripts/ui-stability-contract-check.mjs').write_text(contract)
