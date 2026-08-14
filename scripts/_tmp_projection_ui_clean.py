from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    s = p.read_text(encoding='utf-8')
    count = s.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one anchor, found {count}: {old[:120]!r}')
    p.write_text(s.replace(old, new, 1), encoding='utf-8')


# Lab 05 projection mode: the selected Builder best path is display truth, not recomputed policy truth.
p = Path('src/InternetScaleTheater.tsx')
s = p.read_text(encoding='utf-8')
s = s.replace("  relationshipLabel,\n", "  relationshipLabel,\n  traversalFor,\n", 1)
s = s.replace("import './InternetScaleTheater.css';\n", "import type { BuilderBgpAsProjection } from './builder/bgp.ts';\nimport './InternetScaleTheater.css';\n", 1)
old_signature = "export function InternetScaleTheater({ onExit, onOpenObserved, graph = simulatedAsGraph, initialSource = DEFAULT_AS_SOURCE, initialDestination = DEFAULT_AS_DESTINATION, stressLabel }: { onExit: () => void; onOpenObserved: () => void; graph?: SimulatedAsGraph; initialSource?: number; initialDestination?: number; stressLabel?: string }) {\n  const canvasRef = useRef<HTMLCanvasElement>(null);"
new_signature = "export function InternetScaleTheater({ onExit, onOpenObserved, graph: inputGraph = simulatedAsGraph, initialSource = DEFAULT_AS_SOURCE, initialDestination = DEFAULT_AS_DESTINATION, builderProjection, onReturnToBuilder, stressLabel }: { onExit: () => void; onOpenObserved: () => void; graph?: SimulatedAsGraph; initialSource?: number; initialDestination?: number; builderProjection?: BuilderBgpAsProjection | null; onReturnToBuilder?: () => void; stressLabel?: string }) {\n  const graph = builderProjection?.graph ?? inputGraph;\n  const projectionLocked = Boolean(builderProjection);\n  const canvasRef = useRef<HTMLCanvasElement>(null);"
if s.count(old_signature) != 1:
    raise SystemExit('InternetScale signature anchor missing')
s = s.replace(old_signature, new_signature, 1)
s = s.replace("  const [source, setSource] = useState(initialSource);\n  const [destination, setDestination] = useState(initialDestination);", "  const [source, setSource] = useState(builderProjection?.sourceAsn ?? initialSource);\n  const [destination, setDestination] = useState(builderProjection?.destinationAsn ?? initialDestination);", 1)
old_candidates = "  const candidates = useMemo(() => enumeratePolicyPaths(graph, source, destination, failed), [graph, source, destination, failed]);\n  const winner = candidates[0];\n  const selectedRelationship = graph.relationships.find((item) => item.id === selectedRelationshipId) ?? graph.relationships[0];\n  const activeRelationships = new Set(winner?.relationshipIds ?? []);"
new_candidates = r'''  const projectedWinner = useMemo(() => {
    if (!builderProjection || builderProjection.selectedPathAsns.length === 0 || !builderProjection.selectedRoute) return null;
    const relationshipIds: string[] = [];
    const hops = [] as Array<{ relationshipId: string; from: number; to: number; traversal: 'up' | 'peer' | 'down' }>;
    for (let index = 0; index < builderProjection.selectedPathAsns.length - 1; index += 1) {
      const from = builderProjection.selectedPathAsns[index];
      const to = builderProjection.selectedPathAsns[index + 1];
      const relationship = graph.relationships.find((entry) => relationshipEndpoints(entry).includes(from) && relationshipEndpoints(entry).includes(to));
      if (!relationship) continue;
      const traversal = traversalFor(relationship, from, to);
      if (!traversal) continue;
      relationshipIds.push(relationship.id);
      hops.push({ relationshipId: relationship.id, from, to, traversal });
    }
    return {
      asns: [...builderProjection.selectedPathAsns],
      relationshipIds,
      hops,
      localPreference: builderProjection.selectedRoute.localPref,
      scoreLabel: `BUILDER BGP BEST · ${builderProjection.prefix ?? 'NLRI'}`,
    };
  }, [builderProjection, graph]);
  const candidates = useMemo(() => builderProjection ? (projectedWinner ? [projectedWinner] : []) : enumeratePolicyPaths(graph, source, destination, failed), [builderProjection, projectedWinner, graph, source, destination, failed]);
  const winner = candidates[0];
  const selectedRelationship = graph.relationships.find((item) => item.id === selectedRelationshipId) ?? graph.relationships[0];
  const activeRelationships = new Set(winner?.relationshipIds ?? []);

  useEffect(() => {
    if (!builderProjection) return;
    if (builderProjection.sourceAsn != null) setSource(builderProjection.sourceAsn);
    if (builderProjection.destinationAsn != null) setDestination(builderProjection.destinationAsn);
    setFailed(new Set());
    setPickMode(null);
    setSelectedRelationshipId(builderProjection.graph.relationships[0]?.id ?? '');
  }, [builderProjection]);'''
