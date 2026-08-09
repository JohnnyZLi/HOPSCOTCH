import { animate } from 'animejs';
import { useEffect, useMemo, useRef } from 'react';
import { useReducedMotion } from 'motion/react';
import type {
  SimulationEvent,
  SimulationScenario,
  SimulationState,
  TopologyNode,
} from './simulation/model';

function nodeMap(nodes: readonly TopologyNode[]): Map<string, TopologyNode> {
  return new Map(nodes.map((node) => [node.id, node]));
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
  const activePoints = activePath.nodeIds
    .map((nodeId) => nodesById.get(nodeId))
    .filter((node): node is TopologyNode => Boolean(node))
    .map((node) => `${node.x},${node.y}`)
    .join(' ');

  useEffect(() => {
    const root = svgRef.current;
    if (!root || reduceMotion) return;

    const flow = animate(root.querySelectorAll('.lab-active-route'), {
      strokeDashoffset: [0, -28],
      duration: 1150,
      ease: 'linear',
      loop: true,
    });

    return () => {
      flow.cancel();
    };
  }, [activePath.id, reduceMotion]);

  useEffect(() => {
    const root = svgRef.current;
    if (!root || reduceMotion) return;

    const animations: Array<ReturnType<typeof animate>> = [];
    const controlLinks = root.querySelectorAll('.lab-link.is-control-active');
    const eventNodes = root.querySelectorAll('.lab-node.is-event-actor .lab-node-halo');
    const failedLinks = root.querySelectorAll('.lab-link.is-failed');

    if (controlLinks.length > 0) {
      animations.push(
        animate(controlLinks, {
          opacity: [0.24, 1, 0.35],
          strokeDashoffset: [0, -18],
          duration: 720,
          ease: 'inOutSine',
          alternate: true,
          loop: true,
        }),
      );
    }

    if (eventNodes.length > 0) {
      animations.push(
        animate(eventNodes, {
          opacity: [0.12, 0.92, 0.16],
          scale: [0.82, 1.55, 1],
          duration: 900,
          ease: 'outExpo',
        }),
      );
    }

    if (activeEvent.kind === 'link.failure' && failedLinks.length > 0) {
      animations.push(
        animate(failedLinks, {
          opacity: [1, 0.12, 0.88, 0.22, 0.5],
          duration: 880,
          ease: 'inOutSine',
        }),
      );
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
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Six-node routed network showing the active application path and failure recovery state"
      data-phase={state.phase}
    >
      <defs>
        <filter id="labRouteGlow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="0.55" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
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
                  y={(from.y + to.y) / 2 - 1.4}
                  textAnchor="middle"
                >
                  {failed ? 'DOWN' : `COST ${link.metric}`}
                </text>
              )}
            </g>
          );
        })}
      </g>

      <polyline
        key={activePath.id}
        className="lab-active-route"
        points={activePoints}
        filter="url(#labRouteGlow)"
        pathLength="100"
      />

      <g className="lab-nodes">
        {scenario.nodes.map((node) => {
          const actor = activeEvent.actorId === node.id;
          const target = activeEvent.targetId === node.id;
          return (
            <g
              key={node.id}
              className={`lab-node kind-${node.kind}${actor ? ' is-event-actor' : ''}${target ? ' is-event-target' : ''}`}
              transform={`translate(${node.x} ${node.y})`}
            >
              <circle className="lab-node-halo" r="4.6" />
              <circle className="lab-node-ring" r="2.35" />
              <circle className="lab-node-core" r="0.82" />
              <text className="lab-node-label" x="0" y="7.2" textAnchor="middle">
                {node.shortLabel}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
