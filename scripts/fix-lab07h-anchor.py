from pathlib import Path

path = Path('scripts/apply-lab07h.py')
text = path.read_text()
old = "      case 'journey.complete': journeyComplete = true; break;"
new = "      case 'journey.complete': responseReady = true; journeyComplete = true; break;"
if old not in text:
    raise SystemExit('Lab 07H journey.complete patch anchor not found.')
path.write_text(text.replace(old, new, 1))
