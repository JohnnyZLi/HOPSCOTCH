import {
  clampScenarioTime,
  eventsAtOrBefore,
  type SimulationEvent,
  type SimulationScenario,
  type SimulationState,
} from './model';

export const lab01Scenario: SimulationScenario = {
  id: 'lab-01-failure-recovery',
  title: 'Failure and recovery',
  durationMs: 7000,
  nodes: [
    { id: 'client', label: 'Client', shortLabel: 'CLIENT', x: 9, y: 52, kind: 'client' },
    { id: 'edge', label: 'Edge Router', shortLabel: 'EDGE', x: 27, y: 52, kind: 'edge' },
    { id: 'r1', label: 'Router 1', shortLabel: 'R1', x: 48, y: 29, kind: 'router' },
    { id: 'r2', label: 'Router 2', shortLabel: 'R2', x: 48, y: 75, kind: 'router' },
    { id: 'core', label: 'Core Router', shortLabel: 'CORE', x: 70, y: 52, kind: 'router' },
    { id: 'service', label: 'Application', shortLabel: 'APP', x: 91, y: 52, kind: 'service' },
  ],
  links: [
    { id: 'client-edge', from: 'client', to: 'edge', metric: 1, role: 'access' },
    { id: 'edge-r1', from: 'edge', to: 'r1', metric: 10, role: 'primary' },
    { id: 'edge-r2', from: 'edge', to: 'r2', metric: 30, role: 'alternate' },
    { id: 'r1-r2', from: 'r1', to: 'r2', metric: 20, role: 'control' },
    { id: 'r1-core', from: 'r1', to: 'core', metric: 10, role: 'primary' },
    { id: 'r2-core', from: 'r2', to: 'core', metric: 20, role: 'alternate' },
    { id: 'core-service', from: 'core', to: 'service', metric: 1, role: 'service' },
  ],
  paths: [
    {
      id: 'primary',
      label: 'Primary path',
      nodeIds: ['client', 'edge', 'r1', 'core', 'service'],
      linkIds: ['client-edge', 'edge-r1', 'r1-core', 'core-service'],
      metric: 22,
    },
    {
      id: 'alternate',
      label: 'Alternate path',
      nodeIds: ['client', 'edge', 'r2', 'core', 'service'],
      linkIds: ['client-edge', 'edge-r2', 'r2-core', 'core-service'],
      metric: 52,
    },
  ],
  events: [
    {
      id: 'flow-established',
      atMs: 0,
      kind: 'flow.start',
      actorId: 'client',
      targetId: 'service',
      payload: {
        title: 'Primary path established',
        summary: 'Application traffic is flowing through R1 on the lowest-cost route.',
        detail: 'The edge router prefers CLIENT → EDGE → R1 → CORE → APP with total metric 22. R2 remains a valid but more expensive standby path.',
        severity: 'info',
        pathId: 'primary',
      },
    },
    {
      id: 'primary-link-fails',
      atMs: 1900,
      kind: 'link.failure',
      actorId: 'r1',
      targetId: 'core',
      payload: {
        title: 'Primary link fails',
        summary: 'The R1 ↔ CORE adjacency disappears and the forwarding path is broken.',
        detail: 'Traffic can no longer traverse the installed primary route. The physical failure is immediate; control-plane convergence is not.',
        severity: 'critical',
        linkId: 'r1-core',
      },
    },
    {
      id: 'lsa-originates',
      atMs: 2500,
      kind: 'route.advertise',
      actorId: 'r1',
      targetId: 'edge',
      payload: {
        title: 'R1 floods new link state',
        summary: 'R1 advertises that the R1 ↔ CORE link is no longer reachable.',
        detail: 'The topology change begins propagating through surviving adjacencies. Routers are learning about the failure, but forwarding has not recovered yet.',
        severity: 'warning',
        linkId: 'r1-core',
        propagationLinkIds: ['edge-r1', 'r1-r2'],
      },
    },
    {
      id: 'lsa-propagates',
      atMs: 3150,
      kind: 'route.advertise',
      actorId: 'r2',
      targetId: 'core',
      payload: {
        title: 'Failure knowledge propagates',
        summary: 'R2 and CORE now share the updated topology view.',
        detail: 'The link-state database converges across the surviving path. Once the relevant routers have the same topology, shortest-path calculation can produce a replacement route.',
        severity: 'warning',
        propagationLinkIds: ['edge-r2', 'r2-core'],
      },
    },
    {
      id: 'spf-recompute',
      atMs: 3800,
      kind: 'route.recompute',
      actorId: 'edge',
      targetId: 'service',
      payload: {
        title: 'SPF selects the alternate path',
        summary: 'The failed edge is removed from the graph and the standby route through R2 wins.',
        detail: 'CLIENT → EDGE → R2 → CORE → APP is more expensive than the original route, but it is now the lowest-cost viable path.',
        severity: 'info',
        pathId: 'alternate',
      },
    },
    {
      id: 'traffic-reroutes',
      atMs: 4500,
      kind: 'flow.reroute',
      actorId: 'edge',
      targetId: 'r2',
      payload: {
        title: 'Forwarding moves to R2',
        summary: 'New traffic leaves the edge router on the alternate next hop.',
        detail: 'The forwarding plane installs the replacement route. The route exists again, but the application still has to absorb the disruption that occurred during convergence.',
        severity: 'info',
        pathId: 'alternate',
      },
    },
    {
      id: 'application-recovers',
      atMs: 5400,
      kind: 'flow.recover',
      actorId: 'client',
      targetId: 'service',
      payload: {
        title: 'Traffic recovers',
        summary: 'The application flow is healthy again over the alternate route.',
        detail: 'The failed R1 ↔ CORE link remains down. Recovery comes from routing around the failure, not from restoring the failed link.',
        severity: 'success',
        pathId: 'alternate',
      },
    },
  ],
};

