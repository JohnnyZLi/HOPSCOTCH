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
 for(const node of main.querySelectorAll(':scope > .rv-eyebrow,:scope > h2,:scope > .rv-subtitle')){
  if(node.tagName==='H2')node.classList.add('rv-title');
  heading.append(node);
 }
 if(sceneLabel){sceneLabel.classList.add('ws-scene-picker');if(destination!=='journey')heading.prepend(sceneLabel);heading.querySelector('.rv-eyebrow')?.remove();}
 intro.append(heading);main.prepend(intro);
 element.querySelector('.rv-foot')?.removeAttribute('data-ui-surface');
 // Keep the reviewed scene, retained values, inspector and console in their
 // authored owners. Production adds request editing within the existing tools.
 if(destination==='journey'){
  if(sceneLabel)intro.append(sceneLabel);
  const configuration=main.querySelector('.journey-configuration');
  const settings=main.querySelector('.rv-playback-settings');
  const tools=settings?.querySelector('.rv-disclosure-inner')||settings;
  if(configuration&&tools)tools.append(configuration);
  const actions=main.querySelector('.journey-context-actions');
  if(actions&&tools)tools.append(actions);
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
