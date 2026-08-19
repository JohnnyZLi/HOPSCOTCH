from pathlib import Path
import re


def read(path):
    return Path(path).read_text()


def write(path, text):
    Path(path).write_text(text)


def rep(path, old, new):
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one occurrence, found {count}: {old[:100]!r}")
    write(path, text.replace(old, new, 1))


def sub(path, pattern, replacement):
    text = read(path)
    next_text, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f"{path}: expected one regex match, found {count}: {pattern[:100]!r}")
    write(path, next_text)


# src/builder/challenges.ts
p = 'src/builder/challenges.ts'
rep(p,
    "export type BuilderChallengeBoundary = 'ADDRESSING' | 'DNS' | 'L2' | 'ROUTING' | 'POLICY' | 'TRANSPORT';\nexport type BuilderChallengeDevicePlane = 'routed' | 'ethernet';",
    "export type BuilderChallengeBoundary = 'ADDRESSING' | 'DNS' | 'L2' | 'ROUTING' | 'POLICY' | 'TRANSPORT';\nexport type BuilderChallengeRepairStage = 'NONE' | 'PRIMARY_ONLY' | 'SECONDARY_ONLY' | 'ALL';\nexport type BuilderChallengeDevicePlane = 'routed' | 'ethernet';")
rep(p,
    "export type BuilderChallengeFamily = 'gateway' | 'access-vlan' | 'trunk-vlan' | 'stp-loop' | 'static-route' | 'ospf-disabled' | 'acl-deny' | 'nat-disabled' | 'dhcp-gateway' | 'ipv6-pmtu' | 'dns-name' | 'transport-listener' | 'bgp-import-policy';",
    "export type BuilderChallengeFamily = 'gateway' | 'access-vlan' | 'trunk-vlan' | 'stp-loop' | 'static-route' | 'ospf-disabled' | 'acl-deny' | 'nat-disabled' | 'dhcp-gateway' | 'ipv6-pmtu' | 'dns-name' | 'transport-listener' | 'bgp-import-policy' | 'multi-fault';")
rep(p,
    "  difficulty: 'FOUNDATION';\n  healthy: BuilderAuthoringSnapshot;\n  broken: BuilderAuthoringSnapshot;\n  verification: BuilderChallengeVerification;\n  fault: BuilderChallengeFault;\n}",
    "  difficulty: 'FOUNDATION' | 'COMPOSED';\n  healthy: BuilderAuthoringSnapshot;\n  broken: BuilderAuthoringSnapshot;\n  verification: BuilderChallengeVerification;\n  fault: BuilderChallengeFault;\n  secondaryFault?: BuilderChallengeFault;\n}")
rep(p,
    "  applicationBoundary?: BuilderApplicationTruthBoundary | null;\n  repaired: boolean;",
    "  applicationBoundary?: BuilderApplicationTruthBoundary | null;\n  repairStage?: BuilderChallengeRepairStage;\n  repaired: boolean;")
rep(p,
    "export interface BuilderChallengeHypothesis {\n  boundary: BuilderChallengeBoundary;\n  deviceId: string;\n}",
    "export interface BuilderChallengeHypothesis {\n  boundary: BuilderChallengeBoundary;\n  deviceId: string;\n  secondaryBoundary?: BuilderChallengeBoundary;\n  secondaryDeviceId?: string;\n}")
rep(p, "    title: 'OSPF EDGE FALLS SILENT',", "    title: 'OSPF ROUTER FALLS SILENT',")

multi = '''
export function createComposedChallenge(seedInput: string): BuilderChallenge {
  const seed=normalizeSeed(seedInput), hash=hashSeed(seed), healthy=defaultHealthySnapshot();
  healthy.sourceId='client'; healthy.destinationId='app';
  const sourceAddress=interfacesForBuilderNode(healthy.addressing,'client')[0]?.address;
  const destinationAddress=interfacesForBuilderNode(healthy.addressing,'app')[0]?.address;
  if(!sourceAddress||!destinationAddress)throw new Error('The composed challenge requires canonical CLIENT and APP IPv4 addresses.');
  const blockingRule:BuilderAclRule={id:`challenge-multi-acl-${hash.toString(16).padStart(8,'0')}`,routerId:'core',order:5,action:'deny',protocol:'icmp',sourcePrefix:`${sourceAddress}/32`,destinationPrefix:`${destinationAddress}/32`,destinationPort:null,description:'Track J composed objective ICMP deny'};
  const broken=createBuilderAuthoringSnapshot(healthy);
  broken.acl=upsertBuilderAclRule(broken.graph,broken.acl,blockingRule);
  const secondaryFault:BuilderAclDenyChallengeFault={kind:'acl-objective-deny',boundary:'POLICY',plane:'routed',nodeId:'core',blockingRule};
  let fault:BuilderGatewayChallengeFault|BuilderOspfDisabledChallengeFault;
  if(hash%2===0){
    const expectedGateway=healthy.addressing.defaultGateways.client;
    if(!expectedGateway)throw new Error('The composed gateway branch requires the canonical CLIENT default gateway.');
    broken.addressing.defaultGateways.client=null;
    broken.addressing=validateBuilderAddressing(broken.graph,broken.addressing);
    fault={kind:'missing-default-gateway',boundary:'ADDRESSING',plane:'routed',nodeId:'client',expectedGateway};
  }else{
    broken.routing=setBuilderOspfRouterEnabled(broken.graph,broken.addressing,broken.routing,'edge',false);
    fault={kind:'ospf-router-disabled',boundary:'ROUTING',plane:'routed',nodeId:'edge',expectedEnabled:true};
  }
  return{schema:BUILDER_CHALLENGE_SCHEMA,version:BUILDER_CHALLENGE_VERSION,id:`multi-${hash.toString(16).padStart(8,'0')}`,seed,family:'multi-fault',title:'TWO FAILURES, ONE SYMPTOM',objective:'Restore CLIENT → APP IPv4 reachability. Two independent canonical faults are active and one can mask the other. Use ordinary probes and Device Workbench to identify an ordered two-step causal hypothesis, repair both with normal Builder controls, and verify only after both faults are restored.',difficulty:'COMPOSED',healthy,broken,verification:{kind:'routed-probe',sourceId:'client',destinationId:'app'},fault,secondaryFault};
}

'''
rep(p, "export function createBuilderChallenge(seedInput: string): BuilderChallenge {", multi + "export function createBuilderChallenge(seedInput: string): BuilderChallenge {")
rep(p,
    "  if (lowered.startsWith('bgp-') || lowered.startsWith('bgp-policy-')) return createBgpImportPolicyChallenge(seed);\n  return createDefaultGatewayChallenge(seed);",
    "  if (lowered.startsWith('bgp-') || lowered.startsWith('bgp-policy-')) return createBgpImportPolicyChallenge(seed);\n  if (lowered.startsWith('multi-') || lowered.startsWith('composed-')) return createComposedChallenge(seed);\n  return createDefaultGatewayChallenge(seed);")

