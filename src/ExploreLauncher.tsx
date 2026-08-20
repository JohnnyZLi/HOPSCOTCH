import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef } from 'react';
import { ScenarioGallery } from './ScenarioGallery';
import type { ScenarioPresetId } from './scenarios/catalog.ts';
import {
  EXPLORE_GROUPS,
  FEATURED_WORKSPACE_IDS,
  WORKSPACE_COUNT,
  workspaceDefinition,
  type ExploreDestination,
  type WorkspaceDefinition,
} from './workspace-catalog';
import './ExploreLauncher.css';

export type { ExploreDestination } from './workspace-catalog';

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function focusableInside(panel: HTMLElement): HTMLElement[] {
  return [...panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].filter((element) => !element.hasAttribute('hidden') && element.getAttribute('aria-hidden') !== 'true');
}

function ExploreCard({ item, onSelect }: { item: WorkspaceDefinition; onSelect: (destination: ExploreDestination) => void }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.button
      type="button"
      className="explore-card"
      data-explore-destination={item.id}
      onClick={() => onSelect(item.id)}
      whileHover={reduceMotion ? undefined : { y: -4 }}
      whileTap={reduceMotion ? undefined : { scale: 0.992 }}
      transition={{ type: 'spring', stiffness: 360, damping: 28 }}
    >
      <span className="explore-card-lab">{item.lab}</span>
      <strong>{item.exploreTitle}</strong>
      <p>{item.description}</p>
      <span className="explore-card-meta">{item.meta}</span>
      <span className="explore-card-arrow" aria-hidden="true">↗</span>
    </motion.button>
  );
}

export function ExploreLauncher({
  open,
  onClose,
  onSelect,
  onScenarioSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (destination: ExploreDestination) => void;
  onScenarioSelect: (presetId: ScenarioPresetId) => void;
}) {
  const reduceMotion = useReducedMotion();
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusable = focusableInside(panelRef.current);
      if (focusable.length === 0) {
        event.preventDefault();
        panelRef.current.focus({ preventScroll: true });
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const current = document.activeElement;
      if (event.shiftKey && (current === first || !panelRef.current.contains(current))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (current === last || !panelRef.current.contains(current))) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    const focusFrame = requestAnimationFrame(() => closeRef.current?.focus({ preventScroll: true }));
    return () => {
      cancelAnimationFrame(focusFrame);
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus({ preventScroll: true });
      previousFocusRef.current = null;
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          id="explore-dialog"
          className="explore-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="explore-title"
          aria-describedby="explore-description"
          initial={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose();
          }}
        >
          <motion.section
            ref={panelRef}
            className="explore-panel"
            tabIndex={-1}
            initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 24, scale: 0.992 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.995 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
          >
            <header className="explore-heading">
              <div>
                <span>HOPSCOTCH · {WORKSPACE_COUNT} WORKSPACES</span>
                <h1 id="explore-title">Pick something to do.</h1>
                <p id="explore-description">Every major workspace is one click away. Start with a complete request, break the network, build your own, or jump directly to a protocol or evidence surface.</p>
              </div>
              <button ref={closeRef} type="button" className="explore-close" onClick={onClose} aria-label="Close Explore launcher">
                CLOSE <span>ESC</span>
              </button>
            </header>

            <section className="explore-featured" aria-label="Featured HOPSCOTCH experiences">
              {FEATURED_WORKSPACE_IDS.map((id) => {
                const item = workspaceDefinition(id);
                const featured = item.featured;
                if (!featured) return null;
                return (
                  <motion.button
                    key={item.id}
                    type="button"
                    className="explore-featured-card"
                    data-tone={featured.tone}
                    data-explore-destination={item.id}
                    onClick={() => onSelect(item.id)}
                    whileHover={reduceMotion ? undefined : { y: -5 }}
                    whileTap={reduceMotion ? undefined : { scale: 0.992 }}
                    transition={{ type: 'spring', stiffness: 340, damping: 26 }}
                  >
                    <span className="explore-featured-lab">{item.lab}</span>
                    <strong>{item.exploreTitle}</strong>
                    <p>{item.description}</p>
                    <span className="explore-featured-meta">{item.meta}</span>
                    <span className="explore-featured-action">{featured.actionLabel.toUpperCase()} <i aria-hidden="true">↗</i></span>
                  </motion.button>
                );
              })}
            </section>

            <ScenarioGallery onSelect={onScenarioSelect} />

            <div className="explore-groups">
              {EXPLORE_GROUPS.map((group) => (
                <section className="explore-group" key={group.id}>
                  <header>
                    <span>{group.label}</span>
                    <p>{group.description}</p>
                  </header>
                  <div className="explore-grid">
                    {group.workspaceIds.map((id) => <ExploreCard key={id} item={workspaceDefinition(id)} onSelect={onSelect} />)}
                  </div>
                </section>
              ))}
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