if s.count(old_candidates) != 1:
    raise SystemExit('InternetScale candidates anchor missing')
s = s.replace(old_candidates, new_candidates, 1)
s = s.replace("    if (pickMode) {", "    if (pickMode && !projectionLocked) {", 1)
s = s.replace("  const toggleRelationship = (relationship: AsRelationship) => {\n    setFailed", "  const toggleRelationship = (relationship: AsRelationship) => {\n    if (projectionLocked) return;\n    setFailed", 1)

old_header = r'''    <header className="internet-heading"><div><p className="eyebrow">Lab 05A · Internet scale</p><h1>POLICY MAKES<br/><span>THE PATH.</span></h1></div><div className="internet-heading-actions"><span>SIMULATED · DOCUMENTATION ASNs ONLY</span><button className="lab-mode" type="button" onClick={onOpenObserved}>OBSERVED / INFERRED ↗</button><button className="lab-mode" type="button" onClick={onExit}>EXIT LAB</button></div></header>'''
new_header = r'''    <header className="internet-heading"><div><p className="eyebrow">{projectionLocked?'Lab 11O → 05A · BGP projection':'Lab 05A · Internet scale'}</p><h1>{projectionLocked?<>BUILDER BGP.<br/><span>AS SCALE.</span></>:<>POLICY MAKES<br/><span>THE PATH.</span></>}</h1></div><div className="internet-heading-actions"><span>{projectionLocked?'BUILDER BGP PROJECTION · DOCUMENTATION ASNs':'SIMULATED · DOCUMENTATION ASNs ONLY'}</span>{projectionLocked&&onReturnToBuilder&&<button className="lab-mode" type="button" onClick={onReturnToBuilder}>RETURN TO BUILDER ↗</button>}{!projectionLocked&&<button className="lab-mode" type="button" onClick={onOpenObserved}>OBSERVED / INFERRED ↗</button>}<button className="lab-mode" type="button" onClick={onExit}>EXIT LAB</button></div></header>'''
if s.count(old_header) != 1:
    raise SystemExit('InternetScale header anchor missing')
