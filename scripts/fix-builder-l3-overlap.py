from pathlib import Path

path = Path('scripts/builder-addressing-contract-check.mjs')
text = path.read_text()
old = """overlapping.segments['r1-core'].cidr = '10.0.0.0/29';
overlapping.segments['r1-core'].interfaces[0].address = '10.0.0.5';
overlapping.segments['r1-core'].interfaces[1].address = '10.0.0.6';
"""
new = """overlapping.segments['r1-core'].cidr = '10.0.0.0/27';
overlapping.segments['r1-core'].interfaces[0].address = '10.0.0.29';
overlapping.segments['r1-core'].interfaces[1].address = '10.0.0.30';
"""
if text.count(old) != 1:
    raise SystemExit('overlap fixture anchor missing or ambiguous')
path.write_text(text.replace(old, new, 1))
print('Fixed Builder overlap fixture to reach overlap validation without another earlier error.')
