from pathlib import Path

p = Path('src/NetworkBuilder.tsx')
s = p.read_text()
old = "const focusAuthoringDevice=(deviceId:string)=>{if(!graph.nodes.some((node)=>node.id===deviceId))return;setSelectedNodeId(deviceId);setWorkbenchDevice({plane:'routed',id:deviceId});};"
new = "const focusAuthoringDevice=(deviceId:string)=>{setSelectedNodeId(deviceId);setWorkbenchDevice({plane:'routed',id:deviceId});};"
if old not in s:
    raise SystemExit('focusAuthoringDevice guard marker missing')
p.write_text(s.replace(old, new, 1))
