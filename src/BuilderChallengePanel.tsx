import { useEffect, useState } from 'react';
import {
  builderChallengeSolvedExplanation,
  builderChallengeToken,
  type BuilderChallenge,
  type BuilderChallengeBoundary,
  type BuilderChallengeEvidence,
  type BuilderChallengeHypothesis,
  type BuilderChallengeScore,
} from './builder/challenges.ts';
import './BuilderChallengePanel.css';

const BOUNDARIES: BuilderChallengeBoundary[] = ['ADDRESSING', 'L2', 'ROUTING', 'POLICY', 'TRANSPORT'];

function evidenceLabel(entry: BuilderChallengeEvidence): string {
  if (entry.kind === 'ping') return 'PING';
  if (entry.kind === 'traceroute') return 'TRACEROUTE';
  if (entry.kind === 'ethernet-flow') return 'LAN FLOW';
  if (entry.kind === 'arp-resolution') return 'ARP';
  if (entry.kind === 'nat-flow') return 'NAT FLOW';
  if (entry.kind === 'dhcp-transaction') return 'DHCP DORA';
  if (entry.kind === 'inspect-config') return 'INSPECT CONFIG';
  if (entry.kind === 'inspect-state') return 'INSPECT STATE';
  return 'INSPECT EVENTS';
}

