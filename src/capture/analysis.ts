import { deepFreeze } from './bytes.ts';
import type { CaptureSessionIndex } from './session.ts';
import type {
  CaptureConversation,
  CapturedEventKind,
  CapturedFrameEvidence,
  ConversationDirection,
} from './types.ts';

export type CapturedEvidenceState =
  | 'OBSERVED'
  | 'NOT_OBSERVED_IN_CAPTURE'
  | 'CAPTURE_STARTED_MID_CONVERSATION'
  | 'INSUFFICIENT_CAPTURE_EVIDENCE';

export type TcpPayloadClassification = 'new' | 'retransmission' | 'overlap' | 'out-of-order';

export interface TcpPayloadObservation {
  readonly frameId: string;
  readonly frameNumber: number;
  readonly direction: ConversationDirection;
  readonly sequenceNumber: number;
  readonly logicalStart: bigint;
  readonly logicalEnd: bigint;
  readonly length: number;
  readonly classification: TcpPayloadClassification;
  readonly outOfOrder: boolean;
  readonly provenance: 'CAPTURED' | 'INFERRED';
}

export interface TcpStreamSlice {
  readonly frameId: string;
  readonly frameNumber: number;
  readonly direction: ConversationDirection;
  readonly logicalStart: bigint;
  readonly logicalEnd: bigint;
  readonly frameByteOffset: number;
  readonly length: number;
  readonly provenance: 'CAPTURED';
}

export interface TcpStreamGap {
  readonly logicalStart: bigint;
  readonly logicalEnd: bigint;
  readonly length: number;
  readonly provenance: 'INFERRED';
  readonly uncertainty: string;
}

export interface TcpDirectionReconstruction {
  readonly direction: ConversationDirection;
  readonly evidenceState: CapturedEvidenceState;
  readonly firstSequenceNumber: number | null;
  readonly logicalLength: bigint;
  readonly uniqueCapturedBytes: number;
  readonly payloadObservations: readonly TcpPayloadObservation[];
  readonly slices: readonly TcpStreamSlice[];
  readonly gaps: readonly TcpStreamGap[];
  readonly retransmissionCount: number;
  readonly overlapCount: number;
  readonly outOfOrderCount: number;
  readonly summary: string;
}

export interface TcpStreamReconstruction {
  readonly conversationId: string;
  readonly endpointA: string;
  readonly endpointB: string;
  readonly directions: Readonly<Record<ConversationDirection, TcpDirectionReconstruction>>;
  readonly evidenceState: CapturedEvidenceState;
  readonly provenance: 'INFERRED';
}

export interface TcpStreamWindowPiece {
  readonly frameId: string;
  readonly frameNumber: number;
  readonly logicalStart: bigint;
  readonly logicalEnd: bigint;
  readonly bytesHex: string;
  readonly textPreview: string;
  readonly provenance: 'CAPTURED';
}

export interface TcpStreamWindow {
  readonly conversationId: string;
  readonly direction: ConversationDirection;
  readonly requestedStart: bigint;
  readonly requestedLength: number;
  readonly pieces: readonly TcpStreamWindowPiece[];
  readonly gaps: readonly TcpStreamGap[];
  readonly completeForRequestedWindow: boolean;
}

export type CaptureRttBasis = 'tcp-timestamp-echo' | 'cumulative-ack';

export interface CaptureRttObservation {
  readonly id: string;
  readonly conversationId: string;
  readonly direction: ConversationDirection;
  readonly sourceFrameId: string;
  readonly sourceFrameNumber: number;
  readonly acknowledgmentFrameId: string;
  readonly acknowledgmentFrameNumber: number;
  readonly basis: CaptureRttBasis;
  readonly sequenceNumber: number;
  readonly acknowledgmentNumber: number;
  readonly acknowledgedPayloadBytes: number;
  readonly durationNanoseconds: bigint;
  readonly durationMs: number;
  readonly provenance: 'INFERRED';
  readonly uncertainty: string;
}

export interface CaptureRttSummary {
  readonly conversationId: string;
  readonly evidenceState: CapturedEvidenceState;
  readonly observations: readonly CaptureRttObservation[];
  readonly p50Ms: number | null;
  readonly p95Ms: number | null;
  readonly minMs: number | null;
  readonly maxMs: number | null;
  readonly ambiguousSamplesExcluded: number;
  readonly provenance: 'INFERRED';
}

export interface CapturedTheaterStage {
  readonly id: string;
  readonly label: string;
  readonly state: CapturedEvidenceState;
  readonly eventIds: readonly string[];
  readonly primaryFrameIds: readonly string[];
  readonly provenance: 'CAPTURED' | 'INFERRED' | null;
  readonly detail: string;
}

