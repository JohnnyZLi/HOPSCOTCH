import { animate, stagger } from 'animejs';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CapturedFrameMechanism } from './CapturedFrameMechanism.tsx';
import type { ByteRange, CapturedField, CapturedFrameEvidence, CapturedLayer, CapturedLayerProtocol } from './capture/types.ts';
import {
  VisualDrawerTabs,
  VisualWorkspaceShell,
  type VisualDrawerDefinition,
  type VisualDrawerId,
} from './VisualWorkspace';
import './CapturedPacketMicroscopePass.css';

const BYTE_PAGE_SIZE = 256;

type VisualLayer = 'ethernet' | 'network' | 'transport' | 'payload';

function visualLayer(protocol: CapturedLayerProtocol): VisualLayer {
  if (protocol === 'ethernet' || protocol === 'vlan') return 'ethernet';
  if (protocol === 'ipv4' || protocol === 'ipv6' || protocol === 'ipv6-extension') return 'network';
  if (protocol === 'tcp' || protocol === 'udp' || protocol === 'icmp' || protocol === 'icmpv6') return 'transport';
  return 'payload';
}

function layerKicker(layer: CapturedLayer): string {
  const category = visualLayer(layer.protocol);
  if (category === 'ethernet') return 'L2';
  if (category === 'network') return 'L3';
  if (category === 'transport') return 'L4';
  return layer.protocol === 'dns' || layer.protocol === 'tls' ? 'L7' : 'DATA';
}

function hexByte(byte: number): string {
  return byte.toString(16).padStart(2, '0').toUpperCase();
}

function includesByte(ranges: readonly ByteRange[], byteOffset: number): boolean {
  return ranges.some((range) => byteOffset >= range.offset && byteOffset < range.offset + range.length);
}

function formatRelativeTime(nanoseconds: bigint): string {
  const milliseconds = nanoseconds / 1_000_000n;
  const remainder = nanoseconds % 1_000_000n;
  return `${(milliseconds / 1000n).toString().padStart(2, '0')}.${(milliseconds % 1000n).toString().padStart(3, '0')}${remainder > 0n ? ` +${remainder}ns` : ''}`;
}

