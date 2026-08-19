import { readFileSync, writeFileSync } from 'node:fs';

function read(path) { return readFileSync(path, 'utf8'); }
function write(path, text) { writeFileSync(path, text); }
function replaceOnce(text, before, after, label) {
  const index = text.indexOf(before);
  if (index < 0) throw new Error(`Track A patch marker not found: ${label}`);
  if (text.indexOf(before, index + before.length) >= 0) throw new Error(`Track A patch marker ambiguous: ${label}`);
  return text.slice(0, index) + after + text.slice(index + before.length);
}

// Device Workbench: expose application history, causal categories, and append compact depth sections.
{
  const path = 'src/builder/device-workbench.ts';
  let text = read(path);
  text = replaceOnce(text,
    "import { builderOspfState, routeTableForBuilderRouter, type BuilderRouteTableEntry, type BuilderRoutingConfig } from './routing.ts';\n",
    "import { builderOspfState, routeTableForBuilderRouter, type BuilderRouteTableEntry, type BuilderRoutingConfig } from './routing.ts';\nimport type { BuilderApplicationTransaction } from './application.ts';\nimport { builderApplicationDiagnosisSection, builderProtocolDatabaseSection } from './workbench-depth.ts';\n",
    'device-workbench imports');
  text = replaceOnce(text,
    "export type BuilderWorkbenchEventCategory = 'session' | 'topology' | 'config' | 'routing' | 'policy' | 'neighbor' | 'switching' | 'nat' | 'dhcp' | 'probe' | 'ipv6';\nexport type BuilderWorkbenchEventKind = 'session' | 'action' | 'physical' | 'control-plane' | 'rib' | 'fib' | 'resolution' | 'forwarding' | 'policy' | 'translation' | 'flow';\n",
    "export type BuilderWorkbenchEventCategory = 'session' | 'topology' | 'config' | 'routing' | 'policy' | 'neighbor' | 'switching' | 'nat' | 'dhcp' | 'probe' | 'ipv6' | 'application';\nexport type BuilderWorkbenchEventKind = 'session' | 'action' | 'physical' | 'control-plane' | 'rib' | 'fib' | 'resolution' | 'forwarding' | 'policy' | 'translation' | 'transport' | 'application' | 'flow';\n",
    'device-workbench event unions');
  text = replaceOnce(text,
    "  dhcpRemoveLeaseIds?: string[];\n}\n",
    "  dhcpRemoveLeaseIds?: string[];\n  arpCache?: 'after';\n  ethernetFlow?: 'after';\n  natSessions?: 'after';\n  ipv6ControlState?: 'after';\n  ipv6LifecycleState?: 'after';\n  probeHistory?: 'after';\n  applicationHistory?: 'after';\n  applicationStageOrder?: number | null;\n}\n",
    'device-workbench projections');
  text = replaceOnce(text,
    "  probeHistory: BuilderProbeResult[];\n  sourceId: string;\n",
    "  probeHistory: BuilderProbeResult[];\n  applicationHistory: BuilderApplicationTransaction[];\n  applicationStageOrder: number | null;\n  sourceId: string;\n",
    'device-workbench input application state');
  text = replaceOnce(text,
    "  if(/^(PING|TRACEROUTE|PROBE)\\b/.test(text))return'probe';\n",
    "  if(/^(PING|TRACEROUTE|PROBE)\\b/.test(text))return'probe';\n  if(/^APPLICATION\\b/.test(text))return'application';\n",
    'application message classification');
  text = replaceOnce(text,
    "function causalCategory(category:BuilderWorkbenchEventCategory):boolean{return['routing','policy','neighbor','switching','nat','dhcp','probe','ipv6'].includes(category);}\n",
    "function causalCategory(category:BuilderWorkbenchEventCategory):boolean{return['routing','policy','neighbor','switching','nat','dhcp','probe','ipv6','application'].includes(category);}\n",
    'causal application category');
  text = replaceOnce(text,
    "  const stateSections=device.plane==='routed'?routedStateSections(input,device.id):ethernetStateSections(input,device.id);\n  return{device,configSections,stateSections,events:eventViews(input.events,device),configRowCount:configSections.reduce((sum,current)=>sum+current.rows.length,0),stateRowCount:stateSections.reduce((sum,current)=>sum+current.rows.length,0)};\n",
    "  const baseStateSections=device.plane==='routed'?routedStateSections(input,device.id):ethernetStateSections(input,device.id);\n  const depthSections=[builderProtocolDatabaseSection(input,device),builderApplicationDiagnosisSection(input,device)].filter((entry):entry is BuilderWorkbenchSection=>Boolean(entry));\n  const stateSections=[...baseStateSections,...depthSections];\n  return{device,configSections,stateSections,events:eventViews(input.events,device),configRowCount:configSections.reduce((sum,current)=>sum+current.rows.length,0),stateRowCount:stateSections.reduce((sum,current)=>sum+current.rows.length,0)};\n",
    'workbench depth sections');
  write(path, text);
}

