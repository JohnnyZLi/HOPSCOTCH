from pathlib import Path

p=Path('src/builder/stp.ts')
text=p.read_text()
def rep(old,new):
    global text
    if old not in text: raise SystemExit(f'missing STP pattern {old[:100]!r}')
    text=text.replace(old,new,1)
rep("function carriesVlan(link: BuilderEthernetLink, vlanId: number): boolean {\n  if (link.failed) return false;\n  return link.mode === 'access' ? link.accessVlan === vlanId : Boolean(link.allowedVlans?.includes(vlanId));\n}",
"function carriesVlan(link: BuilderEthernetLink, vlanId: number): boolean {\n  if (link.failed || link.mode === 'routed') return false;\n  if (link.mode === 'access') return link.accessVlan === vlanId;\n  if (!link.allowedVlans?.includes(vlanId)) return false;\n  return (link.nativeVlanA === vlanId) === (link.nativeVlanB === vlanId);\n}")
rep("function switchIds(config: BuilderEthernetConfig): string[] { return config.devices.filter((device)=>device.kind==='switch').map((device)=>device.id).sort(); }",
"function switchIds(config: BuilderEthernetConfig): string[] { return config.devices.filter((device)=>device.kind==='switch'||device.kind==='l3-switch').map((device)=>device.id).sort(); }")
text=text.replace("const aSwitch=deviceById(config,link.a)?.kind==='switch',bSwitch=deviceById(config,link.b)?.kind==='switch';", "const aSwitch=['switch','l3-switch'].includes(deviceById(config,link.a)?.kind??''),bSwitch=['switch','l3-switch'].includes(deviceById(config,link.b)?.kind??'');")
if text.count("const aSwitch=['switch','l3-switch']") < 2: raise SystemExit('expected both STP port-state switch checks to be widened')
p.write_text(text)
