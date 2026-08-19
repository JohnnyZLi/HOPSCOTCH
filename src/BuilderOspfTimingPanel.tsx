import { useMemo, useState } from 'react';
import type { BuilderAddressing } from './builder/addressing.ts';
import type { BuilderGraph } from './builder/model.ts';
import type { BuilderRoutingConfig } from './builder/routing.ts';
import { createBuilderOspfLinkFailureScenario, snapshotBuilderOspfConvergence } from './builder/ospf-timing.ts';
import { builderOspfTimerFor } from './builder/routing-policy.ts';

function labelFor(graph: BuilderGraph, id: string): string {
  return graph.nodes.find((node) => node.id === id)?.label ?? id.toUpperCase();
}

export function BuilderOspfTimingPanel({ graph, addressing, routing, sourceId, destinationId }: { graph: BuilderGraph; addressing: BuilderAddressing; routing: BuilderRoutingConfig; sourceId: string; destinationId: string }) {
  const eligible = useMemo(() => {
    const enabled = new Set(routing.ospf.enabledRouterIds);
    return graph.links.filter((link) => !link.failed && enabled.has(link.a) && enabled.has(link.b) && graph.nodes.find((node) => node.id === link.a)?.kind === 'router' && graph.nodes.find((node) => node.id === link.b)?.kind === 'router');
  }, [graph, routing]);
  const [preferredLinkId, setPreferredLinkId] = useState('edge-r1');
  const selectedLink = eligible.find((link) => link.id === preferredLinkId) ?? eligible[0] ?? null;
  const [elapsedMs, setElapsedMs] = useState(0);

  const scenario = useMemo(() => {
    if (!selectedLink) return null;
    try { const a=builderOspfTimerFor(routing.policy,selectedLink.a,selectedLink.id),b=builderOspfTimerFor(routing.policy,selectedLink.b,selectedLink.id);const timer=a.helloIntervalMs===b.helloIntervalMs&&a.deadIntervalMs===b.deadIntervalMs?a:{...a,helloIntervalMs:Math.min(a.helloIntervalMs,b.helloIntervalMs),deadIntervalMs:Math.min(a.deadIntervalMs,b.deadIntervalMs)};return createBuilderOspfLinkFailureScenario(graph,addressing,routing,sourceId,destinationId,selectedLink.id,{helloIntervalMs:timer.helloIntervalMs,deadIntervalMs:timer.deadIntervalMs,lsaFloodMs:200,spfDelayMs:500,ribInstallMs:100,fibInstallMs:100}); }
    catch { return null; }
  }, [graph, addressing, routing, sourceId, destinationId, selectedLink]);
  const snapshot = useMemo(() => scenario ? snapshotBuilderOspfConvergence(scenario, elapsedMs) : null, [scenario, elapsedMs]);

  if (routing.ospf.enabledRouterIds.length === 0) return null;
  if (!selectedLink || !scenario || !snapshot) return <section className="builder-ospf-timing-section"><div className="control-title"><span>OSPF CONVERGENCE</span><strong>NO ELIGIBLE LINK</strong></div><small className="builder-routing-note">Enable OSPF on both ends of an active router-router link to inspect timed convergence.</small></section>;

  const maxMs = scenario.fibInstallAtMs + 1000;
  const path = snapshot.fibTrace.hops.flatMap((hop, index) => index === 0 ? [hop.nodeId, hop.nextNodeId].filter(Boolean) : [hop.nextNodeId].filter(Boolean)) as string[];
  return <section className="builder-ospf-timing-section">
    <div className="control-title"><span>OSPF CONVERGENCE</span><strong>{snapshot.phase}</strong></div>
    <label>FAILURE LINK<select value={selectedLink.id} onChange={(event)=>{setPreferredLinkId(event.currentTarget.value);setElapsedMs(0);}}>{eligible.map((link)=><option key={link.id} value={link.id}>{labelFor(graph,link.a)} ↔ {labelFor(graph,link.b)} · COST {link.cost}</option>)}</select></label>
    <label>SIMULATION TIME · {(snapshot.elapsedMs/1000).toFixed(1)}s<input aria-label="OSPF convergence time" type="range" min={0} max={maxMs} step={100} value={Math.min(elapsedMs,maxMs)} onChange={(event)=>setElapsedMs(Number(event.currentTarget.value))}/></label>
    <div className="button-row"><button type="button" onClick={()=>setElapsedMs(0)}>LINK DOWN</button><button type="button" onClick={()=>setElapsedMs(scenario.deadAtMs)}>DEAD TIMER</button><button type="button" onClick={()=>setElapsedMs(scenario.spfCompleteAtMs)}>SPF DONE</button><button type="button" onClick={()=>setElapsedMs(scenario.fibInstallAtMs)}>FIB DONE</button></div>
    <div className="builder-ospf-timing-grid">
      <div><span>PHYSICAL</span><strong>LINK DOWN · t=0</strong></div>
      <div><span>NEIGHBOR</span><strong>{snapshot.controlUsesFailedTopology?'DOWN':'FULL · STALE'}</strong></div>
      <div><span>RIB</span><strong>{snapshot.ribUsesFailedTopology?'RECONVERGED':'OLD ROUTE'}</strong></div>
      <div><span>FIB</span><strong>{snapshot.fibUsesFailedTopology?'REPROGRAMMED':'OLD NEXT HOP'}</strong></div>
      <div><span>TRAFFIC</span><strong>{snapshot.fibTrace.reachable?'RECOVERED':snapshot.fibTrace.failureReason ?? 'INTERRUPTED'}</strong></div>
    </div>
    <div className={`builder-ospf-timing-path ${snapshot.fibTrace.reachable?'recovered':'failed'}`}><span>DATA PLANE AT THIS INSTANT</span><strong>{snapshot.fibTrace.reachable && path.length>0 ? path.map((id)=>labelFor(graph,id)).join(' → ') : `${snapshot.fibTrace.failureNodeId ? labelFor(graph,snapshot.fibTrace.failureNodeId) : 'FORWARDING'} · ${snapshot.fibTrace.failureReason ?? 'NO PROGRESS'}`}</strong><p>{snapshot.fibTrace.explanation}</p></div>
    <div className="builder-ospf-event-strip">{scenario.events.map((event)=><button type="button" key={event.id} className={event.atMs<=snapshot.elapsedMs?'visible':''} onClick={()=>setElapsedMs(event.atMs)}><b>{(event.atMs/1000).toFixed(1)}s · {event.kind.replaceAll('_',' ')}</b><span>{event.summary}</span></button>)}</div>
    <small className="builder-routing-note">TIMED TEACHING MODEL · HELLO {(scenario.profile.helloIntervalMs/1000).toFixed(1)}s · DEAD {(scenario.profile.deadIntervalMs/1000).toFixed(1)}s · CONFIGURED INTERFACE TIMERS DRIVE FAILURE DETECTION; PHYSICAL FAILURE, NEIGHBOR KNOWLEDGE, SPF, RIB, FIB, AND TRAFFIC RECOVERY STAY DISTINCT.</small>
  </section>;
}
