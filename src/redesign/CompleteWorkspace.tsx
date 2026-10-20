import { useEffect, useRef, useState } from 'react';
import type { ExploreDestination } from '../workspace-catalog';
import { applyAppearance, appearancePreference, watchAppearance } from './appearance';
import {replaceMeasuredSession} from './measurement-session';
import type {MeasuredSnapshotState} from '../measurement/state';

type Mounted = {api: {pause?: () => void; appearance?: () => void; snapshot?: () => unknown; save?: () => unknown;restore?:(value:unknown)=>void;seek?: (clock:number) => void};dispose: () => void};
const memories = new Map<string, unknown>();

export function CompleteWorkspace({destination,search,navigate,inspect}:{destination:ExploreDestination|null;search:string;navigate:(id:ExploreDestination|null,search?:string)=>void;inspect:(id:ExploreDestination)=>void}) {
  const host = useRef<HTMLDivElement>(null);
  const retired = useRef<undefined | (() => void)>(undefined);
  const [error,setError] = useState('');
  useEffect(() => {
    const element = host.current!;
    let cancelled = false, mounted: Mounted | undefined,disposeControls:undefined|(()=>void),restorePlan:undefined|(()=>void),surface:undefined|{appearance():void;dispose():void};
    // Keep the paused outgoing composition on screen while imports/data resolve.
    // Dispose it immediately before mounting its replacement in the same turn.
    const beginMount = () => {
      const dispose = retired.current;
      retired.current = undefined;
      dispose?.();
      element.inert = false;
      element.removeAttribute('aria-busy');
    };
    setError('');
    const key = (destination ?? 'home') + search;
    const restoreAppearance = () => {
      const picker = element.querySelector<HTMLSelectElement>('.rv-theme');
      if (picker) picker.value = appearancePreference();
      element.dataset.theme = document.documentElement.dataset.theme;
      mounted?.api.appearance?.();
      surface?.appearance();
    };
    const changed = (event: Event) => {
      const target = event.target;
      if (target instanceof HTMLSelectElement && target.matches('.rv-theme')) applyAppearance(target.value);
      if (target instanceof HTMLSelectElement && ((target.matches('.rv-scene-picker') && ['tcp','dns','tls','http','packet','failure','journey'].includes(target.value)) || target.matches('.ev-workspace'))) {
        event.stopPropagation();
        navigate(target.value as ExploreDestination);
      }
    };
    element.addEventListener('change',changed,true);
    const measuredChanged=(event:Event)=>replaceMeasuredSession((event as CustomEvent<MeasuredSnapshotState|null>).detail);
    element.addEventListener('app-measured-change',measuredChanged);
    const unwatch = watchAppearance(restoreAppearance);
    const open = async () => {
      const workspaceSurface=destination?await import('./workspace-surface'):null;
      if(cancelled)return;
      if (!destination) {
        const {mountHome} = await import('./home-runtime');
        if (!cancelled) {beginMount();mounted = mountHome(element,navigate);}
      } else if (destination === 'builder') {
        const [{mountBuilder},{createBuilderData}] = await Promise.all([import('./builder-runtime.js'),import('./builder-data')]);
        const data=await createBuilderData(search);if (!cancelled) {beginMount();mounted = mountBuilder(element,data);}
      } else if (['measured','capture','observed','physical','internet'].includes(destination)) {
        const [{mountEvidence},{createEvidenceData}] = await Promise.all([import('./evidence-runtime.js'),import('./evidence-data')]);
        const data=await createEvidenceData(destination,search);if (!cancelled) {beginMount();mounted = mountEvidence(element,data);}
      } else {
        const [{mountLifecycle},{createLifecycleData},journeyControls] = await Promise.all([import('./lifecycle-runtime.js'),import('./lifecycle-data'),destination==='journey'?Promise.all([import('./journey-controls'),import('./measured-context')]):null]);
        if (!cancelled) {
          const data=createLifecycleData(destination,search);
          beginMount();
          mounted = mountLifecycle(element,data);
          restoreAppearance();
          if(journeyControls){
            const [{attachJourneyControls},{attachMeasuredContext}]=journeyControls;
            const disposeJourney=attachJourneyControls(element,search,navigate,inspect),disposeMeasured=attachMeasuredContext(element,data.journey.context.hostname,data.journey.context.destinationAddress);disposeControls=()=>{disposeJourney();disposeMeasured();};
          }
        }
      }
      if (cancelled) return;
      if(destination&&workspaceSurface){
        surface=workspaceSurface.mountWorkspaceSurface(element,navigate,destination);
      }
      restoreAppearance();
      const memory = memories.get(key);
      if (memory !== undefined && mounted?.api.restore) {
        restorePlan = () => {element.removeEventListener('review-plan-ready',restorePlan!);restorePlan=undefined;mounted?.api.restore?.(memory);};
        element.addEventListener('review-plan-ready',restorePlan,{once:true});
        restorePlan();
      }
      const foot = element.querySelector('.rv-foot span:last-child');
      if (foot) foot.textContent = '';
      const sourceNote=element.querySelector('.rv-foot span:first-child');
      if(sourceNote)sourceNote.textContent=destination==='builder'?'SIMULATED · configuration, forwarding, and history':destination==='internet'?'SIMULATED · AS relationships and routing policy':destination==='capture'?'CAPTURED · original frames and exact bytes':destination==='measured'?'LOCAL MEASURED · original report and capture times':destination==='observed'?'OBSERVED · each source retains its provenance':destination==='physical'?'PUBLIC DATA · facilities do not establish a forwarding path':destination?'SIMULATED · exact source events and bytes':'Follow a request through the Internet.';
      const builderNote=element.querySelector('.wb-revision + span');if(builderNote)builderNote.textContent='Simulated network · changes stay in this session';
    };
    void open().catch(failure => {if(!cancelled){console.error(failure);setError(failure instanceof Error ? failure.message : String(failure));}});
    return () => {
      cancelled=true;
      mounted?.api.pause?.();
      if (mounted?.api.save) memories.set(key,mounted.api.save());
      else if (mounted?.api.snapshot) memories.set(key,mounted.api.snapshot());
      if(restorePlan)element.removeEventListener('review-plan-ready',restorePlan);
      unwatch();element.removeEventListener('change',changed,true);element.removeEventListener('app-measured-change',measuredChanged);
      if(mounted){
        element.inert = true;
        element.setAttribute('aria-busy','true');
        retired.current = () => {disposeControls?.();surface?.dispose();mounted?.dispose();};
      }
    };
  },[destination,search]);
  // Route cleanup above retires the active runtime first. On a true unmount,
  // release it here; a cancelled intermediate route must not replace that owner.
  useEffect(() => () => {
    const dispose = retired.current;
    retired.current = undefined;
    dispose?.();
  },[]);
  return <div className="workspace-container">
    <div ref={host} className="review-runtime" data-theme={document.documentElement.dataset.theme} />
    {error && <div className="workspace-error" role="alert"><p>This workspace could not load: {error}</p><button onClick={()=>location.reload()}>Reload workspace</button></div>}
  </div>;
}
