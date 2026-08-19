import { useEffect, useMemo } from 'react';
import { builderApplicationDiagnosisSection, builderProtocolDatabaseSection } from './builder/workbench-depth.ts';
import type { BuilderDeviceRef, BuilderDeviceWorkbenchInput, BuilderWorkbenchRow, BuilderWorkbenchSection } from './builder/device-workbench.ts';

function Why({ row }: { row: BuilderWorkbenchRow }) {
  if (row.why.length === 0) return null;
  return <details className="device-workbench-why"><summary>WHY?</summary><div>{row.why.map((step) => <p key={step.id}><span>{step.source}</span><strong>{step.label}</strong><small>{step.detail}</small></p>)}</div></details>;
}

export function BuilderWorkbenchDepthPanel({ input, device, onRowCount }: { input: BuilderDeviceWorkbenchInput; device: BuilderDeviceRef; onRowCount?: (count: number) => void }) {
  const sections = useMemo(
    () => [builderProtocolDatabaseSection(input, device), builderApplicationDiagnosisSection(input, device)].filter((entry): entry is BuilderWorkbenchSection => Boolean(entry)),
    [input, device.plane, device.id],
  );
  const rowCount = sections.reduce((sum, current) => sum + current.rows.length, 0);

  useEffect(() => {
    onRowCount?.(rowCount);
  }, [onRowCount, rowCount]);

  if (sections.length === 0) return null;
  return <>{sections.map((section) => <section key={section.id} className="device-workbench-depth-section"><div className="device-workbench-section-title"><span>{section.title}</span><strong>{section.summary}</strong></div>{section.rows.length === 0 ? <small className="device-workbench-empty">{section.summary}</small> : section.rows.map((entry) => <article key={entry.id} className={`status-${entry.status}`}><div><span>{entry.label}</span><strong>{entry.value}</strong></div><p>{entry.detail}</p><Why row={entry} /></article>)}</section>)}</>;
}
