from pathlib import Path
import json

root = Path('.')

def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one anchor, found {count}')
    return text.replace(old, new, 1)

# ---- NetworkBuilder integration ----
path = root / 'src/NetworkBuilder.tsx'
text = path.read_text()
text = replace_once(
    text,
    "import {\n  BUILDER_LIMITS,",
    "import {\n  cloneBuilderRoutingConfig,\n  createDefaultBuilderRoutingConfig,\n  deleteBuilderStaticRoute,\n  installStaticRoutesForWeightedPath,\n  nextHopOptionsForBuilderRouter,\n  reconcileBuilderRoutingConfig,\n  routeTableForBuilderRouter,\n  traceBuilderForwarding,\n  upsertBuilderStaticRoute,\n  type BuilderRoutingConfig,\n} from './builder/routing.ts';\nimport {\n  BUILDER_LIMITS,",
    'routing imports',
)
text = replace_once(text, '  type BuilderScenarioV3,', '  type BuilderScenarioV4,', 'scenario v4 type')
old_sig = "export function NetworkBuilder({ onExit, onOpenFailureStory, initialGraph = defaultBuilderGraph, initialLayout = defaultBuilderLayout, initialAddressing, initialSourceId = 'client', initialDestinationId = 'app', stressLabel }: { onExit: () => void; onOpenFailureStory: () => void; initialGraph?: BuilderGraph; initialLayout?: BuilderLayout; initialAddressing?: BuilderAddressing; initialSourceId?: string; initialDestinationId?: string; stressLabel?: string }) {"
new_sig = "export function NetworkBuilder({ onExit, onOpenFailureStory, initialGraph = defaultBuilderGraph, initialLayout = defaultBuilderLayout, initialAddressing, initialRouting, initialSourceId = 'client', initialDestinationId = 'app', stressLabel }: { onExit: () => void; onOpenFailureStory: () => void; initialGraph?: BuilderGraph; initialLayout?: BuilderLayout; initialAddressing?: BuilderAddressing; initialRouting?: BuilderRoutingConfig; initialSourceId?: string; initialDestinationId?: string; stressLabel?: string }) {"
text = replace_once(text, old_sig, new_sig, 'builder signature routing')
text = replace_once(
    text,
    "  const [addressing, setAddressing] = useState<BuilderAddressing>(() => cloneBuilderAddressing(initialAddressing ?? createDefaultBuilderAddressing(initialGraph)));\n  const [layout, setLayout]",
    "  const [addressing, setAddressing] = useState<BuilderAddressing>(() => cloneBuilderAddressing(initialAddressing ?? createDefaultBuilderAddressing(initialGraph)));\n  const [routing, setRouting] = useState<BuilderRoutingConfig>(() => cloneBuilderRoutingConfig(initialRouting ?? createDefaultBuilderRoutingConfig()));\n  const [layout, setLayout]",
    'routing state',
)
text = replace_once(
    text,
    "  const [scenarioName, setScenarioName] = useState('My topology');\n  const [saved, setSaved] = useState<BuilderScenarioV3[]>(() => listStoredBuilderScenarios());",
    "  const [scenarioName, setScenarioName] = useState('My topology');\n  const [staticPrefix, setStaticPrefix] = useState('0.0.0.0/0');\n  const [staticNextHop, setStaticNextHop] = useState('');\n  const [staticMetric, setStaticMetric] = useState(1);\n  const [saved, setSaved] = useState<BuilderScenarioV4[]>(() => listStoredBuilderScenarios());",
    'static route form state',
)
text = replace_once(
    text,
    "  const route = useMemo(() => findShortestPath(graph, sourceId, destinationId), [graph, sourceId, destinationId]);\n  const selectedLink",
    "  const route = useMemo(() => findShortestPath(graph, sourceId, destinationId), [graph, sourceId, destinationId]);\n  const forwardingTrace = useMemo(() => traceBuilderForwarding(graph, addressing, routing, sourceId, destinationId), [graph, addressing, routing, sourceId, destinationId]);\n  const selectedLink",
    'forwarding trace',
)
text = replace_once(
    text,
    "  const selectedNodeInterfaces = selectedNode ? interfacesForBuilderNode(addressing, selectedNode.id) : [];\n  const activeLinks = new Set(route.linkIds);",
    "  const selectedNodeInterfaces = selectedNode ? interfacesForBuilderNode(addressing, selectedNode.id) : [];\n  const selectedRouteTable = selectedNode?.kind === 'router' ? routeTableForBuilderRouter(graph, addressing, routing, selectedNode.id) : [];\n  const selectedNextHopOptions = selectedNode?.kind === 'router' ? nextHopOptionsForBuilderRouter(graph, addressing, selectedNode.id) : [];\n  const effectiveStaticNextHop = selectedNextHopOptions.some((option) => option.address === staticNextHop) ? staticNextHop : (selectedNextHopOptions[0]?.address ?? '');\n  const destinationInterface = interfacesForBuilderNode(addressing, destinationId)[0];\n  const destinationPrefix = destinationInterface ? (addressing.segments[destinationInterface.linkId]?.cidr ?? '0.0.0.0/0') : '0.0.0.0/0';\n  const activeLinks = new Set(route.linkIds);\n  const forwardingLinks = new Set(forwardingTrace.hops.flatMap((hop) => hop.linkId ? [hop.linkId] : []));",
    'route table projections',
)
old_commit = """  const commitGraph = (next: BuilderGraph) => {
    setGraph(next);
    setAddressing((current) => reconcileBuilderAddressing(next, current));
    const nextSource = chooseValidNode(next, sourceId);
"""
new_commit = """  const commitGraph = (next: BuilderGraph) => {
    const nextAddressing = reconcileBuilderAddressing(next, addressing);
    const nextRouting = reconcileBuilderRoutingConfig(next, nextAddressing, routing);
    setGraph(next);
    setAddressing(nextAddressing);
    setRouting(nextRouting);
    const nextSource = chooseValidNode(next, sourceId);
"""
text = replace_once(text, old_commit, new_commit, 'graph+routing reconcile')

