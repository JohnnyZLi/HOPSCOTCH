from pathlib import Path
import json,math,io,os,tempfile,re

# Native EGL/Pillow composition model, deliberately not an HTML/CSS engine.
# Tree content and semantic roles are exported from the actual emitted runtime.
prefix=Path('complete-review/inspect-design-matrix.py').read_text().split('# Main constructors remain bounded')[0]
exec(prefix)
models=json.loads(Path('complete-review/final-composition-models.json').read_text())
out=Path('complete-review/final-native');out.mkdir(exist_ok=True)
report={'kind':'Actual emitted shader + runtime DOM text/roles; analytical layout, native DejaVu substitute. No browser, native system font, motion-frame, phone or hardware acceptance.','cases':[],'text_bounds':[],'source_manifest':json.loads(Path('complete-review/source-manifest.json').read_text())}

def txt(n):return str(n.get('text',''))+''.join(txt(x) for x in n.get('children',[]))
def has(n,cls):return cls in n.get('cls','').split()
def block(scene,text,x,y,w,size=13,dark=False,muted=False):
 lines=text_lines(text,size,max(1,w));lh=size*1.6
 if scene is not None:
  color=colors(dark)['muted' if muted else 'ink']
  for i,line in enumerate(lines):write(scene,line,x,y+i*lh,size,color,w,lh)
 return y+max(1,len(lines))*lh
def line(scene,x,y,w,dark):
 if scene is None:return
 layer=Image.new('RGBA',scene.size);ImageDraw.Draw(layer).line((x,y,x+w,y),fill=colorvar(dark,'--rv-divider'));scene.alpha_composite(layer)
def control(scene,label,x,y,w,dark,selected=False,primary=False):
 h=max(44,len(text_lines(label,13,max(1,w-24)))*20.8+18)
 if scene is not None:
  layer=Image.new('RGBA',(round(w),math.ceil(h)),colorvar(dark,'--rv-action-fill' if primary else '--rv-selected-fill' if selected else '--rv-control-fill'))
  crop=scene.crop((round(x),round(y),round(x)+layer.width,round(y)+layer.height)).filter(ImageFilter.GaussianBlur(12));crop=Image.alpha_composite(crop,layer);mask=Image.new('L',crop.size);ImageDraw.Draw(mask).rounded_rectangle((0,0,crop.width-1,crop.height-1),radius=14,fill=255);crop.putalpha(mask);scene.alpha_composite(crop,(round(x),round(y)))
  rim=Image.new('RGBA',scene.size);ImageDraw.Draw(rim).rounded_rectangle((x,y,x+w-1,y+h-1),radius=14,outline=colorvar(dark,'--rv-control-rim'));scene.alpha_composite(rim)
  ink=styles[dark]['--rv-action-ink' if primary else '--rv-selected-ink' if selected else '--hs-ink'];write(scene,label,x+12,y+9,13,ink,w-24,20.8)
 return y+h
def cell_content(cell,scene,x,y,w,dark):
 if cell.get('text'):y=block(scene,cell['text'],x,y,w,13,dark)
 for child in cell.get('children',[]):y=block(scene,txt(child),x,y,w,12 if child['tag']=='small' else 13,dark,child['tag']=='small')+(5 if child['tag']=='small' else 0)
 return y
