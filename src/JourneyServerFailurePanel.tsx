import type { JourneyState } from './journey/model.ts';

export function JourneyServerFailurePanel({ state }: { state: JourneyState }) {
  const metrics = state.serverMetrics;
  if (!metrics) return null;

  const serviceReady = state.server === 'ready' || state.server === 'healthy';
  const waiting = state.server === 'waiting';
  const serviceLabel = serviceReady ? 'SERVICE READY' : waiting ? 'RETRY WAIT' : 'SERVICE UNAVAILABLE';

  return <div className="server-failure-panel-wrap">
    <div className={`server-failure-status ${serviceReady ? 'ready' : waiting ? 'waiting' : 'failed'}`}>
      <span>APPLICATION SERVICE</span>
      <strong>{serviceLabel}</strong>
      <small>{serviceReady ? 'SUCCESSFUL RETRY CAN PROCEED' : waiting ? 'CLIENT HONORS RETRY-AFTER' : 'NETWORK PATH STILL REACHABLE'}</small>
    </div>
    <div className="server-failure-metrics">
      <div><span>HTTP STATUS</span><strong>{serviceReady ? 'READY' : metrics.statusCode ?? '—'}</strong></div>
      <div><span>RETRY-AFTER</span><strong>{metrics.retryAfterMs / 1000} s</strong></div>
      <div><span>METHOD</span><strong>{metrics.requestMethod}</strong></div>
      <div><span>RETRY SAFETY</span><strong>{metrics.idempotent && metrics.retrySafe ? 'IDEMPOTENT' : 'DO NOT ASSUME'}</strong></div>
      <div><span>TRANSPORT</span><strong>{metrics.transportReused ? 'REUSED' : 'NEW'}</strong></div>
      <div><span>TLS</span><strong>{state.tls === 'application-keys' ? 'KEYS ACTIVE' : state.tls.toUpperCase()}</strong></div>
    </div>
    <div className="server-failure-truth"><strong>HTTP-LAYER FAILURE · PATH + CONNECTION STAY HEALTHY</strong><small>This curated retry is safe for the canonical GET. HOPSCOTCH does not generalize that to arbitrary requests.</small></div>
  </div>;
}
