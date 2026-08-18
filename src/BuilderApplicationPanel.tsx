import { lazy, Suspense } from 'react';
import type { BuilderApplicationContext } from './builder/application.ts';
import type { BuilderArpCache } from './builder/arp.ts';
import type { BuilderDhcpLeaseTable } from './builder/dhcp.ts';
import type { BuilderIpv6ControlState } from './builder/ipv6-control-plane.ts';
import type { BuilderNatSessionTable } from './builder/nat.ts';

export interface BuilderApplicationPanelProps {
  context: BuilderApplicationContext;
  sourceNodeId: string;
  historical: boolean;
  onSessionState: (state: { arpCache: BuilderArpCache; natSessions: BuilderNatSessionTable; dhcpLeases: BuilderDhcpLeaseTable; ipv6ControlState: BuilderIpv6ControlState }) => void;
  onMessage: (message: string) => void;
}

const BuilderApplicationWorkspace = lazy(() => import('./BuilderApplicationWorkspace.tsx').then((module) => ({ default: module.BuilderApplicationWorkspace })));

export function BuilderApplicationPanel(props: BuilderApplicationPanelProps) {
  return <Suspense fallback={<section className="builder-app-loading" aria-live="polite">LOADING APPLICATION TRANSACTION…</section>}><BuilderApplicationWorkspace {...props} /></Suspense>;
}
