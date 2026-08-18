import { readFileSync, writeFileSync } from 'node:fs';

function replaceOnce(text, before, after, label) {
  const index = text.indexOf(before);
  if (index < 0) throw new Error(`Track D roadmap marker not found: ${label}`);
  if (text.indexOf(before, index + before.length) >= 0) throw new Error(`Track D roadmap marker is ambiguous: ${label}`);
  return `${text.slice(0, index)}${after}${text.slice(index + before.length)}`;
}

const path = 'docs/ROADMAP.md';
let roadmap = readFileSync(path, 'utf8');
const before = `### 1. Track D — end-to-end application traffic inside Builder

This is the largest missing integration layer in the simulator itself and is the next active track.

- [ ] endpoints can host deterministic DNS, HTTP/HTTPS, SSH, generic TCP, and generic UDP services
- [ ] one Builder application request consumes the existing DHCP/addressing → ARP/ND → Ethernet/VLAN/STP → routing → ACL/NAT → transport → TLS → application truth
- [ ] Builder TCP/QUIC sessions reuse the canonical Lab 03/Journey protocol models instead of creating a second transport simulator
- [ ] any frame/packet/segment can open Packet Microscope with exact originating Builder state and bytes
- [ ] the same transaction can move between Builder, Protocol Theater, Journey, and Packet Microscope as different cameras on shared canonical truth

### 2. Track A — Builder-wide time machine + causal troubleshooting`;
const after = `### Completed active track — Track D end-to-end application traffic inside Builder

Track D now projects one deterministic application transaction through existing Builder network truth and canonical Journey/Packet models instead of maintaining a parallel application simulator.

- [x] endpoints can host deterministic DNS, HTTP/HTTPS, SSH, generic TCP, and generic UDP services
- [x] one Builder application request consumes the existing DHCP/addressing → ARP/ND → Ethernet/VLAN/STP → routing → ACL/NAT → transport → TLS → application truth
- [x] Builder TCP/QUIC sessions reuse the canonical Lab 03/Journey protocol models instead of creating a second transport simulator
- [x] any frame/packet/segment can open Packet Microscope with exact originating Builder state and bytes
- [x] the same transaction can move between Builder, Protocol Theater, Journey, and Packet Microscope as different cameras on shared canonical truth

The integrated Builder workspace keeps later layers `NOT_REACHED` after the first broken truth boundary, writes ARP/NAT/DHCP/IPv6-control session state back into the same live Builder session, and lazy-loads the Track D workspace so initial production bundle budgets remain unchanged. `docs/TRACKD.md` is the closeout architecture and validation record.

### 1. Track A — Builder-wide time machine + causal troubleshooting`;
roadmap = replaceOnce(roadmap, before, after, 'Track D active section');
roadmap = replaceOnce(roadmap, '### 3. Track B — Builder authoring environment', '### 2. Track B — Builder authoring environment', 'Track B priority number');
writeFileSync(path, roadmap);
console.log('Track D roadmap closed; Track A promoted to priority 1.');
