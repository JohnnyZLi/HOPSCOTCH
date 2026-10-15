// Browser validation follows the complete approved composition.
process.argv.push('--geometry');
process.env.HOPSCOTCH_VISUAL_REVIEW_DIR='artifacts/journey-dns-geometry-review';
await import('./complete-presentation-browser-check.mjs');
