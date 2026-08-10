import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { type FormEvent, useState } from 'react';
import type { InternetEvidenceError, InternetEvidenceSnapshot } from './internet/evidence';
import './ObservedInternet.css';

function asLabel(asn: number | null): string { return asn === null ? 'UNAVAILABLE' : `AS${asn}`; }
function joinLocation(city: string | null, region: string | null, country: string | null): string {
  return [city, region, country].filter((value): value is string => Boolean(value)).join(' · ') || 'UNAVAILABLE';
}

export function ObservedInternet({ onExit, onOpenSimulated }: { onExit: () => void; onOpenSimulated: () => void }) {
  const reduceMotion = useReducedMotion();
  const [host, setHost] = useState('cloudflare.com');
  const [snapshot, setSnapshot] = useState<InternetEvidenceSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (event?: FormEvent) => {
    event?.preventDefault();
    setLoading(true); setError(null);
    try {
      const response = await fetch(`/api/internet/snapshot?host=${encodeURIComponent(host.trim())}`, { headers: { accept: 'application/json' } });
      const payload = await response.json() as InternetEvidenceSnapshot | InternetEvidenceError;
      if (!response.ok || ('ok' in payload && payload.ok === false)) throw new Error('error' in payload ? payload.error : `Snapshot failed with HTTP ${response.status}.`);
      if (!('schema' in payload) || payload.schema !== 'hopscotch.internet-evidence') throw new Error('HOPSCOTCH received an unexpected evidence payload.');
      setSnapshot(payload);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load Internet evidence.');
    } finally { setLoading(false); }
  };

  return <motion.section className="observed-internet" initial={reduceMotion ? {opacity:1}:{opacity:0,scale:.985}} animate={{opacity:1,scale:1}} exit={{opacity:0}}>
    <header className="observed-heading"><div><p className="eyebrow">Lab 05B · Internet evidence</p><h1>OBSERVE WHAT<br/><span>WE ACTUALLY KNOW.</span></h1></div><div className="observed-heading-actions"><span>NO END-TO-END ROUTE CLAIM</span><button className="lab-mode" type="button" onClick={onOpenSimulated}>SIMULATED AS ↗</button><button className="lab-mode" type="button" onClick={onExit}>EXIT LAB</button></div></header>
    <form className="observed-query" onSubmit={(event)=>void load(event)}><label><span>DESTINATION HOSTNAME</span><input value={host} maxLength={253} autoComplete="off" spellCheck={false} onChange={(event)=>setHost(event.currentTarget.value)} placeholder="example.com"/></label><button type="submit" disabled={loading}>{loading?'OBSERVING…':'BUILD EVIDENCE SNAPSHOT'}</button><p>Cloudflare edge metadata and public RIPE RIS observations are shown as separate evidence classes. Collector paths are never presented as the browser’s measured route.</p></form>
    <AnimatePresence mode="wait" initial={false}>{error&&<motion.div key={error} className="observed-error" initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} exit={{opacity:0}}><strong>SNAPSHOT ERROR</strong><span>{error}</span>{snapshot&&<small>THE PREVIOUS VALID SNAPSHOT REMAINS ON SCREEN.</small>}</motion.div>}</AnimatePresence>
    {!snapshot?<section className="observed-empty"><div className="evidence-orbit"><i/><i/><i/><b/></div><p>Enter a hostname to build one provenance-rich snapshot. Request-address identifiers are intentionally excluded from the browser-facing evidence model.</p></section>:
    <div className="observed-main">
      <section className="evidence-flow">
        <article className={`evidence-card state-${snapshot.edge.availability}`}><div className="provenance edge">EDGE OBSERVED</div><header><span>CURRENT HOPSCOTCH REQUEST</span><strong>{asLabel(snapshot.edge.asn)}</strong></header><dl><div><dt>ORGANIZATION</dt><dd>{snapshot.edge.organization??'UNAVAILABLE'}</dd></div><div><dt>CLOUDFLARE COLO</dt><dd>{snapshot.edge.colo??'UNAVAILABLE'}</dd></div><div><dt>LOCATION CONTEXT</dt><dd>{joinLocation(snapshot.edge.city,snapshot.edge.region,snapshot.edge.country)}</dd></div><div><dt>EDGE RTT</dt><dd>{snapshot.edge.transportRttMs===null?'UNAVAILABLE':`${snapshot.edge.transportRttMs} ms · ${snapshot.edge.transport??'transport'}`}</dd></div></dl><p>{snapshot.edge.note}</p></article>
        <div className="inferred-bridge"><span className="provenance inferred">INFERRED</span><div><i/><strong>NO CONTINUOUS OBSERVATION</strong><i/></div><p>{snapshot.bridge.sourceAsn===null?'EDGE ASN UNAVAILABLE':`AS${snapshot.bridge.sourceAsn}`} <b>≠ measured path ≠</b> {snapshot.bridge.destinationOriginAsns.length?snapshot.bridge.destinationOriginAsns.map((asn)=>`AS${asn}`).join(' / '):'DESTINATION ORIGIN UNAVAILABLE'}</p><small>{snapshot.bridge.note}</small></div>
        <article className={`evidence-card state-${snapshot.destination.availability}`}><div className="provenance inferred">INFERRED</div><header><span>DESTINATION RESOLUTION</span><strong>{snapshot.destination.hostname}</strong></header><dl><div><dt>SELECTED ADDRESS</dt><dd>{snapshot.destination.selectedAddress??'UNAVAILABLE'}</dd></div><div><dt>RESOLVED ADDRESSES</dt><dd>{snapshot.destination.addresses.length?snapshot.destination.addresses.join(' · '):'UNAVAILABLE'}</dd></div></dl><p>{snapshot.destination.note}</p></article>
        <article className={`evidence-card state-${snapshot.routing.availability}`}><div className="provenance collector">PUBLIC COLLECTOR</div><header><span>DESTINATION ROUTING CONTEXT</span><strong>{snapshot.routing.prefix??'UNAVAILABLE'}</strong></header><dl><div><dt>ORIGIN ASN(S)</dt><dd>{snapshot.routing.originAsns.length?snapshot.routing.originAsns.map((asn)=>`AS${asn}`).join(' · '):'UNAVAILABLE'}</dd></div></dl><p>{snapshot.routing.note}</p></article>
      </section>
      <aside className="collector-panel"><div className="collector-heading"><div><span>PUBLIC COLLECTOR</span><strong>RIPE RIS AS PATHS</strong></div><small>{snapshot.collectorPaths.length} OBSERVATIONS</small></div><p className="collector-warning">Each row is a route seen from a named RIS collector-peer vantage point. It is not the current browser’s exact forwarding path.</p><div className="collector-paths">{snapshot.collectorPaths.length===0?<div className="collector-empty"><strong>NO COLLECTOR PATH AVAILABLE</strong><span>HOPSCOTCH will not fabricate one.</span></div>:snapshot.collectorPaths.map((path,index)=><article key={`${path.sourceId}-${index}`}><div><span className="provenance collector">PUBLIC COLLECTOR</span><small>{path.sourceId}</small></div><strong>{path.asPath.map((asn)=>`AS${asn}`).join(' → ')}</strong><p>{path.targetPrefix}</p><small>{path.note}</small></article>)}</div>{snapshot.warnings.length>0&&<div className="evidence-warnings"><span>PARTIAL EVIDENCE</span>{snapshot.warnings.map((warning)=><p key={warning}>{warning}</p>)}</div>}<footer><span>SNAPSHOT</span><strong>{new Date(snapshot.generatedAt).toLocaleString()}</strong></footer></aside>
    </div>}
  </motion.section>;
}
