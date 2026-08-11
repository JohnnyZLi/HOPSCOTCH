import fs from 'node:fs';

function replaceOnce(path, search, replacement) {
  const source = fs.readFileSync(path, 'utf8');
  const count = source.split(search).length - 1;
  if (count !== 1) throw new Error(`${path}: expected one match, found ${count}: ${search.slice(0, 90)}`);
  fs.writeFileSync(path, source.replace(search, replacement));
}

const model = 'src/journey/model.ts';
const modifiers = 'src/journey/modifiers.ts';

replaceOnce(
  model,
  "export type JourneyImpairmentProfile = 'clean' | 'single-loss' | 'latency-spike';",
  "export type JourneyImpairmentProfile = 'clean' | 'single-loss' | 'latency-spike' | 'route-failure';",
);

replaceOnce(
  model,
  "export type JourneyDetailLab = 'dns' | 'tcp' | 'tls' | 'http' | 'packet' | 'builder' | 'internet' | 'physical' | 'observed';",
  "export type JourneyDetailLab = 'dns' | 'tcp' | 'tls' | 'http' | 'packet' | 'builder' | 'failure' | 'internet' | 'physical' | 'observed';",
);

replaceOnce(
  model,
  "  | 'route.lookup'\n  | 'route.gateway'\n  | 'internet.policy-path'",
  "  | 'route.lookup'\n  | 'route.gateway'\n  | 'route.failure'\n  | 'route.invalidated'\n  | 'route.recompute'\n  | 'route.alternate-installed'\n  | 'internet.policy-path'",
);

replaceOnce(
  model,
  "export interface JourneyTransportMetrics {\n  baselineRttMs?: number;\n  latestRttMs?: number;\n  adjustedRttMs?: number;\n  smoothedRttMs?: number;\n  rttVarMs?: number;\n  ackDelayMs?: number;\n  timerLabel?: 'RTO' | 'PTO';\n  timerMs?: number;\n  lossDetected?: boolean;\n}\n",
  "export interface JourneyTransportMetrics {\n  baselineRttMs?: number;\n  latestRttMs?: number;\n  adjustedRttMs?: number;\n  smoothedRttMs?: number;\n  rttVarMs?: number;\n  ackDelayMs?: number;\n  timerLabel?: 'RTO' | 'PTO';\n  timerMs?: number;\n  lossDetected?: boolean;\n}\n\nexport interface JourneyRouteMetrics {\n  primaryPathCost: number;\n  alternatePathCost: number;\n  activePath: 'primary' | 'none' | 'alternate';\n  failedLinkId?: string;\n}\n",
);

replaceOnce(
  model,
  "  ttlSeconds?: number;\n  transportMetrics?: JourneyTransportMetrics;",
  "  ttlSeconds?: number;\n  transportMetrics?: JourneyTransportMetrics;\n  routeMetrics?: JourneyRouteMetrics;",
);

replaceOnce(
  model,
  "export type RouteJourneyState = 'idle' | 'lookup' | 'gateway-ready' | 'internet-path-ready';",
  "export type RouteJourneyState = 'idle' | 'lookup' | 'gateway-ready' | 'failed' | 'recomputing' | 'alternate-ready' | 'internet-path-ready';",
);

replaceOnce(
  model,
  "export type JourneyImpairmentState = 'clean' | 'armed' | 'lost' | 'detected' | 'recovering' | 'recovered' | 'delayed' | 'estimating' | 'normalized';",
  "export type JourneyImpairmentState = 'clean' | 'armed' | 'lost' | 'detected' | 'recovering' | 'recovered' | 'delayed' | 'estimating' | 'normalized' | 'route-failed' | 'route-recomputing' | 'route-ready';",
);

replaceOnce(
  model,
  "  impairmentState: JourneyImpairmentState;\n  transportMetrics: JourneyTransportMetrics | null;",
  "  impairmentState: JourneyImpairmentState;\n  transportMetrics: JourneyTransportMetrics | null;\n  routeMetrics: JourneyRouteMetrics | null;",
);

