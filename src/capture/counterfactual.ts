import { deepFreeze } from './bytes.ts';
import { buildCaptureRttSummary } from './analysis.ts';
import type { CaptureSessionIndex } from './session.ts';
import { buildJourneyScenario, type JourneyScenarioConfig } from '../journey/model.ts';

export type CaptureCounterfactualPreset = 'tcp-clean' | 'tcp-single-loss' | 'tcp-latency' | 'quic-clean';

export interface SimulatedCounterfactualSummary {
  readonly id: string;
  readonly label: string;
  readonly transport: 'TCP' | 'QUIC_UDP';
  readonly application: 'HTTP2_TLS' | 'HTTP3_QUIC';
  readonly durationMs: number;
  readonly eventCount: number;
  readonly simulatedRttMs: number | null;
  readonly terminalOutcome: 'complete' | 'failed';
  readonly provenance: 'SIMULATED';
  readonly boundary: string;
}

export interface CaptureSimulationComparisonFact {
  readonly id: string;
  readonly label: string;
  readonly captured: string;
  readonly simulated: string;
  readonly status: 'MATCH' | 'DIFFERENT' | 'UNKNOWN' | 'NOT_COMPARABLE';
  readonly capturedProvenance: 'CAPTURED' | 'INFERRED';
  readonly simulatedProvenance: 'SIMULATED';
  readonly explanation: string;
}

export interface CaptureSimulationComparison {
  readonly conversationId: string;
  readonly counterfactualId: string;
  readonly facts: readonly CaptureSimulationComparisonFact[];
  readonly provenance: 'INFERRED';
  readonly boundary: string;
}

function presetConfig(preset: CaptureCounterfactualPreset): JourneyScenarioConfig {
  if (preset === 'quic-clean') return { transportProfile: 'quic-h3', dnsProfile: 'cache-miss', impairmentProfile: 'clean' };
  if (preset === 'tcp-single-loss') return { transportProfile: 'tcp-h2', dnsProfile: 'cache-miss', impairmentProfile: 'single-loss' };
  if (preset === 'tcp-latency') return { transportProfile: 'tcp-h2', dnsProfile: 'cache-miss', impairmentProfile: 'latency-spike' };
  return { transportProfile: 'tcp-h2', dnsProfile: 'cache-miss', impairmentProfile: 'clean' };
}

export function buildJourneyCounterfactual(preset: CaptureCounterfactualPreset, hostname = 'example.test'): SimulatedCounterfactualSummary {
  const scenario = buildJourneyScenario(hostname, presetConfig(preset));
  const rttValues = scenario.events.flatMap((event) => {
    const metrics = event.transportMetrics;
    if (!metrics) return [];
    const value = metrics.smoothedRttMs ?? metrics.adjustedRttMs ?? metrics.latestRttMs ?? metrics.baselineRttMs;
    return typeof value === 'number' && Number.isFinite(value) ? [value] : [];
  });
  const simulatedRttMs = rttValues.length > 0 ? rttValues[rttValues.length - 1] ?? null : null;
  const failed = scenario.events.some((event) => event.kind === 'journey.failed');
  return deepFreeze({
    id: `journey-counterfactual:${preset}:${scenario.id}`,
    label: preset.replaceAll('-', ' ').toUpperCase(),
    transport: scenario.transportProfile === 'tcp-h2' ? 'TCP' : 'QUIC_UDP',
    application: scenario.transportProfile === 'tcp-h2' ? 'HTTP2_TLS' : 'HTTP3_QUIC',
    durationMs: scenario.durationMs,
    eventCount: scenario.events.length,
    simulatedRttMs,
    terminalOutcome: failed ? 'failed' : 'complete',
    provenance: 'SIMULATED',
    boundary: 'This is the canonical deterministic Journey teaching model. It is a counterfactual for comparison, not a reconstruction of the capture and not evidence about the captured network.',
  });
}

