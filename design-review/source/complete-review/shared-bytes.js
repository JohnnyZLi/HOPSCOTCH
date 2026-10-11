(()=>{
'use strict';
const root=document.getElementById('__ROOT__'),metrics=new Map(),watches=new Set();let pending=0,disposed=false;
const number=v=>Math.max(0,parseFloat(v)||0);
// CSS owns the touch target and row budget. Native intrinsic layout owns the
// widest two-character hexadecimal value; no font/string-length buckets.
function layout(grid,available){
 if(disposed||!grid||!available)return null;
 let basis=available;while(basis&&!(basis.clientWidth>0))basis=basis.parentElement;
 if(!basis)return null;
 const gs=getComputedStyle(grid),bs=getComputedStyle(basis),width=grid.clientWidth?Math.max(0,grid.clientWidth-number(gs.paddingLeft)-number(gs.paddingRight)):Math.max(0,basis.clientWidth-number(bs.paddingLeft)-number(bs.paddingRight));if(!(width>0))return null;
 let probe=null,sample=grid.querySelector('button'),cell;
 function measureHost(){
  if(probe)return;probe=grid.cloneNode(false);probe.removeAttribute('id');probe.setAttribute('aria-hidden','true');probe.inert=true;probe.hidden=false;probe.classList.add('rv-byte-measure');
  Object.assign(probe.style,{position:'absolute',visibility:'hidden',pointerEvents:'none',display:'grid',gridTemplateColumns:'max-content',width:'max-content',height:'0',overflow:'hidden',left:'0',top:'0',columnGap:'0',rowGap:'0'});
  sample=document.createElement('button');sample.type='button';sample.textContent='00';probe.append(sample);basis.append(probe);
 }
 try{
  if(!sample)measureHost();
  const cs=getComputedStyle(sample),key=JSON.stringify(['font','fontFamily','fontSize','fontWeight','fontStretch','fontFeatureSettings','fontVariationSettings','fontVariantNumeric','letterSpacing','textTransform','paddingLeft','paddingRight','borderLeftWidth','borderRightWidth','marginLeft','marginRight','minWidth'].map(k=>cs[k]));cell=metrics.get(key);
  if(cell===undefined){
   measureHost();
   const values=[];for(let i=1;i<256;i++){const b=sample.cloneNode(false);b.textContent=i.toString(16).padStart(2,'0').toUpperCase();values.push(b);}probe.append(...values);
   // One batched layout read for the entire bounded hexadecimal alphabet.
   cell=Math.ceil(probe.getBoundingClientRect().width);if(!(cell>0))return null;
   metrics.set(key,cell);while(metrics.size>16)metrics.delete(metrics.keys().next().value);
  }
 }finally{probe?.remove();}
 const gap=String(gs.columnGap).endsWith('%')?number(gs.columnGap)*width/100:number(gs.columnGap),rows=Math.max(1,Math.floor(number(gs.getPropertyValue('--rv-byte-rows')))||1),columns=Math.max(1,Math.floor((width+gap)/(cell+gap)));
 grid.style.setProperty('--rv-byte-cell-min',cell+'px');grid.dataset.byteColumns=String(columns);grid.dataset.byteCell=String(cell);
 return {width,cell,gap,rows,columns,capacity:columns*rows,signature:[width,cell,gap,rows,columns].join('|')};
}
function page({length,start=0,capacity,selected=-1,reveal=false}){
 capacity=Math.max(1,Math.floor(capacity)||1);length=Math.max(0,Math.floor(length)||0);
 const last=Math.max(0,Math.floor((length-1)/capacity)*capacity);start=Math.min(last,Math.max(0,Math.floor((Number(start)||0)/capacity)*capacity));
 if(reveal&&Number.isInteger(selected)&&selected>=0&&selected<length&&(selected<start||selected>=start+capacity))start=Math.floor(selected/capacity)*capacity;
 return {start,end:Math.min(length,start+capacity),capacity};
}
function queue(){if(disposed||pending||!watches.size)return;pending=requestAnimationFrame(()=>{pending=0;if(!root.isConnected){dispose();return;}for(const w of [...watches]){if(!w.container.isConnected){w.stop();continue;}w.refresh();}});}
function invalidate(){metrics.clear();queue();}
function watch(container,refresh){if(disposed)return()=>{};const observer=new ResizeObserver(queue),w={container,refresh,stop:()=>{observer.disconnect();watches.delete(w);}};watches.add(w);observer.observe(container);return w.stop;}
document.fonts?.ready.then(invalidate);document.fonts?.addEventListener('loadingdone',invalidate);
function dispose(){disposed=true;if(pending)cancelAnimationFrame(pending);pending=0;for(const w of [...watches])w.stop();metrics.clear();document.fonts?.removeEventListener('loadingdone',invalidate);}
root.byteWindows=Object.freeze({layout,page,watch,invalidate,refresh:queue,stats:()=>({metricEntries:metrics.size,watches:watches.size,pending:Boolean(pending)}),dispose});
})();
