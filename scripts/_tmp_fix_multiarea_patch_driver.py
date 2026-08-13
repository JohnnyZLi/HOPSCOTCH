from pathlib import Path
p=Path('scripts/_tmp_apply_lab11m_multiarea.py')
text=p.read_text(encoding='utf-8')
line='regex_once(routing,r"interface OspfRouterFirstHop \\{[\\s\\S]*?\\n}\\n\\nfunction remoteInterfaceForNextHop", "function remoteInterfaceForNextHop")\n'
if line not in text:
    raise SystemExit('broad OSPF helper removal line not found')
p.write_text(text.replace(line,'',1),encoding='utf-8')
print('Multi-area patch driver fixed: retain shared routing helpers and legacy single-area SPF helpers.')
