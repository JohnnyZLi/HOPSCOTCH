import { useEffect, useMemo, useState } from 'react';
import type { BuilderDeviceWorkbenchInput } from './builder/device-workbench.ts';
import {
  builderExplainCatalog,
  createBuilderExplanationQueryPack,
  explainBuilderNetwork,
  type BuilderExplainLevel,
  type BuilderExplainTopic,
} from './builder/explain.ts';
import './BuilderExplainPanel.css';

const TOPICS: Array<{ id: BuilderExplainTopic; label: string }> = [
  { id: 'network', label: 'NETWORK' },
  { id: 'route', label: 'ROUTE' },
  { id: 'adjacency', label: 'OSPF' },
  { id: 'policy', label: 'POLICY' },
  { id: 'packet', label: 'PACKET' },
  { id: 'application', label: 'APPLICATION' },
  { id: 'event', label: 'EVENT' },
];

function tone(status: string): string {
  return status === 'bad' ? 'is-bad' : status === 'warn' ? 'is-warn' : status === 'good' ? 'is-good' : '';
}

export default function BuilderExplainPanel({
  input,
  historicalSequence,
  selectedNodeId,
  selectedProbeId,
  onClose,
}: {
  input: BuilderDeviceWorkbenchInput;
  historicalSequence: number | null;
  selectedNodeId: string;
  selectedProbeId: string | null;
  onClose: () => void;
}) {
  const catalog = useMemo(() => builderExplainCatalog(input), [input]);
  const [topic, setTopic] = useState<BuilderExplainTopic>('network');
  const [level, setLevel] = useState<BuilderExplainLevel>('operational');
  const [routerId, setRouterId] = useState<string>(() => catalog.routers.find((entry) => entry.id === selectedNodeId)?.id ?? catalog.routers[0]?.id ?? '');
  const [adjacencyId, setAdjacencyId] = useState<string>(() => catalog.adjacencies[0]?.id ?? '');
  const [probeId, setProbeId] = useState<string>(() => selectedProbeId && catalog.probes.some((entry) => entry.id === selectedProbeId) ? selectedProbeId : catalog.probes[0]?.id ?? '');
  const [applicationId, setApplicationId] = useState<string>(() => catalog.applications[0]?.id ?? '');
  const [eventId, setEventId] = useState<string>(() => catalog.events[0]?.id ?? '');
  const [copyState, setCopyState] = useState('COPY FACT PACK');

  useEffect(() => {
    if (catalog.routers.some((entry) => entry.id === selectedNodeId)) setRouterId(selectedNodeId);
    else if (!catalog.routers.some((entry) => entry.id === routerId)) setRouterId(catalog.routers[0]?.id ?? '');
  }, [catalog.routers, routerId, selectedNodeId]);
  useEffect(() => { if (!catalog.adjacencies.some((entry) => entry.id === adjacencyId)) setAdjacencyId(catalog.adjacencies[0]?.id ?? ''); }, [catalog.adjacencies, adjacencyId]);
  useEffect(() => {
    if (selectedProbeId && catalog.probes.some((entry) => entry.id === selectedProbeId)) setProbeId(selectedProbeId);
    else if (!catalog.probes.some((entry) => entry.id === probeId)) setProbeId(catalog.probes[0]?.id ?? '');
  }, [catalog.probes, probeId, selectedProbeId]);
  useEffect(() => { if (!catalog.applications.some((entry) => entry.id === applicationId)) setApplicationId(catalog.applications[0]?.id ?? ''); }, [catalog.applications, applicationId]);
  useEffect(() => { if (!catalog.events.some((entry) => entry.id === eventId)) setEventId(catalog.events[0]?.id ?? ''); }, [catalog.events, eventId]);

  const explanation = useMemo(() => explainBuilderNetwork(input, {
    topic,
    level,
    routerId: routerId || null,
    adjacencyId: adjacencyId || null,
    probeId: probeId || null,
    applicationId: applicationId || null,
    eventId: eventId || null,
  }), [input, topic, level, routerId, adjacencyId, probeId, applicationId, eventId]);

  const queryPack = useMemo(() => createBuilderExplanationQueryPack(explanation), [explanation]);
  const cited = new Map(explanation.citations.map((citation) => [citation.id, citation]));

  const copyFactPack = async () => {
    const text = JSON.stringify(queryPack, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      setCopyState('COPIED');
    } catch {
      const blob = new Blob([text], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `hopscotch-explain-${topic}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setCopyState('EXPORTED');
    }
    window.setTimeout(() => setCopyState('COPY FACT PACK'), 1400);
  };

  return <section id="builder-explain-panel" className="builder-explain-panel" data-builder-explain-topic={topic} data-builder-explain-level={level} aria-label="Explain This Network">
    <header className="builder-explain-header">
      <div>
        <span>CANONICAL EXPLANATION</span>
        <strong>EXPLAIN THIS NETWORK</strong>
        <small>{historicalSequence == null ? 'LIVE CANONICAL STATE' : `HISTORY #${String(historicalSequence).padStart(3, '0')} · READ-ONLY SNAPSHOT`}</small>
      </div>
      <div className="builder-explain-header-actions">
        <button type="button" onClick={copyFactPack}>{copyState}</button>
        <button type="button" onClick={onClose}>CLOSE</button>
      </div>
    </header>

    <div className="builder-explain-toolbar">
      <div className="builder-explain-topics" aria-label="Explanation topics">
        {TOPICS.map((entry) => <button key={entry.id} type="button" className={topic === entry.id ? 'is-active' : ''} onClick={() => setTopic(entry.id)}>{entry.label}</button>)}
      </div>
      <label>DETAIL LEVEL<select value={level} onChange={(event) => setLevel(event.currentTarget.value as BuilderExplainLevel)}><option value="novice">NOVICE</option><option value="operational">OPERATIONAL</option><option value="protocol">PROTOCOL DETAIL</option></select></label>
      {topic === 'route' && <label>ROUTER<select value={routerId} onChange={(event) => setRouterId(event.currentTarget.value)}>{catalog.routers.map((entry) => <option key={entry.id} value={entry.id}>{entry.label} · {entry.id}</option>)}</select></label>}
      {topic === 'adjacency' && <label>ADJACENCY<select value={adjacencyId} onChange={(event) => setAdjacencyId(event.currentTarget.value)}>{catalog.adjacencies.length ? catalog.adjacencies.map((entry) => <option key={entry.id} value={entry.id}>{entry.label} · {entry.state}</option>) : <option value="">NO OSPF ADJACENCY</option>}</select></label>}
      {topic === 'packet' && <label>PROBE<select value={probeId} onChange={(event) => setProbeId(event.currentTarget.value)}>{catalog.probes.length ? catalog.probes.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>) : <option value="">NO PROBE HISTORY</option>}</select></label>}
      {topic === 'application' && <label>TRANSACTION<select value={applicationId} onChange={(event) => setApplicationId(event.currentTarget.value)}>{catalog.applications.length ? catalog.applications.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>) : <option value="">NO APPLICATION HISTORY</option>}</select></label>}
      {topic === 'event' && <label>EVENT<select value={eventId} onChange={(event) => setEventId(event.currentTarget.value)}>{catalog.events.length ? catalog.events.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>) : <option value="">NO EVENT</option>}</select></label>}
    </div>

    <div className="builder-explain-summary">
      <div><span>{explanation.title}</span><strong>{explanation.focusLabel}</strong></div>
      <b className={explanation.facts.some((fact) => fact.status === 'bad') ? 'is-bad' : 'is-good'}>{explanation.verdictCode.replaceAll('_', ' ')}</b>
      <p>{explanation.summary}</p>
      <small>{explanation.detail}</small>
    </div>

    <div className="builder-explain-grid">
      <section className="builder-explain-chain">
        <div className="builder-explain-section-title"><span>CAUSE → EFFECT</span><strong>{explanation.chain.length} STRUCTURED FACTS</strong></div>
        {explanation.chain.length === 0 ? <p>No structured facts are available for this focus.</p> : explanation.chain.map((step, index) => <article key={step.id} className={tone(step.status)} data-explain-fact-id={step.factId}>
          <i>{String(index + 1).padStart(2, '0')}</i>
          <div><strong>{step.label}</strong><p>{step.detail}</p>{step.citationIds.length > 0 && <small>{step.citationIds.map((id) => `[${id}]`).join(' ')}</small>}</div>
        </article>)}
      </section>

      <section className="builder-explain-evidence">
        <div className="builder-explain-section-title"><span>EVIDENCE</span><strong>{explanation.citations.length} EXACT REFERENCES</strong></div>
        {explanation.citations.map((citation) => <article key={citation.id} data-explain-citation-ref={citation.ref}>
          <div><b>{citation.id}</b><span>{citation.kind}</span></div>
          <strong>{citation.label}</strong>
          <code>{citation.ref}</code>
          <p>{citation.value}</p>
        </article>)}
      </section>
    </div>

    <footer className="builder-explain-boundary">
      <strong>AI / EXPLANATION BOUNDARY</strong>
      <span>The exported fact pack is advisory evidence only. An AI may summarize, answer from cited facts, or compare cited facts. It cannot decide routing, forwarding, policy, protocol state, canonical mutations, or evidence provenance.</span>
      <small>{explanation.boundary}</small>
    </footer>
  </section>;
}