# helper functions before updateLink
anchor = """  const updateLink = (linkId: string, patch: Partial<{ cost: number; failed: boolean }>) => {
"""
helpers = """  const commitAddressing = (next: BuilderAddressing) => {
    setAddressing(next);
    setRouting(reconcileBuilderRoutingConfig(graph, next, routing));
  };

  const installCurrentStaticPath = () => {
    try {
      const installed = installStaticRoutesForWeightedPath(graph, addressing, routing, sourceId, destinationId);
      setRouting(installed.routing);
      setMessage(`STATIC PATH INSTALLED · ${installed.prefix} via ${installed.installedRouterIds.length === 0 ? 'connected routes only' : installed.installedRouterIds.map((id) => labelFor(graph,id)).join(' → ')}. This snapshots the current graph path and will not reconverge automatically.`);
    } catch (error) {
      setMessage(`STATIC INSTALL REJECTED · ${error instanceof Error ? error.message : 'Unable to install static path.'}`);
    }
  };

  const addStaticRoute = () => {
    if (!selectedNode || selectedNode.kind !== 'router') { setMessage('Select a router before adding a static route.'); return; }
    if (!effectiveStaticNextHop) { setMessage(`${selectedNode.label} has no directly connected next hop.`); return; }
    try {
      const next = upsertBuilderStaticRoute(graph, addressing, routing, { routerId: selectedNode.id, prefix: staticPrefix, nextHop: effectiveStaticNextHop, metric: staticMetric });
      setRouting(next);
      const installed = next.staticRoutes.find((entry) => entry.routerId === selectedNode.id && entry.prefix === staticPrefix.trim() && entry.nextHop === effectiveStaticNextHop) ?? next.staticRoutes.at(-1);
      setMessage(`STATIC ROUTE · ${selectedNode.label} ${installed?.prefix ?? staticPrefix} via ${effectiveStaticNextHop} metric ${staticMetric}.`);
    } catch (error) {
      setMessage(`STATIC ROUTE REJECTED · ${error instanceof Error ? error.message : 'Invalid static route.'}`);
    }
  };

  const updateLink = (linkId: string, patch: Partial<{ cost: number; failed: boolean }>) => {
"""
text = replace_once(text, anchor, helpers, 'static routing actions')

