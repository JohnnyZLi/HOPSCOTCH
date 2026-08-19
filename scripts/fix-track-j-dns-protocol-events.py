from pathlib import Path
p=Path('src/builder/application.ts')
t=p.read_text()
before="const protocolEvents = service.enabled ? journeyProtocolEvents(service) : [];"
after="const protocolEvents = service.enabled && Boolean(service.hostname || service.kind === 'dns') ? journeyProtocolEvents(service) : [];"
if before in t:
    t=t.replace(before,after,1)
elif after not in t:
    raise RuntimeError('protocol event anchor missing')
p.write_text(t)
print('Hardened protocol event projection for unresolved/closed services.')