export interface CapturedProtocolTheaterProjection {
  readonly conversationId: string;
  readonly protocol: string;
  readonly evidenceState: CapturedEvidenceState;
  readonly stages: readonly CapturedTheaterStage[];
  readonly provenance: 'INFERRED';
  readonly boundary: string;
}

export interface CaptureTrafficBin {
  readonly index: number;
  readonly startNanoseconds: bigint;
  readonly endNanoseconds: bigint;
  readonly frameCount: number;
  readonly capturedBytes: number;
  readonly conversationCount: number;
}

export interface CaptureProtocolAggregate {
  readonly protocol: string;
  readonly frameCount: number;
  readonly capturedBytes: number;
  readonly conversationCount: number;
}

export interface CaptureEndpointAggregate {
  readonly endpoint: string;
  readonly frameCount: number;
  readonly participatingBytes: number;
}

export interface CaptureTrafficOverview {
  readonly captureId: string;
  readonly bins: readonly CaptureTrafficBin[];
  readonly protocols: readonly CaptureProtocolAggregate[];
  readonly endpoints: readonly CaptureEndpointAggregate[];
  readonly provenance: 'INFERRED';
  readonly boundary: string;
}

export interface CaptureComparisonFlow {
  readonly key: string;
  readonly status: 'matched' | 'left-only' | 'right-only';
  readonly leftConversationId: string | null;
  readonly rightConversationId: string | null;
  readonly protocol: string;
  readonly frameDelta: number | null;
  readonly capturedByteDelta: number | null;
  readonly durationDeltaNanoseconds: bigint | null;
}

export interface CaptureComparison {
  readonly leftCaptureId: string;
  readonly rightCaptureId: string;
  readonly frameDelta: number;
  readonly capturedByteDelta: number;
  readonly conversationDelta: number;
  readonly eventDelta: number;
  readonly flows: readonly CaptureComparisonFlow[];
  readonly eventKindDelta: readonly { readonly kind: string; readonly delta: number }[];
  readonly provenance: 'INFERRED';
  readonly boundary: string;
}

const MOD32 = 0x1_0000_0000n;
const HALF32 = 0x8000_0000n;
const STREAM_WINDOW_LIMIT = 4096;

type FrameWithDirection = { frame: CapturedFrameEvidence; direction: ConversationDirection };
type MutableSlice = {
  frameId: string;
  frameNumber: number;
  direction: ConversationDirection;
  logicalStart: bigint;
  logicalEnd: bigint;
  frameByteOffset: number;
  length: number;
};

function endpointLabel(conversation: CaptureConversation, endpoint: 'A' | 'B'): string {
  const value = endpoint === 'A' ? conversation.endpointA : conversation.endpointB;
  return `${value.address}${value.port === null ? '' : `:${value.port}`}`;
}

function signedSequenceDelta(sequence: number, base: number): bigint {
  let delta = BigInt(sequence >>> 0) - BigInt(base >>> 0);
  if (delta >= HALF32) delta -= MOD32;
  if (delta < -HALF32) delta += MOD32;
  return delta;
}

function sequenceForwardDistance(from: number, to: number): bigint {
  return BigInt((to - from) >>> 0);
}

function acknowledgmentCovers(endExclusive: number, acknowledgment: number): boolean {
  const distance = sequenceForwardDistance(endExclusive, acknowledgment);
  return distance < HALF32;
}

function framesForConversation(session: CaptureSessionIndex, conversationId: string): readonly FrameWithDirection[] {
  const conversation = session.conversation(conversationId);
  if (!conversation) return [];
  return conversation.frameReferences
    .map((reference) => {
      const frame = session.frame(reference.frameId);
      return frame ? { frame, direction: reference.direction } : null;
    })
    .filter((entry): entry is FrameWithDirection => entry !== null)
    .sort((left, right) => left.frame.record.sourceOrder - right.frame.record.sourceOrder);
}

function overlapLength(start: bigint, end: bigint, slices: readonly MutableSlice[]): bigint {
  let total = 0n;
  for (const slice of slices) {
    const overlapStart = start > slice.logicalStart ? start : slice.logicalStart;
    const overlapEnd = end < slice.logicalEnd ? end : slice.logicalEnd;
    if (overlapEnd > overlapStart) total += overlapEnd - overlapStart;
  }
  return total;
}

function uncoveredPieces(start: bigint, end: bigint, slices: readonly MutableSlice[]): readonly { start: bigint; end: bigint }[] {
  const relevant = slices
    .filter((slice) => slice.logicalEnd > start && slice.logicalStart < end)
    .sort((left, right) => left.logicalStart < right.logicalStart ? -1 : left.logicalStart > right.logicalStart ? 1 : 0);
  const pieces: Array<{ start: bigint; end: bigint }> = [];
  let cursor = start;
  for (const slice of relevant) {
    if (slice.logicalStart > cursor) pieces.push({ start: cursor, end: slice.logicalStart < end ? slice.logicalStart : end });
    if (slice.logicalEnd > cursor) cursor = slice.logicalEnd;
    if (cursor >= end) break;
  }
  if (cursor < end) pieces.push({ start: cursor, end });
  return pieces.filter((piece) => piece.end > piece.start);
}