export function CapturedPacketMicroscope({
  frame,
  onExit,
  onOpenSourceEvent,
  origin,
}: {
  frame: CapturedFrameEvidence;
  onExit: () => void;
  onOpenSourceEvent?: () => void;
  origin?: { label: string; timestamp?: string; actionLabel?: string };
}) {
  const defaultLayer = frame.layers.find((layer) => ['dns', 'tls', 'tcp', 'udp', 'icmp', 'icmpv6'].includes(layer.protocol))
    ?? frame.layers.find((layer) => layer.protocol === 'ipv4' || layer.protocol === 'ipv6')
    ?? frame.layers[0]
    ?? null;
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(defaultLayer?.id ?? null);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(defaultLayer?.fields[0]?.id ?? null);
  const [bytePage, setBytePage] = useState(() => Math.floor((defaultLayer?.byteRange.offset ?? 0) / BYTE_PAGE_SIZE));
  const rootRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const [activeDrawer, setActiveDrawer] = useState<VisualDrawerId | null>(null);
  const selectedLayer = frame.layers.find((layer) => layer.id === selectedLayerId) ?? defaultLayer;
  const selectedField = selectedLayer?.fields.find((field) => field.id === selectedFieldId) ?? null;
  const pageCount = Math.max(1, Math.ceil(frame.record.bytes.length / BYTE_PAGE_SIZE));
  const safePage = Math.max(0, Math.min(pageCount - 1, bytePage));
  const byteStart = safePage * BYTE_PAGE_SIZE;
  const visibleBytes = useMemo(
    () => frame.record.bytes.copy(byteStart, Math.min(BYTE_PAGE_SIZE, frame.record.bytes.length - byteStart)),
    [byteStart, frame],
  );

  useEffect(() => {
    if (!selectedLayer) return;
    if (selectedFieldId && selectedLayer.fields.some((field) => field.id === selectedFieldId)) return;
    setSelectedFieldId(selectedLayer.fields[0]?.id ?? null);
  }, [selectedField, selectedFieldId, selectedLayer]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || reduceMotion) return;
    const highlighted = root.querySelectorAll('.packet-byte.highlighted');
    if (highlighted.length === 0) return;
    const animation = animate(highlighted, {
      opacity: [0.32, 1],
      scale: [0.78, 1],
      delay: stagger(8),
      duration: 360,
      ease: 'outExpo',
    });
    return () => {
      animation.cancel();
    };
  }, [reduceMotion, safePage, selectedFieldId]);

  const chooseLayer = (layer: CapturedLayer) => {
    setSelectedLayerId(layer.id);
    setSelectedFieldId(layer.fields[0]?.id ?? null);
    setBytePage(Math.floor(layer.byteRange.offset / BYTE_PAGE_SIZE));
  };

  const chooseField = (field: CapturedField) => {
    setSelectedFieldId(field.id);
    const firstRange = field.byteRanges[0];
    if (firstRange) setBytePage(Math.floor(firstRange.offset / BYTE_PAGE_SIZE));
  };

  const byteEnd = byteStart + visibleBytes.length;

  const toggleDrawer = (id: VisualDrawerId) => setActiveDrawer((current) => current === id ? null : id);
  const drawers: VisualDrawerDefinition[] = [
    {
      id: 'inspect',
      label: 'Inspect',
      eyebrow: selectedLayer ? `${layerKicker(selectedLayer)} · ${selectedLayer.status.toUpperCase()}` : 'Captured structure',
      title: selectedField?.label ?? selectedLayer?.label ?? 'No decoded layer',
      content: <div className="packet-inspector packet-drawer-panel">
        {selectedLayer ? <>
          <div className="packet-inspector-title"><div><span>{layerKicker(selectedLayer)} · {selectedLayer.status.toUpperCase()}</span><strong>{selectedLayer.label}</strong></div><small>BYTES {selectedLayer.byteRange.offset}–{selectedLayer.byteRange.offset + Math.max(0, selectedLayer.byteRange.length - 1)}</small></div>
          <div className="packet-field-list">{selectedLayer.fields.map((field) => <button key={field.id} type="button" className={field.id === selectedField?.id ? 'active' : ''} onClick={() => chooseField(field)}><span>{field.label}</span><strong>{field.displayValue}</strong><small>CAPTURED</small></button>)}{selectedLayer.fields.length === 0 && <p className="packet-empty-fields">No bounded fields decoded for this captured layer.</p>}</div>
          <AnimatePresence mode="wait" initial={false}>{selectedField && <motion.div key={`${selectedLayer.id}-${selectedField.id}`} className="packet-field-detail" initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: 0.22 }}><span>FIELD → CAPTURED BYTES</span><h2>{selectedField.label}</h2><strong>{selectedField.displayValue}</strong><p>{selectedField.byteRanges.map((range) => `${range.offset}–${range.offset + Math.max(0, range.length - 1)}`).join(', ') || 'No direct byte range.'}</p>{selectedField.note && <p>{selectedField.note}</p>}</motion.div>}</AnimatePresence>
        </> : <div className="packet-empty-inspector"><span>UNSUPPORTED LINK TYPE</span><p>No Ethernet interpretation was attempted. Raw captured bytes remain inspectable.</p></div>}
      </div>,
    },
    {
      id: 'tools',
      label: 'Layers',
      eyebrow: 'Bounded decoder output',
      title: `${frame.layers.length} captured layers`,
      content: <div className="packet-layer-drawer">{frame.layers.map((layer) => <button key={layer.id} type="button" className={selectedLayer?.id === layer.id ? 'active' : ''} onClick={() => chooseLayer(layer)}><span>{layerKicker(layer)} · {layer.status.toUpperCase()}</span><strong>{layer.label}</strong><small>BYTES {layer.byteRange.offset}–{layer.byteRange.offset + Math.max(0, layer.byteRange.length - 1)}</small></button>)}{frame.layers.length === 0 && <p>Raw bytes are preserved even though this link type was not decoded.</p>}</div>,
    },
    {
      id: 'evidence',
      label: 'Evidence',
      eyebrow: 'Immutable capture',
      title: 'Captured · read only',
      content: <div className="packet-model-drawer">
        <div className="packet-readonly-note"><div><span>EVIDENCE BOUNDARY</span><strong>CAPTURED BYTES NEVER CHANGE</strong></div><p>Selection only changes focus. HOPSCOTCH does not recompute, repair, decrypt, or invent this frame.</p></div>
        <div className="packet-evidence-ledger"><div><span>CAPTURE SOURCE</span><strong>{origin?.label ?? `FRAME ${frame.record.number}`}</strong></div><div><span>CAPTURE TIME</span><strong>{origin?.timestamp ?? formatRelativeTime(frame.record.relativeTimeNanoseconds)}</strong></div><div><span>CAPTURED / WIRE</span><strong>{frame.record.capturedLength} B / {frame.record.originalLength} B</strong></div><div><span>BOUNDARY</span><strong>{frame.record.truncated ? 'SNAPLEN TRUNCATED' : 'COMPLETE RECORD'}</strong></div></div>
        <div className="packet-causality-note"><span>CAPTURE LIMIT</span><p>{frame.record.truncated ? 'This frame is snaplen-truncated. Missing bytes are unknown and are never fabricated.' : 'This view describes one capture vantage point. Path, unseen packets, and encrypted content remain unknown.'}</p></div>
      </div>,
    },
  ];

  return (
    <div
      ref={rootRef}
      className="packet-microscope packet-microscope-captured packet-world-root"
      data-packet-provenance="CAPTURED"
    >
      <VisualWorkspaceShell
        className="packet-visual-workspace interactive-world-workspace captured-packet-workspace"
        entrance={{ eyebrow: 'Packet evidence · immutable frame', title: 'ONE CAPTURE.', accentTitle: 'EXACT BYTES.', subtitle: 'Every decoded field remains anchored to immutable captured bytes.' }}
        stageLabel="Captured packet specimen and exact byte evidence"
        activeDrawer={activeDrawer}
        drawers={drawers}
        onCloseDrawer={() => setActiveDrawer(null)}
        timeline={null}
        toolbar={<><div className="interactive-world-toolbar__identity"><span>Packet evidence</span><strong>Frame {frame.record.number} · {frame.record.capturedLength} captured bytes</strong></div><VisualDrawerTabs active={activeDrawer} items={[{ id: 'inspect', label: 'Inspect', badge: selectedField ? '1' : '0' }, { id: 'tools', label: 'Layers', badge: String(frame.layers.length) }, { id: 'evidence', label: 'Evidence' }]} onSelect={toggleDrawer} /><div className="interactive-world-toolbar__actions">{onOpenSourceEvent && <button type="button" onClick={onOpenSourceEvent}>{origin?.actionLabel ?? 'Return to capture ↗'}</button>}<button type="button" onClick={onExit}>Exit</button></div></>}
        hud={<div className="interactive-world-hud packet-stage-hud"><div><span>FRAME</span><strong>{frame.record.number}</strong></div><div><span>CAPTURED</span><strong>{frame.record.capturedLength} BYTES</strong></div><div><span>LAYERS</span><strong>{frame.layers.length}</strong></div><div><span>FIELD</span><strong>{selectedField?.label ?? '—'}</strong></div><div className="interactive-world-hud__truth"><span>PROVENANCE</span><strong>CAPTURED · READ ONLY</strong></div></div>}
      >
      <div className="packet-stage">
        <section className="captured-microscope-mechanism-stage" aria-label="Exploded captured frame specimen">
          <motion.div className="captured-microscope-annotation captured-microscope-annotation--source" initial={reduceMotion ? false : { opacity: 0, x: -18 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: reduceMotion ? 0 : .5, delay: reduceMotion ? 0 : .12 }}>
            <span>CAPTURE SOURCE</span>
            <strong>{origin?.label ?? `FRAME ${frame.record.number}`}</strong>
          </motion.div>
          <motion.div className="captured-microscope-annotation captured-microscope-annotation--time" initial={reduceMotion ? false : { opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: reduceMotion ? 0 : .5, delay: reduceMotion ? 0 : .18 }}>
            <span>CAPTURE TIME</span>
            <strong>{origin?.timestamp ?? formatRelativeTime(frame.record.relativeTimeNanoseconds)}</strong>
          </motion.div>
          <CapturedFrameMechanism
            frame={frame}
            event={null}
            mode="microscope"
            activeLayer={selectedLayer}
            activeField={selectedField}
            handoffId={`captured-frame-${frame.record.id}`}
            onSelectLayer={chooseLayer}
          />
          <div className="captured-microscope-annotation captured-microscope-annotation--boundary">
            <span>EVIDENCE BOUNDARY</span>
            <strong>{frame.record.truncated ? 'SNAPLEN ENDS HERE · MISSING BYTES UNKNOWN' : 'COMPLETE CAPTURE RECORD · PATH STILL UNKNOWN'}</strong>
          </div>
        </section>

        <section className="captured-byte-workbench" aria-label="Exact captured byte evidence">
          <div className="packet-hex-panel">
            <div className="packet-panel-heading">
              <div><span>RAW CAPTURED FRAME</span><strong>SELECT A FIELD TO REVEAL ITS EXACT SOURCE BYTES</strong></div>
              <div className="packet-byte-pagination">
                <button type="button" disabled={safePage === 0} onClick={() => setBytePage((page) => Math.max(0, page - 1))}>PREV</button>
                <span>{byteStart}–{Math.max(byteStart, byteEnd - 1)} / {frame.record.bytes.length}</span>
                <button type="button" disabled={safePage === pageCount - 1} onClick={() => setBytePage((page) => Math.min(pageCount - 1, page + 1))}>NEXT</button>
              </div>
            </div>
            <div className="packet-hex-grid" aria-label={`Captured frame bytes ${byteStart} through ${Math.max(byteStart, byteEnd - 1)}`}>
              {Array.from(visibleBytes, (byte, pageIndex) => {
                const byteOffset = byteStart + pageIndex;
                const category = visualLayer(frame.layers.find((layer) => byteOffset >= layer.byteRange.offset && byteOffset < layer.byteRange.offset + layer.byteRange.length)?.protocol ?? 'unknown');
                return (
                  <span
                    key={byteOffset}
                    className={`packet-byte byte-${category}${selectedField && includesByte(selectedField.byteRanges, byteOffset) ? ' highlighted' : ''}`}
                    title={`frame byte ${byteOffset}`}
                  >
                    {hexByte(byte)}
                  </span>
                );
              })}
            </div>
          </div>
          <article className="packet-field-lens captured-field-lens">
            <span>{selectedLayer ? `${layerKicker(selectedLayer)} · ${selectedLayer.label}` : 'RAW CAPTURE'} · FIELD EVIDENCE</span>
            <strong>{selectedField?.label ?? 'SELECT A FIELD'}</strong>
            <p>{selectedField ? `${selectedField.displayValue} · CAPTURED BYTES ${selectedField.byteRanges.map((range) => `${range.offset}–${range.offset + Math.max(0, range.length - 1)}`).join(', ') || 'NO DIRECT RANGE'}` : 'Open Inspect to trace decoded structure to immutable bytes.'}</p>
            <button type="button" onClick={() => setActiveDrawer('inspect')}>INSPECT EVIDENCE ↗</button>
          </article>
        </section>
      </div>
      </VisualWorkspaceShell>
    </div>
  );
}
