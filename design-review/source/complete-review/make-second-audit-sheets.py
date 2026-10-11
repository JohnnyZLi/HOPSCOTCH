from pathlib import Path
import json,math,io,os,tempfile
from PIL import Image,ImageDraw,ImageFont
audit_dir=Path(os.environ.get('HOPSCOTCH_AUDIT_DIR','complete-review/second-audit'))
out=audit_dir/'sheets';out.mkdir(exist_ok=True)
cases=json.loads((audit_dir/'native-audit.json').read_text())['cases']
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',12)
ledger=[]
for family in ['connected','builder','evidence']:
 for width in sorted({c['width'] for c in cases}):
  group=[c for c in cases if c['family']==family and c['width']==width]
  for offset in range(0,len(group),12):
   subset=group[offset:offset+12];sheet=Image.new('RGB',(1240,math.ceil(len(subset)/4)*748+16),(24,27,32));draw=ImageDraw.Draw(sheet)
   for index,case in enumerate(subset):
    x=12+index%4*306;y=12+index//4*748;label=case['id']+' · '+case['theme'];draw.text((x,y),label,font=font,fill=(226,232,244))
    im=Image.open(case['path']).convert('RGB');im=im.crop((0,90,im.width,min(im.height,90+im.width*2.3)));im.thumbnail((294,706));sheet.paste(im,(x,y+30))
   path=out/(family+'-'+str(width)+'-'+str(offset//12)+'.png');encoded=io.BytesIO();sheet.save(encoded,format='PNG');payload=encoded.getvalue()
   with Image.open(io.BytesIO(payload)) as im:im.verify()
   fd,tmp=tempfile.mkstemp(dir=out,suffix='.png')
   with os.fdopen(fd,'wb') as f:f.write(payload);f.flush();os.fsync(f.fileno())
   os.replace(tmp,path);ledger.append({'path':str(path),'cases':[c['path'] for c in subset]})
(audit_dir/'sheet-index.json').write_text(json.dumps(ledger,indent=2));print('Paired family sheets',len(ledger))

causal=json.loads((audit_dir/'causal-native-audit.json').read_text())['cases'];causal_ledger=[]
for width in [390,1024]:
 group=[c for c in causal if c['width']==width]
 for offset in range(0,len(group),12):
  subset=group[offset:offset+12];sheet=Image.new('RGB',(1240,math.ceil(len(subset)/4)*748+16),(24,27,32));draw=ImageDraw.Draw(sheet)
  for index,case in enumerate(subset):
   x=12+index%4*306;y=12+index//4*748;draw.text((x,y),case['scene']+'/'+case['frame']+' · '+case['theme'],font=font,fill=(226,232,244))
   im=Image.open(case['path']).convert('RGB');im=im.crop((0,130,im.width,min(im.height,130+im.width*2.3)));im.thumbnail((294,706));sheet.paste(im,(x,y+30))
  path=out/('causal-'+str(width)+'-'+str(offset//12)+'.png');encoded=io.BytesIO();sheet.save(encoded,format='PNG');payload=encoded.getvalue()
  with Image.open(io.BytesIO(payload)) as im:im.verify()
  fd,tmp=tempfile.mkstemp(dir=out,suffix='.png')
  with os.fdopen(fd,'wb') as f:f.write(payload);f.flush();os.fsync(f.fileno())
  os.replace(tmp,path);causal_ledger.append({'path':str(path),'cases':[c['path'] for c in subset]})
(audit_dir/'causal-sheet-index.json').write_text(json.dumps(causal_ledger,indent=2));print('Paired causal sheets',len(causal_ledger))