// Timeline: runtime families and application stages become event-time state instead of leaking final state backward.
{
  const path = 'src/builder/timeline.ts';
  let text = read(path);
  text = replaceOnce(text,
    "  const stageDhcpSequence=uncaptured.some((event)=>event.projection?.dhcpSequence!==undefined);\n  let truthGraphs={controlGraph:beforeGraph,ribGraph:beforeGraph,fibGraph:beforeGraph};\n",
    "  const stageDhcpSequence=uncaptured.some((event)=>event.projection?.dhcpSequence!==undefined);\n  const stageArpCache=uncaptured.some((event)=>event.projection?.arpCache==='after');\n  const stageEthernetFlow=uncaptured.some((event)=>event.projection?.ethernetFlow==='after');\n  const stageNatSessions=uncaptured.some((event)=>event.projection?.natSessions==='after');\n  const stageIpv6ControlState=uncaptured.some((event)=>event.projection?.ipv6ControlState==='after');\n  const stageIpv6LifecycleState=uncaptured.some((event)=>event.projection?.ipv6LifecycleState==='after');\n  const stageProbeHistory=uncaptured.some((event)=>event.projection?.probeHistory==='after');\n  const stageApplicationHistory=uncaptured.some((event)=>event.projection?.applicationHistory==='after');\n  const stageApplicationOrder=uncaptured.some((event)=>event.projection?.applicationStageOrder!==undefined);\n  let truthGraphs={controlGraph:beforeGraph,ribGraph:beforeGraph,fibGraph:beforeGraph};\n",
    'timeline staging flags');
  text = replaceOnce(text,
    "    ...(stageDhcpSequence?{dhcpSequence:priorState!.dhcpSequence}:{}),\n  };\n",
    "    ...(stageDhcpSequence?{dhcpSequence:priorState!.dhcpSequence}:{}),\n    ...(stageArpCache?{arpCache:cloneValue(priorState!.arpCache)}:{}),\n    ...(stageEthernetFlow?{ethernetFlow:cloneValue(priorState!.ethernetFlow)}:{}),\n    ...(stageNatSessions?{natSessions:cloneValue(priorState!.natSessions)}:{}),\n    ...(stageIpv6ControlState?{ipv6ControlState:cloneValue(priorState!.ipv6ControlState)}:{}),\n    ...(stageIpv6LifecycleState?{ipv6LifecycleState:cloneValue(priorState!.ipv6LifecycleState)}:{}),\n    ...(stageProbeHistory?{probeHistory:cloneValue(priorState!.probeHistory)}:{}),\n    ...(stageApplicationHistory?{applicationHistory:cloneValue(priorState!.applicationHistory)}:{}),\n    ...(stageApplicationOrder?{applicationStageOrder:priorState!.applicationStageOrder}:{}),\n  };\n",
    'timeline prior runtime state');
  text = replaceOnce(text,
    "      const dhcpSequence=projection.dhcpSequence==='after'?finalState.dhcpSequence:(typeof projection.dhcpSequence==='number'?projection.dhcpSequence:state.dhcpSequence);\n      truthGraphs=nextTruth;\n      state={...state,graph,truthGraphs,dhcpLeases,dhcpSequence};\n",
    "      const dhcpSequence=projection.dhcpSequence==='after'?finalState.dhcpSequence:(typeof projection.dhcpSequence==='number'?projection.dhcpSequence:state.dhcpSequence);\n      truthGraphs=nextTruth;\n      state={\n        ...state,graph,truthGraphs,dhcpLeases,dhcpSequence,\n        ...(projection.arpCache==='after'?{arpCache:finalState.arpCache}:{}),\n        ...(projection.ethernetFlow==='after'?{ethernetFlow:finalState.ethernetFlow}:{}),\n        ...(projection.natSessions==='after'?{natSessions:finalState.natSessions}:{}),\n        ...(projection.ipv6ControlState==='after'?{ipv6ControlState:finalState.ipv6ControlState}:{}),\n        ...(projection.ipv6LifecycleState==='after'?{ipv6LifecycleState:finalState.ipv6LifecycleState}:{}),\n        ...(projection.probeHistory==='after'?{probeHistory:finalState.probeHistory}:{}),\n        ...(projection.applicationHistory==='after'?{applicationHistory:finalState.applicationHistory}:{}),\n        ...(projection.applicationStageOrder!==undefined?{applicationStageOrder:projection.applicationStageOrder}:{}),\n      };\n",
    'timeline runtime projections');
  write(path, text);
}

