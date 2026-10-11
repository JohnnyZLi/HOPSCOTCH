from pathlib import Path
import json,re,math,collections
from PIL import ImageChops

# This is an explicitly analytical native composition audit, not a browser or
# CSS layout engine. Material shader source, theme colors, data and hierarchy
# come from the emitted previews. Font metrics remain DejaVu substitution.
source=Path('complete-review/inspect-complete.py').read_text().split('\nimages=[]\n')[0]
source=source.replace("rows=[(f['subject'],str(f.get('value','Not available')),f['availability']) for f in facts]", "rows=model.get('displayRows') or [(f['subject'],str(f.get('value','Not available')),f['availability']) for f in facts]")
source=source.replace("cw-12,18)+18;ImageDraw", "w-16,18)+18;ImageDraw")
source=source.replace("headers=model.get('headings',[])[:8]", "headers=model.get('headings',[])")
source=source.replace("visible=[row for row in rows if not any(z in row[0] for z in ['Why','Item'])][:8]", "visible=[row for row in rows if row and not any(z in row[0] for z in ['Why','Item'])][:16]")
source=source.replace("if model.get('mode')=='error':", "if model.get('mode')=='loading':\n  y+=write(scene,'Acquiring one explicit snapshot. Valid evidence is retained.',x,y,13,c['muted'],w,20.8)+20;top=y\n if model.get('mode')=='partial':\n  y+=write(scene,'Partial source coverage · source limits remain explicit.',x,y,13,c['muted'],w,20.8)+20;top=y\n if model.get('mode')=='error':")
exec(source)
out=Path('complete-review/design-native');out.mkdir(exist_ok=True)
models=json.loads(Path('complete-review/design-composition-models.json').read_text())
metadata=json.loads(Path('complete-review/design-headings.json').read_text())
review=Path('complete-review/review.css').read_text()
css=re.search(r'<style>(.*?)</style>',Path('/workspace/hopscotch-causal-lifecycle.html').read_text(),re.S)[1]
styles={}
for dark in [False,True]:
 values={key:re.search(re.escape(key)+r':(#[0-9a-fA-F]{3,8})',css).group(1) for key in ['--hs-bg','--hs-ink','--hs-muted','--hs-material-muted']}
 for line in review.splitlines()[:2]:
  if '[data-theme=dark]' not in line or dark:
   values.update(dict(re.findall(r'(--[\w-]+):([^;{}]+)',line)))
 for sel,body in re.findall(r'([^{}]+)\{([^{}]*)\}',css):
  if sel.strip()==('#hop-causal-review[data-theme='+('dark' if dark else 'light')+']'):
   values.update({k:v for k,v in re.findall(r'(--[\w-]+):([^;{}]+)',body) if k.startswith('--hs-ambient') or k in ['--hs-bg','--hs-ink','--hs-muted','--hs-material-muted','--hs-liquid-neutral','--hs-liquid-opacity-base','--hs-liquid-opacity-step','--hs-liquid-opacity-min']})
 for key in list(values):
  for _ in range(4):
   m=re.fullmatch(r'var\((--[\w-]+)\)',values[key])
   if not m:break
   values[key]=values.get(m[1],values[key])
 styles[dark]=values
def rgba(value):
 if value.startswith('#'):return np.r_[rgb(value),1.]
 numbers=[float(x) for x in re.findall(r'[\d.]+',value)];return np.array([numbers[0]/255,numbers[1]/255,numbers[2]/255,numbers[3] if len(numbers)>3 else 1])