const initialState: SimulationState = {
  timeMs: 0,
  phase: 'steady',
  statusLabel: 'PRIMARY PATH HEALTHY',
  activePathId: 'primary',
  failedLinkIds: [],
  controlLinkIds: [],
  latestEventId: 'flow-established',
};

function addUnique(items: readonly string[], item: string): readonly string[] {
  return items.includes(item) ? items : [...items, item];
}

function reduceEvent(state: SimulationState, event: SimulationEvent): SimulationState {
  const base = { ...state, latestEventId: event.id };

  switch (event.kind) {
    case 'flow.start':
      return {
        ...base,
        phase: 'steady',
        statusLabel: 'PRIMARY PATH HEALTHY',
        activePathId: event.payload.pathId ?? state.activePathId,
        controlLinkIds: [],
      };
    case 'link.failure':
      return {
        ...base,
        phase: 'failure',
        statusLabel: 'FORWARDING PATH BROKEN',
        failedLinkIds: event.payload.linkId
          ? addUnique(state.failedLinkIds, event.payload.linkId)
          : state.failedLinkIds,
        controlLinkIds: [],
      };
    case 'route.advertise':
      return {
        ...base,
        phase: 'converging',
        statusLabel: 'LINK STATE PROPAGATING',
        controlLinkIds: event.payload.propagationLinkIds ?? [],
      };
    case 'route.recompute':
      return {
        ...base,
        phase: 'recomputing',
        statusLabel: 'SHORTEST PATH RECALCULATING',
        controlLinkIds: [],
      };
    case 'flow.reroute':
      return {
        ...base,
        phase: 'rerouting',
        statusLabel: 'ALTERNATE PATH INSTALLED',
        activePathId: event.payload.pathId ?? state.activePathId,
        controlLinkIds: [],
      };
    case 'flow.recover':
      return {
        ...base,
        phase: 'recovered',
        statusLabel: 'TRAFFIC RECOVERED',
        activePathId: event.payload.pathId ?? state.activePathId,
        controlLinkIds: [],
      };
    case 'link.restore':
      return {
        ...base,
        failedLinkIds: event.payload.linkId
          ? state.failedLinkIds.filter((linkId) => linkId !== event.payload.linkId)
          : state.failedLinkIds,
      };
    default:
      return base;
  }
}

export function lab01StateAt(timeMs: number): SimulationState {
  const clamped = clampScenarioTime(lab01Scenario, timeMs);
  const state = eventsAtOrBefore(lab01Scenario, clamped).reduce(reduceEvent, initialState);
  return { ...state, timeMs: clamped };
}
