import fs from 'node:fs';
const path='docs/TRACKJ.md';
let text=fs.readFileSync(path,'utf8');
const marker='## Sixth slice — IPv6 PMTU and neighbor resolution';
if(!text.includes(marker)){
  text += [
    '',
    '',
    marker,
    '',
    'Track J now includes a deterministic `mtu-*` / `pmtu-*` / `ipv6-mtu-*` family built entirely on the existing IPv6 forwarding, Neighbor Discovery, link-characteristics, and PMTU models.',
    '',
    '- The healthy CLIENT → APP baseline enables the existing OSPFv3 control plane and keeps every routed-link MTU at 1500 bytes.',
    '- The broken snapshot changes exactly one deterministic path link from MTU 1500 to 1280; topology, IPv6 addresses, routes, policy, and all other link characteristics stay unchanged.',
    '- A normal 1500-byte IPv6 Ping performs ordinary NS/NA resolution, reaches the constraining hop, receives ICMPv6 Packet Too Big, and learns a session-only PMTU of 1280.',
    '- Successful Neighbor Discovery is explicit narrowing evidence: it demonstrates that next-hop resolution is healthy while full-size delivery fails at the MTU boundary.',
    '- Repair uses the existing selected-link MTU control. Device Workbench now projects routed-link MTU and physical link characteristics beside interface configuration.',
    '- Restoring MTU 1500 earns canonical repair points, but a retry still constrained to 1280 by stale PMTU cache does not verify the objective. Verification requires clearing PMTU state and proving requested bytes = effective transmitted bytes = 1500.',
    '',
    'This slice intentionally does not invent a standalone ND-only fault. The current canonical IPv6 model has no independent ND failure knob separate from link, addressing, and routing faults already represented elsewhere. ARP remains ordinary evidence in the existing VLAN/trunk/STP families for the same reason: challenge logic observes neighbor resolution; it does not manufacture it.',
    '',
    'PMTU scoring preserves the 100-point contract: Packet Too Big evidence (15) + successful ND narrowing evidence (5) + target STATE (10) + target CONFIG (10), then 20 causal-reasoning points, 25 exact MTU-repair points, and 15 full-size post-repair verification points.',
    ''
  ].join('\n');
}
text=text.replace('- ACL and NAT failures,\n- DHCP failures,\n- MTU / PMTUD failures,\n- DNS failures,','- deeper ACL/NAT composition beyond the shipped single-fault policy families,\n- deeper DHCP relay/options failures beyond the shipped missing-gateway-option family,\n- additional MTU / PMTUD cases beyond the shipped IPv6 reduced-path-MTU family,\n- DNS failures,');
fs.writeFileSync(path,text);
console.log('Updated Track J documentation for the IPv6 PMTU / ND slice.');
