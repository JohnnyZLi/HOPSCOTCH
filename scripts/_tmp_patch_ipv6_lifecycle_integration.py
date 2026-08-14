from pathlib import Path

def replace_once(path, old, new):
    p = Path(path)
    s = p.read_text(encoding='utf-8')
    if s.count(old) != 1:
        raise SystemExit(f'{path}: expected unique anchor, found {s.count(old)} for {old[:80]!r}')
    p.write_text(s.replace(old, new, 1), encoding='utf-8')

def replace_all(path, old, new, minimum=1):
    p = Path(path)
    s = p.read_text(encoding='utf-8')
    count = s.count(old)
    if count < minimum:
        raise SystemExit(f'{path}: expected at least {minimum} anchors, found {count} for {old[:80]!r}')
    p.write_text(s.replace(old, new), encoding='utf-8')

# Extend IPv6 address provenance for runtime DHCPv6 leases.
p = Path('src/builder/ipv6.ts')
s = p.read_text(encoding='utf-8')
if "addressOrigin: 'manual' | 'slaac';" not in s:
    raise SystemExit('ipv6 addressOrigin type anchor missing')
s = s.replace("addressOrigin: 'manual' | 'slaac';", "addressOrigin: 'manual' | 'slaac' | 'dhcpv6';", 1)
old = "addressOrigin: entry.addressOrigin === 'slaac' ? 'slaac' : 'manual'"
if s.count(old) < 2:
    raise SystemExit(f'expected two addressOrigin normalization anchors, found {s.count(old)}')
s = s.replace(old, "addressOrigin: entry.addressOrigin === 'slaac' ? 'slaac' : entry.addressOrigin === 'dhcpv6' ? 'dhcpv6' : 'manual'")
p.write_text(s, encoding='utf-8')

# Builder IPv6 panel lifecycle plumbing.
replace_once(
    'src/BuilderIpv6Panel.tsx',
    "import { clearBuilderIpv6NeighborCache, clearBuilderIpv6PmtuCache, runBuilderIpv6RouterSolicitation, type BuilderIpv6ControlState } from './builder/ipv6-control-plane.ts';\n",
    "import { clearBuilderIpv6NeighborCache, clearBuilderIpv6PmtuCache, runBuilderIpv6RouterSolicitation, type BuilderIpv6ControlState } from './builder/ipv6-control-plane.ts';\nimport { materializeBuilderIpv6RuntimeConfig, recordBuilderIpv6RaLifetime, type BuilderIpv6LifecycleState } from './builder/ipv6-lifecycle.ts';\nimport { BuilderIpv6LifecyclePanel } from './BuilderIpv6LifecyclePanel.tsx';\n",
)
replace_once(
    'src/BuilderIpv6Panel.tsx',
    "export function BuilderIpv6Panel({ graph, ipv4, ipv6, selectedNodeId, selectedLinkId, sourceId, destinationId, controlState, onControlStateChange, probePacketBytes, onProbePacketBytesChange, onChange, onMessage }: {",
    "export function BuilderIpv6Panel({ graph, ipv4, ipv6, selectedNodeId, selectedLinkId, sourceId, destinationId, controlState, onControlStateChange, lifecycleState, onLifecycleStateChange, probePacketBytes, onProbePacketBytesChange, onChange, onMessage }: {",
)
replace_once(
    'src/BuilderIpv6Panel.tsx',
    "  onControlStateChange: (next: BuilderIpv6ControlState) => void;\n  probePacketBytes: number;",
    "  onControlStateChange: (next: BuilderIpv6ControlState) => void;\n  lifecycleState: BuilderIpv6LifecycleState;\n  onLifecycleStateChange: (next: BuilderIpv6LifecycleState) => void;\n  probePacketBytes: number;",
)
replace_once(
    'src/BuilderIpv6Panel.tsx',
    "  const destinationPrefix = interfacesForBuilderNodeIpv6(ipv6.addressing, destinationId)[0]?.prefix ?? '::/0';\n  const trace = useMemo(() => traceBuilderIpv6Forwarding(graph, ipv6, sourceId, destinationId), [graph, ipv6, sourceId, destinationId]);",
    "  const destinationPrefix = interfacesForBuilderNodeIpv6(ipv6.addressing, destinationId)[0]?.prefix ?? '::/0';\n  const runtimeIpv6 = useMemo(() => materializeBuilderIpv6RuntimeConfig(ipv6, lifecycleState), [ipv6, lifecycleState]);\n  const trace = useMemo(() => traceBuilderIpv6Forwarding(graph, runtimeIpv6, sourceId, destinationId), [graph, runtimeIpv6, sourceId, destinationId]);",
)
replace_once(
    'src/BuilderIpv6Panel.tsx',
    "      onChange(result.config); onControlStateChange(result.state);\n      onMessage(result.event.success ? `RA / SLAAC · ${result.event.detail}` : `RA MISSED · ${result.event.detail}`);",
    "      onChange(result.config); onControlStateChange(result.state); onLifecycleStateChange(recordBuilderIpv6RaLifetime(lifecycleState, result.event));\n      onMessage(result.event.success ? `RA / SLAAC · ${result.event.detail}` : `RA MISSED · ${result.event.detail}`);",
)
replace_once(
    'src/BuilderIpv6Panel.tsx',
    "    <div className=\"control-title\"><span>PATH MTU DISCOVERY</span><strong>{controlState.pmtuCache.length} CACHED</strong></div>",
    "    <BuilderIpv6LifecyclePanel graph={graph} ipv4={ipv4} ipv6={ipv6} selectedNodeId={selectedNodeId} selectedLinkId={selectedLinkId} controlState={controlState} lifecycleState={lifecycleState} onLifecycleStateChange={onLifecycleStateChange} onIpv6Change={onChange} onMessage={onMessage}/>\n    <div className=\"control-title\"><span>PATH MTU DISCOVERY</span><strong>{controlState.pmtuCache.length} CACHED</strong></div>",
)

