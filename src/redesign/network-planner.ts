type NetworkNode = { id: string; label: string };
type Graph = { nodes: NetworkNode[]; links: unknown[] };
type Measure = ((label: string) => number) & { box?: (label: string) => unknown };

export function createNetworkPlanner() {
  let active: { worker: Worker; reject: (error: Error) => void } | undefined;
  function cancel() {
    active?.worker.terminate();
    active?.reject(new Error('Cancelled obsolete layout'));
    active = undefined;
  }
  return {
    dispose: cancel,
    buildAsync(graph: Graph, measure: Measure, progress: () => void, authored: unknown) {
      cancel();
      progress();
      const metrics = Object.fromEntries(graph.nodes.map(node => [node.label, { width: measure(node.label), box: measure.box?.(node.label) }]));
      return new Promise((resolve, reject) => {
        const worker = new Worker(new URL('./network-planner-worker.js', import.meta.url), { type: 'module' });
        active = { worker, reject };
        const finish = () => { worker.terminate(); if (active?.worker === worker) active = undefined; };
        worker.onmessage = event => {
          finish();
          try { progress(); if (event.data.error) reject(new Error(event.data.error)); else resolve(event.data.plan); }
          catch (error) { reject(error); }
        };
        worker.onerror = event => { finish(); reject(new Error(event.message || 'Network layout failed')); };
        worker.postMessage({ graph, metrics, authored });
      });
    },
  };
}
