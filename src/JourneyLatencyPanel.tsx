import type { JourneyState } from './journey/model.ts';

function metric(value: number | undefined, suffix = ' ms'): string {
  return value === undefined ? 'PENDING' : `${value}${suffix}`;
}

export function JourneyLatencyPanel({ state }: { state: JourneyState }) {
  const metrics = state.transportMetrics;
  const quic = state.transportProfile === 'quic-h3';
  const estimating = state.activeEvent.kind === 'transport.rtt-update';

  return <div className="latency-panel-wrap">
    <div className="latency-estimator">
      <div><span>RTT SAMPLE</span><strong>{metrics?.baselineRttMs ?? 32} → {metric(metrics?.latestRttMs)}</strong></div>
      {quic && <div><span>ADJUSTED RTT</span><strong>{metric(metrics?.adjustedRttMs)}</strong></div>}
      <div><span>{quic ? 'SMOOTHED RTT' : 'SRTT'}</span><strong>{metric(metrics?.smoothedRttMs)}</strong></div>
      <div><span>RTTVAR</span><strong>{metric(metrics?.rttVarMs)}</strong></div>
      <div><span>{metrics?.timerLabel ?? (quic ? 'PTO' : 'RTO')}</span><strong>{metric(metrics?.timerMs)}</strong></div>
    </div>
    <div className="latency-truth"><span>{estimating ? 'ESTIMATOR UPDATED' : 'FEEDBACK DELAYED'}</span><strong>NO LOSS DETECTED</strong><small>{quic ? 'No packet-number gap · no STREAM retransmission' : 'No sequence gap · no duplicate-ACK fast retransmit'}</small></div>
  </div>;
}
