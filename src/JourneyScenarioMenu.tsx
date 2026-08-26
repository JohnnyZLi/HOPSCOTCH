import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useRef, useState } from 'react';
import { readJourneyBrowserConfig, suspendJourneyClock } from './journey/browser.ts';
import {
  buildJourneyShareUrl,
  createPortableJourneyScenario,
  parseJourneyScenarioJson,
  serializeJourneyScenario,
  type PortableJourneyScenario,
} from './journey/scenario.ts';
import './JourneyScenarioMenu.css';

function safeFileName(name: string): string {
  const normalized = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return normalized || 'hopscotch-journey';
}

export function JourneyScenarioMenu({
  hostname,
  timeMs,
  name,
  onNameChange,
  onImportScenario,
}: {
  hostname: string;
  timeMs: number;
  name: string;
  onNameChange: (name: string) => void;
  onImportScenario: (scenario: PortableJourneyScenario) => void;
}) {
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentScenario = () => createPortableJourneyScenario({
    name: name.trim() || undefined,
    hostname,
    config: readJourneyBrowserConfig(),
    timeMs: Math.max(0, Math.round(timeMs)),
  });

  const copyLink = async () => {
    setError(null);
    try {
      const portable = currentScenario();
      const url = buildJourneyShareUrl(window.location.href, portable);
      setShareUrl(url);
      try {
        await navigator.clipboard.writeText(url);
        setStatus('Share link copied');
      } catch {
        setStatus('Share link ready');
      }
    } catch (copyError) {
      setError(copyError instanceof Error ? copyError.message : 'Could not create share link.');
    }
  };

  const exportJson = () => {
    setError(null);
    try {
      const portable = currentScenario();
      const blob = new Blob([serializeJourneyScenario(portable)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${safeFileName(portable.name ?? portable.hostname)}.hopscotch.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setStatus('Scenario exported');
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'Could not export scenario.');
    }
  };

  const importJson = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      const imported = parseJourneyScenarioJson(await file.text());
      suspendJourneyClock();
      onNameChange(imported.name ?? '');
      setShareUrl('');
      setStatus('Scenario imported');
      onImportScenario(imported);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'Could not import scenario.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const schemaLabel = currentScenario().version === 2 ? 'Schema v2' : 'Schema v1';

  return <div className="journey-scenario-menu">
    <button className={`lab-mode ${open ? 'active' : ''}`} type="button" onClick={() => setOpen((current) => !current)}>Share or import</button>
    <AnimatePresence initial={false}>
      {open && <motion.section className="journey-scenario-panel" initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -8, scale: .985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: .99 }} transition={reduceMotion ? { duration: 0 } : { duration: .22, ease: [.16,1,.3,1] }}>
        <div className="scenario-panel-heading"><div><span>Portable journey</span><strong>{schemaLabel}</strong></div><button type="button" onClick={() => setOpen(false)} aria-label="Close scenario panel">×</button></div>
        <label className="scenario-name"><span>Name, optional</span><input value={name} maxLength={80} placeholder="Failure story" onChange={(event) => { onNameChange(event.currentTarget.value); setStatus(null); }}/></label>
        <div className="scenario-actions"><button type="button" onClick={() => void copyLink()}>Copy link</button><button type="button" onClick={exportJson}>Export JSON</button><button type="button" onClick={() => fileInputRef.current?.click()}>Import JSON</button></div>
        <input ref={fileInputRef} className="scenario-file-input" type="file" accept="application/json,.json" onChange={(event) => void importJson(event.currentTarget.files?.[0])}/>
        {shareUrl && <label className="scenario-link"><span>Share URL</span><input readOnly value={shareUrl} onFocus={(event) => event.currentTarget.select()}/></label>}
        <p className={error ? 'error' : ''}>{error ?? status ?? 'Exports configuration + timestamp only. Reducer state is rebuilt when restored.'}</p>
      </motion.section>}
    </AnimatePresence>
  </div>;
}
