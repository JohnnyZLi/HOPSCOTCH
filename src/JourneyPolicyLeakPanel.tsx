import type { JourneyState } from './journey/model';

function pathLabel(asns: readonly number[]): string {
  return asns.map((asn) => `AS${asn}`).join(' → ');
}

export function JourneyPolicyLeakPanel({ state }: { state: JourneyState }) {
  const metrics = state.policyMetrics;
  if (!metrics) return <div className="journey-scene policy-leak-scene"><p>Interdomain policy state unavailable.</p></div>;
  const leakedSelected = !metrics.selectedPathPolicyCompliant;
  const exportBad = !metrics.exportPolicyCompliant;
  return <div className="journey-scene policy-leak-scene">
    <div className="policy-leak-paths">
      <div className={!leakedSelected ? 'active' : ''}><span>LEGITIMATE PATH</span><strong>{pathLabel(metrics.legitimatePathAsns)}</strong><small>{metrics.legitimateTraversal.join(' → ').toUpperCase()} · LOCAL_PREF {metrics.legitimateLocalPreference}</small></div>
      <div className={leakedSelected ? 'active leaked' : 'leaked'}><span>LEAKED PATH</span><strong>{pathLabel(metrics.leakedPathAsns)}</strong><small>{metrics.leakedTraversal.join(' → ').toUpperCase()} · LOCAL_PREF {metrics.leakedLocalPreference}</small></div>
    </div>
    <div className={`policy-leak-export ${exportBad ? 'bad' : 'restored'}`}><span>{exportBad ? 'BAD EXPORT' : 'EXPORT POLICY'}</span><strong>{exportBad ? 'AS64500 · PEER-LEARNED → PROVIDER AS64504' : 'LEAK WITHDRAWN · NORMAL EXPORT POLICY'}</strong></div>
    <div className="policy-leak-metrics">
      <div><span>ACTIVE LOCAL_PREF</span><strong>{metrics.activeLocalPreference}</strong></div>
      <div><span>REACHABLE</span><strong className="reachable">{metrics.reachable ? 'YES' : 'NO'}</strong></div>
      <div><span>POLICY COMPLIANT</span><strong className={metrics.selectedPathPolicyCompliant && metrics.exportPolicyCompliant ? 'reachable' : 'violated'}>{metrics.selectedPathPolicyCompliant && metrics.exportPolicyCompliant ? 'YES' : 'NO'}</strong></div>
      <div><span>POLICY STATE</span><strong>{state.policy.toUpperCase().replace('-', ' ')}</strong></div>
    </div>
    <p>{state.policy === 'anomaly' ? 'The route still forwards traffic. The failure is policy correctness, not reachability.' : state.policy === 'restored' ? 'The leaked advertisement is gone and the legitimate peer-learned path is selected again.' : 'A peer-learned route is being exported where the teaching valley-free policy says it should not be.'}</p>
  </div>;
}
