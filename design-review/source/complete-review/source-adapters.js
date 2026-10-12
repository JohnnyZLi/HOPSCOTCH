// Presentation projections of canonical records. These functions do not write
// to an event, state, byte array, or source clock.
const display = value => value === null || value === undefined ? 'Not available' :
 Array.isArray(value) ? value.map(display).join(' · ') : typeof value === 'object' ? JSON.stringify(value) : String(value);
const words = value => String(value).replaceAll('-', ' ').replace(/(^|\s)\S/g, c => c.toUpperCase());
function stateValues(previous, state, schema) {
 return schema.filter(([key]) => state[key] !== undefined).map(([key, label, format = display]) => {
  const before = previous?.[key], after = state[key], changed = before !== undefined && JSON.stringify(before) !== JSON.stringify(after);
  return {id: 'state-' + key, label, value: changed ? format(before) + ' → ' + format(after) : format(after), changed};
 });
}
const wireKinds = new Set(['dns.query', 'dns.referral', 'dns.answer', 'transport.segment',
 'transport.retransmit', 'tls.message', 'http.control', 'http.request', 'http.response', 'http.data', 'http.retry', 'http.service-unavailable']);
const ready = value => value ? 'Ready' : 'Not ready';
const journeyStateSchema = [['dns', 'Name resolution', words], ['route', 'Forwarding', words],
 ['transport', 'Transport', words], ['tls', 'Protection', words], ['http', 'Application', words]];
