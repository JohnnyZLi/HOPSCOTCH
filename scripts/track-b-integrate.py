from pathlib import Path
import json

p = Path('src/NetworkBuilder.tsx')
s = p.read_text()
if "import { BuilderAuthoringPanel } from './BuilderAuthoringPanel.tsx';" in s:
    raise SystemExit(0)

s = s.replace(
    "import { useEffect, useMemo, useRef, useState } from 'react';",
    "import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';",
    1,
)
s = s.replace(
    "import { BuilderApplicationPanel } from './BuilderApplicationPanel.tsx';\n",
    "import { BuilderApplicationPanel } from './BuilderApplicationPanel.tsx';\nimport { BuilderAuthoringPanel } from './BuilderAuthoringPanel.tsx';\nimport type { BuilderAuthoringSession, BuilderAuthoringSnapshot } from './builder/authoring.ts';\n",
    1,
)

marker = "function chooseValidNode(graph: BuilderGraph, preferred: string, avoid?: string): string {\n  if (graph.nodes.some((node) => node.id === preferred) && preferred !== avoid) return preferred;\n  return graph.nodes.find((node) => node.id !== avoid)?.id ?? '';\n}\n"
helper = marker + "\nfunction BuilderCanvasViewport({ enabled, style, children }: { enabled: boolean; style: CSSProperties; children: ReactNode }) {\n  return enabled ? <div className=\"builder-canvas-viewport\" style={style}>{children}</div> : <>{children}</>;\n}\n"
if marker not in s:
    raise SystemExit('chooseValidNode marker missing')
s = s.replace(marker, helper, 1)

marker = "  const [applicationHistory, setApplicationHistory] = useState<BuilderApplicationTransaction[]>([]);\n"
insert = marker + "  const [authoringView, setAuthoringView] = useState<BuilderAuthoringSession>(() => ({ selection:[initialSourceId], ethernetLinkSelection:[], clipboard:null, sites:[], annotations:{}, showInterfaces:false, camera:{x:50,y:50,scale:1}, branches:[], baseline:null }));\n  const [authoringMarquee, setAuthoringMarquee] = useState<{startX:number;startY:number;endX:number;endY:number;additive:boolean}|null>(null);\n"
if marker not in s:
    raise SystemExit('authoring state marker missing')
s = s.replace(marker, insert, 1)

marker = "  const sceneRenderState = { ...sceneState, selectedNodeId: sceneSelectedNodeId, selectedLinkId: sceneSelectedLinkId, ethernetSourceId: sceneEthernetSourceId, ethernetDestinationId: sceneEthernetDestinationId, selectedEthernetLinkId: sceneSelectedEthernetLinkId };\n"
insert = marker + "  const displayedAuthoringSnapshot:BuilderAuthoringSnapshot={graph:sceneGraph,addressing:sceneAddressing,routing:sceneRouting,ethernet:sceneEthernet,linkProfiles:sceneLinkProfiles,acl:sceneAcl,nat:sceneNat,dhcp:sceneDhcp,ipv6:sceneIpv6,sourceId:sceneSourceId,destinationId:sceneDestinationId,layout:sceneLayout};\n"
if marker not in s:
    raise SystemExit('scene authoring marker missing')
s = s.replace(marker, insert, 1)

marker = "  const commitAddressing = (next: BuilderAddressing) => {\n    setAddressing(next);\n    setRouting(reconcileBuilderRoutingConfig(graph, next, routing));\n    setIpv6(reconcileBuilderIpv6Config(graph,next,ipv6));\n    setNatSessions(clearBuilderNatSessions());\n  };\n"
insert = marker + """

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
"""
if marker not in s:
    raise SystemExit('commitAddressing marker missing')
s = s.replace(marker, insert, 1)

marker = "  const onNodeDragEnd = (nodeId: string, offsetX: number, offsetY: number) => {\n"
helper = "  const authoringCanvasPoint=(clientX:number,clientY:number)=>{const canvas=canvasRef.current;if(!canvas)return null;const rect=canvas.getBoundingClientRect();const screenX=((clientX-rect.left)/Math.max(1,rect.width))*100;const screenY=((clientY-rect.top)/Math.max(1,rect.height))*100;const scale=authoringView.camera.scale;const tx=50-authoringView.camera.x*scale;const ty=50-authoringView.camera.y*scale;return{x:(screenX-tx)/scale,y:(screenY-ty)/scale};};\n\n"
if marker not in s:
    raise SystemExit('drag marker missing')
