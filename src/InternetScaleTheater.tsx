import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
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
      ctx.fillStyle = '#070b10'; ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = 'rgba(255,255,255,.025)'; ctx.lineWidth = 1;
      for (let x = 24; x < width; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
      for (let y = 24; y < height; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }

      for (const relationship of graph.relationships) {
        const [aAsn, bAsn] = relationshipEndpoints(relationship); const a = pointFor(graph, aAsn, width, height, zoom); const b = pointFor(graph, bAsn, width, height, zoom);
        const isFailed = failed.has(relationship.id); const isActive = activeRelationships.has(relationship.id); const isSelected = relationship.id === selectedRelationshipId;
        ctx.save(); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
        ctx.lineWidth = isSelected ? 2.4 : isActive ? 2 : .8;
        ctx.strokeStyle = isFailed ? 'rgba(236,104,104,.72)' : isActive ? 'rgba(121,242,218,.9)' : relationship.kind === 'peer' ? 'rgba(122,156,255,.29)' : 'rgba(145,159,168,.2)';
        if (isFailed || relationship.kind === 'peer') ctx.setLineDash(isFailed ? [6, 5] : [2, 5]);
        ctx.stroke(); ctx.restore();
      }

      if (winner && winner.asns.length > 1 && !reduceMotion) {
        const segmentCount = winner.asns.length - 1; const phase = ((now / 1800) % 1) * segmentCount; const segment = Math.min(segmentCount - 1, Math.floor(phase)); const local = phase - segment;
        const a = pointFor(graph, winner.asns[segment], width, height, zoom); const b = pointFor(graph, winner.asns[segment + 1], width, height, zoom);
        const x = a.x + (b.x - a.x) * local; const y = a.y + (b.y - a.y) * local;
        ctx.beginPath(); ctx.arc(x, y, 4.2, 0, Math.PI * 2); ctx.fillStyle = '#bffdf2'; ctx.shadowColor = '#79f2da'; ctx.shadowBlur = 16; ctx.fill(); ctx.shadowBlur = 0;
      }

      for (const node of graph.nodes) {
        const point = pointFor(graph, node.asn, width, height, zoom); const onPath = winner?.asns.includes(node.asn) ?? false; const endpoint = node.asn === source || node.asn === destination;
        ctx.beginPath(); ctx.arc(point.x, point.y, endpoint ? 7.5 : onPath ? 6.2 : dense ? 3.2 : 4.2, 0, Math.PI * 2);
        ctx.fillStyle = node.asn === source ? '#7a9cff' : node.asn === destination ? '#f2c879' : onPath ? '#79f2da' : '#33424c'; ctx.fill();
        const showLabel = endpoint || onPath || (!dense && width >= 560);
        if (showLabel) {
          ctx.font = `${endpoint ? 700 : 600} ${endpoint ? 11 : 9}px ui-monospace, SFMono-Regular, Menlo, monospace`; ctx.fillStyle = endpoint ? '#eaf2f6' : onPath ? '#bdfbf0' : '#64737d';
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

  return <motion.section className="internet-scale" data-stress-label={stressLabel} data-node-count={graph.nodes.length} data-relationship-count={graph.relationships.length} initial={reduceMotion ? {opacity:1}:{opacity:0,scale:.985}} animate={{opacity:1,scale:1}} exit={{opacity:0}}>
    <header className="internet-heading"><div><p className="eyebrow">{projectionLocked?'Lab 11O → 05A · BGP projection':'Lab 05A · Internet scale'}</p><h1>{projectionLocked?<>BUILDER BGP.<br/><span>AS SCALE.</span></>:<>POLICY MAKES<br/><span>THE PATH.</span></>}</h1></div><div className="internet-heading-actions"><span>{projectionLocked?'BUILDER BGP PROJECTION · DOCUMENTATION ASNs':'SIMULATED · DOCUMENTATION ASNs ONLY'}</span>{projectionLocked&&onReturnToBuilder&&<button className="lab-mode" type="button" onClick={onReturnToBuilder}>RETURN TO BUILDER ↗</button>}{!projectionLocked&&<button className="lab-mode" type="button" onClick={onOpenObserved}>OBSERVED / INFERRED ↗</button>}<button className="lab-mode" type="button" onClick={onExit}>EXIT LAB</button></div></header>
    <div className="internet-main">
      <section className="internet-stage"><div className="internet-stage-meta"><div><span>SOURCE</span><strong>{asLabel(source)}</strong></div><div><span>DESTINATION</span><strong>{asLabel(destination)}</strong></div><div><span>{projectionLocked?'TRUTH':'CANDIDATES'}</span><strong>{projectionLocked?'BUILDER BEST':candidates.length}</strong></div><div><span>SELECTED</span><strong>{winner ? `${winner.relationshipIds.length} AS HOPS` : 'UNREACHABLE'}</strong></div></div><div className={`internet-canvas-wrap ${pickMode ? 'picking':''}`}><canvas ref={canvasRef} onClick={onCanvasClick}/><div className="internet-canvas-note">{projectionLocked?'CLICK A RELATIONSHIP TO INSPECT · RETURN TO BUILDER TO MUTATE':pickMode ? `CLICK AN AS TO SET ${pickMode.toUpperCase()}` : 'CLICK A RELATIONSHIP TO INSPECT / FAIL IT'}</div></div>{winner?<div className="internet-winner"><span>{projectionLocked?'BUILDER BGP BEST PATH':'SIMULATED WINNER'}</span><strong>{winner.asns.map(asLabel).join(' → ')}</strong><p>{projectionLocked?'Exact Builder BGP decision projected at AS scale. Lab 05 is not recomputing a different winner.':`${winner.scoreLabel} · stable ASN-path tie break. Curated valley-free teaching policy, not universal BGP best-path behavior.`}</p></div>:<div className="internet-winner unreachable"><span>{projectionLocked?'BUILDER BGP PROJECTION':'SIMULATED WINNER'}</span><strong>{projectionLocked?'NO PROJECTABLE BEST PATH':'NO POLICY-COMPLIANT PATH'}</strong><p>{projectionLocked?'Return to Builder and select a concrete BEST BGP route.':'Current failed relationships partition the selected source/destination under this teaching model.'}</p></div>}</section>
      <aside className="internet-panel"><section><div className="internet-panel-title"><span>{projectionLocked?'BUILDER TRUTH':'ENDPOINTS'}</span><strong>{projectionLocked?'LOCKED PROJECTION':'PICK FROM CANVAS'}</strong></div>{projectionLocked?<><p className="relationship-copy">PREFIX · {builderProjection?.prefix??'—'}</p><p className="relationship-copy">SOURCE {asLabel(source)} · ORIGIN {asLabel(destination)}</p>{builderProjection?.selectedRoute&&<p className="relationship-copy">LOCAL_PREF {builderProjection.selectedRoute.localPref} · AS_PATH {builderProjection.selectedRoute.asPath.join(' → ')||'LOCAL'} · MED {builderProjection.selectedRoute.med} · NEXT_HOP {builderProjection.selectedRoute.nextHopAddress} · COMM {builderProjection.selectedRoute.communities.join(' ')||'NONE'}{builderProjection.selectedRoute.policyAnomaly?' · POLICY ANOMALY':''}</p>}</>:<><label>SOURCE<select value={source} onChange={(e)=>setSource(Number(e.currentTarget.value))}>{graph.nodes.map((node)=><option key={node.asn} value={node.asn}>{node.label} · {node.role}</option>)}</select></label><label>DESTINATION<select value={destination} onChange={(e)=>setDestination(Number(e.currentTarget.value))}>{graph.nodes.map((node)=><option key={node.asn} value={node.asn}>{node.label} · {node.role}</option>)}</select></label><div className="internet-buttons"><button type="button" onClick={()=>setPickMode('source')}>PICK SOURCE</button><button type="button" onClick={()=>setPickMode('destination')}>PICK DEST</button></div></>}</section>
      <section><div className="internet-panel-title"><span>RELATIONSHIP</span><strong>{selectedRelationship?.id.toUpperCase()}</strong></div>{selectedRelationship&&<><p className="relationship-copy">{relationshipEndpoints(selectedRelationship).map(asLabel).join(' ↔ ')} · {relationshipLabel(selectedRelationship)}</p>{projectionLocked?<small>READ ONLY · return to Builder to mutate sessions, relationships, or policy.</small>:<button className={failed.has(selectedRelationship.id)?'restore':''} type="button" onClick={()=>toggleRelationship(selectedRelationship)}>{failed.has(selectedRelationship.id)?'RESTORE RELATIONSHIP':'FAIL RELATIONSHIP'}</button>}</>}</section>
      <section><div className="internet-panel-title"><span>{projectionLocked?'PROJECTED PATH':'CANDIDATE PATHS'}</span><strong>{projectionLocked?'NO RECOMPUTE':'POLICY ORDER'}</strong></div><div className="candidate-list">{candidates.length===0?<small>NO VIABLE CANDIDATES</small>:candidates.slice(0,6).map((candidate,index)=><div key={candidate.asns.join('-')} className={index===0?'winner':''}><span>{String(index+1).padStart(2,'0')}</span><p><strong>{candidate.asns.map(asLabel).join(' → ')}</strong><small>{candidate.scoreLabel}</small></p></div>)}</div></section>
      <section><div className="internet-panel-title"><span>VIEW</span><strong>CANVAS 2D</strong></div><label>ZOOM<input type="range" min="0.78" max="1.24" step="0.02" value={zoom} onChange={(e)=>setZoom(Number(e.currentTarget.value))}/></label><div className="internet-buttons"><button type="button" onClick={()=>setDense((value)=>!value)}>{dense?'SHOW LABELS':'DENSE MODE'}</button><button type="button" onClick={()=>{setFailed(new Set());if(!projectionLocked){setSource(DEFAULT_AS_SOURCE);setDestination(DEFAULT_AS_DESTINATION);}setZoom(1);}}>RESET VIEW</button></div></section></aside>
    </div>
  </motion.section>;
}
