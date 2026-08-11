import fs from 'node:fs';

const path = 'docs/ROADMAP.md';
const source = fs.readFileSync(path, 'utf8');
const start = source.indexOf('## Lab 07 — GOD MODE scenario modifiers');
const end = source.indexOf('## Measured/native mode — future');
if (start < 0 || end < 0 || end <= start) throw new Error('Could not locate Lab 07 roadmap section.');

const section = `## Lab 07 — GOD MODE scenario modifiers

GOD MODE impairments are deterministic modifiers over the same canonical Journey rather than a growing pile of hand-authored branches. Modifier truth stays upstream of reducer state, semantic scenes, and animation.

### 07A — modifier pipeline + latency spike
- [x] declarative modifier interface and deterministic ordering
- [x] migrate \`single-loss\` onto the modifier pipeline without changing its event log
- [x] add \`latency-spike\` without inventing packet loss
- [x] TCP RTT / SRTT / RTTVAR / RTO teaching state
- [x] QUIC latest/adjusted/smoothed RTT / RTTVAR / PTO teaching state
- [x] explicit \`NO LOSS DETECTED\` latency boundary
- [x] amber latency visual language distinct from red loss and teal recovery
- [x] schema-v1 sharing/persistence accepts latency
- [x] latency panel wired into the actual Journey theater
- [x] exact production-artifact desktop/mobile/reduced-motion audit

### 07B — pre-transport route failure + convergence
- [x] modifier pipeline expanded over the entire canonical Journey
- [x] deterministic primary-link failure after gateway selection
- [x] installed-route invalidation and SPF-style recomputation
- [x] cost-22 primary → cost-52 alternate route installation
- [x] convergence guaranteed before TCP SYN / QUIC Initial
- [x] identical routing projection for TCP/H2 and QUIC/H3
- [x] cache-miss and cache-hit route timelines
- [x] no false transport timeout/loss semantics in the pre-transport route modifier
- [x] direct jump into the detailed Lab 01 failure story and timestamp-preserving return
- [x] CLEAN / LOSS / LATENCY / ROUTE selector and route semantic scene
- [x] schema-v1 sharing/persistence accepts route failure
- [x] permanent 16-scenario GOD MODE CI contract
- [x] exact production-artifact desktop/mobile/reduced-motion audit

### 07C — modifier sets + causal composition
- [ ] replace the single mutually-exclusive impairment choice with an ordered modifier set
- [ ] preserve schema-v1 single-impairment links/files through migration
- [ ] define deterministic compatibility/conflict rules between modifiers
- [ ] prove modifier order does not depend on UI selection order
- [ ] allow combinations such as ROUTE + LOSS and LATENCY + LOSS without duplicating base Journey builders
- [ ] expose multiple simultaneous causes clearly in the event rail and state strip
- [ ] keep every modifier's truth/provenance independently inspectable
- [ ] expand permanent contracts from a profile matrix to representative composition cases

### Later GOD MODE stories
- [ ] mid-transfer path outage with protocol-correct TCP/QUIC recovery
- [ ] congestion / queue growth
- [ ] DNS failure / retry path
- [ ] server failure
- [ ] partition / unreachable state
- [ ] route leak / policy anomaly teaching scenario

`;

fs.writeFileSync(path, source.slice(0, start) + section + source.slice(end));
console.log('Synced roadmap through Lab 07B and scoped Lab 07C composition.');
