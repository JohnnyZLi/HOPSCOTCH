import { CaptureParseError, deepFreeze } from './bytes.ts';
import { parseCaptureContainer } from './container.ts';
import { decodeCapturedFrame, endpointDisplay } from './protocol.ts';
import { CAPTURE_LIMITS } from './types.ts';
import type {
  CaptureConversation,
  CaptureProvenance,
  CaptureSessionMetadata,
  CapturedEndpoint,
  CapturedEventKind,
  CapturedEventLineage,
  CapturedFieldReference,
  CapturedFrameEvidence,
  CapturedLineageField,
  CapturedTcpFacts,
  ConversationDirection,
  ConversationFrameReference,
  ConversationProtocol,
  ParsedCaptureContainer,
  SemanticCapturedEvent,
} from './types.ts';

type ConversationDraft = {
  key: string;
  id: string;
  transportKind: 'tcp' | 'udp' | 'icmp' | 'icmpv6';
  endpointA: CapturedEndpoint;
  endpointB: CapturedEndpoint;
  frameReferences: ConversationFrameReference[];
  frames: CapturedFrameEvidence[];
  directionByFrameId: Map<string, ConversationDirection>;
};

type EventDraft = SemanticCapturedEvent & { readonly sortPriority: number; readonly sourceOrder: number };

export interface CaptureTimelineProjection {
  readonly conversationId: string;
  readonly requestedTimeNanoseconds: bigint;
  readonly clampedTimeNanoseconds: bigint;
  readonly currentEvent: SemanticCapturedEvent | null;
  readonly currentEventIndex: number;
  readonly completedEventIds: readonly string[];
}

const EMPTY_CAPTURE_EVENTS: readonly SemanticCapturedEvent[] = Object.freeze([]);

function requireSemanticCapacity(events: readonly EventDraft[]): void {
  if (events.length > CAPTURE_LIMITS.maxSemanticEvents) {
    throw new CaptureParseError('SEMANTIC_LIMIT_EXCEEDED', `Capture interpretation exceeds the explicit ${CAPTURE_LIMITS.maxSemanticEvents.toLocaleString()} semantic-event ceiling`);
  }
}

function stableHash(value: string): string {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= BigInt(value.charCodeAt(index));
    hash = (hash * prime) & mask;
  }
  return hash.toString(16).padStart(16, '0');
}

function endpointKey(endpoint: CapturedEndpoint): string {
  return `${endpoint.family}|${endpoint.address.toLowerCase()}|${endpoint.port === null ? '-' : endpoint.port.toString().padStart(5, '0')}`;
}

function compareEndpoints(left: CapturedEndpoint, right: CapturedEndpoint): number {
  return endpointKey(left).localeCompare(endpointKey(right));
}

function descriptorForFrame(frame: CapturedFrameEvidence): {
  key: string;
  transportKind: ConversationDraft['transportKind'];
  endpointA: CapturedEndpoint;
  endpointB: CapturedEndpoint;
  direction: ConversationDirection;
} | null {
  const transport = frame.transport;
  if (!transport) return null;
  const source = transport.source;
  const destination = transport.destination;
  const ordered = compareEndpoints(source, destination) <= 0;
  const endpointA = ordered ? source : destination;
  const endpointB = ordered ? destination : source;
  const direction: ConversationDirection = ordered ? 'A_TO_B' : 'B_TO_A';
  const identifier = transport.icmp?.identifier ?? '-';
  const key = transport.kind === 'icmp' || transport.kind === 'icmpv6'
    ? `${transport.kind}|${endpointKey(endpointA)}|${endpointKey(endpointB)}|echo-id:${identifier}`
    : `${transport.kind}|${endpointKey(endpointA)}|${endpointKey(endpointB)}`;
  return { key, transportKind: transport.kind, endpointA, endpointB, direction };
}

function buildConversationDrafts(inputFrames: readonly CapturedFrameEvidence[]): ConversationDraft[] {
  const frames = [...inputFrames].sort((a, b) => a.record.sourceOrder - b.record.sourceOrder);
  const byKey = new Map<string, ConversationDraft>();
  for (const frame of frames) {
    const descriptor = descriptorForFrame(frame);
    if (!descriptor) continue;
    let draft = byKey.get(descriptor.key);
    if (!draft) {
      draft = {
        key: descriptor.key,
        id: `conversation-${stableHash(descriptor.key)}`,
        transportKind: descriptor.transportKind,
        endpointA: descriptor.endpointA,
        endpointB: descriptor.endpointB,
        frameReferences: [],
        frames: [],
        directionByFrameId: new Map(),
      };
      byKey.set(descriptor.key, draft);
    }
    draft.frames.push(frame);
    draft.directionByFrameId.set(frame.record.id, descriptor.direction);
    draft.frameReferences.push({
      frameId: frame.record.id,
      frameNumber: frame.record.number,
      direction: descriptor.direction,
      relativeTimeNanoseconds: frame.record.relativeTimeNanoseconds,
      capturedLength: frame.record.capturedLength,
    });
  }
  return [...byKey.values()].sort((a, b) => {
    const aTime = a.frames[0]?.record.relativeTimeNanoseconds ?? 0n;
    const bTime = b.frames[0]?.record.relativeTimeNanoseconds ?? 0n;
    return aTime < bTime ? -1 : aTime > bTime ? 1 : a.key.localeCompare(b.key);
  });
}