repair = '''function challengeFaultIsRepaired(fault:BuilderChallengeFault,addressing:BuilderAddressing,ethernet:BuilderEthernetConfig,routing:BuilderRoutingConfig,acl:BuilderAclConfig,nat:BuilderNatConfig,dhcp:BuilderDhcpConfig,linkProfiles:BuilderLinkProfiles,services:readonly BuilderHostedService[]):boolean{
  if(fault.kind==='missing-default-gateway')return addressing.defaultGateways[fault.nodeId]===fault.expectedGateway;
  if(fault.kind==='access-vlan-mismatch'){const link=ethernet.links.find((entry)=>entry.id===fault.linkId);return link?.mode==='access'&&link.accessVlan===fault.expectedAccessVlan;}
  if(fault.kind==='trunk-vlan-pruned'){const link=ethernet.links.find((entry)=>entry.id===fault.linkId);return link?.mode==='trunk'&&sameNumberArray(link.allowedVlans,fault.expectedAllowedVlans);}
  if(fault.kind==='stp-disabled-loop')return ethernet.stp.enabled===fault.expectedEnabled;
  if(fault.kind==='missing-static-route')return routing.staticRoutes.some((route)=>route.id===fault.expectedRoute.id&&route.routerId===fault.expectedRoute.routerId&&route.prefix===fault.expectedRoute.prefix&&route.nextHop===fault.expectedRoute.nextHop&&route.metric===fault.expectedRoute.metric);
  if(fault.kind==='ospf-router-disabled')return routing.ospf.enabledRouterIds.includes(fault.nodeId)===fault.expectedEnabled;
  if(fault.kind==='acl-objective-deny')return !acl.rules.some((rule)=>rule.id===fault.blockingRule.id);
  if(fault.kind==='nat-boundary-disabled'){const boundary=nat.boundaries.find((entry)=>entry.id===fault.boundaryId&&entry.routerId===fault.nodeId);return boundary?.enabled===fault.expectedEnabled;}
  if(fault.kind==='dhcp-gateway-option-missing'){const pool=dhcp.pools.find((entry)=>entry.id===fault.poolId&&entry.serverDeviceId===fault.nodeId);return pool?.gateway===fault.expectedGateway;}
  if(fault.kind==='path-mtu-reduced')return linkProfiles[fault.linkId]?.mtuBytes===fault.expectedMtuBytes;
  if(fault.kind==='bgp-import-deny')return !routing.bgp.policies.some((rule)=>rule.id===fault.blockingPolicy.id);
  const service=services.find((entry)=>entry.id===fault.serviceId&&entry.nodeId===fault.nodeId);
  return fault.kind==='service-hostname-missing'?service?.hostname===fault.expectedHostname:service?.enabled===fault.expectedEnabled;
}
export function builderChallengeRepairStage(challenge:BuilderChallenge,addressing:BuilderAddressing,ethernet:BuilderEthernetConfig,routing:BuilderRoutingConfig,acl:BuilderAclConfig=challenge.broken.acl,nat:BuilderNatConfig=challenge.broken.nat,dhcp:BuilderDhcpConfig=challenge.broken.dhcp,linkProfiles:BuilderLinkProfiles=challenge.broken.linkProfiles,services:readonly BuilderHostedService[]=challenge.broken.services??[]):BuilderChallengeRepairStage{
  const primary=challengeFaultIsRepaired(challenge.fault,addressing,ethernet,routing,acl,nat,dhcp,linkProfiles,services);
  if(!challenge.secondaryFault)return primary?'ALL':'NONE';
  const secondary=challengeFaultIsRepaired(challenge.secondaryFault,addressing,ethernet,routing,acl,nat,dhcp,linkProfiles,services);
  return primary&&secondary?'ALL':primary?'PRIMARY_ONLY':secondary?'SECONDARY_ONLY':'NONE';
}
export function builderChallengeIsRepaired(challenge:BuilderChallenge,addressing:BuilderAddressing,ethernet:BuilderEthernetConfig,routing:BuilderRoutingConfig,acl:BuilderAclConfig=challenge.broken.acl,nat:BuilderNatConfig=challenge.broken.nat,dhcp:BuilderDhcpConfig=challenge.broken.dhcp,linkProfiles:BuilderLinkProfiles=challenge.broken.linkProfiles,services:readonly BuilderHostedService[]=challenge.broken.services??[]):boolean{
  return builderChallengeRepairStage(challenge,addressing,ethernet,routing,acl,nat,dhcp,linkProfiles,services)==='ALL';
}

'''
sub(p, r"export function builderChallengeIsRepaired\(challenge: BuilderChallenge.*?\n}\n\nexport function builderChallengeSolvedExplanation", repair + "export function builderChallengeSolvedExplanation")
rep(p,
    "export function builderChallengeSolvedExplanation(challenge: BuilderChallenge): string {\n  const fault = challenge.fault;",
    "export function builderChallengeSolvedExplanation(challenge: BuilderChallenge): string {\n  const fault = challenge.fault;\n  if(challenge.secondaryFault){const first=fault.kind==='missing-default-gateway'?`${fault.nodeId.toUpperCase()} was missing its canonical default gateway`:fault.kind==='ospf-router-disabled'?`${fault.nodeId.toUpperCase()} was not participating in OSPF`:`${fault.nodeId.toUpperCase()} carried the first canonical fault`;const second=challenge.secondaryFault.kind==='acl-objective-deny'?`${challenge.secondaryFault.nodeId.toUpperCase()} carried an explicit ICMP deny for the objective`:`${challenge.secondaryFault.nodeId.toUpperCase()} carried the second canonical fault`;return `Two independent faults were active: ${first}, then ${second}. Restoring both canonical fields and rerunning the same CLIENT → APP probe closed the composed causal chain.`;}")
