import { animate, stagger } from 'animejs';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { CapturedFrameEvidence } from './capture/types.ts';
import {
  VisualDrawerTabs,
  VisualWorkspaceShell,
  type VisualDrawerDefinition,
  type VisualDrawerId,
} from './VisualWorkspace';
import './packet.css';
import './packet.phase3.css';
import './PacketMicroscopeEditorialLight.css';
import {
  buildPacket,
  defaultPacketConfig,
  hex16,
  type NetworkFamily,
  type PacketConfig,
  type PacketField,
  type PacketLayerId,
  type TransportProtocol,
} from './packet/model';

const CapturedPacketMicroscope = lazy(() => import('./CapturedPacketMicroscope.tsx').then((module) => ({ default: module.CapturedPacketMicroscope })));

const layerKickers: Record<PacketLayerId, string> = {
  ethernet: 'L2',
  network: 'L3',
  transport: 'L4',
  payload: 'DATA',
};

function hexByte(byte: number): string {
  return byte.toString(16).padStart(2, '0').toUpperCase();
}

function byteInField(index: number, segmentOffset: number, field: PacketField | null): boolean {
  if (!field || field.length === 0) return false;
  const start = segmentOffset + field.offset;
  return index >= start && index < start + field.length;
}

type PacketMicroscopeProps = {
  onExit: () => void;
  onOpenSourceEvent?: () => void;
  initialConfig?: Partial<PacketConfig>;
  origin?: { label: string; timestamp?: string; actionLabel?: string };
  capturedFrame?: CapturedFrameEvidence;
};

export function PacketMicroscope(props: PacketMicroscopeProps) {
  if (props.capturedFrame) {
    return (
      <Suspense fallback={<section className="packet-captured-loading" aria-live="polite">LOADING CAPTURED FRAME…</section>}>
        <CapturedPacketMicroscope
          frame={props.capturedFrame}
          onExit={props.onExit}
          onOpenSourceEvent={props.onOpenSourceEvent}
          origin={props.origin}
        />
      </Suspense>
    );
  }
  return <SimulatedPacketMicroscope {...props} />;
}

