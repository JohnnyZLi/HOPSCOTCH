from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file_path = Path(path)
    text = file_path.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one anchor, found {count}: {old[:80]!r}")
    file_path.write_text(text.replace(old, new, 1))


network = Path('src/NetworkBuilder.tsx')
text = network.read_text()
import_anchor = "import { appendBuilderChallengeEvidence, builderChallengeIsRepaired, builderChallengeRepairStage, createBuilderChallenge, scoreBuilderChallenge, seedFromBuilderChallengeToken, type BuilderChallenge, type BuilderChallengeEvidence, type BuilderChallengeHypothesis } from './builder/challenges.ts';\n"
if "resolveBuilderCliProbeDestination" not in text:
    if text.count(import_anchor) != 1:
        raise SystemExit('NetworkBuilder CLI import anchor mismatch')
    text = text.replace(import_anchor, import_anchor + "import { resolveBuilderCliProbeDestination, type BuilderCliProbeCommand } from './builder/cli.ts';\n", 1)

start_marker = "  const runProbe = (kind: 'ping' | 'traceroute') => {\n"
end_marker = "  const commitGraph = (next: BuilderGraph) => {\n"
start = text.find(start_marker)
end = text.find(end_marker)
if start < 0 or end < 0 or end <= start:
    raise SystemExit('NetworkBuilder probe function markers not found')

replacement = """  const executeProbe = (kind: 'ping' | 'traceroute', family: 'ipv4'|'ipv6' = probeFamily, probeSourceId = sourceId, probeDestinationId = destinationId): BuilderProbeResult => {
    const result: BuilderProbeResult = family === 'ipv6'
      ? runBuilderIpv6Probe(graph, materializeBuilderIpv6RuntimeConfig(ipv6, ipv6LifecycleState), kind, probeSourceId, probeDestinationId, probeHistory.length + 1, linkProfiles, natSessions, ipv6ControlState, ipv6ProbePacketBytes, reconcileBuilderIpv6RoutingDepthState(graph, ipv6RoutingDepth))
      : runBuilderProbe(graph, addressing, routing, kind, probeSourceId, probeDestinationId, probeHistory.length + 1, linkProfiles, acl, nat, natSessions);
    if (family === 'ipv6') { const ipv6Result = result as ReturnType<typeof runBuilderIpv6Probe>; setIpv6ControlState(ipv6Result.ipv6ControlState); setIpv6LifecycleState((current) => reconcileBuilderIpv6LifecycleWithControl(ipv6Result.ipv6ControlState, current)); }
    setNatSessions(result.natSessions);
    setProbeHistory((current) => [result, ...current].slice(0, 10));
    setSelectedProbeId(result.id);
    setSelectedProbeAttempt(result.attempts.length > 0 ? result.attempts.length - 1 : 0);
    if (challenge && family === 'ipv4' && !isHistorical) {
      const repaired = builderChallengeIsRepaired(challenge, addressing, ethernet, routing, acl, nat, dhcp, linkProfiles, services);
      const repairStage=builderChallengeRepairStage(challenge,addressing,ethernet,routing,acl,nat,dhcp,linkProfiles,services);
      setChallengeEvidence((current) => appendBuilderChallengeEvidence(current, { kind, sourceId:probeSourceId, destinationId:probeDestinationId, success: result.success, repaired, repairStage, detail: result.summary }));
    } else if (challenge && family === 'ipv6' && challenge.verification.kind === 'ipv6-pmtu' && !isHistorical) {
      const ipv6Result = result as ReturnType<typeof runBuilderIpv6Probe>;
      const repaired = builderChallengeIsRepaired(challenge, addressing, ethernet, routing, acl, nat, dhcp, linkProfiles, services);
      const ndAdded = Math.max(0, ipv6Result.ipv6ControlState.ndHistory.length - ipv6ControlState.ndHistory.length);
      const pmtuAdded = ipv6Result.ipv6ControlState.pmtuHistory.length > ipv6ControlState.pmtuHistory.length ? ipv6Result.ipv6ControlState.pmtuHistory.at(-1) ?? null : null;
      const pathMtuBytes = pmtuAdded?.delivered === true ? pmtuAdded.mtuBytes : null;
      setChallengeEvidence((current) => {
        let next = appendBuilderChallengeEvidence(current, { kind, sourceId:probeSourceId, destinationId:probeDestinationId, success: ipv6Result.success, requestedBytes: ipv6Result.requestedPacketBytes, effectiveBytes: ipv6Result.effectivePacketBytes, pathMtuBytes, repaired, detail: ipv6Result.summary });
        if (ndAdded > 0) next = appendBuilderChallengeEvidence(next, { kind:'ipv6-nd', sourceId:probeSourceId, destinationId:probeDestinationId, success:true, ndResolutionCount:ndAdded, repaired, detail:'Neighbor Discovery completed ' + ndAdded + ' next-hop NS/NA observation' + (ndAdded===1?'':'s') + '; L2 neighbor resolution is not the failing boundary.' });
        return next;
      });
    }
    setMessage(`${kind.toUpperCase()} · ${result.summary}`);
    return result;
  };
  const runProbe = (kind: 'ping' | 'traceroute') => { executeProbe(kind); };
  const runCliProbe = (command: BuilderCliProbeCommand): BuilderProbeResult => {
    const resolved = resolveBuilderCliProbeDestination({ graph, addressing }, command.destination);
    return executeProbe(command.verb, 'ipv4', sourceId, resolved.nodeId);
  };

"""
text = text[:start] + replacement + text[end:]