function directionForFrame(draft: ConversationDraft, frame: CapturedFrameEvidence): ConversationDirection {
  return draft.directionByFrameId.get(frame.record.id) ?? 'A_TO_B';
}

function reference(frame: CapturedFrameEvidence, layerId: string, fieldId: string): CapturedFieldReference {
  return { frameId: frame.record.id, layerId, fieldId };
}

function firstFieldReference(frame: CapturedFrameEvidence, predicate: (fieldId: string) => boolean): CapturedFieldReference | null {
  for (const layer of frame.layers) {
    const found = layer.fields.find((candidate) => predicate(candidate.id));
    if (found) return reference(frame, layer.id, found.id);
  }
  return null;
}

function uniqueFrameIds(frames: readonly CapturedFrameEvidence[]): readonly string[] {
  return [...new Set([...frames].sort((a, b) => a.record.sourceOrder - b.record.sourceOrder).map((frame) => frame.record.id))];
}

function eventDraft(
  draft: ConversationDraft,
  frame: CapturedFrameEvidence,
  suffix: string,
  kind: CapturedEventKind,
  title: string,
  summary: string,
  detail: string,
  provenance: CaptureProvenance,
  fields: readonly (CapturedFieldReference | null)[],
  supportingFrames: readonly CapturedFrameEvidence[] = [frame],
  uncertainty: string | null = null,
  sortPriority = 10,
): EventDraft {
  return {
    id: `${draft.id}:${frame.record.id}:${suffix}`,
    conversationId: draft.id,
    kind,
    title,
    summary,
    detail,
    relativeTimeNanoseconds: frame.record.relativeTimeNanoseconds,
    relativeTimeMs: frame.record.relativeTimeMs,
    primaryFrameId: frame.record.id,
    supportingFrameIds: uniqueFrameIds([...supportingFrames]),
    fieldReferences: fields.filter((entry): entry is CapturedFieldReference => entry !== null),
    direction: directionForFrame(draft, frame),
    provenance,
    uncertainty,
    sortPriority,
    sourceOrder: frame.record.sourceOrder,
  };
}

type SequenceRange = { start: bigint; end: bigint; frame: CapturedFrameEvidence };
type SequenceInterval = { start: bigint; end: bigint; witnesses: SequenceRange[] };
type SequenceTracker = {
  intervals: SequenceInterval[];
  exactRanges: Map<string, SequenceRange>;
  saturated: boolean;
};

function sequenceKey(start: bigint, end: bigint): string {
  return `${start}:${end}`;
}

function sequenceObservation(
  tracker: SequenceTracker,
  start: bigint,
  end: bigint,
  frame: CapturedFrameEvidence,
): { retransmission: SequenceRange | null; overlap: SequenceRange | null; saturatedNow: boolean } {
  const exact = tracker.exactRanges.get(sequenceKey(start, end)) ?? null;
  let low = 0;
  let high = tracker.intervals.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if ((tracker.intervals[middle]?.end ?? 0n) < start) low = middle + 1;
    else high = middle;
  }
  const first = low;
  let last = first;
  let overlap: SequenceRange | null = null;
  let covering: SequenceRange | null = exact;
  let mergedStart = start;
  let mergedEnd = end;
  const witnesses: SequenceRange[] = [];
  while (last < tracker.intervals.length) {
    const interval = tracker.intervals[last];
    if (!interval || interval.start > mergedEnd) break;
    mergedStart = interval.start < mergedStart ? interval.start : mergedStart;
    mergedEnd = interval.end > mergedEnd ? interval.end : mergedEnd;
    for (const witness of interval.witnesses) {
      if (!overlap && start < witness.end && end > witness.start) overlap = witness;
      if (!covering && witness.start <= start && witness.end >= end) covering = witness;
      witnesses.push(witness);
    }
    last += 1;
  }

  const observation = { start, end, frame };
  if (!tracker.exactRanges.has(sequenceKey(start, end))) tracker.exactRanges.set(sequenceKey(start, end), observation);
  const createsInterval = last === first;
  if (createsInterval && tracker.intervals.length >= CAPTURE_LIMITS.maxTcpSequenceIntervalsPerDirection) {
    const saturatedNow = !tracker.saturated;
    tracker.saturated = true;
    return { retransmission: covering, overlap, saturatedNow };
  }

  const mergedWitnesses = [...witnesses, observation]
    .sort((left, right) => left.frame.record.sourceOrder - right.frame.record.sourceOrder)
    .slice(-16);
  tracker.intervals.splice(first, last - first, { start: mergedStart, end: mergedEnd, witnesses: mergedWitnesses });
  return { retransmission: covering, overlap, saturatedNow: false };
}

