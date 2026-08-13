from pathlib import Path
p=Path('src/BuilderIpv6Panel.tsx')
s=p.read_text(encoding='utf-8')
a='    {selectedNode?.kind === \'router\' && <><div className="control-title"><span>IPV6 ROUTE TABLE</span>'
if s.count(a)!=1: raise SystemExit('IPv6 route-table anchor not unique')
b=r'''    <div className="control-title"><span>OSPFV3 · AREA 0</span><strong>{ospfv3.enabledRouterIds.length===0?'OFF':`${ospfv3.enabledRouterIds.length} RTR · ${ospfv3.fullAdjacencyCount} FULL`}</strong></div>
    {selectedNode?.kind==='router'?<><div className="button-row"><button type="button" disabled={!ipv6.enabled} onClick={toggleOspfv3}>{selectedOspfv3Enabled?'DISABLE OSPFV3':'ENABLE OSPFV3'}</button><button type="button" disabled={!ipv6.enabled} onClick={()=>{onChange(setBuilderOspfv3Everywhere(graph,ipv4,ipv6,true));onMessage('OSPFV3 AREA 0 ENABLED · all routers advertise connected IPv6 /64s over link-local adjacencies.');}}>ENABLE ALL OSPFV3</button><button type="button" onClick={()=>{onChange(setBuilderOspfv3Everywhere(graph,ipv4,ipv6,false));onMessage('OSPFV3 DISABLED · O6 routes withdrawn; C6/S6 remain.');}}>DISABLE ALL OSPFV3</button></div><div className="builder-ospf-neighbors">{ospfv3.adjacencies.filter((entry)=>entry.aRouterId===selectedNode.id||entry.bRouterId===selectedNode.id).length===0?<small>NO OSPFV3 ROUTER NEIGHBORS</small>:ospfv3.adjacencies.filter((entry)=>entry.aRouterId===selectedNode.id||entry.bRouterId===selectedNode.id).map((entry)=>{const neighbor=entry.aRouterId===selectedNode.id?entry.bRouterId:entry.aRouterId;return <div key={entry.id} className={entry.state==='FULL'?'full':'down'}><span>{entry.state}</span><strong>{labelFor(graph,neighbor)}</strong><small>{entry.linkId.toUpperCase()} · AREA 0 · COST {entry.cost} · {entry.reason}</small></div>;})}</div></>:<small className="builder-routing-note">Select a router to inspect OSPFv3 adjacency and enablement.</small>}
'''
s=s.replace(a,b+a,1)
old='FOUNDATION SLICE · GLOBAL 2001:DB8::/32 DOCUMENTATION SPACE + PER-INTERFACE FE80:: LINK-LOCAL · ENDPOINT DEFAULT ROUTERS USE SCOPED LINK-LOCAL NEXT HOPS · CONNECTED AD 0 / STATIC AD 1. NEIGHBOR DISCOVERY, RA/SLAAC, PACKET TOO BIG, IPV6 ACL/NAT, AND OSPFV3 ARE NOT FABRICATED YET.'
new='IPV6 DATA PLANE · C6 AD 0 / S6 AD 1 / O6 OSPFV3 AD 110 · NEXT HOPS USE LINK-LOCAL ADDRESSES · ND + PMTU CACHES ARE SESSION-ONLY. RA/SLAAC CONFIG AND OSPFV3 ENABLEMENT PERSIST IN SCHEMA V9. DAD, PRIVACY ADDRESSES, DHCPV6, MULTI-AREA OSPFV3, IPV6 ACL/NAT, AND MLD REMAIN DEFERRED.'
if s.count(old)!=1: raise SystemExit('IPv6 foundation note not unique')
s=s.replace(old,new,1)
p.write_text(s,encoding='utf-8')
print('IPv6 OSPFv3 UI inserted.')