rep(p,
    "function isFaultInspection(challenge: BuilderChallenge, entry: BuilderChallengeEvidence): boolean {\n  return entry.deviceId === challenge.fault.nodeId && entry.devicePlane === challenge.fault.plane;\n}",
    "function isFaultInspection(fault:BuilderChallengeFault,entry:BuilderChallengeEvidence):boolean{return entry.deviceId===fault.nodeId&&entry.devicePlane===fault.plane;}")
rep(p,
    "  const inspectedState = hasEvidence(evidence, (entry) => entry.kind === 'inspect-state' && isFaultInspection(challenge, entry) && !entry.repaired);\n  const inspectedConfig = hasEvidence(evidence, (entry) => entry.kind === 'inspect-config' && isFaultInspection(challenge, entry) && !entry.repaired);\n\n  let evidenceScore = 0;",
    "  const inspectedState = hasEvidence(evidence, (entry) => entry.kind === 'inspect-state' && isFaultInspection(challenge.fault, entry) && !entry.repaired);\n  const inspectedConfig = hasEvidence(evidence, (entry) => entry.kind === 'inspect-config' && isFaultInspection(challenge.fault, entry) && !entry.repaired);\n\n  if(challenge.secondaryFault){\n    const secondary=challenge.secondaryFault;\n    const failedPing=hasEvidence(evidence,(entry)=>entry.kind==='ping'&&isObjectiveEvidence(challenge,entry)&&entry.success===false&&entry.repairStage==='NONE');\n    const failedTrace=hasEvidence(evidence,(entry)=>entry.kind==='traceroute'&&isObjectiveEvidence(challenge,entry)&&entry.success===false&&entry.repairStage==='NONE');\n    const firstInspect=hasEvidence(evidence,(entry)=>(entry.kind==='inspect-state'||entry.kind==='inspect-config')&&isFaultInspection(challenge.fault,entry)&&entry.repairStage!=='ALL');\n    const secondInspect=hasEvidence(evidence,(entry)=>(entry.kind==='inspect-state'||entry.kind==='inspect-config')&&isFaultInspection(secondary,entry)&&entry.repairStage!=='ALL');\n    const oneRepairFailure=hasEvidence(evidence,(entry)=>(entry.kind==='ping'||entry.kind==='traceroute')&&isObjectiveEvidence(challenge,entry)&&entry.success===false&&(entry.repairStage==='PRIMARY_ONLY'||entry.repairStage==='SECONDARY_ONLY'));\n    const evidenceScore=(failedPing?10:0)+(failedTrace?10:0)+(firstInspect?5:0)+(secondInspect?5:0)+(oneRepairFailure?10:0);\n    const eligible=(failedPing||failedTrace)&&firstInspect&&secondInspect&&oneRepairFailure;\n    const reasoningScore=eligible&&hypothesis?(hypothesis.boundary===challenge.fault.boundary?5:0)+(hypothesis.deviceId===challenge.fault.nodeId?5:0)+(hypothesis.secondaryBoundary===secondary.boundary?5:0)+(hypothesis.secondaryDeviceId===secondary.nodeId?5:0):0;\n    const repaired=builderChallengeIsRepaired(challenge,addressing,ethernet,routing,acl,nat,dhcp,linkProfiles,services);\n    const verified=hasEvidence(evidence,(entry)=>(entry.kind==='ping'||entry.kind==='traceroute')&&isObjectiveEvidence(challenge,entry)&&entry.success===true&&entry.repairStage==='ALL'&&entry.repaired);\n    const repairScore=repaired?25:0,verificationScore=repaired&&verified?15:0;\n    return{evidence:evidenceScore,reasoning:reasoningScore,repair:repairScore,verification:verificationScore,total:evidenceScore+reasoningScore+repairScore+verificationScore,repaired,verified:repaired&&verified,solved:repaired&&verified};\n  }\n\n  let evidenceScore = 0;")

