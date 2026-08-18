import { CaptureParseError, ImmutableBytes, deepFreeze, type CaptureByteOrder } from './bytes.ts';
import {
  CAPTURE_LIMITS,
  type CaptureInterfaceRecord,
  type CaptureTimestampResolution,
  type CapturedFrameRecord,
  type CapturedTimestamp,
  type ParsedCaptureContainer,
} from './types.ts';

const PCAPNG_SECTION_HEADER = 0x0a0d0d0a;
const PCAPNG_INTERFACE_DESCRIPTION = 0x00000001;
const PCAPNG_ENHANCED_PACKET = 0x00000006;
const PCAPNG_SIMPLE_PACKET = 0x00000003;

type FrameDraft = Omit<CapturedFrameRecord, 'relativeTimeNanoseconds' | 'relativeTimeMs'>;

const MICROSECOND_RESOLUTION: CaptureTimestampResolution = deepFreeze({
  unit: 'microseconds',
  exponent: 6,
  description: '10^-6 seconds',
});

const NANOSECOND_RESOLUTION: CaptureTimestampResolution = deepFreeze({
  unit: 'nanoseconds',
  exponent: 9,
  description: '10^-9 seconds',
});

function decimalResolution(exponent: number): CaptureTimestampResolution {
  return deepFreeze({ unit: 'decimal', exponent, description: `10^-${exponent} seconds` });
}

function binaryResolution(exponent: number): CaptureTimestampResolution {
  return deepFreeze({ unit: 'binary', exponent, description: `2^-${exponent} seconds` });
}

function linkTypeLabel(linkType: number): string {
  if (linkType === 1) return 'Ethernet II';
  return `Unsupported link type ${linkType}`;
}

