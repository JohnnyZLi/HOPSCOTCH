// Generated from the approved shared packet material.
export function mountMaterialFoundation(element,scope){
const {document,window,matchMedia,requestAnimationFrame,cancelAnimationFrame,ResizeObserver,MutationObserver}=scope;

(()=>{
 const root=element;
 root.glassEdge=Object.freeze({glsl:`// Geometry and edge-lighting primitives shared by packets and supporting glass.
vec2 glassSurfaceNormal(vec2 p,float dpr){
 vec2 gradient=vec2(shape(p+vec2(dpr,0.0))-shape(p-vec2(dpr,0.0)),shape(p+vec2(0.0,dpr))-shape(p-vec2(0.0,dpr)));
 return gradient/max(length(gradient),.0001);
}
float glassEdgeHighlight(float depth,float dpr,float materialDepth){
 return exp(-pow((depth-.8*dpr*materialDepth)/(.55*dpr*materialDepth),2.0));
}
float glassFresnel(float normalZ,float base,float strength,float power){
 return base+strength*pow(1.0-normalZ,power);
}
`});
 root.materialAppearance=Object.freeze({
  darkBackdrop:Object.freeze([23,26,32,255]),
  darkLight:Object.freeze([-.58,.88])
 });
})();


(()=>{
'use strict';
const app=element;
const history=[],sessions=new Set(),textures=new Map();
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)),mix=(a,b,t)=>a+(b-a)*t;
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
const blend=(a,b,t)=>{for(let i=0;i<3;i++)a[i]+=(b[i]-a[i])*t;return a;};
const bump=(x,w)=>Math.exp(-Math.pow(x/w,2));
function report(owner,phase,detail=''){
 history.push({owner:owner.id||owner.attrs?.id||'material',phase,detail:String(detail).slice(0,2048)});
 if(history.length>32)history.shift();
}
// The same object-relative folds as the GPU material. Only the edge optics are
// simplified. Two bounded textures serve every fallback size and every scene.
function pigment(x,y,dark){
 if(dark){
  const seam=y-(.39*x+.17*Math.sin(x*1.75+.40))-.12;
  let blue=blend([.021,.046,.095],[.075,.220,.500],smooth(-1.5,-.10,seam));
  const undertow=y-(.24*x+.16*Math.sin(x*1.8-.5)-.50);
  blue=blend(blue,[.055,.250,.620],bump(undertow,.27)*.70);
  blue=blend(blue,[.210,.420,.480],bump(seam+.16,.19)*.82);
  blue=blue.map(v=>v*(1-.22*bump(seam+.035,.035)));
  let upper=blend([.240,.320,.430],[.090,.160,.260],smooth(.03,.85,seam));
  upper=blend(upper,[.170,.310,.340],bump(x+.55,.75)*.32);
  let col=blend(blue,upper,smooth(-.009,.016,seam));
  col=blend(col,[.390,.500,.590],bump(seam,.014)*.55);
  const lower=y-(.43*x+.16*Math.sin(x*1.6+1.1)-.73);
  col=blend(col,[.250,.240,.440],bump(lower,.32)*.56);
  col=blend(col,[.285,.350,.550],bump(lower+.045,.025)*.25);
  col=blend([23/255,26/255,32/255],col,.96);
  col=blend(col,[.065,.090,.150],.18);
  col=blend(col,[.35,.46,.59],.012);
  const energy=col.reduce((s,v,i)=>s+Math.pow(Math.max(v,0),2.2)*[.2126,.7152,.0722][i],0);
  const exposure=Math.pow(Math.min(1,.095/Math.max(energy,.001)),1/2.2);
  return col.map(v=>v*exposure);
 }
 const d=y-(.34*x+.18*Math.sin(x*2.15+.35))-.34;
 let blue=blend([.015,.045,.35],[.025,.24,.81],smooth(-1.6,-.18,d));
 const undertow=y-(.10+.26*Math.sin(x*1.7-.5));
 blue=blend(blue,[.075,.47,.92],bump(undertow+.62,.30)*.75);
 blue=blend(blue,[.11,.72,.89],bump(d+.13,.16)*.75);
 blue=blue.map(v=>v*(1-.30*bump(d+.038,.038)));
 let pearl=blend([.83,.9,.91],[.4,.71,.81],smooth(.02,.78,d));
 pearl=blend(pearl,[.96,.95,.88],bump(x+.60,.72)*smooth(.10,.7,d)*.70);
 let col=blend(blue,pearl,smooth(-.008,.014,d));
 col=blend(col,[.91,.98,1],bump(d,.012)*.68);
 const fold=y-(.50*x+.19*Math.sin(x*2+1.5)-.71);
 col=blend(col,[.19,.55,.80],bump(fold,.085)*.24);
 col=blend(col,[.58,.66,.92],bump(fold+.055,.027)*.17);
 col=blend([243/255,245/255,247/255],col,.97);
 col=blend(col,[.98,.99,1],.73);
 return blend(col,[.74,.82,.91],.008);
}
function texture(theme){
 if(textures.has(theme))return textures.get(theme);
 const n=384,canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
 if(!ctx)return null;
 canvas.width=n;canvas.height=n;
 const pixels=ctx.createImageData(n,n);
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  const col=pigment((x+.5)/n*2-1,1-(y+.5)/n*2,theme==='dark'),i=(y*n+x)*4;
  for(let c=0;c<3;c++)pixels.data[i+c]=Math.round(clamp(col[c])*255);
  pixels.data[i+3]=255;
 }
 ctx.putImageData(pixels,0,0);textures.set(theme,canvas);return canvas;
}
function round(ctx,w,h,r){
 r=Math.min(r,w/2,h/2);ctx.beginPath();
 ctx.moveTo(r,0);ctx.lineTo(w-r,0);ctx.quadraticCurveTo(w,0,w,r);
 ctx.lineTo(w,h-r);ctx.quadraticCurveTo(w,h,w-r,h);ctx.lineTo(r,h);
 ctx.quadraticCurveTo(0,h,0,h-r);ctx.lineTo(0,r);ctx.quadraticCurveTo(0,0,r,0);ctx.closePath();
}
function drawFallback(canvas,w,h,radius,theme,backing=null){
 const ctx=canvas.getContext('2d');if(!ctx)return false;
 // One bounded display allocation per layout; clipping follows the current
// geometry. Rounded corners never depend on a stretched raster mask.
 const requested=Math.min(devicePixelRatio||1,2),bw=backing?.w||w,bh=backing?.h||h;
 const ratio=Math.min(requested,Math.sqrt(1048576/Math.max(1,bw*bh)));
 const dw=Math.max(1,Math.floor(bw*ratio)),dh=Math.max(1,Math.floor(bh*ratio));
 if(canvas.width!==dw||canvas.height!==dh){canvas.width=dw;canvas.height=dh;}
 canvas.style.width=bw+'px';canvas.style.height=bh+'px';
 ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,bw,bh);
 ctx.save();round(ctx,w,h,radius);ctx.clip();
 const image=texture(theme);if(image)ctx.drawImage(image,0,0,w,h);
 const depth=Math.min(12,radius*.55,w/4,h/4),dark=theme==='dark';
 const edge=(x0,y0,x1,y1,bright)=>{
  const g=ctx.createLinearGradient(x0,y0,x1,y1);
  g.addColorStop(0,bright?(dark?'rgba(176,207,231,.40)':'rgba(245,255,255,.84)'):(dark?'rgba(5,11,23,.42)':'rgba(23,64,139,.38)'));
  g.addColorStop(.28,bright?(dark?'rgba(114,157,194,.12)':'rgba(194,235,249,.20)'):(dark?'rgba(5,11,23,.15)':'rgba(32,76,160,.13)'));
  g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
 };
 edge(0,0,0,depth,true);edge(0,0,depth,0,true);
 edge(0,h,0,h-depth,false);edge(w,0,w-depth,0,false);
 ctx.restore();return true;
}
function create({owner,surface,vertex,fragment,names,onChange}){
 let gl=null,uniforms={},state='idle',attempted=false,epoch=0;
 const status=(next,phase,detail='')=>{state=next;owner.dataset.renderer=next==='ready'?'glass':'fallback';report(owner,phase,detail);};
 function ready(){
  if(state==='ready')return true;
  if(state==='lost'||attempted)return false;
  attempted=true;
  const allocated={};
  try{
   gl=surface.getContext('webgl',{alpha:true,premultipliedAlpha:false,antialias:false,preserveDrawingBuffer:true});
   if(!gl){status('fallback','context-unavailable');return false;}
   if(gl.isContextLost?.()){status('lost','context-already-lost');return false;}
   // High precision is optional on WebGL 1. Retain the shader's highp path
   // whenever supported, otherwise compile the same material at mediump.
   let source=fragment;
   if(typeof gl.getShaderPrecisionFormat==='function'){
    const precision=gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER,gl.HIGH_FLOAT);
    if(precision&&precision.precision===0)source=source.replace('precision highp float;','precision mediump float;');
   }
   const compile=(type,code)=>{
    const shader=gl.createShader(type);if(!shader)throw Error('Shader allocation failed');
    gl.shaderSource(shader,code);gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){
     const message=gl.getShaderInfoLog(shader)||'Shader compilation failed';gl.deleteShader(shader);throw Error(message);
    }
    return shader;
   };
   const shaders=[];let program=null;
   try{
    shaders.push(compile(gl.VERTEX_SHADER,vertex));shaders.push(compile(gl.FRAGMENT_SHADER,source));
    program=gl.createProgram();if(!program)throw Error('Program allocation failed');allocated.program=program;
    shaders.forEach(s=>gl.attachShader(program,s));gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program)||'Program linking failed');
   }catch(error){throw error;}
   finally{shaders.forEach(s=>gl.deleteShader(s));}
   gl.useProgram(program);
   const buffer=gl.createBuffer();if(!buffer)throw Error('Buffer allocation failed');allocated.buffer=buffer;gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
   gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
   const position=gl.getAttribLocation(program,'a_position');gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
   uniforms=Object.fromEntries(names.map(n=>[n,gl.getUniformLocation(program,n)]));
   if(names.includes('u_scene')){
    const tex=gl.createTexture();if(!tex)throw Error('Texture allocation failed');allocated.texture=tex;gl.bindTexture(gl.TEXTURE_2D,tex);
    for(const [name,value]of [[gl.TEXTURE_MIN_FILTER,gl.LINEAR],[gl.TEXTURE_MAG_FILTER,gl.LINEAR],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]])gl.texParameteri(gl.TEXTURE_2D,name,value);
    gl.uniform1i(uniforms.u_scene,0);
   }
   epoch++;status('ready','ready');return true;
  }catch(error){
   if(allocated.texture)gl.deleteTexture(allocated.texture);
   if(allocated.buffer)gl.deleteBuffer(allocated.buffer);
   if(allocated.program)gl.deleteProgram(allocated.program);
   status('fallback','initialization-failed',error.message);return false;
  }
 }
 surface.addEventListener('webglcontextlost',event=>{
  event.preventDefault();attempted=true;status('lost','context-lost',event.statusMessage||'');epoch++;onChange();
 });
 surface.addEventListener('webglcontextrestored',()=>{
  attempted=false;state='idle';epoch++;report(owner,'context-restored');onChange();
 });
 const api=Object.freeze({ready,get gl(){return gl;},get uniforms(){return uniforms;},get epoch(){return epoch;},get state(){return state;},
  retry(){if(state==='lost'||state==='ready')return;attempted=false;state='idle';onChange();}
 });
 sessions.add(api);return api;
}
app.packetMaterial=Object.freeze({create,drawFallback,pigment,
 diagnostics:()=>history.map(item=>({...item})),stats:()=>({textures:textures.size,sessions:sessions.size}),
 retry:()=>sessions.forEach(s=>s.retry())
});
})();
}
