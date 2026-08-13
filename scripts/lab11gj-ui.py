from pathlib import Path

p=Path('src/NetworkBuilder.tsx')
t=p.read_text()

# Imports for the new truth layers.
anchor="import { cloneBuilderEthernetConfig, createDefaultBuilderEthernetConfig, createEmptyBuilderEthernetConfig, parseBuilderAllowedVlans, runBuilderEthernetFlow, updateBuilderEthernetLink, type BuilderEthernetConfig, type BuilderEthernetFlowResult } from './builder/ethernet.ts';\n"
addition=anchor+"import { cloneBuilderLinkProfiles, createDefaultBuilderLinkProfiles, reconcileBuilderLinkProfiles, updateBuilderLinkProfile, type BuilderLinkProfiles } from './builder/link-characteristics.ts';\nimport { cloneBuilderAclConfig, createDefaultBuilderAclConfig, deleteBuilderAclRule, reconcileBuilderAclConfig, traceBuilderPolicy, upsertBuilderAclRule, type BuilderAclAction, type BuilderAclConfig, type BuilderAclProtocol } from './builder/acl.ts';\nimport { clearBuilderArpCache, resolveBuilderEthernetFlowArp, type BuilderArpCache, type BuilderArpResolution } from './builder/arp.ts';\nimport { builderStpState } from './builder/stp.ts';\n"
if "./builder/link-characteristics.ts" not in t:
    t=t.replace(anchor,addition)

# New persistent/session state after Ethernet config.
anchor="  const [ethernet, setEthernet] = useState<BuilderEthernetConfig>(() => cloneBuilderEthernetConfig(initialEthernet ?? (stressLabel ? createEmptyBuilderEthernetConfig() : createDefaultBuilderEthernetConfig())));\n"
addition=anchor+"  const [linkProfiles, setLinkProfiles] = useState<BuilderLinkProfiles>(() => createDefaultBuilderLinkProfiles(initialGraph));\n  const [acl, setAcl] = useState<BuilderAclConfig>(() => createDefaultBuilderAclConfig());\n"
t=t.replace(anchor,addition)
anchor="  const [ethernetFlow, setEthernetFlow] = useState<BuilderEthernetFlowResult | null>(null);\n"
addition=anchor+"  const [arpCache, setArpCache] = useState<BuilderArpCache>([]);\n  const [arpResolutions, setArpResolutions] = useState<BuilderArpResolution[]>([]);\n  const [aclOrder, setAclOrder] = useState(10);\n  const [aclAction, setAclAction] = useState<BuilderAclAction>('deny');\n  const [aclProtocol, setAclProtocol] = useState<BuilderAclProtocol>('icmp');\n  const [aclSourcePrefix, setAclSourcePrefix] = useState('0.0.0.0/0');\n  const [aclDestinationPrefix, setAclDestinationPrefix] = useState('0.0.0.0/0');\n  const [aclDestinationPort, setAclDestinationPort] = useState('');\n  const [aclDescription, setAclDescription] = useState('Block diagnostic ICMP');\n"
t=t.replace(anchor,addition)

# Derived state.
anchor="  const selectedLink = graph.links.find((link) => link.id === selectedLinkId) ?? graph.links[0];\n"
addition=anchor+"  const selectedLinkProfile = selectedLink ? linkProfiles[selectedLink.id] : undefined;\n"
t=t.replace(anchor,addition)
anchor="  const forwardingTrace = useMemo(() => traceBuilderForwarding(graph, addressing, routing, sourceId, destinationId), [graph, addressing, routing, sourceId, destinationId]);\n"
addition=anchor+"  const policyTrace = useMemo(() => traceBuilderPolicy(graph, addressing, routing, acl, sourceId, destinationId, 'icmp'), [graph, addressing, routing, acl, sourceId, destinationId]);\n"
t=t.replace(anchor,addition)
anchor="  const selectedEthernetLink = ethernet.links.find((link) => link.id === selectedEthernetLinkId) ?? ethernet.links[0];\n  const ethernetFlowLinks = new Set(ethernetFlow?.segments.flatMap((segment) => segment.linkIds) ?? []);\n"
addition=anchor+"  const ethernetSourceDevice = ethernet.devices.find((device) => device.id === ethernetSourceId);\n  const ethernetSourceVlan = ethernetSourceDevice?.interfaces[0]?.vlanId ?? ethernet.vlans[0]?.id ?? 1;\n  const stpState = useMemo(() => builderStpState(ethernet, ethernetSourceVlan), [ethernet, ethernetSourceVlan]);\n  const stpBlockedLinks = new Set(stpState.blockedLinkIds);\n  const selectedRouterAclRules = selectedNode?.kind === 'router' ? acl.rules.filter((rule) => rule.routerId === selectedNode.id).sort((a,b)=>a.order-b.order||a.id.localeCompare(b.id)) : [];\n"
t=t.replace(anchor,addition)

