import { readFileSync, writeFileSync } from 'node:fs';

function replaceOnce(path, before, after) {
  const text = readFileSync(path, 'utf8');
  if (!text.includes(before)) throw new Error(`Missing patch anchor in ${path}: ${before.slice(0, 80)}`);
  writeFileSync(path, text.replace(before, after));
}

function replaceRange(path, startMarker, endMarker, replacement) {
  const text = readFileSync(path, 'utf8');
  const start = text.indexOf(startMarker);
  const end = text.indexOf(endMarker, start);
  if (start < 0 || end < 0) throw new Error(`Missing range anchor in ${path}`);
  writeFileSync(path, text.slice(0, start) + replacement + text.slice(end));
}

replaceOnce(
  'src/builder/device-workbench.ts',
  `export interface BuilderWorkbenchEventProjection {\n  physical?: 'after';\n  control?: 'after';\n  rib?: 'after';\n  fib?: 'after';\n}`,
  `export interface BuilderWorkbenchEventProjection {\n  physical?: 'after';\n  control?: 'after';\n  rib?: 'after';\n  fib?: 'after';\n  dhcpLeases?: 'after';\n  dhcpSequence?: 'after';\n}`,
);

replaceOnce(
  'src/builder/canonical-events.ts',
  `import { builderBgpState } from './bgp.ts';\nimport { builderStpState } from './stp.ts';`,
  `import { builderBgpState } from './bgp.ts';\nimport { renewBuilderDhcpLease, runBuilderDhcpAcquire, type BuilderDhcpTransaction } from './dhcp.ts';\nimport { builderStpState } from './stp.ts';`,
);

replaceRange(
  'src/builder/canonical-events.ts',
  'function deriveDhcpEvents(',
  '\nfunction deriveIpv6Events(',
  `function replayDhcpTransaction(before: BuilderTimelineState, clientDeviceId: string, expectedLease: BuilderTimelineState['dhcpLeases'][number], renewal: boolean): BuilderDhcpTransaction | null {\n  try {\n    const transaction = renewal\n      ? renewBuilderDhcpLease(before.ethernet, before.dhcp, before.dhcpLeases, clientDeviceId, before.dhcpSequence)\n      : runBuilderDhcpAcquire(before.ethernet, before.dhcp, before.dhcpLeases, clientDeviceId, before.dhcpSequence);\n    if (!transaction.success || !transaction.lease || stable(transaction.lease) !== stable(expectedLease)) return null;\n    return transaction;\n  } catch {\n    return null;\n  }\n}\n\nfunction appendDhcpTransactionEvents(transaction: BuilderDhcpTransaction, state: BuilderTimelineState, output: BuilderWorkbenchEventSpec[], startOffset: number): number {\n  let previousKey: string | null = null;\n  for (let index = 0; index < transaction.events.length; index += 1) {\n    const event = transaction.events[index];\n    const key = 'dhcp:transaction:' + transaction.id + ':' + String(index).padStart(2, '0') + ':' + event.kind.toLowerCase();\n    const path = event.nodeIds.map((id) => labelForEthernet(state, id)).join(' → ');\n    const detail = event.detail + (path ? ' · PATH ' + path : '') + (event.relayed ? ' · RELAYED' : '');\n    const projection: BuilderWorkbenchEventProjection | undefined = event.kind === 'ACK' && transaction.success\n      ? { dhcpLeases: 'after', dhcpSequence: 'after' }\n      : undefined;\n    const objectIds = [transaction.id, ...event.linkIds, transaction.lease?.id ?? '', transaction.lease?.poolId ?? '', transaction.lease?.address ?? ''].filter((value) => value.length > 0);\n    output.push(spec(\n      key,\n      'control-plane',\n      'dhcp',\n      'DHCP · ' + event.kind + ' · VLAN ' + event.vlanId,\n      detail,\n      startOffset + index,\n      ethernetRefs(event.sourceDeviceId, event.destinationDeviceId, ...event.nodeIds),\n      objectIds,\n      previousKey,\n      projection,\n    ));\n    previousKey = key;\n  }\n  return startOffset + Math.max(1, transaction.events.length) + 1;\n}\n\nfunction deriveDhcpEvents(before: BuilderTimelineState, after: BuilderTimelineState, output: BuilderWorkbenchEventSpec[]): void {\n  const prior = mapById(before.dhcpLeases);\n  const next = mapById(after.dhcpLeases);\n  let offset = 140;\n  for (const [id, entry] of next) {\n    const old = prior.get(id);\n    if (!old || stable(old) !== stable(entry)) {\n      const transaction = replayDhcpTransaction(before, entry.clientDeviceId, entry, Boolean(old));\n      if (transaction) {\n        offset = appendDhcpTransactionEvents(transaction, after, output, offset);\n        continue;\n      }\n      output.push(spec(\n        'dhcp:' + id,\n        'control-plane',\n        'dhcp',\n        'DHCP LEASE · ' + entry.address,\n        labelForEthernet(after, entry.clientDeviceId) + ' holds ' + entry.address + ' from ' + labelForEthernet(after, entry.serverDeviceId) + ' · renew ' + entry.renewAtSequence + ' · rebind ' + entry.rebindAtSequence + ' · expire ' + entry.expiresAtSequence + '.',\n        offset++,\n        ethernetRefs(entry.clientDeviceId, entry.serverDeviceId),\n        [entry.id, entry.poolId, entry.address],\n        undefined,\n        { dhcpLeases: 'after', dhcpSequence: 'after' },\n      ));\n    }\n  }\n  for (const [id, entry] of prior) {\n    if (next.has(id)) continue;\n    output.push(spec(\n      'dhcp:removed:' + id,\n      'control-plane',\n      'dhcp',\n      'DHCP LEASE REMOVED · ' + entry.address,\n      labelForEthernet(before, entry.clientDeviceId) + ' no longer has lease ' + entry.id + '.',\n      offset++,\n      ethernetRefs(entry.clientDeviceId, entry.serverDeviceId),\n      [entry.id, entry.address],\n      undefined,\n      { dhcpLeases: 'after', dhcpSequence: 'after' },\n    ));\n  }\n}\n`,
);