text = replace_once(
    text,
    "    setAddressing(cloneBuilderAddressing(initialAddressing ?? createDefaultBuilderAddressing(initialGraph)));\n    setSourceId(initialSourceId);",
    "    setAddressing(cloneBuilderAddressing(initialAddressing ?? createDefaultBuilderAddressing(initialGraph)));\n    setRouting(cloneBuilderRoutingConfig(initialRouting ?? createDefaultBuilderRoutingConfig()));\n    setSourceId(initialSourceId);",
    'reset routing',
)
text = text.replace('setMessage(\'Topology and L3 address plan reset. Visual layout was left untouched.\');', "setMessage('Topology, addressing, and static routing reset. Visual layout was left untouched.');")

text = replace_once(
    text,
    "      const scenario = createBuilderScenario(scenarioName.trim() || 'Untitled topology', graph, sourceId, destinationId, layout, addressing, existing);",
    "      const scenario = createBuilderScenario(scenarioName.trim() || 'Untitled topology', graph, sourceId, destinationId, layout, addressing, routing, existing);",
    'save scenario v4',
)
text = text.replace('Saved “${scenario.name}” locally as Builder schema v2.', 'Saved “${scenario.name}” locally as Builder schema v4.')
text = replace_once(
    text,
    "  const restoreScenario = (scenario: BuilderScenarioV3) => {\n    setGraph(cloneBuilderGraph(scenario.graph)); setAddressing(cloneBuilderAddressing(scenario.addressing)); setLayout",
    "  const restoreScenario = (scenario: BuilderScenarioV4) => {\n    setGraph(cloneBuilderGraph(scenario.graph)); setAddressing(cloneBuilderAddressing(scenario.addressing)); setRouting(cloneBuilderRoutingConfig(scenario.routing)); setLayout",
    'restore scenario routing',
)
text = replace_once(
    text,
    "      const scenario = createBuilderScenario(scenarioName.trim() || 'Exported topology', graph, sourceId, destinationId, layout, addressing);",
    "      const scenario = createBuilderScenario(scenarioName.trim() || 'Exported topology', graph, sourceId, destinationId, layout, addressing, routing);",
    'export scenario routing',
)
text = text.replace("setMessage('Scenario v3 exported with topology, layout, and IPv4 addressing.');", "setMessage('Scenario v4 exported with topology, addressing, and static routing.');")