# NetworkBuilder session lifecycle state, runtime lease materialization, and reset semantics.
replace_once(
    'src/NetworkBuilder.tsx',
    "import { createBuilderIpv6ControlState, type BuilderIpv6ControlState } from './builder/ipv6-control-plane.ts';\n",
    "import { createBuilderIpv6ControlState, type BuilderIpv6ControlState } from './builder/ipv6-control-plane.ts';\nimport { createBuilderIpv6LifecycleState, materializeBuilderIpv6RuntimeConfig, reconcileBuilderIpv6LifecycleWithControl, type BuilderIpv6LifecycleState } from './builder/ipv6-lifecycle.ts';\n",
)
replace_once(
    'src/NetworkBuilder.tsx',
    "  const [ipv6ControlState, setIpv6ControlState] = useState<BuilderIpv6ControlState>(() => createBuilderIpv6ControlState());\n  const [ipv6ProbePacketBytes, setIpv6ProbePacketBytes] = useState(1280);",
    "  const [ipv6ControlState, setIpv6ControlState] = useState<BuilderIpv6ControlState>(() => createBuilderIpv6ControlState());\n  const [ipv6LifecycleState, setIpv6LifecycleState] = useState<BuilderIpv6LifecycleState>(() => createBuilderIpv6LifecycleState());\n  const [ipv6ProbePacketBytes, setIpv6ProbePacketBytes] = useState(1280);",
)
replace_once(
    'src/NetworkBuilder.tsx',
    "      ? runBuilderIpv6Probe(graph, ipv6, kind, sourceId, destinationId, probeHistory.length + 1, linkProfiles, natSessions, ipv6ControlState, ipv6ProbePacketBytes)",
    "      ? runBuilderIpv6Probe(graph, materializeBuilderIpv6RuntimeConfig(ipv6, ipv6LifecycleState), kind, sourceId, destinationId, probeHistory.length + 1, linkProfiles, natSessions, ipv6ControlState, ipv6ProbePacketBytes)",
)
replace_once(
    'src/NetworkBuilder.tsx',
    "    if (probeFamily === 'ipv6') setIpv6ControlState((result as ReturnType<typeof runBuilderIpv6Probe>).ipv6ControlState);",
    "    if (probeFamily === 'ipv6') { const ipv6Result = result as ReturnType<typeof runBuilderIpv6Probe>; setIpv6ControlState(ipv6Result.ipv6ControlState); setIpv6LifecycleState((current) => reconcileBuilderIpv6LifecycleWithControl(ipv6Result.ipv6ControlState, current)); }",
)
replace_all(
    'src/NetworkBuilder.tsx',
    "setIpv6ControlState(createBuilderIpv6ControlState());",
    "setIpv6ControlState(createBuilderIpv6ControlState()); setIpv6LifecycleState(createBuilderIpv6LifecycleState());",
    minimum=3,
)
replace_once(
    'src/NetworkBuilder.tsx',
    "<BuilderIpv6Panel graph={graph} ipv4={addressing} ipv6={ipv6} selectedNodeId={selectedNodeId} selectedLinkId={selectedLinkId} sourceId={sourceId} destinationId={destinationId} controlState={ipv6ControlState} onControlStateChange={setIpv6ControlState} probePacketBytes={ipv6ProbePacketBytes} onProbePacketBytesChange={setIpv6ProbePacketBytes} onChange={setIpv6} onMessage={setMessage}/>",
    "<BuilderIpv6Panel graph={graph} ipv4={addressing} ipv6={ipv6} selectedNodeId={selectedNodeId} selectedLinkId={selectedLinkId} sourceId={sourceId} destinationId={destinationId} controlState={ipv6ControlState} onControlStateChange={setIpv6ControlState} lifecycleState={ipv6LifecycleState} onLifecycleStateChange={setIpv6LifecycleState} probePacketBytes={ipv6ProbePacketBytes} onProbePacketBytesChange={setIpv6ProbePacketBytes} onChange={setIpv6} onMessage={setMessage}/>",
)

