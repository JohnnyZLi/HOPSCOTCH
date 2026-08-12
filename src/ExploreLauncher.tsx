import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef } from 'react';
import { ScenarioGallery } from './ScenarioGallery';
import type { ScenarioPresetId } from './scenarios/catalog.ts';
import './ExploreLauncher.css';

export type ExploreDestination =
  | 'journey'
  | 'failure'
  | 'builder'
  | 'packet'
  | 'tcp'
  | 'dns'
  | 'tls'
  | 'http'
  | 'internet'
  | 'physical'
  | 'observed'
  | 'measured';

type ExploreItem = {
  id: ExploreDestination;
  lab: string;
  title: string;
  description: string;
  meta: string;
};

type FeaturedExploreItem = ExploreItem & {
  action: string;
  tone: 'watch' | 'break' | 'build';
};

const FEATURED_ITEMS: readonly FeaturedExploreItem[] = [
  {
    id: 'journey',
    lab: 'LAB 06 + 07',
    title: 'Watch a request',
    description: 'Follow one HTTPS request from intent to DNS, routing, transport, TLS, HTTP, packets, failures, and recovery.',
    meta: 'URL JOURNEY · GOD MODE',
    action: 'PLAY JOURNEY',
    tone: 'watch',
  },
  {
    id: 'failure',
    lab: 'LAB 01',
    title: 'Break the network',
    description: 'Drop the active route and watch convergence, route recomputation, failover, and causal state unfold in time.',
    meta: 'FAILURE · RECOVERY · TIME MACHINE',
    action: 'BREAK ROUTE',
    tone: 'break',
  },
  {
    id: 'builder',
    lab: 'LAB 04',
    title: 'Build a network',
    description: 'Author a weighted topology, move nodes, change costs, fail links, and inspect deterministic route selection.',
    meta: 'TOPOLOGY · ROUTING · AUTHORING',
    action: 'OPEN BUILDER',
    tone: 'build',
  },
];

const PROTOCOL_ITEMS: readonly ExploreItem[] = [
  {
    id: 'packet',
    lab: 'LAB 02',
    title: 'Packet microscope',
    description: 'Peel Ethernet, IP, TCP, and UDP layers down to bytes and watch fields change derived lengths and checksums.',
    meta: 'ENCAPSULATION · BYTES · CHECKSUMS',
  },
  {
    id: 'tcp',
    lab: 'LAB 03A',
    title: 'TCP theater',
    description: 'Inspect handshake, teardown, duplicate ACKs, fast retransmit, and the congestion-window teaching model.',
    meta: 'TCP · LOSS · RETRANSMISSION',
  },
  {
    id: 'dns',
    lab: 'LAB 03B',
    title: 'DNS theater',
    description: 'Compare recursive client behavior with resolver work through root, TLD, authoritative referrals, and cache hits.',
    meta: 'DNS · CACHE · AUTHORITY WALK',
  },
  {
    id: 'tls',
    lab: 'LAB 03C',
    title: 'TLS 1.3 theater',
    description: 'Step through negotiation, certificate proof, Finished, the encryption boundary, and application-key transition.',
    meta: 'TLS 1.3 · KEYS · CERTIFICATES',
  },
  {
    id: 'http',
    lab: 'LAB 03D',
    title: 'HTTP/2 vs HTTP/3',
    description: 'Inject the same loss into both transports and see TCP connection-level blocking versus QUIC stream independence.',
    meta: 'HTTP/2 · HTTP/3 · QUIC',
  },
];

const INTERNET_ITEMS: readonly ExploreItem[] = [
  {
    id: 'internet',
    lab: 'LAB 05A',
    title: 'AS routing theater',
    description: 'Explore autonomous-system relationships, valley-free teaching policy, relationship failures, and policy reroutes.',
    meta: 'BGP POLICY · AS PATHS · CANVAS',
  },
  {
    id: 'physical',
    lab: 'LAB 05C',
    title: 'Physical Internet',
    description: 'Move through a WebGL facility globe backed by public PeeringDB coordinates and explicitly inferred corridors.',
    meta: 'FACILITIES · GLOBE · PUBLIC DATA',
  },
  {
    id: 'observed',
    lab: 'LAB 05B',
    title: 'Observed Internet',
    description: 'Inspect edge-observed request context and public routing evidence without pretending collector paths are your route.',
    meta: 'OBSERVED · PUBLIC COLLECTOR · PROVENANCE',
  },
];

const EVIDENCE_ITEMS: readonly ExploreItem[] = [
  {
    id: 'measured',
    lab: 'LAB 09',
    title: 'Measured network',
    description: 'Inspect session-only local measurements with explicit scope, target matching, freshness, and provenance boundaries.',
    meta: 'LOCAL MEASURED · BOUNDED · NOT GLOBAL',
  },
];

const GROUPS: ReadonlyArray<{ label: string; description: string; items: readonly ExploreItem[] }> = [
  {
    label: 'Protocols',
    description: 'Zoom into the exchanges and bytes that make one request work.',
    items: PROTOCOL_ITEMS,
  },
  {
    label: 'Internet scale',
    description: 'Pull back from local routing to interdomain policy, physical facilities, and public evidence.',
    items: INTERNET_ITEMS,
  },
  {
    label: 'Evidence',
    description: 'Keep measured observations inspectable without turning them into simulated truth.',
    items: EVIDENCE_ITEMS,
  },
];

function ExploreCard({ item, onSelect }: { item: ExploreItem; onSelect: (destination: ExploreDestination) => void }) {
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
      <strong>{item.title}</strong>
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

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    const focusFrame = requestAnimationFrame(() => panelRef.current?.focus({ preventScroll: true }));
    return () => {
      cancelAnimationFrame(focusFrame);
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="explore-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="explore-title"
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
                <span>HOPSCOTCH · EXPLORE</span>
                <h1 id="explore-title">Pick something to do.</h1>
                <p>Every major lab is one click away. Start with a complete request, break the network, build your own, or jump directly to a protocol.</p>
              </div>
              <button type="button" className="explore-close" onClick={onClose} aria-label="Close Explore launcher">
                CLOSE <span>ESC</span>
              </button>
            </header>

            <section className="explore-featured" aria-label="Featured HOPSCOTCH experiences">
              {FEATURED_ITEMS.map((item) => (
                <motion.button
                  key={item.id}
                  type="button"
                  className="explore-featured-card"
                  data-tone={item.tone}
                  data-explore-destination={item.id}
                  onClick={() => onSelect(item.id)}
                  whileHover={reduceMotion ? undefined : { y: -5 }}
                  whileTap={reduceMotion ? undefined : { scale: 0.992 }}
                  transition={{ type: 'spring', stiffness: 340, damping: 26 }}
                >
                  <span className="explore-featured-lab">{item.lab}</span>
                  <strong>{item.title}</strong>
                  <p>{item.description}</p>
                  <span className="explore-featured-meta">{item.meta}</span>
                  <span className="explore-featured-action">{item.action} <i aria-hidden="true">↗</i></span>
                </motion.button>
              ))}
            </section>

            <ScenarioGallery onSelect={onScenarioSelect} />

            <div className="explore-groups">
              {GROUPS.map((group) => (
                <section className="explore-group" key={group.label}>
                  <header>
                    <span>{group.label}</span>
                    <p>{group.description}</p>
                  </header>
                  <div className="explore-grid">
                    {group.items.map((item) => <ExploreCard key={item.id} item={item} onSelect={onSelect} />)}
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
