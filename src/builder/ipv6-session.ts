import { createBuilderIpv6ControlState, type BuilderIpv6ControlState } from './ipv6-control-plane.ts';

const listeners = new Set<() => void>();
let controlState = createBuilderIpv6ControlState();
let probePacketBytes = 1280;

function emit(): void {
  for (const listener of listeners) listener();
}

export function getBuilderIpv6SessionState(): BuilderIpv6ControlState {
  return controlState;
}

export function setBuilderIpv6SessionState(next: BuilderIpv6ControlState): void {
  controlState = next;
  emit();
}

export function resetBuilderIpv6SessionState(): void {
  controlState = createBuilderIpv6ControlState();
  emit();
}

export function getBuilderIpv6ProbePacketBytes(): number {
  return probePacketBytes;
}

export function setBuilderIpv6ProbePacketBytes(next: number): void {
  const bounded = Math.max(80, Math.min(9216, Math.round(next || 1280)));
  if (bounded === probePacketBytes) return;
  probePacketBytes = bounded;
  emit();
}

export function subscribeBuilderIpv6Session(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