replaceOnce(
  'src/builder/timeline.ts',
  `  const beforeGraph=cloneValue(priorState!.graph);\n  const afterGraph=finalState.graph;\n  let truthGraphs={controlGraph:beforeGraph,ribGraph:beforeGraph,fibGraph:beforeGraph};\n  let state:BuilderTimelineState={...finalState,graph:beforeGraph,truthGraphs};`,
  `  const beforeGraph=cloneValue(priorState!.graph);\n  const afterGraph=finalState.graph;\n  const stageDhcpLeases=uncaptured.some((event)=>event.projection?.dhcpLeases==='after');\n  const stageDhcpSequence=uncaptured.some((event)=>event.projection?.dhcpSequence==='after');\n  let truthGraphs={controlGraph:beforeGraph,ribGraph:beforeGraph,fibGraph:beforeGraph};\n  let state:BuilderTimelineState={\n    ...finalState,\n    graph:beforeGraph,\n    truthGraphs,\n    ...(stageDhcpLeases?{dhcpLeases:cloneValue(priorState!.dhcpLeases)}:{}),\n    ...(stageDhcpSequence?{dhcpSequence:priorState!.dhcpSequence}:{}),\n  };`,
);

replaceOnce(
  'src/builder/timeline.ts',
  `      if(projection.fib==='after')nextTruth.fibGraph=afterGraph;\n      truthGraphs=nextTruth;\n      state={...state,graph,truthGraphs};`,
  `      if(projection.fib==='after')nextTruth.fibGraph=afterGraph;\n      const dhcpLeases=projection.dhcpLeases==='after'?finalState.dhcpLeases:state.dhcpLeases;\n      const dhcpSequence=projection.dhcpSequence==='after'?finalState.dhcpSequence:state.dhcpSequence;\n      truthGraphs=nextTruth;\n      state={...state,graph,truthGraphs,dhcpLeases,dhcpSequence};`,
);

replaceOnce(
  'src/BuilderDhcpPanel.tsx',
  `  onSequenceChange: (next: number) => void;\n  onMessage: (message: string) => void;\n}`,
  `  onSequenceChange: (next: number) => void;\n  onMessage: (message: string) => void;\n  historical?: boolean;\n  historicalStage?: { summary: string; detail: string } | null;\n}`,
);

replaceOnce(
  'src/BuilderDhcpPanel.tsx',
  `export function BuilderDhcpPanel({ethernet,config,onConfigChange,leases,onLeasesChange,sequence,onSequenceChange,onMessage}:BuilderDhcpPanelProps){`,
  `export function BuilderDhcpPanel({ethernet,config,onConfigChange,leases,onLeasesChange,sequence,onSequenceChange,onMessage,historical=false,historicalStage=null}:BuilderDhcpPanelProps){`,
);

replaceOnce(
  'src/BuilderDhcpPanel.tsx',
  `{lastTransaction&&<div className={\`builder-dhcp-transaction \${lastTransaction.success?'success':'failed'}\`}>`,
  `{historical&&historicalStage&&<div className="builder-dhcp-transaction"><span>HISTORICAL DHCP STAGE</span><strong>{historicalStage.summary}</strong><small>{historicalStage.detail}</small></div>}{!historical&&lastTransaction&&<div className={\`builder-dhcp-transaction \${lastTransaction.success?'success':'failed'}\`}>`,
);

