import { fileURLToPath } from 'node:url';

process.chdir(fileURLToPath(new URL('../design-review/source/', import.meta.url)));
await import('../design-review/source/complete-review/check-source-semantics.mjs');
await import('../design-review/source/complete-review/check-production-runtime.mjs');
await import('../design-review/source/complete-review/check-audit-lifecycle.mjs');