function SimulatedPacketMicroscope({
  onExit,
  onOpenSourceEvent,
  initialConfig,
  origin,
}: PacketMicroscopeProps) {
  const [config, setConfig] = useState<PacketConfig>(() => ({ ...defaultPacketConfig, ...initialConfig }));
  const [selectedLayer, setSelectedLayer] = useState<PacketLayerId>('network');
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>('ip-length');
  const rootRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const [activeDrawer, setActiveDrawer] = useState<VisualDrawerId | null>(null);
  const snapshot = useMemo(() => buildPacket(config), [config]);
  const selectedSegment = snapshot.segments.find((segment) => segment.id === selectedLayer) ?? snapshot.segments[0];
  const selectedField = selectedSegment.fields.find((field) => field.id === selectedFieldId) ?? null;
  const networkSegment = snapshot.segments.find((segment) => segment.id === 'network') ?? snapshot.segments[0];
  const transportSegment = snapshot.segments.find((segment) => segment.id === 'transport') ?? snapshot.segments[0];
  const sourceAddress = networkSegment.fields.find((field) => field.id === 'ip-src' || field.id === 'ip6-src')?.value ?? 'SOURCE UNKNOWN';
  const destinationAddress = networkSegment.fields.find((field) => field.id === 'ip-dst' || field.id === 'ip6-dst')?.value ?? 'DESTINATION UNKNOWN';

  useEffect(() => {
    if (selectedFieldId && selectedSegment.fields.some((field) => field.id === selectedFieldId)) return;
    setSelectedFieldId(selectedSegment.fields[0]?.id ?? null);
  }, [selectedFieldId, selectedSegment]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || reduceMotion) return;

    const bytes = root.querySelectorAll('.packet-byte.is-derived-zone');
    const relations = root.querySelectorAll('.packet-relation-value');
    const animations: Array<ReturnType<typeof animate>> = [];

    if (bytes.length > 0) {
      animations.push(
        animate(bytes, {
          opacity: [0.28, 1],
          scale: [0.72, 1],
          delay: stagger(2.2),
          duration: 430,
          ease: 'outExpo',
        }),
      );
    }

    if (relations.length > 0) {
      animations.push(
        animate(relations, {
          translateY: [7, 0],
          opacity: [0.35, 1],
          delay: stagger(45),
          duration: 480,
          ease: 'outExpo',
        }),
      );
    }

    return () => {
      animations.forEach((animation) => animation.cancel());
    };
  }, [config.family, config.payloadBytes, config.transport, config.ttl, reduceMotion]);

  const patchConfig = <K extends keyof PacketConfig>(key: K, value: PacketConfig[K]) => {
    setConfig((current) => ({ ...current, [key]: value }));
  };

  const chooseFamily = (family: NetworkFamily) => {
    patchConfig('family', family);
    setSelectedLayer('network');
    setSelectedFieldId(family === 'ipv4' ? 'ip-checksum' : 'ip6-checksum');
  };

  const chooseTransport = (transport: TransportProtocol) => {
    patchConfig('transport', transport);
    setSelectedLayer('transport');
    setSelectedFieldId(transport === 'tcp' ? 'tcp-checksum' : transport === 'udp' ? 'udp-checksum' : 'icmp-checksum');
  };

  const toggleDrawer = (id: VisualDrawerId) => setActiveDrawer((current) => current === id ? null : id);
  const drawers: VisualDrawerDefinition[] = [
    {
      id: 'inspect',
      label: 'Inspect',
      eyebrow: `${layerKickers[selectedSegment.id]} · ${selectedSegment.label}`,
      title: selectedField?.label ?? 'Select a field',
      content: <div className="packet-inspector packet-drawer-panel">
        <div className="packet-inspector-title"><div><span>{layerKickers[selectedSegment.id]}</span><strong>{selectedSegment.label}</strong></div><small>BYTES {selectedSegment.offset}–{selectedSegment.offset + selectedSegment.length - 1}</small></div>
        <div className="packet-field-list">{selectedSegment.fields.map((field) => <button key={field.id} type="button" className={field.id === selectedField?.id ? 'active' : ''} onClick={() => setSelectedFieldId(field.id)}><span>{field.label}</span><strong>{field.value}</strong>{field.derived && <small>DERIVED</small>}</button>)}</div>
        <AnimatePresence mode="wait" initial={false}>{selectedField && <motion.div key={`${selectedSegment.id}-${selectedField.id}-${selectedField.value}`} className="packet-field-detail" initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: 0.22 }}><span>FIELD TRACE</span><h2>{selectedField.label}</h2><strong>{selectedField.value}</strong>{selectedField.length > 0 && <p>Maps to {selectedField.length} byte{selectedField.length === 1 ? '' : 's'} beginning at frame offset {selectedSegment.offset + selectedField.offset}.</p>}{selectedField.note && <p>{selectedField.note}</p>}</motion.div>}</AnimatePresence>
      </div>,
    },
    {
      id: 'config',
      label: 'Configure',
      eyebrow: 'Simulated packet inputs',
      title: `${config.family.toUpperCase()} · ${config.transport.toUpperCase()}`,
      content: <div className="packet-config-drawer">
        <section><span>NETWORK FAMILY</span><div className="packet-toggle-group" aria-label="Network family">{(['ipv4', 'ipv6'] as const).map((family) => <button key={family} type="button" className={config.family === family ? 'active' : ''} onClick={() => chooseFamily(family)}>{family.toUpperCase()}</button>)}</div></section>
        <section><span>TRANSPORT PROTOCOL</span><div className="packet-toggle-group" aria-label="Transport protocol">{(['tcp', 'udp', 'icmp'] as const).map((transport) => <button key={transport} type="button" className={config.transport === transport ? 'active' : ''} onClick={() => chooseTransport(transport)}>{transport.toUpperCase()}</button>)}</div></section>
        <section><div><span>APPLICATION PAYLOAD</span><strong>{snapshot.payloadBytes} BYTES</strong></div><input type="range" min="16" max="1400" step="8" value={config.payloadBytes} onChange={(event) => patchConfig('payloadBytes', Number(event.currentTarget.value))} aria-label="Application payload size" /></section>
        <section><div><span>{config.family === 'ipv4' ? 'TTL' : 'HOP LIMIT'}</span><strong>{config.ttl}</strong></div><div className="packet-stepper"><button type="button" onClick={() => patchConfig('ttl', Math.max(1, config.ttl - 1))}>−</button><strong>{config.ttl}</strong><button type="button" onClick={() => patchConfig('ttl', Math.min(255, config.ttl + 1))}>+</button></div></section>
      </div>,
    },
    {
      id: 'evidence',
      label: 'Model',
      eyebrow: 'Derived relationships',
      title: 'Change propagation',
      content: <div className="packet-model-drawer">
        <div className="packet-relations packet-drawer-relations"><div><span>FRAME BYTES</span><strong>{snapshot.frameBytes}</strong><small>Ethernet + network + transport + payload</small></div><div><span>{config.family === 'ipv4' ? 'IP TOTAL LENGTH' : 'IPV6 PAYLOAD LENGTH'}</span><strong>{config.family === 'ipv4' ? snapshot.networkBytes : snapshot.transportBytes}</strong><small>{config.family === 'ipv4' ? 'Network header through payload' : 'Transport header + payload'}</small></div><div><span>NETWORK CHECKSUM</span><strong>{snapshot.networkChecksum === null ? 'NONE' : hex16(snapshot.networkChecksum)}</strong><small>{config.family === 'ipv4' ? 'Recomputed from IPv4 header' : 'IPv6 removed this checksum'}</small></div><div><span>{config.transport.toUpperCase()} CHECKSUM</span><strong>{hex16(snapshot.transportChecksum)}</strong><small>Pseudo-header and payload dependent</small></div></div>
        <div className="packet-causality-note"><span>CHANGE PROPAGATION</span><p>Payload size changes propagate into network length fields and the {config.transport.toUpperCase()} checksum. {config.family === 'ipv4' ? 'IPv4 Total Length also changes its header checksum.' : 'IPv6 changes Payload Length but has no network-header checksum.'}</p></div>
        <div className="packet-origin-card"><span>SCENARIO SOURCE</span><strong>{origin?.label ?? 'LAB 01 · TRAFFIC RECOVERS'}</strong><small>{origin?.timestamp ?? '00:05.400'} · SIMULATED</small></div>
      </div>,
    },
  ];

  return (
    <div
      ref={rootRef}
      className="packet-microscope packet-microscope-simulated packet-world-root"
      data-packet-provenance="SIMULATED"
    >
      <VisualWorkspaceShell
        className="packet-visual-workspace interactive-world-workspace"
        entrance={{ eyebrow: 'Lab 02 · Packet microscope', title: 'PEEL THE PACKET.', accentTitle: 'WATCH THE MATH MOVE.', subtitle: 'Move from layer to field to the exact bytes that carry it.' }}
        stageLabel="Simulated packet specimen and exact byte map"
        activeDrawer={activeDrawer}
        drawers={drawers}
        onCloseDrawer={() => setActiveDrawer(null)}
        timeline={null}
        toolbar={<><div className="interactive-world-toolbar__identity"><span>LAB 02 · PACKET MICROSCOPE</span><strong>PEEL THE PACKET · WATCH THE MATH MOVE</strong></div><VisualDrawerTabs active={activeDrawer} items={[{ id: 'inspect', label: 'INSPECT', badge: selectedField ? '1' : '0' }, { id: 'config', label: 'CONFIGURE' }, { id: 'evidence', label: 'MODEL' }]} onSelect={toggleDrawer} /><div className="interactive-world-toolbar__actions">{onOpenSourceEvent && <button type="button" onClick={onOpenSourceEvent}>{origin?.actionLabel ?? 'SOURCE ↗'}</button>}<button type="button" onClick={onExit}>EXIT LAB</button></div></>}
        hud={<div className="interactive-world-hud packet-stage-hud"><div><span>FRAME</span><strong>{snapshot.frameBytes} BYTES</strong></div><div><span>NETWORK</span><strong>{config.family.toUpperCase()}</strong></div><div><span>TRANSPORT</span><strong>{config.transport.toUpperCase()}</strong></div><div><span>FIELD</span><strong>{selectedField?.label ?? '—'}</strong></div><div className="interactive-world-hud__truth"><span>PROVENANCE</span><strong>SIMULATED · RECOMPUTED</strong></div></div>}
      >
      <header className="packet-heading">
        <div>
          <p className="eyebrow">Lab 02 · Packet microscope</p>
          <h1>PEEL THE PACKET.<br /><span>WATCH THE MATH MOVE.</span></h1>
        </div>
        <div className="packet-heading-actions">
          <div className="packet-toggle-group" aria-label="Network family">
            {(['ipv4', 'ipv6'] as const).map((family) => (
              <button
                key={family}
                type="button"
                className={config.family === family ? 'active' : ''}
                onClick={() => chooseFamily(family)}
              >
                {family.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="packet-toggle-group" aria-label="Transport protocol">
            {(['tcp', 'udp', 'icmp'] as const).map((transport) => (
              <button
                key={transport}
                type="button"
                className={config.transport === transport ? 'active' : ''}
                onClick={() => chooseTransport(transport)}
              >
                {transport.toUpperCase()}
              </button>
            ))}
          </div>
          <button type="button" className="lab-mode" onClick={onExit}>EXIT LAB</button>
        </div>
      </header>

      <div className="packet-stage">
        <div className="packet-origin-strip">
          <div>
            <span>SCENARIO SOURCE</span>
            <strong>{origin?.label ?? 'LAB 01 · TRAFFIC RECOVERS'}</strong>
            <small className="packet-origin-route">{networkSegment.label} · {transportSegment.label} · {sourceAddress} → {destinationAddress}</small>
          </div>
          <div>
            <span>TIMESTAMP</span>
            <strong>{origin?.timestamp ?? '00:05.400'}</strong>
          </div>
          {onOpenSourceEvent && <button type="button" onClick={onOpenSourceEvent}>{origin?.actionLabel ?? 'OPEN SOURCE EVENT ↗'}</button>}
        </div>

        <div className="packet-object-wrap">
          <div className="packet-object-labels">
            <span>SIMULATED FRAME</span>
            <strong>{snapshot.frameBytes} BYTES · FCS NOT CAPTURED</strong>
          </div>
          <div className="packet-object" role="group" aria-label="Packet encapsulation layers">
            {snapshot.segments.map((segment) => (
              <motion.button
                layout
                key={segment.id}
                type="button"
                className={`packet-layer-shell layer-${segment.id}${selectedLayer === segment.id ? ' active' : ''}`}
                onClick={() => {
                  setSelectedLayer(segment.id);
                  setSelectedFieldId(segment.fields[0]?.id ?? null);
                }}
                animate={reduceMotion ? undefined : {
                  y: selectedLayer === segment.id ? -11 : 0,
                  scale: selectedLayer === segment.id ? 1.018 : 1,
                }}
                transition={{ type: 'spring', stiffness: 420, damping: 31 }}
                style={{ flexGrow: Math.max(1, Math.log2(segment.length + 1)) }}
              >
                <span>{layerKickers[segment.id]}</span>
                <strong>{segment.label}</strong>
                <small>{segment.length} B</small>
              </motion.button>
            ))}
          </div>
        </div>

        <div className="packet-relations">
          <div>
            <span>FRAME BYTES</span>
            <strong className="packet-relation-value">{snapshot.frameBytes}</strong>
            <small>Ethernet + network + transport + payload</small>
          </div>
          <div>
            <span>{config.family === 'ipv4' ? 'IP TOTAL LENGTH' : 'IPV6 PAYLOAD LENGTH'}</span>
            <strong className="packet-relation-value">
              {config.family === 'ipv4' ? snapshot.networkBytes : snapshot.transportBytes}
            </strong>
            <small>{config.family === 'ipv4' ? 'Network header through payload' : 'Transport header + payload'}</small>
          </div>
          <div>
            <span>NETWORK CHECKSUM</span>
            <strong className="packet-relation-value">{snapshot.networkChecksum === null ? 'NONE' : hex16(snapshot.networkChecksum)}</strong>
            <small>{config.family === 'ipv4' ? 'Recomputed from IPv4 header' : 'IPv6 removed this checksum'}</small>
          </div>
          <div>
            <span>{config.transport.toUpperCase()} CHECKSUM</span>
            <strong className="packet-relation-value">{hex16(snapshot.transportChecksum)}</strong>
            <small>{config.transport === 'icmp' ? (config.family === 'ipv4' ? 'ICMP message + payload' : 'ICMPv6 + IPv6 pseudo-header') : 'Pseudo-header + transport + payload'}</small>
          </div>
        </div>

        <div className="packet-payload-control">
          <div>
            <span>APPLICATION PAYLOAD</span>
            <strong>{snapshot.payloadBytes} BYTES</strong>
          </div>
          <input
            type="range"
            min="16"
            max="1400"
            step="8"
            value={config.payloadBytes}
            onChange={(event) => patchConfig('payloadBytes', Number(event.currentTarget.value))}
            aria-label="Application payload size"
          />
          <div className="packet-ttl-control">
            <span>{config.family === 'ipv4' ? 'TTL' : 'HOP LIMIT'}</span>
            <button type="button" onClick={() => patchConfig('ttl', Math.max(1, config.ttl - 1))}>−</button>
            <strong>{config.ttl}</strong>
            <button type="button" onClick={() => patchConfig('ttl', Math.min(255, config.ttl + 1))}>+</button>
          </div>
        </div>

        <div className="packet-hex-panel">
          <div className="packet-panel-heading">
            <div>
              <span>RAW FRAME</span>
              <strong>CLICK A FIELD TO MAP IT TO BYTES</strong>
            </div>
            <span>{snapshot.bytes.length} bytes</span>
          </div>
          <div className="packet-hex-grid" aria-label="Raw packet bytes">
            {snapshot.bytes.map((byte, index) => {
              const segment = snapshot.segments.find((item) => index >= item.offset && index < item.offset + item.length) ?? snapshot.segments[0];
              const highlighted = segment.id === selectedLayer && byteInField(index, selectedSegment.offset, selectedField);
              const derivedZone = segment.id === 'network' || segment.id === 'transport';
              return (
                <span
                  key={`${index}-${byte}`}
                  className={`packet-byte byte-${segment.id}${highlighted ? ' highlighted' : ''}${derivedZone ? ' is-derived-zone' : ''}`}
                  title={`byte ${index}`}
                >
                  {hexByte(byte)}
                </span>
              );
            })}
          </div>
        </div>
        <article className="packet-field-lens">
          <span>{layerKickers[selectedSegment.id]} · {selectedSegment.label} · FIELD FOCUS</span>
          <strong>{selectedField?.label ?? 'SELECT A FIELD'}</strong>
          <p>{selectedField ? `${selectedField.value} · ${selectedField.length > 0 ? `FRAME BYTES ${selectedSegment.offset + selectedField.offset}–${selectedSegment.offset + selectedField.offset + selectedField.length - 1}` : 'DERIVED VALUE'}` : 'Open Inspect to map protocol structure to exact bytes.'}</p>
          <button type="button" onClick={() => setActiveDrawer('inspect')}>INSPECT FIELDS ↗</button>
        </article>
      </div>

      <aside className="packet-inspector">
        <div className="packet-inspector-title">
          <div>
            <span>{layerKickers[selectedSegment.id]}</span>
            <strong>{selectedSegment.label}</strong>
          </div>
          <small>BYTES {selectedSegment.offset}–{selectedSegment.offset + selectedSegment.length - 1}</small>
        </div>

        <div className="packet-field-list">
          {selectedSegment.fields.map((field) => (
            <button
              key={field.id}
              type="button"
              className={field.id === selectedField?.id ? 'active' : ''}
              onClick={() => setSelectedFieldId(field.id)}
            >
              <span>{field.label}</span>
              <strong>{field.value}</strong>
              {field.derived && <small>DERIVED</small>}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {selectedField && (
            <motion.div
              key={`${selectedSegment.id}-${selectedField.id}-${selectedField.value}`}
              className="packet-field-detail"
              initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.22 }}
            >
              <span>FIELD TRACE</span>
              <h2>{selectedField.label}</h2>
              <strong>{selectedField.value}</strong>
              {selectedField.length > 0 && (
                <p>Maps to {selectedField.length} byte{selectedField.length === 1 ? '' : 's'} beginning at frame offset {selectedSegment.offset + selectedField.offset}.</p>
              )}
              {selectedField.note && <p>{selectedField.note}</p>}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="packet-causality-note">
          <span>CHANGE PROPAGATION</span>
          <p>
            Payload size changes propagate into network length fields and the {config.transport.toUpperCase()} checksum.
            {config.transport === 'icmp'
              ? (config.family === 'ipv4' ? ' ICMPv4 checksums the control message and payload.' : ' ICMPv6 also covers the IPv6 pseudo-header.')
              : (config.family === 'ipv4' ? ' IPv4 Total Length also changes its header checksum.' : ' IPv6 changes Payload Length but has no network-header checksum to recompute.')}
          </p>
        </div>
      </aside>
      </VisualWorkspaceShell>
    </div>
  );
}
