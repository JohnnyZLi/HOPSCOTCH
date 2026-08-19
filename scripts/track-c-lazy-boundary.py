from pathlib import Path


def replace_once(path, old, new):
    p=Path(path); text=p.read_text()
    if old not in text: raise SystemExit(f'missing pattern in {path}: {old[:100]!r}')
    p.write_text(text.replace(old,new,1))

# Base Ethernet stays schema-compatible but does not ship enterprise-only forwarding logic on startup.
p=Path('src/builder/ethernet.ts'); text=p.read_text()
start=text.index('function routedGatewayFor(')
end=text.index('export function runBuilderEthernetFlow', start)
text=text[:start]+text[end:]
old="  const sourceVrf = sourceIf.vrfId ?? 'default'; const destinationVrf = destinationIf.vrfId ?? 'default';\n  if (sourceVrf !== destinationVrf) return fail(sourceId,destinationId,sourceVlan,destinationVlan,`VRF isolation: ${source.label} is in ${sourceVrf} while ${destination.label} is in ${destinationVrf}. Overlapping addresses do not merge routing tables.`);\n  const router = routedGatewayFor(config, sourceVlan, sourceVrf, sourceIf.gateway);\n  if (!router || !['router','l3-switch'].includes(router.kind) || !interfaceFor(router,destinationVlan) || (interfaceFor(router,destinationVlan)?.vrfId ?? 'default') !== sourceVrf) return fail(sourceId,destinationId,sourceVlan,destinationVlan,`VLAN ${sourceVlan} gateway cannot route to VLAN ${destinationVlan} inside VRF ${sourceVrf}.`);\n  const sourceRouterIf = interfaceFor(router,sourceVlan)!; const destinationRouterIf = interfaceFor(router,destinationVlan)!;\n  if ((sourceRouterIf.vrfId ?? 'default') !== sourceVrf) return fail(sourceId,destinationId,sourceVlan,destinationVlan,`${router.label} source SVI/interface belongs to a different VRF.`);\n  if (!routedGatewayFor(config, destinationVlan, destinationVrf, destinationIf.gateway)) return fail(sourceId,destinationId,sourceVlan,destinationVlan,`${destination.label} gateway ${destinationIf.gateway ?? 'NONE'} has no active owner in VRF ${destinationVrf}.`);"
new="  const router = config.devices.filter((device) => device.kind==='router' && interfaceFor(device,sourceVlan) && interfaceFor(device,destinationVlan)).sort((a,b)=>a.id.localeCompare(b.id))[0];\n  if (!router) return fail(sourceId,destinationId,sourceVlan,destinationVlan,`VLAN ${sourceVlan} and VLAN ${destinationVlan} are isolated: no router has interfaces in both broadcast domains.`);\n  const sourceRouterIf = interfaceFor(router,sourceVlan)!; const destinationRouterIf = interfaceFor(router,destinationVlan)!;\n  if (sourceIf.gateway !== sourceRouterIf.address) return fail(sourceId,destinationId,sourceVlan,destinationVlan,`${source.label} gateway ${sourceIf.gateway ?? 'NONE'} does not match ${router.label} VLAN ${sourceVlan} interface ${sourceRouterIf.address}.`);\n  if (destinationIf.gateway !== destinationRouterIf.address) return fail(sourceId,destinationId,sourceVlan,destinationVlan,`${destination.label} gateway ${destinationIf.gateway ?? 'NONE'} does not match ${router.label} VLAN ${destinationVlan} interface ${destinationRouterIf.address}.`);"
if old not in text: raise SystemExit('enterprise forwarding block missing')
text=text.replace(old,new,1)
text=text.replace("    summary:`${router.label} routes VLAN ${sourceVlan} → VLAN ${destinationVlan} inside VRF ${sourceIf.vrfId ?? 'default'} using canonical SVI/subinterface truth; IP TTL decreases once at the routed hop.` };", "    summary:`${router.label} routes VLAN ${sourceVlan} → VLAN ${destinationVlan} using connected router-on-a-stick subinterfaces; IP TTL decreases once at the router.` };",1)
# Deep-clone routed port config while we're here.
text=text.replace("links: config.links.map((link) => ({ ...link, allowedVlans: link.allowedVlans ? [...link.allowedVlans] : undefined })),", "links: config.links.map((link) => ({ ...link, allowedVlans: link.allowedVlans ? [...link.allowedVlans] : undefined, routed: link.routed ? { ...link.routed } : undefined })),",1)
p.write_text(text)

