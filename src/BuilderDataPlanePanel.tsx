import { useEffect, useMemo, useState } from 'react';
import type { BuilderApplicationContext, BuilderApplicationTransaction } from './builder/application.ts';
import {
  applyBuilderIpv4PmtuResult,
  createBuilderTrafficScenario,
  evaluateBuilderIpv4PmtuWithCache,
  evaluateBuilderPmtu,
  runBuilderTrafficScenario,
  type BuilderIpv4PmtuCache,
  type BuilderPmtuResult,
  type BuilderTrafficPattern,
  type BuilderTrafficRun,
} from './builder/data-plane.ts';
import { checkBuilderIpv6Pmtu, type BuilderIpv6ControlState } from './builder/ipv6-control-plane.ts';
import './BuilderDataPlanePanel.css';

export interface BuilderDataPlanePanelProps {
  transaction: BuilderApplicationTransaction | null;
  context: BuilderApplicationContext;
  historical: boolean;
  onIpv6ControlState: (state: BuilderIpv6ControlState) => void;
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

export function BuilderDataPlanePanel({ transaction, context, historical, onIpv6ControlState }: BuilderDataPlanePanelProps) {
  const linkProfiles = context.linkProfiles;
  const pathLinkIds = useMemo(() => pathFromTransaction(transaction), [transaction]);
  const [pattern, setPattern] = useState<BuilderTrafficPattern>('competing');
  const [traffic, setTraffic] = useState<BuilderTrafficRun | null>(null);
  const [packetBytes, setPacketBytes] = useState(2000);
  const [df, setDf] = useState(true);
  const [blackHole, setBlackHole] = useState(false);
  const [pmtu, setPmtu] = useState<BuilderPmtuResult | null>(null);
  const [ipv4PmtuCache, setIpv4PmtuCache] = useState<BuilderIpv4PmtuCache>([]);
  const family = transaction?.family ?? 'ipv4';
  const usable = Boolean(transaction?.success && pathLinkIds.length && pathLinkIds.every((linkId) => Boolean(linkProfiles[linkId])));

  useEffect(() => { setTraffic(null); setPmtu(null); setIpv4PmtuCache([]); }, [transaction?.id]);

  const runTraffic = () => {
    if (!usable) return;
    const transport = transaction?.service.transportProfile === 'quic-h3' ? 'quic' : transaction?.service.kind === 'udp' || transaction?.service.kind === 'dns' ? 'udp' : 'tcp';
    setTraffic(runBuilderTrafficScenario(linkProfiles, createBuilderTrafficScenario(pattern, pathLinkIds, linkProfiles, transport)));
  };

  const runPmtu = () => {
    if (!usable || !transaction) return;
    const destinationKey = transaction.destinationAddress ?? transaction.destinationNodeId;
    if (family === 'ipv4') {
      const result = evaluateBuilderIpv4PmtuWithCache({ profiles: linkProfiles, linkIds: pathLinkIds, packetBytes, destinationKey, df, suppressControlMessage: blackHole, cache: ipv4PmtuCache });
      setIpv4PmtuCache((current) => applyBuilderIpv4PmtuResult(current, result));
      setPmtu(result);
      return;
    }

    if (!transaction.ipv6Forwarding) return;
    if (blackHole) {
      setPmtu(evaluateBuilderPmtu({ profiles: linkProfiles, linkIds: pathLinkIds, family: 'ipv6', packetBytes, destinationKey, suppressControlMessage: true }));
      return;
    }

    const checked = checkBuilderIpv6Pmtu(context.graph, context.ipv6, transaction.ipv6Forwarding, linkProfiles, packetBytes, context.ipv6ControlState, context.ipv6ControlState.clock + 1);
    const event = checked.event;
    if (event && !event.delivered) {
      setPmtu({ family: 'ipv6', packetBytes: checked.requestedBytes, effectivePacketBytes: checked.effectivePacketBytes, pathMtuBytes: event.mtuBytes, limitingLinkId: event.linkId, df: true, controlMessageDelivered: false, outcome: 'BLACK_HOLE', fragments: [], cacheEntry: null, transportEffect: 'TIMEOUT NO PROGRESS', summary: `${event.detail} PMTUD cannot make progress until Packet Too Big can return.`, provenance: 'SIMULATED' });
      return;
    }

    onIpv6ControlState(checked.state);
    const cached = checked.state.pmtuCache.find((entry) => entry.sourceNodeId === transaction.sourceNodeId && entry.destinationNodeId === transaction.destinationNodeId) ?? null;
    if (event) {
      setPmtu({ family: 'ipv6', packetBytes: checked.requestedBytes, effectivePacketBytes: checked.effectivePacketBytes, pathMtuBytes: event.mtuBytes, limitingLinkId: event.linkId, df: true, controlMessageDelivered: true, outcome: 'ICMPV6_PACKET_TOO_BIG', fragments: [], cacheEntry: cached ? { family: 'ipv6', destinationKey, mtuBytes: cached.pathMtuBytes, learnedFrom: 'ICMPV6 PACKET TOO BIG' } : null, transportEffect: 'RETRY SMALLER', summary: event.detail, provenance: 'SIMULATED' });
      return;
    }

    const pathMtuBytes = Math.min(...pathLinkIds.map((linkId) => linkProfiles[linkId].mtuBytes));
    setPmtu({ family: 'ipv6', packetBytes: checked.requestedBytes, effectivePacketBytes: checked.effectivePacketBytes, pathMtuBytes: cached?.pathMtuBytes ?? pathMtuBytes, limitingLinkId: cached?.linkId ?? pathLinkIds.find((linkId) => linkProfiles[linkId].mtuBytes === pathMtuBytes) ?? pathLinkIds[0], df: true, controlMessageDelivered: false, outcome: 'DELIVERED', fragments: [], cacheEntry: cached ? { family: 'ipv6', destinationKey, mtuBytes: cached.pathMtuBytes, learnedFrom: 'ICMPV6 PACKET TOO BIG' } : null, transportEffect: 'NONE', summary: checked.cacheHit ? `Canonical IPv6 PMTU cache constrains ${checked.requestedBytes} B to ${checked.effectivePacketBytes} B before transmission.` : `${checked.effectivePacketBytes} B fits the canonical IPv6 path MTU.`, provenance: 'SIMULATED' });
  };

  return <section className="builder-data-plane" data-track-e="canonical-data-plane">
    <header className="builder-data-plane-heading">
      <div><span>TRACK E · DATA PLANE</span><strong>QUEUES · CAPACITY · PMTU · TRANSPORT RESPONSE</strong><p>Runs only on the canonical path produced by the application transaction. Routing, policy, NAT, and L2 truth are not recomputed here.</p></div>
      <span className="builder-data-plane-boundary">SIMULATED · DETERMINISTIC</span>
    </header>

    {!usable ? <div className="builder-data-plane-empty"><strong>RUN A SUCCESSFUL APPLICATION TRANSACTION FIRST</strong><p>Track E needs the exact routed link IDs from Track D. It does not invent a path just to demonstrate congestion.</p></div> : <>
      <div className="builder-data-plane-path"><span>CANONICAL PATH · {family.toUpperCase()}</span><code>{pathLinkIds.join(' → ')}</code></div>
      <div className="builder-data-plane-grid">
        <article className="builder-data-plane-card">
          <div className="builder-data-plane-card-heading"><span>TRAFFIC GENERATOR</span><strong>QUEUE + BANDWIDTH TRUTH</strong></div>
          <div className="builder-data-plane-patterns">{PATTERNS.map((entry) => <button key={entry.id} type="button" disabled={historical} className={pattern === entry.id ? 'active' : ''} onClick={() => setPattern(entry.id)}><b>{entry.label}</b><small>{entry.detail}</small></button>)}</div>
          <button type="button" className="builder-data-plane-run" disabled={historical} onClick={runTraffic}>RUN DATA PLANE</button>
          {traffic && <>
            <div className="builder-data-plane-result"><span>RESULT</span><strong>{traffic.summary}</strong><small>Round-robin packet admission/scheduling · per-link queue capacity · 75% ECN threshold · tail drop at queue ceiling · TCP/QUIC feedback changes subsequent sending pressure</small></div>
            <div className="builder-data-plane-link-list">{traffic.links.map((link) => <div key={link.linkId}><span>{link.linkId}</span><strong>{link.bandwidthMbps} Mb/s · {pct(link.utilization)}</strong><small>peak {link.peakQueuePackets}/{link.queueCapacityPackets} pkts · {ms(link.peakQueueDelayMs)} queue · {link.ecnMarks} CE · {link.tailDrops} drop</small></div>)}</div>
            <div className="builder-data-plane-flow-list">{traffic.flows.map((flow) => <div key={flow.id} data-recovery={flow.recovery}><span>{flow.id} · {flow.transport.toUpperCase()}</span><strong>{flow.deliveredRateMbps.toFixed(2)} Mb/s delivered</strong><small>configured {flow.offeredRateMbps.toFixed(2)} · final sender {flow.finalSendingRateMbps.toFixed(2)} Mb/s · {flow.backoffEvents} backoff · RTT {ms(flow.estimatedRttMs)} · {flow.ecnMarks} CE · {flow.droppedPackets} drops · {flow.recovery}</small></div>)}</div>
            <div className="builder-data-plane-events">{traffic.events.slice(0, 24).map((event) => <span key={event.id}><b>{event.atMs} ms · {event.kind.replaceAll('_', ' ')}</b>{event.summary}</span>)}</div>
          </>}
        </article>

        <article className="builder-data-plane-card">
          <div className="builder-data-plane-card-heading"><span>PATH MTU · {family.toUpperCase()}</span><strong>FRAGMENTATION + PMTUD</strong></div>
          <div className="builder-data-plane-pmtu-controls">
            <label>PACKET BYTES<input disabled={historical} type="number" min={family === 'ipv6' ? 1280 : 68} max={family === 'ipv6' ? 9216 : 65535} value={packetBytes} onChange={(event) => setPacketBytes(Number(event.currentTarget.value))} /></label>
            {family === 'ipv4' && <label className="check"><input disabled={historical} type="checkbox" checked={df} onChange={(event) => setDf(event.currentTarget.checked)} />DF</label>}
            <label className="check"><input disabled={historical} type="checkbox" checked={blackHole} onChange={(event) => setBlackHole(event.currentTarget.checked)} />DROP ICMP/PTB</label>
            {family === 'ipv4' && <button type="button" disabled={historical || ipv4PmtuCache.length === 0} onClick={() => { setIpv4PmtuCache([]); setPmtu(null); }}>CLEAR IPV4 PMTU CACHE</button>}
          </div>
          <button type="button" className="builder-data-plane-run" disabled={historical} onClick={runPmtu}>EVALUATE PMTU</button>
          {pmtu && <div className={`builder-data-plane-pmtu-result ${pmtu.outcome === 'BLACK_HOLE' ? 'failed' : ''}`}><span>{pmtu.outcome.replaceAll('_', ' ')}</span><strong>{pmtu.summary}</strong><small>requested {pmtu.packetBytes} B · emitted {pmtu.effectivePacketBytes} B · limiting link {pmtu.limitingLinkId} · path MTU {pmtu.pathMtuBytes} B · transport {pmtu.transportEffect}</small>{pmtu.fragments.length > 0 && <code>{pmtu.fragments.map((fragment) => `${fragment.offsetBytes}:${fragment.packetBytes}${fragment.moreFragments ? '+' : ''}`).join(' · ')}</code>}{pmtu.cacheEntry && <p>PMTU CACHE · {pmtu.cacheEntry.destinationKey} → {pmtu.cacheEntry.mtuBytes} B · {pmtu.cacheEntry.learnedFrom}</p>}</div>}
          <div className="builder-data-plane-note"><strong>TRUTH BOUNDARY</strong><p>PMTU follows this transaction's address family. IPv4 may fragment only with DF clear and keeps a bounded session cache. IPv6 routers never fragment and reuse Builder's canonical IPv6 PMTU cache. A blocked Frag Needed / Packet Too Big signal is an explicit black hole.</p></div>
        </article>
      </div>
    </>}
  </section>;
}
