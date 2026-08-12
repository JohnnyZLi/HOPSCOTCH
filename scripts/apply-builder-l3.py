from pathlib import Path
import json

root = Path('.')

def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one anchor, found {count}')
    return text.replace(old, new, 1)

# NetworkBuilder integration
path = root / 'src/NetworkBuilder.tsx'
text = path.read_text()
text = replace_once(
    text,
    "import { motion, useReducedMotion } from 'motion/react';\nimport { useMemo, useRef, useState } from 'react';\n",
    "import { motion, useReducedMotion } from 'motion/react';\nimport { useMemo, useRef, useState } from 'react';\nimport {\n  cloneBuilderAddressing,\n  createDefaultBuilderAddressing,\n  interfacesForBuilderNode,\n  reconcileBuilderAddressing,\n  replaceBuilderDefaultGateway,\n  replaceBuilderInterfaceAddress,\n  replaceBuilderSegmentCidr,\n  type BuilderAddressing,\n} from './builder/addressing.ts';\n",
    'builder addressing imports',
)
text = replace_once(
    text,
    "  type BuilderScenarioV2,\n} from './builder/scenario';",
    "  type BuilderScenarioV3,\n} from './builder/scenario';",
    'scenario v3 type import',
)
old_sig = "export function NetworkBuilder({ onExit, onOpenFailureStory, initialGraph = defaultBuilderGraph, initialLayout = defaultBuilderLayout, initialSourceId = 'client', initialDestinationId = 'app', stressLabel }: { onExit: () => void; onOpenFailureStory: () => void; initialGraph?: BuilderGraph; initialLayout?: BuilderLayout; initialSourceId?: string; initialDestinationId?: string; stressLabel?: string }) {"
new_sig = "export function NetworkBuilder({ onExit, onOpenFailureStory, initialGraph = defaultBuilderGraph, initialLayout = defaultBuilderLayout, initialAddressing, initialSourceId = 'client', initialDestinationId = 'app', stressLabel }: { onExit: () => void; onOpenFailureStory: () => void; initialGraph?: BuilderGraph; initialLayout?: BuilderLayout; initialAddressing?: BuilderAddressing; initialSourceId?: string; initialDestinationId?: string; stressLabel?: string }) {"
text = replace_once(text, old_sig, new_sig, 'builder signature')
text = replace_once(
    text,
    "  const [graph, setGraph] = useState<BuilderGraph>(() => cloneBuilderGraph(initialGraph));\n  const [layout, setLayout] = useState<BuilderLayout>(() => cloneBuilderLayout(initialLayout));",
    "  const [graph, setGraph] = useState<BuilderGraph>(() => cloneBuilderGraph(initialGraph));\n  const [addressing, setAddressing] = useState<BuilderAddressing>(() => cloneBuilderAddressing(initialAddressing ?? createDefaultBuilderAddressing(initialGraph)));\n  const [layout, setLayout] = useState<BuilderLayout>(() => cloneBuilderLayout(initialLayout));",
    'addressing state',
)
text = replace_once(
    text,
    "  const [sourceId, setSourceId] = useState(initialSourceId);\n  const [destinationId, setDestinationId] = useState(initialDestinationId);\n  const [selectedLinkId, setSelectedLinkId] = useState(() => initialGraph.links[0]?.id ?? '');",
    "  const [sourceId, setSourceId] = useState(initialSourceId);\n  const [destinationId, setDestinationId] = useState(initialDestinationId);\n  const [selectedNodeId, setSelectedNodeId] = useState(initialSourceId);\n  const [selectedLinkId, setSelectedLinkId] = useState(() => initialGraph.links[0]?.id ?? '');",
    'selected node state',
)
text = replace_once(
    text,
    "  const [saved, setSaved] = useState<BuilderScenarioV2[]>(() => listStoredBuilderScenarios());",
    "  const [saved, setSaved] = useState<BuilderScenarioV3[]>(() => listStoredBuilderScenarios());",
    'saved scenario v3 state',
)
text = replace_once(
    text,
    "  const selectedLink = graph.links.find((link) => link.id === selectedLinkId) ?? graph.links[0];\n  const activeLinks = new Set(route.linkIds);",
    "  const selectedLink = graph.links.find((link) => link.id === selectedLinkId) ?? graph.links[0];\n  const selectedNode = graph.nodes.find((node) => node.id === selectedNodeId) ?? graph.nodes[0];\n  const selectedSegment = selectedLink ? addressing.segments[selectedLink.id] : undefined;\n  const selectedNodeInterfaces = selectedNode ? interfacesForBuilderNode(addressing, selectedNode.id) : [];\n  const activeLinks = new Set(route.linkIds);",
    'selected L3 projections',
)
text = replace_once(
    text,
    "  const commitGraph = (next: BuilderGraph) => {\n    setGraph(next);",
    "  const commitGraph = (next: BuilderGraph) => {\n    setGraph(next);\n    setAddressing((current) => reconcileBuilderAddressing(next, current));",
    'topology addressing reconcile',
)
text = replace_once(
    text,
    "    setDestinationId(nextDestination);\n    if (!next.links.some((link) => link.id === selectedLinkId)) setSelectedLinkId(next.links[0]?.id ?? '');",
    "    setDestinationId(nextDestination);\n    if (!next.nodes.some((node) => node.id === selectedNodeId)) setSelectedNodeId(nextSource);\n    if (!next.links.some((link) => link.id === selectedLinkId)) setSelectedLinkId(next.links[0]?.id ?? '');",
    'selected node reconcile',
)
text = replace_once(
    text,
    "    setGraph(cloneBuilderGraph(initialGraph));\n    setSourceId(initialSourceId); setDestinationId(initialDestinationId); setSelectedLinkId(initialGraph.links[0]?.id ?? ''); setNewLinkA(initialGraph.nodes[0]?.id ?? ''); setNewLinkB(initialGraph.nodes[1]?.id ?? initialGraph.nodes[0]?.id ?? ''); setNewLinkCost(5);\n    setMessage('Topology truth reset. Layout was left untouched.');",
    "    setGraph(cloneBuilderGraph(initialGraph));\n    setAddressing(cloneBuilderAddressing(initialAddressing ?? createDefaultBuilderAddressing(initialGraph)));\n    setSourceId(initialSourceId); setDestinationId(initialDestinationId); setSelectedNodeId(initialSourceId); setSelectedLinkId(initialGraph.links[0]?.id ?? ''); setNewLinkA(initialGraph.nodes[0]?.id ?? ''); setNewLinkB(initialGraph.nodes[1]?.id ?? initialGraph.nodes[0]?.id ?? ''); setNewLinkCost(5);\n    setMessage('Topology and L3 address plan reset. Visual layout was left untouched.');",
    'reset addressing',
)
text = replace_once(
    text,
    "      const scenario = createBuilderScenario(scenarioName.trim() || 'Untitled topology', graph, sourceId, destinationId, layout, existing);",
    "      const scenario = createBuilderScenario(scenarioName.trim() || 'Untitled topology', graph, sourceId, destinationId, layout, addressing, existing);",
    'save v3 addressing',
)
text = replace_once(
    text,
    "  const restoreScenario = (scenario: BuilderScenarioV2) => {\n    setGraph(cloneBuilderGraph(scenario.graph)); setLayout(cloneBuilderLayout(scenario.layout)); setSourceId(scenario.sourceId); setDestinationId(scenario.destinationId);\n    setSelectedLinkId(scenario.graph.links[0]?.id ?? ''); setScenarioName(scenario.name);",
    "  const restoreScenario = (scenario: BuilderScenarioV3) => {\n    setGraph(cloneBuilderGraph(scenario.graph)); setAddressing(cloneBuilderAddressing(scenario.addressing)); setLayout(cloneBuilderLayout(scenario.layout)); setSourceId(scenario.sourceId); setDestinationId(scenario.destinationId);\n    setSelectedNodeId(scenario.sourceId); setSelectedLinkId(scenario.graph.links[0]?.id ?? ''); setScenarioName(scenario.name);",
    'restore v3 addressing',
)
text = replace_once(
    text,
    "      const scenario = createBuilderScenario(scenarioName.trim() || 'Exported topology', graph, sourceId, destinationId, layout);",
    "      const scenario = createBuilderScenario(scenarioName.trim() || 'Exported topology', graph, sourceId, destinationId, layout, addressing);",
    'export v3 addressing',
)
text = replace_once(
    text,
    "      setMessage('Scenario v2 exported as portable JSON.');",
    "      setMessage('Scenario v3 exported with topology, layout, and IPv4 addressing.');",
    'export message v3',
)
text = replace_once(
    text,
    "                <motion.div className={`builder-node ${node.kind} ${onRoute ? 'on-route' : ''}`} drag dragMomentum={false} dragElastic={0} onDragEnd={(_, info) => onNodeDragEnd(node.id, info.offset.x, info.offset.y)} whileDrag={reduceMotion ? undefined : { scale: 1.08, zIndex: 8 }}>",
    "                <motion.div className={`builder-node ${node.kind} ${onRoute ? 'on-route' : ''} ${selectedNode?.id === node.id ? 'selected' : ''}`} drag dragMomentum={false} dragElastic={0} onPointerDown={() => setSelectedNodeId(node.id)} onDragEnd={(_, info) => onNodeDragEnd(node.id, info.offset.x, info.offset.y)} whileDrag={reduceMotion ? undefined : { scale: 1.08, zIndex: 8 }}>",
    'select device on pointer',
)
old_controls = """          <section><div className=\"control-title\"><span>SELECTED LINK</span><strong>{selectedLink ? `${labelFor(graph,selectedLink.a)} ↔ ${labelFor(graph,selectedLink.b)}` : 'NONE'}</strong></div>{selectedLink && <><label>COST<input type=\"number\" min={1} max={999} value={selectedLink.cost} onChange={(e)=>updateLink(selectedLink.id,{cost:Math.max(1,Math.min(999,Math.round(Number(e.currentTarget.value)||1)))})}/></label><div className=\"button-row\"><button type=\"button\" onClick={()=>updateLink(selectedLink.id,{failed:!selectedLink.failed})}>{selectedLink.failed?'RESTORE':'FAIL LINK'}</button><button type=\"button\" onClick={()=>deleteLink(selectedLink.id)}>DELETE</button></div></>}</section>
          <section><div className=\"control-title\"><span>AUTHOR</span><strong>TOPOLOGY</strong></div>"""
