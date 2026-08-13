from pathlib import Path
p=Path('scripts/_tmp_patch_ipv6_network.py')
s=p.read_text(encoding='utf-8')
short='rep("setNatSessions(clearBuilderNatSessions()); setArpCache(clearBuilderArpCache()); setArpResolutions([]);","setNatSessions(clearBuilderNatSessions()); setIpv6ControlState(createBuilderIpv6ControlState()); setArpCache(clearBuilderArpCache()); setArpResolutions([]);")\n'
long='rep("setNatSessions(clearBuilderNatSessions()); setArpCache(clearBuilderArpCache()); setArpResolutions([]); setEthernetFlow(null);","setNatSessions(clearBuilderNatSessions()); setIpv6ControlState(createBuilderIpv6ControlState()); setArpCache(clearBuilderArpCache()); setArpResolutions([]); setEthernetFlow(null);")\n'
if s.count(short)!=1 or s.count(long)!=1: raise SystemExit('network replacement anchors changed')
s=s.replace(short+long,long+short,1)
p.write_text(s,encoding='utf-8')
print('Fixed NetworkBuilder patch replacement order.')