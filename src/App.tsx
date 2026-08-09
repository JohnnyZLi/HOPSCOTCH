import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import { NetworkField } from './NetworkField';
import type { NetworkLayer } from './simulation/model';

type DisplayMode = 'overview' | 'xray';

const layers: Array<{ id: NetworkLayer; label: string; kicker: string; description: string }> = [
  {
    id: 'internet',
    label: 'Internet',
    kicker: 'Scale 05',
    description: 'Autonomous systems, peering, backbone paths, and infrastructure.',
  },
  {
    id: 'routing',
    label: 'Routing',
    kicker: 'Scale 04',
    description: 'Control-plane state, route selection, convergence, and failure recovery.',
  },
  {
    id: 'transport',
    label: 'Transport',
    kicker: 'Scale 03',
    description: 'Flows, congestion windows, retransmissions, loss, and multiplexing.',
  },
  {
    id: 'application',
    label: 'Application',
    kicker: 'Scale 02',
    description: 'DNS, TLS, HTTP, QUIC, and the exchanges behind an application request.',
  },
  {
    id: 'packet',
    label: 'Packet',
    kicker: 'Scale 01',
    description: 'Frames, headers, fields, encapsulation, and individual protocol messages.',
  },
];

export default function App() {
  const [layer, setLayer] = useState<NetworkLayer>('internet');
  const [mode, setMode] = useState<DisplayMode>('overview');
  const reduceMotion = useReducedMotion();
  const active = layers.find((item) => item.id === layer) ?? layers[0];

  return (
    <main className="app-shell" data-layer={layer} data-mode={mode}>
      <NetworkField mode={mode} layer={layer} />
      <div className="grid-field" aria-hidden="true" />
      <div className="scene-vignette" aria-hidden="true" />

      <motion.header
        className="topbar"
        initial={reduceMotion ? false : { opacity: 0, y: -18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
          <strong>HOPSCOTCH</strong>
        </div>
        <div className="build-state">
          <span>LAB 00</span>
          <span className="status-dot">Foundation online</span>
        </div>
      </motion.header>

      <section className="hero-copy">
        <motion.p
          className="eyebrow"
          initial={reduceMotion ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.7 }}
        >
          Interactive network systems laboratory
        </motion.p>

        <motion.h1
          initial={reduceMotion ? false : { opacity: 0, y: 34 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16, duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
        >
          SEE THE
          <span>INTERNET</span>
          HAPPEN.
        </motion.h1>

        <motion.p
          className="lede"
          initial={reduceMotion ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28, duration: 0.7 }}
        >
          Move from the global Internet to a single packet without losing the story in between.
          Routes, protocols, failures, and recovery become something you can watch, stop, rewind, and interrogate.
        </motion.p>

        <motion.div
          className="hero-actions"
          initial={reduceMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.38, duration: 0.65 }}
        >
          <motion.button
            className="primary-action"
            type="button"
            onClick={() => setMode((current) => (current === 'overview' ? 'xray' : 'overview'))}
            whileHover={reduceMotion ? undefined : { y: -2, scale: 1.015 }}
            whileTap={reduceMotion ? undefined : { scale: 0.985 }}
          >
            {mode === 'overview' ? 'Enter X-ray mode' : 'Return to overview'}
            <span aria-hidden="true">↗</span>
          </motion.button>
          <a className="text-action" href="https://github.com/JohnnyZLi/HOPSCOTCH">
            Source / architecture
          </a>
        </motion.div>
      </section>

      <nav className="scale-rail" aria-label="Network scale">
        {layers.map((item) => (
          <motion.button
            key={item.id}
            type="button"
            className={layer === item.id ? 'active' : ''}
            onClick={() => setLayer(item.id)}
            whileHover={reduceMotion ? undefined : { x: 5 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
          >
            <span>{item.kicker}</span>
            <strong>{item.label}</strong>
          </motion.button>
        ))}
      </nav>

      <AnimatePresence mode="wait" initial={false}>
        <motion.aside
          key={active.id}
          className="layer-card"
          initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 16, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -10, filter: 'blur(6px)' }}
          transition={{ duration: 0.34 }}
        >
          <span>{active.kicker}</span>
          <h2>{active.label}</h2>
          <p>{active.description}</p>
          <div className="card-rule" />
          <small>{mode === 'xray' ? 'X-RAY OVERLAY ACTIVE' : 'OVERVIEW MODEL'}</small>
        </motion.aside>
      </AnimatePresence>

      <motion.footer
        className="timeline-preview"
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.55, duration: 0.8 }}
      >
        <div className="timeline-labels">
          <span>TIME MACHINE</span>
          <span>00:00.000</span>
        </div>
        <div className="timeline-track" aria-hidden="true">
          <i />
          <b />
        </div>
        <span className="timeline-note">Deterministic event timeline · foundation placeholder</span>
      </motion.footer>
    </main>
  );
}
