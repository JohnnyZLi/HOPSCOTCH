export type NetworkLayer = 'internet' | 'routing' | 'transport' | 'application' | 'packet';

export type TopologyNodeKind = 'client' | 'edge' | 'router' | 'service';

export type TopologyNode = {
  id: string;
  label: string;
  shortLabel: string;
  x: number;
  y: number;
  kind: TopologyNodeKind;
};

export type TopologyLink = {
  id: string;
  from: string;
  to: string;
  metric: number;
  role: 'access' | 'primary' | 'alternate' | 'control' | 'service';
};

export type TrafficPath = {
  id: string;
  label: string;
  nodeIds: readonly string[];
  linkIds: readonly string[];
  metric: number;
};

export type SimulationEventKind =
  | 'flow.start'
  | 'link.failure'
  | 'link.restore'
  | 'route.advertise'
  | 'route.recompute'
  | 'flow.reroute'
  | 'flow.recover'
  | 'packet.send'
  | 'packet.receive'
  | 'transport.window'
  | 'protocol.message';

export type EventSeverity = 'info' | 'warning' | 'critical' | 'success';

export type SimulationEventPayload = {
  title: string;
  summary: string;
  detail: string;
  severity: EventSeverity;
  linkId?: string;
  pathId?: string;
  propagationLinkIds?: readonly string[];
};

export type SimulationEvent = {
  id: string;
  atMs: number;
  kind: SimulationEventKind;
  actorId?: string;
  targetId?: string;
  payload: SimulationEventPayload;
};

export type SimulationPhase =
  | 'steady'
  | 'failure'
  | 'converging'
  | 'recomputing'
  | 'rerouting'
  | 'recovered';

export type SimulationState = {
  timeMs: number;
  phase: SimulationPhase;
  statusLabel: string;
  activePathId: string;
  failedLinkIds: readonly string[];
  controlLinkIds: readonly string[];
  latestEventId: string;
};

export type SimulationScenario = {
  id: string;
  title: string;
  durationMs: number;
  nodes: readonly TopologyNode[];
  links: readonly TopologyLink[];
  paths: readonly TrafficPath[];
  events: readonly SimulationEvent[];
};

export function clampScenarioTime(scenario: SimulationScenario, timeMs: number): number {
  return Math.max(0, Math.min(scenario.durationMs, timeMs));
}

export function eventsAtOrBefore(
  scenario: SimulationScenario,
  timeMs: number,
): readonly SimulationEvent[] {
  const clamped = clampScenarioTime(scenario, timeMs);
  return scenario.events.filter((event) => event.atMs <= clamped);
}

export function latestEventAtOrBefore(
  scenario: SimulationScenario,
  timeMs: number,
): SimulationEvent {
  const visible = eventsAtOrBefore(scenario, timeMs);
  return visible[visible.length - 1] ?? scenario.events[0];
}
