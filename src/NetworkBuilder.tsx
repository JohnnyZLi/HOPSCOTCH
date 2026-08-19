import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import {
  cloneBuilderAddressing,
  createDefaultBuilderAddressing,
  interfacesForBuilderNode,
  reconcileBuilderAddressing,
  replaceBuilderDefaultGateway,
  replaceBuilderInterfaceAddress,
  replaceBuilderSegmentCidr,
  type BuilderAddressing,
} from './builder/addressing.ts';
import {
  builderOspfState,
  cloneBuilderRoutingConfig,
  createDefaultBuilderRoutingConfig,
  deleteBuilderStaticRoute,
  installStaticRoutesForWeightedPath,
  nextHopOptionsForBuilderRouter,
  reconcileBuilderRoutingConfig,
  routeTableForBuilderRouter,
  setBuilderOspfEverywhere,
  setBuilderOspfRouterEnabled,
  traceBuilderForwarding,
  upsertBuilderStaticRoute,
  type BuilderRoutingConfig,
} from './builder/routing.ts';
import {
  BUILDER_LIMITS,
  cloneBuilderGraph,
  cloneBuilderLayout,
  defaultBuilderGraph,
  defaultBuilderLayout,
  deterministicNewNodePoint,
  findShortestPath,
  nextGeneratedLinkId,
  nextGeneratedNodeId,
  undirectedLinkExists,
  type BuilderGraph,
  type BuilderLayout,
  type BuilderNodeKind,
} from './builder/model';
import {
  createBuilderScenario,
  deleteStoredBuilderScenario,
  deserializeBuilderScenario,
  listStoredBuilderScenarios,
  saveStoredBuilderScenario,
  serializeBuilderScenario,
  type BuilderScenarioV8,
} from './builder/scenario';
import { runBuilderProbe, type BuilderProbePacketSeed, type BuilderProbeResult } from './builder/probes.ts';
import { runBuilderIpv6Probe } from './builder/ipv6-probes.ts';
import { createBuilderIpv6ControlState, type BuilderIpv6ControlState } from './builder/ipv6-control-plane.ts';
import { createBuilderIpv6LifecycleState, materializeBuilderIpv6RuntimeConfig, reconcileBuilderIpv6LifecycleWithControl, type BuilderIpv6LifecycleState } from './builder/ipv6-lifecycle.ts';
import { createDefaultBuilderIpv6RoutingDepthState, reconcileBuilderIpv6RoutingDepthState, type BuilderIpv6RoutingDepthState } from './builder/ipv6-routing-depth.ts';
import { cloneBuilderIpv6Config, createDefaultBuilderIpv6Config, reconcileBuilderIpv6Config, type BuilderIpv6Config } from './builder/ipv6.ts';
import { cloneBuilderEthernetConfig, createDefaultBuilderEthernetConfig, createEmptyBuilderEthernetConfig, parseBuilderAllowedVlans, runBuilderEthernetFlow, updateBuilderEthernetLink, type BuilderEthernetConfig, type BuilderEthernetFlowResult } from './builder/ethernet.ts';
import { cloneBuilderLinkProfiles, createDefaultBuilderLinkProfiles, reconcileBuilderLinkProfiles, updateBuilderLinkProfile, type BuilderLinkProfiles } from './builder/link-characteristics.ts';
import { cloneBuilderAclConfig, createDefaultBuilderAclConfig, deleteBuilderAclRule, reconcileBuilderAclConfig, traceBuilderPolicy, upsertBuilderAclRule, type BuilderAclAction, type BuilderAclConfig, type BuilderAclProtocol } from './builder/acl.ts';
import { clearBuilderArpCache, resolveBuilderEthernetFlowArp, type BuilderArpCache, type BuilderArpResolution } from './builder/arp.ts';
import { builderStpState } from './builder/stp.ts';
import { clearBuilderNatSessions, cloneBuilderNatConfig, createDefaultBuilderNatConfig, createEmptyBuilderNatConfig, reconcileBuilderNatConfig, type BuilderNatConfig, type BuilderNatSessionTable } from './builder/nat.ts';
import { BuilderNatPanel } from './BuilderNatPanel.tsx';
import { BuilderOspfTimingPanel } from './BuilderOspfTimingPanel.tsx';
import { BuilderOspfEcmpPanel } from './BuilderOspfEcmpPanel.tsx';
import { BuilderOspfAreaPanel } from './BuilderOspfAreaPanel.tsx';
import { BuilderIpv6Panel } from './BuilderIpv6Panel.tsx';
import { BuilderBgpPanel } from './BuilderBgpPanel.tsx';
import type { BuilderBgpAsProjection } from './builder/bgp.ts';
import { applyBuilderDhcpState, clearBuilderDhcpLeases, cloneBuilderDhcpConfig, createDefaultBuilderDhcpConfig, type BuilderDhcpConfig, type BuilderDhcpLeaseTable } from './builder/dhcp.ts';
import { BuilderDhcpPanel } from './BuilderDhcpPanel.tsx';
import { BuilderDeviceWorkbench } from './BuilderDeviceWorkbench.tsx';
import { BuilderTimeMachine } from './BuilderTimeMachine.tsx';
import { BuilderApplicationPanel } from './BuilderApplicationPanel.tsx';
import { BuilderAuthoringPanel } from './BuilderAuthoringPanel.tsx';
import type { BuilderAuthoringSession, BuilderAuthoringSnapshot } from './builder/authoring.ts';
import type { BuilderApplicationTransaction } from './builder/application.ts';
import { appendBuilderWorkbenchEventBatch, appendBuilderWorkbenchMessageEvent, buildBuilderDeviceWorkbench, builderWorkbenchDeviceOptions, classifyBuilderWorkbenchMessage, createBuilderWorkbenchEventJournal, type BuilderDeviceRef, type BuilderDeviceWorkbenchInput, type BuilderWorkbenchEventJournal } from './builder/device-workbench.ts';
import { deriveBuilderCanonicalEventSpecs } from './builder/canonical-events.ts';
import { builderTimelineJournalThroughSequence, builderTimelineSnapshotAtSequence, captureBuilderTimelineSnapshot, createBuilderTimeline, diffBuilderTimelineDevice, type BuilderTimeline } from './builder/timeline.ts';
import './NetworkBuilder.css';

function labelFor(graph: BuilderGraph, id: string): string {
  return graph.nodes.find((node) => node.id === id)?.label ?? id.toUpperCase();
}

function chooseValidNode(graph: BuilderGraph, preferred: string, avoid?: string): string {
  if (graph.nodes.some((node) => node.id === preferred) && preferred !== avoid) return preferred;
  return graph.nodes.find((node) => node.id !== avoid)?.id ?? '';
}

function BuilderCanvasViewport({ enabled, style, children }: { enabled: boolean; style: CSSProperties; children: ReactNode }) {
  return enabled ? <div className="builder-canvas-viewport" style={style}>{children}</div> : <>{children}</>;
}

