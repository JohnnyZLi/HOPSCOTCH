export type CaptureByteOrder = 'little' | 'big';

export type CaptureParseErrorCode =
  | 'UNSUPPORTED_FORMAT'
  | 'UNSUPPORTED_VERSION'
  | 'UNSUPPORTED_LINK_TYPE'
  | 'CAPTURE_TOO_LARGE'
  | 'FRAME_LIMIT_EXCEEDED'
  | 'SEMANTIC_LIMIT_EXCEEDED'
  | 'FRAME_TOO_LARGE'
  | 'TRUNCATED_INPUT'
  | 'INVALID_LENGTH'
  | 'INVALID_INTERFACE'
  | 'MALFORMED_CONTAINER'
  | 'MALFORMED_PROTOCOL';

export class CaptureParseError extends Error {
  readonly code: CaptureParseErrorCode;
  readonly offset: number | null;

  constructor(code: CaptureParseErrorCode, message: string, offset: number | null = null) {
    super(offset === null ? message : `${message} (byte ${offset})`);
    this.name = 'CaptureParseError';
    this.code = code;
    this.offset = offset;
  }
}

/**
 * A read-only byte view. The imported buffer is copied exactly once and is never
 * exposed directly; returned Uint8Arrays are defensive copies.
 */
export class ImmutableBytes {
  readonly #buffer: Uint8Array;
  readonly #start: number;
  readonly length: number;

  private constructor(buffer: Uint8Array, start: number, length: number) {
    this.#buffer = buffer;
    this.#start = start;
    this.length = length;
    Object.freeze(this);
  }

  static copyOf(input: ArrayBuffer | ArrayBufferView | Uint8Array): ImmutableBytes {
    const source = input instanceof Uint8Array
      ? input
      : ArrayBuffer.isView(input)
        ? new Uint8Array(input.buffer, input.byteOffset, input.byteLength)
        : new Uint8Array(input);
    const owned = new Uint8Array(source.length);
    owned.set(source);
    return new ImmutableBytes(owned, 0, owned.length);
  }

  view(offset: number, length = this.length - offset): ImmutableBytes {
    this.assertRange(offset, length);
    return new ImmutableBytes(this.#buffer, this.#start + offset, length);
  }

  at(offset: number): number {
    this.assertRange(offset, 1);
    return this.#buffer[this.#start + offset] as number;
  }

  readUint16(offset: number, order: CaptureByteOrder): number {
    this.assertRange(offset, 2);
    const a = this.at(offset);
    const b = this.at(offset + 1);
    return order === 'big' ? (a * 0x100) + b : (b * 0x100) + a;
  }

  readUint24BE(offset: number): number {
    this.assertRange(offset, 3);
    return (this.at(offset) * 0x10000) + (this.at(offset + 1) * 0x100) + this.at(offset + 2);
  }

  readUint32(offset: number, order: CaptureByteOrder): number {
    this.assertRange(offset, 4);
    const a = this.at(offset);
    const b = this.at(offset + 1);
    const c = this.at(offset + 2);
    const d = this.at(offset + 3);
    return order === 'big'
      ? (((a * 0x1000000) + (b * 0x10000) + (c * 0x100) + d) >>> 0)
      : (((d * 0x1000000) + (c * 0x10000) + (b * 0x100) + a) >>> 0);
  }

  readBigUint64(offset: number, order: CaptureByteOrder): bigint {
    this.assertRange(offset, 8);
    if (order === 'big') {
      return (BigInt(this.readUint32(offset, 'big')) << 32n) | BigInt(this.readUint32(offset + 4, 'big'));
    }
    return (BigInt(this.readUint32(offset + 4, 'little')) << 32n) | BigInt(this.readUint32(offset, 'little'));
  }

  copy(offset = 0, length = this.length - offset): Uint8Array {
    this.assertRange(offset, length);
    return this.#buffer.slice(this.#start + offset, this.#start + offset + length);
  }

  hex(offset = 0, length = this.length - offset): string {
    this.assertRange(offset, length);
    const parts: string[] = [];
    for (let index = 0; index < length; index += 1) {
      parts.push(this.at(offset + index).toString(16).padStart(2, '0').toUpperCase());
    }
    return parts.join(' ');
  }

  deterministicFingerprint(): string {
    let hashA = 0x811c9dc5;
    let hashB = (0x9e3779b9 ^ this.length) >>> 0;
    for (let index = 0; index < this.length; index += 1) {
      const byte = this.#buffer[this.#start + index] as number;
      hashA = Math.imul(hashA ^ byte, 0x01000193) >>> 0;
      hashB = Math.imul((hashB ^ byte ^ (index & 0xff)) >>> 0, 0x85ebca6b) >>> 0;
      hashB = (hashB ^ (hashB >>> 13)) >>> 0;
    }
    return `${hashA.toString(16).padStart(8, '0')}${hashB.toString(16).padStart(8, '0')}`;
  }

  private assertRange(offset: number, length: number): void {
    if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || length < 0
      || offset > this.length || length > this.length - offset) {
      throw new CaptureParseError('TRUNCATED_INPUT', `Byte range ${offset}+${length} exceeds ${this.length}`, Math.max(0, offset));
    }
  }
}

export function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || value instanceof ImmutableBytes || Object.isFrozen(value)) return value;
  if (Array.isArray(value)) {
    value.forEach((entry) => deepFreeze(entry));
  } else {
    Object.values(value as Record<string, unknown>).forEach((entry) => deepFreeze(entry));
  }
  return Object.freeze(value);
}

export function assertCapturedRange(containerLength: number, offset: number, length: number, label: string): void {
  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || length < 0
    || offset > containerLength || length > containerLength - offset) {
    throw new CaptureParseError('MALFORMED_PROTOCOL', `${label} exceeds the captured frame`, Math.max(0, offset));
  }
}