# src/BuilderChallengePanel.tsx
p = 'src/BuilderChallengePanel.tsx'
rep(p, "  const [deviceId, setDeviceId] = useState('');", "  const [deviceId, setDeviceId] = useState('');\n  const [secondaryBoundary,setSecondaryBoundary]=useState<BuilderChallengeBoundary|''>('');\n  const [secondaryDeviceId,setSecondaryDeviceId]=useState('');")
rep(p, "    setDeviceId('');\n  }, [challenge.id]);", "    setDeviceId('');\n    setSecondaryBoundary(''); setSecondaryDeviceId('');\n  }, [challenge.id]);")
sub(p, r"  const token = builderChallengeToken\(challenge\);\n  const devices = challenge\.fault\.plane === 'routed'.*?  const verificationKind = challenge\.verification\.kind;",
'''  const token = builderChallengeToken(challenge);
  const routedDevices=challenge.broken.graph.nodes.map((node)=>({id:node.id,label:node.label,kind:node.kind}));
  const ethernetDevices=challenge.broken.ethernet.devices.map((device)=>({id:device.id,label:device.label,kind:device.kind}));
  const devices=challenge.fault.plane==='routed'?routedDevices:ethernetDevices;
  const secondaryDevices=challenge.secondaryFault?(challenge.secondaryFault.plane==='routed'?routedDevices:ethernetDevices):[];
  const hypothesisDeviceLabel=devices.find((device)=>device.id===hypothesis?.deviceId)?.label??hypothesis?.deviceId;
  const secondaryHypothesisDeviceLabel=secondaryDevices.find((device)=>device.id===hypothesis?.secondaryDeviceId)?.label??hypothesis?.secondaryDeviceId;
  const faultDeviceLabel=devices.find((device)=>device.id===challenge.fault.nodeId)?.label??challenge.fault.nodeId;
  const secondaryFaultDeviceLabel=challenge.secondaryFault?secondaryDevices.find((device)=>device.id===challenge.secondaryFault?.nodeId)?.label??challenge.secondaryFault.nodeId:null;
  const verificationKind = challenge.verification.kind;
  const composed=Boolean(challenge.secondaryFault);''')
rep(p, "<div><span>REPAIR</span><strong>{score.repaired ? 'CANONICAL FIX' : 'FAULT ACTIVE'}</strong></div>", "<div><span>REPAIR</span><strong>{score.repaired?'CANONICAL FIX':composed?'FAULTS ACTIVE':'FAULT ACTIVE'}</strong></div>")
rep(p, "<p>{challenge.family === 'bgp-import-policy'", "<p>{composed?'Two canonical faults are active. Establish the initial failure, inspect both suspected locations, and rerun the objective after one repair to prove another fault remains. Lock an ordered two-step causal hypothesis, repair both with normal Builder controls, then verify the same objective after the network is fully restored.':challenge.family === 'bgp-import-policy'")
hypothesis = '''    <div className="builder-challenge-hypothesis">
      <span>{composed?'ORDERED CAUSAL HYPOTHESIS':'CAUSAL HYPOTHESIS'}</span>
      {hypothesis
        ? <><strong>FIRST · {hypothesis.boundary} · {hypothesisDeviceLabel}</strong>{composed&&<strong>SECOND · {hypothesis.secondaryBoundary??'—'} · {secondaryHypothesisDeviceLabel??'—'}</strong>}</>
        : <>
          <label>FIRST BROKEN BOUNDARY<select value={boundary} disabled={historical} onChange={(event)=>setBoundary(event.currentTarget.value as BuilderChallengeBoundary|'')}><option value="">CHOOSE…</option>{BOUNDARIES.map((value)=><option key={value} value={value}>{value}</option>)}</select></label>
          <label>PRIMARY FAULT LOCATION<select value={deviceId} disabled={historical} onChange={(event)=>setDeviceId(event.currentTarget.value)}><option value="">CHOOSE…</option>{devices.map((device)=><option key={device.id} value={device.id}>{device.label} · {device.kind.toUpperCase()}</option>)}</select></label>
          {composed&&<><label>SECOND BROKEN BOUNDARY<select value={secondaryBoundary} disabled={historical} onChange={(event)=>setSecondaryBoundary(event.currentTarget.value as BuilderChallengeBoundary|'')}><option value="">CHOOSE…</option>{BOUNDARIES.map((value)=><option key={value} value={value}>{value}</option>)}</select></label><label>SECOND FAULT LOCATION<select value={secondaryDeviceId} disabled={historical} onChange={(event)=>setSecondaryDeviceId(event.currentTarget.value)}><option value="">CHOOSE…</option>{secondaryDevices.map((device)=><option key={device.id} value={device.id}>{device.label} · {device.kind.toUpperCase()}</option>)}</select></label></>}
          <button type="button" disabled={historical||!boundary||!deviceId||(composed&&(!secondaryBoundary||!secondaryDeviceId))} onClick={()=>{if(!boundary||!deviceId)return;onLockHypothesis({boundary,deviceId,...(composed&&secondaryBoundary&&secondaryDeviceId?{secondaryBoundary,secondaryDeviceId}:{})});}}>LOCK HYPOTHESIS</button>
        </>}
      <small>{composed?'Composed reasoning requires an initial failure, inspection of both fault locations, and another failed objective after exactly one canonical fault has been repaired.':'Reasoning points require both failed objective evidence and inspection of the primary fault location before the hypothesis can score.'}</small>
    </div>'''
