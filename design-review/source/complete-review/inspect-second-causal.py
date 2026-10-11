from pathlib import Path
import json,io,os,tempfile
prefix=Path('complete-review/inspect-design-matrix.py').read_text().split('# Main constructors remain bounded')[0]
exec(prefix)
audit_dir=Path(os.environ.get('HOPSCOTCH_AUDIT_DIR','complete-review/second-audit'))
bundle=json.loads((audit_dir/'causal-compositions.json').read_text());models=bundle['models'];out=audit_dir/'causal-native';out.mkdir(exist_ok=True)
metadata={'titles':{m['id']:m['title'] for m in models},'summaries':{m['id']:m['summary'] for m in models}}
report={'kind':'Fresh emitted source states and shader, synthetic glyph metrics, analytical layout and substitute fonts; source-based poses, not live browser intermediate-pixel verification','manifest':bundle['manifest'],'cases':[],'text_bounds':[]}
pages={};images=[]
def causal_controls(scene,model,dark,y):
 x=16 if model['width']<=480 else 26;w=model['width']-2*x;c=colors(dark);pad=18;inner=w-2*pad;start=y+24
 title=model['frame']['title'];summary=model['frame']['summary'];th=len(text_lines(title,16,inner))*22.4;sh=len(text_lines(summary,13,inner))*20.8
 controls=112 if inner<500 else 56;h=pad+th+6+sh+18+controls+51+pad
 surface(scene,x,start,w,h,18,dark,False,density=.15,depth=.24);xx=x+pad;yy=start+pad
 yy+=write(scene,title,xx,yy,16,c['ink'],inner,22.4)+6;yy+=write(scene,summary,xx,yy,13,c['muted'],inner,20.8)+18
 if inner<500:
  bw=(inner-16)/3
  for i,label in enumerate(['Play','Replay','Next event']):button(scene,label,xx+i*(bw+8),yy,bw,dark)
  yy+=56;button(scene,str(model['index']+1)+' / '+str(len(model['allFrames']))+' · '+model['frame']['id'],xx,yy,inner,dark);yy+=56
 else:
  for i,label in enumerate(['Play','Replay','Next event']):button(scene,label,xx+i*120,yy,110,dark)
  button(scene,model['frame']['id'],xx+360,yy,inner-450,dark);button(scene,'1×',xx+inner-80,yy,80,dark);yy+=56
 write(scene,'Presentation · '+model['phase']['kind'],xx,yy,12,c['muted'],inner);yy+=25;at=model['frame'].get('at');write(scene,'Source snapshot · no model clock' if at is None else 'Source event · '+str(at)+' ms',xx,yy,12,c['muted'],inner)
 return start+h+24
def finish(scene,model,dark,y):
 scene=scene.crop((0,0,model['width'],math.ceil(y+24)));fid=model['frame']['id'];path=out/('motion-'+model['id']+'-'+fid+'-'+str(model['width'])+'-'+('dark' if dark else 'light')+'.png')
 encoded=io.BytesIO();scene.convert('RGB').save(encoded,format='PNG');payload=encoded.getvalue()
 with Image.open(io.BytesIO(payload)) as im:im.verify()
 fd,tmp=tempfile.mkstemp(dir=out,suffix='.png')
 with os.fdopen(fd,'wb') as f:f.write(payload);f.flush();os.fsync(f.fileno())
 os.replace(tmp,path)
 case={'path':str(path),'type':'motion','scene':model['id'],'frame':fid,'width':model['width'],'theme':'dark' if dark else 'light','height':scene.height};report['cases'].append(case);return scene,case
motion_source=Path('complete-review/inspect-complete.py').read_text().split('def motion(model,dark):')[1].split('\ndef builder(')[0]
motion_source=motion_source.replace(' if records:\n',' y=causal_controls(scene,model,dark,y)\n if records:\n')
exec('def motion(model,dark):'+motion_source)
for model in models:
 for dark in [False,True]:images.append(motion(model,dark))
print('Current causal analytical cases',len(images),flush=True)
(audit_dir/'causal-native-audit.json').write_text(json.dumps(report,indent=2))
