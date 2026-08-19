from pathlib import Path

p=Path('src/builder/ethernet.ts'); text=p.read_text()
text=text.replace("function cloneInterface(entry: BuilderEthernetInterface): BuilderEthernetInterface {\n  return { ...entry };\n}\n\n", "")
old="""export function cloneBuilderEthernetConfig(config: BuilderEthernetConfig): BuilderEthernetConfig {
  return {
    vlans: config.vlans.map((vlan) => ({ ...vlan })),
    devices: config.devices.map((device) => ({ ...device, interfaces: device.interfaces.map(cloneInterface) })),
    links: config.links.map((link) => ({ ...link, allowedVlans: link.allowedVlans ? [...link.allowedVlans] : undefined })),
    layout: Object.fromEntries(Object.entries(config.layout).map(([id, point]) => [id, { ...point }])),
    stp: cloneBuilderStpConfig(config.stp),
    ...(config.vrfStaticRoutes ? { vrfStaticRoutes: config.vrfStaticRoutes.map((route) => ({ ...route })) } : {}),
  };
}"""
new="""export function cloneBuilderEthernetConfig(config: BuilderEthernetConfig): BuilderEthernetConfig {
  const next=structuredClone(config); next.stp=cloneBuilderStpConfig(config.stp); return next;
}"""
if old not in text: raise SystemExit('manual Ethernet clone block missing')
text=text.replace(old,new,1)
p.write_text(text)

p=Path('scripts/builder-enterprise-contract-check.mjs'); text=p.read_text()
needle="""const demo = createBuilderEnterpriseDemo();
assert.equal(demo.devices.filter((device) => device.kind === 'l3-switch').length, 3);"""
replacement="""const demo = createBuilderEnterpriseDemo();
const clonedDemo=cloneBuilderEthernetConfig(demo); clonedDemo.links[0].failed=true; clonedDemo.vrfStaticRoutes[0].prefix='192.0.2.0/24';
assert.equal(demo.links[0].failed,false); assert.equal(demo.vrfStaticRoutes[0].prefix,'10.60.0.0/24');
assert.equal(demo.devices.filter((device) => device.kind === 'l3-switch').length, 3);"""
if needle not in text: raise SystemExit('enterprise clone contract marker missing')
text=text.replace(needle,replacement,1)
p.write_text(text)