replaceOnce(
  model,
  "  const modifierResult = applyJourneyModifiers([...transportEvents, ...tailEvents], normalizedConfig);\n  const events = [\n    ...sharedPrelude(hostname, destinationAddress, normalizedConfig.dnsProfile),\n    ...modifierResult.events,\n  ];",
  "  const baseEvents = [\n    ...sharedPrelude(hostname, destinationAddress, normalizedConfig.dnsProfile),\n    ...transportEvents,\n    ...tailEvents,\n  ];\n  const modifierResult = applyJourneyModifiers(baseEvents, normalizedConfig);\n  const events = modifierResult.events;",
);

replaceOnce(
  model,
  "  let impairmentState: JourneyImpairmentState = scenario.impairmentProfile === 'clean' ? 'clean' : 'armed';\n  let transportMetrics: JourneyTransportMetrics | null = null;",
  "  let impairmentState: JourneyImpairmentState = scenario.impairmentProfile === 'clean' ? 'clean' : 'armed';\n  let transportMetrics: JourneyTransportMetrics | null = null;\n  let routeMetrics: JourneyRouteMetrics | null = null;",
);

replaceOnce(
  model,
  "      case 'route.lookup': route = 'lookup'; break;\n      case 'route.gateway': route = 'gateway-ready'; break;\n      case 'internet.policy-path': route = 'internet-path-ready'; break;",
  "      case 'route.lookup': route = 'lookup'; break;\n      case 'route.gateway': route = 'gateway-ready'; break;\n      case 'route.failure':\n        route = 'failed';\n        impairmentState = 'route-failed';\n        routeMetrics = current.routeMetrics ?? routeMetrics;\n        break;\n      case 'route.invalidated':\n        route = 'failed';\n        impairmentState = 'route-failed';\n        routeMetrics = current.routeMetrics ?? routeMetrics;\n        break;\n      case 'route.recompute':\n        route = 'recomputing';\n        impairmentState = 'route-recomputing';\n        routeMetrics = current.routeMetrics ?? routeMetrics;\n        break;\n      case 'route.alternate-installed':\n        route = 'alternate-ready';\n        impairmentState = 'route-ready';\n        routeMetrics = current.routeMetrics ?? routeMetrics;\n        break;\n      case 'internet.policy-path': route = 'internet-path-ready'; break;",
);

replaceOnce(
  model,
  "    impairmentState,\n    transportMetrics,\n    scale: activeEvent.scale,",
  "    impairmentState,\n    transportMetrics,\n    routeMetrics,\n    scale: activeEvent.scale,",
);

replaceOnce(
  modifiers,
  "  JourneyScale,\n  JourneyScenarioConfig,",
  "  JourneyRouteMetrics,\n  JourneyScale,\n  JourneyScenarioConfig,",
);

replaceOnce(
  modifiers,
  "  provenance?: JourneyProvenance;\n  transportMetrics?: JourneyTransportMetrics;",
  "  provenance?: JourneyProvenance;\n  transportMetrics?: JourneyTransportMetrics;\n  routeMetrics?: JourneyRouteMetrics;",
);

replaceOnce(
  modifiers,
  "function requireResponseAnchors(events: JourneyEvent[], modifierId: string) {",
  "function requireRouteAnchors(events: JourneyEvent[], modifierId: string) {\n  const gateway = events.find((current) => current.kind === 'route.gateway');\n  const asPath = events.find((current) => current.id === 'as-path');\n  const transportStart = events.find((current) => current.kind === 'transport.segment');\n  if (!gateway || !asPath || !transportStart) throw new Error(`${modifierId} requires gateway, AS-path, and transport-start events.`);\n  if (!(gateway.atMs < asPath.atMs && asPath.atMs < transportStart.atMs)) throw new Error(`${modifierId} requires gateway < AS path < transport start.`);\n  return { gateway, asPath, transportStart };\n}\n\nfunction requireResponseAnchors(events: JourneyEvent[], modifierId: string) {",
);

