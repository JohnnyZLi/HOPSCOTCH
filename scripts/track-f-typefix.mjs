import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';
function edit(path,fn){const before=readFileSync(path,'utf8');const after=fn(before);if(after===before)throw new Error(`No typefix applied to ${path}`);writeFileSync(path,after);}
edit('src/builder/isis.ts',(s)=>s.replace("source: 'connected' | 'static' | 'ospf' | 'bgp' | 'summary';","source: 'connected' | 'static' | 'ospf' | 'bgp' | 'isis' | 'summary';"));
edit('src/builder/routing.ts',(s)=>{
  let n=s.replace("export function selectBuilderRouteWithDecision(entries: readonly BuilderRouteTableEntry[], destinationAddress: string, flowKey: BuilderFlowKey | string | null = null): BuilderRouteSelection {\n  const candidates = builderEcmpRoutesForDestination(entries, destinationAddress).slice(0,Math.max(1,Math.min(16,arguments.length>3?Number(arguments[3])||16:16)));","export function selectBuilderRouteWithDecision(entries: readonly BuilderRouteTableEntry[], destinationAddress: string, flowKey: BuilderFlowKey | string | null = null, maxPaths = 16): BuilderRouteSelection {\n  const candidates = builderEcmpRoutesForDestination(entries, destinationAddress).slice(0,Math.max(1,Math.min(16,Math.round(Number(maxPaths)||16))));");
  n=n.replace("return { ...result, routing: reconcileBuilderRoutingConfig(graph, addressing, { ...result.routing, ospf: { ...result.routing.ospf, areaTypes: routing.ospf.areaTypes ?? {}, redistributions: routing.ospf.redistributions ?? [] } }) };","return { ...result, routing: reconcileBuilderRoutingConfig(graph, addressing, { ...result.routing, ospf: { ...result.routing.ospf, areaTypes: routing.ospf.areaTypes ?? {}, redistributions: routing.ospf.redistributions ?? [] }, policy: cloneBuilderRoutingPolicyConfig(routing.policy) }) };");
  return n;
});
unlinkSync('scripts/track-f-typefix.mjs');
