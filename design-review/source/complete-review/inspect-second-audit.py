from pathlib import Path
import json,math,io,re,os,tempfile
from xml.sax.saxutils import escape

# Native analytical composition only. This is not browser execution or CSS
# layout. Current runtime trees, roles, graph coordinates and SVG paths are used.
prefix=Path('complete-review/inspect-final-compositions.py').read_text().split('for model in models:')[0]
exec(prefix)
audit_dir=Path(os.environ.get('HOPSCOTCH_AUDIT_DIR','complete-review/second-audit'))
bundle=json.loads((audit_dir/'compositions.json').read_text())
models=bundle['models'];out=audit_dir/'native';out.mkdir(exist_ok=True)
report={'kind':'Fresh emitted-runtime text/roles/graph camera, native source material shader, analytical layout and DejaVu fonts; not browser/intermediate-motion acceptance','manifest':bundle['manifest'],'cases':[],'text_bounds':[],'pixel_rewrites':[]}
basic_render=render_node
current=None
for dark in [False,True]:
 for selector in ['#hop-causal-review']+(['#hop-causal-review[data-theme=dark]'] if dark else []):
  for sel,body in re.findall(r'([^{}]+)\{([^{}]*)\}',css):
   if sel.strip()==selector:
    styles[dark].update({k:v for k,v in re.findall(r'(--[\w-]+):([^;{}]+)',body) if k in ['--hs-panel','--hs-line','--hs-tint','--hs-accent']})
base_text_lines=text_lines
def text_lines(text,size,width):
 # Pillow interprets embedded newlines itself. Split them before measuring so
 # measured row height and rendered line positions cannot disagree.
 return [line for paragraph in str(text).split('\n') for line in base_text_lines(paragraph,size,width)]
def cell_content(cell,scene,x,y,w,dark):
 # Source table cells use normal whitespace; only explicit pre/terminal text
 # preserves newlines. Do not accidentally simulate a multiline table value.
 if cell.get('text'):y=block(scene,' '.join(cell['text'].split()),x,y,w,13,dark)
 for child in cell.get('children',[]):
  content=txt(child) if child['tag']=='pre' else ' '.join(txt(child).split())
  y=block(scene,content,x,y,w,12 if child['tag']=='small' else 13,dark,child['tag']=='small')+(5 if child['tag']=='small' else 0)
 return y

def render_header(n,scene,x,y,w,dark):
 groups=n['children'];identity=groups[0];tools=groups[1]
 labels=[txt(c) for c in identity['children']]
 if scene is not None:
  block(scene,labels[0],x,y+10,105,12,dark)
  if len(labels)>1:block(scene,labels[1],x+110,y+10,max(80,w-200),12,dark,True)
 # The source header uses intrinsic flex slots. Reserve the actual font width
 # of its context label, not a characters-times-five estimate that can place
 # the Appearance label on top of "Network Builder" in analytical exports.
 identity_width=110+(font(12).getlength(labels[-1]) if len(labels)>1 else 0)
 row=y+46 if w<500 else y;xx=x if w<500 else x+max(140,identity_width+20)
 bottom=row+44
 for child in tools['children']:
  if child['tag']=='label':
   select=next((c for c in child['children'] if c['tag']=='select'),None)
   if select:
    label=child['text'];choice=next((c for c in select['children'] if c['value']==select['value']),select['children'][0]);value=('Dark' if dark else 'Light') if has(select,'rv-theme') else txt(choice)
    lw=max(52,font(12).getlength(label)+12);cw=min(w-lw,max(90,min(230,font(13).getlength(value)+32)));total=lw+cw
    if xx+total>x+w:xx=x;row=bottom+8
    if scene is not None:block(scene,label,xx,row+11,lw,12,dark,True)
    control(scene,value,xx+lw,row,cw,dark);bottom=max(bottom,row+44);xx+=total+16;continue
  cw=min(w,max(80,font(13).getlength(txt(child))+28))
  if xx+cw>x+w:xx=x;row=bottom+8
  bottom=max(bottom,control(scene,txt(child),xx,row,cw,dark));xx+=cw+16
 return bottom+32

