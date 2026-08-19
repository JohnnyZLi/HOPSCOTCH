from pathlib import Path

# Keep only semantics required for ordinary Ethernet forwarding in the startup graph.
p=Path('src/builder/ethernet.ts'); text=p.read_text()
text=text.replace("function validRouteCidr(value: string): boolean {\n  const [address, prefix, ...extra] = value.split('/');\n  return extra.length === 0 && Boolean(address && validIpv4(address) && /^\\d{1,2}$/.test(prefix ?? '') && Number(prefix) >= 0 && Number(prefix) <= 32);\n}\n","")
text=text.replace("function ifaceVrf(iface: BuilderEthernetInterface): string { return iface.vrfId?.trim().toUpperCase() || 'DEFAULT'; }\n","")
start=text.index("  const bundles = new Map<string, BuilderEthernetLink[]>();")
end=text.index("\n\n  for (const device of input.devices) {",start)
text=text[:start]+"  const vrfStaticRoutes = (input.vrfStaticRoutes ?? []).map((route) => ({ ...route, vrfId: String(route.vrfId ?? '').trim().toUpperCase() }));"+text[end:]
old="""  const routerCandidates = config.devices.filter((device) => layer3Kind(device.kind) && interfaceFor(device,sourceVlan) && interfaceFor(device,destinationVlan)).flatMap((device) => { const sourceRouterIf=interfaceFor(device,sourceVlan)!; const destinationRouterIf=interfaceFor(device,destinationVlan)!; if(ifaceVrf(sourceRouterIf)!==ifaceVrf(destinationRouterIf))return []; if(sourceIf.gateway!==sourceRouterIf.address&&sourceIf.gateway!==sourceRouterIf.virtualGateway)return []; if(destinationIf.gateway!==destinationRouterIf.address&&destinationIf.gateway!==destinationRouterIf.virtualGateway)return []; return [{device,sourceRouterIf,destinationRouterIf}]; }).sort((a,b)=>(b.sourceRouterIf.gatewayPriority??100)-(a.sourceRouterIf.gatewayPriority??100)||a.device.id.localeCompare(b.device.id));\n  const candidate = routerCandidates.find(({device})=>builderEthernetPathForVlan(config,sourceId,device.id,sourceVlan)!==null);\n  if (!candidate) return fail(sourceId,destinationId,sourceVlan,destinationVlan,`VLAN ${sourceVlan} and VLAN ${destinationVlan} are isolated in the current VRF/gateway state: no reachable Layer-3 device owns both broadcast domains.`);\n  const router=candidate.device; const sourceRouterIf=candidate.sourceRouterIf; const destinationRouterIf=candidate.destinationRouterIf;\n"""
new="""  const router = config.devices.filter((device) => device.kind==='router' && interfaceFor(device,sourceVlan) && interfaceFor(device,destinationVlan)).sort((a,b)=>a.id.localeCompare(b.id))[0];\n  if (!router) return fail(sourceId,destinationId,sourceVlan,destinationVlan,`VLAN ${sourceVlan} and VLAN ${destinationVlan} are isolated: no router has interfaces in both broadcast domains.`);\n  const sourceRouterIf = interfaceFor(router,sourceVlan)!; const destinationRouterIf = interfaceFor(router,destinationVlan)!;\n  if (sourceIf.gateway !== sourceRouterIf.address) return fail(sourceId,destinationId,sourceVlan,destinationVlan,`${source.label} gateway ${sourceIf.gateway ?? 'NONE'} does not match ${router.label} VLAN ${sourceVlan} interface ${sourceRouterIf.address}.`);\n  if (destinationIf.gateway !== destinationRouterIf.address) return fail(sourceId,destinationId,sourceVlan,destinationVlan,`${destination.label} gateway ${destinationIf.gateway ?? 'NONE'} does not match ${router.label} VLAN ${destinationVlan} interface ${destinationRouterIf.address}.`);\n"""
if old not in text: raise SystemExit('enterprise direct-flow block not found')
text=text.replace(old,new,1)
text=text.replace("summary:`${router.label} routes VLAN ${sourceVlan} → VLAN ${destinationVlan} in VRF ${ifaceVrf(sourceRouterIf)} using connected ${router.kind==='l3-switch'?'SVIs':'router interfaces'}; IP TTL decreases once at the Layer-3 boundary.`", "summary:`${router.label} routes VLAN ${sourceVlan} → VLAN ${destinationVlan} using connected router-on-a-stick subinterfaces; IP TTL decreases once at the router.`")
p.write_text(text)

