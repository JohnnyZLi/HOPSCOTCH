from pathlib import Path
import json
from PIL import Image,ImageDraw,ImageFont

base=Path('complete-review/refinement-audit');out=base/'details';out.mkdir(exist_ok=True)
audit=json.loads((base/'native-audit.json').read_text());cases=audit['cases'];font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',14)
targets=[('connected','tls-message',390,250,1150),('connected','tls-validation',390,250,1150),('builder','summary-addressing',390,140,1250),('builder','systems-routing',1024,120,1200),('builder','topology',390,520,1620),('builder','topology-inspector',390,480,1500),('builder','topology',1024,0,1050),('evidence','pane-boundary',760,140,1300),('evidence','pane-boundary',800,140,1300)]
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
    path=out/(family+'-'+id+'-'+str(width)+'.png');sheet.save(path);ledger.append({'path':str(path),'source_cases':[c['path'] for c in selected],'crop':[top,bottom],'kind':'Paired native analytical detail; not browser pixels'})
(base/'detail-index.json').write_text(json.dumps(ledger,indent=2));print('Paired detail crops',len(ledger))
