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

const BOUNDARIES: BuilderChallengeBoundary[] = ['ADDRESSING', 'DNS', 'L2', 'ROUTING', 'POLICY', 'TRANSPORT'];

function evidenceLabel(entry: BuilderChallengeEvidence): string {
  if (entry.kind === 'ping') return 'PING';
  if (entry.kind === 'traceroute') return 'TRACEROUTE';
  if (entry.kind === 'ethernet-flow') return 'LAN FLOW';
  if (entry.kind === 'arp-resolution') return 'ARP';
  if (entry.kind === 'nat-flow') return 'NAT FLOW';
  if (entry.kind === 'dhcp-transaction') return 'DHCP DORA';
  if (entry.kind === 'ipv6-nd') return 'IPV6 ND';
  if (entry.kind === 'application-transaction') return 'APP REQUEST';
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
  const [secondaryBoundary,setSecondaryBoundary]=useState<BuilderChallengeBoundary|''>('');
  const [secondaryDeviceId,setSecondaryDeviceId]=useState('');

  useEffect(() => {
    setBoundary('');
    setDeviceId('');
    setSecondaryBoundary(''); setSecondaryDeviceId('');
  }, [challenge.id]);

  const token = builderChallengeToken(challenge);
  const routedDevices=challenge.broken.graph.nodes.map((node)=>({id:node.id,label:node.label,kind:node.kind}));
  const ethernetDevices=challenge.broken.ethernet.devices.map((device)=>({id:device.id,label:device.label,kind:device.kind}));
  const devices=challenge.fault.plane==='routed'?routedDevices:ethernetDevices;
  const secondaryDevices=challenge.secondaryFault?(challenge.secondaryFault.plane==='routed'?routedDevices:ethernetDevices):[];
  const hypothesisDeviceLabel=devices.find((device)=>device.id===hypothesis?.deviceId)?.label??hypothesis?.deviceId;
  const secondaryHypothesisDeviceLabel=secondaryDevices.find((device)=>device.id===hypothesis?.secondaryDeviceId)?.label??hypothesis?.secondaryDeviceId;
  const faultDeviceLabel=devices.find((device)=>device.id===challenge.fault.nodeId)?.label??challenge.fault.nodeId;
  const secondaryFaultDeviceLabel=challenge.secondaryFault?secondaryDevices.find((device)=>device.id===challenge.secondaryFault?.nodeId)?.label??challenge.secondaryFault.nodeId:null;
  const verificationKind = challenge.verification.kind;
  const composed=Boolean(challenge.secondaryFault);

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
      <div><span>REPAIR</span><strong>{score.repaired?'CANONICAL FIX':composed?'FAULTS ACTIVE':'FAULT ACTIVE'}</strong></div>
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
      <p>{composed?'Two canonical faults are active. Establish the initial failure, inspect both suspected locations, and rerun the objective after one repair to prove another fault remains. Lock an ordered two-step causal hypothesis, repair both with normal Builder controls, then verify the same objective after the network is fully restored.':challenge.family === 'bgp-import-policy'
        ? 'Run the ordinary Builder Ping / Traceroute tools, inspect the BGP RIB and IMPORT / EXPORT POLICY panel, and inspect CONFIG / STATE / EVENTS on the suspected router in Device Workbench. Remove the blocking canonical BGP policy with the normal BGP control, then prove the repair with the same objective probe.'
        : verificationKind === 'routed-probe'
        ? 'Run the ordinary Builder Ping / Traceroute tools and inspect CONFIG / STATE / EVENTS in Device Workbench. Repair the network with the normal Builder configuration controls, then prove the repair with another objective probe.'
        : verificationKind === 'ethernet-flow'
          ? 'Run the ordinary LAN SEND FRAME / PACKET flow, inspect its ARP result, and use CONFIG / STATE / EVENTS in Device Workbench. Repair the normal VLAN / trunk / STP controls, then rerun the exact LAN objective to prove the fix.'
          : verificationKind === 'nat-translation'
            ? 'Run the ordinary NAT RUN OUTBOUND tool and inspect CONFIG / STATE / EVENTS in Device Workbench. A delivered but untranslated tuple is still a failed objective. Repair the canonical NAT boundary, then rerun the same outbound flow to prove PAT translation.'
            : verificationKind === 'ipv6-pmtu'
              ? 'Run the ordinary IPv6 Ping / Traceroute at the challenge packet size. Use NS/NA plus Packet Too Big / PMTU state to separate healthy neighbor resolution from the MTU failure, inspect CONFIG / STATE / EVENTS, repair the selected routed-link MTU, clear stale PMTU cache, then prove the same full-size packet is actually transmitted.'
              : verificationKind === 'application-transaction'
                ? 'Run the ordinary APPLICATION REQUEST for the selected challenge service and inspect APP CONFIG / STATE in Device Workbench. The causal stack identifies whether DNS or transport failed first. Repair the canonical hostname/listener in the normal hosted-service controls, then rerun the exact service objective.'
                : 'Run the ordinary DHCP DORA / ACQUIRE flow and inspect CONFIG / STATE / EVENTS in Device Workbench. An ACK with incomplete options is failed objective evidence. Repair the pool default-gateway option, then reacquire a configuration-ready lease.'}</p>
    </div>

    <div className="builder-challenge-hypothesis">
      <span>{composed?'ORDERED CAUSAL HYPOTHESIS':'CAUSAL HYPOTHESIS'}</span>
      {hypothesis
        ? <><strong>FIRST · {hypothesis.boundary} · {hypothesisDeviceLabel}</strong>{composed&&<strong>SECOND · {hypothesis.secondaryBoundary??'—'} · {secondaryHypothesisDeviceLabel??'—'}</strong>}</>
        : <>
          <label>FIRST BROKEN BOUNDARY<select value={boundary} disabled={historical} onChange={(event)=>setBoundary(event.currentTarget.value as BuilderChallengeBoundary|'')}><option value="">CHOOSE…</option>{BOUNDARIES.map((value)=><option key={value} value={value}>{value}</option>)}</select></label>
          <label>PRIMARY FAULT LOCATION<select value={deviceId} disabled={historical} onChange={(event)=>setDeviceId(event.currentTarget.value)}><option value="">CHOOSE…</option>{devices.map((device)=><option key={device.id} value={device.id}>{device.label} · {device.kind.toUpperCase()}</option>)}</select></label>
          {composed&&<><label>SECOND BROKEN BOUNDARY<select value={secondaryBoundary} disabled={historical} onChange={(event)=>setSecondaryBoundary(event.currentTarget.value as BuilderChallengeBoundary|'')}><option value="">CHOOSE…</option>{BOUNDARIES.map((value)=><option key={value} value={value}>{value}</option>)}</select></label><label>SECOND FAULT LOCATION<select value={secondaryDeviceId} disabled={historical} onChange={(event)=>setSecondaryDeviceId(event.currentTarget.value)}><option value="">CHOOSE…</option>{secondaryDevices.map((device)=><option key={device.id} value={device.id}>{device.label} · {device.kind.toUpperCase()}</option>)}</select></label></>}
          <button type="button" disabled={historical||!boundary||!deviceId||(composed&&(!secondaryBoundary||!secondaryDeviceId))} onClick={()=>{if(!boundary||!deviceId)return;onLockHypothesis({boundary,deviceId,...(composed&&secondaryBoundary&&secondaryDeviceId?{secondaryBoundary,secondaryDeviceId}:{})});}}>LOCK HYPOTHESIS</button>
        </>}
      <small>{composed?'Composed reasoning requires an initial failure, inspection of both fault locations, and another failed objective after exactly one canonical fault has been repaired.':'Reasoning points require both failed objective evidence and inspection of the primary fault location before the hypothesis can score.'}</small>
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
      <strong>{challenge.fault.boundary} · {faultDeviceLabel}{challenge.secondaryFault?` → ${challenge.secondaryFault.boundary} · ${secondaryFaultDeviceLabel}`:''}</strong>
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