export function NetworkBuilder({ onExit, onOpenFailureStory, onOpenProbePacket, onOpenBgpProjection, initialGraph = defaultBuilderGraph, initialLayout = defaultBuilderLayout, initialAddressing, initialRouting, initialEthernet, initialLinkProfiles, initialAcl, initialNat, initialDhcp, initialIpv6, initialSourceId = 'client', initialDestinationId = 'app', initialScenarioName = 'My topology', stressLabel }: { onExit: () => void; onOpenFailureStory: () => void; onOpenProbePacket?: (seed: BuilderProbePacketSeed) => void; onOpenBgpProjection?: (payload: { projection: BuilderBgpAsProjection; scenario: BuilderScenarioV8 }) => void; initialGraph?: BuilderGraph; initialLayout?: BuilderLayout; initialAddressing?: BuilderAddressing; initialRouting?: BuilderRoutingConfig; initialEthernet?: BuilderEthernetConfig; initialLinkProfiles?: BuilderLinkProfiles; initialAcl?: BuilderAclConfig; initialNat?: BuilderNatConfig; initialDhcp?: BuilderDhcpConfig; initialIpv6?: BuilderIpv6Config; initialSourceId?: string; initialDestinationId?: string; initialScenarioName?: string; stressLabel?: string }) {
  const reduceMotion = useReducedMotion();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [graph, setGraph] = useState<BuilderGraph>(() => cloneBuilderGraph(initialGraph));
  const [addressing, setAddressing] = useState<BuilderAddressing>(() => cloneBuilderAddressing(initialAddressing ?? createDefaultBuilderAddressing(initialGraph)));
  const [routing, setRouting] = useState<BuilderRoutingConfig>(() => cloneBuilderRoutingConfig(initialRouting ?? createDefaultBuilderRoutingConfig()));
  const [ipv6, setIpv6] = useState<BuilderIpv6Config>(() => { const initialIpv4=initialAddressing ?? createDefaultBuilderAddressing(initialGraph); return cloneBuilderIpv6Config(initialIpv6 ?? createDefaultBuilderIpv6Config(initialGraph,initialIpv4,!stressLabel)); });
  const [ethernet, setEthernet] = useState<BuilderEthernetConfig>(() => cloneBuilderEthernetConfig(initialEthernet ?? (stressLabel ? createEmptyBuilderEthernetConfig() : createDefaultBuilderEthernetConfig())));
  const [linkProfiles, setLinkProfiles] = useState<BuilderLinkProfiles>(() => cloneBuilderLinkProfiles(initialLinkProfiles ?? createDefaultBuilderLinkProfiles(initialGraph)));
  const [acl, setAcl] = useState<BuilderAclConfig>(() => cloneBuilderAclConfig(initialAcl ?? createDefaultBuilderAclConfig()));
  const [nat, setNat] = useState<BuilderNatConfig>(() => cloneBuilderNatConfig(initialNat ?? (stressLabel ? createEmptyBuilderNatConfig() : createDefaultBuilderNatConfig(initialGraph))));
  const [dhcp, setDhcp] = useState<BuilderDhcpConfig>(() => cloneBuilderDhcpConfig(initialDhcp ?? createDefaultBuilderDhcpConfig(initialEthernet ?? (stressLabel ? createEmptyBuilderEthernetConfig() : createDefaultBuilderEthernetConfig()))));
  const [dhcpLeases, setDhcpLeases] = useState<BuilderDhcpLeaseTable>(() => clearBuilderDhcpLeases());
  const [dhcpSequence, setDhcpSequence] = useState(1);
  const [natSessions, setNatSessions] = useState<BuilderNatSessionTable>(() => clearBuilderNatSessions());
  const [layout, setLayout] = useState<BuilderLayout>(() => cloneBuilderLayout(initialLayout));
  const [sourceId, setSourceId] = useState(initialSourceId);
  const [destinationId, setDestinationId] = useState(initialDestinationId);
  const [selectedNodeId, setSelectedNodeId] = useState(initialSourceId);
  const [selectedLinkId, setSelectedLinkId] = useState(() => initialGraph.links[0]?.id ?? '');
  const [newLinkA, setNewLinkA] = useState(() => initialGraph.nodes[0]?.id ?? '');
  const [newLinkB, setNewLinkB] = useState(() => initialGraph.nodes[1]?.id ?? initialGraph.nodes[0]?.id ?? '');
  const [newLinkCost, setNewLinkCost] = useState(5);
  const [scenarioName, setScenarioName] = useState(initialScenarioName);
  const [staticPrefix, setStaticPrefix] = useState('0.0.0.0/0');
  const [staticNextHop, setStaticNextHop] = useState('');
  const [staticMetric, setStaticMetric] = useState(1);
  const [saved, setSaved] = useState<BuilderScenarioV8[]>(() => listStoredBuilderScenarios());
  const [message, setMessageState] = useState('Graph truth and layout are separate. Dragging never changes route cost.');
  const [workbenchEvents, setWorkbenchEvents] = useState<BuilderWorkbenchEventJournal>(() => createBuilderWorkbenchEventJournal());
  const [workbenchDevice, setWorkbenchDevice] = useState<BuilderDeviceRef>(() => ({ plane: 'routed', id: initialSourceId }));
  const [timeline, setTimeline] = useState<BuilderTimeline>(() => createBuilderTimeline());
  const [timelineCursor, setTimelineCursor] = useState<number | null>(null);
  const [probeHistory, setProbeHistory] = useState<BuilderProbeResult[]>([]);
  const [applicationHistory, setApplicationHistory] = useState<BuilderApplicationTransaction[]>([]);
  const [authoringView, setAuthoringView] = useState<BuilderAuthoringSession>(() => ({ selection:[initialSourceId], ethernetLinkSelection:[], clipboard:null, sites:[], annotations:{}, showInterfaces:false, camera:{x:50,y:50,scale:1}, branches:[], baseline:null }));
  const [authoringMarquee, setAuthoringMarquee] = useState<{startX:number;startY:number;endX:number;endY:number;additive:boolean}|null>(null);
  const [selectedProbeId, setSelectedProbeId] = useState<string | null>(null);
  const [selectedProbeAttempt, setSelectedProbeAttempt] = useState(0);
  const [probeFamily, setProbeFamily] = useState<'ipv4'|'ipv6'>('ipv4');
  const [ipv6ControlState, setIpv6ControlState] = useState<BuilderIpv6ControlState>(() => createBuilderIpv6ControlState());
  const [ipv6LifecycleState, setIpv6LifecycleState] = useState<BuilderIpv6LifecycleState>(() => createBuilderIpv6LifecycleState());
  const [ipv6RoutingDepth, setIpv6RoutingDepth] = useState<BuilderIpv6RoutingDepthState>(() => createDefaultBuilderIpv6RoutingDepthState(initialGraph));
  const [ipv6ProbePacketBytes, setIpv6ProbePacketBytes] = useState(1280);
  const ethernetEndpoints = ethernet.devices.filter((device) => device.kind === 'endpoint');
  const [ethernetSourceId, setEthernetSourceId] = useState(() => ethernetEndpoints[0]?.id ?? '');
  const [ethernetDestinationId, setEthernetDestinationId] = useState(() => ethernetEndpoints[1]?.id ?? ethernetEndpoints[0]?.id ?? '');
  const [selectedEthernetLinkId, setSelectedEthernetLinkId] = useState(() => ethernet.links[0]?.id ?? '');
  const [ethernetFlow, setEthernetFlow] = useState<BuilderEthernetFlowResult | null>(null);
  const [arpCache, setArpCache] = useState<BuilderArpCache>([]);
  const [arpResolutions, setArpResolutions] = useState<BuilderArpResolution[]>([]);
  const [aclOrder, setAclOrder] = useState(10);
  const [aclAction, setAclAction] = useState<BuilderAclAction>('deny');
  const [aclProtocol, setAclProtocol] = useState<BuilderAclProtocol>('icmp');
  const [aclSourcePrefix, setAclSourcePrefix] = useState('0.0.0.0/0');
  const [aclDestinationPrefix, setAclDestinationPrefix] = useState('0.0.0.0/0');
  const [aclDestinationPort, setAclDestinationPort] = useState('');
  const [aclDescription, setAclDescription] = useState('Block diagnostic ICMP');
  const runtimeEthernet = useMemo(() => applyBuilderDhcpState(ethernet, dhcp, dhcpLeases, dhcpSequence), [ethernet, dhcp, dhcpLeases, dhcpSequence]);
  const liveWorkbenchInput = useMemo<BuilderDeviceWorkbenchInput>(() => ({ graph, addressing, routing, ipv6, ipv6ControlState, ipv6RoutingDepth, ethernet, ethernetFlow, arpCache, arpResolutions, acl, nat, natSessions, dhcp, dhcpLeases, dhcpSequence, probeHistory, applicationHistory, applicationStageOrder:null, sourceId, destinationId, events: workbenchEvents }), [graph, addressing, routing, ipv6, ipv6ControlState, ipv6RoutingDepth, ethernet, ethernetFlow, arpCache, arpResolutions, acl, nat, natSessions, dhcp, dhcpLeases, dhcpSequence, probeHistory, applicationHistory, sourceId, destinationId, workbenchEvents]);
  const liveTimelineInput = useMemo(() => ({ ...liveWorkbenchInput, layout, linkProfiles, ipv6LifecycleState }), [liveWorkbenchInput, layout, linkProfiles, ipv6LifecycleState]);
  useEffect(() => {
    if (stressLabel) return;
    const latestEvent=workbenchEvents.at(-1);
    if(!latestEvent)return;
    const lastCapturedSequence=timeline.snapshots.at(-1)?.sequence??-1;
    if(latestEvent.sequence<=lastCapturedSequence)return;
    if(latestEvent.kind==='action'){
      const previousState=timeline.snapshots.at(-1)?.state??null;
      const derived=deriveBuilderCanonicalEventSpecs(previousState,liveTimelineInput,latestEvent);
      if(derived.length>0){
        setWorkbenchEvents((current)=>current.at(-1)?.id===latestEvent.id?appendBuilderWorkbenchEventBatch(current,derived):current);
        return;
      }
    }
    setTimeline((current)=>captureBuilderTimelineSnapshot(current,workbenchEvents,liveTimelineInput));
  }, [stressLabel, workbenchEvents, liveTimelineInput, timeline.snapshots]);
  const historicalTimelineSnapshot = timelineCursor == null ? null : builderTimelineSnapshotAtSequence(timeline, timelineCursor);
  const isHistorical = historicalTimelineSnapshot != null;
  const sceneState = historicalTimelineSnapshot?.state ?? liveTimelineInput;
  const sceneGraph = sceneState.graph;
  const sceneControlGraph = sceneState.truthGraphs?.controlGraph ?? sceneGraph;
  const sceneRibGraph = sceneState.truthGraphs?.ribGraph ?? sceneGraph;
  const sceneFibGraph = sceneState.truthGraphs?.fibGraph ?? sceneGraph;
  const sceneAddressing = sceneState.addressing;
  const sceneRouting = sceneState.routing;
  const sceneIpv6 = sceneState.ipv6;
  const sceneIpv6ControlState = sceneState.ipv6ControlState;
  const sceneIpv6LifecycleState = sceneState.ipv6LifecycleState;
  const sceneIpv6RoutingDepth = sceneState.ipv6RoutingDepth;
  const sceneEthernet = sceneState.ethernet;
  const sceneEthernetFlow = sceneState.ethernetFlow;
  const sceneArpCache = sceneState.arpCache;
  const sceneArpResolutions = sceneState.arpResolutions;
  const sceneAcl = sceneState.acl;
  const sceneNat = sceneState.nat;
  const sceneNatSessions = sceneState.natSessions;
  const sceneDhcp = sceneState.dhcp;
  const sceneDhcpLeases = sceneState.dhcpLeases;
  const sceneDhcpSequence = sceneState.dhcpSequence;
  const sceneProbeHistory = sceneState.probeHistory;
  const sceneSourceId = sceneState.sourceId;
  const sceneDestinationId = sceneState.destinationId;
  const sceneLayout = sceneState.layout;
  const sceneLinkProfiles = sceneState.linkProfiles;
  const sceneSelectedNodeId = sceneGraph.nodes.some((node) => node.id === selectedNodeId) ? selectedNodeId : chooseValidNode(sceneGraph, sceneSourceId);
  const sceneSelectedLinkId = sceneGraph.links.some((link) => link.id === selectedLinkId) ? selectedLinkId : (sceneGraph.links[0]?.id ?? '');
  const sceneEthernetEndpoints = sceneEthernet.devices.filter((device) => device.kind === 'endpoint');
  const sceneEthernetSourceId = sceneEthernet.devices.some((device) => device.id === ethernetSourceId) ? ethernetSourceId : (sceneEthernetEndpoints[0]?.id ?? '');
  const sceneEthernetDestinationId = sceneEthernet.devices.some((device) => device.id === ethernetDestinationId) ? ethernetDestinationId : (sceneEthernetEndpoints.find((device) => device.id !== sceneEthernetSourceId)?.id ?? sceneEthernetSourceId);
  const sceneSelectedEthernetLinkId = sceneEthernet.links.some((link) => link.id === selectedEthernetLinkId) ? selectedEthernetLinkId : (sceneEthernet.links[0]?.id ?? '');
  const sceneRenderState = { ...sceneState, selectedNodeId: sceneSelectedNodeId, selectedLinkId: sceneSelectedLinkId, ethernetSourceId: sceneEthernetSourceId, ethernetDestinationId: sceneEthernetDestinationId, selectedEthernetLinkId: sceneSelectedEthernetLinkId };
  const displayedAuthoringSnapshot:BuilderAuthoringSnapshot={graph:sceneGraph,addressing:sceneAddressing,routing:sceneRouting,ethernet:sceneEthernet,linkProfiles:sceneLinkProfiles,acl:sceneAcl,nat:sceneNat,dhcp:sceneDhcp,ipv6:sceneIpv6,sourceId:sceneSourceId,destinationId:sceneDestinationId,layout:sceneLayout};

  const route = useMemo(() => findShortestPath(sceneGraph, sceneSourceId, sceneDestinationId), [sceneGraph, sceneSourceId, sceneDestinationId]);
  const forwardingTrace = useMemo(() => traceBuilderForwarding(sceneGraph, sceneAddressing, sceneRouting, sceneSourceId, sceneDestinationId, sceneFibGraph), [sceneGraph, sceneAddressing, sceneRouting, sceneSourceId, sceneDestinationId, sceneFibGraph]);
  const policyTrace = useMemo(() => traceBuilderPolicy(sceneGraph, sceneAddressing, sceneRouting, sceneAcl, sceneSourceId, sceneDestinationId, 'icmp', null, null, sceneFibGraph), [sceneGraph, sceneAddressing, sceneRouting, sceneAcl, sceneSourceId, sceneDestinationId, sceneFibGraph]);
  const ospfState = useMemo(() => builderOspfState(sceneControlGraph, sceneAddressing, sceneRouting), [sceneControlGraph, sceneAddressing, sceneRouting]);
  const selectedLink = sceneGraph.links.find((link) => link.id === sceneSelectedLinkId) ?? sceneGraph.links[0];
  const selectedLinkProfile = selectedLink ? sceneLinkProfiles[selectedLink.id] : undefined;
  const selectedNode = sceneGraph.nodes.find((node) => node.id === sceneSelectedNodeId) ?? sceneGraph.nodes[0];
  const selectedSegment = selectedLink ? sceneAddressing.segments[selectedLink.id] : undefined;
  const selectedNodeInterfaces = selectedNode ? interfacesForBuilderNode(sceneAddressing, selectedNode.id) : [];
  const selectedRouteTable = selectedNode?.kind === 'router' ? routeTableForBuilderRouter(sceneRibGraph, sceneAddressing, sceneRouting, selectedNode.id) : [];
  const selectedOspfEnabled = Boolean(selectedNode?.kind === 'router' && sceneRouting.ospf.enabledRouterIds.includes(selectedNode.id));
  const selectedOspfAdjacencies = selectedNode?.kind === 'router' ? ospfState.adjacencies.filter((adjacency) => adjacency.aRouterId === selectedNode.id || adjacency.bRouterId === selectedNode.id) : [];
  const selectedOspfComponent = selectedNode?.kind === 'router' ? ospfState.components.find((component) => component.includes(selectedNode.id)) : undefined;
  const selectedOspfPrefixCount = selectedOspfComponent ? new Set(ospfState.advertisements.filter((advertisement) => selectedOspfComponent.includes(advertisement.routerId)).map((advertisement) => advertisement.prefix)).size : 0;
  const selectedNextHopOptions = selectedNode?.kind === 'router' ? nextHopOptionsForBuilderRouter(sceneGraph, sceneAddressing, selectedNode.id) : [];
  const effectiveStaticNextHop = selectedNextHopOptions.some((option) => option.address === staticNextHop) ? staticNextHop : (selectedNextHopOptions[0]?.address ?? '');
  const destinationInterface = interfacesForBuilderNode(sceneAddressing, sceneDestinationId)[0];
  const destinationPrefix = destinationInterface ? (sceneAddressing.segments[destinationInterface.linkId]?.cidr ?? '0.0.0.0/0') : '0.0.0.0/0';
  const activeLinks = new Set(route.linkIds);
  const forwardingLinks = new Set(forwardingTrace.hops.flatMap((hop) => hop.linkId ? [hop.linkId] : []));
  const selectedProbe = sceneProbeHistory.find((probe) => probe.id === selectedProbeId) ?? sceneProbeHistory[0] ?? null;
  const selectedAttempt = selectedProbe?.attempts[Math.min(selectedProbeAttempt, Math.max(0, selectedProbe.attempts.length - 1))] ?? null;
  const probeLinks = new Set(selectedAttempt?.requestLinkIds ?? []);
  const selectedEthernetLink = sceneEthernet.links.find((link) => link.id === sceneSelectedEthernetLinkId) ?? sceneEthernet.links[0];
  const ethernetFlowLinks = new Set(sceneEthernetFlow?.segments.flatMap((segment) => segment.linkIds) ?? []);
  const ethernetSourceDevice = sceneEthernet.devices.find((device) => device.id === sceneEthernetSourceId);
  const ethernetSourceVlan = ethernetSourceDevice?.interfaces[0]?.vlanId ?? sceneEthernet.vlans[0]?.id ?? 1;
  const stpState = useMemo(() => builderStpState(sceneEthernet, ethernetSourceVlan), [sceneEthernet, ethernetSourceVlan]);
  const stpBlockedLinks = new Set(stpState.blockedLinkIds);
  const selectedRouterAclRules = selectedNode?.kind === 'router' ? sceneAcl.rules.filter((rule) => rule.routerId === selectedNode.id).sort((a,b)=>a.order-b.order||a.id.localeCompare(b.id)) : [];
  const displayedWorkbenchInput = historicalTimelineSnapshot ? { ...historicalTimelineSnapshot.state, events: builderTimelineJournalThroughSequence(workbenchEvents, historicalTimelineSnapshot.sequence) } : liveWorkbenchInput;
  const workbenchOptions = useMemo(() => stressLabel ? [] : builderWorkbenchDeviceOptions(displayedWorkbenchInput.graph, displayedWorkbenchInput.ethernet), [displayedWorkbenchInput.graph, displayedWorkbenchInput.ethernet, stressLabel]);
  const effectiveWorkbenchDevice = workbenchOptions.some((option) => option.plane === workbenchDevice.plane && option.id === workbenchDevice.id)
    ? workbenchDevice
    : ({ plane: workbenchOptions[0]?.plane ?? 'routed', id: workbenchOptions[0]?.id ?? sceneSelectedNodeId } as BuilderDeviceRef);
  const workbenchSnapshot = useMemo(() => stressLabel ? null : buildBuilderDeviceWorkbench(displayedWorkbenchInput, effectiveWorkbenchDevice), [stressLabel, displayedWorkbenchInput, effectiveWorkbenchDevice.plane, effectiveWorkbenchDevice.id]);
  const workbenchTimelineDiff = useMemo(() => historicalTimelineSnapshot ? diffBuilderTimelineDevice(timeline, workbenchEvents, historicalTimelineSnapshot.sequence, effectiveWorkbenchDevice) : null, [historicalTimelineSnapshot, timeline, workbenchEvents, effectiveWorkbenchDevice.plane, effectiveWorkbenchDevice.id]);
  const displayedMessage = historicalTimelineSnapshot ? `HISTORY #${String(historicalTimelineSnapshot.sequence).padStart(3,'0')} · ${historicalTimelineSnapshot.summary} · ${historicalTimelineSnapshot.detail}` : message;
  const setMessage = (nextMessage: string, explicitEthernetIds: readonly string[] = []) => {
    setTimelineCursor(null);
    setMessageState(nextMessage);
    const category = classifyBuilderWorkbenchMessage(nextMessage);
    const routedRefs: BuilderDeviceRef[] = [
      ...(graph.nodes.some((node) => node.id === selectedNodeId) ? [{ plane: 'routed' as const, id: selectedNodeId }] : []),
      ...(graph.nodes.some((node) => node.id === sourceId) ? [{ plane: 'routed' as const, id: sourceId }] : []),
      ...(graph.nodes.some((node) => node.id === destinationId) ? [{ plane: 'routed' as const, id: destinationId }] : []),
    ];
    const lanRefs: BuilderDeviceRef[] = [
      ...(ethernet.devices.some((device) => device.id === ethernetSourceId) ? [{ plane: 'ethernet' as const, id: ethernetSourceId }] : []),
      ...(ethernet.devices.some((device) => device.id === ethernetDestinationId) ? [{ plane: 'ethernet' as const, id: ethernetDestinationId }] : []),
      ...((selectedEthernetLink ? [selectedEthernetLink.a, selectedEthernetLink.b] : []).map((id) => ({ plane: 'ethernet' as const, id }))),
    ];
    const explicitRefs:BuilderDeviceRef[]=explicitEthernetIds.filter((id)=>ethernet.devices.some((device)=>device.id===id)).map((id)=>({plane:'ethernet' as const,id}));
    const refs = explicitRefs.length>0?explicitRefs:(['dhcp','neighbor','switching'].includes(category) ? lanRefs : routedRefs);
    setWorkbenchEvents((current) => appendBuilderWorkbenchMessageEvent(current, nextMessage, refs));
  };

  const resetEthernetDemo = () => {
    const next = createDefaultBuilderEthernetConfig(); setEthernet(next); setDhcp(createDefaultBuilderDhcpConfig(next)); setDhcpLeases(clearBuilderDhcpLeases()); setDhcpSequence(1); setEthernetSourceId('lan-a'); setEthernetDestinationId('lan-b'); setSelectedEthernetLinkId(next.links[0]?.id ?? ''); setEthernetFlow(null); setArpCache(clearBuilderArpCache()); setArpResolutions([]); setMessage('LAN FABRIC RESET · VLANs, STP, ARP/DHCP runtime state, trunks, and router-on-a-stick interfaces restored.');
  };
  const runEthernet = () => { const arp=resolveBuilderEthernetFlowArp(runtimeEthernet,ethernetSourceId,ethernetDestinationId,arpCache); setArpCache(arp.cache); setArpResolutions(arp.resolutions); if(!arp.success){setEthernetFlow(null);setMessage(`ARP FAILED · ${arp.failureReason ?? 'Address resolution failed.'}`);return;} const result = runBuilderEthernetFlow(runtimeEthernet,ethernetSourceId,ethernetDestinationId); setEthernetFlow(result); setMessage(`LAN FABRIC · ${arp.resolutions.map((entry)=>entry.cacheHit?'ARP CACHE HIT':'ARP RESOLVED').join(' + ')} · ${result.summary}`); };
  const patchEthernetLink = (patch: Parameters<typeof updateBuilderEthernetLink>[2]) => { if(!selectedEthernetLink)return; try{const next=updateBuilderEthernetLink(ethernet,selectedEthernetLink.id,patch);setEthernet(next);setEthernetFlow(null);setArpResolutions([]);setMessage(`LAN PORT · ${selectedEthernetLink.id.toUpperCase()} updated. Rerun the frame to observe new switching/VLAN truth.`);}catch(error){setMessage(`LAN CONFIG REJECTED · ${error instanceof Error?error.message:'Invalid Ethernet port configuration.'}`);} };

  const runProbe = (kind: 'ping' | 'traceroute') => {
    const result = probeFamily === 'ipv6'
      ? runBuilderIpv6Probe(graph, materializeBuilderIpv6RuntimeConfig(ipv6, ipv6LifecycleState), kind, sourceId, destinationId, probeHistory.length + 1, linkProfiles, natSessions, ipv6ControlState, ipv6ProbePacketBytes, reconcileBuilderIpv6RoutingDepthState(graph, ipv6RoutingDepth))
      : runBuilderProbe(graph, addressing, routing, kind, sourceId, destinationId, probeHistory.length + 1, linkProfiles, acl, nat, natSessions);
    if (probeFamily === 'ipv6') { const ipv6Result = result as ReturnType<typeof runBuilderIpv6Probe>; setIpv6ControlState(ipv6Result.ipv6ControlState); setIpv6LifecycleState((current) => reconcileBuilderIpv6LifecycleWithControl(ipv6Result.ipv6ControlState, current)); }
    setNatSessions(result.natSessions);
    setProbeHistory((current) => [result, ...current].slice(0, 10));
    setSelectedProbeId(result.id);
    setSelectedProbeAttempt(result.attempts.length > 0 ? result.attempts.length - 1 : 0);
    setMessage(`${kind.toUpperCase()} · ${result.summary}`);
  };

  const commitGraph = (next: BuilderGraph) => {
    const nextAddressing = reconcileBuilderAddressing(next, addressing);
    const nextRouting = reconcileBuilderRoutingConfig(next, nextAddressing, routing);
    setGraph(next);
    setAddressing(nextAddressing);
    setRouting(nextRouting);
    setIpv6(reconcileBuilderIpv6Config(next,nextAddressing,ipv6));
    setLinkProfiles(reconcileBuilderLinkProfiles(next, linkProfiles));
    setAcl(reconcileBuilderAclConfig(next, acl));
    setNat(reconcileBuilderNatConfig(next, nat));
    setNatSessions(clearBuilderNatSessions());
    setIpv6ControlState(createBuilderIpv6ControlState()); setIpv6LifecycleState(createBuilderIpv6LifecycleState()); setIpv6RoutingDepth(createDefaultBuilderIpv6RoutingDepthState(next));
    const nextSource = chooseValidNode(next, sourceId);
    const nextDestination = chooseValidNode(next, destinationId, nextSource) || nextSource;
    setSourceId(nextSource);
    setDestinationId(nextDestination);
    if (!next.nodes.some((node) => node.id === selectedNodeId)) setSelectedNodeId(nextSource);
    if (!next.links.some((link) => link.id === selectedLinkId)) setSelectedLinkId(next.links[0]?.id ?? '');
    setNewLinkA(chooseValidNode(next, newLinkA));
    setNewLinkB(chooseValidNode(next, newLinkB, chooseValidNode(next, newLinkA)));
  };

  const commitAddressing = (next: BuilderAddressing) => {
    setAddressing(next);
    setRouting(reconcileBuilderRoutingConfig(graph, next, routing));
    setIpv6(reconcileBuilderIpv6Config(graph,next,ipv6));
    setNatSessions(clearBuilderNatSessions());
  };


  const applyAuthoringSnapshot = (next:BuilderAuthoringSnapshot,nextMessage:string) => {
    setGraph(cloneBuilderGraph(next.graph)); setAddressing(cloneBuilderAddressing(next.addressing)); setRouting(cloneBuilderRoutingConfig(next.routing)); setIpv6(cloneBuilderIpv6Config(next.ipv6)); setEthernet(cloneBuilderEthernetConfig(next.ethernet)); setLinkProfiles(cloneBuilderLinkProfiles(next.linkProfiles)); setAcl(cloneBuilderAclConfig(next.acl)); setNat(cloneBuilderNatConfig(next.nat)); setDhcp(cloneBuilderDhcpConfig(next.dhcp)); setLayout(cloneBuilderLayout(next.layout)); setSourceId(next.sourceId); setDestinationId(next.destinationId);
    setSelectedNodeId(next.graph.nodes.some((node)=>node.id===selectedNodeId)?selectedNodeId:next.sourceId); setSelectedLinkId(next.graph.links.some((link)=>link.id===selectedLinkId)?selectedLinkId:(next.graph.links[0]?.id??''));
    setNatSessions(clearBuilderNatSessions()); setDhcpLeases(clearBuilderDhcpLeases()); setDhcpSequence(1); setIpv6ControlState(createBuilderIpv6ControlState()); setIpv6LifecycleState(createBuilderIpv6LifecycleState()); setIpv6RoutingDepth(createDefaultBuilderIpv6RoutingDepthState(next.graph)); setArpCache(clearBuilderArpCache()); setArpResolutions([]); setEthernetFlow(null); setProbeHistory([]); setApplicationHistory([]);
    setAuthoringView((current)=>({...current,selection:current.selection.filter((id)=>next.graph.nodes.some((node)=>node.id===id)),ethernetLinkSelection:current.ethernetLinkSelection.filter((id)=>next.ethernet.links.some((link)=>link.id===id))}));
    setMessage(nextMessage);
  };
  const commitAuthoringGraph=(nextGraph:BuilderGraph,nextLayout:BuilderLayout|null,nextMessage:string)=>{if(nextLayout)setLayout(cloneBuilderLayout(nextLayout));commitGraph(nextGraph);setMessage(nextMessage);};
  const commitAuthoringAddressing=(next:BuilderAddressing,nextMessage:string)=>{commitAddressing(next);setMessage(nextMessage);};
  const commitAuthoringEthernet=(next:BuilderEthernetConfig,nextMessage:string)=>{setEthernet(cloneBuilderEthernetConfig(next));setEthernetFlow(null);setArpCache(clearBuilderArpCache());setArpResolutions([]);setMessage(nextMessage);};
  const setAuthoringLayout=(next:BuilderLayout,nextMessage:string)=>{setLayout(cloneBuilderLayout(next));setMessage(nextMessage);};
  const focusAuthoringDevice=(deviceId:string)=>{if(!graph.nodes.some((node)=>node.id===deviceId))return;setSelectedNodeId(deviceId);setWorkbenchDevice({plane:'routed',id:deviceId});};

  const patchSelectedLinkProfile = (patch: Parameters<typeof updateBuilderLinkProfile>[3]) => {
    if (!selectedLink) return;
    try { setLinkProfiles(updateBuilderLinkProfile(graph,linkProfiles,selectedLink.id,patch)); setMessage(`LINK CHARACTERISTICS · ${labelFor(graph,selectedLink.a)} ↔ ${labelFor(graph,selectedLink.b)} updated. Routing cost remains ${selectedLink.cost}.`); }
    catch(error){ setMessage(`LINK PROFILE REJECTED · ${error instanceof Error?error.message:'Invalid link characteristic.'}`); }
  };

  const addAclRule = () => {
    if (!selectedNode || selectedNode.kind !== 'router') { setMessage('Select a router before adding an ACL rule.'); return; }
    try {
      const port=aclDestinationPort.trim()===''?null:Number(aclDestinationPort);
      const next=upsertBuilderAclRule(graph,acl,{routerId:selectedNode.id,order:aclOrder,action:aclAction,protocol:aclProtocol,sourcePrefix:aclSourcePrefix,destinationPrefix:aclDestinationPrefix,destinationPort:port,description:aclDescription});
      setAcl(next); setMessage(`ACL · ${selectedNode.label} rule ${aclOrder} ${aclAction.toUpperCase()} ${aclProtocol.toUpperCase()} installed. Route truth is unchanged.`);
    } catch(error){ setMessage(`ACL REJECTED · ${error instanceof Error?error.message:'Invalid ACL rule.'}`); }
  };

  const clearArp = () => { setArpCache(clearBuilderArpCache()); setArpResolutions([]); setMessage('ARP CACHE CLEARED · rerun the LAN flow to force address resolution.'); };

  const setSelectedOspf = (enabled: boolean) => {
    if (!selectedNode || selectedNode.kind !== 'router') { setMessage('Select a router before changing OSPF.'); return; }
    try {
      setRouting(setBuilderOspfRouterEnabled(graph, addressing, routing, selectedNode.id, enabled));
      setMessage(`OSPF · ${selectedNode.label} ${enabled ? 'joined' : 'left'} AREA 0. Dynamic routes recompute from current adjacencies and link costs.`);
    } catch (error) { setMessage(`OSPF REJECTED · ${error instanceof Error ? error.message : 'Unable to change OSPF state.'}`); }
  };

  const setAllOspf = (enabled: boolean) => {
    setRouting(setBuilderOspfEverywhere(graph, addressing, routing, enabled));
    setMessage(enabled ? 'OSPF AREA 0 ENABLED · all routers participate. Link failures and cost edits now trigger deterministic SPF reconvergence.' : 'OSPF DISABLED · dynamic routes withdrawn. Connected and static routes remain.');
  };

  const clearStaticRoutes = () => {
    const next = cloneBuilderRoutingConfig(routing);
    next.staticRoutes = [];
    setRouting(next);
    setMessage('All static routes cleared. Connected and OSPF-derived routes remain.');
  };

  const installCurrentStaticPath = () => {
    try {
      const installed = installStaticRoutesForWeightedPath(graph, addressing, routing, sourceId, destinationId);
      setRouting(installed.routing);
      setMessage(`STATIC PATH INSTALLED · ${installed.prefix} via ${installed.installedRouterIds.length === 0 ? 'connected routes only' : installed.installedRouterIds.map((id) => labelFor(graph,id)).join(' → ')}. This snapshots the current graph path and will not reconverge automatically.`);
    } catch (error) {
      setMessage(`STATIC INSTALL REJECTED · ${error instanceof Error ? error.message : 'Unable to install static path.'}`);
    }
  };

  const addStaticRoute = () => {
    if (!selectedNode || selectedNode.kind !== 'router') { setMessage('Select a router before adding a static route.'); return; }
    if (!effectiveStaticNextHop) { setMessage(`${selectedNode.label} has no directly connected next hop.`); return; }
    try {
      const next = upsertBuilderStaticRoute(graph, addressing, routing, { routerId: selectedNode.id, prefix: staticPrefix, nextHop: effectiveStaticNextHop, metric: staticMetric });
      setRouting(next);
      const installed = next.staticRoutes.find((entry) => entry.routerId === selectedNode.id && entry.prefix === staticPrefix.trim() && entry.nextHop === effectiveStaticNextHop) ?? next.staticRoutes.at(-1);
      setMessage(`STATIC ROUTE · ${selectedNode.label} ${installed?.prefix ?? staticPrefix} via ${effectiveStaticNextHop} metric ${staticMetric}.`);
    } catch (error) {
      setMessage(`STATIC ROUTE REJECTED · ${error instanceof Error ? error.message : 'Invalid static route.'}`);
    }
  };

  const updateLink = (linkId: string, patch: Partial<{ cost: number; failed: boolean }>) => {
    commitGraph({ ...graph, links: graph.links.map((link) => link.id === linkId ? { ...link, ...patch } : link) });
    if (routing.ospf.enabledRouterIds.length > 0) setMessage('TOPOLOGY CHANGED · OSPF Area 0 recomputes immediately from active adjacencies and current link costs. Static routes do not reconverge.');
  };

  const addNode = (kind: BuilderNodeKind) => {
    if (graph.nodes.length >= BUILDER_LIMITS.maxNodes) { setMessage(`Node limit is ${BUILDER_LIMITS.maxNodes}.`); return; }
    const id = nextGeneratedNodeId(graph, kind);
    const label = kind === 'router' ? id.toUpperCase() : `HOST ${id.replace('host', '')}`;
    const nextGraph = { ...graph, nodes: [...graph.nodes, { id, label, kind }] };
    setLayout((current) => ({ ...current, [id]: deterministicNewNodePoint(graph.nodes.length - defaultBuilderGraph.nodes.length) }));
    commitGraph(nextGraph);
    setNewLinkA(id);
    setMessage(`${label} added. Connect it with a weighted link to affect graph truth.`);
  };

  const deleteNode = (nodeId: string) => {
    const node = graph.nodes.find((item) => item.id === nodeId);
    if (!node || node.builtin) { setMessage('Built-in nodes stay recoverable; user-created nodes can be deleted.'); return; }
    const nextGraph = { nodes: graph.nodes.filter((item) => item.id !== nodeId), links: graph.links.filter((link) => link.a !== nodeId && link.b !== nodeId) };
    setLayout((current) => Object.fromEntries(Object.entries(current).filter(([id]) => id !== nodeId)));
    commitGraph(nextGraph);
    setMessage(`${node.label} and its incident links were removed atomically.`);
  };

  const addLink = () => {
    if (!newLinkA || !newLinkB || newLinkA === newLinkB) { setMessage('A link needs two different nodes.'); return; }
    if (undirectedLinkExists(graph, newLinkA, newLinkB)) { setMessage('That undirected link already exists.'); return; }
    if (!Number.isInteger(newLinkCost) || newLinkCost < BUILDER_LIMITS.minCost || newLinkCost > BUILDER_LIMITS.maxCost) { setMessage(`Link cost must be ${BUILDER_LIMITS.minCost}–${BUILDER_LIMITS.maxCost}.`); return; }
    if (graph.links.length >= BUILDER_LIMITS.maxLinks) { setMessage(`Link limit is ${BUILDER_LIMITS.maxLinks}.`); return; }
    const id = nextGeneratedLinkId(graph, newLinkA, newLinkB);
    commitGraph({ ...graph, links: [...graph.links, { id, a: newLinkA, b: newLinkB, cost: newLinkCost, failed: false }] });
    setSelectedLinkId(id);
    setMessage(`${labelFor(graph, newLinkA)} ↔ ${labelFor(graph, newLinkB)} added at cost ${newLinkCost}.`);
  };

  const deleteLink = (linkId: string) => {
    const link = graph.links.find((item) => item.id === linkId);
    if (!link) return;
    commitGraph({ ...graph, links: graph.links.filter((item) => item.id !== linkId) });
    setMessage(`${labelFor(graph, link.a)} ↔ ${labelFor(graph, link.b)} deleted.`);
  };

  const resetTopology = () => {
    setGraph(cloneBuilderGraph(initialGraph));
    setAddressing(cloneBuilderAddressing(initialAddressing ?? createDefaultBuilderAddressing(initialGraph)));
    setRouting(cloneBuilderRoutingConfig(initialRouting ?? createDefaultBuilderRoutingConfig()));
    { const initialIpv4=initialAddressing ?? createDefaultBuilderAddressing(initialGraph); setIpv6(cloneBuilderIpv6Config(initialIpv6 ?? createDefaultBuilderIpv6Config(initialGraph,initialIpv4,!stressLabel))); }
    setEthernet(cloneBuilderEthernetConfig(initialEthernet ?? createDefaultBuilderEthernetConfig())); setEthernetFlow(null); setLinkProfiles(cloneBuilderLinkProfiles(initialLinkProfiles ?? createDefaultBuilderLinkProfiles(initialGraph))); setAcl(cloneBuilderAclConfig(initialAcl ?? createDefaultBuilderAclConfig())); setNat(cloneBuilderNatConfig(initialNat ?? createDefaultBuilderNatConfig(initialGraph))); setDhcp(cloneBuilderDhcpConfig(initialDhcp ?? createDefaultBuilderDhcpConfig(initialEthernet ?? createDefaultBuilderEthernetConfig()))); setDhcpLeases(clearBuilderDhcpLeases()); setDhcpSequence(1); setNatSessions(clearBuilderNatSessions()); setIpv6ControlState(createBuilderIpv6ControlState()); setIpv6LifecycleState(createBuilderIpv6LifecycleState()); setIpv6RoutingDepth(createDefaultBuilderIpv6RoutingDepthState(initialGraph)); setArpCache(clearBuilderArpCache()); setArpResolutions([]);
    setSourceId(initialSourceId); setDestinationId(initialDestinationId); setSelectedNodeId(initialSourceId); setScenarioName(initialScenarioName); setSelectedLinkId(initialGraph.links[0]?.id ?? ''); setNewLinkA(initialGraph.nodes[0]?.id ?? ''); setNewLinkB(initialGraph.nodes[1]?.id ?? initialGraph.nodes[0]?.id ?? ''); setNewLinkCost(5);
    setMessage('Topology, addressing, routing, OSPF, link characteristics, ACL/NAT policy, ARP, and NAT session state reset. Visual layout was left untouched.');
  };

  const resetLayout = () => {
    const next = cloneBuilderLayout(initialLayout);
    graph.nodes.forEach((node, index) => { if (!next[node.id]) next[node.id] = deterministicNewNodePoint(index - defaultBuilderGraph.nodes.length); });
    setLayout(next);
    setMessage('Visual layout reset without changing graph truth.');
  };

  const saveScenario = () => {
    try {
      const existing = saved.find((item) => item.name === scenarioName);
      const scenario = createBuilderScenario(scenarioName.trim() || 'Untitled topology', graph, sourceId, destinationId, layout, addressing, routing, existing, ethernet, linkProfiles, acl, nat, dhcp, ipv6);
      setSaved(saveStoredBuilderScenario(scenario));
      setMessage(`Saved “${scenario.name}” locally as Builder schema v${scenario.version}.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to save scenario.'); }
  };

  const restoreScenario = (scenario: BuilderScenarioV8) => {
    setGraph(cloneBuilderGraph(scenario.graph)); setAddressing(cloneBuilderAddressing(scenario.addressing)); setRouting(cloneBuilderRoutingConfig(scenario.routing)); setIpv6(cloneBuilderIpv6Config(scenario.ipv6)); setEthernet(cloneBuilderEthernetConfig(scenario.ethernet)); setLinkProfiles(cloneBuilderLinkProfiles(scenario.linkProfiles)); setAcl(cloneBuilderAclConfig(scenario.acl)); setNat(cloneBuilderNatConfig(scenario.nat)); setDhcp(cloneBuilderDhcpConfig(scenario.dhcp)); setDhcpLeases(clearBuilderDhcpLeases()); setDhcpSequence(1); setNatSessions(clearBuilderNatSessions()); setIpv6ControlState(createBuilderIpv6ControlState()); setIpv6LifecycleState(createBuilderIpv6LifecycleState()); setIpv6RoutingDepth(createDefaultBuilderIpv6RoutingDepthState(scenario.graph)); setArpCache(clearBuilderArpCache()); setArpResolutions([]); setEthernetFlow(null); setEthernetSourceId(scenario.ethernet.devices.find((device)=>device.kind==='endpoint')?.id ?? ''); setEthernetDestinationId(scenario.ethernet.devices.filter((device)=>device.kind==='endpoint')[1]?.id ?? scenario.ethernet.devices.find((device)=>device.kind==='endpoint')?.id ?? ''); setSelectedEthernetLinkId(scenario.ethernet.links[0]?.id ?? ''); setLayout(cloneBuilderLayout(scenario.layout)); setSourceId(scenario.sourceId); setDestinationId(scenario.destinationId);
    setSelectedNodeId(scenario.sourceId); setSelectedLinkId(scenario.graph.links[0]?.id ?? ''); setScenarioName(scenario.name);
    setMessage(`Restored “${scenario.name}”. IPv4/IPv6 routing, link characteristics, ACL/NAT, VLAN, and STP configuration restored; session ARP/NAT/probe state cleared.`);
  };

  const exportScenario = () => {
    try {
      const scenario = createBuilderScenario(scenarioName.trim() || 'Exported topology', graph, sourceId, destinationId, layout, addressing, routing, undefined, ethernet, linkProfiles, acl, nat, dhcp, ipv6);
      const blob = new Blob([serializeBuilderScenario(scenario)], { type: 'application/json' });
      const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
      anchor.href = url; anchor.download = `${scenario.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'hopscotch-topology'}.hopscotch.json`; anchor.click(); URL.revokeObjectURL(url);
      setMessage('Scenario v9 exported with dual-stack routed topology, OSPF/BGP control-plane configuration, link characteristics, ACL/NAT policy, Ethernet/STP, and DHCP configuration; ARP/ND/FDB/NAT translations/DHCP leases/probes/device events remain session-only.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Export failed.'); }
  };

  const importScenario = async (file: File | undefined) => {
    if (!file) return;
    try {
      const scenario = deserializeBuilderScenario(await file.text());
      restoreScenario(scenario);
      setMessage(`Imported “${scenario.name}” as schema v${scenario.version}.`);
    } catch (error) { setMessage(`IMPORT REJECTED · ${error instanceof Error ? error.message : 'Invalid scenario.'}`); }
  };

  const openBgpProjection = (projection: BuilderBgpAsProjection) => {
    if (!onOpenBgpProjection || !projection.selectedRoute) { setMessage('BGP AS PROJECTION · select a router/prefix with a concrete BEST route first.'); return; }
    try {
      const scenario = createBuilderScenario(scenarioName.trim() || 'BGP projection', graph, sourceId, destinationId, layout, addressing, routing, undefined, ethernet, linkProfiles, acl, nat, dhcp, ipv6);
      onOpenBgpProjection({ projection, scenario });
    } catch (error) { setMessage(`BGP PROJECTION REJECTED · ${error instanceof Error ? error.message : 'Unable to snapshot Builder truth.'}`); }
  };

  const authoringCanvasPoint=(clientX:number,clientY:number)=>{const canvas=canvasRef.current;if(!canvas)return null;const rect=canvas.getBoundingClientRect();const screenX=((clientX-rect.left)/Math.max(1,rect.width))*100;const screenY=((clientY-rect.top)/Math.max(1,rect.height))*100;const scale=authoringView.camera.scale;const tx=50-authoringView.camera.x*scale;const ty=50-authoringView.camera.y*scale;return{x:(screenX-tx)/scale,y:(screenY-ty)/scale};};

  const onNodeDragEnd = (nodeId: string, offsetX: number, offsetY: number) => {
    const canvas = canvasRef.current; const current = layout[nodeId]; if (!canvas || !current) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, current.x + (offsetX / Math.max(rect.width * authoringView.camera.scale, 1)) * 100));
    const y = Math.max(0, Math.min(100, current.y + (offsetY / Math.max(rect.height * authoringView.camera.scale, 1)) * 100));
    setLayout((prior) => ({ ...prior, [nodeId]: { x, y } }));
    setMessage(`${labelFor(graph, nodeId)} moved visually. Route truth remains ${route.reachable ? `cost ${route.totalCost}` : 'unreachable'}.`);
  };

  const renderWorkspace = ({ graph, addressing, routing, ipv6, ipv6ControlState, ipv6LifecycleState, ipv6RoutingDepth, ethernet, ethernetFlow, arpCache, arpResolutions, acl, nat, natSessions, dhcp, dhcpLeases, dhcpSequence, probeHistory, sourceId, destinationId, layout, linkProfiles, selectedNodeId, selectedLinkId, ethernetSourceId, ethernetDestinationId, selectedEthernetLinkId }: typeof sceneRenderState) => (
    <motion.section className={`builder-workspace ${isHistorical ? 'builder-history-mode' : ''}`} data-builder-history-sequence={historicalTimelineSnapshot?.sequence ?? 'live'} data-stress-label={stressLabel} data-node-count={graph.nodes.length} data-link-count={graph.links.length} initial={reduceMotion ? { opacity: 1 } : { opacity: 0, scale: .985 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
      <header className="builder-heading">
        <div><p className="eyebrow">Lab 04 · Network builder</p><h1>DRAW THE GRAPH.<br/><span>CHANGE THE ROUTE.</span></h1></div>
        <div className="builder-heading-actions"><button className="lab-mode" type="button" onClick={onOpenFailureStory}>FAILURE STORY ↗</button><button className="lab-mode" type="button" onClick={onExit}>EXIT LAB</button></div>
      </header>

      <div className="builder-main">
        <section className="builder-stage">
          <div className="builder-stage-meta">{isHistorical&&<div className="builder-history-meta"><span>TIME MACHINE</span><strong>HISTORY #{String(historicalTimelineSnapshot?.sequence??0).padStart(3,'0')} · READ ONLY</strong></div>}<div><span>GRAPH PATH</span><strong>{route.reachable ? `YES · COST ${route.totalCost}` : 'NO PATH'}</strong></div><div><span>L3 FORWARDING</span><strong>{forwardingTrace.reachable ? 'REACHABLE' : 'NO ROUTE'}</strong></div><div><span>ACTIVE PROBE</span><strong>{selectedProbe ? `${selectedProbe.kind.toUpperCase()} · ${selectedProbe.success ? 'PASS' : 'FAIL'}${selectedProbe.natApplied ? ' · NAT' : ''}` : 'IDLE'}</strong></div><div><span>OSPF AREA 0</span><strong>{ospfState.enabledRouterIds.length === 0 ? 'OFF' : `${ospfState.enabledRouterIds.length} RTR · ${ospfState.fullAdjacencyCount} FULL`}</strong></div><div><span>STATIC</span><strong>{routing.staticRoutes.length} ROUTES</strong></div>{!stressLabel&&<div><span>NAT/PAT</span><strong>{nat.boundaries.length === 0 ? 'OFF' : `${nat.boundaries.length} BOUNDARY · ${natSessions.length} STATE`}</strong></div>}<div><span>GRAPH</span><strong>{graph.nodes.length} NODES · {graph.links.length} LINKS</strong></div></div>
          <div ref={canvasRef} className={`builder-canvas ${authoringView.camera.scale!==1?'is-authoring-zoomed':''}`} onPointerDown={(event)=>{if(isHistorical||stressLabel)return;const target=event.target;if(target instanceof Element&&target.closest('.builder-node,.builder-link'))return;const point=authoringCanvasPoint(event.clientX,event.clientY);if(!point)return;setAuthoringMarquee({startX:point.x,startY:point.y,endX:point.x,endY:point.y,additive:event.shiftKey||event.metaKey||event.ctrlKey});event.currentTarget.setPointerCapture(event.pointerId);}} onPointerMove={(event)=>{if(!authoringMarquee)return;const point=authoringCanvasPoint(event.clientX,event.clientY);if(point)setAuthoringMarquee((current)=>current?{...current,endX:point.x,endY:point.y}:current);}} onPointerUp={()=>{if(!authoringMarquee)return;const minX=Math.min(authoringMarquee.startX,authoringMarquee.endX),maxX=Math.max(authoringMarquee.startX,authoringMarquee.endX),minY=Math.min(authoringMarquee.startY,authoringMarquee.endY),maxY=Math.max(authoringMarquee.startY,authoringMarquee.endY);const picked=graph.nodes.filter((node)=>{const point=layout[node.id];return Boolean(point&&point.x>=minX&&point.x<=maxX&&point.y>=minY&&point.y<=maxY);}).map((node)=>node.id);setAuthoringView((current)=>({...current,selection:authoringMarquee.additive?[...new Set([...current.selection,...picked])]:picked}));setAuthoringMarquee(null);}} onPointerCancel={()=>setAuthoringMarquee(null)}>
            <BuilderCanvasViewport enabled={!stressLabel} style={{transform:`translate(${50-authoringView.camera.x*authoringView.camera.scale}%, ${50-authoringView.camera.y*authoringView.camera.scale}%) scale(${authoringView.camera.scale})`}}>
            {authoringView.sites.map((site)=>{const points=site.nodeIds.flatMap((id)=>layout[id]?[layout[id]]:[]);if(points.length===0)return null;const left=Math.max(0,Math.min(...points.map((point)=>point.x))-6),top=Math.max(0,Math.min(...points.map((point)=>point.y))-6),right=Math.min(100,Math.max(...points.map((point)=>point.x))+6),bottom=Math.min(100,Math.max(...points.map((point)=>point.y))+6);return <div key={site.id} className={`builder-site-bound ${site.collapsed?'collapsed':''}`} style={{left:`${left}%`,top:`${top}%`,width:`${Math.max(4,right-left)}%`,height:`${Math.max(4,bottom-top)}%`}}><span>{site.label} · {site.nodeIds.length}</span></div>;})}
            {authoringMarquee&&<div className="builder-marquee" style={{left:`${Math.min(authoringMarquee.startX,authoringMarquee.endX)}%`,top:`${Math.min(authoringMarquee.startY,authoringMarquee.endY)}%`,width:`${Math.abs(authoringMarquee.endX-authoringMarquee.startX)}%`,height:`${Math.abs(authoringMarquee.endY-authoringMarquee.startY)}%`}}/>}
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Weighted routed topology">
              {graph.links.map((link) => {
                const a = layout[link.a]; const b = layout[link.b]; if (!a || !b) return null;
                const active = activeLinks.has(link.id); const forwarding = forwardingLinks.has(link.id);
                return <g key={link.id} data-link-id={link.id} className={`builder-link ${link.failed ? 'failed' : active ? 'active' : 'alternate'} ${forwarding ? 'l3-forwarding' : ''} ${probeLinks.has(link.id) ? 'probe-active' : ''} ${selectedLinkId === link.id ? 'selected' : ''}`} role="button" aria-label={`${labelFor(graph, link.a)} to ${labelFor(graph, link.b)} link · ${link.failed ? 'down' : `cost ${link.cost}`}`} tabIndex={0} onClick={() => setSelectedLinkId(link.id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setSelectedLinkId(link.id); }}>
                  <line className="hit" x1={a.x} y1={a.y} x2={b.x} y2={b.y}/><line x1={a.x} y1={a.y} x2={b.x} y2={b.y}/><text x={(a.x+b.x)/2} y={(a.y+b.y)/2 - 1.5}>{link.failed ? 'DOWN' : link.cost}</text>
                </g>;
              })}
            </svg>
            {graph.nodes.map((node) => {
              const point = layout[node.id]; if (!point) return null;
              const onRoute = route.nodeIds.includes(node.id);
              return <div key={node.id} className="builder-node-anchor" style={{ left: `${point.x}%`, top: `${point.y}%` }}>
                <motion.div className={`builder-node ${node.kind} ${onRoute ? 'on-route' : ''} ${selectedNode?.id === node.id ? 'selected' : ''} ${authoringView.selection.includes(node.id)?'is-multi-selected':''}`} drag={!isHistorical} dragMomentum={false} dragElastic={0} onPointerDown={(event) => { event.stopPropagation(); const additive=event.shiftKey||event.metaKey||event.ctrlKey; setAuthoringView((current)=>({...current,selection:additive?(current.selection.includes(node.id)?current.selection.filter((id)=>id!==node.id):[...current.selection,node.id]):[node.id]})); setSelectedNodeId(node.id); setWorkbenchDevice({ plane: 'routed', id: node.id }); }} onDragEnd={(_, info) => { if (!isHistorical) onNodeDragEnd(node.id, info.offset.x, info.offset.y); }} whileDrag={reduceMotion ? undefined : { scale: 1.08, zIndex: 8 }}>
                  <span>{node.kind === 'router' ? 'RTR' : 'END'}</span><strong>{node.label}</strong>{authoringView.showInterfaces&&<small className="builder-node-interface-names">{interfacesForBuilderNode(addressing,node.id).map((entry)=>entry.name).join(' · ')||'NO ROUTED INTERFACES'}</small>}{authoringView.annotations[node.id]&&<small className="builder-node-annotation">{authoringView.annotations[node.id]}</small>}{!node.builtin && <button type="button" disabled={isHistorical} onPointerDown={(event) => event.stopPropagation()} onClick={() => deleteNode(node.id)} aria-label={`Delete ${node.label}`}>×</button>}
                </motion.div>
              </div>;
            })}
            </BuilderCanvasViewport>
          </div>
          <div className={`builder-route ${route.reachable ? '' : 'unreachable'}`}><span>WEIGHTED GRAPH PATH</span><strong>{route.reachable ? route.nodeIds.map((id) => labelFor(graph,id)).join(' → ') : 'NO VIABLE PATH'}</strong><p>{route.explanation}</p></div>
          <div className={`builder-ospf-summary ${ospfState.enabledRouterIds.length === 0 ? 'off' : ''}`}><span>OSPF CONTROL PLANE · AREA 0</span><strong>{ospfState.enabledRouterIds.length === 0 ? 'DISABLED · NO DYNAMIC ROUTES' : `${ospfState.components.length} LSDB VIEW${ospfState.components.length === 1 ? '' : 'S'} · ${ospfState.fullAdjacencyCount} FULL · ${ospfState.downAdjacencyCount} DOWN`}</strong><p>{ospfState.enabledRouterIds.length === 0 ? 'Enable OSPF on Builder routers to derive dynamic routes without changing weighted graph truth.' : 'Enabled routers form adjacencies only across active router-router links. SPF uses Builder link cost; connected and static routes keep their own precedence.'}</p></div>
          <div className={`builder-forwarding ${forwardingTrace.reachable ? '' : 'unreachable'}`}><span>L3 FORWARDING · {forwardingTrace.destinationAddress ?? 'NO DESTINATION IP'}</span><strong>{forwardingTrace.reachable ? [sourceId,...forwardingTrace.hops.map((hop)=>hop.nextNodeId).filter((id): id is string=>Boolean(id))].filter((id,index,all)=>index===0||id!==all[index-1]).map((id)=>labelFor(graph,id)).join(' → ') : `${forwardingTrace.failureNodeId ? labelFor(graph,forwardingTrace.failureNodeId) : 'FORWARDING'} · ${forwardingTrace.failureReason ?? 'NO ROUTE'}`}</strong><p>{forwardingTrace.explanation}</p>{forwardingTrace.hops.length>0&&<div className="builder-forwarding-hops">{forwardingTrace.hops.map((hop,index)=><span key={`${hop.nodeId}-${index}`}><b>{hop.nodeLabel}</b>{hop.routeSource.toUpperCase()} · {hop.matchedPrefix ?? '—'} · {hop.nextHop ?? 'LOCAL'} · {hop.outgoingInterface ?? '—'}</span>)}</div>}</div>
          <div className={`builder-policy-panel ${policyTrace.forwarding.reachable && !policyTrace.permitted ? 'denied' : ''}`}><span>ROUTED POLICY · ICMP</span><strong>{!policyTrace.forwarding.reachable ? 'NOT EVALUATED · NO FORWARDING PATH' : policyTrace.permitted ? 'PERMITTED' : `DENIED · ${policyTrace.deniedAtRouterId ? labelFor(graph,policyTrace.deniedAtRouterId) : 'DEFAULT'}`}</strong><p>{policyTrace.explanation}</p></div>
          <div className={`builder-probe-panel ${selectedProbe ? (selectedProbe.success ? 'success' : 'failed') : 'idle'}`}><span>ACTIVE PROBE · SESSION SNAPSHOT</span>{selectedProbe&&selectedAttempt?<><strong>{selectedProbe.kind.toUpperCase()} · TTL {selectedAttempt.ttl} · {selectedAttempt.status.replace('-', ' ').toUpperCase()}</strong><p>{selectedAttempt.detail}</p>{selectedAttempt.natDetail&&<small>NAT · {selectedAttempt.natDetail}</small>}<div className="builder-probe-metrics"><span><b>{selectedAttempt.simulatedRttMs ?? '—'}</b>RTT MS</span><span><b>{selectedAttempt.jitterMs}</b>JITTER MS</span><span><b>{selectedAttempt.bottleneckMbps ?? '—'}</b>BOTTLENECK Mb/s</span><span><b>{selectedAttempt.pathMtuBytes ?? '—'}</b>PATH MTU</span><span><b>{selectedAttempt.pathLossPercent.toFixed(2)}%</b>PATH LOSS</span></div><div className="builder-probe-path">{selectedAttempt.requestNodeIds.map((id,index)=><span key={`${selectedProbe.id}-${selectedAttempt.index}-${id}-${index}`}><b>{labelFor(graph,id)}</b>{index===0?'SOURCE':index===selectedAttempt.requestNodeIds.length-1?'RESPONDER':'TRANSIT'}</span>)}</div><small>{selectedProbe.snapshotNote}</small></>:<><strong>NO PROBE YET</strong><p>Run Ping or Traceroute. Probes consume the current L3 forwarding table instead of inventing their own route.</p></>}</div>
          {!stressLabel&&<BuilderApplicationPanel
            context={{ graph, addressing, routing, ethernet, linkProfiles, acl, nat, natSessions, dhcp, dhcpLeases, dhcpSequence, ipv6, ipv6ControlState, ipv6RoutingDepth, arpCache }}
            sourceNodeId={sourceId}
            historical={isHistorical}
            onSessionState={(next)=>{ setArpCache(next.arpCache); setNatSessions(next.natSessions); setDhcpLeases(next.dhcpLeases); setIpv6ControlState(next.ipv6ControlState); }}
            onTransaction={(transaction)=>setApplicationHistory((current)=>[...current,transaction].slice(-24))}
            onMessage={setMessage}
          />}
          <div className={`builder-ethernet-stage ${ethernetFlow ? (ethernetFlow.success?'success':'failed') : ''}`}><span>ETHERNET FABRIC · SWITCHING + VLANs</span><strong>{ethernetFlow ? (ethernetFlow.success ? (ethernetFlow.routed ? `ROUTED · VLAN ${ethernetFlow.sourceVlan} → ${ethernetFlow.destinationVlan}` : `SWITCHED · VLAN ${ethernetFlow.sourceVlan}`) : 'UNREACHABLE') : 'READY · VLAN 10 / VLAN 20'}</strong><p>{ethernetFlow?.summary ?? 'A separate LAN teaching fabric keeps access ports, trunks, MAC learning, broadcast domains, and router-on-a-stick behavior explicit without pretending the routed /30 graph is Ethernet.'}</p><div className="builder-lan-canvas"><svg viewBox="0 0 100 100" preserveAspectRatio="none">{ethernet.links.map((link)=>{const a=ethernet.layout[link.a],b=ethernet.layout[link.b];if(!a||!b)return null;return <g key={link.id} className={`${link.failed?'failed':''} ${stpBlockedLinks.has(link.id)?'stp-blocked':''} ${ethernetFlowLinks.has(link.id)?'flow':''}`}><line x1={a.x} y1={a.y} x2={b.x} y2={b.y}/><text x={(a.x+b.x)/2} y={(a.y+b.y)/2-2}>{link.failed?'DOWN':link.mode==='access'?`A${link.accessVlan}`:`T ${link.allowedVlans?.join(',')}`}</text></g>;})}</svg>{ethernet.devices.map((device)=>{const point=ethernet.layout[device.id];if(!point)return null;return <div key={device.id} role="button" tabIndex={0} aria-label={`Inspect ${device.label}`} onClick={()=>setWorkbenchDevice({plane:'ethernet',id:device.id})} onKeyDown={(event)=>{if(event.key==='Enter'||event.key===' ')setWorkbenchDevice({plane:'ethernet',id:device.id});}} className={`builder-lan-node ${device.kind} ${effectiveWorkbenchDevice.plane==='ethernet'&&effectiveWorkbenchDevice.id===device.id?'workbench-selected':''}`} style={{left:`${point.x}%`,top:`${point.y}%`}}><span>{device.kind==='switch'?'SW':device.kind==='router'?'RTR':'END'}</span><strong>{device.label}</strong>{device.interfaces[0]&&<small>{device.interfaces.map((entry)=>`V${entry.vlanId}`).join(' · ')}</small>}</div>;})}</div><div className="builder-lan-truth"><span><b>STP</b>{stpState.enabled ? `${stpState.rootBridgeLabel ?? '—'} ROOT · ${stpState.blockedLinkIds.length} BLOCKED` : stpState.loopDetected ? 'DISABLED · LOOP UNSAFE' : 'DISABLED · NO CYCLE'}</span><span><b>ARP CACHE</b>{arpCache.length} ENTRIES</span></div>{arpResolutions.length>0&&<div className="builder-arp-events">{arpResolutions.map((entry,index)=><span key={`${entry.ownerDeviceId}-${entry.targetAddress}-${index}`} className={entry.success?'':'failed'}><b>{entry.cacheHit?'ARP CACHE HIT':entry.success?'ARP REQUEST → REPLY':'ARP FAILED'} · VLAN {entry.vlanId}</b>{entry.summary}</span>)}</div>}{ethernetFlow&&<div className="builder-lan-phases">{ethernetFlow.segments.map((segment)=><span key={`${segment.phase}-${segment.vlanId}`}><b>VLAN {segment.vlanId} · {segment.phase.replace('-', ' ').toUpperCase()}</b>{segment.nodeIds.map((id)=>ethernet.devices.find((device)=>device.id===id)?.label??id).join(' → ')} · {segment.disposition}</span>)}</div>}<small>ARP CACHE IS SESSION-ONLY · STP BLOCKS REDUNDANT SWITCH LINKS · SAME-VLAN TTL 64 → 64 · INTER-VLAN TTL 64 → 63</small></div>
          <div className="builder-message">{displayedMessage}</div>
        </section>

        <aside className="builder-controls">
          {!stressLabel&&<BuilderTimeMachine timeline={timeline} cursor={timelineCursor} onSeek={setTimelineCursor}/>}
          {!stressLabel&&workbenchSnapshot&&<BuilderDeviceWorkbench snapshot={workbenchSnapshot} options={workbenchOptions} historicalSequence={historicalTimelineSnapshot?.sequence??null} diff={workbenchTimelineDiff} onSelect={(ref)=>{setWorkbenchDevice(ref);if(ref.plane==='routed')setSelectedNodeId(ref.id);}}/>}
          {!stressLabel&&<BuilderAuthoringPanel snapshot={displayedAuthoringSnapshot} view={authoringView} historical={isHistorical} onViewChange={setAuthoringView} onApplySnapshot={applyAuthoringSnapshot} onCommitGraph={commitAuthoringGraph} onCommitAddressing={commitAuthoringAddressing} onCommitEthernet={commitAuthoringEthernet} onSetLayout={setAuthoringLayout} onFocusDevice={focusAuthoringDevice} onMessage={setMessage}/>}
          {!stressLabel&&isHistorical&&<div className="builder-history-lock"><strong>HISTORICAL SCENE · READ ONLY</strong><span>Canvas, forwarding overlays, LAN/STP/ARP state, protocol panels, route tables, NAT/DHCP state, and the Device Workbench are all projected from event #{String(historicalTimelineSnapshot?.sequence??0).padStart(3,'0')}. Return to LIVE to edit.</span></div>}
          <fieldset className="builder-live-controls" disabled={isHistorical}>
          <section><div className="control-title"><span>ENDPOINTS</span><strong>GRAPH ↔ IP</strong></div><label>SOURCE<select value={sourceId} onChange={(e)=>setSourceId(e.currentTarget.value)}>{graph.nodes.map((node)=><option key={node.id} value={node.id}>{node.label}</option>)}</select></label><label>DESTINATION<select value={destinationId} onChange={(e)=>setDestinationId(e.currentTarget.value)}>{graph.nodes.map((node)=><option key={node.id} value={node.id}>{node.label}</option>)}</select></label><div className="button-row"><button type="button" onClick={installCurrentStaticPath}>INSTALL STATIC PATH</button><button type="button" onClick={clearStaticRoutes}>CLEAR STATICS</button></div><small className="builder-routing-note">INSTALL snapshots the current weighted path. Static routes do not reconverge when a link fails.</small></section>
          <section className="builder-probe-section"><div className="control-title"><span>ACTIVE PROBES</span><strong>{probeFamily==='ipv6'?'ICMPV6':'ICMP'} · SESSION ONLY</strong></div><label>NETWORK FAMILY<select value={probeFamily} onChange={(event)=>setProbeFamily(event.currentTarget.value as 'ipv4'|'ipv6')}><option value="ipv4">IPV4</option><option value="ipv6" disabled={!ipv6.enabled}>IPV6{ipv6.enabled?'':' · DISABLED'}</option></select></label><div className="button-row"><button type="button" onClick={()=>runProbe('ping')}>PING</button><button type="button" onClick={()=>runProbe('traceroute')}>TRACEROUTE</button><button type="button" onClick={()=>{setProbeHistory([]);setSelectedProbeId(null);setSelectedProbeAttempt(0);}}>CLEAR</button></div>{selectedProbe&&<><label>RESULT<select value={selectedProbe.id} onChange={(event)=>{setSelectedProbeId(event.currentTarget.value);setSelectedProbeAttempt(0);}}>{probeHistory.map((probe)=><option key={probe.id} value={probe.id}>{probe.sequence}. {probe.kind.toUpperCase()} · {probe.plane==='ROUTED IPV6'?'IPV6':'IPV4'} · {probe.success?'PASS':'FAIL'}{probe.natApplied?' · NAT':''}</option>)}</select></label>{selectedProbe.attempts.length>1&&<label>{selectedProbe.plane==='ROUTED IPV6'?'HOP LIMIT / ATTEMPT':'TTL / ATTEMPT'}<select value={Math.min(selectedProbeAttempt,selectedProbe.attempts.length-1)} onChange={(event)=>setSelectedProbeAttempt(Number(event.currentTarget.value))}>{selectedProbe.attempts.map((attempt,index)=><option key={`${selectedProbe.id}-${attempt.ttl}-${index}`} value={index}>TTL {attempt.ttl} · {attempt.responderNodeId?labelFor(graph,attempt.responderNodeId):'NO RESPONSE'} · {attempt.status.toUpperCase()}</option>)}</select></label>}<button type="button" disabled={!selectedAttempt?.packet||!onOpenProbePacket} onClick={()=>{if(selectedAttempt?.packet&&onOpenProbePacket)onOpenProbePacket(selectedAttempt.packet);}}>OPEN ICMP PACKET ↗</button></>}<small className="builder-routing-note">{probeFamily==='ipv6'?'IPV6 USES AN INDEPENDENT FIB · ND RESOLVES EACH NEXT HOP · ROUTERS RETURN PACKET TOO BIG INSTEAD OF FRAGMENTING · PMTU CACHE CAN REDUCE THE NEXT PROBE · OSPFV3 CONTRIBUTES O6 ROUTES ONLY WHEN ENABLED.':'PING VALIDATES REQUEST + REPLY PATHS · TRACEROUTE EXPIRES TTL AT ROUTERS · ACTIVE NAT BOUNDARIES USE THE SAME SESSION TABLE.'} RTT COMES FROM LINK LATENCY, NEVER ROUTING COST.</small></section>
          <section className="builder-ethernet-section"><div className="control-title"><span>LAN FABRIC</span><strong>802.1Q TEACHING MODEL</strong></div>{ethernet.devices.length===0?<><small className="builder-routing-note">THIS LEGACY SCENARIO HAS NO LAN FABRIC CONFIGURATION.</small><button type="button" onClick={resetEthernetDemo}>LOAD LAN DEMO</button></>:<><label>SOURCE<select value={ethernetSourceId} onChange={(event)=>setEthernetSourceId(event.currentTarget.value)}>{ethernet.devices.filter((device)=>device.kind==='endpoint').map((device)=><option key={device.id} value={device.id}>{device.label} · VLAN {device.interfaces[0]?.vlanId}</option>)}</select></label><label>DESTINATION<select value={ethernetDestinationId} onChange={(event)=>setEthernetDestinationId(event.currentTarget.value)}>{ethernet.devices.filter((device)=>device.kind==='endpoint').map((device)=><option key={device.id} value={device.id}>{device.label} · VLAN {device.interfaces[0]?.vlanId}</option>)}</select></label><div className="button-row"><button type="button" onClick={runEthernet}>SEND FRAME / PACKET</button><button type="button" onClick={resetEthernetDemo}>RESET LAN</button></div><div className="button-row"><button type="button" onClick={()=>{setEthernet({...ethernet,stp:{...ethernet.stp,enabled:!ethernet.stp.enabled}});setEthernetFlow(null);setArpResolutions([]);setMessage(`STP ${ethernet.stp.enabled?'DISABLED':'ENABLED'} · VLAN loop safety recomputed.`);}}>{ethernet.stp.enabled?'DISABLE STP':'ENABLE STP'}</button><button type="button" onClick={clearArp}>CLEAR ARP</button></div><small className="builder-routing-note">STP · VLAN {ethernetSourceVlan} · ROOT {stpState.rootBridgeLabel ?? '—'} · {stpState.blockedLinkIds.length} BLOCKED · {stpState.loopDetected?'REDUNDANCY PRESENT':'TREE ONLY'}</small><label>SELECTED PORT LINK<select value={selectedEthernetLink?.id??''} onChange={(event)=>{setSelectedEthernetLinkId(event.currentTarget.value);setEthernetFlow(null);}}>{ethernet.links.map((link)=><option key={link.id} value={link.id}>{ethernet.devices.find((device)=>device.id===link.a)?.label} ↔ {ethernet.devices.find((device)=>device.id===link.b)?.label}</option>)}</select></label>{selectedEthernetLink&&<><label>PORT MODE<select value={selectedEthernetLink.mode} onChange={(event)=>{const mode=event.currentTarget.value as 'access'|'trunk';const a=ethernet.devices.find((device)=>device.id===selectedEthernetLink.a),b=ethernet.devices.find((device)=>device.id===selectedEthernetLink.b);if(mode==='trunk'&&(a?.kind==='endpoint'||b?.kind==='endpoint')){setMessage('LAN CONFIG REJECTED · endpoints cannot be trunk ports in this teaching model.');return;}patchEthernetLink(mode==='access'?{mode,accessVlan:ethernet.vlans[0]?.id,allowedVlans:undefined}:{mode,allowedVlans:ethernet.vlans.map((vlan)=>vlan.id),accessVlan:undefined});}}><option value="access">ACCESS</option><option value="trunk">TRUNK</option></select></label>{selectedEthernetLink.mode==='access'?<label>ACCESS VLAN<select value={selectedEthernetLink.accessVlan} onChange={(event)=>patchEthernetLink({accessVlan:Number(event.currentTarget.value)})}>{ethernet.vlans.map((vlan)=><option key={vlan.id} value={vlan.id}>VLAN {vlan.id} · {vlan.name}</option>)}</select></label>:<label>ALLOWED VLANs<input key={`${selectedEthernetLink.id}-${selectedEthernetLink.allowedVlans?.join(',')}`} defaultValue={selectedEthernetLink.allowedVlans?.join(', ')??''} onBlur={(event)=>{try{patchEthernetLink({allowedVlans:parseBuilderAllowedVlans(event.currentTarget.value,ethernet)});}catch(error){setMessage(`LAN CONFIG REJECTED · ${error instanceof Error?error.message:'Invalid VLAN list.'}`);event.currentTarget.value=selectedEthernetLink.allowedVlans?.join(', ')??'';}}}/></label>}<button type="button" onClick={()=>patchEthernetLink({failed:!selectedEthernetLink.failed})}>{selectedEthernetLink.failed?'RESTORE LAN LINK':'FAIL LAN LINK'}</button></>}{ethernetFlow&&ethernetFlow.fdb.length>0&&<div className="builder-fdb"><span>DERIVED FDB</span>{ethernetFlow.fdb.map((entry)=><small key={`${entry.switchId}-${entry.vlanId}-${entry.mac}`}><b>{ethernet.devices.find((device)=>device.id===entry.switchId)?.label} · V{entry.vlanId}</b>{entry.mac} → {entry.linkId.replace('lan-','').toUpperCase()}</small>)}</div>}<small className="builder-routing-note">ACCESS = ONE VLAN · TRUNK = EXPLICIT ALLOW-LIST · SWITCH FDB IS VLAN-SCOPED · ROUTER-ON-A-STICK IS THE ONLY INTER-VLAN PATH IN THIS SLICE.</small></>}</section>
          {!stressLabel&&<BuilderNatPanel graph={graph} addressing={addressing} routing={routing} acl={acl} nat={nat} onNatChange={setNat} sessions={natSessions} onSessionsChange={setNatSessions} sourceId={sourceId} destinationId={destinationId} onMessage={setMessage}/>} 
          <section className="builder-link-section"><div className="control-title"><span>SELECTED LINK</span><strong>{selectedLink ? `${labelFor(graph,selectedLink.a)} ↔ ${labelFor(graph,selectedLink.b)}` : 'NONE'}</strong></div>{selectedLink && <><label>ROUTING COST<input type="number" min={1} max={999} value={selectedLink.cost} onChange={(e)=>updateLink(selectedLink.id,{cost:Math.max(1,Math.min(999,Math.round(Number(e.currentTarget.value)||1)))})}/></label>{selectedLinkProfile&&<div className="builder-link-profile-grid"><label>LATENCY MS<input type="number" min={0} max={5000} value={selectedLinkProfile.latencyMs} onChange={(e)=>patchSelectedLinkProfile({latencyMs:Number(e.currentTarget.value)})}/></label><label>JITTER MS<input type="number" min={0} max={2000} value={selectedLinkProfile.jitterMs} onChange={(e)=>patchSelectedLinkProfile({jitterMs:Number(e.currentTarget.value)})}/></label><label>BANDWIDTH Mb/s<input type="number" min={1} value={selectedLinkProfile.bandwidthMbps} onChange={(e)=>patchSelectedLinkProfile({bandwidthMbps:Number(e.currentTarget.value)})}/></label><label>LOSS %<input type="number" min={0} max={100} step={0.1} value={selectedLinkProfile.lossPercent} onChange={(e)=>patchSelectedLinkProfile({lossPercent:Number(e.currentTarget.value)})}/></label><label>MTU BYTES<input type="number" min={68} max={9216} value={selectedLinkProfile.mtuBytes} onChange={(e)=>patchSelectedLinkProfile({mtuBytes:Math.round(Number(e.currentTarget.value))})}/></label><label>QUEUE PKTS<input type="number" min={1} value={selectedLinkProfile.queuePackets} onChange={(e)=>patchSelectedLinkProfile({queuePackets:Math.round(Number(e.currentTarget.value))})}/></label></div>}<small className="builder-routing-note">ROUTING COST DRIVES SPF. LATENCY / JITTER / BANDWIDTH / LOSS / MTU / QUEUE DRIVE PACKET OBSERVATION.</small><div className="button-row"><button type="button" onClick={()=>updateLink(selectedLink.id,{failed:!selectedLink.failed})}>{selectedLink.failed?'RESTORE':'FAIL LINK'}</button><button type="button" onClick={()=>deleteLink(selectedLink.id)}>DELETE</button></div></>}</section>
          <section className="builder-l3-section"><div className="control-title"><span>L3 SEGMENT</span><strong>{selectedSegment?.cidr ?? 'NONE'}</strong></div>{selectedLink && selectedSegment && <><label>NETWORK CIDR<input key={`${selectedLink.id}-${selectedSegment.cidr}`} defaultValue={selectedSegment.cidr} onBlur={(event)=>{try{const next=replaceBuilderSegmentCidr(graph,addressing,selectedLink.id,event.currentTarget.value);commitAddressing(next);setMessage(`${labelFor(graph,selectedLink.a)} ↔ ${labelFor(graph,selectedLink.b)} renumbered to ${next.segments[selectedLink.id].cidr}. Weighted path cost is unchanged.`);}catch(error){setMessage(`ADDRESSING REJECTED · ${error instanceof Error?error.message:'Invalid IPv4 segment.'}`);event.currentTarget.value=selectedSegment.cidr;}}}/></label><div className="builder-interface-grid">{selectedSegment.interfaces.map((entry)=><label key={`${selectedLink.id}-${entry.nodeId}-${entry.address}`}>{labelFor(graph,entry.nodeId)} · {entry.name}<input defaultValue={entry.address} onBlur={(event)=>{try{const next=replaceBuilderInterfaceAddress(graph,addressing,selectedLink.id,entry.nodeId,event.currentTarget.value);commitAddressing(next);setMessage(`${entry.nodeId.toUpperCase()} ${entry.name} is now ${next.segments[selectedLink.id].interfaces.find((item)=>item.nodeId===entry.nodeId)?.address}. Weighted route truth is unchanged.`);}catch(error){setMessage(`ADDRESSING REJECTED · ${error instanceof Error?error.message:'Invalid interface address.'}`);event.currentTarget.value=entry.address;}}}/></label>)}</div><small className="builder-l3-note">IPV4 SEGMENT · ROUTING TABLE USES THIS PREFIX · LINK COST STAYS SEPARATE</small></>}</section>
          {!stressLabel&&<BuilderIpv6Panel graph={graph} ipv4={addressing} ipv6={ipv6} selectedNodeId={selectedNodeId} selectedLinkId={selectedLinkId} sourceId={sourceId} destinationId={destinationId} controlState={ipv6ControlState} onControlStateChange={setIpv6ControlState} lifecycleState={ipv6LifecycleState} onLifecycleStateChange={setIpv6LifecycleState} routingDepth={ipv6RoutingDepth} onRoutingDepthChange={setIpv6RoutingDepth} probePacketBytes={ipv6ProbePacketBytes} onProbePacketBytesChange={setIpv6ProbePacketBytes} onChange={setIpv6} onMessage={setMessage}/>}
          <section className="builder-device-section"><div className="control-title"><span>SELECTED DEVICE</span><strong>{selectedNode ? `${selectedNode.kind.toUpperCase()} · ${selectedNodeInterfaces.length} IF` : 'NONE'}</strong></div>{selectedNode && <><div className="builder-interface-list">{selectedNodeInterfaces.length===0?<small>NO INTERFACES · CONNECT THIS DEVICE TO A LINK</small>:selectedNodeInterfaces.map((entry)=><div key={`${entry.linkId}-${entry.name}`}><span>{entry.name}</span><strong>{entry.address}</strong><small>{entry.cidr} · {entry.linkId.toUpperCase()}</small></div>)}</div>{selectedNode.kind==='endpoint'&&<label>DEFAULT GATEWAY<input key={`${selectedNode.id}-${addressing.defaultGateways[selectedNode.id]??'none'}`} defaultValue={addressing.defaultGateways[selectedNode.id]??''} placeholder="NONE" onBlur={(event)=>{try{const next=replaceBuilderDefaultGateway(graph,addressing,selectedNode.id,event.currentTarget.value||null);commitAddressing(next);setMessage(`${selectedNode.label} default gateway ${next.defaultGateways[selectedNode.id]??'cleared'}.`);}catch(error){setMessage(`GATEWAY REJECTED · ${error instanceof Error?error.message:'Invalid default gateway.'}`);event.currentTarget.value=addressing.defaultGateways[selectedNode.id]??'';}}}/></label>}</>}</section>
          <section className="builder-ospf-section"><div className="control-title"><span>OSPF CONTROL PLANE</span><strong>{selectedNode?.kind === 'router' ? (selectedOspfEnabled ? (ospfState.abrRouterIds.includes(selectedNode.id) ? 'ABR · MULTI-AREA' : 'OSPF · ENABLED') : 'DISABLED') : 'ROUTERS ONLY'}</strong></div>{selectedNode?.kind === 'router'?<><div className="button-row"><button type="button" onClick={()=>setSelectedOspf(!selectedOspfEnabled)}>{selectedOspfEnabled?'DISABLE ON ROUTER':'ENABLE ON ROUTER'}</button><button type="button" onClick={()=>setAllOspf(true)}>ENABLE ALL</button><button type="button" onClick={()=>setAllOspf(false)}>DISABLE ALL</button></div>{selectedOspfEnabled?<><div className="builder-ospf-facts"><div><span>LSDB COMPONENT</span><strong>{selectedOspfComponent?.map((id)=>labelFor(graph,id)).join(' · ') || selectedNode.label}</strong></div><div><span>KNOWN PREFIXES</span><strong>{selectedOspfPrefixCount}</strong></div></div><div className="builder-ospf-neighbors">{selectedOspfAdjacencies.length===0?<small>NO OSPF ROUTER NEIGHBORS</small>:selectedOspfAdjacencies.map((adjacency)=>{const neighborId=adjacency.aRouterId===selectedNode.id?adjacency.bRouterId:adjacency.aRouterId;return <div key={adjacency.id} className={adjacency.state==='FULL'?'full':'down'}><span>{adjacency.state}</span><strong>{labelFor(graph,neighborId)}</strong><small>{adjacency.linkId.toUpperCase()} · AREA {adjacency.areaId} · COST {adjacency.cost} · {adjacency.reason}</small></div>;})}</div></>:<small className="builder-routing-note">This router advertises no prefixes and installs no OSPF routes until it joins Area 0.</small>}<small className="builder-routing-note">MULTI-AREA OSPF · AREA 0 BACKBONE + ABRS + O / O IA ROUTES · ECMP REMAINS PER-FLOW INSIDE EQUAL-BEST ROUTE TYPES.</small></>:<small className="builder-routing-note">Endpoints do not run OSPF. Select a router to inspect Area 0 state.</small>}</section>
          {!stressLabel&&<BuilderDhcpPanel ethernet={ethernet} config={dhcp} onConfigChange={setDhcp} leases={dhcpLeases} onLeasesChange={setDhcpLeases} sequence={dhcpSequence} onSequenceChange={setDhcpSequence} onMessage={setMessage} historical={isHistorical} historicalStage={historicalTimelineSnapshot?.category==='dhcp'?{summary:historicalTimelineSnapshot.summary,detail:historicalTimelineSnapshot.detail}:null}/>}
          <BuilderOspfAreaPanel graph={graph} addressing={addressing} routing={routing} selectedNodeId={selectedNodeId} selectedLinkId={selectedLinkId} onChange={(next, detail)=>{setRouting(next);setMessage(detail);}}/>
          <BuilderOspfEcmpPanel graph={graph} addressing={addressing} routing={routing} sourceId={sourceId} destinationId={destinationId}/>
          <BuilderOspfTimingPanel graph={graph} addressing={addressing} routing={routing} sourceId={sourceId} destinationId={destinationId}/>
          {!stressLabel&&<BuilderBgpPanel graph={graph} addressing={addressing} routing={routing} selectedNodeId={selectedNodeId} selectedLinkId={selectedLinkId} destinationPrefix={destinationPrefix} onChange={setRouting} onMessage={setMessage} onOpenAsProjection={openBgpProjection}/>}
          <section className="builder-acl-section"><div className="control-title"><span>ACL / FIREWALL POLICY</span><strong>{selectedNode?.kind==='router'?`${selectedRouterAclRules.length} RULES`:'ROUTERS ONLY'}</strong></div>{selectedNode?.kind==='router'?<><div className="builder-acl-rules">{selectedRouterAclRules.length===0?<small>NO EXPLICIT RULES · DEFAULT {acl.defaultAction.toUpperCase()}</small>:selectedRouterAclRules.map((rule)=><div key={rule.id} className={rule.action}><span>{rule.order}</span><strong>{rule.action.toUpperCase()} {rule.protocol.toUpperCase()}</strong><small>{rule.sourcePrefix} → {rule.destinationPrefix}{rule.destinationPort?` · DPORT ${rule.destinationPort}`:''} · {rule.description||rule.id}</small><button type="button" onClick={()=>{setAcl(deleteBuilderAclRule(graph,acl,rule.id));setMessage(`ACL · ${rule.id} removed.`);}}>×</button></div>)}</div><div className="builder-acl-form"><label>ORDER<input type="number" min={1} max={65535} value={aclOrder} onChange={(e)=>setAclOrder(Math.max(1,Math.min(65535,Math.round(Number(e.currentTarget.value)||1))))}/></label><label>ACTION<select value={aclAction} onChange={(e)=>setAclAction(e.currentTarget.value as BuilderAclAction)}><option value="deny">DENY</option><option value="permit">PERMIT</option></select></label><label>PROTOCOL<select value={aclProtocol} onChange={(e)=>{const value=e.currentTarget.value as BuilderAclProtocol;setAclProtocol(value);if(value!=='tcp'&&value!=='udp')setAclDestinationPort('');}}><option value="ip">IP</option><option value="icmp">ICMP</option><option value="tcp">TCP</option><option value="udp">UDP</option></select></label><label>SOURCE PREFIX<input value={aclSourcePrefix} onChange={(e)=>setAclSourcePrefix(e.currentTarget.value)}/></label><label>DEST PREFIX<input value={aclDestinationPrefix} onChange={(e)=>setAclDestinationPrefix(e.currentTarget.value)}/></label><label>DST PORT<input disabled={aclProtocol!=='tcp'&&aclProtocol!=='udp'} value={aclDestinationPort} placeholder="ANY" onChange={(e)=>setAclDestinationPort(e.currentTarget.value)}/></label><label>DESCRIPTION<input value={aclDescription} maxLength={80} onChange={(e)=>setAclDescription(e.currentTarget.value)}/></label><button type="button" onClick={addAclRule}>ADD ACL RULE</button></div><small className="builder-routing-note">FIRST MATCH WINS · NAT FLOWS EVALUATE THE BOUNDARY BEFORE AND AFTER TRANSLATION · ROUTED PING/TRACEROUTE CONSUME THE LIVE NAT SESSION TABLE AND REVERSE ICMP POLICY.</small></>:<small className="builder-routing-note">Select a router to author ordered IPv4 policy.</small>}</section>
          <section className="builder-routing-section"><div className="control-title"><span>ROUTE TABLE</span><strong>{selectedNode?.kind === 'router' ? `${selectedRouteTable.filter((entry)=>entry.active).length} ACTIVE · ${selectedRouteTable.length} TOTAL` : 'ENDPOINT DEFAULT'}</strong></div>{selectedNode?.kind === 'router'?<><div className="builder-route-table builder-ipv4-route-table">{selectedRouteTable.length===0?<small>NO ROUTES</small>:selectedRouteTable.map((entry)=><div key={entry.id} className={`${entry.active?'':'inactive'} source-${entry.source}`}><span>{entry.source==='connected'?'C':entry.source==='static'?'S':entry.source==='bgp'?(entry.bgpLearnedVia==='ebgp'?'B':'B i'):entry.ospfRouteType==='inter-area'?'O IA':'O'}</span><strong>{entry.prefix}</strong><small>{entry.source==='connected'?'DIRECT':`via ${entry.nextHop}`} · {entry.outgoingInterface} · AD {entry.administrativeDistance} · M {entry.metric} · {entry.stateNote}</small>{entry.source==='static'&&<button type="button" aria-label={`Delete route ${entry.prefix} via ${entry.nextHop}`} onClick={()=>{setRouting(deleteBuilderStaticRoute(graph,addressing,routing,entry.id));setMessage(`${selectedNode.label} static route ${entry.prefix} removed.`);}}>×</button>}</div>)}</div><div className="builder-static-form"><label>DESTINATION PREFIX<input value={staticPrefix} onChange={(event)=>setStaticPrefix(event.currentTarget.value)}/></label><button type="button" onClick={()=>setStaticPrefix(destinationPrefix)}>USE DEST PREFIX</button><label>NEXT HOP<select value={effectiveStaticNextHop} onChange={(event)=>setStaticNextHop(event.currentTarget.value)}>{selectedNextHopOptions.length===0?<option value="">NO NEIGHBORS</option>:selectedNextHopOptions.map((option)=><option key={`${option.linkId}-${option.address}`} value={option.address}>{option.nodeLabel} · {option.address}{option.linkFailed?' · DOWN':''}</option>)}</select></label><label>METRIC<input type="number" min={1} max={999} value={staticMetric} onChange={(event)=>setStaticMetric(Math.max(1,Math.min(999,Math.round(Number(event.currentTarget.value)||1))))}/></label><button type="button" onClick={addStaticRoute} disabled={!effectiveStaticNextHop}>ADD / REPLACE STATIC</button></div><small className="builder-routing-note">LOOKUP: LONGEST PREFIX → AD → OSPF ROUTE TYPE (O BEFORE O IA) → METRIC → ECMP FLOW HASH. CONNECTED AD 0 · STATIC AD 1 · eBGP AD 20 · OSPF AD 110 · iBGP AD 200.</small></>:<small className="builder-routing-note">Endpoints forward directly on-link or send off-link traffic to their configured default gateway. Select a router to inspect connected, static, OSPF, and BGP routes.</small>}</section>
          <section><div className="control-title"><span>AUTHOR</span><strong>TOPOLOGY</strong></div><div className="button-row"><button type="button" onClick={()=>addNode('router')}>+ ROUTER</button><button type="button" onClick={()=>addNode('endpoint')}>+ ENDPOINT</button></div><div className="link-form"><select value={newLinkA} onChange={(e)=>setNewLinkA(e.currentTarget.value)}>{graph.nodes.map((node)=><option key={node.id} value={node.id}>{node.label}</option>)}</select><span>↔</span><select value={newLinkB} onChange={(e)=>setNewLinkB(e.currentTarget.value)}>{graph.nodes.map((node)=><option key={node.id} value={node.id}>{node.label}</option>)}</select><input aria-label="New link cost" type="number" min={1} max={999} value={newLinkCost} onChange={(e)=>setNewLinkCost(Math.max(1,Math.min(999,Math.round(Number(e.currentTarget.value)||1))))}/><button type="button" onClick={addLink}>ADD LINK</button></div></section>
          <section><div className="control-title"><span>SCENARIOS</span><strong>SCHEMA V9 · DUAL STACK + LAN + POLICY</strong></div><label>NAME<input value={scenarioName} maxLength={80} onChange={(e)=>setScenarioName(e.currentTarget.value)}/></label><div className="button-row"><button type="button" onClick={saveScenario}>SAVE</button><button type="button" onClick={exportScenario}>EXPORT JSON</button><label className="file-button">IMPORT<input type="file" accept="application/json,.json" onChange={(e)=>void importScenario(e.currentTarget.files?.[0])}/></label></div><div className="saved-list">{saved.length===0?<small>NO SAVED SCENARIOS</small>:saved.map((scenario)=><div key={scenario.name}><button type="button" onClick={()=>restoreScenario(scenario)}><strong>{scenario.name}</strong><small>{scenario.graph.nodes.length}N · {scenario.graph.links.length}L</small></button><button type="button" aria-label={`Delete ${scenario.name}`} onClick={()=>setSaved(deleteStoredBuilderScenario(scenario.name))}>×</button></div>)}</div></section>
          <section className="reset-section"><div className="button-row"><button type="button" onClick={resetTopology}>RESET TOPOLOGY</button><button type="button" onClick={resetLayout}>RESET LAYOUT</button></div></section>
          </fieldset>
        </aside>
      </div>
    </motion.section>
  );
  return renderWorkspace(sceneRenderState);
}
