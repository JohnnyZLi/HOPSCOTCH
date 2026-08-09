import { animate, stagger, svg } from 'animejs';
import { useEffect, useMemo, useRef } from 'react';
import { useReducedMotion } from 'motion/react';
import type {
  SimulationEvent,
  SimulationScenario,
  SimulationState,
  TopologyLink,
  TopologyNode,
  TrafficPath,
} from './simulation/model';

function nodeMap(nodes: readonly TopologyNode[]): Map<string, TopologyNode> {
  return new Map(nodes.map((node) => [node.id, node]));
}

function pathNodes(
  path: TrafficPath,
  nodesById: Map<string, TopologyNode>,
): TopologyNode[] {
  return path.nodeIds
    .map((nodeId) => nodesById.get(nodeId))
    .filter((node): node is TopologyNode => Boolean(node));
}

function pathPoints(path: TrafficPath, nodesById: Map<string, TopologyNode>): string {
  return pathNodes(path, nodesById).map((node) => `${node.x},${node.y}`).join(' ');
}

function pathD(path: TrafficPath, nodesById: Map<string, TopologyNode>): string {
  return pathNodes(path, nodesById)
    .map((node, index) => `${index === 0 ? 'M' : 'L'} ${node.x} ${node.y}`)
    .join(' ');
}

function orientedLinkD(
  link: TopologyLink,
  actorId: string | undefined,
  nodesById: Map<string, TopologyNode>,
): string {
  const from = nodesById.get(link.from);
  const to = nodesById.get(link.to);
  if (!from || !to) return '';

  const reverse = actorId === link.to;
  const start = reverse ? to : from;
  const end = reverse ? from : to;
  return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
}

