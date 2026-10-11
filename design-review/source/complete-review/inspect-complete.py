from pathlib import Path
import json, math, re, copy, sys, io, os, tempfile

# Permitted native EGL/Pillow audit. No browser, HTML layout engine, or browser
# execution is used. Geometry/backdrop are analytical; DejaVu is a substitute.
prefix=Path('inspect-focused-router.py').read_text().split('images=[]')[0]
prefix=prefix.replace('ratio=2).resize', 'ratio=min(2,1040/w,1040/h)).resize')
prefix=prefix.replace('w,h=round(w),round(h)', 'x,y=round(x),round(y);w,h=round(w),round(h)')
prefix=prefix.replace('backing(crop);face=', "backing(Image.new('RGBA',(1,1),(23,26,32,255) if dark else (243,245,247,255)));face=")
exec(prefix)
emitted=Path('/workspace/hopscotch-causal-lifecycle.html').read_text()
anchor=emitted.index('const root=document.getElementById(\'hop-causal-review\'),vertex=')
vertex,fragment=re.search(r'vertex=`(.*?)`,fragment=`(.*?)`,surface=',emitted[anchor:],re.S).groups()
fragment=fragment.replace("${document.getElementById('hop-causal-review').glassEdge.glsl}",Path('shared-glass-edge.glsl').read_text())
assert '${' not in fragment, 'All shader kernels must resolve to their actual source.'
packet_program=make_program(fragment)
models=json.loads(Path('complete-review/composition-models.json').read_text())
data=json.loads(Path('complete-review/source-data.json').read_text())
out=Path('complete-review/native-audit');out.mkdir(exist_ok=True)
report={'kind':'Native EGL shader pixels and source-derived analytical compositions, DejaVu substitute; not browser, native system-font, phone, assistive technology or hardware performance verification.','cases':[],'text_bounds':[],'source_manifest':json.loads(Path('complete-review/source-manifest.json').read_text())}
extra_only='--capture-details-only' in sys.argv
recheck='--followup-recheck' in sys.argv
bad_paths={'complete-review/native-audit/motion-packetOps-assemble-390-dark.png','complete-review/native-audit/motion-packetOps-append-390-light.png','complete-review/native-audit/evidence-physical-physical-populated-1024-dark.png','complete-review/native-audit/evidence-capture-capture-large-1024-dark.png'}
if recheck:
 report=json.loads(Path('complete-review/native-composition-audit.json').read_text());report['retained_case_source_manifest']=report['source_manifest'];report['source_manifest']=json.loads(Path('complete-review/source-manifest.json').read_text());report['rechecked_cases']=[]
if extra_only:
 report=json.loads(Path('complete-review/native-composition-audit.json').read_text());models=[m for m in models if m.get('extraCapture')]
pages={}

def colors(dark):
 return {'ink':'#eef1f6' if dark else '#172332','muted':'#a7afbc' if dark else '#526273','material':'#bcc8d8' if dark else '#37465a','accent':'#96c3ff' if dark else '#075cbd','line':'#4b5c70' if dark else '#bac8d7','panel':'#222c39' if dark else '#edf5fc','red':'#f1a4b8' if dark else '#ab3f4e','teal':'#77d7df' if dark else '#087f93'}

def new_scene(model,dark):
 width=model['width'];pad=16 if width<=480 else 26;w=width-pad*2
 if (width,dark) not in pages:pages[(width,dark)]=Image.fromarray(np.round(backdrop(width,5000,profile if dark else light_profile)*255).astype('uint8')).convert('RGBA')
 scene=pages[(width,dark)].copy();c=colors(dark)
 write(scene,'HOPSCOTCH',pad,18,12,c['ink'])
 title= 'Network Builder' if model['type']=='builder' else 'Protocols and packets' if model['type']=='motion' else 'Evidence and vantage'
 if width<=480:
  write(scene,'Workspace',pad,64,12,c['muted']);button(scene,model['id'],width-215,53,199,dark)
  write(scene,'Appearance',pad,118,12,c['muted']);button(scene,'Dark' if dark else 'Light',width-126,106,110,dark);y=176
 else:
  button(scene,model['id'],width-400,10,250,dark);button(scene,'Dark' if dark else 'Light',width-134,10,110,dark);y=98
 write(scene,title,pad,y,12,c['muted'],w);y+=23
 heading=model['frame']['title'] if model['type']=='motion' else model.get('title') or model['id'].title()
 y+=write(scene,heading,pad,y,25,c['ink'],w,30)+10
 summary=model['frame']['summary'] if model['type']=='motion' else model.get('summary','')
 y+=write(scene,summary,pad,y,13,c['muted'],w,20.8)+24
 return scene,pad,y,w,c

