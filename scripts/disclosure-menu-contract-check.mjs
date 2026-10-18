import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const controller=fs.readFileSync(new URL('../src/redesign/disclosure-menus.js',import.meta.url),'utf8').replace('export function','function');

// Controller behavior with explicit DOM/event/animation fixtures. These checks
// do not represent browser rendering, native picker behavior, or visual QA.
function fixture(width=390,rtl=false,selection=false,secondMenu=false){
 let rootWidth=width,hidden=false,nextFrame=1;
 const frames=new Map(),observers=[],animations=[],listeners=[],menuOwners=[];
 const doc={activeElement:null,events:{}};
 const win={events:{}};const preference={matches:false,events:{}};
 class Node{
  constructor(kind,parent=null){this.kind=kind;this.parentElement=parent;this.children=[];parent?.children.push(this);this.events={};this.attrs={};this.style={};this.open=false;this.inert=false;this.opacity='1';}
  contains(node){while(node){if(node===this)return true;node=node.parentElement;}return false;}
  setAttribute(key,value){this.attrs[key]=String(value);}
  getAttribute(key){return this.attrs[key]??null;}
  hasAttribute(key){return Object.hasOwn(this.attrs,key);}
  getClientRects(){return this.visible?[this.getBoundingClientRect()]:[];}
  get visible(){if(hidden&&(this.kind==='summary'||this.kind==='panel'||this.kind==='link'))return false;if(this.kind==='link'||this.kind==='panel')return this.parentElement.kind==='details'?this.parentElement.open:this.parentElement.parentElement.open;return true;}
  getBoundingClientRect(){
   if(this.kind==='root')return {left:100,top:80,right:100+rootWidth,bottom:790,width:rootWidth,height:710};
   if(this.kind==='header')return {left:100,top:80,right:100+rootWidth,bottom:152,width:rootWidth,height:72};
   if(this.kind==='summary'){
    if(hidden)return {left:0,top:0,right:0,bottom:0,width:0,height:0};
    const left=100+rootWidth-(rootWidth<=560?18+97+8:28+102+14)-44;
    return {left,top:94,right:left+44,bottom:138,width:44,height:44};
   }
   if(this.kind==='panel')return {left:0,top:0,right:230,bottom:216,width:230,height:216};
   return {left:0,top:0,right:120,bottom:44,width:120,height:44};
  }
  querySelector(selector){if(selector===':scope > summary')return this.children.find(n=>n.kind==='summary');if(selector==='[data-disclosure-panel]')return this.children.find(n=>n.kind==='panel');return null;}
  querySelectorAll(selector){if(selector==='[data-disclosure-menu]')return menuOwners;if(selector==='a[href],button:not([disabled])')return this.children.filter(n=>n.kind==='link');return [];}
  closest(){return this.kind==='link'?this:this.parentElement?.closest();}
  focus(){const old=doc.activeElement;if(old===this)return;doc.activeElement=this;if(old)fire(old,'focusout',{relatedTarget:this});}
  animate(keys,options){
   let resolve,reject;const animation={keys,options,done:false,finished:new Promise((yes,no)=>{resolve=yes;reject=no;}),
    cancel:()=>{if(!animation.done){animation.done=true;reject(Error('canceled'));}this.opacity='1';},
    finish:()=>{if(!animation.done){animation.done=true;this.opacity=String(keys.at(-1).opacity);resolve();}}
   };this.opacity=String(keys[0].opacity);animations.push(animation);return animation;
  }
 }
 const root=new Node('root'),header=new Node('header',root),details=new Node('details',header),trigger=new Node('summary',details),panel=new Node('panel',details);
 const links=Array.from({length:4},()=>new Node('link',panel));const picker=new Node('picker',header),outside=new Node('outside');
 panel.id='test-panel';panel.offsetParent=header;
 menuOwners.push(details);
 if(selection){details.attrs['data-disclosure-selection']='';links[1].attrs['aria-pressed']='true';}
 let second=null;
 if(secondMenu){
  const details2=new Node('details',header),trigger2=new Node('summary',details2),panel2=new Node('panel',details2);
  const options=Array.from({length:3},()=>new Node('link',panel2));
  details2.attrs['data-disclosure-selection']='';options[1].attrs['aria-pressed']='true';panel2.id='appearance-panel';panel2.offsetParent=header;
  menuOwners.push(details2);second={details:details2,trigger:trigger2,panel:panel2,options};
 }
 const scope={
  listen(target,type,handler){(target.events[type]??=[]).push(handler);listeners.push([target,type,handler]);},
  requestAnimationFrame(callback){const id=nextFrame++;frames.set(id,callback);return id;},
  cancelAnimationFrame(id){frames.delete(id);},
  ResizeObserver:class{constructor(callback){this.callback=callback;observers.push(this);}observe(){}disconnect(){}},
  dispose(){for(const [target,type,handler]of listeners)target.events[type]=target.events[type].filter(fn=>fn!==handler);frames.clear();}
 };
 win.matchMedia=()=>preference;
 const context={window:win,document:doc,getComputedStyle:node=>node.kind==='panel'?{opacity:node.opacity}:{direction:rtl?'rtl':'ltr',getPropertyValue:()=>String(rootWidth<=560?18:28)}};
 const mount=vm.runInNewContext('('+controller.trim()+')',context);
 let invalidations=0;const menus=mount({root,scope,onLayout:()=>invalidations++,fallbackFocus:picker});
 function fire(target,type,data={}){
  const event={key:'',target,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},composedPath(){const path=[];let p=this.target;while(p){path.push(p);p=p.parentElement;}return path;},...data};
  let current=target;while(current){for(const handler of [...(current.events?.[type]||[])])handler(event);current=current.parentElement;}return event;
 }
 async function finish(){for(const animation of animations)animation.finish();await Promise.resolve();await Promise.resolve();}
 function flush(){const work=[...frames.values()];frames.clear();for(const callback of work)callback();}
 return {root,details,trigger,panel,links,picker,outside,doc,win,preference,animations,menus,scope,fire,finish,flush,second,
  resize(w,unavailable=false,blurFirst=false){rootWidth=w;hidden=unavailable;if(blurFirst&&doc.activeElement){const previous=doc.activeElement;doc.activeElement=null;fire(previous,'focusout',{relatedTarget:null});}for(const observer of observers)observer.callback();flush();},
  pending:()=>frames.size,invalidations:()=>invalidations};
}

