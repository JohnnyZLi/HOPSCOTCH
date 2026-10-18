import {createRuntimeScope} from '../../design-review/source/complete-review/integration-scope.js';
import {mountMaterialFoundation} from './material-runtime.js';
import {mountSurface} from './surface.js';
import {appearancePreference} from './appearance';
import surfaceMarkup from './surface.html?raw';
import markup from './home.html?raw';

export function mountHome(element,navigate){
 const originalKeys=new Set(Reflect.ownKeys(element)),originalId=element.id;
 const scope=createRuntimeScope(element);
 element.id='hopscotch-home';
 element.dataset.theme=document.documentElement.dataset.theme;
 element.innerHTML=surfaceMarkup+markup;
 element.classList.add('hopscotch-surface');
 mountMaterialFoundation(element,scope);
 const surface=mountSurface(element,scope,navigate);
 const api=Object.freeze({appearance:surface.appearance,snapshot:()=>({appearance:appearancePreference(),material:surface.material.stats()})});
 element.homeStudy=api;
 const ownedKeys=Reflect.ownKeys(element).filter(key=>!originalKeys.has(key));
 let disposed=false;
 return {api,dispose(){
  if(disposed)return;disposed=true;
  surface.dispose();scope.dispose();
  for(const key of ownedKeys)Reflect.deleteProperty(element,key);
  element.id=originalId;delete element.dataset.appearance;element.replaceChildren();
 }};
}
