from pathlib import Path

p=Path('src/builder/ethernet.ts'); text=p.read_text()
text=text.replace("    vrfStaticRoutes: config.vrfStaticRoutes?.map((route) => ({ ...route })) ?? [],\n", "    ...(config.vrfStaticRoutes ? { vrfStaticRoutes: config.vrfStaticRoutes.map((route) => ({ ...route })) } : {}),\n")
text=text.replace("  return { vlans: [], devices: [], links: [], layout: {}, stp: createDefaultBuilderStpConfig(), vrfStaticRoutes: [] };", "  return { vlans: [], devices: [], links: [], layout: {}, stp: createDefaultBuilderStpConfig() };")
text=text.replace("function validVrfId(value: string | null | undefined): boolean { return value == null || /^[A-Za-z0-9_.-]{1,24}$/.test(value.trim()); }\n", "")
old_iface="""      if (!vlanIds.has(iface.vlanId) || localVlans.has(iface.vlanId) || !validIpv4(iface.address) || (iface.gateway != null && !validIpv4(iface.gateway)) || (iface.virtualGateway != null && !validIpv4(iface.virtualGateway)) || !validVrfId(iface.vrfId) || (iface.gatewayPriority != null && (!Number.isInteger(iface.gatewayPriority) || iface.gatewayPriority < 1 || iface.gatewayPriority > 255))) throw new Error(`Ethernet interface on ${device.id} is invalid.`);"""
new_iface="""      if (!vlanIds.has(iface.vlanId) || localVlans.has(iface.vlanId) || !validIpv4(iface.address) || (iface.gateway != null && !validIpv4(iface.gateway))) throw new Error(`Ethernet interface on ${device.id} is invalid.`);"""
if old_iface not in text: raise SystemExit('interface validation needle missing')
text=text.replace(old_iface,new_iface,1)
text=text.replace("      if (link.bundleId) throw new Error(`Access link ${link.id} cannot be an EtherChannel member in this bounded enterprise slice.`);\n","")
old_trunk="""      for (const native of [link.nativeVlanA, link.nativeVlanB]) if (native != null && (!Number.isInteger(native) || !allowed.includes(native))) throw new Error(`Trunk ${link.id} native VLAN must be one of its allowed VLANs.`);\n      if (link.bundleId != null && !/^[A-Za-z0-9_.-]{1,32}$/.test(link.bundleId)) throw new Error(`Trunk ${link.id} has an invalid bundle id.`);\n      if (link.bundleProtocol != null && !link.bundleId) throw new Error(`Trunk ${link.id} cannot set a bundle protocol without a bundle id.`);\n      if (link.bundleProtocol != null && !['lacp','static'].includes(link.bundleProtocol)) throw new Error(`Trunk ${link.id} bundle protocol is invalid.`);\n"""
if old_trunk not in text: raise SystemExit('trunk validation needle missing')
text=text.replace(old_trunk,"",1)
old_routed="""      if (!layer3Kind(a.kind) || !layer3Kind(b.kind)) throw new Error(`Routed link ${link.id} must connect router or Layer-3-switch devices.`);\n      if (!validIpv4(link.routedAAddress ?? '') || !validIpv4(link.routedBAddress ?? '') || !Number.isInteger(link.routedPrefixLength) || link.routedPrefixLength! < 8 || link.routedPrefixLength! > 31 || !validVrfId(link.vrfId)) throw new Error(`Routed link ${link.id} requires valid endpoint addresses, /8–/31 prefix length, and VRF id.`);\n      if (link.bundleId || link.accessVlan != null || link.allowedVlans?.length) throw new Error(`Routed link ${link.id} cannot simultaneously carry switched VLAN or bundle semantics.`);\n"""
new_routed="""      if (!layer3Kind(a.kind) || !layer3Kind(b.kind)) throw new Error(`Routed link ${link.id} must connect router or Layer-3-switch devices.`);\n"""
if old_routed not in text: raise SystemExit('routed validation needle missing')
text=text.replace(old_routed,new_routed,1)
text=text.replace("  const vrfStaticRoutes = (input.vrfStaticRoutes ?? []).map((route) => ({ ...route, vrfId: String(route.vrfId ?? '').trim().toUpperCase() }));\n\n","")
text=text.replace("  const normalized = cloneBuilderEthernetConfig({ ...input, stp: cloneBuilderStpConfig(input.stp), vrfStaticRoutes });", "  const normalized = cloneBuilderEthernetConfig({ ...input, stp: cloneBuilderStpConfig(input.stp) });")
p.write_text(text)

p=Path('src/builder/enterprise.ts'); text=p.read_text()
marker="export function validateBuilderEnterpriseConfig(configInput: BuilderEthernetConfig): BuilderEthernetConfig {\n  const config = validateBuilderEthernetConfig(configInput);\n"
extra="""export function validateBuilderEnterpriseConfig(configInput: BuilderEthernetConfig): BuilderEthernetConfig {
  const config = validateBuilderEthernetConfig(configInput);
  const ip=(value:string|null|undefined)=>{if(!value||!/^\\d{1,3}(?:\\.\\d{1,3}){3}$/.test(value))return false;return value.split('.').every((part)=>Number(part)<=255);};
  const validVrf=(value:string|null|undefined)=>value==null||/^[A-Za-z0-9_.-]{1,24}$/.test(value.trim());
  for(const device of config.devices)for(const iface of device.interfaces)if(!validVrf(iface.vrfId)||(iface.virtualGateway!=null&&!ip(iface.virtualGateway))||(iface.gatewayPriority!=null&&(!Number.isInteger(iface.gatewayPriority)||iface.gatewayPriority<1||iface.gatewayPriority>255)))throw new Error(`Enterprise interface on ${device.id} has invalid VRF, virtual gateway, or priority.`);
  for(const link of config.links){
    if(link.mode==='trunk'){
      const allowed=link.allowedVlans??[];for(const native of [link.nativeVlanA,link.nativeVlanB])if(native!=null&&(!Number.isInteger(native)||!allowed.includes(native)))throw new Error(`Trunk ${link.id} native VLAN must be one of its allowed VLANs.`);
      if(link.bundleId!=null&&!/^[A-Za-z0-9_.-]{1,32}$/.test(link.bundleId))throw new Error(`Trunk ${link.id} has an invalid bundle id.`);if(link.bundleProtocol!=null&&(!link.bundleId||!['lacp','static'].includes(link.bundleProtocol)))throw new Error(`Trunk ${link.id} has invalid bundle protocol state.`);
    }else if(link.mode==='routed'){
      if(!ip(link.routedAAddress)||!ip(link.routedBAddress)||!Number.isInteger(link.routedPrefixLength)||link.routedPrefixLength!<8||link.routedPrefixLength!>31||!validVrf(link.vrfId)||link.bundleId||link.accessVlan!=null||link.allowedVlans?.length)throw new Error(`Routed link ${link.id} requires valid addresses, prefix, VRF, and exclusive routed-port semantics.`);
    }else if(link.bundleId)throw new Error(`Access link ${link.id} cannot be an EtherChannel member in this bounded enterprise slice.`);
  }
"""
if marker not in text: raise SystemExit('enterprise validator marker missing')
text=text.replace(marker,extra,1)
p.write_text(text)
