import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import {
  BUILDER_CLI_SHOW_TARGETS,
  BuilderCliCommandError,
  projectBuilderCliCommand,
  projectBuilderCliState,
  type BuilderCliProjectionInput,
  type BuilderCliShowTarget,
} from './builder/cli.ts';
import './BuilderCliTerminal.css';

interface BuilderCliTranscriptEntry {
  id: number;
  command: string;
  output: string;
  contextLabel: string;
  error: boolean;
}

const TRANSCRIPT_LIMIT = 12;

function commandFor(target: BuilderCliShowTarget): string {
  return `show ${target}`;
}

export default function BuilderCliTerminal({
  input,
  contextLabel,
  onClose,
}: {
  input: BuilderCliProjectionInput;
  contextLabel: string;
  onClose: () => void;
}) {
  const state = useMemo(() => projectBuilderCliState(input), [input]);
  const [command, setCommand] = useState('show interfaces');
  const [transcript, setTranscript] = useState<BuilderCliTranscriptEntry[]>([]);
  const [historyCursor, setHistoryCursor] = useState<number | null>(null);
  const nextEntryId = useRef(1);
  const inputRef = useRef<HTMLInputElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const element = transcriptRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [transcript]);

  const execute = (rawCommand = command) => {
    let output: string;
    let error = false;
    try {
      output = projectBuilderCliCommand(rawCommand, state);
    } catch (caught) {
      error = true;
      output = caught instanceof BuilderCliCommandError
        ? `${caught.code} · ${caught.message}`
        : caught instanceof Error
          ? caught.message
          : 'CLI command failed.';
    }
    const entry: BuilderCliTranscriptEntry = {
      id: nextEntryId.current++,
      command: rawCommand,
      output,
      contextLabel,
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

  return <section id="builder-cli-terminal" className="builder-cli-terminal" aria-label="HOPSCOTCH Builder terminal">
    <header className="builder-cli-header">
      <div>
        <span>HOPSCOTCH CLI · READ ONLY</span>
        <strong>{contextLabel} CANONICAL STATE</strong>
      </div>
      <div className="builder-cli-header-meta" aria-label="Projected CLI fact counts">
        <span>{state.interfaces.length} IF</span>
        <span>{state.routes.length} ROUTES</span>
        <span>{state.arpEntries.length} ARP</span>
        <span>{state.macEntries.length} MAC</span>
      </div>
      <div className="builder-cli-header-actions">
        <button type="button" onClick={() => { setTranscript([]); setHistoryCursor(null); }}>CLEAR</button>
        <button type="button" onClick={onClose}>CLOSE</button>
      </div>
    </header>

    <div ref={transcriptRef} className="builder-cli-transcript" aria-live="polite">
      {transcript.length === 0 && <div className="builder-cli-empty">
        <strong>QUERY THE BUILDER, NOT A DEVICE IMAGE.</strong>
        <span>Outputs are deterministic projections of current HOPSCOTCH truth. Configuration and probe commands remain unsupported in this slice.</span>
      </div>}
      {transcript.map((entry) => <article key={entry.id} className={entry.error ? 'is-error' : ''}>
        <div className="builder-cli-command-line"><span>{entry.contextLabel.toLowerCase()}$</span><strong>{entry.command || '∅'}</strong></div>
        <pre>{entry.output}</pre>
      </article>)}
    </div>

    <form className="builder-cli-prompt" onSubmit={submit}>
      <label>
        <span>hopscotch&gt;</span>
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
      {BUILDER_CLI_SHOW_TARGETS.map((target) => <button key={target} type="button" onClick={() => execute(commandFor(target))}>{commandFor(target).toUpperCase()}</button>)}
      <small>↑/↓ HISTORY · CTRL/CMD+L CLEAR · ESC CLOSE</small>
    </div>
  </section>;
}