def network(scene,x,y,w,dark):
 data=current.get('network');h=(data or {}).get('viewport',{}).get('h',380)
 if scene is None or not data:return y+h+12
 plan=data['plan'];cam=data['camera'];z=cam['z'];tile=scene.crop((round(x),round(y),round(x)+round(w),round(y)+round(h)));draw=ImageDraw.Draw(tile)
 for link in plan['links']:
  pts=[(p[0]*z+cam['x'],p[1]*z+cam['y']) for p in link['points']]
  state=data.get('edgeStates',{}).get(link['id']);color=colorvar(dark,'--rv-red' if link.get('failed') or state=='stopped' else '--hs-accent' if state=='path' else '--hs-route-line')
  if state=='context':color=(*color[:3],round(color[3]*.35))
  draw.line(pts,fill=color,width=max(1,round((2.6 if state in ('stopped','path') else 1.2)*z)))
 for n in plan['nodes']:
  left=(n['x']-n['w']/2)*z+cam['x'];top=(n['y']-n['h']/2)*z+cam['y'];nw=n['w']*z;nh=n['h']*z
  if left+nw<0 or top+nh<0 or left>w or top>h:continue
  active=n['id']==data['selected'];fill='--rv-selected-fill' if active else '--rv-control-fill';ink='--rv-selected-ink' if active else '--hs-ink'
  rim='--rv-red' if n['id'] in data.get('boundaryNodes',[]) else '--hs-accent' if n['id'] in data.get('pathNodes',[]) else '--rv-control-rim'
  draw.rounded_rectangle((left,top,left+nw,top+nh),radius=n.get('radius',15)*z,fill=colorvar(dark,fill),outline=colorvar(dark,rim))
  lines=text_lines(n['label'],max(11,round(14*z)),max(1,nw-20*z));yy=top+(nh-len(lines)*19*z)/2
  for line in lines:
   size=max(11,round(14*z));tw=font(size).getlength(line);draw.text((left+(nw-tw)/2,yy),line,font=font(size),fill=colorvar(dark,ink));yy+=19*z
 scene.alpha_composite(tile,(round(x),round(y)));return y+h+12

def globe(scene,x,y,w,dark):
 h=max(280,min(440,w*.72))
 if scene is not None and current.get('globe'):
  import fitz
  parts=[]
  for item in current['globe']:
   attrs={}
   for k,v in item['attrs'].items():
    if k=='class':continue
    value=str(v);m=re.fullmatch(r'var\((--[\w-]+)\)',value)
    if m:
     assert m[1] in styles[dark],('Missing native vector theme role',m[1])
     value=styles[dark][m[1]]
     if value.startswith('rgba('):
      c=rgba(value);value='#'+''.join(f'{round(channel*255):02x}' for channel in c[:3]);attrs[k+'-opacity']=str(c[3])
    attrs[k]=value
   parts.append('<'+item['tag']+' '+ ' '.join(k+'="'+escape(v)+'"' for k,v in attrs.items())+'>'+escape(str(item.get('text','')))+'</'+item['tag']+'>')
  svg='<svg xmlns="http://www.w3.org/2000/svg" font-family="sans-serif" width="'+str(w)+'" height="'+str(h)+'">'+''.join(parts)+'</svg>'
  doc=fitz.open(stream=svg.encode(),filetype='svg');pix=doc[0].get_pixmap(alpha=True);image=Image.frombytes('RGBA',(pix.width,pix.height),pix.samples);doc.close();scene.alpha_composite(image,(round(x),round(y)))
 return y+h+16

