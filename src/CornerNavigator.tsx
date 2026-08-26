import { motion, useReducedMotion } from 'motion/react';
import './CornerNavigator.css';

export function CornerNavigator({
  open,
  current,
  onOpen,
}: {
  open: boolean;
  current: string;
  onOpen: () => void;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.button
      type="button"
      className="corner-navigator"
      aria-label={`Open HOPSCOTCH navigation. Current view: ${current}`}
      aria-expanded={open}
      aria-controls="explore-dialog"
      onClick={onOpen}
      initial={reduceMotion ? false : { opacity: 0, x: -14, y: -14 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : .55, ease: [.16, 1, .3, 1] }}
    >
      <span className="corner-navigator-mark" aria-hidden="true"><i /><i /><i /></span>
      <span className="corner-navigator-copy"><strong>HOPSCOTCH</strong><small>{current}</small></span>
      <span className="corner-navigator-symbol" aria-hidden="true">+</span>
    </motion.button>
  );
}
