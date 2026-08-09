export type HttpLane = 'h2' | 'h3';
export type StreamState = 'idle' | 'active' | 'blocked' | 'progressing' | 'retransmitting' | 'complete';

export type HttpComparisonEvent = {
  id: string;
  atMs: number;
  title: string;
  summary: string;
  detail: string;
  focus: 'both' | HttpLane;
  h2Label: string;
  h3Label: string;
};

export type HttpLaneState = {
  streamA: StreamState;
  streamB: StreamState;
  streamAProgress: number;
  streamBProgress: number;
  transportLabel: string;
  lossLabel: string;
  deliveryLabel: string;
  congestionLabel: string;
};

export type HttpComparisonState = {
  timeMs: number;
  latestEventId: string;
  phaseLabel: string;
  h2: HttpLaneState;
  h3: HttpLaneState;
};

export const HTTP_COMPARISON_DURATION_MS = 3200;
export const HTTP_STREAM_A = '/hero.jpg';
export const HTTP_STREAM_B = '/app.js';

export const httpComparisonEvents: readonly HttpComparisonEvent[] = [
  {
    id: 'requests-open', atMs: 0, focus: 'both', title: 'Two responses begin concurrently',
    summary: 'Both lanes serve /hero.jpg and /app.js at the same time.',
    detail: 'HTTP/2 multiplexes frames for both streams over one TCP connection. HTTP/3 maps each request/response pair to an independent QUIC stream.',
    h2Label: 'H2 streams 1 + 3 share one ordered TCP byte stream',
    h3Label: 'H3 request streams 0 + 4 are independent QUIC streams',
  },
  {
    id: 'first-data', atMs: 450, focus: 'both', title: 'Both resources make forward progress',
    summary: 'Initial data for both streams reaches the client in both lanes.',
    detail: 'Before loss, multiplexing looks superficially similar: two application streams interleave over one connection.',
    h2Label: 'TCP delivers bytes in order to HTTP/2',
    h3Label: 'QUIC delivers ordered bytes within each stream',
  },
  {
    id: 'loss', atMs: 900, focus: 'both', title: 'The same logical Stream A data is lost',
    summary: 'A transport packet carrying /hero.jpg data disappears in each lane.',
    detail: 'The loss event is synchronized to isolate the transport difference. The comparison is curated; packetization details are chosen to expose head-of-line behavior clearly.',
    h2Label: 'TCP sequence hole opens in the connection byte stream',
    h3Label: 'QUIC Stream A offset range is missing',
  },
  {
    id: 'later-data', atMs: 1200, focus: 'both', title: 'Later data arrives after the gap',
    summary: 'Packets carrying later bytes—including Stream B data—still reach the receiver.',
    detail: 'The network can deliver packets out of order. What matters is what the transport is allowed to release upward to the HTTP layer.',
    h2Label: 'Later TCP bytes are buffered behind the missing sequence range',
    h3Label: 'Stream B bytes can be delivered independently of Stream A ordering',
  },
  {
    id: 'hol-diverges', atMs: 1450, focus: 'both', title: 'The lanes visibly diverge',
    summary: 'HTTP/2 stalls both responses; HTTP/3 keeps /app.js moving.',
    detail: 'TCP presents one ordered byte stream, so a sequence gap prevents later connection bytes from reaching HTTP/2. QUIC has no ordering relationship between bytes on different streams, so Stream B can progress while Stream A waits for repair.',
    h2Label: 'CONNECTION HOL · Stream A + Stream B blocked',
    h3Label: 'Stream A blocked · Stream B still progressing',
  },
  {
    id: 'congestion-response', atMs: 1650, focus: 'h3', title: 'QUIC loss still affects the connection',
    summary: 'HTTP/3 avoids cross-stream ordering blockage, not all consequences of packet loss.',
    detail: 'QUIC recovery and congestion control are connection-level mechanisms. The curated trace shows reduced sending pressure while preserving Stream B delivery independence.',
    h2Label: 'TCP loss recovery / congestion response active',
    h3Label: 'QUIC loss recovery active · Stream B remains deliverable',
  },
  {
    id: 'h2-retransmit', atMs: 1900, focus: 'h2', title: 'TCP retransmits the missing connection bytes',
    summary: 'Repairing the TCP sequence hole finally lets HTTP/2 see the buffered later bytes.',
    detail: 'Once the missing range arrives, TCP can release the contiguous byte stream. HTTP/2 can then resume parsing frames from both logical streams.',
    h2Label: 'TCP retransmission repairs the connection byte stream',
    h3Label: 'Stream B has already moved ahead',
  },
  {
    id: 'h2-release', atMs: 2150, focus: 'h2', title: 'HTTP/2 releases both stalled streams',
    summary: '/hero.jpg and /app.js jump forward together after TCP repair.',
    detail: 'This is transport head-of-line blocking beneath HTTP/2 multiplexing: independent HTTP streams were coupled by the ordered TCP substrate.',
    h2Label: 'Buffered H2 frames become deliverable',
    h3Label: 'No equivalent cross-stream release event was necessary',
  },
  {
    id: 'h3-retransmit', atMs: 2350, focus: 'h3', title: 'QUIC repairs Stream A',
    summary: '/hero.jpg receives the missing stream range while /app.js is already near completion.',
    detail: 'QUIC retransmits stream data as needed, but the lost Stream A range does not impose ordering on Stream B. STREAM frame boundaries need not be preserved during retransmission.',
    h2Label: 'Both H2 streams are progressing again',
    h3Label: 'Only Stream A needed ordering repair',
  },
  {
    id: 'complete', atMs: 2850, focus: 'both', title: 'Both lanes complete',
    summary: 'The final payload bytes are the same; the delivery coupling under loss was not.',
    detail: 'This theater isolates transport head-of-line behavior. It does not claim HTTP/3 can never block: flow control, congestion control, or QPACK dependencies can still create delays. This curated trace avoids dynamic QPACK dependencies.',
    h2Label: 'HTTP/2 complete after connection-level repair',
    h3Label: 'HTTP/3 complete with independent stream progress',
  },
];

