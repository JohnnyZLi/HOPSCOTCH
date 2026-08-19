import { lazy, Suspense } from 'react';
import type { BuilderDeviceOption, BuilderDeviceRef, BuilderDeviceWorkbenchSnapshot } from './builder/device-workbench.ts';
import type { BuilderTimelineDeviceDiff } from './builder/timeline.ts';
import './BuilderDeviceWorkbench.css';

export type BuilderWorkbenchInspectionTab = 'config' | 'state' | 'events';
export interface BuilderWorkbenchInspection { tab: BuilderWorkbenchInspectionTab; device: BuilderDeviceRef; }

const BuilderDeviceWorkbenchContent = lazy(() => import('./BuilderDeviceWorkbenchContent.tsx'));

export function BuilderDeviceWorkbench(props:{snapshot:BuilderDeviceWorkbenchSnapshot;options:BuilderDeviceOption[];onSelect:(ref:BuilderDeviceRef)=>void;onInspect?:(inspection:BuilderWorkbenchInspection)=>void;historicalSequence?:number|null;diff?:BuilderTimelineDeviceDiff|null;}){
  return <Suspense fallback={null}><BuilderDeviceWorkbenchContent {...props}/></Suspense>;
}
