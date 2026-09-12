import { useLayoutEffect, useRef } from 'react';

type Point = { x: number; y: number };
type Box = { left: number; top: number; right: number; bottom: number };

// Layout only: event truth and animation clocks remain owned by the Journey.
export function useJourneyDnsGeometry(eventId: string, visible: boolean, progress: number, hostname: string) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const world = ref.current;
    if (!world || !visible) return;
    const svg = world.querySelector<SVGSVGElement>('.causal-dns-thread');
    const cache = world.querySelector<HTMLElement>('.causal-cache');
    const actors = [...world.querySelectorAll<HTMLElement>('[data-dns-authority]')];
    const object = world.closest('.causal-camera')?.querySelector<HTMLElement>('[data-causal-object]');
    if (!svg || !cache || !object || actors.length !== 4) return;
    const query = world.querySelector<HTMLElement>('.causal-dns-query');
    const base = svg.querySelector<SVGPathElement>('.dns-thread-base')!;
    const ink = svg.querySelector<SVGPathElement>('.dns-thread-progress')!;
    const answer = svg.querySelector<SVGPathElement>('.dns-answer-thread')!;
    let disposed = false;

    const measure = () => {
      if (disposed || !world.clientWidth || !world.clientHeight) return;
      // A single coordinate space cancels the parent camera's scale and pan.
      const inverse = svg.getScreenCTM()?.inverse();
      if (!inverse) return;
      const point = (x: number, y: number): Point => new DOMPoint(x, y).matrixTransform(inverse);
      const box = (element: Element): Box => {
        const r = element.getBoundingClientRect();
        const a = point(r.left, r.top), b = point(r.right, r.bottom);
        return { left: a.x, top: a.y, right: b.x, bottom: b.y };
      };
      const center = (r: Box): Point => ({ x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2 });
      const anchors = actors.map(actor => center(box(actor.querySelector(':scope > i')!)));
      const cacheBox = box(cache);
      const start = center(cacheBox);
      const points = [start, ...anchors];
      const segments = points.slice(1).map((p, i) => {
        const a = points[i], mid = (a.x + p.x) / 2;
        return `C${mid},${a.y} ${mid},${p.y} ${p.x},${p.y}`;
      });
      const path = `M${start.x},${start.y} ${segments.join(' ')}`;
      base.setAttribute('d', path);
      ink.setAttribute('d', path);
      const lengths = segments.map((segment, i) => {
        const part = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        part.setAttribute('d', `M${points[i].x},${points[i].y} ${segment}`);
        return part.getTotalLength();
      });
      const total = lengths.reduce((sum, length) => sum + length, 0);
      const reached = lengths.slice(0, Math.min(progress, anchors.length)).reduce((sum, length) => sum + length, 0);
      ink.style.strokeDashoffset = String(total ? 1 - reached / total : 1);
      const destination = center(box(object));
      const authority = anchors[3];
      answer.setAttribute('d', `M${authority.x},${authority.y} Q${authority.x},${destination.y} ${destination.x},${destination.y}`);

      if (query) {
        const queryBox = box(query);
        const width = queryBox.right - queryBox.left, height = queryBox.bottom - queryBox.top;
        const viewport = { left: point(12, 0).x, right: point(innerWidth - 12, 0).x };
        const toolbar = document.querySelector('.journey-visual-workspace .visual-workspace__toolbar');
        const rail = document.querySelector('.journey-visual-workspace .visual-time-rail');
        const minY = toolbar ? box(toolbar).bottom + 12 : point(0, 130).y;
        const maxY = rail ? box(rail).top - 12 : point(0, innerHeight - 130).y;
        const obstacles = [box(object), cacheBox, ...actors.flatMap(actor =>
          [...actor.querySelectorAll('span, small')].filter(el => el.getBoundingClientRect().height > 0).map(box))];
        const dock = (anchor: Point): Point => {
          const candidates: { p: Point; overlap: number; distance: number }[] = [];
          for (const gap of [44, 64, 84, 104, 124, 144]) {
            for (const direction of [-1, 1]) {
              const left = Math.max(viewport.left, Math.min(anchor.x - width / 2, viewport.right - width));
              const top = Math.max(minY, Math.min(anchor.y + direction * gap - height / 2, maxY - height));
              const r = { left, top, right: left + width, bottom: top + height };
              const overlap = obstacles.reduce((area, b) => area +
                Math.max(0, Math.min(r.right + 8, b.right) - Math.max(r.left - 8, b.left)) *
                Math.max(0, Math.min(r.bottom + 12, b.bottom) - Math.max(r.top - 12, b.top)), 0);
              candidates.push({ p: { x: left, y: top }, overlap, distance: Math.hypot(left + width / 2 - anchor.x, top + height / 2 - anchor.y) });
            }
          }
          candidates.sort((a, b) => a.overlap - b.overlap || a.distance - b.distance || a.p.y - b.p.y);
          return candidates[0].p;
        };
        const docks = [dock(start), ...anchors.map(dock)];
        for (let i = 0; i < docks.length; i++) {
          world.style.setProperty(`--dns-dock-${i}-x`, `${docks[i].x}px`);
          world.style.setProperty(`--dns-dock-${i}-y`, `${docks[i].y}px`);
        }
      }
      world.dataset.dnsGeometryReady = 'true';
    };
    measure();
    const observer = new ResizeObserver(measure);
    [world, cache, object, ...actors, ...(query ? [query] : [])].forEach(element => observer.observe(element));
    // Actor transitions can move anchors without changing their layout size.
    world.addEventListener('transitionend', measure);
    window.addEventListener('resize', measure);
    document.fonts.ready.then(measure);
    return () => {
      disposed = true;
      observer.disconnect();
      world.removeEventListener('transitionend', measure);
      window.removeEventListener('resize', measure);
    };
  }, [eventId, visible, progress, hostname]);
  return ref;
}
