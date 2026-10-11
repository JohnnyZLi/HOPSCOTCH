from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json, math, collections, hashlib

p=Path('complete-review');out=p/'design-native'
models=json.loads((p/'design-composition-models.json').read_text())
cases=[]
for m in models:
 fid=m['frame']['id'] if m['type']=='motion' else m['id']+'-'+m.get('mode','populated')
 for theme in ['light','dark']:
  file=out/(m['type']+'-'+m['id']+'-'+fid+'-'+str(m['width'])+'-'+theme+'.png')
  with Image.open(file) as im:
   im.verify()
  with Image.open(file) as im:height=im.height
  cases.append({'path':str(file),'family':m['type'],'scene':m['id'],'frame':fid,'width':m['width'],'theme':theme,'height':height})
assert len({c['path'] for c in cases})==len(cases)
counts=collections.Counter((x['family'],x['width'],x['theme']) for x in cases)
report={'kind':'Analytical native source-state compositions using emitted optical GLSL and substitute DejaVu fonts; no browser/CSS layout, motion capture or complete DOM screenshots.','images':len(cases),'matrix':[{'family':k[0],'width':k[1],'theme':k[2],'count':v} for k,v in sorted(counts.items())],'cases':cases,'at_height_limit':[c['path'] for c in cases if c['height']>=5000], 'limits':['Source-state sample coverage is not full rendered workspace coverage.','Nested disclosures, toolbar controls and sidebars are bounded analytical representations.','Runtime glyph geometry is separately verified with substitute fonts. Native visual text measurements were not recovered from the two completed render processes.','PNG controls and dividers in this broad set use analytical alpha handling; their border contrast must not be treated as actual CSS compositing evidence.','An additional CSS-only envelope shadow correction followed native rendering; no emitted JavaScript or accepted shader was changed by that correction.'], 'current_review_manifest':json.loads((p/'source-manifest.json').read_text()),'model_sha256':hashlib.sha256((p/'design-composition-models.json').read_bytes()).hexdigest()}
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',11)
sheet_paths=[]
for family in ['motion','builder','evidence']:
 for width in [390,1024]:
  for theme in ['light','dark']:
   group=[c for c in cases if c['family']==family and c['width']==width and c['theme']==theme]
   for start in range(0,len(group),12):
    items=group[start:start+12];cols=3;thumb=300;rh=640
    sheet=Image.new('RGB',(cols*(thumb+16)+16,math.ceil(len(items)/cols)*(rh+38)+16),'#151920');draw=ImageDraw.Draw(sheet)
    for i,c in enumerate(items):
     x=16+i%cols*(thumb+16);y=16+i//cols*(rh+38);draw.text((x,y),c['scene']+' · '+c['frame'],font=font,fill='#eef1f6')
     with Image.open(c['path']) as im:
      scale=min(thumb/im.width,rh/im.height);im=im.resize((round(im.width*scale),round(im.height*scale)),Image.Resampling.LANCZOS);sheet.paste(im,(x,y+26))
    path=out/(family+'-'+str(width)+'-'+theme+'-'+str(start//12)+'.png');sheet.save(path);sheet_paths.append(str(path))
report['contact_sheets']=sheet_paths
(p/'design-native-audit.json').write_text(json.dumps(report,indent=2))
print(json.dumps({k:report[k] for k in ['images','matrix','at_height_limit']}));print('Contact sheets',len(sheet_paths))
