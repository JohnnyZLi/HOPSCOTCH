import { useMemo, useState } from 'react';
import type { BuilderApplicationTransaction } from './builder/application.ts';
import {
  createBuilderTrafficScenario,
  evaluateBuilderPmtu,
  runBuilderTrafficScenario,
  type BuilderPmtuFamily,
  type BuilderPmtuResult,
  type BuilderTrafficPattern,
  type BuilderTrafficRun,
} from './builder/data-plane.ts';
import type { BuilderLinkProfiles } from './builder/link-characteristics.ts';
import './BuilderDataPlanePanel.css';

export interface BuilderDataPlanePanelProps {
  transaction: BuilderApplicationTransaction | null;
  linkProfiles: BuilderLinkProfiles;
  historical: boolean;
}

const PATTERNS: Array<{ id: BuilderTrafficPattern; label: string; detail: string }> = [
  { id: 'single', label: 'SINGLE FLOW', detail: 'one moderate transport flow' },
  { id: 'bulk-tcp', label: 'BULK TCP', detail: 'one saturating TCP sender' },
  { id: 'competing', label: 'COMPETING', detail: 'TCP + TCP + QUIC share one bottleneck' },
  { id: 'udp-cbr', label: 'UDP CBR', detail: 'constant-rate non-responsive UDP' },
  { id: 'burst', label: 'BURST', detail: 'deterministic on/off UDP burst' },
];

function pathFromTransaction(transaction: BuilderApplicationTransaction | null): string[] {
  if (!transaction) return [];
  const linkStage = transaction.stages.find((stage) => stage.boundary === 'LINK' && stage.status === 'PASS');
  if (linkStage?.linkIds.length) return linkStage.linkIds;
  const routingStage = transaction.stages.find((stage) => stage.boundary === 'ROUTING' && stage.status === 'PASS');
  return routingStage?.linkIds ?? [];
}

function pct(value: number): string { return `${(value * 100).toFixed(0)}%`; }
function ms(value: number): string { return `${value.toFixed(value < 10 ? 2 : 1)} ms`; }