function evidenceStateForDirection(conversation: CaptureConversation, observations: number, gaps: number): CapturedEvidenceState {
  if (observations === 0) return 'NOT_OBSERVED_IN_CAPTURE';
  if (conversation.captureStartedMidConversation) return 'CAPTURE_STARTED_MID_CONVERSATION';
  if (conversation.oneDirectionOnly || conversation.truncatedFrameCount > 0 || gaps > 0) return 'INSUFFICIENT_CAPTURE_EVIDENCE';
  return 'OBSERVED';
}

function reconstructDirection(
  session: CaptureSessionIndex,
  conversation: CaptureConversation,
  direction: ConversationDirection,
): TcpDirectionReconstruction {
  const frames = framesForConversation(session, conversation.id).filter((entry) => entry.direction === direction && entry.frame.transport?.tcp);
  const payloadFrames = frames.filter((entry) => (entry.frame.transport?.tcp?.payloadRange.length ?? 0) > 0);
  const baseSequence = payloadFrames[0]?.frame.transport?.tcp?.sequenceNumber ?? null;
  if (baseSequence === null) {
    return deepFreeze({
      direction,
      evidenceState: 'NOT_OBSERVED_IN_CAPTURE',
      firstSequenceNumber: null,
      logicalLength: 0n,
      uniqueCapturedBytes: 0,
      payloadObservations: [],
      slices: [],
      gaps: [],
      retransmissionCount: 0,
      overlapCount: 0,
      outOfOrderCount: 0,
      summary: 'No TCP payload bytes in this direction were observed in the capture.',
    });
  }

  const slices: MutableSlice[] = [];
  const observations: TcpPayloadObservation[] = [];
  let highestObservedEnd: bigint | null = null;
  let minimumStart = 0n;
  let maximumEnd = 0n;
  let retransmissionCount = 0;
  let overlapCount = 0;
  let outOfOrderCount = 0;

  for (const entry of payloadFrames) {
    const tcp = entry.frame.transport?.tcp;
    if (!tcp || tcp.payloadRange.length <= 0) continue;
    const start = signedSequenceDelta(tcp.sequenceNumber, baseSequence);
    const end = start + BigInt(tcp.payloadRange.length);
    minimumStart = observations.length === 0 || start < minimumStart ? start : minimumStart;
    maximumEnd = end > maximumEnd ? end : maximumEnd;
    const covered = overlapLength(start, end, slices);
    const outOfOrder = highestObservedEnd !== null && start < highestObservedEnd && covered < end - start;
    let classification: TcpPayloadClassification = 'new';
    if (covered === end - start) {
      classification = 'retransmission';
      retransmissionCount += 1;
    } else if (covered > 0n) {
      classification = 'overlap';
      overlapCount += 1;
    } else if (outOfOrder) {
      classification = 'out-of-order';
      outOfOrderCount += 1;
    }
    observations.push({
      frameId: entry.frame.record.id,
      frameNumber: entry.frame.record.number,
      direction,
      sequenceNumber: tcp.sequenceNumber,
      logicalStart: start,
      logicalEnd: end,
      length: tcp.payloadRange.length,
      classification,
      outOfOrder,
      provenance: classification === 'new' ? 'CAPTURED' : 'INFERRED',
    });
    for (const piece of uncoveredPieces(start, end, slices)) {
      const relativeOffset = Number(piece.start - start);
      slices.push({
        frameId: entry.frame.record.id,
        frameNumber: entry.frame.record.number,
        direction,
        logicalStart: piece.start,
        logicalEnd: piece.end,
        frameByteOffset: tcp.payloadRange.offset + relativeOffset,
        length: Number(piece.end - piece.start),
      });
    }
    slices.sort((left, right) => left.logicalStart < right.logicalStart ? -1 : left.logicalStart > right.logicalStart ? 1 : left.frameNumber - right.frameNumber);
    highestObservedEnd = highestObservedEnd === null || end > highestObservedEnd ? end : highestObservedEnd;
  }

  const shift = minimumStart < 0n ? -minimumStart : 0n;
  const normalizedSlices = slices.map<TcpStreamSlice>((slice) => deepFreeze({
    ...slice,
    logicalStart: slice.logicalStart + shift,
    logicalEnd: slice.logicalEnd + shift,
    provenance: 'CAPTURED',
  }));
  const normalizedObservations = observations.map<TcpPayloadObservation>((observation) => deepFreeze({
    ...observation,
    logicalStart: observation.logicalStart + shift,
    logicalEnd: observation.logicalEnd + shift,
  }));
  const gaps: TcpStreamGap[] = [];
  if (normalizedSlices.length > 0) {
    let cursor = normalizedSlices[0]?.logicalStart ?? 0n;
    for (const slice of normalizedSlices) {
      if (slice.logicalStart > cursor) {
        gaps.push(deepFreeze({
          logicalStart: cursor,
          logicalEnd: slice.logicalStart,
          length: Number(slice.logicalStart - cursor),
          provenance: 'INFERRED',
          uncertainty: 'These sequence-space bytes were not present in the capture. HOPSCOTCH does not fill them or claim the network dropped them.',
        }));
      }
      if (slice.logicalEnd > cursor) cursor = slice.logicalEnd;
    }
  }
  const uniqueCapturedBytes = normalizedSlices.reduce((sum, slice) => sum + slice.length, 0);
  const logicalLength = normalizedSlices.length > 0
    ? (normalizedSlices[normalizedSlices.length - 1]?.logicalEnd ?? 0n) - (normalizedSlices[0]?.logicalStart ?? 0n)
    : 0n;
  const evidenceState = evidenceStateForDirection(conversation, observations.length, gaps.length);
  const summary = evidenceState === 'OBSERVED'
    ? `${uniqueCapturedBytes.toLocaleString()} unique payload bytes form one capture-visible contiguous sequence span.`
    : evidenceState === 'CAPTURE_STARTED_MID_CONVERSATION'
      ? `${uniqueCapturedBytes.toLocaleString()} payload bytes were reconstructed, but the capture began after the TCP conversation had already started.`
      : evidenceState === 'INSUFFICIENT_CAPTURE_EVIDENCE'
        ? `${uniqueCapturedBytes.toLocaleString()} unique payload bytes were reconstructed with ${gaps.length} explicit capture-visible gap${gaps.length === 1 ? '' : 's'} or other incomplete evidence.`
        : 'No TCP payload bytes were observed in this direction.';

  return deepFreeze({
    direction,
    evidenceState,
    firstSequenceNumber: baseSequence,
    logicalLength,
    uniqueCapturedBytes,
    payloadObservations: normalizedObservations,
    slices: normalizedSlices,
    gaps,
    retransmissionCount,
    overlapCount,
    outOfOrderCount,
    summary,
  });
}

