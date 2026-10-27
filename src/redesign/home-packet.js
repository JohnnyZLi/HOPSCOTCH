import {buildPacket,defaultPacketConfig} from '../packet/model';
import {mountPacketPainter} from './packet-painter.js';

// Interactive anatomy uses the product's packet bytes and painter, with no
// second simulation clock or autoplay loop.
export function mountHomePacket(root,scope){
 const packet=buildPacket(defaultPacketConfig),network=packet.segments.find(s=>s.id==='network'),transport=packet.segments.find(s=>s.id==='transport');
 const frame=root.querySelector('.lh-demo-frame'),face=root.querySelector('.lh-packet'),canvas=face.querySelector('canvas'),heading=face.querySelector('.lh-packet-heading'),body=face.querySelector('.lh-packet-content'),fields=face.querySelector('.lh-packet-fields'),toggle=root.querySelector('.lh-fold'),hint=root.querySelector('.lh-demo-hint');
 root.querySelector('.lh-packet-length').textContent=packet.networkBytes+' bytes';
 root.querySelector('.lh-packet-payload').textContent='Carries '+transport.label+' · destination port '+packet.config.destinationPort;
 let selection=null;
 const explanations={'ip-src':'Source: the address this packet came from.','ip-dst':'Destination: routers use this address to choose the next hop.','ip-protocol':'Protocol: tells the receiver which transport protocol is inside.','ip-ttl':'TTL: decreases at every router so a packet cannot circulate forever.'};
 for(const id of ['ip-src','ip-dst','ip-protocol','ip-ttl']){
  const field=network.fields.find(f=>f.id===id),button=document.createElement('button'),label=document.createElement('span'),value=document.createElement('span');
  button.type='button';button.className='lh-packet-field';button.dataset.field=id;button.setAttribute('aria-pressed','false');label.className='lh-field-label';value.className='lh-field-value';label.textContent=field.label;value.textContent=field.value;button.append(label,value);fields.append(button);
  scope.listen(button,'click',()=>{selection=id;for(const other of fields.children)other.setAttribute('aria-pressed',String(other===button));hint.textContent=explanations[id];});
 }
 const painter=mountPacketPainter(root,scope),reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let open=true,progress=1,layout=null,animation=0,measureJob=0,disposed=false;
 const ease=t=>t*t*t*(10+t*(-15+6*t));
 function paint(p){
  if(!layout)return;progress=p;const h=layout.closed+(layout.expanded-layout.closed)*p;
  face.style.height=h+'px';body.style.opacity=String(p);body.style.visibility=p===0?'hidden':'visible';
  painter.morph(canvas,{w:layout.w,h},24,p,{w:layout.w,h:layout.closed,r:24,open:0},{w:layout.w,h:layout.expanded,r:24,open:1});
 }
 function measure(){
  measureJob=0;if(disposed)return;
  const css=getComputedStyle(face),w=frame.clientWidth,padding=(parseFloat(css.paddingTop)||0)+(parseFloat(css.paddingBottom)||0),closed=heading.offsetHeight+padding,expanded=closed+body.offsetHeight+(parseFloat(getComputedStyle(body).marginTop)||0);
  if(!w||!expanded)return;layout={w,closed,expanded};frame.style.height=expanded+'px';painter.prepare(w,expanded);paint(progress);
 }
 const queueMeasure=()=>{if(!measureJob&&!disposed)measureJob=scope.requestAnimationFrame(measure);};
 function setOpen(next){
  open=next;hint.textContent=open?(selection?explanations[selection]:'Select a field to see what it does.'):'Open the packet to inspect its addresses and instructions.';toggle.setAttribute('aria-expanded',String(open));toggle.innerHTML=open?'Fold packet <span aria-hidden="true">−</span>':'Inspect packet <span aria-hidden="true">+</span>';body.inert=!open;body.setAttribute('aria-hidden',String(!open));
  if(!open&&body.contains(document.activeElement))toggle.focus({preventScroll:true});
  if(animation)scope.cancelAnimationFrame(animation);animation=0;
  if(!layout)measure();if(reduced.matches||!layout||progress===(open?1:0)){paint(open?1:0);return;}
  const from=progress,to=open?1:0,duration=Math.max(260,Math.min(700,Math.abs(to-from)*(layout.expanded-layout.closed)*1.875/.65)),start=performance.now();
  const tick=now=>{if(disposed)return;const t=Math.min(1,(now-start)/duration);paint(from+(to-from)*ease(t));animation=t<1?scope.requestAnimationFrame(tick):0;};animation=scope.requestAnimationFrame(tick);
 }
 scope.listen(toggle,'click',()=>setOpen(!open));scope.listen(reduced,'change',()=>setOpen(open));scope.listen(root,'review-material-change',queueMeasure);
 const resize=new scope.ResizeObserver(queueMeasure);resize.observe(frame);resize.observe(body);resize.observe(heading);
 const appearance=new scope.MutationObserver(()=>{painter.invalidate();queueMeasure();});appearance.observe(root,{attributes:true,attributeFilter:['data-theme']});
 document.fonts.ready.then(queueMeasure);measure();
 return {snapshot:()=>({open,progress,packetBytes:packet.bytes.length,fields:network.fields.map(f=>({id:f.id,value:f.value})),material:painter.stats()}),dispose(){disposed=true;if(animation)scope.cancelAnimationFrame(animation);if(measureJob)scope.cancelAnimationFrame(measureJob);resize.disconnect();appearance.disconnect();}};
}
