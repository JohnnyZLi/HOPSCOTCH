(()=>{
'use strict';
const root=document.getElementById('__ROOT__'),q=s=>root.querySelector(s),data=root.reviewData,motion=root.motionPlanner,pacing=root.pacing,transfer=root.valueTransfer;
const {clamp,ease,mix,makePlan,samplePlan}=motion,stage=q('.rv-stage'),dark=matchMedia('(prefers-color-scheme: dark)'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
const tuning=Object.freeze({construct:620,morph:620,release:650,travelSpeed:.40,minTravel:600,maxTravel:1400,state:650,minimumExposure:900});
const memories=new Map(),liveCanvas=document.createElement('canvas'),lensCanvas=document.createElement('canvas');liveCanvas.setAttribute('aria-hidden','true');lensCanvas.setAttribute('aria-hidden','true');
const envelopeCanvas=document.createElement('canvas');envelopeCanvas.setAttribute('aria-hidden','true');q('.rv-envelope-header').prepend(envelopeCanvas);
// Keep the live scene, its destinations and playback in one composition.
// Complete field/state evidence is a deliberate disclosure below that scene.
const secondary=node('section','rv-state-secondary'),composition=node('section','rv-composition'),dock=node('section','rv-retained-dock'),details=node('details','rv-scene-details'),fullFields=node('dl','rv-facts rv-full-fields');
secondary.append(q('.rv-state-records'),q('.rv-buffer'));q('.rv-main').insertBefore(composition,q('.rv-motion-primary'));composition.append(q('.rv-motion-primary'),q('.rv-network-primary'),q('.rv-comparison-primary'),q('.rv-console'));stage.insertBefore(dock,q('.rv-path'));details.append(node('summary','','Full fields and retained state'),fullFields,secondary);q('.rv-main').insertBefore(details,q('.rv-byte-details'));
const settingLabels=[...q('.rv-controls').children].filter(n=>n.matches('label'));const settings=node('details','rv-playback-settings');settings.append(node('summary','','Playback settings'));for(const label of settingLabels)settings.append(label);q('.rv-console').append(settings);
const explanation=node('details','rv-explanation');explanation.append(node('summary','','Explanation'),q('.rv-caption-detail'));q('.rv-console').append(explanation);
function bounded(){return ['tcp','tls'].includes(sceneId);}
function buildDock(){
 dock.replaceChildren();dock.hidden=!bounded();
 if(sceneId==='tcp'){
  for(const [label,cls,value]of [['Highest ACK at sender','rv-ack','0'],['Next expected byte','rv-expected','1001']]){const fact=node('div','rv-fact');fact.append(node('dt','',label),node('dd',cls,value));dock.append(fact);}
 }else if(sceneId==='tls'){for(const [label,cls]of [['Certificate','rv-tls-certificate'],['Application channel','rv-tls-channel']]){const fact=node('div','rv-fact');fact.append(node('dt','',label),node('dd',cls,cls==='rv-tls-certificate'?'Unchecked':'Not ready'));dock.append(fact);}}
}

let sceneId='tcp',frames=[],actors=[],plan=null,clock=0,playing=false,job=0,last=0,layoutJob=0,layoutKey='',captionKey='',lensKey='',recordKey='',activeActor=-1,variant=0,dnsMode='miss',byte=-1,disposed=false,alignAfterResize=false;
const transferView=transfer.makeView(q('.rv-transfer'),q('.rv-transfer-value'),q('.rv-transfer-note'));
function node(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=String(text);return n;}
function titleCase(value){return String(value||'').toLowerCase().replace(/(^|[\s-])\p{L}/gu,m=>m.toUpperCase());}
function facts(before,after){const a=new Map((before||[]).map(x=>[x.label,x.value]));return (after||[]).filter(x=>String(a.get(x.label))!==String(x.value)).map(x=>({text:x.label,value:x.value}));}
function modelFrames(id){return data.referenceModels.find(m=>m.id===id)?.frames||[];}
// A local operation exposes its actual state changes. Wire-message fields stay
// on wire messages; formatted values never change the canonical source state.
function stateFields(previous,state,schema){
 return schema.filter(([key])=>state[key]!==undefined&&state[key]!==null).map(([key,label,format=String])=>{
  const changed=previous?.[key]!==undefined&&JSON.stringify(previous[key])!==JSON.stringify(state[key]);
  return {id:'state-'+key,label,value:changed?format(previous[key])+' → '+format(state[key]):format(state[key]),changed};
 });
}
function tlsOperation(e,state,previous){
 if(e.direction!=='local')return null;
 const ready=v=>v?'Ready':'Not ready',classes=v=>v.join(' · '),modes={
  'certificate-validation':[['certificateState','Certificate state',titleCase],['negotiatedVersion','Negotiated version'],['negotiatedAlpn','Application protocol']],
  'handshake-keys':[['activeKeys','Active secret classes · symbolic',classes],['negotiatedGroup','Key exchange group'],['applicationReady','Application traffic',ready]],
  'application-keys':[['activeKeys','Active secret classes · symbolic',classes],['applicationReady','Application traffic',ready],['negotiatedAlpn','Application protocol']],
  complete:[['applicationReady','Application traffic',ready],['certificateState','Server certificate',titleCase],['negotiatedAlpn','Application protocol']]
 };
 const fields=stateFields(e.phase==='complete'?null:previous,state,modes[e.phase]||[['phaseLabel','Source outcome']]);
 const changed=fields.filter(f=>f.changed);
 return {fields,readIds:(changed.length?changed:fields).map(f=>f.id),records:[
  {label:'Negotiated version',value:state.negotiatedVersion||'Not negotiated'},
  {label:'Negotiated cipher',value:state.negotiatedCipher||'Not negotiated'},
  {label:'Key exchange group',value:state.negotiatedGroup||'Not negotiated'},
  {label:'Application protocol',value:state.negotiatedAlpn||'Not negotiated'},
  {label:'Active secret classes · symbolic',value:classes(state.activeKeys)},
  {label:'Transcript messages',value:state.transcript.join(' → ')}
 ]};
}
function sourceFrameAdapter(id){
 if(id==='tcp')return data.tcp.frames.map(({event:e,state},i)=>{
  const local=e.direction==='local',previous=data.tcp.frames[i-1]?.state;
  const fields=local?stateFields(previous,state,[['cwndMss','Congestion window',v=>v+' MSS'],['ssthreshMss','Slow-start threshold',v=>v+' MSS'],['duplicateAcks','Duplicate ACKs'],['phase','Recovery phase',titleCase]]):[{id:'seq',label:'Sequence',value:e.seq??'Not active'},{id:'ack',label:'Acknowledgment',value:e.ack??'Not active'},{id:'flags',label:'Flags',value:e.flags},{id:'length',label:'Data length',value:(e.length||0)+' B'}];
  return {id:e.id,at:e.atMs,title:e.title,summary:e.summary,detail:e.detail,kind:e.kind,local,lost:e.kind==='data.loss',from:e.direction==='server-to-client'?'Server':'Client',to:e.direction==='server-to-client'?'Client':'Server',protocol:'tcp',objectTitle:e.flags||'Congestion control',fields,readIds:local?fields.filter(f=>f.changed).map(f=>f.id):e.ack===undefined?['seq']:e.length?['seq','length']:['ack'],records:[{label:'Congestion window',value:state.cwndMss+' MSS'},{label:'Slow-start threshold',value:state.ssthreshMss+' MSS'},{label:'Duplicate ACKs',value:state.duplicateAcks},{label:'Next expected byte',value:state.expectedAck},{label:'Highest ACK at sender',value:state.highestAck}],state,event:e};
 });
 if(id==='packet'){
  const packet=data.packetVariants[variant];return packet.segments.map((segment,i)=>({id:segment.id,identity:'frame-'+packet.config.family+'-'+packet.config.transport,at:null,title:segment.label+' · exact anatomy',summary:'Bytes '+segment.offset+'–'+(segment.offset+segment.length-1)+' remain part of the same '+packet.frameBytes+'-byte source frame. FCS is absent from these model bytes.',detail:'SIMULATED · field values and checksum bytes come from buildPacket. Layer opening is a presentation operation.',kind:'anatomy',from:'Sender',to:'Receiver',protocol:segment.id==='network'?packet.config.family:segment.id==='ethernet'?'ethernet':segment.id==='payload'?'payload':packet.config.transport,objectTitle:segment.label,fields:segment.fields.map(f=>({...f,value:String(f.value)})),readIds:segment.fields.map(f=>f.id),records:[{label:'Frame length',value:packet.frameBytes+' B'},{label:'Network length',value:packet.networkBytes+' B'},{label:'Selected layer',value:segment.label},{label:'Exact byte range',value:segment.offset+' + '+segment.length+' B'}],bytes:packet.bytes,segment,state:packet}));
 }
 if(id==='packetOps'){
  const specs=[{key:'assemble',source:0,title:'Separate pieces, precisely seated.',summary:'The Ethernet header seats against the IP packet. The FCS slot is explicitly unavailable because the source model does not supply it.',operation:'attach'},
   {key:'inspect',source:0,title:'Read before changing.',summary:'The reader follows the actual Version, TTL, and Destination glyphs. Its skinny aperture stays the same; the path adapts to the text.',operation:'read'},
   {key:'ttl',source:1,title:'TTL changes. Its checksum follows.',summary:'The source builder changes TTL from 64 to 63 and recomputes the IPv4 header checksum. TCP content is unchanged.',operation:'replace'},
   {key:'append',source:2,title:'More payload, derived consequences.',summary:'32 bytes are appended to the source payload. Packet length and TCP checksum are recomputed from the actual resulting bytes.',operation:'append'},
   {key:'remove',source:3,title:'Remove data, keep the source boundary.',summary:'The payload falls from 128 to 16 bytes, the microscope builder’s modeled minimum. Packet length and dependent checksums follow the actual remaining bytes.',operation:'remove'},
   {key:'detach',source:3,title:'The envelope separates cleanly.',summary:'The pieces separate using the same measured contact law in reverse. This is a construction study; it does not invent a router event or FCS bytes.',operation:'detach'}];
  return specs.map(spec=>{const packet=data.packetOperations[spec.source],network=packet.segments.find(s=>s.id==='network'),transport=packet.segments.find(s=>s.id==='transport'),fields=[{id:'ip-version',label:'Version',value:String(packet.bytes[network.offset]>>>4)},{id:'ip-ihl',label:'IHL',value:String(packet.bytes[network.offset]&15)},...network.fields.filter(f=>['ip-ttl','ip-length','ip-checksum','ip-src','ip-dst'].includes(f.id)),...transport.fields.filter(f=>f.id==='tcp-checksum').map(f=>({...f,label:transport.label+' checksum'})),{id:'payload-count',label:'Payload',value:packet.payloadBytes+' B'}].map(f=>({...f,value:String(f.value)}));
   return{...spec,id:spec.key,identity:'construction-frame',at:null,kind:'assembly',local:true,from:'Construction',to:'Inspection',protocol:'network',objectTitle:'IPv4 packet',fields,readIds:spec.operation==='replace'?['ip-ttl','ip-checksum']:spec.operation==='append'||spec.operation==='remove'?['payload-count','ip-length','tcp-checksum']:['ip-version','ip-ttl','ip-dst'],records:[{label:'Ethernet header',value:'14 B'},{label:'IPv4 packet',value:packet.networkBytes+' B'},{label:'Payload',value:packet.payloadBytes+' B'},{label:'FCS',value:'Unavailable · absent from model bytes'}],state:packet,bytes:packet.bytes};});
 }
 if(id==='provider'){
  const p=data.provider;return [
   {id:'inner',objectTitle:'Inner IPv4 packet',title:'The inner packet keeps its identity',summary:'The provider projection supplies an inner packet before GRE encapsulation.',fields:Object.entries(p.packet.inner).map(([label,value])=>({label:titleCase(label),value:String(value)})),state:p.packet},
   {id:'encapsulated',objectTitle:'GRE envelope',title:'An outer envelope attaches',summary:'GRE adds '+p.gre.encapsulationOverheadBytes+' bytes. The inner addresses remain '+p.packet.inner.source+' → '+p.packet.inner.destination+'.',fields:Object.entries(p.packet.outer).map(([label,value])=>({label:titleCase(label),value:String(value)})),state:p.packet},
   {id:'mtu',objectTitle:'MTU boundary',title:'Too large for the overlay',summary:'The source projection rejects the larger packet. It does not invent successful delivery.',fields:[{label:'Requested inner length',value:'1480 B'},{label:'Effective overlay MTU',value:p.gre.effectiveOverlayMtuBytes+' B'},{label:'Outcome',value:p.tooLarge.state}],state:p.tooLarge},
   {id:'mpls',objectTitle:'MPLS label operations',title:'Push, swap, and pop keep the payload',summary:'Labels are separate envelopes. The LFIB determines each operation along the actual underlay.',fields:p.lsp.operations.map((x,i)=>({label:'Hop '+(i+1)+' · '+x.routerId,value:x.operation+' · '+(x.inLabel??'none')+' → '+(x.outLabel??'none')})),state:p.lsp},
   {id:'failed-underlay',objectTitle:'Underlay unavailable',title:'The overlay depends on its underlay',summary:p.failedGre.reason,fields:[{label:'Underlay',value:String(p.failedGre.underlayReachable)},{label:'Overlay',value:String(p.failedGre.overlayReachable)},{label:'Tunnel state',value:p.failedGre.state}],state:p.failedGre}
  ].map((f,i)=>({...f,at:null,kind:i===1?'attach':'derive',local:true,from:'Ingress',to:'Egress',protocol:'network',fields:f.fields.map((x,j)=>({...x,id:'provider-'+i+'-'+j})),readIds:f.fields.map((_,j)=>'provider-'+i+'-'+j),records:[{label:'Source',value:'Repository provider contract fixture'},{label:'Underlay',value:p.gre.underlayLinkIds.join(' → ')},{label:'Effective MTU',value:p.gre.effectiveOverlayMtuBytes+' B'}]}));
 }
 if(id==='failure')return data.failure.frames.map(({event:e,state})=>({id:e.id,at:e.atMs,title:e.payload.title,summary:e.payload.summary,detail:e.payload.detail,kind:e.kind,local:true,state,event:e,records:[{label:'Forwarding path',value:state.activePathId},{label:'Failed link',value:state.failedLinkIds.join(', ')||'None'},{label:'Control propagation',value:state.controlLinkIds.join(', ')||'None'}]}));
 if(id==='http')return data.http.frames.map(({event:e,state},i)=>({...modelFrames('http')[i],id:e.id,at:e.atMs,title:e.title,summary:e.summary,kind:'comparison',local:true,state,event:e,records:[]}));
 const actual=id==='dns'?data.dns[dnsMode].frames:data[id].frames,normalized=id==='dns'&&dnsMode!=='miss'?[]:modelFrames(id);
 return actual.map(({event:e,state},i)=>{
  const f=normalized[i]||{},operation=id==='tls'?tlsOperation(e,state,actual[i-1]?.state):null,fields=operation?.fields||f.fields||[{label:'Question',value:e.qname||'www.example.test'},{label:'Answer',value:state.answer||'Not available'},{label:'Cache TTL',value:state.cacheTtlSeconds??'No cache entry'}];
  const local=id==='dns'?e.phase==='complete'||e.from===e.to||e.from==='local'||e.kind.startsWith('cache'):id==='tls'?e.direction==='local'||!e.direction:id==='journey'?!['transport.segment','http.request','http.response','tls.message'].includes(e.kind):false;
  return {...f,id:e.id,at:e.atMs,title:e.title,summary:e.summary,detail:e.detail,kind:e.kind||e.phase,local,from:e.from||e.actor||'Client',to:e.to||e.target||(e.direction==='server-to-client'?'Client':'Server'),protocol:id==='journey'?String(e.protocol||'network').toLowerCase():id,objectTitle:f.objectTitle||e.message||e.protocol||'DNS message',fields:fields.map((x,j)=>({...x,id:x.id||'field-'+j,value:String(x.value)})),readIds:operation?.readIds||fields.map((x,j)=>x.id||'field-'+j),records:operation?.records||f.records||[{label:'Cache',value:state.cacheState},{label:'TTL',value:state.cacheTtlSeconds??'Not available'},{label:'Answer',value:state.answer||'Not available'}],state,event:e};
 });
}
function frameAdapter(id){
 const source=sourceFrameAdapter(id),pairs=new Map();
 return source.map(f=>{
  // Direction is protocol meaning; screen orientation belongs to a reusable
  // conversation pair. The first exchange seats the peers, replies keep them.
  if(f.event?.direction==='client-to-server'){f.from='Client';f.to='Server';}
  if(f.event?.direction==='server-to-client'){f.from='Server';f.to='Client';}
  let peers;
  if(['tcp','tls'].includes(id))peers=['Client','Server'];
  else{const key=JSON.stringify([f.from,f.to].sort());if(!pairs.has(key))pairs.set(key,[f.from,f.to]);peers=pairs.get(key);}
  // Absent source fields remain visible as unavailable context, but are not
  // facts to inspect. Preserve real zero/false values and source field order.
  const readable=new Set((f.fields||[]).filter(x=>x.value!==undefined&&x.value!==null&&String(x.value).trim()!=='—'&&String(x.value).trim()!=='').map(x=>x.id));
  return {...f,readIds:(f.readIds||[]).filter(id=>readable.has(id)),endpoints:peers,forward:f.from===peers[0],physical:['packet','packetOps'].includes(id)||id==='provider'&&['inner','encapsulated'].includes(f.id)};
 });
}
function drawFacts(parent,values){parent.replaceChildren(...values.map(f=>{const d=node('div','rv-fact'),dt=node('dt','',f.label),dd=node('dd','',f.value);d.append(dt,dd);return d;}));}
function createActors(){
 activeActor=-1;lensKey='';q('.rv-actors').replaceChildren();actors=[];
 for(const f of frames){
  if(['failure','http'].includes(sceneId)){actors.push(null);continue;}
  const actor=node('div','rv-actor'),face=node('div','rv-actor-face'),heading=node('div','rv-actor-heading'),title=node('span','rv-actor-title',f.objectTitle),role=node('span','rv-actor-role',f.local?'Local state operation':f.from+' → '+f.to),fields=node('div','rv-fields'),capsule=node('div','rv-capsule');
  root.presentation.material(actor,{role:root.presentation.frameRole(f),identity:f.protocol,moving:true});actor.dataset.identity=f.id;actor.setAttribute('aria-label',f.objectTitle+' · '+f.id);actor.style.opacity='0';actor.inert=true;actor.setAttribute('aria-hidden','true');
  heading.append(title,role);face.append(heading,fields);capsule.append(node('span','rv-protocol'),node('span','',root.presentation.frameRole(f)==='operation'?'Local decision':f.objectTitle));
  for(const field of f.fields||[]){const el=node('div','rv-field'),label=node('span','rv-field-label',field.label),value=node('span','rv-field-value',field.value);el.dataset.field=field.id;el.append(label,value);fields.append(el);}
  if(sceneId==='packetOps'){const payload=node('section','rv-payload-body');payload.append(node('p','rv-payload-heading','Application data · exact source bytes'));const chunks=node('div','rv-payload-chunks'),bytes=f.state.segments.find(s=>s.id==='payload').bytes;for(let offset=0;offset<bytes.length;offset+=16){const chunk=node('div','rv-payload-chunk'),slice=bytes.slice(offset,offset+16);chunk.dataset.offset=String(offset);chunk.append(node('span','rv-payload-range',offset+'–'+(offset+slice.length-1)),node('span','rv-payload-pattern',String.fromCharCode(...slice)));chunks.append(chunk);}payload.append(chunks);payload.hidden=!bytes.length;face.append(payload);}
  actor.append(face,capsule);q('.rv-actors').append(actor);actors.push({actor,face,fields,capsule,fieldMap:new Map([...fields.children].map(n=>[n.dataset.field,n]))});
 }
 if(['packet','packetOps'].includes(sceneId)){
  const carrier=actors[0].actor,compact=actors[0].capsule;carrier.dataset.identity=frames[0].identity;compact.lastChild.textContent='Frame · '+(sceneId==='packet'?data.packetVariants[variant].frameBytes:data.packetOperations[0].frameBytes)+' B';
  for(let i=1;i<actors.length;i++){const a=actors[i];carrier.append(a.face);a.actor.remove();a.actor=carrier;a.capsule=compact;}
 }
}
function textLines(element,origin){
 const range=document.createRange();range.selectNodeContents(element);const rows=[];
 for(const r of range.getClientRects())if(r.width&&r.height){const x=r.left-origin.left,y=r.top-origin.top,last=rows.find(x=>Math.abs(x.y-y)<1);if(last){const end=Math.max(last.x+last.w,x+r.width);last.x=Math.min(last.x,x);last.w=end-last.x;last.h=Math.max(last.h,r.height);}else rows.push({x,y,w:r.width,h:r.height});}
 return rows.sort((a,b)=>a.y-b.y||a.x-b.x);
}
function currentPosition(){if(!plan)return null;const at=locate(clock);return {id:frames[at.index]?.id,kind:at.kind,p:at.p};}
function queueLayout(){if(!disposed&&!layoutJob)layoutJob=requestAnimationFrame(reflow);}
function reserveCaption(){
 const area=q('.rv-caption'),width=area.clientWidth;if(!width)return;
 const probe=area.cloneNode(true);if(!bounded()&&!probe.querySelector('p'))probe.append(q('.rv-caption-detail').cloneNode(true));for(const copy of probe.querySelectorAll('.rv-status-copy'))copy.remove();probe.style.height='';probe.removeAttribute('aria-live');probe.setAttribute('aria-hidden','true');Object.assign(probe.style,{position:'absolute',visibility:'hidden',width:width+'px',minHeight:'0'});q('.rv-console').append(probe);
 let max=0;for(const f of frames){probe.querySelector('strong').textContent=f.title;if(probe.querySelector('p'))probe.querySelector('p').textContent=f.summary;max=Math.max(max,probe.getBoundingClientRect().height);}probe.remove();area.style.minHeight=Math.ceil(max)+'px';captionKey='';
}
function reserveState(){
 if(['failure','http'].includes(sceneId))return;
 const cards=[q('.rv-client-record'),q('.rv-server-record')];
 for(const [index,card]of cards.entries()){
  const width=card.clientWidth;if(!width)continue;const clone=card.cloneNode(true);clone.setAttribute('aria-hidden','true');clone.inert=true;Object.assign(clone.style,{position:'absolute',visibility:'hidden',width:width+'px',minHeight:'0',height:'auto'});q('.rv-main').append(clone);let maximum=0;
  for(const frame of frames){const values=frame.records||[],half=Math.ceil(values.length/2);drawFacts(clone.querySelector('dl'),index?values.slice(half):values.slice(0,half));const phase=clone.querySelector('.rv-phase');if(phase)phase.textContent=titleCase(frame.state?.phase||'')+(frame.state?.phase==='closed-cleanly'?' · wire exchange complete; endpoint cleanup is outside this model':'');maximum=Math.max(maximum,clone.getBoundingClientRect().height);}clone.remove();card.style.minHeight=Math.ceil(maximum)+'px';
 }
}
function reflow(){
 layoutJob=0;if(disposed)return;q('.rv-envelopes').hidden=sceneId!=='packetOps';const width=stage.clientWidth||q('.rv-main').clientWidth;if(width<160)return;
 const probe=q('.rv-field-value')||q('.rv-title'),style=getComputedStyle(probe),viewport=typeof innerHeight==='number'?innerHeight:900,key=[sceneId,variant,dnsMode,width,viewport,style.fontSize,style.fontFamily,root.dataset.theme,devicePixelRatio||1].join('|');if(key===layoutKey)return;
 if(bounded())reserveCaption();const old=currentPosition(),cardWidth=Math.min(540,width-8),endpoints=q('.rv-endpoints');
 // Reserve the actual peer labels before locating the path. Names can wrap at
 // enlarged type or compact widths; no event-specific header height is needed.
 for(const [side,owner]of [...endpoints.children].entries()){
  const clone=owner.cloneNode(true);clone.setAttribute('aria-hidden','true');clone.inert=true;Object.assign(clone.style,{position:'absolute',visibility:'hidden',width:owner.clientWidth+'px',minHeight:'0',height:'auto'});q('.rv-main').append(clone);let max=0;
  for(const f of frames){clone.textContent=f.endpoints?.[side]||'';max=Math.max(max,clone.getBoundingClientRect().height);}clone.remove();owner.style.minHeight=Math.ceil(max)+'px';
 }
 const dockHeight=bounded()?dock.offsetHeight:0;dock.style.top=endpoints.offsetHeight+'px';const pathY=endpoints.offsetHeight+dockHeight+24;
 const top=q('.rv-envelope-header'),bottom=q('.rv-envelope-trailer');q('.rv-envelope-direction').textContent='02:48:4f:50:00:01 → 02:48:4f:50:00:02';for(const piece of [top,bottom]){piece.style.width=cardWidth+'px';piece.style.height='auto';}const envelopeH=sceneId==='packetOps'?Math.max(44,top.offsetHeight):0,trailerH=sceneId==='packetOps'?Math.max(44,bottom.offsetHeight):0,focusY=pathY+(bounded()?36:62)+(sceneId==='packetOps'?envelopeH+20:0),compactLabelStyle=getComputedStyle(q('.rv-capsule')||q('.rv-title')),compactFont=parseFloat(compactLabelStyle.fontSize)||13,compactContext=document.createElement('canvas').getContext('2d');compactContext.font='500 '+compactFont+'px '+compactLabelStyle.fontFamily;const compactLabels=frames.map(f=>f.local?'Local state':f.kind==='anatomy'?'Frame':f.objectTitle),compactText=Math.max(...compactLabels.map(text=>compactContext.measureText(text).width)),compactW=Math.min((width-24)/2,Math.max(88,compactText+32)),compactH=Math.max(44,Math.ceil(compactText/Math.max(1,compactW-32))*compactFont*1.2+16),ports={a:{x:4,y:pathY-22,w:compactW,h:compactH},b:{x:width-compactW-4,y:pathY-22,w:compactW,h:compactH}};
 for(const ghost of root.querySelectorAll('.rv-change-token,.rv-deleted-payload'))ghost.remove();const prepared=[];let maxHeight=0;
 for(let i=0;i<actors.length;i++){
  const a=actors[i];if(!a){prepared.push({read:{total:0},focus:{x:0,y:0,w:width,h:320},lens:{w:38,h:48}});continue;}
  for(const field of frames[i].fields){const value=a.fieldMap.get(field.id).querySelector('.rv-field-value');value.textContent=field.value;value.style.opacity='1';}a.actor.style.transform='none';a.actor.style.width=cardWidth+'px';a.actor.style.height='auto';a.face.style.width=cardWidth+'px';a.face.style.position='relative';a.face.style.opacity='1';a.face.style.transform='none';
  const fs=getComputedStyle(a.face),padding=(parseFloat(fs.paddingLeft)||24)+(parseFloat(fs.paddingRight)||24),inner=cardWidth-padding,gap=20,font=parseFloat(style.fontSize)||20,min=font*6.1,count=Math.max(1,Math.floor((inner+gap)/(min+gap))),column=(inner-(count-1)*gap)/count;
  a.fields.style.gridTemplateColumns=`repeat(${count},minmax(0,1fr))`;
  const context=document.createElement('canvas').getContext('2d');context.font=style.fontWeight+' '+style.fontSize+' '+style.fontFamily;
  for(const el of a.fields.children)el.dataset.wide=String(context.measureText(el.querySelector('.rv-field-value').textContent).width>column-16);
  const height=a.face.offsetHeight,origin=a.face.getBoundingClientRect(),lens={w:clamp(font*1.2*1.6,34,62),h:Math.max(46,font*1.2*2.05)},targets=(frames[i].readIds||[]).map(id=>{const el=a.fieldMap.get(id);return {id,label:el?.querySelector('.rv-field-label').textContent||id,lines:el?textLines(el.querySelector('.rv-field-value'),origin):[]};}),read=makePlan(targets,lens);
  const consoleHeight=q('.rv-console').offsetHeight,parallel=getComputedStyle(composition).display==='grid',available=viewport-32-(parallel?0:consoleHeight)-focusY-16,minimumViewHeight=Math.ceil((parseFloat(fs.paddingTop)||24)+(parseFloat(fs.paddingBottom)||24)+Math.max(lens.h,...targets.flatMap(t=>t.lines.map(line=>line.h)))),viewHeight=bounded()?Math.min(height,Math.max(minimumViewHeight,available)):height;
  const focus={x:(width-cardWidth)/2,y:focusY,w:cardWidth,h:viewHeight},fit=motion.fitGeometry(cardWidth,[envelopeH||60,height,trailerH||48],1),attach=motion.makeAttachmentPlan(1,0,fit),detach=motion.makeAttachmentPlan(0,1,fit),emphasis=root.emphasis.compile(root.emphasis.readWindows(read,0,id=>a.fieldMap.get(id)));const payload=a.face.querySelector('.rv-payload-body'),pr=payload?.getBoundingClientRect(),payloadRect=pr?{x:pr.left-origin.left,y:pr.top-origin.top,w:pr.width,h:pr.height}:null;prepared.push({focus,fullHeight:height,lens,read,origin,targets,emphasis,fit,attach,detach,payloadRect});maxHeight=Math.max(maxHeight,height);a.face.style.position='absolute';
 }
 stage.style.height=(['failure','http'].includes(sceneId)?0:focusY+(bounded()?prepared[0].focus.h:maxHeight)+(sceneId==='packetOps'?trailerH+60:16))+'px';
 q('.rv-path').style.cssText='left:'+(ports.a.x+compactW/2)+'px;top:'+pathY+'px;width:'+(ports.b.x-ports.a.x)+'px';
 reserveState();root.surfacePainter.prepare(Math.max(cardWidth,compactW),Math.max(maxHeight,compactH));
 const stageOrigin=stage.getBoundingClientRect(),expected=q('.rv-expected')||q('.rv-server-record dd'),oldExpected=expected?.textContent;
 const phases=[],starts=[],commits=[];let total=0;
 const add=(index,kind,duration)=>{if(duration>0){phases.push({index,kind,start:total,end:total+duration});total+=duration;}};
 for(let i=0;i<frames.length;i++){
  const f=frames[i],g=prepared[i],previous=frames[i-1];starts.push(total);
  const changed=facts(previous?.records,f.records),attention=pacing.prepare({facts:changed.length?changed:[{text:f.title,value:''}],persistent:i===frames.length-1});
  if(['failure','http'].includes(sceneId)){add(i,'transition',tuning.state);commits.push(total);add(i,'hold',Math.max(tuning.minimumExposure,attention.hold));continue;}
  if(f.kind==='assembly'){const changing=['append','remove','replace'].includes(f.operation);if(i>0&&!changing)add(i,'focus',tuning.morph);if(changing){g.mutations=[];if(f.operation==='remove'){const oldPayload=actors[i-1].face.querySelector('.rv-payload-body'),rect=prepared[i-1].payloadRect;if(oldPayload&&rect){const copy=oldPayload.cloneNode(true);copy.className+=' rv-deleted-payload';copy.querySelector('.rv-payload-heading').hidden=true;for(const chunk of copy.querySelectorAll('.rv-payload-chunk'))if(Number(chunk.dataset.offset)<f.state.payloadBytes)chunk.style.visibility='hidden';copy.setAttribute('aria-hidden','true');copy.inert=true;Object.assign(copy.style,{position:'absolute',left:rect.x+'px',top:rect.y+'px',width:rect.w+'px',opacity:'0'});actors[i].face.append(copy);g.deletedPayload=copy;}}for(const field of f.fields){const before=previous?.fields.find(x=>x.id===field.id);if(!before||before.value===field.value)continue;const from=transfer.measure(actors[i-1].fieldMap.get(field.id).querySelector('.rv-field-value'),actors[i-1].face.getBoundingClientRect()),to=transfer.measure(actors[i].fieldMap.get(field.id).querySelector('.rv-field-value'),actors[i].face.getBoundingClientRect());from.x+=prepared[i-1].focus.x;from.y+=prepared[i-1].focus.y;to.x+=g.focus.x;to.y+=g.focus.y;const viewNode=node('div','rv-transfer rv-change-token'),number=node('span'),note=node('span');viewNode.append(number,note);viewNode.setAttribute('aria-hidden','true');viewNode.style.opacity='0';q('.rv-actors').append(viewNode);g.mutations.push({fieldId:field.id,view:transfer.makeView(viewNode,number,note),plan:transfer.plan(from,to,before.value,field.value,'',{x:0,y:0,w:width}),before:before.value,after:field.value});}}if(f.operation==='attach')add(i,'fitAttach',g.attach.duration);if(f.operation==='detach')add(i,'fitDetach',g.detach.duration);if(['append','remove','replace'].includes(f.operation))add(i,'modify',Math.max(g.attach.duration,...(g.mutations||[]).map(m=>m.plan.duration)));add(i,'read',g.read.total);commits.push(total);add(i,'hold',Math.max(tuning.minimumExposure,attention.hold));continue;}
  if(f.kind==='anatomy'){if(i===0){add(i,'travel',clamp((ports.b.x-ports.a.x)/tuning.travelSpeed,tuning.minTravel,tuning.maxTravel));add(i,'open',tuning.morph);}else add(i,'focus',tuning.morph);add(i,'read',g.read.total);commits.push(total);add(i,'hold',Math.max(tuning.minimumExposure,attention.hold));continue;}
  add(i,'construct',tuning.construct);
  // Wire objects form at the sender in their compact transmitted shape. Only
  // receipt opens the inspector; construction must not preview a second read.
  if(!f.local)add(i,'travel',clamp((ports.b.x-ports.a.x)/tuning.travelSpeed,tuning.minTravel,tuning.maxTravel));
  if(f.lost){add(i,'lost',tuning.release);commits.push(total);add(i,'hold',Math.max(tuning.minimumExposure,attention.hold));continue;}
  if(!f.local)add(i,'open',tuning.morph);
  add(i,'read',g.read.total);
  const bindings=[{stateKey:'highestAck',fieldId:'ack',target:'.rv-ack'},{stateKey:'expectedAck',fieldId:'seq',target:'.rv-expected'}],binding=sceneId==='tcp'?bindings.find(b=>f.fields.some(x=>x.id===b.fieldId&&Number.isFinite(Number(x.value)))&&(previous?previous.state[b.stateKey]!==f.state[b.stateKey]:b.stateKey==='expectedAck')):null,field=binding?f.fields.find(x=>x.id===binding.fieldId):null;
  if(field){
   const target=q(binding.target),oldValue=target.textContent,nextValue=String(f.state[binding.stateKey]);target.textContent=nextValue;
   const from=transfer.measure(actors[i].fieldMap.get(field.id).querySelector('.rv-field-value'),actors[i].face.getBoundingClientRect()),to=transfer.measure(target,stageOrigin);const lastRead=samplePlan(g.read,g.read.total),limit=Math.max(0,g.fullHeight-g.focus.h);g.retainStartOffset=bounded()?clamp(lastRead.y-g.focus.h/2,0,limit):0;g.retainOffset=bounded()?clamp(from.y+from.h/2-g.focus.h/2,0,limit):0;const distance=Math.abs(g.retainOffset-g.retainStartOffset);if(distance>.5)add(i,'retainFocus',clamp(distance/.35,180,650));from.x+=g.focus.x;from.y+=g.focus.y-g.retainOffset;target.textContent=oldValue;
   const delta=Number(nextValue)-Number(field.value),note=binding.stateKey==='highestAck'?'Acknowledged by peer':delta===1&&(f.event.flags||'').includes('SYN')?'+1 · SYN':delta===1&&(f.event.flags||'').includes('FIN')?'+1 · FIN':'+'+delta+' B · contiguous sequence space';g.transferTarget=binding.target;g.transferStateKey=binding.stateKey;g.transferFieldId=binding.fieldId;
   g.transfer=transfer.plan(from,to,field.value,nextValue,note,{x:0,y:0,w:width});add(i,'retain',g.transfer.duration);
  }else add(i,'retain',tuning.state);
  commits.push(total);add(i,'hold',Math.max(tuning.minimumExposure,attention.hold));
  // A final local decision is retained state, not a received wire buffer.
  // Keep its outcome visible; physical messages still finish their release.
  if(!f.local||i<frames.length-1)add(i,'release',tuning.release);
 }
 if(expected)expected.textContent=oldExpected;
 plan={phases,starts,commits,total,prepared,width,ports,compactW,compactH,maxHeight,pathY,envelopeH,trailerH};
 if(old){const match=phases.find(p=>frames[p.index].id===old.id&&p.kind===old.kind)||phases.find(p=>frames[p.index].id===old.id&&old.kind==='retainFocus'&&p.kind==='retain');clock=match?mix(match.start,match.end,match.kind===old.kind?old.p:0):0;}else clock=0;
 q('.rv-event-picker').replaceChildren(...frames.map((f,i)=>{const option=node('option','',f.title);option.value=String(i);return option;}));
 layoutKey=key;lensKey='';reserveCaption();render();root.recordMaterial?.invalidate();if(alignAfterResize){alignAfterResize=false;if(playing&&bounded())composition.scrollIntoView?.({block:'start',behavior:'auto'});}
}
function locate(t){const phase=plan.phases.find(p=>t<p.end)||plan.phases.at(-1);return {...phase,p:clamp((t-phase.start)/(phase.end-phase.start)),elapsed:clamp(t-phase.start,0,phase.end-phase.start)};}
function interpolate(a,b,t){return {x:mix(a.x,b.x,t),y:mix(a.y,b.y,t),w:mix(a.w,b.w,t),h:mix(a.h,b.h,t)};}
function pose(at){
 const f=frames[at.index],g=plan.prepared[at.index],forward=f.forward,depart=forward?plan.ports.a:plan.ports.b,arrive=forward?plan.ports.b:plan.ports.a,focus=g.focus,p=ease(at.p);let box=focus,detail=1,opacity=1;
 if(at.kind==='construct'){box=f.local?interpolate(depart,focus,p):depart;detail=f.local?ease((at.p-.5)/.5):0;opacity=ease(at.p/.2);}
 if(at.kind==='fold'){box=interpolate(focus,depart,p);detail=1-ease(at.p/.22);}
 if(at.kind==='travel'){box=interpolate(depart,arrive,p);detail=0;if(f.lost){box=interpolate(depart,interpolate(depart,arrive,.58),p);}}
 if(at.kind==='open'){box=interpolate(arrive,focus,p);detail=ease((at.p-.62)/.38);}
 if(at.kind==='modify'&&sceneId==='packetOps'){box=interpolate(plan.prepared[Math.max(0,at.index-1)].focus,focus,p);}
 if(at.kind==='focus'){box=interpolate(plan.prepared[Math.max(0,at.index-1)].focus,focus,p);}
 if(at.kind==='lost'){box=interpolate(depart,arrive,.58);box.y+=p*12;detail=0;opacity=1-p;}
 if(at.kind==='release'){const release={x:arrive.x,y:arrive.y,w:plan.compactW,h:plan.compactH};box=interpolate(focus,release,ease(at.p/.8));detail=1-ease(at.p/.22);opacity=1-ease((at.p-.75)/.25);}
 if(at.kind==='hold'&&f.lost){box=arrive;opacity=0;detail=0;}
 const openness=clamp(Math.max((box.w-plan.compactW)/Math.max(1,focus.w-plan.compactW),(box.h-plan.compactH)/Math.max(1,focus.h-plan.compactH))),radius=Math.min(mix(16,24,openness),box.w/2,box.h/2);
 return {box,detail,opacity,openness,radius};
}
function stateIndex(){let index=-1;plan.commits.forEach((time,i)=>{if(clock>=time)index=i;});return index;}
function renderState(at){
 const committed=stateIndex(),f=frames[committed]||frames[0];
 if(sceneId==='tcp'){
  const state=committed<0?{cwndMss:6,ssthreshMss:12,duplicateAcks:0,expectedAck:1001,highestAck:0,phase:'closed'}:f.state;
  q('.rv-cwnd').textContent=state.cwndMss+' MSS';q('.rv-ssthresh').textContent=state.ssthreshMss+' MSS';q('.rv-dups').textContent=String(state.duplicateAcks);q('.rv-expected').textContent=String(state.expectedAck);q('.rv-ack').textContent=String(state.highestAck);q('.rv-ack-summary').textContent=String(state.highestAck);q('.rv-expected-summary').textContent=String(state.expectedAck);q('.rv-phase').textContent=titleCase(state.phase)+(state.phase==='closed-cleanly'?' · wire exchange complete; endpoint cleanup is outside this model':'');
  const next=frames[at.index].state,previous=frames[at.index-1]?.state||state,change=['retain','transition'].includes(at.kind)?ease(at.p):clock>=plan.commits[at.index]?1:0,current=mix(previous.cwndMss,next.cwndMss,change);
  for(const [i,cell]of [...q('.rv-window').children].entries()){const amount=clamp(current-i);cell.style.opacity=String(.08+.67*amount);cell.style.transform='scaleX('+(.15+.85*amount)+')';}
  const events=frames.slice(0,committed+1).map(x=>x.event),received=events.filter(e=>['data.segment','data.retransmit'].includes(e.kind)),missing=events.filter(e=>e.kind==='data.loss'&&!received.some(r=>r.seq===e.seq)),ack=events.filter(e=>e.kind==='ack.cumulative').at(-1)?.ack||0;
  for(const slot of q('.rv-buffer-slots').children){const seq=Number(slot.dataset.seq),length=Number(slot.dataset.length),has=received.some(e=>e.seq===seq),hole=missing.some(e=>e.seq===seq),status=hole?'missing':has?(seq+length<=ack?'delivered':missing.length&&seq>missing[0].seq?'buffered':'delivered'):'waiting';slot.dataset.state=status;slot.querySelector('span').textContent={missing:'Missing',buffered:'Buffered',delivered:'Ready in order',waiting:'Not received'}[status];}
 }else if(recordKey!==sceneId+'|'+committed){
  const current=frames[Math.max(0,committed)],values=current.records||[];drawFacts(q('.rv-client-record dl'),values.slice(0,Math.ceil(values.length/2)));drawFacts(q('.rv-server-record dl'),values.slice(Math.ceil(values.length/2)));q('.rv-phase').textContent=current.state?.phaseLabel||'';recordKey=sceneId+'|'+committed;
 }
}
function readerOffset(at){
 const g=plan.prepared[at.index];if(!bounded()||g.fullHeight<=g.focus.h)return 0;
 if(at.kind==='retainFocus')return mix(g.retainStartOffset,g.retainOffset,ease(at.p));if(['retain','hold','release'].includes(at.kind)&&g.retainOffset!==undefined)return g.retainOffset;const time=at.kind==='read'?at.elapsed:['retain','hold','release'].includes(at.kind)?g.read.total:0,s=samplePlan(g.read,time);
 return clamp(s.y-g.focus.h/2,0,g.fullHeight-g.focus.h);
}
function renderLens(at,shape){
 const lens=q('.rv-lens'),g=plan.prepared[at.index];
 for(const a of actors)if(a)for(const f of a.fieldMap.values())f.style.setProperty('--hs-emphasis','0');
 if(at.kind!=='read'||!g.read.total){lens.style.opacity='0';return;}
 const s=samplePlan(g.read,at.elapsed),a=actors[at.index],key=frames[at.index].id+'|'+layoutKey;
 if(lensKey!==key){
  const clone=a.face.cloneNode(true);clone.style.position='relative';clone.style.opacity='1';clone.style.transform='none';clone.style.left='0';clone.style.top='0';root.presentation.material(clone,{role:a.actor.dataset.materialRole,identity:a.actor.dataset.protocol,moving:true});clone.prepend(lensCanvas);lensCanvas.style.position='absolute';lensCanvas.style.zIndex='-1';if(a.actor.dataset.materialRole==='packet')root.surfacePainter.paint(lensCanvas,g.focus.w,g.focus.h,24,1);q('.rv-lens-copy').replaceChildren(clone);lensKey=key;
 }
 lensCanvas.style.top=readerOffset(at)+'px';const zoom=mix(1,motion.policy.zoom,s.focus);lens.style.width=g.lens.w+'px';lens.style.height=g.lens.h+'px';lens.style.left=(shape.box.x+s.x-g.lens.w/2)+'px';lens.style.top=(shape.box.y+s.y-readerOffset(at)-g.lens.h/2)+'px';lens.style.opacity=String(s.opacity);q('.rv-lens-copy').style.transform=`translate(${g.lens.w/2-s.x*zoom}px,${g.lens.h/2-s.y*zoom}px) scale(${zoom})`;
 root.emphasis.draw(g.emphasis,at.elapsed);
}
function renderActor(at){
 if(['failure','http'].includes(sceneId))return;
 const a=actors[at.index],f=frames[at.index],s=pose(at);
 if(activeActor!==at.index){for(const n of actors)if(n){if(n.actor!==a.actor){n.actor.style.opacity='0';n.actor.inert=true;n.actor.setAttribute('aria-hidden','true');}n.face.style.opacity='0';n.face.style.visibility='hidden';}root.presentation.material(a.actor,{role:root.presentation.frameRole(f),identity:f.protocol,moving:true});a.actor.prepend(liveCanvas);liveCanvas.dataset.paintKey='';activeActor=at.index;}
 if(bounded()){const g=plan.prepared[at.index];a.face.style.transform='translateY('+(-readerOffset(at))+'px)';const height=(g.focus.y+g.focus.h+16)+'px';if(stage.style.height!==height)stage.style.height=height;}
 const faceOpacity=clamp((s.detail-.5)*2),capsuleOpacity=clamp((.5-s.detail)*2);
 a.actor.style.transform=`translate(${s.box.x}px,${s.box.y}px)`;a.actor.style.width=s.box.w+'px';a.actor.style.height=s.box.h+'px';a.actor.style.borderRadius=s.radius+'px';a.actor.style.opacity=String(s.opacity);a.actor.inert=faceOpacity<.99;a.actor.setAttribute('aria-hidden',String(s.opacity<.01));a.face.style.opacity=String(faceOpacity);a.face.style.visibility=faceOpacity>0?'visible':'hidden';a.capsule.style.opacity=String(capsuleOpacity);a.capsule.style.visibility=capsuleOpacity>0?'visible':'hidden';
 if(s.opacity>0)root.surfacePainter.paint(liveCanvas,s.box.w,s.box.h,s.radius,s.openness);
 if(at.kind==='focus'){const previous=actors[at.index-1],exit=1-ease(clamp(at.p*2)),enter=ease(clamp((at.p-.5)*2));previous.face.style.visibility=exit>0?'visible':'hidden';previous.face.style.opacity=String(exit);a.face.style.visibility=enter>0?'visible':'hidden';a.face.style.opacity=String(enter);}else if(['packet','packetOps'].includes(sceneId))for(const other of actors)if(other.face!==a.face){other.face.style.visibility='hidden';other.face.style.opacity='0';}
 const endpointNodes=q('.rv-endpoints').children;endpointNodes[0].textContent=f.endpoints[0];endpointNodes[1].textContent=f.endpoints[1];
 renderAssembly(at,s);renderLens(at,s);if(at.kind==='modify')for(const m of plan.prepared[at.index].mutations||[])a.fieldMap.get(m.fieldId).style.setProperty('--hs-emphasis',String(Math.sin(Math.PI*at.p)));transferView.node.style.opacity='0';
 for(const target of [q('.rv-expected'),q('.rv-ack')])if(target){target.style.opacity='1';target.parentElement.style.setProperty('--hs-receive','0');}
 if(at.kind==='retain'&&plan.prepared[at.index].transfer){const prepared=plan.prepared[at.index],tr=prepared.transfer,s=transfer.draw(transferView,tr,at.elapsed,frames[at.index].id,true),target=q(prepared.transferTarget);target.parentElement.dataset.transferReceiving='true';target.parentElement.style.setProperty('--hs-receive',String(s.receive));if(s.landed){target.textContent=tr.after;target.style.opacity=String(s.receiverOpacity);}}
}
function renderAssembly(at,shape){
 const host=q('.rv-envelopes');host.hidden=sceneId!=='packetOps';if(host.hidden)return;const g=plan.prepared[at.index],f=frames[at.index],gap=f.operation==='attach'?(at.kind==='fitAttach'?motion.attachmentState(g.attach,at.elapsed).amount:0):f.operation==='detach'?(at.kind==='focus'?0:at.kind==='fitDetach'?motion.attachmentState(g.detach,at.elapsed).amount:1):0,spread=g.fit.spread*gap,top=q('.rv-envelope-header'),bottom=q('.rv-envelope-trailer');
 Object.assign(top.style,{left:g.focus.x+'px',top:(shape.box.y-plan.envelopeH-spread)+'px',width:shape.box.w+'px',height:plan.envelopeH+'px'});Object.assign(bottom.style,{left:g.focus.x+'px',top:(shape.box.y+shape.box.h+spread)+'px',width:shape.box.w+'px',height:plan.trailerH+'px'});top.style.opacity=String(f.operation==='attach'&&at.kind==='focus'?0:1);root.surfacePainter.paint(envelopeCanvas,shape.box.w,plan.envelopeH,18,1);q('.rv-envelope-direction').textContent='02:48:4f:50:00:01 → 02:48:4f:50:00:02';
 for(const prepared of plan.prepared)for(const m of prepared.mutations||[])m.view.node.style.opacity='0';for(const field of f.fields){const value=actors[at.index].fieldMap.get(field.id).querySelector('.rv-field-value');value.textContent=field.value;value.style.opacity='1';}if(at.kind==='modify')for(const m of g.mutations||[]){const value=actors[at.index].fieldMap.get(m.fieldId).querySelector('.rv-field-value'),progress=transfer.draw(m.view,m.plan,Math.min(at.elapsed,m.plan.duration),f.id+'|'+m.fieldId,true);value.textContent=progress.landed?m.after:m.before;value.style.opacity=String(progress.landed?progress.receiverOpacity:1-progress.lift);actors[at.index].fieldMap.get(m.fieldId).style.setProperty('--hs-emphasis',String(Math.sin(Math.PI*at.p)));}
 const currentActor=actors[at.index];for(const chunk of currentActor.face.querySelectorAll('.rv-payload-chunk')){chunk.style.opacity='1';chunk.style.transform='none';}if(g.deletedPayload)g.deletedPayload.style.opacity='0';if(at.kind==='modify'){const before=frames[Math.max(0,at.index-1)].state;if(f.operation==='append'){for(const chunk of currentActor.face.querySelectorAll('.rv-payload-chunk'))if(Number(chunk.dataset.offset)>=before.payloadBytes){chunk.style.opacity=String(ease((at.p-.35)/.65));chunk.style.transform='translateY('+((1-ease(at.p))*6)+'px)';}}if(g.deletedPayload){g.deletedPayload.style.opacity=String(1-ease(at.p));g.deletedPayload.style.transform='translateY('+(ease(at.p)*8)+'px)';}}
 const parcel=q('.rv-payload-addon');parcel.style.opacity='0';if(at.kind==='modify'&&['append','remove'].includes(f.operation)){const old=frames[Math.max(0,at.index-1)].state,current=f.state,amount=motion.attachmentState(g.attach,at.elapsed).amount,inserting=f.operation==='append',distance=g.fit.spread*(inserting?amount:1-amount),blend=inserting?1-ease((at.p-.7)/.3):1-ease((at.p-.75)/.25);q('.rv-payload-addon-value').textContent=(inserting?current.payloadBytes-old.payloadBytes:old.payloadBytes-current.payloadBytes)+' B · '+(inserting?'Appending':'Removing');Object.assign(parcel.style,{left:(g.focus.x+20)+'px',top:(shape.box.y+shape.box.h-52+distance)+'px',opacity:String(blend),transform:'translateY('+((inserting?1-amount:amount)*6)+'px)'});}
}
function svg(tag,attrs,text){const e=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,String(v));if(text!==undefined)e.textContent=String(text);return e;}
function networkGeometry(){
 const width=plan.width;let height=Math.max(260,width*.37);const graph=data.failure.graph,nodes=graph.nodes.map(n=>({...n,x:(n.x/112)*(width-92)+46,y:(n.y/72)*(height-88)+44}));
 const ctx=document.createElement('canvas').getContext('2d');ctx.font='500 13px '+getComputedStyle(root).fontFamily;
 const boxes=new Map(nodes.map(n=>{n.displayLabel=width<500?n.shortLabel:n.label;return[n.id,{...n,w:Math.max(66,ctx.measureText(n.displayLabel).width+24),h:44}];}));
 // When the logical graph cannot fit readable names, spread it vertically.
 if(width<500){const margin=Math.max(...[...boxes.values()].map(n=>n.w/2))+6,columns=Math.max(2,Math.floor(width/130)),rows=Math.ceil(nodes.length/columns);height=rows*112+32;nodes.forEach((n,i)=>{n.x=margin+(i%columns)*(width-2*margin)/(columns-1);n.y=40+Math.floor(i/columns)*112;Object.assign(boxes.get(n.id),{x:n.x,y:n.y});});}
 return {width,height,nodes,boxes,links:graph.links.map(l=>({...l,a:boxes.get(l.from),b:boxes.get(l.to)}))};
}
let network=null,networkKey='';
let networkElements=null,networkRecordKey='';
function renderNetwork(at){
 const key=plan.width+'|'+layoutKey;
 if(key!==networkKey){network=networkGeometry();networkKey=key;networkElements=null;}
 const s=q('.rv-diagram'),g=network,f=frames[at.index],previous=frames[at.index-1]?.state||f.state,current=f.state,t=at.kind==='transition'?ease(at.p):1;
 if(!networkElements){
  s.setAttribute('viewBox',`0 0 ${g.width} ${g.height}`);s.style.height=g.height+'px';s.replaceChildren(svg('title',{},'Source network · distinct control propagation'));networkElements=[];
  for(const link of g.links){const dx=link.b.x-link.a.x,dy=link.b.y-link.a.y,ta=1/Math.max(Math.abs(dx)/(link.a.w/2),Math.abs(dy)/22),tb=1/Math.max(Math.abs(dx)/(link.b.w/2),Math.abs(dy)/22),ax=link.a.x+dx*ta,ay=link.a.y+dy*ta,bx=link.b.x-dx*tb,by=link.b.y-dy*tb;
   const path=svg('path',{d:`M ${ax} ${ay} L ${bx} ${by}`,fill:'none'}),gap=svg('circle',{cx:(ax+bx)/2,cy:(ay+by)/2,fill:'var(--hs-bg)'}),label=svg('text',{x:(ax+bx)/2+10,y:(ay+by)/2-8,fill:'var(--rv-red)','font-size':12},'Down'),message=svg('circle',{r:4,fill:'var(--hs-accent)'});s.append(path,gap,label,message);networkElements.push({link,path,gap,label,message,ax,ay,bx,by});
  }
  for(const n of g.nodes){const box=g.boxes.get(n.id);s.append(svg('rect',{x:n.x-box.w/2,y:n.y-22,width:box.w,height:44,rx:16,fill:'var(--hs-panel)',stroke:'var(--hs-line)','aria-label':n.label}),svg('text',{x:n.x,y:n.y+5,'text-anchor':'middle',class:'rv-network-node'},n.displayLabel));}
 }
 const activePath=current.activePathId==='alternate'?['client-edge','edge-r2','r2-core','core-service']:['client-edge','edge-r1','r1-core','core-service'],beforePath=previous.activePathId==='alternate'?['client-edge','edge-r2','r2-core','core-service']:['client-edge','edge-r1','r1-core','core-service'];
 for(const el of networkElements){const broken=current.failedLinkIds.includes(el.link.id),wasBroken=previous.failedLinkIds.includes(el.link.id),failure=mix(wasBroken?1:0,broken?1:0,t),selected=mix(beforePath.includes(el.link.id)?1:0,activePath.includes(el.link.id)?1:0,t);el.path.setAttribute('stroke',failure>.01?'var(--rv-red)':selected>.01?'var(--hs-accent)':'var(--hs-route-line)');el.path.setAttribute('stroke-width',1+selected*1.5);el.path.setAttribute('opacity',failure?1:selected>.01?.85:.65);el.gap.setAttribute('r',6*failure);el.label.setAttribute('opacity',failure);const traveling=current.controlLinkIds.includes(el.link.id)&&at.kind==='transition';el.message.setAttribute('opacity',traveling?Math.sin(Math.PI*at.p):0);el.message.setAttribute('cx',mix(el.ax,el.bx,at.p));el.message.setAttribute('cy',mix(el.ay,el.by,at.p));}
 const recordKey=f.id+'|'+layoutKey;if(recordKey!==networkRecordKey){const records=q('.rv-network-records');records.replaceChildren();for(const fact of f.records){const r=node('section','rv-record');r.dataset.uiSurface='record';r.append(node('h3','',fact.label),node('p','',fact.value));records.append(r);}networkRecordKey=recordKey;root.recordMaterial?.invalidate();s.setAttribute('aria-label',f.summary);}
}

function renderComparison(at){
 const f=frames[at.index],previous=frames[at.index-1]?.state||f.state,t=at.kind==='transition'?ease(at.p):1,region=q('.rv-comparison-primary');
 if(!region.children.length){region.classList.add('rv-grid');for(const type of ['h2','h3']){const card=node('section','rv-record');card.dataset.uiSurface='record';card.dataset.lane=type;card.append(node('h3','',type==='h2'?'HTTP/2 · TCP':'HTTP/3 · QUIC'));for(const stream of ['A','B']){const row=node('div','rv-http-stream');row.dataset.stream=stream;row.append(node('p','',stream==='A'?'/hero.jpg':'/app.js'),node('div','rv-http-slots'),node('p','rv-http-status'));card.append(row);}card.append(node('p','rv-http-congestion'));region.append(card);}}
 for(const card of region.children){const type=card.dataset.lane,next=f.state[type],before=previous[type];for(const row of card.querySelectorAll('.rv-http-stream')){const stream=row.dataset.stream,progress=mix(before['stream'+stream+'Progress'],next['stream'+stream+'Progress'],t),slots=row.querySelector('.rv-http-slots');slots.style.cssText='display:flex;gap:4px;min-height:26px';if(!slots.children.length)for(let i=0;i<12;i++)slots.append(node('span','rv-window-cell'));for(const [i,slot]of [...slots.children].entries()){slot.style.opacity=String(.08+.67*clamp(progress/100*12-i));slot.style.transform='scaleX('+(.2+.8*clamp(progress/100*12-i))+')';}row.querySelector('.rv-http-status').textContent=next['stream'+stream]+' · '+Math.round(progress)+'%';}card.querySelector('.rv-http-congestion').textContent=next.deliveryLabel+' · '+next.congestionLabel;}
}
function render(){
 if(!plan)return;const at=locate(clock),f=frames[at.index];renderState(at);renderActor(at);if(sceneId==='failure')renderNetwork(at);if(sceneId==='http')renderComparison(at);
 if(sceneId==='tls'){const state=frames[Math.max(0,stateIndex())].state;q('.rv-tls-certificate').textContent=state.certificateState;q('.rv-tls-channel').textContent=state.applicationReady?'Ready':'Not ready';}if(bounded()&&fullFields.dataset.event!==f.id){drawFacts(fullFields,f.fields);fullFields.dataset.event=f.id;}
 const key=f.id+'|'+at.kind;if(key!==captionKey){root.reviewUI.status(q('.rv-caption-title'),q('.rv-caption-detail'),f.title,f.summary);captionKey=key;}
 q('.rv-operation').textContent='Presentation · '+({construct:'constructing a separate object',fold:'closing the same object',travel:f.lost?'in transit · loss boundary':'in transit',open:'opening the same object',read:'reading actual fields',retainFocus:'bringing the received value into view',retain:'retaining the result',hold:'outcome stays readable',release:'processed buffer released',lost:'lost before receipt',transition:'state changes continuously',focus:'opening another layer of the same object',fitAttach:'separate pieces seat at contact',fitDetach:'separate pieces release from contact',modify:'a structural change carries its consequences'}[at.kind]||at.kind);
 q('.rv-model-time').textContent=f.at===null?'Source snapshot · no model clock':'Source event · '+f.id+' · '+f.at+' ms';q('.rv-event-picker').value=String(at.index);q('.rv-scrub').value=String(Math.round(clock/plan.total*1000));q('.rv-play').textContent=playing?'Pause':'Play';q('.rv-next').disabled=at.index===frames.length-1;
}
function pause(){playing=false;if(job)cancelAnimationFrame(job);job=0;last=0;if(plan)render();}
function tick(now){job=0;if(!playing||disposed||!root.isConnected||document.hidden){pause();return;}if(last)clock=Math.min(plan.total,clock+(now-last)*Number(q('.rv-speed').value));last=now;render();if(clock>=plan.total){playing=false;q('.rv-play').textContent='Play';last=0;}else job=requestAnimationFrame(tick);}
function play(){if(bounded())composition.scrollIntoView?.({block:'start',behavior:'auto'});if(reduced.matches){next();return;}if(clock>=plan.total)clock=0;playing=true;last=0;render();if(!job)job=requestAnimationFrame(tick);}
function next(){pause();const at=locate(clock),target=clock<plan.commits[at.index]?at.index:Math.min(frames.length-1,at.index+1);clock=reduced.matches?plan.commits[target]:plan.starts[Math.min(frames.length-1,at.index+1)];render();}
function seek(value){pause();clock=clamp(Number(value)||0,0,plan.total);render();}
function buildLocalControls(){
 const c=q('.rv-local-controls');c.replaceChildren();c.hidden=!['packet','dns'].includes(sceneId);
 if(sceneId==='packet'){const label=node('label','','Packet'),select=node('select','cursor-interaction');select.setAttribute('aria-label','Packet family and protocol');data.packetVariants.forEach((p,i)=>{const o=node('option','',p.config.family.toUpperCase()+' · '+p.config.transport.toUpperCase());o.value=String(i);select.append(o);});select.value=String(variant);select.addEventListener('change',()=>{pause();variant=Number(select.value);frames=frameAdapter(sceneId);createActors();layoutKey='';queueLayout();renderBytes();});label.append(select);c.append(label);}
 if(sceneId==='dns'){const label=node('label','','Cache'),select=node('select','cursor-interaction');for(const mode of Object.keys(data.dns)){const o=node('option','',mode==='miss'?'Cache miss':'Cache hit');o.value=mode;select.append(o);}select.value=dnsMode;select.addEventListener('change',()=>{pause();dnsMode=select.value;frames=frameAdapter(sceneId);createActors();layoutKey='';queueLayout();});label.append(select);c.append(label);}
}
function renderBytes(){
 const region=q('.rv-byte-details');region.hidden=sceneId!=='packet';if(region.hidden)return;const packet=data.packetVariants[variant];q('.rv-bytes').replaceChildren(...packet.bytes.map((value,i)=>{const n=node('button','cursor-interaction',value.toString(16).padStart(2,'0').toUpperCase());n.type='button';n.setAttribute('aria-label','Byte '+i+' · '+n.textContent);n.setAttribute('aria-pressed',String(i===byte));n.addEventListener('click',()=>{byte=i;for(const [j,b]of [...q('.rv-bytes').children].entries())b.setAttribute('aria-pressed',String(j===i));const segment=packet.segments.find(x=>i>=x.offset&&i<x.offset+x.length),field=segment.fields.find(x=>i>=segment.offset+x.offset&&i<segment.offset+x.offset+x.length);q('.rv-byte-note').textContent='Byte '+i+' · '+segment.label+(field?' · '+field.label+' · offset '+(segment.offset+field.offset)+' + '+field.length+' B':'');});return n;}));q('.rv-byte-note').textContent='All '+packet.frameBytes+' bytes come from the source model. No FCS bytes are invented.';
 root.byteWindows.layout(q('.rv-bytes'),region);
}
function select(id){
 if(frames.length)memories.set(sceneId,{position:currentPosition(),variant,dnsMode,byte});pause();sceneId=id;const remembered=memories.get(id);if(remembered){variant=remembered.variant;dnsMode=remembered.dnsMode;byte=remembered.byte;}root.dataset.scene=id;frames=frameAdapter(id);clock=0;plan=null;layoutKey='';networkKey='';recordKey='';activeActor=-1;
 q('.rv-scene-picker').value=id;q('.rv-title').textContent={tcp:'The packet stays the packet.',packet:'One frame. Every layer.',packetOps:'Construct. Read. Change. Keep the cause.',failure:'Failure takes time to become knowledge.',dns:'A question finds its authority.',tls:'Meaning closes into protected records.',http:'One loss. Two delivery models.',journey:'One request across the layers.',provider:'An envelope around an envelope.'}[id];
 q('.rv-subtitle').textContent={tcp:'Every packet is constructed, sent, received, and processed separately. Connection state survives the exchange.',packet:'Measured fields open from the compact source frame. Version, protocol, and exact byte ranges remain explicit.',packetOps:'Separate envelopes touch without merging. Construction changes derive lengths and checksums from real source bytes.',failure:'The physical break, control propagation, route installation, and application recovery remain separate source events.',dns:'Questions, referrals, answers, and retained cache state follow the source sequence.',tls:'Parameters enter the transcript, keys activate, and application data becomes opaque. Cryptographic values are symbolic.',http:'TCP’s sequence hole blocks delivery across streams. QUIC’s Stream B continues while Stream A waits; congestion still affects the connection.',journey:'The event sequence changes scale while retaining its request context and existing source boundaries.',provider:'Underlay forwarding, the inner packet, added envelopes, and MTU outcomes remain distinguishable.'}[id];
 q('.rv-motion-primary').hidden=['failure','http'].includes(id);q('.rv-state-secondary').hidden=['failure','http'].includes(id);q('.rv-network-primary').hidden=id!=='failure';q('.rv-comparison-primary').hidden=id!=='http';q('.rv-buffer').hidden=id!=='tcp';q('.rv-window').hidden=id!=='tcp';
 q('.rv-client-record h3').textContent=id==='tcp'?'Client · data sender':'Retained state';q('.rv-server-record h3').textContent=id==='tcp'?'Server · data receiver':'Context';
 // Restore original receiver nodes after other protocol record schemas used them.
 if(id==='tcp'){
  q('.rv-client-record dl').innerHTML='<div class="rv-fact"><dt>Congestion window</dt><dd class="rv-cwnd"></dd></div><div class="rv-fact"><dt>Slow-start threshold</dt><dd class="rv-ssthresh"></dd></div><div class="rv-fact"><dt>Duplicate ACKs</dt><dd class="rv-dups"></dd></div><div class="rv-fact"><dt>Highest ACK at sender</dt><dd class="rv-ack-summary">0</dd></div>';
  q('.rv-server-record dl').innerHTML='<div class="rv-fact"><dt>Next expected byte</dt><dd class="rv-expected-summary">1001</dd></div>';
  q('.rv-window').replaceChildren(...Array.from({length:Math.max(...frames.map(f=>f.state.cwndMss))},()=>node('span','rv-window-cell')));
  const ranges=[...new Map(frames.filter(f=>f.event.length).map(f=>[f.event.seq,f.event])).values()].sort((a,b)=>a.seq-b.seq);q('.rv-buffer-slots').replaceChildren(...ranges.map(e=>{const n=node('div','rv-buffer-slot');n.dataset.seq=String(e.seq);n.dataset.length=String(e.length);n.append(node('strong','',e.seq+'–'+(e.seq+e.length-1)),node('span','','Not received'));return n;}));
 }
 buildDock();root.disclosures.set(details,!bounded(),false);details.dataset.bounded=String(bounded());settings.hidden=!bounded();explanation.hidden=!bounded();root.disclosures.set(settings,false,false);root.disclosures.set(explanation,false,false);for(const label of settingLabels)(bounded()?(settings.querySelector('.rv-disclosure-inner')||settings):q('.rv-controls')).append(label);(bounded()?(explanation.querySelector('.rv-disclosure-inner')||explanation):q('.rv-caption')).append(q('.rv-caption-detail'));fullFields.hidden=!bounded();createActors();buildLocalControls();renderBytes();reflow();
 const saved=memories.get(id);if(saved?.position){const phase=plan.phases.find(p=>frames[p.index].id===saved.position.id&&p.kind===saved.position.kind)||plan.phases.find(p=>frames[p.index].id===saved.position.id&&saved.position.kind==='retainFocus'&&p.kind==='retain');if(phase)clock=mix(phase.start,phase.end,phase.kind===saved.position.kind?saved.position.p:0);}else{const ready=plan.phases.find(p=>p.index===0&&p.kind==='open')||plan.phases.find(p=>p.index===0&&p.kind==='construct');if(ready)clock=ready.end-1;}render();
}
function appearance(){const value=q('.rv-theme').value;root.dataset.theme=value==='system'?(dark.matches?'dark':'light'):value;root.surfacePainter.invalidate();layoutKey='';networkKey='';queueLayout();}
q('.rv-play').addEventListener('click',()=>playing?pause():play());q('.rv-replay').addEventListener('click',()=>{pause();clock=0;play();});q('.rv-next').addEventListener('click',next);q('.rv-event-picker').addEventListener('change',e=>seek(plan.starts[Number(e.target.value)]));q('.rv-scrub').addEventListener('input',e=>seek(Number(e.target.value)/1000*plan.total));q('.rv-scene-picker').addEventListener('change',e=>select(e.target.value));q('.rv-theme').addEventListener('change',appearance);dark.addEventListener('change',()=>{if(q('.rv-theme').value==='system')appearance();});reduced.addEventListener('change',()=>{pause();render();});
details.addEventListener('toggle',()=>{if(details.open)pause();});root.addEventListener('review-disclosure-layout',e=>{if([settings,explanation].includes(e.detail.element)){if(root.disclosures.wanted(e.detail.element))pause();layoutKey='';queueLayout();}});const viewportResize=()=>{alignAfterResize=playing&&bounded();layoutKey='';queueLayout();};window.addEventListener('resize',viewportResize);
let observedMainWidth=q('.rv-main').clientWidth;const resize=new ResizeObserver(()=>{const width=q('.rv-main').clientWidth;if(bounded()&&Math.abs(width-observedMainWidth)<.5)return;observedMainWidth=width;layoutKey='';queueLayout();});resize.observe(q('.rv-main'));document.fonts?.ready.then(()=>{layoutKey='';queueLayout();});document.fonts?.addEventListener('loadingdone',()=>{layoutKey='';queueLayout();});document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});root.addEventListener('review-material-change',()=>{root.surfacePainter.invalidate();layoutKey='';queueLayout();});
root.byteWindows.watch(q('.rv-byte-details'),()=>{if(sceneId==='packet')root.byteWindows.layout(q('.rv-bytes'),q('.rv-byte-details'));});
root.causalStudy=Object.freeze({select,seek,next,play,pause,reflow,appearance,snapshot:()=>({sceneId,clock,playing,plan,frames,at:plan?locate(clock):null,committed:plan?stateIndex():-1,plannerUsesCachedGeometry:true,material:root.surfacePainter.stats()}),sample:t=>plan?{at:locate(t),pose:['failure','http'].includes(sceneId)?null:pose(locate(t))}:null,dispose:()=>{root.reviewUI.settle();root.byteWindows.dispose();root.layoutReservation.dispose();pause();disposed=true;if(layoutJob)cancelAnimationFrame(layoutJob);resize.disconnect();window.removeEventListener?.('resize',viewportResize);}});
select('tcp');
})();