function overallStreamState(conversation: CaptureConversation, directions: Readonly<Record<ConversationDirection, TcpDirectionReconstruction>>): CapturedEvidenceState {
  if (conversation.captureStartedMidConversation) return 'CAPTURE_STARTED_MID_CONVERSATION';
  const states = [directions.A_TO_B.evidenceState, directions.B_TO_A.evidenceState];
  if (states.every((state) => state === 'NOT_OBSERVED_IN_CAPTURE')) return 'NOT_OBSERVED_IN_CAPTURE';
  if (states.some((state) => state === 'INSUFFICIENT_CAPTURE_EVIDENCE' || state === 'NOT_OBSERVED_IN_CAPTURE')) return 'INSUFFICIENT_CAPTURE_EVIDENCE';
  return 'OBSERVED';
}

export function reconstructTcpConversation(session: CaptureSessionIndex, conversationId: string): TcpStreamReconstruction | null {
  const conversation = session.conversation(conversationId);
  if (!conversation || conversation.protocol !== 'TCP') return null;
  const directions = deepFreeze({
    A_TO_B: reconstructDirection(session, conversation, 'A_TO_B'),
    B_TO_A: reconstructDirection(session, conversation, 'B_TO_A'),
  });
  return deepFreeze({
    conversationId,
    endpointA: endpointLabel(conversation, 'A'),
    endpointB: endpointLabel(conversation, 'B'),
    directions,
    evidenceState: overallStreamState(conversation, directions),
    provenance: 'INFERRED',
  });
}

function printablePreview(bytes: Uint8Array): string {
  return Array.from(bytes, (value) => value >= 32 && value <= 126 ? String.fromCharCode(value) : '·').join('');
}

