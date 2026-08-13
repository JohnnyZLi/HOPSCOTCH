import assert from 'node:assert/strict';
import { defaultBuilderGraph } from '../src/builder/model.ts';
import { createDefaultBuilderAddressing } from '../src/builder/addressing.ts';
import { createDefaultBuilderRoutingConfig, setBuilderOspfEverywhere } from '../src/builder/routing.ts';
import { createDefaultBuilderLinkProfiles, updateBuilderLinkProfile, builderPathCharacteristics } from '../src/builder/link-characteristics.ts';
import { createDefaultBuilderAclConfig, traceBuilderPolicy, upsertBuilderAclRule } from '../src/builder/acl.ts';
import { runBuilderProbe } from '../src/builder/probes.ts';

const addressing=createDefaultBuilderAddressing(defaultBuilderGraph);
const routing=setBuilderOspfEverywhere(defaultBuilderGraph,addressing,createDefaultBuilderRoutingConfig(),true);
let profiles=createDefaultBuilderLinkProfiles(defaultBuilderGraph);
profiles=updateBuilderLinkProfile(defaultBuilderGraph,profiles,'client-edge',{latencyMs:7,jitterMs:1,bandwidthMbps:100,lossPercent:0,mtuBytes:1500,queuePackets:64});
profiles=updateBuilderLinkProfile(defaultBuilderGraph,profiles,'edge-r1',{latencyMs:12,jitterMs:2,bandwidthMbps:50,lossPercent:0,mtuBytes:1400,queuePackets:32});
const path=builderPathCharacteristics(profiles,['client-edge','edge-r1']);
assert.equal(path.oneWayLatencyMs,19);
assert.equal(path.jitterMs,3);
assert.equal(path.bottleneckMbps,50);
assert.equal(path.pathMtuBytes,1400);

let acl=createDefaultBuilderAclConfig();
const permitted=traceBuilderPolicy(defaultBuilderGraph,addressing,routing,acl,'client','app','icmp');
assert.equal(permitted.forwarding.reachable,true);
assert.equal(permitted.permitted,true);
const ping=runBuilderProbe(defaultBuilderGraph,addressing,routing,'ping','client','app',1,profiles,acl);
assert.equal(ping.success,true);
assert.ok((ping.attempts[0].simulatedRttMs??0)>0);
assert.equal(ping.attempts[0].pathMtuBytes,1400);

acl=upsertBuilderAclRule(defaultBuilderGraph,acl,{routerId:'edge',order:10,action:'deny',protocol:'icmp',sourcePrefix:'0.0.0.0/0',destinationPrefix:'0.0.0.0/0',destinationPort:null,description:'Block diagnostic ICMP'});
const denied=traceBuilderPolicy(defaultBuilderGraph,addressing,routing,acl,'client','app','icmp');
assert.equal(denied.permitted,false);
assert.equal(denied.deniedAtRouterId,'edge');
const blockedPing=runBuilderProbe(defaultBuilderGraph,addressing,routing,'ping','client','app',2,profiles,acl);
assert.equal(blockedPing.success,false);
assert.match(blockedPing.attempts[0].detail,/denied|ACL|policy/i);

let serviceAcl=createDefaultBuilderAclConfig();
serviceAcl=upsertBuilderAclRule(defaultBuilderGraph,serviceAcl,{routerId:'edge',order:10,action:'deny',protocol:'tcp',sourcePrefix:'0.0.0.0/0',destinationPrefix:'0.0.0.0/0',destinationPort:22,description:'Block SSH'});
assert.equal(traceBuilderPolicy(defaultBuilderGraph,addressing,routing,serviceAcl,'client','app','tcp',22).permitted,false);
assert.equal(traceBuilderPolicy(defaultBuilderGraph,addressing,routing,serviceAcl,'client','app','tcp',443).permitted,true);

console.log('Builder link/policy contract passed: independent physical metrics, simulated probe RTT/path MTU, ordered ACL decisions, and protocol/port-specific denial.');