s = s.replace(old_header, new_header, 1)
old_stage = r'''      <section className="internet-stage"><div className="internet-stage-meta"><div><span>SOURCE</span><strong>{asLabel(source)}</strong></div><div><span>DESTINATION</span><strong>{asLabel(destination)}</strong></div><div><span>CANDIDATES</span><strong>{candidates.length}</strong></div><div><span>SELECTED</span><strong>{winner ? `${winner.relationshipIds.length} AS HOPS` : 'UNREACHABLE'}</strong></div></div><div className={`internet-canvas-wrap ${pickMode ? 'picking':''}`}><canvas ref={canvasRef} onClick={onCanvasClick}/><div className="internet-canvas-note">{pickMode ? `CLICK AN AS TO SET ${pickMode.toUpperCase()}` : 'CLICK A RELATIONSHIP TO INSPECT / FAIL IT'}</div></div>{winner?<div className="internet-winner"><span>SIMULATED WINNER</span><strong>{winner.asns.map(asLabel).join(' → ')}</strong><p>{winner.scoreLabel} · stable ASN-path tie break. Curated valley-free teaching policy, not universal BGP best-path behavior.</p></div>:<div className="internet-winner unreachable"><span>SIMULATED WINNER</span><strong>NO POLICY-COMPLIANT PATH</strong><p>Current failed relationships partition the selected source/destination under this teaching model.</p></div>}</section>'''
new_stage = r'''      <section className="internet-stage"><div className="internet-stage-meta"><div><span>SOURCE</span><strong>{asLabel(source)}</strong></div><div><span>DESTINATION</span><strong>{asLabel(destination)}</strong></div><div><span>{projectionLocked?'TRUTH':'CANDIDATES'}</span><strong>{projectionLocked?'BUILDER BEST':candidates.length}</strong></div><div><span>SELECTED</span><strong>{winner ? `${winner.relationshipIds.length} AS HOPS` : 'UNREACHABLE'}</strong></div></div><div className={`internet-canvas-wrap ${pickMode ? 'picking':''}`}><canvas ref={canvasRef} onClick={onCanvasClick}/><div className="internet-canvas-note">{projectionLocked?'CLICK A RELATIONSHIP TO INSPECT · RETURN TO BUILDER TO MUTATE':pickMode ? `CLICK AN AS TO SET ${pickMode.toUpperCase()}` : 'CLICK A RELATIONSHIP TO INSPECT / FAIL IT'}</div></div>{winner?<div className="internet-winner"><span>{projectionLocked?'BUILDER BGP BEST PATH':'SIMULATED WINNER'}</span><strong>{winner.asns.map(asLabel).join(' → ')}</strong><p>{projectionLocked?'Exact Builder BGP decision projected at AS scale. Lab 05 is not recomputing a different winner.':`${winner.scoreLabel} · stable ASN-path tie break. Curated valley-free teaching policy, not universal BGP best-path behavior.`}</p></div>:<div className="internet-winner unreachable"><span>{projectionLocked?'BUILDER BGP PROJECTION':'SIMULATED WINNER'}</span><strong>{projectionLocked?'NO PROJECTABLE BEST PATH':'NO POLICY-COMPLIANT PATH'}</strong><p>{projectionLocked?'Return to Builder and select a concrete BEST BGP route.':'Current failed relationships partition the selected source/destination under this teaching model.'}</p></div>}</section>'''
if s.count(old_stage) != 1:
    raise SystemExit('InternetScale stage anchor missing')
s = s.replace(old_stage, new_stage, 1)
old_endpoints = r'''      <aside className="internet-panel"><section><div className="internet-panel-title"><span>ENDPOINTS</span><strong>PICK FROM CANVAS</strong></div><label>SOURCE<select value={source} onChange={(e)=>setSource(Number(e.currentTarget.value))}>{graph.nodes.map((node)=><option key={node.asn} value={node.asn}>{node.label} · {node.role}</option>)}</select></label><label>DESTINATION<select value={destination} onChange={(e)=>setDestination(Number(e.currentTarget.value))}>{graph.nodes.map((node)=><option key={node.asn} value={node.asn}>{node.label} · {node.role}</option>)}</select></label><div className="internet-buttons"><button type="button" onClick={()=>setPickMode('source')}>PICK SOURCE</button><button type="button" onClick={()=>setPickMode('destination')}>PICK DEST</button></div></section>'''
new_endpoints = r'''      <aside className="internet-panel"><section><div className="internet-panel-title"><span>{projectionLocked?'BUILDER TRUTH':'ENDPOINTS'}</span><strong>{projectionLocked?'LOCKED PROJECTION':'PICK FROM CANVAS'}</strong></div>{projectionLocked?<><p className="relationship-copy">PREFIX · {builderProjection?.prefix??'—'}</p><p className="relationship-copy">SOURCE {asLabel(source)} · ORIGIN {asLabel(destination)}</p>{builderProjection?.selectedRoute&&<p className="relationship-copy">LOCAL_PREF {builderProjection.selectedRoute.localPref} · AS_PATH {builderProjection.selectedRoute.asPath.join(' → ')||'LOCAL'} · MED {builderProjection.selectedRoute.med} · NEXT_HOP {builderProjection.selectedRoute.nextHopAddress} · COMM {builderProjection.selectedRoute.communities.join(' ')||'NONE'}{builderProjection.selectedRoute.policyAnomaly?' · POLICY ANOMALY':''}</p>}</>:<><label>SOURCE<select value={source} onChange={(e)=>setSource(Number(e.currentTarget.value))}>{graph.nodes.map((node)=><option key={node.asn} value={node.asn}>{node.label} · {node.role}</option>)}</select></label><label>DESTINATION<select value={destination} onChange={(e)=>setDestination(Number(e.currentTarget.value))}>{graph.nodes.map((node)=><option key={node.asn} value={node.asn}>{node.label} · {node.role}</option>)}</select></label><div className="internet-buttons"><button type="button" onClick={()=>setPickMode('source')}>PICK SOURCE</button><button type="button" onClick={()=>setPickMode('destination')}>PICK DEST</button></div></>}</section>'''
if s.count(old_endpoints) != 1:
    raise SystemExit('InternetScale endpoint panel anchor missing')
