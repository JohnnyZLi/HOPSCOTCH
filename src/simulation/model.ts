export type NetworkLayer = 'internet' | 'routing' | 'transport' | 'application' | 'packet';

export type SimulationEventKind =
  | 'link.failure'
  | 'link.restore'
  | 'packet.send'
  | 'packet.receive'
  | 'route.advertise'
  | 'route.recompute'
  | 'transport.window'
  | 'protocol.message';

export type SimulationEvent<TPayload = unknown> = {
  id: string;
  atMs: number;
  kind: SimulationEventKind;
  actorId?: string;
  targetId?: string;
  payload: TPayload;
};

export type SimulationFrame = {
  timeMs: number;
  events: readonly SimulationEvent[];
};

export type SimulationScenario = {
  id: string;
  title: string;
  durationMs: number;
  events: readonly SimulationEvent[];
};

export function eventsAtOrBefore(
  scenario: SimulationScenario,
  timeMs: number,
): readonly SimulationEvent[] {
  return scenario.events.filter((event) => event.atMs <= timeMs);
}