export function readTcpStreamWindow(
  session: CaptureSessionIndex,
  reconstruction: TcpStreamReconstruction,
  direction: ConversationDirection,
  requestedStart: bigint,
  requestedLength: number,
): TcpStreamWindow {
  const length = Math.max(0, Math.min(STREAM_WINDOW_LIMIT, Math.floor(requestedLength)));
  const start = requestedStart < 0n ? 0n : requestedStart;
  const end = start + BigInt(length);
  const directionState = reconstruction.directions[direction];
  const pieces: TcpStreamWindowPiece[] = [];
  for (const slice of directionState.slices) {
    const intersectionStart = slice.logicalStart > start ? slice.logicalStart : start;
    const intersectionEnd = slice.logicalEnd < end ? slice.logicalEnd : end;
    if (intersectionEnd <= intersectionStart) continue;
    const frame = session.frame(slice.frameId);
    if (!frame) continue;
    const sliceOffset = Number(intersectionStart - slice.logicalStart);
    const byteLength = Number(intersectionEnd - intersectionStart);
    const bytes = frame.record.bytes.copy(slice.frameByteOffset + sliceOffset, byteLength);
    pieces.push(deepFreeze({
      frameId: slice.frameId,
      frameNumber: slice.frameNumber,
      logicalStart: intersectionStart,
      logicalEnd: intersectionEnd,
      bytesHex: Array.from(bytes, (value) => value.toString(16).padStart(2, '0').toUpperCase()).join(' '),
      textPreview: printablePreview(bytes),
      provenance: 'CAPTURED',
    }));
  }
  const gaps = directionState.gaps.filter((gap) => gap.logicalEnd > start && gap.logicalStart < end).map((gap) => deepFreeze({
    ...gap,
    logicalStart: gap.logicalStart > start ? gap.logicalStart : start,
    logicalEnd: gap.logicalEnd < end ? gap.logicalEnd : end,
    length: Number((gap.logicalEnd < end ? gap.logicalEnd : end) - (gap.logicalStart > start ? gap.logicalStart : start)),
  }));
  const observed = pieces.reduce((sum, piece) => sum + Number(piece.logicalEnd - piece.logicalStart), 0);
  return deepFreeze({
    conversationId: reconstruction.conversationId,
    direction,
    requestedStart: start,
    requestedLength: length,
    pieces,
    gaps,
    completeForRequestedWindow: length === 0 || (observed === length && gaps.length === 0),
  });
}

function sequenceRangeOverlaps(sourceSequence: number, sourceLength: number, candidateSequence: number, candidateLength: number): boolean {
  if (sourceLength <= 0 || candidateLength <= 0) return false;
  const candidateStart = signedSequenceDelta(candidateSequence, sourceSequence);
  const candidateEnd = candidateStart + BigInt(candidateLength);
  return candidateStart < BigInt(sourceLength) && candidateEnd > 0n;
}

function percentile(values: readonly number[], percentileValue: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(0, Math.min(sorted.length - 1, Math.ceil((percentileValue / 100) * sorted.length) - 1));
  return sorted[index] ?? null;
}

