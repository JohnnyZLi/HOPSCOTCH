// Validate the complete approved composition in the production artifact.
process.argv.push('--timeline');
await import('./complete-presentation-browser-check.mjs');