(async()=>{
 for(const width of [320,390,736,880])for(const rtl of [false,true]){
  const f=fixture(width,rtl),{trigger,panel,details,doc,links,fire}=f;
  trigger.focus();assert.equal(fire(trigger,'click').defaultPrevented,true);assert.equal(details.open,true);assert.equal(panel.inert,false);assert.equal(trigger.attrs['aria-expanded'],'true');
  const gutter=width<=560?18:28,left=parseFloat(panel.style.left);assert(left>=gutter);assert(left+230<=width-gutter);
  await f.finish();assert.equal(details.open,true);
  fire(doc,'pointerdown',{target:links[0]});await f.finish();assert.equal(details.open,true,'Inside presses keep disclosure open');
  fire(doc,'pointerdown',{target:f.picker});assert.equal(trigger.attrs['aria-expanded'],'false');assert.equal(panel.inert,true);f.picker.focus();await f.finish();assert.equal(details.open,false);assert.equal(doc.activeElement,f.picker,'Outside press preserves next control focus');
  trigger.focus();fire(trigger,'keydown',{key:'ArrowDown'});assert.equal(doc.activeElement,links[0]);await f.finish();
  fire(panel,'keydown',{key:'End'});assert.equal(doc.activeElement,links[3]);fire(panel,'keydown',{key:'ArrowDown'});assert.equal(doc.activeElement,links[0]);fire(panel,'keydown',{key:'ArrowUp'});assert.equal(doc.activeElement,links[3]);fire(panel,'keydown',{key:'Home'});assert.equal(doc.activeElement,links[0]);
  fire(doc,'keydown',{key:'Escape'});assert.equal(doc.activeElement,trigger);await f.finish();assert.equal(details.open,false);
  fire(trigger,'click');await f.finish();links[1].focus();f.picker.focus();await f.finish();assert.equal(details.open,false,'Tab/focus leaving closes disclosure');assert.equal(doc.activeElement,f.picker);
  trigger.focus();fire(trigger,'click');await f.finish();links[2].focus();fire(panel,'click',{target:links[2]});await f.finish();assert.equal(details.open,false,'Selected destination dismisses navigation');assert.equal(doc.activeElement,trigger);
  fire(trigger,'click');panel.opacity='.42';fire(trigger,'click');assert.equal(f.animations.at(-1).keys[0].opacity,'.42');panel.opacity='.21';fire(trigger,'click');await f.finish();assert.equal(details.open,true,'Rapid reversal settles at latest intent');assert.equal(trigger.attrs['aria-expanded'],'true');
  f.preference.matches=true;fire(f.preference,'change');fire(trigger,'click');assert.equal(details.open,false,'Reduced motion closes immediately');fire(trigger,'click');assert.equal(details.open,true,'Reduced motion opens immediately');
  links[0].focus();f.resize(1024,true);assert.equal(details.open,false,'Hidden responsive trigger closes disclosure');assert.equal(doc.activeElement,f.picker);assert.equal(trigger.attrs['aria-expanded'],'false');assert.equal(f.pending(),0);
  f.menus.dispose();f.scope.dispose();assert.equal(f.pending(),0);
 }
 const responsiveBlur=fixture();
 responsiveBlur.trigger.focus();responsiveBlur.fire(responsiveBlur.trigger,'keydown',{key:'ArrowDown'});await responsiveBlur.finish();
 responsiveBlur.resize(1024,true,true);
 assert.equal(responsiveBlur.details.open,false);assert.equal(responsiveBlur.doc.activeElement,responsiveBlur.picker,'Responsive blur before ResizeObserver must retain header focus');
 responsiveBlur.menus.dispose();responsiveBlur.scope.dispose();
 const choice=fixture(390,false,true);
 choice.trigger.focus();choice.fire(choice.trigger,'click');assert.equal(choice.doc.activeElement,choice.links[1],'Opening selection popup focuses the current preference');
 await choice.finish();choice.fire(choice.panel,'keydown',{key:'ArrowDown'});assert.equal(choice.doc.activeElement,choice.links[2]);
 choice.fire(choice.doc,'keydown',{key:'Escape'});await choice.finish();assert.equal(choice.doc.activeElement,choice.trigger);choice.menus.dispose();choice.scope.dispose();
 const pair=fixture(390,false,false,true);
 pair.trigger.focus();pair.fire(pair.trigger,'click');await pair.finish();assert.equal(pair.details.open,true);
 pair.second.trigger.focus();pair.fire(pair.second.trigger,'click');await pair.finish();
 assert.equal(pair.details.open,false,'Opening appearance dismisses navigation');assert.equal(pair.second.details.open,true);assert.equal(pair.doc.activeElement,pair.second.options[1]);
 pair.trigger.focus();pair.fire(pair.trigger,'click');await pair.finish();assert.equal(pair.details.open,true);assert.equal(pair.second.details.open,false,'Opening navigation dismisses appearance');
 pair.menus.dispose();pair.scope.dispose();
 console.log('PASS controller behavior: anchored/clamped placement in LTR/RTL, inside/outside presses, keyboard navigation, Escape, focus exit, selection, interrupted transitions, reduced motion, responsive closure and disposal.');
 console.log('Scope: synthetic DOM/event fixtures; no browser appearance or native-select audit claimed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