old_terminal = """        {!stressLabel&&cliOpen&&<Suspense fallback={null}><BuilderCliTerminal input={displayedWorkbenchInput} contextLabel={isHistorical?`HISTORY #${String(historicalTimelineSnapshot?.sequence??0).padStart(3,'0')}`:'LIVE'} onClose={()=>setCliOpen(false)}/></Suspense>}
"""
new_terminal = """        {!stressLabel&&cliOpen&&<Suspense fallback={null}><BuilderCliTerminal input={displayedWorkbenchInput} contextLabel={isHistorical?`HISTORY #${String(historicalTimelineSnapshot?.sequence??0).padStart(3,'0')}`:'LIVE'} defaultProbeTarget={destinationId} onProbe={isHistorical?undefined:runCliProbe} probeUnavailableReason={isHistorical?'Active ping and traceroute commands are disabled in Time Machine. Return to LIVE before generating new probe state.':undefined} onClose={()=>setCliOpen(false)}/></Suspense>}
"""
if text.count(old_terminal) != 1:
    raise SystemExit(f'NetworkBuilder terminal anchor mismatch: {text.count(old_terminal)}')
text = text.replace(old_terminal, new_terminal, 1)
network.write_text(text)

replace_once(
    'docs/ROADMAP.md',
    "Track K is now the highest-value regular product track. Its read-only command model already exists; the next slice should expose the actual Builder terminal surface before expanding protocol commands.",
    "Track K is now the highest-value regular product track. The Builder terminal and active Ping/Traceroute delegation are shipped; the next slice should deepen protocol/policy inspection without creating CLI-specific control-plane truth.",
)
replace_once(
    'docs/ROADMAP.md',
    "- [x] canonical live/historical state adapter for routed interfaces, RIB routes, session ARP, and learned FDB facts\n\n`docs/TRACKK.md` records the Track K architecture and first interactive slice.\n\n**Remaining**\n\n- [ ] `show ospf neighbors`, `show bgp`, `show acl`, `show nat`, `ping`, and `traceroute`",
    "- [x] canonical live/historical state adapter for routed interfaces, RIB routes, session ARP, and learned FDB facts\n- [x] vendor-neutral `ping <destination>` and `traceroute <destination>` delegate to the existing LIVE IPv4 Builder probe engine, including NAT/session/challenge/event behavior; Time Machine fails closed for active probes\n\n`docs/TRACKK.md` records the Track K architecture and interactive slices.\n\n**Remaining**\n\n- [ ] `show ospf neighbors`, `show bgp`, `show acl`, and `show nat`",
)

print('Applied Track K CLI Ping/Traceroute integration.')