new_controls = """          <section><div className=\"control-title\"><span>SELECTED LINK</span><strong>{selectedLink ? `${labelFor(graph,selectedLink.a)} ↔ ${labelFor(graph,selectedLink.b)}` : 'NONE'}</strong></div>{selectedLink && <><label>COST<input type=\"number\" min={1} max={999} value={selectedLink.cost} onChange={(e)=>updateLink(selectedLink.id,{cost:Math.max(1,Math.min(999,Math.round(Number(e.currentTarget.value)||1)))})}/></label><div className=\"button-row\"><button type=\"button\" onClick={()=>updateLink(selectedLink.id,{failed:!selectedLink.failed})}>{selectedLink.failed?'RESTORE':'FAIL LINK'}</button><button type=\"button\" onClick={()=>deleteLink(selectedLink.id)}>DELETE</button></div></>}</section>
          <section className=\"builder-l3-section\"><div className=\"control-title\"><span>L3 SEGMENT</span><strong>{selectedSegment?.cidr ?? 'NONE'}</strong></div>{selectedLink && selectedSegment && <><label>NETWORK CIDR<input key={`${selectedLink.id}-${selectedSegment.cidr}`} defaultValue={selectedSegment.cidr} onBlur={(event)=>{try{const next=replaceBuilderSegmentCidr(graph,addressing,selectedLink.id,event.currentTarget.value);setAddressing(next);setMessage(`${labelFor(graph,selectedLink.a)} ↔ ${labelFor(graph,selectedLink.b)} renumbered to ${next.segments[selectedLink.id].cidr}. Weighted path cost is unchanged.`);}catch(error){setMessage(`ADDRESSING REJECTED · ${error instanceof Error?error.message:'Invalid IPv4 segment.'}`);event.currentTarget.value=selectedSegment.cidr;}}}/></label><div className=\"builder-interface-grid\">{selectedSegment.interfaces.map((entry)=><label key={`${selectedLink.id}-${entry.nodeId}-${entry.address}`}>{labelFor(graph,entry.nodeId)} · {entry.name}<input defaultValue={entry.address} onBlur={(event)=>{try{const next=replaceBuilderInterfaceAddress(graph,addressing,selectedLink.id,entry.nodeId,event.currentTarget.value);setAddressing(next);setMessage(`${entry.nodeId.toUpperCase()} ${entry.name} is now ${next.segments[selectedLink.id].interfaces.find((item)=>item.nodeId===entry.nodeId)?.address}. Weighted route truth is unchanged.`);}catch(error){setMessage(`ADDRESSING REJECTED · ${error instanceof Error?error.message:'Invalid interface address.'}`);event.currentTarget.value=entry.address;}}}/></label>)}</div><small className=\"builder-l3-note\">IPV4 METADATA · DOES NOT CHANGE LINK COST · ROUTE TABLES NEXT</small></>}</section>
          <section className=\"builder-device-section\"><div className=\"control-title\"><span>SELECTED DEVICE</span><strong>{selectedNode ? `${selectedNode.kind.toUpperCase()} · ${selectedNodeInterfaces.length} IF` : 'NONE'}</strong></div>{selectedNode && <><div className=\"builder-interface-list\">{selectedNodeInterfaces.length===0?<small>NO INTERFACES · CONNECT THIS DEVICE TO A LINK</small>:selectedNodeInterfaces.map((entry)=><div key={`${entry.linkId}-${entry.name}`}><span>{entry.name}</span><strong>{entry.address}</strong><small>{entry.cidr} · {entry.linkId.toUpperCase()}</small></div>)}</div>{selectedNode.kind==='endpoint'&&<label>DEFAULT GATEWAY<input key={`${selectedNode.id}-${addressing.defaultGateways[selectedNode.id]??'none'}`} defaultValue={addressing.defaultGateways[selectedNode.id]??''} placeholder=\"NONE\" onBlur={(event)=>{try{const next=replaceBuilderDefaultGateway(graph,addressing,selectedNode.id,event.currentTarget.value||null);setAddressing(next);setMessage(`${selectedNode.label} default gateway ${next.defaultGateways[selectedNode.id]??'cleared'}.`);}catch(error){setMessage(`GATEWAY REJECTED · ${error instanceof Error?error.message:'Invalid default gateway.'}`);event.currentTarget.value=addressing.defaultGateways[selectedNode.id]??'';}}}/></label>}</>}</section>
          <section><div className=\"control-title\"><span>AUTHOR</span><strong>TOPOLOGY</strong></div>"""