export function clampHttpComparisonTime(timeMs: number): number {
  return Math.max(0, Math.min(HTTP_COMPARISON_DURATION_MS, timeMs));
}

export function latestHttpComparisonEvent(timeMs: number): HttpComparisonEvent {
  const time = clampHttpComparisonTime(timeMs);
  const events = httpComparisonEvents.filter((event) => event.atMs <= time);
  return events[events.length - 1] ?? httpComparisonEvents[0];
}

function h2State(timeMs: number): HttpLaneState {
  if (timeMs >= 2850) return { streamA: 'complete', streamB: 'complete', streamAProgress: 100, streamBProgress: 100, transportLabel: 'HTTP/2 over TCP', lossLabel: 'repaired', deliveryLabel: 'both complete', congestionLabel: 'recovery complete' };
  if (timeMs >= 2150) return { streamA: 'progressing', streamB: 'progressing', streamAProgress: 78, streamBProgress: 82, transportLabel: 'HTTP/2 over TCP', lossLabel: 'sequence gap repaired', deliveryLabel: 'buffered frames released', congestionLabel: 'additive recovery' };
  if (timeMs >= 1900) return { streamA: 'retransmitting', streamB: 'blocked', streamAProgress: 34, streamBProgress: 38, transportLabel: 'HTTP/2 over TCP', lossLabel: 'TCP retransmitting gap', deliveryLabel: 'HTTP/2 still waiting', congestionLabel: 'loss recovery active' };
  if (timeMs >= 900) return { streamA: 'blocked', streamB: 'blocked', streamAProgress: 34, streamBProgress: 38, transportLabel: 'HTTP/2 over TCP', lossLabel: 'TCP sequence hole', deliveryLabel: 'connection HOL blocking', congestionLabel: 'loss response active' };
  if (timeMs >= 450) return { streamA: 'active', streamB: 'active', streamAProgress: 34, streamBProgress: 38, transportLabel: 'HTTP/2 over TCP', lossLabel: 'none', deliveryLabel: 'multiplexed progress', congestionLabel: 'steady sending' };
  return { streamA: 'active', streamB: 'active', streamAProgress: 12, streamBProgress: 14, transportLabel: 'HTTP/2 over TCP', lossLabel: 'none', deliveryLabel: 'responses opening', congestionLabel: 'steady sending' };
}

function h3State(timeMs: number): HttpLaneState {
  if (timeMs >= 2850) return { streamA: 'complete', streamB: 'complete', streamAProgress: 100, streamBProgress: 100, transportLabel: 'HTTP/3 over QUIC', lossLabel: 'repaired', deliveryLabel: 'both complete', congestionLabel: 'recovery complete' };
  if (timeMs >= 2350) return { streamA: 'retransmitting', streamB: 'complete', streamAProgress: 72, streamBProgress: 100, transportLabel: 'HTTP/3 over QUIC', lossLabel: 'Stream A repair', deliveryLabel: 'Stream B already complete', congestionLabel: 'connection recovering' };
  if (timeMs >= 1650) return { streamA: 'blocked', streamB: 'progressing', streamAProgress: 34, streamBProgress: 88, transportLabel: 'HTTP/3 over QUIC', lossLabel: 'Stream A offset gap', deliveryLabel: 'Stream B independent', congestionLabel: 'connection-wide loss response' };
  if (timeMs >= 1200) return { streamA: 'blocked', streamB: 'progressing', streamAProgress: 34, streamBProgress: 66, transportLabel: 'HTTP/3 over QUIC', lossLabel: 'Stream A offset gap', deliveryLabel: 'Stream B independent', congestionLabel: 'loss detected' };
  if (timeMs >= 900) return { streamA: 'blocked', streamB: 'active', streamAProgress: 34, streamBProgress: 43, transportLabel: 'HTTP/3 over QUIC', lossLabel: 'Stream A offset gap', deliveryLabel: 'Stream B remains eligible', congestionLabel: 'loss detection pending' };
  if (timeMs >= 450) return { streamA: 'active', streamB: 'active', streamAProgress: 34, streamBProgress: 38, transportLabel: 'HTTP/3 over QUIC', lossLabel: 'none', deliveryLabel: 'independent streams', congestionLabel: 'steady sending' };
  return { streamA: 'active', streamB: 'active', streamAProgress: 12, streamBProgress: 14, transportLabel: 'HTTP/3 over QUIC', lossLabel: 'none', deliveryLabel: 'responses opening', congestionLabel: 'steady sending' };
}

export function httpComparisonStateAt(timeMs: number): HttpComparisonState {
  const time = clampHttpComparisonTime(timeMs);
  const latest = latestHttpComparisonEvent(time);
  return {
    timeMs: time,
    latestEventId: latest.id,
    phaseLabel: latest.title.toUpperCase(),
    h2: h2State(time),
    h3: h3State(time),
  };
}
