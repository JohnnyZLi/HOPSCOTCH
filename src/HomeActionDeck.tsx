import { motion, useReducedMotion } from 'motion/react';
import { FEATURED_WORKSPACE_IDS, WORKSPACE_COUNT, workspaceDefinition, type FeaturedWorkspaceId } from './workspace-catalog';
import './HomeActionDeck.css';

const HOME_ACTION_IDS: Readonly<Record<FeaturedWorkspaceId, 'watch' | 'break' | 'build'>> = {
  journey: 'watch',
  failure: 'break',
  builder: 'build',
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
  const runByWorkspace: Readonly<Record<FeaturedWorkspaceId, () => void>> = {
    journey: onWatch,
    failure: onBreak,
    builder: onBuild,
  };

  return (
    <motion.div
      className="home-action-deck"
      initial={reduceMotion ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.38, duration: 0.65 }}
    >
      <div className="home-action-grid" aria-label="Start a HOPSCOTCH experience">
        {FEATURED_WORKSPACE_IDS.map((workspaceId) => {
          const workspace = workspaceDefinition(workspaceId);
          const featured = workspace.featured;
          if (!featured) return null;
          return (
            <motion.button
              key={workspace.id}
              type="button"
              className="home-action-card"
              data-home-action={HOME_ACTION_IDS[workspaceId]}
              onClick={runByWorkspace[workspaceId]}
              whileHover={reduceMotion ? undefined : { y: -4 }}
              whileTap={reduceMotion ? undefined : { scale: 0.992 }}
              transition={{ type: 'spring', stiffness: 360, damping: 28 }}
            >
              <span className="home-action-lab">{workspace.lab}</span>
              <strong>{workspace.exploreTitle.toUpperCase()}</strong>
              <p>{workspace.description}</p>
              <span className="home-action-footer">
                <span>{featured.actionLabel}</span>
                <i aria-hidden="true">↗</i>
              </span>
              <small>{workspace.meta}</small>
            </motion.button>
          );
        })}
      </div>

      <nav className="home-action-utilities" aria-label="HOPSCOTCH utilities">
        <button type="button" onClick={onExplore}>Explore all {WORKSPACE_COUNT} workspaces</button>
        <button type="button" onClick={onMeasured}>Inspect measured report</button>
        <button type="button" onClick={onToggleXray}>{xrayActive ? 'Hide X-ray' : 'Preview X-ray'}</button>
        <a href="https://github.com/JohnnyZLi/HOPSCOTCH">Source</a>
      </nav>
    </motion.div>
  );
}
