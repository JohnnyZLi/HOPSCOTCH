from pathlib import Path

path=Path('src/NetworkBuilder.tsx')
text=path.read_text()
text=text.replace("const session=next.routing.bgp.sessions.find((entry)=>entry.id===next.fault.sessionId);", "const sessionId=next.fault.sessionId;const session=next.broken.routing.bgp.sessions.find((entry)=>entry.id===sessionId);")
text=text.replace("const session=challenge.broken.routing.bgp.sessions.find((entry)=>entry.id===challenge.fault.sessionId);", "const sessionId=challenge.fault.sessionId;const session=challenge.broken.routing.bgp.sessions.find((entry)=>entry.id===sessionId);")
path.write_text(text)
print('Fixed Track J BGP challenge focus narrowing.')