# Stage meta + link classes + forwarding panel
old_meta = "<div className=\"builder-stage-meta\"><div><span>STATUS</span><strong>{route.reachable ? 'ROUTE INSTALLED' : 'UNREACHABLE'}</strong></div><div><span>PATH COST</span><strong>{route.totalCost ?? '—'}</strong></div><div><span>GRAPH</span><strong>{graph.nodes.length} NODES · {graph.links.length} LINKS</strong></div></div>"
new_meta = "<div className=\"builder-stage-meta\"><div><span>GRAPH PATH</span><strong>{route.reachable ? `YES · COST ${route.totalCost}` : 'NO PATH'}</strong></div><div><span>L3 FORWARDING</span><strong>{forwardingTrace.reachable ? 'REACHABLE' : 'NO ROUTE'}</strong></div><div><span>STATIC</span><strong>{routing.staticRoutes.length} ROUTES</strong></div><div><span>GRAPH</span><strong>{graph.nodes.length}N · {graph.links.length}L</strong></div></div>"
text = replace_once(text, old_meta, new_meta, 'stage route split')
text = replace_once(
    text,
    "const active = activeLinks.has(link.id);\n                return <g key={link.id} className={`builder-link ${link.failed ? 'failed' : active ? 'active' : 'alternate'} ${selectedLinkId === link.id ? 'selected' : ''}`}",
    "const active = activeLinks.has(link.id); const forwarding = forwardingLinks.has(link.id);\n                return <g key={link.id} className={`builder-link ${link.failed ? 'failed' : active ? 'active' : 'alternate'} ${forwarding ? 'l3-forwarding' : ''} ${selectedLinkId === link.id ? 'selected' : ''}`}",
    'forwarding link class',
)
text = replace_once(
    text,
    "          <div className={`builder-route ${route.reachable ? '' : 'unreachable'}`}><span>WINNING PATH</span><strong>{route.reachable ? route.nodeIds.map((id) => labelFor(graph,id)).join(' → ') : 'NO VIABLE PATH'}</strong><p>{route.explanation}</p></div>\n          <div className=\"builder-message\">{message}</div>",
    "          <div className={`builder-route ${route.reachable ? '' : 'unreachable'}`}><span>WEIGHTED GRAPH PATH</span><strong>{route.reachable ? route.nodeIds.map((id) => labelFor(graph,id)).join(' → ') : 'NO VIABLE PATH'}</strong><p>{route.explanation}</p></div>\n          <div className={`builder-forwarding ${forwardingTrace.reachable ? '' : 'unreachable'}`}><span>L3 FORWARDING · {forwardingTrace.destinationAddress ?? 'NO DESTINATION IP'}</span><strong>{forwardingTrace.reachable ? [sourceId,...forwardingTrace.hops.map((hop)=>hop.nextNodeId).filter((id): id is string=>Boolean(id))].filter((id,index,all)=>index===0||id!==all[index-1]).map((id)=>labelFor(graph,id)).join(' → ') : `${forwardingTrace.failureNodeId ? labelFor(graph,forwardingTrace.failureNodeId) : 'FORWARDING'} · ${forwardingTrace.failureReason ?? 'NO ROUTE'}`}</strong><p>{forwardingTrace.explanation}</p>{forwardingTrace.hops.length>0&&<div className=\"builder-forwarding-hops\">{forwardingTrace.hops.map((hop,index)=><span key={`${hop.nodeId}-${index}`}><b>{hop.nodeLabel}</b>{hop.routeSource.toUpperCase()} · {hop.matchedPrefix ?? '—'} · {hop.nextHop ?? 'LOCAL'} · {hop.outgoingInterface ?? '—'}</span>)}</div>}</div>\n          <div className=\"builder-message\">{message}</div>",
    'forwarding summary',
)

# Endpoints quick static controls
old_endpoints = '<section><div className="control-title"><span>ENDPOINTS</span><strong>ROUTE QUERY</strong></div><label>SOURCE<select value={sourceId} onChange={(e)=>setSourceId(e.currentTarget.value)}>{graph.nodes.map((node)=><option key={node.id} value={node.id}>{node.label}</option>)}</select></label><label>DESTINATION<select value={destinationId} onChange={(e)=>setDestinationId(e.currentTarget.value)}>{graph.nodes.map((node)=><option key={node.id} value={node.id}>{node.label}</option>)}</select></label></section>'
new_endpoints = '<section><div className="control-title"><span>ENDPOINTS</span><strong>GRAPH ↔ IP</strong></div><label>SOURCE<select value={sourceId} onChange={(e)=>setSourceId(e.currentTarget.value)}>{graph.nodes.map((node)=><option key={node.id} value={node.id}>{node.label}</option>)}</select></label><label>DESTINATION<select value={destinationId} onChange={(e)=>setDestinationId(e.currentTarget.value)}>{graph.nodes.map((node)=><option key={node.id} value={node.id}>{node.label}</option>)}</select></label><div className="button-row"><button type="button" onClick={installCurrentStaticPath}>INSTALL STATIC PATH</button><button type="button" onClick={()=>{setRouting(createDefaultBuilderRoutingConfig());setMessage(\'All static routes cleared. Connected routes remain derived from active interfaces.\');}}>CLEAR STATICS</button></div><small className="builder-routing-note">INSTALL snapshots the current weighted path. Static routes do not reconverge when a link fails.</small></section>'
text = replace_once(text, old_endpoints, new_endpoints, 'static quick install')

