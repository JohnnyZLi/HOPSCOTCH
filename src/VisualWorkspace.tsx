import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';
import './VisualWorkspace.css';

export type VisualDrawerId = 'inspect' | 'config' | 'events' | 'evidence' | 'tools';

export interface VisualDrawerDefinition {
  id: VisualDrawerId;
  label: string;
  title: string;
  eyebrow?: string;
  content: ReactNode;
}

export interface VisualTimelineEvent {
  id: string;
  atMs: number;
  label: string;
  tone?: 'neutral' | 'warning' | 'danger' | 'success' | 'evidence';
}

export interface VisualTimelineMilestone {
  id: string;
  atMs: number;
  label: string;
}

function formatTime(timeMs: number): string {
  const seconds = Math.floor(timeMs / 1000).toString().padStart(2, '0');
  const milliseconds = Math.floor(timeMs % 1000).toString().padStart(3, '0');
  return `00:${seconds}.${milliseconds}`;
}

function focusableElements(root: HTMLElement): HTMLElement[] {
  const selector = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(',');
  return Array.from(root.querySelectorAll<HTMLElement>(selector)).filter((element) => {
    if (element.hidden || element.getClientRects().length === 0) return false;
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden';
  });
}

export function useVisualDrawerFocus<T extends HTMLElement>(active: boolean, onClose: () => void, activationKey: unknown = active) {
  const drawerRef = useRef<T>(null);
  const initialFocusRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!active) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    initialFocusRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !drawerRef.current) return;
      const focusable = focusableElements(drawerRef.current);
      if (focusable.length === 0) {
        event.preventDefault();
        initialFocusRef.current?.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!drawerRef.current.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previousFocus?.focus();
    };
  }, [active, activationKey]);

  return { drawerRef, initialFocusRef };
}

