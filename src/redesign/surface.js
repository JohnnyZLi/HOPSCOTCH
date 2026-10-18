import {mountWallpaperGlass} from './wallpaper-glass.js';
import {mountDisclosureMenus} from './disclosure-menus.js';
import {appearancePreference,applyAppearance} from './appearance';
import {WORKSPACE_CATALOG} from '../workspace-catalog';
import lightWallpaper from './assets/home-light.webp';
import darkWallpaper from './assets/home-dark.webp';
import './surface.css';

// The entry and every workspace use the same environment, header and menus.
// The caller owns the material foundation and the lifetime of the DOM.
export function mountSurface(element,scope,navigate,{workspace=null,registerMaterial=true}={}){
 element.classList.add('hopscotch-surface');
 element.querySelector('.lh-wallpaper-light').src=lightWallpaper;
 element.querySelector('.lh-wallpaper-dark').src=darkWallpaper;
 const trigger=element.querySelector('.lh-theme');
 const options=[...element.querySelectorAll('[data-appearance-value]')];
 const destinations=new Map(Object.values(WORKSPACE_CATALOG).map(item=>[item.path,item.id]));
 const group=workspace&&(['tcp','dns','tls','http','packet','failure'].includes(workspace)?'tcp':['measured','capture','observed','physical','internet'].includes(workspace)?'measured':workspace);
 for(const link of element.querySelectorAll('.lh-header a[href]')){
  if(destinations.get(link.getAttribute('href'))===group)link.setAttribute('aria-current','page');
 }
 const material=mountWallpaperGlass(element,scope,{register:registerMaterial});
 function appearance(){
  const preference=appearancePreference(),selected=options.find(option=>option.dataset.appearanceValue===preference);
  const label=selected.querySelector('span').textContent;
  element.dataset.theme=document.documentElement.dataset.theme;
  element.dataset.appearance=preference;
  trigger.querySelector('[data-appearance-label]').textContent=label;
  trigger.setAttribute('aria-label','Appearance: '+label);
  for(const option of options)option.setAttribute('aria-pressed',String(option===selected));
  material.invalidate();
 }
 appearance();
 scope.listen(element.querySelector('.lh-appearance-panel'),'click',event=>{
  const choice=event.target.closest('[data-appearance-value]');
  if(choice){applyAppearance(choice.dataset.appearanceValue);appearance();}
 });
 const menus=mountDisclosureMenus({root:element,scope,onLayout:material.invalidate,fallbackFocus:trigger});
 // Real hrefs preserve copying, modifier-clicks and opening another tab.
 scope.listen(element,'click',event=>{
  const link=event.target.closest('a[href]');
  if(!link||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  const path=link.getAttribute('href');
  if(path==='/'||destinations.has(path)){event.preventDefault();navigate(destinations.get(path)??null);}
 });
 let disposed=false;
 return {appearance,material,menus,dispose(){
  if(disposed)return;disposed=true;
  menus.dispose();material.dispose();element.classList.remove('hopscotch-surface');delete element.dataset.appearance;
 }};
}