s = s.replace(old_endpoints, new_endpoints, 1)
old_relationship = r'''      <section><div className="internet-panel-title"><span>RELATIONSHIP</span><strong>{selectedRelationship?.id.toUpperCase()}</strong></div>{selectedRelationship&&<><p className="relationship-copy">{relationshipEndpoints(selectedRelationship).map(asLabel).join(' ↔ ')} · {relationshipLabel(selectedRelationship)}</p><button className={failed.has(selectedRelationship.id)?'restore':''} type="button" onClick={()=>toggleRelationship(selectedRelationship)}>{failed.has(selectedRelationship.id)?'RESTORE RELATIONSHIP':'FAIL RELATIONSHIP'}</button></>}</section>'''
new_relationship = r'''      <section><div className="internet-panel-title"><span>RELATIONSHIP</span><strong>{selectedRelationship?.id.toUpperCase()}</strong></div>{selectedRelationship&&<><p className="relationship-copy">{relationshipEndpoints(selectedRelationship).map(asLabel).join(' ↔ ')} · {relationshipLabel(selectedRelationship)}</p>{projectionLocked?<small>READ ONLY · return to Builder to mutate sessions, relationships, or policy.</small>:<button className={failed.has(selectedRelationship.id)?'restore':''} type="button" onClick={()=>toggleRelationship(selectedRelationship)}>{failed.has(selectedRelationship.id)?'RESTORE RELATIONSHIP':'FAIL RELATIONSHIP'}</button>}</>}</section>'''
if s.count(old_relationship) != 1:
    raise SystemExit('InternetScale relationship panel anchor missing')
s = s.replace(old_relationship, new_relationship, 1)
s = s.replace('<section><div className="internet-panel-title"><span>CANDIDATE PATHS</span><strong>POLICY ORDER</strong></div>', '<section><div className="internet-panel-title"><span>{projectionLocked?\'PROJECTED PATH\':\'CANDIDATE PATHS\'}</span><strong>{projectionLocked?\'NO RECOMPUTE\':\'POLICY ORDER\'}</strong></div>', 1)
old_reset = r'''<button type="button" onClick={()=>{setFailed(new Set());setSource(DEFAULT_AS_SOURCE);setDestination(DEFAULT_AS_DESTINATION);setZoom(1);}}>RESET</button>'''
new_reset = r'''<button type="button" onClick={()=>{setFailed(new Set());if(!projectionLocked){setSource(DEFAULT_AS_SOURCE);setDestination(DEFAULT_AS_DESTINATION);}setZoom(1);}}>RESET VIEW</button>'''
if s.count(old_reset) != 1:
    raise SystemExit('InternetScale reset anchor missing')
s = s.replace(old_reset, new_reset, 1)
p.write_text(s, encoding='utf-8')


