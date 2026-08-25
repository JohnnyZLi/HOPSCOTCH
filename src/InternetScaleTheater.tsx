import { useReducedMotion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  VisualDrawerTabs,
  VisualWorkspaceShell,
  type VisualDrawerDefinition,
  type VisualDrawerId,
} from './VisualWorkspace';
import {
  DEFAULT_AS_DESTINATION,
  DEFAULT_AS_SOURCE,
  enumeratePolicyPaths,
  relationshipEndpoints,
  relationshipLabel,
  traversalFor,
  simulatedAsGraph,
  type AsRelationship,
  type SimulatedAsGraph,
} from './internet/asModel';
import type { BuilderBgpAsProjection } from './builder/bgp.ts';
import './InternetScaleTheater.css';
import './InternetScaleTheater.phase3.css';
import './InternetScaleEditorialLight.css';

function asLabel(asn: number): string { return `AS${asn}`; }

function pointFor(graph: SimulatedAsGraph, asn: number, width: number, height: number, zoom: number): { x: number; y: number } {
  const node = graph.nodes.find((item) => item.asn === asn);
  if (!node) return { x: width / 2, y: height / 2 };
  const baseX = (node.x / 100) * width; const baseY = (node.y / 100) * height;
  return { x: width / 2 + (baseX - width / 2) * zoom, y: height / 2 + (baseY - height / 2) * zoom };
}

function distanceToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax; const dy = by - ay; const length2 = dx * dx + dy * dy;
  if (length2 === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / length2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export function InternetScaleTheater({ onExit, onOpenObserved, graph: inputGraph = simulatedAsGraph, initialSource = DEFAULT_AS_SOURCE, initialDestination = DEFAULT_AS_DESTINATION, builderProjection, onReturnToBuilder, stressLabel }: { onExit: () => void; onOpenObserved: () => void; graph?: SimulatedAsGraph; initialSource?: number; initialDestination?: number; builderProjection?: BuilderBgpAsProjection | null; onReturnToBuilder?: () => void; stressLabel?: string }) {
  const graph = builderProjection?.graph ?? inputGraph;
  const projectionLocked = Boolean(builderProjection);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduceMotion = useReducedMotion();
  const [source, setSource] = useState(builderProjection?.sourceAsn ?? initialSource);
  const [destination, setDestination] = useState(builderProjection?.destinationAsn ?? initialDestination);
  const [failed, setFailed] = useState<Set<string>>(() => new Set());
  const [selectedRelationshipId, setSelectedRelationshipId] = useState(() => graph.relationships[0]?.id ?? '');
  const [pickMode, setPickMode] = useState<'source' | 'destination' | null>(null);
  const [zoom, setZoom] = useState(1);
  const [dense, setDense] = useState(false);
  const [activeDrawer, setActiveDrawer] = useState<VisualDrawerId | null>(null);
  const projectedWinner = useMemo(() => {
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
  }, [builderProjection]);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    let raf = 0;
    const draw = (now: number) => {
      const rect = canvas.getBoundingClientRect(); const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, rect.width); const height = Math.max(1, rect.height);
      if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) { canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio); }
      const ctx = canvas.getContext('2d'); if (!ctx) return;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.clearRect(0, 0, width, height);

      /* AS scale now uses the same drafting surface as Journey. The canvas is
         not a dark dashboard embedded inside a light shell: relationships,
         policy selection, and the moving packet are drawn directly on paper. */
      ctx.fillStyle = '#d9d4cf'; ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = 'rgba(41,40,39,.04)'; ctx.lineWidth = 1;
      for (let x = 24; x < width; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
      for (let y = 24; y < height; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }

      for (const relationship of graph.relationships) {
        const [aAsn, bAsn] = relationshipEndpoints(relationship); const a = pointFor(graph, aAsn, width, height, zoom); const b = pointFor(graph, bAsn, width, height, zoom);
        const isFailed = failed.has(relationship.id); const isActive = activeRelationships.has(relationship.id); const isSelected = relationship.id === selectedRelationshipId;
        ctx.save(); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
        ctx.lineWidth = isSelected ? 2 : isActive ? 1.65 : .8;
        ctx.strokeStyle = isFailed ? 'rgba(184,79,75,.78)' : isActive ? 'rgba(216,79,73,.92)' : relationship.kind === 'peer' ? 'rgba(89,111,130,.38)' : 'rgba(41,40,39,.2)';
        if (isFailed || relationship.kind === 'peer') ctx.setLineDash(isFailed ? [6, 5] : [2, 5]);
        ctx.stroke(); ctx.restore();
      }

      if (winner && winner.asns.length > 1 && !reduceMotion) {
        const segmentCount = winner.asns.length - 1; const phase = ((now / 1800) % 1) * segmentCount; const segment = Math.min(segmentCount - 1, Math.floor(phase)); const local = phase - segment;
        const a = pointFor(graph, winner.asns[segment], width, height, zoom); const b = pointFor(graph, winner.asns[segment + 1], width, height, zoom);
        const x = a.x + (b.x - a.x) * local; const y = a.y + (b.y - a.y) * local;
        ctx.beginPath(); ctx.arc(x, y, 3.8, 0, Math.PI * 2); ctx.fillStyle = '#d84f49'; ctx.fill();
      }

      for (const node of graph.nodes) {
        const point = pointFor(graph, node.asn, width, height, zoom); const onPath = winner?.asns.includes(node.asn) ?? false; const endpoint = node.asn === source || node.asn === destination;
        ctx.beginPath(); ctx.arc(point.x, point.y, endpoint ? 7.2 : onPath ? 5.8 : dense ? 3 : 4, 0, Math.PI * 2);
        ctx.fillStyle = node.asn === source ? '#596f82' : node.asn === destination ? '#9a7441' : onPath ? '#d84f49' : '#77716b'; ctx.fill();
        if (endpoint || onPath) {
          ctx.beginPath(); ctx.arc(point.x, point.y, endpoint ? 10.5 : 8.4, 0, Math.PI * 2); ctx.strokeStyle = onPath ? 'rgba(216,79,73,.22)' : 'rgba(41,40,39,.16)'; ctx.lineWidth = 1; ctx.stroke();
        }
        const showLabel = endpoint || onPath || (!dense && width >= 560);
        if (showLabel) {
          ctx.font = `${endpoint ? 700 : 600} ${endpoint ? 11 : 9}px ui-monospace, SFMono-Regular, Menlo, monospace`; ctx.fillStyle = endpoint ? '#292827' : onPath ? '#8f3632' : '#68615b';
          ctx.fillText(asLabel(node.asn), point.x + 8, point.y - 7);
        }
      }
      if (!reduceMotion) raf = requestAnimationFrame(draw);
    };
    draw(performance.now());
    return () => cancelAnimationFrame(raf);
  }, [activeRelationships, dense, destination, failed, graph, reduceMotion, selectedRelationshipId, source, winner, zoom]);

  const onCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current; if (!canvas) return; const rect = canvas.getBoundingClientRect(); const px = event.clientX - rect.left; const py = event.clientY - rect.top;
    if (pickMode && !projectionLocked) {
      const nearest = graph.nodes.map((node) => ({ node, point: pointFor(graph, node.asn, rect.width, rect.height, zoom) })).sort((a,b)=>Math.hypot(px-a.point.x,py-a.point.y)-Math.hypot(px-b.point.x,py-b.point.y))[0];
      if (nearest && Math.hypot(px-nearest.point.x,py-nearest.point.y) < 30) { if (pickMode === 'source') setSource(nearest.node.asn); else setDestination(nearest.node.asn); setPickMode(null); }
      return;
    }
    const nearestRelationship = graph.relationships.map((relationship) => { const [aa,bb]=relationshipEndpoints(relationship); const a=pointFor(graph, aa,rect.width,rect.height,zoom); const b=pointFor(graph, bb,rect.width,rect.height,zoom); return { relationship, distance: distanceToSegment(px,py,a.x,a.y,b.x,b.y) }; }).sort((a,b)=>a.distance-b.distance)[0];
    if (nearestRelationship && nearestRelationship.distance < 12) setSelectedRelationshipId(nearestRelationship.relationship.id);
  };

  const toggleRelationship = (relationship: AsRelationship) => {
    if (projectionLocked) return;
    setFailed((current) => { const next = new Set(current); if (next.has(relationship.id)) next.delete(relationship.id); else next.add(relationship.id); return next; });
  };

  const toggleDrawer = (id: VisualDrawerId) => setActiveDrawer((current) => current === id ? null : id);
  const drawers: VisualDrawerDefinition[] = [
    {
      id: 'inspect',
      label: 'Inspect',
      eyebrow: 'Selected relationship',
      title: selectedRelationship ? relationshipEndpoints(selectedRelationship).map(asLabel).join(' ↔ ') : 'Nothing selected',
      content: <div className="internet-drawer-stack">
        <section className="internet-drawer-section">
          <div className="internet-panel-title"><span>RELATIONSHIP</span><strong>{selectedRelationship?.id.toUpperCase() ?? '—'}</strong></div>
          {selectedRelationship && <>
            <p className="relationship-copy">{relationshipEndpoints(selectedRelationship).map(asLabel).join(' ↔ ')} · {relationshipLabel(selectedRelationship)}</p>
            <dl className="internet-inspect-grid"><div><dt>STATE</dt><dd>{failed.has(selectedRelationship.id) ? 'FAILED' : 'AVAILABLE'}</dd></div><div><dt>PATH</dt><dd>{activeRelationships.has(selectedRelationship.id) ? 'WINNER' : 'ALTERNATE'}</dd></div></dl>
            {projectionLocked
              ? <small>READ ONLY · return to Builder to mutate sessions, relationships, or policy.</small>
              : <button className={failed.has(selectedRelationship.id) ? 'restore' : ''} type="button" onClick={() => toggleRelationship(selectedRelationship)}>{failed.has(selectedRelationship.id) ? 'RESTORE RELATIONSHIP' : 'FAIL RELATIONSHIP'}</button>}
          </>}
        </section>
      </div>,
    },
    {
      id: 'config',
      label: 'Endpoints',
      eyebrow: projectionLocked ? 'Builder truth' : 'Route endpoints',
      title: projectionLocked ? 'Locked projection' : `${asLabel(source)} → ${asLabel(destination)}`,
      content: <div className="internet-drawer-stack">
        <section className="internet-drawer-section">
          {projectionLocked ? <>
            <div className="internet-panel-title"><span>BUILDER TRUTH</span><strong>LOCKED</strong></div>
            <p className="relationship-copy">PREFIX · {builderProjection?.prefix ?? '—'}</p>
            <p className="relationship-copy">SOURCE {asLabel(source)} · ORIGIN {asLabel(destination)}</p>
            {builderProjection?.selectedRoute && <p className="relationship-copy">LOCAL_PREF {builderProjection.selectedRoute.localPref} · AS_PATH {builderProjection.selectedRoute.asPath.join(' → ') || 'LOCAL'} · MED {builderProjection.selectedRoute.med} · NEXT_HOP {builderProjection.selectedRoute.nextHopAddress} · COMM {builderProjection.selectedRoute.communities.join(' ') || 'NONE'}{builderProjection.selectedRoute.policyAnomaly ? ' · POLICY ANOMALY' : ''}</p>}
          </> : <>
            <label>SOURCE<select value={source} onChange={(event) => setSource(Number(event.currentTarget.value))}>{graph.nodes.map((node) => <option key={node.asn} value={node.asn}>{node.label} · {node.role}</option>)}</select></label>
            <label>DESTINATION<select value={destination} onChange={(event) => setDestination(Number(event.currentTarget.value))}>{graph.nodes.map((node) => <option key={node.asn} value={node.asn}>{node.label} · {node.role}</option>)}</select></label>
            <div className="internet-buttons"><button type="button" onClick={() => { setPickMode('source'); setActiveDrawer(null); }}>PICK SOURCE ON GRAPH</button><button type="button" onClick={() => { setPickMode('destination'); setActiveDrawer(null); }}>PICK DEST ON GRAPH</button></div>
          </>}
        </section>
      </div>,
    },
    {
      id: 'tools',
      label: 'Paths',
      eyebrow: 'Policy result',
      title: projectionLocked ? 'Projected path' : `${candidates.length} candidate paths`,
      content: <div className="internet-drawer-stack">
        <section className="internet-drawer-section">
          <div className="internet-panel-title"><span>{projectionLocked ? 'PROJECTED PATH' : 'CANDIDATE PATHS'}</span><strong>{projectionLocked ? 'NO RECOMPUTE' : 'POLICY ORDER'}</strong></div>
          <div className="candidate-list">{candidates.length === 0 ? <small>NO VIABLE CANDIDATES</small> : candidates.slice(0, 6).map((candidate, index) => <div key={candidate.asns.join('-')} className={index === 0 ? 'winner' : ''}><span>{String(index + 1).padStart(2, '0')}</span><p><strong>{candidate.asns.map(asLabel).join(' → ')}</strong><small>{candidate.scoreLabel}</small></p></div>)}</div>
        </section>
        <section className="internet-drawer-section">
          <div className="internet-panel-title"><span>VIEW</span><strong>CANVAS 2D</strong></div>
          <label>ZOOM<input type="range" min="0.78" max="1.24" step="0.02" value={zoom} onChange={(event) => setZoom(Number(event.currentTarget.value))} /></label>
          <div className="internet-buttons"><button type="button" onClick={() => setDense((value) => !value)}>{dense ? 'SHOW LABELS' : 'DENSE MODE'}</button><button type="button" onClick={() => { setFailed(new Set()); if (!projectionLocked) { setSource(DEFAULT_AS_SOURCE); setDestination(DEFAULT_AS_DESTINATION); } setZoom(1); }}>RESET VIEW</button></div>
        </section>
      </div>,
    },
  ];

  return <div className="internet-scale as-world-root" data-stress-label={stressLabel} data-node-count={graph.nodes.length} data-relationship-count={graph.relationships.length}>
    <VisualWorkspaceShell
      className="as-visual-workspace interactive-world-workspace"
      entrance={{
        eyebrow: projectionLocked ? 'Lab 11O → 05A · BGP projection' : 'Lab 05A · Internet scale',
        title: projectionLocked ? 'BUILDER BGP.' : 'POLICY MAKES',
        accentTitle: projectionLocked ? 'AS SCALE.' : 'THE PATH.',
        subtitle: projectionLocked ? 'Builder-selected truth, projected without recomputation.' : 'Policy, relationship, and failure shape every route.',
      }}
      stageLabel="Autonomous system routing graph"
      activeDrawer={activeDrawer}
      drawers={drawers}
      onCloseDrawer={() => setActiveDrawer(null)}
      timeline={null}
      toolbar={<>
        <div className="interactive-world-toolbar__identity"><span>{projectionLocked ? 'LAB 11O → 05A' : 'LAB 05A · AS ROUTING'}</span><strong>{projectionLocked ? 'BUILDER BGP · AS SCALE' : 'POLICY MAKES THE PATH'}</strong></div>
        <VisualDrawerTabs active={activeDrawer} items={[
          { id: 'inspect', label: 'INSPECT', badge: selectedRelationship ? '1' : '0' },
          { id: 'config', label: projectionLocked ? 'TRUTH' : 'ENDPOINTS' },
          { id: 'tools', label: 'PATHS', badge: String(candidates.length) },
        ]} onSelect={toggleDrawer} />
        <div className="interactive-world-toolbar__actions">
          {projectionLocked && onReturnToBuilder && <button type="button" onClick={onReturnToBuilder}>RETURN TO BUILDER ↗</button>}
          {!projectionLocked && <button type="button" onClick={onOpenObserved}>OBSERVED / INFERRED ↗</button>}
          <button type="button" onClick={onExit}>EXIT LAB</button>
        </div>
      </>}
      hud={<div className="interactive-world-hud internet-stage-meta">
        <div><span>SOURCE</span><strong>{asLabel(source)}</strong></div>
        <div><span>DESTINATION</span><strong>{asLabel(destination)}</strong></div>
        <div><span>{projectionLocked ? 'TRUTH' : 'CANDIDATES'}</span><strong>{projectionLocked ? 'BUILDER BEST' : candidates.length}</strong></div>
        <div><span>ROUTE</span><strong>{winner ? `${winner.relationshipIds.length} AS HOPS` : 'UNREACHABLE'}</strong></div>
        <div className="interactive-world-hud__truth"><span>PROVENANCE</span><strong>{projectionLocked ? 'BUILDER BGP PROJECTION' : 'SIMULATED · DOCUMENTATION ASNs'}</strong></div>
      </div>}
    >
      <section className={`as-cinematic-stage ${pickMode ? 'picking' : ''}`}>
        <div className={`internet-canvas-wrap ${pickMode ? 'picking' : ''}`}>
          <canvas ref={canvasRef} onClick={onCanvasClick} />
          <div className="internet-canvas-note">{projectionLocked ? 'CLICK A RELATIONSHIP TO INSPECT · RETURN TO BUILDER TO MUTATE' : pickMode ? `CLICK AN AS TO SET ${pickMode.toUpperCase()}` : 'CLICK A RELATIONSHIP TO SELECT · OPEN INSPECT TO FAIL IT'}</div>
        </div>
        <article className={`as-winner-readout ${winner ? '' : 'unreachable'}`}>
          <span>{projectionLocked ? 'BUILDER BGP BEST PATH' : 'SIMULATED WINNER'}</span>
          <strong>{winner ? winner.asns.map(asLabel).join(' → ') : projectionLocked ? 'NO PROJECTABLE BEST PATH' : 'NO POLICY-COMPLIANT PATH'}</strong>
          <p>{winner ? projectionLocked ? 'Exact Builder decision · no alternate winner computed here.' : winner.scoreLabel : projectionLocked ? 'Return to Builder and select a concrete BEST BGP route.' : 'Failed relationships partition these endpoints under the teaching policy.'}</p>
        </article>
        {selectedRelationship && <article className="as-selection-card">
          <span>SELECTED RELATIONSHIP · {selectedRelationship.id.toUpperCase()}</span>
          <strong>{relationshipEndpoints(selectedRelationship).map(asLabel).join(' ↔ ')}</strong>
          <p>{relationshipLabel(selectedRelationship)} · {failed.has(selectedRelationship.id) ? 'FAILED' : activeRelationships.has(selectedRelationship.id) ? 'ON WINNING PATH' : 'AVAILABLE ALTERNATE'}</p>
          <button type="button" onClick={() => setActiveDrawer('inspect')}>INSPECT RELATIONSHIP ↗</button>
        </article>}
      </section>
    </VisualWorkspaceShell>
  </div>;
}