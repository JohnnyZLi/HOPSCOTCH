from pathlib import Path

path = Path('src/App.tsx')
text = path.read_text()

for destination, layer in [('builder', 'routing'), ('internet', 'internet')]:
    old = f"setPlaying(false); setLayer('{layer}'); setActiveLab('{destination}');"
    new = f"setPlaying(false); setLayer(workspaceDefinition('{destination}').layer); setActiveLab('{destination}');"
    if text.count(old) == 2:
        text = text.replace(old, new, 1)

path.write_text(text)
