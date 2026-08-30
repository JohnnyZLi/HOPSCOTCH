import { motion, useReducedMotion } from 'motion/react';
import type { CSSProperties } from 'react';
import type { PacketField, PacketLayerId, PacketSegment, PacketSnapshot } from './packet/model.ts';
import './SimulatedPacketMechanism.css';

const layerKickers: Record<PacketLayerId, string> = {
  ethernet: 'L2',
  network: 'L3',
  transport: 'L4',
  payload: 'DATA',
};

function hexByte(byte: number): string {
  return byte.toString(16).padStart(2, '0').toUpperCase();
}

function fieldRange(segment: PacketSegment, field: PacketField | null): { start: number; end: number } | null {
  if (!field || field.length === 0) return null;
  const start = segment.offset + field.offset;
  return { start, end: start + field.length };
}

function byteWindow(snapshot: PacketSnapshot, focusOffset: number, count: number): ReadonlyArray<{ offset: number; value: number; layer: PacketLayerId }> {
  const maximumStart = Math.max(0, snapshot.bytes.length - count);
  const start = Math.max(0, Math.min(maximumStart, focusOffset - Math.floor(count * .3)));
  return snapshot.bytes.slice(start, start + count).map((value, index) => {
    const offset = start + index;
    const layer = snapshot.segments.find((segment) => offset >= segment.offset && offset < segment.offset + segment.length)?.id ?? 'payload';
    return { offset, value, layer };
  });
}

