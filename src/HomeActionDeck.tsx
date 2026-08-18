import { motion, useReducedMotion } from 'motion/react';
import './HomeActionDeck.css';

type HomeAction = {
  id: 'watch' | 'break' | 'build';
  lab: string;
  title: string;
  actionLabel: string;
  description: string;
  meta: string;
  run: () => void;
};

export function HomeActionDeck({
  onWatch,
  onBreak,
  onBuild,
  onExplore,
  onMeasured,
  onToggleXray,
  xrayActive,
}: {
  onWatch: () => void;
  onBreak: () => void;
  onBuild: () => void;
  onExplore: () => void;
  onMeasured: () => void;
  onToggleXray: () => void;
  xrayActive: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const actions: readonly HomeAction[] = [
    {
      id: 'watch',
      lab: 'LAB 06 + 07',
      title: 'WATCH A REQUEST',
      actionLabel: 'Play URL journey',
      description: 'Follow one HTTPS request across DNS, routing, transport, TLS, HTTP, packets, failures, and recovery.',
      meta: 'END TO END · GOD MODE',
      run: onWatch,
    },
    {
      id: 'break',
      lab: 'LAB 01',
      title: 'BREAK THE NETWORK',
      actionLabel: 'Run failure story',
      description: 'Fail the active route and watch convergence, recomputation, failover, and the causal chain unfold.',
      meta: 'FAILURE · RECOVERY · TIME',
      run: onBreak,
    },
    {
      id: 'build',
      lab: 'LAB 04',
      title: 'BUILD A NETWORK',
      actionLabel: 'Open network builder',
      description: 'Author a topology, change costs, fail links, and inspect deterministic route selection yourself.',
      meta: 'TOPOLOGY · ROUTING · AUTHORING',
      run: onBuild,
    },
  ];

  return (
    <motion.div
      className="home-action-deck"
      initial={reduceMotion ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.38, duration: 0.65 }}
    >
      <div className="home-action-grid" aria-label="Start a HOPSCOTCH experience">
        {actions.map((action) => (
          <motion.button
            key={action.id}
            type="button"
            className="home-action-card"
            data-home-action={action.id}
            onClick={action.run}
            whileHover={reduceMotion ? undefined : { y: -4 }}
            whileTap={reduceMotion ? undefined : { scale: 0.992 }}
            transition={{ type: 'spring', stiffness: 360, damping: 28 }}
          >
            <span className="home-action-lab">{action.lab}</span>
            <strong>{action.title}</strong>
            <p>{action.description}</p>
            <span className="home-action-footer">
              <span>{action.actionLabel}</span>
              <i aria-hidden="true">↗</i>
            </span>
            <small>{action.meta}</small>
          </motion.button>
        ))}
      </div>

      <nav className="home-action-utilities" aria-label="HOPSCOTCH utilities">
        <button type="button" onClick={onExplore}>Explore all 13 workspaces</button>
        <button type="button" onClick={onMeasured}>Inspect measured report</button>
        <button type="button" onClick={onToggleXray}>{xrayActive ? 'Hide X-ray' : 'Preview X-ray'}</button>
        <a href="https://github.com/JohnnyZLi/HOPSCOTCH">Source</a>
      </nav>
    </motion.div>
  );
}
