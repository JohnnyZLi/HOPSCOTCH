import { ImmutableBytes, deepFreeze } from './bytes.ts';
import { CaptureSessionIndex } from './session.ts';
import type {
  CaptureConversation,
  CaptureInterfaceRecord,
  CapturedFrameEvidence,
  CapturedFrameRecord,
  ParsedCaptureContainer,
  SemanticCapturedEvent,
} from './types.ts';

type WireFrameRecord = Omit<CapturedFrameRecord, 'bytes'> & {
  readonly slabOffset: number;
  readonly slabLength: number;
};

type WireFrameEvidence = Omit<CapturedFrameEvidence, 'record'> & {
  readonly record: WireFrameRecord;
};

export interface CaptureSessionWire {
  readonly container: {
    readonly format: ParsedCaptureContainer['format'];
    readonly byteOrder: ParsedCaptureContainer['byteOrder'];
    readonly captureId: string;
    readonly byteLength: number;
    readonly interfaces: readonly CaptureInterfaceRecord[];
    readonly warnings: readonly string[];
  };
  readonly frames: readonly WireFrameEvidence[];
  readonly conversations: readonly CaptureConversation[];
  readonly events: readonly SemanticCapturedEvent[];
  readonly warnings: readonly string[];
  readonly byteSlab: Uint8Array;
}

export function serializeCaptureSessionWire(session: CaptureSessionIndex): CaptureSessionWire {
  const totalFrameBytes = session.frames.reduce((sum, frame) => sum + frame.record.bytes.length, 0);
  const byteSlab = new Uint8Array(totalFrameBytes);
  let cursor = 0;
  const frames = session.frames.map<WireFrameEvidence>((frame) => {
    const bytes = frame.record.bytes.copy();
    byteSlab.set(bytes, cursor);
    const { bytes: _bytes, ...record } = frame.record;
    const { record: _record, ...evidence } = frame;
    const wireFrame: WireFrameEvidence = {
      ...evidence,
      record: {
        ...record,
        slabOffset: cursor,
        slabLength: bytes.length,
      },
    };
    cursor += bytes.length;
    return wireFrame;
  });
  return {
    container: {
      format: session.container.format,
      byteOrder: session.container.byteOrder,
      captureId: session.container.captureId,
      byteLength: session.container.byteLength,
      interfaces: session.container.interfaces,
      warnings: session.container.warnings,
    },
    frames,
    conversations: session.conversations,
    events: session.events,
    warnings: session.warnings,
    byteSlab,
  };
}

export function hydrateCaptureSessionWire(wire: CaptureSessionWire): CaptureSessionIndex {
  const frames = wire.frames.map<CapturedFrameEvidence>((frame) => {
    const { slabOffset, slabLength, ...record } = frame.record;
    if (!Number.isSafeInteger(slabOffset) || !Number.isSafeInteger(slabLength) || slabOffset < 0 || slabLength < 0
      || slabOffset > wire.byteSlab.length || slabLength > wire.byteSlab.length - slabOffset) {
      throw new Error('Capture worker returned an invalid frame-byte slab range.');
    }
    const { record: _wireRecord, ...evidence } = frame;
    return deepFreeze({
      ...evidence,
      record: deepFreeze({
        ...record,
        bytes: ImmutableBytes.copyOf(wire.byteSlab.subarray(slabOffset, slabOffset + slabLength)),
      }),
    });
  });
  const container = deepFreeze<ParsedCaptureContainer>({
    ...wire.container,
    interfaces: wire.container.interfaces.map((entry) => deepFreeze({ ...entry })),
    frames: frames.map((frame) => frame.record),
    warnings: [...wire.container.warnings],
  });
  const conversations = wire.conversations.map((conversation) => deepFreeze({ ...conversation }));
  const events = wire.events.map((event) => deepFreeze({ ...event }));
  return new CaptureSessionIndex(container, frames, conversations, events, wire.warnings);
}
