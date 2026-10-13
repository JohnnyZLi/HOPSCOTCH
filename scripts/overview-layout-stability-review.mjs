// Browser validation follows the complete approved composition.
process.argv.push('--overview');
process.env.HOPSCOTCH_VISUAL_REVIEW_DIR='artifacts/overview-layout-stability-review';
await import('./complete-presentation-browser-check.mjs');
