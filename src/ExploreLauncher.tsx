import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ScenarioGallery } from './ScenarioGallery';
import type { ScenarioPresetId } from './scenarios/catalog.ts';
import {
  EXPLORE_GROUPS,
  FEATURED_WORKSPACE_IDS,
  WORKSPACE_IDS,
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

function WorkspaceRow({
  item,
  active,
  onSelect,
}: {
  item: WorkspaceDefinition;
  active: boolean;
  onSelect: (destination: ExploreDestination) => void;
}) {
  const reduceMotion = useReducedMotion();
  const index = WORKSPACE_IDS.indexOf(item.id) + 1;
  return (
    <motion.button
      type="button"
      className={`explore-row${active ? ' active' : ''}`}
      data-explore-destination={item.id}
      data-explore-layer={item.layer}
      aria-current={active ? 'page' : undefined}
      onClick={() => onSelect(item.id)}
      whileHover={reduceMotion ? undefined : { x: 5 }}
      whileTap={reduceMotion ? undefined : { scale: .995 }}
      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
    >
      <span className="explore-row-index" aria-hidden="true">{String(index).padStart(2, '0')}</span>
      <span className="explore-row-copy"><strong>{item.exploreTitle}</strong><small>{item.description}</small></span>
      <span className="explore-row-layer">{item.layer}</span>
      <i aria-hidden="true">→</i>
    </motion.button>
  );
}

export function ExploreLauncher({
  open,
  activeDestination,
  contextActions,
  onClose,
  onHome,
  onSelect,
  onScenarioSelect,
}: {
  open: boolean;
  activeDestination: ExploreDestination | null;
  contextActions?: ReactNode;
  onClose: () => void;
  onHome: () => void;
  onSelect: (destination: ExploreDestination) => void;
  onScenarioSelect: (presetId: ScenarioPresetId) => void;
}) {
  const reduceMotion = useReducedMotion();
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [query, setQuery] = useState('');
  const searchResults = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return [];
    return WORKSPACE_IDS
      .map((id) => workspaceDefinition(id))
      .filter((item) => [item.name, item.exploreTitle, item.description, item.meta].some((value) => value.toLocaleLowerCase().includes(normalized)));
  }, [query]);

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
  }, [onClose, open]);

  useEffect(() => {
    if (!open) setQuery('');
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
          transition={{ duration: reduceMotion ? 0 : .22 }}
          onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
        >
          <div className="explore-scale-map" aria-hidden="true">
            <div className="explore-scale-map__caption">
              <span>CONNECTED WORKSPACE FIELD</span>
              <strong>ONE REQUEST · THIRTEEN VIEWS</strong>
            </div>
            <div className="explore-scale-map__mechanism">
              <i className="explore-scale-map__orbit orbit-request" />
              <i className="explore-scale-map__orbit orbit-protocol" />
              <i className="explore-scale-map__orbit orbit-evidence" />
              <span className="explore-scale-map__axis axis-horizontal" />
              <span className="explore-scale-map__axis axis-vertical" />
              <b className="explore-scale-map__core">H</b>
              {WORKSPACE_IDS.map((id, index) => (
                <i
                  key={id}
                  className={`explore-scale-map__node${activeDestination === id ? ' active' : ''}`}
                  style={{ '--explore-node': index } as CSSProperties}
                />
              ))}
              <span className="explore-scale-map__signal" />
            </div>
            <div className="explore-scale-map__legend">
              <span>REQUEST</span><span>PROTOCOL</span><span>INTERNET</span><span>EVIDENCE</span>
            </div>
          </div>

          <motion.aside
            ref={panelRef}
            className="explore-panel"
            tabIndex={-1}
            initial={reduceMotion ? { opacity: 1 } : { opacity: 0, x: -42 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -34 }}
            transition={{ duration: reduceMotion ? 0 : .42, ease: [.16, 1, .3, 1] }}
          >
            <header className="explore-heading">
              <div className="explore-wordmark">
                <span className="explore-wordmark-mark" aria-hidden="true"><i /><i /><i /></span>
                <div><strong id="explore-title">HOPSCOTCH</strong><small>{WORKSPACE_COUNT} connected workspaces</small></div>
              </div>
              <button ref={closeRef} type="button" className="explore-close" onClick={onClose} aria-label="Close navigation">×</button>
              <p id="explore-description">Follow a request end to end, or enter at the exact scale you want to inspect.</p>
            </header>

            <nav className="explore-home-nav" aria-label="Home">
              <button type="button" className={activeDestination === null ? 'active' : ''} aria-current={activeDestination === null ? 'page' : undefined} onClick={onHome}>
                <span className="explore-row-index" aria-hidden="true">00</span>
                <span className="explore-row-copy"><strong>Request journey</strong><small>The kinetic overview</small></span>
                <span className="explore-row-layer">overview</span>
                <i aria-hidden="true">↖</i>
              </button>
            </nav>

            <label className="explore-search">
              <span>FIND A WORKSPACE</span>
              <input type="search" value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder="DNS, packet, evidence…" autoComplete="off" />
              <i aria-hidden="true">⌕</i>
            </label>

            {contextActions && <section className="explore-context" aria-label="Current workspace actions"><span>Current journey</span>{contextActions}</section>}

            {query.trim() ? <section className="explore-section explore-search-results" aria-labelledby="explore-search-title">
              <header><span id="explore-search-title">{searchResults.length} MATCH{searchResults.length === 1 ? '' : 'ES'}</span><p>Searches workspace names, descriptions, and evidence boundaries.</p></header>
              {searchResults.length > 0 ? <div className="explore-list">
                {searchResults.map((item) => <WorkspaceRow key={item.id} item={item} active={activeDestination === item.id} onSelect={onSelect} />)}
              </div> : <div className="explore-search-empty"><strong>NO MATCHING WORKSPACE</strong><span>Try a protocol, tool, or evidence type.</span></div>}
            </section> : <><section className="explore-section" aria-labelledby="explore-start-title">
              <header><span id="explore-start-title">Start here</span></header>
              <div className="explore-list">
                {FEATURED_WORKSPACE_IDS.map((id) => <WorkspaceRow key={id} item={workspaceDefinition(id)} active={activeDestination === id} onSelect={onSelect} />)}
              </div>
            </section>

            <details className="explore-scenarios">
              <summary><span>Failure scenarios</span><i aria-hidden="true">+</i></summary>
              <ScenarioGallery onSelect={onScenarioSelect} />
            </details>

            <div className="explore-groups">
              {EXPLORE_GROUPS.map((group) => (
                <section className="explore-section" key={group.id} aria-labelledby={`explore-group-${group.id}`}>
                  <header><span id={`explore-group-${group.id}`}>{group.label}</span><p>{group.description}</p></header>
                  <div className="explore-list">
                    {group.workspaceIds.map((id) => <WorkspaceRow key={id} item={workspaceDefinition(id)} active={activeDestination === id} onSelect={onSelect} />)}
                  </div>
                </section>
              ))}
            </div></>}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
