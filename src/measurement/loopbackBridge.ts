import { ingestNetworkDiagnosticsReportV2, type NetworkDiagnosticsIngestion } from './networkDiagnosticsAdapter.ts';

export const DEFAULT_LOOPBACK_BRIDGE_ORIGIN = 'http://127.0.0.1:8765';
export const LOOPBACK_BRIDGE_HANDSHAKE_PATH = '/api/hopscotch/v1/handshake';
export const LOOPBACK_BRIDGE_REPORT_PATH = '/api/hopscotch/v1/report';

export type LoopbackBridgeStatus = 'disconnected' | 'connecting' | 'connected' | 'unavailable' | 'rejected';

export interface LoopbackBridgeHandshake {
  schema: 'hopscotch.network-diagnostics-bridge';
  version: 1;
  application: 'Network Diagnostics Suite';
  reportSchemaVersion: '2.0';
  reportPath: typeof LOOPBACK_BRIDGE_REPORT_PATH;
  bridgeVersion: string;
  capabilities: ['report-v2'];
}

export interface LoopbackBridgeConnection {
  status: 'connected';
  origin: string;
  handshakeUrl: string;
  reportUrl: string;
  handshake: LoopbackBridgeHandshake;
}

export interface LoopbackBridgeRequestOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  signal?: AbortSignal;
}

const HANDSHAKE_KEYS = new Set([
  'schema',
  'version',
  'application',
  'reportSchemaVersion',
  'reportPath',
  'bridgeVersion',
  'capabilities',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  if (normalized === 'localhost' || normalized === '[::1]' || normalized === '::1') return true;
  const octets = normalized.split('.');
  if (octets.length !== 4 || octets[0] !== '127') return false;
  return octets.every((part) => /^\d{1,3}$/.test(part) && Number(part) >= 0 && Number(part) <= 255);
}

export function normalizeLoopbackBridgeOrigin(input: string): string {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new Error('Local bridge address must be a valid http:// or https:// loopback origin.');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Local bridge address must use http:// or https://.');
  }
  if (!isLoopbackHostname(url.hostname)) {
    throw new Error('Local bridge address must use localhost, 127.0.0.0/8, or ::1.');
  }
  if (url.username || url.password) throw new Error('Local bridge address must not contain credentials.');
  if (url.search || url.hash) throw new Error('Local bridge address must not contain a query string or fragment.');
  if (url.pathname !== '/' && url.pathname !== '') throw new Error('Local bridge address must be an origin only, without a path.');
  if (url.port !== '' && (Number(url.port) < 1 || Number(url.port) > 65535)) {
    throw new Error('Local bridge port must be between 1 and 65535.');
  }

  return url.origin;
}

export function parseLoopbackBridgeHandshake(value: unknown): LoopbackBridgeHandshake {
  if (!isRecord(value)) throw new Error('Local bridge handshake must be an object.');
  for (const key of Object.keys(value)) {
    if (!HANDSHAKE_KEYS.has(key)) throw new Error(`Local bridge handshake contains unsupported field: ${key}.`);
  }
  if (value.schema !== 'hopscotch.network-diagnostics-bridge') throw new Error('Local bridge handshake schema is unsupported.');
  if (value.version !== 1) throw new Error('Local bridge handshake version is unsupported.');
  if (value.application !== 'Network Diagnostics Suite') throw new Error('Local bridge application identity is unsupported.');
  if (value.reportSchemaVersion !== '2.0') throw new Error('Local bridge report schema must be Network Diagnostics 2.0.');
  if (value.reportPath !== LOOPBACK_BRIDGE_REPORT_PATH) throw new Error('Local bridge report path is unsupported.');
  if (typeof value.bridgeVersion !== 'string' || value.bridgeVersion.trim().length === 0 || value.bridgeVersion.length > 64) {
    throw new Error('Local bridge version must be a non-empty string of at most 64 characters.');
  }
  if (!Array.isArray(value.capabilities) || value.capabilities.length !== 1 || value.capabilities[0] !== 'report-v2') {
    throw new Error('Local bridge must advertise exactly the report-v2 capability.');
  }
  return {
    schema: 'hopscotch.network-diagnostics-bridge',
    version: 1,
    application: 'Network Diagnostics Suite',
    reportSchemaVersion: '2.0',
    reportPath: LOOPBACK_BRIDGE_REPORT_PATH,
    bridgeVersion: value.bridgeVersion.trim(),
    capabilities: ['report-v2'],
  };
}

function requestSignal(timeoutMs: number, callerSignal?: AbortSignal): AbortSignal {
  if (!Number.isFinite(timeoutMs) || timeoutMs < 250 || timeoutMs > 15_000) {
    throw new Error('Local bridge timeout must be between 250 and 15000 milliseconds.');
  }
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  return callerSignal ? AbortSignal.any([callerSignal, timeoutSignal]) : timeoutSignal;
}

async function fetchJson(url: string, options: LoopbackBridgeRequestOptions): Promise<unknown> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(url, {
    method: 'GET',
    mode: 'cors',
    credentials: 'omit',
    cache: 'no-store',
    redirect: 'error',
    headers: { Accept: 'application/json' },
    signal: requestSignal(options.timeoutMs ?? 3500, options.signal),
  });
  if (!response.ok) throw new Error(`Local bridge request failed with HTTP ${response.status}.`);
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  if (!contentType.includes('application/json')) throw new Error('Local bridge response must use application/json.');
  return response.json();
}

export async function connectLoopbackBridge(
  inputOrigin: string,
  options: LoopbackBridgeRequestOptions = {},
): Promise<LoopbackBridgeConnection> {
  const origin = normalizeLoopbackBridgeOrigin(inputOrigin);
  const handshakeUrl = `${origin}${LOOPBACK_BRIDGE_HANDSHAKE_PATH}`;
  const handshake = parseLoopbackBridgeHandshake(await fetchJson(handshakeUrl, options));
  return {
    status: 'connected',
    origin,
    handshakeUrl,
    reportUrl: `${origin}${LOOPBACK_BRIDGE_REPORT_PATH}`,
    handshake,
  };
}

export async function fetchLoopbackBridgeReport(
  connection: LoopbackBridgeConnection,
  options: LoopbackBridgeRequestOptions = {},
): Promise<NetworkDiagnosticsIngestion> {
  const origin = normalizeLoopbackBridgeOrigin(connection.origin);
  const expectedReportUrl = `${origin}${LOOPBACK_BRIDGE_REPORT_PATH}`;
  if (connection.status !== 'connected' || connection.reportUrl !== expectedReportUrl) {
    throw new Error('Local bridge connection is not valid for the fixed report endpoint.');
  }
  const report = await fetchJson(expectedReportUrl, options);
  return ingestNetworkDiagnosticsReportV2(report);
}
