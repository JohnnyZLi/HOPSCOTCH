export type TcpDirection = 'client-to-server' | 'server-to-client' | 'local';

export type TcpEventKind =
  | 'handshake.syn'
  | 'handshake.synack'
  | 'handshake.ack'
  | 'data.segment'
  | 'data.loss'
  | 'ack.duplicate'
  | 'congestion.fast-recovery'
  | 'data.retransmit'
  | 'ack.cumulative'
  | 'congestion.recover'
  | 'teardown.fin'
  | 'teardown.finack'
  | 'teardown.ack';

export type TcpSeverity = 'info' | 'warning' | 'critical' | 'success';

export type TcpEvent = {
  id: string;
  atMs: number;
  kind: TcpEventKind;
  direction: TcpDirection;
  title: string;
  summary: string;
  detail: string;
  severity: TcpSeverity;
  flags?: string;
  seq?: number;
  ack?: number;
  length?: number;
  segmentIndex?: number;
  cwndMss: number;
  ssthreshMss: number;
  duplicateAcks: number;
  phase: TcpPhase;
};

export type TcpPhase =
  | 'closed'
  | 'handshake'
  | 'established'
  | 'loss'
  | 'duplicate-acks'
  | 'fast-recovery'
  | 'recovered'
  | 'closing'
  | 'closed-cleanly';

export type TcpState = {
  timeMs: number;
  phase: TcpPhase;
  connectionLabel: string;
  cwndMss: number;
  ssthreshMss: number;
  duplicateAcks: number;
  highestAck: number;
  expectedAck: number;
  latestEventId: string;
};

export type TcpScenario = {
  id: string;
  title: string;
  durationMs: number;
  mss: number;
  clientInitialSeq: number;
  serverInitialSeq: number;
  events: readonly TcpEvent[];
};

const MSS = 1460;

