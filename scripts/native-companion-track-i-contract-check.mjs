import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { projectNativePublicCorrelation, nativeCorrelationTarget } from '../src/measurement/nativeCorrelation.ts';
import { projectMeasuredSnapshot } from '../src/measurement/state.ts';

const startedAt='2026-08-19T07:00:00.000Z',completedAt='2026-08-19T07:00:10.000Z';
const target={kind:'hostname',value:'example.com'};
const fact=(id,category,subject,value,unit=null,factTarget=target)=>({id,provenance:'LOCAL MEASURED',category,subject,availability:'available',observedAt:completedAt,target:factTarget,value,unit,note:'Track I bounded local fixture.'});
const measured=projectMeasuredSnapshot({
  schema:'hopscotch.native-measurement',version:1,provenance:'LOCAL MEASURED',generatedAt:'2026-08-19T07:00:11.000Z',
  source:{adapter:'network-diagnostics-v2',adapterVersion:'2.0',platform:'macos',tool:'Network Diagnostics Suite',toolVersion:'1.0'},
  capture:{startedAt,completedAt},scope:{vantage:'local-host',completeness:'bounded',globalComplete:false,target,limitations:['Local host measurement only.']},warnings:[],facts:[
    fact('selected-interface-source-address','interface','selected interface source address','192.168.1.10',null,{kind:'interface',value:'en0'}),
    fact('deep-interface-0-en0-dnsservers','interface','en0 DNS server addresses',['192.168.1.1','1.1.1.1'],null,{kind:'interface',value:'en0'}),
    fact('route-0-default','route','route 0.0.0.0/0 is default',true,null,{kind:'prefix',value:'0.0.0.0/0'}),
    fact('route-0-gateway','route','route 0.0.0.0/0 gateway','192.168.1.1',null,{kind:'prefix',value:'0.0.0.0/0'}),
    fact('dns-1','dns','resolver DNS latency',18,'ms'),
    fact('icmp-1','icmp','target mean latency',24,'ms'),
    fact('trace-hop-1-address','traceroute','traceroute hop 1 address','192.168.1.1'),
    fact('trace-hop-2-address','traceroute','traceroute hop 2 address','100.64.0.1'),
    fact('transport-1','transport','HTTPS TCP connect duration',31,'ms'),
  ],
});

