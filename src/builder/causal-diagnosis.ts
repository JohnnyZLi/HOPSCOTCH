import type { BuilderApplicationStage, BuilderApplicationTransaction } from './application.ts';
import type { BuilderGraph } from './model.ts';

export type BuilderCausalDimensionId =
  | 'ADDRESSING'
  | 'DNS'
  | 'PHYSICAL'
  | 'L2'
  | 'RESOLUTION'
  | 'ROUTING'
  | 'POLICY'
  | 'TRANSLATION'
  | 'LINK'
  | 'TRANSPORT'
  | 'TLS'
  | 'APPLICATION'
  | 'RESPONSE';

export type BuilderCausalDimensionStatus = 'PASS' | 'FAIL' | 'NOT_REACHED' | 'NOT_APPLICABLE';

export interface BuilderCausalDimension {
  id: BuilderCausalDimensionId;
  label: string;
  status: BuilderCausalDimensionStatus;
  summary: string;
  detail: string;
  stageId: string | null;
  stageOrder: number | null;
  nodeIds: string[];
  linkIds: string[];
  provenance: 'SIMULATED';
}

export interface BuilderCausalDiagnosisStep {
  id: string;
  dimension: BuilderCausalDimensionId;
  label: string;
  detail: string;
  stageId: string | null;
  status: Exclude<BuilderCausalDimensionStatus, 'NOT_REACHED'>;
}

export interface BuilderCausalDiagnosis {
  transactionId: string;
  transactionSequence: number;
  terminal: boolean;
  success: boolean;
  visibleThroughStageOrder: number;
  firstBrokenBoundary: BuilderApplicationTransaction['firstBrokenBoundary'];
  firstBrokenDimension: BuilderCausalDimensionId | null;
  dimensions: BuilderCausalDimension[];
  causalChain: BuilderCausalDiagnosisStep[];
  summary: string;
  boundary: string;
}

const LABELS: Record<BuilderCausalDimensionId, string> = {
  ADDRESSING: 'HOST ADDRESSING',
  DNS: 'SERVICE / DNS',
  PHYSICAL: 'PHYSICAL REACHABILITY',
  L2: 'L2 FORWARDING',
  RESOLUTION: 'NEXT-HOP RESOLUTION',
  ROUTING: 'ROUTE / FIB',
  POLICY: 'POLICY',
  TRANSLATION: 'TRANSLATION STATE',
  LINK: 'DATA-PLANE LINK',
  TRANSPORT: 'TRANSPORT',
  TLS: 'TLS / QUIC CRYPTO',
  APPLICATION: 'APPLICATION',
  RESPONSE: 'RETURN PATH',
};

function stageByOrder(transaction: BuilderApplicationTransaction, order: number): BuilderApplicationStage | null {
  return transaction.stages.find((stage) => stage.order === order) ?? null;
}

function dimensionFromStage(
  id: BuilderCausalDimensionId,
  stage: BuilderApplicationStage | null,
  visibleThroughStageOrder: number,
  overrides: Partial<Pick<BuilderCausalDimension, 'status' | 'summary' | 'detail' | 'nodeIds' | 'linkIds'>> = {},
): BuilderCausalDimension {
  if (!stage || stage.order > visibleThroughStageOrder) {
    return {
      id,
      label: LABELS[id],
      status: 'NOT_REACHED',
      summary: 'NOT REACHED',
      detail: `The selected historical event has not reached ${LABELS[id]} yet.`,
      stageId: stage?.id ?? null,
      stageOrder: stage?.order ?? null,
      nodeIds: [],
      linkIds: [],
      provenance: 'SIMULATED',
      ...overrides,
    };
  }
  return {
    id,
    label: LABELS[id],
    status: stage.status,
    summary: stage.summary,
    detail: stage.detail,
    stageId: stage.id,
    stageOrder: stage.order,
    nodeIds: [...stage.nodeIds],
    linkIds: [...stage.linkIds],
    provenance: 'SIMULATED',
    ...overrides,
  };
}

