import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(readFileSync(resolve(root, 'design-review/build-manifest.json'), 'utf8'));
if (manifest.schema !== 1) throw new Error('Unsupported review build manifest');
for (const [path, expected] of Object.entries({ ...manifest.inputs, ...manifest.outputs })) {
  const actual = createHash('sha256').update(readFileSync(resolve(root, path))).digest('hex');
  if (actual !== expected) throw new Error(`Review source/output drift: ${path}. Run npm run review:build and commit the generated pages.`);
}
const expectedPages = ['builder.html', 'connected.html', 'evidence.html', 'index.html', 'lifecycle.html', 'viewport.html'];
const actualPages = readdirSync(resolve(root, 'public/review')).sort();
if (JSON.stringify(actualPages) !== JSON.stringify(expectedPages)) throw new Error('Unexpected public review assets');
for (const page of expectedPages) {
  const path = `public/review/${page}`;
  if (!manifest.outputs[path]) throw new Error(`Unverified review page: ${page}`);
  const html = readFileSync(resolve(root, path), 'utf8');
  if (/href="\/(?:lifecycle|builder|evidence|connected)\.html"/.test(html)) throw new Error(`Review navigation escapes /review: ${page}`);
}
console.log('Review: editable source and six served pages match the build manifest.');
