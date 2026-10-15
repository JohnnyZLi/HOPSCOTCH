// Generated pure geometry; source nodes, links, and contact audits are preserved.
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



self.onmessage=async event=>{const {graph,metrics,authored}=event.data,measure=label=>metrics[label].width;measure.box=label=>metrics[label].box;try{self.postMessage({plan:await buildAsync(graph,measure,()=>{},authored)});}catch(error){self.postMessage({error:error.message});}};
