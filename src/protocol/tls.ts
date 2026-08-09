export type TlsActor = 'client' | 'server' | 'local';
export type TlsDirection = 'client-to-server' | 'server-to-client' | 'local';
export type TlsProtection = 'cleartext' | 'handshake' | 'application' | 'local';
export type TlsPhase =
  | 'client-hello'
  | 'server-hello'
  | 'handshake-keys'
  | 'server-encrypted-flight'
  | 'certificate-validation'
  | 'server-finished'
  | 'client-finished'
  | 'application-keys'
  | 'application-data'
  | 'complete';

export type TlsKeyStage = 'early' | 'handshake' | 'master' | 'application';

export type TlsEvent = {
  id: string;
  atMs: number;
  actor: TlsActor;
  direction: TlsDirection;
  phase: TlsPhase;
  protection: TlsProtection;
  message: string;
  title: string;
  summary: string;
  detail: string;
  transcriptLabel?: string;
  fields?: readonly { label: string; value: string }[];
  activates?: readonly TlsKeyStage[];
  certificateState?: 'unchecked' | 'validating' | 'valid';
};

export type TlsState = {
  timeMs: number;
  phase: TlsPhase;
  phaseLabel: string;
  latestEventId: string;
  transcript: readonly string[];
  activeKeys: readonly TlsKeyStage[];
  protection: TlsProtection;
  certificateState: 'unchecked' | 'validating' | 'valid';
  negotiatedVersion: string | null;
  negotiatedCipher: string | null;
  negotiatedGroup: string | null;
  negotiatedAlpn: string | null;
  applicationReady: boolean;
};

export const TLS_HOST = 'www.example.test';

const clientHelloFields = [
  { label: 'supported_versions', value: 'TLS 1.3' },
  { label: 'server_name', value: TLS_HOST },
  { label: 'ALPN', value: 'h2, http/1.1' },
  { label: 'cipher_suites', value: 'TLS_AES_128_GCM_SHA256, TLS_AES_256_GCM_SHA384' },
  { label: 'supported_groups', value: 'X25519, secp256r1' },
  { label: 'key_share', value: 'X25519 · symbolic public share C' },
];

const serverHelloFields = [
  { label: 'supported_versions', value: 'TLS 1.3' },
  { label: 'cipher_suite', value: 'TLS_AES_128_GCM_SHA256' },
  { label: 'key_share', value: 'X25519 · symbolic public share S' },
];