# Address editing must reconcile static next hops.
text = text.replace('setAddressing(next);setMessage(`${labelFor(graph,selectedLink.a)}', 'commitAddressing(next);setMessage(`${labelFor(graph,selectedLink.a)}')
text = text.replace('setAddressing(next);setMessage(`${entry.nodeId.toUpperCase()}', 'commitAddressing(next);setMessage(`${entry.nodeId.toUpperCase()}')
text = text.replace('setAddressing(next);setMessage(`${selectedNode.label} default gateway', 'commitAddressing(next);setMessage(`${selectedNode.label} default gateway')

# Replace L3 note wording.
text = text.replace('IPV4 METADATA · DOES NOT CHANGE LINK COST · ROUTE TABLES NEXT', 'IPV4 SEGMENT · ROUTING TABLE USES THIS PREFIX · LINK COST STAYS SEPARATE')

# Insert route table section after selected device.
device_anchor = """          <section className=\"builder-device-section\"><div className=\"control-title\"><span>SELECTED DEVICE</span><strong>{selectedNode ? `${selectedNode.kind.toUpperCase()} · ${selectedNodeInterfaces.length} IF` : 'NONE'}</strong></div>{selectedNode && <><div className=\"builder-interface-list\">{selectedNodeInterfaces.length===0?<small>NO INTERFACES · CONNECT THIS DEVICE TO A LINK</small>:selectedNodeInterfaces.map((entry)=><div key={`${entry.linkId}-${entry.name}`}><span>{entry.name}</span><strong>{entry.address}</strong><small>{entry.cidr} · {entry.linkId.toUpperCase()}</small></div>)}</div>{selectedNode.kind==='endpoint'&&<label>DEFAULT GATEWAY<input key={`${selectedNode.id}-${addressing.defaultGateways[selectedNode.id]??'none'}`} defaultValue={addressing.defaultGateways[selectedNode.id]??''} placeholder=\"NONE\" onBlur={(event)=>{try{const next=replaceBuilderDefaultGateway(graph,addressing,selectedNode.id,event.currentTarget.value||null);commitAddressing(next);setMessage(`${selectedNode.label} default gateway ${next.defaultGateways[selectedNode.id]??'cleared'}.`);}catch(error){setMessage(`GATEWAY REJECTED · ${error instanceof Error?error.message:'Invalid default gateway.'}`);event.currentTarget.value=addressing.defaultGateways[selectedNode.id]??'';}}}/></label>}</>}</section>
"""
routing_section = device_anchor + """          <section className=\"builder-routing-section\"><div className=\"control-title\"><span>ROUTE TABLE</span><strong>{selectedNode?.kind === 'router' ? `${selectedRouteTable.filter((entry)=>entry.active).length} ACTIVE · ${selectedRouteTable.length} TOTAL` : 'ENDPOINT DEFAULT'}</strong></div>{selectedNode?.kind === 'router'?<><div className=\"builder-route-table\">{selectedRouteTable.length===0?<small>NO ROUTES</small>:selectedRouteTable.map((entry)=><div key={entry.id} className={entry.active?'':'inactive'}><span>{entry.source==='connected'?'C':'S'}</span><strong>{entry.prefix}</strong><small>{entry.source==='connected'?'DIRECT':`via ${entry.nextHop}`} · {entry.outgoingInterface} · AD {entry.administrativeDistance} · M {entry.metric} · {entry.stateNote}</small>{entry.source==='static'&&<button type=\"button\" aria-label={`Delete route ${entry.prefix} via ${entry.nextHop}`} onClick={()=>{setRouting(deleteBuilderStaticRoute(graph,addressing,routing,entry.id));setMessage(`${selectedNode.label} static route ${entry.prefix} removed.`);}}>×</button>}</div>)}</div><div className=\"builder-static-form\"><label>DESTINATION PREFIX<input value={staticPrefix} onChange={(event)=>setStaticPrefix(event.currentTarget.value)}/></label><button type=\"button\" onClick={()=>setStaticPrefix(destinationPrefix)}>USE DEST PREFIX</button><label>NEXT HOP<select value={effectiveStaticNextHop} onChange={(event)=>setStaticNextHop(event.currentTarget.value)}>{selectedNextHopOptions.length===0?<option value=\"\">NO NEIGHBORS</option>:selectedNextHopOptions.map((option)=><option key={`${option.linkId}-${option.address}`} value={option.address}>{option.nodeLabel} · {option.address}{option.linkFailed?' · DOWN':''}</option>)}</select></label><label>METRIC<input type=\"number\" min={1} max={999} value={staticMetric} onChange={(event)=>setStaticMetric(Math.max(1,Math.min(999,Math.round(Number(event.currentTarget.value)||1))))}/></label><button type=\"button\" onClick={addStaticRoute} disabled={!effectiveStaticNextHop}>ADD / REPLACE STATIC</button></div><small className=\"builder-routing-note\">LOOKUP: LONGEST PREFIX → AD → METRIC. CONNECTED AD 0 · STATIC AD 1.</small></>:<small className=\"builder-routing-note\">Endpoints forward directly on-link or send off-link traffic to their configured default gateway. Select a router to inspect connected and static routes.</small>}</section>
"""
text = replace_once(text, device_anchor, routing_section, 'route table UI')

