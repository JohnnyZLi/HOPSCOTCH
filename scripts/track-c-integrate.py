from pathlib import Path


def replace_once(path: str, old: str, new: str):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'missing pattern in {path}: {old[:120]!r}')
    p.write_text(text.replace(old, new, 1))

# Ethernet canonical model: additive enterprise fields, L3 switch, routed ports, VRFs, LACP membership and native VLAN expectations.
replace_once('src/builder/ethernet.ts',
"export type BuilderEthernetDeviceKind = 'endpoint' | 'switch' | 'router';\nexport type BuilderEthernetPortMode = 'access' | 'trunk';",
"export type BuilderEthernetDeviceKind = 'endpoint' | 'switch' | 'router' | 'l3-switch';\nexport type BuilderEthernetPortMode = 'access' | 'trunk' | 'routed';")
replace_once('src/builder/ethernet.ts',
"export interface BuilderEthernetInterface {\n  vlanId: number;\n  address: string;\n  gateway?: string | null;\n}",
"export interface BuilderEthernetInterface {\n  vlanId: number;\n  address: string;\n  gateway?: string | null;\n  vrfId?: string;\n  name?: string;\n}\n\nexport interface BuilderVrf { id: string; label: string }\nexport interface BuilderLacpBundle { id: string; memberLinkIds: string[]; modeA: 'active' | 'passive'; modeB: 'active' | 'passive'; minLinks: number }\nexport interface BuilderFhrpMember { deviceId: string; priority: number; preempt: boolean }\nexport interface BuilderFhrpGroup { id: string; vlanId: number; vrfId?: string; virtualIp: string; members: BuilderFhrpMember[] }\nexport interface BuilderEthernetEnterpriseConfig { vrfs: BuilderVrf[]; lacpBundles: BuilderLacpBundle[]; fhrpGroups: BuilderFhrpGroup[] }\nexport interface BuilderRoutedEthernetLink { cidr: string; aAddress: string; bAddress: string; vrfId?: string; aName?: string; bName?: string }")
replace_once('src/builder/ethernet.ts',
"  allowedVlans?: number[];\n  failed: boolean;",
"  allowedVlans?: number[];\n  nativeVlanA?: number;\n  nativeVlanB?: number;\n  routed?: BuilderRoutedEthernetLink;\n  failed: boolean;")
replace_once('src/builder/ethernet.ts',
"  stp: BuilderStpConfig;\n}",
"  stp: BuilderStpConfig;\n  enterprise?: BuilderEthernetEnterpriseConfig;\n}")
replace_once('src/builder/ethernet.ts',
"    stp: cloneBuilderStpConfig(config.stp),\n  };",
"    stp: cloneBuilderStpConfig(config.stp),\n    enterprise: config.enterprise ? structuredClone(config.enterprise) : undefined,\n  };")
replace_once('src/builder/ethernet.ts',
"    if (!device.label || device.label.length > 32 || !['endpoint','switch','router'].includes(device.kind) || !MAC_RE.test(device.mac)) throw new Error(`Ethernet device ${device.id} metadata is invalid.`);",
"    if (!device.label || device.label.length > 32 || !['endpoint','switch','router','l3-switch'].includes(device.kind) || !MAC_RE.test(device.mac)) throw new Error(`Ethernet device ${device.id} metadata is invalid.`);")
replace_once('src/builder/ethernet.ts',
"      if (!vlanIds.has(iface.vlanId) || localVlans.has(iface.vlanId) || !validIpv4(iface.address) || (iface.gateway != null && !validIpv4(iface.gateway))) throw new Error(`Ethernet interface on ${device.id} is invalid.`);\n      localVlans.add(iface.vlanId);",
"      if (!vlanIds.has(iface.vlanId) || localVlans.has(iface.vlanId) || !validIpv4(iface.address) || (iface.gateway != null && !validIpv4(iface.gateway)) || (iface.vrfId != null && !/^[a-zA-Z0-9_-]{1,48}$/.test(iface.vrfId)) || (iface.name != null && (iface.name.length < 1 || iface.name.length > 32))) throw new Error(`Ethernet interface on ${device.id} is invalid.`);\n      localVlans.add(iface.vlanId);")
replace_once('src/builder/ethernet.ts', "  const pairs = new Set<string>();\n", "")
replace_once('src/builder/ethernet.ts',
"    const pair = [link.a, link.b].sort().join('|');\n    if (pairs.has(pair)) throw new Error(`Duplicate Ethernet link ${pair}.`);\n    pairs.add(pair); linkIds.add(link.id);",
"    linkIds.add(link.id);")
replace_once('src/builder/ethernet.ts',
"    if (link.mode === 'access') {\n      if (!Number.isInteger(link.accessVlan) || !vlanIds.has(link.accessVlan!)) throw new Error(`Access link ${link.id} needs an existing VLAN.`);\n    } else if (link.mode === 'trunk') {\n      if (a.kind === 'endpoint' || b.kind === 'endpoint') throw new Error(`Endpoint links cannot be trunks (${link.id}).`);\n      const allowed = [...new Set(link.allowedVlans ?? [])].sort((x,y)=>x-y);\n      if (allowed.length === 0 || allowed.some((id) => !vlanIds.has(id))) throw new Error(`Trunk ${link.id} must allow at least one existing VLAN.`);\n    } else throw new Error(`Ethernet link ${link.id} mode must be access or trunk.`);",
"    if (link.mode === 'access') {\n      if (!Number.isInteger(link.accessVlan) || !vlanIds.has(link.accessVlan!)) throw new Error(`Access link ${link.id} needs an existing VLAN.`);\n    } else if (link.mode === 'trunk') {\n      if (a.kind === 'endpoint' || b.kind === 'endpoint') throw new Error(`Endpoint links cannot be trunks (${link.id}).`);\n      const allowed = [...new Set(link.allowedVlans ?? [])].sort((x,y)=>x-y);\n      if (allowed.length === 0 || allowed.some((id) => !vlanIds.has(id))) throw new Error(`Trunk ${link.id} must allow at least one existing VLAN.`);\n      for (const native of [link.nativeVlanA, link.nativeVlanB]) if (native != null && !allowed.includes(native)) throw new Error(`Trunk ${link.id} native VLAN must also be allowed.`);\n    } else if (link.mode === 'routed') {\n      if (!['router','l3-switch'].includes(a.kind) || !['router','l3-switch'].includes(b.kind) || !link.routed || !validCidr(link.routed.cidr) || !validIpv4(link.routed.aAddress) || !validIpv4(link.routed.bAddress) || (link.routed.vrfId != null && !/^[a-zA-Z0-9_-]{1,48}$/.test(link.routed.vrfId))) throw new Error(`Routed link ${link.id} needs two routed devices, a valid subnet, and endpoint addresses.`);\n    } else throw new Error(`Ethernet link ${link.id} mode must be access, trunk, or routed.`);")
replace_once('src/builder/ethernet.ts',
"  for (const device of input.devices) {\n    const point = input.layout[device.id];",
"  if (input.enterprise != null) {\n    if (!Array.isArray(input.enterprise.vrfs) || !Array.isArray(input.enterprise.lacpBundles) || !Array.isArray(input.enterprise.fhrpGroups)) throw new Error('Enterprise Ethernet config must contain VRF, LACP, and FHRP collections.');\n    if (input.enterprise.vrfs.length > 16 || input.enterprise.lacpBundles.length > 16 || input.enterprise.fhrpGroups.length > 16) throw new Error('Enterprise Ethernet config exceeds its 16-object-per-family ceiling.');\n  }\n\n  for (const device of input.devices) {\n    const point = input.layout[device.id];")
replace_once('src/builder/ethernet.ts',
"function linkCarriesVlanRaw(link: BuilderEthernetLink, vlanId: number): boolean {\n  if (link.failed) return false;\n  return link.mode === 'access' ? link.accessVlan === vlanId : Boolean(link.allowedVlans?.includes(vlanId));\n}",
"function linkCarriesVlanRaw(link: BuilderEthernetLink, vlanId: number): boolean {\n  if (link.failed || link.mode === 'routed') return false;\n  if (link.mode === 'access') return link.accessVlan === vlanId;\n  if (!link.allowedVlans?.includes(vlanId)) return false;\n  return (link.nativeVlanA === vlanId) === (link.nativeVlanB === vlanId);\n}")
# Add lightweight gateway/FHRP resolver immediately before runBuilderEthernetFlow.
replace_once('src/builder/ethernet.ts',
"export function runBuilderEthernetFlow(configInput: BuilderEthernetConfig, sourceId: string, destinationId: string): BuilderEthernetFlowResult {",
"function routedGatewayFor(config: BuilderEthernetConfig, vlanId: number, vrfId: string, gatewayIp: string | null | undefined): BuilderEthernetDevice | undefined {\n  if (!gatewayIp) return undefined;\n  const group = config.enterprise?.fhrpGroups.find((entry) => entry.vlanId === vlanId && (entry.vrfId ?? 'default') === vrfId && entry.virtualIp === gatewayIp);\n  if (group) {\n    const members = group.members.filter((member) => config.links.some((link) => !link.failed && (link.a === member.deviceId || link.b === member.deviceId) && linkCarriesVlanRaw(link, vlanId))).sort((a,b)=>b.priority-a.priority||a.deviceId.localeCompare(b.deviceId));\n    const masterId = members[0]?.deviceId;\n    return masterId ? deviceById(config, masterId) : undefined;\n  }\n  return config.devices.filter((device) => ['router','l3-switch'].includes(device.kind) && device.interfaces.some((entry) => entry.vlanId === vlanId && (entry.vrfId ?? 'default') === vrfId && entry.address === gatewayIp)).sort((a,b)=>a.id.localeCompare(b.id))[0];\n}\n\nexport function runBuilderEthernetFlow(configInput: BuilderEthernetConfig, sourceId: string, destinationId: string): BuilderEthernetFlowResult {")
replace_once('src/builder/ethernet.ts',
"  const router = config.devices.filter((device) => device.kind==='router' && interfaceFor(device,sourceVlan) && interfaceFor(device,destinationVlan)).sort((a,b)=>a.id.localeCompare(b.id))[0];\n  if (!router) return fail(sourceId,destinationId,sourceVlan,destinationVlan,`VLAN ${sourceVlan} and VLAN ${destinationVlan} are isolated: no router has interfaces in both broadcast domains.`);\n  const sourceRouterIf = interfaceFor(router,sourceVlan)!; const destinationRouterIf = interfaceFor(router,destinationVlan)!;\n  if (sourceIf.gateway !== sourceRouterIf.address) return fail(sourceId,destinationId,sourceVlan,destinationVlan,`${source.label} gateway ${sourceIf.gateway ?? 'NONE'} does not match ${router.label} VLAN ${sourceVlan} interface ${sourceRouterIf.address}.`);\n  if (destinationIf.gateway !== destinationRouterIf.address) return fail(sourceId,destinationId,sourceVlan,destinationVlan,`${destination.label} gateway ${destinationIf.gateway ?? 'NONE'} does not match ${router.label} VLAN ${destinationVlan} interface ${destinationRouterIf.address}.`);",
"  const sourceVrf = sourceIf.vrfId ?? 'default'; const destinationVrf = destinationIf.vrfId ?? 'default';\n  if (sourceVrf !== destinationVrf) return fail(sourceId,destinationId,sourceVlan,destinationVlan,`VRF isolation: ${source.label} is in ${sourceVrf} while ${destination.label} is in ${destinationVrf}. Overlapping addresses do not merge routing tables.`);\n  const router = routedGatewayFor(config, sourceVlan, sourceVrf, sourceIf.gateway);\n  if (!router || !['router','l3-switch'].includes(router.kind) || !interfaceFor(router,destinationVlan) || (interfaceFor(router,destinationVlan)?.vrfId ?? 'default') !== sourceVrf) return fail(sourceId,destinationId,sourceVlan,destinationVlan,`VLAN ${sourceVlan} gateway cannot route to VLAN ${destinationVlan} inside VRF ${sourceVrf}.`);\n  const sourceRouterIf = interfaceFor(router,sourceVlan)!; const destinationRouterIf = interfaceFor(router,destinationVlan)!;\n  if ((sourceRouterIf.vrfId ?? 'default') !== sourceVrf) return fail(sourceId,destinationId,sourceVlan,destinationVlan,`${router.label} source SVI/interface belongs to a different VRF.`);\n  if (!routedGatewayFor(config, destinationVlan, destinationVrf, destinationIf.gateway)) return fail(sourceId,destinationId,sourceVlan,destinationVlan,`${destination.label} gateway ${destinationIf.gateway ?? 'NONE'} has no active owner in VRF ${destinationVrf}.`);")
replace_once('src/builder/ethernet.ts',
"    summary:`${router.label} routes VLAN ${sourceVlan} → VLAN ${destinationVlan} using connected router-on-a-stick subinterfaces; IP TTL decreases once at the router.` };
}",
"    summary:`${router.label} routes VLAN ${sourceVlan} → VLAN ${destinationVlan} inside VRF ${sourceIf.vrfId ?? 'default'} using canonical SVI/subinterface truth; IP TTL decreases once at the routed hop.` };\n}\n")