# Ethernet reset and run now include ARP state.
t=t.replace("    const next = createDefaultBuilderEthernetConfig(); setEthernet(next); setEthernetSourceId('lan-a'); setEthernetDestinationId('lan-b'); setSelectedEthernetLinkId(next.links[0]?.id ?? ''); setEthernetFlow(null); setMessage('LAN FABRIC RESET · access VLANs, trunk allow-lists, and router-on-a-stick interfaces restored.');", "    const next = createDefaultBuilderEthernetConfig(); setEthernet(next); setEthernetSourceId('lan-a'); setEthernetDestinationId('lan-b'); setSelectedEthernetLinkId(next.links[0]?.id ?? ''); setEthernetFlow(null); setArpCache(clearBuilderArpCache()); setArpResolutions([]); setMessage('LAN FABRIC RESET · VLANs, STP, ARP cache, trunks, and router-on-a-stick interfaces restored.');")
t=t.replace("  const runEthernet = () => { const result = runBuilderEthernetFlow(ethernet,ethernetSourceId,ethernetDestinationId); setEthernetFlow(result); setMessage(`LAN FABRIC · ${result.summary}`); };", "  const runEthernet = () => { const arp=resolveBuilderEthernetFlowArp(ethernet,ethernetSourceId,ethernetDestinationId,arpCache); setArpCache(arp.cache); setArpResolutions(arp.resolutions); if(!arp.success){setEthernetFlow(null);setMessage(`ARP FAILED · ${arp.failureReason ?? 'Address resolution failed.'}`);return;} const result = runBuilderEthernetFlow(ethernet,ethernetSourceId,ethernetDestinationId); setEthernetFlow(result); setMessage(`LAN FABRIC · ${arp.resolutions.map((entry)=>entry.cacheHit?'ARP CACHE HIT':'ARP RESOLVED').join(' + ')} · ${result.summary}`); };")
t=t.replace("setEthernetFlow(null);setMessage(`LAN PORT", "setEthernetFlow(null);setArpResolutions([]);setMessage(`LAN PORT")

# Probes consume link characteristics and ACL policy.
t=t.replace("runBuilderProbe(graph, addressing, routing, kind, sourceId, destinationId, probeHistory.length + 1)", "runBuilderProbe(graph, addressing, routing, kind, sourceId, destinationId, probeHistory.length + 1, linkProfiles, acl)")

# Graph edits reconcile new persisted truth layers.
anchor="    setRouting(nextRouting);\n"
addition=anchor+"    setLinkProfiles(reconcileBuilderLinkProfiles(next, linkProfiles));\n    setAcl(reconcileBuilderAclConfig(next, acl));\n"
t=t.replace(anchor,addition,1)