function addTcpEvents(draft: ConversationDraft, events: EventDraft[], warnings: string[]): void {
  const sequenceTrackers: Record<ConversationDirection, SequenceTracker> = {
    A_TO_B: { intervals: [], exactRanges: new Map(), saturated: false },
    B_TO_A: { intervals: [], exactRanges: new Map(), saturated: false },
  };
  const expected: Record<ConversationDirection, bigint | null> = { A_TO_B: null, B_TO_A: null };
  const lastPureAck: Record<ConversationDirection, { acknowledgment: number; frame: CapturedFrameEvidence } | null> = { A_TO_B: null, B_TO_A: null };
  let synFrame: CapturedFrameEvidence | null = null;
  let synAckFrame: CapturedFrameEvidence | null = null;
  let establishmentEmitted = false;

  for (const frame of draft.frames) {
    const tcp = frame.transport?.tcp;
    if (!tcp) continue;
    const direction = directionForFrame(draft, frame);
    const opposite: ConversationDirection = direction === 'A_TO_B' ? 'B_TO_A' : 'A_TO_B';
    const source = endpointDisplay(frame.transport?.source ?? draft.endpointA);
    const destination = endpointDisplay(frame.transport?.destination ?? draft.endpointB);
    const flagRef = reference(frame, 'tcp', 'tcp.flags');
    const sequenceRef = reference(frame, 'tcp', 'tcp.sequence');
    const acknowledgmentRef = reference(frame, 'tcp', 'tcp.acknowledgment');
    const payloadLength = tcp.payloadRange.length;
    let kind: CapturedEventKind;
    let suffix: string;
    let title: string;
    let summary: string;
    if (tcp.flags.rst) {
      kind = 'tcp.rst'; suffix = 'rst'; title = 'TCP · RST'; summary = `${source} reset the observed TCP conversation.`;
    } else if (tcp.flags.syn && tcp.flags.ack) {
      kind = 'tcp.syn-ack'; suffix = 'syn-ack'; title = 'TCP · SYN/ACK'; summary = `${source} acknowledged a captured SYN and advertised sequence ${tcp.sequenceNumber}.`;
      synAckFrame = frame;
    } else if (tcp.flags.syn) {
      kind = 'tcp.syn'; suffix = 'syn'; title = 'TCP · SYN'; summary = `${source} opened an observed TCP sequence toward ${destination}.`;
      if (!synFrame) synFrame = frame;
      expected[direction] = BigInt(tcp.sequenceNumber) + 1n;
    } else if (tcp.flags.fin) {
      kind = 'tcp.fin'; suffix = 'fin'; title = 'TCP · FIN'; summary = `${source} advertised an observed end of stream.`;
    } else if (payloadLength > 0) {
      kind = 'tcp.data'; suffix = 'data'; title = 'TCP · DATA'; summary = `${source} carried ${payloadLength} captured payload bytes at sequence ${tcp.sequenceNumber}.`;
    } else {
      kind = 'tcp.ack'; suffix = 'ack'; title = 'TCP · ACK'; summary = `${source} acknowledged through sequence ${tcp.acknowledgmentNumber}.`;
    }
    events.push(eventDraft(
      draft,
      frame,
      suffix,
      kind,
      title,
      summary,
      `Frame ${frame.record.number} directly encodes ${flagLabelForDetail(tcp.flags)} with captured sequence ${tcp.sequenceNumber} and acknowledgment ${tcp.acknowledgmentNumber}.`,
      'CAPTURED',
      [flagRef, sequenceRef, acknowledgmentRef],
    ));

    if (!establishmentEmitted && synFrame && synAckFrame && tcp.flags.ack && !tcp.flags.syn && payloadLength === 0
      && synFrame.record.sourceOrder < synAckFrame.record.sourceOrder
      && synAckFrame.record.sourceOrder < frame.record.sourceOrder
      && directionForFrame(draft, synFrame) === direction && directionForFrame(draft, synAckFrame) === opposite) {
      events.push(eventDraft(
        draft,
        frame,
        'established-observed',
        'tcp.established-observed',
        'TCP · OBSERVED ESTABLISHMENT',
        'The capture contains a SYN → SYN/ACK → ACK progression for this conversation.',
        'This is a deterministic interpretation of three captured frames, not proof that traffic outside the capture point was complete.',
        'INFERRED',
        [reference(synFrame, 'tcp', 'tcp.flags'), reference(synAckFrame, 'tcp', 'tcp.flags'), flagRef],
        [synFrame, synAckFrame, frame],
        'Observed from one capture vantage point.',
        20,
      ));
      establishmentEmitted = true;
    }

    const pureAck = tcp.flags.ack && !tcp.flags.syn && !tcp.flags.fin && !tcp.flags.rst && payloadLength === 0;
    if (pureAck) {
      const previous = lastPureAck[direction];
      if (previous?.acknowledgment === tcp.acknowledgmentNumber) {
        events.push(eventDraft(
          draft,
          frame,
          'duplicate-ack-observed',
          'tcp.duplicate-ack-observed',
          'TCP · DUPLICATE ACK OBSERVED',
          `Acknowledgment ${tcp.acknowledgmentNumber} was captured again in the same direction.`,
          'The repeated acknowledgment field is visible in both frames. Window updates or capture artifacts may still affect interpretation.',
          'INFERRED',
          [acknowledgmentRef, reference(previous.frame, 'tcp', 'tcp.acknowledgment')],
          [previous.frame, frame],
          'A repeated ACK at one vantage point is not by itself proof of network loss.',
          21,
        ));
      }
      lastPureAck[direction] = { acknowledgment: tcp.acknowledgmentNumber, frame };
    }

    if (payloadLength > 0) {
      const start = BigInt(tcp.sequenceNumber);
      const end = start + BigInt(payloadLength);
      if (end <= 0x1_0000_0000n) {
        const observation = sequenceObservation(sequenceTrackers[direction], start, end, frame);
        if (observation.saturatedNow && warnings.length < 64) {
          warnings.push(`${draft.id}: TCP overlap inference reached the explicit ${CAPTURE_LIMITS.maxTcpSequenceIntervalsPerDirection.toLocaleString()} disjoint-range ceiling in one direction; all frames remain captured and exact-range repeats remain indexed.`);
        }
        const previousExpected = expected[direction];
        if (previousExpected !== null && start > previousExpected) {
          events.push(eventDraft(
            draft,
            frame,
            'sequence-gap-visible',
            'tcp.sequence-gap-visible',
            'TCP · CAPTURE-VISIBLE SEQUENCE GAP',
            `The next captured payload begins at ${start}; the contiguous observed range ended at ${previousExpected}.`,
            'The sequence-number bytes support an apparent gap in this capture. Missing capture data, offload, or an incomplete vantage can produce the same observation.',
            'INFERRED',
            [sequenceRef],
            [frame],
            'This does not claim that the network dropped a packet.',
            22,
          ));
        }
        if (observation.retransmission) {
          const supporting = [observation.retransmission.frame];
          events.push(eventDraft(
            draft,
            frame,
            'retransmission-observed',
            'tcp.retransmission-observed',
            'TCP · OBSERVED RETRANSMISSION',
            `Captured bytes ${start}–${end - 1n} repeat a previously observed sequence range.`,
            'The same directional sequence range was captured earlier. HOPSCOTCH labels the capture-visible repetition without asserting where or why retransmission occurred.',
            'INFERRED',
            [sequenceRef, ...supporting.map((seen) => reference(seen, 'tcp', 'tcp.sequence'))],
            [...supporting, frame],
            'Capture offload or duplicated capture delivery can mimic retransmission.',
            23,
          ));
        } else if (observation.overlap) {
          const supporting = observation.overlap.frame;
          events.push(eventDraft(
            draft,
            frame,
            'overlap-observed',
            'tcp.overlap-observed',
            'TCP · OVERLAPPING SEQUENCE RANGE',
            `Captured bytes ${start}–${end - 1n} overlap earlier payload bytes.`,
            'The overlap is derived from captured sequence fields and payload lengths; no loss location is inferred.',
            'INFERRED',
            [sequenceRef, reference(supporting, 'tcp', 'tcp.sequence')],
            [supporting, frame],
            'One capture vantage cannot prove a global loss or delivery outcome.',
            23,
          ));
        }
        expected[direction] = previousExpected === null ? end : end > previousExpected ? end : previousExpected;
      }
    }

    if (frame.tls) {
      frame.tls.records.forEach((record, recordIndex) => {
        const hello = record.hello;
        if (!hello) return;
        const client = hello.kind === 'client-hello';
        const helloRef = firstFieldReference(frame, (id) => id.startsWith(`tls-record-${recordIndex}.handshake-`));
        const sniRef = firstFieldReference(frame, (id) => id === `tls-record-${recordIndex}.hello.sni`);
        events.push(eventDraft(
          draft,
          frame,
          `${client ? 'tls-client-hello' : 'tls-server-hello'}-${recordIndex}`,
          client ? 'tls.client-hello' : 'tls.server-hello',
          client ? 'TLS · CLIENT HELLO' : 'TLS · SERVER HELLO',
          client
            ? `A captured ClientHello${hello.serverName ? ` exposes SNI ${hello.serverName}` : ''}.`
            : `A captured ServerHello selected ${hello.supportedVersions[0] ?? hello.legacyVersion}${hello.selectedCipherSuite ? ` with ${hello.selectedCipherSuite}` : ''}.`,
          'Only capture-visible TLS handshake metadata is decoded. Encrypted application data, secrets, and uncaptured handshake steps remain unknown.',
          'CAPTURED',
          [helloRef, sniRef],
          [frame],
          null,
          30,
        ));
      });
    }
    requireSemanticCapacity(events);
  }
}