text = text.replace('<section><div className="control-title"><span>SCENARIOS</span><strong>SCHEMA V3 · L3</strong></div>', '<section><div className="control-title"><span>SCENARIOS</span><strong>SCHEMA V4 · STATIC</strong></div>')
path.write_text(text)

# ---- CSS ----
css_path = root / 'src/NetworkBuilder.css'
css = css_path.read_text()
css = css.replace('grid-template-rows:auto minmax(460px,1fr) auto auto;', 'grid-template-rows:auto minmax(460px,1fr) auto auto auto;', 1)
css = css.replace('.builder-link.selected line:not(.hit){stroke-width:2.2}', '.builder-link.selected line:not(.hit){stroke-width:2.2}.builder-link.l3-forwarding line:not(.hit){stroke:#7a9cff;stroke-width:1.55;filter:drop-shadow(0 0 4px rgba(122,156,255,.38))}.builder-link.failed.l3-forwarding line:not(.hit){stroke:#e76b6b;stroke-dasharray:2.5 2}.builder-link.active.l3-forwarding line:not(.hit){stroke:#79f2da;stroke-width:2.15;filter:drop-shadow(0 0 5px rgba(121,242,218,.55))}', 1)
route_anchor = '.builder-route.unreachable strong{color:#ff9b9b}'
route_css = route_anchor + '.builder-forwarding{display:grid;gap:5px;padding:13px 18px;border-top:1px solid rgba(255,255,255,.075);background:rgba(122,156,255,.045)}.builder-forwarding>span{color:#7184a8;font-size:.5rem;font-weight:850;letter-spacing:.13em}.builder-forwarding>strong{color:#dfe6ff;font-size:.82rem;letter-spacing:.025em}.builder-forwarding>p{margin:0;color:#788895;font-size:.65rem;line-height:1.4}.builder-forwarding.unreachable{background:rgba(231,107,107,.04)}.builder-forwarding.unreachable>strong{color:#ff9b9b}.builder-forwarding-hops{display:flex;gap:5px;overflow:auto;padding-top:3px}.builder-forwarding-hops>span{flex:0 0 auto;display:grid;gap:2px;min-width:125px;padding:6px 7px;border:1px solid rgba(122,156,255,.12);border-radius:4px;color:#667681;font-size:.43rem;letter-spacing:.035em}.builder-forwarding-hops b{color:#9fb2e8;font-size:.48rem;letter-spacing:.07em}.builder-routing-note{color:#596a75;font-size:.44rem;font-weight:820;letter-spacing:.06em;line-height:1.45}.builder-route-table{display:grid;gap:4px}.builder-route-table>small{color:#58656e;font-size:.46rem}.builder-route-table>div{position:relative;display:grid;grid-template-columns:18px 1fr;gap:2px 7px;padding:7px 28px 7px 7px;border:1px solid rgba(255,255,255,.065);border-radius:4px;background:rgba(255,255,255,.018)}.builder-route-table>div.inactive{opacity:.5}.builder-route-table span{grid-row:1/3;display:grid;place-items:center;color:#7a9cff;font:900 .52rem ui-monospace,SFMono-Regular,Menlo,monospace}.builder-route-table strong{color:#dce5ea;font:700 .59rem ui-monospace,SFMono-Regular,Menlo,monospace}.builder-route-table small{color:#5f6f79;font-size:.42rem;letter-spacing:.035em}.builder-route-table button{position:absolute;top:7px;right:7px;padding:2px 5px;font-size:.5rem}.builder-static-form{display:grid;grid-template-columns:1fr auto;gap:6px;align-items:end}.builder-static-form label{grid-column:1/-1}.builder-static-form>button{white-space:nowrap}.builder-static-form>button:first-of-type{grid-column:2;grid-row:1;align-self:end}.builder-static-form>label:first-child{grid-column:1;grid-row:1}.builder-static-form>button:last-child{grid-column:1/-1}'
css = replace_once(css, route_anchor, route_css, 'routing CSS')
css = css.replace('@media(max-width:560px){.builder-interface-grid{grid-template-columns:1fr}', '@media(max-width:560px){.builder-interface-grid{grid-template-columns:1fr}.builder-stage-meta{grid-template-columns:repeat(2,1fr)!important}.builder-forwarding-hops{display:grid;grid-template-columns:1fr 1fr}.builder-forwarding-hops>span{min-width:0}.builder-static-form{grid-template-columns:1fr}', 1)
css_path.write_text(css)