text = replace_once(text, old_controls, new_controls, 'L3 controls')
text = replace_once(
    text,
    "<section><div className=\"control-title\"><span>SCENARIOS</span><strong>SCHEMA V2</strong></div>",
    "<section><div className=\"control-title\"><span>SCENARIOS</span><strong>SCHEMA V3 · L3</strong></div>",
    'scenario v3 UI label',
)
path.write_text(text)

# Builder CSS extensions
css_path = root / 'src/NetworkBuilder.css'
css = css_path.read_text()
anchor = '.builder-node.on-route{border-color:rgba(121,242,218,.7);box-shadow:0 0 0 1px rgba(121,242,218,.1),0 0 28px rgba(121,242,218,.09)}'
css = replace_once(css, anchor, anchor + '.builder-node.selected{outline:1px solid rgba(122,156,255,.72);outline-offset:3px}.builder-l3-section{border-color:rgba(122,156,255,.18)!important}.builder-interface-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}.builder-l3-note{color:#596a75;font-size:.44rem;font-weight:850;letter-spacing:.08em;line-height:1.45}.builder-interface-list{display:grid;gap:5px}.builder-interface-list>div{display:grid;grid-template-columns:auto 1fr;gap:2px 8px;padding:7px 8px;border:1px solid rgba(255,255,255,.065);border-radius:4px;background:rgba(255,255,255,.018)}.builder-interface-list span{grid-row:1/3;color:#7a9cff;font:850 .49rem ui-monospace,SFMono-Regular,Menlo,monospace}.builder-interface-list strong{color:#d9e3e8;font:700 .62rem ui-monospace,SFMono-Regular,Menlo,monospace}.builder-interface-list small{color:#58666f;font-size:.43rem;letter-spacing:.05em}.builder-interface-list>small{color:#59666e;font-size:.46rem;letter-spacing:.08em}', 'builder L3 CSS')
css = css.replace('@media(max-width:560px){', '@media(max-width:560px){.builder-interface-grid{grid-template-columns:1fr}', 1)
css_path.write_text(css)

