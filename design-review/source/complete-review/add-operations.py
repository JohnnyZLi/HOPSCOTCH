from pathlib import Path
p=Path('complete-review/motion.html');s=p.read_text().replace('<option value="failure">', '<option value="packetOps">Packet · build and modify</option><option value="failure">',1)
s=s.replace('<div class="rv-actors"></div>', '<div class="rv-actors"></div><div class="rv-envelopes" aria-hidden="true"><div class="rv-envelope rv-envelope-header"><span>Ethernet II · 14 B</span><span class="rv-envelope-direction"></span></div><div class="rv-envelope rv-envelope-trailer"><span>FCS · unavailable in model bytes</span></div><div class="rv-payload-addon"><span class="rv-payload-addon-value"></span></div></div>')
p.write_text(s)
p=Path('complete-review/review.css');s=p.read_text()+'''
#__ROOT__ .rv-envelope{position:absolute;overflow:hidden;isolation:isolate;border-radius:18px;display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:14px 20px;font-size:13px;line-height:1.5;color:var(--hs-material-ink);background:var(--hs-packet-fallback);box-shadow:0 5px 16px color-mix(in srgb,var(--hs-ink) 9%,transparent)}
#__ROOT__ .rv-envelope canvas{position:absolute;inset:0;z-index:-1;border-radius:inherit;pointer-events:none}
#__ROOT__ .rv-envelope-header .rv-envelope-direction{margin-left:auto;font-size:12px;color:var(--hs-material-muted)}
#__ROOT__ .rv-envelope-trailer{color:var(--hs-muted);background:var(--hs-panel);box-shadow:none;border:1px solid var(--hs-line)}
#__ROOT__ .rv-payload-addon{position:absolute;border-radius:14px;overflow:hidden;padding:10px 14px;font-size:14px;line-height:1.5;white-space:nowrap;pointer-events:none;color:var(--hs-material-ink);background:var(--hs-panel);border:1px solid var(--hs-line);opacity:0}
''';p.write_text(s)
p=Path('complete-review/motion.js');s=p.read_text().replace("let sceneId='tcp'", "const envelopeCanvas=document.createElement('canvas');envelopeCanvas.setAttribute('aria-hidden','true');q('.rv-envelope-header').prepend(envelopeCanvas);\nlet sceneId='tcp'")
a=s.index(" if(id==='provider')")
s=s[:a]+''' if(id==='packetOps'){
  const specs=[{key:'assemble',source:0,title:'Separate pieces, precisely seated.',summary:'The Ethernet header seats against the IP packet. The FCS slot is explicitly unavailable because the source model does not supply it.',operation:'attach'},
   {key:'inspect',source:0,title:'Read before changing.',summary:'The reader follows the actual Version, TTL, and Destination glyphs. Its skinny aperture stays the same; the path adapts to the text.',operation:'read'},
   {key:'ttl',source:1,title:'TTL changes. Its checksum follows.',summary:'The source builder changes TTL from 64 to 63 and recomputes the IPv4 header checksum. TCP content is unchanged.',operation:'replace'},
   {key:'append',source:2,title:'More payload, derived consequences.',summary:'32 bytes are appended to the source payload. Packet length and TCP checksum are recomputed from the actual resulting bytes.',operation:'append'},
   {key:'remove',source:3,title:'Remove data, keep a valid header.',summary:'The source payload becomes empty. Packet length and dependent checksum fields follow that structural change.',operation:'remove'},
   {key:'detach',source:3,title:'The envelope separates cleanly.',summary:'The pieces separate using the same measured contact law in reverse. This is a construction study; it does not invent a router event or FCS bytes.',operation:'detach'}];
  return specs.map(spec=>{const packet=data.packetOperations[spec.source],network=packet.segments.find(s=>s.id==='network'),transport=packet.segments.find(s=>s.id==='transport'),fields=[...network.fields.filter(f=>['ip-version','ip-ttl','ip-length','ip-checksum','ip-src','ip-dst'].includes(f.id)),...transport.fields.filter(f=>f.id==='tcp-checksum'),{id:'payload-count',label:'Payload',value:packet.payloadBytes+' B'}].map(f=>({...f,value:String(f.value)}));
   return{...spec,id:spec.key,identity:'construction-frame',at:null,kind:'assembly',local:true,from:'Construction',to:'Inspection',protocol:'network',objectTitle:'IPv4 packet',fields,readIds:spec.operation==='replace'?['ip-ttl','ip-checksum']:spec.operation==='append'||spec.operation==='remove'?['payload-count','ip-length','tcp-checksum']:['ip-version','ip-ttl','ip-dst'],records:[{label:'Ethernet header',value:'14 B'},{label:'IPv4 packet',value:packet.networkBytes+' B'},{label:'Payload',value:packet.payloadBytes+' B'},{label:'FCS',value:'Unavailable · absent from model bytes'}],state:packet,bytes:packet.bytes};});
 }
''' +s[a:]
s=s.replace("if(sceneId==='packet'){\n  const carrier", "if(['packet','packetOps'].includes(sceneId)){\n  const carrier")
s=s.replace("data.packetVariants[variant].frameBytes+' B';", "(sceneId==='packet'?data.packetVariants[variant].frameBytes:data.packetOperations[0].frameBytes)+' B';",1)
s=s.replace("focusY=pathY+62", "focusY=pathY+62+(sceneId==='packetOps'?72:0)")
s=s.replace("const focus={x:(width-cardWidth)/2,y:focusY,w:cardWidth,h:height},emphasis=", "const focus={x:(width-cardWidth)/2,y:focusY,w:cardWidth,h:height},fit=motion.fitGeometry(cardWidth,[60,height,48],1),attach=motion.makeAttachmentPlan(1,0,fit),detach=motion.makeAttachmentPlan(0,1,fit),emphasis=")
s=s.replace("prepared.push({focus,lens,read,origin,targets,emphasis});", "prepared.push({focus,lens,read,origin,targets,emphasis,fit,attach,detach});")
s=s.replace("focusY+maxHeight+30", "focusY+maxHeight+(sceneId==='packetOps'?100:30)")
needle="  if(f.kind==='anatomy')"
a=s.index(needle)
s=s[:a]+'''  if(f.kind==='assembly'){if(i>0)add(i,'focus',tuning.morph);if(f.operation==='attach')add(i,'fitAttach',g.attach.duration);if(f.operation==='detach')add(i,'fitDetach',g.detach.duration);if(['append','remove','replace'].includes(f.operation))add(i,'modify',f.operation==='replace'?tuning.state:g.attach.duration);add(i,'read',g.read.total);commits.push(total);add(i,'hold',Math.max(tuning.minimumExposure,attention.hold));continue;}
''' +s[a:]
s=s.replace("else if(sceneId==='packet')for", "else if(['packet','packetOps'].includes(sceneId))for")
s=s.replace(" renderLens(at,s);q('.rv-transfer')", " renderAssembly(at,s);renderLens(at,s);q('.rv-transfer')")
a=s.index('function svg(tag,attrs,text)')
s=s[:a]+'''function renderAssembly(at,shape){
 const host=q('.rv-envelopes');host.hidden=sceneId!=='packetOps';if(host.hidden)return;const g=plan.prepared[at.index],f=frames[at.index],gap=f.operation==='attach'?(at.kind==='fitAttach'?motion.attachmentState(g.attach,at.elapsed).amount:0):f.operation==='detach'?(at.kind==='focus'?0:at.kind==='fitDetach'?motion.attachmentState(g.detach,at.elapsed).amount:1):0,spread=g.fit.spread*gap,top=q('.rv-envelope-header'),bottom=q('.rv-envelope-trailer');
 Object.assign(top.style,{left:g.focus.x+'px',top:(shape.box.y-60-spread)+'px',width:shape.box.w+'px',height:'60px'});Object.assign(bottom.style,{left:g.focus.x+'px',top:(shape.box.y+shape.box.h+spread)+'px',width:shape.box.w+'px',height:'48px'});top.style.opacity=String(f.operation==='attach'&&at.kind==='focus'?0:1);root.surfacePainter.paint(envelopeCanvas,shape.box.w,60,18,1);q('.rv-envelope-direction').textContent='02:48:4f:50:00:01 → 02:48:4f:50:00:02';
 const parcel=q('.rv-payload-addon');parcel.style.opacity='0';if(at.kind==='modify'&&['append','remove'].includes(f.operation)){const old=frames[Math.max(0,at.index-1)].state,current=f.state,amount=motion.attachmentState(g.attach,at.elapsed).amount,inserting=f.operation==='append',distance=g.fit.spread*(inserting?amount:1-amount),blend=inserting?1-ease((at.p-.7)/.3):1-ease((at.p-.75)/.25);q('.rv-payload-addon-value').textContent=(inserting?current.payloadBytes-old.payloadBytes:old.payloadBytes-current.payloadBytes)+' B · '+(inserting?'Appending':'Removing');Object.assign(parcel.style,{left:(g.focus.x+20)+'px',top:(shape.box.y+shape.box.h-52+distance)+'px',opacity:String(blend),transform:'translateY('+((inserting?1-amount:amount)*6)+'px)'});}
}
''' +s[a:]
s=s.replace("packet:'One frame. Every layer.',", "packet:'One frame. Every layer.',packetOps:'Construct. Read. Change. Keep the cause.',")
s=s.replace("packet:'Measured fields open from the compact source frame. Version, protocol, and exact byte ranges remain explicit.',", "packet:'Measured fields open from the compact source frame. Version, protocol, and exact byte ranges remain explicit.',packetOps:'Separate envelopes touch without merging. Construction changes derive lengths and checksums from real source bytes.',")
s=s.replace(" geometryReadsPerFrame:0", " plannerUsesCachedGeometry:true")
s=s.replace("geometryReadsPerFrame:0", "plannerUsesCachedGeometry:true")
s=s.replace("focus:'", "focus:'")
s=s.replace("transition:'state changes continuously'", "transition:'state changes continuously',focus:'opening another layer of the same object',fitAttach:'separate pieces seat at contact',fitDetach:'separate pieces release from contact',modify:'a structural change carries its consequences'")
p.write_text(s)