# Restore classic base STP edge semantics; RSTP/LACP adaptation lives in the lazy enterprise module.
p=Path('src/builder/stp.ts'); text=p.read_text()
text=text.replace("function carriesVlan(link: BuilderEthernetLink, vlanId: number): boolean {\n  if (link.failed || link.mode === 'routed') return false;\n  if (link.mode === 'access') return link.accessVlan === vlanId;\n  if (!link.allowedVlans?.includes(vlanId)) return false;\n  return (link.nativeVlanA === vlanId) === (link.nativeVlanB === vlanId);\n}", "function carriesVlan(link: BuilderEthernetLink, vlanId: number): boolean {\n  if (link.failed) return false;\n  return link.mode === 'access' ? link.accessVlan === vlanId : link.mode === 'trunk' && Boolean(link.allowedVlans?.includes(vlanId));\n}",1)
text=text.replace("function switchIds(config: BuilderEthernetConfig): string[] { return config.devices.filter((device)=>device.kind==='switch'||device.kind==='l3-switch').map((device)=>device.id).sort(); }", "function switchIds(config: BuilderEthernetConfig): string[] { return config.devices.filter((device)=>device.kind==='switch').map((device)=>device.id).sort(); }",1)
start=text.index('function activeSwitchEdges(')
end=text.index('\n\nfunction hasCycle',start)
text=text[:start]+"function activeSwitchEdges(config: BuilderEthernetConfig, vlanId: number): Array<{linkId:string;a:string;b:string}> {\n  return config.links.filter((link)=>{\n    if(!carriesVlan(link,vlanId))return false;\n    return deviceById(config,link.a)?.kind==='switch'&&deviceById(config,link.b)?.kind==='switch';\n  }).map((link)=>({linkId:link.id,a:link.a,b:link.b})).sort((x,y)=>x.linkId.localeCompare(y.linkId));\n}"+text[end:]
text=text.replace("const aSwitch=['switch','l3-switch'].includes(deviceById(config,link.a)?.kind??''),bSwitch=['switch','l3-switch'].includes(deviceById(config,link.b)?.kind??'');", "const aSwitch=deviceById(config,link.a)?.kind==='switch',bSwitch=deviceById(config,link.b)?.kind==='switch';")
p.write_text(text)