export const tlsEvents: readonly TlsEvent[] = [
  {
    id: 'client-hello', atMs: 0, actor: 'client', direction: 'client-to-server', phase: 'client-hello', protection: 'cleartext', message: 'ClientHello',
    title: 'Client offers TLS 1.3 parameters', summary: `SNI ${TLS_HOST}, ALPN h2/http1.1, X25519 key share, and TLS 1.3 cipher suites leave in the clear.`,
    detail: 'ClientHello begins the handshake transcript. In this full 1-RTT model there is no PSK or 0-RTT data. The key share contributes to the later ECDHE shared secret.',
    transcriptLabel: 'ClientHello', fields: clientHelloFields, activates: ['early'], certificateState: 'unchecked',
  },
  {
    id: 'server-hello', atMs: 430, actor: 'server', direction: 'server-to-client', phase: 'server-hello', protection: 'cleartext', message: 'ServerHello',
    title: 'Server selects the cryptographic context', summary: 'TLS 1.3, X25519, and TLS_AES_128_GCM_SHA256 are selected.',
    detail: 'ServerHello completes the visible key-exchange negotiation. Both peers now have the information required to derive the ECDHE-based Handshake Secret and handshake traffic secrets.',
    transcriptLabel: 'ServerHello', fields: serverHelloFields, activates: ['early'], certificateState: 'unchecked',
  },
  {
    id: 'handshake-secret', atMs: 680, actor: 'local', direction: 'local', phase: 'handshake-keys', protection: 'local', message: 'HKDF key schedule',
    title: 'Handshake traffic secrets become available', summary: 'ECDHE feeds the Handshake Secret; transcript(ClientHello…ServerHello) contextualizes client/server handshake traffic secrets.',
    detail: 'HOPSCOTCH represents this symbolically. It does not fabricate secret bytes. These handshake traffic secrets protect the encrypted authentication flight that follows.',
    activates: ['early', 'handshake'], certificateState: 'unchecked',
  },
  {
    id: 'encrypted-extensions', atMs: 930, actor: 'server', direction: 'server-to-client', phase: 'server-encrypted-flight', protection: 'handshake', message: 'EncryptedExtensions',
    title: 'The handshake crosses the encryption boundary', summary: 'EncryptedExtensions is the first server handshake message protected with server handshake traffic keys.',
    detail: 'Extensions not needed to establish the cryptographic context move here. In this model the server confirms ALPN h2 inside the encrypted handshake flight.',
    transcriptLabel: 'EncryptedExtensions', fields: [{ label: 'ALPN selected', value: 'h2' }], activates: ['early', 'handshake'], certificateState: 'unchecked',
  },
  {
    id: 'certificate', atMs: 1220, actor: 'server', direction: 'server-to-client', phase: 'server-encrypted-flight', protection: 'handshake', message: 'Certificate',
    title: 'Server sends its simulated certificate chain', summary: `${TLS_HOST} leaf → HOPSCOTCH Test Intermediate → HOPSCOTCH Test Root.`,
    detail: 'The certificate message is encrypted under the server handshake traffic secret in TLS 1.3. The chain here is deliberately simulated and not a real trust anchor.',
    transcriptLabel: 'Certificate', fields: [
      { label: 'Leaf SAN', value: TLS_HOST },
      { label: 'Leaf key', value: 'ECDSA P-256 · simulated' },
      { label: 'Intermediate', value: 'HOPSCOTCH Test Intermediate' },
      { label: 'Root', value: 'HOPSCOTCH Test Root · simulated trust anchor' },
    ], activates: ['early', 'handshake'], certificateState: 'unchecked',
  },
  {
    id: 'certificate-verify', atMs: 1510, actor: 'server', direction: 'server-to-client', phase: 'server-encrypted-flight', protection: 'handshake', message: 'CertificateVerify',
    title: 'Server proves possession of the certificate key', summary: 'A signature covers the TLS 1.3 CertificateVerify context and the handshake transcript.',
    detail: 'The client verifies this signature with the public key from the end-entity certificate. This binds the authenticated identity to the handshake transcript.',
    transcriptLabel: 'CertificateVerify', fields: [{ label: 'signature algorithm', value: 'ecdsa_secp256r1_sha256 · simulated signature' }], activates: ['early', 'handshake'], certificateState: 'validating',
  },
  {
    id: 'certificate-validation', atMs: 1690, actor: 'local', direction: 'local', phase: 'certificate-validation', protection: 'local', message: 'Certificate validation',
    title: 'Client validates identity and chain', summary: `Hostname ${TLS_HOST} matches; simulated chain and CertificateVerify proof validate.`,
    detail: 'This local step is a teaching abstraction for certificate/path/hostname verification. No public CA claim is made and the displayed chain is intentionally synthetic.',
    activates: ['early', 'handshake'], certificateState: 'valid',
  },
  {
    id: 'server-finished', atMs: 1900, actor: 'server', direction: 'server-to-client', phase: 'server-finished', protection: 'handshake', message: 'Finished',
    title: 'Server authenticates the handshake transcript', summary: 'Server Finished verifies the handshake state and completes the server authentication block.',
    detail: 'Finished is a MAC over the transcript using a key derived from the server handshake traffic secret. The client must verify it before trusting the completed server handshake.',
    transcriptLabel: 'Server Finished', fields: [{ label: 'verify_data', value: 'HMAC over transcript hash · symbolic' }], activates: ['early', 'handshake'], certificateState: 'valid',
  },
  {
    id: 'master-and-app-secrets', atMs: 2110, actor: 'local', direction: 'local', phase: 'application-keys', protection: 'local', message: 'Application key schedule',
    title: 'Master and application traffic secrets are derived', summary: 'The transcript through server Finished feeds client/server application traffic secret 0.',
    detail: 'TLS 1.3 derives application traffic secrets from the Master Secret and the transcript through the server Finished. The client still has one handshake-authentication message left to send.',
    activates: ['early', 'handshake', 'master', 'application'], certificateState: 'valid',
  },
  {
    id: 'client-finished', atMs: 2350, actor: 'client', direction: 'client-to-server', phase: 'client-finished', protection: 'handshake', message: 'Finished',
    title: 'Client Finished completes mutual key confirmation', summary: 'The client Finished is still protected with client handshake traffic keys.',
    detail: 'The client authenticates its view of the handshake transcript. After both sides have exchanged and validated Finished, this curated handshake is complete.',
    transcriptLabel: 'Client Finished', fields: [{ label: 'verify_data', value: 'HMAC over transcript hash · symbolic' }], activates: ['early', 'handshake', 'master', 'application'], certificateState: 'valid',
  },
  {
    id: 'application-data-request', atMs: 2720, actor: 'client', direction: 'client-to-server', phase: 'application-data', protection: 'application', message: 'Application Data',
    title: 'HTTP/2 request is now opaque TLS Application Data', summary: 'The record layer uses client application traffic secret 0 derived key/IV material.',
    detail: 'The protocol theater intentionally stops exposing application plaintext on the wire. HOPSCOTCH can still label the semantic payload because this is a curated teaching trace, not passive decryption.',
    fields: [{ label: 'semantic payload', value: 'HTTP/2 HEADERS · GET /' }], activates: ['early', 'handshake', 'master', 'application'], certificateState: 'valid',
  },
  {
    id: 'application-data-response', atMs: 3100, actor: 'server', direction: 'server-to-client', phase: 'application-data', protection: 'application', message: 'Application Data',
    title: 'Server responds under application traffic keys', summary: 'Encrypted TLS records carry the HTTP/2 response in the opposite direction.',
    detail: 'Client and server maintain separate application traffic secrets and therefore separate write keys/IVs. The record contents remain encrypted on the wire.',
    fields: [{ label: 'semantic payload', value: 'HTTP/2 HEADERS + DATA · 200' }], activates: ['early', 'handshake', 'master', 'application'], certificateState: 'valid',
  },
  {
    id: 'tls-complete', atMs: 3500, actor: 'local', direction: 'local', phase: 'complete', protection: 'local', message: 'Established TLS 1.3',
    title: 'Authenticated encrypted channel established', summary: 'TLS 1.3 negotiation, server authentication, Finished verification, and application-key transition are complete.',
    detail: 'This deterministic trace now provides a stable bridge from DNS resolution and TCP transport into HTTP/2 or HTTP/3 application behavior.',
    activates: ['early', 'handshake', 'master', 'application'], certificateState: 'valid',
  },
];

