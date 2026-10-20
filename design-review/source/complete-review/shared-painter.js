(()=>{
'use strict';
const root=document.getElementById('__ROOT__'),vertex=__VERTEX__,fragment=__FRAGMENT__,surface=document.createElement('canvas');
let epoch=0,draws=0,allocations=0,capacity={w:0,h:0};const cache=new Map(),owners=new Set(),morphFaces=new Map();
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
 if(!canvas||!(w>0&&h>0))return;
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
  if(open===0||open===1){image=document.createElement('canvas');image.width=pw;image.height=ph;image.getContext('2d')?.drawImage(surface,0,0);cache.set(fullKey,image);while(cache.size>2)cache.delete(cache.keys().next().value);}
 }
 if(canvas.width!==pw||canvas.height!==ph){canvas.width=pw;canvas.height=ph;allocations++;}
 canvas.style.width=pw/dpr+'px';canvas.style.height=ph/dpr+'px';const ctx=canvas.getContext('2d');if(ctx){ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,pw,ph);ctx.drawImage(image,0,0);}canvas.dataset.paintKey=key;
}
// Shape changes use two shader-rendered endpoint faces. Nine-slice composition
// preserves rounded rims without a GPU readback at every animation frame.
function morphFace(w,h,r,open){
 const key=[w,h,r,open,root.dataset.theme,epoch,session.epoch,session.state].join('|');
 let face=morphFaces.get(key);if(!face){face=document.createElement('canvas');paint(face,w,h,r,open);morphFaces.set(key,face);while(morphFaces.size>2)morphFaces.delete(morphFaces.keys().next().value);}return face;
}
function slice(ctx,face,source,w,h,r,alpha,targetDpr){
 if(alpha<=0)return;const scale=parseFloat(face.style.width)/face.width||1,dpr=1/scale,
  edge=Math.max(1,Math.min(source.r+12,(source.w-2)/2,(source.h-2)/2)),rim=Math.min(edge*r/Math.max(1,source.r),w/2,h/2),
  xs=[0,edge,source.w-edge,source.w],ys=[0,edge,source.h-edge,source.h],
  xd=[0,rim,w-rim,w],yd=[0,rim,h-rim,h];
 ctx.globalAlpha=alpha;
 for(let y=0;y<3;y++)for(let x=0;x<3;x++){
  const sw=xs[x+1]-xs[x],sh=ys[y+1]-ys[y],dw=xd[x+1]-xd[x],dh=yd[y+1]-yd[y];
  if(sw>0&&sh>0&&dw>0&&dh>0)ctx.drawImage(face,xs[x]*dpr,ys[y]*dpr,sw*dpr,sh*dpr,xd[x]*targetDpr,yd[y]*targetDpr,dw*targetDpr,dh*targetDpr);
 }
}
function morph(canvas,box,r,open,closed,expanded){
 // Endpoint paint stays exact, including the resting shader and fallback.
 if(open<=0||open>=1){paint(canvas,box.w,box.h,r,open<=0?(closed.open??0):(expanded.open??1));return;}
 const from={...closed},to={w:expanded.w,h:expanded.h,r:expanded.r??24},a=morphFace(from.w,from.h,from.r,from.open??0),b=morphFace(to.w,to.h,to.r,expanded.open??1),
  cssW=parseFloat(b.style.width),dpr=b.width/cssW,pw=b.width,ph=b.height,key=['morph',box.w,box.h,r,open,a.dataset.paintKey,b.dataset.paintKey].join('|');
 if(canvas.dataset.paintKey===key)return;
 if(canvas.width!==pw||canvas.height!==ph){canvas.width=pw;canvas.height=ph;allocations++;}
 canvas.style.width=cssW+'px';canvas.style.height=ph/dpr+'px';
 const ctx=canvas.getContext('2d');if(ctx){ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,pw,ph);slice(ctx,a,from,box.w,box.h,r,1-open,dpr);ctx.globalCompositeOperation='lighter';slice(ctx,b,to,box.w,box.h,r,open,dpr);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';}
 canvas.dataset.paintKey=key;
}
function invalidate(){for(const canvas of owners){if(!canvas.isConnected)owners.delete(canvas);else canvas.dataset.paintKey='';}cache.clear();morphFaces.clear();epoch++;}
root.surfacePainter=Object.freeze({paint,morph,paintOwner,prepare,invalidate,stats:()=>({draws,allocations,cache:cache.size+morphFaces.size,sessions:1,capacity:{...capacity}}),retry:()=>session.retry()});
})();
