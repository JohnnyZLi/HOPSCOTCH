// Generated from the shared reader, transfer, pacing and motion policies.
export function mountPacketMotion(element,scope){
const {document,window,matchMedia,requestAnimationFrame,cancelAnimationFrame,ResizeObserver,MutationObserver}=scope;



(()=>{
'use strict';
const root=element;
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)),mix=(a,b,t)=>a+(b-a)*t,smooth=t=>{t=clamp(t);return t*t*t*(10+t*(-15+6*t));};
const policy=Object.freeze({acquire:100,lift:170,flightSpeed:.56,minFlight:440,maxFlight:1280,seat:280,receive:180,liftRatio:.42,archRatio:.075,paddingRatio:.3});
// Route the complete value footprint through measured text clearance. This is
// prepared once per layout; playback only samples the cached, rounded path.
function clearRoute(from,to,width,height,bounds){
 const gap=Math.max(3,height*.12),right=bounds.x+bounds.w-width-gap,left=bounds.x+gap;
 const obstacles=(bounds.obstacles||[]).map(r=>({x:r.x-width-gap,y:r.y-height-gap,right:r.x+r.w+gap,bottom:r.y+r.h+gap}));
 const inside=(p,r)=>p.x>r.x+.01&&p.x<r.right-.01&&p.y>r.y+.01&&p.y<r.bottom-.01;
 const clear=(a,b)=>!obstacles.some(r=>{
  let lo=0,hi=1;for(const [v,d,min,max]of [[a.x,b.x-a.x,r.x+.01,r.right-.01],[a.y,b.y-a.y,r.y+.01,r.bottom-.01]]){
   if(Math.abs(d)<.0001){if(v<=min||v>=max)return false;}else{const t1=(min-v)/d,t2=(max-v)/d;lo=Math.max(lo,Math.min(t1,t2));hi=Math.min(hi,Math.max(t1,t2));if(lo>hi)return false;}
  }return lo<=hi;
 });
 const xs=[...new Set([from.x,to.x,left,right,...obstacles.flatMap(r=>[r.x,r.right])].filter(x=>x>=left&&x<=right))].sort((a,b)=>a-b);
 const ys=[...new Set([from.y,to.y,bounds.y,...obstacles.flatMap(r=>[Math.max(bounds.y,r.y),r.bottom])])].sort((a,b)=>a-b);
 const nodes=ys.flatMap((y,j)=>xs.map((x,i)=>({x,y,i,j,cost:Infinity,previous:null}))),valid=nodes.map(p=>!obstacles.some(r=>inside(p,r)));
 const start=nodes.findIndex(p=>p.x===from.x&&p.y===from.y),end=nodes.findIndex(p=>p.x===to.x&&p.y===to.y);
 if(start<0||end<0||!valid[start]||!valid[end])return null;
 nodes[start].cost=0;const open=new Set([start]),done=new Set();
 while(open.size){let id=-1,best=Infinity;for(const candidate of open){const n=nodes[candidate],score=n.cost+Math.hypot(n.x-to.x,n.y-to.y);if(score<best){best=score;id=candidate;}}if(id===end)break;open.delete(id);done.add(id);const n=nodes[id];
  for(const [di,dj]of [[-1,0],[1,0],[0,-1],[0,1]]){const i=n.i+di,j=n.j+dj;if(i<0||i>=xs.length||j<0||j>=ys.length)continue;const next=j*xs.length+i,p=nodes[next];if(!valid[next]||done.has(next)||!clear(n,p))continue;const cost=n.cost+Math.hypot(n.x-p.x,n.y-p.y);if(cost<p.cost){p.cost=cost;p.previous=id;open.add(next);}}
 }
 if(!Number.isFinite(nodes[end].cost))return null;
 let route=[];for(let id=end;id!==null;id=nodes[id].previous)route.unshift({x:nodes[id].x,y:nodes[id].y});
 // Remove grid-only stops, then round each corner only within free space.
 route=route.filter((p,i)=>!i||i===route.length-1||Math.abs((p.x-route[i-1].x)*(route[i+1].y-p.y)-(p.y-route[i-1].y)*(route[i+1].x-p.x))>.01);
 const rounded=[route[0]];for(let i=1;i<route.length-1;i++){const a=route[i-1],b=route[i],c=route[i+1],ab=Math.hypot(b.x-a.x,b.y-a.y),bc=Math.hypot(c.x-b.x,c.y-b.y);let radius=Math.min(height,ab/2,bc/2),curve;
  do{const u={x:b.x+(a.x-b.x)*radius/ab,y:b.y+(a.y-b.y)*radius/ab},v={x:b.x+(c.x-b.x)*radius/bc,y:b.y+(c.y-b.y)*radius/bc};curve=Array.from({length:13},(_,j)=>{const t=j/12,s=1-t;return{x:s*s*u.x+2*s*t*b.x+t*t*v.x,y:s*s*u.y+2*s*t*b.y+t*t*v.y};});if(curve.every((p,j)=>!j||clear(curve[j-1],p)))break;radius/=2;}while(radius>.1);
  rounded.push(...curve);
 }rounded.push(route.at(-1));return rounded;
}
function plan(from,to,before,after,note='',bounds=null){
 before=String(before);after=String(after);const sourceFont=from.fontSize||18,targetFont=to.fontSize||sourceFont,sourceH=from.lineHeight||from.h||sourceFont*1.35,targetH=to.lineHeight||to.h||targetFont*1.35,line=Math.max(sourceH,targetH),lift=line*policy.liftRatio;
 const a={x:from.x,y:from.y-lift},b={x:to.x,y:to.y-lift*.7},dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy),arch=Math.min(line*1.2,d*policy.archRatio),points=[],lengths=[];let distance=0;
 const c1={x:a.x+dx*.30,y:a.y+dy*.12-arch},c2={x:b.x-dx*.30,y:b.y-dy*.12-arch};
 const footprint=Math.max(from.glyphWidths?.reduce((a,b)=>a+b,0)||before.length*sourceFont*.55,to.glyphWidths?.reduce((a,b)=>a+b,0)||after.length*targetFont*.55);
 for(let i=0;i<=64;i++){const t=i/64,u=1-t,point={x:u*u*u*a.x+3*u*u*t*c1.x+3*u*t*t*c2.x+t*t*t*b.x,y:u*u*u*a.y+3*u*u*t*c1.y+3*u*t*t*c2.y+t*t*t*b.y};if(bounds&&i>0&&i<64){point.x=clamp(point.x,bounds.x,Math.max(bounds.x,bounds.x+bounds.w-footprint));point.y=Math.max(bounds.y,point.y);}points.push(point);if(i){const prev=points[i-1],len=Math.hypot(point.x-prev.x,point.y-prev.y);lengths.push(len);distance+=len;}}
 // No value-length buckets or per-field routes. A cached arc connects measured glyph anchors.
 const route=Math.hypot(from.x-to.x,from.y-to.y)<line*.25?[{x:from.x,y:from.y},{x:to.x,y:to.y}]:bounds?.obstacles?clearRoute(from,to,footprint,line,bounds):null;
 if(route){points.splice(0,points.length,...route);lengths.length=0;distance=0;for(let i=1;i<points.length;i++){const len=Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y);lengths.push(len);distance+=len;}}
 const flight=clamp(distance/policy.flightSpeed,policy.minFlight,policy.maxFlight),boundaries={acquire:policy.acquire,lift:policy.acquire+policy.lift,flight:policy.acquire+policy.lift+flight,seat:policy.acquire+policy.lift+flight+policy.seat};boundaries.receive=boundaries.seat+policy.receive;
 const fallback=(str,font)=>Array.from(str,()=>font*.55),beforeWidths=from.glyphWidths?.slice(0,before.length)||fallback(before,sourceFont),afterWidths=to.glyphWidths?.slice(0,after.length)||fallback(after,targetFont);
 while(beforeWidths.length<before.length)beforeWidths.push(sourceFont*.55);while(afterWidths.length<after.length)afterWidths.push(targetFont*.55);
 return {from,to,before,after,note,points,lengths,distance,boundaries,duration:boundaries.receive,sourceFont,targetFont,sourceH,targetH,lift:route?0:lift,routed:!!route,annotation:bounds?.annotation,beforeWidths,afterWidths,glyphWidths:afterWidths};
}
function pointAt(p,t){let remaining=smooth(t)*p.distance;for(let i=0;i<p.lengths.length;i++){const len=p.lengths[i];if(remaining<=len||i===p.lengths.length-1){const f=len?clamp(remaining/len):1;return {x:mix(p.points[i].x,p.points[i+1].x,f),y:mix(p.points[i].y,p.points[i+1].y,f)};}remaining-=len;}return p.points.at(-1);}
function sample(p,elapsed){elapsed=clamp(elapsed,0,p.duration);const b=p.boundaries,acquire=smooth(elapsed/b.acquire),lift=smooth((elapsed-b.acquire)/(b.lift-b.acquire)),flight=clamp((elapsed-b.lift)/(b.flight-b.lift)),seat=smooth((elapsed-b.flight)/(b.seat-b.flight)),receive=smooth((elapsed-b.seat)/(b.receive-b.seat));let point;
 if(elapsed<b.lift)point={x:p.from.x,y:p.from.y-p.lift*lift};else if(elapsed<b.flight)point=pointAt(p,flight);else point={x:p.to.x,y:mix(p.to.y-p.lift*.7,p.to.y,seat)};
 const mutation=smooth((flight-.24)/.38),scale=1+.035*lift*(1-seat),shell=lift*(1-seat),phase=elapsed<b.acquire?'acquire':elapsed<b.lift?'lift':elapsed<b.flight?'travel':elapsed<b.seat?'seat':'receive';
 return {x:point.x,y:point.y,acquire,lift,flight,seat,receive,mutation,scale,shell,opacity:acquire,fontSize:mix(p.sourceFont,p.targetFont,smooth(flight)),lineHeight:mix(p.sourceH,p.targetH,smooth(flight)),phase,copyOpacity:1-smooth((receive-.5)/.5),receiverOpacity:smooth(receive/.5),landed:elapsed>=b.seat};
}
function makeView(node,number,note){const body=document.createElement('span');body.className='hs-transfer-body';node.prepend(body);number.className+=' hs-transfer-number';if(note)note.className+=' hs-transfer-note';return {node,number,note,body,key:'',slots:[]};}
function prepare(view,p,key){if(view.key===key)return;view.key=key;view.number.replaceChildren();view.slots=[];for(let i=0;i<Math.max(p.before.length,p.after.length);i++){const slot=document.createElement('span');slot.className='hs-transfer-slot';const old=document.createElement('span'),next=document.createElement('span');old.className='hs-transfer-old';next.className='hs-transfer-new';old.textContent=p.before[i]||'';next.textContent=p.after[i]||'';slot.append(old,next);view.number.append(slot);view.slots.push({slot,old,next,same:p.before[i]===p.after[i]});}}
function draw(view,p,elapsed,key,blendReceiver=false){prepare(view,p,key);const s=sample(p,elapsed),pad=policy.paddingRatio*s.lineHeight*s.shell;view.node.dataset.transferPhase=s.phase;view.node.style.opacity=String(s.opacity*(blendReceiver?s.copyOpacity:1));view.node.style.transform=`translate(${s.x}px,${s.y}px) scale(${s.scale})`;view.node.style.transformOrigin='0 0';view.number.style.fontSize=s.fontSize+'px';view.number.style.lineHeight=s.lineHeight+'px';view.number.style.height=s.lineHeight+'px';view.number.style.fontWeight=String(p.to.fontWeight||p.from.fontWeight||500);view.number.style.color=`color-mix(in srgb,var(--hs-accent) ${(1-s.seat)*100}%,var(--hs-ink))`;
 let oldX=0,newX=0;for(let i=0;i<view.slots.length;i++){const g=view.slots[i],a=p.beforeWidths[i]||0,b=p.afterWidths[i]||0;g.slot.style.left=mix(oldX,newX,s.mutation)+'px';g.slot.style.width=Math.max(a,b)+'px';g.slot.style.height=s.lineHeight+'px';g.old.style.transform=`translateY(${-s.mutation*s.lineHeight}px)`;g.old.style.opacity=String(g.same?0:1-s.mutation);g.next.style.transform=`translateY(${g.same?0:(1-s.mutation)*s.lineHeight}px)`;g.next.style.opacity=String(g.same?1:s.mutation);oldX+=a;newX+=b;}
 const w=mix(oldX,newX,s.mutation);view.number.style.width=w+'px';Object.assign(view.body.style,{left:-pad+'px',top:-pad*.55+'px',width:w+pad*2+'px',height:s.lineHeight+pad*1.1+'px',opacity:String(s.shell),borderRadius:mix(6,12,s.shell)+'px',transform:`translateY(${s.shell*1.5}px)`});if(view.note){view.note.textContent=p.note;view.note.hidden=!p.note;view.note.style.left=(p.annotation?(p.annotation.x-s.x)/s.scale:w/2)+'px';view.note.style.top=(p.annotation?(p.annotation.y-s.y)/s.scale:s.lineHeight+pad+4)+'px';view.note.style.width=p.annotation?p.annotation.w+'px':'';view.note.style.transform=`translateX(-50%) scale(${p.annotation?1/s.scale:1})`;view.note.style.opacity=String(s.lift*(1-s.seat));}return s;
}
function measure(node,origin){const r=node.getBoundingClientRect(),style=getComputedStyle(node),text=node.textContent,glyphWidths=[];for(let i=0;i<text.length;i++){const range=document.createRange();if(range.setStart){range.setStart(node.firstChild,i);range.setEnd(node.firstChild,i+1);glyphWidths.push([...range.getClientRects()].reduce((sum,r)=>sum+r.width,0));}else{range.selectNodeContents(node);glyphWidths.push([...range.getClientRects()].reduce((sum,r)=>sum+r.width,0)/Math.max(1,text.length));}}return {x:r.left-origin.left,y:r.top-origin.top,w:r.width,h:r.height,glyphWidths,fontSize:parseFloat(style.fontSize)||18,lineHeight:parseFloat(style.lineHeight)||r.height,fontWeight:parseFloat(style.fontWeight)||500};}
root.valueTransfer=Object.freeze({policy,plan,sample,draw,makeView,measure});
})();