function flagLabelForDetail(flags: CapturedTcpFacts['flags']): string {
  if (!flags || typeof flags !== 'object') return 'TCP state';
  const active = Object.entries(flags as Record<string, boolean>).filter(([, value]) => value).map(([key]) => key.toUpperCase());
  return active.length > 0 ? active.join(', ') : 'no control flags';
}

function addNonTcpEvents(draft: ConversationDraft, events: EventDraft[]): void {
  for (const frame of draft.frames) {
    const transport = frame.transport;
    if (!transport || transport.kind === 'tcp') continue;
    if (frame.dns) {
      const question = frame.dns.questions[0]?.name ?? 'name not present';
      const response = frame.dns.isResponse;
      events.push(eventDraft(
        draft,
        frame,
        response ? 'dns-response' : 'dns-query',
        response ? 'dns.response' : 'dns.query',
        response ? 'DNS · RESPONSE' : 'DNS · QUERY',
        response
          ? `Transaction ${hexTransaction(frame.dns.transactionId)} contains ${frame.dns.answers.length} captured answer record${frame.dns.answers.length === 1 ? '' : 's'}.`
          : `Transaction ${hexTransaction(frame.dns.transactionId)} asks for ${question}.`,
        response
          ? 'This event says only that a response exists in the capture; answer absence is not automatically labeled DNS failure.'
          : 'The DNS header and question bytes are directly present in this frame.',
        'CAPTURED',
        [reference(frame, 'dns', 'dns.transaction-id'), reference(frame, 'dns', 'dns.query-response'), firstFieldReference(frame, (id) => id === 'dns.question-0.name')],
      ));
      requireSemanticCapacity(events);
      continue;
    }
    if (transport.kind === 'udp') {
      events.push(eventDraft(
        draft,
        frame,
        'udp-datagram',
        'udp.datagram',
        'UDP · DATAGRAM',
        `${endpointDisplay(transport.source)} sent ${transport.udp?.payloadRange.length ?? 0} captured payload bytes to ${endpointDisplay(transport.destination)}.`,
        'Source/destination ports and UDP length are directly captured; application meaning is not guessed.',
        'CAPTURED',
        [reference(frame, 'udp', 'udp.source-port'), reference(frame, 'udp', 'udp.destination-port'), reference(frame, 'udp', 'udp.length')],
      ));
      requireSemanticCapacity(events);
      continue;
    }
    const icmp = transport.icmp;
    if (!icmp) continue;
    let kind: CapturedEventKind = 'icmp.message';
    let title = `${transport.kind.toUpperCase()} · MESSAGE`;
    const family = transport.source.family;
    if ((family === 'ipv4' && icmp.type === 8) || (family === 'ipv6' && icmp.type === 128)) { kind = 'icmp.echo-request'; title = `${transport.kind.toUpperCase()} · ECHO REQUEST`; }
    else if ((family === 'ipv4' && icmp.type === 0) || (family === 'ipv6' && icmp.type === 129)) { kind = 'icmp.echo-reply'; title = `${transport.kind.toUpperCase()} · ECHO REPLY`; }
    else if ((family === 'ipv4' && icmp.type === 3) || (family === 'ipv6' && icmp.type === 1)) { kind = 'icmp.destination-unreachable'; title = `${transport.kind.toUpperCase()} · DESTINATION UNREACHABLE`; }
    else if ((family === 'ipv4' && icmp.type === 11) || (family === 'ipv6' && icmp.type === 3)) { kind = 'icmp.time-exceeded'; title = `${transport.kind.toUpperCase()} · TIME EXCEEDED`; }
    else if (family === 'ipv6' && icmp.type === 2) { kind = 'icmp.packet-too-big'; title = 'ICMPV6 · PACKET TOO BIG'; }
    events.push(eventDraft(
      draft,
      frame,
      kind.replaceAll('.', '-'),
      kind,
      title,
      `${icmp.label} was captured from ${transport.source.address} to ${transport.destination.address}.`,
      'The ICMP type/code is directly captured. Any triggering packet is unknown unless its embedded bytes are separately present and decoded.',
      'CAPTURED',
      [reference(frame, transport.kind, 'icmp.type'), reference(frame, transport.kind, 'icmp.code')],
    ));
    requireSemanticCapacity(events);
  }
}

