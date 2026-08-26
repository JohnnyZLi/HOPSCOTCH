import { animate, createTimeline, stagger, svg } from 'animejs';
import { useReducedMotion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { buildJourneyScenario, type JourneyEventKind } from './journey/model.ts';
import './KineticOverview.css';

type JourneyAct = {
  id: string;
  label: string;
  detail: string;
  atMs: number;
};

function eventTime(scenario: ReturnType<typeof buildJourneyScenario>, kind: JourneyEventKind, fallback: number): number {
  return scenario.events.find((event) => event.kind === kind)?.atMs ?? fallback;
}

export function KineticOverview({
  onRunJourney,
  onOpenExplore,
}: {
  onRunJourney: () => void;
  onOpenExplore: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const rootRef = useRef<HTMLElement>(null);
  const timelineRef = useRef<ReturnType<typeof createTimeline> | null>(null);
  const [activeAct, setActiveAct] = useState(0);
  const scenario = useMemo(() => buildJourneyScenario('example.test'), []);
  const acts = useMemo<JourneyAct[]>(() => [
    { id: 'resolve', label: 'Resolve', detail: 'Hostname becomes an address', atMs: eventTime(scenario, 'intent.accepted', 0) },
    { id: 'route', label: 'Route', detail: 'Policy chooses a path', atMs: eventTime(scenario, 'route.lookup', 4500) },
    { id: 'connect', label: 'Connect', detail: 'Transport and TLS establish trust', atMs: eventTime(scenario, 'transport.segment', 7200) },
    { id: 'assemble', label: 'Assemble', detail: 'The request becomes packets', atMs: eventTime(scenario, 'packet.assembly', 12800) },
    { id: 'transit', label: 'Transit', detail: 'Links and routers rewrite the envelope', atMs: eventTime(scenario, 'packet.transit', 15100) },
    { id: 'return', label: 'Return', detail: 'Response bytes rise back to the browser', atMs: eventTime(scenario, 'response.ready', 19980) },
  ], [scenario]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || reduceMotion) return;

    const animations: Array<{ cancel: () => unknown }> = [];
    const routePath = root.querySelector<SVGPathElement>('.kinetic-route-primary');
    const dnsPath = root.querySelector<SVGPathElement>('.kinetic-dns-motion-path');
    const transitPath = root.querySelector<SVGPathElement>('.kinetic-transit-motion-path');
    const target = (selector: string): Element => {
      const element = root.querySelector(selector);
      if (!element) throw new Error(`Kinetic overview target missing: ${selector}`);
      return element;
    };
    const clock = { value: 0 };

    const timeline = createTimeline({
      loop: true,
      loopDelay: 900,
      defaults: { ease: 'inOutExpo' },
      onLoop: () => setActiveAct(0),
      onUpdate: (self) => root.style.setProperty('--journey-progress', `${Math.max(0, Math.min(1, self.progress))}`),
    });
    timelineRef.current = timeline;

    timeline
      .add(clock, { value: [0, 1], duration: scenario.durationMs, ease: 'linear' }, 0)
      .set(root.querySelectorAll('.kinetic-stage-group'), { opacity: 0 }, 0)
      .set(root.querySelectorAll('.kinetic-annotation'), { opacity: 0, translateY: 8 }, 0)
      .set(root.querySelectorAll('.kinetic-packet-layer'), { opacity: 0, translateX: 70, rotate: 0 }, 0)
      .set(root.querySelectorAll('.kinetic-bit'), { opacity: 0 }, 0)
      .set(root.querySelectorAll('.kinetic-router-part'), { opacity: 0, scale: 0.72 }, 0)
      .set(root.querySelectorAll('.kinetic-response-byte'), { opacity: 0 }, 0)
      .call(() => setActiveAct(0), acts[0].atMs)
      .add(target('.kinetic-intent'), { opacity: [0, 1], translateX: [-90, 0], duration: 900, ease: 'outExpo' }, 180)
      .add(root.querySelectorAll('.kinetic-intent-glyph'), { opacity: [0, 1], translateY: [16, 0], delay: stagger(65), duration: 520, ease: 'outExpo' }, 450)
      .add(target('.kinetic-dns'), { opacity: [0, 1], scale: [0.72, 1], rotate: [-8, 0], duration: 780, ease: 'outBack' }, eventTime(scenario, 'dns.cache-check', 900))
      .add(root.querySelectorAll('.kinetic-dns-branch'), { strokeDashoffset: [1, 0], opacity: [0.12, 0.72], delay: stagger(90), duration: 760, ease: 'outExpo' }, eventTime(scenario, 'dns.query', 1600))
      .add(root.querySelectorAll('.kinetic-dns-node'), { opacity: [0, 1], scale: [0.2, 1], delay: stagger(120), duration: 520, ease: 'outBack' }, eventTime(scenario, 'dns.query', 1600) + 180)
      .add(target('.kinetic-address'), { opacity: [0, 1], translateY: [20, 0], duration: 620, ease: 'outExpo' }, eventTime(scenario, 'dns.answer', 3600))
      .call(() => setActiveAct(1), acts[1].atMs)
      .add(target('.kinetic-routes'), { opacity: [0, 1], duration: 450 }, acts[1].atMs)
      .add(root.querySelectorAll('.kinetic-route-candidate'), { strokeDashoffset: [1, 0], opacity: [0, 0.34], delay: stagger(120), duration: 900, ease: 'outExpo' }, acts[1].atMs + 120)
      .add(target('.kinetic-route-primary'), { strokeDashoffset: [1, 0], opacity: [0.2, 1], duration: 1050, ease: 'inOutSine' }, eventTime(scenario, 'internet.policy-path', acts[1].atMs + 1000))
      .add(root.querySelectorAll('.kinetic-route-node'), { opacity: [0, 1], scale: [0.35, 1], delay: stagger(90), duration: 460, ease: 'outBack' }, acts[1].atMs + 420)
      .call(() => setActiveAct(2), acts[2].atMs)
      .add(target('.kinetic-handshake'), { opacity: [0, 1], scale: [0.74, 1], duration: 650, ease: 'outBack' }, acts[2].atMs)
      .add(root.querySelectorAll('.kinetic-handshake-segment'), { opacity: [0, 1], translateY: (_element, index) => [(index ?? 0) % 2 ? -24 : 24, 0], delay: stagger(130), duration: 640, ease: 'outExpo' }, acts[2].atMs + 120)
      .add(root.querySelectorAll('.kinetic-key-tooth'), { opacity: [0, 1], scale: [0.1, 1], delay: stagger(55), duration: 420, ease: 'outBack' }, eventTime(scenario, 'tls.keys', acts[2].atMs + 2400))
      .add(target('.kinetic-lock-ring'), { rotate: [0, 360], scale: [0.5, 1], opacity: [0, 1], duration: 1100, ease: 'outExpo' }, eventTime(scenario, 'tls.validation', acts[2].atMs + 1400))
      .call(() => setActiveAct(3), acts[3].atMs)
      .add(target('.kinetic-packet'), { opacity: [0, 1], scale: [0.84, 1], duration: 520, ease: 'outExpo' }, acts[3].atMs)
      .add(root.querySelectorAll('.kinetic-packet-layer'), { opacity: [0, 1], translateX: [70, 0], rotate: (_element, index) => [(index ?? 0) % 2 ? 4 : -4, 0], delay: stagger(160), duration: 740, ease: 'outExpo' }, acts[3].atMs + 80)
      .add(root.querySelectorAll('.kinetic-packet-layer'), { translateX: (_element, index) => (index ?? 0) * 23 - 46, duration: 850, ease: 'inOutExpo' }, acts[3].atMs + 1250)
      .add(root.querySelectorAll('.kinetic-bit'), { opacity: [0, 1, 1, 0], translateX: [0, 210], delay: stagger(34), duration: 850, ease: 'linear' }, acts[3].atMs + 2100)
      .call(() => setActiveAct(4), acts[4].atMs)
      .add(target('.kinetic-router'), { opacity: [0, 1], translateY: [36, 0], duration: 680, ease: 'outExpo' }, acts[4].atMs)
      .add(root.querySelectorAll('.kinetic-router-part'), { opacity: [0, 1], scale: [0.72, 1], rotate: (_element, index) => [(index ?? 0) % 2 ? -22 : 22, 0], delay: stagger(105), duration: 600, ease: 'outBack' }, acts[4].atMs + 160)
      .add(root.querySelectorAll('.kinetic-ttl-mark'), { opacity: [0, 1, 0.18], translateY: [-10, 0], delay: stagger(120), duration: 760, ease: 'inOutSine' }, acts[4].atMs + 1050)
      .add(root.querySelectorAll('.kinetic-packet-layer'), { translateX: 0, rotate: [0, 360], duration: 880, ease: 'inOutExpo' }, acts[4].atMs + 1650)
      .call(() => setActiveAct(5), acts[5].atMs)
      .add(root.querySelectorAll('.kinetic-response-byte'), { opacity: [0, 1], translateY: [60, -110], translateX: (_element, index) => ((index ?? 0) - 7) * 11, delay: stagger(42, { from: 'center' }), duration: 1250, ease: 'outExpo' }, acts[5].atMs)
      .add(root.querySelectorAll('.kinetic-stage-group'), { opacity: 0.28, scale: 0.88, translateX: -30, duration: 1100, ease: 'inOutExpo' }, eventTime(scenario, 'camera.pullback', 20800))
      .add(target('.kinetic-complete-ring'), { opacity: [0, 0.82], scale: [0.3, 1.55], duration: 1250, ease: 'outExpo' }, eventTime(scenario, 'journey.complete', 22650) - 500)
      .add(root.querySelectorAll('.kinetic-annotation'), { opacity: [0, 1], translateY: [8, 0], delay: stagger(90), duration: 550, ease: 'outExpo' }, 700);

    if (dnsPath) {
      timeline.add(root.querySelectorAll('.kinetic-dns-query-token'), {
        ...svg.createMotionPath(dnsPath),
        opacity: [0, 1, 1, 0],
        delay: stagger(240),
        duration: 2100,
        ease: 'inOutSine',
      }, eventTime(scenario, 'dns.query', 1600) + 120);
    }

    if (routePath) {
      animations.push(animate(root.querySelectorAll('.kinetic-route-pulse'), {
        ...svg.createMotionPath(routePath),
        opacity: [0, 0.9, 0.9, 0],
        delay: stagger(740),
        duration: 3300,
        ease: 'linear',
        loop: true,
      }));
      animations.push(animate(routePath, {
        strokeDashoffset: [0, -52],
        duration: 1800,
        ease: 'linear',
        loop: true,
      }));
    }

    if (transitPath) {
      timeline.add(root.querySelectorAll('.kinetic-transit-token'), {
        ...svg.createMotionPath(transitPath),
        opacity: [0, 1, 1, 0],
        delay: stagger(360),
        duration: 3100,
        ease: 'inOutSine',
      }, acts[4].atMs + 400);
    }

    animations.push(animate(root.querySelectorAll('.kinetic-ambient-orbit'), {
      rotate: [0, 360],
      duration: 18000,
      ease: 'linear',
      loop: true,
    }));
    animations.push(animate(root.querySelectorAll('.kinetic-ambient-node'), {
      scale: [0.72, 1.18, 0.72],
      opacity: [0.22, 0.72, 0.22],
      delay: stagger(260, { from: 'center' }),
      duration: 2600,
      ease: 'inOutSine',
      loop: true,
    }));

    return () => {
      timelineRef.current = null;
      timeline.revert();
      animations.forEach((animation) => animation.cancel());
    };
  }, [acts, reduceMotion, scenario]);

  const seekToAct = (index: number) => {
    setActiveAct(index);
    timelineRef.current?.seek(acts[index].atMs);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLElement>) => {
    if (reduceMotion) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    const y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    event.currentTarget.style.setProperty('--pointer-x', x.toFixed(3));
    event.currentTarget.style.setProperty('--pointer-y', y.toFixed(3));
  };

  const resetPointer = (event: React.PointerEvent<HTMLElement>) => {
    event.currentTarget.style.setProperty('--pointer-x', '0');
    event.currentTarget.style.setProperty('--pointer-y', '0');
  };

  return (
    <section
      ref={rootRef}
      className="kinetic-overview"
      data-reduced-motion={reduceMotion ? 'true' : 'false'}
      onPointerMove={handlePointerMove}
      onPointerLeave={resetPointer}
      aria-labelledby="kinetic-title"
    >
      <div className="kinetic-atmosphere" aria-hidden="true">
        <i /><i /><i /><i /><i />
      </div>

      <header className="kinetic-copy">
        <p>Interactive network systems</p>
        <h1 id="kinetic-title">See a request<br />become <em>the Internet.</em></h1>
        <span>One canonical journey from human intent to exact bytes—and back again.</span>
        <div className="kinetic-actions">
          <button type="button" className="kinetic-primary-action" onClick={onRunJourney}>
            Run the request <i aria-hidden="true">→</i>
          </button>
          <button type="button" className="kinetic-text-action" onClick={onOpenExplore}>Explore every workspace</button>
        </div>
      </header>

      <div className="kinetic-scene" aria-label="Animated anatomy of an Internet request">
        <svg className="kinetic-machine" viewBox="0 0 1240 820" role="img" aria-labelledby="kinetic-machine-title kinetic-machine-description">
          <title id="kinetic-machine-title">An Internet request assembling and moving through the network</title>
          <desc id="kinetic-machine-description">DNS resolution, routing, transport, encryption, packet encapsulation, transit, and response delivery are choreographed from one deterministic request model.</desc>
          <defs>
            <filter id="kinetic-paper-shadow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="8" stdDeviation="9" floodColor="#2b2927" floodOpacity=".12" />
            </filter>
            <path id="kinetic-dns-path" className="kinetic-dns-motion-path" d="M 112 232 C 210 130 258 326 355 205 S 505 120 570 224" />
            <path id="kinetic-transit-path" className="kinetic-transit-motion-path" d="M 556 578 C 684 650 726 442 855 520 S 1050 670 1150 536" />
          </defs>

          <g className="kinetic-ambient" aria-hidden="true">
            <path d="M20 648 C220 540 236 744 432 656 S742 512 940 606 1130 630 1220 552" />
            <path d="M90 94 C300 178 356 24 548 126 S870 230 1126 96" />
            {[70, 155, 246, 340, 458, 576, 700, 824, 954, 1080, 1170].map((x, index) => <circle key={x} className="kinetic-ambient-node" cx={x} cy={index % 2 ? 690 : 104} r={index % 3 === 0 ? 4 : 2.5} />)}
          </g>

          <g transform="translate(58 325)">
            <g className="kinetic-stage-group kinetic-intent">
              <path className="kinetic-browser-shell" d="M0 18 Q0 0 18 0 H252 Q270 0 270 18 V132 Q270 150 252 150 H18 Q0 150 0 132 Z" />
              <path d="M0 30 H270" />
              <circle cx="15" cy="15" r="3" /><circle cx="27" cy="15" r="3" /><circle cx="39" cy="15" r="3" />
              <g className="kinetic-intent-glyph"><rect x="22" y="54" width="226" height="28" rx="14" /><text x="39" y="73">example.test</text></g>
              <g className="kinetic-intent-glyph"><path d="M31 110 H212" /><path d="M31 122 H176" /></g>
            </g>
          </g>

          <g transform="translate(338 64)">
            <g className="kinetic-stage-group kinetic-dns">
              <circle className="kinetic-ambient-orbit" cx="146" cy="138" r="108" />
              <path className="kinetic-dns-branch" pathLength="1" d="M146 52 V92 M146 92 L74 136 M146 92 L146 158 M146 92 L218 136" />
              <path className="kinetic-dns-branch" pathLength="1" d="M74 136 L42 204 M74 136 L98 204 M146 158 L146 226 M218 136 L194 204 M218 136 L250 204" />
              <g className="kinetic-dns-node"><circle cx="146" cy="52" r="18" /><text x="146" y="56">.</text></g>
              <g className="kinetic-dns-node"><circle cx="74" cy="136" r="16" /><text x="74" y="140">root</text></g>
              <g className="kinetic-dns-node"><circle cx="146" cy="158" r="21" /><text x="146" y="162">.test</text></g>
              <g className="kinetic-dns-node"><circle cx="218" cy="136" r="16" /><text x="218" y="140">auth</text></g>
              {[42, 98, 146, 194, 250].map((x) => <circle key={x} className="kinetic-dns-node" cx={x} cy={204 + (x === 146 ? 22 : 0)} r="7" />)}
            </g>
          </g>
          <use href="#kinetic-dns-path" className="kinetic-guide-path" />
          {[0, 1, 2].map((token) => <circle key={token} className="kinetic-dns-query-token" r="6" />)}
          <g transform="translate(538 256)"><g className="kinetic-address"><rect x="0" y="0" width="142" height="34" rx="17" /><text x="71" y="22">203.0.113.42</text></g></g>

          <g className="kinetic-stage-group kinetic-routes">
            <path className="kinetic-route-candidate" pathLength="1" d="M442 405 C540 298 676 322 740 408 S900 512 1002 395" />
            <path className="kinetic-route-candidate" pathLength="1" d="M442 405 C558 468 644 506 756 420 S902 302 1002 395" />
            <path className="kinetic-route-primary" pathLength="1" d="M442 405 C548 346 634 452 738 404 S890 342 1002 395" />
            {[442, 554, 660, 772, 884, 1002].map((x, index) => <g key={x} transform={`translate(${x} ${index % 2 ? 371 : 405})`}><g className="kinetic-route-node"><circle r={index === 0 || index === 5 ? 15 : 10} /><text y="30">AS{64510 + index}</text></g></g>)}
            {[0, 1, 2].map((token) => <circle key={token} className="kinetic-route-pulse" r="5" />)}
          </g>

          <g transform="translate(770 108)"><g className="kinetic-stage-group kinetic-handshake">
            <circle className="kinetic-lock-ring" cx="122" cy="110" r="88" />
            <path className="kinetic-handshake-segment" d="M46 75 C70 36 104 24 138 31" />
            <path className="kinetic-handshake-segment" d="M194 141 C166 180 126 190 88 176" />
            <path className="kinetic-handshake-segment" d="M138 31 l-13 -10 m13 10 l-17 5" />
            <path className="kinetic-handshake-segment" d="M88 176 l14 10 m-14 -10 l17 -5" />
            <path d="M96 103 V82 Q96 56 122 56 Q148 56 148 82 V103" />
            <rect x="82" y="99" width="80" height="58" rx="10" />
            <circle cx="122" cy="124" r="7" /><path d="M122 131 V143" />
            <g transform="translate(181 73)"><path d="M0 0 H52 V14 H0 Z" />{[7, 18, 29, 40].map((x) => <path key={x} className="kinetic-key-tooth" d={`M${x} 14 V26 H${x + 6} V14`} />)}</g>
          </g></g>

          <g transform="translate(410 512)" filter="url(#kinetic-paper-shadow)"><g className="kinetic-stage-group kinetic-packet">
            {[
              { name: 'HTTP', x: 0, width: 128 },
              { name: 'TLS', x: 20, width: 146 },
              { name: 'TCP', x: 40, width: 168 },
              { name: 'IP', x: 60, width: 190 },
              { name: 'ETH', x: 80, width: 214 },
            ].map((layer, index) => <g key={layer.name} transform={`translate(${layer.x} ${index * 26})`}><g className="kinetic-packet-layer"><rect width={layer.width} height="54" rx="4" /><text x="15" y="33">{layer.name}</text><path d={`M${layer.width - 42} 13 V41 M${layer.width - 28} 13 V41 M${layer.width - 14} 13 V41`} /></g></g>)}
            <g transform="translate(314 92)">{Array.from({ length: 18 }, (_, index) => <rect key={index} className="kinetic-bit" x={(index % 6) * 13} y={Math.floor(index / 6) * 13} width="7" height="7" />)}</g>
          </g></g>

          <g transform="translate(820 502)"><g className="kinetic-stage-group kinetic-router">
            <g className="kinetic-router-part"><ellipse cx="145" cy="104" rx="112" ry="43" /><path d="M33 104 V166 C33 190 82 210 145 210 C208 210 257 190 257 166 V104" /><ellipse cx="145" cy="166" rx="112" ry="43" /></g>
            <g className="kinetic-router-part"><path d="M72 101 H218 M94 82 L72 101 94 120 M196 82 L218 101 196 120" /></g>
            <g className="kinetic-router-part"><circle cx="145" cy="55" r="28" /><path d="M145 27 V4 M145 106 V83 M117 55 H94 M196 55 H173" /></g>
            {[0, 1, 2].map((mark) => <g key={mark} transform={`translate(${278 + mark * 28} ${80 + mark * 18})`}><g className="kinetic-ttl-mark"><text>TTL</text><text y="17">{64 - mark}</text></g></g>)}
          </g></g>
          <use href="#kinetic-transit-path" className="kinetic-guide-path" />
          {[0, 1, 2, 3].map((token) => <rect key={token} className="kinetic-transit-token" width="15" height="10" rx="2" />)}

          <g transform="translate(1058 286)">{Array.from({ length: 15 }, (_, index) => <rect key={index} className="kinetic-response-byte" x={(index % 5) * 13} y={Math.floor(index / 5) * 13} width="7" height="7" />)}</g>
          <circle className="kinetic-complete-ring" cx="650" cy="412" r="225" />

          <g transform="translate(44 224)"><g className="kinetic-annotation"><path d="M0 0 H92" /><text y="-10">human intent</text></g></g>
          <g transform="translate(448 42)"><g className="kinetic-annotation"><path d="M0 0 H116" /><text y="-10">recursive resolution</text></g></g>
          <g transform="translate(846 340)"><g className="kinetic-annotation"><path d="M0 0 H124" /><text y="-10">policy-selected path</text></g></g>
          <g transform="translate(1018 228)"><g className="kinetic-annotation"><path d="M0 0 H132" /><text y="-10">ephemeral keys</text></g></g>
          <g transform="translate(542 762)"><g className="kinetic-annotation"><path d="M0 0 H138" /><text y="-10">encapsulated bytes</text></g></g>
        </svg>
      </div>

      <aside className="kinetic-readout" aria-live="polite">
        <span>{String(activeAct + 1).padStart(2, '0')} / {String(acts.length).padStart(2, '0')}</span>
        <strong>{acts[activeAct].label}</strong>
        <p>{acts[activeAct].detail}</p>
      </aside>

      <nav className="kinetic-instrument" aria-label="Request journey phases">
        <div className="kinetic-progress" aria-hidden="true"><i /></div>
        <div className="kinetic-phase-buttons">
          {acts.map((act, index) => (
            <button key={act.id} type="button" className={index === activeAct ? 'active' : ''} onClick={() => seekToAct(index)} aria-label={`Jump to ${act.label}: ${act.detail}`}>
              <i aria-hidden="true" /><span>{act.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </section>
  );
}
