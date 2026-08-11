import { motion, useReducedMotion } from 'motion/react';
import { useMemo, useRef, useState } from 'react';
import {
  BUILDER_LIMITS,
  cloneBuilderGraph,
  cloneBuilderLayout,
  defaultBuilderGraph,
  defaultBuilderLayout,
  deterministicNewNodePoint,
  findShortestPath,
  nextGeneratedLinkId,
  nextGeneratedNodeId,
  undirectedLinkExists,
  type BuilderGraph,
  type BuilderLayout,
  type BuilderNodeKind,
} from './builder/model';
import {
  createBuilderScenario,
  deleteStoredBuilderScenario,
  deserializeBuilderScenario,
  listStoredBuilderScenarios,
  saveStoredBuilderScenario,
  serializeBuilderScenario,
  type BuilderScenarioV2,
} from './builder/scenario';
import './NetworkBuilder.css';

function labelFor(graph: BuilderGraph, id: string): string {
  return graph.nodes.find((node) => node.id === id)?.label ?? id.toUpperCase();
}

function chooseValidNode(graph: BuilderGraph, preferred: string, avoid?: string): string {
  if (graph.nodes.some((node) => node.id === preferred) && preferred !== avoid) return preferred;
  return graph.nodes.find((node) => node.id !== avoid)?.id ?? '';
}