# STP config gains additive protocol selection; LACP parallel members collapse to one logical STP edge.
replace_once('src/builder/stp.ts',
"export interface BuilderStpConfig {\n  enabled: boolean;\n  bridgePriorities: Record<string, number>;\n}",
"export interface BuilderStpConfig {\n  enabled: boolean;\n  bridgePriorities: Record<string, number>;\n  protocol?: 'stp' | 'rstp';\n}")
replace_once('src/builder/stp.ts',
"export function createDefaultBuilderStpConfig(): BuilderStpConfig { return { enabled: true, bridgePriorities: {} }; }\nexport function cloneBuilderStpConfig(config: BuilderStpConfig | undefined): BuilderStpConfig { return { enabled: config?.enabled !== false, bridgePriorities: { ...(config?.bridgePriorities ?? {}) } }; }",
"export function createDefaultBuilderStpConfig(): BuilderStpConfig { return { enabled: true, bridgePriorities: {}, protocol: 'stp' }; }\nexport function cloneBuilderStpConfig(config: BuilderStpConfig | undefined): BuilderStpConfig { return { enabled: config?.enabled !== false, bridgePriorities: { ...(config?.bridgePriorities ?? {}) }, protocol: config?.protocol === 'rstp' ? 'rstp' : 'stp' }; }")
replace_once('src/builder/stp.ts',
"  return { enabled: next.enabled, bridgePriorities: priorities };",
"  return { enabled: next.enabled, bridgePriorities: priorities, protocol: next.protocol === 'rstp' ? 'rstp' : 'stp' };")
replace_once('src/builder/stp.ts',
"function activeSwitchEdges(config: BuilderEthernetConfig, vlanId: number): Array<{linkId:string;a:string;b:string}> {\n  return config.links.filter((link)=>{\n    if(!carriesVlan(link,vlanId))return false;\n    return deviceById(config,link.a)?.kind==='switch'&&deviceById(config,link.b)?.kind==='switch';\n  }).map((link)=>({linkId:link.id,a:link.a,b:link.b})).sort((x,y)=>x.linkId.localeCompare(y.linkId));\n}",
"function activeSwitchEdges(config: BuilderEthernetConfig, vlanId: number): Array<{linkId:string;a:string;b:string}> {\n  const raw=config.links.filter((link)=>carriesVlan(link,vlanId)&&['switch','l3-switch'].includes(deviceById(config,link.a)?.kind??'')&&['switch','l3-switch'].includes(deviceById(config,link.b)?.kind??''));\n  const bundled=new Set((config.enterprise?.lacpBundles??[]).flatMap((bundle)=>bundle.memberLinkIds));\n  const edges=raw.filter((link)=>!bundled.has(link.id)).map((link)=>({linkId:link.id,a:link.a,b:link.b}));\n  for(const bundle of config.enterprise?.lacpBundles??[]){\n    if(bundle.modeA==='passive'&&bundle.modeB==='passive')continue;\n    const members=bundle.memberLinkIds.flatMap((id)=>{const link=raw.find((entry)=>entry.id===id);return link&&!link.failed?[link]:[];}).sort((a,b)=>a.id.localeCompare(b.id));\n    if(members.length<bundle.minLinks)continue; const link=members[0]; if(link)edges.push({linkId:link.id,a:link.a,b:link.b});\n  }\n  return edges.sort((x,y)=>x.linkId.localeCompare(y.linkId));\n}")

