import assert from 'node:assert/strict';
import { CaptureParseError } from '../src/capture/bytes.ts';
import { parseCaptureContainer } from '../src/capture/container.ts';
import { parseCaptureSession } from '../src/capture/session.ts';
import { CAPTURE_LIMITS } from '../src/capture/types.ts';
import {
  concatBytes,
  pcapCapture,
  pcapngSection,
  tcpIpv4Frame,
  u32,
} from './capture-fixtures.mjs';

const ethernet = tcpIpv4Frame(new TextEncoder().encode('bounded evidence'), { flags: 0x18 });

function rejects(input, code) {
  assert.throws(
    () => parseCaptureContainer(input),
    (error) => error instanceof CaptureParseError && error.code === code,
    `expected controlled ${code} rejection`,
  );
}

const littleMicroInput = pcapCapture([
  { bytes: ethernet, seconds: 1_700_000_000, fraction: 100 },
  { bytes: ethernet.subarray(0, ethernet.length - 4), seconds: 1_700_000_000, fraction: 600, originalLength: ethernet.length },
]);
const littleMicro = parseCaptureContainer(littleMicroInput);
assert.equal(littleMicro.format, 'pcap');
assert.equal(littleMicro.byteOrder, 'little');
assert.equal(littleMicro.frames.length, 2);
assert.equal(littleMicro.frames[0].relativeTimeNanoseconds, 0n);
assert.equal(littleMicro.frames[1].relativeTimeNanoseconds, 500_000n);
assert.equal(littleMicro.frames[1].truncated, true);
assert.equal(littleMicro.frames[1].capturedLength, ethernet.length - 4);
assert.equal(littleMicro.frames[1].originalLength, ethernet.length);
assert.equal(littleMicro.frames[0].timestamp.resolution.unit, 'microseconds');
assert.match(littleMicro.captureId, /^capture-[0-9a-f]{16}$/);

const firstByte = littleMicro.frames[0].bytes.at(0);
littleMicroInput[24 + 16] ^= 0xff;
assert.equal(littleMicro.frames[0].bytes.at(0), firstByte, 'parser must own a defensive capture copy');
const exportedCopy = littleMicro.frames[0].bytes.copy();
exportedCopy[0] ^= 0xff;
assert.equal(littleMicro.frames[0].bytes.at(0), firstByte, 'defensive frame copies cannot mutate evidence');

const bigMicro = parseCaptureContainer(pcapCapture([{ bytes: ethernet, seconds: 10, fraction: 25 }], { order: 'big' }));
assert.equal(bigMicro.byteOrder, 'big');
assert.equal(bigMicro.frames[0].timestamp.originalSeconds, 10);
assert.equal(bigMicro.frames[0].timestamp.originalFraction, 25);

for (const order of ['little', 'big']) {
  const nano = parseCaptureContainer(pcapCapture([
    { bytes: ethernet, seconds: 10, fraction: 100 },
    { bytes: ethernet, seconds: 10, fraction: 109 },
  ], { order, nanoseconds: true }));
  assert.equal(nano.frames[1].relativeTimeNanoseconds, 9n);
  assert.equal(nano.frames[0].timestamp.resolution.unit, 'nanoseconds');
}

const unsupported = parseCaptureSession(pcapCapture([{ bytes: Uint8Array.of(1, 2, 3, 4) }], { linkType: 101 }));
assert.equal(unsupported.frames[0].record.linkType, 101);
assert.equal(unsupported.frames[0].layers[0].status, 'unsupported');
assert.ok(unsupported.frames[0].layers.every((entry) => entry.protocol !== 'ethernet'), 'unsupported link data must never be decoded accidentally as Ethernet');

