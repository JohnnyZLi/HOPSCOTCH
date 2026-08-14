from pathlib import Path
import re
p=Path('scripts/_tmp_patch_bgp_projection.py')
s=p.read_text(encoding='utf-8')
pattern=re.compile(r'(?m)^(new|insert)="""(.*?)"""$',re.DOTALL)
def repl(match):
    return f"{match.group(1)}={match.group(2)!r}"
next_s=pattern.sub(repl,s)
if next_s==s:
    raise SystemExit('No triple-double assignment blocks found to sanitize.')
p.write_text(next_s,encoding='utf-8')
print('Sanitized projection patch multiline assignments into repr string literals.')