def colorvar(dark,key):return tuple(np.round(rgba(styles[dark][key])*255).astype('uint8'))
def analytic_page(width,height,dark):
 v=styles[dark];base=rgba(v['--hs-ambient-base'])[:3];page=np.empty((height,width,3));page[:]=base
 header=154 if width<=480 else 70;span=min(height-header,max(680,min(width*.96,1120)));yy,xx=np.mgrid[:round(span),:width];yy=yy/span;xx=xx/width
 back=np.empty((len(yy),width,3));back[:]=base
 for name,cx,cy,rx,ry,mid,end in [('violet',-.04,.27,.80,.65,0,.82),('cobalt',.24,.68,1.12,.90,.44,.78),('teal',1.04,.38,.90,.74,.46,.78)]:
  distance=np.sqrt(((xx-cx)/rx)**2+((yy-cy)/ry)**2);main=rgba(v['--hs-ambient-'+name])[:3];shadow=rgba(v.get('--hs-ambient-'+name+'-shadow',v['--hs-ambient-'+name]))[:3]
  interpolation=np.clip(distance/max(mid,.0001),0,1)[...,None] if mid else np.zeros((*distance.shape,1));face=main*(1-interpolation)+shadow*interpolation;opacity=np.clip((end-distance)/(end-mid),0,1)[...,None] if mid else np.clip((end-distance)/end,0,1)[...,None]
  back=back*(1-opacity)+face*opacity
 cover=np.interp(yy[:,0],[0,.18,.72,1],[.96,0,0,1])[:,None,None];back=back*(1-cover)+base*cover
 page[header:header+back.shape[0]]=back;return Image.fromarray(np.round(page*255).astype('uint8')).convert('RGBA')
def colors(dark):
 v=styles[dark]
 return {'ink':v['--hs-ink'],'muted':v['--hs-muted'],'material':v['--hs-material-muted'],'accent':'#96c3ff' if dark else '#075cbd','line':colorvar(dark,'--rv-divider'),'panel':'#222c39' if dark else '#edf5fc','red':'#f1a4b8' if dark else '#ab3f4e','teal':'#77d7df' if dark else '#087f93'}
native_depth=.24
render_code=prior[prior.index('def render('):prior.index('from PIL import ImageFilter')].replace("('u_depth',.34)","('u_depth',native_depth)")
exec(render_code)
target=bind(egl,'eglGetCurrentSurface',P,[I])(0x3059);display=bind(egl,'eglGetCurrentDisplay',P,[])();target_w=I();target_h=I();query_target=bind(egl,'eglQuerySurface',U,[P,P,I,C.POINTER(I)])
assert query_target(display,target,0x3057,C.byref(target_w)) and query_target(display,target,0x3056,C.byref(target_h))
def surface(scene,x,y,w,h,radius,dark,packet=False,density=.85,depth=.24,hue=0):
 global native_depth
 x,y,w,h=map(round,(x,y,w,h));crop=scene.crop((x,y,x+w,y+h))
 ratio=min(2,math.sqrt(1048576/(w*h)),target_w.value/w,target_h.value/h)
 if packet:
  backing(Image.new('RGBA',(1,1),(23,26,32,255) if dark else (243,245,247,255)));face=render(packet_program,w,h,radius,dark,ratio=ratio).resize((w,h),Image.Resampling.LANCZOS)
  if hue:
   # Analytical CSS hue-rotate matrix; this is not browser color verification.
   radians=math.radians(hue);co,si=math.cos(radians),math.sin(radians)
   matrix=np.array([[.213+.787*co-.213*si,.715-.715*co-.715*si,.072-.072*co+.928*si],[.213-.213*co+.143*si,.715+.285*co+.140*si,.072-.072*co-.283*si],[.213-.213*co-.787*si,.715-.715*co+.715*si,.072+.928*co+.072*si]])
   pixels=np.asarray(face).copy();pixels[:,:,:3]=np.clip(pixels[:,:,:3]@matrix.T,0,255).astype('uint8');face=Image.fromarray(pixels)
 else:
  bg=np.asarray(crop.convert('RGB').filter(ImageFilter.GaussianBlur(12+density*4)))/255;face=Image.fromarray(np.round(frost(bg,dark,density)*255).astype('uint8')).convert('RGBA');mask=Image.new('L',(w,h));ImageDraw.Draw(mask).rounded_rectangle((0,0,w-1,h-1),radius=radius,fill=255);face.putalpha(mask);native_depth=depth;rim=render(program,w,h,radius,dark,ratio=ratio).resize((w,h),Image.Resampling.LANCZOS);face=Image.alpha_composite(face,rim)
 # CSS clips material/background to the owner radius independently of shader
 # resolution. Restore that clipping after native rim resampling; otherwise a
 # tall low-resolution analytical surface can leak square/jagged corner pixels.
 clip=Image.new('L',(w,h));ImageDraw.Draw(clip).rounded_rectangle((0,0,w-1,h-1),radius=radius,fill=255);face.putalpha(ImageChops.multiply(face.getchannel('A'),clip))
 shadow=Image.new('RGBA',scene.size);ImageDraw.Draw(shadow).rounded_rectangle((x,y+5,x+w,y+h+5),radius=radius,fill=colorvar(dark,'--rv-shadow-soft'));scene.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(7)));scene.alpha_composite(face,(x,y))
