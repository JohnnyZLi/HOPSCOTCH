import { useState } from 'react';
import type { BuilderApplicationTransaction } from './builder/application.ts';
import type { BuilderApplicationPanelProps } from './BuilderApplicationPanel.tsx';
import { BuilderApplicationWorkspace } from './BuilderApplicationWorkspace.tsx';
import { BuilderDataPlanePanel } from './BuilderDataPlanePanel.tsx';

export default function BuilderApplicationDataPlaneWorkspace(props: BuilderApplicationPanelProps) {
  const [transaction, setTransaction] = useState<BuilderApplicationTransaction | null>(null);
  const onTransaction = (next: BuilderApplicationTransaction) => {
    setTransaction(next);
    props.onTransaction(next);
  };
  const onIpv6ControlState = (ipv6ControlState: typeof props.context.ipv6ControlState) => props.onSessionState({
    arpCache: props.context.arpCache,
    natSessions: props.context.natSessions,
    dhcpLeases: props.context.dhcpLeases,
    ipv6ControlState,
  });
  return <>
    <BuilderApplicationWorkspace {...props} onTransaction={onTransaction} />
    <BuilderDataPlanePanel transaction={transaction} context={props.context} historical={props.historical} onIpv6ControlState={onIpv6ControlState} />
  </>;
}
