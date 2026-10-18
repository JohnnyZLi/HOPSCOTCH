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
 if(destination==='journey'){
  if(sceneLabel)intro.append(sceneLabel);
  const configuration=main.querySelector('.journey-configuration');if(configuration)intro.append(configuration);
  const console=main.querySelector('.rv-console');console.dataset.uiSurface='record';console.dataset.glassRole='launcher';
  for(const [selector,label]of [['.rv-playback-settings>summary','Settings'],['.journey-share>summary','Share']]){
   const summary=console.querySelector(selector);if(summary)for(const child of summary.childNodes)if(child.nodeType===3&&child.textContent.trim())child.textContent=label;
  }
  const source=console.querySelector('.rv-source'),explanation=console.querySelector('.rv-explanation');
  (explanation.querySelector('.rv-disclosure-inner')||explanation).append(source);
  const extras=document.createElement('div');extras.className='ws-playback-extras';
  for(const node of console.querySelectorAll('.rv-playback-settings,.rv-explanation,.journey-context-actions'))extras.append(node);
  console.append(extras);
  // Only actual layout changes invalidate scene framing. Animated disclosures
  // are measured once they settle, not throughout their height animation.
  const changed=()=>element.dispatchEvent(new CustomEvent('review-layout-metrics'));
  const resize=new scope.ResizeObserver(()=>{if(!element.querySelector('.ws-intro [data-moving=true],.rv-console [data-moving=true]'))changed();});
  for(const owner of [console,main.querySelector('.rv-retained-dock')])if(owner)resize.observe(owner);
  scope.listen(element,'review-disclosure-layout',event=>{if(event.detail.phase==='settled')changed();});
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