// Canonical event layer: stage runtime families at their event boundary and make Track D stages causal timeline events.
{
  const path = 'src/builder/canonical-events.ts';
  let text = read(path);
  text = replaceOnce(text,
    "function deriveArpEvents(before: BuilderTimelineState, after: BuilderTimelineState, output: BuilderWorkbenchEventSpec[]): void {\n",
    "function mergeProjection(output: BuilderWorkbenchEventSpec[], startIndex: number, projection: BuilderWorkbenchEventProjection): void {\n  const last=output.length>startIndex?output.length-1:-1;\n  if(last<0)return;\n  output[last]={...output[last],projection:{...(output[last].projection??{}),...projection}};\n}\n\nfunction deriveArpEvents(before: BuilderTimelineState, after: BuilderTimelineState, output: BuilderWorkbenchEventSpec[]): void {\n  const startIndex=output.length;\n",
    'canonical projection helper + arp start');
  text = replaceOnce(text,
    "  for (const [id, entry] of prior) {\n    if (next.has(id)) continue;\n    output.push(spec('arp:removed:' + id, 'resolution', 'neighbor', 'ARP ENTRY REMOVED · ' + entry.address, labelForEthernet(before, entry.ownerDeviceId) + ' no longer retains the mapping for ' + entry.address + '.', offset++, ethernetRefs(entry.ownerDeviceId), [entry.address]));\n  }\n}\n\nfunction deriveEthernetEvents",
    "  for (const [id, entry] of prior) {\n    if (next.has(id)) continue;\n    output.push(spec('arp:removed:' + id, 'resolution', 'neighbor', 'ARP ENTRY REMOVED · ' + entry.address, labelForEthernet(before, entry.ownerDeviceId) + ' no longer retains the mapping for ' + entry.address + '.', offset++, ethernetRefs(entry.ownerDeviceId), [entry.address]));\n  }\n  mergeProjection(output,startIndex,{arpCache:'after'});\n}\n\nfunction deriveEthernetEvents",
    'arp runtime projection');
  text = replaceOnce(text,
    "function deriveEthernetEvents(before: BuilderTimelineState, after: BuilderTimelineState, output: BuilderWorkbenchEventSpec[]): void {\n  const beforeFlow",
    "function deriveEthernetEvents(before: BuilderTimelineState, after: BuilderTimelineState, output: BuilderWorkbenchEventSpec[]): void {\n  const startIndex=output.length;\n  const beforeFlow",
    'ethernet start');
  text = replaceOnce(text,
    "  }\n}\n\nfunction deriveNatEvents(before: BuilderTimelineState, after: BuilderTimelineState, output: BuilderWorkbenchEventSpec[]): void {\n  const prior",
    "  }\n  mergeProjection(output,startIndex,{ethernetFlow:'after'});\n}\n\nfunction deriveNatEvents(before: BuilderTimelineState, after: BuilderTimelineState, output: BuilderWorkbenchEventSpec[]): void {\n  const startIndex=output.length;\n  const prior",
    'ethernet projection + nat start');
  text = replaceOnce(text,
    "  for (const [id, entry] of prior) {\n    if (next.has(id)) continue;\n    output.push(spec('nat:removed:' + id, 'translation', 'nat', 'NAT STATE REMOVED', entry.id + ' expired, was cleared, or was invalidated by configuration/topology change.', offset++, routedRefs(entry.routerId), [entry.id]));\n  }\n}\n\nfunction dhcpActionClientId",
    "  for (const [id, entry] of prior) {\n    if (next.has(id)) continue;\n    output.push(spec('nat:removed:' + id, 'translation', 'nat', 'NAT STATE REMOVED', entry.id + ' expired, was cleared, or was invalidated by configuration/topology change.', offset++, routedRefs(entry.routerId), [entry.id]));\n  }\n  mergeProjection(output,startIndex,{natSessions:'after'});\n}\n\nfunction dhcpActionClientId",
    'nat runtime projection');
  text = replaceOnce(text,
    "function deriveIpv6Events(before: BuilderTimelineState, after: BuilderTimelineState, output: BuilderWorkbenchEventSpec[]): void {\n  let offset = 160;\n",
    "function deriveIpv6Events(before: BuilderTimelineState, after: BuilderTimelineState, output: BuilderWorkbenchEventSpec[]): void {\n  const startIndex=output.length;\n  let offset = 160;\n",
    'ipv6 start');
  text = replaceOnce(text,
    "    output.push(spec('ipv6:prefix:' + entry.id + ':' + entry.status, 'control-plane', 'ipv6', 'RA PREFIX · ' + entry.status, entry.prefix + ' on ' + labelForRouted(after, entry.endpointId) + ' changed from ' + (old?.status ?? 'NONE') + ' to ' + entry.status + '.', offset++, routedRefs(entry.endpointId, entry.routerId), [entry.id, entry.linkId, entry.prefix]));\n  }\n}\n\nfunction deriveProbeEvents",
    "    output.push(spec('ipv6:prefix:' + entry.id + ':' + entry.status, 'control-plane', 'ipv6', 'RA PREFIX · ' + entry.status, entry.prefix + ' on ' + labelForRouted(after, entry.endpointId) + ' changed from ' + (old?.status ?? 'NONE') + ' to ' + entry.status + '.', offset++, routedRefs(entry.endpointId, entry.routerId), [entry.id, entry.linkId, entry.prefix]));\n  }\n  mergeProjection(output,startIndex,{ipv6ControlState:'after',ipv6LifecycleState:'after'});\n}\n\nfunction deriveProbeEvents",
    'ipv6 runtime projection');
  text = replaceOnce(text,
    "function deriveProbeEvents(before: BuilderTimelineState, after: BuilderTimelineState, output: BuilderWorkbenchEventSpec[]): void {\n  const priorIds",
    "function deriveProbeEvents(before: BuilderTimelineState, after: BuilderTimelineState, output: BuilderWorkbenchEventSpec[]): void {\n  const startIndex=output.length;\n  const priorIds",
    'probe start');
  text = replaceOnce(text,
    "      ));\n    }\n  }\n}\n\nexport function deriveBuilderCanonicalEventSpecs",
    "      ));\n    }\n  }\n  mergeProjection(output,startIndex,{probeHistory:'after'});\n}\n\nfunction applicationEventKind(stage: BuilderTimelineState['applicationHistory'][number]['stages'][number]): BuilderWorkbenchEventKind {\n  if(stage.boundary==='L2'||stage.boundary==='RESOLUTION')return'resolution';\n  if(stage.boundary==='ROUTING')return'fib';\n  if(stage.boundary==='POLICY_NAT')return'policy';\n  if(stage.boundary==='LINK')return'forwarding';\n  if(stage.boundary==='TRANSPORT')return'transport';\n  if(stage.boundary==='TLS'||stage.boundary==='APPLICATION')return'application';\n  if(stage.boundary==='RESPONSE')return'flow';\n  return'control-plane';\n}\n\nfunction deriveApplicationEvents(before: BuilderTimelineState, after: BuilderTimelineState, output: BuilderWorkbenchEventSpec[]): void {\n  const priorIds=new Set(before.applicationHistory.map((transaction)=>transaction.id));\n  const transactions=after.applicationHistory.filter((transaction)=>!priorIds.has(transaction.id));\n  let offset=260;\n  for(const transaction of transactions){\n    const evaluated=transaction.stages.filter((stage)=>stage.status!=='NOT_REACHED');\n    let previousKey:string|null=null;\n    for(let index=0;index<evaluated.length;index+=1){\n      const stage=evaluated[index];\n      const final=index===evaluated.length-1;\n      const key='application:'+transaction.id+':'+stage.id;\n      output.push(spec(\n        key,applicationEventKind(stage),'application',\n        'APPLICATION · '+stage.label+' · '+stage.status,\n        stage.summary+' · '+stage.detail,offset++,routedRefs(...stage.nodeIds),\n        [transaction.id,stage.id,...stage.linkIds],previousKey,\n        { ...(index===0?{applicationHistory:'after' as const}:{}), applicationStageOrder:final?null:stage.order },\n      ));\n      previousKey=key;\n    }\n  }\n}\n\nexport function deriveBuilderCanonicalEventSpecs",
    'application event derivation');
  text = replaceOnce(text,
    "  deriveProbeEvents(before, after, output);\n\n  const unique",
    "  deriveProbeEvents(before, after, output);\n  deriveApplicationEvents(before, after, output);\n\n  const unique",
    'application derive call');
  write(path, text);
}

