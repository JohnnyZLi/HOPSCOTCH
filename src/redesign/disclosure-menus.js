// Shared anchored disclosures. Native buttons and links keep keyboard semantics.
export function mountDisclosureMenus({root,scope,onLayout=()=>{},fallbackFocus=null}){
 const controllers=[];
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
 let disposed=false,layoutFrame=0;
 function schedulePosition(){
  if(disposed||layoutFrame)return;
  layoutFrame=scope.requestAnimationFrame(()=>{layoutFrame=0;for(const menu of controllers)menu.position();});
 }
 for(const details of root.querySelectorAll('[data-disclosure-menu]')){
  const trigger=details.querySelector(':scope > summary');
  const panel=details.querySelector('[data-disclosure-panel]');
  if(!trigger||!panel)continue;
  let wanted=details.open,animation=null,generation=0,focusedWithin=false;
  const items=()=>[...panel.querySelectorAll('a[href],button:not([disabled])')].filter(node=>node.getClientRects().length);
  const selectedItem=()=>items().find(node=>node.getAttribute('aria-pressed')==='true'||node.getAttribute('aria-checked')==='true')||items()[0];
  const focusSelection=details.hasAttribute('data-disclosure-selection');
  trigger.setAttribute('aria-expanded',String(wanted));
  trigger.setAttribute('aria-controls',panel.id);
  panel.inert=!wanted;
  function cancelHiddenTransitions(){
   // Cancel while the subtree is still rendered. Chromium can leave finished
   // promises unresolved when a CSS transition's details ancestor is hidden.
   for(const effect of panel.getAnimations?.({subtree:true})||[])effect.cancel();
  }
  function settle(){
   animation?.cancel();animation=null;
   if(!wanted)cancelHiddenTransitions();
   details.open=wanted;panel.inert=!wanted;
   trigger.setAttribute('aria-expanded',String(wanted));
   onLayout();
  }
  function position(){
   if(!details.open||disposed)return;
   const anchor=trigger.getBoundingClientRect();
   if(anchor.width<=0||anchor.height<=0){
    const hadFocus=details.contains(document.activeElement)||(focusedWithin&&(!document.activeElement||document.activeElement===document.body||document.activeElement===document.documentElement));
    focusedWithin=false;
    setOpen(false,{immediate:true});
    if(hadFocus)fallbackFocus?.focus({preventScroll:true});
    return;
   }
   const bounds=root.getBoundingClientRect();
   const parent=panel.offsetParent||root,parentBounds=parent.getBoundingClientRect();
   const css=getComputedStyle(parent),gutter=parseFloat(css.getPropertyValue('--lh-header-inset'))||16;
   const popup=panel.getBoundingClientRect();
   const desiredX=css.direction==='rtl'?anchor.left:anchor.right-popup.width;
   const x=Math.max(bounds.left+gutter,Math.min(desiredX,bounds.right-gutter-popup.width));
   const y=Math.max(bounds.top+gutter,Math.min(anchor.bottom+8,bounds.bottom-gutter-popup.height));
   const left=(x-parentBounds.left)+'px',top=(y-parentBounds.top)+'px';
   if(panel.style.left!==left||panel.style.top!==top){
    panel.style.insetInlineEnd='auto';panel.style.left=left;panel.style.top=top;onLayout();
   }
  }
  function setOpen(open,{immediate=false,restoreFocus=false}={}){
   if(disposed)return;
   const wasOpen=details.open;
   const opacity=wasOpen?getComputedStyle(panel).opacity:'0';
   const ticket=++generation;
   animation?.cancel();animation=null;wanted=Boolean(open);
   if(!wanted&&(restoreFocus||panel.contains(document.activeElement)))trigger.focus({preventScroll:true});
   trigger.setAttribute('aria-expanded',String(wanted));panel.inert=!wanted;
   if(wanted){
    for(const other of controllers)if(other.details!==details)other.close({immediate:true});
    details.open=true;position();
    if(focusSelection&&!wasOpen)selectedItem()?.focus({preventScroll:true});
   }
   onLayout();
   if(immediate||reduced.matches||!panel.animate||(!wanted&&!wasOpen)){settle();return;}
   // Opacity leaves the measured refractive geometry stable throughout opening
   // and dismissal. Rapid reversal resumes from the current painted opacity.
   animation=panel.animate([{opacity},{opacity:wanted?'1':'0'}],{
    duration:wanted?140:100,easing:'cubic-bezier(.2,0,0,1)',fill:'both'
   });
   animation.finished.then(()=>{if(!disposed&&ticket===generation)settle();},()=>{});
  }
  const api={details,trigger,panel,position,
   close:options=>setOpen(false,options),
   finish:()=>{generation++;settle();},
   destroy:()=>{generation++;animation?.cancel();animation=null;cancelHiddenTransitions();details.open=false;panel.inert=true;trigger.setAttribute('aria-expanded','false');}
  };
  controllers.push(api);
  scope.listen(trigger,'click',event=>{event.preventDefault();setOpen(!wanted);});
  scope.listen(trigger,'keydown',event=>{
   if(event.key!=='ArrowDown'&&event.key!=='ArrowUp')return;
   event.preventDefault();setOpen(true);
   const links=items();(focusSelection?selectedItem():event.key==='ArrowDown'?links[0]:links.at(-1))?.focus({preventScroll:true});
  });
  scope.listen(panel,'keydown',event=>{
   if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;
   const links=items(),index=links.indexOf(document.activeElement);if(!links.length)return;
   event.preventDefault();
   const next=event.key==='Home'?0:event.key==='End'?links.length-1:event.key==='ArrowDown'?(index+1)%links.length:(index-1+links.length)%links.length;
   links[next].focus({preventScroll:true});
  });
  scope.listen(details,'focusin',()=>{focusedWithin=true;});
  scope.listen(document,'focusin',event=>{if(!details.contains(event.target)&&event.target!==document.body&&event.target!==document.documentElement)focusedWithin=false;});
  scope.listen(details,'focusout',event=>{
   if(details.contains(event.relatedTarget))return;
   // A responsive display change blurs the hidden link before ResizeObserver
   // runs. Preserve that cause instead of treating it as an ordinary Tab exit.
   const hidden=trigger.getBoundingClientRect().width<=0;
   if(event.relatedTarget&&event.relatedTarget!==document.body&&event.relatedTarget!==document.documentElement)focusedWithin=false;
   setOpen(false,{immediate:hidden});
   if(hidden&&!event.relatedTarget)fallbackFocus?.focus({preventScroll:true});
  });
  scope.listen(panel,'click',event=>{if(event.target.closest('a[href],button:not([disabled])'))setOpen(false,{restoreFocus:true});});
  const observer=new scope.ResizeObserver(schedulePosition);observer.observe(trigger);observer.observe(panel);
 }
 scope.listen(document,'pointerdown',event=>{
  const path=event.composedPath?.()||[];
  for(const menu of controllers)if(menu.details.open&&!path.includes(menu.details)&&!menu.details.contains(event.target))menu.close();
 },{capture:true});
 scope.listen(document,'keydown',event=>{
  if(event.key!=='Escape'||event.defaultPrevented)return;
  for(const menu of controllers)if(menu.details.open){event.preventDefault();menu.close({restoreFocus:true});}
 });
 scope.listen(window,'resize',schedulePosition);
 scope.listen(reduced,'change',()=>{if(reduced.matches)for(const menu of controllers)menu.finish();});
 const resize=new scope.ResizeObserver(schedulePosition);resize.observe(root);
 return Object.freeze({dispose(){if(disposed)return;for(const menu of controllers)menu.destroy();disposed=true;scope.cancelAnimationFrame(layoutFrame);layoutFrame=0;}});
}
