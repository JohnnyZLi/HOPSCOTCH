import { motion, useReducedMotion } from 'motion/react';
import { useMemo, useRef, useState } from 'react';
import {
  cloneBuilderAddressing,
  createDefaultBuilderAddressing,
  interfacesForBuilderNode,
  reconcileBuilderAddressing,
  replaceBuilderDefaultGateway,
  replaceBuilderInterfaceAddress,
  replaceBuilderSegmentCidr,
  type BuilderAddressing,
} from './builder/addressing.ts';
import {
  builderOspfState,
  cloneBuilderRoutingConfig,
  createDefaultBuilderRoutingConfig,
  deleteBuilderStaticRoute,
  installStaticRoutesForWeightedPath,
  nextHopOptionsForBuilderRouter,
  reconcileBuilderRoutingConfig,
  routeTableForBuilderRouter,
  setBuilderOspfEverywhere,
  setBuilderOspfRouterEnabled,
  traceBuilderForwarding,
  upsertBuilderStaticRoute,
  type BuilderRoutingConfig,
} from './builder/routing.ts';
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
  type BuilderScenarioV5,
} from './builder/scenario';
import { runBuilderProbe, type BuilderProbePacketSeed, type BuilderProbeResult } from './builder/probes.ts';
import './NetworkBuilder.css';

function labelFor(graph: BuilderGraph, id: string): string {
  return graph.nodes.find((node) => node.id === id)?.label ?? id.toUpperCase();
}

function chooseValidNode(graph: BuilderGraph, preferred: string, avoid?: string): string {
  if (graph.nodes.some((node) => node.id === preferred) && preferred !== avoid) return preferred;
  return graph.nodes.find((node) => node.id !== avoid)?.id ?? '';
}

