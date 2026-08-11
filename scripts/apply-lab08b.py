from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise SystemExit(f'missing Lab 08B patch anchor in {path}: {old[:160]!r}')
    file.write_text(text.replace(old, new, 1))


# InternetScaleTheater: optional graph injection, same default graph/UI.
replace_once(
    'src/InternetScaleTheater.tsx',
    "  type AsRelationship,\n} from './internet/asModel';",
    "  type AsRelationship,\n  type SimulatedAsGraph,\n} from './internet/asModel';",
)
replace_once(
    'src/InternetScaleTheater.tsx',
    "function pointFor(asn: number, width: number, height: number, zoom: number): { x: number; y: number } {\n  const node = simulatedAsGraph.nodes.find((item) => item.asn === asn);",
    "function pointFor(graph: SimulatedAsGraph, asn: number, width: number, height: number, zoom: number): { x: number; y: number } {\n  const node = graph.nodes.find((item) => item.asn === asn);",
)
replace_once(
    'src/InternetScaleTheater.tsx',
    "export function InternetScaleTheater({ onExit, onOpenObserved }: { onExit: () => void; onOpenObserved: () => void }) {",
    "export function InternetScaleTheater({ onExit, onOpenObserved, graph = simulatedAsGraph, initialSource = DEFAULT_AS_SOURCE, initialDestination = DEFAULT_AS_DESTINATION, stressLabel }: { onExit: () => void; onOpenObserved: () => void; graph?: SimulatedAsGraph; initialSource?: number; initialDestination?: number; stressLabel?: string }) {",
)
replace_once(
    'src/InternetScaleTheater.tsx',
    "  const [source, setSource] = useState(DEFAULT_AS_SOURCE);\n  const [destination, setDestination] = useState(DEFAULT_AS_DESTINATION);\n  const [failed, setFailed] = useState<Set<string>>(() => new Set());\n  const [selectedRelationshipId, setSelectedRelationshipId] = useState('src-p1');",
    "  const [source, setSource] = useState(initialSource);\n  const [destination, setDestination] = useState(initialDestination);\n  const [failed, setFailed] = useState<Set<string>>(() => new Set());\n  const [selectedRelationshipId, setSelectedRelationshipId] = useState(() => graph.relationships[0]?.id ?? '');",
)
replace_once(
    'src/InternetScaleTheater.tsx',
    "  const candidates = useMemo(() => enumeratePolicyPaths(simulatedAsGraph, source, destination, failed), [source, destination, failed]);\n  const winner = candidates[0];\n  const selectedRelationship = simulatedAsGraph.relationships.find((item) => item.id === selectedRelationshipId) ?? simulatedAsGraph.relationships[0];",
    "  const candidates = useMemo(() => enumeratePolicyPaths(graph, source, destination, failed), [graph, source, destination, failed]);\n  const winner = candidates[0];\n  const selectedRelationship = graph.relationships.find((item) => item.id === selectedRelationshipId) ?? graph.relationships[0];",
)

path = Path('src/InternetScaleTheater.tsx')
text = path.read_text()
text = text.replace('simulatedAsGraph.relationships', 'graph.relationships').replace('simulatedAsGraph.nodes', 'graph.nodes')
for old, new in [
    ('pointFor(aAsn,', 'pointFor(graph, aAsn,'),
    ('pointFor(bAsn,', 'pointFor(graph, bAsn,'),
    ('pointFor(winner.asns[segment],', 'pointFor(graph, winner.asns[segment],'),
    ('pointFor(winner.asns[segment + 1],', 'pointFor(graph, winner.asns[segment + 1],'),
    ('pointFor(node.asn,', 'pointFor(graph, node.asn,'),
    ('pointFor(aa,', 'pointFor(graph, aa,'),
    ('pointFor(bb,', 'pointFor(graph, bb,'),
]:
    text = text.replace(old, new)