# Helpers for profile + ACL editing.
marker="  const setSelectedOspf = (enabled: boolean) => {\n"
helper="""  const patchSelectedLinkProfile = (patch: Parameters<typeof updateBuilderLinkProfile>[3]) => {
    if (!selectedLink) return;
    try { setLinkProfiles(updateBuilderLinkProfile(graph,linkProfiles,selectedLink.id,patch)); setMessage(`LINK CHARACTERISTICS · ${labelFor(graph,selectedLink.a)} ↔ ${labelFor(graph,selectedLink.b)} updated. Routing cost remains ${selectedLink.cost}.`); }
    catch(error){ setMessage(`LINK PROFILE REJECTED · ${error instanceof Error?error.message:'Invalid link characteristic.'}`); }
  };

  const addAclRule = () => {
    if (!selectedNode || selectedNode.kind !== 'router') { setMessage('Select a router before adding an ACL rule.'); return; }
    try {
      const port=aclDestinationPort.trim()===''?null:Number(aclDestinationPort);
      const next=upsertBuilderAclRule(graph,acl,{routerId:selectedNode.id,order:aclOrder,action:aclAction,protocol:aclProtocol,sourcePrefix:aclSourcePrefix,destinationPrefix:aclDestinationPrefix,destinationPort:port,description:aclDescription});
      setAcl(next); setMessage(`ACL · ${selectedNode.label} rule ${aclOrder} ${aclAction.toUpperCase()} ${aclProtocol.toUpperCase()} installed. Route truth is unchanged.`);
    } catch(error){ setMessage(`ACL REJECTED · ${error instanceof Error?error.message:'Invalid ACL rule.'}`); }
  };

  const clearArp = () => { setArpCache(clearBuilderArpCache()); setArpResolutions([]); setMessage('ARP CACHE CLEARED · rerun the LAN flow to force address resolution.'); };

"""
if helper.strip() not in t:
    t=t.replace(marker,helper+marker)

# Resets and scenarios.
t=t.replace("setEthernet(cloneBuilderEthernetConfig(initialEthernet ?? createDefaultBuilderEthernetConfig())); setEthernetFlow(null);", "setEthernet(cloneBuilderEthernetConfig(initialEthernet ?? createDefaultBuilderEthernetConfig())); setEthernetFlow(null); setLinkProfiles(createDefaultBuilderLinkProfiles(initialGraph)); setAcl(createDefaultBuilderAclConfig()); setArpCache(clearBuilderArpCache()); setArpResolutions([]);")
t=t.replace("createBuilderScenario(scenarioName.trim() || 'Untitled topology', graph, sourceId, destinationId, layout, addressing, routing, existing, ethernet)", "createBuilderScenario(scenarioName.trim() || 'Untitled topology', graph, sourceId, destinationId, layout, addressing, routing, existing, ethernet, linkProfiles, acl)")
t=t.replace("Saved “${scenario.name}” locally as Builder schema v6.", "Saved “${scenario.name}” locally as Builder schema v7.")
t=t.replace("setGraph(cloneBuilderGraph(scenario.graph)); setAddressing(cloneBuilderAddressing(scenario.addressing)); setRouting(cloneBuilderRoutingConfig(scenario.routing)); setEthernet(cloneBuilderEthernetConfig(scenario.ethernet));", "setGraph(cloneBuilderGraph(scenario.graph)); setAddressing(cloneBuilderAddressing(scenario.addressing)); setRouting(cloneBuilderRoutingConfig(scenario.routing)); setEthernet(cloneBuilderEthernetConfig(scenario.ethernet)); setLinkProfiles(cloneBuilderLinkProfiles(scenario.linkProfiles)); setAcl(cloneBuilderAclConfig(scenario.acl)); setArpCache(clearBuilderArpCache()); setArpResolutions([]);")
t=t.replace("createBuilderScenario(scenarioName.trim() || 'Exported topology', graph, sourceId, destinationId, layout, addressing, routing, undefined, ethernet)", "createBuilderScenario(scenarioName.trim() || 'Exported topology', graph, sourceId, destinationId, layout, addressing, routing, undefined, ethernet, linkProfiles, acl)")
t=t.replace("Scenario v6 exported with routed topology plus Ethernet/VLAN configuration; derived probe/FDB observations remain session-only.", "Scenario v7 exported with routed topology, physical link characteristics, ACL policy, and Ethernet/STP configuration; ARP/probe/FDB observations remain session-only.")
t=t.replace("SCHEMA V6 · ROUTED + LAN", "SCHEMA V7 · ROUTED + LAN + POLICY")

