import { buildBuilderDeviceWorkbench, type BuilderDeviceRef, type BuilderDeviceWorkbenchInput, type BuilderDeviceWorkbenchSnapshot, type BuilderWorkbenchEventJournal, type BuilderWorkbenchRow } from './device-workbench.ts';

export const BUILDER_TIMELINE_TICK_MS = 1000;
export const BUILDER_TIMELINE_LIMIT = 160;

export type BuilderTimelineState = Omit<BuilderDeviceWorkbenchInput, 'events'>;

export interface BuilderTimelineSnapshot {
  eventId: string;
  sequence: number;
  atMs: number;
  category: string;
  summary: string;
  detail: string;
  state: BuilderTimelineState;
}

export interface BuilderTimeline {
  snapshots: BuilderTimelineSnapshot[];
}

export type BuilderTimelineDiffTruth = 'CONFIG' | 'STATE';
export type BuilderTimelineDiffChange = 'added' | 'removed' | 'changed';

export interface BuilderTimelineDiffEntry {
  id: string;
  truth: BuilderTimelineDiffTruth;
  section: string;
  label: string;
  change: BuilderTimelineDiffChange;
  before: string | null;
  after: string | null;
}

export interface BuilderTimelineDeviceDiff {
  sequence: number;
  previousSequence: number | null;
  entries: BuilderTimelineDiffEntry[];
  configChanges: number;
  stateChanges: number;
}

function cloneTimelineState(state: BuilderTimelineState): BuilderTimelineState {
  if (typeof structuredClone === 'function') return structuredClone(state);
  return JSON.parse(JSON.stringify(state)) as BuilderTimelineState;
}

function stateFromInput(input: BuilderDeviceWorkbenchInput): BuilderTimelineState {
  const { events: _events, ...state } = input;
  return state;
}

export function createBuilderTimeline(): BuilderTimeline {
  return { snapshots: [] };
}

export function captureBuilderTimelineSnapshot(timeline: BuilderTimeline, journal: BuilderWorkbenchEventJournal, input: BuilderDeviceWorkbenchInput): BuilderTimeline {
  const event = journal.at(-1);
  if (!event) return timeline;
  if (timeline.snapshots.some((snapshot) => snapshot.eventId === event.id)) return timeline;
  const snapshot: BuilderTimelineSnapshot = {
    eventId: event.id,
    sequence: event.sequence,
    atMs: event.sequence * BUILDER_TIMELINE_TICK_MS,
    category: event.category,
    summary: event.summary,
    detail: event.detail,
    state: cloneTimelineState(stateFromInput(input)),
  };
  return { snapshots: [...timeline.snapshots, snapshot].slice(-BUILDER_TIMELINE_LIMIT) };
}

export function builderTimelineSnapshotAtSequence(timeline: BuilderTimeline, sequence: number): BuilderTimelineSnapshot | null {
  let selected: BuilderTimelineSnapshot | null = null;
  for (const snapshot of timeline.snapshots) {
    if (snapshot.sequence > sequence) break;
    selected = snapshot;
  }
  return selected ?? timeline.snapshots[0] ?? null;
}

export function builderTimelineJournalThroughSequence(journal: BuilderWorkbenchEventJournal, sequence: number): BuilderWorkbenchEventJournal {
  return journal.filter((event) => event.sequence <= sequence);
}

export function builderTimelineWorkbenchAtSequence(timeline: BuilderTimeline, journal: BuilderWorkbenchEventJournal, sequence: number, device: BuilderDeviceRef): BuilderDeviceWorkbenchSnapshot | null {
  const snapshot = builderTimelineSnapshotAtSequence(timeline, sequence);
  if (!snapshot) return null;
  return buildBuilderDeviceWorkbench({ ...snapshot.state, events: builderTimelineJournalThroughSequence(journal, snapshot.sequence) }, device);
}

function flattenRows(snapshot: BuilderDeviceWorkbenchSnapshot, truth: BuilderTimelineDiffTruth): Map<string, { section: string; row: BuilderWorkbenchRow }> {
  const sections = truth === 'CONFIG' ? snapshot.configSections : snapshot.stateSections;
  const result = new Map<string, { section: string; row: BuilderWorkbenchRow }>();
  for (const section of sections) for (const row of section.rows) result.set(`${section.id}:${row.id}`, { section: section.title, row });
  return result;
}

function rowFingerprint(row: BuilderWorkbenchRow): string {
  return JSON.stringify([row.label, row.value, row.detail, row.status, row.why.map((step) => [step.source, step.label, step.detail])]);
}

function diffTruth(before: BuilderDeviceWorkbenchSnapshot | null, after: BuilderDeviceWorkbenchSnapshot, truth: BuilderTimelineDiffTruth): BuilderTimelineDiffEntry[] {
  const beforeRows = before ? flattenRows(before, truth) : new Map<string, { section: string; row: BuilderWorkbenchRow }>();
  const afterRows = flattenRows(after, truth);
  const keys = [...new Set([...beforeRows.keys(), ...afterRows.keys()])].sort();
  const entries: BuilderTimelineDiffEntry[] = [];
  for (const key of keys) {
    const prior = beforeRows.get(key);
    const next = afterRows.get(key);
    if (!prior && next) entries.push({ id: `${truth}:${key}:added`, truth, section: next.section, label: next.row.label, change: 'added', before: null, after: next.row.value });
    else if (prior && !next) entries.push({ id: `${truth}:${key}:removed`, truth, section: prior.section, label: prior.row.label, change: 'removed', before: prior.row.value, after: null });
    else if (prior && next && rowFingerprint(prior.row) !== rowFingerprint(next.row)) entries.push({ id: `${truth}:${key}:changed`, truth, section: next.section, label: next.row.label, change: 'changed', before: prior.row.value, after: next.row.value });
  }
  return entries;
}

export function diffBuilderTimelineDevice(timeline: BuilderTimeline, journal: BuilderWorkbenchEventJournal, sequence: number, device: BuilderDeviceRef): BuilderTimelineDeviceDiff | null {
  const currentIndex = timeline.snapshots.findIndex((snapshot) => snapshot.sequence === builderTimelineSnapshotAtSequence(timeline, sequence)?.sequence);
  if (currentIndex < 0) return null;
  const current = timeline.snapshots[currentIndex];
  const previous = currentIndex > 0 ? timeline.snapshots[currentIndex - 1] : null;
  const afterWorkbench = buildBuilderDeviceWorkbench({ ...current.state, events: builderTimelineJournalThroughSequence(journal, current.sequence) }, device);
  const beforeWorkbench = previous ? buildBuilderDeviceWorkbench({ ...previous.state, events: builderTimelineJournalThroughSequence(journal, previous.sequence) }, device) : null;
  const entries = [...diffTruth(beforeWorkbench, afterWorkbench, 'CONFIG'), ...diffTruth(beforeWorkbench, afterWorkbench, 'STATE')];
  return {
    sequence: current.sequence,
    previousSequence: previous?.sequence ?? null,
    entries,
    configChanges: entries.filter((entry) => entry.truth === 'CONFIG').length,
    stateChanges: entries.filter((entry) => entry.truth === 'STATE').length,
  };
}