(()=>{
'use strict';
const root=element;
const policy=Object.freeze({enter:180,exit:220,shortShare:.35});
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*t*(10+t*(-15+6*t));};
function compile(windows){
 const targets=new Map();
 for(const w of windows){if(!w.target||!(w.end>w.start))continue;const a=targets.get(w.target)||[];a.push({start:w.start,end:w.end});targets.set(w.target,a);}
 for(const [target,windows]of targets){windows.sort((a,b)=>a.start-b.start);const merged=[];for(const w of windows){const last=merged.at(-1);if(last&&w.start<=last.end+1e-6)last.end=Math.max(last.end,w.end);else merged.push({...w});}
  targets.set(target,merged.map(w=>{const span=w.end-w.start;return {...w,enter:Math.min(policy.enter,span*policy.shortShare),exit:Number.isFinite(w.end)?Math.min(policy.exit,span*policy.shortShare):0};}));
 }
 return targets;
}
function sample(windows,time,reduced=false){let amount=0;for(const w of windows){if(time<w.start||time>=w.end)continue;if(reduced)return 1;const enter=smooth((time-w.start)/w.enter),exit=w.exit?smooth((w.end-time)/w.exit):1;amount=Math.max(amount,Math.min(enter,exit));}return amount;}
function draw(plan,time,property='--hs-emphasis',reduced=false){for(const [target,windows]of plan)target.style.setProperty(property,String(sample(windows,time,reduced)));}
function readWindows(plan,offset,resolve){
 const groups=new Map();for(const p of plan.phases){if(['travel','finish','unavailable'].includes(p.kind))continue;const g=groups.get(p.id)||{start:Infinity,end:-Infinity};g.start=Math.min(g.start,p.start);g.end=Math.max(g.end,p.end);groups.set(p.id,g);}
 return [...groups].map(([id,w])=>({target:resolve(id),start:offset+w.start,end:offset+w.end}));
}
root.emphasis=Object.freeze({policy,compile,sample,draw,readWindows});
})();

