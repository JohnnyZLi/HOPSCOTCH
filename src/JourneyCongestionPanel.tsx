import type { JourneyState } from './journey/model.ts';

export function JourneyCongestionPanel({ state }: { state: JourneyState }) {
  const metrics = state.congestionMetrics;
  if (!metrics) return null;

  const queuePercent = Math.min(100, Math.max(0, metrics.queueOccupancyPackets / metrics.queueCapacityPackets * 100));
  const overloaded = metrics.offeredRateMbps > metrics.bottleneckRateMbps;

  return <div className="congestion-panel-wrap">
    <div className="congestion-queue">
      <div className="congestion-queue-heading"><span>BOTTLENECK QUEUE</span><strong>{metrics.queueOccupancyPackets} / {metrics.queueCapacityPackets} PKTS</strong></div>
      <div className="congestion-queue-track"><i style={{ width: `${queuePercent}%` }}/></div>
      <div className="congestion-queue-caption"><span>{metrics.queueDelayMs} ms QUEUE DELAY</span><strong className={overloaded ? 'overloaded' : 'draining'}>{metrics.offeredRateMbps} → {metrics.bottleneckRateMbps} Mb/s</strong></div>
    </div>
    <div className="congestion-metrics">
      <div><span>ECN CE</span><strong>{metrics.ecnCeMarks}</strong></div>
      <div><span>SIGNAL</span><strong>{metrics.signal}</strong></div>
      <div><span>CWND</span><strong>{metrics.congestionWindowPackets} PKTS</strong></div>
      <div><span>SSTHRESH</span><strong>{metrics.slowStartThresholdPackets ?? '—'} PKTS</strong></div>
      <div><span>DROPPED</span><strong>{metrics.droppedPackets}</strong></div>
      <div><span>RTT</span><strong>{state.transportMetrics?.latestRttMs ?? '—'} ms</strong></div>
    </div>
    <div className="congestion-truth"><strong>ECN CONGESTION SIGNAL · NO RETRANSMISSION</strong><small>Queue state and congestion control are explicit; a CE mark is not a packet drop.</small></div>
  </div>;
}