# Stage: policy truth and richer probe metrics.
forwarding="<div className={`builder-forwarding ${forwardingTrace.reachable ? '' : 'unreachable'}`}><span>L3 FORWARDING · {forwardingTrace.destinationAddress ?? 'NO DESTINATION IP'}</span><strong>{forwardingTrace.reachable ? [sourceId,...forwardingTrace.hops.map((hop)=>hop.nextNodeId).filter((id): id is string=>Boolean(id))].filter((id,index,all)=>index===0||id!==all[index-1]).map((id)=>labelFor(graph,id)).join(' → ') : `${forwardingTrace.failureNodeId ? labelFor(graph,forwardingTrace.failureNodeId) : 'FORWARDING'} · ${forwardingTrace.failureReason ?? 'NO ROUTE'}`}</strong><p>{forwardingTrace.explanation}</p>{forwardingTrace.hops.length>0&&<div className=\"builder-forwarding-hops\">{forwardingTrace.hops.map((hop,index)=><span key={`${hop.nodeId}-${index}`}><b>{hop.nodeLabel}</b>{hop.routeSource.toUpperCase()} · {hop.matchedPrefix ?? '—'} · {hop.nextHop ?? 'LOCAL'} · {hop.outgoingInterface ?? '—'}</span>)}</div>}</div>"
policy=forwarding+"\n          <div className={`builder-policy-panel ${policyTrace.forwarding.reachable && !policyTrace.permitted ? 'denied' : ''}`}><span>ROUTED POLICY · ICMP</span><strong>{!policyTrace.forwarding.reachable ? 'NOT EVALUATED · NO FORWARDING PATH' : policyTrace.permitted ? 'PERMITTED' : `DENIED · ${policyTrace.deniedAtRouterId ? labelFor(graph,policyTrace.deniedAtRouterId) : 'DEFAULT'}`}</strong><p>{policyTrace.explanation}</p></div>"
t=t.replace(forwarding,policy)
old="<strong>{selectedProbe.kind.toUpperCase()} · TTL {selectedAttempt.ttl} · {selectedAttempt.status.replace('-', ' ').toUpperCase()}</strong><p>{selectedAttempt.detail}</p><div className=\"builder-probe-path\">"
new="<strong>{selectedProbe.kind.toUpperCase()} · TTL {selectedAttempt.ttl} · {selectedAttempt.status.replace('-', ' ').toUpperCase()}</strong><p>{selectedAttempt.detail}</p><div className=\"builder-probe-metrics\"><span><b>{selectedAttempt.simulatedRttMs ?? '—'}</b>RTT MS</span><span><b>{selectedAttempt.jitterMs}</b>JITTER MS</span><span><b>{selectedAttempt.bottleneckMbps ?? '—'}</b>BOTTLENECK Mb/s</span><span><b>{selectedAttempt.pathMtuBytes ?? '—'}</b>PATH MTU</span><span><b>{selectedAttempt.pathLossPercent.toFixed(2)}%</b>PATH LOSS</span></div><div className=\"builder-probe-path\">"
t=t.replace(old,new)
t=t.replace("ROUTING COST ≠ RTT.", "RTT COMES FROM LINK LATENCY · ROUTING COST REMAINS A SEPARATE CONTROL-PLANE METRIC.")