export const tcpScenario: TcpScenario = {
  id: 'lab-03a-tcp-fast-retransmit',
  title: 'TCP fast retransmit and recovery',
  durationMs: 5000,
  mss: MSS,
  clientInitialSeq: 1000,
  serverInitialSeq: 7000,
  events: [
    {
      id: 'syn',
      atMs: 0,
      kind: 'handshake.syn',
      direction: 'client-to-server',
      title: 'Client opens the connection',
      summary: 'SYN consumes one sequence number and proposes CLIENT ISN 1000.',
      detail: 'The client sends SYN with SEQ 1000. A successful peer must acknowledge 1001 because SYN occupies one position in TCP sequence space.',
      severity: 'info',
      flags: 'SYN',
      seq: 1000,
      cwndMss: 6,
      ssthreshMss: 12,
      duplicateAcks: 0,
      phase: 'handshake',
    },
    {
      id: 'synack',
      atMs: 350,
      kind: 'handshake.synack',
      direction: 'server-to-client',
      title: 'Server answers with SYN / ACK',
      summary: 'SERVER ISN 7000 acknowledges the client SYN with ACK 1001.',
      detail: 'The server combines its own SYN with an acknowledgment of the client sequence space: SEQ 7000, ACK 1001.',
      severity: 'info',
      flags: 'SYN · ACK',
      seq: 7000,
      ack: 1001,
      cwndMss: 6,
      ssthreshMss: 12,
      duplicateAcks: 0,
      phase: 'handshake',
    },
    {
      id: 'handshake-complete',
      atMs: 700,
      kind: 'handshake.ack',
      direction: 'client-to-server',
      title: 'Connection established',
      summary: 'ACK 7001 completes the three-way handshake.',
      detail: 'The final ACK confirms both initial sequence numbers. Application data can now begin at client SEQ 1001.',
      severity: 'success',
      flags: 'ACK',
      seq: 1001,
      ack: 7001,
      cwndMss: 6,
      ssthreshMss: 12,
      duplicateAcks: 0,
      phase: 'established',
    },
    {
      id: 'data-1',
      atMs: 1050,
      kind: 'data.segment',
      direction: 'client-to-server',
      title: 'Segment 1 arrives in order',
      summary: 'SEQ 1001–2460 advances the receiver next-expected byte to 2461.',
      detail: 'One full 1460-byte MSS arrives. The receiver is now waiting for byte 2461.',
      severity: 'info',
      flags: 'PSH · ACK',
      seq: 1001,
      ack: 7001,
      length: MSS,
      segmentIndex: 1,
      cwndMss: 6,
      ssthreshMss: 12,
      duplicateAcks: 0,
      phase: 'established',
    },
    {
      id: 'data-2-loss',
      atMs: 1250,
      kind: 'data.loss',
      direction: 'client-to-server',
      title: 'Segment 2 is lost',
      summary: 'SEQ 2461–3920 disappears before the server receives it.',
      detail: 'This missing sequence range creates a hole. TCP can recover it without waiting for the retransmission timer if enough later data arrives to produce duplicate ACKs.',
      severity: 'critical',
      flags: 'PSH · ACK',
      seq: 2461,
      ack: 7001,
      length: MSS,
      segmentIndex: 2,
      cwndMss: 6,
      ssthreshMss: 12,
      duplicateAcks: 0,
      phase: 'loss',
    },
    {
      id: 'data-3',
      atMs: 1450,
      kind: 'data.segment',
      direction: 'client-to-server',
      title: 'Segment 3 arrives out of order',
      summary: 'SEQ 3921–5380 arrives, but byte 2461 is still missing.',
      detail: 'The receiver can buffer this later range, but its cumulative acknowledgment cannot move past the missing byte.',
      severity: 'warning',
      flags: 'PSH · ACK',
      seq: 3921,
      ack: 7001,
      length: MSS,
      segmentIndex: 3,
      cwndMss: 6,
      ssthreshMss: 12,
      duplicateAcks: 0,
      phase: 'loss',
    },
    {
      id: 'dup-ack-1',
      atMs: 1600,
      kind: 'ack.duplicate',
      direction: 'server-to-client',
      title: 'Duplicate ACK 1',
      summary: 'The server repeats ACK 2461: that is still the first missing byte.',
      detail: 'A duplicate cumulative ACK is evidence that later data arrived while the expected sequence did not.',
      severity: 'warning',
      flags: 'ACK',
      seq: 7001,
      ack: 2461,
      cwndMss: 6,
      ssthreshMss: 12,
      duplicateAcks: 1,
      phase: 'duplicate-acks',
    },
    {
      id: 'data-4',
      atMs: 1750,
      kind: 'data.segment',
      direction: 'client-to-server',
      title: 'Segment 4 extends the out-of-order queue',
      summary: 'SEQ 5381–6840 arrives while the 2461 hole remains.',
      detail: 'The receiver still cannot advance its cumulative ACK, so another duplicate ACK follows.',
      severity: 'warning',
      flags: 'PSH · ACK',
      seq: 5381,
      ack: 7001,
      length: MSS,
      segmentIndex: 4,
      cwndMss: 6,
      ssthreshMss: 12,
      duplicateAcks: 1,
      phase: 'duplicate-acks',
    },
    {
      id: 'dup-ack-2',
      atMs: 1875,
      kind: 'ack.duplicate',
      direction: 'server-to-client',
      title: 'Duplicate ACK 2',
      summary: 'ACK 2461 repeats again.',
      detail: 'Two duplicate ACKs strengthen the loss signal, but this curated Reno scenario waits for the third duplicate ACK before fast retransmit.',
      severity: 'warning',
      flags: 'ACK',
      seq: 7001,
      ack: 2461,
      cwndMss: 6,
      ssthreshMss: 12,
      duplicateAcks: 2,
      phase: 'duplicate-acks',
    },
    {
      id: 'data-5',
      atMs: 2000,
      kind: 'data.segment',
      direction: 'client-to-server',
      title: 'Segment 5 arrives behind the same hole',
      summary: 'SEQ 6841–8300 arrives out of order.',
      detail: 'The receiver now holds three contiguous later segments behind the missing SEQ 2461–3920 range.',
      severity: 'warning',
      flags: 'PSH · ACK',
      seq: 6841,
      ack: 7001,
      length: MSS,
      segmentIndex: 5,
      cwndMss: 6,
      ssthreshMss: 12,
      duplicateAcks: 2,
      phase: 'duplicate-acks',
    },
    {
      id: 'dup-ack-3',
      atMs: 2125,
      kind: 'ack.duplicate',
      direction: 'server-to-client',
      title: 'Duplicate ACK 3 triggers fast retransmit',
      summary: 'The third ACK 2461 crosses the curated Reno fast-retransmit threshold.',
      detail: 'The sender infers one segment was probably lost while the path still delivers later packets. It can retransmit without waiting for the retransmission timeout.',
      severity: 'critical',
      flags: 'ACK ×3',
      seq: 7001,
      ack: 2461,
      cwndMss: 6,
      ssthreshMss: 12,
      duplicateAcks: 3,
      phase: 'duplicate-acks',
    },
    {
      id: 'fast-recovery',
      atMs: 2200,
      kind: 'congestion.fast-recovery',
      direction: 'local',
      title: 'Reno enters fast recovery',
      summary: 'ssthresh falls to 3 MSS; cwnd is temporarily inflated to 6 MSS.',
      detail: 'For this curated Reno model, the 6-MSS flight is halved to a 3-MSS slow-start threshold. During fast recovery, cwnd is represented as ssthresh + 3 duplicate ACKs = 6 MSS.',
      severity: 'critical',
      cwndMss: 6,
      ssthreshMss: 3,
      duplicateAcks: 3,
      phase: 'fast-recovery',
    },
    {
      id: 'retransmit',
      atMs: 2275,
      kind: 'data.retransmit',
      direction: 'client-to-server',
      title: 'Fast retransmit repairs the hole',
      summary: 'SEQ 2461–3920 is sent again immediately.',
      detail: 'The retransmission carries the exact sequence range identified by the repeated ACK 2461 signal.',
      severity: 'success',
      flags: 'PSH · ACK · RTX',
      seq: 2461,
      ack: 7001,
      length: MSS,
      segmentIndex: 2,
      cwndMss: 6,
      ssthreshMss: 3,
      duplicateAcks: 3,
      phase: 'fast-recovery',
    },
    {
      id: 'cumulative-ack',
      atMs: 2600,
      kind: 'ack.cumulative',
      direction: 'server-to-client',
      title: 'One ACK releases the buffered ranges',
      summary: 'ACK 8301 cumulatively covers segments 2 through 5.',
      detail: 'Once the missing bytes arrive, the receiver already has SEQ 3921–8300 buffered. Its cumulative ACK can jump directly from 2461 to 8301.',
      severity: 'success',
      flags: 'ACK',
      seq: 7001,
      ack: 8301,
      cwndMss: 6,
      ssthreshMss: 3,
      duplicateAcks: 0,
      phase: 'fast-recovery',
    },
    {
      id: 'recovery-exit',
      atMs: 2700,
      kind: 'congestion.recover',
      direction: 'local',
      title: 'cwnd deflates to ssthresh',
      summary: 'Fast recovery ends at cwnd 3 MSS, ssthresh 3 MSS.',
      detail: 'The full cumulative ACK confirms recovery of the lost range. This curated Reno model exits fast recovery by deflating cwnd to the 3-MSS threshold.',
      severity: 'info',
      cwndMss: 3,
      ssthreshMss: 3,
      duplicateAcks: 0,
      phase: 'recovered',
    },
    {
      id: 'post-recovery-data',
      atMs: 3150,
      kind: 'data.segment',
      direction: 'client-to-server',
      title: 'Forward progress resumes',
      summary: 'SEQ 8301–9760 crosses the repaired connection.',
      detail: 'The sender continues from the cumulatively acknowledged sequence point instead of replaying data that the receiver already buffered.',
      severity: 'success',
      flags: 'PSH · ACK',
      seq: 8301,
      ack: 7001,
      length: MSS,
      segmentIndex: 6,
      cwndMss: 3,
      ssthreshMss: 3,
      duplicateAcks: 0,
      phase: 'recovered',
    },
    {
      id: 'post-recovery-ack',
      atMs: 3425,
      kind: 'ack.cumulative',
      direction: 'server-to-client',
      title: 'ACK 9761 grows the window again',
      summary: 'Successful delivery raises the illustrated congestion window to 4 MSS.',
      detail: 'The scenario now shows additive recovery rather than snapping immediately back to the pre-loss window.',
      severity: 'success',
      flags: 'ACK',
      seq: 7001,
      ack: 9761,
      cwndMss: 4,
      ssthreshMss: 3,
      duplicateAcks: 0,
      phase: 'recovered',
    },
    {
      id: 'client-fin',
      atMs: 4000,
      kind: 'teardown.fin',
      direction: 'client-to-server',
      title: 'Client begins teardown',
      summary: 'FIN at SEQ 9761 consumes one final sequence number.',
      detail: 'TCP teardown also uses sequence space. The peer will acknowledge 9762.',
      severity: 'info',
      flags: 'FIN · ACK',
      seq: 9761,
      ack: 7001,
      cwndMss: 4,
      ssthreshMss: 3,
      duplicateAcks: 0,
      phase: 'closing',
    },
    {
      id: 'server-finack',
      atMs: 4300,
      kind: 'teardown.finack',
      direction: 'server-to-client',
      title: 'Server acknowledges and closes its side',
      summary: 'ACK 9762 plus FIN at SERVER SEQ 7001.',
      detail: 'For the compact theater sequence, the server combines its acknowledgment with its own FIN.',
      severity: 'info',
      flags: 'FIN · ACK',
      seq: 7001,
      ack: 9762,
      cwndMss: 4,
      ssthreshMss: 3,
      duplicateAcks: 0,
      phase: 'closing',
    },
    {
      id: 'final-ack',
      atMs: 4600,
      kind: 'teardown.ack',
      direction: 'client-to-server',
      title: 'Final ACK closes the theater sequence',
      summary: 'ACK 7002 confirms the server FIN.',
      detail: 'The modeled exchange is complete. Real TCP endpoint state can persist afterward, such as TIME_WAIT, but this theater focuses on the wire exchange itself.',
      severity: 'success',
      flags: 'ACK',
      seq: 9762,
      ack: 7002,
      cwndMss: 4,
      ssthreshMss: 3,
      duplicateAcks: 0,
      phase: 'closed-cleanly',
    },
  ],
};