(()=>{
'use strict';
const root=element;
// Shared study tuning, in presentation milliseconds. These are recognition
// budgets for concise outcome facts, not a guarantee of full paragraph reading.
const policy=Object.freeze({orientation:180,minOutcome:900,minHold:180,wordsPerSecond:6.5,symbolsPerSecond:16,betweenFacts:120});
function reading(facts){
 let words=0,symbols=0;
 for(const fact of facts){words+=(String(fact.text??'').match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu)||[]).length;symbols+=Array.from(String(fact.value??'')).length;}
 const requested=policy.orientation+words/policy.wordsPerSecond*1000+symbols/policy.symbolsPerSecond*1000+Math.max(0,facts.length-1)*policy.betweenFacts;
 return {words,symbols,facts:facts.length,budget:facts.length?Math.max(policy.minOutcome,requested):0};
}
function prepare({facts,visibleFor=0,persistent=false}){
 const attention=reading(facts),credit=Math.max(0,visibleFor);
 return {...attention,credit,persistent,hold:persistent||!facts.length?0:Math.max(policy.minHold,attention.budget-credit)};
}
function changedFacts(before,after,fields){
 return fields.filter(field=>!Object.is(before[field.key],after[field.key])).map(field=>({key:field.key,...field.fact(after[field.key],after)}));
}
// Outcomes are inserted into an action clock. The action keeps its original
// geometry and speed; only settled outcomes earn additional wall-clock time.
function schedule(actionDuration,outcomes=[]){
 let added=0;
 const holds=outcomes.map(outcome=>({...outcome,at:Math.max(0,Math.min(actionDuration,outcome.at)),attention:prepare(outcome)})).sort((a,b)=>a.at-b.at).map(outcome=>{
  const start=outcome.at+added,duration=outcome.attention.hold;added+=duration;
  return {...outcome,start,end:start+duration,duration};
 });
 return {actionDuration,duration:actionDuration+added,holds};
}
function locate(plan,elapsed){
 const clock=Math.max(0,Math.min(plan.duration,elapsed));let added=0;
 for(const hold of plan.holds){
  if(clock<hold.start)break;
  if(clock<hold.end)return {actionTime:hold.at,hold:hold.id,progress:(clock-hold.start)/hold.duration};
  added+=hold.duration;
 }
 return {actionTime:Math.max(0,Math.min(plan.actionDuration,clock-added)),hold:null,progress:0};
}
function wallAt(plan,actionTime,after=true){
 let clock=Math.max(0,Math.min(plan.actionDuration,actionTime));
 for(const hold of plan.holds)if(hold.at<actionTime||after&&hold.at===actionTime)clock+=hold.duration;
 return clock;
}
function remap(from,to,elapsed){
 const position=locate(from,elapsed),hold=position.hold===null?null:to.holds.find(h=>h.id===position.hold);
 if(hold)return hold.start+hold.duration*position.progress;
 return wallAt(to,from.actionDuration?position.actionTime/from.actionDuration*to.actionDuration:0);
}
root.pacing=Object.freeze({policy,reading,prepare,changedFacts,schedule,locate,wallAt,remap});
})();