// Lazy Track D surface hands completed canonical transactions back to Builder; the diagnosis is a compact extra camera, not another simulator.
{
  const path = 'src/BuilderApplicationPanel.tsx';
  let text = read(path);
  text = replaceOnce(text,
    "import type { BuilderApplicationContext } from './builder/application.ts';\n",
    "import type { BuilderApplicationContext, BuilderApplicationTransaction } from './builder/application.ts';\n",
    'panel transaction import');
  text = replaceOnce(text,
    "  onSessionState: (state: { arpCache: BuilderArpCache; natSessions: BuilderNatSessionTable; dhcpLeases: BuilderDhcpLeaseTable; ipv6ControlState: BuilderIpv6ControlState }) => void;\n  onMessage: (message: string) => void;\n",
    "  onSessionState: (state: { arpCache: BuilderArpCache; natSessions: BuilderNatSessionTable; dhcpLeases: BuilderDhcpLeaseTable; ipv6ControlState: BuilderIpv6ControlState }) => void;\n  onTransaction: (transaction: BuilderApplicationTransaction) => void;\n  onMessage: (message: string) => void;\n",
    'panel transaction callback');
  write(path, text);
}

{
  const path = 'src/BuilderApplicationWorkspace.tsx';
  let text = read(path);
  text = replaceOnce(text,
    "} from './builder/application.ts';\nimport type { BuilderApplicationPanelProps }",
    "} from './builder/application.ts';\nimport { diagnoseBuilderApplicationTransaction } from './builder/causal-diagnosis.ts';\nimport type { BuilderApplicationPanelProps }",
    'workspace diagnosis import');
  text = replaceOnce(text,
    "export function BuilderApplicationWorkspace({ context, sourceNodeId, historical, onSessionState, onMessage }: BuilderApplicationPanelProps) {\n",
    "export function BuilderApplicationWorkspace({ context, sourceNodeId, historical, onSessionState, onTransaction, onMessage }: BuilderApplicationPanelProps) {\n",
    'workspace props');
  text = replaceOnce(text,
    "  const selectedPacket = transaction?.packets.find((packet) => packet.id === packetId) ?? null;\n\n  const run = () => {\n",
    "  const selectedPacket = transaction?.packets.find((packet) => packet.id === packetId) ?? null;\n  const diagnosis = useMemo(() => transaction ? diagnoseBuilderApplicationTransaction(transaction, context.graph) : null, [transaction, context.graph]);\n\n  const run = () => {\n",
    'workspace diagnosis memo');
  text = replaceOnce(text,
    "      onSessionState({ arpCache: result.arpCache, natSessions: result.natSessions, dhcpLeases: result.dhcpLeases, ipv6ControlState: result.ipv6ControlState });\n      onMessage(`APPLICATION · ${result.summary}`);\n",
    "      onSessionState({ arpCache: result.arpCache, natSessions: result.natSessions, dhcpLeases: result.dhcpLeases, ipv6ControlState: result.ipv6ControlState });\n      onTransaction(result);\n      onMessage(`APPLICATION · ${result.summary}`);\n",
    'workspace callback');
  text = replaceOnce(text,
    "        <nav className=\"builder-app-cameras\" aria-label=\"Application transaction cameras\">",
    "        {diagnosis&&<div className={`builder-app-diagnosis ${diagnosis.firstBrokenDimension?'failed':'passed'}`}><span>TRACK A · CAUSAL DIAGNOSIS</span><strong>{diagnosis.summary}</strong><p>{diagnosis.dimensions.map((entry)=>`${entry.id} ${entry.status}`).join(' · ')}</p><small>FIRST BROKEN BOUNDARY IS DERIVED FROM THE SHARED TRACK D TRANSACTION · NOT_REACHED NEVER COUNTS AS FAILURE.</small></div>}\n        <nav className=\"builder-app-cameras\" aria-label=\"Application transaction cameras\">",
    'workspace diagnosis UI');
  write(path, text);
}

