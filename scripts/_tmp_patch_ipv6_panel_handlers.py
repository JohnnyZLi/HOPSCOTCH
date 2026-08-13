from pathlib import Path
p=Path('src/BuilderIpv6Panel.tsx')
s=p.read_text(encoding='utf-8')
anchor='  return <section className="builder-ipv6-section">'
if s.count(anchor)!=1: raise SystemExit('return anchor not unique')
handlers=r'''  const runSlaac = () => {
    if (!selectedNode || selectedNode.kind !== 'endpoint') { onMessage('Select an endpoint before sending Router Solicitation.'); return; }
    try {
      const result = runBuilderIpv6RouterSolicitation(graph, ipv4, ipv6, selectedNode.id, controlState);
      onChange(result.config); onControlStateChange(result.state);
      onMessage(result.event.success ? `RA / SLAAC · ${result.event.detail}` : `RA MISSED · ${result.event.detail}`);
    } catch (error) { onMessage(`SLAAC REJECTED · ${error instanceof Error ? error.message : 'Unable to apply SLAAC.'}`); }
  };
  const toggleRa = () => {
    if (!selectedNode || selectedNode.kind !== 'router') return;
    try {
      onChange(setBuilderIpv6RaRouterEnabled(graph, ipv4, ipv6, selectedNode.id, !selectedRaEnabled));
      onMessage(`ROUTER ADVERTISEMENT · ${selectedNode.label} ${selectedRaEnabled ? 'stopped' : 'started'} advertising connected /64 prefixes.`);
    } catch (error) { onMessage(`RA CONFIG REJECTED · ${error instanceof Error ? error.message : 'Unable to change RA state.'}`); }
  };
  const toggleOspfv3 = () => {
    if (!selectedNode || selectedNode.kind !== 'router') return;
    try {
      onChange(setBuilderOspfv3RouterEnabled(graph, ipv4, ipv6, selectedNode.id, !selectedOspfv3Enabled));
      onMessage(`OSPFV3 · ${selectedNode.label} ${selectedOspfv3Enabled ? 'left' : 'joined'} AREA 0. IPv4 OSPF is unchanged.`);
    } catch (error) { onMessage(`OSPFV3 REJECTED · ${error instanceof Error ? error.message : 'Unable to change OSPFv3 state.'}`); }
  };

'''
s=s.replace(anchor,handlers+anchor,1)
p.write_text(s,encoding='utf-8')
print('IPv6 panel handlers patched.')