sub(p, r'    <div className="builder-challenge-hypothesis">.*?    </div>\n\n    <div className="builder-challenge-evidence">', hypothesis + '\n\n    <div className="builder-challenge-evidence">')
rep(p, "<strong>{challenge.fault.boundary} · {faultDeviceLabel}</strong>", "<strong>{challenge.fault.boundary} · {faultDeviceLabel}{challenge.secondaryFault?` → ${challenge.secondaryFault.boundary} · ${secondaryFaultDeviceLabel}`:''}</strong>")

# src/NetworkBuilder.tsx
p = 'src/NetworkBuilder.tsx'
rep(p,
    "import { appendBuilderChallengeEvidence, builderChallengeIsRepaired, createBuilderChallenge, scoreBuilderChallenge, seedFromBuilderChallengeToken, type BuilderChallenge, type BuilderChallengeEvidence, type BuilderChallengeHypothesis } from './builder/challenges.ts';",
    "import { appendBuilderChallengeEvidence, builderChallengeIsRepaired, builderChallengeRepairStage, createBuilderChallenge, scoreBuilderChallenge, seedFromBuilderChallengeToken, type BuilderChallenge, type BuilderChallengeEvidence, type BuilderChallengeHypothesis } from './builder/challenges.ts';")
rep(p,
    "      const repaired = builderChallengeIsRepaired(challenge, addressing, ethernet, routing, acl, nat, dhcp, linkProfiles, services);\n      setChallengeEvidence((current) => appendBuilderChallengeEvidence(current, { kind, sourceId, destinationId, success: result.success, repaired, detail: result.summary }));",
    "      const repaired = builderChallengeIsRepaired(challenge, addressing, ethernet, routing, acl, nat, dhcp, linkProfiles, services);\n      const repairStage=builderChallengeRepairStage(challenge,addressing,ethernet,routing,acl,nat,dhcp,linkProfiles,services);\n      setChallengeEvidence((current) => appendBuilderChallengeEvidence(current, { kind, sourceId, destinationId, success: result.success, repaired, repairStage, detail: result.summary }));")
focus = '''  const focusChallengeObjective=(next:BuilderChallenge)=>{
    if(next.verification.kind==='ethernet-flow'){setEthernetSourceId(next.verification.sourceId);setEthernetDestinationId(next.verification.destinationId);setWorkbenchDevice({plane:'ethernet',id:next.verification.sourceId});return;}
    if(next.verification.kind==='dhcp-configuration'){setWorkbenchDevice({plane:'ethernet',id:next.verification.sourceId});return;}
    setSourceId(next.verification.sourceId);setDestinationId(next.verification.destinationId);setWorkbenchDevice({plane:'routed',id:next.verification.sourceId});setSelectedNodeId(next.verification.sourceId);
    if(next.verification.kind==='ipv6-pmtu'){setProbeFamily('ipv6');setIpv6ProbePacketBytes(next.verification.packetBytes??1500);}
  };
'''
rep(p, "  const startChallenge = (seedOrToken:string) => {", focus + "  const startChallenge = (seedOrToken:string) => {")
sub(p, r"      if\(next\.verification\.kind==='ethernet-flow'\).*?else\{setSourceId\(next\.verification\.sourceId\);setDestinationId\(next\.verification\.destinationId\);setWorkbenchDevice\(\{plane:'routed',id:next\.verification\.sourceId\}\);setSelectedNodeId\(next\.verification\.sourceId\);\}", "      focusChallengeObjective(next);")
sub(p, r"    if\(challenge\.verification\.kind==='ethernet-flow'\).*?else\{setSourceId\(challenge\.verification\.sourceId\);setDestinationId\(challenge\.verification\.destinationId\);setWorkbenchDevice\(\{plane:'routed',id:challenge\.verification\.sourceId\}\);setSelectedNodeId\(challenge\.verification\.sourceId\);\}", "    focusChallengeObjective(challenge);")
rep(p,
    "<button type=\"button\" onClick={()=>setChallengeSeed('bgp-001')}>BGP POLICY</button></div><button type=\"button\" disabled={isHistorical} onClick={()=>startChallenge(challengeSeed)}>START CHALLENGE</button><small className=\"builder-routing-note\">SEED PREFIX SELECTS FAMILY · GATEWAY / VLAN / TRUNK / STP / STATIC / OSPF / ACL / NAT / DHCP / IPV6 MTU / DNS / TRANSPORT / BGP POLICY ·",
    "<button type=\"button\" onClick={()=>setChallengeSeed('bgp-001')}>BGP POLICY</button><button type=\"button\" onClick={()=>setChallengeSeed('multi-001')}>MULTI-FAULT</button></div><button type=\"button\" disabled={isHistorical} onClick={()=>startChallenge(challengeSeed)}>START CHALLENGE</button><small className=\"builder-routing-note\">SEED PREFIX SELECTS FAMILY · GATEWAY / VLAN / TRUNK / STP / STATIC / OSPF / ACL / NAT / DHCP / IPV6 MTU / DNS / TRANSPORT / BGP POLICY / MULTI-FAULT ·")
