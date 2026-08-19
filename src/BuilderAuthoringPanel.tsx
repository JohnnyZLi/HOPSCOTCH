import { lazy, Suspense, useState } from 'react';
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

export default function BuilderAuthoringPanel(props: BuilderAuthoringPanelProps) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return <section className="builder-authoring-shell"><div><span>AUTHORING</span><strong>{props.historical ? 'HISTORICAL · READ ONLY' : `${props.view.selection.length} SELECTED`}</strong></div><div className="builder-authoring-toolbar"><button type="button" onClick={() => setOpen(true)}>OPEN AUTHORING</button></div></section>;
  }
  return <div><div className="builder-authoring-toolbar"><button type="button" onClick={() => setOpen(false)}>CLOSE AUTHORING</button></div><Suspense fallback={<section className="builder-authoring-shell"><span>AUTHORING</span><strong>LOADING TOOLS…</strong></section>}><BuilderAuthoringPanelContent {...props}/></Suspense></div>;
}
