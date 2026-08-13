from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
def read(path): return (ROOT/path).read_text(encoding='utf-8')
def write(path,text): (ROOT/path).write_text(text,encoding='utf-8')
def replace_once(path,old,new):
    text=read(path); count=text.count(old)
    if count!=1: raise SystemExit(f'{path}: expected one match, found {count}: {old[:140]!r}')
    write(path,text.replace(old,new,1))

network='src/NetworkBuilder.tsx'
replace_once(network,"import { cloneBuilderIpv6Config, createDefaultBuilderIpv6Config, reconcileBuilderIpv6Config, traceBuilderIpv6Forwarding, type BuilderIpv6Config } from './builder/ipv6.ts';", "import { cloneBuilderIpv6Config, createDefaultBuilderIpv6Config, reconcileBuilderIpv6Config, type BuilderIpv6Config } from './builder/ipv6.ts';")
replace_once(network,"  const ipv6ForwardingTrace = useMemo(() => traceBuilderIpv6Forwarding(graph, ipv6, sourceId, destinationId), [graph, ipv6, sourceId, destinationId]);\n", "")
replace_once(network,"  const ipv6ForwardingLinks = new Set(ipv6ForwardingTrace.hops.flatMap((hop) => hop.linkId ? [hop.linkId] : []));\n", "")
replace_once(network,'<div className="builder-route-table">{selectedRouteTable.length===0?', '<div className="builder-route-table builder-ipv4-route-table">{selectedRouteTable.length===0?')

perf='scripts/performance-profile.mjs'
replace_once(perf,"routeTable:document.querySelector('.builder-route-table')?.innerText??'',","routeTable:document.querySelector('.builder-ipv4-route-table')?.innerText??'',")
replace_once(perf,"ospfRoutes:document.querySelectorAll('.builder-route-table .source-ospf').length,","ospfRoutes:document.querySelectorAll('.builder-ipv4-route-table .source-ospf').length,")
replace_once(perf,"document.querySelectorAll('.builder-route-table .source-ospf').length > 0","document.querySelectorAll('.builder-ipv4-route-table .source-ospf').length > 0")
replace_once(perf,"document.querySelector('.builder-route-table')?.innerText.includes('via 10.0.0.14')","document.querySelector('.builder-ipv4-route-table')?.innerText.includes('via 10.0.0.14')")
anchor="""  await measuredClickButton(cdp, '.packet-origin-strip button', 'RETURN TO BUILDER');
  await waitForExpression(cdp, `Boolean(document.querySelector('.builder-workspace'))`, 8000);

  // Labs 11E-H: first show ARP resolution, STP blocking, same-VLAN switching, and MAC learning.
"""
insert="""  await measuredClickButton(cdp, '.packet-origin-strip button', 'RETURN TO BUILDER');
  await waitForExpression(cdp, `Boolean(document.querySelector('.builder-workspace'))`, 8000);

  // Lab 11N foundation: IPv6 is an independent FIB. Addressing exists by default, but routed reachability
  // appears only after explicit IPv6 route state is installed. The existing failed EDGE↔R1 link means the
  // weighted-path helper must choose the live R2 side without borrowing IPv4 OSPF state.
  const ipv6Before = await cdp.evaluate(`document.querySelector('.builder-ipv6-section')?.innerText??''`);
  if (!ipv6Before.includes('IPV6 · DUAL STACK') || !ipv6Before.includes('ENABLED · NO ROUTE') || !ipv6Before.includes('2001:db8:') || !ipv6Before.includes('LINK-LOCAL fe80:')) throw new Error(`${profile.id} IPv6 foundation did not expose independent enabled addressing before route installation.`);
  await measuredClickButton(cdp, '.builder-ipv6-section button', 'INSTALL IPV6 STATIC PATH');
  await waitForExpression(cdp, `document.querySelector('.builder-ipv6-section')?.innerText.includes('ENABLED · REACHABLE')`, 8000);
  const ipv6FamilySelected = await cdp.evaluate(`(()=>{
    const select=document.querySelector('.builder-probe-section select');
    if(!select)return false;
    select.value='ipv6';
    select.dispatchEvent(new Event('change',{bubbles:true}));
    return select.value==='ipv6';
  })()`);
  if (!ipv6FamilySelected) throw new Error(`${profile.id} could not select the IPv6 active-probe family.`);
  await sleep(60);
  await measuredClickButton(cdp, '.builder-probe-section button', 'TRACEROUTE');
  await waitForExpression(cdp, `document.querySelector('.builder-probe-panel')?.innerText.includes('TRACEROUTE') && document.querySelector('.builder-probe-panel')?.innerText.includes('ECHO REPLY')`, 8000);
  const ipv6ProbeText = await cdp.evaluate(`document.querySelector('.builder-probe-section')?.innerText??''`);
  if (!ipv6ProbeText.includes('ICMPV6') || !ipv6ProbeText.includes('IPV6') || !ipv6ProbeText.includes('HOP LIMIT')) throw new Error(`${profile.id} IPv6 traceroute did not expose ICMPv6/Hop-Limit teaching state.`);
  await measuredClickButton(cdp, '.builder-probe-section button', 'OPEN ICMP PACKET');
  await waitForExpression(cdp, `Boolean(document.querySelector('.packet-microscope'))`, 8000);
  const packet6Text = await cdp.evaluate(`document.querySelector('.packet-microscope')?.innerText??''`);
  if (!packet6Text.includes('LAB 11N · ICMPV6 TRACE HOP LIMIT') || !packet6Text.includes('IPv6') || !packet6Text.includes('ICMPv6') || !packet6Text.toLowerCase().includes('2001:db8:')) throw new Error(`${profile.id} IPv6 probe packet did not seed actual Builder ICMPv6 state into Lab 02.`);
  await measuredClickButton(cdp, '.packet-origin-strip button', 'RETURN TO BUILDER');
  await waitForExpression(cdp, `Boolean(document.querySelector('.builder-workspace'))`, 8000);
  const ipv4FamilyRestored = await cdp.evaluate(`(()=>{
    const select=document.querySelector('.builder-probe-section select');
    if(!select)return false;
    select.value='ipv4';
    select.dispatchEvent(new Event('change',{bubbles:true}));
    return select.value==='ipv4';
  })()`);
  if (!ipv4FamilyRestored) throw new Error(`${profile.id} could not restore IPv4 probe family for downstream policy contracts.`);
  await sleep(60);

  // Labs 11E-H: first show ARP resolution, STP blocking, same-VLAN switching, and MAC learning.
"""
replace_once(perf,anchor,insert)
replace_once(perf,"    packetMicroscopeIcmp: true,\n    sameVlanSwitching: true,", "    packetMicroscopeIcmp: true,\n    ipv6Foundation: true,\n    packetMicroscopeIcmpv6: true,\n    sameVlanSwitching: true,")

print('Lab 11N browser contract and dead-state cleanup applied.')