export const tlsDurationMs = 3800;

export function clampTlsTime(timeMs: number): number {
  return Math.max(0, Math.min(tlsDurationMs, timeMs));
}

export function tlsEventsAtOrBefore(timeMs: number): readonly TlsEvent[] {
  const time = clampTlsTime(timeMs);
  return tlsEvents.filter((event) => event.atMs <= time);
}

export function tlsLatestEventAtOrBefore(timeMs: number): TlsEvent {
  const events = tlsEventsAtOrBefore(timeMs);
  return events[events.length - 1] ?? tlsEvents[0];
}

function phaseLabel(phase: TlsPhase): string {
  switch (phase) {
    case 'client-hello': return 'CLIENT OFFER';
    case 'server-hello': return 'SERVER SELECTION';
    case 'handshake-keys': return 'HANDSHAKE KEYS READY';
    case 'server-encrypted-flight': return 'ENCRYPTED SERVER FLIGHT';
    case 'certificate-validation': return 'IDENTITY VALIDATION';
    case 'server-finished': return 'SERVER FINISHED';
    case 'client-finished': return 'CLIENT FINISHED';
    case 'application-keys': return 'APPLICATION KEYS READY';
    case 'application-data': return 'ENCRYPTED APPLICATION DATA';
    case 'complete': return 'TLS 1.3 ESTABLISHED';
  }
}

export function tlsStateAt(timeMs: number): TlsState {
  const time = clampTlsTime(timeMs);
  const events = tlsEventsAtOrBefore(time);
  const latest = events[events.length - 1] ?? tlsEvents[0];
  const transcript = events.flatMap((event) => event.transcriptLabel ? [event.transcriptLabel] : []);
  const activeKeys = Array.from(new Set(events.flatMap((event) => event.activates ?? []))) as TlsKeyStage[];
  const serverHelloSeen = events.some((event) => event.id === 'server-hello');
  const encryptedExtensionsSeen = events.some((event) => event.id === 'encrypted-extensions');
  const appKeysSeen = events.some((event) => event.id === 'master-and-app-secrets');
  const clientFinishedSeen = events.some((event) => event.id === 'client-finished');

  return {
    timeMs: time,
    phase: latest.phase,
    phaseLabel: phaseLabel(latest.phase),
    latestEventId: latest.id,
    transcript,
    activeKeys,
    protection: latest.protection,
    certificateState: latest.certificateState ?? 'unchecked',
    negotiatedVersion: serverHelloSeen ? 'TLS 1.3' : null,
    negotiatedCipher: serverHelloSeen ? 'TLS_AES_128_GCM_SHA256' : null,
    negotiatedGroup: serverHelloSeen ? 'X25519' : null,
    negotiatedAlpn: encryptedExtensionsSeen ? 'h2' : null,
    applicationReady: appKeysSeen && clientFinishedSeen,
  };
}