def render_node(n,scene,x,y,w,dark,depth=0):
 if n is None:return y
 if n.get('kind')=='globe':return globe(scene,x,y,w,dark)
 if has(n,'rv-header'):return render_header(n,scene,x,y,w,dark)
 if has(n,'cx-preset-list') or has(n,'cx-featured'):
  # Follow the source auto-fit minimum (240px), not one column per record.
  children=n['children'];gap=16;cols=max(1,min(len(children),math.floor((w+gap)/(240+gap))));cw=(w-gap*(cols-1))/cols
  for start in range(0,len(children),cols):
   bottom=y
   for i,child in enumerate(children[start:start+cols]):bottom=max(bottom,render_node(child,scene,x+i*(cw+gap),y,cw,dark,depth+1))
   y=bottom+gap
  return y+8
 if any(has(n,cls) for cls in ['rv-tabbar','rv-pane-toggle','wb-graph-toolbar']):
  adapted={**n,'cls':n['cls']+' rv-controls'};return basic_render(adapted,scene,x,y,w,dark,depth)
 if has(n,'wb-map') or has(n,'ev-map'):return network(scene,x,y,w,dark)
 if has(n,'rv-network-world'):return y
 if has(n,'rv-console'):
  pad=18;end=y+pad
  for child in n['children']:end=render_node(child,None,x+pad,end,w-2*pad,dark,depth+1)
  h=end-y+pad
  if scene is not None:surface(scene,x,y,w,h,18,dark,False,density=.15,depth=.24)
  yy=y+pad
  for child in n['children']:yy=render_node(child,scene,x+pad,yy,w-2*pad,dark,depth+1)
  return y+h+20
 if (has(n,'rv-content-layout') or has(n,'cx-content-layout')) and current.get('paneMode'):
  if current['paneMode']=='exclusive':
   index=1 if current.get('pane') in ['detail','workbench'] else 0
   return render_node(n['children'][index],scene,x,y,w,dark,depth+1)+20
  detail=max(280,(w-24)*.42/1.42);widths=[w-24-detail,detail];xx=x;end=y
  for child,cw in zip(n['children'],widths):end=max(end,render_node(child,scene,xx,y,cw,dark,depth+1));xx+=cw+24
  return end+20
 return basic_render(n,scene,x,y,w,dark,depth)

for index,model in enumerate(models):
 current=model
 for dark in [False,True]:
  width=model['width'];pad=16 if width<=480 else 26;w=width-2*pad;y=16
  y=render_header(model['header'],None,pad,y,w,dark);end=render_node(model['body'],None,pad,y,w,dark)+24
  assert end<30000,(model['id'],end)
  path=out/(model['family']+'-'+model['id']+'-'+str(width)+'-'+('dark' if dark else 'light')+'.png');valid=False
  if path.exists() and not os.environ.get('HOPSCOTCH_FORCE_RENDER') and not(model['family']=='builder' and model['id']=='systems-cli' or model['family']=='connected' and model['id']=='catalog' or model['family']=='evidence' and model['id'].startswith('physical')):
   try:
    with Image.open(path) as im:im.verify()
    with Image.open(path) as im:im.load();valid=im.size==(width,math.ceil(end))
   except Exception:pass
  if not valid:
   scene=analytic_page(width,math.ceil(end),dark);y=render_header(model['header'],scene,pad,16,w,dark);render_node(model['body'],scene,pad,y,w,dark)
   encoded=io.BytesIO();scene.convert('RGB').save(encoded,format='PNG');payload=encoded.getvalue()
   with Image.open(io.BytesIO(payload)) as im:im.verify()
   fd,tmp=tempfile.mkstemp(dir=out,suffix='.png')
   with os.fdopen(fd,'wb') as f:f.write(payload);f.flush();os.fsync(f.fileno())
   os.replace(tmp,path);report['pixel_rewrites'].append(str(path))
  report['cases'].append({'family':model['family'],'id':model['id'],'width':width,'theme':'dark' if dark else 'light','height':math.ceil(end),'path':str(path)})
 if (index+1)%12==0:print('Rendered current selections',index+1,flush=True)
assert len({c['path'] for c in report['cases']})==len(report['cases'])
for case in report['cases']:
 with Image.open(case['path']) as im:im.verify()
(audit_dir/'native-audit.json').write_text(json.dumps(report,indent=2));print('Native analytical cases',len(report['cases']),flush=True)