function isoFromNanoseconds(epochNanoseconds: bigint): string | null {
  const milliseconds = epochNanoseconds / 1_000_000n;
  if (milliseconds < -8_640_000_000_000_000n || milliseconds > 8_640_000_000_000_000n) return null;
  const date = new Date(Number(milliseconds));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function timestampFromPcap(seconds: number, fraction: number, nanoseconds: boolean): CapturedTimestamp {
  const scale = nanoseconds ? 1_000_000_000n : 1_000_000n;
  const epochNanoseconds = (BigInt(seconds) * 1_000_000_000n)
    + (nanoseconds ? BigInt(fraction) : BigInt(fraction) * 1_000n);
  return deepFreeze({
    epochNanoseconds,
    originalSeconds: seconds,
    originalFraction: fraction,
    rawTicks: (BigInt(seconds) * scale) + BigInt(fraction),
    resolution: nanoseconds ? NANOSECOND_RESOLUTION : MICROSECOND_RESOLUTION,
    iso8601: isoFromNanoseconds(epochNanoseconds),
  });
}

function ticksToNanoseconds(ticks: bigint, resolution: CaptureTimestampResolution): bigint {
  if (resolution.unit === 'binary') return (ticks * 1_000_000_000n) / (1n << BigInt(resolution.exponent));
  if (resolution.exponent <= 9) return ticks * (10n ** BigInt(9 - resolution.exponent));
  return ticks / (10n ** BigInt(resolution.exponent - 9));
}

function timestampFromTicks(ticks: bigint, resolution: CaptureTimestampResolution): CapturedTimestamp {
  const epochNanoseconds = ticksToNanoseconds(ticks, resolution);
  return deepFreeze({
    epochNanoseconds,
    originalSeconds: null,
    originalFraction: null,
    rawTicks: ticks,
    resolution,
    iso8601: isoFromNanoseconds(epochNanoseconds),
  });
}

function captureHash(bytes: ImmutableBytes): string {
  return `capture-${bytes.deterministicFingerprint()}`;
}

function finalizeFrames(drafts: readonly FrameDraft[]): readonly CapturedFrameRecord[] {
  if (drafts.length === 0) return Object.freeze([]);
  let origin = drafts[0]?.timestamp.epochNanoseconds ?? 0n;
  for (const frame of drafts) if (frame.timestamp.epochNanoseconds < origin) origin = frame.timestamp.epochNanoseconds;
  return Object.freeze(drafts.map((frame) => {
    const relativeTimeNanoseconds = frame.timestamp.epochNanoseconds - origin;
    return deepFreeze({
      ...frame,
      relativeTimeNanoseconds,
      relativeTimeMs: Number(relativeTimeNanoseconds) / 1_000_000,
    });
  }));
}

function requireFrameCapacity(frameCount: number, capturedLength: number, offset: number): void {
  if (frameCount >= CAPTURE_LIMITS.maxFrames) {
    throw new CaptureParseError('FRAME_LIMIT_EXCEEDED', `Capture exceeds the explicit ${CAPTURE_LIMITS.maxFrames.toLocaleString()} frame ceiling`, offset);
  }
  if (capturedLength > CAPTURE_LIMITS.maxFrameBytes) {
    throw new CaptureParseError('FRAME_TOO_LARGE', `Frame length ${capturedLength} exceeds the ${CAPTURE_LIMITS.maxFrameBytes} byte ceiling`, offset);
  }
}

function parseClassicPcap(bytes: ImmutableBytes, captureId: string): ParsedCaptureContainer {
  if (bytes.length < 24) throw new CaptureParseError('TRUNCATED_INPUT', 'Classic PCAP global header requires 24 bytes', bytes.length);
  const magic = bytes.hex(0, 4).replaceAll(' ', '').toLowerCase();
  const variants: Readonly<Record<string, { order: CaptureByteOrder; nanoseconds: boolean }>> = {
    d4c3b2a1: { order: 'little', nanoseconds: false },
    a1b2c3d4: { order: 'big', nanoseconds: false },
    '4d3cb2a1': { order: 'little', nanoseconds: true },
    a1b23c4d: { order: 'big', nanoseconds: true },
  };
  const variant = variants[magic];
  if (!variant) throw new CaptureParseError('UNSUPPORTED_FORMAT', 'Unrecognized PCAP magic value', 0);

  const major = bytes.readUint16(4, variant.order);
  const minor = bytes.readUint16(6, variant.order);
  if (major !== 2 || minor !== 4) {
    throw new CaptureParseError('UNSUPPORTED_VERSION', `Unsupported PCAP version ${major}.${minor}; HOPSCOTCH accepts 2.4`, 4);
  }
  const snapLength = bytes.readUint32(16, variant.order);
  if (snapLength === 0 || snapLength > CAPTURE_LIMITS.maxFrameBytes) {
    throw new CaptureParseError('INVALID_LENGTH', `Invalid or unsafe PCAP snapshot length ${snapLength}`, 16);
  }
  const linkType = bytes.readUint32(20, variant.order);
  const captureInterface: CaptureInterfaceRecord = deepFreeze({
    id: 'interface-0-0',
    sectionIndex: 0,
    interfaceIndex: 0,
    linkType,
    linkTypeLabel: linkTypeLabel(linkType),
    supported: linkType === 1,
    snapLength,
    timestampResolution: variant.nanoseconds ? NANOSECOND_RESOLUTION : MICROSECOND_RESOLUTION,
  });
  const warnings: string[] = [];
  if (!captureInterface.supported) warnings.push(`${captureInterface.linkTypeLabel}; frames remain available as raw captured bytes and are not decoded as Ethernet.`);

  const drafts: FrameDraft[] = [];
  let offset = 24;
  while (offset < bytes.length) {
    if (bytes.length - offset < 16) throw new CaptureParseError('TRUNCATED_INPUT', 'Truncated PCAP packet record header', offset);
    const seconds = bytes.readUint32(offset, variant.order);
    const fraction = bytes.readUint32(offset + 4, variant.order);
    const capturedLength = bytes.readUint32(offset + 8, variant.order);
    const originalLength = bytes.readUint32(offset + 12, variant.order);
    const fractionLimit = variant.nanoseconds ? 1_000_000_000 : 1_000_000;
    if (fraction >= fractionLimit) throw new CaptureParseError('MALFORMED_CONTAINER', `PCAP timestamp fraction ${fraction} exceeds its resolution`, offset + 4);
    requireFrameCapacity(drafts.length, capturedLength, offset + 8);
    if (capturedLength > snapLength) throw new CaptureParseError('INVALID_LENGTH', `Captured length ${capturedLength} exceeds declared snapshot length ${snapLength}`, offset + 8);
    if (originalLength < capturedLength) throw new CaptureParseError('INVALID_LENGTH', `Original length ${originalLength} is smaller than captured length ${capturedLength}`, offset + 12);
    const payloadOffset = offset + 16;
    if (capturedLength > bytes.length - payloadOffset) throw new CaptureParseError('TRUNCATED_INPUT', 'PCAP packet bytes end before captured length', payloadOffset);
    const number = drafts.length + 1;
    drafts.push({
      id: `frame-${number.toString().padStart(6, '0')}`,
      number,
      sourceOrder: drafts.length,
      timestamp: timestampFromPcap(seconds, fraction, variant.nanoseconds),
      capturedLength,
      originalLength,
      truncated: capturedLength < originalLength,
      linkType,
      linkTypeLabel: captureInterface.linkTypeLabel,
      interfaceId: captureInterface.id,
      sectionIndex: 0,
      bytes: bytes.view(payloadOffset, capturedLength),
      provenance: 'CAPTURED',
    });
    offset = payloadOffset + capturedLength;
  }

  return deepFreeze({
    format: 'pcap',
    byteOrder: variant.order,
    captureId,
    byteLength: bytes.length,
    frames: finalizeFrames(drafts),
    interfaces: [captureInterface],
    warnings,
  });
}

function align32(length: number): number {
  const remainder = length % 4;
  return remainder === 0 ? length : length + (4 - remainder);
}

function validateBlockLength(bytes: ImmutableBytes, offset: number, length: number, order: CaptureByteOrder): void {
  if (length < 12 || length % 4 !== 0 || length > CAPTURE_LIMITS.maxPcapngBlockBytes) {
    throw new CaptureParseError('INVALID_LENGTH', `Invalid PCAPNG block length ${length}`, offset + 4);
  }
  if (length > bytes.length - offset) throw new CaptureParseError('TRUNCATED_INPUT', 'PCAPNG block exceeds the input buffer', offset);
  const trailingLength = bytes.readUint32(offset + length - 4, order);
  if (trailingLength !== length) throw new CaptureParseError('MALFORMED_CONTAINER', `PCAPNG trailing block length ${trailingLength} does not match ${length}`, offset + length - 4);
}

function forEachPcapngOption(
  bytes: ImmutableBytes,
  start: number,
  end: number,
  order: CaptureByteOrder,
  visit: (code: number, valueOffset: number, valueLength: number) => void,
): void {
  let offset = start;
  while (offset < end) {
    if (end - offset < 4) throw new CaptureParseError('TRUNCATED_INPUT', 'Truncated PCAPNG option header', offset);
    const code = bytes.readUint16(offset, order);
    const length = bytes.readUint16(offset + 2, order);
    const valueOffset = offset + 4;
    if (length > end - valueOffset) throw new CaptureParseError('TRUNCATED_INPUT', 'PCAPNG option value exceeds its block', valueOffset);
    if (code === 0) {
      if (length !== 0) throw new CaptureParseError('MALFORMED_CONTAINER', 'PCAPNG end-of-options must have zero length', offset);
      return;
    }
    visit(code, valueOffset, length);
    const paddedLength = align32(length);
    if (paddedLength > end - valueOffset) throw new CaptureParseError('TRUNCATED_INPUT', 'PCAPNG option padding exceeds its block', valueOffset);
    offset = valueOffset + paddedLength;
  }
}

function pcapngResolution(bytes: ImmutableBytes, offset: number): CaptureTimestampResolution {
  const raw = bytes.at(offset);
  const binary = (raw & 0x80) !== 0;
  const exponent = raw & 0x7f;
  if (exponent > 63) throw new CaptureParseError('MALFORMED_CONTAINER', `Unsafe PCAPNG timestamp resolution exponent ${exponent}`, offset);
  return binary ? binaryResolution(exponent) : decimalResolution(exponent);
}

function parsePcapng(bytes: ImmutableBytes, captureId: string): ParsedCaptureContainer {
  const drafts: FrameDraft[] = [];
  const interfaces: CaptureInterfaceRecord[] = [];
  const warnings: string[] = [];
  let suppressedWarningCount = 0;
  const addWarning = (warning: string) => {
    if (warnings.length < 64) warnings.push(warning);
    else suppressedWarningCount += 1;
  };
  const orders = new Set<CaptureByteOrder>();
  let offset = 0;
  let sectionIndex = -1;
  let currentOrder: CaptureByteOrder | null = null;
  let sectionInterfaces: CaptureInterfaceRecord[] = [];
  let blockCount = 0;

  while (offset < bytes.length) {
    if (blockCount >= CAPTURE_LIMITS.maxPcapngBlocks) {
      throw new CaptureParseError('MALFORMED_CONTAINER', `PCAPNG exceeds the explicit ${CAPTURE_LIMITS.maxPcapngBlocks.toLocaleString()} block ceiling`, offset);
    }
    blockCount += 1;
    if (bytes.length - offset < 12) throw new CaptureParseError('TRUNCATED_INPUT', 'Truncated PCAPNG block header', offset);
    const rawType = bytes.readUint32(offset, 'big');
    if (rawType === PCAPNG_SECTION_HEADER) {
      if (bytes.length - offset < 28) throw new CaptureParseError('TRUNCATED_INPUT', 'PCAPNG Section Header Block requires at least 28 bytes', offset);
      const bom = bytes.hex(offset + 8, 4).replaceAll(' ', '').toLowerCase();
      currentOrder = bom === '1a2b3c4d' ? 'big' : bom === '4d3c2b1a' ? 'little' : null;
      if (!currentOrder) throw new CaptureParseError('MALFORMED_CONTAINER', 'Invalid PCAPNG byte-order magic', offset + 8);
      const blockLength = bytes.readUint32(offset + 4, currentOrder);
      validateBlockLength(bytes, offset, blockLength, currentOrder);
      if (blockLength < 28) throw new CaptureParseError('INVALID_LENGTH', 'PCAPNG Section Header Block is too short', offset + 4);
      const major = bytes.readUint16(offset + 12, currentOrder);
      const minor = bytes.readUint16(offset + 14, currentOrder);
      if (major !== 1 || minor !== 0) throw new CaptureParseError('UNSUPPORTED_VERSION', `Unsupported PCAPNG version ${major}.${minor}; HOPSCOTCH accepts 1.0`, offset + 12);
      sectionIndex += 1;
      sectionInterfaces = [];
      orders.add(currentOrder);
      forEachPcapngOption(bytes, offset + 24, offset + blockLength - 4, currentOrder, () => undefined);
      offset += blockLength;
      continue;
    }

    if (!currentOrder || sectionIndex < 0) throw new CaptureParseError('MALFORMED_CONTAINER', 'PCAPNG data appeared before a Section Header Block', offset);
    const blockType = bytes.readUint32(offset, currentOrder);
    const blockLength = bytes.readUint32(offset + 4, currentOrder);
    validateBlockLength(bytes, offset, blockLength, currentOrder);

    if (blockType === PCAPNG_INTERFACE_DESCRIPTION) {
      if (interfaces.length >= CAPTURE_LIMITS.maxPcapngInterfaces) {
        throw new CaptureParseError('INVALID_INTERFACE', `PCAPNG exceeds the explicit ${CAPTURE_LIMITS.maxPcapngInterfaces.toLocaleString()} interface ceiling`, offset);
      }
      if (blockLength < 20) throw new CaptureParseError('INVALID_LENGTH', 'PCAPNG Interface Description Block is too short', offset + 4);
      const linkType = bytes.readUint16(offset + 8, currentOrder);
      const snapLength = bytes.readUint32(offset + 12, currentOrder);
      if (snapLength > CAPTURE_LIMITS.maxFrameBytes) throw new CaptureParseError('INVALID_LENGTH', `Unsafe PCAPNG snapshot length ${snapLength}`, offset + 12);
      let timestampResolution = MICROSECOND_RESOLUTION;
      forEachPcapngOption(bytes, offset + 16, offset + blockLength - 4, currentOrder, (code, valueOffset, valueLength) => {
        if (code === 9) {
          if (valueLength !== 1) throw new CaptureParseError('MALFORMED_CONTAINER', 'PCAPNG if_tsresol option must contain one byte', valueOffset);
          timestampResolution = pcapngResolution(bytes, valueOffset);
        }
      });
      const interfaceIndex = sectionInterfaces.length;
      const record: CaptureInterfaceRecord = deepFreeze({
        id: `interface-${sectionIndex}-${interfaceIndex}`,
        sectionIndex,
        interfaceIndex,
        linkType,
        linkTypeLabel: linkTypeLabel(linkType),
        supported: linkType === 1,
        snapLength,
        timestampResolution,
      });
      sectionInterfaces.push(record);
      interfaces.push(record);
      if (!record.supported) addWarning(`${record.id}: ${record.linkTypeLabel}; referenced frames remain raw and are not decoded as Ethernet.`);
    } else if (blockType === PCAPNG_ENHANCED_PACKET) {
      if (blockLength < 32) throw new CaptureParseError('INVALID_LENGTH', 'PCAPNG Enhanced Packet Block is too short', offset + 4);
      const interfaceIndex = bytes.readUint32(offset + 8, currentOrder);
      const captureInterface = sectionInterfaces[interfaceIndex];
      if (!captureInterface) throw new CaptureParseError('INVALID_INTERFACE', `PCAPNG packet references missing interface ${interfaceIndex}`, offset + 8);
      const timestampHigh = bytes.readUint32(offset + 12, currentOrder);
      const timestampLow = bytes.readUint32(offset + 16, currentOrder);
      const capturedLength = bytes.readUint32(offset + 20, currentOrder);
      const originalLength = bytes.readUint32(offset + 24, currentOrder);
      requireFrameCapacity(drafts.length, capturedLength, offset + 20);
      if (originalLength < capturedLength) throw new CaptureParseError('INVALID_LENGTH', `Original length ${originalLength} is smaller than captured length ${capturedLength}`, offset + 24);
      if (captureInterface.snapLength !== 0 && capturedLength > captureInterface.snapLength) {
        throw new CaptureParseError('INVALID_LENGTH', `Captured length ${capturedLength} exceeds interface snapshot length ${captureInterface.snapLength}`, offset + 20);
      }
      const paddedLength = align32(capturedLength);
      const packetOffset = offset + 28;
      const optionsOffset = packetOffset + paddedLength;
      const optionsEnd = offset + blockLength - 4;
      if (capturedLength > optionsEnd - packetOffset || paddedLength > optionsEnd - packetOffset) {
        throw new CaptureParseError('TRUNCATED_INPUT', 'PCAPNG packet data or padding exceeds its block', packetOffset);
      }
      forEachPcapngOption(bytes, optionsOffset, optionsEnd, currentOrder, () => undefined);
      const ticks = (BigInt(timestampHigh) << 32n) | BigInt(timestampLow);
      const number = drafts.length + 1;
      drafts.push({
        id: `frame-${number.toString().padStart(6, '0')}`,
        number,
        sourceOrder: drafts.length,
        timestamp: timestampFromTicks(ticks, captureInterface.timestampResolution),
        capturedLength,
        originalLength,
        truncated: capturedLength < originalLength,
        linkType: captureInterface.linkType,
        linkTypeLabel: captureInterface.linkTypeLabel,
        interfaceId: captureInterface.id,
        sectionIndex,
        bytes: bytes.view(packetOffset, capturedLength),
        provenance: 'CAPTURED',
      });
    } else if (blockType === PCAPNG_SIMPLE_PACKET) {
      addWarning(`Section ${sectionIndex}: Simple Packet Block skipped; this slice implements Enhanced Packet Blocks only.`);
    }
    // Unknown block types are intentionally skipped after both length words and bounds validate.
    offset += blockLength;
  }

  const uniqueWarnings = [...new Set(warnings)];
  if (suppressedWarningCount > 0) uniqueWarnings.push(`${suppressedWarningCount.toLocaleString()} additional repeated container warning(s) were summarized; captured blocks were not reinterpreted.`);
  const byteOrder: CaptureByteOrder | 'mixed' = orders.size === 1 ? ([...orders][0] as CaptureByteOrder) : 'mixed';
  return deepFreeze({
    format: 'pcapng',
    byteOrder,
    captureId,
    byteLength: bytes.length,
    frames: finalizeFrames(drafts),
    interfaces,
    warnings: uniqueWarnings,
  });
}

export function parseCaptureContainer(input: ArrayBuffer | ArrayBufferView | Uint8Array): ParsedCaptureContainer {
  const inputLength = input.byteLength;
  if (inputLength > CAPTURE_LIMITS.maxCaptureBytes) {
    throw new CaptureParseError('CAPTURE_TOO_LARGE', `Capture is ${inputLength} bytes; the explicit first-slice ceiling is ${CAPTURE_LIMITS.maxCaptureBytes} bytes`);
  }
  const bytes = ImmutableBytes.copyOf(input);
  if (bytes.length < 4) throw new CaptureParseError('TRUNCATED_INPUT', 'Capture is too small to contain a supported file header', bytes.length);
  const captureId = captureHash(bytes);
  const magic = bytes.hex(0, 4).replaceAll(' ', '').toLowerCase();
  if (magic === '0a0d0d0a') return parsePcapng(bytes, captureId);
  if (['d4c3b2a1', 'a1b2c3d4', '4d3cb2a1', 'a1b23c4d'].includes(magic)) return parseClassicPcap(bytes, captureId);
  throw new CaptureParseError('UNSUPPORTED_FORMAT', 'File is neither classic PCAP nor PCAPNG', 0);
}

export function captureLinkTypeLabel(linkType: number): string {
  return linkTypeLabel(linkType);
}