function hexTransaction(value: number): string {
  return `0x${value.toString(16).padStart(4, '0').toUpperCase()}`;
}

function sortEvents(events: readonly EventDraft[]): readonly SemanticCapturedEvent[] {
  return Object.freeze([...events].sort((a, b) => {
    if (a.relativeTimeNanoseconds !== b.relativeTimeNanoseconds) return a.relativeTimeNanoseconds < b.relativeTimeNanoseconds ? -1 : 1;
    if (a.sourceOrder !== b.sourceOrder) return a.sourceOrder - b.sourceOrder;
    if (a.sortPriority !== b.sortPriority) return a.sortPriority - b.sortPriority;
    return a.id.localeCompare(b.id);
  }).map(({ sortPriority: _sortPriority, sourceOrder: _sourceOrder, ...event }) => deepFreeze(event)));
}

function observedInitiator(draft: ConversationDraft): 'A' | 'B' | null {
  for (const frame of draft.frames) {
    const direction = directionForFrame(draft, frame);
    const tcp = frame.transport?.tcp;
    if (tcp?.flags.syn && !tcp.flags.ack) return direction === 'A_TO_B' ? 'A' : 'B';
    if (frame.dns && !frame.dns.isResponse) return direction === 'A_TO_B' ? 'A' : 'B';
    const icmp = frame.transport?.icmp;
    if (icmp && ((frame.ipFamily === 'ipv4' && icmp.type === 8) || (frame.ipFamily === 'ipv6' && icmp.type === 128))) return direction === 'A_TO_B' ? 'A' : 'B';
  }
  return null;
}