def finish(scene,model,dark,y):
 x=16 if model['width']<=480 else 26;w=model['width']-2*x;c=colors(dark)
 y+=24;ImageDraw.Draw(scene).line((x,y,x+w,y),fill=c['line']);y+=18
 if model['type']=='motion':
  y+=write(scene,model['frame']['title'],x,y,16,c['ink'],w,22.4)+6
  y+=write(scene,model['frame']['summary'],x,y,13,c['muted'],w,20.8)+18
  if w<500:
   bw=(w-16)/3
   for i,label in enumerate(['Play','Replay','Next event']):button(scene,label,x+i*(bw+8),y,bw,dark)
   y+=56;button(scene,str(model['index']+1)+' / '+str(len(model['allFrames']))+' · '+model['frame']['id'],x,y,w,dark);y+=56
  else:
   for i,label in enumerate(['Play','Replay','Next event']):button(scene,label,x+i*120,y,110,dark)
   button(scene,model['frame']['id'],x+360,y,w-450,dark);button(scene,'1×',x+w-80,y,80,dark);y+=56
  write(scene,'Presentation · '+model['phase']['kind'],x,y,12,c['muted'],w);y+=25
  at=model['frame'].get('at');write(scene,'Source snapshot · no model clock' if at is None else 'Source event · '+str(at)+' ms',x,y,12,c['muted'],w);y+=26
 else:y+=write(scene,model.get('source','Source-backed design study'),x,y,12,c['muted'],w,19.2)+10
 scene=scene.crop((0,0,model['width'],min(5000,math.ceil(y+24))));fid=model['frame']['id'] if model['type']=='motion' else model['id']+'-'+model.get('mode','populated');name=model['type']+'-'+model['id']+'-'+fid+'-'+str(model['width'])+'-'+('dark' if dark else 'light')+'.png'
 # Publish complete PNG bytes atomically; partial file visibility is not a
 # product-rendering failure, and invalid images cannot count as visual QA.
 encoded=io.BytesIO();scene.convert('RGB').save(encoded,format='PNG');fd,tmp=tempfile.mkstemp(suffix='.png',dir=out)
 with os.fdopen(fd,'wb') as handle:handle.write(encoded.getvalue());handle.flush();os.fsync(handle.fileno())
 os.replace(tmp,out/name)
 case={'path':str(out/name),'type':model['type'],'scene':model['id'],'frame':fid,'width':model['width'],'theme':'dark' if dark else 'light','height':scene.height}
 if recheck:report['cases']=[c for c in report['cases'] if c['path']!=case['path']];report['rechecked_cases'].append(case['path'])
 report['cases'].append(case)
 return scene,case

def fact_card(scene,title,records,x,y,w,dark):
 c=colors(dark);heights=[18+6+len(text_lines(v,17,w-36))*23.8+18 for _,v in records];h=54+sum(heights)
 surface(scene,x,y,w,h,18,dark);write(scene,title,x+18,y+18,17,c['ink'],w-36);fy=y+52
 for (label,value),rh in zip(records,heights):write(scene,label,x+18,fy,12,c['muted'],w-36);write(scene,value,x+18,fy+24,17,c['ink'],w-36,23.8);fy+=rh
 return h

def table(scene,rows,x,y,w,dark,headers=None):
 c=colors(dark);cols=len(rows[0]) if rows else 2;cw=(w-24)/cols;fy=y
 if headers:
  for i,h in enumerate(headers):write(scene,h,x+12+i*cw,fy,12,c['muted'],cw-16)
  fy+=30
 for row in rows:
  rh=max(len(text_lines(value,13,cw-16))*20.15 for value in row)+22
  ImageDraw.Draw(scene).line((x,fy,x+w,fy),fill=c['line']);
  for i,value in enumerate(row):write(scene,value,x+12+i*cw,fy+11,13,c['ink'],cw-16,20.15)
  fy+=rh
 return fy-y

