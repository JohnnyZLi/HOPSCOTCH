import { useEffect, useRef, useState } from 'react';
import type { ExploreDestination } from '../workspace-catalog';
import { applyAppearance, appearancePreference, watchAppearance } from './appearance';
import {replaceMeasuredSession} from './measurement-session';
import type {MeasuredSnapshotState} from '../measurement/state';

type Mounted = {api: {pause?: () => void; appearance?: () => void; snapshot?: () => unknown; save?: () => unknown;restore?:(value:unknown)=>void;seek?: (clock:number) => void};dispose: () => void};
const memories = new Map<string, unknown>();

export function CompleteWorkspace({destination,search,navigate,inspect}:{destination:ExploreDestination|null;search:string;navigate:(id:ExploreDestination|null,search?:string)=>void;inspect:(id:ExploreDestination)=>void}) {
  const host = useRef<HTMLDivElement>(null);
  const [error,setError] = useState('');
  useEffect(() => {
    const element = host.current!;
    let cancelled = false, mounted: Mounted | undefined,disposeControls:undefined|(()=>void),restorePlan:undefined|(()=>void);
    setError('');
    const key = (destination ?? 'home') + search;
    const restoreAppearance = () => {
      const picker = element.querySelector<HTMLSelectElement>('.rv-theme');
      if (picker) picker.value = appearancePreference();
      element.dataset.theme = document.documentElement.dataset.theme;
      mounted?.api.appearance?.();
    };
    const changed = (event: Event) => {
      const target = event.target;
      if (target instanceof HTMLSelectElement && target.matches('.rv-theme')) applyAppearance(target.value);
      if (target instanceof HTMLSelectElement && target.matches('.rv-scene-picker') && ['tcp','dns','tls','http','packet','failure','journey'].includes(target.value)) navigate(target.value as ExploreDestination);
      if (target instanceof HTMLSelectElement && target.matches('.ev-workspace')) navigate(target.value as ExploreDestination);
    };
    element.addEventListener('change',changed);
    const measuredChanged=(event:Event)=>replaceMeasuredSession((event as CustomEvent<MeasuredSnapshotState|null>).detail);
    element.addEventListener('app-measured-change',measuredChanged);
    const unwatch = watchAppearance(restoreAppearance);
    const open = async () => {
      if (!destination) {
        const {mountHome} = await import('./home-runtime');
        if (!cancelled) mounted = mountHome(element,navigate);
      } else if (destination === 'builder') {
        const [{mountBuilder},{createBuilderData}] = await Promise.all([import('./builder-runtime.js'),import('./builder-data')]);
        if (!cancelled) mounted = mountBuilder(element,await createBuilderData(search));
      } else if (['measured','capture','observed','physical','internet'].includes(destination)) {
        const [{mountEvidence},{createEvidenceData}] = await Promise.all([import('./evidence-runtime.js'),import('./evidence-data')]);
        if (!cancelled) mounted = mountEvidence(element,await createEvidenceData(destination,search));
      } else {
        const [{mountLifecycle},{createLifecycleData}] = await Promise.all([import('./lifecycle-runtime.js'),import('./lifecycle-data')]);
        if (!cancelled) {
          const data=createLifecycleData(destination,search);
          mounted = mountLifecycle(element,data);
          if(destination==='journey'){
            const [{attachJourneyControls},{attachMeasuredContext}]=await Promise.all([import('./journey-controls'),import('./measured-context')]);
            if(!cancelled){const disposeJourney=attachJourneyControls(element,search,navigate,inspect),disposeMeasured=attachMeasuredContext(element,data.journey.context.hostname,data.journey.context.destinationAddress);disposeControls=()=>{disposeJourney();disposeMeasured();};}
          }
        }
      }
      if (cancelled) return;
      restoreAppearance();
      const memory = memories.get(key);
      if (memory !== undefined && mounted?.api.restore) {
        restorePlan = () => {element.removeEventListener('review-plan-ready',restorePlan!);restorePlan=undefined;mounted?.api.restore?.(memory);};
        element.addEventListener('review-plan-ready',restorePlan,{once:true});
        restorePlan();
      }
      const foot = element.querySelector('.rv-foot span:last-child');
      if (foot) foot.textContent = '';
      const sourceNote=element.querySelector('.rv-foot span:first-child');if(sourceNote&&mounted?.api.save&&destination&&['tcp','dns','tls','http','failure','packet','journey'].includes(destination))sourceNote.textContent='SIMULATED · exact source events and bytes';
    };
    void open().catch(failure => {if(!cancelled){console.error(failure);setError(failure instanceof Error ? failure.message : String(failure));}});
    return () => {
      cancelled=true;
      mounted?.api.pause?.();
      if (mounted?.api.save) memories.set(key,mounted.api.save());
      else if (mounted?.api.snapshot) memories.set(key,mounted.api.snapshot());
      if(restorePlan)element.removeEventListener('review-plan-ready',restorePlan);
      disposeControls?.();mounted?.dispose();unwatch();element.removeEventListener('change',changed);element.removeEventListener('app-measured-change',measuredChanged);
    };
  },[destination,search]);
  return <div className="workspace-container">
    <div ref={host} className="review-runtime" data-theme={document.documentElement.dataset.theme} />
    {error && <div className="workspace-error" role="alert"><p>This workspace could not load: {error}</p><button onClick={()=>location.reload()}>Reload workspace</button></div>}
  </div>;
}
