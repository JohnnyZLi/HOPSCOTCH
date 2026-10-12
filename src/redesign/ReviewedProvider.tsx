import {useEffect, useRef} from 'react';
import type {BuilderMplsLspState, BuilderTunnelPacketProjection, BuilderTunnelState} from '../builder/provider';
import './lifecycle-runtime.css';
import './reviewed-scene.css';
export function ReviewedProvider({packet, tunnel, lsp}: {packet:BuilderTunnelPacketProjection|null;tunnel?:BuilderTunnelState;lsp?:BuilderMplsLspState}) {
 const host=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const element=host.current;if(!element)return;let cancelled=false,dispose:(()=>void)|null=null;
  element.dataset.theme=document.documentElement.dataset.theme==='dark'?'dark':'light';
  const theme=new MutationObserver(()=>{element.dataset.theme=document.documentElement.dataset.theme==='dark'?'dark':'light';const select=element.querySelector<HTMLSelectElement>('.rv-theme');if(select)select.value=element.dataset.theme;(element as HTMLElement&{causalStudy?:{appearance:()=>void}}).causalStudy?.appearance();});theme.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
  void import('./lifecycle-runtime.js').then(({mountLifecycle})=>{if(cancelled)return;const mounted=mountLifecycle(element,{bootstrapScene:'provider',referenceModels:[],provider:{packet,gre:tunnel,lsp}});dispose=mounted.dispose;});
  return()=>{cancelled=true;theme.disconnect();dispose?.();};
 },[packet,tunnel,lsp]);
 return <section className="reviewed-provider"><h3>Encapsulation and label operations</h3><p>Current Builder projections. Presentation playback has no canonical source clock; no raw payload or cryptographic bytes are invented.</p><div ref={host} className="review-runtime reviewed-snapshot" data-integrated="true"/></section>;
}
