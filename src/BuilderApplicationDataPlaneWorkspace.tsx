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
  return <>
    <BuilderApplicationWorkspace {...props} onTransaction={onTransaction} />
    <BuilderDataPlanePanel transaction={transaction} linkProfiles={props.context.linkProfiles} historical={props.historical} />
  </>;
}