export function BuilderDataPlanePanel({ transaction, linkProfiles, historical }: BuilderDataPlanePanelProps) {
  const pathLinkIds = useMemo(() => pathFromTransaction(transaction), [transaction]);
  const [pattern, setPattern] = useState<BuilderTrafficPattern>('competing');
  const [traffic, setTraffic] = useState<BuilderTrafficRun | null>(null);
  const [family, setFamily] = useState<BuilderPmtuFamily>('ipv4');
  const [packetBytes, setPacketBytes] = useState(2000);
  const [df, setDf] = useState(true);
  const [blackHole, setBlackHole] = useState(false);
  const [pmtu, setPmtu] = useState<BuilderPmtuResult | null>(null);
  const usable = Boolean(transaction?.success && pathLinkIds.length);

  const runTraffic = () => {
    if (!usable) return;
    const transport = transaction?.service.transportProfile === 'quic-h3' ? 'quic' : transaction?.service.kind === 'udp' || transaction?.service.kind === 'dns' ? 'udp' : 'tcp';
    setTraffic(runBuilderTrafficScenario(linkProfiles, createBuilderTrafficScenario(pattern, pathLinkIds, linkProfiles, transport)));
  };

  const runPmtu = () => {
    if (!usable || !transaction) return;
    setPmtu(evaluateBuilderPmtu({ profiles: linkProfiles, linkIds: pathLinkIds, family, packetBytes, destinationKey: transaction.destinationAddress ?? transaction.destinationNodeId, df, suppressControlMessage: blackHole }));
  };

  return <section className="builder-data-plane" data-track-e="canonical-data-plane">
    <header className="builder-data-plane-heading">
      <div><span>TRACK E · DATA PLANE</span><strong>QUEUES · CAPACITY · PMTU · TRANSPORT RESPONSE</strong><p>Runs only on the canonical path produced by the application transaction. Routing, policy, NAT, and L2 truth are not recomputed here.</p></div>
      <span className="builder-data-plane-boundary">SIMULATED · DETERMINISTIC</span>
    </header>

    {!usable ? <div className="builder-data-plane-empty"><strong>RUN A SUCCESSFUL APPLICATION TRANSACTION FIRST</strong><p>Track E needs the exact routed link IDs from Track D. It does not invent a path just to demonstrate congestion.</p></div> : <>
      <div className="builder-data-plane-path"><span>CANONICAL PATH</span><code>{pathLinkIds.join(' → ')}</code></div>
      <div className="builder-data-plane-grid">
        <article className="builder-data-plane-card">
          <div className="builder-data-plane-card-heading"><span>TRAFFIC GENERATOR</span><strong>QUEUE + BANDWIDTH TRUTH</strong></div>
          <div className="builder-data-plane-patterns">{PATTERNS.map((entry) => <button key={entry.id} type="button" disabled={historical} className={pattern === entry.id ? 'active' : ''} onClick={() => setPattern(entry.id)}><b>{entry.label}</b><small>{entry.detail}</small></button>)}</div>
          <button type="button" className="builder-data-plane-run" disabled={historical} onClick={runTraffic}>RUN DATA PLANE</button>
          {traffic && <>
            <div className="builder-data-plane-result"><span>RESULT</span><strong>{traffic.summary}</strong><small>Round-robin packet scheduling · per-link queue capacity · 75% ECN marking threshold · tail drop at configured queue ceiling</small></div>
            <div className="builder-data-plane-link-list">{traffic.links.map((link) => <div key={link.linkId}><span>{link.linkId}</span><strong>{link.bandwidthMbps} Mb/s · {pct(link.utilization)}</strong><small>peak {link.peakQueuePackets}/{link.queueCapacityPackets} pkts · {ms(link.peakQueueDelayMs)} queue · {link.ecnMarks} CE · {link.tailDrops} drop</small></div>)}</div>
            <div className="builder-data-plane-flow-list">{traffic.flows.map((flow) => <div key={flow.id} data-recovery={flow.recovery}><span>{flow.id} · {flow.transport.toUpperCase()}</span><strong>{flow.deliveredRateMbps.toFixed(2)} / {flow.offeredRateMbps.toFixed(2)} Mb/s</strong><small>RTT {ms(flow.estimatedRttMs)} · queue {ms(flow.averageQueueDelayMs)} · {flow.ecnMarks} CE · {flow.droppedPackets} drops · {flow.recovery}</small></div>)}</div>
            <div className="builder-data-plane-events">{traffic.events.slice(0, 20).map((event) => <span key={event.id}><b>{event.atMs} ms · {event.kind.replaceAll('_', ' ')}</b>{event.summary}</span>)}</div>
          </>}
        </article>

        <article className="builder-data-plane-card">
          <div className="builder-data-plane-card-heading"><span>PATH MTU</span><strong>FRAGMENTATION + PMTUD</strong></div>
          <div className="builder-data-plane-pmtu-controls">
            <label>FAMILY<select disabled={historical} value={family} onChange={(event) => setFamily(event.currentTarget.value as BuilderPmtuFamily)}><option value="ipv4">IPV4</option><option value="ipv6">IPV6</option></select></label>
            <label>PACKET BYTES<input disabled={historical} type="number" min={family === 'ipv6' ? 1280 : 68} max={65535} value={packetBytes} onChange={(event) => setPacketBytes(Number(event.currentTarget.value))} /></label>
            {family === 'ipv4' && <label className="check"><input disabled={historical} type="checkbox" checked={df} onChange={(event) => setDf(event.currentTarget.checked)} />DF</label>}
            <label className="check"><input disabled={historical} type="checkbox" checked={blackHole} onChange={(event) => setBlackHole(event.currentTarget.checked)} />DROP ICMP/PTB</label>
          </div>
          <button type="button" className="builder-data-plane-run" disabled={historical} onClick={runPmtu}>EVALUATE PMTU</button>
          {pmtu && <div className={`builder-data-plane-pmtu-result ${pmtu.outcome === 'BLACK_HOLE' ? 'failed' : ''}`}><span>{pmtu.outcome.replaceAll('_', ' ')}</span><strong>{pmtu.summary}</strong><small>limiting link {pmtu.limitingLinkId} · path MTU {pmtu.pathMtuBytes} B · transport {pmtu.transportEffect}</small>{pmtu.fragments.length > 0 && <code>{pmtu.fragments.map((fragment) => `${fragment.offsetBytes}:${fragment.packetBytes}${fragment.moreFragments ? '+' : ''}`).join(' · ')}</code>}{pmtu.cacheEntry && <p>PMTU CACHE · {pmtu.cacheEntry.destinationKey} → {pmtu.cacheEntry.mtuBytes} B · {pmtu.cacheEntry.learnedFrom}</p>}</div>}
          <div className="builder-data-plane-note"><strong>TRUTH BOUNDARY</strong><p>IPv4 may fragment only when DF is clear. IPv6 routers never fragment. A blocked Frag Needed / Packet Too Big signal becomes an explicit PMTUD black hole; HOPSCOTCH does not pretend transport made progress.</p></div>
        </article>
      </div>
    </>}
  </section>;
}
