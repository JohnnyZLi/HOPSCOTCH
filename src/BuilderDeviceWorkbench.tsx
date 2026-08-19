import { lazy, Suspense } from 'react';
import type { BuilderDeviceOption, BuilderDeviceRef, BuilderDeviceWorkbenchSnapshot } from './builder/device-workbench.ts';
import type { BuilderTimelineDeviceDiff } from './builder/timeline.ts';
import './BuilderDeviceWorkbench.css';

const BuilderDeviceWorkbenchContent = lazy(() => import('./BuilderDeviceWorkbenchContent.tsx'));

export function BuilderDeviceWorkbench(props:{snapshot:BuilderDeviceWorkbenchSnapshot;options:BuilderDeviceOption[];onSelect:(ref:BuilderDeviceRef)=>void;historicalSequence?:number|null;diff?:BuilderTimelineDeviceDiff|null;}){
  return <Suspense fallback={null}><BuilderDeviceWorkbenchContent {...props}/></Suspense>;
}
