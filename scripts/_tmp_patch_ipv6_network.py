from pathlib import Path
p=Path('src/NetworkBuilder.tsx')
s=p.read_text(encoding='utf-8')
def rep(a,b):
 global s
 n=s.count(a)
 if n!=1: raise SystemExit(f'expected 1 match, found {n}: {a[:100]!r}')
 s=s.replace(a,b,1)
rep("import { runBuilderIpv6Probe } from './builder/ipv6-probes.ts';","import { runBuilderIpv6Probe } from './builder/ipv6-probes.ts';\nimport { createBuilderIpv6ControlState, type BuilderIpv6ControlState } from './builder/ipv6-control-plane.ts';")
rep("  const [probeFamily, setProbeFamily] = useState<'ipv4'|'ipv6'>('ipv4');","  const [probeFamily, setProbeFamily] = useState<'ipv4'|'ipv6'>('ipv4');\n  const [ipv6ControlState, setIpv6ControlState] = useState<BuilderIpv6ControlState>(() => createBuilderIpv6ControlState());\n  const [ipv6ProbePacketBytes, setIpv6ProbePacketBytes] = useState(1280);")
old="""  const runProbe = (kind: 'ping' | 'traceroute') => {
    const result = probeFamily === 'ipv6' ? runBuilderIpv6Probe(graph, ipv6, kind, sourceId, destinationId, probeHistory.length + 1, linkProfiles, natSessions) : runBuilderProbe(graph, addressing, routing, kind, sourceId, destinationId, probeHistory.length + 1, linkProfiles, acl, nat, natSessions);
    setNatSessions(result.natSessions);
    setProbeHistory((current) => [result, ...current].slice(0, 10));
    setSelectedProbeId(result.id);
    setSelectedProbeAttempt(result.attempts.length > 0 ? result.attempts.length - 1 : 0);
    setMessage(`${kind.toUpperCase()} · ${result.summary}`);
  };
"""
new="""  const runProbe = (kind: 'ping' | 'traceroute') => {
    const result = probeFamily === 'ipv6'
      ? runBuilderIpv6Probe(graph, ipv6, kind, sourceId, destinationId, probeHistory.length + 1, linkProfiles, natSessions, ipv6ControlState, ipv6ProbePacketBytes)
      : runBuilderProbe(graph, addressing, routing, kind, sourceId, destinationId, probeHistory.length + 1, linkProfiles, acl, nat, natSessions);
    if (probeFamily === 'ipv6' && 'ipv6ControlState' in result) setIpv6ControlState(result.ipv6ControlState);
    setNatSessions(result.natSessions);
    setProbeHistory((current) => [result, ...current].slice(0, 10));
    setSelectedProbeId(result.id);
    setSelectedProbeAttempt(result.attempts.length > 0 ? result.attempts.length - 1 : 0);
    setMessage(`${kind.toUpperCase()} · ${result.summary}`);
  };
"""
rep(old,new)
rep("    setNatSessions(clearBuilderNatSessions());\n    const nextSource = chooseValidNode(next, sourceId);","    setNatSessions(clearBuilderNatSessions());\n    setIpv6ControlState(createBuilderIpv6ControlState());\n    const nextSource = chooseValidNode(next, sourceId);")
rep("setNatSessions(clearBuilderNatSessions()); setArpCache(clearBuilderArpCache()); setArpResolutions([]);","setNatSessions(clearBuilderNatSessions()); setIpv6ControlState(createBuilderIpv6ControlState()); setArpCache(clearBuilderArpCache()); setArpResolutions([]);")
rep("setNatSessions(clearBuilderNatSessions()); setArpCache(clearBuilderArpCache()); setArpResolutions([]); setEthernetFlow(null);","setNatSessions(clearBuilderNatSessions()); setIpv6ControlState(createBuilderIpv6ControlState()); setArpCache(clearBuilderArpCache()); setArpResolutions([]); setEthernetFlow(null);")
rep("IPV6 USES AN INDEPENDENT IPV6 FIB · HOP LIMIT EXPIRES AT ROUTERS · EACH ICMPV6 RESPONSE NEEDS A REVERSE IPV6 ROUTE · ND / PTB / IPV6 POLICY ARE DEFERRED.","IPV6 USES AN INDEPENDENT FIB · ND RESOLVES EACH NEXT HOP · ROUTERS RETURN PACKET TOO BIG INSTEAD OF FRAGMENTING · PMTU CACHE CAN REDUCE THE NEXT PROBE · OSPFV3 CONTRIBUTES O6 ROUTES ONLY WHEN ENABLED.")
rep("{!stressLabel&&<BuilderIpv6Panel graph={graph} ipv4={addressing} ipv6={ipv6} selectedNodeId={selectedNodeId} selectedLinkId={selectedLinkId} sourceId={sourceId} destinationId={destinationId} onChange={setIpv6} onMessage={setMessage}/>}","{!stressLabel&&<BuilderIpv6Panel graph={graph} ipv4={addressing} ipv6={ipv6} selectedNodeId={selectedNodeId} selectedLinkId={selectedLinkId} sourceId={sourceId} destinationId={destinationId} controlState={ipv6ControlState} onControlStateChange={setIpv6ControlState} probePacketBytes={ipv6ProbePacketBytes} onProbePacketBytesChange={setIpv6ProbePacketBytes} onChange={setIpv6} onMessage={setMessage}/>}")
p.write_text(s,encoding='utf-8')
print('NetworkBuilder wired to IPv6 control-plane session state.')