export function buildCaptureRttSummary(session: CaptureSessionIndex, conversationId: string): CaptureRttSummary | null {
  const conversation = session.conversation(conversationId);
  if (!conversation || conversation.protocol !== 'TCP') return null;
  const frames = framesForConversation(session, conversationId);
  const observations: CaptureRttObservation[] = [];
  let ambiguousSamplesExcluded = 0;

  for (let sourceIndex = 0; sourceIndex < frames.length; sourceIndex += 1) {
    const sourceEntry = frames[sourceIndex];
    const sourceTcp = sourceEntry?.frame.transport?.tcp;
    if (!sourceEntry || !sourceTcp) continue;
    const payloadLength = sourceTcp.payloadRange.length;
    const sequenceConsumption = payloadLength + (sourceTcp.flags.syn ? 1 : 0) + (sourceTcp.flags.fin ? 1 : 0);
    if (sequenceConsumption <= 0 || sourceEntry.frame.record.truncated) continue;
    const endExclusive = (sourceTcp.sequenceNumber + sequenceConsumption) >>> 0;
    let chosen: FrameWithDirection | null = null;
    let basis: CaptureRttBasis = 'cumulative-ack';

    if (sourceTcp.options.timestampValue !== null) {
      for (let candidateIndex = sourceIndex + 1; candidateIndex < frames.length; candidateIndex += 1) {
        const candidate = frames[candidateIndex];
        const tcp = candidate?.frame.transport?.tcp;
        if (!candidate || !tcp || candidate.direction === sourceEntry.direction || !tcp.flags.ack) continue;
        if (tcp.options.timestampEchoReply === sourceTcp.options.timestampValue) {
          chosen = candidate;
          basis = 'tcp-timestamp-echo';
          break;
        }
      }
    }

    if (!chosen) {
      for (let candidateIndex = sourceIndex + 1; candidateIndex < frames.length; candidateIndex += 1) {
        const candidate = frames[candidateIndex];
        const tcp = candidate?.frame.transport?.tcp;
        if (!candidate || !tcp || candidate.direction === sourceEntry.direction || !tcp.flags.ack) continue;
        if (!acknowledgmentCovers(endExclusive, tcp.acknowledgmentNumber)) continue;
        const repeatedBeforeAck = frames.slice(sourceIndex + 1, candidateIndex).some((between) => {
          const betweenTcp = between.frame.transport?.tcp;
          if (!betweenTcp || between.direction !== sourceEntry.direction) return false;
          const betweenLength = betweenTcp.payloadRange.length + (betweenTcp.flags.syn ? 1 : 0) + (betweenTcp.flags.fin ? 1 : 0);
          return sequenceRangeOverlaps(sourceTcp.sequenceNumber, sequenceConsumption, betweenTcp.sequenceNumber, betweenLength);
        });
        if (repeatedBeforeAck) {
          ambiguousSamplesExcluded += 1;
          break;
        }
        chosen = candidate;
        break;
      }
    }

    const acknowledgmentTcp = chosen?.frame.transport?.tcp;
    if (!chosen || !acknowledgmentTcp) continue;
    const durationNanoseconds = chosen.frame.record.relativeTimeNanoseconds - sourceEntry.frame.record.relativeTimeNanoseconds;
    if (durationNanoseconds < 0n) continue;
    observations.push(deepFreeze({
      id: `${conversationId}:rtt:${sourceEntry.frame.record.id}:${chosen.frame.record.id}`,
      conversationId,
      direction: sourceEntry.direction,
      sourceFrameId: sourceEntry.frame.record.id,
      sourceFrameNumber: sourceEntry.frame.record.number,
      acknowledgmentFrameId: chosen.frame.record.id,
      acknowledgmentFrameNumber: chosen.frame.record.number,
      basis,
      sequenceNumber: sourceTcp.sequenceNumber,
      acknowledgmentNumber: acknowledgmentTcp.acknowledgmentNumber,
      acknowledgedPayloadBytes: payloadLength,
      durationNanoseconds,
      durationMs: Number(durationNanoseconds) / 1_000_000,
      provenance: 'INFERRED',
      uncertainty: basis === 'tcp-timestamp-echo'
        ? 'The delay is correlated by capture-visible TCP timestamp echo fields at one vantage point; it is not a claim about end-to-end path latency outside this capture.'
        : 'The delay is correlated by the first unambiguous capture-visible cumulative ACK covering this sequence range; delayed ACK behavior and capture placement still affect interpretation.',
    }));
  }

  const values = observations.map((observation) => observation.durationMs);
  const evidenceState: CapturedEvidenceState = observations.length === 0
    ? (conversation.captureStartedMidConversation ? 'CAPTURE_STARTED_MID_CONVERSATION' : 'NOT_OBSERVED_IN_CAPTURE')
    : conversation.captureStartedMidConversation || conversation.oneDirectionOnly || conversation.truncatedFrameCount > 0
      ? 'INSUFFICIENT_CAPTURE_EVIDENCE'
      : 'OBSERVED';
  return deepFreeze({
    conversationId,
    evidenceState,
    observations,
    p50Ms: percentile(values, 50),
    p95Ms: percentile(values, 95),
    minMs: values.length > 0 ? Math.min(...values) : null,
    maxMs: values.length > 0 ? Math.max(...values) : null,
    ambiguousSamplesExcluded,
    provenance: 'INFERRED',
  });
}

function missingStageState(conversation: CaptureConversation): CapturedEvidenceState {
  if (conversation.captureStartedMidConversation) return 'CAPTURE_STARTED_MID_CONVERSATION';
  if (conversation.oneDirectionOnly || conversation.truncatedFrameCount > 0) return 'INSUFFICIENT_CAPTURE_EVIDENCE';
  return 'NOT_OBSERVED_IN_CAPTURE';
}

function theaterStage(
  session: CaptureSessionIndex,
  conversation: CaptureConversation,
  id: string,
  label: string,
  kinds: readonly CapturedEventKind[],
  detailWhenMissing: string,
): CapturedTheaterStage {
  const events = session.eventsForConversation(conversation.id).filter((event) => kinds.includes(event.kind));
  if (events.length === 0) {
    return deepFreeze({ id, label, state: missingStageState(conversation), eventIds: [], primaryFrameIds: [], provenance: null, detail: detailWhenMissing });
  }
  const provenance = events.some((event) => event.provenance === 'INFERRED') ? 'INFERRED' : 'CAPTURED';
  return deepFreeze({
    id,
    label,
    state: 'OBSERVED',
    eventIds: events.map((event) => event.id),
    primaryFrameIds: [...new Set(events.map((event) => event.primaryFrameId))],
    provenance,
    detail: events.map((event) => event.summary).join(' '),
  });
}

