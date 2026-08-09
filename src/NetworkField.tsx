import { useEffect, useMemo, useRef } from 'react';
import { animate, stagger } from 'animejs';
import { useReducedMotion } from 'motion/react';
import type { NetworkLayer } from './simulation/model';

type DisplayMode = 'overview' | 'xray';

type Node = {
  id: string;
  x: number;
  y: number;
  tier: 'edge' | 'core' | 'origin';
};

type Edge = [string, string];

const nodes: Node[] = [
  { id: 'home', x: 12, y: 58, tier: 'edge' },
  { id: 'access', x: 25, y: 49, tier: 'edge' },
  { id: 'metro-a', x: 38, y: 35, tier: 'core' },
  { id: 'metro-b', x: 39, y: 67, tier: 'core' },
  { id: 'transit-a', x: 53, y: 25, tier: 'core' },
  { id: 'transit-b', x: 56, y: 53, tier: 'core' },
  { id: 'ix', x: 67, y: 40, tier: 'core' },
  { id: 'cdn-a', x: 79, y: 28, tier: 'edge' },
  { id: 'cdn-b', x: 80, y: 56, tier: 'edge' },
  { id: 'origin', x: 92, y: 43, tier: 'origin' },
  { id: 'resolver', x: 60, y: 76, tier: 'edge' },
  { id: 'alt', x: 70, y: 69, tier: 'core' },
];

const edges: Edge[] = [
  ['home', 'access'],
  ['access', 'metro-a'],
  ['access', 'metro-b'],
  ['metro-a', 'transit-a'],
  ['metro-a', 'transit-b'],
  ['metro-b', 'transit-b'],
  ['metro-b', 'resolver'],
  ['transit-a', 'ix'],
  ['transit-b', 'ix'],
  ['transit-b', 'alt'],
  ['resolver', 'alt'],
  ['ix', 'cdn-a'],
  ['ix', 'cdn-b'],
  ['alt', 'cdn-b'],
  ['cdn-a', 'origin'],
  ['cdn-b', 'origin'],
];

const byId = new Map(nodes.map((node) => [node.id, node]));

const layerBias: Record<NetworkLayer, string> = {
  internet: '0.42',
  routing: '0.72',
  transport: '0.58',
  application: '0.5',
  packet: '0.82',
};

export function NetworkField({
  mode,
  layer,
}: {
  mode: DisplayMode;
  layer: NetworkLayer;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const reduceMotion = useReducedMotion();
  const renderedEdges = useMemo(
    () =>
      edges.flatMap(([fromId, toId]) => {
        const from = byId.get(fromId);
        const to = byId.get(toId);
        return from && to ? [{ fromId, toId, from, to }] : [];
      }),
    [],
  );

  useEffect(() => {
    const root = svgRef.current;
    if (!root || reduceMotion) return;

    const nodeAnimation = animate(root.querySelectorAll('.network-node'), {
      opacity: [0.2, mode === 'xray' ? 1 : 0.72],
      scale: [0.78, mode === 'xray' ? 1.18 : 1],
      delay: stagger(48, { from: 'center' }),
      duration: 850,
      ease: 'outExpo',
    });

    const edgeAnimation = animate(root.querySelectorAll('.network-edge'), {
      opacity: [0.06, Number(layerBias[layer])],
      strokeDashoffset: mode === 'xray' ? -56 : 0,
      delay: stagger(28),
      duration: 1300,
      ease: 'inOutSine',
    });

    const pulseAnimation = animate(root.querySelectorAll('.network-pulse'), {
      opacity: [0.12, 0.88],
      scale: [0.72, 1.35],
      delay: stagger(130, { from: 'center' }),
      duration: 1800,
      ease: 'inOutSine',
      alternate: true,
      loop: true,
    });

    return () => {
      nodeAnimation.cancel();
      edgeAnimation.cancel();
      pulseAnimation.cancel();
    };
  }, [layer, mode, reduceMotion]);

  return (
    <svg
      ref={svgRef}
      className="network-field"
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="nodeGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.95" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </radialGradient>
      </defs>

      <g className="network-edges">
        {renderedEdges.map(({ fromId, toId, from, to }) => (
          <line
            key={`${fromId}-${toId}`}
            className="network-edge"
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            pathLength="72"
          />
        ))}
      </g>

      <g className="network-nodes">
        {nodes.map((node) => (
          <g key={node.id} className={`network-node tier-${node.tier}`} transform={`translate(${node.x} ${node.y})`}>
            <circle className="network-pulse" r={node.tier === 'core' ? 3.8 : 3.1} fill="url(#nodeGlow)" />
            <circle className="network-core" r={node.tier === 'core' ? 0.78 : 0.62} />
          </g>
        ))}
      </g>
    </svg>
  );
}