export function NetworkBuilder({ onExit, onOpenFailureStory, onOpenProbePacket, initialGraph = defaultBuilderGraph, initialLayout = defaultBuilderLayout, initialAddressing, initialRouting, initialSourceId = 'client', initialDestinationId = 'app', stressLabel }: { onExit: () => void; onOpenFailureStory: () => void; onOpenProbePacket?: (seed: BuilderProbePacketSeed) => void; initialGraph?: BuilderGraph; initialLayout?: BuilderLayout; initialAddressing?: BuilderAddressing; initialRouting?: BuilderRoutingConfig; initialSourceId?: string; initialDestinationId?: string; stressLabel?: string }) {
  const reduceMotion = useReducedMotion();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [graph, setGraph] = useState<BuilderGraph>(() => cloneBuilderGraph(initialGraph));
  const [addressing, setAddressing] = useState<BuilderAddressing>(() => cloneBuilderAddressing(initialAddressing ?? createDefaultBuilderAddressing(initialGraph)));
  const [routing, setRouting] = useState<BuilderRoutingConfig>(() => cloneBuilderRoutingConfig(initialRouting ?? createDefaultBuilderRoutingConfig()));
  const [layout, setLayout] = useState<BuilderLayout>(() => cloneBuilderLayout(initialLayout));
  const [sourceId, setSourceId] = useState(initialSourceId);
  const [destinationId, setDestinationId] = useState(initialDestinationId);
  const [selectedNodeId, setSelectedNodeId] = useState(initialSourceId);
  const [selectedLinkId, setSelectedLinkId] = useState(() => initialGraph.links[0]?.id ?? '');
  const [newLinkA, setNewLinkA] = useState(() => initialGraph.nodes[0]?.id ?? '');
  const [newLinkB, setNewLinkB] = useState(() => initialGraph.nodes[1]?.id ?? initialGraph.nodes[0]?.id ?? '');
  const [newLinkCost, setNewLinkCost] = useState(5);
  const [scenarioName, setScenarioName] = useState('My topology');
  const [staticPrefix, setStaticPrefix] = useState('0.0.0.0/0');
  const [staticNextHop, setStaticNextHop] = useState('');
  const [staticMetric, setStaticMetric] = useState(1);
  const [saved, setSaved] = useState<BuilderScenarioV5[]>(() => listStoredBuilderScenarios());
  const [message, setMessage] = useState('Graph truth and layout are separate. Dragging never changes route cost.');
  const [probeHistory, setProbeHistory] = useState<BuilderProbeResult[]>([]);
  const [selectedProbeId, setSelectedProbeId] = useState<string | null>(null);
  const [selectedProbeAttempt, setSelectedProbeAttempt] = useState(0);
  const route = useMemo(() => findShortestPath(graph, sourceId, destinationId), [graph, sourceId, destinationId]);
  const forwardingTrace = useMemo(() => traceBuilderForwarding(graph, addressing, routing, sourceId, destinationId), [graph, addressing, routing, sourceId, destinationId]);
  const ospfState = useMemo(() => builderOspfState(graph, addressing, routing), [graph, addressing, routing]);
  const selectedLink = graph.links.find((link) => link.id === selectedLinkId) ?? graph.links[0];
  const selectedNode = graph.nodes.find((node) => node.id === selectedNodeId) ?? graph.nodes[0];
  const selectedSegment = selectedLink ? addressing.segments[selectedLink.id] : undefined;
  const selectedNodeInterfaces = selectedNode ? interfacesForBuilderNode(addressing, selectedNode.id) : [];
  const selectedRouteTable = selectedNode?.kind === 'router' ? routeTableForBuilderRouter(graph, addressing, routing, selectedNode.id) : [];
  const selectedOspfEnabled = Boolean(selectedNode?.kind === 'router' && routing.ospf.enabledRouterIds.includes(selectedNode.id));
  const selectedOspfAdjacencies = selectedNode?.kind === 'router' ? ospfState.adjacencies.filter((adjacency) => adjacency.aRouterId === selectedNode.id || adjacency.bRouterId === selectedNode.id) : [];
  const selectedOspfComponent = selectedNode?.kind === 'router' ? ospfState.components.find((component) => component.includes(selectedNode.id)) : undefined;
  const selectedOspfPrefixCount = selectedOspfComponent ? new Set(ospfState.advertisements.filter((advertisement) => selectedOspfComponent.includes(advertisement.routerId)).map((advertisement) => advertisement.prefix)).size : 0;
  const selectedNextHopOptions = selectedNode?.kind === 'router' ? nextHopOptionsForBuilderRouter(graph, addressing, selectedNode.id) : [];
  const effectiveStaticNextHop = selectedNextHopOptions.some((option) => option.address === staticNextHop) ? staticNextHop : (selectedNextHopOptions[0]?.address ?? '');
  const destinationInterface = interfacesForBuilderNode(addressing, destinationId)[0];
  const destinationPrefix = destinationInterface ? (addressing.segments[destinationInterface.linkId]?.cidr ?? '0.0.0.0/0') : '0.0.0.0/0';
  const activeLinks = new Set(route.linkIds);
  const forwardingLinks = new Set(forwardingTrace.hops.flatMap((hop) => hop.linkId ? [hop.linkId] : []));
  const selectedProbe = probeHistory.find((probe) => probe.id === selectedProbeId) ?? probeHistory[0] ?? null;
  const selectedAttempt = selectedProbe?.attempts[Math.min(selectedProbeAttempt, Math.max(0, selectedProbe.attempts.length - 1))] ?? null;
  const probeLinks = new Set(selectedAttempt?.requestLinkIds ?? []);

  const runProbe = (kind: 'ping' | 'traceroute') => {
    const result = runBuilderProbe(graph, addressing, routing, kind, sourceId, destinationId, probeHistory.length + 1);
    setProbeHistory((current) => [result, ...current].slice(0, 10));
    setSelectedProbeId(result.id);
    setSelectedProbeAttempt(result.attempts.length > 0 ? result.attempts.length - 1 : 0);
    setMessage(`${kind.toUpperCase()} · ${result.summary}`);
  };

  const commitGraph = (next: BuilderGraph) => {
    const nextAddressing = reconcileBuilderAddressing(next, addressing);
    const nextRouting = reconcileBuilderRoutingConfig(next, nextAddressing, routing);
    setGraph(next);
    setAddressing(nextAddressing);
    setRouting(nextRouting);
    const nextSource = chooseValidNode(next, sourceId);
    const nextDestination = chooseValidNode(next, destinationId, nextSource) || nextSource;
    setSourceId(nextSource);
    setDestinationId(nextDestination);
    if (!next.nodes.some((node) => node.id === selectedNodeId)) setSelectedNodeId(nextSource);
    if (!next.links.some((link) => link.id === selectedLinkId)) setSelectedLinkId(next.links[0]?.id ?? '');
    setNewLinkA(chooseValidNode(next, newLinkA));
    setNewLinkB(chooseValidNode(next, newLinkB, chooseValidNode(next, newLinkA)));
  };

  const commitAddressing = (next: BuilderAddressing) => {
    setAddressing(next);
    setRouting(reconcileBuilderRoutingConfig(graph, next, routing));
  };

  const setSelectedOspf = (enabled: boolean) => {
    if (!selectedNode || selectedNode.kind !== 'router') { setMessage('Select a router before changing OSPF.'); return; }
    try {
      setRouting(setBuilderOspfRouterEnabled(graph, addressing, routing, selectedNode.id, enabled));
      setMessage(`OSPF · ${selectedNode.label} ${enabled ? 'joined' : 'left'} AREA 0. Dynamic routes recompute from current adjacencies and link costs.`);
    } catch (error) { setMessage(`OSPF REJECTED · ${error instanceof Error ? error.message : 'Unable to change OSPF state.'}`); }
  };

  const setAllOspf = (enabled: boolean) => {
    setRouting(setBuilderOspfEverywhere(graph, addressing, routing, enabled));
    setMessage(enabled ? 'OSPF AREA 0 ENABLED · all routers participate. Link failures and cost edits now trigger deterministic SPF reconvergence.' : 'OSPF DISABLED · dynamic routes withdrawn. Connected and static routes remain.');
  };

  const clearStaticRoutes = () => {
    const next = cloneBuilderRoutingConfig(routing);
    next.staticRoutes = [];
    setRouting(next);
    setMessage('All static routes cleared. Connected and OSPF-derived routes remain.');
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
    commitGraph({ ...graph, links: graph.links.map((link) => link.id === linkId ? { ...link, ...patch } : link) });
    if (routing.ospf.enabledRouterIds.length > 0) setMessage('TOPOLOGY CHANGED · OSPF Area 0 recomputes immediately from active adjacencies and current link costs. Static routes do not reconverge.');
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
    setAddressing(cloneBuilderAddressing(initialAddressing ?? createDefaultBuilderAddressing(initialGraph)));
    setRouting(cloneBuilderRoutingConfig(initialRouting ?? createDefaultBuilderRoutingConfig()));
    setSourceId(initialSourceId); setDestinationId(initialDestinationId); setSelectedNodeId(initialSourceId); setSelectedLinkId(initialGraph.links[0]?.id ?? ''); setNewLinkA(initialGraph.nodes[0]?.id ?? ''); setNewLinkB(initialGraph.nodes[1]?.id ?? initialGraph.nodes[0]?.id ?? ''); setNewLinkCost(5);
    setMessage('Topology, addressing, static routing, and OSPF configuration reset. Visual layout was left untouched.');
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
      const scenario = createBuilderScenario(scenarioName.trim() || 'Untitled topology', graph, sourceId, destinationId, layout, addressing, routing, existing);
      setSaved(saveStoredBuilderScenario(scenario));
      setMessage(`Saved “${scenario.name}” locally as Builder schema v5.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to save scenario.'); }
  };

  const restoreScenario = (scenario: BuilderScenarioV5) => {
    setGraph(cloneBuilderGraph(scenario.graph)); setAddressing(cloneBuilderAddressing(scenario.addressing)); setRouting(cloneBuilderRoutingConfig(scenario.routing)); setLayout(cloneBuilderLayout(scenario.layout)); setSourceId(scenario.sourceId); setDestinationId(scenario.destinationId);
    setSelectedNodeId(scenario.sourceId); setSelectedLinkId(scenario.graph.links[0]?.id ?? ''); setScenarioName(scenario.name);
    setMessage(`Restored “${scenario.name}”. Route recomputed from graph truth.`);
  };

  const exportScenario = () => {
    try {
      const scenario = createBuilderScenario(scenarioName.trim() || 'Exported topology', graph, sourceId, destinationId, layout, addressing, routing);
      const blob = new Blob([serializeBuilderScenario(scenario)], { type: 'application/json' });
      const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
      anchor.href = url; anchor.download = `${scenario.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'hopscotch-topology'}.hopscotch.json`; anchor.click(); URL.revokeObjectURL(url);
      setMessage('Scenario v5 exported with topology, addressing, static routing, and OSPF configuration.');
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
          <div className="builder-stage-meta"><div><span>GRAPH PATH</span><strong>{route.reachable ? `YES · COST ${route.totalCost}` : 'NO PATH'}</strong></div><div><span>L3 FORWARDING</span><strong>{forwardingTrace.reachable ? 'REACHABLE' : 'NO ROUTE'}</strong></div><div><span>ACTIVE PROBE</span><strong>{selectedProbe ? `${selectedProbe.kind.toUpperCase()} · ${selectedProbe.success ? 'PASS' : 'FAIL'}` : 'IDLE'}</strong></div><div><span>OSPF AREA 0</span><strong>{ospfState.enabledRouterIds.length === 0 ? 'OFF' : `${ospfState.enabledRouterIds.length} RTR · ${ospfState.fullAdjacencyCount} FULL`}</strong></div><div><span>STATIC</span><strong>{routing.staticRoutes.length} ROUTES</strong></div><div><span>GRAPH</span><strong>{graph.nodes.length} NODES · {graph.links.length} LINKS</strong></div></div>
          <div ref={canvasRef} className="builder-canvas">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Weighted routed topology">
              {graph.links.map((link) => {
                const a = layout[link.a]; const b = layout[link.b]; if (!a || !b) return null;
                const active = activeLinks.has(link.id); const forwarding = forwardingLinks.has(link.id);
                return <g key={link.id} data-link-id={link.id} className={`builder-link ${link.failed ? 'failed' : active ? 'active' : 'alternate'} ${forwarding ? 'l3-forwarding' : ''} ${probeLinks.has(link.id) ? 'probe-active' : ''} ${selectedLinkId === link.id ? 'selected' : ''}`} role="button" tabIndex={0} onClick={() => setSelectedLinkId(link.id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setSelectedLinkId(link.id); }}>
                  <line className="hit" x1={a.x} y1={a.y} x2={b.x} y2={b.y}/><line x1={a.x} y1={a.y} x2={b.x} y2={b.y}/><text x={(a.x+b.x)/2} y={(a.y+b.y)/2 - 1.5}>{link.failed ? 'DOWN' : link.cost}</text>
                </g>;
              })}
            </svg>
            {graph.nodes.map((node) => {
              const point = layout[node.id]; if (!point) return null;
              const onRoute = route.nodeIds.includes(node.id);
              return <div key={node.id} className="builder-node-anchor" style={{ left: `${point.x}%`, top: `${point.y}%` }}>
                <motion.div className={`builder-node ${node.kind} ${onRoute ? 'on-route' : ''} ${selectedNode?.id === node.id ? 'selected' : ''}`} drag dragMomentum={false} dragElastic={0} onPointerDown={() => setSelectedNodeId(node.id)} onDragEnd={(_, info) => onNodeDragEnd(node.id, info.offset.x, info.offset.y)} whileDrag={reduceMotion ? undefined : { scale: 1.08, zIndex: 8 }}>
                  <span>{node.kind === 'router' ? 'RTR' : 'END'}</span><strong>{node.label}</strong>{!node.builtin && <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => deleteNode(node.id)} aria-label={`Delete ${node.label}`}>×</button>}
                </motion.div>
              </div>;
            })}
          </div>
          <div className={`builder-route ${route.reachable ? '' : 'unreachable'}`}><span>WEIGHTED GRAPH PATH</span><strong>{route.reachable ? route.nodeIds.map((id) => labelFor(graph,id)).join(' → ') : 'NO VIABLE PATH'}</strong><p>{route.explanation}</p></div>
          <div className={`builder-ospf-summary ${ospfState.enabledRouterIds.length === 0 ? 'off' : ''}`}><span>OSPF CONTROL PLANE · AREA 0</span><strong>{ospfState.enabledRouterIds.length === 0 ? 'DISABLED · NO DYNAMIC ROUTES' : `${ospfState.components.length} LSDB VIEW${ospfState.components.length === 1 ? '' : 'S'} · ${ospfState.fullAdjacencyCount} FULL · ${ospfState.downAdjacencyCount} DOWN`}</strong><p>{ospfState.enabledRouterIds.length === 0 ? 'Enable OSPF on Builder routers to derive dynamic routes without changing weighted graph truth.' : 'Enabled routers form adjacencies only across active router-router links. SPF uses Builder link cost; connected and static routes keep their own precedence.'}</p></div>
          <div className={`builder-forwarding ${forwardingTrace.reachable ? '' : 'unreachable'}`}><span>L3 FORWARDING · {forwardingTrace.destinationAddress ?? 'NO DESTINATION IP'}</span><strong>{forwardingTrace.reachable ? [sourceId,...forwardingTrace.hops.map((hop)=>hop.nextNodeId).filter((id): id is string=>Boolean(id))].filter((id,index,all)=>index===0||id!==all[index-1]).map((id)=>labelFor(graph,id)).join(' → ') : `${forwardingTrace.failureNodeId ? labelFor(graph,forwardingTrace.failureNodeId) : 'FORWARDING'} · ${forwardingTrace.failureReason ?? 'NO ROUTE'}`}</strong><p>{forwardingTrace.explanation}</p>{forwardingTrace.hops.length>0&&<div className="builder-forwarding-hops">{forwardingTrace.hops.map((hop,index)=><span key={`${hop.nodeId}-${index}`}><b>{hop.nodeLabel}</b>{hop.routeSource.toUpperCase()} · {hop.matchedPrefix ?? '—'} · {hop.nextHop ?? 'LOCAL'} · {hop.outgoingInterface ?? '—'}</span>)}</div>}</div>
          <div className={`builder-probe-panel ${selectedProbe ? (selectedProbe.success ? 'success' : 'failed') : 'idle'}`}><span>ACTIVE PROBE · SESSION SNAPSHOT</span>{selectedProbe&&selectedAttempt?<><strong>{selectedProbe.kind.toUpperCase()} · TTL {selectedAttempt.ttl} · {selectedAttempt.status.replace('-', ' ').toUpperCase()}</strong><p>{selectedAttempt.detail}</p><div className="builder-probe-path">{selectedAttempt.requestNodeIds.map((id,index)=><span key={`${selectedProbe.id}-${selectedAttempt.index}-${id}-${index}`}><b>{labelFor(graph,id)}</b>{index===0?'SOURCE':index===selectedAttempt.requestNodeIds.length-1?'RESPONDER':'TRANSIT'}</span>)}</div><small>{selectedProbe.snapshotNote}</small></>:<><strong>NO PROBE YET</strong><p>Run Ping or Traceroute. Probes consume the current L3 forwarding table instead of inventing their own route.</p></>}</div>
          <div className="builder-message">{message}</div>
        </section>

        <aside className="builder-controls">
          <section><div className="control-title"><span>ENDPOINTS</span><strong>GRAPH ↔ IP</strong></div><label>SOURCE<select value={sourceId} onChange={(e)=>setSourceId(e.currentTarget.value)}>{graph.nodes.map((node)=><option key={node.id} value={node.id}>{node.label}</option>)}</select></label><label>DESTINATION<select value={destinationId} onChange={(e)=>setDestinationId(e.currentTarget.value)}>{graph.nodes.map((node)=><option key={node.id} value={node.id}>{node.label}</option>)}</select></label><div className="button-row"><button type="button" onClick={installCurrentStaticPath}>INSTALL STATIC PATH</button><button type="button" onClick={clearStaticRoutes}>CLEAR STATICS</button></div><small className="builder-routing-note">INSTALL snapshots the current weighted path. Static routes do not reconverge when a link fails.</small></section>
          <section className="builder-probe-section"><div className="control-title"><span>ACTIVE PROBES</span><strong>ICMP · SESSION ONLY</strong></div><div className="button-row"><button type="button" onClick={()=>runProbe('ping')}>PING</button><button type="button" onClick={()=>runProbe('traceroute')}>TRACEROUTE</button><button type="button" onClick={()=>{setProbeHistory([]);setSelectedProbeId(null);setSelectedProbeAttempt(0);}}>CLEAR</button></div>{selectedProbe&&<><label>RESULT<select value={selectedProbe.id} onChange={(event)=>{setSelectedProbeId(event.currentTarget.value);setSelectedProbeAttempt(0);}}>{probeHistory.map((probe)=><option key={probe.id} value={probe.id}>{probe.sequence}. {probe.kind.toUpperCase()} · {probe.success?'PASS':'FAIL'}</option>)}</select></label>{selectedProbe.attempts.length>1&&<label>TTL / ATTEMPT<select value={Math.min(selectedProbeAttempt,selectedProbe.attempts.length-1)} onChange={(event)=>setSelectedProbeAttempt(Number(event.currentTarget.value))}>{selectedProbe.attempts.map((attempt,index)=><option key={`${selectedProbe.id}-${attempt.ttl}-${index}`} value={index}>TTL {attempt.ttl} · {attempt.responderNodeId?labelFor(graph,attempt.responderNodeId):'NO RESPONSE'} · {attempt.status.toUpperCase()}</option>)}</select></label>}<button type="button" disabled={!selectedAttempt?.packet||!onOpenProbePacket} onClick={()=>{if(selectedAttempt?.packet&&onOpenProbePacket)onOpenProbePacket(selectedAttempt.packet);}}>OPEN ICMP PACKET ↗</button></>}<small className="builder-routing-note">PING validates request + reply paths. TRACEROUTE expires TTL at routers and needs a reverse route for each Time Exceeded response. ROUTING COST ≠ RTT.</small></section>
          <section><div className="control-title"><span>SELECTED LINK</span><strong>{selectedLink ? `${labelFor(graph,selectedLink.a)} ↔ ${labelFor(graph,selectedLink.b)}` : 'NONE'}</strong></div>{selectedLink && <><label>COST<input type="number" min={1} max={999} value={selectedLink.cost} onChange={(e)=>updateLink(selectedLink.id,{cost:Math.max(1,Math.min(999,Math.round(Number(e.currentTarget.value)||1)))})}/></label><div className="button-row"><button type="button" onClick={()=>updateLink(selectedLink.id,{failed:!selectedLink.failed})}>{selectedLink.failed?'RESTORE':'FAIL LINK'}</button><button type="button" onClick={()=>deleteLink(selectedLink.id)}>DELETE</button></div></>}</section>
          <section className="builder-l3-section"><div className="control-title"><span>L3 SEGMENT</span><strong>{selectedSegment?.cidr ?? 'NONE'}</strong></div>{selectedLink && selectedSegment && <><label>NETWORK CIDR<input key={`${selectedLink.id}-${selectedSegment.cidr}`} defaultValue={selectedSegment.cidr} onBlur={(event)=>{try{const next=replaceBuilderSegmentCidr(graph,addressing,selectedLink.id,event.currentTarget.value);commitAddressing(next);setMessage(`${labelFor(graph,selectedLink.a)} ↔ ${labelFor(graph,selectedLink.b)} renumbered to ${next.segments[selectedLink.id].cidr}. Weighted path cost is unchanged.`);}catch(error){setMessage(`ADDRESSING REJECTED · ${error instanceof Error?error.message:'Invalid IPv4 segment.'}`);event.currentTarget.value=selectedSegment.cidr;}}}/></label><div className="builder-interface-grid">{selectedSegment.interfaces.map((entry)=><label key={`${selectedLink.id}-${entry.nodeId}-${entry.address}`}>{labelFor(graph,entry.nodeId)} · {entry.name}<input defaultValue={entry.address} onBlur={(event)=>{try{const next=replaceBuilderInterfaceAddress(graph,addressing,selectedLink.id,entry.nodeId,event.currentTarget.value);commitAddressing(next);setMessage(`${entry.nodeId.toUpperCase()} ${entry.name} is now ${next.segments[selectedLink.id].interfaces.find((item)=>item.nodeId===entry.nodeId)?.address}. Weighted route truth is unchanged.`);}catch(error){setMessage(`ADDRESSING REJECTED · ${error instanceof Error?error.message:'Invalid interface address.'}`);event.currentTarget.value=entry.address;}}}/></label>)}</div><small className="builder-l3-note">IPV4 SEGMENT · ROUTING TABLE USES THIS PREFIX · LINK COST STAYS SEPARATE</small></>}</section>
          <section className="builder-device-section"><div className="control-title"><span>SELECTED DEVICE</span><strong>{selectedNode ? `${selectedNode.kind.toUpperCase()} · ${selectedNodeInterfaces.length} IF` : 'NONE'}</strong></div>{selectedNode && <><div className="builder-interface-list">{selectedNodeInterfaces.length===0?<small>NO INTERFACES · CONNECT THIS DEVICE TO A LINK</small>:selectedNodeInterfaces.map((entry)=><div key={`${entry.linkId}-${entry.name}`}><span>{entry.name}</span><strong>{entry.address}</strong><small>{entry.cidr} · {entry.linkId.toUpperCase()}</small></div>)}</div>{selectedNode.kind==='endpoint'&&<label>DEFAULT GATEWAY<input key={`${selectedNode.id}-${addressing.defaultGateways[selectedNode.id]??'none'}`} defaultValue={addressing.defaultGateways[selectedNode.id]??''} placeholder="NONE" onBlur={(event)=>{try{const next=replaceBuilderDefaultGateway(graph,addressing,selectedNode.id,event.currentTarget.value||null);commitAddressing(next);setMessage(`${selectedNode.label} default gateway ${next.defaultGateways[selectedNode.id]??'cleared'}.`);}catch(error){setMessage(`GATEWAY REJECTED · ${error instanceof Error?error.message:'Invalid default gateway.'}`);event.currentTarget.value=addressing.defaultGateways[selectedNode.id]??'';}}}/></label>}</>}</section>
          <section className="builder-ospf-section"><div className="control-title"><span>OSPF CONTROL PLANE</span><strong>{selectedNode?.kind === 'router' ? (selectedOspfEnabled ? 'AREA 0 · ENABLED' : 'DISABLED') : 'ROUTERS ONLY'}</strong></div>{selectedNode?.kind === 'router'?<><div className="button-row"><button type="button" onClick={()=>setSelectedOspf(!selectedOspfEnabled)}>{selectedOspfEnabled?'DISABLE ON ROUTER':'ENABLE ON ROUTER'}</button><button type="button" onClick={()=>setAllOspf(true)}>ENABLE ALL</button><button type="button" onClick={()=>setAllOspf(false)}>DISABLE ALL</button></div>{selectedOspfEnabled?<><div className="builder-ospf-facts"><div><span>LSDB COMPONENT</span><strong>{selectedOspfComponent?.map((id)=>labelFor(graph,id)).join(' · ') || selectedNode.label}</strong></div><div><span>KNOWN PREFIXES</span><strong>{selectedOspfPrefixCount}</strong></div></div><div className="builder-ospf-neighbors">{selectedOspfAdjacencies.length===0?<small>NO OSPF ROUTER NEIGHBORS</small>:selectedOspfAdjacencies.map((adjacency)=>{const neighborId=adjacency.aRouterId===selectedNode.id?adjacency.bRouterId:adjacency.aRouterId;return <div key={adjacency.id} className={adjacency.state==='FULL'?'full':'down'}><span>{adjacency.state}</span><strong>{labelFor(graph,neighborId)}</strong><small>{adjacency.linkId.toUpperCase()} · COST {adjacency.cost} · {adjacency.reason}</small></div>;})}</div></>:<small className="builder-routing-note">This router advertises no prefixes and installs no OSPF routes until it joins Area 0.</small>}<small className="builder-routing-note">SINGLE-AREA TEACHING MODEL · ROUTER-ROUTER ADJACENCIES · DETERMINISTIC SPF · NO HELLO/DEAD TIMERS OR ECMP YET.</small></>:<small className="builder-routing-note">Endpoints do not run OSPF. Select a router to inspect Area 0 state.</small>}</section>
          <section className="builder-routing-section"><div className="control-title"><span>ROUTE TABLE</span><strong>{selectedNode?.kind === 'router' ? `${selectedRouteTable.filter((entry)=>entry.active).length} ACTIVE · ${selectedRouteTable.length} TOTAL` : 'ENDPOINT DEFAULT'}</strong></div>{selectedNode?.kind === 'router'?<><div className="builder-route-table">{selectedRouteTable.length===0?<small>NO ROUTES</small>:selectedRouteTable.map((entry)=><div key={entry.id} className={`${entry.active?'':'inactive'} source-${entry.source}`}><span>{entry.source==='connected'?'C':entry.source==='static'?'S':'O'}</span><strong>{entry.prefix}</strong><small>{entry.source==='connected'?'DIRECT':`via ${entry.nextHop}`} · {entry.outgoingInterface} · AD {entry.administrativeDistance} · M {entry.metric} · {entry.stateNote}</small>{entry.source==='static'&&<button type="button" aria-label={`Delete route ${entry.prefix} via ${entry.nextHop}`} onClick={()=>{setRouting(deleteBuilderStaticRoute(graph,addressing,routing,entry.id));setMessage(`${selectedNode.label} static route ${entry.prefix} removed.`);}}>×</button>}</div>)}</div><div className="builder-static-form"><label>DESTINATION PREFIX<input value={staticPrefix} onChange={(event)=>setStaticPrefix(event.currentTarget.value)}/></label><button type="button" onClick={()=>setStaticPrefix(destinationPrefix)}>USE DEST PREFIX</button><label>NEXT HOP<select value={effectiveStaticNextHop} onChange={(event)=>setStaticNextHop(event.currentTarget.value)}>{selectedNextHopOptions.length===0?<option value="">NO NEIGHBORS</option>:selectedNextHopOptions.map((option)=><option key={`${option.linkId}-${option.address}`} value={option.address}>{option.nodeLabel} · {option.address}{option.linkFailed?' · DOWN':''}</option>)}</select></label><label>METRIC<input type="number" min={1} max={999} value={staticMetric} onChange={(event)=>setStaticMetric(Math.max(1,Math.min(999,Math.round(Number(event.currentTarget.value)||1))))}/></label><button type="button" onClick={addStaticRoute} disabled={!effectiveStaticNextHop}>ADD / REPLACE STATIC</button></div><small className="builder-routing-note">LOOKUP: LONGEST PREFIX → AD → METRIC. CONNECTED AD 0 · STATIC AD 1 · OSPF AD 110. OSPF SPF USES LINK COST.</small></>:<small className="builder-routing-note">Endpoints forward directly on-link or send off-link traffic to their configured default gateway. Select a router to inspect connected, static, and OSPF routes.</small>}</section>
          <section><div className="control-title"><span>AUTHOR</span><strong>TOPOLOGY</strong></div><div className="button-row"><button type="button" onClick={()=>addNode('router')}>+ ROUTER</button><button type="button" onClick={()=>addNode('endpoint')}>+ ENDPOINT</button></div><div className="link-form"><select value={newLinkA} onChange={(e)=>setNewLinkA(e.currentTarget.value)}>{graph.nodes.map((node)=><option key={node.id} value={node.id}>{node.label}</option>)}</select><span>↔</span><select value={newLinkB} onChange={(e)=>setNewLinkB(e.currentTarget.value)}>{graph.nodes.map((node)=><option key={node.id} value={node.id}>{node.label}</option>)}</select><input aria-label="New link cost" type="number" min={1} max={999} value={newLinkCost} onChange={(e)=>setNewLinkCost(Math.max(1,Math.min(999,Math.round(Number(e.currentTarget.value)||1))))}/><button type="button" onClick={addLink}>ADD LINK</button></div></section>
          <section><div className="control-title"><span>SCENARIOS</span><strong>SCHEMA V5 · STATIC + OSPF</strong></div><label>NAME<input value={scenarioName} maxLength={80} onChange={(e)=>setScenarioName(e.currentTarget.value)}/></label><div className="button-row"><button type="button" onClick={saveScenario}>SAVE</button><button type="button" onClick={exportScenario}>EXPORT JSON</button><label className="file-button">IMPORT<input type="file" accept="application/json,.json" onChange={(e)=>void importScenario(e.currentTarget.files?.[0])}/></label></div><div className="saved-list">{saved.length===0?<small>NO SAVED SCENARIOS</small>:saved.map((scenario)=><div key={scenario.name}><button type="button" onClick={()=>restoreScenario(scenario)}><strong>{scenario.name}</strong><small>{scenario.graph.nodes.length}N · {scenario.graph.links.length}L</small></button><button type="button" aria-label={`Delete ${scenario.name}`} onClick={()=>setSaved(deleteStoredBuilderScenario(scenario.name))}>×</button></div>)}</div></section>
          <section className="reset-section"><div className="button-row"><button type="button" onClick={resetTopology}>RESET TOPOLOGY</button><button type="button" onClick={resetLayout}>RESET LAYOUT</button></div></section>
        </aside>
      </div>
    </motion.section>
  );
}