# ---- Existing contracts/schema expectations ----
address_contract_path = root / 'scripts/builder-addressing-contract-check.mjs'
address_contract = address_contract_path.read_text()
address_contract = address_contract.replace('assert.equal(scenario.version, 3);', 'assert.equal(scenario.version, 4);')
address_contract = address_contract.replace('assert.equal(migratedV2.version, 3);', 'assert.equal(migratedV2.version, 4);')
address_contract = address_contract.replace("assert.equal(deserializeBuilderScenario(JSON.stringify(legacyV1)).version, 3);", "assert.equal(deserializeBuilderScenario(JSON.stringify(legacyV1)).version, 4);")
insert_anchor = """const malformedV3 = JSON.parse(serializeBuilderScenario(scenario));
"""
legacy_v3 = """const legacyV3 = {
  schema: 'hopscotch.builder',
  version: 3,
  name: 'Legacy v3',
  graph,
  addressing: validated,
  sourceId: 'client',
  destinationId: 'app',
  layout: defaultBuilderLayout,
  createdAt: now,
  updatedAt: now,
};
const migratedV3 = deserializeBuilderScenario(JSON.stringify(legacyV3));
assert.equal(migratedV3.version, 4);
assert.deepEqual(migratedV3.addressing, validated);
assert.deepEqual(migratedV3.routing.staticRoutes, []);

const malformedV3 = JSON.parse(serializeBuilderScenario(scenario));
"""
address_contract = replace_once(address_contract, insert_anchor, legacy_v3, 'v3 migration contract')
address_contract_path.write_text(address_contract)

