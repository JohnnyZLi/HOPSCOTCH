from pathlib import Path
p=Path('scripts/performance-profile.mjs')
t=p.read_text()

# Compatibility profiles require the new semantic surfaces to survive desktop/mobile execution.
t=t.replace("expected: ['ETHERNET FABRIC', 'ROUTED · VLAN 10 → 20', 'VLAN 20', 'DERIVED FDB']", "expected: ['ETHERNET FABRIC', 'ROUTED · VLAN 10 → 20', 'VLAN 20', 'DERIVED FDB', 'ARP CACHE', 'STP', 'ROUTED POLICY']")
t=t.replace("expected: ['ETHERNET FABRIC', 'ROUTED · VLAN 10 → 20', 'VLAN 20']", "expected: ['ETHERNET FABRIC', 'ROUTED · VLAN 10 → 20', 'VLAN 20', 'ARP CACHE', 'STP', 'ROUTED POLICY']")

# Probe path now exposes actual link-derived metrics.
marker="  if (probe.activeLinks < 4) throw new Error(`${profile.id} did not visually mark the traceroute forwarding path.`);\n\n  // Cross-link one TTL-scoped probe"
insertion="""  if (probe.activeLinks < 4) throw new Error(`${profile.id} did not visually mark the traceroute forwarding path.`);
  const probeMetrics = await cdp.evaluate(`document.querySelector('.builder-probe-metrics')?.innerText??''`);
  if (!probeMetrics.includes('RTT MS') || !probeMetrics.includes('PATH MTU') || /—\\s*RTT MS/.test(probeMetrics)) throw new Error(`${profile.id} traceroute did not expose link-derived RTT/MTU metrics.`);

  // Cross-link one TTL-scoped probe"""
if marker not in t: raise SystemExit('probe metric marker missing')
t=t.replace(marker,insertion)

# ACL policy is independent of route truth: deny ICMP, observe failed Ping, remove rule, recover.
marker="  await measuredClickButton(cdp, '.packet-origin-strip button', 'RETURN TO BUILDER');\n  await waitForExpression(cdp, `Boolean(document.querySelector('.builder-workspace'))`, 8000);\n\n  // Labs 11E/F: first show same-VLAN switching and MAC learning."
insertion="""  await measuredClickButton(cdp, '.packet-origin-strip button', 'RETURN TO BUILDER');
  await waitForExpression(cdp, `Boolean(document.querySelector('.builder-workspace'))`, 8000);

  // Lab 11J: returning from Lab 02 recreates the Builder selection shell, so explicitly select EDGE again.
  const aclEdgeSelected = await cdp.evaluate(`(()=>{
    const node=[...document.querySelectorAll('.builder-node')].find((candidate)=>candidate.querySelector('strong')?.textContent?.trim()==='EDGE');
    if(!node)return false;
    node.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:1,isPrimary:true,pointerType:'mouse'}));
    return true;
  })()`);
  if (!aclEdgeSelected) throw new Error(`${profile.id} could not select EDGE for ACL policy testing.`);
  await waitForExpression(cdp, `document.querySelector('.builder-acl-section .control-title')?.innerText.includes('0 RULES')`, 8000);

  // Install an ordered ICMP deny on EDGE. Forwarding stays reachable while policy blocks the packet.
  await measuredClickButton(cdp, '.builder-acl-section button', 'ADD ACL RULE');
  await waitForExpression(cdp, `document.querySelector('.builder-policy-panel')?.classList.contains('denied')`, 8000);
  const deniedPolicy = await cdp.evaluate(`(()=>({policy:document.querySelector('.builder-policy-panel')?.innerText??'',forwarding:document.querySelector('.builder-forwarding')?.innerText??'',rules:document.querySelectorAll('.builder-acl-rules>div').length}))()`);
  if (!deniedPolicy.policy.includes('DENIED') || !deniedPolicy.forwarding.includes('EDGE → R2 → CORE') || deniedPolicy.rules !== 1) throw new Error(`${profile.id} ACL denial did not remain separate from OSPF forwarding truth.`);
  await measuredClickButton(cdp, '.builder-probe-section button', 'PING');
  await waitForExpression(cdp, `document.querySelector('.builder-probe-panel')?.innerText.includes('PING') && document.querySelector('.builder-probe-panel')?.classList.contains('failed')`, 8000);
  const aclPing = await cdp.evaluate(`document.querySelector('.builder-probe-panel')?.innerText??''`);
  if (!/ACL|POLICY|DENIED/i.test(aclPing)) throw new Error(`${profile.id} Ping did not surface ACL policy denial.`);
  const deletedAcl = await cdp.evaluate(`(()=>{const button=document.querySelector('.builder-acl-rules button');if(!button)return false;button.click();return true})()`);
  if (!deletedAcl) throw new Error(`${profile.id} could not remove the temporary ACL rule.`);
  await waitForExpression(cdp, `!document.querySelector('.builder-policy-panel')?.classList.contains('denied')`, 8000);
  await measuredClickButton(cdp, '.builder-probe-section button', 'PING');
  await waitForExpression(cdp, `document.querySelector('.builder-probe-panel')?.innerText.includes('PING') && document.querySelector('.builder-probe-panel')?.classList.contains('success')`, 8000);

  // Labs 11E-H: first show ARP resolution, STP blocking, same-VLAN switching, and MAC learning."""
