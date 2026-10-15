// Browser validation follows the complete approved composition.
process.argv.push('--choreography');
process.env.HOPSCOTCH_VISUAL_REVIEW_DIR='artifacts/phase5-choreography-review';
await import('./complete-presentation-browser-check.mjs');