# Enterprise module imports the canonical path primitive and owns its transformed logical L2 projection.
p=Path('src/builder/enterprise.ts'); text=p.read_text()
text=text.replace("  BuilderEthernetEnterpriseConfig,", "  BuilderEthernetEnterpriseConfig,\n  BuilderEthernetFlowResult,")
text=text.replace("} from './ethernet.ts';", "  builderEthernetPathForVlan,\n} from './ethernet.ts';",1)
anchor='export function builderRstpConvergence(config: BuilderEthernetConfig, vlanId: number, failedLinkId: string): BuilderRstpConvergence {'
insert="""
function logicalL2Config(config: BuilderEthernetConfig, vlanId: number): BuilderEthernetConfig {
  const next=structuredClone(config) as BuilderEthernetConfig;
  next.devices=next.devices.map((device)=>device.kind==='l3-switch'?{...device,kind:'switch',interfaces:[]}:device);
  const disabled=new Set<string>();
  for(const link of next.links){
    if(link.mode==='routed'||builderVlanEncapsulation(link,vlanId).mismatch)disabled.add(link.id);
  }
  for(const bundle of next.enterprise?.lacpBundles??[]){
    const state=builderLacpState(next,bundle.id);
    for(const member of bundle.memberLinkIds)disabled.add(member);
    const representative=state.up?state.activeMemberLinkIds[0]:null;
    if(representative)disabled.delete(representative);
  }
  next.links=next.links.map((link)=>disabled.has(link.id)?{...link,failed:true}:link);
  next.enterprise=undefined;
  return next;
}

function enterprisePath(config:BuilderEthernetConfig,sourceId:string,destinationId:string,vlanId:number){
  return builderEthernetPathForVlan(logicalL2Config(config,vlanId),sourceId,destinationId,vlanId);
}

function enterpriseFlowFail(sourceId:string,destinationId:string,sourceVlan:number|null,destinationVlan:number|null,reason:string):BuilderEthernetFlowResult{
  return{sourceId,destinationId,sourceVlan,destinationVlan,success:false,routed:false,routedAt:null,ttlBefore:64,ttlAfter:64,segments:[],fdb:[],failureReason:reason,summary:reason};
}

export function runBuilderEnterpriseEthernetFlow(configInput:BuilderEthernetConfig,sourceId:string,destinationId:string):BuilderEthernetFlowResult{
  const config=structuredClone(configInput) as BuilderEthernetConfig;
  config.enterprise=validateBuilderEthernetEnterpriseConfig(config,config.enterprise);
  const source=deviceById(config,sourceId),destination=deviceById(config,destinationId);
  if(!source||!destination||source.kind!=='endpoint'||destination.kind!=='endpoint'||sourceId===destinationId)return enterpriseFlowFail(sourceId,destinationId,null,null,'Choose two different Ethernet endpoints.');
  const sourceIf=source.interfaces[0],destinationIf=destination.interfaces[0];
  if(!sourceIf||!destinationIf)return enterpriseFlowFail(sourceId,destinationId,sourceIf?.vlanId??null,destinationIf?.vlanId??null,'Endpoint VLAN interfaces are incomplete.');
  const sourceVlan=sourceIf.vlanId,destinationVlan=destinationIf.vlanId;
  if(sourceVlan===destinationVlan){const path=enterprisePath(config,sourceId,destinationId,sourceVlan);return path?{sourceId,destinationId,sourceVlan,destinationVlan,success:true,routed:false,routedAt:null,ttlBefore:64,ttlAfter:64,segments:[{phase:'same-vlan',vlanId:sourceVlan,nodeIds:path.nodeIds,linkIds:path.linkIds,disposition:'FLOOD THEN LEARN'}],fdb:[],failureReason:null,summary:`VLAN ${sourceVlan} crosses the logical Layer-2 topology; LACP members project as one bundle and native-VLAN mismatches do not forward.`}:enterpriseFlowFail(sourceId,destinationId,sourceVlan,destinationVlan,`VLAN ${sourceVlan} has no active enterprise Layer-2 path.`);}
  const sourceVrf=sourceIf.vrfId??'default',destinationVrf=destinationIf.vrfId??'default';
  if(sourceVrf!==destinationVrf)return enterpriseFlowFail(sourceId,destinationId,sourceVlan,destinationVlan,`VRF isolation: ${source.label} is in ${sourceVrf} while ${destination.label} is in ${destinationVrf}. Overlapping addresses do not merge routing tables.`);
  const sourceGateway=builderResolveEnterpriseGateway(config,sourceId),destinationGateway=builderResolveEnterpriseGateway(config,destinationId);
  const router=sourceGateway.gatewayDeviceId?deviceById(config,sourceGateway.gatewayDeviceId):undefined;
  if(!router||!['router','l3-switch'].includes(router.kind)||!router.interfaces.some((entry)=>entry.vlanId===destinationVlan&&(entry.vrfId??'default')===sourceVrf))return enterpriseFlowFail(sourceId,destinationId,sourceVlan,destinationVlan,`VLAN ${sourceVlan} gateway cannot route to VLAN ${destinationVlan} inside VRF ${sourceVrf}.`);
  if(!destinationGateway.gatewayDeviceId)return enterpriseFlowFail(sourceId,destinationId,sourceVlan,destinationVlan,destinationGateway.reason);
  const toGateway=enterprisePath(config,sourceId,router.id,sourceVlan),fromRouter=enterprisePath(config,router.id,destinationId,destinationVlan);
  if(!toGateway)return enterpriseFlowFail(sourceId,destinationId,sourceVlan,destinationVlan,`VLAN ${sourceVlan} cannot reach active gateway ${router.label}.`);
  if(!fromRouter)return enterpriseFlowFail(sourceId,destinationId,sourceVlan,destinationVlan,`Routed hop ${router.label} cannot reach ${destination.label} through VLAN ${destinationVlan}.`);
  return{sourceId,destinationId,sourceVlan,destinationVlan,success:true,routed:true,routedAt:router.id,ttlBefore:64,ttlAfter:63,segments:[{phase:'to-gateway',vlanId:sourceVlan,nodeIds:toGateway.nodeIds,linkIds:toGateway.linkIds,disposition:'FLOOD THEN LEARN'},{phase:'from-router',vlanId:destinationVlan,nodeIds:fromRouter.nodeIds,linkIds:fromRouter.linkIds,disposition:'ROUTED UNICAST'}],fdb:[],failureReason:null,summary:`${router.label} routes VLAN ${sourceVlan} → VLAN ${destinationVlan} inside VRF ${sourceVrf}; FHRP, logical LACP and explicit tag truth are projections of the same Ethernet configuration.`};
}

export function builderEnterpriseStpState(config:BuilderEthernetConfig,vlanId:number):BuilderStpState{return builderStpState(logicalL2Config(config,vlanId),vlanId);}

"""
if anchor not in text: raise SystemExit('RSTP anchor missing')
text=text.replace(anchor,insert+anchor,1)
text=text.replace('  const before = builderStpState(config, vlanId);','  const before = builderEnterpriseStpState(config, vlanId);',1)
text=text.replace('  const after = builderStpState(next, vlanId);','  const after = builderEnterpriseStpState(next, vlanId);',1)
p.write_text(text)

