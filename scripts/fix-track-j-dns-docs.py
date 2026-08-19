from pathlib import Path

path = Path('docs/TRACKJ.md')
text = path.read_text()
text = text.replace(
    "- DNS failures,\n- transport failures,\n- BGP policy failures,",
    "- deeper DNS behavior beyond the shipped deterministic missing-name family,\n- deeper transport behavior beyond the shipped disabled-listener family,\n- BGP policy failures,",
)
text = text.replace(
    "The actual repair controls remain available: endpoint gateway, access VLAN, trunk allow-list, STP toggle, routed configuration, and normal diagnostic surfaces.",
    "The actual repair controls remain available: endpoint gateway, access VLAN, trunk allow-list, STP toggle, routed configuration, hosted-service hostname/listener configuration, and normal diagnostic surfaces.",
)
text = text.replace(
    "- healthy ordinary routed/LAN workflows succeed,\n- each broken family fails through the ordinary canonical diagnostic path,",
    "- healthy ordinary routed/LAN/application workflows succeed,\n- each broken family fails through the ordinary canonical diagnostic path, including exact DNS vs transport first-broken boundaries,",
)
path.write_text(text)
print('Updated Track J remaining-work and contract documentation for shipped DNS/transport families.')
