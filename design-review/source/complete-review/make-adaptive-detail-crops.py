from pathlib import Path
import json
from PIL import Image,ImageDraw,ImageFont

base=Path('complete-review/adaptive-audit/final');out=base/'details';out.mkdir(exist_ok=True)
audit=json.loads((base/'native-audit.json').read_text());cases=audit['cases'];font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',14)
targets=[('connected','microscope',390,220,1320),('evidence','capture-opened',390,1050,1900),('builder','topology',390,600,1430),('builder','topology-inspector',390,650,1530),('builder','topology',1024,0,190),('evidence','pane-boundary',760,150,1150),('evidence','pane-boundary',761,150,1150)]
for family,id in [('connected','microscope'),('evidence','capture-opened')]:
 region=next(r for r in audit['regions'] if (r.get('family'),r.get('id'),r.get('width'),r['theme'],r['kind'])==(family,id,390,'light','bytes'));y=region['rect'][1];h=region['rect'][3];targets.append((family,id,390,int(y-110),int(y+h+100)))
ledger=[]
for family,id,width,top,bottom in targets:
 selected=[next(c for c in cases if (c['family'],c['id'],c['width'],c['theme'])==(family,id,width,theme)) for theme in ['light','dark']]
 images=[]
 for c in selected:
  with Image.open(c['path']) as im:images.append(im.convert('RGB').crop((0,top,width,min(bottom,im.height))))
 height=max(i.height for i in images);sheet=Image.new('RGB',(width*2+24,height+42),(24,27,32));draw=ImageDraw.Draw(sheet)
 for i,(im,c) in enumerate(zip(images,selected)):
  x=8+i*(width+8);draw.text((x,7),family+'/'+id+' · '+c['theme'],font=font,fill=(228,234,244));sheet.paste(im,(x,34))
 suffix='-bytes' if (family,id,width,top,bottom) in targets[-2:] else '';path=out/(family+'-'+id+'-'+str(width)+suffix+'.png');sheet.save(path);ledger.append({'path':str(path),'source_cases':[c['path'] for c in selected],'crop':[top,bottom],'kind':'Paired native analytical detail; not browser pixels'})
(base/'detail-index.json').write_text(json.dumps(ledger,indent=2));print('Paired detail crops',len(ledger))
