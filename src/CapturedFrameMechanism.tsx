import { motion, useReducedMotion } from 'motion/react';
import type { CSSProperties } from 'react';
import type { CapturedField, CapturedFrameEvidence, CapturedLayer, SemanticCapturedEvent } from './capture/types.ts';
import './CapturedFrameMechanism.css';

type FrameMechanismMode = 'replay' | 'frame';

function layerTone(protocol: string): string {
  if (protocol === 'ethernet') return 'link';
  if (protocol === 'ipv4' || protocol === 'ipv6') return 'network';
  if (protocol === 'tcp' || protocol === 'udp') return 'transport';
  if (protocol === 'dns' || protocol === 'tls') return 'application';
  return 'evidence';
}

function byteSample(frame: CapturedFrameEvidence, count: number): readonly number[] {
  return Array.from(frame.record.bytes.copy(0, Math.min(count, frame.record.bytes.length)));
}

function fieldRange(field: CapturedField | null): { start: number; end: number } | null {
  const first = field?.byteRanges[0];
  if (!first) return null;
  return { start: first.offset, end: first.offset + first.length };
}

export function CapturedFrameMechanism({
  frame,
  event,
  mode,
  playing = false,
  activeLayer,
  activeField,
  onSelectLayer,
}: {
  frame: CapturedFrameEvidence;
  event: SemanticCapturedEvent | null;
  mode: FrameMechanismMode;
  playing?: boolean;
  activeLayer: CapturedLayer | null;
  activeField: CapturedField | null;
  onSelectLayer?: (layer: CapturedLayer) => void;
}) {
  const reduceMotion = useReducedMotion();
  const bytes = byteSample(frame, mode === 'frame' ? 32 : 18);
  const selectedRange = fieldRange(activeField);
  const direction = event?.direction ?? 'UNKNOWN';
  const frameLength = Math.max(1, frame.record.bytes.length);

  return (
    <motion.div
      className="captured-frame-mechanism"
      data-frame-mechanism
      data-mechanism-mode={mode}
      data-direction={direction}
      data-playing={playing ? 'true' : 'false'}
      data-truncated={frame.record.truncated ? 'true' : 'false'}
      role={mode === 'frame' ? 'group' : 'img'}
      aria-label={`Captured frame ${frame.record.number}: ${frame.layers.map((layer) => layer.label).join(', ')}. ${frame.record.capturedLength} captured bytes.`}
      initial={reduceMotion ? false : { opacity: 0, scale: 0.86, rotate: direction === 'A_TO_B' ? -5 : direction === 'B_TO_A' ? 5 : 0 }}
      animate={{ opacity: 1, scale: 1, rotate: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.46, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="captured-frame-mechanism__axis" aria-hidden="true"><i /><i /><i /></div>
      <div className="captured-frame-mechanism__object">
        <div className="captured-frame-mechanism__halo" aria-hidden="true" />
        <div className="captured-frame-mechanism__plates">
          {frame.layers.map((layer, index) => {
            const active = layer.id === activeLayer?.id;
            const offset = Math.min(84, Math.round((layer.byteRange.offset / frameLength) * 100));
            const length = Math.max(8, Math.round((layer.byteRange.length / frameLength) * 100));
            const style = {
              '--layer-index': index,
              '--layer-count': frame.layers.length,
              '--layer-offset': `${offset}%`,
              '--layer-length': `${Math.min(100 - offset, length)}%`,
            } as CSSProperties;
            const content = <>
              <i aria-hidden="true" />
              <span>{layer.protocol.toUpperCase()}</span>
              <strong>{layer.label}</strong>
              <small>{layer.byteRange.offset}–{layer.byteRange.offset + Math.max(0, layer.byteRange.length - 1)} · {layer.fields.length} fields</small>
            </>;
            return mode === 'frame' ? (
              <motion.button
                type="button"
                key={layer.id}
                className={active ? 'is-active' : ''}
                data-layer-tone={layerTone(layer.protocol)}
                style={style}
                onClick={() => onSelectLayer?.(layer)}
                aria-pressed={active}
                initial={reduceMotion ? false : { x: 0, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: reduceMotion ? 0 : 0.38, delay: reduceMotion ? 0 : index * 0.045, ease: [0.16, 1, 0.3, 1] }}
              >{content}</motion.button>
            ) : (
              <motion.div
                key={layer.id}
                className={active ? 'is-active' : ''}
                data-layer-tone={layerTone(layer.protocol)}
                style={style}
                initial={reduceMotion ? false : { x: direction === 'A_TO_B' ? -18 : direction === 'B_TO_A' ? 18 : 0, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: reduceMotion ? 0 : 0.34, delay: reduceMotion ? 0 : index * 0.035 }}
              >{content}</motion.div>
            );
          })}
        </div>
        <div className="captured-frame-mechanism__core">
          <span>FRAME</span>
          <strong>{String(frame.record.number).padStart(3, '0')}</strong>
          <small>{frame.record.capturedLength} B</small>
        </div>
        <div className="captured-frame-mechanism__bytes" role="img" aria-label={`Opening captured bytes: ${bytes.map((byte) => byte.toString(16).padStart(2, '0')).join(' ')}`}>
          {bytes.map((byte, index) => {
            const highlighted = selectedRange ? index >= selectedRange.start && index < selectedRange.end : false;
            return <i className={highlighted ? 'is-highlighted' : ''} key={index} style={{ '--byte-index': index, '--byte-value': byte / 255 } as CSSProperties}><span>{byte.toString(16).padStart(2, '0').toUpperCase()}</span></i>;
          })}
        </div>
      </div>
      <div className="captured-frame-mechanism__readout">
        <span>{mode === 'replay' ? (event?.provenance ?? 'CAPTURED') : 'IMMUTABLE CAPTURE'}</span>
        <strong>{mode === 'replay' ? (event?.title ?? `FRAME ${frame.record.number}`) : `${frame.layers.length} PARSED LAYERS · ${frame.record.capturedLength} / ${frame.record.originalLength} B`}</strong>
        <small>{mode === 'replay' ? `${event ? direction.replaceAll('_', ' ') : 'NO SEMANTIC DIRECTION'} · exact frame ${frame.record.number}` : activeField ? `${activeLayer?.label ?? 'Frame'} → ${activeField.label} → exact byte range` : 'Layer selection changes focus only'}</small>
      </div>
    </motion.div>
  );
}