{
  const path = 'src/BuilderApplicationPanel.css';
  let text = read(path);
  text += `\n.builder-app-diagnosis{border:1px solid color-mix(in srgb,var(--ink) 16%,transparent);padding:12px 14px;display:grid;gap:5px;background:color-mix(in srgb,var(--surface) 92%,transparent)}\n.builder-app-diagnosis>span,.builder-app-diagnosis>small{font-size:10px;letter-spacing:.09em;text-transform:uppercase;opacity:.68}\n.builder-app-diagnosis>strong{font-size:13px;letter-spacing:.035em}\n.builder-app-diagnosis>p{margin:0;font:600 10px/1.55 var(--mono,monospace);overflow-wrap:anywhere}\n.builder-app-diagnosis.failed{border-color:color-mix(in srgb,#b94a3c 48%,transparent)}\n`;
  write(path, text);
}

// Builder owns a bounded session history of canonical application transactions and feeds it into the same timeline/workbench snapshot.
{
  const path = 'src/NetworkBuilder.tsx';
  let text = read(path);
  text = replaceOnce(text,
    "import { BuilderApplicationPanel } from './BuilderApplicationPanel.tsx';\n",
    "import { BuilderApplicationPanel } from './BuilderApplicationPanel.tsx';\nimport type { BuilderApplicationTransaction } from './builder/application.ts';\n",
    'builder app transaction import');
  text = replaceOnce(text,
    "  const [probeHistory, setProbeHistory] = useState<BuilderProbeResult[]>([]);\n",
    "  const [probeHistory, setProbeHistory] = useState<BuilderProbeResult[]>([]);\n  const [applicationHistory, setApplicationHistory] = useState<BuilderApplicationTransaction[]>([]);\n",
    'builder app history state');
  text = replaceOnce(text,
    "  const liveWorkbenchInput = useMemo<BuilderDeviceWorkbenchInput>(() => ({ graph, addressing, routing, ipv6, ipv6ControlState, ipv6RoutingDepth, ethernet, ethernetFlow, arpCache, arpResolutions, acl, nat, natSessions, dhcp, dhcpLeases, dhcpSequence, probeHistory, sourceId, destinationId, events: workbenchEvents }), [graph, addressing, routing, ipv6, ipv6ControlState, ipv6RoutingDepth, ethernet, ethernetFlow, arpCache, arpResolutions, acl, nat, natSessions, dhcp, dhcpLeases, dhcpSequence, probeHistory, sourceId, destinationId, workbenchEvents]);\n",
    "  const liveWorkbenchInput = useMemo<BuilderDeviceWorkbenchInput>(() => ({ graph, addressing, routing, ipv6, ipv6ControlState, ipv6RoutingDepth, ethernet, ethernetFlow, arpCache, arpResolutions, acl, nat, natSessions, dhcp, dhcpLeases, dhcpSequence, probeHistory, applicationHistory, applicationStageOrder:null, sourceId, destinationId, events: workbenchEvents }), [graph, addressing, routing, ipv6, ipv6ControlState, ipv6RoutingDepth, ethernet, ethernetFlow, arpCache, arpResolutions, acl, nat, natSessions, dhcp, dhcpLeases, dhcpSequence, probeHistory, applicationHistory, sourceId, destinationId, workbenchEvents]);\n",
    'builder live workbench app history');
  text = replaceOnce(text,
    "            onSessionState={(next)=>{ setArpCache(next.arpCache); setNatSessions(next.natSessions); setDhcpLeases(next.dhcpLeases); setIpv6ControlState(next.ipv6ControlState); }}\n            onMessage={setMessage}\n",
    "            onSessionState={(next)=>{ setArpCache(next.arpCache); setNatSessions(next.natSessions); setDhcpLeases(next.dhcpLeases); setIpv6ControlState(next.ipv6ControlState); }}\n            onTransaction={(transaction)=>setApplicationHistory((current)=>[...current,transaction].slice(-24))}\n            onMessage={setMessage}\n",
    'builder application callback');
  write(path, text);
}

// Permanent contract registration.
{
  const path = 'package.json';
  const pkg = JSON.parse(read(path));
  pkg.scripts['test:builder-causal-diagnosis-contract'] = 'node scripts/builder-causal-diagnosis-contract-check.mjs';
  pkg.scripts.check = pkg.scripts.check.replace('npm run test:builder-application-contract &&', 'npm run test:builder-application-contract && npm run test:builder-causal-diagnosis-contract &&');
  write(path, JSON.stringify(pkg, null, 2) + '\n');
}

console.log('Track A closeout integration patch applied.');
