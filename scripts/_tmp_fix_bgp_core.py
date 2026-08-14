from pathlib import Path

p=Path('src/builder/bgp.ts')
s=p.read_text(encoding='utf-8')
old="const ok=session.enabled&&enabled.has(session.aRouterId)&&enabled.has(session.bRouterId)&&Boolean(link&&!link.failed)&&validAddresses;return{id:session.id,linkId:session.linkId,aRouterId:session.aRouterId,bRouterId:session.bRouterId,aAsn,bAsn,mode,state:ok?'ESTABLISHED':'IDLE',relationship:session.relationship,reason:!session.enabled?'ADMIN DOWN':!enabled.has(session.aRouterId)||!enabled.has(session.bRouterId)?'BGP DISABLED ON PEER':link?.failed?'LINK DOWN':!validAddresses?'NO IPV4 PEERING ADDRESS':'TCP/179 TEACHING SESSION ESTABLISHED'};"
new="const ok=session.enabled&&enabled.has(session.aRouterId)&&enabled.has(session.bRouterId)&&Boolean(link&&!link.failed)&&validAddresses;const state:BuilderBgpSessionState['state']=ok?'ESTABLISHED':'IDLE';return{id:session.id,linkId:session.linkId,aRouterId:session.aRouterId,bRouterId:session.bRouterId,aAsn,bAsn,mode,state,relationship:session.relationship,reason:!session.enabled?'ADMIN DOWN':!enabled.has(session.aRouterId)||!enabled.has(session.bRouterId)?'BGP DISABLED ON PEER':link?.failed?'LINK DOWN':!validAddresses?'NO IPV4 PEERING ADDRESS':'TCP/179 TEACHING SESSION ESTABLISHED'};"
if s.count(old)!=1: raise SystemExit(f'bgp session state anchor found {s.count(old)}')
p.write_text(s.replace(old,new,1),encoding='utf-8')

p=Path('src/builder/routing.ts')
s=p.read_text(encoding='utf-8')
old="  for (const path of bgpState.bestRoutes.filter((route) => route.routerId === routerId && route.learnedVia !== 'local')) {"
new="  for (const path of bgpState.bestRoutes.filter((route): route is BuilderBgpRoute & { learnedVia: 'ebgp' | 'ibgp' } => route.routerId === routerId && route.learnedVia !== 'local')) {"
if s.count(old)!=1: raise SystemExit(f'routing BGP narrowing anchor found {s.count(old)}')
p.write_text(s.replace(old,new,1),encoding='utf-8')
print('Fixed BGP session/FIB type narrowing.')
