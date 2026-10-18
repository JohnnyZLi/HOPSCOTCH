(()=>{
'use strict';
const root=document.getElementById('__ROOT__'),reduced=matchMedia('(prefers-reduced-motion: reduce)'),records=new Map(),byInner=new WeakMap();
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),ease=t=>1-Math.pow(1-t,3);
const policy=Object.freeze({min:180,max:300,base:160,distance:6});
function duration(distance){return clamp(policy.base+Math.sqrt(Math.max(0,distance))*policy.distance,policy.min,policy.max);}
function make(tag,cls){const n=document.createElement(tag);n.className=cls;return n;}
function notify(record,phase,ms=0){root.dispatchEvent(new CustomEvent('review-disclosure-layout',{detail:{element:record.detail,phase,duration:ms}}));}
function natural(record){return Math.max(0,record.inner.getBoundingClientRect().height);}
function pose(record,p,h){record.progress=p;record.height=h;record.body.style.height=h+'px';record.inner.style.opacity=String(p);record.inner.style.transform=`translateY(${(1-p)*-3}px)`;record.icon.style.transform=`rotate(${p*90}deg)`;}
function finish(record,announce=true){
 if(record.job)cancelAnimationFrame(record.job);record.job=0;record.moving=false;
 record.detail.open=record.wanted;record.native=record.wanted;record.body.hidden=!record.wanted;record.body.inert=!record.wanted;
 record.body.dataset.moving='false';record.body.style.height='';record.inner.style.opacity='';record.inner.style.transform='';record.progress=record.wanted?1:0;record.height=record.wanted?record.targetHeight:0;record.icon.style.transform=`rotate(${record.progress*90}deg)`;
 record.summary.setAttribute('aria-expanded',String(record.wanted));record.body.setAttribute('aria-hidden',String(!record.wanted));if(announce)notify(record,'settled');
}
function set(detail,wanted,animate=true){
 const record=records.get(detail)||upgradeOne(detail);if(!record)return;
 wanted=Boolean(wanted);if(record.wanted===wanted&&!record.moving&&record.initialized)return;
 const first=!record.mounted;record.mounted=true;record.wanted=wanted;record.initialized=true;
 if(record.job)cancelAnimationFrame(record.job);
 // Keep native content mounted until closing completes. Intent, not the native
 // open flag during closing, is the state retained by model rerenders.
 record.detail.open=true;record.native=true;record.body.hidden=false;
 record.summary.setAttribute('aria-expanded',String(wanted));record.body.setAttribute('aria-hidden',String(!wanted));record.body.inert=!wanted;
 if(!wanted&&record.body.contains?.(document.activeElement))record.summary.focus({preventScroll:true});
 record.targetHeight=natural(record);
 if(!record.moving&&record.progress===1)record.height=record.targetHeight;
 if(!animate||reduced.matches||detail.hidden||!detail.isConnected){finish(record,!first);return;}
 const from=record.progress,fromHeight=record.height,to=wanted?1:0,toHeight=wanted?record.targetHeight:0;
 const ms=duration(Math.abs(toHeight-fromHeight))*Math.max(.2,Math.abs(to-from));
 record.moving=true;record.body.dataset.moving='true';pose(record,from,fromHeight);notify(record,'start',ms);
 const start=performance.now();
 function tick(now){
  if(!detail.isConnected){dispose(detail);return;}
  const t=clamp((now-start)/ms,0,1),p=ease(t);pose(record,from+(to-from)*p,fromHeight+(toHeight-fromHeight)*p);
  if(t<1)record.job=requestAnimationFrame(tick);else finish(record);
 }
 record.job=requestAnimationFrame(tick);
}
function resize(record){
 if(!record.wanted||!record.detail.isConnected)return;
 if([...records.values()].some(r=>r!==record&&r.moving&&record.inner.contains?.(r.detail)))return;
 const h=natural(record);if(Math.abs(h-record.targetHeight)<.5)return;
 // Restart from the current rendered pose; content resize never resets openness.
 const moving=record.moving;record.targetHeight=h;
 if(moving){record.initialized=false;set(record.detail,true,true);}else{record.height=h;notify(record,'content');}
}
const observer=new ResizeObserver(entries=>{for(const entry of entries||[]){const record=byInner.get(entry.target);if(record)resize(record);}});
function upgradeOne(detail){
 if(detail.hasAttribute?.('data-disclosure-menu'))return null;
 if(records.has(detail))return records.get(detail);
 const summary=[...detail.children].find(e=>e.tagName==='SUMMARY'||e.tag==='summary');if(!summary)return null;
 const icon=make('span','rv-disclosure-icon'),glyph=make('i','');glyph.setAttribute('data-lucide','chevron-right');glyph.setAttribute('aria-hidden','true');glyph.textContent='›';icon.setAttribute('aria-hidden','true');icon.append(glyph);summary.prepend(icon);summary.classList.add('rv-disclosure-summary','cursor-interaction');
 const body=make('div','rv-disclosure-body'),inner=make('div','rv-disclosure-inner');for(const child of [...detail.childNodes||detail.children])if(child!==summary)inner.append(child);body.append(inner);detail.append(body);
 const record={detail,summary,body,inner,icon,wanted:Boolean(detail.open),native:Boolean(detail.open),progress:detail.open?1:0,height:0,targetHeight:0,moving:false,initialized:false,mounted:false,job:0};records.set(detail,record);byInner.set(inner,record);observer.observe(inner);
 summary.addEventListener('click',event=>{if(event.defaultPrevented||event.button>0||event.target.closest?.('a,button,input,select,textarea'))return;event.preventDefault();set(detail,!record.wanted);});
 detail.addEventListener('toggle',()=>{if(Boolean(detail.open)!==record.native)set(detail,Boolean(detail.open),true);});
 set(detail,record.wanted,false);return record;
}
function upgrade(container=root){for(const [detail]of records)if(!detail.isConnected)dispose(detail);for(const detail of container.querySelectorAll('details'))upgradeOne(detail);if(root.querySelector('i[data-lucide]')&&globalThis.lucide?.createIcons)globalThis.lucide.createIcons({attrs:{width:16,height:16}});}
function dispose(detail){const record=records.get(detail);if(!record)return;if(record.job)cancelAnimationFrame(record.job);observer.unobserve?.(record.inner);records.delete(detail);}
const mutations=new MutationObserver(list=>{
 const affected=new Set();let removed=false;
 for(const mutation of list||[]){
  const target=mutation.target.nodeType===3?mutation.target.parentElement:mutation.target,body=target.closest?.('.rv-disclosure-inner'),record=body&&byInner.get(body);if(record)affected.add(record);
  for(const n of mutation.removedNodes||[])if(n.matches?.('details')||n.querySelector?.('details'))removed=true;
  for(const n of mutation.addedNodes||[])if(n.isConnected&&(n.matches?.('details')||n.querySelector?.('details'))){if(n.matches('details'))upgradeOne(n);upgrade(n);}
 }
 if(removed)for(const [detail]of records)if(!detail.isConnected)dispose(detail);
 for(const [host,entry]of activeStatuses)if(!host.isConnected)settleStatus(host,entry);
 for(const record of affected)resize(record);
});mutations.observe(root,{childList:true,subtree:true});
reduced.addEventListener('change',()=>{if(reduced.matches){for(const record of records.values())if(record.moving)finish(record);for(const [host,entry]of activeStatuses)settleStatus(host,entry);}});
function wanted(detail){const record=records.get(detail);if(record&&Boolean(detail.open)!==record.native)set(detail,Boolean(detail.open),false);return record?.wanted??Boolean(detail.open);}
function restore(detail,state){const record=records.get(detail)||upgradeOne(detail);if(!state?.moving){set(detail,state?.wanted??Boolean(state),false);return;}record.detail.open=true;record.native=true;record.body.hidden=false;record.body.dataset.moving='true';record.moving=true;record.initialized=false;pose(record,state.progress,state.height);set(detail,state.wanted,true);}
root.disclosures=Object.freeze({upgrade,set,wanted,restore,snapshot:detail=>{const r=records.get(detail);return r?{wanted:wanted(detail),progress:r.progress,height:r.height,targetHeight:r.targetHeight,moving:r.moving}:null;},duration,dispose});
upgrade();

const statuses=new WeakMap(),activeStatuses=new Map();
function settleStatus(host,entry){
 if(statuses.get(host)!==entry)return;
 for(const animation of entry.animations)animation.cancel();entry.copy?.remove();
 host.style.height='';host.style.overflow='';entry.copy=null;entry.animations=[];activeStatuses.delete(host);
}
function status(titleNode,detailNode,title,detail){
 if(titleNode.textContent===String(title)&&detailNode.textContent===String(detail))return;
 const host=titleNode.parentElement,previous=statuses.get(host),animate=Boolean(previous&&!reduced.matches&&host.animate),before=animate?host.getBoundingClientRect().height:0;if(previous)settleStatus(host,previous);
 const old=animate?host.cloneNode(true):null;
 if(old){old.querySelectorAll('.rv-status-copy').forEach(n=>n.remove());old.classList.add('rv-status-copy');old.setAttribute('aria-hidden','true');old.removeAttribute('aria-live');old.removeAttribute('aria-atomic');old.removeAttribute('id');old.inert=true;for(const n of old.querySelectorAll('[id]'))n.removeAttribute('id');}
 titleNode.textContent=String(title);detailNode.textContent=String(detail);const entry={copy:null,animations:[]};statuses.set(host,entry);
 if(!old)return;
 const after=host.getBoundingClientRect().height;
 host.style.height=after+'px';host.style.overflow='clip';host.append(old);entry.copy=old;
 // Text changes hands rather than crossfading two sentences in the same place.
 const exitMs=90,enterMs=150,duration=exitMs+enterMs;
 // A detail may live in a closed explanation. Animating that hidden node can
 // leave Chromium's finished promise unresolved and retain the outgoing copy.
 const outgoing=old.animate([{opacity:1},{opacity:0}],{duration:exitMs,easing:'ease-out',fill:'forwards'}),incoming=[titleNode,detailNode].filter(n=>n.getBoundingClientRect().height>0).map(n=>n.animate([{opacity:0,transform:'translateY(2px)'},{opacity:1,transform:'translateY(0)'}],{delay:exitMs,duration:enterMs,easing:'ease-out',fill:'both'}));entry.animations=[outgoing,...incoming];
 const sizing=host.animate([{height:before+'px'},{height:after+'px'}],{duration,easing:'ease-out'});entry.animations.push(sizing);
 activeStatuses.set(host,entry);Promise.all(entry.animations.map(a=>a.finished.catch(()=>{}))).then(()=>settleStatus(host,entry));
}
root.reviewUI=Object.freeze({status,settle:()=>{for(const [host,entry]of activeStatuses)settleStatus(host,entry);}});
})();