rep(p,
    "onInspect={(inspection)=>{if(!challenge||isHistorical)return;const kind=inspection.tab==='config'?'inspect-config':inspection.tab==='state'?'inspect-state':'inspect-events';const repaired=builderChallengeIsRepaired(challenge,addressing,ethernet,routing,acl,nat,dhcp,linkProfiles,services);const inspectedLabel=",
    "onInspect={(inspection)=>{if(!challenge||isHistorical)return;const kind=inspection.tab==='config'?'inspect-config':inspection.tab==='state'?'inspect-state':'inspect-events';const repaired=builderChallengeIsRepaired(challenge,addressing,ethernet,routing,acl,nat,dhcp,linkProfiles,services);const repairStage=builderChallengeRepairStage(challenge,addressing,ethernet,routing,acl,nat,dhcp,linkProfiles,services);const inspectedLabel=")
rep(p,
    "appendBuilderChallengeEvidence(current,{kind,deviceId:inspection.device.id,devicePlane:inspection.device.plane,repaired,detail:`Inspected ${inspection.tab.toUpperCase()} on ${inspectedLabel} in the normal Device Workbench.`})",
    "appendBuilderChallengeEvidence(current,{kind,deviceId:inspection.device.id,devicePlane:inspection.device.plane,repaired,repairStage,detail:`Inspected ${inspection.tab.toUpperCase()} on ${inspectedLabel} in the normal Device Workbench.`})")

