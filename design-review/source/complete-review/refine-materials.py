from pathlib import Path
p=Path('complete-review/assemble.py');s=p.read_text();anchor="records=script[record_start:]"
replacement="""records=script[record_start:]
records=records.replace("const owners=[...root.querySelectorAll('[data-ui-surface=\\\"record\\\"]')];", "let owners=[...root.querySelectorAll('[data-ui-surface=\\\"record\\\"]')];")
records=records.replace('function paint(){\\n frame=0;', 'function paint(){\\n frame=0;syncOwners();')
records=records.replace('function invalidate(){for(const e of entries.values())', '''function syncOwners(){const next=[...root.querySelectorAll('[data-ui-surface="record"]')],set=new Set(next);for(const [owner,entry]of entries)if(!set.has(owner)){resize.unobserve?.(owner);entry.canvas.remove();entries.delete(owner);}for(const owner of next)if(!owners.includes(owner))resize.observe(owner);owners=next;}
function invalidate(){for(const e of entries.values())''')
"""
s=s.replace(anchor,replacement);p.write_text(s)
p=Path('complete-review/motion.js');s=p.read_text().replace("const segment=packet.segments.find(x=>i>=x.offset&&i<x.offset+x.length),field=segment.fields.find(x=>i>=x.offset&&i<x.offset+x.length);", "const segment=packet.segments.find(x=>i>=x.offset&&i<x.offset+x.length),field=segment.fields.find(x=>i>=segment.offset+x.offset&&i<segment.offset+x.offset+x.length);")
s=s.replace("' · offset '+field.offset", "' · offset '+(segment.offset+field.offset)")
a=s.index('function renderNetwork(at){');b=s.index('\nfunction renderComparison',a)
s=s[:a]+'''let networkElements=null,networkRecordKey='';
function renderNetwork(at){
 const key=plan.width+'|'+layoutKey;
 if(key!==networkKey){network=networkGeometry();networkKey=key;networkElements=null;}
 const s=q('.rv-diagram'),g=network,f=frames[at.index],previous=frames[at.index-1]?.state||f.state,current=f.state,t=at.kind==='transition'?ease(at.p):1;
 if(!networkElements){
  s.setAttribute('viewBox',`0 0 ${g.width} ${g.height}`);s.style.height=g.height+'px';s.replaceChildren(svg('title',{},'Source network · distinct control propagation'));networkElements=[];
  for(const link of g.links){const dx=link.b.x-link.a.x,dy=link.b.y-link.a.y,ta=1/Math.max(Math.abs(dx)/(link.a.w/2),Math.abs(dy)/22),tb=1/Math.max(Math.abs(dx)/(link.b.w/2),Math.abs(dy)/22),ax=link.a.x+dx*ta,ay=link.a.y+dy*ta,bx=link.b.x-dx*tb,by=link.b.y-dy*tb;
   const path=svg('path',{d:`M ${ax} ${ay} L ${bx} ${by}`,fill:'none'}),gap=svg('circle',{cx:(ax+bx)/2,cy:(ay+by)/2,fill:'var(--hs-bg)'}),label=svg('text',{x:(ax+bx)/2+10,y:(ay+by)/2-8,fill:'var(--rv-red)','font-size':12},'Down'),message=svg('circle',{r:4,fill:'var(--hs-accent)'});s.append(path,gap,label,message);networkElements.push({link,path,gap,label,message,ax,ay,bx,by});
  }
  for(const n of g.nodes){const box=g.boxes.get(n.id);s.append(svg('rect',{x:n.x-box.w/2,y:n.y-22,width:box.w,height:44,rx:16,fill:'var(--hs-panel)',stroke:'var(--hs-line)'}),svg('text',{x:n.x,y:n.y+5,'text-anchor':'middle',class:'rv-network-node'},n.label));}
 }
 const activePath=current.activePathId==='alternate'?['client-edge','edge-r2','r2-core','core-service']:['client-edge','edge-r1','r1-core','core-service'],beforePath=previous.activePathId==='alternate'?['client-edge','edge-r2','r2-core','core-service']:['client-edge','edge-r1','r1-core','core-service'];
 for(const el of networkElements){const broken=current.failedLinkIds.includes(el.link.id),wasBroken=previous.failedLinkIds.includes(el.link.id),failure=mix(wasBroken?1:0,broken?1:0,t),selected=mix(beforePath.includes(el.link.id)?1:0,activePath.includes(el.link.id)?1:0,t);el.path.setAttribute('stroke',failure>.01?'var(--rv-red)':selected>.01?'var(--hs-accent)':'var(--hs-route-line)');el.path.setAttribute('stroke-width',1+selected*1.5);el.path.setAttribute('opacity',failure?1:selected>.01?.85:.65);el.gap.setAttribute('r',6*failure);el.label.setAttribute('opacity',failure);const traveling=current.controlLinkIds.includes(el.link.id)&&at.kind==='transition';el.message.setAttribute('opacity',traveling?Math.sin(Math.PI*at.p):0);el.message.setAttribute('cx',mix(el.ax,el.bx,at.p));el.message.setAttribute('cy',mix(el.ay,el.by,at.p));}
 const recordKey=f.id+'|'+layoutKey;if(recordKey!==networkRecordKey){const records=q('.rv-network-records');records.replaceChildren();for(const fact of f.records){const r=node('section','rv-record');r.dataset.uiSurface='record';r.append(node('h3','',fact.label),node('p','',fact.value));records.append(r);}networkRecordKey=recordKey;root.recordMaterial?.invalidate();s.setAttribute('aria-label',f.summary);}
}
''' +s[b:]
s=s.replace("const width=q('.rv-main').clientWidth;let height", "const width=plan.width;let height")
p.write_text(s)