# App owns the projection + full scenario pair. Returning to Builder remounts from that exact snapshot.
p = Path('src/App.tsx')
s = p.read_text(encoding='utf-8')
s = s.replace("import type { BuilderProbePacketSeed } from './builder/probes.ts';\n", "import type { BuilderProbePacketSeed } from './builder/probes.ts';\nimport type { BuilderScenarioV8 } from './builder/scenario.ts';\nimport type { BuilderBgpAsProjection } from './builder/bgp.ts';\n", 1)
s = s.replace("  const [builderPacketSeed, setBuilderPacketSeed] = useState<BuilderProbePacketSeed | null>(null);", "  const [builderPacketSeed, setBuilderPacketSeed] = useState<BuilderProbePacketSeed | null>(null);\n  const [builderBgpProjection, setBuilderBgpProjection] = useState<{ projection: BuilderBgpAsProjection; scenario: BuilderScenarioV8 } | null>(null);", 1)
s = s.replace("        setLayer('internet');\n        setActiveLab(null);", "        setLayer('internet');\n        setBuilderBgpProjection(null);\n        setActiveLab(null);", 1)
old_builder_opener = "  const openBuilderLab = () => { pushBrowserRoute('builder'); setPlaying(false); setLayer('routing'); setActiveLab('builder'); };"
new_builder_opener = r'''  const openBuilderLab = () => { setBuilderBgpProjection(null); pushBrowserRoute('builder'); setPlaying(false); setLayer('routing'); setActiveLab('builder'); };
  const openBuilderBgpProjection = (payload: { projection: BuilderBgpAsProjection; scenario: BuilderScenarioV8 }) => { setBuilderBgpProjection(payload); pushBrowserRoute('internet'); setPlaying(false); setLayer('internet'); setActiveLab('internet'); };
  const returnToProjectedBuilder = () => { if (!builderBgpProjection) { openBuilderLab(); return; } pushBrowserRoute('builder'); setPlaying(false); setLayer('routing'); setActiveLab('builder'); };'''
if s.count(old_builder_opener) != 1:
    raise SystemExit('App Builder opener anchor missing')
s = s.replace(old_builder_opener, new_builder_opener, 1)
s = s.replace("  const openInternetLab = () => { pushBrowserRoute('internet'); setPlaying(false); setLayer('internet'); setActiveLab('internet'); };", "  const openInternetLab = () => { setBuilderBgpProjection(null); pushBrowserRoute('internet'); setPlaying(false); setLayer('internet'); setActiveLab('internet'); };", 1)
s = s.replace("  const exitLabs = () => { pushBrowserRoute(null); setPlaying(false); setJourneyReturnPending(false); setExploreOpen(false); setActiveLab(null); };", "  const exitLabs = () => { pushBrowserRoute(null); setPlaying(false); setJourneyReturnPending(false); setExploreOpen(false); setBuilderBgpProjection(null); setActiveLab(null); };", 1)
old_builder_render = r'''          <NetworkBuilder key="lab04" onExit={exitActiveLab} onOpenFailureStory={() => openFailureLab(0, true)} onOpenProbePacket={openPacketLab} />'''
new_builder_render = r'''          <NetworkBuilder key={`lab04-${builderBgpProjection?.scenario.updatedAt??'default'}`} onExit={exitActiveLab} onOpenFailureStory={() => openFailureLab(0, true)} onOpenProbePacket={openPacketLab} onOpenBgpProjection={openBuilderBgpProjection} initialGraph={builderBgpProjection?.scenario.graph} initialLayout={builderBgpProjection?.scenario.layout} initialAddressing={builderBgpProjection?.scenario.addressing} initialRouting={builderBgpProjection?.scenario.routing} initialEthernet={builderBgpProjection?.scenario.ethernet} initialLinkProfiles={builderBgpProjection?.scenario.linkProfiles} initialAcl={builderBgpProjection?.scenario.acl} initialNat={builderBgpProjection?.scenario.nat} initialDhcp={builderBgpProjection?.scenario.dhcp} initialIpv6={builderBgpProjection?.scenario.ipv6} initialSourceId={builderBgpProjection?.scenario.sourceId} initialDestinationId={builderBgpProjection?.scenario.destinationId} initialScenarioName={builderBgpProjection?.scenario.name}/>'''
if s.count(old_builder_render) != 1:
    raise SystemExit('App NetworkBuilder render anchor missing')
s = s.replace(old_builder_render, new_builder_render, 1)
old_internet_render = r'''          <InternetScaleTheater key="lab05-simulated" onExit={exitActiveLab} onOpenObserved={openObservedInternet} />'''
new_internet_render = r'''          <InternetScaleTheater key={`lab05-simulated-${builderBgpProjection?'builder-bgp':'default'}`} onExit={exitActiveLab} onOpenObserved={openObservedInternet} builderProjection={builderBgpProjection?.projection} onReturnToBuilder={builderBgpProjection?returnToProjectedBuilder:undefined} />'''
if s.count(old_internet_render) != 1:
    raise SystemExit('App Internet render anchor missing')
s = s.replace(old_internet_render, new_internet_render, 1)
p.write_text(s, encoding='utf-8')