function physicalDimension(transaction: BuilderApplicationTransaction, graph: BuilderGraph, visibleThroughStageOrder: number): BuilderCausalDimension {
  if (visibleThroughStageOrder < 3) return dimensionFromStage('PHYSICAL', stageByOrder(transaction, 3), visibleThroughStageOrder);
  const visibleStages = transaction.stages.filter((stage) => stage.order <= visibleThroughStageOrder && stage.status !== 'NOT_REACHED');
  const linkIds = [...new Set(visibleStages.flatMap((stage) => stage.linkIds))];
  const failed = linkIds.filter((linkId) => graph.links.find((link) => link.id === linkId)?.failed);
  const physicalEvidenceReached = visibleStages.some((stage) => stage.order >= 3);
  if (!physicalEvidenceReached) return dimensionFromStage('PHYSICAL', stageByOrder(transaction, 3), visibleThroughStageOrder);
  return {
    id: 'PHYSICAL',
    label: LABELS.PHYSICAL,
    status: failed.length > 0 ? 'FAIL' : 'PASS',
    summary: failed.length > 0 ? `FAILED LINKS · ${failed.join(', ')}` : linkIds.length > 0 ? `${linkIds.length} ACTIVE PATH LINK${linkIds.length === 1 ? '' : 'S'}` : 'NO FAILED PATH LINK OBSERVED',
    detail: failed.length > 0
      ? `The selected canonical topology marks ${failed.join(', ')} DOWN before higher-layer success can be claimed.`
      : 'Physical link state is evaluated independently from VLAN, resolution, route selection, policy, translation, transport, and application state.',
    stageId: stageByOrder(transaction, 3)?.id ?? null,
    stageOrder: 3,
    nodeIds: [...new Set(visibleStages.flatMap((stage) => stage.nodeIds))],
    linkIds,
    provenance: 'SIMULATED',
  };
}

function splitL2(transaction: BuilderApplicationTransaction, visibleThroughStageOrder: number): [BuilderCausalDimension, BuilderCausalDimension] {
  const stage = stageByOrder(transaction, 3);
  if (!stage || stage.order > visibleThroughStageOrder || stage.status === 'NOT_REACHED') {
    return [dimensionFromStage('L2', stage, visibleThroughStageOrder), dimensionFromStage('RESOLUTION', stage, visibleThroughStageOrder)];
  }
  if (stage.status === 'FAIL' && stage.boundary === 'L2') {
    return [
      dimensionFromStage('L2', stage, visibleThroughStageOrder),
      dimensionFromStage('RESOLUTION', stage, 0, { detail: 'Next-hop resolution was never evaluated because Layer-2 access failed first.' }),
    ];
  }
  if (stage.status === 'FAIL' && stage.boundary === 'RESOLUTION') {
    return [
      dimensionFromStage('L2', stage, visibleThroughStageOrder, { status: 'PASS', summary: 'L2 ACCESS AVAILABLE', detail: 'The broadcast/access domain exists; next-hop resolution is the first failing sub-boundary.' }),
      dimensionFromStage('RESOLUTION', stage, visibleThroughStageOrder),
    ];
  }
  return [
    dimensionFromStage('L2', stage, visibleThroughStageOrder, { status: 'PASS', summary: transaction.family === 'ipv6' ? 'L2 ACCESS BOUNDARY AVAILABLE' : `${transaction.l2.sourceMode} · ${transaction.l2.destinationMode}` }),
    dimensionFromStage('RESOLUTION', stage, visibleThroughStageOrder, { status: 'PASS', summary: transaction.family === 'ipv6' ? stage.summary : 'NEXT HOPS RESOLVED' }),
  ];
}

function splitPolicyTranslation(transaction: BuilderApplicationTransaction, visibleThroughStageOrder: number): [BuilderCausalDimension, BuilderCausalDimension] {
  const stage = stageByOrder(transaction, 5);
  if (!stage || stage.order > visibleThroughStageOrder || stage.status === 'NOT_REACHED') {
    return [dimensionFromStage('POLICY', stage, visibleThroughStageOrder), dimensionFromStage('TRANSLATION', stage, visibleThroughStageOrder)];
  }
  const evidence = `${stage.summary} ${stage.detail} ${transaction.natRequest?.failureReason ?? ''}`.toUpperCase();
  const policyFailure = stage.status === 'FAIL' && /ACL|POLICY|DENY|DENIED|FIREWALL/.test(evidence);
  if (stage.status === 'FAIL') {
    if (policyFailure) {
      return [
        dimensionFromStage('POLICY', stage, visibleThroughStageOrder),
        dimensionFromStage('TRANSLATION', stage, 0, { detail: 'Translation was not evaluated after the policy boundary denied the request.' }),
      ];
    }
    return [
      dimensionFromStage('POLICY', stage, visibleThroughStageOrder, { status: 'PASS', summary: 'POLICY PERMITTED', detail: 'No policy denial is present in the canonical ACL/NAT result; translation state is the failing sub-boundary.' }),
      dimensionFromStage('TRANSLATION', stage, visibleThroughStageOrder),
    ];
  }
  const translated = Boolean(transaction.natRequest?.translation);
  return [
    dimensionFromStage('POLICY', stage, visibleThroughStageOrder, { status: 'PASS', summary: 'POLICY PERMITTED' }),
    dimensionFromStage('TRANSLATION', stage, visibleThroughStageOrder, transaction.family === 'ipv6'
      ? { status: 'NOT_APPLICABLE', summary: 'NO NAT66', detail: 'IPv6 policy passed and Builder deliberately does not invent NAT66.' }
      : translated
        ? { status: 'PASS', summary: `${transaction.natRequest?.translation?.kind.toUpperCase() ?? 'NAT'} ACTIVE`, detail: transaction.natRequest?.explanation ?? stage.detail }
        : { status: 'NOT_APPLICABLE', summary: 'NO TRANSLATION REQUIRED', detail: 'Policy passed and this path does not require a NAT translation.' }),
  ];
}