def render_node(n,scene,x,y,w,dark,depth=0):
 if n is None:return y
 tag=n['tag'];children=n.get('children',[]);own=n.get('text','');attrs=n.get('attrs',{})
 if tag in ['option','input','output'] and tag!='output':return y
 if tag=='output':return block(scene,txt(n),x,y,w,12,dark,True)+8
 if tag=='select':
  choice=next((c for c in children if str(c.get('value',''))==str(n.get('value',''))),children[0] if children else {'text':''})
  label=('Dark' if dark else 'Light') if 'rv-theme' in n.get('cls','').split() else txt(choice)
  return control(scene,label,x,y,w,dark)+8
 if tag=='textarea':return block(scene,n.get('value',''),x+10,y+10,w-20,13,dark)+20
 if tag=='button' and has(n,'cx-row'):
  copy=children[0] if children else n;y=render_node(copy,scene,x+10,y+10,w-70,dark,depth+1);return y+10
 if tag=='button' and (has(n,'ev-fact-button') or has(n,'cx-byte-field-label')):return block(scene,txt(n),x,y,w,13,dark)+6
 if tag=='button' and not has(n,'cx-entry'):return control(scene,txt(n),x,y,w,dark,attrs.get('aria-pressed')=='true',attrs.get('data-actionRole')=='primary')+8
 if has(n,'rv-bytes'):
  minimum=float(attrs.get('data-byteCell',44));cols=max(1,math.floor((w+4)/(minimum+4)));cw=(w-(cols-1)*4)/cols;start_y=y
  for start in range(0,len(children),cols):
   for i,child in enumerate(children[start:start+cols]):
    if scene is not None:
     selected=child.get('attrs',{}).get('aria-pressed')=='true';xx=x+i*(cw+4)
     if selected or child.get('attrs',{}).get('data-inField')=='true':
      fill=colorvar(dark,'--hs-tint');layer=Image.new('RGBA',scene.size);ImageDraw.Draw(layer).rounded_rectangle((xx,y,xx+cw-1,y+43),radius=9,fill=fill);scene.alpha_composite(layer)
     label=txt(child);write(scene,label,xx+(cw-font(13).getlength(label))/2,y+12,13,styles[dark]['--hs-accent' if selected else '--hs-ink'],cw,20.8)
   y+=48
  if scene is not None:report.setdefault('regions',[]).append({**{k:v for k,v in (globals().get('current') or {}).items() if k in ['family','id','width']},'theme':'dark' if dark else 'light','kind':'bytes','rect':[x,start_y,w,y-start_y]})
  return y+12
 if has(n,'ev-field-row'):
  label=children[0];value=children[1];line(scene,x,y,w,dark);y+=10
  y=block(scene,txt(label),x,y+8,w,13,dark,True)+8+6
  y=block(scene,txt(value),x,y,w,17,dark)+10
  return y
 if has(n,'cx-byte-field'):
  line(scene,x,y,w,dark);y+=12
  for child in children:y=block(scene,txt(child),x+12,y,w-24,18 if child['tag']=='strong' else 13,dark,child['tag']=='button')+(8 if child['tag']=='strong' else 14)
  return y+12
 if tag=='label':
  y=block(scene,own,x,y,w,12,dark,True)+6 if own else y
  for child in children:y=render_node(child,scene,x,y,w,dark,depth+1)
  return y+8
 if tag=='summary':return block(scene,txt(n),x,y,w,14,dark)+8
 if tag=='details':
  summary=next((c for c in children if c['tag']=='summary'),None)
  y=block(scene,('− ' if n.get('open') else '+ ')+txt(summary or {}),x,y,w,14,dark)+12
  if n.get('open'):
   for child in children:
    if child is not summary:y=render_node(child,scene,x+8,y,w-8,dark,depth+1)
  return y+12
 if has(n,'rv-facts') or has(n,'rv-semantic-fields'):
  semantic=has(n,'rv-semantic-fields');gap=24 if semantic else 14;minimum=13*14 if semantic else 134
  cols=max(1,min(len(children),math.floor((w+gap)/(minimum+gap))));cw=(w-(cols-1)*gap)/cols
  for start in range(0,len(children),cols):
   heights=[]
   for i,cell in enumerate(children[start:start+cols]):
    yy=y
    for child in cell['children']:yy=render_node(child,scene,x+i*(cw+gap),yy,cw,dark,depth+1)
    heights.append(yy-y)
   y+=max(heights,default=0)+10
  return y+4
 if tag=='table':
  head=next((c for c in children if c['tag']=='thead'),None);body=next((c for c in children if c['tag']=='tbody'),None)
  names=[txt(c) for c in (head or {}).get('children',[{'children':[]}])[0].get('children',[])];count=max(1,len(names));cw=w/count
  if w>500:
   for i,name in enumerate(names):block(scene,name,x+i*cw+8,y,cw-16,12,dark,True)
   y+=30
  for row in (body or {}).get('children',[]):
   if not has(row,'rv-row-note'):line(scene,x,y,w,dark);y+=10
   if w<=500:
    for i,cell in enumerate(row['children']):
     if has(row,'rv-row-note'):y=block(scene,txt(cell),x+8,y,w-16,12,dark,True)+8;continue
     label=names[i] if i<len(names) else '';lw=max(72,(w-28)*.285);a=block(scene,label,x+8,y,lw,12,dark,True);b=cell_content(cell,scene,x+20+lw,y,w-lw-28,dark);y=max(a,b)+10
   else:
    heights=[cell_content(cell,scene,x+i*cw+8,y,cw-16,dark)-y for i,cell in enumerate(row['children'])];y+=max(heights,default=0)+16
  return y+16
 if has(n,'cx-opening') or has(n,'cx-content-layout') or has(n,'cx-featured') or has(n,'cx-preset-list'):
  if w>700:
   count=len(children);gap=24
   if has(n,'cx-opening'):widths=[(w-gap)*.4,(w-gap)*.6]
   elif has(n,'cx-content-layout'):widths=[w-280-gap,280]
   else:widths=[(w-(count-1)*16)/max(1,count)]*count;gap=16
   yy=y;xx=x
   for child,cw in zip(children,widths):yy=max(yy,render_node(child,scene,xx,y,cw,dark,depth+1));xx+=cw+gap
   return yy+24
 if has(n,'cx-glass') or has(n,'ev-packet') or has(n,'rv-record') or has(n,'cx-entry'):
  packet=attrs.get('data-materialRole')=='packet';pad=24 if packet or has(n,'cx-glass') or has(n,'ev-packet') else 20 if w<450 else 24;end=y+pad
  for child in children:end=render_node(child,None,x+pad,end,w-2*pad,dark,depth+1)
  h=max(64,end-y+pad)
  if scene is not None:surface(scene,x,y,w,h,24 if has(n,'cx-glass') or has(n,'ev-packet') else 18,dark,packet,density=1.3 if has(n,'cx-inspector') or has(n,'ev-inspector') else .65,depth=.26 if has(n,'cx-inspector') else .22,hue=attrs.get('data-packetHue',0))
  yy=y+pad
  for child in children:yy=render_node(child,scene,x+pad,yy,w-2*pad,dark,depth+1)
  return y+h+20
 if tag in ['h2','h3','p','dt','dd','strong','small','pre']:
  size=30 if tag=='h2' else 20 if tag=='h3' and has(n,'cx-glass') else 17 if tag in ['h3','dd'] else 12 if tag in ['small','dt'] else 15 if tag=='strong' else 13
  return block(scene,txt(n),x,y,w,size,dark,tag in ['small','dt','p'])+(5 if tag=='dt' else 14)
 if tag=='nav' or has(n,'rv-toolbar') or has(n,'rv-controls') or has(n,'rv-header') or has(n,'cx-frame-lane'):
  xx=x;row_y=y;bottom=y
  for child in children:
   label=txt(child);cw=min(w,max(85,font(13).getlength(label)+28)) if child['tag']=='button' else min(w,230)
   if xx+cw>x+w+.1:xx=x;row_y=bottom+8
   end=render_node(child,scene,xx,row_y,cw,dark,depth+1);bottom=max(bottom,end);xx+=cw+10
  return bottom+16
 if own.strip():y=block(scene,own,x,y,w,13,dark)+10
 for child in children:y=render_node(child,scene,x,y,w,dark,depth+1)
 return y