export function clampTcpTime(timeMs: number): number {
  return Math.max(0, Math.min(tcpScenario.durationMs, timeMs));
}

export function tcpEventsAtOrBefore(timeMs: number): readonly TcpEvent[] {
  const clamped = clampTcpTime(timeMs);
  return tcpScenario.events.filter((event) => event.atMs <= clamped);
}

export function tcpLatestEventAtOrBefore(timeMs: number): TcpEvent {
  const events = tcpEventsAtOrBefore(timeMs);
  return events[events.length - 1] ?? tcpScenario.events[0];
}

function phaseLabel(phase: TcpPhase): string {
  switch (phase) {
    case 'handshake': return 'NEGOTIATING CONNECTION';
    case 'established': return 'CONNECTION ESTABLISHED';
    case 'loss': return 'SEQUENCE HOLE DETECTED';
    case 'duplicate-acks': return 'DUPLICATE ACK SIGNAL';
    case 'fast-recovery': return 'FAST RECOVERY';
    case 'recovered': return 'FORWARD PROGRESS RESTORED';
    case 'closing': return 'CONNECTION CLOSING';
    case 'closed-cleanly': return 'WIRE EXCHANGE COMPLETE';
    default: return 'CLOSED';
  }
}

export function tcpStateAt(timeMs: number): TcpState {
  const time = clampTcpTime(timeMs);
  const latest = tcpLatestEventAtOrBefore(time);
  const ackEvents = tcpEventsAtOrBefore(time).filter((event) => event.ack !== undefined);
  const highestAck = ackEvents.reduce((highest, event) => Math.max(highest, event.ack ?? 0), 0);
  const expectedAck = latest.phase === 'loss' || latest.phase === 'duplicate-acks' || latest.phase === 'fast-recovery'
    ? 2461
    : highestAck >= 8301
      ? highestAck
      : latest.phase === 'established'
        ? 2461
        : 1001;

  return {
    timeMs: time,
    phase: latest.phase,
    connectionLabel: phaseLabel(latest.phase),
    cwndMss: latest.cwndMss,
    ssthreshMss: latest.ssthreshMss,
    duplicateAcks: latest.duplicateAcks,
    highestAck,
    expectedAck,
    latestEventId: latest.id,
  };
}