function tlsDimension(transaction: BuilderApplicationTransaction, visibleThroughStageOrder: number): BuilderCausalDimension {
  const stage = stageByOrder(transaction, 8);
  if (!stage || stage.order > visibleThroughStageOrder) return dimensionFromStage('TLS', stage, visibleThroughStageOrder);
  if (stage.status === 'PASS' && /NOT REQUIRED/.test(stage.summary.toUpperCase())) {
    return dimensionFromStage('TLS', stage, visibleThroughStageOrder, { status: 'NOT_APPLICABLE' });
  }
  return dimensionFromStage('TLS', stage, visibleThroughStageOrder);
}

export function diagnoseBuilderApplicationTransaction(
  transaction: BuilderApplicationTransaction,
  graph: BuilderGraph,
  visibleThroughStageOrder: number | null = null,
): BuilderCausalDiagnosis {
  const limit = Math.max(0, Math.min(10, visibleThroughStageOrder ?? 10));
  const [l2, resolution] = splitL2(transaction, limit);
  const [policy, translation] = splitPolicyTranslation(transaction, limit);
  const dimensions: BuilderCausalDimension[] = [
    dimensionFromStage('ADDRESSING', stageByOrder(transaction, 1), limit),
    dimensionFromStage('DNS', stageByOrder(transaction, 2), limit),
    physicalDimension(transaction, graph, limit),
    l2,
    resolution,
    dimensionFromStage('ROUTING', stageByOrder(transaction, 4), limit),
    policy,
    translation,
    dimensionFromStage('LINK', stageByOrder(transaction, 6), limit),
    dimensionFromStage('TRANSPORT', stageByOrder(transaction, 7), limit),
    tlsDimension(transaction, limit),
    dimensionFromStage('APPLICATION', stageByOrder(transaction, 9), limit),
    dimensionFromStage('RESPONSE', stageByOrder(transaction, 10), limit),
  ];
  const firstFail = dimensions.find((dimension) => dimension.status === 'FAIL') ?? null;
  const terminal = transaction.firstBrokenBoundary != null
    ? transaction.stages.find((stage) => stage.status === 'FAIL')?.order != null && (transaction.stages.find((stage) => stage.status === 'FAIL')?.order ?? 99) <= limit
    : limit >= 10;
  const firstBrokenBoundary = terminal ? transaction.firstBrokenBoundary : null;
  const causalChain = dimensions
    .filter((dimension) => dimension.status === 'PASS' || dimension.status === 'FAIL' || dimension.status === 'NOT_APPLICABLE')
    .slice(0, firstFail ? dimensions.indexOf(firstFail) + 1 : dimensions.length)
    .map((dimension): BuilderCausalDiagnosisStep => ({
      id: `diagnosis:${transaction.id}:${dimension.id}`,
      dimension: dimension.id,
      label: `${dimension.label} · ${dimension.status}`,
      detail: dimension.detail,
      stageId: dimension.stageId,
      status: dimension.status as Exclude<BuilderCausalDimensionStatus, 'NOT_REACHED'>,
    }));
  const summary = firstFail
    ? `FIRST BROKEN TRUTH BOUNDARY · ${firstFail.label} · ${firstFail.summary}`
    : terminal && transaction.success
      ? 'ALL EVALUATED TRUTH BOUNDARIES PASSED'
      : `CAUSAL REPLAY IN PROGRESS · THROUGH STAGE ${limit}`;
  return {
    transactionId: transaction.id,
    transactionSequence: transaction.sequence,
    terminal,
    success: terminal && transaction.success && firstFail == null,
    visibleThroughStageOrder: limit,
    firstBrokenBoundary,
    firstBrokenDimension: firstFail?.id ?? null,
    dimensions,
    causalChain,
    summary,
    boundary: 'Track A diagnosis is a deterministic projection of canonical Track D stages plus the selected Builder topology snapshot. It never reruns forwarding, policy, NAT, transport, or application behavior and never replaces the transaction firstBrokenBoundary.',
  };
}