def button(scene,label,x,y,w,dark,active=False,primary=False):
 x,y,w=map(round,(x,y,w));v=styles[dark];fill=v['--rv-action-fill'] if primary else v['--rv-selected-fill'] if active else v['--rv-control-fill'];ink=v['--rv-action-ink'] if primary else v['--rv-selected-ink'] if active else v['--hs-ink']
 crop=scene.crop((x,y,x+w,y+44)).filter(ImageFilter.GaussianBlur(12));layer=Image.new('RGBA',crop.size,colorvar(dark,'--rv-action-fill' if primary else '--rv-selected-fill' if active else '--rv-control-fill'));crop=Image.alpha_composite(crop,layer);mask=Image.new('L',crop.size);ImageDraw.Draw(mask).rounded_rectangle((0,0,w-1,43),radius=14,fill=255);crop.putalpha(mask);scene.alpha_composite(crop,(x,y));draw=ImageDraw.Draw(scene);draw.rounded_rectangle((x,y,x+w-1,y+43),radius=14,outline=colorvar(dark,'--rv-control-rim'),width=1)
 text=str(label)
 while text and font(13).getlength(text)>w-24:text=text[:-1]
 if text!=str(label):text=text.rstrip()+'…'
 write(scene,text,x+max(12,(w-font(13).getlength(text))/2),y+12,13,ink,w-12)
def tabs(scene,labels,x,y,w,dark,selected=0):
 start=x
 for i,label in enumerate(labels):
  bw=min(w,max(48,math.ceil(font(13).getlength(label)+28)))
  if x+bw>start+w:x=start;y+=52
  button(scene,label,x,y,bw,dark,i==selected);x+=bw+8
 return y+56
def new_scene(model,dark):
 width=model['width'];pad=16 if width<=480 else 26;w=width-pad*2
 if (width,dark) not in pages:pages[(width,dark)]=analytic_page(width,8000,dark)
 scene=pages[(width,dark)].copy();c=colors(dark);write(scene,'HOPSCOTCH',pad,18,12,c['ink']);kind=model['type']
 if width<=480:
  y=64
  if kind!='builder':write(scene,'Scene' if kind=='motion' else 'Workspace',pad,y+10,12,c['muted']);button(scene,model['id'],width-215,y,199,dark);y+=54
  write(scene,'Appearance',pad,y+10,12,c['muted']);button(scene,'Dark' if dark else 'Light',width-126,y,110,dark);y+=70
 else:
  if kind!='builder':button(scene,model['id'],width-400,10,250,dark)
  button(scene,'Dark' if dark else 'Light',width-134,10,110,dark);y=98
 eyebrow='Author, inspect, explain' if kind=='builder' else 'Protocols and packets' if kind=='motion' else 'Evidence and vantage';write(scene,eyebrow,pad,y,12,c['muted'],w);y+=23
 heading=metadata['titles'][model['id']] if kind=='motion' else 'Your network. Clear consequences.' if kind=='builder' else model.get('title',model['id'])
 y+=write(scene,heading,pad,y,25,c['ink'],w,30)+10
 summary=metadata['summaries'][model['id']] if kind=='motion' else 'Configuration, derived state, and canonical events stay distinct. The workbench follows your selection.' if kind=='builder' else model.get('summary','');y+=write(scene,summary,pad,y,13,c['muted'],w,20.8)+24
 if kind=='builder':y=tabs(scene,['Topology','Systems','CLI','History','Challenge','Scenario'],pad,y,w,dark,0 if model['id']=='topology' else 2 if model['id']=='terminal' else 3 if model.get('mode')=='page' and model['id']=='history' else 4 if model.get('mode')=='page' and model['id']=='challenge' else 5 if model.get('mode')=='page' and model['id']=='scenario' else 1)
 if kind=='evidence':y=tabs(scene,['Load reference','Clear'],pad,y,w,dark);y+=write(scene,model.get('mode','populated').title()+' · reference state',pad,y,12,c['muted'],w)+16
 model['audit_body_y']=y
 return scene,pad,y,w,c