export function VisualWorkspaceDrawer({ drawer, onClose, className = '' }: { drawer: VisualDrawerDefinition; onClose: () => void; className?: string }) {
  const { drawerRef, initialFocusRef } = useVisualDrawerFocus<HTMLElement>(true, onClose);

  return (
    <>
      <motion.button
        type="button"
        className="visual-drawer-backdrop"
        aria-label={`Close ${drawer.label}`}
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />
      <motion.aside
        ref={drawerRef}
        className={`visual-drawer ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`visual-drawer-${drawer.id}-title`}
        initial={{ opacity: 0, x: 42 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 28 }}
        transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
      >
        <header className="visual-drawer__header">
          <div>
            <span>{drawer.eyebrow ?? drawer.label}</span>
            <h2 id={`visual-drawer-${drawer.id}-title`}>{drawer.title}</h2>
          </div>
          <button ref={initialFocusRef} type="button" className="visual-drawer__close" onClick={onClose} aria-label={`Close ${drawer.label}`}>×</button>
        </header>
        <div className="visual-drawer__body">{drawer.content}</div>
      </motion.aside>
    </>
  );
}

export function VisualOverlayDrawer({
  active,
  drawers,
  onClose,
  className = '',
}: {
  active: VisualDrawerId | null;
  drawers: readonly VisualDrawerDefinition[];
  onClose: () => void;
  className?: string;
}) {
  const drawer = drawers.find((candidate) => candidate.id === active) ?? null;
  return <AnimatePresence>{drawer && <VisualWorkspaceDrawer key={drawer.id} drawer={drawer} onClose={onClose} className={className} />}</AnimatePresence>;
}

export function VisualEntranceTransition({ entrance }: {
  entrance: { eyebrow: string; title: string; accentTitle: string; subtitle?: string };
}) {
  const reduceMotion = useReducedMotion();
  const [visible, setVisible] = useState(!reduceMotion);

  useEffect(() => {
    if (reduceMotion) {
      setVisible(false);
      return;
    }
    const timeout = window.setTimeout(() => setVisible(false), 1280);
    return () => window.clearTimeout(timeout);
  }, [reduceMotion]);

  return <AnimatePresence>{visible && (
    <motion.div
      className="visual-entrance"
      aria-hidden="true"
      initial={{ opacity: 0, scale: 1.035, filter: 'blur(16px)' }}
      animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, scale: 0.82, y: -84, filter: 'blur(12px)' }}
      transition={{ duration: 0.62, ease: [0.16, 1, 0.3, 1] }}
    >
      <span>{entrance.eyebrow}</span>
      <strong>{entrance.title}<em>{entrance.accentTitle}</em></strong>
      {entrance.subtitle && <small>{entrance.subtitle}</small>}
    </motion.div>
  )}</AnimatePresence>;
}

export function VisualWorkspaceShell({
  className = '',
  entrance,
  toolbar,
  hud,
  stageLabel,
  activeDrawer,
  drawers,
  onCloseDrawer,
  children,
  timeline,
}: {
  className?: string;
  entrance: { eyebrow: string; title: string; accentTitle: string; subtitle?: string };
  toolbar?: ReactNode;
  hud?: ReactNode;
  stageLabel: string;
  activeDrawer: VisualDrawerId | null;
  drawers: readonly VisualDrawerDefinition[];
  onCloseDrawer: () => void;
  children: ReactNode;
  timeline: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const drawer = drawers.find((candidate) => candidate.id === activeDrawer) ?? null;

  return (
    <motion.section
      className={`visual-workspace ${className}`.trim()}
      data-inspect-mode={drawer ? 'active' : 'idle'}
      initial={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.35 }}
    >
      <div className="visual-workspace__stage" role="region" aria-label={stageLabel}>
        <div className="visual-workspace__ambient" aria-hidden="true" />
        {children}
        {hud && <div className="visual-workspace__hud">{hud}</div>}
        {toolbar && <div className="visual-workspace__toolbar">{toolbar}</div>}
        <VisualOverlayDrawer active={activeDrawer} drawers={drawers} onClose={onCloseDrawer} />
        <VisualEntranceTransition entrance={entrance} />
      </div>
      {timeline}
    </motion.section>
  );
}

export function VisualTimeRail({
  timeMs,
  durationMs,
  playing,
  label,
  context,
  events,
  milestones = [],
  onToggle,
  onReset,
  onSeek,
}: {
  timeMs: number;
  durationMs: number;
  playing: boolean;
  label: string;
  context?: string;
  events: readonly VisualTimelineEvent[];
  milestones?: readonly VisualTimelineMilestone[];
  onToggle: () => void;
  onReset: () => void;
  onSeek: (timeMs: number) => void;
}) {
  const markerStyle = (atMs: number) => ({ '--event-position': `${Math.max(0, Math.min(100, atMs / durationMs * 100))}%` }) as CSSProperties;

  return (
    <footer className="visual-time-rail">
      <div className="visual-time-rail__controls">
        <button type="button" onClick={onToggle} aria-label={playing ? 'Pause scenario' : 'Play scenario'}>{playing ? 'Ⅱ' : '▶'}</button>
        <button type="button" onClick={onReset} aria-label="Reset scenario">↺</button>
      </div>
      <div className="visual-time-rail__readout">
        <span>{label}</span>
        <strong>{formatTime(timeMs)}</strong>
      </div>
      <div className="visual-time-rail__track">
        <div className="visual-time-rail__milestones" aria-hidden="true">
          {milestones.map((milestone) => <span key={milestone.id} style={markerStyle(milestone.atMs)}>{milestone.label}</span>)}
        </div>
        <div className="visual-time-rail__events">
          {events.map((event) => (
            <button
              key={event.id}
              type="button"
              className={`${event.atMs <= timeMs ? 'passed ' : ''}tone-${event.tone ?? 'neutral'}`}
              style={markerStyle(event.atMs)}
              onClick={() => onSeek(event.atMs)}
              aria-label={`${event.label} at ${formatTime(event.atMs)}`}
              title={event.label}
            />
          ))}
        </div>
        <input
          type="range"
          min="0"
          max={durationMs}
          step="10"
          value={Math.round(timeMs)}
          onChange={(event) => onSeek(Number(event.currentTarget.value))}
          aria-label="Scenario time"
        />
      </div>
      <div className="visual-time-rail__duration"><span>{context}</span><strong>{formatTime(durationMs)}</strong></div>
    </footer>
  );
}

export function VisualDrawerTabs({
  active,
  items,
  onSelect,
}: {
  active: VisualDrawerId | null;
  items: readonly { id: VisualDrawerId; label: string; badge?: string }[];
  onSelect: (id: VisualDrawerId) => void;
}) {
  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    const currentIndex = Math.max(0, items.findIndex((item) => item.id === active));
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    const next = items[(currentIndex + direction + items.length) % items.length];
    event.preventDefault();
    onSelect(next.id);
  };

  return (
    <div className="visual-drawer-tabs" role="toolbar" aria-label="Workspace tools" onKeyDown={onKeyDown}>
      {items.map((item) => (
        <button key={item.id} type="button" className={active === item.id ? 'active' : ''} aria-pressed={active === item.id} onClick={() => onSelect(item.id)}>
          {item.label}{item.badge && <span>{item.badge}</span>}
        </button>
      ))}
    </div>
  );
}
