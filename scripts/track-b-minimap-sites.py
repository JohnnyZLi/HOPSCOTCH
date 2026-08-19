from pathlib import Path

# Keep presentation-only site bounds in the lazy authoring minimap rather than the always-loaded main canvas.
p = Path('src/NetworkBuilder.tsx')
s = p.read_text()
old = "  const displayedAuthoringSnapshot:BuilderAuthoringSnapshot={graph:sceneGraph,addressing:sceneAddressing,routing:sceneRouting,ethernet:sceneEthernet,linkProfiles:sceneLinkProfiles,acl:sceneAcl,nat:sceneNat,dhcp:sceneDhcp,ipv6:sceneIpv6,sourceId:sceneSourceId,destinationId:sceneDestinationId,layout:sceneLayout};\n"
if old not in s:
    raise SystemExit('displayedAuthoringSnapshot marker missing')
s = s.replace(old, '', 1)
old = "            {authoringView.sites.map((site)=>{const points=site.nodeIds.flatMap((id)=>layout[id]?[layout[id]]:[]);if(points.length===0)return null;const left=Math.max(0,Math.min(...points.map((point)=>point.x))-6),top=Math.max(0,Math.min(...points.map((point)=>point.y))-6),right=Math.min(100,Math.max(...points.map((point)=>point.x))+6),bottom=Math.min(100,Math.max(...points.map((point)=>point.y))+6);return <div key={site.id} className={`builder-site-bound ${site.collapsed?'collapsed':''}`} style={{left:`${left}%`,top:`${top}%`,width:`${Math.max(4,right-left)}%`,height:`${Math.max(4,bottom-top)}%`}}><span>{site.label} · {site.nodeIds.length}</span></div>;})}\n"
if old not in s:
    raise SystemExit('main-canvas site bounds marker missing')
s = s.replace(old, '', 1)
s = s.replace('snapshot={displayedAuthoringSnapshot}', 'snapshot={sceneState}', 1)
p.write_text(s)

p = Path('src/BuilderAuthoringPanelContent.tsx')
s = p.read_text()
old = '''        <svg className="builder-authoring-minimap" viewBox="0 0 100 100" role="img" aria-label="Topology minimap">{snapshot.graph.links.map((link) => { const a=snapshot.layout[link.a], b=snapshot.layout[link.b]; return a&&b?<line key={link.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y}/>:null; })}{snapshot.graph.nodes.map((node) => { const point=snapshot.layout[node.id]; return point?<circle key={node.id} cx={point.x} cy={point.y} r={view.selection.includes(node.id)?2.5:1.5} onClick={() => { onFocusDevice(node.id); setView({ selection:[node.id], camera:{x:point.x,y:point.y,scale:1.7} }); }}/>:null; })}</svg>'''
new = '''        <svg className="builder-authoring-minimap" viewBox="0 0 100 100" role="img" aria-label="Topology minimap">{siteBounds.map((site)=><rect key={site.id} className={site.collapsed?'collapsed':''} x={site.left} y={site.top} width={site.width} height={site.height}><title>{site.label} · {site.nodeCount} devices</title></rect>)}{snapshot.graph.links.map((link) => { const a=snapshot.layout[link.a], b=snapshot.layout[link.b]; return a&&b?<line key={link.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y}/>:null; })}{snapshot.graph.nodes.map((node) => { const point=snapshot.layout[node.id]; return point?<circle key={node.id} cx={point.x} cy={point.y} r={view.selection.includes(node.id)?2.5:1.5} onClick={() => { onFocusDevice(node.id); setView({ selection:[node.id], camera:{x:point.x,y:point.y,scale:1.7} }); }}/>:null; })}</svg>'''
if old not in s:
    raise SystemExit('minimap marker missing')
s = s.replace(old, new, 1)
s = s.replace(' SITE BOUND{siteBounds.length===1?\'\':\'S\'} PROJECTED ON CANVAS · COLLAPSE CHANGES AUTHORING DETAIL ONLY, NEVER NETWORK STATE.', ' SITE GROUP{siteBounds.length===1?\'\':\'S\'} PROJECTED IN THE MINIMAP · COLLAPSE CHANGES AUTHORING DETAIL ONLY, NEVER NETWORK STATE.', 1)
p.write_text(s)

p = Path('src/BuilderAuthoringPanel.css')
s = p.read_text()
s = s.replace('.builder-authoring-minimap line{stroke:rgba(16,16,16,.24);stroke-width:.7}.builder-authoring-minimap circle{fill:currentColor;cursor:pointer}', '.builder-authoring-minimap rect{fill:rgba(160,87,59,.045);stroke:rgba(133,71,48,.38);stroke-width:.7;stroke-dasharray:2 1}.builder-authoring-minimap rect.collapsed{fill:rgba(160,87,59,.1);stroke-dasharray:none}.builder-authoring-minimap line{stroke:rgba(16,16,16,.24);stroke-width:.7}.builder-authoring-minimap circle{fill:currentColor;cursor:pointer}', 1)
start = s.find('.builder-site-bound{')
if start != -1:
    end = s.find('.builder-node.is-multi-selected', start)
    if end == -1:
        raise SystemExit('builder-site-bound CSS end marker missing')
    s = s[:start] + s[end:]
p.write_text(s)

p = Path('scripts/builder-authoring-contract-check.mjs')
s = p.read_text()
needle = "assert.match(networkBuilderSource, /builder-marquee/, 'Builder canvas must expose marquee selection');\n"
replacement = needle + "assert.doesNotMatch(networkBuilderSource, /builder-site-bound/, 'presentation-only site bounds belong in the lazy authoring minimap, not the always-loaded main canvas');\nassert.match(panelContentSource, /siteBounds\.map\(/, 'lazy authoring minimap must project site grouping bounds');\n"
if needle not in s:
    raise SystemExit('contract marquee marker missing')
s = s.replace(needle, replacement, 1)
p.write_text(s)

p = Path('docs/TRACKB.md')
s = p.read_text().replace('They provide named canvas bounds and collapsible group detail in the authoring workspace.', 'They provide named grouping bounds in the lazy authoring minimap plus collapsible group detail in the authoring workspace.')
p.write_text(s)

p = Path('docs/ROADMAP.md')
s = p.read_text().replace('named presentation-only sites plus reusable browser-local routed topology templates', 'named presentation-only minimap sites plus reusable browser-local routed topology templates')
p.write_text(s)
