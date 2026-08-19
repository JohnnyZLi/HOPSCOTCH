from pathlib import Path
p=Path('src/builder/data-plane.ts')
text=p.read_text()
text=text.replace("  recovery: 'NONE' | 'ECN BACKOFF' | 'LOSS RECOVERY' | 'UDP UNRESPONSIVE';\n", "  recovery: 'NONE' | 'ECN BACKOFF' | 'LOSS RECOVERY' | 'UDP UNRESPONSIVE';\n  finalSendingRateMbps: number;\n  backoffEvents: number;\n",1)
text=text.replace("  kind: 'QUEUE_GROWTH' | 'ECN_MARK' | 'TAIL_DROP' | 'TRANSPORT_BACKOFF' | 'QUEUE_DRAINED';\n", "  kind: 'QUEUE_GROWTH' | 'ECN_MARK' | 'TAIL_DROP' | 'TRANSPORT_BACKOFF' | 'TRANSPORT_RECOVERY' | 'QUEUE_DRAINED';\n",1)
needle="""  const flowSerialization = new Map<string, number>();
  const queueSamples: BuilderQueueSample[] = [];
"""
replace="""  const flowSerialization = new Map<string, number>();
  const flowRateFactor = new Map<string, number>(scenario.flows.map((flow) => [flow.id, 1]));
  const flowLastMarks = new Map<string, number>();
  const flowLastDrops = new Map<string, number>();
  const flowBackoffs = new Map<string, number>();
  const queueSamples: BuilderQueueSample[] = [];
"""
if needle not in text: raise SystemExit('maps needle missing')
text=text.replace(needle,replace,1)
needle="""      const packetsExact = flow.offeredRateMbps * 1_000_000 / 8 * (scenario.tickMs / 1000) / flow.packetBytes + (generatedRemainder.get(flow.id) ?? 0);
"""
replace="""      const rateFactor = flow.transport === 'udp' ? 1 : (flowRateFactor.get(flow.id) ?? 1);
      const packetsExact = flow.offeredRateMbps * rateFactor * 1_000_000 / 8 * (scenario.tickMs / 1000) / flow.packetBytes + (generatedRemainder.get(flow.id) ?? 0);
"""
if needle not in text: raise SystemExit('rate needle missing')
text=text.replace(needle,replace,1)
needle="""      if (queueSamples.length < MAX_QUEUE_SAMPLES) queueSamples.push({ atMs, linkId, occupancyPackets: after, capacityPackets: profile.queuePackets, utilization: Math.min(1, state.txBytes * 8 / (profile.bandwidthMbps * 1_000_000 * Math.max(scenario.tickMs, atMs + scenario.tickMs) / 1000)), ecnMarks: state.ecnMarks, tailDrops: state.tailDrops });
    }
  }

  const links:"""
replace="""      if (queueSamples.length < MAX_QUEUE_SAMPLES) queueSamples.push({ atMs, linkId, occupancyPackets: after, capacityPackets: profile.queuePackets, utilization: Math.min(1, state.txBytes * 8 / (profile.bandwidthMbps * 1_000_000 * Math.max(scenario.tickMs, atMs + scenario.tickMs) / 1000)), ecnMarks: state.ecnMarks, tailDrops: state.tailDrops });
    }

    for (const flow of scenario.flows) {
      if (flow.transport === 'udp') continue;
      const marks = flowMarks.get(flow.id) ?? 0;
      const drops = flowDrops.get(flow.id) ?? 0;
      const priorMarks = flowLastMarks.get(flow.id) ?? 0;
      const priorDrops = flowLastDrops.get(flow.id) ?? 0;
      const currentFactor = flowRateFactor.get(flow.id) ?? 1;
      if (marks > priorMarks || drops > priorDrops) {
        const nextFactor = Math.max(0.25, currentFactor * 0.5);
        flowRateFactor.set(flow.id, nextFactor);
        flowBackoffs.set(flow.id, (flowBackoffs.get(flow.id) ?? 0) + 1);
        events.push({ id: `backoff:${flow.id}:${atMs}`, atMs: atMs + scenario.tickMs, kind: 'TRANSPORT_BACKOFF', flowId: flow.id, linkId: flow.pathLinkIds[0], summary: `${flow.id} reduced sending pressure to ${(nextFactor * 100).toFixed(0)}% after ${marks - priorMarks} new CE marks and ${drops - priorDrops} new drops.` });
      } else if (currentFactor < 1) {
        const nextFactor = Math.min(1, currentFactor + 0.05);
        flowRateFactor.set(flow.id, nextFactor);
        if (nextFactor === 1) events.push({ id: `recover:${flow.id}:${atMs}`, atMs: atMs + scenario.tickMs, kind: 'TRANSPORT_RECOVERY', flowId: flow.id, linkId: flow.pathLinkIds[0], summary: `${flow.id} returned to its configured offered rate after clean queue feedback.` });
      }
      flowLastMarks.set(flow.id, marks);
      flowLastDrops.set(flow.id, drops);
    }
  }

  const links:"""
if needle not in text: raise SystemExit('feedback insertion needle missing')
text=text.replace(needle,replace,1)
needle="""    return { id: flow.id, transport: flow.transport, offeredRateMbps: flow.offeredRateMbps, deliveredRateMbps, deliveredPackets, droppedPackets, ecnMarks, averageQueueDelayMs: avgQueue, averageSerializationDelayMs: avgSerialization, estimatedRttMs: 2 * path.oneWayLatencyMs + avgQueue + avgSerialization, congestionWindowPackets: cwnd, congestionSignal: signal, recovery };
  });

  for (const flow of flows) if (flow.recovery === 'ECN BACKOFF' || flow.recovery === 'LOSS RECOVERY') events.push({ id: `backoff:${flow.id}`, atMs: scenario.durationMs, kind: 'TRANSPORT_BACKOFF', flowId: flow.id, linkId: scenario.flows.find((candidate) => candidate.id === flow.id)!.pathLinkIds[0], summary: `${flow.id} ${flow.recovery.toLowerCase()} from canonical queue feedback (${flow.ecnMarks} CE, ${flow.droppedPackets} drops).` });
"""
replace="""    return { id: flow.id, transport: flow.transport, offeredRateMbps: flow.offeredRateMbps, deliveredRateMbps, deliveredPackets, droppedPackets, ecnMarks, averageQueueDelayMs: avgQueue, averageSerializationDelayMs: avgSerialization, estimatedRttMs: 2 * path.oneWayLatencyMs + avgQueue + avgSerialization, congestionWindowPackets: cwnd, congestionSignal: signal, recovery, finalSendingRateMbps: flow.offeredRateMbps * (flow.transport === 'udp' ? 1 : (flowRateFactor.get(flow.id) ?? 1)), backoffEvents: flowBackoffs.get(flow.id) ?? 0 };
  });

"""
if needle not in text: raise SystemExit('observation needle missing')
text=text.replace(needle,replace,1)
p.write_text(text)