export function LabNetworkField({
  scenario,
  state,
  activeEvent,
  xray,
}: {
  scenario: SimulationScenario;
  state: SimulationState;
  activeEvent: SimulationEvent;
  xray: boolean;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const reduceMotion = useReducedMotion();
  const nodesById = useMemo(() => nodeMap(scenario.nodes), [scenario.nodes]);
  const activePath = scenario.paths.find((path) => path.id === state.activePathId) ?? scenario.paths[0];
  const activeNodeIds = useMemo(() => new Set(activePath.nodeIds), [activePath.nodeIds]);
  const activePoints = pathPoints(activePath, nodesById);
  const activePathD = pathD(activePath, nodesById);
  const routeHealthy = state.phase === 'steady' || state.phase === 'rerouting' || state.phase === 'recovered';

  const failedLinkId = activeEvent.payload.linkId ?? state.failedLinkIds[0];
  const failedLink = scenario.links.find((link) => link.id === failedLinkId);
  const failureFrom = failedLink ? nodesById.get(failedLink.from) : undefined;
  const failureTo = failedLink ? nodesById.get(failedLink.to) : undefined;
  const failurePoint = failureFrom && failureTo
    ? { x: (failureFrom.x + failureTo.x) / 2, y: (failureFrom.y + failureTo.y) / 2 }
    : undefined;
  const failureAngle = failureFrom && failureTo
    ? Math.atan2(failureTo.y - failureFrom.y, failureTo.x - failureFrom.x) * (180 / Math.PI)
    : 0;

  const controlLinks = state.controlLinkIds
    .map((linkId) => scenario.links.find((link) => link.id === linkId))
    .filter((link): link is TopologyLink => Boolean(link));

  useEffect(() => {
    const root = svgRef.current;
    if (!root || reduceMotion) return;

    const flow = animate(root.querySelectorAll('.lab-active-route'), {
      strokeDashoffset: [0, -28],
      duration: 1150,
      ease: 'linear',
      loop: true,
    });

    const routePath = root.querySelector<SVGPathElement>('.lab-motion-route');
    const packets = root.querySelectorAll('.lab-flow-packet');
    const packetFlow = routePath && packets.length > 0 && routeHealthy
      ? animate(packets, {
          ...svg.createMotionPath(routePath),
          opacity: [0, 1, 1, 0],
          duration: 2600,
          delay: stagger(620),
          ease: 'linear',
          loop: true,
        })
      : undefined;

    return () => {
      flow.cancel();
      packetFlow?.cancel();
    };
  }, [activePath.id, reduceMotion, routeHealthy]);

  useEffect(() => {
    const root = svgRef.current;
    if (!root || reduceMotion) return;

    const animations: Array<ReturnType<typeof animate>> = [];
    const eventNodes = root.querySelectorAll('.lab-node.is-event-actor .lab-node-halo');
    const failedLinks = root.querySelectorAll('.lab-link.is-failed');

    if (eventNodes.length > 0) {
      animations.push(
        animate(eventNodes, {
          opacity: [0.12, 0.95, 0.18],
          scale: [0.82, 1.78, 1],
          duration: 900,
          ease: 'outExpo',
        }),
      );
    }

    if (activeEvent.kind === 'link.failure' && failedLinks.length > 0) {
      animations.push(
        animate(failedLinks, {
          opacity: [1, 0.08, 0.96, 0.18, 0.72],
          duration: 920,
          ease: 'inOutSine',
        }),
      );

      const waves = root.querySelectorAll('.lab-failure-wave');
      if (waves.length > 0) {
        animations.push(
          animate(waves, {
            opacity: [0.95, 0],
            scale: [0.3, 3.6],
            delay: stagger(130),
            duration: 980,
            ease: 'outExpo',
          }),
        );
      }

      const fracture = root.querySelectorAll('.lab-fracture-mark');
      if (fracture.length > 0) {
        animations.push(
          animate(fracture, {
            strokeDashoffset: [1, 0],
            opacity: [0, 1],
            duration: 420,
            ease: 'outExpo',
          }),
        );
      }
    }

    if (activeEvent.kind === 'route.advertise') {
      const paths = root.querySelectorAll<SVGPathElement>('.lab-control-motion');
      paths.forEach((path) => {
        const linkId = path.dataset.linkId;
        if (!linkId) return;
        const pulses = root.querySelectorAll(`.lab-lsa-pulse[data-link-id="${linkId}"]`);
        if (pulses.length === 0) return;

        animations.push(
          animate(pulses, {
            ...svg.createMotionPath(path),
            opacity: [0, 1, 1, 0],
            scale: [0.72, 1.2, 0.9],
            delay: stagger(150),
            duration: 980,
            ease: 'inOutQuad',
            loop: true,
          }),
        );
      });
    }

    if (activeEvent.kind === 'route.recompute') {
      const candidates = root.querySelectorAll('.lab-candidate-route');
      if (candidates.length > 0) {
        animations.push(
          animate(candidates, {
            opacity: [0, 0.92, 0.34, 0.9],
            strokeDashoffset: [36, 0],
            delay: stagger(170),
            duration: 1250,
            ease: 'inOutSine',
          }),
        );
      }

      const alternate = root.querySelectorAll('.lab-candidate-route.candidate-alternate');
      if (alternate.length > 0) {
        animations.push(
          animate(alternate, {
            opacity: [0.2, 1],
            strokeWidth: [1.2, 2.6],
            duration: 900,
            ease: 'outExpo',
          }),
        );
      }
    }

    if (activeEvent.kind === 'flow.reroute') {
      const pathHalos = root.querySelectorAll('.lab-node.is-path-node .lab-node-halo');
      if (pathHalos.length > 0) {
        animations.push(
          animate(pathHalos, {
            opacity: [0.1, 0.8, 0.2],
            scale: [0.85, 1.55, 1],
            delay: stagger(85, { from: 'first' }),
            duration: 820,
            ease: 'outExpo',
          }),
        );
      }
    }

    if (activeEvent.kind === 'flow.recover') {
      const routePath = root.querySelector<SVGPathElement>('.lab-motion-route');
      const burst = root.querySelectorAll('.lab-recovery-packet');
      if (routePath && burst.length > 0) {
        animations.push(
          animate(burst, {
            ...svg.createMotionPath(routePath),
            opacity: [0, 1, 1, 0],
            scale: [0.7, 1.3, 0.8],
            delay: stagger(105),
            duration: 1450,
            ease: 'inOutQuad',
          }),
        );
      }

      const recoveredHalos = root.querySelectorAll('.lab-node.is-path-node .lab-node-halo');
      if (recoveredHalos.length > 0) {
        animations.push(
          animate(recoveredHalos, {
            opacity: [0.12, 0.72, 0.18],
            scale: [0.9, 1.5, 1],
            delay: stagger(70),
            duration: 900,
            ease: 'outExpo',
          }),
        );
      }
    }

    return () => {
      animations.forEach((animation) => {
        animation.cancel();
      });
    };
  }, [activeEvent.id, activeEvent.kind, reduceMotion, state.controlLinkIds, state.failedLinkIds]);

  return (
    <svg
      ref={svgRef}
      className="lab-network-field"
      viewBox="0 0 120 72"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Six-node routed network showing the active application path and failure recovery state"
      data-phase={state.phase}
      data-event={activeEvent.kind}
    >
      <defs>
        <filter id="labRouteGlow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="0.8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="labPacketGlow" x="-250%" y="-250%" width="500%" height="500%">
          <feGaussianBlur stdDeviation="1.25" result="packetBlur" />
          <feMerge>
            <feMergeNode in="packetBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="labFailureGlow" x="-250%" y="-250%" width="500%" height="500%">
          <feGaussianBlur stdDeviation="1.6" result="failureBlur" />
          <feMerge>
            <feMergeNode in="failureBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g className="lab-links">
        {scenario.links.map((link) => {
          const from = nodesById.get(link.from);
          const to = nodesById.get(link.to);
          if (!from || !to) return null;

          const failed = state.failedLinkIds.includes(link.id);
          const controlActive = state.controlLinkIds.includes(link.id);
          const active = activePath.linkIds.includes(link.id) && !failed;

          return (
            <g key={link.id}>
              <line
                className={`lab-link role-${link.role}${failed ? ' is-failed' : ''}${active ? ' is-path-active' : ''}${controlActive ? ' is-control-active' : ''}`}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                pathLength="100"
              />
              {xray && (
                <text
                  className="lab-link-metric"
                  x={(from.x + to.x) / 2}
                  y={(from.y + to.y) / 2 - 1.6}
                  textAnchor="middle"
                >
                  {failed ? 'DOWN' : `COST ${link.metric}`}
                </text>
              )}
            </g>
          );
        })}
      </g>

      {controlLinks.map((link) => (
        <g key={`control-${link.id}`} className="lab-control-propagation" aria-hidden="true">
          <path
            className="lab-control-motion"
            data-link-id={link.id}
            d={orientedLinkD(link, activeEvent.actorId, nodesById)}
          />
          {[0, 1, 2].map((pulse) => (
            <circle
              key={pulse}
              className="lab-lsa-pulse"
              data-link-id={link.id}
              r="0.9"
              filter="url(#labPacketGlow)"
            />
          ))}
        </g>
      ))}

      {state.phase === 'recomputing' && (
        <g className="lab-candidate-routes" aria-hidden="true">
          {scenario.paths.map((path) => (
            <polyline
              key={path.id}
              className={`lab-candidate-route candidate-${path.id}`}
              points={pathPoints(path, nodesById)}
              pathLength="100"
            />
          ))}
        </g>
      )}

      <path className="lab-motion-route" d={activePathD} />
      <polyline
        key={activePath.id}
        className="lab-active-route"
        points={activePoints}
        filter="url(#labRouteGlow)"
        pathLength="100"
      />

      <g className={`lab-flow-packets${routeHealthy ? ' is-flowing' : ''}`} aria-hidden="true">
        {[0, 1, 2, 3].map((packet) => (
          <circle
            key={packet}
            className="lab-flow-packet"
            cx="0"
            cy="0"
            r="0.82"
            filter="url(#labPacketGlow)"
          />
        ))}
      </g>

      <g className="lab-recovery-burst" aria-hidden="true">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((packet) => (
          <circle
            key={packet}
            className="lab-recovery-packet"
            cx="0"
            cy="0"
            r="0.72"
            filter="url(#labPacketGlow)"
          />
        ))}
      </g>

      {failurePoint && (
        <g
          className={`lab-failure-impact${activeEvent.kind === 'link.failure' ? ' is-current' : ''}`}
          transform={`translate(${failurePoint.x} ${failurePoint.y}) rotate(${failureAngle})`}
          aria-hidden="true"
        >
          {[0, 1, 2].map((wave) => (
            <circle key={wave} className="lab-failure-wave" r="2.2" filter="url(#labFailureGlow)" />
          ))}
          <path
            className="lab-fracture-mark"
            d="M -5 0 L -2.7 -1.8 L -1 1.7 L 1 -1.9 L 2.7 1.5 L 5 0"
            pathLength="1"
          />
        </g>
      )}

      <g className="lab-nodes">
        {scenario.nodes.map((node) => {
          const actor = activeEvent.actorId === node.id;
          const target = activeEvent.targetId === node.id;
          const pathNode = activeNodeIds.has(node.id);
          return (
            <g
              key={node.id}
              className={`lab-node kind-${node.kind}${actor ? ' is-event-actor' : ''}${target ? ' is-event-target' : ''}${pathNode ? ' is-path-node' : ''}`}
              transform={`translate(${node.x} ${node.y})`}
            >
              <circle className="lab-node-halo" r="5.5" />
              <circle className="lab-node-ring" r="2.7" />
              <circle className="lab-node-core" r="0.95" />
              <text className="lab-node-label" x="0" y="7.8" textAnchor="middle">
                {node.shortLabel}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
