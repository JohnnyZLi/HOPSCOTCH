import { CaptureParseError } from './bytes.ts';
import { parseCaptureSession } from './session.ts';
import { serializeCaptureSessionWire, type CaptureSessionWire } from './wire.ts';

type ParseRequest = { readonly id: number; readonly buffer: ArrayBuffer };
type ParseSuccess = { readonly id: number; readonly ok: true; readonly wire: CaptureSessionWire };
type ParseFailure = { readonly id: number; readonly ok: false; readonly error: { readonly name: string; readonly message: string; readonly code: string | null; readonly offset: number | null } };

type WorkerScope = {
  onmessage: ((event: MessageEvent<ParseRequest>) => void) | null;
  postMessage(message: ParseSuccess | ParseFailure, transfer?: Transferable[]): void;
};

const scope = globalThis as unknown as WorkerScope;

scope.onmessage = (event) => {
  const request = event.data;
  try {
    const session = parseCaptureSession(request.buffer);
    const wire = serializeCaptureSessionWire(session);
    scope.postMessage({ id: request.id, ok: true, wire }, [wire.byteSlab.buffer]);
  } catch (cause) {
    const error = cause instanceof Error ? cause : new Error(String(cause));
    scope.postMessage({
      id: request.id,
      ok: false,
      error: {
        name: error.name,
        message: error.message,
        code: cause instanceof CaptureParseError ? cause.code : null,
        offset: cause instanceof CaptureParseError ? cause.offset : null,
      },
    });
  }
};