replaceOnce(
  'src/NetworkBuilder.tsx',
  `<BuilderDhcpPanel ethernet={ethernet} config={dhcp} onConfigChange={setDhcp} leases={dhcpLeases} onLeasesChange={setDhcpLeases} sequence={dhcpSequence} onSequenceChange={setDhcpSequence} onMessage={setMessage}/>`,
  `<BuilderDhcpPanel ethernet={ethernet} config={dhcp} onConfigChange={setDhcp} leases={dhcpLeases} onLeasesChange={setDhcpLeases} sequence={dhcpSequence} onSequenceChange={setDhcpSequence} onMessage={setMessage} historical={isHistorical} historicalStage={historicalTimelineSnapshot?.category==='dhcp'?{summary:historicalTimelineSnapshot.summary,detail:historicalTimelineSnapshot.detail}:null}/>`
);

replaceOnce(
  'scripts/builder-canonical-events-contract-check.mjs',
  `import { createDefaultBuilderDhcpConfig } from '../src/builder/dhcp.ts';`,
  `import { createDefaultBuilderDhcpConfig, runBuilderDhcpAcquire, setBuilderDhcpClient } from '../src/builder/dhcp.ts';`,
);

replaceOnce(
  'scripts/builder-canonical-events-contract-check.mjs',
  `const probe=runBuilderProbe(graph,addressing,routing,'ping','client','app',1,base.linkProfiles,base.acl,base.nat,[]);`,
  `const dhcpConfig=setBuilderDhcpClient(ethernet,createDefaultBuilderDhcpConfig(ethernet),'lan-a',true);\nconst dhcpBefore={...base,dhcp:dhcpConfig,dhcpLeases:[],dhcpSequence:1};\nconst dhcpTransaction=runBuilderDhcpAcquire(ethernet,dhcpConfig,[], 'lan-a', 1);\nassert.equal(dhcpTransaction.success,true,'DORA contract requires a successful deterministic acquisition');\nassert.ok(dhcpTransaction.lease);\nconst dhcpAfter={...dhcpBefore,dhcpLeases:dhcpTransaction.leases,dhcpSequence:2};\nlet dhcpJournal=createBuilderWorkbenchEventJournal();\nlet dhcpTimeline=createBuilderTimeline();\ndhcpTimeline=captureBuilderTimelineSnapshot(dhcpTimeline,dhcpJournal,{...dhcpBefore,events:dhcpJournal});\ndhcpJournal=appendBuilderWorkbenchMessageEvent(dhcpJournal,'DHCP ACK · '+dhcpTransaction.summary,[{plane:'ethernet',id:'lan-a'},{plane:'ethernet',id:dhcpTransaction.lease.serverDeviceId}]);\nconst dhcpAction=dhcpJournal.at(-1);\nconst dhcpSpecs=deriveBuilderCanonicalEventSpecs(dhcpBefore,dhcpAfter,dhcpAction);\nconst dora=dhcpSpecs.filter((entry)=>entry.category==='dhcp'&&entry.summary.startsWith('DHCP · '));\nassert.deepEqual(dora.map((entry)=>entry.summary.split(' · ')[1]),['DISCOVER','OFFER','REQUEST','ACK'],'DHCP acquisition must expose canonical DORA stage order');\nassert.ok(dora.every((entry)=>entry.kind==='control-plane'),'DORA stages are DHCP control-plane transitions');\nassert.equal(dora.at(-1).projection?.dhcpLeases,'after','ACK must be the lease-install boundary');\nassert.equal(dora.at(-1).projection?.dhcpSequence,'after','ACK must advance the deterministic DHCP sequence state');\ndhcpJournal=appendBuilderWorkbenchEventBatch(dhcpJournal,dhcpSpecs);\ndhcpTimeline=captureBuilderTimelineSnapshot(dhcpTimeline,dhcpJournal,{...dhcpAfter,events:dhcpJournal});\nconst doraSnapshots=Object.fromEntries(['DISCOVER','OFFER','REQUEST','ACK'].map((kind)=>[kind,dhcpTimeline.snapshots.find((snapshot)=>snapshot.summary.startsWith('DHCP · '+kind+' ·'))]));\nassert.ok(doraSnapshots.DISCOVER&&doraSnapshots.OFFER&&doraSnapshots.REQUEST&&doraSnapshots.ACK);\nassert.equal(doraSnapshots.DISCOVER.state.dhcpLeases.length,0,'DISCOVER must not install a lease');\nassert.equal(doraSnapshots.OFFER.state.dhcpLeases.length,0,'OFFER must not install a lease');\nassert.equal(doraSnapshots.REQUEST.state.dhcpLeases.length,0,'REQUEST must not install a lease');\nassert.equal(doraSnapshots.DISCOVER.state.dhcpSequence,1,'DORA pre-ACK stages stay on the transaction sequence');\nassert.equal(doraSnapshots.REQUEST.state.dhcpSequence,1,'REQUEST still precedes lease commit');\nassert.equal(doraSnapshots.ACK.state.dhcpLeases[0]?.address,dhcpTransaction.lease.address,'ACK installs the canonical lease');\nassert.equal(doraSnapshots.ACK.state.dhcpSequence,2,'ACK advances the Builder DHCP sequence to the committed state');\nassert.equal(doraSnapshots.DISCOVER.state,doraSnapshots.OFFER.state,'DORA stages without state mutation structurally share the same historical state');\nassert.equal(doraSnapshots.OFFER.state,doraSnapshots.REQUEST.state,'REQUEST must not allocate a duplicate scene state before ACK');\nassert.notEqual(doraSnapshots.REQUEST.state,doraSnapshots.ACK.state,'ACK creates the state boundary where the lease becomes visible');\nconst dhcpAckEvent=dhcpJournal.find((event)=>event.summary.startsWith('DHCP · ACK ·'));\nassert.ok(dhcpAckEvent);\nconst dhcpChain=builderWorkbenchEventCausalChain(dhcpJournal,dhcpAckEvent.id,10);\nassert.equal(dhcpChain[0].id,dhcpAction.id,'ACK causal chain must lead back to the user-visible DHCP action');\nassert.ok(dhcpChain.some((event)=>event.summary.startsWith('DHCP · DISCOVER ·')),'ACK causal chain must retain DISCOVER provenance');\n\nconst dhcpPanelSource=readFileSync(new URL('../src/BuilderDhcpPanel.tsx',import.meta.url),'utf8');\nassert.match(dhcpPanelSource,/HISTORICAL DHCP STAGE/,'DHCP panel must render the selected historical stage instead of leaking live transaction UI');\n\nconst probe=runBuilderProbe(graph,addressing,routing,'ping','client','app',1,base.linkProfiles,base.acl,base.nat,[]);`,
);