def packet_layout(fields,w,size):
 inner=w-40;columns=max(1,math.floor((inner+20)/140));cw=(inner-20*(columns-1))/columns;rows=[];pending=[]
 for f in fields:
  if font(size).getlength(str(f['value']))>cw-16:
   if pending:rows.append(pending);pending=[]
   rows.append([(f,inner)])
  else:
   pending.append((f,cw))
   if len(pending)==columns:rows.append(pending);pending=[]
 if pending:rows.append(pending)
 layout=[];y=0
 for row in rows:
  h=max(len(text_lines(f['label'],12,fw-16))*18+6+len(text_lines(f['value'],size,fw-16))*size*1.35+24 for f,fw in row);x=0
  for f,fw in row:layout.append((f,x,y,fw,h));x+=fw+20
  y+=h
 return layout,y

def draw_packet(scene,model,x,y,w,dark):
 c=colors(dark);f=model['frame'];size=18 if model['width']<=480 else 20;layout,fh=packet_layout(f.get('fields',[]),w,size)
 payload=f['state'].get('segments') if model['id']=='packetOps' else None
 chunks=next((s['bytes'] for s in payload if s['id']=='payload'),[]) if payload else []
 ncols=max(1,math.floor((w-40+8)/158));nchunks=math.ceil(len(chunks)/16);cw=(w-40-(ncols-1)*8)/ncols
 chunk_rows=[]
 for off in range(0,len(chunks),16):chunk_rows.append((off,''.join(chr(v) for v in chunks[off:off+16])))
 ch=52+math.ceil(nchunks/ncols)*69 if chunks else 0
 h=40+40+fh+ch;ey=y
 if model['id']=='packetOps':
  label='Ethernet II · 14 B';direction='02:48:4f:50:00:01 → 02:48:4f:50:00:02';eh=28+19.5+max(0,len(text_lines(direction,12,w-40))*18);gap=7 if f['operation'] in ['attach','detach'] else 0
  surface(scene,x,y,w,eh,18,dark,True);write(scene,label,x+20,y+14,13,c['ink'],w-40);write(scene,direction,x+20,y+36,12,c['material'],w-40,18);ey=y+eh+gap
 physical=f.get('physical') or f.get('local')==False
 surface(scene,x,ey,w,h,24,dark,physical,hue=model.get('paletteHue',0) if physical else 0);write(scene,f.get('objectTitle','Packet'),x+20,ey+20,18,c['ink'],w-40);fy=ey+60;positions={}
 for fld,fx,ry,fw,rh in layout:
  xx=x+20+fx;yy=fy+ry+12;lh=write(scene,fld['label'],xx+8,yy,12,c['material'],fw-16,18);vy=yy+lh+6
  write(scene,fld['value'],xx+8,vy,size,c['ink'],fw-16,size*1.35);positions[fld['id']]=(xx+8,vy,fw-16,size*1.35)
  ImageDraw.Draw(scene).line((xx,fy+ry+rh,xx+fw,fy+ry+rh),fill=(120,144,175,65))
 if chunks:
  cy=fy+fh+16;write(scene,'Application data · exact source bytes',x+20,cy,12,c['material'],w-40);cy+=30
  for i,(off,text) in enumerate(chunk_rows):
   xx=x+20+i%ncols*(cw+8);yy=cy+i//ncols*69;layer=Image.new('RGBA',scene.size);ImageDraw.Draw(layer).rounded_rectangle((xx,yy,xx+cw,yy+61),radius=12,fill=(34,44,59,58) if dark else (245,250,255,86));scene.alpha_composite(layer);write(scene,str(off)+'–'+str(off+len(text)-1),xx+12,yy+9,12,c['material'],cw-24);write(scene,text,xx+12,yy+31,12,c['ink'],cw-24,18)
 if model.get('lens') and model['lens']['id'] in positions:
  # Native glyph bounds determine a skinny specimen; the actual motion planner
  # is separately tested in emitted JS. This is an analytical mid-read pose.
  xx,vy,fw,lineh=positions[model['lens']['id']];fld=next(f for f in f.get('fields',[]) if f['id']==model['lens']['id']);tw=min(fw,font(size).getlength(str(fld['value'])));p=model['lens']['p'];lx=xx+min(tw-1,max(0,tw*p));lw=31;lh=44;bx=round(lx-lw/2);by=round(vy-8);copy=scene.crop((bx,by,bx+lw,by+lh)).resize((round(lw*1.2),round(lh*1.2)),Image.Resampling.LANCZOS);copy=copy.crop(((copy.width-lw)//2,(copy.height-lh)//2,(copy.width+lw)//2,(copy.height+lh)//2));mask=Image.new('L',(lw,lh));ImageDraw.Draw(mask).rounded_rectangle((0,0,lw-1,lh-1),radius=13,fill=255);copy.putalpha(mask);scene.alpha_composite(copy,(bx,by));ImageDraw.Draw(scene).rounded_rectangle((bx,by,bx+lw,by+lh),radius=13,outline=c['line'],width=1)
 bottom=ey+h
 if model['id']=='packetOps':
  gap=7 if f['operation'] in ['attach','detach'] else 0;surface(scene,x,bottom+gap,w,52,18,dark);write(scene,'FCS · unavailable in model bytes',x+20,bottom+gap+16,12,c['muted'],w-40);bottom+=gap+52
 return bottom-y

def draw_failure(scene,model,x,y,w,dark):
 c=colors(dark);graph=data['failure']['graph'];height=max(260,w*.37);ns=copy.deepcopy(graph['nodes']);small=w<500
 for n in ns:n['text']=n['shortLabel'] if small else n['label'];n['w']=max(66,font(13).getlength(n['text'])+24)
 if small:
  margin=max(n['w']/2 for n in ns)+6;columns=max(2,math.floor(w/130));height=math.ceil(len(ns)/columns)*112+32
  for i,n in enumerate(ns):n['xx']=margin+i%columns*(w-2*margin)/(columns-1);n['yy']=40+i//columns*112
 else:
  for n in ns:n['xx']=n['x']/112*(w-92)+46;n['yy']=n['y']/72*(height-88)+44
 by={n['id']:n for n in ns};state=model['frame']['state'];active=['client-edge','edge-r2','r2-core','core-service'] if state['activePathId']=='alternate' else ['client-edge','edge-r1','r1-core','core-service'];draw=ImageDraw.Draw(scene)
 for edge in graph['links']:
  a,b=by[edge['from']],by[edge['to']];dx=b['xx']-a['xx'];dy=b['yy']-a['yy'];ta=1/max(abs(dx)/(a['w']/2),abs(dy)/22);tb=1/max(abs(dx)/(b['w']/2),abs(dy)/22);aa=(x+a['xx']+dx*ta,y+a['yy']+dy*ta);bb=(x+b['xx']-dx*tb,y+b['yy']-dy*tb);broken=edge['id'] in state['failedLinkIds'];draw.line((aa,bb),fill=c['red'] if broken else c['accent'] if edge['id'] in active else c['line'],width=2 if edge['id'] in active else 1)
  if broken:mx=(aa[0]+bb[0])/2;my=(aa[1]+bb[1])/2;draw.ellipse((mx-6,my-6,mx+6,my+6),fill=c['panel']);write(scene,'Down',mx+10,my-22,12,c['red'],80)
 for n in ns:
  xx=x+n['xx'];yy=y+n['yy'];draw.rounded_rectangle((xx-n['w']/2,yy-22,xx+n['w']/2,yy+22),radius=16,fill=c['panel'],outline=c['line']);write(scene,n['text'],xx-font(13).getlength(n['text'])/2,yy-9,13,c['ink'])
 return height

def draw_graph(scene,plan,x,y,w,h,dark,selected,camera=None,active=()):
 c=colors(dark);z=camera['z'] if camera else max(.85,min(1,w/plan['width'],h/plan['height']));ox=camera['x'] if camera else (w-plan['width']*z)/2;oy=camera['y'] if camera else (h-plan['height']*z)/2;clip=scene.crop((x,y,x+w,y+h));draw=ImageDraw.Draw(clip)
 for edge in plan['links']:
  points=[(px*z+ox,py*z+oy) for px,py in edge['points']];draw.line(points,fill=c['panel'],width=5);draw.line(points,fill=c['accent'] if edge['id'] in active else c['line'],width=2 if edge['id'] in active else 1)
 for n in plan['nodes']:
  xx=n['x']*z+ox;yy=n['y']*z+oy;nw=n['w']*z;nh=n['h']*z
  if xx+nw/2<0 or xx-nw/2>w or yy+nh/2<0 or yy-nh/2>h:continue
  draw.rounded_rectangle((xx-nw/2,yy-nh/2,xx+nw/2,yy+nh/2),radius=13,fill=c['panel'],outline=c['accent'] if n['id']==selected else c['line']);write(clip,n['label'],xx-font(12).getlength(n['label'])/2,yy-9,12,c['ink'])
 scene.paste(clip,(round(x),round(y)));my=y+h+14;mw=150;mh=96;ss=min((mw-16)/plan['width'],(mh-16)/plan['height']);draw=ImageDraw.Draw(scene)
 for e in plan['links']:draw.line([(x+8+px*ss,my+8+py*ss) for px,py in e['points']],fill=c['line'],width=1)
 for n in plan['nodes']:
  xx=x+8+n['x']*ss;yy=my+8+n['y']*ss;draw.ellipse((xx-2,yy-2,xx+2,yy+2),fill=c['accent'] if n['id']==selected else c['muted'])
 vx=x+8-ox/z*ss;vy=my+8-oy/z*ss;draw.rectangle((max(x+8,vx),max(my+8,vy),min(x+mw-8,vx+w/z*ss),min(my+mh-8,vy+h/z*ss)),outline=c['accent']);write(scene,'Complete topology',x+mw+12,my+12,12,c['ink'],w-mw-12);write(scene,'Drag to pan',x+mw+12,my+37,12,c['muted'],w-mw-12)
 return h+mh+24

def draw_globe(scene,model,x,y,w,dark):
 c=colors(dark);h=max(280,min(440,w*.72));canvas=Image.new('RGBA',(round(w),round(h)));draw=ImageDraw.Draw(canvas)
 # These path strings are from actual official d3-geo + published topology.
 # Render only M/L/Z paths; do not fabricate or approximate coastlines.
 mapping={'--hs-panel':c['panel'],'--hs-line':c['line'],'--hs-route-line':c['line'],'--hs-tint':'#15344d' if dark else '#d5eaf8','--hs-accent':c['accent'],'--rv-teal':c['teal'],'--hs-ink':c['ink']}
 for item in model['globe']:
  attrs=item['attrs'];tag=item['tag']
  def color(v):return mapping.get(v[4:-1],v) if v.startswith('var(') else v
  if tag=='path':
   for path in re.findall(r'M[^M]+',attrs['d']):
    vals=re.findall(r'-?\d+(?:\.\d+)?',path);points=list(zip(map(float,vals[::2]),map(float,vals[1::2])))
    if len(points)<2:continue
    fill=attrs.get('fill','none');stroke=attrs.get('stroke','none')
    if fill!='none' and len(points)>2:draw.polygon(points,fill=color(fill))
    if stroke!='none':draw.line(points,fill=color(stroke),width=1)
  elif tag=='circle':
   cx=float(attrs['cx']);cy=float(attrs['cy']);r=float(attrs['r']);draw.ellipse((cx-r,cy-r,cx+r,cy+r),fill=color(attrs['fill']))
  elif tag=='text':write(canvas,item['text'],float(attrs['x'])-(font(12).getlength(item['text']) if attrs.get('text-anchor')=='end' else 0),float(attrs['y'])-12,12,c['ink'])
 scene.alpha_composite(canvas,(round(x),round(y)));return h

def motion(model,dark):
 scene,x,y,w,c=new_scene(model,dark);id=model['id'];frame=model['frame']
 if id=='failure':y+=draw_failure(scene,model,x,y,w,dark)+18
 elif id=='http':
  stacked=w<500;cw=w if stacked else (w-18)/2
  for i,key in enumerate(['h2','h3']):
   xx=x if stacked else x+i*(cw+18);yy=y+(i*300 if stacked else 0);surface(scene,xx,yy,cw,282,18,dark);state=frame['state'][key];write(scene,state['transportLabel'],xx+18,yy+18,17,c['ink'],cw-36)
   for j,stream in enumerate(['A','B']):
    sy=yy+62+j*74;write(scene,'/hero.jpg' if stream=='A' else '/app.js',xx+18,sy,13,c['ink'],cw-36);write(scene,state['stream'+stream]+' · '+str(state['stream'+stream+'Progress'])+'%',xx+18,sy+24,12,c['muted'],cw-36);draw=ImageDraw.Draw(scene)
    for k in range(12):xxs=xx+18+k*(cw-36)/12;draw.rounded_rectangle((xxs,sy+47,xxs+(cw-36)/12-4,sy+66),radius=5,fill=c['accent'] if k<state['stream'+stream+'Progress']/100*12 else c['panel'])
   write(scene,state['deliveryLabel']+' · '+state['congestionLabel'],xx+18,yy+221,12,c['muted'],cw-36,18)
  y+=600 if stacked else 300
 else:
  peers=frame.get('endpoints',[frame.get('from','Sender'),frame.get('to','Receiver')]);button(scene,peers[0],x,y,135,dark);button(scene,peers[1],x+w-135,y,135,dark);y+=76
  if frame.get('lost'):
   button(scene,frame['objectTitle'],x+w*.42-52,y+28,104,dark);write(scene,'Lost before receipt',x,y+96,13,c['red'],w);y+=210
  else:y+=draw_packet(scene,model,x,y,w,dark)+24
 records=[(str(f['label']),str(f['value'])) for f in frame.get('records',[])];groups=[[r for r in records if r[0]!='Next expected byte'],[r for r in records if r[0]=='Next expected byte']] if id=='tcp' else [records[:math.ceil(len(records)/2)],records[math.ceil(len(records)/2):]] if len(records)>2 else [records]
 if records:
  stacked=w<500;cw=w if stacked else (w-18)/2;heights=[]
  for i,group in enumerate(groups):
   xx=x if stacked else x+i*(cw+18);yy=y+sum(heights)+18*i if stacked else y;heights.append(fact_card(scene,('Client · data sender' if i==0 else 'Server · data receiver') if id=='tcp' else ('Retained state' if i==0 else 'Context'),group,xx,yy,cw,dark))
  y+=sum(heights)+18*(len(groups)-1) if stacked else max(heights)
 return finish(scene,model,dark,y)

def builder(model,dark):
 scene,x,y,w,c=new_scene(model,dark)
 if model['id']=='topology':
  for i,label in enumerate(['Network','Workbench']):button(scene,label,x+i*(w/2+4),y,w/2-4,dark,i==0)
  y+=60;y+=draw_graph(scene,model['plan'],x,y,w,360,dark,model['selected']['id'])+18
  y+=fact_card(scene,'Selected device', [('Device',model['title']),('Contexts','Config · State · Events'),('Source','Canonical repository workbench')],x,y,w,dark)
 elif model['id']=='terminal':
  cli=model.get('cli',{});groups=cli.get('groups',[]);visible=next((g for g in groups if g['id']==model.get('selected',{}).get('id')),groups[0] if groups else None)
  button(scene,'show route',x,y,w-82,dark);button(scene,'Run',x+w-74,y,74,dark);y+=64
  y+=write(scene,cli.get('command','show route'),x,y,17,c['ink'],w)+12;y+=write(scene,str(cli.get('count',0))+' source records · '+str(len(groups))+' devices',x,y,12,c['muted'],w)+24
  for group in groups:
   y+=write(scene,('▾ ' if group==visible else '▸ ')+group['id'].upper()+' · '+str(len(group['rows']))+' records',x,y,14,c['ink'],w)+26
   if group==visible:
    for row in group['rows']:
     cw=(w-24)/2;lh=write(scene,row['Fact'],x+8,y,14,c['ink'],cw-12);rh=write(scene,row['Value'],x+cw+16,y,14,c['ink'],cw-12);y+=max(lh,rh)+8;y+=write(scene,row.get('Note',''),x+8,y,12,c['muted'],cw-12,18)+18;ImageDraw.Draw(scene).line((x,y,x+w,y),fill=c['line']);y+=16
  y+=write(scene,'▸ Exact command transcript',x,y,14,c['ink'],w)+28
 else:
  rows=model.get('rows',[]);visible=[row for row in rows if not any(z in row[0] for z in ['Why','Item'])][:8]
  # Systems now disclose nested source records. The audit shows closed native
  # summaries plus one representative source record; deep rows are not flattened.
  headers=model.get('headings',[])[:8]
  if headers:
   for heading in headers:write(scene,'▸ '+heading,x,y,14,c['ink'],w,21);y+=48
  elif visible:y+=table(scene,visible,x,y,w,dark,['Fact','Value'])
  else:y+=write(scene,'No entries in this source state.',x,y,13,c['muted'],w)+30
 return finish(scene,model,dark,y)

def evidence(model,dark):
 scene,x,y,w,c=new_scene(model,dark);id=model['id'];split=w>760;pw=w-294 if split else w
 y+=write(scene,model['source'],x,y,12,c['muted'],w,19.2)+24;top=y
 if model.get('mode')=='empty':
  y+=write(scene,model['emptyTitle'],x,y,21,c['ink'],w,29)+12;y+=write(scene,model['emptyDetail'],x,y,13,c['muted'],w,20.8)+100
  y+=fact_card(scene,'Availability',[('State','No evidence loaded'),('Acquisition','Explicit only'),('Time','No evidence timestamp')],x,y,w,dark);return finish(scene,model,dark,y)
 if model.get('mode')=='error':
  y+=write(scene,'Acquisition did not replace the evidence.',x,y,17,c['red'],w,24)+8;y+=write(scene,model.get('errorDetail','The valid source remains available.'),x,y,13,c['red'],w,20.8)+20;top=y
 if id=='measured':
  state=model['snapshot']['measured'];category=model['snapshot']['category'];facts=[f for f in state['snapshot']['facts'] if f['category']==category];rows=[(f['subject'],str(f.get('value','Not available')),f['availability']) for f in facts];y+=table(scene,rows,x,y,pw,dark,['Fact','Value','Availability'])
 elif id=='capture':
  frames=model['snapshot']['capture']['frames']
  if not frames:
   y+=write(scene,'This capture contains no frames.',x,y,21,c['ink'],pw)+16;y+=write(scene,'The file header parsed successfully. There are no captured timestamps or bytes to inspect.',x,y,13,c['muted'],pw,20.8)+24;y+=write(scene,model.get('clock','No captured frame timestamp'),x,y,12,c['muted'],pw)+24
  else:
   f=frames[model['snapshot']['frameIndex']];layer=f['layers'][model['snapshot'].get('layerIndex',0)];fields=[{'id':fld['id'],'label':fld['label'],'value':fld['displayValue']} for fld in layer['fields']];pseudo={'id':'capture','width':model['width'],'frame':{'objectTitle':layer['label']+' · '+layer['status'],'fields':fields,'state':{}}};y+=draw_packet(scene,pseudo,x,y,pw,dark)+18
   bytes=model['snapshot']['captureBytes'][model['snapshot']['frameIndex']];cols=max(1,math.floor(pw/48));window=model['snapshot'].get('byteWindow',{'start':0,'capacity':len(bytes)});start=window['start'];shown=bytes[start:start+window['capacity']];draw=ImageDraw.Draw(scene)
   y+=write(scene,'Offsets '+str(start)+'–'+str(start+len(shown)-1)+' · '+str(len(bytes))+' captured bytes',x,y,12,c['muted'],pw)+26
   if len(shown)<len(bytes):button(scene,'Previous bytes',x,y,140,dark);button(scene,'Next bytes',x+pw-140,y,140,dark);y+=60
   for i,b in enumerate(shown):
    xx=x+(i%cols)*(pw/cols);yy=y+(i//cols)*44;write(scene,format(b,'02X'),xx+9,yy+12,13,c['ink'],pw/cols-12)
   y+=math.ceil(len(shown)/cols)*44+16;y+=write(scene,str(f['record']['capturedLength'])+' captured / '+str(f['record']['originalLength'])+' original bytes',x,y,12,c['muted'],pw)+22
 elif id=='observed':
  o=model['observed'];cw=pw if pw<500 else (pw-18)/2;islands=[('Request edge',[('Fixture AS',o['edge']['asn']),('Transport',o['edge']['transport']),('RTT',str(o['edge']['transportRttMs'])+' ms')]),('Destination context',[('Fixture hostname',o['destination']['hostname']),('Address',o['destination']['selectedAddress'])])];heights=[]
  for i,(title,facts) in enumerate(islands):
   yy=y+sum(heights)+18*i if pw<500 else y;heights.append(fact_card(scene,title,[(a,str(b)) for a,b in facts],x if pw<500 else x+i*(cw+18),yy,cw,dark))
  y+=sum(heights)+18 if pw<500 else max(heights)+18;y+=write(scene,'Forwarding path · unobserved',x,y,17,c['ink'],pw)+10;y+=write(scene,o['bridge']['note'],x,y,13,c['muted'],pw,20.8)+24
  for p in o['collectorPaths']:y+=fact_card(scene,p['sourceId'],[('Independent collector',' → '.join('AS'+str(a) for a in p['asPath'])),('Prefix',p['targetPrefix'])],x,y,pw,dark)+18
 elif id=='physical':y+=draw_globe(scene,model,x,y,pw,dark)+20;y+=write(scene,'160 synthetic fixture facilities · published basemap',x,y,12,c['muted'],pw)+30
 else:y+=draw_graph(scene,model['plan'],x,y,pw,360,dark,'64496',model.get('camera'),model.get('active',[]))+18;y+=write(scene,'Simulated policy paths retain exact relationships.',x,y,13,c['muted'],pw)+24
 # Selected evidence content is composed from the source tree's dt/dd pairs.
 facts=model.get('detailFacts',[])
 if split:
  ih=fact_card(scene,model['detailTitle'],facts or [('Provenance','Source fixture')],x+pw+24,top,270,dark);y=max(y,top+ih)
 else:
  # In the actual mobile study the second pane uses the same reserved area.
  button(scene,'Scene',x,y,pw/2-4,dark,True);button(scene,'Details',x+pw/2+4,y,pw/2-4,dark);y+=56
 return finish(scene,model,dark,y)

images=[]
for model in models:
 # Cover all 37 source selections at desktop in Light. Dark focuses on material,
 # dense source/system, geography and evidence; mobile covers both appearances.
 themes=[False]
 if model['width']==390:
  if model['type']=='builder' and model['id'] not in ['topology','terminal','routing','provider','nat','workbench']:continue
  themes=[False,True]
 elif (model['type']=='motion' and model['id'] in ['tcp','packetOps','failure']) or model['type']=='evidence':themes=[False,True]
 for dark in themes:
  fid=model['frame']['id'] if model['type']=='motion' else model['id']+'-'+model.get('mode','populated');path=str(out/(model['type']+'-'+model['id']+'-'+fid+'-'+str(model['width'])+'-'+('dark' if dark else 'light')+'.png'))
  if recheck and not (model['type']=='motion' and model['id']=='tcp') and path not in bad_paths:continue
  images.append((globals()[model['type']](model,dark)))

def sheet(items,name,columns=4,thumb=210):
 rh=560;canvas=Image.new('RGB',(columns*(thumb+16)+16,math.ceil(len(items)/columns)*(rh+38)+16),'#151920');draw=ImageDraw.Draw(canvas)
 for i,(img,case) in enumerate(items):
  x=16+i%columns*(thumb+16);y=16+i//columns*(rh+38);draw.text((x,y),case['scene']+' · '+case['theme'],font=font(13),fill='#eef1f6');scale=min(thumb/img.width,rh/img.height);im=img.resize((round(img.width*scale),round(img.height*scale)),Image.Resampling.LANCZOS);canvas.paste(im,(x,y+26))
 canvas.save(out/name)

if recheck:sheet(images,'followup-final-sheet.png')
elif extra_only:sheet(images,'capture-details-sheet.png')
else:
 sheet([im for im in images if im[1]['type']=='motion' and im[1]['width']==1024],'motion-desktop-sheet.png');sheet([im for im in images if im[1]['type']=='builder' and im[1]['width']==1024],'builder-desktop-sheet.png');sheet([im for im in images if im[1]['type']=='evidence'],'evidence-sheet.png');sheet([im for im in images if im[1]['type']=='motion' and im[1]['width']==390],'motion-mobile-sheet.png')
Path('complete-review/native-composition-audit.json').write_text(json.dumps(report,indent=2));print(json.dumps({'cases':len(report['cases']),'text_bounds':len(report['text_bounds']),'directory':str(out)}))
