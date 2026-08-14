import assert from 'node:assert/strict';
import { createDefaultBuilderAddressing } from '../src/builder/addressing.ts';
import { cloneBuilderGraph, defaultBuilderGraph } from '../src/builder/model.ts';
import {
  builderBgpAsnForRouter,
  builderBgpState,
  createDefaultBuilderBgpConfig,
  projectBuilderBgpToAsGraph,
  setBuilderBgpRouterAsn,
  updateBuilderBgpSession,
  upsertBuilderBgpOrigin,
  upsertBuilderBgpPolicy,
  upsertBuilderBgpSession,
} from '../src/builder/bgp.ts';
import { createDefaultBuilderRoutingConfig, routeTableForBuilderRouter, traceBuilderForwarding } from '../src/builder/routing.ts';

const graph=cloneBuilderGraph(defaultBuilderGraph), addressing=createDefaultBuilderAddressing(graph);
let bgp=createDefaultBuilderBgpConfig();
// EDGE is customer AS64496, R1/R2 share AS64500 (iBGP), CORE is provider/content AS65538.
bgp=setBuilderBgpRouterAsn(graph,bgp,'edge',64496);bgp=setBuilderBgpRouterAsn(graph,bgp,'r1',64500);bgp=setBuilderBgpRouterAsn(graph,bgp,'r2',64500);bgp=setBuilderBgpRouterAsn(graph,bgp,'core',65538);
bgp=upsertBuilderBgpSession(graph,bgp,'edge-r1','customer-provider');let edgeR1=bgp.sessions.find((entry)=>entry.linkId==='edge-r1');assert.ok(edgeR1);bgp=updateBuilderBgpSession(graph,bgp,edgeR1.id,{relationship:'customer-provider',customerRouterId:'edge'});
bgp=upsertBuilderBgpSession(graph,bgp,'r1-r2','peer');const ibgp=bgp.sessions.find((entry)=>entry.linkId==='r1-r2');assert.ok(ibgp);assert.equal(builderBgpAsnForRouter(graph,bgp,'r1'),builderBgpAsnForRouter(graph,bgp,'r2'));bgp=updateBuilderBgpSession(graph,bgp,ibgp.id,{nextHopSelf:true});
bgp=upsertBuilderBgpSession(graph,bgp,'r2-core','customer-provider');let r2core=bgp.sessions.find((entry)=>entry.linkId==='r2-core');assert.ok(r2core);bgp=updateBuilderBgpSession(graph,bgp,r2core.id,{relationship:'customer-provider',customerRouterId:'r2'});
const appPrefix=addressing.segments['core-app'].cidr;bgp=upsertBuilderBgpOrigin(graph,bgp,{routerId:'core',prefix:appPrefix,med:10,communities:['65538:100'],description:'APP service'});
let state=builderBgpState(graph,addressing,bgp);assert.equal(state.sessions.filter((entry)=>entry.state==='ESTABLISHED').length,3);const edgeRoute=state.bestRoutes.find((route)=>route.routerId==='edge'&&route.prefix===appPrefix);assert.ok(edgeRoute);assert.deepEqual(edgeRoute.asPath,[64500,65538]);assert.equal(edgeRoute.learnedVia,'ebgp');
let routing={...createDefaultBuilderRoutingConfig(),bgp};const edgeFib=routeTableForBuilderRouter(graph,addressing,routing,'edge').find((route)=>route.source==='bgp'&&route.prefix===appPrefix);assert.ok(edgeFib);assert.equal(edgeFib.administrativeDistance,20);assert.equal(traceBuilderForwarding(graph,addressing,routing,'edge','app').reachable,true);
// Import policy changes path attributes without changing physical reachability.
bgp=upsertBuilderBgpPolicy(graph,bgp,{routerId:'edge',direction:'import',sessionId:edgeR1.id,order:10,action:'permit',prefix:appPrefix,setLocalPref:250,setMed:null,addCommunity:'64496:900',allowRelationshipLeak:false,description:'Prefer app route'});state=builderBgpState(graph,addressing,bgp);assert.equal(state.bestRoutes.find((route)=>route.routerId==='edge'&&route.prefix===appPrefix)?.localPref,250);assert.ok(state.bestRoutes.find((route)=>route.routerId==='edge'&&route.prefix===appPrefix)?.communities.includes('64496:900'));
// Relationship leak is normally blocked; explicit override can surface a provider-learned route to a peer.
const edgeR2Graph=cloneBuilderGraph(graph); // existing topology has EDGE-R2 direct link.
bgp=upsertBuilderBgpSession(edgeR2Graph,bgp,'edge-r2','peer');const edgeR2=bgp.sessions.find((entry)=>entry.linkId==='edge-r2');assert.ok(edgeR2);bgp=updateBuilderBgpSession(edgeR2Graph,bgp,edgeR2.id,{relationship:'peer',allowRelationshipLeak:true});state=builderBgpState(edgeR2Graph,addressing,bgp);assert.ok(state.leakedRouteIds.length>0,'explicit leak override should tag at least one policy anomaly');
// Multi-origin/hijack teaching truth is explicit and remains separate from relationship-leak truth.
bgp=upsertBuilderBgpOrigin(graph,bgp,{routerId:'edge',prefix:appPrefix,med:0,communities:['64496:666'],description:'Competing origin'});state=builderBgpState(edgeR2Graph,addressing,bgp);assert.ok(state.multiOriginPrefixes.includes(appPrefix));
const projection=projectBuilderBgpToAsGraph(edgeR2Graph,bgp,state,'edge','core',appPrefix);assert.ok(projection.graph.nodes.some((node)=>node.asn===64496));assert.ok(projection.graph.relationships.length>=2);assert.ok(projection.selectedPathAsns.length>=1);
// Withdrawal follows session/link failure because state is derived, not cached truth.
const failed=cloneBuilderGraph(graph);failed.links.find((link)=>link.id==='edge-r1').failed=true;state=builderBgpState(failed,addressing,bgp);assert.equal(state.sessions.find((entry)=>entry.linkId==='edge-r1')?.state,'IDLE');
console.log('Builder BGP core contract passed: eBGP/iBGP, best path attrs, RIB/FIB route, policy mutation, multi-origin, leak tagging, projection, and derived withdrawal.');