function finalizeConversations(drafts: readonly ConversationDraft[], events: readonly SemanticCapturedEvent[]): readonly CaptureConversation[] {
  const eventsByConversation = new Map<string, string[]>();
  for (const event of events) {
    const ids = eventsByConversation.get(event.conversationId) ?? [];
    ids.push(event.id);
    eventsByConversation.set(event.conversationId, ids);
  }
  return Object.freeze(drafts.map((draft) => {
    const first = draft.frames.reduce((current, frame) => frame.record.relativeTimeNanoseconds < current ? frame.record.relativeTimeNanoseconds : current, draft.frames[0]?.record.relativeTimeNanoseconds ?? 0n);
    const last = draft.frames.reduce((current, frame) => frame.record.relativeTimeNanoseconds > current ? frame.record.relativeTimeNanoseconds : current, first);
    const directionCounts = draft.frameReferences.reduce<Record<ConversationDirection, number>>((counts, entry) => {
      counts[entry.direction] += 1;
      return counts;
    }, { A_TO_B: 0, B_TO_A: 0 });
    const hasDns = draft.frames.some((frame) => frame.dns !== null);
    const hasTls = draft.frames.some((frame) => frame.tls !== null);
    const protocol: ConversationProtocol = hasDns ? 'DNS'
      : draft.transportKind === 'tcp' ? 'TCP'
        : draft.transportKind === 'udp' ? 'UDP'
          : draft.transportKind === 'icmp' ? 'ICMP' : 'ICMPV6';
    const applicationProtocol: CaptureConversation['applicationProtocol'] = hasDns ? 'DNS' : hasTls ? 'TLS' : null;
    const tcpHasSyn = draft.frames.some((frame) => frame.transport?.tcp?.flags.syn);
    return deepFreeze<CaptureConversation>({
      id: draft.id,
      key: draft.key,
      protocol,
      applicationProtocol,
      endpointA: draft.endpointA,
      endpointB: draft.endpointB,
      frameReferences: [...draft.frameReferences].sort((a, b) => a.relativeTimeNanoseconds < b.relativeTimeNanoseconds ? -1 : a.relativeTimeNanoseconds > b.relativeTimeNanoseconds ? 1 : a.frameNumber - b.frameNumber),
      eventIds: eventsByConversation.get(draft.id) ?? [],
      frameCount: draft.frames.length,
      capturedBytes: draft.frames.reduce((sum, frame) => sum + frame.record.capturedLength, 0),
      directionCounts,
      firstObservedNanoseconds: first,
      lastObservedNanoseconds: last,
      durationNanoseconds: last - first,
      observedInitiator: observedInitiator(draft),
      captureStartedMidConversation: draft.transportKind === 'tcp' && !tcpHasSyn,
      oneDirectionOnly: directionCounts.A_TO_B === 0 || directionCounts.B_TO_A === 0,
      truncatedFrameCount: draft.frames.filter((frame) => frame.record.truncated).length,
      provenance: 'INFERRED',
    });
  }));
}

