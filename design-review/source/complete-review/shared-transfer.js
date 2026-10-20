(()=>{
'use strict';
const root=document.getElementById('hop-app-composition');
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