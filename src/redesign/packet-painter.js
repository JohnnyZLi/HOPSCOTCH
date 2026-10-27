// Generated from the shared packet painter and approved shader.
export function mountPacketPainter(element,scope){
const {document,window,matchMedia,requestAnimationFrame,cancelAnimationFrame,ResizeObserver,MutationObserver}=scope;
(()=>{
'use strict';
const root=element,vertex=`attribute vec2 a_position;void main(){gl_Position=vec4(a_position,0.0,1.0);}`,fragment=`
    precision highp float;
    uniform sampler2D u_scene;
    uniform vec2 u_resolution;
    uniform vec2 u_center;
    uniform vec2 u_half;
    uniform vec2 u_light;
    uniform float u_radius;
    uniform float u_dpr;
    uniform float u_dark;
    uniform float u_open;
    float shape(vec2 p){vec2 q=abs(p)-u_half+u_radius;return length(max(q,0.0))+min(max(q.x,q.y),0.0)-u_radius;}
    ${element.glassEdge.glsl}
        // Dark glass uses broad optical planes and a narrow folded reflection.
    // The same object-relative environment serves anatomy and compact objects.
    vec3 nightFlow(vec2 uv){
      float bend=.39*uv.x+.17*sin(uv.x*1.75+.40);
      float seam=uv.y-bend-.12;
      vec3 blue=mix(vec3(.021,.046,.095),vec3(.075,.220,.500),smoothstep(-1.5,-.10,seam));
      float undertow=uv.y-(.24*uv.x+.16*sin(uv.x*1.8-.5)-.50);
      blue=mix(blue,vec3(.055,.250,.620),exp(-pow(undertow/.27,2.0))*.70);
      blue=mix(blue,vec3(.210,.420,.480),exp(-pow((seam+.16)/.19,2.0))*.82);
      blue*=1.0-.22*exp(-pow((seam+.035)/.035,2.0));
      vec3 upper=mix(vec3(.240,.320,.430),vec3(.090,.160,.260),smoothstep(.03,.85,seam));
      upper=mix(upper,vec3(.170,.310,.340),exp(-pow((uv.x+.55)/.75,2.0))*.32);
      vec3 col=mix(blue,upper,smoothstep(-.009,.016,seam));
      col=mix(col,vec3(.390,.500,.590),exp(-pow(seam/.014,2.0))*.55);
      float lower=uv.y-(.43*uv.x+.16*sin(uv.x*1.6+1.1)-.73);
      col=mix(col,vec3(.250,.240,.440),exp(-pow(lower/.32,2.0))*.56);
      col=mix(col,vec3(.285,.350,.550),exp(-pow((lower+.045)/.025,2.0))*.25);
      return col;
    }
    vec3 nightMaterial(vec3 background,vec3 pigment,vec3 normal,vec2 normal2,float depth,float slope){
      vec3 transmission=mix(background,pigment,.96-.17*pow(slope,2.0));
      float frost=.18*u_open*(1.0-.85*pow(slope,2.0));
      transmission=mix(transmission,vec3(.065,.090,.150),frost);
      vec3 light=normalize(vec3(u_light,.63));
      float orientation=dot(normal2,normalize(u_light));
      float spec=pow(max(dot(normal,normalize(light+vec3(0.0,0.0,1.0))),0.0),36.0);
      float fresnel=glassFresnel(normal.z,.012,.35,5.0);
      vec3 reflection=mix(vec3(.200,.320,.460),vec3(.700,.800,.900),smoothstep(.02,.88,orientation));
      vec3 color=mix(transmission,reflection,fresnel)+spec*.075;
      float undercut=exp(-pow((depth-3.0*u_dpr)/(1.7*u_dpr),2.0));
      color*=1.0-.16*undercut*(1.0-max(orientation,0.0));
      // Bound face reflections without desaturating the entire material.
      // This shared exposure limit leaves the thin optical perimeter intact.
      float energy=dot(pow(max(color,vec3(0.0)),vec3(2.2)),vec3(.2126,.7152,.0722));
      color*=pow(min(1.0,.095/max(energy,.001)),1.0/2.2);
      float rim=glassEdgeHighlight(depth,u_dpr,1.0);
      return mix(color,vec3(.540,.650,.750),rim*(.19+.36*max(orientation,0.0)));
    }

    vec3 flow(vec2 uv){
      if(u_dark>.5)return nightFlow(uv);
      // Two curved optical folds, defined in the packet's own coordinates.
      // They deform with the packet, independent of the surrounding canvas.
      float bend=.34*uv.x+.18*sin(uv.x*2.15+.35);
      float d=uv.y-bend-.34;
      vec3 cobalt=vec3(.025,.24,.81),deep=vec3(.015,.045,.35),cyan=vec3(.11,.72,.89);
      vec3 blue=mix(deep,cobalt,smoothstep(-1.6,-.18,d));
      float undertow=uv.y-(.10+.26*sin(uv.x*1.7-.5));
      blue=mix(blue,vec3(.075,.47,.92),exp(-pow((undertow+.62)/.30,2.0))*.75);
      blue=mix(blue,cyan,exp(-pow((d+.13)/.16,2.0))*.75);
      blue*=1.0-.30*exp(-pow((d+.038)/.038,2.0));
      vec3 pearl=mix(vec3(.83,.9,.91),vec3(.4,.71,.81),smoothstep(.02,.78,d));
      pearl=mix(pearl,vec3(.96,.95,.88),exp(-pow((uv.x+.60)/.72,2.0))*smoothstep(.10,.7,d)*.70);
      vec3 col=mix(blue,pearl,smoothstep(-.008,.014,d));
      col=mix(col,vec3(.91,.98,1.0),exp(-pow(d/.012,2.0))*.68);
      float fold=uv.y-(.50*uv.x+.19*sin(uv.x*2.0+1.5)-.71);
      col=mix(col,vec3(.19,.55,.80),exp(-pow(fold/.085,2.0))*.24);
      col=mix(col,vec3(.58,.66,.92),exp(-pow((fold+.055)/.027,2.0))*.17);
      return col;
    }
    vec3 backdrop(vec2 p){return texture2D(u_scene,clamp(p/u_resolution,vec2(.001),vec2(.999))).rgb;}
    void main(){
      vec2 pixel=gl_FragCoord.xy,p=pixel-u_center;float d=shape(p),aa=.85*u_dpr;vec3 original=backdrop(pixel);
      float sh=shape(p+vec2(0.0,10.0)*u_dpr);float shadow=exp(-max(sh,0.0)/(15.0*u_dpr))*(.12+u_dark*.13);original*=1.0-shadow*(1.0-smoothstep(-aa,aa,-d));
      if(d>aa){gl_FragColor=vec4(0.0);return;}
      float depth=max(-d,0.0),bevel=mix(15.0,12.0,u_open)*u_dpr,slope=1.0-clamp(depth/bevel,0.0,1.0),nz=sqrt(max(1.0-slope*slope,.001));
      vec2 normal2=glassSurfaceNormal(p,u_dpr);
      vec3 normal=normalize(vec3(normal2*slope,nz)),ray=refract(vec3(0.0,0.0,-1.0),normal,1.0/1.46);
      vec2 shift=ray.xy/max(abs(ray.z),.05)*(26.0+13.0*nz)*u_dpr;vec2 sampleAt=u_center+p*.955+shift;vec2 dispersion=normal2*pow(slope,2.0)*.65*u_dpr;
      vec3 transmission=vec3(backdrop(sampleAt+dispersion).r,backdrop(sampleAt).g,backdrop(sampleAt-dispersion).b);
      vec3 softened=vec3(0.0);
      for(int i=0;i<8;i++){float angle=float(i)*.785398;softened+=backdrop(sampleAt+vec2(cos(angle),sin(angle))*8.0*u_dpr);}
      softened/=8.0;transmission=mix(transmission,softened,.65);
      vec2 materialUV=p/u_half+shift/u_half*.70;
      vec3 pigment=flow(materialUV);
      if(u_dark>.5){gl_FragColor=vec4(nightMaterial(transmission,pigment,normal,normal2,depth,slope),1.0-smoothstep(-aa,aa,d));return;}
      // Pigment lives within the volume; only the outer edge transmits the scene.
      transmission=mix(transmission,pigment,.97-.28*pow(slope,2.0));
      float veil=.73*u_open*(1.0-.82*pow(slope,2.0));
      transmission=mix(transmission,mix(vec3(.98,.99,1.0),vec3(.025,.052,.10),u_dark),veil);
      vec3 light=normalize(vec3(u_light,.75));float spec=pow(max(dot(normal,normalize(light+vec3(0.0,0.0,1.0))),0.0),30.0),fresnel=glassFresnel(normal.z,.008,.28,4.0),orientation=dot(normal2,normalize(u_light));
      vec3 reflected=mix(vec3(.32,.48,.7),vec3(1.0),smoothstep(-.5,.85,orientation));
      vec3 color=mix(transmission,reflected,fresnel);color+=spec*.09;
      float rim=glassEdgeHighlight(depth,u_dpr,1.0);color=mix(color,vec3(1.0),rim*(.23+.43*max(orientation,0.0)));
      gl_FragColor=vec4(color,1.0-smoothstep(-aa,aa,d));
    }`,surface=document.createElement('canvas');
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

return element.surfacePainter;
}