export default function BuilderChallengePanel({
  challenge,
  evidence,
  score,
  hypothesis,
  historical,
  onLockHypothesis,
  onRestart,
  onExit,
  onMessage,
}: {
  challenge: BuilderChallenge;
  evidence: readonly BuilderChallengeEvidence[];
  score: BuilderChallengeScore;
  hypothesis: BuilderChallengeHypothesis | null;
  historical: boolean;
  onLockHypothesis: (hypothesis: BuilderChallengeHypothesis) => void;
  onRestart: () => void;
  onExit: () => void;
  onMessage: (message: string) => void;
}) {
  const [boundary, setBoundary] = useState<BuilderChallengeBoundary | ''>('');
  const [deviceId, setDeviceId] = useState('');

  useEffect(() => {
    setBoundary('');
    setDeviceId('');
  }, [challenge.id]);

  const token = builderChallengeToken(challenge);
  const devices = challenge.fault.plane === 'routed'
    ? challenge.broken.graph.nodes.map((node) => ({ id: node.id, label: node.label, kind: node.kind }))
    : challenge.broken.ethernet.devices.map((device) => ({ id: device.id, label: device.label, kind: device.kind }));
  const hypothesisDeviceLabel = devices.find((device) => device.id === hypothesis?.deviceId)?.label ?? hypothesis?.deviceId;
  const faultDeviceLabel = devices.find((device) => device.id === challenge.fault.nodeId)?.label ?? challenge.fault.nodeId;
  const verificationKind = challenge.verification.kind;

  const copyToken = async () => {
    try {
      await navigator.clipboard.writeText(token);
      onMessage(`CHALLENGE TOKEN COPIED · ${token}`);
    } catch {
      onMessage(`CHALLENGE TOKEN · ${token}`);
    }
  };

  return <section className={`builder-challenge-panel ${score.solved ? 'is-solved' : ''}`} data-challenge-id={challenge.id} data-challenge-family={challenge.family} data-challenge-score={score.total}>
    <div className="control-title"><span>TROUBLESHOOTING CHALLENGE</span><strong>TRACK J · {challenge.difficulty}</strong></div>
    <div className="builder-challenge-heading">
      <span>SEED · {challenge.seed}</span>
      <strong>{challenge.title}</strong>
      <p>{challenge.objective}</p>
    </div>

    <div className="builder-challenge-status">
      <div><span>SCORE</span><strong>{score.total}<small>/100</small></strong></div>
      <div><span>REPAIR</span><strong>{score.repaired ? 'CANONICAL FIX' : 'FAULT ACTIVE'}</strong></div>
      <div><span>VERIFY</span><strong>{score.verified ? 'PROVEN' : 'NOT PROVEN'}</strong></div>
    </div>
    <div className="builder-challenge-scoreline">
      <span>EVIDENCE <b>{score.evidence}/40</b></span>
      <span>REASONING <b>{score.reasoning}/20</b></span>
      <span>REPAIR <b>{score.repair}/25</b></span>
      <span>VERIFY <b>{score.verification}/15</b></span>
    </div>

    <div className="builder-challenge-instructions">
      <strong>USE THE NETWORK, NOT A HINT SYSTEM.</strong>
      <p>{verificationKind === 'routed-probe'
        ? 'Run the ordinary Builder Ping / Traceroute tools and inspect CONFIG / STATE / EVENTS in Device Workbench. Repair the network with the normal Builder configuration controls, then prove the repair with another objective probe.'
        : verificationKind === 'ethernet-flow'
          ? 'Run the ordinary LAN SEND FRAME / PACKET flow, inspect its ARP result, and use CONFIG / STATE / EVENTS in Device Workbench. Repair the normal VLAN / trunk / STP controls, then rerun the exact LAN objective to prove the fix.'
          : verificationKind === 'nat-translation'
            ? 'Run the ordinary NAT RUN OUTBOUND tool and inspect CONFIG / STATE / EVENTS in Device Workbench. A delivered but untranslated tuple is still a failed objective. Repair the canonical NAT boundary, then rerun the same outbound flow to prove PAT translation.'
            : 'Run the ordinary DHCP DORA / ACQUIRE flow and inspect CONFIG / STATE / EVENTS in Device Workbench. An ACK with incomplete options is failed objective evidence. Repair the pool default-gateway option, then reacquire a configuration-ready lease.'}</p>
    </div>

    <div className="builder-challenge-hypothesis">
      <span>CAUSAL HYPOTHESIS</span>
      {hypothesis
        ? <strong>{hypothesis.boundary} · {hypothesisDeviceLabel}</strong>
        : <>
          <label>FIRST BROKEN BOUNDARY<select value={boundary} disabled={historical} onChange={(event) => setBoundary(event.currentTarget.value as BuilderChallengeBoundary | '')}><option value="">CHOOSE…</option>{BOUNDARIES.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <label>PRIMARY FAULT LOCATION<select value={deviceId} disabled={historical} onChange={(event) => setDeviceId(event.currentTarget.value)}><option value="">CHOOSE…</option>{devices.map((device) => <option key={device.id} value={device.id}>{device.label} · {device.kind.toUpperCase()}</option>)}</select></label>
          <button type="button" disabled={historical || !boundary || !deviceId} onClick={() => { if (boundary && deviceId) onLockHypothesis({ boundary, deviceId }); }}>LOCK HYPOTHESIS</button>
        </>}
      <small>Reasoning points require both failed objective evidence and inspection of the primary fault location before the hypothesis can score.</small>
    </div>

    <div className="builder-challenge-evidence">
      <div><span>EVIDENCE TRANSCRIPT</span><strong>{evidence.length} ACTION{evidence.length === 1 ? '' : 'S'}</strong></div>
      {evidence.length === 0
        ? <small>NO EVIDENCE YET · START WITH THE NORMAL BUILDER TOOLS.</small>
        : evidence.slice(-10).map((entry) => <article key={entry.id}>
          <span>#{String(entry.sequence).padStart(2, '0')} · {evidenceLabel(entry)}</span>
          <strong>{entry.success == null ? (entry.deviceId?.toUpperCase() ?? 'OBSERVED') : entry.success ? 'PASS' : 'FAIL'}</strong>
          <p>{entry.detail}</p>
        </article>)}
    </div>

    {score.solved && <div className="builder-challenge-solved">
      <span>CAUSAL CHAIN CLOSED</span>
      <strong>{challenge.fault.boundary} · {faultDeviceLabel}</strong>
      <p>{builderChallengeSolvedExplanation(challenge)}</p>
    </div>}

    <div className="builder-challenge-actions">
      <button type="button" disabled={historical} onClick={onRestart}>RESTART SAME SEED</button>
      <button type="button" onClick={() => void copyToken()}>COPY CHALLENGE TOKEN</button>
      <button type="button" disabled={historical} onClick={onExit}>EXIT CHALLENGE</button>
    </div>
    <small className="builder-routing-note">TOKEN {token} · CHALLENGE STATE IS DETERMINISTIC. EVIDENCE / SCORE ARE SESSION-ONLY AND NEVER BECOME NETWORK TRUTH.</small>
  </section>;
}
