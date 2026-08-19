from pathlib import Path

p=Path('src/builder/stp.ts'); text=p.read_text()
old="export function cloneBuilderStpConfig(config: BuilderStpConfig | undefined): BuilderStpConfig { return { enabled: config?.enabled !== false, bridgePriorities: { ...(config?.bridgePriorities ?? {}) }, protocol: config?.protocol === 'rstp' ? 'rstp' : 'stp' }; }"
new="export function cloneBuilderStpConfig(config: BuilderStpConfig | undefined): BuilderStpConfig { return { enabled: config?.enabled !== false, bridgePriorities: { ...(config?.bridgePriorities ?? {}) }, protocol: config?.protocol }; }"
if old not in text: raise SystemExit('STP clone anchor missing')
text=text.replace(old,new,1)
old="  return { enabled: next.enabled, bridgePriorities: priorities, protocol: next.protocol === 'rstp' ? 'rstp' : 'stp' };"
new="  return { enabled: next.enabled, bridgePriorities: priorities, protocol: next.protocol };"
if old not in text: raise SystemExit('STP validate anchor missing')
text=text.replace(old,new,1); p.write_text(text)

p=Path('src/builder/ethernet.ts'); text=p.read_text()
text=text.replace("    enterprise: config.enterprise ? structuredClone(config.enterprise) : undefined,", "    enterprise: structuredClone(config.enterprise),",1)
old="    } else if (link.mode === 'routed') {\n      if (!link.routed) throw new Error(`Routed link ${link.id} is incomplete.`);\n    } else throw new Error(`Ethernet link ${link.id} mode is invalid.`);"
new="    } else if (link.mode !== 'routed') throw new Error(`Ethernet link ${link.id} mode is invalid.`);"
if old not in text: raise SystemExit('routed compatibility anchor missing')
text=text.replace(old,new,1); p.write_text(text)