function buildEvents(drafts: readonly ConversationDraft[]): { events: readonly SemanticCapturedEvent[]; warnings: readonly string[] } {
  const events: EventDraft[] = [];
  const warnings: string[] = [];
  for (const draft of drafts) {
    if (draft.transportKind === 'tcp') addTcpEvents(draft, events, warnings);
    else addNonTcpEvents(draft, events);
  }
  return { events: sortEvents(events), warnings: Object.freeze(warnings) };
}

function buildMetadata(container: ParsedCaptureContainer, frames: readonly CapturedFrameEvidence[], conversations: readonly CaptureConversation[], events: readonly SemanticCapturedEvent[]): CaptureSessionMetadata {
  let first = frames[0]?.record.timestamp ?? null;
  let last = first;
  for (const frame of frames) {
    if (!first || frame.record.timestamp.epochNanoseconds < first.epochNanoseconds) first = frame.record.timestamp;
    if (!last || frame.record.timestamp.epochNanoseconds > last.epochNanoseconds) last = frame.record.timestamp;
  }
  return deepFreeze({
    captureId: container.captureId,
    format: container.format,
    byteLength: container.byteLength,
    frameCount: frames.length,
    conversationCount: conversations.length,
    eventCount: events.length,
    interfaceCount: container.interfaces.length,
    firstTimestamp: first,
    lastTimestamp: last,
    durationNanoseconds: first && last ? last.epochNanoseconds - first.epochNanoseconds : 0n,
    truncatedFrameCount: frames.filter((frame) => frame.record.truncated).length,
    unsupportedFrameCount: frames.filter((frame) => frame.record.linkType !== 1).length,
  });
}

export class CaptureSessionIndex {
  readonly container: ParsedCaptureContainer;
  readonly metadata: CaptureSessionMetadata;
  readonly frames: readonly CapturedFrameEvidence[];
  readonly conversations: readonly CaptureConversation[];
  readonly events: readonly SemanticCapturedEvent[];
  readonly warnings: readonly string[];
  readonly #framesById: ReadonlyMap<string, CapturedFrameEvidence>;
  readonly #conversationsById: ReadonlyMap<string, CaptureConversation>;
  readonly #eventsById: ReadonlyMap<string, SemanticCapturedEvent>;
  readonly #eventsByConversationId: ReadonlyMap<string, readonly SemanticCapturedEvent[]>;
  readonly #framesByNumber: ReadonlyMap<number, CapturedFrameEvidence>;
  readonly #conversationIdByFrameId: ReadonlyMap<string, string>;

