from pathlib import Path

p = Path('src/NetworkBuilder.tsx')
s = p.read_text(encoding='utf-8')

s = s.replace(
    "createDefaultBuilderIpv6RoutingDepthState(scenario.graph)",
    "createDefaultBuilderIpv6RoutingDepthState(initialGraph)",
)

broken = "setIpv6ControlState(createBuilderIpv6ControlState()); setIpv6LifecycleState(createBuilderIpv6LifecycleState()); setIpv6RoutingDepth(createDefaultBuilderIpv6RoutingDepthState(\n    const nextSource"
fixed = "setIpv6ControlState(createBuilderIpv6ControlState()); setIpv6LifecycleState(createBuilderIpv6LifecycleState()); setIpv6RoutingDepth(createDefaultBuilderIpv6RoutingDepthState(next));\n    const nextSource"
if broken not in s:
    raise SystemExit('commitGraph malformed reset anchor missing')
s = s.replace(broken, fixed, 1)

reset_old = "setNatSessions(clearBuilderNatSessions()); setIpv6ControlState(createBuilderIpv6ControlState()); setIpv6LifecycleState(createBuilderIpv6LifecycleState()); setIpv6RoutingDepth(createDefaultBuilderIpv6RoutingDepthState(graph)); setArpCache"
reset_new = "setNatSessions(clearBuilderNatSessions()); setIpv6ControlState(createBuilderIpv6ControlState()); setIpv6LifecycleState(createBuilderIpv6LifecycleState()); setIpv6RoutingDepth(createDefaultBuilderIpv6RoutingDepthState(initialGraph)); setArpCache"
if reset_old not in s:
    raise SystemExit('resetTopology routing-depth reset anchor missing')
s = s.replace(reset_old, reset_new, 1)

restore_old = "setNatSessions(clearBuilderNatSessions()); setIpv6ControlState(createBuilderIpv6ControlState()); setIpv6LifecycleState(createBuilderIpv6LifecycleState()); setIpv6RoutingDepth(createDefaultBuilderIpv6RoutingDepthState(graph)); setArpCache"
restore_new = "setNatSessions(clearBuilderNatSessions()); setIpv6ControlState(createBuilderIpv6ControlState()); setIpv6LifecycleState(createBuilderIpv6LifecycleState()); setIpv6RoutingDepth(createDefaultBuilderIpv6RoutingDepthState(scenario.graph)); setArpCache"
if restore_old not in s:
    raise SystemExit('restoreScenario routing-depth reset anchor missing')
s = s.replace(restore_old, restore_new, 1)

p.write_text(s, encoding='utf-8')
print('Fixed NetworkBuilder routing-depth initialization and graph reset targets.')
