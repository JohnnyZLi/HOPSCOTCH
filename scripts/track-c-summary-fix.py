from pathlib import Path
p=Path('src/builder/ethernet.ts')
text=p.read_text()
old="    summary:`${router.label} routes VLAN ${sourceVlan} → VLAN ${destinationVlan} using connected router-on-a-stick subinterfaces; IP TTL decreases once at the router.` };"
new="    summary:`${router.label} routes VLAN ${sourceVlan} → VLAN ${destinationVlan} inside VRF ${sourceIf.vrfId ?? 'default'} using canonical SVI/subinterface truth; IP TTL decreases once at the routed hop.` };"
if old not in text: raise SystemExit('forwarding summary anchor missing')
p.write_text(text.replace(old,new,1))
