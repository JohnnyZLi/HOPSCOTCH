// Generated from the approved composition. Shared material, geometry, and UI.
import {createRuntimeScope} from '../../design-review/source/complete-review/integration-scope.js';
import {createNetworkPlanner} from './network-planner';
import {mountMaterialFoundation} from './material-runtime.js';
export function mountFoundation(element){
const originalKeys=new Set(Reflect.ownKeys(element));
const scope=createRuntimeScope(element),{document,window,matchMedia,requestAnimationFrame,cancelAnimationFrame,ResizeObserver,MutationObserver}=scope;
mountMaterialFoundation(element,scope);



(()=>{
'use strict';
const root=element;
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)),mix=(a,b,t)=>a+(b-a)*t,smooth=t=>{t=clamp(t);return t*t*t*(10+t*(-15+6*t));};
const policy=Object.freeze({acquire:100,lift:170,flightSpeed:.56,minFlight:440,maxFlight:1280,seat:280,receive:180,liftRatio:.42,archRatio:.075,paddingRatio:.3});
function plan(from,to,before,after,note='',bounds=null){
 before=String(before);after=String(after);const sourceFont=from.fontSize||18,targetFont=to.fontSize||sourceFont,sourceH=from.lineHeight||from.h||sourceFont*1.35,targetH=to.lineHeight||to.h||targetFont*1.35,line=Math.max(sourceH,targetH),lift=line*policy.liftRatio;
 const a={x:from.x,y:from.y-lift},b={x:to.x,y:to.y-lift*.7},dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy),arch=Math.min(line*1.2,d*policy.archRatio),points=[],lengths=[];let distance=0;
 const c1={x:a.x+dx*.30,y:a.y+dy*.12-arch},c2={x:b.x-dx*.30,y:b.y-dy*.12-arch};
 const footprint=Math.max(from.glyphWidths?.reduce((a,b)=>a+b,0)||before.length*sourceFont*.55,to.glyphWidths?.reduce((a,b)=>a+b,0)||after.length*targetFont*.55);
 for(let i=0;i<=64;i++){const t=i/64,u=1-t,point={x:u*u*u*a.x+3*u*u*t*c1.x+3*u*t*t*c2.x+t*t*t*b.x,y:u*u*u*a.y+3*u*u*t*c1.y+3*u*t*t*c2.y+t*t*t*b.y};if(bounds&&i>0&&i<64){point.x=clamp(point.x,bounds.x,Math.max(bounds.x,bounds.x+bounds.w-footprint));point.y=Math.max(bounds.y,point.y);}points.push(point);if(i){const prev=points[i-1],len=Math.hypot(point.x-prev.x,point.y-prev.y);lengths.push(len);distance+=len;}}
 // No value-length buckets or per-field routes. A cached arc connects measured glyph anchors.
 const flight=clamp(distance/policy.flightSpeed,policy.minFlight,policy.maxFlight),boundaries={acquire:policy.acquire,lift:policy.acquire+policy.lift,flight:policy.acquire+policy.lift+flight,seat:policy.acquire+policy.lift+flight+policy.seat};boundaries.receive=boundaries.seat+policy.receive;
 const fallback=(str,font)=>Array.from(str,()=>font*.55),beforeWidths=from.glyphWidths?.slice(0,before.length)||fallback(before,sourceFont),afterWidths=to.glyphWidths?.slice(0,after.length)||fallback(after,targetFont);
 while(beforeWidths.length<before.length)beforeWidths.push(sourceFont*.55);while(afterWidths.length<after.length)afterWidths.push(targetFont*.55);
 return {from,to,before,after,note,points,lengths,distance,boundaries,duration:boundaries.receive,sourceFont,targetFont,sourceH,targetH,lift,beforeWidths,afterWidths,glyphWidths:afterWidths};
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
 const w=mix(oldX,newX,s.mutation);view.number.style.width=w+'px';Object.assign(view.body.style,{left:-pad+'px',top:-pad*.55+'px',width:w+pad*2+'px',height:s.lineHeight+pad*1.1+'px',opacity:String(s.shell),borderRadius:mix(6,12,s.shell)+'px',transform:`translateY(${s.shell*1.5}px)`});if(view.note){view.note.textContent=p.note;view.note.hidden=!p.note;view.note.style.left=w/2+'px';view.note.style.top=s.lineHeight+pad+4+'px';view.note.style.opacity=String(s.lift*(1-s.seat));}return s;
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
(()=>{const root=element;
function hash(s){let n=2166136261;for(const c of s)n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;}
function atlasLayout(graph,measure){
 const nodes=graph.nodes.slice().sort((a,b)=>a.id.localeCompare(b.id)),N=nodes.length,ix=new Map(nodes.map((n,i)=>[n.id,i])),edges=graph.links.map(l=>[ix.get(l.a),ix.get(l.b)]),adj=nodes.map(()=>new Set());for(const [a,b]of edges){adj[a].add(b);adj[b].add(a);}
 const best=[];
 for(let seed=0;seed<5;seed++){
  const p=nodes.map(n=>{const a=hash(n.id+'a'+seed)/4294967296*Math.PI*2,r=40+hash(n.id+'b'+seed)%160;return {x:Math.cos(a)*r*1.3,y:Math.sin(a)*r,vx:0,vy:0};});
  for(let t=0;t<800;t++){
   const f=p.map(a=>({x:-a.x*.004,y:-a.y*.006}));
   for(let i=0;i<N;i++)for(let j=i+1;j<N;j++){const a=p[i],b=p[j],dx=b.x-a.x,dy=b.y-a.y,d=Math.max(.01,Math.hypot(dx,dy)),minimum=78,force=d<minimum?(minimum-d)*.28:Math.min(.65,1000/(d*d));f[i].x-=dx/d*force;f[i].y-=dy/d*force;f[j].x+=dx/d*force;f[j].y+=dy/d*force;}
   for(const [i,j]of edges){const a=p[i],b=p[j],dx=b.x-a.x,dy=b.y-a.y,d=Math.max(.01,Math.hypot(dx,dy)),common=[...adj[i]].filter(k=>adj[j].has(k)).length,ideal=100-common*6,force=(d-ideal)*.045;f[i].x+=dx/d*force;f[i].y+=dy/d*force;f[j].x-=dx/d*force;f[j].y-=dy/d*force;}
   const cooling=1-t/1000;p.forEach((a,i)=>{a.vx=(a.vx+f[i].x)*.65;a.vy=(a.vy+f[i].y)*.65;a.x+=Math.max(-5,Math.min(5,a.vx))*cooling;a.y+=Math.max(-5,Math.min(5,a.vy))*cooling;});
  }
  let score=0;for(const [i,j]of edges)score+=Math.hypot(p[i].x-p[j].x,p[i].y-p[j].y);
  for(let i=0;i<edges.length;i++)for(let j=i+1;j<edges.length;j++){const [a,b]=edges[i],[c,d]=edges[j];if(a===c||a===d||b===c||b===d)continue;const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);if(cross(p[a],p[b],p[c])*cross(p[a],p[b],p[d])<0&&cross(p[c],p[d],p[a])*cross(p[c],p[d],p[b])<0)score+=60;}
  best.push({p,score});
 }
 best.sort((a,b)=>a.score-b.score);const p=best[0].p;
 const positions=nodes.map((n,i)=>({...n,x:p[i].x,y:p[i].y,label:n.label,w:Math.max(44,measure(n.label)+12),h:54}));
 for(let t=0;t<180;t++)for(let i=0;i<N;i++)for(let j=i+1;j<N;j++){const a=positions[i],b=positions[j],dx=b.x-a.x,dy=b.y-a.y,ox=(a.w+b.w)/2+24-Math.abs(dx),oy=82-Math.abs(dy);if(ox>0&&oy>0){if(ox<oy){const f=ox*.51*(dx>=0?1:-1);a.x-=f;b.x+=f;}else{const f=oy*.51*(dy>=0?1:-1);a.y-=f;b.y+=f;}}}
 const minX=Math.min(...positions.map(p=>p.x-p.w/2)),minY=Math.min(...positions.map(p=>p.y-16));positions.forEach(p=>{p.x+=30-minX;p.y+=30-minY;});
 return {positions,width:Math.max(...positions.map(p=>p.x+p.w/2))+30,height:Math.max(...positions.map(p=>p.y+38))+30};
}

const baseLayout=atlasLayout;
const STEP=8,DIR=[[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]];
class Heap{constructor(){this.a=[];}push(v){const a=this.a;let i=a.length;a.push(v);while(i){let p=(i-1)>>1;if(a[p][0]<=v[0])break;a[i]=a[p];i=p;}a[i]=v;}pop(){const a=this.a,r=a[0],v=a.pop();if(a.length){let i=0;while(i*2+1<a.length){let j=i*2+1;if(j+1<a.length&&a[j+1][0]<a[j][0])j++;if(a[j][0]>=v[0])break;a[i]=a[j];i=j;}a[i]=v;}return r;}}
function layout(graph,scale=1,measure=s=>s.length*7,authored=null){const p=authored?{positions:graph.nodes.map(n=>({...n,x:(authored[n.id]?.x??50)*6,y:(authored[n.id]?.y??50)*6}))}:baseLayout(graph,measure);for(const n of p.positions){n.x=Math.round(n.x*scale/STEP)*STEP+80;n.y=Math.round(n.y*scale/STEP)*STEP+80;const box=measure.box?.(n.label);n.w=Math.max(48,Math.ceil((box?.w??(measure(n.label)+20))/16)*16);n.radius=box?.radius??15;n.h=box?Math.max(32,Math.ceil(box.h/16)*16):32;if(box)n.labelLines=box.lines;}
 const ids=new Map(p.positions.map(n=>[n.id,n]));
 for(const n of p.positions){n.sides=[[],[],[],[]];for(const l of graph.links){if(l.a!==n.id&&l.b!==n.id)continue;const b=ids.get(l.a===n.id?l.b:l.a),dx=b.x-n.x,dy=b.y-n.y,side=Math.abs(dx)>Math.abs(dy)?(dx>0?0:2):(dy>0?1:3);n.sides[side].push({id:l.id,order:side%2?b.x:b.y});}for(const a of n.sides)a.sort((a,b)=>a.order-b.order||a.id.localeCompare(b.id));n.h=Math.max(n.h,Math.ceil((2*(Math.floor(Math.max(n.sides[0].length,n.sides[2].length)/2)*STEP+n.radius+4))/16)*16);n.w=Math.max(n.w,Math.ceil((2*(Math.floor(Math.max(n.sides[1].length,n.sides[3].length)/2)*STEP+n.radius+4))/16)*16);}
 for(let t=0;t<250;t++)for(let i=0;i<p.positions.length;i++)for(let j=i+1;j<p.positions.length;j++){const a=p.positions[i],b=p.positions[j],dx=b.x-a.x,dy=b.y-a.y,ox=(a.w+b.w)/2+48-Math.abs(dx),oy=(a.h+b.h)/2+48-Math.abs(dy);if(ox>0&&oy>0){const push=Math.ceil(Math.min(ox,oy)/16)*8;if(ox<oy){a.x-=push*(dx>=0?1:-1);b.x+=push*(dx>=0?1:-1);}else{a.y-=push*(dy>=0?1:-1);b.y+=push*(dy>=0?1:-1);}}}
 const x0=Math.min(...p.positions.map(n=>n.x-n.w/2)),y0=Math.min(...p.positions.map(n=>n.y-n.h/2));for(const n of p.positions){n.x+=80-x0;n.y+=80-y0;n.ports={};n.sides.forEach((list,side)=>list.forEach((l,i)=>{const off=(i-Math.floor(list.length/2))*STEP;const pt=side===0?[n.x+n.w/2,n.y+off]:side===2?[n.x-n.w/2,n.y+off]:side===1?[n.x+off,n.y+n.h/2]:[n.x+off,n.y-n.h/2];const d=DIR[side*2];n.ports[l.id]={pt,stub:[pt[0]+d[0]*16,pt[1]+d[1]*16],dir:side*2};}));}
 return {nodes:p.positions,width:Math.max(...p.positions.map(n=>n.x+n.w/2))+80,height:Math.max(...p.positions.map(n=>n.y+n.h/2))+80};}
function solve(graph,world,reverse=false){const W=Math.ceil(world.width/STEP)+1,H=Math.ceil(world.height/STEP)+1,blocked=new Uint8Array(W*H),ids=new Map(world.nodes.map(n=>[n.id,n]));for(const n of world.nodes)for(let y=(n.y-n.h/2-8)/STEP;y<=(n.y+n.h/2+8)/STEP;y++)for(let x=(n.x-n.w/2-8)/STEP;x<=(n.x+n.w/2+8)/STEP;x++)blocked[y*W+x]=1;
 for(const n of world.nodes)for(const p of Object.values(n.ports))blocked[p.stub[1]/STEP*W+p.stub[0]/STEP]=1;
 const edgeKey=(a,b)=>a<b?a+':'+b:b+':'+a;
 let used=new Set(),occupied=new Map();
 function register(r){for(let i=1;i<r.raw.length;i++){const a=r.raw[i-1],b=r.raw[i],dx=Math.sign(b[0]-a[0]),dy=Math.sign(b[1]-a[1]),d=DIR.findIndex(v=>v[0]===dx&&v[1]===dy),u=a[1]*W+a[0],v=b[1]*W+b[0];used.add(edgeKey(u,v));for(const c of [u,v])occupied.set(c,(occupied.get(c)||0)|(1<<d)|(1<<((d+4)%8)));}}
 function route(l){const a=ids.get(l.a).ports[l.id],b=ids.get(l.b).ports[l.id],start=a.stub.map(v=>v/STEP),end=b.stub.map(v=>v/STEP),endCell=end[1]*W+end[0],s=(start[1]*W+start[0])*8+a.dir,N=W*H*8,g=new Float64Array(N);g.fill(Infinity);g[s]=0;const prev=new Int32Array(N);prev.fill(-1);const heap=new Heap();heap.push([0,s,0]);let goal=-1;
  while(heap.a.length){const [,state,cost]=heap.pop();if(cost!==g[state])continue;const cell=Math.floor(state/8),dir=state%8,x=cell%W,y=Math.floor(cell/W);if(cell===endCell){goal=state;break;}
   for(let d=0;d<8;d++){const [dx,dy]=DIR[d],nx=x+dx,ny=y+dy;if(nx<1||ny<1||nx>=W-1||ny>=H-1)continue;const nc=ny*W+nx;if((blocked[nc]&&nc!==endCell)||used.has(edgeKey(cell,nc)))continue;const maskHere=occupied.get(cell)||0,maskNext=occupied.get(nc)||0;const singleAxis=m=>m===17||m===34||m===68||m===136;if(maskHere&&(d!==dir||!singleAxis(maskHere)||(maskHere&(1<<d))))continue;if(maskNext&&(!singleAxis(maskNext)||(maskNext&(1<<d))))continue;if(dx&&dy&&(blocked[y*W+nx]||blocked[ny*W+x]))continue;
    let penalty=0;for(const c of [cell,nc]){const mask=occupied.get(c)||0;if(mask&((1<<d)|(1<<((d+4)%8))))penalty+=140;else if(mask){for(let k=0;k<4;k++)if(mask&(1<<k)){const angle=Math.min((d-k+8)%4,(k-d+8)%4);penalty+=angle===2?12:40;}}}
    if(dx&&dy&&used.has(edgeKey(y*W+nx,ny*W+x)))penalty+=20;
    const mask=1<<d|1<<((d+4)%8);for(const [ox,oy]of [[-dy,dx],[dy,-dx]]){const px=x+ox,py=y+oy;if(px>=0&&px<W&&py>=0&&py<H&&(occupied.get(py*W+px)||0)&mask)penalty+=5;}
    const turn=Math.min((d-dir+8)%8,(dir-d+8)%8);const next=nc*8+d,ng=cost+(dx&&dy?11.314:8)+(turn?30+turn*5:0)+penalty;if(ng<g[next]){g[next]=ng;prev[next]=state;const ex=Math.abs(nx-end[0]),ey=Math.abs(ny-end[1]);heap.push([ng+8*Math.max(ex,ey)+3.314*Math.min(ex,ey),next,ng]);}
   }
  }
  if(goal<0)throw Error('No route for '+l.id);const raw=[];for(let k=goal;k>=0;k=prev[k]){const cell=Math.floor(k/8);raw.push([cell%W,Math.floor(cell/W)]);}raw.reverse();const full=[a.pt.map(v=>v/STEP),...raw,b.pt.map(v=>v/STEP)];const points=[];for(let i=0;i<full.length;i++){const prev=full[i-1],next=full[i+1],v=full[i];if(!prev||!next||(v[0]-prev[0])*(next[1]-v[1])!==(v[1]-prev[1])*(next[0]-v[0]))points.push(v.map(c=>c*STEP));}return {...l,raw,points,cost:g[goal]};
 }
 const ordered=graph.links.slice().sort((a,b)=>{const length=l=>{const u=ids.get(l.a),v=ids.get(l.b);return Math.hypot(u.x-v.x,u.y-v.y);};return (reverse?-1:1)*(length(b)-length(a))||a.id.localeCompare(b.id);});let routes=[];for(const l of ordered){const r=route(l);routes.push(r);register(r);}
 // Revisit expensive routes with every other connection already reserved.
 for(const old of routes.slice().sort((a,b)=>b.cost-a.cost).slice(0,Math.ceil(routes.length/5))){used=new Set();occupied=new Map();routes.filter(r=>r.id!==old.id).forEach(register);const next=route(old);if(next.cost<old.cost){routes=routes.map(r=>r.id===old.id?next:r);}register(routes.find(r=>r.id===old.id));}
 return routes;
}
function intersect(a,b,c,d){const ux=b[0]-a[0],uy=b[1]-a[1],vx=d[0]-c[0],vy=d[1]-c[1],den=ux*vy-uy*vx;if(Math.abs(den)<1e-8)return null;const t=((c[0]-a[0])*vy-(c[1]-a[1])*vx)/den,s=((c[0]-a[0])*uy-(c[1]-a[1])*ux)/den;return t>0&&t<1&&s>0&&s<1?{x:a[0]+t*ux,y:a[1]+t*uy,angle:Math.acos(Math.min(1,Math.abs((ux*vx+uy*vy)/(Math.hypot(ux,uy)*Math.hypot(vx,vy)))))*180/Math.PI}:null;}
function audit(world,routes){let shared=0,collisions=0,crossings=0,shallow=0,contacts=0;const portSet=new Set();let duplicatePorts=0;for(const n of world.nodes)for(const port of Object.values(n.ports)){const key=port.pt.join(',');if(portSet.has(key))duplicatePorts++;portSet.add(key);}
 const segments=routes.flatMap(r=>r.points.slice(1).map((p,i)=>({id:r.id,a:r.points[i],b:p})));for(let i=0;i<segments.length;i++){const a=segments[i];for(let j=i+1;j<segments.length;j++){const b=segments[j];if(a.id===b.id)continue;const u=[a.b[0]-a.a[0],a.b[1]-a.a[1]],v=[b.b[0]-b.a[0],b.b[1]-b.a[1]];if(Math.abs(u[0]*v[1]-u[1]*v[0])<1e-8&&Math.abs(u[0]*(b.a[1]-a.a[1])-u[1]*(b.a[0]-a.a[0]))<1e-8){const k=Math.abs(u[0])>Math.abs(u[1])?0:1;if(Math.min(Math.max(a.a[k],a.b[k]),Math.max(b.a[k],b.b[k]))-Math.max(Math.min(a.a[k],a.b[k]),Math.min(b.a[k],b.b[k]))>.01)shared++;}const on=(p,a,b)=>Math.abs((p[0]-a[0])*(b[1]-a[1])-(p[1]-a[1])*(b[0]-a[0]))<1e-7&&p[0]>=Math.min(a[0],b[0])&&p[0]<=Math.max(a[0],b[0])&&p[1]>=Math.min(a[1],b[1])&&p[1]<=Math.max(a[1],b[1]);if(on(a.a,b.a,b.b)||on(a.b,b.a,b.b)||on(b.a,a.a,a.b)||on(b.b,a.a,a.b))contacts++;const hit=intersect(a.a,a.b,b.a,b.b);if(hit){crossings++;if(hit.angle<44.99)shallow++;}}
 for(const n of world.nodes){const xmin=n.x-n.w/2-.5,xmax=n.x+n.w/2+.5,ymin=n.y-n.h/2-.5,ymax=n.y+n.h/2+.5;const count=Math.ceil(Math.hypot(a.b[0]-a.a[0],a.b[1]-a.a[1])/2);for(let k=1;k<count;k++){const t=k/count,x=a.a[0]+(a.b[0]-a.a[0])*t,y=a.a[1]+(a.b[1]-a.a[1])*t;if(x>xmin&&x<xmax&&y>ymin&&y<ymax){collisions++;break;}}}}
 return {shared,collisions,crossings,shallow,contacts,duplicatePorts,bends:routes.reduce((s,r)=>s+r.points.length-2,0)};
}
function canonical(graph){return {...graph,nodes:graph.nodes.slice().sort((a,b)=>a.id.localeCompare(b.id)),links:graph.links.slice().sort((a,b)=>a.id.localeCompare(b.id))};}
function candidate(graph,measure,scale,reverse,authored=null){const world=layout(graph,scale,measure,authored),routes=solve(graph,world,reverse),report=audit(world,routes);if(report.shared||report.collisions||report.duplicatePorts||report.contacts)return null;const length=routes.reduce((sum,r)=>sum+r.points.slice(1).reduce((s,p,i)=>s+Math.hypot(p[0]-r.points[i][0],p[1]-r.points[i][1]),0),0);return {...world,links:routes.map(({raw,cost,...r})=>r),report,score:report.bends*7+report.crossings*10+length/30+world.width*world.height/50000};}
function build(graph,measure){graph=canonical(graph);const begin=Date.now(),options=[];for(const scale of [1.1,1.4,1.8])for(const reverse of [false,true]){try{const c=candidate(graph,measure,scale,reverse,typeof authored==="undefined"?null:authored);if(c)options.push(c);}catch{}}if(!options.length)throw Error('Layout did not clear validation');options.sort((a,b)=>a.score-b.score);return {...options[0],ms:Date.now()-begin};}
async function buildAsync(graph,measure,onProgress=()=>{},authored=null){graph=canonical(graph);const options=[];let done=0;const spread=Math.max(1,graph.links.length/Math.max(1,graph.nodes.length));for(const scale of [1.1,1.4,1.8].map(value=>value*spread))for(const reverse of [false,true]){onProgress(++done,6);await new Promise(r=>setTimeout(r,0));try{const c=candidate(graph,measure,scale,reverse,typeof authored==="undefined"?null:authored);if(c)return c;}catch{}}if(!options.length)throw Error('No readable layout found within this study’s search budget');options.sort((a,b)=>a.score-b.score);return options[0];}


const backgroundPlanner=createNetworkPlanner();root.networkPlanner=Object.freeze({build,buildAsync:backgroundPlanner.buildAsync,dispose:backgroundPlanner.dispose,layout,solve,audit,canonical});})();
// One geometric camera law serves the review and the production Builder.
function frameCamera(bounds,viewport,padding=16,maxZoom=1){
 const gap=Math.max(0,Math.min(padding,viewport.w/4,viewport.h/4)),w=Math.max(1,bounds.right-bounds.left),h=Math.max(1,bounds.bottom-bounds.top),z=Math.min(maxZoom,Math.max(1,viewport.w-gap*2)/w,Math.max(1,viewport.h-gap*2)/h);
 return {x:viewport.w/2-(bounds.left+bounds.right)*z/2,y:viewport.h/2-(bounds.top+bounds.bottom)*z/2,z};
}

