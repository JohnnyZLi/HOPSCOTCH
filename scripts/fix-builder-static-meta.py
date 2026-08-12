from pathlib import Path

path = Path('scripts/apply-builder-static-routing.py')
text = path.read_text()
old = "{graph.nodes.length}N · {graph.links.length}L"
new = "{graph.nodes.length} NODES · {graph.links.length} LINKS"
if text.count(old) != 1:
    raise SystemExit(f'expected exactly one compact graph label, found {text.count(old)}')
path.write_text(text.replace(old, new, 1))
print('Restored stable Builder NODES · LINKS graph label in the 11B integration helper.')
