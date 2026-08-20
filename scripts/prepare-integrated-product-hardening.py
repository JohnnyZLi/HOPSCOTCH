from pathlib import Path

path = Path('src/App.tsx')
text = path.read_text()

for destination, layer in [('builder', 'routing'), ('internet', 'internet')]:
    old = f"setPlaying(false); setLayer('{layer}'); setActiveLab('{destination}');"
    new = f"setPlaying(false); setLayer(workspaceDefinition('{destination}').layer); setActiveLab('{destination}');"
    if text.count(old) == 2:
        text = text.replace(old, new, 1)

path.write_text(text)

# Track L expanded the README boundary sentence after this helper was drafted.
# Keep the strict anchor check, but point it at the current authoritative sentence.
helper_path = Path('scripts/apply-integrated-product-hardening.py')
helper = helper_path.read_text()
old_anchor = "The Builder does not maintain separate hidden simulators for application traffic, overlays, troubleshooting, or presentation. Those surfaces consume the same canonical state.\\n"
new_anchor = "The Builder does not maintain separate hidden simulators for application traffic, overlays, troubleshooting, CLI, explanation, or presentation. Those surfaces consume the same canonical state and existing protocol/data-plane engines.\\n"
if old_anchor in helper:
    helper_path.write_text(helper.replace(old_anchor, new_anchor, 1))