(()=>{const root=element;
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const ease=p=>{p=clamp(p);return p*p*(3-2*p);};
const mix=(a,b,p)=>a+(b-a)*p;
const policy=Object.freeze({zoom:1.32,rim:4,focusRatio:.55,readSpeed:76,travelSpeed:640,minRead:620,acquire:240,result:430,release:180,dockGap:0});
function coverage(line,aperture){
 // Keep the original optical window. Center attention within its narrower
 // focal band so nearly fitting values receive a readable sweep, not a twitch.
 const focusWidth=aperture*policy.focusRatio,inside=Math.min(line.w,focusWidth),start={x:line.x+inside/2,y:line.y+line.h/2},end={x:line.x+line.w-inside/2,y:line.y+line.h/2};
 return {start,end,distance:Math.max(0,line.w-focusWidth)};
}
function makePlan(targets,lens){
 let clock=0,previous=null;const phases=[];
 const push=(id,label,kind,line,ms,a,b,fa,fb,oa=1,ob=1)=>{phases.push({id,label,kind,line,start:clock,end:clock+ms,a,b,fa,fb,oa,ob});clock+=ms;};
 for(const target of targets){
  if(!target.lines.length){const pos=previous||{x:lens.w/2,y:lens.h/2};push(target.id,target.label,'unavailable',0,800,pos,pos,0,0,0,0);continue;}
  target.lines.forEach((line,i)=>{
   const c=coverage(line,(lens.w-2*policy.rim)/policy.zoom),distance=previous?Math.hypot(c.start.x-previous.x,c.start.y-previous.y):0;
   if(previous)push(target.id,target.label,'travel',i,clamp(distance/policy.travelSpeed*1000,180,500),previous,c.start,0,0);
   push(target.id,target.label,'acquire',i,policy.acquire,c.start,c.start,0,1,previous?1:0,1);
   push(target.id,target.label,'read',i,Math.max(policy.minRead,line.w/policy.readSpeed*1000),c.start,c.end,1,1);
   if(i===target.lines.length-1)push(target.id,target.label,'result',i,policy.result,c.end,c.end,1,1);
   push(target.id,target.label,'release',i,policy.release,c.end,c.end,1,0);
   previous=c.end;
  });
 }
 if(previous){const last=targets.at(-1);push(last.id,last.label,'finish',0,180,previous,previous,0,0,1,0);}
 return {phases,total:clock};
}
function samplePlan(plan,time){
 if(!plan.phases.length)return null;
 const t=clamp(time,0,plan.total),phase=plan.phases.find(p=>t<p.end)||plan.phases.at(-1),p=clamp((t-phase.start)/(phase.end-phase.start)),s=phase.kind==='read'?p:ease(p);
 return {...phase,p,x:mix(phase.a.x,phase.b.x,s),y:mix(phase.a.y,phase.b.y,s),focus:mix(phase.fa,phase.fb,ease(p)),opacity:mix(phase.oa,phase.ob,ease(p))};
}
function remapTime(oldPlan,newPlan,time,changedId){
 if(time<=0||!oldPlan.phases.length)return 0;
 const at=samplePlan(oldPlan,time);
 if(changedId&&(at.id===changedId||oldPlan.phases.some(p=>p.id===changedId&&p.kind==='result'&&time>=p.start))){const fresh=newPlan.phases.find(p=>p.id===changedId&&(p.kind==='acquire'||p.kind==='unavailable'));if(fresh)return fresh.start;}
 const candidates=newPlan.phases.filter(p=>p.id===at.id);
 if(!candidates.length)return Math.min(time,newPlan.total);
 if(changedId===at.id)return (candidates.find(p=>p.kind==='acquire')||candidates[0]).start;
 const match=candidates.find(p=>p.kind===at.kind&&p.line===at.line)||candidates.filter(p=>p.kind===at.kind).at(-1)||candidates[0];
 return mix(match.start,match.end,at.p);
}

const fitPolicy=Object.freeze({speed:.22,referenceSpan:40,resistanceFloor:.08,resistancePower:3,
 zoneFraction:.28,zoneSizeFactor:.065,zoneLimit:.45,launchFraction:.12,
 finishFraction:.06,braking:.002});
function fitGeometry(width,heights,anchor,gapScale=1,pixel=1){
 const spread=clamp(width*.075,20,40)*gapScale,depth=Math.min(...heights.filter((_,i)=>i!==anchor));
 return {spread,pixel,contactZone:clamp(Math.min(width*.014,depth*.1),3,6),
  attachZone:Math.min(spread*fitPolicy.zoneLimit,Math.max(spread*fitPolicy.zoneFraction,Math.sqrt(width*depth)*fitPolicy.zoneSizeFactor))};
}
// Precompute a spatial speed profile. Attachment spreads resistance over visible
// travel and reserves only a small final distance for stopping. Detachment keeps
// the previously reviewed response. Playback samples cached data without layout.
function makeAttachmentPlan(from,to,geometry,velocity=0){
 const {spread,pixel}=geometry;
 let brake=null;
 if(velocity*(to-from)<0){
  const room=velocity>0?1-from:from;
  const duration=Math.min(Math.abs(velocity)*spread/fitPolicy.braking,1.8*room/Math.abs(velocity));
  if(duration>0){brake={from,velocity,duration};from+=velocity*duration/2;}
  velocity=0;
 }
 const steps=256,distance=Math.abs(to-from)*spread,times=[0],freeSpeed=.22;
 const position=u=>mix(from,to,(1-Math.cos(Math.PI*u))/2);
 let duration=0;
 if(to&&velocity===0){
  // Original detachment quadrature and response retained.
  const weight=u=>1/(.06+.94*ease(position(u)*spread/geometry.contactZone));
  let previous=weight(0);
  for(let i=1;i<=128;i++){const next=weight(i/128);duration+=(previous+next)/2*distance*Math.PI/(2*freeSpeed*128);times.push(duration);previous=next;}
 }else{
  const zone=geometry.attachZone,launch=Math.min(distance*fitPolicy.launchFraction,zone*.5),finish=Math.min(distance*.2,zone*fitPolicy.finishFraction,pixel);
  const ramp=s=>Math.sqrt(clamp(s)*(2-clamp(s)));
  const travelSpeed=fitPolicy.speed*Math.sqrt(spread/fitPolicy.referenceSpan);
  for(let i=1;i<=steps;i++){
   const u=(i-.5)/steps,gap=position(u)*spread,travel=Math.abs(position(u)-from)*spread;
   const resistance=fitPolicy.resistanceFloor+(1-fitPolicy.resistanceFloor)*Math.pow(ease(gap/zone),fitPolicy.resistancePower);
   const baseSpeed=to?freeSpeed*Math.sin(Math.PI*u)*(.06+.94*ease(gap/geometry.contactZone)):travelSpeed*resistance*ramp(gap/(finish||1));
   const speed=mix(Math.abs(velocity)*spread,baseSpeed,ramp(travel/(launch||1)));
   duration+=distance?distance*Math.PI*Math.sin(Math.PI*u)/(2*Math.max(speed,1e-9)*steps):0;
   times.push(duration);
  }
 }
 return {from,to,times,travelDuration:duration,duration:duration+(brake?.duration||0),brake,initialVelocity:velocity};
}
function attachmentState(plan,clock){
 clock=clamp(clock,0,plan.duration);
 if(clock>=plan.duration)return {amount:plan.to,velocity:0};
 if(plan.brake){const b=plan.brake;if(clock<b.duration)return {amount:b.from+b.velocity*clock*(1-clock/(2*b.duration)),velocity:b.velocity*(1-clock/b.duration)};clock-=b.duration;}
 if(clock===0)return {amount:plan.from,velocity:plan.initialVelocity};
 const times=plan.times;
 let lo=0,hi=times.length-1;
 while(hi-lo>1){const mid=(lo+hi)>>1;if(times[mid]<=clock)lo=mid;else hi=mid;}
 const u=(lo+(clock-times[lo])/(times[hi]-times[lo]))/(times.length-1);
 return {amount:mix(plan.from,plan.to,(1-Math.cos(Math.PI*u))/2),
  velocity:(plan.to-plan.from)*Math.PI*Math.sin(Math.PI*u)/(2*(times.length-1)*(times[hi]-times[lo]))};
}


root.motionPlanner=Object.freeze({clamp,ease,mix,policy,coverage,makePlan,samplePlan,remapTime,fitPolicy,fitGeometry,makeAttachmentPlan,attachmentState});})();
const {clamp,ease,mix,makePlan,samplePlan}=element.motionPlanner;
function readingPlan(targets,lens){
 const measured=makePlan(targets,lens),firstAcquire=measured.phases.find(p=>p.kind==='acquire');let total=0;
 // Acquire once, carry focus between glyph rows, then fade once. Reading
 // speed/coverage stay content-derived; no stop-defocus-reacquire per line.
 const phases=measured.phases.filter(p=>p.kind==='read'||p.kind==='travel'||p.kind==='finish'||p.kind==='unavailable'||p===firstAcquire).map(p=>{
  const duration=p.end-p.start,next={...p,start:total,end:total+duration};
  if(p.kind==='travel')Object.assign(next,{fa:1,fb:1});
  if(p.kind==='finish')Object.assign(next,{fa:1,fb:0});
  total+=duration;return next;
 });
 return {...measured,phases,total};
}

