import {mountPacketPainter} from './packet-painter.js';
import {mountPacketMotion} from './packet-motion.js';

// A small scene composition over the shared packet optics, glyph reader and
// pacing policies. Callers supply immutable source events and packet snapshots.
export function mountPacketScene(root,scope,{steps,autoplay=true,onSource=()=>{},describeField=(_step,f)=>f.note||f.label+': '+f.value}){
 const {document,window}=scope,q=s=>root.querySelector(s),stage=q('.lh-network'),face=q('.lh-packet'),canvas=face.querySelector('canvas'),body=q('.lh-packet-content'),fields=q('.lh-packet-fields'),heading=q('.lh-packet-heading'),context=q('.lh-packet-context'),toggle=q('.lh-fold'),playButton=q('.lh-play'),nextButton=q('.lh-next'),reader=q('.lh-reader'),readerCopy=q('.lh-reader-copy');
 const material=mountPacketPainter(root,scope),motion=mountPacketMotion(root,scope),{planner,pacing,tuning}=motion,{clamp,mix}=planner,reduced=scope.matchMedia('(prefers-reduced-motion: reduce)');
 const primary=['ip-src','ip-dst','ip-ttl','ip-checksum'],all=[...primary,...steps[0].fields.map(f=>f.id).filter(id=>!primary.includes(id))],buttons=new Map();
 let disposed=false,layout=null,plan=null,clock=0,playing=false,inspection=false,selected=null,frame=0,last=null,measureJob=0,viewMotion=null,currentBox=null,currentIndex=-1,captionKey='',paintKey='',lensKey='',changeStart=0,changes=[];
 root.style.setProperty('--lh-morph-duration',tuning.morph+'ms');
 const smooth=p=>{p=clamp(p);return p*p*p*(p*(p*6-15)+10);};
 const boxMix=(a,b,p)=>Object.fromEntries(['x','y','w','h'].map(k=>[k,mix(a[k],b[k],p)]));
 function pause(){playing=false;last=null;syncControls();}
 for(const id of all){const f=steps[0].fields.find(f=>f.id===id),button=document.createElement('button'),label=document.createElement('span'),value=document.createElement('span');button.type='button';button.className='lh-packet-field cursor-interaction';button.dataset.field=id;button.setAttribute('aria-pressed','false');label.className='lh-field-label';value.className='lh-field-value';label.textContent=f.label;value.textContent=f.value;button.append(label,value);fields.append(button);buttons.set(id,button);scope.listen(button,'click',()=>{pause();selected=id;for(const [key,node]of buttons)node.setAttribute('aria-pressed',String(key===id));caption(true);render();});}
 function setExtra(show){for(const [id,node]of buttons)node.hidden=!show&&!primary.includes(id);}
 function clearChanges(){for(const change of changes){change.copy.remove();change.value.style.opacity='';}changes=[];}
 function bind(index,animate=false){
  if(index===currentIndex)return;clearChanges();const before=currentIndex<0?null:steps[currentIndex];currentIndex=index;const step=steps[index];
  for(const f of step.fields){const value=buttons.get(f.id).querySelector('.lh-field-value'),previous=before?.fields.find(old=>old.id===f.id)?.value;value.textContent=f.value;if(animate&&previous!==undefined&&previous!==f.value){const copy=document.createElement('span');copy.className='lh-old-value';copy.textContent=previous;copy.setAttribute('aria-hidden','true');value.parentElement.append(copy);changes.push({value,copy});}}
  q('.lh-packet-length').textContent=step.packet.networkBytes+' bytes';context.textContent=step.physical.destinationIp;q('.lh-packet-payload').textContent='TCP · protected request to '+step.packet.config.destinationPort;
  nextButton.disabled=index===steps.length-1;if(changes.length)changeStart=performance.now();face.dataset.sourceEvent=step.event.id;face.dataset.continuity=step.physical.continuityId;onSource(index);lensKey='';caption();
 }
 function at(time=clock){if(!plan)return null;const phase=plan.phases.find(p=>time<p.end)||plan.phases.at(-1);return {...phase,p:clamp((time-phase.start)/(phase.end-phase.start)),elapsed:clamp(time-phase.start,0,phase.end-phase.start)};}
 function caption(force=false){if(currentIndex<0)return;const step=steps[currentIndex],key=currentIndex+'|'+(inspection&&selected?selected:'');if(!force&&captionKey===key)return;captionKey=key;motion.status(q('.lh-scene-title'),q('.lh-demo-hint'),inspection&&selected?step.fields.find(f=>f.id===selected).label:step.title,inspection&&selected?describeField(step,step.fields.find(f=>f.id===selected)):step.detail);}
 function syncControls(){playButton.textContent=playing?'Pause':plan&&clock>=plan.total?'Replay hop':'Play hop';playButton.setAttribute('aria-label',playing?'Pause preview':plan&&clock>=plan.total?'Replay preview':'Play preview');toggle.setAttribute('aria-expanded',String(inspection));toggle.innerHTML=inspection?'Return to route <span aria-hidden="true">−</span>':'Inspect packet <span aria-hidden="true">+</span>';}
 function buildPlan(){
  const phases=[];let total=0;const push=(index,kind,duration,from,to,read=null)=>{phases.push({key:index+':'+kind,index,kind,start:total,end:total+duration,from,to,read});total+=duration;};
  const travel=(a,b)=>clamp(Math.hypot(b.x-a.x,b.y-a.y)/tuning.travelSpeed,tuning.minTravel,tuning.maxTravel),morph=(a,b)=>Math.max(tuning.morph,Math.max(...[0,1].flatMap(x=>[0,1].map(y=>Math.hypot(b.x+b.w*x-a.x-a.w*x,b.y+b.h*y-a.y-a.h*y))))*1.875/tuning.morphPeakSpeed);
  let pose=layout.incoming;
  for(let index=0;index<steps.length;index++){
   const step=steps[index],phase=step.event.phase;let visible=0;
   if(index===0){push(index,'travel',travel(pose,layout.router),pose,layout.router);pose=layout.router;}
   else if(phase==='router-decapsulate'){push(index,'open',morph(pose,layout.open),pose,layout.open);pose=layout.open;}
   else if(phase==='router-ttl'){push(index,'change',tuning.state,pose,pose);visible+=tuning.state;}
   else if(phase==='router-reencapsulate'){push(index,'close',morph(pose,layout.router),pose,layout.router);pose=layout.router;}
   else if(phase==='next-link'){push(index,'travel',travel(pose,layout.outgoing),pose,layout.outgoing);pose=layout.outgoing;}
   if(step.read.length){const targets=step.read.map(id=>({id,label:buttons.get(id).querySelector('.lh-field-label').textContent,lines:layout.lines.get(id)})),read=motion.readingPlan(targets,layout.lens);push(index,'read',read.total,pose,pose,read);visible+=read.total;}
   const hold=pacing.prepare({facts:[{text:step.title+' '+step.detail}],visibleFor:visible}).hold;push(index,'hold',hold,pose,pose);
  }
  return {phases,total};
 }
 function measure(){
  measureJob=0;if(disposed)return;const previous=at(),w=stage.clientWidth;if(!w)return;
  const stepIndex=Math.max(0,currentIndex);bind(stepIndex);const style=getComputedStyle(face),padX=(parseFloat(style.paddingLeft)||0)+(parseFloat(style.paddingRight)||0),padY=(parseFloat(style.paddingTop)||0)+(parseFloat(style.paddingBottom)||0),openW=Math.min(480,w-24),compactW=Math.min(224,Math.max(160,w*.32));
  body.style.width=(openW-padX)+'px';face.style.width=openW+'px';face.style.height='auto';face.style.transform='none';face.style.left='0';face.style.top='0';setExtra(true);body.style.visibility='visible';const fullH=heading.offsetHeight+context.offsetHeight+body.offsetHeight+padY+20;
  setExtra(false);const openH=heading.offsetHeight+context.offsetHeight+body.offsetHeight+padY+20,closedH=heading.offsetHeight+context.offsetHeight+padY,compact=w<540,stageH=compact?(inspection?fullH:openH)+152:Math.max(430,fullH+138);stage.style.height=stageH+'px';
  const origin=face.getBoundingClientRect(),lines=new Map([...buttons].filter(([id])=>primary.includes(id)).map(([id,n])=>[id,motion.textLines(n.querySelector('.lh-field-value'),origin)])),font=parseFloat(getComputedStyle(buttons.get('ip-dst').querySelector('.lh-field-value')).fontSize),lens={w:clamp(font*1.2*1.6,34,62),h:Math.max(46,font*1.2*2.05)};
  const closedY=compact?126:stageH-170,center=w/2,routeY=compact?35:stageH-66,incoming={x:12,y:closedY,w:compactW,h:closedH},router={x:center-compactW/2,y:closedY,w:compactW,h:closedH},outgoing={x:w-compactW-12,y:closedY,w:compactW,h:closedH};
  layout={w,h:stageH,compact,fullH,openH,lines,lens,compactW,incoming,router,outgoing,open:{x:(w-openW)/2,y:compact?126:Math.max(12,stageH-140-openH),w:openW,h:openH},inspect:{x:(w-openW)/2,y:compact?126:Math.max(12,stageH-140-fullH),w:openW,h:fullH}};
  const nodes=[...root.querySelectorAll('.lh-net-node')],centers=[Math.max(46,w*.09),center,Math.min(w-46,w*.91)];nodes.forEach((node,i)=>{node.style.left=centers[i]+'px';node.style.top=(routeY-16)+'px';});const svg=q('.lh-route');svg.setAttribute('viewBox','0 0 '+w+' '+stageH);for(const path of svg.children)path.setAttribute('d','M '+centers[0]+' '+routeY+' H '+centers[2]);
  plan=buildPlan();if(previous){const fresh=plan.phases.find(p=>p.key===previous.key);clock=fresh?mix(fresh.start,fresh.end,previous.p):Math.min(clock,plan.total);}else clock=0;
  viewMotion=null;lensKey='';setExtra(inspection);material.prepare(openW,fullH);paintKey='';render();syncControls();
 }
 const queueMeasure=()=>{if(!measureJob&&!disposed)measureJob=scope.requestAnimationFrame(measure);};
 function drawBox(box){
  currentBox=box;const openness=clamp((box.h-layout.incoming.h)/(layout.open.h-layout.incoming.h));face.style.width=layout.open.w+'px';face.style.height=box.h+'px';face.style.left=box.x+'px';face.style.top=box.y+'px';face.style.width=box.w+'px';face.style.setProperty('--lh-open',String(openness));body.style.opacity=String(openness);body.style.visibility=openness>.001?'visible':'hidden';body.inert=!inspection;body.setAttribute('aria-hidden',String(!inspection));
  const key=[box.w,box.h,openness,inspection].join('|');if(paintKey!==key){material.morph(canvas,{w:box.w,h:box.h},24,openness,{w:layout.incoming.w,h:layout.incoming.h,r:24,open:0},{w:layout.open.w,h:inspection?layout.fullH:layout.open.h,r:24,open:1});paintKey=key;}
 }
 function drawLens(phase,box){
  if(inspection||phase.kind!=='read'||!phase.read?.total){reader.style.opacity='0';return;}
  const sample=planner.samplePlan(phase.read,phase.elapsed),key=currentIndex+'|'+layout.w;if(lensKey!==key){const clone=face.cloneNode(true);clone.removeAttribute('id');clone.querySelectorAll('[id]').forEach(n=>n.removeAttribute('id'));clone.querySelectorAll('button').forEach(n=>{n.removeAttribute('aria-pressed');});clone.querySelectorAll('.lh-old-value').forEach(n=>n.remove());clone.inert=true;clone.style.cssText='position:relative;left:0;top:0;width:'+layout.open.w+'px;height:'+layout.open.h+'px;--lh-open:1;';const cloneBody=clone.querySelector('.lh-packet-content');cloneBody.style.opacity='1';cloneBody.style.visibility='visible';material.paint(clone.querySelector('canvas'),layout.open.w,layout.open.h,24,1);readerCopy.replaceChildren(clone);lensKey=key;}
  const zoom=mix(1,planner.policy.zoom,sample.focus);reader.style.width=layout.lens.w+'px';reader.style.height=layout.lens.h+'px';reader.style.left=(box.x+sample.x-layout.lens.w/2)+'px';reader.style.top=(box.y+sample.y-layout.lens.h/2)+'px';reader.style.opacity=String(sample.opacity);readerCopy.style.transform='translate('+(layout.lens.w/2-sample.x*zoom)+'px,'+(layout.lens.h/2-sample.y*zoom)+'px) scale('+zoom+')';
 }
 function render(now=performance.now()){
  if(!layout||!plan)return;const phase=at();bind(phase.index,phase.kind==='change'&&!reduced.matches);let box=boxMix(phase.from,phase.to,smooth(phase.p));
  if(inspection)box=layout.inspect;else if(!playing&&clock>=plan.total)box=layout.open;if(viewMotion){const p=clamp((now-viewMotion.start)/viewMotion.duration);box=boxMix(viewMotion.from,viewMotion.to,smooth(p));if(p===1)viewMotion=null;}
  setExtra(inspection);drawBox(box);const changeProgress=phase.kind==='change'?phase.p:clamp((now-changeStart)/tuning.state);for(const change of changes){const p=smooth(changeProgress);change.copy.style.opacity=String(1-p);change.copy.style.transform='translateY('+(-8*p)+'px)';change.value.style.opacity=String(p);}if(changes.length&&changeProgress>=1)clearChanges();
  drawLens(phase,box);q('.lh-route-active').style.strokeDasharray=layout.w+' '+layout.w;q('.lh-route-active').style.strokeDashoffset=String(layout.w*(1-(phase.index===0?(phase.kind==='travel'?mix(.09,.5,smooth(phase.p)):.5):phase.index===steps.length-1?(phase.kind==='travel'?mix(.5,.91,smooth(phase.p)):.91):.5)));
  root.dataset.previewPhase=inspection?'inspect':phase.kind;root.dataset.previewProgress=String(phase.p);root.dataset.previewPlaying=String(playing);root.dataset.previewEvent=steps[phase.index].event.id;
 }
 function tick(now){frame=0;if(disposed)return;if(playing&&!viewMotion){const delta=last===null?0:Math.min(tuning.maxFrameStep,Math.max(0,now-last));clock=Math.min(plan.total,clock+delta);last=now;if(clock>=plan.total){const from={...currentBox};pause();viewMotion={from,to:layout.open,start:now,duration:tuning.morph};}}else if(playing)last=now;render(now);if(playing||viewMotion||changes.length)frame=scope.requestAnimationFrame(tick);}
 function requestFrame(){if(!frame&&!disposed)frame=scope.requestAnimationFrame(tick);}
 function inspect(next){pause();const from={...currentBox},returnFocus=!next&&body.contains(document.activeElement);inspection=next;if(layout.compact)measure();selected=null;for(const n of buttons.values())n.setAttribute('aria-pressed','false');if(returnFocus)toggle.focus({preventScroll:true});const target=next?layout.inspect:boxMix(at().from,at().to,smooth(at().p));viewMotion=reduced.matches?null:{from,to:target,start:performance.now(),duration:Math.max(tuning.morph,Math.hypot(target.x-currentBox.x,target.y-currentBox.y)*1.875/tuning.morphPeakSpeed)};caption(true);syncControls();render();requestFrame();}
 scope.listen(toggle,'click',()=>inspect(!inspection));
 scope.listen(playButton,'click',()=>{if(playing){pause();return;}if(inspection)inspect(false);if(clock>=plan.total){clock=0;viewMotion=reduced.matches?null:{from:{...currentBox},to:layout.incoming,start:performance.now(),duration:tuning.morph};}if(reduced.matches){clock=plan.total;inspection=true;render();syncControls();return;}playing=true;last=null;syncControls();requestFrame();});
 scope.listen(nextButton,'click',()=>{pause();const from={...currentBox},index=Math.min(steps.length-1,currentIndex+1),phase=plan.phases.find(p=>p.index===index&&p.kind==='hold');clock=index===steps.length-1?plan.total:phase.start;bind(index,!reduced.matches);viewMotion=reduced.matches?null:{from,to:inspection?layout.inspect:index===steps.length-1?layout.open:phase.to,start:performance.now(),duration:tuning.morph};caption(true);render();syncControls();requestFrame();});
 scope.listen(stage,'pointerdown',pause);scope.listen(stage,'focusin',pause);scope.listen(document,'visibilitychange',()=>{if(document.hidden)pause();});
 scope.listen(reduced,'change',()=>{pause();if(reduced.matches){inspection=true;viewMotion=null;}queueMeasure();});
 scope.listen(window,'resize',queueMeasure);
 scope.listen(root,'review-material-change',()=>{material.invalidate();queueMeasure();});const theme=new scope.MutationObserver(()=>{material.invalidate();queueMeasure();});theme.observe(root,{attributes:true,attributeFilter:['data-theme']});const resize=new scope.ResizeObserver(entries=>{if(entries.some(e=>Math.abs(e.contentRect.width-(layout?.w||0))>.5))queueMeasure();});resize.observe(stage);document.fonts.ready.then(queueMeasure);
 measure();if(reduced.matches){inspection=true;clock=0;measure();render();syncControls();}else if(autoplay){const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)&&!document.hidden){observer.disconnect();playing=true;last=null;syncControls();requestFrame();}},{threshold:.35});observer.observe(stage);scope.listen(window,'pagehide',()=>observer.disconnect());var autoplayObserver=observer;}else{clock=plan.total;render();syncControls();}
 return {pause,snapshot:()=>({open:inspection,progress:layout?clamp((currentBox.h-layout.incoming.h)/(layout.open.h-layout.incoming.h)):0,playing,clock,total:plan?.total,phase:at()?.kind,index:currentIndex,event:steps[currentIndex]?.event,continuity:steps[currentIndex]?.physical.continuityId,packetBytes:steps[currentIndex]?.packet.bytes.length,fields:steps[currentIndex]?.fields.map(f=>({id:f.id,value:f.value})),material:material.stats()}),dispose(){disposed=true;pause();if(frame)scope.cancelAnimationFrame(frame);if(measureJob)scope.cancelAnimationFrame(measureJob);autoplayObserver?.disconnect();resize.disconnect();theme.disconnect();clearChanges();motion.settleStatus();root.style.removeProperty('--lh-morph-duration');delete root.dataset.previewPhase;delete root.dataset.previewEvent;delete root.dataset.previewProgress;delete root.dataset.previewPlaying;}};
}
