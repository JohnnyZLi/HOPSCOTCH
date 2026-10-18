// Custom presentation for the existing control contracts. The source select
// still owns its options, value, form behavior, validation and change events.
export function mountSelectMenus(root,scope,menus){
 const entries=new Map();let serial=0,frame=0,disposed=false,needsScan=false;
 const arrow='<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';
 function sync(entry){
  const {select,trigger,value}=entry,option=select.selectedOptions[0];
  const text=option?.textContent||'Choose';
  if(value.textContent!==text)value.textContent=text;
  trigger.setAttribute('aria-label',entry.label+': '+text);
  trigger.setAttribute('aria-disabled',String(select.disabled||!select.options.length));
  trigger.tabIndex=select.disabled?-1:0;
  for(const button of entry.panel.querySelectorAll('button[data-select-index]'))button.setAttribute('aria-pressed',String(Number(button.dataset.selectIndex)===select.selectedIndex));
 }
 function options(entry){
  sync(entry);entry.panel.replaceChildren();
  for(const [index,option]of [...entry.select.options].entries()){
   if(option.hidden)continue;
   const button=document.createElement('button');button.type='button';button.className='ws-select-option';
   button.textContent=option.textContent;button.dataset.selectIndex=String(index);button.disabled=option.disabled||option.parentElement?.disabled===true;
   button.setAttribute('aria-pressed',String(index===entry.select.selectedIndex));
   entry.panel.append(button);
  }
 }
 function scan(){
  frame=0;if(disposed)return;
  for(const [select,entry]of entries)if(!root.contains(select)){entry.details.remove();entries.delete(select);}
  for(const select of root.querySelectorAll('select:not([multiple])')){
   if(entries.has(select))continue;
   if(select.hidden||select.closest('[hidden],[aria-hidden="true"],[inert]'))continue;
   const details=document.createElement('details'),trigger=document.createElement('summary'),value=document.createElement('span'),panel=document.createElement('div');
   details.className='ws-select';details.dataset.disclosureMenu='';details.dataset.disclosureSelection='';details.dataset.disclosureAlign='start';
   trigger.className='ws-select-trigger cursor-interaction';trigger.append(value);trigger.insertAdjacentHTML('beforeend',arrow);
   panel.className='ws-select-panel';panel.dataset.disclosurePanel='';panel.setAttribute('role','group');
   const label=select.getAttribute('aria-label')||select.labels?.[0]?.textContent?.trim().split('\n')[0]||'Choose an option';
   panel.setAttribute('aria-label',label);panel.id='workspace-select-'+(++serial);trigger.id=panel.id+'-trigger';
   details.append(trigger,panel);select.after(details);select.hidden=true;select.setAttribute('aria-hidden','true');
   const entry={select,details,trigger,value,panel,label};entries.set(select,entry);sync(entry);
  }
  for(const entry of entries.values())sync(entry);
  menus.refresh();
 }
 function schedule(rescan=false){
  needsScan=needsScan||rescan;
  if(!frame&&!disposed)frame=scope.requestAnimationFrame(()=>{
   frame=0;if(disposed)return;
   if(needsScan){needsScan=false;scan();}else for(const entry of entries.values())sync(entry);
  });
 }
 scope.listen(root,'click',event=>{
  const details=event.target.closest('.ws-select');if(!details)return;
  const entry=[...entries.values()].find(item=>item.details===details);if(!entry)return;
  if(entry.trigger.contains(event.target)){
   if(entry.select.disabled||!entry.select.options.length){event.preventDefault();event.stopImmediatePropagation();return;}
   if(!details.open)options(entry);
  }
  const button=event.target.closest('[data-select-index]');
  if(button&&!button.disabled){entry.select.selectedIndex=Number(button.dataset.selectIndex);sync(entry);entry.select.dispatchEvent(new Event('change',{bubbles:true}));}
 },{capture:true});
 scope.listen(root,'keydown',event=>{
  const entry=[...entries.values()].find(item=>item.trigger===event.target);
  if(!entry)return;
  if(entry.select.disabled){event.preventDefault();event.stopImmediatePropagation();return;}
  if(['ArrowDown','ArrowUp','Enter',' '].includes(event.key)&&!entry.details.open)options(entry);
 },{capture:true});
 scope.listen(root,'toggle',event=>{const details=event.target;if(details.matches?.('.ws-select')&&!details.open)details.querySelector('[data-disclosure-panel]').replaceChildren();},{capture:true});
 scope.listen(root,'change',()=>schedule());
 scope.listen(root,'app-source-change',()=>schedule());
 const observer=new scope.MutationObserver(records=>{
  if(records.some(record=>record.target.matches?.('select,option,optgroup')||record.type==='attributes'&&record.attributeName==='hidden'||[...record.addedNodes,...record.removedNodes].some(node=>node.matches?.('select')||node.querySelector?.('select'))))schedule(true);
 });
 observer.observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','disabled','label','selected']});
 scan();
 return {refresh:()=>schedule(true),dispose(){disposed=true;scope.cancelAnimationFrame(frame);observer.disconnect();for(const entry of entries.values()){entry.details.remove();entry.select.hidden=false;entry.select.removeAttribute('aria-hidden');}entries.clear();}};
}