# LAN canvas + ARP/STP status.
t=t.replace("className={`${link.failed?'failed':''} ${ethernetFlowLinks.has(link.id)?'flow':''}`}", "className={`${link.failed?'failed':''} ${stpBlockedLinks.has(link.id)?'stp-blocked':''} ${ethernetFlowLinks.has(link.id)?'flow':''}`}")
t=t.replace("{ethernetFlow&&<div className=\"builder-lan-phases\">", "<div className=\"builder-lan-truth\"><span><b>STP</b>{stpState.enabled ? `${stpState.rootBridgeLabel ?? '—'} ROOT · ${stpState.blockedLinkIds.length} BLOCKED` : stpState.loopDetected ? 'DISABLED · LOOP UNSAFE' : 'DISABLED · NO CYCLE'}</span><span><b>ARP CACHE</b>{arpCache.length} ENTRIES</span></div>{arpResolutions.length>0&&<div className=\"builder-arp-events\">{arpResolutions.map((entry,index)=><span key={`${entry.ownerDeviceId}-${entry.targetAddress}-${index}`} className={entry.success?'':'failed'}><b>{entry.cacheHit?'ARP CACHE HIT':entry.success?'ARP REQUEST → REPLY':'ARP FAILED'} · VLAN {entry.vlanId}</b>{entry.summary}</span>)}</div>}{ethernetFlow&&<div className=\"builder-lan-phases\">")
t=t.replace("FDB IS DERIVED PER FLOW · SAME-VLAN TTL 64 → 64 · INTER-VLAN TTL 64 → 63 · ARP/STP ARE NOT FABRICATED", "ARP CACHE IS SESSION-ONLY · STP BLOCKS REDUNDANT SWITCH LINKS · SAME-VLAN TTL 64 → 64 · INTER-VLAN TTL 64 → 63")

# LAN controls: STP and ARP actions.
needle="<div className=\"button-row\"><button type=\"button\" onClick={runEthernet}>SEND FRAME / PACKET</button><button type=\"button\" onClick={resetEthernetDemo}>RESET LAN</button></div>"
replacement=needle+"<div className=\"button-row\"><button type=\"button\" onClick={()=>{setEthernet({...ethernet,stp:{...ethernet.stp,enabled:!ethernet.stp.enabled}});setEthernetFlow(null);setArpResolutions([]);setMessage(`STP ${ethernet.stp.enabled?'DISABLED':'ENABLED'} · VLAN loop safety recomputed.`);}}>{ethernet.stp.enabled?'DISABLE STP':'ENABLE STP'}</button><button type=\"button\" onClick={clearArp}>CLEAR ARP</button></div><small className=\"builder-routing-note\">STP · VLAN {ethernetSourceVlan} · ROOT {stpState.rootBridgeLabel ?? '—'} · {stpState.blockedLinkIds.length} BLOCKED · {stpState.loopDetected?'REDUNDANCY PRESENT':'TREE ONLY'}</small>"
t=t.replace(needle,replacement)

# Selected routed link: cost + explicit physical characteristics.
needle="{selectedLink && <><label>COST<input type=\"number\" min={1} max={999} value={selectedLink.cost} onChange={(e)=>updateLink(selectedLink.id,{cost:Math.max(1,Math.min(999,Math.round(Number(e.currentTarget.value)||1)))})}/></label><div className=\"button-row\"><button type=\"button\" onClick={()=>updateLink(selectedLink.id,{failed:!selectedLink.failed})}>{selectedLink.failed?'RESTORE':'FAIL LINK'}</button><button type=\"button\" onClick={()=>deleteLink(selectedLink.id)}>DELETE</button></div></>}"
replacement="{selectedLink && <><label>ROUTING COST<input type=\"number\" min={1} max={999} value={selectedLink.cost} onChange={(e)=>updateLink(selectedLink.id,{cost:Math.max(1,Math.min(999,Math.round(Number(e.currentTarget.value)||1)))})}/></label>{selectedLinkProfile&&<div className=\"builder-link-profile-grid\"><label>LATENCY MS<input type=\"number\" min={0} max={5000} value={selectedLinkProfile.latencyMs} onChange={(e)=>patchSelectedLinkProfile({latencyMs:Number(e.currentTarget.value)})}/></label><label>JITTER MS<input type=\"number\" min={0} max={2000} value={selectedLinkProfile.jitterMs} onChange={(e)=>patchSelectedLinkProfile({jitterMs:Number(e.currentTarget.value)})}/></label><label>BANDWIDTH Mb/s<input type=\"number\" min={1} value={selectedLinkProfile.bandwidthMbps} onChange={(e)=>patchSelectedLinkProfile({bandwidthMbps:Number(e.currentTarget.value)})}/></label><label>LOSS %<input type=\"number\" min={0} max={100} step={0.1} value={selectedLinkProfile.lossPercent} onChange={(e)=>patchSelectedLinkProfile({lossPercent:Number(e.currentTarget.value)})}/></label><label>MTU BYTES<input type=\"number\" min={68} max={9216} value={selectedLinkProfile.mtuBytes} onChange={(e)=>patchSelectedLinkProfile({mtuBytes:Math.round(Number(e.currentTarget.value))})}/></label><label>QUEUE PKTS<input type=\"number\" min={1} value={selectedLinkProfile.queuePackets} onChange={(e)=>patchSelectedLinkProfile({queuePackets:Math.round(Number(e.currentTarget.value))})}/></label></div>}<small className=\"builder-routing-note\">ROUTING COST DRIVES SPF. LATENCY / JITTER / BANDWIDTH / LOSS / MTU / QUEUE DRIVE PACKET OBSERVATION.</small><div className=\"button-row\"><button type=\"button\" onClick={()=>updateLink(selectedLink.id,{failed:!selectedLink.failed})}>{selectedLink.failed?'RESTORE':'FAIL LINK'}</button><button type=\"button\" onClick={()=>deleteLink(selectedLink.id)}>DELETE</button></div></>}"
t=t.replace(needle,replacement)

