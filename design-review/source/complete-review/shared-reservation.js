(()=>{
'use strict';
const root=document.getElementById('__ROOT__');
// Measure alternate content outside its hiding ancestor. The reserved region is
// derived from visible source content and type, not from viewport-name buckets.
let reservationEpoch=0;const reservations=new WeakMap(),bindings=new Map();let fitJob=0,disposed=false;
function invalidate(){reservationEpoch++;}
function reservationLimit(){return Math.max(340,(window.innerHeight||720)*.7);}
// The measured layout mode is authoritative; container queries supply the
// initial no-script fallback, never a second device-category decision.
function adapt(container,panes,duration=0){
 if(getComputedStyle(container).getPropertyValue('--rv-pane-mode').trim()==='exclusive')return reserve(container,panes,container.clientWidth,duration);
 container.style.minHeight='';reservations.delete(container);return 0;
}
// Readability minima are shared type-relative policies. Compare them with the
// component's content box, not an unrelated viewport/device breakpoint.
function fit(container){
 const binding=bindings.get(container);if(!binding||!container.isConnected)return null;
 const style=getComputedStyle(container),font=parseFloat(style.fontSize)||14;
 const resolve=(key,fallback)=>{const text=style.getPropertyValue(key).trim(),n=parseFloat(text);return Number.isFinite(n)?n*(text.endsWith('em')?font:1):fallback*font;};
 const padding=(parseFloat(style.paddingLeft)||0)+(parseFloat(style.paddingRight)||0),width=Math.max(0,container.clientWidth-padding),gapText=String(style.columnGap||'').trim(),gapNumber=parseFloat(gapText),gap=gapText==='normal'?0:Number.isFinite(gapNumber)?Math.max(0,gapNumber*(gapText.endsWith('%')?width/100:1)):24;
 const primary=resolve('--rv-primary-min',32),detail=resolve('--rv-detail-min',20),exclusive=width<primary+detail+gap,mode=exclusive?'exclusive':'parallel';
 if(!(width>0))return null;
 const textKey=[font,style.fontFamily,style.fontWeight,style.fontStretch,style.fontFeatureSettings,style.fontVariationSettings,style.letterSpacing,style.lineHeight].join('|');if(binding.textKey!==textKey){binding.textKey=textKey;invalidate();}
 const key=[width,textKey,gap,primary,detail,reservationLimit()].join('|');if(binding.key===key)return binding.result;
 if(exclusive&&container.dataset.layoutMode==='parallel'){const focused=binding.panes.findIndex(pane=>pane.contains(document.activeElement));if(focused>=0)container.dataset.pane=binding.names[focused];}
 binding.key=key;binding.result={width,font,gap,primary,detail,mode};container.dataset.layoutMode=mode;container.style.setProperty('--rv-pane-mode',mode);
 if(!container.dataset.pane)container.dataset.pane=binding.names[0];
 for(const toggle of binding.toggles){toggle.hidden=!exclusive;toggle.style.display=exclusive?'flex':'none';for(const b of toggle.children)b.setAttribute('aria-pressed',String(b.dataset.pane===container.dataset.pane));}
 if(!exclusive){container.style.minHeight='';reservations.delete(container);}else adapt(container,binding.panes);
 binding.changed?.(binding.result);return binding.result;
}
function refresh(){if(!disposed&&!fitJob)fitJob=requestAnimationFrame(()=>{fitJob=0;for(const container of bindings.keys())fit(container);});}
const fitObserver=new ResizeObserver(refresh);
window.addEventListener('resize',refresh);
function watch(container,{panes,toggles=[],names=['scene','detail'],changed}={}){
 if(disposed||bindings.has(container))return;
 const binding={panes,names,toggles,changed,key:'',result:null};bindings.set(container,binding);fitObserver.observe(container);
 for(const toggle of toggles)for(const button of toggle.children)button.addEventListener('click',()=>{if(disposed)return;container.dataset.pane=button.dataset.pane;for(const t of toggles)for(const b of t.children)b.setAttribute('aria-pressed',String(b.dataset.pane===button.dataset.pane));changed?.(binding.result);});
 fit(container);
}
function fontsChanged(){if(disposed)return;invalidate();for(const b of bindings.values())b.key='';refresh();}
document.fonts?.ready.then(fontsChanged);document.fonts?.addEventListener('loadingdone',fontsChanged);
function reserve(container,panes,width,duration=0){
 if(!container||!panes.length||!(width>0))return 0;
 const limit=reservationLimit(),previous=reservations.get(container);if(previous?.width===width&&previous.epoch===reservationEpoch&&previous.limit===limit)return previous.height;
 const host=root.querySelector('.rv-main');let maximum=0;
 for(const pane of panes){
  const probe=pane.cloneNode(true);probe.removeAttribute('id');probe.setAttribute('aria-hidden','true');probe.inert=true;probe.hidden=false;
  const originals=pane.querySelectorAll('details'),copies=probe.querySelectorAll('details');for(let i=0;i<copies.length;i++){const open=root.disclosures.wanted(originals[i]);copies[i].open=open;const body=copies[i].querySelector('.rv-disclosure-body'),inner=copies[i].querySelector('.rv-disclosure-inner');if(body){body.hidden=!open;body.style.height='';}if(inner){inner.style.transform='';inner.style.opacity='';}}
  Object.assign(probe.style,{display:'block',position:'absolute',visibility:'hidden',width:width+'px',minHeight:'0',height:'auto',left:'0',top:'0'});host.append(probe);maximum=Math.max(maximum,probe.getBoundingClientRect().height);probe.remove();
 }
 // Reserve at most one readable screen; an expanded active pane may naturally
 // grow. Hidden deep evidence must not create thousands of blank scene pixels.
 const target=Math.ceil(Math.min(maximum,limit));container.style.transition=duration?`min-height ${duration}ms cubic-bezier(.33,1,.68,1)`:'none';container.style.minHeight=target+'px';reservations.set(container,{width,epoch:reservationEpoch,limit,height:target});return target;
}
function overview(element,plan,camera,viewport){
 if(!element||!plan)return;
 const svg=(tag,attrs)=>{const n=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,String(v));return n;};
 if(element._geometry!==plan){
  element._geometry=plan;element.setAttribute('viewBox',`0 0 ${plan.width} ${plan.height}`);element.replaceChildren();
  const weight=plan.width/400;
  root.networkScene.draw(element,plan.links);for(const line of element.querySelectorAll('[data-edge]'))line.setAttribute('stroke-width',weight);
  for(const n of plan.nodes)element.append(svg('rect',{x:n.x-n.w/2,y:n.y-n.h/2,width:n.w,height:n.h,rx:12,fill:'var(--hs-muted)',opacity:.65}));
  element._camera=svg('rect',{fill:'none',stroke:'var(--hs-accent)','stroke-width':2*weight,rx:14});element.append(element._camera);
 }
 const x=Math.max(0,-camera.x/camera.z),y=Math.max(0,-camera.y/camera.z),right=Math.min(plan.width,(viewport.w-camera.x)/camera.z),bottom=Math.min(plan.height,(viewport.h-camera.y)/camera.z);
 for(const [key,value]of Object.entries({x,y,width:Math.max(0,right-x),height:Math.max(0,bottom-y)}))element._camera.setAttribute(key,value);
}
function resizeCamera(camera,before,after,anchor=null){
 if(!(before.w>0&&before.h>0&&after.w>0&&after.h>0))return {...camera};
 if(before.w===after.w&&before.h===after.h)return {...camera};
 const center={x:(before.w/2-camera.x)/camera.z,y:(before.h/2-camera.y)/camera.z};
 const next={x:after.w/2-center.x*camera.z,y:after.h/2-center.y*camera.z,z:camera.z};
 if(anchor){
  const half={x:anchor.w*camera.z/2,y:anchor.h*camera.z/2},old={x:camera.x+anchor.x*camera.z,y:camera.y+anchor.y*camera.z};
  // Preserve deliberate panning. Only protect a selection that was visible.
  if(old.x-half.x>=0&&old.x+half.x<=before.w&&old.y-half.y>=0&&old.y+half.y<=before.h){
   for(const [axis,extent]of [['x','w'],['y','h']]){const margin=Math.min(12,after[extent]/10),low=half[axis]+margin,high=after[extent]-low,position=next[axis]+anchor[axis]*camera.z;next[axis]+=low<=high?Math.max(low,Math.min(high,position))-position:after[extent]/2-position;}
  }
 }
 return next;
}
function zoomCamera(camera,viewport,zoom){
 const world={x:(viewport.w/2-camera.x)/camera.z,y:(viewport.h/2-camera.y)/camera.z};
 return {x:viewport.w/2-world.x*zoom,y:viewport.h/2-world.y*zoom,z:zoom};
}
// Framing is a geometric fit, independent of the preferred inspection zoom.
// The same bounds can describe a complete world or one selected path.
function frameCamera(bounds,viewport,padding=16,maxZoom=1){
 const gap=Math.max(0,Math.min(padding,viewport.w/4,viewport.h/4)),w=Math.max(1,bounds.right-bounds.left),h=Math.max(1,bounds.bottom-bounds.top),z=Math.min(maxZoom,Math.max(1,viewport.w-gap*2)/w,Math.max(1,viewport.h-gap*2)/h);
 return {x:viewport.w/2-(bounds.left+bounds.right)*z/2,y:viewport.h/2-(bounds.top+bounds.bottom)*z/2,z};
}
// Native controls may be recreated when their semantic source changes. Retain
// their focus and disclosure by identity, without constructing selectors from
// arbitrary imported labels. A persistent focused control is never refocused.
const interactionMemory=new WeakMap();
function retainInteraction(container,draw,scope='default'){
 const active=document.activeElement,attrs=['data-evidence-fact','data-field-id','data-byte','data-focus-key','aria-label'],identity=active&&attrs.map(key=>({key,value:active.getAttribute?.(key)})).find(x=>x.value!==undefined&&x.value!==null);
 const memory=interactionMemory.get(container)||{scope,opened:new Map()},opened=memory.opened;
 // Repeated "Why" or "Source" summaries are separate disclosures. Explicit
 // source keys take precedence; structural paths disambiguate generic records.
 const disclosureKey=e=>{const explicit=e.getAttribute('data-disclosure-key');if(explicit)return explicit;const path=[];let n=e;while(n&&n!==container){path.unshift(n.parentElement?[...n.parentElement.children].indexOf(n):0);n=n.parentElement;}return JSON.stringify([path,e.querySelector('summary')?.textContent]);};
 root.disclosures.upgrade(container);
 for(const detail of container.querySelectorAll('details')){const key=memory.scope+'|'+disclosureKey(detail),state=root.disclosures.snapshot(detail);if(state?.wanted||state?.moving||opened.has(key)){opened.delete(key);opened.set(key,state);}}
 while(opened.size>512)opened.delete(opened.keys().next().value);
 invalidate();const result=draw();root.disclosures.upgrade(container);
 const sameContext=memory.scope===scope;memory.scope=scope;interactionMemory.set(container,memory);
 for(const detail of container.querySelectorAll('details')){const key=scope+'|'+disclosureKey(detail);if(opened.has(key)){const state=opened.get(key);if(sameContext)root.disclosures.restore(detail,state);else root.disclosures.set(detail,state.wanted,false);}}
 if(identity&&!active.isConnected){let next=[...container.querySelectorAll('['+identity.key+']')].find(e=>e.getAttribute(identity.key)===identity.value);if(next?.disabled)next=[...next.parentElement.querySelectorAll('button,input,select')].find(e=>!e.disabled&&!e.hidden);next?.focus({preventScroll:true});}
 return result;
}
root.layoutReservation=Object.freeze({reserve,adapt,watch,fit,refresh,overview,resizeCamera,zoomCamera,frameCamera,retainInteraction,invalidate,dispose:()=>{disposed=true;if(fitJob)cancelAnimationFrame(fitJob);fitJob=0;fitObserver.disconnect();window.removeEventListener('resize',refresh);document.fonts?.removeEventListener('loadingdone',fontsChanged);bindings.clear();},stats:()=>({bindings:bindings.size,pending:Boolean(fitJob)})});
})();
