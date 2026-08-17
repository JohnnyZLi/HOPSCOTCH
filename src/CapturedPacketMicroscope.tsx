import { animate, stagger } from 'animejs';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ByteRange, CapturedField, CapturedFrameEvidence, CapturedLayer, CapturedLayerProtocol } from './capture/types.ts';

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
  const rootRef = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();
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
    return () => animation.cancel();
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

  return (
    <motion.section
      ref={rootRef}
      className="packet-microscope packet-microscope-captured"
      data-packet-provenance="CAPTURED"
      initial={reduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.985 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 1.015 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
    >
      <header className="packet-heading">
        <div>
          <p className="eyebrow">Track T · Captured packet microscope</p>
          <h1>PEEL THE EVIDENCE.<br /><span>FOLLOW IT TO BYTES.</span></h1>
        </div>
        <div className="packet-heading-actions">
          <span className="packet-captured-badge">CAPTURED · READ ONLY</span>
          <button type="button" className="lab-mode" onClick={onExit}>EXIT LAB</button>
        </div>
      </header>

      <div className="packet-stage">
        <div className="packet-origin-strip">
          <div>
            <span>CAPTURE SOURCE</span>
            <strong>{origin?.label ?? `FRAME ${frame.record.number}`}</strong>
          </div>
          <div>
            <span>CAPTURE TIME</span>
            <strong>{origin?.timestamp ?? formatRelativeTime(frame.record.relativeTimeNanoseconds)}</strong>
          </div>
          {onOpenSourceEvent && <button type="button" onClick={onOpenSourceEvent}>{origin?.actionLabel ?? 'RETURN TO CAPTURE ↗'}</button>}
        </div>

        <div className="packet-object-wrap">
          <div className="packet-object-labels">
            <span>IMMUTABLE FRAME {frame.record.number}</span>
            <strong>{frame.record.capturedLength} CAPTURED B · {frame.record.originalLength} WIRE B{frame.record.truncated ? ' · TRUNCATED' : ''}</strong>
          </div>
          {frame.layers.length > 0 ? (
            <div className="packet-object packet-captured-layers" role="group" aria-label="Captured protocol layers">
              {frame.layers.map((layer) => (
                <motion.button
                  layout
                  key={layer.id}
                  type="button"
                  className={`packet-layer-shell layer-${visualLayer(layer.protocol)}${selectedLayer?.id === layer.id ? ' active' : ''}${layer.status !== 'complete' ? ` status-${layer.status}` : ''}`}
                  onClick={() => chooseLayer(layer)}
                  animate={reduceMotion ? undefined : { y: selectedLayer?.id === layer.id ? -11 : 0, scale: selectedLayer?.id === layer.id ? 1.018 : 1 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 31 }}
                  style={{ flexGrow: Math.max(1, Math.log2(layer.byteRange.length + 1)) }}
                >
                  <span>{layerKicker(layer)}</span>
                  <strong>{layer.label}</strong>
                  <small>{layer.byteRange.length} B · {layer.status.toUpperCase()}</small>
                </motion.button>
              ))}
            </div>
          ) : (
            <div className="packet-undecoded">NO SUPPORTED PROTOCOL LAYER WAS DECODED. THE CAPTURED BYTES REMAIN AVAILABLE BELOW.</div>
          )}
        </div>

        <div className="packet-relations">
          <div><span>CAPTURED BYTES</span><strong>{frame.record.capturedLength}</strong><small>Bytes present in this immutable frame.</small></div>
          <div><span>ORIGINAL WIRE LENGTH</span><strong>{frame.record.originalLength}</strong><small>{frame.record.truncated ? 'Capture contains fewer bytes than the reported wire frame.' : 'Reported wire length matches captured length.'}</small></div>
          <div><span>DECODED LAYERS</span><strong>{frame.layers.length}</strong><small>Only directly captured, bounded protocol structure.</small></div>
          <div><span>DECODER ISSUES</span><strong>{frame.issues.length}</strong><small>{frame.issues[0] ?? 'No decoder limitation recorded for this frame.'}</small></div>
        </div>

        <div className="packet-readonly-note">
          <div><span>EVIDENCE BOUNDARY</span><strong>CAPTURED BYTES NEVER CHANGE</strong></div>
          <p>Selection only changes focus. HOPSCOTCH does not recompute, repair, decrypt, or invent this frame.</p>
        </div>

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
      </div>

      <aside className="packet-inspector">
        {selectedLayer ? (
          <>
            <div className="packet-inspector-title">
              <div><span>{layerKicker(selectedLayer)} · {selectedLayer.status.toUpperCase()}</span><strong>{selectedLayer.label}</strong></div>
              <small>BYTES {selectedLayer.byteRange.offset}–{selectedLayer.byteRange.offset + Math.max(0, selectedLayer.byteRange.length - 1)}</small>
            </div>
            <div className="packet-field-list">
              {selectedLayer.fields.map((field) => (
                <button key={field.id} type="button" className={field.id === selectedField?.id ? 'active' : ''} onClick={() => chooseField(field)}>
                  <span>{field.label}</span><strong>{field.displayValue}</strong><small>CAPTURED</small>
                </button>
              ))}
              {selectedLayer.fields.length === 0 && <p className="packet-empty-fields">No bounded fields decoded for this captured layer.</p>}
            </div>
            <AnimatePresence mode="wait" initial={false}>
              {selectedField && (
                <motion.div
                  key={`${selectedLayer.id}-${selectedField.id}`}
                  className="packet-field-detail"
                  initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.22 }}
                >
                  <span>FIELD → CAPTURED BYTES</span>
                  <h2>{selectedField.label}</h2>
                  <strong>{selectedField.displayValue}</strong>
                  <p>{selectedField.byteRanges.map((range) => `${range.offset}–${range.offset + Math.max(0, range.length - 1)}`).join(', ') || 'No direct byte range.'}</p>
                  {selectedField.note && <p>{selectedField.note}</p>}
                </motion.div>
              )}
            </AnimatePresence>
            <div className="packet-causality-note">
              <span>CAPTURE LIMIT</span>
              <p>{frame.record.truncated ? 'This frame is snaplen-truncated. Missing bytes are unknown and are never fabricated.' : 'This view describes one capture vantage point. Path, unseen packets, and encrypted content remain unknown.'}</p>
            </div>
          </>
        ) : (
          <div className="packet-empty-inspector"><span>UNSUPPORTED LINK TYPE</span><p>No Ethernet interpretation was attempted. Raw captured bytes remain inspectable.</p></div>
        )}
      </aside>
    </motion.section>
  );
}
