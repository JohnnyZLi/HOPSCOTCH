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

# Test the relationship leak while the provider-learned path is still the route being exported.
p=Path('scripts/builder-bgp-contract-check.mjs')
s=p.read_text(encoding='utf-8')
old="""// Multi-origin/hijack teaching truth is explicit.\nbgp=upsertBuilderBgpOrigin(graph,bgp,{routerId:'edge',prefix:appPrefix,med:0,communities:['64496:666'],description:'Competing origin'});state=builderBgpState(graph,addressing,bgp);assert.ok(state.multiOriginPrefixes.includes(appPrefix));\n// Relationship leak is normally blocked; explicit override can surface a leaked route.\nconst edgeR2Graph=cloneBuilderGraph(graph); // existing topology has EDGE-R2 direct link.\nbgp=upsertBuilderBgpSession(edgeR2Graph,bgp,'edge-r2','peer');const edgeR2=bgp.sessions.find((entry)=>entry.linkId==='edge-r2');assert.ok(edgeR2);bgp=updateBuilderBgpSession(edgeR2Graph,bgp,edgeR2.id,{relationship:'peer',allowRelationshipLeak:true});state=builderBgpState(edgeR2Graph,addressing,bgp);assert.ok(state.leakedRouteIds.length>0,'explicit leak override should tag at least one policy anomaly');\nconst projection=projectBuilderBgpToAsGraph(graph,bgp,state,'edge','core',appPrefix);"""
new="""// Relationship leak is normally blocked; explicit override can surface a provider-learned route to a peer.\nconst edgeR2Graph=cloneBuilderGraph(graph); // existing topology has EDGE-R2 direct link.\nbgp=upsertBuilderBgpSession(edgeR2Graph,bgp,'edge-r2','peer');const edgeR2=bgp.sessions.find((entry)=>entry.linkId==='edge-r2');assert.ok(edgeR2);bgp=updateBuilderBgpSession(edgeR2Graph,bgp,edgeR2.id,{relationship:'peer',allowRelationshipLeak:true});state=builderBgpState(edgeR2Graph,addressing,bgp);assert.ok(state.leakedRouteIds.length>0,'explicit leak override should tag at least one policy anomaly');\n// Multi-origin/hijack teaching truth is explicit and remains separate from relationship-leak truth.\nbgp=upsertBuilderBgpOrigin(graph,bgp,{routerId:'edge',prefix:appPrefix,med:0,communities:['64496:666'],description:'Competing origin'});state=builderBgpState(edgeR2Graph,addressing,bgp);assert.ok(state.multiOriginPrefixes.includes(appPrefix));\nconst projection=projectBuilderBgpToAsGraph(edgeR2Graph,bgp,state,'edge','core',appPrefix);"""
if s.count(old)!=1: raise SystemExit(f'BGP leak contract anchor found {s.count(old)}')
p.write_text(s.replace(old,new,1),encoding='utf-8')
print('Fixed BGP type narrowing and leak-contract ordering.')