# Move bundle/static-route cross-object validation into the lazy enterprise module where it is consumed.
p=Path('src/builder/enterprise.ts'); text=p.read_text()
insert="""
function validEnterprisePrefix(value: string): boolean { try { normalizePrefix(value); return true; } catch { return false; } }

export function validateBuilderEnterpriseConfig(configInput: BuilderEthernetConfig): BuilderEthernetConfig {
  const config=validateBuilderEthernetConfig(configInput);
  const bundles=new Map<string,BuilderEthernetLink[]>();
  for(const link of config.links)if(link.bundleId){const members=bundles.get(link.bundleId)??[];members.push(link);bundles.set(link.bundleId,members);}
  for(const [bundleId,members] of bundles){
    const first=members[0]!;const pair=[first.a,first.b].sort().join('|');const vlans=JSON.stringify([...(first.allowedVlans??[])].sort((a,b)=>a-b));
    if(members.length<2||members.some((member)=>[member.a,member.b].sort().join('|')!==pair||member.mode!=='trunk'||member.bundleProtocol!==first.bundleProtocol||JSON.stringify([...(member.allowedVlans??[])].sort((a,b)=>a-b))!==vlans||member.nativeVlanA!==first.nativeVlanA||member.nativeVlanB!==first.nativeVlanB))throw new Error(`EtherChannel ${bundleId} members must be parallel trunk links with identical VLAN/native/protocol configuration.`);
  }
  const routeIds=new Set<string>();
  for(const route of config.vrfStaticRoutes??[]){
    const device=config.devices.find((entry)=>entry.id===route.deviceId),nextHop=config.devices.find((entry)=>entry.id===route.nextHopDeviceId),link=config.links.find((entry)=>entry.id===route.linkId),vrf=vrfId(route.vrfId);
    if(!route.id||routeIds.has(route.id)||!device||!nextHop||!layer3Device(device)||!layer3Device(nextHop)||!validEnterprisePrefix(route.prefix)||!link||link.mode!=='routed'||!((link.a===route.deviceId&&link.b===route.nextHopDeviceId)||(link.b===route.deviceId&&link.a===route.nextHopDeviceId))||linkVrf(link)!==vrf)throw new Error(`Enterprise VRF static route ${route.id||'UNKNOWN'} must use a unique id, valid prefix, and directly connected routed port in the same VRF.`);
    routeIds.add(route.id);
  }
  return config;
}
"""
marker="function activeBundleMember(config: BuilderEthernetConfig, bundleId: string): BuilderEthernetLink | null {"
idx=text.index(marker)
text=text[:idx]+insert+"\n"+text[idx:]
# The validator references normalizePrefix declared later; function declarations are hoisted.
text=text.replace("const config = validateBuilderEthernetConfig(configInput);", "const config = validateBuilderEnterpriseConfig(configInput);")
# First replacement above also changed validateBuilderEnterpriseConfig recursively; repair it.
text=text.replace("export function validateBuilderEnterpriseConfig(configInput: BuilderEthernetConfig): BuilderEthernetConfig {\n  const config = validateBuilderEnterpriseConfig(configInput);", "export function validateBuilderEnterpriseConfig(configInput: BuilderEthernetConfig): BuilderEthernetConfig {\n  const config = validateBuilderEthernetConfig(configInput);")
# createBuilderEnterpriseDemo validates at its return site.
text=text.replace("  return validateBuilderEthernetConfig(config);\n}\n\nexport function builderEnterpriseRole", "  return validateBuilderEnterpriseConfig(config);\n}\n\nexport function builderEnterpriseRole")
p.write_text(text)

# Make the contract assert the lazy validator owns advanced cross-object checks.
p=Path('scripts/builder-enterprise-contract-check.mjs'); text=p.read_text()
text=text.replace("  runBuilderEnterpriseFlow,\n} from '../src/builder/enterprise.ts';", "  runBuilderEnterpriseFlow,\n  validateBuilderEnterpriseConfig,\n} from '../src/builder/enterprise.ts';")
needle="assert.equal(demo.stp.protocol, 'rstp');\n"
extra="""assert.equal(demo.stp.protocol, 'rstp');
const badBundle=cloneBuilderEthernetConfig(demo); badBundle.links.find((link)=>link.id==='access-a-dist-a-2').allowedVlans=[110];
assert.throws(()=>validateBuilderEnterpriseConfig(badBundle),/EtherChannel/);
const badRoute=cloneBuilderEthernetConfig(demo); badRoute.vrfStaticRoutes[0].vrfId='RED';
assert.throws(()=>validateBuilderEnterpriseConfig(badRoute),/VRF static route/);
"""
if needle not in text: raise SystemExit('contract insertion not found')
text=text.replace(needle,extra,1)
p.write_text(text)
