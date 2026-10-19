(()=>{
'use strict';
const root=document.getElementById('__ROOT__'),vertex=__VERTEX__,fragment=__FRAGMENT__,surface=document.createElement('canvas');
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
  if(open===0||open===1){image=document.createElement('canvas');image.width=pw;image.height=ph;image.getContext('2d')?.drawImage(surface,0,0);cache.set(fullKey,image);while(cache.size>4)cache.delete(cache.keys().next().value);}
 }
 if(canvas.width!==pw||canvas.height!==ph){canvas.width=pw;canvas.height=ph;allocations++;}
 canvas.style.width=pw/dpr+'px';canvas.style.height=ph/dpr+'px';const ctx=canvas.getContext('2d');if(ctx){ctx.clearRect(0,0,pw,ph);ctx.drawImage(image,0,0);}canvas.dataset.paintKey=key;
}
function invalidate(){for(const canvas of owners){if(!canvas.isConnected)owners.delete(canvas);else canvas.dataset.paintKey='';}cache.clear();epoch++;}
root.surfacePainter=Object.freeze({paint,paintOwner,prepare,invalidate,stats:()=>({draws,allocations,cache:cache.size,sessions:1,capacity:{...capacity}}),retry:()=>session.retry()});
})();