# ACL panel before routing table.
marker="          <section className=\"builder-routing-section\"><div className=\"control-title\"><span>ROUTE TABLE</span>"
acl_section="""          <section className="builder-acl-section"><div className="control-title"><span>ACL / FIREWALL POLICY</span><strong>{selectedNode?.kind==='router'?`${selectedRouterAclRules.length} RULES`:'ROUTERS ONLY'}</strong></div>{selectedNode?.kind==='router'?<><div className="builder-acl-rules">{selectedRouterAclRules.length===0?<small>NO EXPLICIT RULES · DEFAULT {acl.defaultAction.toUpperCase()}</small>:selectedRouterAclRules.map((rule)=><div key={rule.id} className={rule.action}><span>{rule.order}</span><strong>{rule.action.toUpperCase()} {rule.protocol.toUpperCase()}</strong><small>{rule.sourcePrefix} → {rule.destinationPrefix}{rule.destinationPort?` · DPORT ${rule.destinationPort}`:''} · {rule.description||rule.id}</small><button type="button" onClick={()=>{setAcl(deleteBuilderAclRule(graph,acl,rule.id));setMessage(`ACL · ${rule.id} removed.`);}}>×</button></div>)}</div><div className="builder-acl-form"><label>ORDER<input type="number" min={1} max={65535} value={aclOrder} onChange={(e)=>setAclOrder(Math.max(1,Math.min(65535,Math.round(Number(e.currentTarget.value)||1))))}/></label><label>ACTION<select value={aclAction} onChange={(e)=>setAclAction(e.currentTarget.value as BuilderAclAction)}><option value="deny">DENY</option><option value="permit">PERMIT</option></select></label><label>PROTOCOL<select value={aclProtocol} onChange={(e)=>{const value=e.currentTarget.value as BuilderAclProtocol;setAclProtocol(value);if(value!=='tcp'&&value!=='udp')setAclDestinationPort('');}}><option value="ip">IP</option><option value="icmp">ICMP</option><option value="tcp">TCP</option><option value="udp">UDP</option></select></label><label>SOURCE PREFIX<input value={aclSourcePrefix} onChange={(e)=>setAclSourcePrefix(e.currentTarget.value)}/></label><label>DEST PREFIX<input value={aclDestinationPrefix} onChange={(e)=>setAclDestinationPrefix(e.currentTarget.value)}/></label><label>DST PORT<input disabled={aclProtocol!=='tcp'&&aclProtocol!=='udp'} value={aclDestinationPort} placeholder="ANY" onChange={(e)=>setAclDestinationPort(e.currentTarget.value)}/></label><label>DESCRIPTION<input value={aclDescription} maxLength={80} onChange={(e)=>setAclDescription(e.currentTarget.value)}/></label><button type="button" onClick={addAclRule}>ADD ACL RULE</button></div><small className="builder-routing-note">FIRST MATCH WINS · ROUTING CAN BE REACHABLE WHILE POLICY DENIES THE PACKET · PING/TRACEROUTE EVALUATE REVERSE ICMP POLICY INDEPENDENTLY.</small></>:<small className="builder-routing-note">Select a router to author ordered IPv4 policy.</small>}</section>
"""
if 'builder-acl-section' not in t:
    t=t.replace(marker,acl_section+marker)