for model in models:
 for dark in [False,True]:
  width=model['width'];pad=16 if width<=480 else 26;w=width-pad*2;y=16
  y=render_node(model['header'],None,pad,y,w,dark)
  if model['family']=='dense':y=block(None,model['title'],pad,y,w,27,dark)+20
  end=render_node(model['body'],None,pad,y,w,dark)+24
  if model.get('inspector'):end=render_node(model['inspector'],None,pad,end,w,dark)+24
  assert end<26000,('Analytical scene too tall',model['id'],end)
  scene=analytic_page(width,math.ceil(end),dark);y=16;y=render_node(model['header'],scene,pad,y,w,dark)
  if model['family']=='dense':y=block(scene,model['title'],pad,y,w,27,dark)+20
  y=render_node(model['body'],scene,pad,y,w,dark)+24
  if model.get('inspector'):y=render_node(model['inspector'],scene,pad,y,w,dark)+24
  path=out/(model['family']+'-'+model['id']+'-'+str(width)+'-'+('dark' if dark else 'light')+'.png');encoded=io.BytesIO();scene.convert('RGB').save(encoded,format='PNG');fd,tmp=tempfile.mkstemp(dir=out,suffix='.png')
  with os.fdopen(fd,'wb') as h:h.write(encoded.getvalue());h.flush();os.fsync(h.fileno())
  os.replace(tmp,path)
  with Image.open(path) as im:im.load()
  report['cases'].append({'path':str(path),'family':model['family'],'id':model['id'],'width':width,'theme':'dark' if dark else 'light','height':scene.height})
 print('Rendered',model['id'],model['width'],flush=True)
Path('complete-review/final-native-audit.json').write_text(json.dumps(report,indent=2))
