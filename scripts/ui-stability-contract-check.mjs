import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const styles = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
const journey = readFileSync(new URL('../src/JourneyTheater.css', import.meta.url), 'utf8');

assert.ok(
  styles.includes('right: max(206px, calc((100vw - min(1500px, calc(100vw - 64px))) / 2 + 174px));'),
  'overview layer card must reserve the scale-rail lane instead of sharing its right gutter',
);
assert.ok(
  styles.includes('right: max(32px, calc((100vw - min(1500px, calc(100vw - 64px))) / 2));'),
  'scale rail must retain the canonical viewport/content gutter anchor',
);

assert.ok(
  journey.includes('.journey-stage-meta>div{display:grid;flex:1 1 0;min-width:0;gap:3px}'),
  'Journey metadata cells must use stable equal flex bases',
);
assert.ok(
  journey.includes('.journey-stage-meta>div:first-child{flex:0 0 8.6rem}'),
  'Journey timer cell must reserve a fixed lane so changing digits cannot shift adjacent metadata',
);
assert.ok(
  journey.includes('font-variant-numeric:tabular-nums'),
  'Journey timer must request tabular numerals',
);
assert.ok(
  journey.includes('font-feature-settings:"tnum" 1'),
  'Journey timer must explicitly request the tnum OpenType feature',
);
assert.ok(
  journey.includes('.journey-stage-meta{display:grid;grid-template-columns:repeat(2,1fr);gap:6px;padding:9px}'),
  'mobile Journey metadata must keep its two-column responsive override',
);

console.log('UI stability contract passed: overview scale/card lanes are separated and Journey timer metadata cannot reflow adjacent cells.');