(()=>{
'use strict';
const root=element,reduced=matchMedia('(prefers-reduced-motion: reduce)'),records=new Map(),byInner=new WeakMap();
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
 if(entry.job)cancelAnimationFrame(entry.job);entry.job=0;
 for(const animation of entry.animations)animation.cancel();entry.copy?.remove();
 host.style.height='';host.style.overflow='';entry.copy=null;entry.animations=[];activeStatuses.delete(host);
}
function status(titleNode,detailNode,title,detail){
 if(titleNode.textContent===String(title)&&detailNode.textContent===String(detail))return;
 const host=titleNode.parentElement,previous=statuses.get(host),animate=Boolean(previous&&!reduced.matches&&host.animate),before=animate?host.getBoundingClientRect().height:0;if(previous)settleStatus(host,previous);
 const old=animate?host.cloneNode(true):null;
 if(old){old.querySelectorAll('.rv-status-copy').forEach(n=>n.remove());old.classList.add('rv-status-copy');old.setAttribute('aria-hidden','true');old.removeAttribute('aria-live');old.removeAttribute('aria-atomic');old.removeAttribute('id');old.inert=true;for(const n of old.querySelectorAll('[id]'))n.removeAttribute('id');}
 titleNode.textContent=String(title);detailNode.textContent=String(detail);const entry={copy:null,animations:[],job:0};statuses.set(host,entry);
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
 // Rapid cancel/restart can strand Chromium's finished promise even after
 // playState becomes finished. Check active effects without any layout read;
 // this job exists only during the short transition and is owned by settlement.
 const completed=()=>{entry.job=0;if(statuses.get(host)!==entry)return;if(entry.animations.every(a=>a.playState==='finished'||a.playState==='idle'))settleStatus(host,entry);else entry.job=requestAnimationFrame(completed);};
 entry.job=requestAnimationFrame(completed);
}
root.reviewUI=Object.freeze({status,settle:()=>{for(const [host,entry]of activeStatuses)settleStatus(host,entry);}});
})();