  constructor(
    container: ParsedCaptureContainer,
    frames: readonly CapturedFrameEvidence[],
    conversations: readonly CaptureConversation[],
    events: readonly SemanticCapturedEvent[],
    semanticWarnings: readonly string[] = [],
  ) {
    const decoderNotes: string[] = [];
    for (const frame of frames) {
      for (const issue of frame.issues) {
        decoderNotes.push(issue);
        if (decoderNotes.length >= 64) break;
      }
      if (decoderNotes.length >= 64) break;
    }
    this.container = container;
    this.frames = Object.freeze([...frames]);
    this.conversations = Object.freeze([...conversations]);
    this.events = Object.freeze([...events]);
    this.metadata = buildMetadata(container, frames, conversations, events);
    this.warnings = Object.freeze([...new Set([
      ...container.warnings,
      ...(this.metadata.truncatedFrameCount > 0 ? [`${this.metadata.truncatedFrameCount} frame(s) are shorter than their original wire length.`] : []),
      ...semanticWarnings,
      ...decoderNotes,
    ])]);
    this.#framesById = new Map(frames.map((frame) => [frame.record.id, frame]));
    this.#conversationsById = new Map(conversations.map((conversation) => [conversation.id, conversation]));
    this.#eventsById = new Map(events.map((event) => [event.id, event]));
    this.#eventsByConversationId = new Map(conversations.map((conversation) => [
      conversation.id,
      Object.freeze(conversation.eventIds.map((id) => this.#eventsById.get(id)).filter((entry): entry is SemanticCapturedEvent => entry !== undefined)),
    ]));
    this.#framesByNumber = new Map(frames.map((frame) => [frame.record.number, frame]));
    this.#conversationIdByFrameId = new Map(conversations.flatMap((conversation) => conversation.frameReferences.map((frame) => [frame.frameId, conversation.id] as const)));
    Object.freeze(this);
  }

  frame(frameId: string): CapturedFrameEvidence | null {
    return this.#framesById.get(frameId) ?? null;
  }

  frameByNumber(frameNumber: number): CapturedFrameEvidence | null {
    return this.#framesByNumber.get(frameNumber) ?? null;
  }

  conversation(conversationId: string): CaptureConversation | null {
    return this.#conversationsById.get(conversationId) ?? null;
  }

  conversationForFrame(frameId: string): CaptureConversation | null {
    const conversationId = this.#conversationIdByFrameId.get(frameId);
    return conversationId ? this.conversation(conversationId) : null;
  }

  event(eventId: string): SemanticCapturedEvent | null {
    return this.#eventsById.get(eventId) ?? null;
  }

  eventsForConversation(conversationId: string): readonly SemanticCapturedEvent[] {
    return this.#eventsByConversationId.get(conversationId) ?? EMPTY_CAPTURE_EVENTS;
  }

  projectionAt(conversationId: string, requestedTimeNanoseconds: bigint): CaptureTimelineProjection {
    const conversation = this.conversation(conversationId);
    const events = this.eventsForConversation(conversationId);
    const maxTime = conversation?.lastObservedNanoseconds ?? 0n;
    const clampedTimeNanoseconds = requestedTimeNanoseconds < 0n ? 0n : requestedTimeNanoseconds > maxTime ? maxTime : requestedTimeNanoseconds;
    let low = 0;
    let high = events.length - 1;
    let found = -1;
    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      const event = events[middle];
      if (event && event.relativeTimeNanoseconds <= clampedTimeNanoseconds) { found = middle; low = middle + 1; }
      else high = middle - 1;
    }
    return deepFreeze({
      conversationId,
      requestedTimeNanoseconds,
      clampedTimeNanoseconds,
      currentEvent: found >= 0 ? events[found] ?? null : null,
      currentEventIndex: found,
      completedEventIds: events.slice(0, found + 1).map((event) => event.id),
    });
  }

  eventAtOrBefore(conversationId: string, requestedTimeNanoseconds: bigint): SemanticCapturedEvent | null {
    const events = this.eventsForConversation(conversationId);
    let low = 0;
    let high = events.length - 1;
    let found = -1;
    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      const event = events[middle];
      if (event && event.relativeTimeNanoseconds <= requestedTimeNanoseconds) { found = middle; low = middle + 1; }
      else high = middle - 1;
    }
    return found >= 0 ? events[found] ?? null : null;
  }

  eventBefore(conversationId: string, eventId: string | null): SemanticCapturedEvent | null {
    const events = this.eventsForConversation(conversationId);
    const index = eventId ? events.findIndex((event) => event.id === eventId) : -1;
    return events[Math.max(0, index - 1)] ?? null;
  }

  eventAfter(conversationId: string, eventId: string | null): SemanticCapturedEvent | null {
    const events = this.eventsForConversation(conversationId);
    const index = eventId ? events.findIndex((event) => event.id === eventId) : -1;
    return events[Math.min(events.length - 1, index + 1)] ?? null;
  }

  lineage(eventId: string): CapturedEventLineage | null {
    const event = this.event(eventId);
    if (!event) return null;
    const fields: CapturedLineageField[] = [];
    for (const fieldReference of event.fieldReferences) {
      const frame = this.frame(fieldReference.frameId);
      const capturedLayer = frame?.layers.find((candidate) => candidate.id === fieldReference.layerId);
      const capturedField = capturedLayer?.fields.find((candidate) => candidate.id === fieldReference.fieldId);
      if (!frame || !capturedLayer || !capturedField) continue;
      fields.push({
        frameId: frame.record.id,
        frameNumber: frame.record.number,
        layerId: capturedLayer.id,
        layerLabel: capturedLayer.label,
        fieldId: capturedField.id,
        fieldLabel: capturedField.label,
        displayValue: capturedField.displayValue,
        byteRanges: capturedField.byteRanges,
        bytes: capturedField.byteRanges.map((byteRange) => frame.record.bytes.hex(byteRange.offset, byteRange.length)),
        provenance: 'CAPTURED',
      });
    }
    return deepFreeze({
      conversationId: event.conversationId,
      eventId: event.id,
      provenance: event.provenance,
      frameIds: event.supportingFrameIds,
      fields,
    });
  }
}

export function buildCaptureSessionFromContainer(container: ParsedCaptureContainer): CaptureSessionIndex {
  const frames = Object.freeze(container.frames.map((frame) => decodeCapturedFrame(frame)));
  const drafts = buildConversationDrafts(frames);
  const { events, warnings } = buildEvents(drafts);
  const conversations = finalizeConversations(drafts, events);
  return new CaptureSessionIndex(container, frames, conversations, events, warnings);
}

export function parseCaptureSession(input: ArrayBuffer | ArrayBufferView | Uint8Array): CaptureSessionIndex {
  return buildCaptureSessionFromContainer(parseCaptureContainer(input));
}

export function buildConversationIndex(frames: readonly CapturedFrameEvidence[]): readonly CaptureConversation[] {
  const drafts = buildConversationDrafts(frames);
  const { events } = buildEvents(drafts);
  return finalizeConversations(drafts, events);
}