# scripts/builder-challenge-contract-check.mjs
p = 'scripts/builder-challenge-contract-check.mjs'
rep(p, "  builderChallengeIsRepaired,\n  builderChallengeToken,", "  builderChallengeIsRepaired,\n  builderChallengeRepairStage,\n  builderChallengeToken,")
rep(p, "  createBuilderChallenge,\n  createBgpImportPolicyChallenge,", "  createBuilderChallenge,\n  createBgpImportPolicyChallenge,\n  createComposedChallenge,")
rep(p, "import { resolveBuilderEthernetFlowArp } from '../src/builder/arp.ts';", "import { deleteBuilderAclRule } from '../src/builder/acl.ts';\nimport { resolveBuilderEthernetFlowArp } from '../src/builder/arp.ts';")
rep(p, "import { validateBuilderRoutingConfig } from '../src/builder/routing.ts';", "import { setBuilderOspfRouterEnabled, validateBuilderRoutingConfig } from '../src/builder/routing.ts';")
rep(p, "function runApplication(snapshot, serviceId, sequence = 1) {", "function scoreSnapshot(challenge,evidence,hypothesis,snapshot){return scoreBuilderChallenge(challenge,evidence,hypothesis,snapshot.addressing,snapshot.ethernet,snapshot.routing,snapshot.acl,snapshot.nat,snapshot.dhcp,snapshot.linkProfiles,snapshot.services??[]);}\n\nfunction runApplication(snapshot, serviceId, sequence = 1) {")
contract = '''
const composedChallenges=['multi-contract-001','multi-contract-002'].map((seed)=>createComposedChallenge(seed));
assert.deepEqual(new Set(composedChallenges.map((challenge)=>challenge.fault.kind)),new Set(['missing-default-gateway','ospf-router-disabled']));
for(const c of composedChallenges){
  assert.equal(c.family,'multi-fault');assert.equal(c.difficulty,'COMPOSED');assert.equal(c.secondaryFault?.kind,'acl-objective-deny');assert.deepEqual(c,createBuilderChallenge(c.seed));
  const initial=runPing(c.broken,302);assert.equal(runPing(c.healthy,301).success,true);assert.equal(initial.success,false);assert.equal(builderChallengeRepairStage(c,c.broken.addressing,c.broken.ethernet,c.broken.routing,c.broken.acl,c.broken.nat,c.broken.dhcp,c.broken.linkProfiles,c.broken.services??[]),'NONE');
  const one=structuredClone(c.broken);
  if(c.fault.kind==='missing-default-gateway')one.addressing=structuredClone(c.healthy.addressing);else one.routing=setBuilderOspfRouterEnabled(one.graph,one.addressing,one.routing,c.fault.nodeId,true);
  assert.equal(builderChallengeRepairStage(c,one.addressing,one.ethernet,one.routing,one.acl,one.nat,one.dhcp,one.linkProfiles,one.services??[]),'PRIMARY_ONLY');
  const masked=runPing(one,303);assert.equal(masked.success,false,'one repair must still expose the remaining policy failure');
  const fixed=structuredClone(one);if(c.secondaryFault?.kind!=='acl-objective-deny')throw new Error('Expected composed ACL fault');fixed.acl=deleteBuilderAclRule(fixed.graph,fixed.acl,c.secondaryFault.blockingRule.id);
  assert.equal(builderChallengeRepairStage(c,fixed.addressing,fixed.ethernet,fixed.routing,fixed.acl,fixed.nat,fixed.dhcp,fixed.linkProfiles,fixed.services??[]),'ALL');assert.deepEqual(fixed.addressing,c.healthy.addressing);assert.deepEqual(fixed.routing,c.healthy.routing);assert.deepEqual(fixed.acl,c.healthy.acl);assert.equal(runPing(fixed,304).success,true);
  const o=c.verification,h={boundary:c.fault.boundary,deviceId:c.fault.nodeId,secondaryBoundary:c.secondaryFault.boundary,secondaryDeviceId:c.secondaryFault.nodeId};let e=[];
  e=appendBuilderChallengeEvidence(e,{kind:'ping',sourceId:o.sourceId,destinationId:o.destinationId,success:false,repaired:false,repairStage:'NONE',detail:initial.summary});
  e=appendBuilderChallengeEvidence(e,{kind:'traceroute',sourceId:o.sourceId,destinationId:o.destinationId,success:false,repaired:false,repairStage:'NONE',detail:'Initial composed traceroute fails.'});
  e=appendBuilderChallengeEvidence(e,{kind:'inspect-config',deviceId:c.fault.nodeId,devicePlane:c.fault.plane,repaired:false,repairStage:'NONE',detail:'Inspected first fault.'});
  e=appendBuilderChallengeEvidence(e,{kind:'inspect-state',deviceId:c.secondaryFault.nodeId,devicePlane:c.secondaryFault.plane,repaired:false,repairStage:'NONE',detail:'Inspected second fault.'});
  assert.deepEqual(scoreSnapshot(c,e,h,c.broken),{evidence:30,reasoning:0,repair:0,verification:0,total:30,repaired:false,verified:false,solved:false});
  e=appendBuilderChallengeEvidence(e,{kind:'ping',sourceId:o.sourceId,destinationId:o.destinationId,success:false,repaired:false,repairStage:'PRIMARY_ONLY',detail:masked.summary});
  assert.deepEqual(scoreSnapshot(c,e,h,one),{evidence:40,reasoning:20,repair:0,verification:0,total:60,repaired:false,verified:false,solved:false});assert.equal(scoreSnapshot(c,e,h,fixed).total,85);
  e=appendBuilderChallengeEvidence(e,{kind:'ping',sourceId:o.sourceId,destinationId:o.destinationId,success:true,repaired:true,repairStage:'ALL',detail:'Fully repaired objective passed.'});
  assert.deepEqual(scoreSnapshot(c,e,h,fixed),{evidence:40,reasoning:20,repair:25,verification:15,total:100,repaired:true,verified:true,solved:true});
}

'''
rep(p, "const pmtuChallenge=createIpv6PmtuChallenge('mtu-contract-001');", contract + "const pmtuChallenge=createIpv6PmtuChallenge('mtu-contract-001');")
rep(p,
    "for (const challenge of [access, trunk, stp, staticRoute, ospf, aclChallenge, natChallenge, dhcpChallenge, ...bgpChallenges, pmtuChallenge, dnsChallenge, transportChallenge]) {",
    "for (const challenge of [access, trunk, stp, staticRoute, ospf, aclChallenge, natChallenge, dhcpChallenge, ...bgpChallenges, ...composedChallenges, pmtuChallenge, dnsChallenge, transportChallenge]) {")
rep(p,
    "console.log('Builder Track J challenge contract passed: gateway plus seeded L2/routing/policy/BGP-import/DHCP/IPv6-PMTU/DNS-name/transport-listener faults use canonical truth, ordinary probe/LAN/NAT/DHCP/ND/PMTUD/application/BGP state evidence, exact repair, objective-scoped verification, causal scoring, and reproducible tokens.');",
    "console.log('Builder Track J challenge contract passed: single-fault catalog plus bounded two-fault composition use canonical truth, ordinary diagnostic surfaces, exact repair, objective-scoped verification, causal scoring, reproducible tokens, and no challenge-only network model.');")

# docs/TRACKJ.md
p = 'docs/TRACKJ.md'
rep(p,
    "This document records the **implemented Track J foundation and Layer-2 expansion**, not Track J closeout. The first slice proved the architecture with a missing IPv4 default gateway. The second slice extends the same contracts through canonical access-VLAN, trunk-pruning, and STP-loop failures.",
    "This document is the **Track J closeout record**. The track now spans deterministic single-fault troubleshooting across addressing, Layer 2, routing, policy, services, IPv6 PMTU, and BGP plus one bounded two-fault composition mode. Every challenge still consumes the same canonical Builder truth and ordinary diagnostic/repair surfaces.")
