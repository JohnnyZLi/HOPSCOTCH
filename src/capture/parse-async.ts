import { CaptureParseError, type CaptureParseErrorCode } from './bytes.ts';
import { parseCaptureSession, type CaptureSessionIndex } from './session.ts';
import { hydrateCaptureSessionWire, type CaptureSessionWire } from './wire.ts';

type ParseWorkerResponse =
  | { readonly id: number; readonly ok: true; readonly wire: CaptureSessionWire }
  | { readonly id: number; readonly ok: false; readonly error: { readonly name: string; readonly message: string; readonly code: string | null; readonly offset: number | null } };

function transferableBuffer(input: ArrayBuffer | ArrayBufferView | Uint8Array): ArrayBuffer {
  if (input instanceof ArrayBuffer) return input;
  const view = input instanceof Uint8Array ? input : new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  return view.slice().buffer;
}

export async function parseCaptureSessionAsync(input: ArrayBuffer | ArrayBufferView | Uint8Array): Promise<CaptureSessionIndex> {
  if (typeof Worker === 'undefined') {
    await Promise.resolve();
    return parseCaptureSession(input);
  }
  const buffer = transferableBuffer(input);
  let worker: Worker;
  try {
    worker = new Worker(new URL('./parse-worker.ts', import.meta.url), { type: 'module', name: 'hopscotch-capture-parser' });
  } catch {
    await Promise.resolve();
    return parseCaptureSession(buffer);
  }
  return new Promise<CaptureSessionIndex>((resolve, reject) => {
    const requestId = 1;
    const dispose = () => worker.terminate();
    worker.onerror = (event) => {
      dispose();
      reject(new Error(`Capture parser worker failed: ${event.message || 'unknown worker error'}`));
    };
    worker.onmessage = (event: MessageEvent<ParseWorkerResponse>) => {
      if (event.data.id !== requestId) return;
      dispose();
      if (event.data.ok) {
        try { resolve(hydrateCaptureSessionWire(event.data.wire)); }
        catch (cause) { reject(cause); }
        return;
      }
      const { code, message, offset } = event.data.error;
      if (code) reject(new CaptureParseError(code as CaptureParseErrorCode, message.replace(/ \(byte \d+\)$/, ''), offset));
      else reject(new Error(message));
    };
    worker.postMessage({ id: requestId, buffer }, [buffer]);
  });
}
