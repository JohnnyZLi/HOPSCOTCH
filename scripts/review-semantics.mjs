import { fileURLToPath } from 'node:url';

process.chdir(fileURLToPath(new URL('../design-review/source/', import.meta.url)));
await import('../design-review/source/complete-review/check-source-semantics.mjs');
