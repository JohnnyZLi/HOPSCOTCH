import assert from 'node:assert/strict';
import { environment } from './check-complete.mjs';

for (const width of [320, 390, 1024, 1440]) {
  const env = await environment('motion', width, { artifactPath: '../../public/review/lifecycle.html' });
  const api = env.root.causalStudy;
  const source = JSON.stringify(env.root.reviewData);
  api.select('tcp');
  await env.flush();
  const frames = api.snapshot().frames;
  for (const [index, frame] of frames.entries()) {
    if (!frame.local) continue;
    assert(!frame.fields.some(field => ['Sequence', 'Acknowledgment', 'Flags', 'Data length'].includes(field.label)));
    for (const [key, label] of [['cwndMss', 'Congestion window'], ['ssthreshMss', 'Slow-start threshold']]) {
      const before = frames[index - 1].state[key], after = frame.state[key];
      const expected = before === after ? `${after} MSS` : `${before} MSS → ${after} MSS`;
      assert.equal(frame.fields.find(field => field.label === label).value, expected);
    }
    assert(frame.readIds.length > 0);
    for (const id of frame.readIds) assert(frame.fields.some(field => field.id === id && field.changed));
  }
  api.select('tls');
  await env.flush();
  const tls = api.snapshot().frames;
  for (const frame of tls.filter(frame => frame.local)) {
    assert(!frame.fields.some(field => ['Protection', 'Actor', 'Phase'].includes(field.label)));
    assert.equal(frame.records.find(record => record.label === 'Negotiated cipher').value, frame.state.negotiatedCipher);
    for (const id of frame.readIds) assert(frame.fields.some(field => field.id === id));
  }
  const result = tls.at(-1);
  assert.equal(result.fields.find(field => field.label === 'Application traffic').value, result.state.applicationReady ? 'Ready' : 'Not ready');
  assert.equal(result.fields.find(field => field.label === 'Application protocol').value, result.state.negotiatedAlpn);
  assert.equal(result.fields.find(field => field.label === 'Server certificate').value.toLowerCase(), result.state.certificateState);
  assert.equal(JSON.stringify(env.root.reviewData), source, 'Presentation adapters preserve every source event, state, byte and timestamp');
  api.dispose();
  console.log('PASS source semantics', width);
}