# Lazy authoring chunk mounts enterprise controls; NetworkBuilder props already carry canonical Ethernet config + commit callback.
p = Path('src/BuilderAuthoringPanelContent.tsx')
text = p.read_text()
needle = "import './BuilderAuthoringPanel.css';"
if needle not in text: raise SystemExit('authoring import anchor missing')
text = text.replace(needle, needle + "\nimport BuilderEnterprisePanel from './BuilderEnterprisePanel.tsx';", 1)
end = text.rfind('</section>;')
if end < 0: raise SystemExit('authoring return close missing')
text = text[:end] + "\n    <BuilderEnterprisePanel ethernet={snapshot.ethernet} historical={historical} onCommit={onCommitEthernet} onMessage={onMessage}/>\n  " + text[end:]
p.write_text(text)

# Permanent contract wiring.
p = Path('package.json')
text = p.read_text()
text = text.replace('npm run test:builder-ethernet-contract && npm run test:builder-arp-stp-contract', 'npm run test:builder-ethernet-contract && npm run test:builder-enterprise-contract && npm run test:builder-arp-stp-contract', 1)
text = text.replace('    "test:builder-ethernet-contract": "node scripts/builder-ethernet-contract-check.mjs",', '    "test:builder-ethernet-contract": "node scripts/builder-ethernet-contract-check.mjs",\n    "test:builder-enterprise-contract": "node scripts/builder-enterprise-contract-check.mjs",', 1)
p.write_text(text)
