// Measured lens edges sample the same wallpaper used by the visible page.
export function mountWallpaperGlass(element,scope){
 const {document,window,matchMedia,requestAnimationFrame,cancelAnimationFrame,ResizeObserver,MutationObserver}=scope;
 'use strict';
 const root=element;
 const owners=[...root.querySelectorAll('[data-glass-role]')];
 const recordVertex=`attribute vec2 a_position;void main(){gl_Position=vec4(a_position,0.0,1.0);}`;
 const recordFragment=`precision highp float;
 uniform sampler2D u_scene;
 uniform vec2 u_raster;
 uniform vec2 u_half;
 uniform vec2 u_origin;
 uniform vec2 u_imageExtent;
 uniform vec2 u_imageOffset;
 uniform vec2 u_light;
 uniform float u_radius;
 uniform float u_dpr;
 uniform float u_dark;
 uniform float u_depth;
 uniform float u_frost;
 float shape(vec2 p){
  vec2 q=abs(p)-u_half+u_radius;
  return length(max(q,0.0))+min(max(q.x,q.y),0.0)-u_radius;
 }
 ${element.glassEdge.glsl}
 vec3 backdrop(vec2 point){
  vec2 uv=(point+u_imageOffset)/u_imageExtent;
  vec2 soften=vec2(1.2)/u_imageExtent;
  return texture2D(u_scene,uv).rgb*.5
   +(texture2D(u_scene,uv+vec2(soften.x,0.0)).rgb
   +texture2D(u_scene,uv-vec2(soften.x,0.0)).rgb
   +texture2D(u_scene,uv+vec2(0.0,soften.y)).rgb
   +texture2D(u_scene,uv-vec2(0.0,soften.y)).rgb)*.125;
 }
 void main(){
  vec2 pixel=gl_FragCoord.xy/u_raster*(2.0*u_half);
  vec2 p=pixel-u_half;
  float distance=shape(p),aa=.8/u_dpr;
  if(distance>aa){gl_FragColor=vec4(0.0);return;}
  float depth=max(-distance,0.0);
  float bevel=min(u_radius*.46,mix(8.5,16.0,clamp((u_depth-.12)/.38,0.0,1.0)));
  float slope=1.0-smoothstep(0.0,bevel,depth);
  if(slope<=0.0){gl_FragColor=vec4(0.0);return;}
  vec2 normal2=glassSurfaceNormal(p,1.0/u_dpr);
  vec3 normal=normalize(vec3(normal2*slope,sqrt(max(1.0-slope*slope,.002))));
  vec3 ray=refract(vec3(0.0,0.0,-1.0),normal,1.0/1.46);
  float thickness=clamp(u_radius*.75,8.0,24.0)*(u_depth/.34);
  vec2 bend=vec2(ray.x,-ray.y)*thickness/max(-ray.z,.3);
  vec2 point=u_origin+vec2(pixel.x,u_half.y*2.0-pixel.y);
  vec3 transmitted=backdrop(point+bend);
  vec3 neutral=mix(vec3(1.0),vec3(.169,.235,.322),u_dark);
  vec3 color=mix(transmitted,neutral,u_frost);
  vec3 light=normalize(vec3(u_light,mix(.78,.66,u_dark)));
  float orientation=dot(normal2,normalize(u_light));
  float lit=max(orientation,0.0);
  float crest=glassEdgeHighlight(depth,1.0/u_dpr,.84);
  float fresnel=glassFresnel(normal.z,.014,.32,4.0);
  float spec=pow(max(dot(normal,normalize(light+vec3(0.0,0.0,1.0))),0.0),34.0);
  float highlight=clamp(crest*(.14+.60*lit)+spec*.34+fresnel*(.16+.45*lit),0.0,.86);
  color=mix(color,vec3(.96,.985,1.0),highlight*mix(1.0,.8,u_dark));
  color*=1.0-.17*slope*slope*max(-orientation,0.0);
  float band=1.0-smoothstep(bevel*.46,bevel,depth);
  float coverage=1.0-smoothstep(-aa,aa,distance);
  gl_FragColor=vec4(color,band*coverage);
 }
 `;
 const surface=document.createElement('canvas');
 const entries=new Map(),cache=new Map(),textures=new Map(),texturePixels=new Map();
 const reduced=matchMedia('(prefers-reduced-transparency: reduce)');
 const forced=matchMedia('(forced-colors: active)');
 const motion=matchMedia('(prefers-reduced-motion: reduce)');
 let frame=0,valid=false,gl=null,uniforms={},textureKey='',maxTexture=4096,disposed=false;
 let rootBounds=null,layoutDirty=true,draws=0;
 function fallback(){for(const owner of owners)owner.removeAttribute('data-ui-optics');}
 const session=root.packetMaterial.create({
  owner:root,surface,vertex:recordVertex,fragment:recordFragment,
  names:['u_scene','u_raster','u_half','u_origin','u_imageExtent','u_imageOffset','u_light','u_radius','u_dpr','u_dark','u_depth','u_frost'],
  onChange:()=>{valid=false;textureKey='';cache.clear();fallback();invalidate();}
 });
 function queue(){if(!frame&&!document.hidden&&!disposed)frame=requestAnimationFrame(paint);}
 function invalidate(){layoutDirty=true;for(const entry of entries.values())entry.key='';queue();}
 const number=(css,key,defaultValue)=>{const value=parseFloat(css.getPropertyValue(key));return Number.isFinite(value)?value:defaultValue;};
 function measure(){
  rootBounds=root.getBoundingClientRect();
  for(const [owner,entry]of entries){
   const box=owner.getBoundingClientRect(),css=getComputedStyle(owner);
   const bx=(parseFloat(css.borderLeftWidth)||0)+(parseFloat(css.borderRightWidth)||0);
   const by=(parseFloat(css.borderTopWidth)||0)+(parseFloat(css.borderBottomWidth)||0);
   const w=Math.max(0,box.width-bx),h=Math.max(0,box.height-by);
   const density=Math.max(0,Math.min(2,number(css,'--hs-ui-density',1)));
   entry.geometry={w,h,x:box.left-rootBounds.left+bx/2,y:box.top-rootBounds.top+by/2,
    radius:Math.max(0,Math.min(w/2,h/2,(parseFloat(css.borderTopLeftRadius)||0)-bx/2)),
    depth:Math.max(.12,Math.min(.5,number(css,'--hs-glass-depth',.34))),
    frost:Math.max(number(css,'--hs-liquid-opacity-min',.08),Math.min(.9,number(css,'--hs-liquid-opacity-base',.14)+density*number(css,'--hs-liquid-opacity-step',.06)))};
   entry.client=box;
   entry.readings=[...owner.querySelectorAll('[data-glass-reading]')].map(node=>{
    const b=node.getBoundingClientRect();return {node,x:b.left-rootBounds.left,y:b.top-rootBounds.top,w:b.width,h:b.height};
   });
  }
  layoutDirty=false;
 }
 function texture(image,theme){
  if(textures.has(theme))return textures.get(theme);
  const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
  if(!ctx)return null;
  const ratio=Math.min(1,1024/image.naturalWidth,1024/image.naturalHeight);
  canvas.width=Math.max(1,Math.round(image.naturalWidth*ratio));
  canvas.height=Math.max(1,Math.round(image.naturalHeight*ratio));
  ctx.drawImage(image,0,0,canvas.width,canvas.height);textures.set(theme,canvas);return canvas;
 }
 function readingContrast(entry,theme,extent,offset,pixels){
  if(!entry.readings?.length)return;
  const neutral=theme==='dark'?[43,60,82]:[255,255,255],colors=[[23,43,69],[240,245,255]];
  const lum=rgb=>rgb.reduce((sum,c,i)=>{c/=255;return sum+(c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4))*[.2126,.7152,.0722][i];},0);
  const samples=entry.readings.map(reading=>{
   const points=[];
   for(let row=0;row<3;row++)for(let col=0;col<7;col++){
    const x=reading.x+reading.w*(col+.5)/7,y=reading.y+reading.h*(row+.5)/3;
    const px=Math.max(0,Math.min(pixels.width-1,Math.round((x+offset[0])/extent[0]*pixels.width)));
    const py=Math.max(0,Math.min(pixels.height-1,Math.round((y+offset[1])/extent[1]*pixels.height)));
    const index=(py*pixels.width+px)*4;points.push([...pixels.data.slice(index,index+3)]);
   }
   return points;
  });
  const score=frost=>samples.map(points=>{
   const luminances=points.map(rgb=>lum(rgb.map((c,i)=>c*(1-frost)+neutral[i]*frost)));
   const candidates=colors.map(rgb=>{const l=lum(rgb);return {rgb,contrast:Math.min(...luminances.map(bg=>(Math.max(l,bg)+.05)/(Math.min(l,bg)+.05)))};});
   return candidates[0].contrast>=candidates[1].contrast?candidates[0]:candidates[1];
  });
  let frost=entry.geometry.frost,choices=score(frost);
  if(choices.some(c=>c.contrast<4.5)){
   let lo=frost,hi=.62;
   for(let i=0;i<8;i++){const mid=(lo+hi)/2;if(score(mid).every(c=>c.contrast>=4.5))hi=mid;else lo=mid;}
   frost=hi;choices=score(frost);
  }
  entry.geometry.frost=frost;
  entry.canvas.parentElement.style.setProperty('--hs-liquid-opacity',String(frost));
  entry.readings.forEach((reading,index)=>reading.node.style.setProperty('--hs-optical-ink','rgb('+choices[index].rgb.join(' ')+')'));
 }
 // A bounded CPU edge uses the same measured lens model when WebGL is absent.
 // It samples the actual page wallpaper and leaves the reading plane transparent.
 function rasterizeEdge(dw,dh,g,extent,offset,dark,light,dpr,pixels){
  const output=new Uint8ClampedArray(dw*dh*4),data=pixels.data,tw=pixels.width,th=pixels.height;
  const clamp=(n,a=0,b=1)=>Math.min(b,Math.max(a,n));
  const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
  const bevel=Math.min(g.radius*.46,8.5+7.5*clamp((g.depth-.12)/.38));
  const thickness=clamp(g.radius*.75,8,24)*(g.depth/.34),aa=.8/dpr;
  const ll=Math.hypot(...light),lz=dark?.66:.78,ln=Math.hypot(...light,lz);
  const half=[light[0]/ln,light[1]/ln,lz/ln+1],hn=Math.hypot(...half);
  const normalLight=[light[0]/ll,light[1]/ll],neutral=dark?[.169,.235,.322]:[1,1,1];
  const sample=(x,y,channel)=>{
   const px=clamp(x/extent[0]*tw-.5,0,tw-1),py=clamp(y/extent[1]*th-.5,0,th-1);
   const x0=Math.floor(px),y0=Math.floor(py),x1=Math.min(tw-1,x0+1),y1=Math.min(th-1,y0+1),tx=px-x0,ty=py-y0;
   return ((data[(y0*tw+x0)*4+channel]*(1-tx)+data[(y0*tw+x1)*4+channel]*tx)*(1-ty)
    +(data[(y1*tw+x0)*4+channel]*(1-tx)+data[(y1*tw+x1)*4+channel]*tx)*ty)/255;
  };
  for(let y=0;y<dh;y++)for(let x=0;x<dw;x++){
   const px=(x+.5)/dw*g.w-g.w/2,py=g.h/2-(y+.5)/dh*g.h;
   const qx=Math.abs(px)-g.w/2+g.radius,qy=Math.abs(py)-g.h/2+g.radius;
   const qxx=Math.max(qx,0),qyy=Math.max(qy,0),ql=Math.hypot(qxx,qyy);
   const distance=ql+Math.min(Math.max(qx,qy),0)-g.radius,depth=Math.max(-distance,0);
   if(distance>aa||depth>=bevel)continue;
   const nx=ql>0?qxx/ql*Math.sign(px):qx>qy?Math.sign(px):0;
   const ny=ql>0?qyy/ql*Math.sign(py):qy>=qx?Math.sign(py):0;
   const slope=1-smooth(0,bevel,depth),nz0=Math.sqrt(Math.max(1-slope*slope,.002));
   const norm=Math.hypot(nx*slope,ny*slope,nz0),nz=nz0/norm,nnx=nx*slope/norm,nny=ny*slope/norm;
   const eta=1/1.46,k=eta*nz-Math.sqrt(1-eta*eta*(1-nz*nz)),rz=-eta+k*nz;
   const bendX=k*nnx*thickness/Math.max(-rz,.3),bendY=-k*nny*thickness/Math.max(-rz,.3);
   const orientation=nx*normalLight[0]+ny*normalLight[1],lit=Math.max(orientation,0);
   const crest=Math.exp(-Math.pow((depth-.8/dpr*.84)/(.55/dpr*.84),2));
   const fresnel=.014+.32*Math.pow(1-nz,4);
   const spec=Math.pow(Math.max(0,(nnx*half[0]+nny*half[1]+nz*half[2])/hn),34);
   const highlight=clamp(crest*(.14+.60*lit)+spec*.34+fresnel*(.16+.45*lit),0,.86)*(dark?.8:1);
   const shade=1-.17*slope*slope*Math.max(-orientation,0),index=(y*dw+x)*4;
   const sx=g.x+px+g.w/2+bendX+offset[0],sy=g.y+g.h/2-py+bendY+offset[1];
   for(let c=0;c<3;c++){
    const transmitted=sample(sx,sy,c),frosted=transmitted*(1-g.frost)+neutral[c]*g.frost;
    output[index+c]=Math.round((frosted*(1-highlight)+[.96,.985,1][c]*highlight)*shade*255);
   }
   output[index+3]=Math.round((1-smooth(bevel*.46,bevel,depth))*(1-smooth(-aa,aa,distance))*255);
  }
  return output;
 }
 function paint(){
  frame=0;
  if(!root.isConnected||document.hidden||disposed)return;
  if(reduced.matches||forced.matches){fallback();return;}
  if(!valid){
   if(session.ready()){
    gl=session.gl;uniforms=session.uniforms;
    maxTexture=Math.min(4096,gl.getParameter(gl.MAX_TEXTURE_SIZE)||4096);valid=true;
   }
  }
  const recolor=layoutDirty;
  if(layoutDirty)measure();
  const theme=root.dataset.theme==='dark'?'dark':'light';
  const image=root.querySelector('.lh-wallpaper-'+theme);
  if(!image.complete||!image.naturalWidth){fallback();return;}
  const uploadKey=theme+'|'+session.epoch;
  if(valid&&uploadKey!==textureKey){
   const source=texture(image,theme);if(!source){fallback();return;}
   gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
   gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);
   textureKey=uploadKey;
  }
  const scale=Math.max(rootBounds.width/image.naturalWidth,rootBounds.height/image.naturalHeight);
  const extent=[image.naturalWidth*scale,image.naturalHeight*scale];
  const offset=[(extent[0]-rootBounds.width)/2,(extent[1]-rootBounds.height)/2];
  if(recolor&&[...entries.values()].some(e=>e.readings?.length)){
   if(!texturePixels.has(theme)){
    const source=texture(image,theme);
    if(source)texturePixels.set(theme,source.getContext('2d').getImageData(0,0,source.width,source.height));
   }
   const pixels=texturePixels.get(theme);
   if(pixels)for(const entry of entries.values())readingContrast(entry,theme,extent,offset,pixels);
  }
  let moving=false;
  for(const [owner,entry]of entries){
   const g=entry.geometry;if(!g||g.w<=0||g.h<=0)continue;
   for(let axis=0;axis<2;axis++){
    const delta=entry.target[axis]-entry.light[axis];
    if(!valid||motion.matches||Math.abs(delta)<.002)entry.light[axis]=entry.target[axis];
    else{entry.light[axis]+=delta*.24;moving=true;}
   }
   const dpr=Math.min(devicePixelRatio||1,valid?2:1.25,Math.sqrt(393216/(g.w*g.h)),maxTexture/g.w,maxTexture/g.h);
   const dw=Math.max(1,Math.floor(g.w*dpr)),dh=Math.max(1,Math.floor(g.h*dpr));
   const key=[valid?'gpu':'cpu',dw,dh,g.x,g.y,g.radius,g.depth,g.frost,theme,rootBounds.width,rootBounds.height,...entry.light.map(x=>x.toFixed(3))].join('|');
   if(entry.key===key)continue;
   try{
    let image=cache.get(key);
    if(!image){
     image=document.createElement('canvas');image.width=dw;image.height=dh;
     const ctx=image.getContext('2d');if(!ctx)throw Error('Optical surface copy unavailable');
     if(valid){
     surface.width=dw;surface.height=dh;gl.viewport(0,0,dw,dh);
     gl.uniform2f(uniforms.u_raster,dw,dh);gl.uniform2f(uniforms.u_half,g.w/2,g.h/2);
     gl.uniform2f(uniforms.u_origin,g.x,g.y);gl.uniform2f(uniforms.u_imageExtent,...extent);gl.uniform2f(uniforms.u_imageOffset,...offset);
     gl.uniform2f(uniforms.u_light,...entry.light);gl.uniform1f(uniforms.u_radius,g.radius);
     gl.uniform1f(uniforms.u_dpr,dpr);gl.uniform1f(uniforms.u_dark,theme==='dark'?1:0);
     gl.uniform1f(uniforms.u_depth,g.depth);gl.uniform1f(uniforms.u_frost,g.frost);
     gl.drawArrays(gl.TRIANGLES,0,6);draws++;
     ctx.drawImage(surface,0,0);
     }else{
      if(!texturePixels.has(theme)){
       const source=texture(root.querySelector('.lh-wallpaper-'+theme),theme);
       if(!source)throw Error('Wallpaper sampling unavailable');
       texturePixels.set(theme,source.getContext('2d').getImageData(0,0,source.width,source.height));
      }
      const pixels=ctx.createImageData(dw,dh);
      pixels.data.set(rasterizeEdge(dw,dh,g,extent,offset,theme==='dark',entry.light,dpr,texturePixels.get(theme)));
      ctx.putImageData(pixels,0,0);draws++;
     }
     cache.set(key,image);
     while(cache.size>12)cache.delete(cache.keys().next().value);
    }
    entry.canvas.width=dw;entry.canvas.height=dh;entry.ctx.clearRect(0,0,dw,dh);entry.ctx.drawImage(image,0,0);
    owner.style.setProperty('--hs-ui-inner-radius',g.radius+'px');owner.setAttribute('data-ui-optics','ready');entry.key=key;
   }catch{owner.removeAttribute('data-ui-optics');entry.key='';}
  }
  if(moving)queue();
 }
 const resize=new ResizeObserver(invalidate);resize.observe(root);
 for(const owner of owners){
  const canvas=document.createElement('canvas');canvas.className='hs-record-glass';canvas.setAttribute('aria-hidden','true');
  const ctx=canvas.getContext('2d');if(!ctx)continue;
  owner.prepend(canvas);
  const light=[-.65,.9];const entry={canvas,ctx,key:'',light:[...light],target:[...light],geometry:null,client:null};
  entries.set(owner,entry);resize.observe(owner);
  for(const reading of owner.querySelectorAll('[data-glass-reading]'))resize.observe(reading);
  scope.listen(owner,'pointerenter',()=>{layoutDirty=true;queue();});
  scope.listen(owner,'pointermove',event=>{
   if(!valid||motion.matches||event.pointerType==='touch'||!entry.client)return;
   const box=entry.client;if(!box.width||!box.height)return;
   entry.target=[-.65+((event.clientX-box.left)/box.width-.5)*.36,.9-((event.clientY-box.top)/box.height-.5)*.25];queue();
  });
  scope.listen(owner,'pointerleave',()=>{entry.target=[...light];queue();});
 }
 for(const image of root.querySelectorAll('.lh-wallpaper'))scope.listen(image,'load',invalidate);
 new MutationObserver(invalidate).observe(root,{attributes:true,attributeFilter:['data-theme']});
 reduced.addEventListener('change',invalidate);forced.addEventListener('change',invalidate);motion.addEventListener('change',invalidate);
 window.addEventListener('resize',invalidate);scope.listen(root,'change',invalidate);
 document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;}else invalidate();});
 function watchDpr(){const mq=matchMedia('(resolution: '+(devicePixelRatio||1)+'dppx)');const change=()=>{mq.removeEventListener('change',change);watchDpr();invalidate();};mq.addEventListener('change',change);}
 watchDpr();
 root.recordMaterial=Object.freeze({invalidate,stats:()=>({draws,pending:Boolean(frame),surfaces:entries.size,cached:cache.size}),
  dispose(){disposed=true;cancelAnimationFrame(frame);frame=0;for(const entry of entries.values())entry.canvas.remove();entries.clear();cache.clear();textures.clear();texturePixels.clear();}
 });
 queue();
 return root.recordMaterial;
}