export function NetworkBuilder({ onExit, onOpenFailureStory, initialGraph = defaultBuilderGraph, initialLayout = defaultBuilderLayout, initialSourceId = 'client', initialDestinationId = 'app', stressLabel }: { onExit: () => void; onOpenFailureStory: () => void; initialGraph?: BuilderGraph; initialLayout?: BuilderLayout; initialSourceId?: string; initialDestinationId?: string; stressLabel?: string }) {
  const reduceMotion = useReducedMotion();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [graph, setGraph] = useState<BuilderGraph>(() => cloneBuilderGraph(initialGraph));
  const [layout, setLayout] = useState<BuilderLayout>(() => cloneBuilderLayout(initialLayout));
  const [sourceId, setSourceId] = useState(initialSourceId);
  const [destinationId, setDestinationId] = useState(initialDestinationId);
  const [selectedLinkId, setSelectedLinkId] = useState(() => initialGraph.links[0]?.id ?? '');
  const [newLinkA, setNewLinkA] = useState(() => initialGraph.nodes[0]?.id ?? '');
  const [newLinkB, setNewLinkB] = useState(() => initialGraph.nodes[1]?.id ?? initialGraph.nodes[0]?.id ?? '');
  const [newLinkCost, setNewLinkCost] = useState(5);
  const [scenarioName, setScenarioName] = useState('My topology');
  const [saved, setSaved] = useState<BuilderScenarioV2[]>(() => listStoredBuilderScenarios());
  const [message, setMessage] = useState('Graph truth and layout are separate. Dragging never changes route cost.');
  const route = useMemo(() => findShortestPath(graph, sourceId, destinationId), [graph, sourceId, destinationId]);
  const selectedLink = graph.links.find((link) => link.id === selectedLinkId) ?? graph.links[0];
  const activeLinks = new Set(route.linkIds);

  const commitGraph = (next: BuilderGraph) => {
    setGraph(next);
    const nextSource = chooseValidNode(next, sourceId);
    const nextDestination = chooseValidNode(next, destinationId, nextSource) || nextSource;
    setSourceId(nextSource);
    setDestinationId(nextDestination);
    if (!next.links.some((link) => link.id === selectedLinkId)) setSelectedLinkId(next.links[0]?.id ?? '');
    setNewLinkA(chooseValidNode(next, newLinkA));
    setNewLinkB(chooseValidNode(next, newLinkB, chooseValidNode(next, newLinkA)));
  };

  const updateLink = (linkId: string, patch: Partial<{ cost: number; failed: boolean }>) => {
    commitGraph({ ...graph, links: graph.links.map((link) => link.id === linkId ? { ...link, ...patch } : link) });
  };

  const addNode = (kind: BuilderNodeKind) => {
    if (graph.nodes.length >= BUILDER_LIMITS.maxNodes) { setMessage(`Node limit is ${BUILDER_LIMITS.maxNodes}.`); return; }
    const id = nextGeneratedNodeId(graph, kind);
    const label = kind === 'router' ? id.toUpperCase() : `HOST ${id.replace('host', '')}`;
    const nextGraph = { ...graph, nodes: [...graph.nodes, { id, label, kind }] };
    setLayout((current) => ({ ...current, [id]: deterministicNewNodePoint(graph.nodes.length - defaultBuilderGraph.nodes.length) }));
    commitGraph(nextGraph);
    setNewLinkA(id);
    setMessage(`${label} added. Connect it with a weighted link to affect graph truth.`);
  };

  const deleteNode = (nodeId: string) => {
    const node = graph.nodes.find((item) => item.id === nodeId);
    if (!node || node.builtin) { setMessage('Built-in nodes stay recoverable; user-created nodes can be deleted.'); return; }
    const nextGraph = { nodes: graph.nodes.filter((item) => item.id !== nodeId), links: graph.links.filter((link) => link.a !== nodeId && link.b !== nodeId) };
    setLayout((current) => Object.fromEntries(Object.entries(current).filter(([id]) => id !== nodeId)));
    commitGraph(nextGraph);
    setMessage(`${node.label} and its incident links were removed atomically.`);
  };

  const addLink = () => {
    if (!newLinkA || !newLinkB || newLinkA === newLinkB) { setMessage('A link needs two different nodes.'); return; }
    if (undirectedLinkExists(graph, newLinkA, newLinkB)) { setMessage('That undirected link already exists.'); return; }
    if (!Number.isInteger(newLinkCost) || newLinkCost < BUILDER_LIMITS.minCost || newLinkCost > BUILDER_LIMITS.maxCost) { setMessage(`Link cost must be ${BUILDER_LIMITS.minCost}–${BUILDER_LIMITS.maxCost}.`); return; }
    if (graph.links.length >= BUILDER_LIMITS.maxLinks) { setMessage(`Link limit is ${BUILDER_LIMITS.maxLinks}.`); return; }
    const id = nextGeneratedLinkId(graph, newLinkA, newLinkB);
    commitGraph({ ...graph, links: [...graph.links, { id, a: newLinkA, b: newLinkB, cost: newLinkCost, failed: false }] });
    setSelectedLinkId(id);
    setMessage(`${labelFor(graph, newLinkA)} ↔ ${labelFor(graph, newLinkB)} added at cost ${newLinkCost}.`);
  };

  const deleteLink = (linkId: string) => {
    const link = graph.links.find((item) => item.id === linkId);
    if (!link) return;
    commitGraph({ ...graph, links: graph.links.filter((item) => item.id !== linkId) });
    setMessage(`${labelFor(graph, link.a)} ↔ ${labelFor(graph, link.b)} deleted.`);
  };

  const resetTopology = () => {
    setGraph(cloneBuilderGraph(initialGraph));
    setSourceId(initialSourceId); setDestinationId(initialDestinationId); setSelectedLinkId(initialGraph.links[0]?.id ?? ''); setNewLinkA(initialGraph.nodes[0]?.id ?? ''); setNewLinkB(initialGraph.nodes[1]?.id ?? initialGraph.nodes[0]?.id ?? ''); setNewLinkCost(5);
    setMessage('Topology truth reset. Layout was left untouched.');
  };

  const resetLayout = () => {
    const next = cloneBuilderLayout(initialLayout);
    graph.nodes.forEach((node, index) => { if (!next[node.id]) next[node.id] = deterministicNewNodePoint(index - defaultBuilderGraph.nodes.length); });
    setLayout(next);
    setMessage('Visual layout reset without changing graph truth.');
  };

  const saveScenario = () => {
    try {
      const existing = saved.find((item) => item.name === scenarioName);
      const scenario = createBuilderScenario(scenarioName.trim() || 'Untitled topology', graph, sourceId, destinationId, layout, existing);
      setSaved(saveStoredBuilderScenario(scenario));
      setMessage(`Saved “${scenario.name}” locally as Builder schema v2.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to save scenario.'); }
  };

  const restoreScenario = (scenario: BuilderScenarioV2) => {
    setGraph(cloneBuilderGraph(scenario.graph)); setLayout(cloneBuilderLayout(scenario.layout)); setSourceId(scenario.sourceId); setDestinationId(scenario.destinationId);
    setSelectedLinkId(scenario.graph.links[0]?.id ?? ''); setScenarioName(scenario.name);
    setMessage(`Restored “${scenario.name}”. Route recomputed from graph truth.`);
  };

  const exportScenario = () => {
    try {
      const scenario = createBuilderScenario(scenarioName.trim() || 'Exported topology', graph, sourceId, destinationId, layout);
      const blob = new Blob([serializeBuilderScenario(scenario)], { type: 'application/json' });
      const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
      anchor.href = url; anchor.download = `${scenario.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'hopscotch-topology'}.hopscotch.json`; anchor.click(); URL.revokeObjectURL(url);
      setMessage('Scenario v2 exported as portable JSON.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Export failed.'); }
  };

  const importScenario = async (file: File | undefined) => {
    if (!file) return;
    try {
      const scenario = deserializeBuilderScenario(await file.text());
      restoreScenario(scenario);
      setMessage(`Imported “${scenario.name}” as schema v${scenario.version}.`);
    } catch (error) { setMessage(`IMPORT REJECTED · ${error instanceof Error ? error.message : 'Invalid scenario.'}`); }
  };

  const onNodeDragEnd = (nodeId: string, offsetX: number, offsetY: number) => {
    const canvas = canvasRef.current; const current = layout[nodeId]; if (!canvas || !current) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, current.x + (offsetX / Math.max(rect.width, 1)) * 100));
    const y = Math.max(0, Math.min(100, current.y + (offsetY / Math.max(rect.height, 1)) * 100));
    setLayout((prior) => ({ ...prior, [nodeId]: { x, y } }));
    setMessage(`${labelFor(graph, nodeId)} moved visually. Route truth remains ${route.reachable ? `cost ${route.totalCost}` : 'unreachable'}.`);
  };

  return (
    <motion.section className="builder-workspace" data-stress-label={stressLabel} data-node-count={graph.nodes.length} data-link-count={graph.links.length} initial={reduceMotion ? { opacity: 1 } : { opacity: 0, scale: .985 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
      <header className="builder-heading">
        <div><p className="eyebrow">Lab 04 · Network builder</p><h1>DRAW THE GRAPH.<br/><span>CHANGE THE ROUTE.</span></h1></div>
        <div className="builder-heading-actions"><button className="lab-mode" type="button" onClick={onOpenFailureStory}>FAILURE STORY ↗</button><button className="lab-mode" type="button" onClick={onExit}>EXIT LAB</button></div>
      </header>

      <div className="builder-main">
        <section className="builder-stage">
          <div className="builder-stage-meta"><div><span>STATUS</span><strong>{route.reachable ? 'ROUTE INSTALLED' : 'UNREACHABLE'}</strong></div><div><span>PATH COST</span><strong>{route.totalCost ?? '—'}</strong></div><div><span>GRAPH</span><strong>{graph.nodes.length} NODES · {graph.links.length} LINKS</strong></div></div>
          <div ref={canvasRef} className="builder-canvas">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Weighted routed topology">
              {graph.links.map((link) => {
                const a = layout[link.a]; const b = layout[link.b]; if (!a || !b) return null;
                const active = activeLinks.has(link.id);
                return <g key={link.id} className={`builder-link ${link.failed ? 'failed' : active ? 'active' : 'alternate'} ${selectedLinkId === link.id ? 'selected' : ''}`} role="button" tabIndex={0} onClick={() => setSelectedLinkId(link.id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setSelectedLinkId(link.id); }}>
                  <line className="hit" x1={a.x} y1={a.y} x2={b.x} y2={b.y}/><line x1={a.x} y1={a.y} x2={b.x} y2={b.y}/><text x={(a.x+b.x)/2} y={(a.y+b.y)/2 - 1.5}>{link.failed ? 'DOWN' : link.cost}</text>
                </g>;
              })}
            </svg>
            {graph.nodes.map((node) => {
              const point = layout[node.id]; if (!point) return null;
              const onRoute = route.nodeIds.includes(node.id);
              return <div key={node.id} className="builder-node-anchor" style={{ left: `${point.x}%`, top: `${point.y}%` }}>
                <motion.div className={`builder-node ${node.kind} ${onRoute ? 'on-route' : ''}`} drag dragMomentum={false} dragElastic={0} onDragEnd={(_, info) => onNodeDragEnd(node.id, info.offset.x, info.offset.y)} whileDrag={reduceMotion ? undefined : { scale: 1.08, zIndex: 8 }}>
                  <span>{node.kind === 'router' ? 'RTR' : 'END'}</span><strong>{node.label}</strong>{!node.builtin && <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => deleteNode(node.id)} aria-label={`Delete ${node.label}`}>×</button>}
                </motion.div>
              </div>;
            })}
          </div>
          <div className={`builder-route ${route.reachable ? '' : 'unreachable'}`}><span>WINNING PATH</span><strong>{route.reachable ? route.nodeIds.map((id) => labelFor(graph,id)).join(' → ') : 'NO VIABLE PATH'}</strong><p>{route.explanation}</p></div>
          <div className="builder-message">{message}</div>
        </section>

        <aside className="builder-controls">
          <section><div className="control-title"><span>ENDPOINTS</span><strong>ROUTE QUERY</strong></div><label>SOURCE<select value={sourceId} onChange={(e)=>setSourceId(e.currentTarget.value)}>{graph.nodes.map((node)=><option key={node.id} value={node.id}>{node.label}</option>)}</select></label><label>DESTINATION<select value={destinationId} onChange={(e)=>setDestinationId(e.currentTarget.value)}>{graph.nodes.map((node)=><option key={node.id} value={node.id}>{node.label}</option>)}</select></label></section>
          <section><div className="control-title"><span>SELECTED LINK</span><strong>{selectedLink ? `${labelFor(graph,selectedLink.a)} ↔ ${labelFor(graph,selectedLink.b)}` : 'NONE'}</strong></div>{selectedLink && <><label>COST<input type="number" min={1} max={999} value={selectedLink.cost} onChange={(e)=>updateLink(selectedLink.id,{cost:Math.max(1,Math.min(999,Math.round(Number(e.currentTarget.value)||1)))})}/></label><div className="button-row"><button type="button" onClick={()=>updateLink(selectedLink.id,{failed:!selectedLink.failed})}>{selectedLink.failed?'RESTORE':'FAIL LINK'}</button><button type="button" onClick={()=>deleteLink(selectedLink.id)}>DELETE</button></div></>}</section>
          <section><div className="control-title"><span>AUTHOR</span><strong>TOPOLOGY</strong></div><div className="button-row"><button type="button" onClick={()=>addNode('router')}>+ ROUTER</button><button type="button" onClick={()=>addNode('endpoint')}>+ ENDPOINT</button></div><div className="link-form"><select value={newLinkA} onChange={(e)=>setNewLinkA(e.currentTarget.value)}>{graph.nodes.map((node)=><option key={node.id} value={node.id}>{node.label}</option>)}</select><span>↔</span><select value={newLinkB} onChange={(e)=>setNewLinkB(e.currentTarget.value)}>{graph.nodes.map((node)=><option key={node.id} value={node.id}>{node.label}</option>)}</select><input aria-label="New link cost" type="number" min={1} max={999} value={newLinkCost} onChange={(e)=>setNewLinkCost(Math.max(1,Math.min(999,Math.round(Number(e.currentTarget.value)||1))))}/><button type="button" onClick={addLink}>ADD LINK</button></div></section>
          <section><div className="control-title"><span>SCENARIOS</span><strong>SCHEMA V2</strong></div><label>NAME<input value={scenarioName} maxLength={80} onChange={(e)=>setScenarioName(e.currentTarget.value)}/></label><div className="button-row"><button type="button" onClick={saveScenario}>SAVE</button><button type="button" onClick={exportScenario}>EXPORT JSON</button><label className="file-button">IMPORT<input type="file" accept="application/json,.json" onChange={(e)=>void importScenario(e.currentTarget.files?.[0])}/></label></div><div className="saved-list">{saved.length===0?<small>NO SAVED SCENARIOS</small>:saved.map((scenario)=><div key={scenario.name}><button type="button" onClick={()=>restoreScenario(scenario)}><strong>{scenario.name}</strong><small>{scenario.graph.nodes.length}N · {scenario.graph.links.length}L</small></button><button type="button" aria-label={`Delete ${scenario.name}`} onClick={()=>setSaved(deleteStoredBuilderScenario(scenario.name))}>×</button></div>)}</div></section>
          <section className="reset-section"><div className="button-row"><button type="button" onClick={resetTopology}>RESET TOPOLOGY</button><button type="button" onClick={resetLayout}>RESET LAYOUT</button></div></section>
        </aside>
      </div>
    </motion.section>
  );
}