# Permanent model + persistence contract for exact round-trip truth.
Path('scripts/builder-bgp-projection-contract-check.mjs').write_text(r'''import assert from 'node:assert/strict';
import { createDefaultBuilderAddressing } from '../src/builder/addressing.ts';
import { cloneBuilderGraph, defaultBuilderGraph, defaultBuilderLayout } from '../src/builder/model.ts';
import { createDefaultBuilderRoutingConfig } from '../src/builder/routing.ts';
import { createBuilderScenario, deserializeBuilderScenario, serializeBuilderScenario } from '../src/builder/scenario.ts';
import { createDefaultBuilderEthernetConfig } from '../src/builder/ethernet.ts';
import { createDefaultBuilderLinkProfiles } from '../src/builder/link-characteristics.ts';
import { createDefaultBuilderAclConfig } from '../src/builder/acl.ts';
import { createDefaultBuilderNatConfig } from '../src/builder/nat.ts';
import { createDefaultBuilderDhcpConfig } from '../src/builder/dhcp.ts';
import { createDefaultBuilderIpv6Config } from '../src/builder/ipv6.ts';
import { builderBgpState, projectBuilderBgpToAsGraph, setBuilderBgpRouterAsn, updateBuilderBgpSession, upsertBuilderBgpOrigin, upsertBuilderBgpSession } from '../src/builder/bgp.ts';

const graph=cloneBuilderGraph(defaultBuilderGraph),addressing=createDefaultBuilderAddressing(graph);let routing=createDefaultBuilderRoutingConfig();
let bgp=routing.bgp;bgp=setBuilderBgpRouterAsn(graph,bgp,'edge',64496);bgp=setBuilderBgpRouterAsn(graph,bgp,'r1',64500);bgp=setBuilderBgpRouterAsn(graph,bgp,'r2',64500);bgp=setBuilderBgpRouterAsn(graph,bgp,'core',65538);
bgp=upsertBuilderBgpSession(graph,bgp,'edge-r1','customer-provider');let session=bgp.sessions.find((entry)=>entry.linkId==='edge-r1');assert.ok(session);bgp=updateBuilderBgpSession(graph,bgp,session.id,{customerRouterId:'edge'});
bgp=upsertBuilderBgpSession(graph,bgp,'r1-r2','peer');session=bgp.sessions.find((entry)=>entry.linkId==='r1-r2');assert.ok(session);bgp=updateBuilderBgpSession(graph,bgp,session.id,{nextHopSelf:true});
bgp=upsertBuilderBgpSession(graph,bgp,'r2-core','customer-provider');session=bgp.sessions.find((entry)=>entry.linkId==='r2-core');assert.ok(session);bgp=updateBuilderBgpSession(graph,bgp,session.id,{customerRouterId:'r2'});
const prefix=addressing.segments['core-app'].cidr;bgp=upsertBuilderBgpOrigin(graph,bgp,{routerId:'core',prefix,med:7,communities:['65538:777'],description:'projection target'});routing={...routing,bgp};
const state=builderBgpState(graph,addressing,bgp),best=state.bestRoutes.find((route)=>route.routerId==='edge'&&route.prefix===prefix);assert.ok(best);const projection=projectBuilderBgpToAsGraph(graph,bgp,state,'edge',undefined,prefix);
assert.deepEqual(projection.selectedPathAsns,[64496,...best.asPath]);assert.equal(projection.sourceAsn,64496);assert.equal(projection.destinationAsn,best.originAsn);assert.equal(projection.selectedRoute?.id,best.id);assert.deepEqual(projection.selectedRoute?.communities,best.communities);assert.equal(projection.selectedRoute?.localPref,best.localPref);assert.equal(projection.graph.relationships.length,projection.selectedPathAsns.length-1);
const ethernet=createDefaultBuilderEthernetConfig(),dhcp=createDefaultBuilderDhcpConfig(ethernet),scenario=createBuilderScenario('BGP projection round trip',graph,'client','app',defaultBuilderLayout,addressing,routing,undefined,ethernet,createDefaultBuilderLinkProfiles(graph),createDefaultBuilderAclConfig(),createDefaultBuilderNatConfig(graph),dhcp,createDefaultBuilderIpv6Config(graph,addressing));
const restored=deserializeBuilderScenario(serializeBuilderScenario(scenario));assert.deepEqual(restored.routing.bgp,scenario.routing.bgp);assert.deepEqual(restored.graph,scenario.graph);assert.deepEqual(restored.addressing,scenario.addressing);assert.deepEqual(restored.ethernet,scenario.ethernet);assert.deepEqual(restored.linkProfiles,scenario.linkProfiles);assert.deepEqual(restored.acl,scenario.acl);assert.deepEqual(restored.nat,scenario.nat);assert.deepEqual(restored.dhcp,scenario.dhcp);assert.deepEqual(restored.ipv6,scenario.ipv6);
const restoredState=builderBgpState(restored.graph,restored.addressing,restored.routing.bgp),restoredProjection=projectBuilderBgpToAsGraph(restored.graph,restored.routing.bgp,restoredState,'edge',undefined,prefix);assert.deepEqual(restoredProjection.selectedPathAsns,projection.selectedPathAsns);assert.equal(restoredProjection.selectedRoute?.bestReason,projection.selectedRoute?.bestReason);assert.deepEqual(restoredProjection.selectedRoute?.communities,projection.selectedRoute?.communities);
console.log('Builder BGP projection contract passed: exact selected path/attributes project to AS scale and the complete scenario/BGP truth round-trips unchanged.');
''', encoding='utf-8')