rejects(new Uint8Array(3), 'TRUNCATED_INPUT');
rejects(new Uint8Array(24), 'UNSUPPORTED_FORMAT');
rejects(new Uint8Array(CAPTURE_LIMITS.maxCaptureBytes + 1), 'CAPTURE_TOO_LARGE');
const badVersion = pcapCapture([{ bytes: ethernet }]);
badVersion.set(Uint8Array.of(3, 0), 4);
rejects(badVersion, 'UNSUPPORTED_VERSION');
const badRecord = pcapCapture([{ bytes: ethernet }]);
badRecord.set(u32(ethernet.length + 10, 'little'), 24 + 8);
badRecord.set(u32(ethernet.length + 10, 'little'), 24 + 12);
rejects(badRecord, 'TRUNCATED_INPUT');
const impossibleOriginal = pcapCapture([{ bytes: ethernet }]);
impossibleOriginal.set(u32(1, 'little'), 24 + 12);
rejects(impossibleOriginal, 'INVALID_LENGTH');
const unsafeSnap = pcapCapture([{ bytes: ethernet }]);
unsafeSnap.set(u32(0, 'little'), 16);
rejects(unsafeSnap, 'INVALID_LENGTH');
const oversizedFrame = pcapCapture([{ bytes: ethernet }], { snapLength: CAPTURE_LIMITS.maxFrameBytes });
oversizedFrame.set(u32(CAPTURE_LIMITS.maxFrameBytes + 1, 'little'), 24 + 8);
oversizedFrame.set(u32(CAPTURE_LIMITS.maxFrameBytes + 1, 'little'), 24 + 12);
rejects(oversizedFrame, 'FRAME_TOO_LARGE');

for (const order of ['little', 'big']) {
  const pcapngInput = pcapngSection({
    order,
    interfaces: [
      { linkType: 1, snapLength: 262144, tsresol: 9 },
      { linkType: 1, snapLength: 262144, tsresol: 6 },
    ],
    includeUnknownBlock: true,
    packets: [
      { bytes: ethernet.subarray(0, ethernet.length - 1), interfaceId: 0, ticks: 1_700_000_000_000_000_000n, originalLength: ethernet.length },
      { bytes: ethernet, interfaceId: 1, ticks: 1_700_000_001_000_000n },
    ],
  });
  const parsed = parseCaptureContainer(pcapngInput);
  assert.equal(parsed.format, 'pcapng');
  assert.equal(parsed.byteOrder, order);
  assert.equal(parsed.interfaces.length, 2);
  assert.equal(parsed.frames.length, 2);
  assert.equal(parsed.frames[0].interfaceId, 'interface-0-0');
  assert.equal(parsed.frames[1].interfaceId, 'interface-0-1');
  assert.equal(parsed.frames[0].timestamp.resolution.exponent, 9);
  assert.equal(parsed.frames[1].timestamp.resolution.exponent, 6);
  assert.equal(parsed.frames[0].truncated, true);
  assert.equal(parsed.frames[0].bytes.length, ethernet.length - 1, '32-bit packet padding is not evidence bytes');
}

const binaryResolution = parseCaptureContainer(pcapngSection({
  interfaces: [{ linkType: 1, snapLength: 262144, tsresol: 0x8a }],
  packets: [{ bytes: ethernet, ticks: 1024n }, { bytes: ethernet, ticks: 2048n }],
}));
assert.equal(binaryResolution.frames[0].timestamp.resolution.unit, 'binary');
assert.equal(binaryResolution.frames[1].relativeTimeNanoseconds, 1_000_000_000n);

const mixed = parseCaptureContainer(concatBytes(
  pcapngSection({ order: 'little', packets: [{ bytes: ethernet, ticks: 100n }] }),
  pcapngSection({ order: 'big', packets: [{ bytes: ethernet, ticks: 200n }] }),
));
assert.equal(mixed.byteOrder, 'mixed');
assert.equal(mixed.frames.length, 2);
assert.equal(mixed.frames[1].sectionIndex, 1);

const invalidInterface = pcapngSection({ interfaces: [{ linkType: 1, tsresol: 9 }], packets: [{ bytes: ethernet, interfaceId: 7 }] });
rejects(invalidInterface, 'INVALID_INTERFACE');

const trailingMismatch = pcapngSection({ packets: [{ bytes: ethernet }] });
trailingMismatch[trailingMismatch.length - 1] ^= 0x01;
rejects(trailingMismatch, 'MALFORMED_CONTAINER');

const truncatedBlock = pcapngSection({ packets: [{ bytes: ethernet }] }).subarray(0, -2);
rejects(truncatedBlock, 'TRUNCATED_INPUT');

const invalidBlockSize = pcapngSection({ packets: [] });
invalidBlockSize.set(u32(10, 'little'), 4);
rejects(invalidBlockSize, 'INVALID_LENGTH');
const unsafeBlockSize = pcapngSection({ packets: [] });
unsafeBlockSize.set(u32(CAPTURE_LIMITS.maxPcapngBlockBytes + 4, 'little'), 4);
rejects(unsafeBlockSize, 'INVALID_LENGTH');

console.log('Track T container contract passed: endian PCAP/PCAPNG, micro/nanosecond time, interface resolution, padding, truncation, immutable bytes, and fail-closed lengths.');
