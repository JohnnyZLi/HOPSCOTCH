from pathlib import Path
p=Path('scripts/_tmp_apply_lab11n_browser.py')
text=p.read_text(encoding='utf-8')
needle='replace_once(network,"  const ipv6ForwardingLinks = new Set(ipv6ForwardingTrace.hops.flatMap((hop) => hop.linkId ? [hop.linkId] : []));\\n", "")\n'
insert=needle+'replace_once(network,\'<div className="builder-route-table">{selectedRouteTable.length===0?\', \'<div className="builder-route-table builder-ipv4-route-table">{selectedRouteTable.length===0?\')\n'
if needle not in text:
    raise SystemExit('NetworkBuilder cleanup anchor not found in browser patch driver')
text=text.replace(needle,insert,1)
needle2="perf='scripts/performance-profile.mjs'\n"
insert2=needle2+'replace_once(perf,"routeTable:document.querySelector(\'.builder-route-table\')?.innerText??\'\',","routeTable:document.querySelector(\'.builder-ipv4-route-table\')?.innerText??\'\',")\nreplace_once(perf,"ospfRoutes:document.querySelectorAll(\'.builder-route-table .source-ospf\').length,","ospfRoutes:document.querySelectorAll(\'.builder-ipv4-route-table .source-ospf\').length,")\n'
if needle2 not in text:
    raise SystemExit('Performance patch anchor not found in browser patch driver')
text=text.replace(needle2,insert2,1)
p.write_text(text,encoding='utf-8')
print('Browser patch driver fixed: IPv4 route-table browser selectors are isolated from new IPv6 route table.')
