import assert from 'node:assert/strict';
import { environment } from './check-complete.mjs';

function pointsFor(plan, nodeIds = null, linkIds = null) {
  return [
    ...plan.nodes.filter(node => !nodeIds || nodeIds.includes(node.id)).flatMap(node => [
      [node.x - node.w / 2, node.y - node.h / 2],
      [node.x + node.w / 2, node.y + node.h / 2],
    ]),
    ...plan.links.filter(link => !linkIds || linkIds.includes(link.id)).flatMap(link => link.points),
  ];
}
function assertVisible(snapshot, points) {
  const { camera, viewport } = snapshot;
  for (const [x, y] of points) {
    const screenX = camera.x + x * camera.z, screenY = camera.y + y * camera.z;
    assert(screenX >= -1e-6 && screenX <= viewport.w + 1e-6, 'Framing contains every selected node edge and routed connection horizontally');
    assert(screenY >= -1e-6 && screenY <= viewport.h + 1e-6, 'Framing contains every selected node edge and routed connection vertically');
  }
}
for (const width of [320, 390, 1024, 1440]) {
  const env = await environment('workbench', width, { artifactPath: '../../public/review/builder.html' });
  const api = env.root.builderStudy;
  await env.flush();
  const before = api.snapshot(), input = JSON.stringify(before.input), selected = JSON.stringify(before.selected);
  env.q('.wb-home').click();
  assertVisible(api.snapshot(), pointsFor(before.graphPlan));
  env.q('.wb-in').click();
  const zoomed = api.snapshot().camera.z;
  env.q('.wb-out').click();
  assert(api.snapshot().camera.z <= zoomed, 'Zoom out cannot jump to a larger fixed zoom');
  const source = before.input;
  const trace = env.root.reviewDomain.traceBuilderForwarding(source.graph, source.addressing, source.routing, source.sourceId, source.destinationId);
  const path = env.root.networkScene.traceState(trace, source.graph);
  env.q('.wb-show-path').click();
  assertVisible(api.snapshot(), pointsFor(before.graphPlan, path.nodeIds, path.linkIds));
  assert.equal(JSON.stringify(api.snapshot().input), input, 'Framing preserves configuration, derived state and history');
  assert.equal(JSON.stringify(api.snapshot().selected), selected, 'Framing preserves device selection');
  console.log('PASS network framing', width);
}
