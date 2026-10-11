(()=>{
'use strict';
const root=document.getElementById('__ROOT__'),NS='http://www.w3.org/2000/svg';
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
 for(const hit of crossings(links)){
  const l=links.find(l=>l.id===hit.id);gaps.append(createSvg('path',{d:path(hit.points),fill:'none',stroke:'var(--hs-bg)','stroke-width':5,'stroke-linecap':'butt'}),createSvg('path',{d:path(hit.points),fill:'none','data-edge':hit.id,stroke:l.failed?'var(--rv-red)':'var(--hs-route-line)','stroke-width':1.2,'stroke-linecap':'butt'}));
 }
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
