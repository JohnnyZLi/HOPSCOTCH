from pathlib import Path

p = Path('src/builder/data-plane.ts')
text = p.read_text()
old = '''    for (const flow of scenario.flows) {
      if (!activeAt(flow, atMs)) continue;
      const packetsExact = flow.offeredRateMbps * 1_000_000 / 8 * (scenario.tickMs / 1000) / flow.packetBytes + (generatedRemainder.get(flow.id) ?? 0);
      const packets = Math.min(2000, Math.floor(packetsExact));
      generatedRemainder.set(flow.id, packetsExact - packets);
      const firstLinkId = flow.pathLinkIds[0];
      const firstRuntime = runtime.get(firstLinkId)!;
      for (let index = 0; index < packets; index += 1) enqueuePacket({ token: { flowId: flow.id, bytes: flow.packetBytes, queuedAtMs: atMs, hopIndex: 0, ecnMarked: false }, linkId: firstLinkId, runtime: firstRuntime, profiles, atMs, flow, events, flowDrops, flowMarks });
    }
'''
new = '''    const pending = scenario.flows.map((flow) => {
      if (!activeAt(flow, atMs)) return { flow, packets: 0 };
      const packetsExact = flow.offeredRateMbps * 1_000_000 / 8 * (scenario.tickMs / 1000) / flow.packetBytes + (generatedRemainder.get(flow.id) ?? 0);
      const packets = Math.min(2000, Math.floor(packetsExact));
      generatedRemainder.set(flow.id, packetsExact - packets);
      return { flow, packets };
    });
    let pendingPackets = pending.reduce((sum, entry) => sum + entry.packets, 0);
    while (pendingPackets > 0) {
      for (const entry of pending) {
        if (entry.packets <= 0) continue;
        const flow = entry.flow;
        const firstLinkId = flow.pathLinkIds[0];
        enqueuePacket({ token: { flowId: flow.id, bytes: flow.packetBytes, queuedAtMs: atMs, hopIndex: 0, ecnMarked: false }, linkId: firstLinkId, runtime: runtime.get(firstLinkId)!, profiles, atMs, flow, events, flowDrops, flowMarks });
        entry.packets -= 1;
        pendingPackets -= 1;
      }
    }
'''
if old not in text:
    raise SystemExit('data-plane generation block not found')
p.write_text(text.replace(old, new, 1))

p = Path('package.json')
text = p.read_text()
if 'test:builder-data-plane-contract' not in text:
    text = text.replace('"test:builder-causal-diagnosis-contract": "node scripts/builder-causal-diagnosis-contract-check.mjs",', '"test:builder-causal-diagnosis-contract": "node scripts/builder-causal-diagnosis-contract-check.mjs",\n    "test:builder-data-plane-contract": "node scripts/builder-data-plane-contract-check.mjs",', 1)
    text = text.replace('npm run test:builder-causal-diagnosis-contract && npm run test:worker-contract', 'npm run test:builder-causal-diagnosis-contract && npm run test:builder-data-plane-contract && npm run test:worker-contract', 1)
p.write_text(text)