sub(p, r"## Remaining Track J work\n\n.*?The long-horizon procedural challenge generator remains Track S3 in `ROADMAP-MOONSHOTS\.md`; Track J is the bounded product path that proves the experience first\.", '''## Track J closeout boundary

Track J is closed as the bounded deterministic troubleshooting product track. The shipped catalog covers gateway/addressing, VLAN/trunk/STP, static routing, OSPF participation, ACL, NAT/PAT, DHCP options, IPv6 PMTU/ND evidence, DNS naming, transport listeners, BGP import policy, and bounded two-fault composition.

Deeper protocol-specific cases remain valid future depth, but they are no longer blockers for Track J. Native-VLAN edge cases, DHCP relay, additional PMTUD variants, BGP best-path/relationship-policy puzzles, and larger procedural generators belong in later depth tracks or the moonshot roadmap.

Difficulty must continue to come from canonical topology, composition, observability, and protocol state—not hidden facts, answer-only state, or misleading text. The long-horizon procedural challenge generator remains Track S3 in `ROADMAP-MOONSHOTS.md`.''')
text = read(p)
closeout = '''

## Ninth slice — bounded multi-fault composition and closeout

Track J closes with `multi-*` / `composed-*`, a deliberately bounded two-fault mode rather than a random fault pile.

Two deterministic compositions ship: missing CLIENT default gateway → objective-specific CORE ACL deny, and disabled OSPF participation on EDGE → objective-specific CORE ACL deny. Both use the same healthy OSPF-routed CLIENT → APP baseline. The first failure can mask the second; after exactly one repair the objective still fails from the remaining canonical fault.

The composed hypothesis contains two ordered boundary/device pairs. Evidence remains capped at 40: initial failed Ping (10), initial failed Traceroute (10), first-location inspection (5), second-location inspection (5), and a failed objective after exactly one repair (10). Reasoning remains 20 across both ordered hypotheses; exact repair remains 25 only after both faults are canonical; verification remains 15 only after the objective passes at repair stage `ALL`.

Challenge launch/restart no longer auto-focuses mutated devices or links. Every family now opens on the objective source (or LAN/DHCP source), so UI selection state cannot leak the answer location.

The schema/token stays `hopscotch.builder.challenge` v1 / `HOP-J1.<seed>`. Existing seeds preserve previous behavior; composed seeds add optional second-fault metadata and session-only repair-stage evidence.

### Closed Track J product contract

- challenge metadata never changes network truth,
- every fault is a canonical Builder configuration mutation,
- ordinary Builder surfaces provide evidence and perform repairs,
- evidence, hypotheses, scores, and repair stages remain session-only,
- verification is objective-scoped,
- single-fault and composed tokens are deterministic,
- challenge UI remains absent from stress Builder,
- no performance or compatibility ceiling is widened.
'''
if '## Ninth slice — bounded multi-fault composition and closeout' not in text:
    write(p, text.rstrip() + closeout + '\n')

# docs/ROADMAP.md
p = 'docs/ROADMAP.md'
rep(p, '''With captured evidence, application truth, causal replay, authoring, enterprise depth, data-plane realism, routing policy, provider overlays, and native/public evidence correlation closed, the next highest-value work is deterministic troubleshooting practice over canonical broken networks.

### 1. Track J — troubleshooting challenges

- [ ] generate deterministic broken networks from canonical configuration/state rather than hand-authored answer text
- [ ] cover addressing, gateway, VLAN, trunk, STP, ARP/ND, routing, OSPF, ACL, NAT, DHCP, MTU, DNS, transport, and BGP policy failures
- [ ] users diagnose with normal Builder inspectors/probes, not challenge-only shortcuts
- [ ] score evidence gathering and causal reasoning, not just the final repair
- [ ] reproducible challenge seeds and shareable scenarios

---

## Remaining regular tracks

These remain real product work. They should follow Track J unless a bounded dependency requires a different order.''', '''Captured evidence, application truth, causal replay, authoring, enterprise depth, data-plane realism, routing policy, provider overlays, native/public evidence correlation, and deterministic troubleshooting practice are now closed product tracks.

### Completed active track — Track J troubleshooting challenges

- [x] deterministic broken networks come from canonical Builder configuration/state rather than hand-authored answer text
- [x] catalog spans gateway/addressing, VLAN, trunk, STP, ARP/ND evidence, static/OSPF routing, ACL, NAT, DHCP, IPv6 PMTU, DNS, transport, and BGP import policy
- [x] diagnosis and repair use ordinary Builder probes, inspectors, Workbench, and canonical controls
- [x] scoring separates evidence, causal reasoning, exact repair, and objective verification
- [x] reproducible `HOP-J1` seeds preserve deterministic truth
- [x] bounded two-fault composition requires ordered hypotheses and proof that a second fault remains after one repair
- [x] challenge launch no longer auto-focuses mutated devices/links

`docs/TRACKJ.md` is the closeout architecture and validation record.

---

## Current priority order

### 1. Track K — vendor-neutral HOPSCOTCH CLI

Track K is now the highest-value regular product track. Its read-only command model already exists; the next slice should expose the actual Builder terminal surface before expanding protocol commands.

---

## Remaining regular tracks

These remain real product work. They should follow Track K unless a bounded dependency requires a different order.''')

print('Applied Track J bounded multi-fault composition and closeout.')