if marker not in t: raise SystemExit('ACL insertion marker missing')
t=t.replace(marker,insertion)

# First same-VLAN flow: ARP request/reply and STP root/blocking must be visible.
marker="  if (!switched.stage.includes('FLOOD THEN LEARN') || !switched.fdb.includes('SW1 · V10') || !switched.fdb.includes('SW2 · V10')) throw new Error(`${profile.id} same-VLAN flow did not expose VLAN-scoped FDB learning.`);\n  if (switched.flowLinks < 3) throw new Error(`${profile.id} same-VLAN path did not highlight the LAN links.`);\n\n  const setSelect"
insertion="""  if (!switched.stage.includes('FLOOD THEN LEARN') || !switched.fdb.includes('SW1 · V10') || !switched.fdb.includes('SW2 · V10')) throw new Error(`${profile.id} same-VLAN flow did not expose VLAN-scoped FDB learning.`);
  if (!switched.stage.includes('ARP REQUEST → REPLY') || !switched.stage.includes('SW1 ROOT') || !switched.stage.includes('1 BLOCKED')) throw new Error(`${profile.id} first LAN flow did not expose ARP + STP truth.`);
  if (switched.flowLinks < 3) throw new Error(`${profile.id} same-VLAN path did not highlight the LAN links.`);
  if (await cdp.evaluate(`document.querySelectorAll('.builder-lan-canvas g.stp-blocked').length`) !== 1) throw new Error(`${profile.id} did not visually mark exactly one VLAN-10 STP blocked segment.`);

  // Repeating the same flow must hit the session-only ARP cache rather than replay address resolution.
  await measuredClickButton(cdp, '.builder-ethernet-section button', 'SEND FRAME / PACKET');
  await waitForExpression(cdp, `document.querySelector('.builder-ethernet-stage')?.innerText.includes('ARP CACHE HIT')`, 8000);

  const setSelect"""
if marker not in t: raise SystemExit('ARP/STP insertion marker missing')
t=t.replace(marker,insertion)

# After selector helper, fail the primary VLAN-10 trunk and prove STP reconverges through SW3, then restore.
marker="  if (!(await setSelect(1, 'lan-c'))) throw new Error(`${profile.id} could not choose PC-C for inter-VLAN flow.`);"
insertion="""  if (!(await setSelect(2, 'lan-sw1-sw2'))) throw new Error(`${profile.id} could not select the primary SW1↔SW2 trunk for STP failover.`);
  await sleep(60);
  await measuredClickButton(cdp, '.builder-ethernet-section button', 'FAIL LAN LINK');
  await waitForExpression(cdp, `document.querySelector('.builder-lan-truth')?.innerText.includes('0 BLOCKED')`, 8000);
  await measuredClickButton(cdp, '.builder-ethernet-section button', 'SEND FRAME / PACKET');
  await waitForExpression(cdp, `document.querySelector('.builder-ethernet-stage')?.innerText.includes('SWITCHED · VLAN 10')`, 8000);
  const stpFailover = await cdp.evaluate(`document.querySelector('.builder-ethernet-stage')?.innerText??''`);
  if (!stpFailover.includes('SW3') || !stpFailover.includes('PC-B')) throw new Error(`${profile.id} VLAN-10 traffic did not reconverge through SW3 after primary trunk failure.`);
  await measuredClickButton(cdp, '.builder-ethernet-section button', 'RESTORE LAN LINK');
  await waitForExpression(cdp, `document.querySelector('.builder-lan-truth')?.innerText.includes('1 BLOCKED')`, 8000);

  if (!(await setSelect(1, 'lan-c'))) throw new Error(`${profile.id} could not choose PC-C for inter-VLAN flow.`);"""
if marker not in t: raise SystemExit('STP failover marker missing')
t=t.replace(marker,insertion)

# Inter-VLAN flow should expose two ARP resolutions (gateway + destination).
marker="  if (!routed.includes('RTR') || !routed.includes('VLAN 20') || !routed.includes('TTL 64 → 63')) throw new Error(`${profile.id} inter-VLAN flow lost router-on-a-stick or TTL truth.`);"
insertion="""  if (!routed.includes('RTR') || !routed.includes('VLAN 20') || !routed.includes('TTL 64 → 63')) throw new Error(`${profile.id} inter-VLAN flow lost router-on-a-stick or TTL truth.`);
  if ((routed.match(/ARP REQUEST → REPLY/g)??[]).length < 2 || !routed.includes('10.10.0.1') || !routed.includes('10.20.0.10')) throw new Error(`${profile.id} inter-VLAN flow did not resolve gateway-side and destination-side ARP independently.`);"""
t=t.replace(marker,insertion)

# Report permanent 11G-J browser invariants.
t=t.replace("    interVlanRouting: true,\n", "    interVlanRouting: true,\n    arpResolutionAndCache: true,\n    stpBlockingAndFailover: true,\n    linkDerivedProbeMetrics: true,\n    aclPolicyIsolation: true,\n")

p.write_text(t)