# Normal CI contract and final Lab 11O documentation.
p = Path('package.json')
s = p.read_text(encoding='utf-8')
old_check = 'npm run test:builder-bgp-contract && npm run test:builder-ipv6-contract'
new_check = 'npm run test:builder-bgp-contract && npm run test:builder-bgp-projection-contract && npm run test:builder-ipv6-contract'
if s.count(old_check) != 1:
    raise SystemExit('package projection check anchor missing')
s = s.replace(old_check, new_check, 1)
old_script = '    "test:builder-bgp-contract": "node scripts/builder-bgp-contract-check.mjs",\n    "test:builder-ipv6-contract":'
new_script = '    "test:builder-bgp-contract": "node scripts/builder-bgp-contract-check.mjs",\n    "test:builder-bgp-projection-contract": "node scripts/builder-bgp-projection-contract-check.mjs",\n    "test:builder-ipv6-contract":'
if s.count(old_script) != 1:
    raise SystemExit('package projection script anchor missing')
p.write_text(s.replace(old_script, new_script, 1), encoding='utf-8')

p = Path('docs/ROADMAP.md')
s = p.read_text(encoding='utf-8')
old_roadmap = '- [ ] Builder BGP state can project into the Internet-scale AS view and back without changing truth'
if s.count(old_roadmap) != 1:
    raise SystemExit('roadmap projection anchor missing')
p.write_text(s.replace(old_roadmap, '- [x] Builder BGP state can project into the Internet-scale AS view and back without changing truth', 1), encoding='utf-8')

p = Path('docs/LAB11O.md')
s = p.read_text(encoding='utf-8')
old_docs = r'''## Internet-scale projection

The BGP model already derives an AS-level projection from Builder ASNs and eBGP relationships. The follow-up 11O projection slice will carry that exact state into Lab 05 and back, preserving selected BGP path truth rather than asking the AS theater to recompute a different story.
'''
new_docs = r'''## Internet-scale projection

The BGP model derives an AS-level projection from the exact Builder ASN/session graph and the currently selected best BGP route. `OPEN AS PROJECTION` snapshots the complete schema-v9 Builder configuration and opens Lab 05 at AS scale with that selected path locked as display truth. Lab 05 does not run its own policy enumerator in projection mode, does not permit relationship failures or endpoint changes, and shows the Builder route attributes that produced the path.

`RETURN TO BUILDER` reconstructs the Builder from the captured graph, layout, IPv4/IPv6 addressing, routing/BGP, Ethernet/VLAN, link profiles, ACL, NAT, and DHCP configuration. Session-only observations such as ARP, NAT translations, probe history, FDB entries, DHCP leases, and IPv6 lifecycle timers are intentionally not promoted into persisted truth just to make the cross-lab transition look stateful.
'''
if s.count(old_docs) != 1:
    raise SystemExit('LAB11O projection docs anchor missing')
p.write_text(s.replace(old_docs, new_docs, 1), encoding='utf-8')

print('Applied clean Lab 05 projection mode, App round trip, contract, and Lab 11O docs.')
