import {createRuntimeScope} from '../../design-review/source/complete-review/integration-scope.js';
import {mountMaterialFoundation} from './material-runtime.js';
import {mountSurface} from './surface.js';
import {appearancePreference} from './appearance';
import surfaceMarkup from './surface.html?raw';
import markup from './home.html?raw';
import {mountHomePacket} from './home-packet.js';
import './home.css';

export function mountHome(element,navigate){
 const originalKeys=new Set(Reflect.ownKeys(element)),originalId=element.id;
 const scope=createRuntimeScope(element);
 element.id='hopscotch-home';
 element.dataset.theme=document.documentElement.dataset.theme;
 element.innerHTML=surfaceMarkup+markup;
 element.classList.add('hopscotch-surface');
 const themeTrigger=element.querySelector('.lh-theme');themeTrigger.removeAttribute('data-ui-surface');themeTrigger.removeAttribute('data-glass-role');
 mountMaterialFoundation(element,scope);
 const surface=mountSurface(element,scope,navigate);
 const packet=mountHomePacket(element,scope);
 const api=Object.freeze({appearance:surface.appearance,snapshot:()=>({appearance:appearancePreference(),material:surface.material.stats(),packet:packet.snapshot()})});
 element.homeStudy=api;
 const ownedKeys=Reflect.ownKeys(element).filter(key=>!originalKeys.has(key));
 let disposed=false;
 return {api,dispose(){
  if(disposed)return;disposed=true;
  packet.dispose();surface.dispose();scope.dispose();
  for(const key of ownedKeys)Reflect.deleteProperty(element,key);
  element.id=originalId;delete element.dataset.appearance;element.replaceChildren();
 }};
}