function textLines(element,origin){
 const range=document.createRange();range.selectNodeContents(element);const rows=[];
 for(const r of range.getClientRects())if(r.width&&r.height){const x=r.left-origin.left,y=r.top-origin.top,last=rows.find(x=>Math.abs(x.y-y)<1);if(last){const end=Math.max(last.x+last.w,x+r.width);last.x=Math.min(last.x,x);last.w=end-last.x;last.h=Math.max(last.h,r.height);}else rows.push({x,y,w:r.width,h:r.height});}
 return rows.sort((a,b)=>a.y-b.y||a.x-b.x);
}

const root=element,reduced=matchMedia("(prefers-reduced-motion: reduce)");
const statuses=new WeakMap(),activeStatuses=new Map();
function settleStatus(host,entry){
 if(statuses.get(host)!==entry)return;
 if(entry.timer)clearTimeout(entry.timer);entry.timer=0;
 for(const animation of entry.animations)animation.cancel();entry.copy?.remove();
 host.style.height='';host.style.overflow='';entry.copy=null;entry.animations=[];activeStatuses.delete(host);
}
function status(titleNode,detailNode,title,detail){
 if(titleNode.textContent===String(title)&&detailNode.textContent===String(detail))return;
 const host=titleNode.parentElement,previous=statuses.get(host),animate=Boolean(previous&&!reduced.matches&&host.animate),before=animate?host.getBoundingClientRect().height:0;if(previous)settleStatus(host,previous);
 const old=animate?host.cloneNode(true):null;
 if(old){old.querySelectorAll('.rv-status-copy').forEach(n=>n.remove());old.classList.add('rv-status-copy');old.setAttribute('aria-hidden','true');old.removeAttribute('aria-live');old.removeAttribute('aria-atomic');old.removeAttribute('id');old.inert=true;for(const n of old.querySelectorAll('[id]'))n.removeAttribute('id');}
 titleNode.textContent=String(title);detailNode.textContent=String(detail);const entry={copy:null,animations:[],timer:0};statuses.set(host,entry);
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
 // The compositor may stop advancing after rapid seeks. A bounded completion
 // deadline commits the final text even if native promises never resolve.
 // Settlement, replacement, reduced motion and disposal all cancel this timer.
 entry.timer=setTimeout(()=>settleStatus(host,entry),duration+32);
}

return {status,settleStatus:()=>{for(const [host,entry]of activeStatuses)settleStatus(host,entry);},planner:element.motionPlanner,pacing:element.pacing,transfer:element.valueTransfer,readingPlan,textLines,tuning:Object.freeze({construct:180,localConstruct:360,localRelease:360,morph:620,morphPeakSpeed:1.8,release:440,travelSpeed:.40,minTravel:600,maxTravel:1400,state:650,minimumExposure:900,maxFrameStep:50,ordinaryFrame:250,stallThreshold:600})};
}
