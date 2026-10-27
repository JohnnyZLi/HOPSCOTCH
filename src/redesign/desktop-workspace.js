// Reparent the existing runtime owners; there is still one source and clock.
export function mountDesktopWorkspace(root,scope){
 const main=root.querySelector('.rv-main'),composition=root.querySelector('.rv-composition');
 const inspector=document.createElement('aside');inspector.className='ws-journey-inspector';
 inspector.setAttribute('aria-label','Current event and request details');inspector.hidden=true;
 composition.after(inspector);
 const owners=['.rv-caption','.rv-retained-dock','.rv-console-tools','.rv-scene-details'].map(selector=>{
  const node=root.querySelector(selector),anchor=document.createComment('workspace owner');node.before(anchor);return {node,anchor};
 });
 let split=false,budget='',disposed=false,job=0;
 const update=()=>{
  job=0;if(disposed)return;
  // Two readable panes plus their shared gutter; compact/mobile stays intact.
  const next=main.clientWidth>=960&&window.innerHeight>=600;
  if(next!==split){
   split=next;root.dataset.desktopWorkspace=String(split);inspector.hidden=!split;
   for(const {node,anchor}of owners)if(split)inspector.append(node);else anchor.after(node);
  }
  const top=composition.getBoundingClientRect().top+window.scrollY;
  const foot=root.querySelector('.rv-foot'),bottom=parseFloat(getComputedStyle(main).paddingBottom)||0;
  const height=Math.max(0,Math.floor(window.innerHeight-top-foot.getBoundingClientRect().height-bottom));
  const key=split+'|'+main.clientWidth+'|'+height;
  if(key!==budget){budget=key;root.style.setProperty('--ws-workspace-height',height+'px');root.causalStudy.reflow();}
 };
 const queue=()=>{if(!job)job=scope.requestAnimationFrame(update);};
 const request=root.querySelector('.journey-configuration'),trigger=request.querySelector(':scope > summary');
 const requestOpen=()=>split&&root.disclosures.wanted(request);
 const dismissRequest=()=>root.disclosures.set(request,false);
 // The request is a popover only in the split workspace. Keep the existing
 // disclosure animation and draft form; nested menus consume Escape first.
 scope.listen(document,'pointerdown',event=>{
  if(requestOpen()&&!event.composedPath().includes(request))dismissRequest();
 },{capture:true});
 scope.listen(document,'keydown',event=>{
  if(event.key!=='Escape'||event.defaultPrevented||!requestOpen())return;
  event.preventDefault();dismissRequest();trigger.focus({preventScroll:true});
 });
 scope.listen(request,'focusout',event=>{
  if(requestOpen()&&event.relatedTarget&&!request.contains(event.relatedTarget))dismissRequest();
 });
 const observer=new scope.ResizeObserver(queue);
 for(const node of [main,root.querySelector('.ws-intro'),root.querySelector('.rv-header'),root.querySelector('.rv-console'),root.querySelector('.rv-foot')])observer.observe(node);
 scope.listen(window,'resize',queue);scope.listen(root,'review-disclosure-layout',queue);
 update();
 return ()=>{disposed=true;if(job)scope.cancelAnimationFrame(job);observer.disconnect();};
}