text = text.replace(
    '[activeRelationships, dense, destination, failed, reduceMotion, selectedRelationshipId, source, winner, zoom]',
    '[activeRelationships, dense, destination, failed, graph, reduceMotion, selectedRelationshipId, source, winner, zoom]',
)
text = text.replace(
    '<motion.section className="internet-scale"',
    '<motion.section className="internet-scale" data-stress-label={stressLabel} data-node-count={graph.nodes.length} data-relationship-count={graph.relationships.length}',
    1,
)
path.write_text(text)

# NetworkBuilder: optional initial graph/layout/endpoints, identical defaults.
replace_once(
    'src/NetworkBuilder.tsx',
    "export function NetworkBuilder({ onExit, onOpenFailureStory }: { onExit: () => void; onOpenFailureStory: () => void }) {",
    "export function NetworkBuilder({ onExit, onOpenFailureStory, initialGraph = defaultBuilderGraph, initialLayout = defaultBuilderLayout, initialSourceId = 'client', initialDestinationId = 'app', stressLabel }: { onExit: () => void; onOpenFailureStory: () => void; initialGraph?: BuilderGraph; initialLayout?: BuilderLayout; initialSourceId?: string; initialDestinationId?: string; stressLabel?: string }) {",
)
replace_once(
    'src/NetworkBuilder.tsx',
    "  const [graph, setGraph] = useState<BuilderGraph>(() => cloneBuilderGraph(defaultBuilderGraph));\n  const [layout, setLayout] = useState<BuilderLayout>(() => cloneBuilderLayout(defaultBuilderLayout));\n  const [sourceId, setSourceId] = useState('client');\n  const [destinationId, setDestinationId] = useState('app');\n  const [selectedLinkId, setSelectedLinkId] = useState('r1-core');\n  const [newLinkA, setNewLinkA] = useState('edge');\n  const [newLinkB, setNewLinkB] = useState('core');",
    "  const [graph, setGraph] = useState<BuilderGraph>(() => cloneBuilderGraph(initialGraph));\n  const [layout, setLayout] = useState<BuilderLayout>(() => cloneBuilderLayout(initialLayout));\n  const [sourceId, setSourceId] = useState(initialSourceId);\n  const [destinationId, setDestinationId] = useState(initialDestinationId);\n  const [selectedLinkId, setSelectedLinkId] = useState(() => initialGraph.links[0]?.id ?? '');\n  const [newLinkA, setNewLinkA] = useState(() => initialGraph.nodes[0]?.id ?? '');\n  const [newLinkB, setNewLinkB] = useState(() => initialGraph.nodes[1]?.id ?? initialGraph.nodes[0]?.id ?? '');",
)
replace_once(
    'src/NetworkBuilder.tsx',
    "    setGraph(cloneBuilderGraph(defaultBuilderGraph));\n    setSourceId('client'); setDestinationId('app'); setSelectedLinkId('r1-core'); setNewLinkA('edge'); setNewLinkB('core'); setNewLinkCost(5);",
    "    setGraph(cloneBuilderGraph(initialGraph));\n    setSourceId(initialSourceId); setDestinationId(initialDestinationId); setSelectedLinkId(initialGraph.links[0]?.id ?? ''); setNewLinkA(initialGraph.nodes[0]?.id ?? ''); setNewLinkB(initialGraph.nodes[1]?.id ?? initialGraph.nodes[0]?.id ?? ''); setNewLinkCost(5);",
)
replace_once(
    'src/NetworkBuilder.tsx',
    "    const next = cloneBuilderLayout(defaultBuilderLayout);",
    "    const next = cloneBuilderLayout(initialLayout);",
)
replace_once(
    'src/NetworkBuilder.tsx',
    '<motion.section className="builder-workspace"',
    '<motion.section className="builder-workspace" data-stress-label={stressLabel} data-node-count={graph.nodes.length} data-link-count={graph.links.length}',
)

