import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type {
  PublicInfrastructureError,
  PublicInfrastructureFacility,
  PublicInfrastructureSnapshot,
} from './internet/infrastructure';
import './PhysicalInternetGlobe.css';

const DENSITY_LEVELS = [80, 150, 250] as const;

type DensityLevel = (typeof DENSITY_LEVELS)[number];

function facilityLocation(facility: PublicInfrastructureFacility): string {
  return [facility.city, facility.country].filter((value): value is string => Boolean(value)).join(' · ') || 'LOCATION UNAVAILABLE';
}

function latLonVector(latitude: number, longitude: number, radius = 1): THREE.Vector3 {
  const phi = THREE.MathUtils.degToRad(90 - latitude);
  const theta = THREE.MathUtils.degToRad(longitude + 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

function lineGeometry(points: THREE.Vector3[]): THREE.BufferGeometry {
  return new THREE.BufferGeometry().setFromPoints(points);
}

function createReferenceGrid(): THREE.Group {
  const group = new THREE.Group();
  const material = new THREE.LineBasicMaterial({ color: 0x58717f, transparent: true, opacity: 0.16 });

  for (const latitude of [-60, -30, 0, 30, 60]) {
    const points: THREE.Vector3[] = [];
    for (let longitude = -180; longitude <= 180; longitude += 4) points.push(latLonVector(latitude, longitude, 1.006));
    group.add(new THREE.Line(lineGeometry(points), material));
  }

  for (let longitude = -180; longitude < 180; longitude += 30) {
    const points: THREE.Vector3[] = [];
    for (let latitude = -88; latitude <= 88; latitude += 4) points.push(latLonVector(latitude, longitude, 1.006));
    group.add(new THREE.Line(lineGeometry(points), material));
  }

  return group;
}

function createStars(): THREE.Points {
  let seed = 0x51f15e;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };
  const positions = new Float32Array(420 * 3);
  for (let index = 0; index < 420; index += 1) {
    const radius = 4.8 + random() * 4.4;
    const theta = random() * Math.PI * 2;
    const z = random() * 2 - 1;
    const planar = Math.sqrt(1 - z * z);
    positions[index * 3] = radius * planar * Math.cos(theta);
    positions[index * 3 + 1] = radius * z;
    positions[index * 3 + 2] = radius * planar * Math.sin(theta);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0x7f9baa, size: 0.018, transparent: true, opacity: 0.5, sizeAttenuation: true }));
}

function corridorPoints(a: PublicInfrastructureFacility, b: PublicInfrastructureFacility): THREE.Vector3[] {
  const start = latLonVector(a.latitude, a.longitude, 1).normalize();
  const end = latLonVector(b.latitude, b.longitude, 1).normalize();
  const dot = THREE.MathUtils.clamp(start.dot(end), -1, 1);
  const omega = Math.acos(dot);
  const sinOmega = Math.sin(omega);
  const points: THREE.Vector3[] = [];
  for (let index = 0; index <= 80; index += 1) {
    const t = index / 80;
    let point: THREE.Vector3;
    if (Math.abs(sinOmega) < 0.0001) {
      point = start.clone().lerp(end, t).normalize();
    } else {
      const left = Math.sin((1 - t) * omega) / sinOmega;
      const right = Math.sin(t * omega) / sinOmega;
      point = start.clone().multiplyScalar(left).add(end.clone().multiplyScalar(right)).normalize();
    }
    const lift = 1.025 + Math.sin(Math.PI * t) * 0.16;
    points.push(point.multiplyScalar(lift));
  }
  return points;
}