# Permanent contract wiring.
p = Path('package.json')
s = p.read_text(encoding='utf-8')
a = 'npm run test:builder-ipv6-control-plane-contract && npm run test:builder-ipv6-ospfv3-contract'
b = 'npm run test:builder-ipv6-control-plane-contract && npm run test:builder-ipv6-lifecycle-contract && npm run test:builder-ipv6-ospfv3-contract'
if s.count(a) != 1: raise SystemExit('package check anchor missing')
s = s.replace(a,b,1)
a = '    "test:builder-ipv6-control-plane-contract": "node scripts/builder-ipv6-control-plane-contract-check.mjs",\n    "test:builder-ipv6-ospfv3-contract":'
b = '    "test:builder-ipv6-control-plane-contract": "node scripts/builder-ipv6-control-plane-contract-check.mjs",\n    "test:builder-ipv6-lifecycle-contract": "node scripts/builder-ipv6-lifecycle-contract-check.mjs",\n    "test:builder-ipv6-ospfv3-contract":'
if s.count(a) != 1: raise SystemExit('package script anchor missing')
s = s.replace(a,b,1)
p.write_text(s,encoding='utf-8')

# Roadmap: deepen 11N without pretending the remaining policy/routing depth is done.
p = Path('docs/ROADMAP.md')
s = p.read_text(encoding='utf-8')
a = "- [x] dual-stack application/probe selection keeps IPv4 and IPv6 truth independent\n\n### 11O — BGP inside Network Builder"
b = "- [x] dual-stack application/probe selection keeps IPv4 and IPv6 truth independent\n- [x] Duplicate Address Detection plus deterministic duplicate-conflict teaching probes\n- [x] Neighbor Unreachability Detection lifecycle: REACHABLE → STALE → DELAY → PROBE → FAILED / recovery\n- [x] RA preferred/valid/router lifetimes with deprecation, expiry, and deterministic /64 renumbering\n- [x] stateful DHCPv6 SOLICIT → ADVERTISE → REQUEST → REPLY leases kept distinct from RA default-router discovery\n- [ ] timed + multi-area OSPFv3 with ABRs and inter-area IPv6 route reasoning\n- [ ] IPv6 ACL/firewall policy with independent forward/reverse ICMPv6 evaluation\n\n### 11O — BGP inside Network Builder"
if s.count(a) != 1: raise SystemExit('roadmap 11N anchor missing')
s = s.replace(a,b,1)
p.write_text(s,encoding='utf-8')

# Replace the old deferred-only Lab 11N description with an additive depth note.
p = Path('docs/LAB11N.md')
s = p.read_text(encoding='utf-8')
append = '''\n\n## Lifecycle depth slice\n\nThe next IPv6 slice adds state that only becomes visible over time rather than at initial configuration:\n\n- Duplicate Address Detection explicitly tests tentative addresses before use and can demonstrate a deterministic duplicate without corrupting canonical addressing.\n- Neighbor Unreachability Detection tracks REACHABLE, STALE, DELAY, PROBE, and FAILED states over a session clock. Reusing a stale entry drives the state machine; live Neighbor Advertisement can recover it.\n- Router Advertisement state now carries preferred, valid, and router lifetimes. Prefixes become deprecated before expiry, and deterministic renumbering keeps the old prefix valid for a bounded grace period while a new documentation `/64` becomes preferred.\n- Stateful DHCPv6 models SOLICIT → ADVERTISE → REQUEST → REPLY, T1/T2/valid lease timers, and runtime address materialization. The model deliberately does **not** learn the default router from DHCPv6; RA remains the source of default-router truth.\n- DHCPv6 leases, DAD/NUD observations, and lifetime clocks are session state rather than persisted configuration. A saved scenario therefore cannot fabricate a lease that was never renewed after restore.\n\nTimed/multi-area OSPFv3 and IPv6 ACL policy remain separate follow-on slices.\n'''
if '## Lifecycle depth slice' not in s:
    s = s.rstrip() + append
p.write_text(s,encoding='utf-8')

print('Patched IPv6 lifecycle integration, contracts, and docs.')
