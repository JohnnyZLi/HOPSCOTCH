(()=>{
'use strict';
const root=document.getElementById('__ROOT__');
const acronyms=new Map(['IPv4','IPv6','TCP','UDP','ICMP','DNS','TLS','HTTP','HTTPS','OSPF','OSPFv3','BGP','RIB','FIB','VLAN','STP','MAC','ARP','NAT','DHCP','GRE','MPLS','VXLAN','VNI','EVPN','MTU','TTL','ASN','CLI','JSON','RTT','ACL','FCS','DSCP','ECN','IHL'].map(x=>[x.toLowerCase(),x]));
function label(value){return String(value??'').replace(/([a-z\d])([A-Z])/g,'$1 $2').replace(/[_-]/g,' ').split(/\s+/).map((word,i)=>acronyms.get(word.toLowerCase())||(i?word.toLowerCase():word.charAt(0).toUpperCase()+word.slice(1).toLowerCase())).join(' ');}
const palette=Object.freeze({tcp:0,network:-22,ipv4:-22,ipv6:-22,ethernet:-42,udp:27,icmp:142,dns:-48,tls:55,payload:55,http:55,https:55,gre:-22,mpls:-22,vxlan:27,quic:27});
function protocol(value){const key=String(value??'').toLowerCase();if(Object.hasOwn(palette,key))return key;return ['tls','https','http','ipv6','ipv4','ethernet','icmp','udp','dns','gre','mpls','vxlan','quic','tcp'].find(p=>key.includes(p))||'network';}
function frameRole(frame){return frame.physical||frame.local===false?'packet':'operation';}
function material(owner,{role='packet',identity='tcp',moving=false}={}){
 owner.dataset.materialRole=role;owner.dataset.protocol=protocol(identity);
 if(role==='packet'){owner.removeAttribute('data-ui-surface');owner.style.setProperty('--rv-packet-hue',palette[owner.dataset.protocol]+'deg');}
 else{if(moving)owner.removeAttribute('data-ui-surface');else owner.dataset.uiSurface='record';owner.style.setProperty('--rv-packet-hue','0deg');}
 return owner;
}
function node(tag,cls,text){const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=String(text);return el;}
function valueText(value){return value===null||value===undefined?'Not available':typeof value==='boolean'?(value?'Yes':'No'):String(value);}
const identities=['summary','label','title','name','prefix','address','interfaceName','mac','id'];
function record(value,title,{why,path=[String(title)]}={}){
 const host=node('section','rv-semantic-record');
 if(value===null||typeof value!=='object'){const dl=node('dl','rv-semantic-fields');dl.append(pair(label(title),valueText(value)));host.append(dl);return host;}
 if(Array.isArray(value)){
  host.append(node('p','rv-record-count',value.length+' '+(value.length===1?'record':'records')));
  if(!value.length){host.append(node('p','','No entries in this source state.'));return host;}
  value.forEach((item,i)=>{
   const name=item&&typeof item==='object'?identities.map(key=>item[key]).find(v=>typeof v==='string'&&v)||title+' '+(i+1):valueText(item);
   const itemPath=[...path,String(item?.id??i)],detail=node('details','rv-semantic-item');detail.dataset.disclosureKey=JSON.stringify(itemPath);detail.append(node('summary','',name),record(item,name,{why,path:itemPath}));host.append(detail);
  });return host;
 }
 if(typeof value.label==='string'&&Object.hasOwn(value,'value')){
  host.append(node('h3','',label(value.label)),node('p','rv-record-primary',valueText(value.value)));if(value.detail)host.append(node('p','',value.detail));if(value.why?.length&&why)host.append(why(value.why));return host;
 }
 const entries=Object.entries(value),simple=entries.filter(([,v])=>v===null||typeof v!=='object'),nested=entries.filter(([,v])=>v!==null&&typeof v==='object'),dl=node('dl','rv-semantic-fields');
 for(const [key,v]of simple){if(key==='summary'||key==='detail'||key==='objective')host.append(node('p',key==='summary'?'rv-record-primary':'',v));else dl.append(pair(label(key),valueText(v)));}
 if(dl.children.length)host.append(dl);
 for(const [key,v]of nested){
  if(key==='why'&&why){if(v.length)host.append(why(v));continue;}
  const childPath=[...path,key],detail=node('details','rv-semantic-item');detail.dataset.disclosureKey=JSON.stringify(childPath);detail.append(node('summary','',label(key)+(Array.isArray(v)?' · '+v.length:'')),record(v,label(key),{why,path:childPath}));host.append(detail);
 }
 if(!entries.length)host.append(node('p','','No entries in this source state.'));return host;
}
function pair(key,value){const group=node('div','rv-semantic-field');if(/[\r\n]/.test(String(value)))group.dataset.multiline='true';group.append(node('dt','',key),node('dd','',value));return group;}
// Presentation time can stretch an interval without rewriting its source time.
// The caller supplies facts, not protocol-specific duration overrides.
function attentionTimeline(entries,sourceDuration){
 let wall=0;
 const segments=entries.map((entry,i)=>{const start=entry.at,end=entries[i+1]?.at??sourceDuration,span=Math.max(0,end-start),duration=Math.max(span,root.pacing.reading(entry.facts).budget),segment={start,end,wallStart:wall,wallEnd:wall+duration};wall+=duration;return segment;});
 const clamp=(n,max)=>Math.max(0,Math.min(max,n));
 function locate(time,key){let low=0,high=segments.length-1;while(low<high){const mid=(low+high)>>1;if(time<segments[mid][key])high=mid;else low=mid+1;}return segments[low];}
 function sourceAt(time){if(!segments.length)return 0;const t=clamp(time,wall),s=locate(t,'wallEnd'),p=s.wallEnd>s.wallStart?(t-s.wallStart)/(s.wallEnd-s.wallStart):1;return s.start+(s.end-s.start)*p;}
 function wallAt(time){if(!segments.length)return 0;const t=clamp(time,sourceDuration),s=locate(t,'end'),p=s.end>s.start?(t-s.start)/(s.end-s.start):1;return s.wallStart+(s.wallEnd-s.wallStart)*p;}
 return Object.freeze({segments,wallDuration:wall,sourceDuration,sourceAt,wallAt});
}
root.presentation=Object.freeze({label,protocol,frameRole,material,record,palette,attentionTimeline});
})();