function journeyFrames(actual, {hostname = actual[0]?.event.target || 'Not available', requestId = 'journey-request'} = {}) {
 return actual.map(({event: e, state}, index) => {
  const previous = actual[index - 1]?.state, family = e.kind.split('.')[0], wire = wireKinds.has(e.kind);
  let fields, objectTitle, assembly = null;
  if (family === 'dns') {
   objectTitle = {'dns.query':'DNS question', 'dns.referral':'DNS referral', 'dns.answer':'DNS answer'}[e.kind] || 'Resolver state';
   fields = wire ? [
    {id:'journey-name', label:'Journey name', value:hostname},
    ...(e.kind === 'dns.query' ? [{id:'query-mode', label:'Resolution request', value:words(e.phase)}] : []),
    ...(e.kind === 'dns.referral' ? [{id:'authority', label:'Referral from', value:e.actor}, {id:'delegation', label:'Namespace step', value:words(e.phase)}] : []),
    ...(e.kind === 'dns.answer' ? [{id:'address', label:'Resolved address', value:state.resolvedAddress}] : [])
   ] : stateValues(previous, state, [['dns','Cache / resolver state',words], ['resolvedAddress','Resolved address'], ['dnsTtlSeconds','TTL remaining',v=>v===null?'No cached TTL':v+' s']]);
  } else if (e.kind.startsWith('packet.')) {
   objectTitle = e.kind === 'packet.assembly' ? words(state.packetAssemblyStage) + ' assembly' : e.kind === 'packet.inspect' ? 'Packet inspection' : 'Forwarding operation';
   const stage=state.packetAssemblyStage,quic=state.transportProfile==='quic-h3';
   fields = e.kind === 'packet.assembly' ? ({
    application:[{id:'request',label:'Application meaning',value:'GET / · '+hostname}],
    security:[{id:'protection',label:'Protection state',value:words(state.tls)},{id:'observation',label:'Wire observation',value:'Application meaning opaque'}],
    transport:[{id:'carrier',label:'Transport envelope',value:quic?'QUIC / UDP':'TCP'},{id:'connection',label:'Connection',value:words(state.transport)}],
    network:[{id:'continuity',label:'Routed destination',value:state.resolvedAddress},{id:'route',label:'Forwarding state',value:words(state.route)}],
    link:[{id:'local-envelope',label:'Ethernet scope',value:'This hop only'},{id:'frame-context',label:'Recipient role',value:e.target}],
    collapsed:[{id:'frame-context',label:'Ready at',value:e.target},{id:'protection',label:'Payload observation',value:'Opaque protected bytes'}]
   }[stage] || []) : [{id:'forwarding',label:'Source operation',value:e.title},
    {id:'continuity',label:'Routed destination',value:state.resolvedAddress},
    {id:'transit',label:'Forwarding stage',value:words(state.packetTransitStage)}];
   assembly = {identity:requestId, stage:state.packetAssemblyStage, transit:state.packetTransitStage,
    hostname, destination:state.resolvedAddress, transport:state.transportProfile, protection:state.tls};
  } else if (family === 'transport') {
   objectTitle = wire ? e.protocol + ' · ' + words(e.phase) : 'Transport state';
   fields = stateValues(previous,state,[['transport','Connection',words],['impairmentState','Delivery state',words]]);
   if(wire) fields.unshift({id:'message',label:'Source message',value:words(e.phase)});
  } else if (family === 'tls') {
   objectTitle = wire ? e.title : 'TLS state';
   fields = stateValues(previous,state,[['tls','Protection',words]]);
   fields.push({id:'identity',label:'Requested identity',value:hostname});
   if(wire) fields.unshift({id:'message',label:'Handshake message',value:e.title});
  } else if (family === 'http') {
   objectTitle = wire ? e.protocol + ' · ' + words(e.phase) : 'HTTP state';
   fields = stateValues(previous,state,[['http','Application state',words],['transport','Carrier',words],['tls','Protection',words]]);
   if(['http.request','http.retry'].includes(e.kind)) fields.unshift({id:'request',label:'Application request',value:'GET / · '+hostname});
  } else if (family === 'route' || family === 'internet') {
   objectTitle = family === 'route' ? 'Forwarding decision' : e.protocol;
   fields = stateValues(previous,state,[['route','Route state',words],['resolvedAddress','Destination'],['policy','Policy state',words]]);
   if(e.kind==='route.gateway')fields.push({id:'next-hop',label:'Selected next-hop role',value:e.target});
   if(e.kind==='internet.physical-context') fields = [{id:'infrastructure',label:'Context',value:e.actor},{id:'region',label:'Target context',value:e.target},{id:'provenance',label:'Evidence boundary',value:e.provenance}];
  } else if (family === 'server') {
   objectTitle = 'Service state';fields=stateValues(previous,state,[['server','Service',words],['http','Request',words]]);
  } else if (e.kind === 'intent.accepted') {
   objectTitle = 'Application intent';fields=[{id:'hostname',label:'Requested hostname',value:hostname},{id:'resolution',label:'Next dependency',value:'Name resolution'}];
  } else {
   objectTitle = e.kind === 'journey.complete' ? 'Application outcome' : e.kind === 'journey.failed' ? 'Request failed' : 'Retained request state';
   fields=stateValues(e.kind==='journey.complete'?null:previous,state,[['responseReady','Response',ready],['journeyComplete','Journey complete',String],['journeyFailed','Journey failed',String],['failureReason','Failure reason']]);
   if(e.kind==='transfer.complete')fields=stateValues(previous,state,[['transport','Byte delivery',words],['http','Application transfer',words]]);
   if(e.kind==='camera.pullback')fields=stateValues(null,state,journeyStateSchema);
  }
  for(const [key,label] of [['transportMetrics','Transport measurements'],['congestionMetrics','Congestion'],['routeMetrics','Routing'],['serverMetrics','Retry state'],['policyMetrics','Policy']]) {
   const metrics=state[key];if(!metrics||JSON.stringify(metrics)===JSON.stringify(previous?.[key]))continue;
   for(const [name,value]of Object.entries(metrics)) fields.push({id:key+'-'+name,label:label+' · '+words(name.replace(/([a-z])([A-Z])/g,'$1 $2')),value:display(value)});
  }
  fields=fields.map(f=>({...f,value:display(f.value)}));
  const changed=fields.filter(f=>f.changed);
  return {id:e.id,at:e.atMs,title:e.title,summary:e.summary,detail:e.detail,kind:assembly?'journey-assembly':e.kind,
   local:!wire,physical:wire||Boolean(assembly),from:e.actor,to:e.target||e.actor,protocol:e.protocol,
   objectTitle,fields,readIds:(changed.length?changed:fields).map(f=>f.id),assembly,
   records:[...stateValues(null,state,journeyStateSchema),{label:'Source event',value:e.id},{label:'Source time',value:e.atMs+' ms'},
    {label:'Provenance',value:e.provenance},{label:'Field boundary',value:wire?'Source semantics · no unprovided wire bytes or header numbers':'Canonical local state'}],state,event:e};
 });
}
function dnsFrames(actual) {
 return actual.map(({event:e,state},index)=>{
  const local=e.phase==='complete'||e.from===e.to||e.from==='local'||e.kind.startsWith('cache');
  const previous=actual[index-1]?.state;
  const records=(e.records||[]).flatMap((r,i)=>[
   {id:'rr-'+i+'-owner',label:'Record name',value:r.owner},{id:'rr-'+i+'-type',label:'Record type',value:r.type},
   {id:'rr-'+i+'-value',label:r.type==='NS'?'Next authority':'Record value',value:r.value},
   {id:'rr-'+i+'-ttl',label:'Record TTL',value:r.ttl+' s'}]);
  const fields=local?stateValues(previous,state,[['cacheState','Cache',words],['cacheTtlSeconds','TTL remaining',v=>v===null?'No cached TTL':v+' s'],['answer','Retained answer',v=>v?v.owner+' '+v.type+' '+v.value:'Not available']]):
   e.kind==='query'?[{id:'qname',label:'Question name',value:e.qname},{id:'qtype',label:'Question type',value:e.qtype},
    {id:'rd',label:'Recursion desired',value:e.recursionDesired?'1 · recursive request':'0 · iterative request'}]:records;
  return {id:e.id,at:e.atMs,title:e.title,summary:e.summary,detail:e.detail,kind:e.kind,local,from:e.from,to:e.to,protocol:'dns',
   objectTitle:local?'Resolver state':e.kind==='query'?'DNS question':e.kind==='referral'?'DNS referral':'DNS answer',
   fields:fields.map(f=>({...f,value:display(f.value)})),readIds:fields.map(f=>f.id),
   records:[{label:'Active delegation',value:state.activeDelegation},{label:'Cache',value:state.cacheState},
    {label:'TTL remaining',value:state.cacheTtlSeconds===null?'No cached TTL':state.cacheTtlSeconds+' s'},
    {label:'Retained answer',value:state.answer?state.answer.value:'Not available'}],state,event:e};
 });
}
function providerFrames(p) {
 const innerFields=Object.entries(p.packet.inner).map(([key,value])=>({id:'inner-'+key,label:'Inner '+words(key),value:key==='bytes'?value+' B':display(value)}));
 const source=[
  {id:'inner',title:'The inner packet keeps its identity',summary:'These inner addresses and length persist while separate outer pieces change.',operation:'inner',envelope:null,state:p.packet},
  {id:'encapsulated',title:'A GRE envelope attaches',summary:'The '+p.gre.encapsulationOverheadBytes+' B outer envelope seats around the same '+p.packet.inner.bytes+' B inner packet.',operation:'attach',envelope:p.packet.outer,state:p.packet},
  ...p.lsp.operations.map((op,index)=>({id:'mpls-'+index,title:op.routerId.toUpperCase()+' · '+op.operation+' label',
   summary:'Independent MPLS projection: label '+(op.inLabel??'none')+' → '+(op.outLabel??'none')+' for '+op.fecPrefix+'. Its payload remains the same; payload bytes are not supplied.',
   operation:op.operation.toLowerCase(),labelOperation:op,envelope:null,state:p.lsp})),
  {id:'mtu',title:'Too large for the overlay',summary:p.tooLarge.reason,operation:'boundary',envelope:p.packet.outer,state:p.tooLarge,
   outcome:[{label:'Requested inner length',value:p.tooLarge.inner.bytes+' B'},{label:'Effective overlay MTU',value:p.tooLarge.effectiveOverlayMtuBytes+' B'},{label:'Outcome',value:p.tooLarge.state}]},
  {id:'failed-underlay',title:'The overlay depends on its underlay',summary:p.failedGre.reason,operation:'boundary',envelope:p.packet.outer,state:p.failedGre,
   outcome:[{label:'Underlay reachable',value:display(p.failedGre.underlayReachable)},{label:'Overlay reachable',value:display(p.failedGre.overlayReachable)},{label:'Tunnel state',value:p.failedGre.state}]}
 ];
 return source.map(f=>({...f,at:null,identity:f.labelOperation?'mpls-payload':'provider-inner',kind:'provider-operation',local:true,physical:true,from:'Ingress',to:'Egress',protocol:'ipv4',
  objectTitle:f.labelOperation?'MPLS payload · symbolic':'Inner IPv4 packet',fields:f.labelOperation?[{id:'fec',label:'Forwarding class',value:f.labelOperation.fecPrefix},{id:'payload',label:'Payload bytes',value:'Not supplied by the LSP projection'}]:innerFields,readIds:f.operation==='inner'?innerFields.map(f=>f.id):[],records:[
   {label:'Projection',value:'Independent GRE and MPLS contract projections · no source clock or raw bytes'},
   {label:'Underlay',value:p.gre.underlayLinkIds.join(' → ')},
   ...(f.labelOperation?Object.entries(f.labelOperation).map(([label,value])=>({label:words(label),value:display(value)})):[]),...(f.outcome||[])]}));
}
export { journeyFrames, dnsFrames, providerFrames };
