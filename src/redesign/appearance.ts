export type Appearance = 'light'|'dark'|'system';
const key = 'hopscotch.appearance';
const media = matchMedia('(prefers-color-scheme: dark)');
const listeners = new Set<() => void>();
export function appearancePreference(): Appearance {
  try {const value=localStorage.getItem(key);return value==='dark'||value==='system'?value:'light';}catch{return 'light';}
}
export function applyAppearance(value: string,remember=true) {
  const preference:Appearance=value==='dark'||value==='system'?value:'light';
  if(remember)try{localStorage.setItem(key,preference);}catch{}
  document.documentElement.dataset.theme=preference==='system'?(media.matches?'dark':'light'):preference;
  document.documentElement.dataset.appearance=preference;
  for(const listener of listeners)listener();
}
export function watchAppearance(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};}
media.addEventListener('change',()=>{if(appearancePreference()==='system')applyAppearance('system',false);});
window.addEventListener('storage',event=>{if(event.key===key||event.key===null)applyAppearance(appearancePreference(),false);});
applyAppearance(appearancePreference(),false);
