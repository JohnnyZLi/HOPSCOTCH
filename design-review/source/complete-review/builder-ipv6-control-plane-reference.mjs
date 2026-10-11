import { createDefaultBuilderAddressing } from '/workspace/scratch/8f1a24ac8c73/hopscotch/src/builder/addressing.ts';
import { createDefaultBuilderLinkProfiles, updateBuilderLinkProfile } from '/workspace/scratch/8f1a24ac8c73/hopscotch/src/builder/link-characteristics.ts';
import { cloneBuilderGraph, defaultBuilderGraph } from '/workspace/scratch/8f1a24ac8c73/hopscotch/src/builder/model.ts';
import {
  createDefaultBuilderIpv6Config,
  setBuilderIpv6RaRouterEnabled,
  setBuilderOspfv3Everywhere,
  traceBuilderIpv6Forwarding,
} from '/workspace/scratch/8f1a24ac8c73/hopscotch/src/builder/ipv6.ts';
import {
  checkBuilderIpv6Pmtu,
  createBuilderIpv6ControlState,
  resolveBuilderIpv6TraceNeighbors,
  runBuilderIpv6RouterSolicitation,
} from '/workspace/scratch/8f1a24ac8c73/hopscotch/src/builder/ipv6-control-plane.ts';

const graph = cloneBuilderGraph(defaultBuilderGraph);
const ipv4 = createDefaultBuilderAddressing(graph);
let ipv6 = createDefaultBuilderIpv6Config(graph, ipv4);
let control = createBuilderIpv6ControlState();

ipv6 = setBuilderIpv6RaRouterEnabled(graph, ipv4, ipv6, 'edge', true);
const ra = runBuilderIpv6RouterSolicitation(graph, ipv4, ipv6, 'client', control);









ipv6 = setBuilderOspfv3Everywhere(graph, ipv4, ra.config, true);
control = ra.state;

const trace = traceBuilderIpv6Forwarding(graph, ipv6, 'client', 'app');



const firstNd = resolveBuilderIpv6TraceNeighbors(graph, ipv6, trace, control, control.clock + 1);








const secondNd=resolveBuilderIpv6TraceNeighbors(graph,ipv6,trace,firstNd.state,firstNd.state.clock+1);
export default {graph,ipv4,ipv6,ra,trace,firstNd,secondNd};

