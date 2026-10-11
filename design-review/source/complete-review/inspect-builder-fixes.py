from pathlib import Path
import json,math
prefix=Path('complete-review/inspect-design-matrix.py').read_text().split('# Main constructors remain bounded')[0]
exec(prefix)
models=json.loads(Path('complete-review/builder-fix-compositions.json').read_text())
out=Path('complete-review/builder-fix-native');out.mkdir(exist_ok=True)
report={'kind':'Native analytical layouts with actual emitted geometry, source content and theme tokens; substitute fonts. Not browser screenshots or CSS/motion-compositing acceptance.','cases':[],'text_bounds':[]}
def label(scene,text,x,y,width,dark,size=13,muted=False):
 return write(scene,text,x,y,size,styles[dark]['--hs-muted' if muted else '--hs-ink'],width,size*1.55)
def nodeface(scene,n,x,y,z,dark):
 w,h=n['w']*z,n['h']*z;r=n['radius']*z
 layer=scene.crop((round(x),round(y),round(x+w),round(y+h))).filter(ImageFilter.GaussianBlur(12));layer=Image.alpha_composite(layer,Image.new('RGBA',layer.size,colorvar(dark,'--rv-control-fill')))
 mask=Image.new('L',layer.size);ImageDraw.Draw(mask).rounded_rectangle((0,0,w-1,h-1),radius=r,fill=255);layer.putalpha(mask);scene.alpha_composite(layer,(round(x),round(y)))
 ImageDraw.Draw(scene).rounded_rectangle((x,y,x+w-1,y+h-1),radius=r,outline=colorvar(dark,'--rv-control-rim'),width=1)
 size=14*z;tw=font(round(size)).getlength(n['label']);label(scene,n['label'],x+(w-tw)/2,y+(h-size*1.55)/2,w,dark,size)
def graph(scene,model,x,y,w,h,dark):
 plan=model['plan'];cam=model['camera'];z=cam['z'];w=min(w,model['viewport']['w']);h=model['viewport']['h'];tile=scene.crop((round(x),round(y),round(x+w),round(y+h)))
 def point(p):return (cam['x']+p[0]*z,cam['y']+p[1]*z)
 draw=ImageDraw.Draw(tile);ink=colorvar(dark,'--hs-route-line')
 for l in plan['links']:draw.line([point(p) for p in l['points']],fill=ink,width=max(1,round(1.2*z)))
 for hit in model['crossings']:
  pts=[point(p) for p in hit['points']];draw.line(pts,fill=colorvar(dark,'--hs-bg'),width=max(3,round(5*z)));draw.line(pts,fill=ink,width=1)
 for n in plan['nodes']:
  nx,ny=cam['x']+(n['x']-n['w']/2)*z,cam['y']+(n['y']-n['h']/2)*z
  if nx+n['w']*z<0 or nx>w or ny+n['h']*z<0 or ny>h:continue
  nodeface(tile,n,nx,ny,z,dark)
 scene.alpha_composite(tile,(round(x),round(y)))
for model in models:
 for dark in [False,True]:
  width=model['width'];pad=16 if width<=480 else 26;w=width-2*pad;header_h=154 if width<=480 else 76
  scene=analytic_page(width,1050 if width<=480 else 900,dark);y=20
  label(scene,'HOPSCOTCH',pad,y if width<=480 else y+9,w,dark,12)
  if width<=480:
   label(scene,'Network Builder',pad+110,y,140,dark,12,True);label(scene,'Appearance',pad,y+62,120,dark,12,True);button(scene,'Dark' if dark else 'Light',width-pad-96,y+48,96,dark)
  else:
   label(scene,'Network Builder',pad+110,y+9,160,dark,12,True);label(scene,'Appearance',width-225,y+9,100,dark,12,True);button(scene,'Dark' if dark else 'Light',width-pad-92,y-4,92,dark)
  y=header_h+28;label(scene,'Your network. Clear consequences.',pad,y,w,dark,27);y+=90 if width<=480 else 55
  label(scene,'Topology',pad,y,w,dark,13);y+=45;gh=380 if width<=480 else 410;graph(scene,model,pad,y,w,gh,dark);y+=gh+18
  label(scene,'6 devices · 7 links',pad,y,w,dark,12,True);y+=40
  # Status is a quieter supporting surface, with exactly one rounded owner.
  body_lines=text_lines(model['status']['detail'],13,w-36);sh=18+25+len(body_lines)*20.8+18+20+18
  surface(scene,pad,y,w,sh,18,dark,False,density=.15,depth=.18);label(scene,model['status']['title'],pad+18,y+18,w-36,dark,16);label(scene,model['status']['detail'],pad+18,y+48,w-36,dark,13,True);label(scene,model['status']['source'],pad+18,y+sh-38,w-36,dark,12,True);y+=sh+28
  label(scene,'Selection and reusable authoring tools',pad+24,y,w-24,dark,13);ImageDraw.Draw(scene).line([(pad+3,y+4),(pad+8,y+9),(pad+3,y+14)],fill=colorvar(dark,'--hs-muted'),width=2)
  path=out/('builder-'+str(width)+'-'+('dark' if dark else 'light')+'.png');scene.crop((0,0,width,min(scene.height,math.ceil(y+50)))).convert('RGB').save(path);report['cases'].append(str(path))
# A close view of actual rounded ports and connection paths, without browser styling.
for dark in [False,True]:
 model=models[-1];plan=model['plan'];r1=next(n for n in plan['nodes'] if n['id']=='r1');scene=analytic_page(600,380,dark);z=2.5;ox=300-r1['x']*z;oy=190-r1['y']*z;draw=ImageDraw.Draw(scene)
 for l in plan['links']:draw.line([(ox+p[0]*z,oy+p[1]*z) for p in l['points']],fill=colorvar(dark,'--hs-route-line'),width=3)
 nodeface(scene,r1,ox+(r1['x']-r1['w']/2)*z,oy+(r1['y']-r1['h']/2)*z,z,dark)
 path=out/('rounded-ports-'+('dark' if dark else 'light')+'.png');scene.convert('RGB').save(path);report['cases'].append(str(path))
Path('complete-review/builder-fix-native-audit.json').write_text(json.dumps(report,indent=2));print('Rendered',len(report['cases']),'native inspection cases')
