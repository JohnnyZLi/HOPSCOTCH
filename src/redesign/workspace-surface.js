import {createRuntimeScope} from '../../design-review/source/complete-review/integration-scope.js';
import {mountSurface} from './surface.js';
import {mountSelectMenus} from './select-menus.js';
import markup from './surface.html?raw';
import './workspace-surface.css';

export function mountWorkspaceSurface(element,navigate,destination){
 const scope=createRuntimeScope(element),oldHeader=element.querySelector('.rv-header');
 const template=document.createElement('template');template.innerHTML=markup.replaceAll('hopscotch-home-','hopscotch-workspace-');
 const environment=template.content.querySelector('.lh-environment'),header=template.content.querySelector('.lh-header');
 header.classList.add('rv-header');
 const bridge=document.createElement('div');bridge.className='ws-runtime-controls';bridge.hidden=true;
 const scene=oldHeader.querySelector('.rv-scene-picker,.ev-workspace');
 const sceneLabel=scene?.closest('label');
 if(sceneLabel)sceneLabel.remove();
 bridge.append(...oldHeader.childNodes);header.append(bridge);oldHeader.replaceWith(header);element.prepend(environment);
 element.classList.add('workspace-surface');element.dataset.workspace=destination;
 const main=element.querySelector('.rv-main'),intro=document.createElement('div'),heading=document.createElement('div');
 intro.className='ws-intro';heading.className='ws-heading';
 for(const node of main.querySelectorAll(':scope > .rv-eyebrow,:scope > .rv-title,:scope > .rv-subtitle'))heading.append(node);
 if(sceneLabel){sceneLabel.classList.add('ws-scene-picker');heading.prepend(sceneLabel);heading.querySelector('.rv-eyebrow')?.remove();}
 intro.append(heading);main.prepend(intro);
 if(destination==='journey'){
  const configuration=main.querySelector('.journey-configuration');if(configuration)intro.append(configuration);
  const console=main.querySelector('.rv-console');console.dataset.uiSurface='record';console.dataset.glassRole='launcher';
  const source=console.querySelector('.rv-source'),explanation=console.querySelector('.rv-explanation');
  (explanation.querySelector('.rv-disclosure-inner')||explanation).append(source);
  const extras=document.createElement('div');extras.className='ws-playback-extras';
  for(const node of console.querySelectorAll('.rv-playback-settings,.rv-explanation,.journey-context-actions'))extras.append(node);
  console.append(extras);
 }
 const surface=mountSurface(element,scope,navigate,{workspace:destination,registerMaterial:false});
 const selects=mountSelectMenus(element,scope,surface.menus);
 element.workspaceSurface=Object.freeze({appearance:surface.appearance,stats:surface.material.stats});
 let disposed=false;
 return {appearance:surface.appearance,dispose(){
  if(disposed)return;disposed=true;
  selects.dispose();surface.dispose();scope.dispose();environment.remove();delete element.workspaceSurface;
  element.classList.remove('workspace-surface');delete element.dataset.workspace;
 }};
}
