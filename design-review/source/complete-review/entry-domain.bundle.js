(()=>{const modules={"workspace-catalog.ts":(exports,read)=>{
                                                       

                                
             
             
             
            
         
         
         
          
              
              
              
              
              

                                                                   
                                                                    
                                                                

                                      
                                  
                        
                               
                        
                                
                               
                        
                          
                                              
                       
                                         
                                 
    
 

                                         
                              
                         
                               
                                                       
 

const WORKSPACE_IDS = [
  'journey',
  'failure',
  'builder',
  'packet',
  'tcp',
  'dns',
  'tls',
  'http',
  'internet',
  'physical',
  'observed',
  'measured',
  'capture',
]                                                 ;

const FEATURED_WORKSPACE_IDS = ['journey', 'failure', 'builder']                                                  ;

const WORKSPACE_CATALOG                                                            = Object.freeze({
  journey: {
    id: 'journey',
    path: '/journey',
    layer: 'application',
    name: 'URL Journey',
    exploreTitle: 'Watch a request',
    description: 'Follow one HTTPS request across DNS, routing, transport, TLS, HTTP, packets, failures, and recovery.',
    meta: 'END TO END · CANONICAL TIME · SHAREABLE',
    status: 'URL JOURNEY ACTIVE',
    group: 'featured',
    featured: { tone: 'watch', actionLabel: 'Play URL journey' },
  },
  failure: {
    id: 'failure',
    path: '/labs/failure',
    layer: 'routing',
    name: 'Failure Story',
    exploreTitle: 'Break the network',
    description: 'Fail the active route and watch convergence, recomputation, failover, and the causal chain unfold.',
    meta: 'FAILURE · RECOVERY · TIME',
    status: 'FAILURE STORY ACTIVE',
    group: 'featured',
    featured: { tone: 'break', actionLabel: 'Run failure story' },
  },
  builder: {
    id: 'builder',
    path: '/labs/builder',
    layer: 'routing',
    name: 'Network Builder',
    exploreTitle: 'Build a network',
    description: 'Author topology and configuration, run probes, troubleshoot faults, use the CLI, rewind canonical time, and explain why the network behaves as it does.',
    meta: 'AUTHOR · PROBE · TROUBLESHOOT · EXPLAIN',
    status: 'NETWORK BUILDER ACTIVE',
    group: 'featured',
    featured: { tone: 'build', actionLabel: 'Open network builder' },
  },
  packet: {
    id: 'packet',
    path: '/labs/packet',
    layer: 'packet',
    name: 'Packet Microscope',
    exploreTitle: 'Packet Microscope',
    description: 'Peel Ethernet, IP, TCP, UDP, and ICMP fields down to exact bytes and checksums.',
    meta: 'SIMULATED OR CAPTURED · EXACT BYTES',
    status: 'PACKET TRACE ACTIVE',
    group: 'protocols',
  },
  tcp: {
    id: 'tcp',
    path: '/labs/tcp',
    layer: 'transport',
    name: 'TCP Theater',
    exploreTitle: 'TCP Theater',
    description: 'Handshake, sequence space, loss, retransmission, congestion response, and teardown.',
    meta: 'STATE MACHINE · SEQ / ACK · RECOVERY',
    status: 'TCP THEATER ACTIVE',
    group: 'protocols',
  },
  dns: {
    id: 'dns',
    path: '/labs/dns',
    layer: 'application',
    name: 'DNS Theater',
    exploreTitle: 'DNS Theater',
    description: 'Recursive resolution, cache behavior, TTLs, retries, and visible failure boundaries.',
    meta: 'CACHE · RECURSION · TTL',
    status: 'DNS THEATER ACTIVE',
    group: 'protocols',
  },
  tls: {
    id: 'tls',
    path: '/labs/tls',
    layer: 'application',
    name: 'TLS 1.3 Theater',
    exploreTitle: 'TLS 1.3 Theater',
    description: 'Handshake negotiation, key schedule, certificate boundary, and encrypted application data.',
    meta: 'TLS 1.3 · KEYS · ENCRYPTION',
    status: 'TLS 1.3 THEATER ACTIVE',
    group: 'protocols',
  },
  http: {
    id: 'http',
    path: '/labs/http2-vs-http3',
    layer: 'application',
    name: 'HTTP/2 vs HTTP/3',
    exploreTitle: 'HTTP/2 vs HTTP/3',
    description: 'Compare multiplexing, TCP head-of-line blocking, QUIC streams, and recovery behavior.',
    meta: 'H2/TCP · H3/QUIC · MULTIPLEXING',
    status: 'HTTP/2 ↔ HTTP/3 ACTIVE',
    group: 'protocols',
  },
  internet: {
    id: 'internet',
    path: '/internet/as-routing',
    layer: 'internet',
    name: 'AS Routing Theater',
    exploreTitle: 'AS routing theater',
    description: 'Explore deterministic interdomain relationships, valley-free policy, path selection, and route leaks.',
    meta: 'SIMULATED · POLICY · BGP',
    status: 'SIMULATED AS THEATER ACTIVE',
    group: 'internet',
  },
  physical: {
    id: 'physical',
    path: '/internet/physical',
    layer: 'internet',
    name: 'Physical Internet Atlas',
    exploreTitle: 'Physical Internet atlas',
    description: 'See facilities and physical Internet context on the globe without turning geography into forwarding truth.',
    meta: 'PUBLIC DATA · INFERRED CORRIDORS',
    status: 'PHYSICAL INTERNET ATLAS ACTIVE',
    group: 'internet',
  },
  observed: {
    id: 'observed',
    path: '/internet/observed',
    layer: 'internet',
    name: 'Internet Evidence',
    exploreTitle: 'Internet evidence',
    description: 'Inspect edge-observed and public-collector evidence with explicit vantage and provenance boundaries.',
    meta: 'EDGE OBSERVED · PUBLIC COLLECTOR',
    status: 'INTERNET EVIDENCE ACTIVE',
    group: 'internet',
  },
  measured: {
    id: 'measured',
    path: '/measured',
    layer: 'internet',
    name: 'Measured Network',
    exploreTitle: 'Measured network',
    description: 'Inspect imported or loopback-bridged local diagnostics without confusing one host vantage with Internet truth.',
    meta: 'LOCAL MEASURED · EXPLICIT VANTAGE',
    status: 'LOCAL MEASURED ACTIVE',
    group: 'evidence',
  },
  capture: {
    id: 'capture',
    path: '/capture',
    layer: 'packet',
    name: 'Capture Replay',
    exploreTitle: 'Capture Replay',
    description: 'Open a local PCAP/PCAPNG, follow conversations and time, inspect exact bytes, and keep missing evidence explicit.',
    meta: 'CAPTURED · LOCAL ONLY · SESSION MEMORY',
    status: 'CAPTURED EVIDENCE ACTIVE',
    group: 'evidence',
  },
});

const EXPLORE_GROUPS = [
  {
    id: 'protocols',
    label: 'Protocols + packets',
    description: 'Zoom into one packet or one protocol machine without losing the causal model.',
    workspaceIds: ['packet', 'tcp', 'dns', 'tls', 'http'],
  },
  {
    id: 'internet',
    label: 'Internet scale',
    description: 'Separate deterministic policy simulation from observed/public evidence and physical context.',
    workspaceIds: ['internet', 'observed', 'physical'],
  },
  {
    id: 'evidence',
    label: 'Evidence + measurement',
    description: 'Inspect real local or captured evidence while preserving vantage, uncertainty, and provenance.',
    workspaceIds: ['measured', 'capture'],
  },
]                                                     ;

const WORKSPACE_COUNT = WORKSPACE_IDS.length;

const WORKSPACE_PATHS                                               = Object.freeze(
  Object.fromEntries(WORKSPACE_IDS.map((id) => [id, WORKSPACE_CATALOG[id].path]))                                      ,
);

function workspaceDefinition(destination                    )                      {
  return WORKSPACE_CATALOG[destination];
}


Object.assign(exports,{WORKSPACE_IDS,FEATURED_WORKSPACE_IDS,WORKSPACE_CATALOG,EXPLORE_GROUPS,WORKSPACE_COUNT,WORKSPACE_PATHS,workspaceDefinition});
},
"navigation.ts":(exports,read)=>{
const {WORKSPACE_PATHS,}=read("workspace-catalog.ts");

                                                                             

                                     
                     
                                         
                        
                          
 

const OVERVIEW_PATH = '/';
const DESTINATION_PATHS = WORKSPACE_PATHS;

const PATH_DESTINATIONS = new Map                            (
  Object.entries(DESTINATION_PATHS).map(
    ([destination, path]) => [path, destination                      ]         ,
  ),
);

function normalizePathname(pathname        )         {
  const raw = pathname.trim() || OVERVIEW_PATH;
  if (raw === OVERVIEW_PATH) return OVERVIEW_PATH;
  return `/${raw.replace(/^\/+|\/+$/g, '')}`;
}

function hasJourneyShareQuery(search        )          {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const version = params.get('journey');
  return version === '1' || version === '2';
}

function pathForDestination(destination                    )         {
  return DESTINATION_PATHS[destination];
}

function resolveAppRoute(pathname        , search = '')                     {
  const normalizedPath = normalizePathname(pathname);
  const destination = PATH_DESTINATIONS.get(normalizedPath) ?? null;

  if (destination) {
    return {
      kind: 'lab',
      destination,
      canonicalPath: DESTINATION_PATHS[destination],
      preserveSearch: destination === 'journey' && hasJourneyShareQuery(search),
    };
  }

  if (normalizedPath === OVERVIEW_PATH) {
    if (hasJourneyShareQuery(search)) {
      return {
        kind: 'legacy-journey',
        destination: 'journey',
        canonicalPath: DESTINATION_PATHS.journey,
        preserveSearch: true,
      };
    }
    return { kind: 'overview', destination: null, canonicalPath: OVERVIEW_PATH, preserveSearch: false };
  }

  return { kind: 'unknown', destination: null, canonicalPath: OVERVIEW_PATH, preserveSearch: false };
}

function canonicalUrlForRoute(route                    , search = '')         {
  return `${route.canonicalPath}${route.preserveSearch ? search : ''}`;
}


Object.assign(exports,{OVERVIEW_PATH,DESTINATION_PATHS,pathForDestination,resolveAppRoute,canonicalUrlForRoute});
},
"catalog.ts":(exports,read)=>{
                              
                
                    
                 
                
                
               
                
                

                                     
                       
                 
                
                      
               
 

const SCENARIO_PRESET_CARDS                                = [
  {
    id: 'dns-outage',
    kicker: 'DNS',
    title: 'Resolver stops answering',
    description: 'Watch a cache miss hit a DNS timeout, retry, and recovery before transport can even begin.',
    meta: 'TIMEOUT · RETRY · RECOVERY',
  },
  {
    id: 'route-failover',
    kicker: 'ROUTING',
    title: 'Primary route disappears',
    description: 'Fail the preferred path before transport and watch SPF invalidate it, recompute, and install the alternate.',
    meta: 'OSPF MODEL · FAILOVER',
  },
  {
    id: 'path-outage',
    kicker: 'CROSS-LAYER',
    title: 'Path dies mid-transfer',
    description: 'Break forwarding after data is already moving and separate route recovery from transport loss recovery.',
    meta: 'ROUTE LOSS · RTO / PTO',
  },
  {
    id: 'congestion',
    kicker: 'TRANSPORT',
    title: 'Queue starts growing',
    description: 'Watch queue pressure, ECN feedback, and congestion-window response without fabricating packet loss.',
    meta: 'QUEUE · ECN · CWND',
  },
  {
    id: 'route-leak',
    kicker: 'BGP POLICY',
    title: 'Reachable but wrong',
    description: 'See a leaked advertisement win on local preference even though the selected AS path violates valley-free policy.',
    meta: 'LOCAL_PREF · POLICY ANOMALY',
  },
  {
    id: 'partition',
    kicker: 'FAILURE',
    title: 'The network partitions',
    description: 'Cut every surviving route and watch established transport stall into a terminal network-unreachable state.',
    meta: 'NO ROUTE · TERMINAL',
  },
  {
    id: 'server-503',
    kicker: 'HTTP',
    title: 'Server returns 503',
    description: 'Keep the network and connection healthy while the service fails, waits on Retry-After, and safely retries GET.',
    meta: '503 · RETRY-AFTER · REUSE',
  },
  {
    id: 'quic-loss',
    kicker: 'HTTP/3',
    title: 'Lose a QUIC packet',
    description: 'Drop one HTTP/3 data packet and watch ACK ranges expose the gap before STREAM data is retransmitted.',
    meta: 'QUIC · ACK RANGES · STREAM',
  },
]         ;


Object.assign(exports,{SCENARIO_PRESET_CARDS});
},
"asModel.ts":(exports,read)=>{
                                                                                         
                                                              
                                                   

                                  
              
                
               
            
            
 

                                               
             
                            
                   
                   
 

                                   
             
               
            
            
 

                                                                             

                                   
                           
                                  
 

                            
                         
               
             
                           
 

                                  
                 
                            
                    
                          
                     
 

const DOCUMENTATION_ASNS           = [
  ...Array.from({ length: 16 }, (_, index) => 64496 + index),
  ...Array.from({ length: 16 }, (_, index) => 65536 + index),
];

function isDocumentationAsn(asn        )          { return DOCUMENTATION_ASNS.includes(Number(asn)); }

                                                                           
function relationshipExportAllowed(learnedFrom                   , advertiseTo                                     )          {
  return learnedFrom === 'local' || learnedFrom === 'customer' || advertiseTo === 'customer';
}

function documentationAsns()           { return [...DOCUMENTATION_ASNS]; }

function roleFor(asn        )         {
  if (asn >= 64496 && asn <= 64499) return 'access';
  if (asn >= 64500 && asn <= 64503) return 'regional';
  if (asn >= 64504 && asn <= 64507) return 'transit';
  if (asn >= 64508 && asn <= 64511) return 'content';
  if (asn === 65538 || asn === 65539 || asn >= 65548) return 'content';
  if (asn >= 65540 && asn <= 65543) return 'transit';
  if (asn >= 65544 && asn <= 65547) return 'regional';
  return 'access';
}

function buildNodes()                    {
  return documentationAsns().map((asn, index) => {
    const side = index < 16 ? 0 : 1;
    const local = index % 16;
    const column = local % 4;
    const row = Math.floor(local / 4);
    const x = side === 0 ? 10 + column * 10.5 : 57 + column * 10.5;
    const y = 16 + row * 22;
    return { asn, label: `AS${asn}`, role: roleFor(asn), x, y };
  });
}

function cp(id        , customer        , provider        )                               {
  return { id, kind: 'customer-provider', customer, provider };
}

function peer(id        , a        , b        )                   {
  return { id, kind: 'peer', a, b };
}

function buildRelationships()                   {
  const relationships                   = [
    cp('src-p1', 64496, 64500),
    cp('src-p2', 64496, 64501),
    peer('p1-content', 64500, 65538),
    peer('p2-cross', 64501, 65540),
    cp('content-upstream', 65538, 65540),
    cp('a1-p1', 64497, 64500), cp('a1-p2', 64497, 64502),
    cp('a2-p1', 64498, 64501), cp('a2-p2', 64498, 64503),
    cp('a3-p1', 64499, 64502), cp('a3-p2', 64499, 64503),
    cp('reg0-t0', 64500, 64504), cp('reg0-t1', 64500, 64505),
    cp('reg1-t0', 64501, 64504), cp('reg1-t1', 64501, 64506),
    cp('reg2-t0', 64502, 64505), cp('reg2-t1', 64502, 64507),
    cp('reg3-t0', 64503, 64506), cp('reg3-t1', 64503, 64507),
    peer('ta-0-1', 64504, 64505), peer('ta-1-2', 64505, 64506), peer('ta-2-3', 64506, 64507), peer('ta-3-0', 64507, 64504),
    cp('ca0', 64508, 64504), cp('ca1', 64509, 64505), cp('ca2', 64510, 64506), cp('ca3', 64511, 64507),
    cp('baccess0', 65536, 65544), cp('baccess0b', 65536, 65545),
    cp('baccess1', 65537, 65544), cp('baccess1b', 65537, 65546),
    cp('breg0', 65544, 65540), cp('breg1', 65545, 65541), cp('breg2', 65546, 65542), cp('breg3', 65547, 65543),
    peer('tb-0-1', 65540, 65541), peer('tb-1-2', 65541, 65542), peer('tb-2-3', 65542, 65543), peer('tb-3-0', 65543, 65540),
    peer('cross-t0', 64504, 65540), peer('cross-t1', 64505, 65541), peer('cross-t2', 64506, 65542), peer('cross-t3', 64507, 65543),
    cp('cb1', 65539, 65541), cp('cb2', 65548, 65540), cp('cb3', 65549, 65541), cp('cb4', 65550, 65542), cp('cb5', 65551, 65543),
  ];
  return relationships;
}

const simulatedAsGraph                   = {
  nodes: buildNodes(),
  relationships: buildRelationships(),
};

const DEFAULT_AS_SOURCE = 64496;
const DEFAULT_AS_DESTINATION = 65538;

function endpoints(relationship                )                   {
  return relationship.kind === 'peer' ? [relationship.a, relationship.b] : [relationship.customer, relationship.provider];
}

function traversalFor(relationship                , from        , to        )                       {
  if (relationship.kind === 'peer') {
    return (relationship.a === from && relationship.b === to) || (relationship.b === from && relationship.a === to) ? 'peer' : null;
  }
  if (relationship.customer === from && relationship.provider === to) return 'up';
  if (relationship.provider === from && relationship.customer === to) return 'down';
  return null;
}

function validNextTraversal(phase                         , next               )          {
  if (phase === 'start') return true;
  if (phase === 'up') return next === 'up' || next === 'peer' || next === 'down';
  if (phase === 'peer') return next === 'down';
  return next === 'down';
}

function nextPhase(current                         , next               )                {
  if (next === 'down') return 'down';
  if (next === 'peer') return 'peer';
  return current === 'start' ? 'up' : current;
}

function firstHopPreference(hop                       )         {
  if (!hop) return 400;
  if (hop.traversal === 'down') return 300;
  if (hop.traversal === 'peer') return 200;
  return 100;
}

function enumeratePolicyPaths(graph                  , source        , destination        , failedRelationshipIds              = new Set(), maxHops = 7)                    {
  if (source === destination) return [{ asns: [source], relationshipIds: [], hops: [], localPreference: 400, scoreLabel: 'LOCAL · 0 AS HOPS' }];
  const adjacency = new Map                          ();
  graph.nodes.forEach((node) => adjacency.set(node.asn, []));
  graph.relationships.forEach((relationship) => {
    if (failedRelationshipIds.has(relationship.id)) return;
    const [a, b] = endpoints(relationship);
    adjacency.get(a)?.push(relationship);
    adjacency.get(b)?.push(relationship);
  });
  adjacency.forEach((items) => items.sort((a, b) => a.id.localeCompare(b.id)));

  const candidates                    = [];
  const visit = (current        , asns          , relationshipIds          , hops             , phase                         ) => {
    if (relationshipIds.length > maxHops) return;
    if (current === destination) {
      const localPreference = firstHopPreference(hops[0]);
      candidates.push({ asns: [...asns], relationshipIds: [...relationshipIds], hops: [...hops], localPreference, scoreLabel: `LOCAL PREF ${localPreference} · ${relationshipIds.length} AS HOPS` });
      return;
    }
    if (relationshipIds.length === maxHops) return;
    for (const relationship of adjacency.get(current) ?? []) {
      const [a, b] = endpoints(relationship);
      const next = a === current ? b : b === current ? a : null;
      if (next === null || asns.includes(next)) continue;
      const traversal = traversalFor(relationship, current, next);
      if (!traversal || !validNextTraversal(phase, traversal)) continue;
      visit(next, [...asns, next], [...relationshipIds, relationship.id], [...hops, { relationshipId: relationship.id, from: current, to: next, traversal }], nextPhase(phase, traversal));
    }
  };
  visit(source, [source], [], [], 'start');
  return candidates.sort((left, right) => right.localPreference - left.localPreference || left.relationshipIds.length - right.relationshipIds.length || left.asns.join('-').localeCompare(right.asns.join('-'))).slice(0, 12);
}

function relationshipLabel(relationship                , from         )         {
  if (relationship.kind === 'peer') return 'PEER';
  if (from === undefined) return 'CUSTOMER / PROVIDER';
  return relationship.customer === from ? 'TO PROVIDER' : 'TO CUSTOMER';
}

function relationshipEndpoints(relationship                )                   {
  return endpoints(relationship);
}


Object.assign(exports,{DOCUMENTATION_ASNS,isDocumentationAsn,relationshipExportAllowed,simulatedAsGraph,DEFAULT_AS_SOURCE,DEFAULT_AS_DESTINATION,traversalFor,enumeratePolicyPaths,relationshipLabel,relationshipEndpoints});
},
"modifiers.ts":(exports,read)=>{
             
               
                   
                           
                           
                    
                    
                       
                      
                       
               
                        
                          
                          
                       
                    
const {enumeratePolicyPaths, simulatedAsGraph, traversalFor}=read("asModel.ts");

                                         
                                
 

                                        
                         
                          
                                          
 

                           
                        
                
                                                                                        
 

const JOURNEY_MODIFIER_ORDER                               = ['dns-failure', 'route-failure', 'route-leak', 'server-failure', 'single-loss', 'path-outage', 'latency-spike', 'congestion', 'partition'];
const JOURNEY_MODIFIER_SET = new Set                   (JOURNEY_MODIFIER_ORDER);

function normalizeJourneyModifierIds(values                    )                      {
  const selected = new Set                   ();
  for (const value of values) {
    if (typeof value !== 'string' || !JOURNEY_MODIFIER_SET.has(value                     )) {
      throw new Error(`Unknown Journey modifier: ${String(value)}.`);
    }
    selected.add(value                     );
  }
  if (selected.has('route-failure') && selected.has('path-outage')) {
    throw new Error('Journey modifiers route-failure and path-outage are mutually exclusive.');
  }
  return JOURNEY_MODIFIER_ORDER.filter((id) => selected.has(id));
}

function resolveJourneyModifierIds(config                       )                      {
  if (config.modifierIds !== undefined) return normalizeJourneyModifierIds(config.modifierIds);
  if (config.impairmentProfile === 'clean') return [];
  if (config.impairmentProfile === 'composed') throw new Error('Composed Journey config requires modifierIds.');
  return normalizeJourneyModifierIds([config.impairmentProfile]);
}

function impairmentProfileForModifiers(modifierIds                              )                           {
  const normalized = normalizeJourneyModifierIds(modifierIds);
  if (normalized.length === 0) return 'clean';
  if (normalized.length === 1) return normalized[0];
  return 'composed';
}

function modifierEvent(input   
             
               
                         
                      
                             
                   
                
                
                  
                 
                
                  
                                        
                                 
                                             
                                               
                                       
                                       
                                     
 )               {
  const { provenance = 'SIMULATED', ...eventInput } = input;
  return { ...eventInput, provenance };
}

function requireRouteAnchors(events                , modifierId        ) {
  const gateway = events.find((current) => current.kind === 'route.gateway');
  const asPath = events.find((current) => current.id === 'as-path');
  const transportStart = events.find((current) => current.kind === 'transport.segment');
  if (!gateway || !asPath || !transportStart) throw new Error(`${modifierId} requires gateway, AS-path, and transport-start events.`);
  if (!(gateway.atMs < asPath.atMs && asPath.atMs < transportStart.atMs)) throw new Error(`${modifierId} requires gateway < AS path < transport start.`);
  return { gateway, asPath, transportStart };
}

function requireResponseAnchors(events                , modifierId        ) {
  const data = events.find((current) => current.kind === 'http.data');
  const packetFrame = events.find((current) => current.id === 'packet-frame');
  if (!data || !packetFrame) throw new Error(`${modifierId} requires response data and packet-frame events.`);
  return { data, packetFrame };
}

function shiftPostAnchor(events                , anchorMs        , deltaMs        )                 {
  return events.map((current) => current.atMs >= anchorMs ? { ...current, atMs: current.atMs + deltaMs } : current);
}

function tcpLossEvents(dataAtMs        )                 {
  return [
    modifierEvent({ id: 'tcp-loss', atMs: dataAtMs + 160, kind: 'transport.loss', scale: 'packet', zoom: 'in', protocol: 'TCP', phase: 'loss', title: 'TCP data segment is lost', summary: 'SEQ 2461–3920 disappears before the receiver.', detail: 'Later TCP bytes can arrive, but cumulative delivery cannot advance beyond the missing receive-next byte.', actor: 'network path', target: 'TCP receiver', detailLab: 'tcp' }),
    modifierEvent({ id: 'tcp-gap', atMs: dataAtMs + 400, kind: 'transport.loss-detected', scale: 'transport', zoom: 'out', protocol: 'TCP', phase: 'gap-detected', title: 'Three duplicate ACK 2461 signals expose the gap', summary: 'Repeated cumulative ACK 2461 tells the sender later bytes arrived beyond a missing range.', detail: 'Three duplicate ACKs trigger the curated fast-retransmit path; the application remains blocked behind the TCP byte gap.', actor: 'TCP receiver', target: 'TCP sender', detailLab: 'tcp' }),
    modifierEvent({ id: 'tcp-retransmit', atMs: dataAtMs + 700, kind: 'transport.retransmit', scale: 'packet', zoom: 'in', protocol: 'TCP', phase: 'retransmit', title: 'Fast retransmit sends SEQ 2461–3920 again', summary: 'The sender retransmits the missing TCP byte range without waiting for the normal retransmission timeout.', detail: 'The repair is a new transmission of the missing byte range; transport sequence semantics remain TCP-specific.', actor: 'TCP sender', target: 'TCP receiver', detailLab: 'tcp' }),
    modifierEvent({ id: 'tcp-recovered', atMs: dataAtMs + 1050, kind: 'transport.recovered', scale: 'application', zoom: 'out', protocol: 'HTTP/2', phase: 'loss-recovered', title: 'HTTP/2 delivery resumes', summary: 'The repaired gap lets the cumulative ACK advance from 2461 to 8301 and releases buffered response bytes.', detail: 'HTTP/2 did not repair the loss itself; TCP restored the ordered byte stream underneath it.', actor: 'TCP receiver', target: 'HTTP/2', detailLab: 'http' }),
  ];
}

function quicLossEvents(dataAtMs        )                 {
  return [
    modifierEvent({ id: 'quic-loss', atMs: dataAtMs + 160, kind: 'transport.loss', scale: 'packet', zoom: 'in', protocol: 'QUIC', phase: 'loss', title: 'QUIC packet 4108 is lost', summary: 'Packet 4108 carried STREAM offset 4096–5555 and disappears before the receiver.', detail: 'The QUIC packet number is lost permanently; recovery retransmits the STREAM data in a different packet number.', actor: 'network path', target: 'QUIC receiver', detailLab: 'http' }),
    modifierEvent({ id: 'quic-gap', atMs: dataAtMs + 400, kind: 'transport.loss-detected', scale: 'transport', zoom: 'out', protocol: 'QUIC', phase: 'gap-detected', title: 'ACK ranges expose packet-number gap 4108', summary: 'ACK ranges 4105–4107 and 4109–4112 show that packet 4108 is missing.', detail: 'QUIC loss detection works from packet-number/ACK-range state, not TCP cumulative duplicate ACK semantics.', actor: 'QUIC receiver', target: 'QUIC sender', detailLab: 'http' }),
    modifierEvent({ id: 'quic-retransmit', atMs: dataAtMs + 700, kind: 'transport.retransmit', scale: 'packet', zoom: 'in', protocol: 'QUIC', phase: 'retransmit', title: 'STREAM range is retransmitted in packet 4113', summary: 'STREAM offset 4096–5555 is sent again inside new QUIC packet number 4113.', detail: 'QUIC never retransmits packet number 4108. The data is retransmitted, but the new packet has a new packet number.', actor: 'QUIC sender', target: 'QUIC receiver', detailLab: 'http' }),
    modifierEvent({ id: 'quic-recovered', atMs: dataAtMs + 1050, kind: 'transport.recovered', scale: 'application', zoom: 'out', protocol: 'HTTP/3', phase: 'loss-recovered', title: 'HTTP/3 request stream resumes', summary: 'The repaired STREAM range closes the ordering gap on this HTTP/3 request stream.', detail: 'The affected stream can advance after its missing range arrives; no TCP sequence or cumulative-ACK state exists in this branch.', actor: 'QUIC receiver', target: 'HTTP/3', detailLab: 'http' }),
  ];
}

const singleLossModifier                  = {
  id: 'single-loss',
  order: 100,
  apply(events, context) {
    const { data, packetFrame } = requireResponseAnchors(events, 'single-loss');
    const addedDurationMs = 1600;
    const shifted = shiftPostAnchor(events, packetFrame.atMs, addedDurationMs);
    const injected = context.config.transportProfile === 'tcp-h2'
      ? tcpLossEvents(data.atMs)
      : quicLossEvents(data.atMs);
    return {
      events: [...shifted, ...injected].sort((a, b) => a.atMs - b.atMs),
      addedDurationMs,
      appliedModifierIds: ['single-loss'],
    };
  },
};


const PRIMARY_ROUTE                      = { primaryPathCost: 22, alternatePathCost: 52, activePath: 'primary' };
const BROKEN_ROUTE                      = { primaryPathCost: 22, alternatePathCost: 52, activePath: 'none', failedLinkId: 'r1-core' };
const ALTERNATE_ROUTE                      = { primaryPathCost: 22, alternatePathCost: 52, activePath: 'alternate', failedLinkId: 'r1-core' };

function routeFailureEvents(gatewayAtMs        )                 {
  return [
    modifierEvent({ id: 'route-primary-fails', atMs: gatewayAtMs + 160, kind: 'route.failure', scale: 'routing', zoom: 'hold', protocol: 'OSPF teaching model', phase: 'route-failure', title: 'Primary R1 → CORE link fails', summary: 'The selected cost-22 route breaks after the gateway has already been chosen.', detail: 'This failure occurs before TCP SYN or QUIC Initial. HOPSCOTCH isolates routing convergence here instead of inventing transport timeout behavior.', actor: 'R1', target: 'CORE', detailLab: 'failure', routeMetrics: BROKEN_ROUTE }),
    modifierEvent({ id: 'route-primary-invalidated', atMs: gatewayAtMs + 440, kind: 'route.invalidated', scale: 'routing', zoom: 'hold', protocol: 'OSPF teaching model', phase: 'route-invalidated', title: 'Installed primary route is invalidated', summary: 'Forwarding through the failed R1 → CORE edge is no longer viable.', detail: 'The physical failure is immediate; a replacement path is not installed until the control plane recomputes the surviving graph.', actor: 'edge router', target: 'routing table', detailLab: 'failure', routeMetrics: BROKEN_ROUTE }),
    modifierEvent({ id: 'route-spf-recompute', atMs: gatewayAtMs + 820, kind: 'route.recompute', scale: 'routing', zoom: 'hold', protocol: 'OSPF teaching model', phase: 'route-recompute', title: 'SPF evaluates the surviving graph', summary: 'The cost-52 route through R2 becomes the lowest-cost viable path.', detail: 'The primary route cost was 22. Once its failed edge is removed, EDGE → R2 → CORE is more expensive but reachable.', actor: 'edge router', target: 'SPF engine', detailLab: 'failure', routeMetrics: BROKEN_ROUTE }),
    modifierEvent({ id: 'route-alternate-installed', atMs: gatewayAtMs + 1180, kind: 'route.alternate-installed', scale: 'routing', zoom: 'hold', protocol: 'OSPF teaching model', phase: 'route-alternate-ready', title: 'Alternate cost-52 route installed', summary: 'Forwarding can continue through R2 before the transport handshake begins.', detail: 'Recovery comes from routing around the failed link. The failed R1 → CORE edge remains down.', actor: 'routing table', target: 'R2 next hop', detailLab: 'failure', routeMetrics: ALTERNATE_ROUTE }),
  ];
}

const routeFailureModifier                  = {
  id: 'route-failure',
  order: 90,
  apply(events) {
    const { gateway, asPath, transportStart } = requireRouteAnchors(events, 'route-failure');
    const addedDurationMs = 1400;
    const shifted = shiftPostAnchor(events, asPath.atMs, addedDurationMs);
    const injected = routeFailureEvents(gateway.atMs);
    const nextEvents = [...shifted, ...injected].sort((a, b) => a.atMs - b.atMs);
    const firstTransport = nextEvents.find((current) => current.kind === 'transport.segment');
    const alternate = nextEvents.find((current) => current.kind === 'route.alternate-installed');
    if (!firstTransport || !alternate || alternate.atMs >= firstTransport.atMs) throw new Error('route-failure must converge before transport begins.');
    if (transportStart.atMs + addedDurationMs !== firstTransport.atMs) throw new Error('route-failure shifted transport by an unexpected amount.');
    return { events: nextEvents, addedDurationMs, appliedModifierIds: ['route-failure'] };
  },
};


function latestTransportRecovery(events                )                           {
  return events
    .filter((current) => current.kind === 'transport.recovered')
    .sort((a, b) => b.atMs - a.atMs)[0];
}

function pathOutageRouteEvents(baseAtMs        )                 {
  return [
    modifierEvent({ id: 'path-outage-primary-fails', atMs: baseAtMs + 160, kind: 'route.failure', scale: 'routing', zoom: 'out', protocol: 'OSPF teaching model', phase: 'path-outage', title: 'The active path fails mid-transfer', summary: 'R1 → CORE disappears while response bytes are already in flight.', detail: 'Unlike the pre-transport ROUTE modifier, this failure crosses an established transport flow. In-flight delivery can be lost before the control plane installs the alternate path.', actor: 'R1', target: 'CORE', detailLab: 'failure', routeMetrics: BROKEN_ROUTE }),
    modifierEvent({ id: 'path-outage-inflight-loss', atMs: baseAtMs + 200, kind: 'transport.loss', scale: 'packet', zoom: 'in', protocol: 'IP forwarding', phase: 'outage-loss', title: 'In-flight response data loses its forwarding path', summary: 'One response flight disappears with the failed next hop.', detail: 'Routing failure is the cause; transport loss is the consequence. HOPSCOTCH keeps those two causal layers separate in the event log.', actor: 'failed network path', target: 'transport receiver', detailLab: 'packet', routeMetrics: BROKEN_ROUTE }),
    modifierEvent({ id: 'path-outage-route-invalidated', atMs: baseAtMs + 360, kind: 'route.invalidated', scale: 'routing', zoom: 'out', protocol: 'OSPF teaching model', phase: 'outage-invalidated', title: 'The installed primary route is invalidated', summary: 'Forwarding through R1 → CORE is no longer viable.', detail: 'Transport remains established, but the forwarding table currently has no usable path for the affected destination.', actor: 'edge router', target: 'routing table', detailLab: 'failure', routeMetrics: BROKEN_ROUTE }),
    modifierEvent({ id: 'path-outage-spf-recompute', atMs: baseAtMs + 620, kind: 'route.recompute', scale: 'routing', zoom: 'hold', protocol: 'OSPF teaching model', phase: 'outage-recompute', title: 'SPF recomputes around the failed link', summary: 'The surviving cost-52 path through R2 becomes the best reachable route.', detail: 'The transport connection is not recreated. Routing is repairing reachability underneath the still-existing connection.', actor: 'edge router', target: 'SPF engine', detailLab: 'failure', routeMetrics: BROKEN_ROUTE }),
    modifierEvent({ id: 'path-outage-alternate-installed', atMs: baseAtMs + 900, kind: 'route.alternate-installed', scale: 'routing', zoom: 'hold', protocol: 'OSPF teaching model', phase: 'outage-route-ready', title: 'Alternate path installed under the live connection', summary: 'R2 → CORE restores forwarding at cost 52.', detail: 'Routing convergence restores reachability, but it does not repair data already lost during the outage. The transport protocol still has to detect and recover that missing delivery.', actor: 'routing table', target: 'R2 next hop', detailLab: 'failure', routeMetrics: ALTERNATE_ROUTE }),
  ];
}

function tcpPathOutageEvents(baseAtMs        )                 {
  return [
    modifierEvent({ id: 'tcp-outage-rto', atMs: baseAtMs + 1160, kind: 'transport.loss-detected', scale: 'transport', zoom: 'in', protocol: 'TCP', phase: 'outage-rto', title: 'ACK silence reaches the TCP retransmission timeout', summary: 'No cumulative ACK advances for the missing response bytes; the teaching RTO reaches its 1 s minimum.', detail: 'This is not the duplicate-ACK fast-retransmit story used by the single-loss modifier. The path outage suppresses useful feedback long enough that the sender relies on its retransmission timer.', actor: 'TCP retransmission timer', target: 'TCP sender', detailLab: 'tcp', transportMetrics: { baselineRttMs: 32, timerLabel: 'RTO', timerMs: 1000, lossDetected: true } }),
    modifierEvent({ id: 'tcp-outage-retransmit', atMs: baseAtMs + 1380, kind: 'transport.retransmit', scale: 'packet', zoom: 'in', protocol: 'TCP', phase: 'outage-retransmit', title: 'TCP retransmits the missing byte range over R2', summary: 'SEQ 2461–3920 is sent again after the alternate route exists.', detail: 'The TCP sequence space does not change just because IP forwarding changed underneath it. The same missing byte range is retransmitted over the newly available route.', actor: 'TCP sender', target: 'TCP receiver', detailLab: 'tcp', routeMetrics: ALTERNATE_ROUTE }),
    modifierEvent({ id: 'tcp-outage-recovered', atMs: baseAtMs + 1740, kind: 'transport.recovered', scale: 'application', zoom: 'out', protocol: 'HTTP/2', phase: 'outage-recovered', title: 'HTTP/2 delivery resumes on the surviving route', summary: 'The retransmitted TCP bytes close the gap and cumulative delivery advances again.', detail: 'The HTTP/2 connection survives because TCP recovered after IP reachability returned; no new TCP or TLS handshake was required.', actor: 'TCP receiver', target: 'HTTP/2', detailLab: 'http', routeMetrics: ALTERNATE_ROUTE }),
  ];
}

function quicPathOutageEvents(baseAtMs        )                 {
  return [
    modifierEvent({ id: 'quic-outage-pto1', atMs: baseAtMs + 300, kind: 'transport.loss-detected', scale: 'transport', zoom: 'in', protocol: 'QUIC', phase: 'outage-pto', title: 'QUIC PTO fires before routing has recovered', summary: 'ACK progress stops and QUIC reaches a probe timeout while the primary route is still unusable.', detail: 'QUIC reacts earlier than the TCP 1 s teaching RTO, but a transport timer cannot repair missing IP reachability.', actor: 'QUIC PTO timer', target: 'QUIC sender', detailLab: 'http', transportMetrics: { baselineRttMs: 32, smoothedRttMs: 32, rttVarMs: 8, ackDelayMs: 25, timerLabel: 'PTO', timerMs: 89, lossDetected: true } }),
    modifierEvent({ id: 'quic-outage-probe', atMs: baseAtMs + 470, kind: 'transport.retransmit', scale: 'packet', zoom: 'in', protocol: 'QUIC', phase: 'outage-probe', title: 'A QUIC probe cannot make forward progress', summary: 'Probe traffic is generated, but the forwarding path is still broken.', detail: 'This probe does not prove recovery. HOPSCOTCH keeps the route at NONE until SPF installs the alternate path.', actor: 'QUIC sender', target: 'failed network path', detailLab: 'http', routeMetrics: BROKEN_ROUTE }),
    modifierEvent({ id: 'quic-outage-pto2', atMs: baseAtMs + 760, kind: 'transport.loss-detected', scale: 'transport', zoom: 'out', protocol: 'QUIC', phase: 'outage-pto-backoff', title: 'QUIC remains in PTO backoff during convergence', summary: 'The connection still has no ACK progress while SPF is finishing the alternate route.', detail: 'Probe timeout backoff is transport state; route recomputation is control-plane state. They advance independently until reachability returns.', actor: 'QUIC loss detector', target: 'QUIC sender', detailLab: 'http', transportMetrics: { baselineRttMs: 32, smoothedRttMs: 32, rttVarMs: 8, ackDelayMs: 25, timerLabel: 'PTO', timerMs: 178, lossDetected: true } }),
    modifierEvent({ id: 'quic-outage-retransmit', atMs: baseAtMs + 1080, kind: 'transport.retransmit', scale: 'packet', zoom: 'in', protocol: 'QUIC', phase: 'outage-retransmit', title: 'Missing STREAM data is sent in new packet 4216', summary: 'STREAM offset 4096–5555 is retransmitted after R2 becomes active.', detail: 'QUIC does not reuse the lost packet number. The STREAM data moves in a new QUIC packet number over the restored IP path.', actor: 'QUIC sender', target: 'QUIC receiver', detailLab: 'http', routeMetrics: ALTERNATE_ROUTE }),
    modifierEvent({ id: 'quic-outage-recovered', atMs: baseAtMs + 1320, kind: 'transport.recovered', scale: 'application', zoom: 'out', protocol: 'HTTP/3', phase: 'outage-recovered', title: 'HTTP/3 stream resumes over the alternate path', summary: 'The new QUIC packet closes the missing STREAM range and request-stream delivery advances.', detail: 'The QUIC connection and TLS 1.3 state survive the routing outage; neither a TCP connection nor a new TLS handshake is introduced.', actor: 'QUIC receiver', target: 'HTTP/3', detailLab: 'http', routeMetrics: ALTERNATE_ROUTE }),
  ];
}

const pathOutageModifier                  = {
  id: 'path-outage',
  order: 105,
  apply(events, context) {
    const { data, packetFrame } = requireResponseAnchors(events, 'path-outage');
    const priorRecovery = latestTransportRecovery(events);
    const baseAtMs = priorRecovery?.atMs ?? data.atMs;
    const addedDurationMs = 2200;
    const shifted = shiftPostAnchor(events, packetFrame.atMs, addedDurationMs);
    const injected = [
      ...pathOutageRouteEvents(baseAtMs),
      ...(context.config.transportProfile === 'tcp-h2' ? tcpPathOutageEvents(baseAtMs) : quicPathOutageEvents(baseAtMs)),
    ];
    return {
      events: [...shifted, ...injected].sort((a, b) => a.atMs - b.atMs),
      addedDurationMs,
      appliedModifierIds: ['path-outage'],
    };
  },
};

function round1(value        )         {
  return Math.round(value * 10) / 10;
}

function tcpEstimator(sampleRttMs        , previousSmoothedRttMs = 32, previousRttVarMs = 8)                          {
  const rttVarMs = (3 / 4) * previousRttVarMs + (1 / 4) * Math.abs(previousSmoothedRttMs - sampleRttMs);
  const smoothedRttMs = (7 / 8) * previousSmoothedRttMs + (1 / 8) * sampleRttMs;
  const calculatedRtoMs = smoothedRttMs + Math.max(1, 4 * rttVarMs);
  return {
    baselineRttMs: 32,
    latestRttMs: sampleRttMs,
    smoothedRttMs: round1(smoothedRttMs),
    rttVarMs: round1(rttVarMs),
    timerLabel: 'RTO',
    timerMs: Math.max(1000, Math.ceil(calculatedRtoMs)),
    lossDetected: false,
  };
}

function quicEstimator(sampleRttMs        , previousSmoothedRttMs = 32, previousRttVarMs = 8)                          {
  const maxAckDelayMs = 25;
  const minRttMs = 32;
  const adjustedRttMs = sampleRttMs >= minRttMs + maxAckDelayMs ? sampleRttMs - maxAckDelayMs : sampleRttMs;
  const rttVarMs = (3 / 4) * previousRttVarMs + (1 / 4) * Math.abs(previousSmoothedRttMs - adjustedRttMs);
  const smoothedRttMs = (7 / 8) * previousSmoothedRttMs + (1 / 8) * adjustedRttMs;
  const ptoMs = smoothedRttMs + Math.max(4 * rttVarMs, 1) + maxAckDelayMs;
  return {
    baselineRttMs: 32,
    latestRttMs: sampleRttMs,
    adjustedRttMs: round1(adjustedRttMs),
    smoothedRttMs: round1(smoothedRttMs),
    rttVarMs: round1(rttVarMs),
    ackDelayMs: maxAckDelayMs,
    timerLabel: 'PTO',
    timerMs: round1(ptoMs),
    lossDetected: false,
  };
}

function latencyEvents(transportProfile                         , dataAtMs        )                 {
  if (transportProfile === 'tcp-h2') {
    const slow = tcpEstimator(220);
    const recovery = tcpEstimator(46, slow.smoothedRttMs, slow.rttVarMs);
    return [
      modifierEvent({ id: 'tcp-latency-start', atMs: dataAtMs + 160, kind: 'transport.latency', scale: 'transport', zoom: 'out', protocol: 'TCP', phase: 'latency-spike', title: 'RTT spike stretches the TCP ACK clock', summary: 'A simulated queueing delay raises the next RTT sample from 32 ms to 220 ms; no TCP segment is lost.', detail: 'Feedback arrives later, so delivery pacing slows. There is no sequence gap, duplicate-ACK loss signal, or retransmission in this modifier.', actor: 'network queue', target: 'TCP sender', detailLab: 'tcp', transportMetrics: { baselineRttMs: 32, latestRttMs: 220, lossDetected: false } }),
      modifierEvent({ id: 'tcp-rtt-update', atMs: dataAtMs + 500, kind: 'transport.rtt-update', scale: 'transport', zoom: 'hold', protocol: 'TCP', phase: 'rtt-estimator', title: 'TCP RTT estimator absorbs the slow sample', summary: `SRTT rises to ${slow.smoothedRttMs} ms and RTTVAR to ${slow.rttVarMs} ms; the RFC 6298 teaching RTO remains at its 1 s minimum.`, detail: 'The timer estimator expands because the observed round trip became slower and more variable. No loss-driven congestion response is inferred from RTT alone.', actor: 'TCP RTT estimator', target: 'retransmission timer', detailLab: 'tcp', transportMetrics: slow }),
      modifierEvent({ id: 'tcp-latency-clear', atMs: dataAtMs + 900, kind: 'transport.latency-cleared', scale: 'application', zoom: 'out', protocol: 'HTTP/2', phase: 'latency-normalized', title: 'Queue drains; HTTP/2 pacing normalizes', summary: `A later 46 ms RTT sample begins pulling the estimator back down; SRTT is now about ${recovery.smoothedRttMs} ms.`, detail: 'The response continues without fast retransmit or a packet-loss event. RTT estimators decay over subsequent samples rather than snapping instantly to baseline.', actor: 'network queue', target: 'HTTP/2', detailLab: 'http', transportMetrics: recovery }),
    ];
  }

  const slow = quicEstimator(220);
  const recovery = quicEstimator(46, slow.smoothedRttMs, slow.rttVarMs);
  return [
    modifierEvent({ id: 'quic-latency-start', atMs: dataAtMs + 160, kind: 'transport.latency', scale: 'transport', zoom: 'out', protocol: 'QUIC', phase: 'latency-spike', title: 'A QUIC ACK arrives late', summary: 'A simulated queueing delay raises latest_rtt from 32 ms to 220 ms; no QUIC packet-number gap exists.', detail: 'The response waits longer for feedback, but latency alone is not modeled as packet loss or a retransmission trigger.', actor: 'network queue', target: 'QUIC sender', detailLab: 'http', transportMetrics: { baselineRttMs: 32, latestRttMs: 220, ackDelayMs: 25, lossDetected: false } }),
    modifierEvent({ id: 'quic-rtt-update', atMs: dataAtMs + 500, kind: 'transport.rtt-update', scale: 'transport', zoom: 'hold', protocol: 'QUIC', phase: 'rtt-estimator', title: 'QUIC RTT and PTO estimates expand', summary: `After ACK-delay adjustment, smoothed RTT is about ${slow.smoothedRttMs} ms, RTTVAR ${slow.rttVarMs} ms, and PTO about ${slow.timerMs} ms.`, detail: 'QUIC updates RTT/PTO estimation from ACK timing. This event contains no packet-threshold/time-threshold loss declaration and no loss-driven congestion-window reduction.', actor: 'QUIC RTT estimator', target: 'PTO timer', detailLab: 'http', transportMetrics: slow }),
    modifierEvent({ id: 'quic-latency-clear', atMs: dataAtMs + 900, kind: 'transport.latency-cleared', scale: 'application', zoom: 'out', protocol: 'HTTP/3', phase: 'latency-normalized', title: 'Queue drains; HTTP/3 pacing normalizes', summary: `A later 46 ms sample begins reducing the estimator; smoothed RTT is now about ${recovery.smoothedRttMs} ms.`, detail: 'No STREAM retransmission was needed. The connection simply observes faster feedback again while estimator history decays over later samples.', actor: 'network queue', target: 'HTTP/3', detailLab: 'http', transportMetrics: recovery }),
  ];
}

const latencySpikeModifier                  = {
  id: 'latency-spike',
  order: 110,
  apply(events, context) {
    const { data, packetFrame } = requireResponseAnchors(events, 'latency-spike');
    const recovered = latestTransportRecovery(events);
    const latencyBaseAtMs = recovered?.atMs ?? data.atMs;
    const addedDurationMs = 1200;
    const shifted = shiftPostAnchor(events, packetFrame.atMs, addedDurationMs);
    return {
      events: [...shifted, ...latencyEvents(context.config.transportProfile, latencyBaseAtMs)].sort((a, b) => a.atMs - b.atMs),
      addedDurationMs,
      appliedModifierIds: ['latency-spike'],
    };
  },
};



function latestTransportEpisodeEnd(events                )                           {
  return events
    .filter((current) => current.kind === 'transport.recovered' || current.kind === 'transport.latency-cleared')
    .sort((a, b) => b.atMs - a.atMs)[0];
}

function congestionMetrics(input                                    = {})                           {
  return {
    bottleneckRateMbps: 100,
    offeredRateMbps: 160,
    queueCapacityPackets: 32,
    queueOccupancyPackets: 8,
    queueDelayMs: 24,
    ecnCeMarks: 0,
    congestionWindowPackets: 12,
    slowStartThresholdPackets: 24,
    signal: 'NONE',
    droppedPackets: 0,
    ...input,
  };
}

function tcpCongestionEvents(baseAtMs        )                 {
  return [
    modifierEvent({ id: 'tcp-congestion-queue-start', atMs: baseAtMs + 160, kind: 'transport.queue-growth', scale: 'transport', zoom: 'out', protocol: 'TCP', phase: 'queue-growth', title: 'A bottleneck queue starts to build', summary: 'The sender offers about 160 Mb/s to a 100 Mb/s bottleneck, so packets begin waiting instead of disappearing.', detail: 'Queueing raises delay before it creates a transport loss signal. TCP still has a contiguous sequence space and no retransmission is justified.', actor: 'bottleneck queue', target: 'TCP flow', detailLab: 'tcp', transportMetrics: { baselineRttMs: 32, latestRttMs: 56, lossDetected: false }, congestionMetrics: congestionMetrics() }),
    modifierEvent({ id: 'tcp-congestion-queue-high', atMs: baseAtMs + 420, kind: 'transport.queue-growth', scale: 'transport', zoom: 'hold', protocol: 'TCP', phase: 'queue-high', title: 'Queueing delay grows before any drop', summary: 'The queue reaches 24 of 32 packets and contributes roughly 96 ms of delay.', detail: 'This is a congestion precursor, not packet loss. The receiver can still acknowledge a complete TCP byte stream.', actor: 'bottleneck queue', target: 'TCP ACK clock', detailLab: 'tcp', transportMetrics: { baselineRttMs: 32, latestRttMs: 128, lossDetected: false }, congestionMetrics: congestionMetrics({ queueOccupancyPackets: 24, queueDelayMs: 96 }) }),
    modifierEvent({ id: 'tcp-congestion-ecn', atMs: baseAtMs + 680, kind: 'transport.ecn-mark', scale: 'packet', zoom: 'in', protocol: 'IP ECN', phase: 'ecn-ce', title: 'ECN marks congestion without dropping the packet', summary: 'Three packets arrive with the IP CE codepoint while the queue approaches capacity.', detail: 'The curated bottleneck is ECN-capable: CE is an explicit congestion signal carried on delivered packets, not a missing TCP sequence range.', actor: 'ECN-capable bottleneck', target: 'TCP receiver', detailLab: 'packet', transportMetrics: { baselineRttMs: 32, latestRttMs: 136, lossDetected: false }, congestionMetrics: congestionMetrics({ queueOccupancyPackets: 26, queueDelayMs: 104, ecnCeMarks: 3, signal: 'CE' }) }),
    modifierEvent({ id: 'tcp-congestion-response', atMs: baseAtMs + 900, kind: 'transport.congestion-response', scale: 'transport', zoom: 'out', protocol: 'TCP ECN', phase: 'ecn-response', title: 'TCP ECE feedback cuts the congestion window', summary: 'ECE feedback causes the teaching cwnd to fall from 12 to 6 packets; the sender answers with CWR.', detail: 'There is no TCP sequence gap and no retransmission. Congestion control reduces sending pressure because ECN reported congestion before a drop was needed.', actor: 'TCP sender', target: 'bottleneck queue', detailLab: 'tcp', transportMetrics: { baselineRttMs: 32, latestRttMs: 104, lossDetected: false }, congestionMetrics: congestionMetrics({ offeredRateMbps: 78, queueOccupancyPackets: 20, queueDelayMs: 72, ecnCeMarks: 3, congestionWindowPackets: 6, slowStartThresholdPackets: 6, signal: 'ECE/CWR' }) }),
    modifierEvent({ id: 'tcp-congestion-cleared', atMs: baseAtMs + 1320, kind: 'transport.congestion-cleared', scale: 'application', zoom: 'out', protocol: 'HTTP/2', phase: 'queue-drained', title: 'The queue drains after TCP backs off', summary: 'With offered load below the bottleneck rate, occupancy falls to four packets and response pacing steadies.', detail: 'HTTP/2 continues on the same TCP/TLS connection. No packet was dropped and no repair transmission was required in this ECN episode.', actor: 'bottleneck queue', target: 'HTTP/2', detailLab: 'http', transportMetrics: { baselineRttMs: 32, latestRttMs: 44, lossDetected: false }, congestionMetrics: congestionMetrics({ offeredRateMbps: 78, queueOccupancyPackets: 4, queueDelayMs: 12, ecnCeMarks: 3, congestionWindowPackets: 6, slowStartThresholdPackets: 6, signal: 'NONE' }) }),
  ];
}

function quicCongestionEvents(baseAtMs        )                 {
  return [
    modifierEvent({ id: 'quic-congestion-queue-start', atMs: baseAtMs + 160, kind: 'transport.queue-growth', scale: 'transport', zoom: 'out', protocol: 'QUIC', phase: 'queue-growth', title: 'A bottleneck queue starts to build', summary: 'The QUIC sender offers about 160 Mb/s to a 100 Mb/s bottleneck, so packets spend longer waiting in the queue.', detail: 'Queueing changes ACK timing first. There is no packet-number gap, PTO recovery, or STREAM retransmission in this congestion-only episode.', actor: 'bottleneck queue', target: 'QUIC flow', detailLab: 'http', transportMetrics: { baselineRttMs: 32, latestRttMs: 56, ackDelayMs: 25, lossDetected: false }, congestionMetrics: congestionMetrics({ slowStartThresholdPackets: undefined }) }),
    modifierEvent({ id: 'quic-congestion-queue-high', atMs: baseAtMs + 420, kind: 'transport.queue-growth', scale: 'transport', zoom: 'hold', protocol: 'QUIC', phase: 'queue-high', title: 'Queueing delay grows before any drop', summary: 'The queue reaches 24 of 32 packets and latest_rtt rises as feedback spends longer in the path.', detail: 'The QUIC packet-number space remains contiguous from the receiver perspective. Higher RTT by itself is not a QUIC loss declaration.', actor: 'bottleneck queue', target: 'QUIC ACK timing', detailLab: 'http', transportMetrics: { baselineRttMs: 32, latestRttMs: 128, ackDelayMs: 25, lossDetected: false }, congestionMetrics: congestionMetrics({ queueOccupancyPackets: 24, queueDelayMs: 96, slowStartThresholdPackets: undefined }) }),
    modifierEvent({ id: 'quic-congestion-ecn', atMs: baseAtMs + 680, kind: 'transport.ecn-mark', scale: 'packet', zoom: 'in', protocol: 'IP ECN', phase: 'ecn-ce', title: 'ECN marks QUIC packets instead of dropping them', summary: 'The receiver observes three additional CE-marked packets while all packet numbers still arrive.', detail: 'The packet remains delivered. ACK_ECN can report increasing CE counters without inventing a packet-number gap or STREAM loss.', actor: 'ECN-capable bottleneck', target: 'QUIC receiver', detailLab: 'packet', transportMetrics: { baselineRttMs: 32, latestRttMs: 136, ackDelayMs: 25, lossDetected: false }, congestionMetrics: congestionMetrics({ queueOccupancyPackets: 26, queueDelayMs: 104, ecnCeMarks: 3, signal: 'CE', slowStartThresholdPackets: undefined }) }),
    modifierEvent({ id: 'quic-congestion-response', atMs: baseAtMs + 900, kind: 'transport.congestion-response', scale: 'transport', zoom: 'out', protocol: 'QUIC ACK_ECN', phase: 'ecn-response', title: 'ACK_ECN feedback reduces the QUIC congestion window', summary: 'Validated CE-counter growth causes the teaching congestion window to fall from 12 to 6 packets.', detail: 'There is no QUIC packet-number gap, retransmission, or PTO recovery here. The sender reduces in-flight pressure because ACK_ECN explicitly reported congestion.', actor: 'QUIC sender', target: 'bottleneck queue', detailLab: 'http', transportMetrics: { baselineRttMs: 32, latestRttMs: 104, ackDelayMs: 25, lossDetected: false }, congestionMetrics: congestionMetrics({ offeredRateMbps: 78, queueOccupancyPackets: 20, queueDelayMs: 72, ecnCeMarks: 3, congestionWindowPackets: 6, slowStartThresholdPackets: undefined, signal: 'ACK_ECN' }) }),
    modifierEvent({ id: 'quic-congestion-cleared', atMs: baseAtMs + 1320, kind: 'transport.congestion-cleared', scale: 'application', zoom: 'out', protocol: 'HTTP/3', phase: 'queue-drained', title: 'The queue drains after QUIC backs off', summary: 'Offered load falls below the bottleneck rate, occupancy returns to four packets, and request-stream pacing steadies.', detail: 'HTTP/3 continues on the same QUIC/TLS state. No packet or STREAM data was lost, so there is nothing to retransmit.', actor: 'bottleneck queue', target: 'HTTP/3', detailLab: 'http', transportMetrics: { baselineRttMs: 32, latestRttMs: 44, ackDelayMs: 25, lossDetected: false }, congestionMetrics: congestionMetrics({ offeredRateMbps: 78, queueOccupancyPackets: 4, queueDelayMs: 12, ecnCeMarks: 3, congestionWindowPackets: 6, slowStartThresholdPackets: undefined, signal: 'NONE' }) }),
  ];
}

const congestionModifier                  = {
  id: 'congestion',
  order: 120,
  apply(events, context) {
    const { data, packetFrame } = requireResponseAnchors(events, 'congestion');
    const priorEpisode = latestTransportEpisodeEnd(events);
    const baseAtMs = priorEpisode?.atMs ?? data.atMs;
    const addedDurationMs = 1700;
    const shifted = shiftPostAnchor(events, packetFrame.atMs, addedDurationMs);
    const injected = context.config.transportProfile === 'tcp-h2'
      ? tcpCongestionEvents(baseAtMs)
      : quicCongestionEvents(baseAtMs);
    return {
      events: [...shifted, ...injected].sort((a, b) => a.atMs - b.atMs),
      addedDurationMs,
      appliedModifierIds: ['congestion'],
    };
  },
};



function dnsFailureMissEvents(recursiveAtMs        )                 {
  return [
    modifierEvent({
      id: 'dns-primary-timeout',
      atMs: recursiveAtMs + 600,
      kind: 'dns.timeout',
      scale: 'application',
      zoom: 'hold',
      protocol: 'DNS',
      phase: 'resolver-timeout',
      title: 'Primary recursive resolver does not answer',
      summary: 'The first recursive A-query attempt produces no DNS response before the teaching timeout.',
      detail: 'A timeout is the absence of a response. HOPSCOTCH does not turn silence into NXDOMAIN or SERVFAIL, because neither response was received.',
      actor: 'primary recursive resolver',
      target: 'stub resolver',
      detailLab: 'dns',
    }),
    modifierEvent({
      id: 'dns-secondary-retry',
      atMs: recursiveAtMs + 900,
      kind: 'dns.retry',
      scale: 'application',
      zoom: 'hold',
      protocol: 'DNS',
      phase: 'resolver-retry',
      title: 'Stub retries through a secondary recursive resolver',
      summary: 'The same logical A question is sent through the configured secondary recursive path after the primary attempt times out.',
      detail: 'This curated retry uses a new transaction context and a secondary recursive resolver. It is not a replayed DNS answer and does not imply that every operating system uses identical fallback timing.',
      actor: 'stub resolver',
      target: 'secondary recursive resolver',
      detailLab: 'dns',
    }),
  ];
}

function dnsFailureMaskedEvent(cacheHitAtMs        )               {
  return modifierEvent({
    id: 'dns-outage-masked',
    atMs: cacheHitAtMs + 180,
    kind: 'dns.failure-masked',
    scale: 'application',
    zoom: 'hold',
    protocol: 'DNS',
    phase: 'outage-masked',
    title: 'Cache hit masks the upstream DNS outage',
    summary: 'The local cached answer is already usable, so the unavailable upstream resolver path is never consulted.',
    detail: 'No upstream query is required, so HOPSCOTCH does not fabricate a timeout packet, DNS retry, or resolver delay. The cached TTL continues to age normally.',
    actor: 'local DNS cache',
    target: 'application',
    detailLab: 'dns',
  });
}

const dnsFailureModifier                  = {
  id: 'dns-failure',
  order: 70,
  apply(events, context) {
    if (context.config.dnsProfile === 'cache-hit') {
      const cacheHit = events.find((current) => current.kind === 'dns.cache-hit');
      const routeLookup = events.find((current) => current.kind === 'route.lookup');
      if (!cacheHit || !routeLookup || cacheHit.atMs >= routeLookup.atMs) throw new Error('dns-failure cache-hit path requires cache hit before route lookup.');
      const masked = dnsFailureMaskedEvent(cacheHit.atMs);
      if (masked.atMs >= routeLookup.atMs) throw new Error('dns-failure masked event must remain before route lookup.');
      return {
        events: [...events, masked].sort((a, b) => a.atMs - b.atMs),
        addedDurationMs: 0,
        appliedModifierIds: ['dns-failure'],
      };
    }

    const recursive = events.find((current) => current.id === 'dns-recursive');
    const root = events.find((current) => current.id === 'dns-root');
    if (!recursive || !root || recursive.atMs >= root.atMs) throw new Error('dns-failure cache-miss path requires recursive query before root referral.');
    const addedDurationMs = 1200;
    const shifted = shiftPostAnchor(events, root.atMs, addedDurationMs);
    const injected = dnsFailureMissEvents(recursive.atMs);
    if (!(recursive.atMs < injected[0].atMs && injected[0].atMs < injected[1].atMs && injected[1].atMs < root.atMs + addedDurationMs)) {
      throw new Error('dns-failure must order query < timeout < retry < root referral.');
    }
    return {
      events: [...shifted, ...injected].sort((a, b) => a.atMs - b.atMs),
      addedDurationMs,
      appliedModifierIds: ['dns-failure'],
    };
  },
};



function serverMetrics(input                                = {})                       {
  return {
    statusCode: 503,
    retryAfterMs: 1000,
    requestMethod: 'GET',
    idempotent: true,
    retrySafe: true,
    transportReused: true,
    ...input,
  };
}

function serverFailureEvents(requestAtMs        , frameReadyAtMs        , transportProfile                         )                 {
  const protocol = transportProfile === 'quic-h3' ? 'HTTP/3' : 'HTTP/2';
  const detailLab = 'http'         ;
  const responseBaseMs = Math.max(requestAtMs, frameReadyAtMs);
  return [
    modifierEvent({
      id: 'server-service-unavailable',
      atMs: responseBaseMs + 180,
      kind: 'server.unavailable',
      scale: 'application',
      zoom: 'hold',
      protocol,
      phase: 'service-unavailable',
      title: 'The application service becomes temporarily unavailable',
      summary: 'The request reached a healthy network endpoint, but the application service cannot produce the successful representation yet.',
      detail: 'DNS, IP routing, the established transport connection, and TLS keys remain valid. This failure lives at the HTTP/application boundary.',
      actor: 'application service',
      target: 'HTTP request',
      detailLab,
      serverMetrics: serverMetrics(),
    }),
    modifierEvent({
      id: 'server-http-503',
      atMs: responseBaseMs + 340,
      kind: 'http.service-unavailable',
      scale: 'application',
      zoom: 'hold',
      protocol,
      phase: 'http-503',
      title: 'HTTP 503 Service Unavailable returns',
      summary: 'The reachable server returns a real HTTP 503 response with Retry-After: 1.',
      detail: 'Unlike DNS timeout silence, this is an application-layer response. The server is reachable enough to return status and retry guidance on the existing connection.',
      actor: 'HTTP server',
      target: 'browser',
      detailLab,
      serverMetrics: serverMetrics(),
    }),
    modifierEvent({
      id: 'server-retry-wait',
      atMs: responseBaseMs + 520,
      kind: 'http.retry-wait',
      scale: 'application',
      zoom: 'hold',
      protocol,
      phase: 'retry-wait',
      title: 'Client honors Retry-After before replaying the GET',
      summary: 'The teaching client waits one second instead of hammering the unavailable service.',
      detail: 'The connection remains established during the wait. Retry safety comes from this canonical GET being idempotent; arbitrary requests must not be assumed safe to replay.',
      actor: 'browser',
      target: 'HTTP server',
      detailLab,
      serverMetrics: serverMetrics(),
    }),
    modifierEvent({
      id: 'server-service-ready',
      atMs: responseBaseMs + 1240,
      kind: 'server.recovered',
      scale: 'application',
      zoom: 'hold',
      protocol,
      phase: 'service-ready',
      title: 'The application service becomes ready again',
      summary: 'Server-side availability recovers while the original client transport and TLS session remain usable.',
      detail: 'No DNS lookup, route change, TCP/QUIC handshake, or TLS handshake is needed to represent this service recovery.',
      actor: 'application service',
      target: 'HTTP endpoint',
      detailLab,
      serverMetrics: serverMetrics({ statusCode: undefined }),
    }),
    modifierEvent({
      id: 'server-get-retry',
      atMs: responseBaseMs + 1340,
      kind: 'http.retry',
      scale: 'application',
      zoom: 'hold',
      protocol,
      phase: 'safe-get-retry',
      title: 'The idempotent GET is retried on the same connection',
      summary: 'Exactly one second after the 503, the canonical GET / is replayed using the already-established transport and TLS state.',
      detail: 'This teaching retry is safe because GET is idempotent. HOPSCOTCH does not imply arbitrary requests, especially non-idempotent writes, can always be retried automatically.',
      actor: 'browser',
      target: 'HTTP server',
      detailLab,
      serverMetrics: serverMetrics({ statusCode: undefined }),
    }),
  ];
}


function routeLeakTraversal(asns          )                                {
  const traversals                                = [];
  for (let index = 0; index < asns.length - 1; index += 1) {
    const from = asns[index];
    const to = asns[index + 1];
    const relationship = simulatedAsGraph.relationships.find((candidate) => traversalFor(candidate, from, to) !== null);
    if (!relationship) throw new Error(`route-leak teaching path is missing AS${from} → AS${to} from the AS Routing graph.`);
    const traversal = traversalFor(relationship, from, to);
    if (!traversal) throw new Error(`route-leak cannot derive traversal AS${from} → AS${to}.`);
    traversals.push(traversal);
  }
  return traversals;
}

function routeLeakMetricStates() {
  const legitimatePathAsns = [64504, 65540, 65538];
  const leakedPathAsns = [64504, 64500, 65538];
  const legitimate = enumeratePolicyPaths(simulatedAsGraph, 64504, 65538)
    .find((candidate) => candidate.asns.join(',') === legitimatePathAsns.join(','));
  if (!legitimate) throw new Error('route-leak requires the existing policy-compliant AS64504 → AS65540 → AS65538 candidate.');
  const legitimateTraversal = routeLeakTraversal(legitimatePathAsns);
  const leakedTraversal = routeLeakTraversal(leakedPathAsns);
  if (legitimateTraversal.join(',') !== 'peer,down') throw new Error('route-leak legitimate path no longer matches the AS Routing peer → down teaching policy.');
  if (leakedTraversal.join(',') !== 'down,peer') throw new Error('route-leak leaked path must expose the down → peer valley violation.');
  if (enumeratePolicyPaths(simulatedAsGraph, 64504, 65538).some((candidate) => candidate.asns.join(',') === leakedPathAsns.join(','))) {
    throw new Error('route-leak leaked path unexpectedly passed the normal valley-free enumerator.');
  }
  const common = {
    legitimatePathAsns,
    leakedPathAsns,
    legitimateTraversal,
    leakedTraversal,
    legitimateLocalPreference: legitimate.localPreference,
    leakedLocalPreference: 300,
    leakSourceAsn: 64500,
    decisionAsn: 64504,
    destinationAsn: 65538,
    learnedFrom: 'peer'         ,
    exportedTo: 'provider'         ,
    reachable: true,
  };
  const normal                       = {
    ...common,
    activePathAsns: legitimatePathAsns,
    activeLocalPreference: legitimate.localPreference,
    selectedPathPolicyCompliant: true,
    exportPolicyCompliant: true,
  };
  const advertised                       = {
    ...normal,
    exportPolicyCompliant: false,
  };
  const leaked                       = {
    ...common,
    activePathAsns: leakedPathAsns,
    activeLocalPreference: 300,
    selectedPathPolicyCompliant: false,
    exportPolicyCompliant: false,
  };
  return { normal, advertised, leaked, restored: normal };
}

function routeLeakEvents(asPathAtMs        )                 {
  const metrics = routeLeakMetricStates();
  return [
    modifierEvent({
      id: 'route-leak-advertised',
      atMs: asPathAtMs + 180,
      kind: 'internet.route-leak-advertised',
      scale: 'internet',
      zoom: 'hold',
      protocol: 'BGP policy model',
      phase: 'route-leak-advertised',
      title: 'AS64500 leaks a peer-learned route to its provider',
      summary: 'A route learned from peer AS65538 is incorrectly exported upward to provider AS64504.',
      detail: 'The export itself violates the curated valley-free teaching policy. Forwarding has not failed: the legitimate AS64504 → AS65540 → AS65538 path is still selected at this instant.',
      actor: 'AS64500',
      target: 'AS64504',
      detailLab: 'internet',
      policyMetrics: metrics.advertised,
    }),
    modifierEvent({
      id: 'route-leak-selected',
      atMs: asPathAtMs + 460,
      kind: 'internet.route-leak-selected',
      scale: 'internet',
      zoom: 'hold',
      protocol: 'BGP policy model',
      phase: 'route-leak-selected',
      title: 'AS64504 selects the leaked customer advertisement',
      summary: 'The deterministic teaching LOCAL_PREF changes from peer-learned 200 to customer-learned 300.',
      detail: 'AS64504 now forwards through AS64500 → AS65538. This is a curated policy demonstration, not a claim that every network implements identical BGP preference rules.',
      actor: 'AS64504 decision process',
      target: 'AS64500',
      detailLab: 'internet',
      policyMetrics: metrics.leaked,
    }),
    modifierEvent({
      id: 'route-leak-anomaly',
      atMs: asPathAtMs + 760,
      kind: 'internet.policy-anomaly',
      scale: 'internet',
      zoom: 'hold',
      protocol: 'BGP policy model',
      phase: 'policy-anomaly',
      title: 'Reachable path violates the valley-free export policy',
      summary: 'The selected path is AS64504 → AS64500 → AS65538: physically connected, but its down → peer relationship sequence is policy-invalid.',
      detail: 'This is the core lesson: reachability and policy correctness are separate dimensions. HOPSCOTCH keeps REACHABLE = YES while POLICY COMPLIANT = NO.',
      actor: 'policy monitor',
      target: 'selected AS path',
      detailLab: 'internet',
      policyMetrics: metrics.leaked,
    }),
    modifierEvent({
      id: 'route-leak-withdrawn',
      atMs: asPathAtMs + 1080,
      kind: 'internet.route-leak-withdrawn',
      scale: 'internet',
      zoom: 'hold',
      protocol: 'BGP policy model',
      phase: 'route-leak-withdrawn',
      title: 'The leaked advertisement is filtered and withdrawn',
      summary: 'AS64504 stops accepting the bad customer advertisement after the policy anomaly is contained.',
      detail: 'Containment removes the policy-invalid route; it does not require a local OSPF failure, packet retransmission, or transport reset.',
      actor: 'AS64504 policy filter',
      target: 'AS64500 advertisement',
      detailLab: 'internet',
      policyMetrics: metrics.leaked,
    }),
    modifierEvent({
      id: 'route-leak-restored',
      atMs: asPathAtMs + 1320,
      kind: 'internet.policy-restored',
      scale: 'internet',
      zoom: 'hold',
      protocol: 'BGP policy model',
      phase: 'policy-restored',
      title: 'Policy-compliant peer path is selected again',
      summary: 'AS64504 returns to AS64504 → AS65540 → AS65538 with teaching LOCAL_PREF 200.',
      detail: 'Reachability existed throughout the episode. What changed was which advertisement was considered policy-acceptable and therefore selected.',
      actor: 'AS64504 decision process',
      target: 'AS65540 peer route',
      detailLab: 'internet',
      policyMetrics: metrics.restored,
    }),
  ];
}

const routeLeakModifier                  = {
  id: 'route-leak',
  order: 92,
  apply(events) {
    const { asPath, transportStart } = requireRouteAnchors(events, 'route-leak');
    const physical = events.find((current) => current.id === 'physical-context');
    if (!physical || asPath.atMs >= physical.atMs || physical.atMs >= transportStart.atMs) {
      throw new Error('route-leak requires AS path < physical context < transport start.');
    }
    const addedDurationMs = 1600;
    const shifted = shiftPostAnchor(events, physical.atMs, addedDurationMs);
    const injected = routeLeakEvents(asPath.atMs);
    const nextEvents = [...shifted, ...injected].sort((a, b) => a.atMs - b.atMs);
    const restored = nextEvents.find((current) => current.kind === 'internet.policy-restored');
    const firstTransport = nextEvents.find((current) => current.kind === 'transport.segment');
    if (!restored || !firstTransport || restored.atMs >= firstTransport.atMs) throw new Error('route-leak must restore policy before transport begins.');
    if (firstTransport.atMs !== transportStart.atMs + addedDurationMs) throw new Error('route-leak shifted transport by an unexpected amount.');
    return { events: nextEvents, addedDurationMs, appliedModifierIds: ['route-leak'] };
  },
};

const serverFailureModifier                  = {
  id: 'server-failure',
  order: 95,
  apply(events, context) {
    const request = events.find((current) => current.kind === 'http.request');
    const frameReady = events.find((current) => current.id === 'packet-assembly-collapsed');
    const response = events.find((current) => current.kind === 'http.response');
    if (!request || !frameReady || !response || request.atMs >= frameReady.atMs || frameReady.atMs >= response.atMs) throw new Error('server-failure requires an assembled HTTP request before the successful response.');
    const addedDurationMs = 1700;
    const shifted = shiftPostAnchor(events, response.atMs, addedDurationMs);
    const injected = serverFailureEvents(request.atMs, frameReady.atMs, context.config.transportProfile);
    const retry = injected.find((current) => current.kind === 'http.retry');
    if (!retry || retry.atMs >= response.atMs + addedDurationMs) throw new Error('server-failure retry must finish before successful response headers.');
    return {
      events: [...shifted, ...injected].sort((a, b) => a.atMs - b.atMs),
      addedDurationMs,
      appliedModifierIds: ['server-failure'],
    };
  },
};



function latestPartitionTrigger(events                )               {
  const preferredKinds = new Set                  ([
    'http.data',
    'transport.recovered',
    'transport.latency-cleared',
    'transport.congestion-cleared',
  ]);
  const candidates = events.filter((current) => preferredKinds.has(current.kind)).sort((a, b) => b.atMs - a.atMs);
  if (!candidates[0]) throw new Error('partition requires response-path activity before terminalizing the Journey.');
  return candidates[0];
}

function partitionRouteMetrics()                      {
  return {
    primaryPathCost: 22,
    alternatePathCost: 52,
    activePath: 'none',
    failedLinkId: 'r1-core',
    failedLinkIds: ['r1-core', 'r2-core'],
    candidateRouteCount: 0,
    recoveryAvailable: false,
  };
}

function partitionEvents(triggerAtMs        , terminalAtMs        , transportProfile                         )                 {
  const metrics = partitionRouteMetrics();
  const transportProtocol = transportProfile === 'quic-h3' ? 'QUIC' : 'TCP';
  const stalledDetail = transportProfile === 'quic-h3'
    ? 'The QUIC connection had valid 1-RTT state before the cut. With no IP route, probes cannot create reachability; stalled does not mean the connection is already closed.'
    : 'The TCP connection was established before the cut. With no IP route, bytes cannot make progress; stalled does not mean the connection is already closed.';
  const injected = [
    modifierEvent({
      id: 'partition-cut',
      atMs: triggerAtMs + 220,
      kind: 'route.partition',
      scale: 'routing',
      zoom: 'out',
      protocol: 'IP',
      phase: 'partition-cut',
      title: 'Both routed exits disappear across the partition',
      summary: 'R1 → CORE and R2 → CORE are both unavailable, so the installed forwarding path is no longer usable.',
      detail: 'This is not the recoverable ROUTE or OUTAGE story. The teaching topology has lost both of its destination-facing exits at once.',
      actor: 'network partition',
      target: 'R1 / R2 uplinks',
      detailLab: 'failure',
      routeMetrics: metrics,
    }),
    modifierEvent({
      id: 'partition-recompute',
      atMs: triggerAtMs + 520,
      kind: 'route.partition-recompute',
      scale: 'routing',
      zoom: 'hold',
      protocol: 'OSPF-style SPF',
      phase: 'partition-recompute',
      title: 'SPF runs with zero surviving candidates',
      summary: 'The route calculation sees no primary or alternate path capable of reaching the destination.',
      detail: 'Recomputation is still meaningful even when it cannot produce a route. Candidate route count is explicitly zero.',
      actor: 'routing process',
      target: 'forwarding table',
      detailLab: 'failure',
      routeMetrics: metrics,
    }),
    modifierEvent({
      id: 'partition-unreachable',
      atMs: triggerAtMs + 820,
      kind: 'route.unreachable',
      scale: 'routing',
      zoom: 'hold',
      protocol: 'IP',
      phase: 'unreachable',
      title: 'Destination is unreachable: no route is installed',
      summary: 'Active path becomes NONE and forwarding cannot choose a next hop toward the destination.',
      detail: 'The terminal truth is routing reachability. HOPSCOTCH does not invent a third path or silently restore one of the failed links.',
      actor: 'forwarding table',
      target: 'destination prefix',
      detailLab: 'failure',
      routeMetrics: metrics,
    }),
    modifierEvent({
      id: 'partition-transport-stalled',
      atMs: triggerAtMs + 1080,
      kind: 'transport.stalled',
      scale: 'transport',
      zoom: 'in',
      protocol: transportProtocol,
      phase: 'transport-stalled',
      title: `${transportProtocol} state remains, but IP progress stops`,
      summary: 'The existing transport state is stalled because there is no forwarding path on which packets can travel.',
      detail: stalledDetail,
      actor: `${transportProtocol} sender`,
      target: 'unreachable IP path',
      detailLab: transportProfile === 'quic-h3' ? 'http' : 'tcp',
      routeMetrics: metrics,
    }),
    modifierEvent({
      id: 'partition-terminal',
      atMs: terminalAtMs,
      kind: 'journey.failed',
      scale: 'application',
      zoom: 'out',
      protocol: 'URL',
      phase: 'network-unreachable',
      title: 'Journey ends without a route to the destination',
      summary: 'The request cannot reach response-ready because the simulated network remains partitioned.',
      detail: 'No route exists and no recovery event follows. Earlier DNS, TLS, HTTP, and transport history remains inspectable when the time machine is rewound.',
      actor: 'network stack',
      target: 'browser',
      detailLab: 'failure',
      routeMetrics: metrics,
    }),
  ];
  if (injected[injected.length - 2].atMs >= terminalAtMs) throw new Error('partition terminal boundary must follow routing and transport stall events.');
  return injected;
}

const partitionModifier                  = {
  id: 'partition',
  order: 130,
  apply(events, context) {
    const trigger = latestPartitionTrigger(events);
    const complete = events.find((current) => current.kind === 'journey.complete');
    if (!complete) throw new Error('partition requires the pre-terminal Journey completion boundary.');
    const injected = partitionEvents(trigger.atMs, complete.atMs, context.config.transportProfile);
    const cutAtMs = injected[0].atMs;
    const kept = events.filter((current) => current.atMs < cutAtMs);
    return {
      events: [...kept, ...injected].sort((a, b) => a.atMs - b.atMs),
      addedDurationMs: 0,
      appliedModifierIds: ['partition'],
    };
  },
};

const modifiers                    = [dnsFailureModifier, routeFailureModifier, routeLeakModifier, serverFailureModifier, singleLossModifier, pathOutageModifier, latencySpikeModifier, congestionModifier, partitionModifier]
  .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));

function applyJourneyModifiers(
  baseEvents                ,
  config                       ,
)                        {
  let events = baseEvents.map((current) => ({ ...current }));
  let addedDurationMs = 0;
  const appliedModifierIds                      = [];
  const selectedModifierIds = new Set(resolveJourneyModifierIds(config));

  for (const modifier of modifiers) {
    if (!selectedModifierIds.has(modifier.id)) continue;
    const result = modifier.apply(events, { config });
    events = result.events;
    addedDurationMs += result.addedDurationMs;
    appliedModifierIds.push(...result.appliedModifierIds);
  }

  if (new Set(events.map((event) => event.id)).size !== events.length) throw new Error('Journey modifiers produced duplicate event IDs.');
  if (new Set(events.map((event) => event.atMs)).size !== events.length) throw new Error('Journey modifiers produced duplicate event timestamps.');
  if (!events.every((event, index) => index === 0 || event.atMs > events[index - 1].atMs)) throw new Error('Journey modifier events must remain strictly ordered.');

  return { events, addedDurationMs, appliedModifierIds };
}


Object.assign(exports,{normalizeJourneyModifierIds,resolveJourneyModifierIds,impairmentProfileForModifiers,applyJourneyModifiers});
},
"model.ts":(exports,read)=>{
const {applyJourneyModifiers, impairmentProfileForModifiers}=read("modifiers.ts");

                                                                                           
                                                                                                                
                                                         
                                                           
                                                           
                                                                                                                                                                                 
                                                                                
                                                                                                                                        
                              
                     
                     
                   
               
                  
                
                     
                 
               
                        
                  
                   
                   
                       
                     
                               
                     
                               
                       
                          
                                    
                                  
                             
                                   
                              
                               
                       
                           
                    
                             
                          
                         
                       
                          
                               
                            
                        
                                   
                                  
                       
                 
                    
              
                  
                  
                        
                              
                     
                      
                
                   
               
                     
                    
                    
                       
                    
                     
                      
                     

                                        
                                            
                                
                                              
                                    
 

const DEFAULT_JOURNEY_CONFIG                        = {
  transportProfile: 'tcp-h2',
  dnsProfile: 'cache-miss',
  impairmentProfile: 'clean',
};

                                          
                         
                       
                         
                         
                    
                      
                             
                   
                         
 

                                           
                             
                          
                               
                                
                       
                     
                                  
                                     
                                                
                         
 

                                       
                   
                       
                       
                      
                     
                           
 

                                       
                               
                           
                           
                                                     
                                                 
                                    
                                
                                
                        
                      
                         
                      
                         
                                       
                                 
                     
 

                                      
                          
                            
                                               
                        
                           
                               
                              
 

                               
             
               
                         
                      
                             
                   
                
                
                  
                 
                                
                
                  
                               
                      
                                             
                                               
                                       
                                       
                                     
 

                                  
             
                   
                             
                                            
                                
                                              
                                   
                                          
                     
                         
 

                                                                                                                   
                                                                                                                                                           
                                                                                                    
                                                                                                            
                                                                                                                                                             
                                                                                 
                                                                                                  
                                                                                         
                                                                                                                                           
                                                                                                                                                                                                                       
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              

                               
                 
                            
                           
                              
                                            
                                
                                              
                                   
                                          
                                                   
                                                     
                                             
                                             
                                           
                      
                     
                              
                             
                   
                
                                
                       
                               
                                 
                           
                                   
                       
                         
                             
                             
                             
                                                  
                                                
                         
                           
                         
                                              
 

const JOURNEY_SCALE_DEPTH                               = {
  internet: 0,
  routing: 1,
  transport: 2,
  application: 3,
  packet: 4,
};

function normalizeJourneyHostname(input        )         {
  const hostname = input.trim().toLowerCase().replace(/\.$/, '');
  if (!hostname || hostname.length > 253) throw new Error('Hostname must contain 1–253 characters.');
  if (hostname.includes('://') || /[\/:?#\[\]@]/.test(hostname)) throw new Error('Enter a hostname only, not a URL, port, path, or IP literal.');
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)) throw new Error('Enter a hostname instead of an IP address.');
  const labels = hostname.split('.');
  if (labels.length < 2) throw new Error('Hostname must contain at least one dot.');
  for (const label of labels) {
    if (!label || label.length > 63 || !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) throw new Error(`Invalid hostname label: ${label || '(empty)'}.`);
  }
  return hostname;
}

function event(
  id        ,
  atMs        ,
  kind                  ,
  scale              ,
  zoom                      ,
  protocol        ,
  phase        ,
  title        ,
  summary        ,
  detail        ,
  actor        ,
  target         ,
  detailLab                   ,
  provenance                    = 'SIMULATED',
)               {
  return { id, atMs, kind, scale, zoom, protocol, phase, title, summary, detail, actor, target, detailLab, provenance };
}

function withTtl(source              , ttlSeconds        )               {
  return { ...source, ttlSeconds };
}

function shiftEvents(events                , deltaMs        )                 {
  if (deltaMs === 0) return events;
  return events.map((current) => ({ ...current, atMs: current.atMs + deltaMs }));
}

function intentEvent(hostname        )               {
  return event('intent', 0, 'intent.accepted', 'application', 'hold', 'URL', 'intent', `Navigate to ${hostname}`, 'The application turns a human hostname into a network dependency graph.', 'A URL is intent, not a route. HOPSCOTCH starts at the application layer and moves outward only when the next dependency requires it.', 'browser', hostname);
}

function dnsMissEvents(hostname        , destinationAddress        )                 {
  return [
    event('dns-cache', 420, 'dns.cache-check', 'application', 'hold', 'DNS', 'cache-miss', 'DNS cache miss', 'No usable cached answer exists for this curated journey.', 'The simulated miss forces the complete recursive resolution path to remain visible.', 'stub resolver', hostname, 'dns'),
    event('dns-recursive', 850, 'dns.query', 'application', 'hold', 'DNS', 'recursive-query', 'Stub asks recursive resolver', `A recursive A query is issued for ${hostname}.`, 'The stub asks one recursive resolver to finish the job. The recursive resolver performs iterative upstream work.', 'stub resolver', 'recursive resolver', 'dns'),
    event('dns-root', 1320, 'dns.referral', 'application', 'hold', 'DNS', 'root-referral', 'Root referral received', 'The recursive resolver learns where to continue the namespace walk.', 'A referral narrows the search to the next authority.', 'root authority', 'recursive resolver', 'dns'),
    event('dns-tld', 1810, 'dns.referral', 'application', 'hold', 'DNS', 'tld-referral', 'TLD referral received', 'The recursive resolver is directed toward the authoritative zone.', 'The resolver continues iteratively rather than asking the browser to chase each authority.', 'TLD authority', 'recursive resolver', 'dns'),
    event('dns-answer', 2310, 'dns.answer', 'application', 'hold', 'DNS', 'answer', `${hostname} → ${destinationAddress}`, 'The authoritative answer supplies a documentation-only destination address for the deterministic story.', '203.0.113.0/24 is documentation space. This journey never implies that example.test is a live public host.', 'authoritative DNS', 'recursive resolver', 'dns'),
    withTtl(event('dns-store', 2700, 'dns.cache-store', 'application', 'hold', 'DNS', 'cache-store', 'Answer cached', 'The recursive result becomes reusable until its simulated TTL expires.', 'The cache starts at a deterministic 300-second TTL and ages with Journey time.', 'recursive resolver', 'cache', 'dns'), 300),
  ];
}

function dnsHitEvents(hostname        , destinationAddress        )                 {
  return [
    withTtl(event('dns-hit', 420, 'dns.cache-hit', 'application', 'hold', 'DNS', 'cache-hit', 'DNS cache hit', `${hostname} → ${destinationAddress} is already cached.`, 'A deterministic unexpired cached answer satisfies the name dependency immediately. No recursive, root, TLD, or authoritative traffic occurs.', 'stub resolver cache', hostname, 'dns'), 258),
  ];
}

function routingInternetEvents(destinationAddress        , times                                  )                 {
  const [routeAt, gatewayAt, asAt, physicalAt] = times;
  return [
    event('route-lookup', routeAt, 'route.lookup', 'routing', 'out', 'IP', 'route-lookup', 'Destination enters the routing table', `${destinationAddress} requires a next-hop decision outside the local subnet.`, 'The camera moves outward because an IP destination cannot leave the host until a route and next hop exist.', 'host routing table', destinationAddress, 'builder'),
    event('gateway', gatewayAt, 'route.gateway', 'routing', 'hold', 'Ethernet/IP', 'gateway', 'Default gateway selected', 'The host has a viable local path to the router that can forward toward the Internet.', 'This is a deterministic teaching topology, not a measurement of the viewer’s LAN.', 'client', 'edge router', 'builder'),
    event('as-path', asAt, 'internet.policy-path', 'internet', 'out', 'BGP policy model', 'as-path', 'Interdomain path context appears', 'A simulated valley-free AS path carries the story beyond the local routing domain.', 'The AS path is SIMULATED. Public collector paths, when attached, remain separate evidence and never replace this story path.', 'access AS', 'content AS', 'internet'),
    event('physical-context', physicalAt, 'internet.physical-context', 'internet', 'hold', 'Physical Internet', 'infrastructure-context', 'Physical infrastructure comes into view', 'Interconnection facilities give geography to the story without claiming a cable or exact forwarding path.', 'PeeringDB facility points can decorate this moment as PUBLIC DATA. Any connecting great-circle geometry remains INFERRED.', 'public facility context', 'destination region', 'physical', 'INFERRED'),
  ];
}

function sharedPrelude(hostname        , destinationAddress        , dnsProfile                   )                 {
  const dnsEvents = dnsProfile === 'cache-hit'
    ? dnsHitEvents(hostname, destinationAddress)
    : dnsMissEvents(hostname, destinationAddress);
  const routingTimes                                   = dnsProfile === 'cache-hit'
    ? [900, 1340, 1800, 2320]
    : [3140, 3560, 4050, 4520];
  return [intentEvent(hostname), ...dnsEvents, ...routingInternetEvents(destinationAddress, routingTimes)];
}

function tcpH2Events(hostname        )                 {
  return [
    event('tcp-syn', 5000, 'transport.segment', 'transport', 'in', 'TCP', 'syn', 'SYN leaves the client', 'TCP opens a reliable byte stream before TLS begins.', 'This branch uses TCP + TLS 1.3 + HTTP/2.', 'client TCP', 'server TCP', 'tcp'),
    event('tcp-synack', 5320, 'transport.segment', 'transport', 'hold', 'TCP', 'syn-ack', 'SYN-ACK returns', 'The server acknowledges the client sequence space and contributes its own initial sequence number.', 'The handshake establishes shared transport sequence state.', 'server TCP', 'client TCP', 'tcp'),
    event('tcp-ack', 5620, 'transport.established', 'transport', 'hold', 'TCP', 'established', 'TCP connection established', 'The third handshake segment makes the bidirectional byte stream usable.', 'Encryption still does not exist yet.', 'client TCP', 'server TCP', 'tcp'),
    event('tls-clienthello', 6070, 'tls.message', 'application', 'in', 'TLS 1.3', 'client-hello', 'ClientHello', `SNI names ${hostname}; ALPN offers h2.`, 'TLS records are carried inside the established TCP byte stream.', 'TLS client', 'TLS server', 'tls'),
    event('tls-serverhello', 6470, 'tls.message', 'application', 'hold', 'TLS 1.3', 'server-hello', 'ServerHello', 'The server selects compatible cryptographic parameters and contributes its key share.', 'The transcript now contains both hellos.', 'TLS server', 'TLS client', 'tls'),
    event('tls-encrypted', 6840, 'tls.keys', 'application', 'hold', 'TLS 1.3', 'handshake-keys', 'Handshake traffic becomes encrypted', 'EncryptedExtensions and later server handshake messages are protected with handshake keys.', 'HOPSCOTCH shows named key-schedule stages, not invented secret bytes.', 'TLS key schedule', 'handshake traffic', 'tls'),
    event('tls-certificate', 7210, 'tls.validation', 'application', 'hold', 'TLS 1.3', 'certificate-validation', 'Certificate identity validated', `The presented identity is checked against ${hostname}.`, 'Certificate validation authenticates the server identity independently from routing.', 'certificate validator', hostname, 'tls'),
    event('tls-finished', 7610, 'tls.keys', 'application', 'hold', 'TLS 1.3', 'application-keys', 'Application traffic keys ready', 'Both sides can now protect application data with TLS 1.3 application traffic secrets.', 'The encryption boundary changes before HTTP/2 request data is sent.', 'TLS key schedule', 'application traffic', 'tls'),
    event('h2-settings', 8070, 'http.control', 'application', 'hold', 'HTTP/2', 'connection-control', 'HTTP/2 control state exchanged', 'SETTINGS establishes connection-level HTTP/2 parameters over the encrypted stream.', 'HTTP/2 multiplexing lives above TCP.', 'HTTP client', 'HTTP server', 'http'),
    event('h2-request', 8540, 'http.request', 'application', 'hold', 'HTTP/2', 'request', `GET / on ${hostname}`, 'Request headers become an encrypted HTTP/2 HEADERS frame carried by TLS over TCP.', 'Each representation is a different abstraction of the same bytes.', 'browser', 'origin', 'http'),
    ...packetAssemblyEvents(hostname, 'tcp-h2', 8840),
    ...packetTransitEvents('tcp-h2', 11600),
    event('h2-headers', 16420, 'http.response', 'application', 'out', 'HTTP/2', 'response-headers', 'Response headers arrive', 'The origin begins the response with status and metadata before the body streams.', 'The first response bytes do not mean transfer is complete.', 'origin', 'browser', 'http'),
    event('h2-data', 16960, 'http.data', 'application', 'hold', 'HTTP/2', 'streaming', 'Response DATA streams', 'Encrypted application data crosses the established TCP stream.', 'HOPSCOTCH can now zoom into one representative frame.', 'origin', 'browser', 'http'),
    event('packet-frame', 17680, 'packet.inspect', 'packet', 'in', 'Ethernet / IPv4 / TCP / TLS', 'frame', 'Freeze one TCP frame', 'One delivery unit becomes the entire world: link, network, transport, and encrypted TLS payload bytes.', 'The packet microscope is a projection of the same Journey moment.', 'network interface', 'packet bytes', 'packet'),
    event('packet-headers', 18360, 'packet.inspect', 'packet', 'hold', 'Ethernet / IPv4 / TCP', 'headers', 'Explode TCP/IP headers', 'The same frame opens into persistent link, network, transport, security, and application objects.', 'TLS-protected application bytes remain opaque at this packet-observation boundary.', 'packet bytes', 'header fields', 'packet'),
    event('transfer-complete', 19160, 'transfer.complete', 'transport', 'out', 'TCP', 'complete', 'Transfer acknowledged', 'The representative response flight is cumulatively acknowledged and TCP delivery is complete.', 'The camera pulls back because byte delivery has finished.', 'client TCP', 'server TCP', 'tcp'),
  ];
}

function quicH3Events(hostname        )                 {
  return [
    event('quic-initial', 5000, 'transport.segment', 'transport', 'in', 'QUIC + TLS 1.3', 'quic-initial', 'QUIC Initial leaves the client', `The Initial packet carries TLS ClientHello data, including SNI for ${hostname} and ALPN for h3.`, 'QUIC runs over UDP, but TLS 1.3 is integrated into QUIC crypto levels rather than transported as TLS records.', 'QUIC client', 'QUIC server', 'http'),
    event('quic-server-initial', 5380, 'tls.message', 'transport', 'hold', 'QUIC + TLS 1.3', 'server-initial', 'Server Initial + Handshake arrive', 'The server answers with QUIC Initial/Handshake packets carrying TLS handshake messages.', 'Packet protection and TLS transcript state advance together inside QUIC.', 'QUIC server', 'QUIC client', 'http'),
    event('quic-handshake-keys', 5750, 'tls.keys', 'transport', 'hold', 'QUIC + TLS 1.3', 'handshake-keys', 'QUIC Handshake keys active', 'Handshake packets move to the Handshake encryption level.', 'There is no standalone TLS record layer between UDP and QUIC.', 'QUIC crypto', 'Handshake packets', 'http'),
    event('quic-certificate', 6180, 'tls.validation', 'transport', 'hold', 'QUIC + TLS 1.3', 'certificate-validation', 'Certificate identity validated', `The TLS identity carried through QUIC is checked against ${hostname}.`, 'QUIC changes transport mechanics, not server-authentication requirements.', 'certificate validator', hostname, 'http'),
    event('quic-1rtt', 6620, 'tls.keys', 'transport', 'hold', 'QUIC + TLS 1.3', 'application-keys', '1-RTT keys ready', 'TLS application secrets feed QUIC 1-RTT packet protection.', 'Application data can now travel on independent QUIC streams.', 'QUIC crypto', '1-RTT packets', 'http'),
    event('quic-established', 6900, 'transport.established', 'transport', 'hold', 'QUIC', 'established', 'QUIC connection established', 'The connection has usable 1-RTT keys and transport parameters.', 'HTTP/3 can now use QUIC streams without a TCP byte stream.', 'QUIC client', 'QUIC server', 'http'),
    event('h3-control', 7500, 'http.control', 'application', 'in', 'HTTP/3', 'connection-control', 'HTTP/3 control streams open', 'HTTP/3 SETTINGS and QPACK control state use dedicated QUIC streams.', 'This curated trace avoids dynamic QPACK dependencies so transport behavior stays legible.', 'HTTP/3 client', 'HTTP/3 server', 'http'),
    event('h3-request', 8120, 'http.request', 'application', 'hold', 'HTTP/3', 'request', `GET / on ${hostname}`, 'Request fields are encoded for HTTP/3 and carried on a QUIC request stream.', 'There is no HTTP/2 framing or TCP stream in this branch.', 'browser', 'origin', 'http'),
    ...packetAssemblyEvents(hostname, 'quic-h3', 8420),
    ...packetTransitEvents('quic-h3', 11180),
    event('h3-headers', 16000, 'http.response', 'application', 'out', 'HTTP/3', 'response-headers', 'Response headers arrive', 'The response begins on the request’s QUIC stream.', 'Other QUIC streams are independently ordered.', 'origin', 'browser', 'http'),
    event('h3-data', 16700, 'http.data', 'application', 'hold', 'HTTP/3', 'streaming', 'HTTP/3 DATA streams', 'Protected QUIC STREAM frames carry response data.', 'QUIC loss can still affect congestion control even though stream ordering is independent.', 'origin', 'browser', 'http'),
    event('packet-frame', 17680, 'packet.inspect', 'packet', 'in', 'Ethernet / IPv4 / UDP / QUIC', 'frame', 'Freeze one QUIC packet', 'One datagram becomes the entire world: Ethernet, IP, UDP, QUIC header, and protected payload.', 'TLS-derived keys protect QUIC packet payloads; there is no visible TLS record envelope.', 'network interface', 'packet bytes', 'packet'),
    event('packet-headers', 18360, 'packet.inspect', 'packet', 'hold', 'Ethernet / IPv4 / UDP / QUIC', 'headers', 'Explode UDP + QUIC headers', 'The same datagram opens into link, network, UDP, QUIC protection, and application objects.', 'Protected QUIC payload bytes remain opaque without key material.', 'packet bytes', 'header fields', 'packet'),
    event('transfer-complete', 19160, 'transfer.complete', 'transport', 'out', 'QUIC', 'complete', 'QUIC transfer complete', 'The response stream reaches its final offset and delivery is acknowledged.', 'Completion belongs to QUIC stream/packet state, not TCP cumulative ACK space.', 'QUIC client', 'QUIC server', 'http'),
  ];
}

function packetAssemblyEvents(hostname        , profile                         , startAtMs        )                 {
  const quic = profile === 'quic-h3';
  const application = quic ? 'HTTP/3 request fields' : 'HTTP/2 request headers';
  const security = quic ? 'QUIC 1-RTT protection' : 'TLS 1.3 application data';
  const transport = quic ? 'UDP datagram + QUIC packet' : 'TCP segment';
  const transportDetail = quic
    ? 'QUIC integrates TLS-derived protection into its packet format, then uses UDP as the IP payload. HOPSCOTCH does not insert a standalone TLS record layer.'
    : 'TLS-protected bytes become TCP payload. Sequence, acknowledgment, flags, window, and checksum belong to the TCP header.';
  return [
    event('packet-assembly-application', startAtMs, 'packet.assembly', 'packet', 'in', quic ? 'HTTP/3' : 'HTTP/2', 'application', 'Application data isolated', `${application} for GET / on ${hostname} becomes the logical payload.`, 'This is the clear application meaning at the browser boundary; it is not yet a wire-visible packet.', 'browser', 'network stack', 'packet'),
    event('packet-assembly-security', startAtMs + 460, 'packet.assembly', 'packet', 'hold', quic ? 'QUIC + TLS 1.3' : 'TLS 1.3', 'security', `${security} closes`, quic ? 'HTTP/3 request data becomes protected QUIC STREAM data.' : 'HTTP/2 request bytes become opaque TLS application data.', quic ? 'TLS-derived keys protect QUIC payloads without creating a TLS record layer between QUIC and UDP.' : 'The HTTP meaning remains available above TLS; packet observers without keys see an opaque TLS record payload.', quic ? 'QUIC packet protection' : 'TLS record layer', 'protected application bytes', 'packet'),
    event('packet-assembly-transport', startAtMs + 920, 'packet.assembly', 'packet', 'hold', quic ? 'QUIC / UDP' : 'TCP', 'transport', `${transport} assembles`, quic ? 'UDP ports and checksum carry a protected QUIC packet toward the origin.' : 'TCP ports, sequence space, flags, window, and checksum surround the protected bytes.', transportDetail, quic ? 'QUIC + UDP' : 'TCP', 'transport unit', 'packet'),
    event('packet-assembly-network', startAtMs + 1380, 'packet.assembly', 'packet', 'hold', 'IPv4', 'network', 'IPv4 envelope assembles', 'Source, destination, TTL, protocol, length, and checksum establish the routed packet.', 'The IP packet is the continuity object across routed hops. Its Ethernet envelope may change at every hop.', 'IPv4', 'routed packet', 'packet'),
    event('packet-assembly-link', startAtMs + 1840, 'packet.assembly', 'packet', 'hold', 'Ethernet II', 'link', 'Hop-local Ethernet envelope closes', 'Source and next-hop destination MAC addresses frame the same IPv4 packet for this local link.', 'The Ethernet header is hop-local. The NIC generates the FCS during transmission; the simulated inspection snapshot does not pretend the trailer was captured.', 'Ethernet', 'next-hop frame', 'packet'),
    event('packet-assembly-collapsed', startAtMs + 2300, 'packet.assembly', 'packet', 'hold', 'Ethernet / IPv4 / transport', 'collapsed', 'Structured frame ready at the NIC', 'Five semantic representations collapse into one deterministic outbound data unit.', 'No animation callback created this frame. Scrubbing to this timestamp reconstructs the same semantic assembly from the canonical event log.', 'network stack', 'NIC queue', 'packet'),
  ];
}

function packetTransitEvents(profile                         , startAtMs        )                 {
  const transport = profile === 'quic-h3' ? 'UDP / QUIC' : 'TCP';
  return [
    event('packet-transit-nic', startAtMs, 'packet.transit', 'packet', 'hold', `Ethernet / IPv4 / ${transport}`, 'nic-serialize', 'NIC serializes the structured frame', 'The frame becomes an ordered link transmission without changing its packet semantics.', 'The renderer exposes bytes, bits, and link activity as representations of one deterministic frame. The NIC generates a per-transmission FCS; it is not fabricated as captured packet data.', 'client NIC', 'access link', 'packet'),
    event('packet-transit-link', startAtMs + 480, 'packet.transit', 'packet', 'hold', 'Ethernet PHY', 'link-transmit', 'Symbols cross the access link', 'Structured bytes become physical link activity moving toward the switch.', 'Serialization is a rendering of the already-built frame. Browser scheduling cannot create, drop, or reorder semantic network state.', 'client NIC', 'access switch Gi0/3', 'physical'),
    event('packet-transit-switch-inspect', startAtMs + 960, 'packet.transit', 'packet', 'hold', 'Ethernet II', 'switch-inspect', 'Switch isolates destination MAC', 'Only the destination MAC is projected for the forwarding decision; unrelated packet fields recede.', 'The switch may learn the source MAC on ingress, but this forwarding decision compares destination MAC 02:48:4F:50:00:02 with its MAC table.', 'access switch Gi0/3', 'MAC table', 'packet'),
    event('packet-transit-switch-forward', startAtMs + 1440, 'packet.transit', 'packet', 'hold', 'Ethernet II', 'switch-forward', 'MAC table selects Gi0/24', 'The same Ethernet header and IPv4 payload leave the selected switch port.', 'A normal Layer 2 forward does not rewrite source or destination MAC. The egress transmitter generates link-local physical overhead such as a new FCS.', 'access switch', 'Gi0/24 → edge router', 'packet'),
    event('packet-transit-router-decapsulate', startAtMs + 1920, 'packet.transit', 'packet', 'hold', 'Ethernet II → IPv4', 'router-decapsulate', 'Router terminates the incoming Ethernet envelope', 'The hop-local Layer 2 shell opens and ends; the routed IPv4 packet remains.', 'The router validates the incoming frame, removes the Ethernet header/trailer context, and makes an IP forwarding decision. Ethernet does not continue through the router.', 'edge router lan0', 'IPv4 forwarding plane', 'packet'),
    event('packet-transit-router-ttl', startAtMs + 2400, 'packet.transit', 'packet', 'hold', 'IPv4', 'router-ttl', 'TTL decrements: 64 → 63', 'The router mutates the IPv4 TTL and updates the IPv4 header checksum.', 'Destination IP and transport payload remain logically continuous. TTL and its dependent header checksum are the exact routed-hop mutations shown here.', 'IPv4 forwarding plane', 'mutable header fields', 'packet'),
    event('packet-transit-router-route', startAtMs + 2880, 'packet.transit', 'packet', 'hold', 'IPv4 routing', 'router-route', 'Destination IP selects the next hop', '203.0.113.42 matches 203.0.113.0/24 via 198.51.100.2 on wan0.', 'The destination IP—not either hop-local MAC address—selects the route. The chosen next hop will supply the next Ethernet destination.', 'edge router FIB', 'wan0 / 198.51.100.2', 'builder'),
    event('packet-transit-router-reencapsulate', startAtMs + 3360, 'packet.transit', 'packet', 'hold', 'IPv4 → Ethernet II', 'router-reencapsulate', 'A new Ethernet envelope assembles', 'Router wan0 constructs new source and next-hop destination MAC fields around the forwarded IPv4 packet.', 'The outgoing frame is a new hop-local object. The IPv4 continuity identity survives with TTL 63 and an updated header checksum.', 'edge router wan0', 'next-hop Ethernet frame', 'packet'),
    event('packet-transit-next-link', startAtMs + 3840, 'packet.transit', 'packet', 'hold', 'Ethernet PHY', 'next-link', 'The re-encapsulated packet continues', 'A second link transmission carries the new Ethernet frame toward 198.51.100.2.', 'The visual grammar repeats—frame, serialization, link—but the Layer 2 addresses now belong to the next hop while the IP destination remains 203.0.113.42.', 'edge router wan0', 'next hop 198.51.100.2', 'physical'),
  ];
}

function sharedTail(hostname        , profile                         )                 {
  const applicationProtocol = profile === 'tcp-h2' ? 'HTTP/2 + TLS' : 'HTTP/3 + QUIC';
  return [
    event('response-ready', 19980, 'response.ready', 'application', 'out', applicationProtocol, 'response-ready', 'Response available to the application', 'Decrypted response bytes are delivered upward to the browser.', 'Network delivery ends by satisfying the application intent that began the story.', 'network stack', 'browser', 'http'),
    event('pullback-route', 20800, 'camera.pullback', 'routing', 'out', 'IP', 'pullback-routing', 'Pull back through the route', 'The journey recedes from application state to the forwarding structures that carried it.', 'Nothing new is transmitted here. This is an explanatory camera move through already completed causal state.', 'camera', 'routing scale', 'builder'),
    event('pullback-internet', 21650, 'camera.pullback', 'internet', 'out', 'Internet', 'pullback-internet', 'Return to Internet scale', 'Local routes, AS policy, and physical infrastructure collapse back into one global context.', 'Observed/public context can decorate this endpoint view without rewriting the simulated journey that just completed.', 'camera', 'Internet scale', 'physical', 'INFERRED'),
    event('complete', 22650, 'journey.complete', 'application', 'in', 'URL', 'complete', `${hostname} journey complete`, 'A human hostname became DNS state, routing state, transport state, protected application traffic, packets, and finally a response.', 'The same global time machine can now be rewound to any causal boundary without changing the event log.', hostname, 'browser'),
  ];
}

function buildJourneyScenario(hostnameInput = 'example.test', config                                 = {})                  {
  const hostname = normalizeJourneyHostname(hostnameInput);
  const destinationAddress = '203.0.113.42';
  const normalizedConfig                        = { ...DEFAULT_JOURNEY_CONFIG, ...config };
  const dnsShiftMs = normalizedConfig.dnsProfile === 'cache-hit' ? -2200 : 0;
  const baseTransportEvents = normalizedConfig.transportProfile === 'quic-h3' ? quicH3Events(hostname) : tcpH2Events(hostname);
  const transportEvents = shiftEvents(baseTransportEvents, dnsShiftMs);
  const tailEvents = shiftEvents(sharedTail(hostname, normalizedConfig.transportProfile), dnsShiftMs);
  const baseEvents = [
    ...sharedPrelude(hostname, destinationAddress, normalizedConfig.dnsProfile),
    ...transportEvents,
    ...tailEvents,
  ];
  const modifierResult = applyJourneyModifiers(baseEvents, normalizedConfig);
  const events = modifierResult.events;
  const modifierIds = modifierResult.appliedModifierIds;
  const impairmentProfile = impairmentProfileForModifiers(modifierIds);
  const impairmentKey = impairmentProfile === 'composed' ? modifierIds.join('+') : impairmentProfile;

  return {
    id: `url-journey:${hostname}:${normalizedConfig.transportProfile}:${normalizedConfig.dnsProfile}:${impairmentKey}`,
    hostname,
    destinationAddress,
    transportProfile: normalizedConfig.transportProfile,
    dnsProfile: normalizedConfig.dnsProfile,
    impairmentProfile,
    modifierIds,
    appliedModifierIds: modifierIds,
    durationMs: 23100 + dnsShiftMs + modifierResult.addedDurationMs,
    events,
  };
}

function latestJourneyEventAtOrBefore(scenario                 , timeMs        )               {
  let active = scenario.events[0];
  for (const candidate of scenario.events) {
    if (candidate.atMs > timeMs) break;
    active = candidate;
  }
  return active;
}

function journeyStateAt(scenario                 , requestedTimeMs        )               {
  const timeMs = Math.max(0, Math.min(scenario.durationMs, requestedTimeMs));
  const activeEvent = latestJourneyEventAtOrBefore(scenario, timeMs);
  const activeEventIndex = scenario.events.indexOf(activeEvent);
  const previousEvent = scenario.events[Math.max(0, activeEventIndex - 1)];
  const completed = scenario.events.filter((candidate) => candidate.atMs <= timeMs);

  let dns                  = 'idle';
  let dnsTtlBase                = null;
  let dnsCachedAtMs                = null;
  let resolvedAddress                = null;
  let route                    = 'idle';
  let transport                        = 'closed';
  let tls                  = 'idle';
  let http                   = 'idle';
  let server                     = 'healthy';
  let policy                     = 'normal';
  let packet                     = 'idle';
  let packetAssemblyStage                             = 'idle';
  let packetTransitStage                            = 'idle';
  let impairmentState                         = scenario.modifierIds.length === 0 ? 'clean' : 'armed';
  let transportMetrics                                 = null;
  let congestionMetrics                                  = null;
  let serverMetrics                              = null;
  let policyMetrics                              = null;
  let routeMetrics                             = null;
  let responseReady = false;
  let journeyComplete = false;
  let journeyFailed = false;
  let failureReason                               = null;

  for (const current of completed) {
    switch (current.kind) {
      case 'dns.cache-check': dns = 'cache-miss'; break;
      case 'dns.cache-hit':
        dns = 'cached';
        resolvedAddress = scenario.destinationAddress;
        dnsTtlBase = current.ttlSeconds ?? null;
        dnsCachedAtMs = current.atMs;
        break;
      case 'dns.query': dns = 'resolving'; break;
      case 'dns.timeout':
        dns = 'timeout';
        impairmentState = 'dns-failed';
        break;
      case 'dns.retry':
        dns = 'retrying';
        impairmentState = 'dns-retrying';
        break;
      case 'dns.failure-masked':
        impairmentState = 'dns-masked';
        break;
      case 'dns.referral':
        dns = 'resolving';
        if (impairmentState === 'dns-failed' || impairmentState === 'dns-retrying') impairmentState = 'normalized';
        break;
      case 'dns.answer': dns = 'resolved'; resolvedAddress = scenario.destinationAddress; break;
      case 'dns.cache-store':
        dns = 'cached';
        dnsTtlBase = current.ttlSeconds ?? null;
        dnsCachedAtMs = current.atMs;
        break;
      case 'route.lookup':
        route = 'lookup';
        if (impairmentState === 'dns-masked') impairmentState = 'normalized';
        break;
      case 'route.gateway': route = 'gateway-ready'; break;
      case 'route.failure':
        route = 'failed';
        impairmentState = 'route-failed';
        routeMetrics = current.routeMetrics ?? routeMetrics;
        break;
      case 'route.invalidated':
        route = 'failed';
        impairmentState = 'route-failed';
        routeMetrics = current.routeMetrics ?? routeMetrics;
        break;
      case 'route.recompute':
        route = 'recomputing';
        impairmentState = 'route-recomputing';
        routeMetrics = current.routeMetrics ?? routeMetrics;
        break;
      case 'route.alternate-installed':
        route = 'alternate-ready';
        impairmentState = 'route-ready';
        routeMetrics = current.routeMetrics ?? routeMetrics;
        break;
      case 'route.partition':
        route = 'failed';
        impairmentState = 'partitioned';
        routeMetrics = current.routeMetrics ?? routeMetrics;
        break;
      case 'route.partition-recompute':
        route = 'recomputing';
        impairmentState = 'partition-recomputing';
        routeMetrics = current.routeMetrics ?? routeMetrics;
        break;
      case 'route.unreachable':
        route = 'unreachable';
        impairmentState = 'unreachable';
        routeMetrics = current.routeMetrics ?? routeMetrics;
        break;
      case 'internet.policy-path': route = 'internet-path-ready'; policy = 'normal'; break;
      case 'internet.route-leak-advertised':
        policy = 'leak-advertised';
        impairmentState = 'policy-leak';
        policyMetrics = current.policyMetrics ?? policyMetrics;
        break;
      case 'internet.route-leak-selected':
        policy = 'leaked';
        impairmentState = 'policy-leak';
        policyMetrics = current.policyMetrics ?? policyMetrics;
        break;
      case 'internet.policy-anomaly':
        policy = 'anomaly';
        impairmentState = 'policy-anomaly';
        policyMetrics = current.policyMetrics ?? policyMetrics;
        break;
      case 'internet.route-leak-withdrawn':
        policy = 'anomaly';
        impairmentState = 'policy-anomaly';
        policyMetrics = current.policyMetrics ?? policyMetrics;
        break;
      case 'internet.policy-restored':
        policy = 'restored';
        impairmentState = 'policy-restored';
        policyMetrics = current.policyMetrics ?? policyMetrics;
        break;
      case 'internet.physical-context':
        if (impairmentState === 'policy-restored') impairmentState = 'normalized';
        break;
      case 'transport.segment': transport = 'handshake'; break;
      case 'transport.established': transport = 'established'; break;
      case 'transport.loss': impairmentState = 'lost'; break;
      case 'transport.loss-detected':
        impairmentState = 'detected';
        transportMetrics = current.transportMetrics ?? transportMetrics;
        break;
      case 'transport.retransmit': impairmentState = 'recovering'; break;
      case 'transport.recovered': impairmentState = 'recovered'; break;
      case 'transport.latency':
        impairmentState = 'delayed';
        transportMetrics = current.transportMetrics ?? transportMetrics;
        break;
      case 'transport.rtt-update':
        impairmentState = 'estimating';
        transportMetrics = current.transportMetrics ?? transportMetrics;
        break;
      case 'transport.latency-cleared':
        impairmentState = 'normalized';
        transportMetrics = current.transportMetrics ?? transportMetrics;
        break;
      case 'transport.queue-growth':
        impairmentState = 'queueing';
        transportMetrics = current.transportMetrics ?? transportMetrics;
        congestionMetrics = current.congestionMetrics ?? congestionMetrics;
        break;
      case 'transport.ecn-mark':
        impairmentState = 'ecn-signaled';
        transportMetrics = current.transportMetrics ?? transportMetrics;
        congestionMetrics = current.congestionMetrics ?? congestionMetrics;
        break;
      case 'transport.congestion-response':
        impairmentState = 'congestion-responding';
        transportMetrics = current.transportMetrics ?? transportMetrics;
        congestionMetrics = current.congestionMetrics ?? congestionMetrics;
        break;
      case 'transport.congestion-cleared':
        impairmentState = 'normalized';
        transportMetrics = current.transportMetrics ?? transportMetrics;
        congestionMetrics = current.congestionMetrics ?? congestionMetrics;
        break;
      case 'transport.stalled':
        transport = 'stalled';
        impairmentState = 'unreachable';
        routeMetrics = current.routeMetrics ?? routeMetrics;
        break;
      case 'tls.message': tls = 'negotiating'; break;
      case 'tls.validation': tls = 'validating'; break;
      case 'tls.keys': tls = current.phase === 'application-keys' ? 'application-keys' : 'handshake-keys'; break;
      case 'http.control': http = 'control'; break;
      case 'http.request': http = 'request-sent'; break;
      case 'server.unavailable':
        server = 'unavailable';
        impairmentState = 'server-unavailable';
        serverMetrics = current.serverMetrics ?? serverMetrics;
        break;
      case 'http.service-unavailable':
        server = 'unavailable';
        http = 'service-unavailable';
        impairmentState = 'server-unavailable';
        serverMetrics = current.serverMetrics ?? serverMetrics;
        break;
      case 'http.retry-wait':
        server = 'waiting';
        http = 'retry-wait';
        impairmentState = 'server-waiting';
        serverMetrics = current.serverMetrics ?? serverMetrics;
        break;
      case 'server.recovered':
        server = 'ready';
        impairmentState = 'server-ready';
        serverMetrics = current.serverMetrics ?? serverMetrics;
        break;
      case 'http.retry':
        server = 'ready';
        http = 'request-sent';
        impairmentState = 'server-ready';
        serverMetrics = current.serverMetrics ?? serverMetrics;
        break;
      case 'http.response':
        http = 'headers';
        if (impairmentState === 'server-ready') { server = 'healthy'; impairmentState = 'normalized'; }
        break;
      case 'http.data': http = 'streaming'; break;
      case 'packet.assembly':
        packet = 'assembling';
        packetAssemblyStage = current.phase                              ;
        break;
      case 'packet.transit':
        packet = 'transit';
        packetTransitStage = current.phase                             ;
        break;
      case 'packet.inspect':
        packet = current.phase === 'headers' ? 'headers' : 'frame';
        packetAssemblyStage = current.phase === 'headers' ? 'exploded' : 'collapsed';
        break;
      case 'transfer.complete': transport = 'complete'; http = 'complete'; break;
      case 'response.ready': responseReady = true; break;
      case 'journey.complete': journeyComplete = true; break;
      case 'journey.failed':
        route = 'unreachable';
        transport = 'stalled';
        http = 'stalled';
        responseReady = false;
        journeyComplete = false;
        journeyFailed = true;
        failureReason = 'network-unreachable';
        impairmentState = 'unreachable';
        routeMetrics = current.routeMetrics ?? routeMetrics;
        break;
      default: break;
    }
  }

  const dnsTtlSeconds = dnsTtlBase === null || dnsCachedAtMs === null
    ? null
    : Math.max(0, dnsTtlBase - Math.floor((timeMs - dnsCachedAtMs) / 1000));

  return {
    timeMs,
    activeEvent,
    activeEventIndex,
    completedEventIds: completed.map((current) => current.id),
    transportProfile: scenario.transportProfile,
    dnsProfile: scenario.dnsProfile,
    impairmentProfile: scenario.impairmentProfile,
    modifierIds: scenario.modifierIds,
    impairmentState,
    transportMetrics,
    congestionMetrics,
    serverMetrics,
    policyMetrics,
    routeMetrics,
    scale: activeEvent.scale,
    scaleDepth: JOURNEY_SCALE_DEPTH[activeEvent.scale],
    previousScale: previousEvent.scale,
    zoom: activeEvent.zoom,
    protocol: activeEvent.protocol,
    phase: activeEvent.phase,
    provenance: activeEvent.provenance,
    dns,
    dnsTtlSeconds,
    resolvedAddress,
    route,
    transport,
    tls,
    http,
    server,
    policy,
    packet,
    packetAssemblyStage,
    packetTransitStage,
    responseReady,
    journeyComplete,
    journeyFailed,
    failureReason,
  };
}


Object.assign(exports,{DEFAULT_JOURNEY_CONFIG,JOURNEY_SCALE_DEPTH,normalizeJourneyHostname,buildJourneyScenario,latestJourneyEventAtOrBefore,journeyStateAt});
},
"scenario.ts":(exports,read)=>{
const {buildJourneyScenario,
  normalizeJourneyHostname,}=read("model.ts");
const {impairmentProfileForModifiers,
  normalizeJourneyModifierIds,
  resolveJourneyModifierIds,}=read("modifiers.ts");

const JOURNEY_SCENARIO_SCHEMA = 'hopscotch.url-journey'         ;
const JOURNEY_SCENARIO_VERSION = 1         ;
const JOURNEY_SCENARIO_VERSION_V2 = 2         ;

                                                                                    

                                       
                                         
                
                   
                                            
                                
                 
 

                                                                                
                                           
                                                    
 

                                                                                
                                              
                                 
 

                                                                                            

const transportProfiles = new Set                         (['tcp-h2', 'quic-h3']);
const dnsProfiles = new Set                   (['cache-miss', 'cache-hit']);
const impairmentProfiles = new Set                                (['clean', 'dns-failure', 'route-leak', 'server-failure', 'single-loss', 'latency-spike', 'route-failure', 'path-outage', 'congestion', 'partition']);

function isRecord(value         )                                   {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeName(value         )                     {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new Error('Scenario name must be a string.');
  const normalized = value.trim();
  if (!normalized) return undefined;
  if (normalized.length > 80) throw new Error('Scenario name must be 80 characters or fewer.');
  return normalized;
}

function normalizeTime(value         )         {
  if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value) || value < 0) throw new Error('Scenario timeMs must be a non-negative integer.');
  return value;
}

function normalizeTransport(value         )                          {
  if (typeof value !== 'string' || !transportProfiles.has(value                           )) throw new Error('Invalid Journey transport profile.');
  return value                           ;
}

function normalizeDns(value         )                    {
  if (typeof value !== 'string' || !dnsProfiles.has(value                     )) throw new Error('Invalid Journey DNS profile.');
  return value                     ;
}

function normalizeImpairment(value         )                                 {
  if (typeof value !== 'string' || !impairmentProfiles.has(value                                  )) throw new Error('Invalid Journey impairment profile.');
  return value                                  ;
}

function normalizeCommon(value                         ) {
  return {
    name: normalizeName(value.name),
    hostname: normalizeJourneyHostname(typeof value.hostname === 'string' ? value.hostname : ''),
    transportProfile: normalizeTransport(value.transportProfile),
    dnsProfile: normalizeDns(value.dnsProfile),
    requestedTimeMs: normalizeTime(value.timeMs),
  };
}

function scenarioConfigFromPortable(scenario                         )                        {
  if (scenario.version === JOURNEY_SCENARIO_VERSION) {
    return {
      transportProfile: scenario.transportProfile,
      dnsProfile: scenario.dnsProfile,
      impairmentProfile: scenario.impairmentProfile,
    };
  }
  const modifierIds = normalizeJourneyModifierIds(scenario.modifiers);
  return {
    transportProfile: scenario.transportProfile,
    dnsProfile: scenario.dnsProfile,
    impairmentProfile: impairmentProfileForModifiers(modifierIds),
    modifierIds,
  };
}

function normalizePortableJourneyScenario(value         )                          {
  if (!isRecord(value)) throw new Error('Journey scenario must be a JSON object.');
  if (value.schema !== JOURNEY_SCENARIO_SCHEMA) throw new Error('Unsupported Journey scenario schema.');

  const common = normalizeCommon(value);

  if (value.version === JOURNEY_SCENARIO_VERSION) {
    const impairmentProfile = normalizeImpairment(value.impairmentProfile);
    const config                        = {
      transportProfile: common.transportProfile,
      dnsProfile: common.dnsProfile,
      impairmentProfile,
    };
    const generated = buildJourneyScenario(common.hostname, config);
    return {
      schema: JOURNEY_SCENARIO_SCHEMA,
      version: JOURNEY_SCENARIO_VERSION,
      ...(common.name ? { name: common.name } : {}),
      hostname: common.hostname,
      transportProfile: common.transportProfile,
      dnsProfile: common.dnsProfile,
      impairmentProfile,
      timeMs: Math.min(common.requestedTimeMs, generated.durationMs),
    };
  }

  if (value.version === JOURNEY_SCENARIO_VERSION_V2) {
    if (!Array.isArray(value.modifiers)) throw new Error('Journey schema v2 modifiers must be an array.');
    const modifiers = normalizeJourneyModifierIds(value.modifiers);
    if (modifiers.length < 2) throw new Error('Journey schema v2 requires at least two modifiers.');
    const config                        = {
      transportProfile: common.transportProfile,
      dnsProfile: common.dnsProfile,
      impairmentProfile: 'composed',
      modifierIds: modifiers,
    };
    const generated = buildJourneyScenario(common.hostname, config);
    return {
      schema: JOURNEY_SCENARIO_SCHEMA,
      version: JOURNEY_SCENARIO_VERSION_V2,
      ...(common.name ? { name: common.name } : {}),
      hostname: common.hostname,
      transportProfile: common.transportProfile,
      dnsProfile: common.dnsProfile,
      modifiers,
      timeMs: Math.min(common.requestedTimeMs, generated.durationMs),
    };
  }

  throw new Error('Unsupported Journey scenario version.');
}

function createPortableJourneyScenario(input                                                                                    )                          {
  const modifierIds = resolveJourneyModifierIds(input.config);
  const impairmentProfile = impairmentProfileForModifiers(modifierIds);
  if (modifierIds.length <= 1) {
    if (impairmentProfile === 'composed') throw new Error('Single-modifier Journey unexpectedly resolved as composed.');
    return normalizePortableJourneyScenario({
      schema: JOURNEY_SCENARIO_SCHEMA,
      version: JOURNEY_SCENARIO_VERSION,
      name: input.name,
      hostname: input.hostname,
      transportProfile: input.config.transportProfile,
      dnsProfile: input.config.dnsProfile,
      impairmentProfile,
      timeMs: input.timeMs,
    });
  }
  return normalizePortableJourneyScenario({
    schema: JOURNEY_SCENARIO_SCHEMA,
    version: JOURNEY_SCENARIO_VERSION_V2,
    name: input.name,
    hostname: input.hostname,
    transportProfile: input.config.transportProfile,
    dnsProfile: input.config.dnsProfile,
    modifiers: modifierIds,
    timeMs: input.timeMs,
  });
}

function serializeJourneyScenario(scenario                         )         {
  return JSON.stringify(normalizePortableJourneyScenario(scenario), null, 2);
}

function parseJourneyScenarioJson(json        )                          {
  let parsed         ;
  try { parsed = JSON.parse(json); } catch { throw new Error('Journey scenario file is not valid JSON.'); }
  return normalizePortableJourneyScenario(parsed);
}

function encodeJourneyQuery(scenario                         )         {
  const normalized = normalizePortableJourneyScenario(scenario);
  const params = new URLSearchParams();
  params.set('journey', String(normalized.version));
  params.set('host', normalized.hostname);
  params.set('transport', normalized.transportProfile);
  params.set('dns', normalized.dnsProfile);
  if (normalized.version === JOURNEY_SCENARIO_VERSION) params.set('impairment', normalized.impairmentProfile);
  else params.set('mods', normalized.modifiers.join(','));
  params.set('t', String(normalized.timeMs));
  if (normalized.name) params.set('name', normalized.name);
  return `?${params.toString()}`;
}

function decodeJourneyQuery(search        )                                 {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const journeyVersion = params.get('journey');
  if (journeyVersion !== '1' && journeyVersion !== '2') return null;
  const rawTime = params.get('t');
  if (rawTime === null || !/^\d+$/.test(rawTime)) throw new Error('Shared Journey time must be a non-negative integer.');

  if (journeyVersion === '1') {
    return normalizePortableJourneyScenario({
      schema: JOURNEY_SCENARIO_SCHEMA,
      version: JOURNEY_SCENARIO_VERSION,
      name: params.get('name') ?? undefined,
      hostname: params.get('host') ?? '',
      transportProfile: params.get('transport'),
      dnsProfile: params.get('dns'),
      impairmentProfile: params.get('impairment'),
      timeMs: Number(rawTime),
    });
  }

  const rawModifiers = params.get('mods');
  return normalizePortableJourneyScenario({
    schema: JOURNEY_SCENARIO_SCHEMA,
    version: JOURNEY_SCENARIO_VERSION_V2,
    name: params.get('name') ?? undefined,
    hostname: params.get('host') ?? '',
    transportProfile: params.get('transport'),
    dnsProfile: params.get('dns'),
    modifiers: rawModifiers === null ? null : rawModifiers.split(',').filter(Boolean),
    timeMs: Number(rawTime),
  });
}

function buildJourneyShareUrl(baseUrl        , scenario                         )         {
  const url = new URL(baseUrl);
  url.search = encodeJourneyQuery(scenario).slice(1);
  url.hash = '';
  return url.toString();
}


Object.assign(exports,{JOURNEY_SCENARIO_SCHEMA,JOURNEY_SCENARIO_VERSION,JOURNEY_SCENARIO_VERSION_V2,scenarioConfigFromPortable,normalizePortableJourneyScenario,createPortableJourneyScenario,serializeJourneyScenario,parseJourneyScenarioJson,encodeJourneyQuery,decodeJourneyQuery,buildJourneyShareUrl});
},
"presets.ts":(exports,read)=>{
                                                                
                                                        
const {createPortableJourneyScenario,}=read("scenario.ts");

                         
               
                                
  

const TCP_MISS = { transportProfile: 'tcp-h2', dnsProfile: 'cache-miss' }         ;

const PRESET_DEFINITIONS                                                       = {
  'dns-outage': {
    name: 'DNS resolver outage',
    config: { ...TCP_MISS, impairmentProfile: 'dns-failure' },
  },
  'route-failover': {
    name: 'Primary route failover',
    config: { ...TCP_MISS, impairmentProfile: 'route-failure' },
  },
  'path-outage': {
    name: 'Mid-transfer path outage',
    config: { ...TCP_MISS, impairmentProfile: 'path-outage' },
  },
  congestion: {
    name: 'Congestion with ECN feedback',
    config: { ...TCP_MISS, impairmentProfile: 'congestion' },
  },
  'route-leak': {
    name: 'BGP route leak',
    config: { ...TCP_MISS, impairmentProfile: 'route-leak' },
  },
  partition: {
    name: 'Terminal network partition',
    config: { ...TCP_MISS, impairmentProfile: 'partition' },
  },
  'server-503': {
    name: 'HTTP 503 safe retry',
    config: { ...TCP_MISS, impairmentProfile: 'server-failure' },
  },
  'quic-loss': {
    name: 'HTTP/3 packet loss recovery',
    config: { transportProfile: 'quic-h3', dnsProfile: 'cache-miss', impairmentProfile: 'single-loss' },
  },
};

function scenarioForPreset(id                  )                          {
  const preset = PRESET_DEFINITIONS[id];
  return createPortableJourneyScenario({
    name: preset.name,
    hostname: 'example.test',
    config: preset.config,
    timeMs: 0,
  });
}


Object.assign(exports,{scenarioForPreset});
}},cache={};function read(id){if(!cache[id]){cache[id]={};modules[id](cache[id],read);}return cache[id];}
const { WORKSPACE_IDS, WORKSPACE_CATALOG, EXPLORE_GROUPS, FEATURED_WORKSPACE_IDS }=read("workspace-catalog.ts");
const { resolveAppRoute, canonicalUrlForRoute }=read("navigation.ts");
const { SCENARIO_PRESET_CARDS }=read("catalog.ts");
const { scenarioForPreset }=read("presets.ts");
const { buildJourneyScenario, journeyStateAt }=read("model.ts");
const { createPortableJourneyScenario, normalizePortableJourneyScenario, scenarioConfigFromPortable, encodeJourneyQuery, decodeJourneyQuery }=read("scenario.ts");
document.getElementById('hop-connected-review').entryDomain=Object.freeze({WORKSPACE_IDS,WORKSPACE_CATALOG,EXPLORE_GROUPS,FEATURED_WORKSPACE_IDS,SCENARIO_PRESET_CARDS,resolveAppRoute,canonicalUrlForRoute,scenarioForPreset,buildJourneyScenario,journeyStateAt,createPortableJourneyScenario,normalizePortableJourneyScenario,scenarioConfigFromPortable,encodeJourneyQuery,decodeJourneyQuery});

})();