from pathlib import Path

path = Path('src/App.tsx')
text = path.read_text()
old = "setPlaying(false); setLayer('routing'); setActiveLab('builder');"
new = "setPlaying(false); setLayer(workspaceDefinition('builder').layer); setActiveLab('builder');"
if text.count(old) == 2:
    path.write_text(text.replace(old, new, 1))
