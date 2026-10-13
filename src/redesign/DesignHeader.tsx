import {useEffect, useState} from 'react';
import {applyAppearance, appearanceKey, isAppearance, readAppearance, rememberAppearance} from './appearance';
export function DesignHeader({name, onHome, embedded=false, onReturn, returnLabel, anchor}: {name:string;onHome:()=>void;embedded?:boolean;onReturn?:()=>void;returnLabel?:string;anchor?:string}) {
 const [appearance,setAppearance]=useState(readAppearance);
 useEffect(()=>{
  const system=matchMedia('(prefers-color-scheme: dark)');
  const update=()=>applyAppearance(appearance);
  update();system.addEventListener('change',update);
  const receive=(event:MessageEvent)=>{if(event.origin!==location.origin||event.source!==window.parent||!embedded)return;const value=event.data?.hopscotchAppearance;if(isAppearance(value))setAppearance(value);if(typeof event.data?.hopscotchWorkspaceHidden==='boolean'){document.documentElement.dataset.workspaceHidden=String(event.data.hopscotchWorkspaceHidden);window.dispatchEvent(new Event('hopscotch-workspace-visibility'));}};
  const stored=(event:StorageEvent)=>{if(event.key===appearanceKey||event.key===null)setAppearance(isAppearance(event.newValue)?event.newValue:'light');};
  window.addEventListener('message',receive);
  window.addEventListener('storage',stored);
  return()=>{system.removeEventListener('change',update);window.removeEventListener('message',receive);window.removeEventListener('storage',stored);};
 },[appearance,embedded]);
 return <header className="design-header" data-has-return={Boolean(onReturn)}><div className="design-header__identity"><button className="design-home" type="button" onClick={onHome}>HOPSCOTCH</button>{onReturn?<button className="design-return" type="button" onClick={onReturn}>{returnLabel}<small>{anchor}</small></button>:<span>{name}</span>}</div><label>Appearance<select aria-label="Appearance" value={appearance} onChange={event=>{const value=event.target.value;if(isAppearance(value)){rememberAppearance(value);setAppearance(value);}}}><option value="light">Light</option><option value="dark">Dark</option><option value="system">System</option></select></label></header>;
}
