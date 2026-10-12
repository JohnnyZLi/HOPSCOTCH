import {useCallback, useEffect, useRef, useState} from 'react';
import type {VisualTimelineEvent} from '../VisualWorkspace';
import type {LifecycleAPI} from './lifecycle-runtime';
import './lifecycle-runtime.css';
import './reviewed-scene.css';

interface Budget {id: string; atMs: number; duration: number}
export function useReviewedAttention(events: readonly VisualTimelineEvent[]) {
 const [budgets, setBudgets] = useState<Record<string, number>>({});
 const onBudgets = useCallback((values: Budget[]) => {
  const next = Object.fromEntries(values.map(value => [value.id, value.duration]));
  setBudgets(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
 }, []);
 return {onBudgets, ready: events.every(event => Number.isFinite(budgets[event.id])),
  events: events.map(event => ({...event, presentationMs: budgets[event.id]}))};
}

export function ReviewedScene({data, timeMs, durationMs, playing, onBudgets}: {
 data: Record<string, unknown>;timeMs: number;durationMs: number;playing: boolean;onBudgets: (values: Budget[]) => void;
}) {
 const host = useRef<HTMLDivElement>(null), api = useRef<LifecycleAPI | null>(null);
 const current = useRef({timeMs, durationMs, playing});current.current = {timeMs, durationMs, playing};
 const prior = useRef<{timeMs: number; playing: boolean} | null>(null);
 const callback = useRef(onBudgets);callback.current = onBudgets;
 const [error, setError] = useState(false);
 useEffect(() => {
  const element = host.current;if (!element) return;
  let cancelled = false, initialized=false, dispose: (() => void) | null = null;
  const prepared = (event: Event) => {
   if(api.current&&!initialized){const selected=current.current;api.current.presentSource(selected.timeMs,selected.durationMs,!selected.playing);prior.current={timeMs:selected.timeMs,playing:selected.playing};initialized=true;}
   callback.current((event as CustomEvent<{budgets: Budget[]}>).detail.budgets);
  };
  element.addEventListener('review-plan-ready', prepared);
  void import('./lifecycle-runtime.js').then(({mountLifecycle}) => {
   if (cancelled) return;
   const mounted = mountLifecycle(element, data);api.current = mounted.api;dispose = mounted.dispose;
   const selected = current.current;
   if(mounted.api.snapshot().at){mounted.api.presentSource(selected.timeMs, selected.durationMs, !selected.playing);prior.current = {timeMs: selected.timeMs, playing: selected.playing};initialized=true;}
  }).catch((failure:unknown) => {if (!cancelled) {element.dataset.renderError=failure instanceof Error?failure.stack||failure.message:String(failure);console.error('Source-backed presentation failed to mount',failure);setError(true);}});
  const appearance = new MutationObserver(() => {
   element.dataset.theme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
   const select = element.querySelector<HTMLSelectElement>('.rv-theme');if (select) select.value = element.dataset.theme;
   api.current?.appearance();
  });
  element.dataset.theme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
  appearance.observe(document.documentElement, {attributes: true, attributeFilter: ['data-theme']});
  const owner=element.closest<HTMLElement>('.visual-workspace__stage'),primary=element.closest<HTMLElement>('.reviewed-primary');let geometryKey='';
  const measure=()=>{if(!owner||!primary)return;const box=owner.getBoundingClientRect(),occupied=[...owner.querySelectorAll<HTMLElement>('.visual-workspace__toolbar,.visual-workspace__hud')].map(node=>node.getBoundingClientRect()).filter(rect=>rect.width&&rect.height),top=Math.max(12,...occupied.map(rect=>rect.bottom-box.top))+12,key=top+'|'+box.height;if(key===geometryKey)return;geometryKey=key;primary.style.setProperty('--reviewed-top',top+'px');api.current?.reflow();};
  const composition=new ResizeObserver(measure);if(owner){composition.observe(owner);for(const node of owner.querySelectorAll('.visual-workspace__toolbar,.visual-workspace__hud'))composition.observe(node);}measure();
  return () => {cancelled = true;composition.disconnect();appearance.disconnect();element.removeEventListener('review-plan-ready', prepared);api.current = null;dispose?.();prior.current = null;};
 }, [data]);
 useEffect(() => {
  const previous = prior.current;
  // A pause freezes the already rendered phase. A paused seek exposes the
  // selected source outcome; it does not fabricate another wire exchange.
  if (api.current && (!previous || timeMs !== previous.timeMs || playing)) {
   api.current.presentSource(timeMs, durationMs, !playing);
  }
  prior.current = {timeMs, playing};
 }, [timeMs, durationMs, playing]);
 return <div className="reviewed-primary"><div ref={host} className="review-runtime" data-theme="light" data-integrated="true" aria-label="Source-backed protocol presentation" />
  {error && <p role="alert">The protocol presentation could not load. The source state and events remain available in Inspect.</p>}
 </div>;
}
