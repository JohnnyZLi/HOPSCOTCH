import type { BuilderGraph } from './model.ts';

export interface BuilderLinkProfile {
  latencyMs: number;
  jitterMs: number;
  bandwidthMbps: number;
  lossPercent: number;
  mtuBytes: number;
  queuePackets: number;
}

export type BuilderLinkProfiles = Record<string, BuilderLinkProfile>;

export interface BuilderPathCharacteristics {
  linkIds: string[];
  oneWayLatencyMs: number;
  jitterMs: number;
  bottleneckMbps: number | null;
  lossPercent: number;
  pathMtuBytes: number | null;
  queuePackets: number | null;
}

export const DEFAULT_BUILDER_LINK_PROFILE: BuilderLinkProfile = {
  latencyMs: 5,
  jitterMs: 0,
  bandwidthMbps: 1000,
  lossPercent: 0,
  mtuBytes: 1500,
  queuePackets: 256,
};

function cloneProfile(profile: BuilderLinkProfile): BuilderLinkProfile { return { ...profile }; }

export function createDefaultBuilderLinkProfiles(graph: BuilderGraph): BuilderLinkProfiles {
  return Object.fromEntries(graph.links.map((link) => [link.id, cloneProfile(DEFAULT_BUILDER_LINK_PROFILE)]));
}

export function cloneBuilderLinkProfiles(profiles: BuilderLinkProfiles): BuilderLinkProfiles {
  return Object.fromEntries(Object.entries(profiles).map(([id, profile]) => [id, cloneProfile(profile)]));
}

export function validateBuilderLinkProfile(profile: BuilderLinkProfile): BuilderLinkProfile {
  const latencyMs = Number(profile.latencyMs);
  const jitterMs = Number(profile.jitterMs);
  const bandwidthMbps = Number(profile.bandwidthMbps);
  const lossPercent = Number(profile.lossPercent);
  const mtuBytes = Number(profile.mtuBytes);
  const queuePackets = Number(profile.queuePackets);
  if (!Number.isFinite(latencyMs) || latencyMs < 0 || latencyMs > 5000) throw new Error('Link latency must be 0–5000 ms.');
  if (!Number.isFinite(jitterMs) || jitterMs < 0 || jitterMs > 2000) throw new Error('Link jitter must be 0–2000 ms.');
  if (!Number.isFinite(bandwidthMbps) || bandwidthMbps <= 0 || bandwidthMbps > 1_000_000) throw new Error('Link bandwidth must be greater than 0 and at most 1,000,000 Mb/s.');
  if (!Number.isFinite(lossPercent) || lossPercent < 0 || lossPercent > 100) throw new Error('Link loss must be 0–100%.');
  if (!Number.isInteger(mtuBytes) || mtuBytes < 68 || mtuBytes > 9216) throw new Error('Link MTU must be an integer from 68–9216 bytes.');
  if (!Number.isInteger(queuePackets) || queuePackets < 1 || queuePackets > 1_000_000) throw new Error('Link queue capacity must be an integer from 1–1,000,000 packets.');
  return { latencyMs, jitterMs, bandwidthMbps, lossPercent, mtuBytes, queuePackets };
}

export function validateBuilderLinkProfiles(graph: BuilderGraph, profiles: BuilderLinkProfiles): BuilderLinkProfiles {
  const links = new Set(graph.links.map((link) => link.id));
  const next: BuilderLinkProfiles = {};
  for (const link of graph.links) next[link.id] = validateBuilderLinkProfile(profiles?.[link.id] ?? DEFAULT_BUILDER_LINK_PROFILE);
  for (const id of Object.keys(profiles ?? {})) if (!links.has(id)) throw new Error(`Link profile references unknown link ${id}.`);
  return next;
}

export function reconcileBuilderLinkProfiles(graph: BuilderGraph, profiles: BuilderLinkProfiles): BuilderLinkProfiles {
  const next: BuilderLinkProfiles = {};
  for (const link of graph.links) next[link.id] = validateBuilderLinkProfile(profiles?.[link.id] ?? DEFAULT_BUILDER_LINK_PROFILE);
  return next;
}

export function updateBuilderLinkProfile(graph: BuilderGraph, profiles: BuilderLinkProfiles, linkId: string, patch: Partial<BuilderLinkProfile>): BuilderLinkProfiles {
  if (!graph.links.some((link) => link.id === linkId)) throw new Error(`Unknown routed link ${linkId}.`);
  const current = profiles[linkId] ?? DEFAULT_BUILDER_LINK_PROFILE;
  return { ...reconcileBuilderLinkProfiles(graph, profiles), [linkId]: validateBuilderLinkProfile({ ...current, ...patch }) };
}

export function builderPathCharacteristics(profiles: BuilderLinkProfiles, linkIds: string[]): BuilderPathCharacteristics {
  if (linkIds.length === 0) return { linkIds: [], oneWayLatencyMs: 0, jitterMs: 0, bottleneckMbps: null, lossPercent: 0, pathMtuBytes: null, queuePackets: null };
  const resolved = linkIds.map((id) => profiles[id] ?? DEFAULT_BUILDER_LINK_PROFILE);
  const survival = resolved.reduce((value, profile) => value * (1 - profile.lossPercent / 100), 1);
  return {
    linkIds: [...linkIds],
    oneWayLatencyMs: resolved.reduce((sum, profile) => sum + profile.latencyMs, 0),
    jitterMs: resolved.reduce((sum, profile) => sum + profile.jitterMs, 0),
    bottleneckMbps: Math.min(...resolved.map((profile) => profile.bandwidthMbps)),
    lossPercent: (1 - survival) * 100,
    pathMtuBytes: Math.min(...resolved.map((profile) => profile.mtuBytes)),
    queuePackets: Math.min(...resolved.map((profile) => profile.queuePackets)),
  };
}

function stableUnit(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) { hash ^= seed.charCodeAt(index); hash = Math.imul(hash, 16777619) >>> 0; }
  return hash / 0xffffffff;
}

export function deterministicBuilderPathDrop(profiles: BuilderLinkProfiles, linkIds: string[], seed: string): string | null {
  for (const [index, linkId] of linkIds.entries()) {
    const profile = profiles[linkId] ?? DEFAULT_BUILDER_LINK_PROFILE;
    if (profile.lossPercent <= 0) continue;
    if (stableUnit(`${seed}:${index}:${linkId}`) < profile.lossPercent / 100) return linkId;
  }
  return null;
}

export function builderRoundTripCharacteristics(profiles: BuilderLinkProfiles, requestLinkIds: string[], responseLinkIds: string[]): BuilderPathCharacteristics & { rttMs: number } {
  const request = builderPathCharacteristics(profiles, requestLinkIds);
  const response = builderPathCharacteristics(profiles, responseLinkIds);
  const all = [...requestLinkIds, ...responseLinkIds];
  const path = builderPathCharacteristics(profiles, all);
  return { ...path, rttMs: request.oneWayLatencyMs + response.oneWayLatencyMs };
}