# High-density loader no longer needs source rewriting now that scenario imports explicit .ts files.
hd_path = root / 'scripts/high-density-contract-check.mjs'
hd = hd_path.read_text()
hd = replace_once(hd, "import { readFileSync, rmSync, writeFileSync } from 'node:fs';\nimport { fileURLToPath, pathToFileURL } from 'node:url';\nimport { dirname, join } from 'node:path';\n", '', 'high-density temporary loader imports')
old_loader = """async function loadBuilderScenarioForNodeContract() {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const builderDir = join(scriptDir, '..', 'src', 'builder');
  const sourcePath = join(builderDir, 'scenario.ts');
  const tempPath = join(builderDir, '.stress-scenario-node.ts');
  const source = readFileSync(sourcePath, 'utf8');
  if (!source.includes(\"from './model';\")) throw new Error('Builder scenario import boundary changed; update high-density Node contract loader.');
  writeFileSync(tempPath, source.replace(\"from './model';\", \"from './model.ts';\"));
  try {
    return await import(`${pathToFileURL(tempPath).href}?stress-contract=${Date.now()}`);
  } finally {
    rmSync(tempPath, { force: true });
  }
}
"""
new_loader = """async function loadBuilderScenarioForNodeContract() {
  return import(`${new URL('../src/builder/scenario.ts', import.meta.url).href}?stress-contract=${Date.now()}`);
}
"""
hd = replace_once(hd, old_loader, new_loader, 'high-density direct scenario loader')
hd = replace_once(hd, "assert.equal(restoredBuilder.graph.links.length, STRESS_BUILDER_LINK_COUNT);\n", "assert.equal(restoredBuilder.graph.links.length, STRESS_BUILDER_LINK_COUNT);\nassert.equal(restoredBuilder.version, 3);\nassert.equal(Object.keys(restoredBuilder.addressing.segments).length, STRESS_BUILDER_LINK_COUNT);\n", 'high-density v3 addressing assertions')
hd_path.write_text(hd)