hd_path = root / 'scripts/high-density-contract-check.mjs'
hd = hd_path.read_text().replace('assert.equal(restoredBuilder.version, 3);', 'assert.equal(restoredBuilder.version, 4);')
hd = hd.replace("assert.equal(Object.keys(restoredBuilder.addressing.segments).length, STRESS_BUILDER_LINK_COUNT);", "assert.equal(Object.keys(restoredBuilder.addressing.segments).length, STRESS_BUILDER_LINK_COUNT);\nassert.deepEqual(restoredBuilder.routing.staticRoutes, []);")
hd_path.write_text(hd)

# ---- Package ----
pkg_path = root / 'package.json'
pkg = json.loads(pkg_path.read_text())
scripts = pkg['scripts']
if 'test:builder-routing-contract' in scripts:
    raise SystemExit('builder routing contract already wired')
scripts['test:builder-routing-contract'] = 'node scripts/builder-routing-contract-check.mjs'
needle = 'npm run test:builder-contract && npm run test:builder-addressing-contract && npm run test:worker-contract'
replacement = 'npm run test:builder-contract && npm run test:builder-addressing-contract && npm run test:builder-routing-contract && npm run test:worker-contract'
if scripts['check'].count(needle) != 1:
    raise SystemExit('package builder routing anchor missing or ambiguous')
scripts['check'] = scripts['check'].replace(needle, replacement, 1)
pkg_path.write_text(json.dumps(pkg, indent=2) + '\n')

# ---- Roadmap ----
roadmap_path = root / 'docs/ROADMAP.md'
roadmap = roadmap_path.read_text()
anchor = '- [x] permanent Builder L3 addressing contract wired into `npm run check`\n\n## Performance + rendering — ongoing\n'
if roadmap.count(anchor) != 1:
    raise SystemExit('roadmap 11A anchor missing or ambiguous')
section = """- [x] permanent Builder L3 addressing contract wired into `npm run check`

### 11B — Connected + static routing
- [x] derive connected route-table entries from active L3 interfaces; failed links withdraw connected reachability
- [x] add explicit static routes on router nodes with destination prefix, directly connected next hop, and metric
- [x] route lookup uses longest prefix → administrative distance → metric → deterministic ID
- [x] connected routes use AD 0 and static routes AD 1
- [x] endpoint forwarding uses on-link delivery or the configured default gateway
- [x] deterministic hop-by-hop L3 forwarding trace detects no-route, link-down, invalid-next-hop, and forwarding-loop states
- [x] graph path and L3 forwarding are shown separately; a graph can be physically reachable while IP forwarding is not configured
- [x] explicit INSTALL STATIC PATH snapshots the current weighted path without creating automatic reconvergence
- [x] static path stays broken after a link failure even when the weighted graph finds an alternate path; reinstall is an explicit user action
- [x] selected-router route table exposes C/S source, prefix, next hop, outgoing interface, AD, metric, active/down state, and route deletion
- [x] manual static route editor supports /0–/32 and only directly connected next-hop interface addresses
- [x] addressing/topology changes reconcile invalid static routes instead of silently retaining broken configuration
- [x] Builder scenario schema v4 persists routing; v1/v2/v3 files migrate with an empty static table
- [x] high-density schema-v4 round trip preserves addressing and empty routing at the 32-node / 96-link ceiling
- [x] permanent Builder static-routing/forwarding contract wired into `npm run check`

## Performance + rendering — ongoing
"""
roadmap = roadmap.replace(anchor, section, 1)
roadmap_path.write_text(roadmap)

print('Applied Lab 11B Builder static routing + forwarding integration.')
