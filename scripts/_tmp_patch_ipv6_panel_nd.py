from pathlib import Path
p=Path('src/BuilderIpv6Panel.tsx')
s=p.read_text(encoding='utf-8')
a='    {selectedNode && <><div className="control-title"><span>SELECTED DEVICE · IPV6</span>'
if s.count(a)!=1: raise SystemExit('selected-device anchor not unique')
b=r'''    <div className="control-title"><span>ND + RA / SLAAC</span><strong>{controlState.neighborCache.length} NEIGHBORS · {ipv6.autoconfig.slaacEndpointIds.length} SLAAC</strong></div>
    {selectedNode?.kind === 'endpoint' ? <div className="button-row"><button type="button" disabled={!ipv6.enabled} onClick={runSlaac}>RUN RS / SLAAC</button><button type="button" disabled={controlState.neighborCache.length===0} onClick={()=>{onControlStateChange(clearBuilderIpv6NeighborCache(controlState));onMessage('IPV6 NEIGHBOR CACHE CLEARED · next probe emits NS/NA again.');}}>CLEAR ND CACHE</button></div> : selectedNode?.kind === 'router' ? <div className="button-row"><button type="button" disabled={!ipv6.enabled} onClick={toggleRa}>{selectedRaEnabled?'DISABLE RA':'ENABLE RA'}</button><button type="button" disabled={controlState.neighborCache.length===0} onClick={()=>{onControlStateChange(clearBuilderIpv6NeighborCache(controlState));onMessage('IPV6 NEIGHBOR CACHE CLEARED.');}}>CLEAR ND CACHE</button></div> : null}
    {lastRa&&<small className="builder-routing-note">LAST RS/RA · {lastRa.success?`${labelFor(graph,lastRa.endpointId)} ← ${labelFor(graph,lastRa.routerId??'')} · ${lastRa.prefix} · SLAAC ${lastRa.slaacAddress}`:lastRa.detail}</small>}
    <div className="builder-interface-list">{selectedNeighbors.length===0?<small>NO CACHED IPV6 NEIGHBORS ON SELECTED DEVICE</small>:selectedNeighbors.map((entry)=><div key={entry.id}><span>{entry.address}</span><strong>{entry.mac}</strong><small>{labelFor(graph,entry.targetNodeId)} · {entry.linkId.toUpperCase()} · LEARNED {entry.source}</small></div>)}</div>
'''
s=s.replace(a,b+a,1)
p.write_text(s,encoding='utf-8')
print('IPv6 ND/RA/SLAAC UI inserted.')