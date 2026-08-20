from pathlib import Path
import re


def replace_once(path: str, old: str, new: str) -> None:
    file_path = Path(path)
    text = file_path.read_text()
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected one anchor, found {count}: {old[:140]!r}")
    file_path.write_text(text.replace(old, new, 1))


path = Path('src/builder/explain.ts')
text = path.read_text()
pattern = re.compile(r"function routeFacts\(input: BuilderDeviceWorkbenchInput, request: BuilderExplainRequest\): FactGraph \{.*?\n\}\n\nfunction adjacencyFacts", re.S)
match = pattern.search(text)
if not match:
    raise RuntimeError('src/builder/explain.ts: routeFacts block not found')
new_route = r'''function routeFacts(input: BuilderDeviceWorkbenchInput, request: BuilderExplainRequest): FactGraph {
  const builder = new FactBuilder();
  const routerId = request.routerId && input.graph.nodes.some((node) => node.id === request.routerId && node.kind === 'router') ? request.routerId : defaultRouterId(input);
  if (!routerId) {
    const citation = builder.cite('graph:routed', 'CONFIG', 'ROUTED GRAPH', 'No router exists in the current routed graph.', input.graph.nodes.map((node) => node.id));
    builder.add('route.no-router', 'TOPOLOGY', 'Route explanation', 'requires', 'NO ROUTER AVAILABLE', 'bad', [], [citation]);
    return { topic: 'route', focusLabel: 'NO ROUTER', verdictCode: 'NO_ROUTER', facts: builder.facts, citations: builder.citations };
  }
  const destinationAddress = primaryAddress(input.addressing, input.destinationId);
  const routerCitation = builder.cite(`graph:node:${routerId}`, 'CONFIG', 'ROUTER', `${nodeLabel(input.graph, routerId)} · ${routerId}`, [routerId]);
  const destinationCitation = builder.cite(`addressing:destination:${input.destinationId}`, 'CONFIG', 'DESTINATION ADDRESS', destinationAddress ?? 'NO IPV4 ADDRESS', [input.destinationId]);
  builder.add('route.objective', 'CONFIG', nodeLabel(input.graph, routerId), 'must forward to', `${nodeLabel(input.graph, input.destinationId)} · ${destinationAddress ?? 'NO IPV4'}`, destinationAddress ? 'neutral' : 'bad', [], [routerCitation, destinationCitation]);
  if (!destinationAddress) return { topic: 'route', focusLabel: nodeLabel(input.graph, routerId), verdictCode: 'NO_DESTINATION_ADDRESS', facts: builder.facts, citations: builder.citations };

  const ribTable = routeTableForBuilderRouter(ribGraph(input), input.addressing, input.routing, routerId, controlGraph(input));
  const ribCitation = builder.cite(`state:rib:${routerId}`, 'STATE', 'RIB ROUTE TABLE', `${ribTable.filter((entry) => entry.active).length} active routes in the selected live/historical RIB graph`, ribTable.map((entry) => entry.id));
  const ribMatching = ribTable.filter((entry) => entry.active && prefixContains(entry.prefix, destinationAddress));
  builder.add('route.matches', 'RIB_FIB', nodeLabel(input.graph, routerId), 'RIB matching routes', `${ribMatching.length} candidate${ribMatching.length === 1 ? '' : 's'} for ${destinationAddress}`, ribMatching.length ? 'good' : 'bad', ['route.objective'], [ribCitation]);
  const ribSelection = selectBuilderRouteWithDecision(ribTable, destinationAddress, null);
  const selected = ribSelection.route;
  if (!selected) {
    builder.add('route.selected', 'RIB_FIB', nodeLabel(input.graph, routerId), 'RIB selects', 'NO MATCHING ROUTE', 'bad', ['route.matches'], [ribCitation]);
    const fibTable = routeTableForBuilderRouter(fibGraph(input), input.addressing, input.routing, routerId, controlGraph(input));
    const fibCitation = builder.cite(`state:fib:${routerId}`, 'STATE', 'FIB ROUTE TABLE', `${fibTable.filter((entry) => entry.active).length} active routes in the selected live/historical FIB graph`, fibTable.map((entry) => entry.id));
    const fibSelected = selectBuilderRouteWithDecision(fibTable, destinationAddress, null).route;
    builder.add('route.fib-selected', 'RIB_FIB', nodeLabel(input.graph, routerId), 'FIB currently forwards with', fibSelected ? `${fibSelected.prefix} · ${fibSelected.source.toUpperCase()} · via ${fibSelected.nextHop ?? 'CONNECTED'}` : 'NO MATCHING ROUTE', fibSelected ? 'warn' : 'bad', ['route.selected'], [fibCitation, ...(fibSelected ? [routeSourceCitation(builder, input, fibSelected)] : [])]);
    appendEventFacts(builder, input, latestMatchingEvent(input, [routerId, input.destinationId], ['routing', 'topology']), 'route.fib-selected');
    return { topic: 'route', focusLabel: `${nodeLabel(input.graph, routerId)} → ${destinationAddress}`, verdictCode: fibSelected ? 'RIB_FIB_DIVERGED' : 'NO_ROUTE', facts: builder.facts, citations: builder.citations };
  }

  const selectedCitation = routeSourceCitation(builder, input, selected);
  builder.add('route.selected', 'RIB_FIB', nodeLabel(input.graph, routerId), 'RIB selects', `${selected.prefix} · ${selected.source.toUpperCase()} · AD ${selected.administrativeDistance} · metric ${selected.metric} · via ${selected.nextHop ?? 'CONNECTED'}`, 'good', ['route.matches'], [ribCitation, selectedCitation]);
  const contenders = ribMatching.filter((entry) => entry.id !== selected.id).slice(0, 4);
  contenders.forEach((entry, index) => {
    const citation = routeSourceCitation(builder, input, entry);
    builder.add(`route.contender.${index + 1}`, 'RIB_FIB', `${entry.prefix} ${entry.source.toUpperCase()}`, 'loses to RIB winner because', rejectionReason(selected, entry), 'neutral', ['route.selected'], [citation]);
  });

  const fibTable = routeTableForBuilderRouter(fibGraph(input), input.addressing, input.routing, routerId, controlGraph(input));
  const fibCitation = builder.cite(`state:fib:${routerId}`, 'STATE', 'FIB ROUTE TABLE', `${fibTable.filter((entry) => entry.active).length} active routes in the selected live/historical FIB graph`, fibTable.map((entry) => entry.id));
  const fibSelected = selectBuilderRouteWithDecision(fibTable, destinationAddress, null).route;
  const sameSelection = Boolean(fibSelected && fibSelected.prefix === selected.prefix && fibSelected.source === selected.source && fibSelected.nextHop === selected.nextHop && fibSelected.linkId === selected.linkId);
  const fibSelectedCitation = fibSelected ? routeSourceCitation(builder, input, fibSelected) : null;
  builder.add(
    'route.fib-selected',
    'RIB_FIB',
    nodeLabel(input.graph, routerId),
    'FIB currently forwards with',
    fibSelected ? `${fibSelected.prefix} · ${fibSelected.source.toUpperCase()} · via ${fibSelected.nextHop ?? 'CONNECTED'} · ${fibSelected.linkId}` : 'NO MATCHING ROUTE',
    fibSelected ? (sameSelection ? 'good' : 'warn') : 'bad',
    ['route.selected'],
    [fibCitation, ...(fibSelectedCitation ? [fibSelectedCitation] : [])],
  );
  if (!sameSelection) {
    builder.add('route.convergence', 'RIB_FIB', 'Control-to-data-plane convergence', 'has state', `RIB/FIB DIVERGENCE · RIB ${selected.prefix} ${selected.source.toUpperCase()} via ${selected.nextHop ?? 'CONNECTED'} · FIB ${fibSelected ? `${fibSelected.prefix} ${fibSelected.source.toUpperCase()} via ${fibSelected.nextHop ?? 'CONNECTED'}` : 'NO ROUTE'}`, 'warn', ['route.selected', 'route.fib-selected'], [ribCitation, fibCitation]);
  }

  const forwardingRoute = fibSelected;
  if (!forwardingRoute) {
    builder.add('route.forward', 'FORWARDING', nodeLabel(input.graph, routerId), 'forwards via', 'NO FIB ROUTE', 'bad', ['route.fib-selected'], [fibCitation]);
    appendEventFacts(builder, input, latestMatchingEvent(input, [selected.id, routerId], ['routing', 'topology']), 'route.forward');
    return { topic: 'route', focusLabel: `${nodeLabel(input.graph, routerId)} → ${destinationAddress}`, verdictCode: 'RIB_FIB_DIVERGED', facts: builder.facts, citations: builder.citations };
  }
  const link = fibGraph(input).links.find((entry) => entry.id === forwardingRoute.linkId);
  const linkCitation = builder.cite(`graph:fib-link:${forwardingRoute.linkId}`, 'STATE', 'FIB OUTGOING LINK', `${forwardingRoute.linkId} · ${link?.failed ? 'DOWN' : 'UP'} · cost ${link?.cost ?? '—'}`, [forwardingRoute.linkId]);
  builder.add('route.forward', 'FORWARDING', nodeLabel(input.graph, routerId), 'forwards via', `${forwardingRoute.outgoingInterface} → ${forwardingRoute.nextHop ?? destinationAddress} · ${forwardingRoute.linkId}`, link?.failed ? 'bad' : sameSelection ? 'good' : 'warn', ['route.fib-selected'], [linkCitation]);
  appendEventFacts(builder, input, latestMatchingEvent(input, [selected.id, forwardingRoute.id, forwardingRoute.linkId, routerId], ['routing', 'topology']), 'route.forward');
  const verdictCode = !sameSelection ? 'RIB_FIB_DIVERGED' : link?.failed ? 'SELECTED_LINK_DOWN' : 'ROUTE_SELECTED';
  return { topic: 'route', focusLabel: `${nodeLabel(input.graph, routerId)} → ${destinationAddress}`, verdictCode, facts: builder.facts, citations: builder.citations };
}

function adjacencyFacts'''
text = text[:match.start()] + new_route + text[match.end():]
path.write_text(text)

# Strengthen the focused contract so Track L cannot regress RIB and FIB into one truth surface.
replace_once(
    'scripts/builder-explain-contract-check.mjs',
    "assert.ok(route.citations.some((citation) => citation.ref === `state:fib:${routerId}`), 'route explanation must cite the selected router FIB');",
    "assert.ok(route.citations.some((citation) => citation.ref === `state:rib:${routerId}`), 'route explanation must cite the selected router RIB');\nassert.ok(route.citations.some((citation) => citation.ref === `state:fib:${routerId}`), 'route explanation must independently cite the selected router FIB');\nassert.ok(route.facts.some((fact) => fact.id === 'route.fib-selected'), 'route explanation must explicitly project the forwarding-table selection after the RIB decision');",
)
