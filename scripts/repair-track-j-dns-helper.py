from pathlib import Path

path = Path('scripts/apply-track-j-dns-transport.py')
text = path.read_text()
text = text.replace("if(node.kind==='router'){\n\"", "if(node.kind==='router'){\\n\"")
path.write_text(text)
print('Repaired embedded Workbench newline quoting in Track J helper.')