export function PhysicalInternetGlobe({
  onExit,
  onOpenSimulated,
  onOpenObserved,
}: {
  onExit: () => void;
  onOpenSimulated: () => void;
  onOpenObserved: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<THREE.Group | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const facilityPointsRef = useRef<THREE.Points | null>(null);
  const facilityRecordsRef = useRef<PublicInfrastructureFacility[]>([]);
  const selectionMarkerRef = useRef<THREE.Mesh | null>(null);
  const corridorRef = useRef<THREE.Line | null>(null);
  const corridorPulseRef = useRef<THREE.Mesh | null>(null);
  const corridorPathRef = useRef<THREE.Vector3[]>([]);
  const reduceMotion = useReducedMotion();

  const [snapshot, setSnapshot] = useState<PublicInfrastructureSnapshot | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);
  const [webglError, setWebglError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [corridorAId, setCorridorAId] = useState<number | null>(null);
  const [corridorBId, setCorridorBId] = useState<number | null>(null);
  const [density, setDensity] = useState<DensityLevel>(150);
  const [zoom, setZoom] = useState(3.15);

  const visibleFacilities = useMemo(() => {
    const facilities = snapshot?.facilities ?? [];
    return facilities.slice(0, Math.min(density, facilities.length));
  }, [density, snapshot]);
  const selectedFacility = useMemo(() => snapshot?.facilities.find((facility) => facility.id === selectedId) ?? null, [selectedId, snapshot]);
  const corridorA = useMemo(() => snapshot?.facilities.find((facility) => facility.id === corridorAId) ?? null, [corridorAId, snapshot]);
  const corridorB = useMemo(() => snapshot?.facilities.find((facility) => facility.id === corridorBId) ?? null, [corridorBId, snapshot]);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      setDataError(null);
      try {
        const response = await fetch('/api/internet/infrastructure', { signal: controller.signal, headers: { accept: 'application/json' } });
        const payload = await response.json() as PublicInfrastructureSnapshot | PublicInfrastructureError;
        if (!response.ok || ('ok' in payload && payload.ok === false)) throw new Error('error' in payload ? payload.error : `Infrastructure request failed with HTTP ${response.status}.`);
        if (!('schema' in payload) || payload.schema !== 'hopscotch.internet-infrastructure') throw new Error('HOPSCOTCH received an unexpected infrastructure payload.');
        setSnapshot(payload);
        setSelectedId(payload.facilities[0]?.id ?? null);
      } catch (error) {
        if (!controller.signal.aborted) setDataError(error instanceof Error ? error.message : 'Public infrastructure data is unavailable.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch (error) {
      setWebglError(error instanceof Error ? error.message : 'WebGL 2 renderer initialization failed.');
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x020508, 0);
    host.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x020508, 0.055);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 40);
    camera.position.set(0, 0.05, zoom);
    cameraRef.current = camera;

    const globe = new THREE.Group();
    globe.rotation.x = -0.16;
    globe.rotation.y = -0.72;
    scene.add(globe);
    globeRef.current = globe;

    const planet = new THREE.Mesh(
      new THREE.SphereGeometry(1, 72, 48),
      new THREE.MeshBasicMaterial({ color: 0x07131a, transparent: true, opacity: 0.96 }),
    );
    globe.add(planet);

    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(1.007, 36, 24),
      new THREE.MeshBasicMaterial({ color: 0x51717f, wireframe: true, transparent: true, opacity: 0.045 }),
    );
    globe.add(shell);
    globe.add(createReferenceGrid());

    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(1.09, 56, 36),
      new THREE.MeshBasicMaterial({ color: 0x79f2da, transparent: true, opacity: 0.055, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    globe.add(atmosphere);
    scene.add(createStars());

    const selectionMarker = new THREE.Mesh(
      new THREE.SphereGeometry(0.026, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xf2c879, transparent: true, opacity: 0.98 }),
    );
    selectionMarker.visible = false;
    globe.add(selectionMarker);
    selectionMarkerRef.current = selectionMarker;

    const pulse = new THREE.Mesh(
      new THREE.SphereGeometry(0.022, 12, 8),
      new THREE.MeshBasicMaterial({ color: 0xffdf9c }),
    );
    pulse.visible = false;
    globe.add(pulse);
    corridorPulseRef.current = pulse;

    let dragging = false;
    let previousX = 0;
    let previousY = 0;
    let targetZoom = zoom;
    let targetRotationX = globe.rotation.x;
    let targetRotationY = globe.rotation.y;
    const raycaster = new THREE.Raycaster();
    raycaster.params.Points = { threshold: 0.045 };
    const pointer = new THREE.Vector2();

    const resize = () => {
      const rect = host.getBoundingClientRect();
      const width = Math.max(rect.width, 1);
      const height = Math.max(rect.height, 1);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    resize();

    const pointerDown = (event: PointerEvent) => {
      dragging = true;
      previousX = event.clientX;
      previousY = event.clientY;
      renderer.domElement.setPointerCapture(event.pointerId);
    };
    const pointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      const dx = event.clientX - previousX;
      const dy = event.clientY - previousY;
      previousX = event.clientX;
      previousY = event.clientY;
      targetRotationY += dx * 0.006;
      targetRotationX = THREE.MathUtils.clamp(targetRotationX + dy * 0.0045, -1.05, 1.05);
    };
    const pointerUp = (event: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      if (renderer.domElement.hasPointerCapture(event.pointerId)) renderer.domElement.releasePointerCapture(event.pointerId);
    };
    const click = (event: MouseEvent) => {
      const points = facilityPointsRef.current;
      if (!points || dragging) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObject(points, false)[0];
      if (hit && typeof hit.index === 'number') {
        const facility = facilityRecordsRef.current[hit.index];
        if (facility) setSelectedId(facility.id);
      }
    };
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      targetZoom = THREE.MathUtils.clamp(targetZoom + event.deltaY * 0.0016, 2.15, 4.6);
      setZoom(Number(targetZoom.toFixed(2)));
    };
    renderer.domElement.addEventListener('pointerdown', pointerDown);
    renderer.domElement.addEventListener('pointermove', pointerMove);
    renderer.domElement.addEventListener('pointerup', pointerUp);
    renderer.domElement.addEventListener('pointercancel', pointerUp);
    renderer.domElement.addEventListener('click', click);
    renderer.domElement.addEventListener('wheel', wheel, { passive: false });

    const animate = (time: number) => {
      if (!reduceMotion && !dragging) targetRotationY += 0.00036;
      globe.rotation.x += (targetRotationX - globe.rotation.x) * 0.09;
      globe.rotation.y += (targetRotationY - globe.rotation.y) * 0.09;
      camera.position.z += (targetZoom - camera.position.z) * 0.1;

      const path = corridorPathRef.current;
      if (corridorPulseRef.current && path.length > 1) {
        corridorPulseRef.current.visible = true;
        const progress = reduceMotion ? 0.5 : (time * 0.00014) % 1;
        const scaled = progress * (path.length - 1);
        const index = Math.min(path.length - 2, Math.floor(scaled));
        const local = scaled - index;
        corridorPulseRef.current.position.copy(path[index]).lerp(path[index + 1], local);
      } else if (corridorPulseRef.current) {
        corridorPulseRef.current.visible = false;
      }
      renderer.render(scene, camera);
    };
    renderer.setAnimationLoop(animate);

    return () => {
      renderer.setAnimationLoop(null);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointerdown', pointerDown);
      renderer.domElement.removeEventListener('pointermove', pointerMove);
      renderer.domElement.removeEventListener('pointerup', pointerUp);
      renderer.domElement.removeEventListener('pointercancel', pointerUp);
      renderer.domElement.removeEventListener('click', click);
      renderer.domElement.removeEventListener('wheel', wheel);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.Line) {
          object.geometry?.dispose();
          const material = object.material;
          if (Array.isArray(material)) material.forEach((entry) => entry.dispose()); else material?.dispose();
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      globeRef.current = null;
      facilityPointsRef.current = null;
      selectionMarkerRef.current = null;
      corridorRef.current = null;
      corridorPulseRef.current = null;
    };
  }, [reduceMotion]);

  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;
    if (facilityPointsRef.current) {
      facilityPointsRef.current.geometry.dispose();
      const material = facilityPointsRef.current.material;
      if (Array.isArray(material)) material.forEach((entry) => entry.dispose()); else material.dispose();
      globe.remove(facilityPointsRef.current);
      facilityPointsRef.current = null;
    }
    facilityRecordsRef.current = visibleFacilities;
    if (visibleFacilities.length === 0) return;
    const positions = new Float32Array(visibleFacilities.length * 3);
    visibleFacilities.forEach((facility, index) => {
      const point = latLonVector(facility.latitude, facility.longitude, 1.026);
      positions[index * 3] = point.x;
      positions[index * 3 + 1] = point.y;
      positions[index * 3 + 2] = point.z;
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const points = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({ color: 0x79f2da, size: 0.028, transparent: true, opacity: 0.86, sizeAttenuation: true, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    points.renderOrder = 3;
    globe.add(points);
    facilityPointsRef.current = points;
  }, [visibleFacilities]);

  useEffect(() => {
    const marker = selectionMarkerRef.current;
    if (!marker) return;
    if (!selectedFacility) {
      marker.visible = false;
      return;
    }
    marker.position.copy(latLonVector(selectedFacility.latitude, selectedFacility.longitude, 1.045));
    marker.visible = true;
  }, [selectedFacility]);

  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;
    if (corridorRef.current) {
      corridorRef.current.geometry.dispose();
      const material = corridorRef.current.material;
      if (Array.isArray(material)) material.forEach((entry) => entry.dispose()); else material.dispose();
      globe.remove(corridorRef.current);
      corridorRef.current = null;
    }
    corridorPathRef.current = [];
    if (!corridorA || !corridorB || corridorA.id === corridorB.id) return;
    const path = corridorPoints(corridorA, corridorB);
    corridorPathRef.current = path;
    const line = new THREE.Line(
      lineGeometry(path),
      new THREE.LineBasicMaterial({ color: 0xf2c879, transparent: true, opacity: 0.82, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    line.renderOrder = 4;
    globe.add(line);
    corridorRef.current = line;
  }, [corridorA, corridorB]);

  useEffect(() => {
    const camera = cameraRef.current;
    if (camera) camera.position.z = zoom;
  }, [zoom]);

  const cycleDensity = () => {
    const index = DENSITY_LEVELS.indexOf(density);
    setDensity(DENSITY_LEVELS[(index + 1) % DENSITY_LEVELS.length]);
  };

  return (
    <motion.section className="physical-globe" initial={reduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.985 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
      <header className="physical-heading">
        <div><p className="eyebrow">Lab 05C · Physical Internet atlas</p><h1>THE INTERNET<br/><span>HAS A BODY.</span></h1></div>
        <div className="physical-heading-actions"><span>PUBLIC DATA · PEERINGDB</span><button className="lab-mode" type="button" onClick={onOpenSimulated}>AS POLICY ↗</button><button className="lab-mode" type="button" onClick={onOpenObserved}>EVIDENCE ↗</button><button className="lab-mode" type="button" onClick={onExit}>EXIT LAB</button></div>
      </header>

      <div className="physical-main">
        <section className="physical-stage">
          <div className="physical-stage-meta"><div><span>RENDERER</span><strong>{webglError ? 'FALLBACK' : 'WEBGL 2'}</strong></div><div><span>PUBLIC FACILITIES</span><strong>{loading ? 'LOADING' : snapshot?.facilities.length ?? 'UNAVAILABLE'}</strong></div><div><span>VISIBLE POINTS</span><strong>{visibleFacilities.length}</strong></div><div><span>CORRIDOR</span><strong>{corridorA && corridorB ? 'INFERRED' : 'OFF'}</strong></div></div>
          <div className="globe-viewport">
            <div ref={hostRef} className="globe-render-host" aria-label="Interactive WebGL globe of public Internet interconnection facilities" />
            <div className="globe-reticle" aria-hidden="true"><i/><i/></div>
            <div className="globe-watermark"><strong>PHYSICAL INFRASTRUCTURE ≠ FORWARDING PATH</strong><span>DRAG TO ROTATE · SCROLL TO ZOOM · CLICK A FACILITY</span></div>
            {loading && <div className="globe-loading"><i/><strong>QUERYING PUBLIC INFRASTRUCTURE</strong><span>ONE BOUNDED PEERINGDB REQUEST</span></div>}
            {webglError && <div className="globe-fallback"><strong>WEBGL 2 UNAVAILABLE</strong><span>{webglError}</span><p>Public facility records remain inspectable in the list; HOPSCOTCH will not substitute a fake 3D renderer.</p></div>}
            {dataError && <div className="globe-data-error"><strong>PUBLIC DATA UNAVAILABLE</strong><span>{dataError}</span></div>}
          </div>
          <div className={`corridor-strip ${corridorA && corridorB ? 'active' : ''}`}><span>INFERRED GEOMETRIC CORRIDOR</span><strong>{corridorA && corridorB ? `${corridorA.name} → ${corridorB.name}` : 'SELECT TWO FACILITIES'}</strong><p>{corridorA && corridorB ? 'A great-circle visualization between two public coordinates. This is not a measured route, cable, peering relationship, or proof of traffic traversal.' : 'Select a public facility, assign corridor A/B, then HOPSCOTCH can draw geometry without claiming connectivity.'}</p></div>
        </section>

        <aside className="physical-panel">
          <section className="facility-inspector"><div className="physical-panel-title"><span>PUBLIC DATA</span><strong>FACILITY INSPECTOR</strong></div>{selectedFacility ? <><h2>{selectedFacility.name}</h2><p>{facilityLocation(selectedFacility)}</p><dl><div><dt>PEERINGDB ID</dt><dd>{selectedFacility.id}</dd></div><div><dt>COORDINATES</dt><dd>{selectedFacility.latitude.toFixed(4)}, {selectedFacility.longitude.toFixed(4)}</dd></div><div><dt>NETWORKS</dt><dd>{selectedFacility.networkCount ?? '—'}</dd></div><div><dt>EXCHANGES</dt><dd>{selectedFacility.exchangeCount ?? '—'}</dd></div></dl><div className="physical-buttons"><button type="button" className={corridorAId === selectedFacility.id ? 'active' : ''} onClick={() => setCorridorAId(selectedFacility.id)}>SET CORRIDOR A</button><button type="button" className={corridorBId === selectedFacility.id ? 'active' : ''} onClick={() => setCorridorBId(selectedFacility.id)}>SET CORRIDOR B</button></div></> : <p className="physical-empty-copy">Click one of the facility points on the globe.</p>}</section>
          <section><div className="physical-panel-title"><span>VIEW</span><strong>SCENE DENSITY</strong></div><button className="density-button" type="button" onClick={cycleDensity}><span>VISIBLE PUBLIC POINTS</span><strong>{density}</strong><i>{density === 80 ? 'FOCUS' : density === 150 ? 'BALANCED' : 'DENSE'}</i></button><label>CAMERA DISTANCE<input type="range" min="2.15" max="4.6" step="0.05" value={zoom} onChange={(event) => setZoom(Number(event.currentTarget.value))}/></label></section>
          <section><div className="physical-panel-title"><span>FACILITIES</span><strong>{visibleFacilities.length} / {snapshot?.facilities.length ?? 0}</strong></div><div className="facility-list">{visibleFacilities.slice(0, 30).map((facility) => <button type="button" key={facility.id} className={facility.id === selectedId ? 'active' : ''} onClick={() => setSelectedId(facility.id)}><span>{facility.name}</span><small>{facilityLocation(facility)}</small></button>)}</div></section>
          <section className="physical-provenance"><div className="physical-panel-title"><span>PROVENANCE</span><strong>TRUTH BOUNDARY</strong></div><p><b>PUBLIC DATA</b> points are PeeringDB facility locations. The yellow corridor is <b>INFERRED</b> geometry only. No submarine cable, IX relationship, or packet path is claimed by this scene.</p><small>{snapshot?.note ?? 'Waiting for public infrastructure data.'}</small></section>
        </aside>
      </div>
    </motion.section>
  );
}
