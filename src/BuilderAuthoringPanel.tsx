import { lazy, Suspense } from 'react';
import type { BuilderAddressing } from './builder/addressing.ts';
import type { BuilderEthernetConfig } from './builder/ethernet.ts';
import type { BuilderAuthoringSession, BuilderAuthoringSnapshot } from './builder/authoring.ts';
import type { BuilderGraph, BuilderLayout } from './builder/model.ts';

const BuilderAuthoringPanelContent = lazy(() => import('./BuilderAuthoringPanelContent.tsx'));

export interface BuilderAuthoringPanelProps {
  snapshot: BuilderAuthoringSnapshot;
  view: BuilderAuthoringSession;
  historical: boolean;
  onViewChange: (next: BuilderAuthoringSession) => void;
  onApplySnapshot: (snapshot: BuilderAuthoringSnapshot, message: string) => void;
  onCommitGraph: (graph: BuilderGraph, layout: BuilderLayout | null, message: string) => void;
  onCommitAddressing: (addressing: BuilderAddressing, message: string) => void;
  onCommitEthernet: (ethernet: BuilderEthernetConfig, message: string) => void;
  onSetLayout: (layout: BuilderLayout, message: string) => void;
  onFocusDevice: (deviceId: string) => void;
  onMessage: (message: string) => void;
}

export function BuilderAuthoringPanel(props: BuilderAuthoringPanelProps) {
  return <Suspense fallback={<section className="builder-authoring-shell"><span>AUTHORING</span><strong>LOADING TOOLS…</strong></section>}><BuilderAuthoringPanelContent {...props}/></Suspense>;
}