replaceOnce(
  'scripts/builder-canonical-events-contract-check.mjs',
  `console.log('Builder canonical-event contract passed: canonical model events preserve timing and causality while timed OSPF history independently projects physical, control-plane, RIB, and FIB truth with bounded structural sharing.');`,
  `console.log('Builder canonical-event contract passed: timed OSPF truth dimensions and protocol-native DHCP DORA stages preserve canonical order, causality, intermediate state, and bounded structural sharing.');`,
);

replaceOnce(
  'docs/TRACKA.md',
  `The existing deterministic Builder event journal remains the event identity source. Each canonical event receives a logical timestamp derived only from its monotonic event sequence (\`1 event = 1000 ms\` on the teaching clock). This is explicitly **not wall-clock time**.`,
  `The existing deterministic Builder event journal remains the event identity source. Root Builder actions advance a deterministic logical clock; derived model events may carry finer logical offsets or, when a protocol model owns real teaching timers such as OSPF convergence, exact model timestamps. This is explicitly **not wall-clock time** and must not be interpreted as measured network latency.`,
);

replaceOnce(
  'docs/TRACKA.md',
  `This is still the event-granularity foundation, not the claim that every protocol database is fully time-native yet. DHCP transaction stages, full protocol-database row diffs/counters, and equivalent per-stage historical projection for non-OSPF protocols remain follow-on Track A depth.`,
  `DHCP is now the second protocol family with native intermediate history. A successful acquisition replays the existing deterministic DHCP model from the pre-action snapshot and emits DISCOVER → OFFER → REQUEST → ACK as separate causal events, including the canonical local/relay path. DISCOVER/OFFER/REQUEST share the pre-lease state; ACK alone advances the lease table and deterministic DHCP sequence, so the DHCP panel and Device Workbench do not show an address before the ACK boundary. Renewal/rebinding uses the same replay path when a deterministic changed lease matches the existing model.\n\nThis is still the event-granularity foundation, not the claim that every protocol database is fully time-native yet. Full protocol-database row diffs/counters, DHCP failure/expiry episode depth, and equivalent per-stage historical projection for the remaining non-OSPF protocols remain follow-on Track A depth.`,
);

replaceOnce(
  'docs/ROADMAP.md',
  `  - [ ] finish protocol-native stage coverage for DHCP transactions, complete protocol databases/counters, and extend per-stage historical scene projection beyond timed OSPF`,
  `  - [x] protocol-native DHCP acquisition history exposes DISCOVER → OFFER → REQUEST → ACK as separate causal events; ACK is the lease/effective-address state boundary, with deterministic renewal/rebinding replay when applicable\n  - [ ] complete protocol databases/counters, DHCP failure/expiry episode depth, and extend per-stage historical scene projection to the remaining protocols`,
);

console.log('Track A DHCP time-native transaction patch applied.');
