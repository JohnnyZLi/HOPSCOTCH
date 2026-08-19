export interface BuilderEthernetCarrierLink {
  id: string;
  mode: 'access' | 'trunk' | 'routed';
  accessVlan?: number;
  allowedVlans?: number[];
  failed: boolean;
  nativeVlanA?: number | null;
  nativeVlanB?: number | null;
  bundleId?: string | null;
}

export function builderEthernetLogicalLinkCarriesVlan(links: readonly BuilderEthernetCarrierLink[], link: BuilderEthernetCarrierLink, vlanId: number): boolean {
  const carries = (candidate: BuilderEthernetCarrierLink) => !candidate.failed && candidate.mode !== 'routed' && (candidate.mode === 'access' ? candidate.accessVlan === vlanId : !!candidate.allowedVlans?.includes(vlanId) && (candidate.nativeVlanA === vlanId) === (candidate.nativeVlanB === vlanId));
  return carries(link) && (!link.bundleId || !links.some((candidate) => candidate.bundleId === link.bundleId && candidate.id < link.id && carries(candidate)));
}