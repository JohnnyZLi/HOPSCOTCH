import { motion, useReducedMotion } from 'motion/react';
import { SCENARIO_PRESET_CARDS, type ScenarioPresetId } from './scenarios/catalog.ts';
import './ScenarioGallery.css';

export function ScenarioGallery({ onSelect }: { onSelect: (id: ScenarioPresetId) => void }) {
  const reduceMotion = useReducedMotion();

  return (
    <section className="scenario-gallery" aria-labelledby="scenario-gallery-title">
      <header className="scenario-gallery-heading">
        <div>
          <span>Deterministic stories</span>
          <h2 id="scenario-gallery-title">Start at the failure.</h2>
        </div>
        <p>Each preset launches the same request model with a specific network condition already applied.</p>
      </header>

      <div className="scenario-gallery-grid">
        {SCENARIO_PRESET_CARDS.map((preset) => (
          <motion.button
            key={preset.id}
            type="button"
            className="scenario-preset-card"
            data-scenario-preset={preset.id}
            onClick={() => onSelect(preset.id)}
            whileHover={reduceMotion ? undefined : { x: 4 }}
            whileTap={reduceMotion ? undefined : { scale: 0.994 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          >
            <span className="scenario-preset-kicker">{preset.kicker}</span>
            <strong>{preset.title}</strong>
            <p>{preset.description}</p>
            <span className="scenario-preset-meta">{preset.meta}</span>
            <i aria-hidden="true">↗</i>
          </motion.button>
        ))}
      </div>
    </section>
  );
}