# Contract calls enterprise forwarding and asserts routed clone immutability + logical STP member truth.
p=Path('scripts/builder-enterprise-contract-check.mjs'); text=p.read_text()
text=text.replace("import { createDefaultBuilderEthernetConfig, runBuilderEthernetFlow, validateBuilderEthernetConfig } from '../src/builder/ethernet.ts';", "import { cloneBuilderEthernetConfig, createDefaultBuilderEthernetConfig, validateBuilderEthernetConfig } from '../src/builder/ethernet.ts';")
text=text.replace('  builderRstpConvergence,','  builderRstpConvergence,\n  builderEnterpriseStpState,')
text=text.replace('  createEnterpriseCampusFixture,','  createEnterpriseCampusFixture,\n  runBuilderEnterpriseEthernetFlow,')
text=text.replace("const flow = runBuilderEthernetFlow(campus, 'lan-a', 'lan-c');", "const bundleStp=builderEnterpriseStpState(campus,10);\nassert.equal(bundleStp.blockedLinkIds.includes('sw1-dist-a-2'),false,'physical LACP members must not masquerade as separately STP-blocked links');\nconst flow = runBuilderEnterpriseEthernetFlow(campus, 'lan-a', 'lan-c');")
text=text.replace("assert.match(runBuilderEthernetFlow(vrfIsolated, 'lan-a', 'lan-c').failureReason ?? '', /VRF isolation/);", "assert.match(runBuilderEnterpriseEthernetFlow(vrfIsolated, 'lan-a', 'lan-c').failureReason ?? '', /VRF isolation/);")
marker="const routedValidated = validateBuilderEthernetConfig(routed);"
text=text.replace(marker,marker+"\nconst clonedRouted=cloneBuilderEthernetConfig(routedValidated);\nclonedRouted.links.find((link)=>link.id==='dist-core-routed').routed.aAddress='172.16.0.9';\nassert.equal(routedValidated.links.find((link)=>link.id==='dist-core-routed').routed.aAddress,'172.16.0.1','routed-port clone must not alias nested config');")
p.write_text(text)