# PhysicalInternetGlobe: optional SIMULATED stress points, never mislabeled PUBLIC DATA.
replace_once(
    'src/PhysicalInternetGlobe.tsx',
    "const DENSITY_LEVELS = [80, 150, 250] as const;",
    "export interface PhysicalStressFacility {\n  id: number; name: string; city: string | null; country: string | null; latitude: number; longitude: number; networkCount: number | null; exchangeCount: number | null;\n}\n\nconst DENSITY_LEVELS = [80, 150, 250] as const;",
)
replace_once(
    'src/PhysicalInternetGlobe.tsx',
    "function facilityLocation(facility: PublicInfrastructureFacility): string {",
    "function facilityLocation(facility: Pick<PublicInfrastructureFacility, 'city' | 'country'>): string {",
)
replace_once(
    'src/PhysicalInternetGlobe.tsx',
    "  onOpenObserved,\n}: {\n  onExit: () => void;\n  onOpenSimulated: () => void;\n  onOpenObserved: () => void;\n}) {",
    "  onOpenObserved,\n  stressFacilities,\n  stressPointLimit = 2000,\n}: {\n  onExit: () => void;\n  onOpenSimulated: () => void;\n  onOpenObserved: () => void;\n  stressFacilities?: PhysicalStressFacility[];\n  stressPointLimit?: number;\n}) {",
)
replace_once(
    'src/PhysicalInternetGlobe.tsx',
    "  const visibleFacilities = useMemo(() => {\n    const facilities = snapshot?.facilities ?? [];\n    return facilities.slice(0, Math.min(density, facilities.length));\n  }, [density, snapshot]);\n  const selectedFacility = useMemo(() => snapshot?.facilities.find((facility) => facility.id === selectedId) ?? null, [selectedId, snapshot]);\n  const corridorA = useMemo(() => snapshot?.facilities.find((facility) => facility.id === corridorAId) ?? null, [corridorAId, snapshot]);\n  const corridorB = useMemo(() => snapshot?.facilities.find((facility) => facility.id === corridorBId) ?? null, [corridorBId, snapshot]);",
    "  const stressMode = stressFacilities !== undefined;\n  const allFacilities = useMemo(() => stressFacilities ?? snapshot?.facilities ?? [], [snapshot, stressFacilities]);\n  const visibleFacilities = useMemo(() => {\n    const limit = stressMode ? stressPointLimit : density;\n    return allFacilities.slice(0, Math.min(limit, allFacilities.length));\n  }, [allFacilities, density, stressMode, stressPointLimit]);\n  const selectedFacility = useMemo(() => allFacilities.find((facility) => facility.id === selectedId) ?? null, [allFacilities, selectedId]);\n  const corridorA = useMemo(() => allFacilities.find((facility) => facility.id === corridorAId) ?? null, [allFacilities, corridorAId]);\n  const corridorB = useMemo(() => allFacilities.find((facility) => facility.id === corridorBId) ?? null, [allFacilities, corridorBId]);",
)
replace_once(
    'src/PhysicalInternetGlobe.tsx',
    "  useEffect(() => {\n    const controller = new AbortController();",
    "  useEffect(() => {\n    if (stressFacilities) {\n      setLoading(false); setDataError(null); setSnapshot(null); setSelectedId(stressFacilities[0]?.id ?? null);\n      return;\n    }\n    const controller = new AbortController();",
)
replace_once(
    'src/PhysicalInternetGlobe.tsx',
    "  }, []);\n\n  useEffect(() => {\n    const host = hostRef.current;",
    "  }, [stressFacilities]);\n\n  useEffect(() => {\n    const host = hostRef.current;",
)
replace_once(
    'src/PhysicalInternetGlobe.tsx',
    '<motion.section className="physical-globe"',
    '<motion.section className="physical-globe" data-stress-mode={stressMode ? "true" : "false"} data-point-count={visibleFacilities.length}',
)
replace_once(
    'src/PhysicalInternetGlobe.tsx',
    '<div className="physical-heading-actions"><span>PUBLIC DATA · PEERINGDB</span>',
    '<div className="physical-heading-actions"><span>{stressMode ? "SIMULATED · STRESS FIXTURE" : "PUBLIC DATA · PEERINGDB"}</span>',
)
replace_once(
    'src/PhysicalInternetGlobe.tsx',
    '<div className="physical-stage-meta"><div><span>RENDERER</span><strong>{webglError ? \'FALLBACK\' : \'WEBGL 2\'}</strong></div><div><span>PUBLIC FACILITIES</span><strong>{loading ? \'LOADING\' : snapshot?.facilities.length ?? \'UNAVAILABLE\'}</strong></div><div><span>VISIBLE POINTS</span><strong>{visibleFacilities.length}</strong></div>',
    '<div className="physical-stage-meta"><div><span>RENDERER</span><strong>{webglError ? \'FALLBACK\' : \'WEBGL 2\'}</strong></div><div><span>{stressMode ? \'STRESS POINTS\' : \'PUBLIC FACILITIES\'}</span><strong>{loading ? \'LOADING\' : allFacilities.length || \'UNAVAILABLE\'}</strong></div><div><span>VISIBLE POINTS</span><strong>{visibleFacilities.length}</strong></div>',
)
replace_once(
    'src/PhysicalInternetGlobe.tsx',
    '<div className="globe-watermark"><strong>PHYSICAL INFRASTRUCTURE ≠ FORWARDING PATH</strong><span>DRAG TO ROTATE · SCROLL TO ZOOM · CLICK A FACILITY</span></div>',
    '<div className="globe-watermark"><strong>{stressMode ? \'SIMULATED STRESS POINTS · NOT PUBLIC DATA\' : \'PHYSICAL INFRASTRUCTURE ≠ FORWARDING PATH\'}</strong><span>DRAG TO ROTATE · SCROLL TO ZOOM · CLICK A FACILITY</span></div>',
)
replace_once(
    'src/PhysicalInternetGlobe.tsx',
    '<section className="facility-inspector"><div className="physical-panel-title"><span>PUBLIC DATA</span><strong>FACILITY INSPECTOR</strong></div>',
    '<section className="facility-inspector"><div className="physical-panel-title"><span>{stressMode ? \'SIMULATED STRESS\' : \'PUBLIC DATA\'}</span><strong>FACILITY INSPECTOR</strong></div>',
)
replace_once(
    'src/PhysicalInternetGlobe.tsx',
    '<section><div className="physical-panel-title"><span>FACILITIES</span><strong>{visibleFacilities.length} / {snapshot?.facilities.length ?? 0}</strong></div>',
    '<section><div className="physical-panel-title"><span>{stressMode ? \'STRESS POINTS\' : \'FACILITIES\'}</span><strong>{visibleFacilities.length} / {allFacilities.length}</strong></div>',
)
replace_once(
    'src/PhysicalInternetGlobe.tsx',
    '<section className="physical-provenance"><div className="physical-panel-title"><span>PROVENANCE</span><strong>TRUTH BOUNDARY</strong></div><p><b>PUBLIC DATA</b> points are PeeringDB facility locations. The yellow corridor is <b>INFERRED</b> geometry only. No submarine cable, IX relationship, or packet path is claimed by this scene.</p><small>{snapshot?.note ?? \'Waiting for public infrastructure data.\'}</small></section>',
    '<section className="physical-provenance"><div className="physical-panel-title"><span>PROVENANCE</span><strong>TRUTH BOUNDARY</strong></div><p>{stressMode ? <><b>SIMULATED</b> points exist only to load-test the real WebGL renderer. They are not PeeringDB records, facilities, routes, or measured infrastructure.</> : <><b>PUBLIC DATA</b> points are PeeringDB facility locations. The yellow corridor is <b>INFERRED</b> geometry only. No submarine cable, IX relationship, or packet path is claimed by this scene.</>}</p><small>{stressMode ? \'LAB 08B · deterministic renderer fixture\' : snapshot?.note ?? \'Waiting for public infrastructure data.\'}</small></section>',
)
