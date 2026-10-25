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
 // The scene retains its canonical objects and clock. Workspace composition
 // groups presentation controls without creating a second simulation surface.
 if(destination==='journey'){
  const configuration=main.querySelector('.journey-configuration');
  const settings=main.querySelector('.rv-playback-settings');
  const tools=settings?.querySelector('.rv-disclosure-inner')||settings;
  const requestTools=document.createElement('div');requestTools.className='ws-request-tools';
  if(configuration){
   const summary=configuration.querySelector('summary'),hostname=configuration.querySelector('input');
   for(const text of summary.childNodes)if(text.nodeType===3)text.textContent=hostname.value;
   summary.setAttribute('aria-label','Edit request to '+hostname.value);
   requestTools.append(configuration);
   scope.listen(element,'review-disclosure-layout',event=>{
    if(event.detail.element===configuration&&element.disclosures.wanted(configuration))element.causalStudy.pause();
   });
  }
  if(sceneLabel&&tools)tools.prepend(sceneLabel);
  intro.append(requestTools);
  // Endpoint names and retained facts form one quiet context band. The packet
  // keeps the optical material; labels no longer each receive a glass box.
  for(const endpoint of main.querySelectorAll('.rv-endpoint'))endpoint.removeAttribute('data-ui-surface');
  const actions=main.querySelector('.journey-context-actions');
  if(actions&&tools)tools.append(actions);
 }
 if(destination==='builder'){
  const workspace=document.createElement('section');workspace.className='ws-builder-workspace';
  workspace.setAttribute('aria-label','Network authoring workspace');
  intro.after(workspace);
  for(const child of [...main.children])if(child!==intro&&child!==workspace)workspace.append(child);
  for(const region of workspace.querySelectorAll('.wb-workbench,.wb-result'))region.removeAttribute('data-ui-surface');
  const overview=workspace.querySelector('.wb-overview');
  if(overview){
   const mapMeta=document.createElement('div');mapMeta.className='ws-map-meta';
   mapMeta.append(workspace.querySelector('.wb-context'),overview);
   workspace.querySelector('.wb-map-wrap').after(mapMeta);
  }
  const networkTools=workspace.querySelector('.wb-secondary-tools');
  if(networkTools)workspace.querySelector('.wb-graph-toolbar').append(networkTools);
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