export function SimulatedPacketMechanism({
  snapshot,
  selectedLayer,
  selectedField,
  onSelectLayer,
}: {
  snapshot: PacketSnapshot;
  selectedLayer: PacketLayerId;
  selectedField: PacketField | null;
  onSelectLayer: (layer: PacketSegment) => void;
}) {
  const reduceMotion = useReducedMotion();
  const selectedSegment = snapshot.segments.find((segment) => segment.id === selectedLayer) ?? snapshot.segments[0];
  const range = fieldRange(selectedSegment, selectedField);
  const bytes = byteWindow(snapshot, range?.start ?? selectedSegment.offset, 48);
  const signature = `${snapshot.config.family}-${snapshot.config.transport}-${snapshot.payloadBytes}-${snapshot.config.ttl}-${snapshot.transportChecksum}`;
  const networkLength = snapshot.config.family === 'ipv4' ? snapshot.networkBytes : snapshot.transportBytes;

  return (
    <motion.div
      className={`simulated-packet-mechanism${reduceMotion ? ' reduce-motion' : ''}`}
      data-simulated-packet-mechanism="true"
      data-network-family={snapshot.config.family}
      data-transport={snapshot.config.transport}
      data-selected-layer={selectedLayer}
      aria-label={`Simulated ${snapshot.config.family.toUpperCase()} ${snapshot.config.transport.toUpperCase()} packet: ${snapshot.frameBytes} frame bytes.`}
      initial={reduceMotion ? false : { opacity: 0, scale: .91, rotate: -1.4 }}
      animate={{ opacity: 1, scale: 1, rotate: 0 }}
      transition={{ duration: reduceMotion ? 0 : .62, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="simulated-packet-mechanism__object">
        <div className="simulated-packet-axis" aria-hidden="true"><i /><i /><i /><i /><i /></div>
        <div className="simulated-packet-orbits" aria-hidden="true"><i /><i /><i /></div>

        <motion.div
          key={signature}
          className="simulated-packet-assembly"
          data-recomputed-signature={signature}
          initial={reduceMotion ? false : { opacity: .56, filter: 'blur(5px)', scale: .94 }}
          animate={{ opacity: 1, filter: 'blur(0px)', scale: 1 }}
          transition={{ duration: reduceMotion ? 0 : .56, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="simulated-packet-scan" aria-hidden="true" />
          {snapshot.segments.map((segment, index) => (
            <motion.button
              type="button"
              key={segment.id}
              className={`simulated-packet-layer simulated-packet-layer--${segment.id}${segment.id === selectedLayer ? ' is-active' : ''}`}
              data-layer={segment.id}
              aria-pressed={segment.id === selectedLayer}
              onClick={() => onSelectLayer(segment)}
              style={{ '--layer-index': index, '--layer-ratio': Math.min(1, segment.length / snapshot.frameBytes) } as CSSProperties}
              animate={reduceMotion ? undefined : {
                y: segment.id === selectedLayer ? -5 : 0,
                scale: segment.id === selectedLayer ? 1.025 : 1,
              }}
              transition={{ type: 'spring', stiffness: 390, damping: 29 }}
            >
              <span>{layerKickers[segment.id]}</span>
              <strong>{segment.label}</strong>
              <small>{segment.length} B</small>
              <i aria-hidden="true" />
            </motion.button>
          ))}

          <div className="simulated-packet-core" aria-hidden="true">
            <span>APPLICATION DATA</span>
            <strong>HOPSCOTCH / RECOVERY</strong>
            <small>{snapshot.payloadBytes} deterministic bytes</small>
          </div>

          <svg className="simulated-packet-dependencies" viewBox="0 0 1000 300" preserveAspectRatio="none" aria-hidden="true">
            <path className="dependency-path dependency-path--length" d="M90 236 C236 236 228 55 430 55 S690 82 784 82" />
            <path className="dependency-path dependency-path--transport" d="M90 236 C260 236 326 160 516 160 S682 222 892 222" />
            {snapshot.networkChecksum !== null && <path className="dependency-path dependency-path--network" d="M430 55 C594 55 596 126 784 126" />}
          </svg>
          <div className="simulated-packet-particle simulated-packet-particle--length" aria-hidden="true" />
          <div className="simulated-packet-particle simulated-packet-particle--transport" aria-hidden="true" />

          <div className="simulated-packet-dependency simulated-packet-dependency--input">
            <span>INPUT</span><strong>{snapshot.payloadBytes} B</strong><small>payload</small>
          </div>
          <div className="simulated-packet-dependency simulated-packet-dependency--length">
            <span>{snapshot.config.family === 'ipv4' ? 'TOTAL LENGTH' : 'PAYLOAD LENGTH'}</span><strong className="simulated-packet-relation">{networkLength}</strong><small>recomputed</small>
          </div>
          <div className="simulated-packet-dependency simulated-packet-dependency--network">
            <span>NETWORK CHECK</span><strong className="simulated-packet-relation">{snapshot.networkChecksum === null ? 'REMOVED' : `0x${snapshot.networkChecksum.toString(16).padStart(4, '0').toUpperCase()}`}</strong><small>{snapshot.config.family.toUpperCase()}</small>
          </div>
          <div className="simulated-packet-dependency simulated-packet-dependency--transport">
            <span>{snapshot.config.transport.toUpperCase()} CHECK</span><strong className="simulated-packet-relation">0x{snapshot.transportChecksum.toString(16).padStart(4, '0').toUpperCase()}</strong><small>pseudo-header + data</small>
          </div>
        </motion.div>

        <div className="simulated-packet-byte-rail" role="img" aria-label={`Visible generated bytes: ${bytes.map((byte) => `${byte.offset}:${hexByte(byte.value)}`).join(' ')}`}>
          {bytes.map((byte, index) => {
            const highlighted = range ? byte.offset >= range.start && byte.offset < range.end : false;
            return (
              <i
                key={byte.offset}
                className={`simulated-packet-byte is-${byte.layer}${highlighted ? ' is-highlighted' : ''}${byte.layer === 'network' || byte.layer === 'transport' ? ' is-derived' : ''}`}
                data-byte-offset={byte.offset}
                style={{ '--byte-index': index, '--byte-value': byte.value / 255 } as CSSProperties}
              ><span>{hexByte(byte.value)}</span></i>
            );
          })}
        </div>
      </div>

      <div className="simulated-packet-mechanism__readout">
        <span>SIMULATED · RECOMPUTED</span>
        <strong>{snapshot.frameBytes} BYTE FRAME</strong>
        <p>{snapshot.config.family.toUpperCase()} wraps {snapshot.config.transport.toUpperCase()}, which wraps {snapshot.payloadBytes} bytes of deterministic application data.</p>
        <dl>
          <div><dt>SELECTED</dt><dd>{selectedSegment.label}</dd></div>
          <div><dt>FIELD</dt><dd>{selectedField?.label ?? 'Layer boundary'}</dd></div>
          <div><dt>RANGE</dt><dd>{range ? `${range.start}–${range.end - 1}` : `${selectedSegment.offset}–${selectedSegment.offset + selectedSegment.length - 1}`}</dd></div>
        </dl>
        <small>Configuration changes regenerate this exact frame. Selection changes focus only.</small>
      </div>
    </motion.div>
  );
}
