from pathlib import Path

p=Path('src/builder/provider.ts')
text=p.read_text()
old="function establishedBgpGraph(graph:BuilderGraph,addressing:BuilderAddressing,routing:BuilderRoutingConfig){const state=builderBgpState(graph,addressing,routing.bgp),adj=new Map<string,Set<string>>();for(const id of routing.bgp.enabledRouterIds)adj.set(id,new Set());for(const session of state.sessions.filter((entry)=>entry.state==='ESTABLISHED')){adj.get(session.aRouterId)?.add(session.bRouterId);adj.get(session.bRouterId)?.add(session.aRouterId);}return adj;}\nfunction bgpControlReachable(graph:BuilderGraph,addressing:BuilderAddressing,routing:BuilderRoutingConfig,a:string,b:string){if(a===b)return true;const adj=establishedBgpGraph(graph,addressing,routing),queue=[a],seen=new Set([a]);while(queue.length){const current=queue.shift()!;for(const next of adj.get(current)??[]){if(next===b)return true;if(!seen.has(next)){seen.add(next);queue.push(next);}}}return false;}"
new="""interface BuilderEvpnBgpPropagationState { routerId:string; learnedVia:'local'|'ibgp'|'ebgp'; learnedFromRouterId:string|null; learnedSessionId:string|null; asPath:number[]; reflectionPath:string[]; }
function bgpControlReachable(graph:BuilderGraph,addressing:BuilderAddressing,routing:BuilderRoutingConfig,originRouterId:string,viewerRouterId:string){
  if(originRouterId===viewerRouterId)return true;
  const bgp= routing.bgp, sessionState=builderBgpState(graph,addressing,bgp), established=new Set(sessionState.sessions.filter((entry)=>entry.state==='ESTABLISHED').map((entry)=>entry.id));
  const queue:BuilderEvpnBgpPropagationState[]=[{routerId:originRouterId,learnedVia:'local',learnedFromRouterId:null,learnedSessionId:null,asPath:[],reflectionPath:[]}],seen=new Set<string>();
  for(let steps=0;queue.length&&steps<256;steps+=1){const state=queue.shift()!;const fingerprint=[state.routerId,state.learnedVia,state.learnedFromRouterId??'',state.learnedSessionId??'',state.asPath.join(','),state.reflectionPath.join(',')].join('|');if(seen.has(fingerprint))continue;seen.add(fingerprint);
    for(const session of bgp.sessions){if(!established.has(session.id)||(session.aRouterId!==state.routerId&&session.bRouterId!==state.routerId))continue;const receiverId=session.aRouterId===state.routerId?session.bRouterId:session.aRouterId;if(state.learnedFromRouterId===receiverId)continue;const senderAsn=builderBgpAsnForRouter(graph,bgp,state.routerId),receiverAsn=builderBgpAsnForRouter(graph,bgp,receiverId),mode=senderAsn===receiverAsn?'ibgp':'ebgp';
      if(mode==='ibgp'&&state.learnedVia==='ibgp'){const inbound=bgp.sessions.find((entry)=>entry.id===state.learnedSessionId);const learnedFromClient=Boolean(inbound&&inbound.routeReflectorClientRouterId===state.learnedFromRouterId&&(inbound.aRouterId===state.routerId||inbound.bRouterId===state.routerId));const receiverIsClient=session.routeReflectorClientRouterId===receiverId&&(session.aRouterId===state.routerId||session.bRouterId===state.routerId);if(!learnedFromClient&&!receiverIsClient)continue;if(state.reflectionPath.includes(receiverId))continue;}
      let next:BuilderEvpnBgpPropagationState;if(mode==='ebgp'){const asPath=[senderAsn,...state.asPath];if(asPath.includes(receiverAsn))continue;next={routerId:receiverId,learnedVia:'ebgp',learnedFromRouterId:state.routerId,learnedSessionId:session.id,asPath,reflectionPath:[...state.reflectionPath]};}else next={routerId:receiverId,learnedVia:'ibgp',learnedFromRouterId:state.routerId,learnedSessionId:session.id,asPath:[...state.asPath],reflectionPath:state.learnedVia==='ibgp'?[...new Set([...state.reflectionPath,state.routerId])]:[...state.reflectionPath]};
      if(receiverId===viewerRouterId)return true;queue.push(next);
    }
  }
  return false;
}"""
if old not in text: raise SystemExit('old BGP control reachability block not found')
p.write_text(text.replace(old,new,1))

c=Path('scripts/builder-provider-contract-check.mjs')
text=c.read_text()
old="for(const router of graph.nodes){routing={...routing,bgp:setBuilderBgpRouterAsn(graph,routing.bgp,router.id,64496)};routing={...routing,bgp:setBuilderBgpRouterEnabled(graph,routing.bgp,router.id,true)};}"
new="for(const [index,router] of graph.nodes.entries()){routing={...routing,bgp:setBuilderBgpRouterAsn(graph,routing.bgp,router.id,64496+index)};routing={...routing,bgp:setBuilderBgpRouterEnabled(graph,routing.bgp,router.id,true)};}"
if old not in text: raise SystemExit('contract ASN fixture anchor missing')
text=text.replace(old,new,1)
anchor="assert.ok(builderEvpnImetRoutes(graph,addressing,routing,'pe1').some((row)=>row.originVtepRouterId==='pe2'&&row.learned==='BGP EVPN'));"
extra=anchor+"\nconst ibgpSplitHorizon=structuredClone(routing);for(const router of graph.nodes)ibgpSplitHorizon.bgp=setBuilderBgpRouterAsn(graph,ibgpSplitHorizon.bgp,router.id,64496);for(const link of graph.links)ibgpSplitHorizon.bgp=upsertBuilderBgpSession(graph,ibgpSplitHorizon.bgp,link.id);assert.equal(builderEvpnRoutes(graph,addressing,ibgpSplitHorizon,'pe1').some((row)=>row.originVtepRouterId==='pe2'),false,'EVPN must inherit Track F iBGP split-horizon truth; an iBGP chain without route reflection cannot relay remote MAC/IP state');"
if anchor not in text: raise SystemExit('EVPN positive assertion anchor missing')
text=text.replace(anchor,extra,1)
c.write_text(text)

d=Path('docs/TRACKG.md')
text=d.read_text()
old="1. an allowed path through established Builder BGP control-plane sessions,\n2. canonical routed underlay reachability to the advertising VTEP."
new="1. an allowed path through established Builder BGP control-plane sessions **with Track F iBGP split-horizon / route-reflector rules preserved**,\n2. canonical routed underlay reachability to the advertising VTEP."
if old not in text: raise SystemExit('Track G doc BGP boundary anchor missing')
text=text.replace(old,new,1)
old2="- EVPN Type-2 and Type-3 learning,"
new2="- EVPN Type-2 and Type-3 learning plus iBGP split-horizon non-propagation without a route reflector,"
text=text.replace(old2,new2,1)
d.write_text(text)

Path('scripts/track-g-bgp-semantics.py').unlink()
Path('.github/workflows/ci.yml').write_text("""name: CI

on:
  push:
    branches: [main]
  pull_request:

permissions:
  contents: read

jobs:
  build:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm run check
      - name: Upload production build
        if: github.event_name == 'pull_request'
        uses: actions/upload-artifact@v4
        with:
          name: hopscotch-dist
          path: dist
          if-no-files-found: error
          retention-days: 3
""")
