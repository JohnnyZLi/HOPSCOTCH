from pathlib import Path

p=Path('src/builder/ethernet.ts'); text=p.read_text()
text=text.replace("function layer3Kind(kind: BuilderEthernetDeviceKind): boolean { return kind === 'router' || kind === 'l3-switch'; }\n", "")
old="""    } else if (link.mode === 'routed') {
      if (!layer3Kind(a.kind) || !layer3Kind(b.kind)) throw new Error(`Routed link ${link.id} must connect router or Layer-3-switch devices.`);
    } else throw new Error(`Ethernet link ${link.id} mode must be access, trunk, or routed.`);"""
new="""    } else if (link.mode !== 'routed') throw new Error(`Ethernet link ${link.id} mode must be access, trunk, or routed.`);"""
if old not in text: raise SystemExit('routed core validation block missing')
text=text.replace(old,new,1)
p.write_text(text)

p=Path('src/builder/stp.ts'); text=p.read_text()
text=text.replace("export function cloneBuilderStpConfig(config: BuilderStpConfig | undefined): BuilderStpConfig { return { enabled: config?.enabled !== false, ...(config?.protocol ? { protocol: config.protocol } : {}), bridgePriorities: { ...(config?.bridgePriorities ?? {}) } }; }", "export function cloneBuilderStpConfig(config: BuilderStpConfig | undefined): BuilderStpConfig { return { ...config, enabled: config?.enabled !== false, bridgePriorities: { ...(config?.bridgePriorities ?? {}) } }; }")
old_switches="""function switchIdsForVlan(config: BuilderEthernetConfig, vlanId: number): string[] {
  const ids=new Set<string>();
  for(const link of config.links){
    if(!carriesVlan(config,link,vlanId))continue;
    if(isSwitch(deviceById(config,link.a)))ids.add(link.a);
    if(isSwitch(deviceById(config,link.b)))ids.add(link.b);
  }
  return [...ids].sort();
}"""
new_switches="""function switchIdsForVlan(config: BuilderEthernetConfig, vlanId: number): string[] { return switchIds(config).filter((id)=>config.links.some((link)=>carriesVlan(config,link,vlanId)&&(link.a===id||link.b===id))); }"""
if old_switches not in text: raise SystemExit('per-vlan switch block missing')
text=text.replace(old_switches,new_switches,1)
text=text.replace("  if(next.protocol!=null&&!['stp','rstp'].includes(next.protocol))throw new Error('Spanning-tree protocol must be stp or rstp.');\n  return { enabled: next.enabled, ...(next.protocol ? {protocol:next.protocol}:{}), bridgePriorities: priorities };", "  return { ...next, bridgePriorities: priorities };")
text=text.replace("  const root=[...switches].sort((a,b)=>bridgeKey(config,a).localeCompare(bridgeKey(config,b)))[0];", "  const root=switches.sort((a,b)=>bridgeKey(config,a).localeCompare(bridgeKey(config,b)))[0];")
p.write_text(text)

p=Path('src/builder/enterprise.ts'); text=p.read_text()
needle="""  for(const link of config.links){
    if(link.mode==='trunk'){"""
replacement="""  if(config.stp.protocol&&config.stp.protocol!=='stp'&&config.stp.protocol!=='rstp')throw new Error('Spanning-tree protocol must be stp or rstp.');
  for(const link of config.links){
    if(link.mode==='trunk'){"""
if needle not in text: raise SystemExit('enterprise link validator marker missing')
text=text.replace(needle,replacement,1)
old="""    }else if(link.mode==='routed'){
      if(!ip(link.routedAAddress)||!ip(link.routedBAddress)||!Number.isInteger(link.routedPrefixLength)||link.routedPrefixLength!<8||link.routedPrefixLength!>31||!validVrf(link.vrfId)||link.bundleId||link.accessVlan!=null||link.allowedVlans?.length)throw new Error(`Routed link ${link.id} requires valid addresses, prefix, VRF, and exclusive routed-port semantics.`);"""
new="""    }else if(link.mode==='routed'){
      if(!layer3Device(config.devices.find((device)=>device.id===link.a))||!layer3Device(config.devices.find((device)=>device.id===link.b))||!ip(link.routedAAddress)||!ip(link.routedBAddress)||!Number.isInteger(link.routedPrefixLength)||link.routedPrefixLength!<8||link.routedPrefixLength!>31||!validVrf(link.vrfId)||link.bundleId||link.accessVlan!=null||link.allowedVlans?.length)throw new Error(`Routed link ${link.id} requires Layer-3 endpoints, valid addresses, prefix, VRF, and exclusive routed-port semantics.`);"""
if old not in text: raise SystemExit('enterprise routed validation block missing')
text=text.replace(old,new,1)
p.write_text(text)