s = s.replace(marker, helper + marker, 1)
s = s.replace(
    "current.x + (offsetX / Math.max(rect.width, 1)) * 100",
    "current.x + (offsetX / Math.max(rect.width * authoringView.camera.scale, 1)) * 100",
    1,
)
s = s.replace(
    "current.y + (offsetY / Math.max(rect.height, 1)) * 100",
    "current.y + (offsetY / Math.max(rect.height * authoringView.camera.scale, 1)) * 100",
    1,
)

old = '''          <div ref={canvasRef} className="builder-canvas">\n            <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Weighted routed topology">'''
new = '''          <div ref={canvasRef} className={`builder-canvas ${authoringView.camera.scale!==1?'is-authoring-zoomed':''}`} onPointerDown={(event)=>{if(isHistorical||stressLabel)return;const target=event.target;if(target instanceof Element&&target.closest('.builder-node,.builder-link'))return;const point=authoringCanvasPoint(event.clientX,event.clientY);if(!point)return;setAuthoringMarquee({startX:point.x,startY:point.y,endX:point.x,endY:point.y,additive:event.shiftKey||event.metaKey||event.ctrlKey});event.currentTarget.setPointerCapture(event.pointerId);}} onPointerMove={(event)=>{if(!authoringMarquee)return;const point=authoringCanvasPoint(event.clientX,event.clientY);if(point)setAuthoringMarquee((current)=>current?{...current,endX:point.x,endY:point.y}:current);}} onPointerUp={()=>{if(!authoringMarquee)return;const minX=Math.min(authoringMarquee.startX,authoringMarquee.endX),maxX=Math.max(authoringMarquee.startX,authoringMarquee.endX),minY=Math.min(authoringMarquee.startY,authoringMarquee.endY),maxY=Math.max(authoringMarquee.startY,authoringMarquee.endY);const picked=graph.nodes.filter((node)=>{const point=layout[node.id];return Boolean(point&&point.x>=minX&&point.x<=maxX&&point.y>=minY&&point.y<=maxY);}).map((node)=>node.id);setAuthoringView((current)=>({...current,selection:authoringMarquee.additive?[...new Set([...current.selection,...picked])]:picked}));setAuthoringMarquee(null);}} onPointerCancel={()=>setAuthoringMarquee(null)}>
            <BuilderCanvasViewport enabled={!stressLabel} style={{transform:`translate(${50-authoringView.camera.x*authoringView.camera.scale}%, ${50-authoringView.camera.y*authoringView.camera.scale}%) scale(${authoringView.camera.scale})`}}>
            {authoringView.sites.map((site)=>{const points=site.nodeIds.flatMap((id)=>layout[id]?[layout[id]]:[]);if(points.length===0)return null;const left=Math.max(0,Math.min(...points.map((point)=>point.x))-6),top=Math.max(0,Math.min(...points.map((point)=>point.y))-6),right=Math.min(100,Math.max(...points.map((point)=>point.x))+6),bottom=Math.min(100,Math.max(...points.map((point)=>point.y))+6);return <div key={site.id} className={`builder-site-bound ${site.collapsed?'collapsed':''}`} style={{left:`${left}%`,top:`${top}%`,width:`${Math.max(4,right-left)}%`,height:`${Math.max(4,bottom-top)}%`}}><span>{site.label} · {site.nodeIds.length}</span></div>;})}
            {authoringMarquee&&<div className="builder-marquee" style={{left:`${Math.min(authoringMarquee.startX,authoringMarquee.endX)}%`,top:`${Math.min(authoringMarquee.startY,authoringMarquee.endY)}%`,width:`${Math.abs(authoringMarquee.endX-authoringMarquee.startX)}%`,height:`${Math.abs(authoringMarquee.endY-authoringMarquee.startY)}%`}}/>}
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Weighted routed topology">'''
if old not in s:
    raise SystemExit('canvas open marker missing')
s = s.replace(old, new, 1)

old = """                <motion.div className={`builder-node ${node.kind} ${onRoute ? 'on-route' : ''} ${selectedNode?.id === node.id ? 'selected' : ''}`} drag={!isHistorical} dragMomentum={false} dragElastic={0} onPointerDown={() => { setSelectedNodeId(node.id); setWorkbenchDevice({ plane: 'routed', id: node.id }); }} onDragEnd={(_, info) => { if (!isHistorical) onNodeDragEnd(node.id, info.offset.x, info.offset.y); }} whileDrag={reduceMotion ? undefined : { scale: 1.08, zIndex: 8 }}>
                  <span>{node.kind === 'router' ? 'RTR' : 'END'}</span><strong>{node.label}</strong>{!node.builtin && <button type=\"button\" disabled={isHistorical} onPointerDown={(event) => event.stopPropagation()} onClick={() => deleteNode(node.id)} aria-label={`Delete ${node.label}`}>×</button>}
                </motion.div>"""
