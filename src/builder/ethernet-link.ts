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
  const carries = (candidate: BuilderEthernetCarrierLink) => !candidate.failed && candidate.mode !== 'routed' && (candidate.mode === 'access' ? candidate.accessVlan === vlanId : Boolean(candidate.allowedVlans?.includes(vlanId)) && (candidate.nativeVlanA === vlanId) === (candidate.nativeVlanB === vlanId));
  if (!carries(link)) return false;
  if (!link.bundleId) return true;
  return links.filter((candidate) => candidate.bundleId === link.bundleId && carries(candidate)).map((candidate) => candidate.id).sort()[0] === link.id;
}