(()=>{
'use strict';
const root=element,NS='http://www.w3.org/2000/svg';
const views=new WeakMap();
function createSvg(tag,attrs){const n=document.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,String(v));return n;}
function world(viewport,edges,layer,plan,camera){
 let entry=views.get(viewport);
 if(!entry){const host=document.createElement('div');host.className='rv-network-world';viewport.append(host);host.append(edges,layer);edges.classList.add('rv-network-edges');layer.classList.add('rv-network-nodes');entry={host,edges,layer};views.set(viewport,entry);}
 const {host}=entry;
 if(entry.plan!==plan){host.style.width=plan.width+'px';host.style.height=plan.height+'px';edges.setAttribute('viewBox',`0 0 ${plan.width} ${plan.height}`);edges.setAttribute('width',plan.width);edges.setAttribute('height',plan.height);edges.style.width='100%';edges.style.height='100%';edges.style.maxWidth='none';edges.style.maxHeight='none';entry.plan=plan;}
 host.style.transform=`translate(${camera.x}px,${camera.y}px) scale(${camera.z})`;
 return entry;
}
function path(points){return points.map((p,i)=>(i?'L':'M')+p.join(' ')).join(' ');}
function crossings(links){
 const segments=links.flatMap((l,order)=>l.points.slice(1).map((b,i)=>({id:l.id,order,a:l.points[i],b}))),hits=new Map();
 for(let i=0;i<segments.length;i++)for(let j=i+1;j<segments.length;j++){
  const a=segments[i],b=segments[j];if(a.id===b.id)continue;
  const ux=a.b[0]-a.a[0],uy=a.b[1]-a.a[1],vx=b.b[0]-b.a[0],vy=b.b[1]-b.a[1],den=ux*vy-uy*vx;if(Math.abs(den)<1e-8)continue;
  const t=((b.a[0]-a.a[0])*vy-(b.a[1]-a.a[1])*vx)/den,s=((b.a[0]-a.a[0])*uy-(b.a[1]-a.a[1])*ux)/den;
  if(t<=0||t>=1||s<=0||s>=1)continue;
  const x=a.a[0]+t*ux,y=a.a[1]+t*uy,over=a.order>b.order?a:b,len=Math.hypot(over.b[0]-over.a[0],over.b[1]-over.a[1]);
  // The clearance belongs to a genuine crossing, never the full connection.
  const half=3,dx=(over.b[0]-over.a[0])/len*half,dy=(over.b[1]-over.a[1])/len*half;
  const key=over.id+'|'+x+'|'+y;if(!hits.has(key))hits.set(key,{id:over.id,points:[[x-dx,y-dy],[x+dx,y+dy]]});
 }
 return [...hits.values()];
}
function draw(edges,links){
 edges.replaceChildren();const gaps=createSvg('g',{'aria-hidden':'true'}),lines=createSvg('g',{'data-network-lines':'true'});
 // Underlying connections, local knockout marks, then continuous overpasses.
 for(const l of links)lines.append(createSvg('path',{d:path(l.points),'data-edge':l.id,fill:'none',stroke:l.failed?'var(--rv-red)':'var(--hs-route-line)','stroke-width':1.2,'stroke-linejoin':'round','stroke-linecap':'round'}));
 edges.append(lines);
 const hits=crossings(links),groups=new Map();
 if(hits.length)gaps.append(createSvg('path',{d:hits.map(hit=>path(hit.points)).join(' '),fill:'none',stroke:'var(--hs-bg)','stroke-width':5,'stroke-linecap':'butt'}));
 for(const hit of hits){const group=groups.get(hit.id)||[];group.push(hit.points);groups.set(hit.id,group);}
 for(const [id,points]of groups){const link=links.find(link=>link.id===id);gaps.append(createSvg('path',{d:points.map(path).join(' '),fill:'none','data-edge':id,stroke:link.failed?'var(--rv-red)':'var(--hs-route-line)','stroke-width':1.2,'stroke-linecap':'butt'}));}
 
 edges.append(gaps);return lines;
}
function measureLimit(viewportWidth){return Math.max(120,Math.min(280,viewportWidth*.65));}
function measure(className,viewportWidth){
 const probe=document.createElement('button');probe.className=className+' rv-node-measure';probe.type='button';probe.setAttribute('aria-hidden','true');probe.inert=true;
 const maxWidth=measureLimit(viewportWidth);Object.assign(probe.style,{left:'-10000px',top:'0',width:'max-content',maxWidth:maxWidth+'px',height:'auto'});root.append(probe);
 const style=getComputedStyle(probe),cache=new Map();
 function box(text){if(cache.has(text))return cache.get(text);probe.textContent=String(text);const r=probe.getBoundingClientRect(),value={w:Math.max(44,r.width),h:Math.max(44,r.height),radius:parseFloat(style.borderTopLeftRadius)||15,lines:[String(text)]};cache.set(text,value);return value;}
 const fn=text=>Math.max(0,box(text).w-20);fn.box=box;fn.dispose=()=>probe.remove();return fn;
}
function endpointAudit(plan){
 const nodes=new Map(plan.nodes.map(n=>[n.id,n])),errors=[];
 for(const l of plan.links)for(const [id,p]of [[l.a,l.points[0]],[l.b,l.points.at(-1)]]){
  const n=nodes.get(id);if(!n){errors.push(l.id+': missing node '+id);continue;}
  const x=Math.abs(p[0]-n.x),y=Math.abs(p[1]-n.y),hw=n.w/2,hh=n.h/2,r=Math.min(n.radius??15,hw,hh);
  const onSide=Math.abs(x-hw)<1e-6&&y<=hh-r||Math.abs(y-hh)<1e-6&&x<=hw-r;
  if(!onSide)errors.push(l.id+': endpoint outside flat rounded boundary '+id);
 }
 return errors;
}
// All pieces of a connection (including its crossing overpasses) receive the
// same semantic state. Geometry and hit targets are never rebuilt for emphasis.
function emphasize(edges,{activeLinks=[],failedLinks=[],hasPath=false}={}){
 const active=new Set(activeLinks),failed=new Set(failedLinks);
 for(const edge of edges.querySelectorAll('[data-edge]'))edge.dataset.networkState=failed.has(edge.dataset.edge)?'stopped':active.has(edge.dataset.edge)?'path':hasPath?'context':'neutral';
}
function traceState(trace,graph){
 const nodeIds=new Set(),linkIds=new Set(),nodes=new Set(graph.nodes.map(n=>n.id)),links=new Set(graph.links.map(l=>l.id));
 for(const hop of trace?.hops||[]){for(const value of [hop.nodeId,hop.nextNodeId])if(nodes.has(value))nodeIds.add(value);if(links.has(hop.linkId))linkIds.add(hop.linkId);}
 const boundary=!trace?.reachable&&nodes.has(trace?.failureNodeId)?trace.failureNodeId:null;
 if(boundary)nodeIds.add(boundary);
 return {nodeIds:[...nodeIds],linkIds:[...linkIds],boundary};
}
root.networkScene=Object.freeze({world,draw,measure,measureLimit,path,crossings,endpointAudit,emphasize,traceState});
})();

