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
  api.select('journey');
  await env.flush();
  const journey = api.snapshot();
  for (const frame of journey.frames) {
    const sourceFrame = env.root.reviewData.journey.frames.find(item => item.event.id === frame.id);
    assert.equal(frame.at, sourceFrame.event.atMs);
    assert.equal(frame.state, sourceFrame.state);
    assert.equal(frame.event, sourceFrame.event);
    assert(!frame.fields.some(field => ['Protocol', 'Actor', 'Target', 'Scale'].includes(field.label)));
    if (['dns.query', 'dns.referral', 'dns.answer'].includes(frame.event.kind)) {
      assert.equal(frame.local, false, 'DNS source exchanges travel as wire objects');
      const index = journey.frames.indexOf(frame);
      assert.equal(journey.plan.phases.filter(phase => phase.index === index && phase.kind === 'open').length, 1);
    }
    if (frame.assembly) {
      const index = journey.frames.indexOf(frame);
      assert(!journey.plan.phases.some(phase => phase.index === index && ['construct', 'release'].includes(phase.kind)));
    }
  }
  const assemblies = journey.frames.filter(frame => frame.assembly);
  assert.equal(new Set(assemblies.map(frame => frame.assembly.identity)).size, 1);
  api.select('dns');
  await env.flush();
  const dns = api.snapshot().frames;
  const referral = dns.find(frame => frame.kind === 'referral');
  assert.equal(referral.local, false);
  assert.equal(referral.fields.find(field => field.label === 'Next authority').value, referral.event.records[0].value);
  assert.equal(dns.at(-1).local, true, 'Resolution outcome is retained local state');
  api.select('provider');
  await env.flush();
  const provider = api.snapshot();
  const operations = provider.frames.filter(frame => frame.labelOperation);
  assert.deepEqual(operations.map(frame => frame.labelOperation), env.root.reviewData.provider.lsp.operations);
  assert.equal(new Set(operations.map(frame => frame.identity)).size, 1);
  assert(operations.every(frame => frame.envelope === null), 'Independent GRE and MPLS projections are not combined into an invented source packet');
  assert(provider.frames.every(frame => frame.at === null));
  for (const operation of operations) {
    const index = provider.frames.indexOf(operation);
    const phase = provider.plan.phases.find(phase => phase.index === index && phase.kind === 'hold');
    api.seek(phase.start);
    const carrier = env.root.querySelector('[data-identity="mpls-payload"]');
    assert(carrier);
    assert.equal(carrier.style.opacity, '1');
    const label = env.root.querySelector('.rv-envelope-trailer');
    assert.equal(label.hidden, operation.labelOperation.operation === 'POP');
    if (!label.hidden) assert.equal(label.dataset.label, String(operation.labelOperation.outLabel));
  }
  assert.equal(JSON.stringify(env.root.reviewData), source, 'Presentation adapters preserve every source event, state, byte and timestamp');
  api.dispose();
  console.log('PASS source semantics', width);
}
