from pathlib import Path
import re

p = Path('src/NetworkBuilder.tsx')
s = p.read_text()

pattern = re.compile(r"\n\n  const applyAuthoringSnapshot = \(next:BuilderAuthoringSnapshot,nextMessage:string\) => \{.*?\n  \};\n  const commitAuthoringGraph=", re.S)
replacement = '''

  const restoreCanonicalBuilderConfig = (next:BuilderAuthoringSnapshot) => {
    setGraph(cloneBuilderGraph(next.graph)); setAddressing(cloneBuilderAddressing(next.addressing)); setRouting(cloneBuilderRoutingConfig(next.routing)); setIpv6(cloneBuilderIpv6Config(next.ipv6)); setEthernet(cloneBuilderEthernetConfig(next.ethernet)); setLinkProfiles(cloneBuilderLinkProfiles(next.linkProfiles)); setAcl(cloneBuilderAclConfig(next.acl)); setNat(cloneBuilderNatConfig(next.nat)); setDhcp(cloneBuilderDhcpConfig(next.dhcp));
    setDhcpLeases(clearBuilderDhcpLeases()); setDhcpSequence(1); setNatSessions(clearBuilderNatSessions()); setIpv6ControlState(createBuilderIpv6ControlState()); setIpv6LifecycleState(createBuilderIpv6LifecycleState()); setIpv6RoutingDepth(createDefaultBuilderIpv6RoutingDepthState(next.graph)); setArpCache(clearBuilderArpCache()); setArpResolutions([]); setEthernetFlow(null);
    const endpoints=next.ethernet.devices.filter((device)=>device.kind==='endpoint'); setEthernetSourceId(endpoints[0]?.id??''); setEthernetDestinationId(endpoints[1]?.id??endpoints[0]?.id??''); setSelectedEthernetLinkId(next.ethernet.links[0]?.id??'');
    setLayout(cloneBuilderLayout(next.layout)); setSourceId(next.sourceId); setDestinationId(next.destinationId);
  };
  const applyAuthoringSnapshot = (next:BuilderAuthoringSnapshot,nextMessage:string) => {
    restoreCanonicalBuilderConfig(next);
    setSelectedNodeId(next.graph.nodes.some((node)=>node.id===selectedNodeId)?selectedNodeId:next.sourceId); setSelectedLinkId(next.graph.links.some((link)=>link.id===selectedLinkId)?selectedLinkId:(next.graph.links[0]?.id??'')); setProbeHistory([]); setApplicationHistory([]);
    setAuthoringView((current)=>({...current,selection:current.selection.filter((id)=>next.graph.nodes.some((node)=>node.id===id)),ethernetLinkSelection:current.ethernetLinkSelection.filter((id)=>next.ethernet.links.some((link)=>link.id===id))})); setMessage(nextMessage);
  };
  const commitAuthoringGraph='''
s, count = pattern.subn(replacement, s, count=1)
if count != 1:
    raise SystemExit('applyAuthoringSnapshot block not found exactly once')

pattern = re.compile(r"  const restoreScenario = \(scenario: BuilderScenarioV8\) => \{.*?\n  \};\n\n  const exportScenario", re.S)
replacement = '''  const restoreScenario = (scenario: BuilderScenarioV8) => {
    restoreCanonicalBuilderConfig(scenario);
    setSelectedNodeId(scenario.sourceId); setSelectedLinkId(scenario.graph.links[0]?.id ?? ''); setScenarioName(scenario.name);
    setMessage(`Restored “${scenario.name}”. IPv4/IPv6 routing, link characteristics, ACL/NAT, VLAN, and STP configuration restored; session ARP/NAT/probe state cleared.`);
  };

  const exportScenario'''
s, count = pattern.subn(replacement, s, count=1)
if count != 1:
    raise SystemExit('restoreScenario block not found exactly once')

p.write_text(s)

p = Path('scripts/builder-authoring-contract-check.mjs')
s = p.read_text()
needle = "assert.match(networkBuilderSource, /lazy\\(\\(\\) => import\\('\\.\\/BuilderAuthoringPanel\\.tsx'\\)/, 'the entire Track B authoring shell must remain outside the initial NetworkBuilder chunk');\n"
replacement = needle + "assert.match(networkBuilderSource, /restoreCanonicalBuilderConfig\\(scenario\\)/, 'scenario restore and Track B undo/branch restore must share one canonical configuration-application boundary');\n"
if needle not in s:
    raise SystemExit('lazy boundary contract marker missing')
s = s.replace(needle, replacement, 1)
p.write_text(s)
