import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const styles = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
const journey = readFileSync(new URL('../src/JourneyTheater.css', import.meta.url), 'utf8');

// Keep the selected scale explanation structurally attached to the rail; production review covers all five rows.
assert.ok(
  styles.includes('.scale-inspector {'),
  'overview scale selector and explanation must share one scale-inspector positioning context',
);
assert.ok(
  styles.includes('top: clamp(240px, 31vh, 320px);'),
  'desktop scale inspector must occupy the open scene band rather than the launch-card row',
);
assert.ok(
  styles.includes('right: max(32px, calc((100vw - min(1500px, calc(100vw - 64px))) / 2));'),
  'scale inspector must retain the canonical viewport/content gutter anchor',
);
assert.ok(
  styles.includes('.scale-inspector[data-active-scale="packet"] { --scale-detail-y: 232.5px; }'),
  'scale explanation must track the selected rail row instead of floating at one fixed vertical position',
);
assert.ok(
  styles.includes('right: 174px;') && styles.includes('width: 32px;'),
  'scale explanation and active rail row must preserve the dedicated connector lane',
);
assert.ok(
  styles.includes('background: linear-gradient(90deg, rgba(5, 8, 12, 0.82), rgba(5, 8, 12, 0.46) 72%, rgba(5, 8, 12, 0));'),
  'scale explanation must use a lightweight scene flyout rather than a bordered dashboard card',
);
assert.ok(
  styles.includes('@media (max-width: 1380px) and (min-width: 1181px)') && styles.includes('display: none;'),
  'scale explanation must disappear before it can collide horizontally with the hero/action deck',
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

console.log('UI stability contract passed: the attached scale inspector stays out of primary action space, and Journey timer metadata cannot reflow adjacent cells.');
