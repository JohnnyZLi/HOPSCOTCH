import assert from 'node:assert/strict';
import {environment} from './check-complete.mjs';

// Synthetic DOM regression for a browser-observed bug: the first mutation
// token precedes the retained-state transfer in DOM order. Resetting a broad
// .rv-transfer query hides that token after the source value has faded out.
for (const width of [320, 390, 1024, 1440]) {
  const e = await environment('motion', width);
  const api = e.root.causalStudy;
  api.select('packetOps');
  await e.flush();
  const snapshot = api.snapshot();
  let checked = 0;
  for (const phase of snapshot.plan.phases.filter(p => p.kind === 'modify')) {
    const changes = snapshot.plan.prepared[phase.index].mutations;
    for (const change of changes) {
      const b = change.plan.boundaries;
      api.seek(phase.start + (b.lift + b.flight) / 2);
      assert.ok(Number(change.view.node.style.opacity) > .9,
        `visible mutation token: ${width}px ${phase.index} ${change.fieldId}`);
      assert.equal(change.view.note.hidden, true,
        'In-place changes use the existing scene explanation, not a label over adjacent fields');
      checked++;
    }
  }
  assert.ok(checked >= 2);
  api.dispose();
  console.log(`PASS mutation ownership: ${width}px, ${checked} values`);
}
