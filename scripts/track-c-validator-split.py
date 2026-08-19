from pathlib import Path

p=Path('src/builder/ethernet.ts'); text=p.read_text()
old="      if (!vlanIds.has(iface.vlanId) || localVlans.has(iface.vlanId) || !validIpv4(iface.address) || (iface.gateway != null && !validIpv4(iface.gateway)) || (iface.vrfId != null && !/^[a-zA-Z0-9_-]{1,48}$/.test(iface.vrfId)) || (iface.name != null && (iface.name.length < 1 || iface.name.length > 32))) throw new Error(`Ethernet interface on ${device.id} is invalid.`);"
new="      if (!vlanIds.has(iface.vlanId) || localVlans.has(iface.vlanId) || !validIpv4(iface.address) || (iface.gateway != null && !validIpv4(iface.gateway))) throw new Error(`Ethernet interface on ${device.id} is invalid.`);"
if old not in text: raise SystemExit('interface validator anchor missing')
text=text.replace(old,new,1)
old="      for (const native of [link.nativeVlanA, link.nativeVlanB]) if (native != null && !allowed.includes(native)) throw new Error(`Trunk ${link.id} native VLAN must also be allowed.`);\n    } else if (link.mode === 'routed') {\n      if (!['router','l3-switch'].includes(a.kind) || !['router','l3-switch'].includes(b.kind) || !link.routed || !validCidr(link.routed.cidr) || !validIpv4(link.routed.aAddress) || !validIpv4(link.routed.bAddress) || (link.routed.vrfId != null && !/^[a-zA-Z0-9_-]{1,48}$/.test(link.routed.vrfId))) throw new Error(`Routed link ${link.id} needs two routed devices, a valid subnet, and endpoint addresses.`);\n    } else throw new Error(`Ethernet link ${link.id} mode must be access, trunk, or routed.`);"
new="    } else if (link.mode === 'routed') {\n      if (!link.routed) throw new Error(`Routed link ${link.id} is incomplete.`);\n    } else throw new Error(`Ethernet link ${link.id} mode is invalid.`);"
if old not in text: raise SystemExit('link validator anchor missing')
text=text.replace(old,new,1)
start=text.index("  if (input.enterprise != null) {")
end=text.index("\n\n  for (const device of input.devices)",start)
text=text[:start]+text[end:]
p.write_text(text)

p=Path('src/builder/enterprise.ts'); text=p.read_text()
anchor="export function validateBuilderEthernetEnterpriseConfig(config: BuilderEthernetConfig, input: BuilderEthernetEnterpriseConfig | undefined): BuilderEthernetEnterpriseConfig {\n  const next = cloneBuilderEthernetEnterpriseConfig(input);"
insert="""export function validateBuilderEthernetEnterpriseConfig(config: BuilderEthernetConfig, input: BuilderEthernetEnterpriseConfig | undefined): BuilderEthernetEnterpriseConfig {
  const next = cloneBuilderEthernetEnterpriseConfig(input);
  const ipv4=(value:string)=>/^(?:\\d{1,3}\\.){3}\\d{1,3}$/.test(value)&&value.split('.').every((part)=>Number(part)>=0&&Number(part)<=255);
  const cidr=(value:string)=>{const [address,prefix]=value.split('/');return Boolean(address&&ipv4(address)&&/^\\d{1,2}$/.test(prefix??'')&&Number(prefix)>=8&&Number(prefix)<=30);};
  for(const device of config.devices)for(const iface of device.interfaces){if(iface.vrfId!=null&&!/^[a-zA-Z0-9_-]{1,48}$/.test(iface.vrfId))throw new Error(`${device.id} has an invalid VRF id.`);if(iface.name!=null&&(iface.name.length<1||iface.name.length>32))throw new Error(`${device.id} has an invalid interface name.`);}
  for(const link of config.links){if(link.mode==='trunk'){const allowed=link.allowedVlans??[];for(const native of [link.nativeVlanA,link.nativeVlanB])if(native!=null&&!allowed.includes(native))throw new Error(`Trunk ${link.id} native VLAN must also be allowed.`);}if(link.mode==='routed'){const a=deviceById(config,link.a),b=deviceById(config,link.b),r=link.routed;if(!a||!b||!['router','l3-switch'].includes(a.kind)||!['router','l3-switch'].includes(b.kind)||!r||!cidr(r.cidr)||!ipv4(r.aAddress)||!ipv4(r.bAddress)||(r.vrfId!=null&&!/^[a-zA-Z0-9_-]{1,48}$/.test(r.vrfId)))throw new Error(`Routed link ${link.id} is invalid.`);}}
"""
if anchor not in text: raise SystemExit('enterprise validator anchor missing')
text=text.replace(anchor,insert,1)
p.write_text(text)