export function buildCapturedProtocolTheater(session: CaptureSessionIndex, conversationId: string): CapturedProtocolTheaterProjection | null {
  const conversation = session.conversation(conversationId);
  if (!conversation) return null;
  const stages: CapturedTheaterStage[] = [];
  if (conversation.protocol === 'TCP') {
    stages.push(theaterStage(session, conversation, 'tcp-syn', 'TCP SYN', ['tcp.syn'], 'No opening SYN is present in this capture.'));
    stages.push(theaterStage(session, conversation, 'tcp-syn-ack', 'TCP SYN/ACK', ['tcp.syn-ack'], 'No SYN/ACK is present in this capture.'));
    stages.push(theaterStage(session, conversation, 'tcp-established', 'TCP ESTABLISHMENT', ['tcp.established-observed'], 'The capture does not contain enough ordered handshake evidence to project establishment.'));
    stages.push(theaterStage(session, conversation, 'tcp-stream', 'TCP STREAM', ['tcp.data', 'tcp.retransmission-observed', 'tcp.overlap-observed', 'tcp.sequence-gap-visible'], 'No TCP payload event is present in this capture.'));
    stages.push(theaterStage(session, conversation, 'tcp-close', 'TCP CLOSE / RESET', ['tcp.fin', 'tcp.rst'], 'No FIN or RST is present in this capture.'));
  }
  if (conversation.applicationProtocol === 'TLS') {
    stages.push(theaterStage(session, conversation, 'tls-client-hello', 'TLS CLIENT HELLO', ['tls.client-hello'], 'No frame-local ClientHello was visible in the capture.'));
    stages.push(theaterStage(session, conversation, 'tls-server-hello', 'TLS SERVER HELLO', ['tls.server-hello'], 'No frame-local ServerHello was visible in the capture.'));
  }
  if (conversation.protocol === 'DNS') {
    stages.push(theaterStage(session, conversation, 'dns-query', 'DNS QUERY', ['dns.query'], 'No DNS query is present in this captured conversation.'));
    stages.push(theaterStage(session, conversation, 'dns-response', 'DNS RESPONSE', ['dns.response'], 'No DNS response is present in this captured conversation.'));
  }
  if (conversation.protocol === 'UDP') stages.push(theaterStage(session, conversation, 'udp-datagram', 'UDP DATAGRAMS', ['udp.datagram'], 'No supported UDP datagram event is present.'));
  if (conversation.protocol === 'ICMP' || conversation.protocol === 'ICMPV6') {
    stages.push(theaterStage(session, conversation, 'icmp', 'ICMP EXCHANGE', ['icmp.echo-request', 'icmp.echo-reply', 'icmp.destination-unreachable', 'icmp.time-exceeded', 'icmp.packet-too-big', 'icmp.message'], 'No supported ICMP semantic event is present.'));
  }
  const observed = stages.filter((stage) => stage.state === 'OBSERVED').length;
  const evidenceState: CapturedEvidenceState = conversation.captureStartedMidConversation
    ? 'CAPTURE_STARTED_MID_CONVERSATION'
    : observed === 0
      ? 'NOT_OBSERVED_IN_CAPTURE'
      : stages.some((stage) => stage.state === 'INSUFFICIENT_CAPTURE_EVIDENCE')
        ? 'INSUFFICIENT_CAPTURE_EVIDENCE'
        : 'OBSERVED';
  return deepFreeze({
    conversationId,
    protocol: conversation.applicationProtocol ?? conversation.protocol,
    evidenceState,
    stages,
    provenance: 'INFERRED',
    boundary: 'Captured Protocol Theater is a projection of observed frames and deterministic interpretations only. Missing stages remain missing; HOPSCOTCH never fabricates an uncaptured handshake or application exchange.',
  });
}

