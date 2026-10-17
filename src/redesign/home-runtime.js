import {createRuntimeScope} from '../../design-review/source/complete-review/integration-scope.js';
import {mountMaterialFoundation} from './material-runtime.js';
import {mountWallpaperGlass} from './wallpaper-glass.js';
import {mountDisclosureMenus} from './disclosure-menus.js';
import {appearancePreference,applyAppearance} from './appearance';
import {WORKSPACE_CATALOG} from '../workspace-catalog';
import markup from './home.html?raw';
import lightWallpaper from './assets/home-light.webp';
import darkWallpaper from './assets/home-dark.webp';
import './home.css';

export function mountHome(element,navigate){
 const originalKeys=new Set(Reflect.ownKeys(element)),originalId=element.id;
 const scope=createRuntimeScope(element);
 element.id='hopscotch-home';
 element.dataset.theme=document.documentElement.dataset.theme;
 element.innerHTML=markup;
 element.querySelector('.lh-wallpaper-light').src=lightWallpaper;
 element.querySelector('.lh-wallpaper-dark').src=darkWallpaper;
 const trigger=element.querySelector('.lh-theme');
 const options=[...element.querySelectorAll('[data-appearance-value]')];
 function appearance(){
  const preference=appearancePreference(),selected=options.find(option=>option.dataset.appearanceValue===preference);
  const label=selected.querySelector('span').textContent;
  element.dataset.theme=document.documentElement.dataset.theme;
  element.dataset.appearance=preference;
  trigger.querySelector('[data-appearance-label]').textContent=label;
  trigger.setAttribute('aria-label','Appearance: '+label);
  for(const option of options)option.setAttribute('aria-pressed',String(option===selected));
  element.recordMaterial?.invalidate();
 }
 appearance();
 mountMaterialFoundation(element,scope);
 const material=mountWallpaperGlass(element,scope);
 scope.listen(element.querySelector('.lh-appearance-panel'),'click',event=>{
  const choice=event.target.closest('[data-appearance-value]');
  if(choice){applyAppearance(choice.dataset.appearanceValue);appearance();}
 });
 const menus=mountDisclosureMenus({root:element,scope,onLayout:material.invalidate,fallbackFocus:trigger});
 // Keep real hrefs for modifier-clicks, copying, and opening in another tab.
 const destinations=new Map(Object.values(WORKSPACE_CATALOG).map(item=>[item.path,item.id]));
 scope.listen(element,'click',event=>{
  const link=event.target.closest('a[href]');
  if(!link||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  const path=link.getAttribute('href');
  if(path==='/'||destinations.has(path)){event.preventDefault();navigate(destinations.get(path)??null);}
 });
 const api=Object.freeze({appearance,snapshot:()=>({appearance:appearancePreference(),material:material.stats()})});
 element.homeStudy=api;
 const ownedKeys=Reflect.ownKeys(element).filter(key=>!originalKeys.has(key));
 let disposed=false;
 return {api,dispose(){
  if(disposed)return;disposed=true;
  menus.dispose();material.dispose();scope.dispose();
  for(const key of ownedKeys)Reflect.deleteProperty(element,key);
  element.id=originalId;delete element.dataset.appearance;element.replaceChildren();
 }};
}