export function compareCaptureConversationToSimulation(
  session: CaptureSessionIndex,
  conversationId: string,
  counterfactual: SimulatedCounterfactualSummary,
): CaptureSimulationComparison | null {
  const conversation = session.conversation(conversationId);
  if (!conversation) return null;
  const capturedTransport = conversation.protocol === 'TCP' ? 'TCP' : conversation.protocol === 'UDP' ? 'UDP' : conversation.protocol;
  let transportStatus: CaptureSimulationComparisonFact['status'] = 'DIFFERENT';
  let transportExplanation = 'The capture-visible transport family differs from the simulated counterfactual.';
  if (counterfactual.transport === 'TCP' && capturedTransport === 'TCP') {
    transportStatus = 'MATCH';
    transportExplanation = 'Both sides use TCP at the transport layer; this does not imply the captured application matches the simulation.';
  } else if (counterfactual.transport === 'QUIC_UDP' && capturedTransport === 'UDP') {
    transportStatus = 'UNKNOWN';
    transportExplanation = 'QUIC uses UDP, but HOPSCOTCH does not identify QUIC from port numbers or encrypted UDP payload alone. UDP compatibility is not proof of QUIC.';
  }
  const captureDurationMs = Number(conversation.durationNanoseconds) / 1_000_000;
  const rtt = conversation.protocol === 'TCP' ? buildCaptureRttSummary(session, conversationId) : null;
  const facts: CaptureSimulationComparisonFact[] = [
    deepFreeze({
      id: 'transport', label: 'TRANSPORT', captured: capturedTransport, simulated: counterfactual.transport === 'QUIC_UDP' ? 'QUIC OVER UDP' : 'TCP', status: transportStatus,
      capturedProvenance: 'CAPTURED', simulatedProvenance: 'SIMULATED', explanation: transportExplanation,
    }),
    deepFreeze({
      id: 'duration', label: 'VISIBLE / SIMULATED SPAN', captured: `${captureDurationMs.toFixed(3)} ms`, simulated: `${counterfactual.durationMs.toFixed(0)} ms`, status: 'NOT_COMPARABLE',
      capturedProvenance: 'INFERRED', simulatedProvenance: 'SIMULATED', explanation: 'Capture span depends on capture placement and boundaries; Journey duration is a deterministic teaching timeline. The values are shown side by side, not treated as equivalent latency measurements.',
    }),
    deepFreeze({
      id: 'rtt', label: 'RTT / ACK DELAY', captured: rtt?.p50Ms === null || rtt?.p50Ms === undefined ? 'NOT OBSERVED' : `${rtt.p50Ms.toFixed(3)} ms p50`, simulated: counterfactual.simulatedRttMs === null ? 'NO SIMULATED RTT METRIC' : `${counterfactual.simulatedRttMs.toFixed(3)} ms`,
      status: rtt?.p50Ms !== null && rtt?.p50Ms !== undefined && counterfactual.simulatedRttMs !== null ? 'NOT_COMPARABLE' : 'UNKNOWN',
      capturedProvenance: 'INFERRED', simulatedProvenance: 'SIMULATED', explanation: 'Capture RTT is an ACK-backed one-vantage observation; the simulated value belongs only to the deterministic Journey model.',
    }),
    deepFreeze({
      id: 'application', label: 'APPLICATION', captured: conversation.applicationProtocol ?? 'NOT IDENTIFIED', simulated: counterfactual.application, status: conversation.applicationProtocol === 'TLS' && counterfactual.application === 'HTTP2_TLS' ? 'UNKNOWN' : 'NOT_COMPARABLE',
      capturedProvenance: conversation.applicationProtocol ? 'CAPTURED' : 'INFERRED', simulatedProvenance: 'SIMULATED', explanation: 'Visible TLS metadata does not reveal encrypted HTTP semantics. HOPSCOTCH never upgrades a TLS capture into captured HTTP without bytes that support it.',
    }),
  ];
  return deepFreeze({
    conversationId,
    counterfactualId: counterfactual.id,
    facts,
    provenance: 'INFERRED',
    boundary: 'Captured and simulated columns remain separate provenance domains. The comparison highlights compatibility or difference without rewriting captured evidence into a simulated story.',
  });
}
