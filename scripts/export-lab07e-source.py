from pathlib import Path
import shutil

paths = [
    'src/journey/model.ts',
    'src/journey/modifiers.ts',
    'src/journey/scenario.ts',
    'src/journey/browser.ts',
    'src/JourneyTheaterV2.tsx',
    'src/journey-god-mode.css',
    'src/JourneyCongestionPanel.tsx',
    'scripts/journey-congestion-contract-check.mjs',
]
root = Path('dist/__lab07e-source')
for raw in paths:
    source = Path(raw)
    target = root / raw
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, target)
