export type Appearance = 'light' | 'dark' | 'system';
export const appearanceKey = 'hopscotch.appearance';

export function isAppearance(value: unknown): value is Appearance {
 return value === 'light' || value === 'dark' || value === 'system';
}

export function readAppearance(): Appearance {
 const initialized = document.documentElement.dataset.appearance;
 if (isAppearance(initialized)) return initialized;
 try {
  const saved = localStorage.getItem(appearanceKey);
  if (isAppearance(saved)) return saved;
 } catch { /* Appearance remains usable when storage is unavailable. */ }
 return 'light';
}

export function applyAppearance(appearance: Appearance) {
 const theme = appearance === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : appearance;
 document.documentElement.dataset.design = 'reviewed';
 document.documentElement.dataset.appearance = appearance;
 document.documentElement.dataset.theme = theme;
 document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#171a20' : '#f3f5f7');
}

export function rememberAppearance(appearance: Appearance) {
 try { localStorage.setItem(appearanceKey, appearance); } catch { /* Keep the current session preference. */ }
 applyAppearance(appearance);
}
