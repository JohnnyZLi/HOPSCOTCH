import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import {
  builderCliContextLabel,
  builderCliInterfaceCountForContext,
  executeBuilderCliSessionCommand,
  projectBuilderCliOperationalState,
  type BuilderCliMutationRequest,
  type BuilderCliOperationalProjectionInput,
  type BuilderCliProbeRequest,
} from './builder/cli-operations.ts';
import type { BuilderProbeResult } from './builder/probes.ts';
import './BuilderCliTerminal.css';

interface BuilderCliTranscriptEntry {
  id: number;
  command: string;
  output: string;
  contextLabel: string;
  error: boolean;
}

const TRANSCRIPT_LIMIT = 16;
const SHOW_SHORTCUTS = ['show interfaces', 'show route', 'show ospf neighbors', 'show bgp', 'show acl', 'show nat'] as const;

export default function BuilderCliTerminal({
  input,
  contextLabel,
  defaultProbeTarget,
  defaultSourceId,
  onProbe,
  onMutation,
  activeUnavailableReason,
  onClose,
}: {
  input: BuilderCliOperationalProjectionInput;
  contextLabel: string;
  defaultProbeTarget: string;
  defaultSourceId: string;
  onProbe?: (request: BuilderCliProbeRequest) => BuilderProbeResult;
  onMutation?: (request: BuilderCliMutationRequest) => string;
  activeUnavailableReason?: string;
  onClose: () => void;
}) {
  const state = useMemo(() => projectBuilderCliOperationalState(input), [input]);
  const [command, setCommand] = useState('show route');
  const [transcript, setTranscript] = useState<BuilderCliTranscriptEntry[]>([]);
  const [historyCursor, setHistoryCursor] = useState<number | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const nextEntryId = useRef(1);
  const inputRef = useRef<HTMLInputElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const activeEnabled = Boolean(onProbe || onMutation);
  const scopedCore = deviceId ? {
    interfaces: state.core.interfaces.filter((entry) => entry.deviceId === deviceId),
    routes: state.core.routes.filter((entry) => entry.routerId === deviceId),
    arpEntries: state.core.arpEntries.filter((entry) => entry.ownerDeviceId === deviceId),
    macEntries: state.core.macEntries.filter((entry) => entry.switchId === deviceId),
  } : state.core;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (deviceId && !state.graph.nodes.some((node) => node.id === deviceId)) setDeviceId(null);
  }, [deviceId, state.graph]);

  useEffect(() => {
    const element = transcriptRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [transcript]);

  const execute = (rawCommand = command) => {
    let output: string;
    let error = false;
    let entryDeviceId = deviceId;
    try {
      const result = executeBuilderCliSessionCommand(rawCommand, {
        state,
        currentDeviceId: deviceId,
        defaultSourceId,
        runProbe: onProbe,
        mutate: onMutation,
        activeUnavailableReason,
      });
      output = result.output;
      entryDeviceId = result.nextDeviceId;
      setDeviceId(result.nextDeviceId);
    } catch (caught) {
      error = true;
      output = caught instanceof Error ? caught.message : 'CLI command failed.';
    }
    const entry: BuilderCliTranscriptEntry = {
      id: nextEntryId.current++,
      command: rawCommand,
      output,
      contextLabel: `${contextLabel} · ${builderCliContextLabel(state, entryDeviceId)}`,
      error,
    };
    setTranscript((current) => [...current, entry].slice(-TRANSCRIPT_LIMIT));
    setCommand('');
    setHistoryCursor(null);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    execute();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const commands = transcript.map((entry) => entry.command);
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'l') {
      event.preventDefault();
      setTranscript([]);
      setHistoryCursor(null);
      return;
    }
    if (event.key === 'ArrowUp' && commands.length > 0) {
      event.preventDefault();
      const nextCursor = historyCursor == null ? commands.length - 1 : Math.max(0, historyCursor - 1);
      setHistoryCursor(nextCursor);
      setCommand(commands[nextCursor] ?? '');
      return;
    }
    if (event.key === 'ArrowDown' && historyCursor != null) {
      event.preventDefault();
      if (historyCursor >= commands.length - 1) {
        setHistoryCursor(null);
        setCommand('');
      } else {
        const nextCursor = historyCursor + 1;
        setHistoryCursor(nextCursor);
        setCommand(commands[nextCursor] ?? '');
      }
    }
  };

  const context = builderCliContextLabel(state, deviceId);

  return <section id="builder-cli-terminal" className="builder-cli-terminal" aria-label="HOPSCOTCH Builder terminal">
    <header className="builder-cli-header">
      <div>
        <span>HOPSCOTCH CLI · {activeEnabled ? 'CANONICAL CONTROL' : 'READ ONLY'}</span>
        <strong>{contextLabel} · {context}</strong>
      </div>
      <div className="builder-cli-header-meta" aria-label="Projected CLI fact counts">
        <span>{builderCliInterfaceCountForContext(state, deviceId)} IF</span>
        <span>{scopedCore.routes.length} ROUTES</span>
        <span>{scopedCore.arpEntries.length} ARP</span>
        <span>{scopedCore.macEntries.length} MAC</span>
      </div>
      <div className="builder-cli-header-actions">
        <button type="button" onClick={() => { setTranscript([]); setHistoryCursor(null); }}>CLEAR</button>
        <button type="button" onClick={onClose}>CLOSE</button>
      </div>
    </header>

    <div ref={transcriptRef} className="builder-cli-transcript" aria-live="polite">
      {transcript.length === 0 && <div className="builder-cli-empty">
        <strong>ONE TERMINAL. ONE CANONICAL NETWORK MODEL.</strong>
        <span>{activeEnabled
          ? 'Use a device context for scoped inspection and bounded configuration. Show commands project existing OSPF, BGP, ACL, NAT, RIB, ARP, and FDB truth. Ping/traceroute delegate to the existing IPv4 or IPv6 probe engines.'
          : 'Time Machine remains inspection-only. USE and SHOW can inspect the selected historical snapshot; probes and configuration fail closed instead of creating counterfactual state.'}</span>
      </div>}
      {transcript.map((entry) => <article key={entry.id} className={entry.error ? 'is-error' : ''}>
        <div className="builder-cli-command-line"><span>{entry.contextLabel.toLowerCase()}$</span><strong>{entry.command || '∅'}</strong></div>
        <pre>{entry.output}</pre>
      </article>)}
    </div>

    <form className="builder-cli-prompt" onSubmit={submit}>
      <label>
        <span>{deviceId ?? 'global'}&gt;</span>
        <input
          ref={inputRef}
          value={command}
          spellCheck={false}
          autoCapitalize="none"
          autoComplete="off"
          aria-label="HOPSCOTCH CLI command"
          onChange={(event) => { setCommand(event.currentTarget.value); setHistoryCursor(null); }}
          onKeyDown={handleKeyDown}
        />
      </label>
      <button type="submit">RUN</button>
    </form>

    <div className="builder-cli-shortcuts" aria-label="Supported CLI commands">
      {SHOW_SHORTCUTS.map((shortcut) => <button key={shortcut} type="button" onClick={() => execute(shortcut)}>{shortcut.toUpperCase()}</button>)}
      <button type="button" onClick={() => execute(`use ${defaultSourceId}`)}>USE {defaultSourceId.toUpperCase()}</button>
      <button type="button" onClick={() => execute('use global')}>USE GLOBAL</button>
      {activeEnabled && <>
        <button type="button" onClick={() => execute(`ping ${defaultProbeTarget}`)}>PING {defaultProbeTarget.toUpperCase()}</button>
        <button type="button" onClick={() => execute(`traceroute ${defaultProbeTarget}`)}>TRACE {defaultProbeTarget.toUpperCase()}</button>
        <button type="button" onClick={() => execute(`ping ipv6 ${defaultProbeTarget}`)}>PING6 {defaultProbeTarget.toUpperCase()}</button>
      </>}
      <small>↑/↓ HISTORY · CTRL/CMD+L CLEAR · ESC CLOSE</small>
    </div>
  </section>;
}