const routeBlock = `\nconst PRIMARY_ROUTE: JourneyRouteMetrics = { primaryPathCost: 22, alternatePathCost: 52, activePath: 'primary' };\nconst BROKEN_ROUTE: JourneyRouteMetrics = { primaryPathCost: 22, alternatePathCost: 52, activePath: 'none', failedLinkId: 'r1-core' };\nconst ALTERNATE_ROUTE: JourneyRouteMetrics = { primaryPathCost: 22, alternatePathCost: 52, activePath: 'alternate', failedLinkId: 'r1-core' };\n\nfunction routeFailureEvents(gatewayAtMs: number): JourneyEvent[] {\n  return [\n    modifierEvent({ id: 'route-primary-fails', atMs: gatewayAtMs + 160, kind: 'route.failure', scale: 'routing', zoom: 'hold', protocol: 'OSPF teaching model', phase: 'route-failure', title: 'Primary R1 → CORE link fails', summary: 'The selected cost-22 route breaks after the gateway has already been chosen.', detail: 'This failure occurs before TCP SYN or QUIC Initial. HOPSCOTCH isolates routing convergence here instead of inventing transport timeout behavior.', actor: 'R1', target: 'CORE', detailLab: 'failure', routeMetrics: BROKEN_ROUTE }),\n    modifierEvent({ id: 'route-primary-invalidated', atMs: gatewayAtMs + 440, kind: 'route.invalidated', scale: 'routing', zoom: 'hold', protocol: 'OSPF teaching model', phase: 'route-invalidated', title: 'Installed primary route is invalidated', summary: 'Forwarding through the failed R1 → CORE edge is no longer viable.', detail: 'The physical failure is immediate; a replacement path is not installed until the control plane recomputes the surviving graph.', actor: 'edge router', target: 'routing table', detailLab: 'failure', routeMetrics: BROKEN_ROUTE }),\n    modifierEvent({ id: 'route-spf-recompute', atMs: gatewayAtMs + 820, kind: 'route.recompute', scale: 'routing', zoom: 'hold', protocol: 'OSPF teaching model', phase: 'route-recompute', title: 'SPF evaluates the surviving graph', summary: 'The cost-52 route through R2 becomes the lowest-cost viable path.', detail: 'The primary route cost was 22. Once its failed edge is removed, EDGE → R2 → CORE is more expensive but reachable.', actor: 'edge router', target: 'SPF engine', detailLab: 'failure', routeMetrics: BROKEN_ROUTE }),\n    modifierEvent({ id: 'route-alternate-installed', atMs: gatewayAtMs + 1180, kind: 'route.alternate-installed', scale: 'routing', zoom: 'hold', protocol: 'OSPF teaching model', phase: 'route-alternate-ready', title: 'Alternate cost-52 route installed', summary: 'Forwarding can continue through R2 before the transport handshake begins.', detail: 'Recovery comes from routing around the failed link. The failed R1 → CORE edge remains down.', actor: 'routing table', target: 'R2 next hop', detailLab: 'failure', routeMetrics: ALTERNATE_ROUTE }),\n  ];\n}\n\nconst routeFailureModifier: JourneyModifier = {\n  id: 'route-failure',\n  order: 90,\n  appliesTo: (profile) => profile === 'route-failure',\n  apply(events) {\n    const { gateway, asPath, transportStart } = requireRouteAnchors(events, 'route-failure');\n    const addedDurationMs = 1400;\n    const shifted = shiftPostAnchor(events, asPath.atMs, addedDurationMs);\n    const injected = routeFailureEvents(gateway.atMs);\n    const nextEvents = [...shifted, ...injected].sort((a, b) => a.atMs - b.atMs);\n    const firstTransport = nextEvents.find((current) => current.kind === 'transport.segment');\n    const alternate = nextEvents.find((current) => current.kind === 'route.alternate-installed');\n    if (!firstTransport || !alternate || alternate.atMs >= firstTransport.atMs) throw new Error('route-failure must converge before transport begins.');\n    if (transportStart.atMs + addedDurationMs !== firstTransport.atMs) throw new Error('route-failure shifted transport by an unexpected amount.');\n    return { events: nextEvents, addedDurationMs, appliedModifierIds: ['route-failure'] };\n  },\n};\n`;

replaceOnce(
  modifiers,
  "function round1(value: number): number {",
  `${routeBlock}\nfunction round1(value: number): number {`,
);

replaceOnce(
  modifiers,
  "const modifiers: JourneyModifier[] = [singleLossModifier, latencySpikeModifier]",
  "const modifiers: JourneyModifier[] = [routeFailureModifier, singleLossModifier, latencySpikeModifier]",
);

console.log('Applied Lab 07B model/modifier codemod.');
