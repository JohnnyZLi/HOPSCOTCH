from pathlib import Path
p=Path('src/BuilderIpv6Panel.tsx')
s=p.read_text(encoding='utf-8')
a='    {selectedNode && <><div className="control-title"><span>SELECTED DEVICE · IPV6</span>'
if s.count(a)!=1: raise SystemExit('selected-device anchor not unique')
b=r'''    <div className="control-title"><span>PATH MTU DISCOVERY</span><strong>{controlState.pmtuCache.length} CACHED</strong></div>
    <label>IPV6 PROBE PACKET BYTES<input type="number" min={80} max={9216} value={probePacketBytes} onChange={(event)=>onProbePacketBytesChange(Math.max(80,Math.min(9216,Math.round(Number(event.currentTarget.value)||1280))))}/></label>
    <div className="button-row"><button type="button" disabled={controlState.pmtuCache.length===0} onClick={()=>{onControlStateChange(clearBuilderIpv6PmtuCache(controlState));onMessage('IPV6 PMTU CACHE CLEARED · oversized probes can trigger Packet Too Big again.');}}>CLEAR PMTU CACHE</button></div>
    {lastPmtu&&<small className="builder-routing-note">LAST PTB · {labelFor(graph,lastPmtu.responderNodeId)} · {lastPmtu.linkId.toUpperCase()} MTU {lastPmtu.mtuBytes} · {lastPmtu.delivered?'DELIVERED + CACHED':'REVERSE PATH FAILED'}</small>}
    <div className="builder-interface-list">{controlState.pmtuCache.length===0?<small>NO PMTU STATE · DEFAULT PROBE SIZE 1280 BYTES</small>:controlState.pmtuCache.map((entry)=><div key={entry.id}><span>{labelFor(graph,entry.sourceNodeId)} → {labelFor(graph,entry.destinationNodeId)}</span><strong>{entry.pathMtuBytes} BYTES</strong><small>PTB FROM {labelFor(graph,entry.learnedFromNodeId)} · {entry.linkId.toUpperCase()}</small></div>)}</div>
'''
s=s.replace(a,b+a,1)
p.write_text(s,encoding='utf-8')
print('IPv6 PMTU UI inserted.')