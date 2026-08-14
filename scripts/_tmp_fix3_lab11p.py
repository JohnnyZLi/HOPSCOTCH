from pathlib import Path
p=Path('src/builder/device-workbench.ts')
s=p.read_text()
old="""export function classifyBuilderWorkbenchMessage(message:string):BuilderWorkbenchEventCategory{\n  const text=message.toUpperCase();\n  if(/DHCP/.test(text))return'dhcp';\n  if(/NAT|PAT|TRANSLAT/.test(text))return'nat';\n"""
new="""export function classifyBuilderWorkbenchMessage(message:string):BuilderWorkbenchEventCategory{\n  const text=message.toUpperCase();\n  if(/^(PING|TRACEROUTE|PROBE)\\b/.test(text))return'probe';\n  if(/DHCP/.test(text))return'dhcp';\n  if(/NAT|PAT|TRANSLAT/.test(text))return'nat';\n"""
if s.count(old)!=1: raise SystemExit(f'classification anchor expected once, found {s.count(old)}')
s=s.replace(old,new,1)
p.write_text(s)
print('Prioritized explicit Ping/Traceroute/Probe journal events over secondary policy/NAT wording.')