# Main constructors remain bounded source-driven samples. Deep native
# disclosures are represented by their actual summaries, not flattened paths.
report={'kind':'Complete supplied-family matrix: actual emitted GLSL, role colors and source state; analytical CSS/layout and DejaVu fonts. Not live browser, full DOM screenshots, physical phone, animation capture or hardware verification.','cases':[],'text_bounds':[],'source_manifest':json.loads(Path('complete-review/source-manifest.json').read_text())}
pages={};images=[]
for i,model in enumerate(models):
 for dark in [False,True]:
 item=globals()[model['type']](model,dark);images.append(item)
 if (i+1)%50==0:print('Rendered source states',i+1,flush=True)
Path('complete-review/design-native-checkpoint.json').write_text(json.dumps(report))
counts=collections.Counter((x['type'],x['width'],x['theme']) for x in report['cases']);report['matrix_counts']=[{'family':k[0],'width':k[1],'theme':k[2],'count':v} for k,v in sorted(counts.items())]
report['distinct_paths']=len({x['path'] for x in report['cases']})
assert report['distinct_paths']==len(report['cases']),'Every source-state case must have a distinct image identity.'
for path in {x['path'] for x in report['cases']}:
 with Image.open(path) as im:im.verify()
# Separate sheets keep each family/theme/size visible rather than hiding Dark
# omissions in a mixed contact sheet. Crop header/footer only in overview sheets.
def sheet(items,name,columns=3,thumb=300):
 rh=640;canvas=Image.new('RGB',(columns*(thumb+16)+16,math.ceil(len(items)/columns)*(rh+38)+16),'#151920');draw=ImageDraw.Draw(canvas)
 for i,(img,case) in enumerate(items):
  x=16+i%columns*(thumb+16);y=16+i//columns*(rh+38);draw.text((x,y),case['scene']+' · '+case['frame'],font=font(11),fill='#eef1f6');scale=min(thumb/img.width,rh/img.height);im=img.resize((round(img.width*scale),round(img.height*scale)),Image.Resampling.LANCZOS);canvas.paste(im,(x,y+26))
 canvas.save(out/name)
for family in ['motion','builder','evidence']:
 for width in [390,1024]:
  for theme in ['light','dark']:
   group=[x for x in images if x[1]['type']==family and x[1]['width']==width and x[1]['theme']==theme]
   if family=='motion':group=[x for x in group if (x[1]['scene']!='journey' or any(s in x[1]['frame'] for s in ['packet-assembly','tls-server','tcp-synack']))]
   for offset in range(0,len(group),12):sheet(group[offset:offset+12],family+'-'+str(width)+'-'+theme+'-'+str(offset//12)+'.png',columns=3,thumb=300)
Path('complete-review/design-native-audit.json').write_text(json.dumps(report,indent=2));print(json.dumps({'images':len(images),'distinct_paths':report['distinct_paths'],'line_measurements':len(report['text_bounds']),'matrix':report['matrix_counts']},indent=2))