# Copy cleanup.
t=t.replace("Topology, addressing, static routing, and OSPF configuration reset.", "Topology, addressing, routing, OSPF, link characteristics, ACL policy, and ARP session state reset.")
t=t.replace("Restored “${scenario.name}”. Route recomputed from graph truth.", "Restored “${scenario.name}”. Routing, link characteristics, ACL, VLAN, and STP configuration restored; session ARP/probe state cleared.")

p.write_text(t)

# CSS: compact, semantic surfaces; no animation truth.
p=Path('src/NetworkBuilder.css')
css=p.read_text()
extra=r'''

/* Labs 11G-J: ARP, STP, physical link characteristics, and routed policy. */
.builder-policy-panel{border-top:1px solid var(--line);padding:12px 14px;display:grid;gap:4px}.builder-policy-panel>span,.builder-lan-truth b{font:700 10px/1.2 var(--mono);letter-spacing:.08em;color:var(--muted)}.builder-policy-panel>strong{font:750 13px/1.3 var(--mono)}.builder-policy-panel.denied>strong{color:var(--danger)}.builder-policy-panel p{margin:0;color:var(--muted);font-size:12px;line-height:1.45}
.builder-probe-metrics{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px;margin:8px 0}.builder-probe-metrics span{border:1px solid var(--line);padding:7px;min-width:0;font:650 9px/1.3 var(--mono);color:var(--muted)}.builder-probe-metrics b{display:block;color:var(--ink);font-size:12px;overflow:hidden;text-overflow:ellipsis}
.builder-lan-canvas g.stp-blocked line{stroke-dasharray:2.5 2.5;opacity:.38}.builder-lan-canvas g.stp-blocked text{opacity:.55}.builder-lan-truth{display:flex;flex-wrap:wrap;gap:7px;margin-top:8px}.builder-lan-truth span{border:1px solid var(--line);padding:6px 8px;font:650 10px/1.25 var(--mono)}.builder-lan-truth b{margin-right:6px}.builder-arp-events{display:grid;gap:5px;margin-top:8px}.builder-arp-events span{padding:7px 9px;border-left:2px solid var(--accent);background:color-mix(in srgb,var(--accent) 5%,transparent);font-size:11px;line-height:1.4}.builder-arp-events span.failed{border-color:var(--danger)}.builder-arp-events b{display:block;font:700 9px/1.2 var(--mono);letter-spacing:.05em;margin-bottom:2px}
.builder-link-profile-grid,.builder-acl-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.builder-link-profile-grid label,.builder-acl-form label{min-width:0}.builder-acl-form label:nth-last-of-type(1){grid-column:1/-1}.builder-acl-form>button{grid-column:1/-1}.builder-acl-rules{display:grid;gap:5px;margin-bottom:8px}.builder-acl-rules>div{position:relative;border:1px solid var(--line);padding:7px 30px 7px 8px;display:grid;grid-template-columns:36px 1fr;gap:2px 6px}.builder-acl-rules>div.deny{border-left:2px solid var(--danger)}.builder-acl-rules>div.permit{border-left:2px solid var(--accent)}.builder-acl-rules span{font:700 10px/1.3 var(--mono);color:var(--muted)}.builder-acl-rules strong{font:750 10px/1.3 var(--mono)}.builder-acl-rules small{grid-column:1/-1}.builder-acl-rules button{position:absolute;right:5px;top:5px;width:22px;height:22px;padding:0}
@media(max-width:720px){.builder-probe-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.builder-link-profile-grid,.builder-acl-form{grid-template-columns:1fr}}
'''
if 'Labs 11G-J: ARP' not in css:
    css += extra
p.write_text(css)
