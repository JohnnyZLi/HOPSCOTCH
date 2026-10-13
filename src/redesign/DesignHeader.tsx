import {useEffect, useState} from 'react';
type Appearance = 'light' | 'dark' | 'system';
export function DesignHeader({name, onHome, embedded=false, onReturn, returnLabel, anchor}: {name:string;onHome:()=>void;embedded?:boolean;onReturn?:()=>void;returnLabel?:string;anchor?:string}) {
 const [appearance,setAppearance]=useState<Appearance>('light');
 useEffect(()=>{
  const system=matchMedia('(prefers-color-scheme: dark)');
  const update=()=>{document.documentElement.dataset.design='reviewed';document.documentElement.dataset.theme=appearance==='system'?(system.matches?'dark':'light'):appearance;};
  update();system.addEventListener('change',update);
  const receive=(event:MessageEvent)=>{if(event.origin!==location.origin||event.source!==window.parent||!embedded)return;const value=event.data?.hopscotchAppearance;if(['light','dark','system'].includes(value))setAppearance(value);if(typeof event.data?.hopscotchWorkspaceHidden==='boolean'){document.documentElement.dataset.workspaceHidden=String(event.data.hopscotchWorkspaceHidden);window.dispatchEvent(new Event('hopscotch-workspace-visibility'));}};
  window.addEventListener('message',receive);
  return()=>{system.removeEventListener('change',update);window.removeEventListener('message',receive);};
 },[appearance,embedded]);
 return <header className="design-header" data-has-return={Boolean(onReturn)}><div className="design-header__identity"><button className="design-home" type="button" onClick={onHome}>HOPSCOTCH</button>{onReturn?<button className="design-return" type="button" onClick={onReturn}>{returnLabel}<small>{anchor}</small></button>:<span>{name}</span>}</div><label>Appearance<select aria-label="Appearance" value={appearance} onChange={event=>setAppearance(event.target.value as Appearance)}><option value="light">Light</option><option value="dark">Dark</option><option value="system">System</option></select></label></header>;
}