assert.equal(nativeCorrelationTarget(measured),'example.com');
const evidence={
  schema:'hopscotch.internet-evidence',version:1,generatedAt:'2026-08-19T07:00:12.000Z',
  edge:{provenance:'EDGE OBSERVED',availability:'available',asn:13335,organization:'Cloudflare',colo:'SJC',country:'US',region:'California',city:'San Jose',transportRttMs:12,transport:'QUIC',observedAt:'2026-08-19T07:00:12.000Z',note:'Independent edge observation.'},
  destination:{provenance:'INFERRED',availability:'available',hostname:'example.com',addresses:['93.184.216.34'],selectedAddress:'93.184.216.34',note:'DNS-derived destination context, not path measurement.'},
  routing:{provenance:'PUBLIC COLLECTOR',availability:'available',prefix:'93.184.216.0/24',originAsns:[64496],note:'Public collector routing context.'},
  collectorPaths:[{provenance:'PUBLIC COLLECTOR',availability:'available',sourceId:'rrc00',targetPrefix:'93.184.216.0/24',asPath:[64500,64496],note:'Independent RIS vantage.'}],
  bridge:{provenance:'INFERRED',availability:'available',sourceAsn:13335,destinationOriginAsns:[64496],note:'No continuous path observed.'},warnings:[],
};
const infrastructure={schema:'hopscotch.internet-infrastructure',version:1,provenance:'PUBLIC DATA',source:'PeeringDB',generatedAt:'2026-08-19T07:00:12.000Z',facilities:[
  {provenance:'PUBLIC DATA',id:1,name:'San Jose Facility',city:'San Jose',country:'US',latitude:37.3,longitude:-121.9,networkCount:20,exchangeCount:2},
  {provenance:'PUBLIC DATA',id:2,name:'Los Angeles Facility',city:'Los Angeles',country:'US',latitude:34.0,longitude:-118.2,networkCount:30,exchangeCount:3},
],note:'Public facility context only.'};
const projection=projectNativePublicCorrelation(measured,evidence,infrastructure);
assert.equal(projection.schema,'hopscotch.native-public-correlation');
assert.equal(projection.local.sourceAddress,'192.168.1.10');
assert.equal(projection.local.defaultGateway,'192.168.1.1');
assert.deepEqual(projection.local.dnsServers,['192.168.1.1','1.1.1.1']);
assert.deepEqual(projection.local.tracerouteHops,['192.168.1.1','100.64.0.1']);
assert.ok(projection.local.interfaceFacts>0&&projection.local.routeFacts>0&&projection.local.dnsFacts>0&&projection.local.icmpFacts>0&&projection.local.tracerouteFacts>0&&projection.local.transportFacts>0,'all Track I local measurement domains must remain surfaced');
const byId=new Map(projection.stages.map((stage)=>[stage.id,stage]));
assert.equal(byId.get('local-host').provenance,'LOCAL MEASURED');
assert.equal(byId.get('local-gateway').provenance,'LOCAL MEASURED');
assert.equal(byId.get('measured-hop-1').provenance,'LOCAL MEASURED');
assert.equal(byId.get('measurement-boundary').provenance,'INFERRED');
assert.equal(byId.get('edge-observation').provenance,'EDGE OBSERVED');
assert.equal(byId.get('public-routing').provenance,'PUBLIC COLLECTOR');
assert.equal(byId.get('facility-1').provenance,'PUBLIC DATA');
assert.equal(byId.get('destination').provenance,'INFERRED');
assert.match(byId.get('facility-1').detail,/not evidence that this traffic traversed/i);
assert.doesNotMatch(JSON.stringify(projection.stages.filter((stage)=>stage.id.startsWith('measured-hop'))),/AS13335|San Jose Facility/,'measured hops must not silently acquire AS/facility claims from independent public evidence');

const noPublic=projectNativePublicCorrelation(measured,null,null);assert.equal(noPublic.stages.at(-1).id,'public-context-unavailable');assert.equal(noPublic.stages.at(-1).provenance,'INFERRED');
const bridge=readFileSync('src/measurement/loopbackBridge.ts','utf8'),workspace=readFileSync('src/MeasuredNetworkWorkspace.tsx','utf8'),panel=readFileSync('src/MeasuredNativeCorrelationPanel.tsx','utf8'),native=readFileSync('src/measurement/native.ts','utf8');
assert.match(bridge,/localhost, 127\.0\.0\.0\/8, or ::1/);assert.match(bridge,/credentials: 'omit'/);assert.match(bridge,/capabilities: \['report-v2'\]/,'Track I must consume the established report-v2 companion contract rather than require a broader local command API');
assert.match(native,/'interface' \| 'route' \| 'dns' \| 'icmp' \| 'traceroute' \| 'transport'/);
assert.match(workspace,/MeasuredNativeCorrelationPanel/);assert.match(workspace,/lazy\(/,'Track I correlation UI must remain lazy');
assert.match(panel,/CORRELATE PUBLIC CONTEXT/);assert.match(panel,/No credentials\. No LAN scanning or discovery\. No hidden polling/);assert.doesNotMatch(panel,/useEffect\s*\(/,'public correlation must not start through an automatic effect');
assert.match(panel,/fetchNativePublicContext\(projection\.targetHostname\)/,'public context should load only from the explicit correlate action');
console.log('Track I native companion contract passed: all required LOCAL MEASURED domains surface through the existing report-v2 bridge, local/public evidence stays provenance-separated, the local→gateway→measured-hop→public→destination lane contains an explicit observation boundary, facility context does not imply traversal, and no credentials/scanning/background collection were introduced.');