export function buildCaptureTrafficOverview(session: CaptureSessionIndex, requestedBinCount = 64): CaptureTrafficOverview {
  const binCount = Math.max(8, Math.min(256, Math.floor(requestedBinCount)));
  const duration = session.metadata.durationNanoseconds > 0n ? session.metadata.durationNanoseconds : 1n;
  const mutableBins = Array.from({ length: binCount }, (_, index) => ({
    index,
    startNanoseconds: (duration * BigInt(index)) / BigInt(binCount),
    endNanoseconds: (duration * BigInt(index + 1)) / BigInt(binCount),
    frameCount: 0,
    capturedBytes: 0,
    conversationIds: new Set<string>(),
  }));
  const protocolMap = new Map<string, { frameCount: number; capturedBytes: number; conversationIds: Set<string> }>();
  const endpointMap = new Map<string, { frameCount: number; participatingBytes: number }>();

  for (const frame of session.frames) {
    const time = frame.record.relativeTimeNanoseconds;
    const binIndex = Number((time * BigInt(binCount)) / (duration + 1n));
    const bin = mutableBins[Math.max(0, Math.min(binCount - 1, binIndex))];
    const conversation = session.conversationForFrame(frame.record.id);
    if (bin) {
      bin.frameCount += 1;
      bin.capturedBytes += frame.record.capturedLength;
      if (conversation) bin.conversationIds.add(conversation.id);
    }
    const protocol = conversation?.applicationProtocol ?? conversation?.protocol ?? 'UNINTERPRETED';
    const aggregate = protocolMap.get(protocol) ?? { frameCount: 0, capturedBytes: 0, conversationIds: new Set<string>() };
    aggregate.frameCount += 1;
    aggregate.capturedBytes += frame.record.capturedLength;
    if (conversation) aggregate.conversationIds.add(conversation.id);
    protocolMap.set(protocol, aggregate);
    const transport = frame.transport;
    if (transport) {
      for (const endpoint of [transport.source, transport.destination]) {
        const key = `${endpoint.address}${endpoint.port === null ? '' : `:${endpoint.port}`}`;
        const endpointAggregate = endpointMap.get(key) ?? { frameCount: 0, participatingBytes: 0 };
        endpointAggregate.frameCount += 1;
        endpointAggregate.participatingBytes += frame.record.capturedLength;
        endpointMap.set(key, endpointAggregate);
      }
    }
  }

  return deepFreeze({
    captureId: session.metadata.captureId,
    bins: mutableBins.map((bin) => ({
      index: bin.index,
      startNanoseconds: bin.startNanoseconds,
      endNanoseconds: bin.endNanoseconds,
      frameCount: bin.frameCount,
      capturedBytes: bin.capturedBytes,
      conversationCount: bin.conversationIds.size,
    })),
    protocols: [...protocolMap.entries()].map(([protocol, aggregate]) => ({ protocol, frameCount: aggregate.frameCount, capturedBytes: aggregate.capturedBytes, conversationCount: aggregate.conversationIds.size }))
      .sort((left, right) => right.capturedBytes - left.capturedBytes || left.protocol.localeCompare(right.protocol)),
    endpoints: [...endpointMap.entries()].map(([endpoint, aggregate]) => ({ endpoint, ...aggregate }))
      .sort((left, right) => right.participatingBytes - left.participatingBytes || left.endpoint.localeCompare(right.endpoint))
      .slice(0, 24),
    provenance: 'INFERRED',
    boundary: 'Traffic aggregates summarize only capture-visible frames, bytes, normalized conversations, and endpoints. They do not infer routers, links, sites, or a physical path.',
  });
}

function eventKindCounts(session: CaptureSessionIndex): Map<string, number> {
  const counts = new Map<string, number>();
  for (const event of session.events) counts.set(event.kind, (counts.get(event.kind) ?? 0) + 1);
  return counts;
}

export function compareCaptureSessions(left: CaptureSessionIndex, right: CaptureSessionIndex): CaptureComparison {
  const leftByKey = new Map(left.conversations.map((conversation) => [conversation.key, conversation]));
  const rightByKey = new Map(right.conversations.map((conversation) => [conversation.key, conversation]));
  const keys = [...new Set([...leftByKey.keys(), ...rightByKey.keys()])].sort();
  const flows = keys.map<CaptureComparisonFlow>((key) => {
    const leftConversation = leftByKey.get(key) ?? null;
    const rightConversation = rightByKey.get(key) ?? null;
    const status = leftConversation && rightConversation ? 'matched' : leftConversation ? 'left-only' : 'right-only';
    return deepFreeze({
      key,
      status,
      leftConversationId: leftConversation?.id ?? null,
      rightConversationId: rightConversation?.id ?? null,
      protocol: leftConversation?.applicationProtocol ?? leftConversation?.protocol ?? rightConversation?.applicationProtocol ?? rightConversation?.protocol ?? 'UNKNOWN',
      frameDelta: leftConversation && rightConversation ? rightConversation.frameCount - leftConversation.frameCount : null,
      capturedByteDelta: leftConversation && rightConversation ? rightConversation.capturedBytes - leftConversation.capturedBytes : null,
      durationDeltaNanoseconds: leftConversation && rightConversation ? rightConversation.durationNanoseconds - leftConversation.durationNanoseconds : null,
    });
  });
  const leftKinds = eventKindCounts(left);
  const rightKinds = eventKindCounts(right);
  const eventKinds = [...new Set([...leftKinds.keys(), ...rightKinds.keys()])].sort();
  return deepFreeze({
    leftCaptureId: left.metadata.captureId,
    rightCaptureId: right.metadata.captureId,
    frameDelta: right.metadata.frameCount - left.metadata.frameCount,
    capturedByteDelta: right.metadata.byteLength - left.metadata.byteLength,
    conversationDelta: right.metadata.conversationCount - left.metadata.conversationCount,
    eventDelta: right.metadata.eventCount - left.metadata.eventCount,
    flows,
    eventKindDelta: eventKinds.map((kind) => ({ kind, delta: (rightKinds.get(kind) ?? 0) - (leftKinds.get(kind) ?? 0) })),
    provenance: 'INFERRED',
    boundary: 'This comparison is a deterministic diff between two independent captures. A delta means the evidence differs; it does not claim why the network changed.',
  });
}