# Fix addressing contract to use a larger subnet for a valid manual host-address edit.
contract_path = root / 'scripts/builder-addressing-contract-check.mjs'
contract = contract_path.read_text()
contract = contract.replace("'10.44.9.0/30'", "'10.44.9.0/29'", 2)
contract = contract.replace("assert.equal(movedSegment.segments['client-edge'].cidr, '10.44.9.0/30');", "assert.equal(movedSegment.segments['client-edge'].cidr, '10.44.9.0/29');")
contract = contract.replace("replaceBuilderInterfaceAddress(graph, movedSegment, 'client-edge', 'client', '10.44.9.2')", "replaceBuilderInterfaceAddress(graph, movedSegment, 'client-edge', 'client', '10.44.9.3')")
contract = contract.replace("assert.equal(clientAddress, '10.44.9.2');", "assert.equal(clientAddress, '10.44.9.3');")
contract_path.write_text(contract)

# Package permanent contract.
pkg_path = root / 'package.json'
pkg = json.loads(pkg_path.read_text())
scripts = pkg['scripts']
if 'test:builder-addressing-contract' in scripts:
    raise SystemExit('builder addressing contract already wired')
scripts['test:builder-addressing-contract'] = 'node scripts/builder-addressing-contract-check.mjs'
needle = 'npm run typecheck && npm run test:builder-contract && npm run test:worker-contract'
replacement = 'npm run typecheck && npm run test:builder-contract && npm run test:builder-addressing-contract && npm run test:worker-contract'
if scripts['check'].count(needle) != 1:
    raise SystemExit('package check builder anchor missing or ambiguous')
scripts['check'] = scripts['check'].replace(needle, replacement, 1)
pkg_path.write_text(json.dumps(pkg, indent=2) + '\n')

# Roadmap: start substantive Builder phase after product surface.
roadmap_path = root / 'docs/ROADMAP.md'
roadmap = roadmap_path.read_text()
anchor = '- [x] permanent scenario-gallery contract wired into `npm run check`\n\n## Performance + rendering — ongoing\n'
if roadmap.count(anchor) != 1:
    raise SystemExit('roadmap 10D anchor missing or ambiguous')
section = """- [x] permanent scenario-gallery contract wired into `npm run check`

## Lab 11 — Deeper Network Builder

### 11A — L3 addressing foundation
- [x] keep weighted graph/path truth unchanged while adding a separate IPv4 addressing model
- [x] one explicit IPv4 segment per graph link with two named node interfaces
- [x] deterministic private /30 address plan for default and newly authored links
- [x] editable /8–/30 segment CIDRs with automatic interface renumbering
- [x] editable interface IPv4 addresses with host-range, duplicate-address, and overlapping-subnet rejection
- [x] endpoint default gateways must reference a directly connected router interface
- [x] device inspector lists stable ethN interfaces, addresses, segment CIDRs, and link identity
- [x] topology add/delete operations reconcile addressing without renumbering surviving segments
- [x] Builder scenario schema v3 persists addressing; v1/v2 files migrate deterministically
- [x] schema-v3 high-density 32-node / 96-link round trip remains inside existing ceilings
- [x] UI explicitly states addressing does not change weighted path cost yet; route tables are the next slice
- [x] permanent Builder L3 addressing contract wired into `npm run check`

## Performance + rendering — ongoing
"""
roadmap = roadmap.replace(anchor, section, 1)
roadmap_path.write_text(roadmap)

print('Applied Lab 11A Builder L3 addressing integration.')
