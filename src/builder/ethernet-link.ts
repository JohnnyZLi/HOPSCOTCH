export interface BuilderEthernetCarrierLink {
  id: string;
  a: string;
  b: string;
  mode: 'access' | 'trunk' | 'routed';
  accessVlan?: number;
  allowedVlans?: number[];
  failed: boolean;
  nativeVlanA?: number | null;
  nativeVlanB?: number | null;
  bundleId?: string | null;
}

export function builderEthernetLinkPreservesVlan(link: BuilderEthernetCarrierLink, vlanId: number): boolean {
  if (link.failed || link.mode === 'routed') return false;
  if (link.mode === 'access') return link.accessVlan === vlanId;
  if (!link.allowedVlans?.includes(vlanId)) return false;
  const aUntagged = link.nativeVlanA === vlanId;
  const bUntagged = link.nativeVlanB === vlanId;
  return aUntagged === bUntagged;
}

export function builderEthernetBundleForwardingMemberId(
  links: readonly BuilderEthernetCarrierLink[],
  link: BuilderEthernetCarrierLink,
  vlanId: number,
): string | null {
  if (!builderEthernetLinkPreservesVlan(link, vlanId)) return null;
  if (!link.bundleId) return link.id;
  return links
    .filter((candidate) => candidate.bundleId === link.bundleId && builderEthernetLinkPreservesVlan(candidate, vlanId))
    .map((candidate) => candidate.id)
    .sort()[0] ?? null;
}

export function builderEthernetLogicalLinkCarriesVlan(
  links: readonly BuilderEthernetCarrierLink[],
  link: BuilderEthernetCarrierLink,
  vlanId: number,
): boolean {
  return builderEthernetBundleForwardingMemberId(links, link, vlanId) === link.id;
}