new = """                <motion.div className={`builder-node ${node.kind} ${onRoute ? 'on-route' : ''} ${selectedNode?.id === node.id ? 'selected' : ''} ${authoringView.selection.includes(node.id)?'is-multi-selected':''}`} drag={!isHistorical} dragMomentum={false} dragElastic={0} onPointerDown={(event) => { event.stopPropagation(); const additive=event.shiftKey||event.metaKey||event.ctrlKey; setAuthoringView((current)=>({...current,selection:additive?(current.selection.includes(node.id)?current.selection.filter((id)=>id!==node.id):[...current.selection,node.id]):[node.id]})); setSelectedNodeId(node.id); setWorkbenchDevice({ plane: 'routed', id: node.id }); }} onDragEnd={(_, info) => { if (!isHistorical) onNodeDragEnd(node.id, info.offset.x, info.offset.y); }} whileDrag={reduceMotion ? undefined : { scale: 1.08, zIndex: 8 }}>
                  <span>{node.kind === 'router' ? 'RTR' : 'END'}</span><strong>{node.label}</strong>{authoringView.showInterfaces&&<small className=\"builder-node-interface-names\">{interfacesForBuilderNode(addressing,node.id).map((entry)=>entry.name).join(' · ')||'NO ROUTED INTERFACES'}</small>}{authoringView.annotations[node.id]&&<small className=\"builder-node-annotation\">{authoringView.annotations[node.id]}</small>}{!node.builtin && <button type=\"button\" disabled={isHistorical} onPointerDown={(event) => event.stopPropagation()} onClick={() => deleteNode(node.id)} aria-label={`Delete ${node.label}`}>×</button>}
                </motion.div>"""
if old not in s:
    raise SystemExit('node markup marker missing')
s = s.replace(old, new, 1)

old = '''            })}\n          </div>\n          <div className={`builder-route'''
new = '''            })}
            </BuilderCanvasViewport>
          </div>
          <div className={`builder-route'''
if old not in s:
    raise SystemExit('canvas close marker missing')
s = s.replace(old, new, 1)

marker = "          {!stressLabel&&workbenchSnapshot&&<BuilderDeviceWorkbench snapshot={workbenchSnapshot} options={workbenchOptions} historicalSequence={historicalTimelineSnapshot?.sequence??null} diff={workbenchTimelineDiff} onSelect={(ref)=>{setWorkbenchDevice(ref);if(ref.plane==='routed')setSelectedNodeId(ref.id);}}/>}\n"
panel = marker + "          {!stressLabel&&<BuilderAuthoringPanel snapshot={displayedAuthoringSnapshot} view={authoringView} historical={isHistorical} onViewChange={setAuthoringView} onApplySnapshot={applyAuthoringSnapshot} onCommitGraph={commitAuthoringGraph} onCommitAddressing={commitAuthoringAddressing} onCommitEthernet={commitAuthoringEthernet} onSetLayout={setAuthoringLayout} onFocusDevice={focusAuthoringDevice} onMessage={setMessage}/>}\n"
if marker not in s:
    raise SystemExit('workbench insertion marker missing')
s = s.replace(marker, panel, 1)
p.write_text(s)

p = Path('src/BuilderAuthoringPanelContent.tsx')
s = p.read_text()
s = s.replace(
    "  useEffect(() => {\n    setHistory((current) => recordBuilderAuthoringSnapshot(current, snapshot));\n    if (!view.baseline) onViewChange({ ...view, baseline: createBuilderAuthoringSnapshot(snapshot) });\n  }, [snapshotKey]);",
    "  useEffect(() => {\n    if (historical) return;\n    setHistory((current) => recordBuilderAuthoringSnapshot(current, snapshot));\n    if (!view.baseline) onViewChange({ ...view, baseline: createBuilderAuthoringSnapshot(snapshot) });\n  }, [snapshotKey, historical]);",
)
p.write_text(s)

p = Path('package.json')
data = json.loads(p.read_text())
data['scripts']['test:builder-authoring-contract'] = 'node scripts/builder-authoring-contract-check.mjs'
needle = 'npm run test:builder-scenario-compare-contract &&'
if 'npm run test:builder-authoring-contract' not in data['scripts']['check']:
    data['scripts']['check'] = data['scripts']['check'].replace(needle, needle + ' npm run test:builder-authoring-contract &&', 1)
p.write_text(json.dumps(data, indent=2) + '\n')
