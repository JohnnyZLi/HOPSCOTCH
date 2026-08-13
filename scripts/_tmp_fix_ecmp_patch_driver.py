from pathlib import Path
p=Path('scripts/_tmp_apply_lab11m_ecmp.py')
text=p.read_text(encoding='utf-8')
old="next_text, count = re.subn(pattern, replacement, text, count=1, flags=flags)"
new="next_text, count = re.subn(pattern, lambda _match: replacement, text, count=1, flags=flags)"
if old not in text:
    raise SystemExit('ECMP patch driver regex replacement line not found')
p.write_text(text.replace(old,new,1),encoding='utf-8')
print('ECMP patch driver regex replacement fixed.')
