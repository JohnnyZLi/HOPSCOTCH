from pathlib import Path
p=Path('scripts/builder-addressing-contract-check.mjs')
text=p.read_text(encoding='utf-8')
old="assert.equal(scenario.version, 8);"
if old not in text:
    raise SystemExit('stale addressing schema assertion not found')
p.write_text(text.replace(old,"assert.equal(scenario.version, 9);",1),encoding='utf-8')
print('Updated stale addressing contract schema expectation to v9.')