(()=>{
'use strict';
const root=element;
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
  for(const failed of [false,true]){const links=plan.links.filter(link=>Boolean(link.failed)===failed);if(links.length)element.append(svg('path',{d:links.map(link=>root.networkScene.path(link.points)).join(' '),fill:'none',stroke:failed?'var(--rv-red)':'var(--hs-route-line)','stroke-width':weight,'stroke-linejoin':'round','stroke-linecap':'round'}));}
  const shapes=plan.nodes.map(n=>{const x=n.x-n.w/2,y=n.y-n.h/2,w=n.w,h=n.h,r=Math.min(12,w/2,h/2);return `M${x+r} ${y}H${x+w-r}Q${x+w} ${y} ${x+w} ${y+r}V${y+h-r}Q${x+w} ${y+h} ${x+w-r} ${y+h}H${x+r}Q${x} ${y+h} ${x} ${y+h-r}V${y+r}Q${x} ${y} ${x+r} ${y}Z`;});
  element.append(svg('path',{d:shapes.join(' '),fill:'var(--hs-muted)',opacity:.65}));
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

(()=>{
'use strict';
const root=element,metrics=new Map(),watches=new Set();let pending=0,disposed=false;
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

(()=>{
'use strict';
const root=element;
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

(()=>{
'use strict';
const root=element,vertex=`attribute vec2 a_position;void main(){gl_Position=vec4(a_position,0.0,1.0);}`,fragment=`
    precision highp float;
    uniform sampler2D u_scene;
    uniform vec2 u_resolution;
    uniform vec2 u_center;
    uniform vec2 u_half;
    uniform vec2 u_light;
    uniform float u_radius;
    uniform float u_dpr;
    uniform float u_dark;
    uniform float u_open;
    float shape(vec2 p){vec2 q=abs(p)-u_half+u_radius;return length(max(q,0.0))+min(max(q.x,q.y),0.0)-u_radius;}
    ${element.glassEdge.glsl}
        // Dark glass uses broad optical planes and a narrow folded reflection.
    // The same object-relative environment serves anatomy and compact objects.
    vec3 nightFlow(vec2 uv){
      float bend=.39*uv.x+.17*sin(uv.x*1.75+.40);
      float seam=uv.y-bend-.12;
      vec3 blue=mix(vec3(.021,.046,.095),vec3(.075,.220,.500),smoothstep(-1.5,-.10,seam));
      float undertow=uv.y-(.24*uv.x+.16*sin(uv.x*1.8-.5)-.50);
      blue=mix(blue,vec3(.055,.250,.620),exp(-pow(undertow/.27,2.0))*.70);
      blue=mix(blue,vec3(.210,.420,.480),exp(-pow((seam+.16)/.19,2.0))*.82);
      blue*=1.0-.22*exp(-pow((seam+.035)/.035,2.0));
      vec3 upper=mix(vec3(.240,.320,.430),vec3(.090,.160,.260),smoothstep(.03,.85,seam));
      upper=mix(upper,vec3(.170,.310,.340),exp(-pow((uv.x+.55)/.75,2.0))*.32);
      vec3 col=mix(blue,upper,smoothstep(-.009,.016,seam));
      col=mix(col,vec3(.390,.500,.590),exp(-pow(seam/.014,2.0))*.55);
      float lower=uv.y-(.43*uv.x+.16*sin(uv.x*1.6+1.1)-.73);
      col=mix(col,vec3(.250,.240,.440),exp(-pow(lower/.32,2.0))*.56);
      col=mix(col,vec3(.285,.350,.550),exp(-pow((lower+.045)/.025,2.0))*.25);
      return col;
    }
    vec3 nightMaterial(vec3 background,vec3 pigment,vec3 normal,vec2 normal2,float depth,float slope){
      vec3 transmission=mix(background,pigment,.96-.17*pow(slope,2.0));
      float frost=.18*u_open*(1.0-.85*pow(slope,2.0));
      transmission=mix(transmission,vec3(.065,.090,.150),frost);
      vec3 light=normalize(vec3(u_light,.63));
      float orientation=dot(normal2,normalize(u_light));
      float spec=pow(max(dot(normal,normalize(light+vec3(0.0,0.0,1.0))),0.0),36.0);
      float fresnel=glassFresnel(normal.z,.012,.35,5.0);
      vec3 reflection=mix(vec3(.200,.320,.460),vec3(.700,.800,.900),smoothstep(.02,.88,orientation));
      vec3 color=mix(transmission,reflection,fresnel)+spec*.075;
      float undercut=exp(-pow((depth-3.0*u_dpr)/(1.7*u_dpr),2.0));
      color*=1.0-.16*undercut*(1.0-max(orientation,0.0));
      // Bound face reflections without desaturating the entire material.
      // This shared exposure limit leaves the thin optical perimeter intact.
      float energy=dot(pow(max(color,vec3(0.0)),vec3(2.2)),vec3(.2126,.7152,.0722));
      color*=pow(min(1.0,.095/max(energy,.001)),1.0/2.2);
      float rim=glassEdgeHighlight(depth,u_dpr,1.0);
      return mix(color,vec3(.540,.650,.750),rim*(.19+.36*max(orientation,0.0)));
    }

    vec3 flow(vec2 uv){
      if(u_dark>.5)return nightFlow(uv);
      // Two curved optical folds, defined in the packet's own coordinates.
      // They deform with the packet, independent of the surrounding canvas.
      float bend=.34*uv.x+.18*sin(uv.x*2.15+.35);
      float d=uv.y-bend-.34;
      vec3 cobalt=vec3(.025,.24,.81),deep=vec3(.015,.045,.35),cyan=vec3(.11,.72,.89);
      vec3 blue=mix(deep,cobalt,smoothstep(-1.6,-.18,d));
      float undertow=uv.y-(.10+.26*sin(uv.x*1.7-.5));
      blue=mix(blue,vec3(.075,.47,.92),exp(-pow((undertow+.62)/.30,2.0))*.75);
      blue=mix(blue,cyan,exp(-pow((d+.13)/.16,2.0))*.75);
      blue*=1.0-.30*exp(-pow((d+.038)/.038,2.0));
      vec3 pearl=mix(vec3(.83,.9,.91),vec3(.4,.71,.81),smoothstep(.02,.78,d));
      pearl=mix(pearl,vec3(.96,.95,.88),exp(-pow((uv.x+.60)/.72,2.0))*smoothstep(.10,.7,d)*.70);
      vec3 col=mix(blue,pearl,smoothstep(-.008,.014,d));
      col=mix(col,vec3(.91,.98,1.0),exp(-pow(d/.012,2.0))*.68);
      float fold=uv.y-(.50*uv.x+.19*sin(uv.x*2.0+1.5)-.71);
      col=mix(col,vec3(.19,.55,.80),exp(-pow(fold/.085,2.0))*.24);
      col=mix(col,vec3(.58,.66,.92),exp(-pow((fold+.055)/.027,2.0))*.17);
      return col;
    }
    vec3 backdrop(vec2 p){return texture2D(u_scene,clamp(p/u_resolution,vec2(.001),vec2(.999))).rgb;}
    void main(){
      vec2 pixel=gl_FragCoord.xy,p=pixel-u_center;float d=shape(p),aa=.85*u_dpr;vec3 original=backdrop(pixel);
      float sh=shape(p+vec2(0.0,10.0)*u_dpr);float shadow=exp(-max(sh,0.0)/(15.0*u_dpr))*(.12+u_dark*.13);original*=1.0-shadow*(1.0-smoothstep(-aa,aa,-d));
      if(d>aa){gl_FragColor=vec4(0.0);return;}
      float depth=max(-d,0.0),bevel=mix(15.0,12.0,u_open)*u_dpr,slope=1.0-clamp(depth/bevel,0.0,1.0),nz=sqrt(max(1.0-slope*slope,.001));
      vec2 normal2=glassSurfaceNormal(p,u_dpr);
      vec3 normal=normalize(vec3(normal2*slope,nz)),ray=refract(vec3(0.0,0.0,-1.0),normal,1.0/1.46);
      vec2 shift=ray.xy/max(abs(ray.z),.05)*(26.0+13.0*nz)*u_dpr;vec2 sampleAt=u_center+p*.955+shift;vec2 dispersion=normal2*pow(slope,2.0)*.65*u_dpr;
      vec3 transmission=vec3(backdrop(sampleAt+dispersion).r,backdrop(sampleAt).g,backdrop(sampleAt-dispersion).b);
      vec3 softened=vec3(0.0);
      for(int i=0;i<8;i++){float angle=float(i)*.785398;softened+=backdrop(sampleAt+vec2(cos(angle),sin(angle))*8.0*u_dpr);}
      softened/=8.0;transmission=mix(transmission,softened,.65);
      vec2 materialUV=p/u_half+shift/u_half*.70;
      vec3 pigment=flow(materialUV);
      if(u_dark>.5){gl_FragColor=vec4(nightMaterial(transmission,pigment,normal,normal2,depth,slope),1.0-smoothstep(-aa,aa,d));return;}
      // Pigment lives within the volume; only the outer edge transmits the scene.
      transmission=mix(transmission,pigment,.97-.28*pow(slope,2.0));
      float veil=.73*u_open*(1.0-.82*pow(slope,2.0));
      transmission=mix(transmission,mix(vec3(.98,.99,1.0),vec3(.025,.052,.10),u_dark),veil);
      vec3 light=normalize(vec3(u_light,.75));float spec=pow(max(dot(normal,normalize(light+vec3(0.0,0.0,1.0))),0.0),30.0),fresnel=glassFresnel(normal.z,.008,.28,4.0),orientation=dot(normal2,normalize(u_light));
      vec3 reflected=mix(vec3(.32,.48,.7),vec3(1.0),smoothstep(-.5,.85,orientation));
      vec3 color=mix(transmission,reflected,fresnel);color+=spec*.09;
      float rim=glassEdgeHighlight(depth,u_dpr,1.0);color=mix(color,vec3(1.0),rim*(.23+.43*max(orientation,0.0)));
      gl_FragColor=vec4(color,1.0-smoothstep(-aa,aa,d));
    }`,surface=document.createElement('canvas');
let epoch=0,draws=0,allocations=0,capacity={w:0,h:0};const cache=new Map(),owners=new Set();
const session=root.packetMaterial.create({owner:root,surface,vertex,fragment,names:['u_scene','u_resolution','u_center','u_half','u_light','u_radius','u_dpr','u_dark','u_open'],onChange:()=>{epoch++;cache.clear();root.dispatchEvent(new CustomEvent('review-material-change'));}});
function prepare(w,h){if(capacity.w!==w||capacity.h!==h){capacity={w,h};invalidate();}}
function paintOwner(canvas,owner,open=1){
 if(!owner||owner.dataset.materialRole==='operation')return;const rect=owner.getBoundingClientRect();if(!(rect.width>0&&rect.height>0))return;
 const radius=getComputedStyle(owner).borderTopLeftRadius,parts=radius.trim().split(/\s+/),resolve=(v,size)=>v.endsWith('%')?parseFloat(v)*size/100:parseFloat(v)||0;
 // Resting material components use one circular radius. Percentage radii are
 // resolved against their actual box; the shader and CSS clip share its bounds.
 const r=Math.max(0,Math.min(resolve(parts[0],rect.width),resolve(parts[1]||parts[0],rect.height),rect.width/2,rect.height/2));paint(canvas,rect.width,rect.height,r,open);
}
function paint(canvas,w,h,radius=24,open=1){
 if(!canvas||!(w>0&&h>0)||canvas.parentElement?.dataset.materialRole==='operation')return;
 const maxW=Math.max(w,capacity.w),maxH=Math.max(h,capacity.h),theme=root.dataset.theme==='dark'?'dark':'light',ratio=Math.min(devicePixelRatio||1,2,Math.sqrt(1048576/(maxW*maxH))),key=[w,h,radius,open,theme,ratio,epoch,session.epoch,session.state].join('|');
 if(canvas.dataset.paintKey===key)return;
 const ready=session.ready();for(const owner of owners)if(!owner.isConnected)owners.delete(owner);owners.add(canvas);
 if(!ready){root.packetMaterial.drawFallback(canvas,w,h,radius,theme,{w:maxW,h:maxH});canvas.dataset.paintKey=key;return;}
 const gl=session.gl,u=session.uniforms,limit=gl.getParameter(gl.MAX_TEXTURE_SIZE)||4096,dpr=Math.min(ratio,limit/maxW,limit/maxH),pw=Math.max(1,Math.ceil(maxW*dpr)),ph=Math.max(1,Math.ceil(maxH*dpr));
 // The backing grows only when a prepared layout changes. Active shape paints
 // use this one renderer; each actor clips its own exactly matching rounded face.
 const fullKey=[w,h,pw,ph,radius,dpr,theme,open,session.epoch].join('|');
 let image=cache.get(fullKey);
 if(!image){
  if(surface.width!==pw||surface.height!==ph){surface.width=pw;surface.height=ph;allocations++;}
  gl.viewport(0,0,pw,ph);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(theme==='dark'?root.materialAppearance.darkBackdrop:[243,245,247,255]));
  gl.uniform2f(u.u_resolution,pw,ph);gl.uniform2f(u.u_center,w*dpr/2,ph-h*dpr/2);gl.uniform2f(u.u_half,w*dpr/2,h*dpr/2);gl.uniform2f(u.u_light,...(theme==='dark'?root.materialAppearance.darkLight:[-.65,.9]));gl.uniform1f(u.u_radius,radius*dpr);gl.uniform1f(u.u_dpr,dpr);gl.uniform1f(u.u_dark,theme==='dark'?1:0);gl.uniform1f(u.u_open,open);gl.drawArrays(gl.TRIANGLES,0,6);draws++;
  image=surface;
  // Cache only resting faces. Morph frames share the active surface and never
  // retain hundreds of geometry-dependent images.
  if(open===0||open===1){image=document.createElement('canvas');image.width=pw;image.height=ph;image.getContext('2d')?.drawImage(surface,0,0);cache.set(fullKey,image);while(cache.size>4)cache.delete(cache.keys().next().value);}
 }
 if(canvas.width!==pw||canvas.height!==ph){canvas.width=pw;canvas.height=ph;allocations++;}
 canvas.style.width=pw/dpr+'px';canvas.style.height=ph/dpr+'px';const ctx=canvas.getContext('2d');if(ctx){ctx.clearRect(0,0,pw,ph);ctx.drawImage(image,0,0);}canvas.dataset.paintKey=key;
}
function invalidate(){for(const canvas of owners){if(!canvas.isConnected)owners.delete(canvas);else canvas.dataset.paintKey='';}cache.clear();epoch++;}
root.surfacePainter=Object.freeze({paint,paintOwner,prepare,invalidate,stats:()=>({draws,allocations,cache:cache.size,sessions:1,capacity:{...capacity}}),retry:()=>session.retry()});
})();

(()=>{
'use strict';
const root=element;
let owners=[...root.querySelectorAll('[data-ui-surface="record"]:not([data-glass-role])')];
const recordVertex=`attribute vec2 a_position;void main(){gl_Position=vec4(a_position,0.0,1.0);}`;
const recordFragment=`precision highp float;
uniform vec2 u_center;
uniform vec2 u_half;
uniform vec2 u_light;
uniform float u_radius;
uniform float u_dpr;
uniform float u_dark;
uniform float u_open;
uniform float u_depth;
float shape(vec2 p){
 vec2 q=abs(p)-u_half+u_radius;
 return length(max(q,0.0))+min(max(q.x,q.y),0.0)-u_radius;
}
${element.glassEdge.glsl}
void main(){
 vec2 p=gl_FragCoord.xy-u_center;
 float distance=shape(p),aa=.85*u_dpr;
 if(distance>aa){gl_FragColor=vec4(0.0);return;}
 float depth=max(-distance,0.0);
 // A role-level depth controls weight; measured curvature bounds its extent.
 float bevel=min(max(1.5*u_dpr,u_radius*.48),mix(15.0,12.0,u_open)*u_dpr*u_depth);
 float slope=1.0-clamp(depth/bevel,0.0,1.0);
 if(slope<=0.0){gl_FragColor=vec4(0.0);return;}
 vec2 normal2=glassSurfaceNormal(p,u_dpr);
 vec3 normal=normalize(vec3(normal2*slope,sqrt(max(1.0-slope*slope,.001))));
 vec3 light=normalize(vec3(u_light,mix(.75,.63,u_dark)));
 float orientation=dot(normal2,normalize(u_light)),lit=max(orientation,0.0);
 float spec=pow(max(dot(normal,normalize(light+vec3(0.0,0.0,1.0))),0.0),mix(30.0,36.0,u_dark));
 float fresnel=glassFresnel(normal.z,mix(.008,.012,u_dark),mix(.28,.35,u_dark),mix(4.0,5.0,u_dark));
 float line=glassEdgeHighlight(depth,u_dpr,max(.65,u_depth));
 // One directional crest; continuous opposing shade has no inset contour.
 float bright=(fresnel*.62*(.12+.88*lit)+spec*.23*slope+line*(.03+.35*lit))*mix(.90,1.65,u_dark);
 float shade=.12*slope*slope*max(-orientation,0.0)*mix(.75,1.25,u_dark);
 float alpha=clamp(bright+shade,0.0,.55)*(1.0-smoothstep(-aa,aa,distance));
 vec3 reflection=mix(vec3(.04,.07,.11),vec3(.93,.97,1.0),bright/max(bright+shade,.0001));
 gl_FragColor=vec4(reflection,alpha);
}
`;
const surface=document.createElement('canvas');
let gl=null,valid=false,uniforms={},frame=0,draws=0,reads=0,cacheHits=0,contextLost=false,maxTexture=4096;
const cache=new Map(),limit=12,pixelBudget=393216,entries=new Map();
const reduced=matchMedia('(prefers-reduced-transparency: reduce)'),forced=matchMedia('(forced-colors: active)');
function fallback(){for(const entry of entries.values())entry.owner.removeAttribute('data-ui-optics');}
const recordSession=element.packetMaterial.create({
 owner:root,surface,vertex:recordVertex,fragment:recordFragment,
 names:['u_center','u_half','u_light','u_radius','u_dpr','u_dark','u_open','u_depth'],
 onChange:()=>{contextLost=recordSession.state==='lost';valid=false;cache.clear();fallback();invalidate();}
});
function initialize(){
 if(!recordSession.ready())return false;
 gl=recordSession.gl;uniforms=recordSession.uniforms;
 if(typeof gl.getParameter==='function')maxTexture=Math.min(4096,gl.getParameter(gl.MAX_TEXTURE_SIZE)||4096);
 return true;
}
function queue(){if(!frame&&!document.hidden)frame=requestAnimationFrame(paint);}
function paint(){
 frame=0;syncOwners();if(!root.isConnected||document.hidden)return;
 if(reduced.matches||forced.matches||contextLost){fallback();return;}
 if(!valid){valid=initialize();if(!valid){fallback();return;}}
 const theme=root.dataset.theme==='dark'?'dark':'light',requestedDpr=Math.min(devicePixelRatio||1,2);
 const appearance=root.materialAppearance;
 for(const owner of owners){
  const bounds=owner.getBoundingClientRect();reads++;
  // Hidden scenes are skipped. Resizing content itself triggers its observer.
  if(bounds.width<=0||bounds.height<=0)continue;
  const css=getComputedStyle(owner),borderX=(parseFloat(css.borderLeftWidth)||0)+(parseFloat(css.borderRightWidth)||0),borderY=(parseFloat(css.borderTopWidth)||0)+(parseFloat(css.borderBottomWidth)||0);
  const w=Math.max(1,bounds.width-borderX),h=Math.max(1,bounds.height-borderY),radius=Math.max(0,Math.min(w/2,h/2,(parseFloat(css.borderTopLeftRadius)||0)-borderX/2));
  const density=Math.max(0,Math.min(2,parseFloat(css.getPropertyValue('--hs-ui-density'))||0));
  const materialDepth=Math.max(.12,Math.min(.5,parseFloat(css.getPropertyValue('--hs-glass-depth'))||.34));
  const dpr=Math.min(requestedDpr,Math.sqrt(pixelBudget/(w*h)),maxTexture/w,maxTexture/h);
  const dw=Math.max(1,Math.floor(w*dpr)),dh=Math.max(1,Math.floor(h*dpr)),key=[dw,dh,radius,theme,dpr,density,materialDepth].join('|');
  let entry=entries.get(owner);
  if(entry?.key===key){cacheHits++;continue;}
  if(!entry){
   const canvas=document.createElement('canvas');canvas.className='hs-record-glass';canvas.setAttribute('aria-hidden','true');
   const ctx=canvas.getContext('2d');if(!ctx)continue;
   entry={owner,canvas,ctx,key:''};entries.set(owner,entry);owner.prepend(canvas);
  }
  try{
   let image=cache.get(key);
   if(image){cache.delete(key);cache.set(key,image);cacheHits++;}
   else{
    surface.width=dw;surface.height=dh;gl.viewport(0,0,dw,dh);
    gl.uniform2f(uniforms.u_center,dw/2,dh/2);gl.uniform2f(uniforms.u_half,dw/2,dh/2);
    gl.uniform2f(uniforms.u_light,...(theme==='dark'?appearance.darkLight:[-.65,.9]));
    gl.uniform1f(uniforms.u_radius,radius*dpr);gl.uniform1f(uniforms.u_dpr,dpr);gl.uniform1f(uniforms.u_dark,theme==='dark'?1:0);gl.uniform1f(uniforms.u_open,Math.min(1,.65+density*.35));gl.uniform1f(uniforms.u_depth,materialDepth);
    gl.drawArrays(gl.TRIANGLES,0,6);draws++;
    image=document.createElement('canvas');image.width=dw;image.height=dh;
    const copy=image.getContext('2d');if(!copy)throw Error('record copy');copy.drawImage(surface,0,0);cache.set(key,image);
    while(cache.size>limit)cache.delete(cache.keys().next().value);
   }
   entry.canvas.width=dw;entry.canvas.height=dh;entry.ctx.clearRect(0,0,dw,dh);entry.ctx.drawImage(image,0,0);
   owner.style.setProperty('--hs-ui-inner-radius',radius+'px');entry.key=key;owner.setAttribute('data-ui-optics','ready');
  }catch(error){owner.removeAttribute('data-ui-optics');entry.key='';}
 }
}
function syncOwners(){const next=[...root.querySelectorAll('[data-ui-surface="record"]:not([data-glass-role])')],set=new Set(next);for(const [owner,entry]of entries)if(!set.has(owner)){resize.unobserve?.(owner);entry.canvas.remove();entries.delete(owner);}for(const owner of next)if(!owners.includes(owner))resize.observe(owner);owners=next;}
function invalidate(){for(const e of entries.values())e.key='';queue();}

// Paint changed bounds before the resize-observer delivery is presented. A resting
// bitmap is never stretched for a frame to fit a newly measured rounded surface.
const resize=new ResizeObserver(()=>{if(frame){cancelAnimationFrame(frame);frame=0;}paint();});owners.forEach(n=>resize.observe(n));
if(typeof MutationObserver!=='undefined')new MutationObserver(queue).observe(root,{attributes:true,attributeFilter:['data-theme']});
reduced.addEventListener('change',invalidate);forced.addEventListener('change',invalidate);
function watchDpr(){
 const mq=matchMedia('(resolution: '+(devicePixelRatio||1)+'dppx)');
 const changed=()=>{mq.removeEventListener('change',changed);watchDpr();invalidate();};
 mq.addEventListener('change',changed);
}
watchDpr();
window.addEventListener('resize',queue);scope.listen(element,'change',queue);
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;}else queue();});
root.recordMaterial=Object.freeze({invalidate,stats:()=>({draws,reads,cacheHits,cached:cache.size,pending:Boolean(frame)})});
queue();
})();


return {scope,originalKeys};
}
