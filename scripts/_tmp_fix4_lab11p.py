from pathlib import Path
import json

p=Path('src/NetworkBuilder.tsx')
s=p.read_text()
old="""  const workbenchOptions = useMemo(() => builderWorkbenchDeviceOptions(graph, ethernet), [graph, ethernet]);
  const effectiveWorkbenchDevice = workbenchOptions.some((option) => option.plane === workbenchDevice.plane && option.id === workbenchDevice.id)
    ? workbenchDevice
    : ({ plane: workbenchOptions[0]?.plane ?? 'routed', id: workbenchOptions[0]?.id ?? selectedNodeId } as BuilderDeviceRef);
  const workbenchSnapshot = useMemo(() => buildBuilderDeviceWorkbench({ graph, addressing, routing, ipv6, ipv6ControlState, ipv6RoutingDepth, ethernet, ethernetFlow, arpCache, arpResolutions, acl, nat, natSessions, dhcp, dhcpLeases, dhcpSequence, probeHistory, sourceId, destinationId, events: workbenchEvents }, effectiveWorkbenchDevice), [graph, addressing, routing, ipv6, ipv6ControlState, ipv6RoutingDepth, ethernet, ethernetFlow, arpCache, arpResolutions, acl, nat, natSessions, dhcp, dhcpLeases, dhcpSequence, probeHistory, sourceId, destinationId, workbenchEvents, effectiveWorkbenchDevice.plane, effectiveWorkbenchDevice.id]);
"""
new="""  const workbenchOptions = useMemo(() => stressLabel ? [] : builderWorkbenchDeviceOptions(graph, ethernet), [graph, ethernet, stressLabel]);
  const effectiveWorkbenchDevice = workbenchOptions.some((option) => option.plane === workbenchDevice.plane && option.id === workbenchDevice.id)
    ? workbenchDevice
    : ({ plane: workbenchOptions[0]?.plane ?? 'routed', id: workbenchOptions[0]?.id ?? selectedNodeId } as BuilderDeviceRef);
  const workbenchSnapshot = useMemo(() => stressLabel ? null : buildBuilderDeviceWorkbench({ graph, addressing, routing, ipv6, ipv6ControlState, ipv6RoutingDepth, ethernet, ethernetFlow, arpCache, arpResolutions, acl, nat, natSessions, dhcp, dhcpLeases, dhcpSequence, probeHistory, sourceId, destinationId, events: workbenchEvents }, effectiveWorkbenchDevice), [stressLabel, graph, addressing, routing, ipv6, ipv6ControlState, ipv6RoutingDepth, ethernet, ethernetFlow, arpCache, arpResolutions, acl, nat, natSessions, dhcp, dhcpLeases, dhcpSequence, probeHistory, sourceId, destinationId, workbenchEvents, effectiveWorkbenchDevice.plane, effectiveWorkbenchDevice.id]);
"""
if s.count(old)!=1: raise SystemExit(f'workbench stress derivation anchor expected once, found {s.count(old)}')
s=s.replace(old,new,1)
old="{!stressLabel&&<BuilderDeviceWorkbench snapshot={workbenchSnapshot} options={workbenchOptions} onSelect={(ref)=>{setWorkbenchDevice(ref);if(ref.plane==='routed')setSelectedNodeId(ref.id);}}/>}"
new="{!stressLabel&&workbenchSnapshot&&<BuilderDeviceWorkbench snapshot={workbenchSnapshot} options={workbenchOptions} onSelect={(ref)=>{setWorkbenchDevice(ref);if(ref.plane==='routed')setSelectedNodeId(ref.id);}}/>}"
if s.count(old)!=1: raise SystemExit(f'workbench render anchor expected once, found {s.count(old)}')
s=s.replace(old,new,1)
p.write_text(s)

p=Path('config/performance-budget.json')
data=json.loads(p.read_text())
# Lab 11P adds a bounded device projection/model and its inspection UI. Keep the increase close to measured production output.
if data['budgets']['maxJsGzipBytes'] != 410000: raise SystemExit('unexpected JS budget baseline')
if data['budgets']['maxCssGzipBytes'] != 33500: raise SystemExit('unexpected CSS budget baseline')
data['budgets']['maxJsGzipBytes']=424000
data['budgets']['maxCssGzipBytes']=34500
p.write_text(json.dumps(data,indent=2)+'\n')

p=Path('docs/LAB11P.md')
s=p.read_text()
addition="""
## Performance boundary

The workbench is deliberately not instantiated or derived inside the synthetic stress Builder. The normal product bundle grows because Lab 11P adds the structured projection model, causal explanations, event journal, and inspection UI; the enforced production ceilings move narrowly from 410,000 to 424,000 JS gzip bytes and from 33,500 to 34,500 CSS gzip bytes. DOM and heap ceilings are not relaxed for the feature.
"""
if '## Performance boundary' in s: raise SystemExit('performance note already present')
p.write_text(s.rstrip()+"\n"+addition)
print('Skipped device-workbench derivation in stress mode and bounded JS/CSS budgets to measured Lab 11P product growth.')
