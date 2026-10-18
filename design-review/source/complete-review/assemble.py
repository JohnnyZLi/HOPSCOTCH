from pathlib import Path
import re,json,hashlib

def header_markup(kind, markup):
    """One header owns its identity/tool slots; studies supply semantic content."""
    old=re.search(r'<header class="rv-header".*?</header>',markup,re.S)[0]
    body=old[old.index('>')+1:old.rindex('</header>')]
    if kind=='connected':
        identity=re.search(r'<button.*?</button><span.*?</span>',body,re.S)[0]
        identity=identity.replace('cx-home cursor-interaction','rv-brand cx-home cursor-interaction').replace('cx-location','rv-header-context cx-location')
    else:
        identity='<span class="rv-brand">HOPSCOTCH</span>'
        if kind=='workbench':identity+='<span class="rv-header-context">Network Builder</span>'
    tools=body.replace(re.search(r'<button.*?</button><span.*?</span>',body,re.S)[0] if kind=='connected' else '<span class="rv-brand">HOPSCOTCH</span>','',1)
    tools=tools.replace('<span class="rv-eyebrow">Network Builder</span>','')
    return markup.replace(old,'<header class="rv-header" data-ui-surface="chrome"><div class="rv-header-identity">'+identity+'</div><div class="rv-header-tools">'+tools+'</div></header>')

base=Path('base-study.html').read_text()
css=re.search(r'<style>(.*?)</style>',base,re.S)[1]
script=re.search(r'<script>(.*?)</script>',base,re.S)[1]

def shared_rules(text):
    result=[];at=0
    while at<len(text):
        opening=text.find('{',at)
        if opening<0:break
        header=text[at:opening].strip();depth=1;end=opening+1
        while end<len(text) and depth:
            depth+=(text[end]=='{')-(text[end]=='}');end+=1
        body=text[opening+1:end-1]
        header=re.sub(r'/\*.*?\*/','',header,flags=re.S).strip()
        if header.startswith(('@media','@supports')):
            contents=shared_rules(body)
            if contents:result.append(header+'{'+contents+'}')
        elif 'hop-app-composition' in header and not any(other in header for other in ['hop-tcp-processing','hop-router-integrated','.hs-catalogue','.hs-workspace-entry']):
            result.append(header+'{'+body+'}')
        at=end
    return '\n'.join(result)

a=script.index("const root=document.getElementById('hop-tcp-processing')")
engine=script[:script.rfind('(()=>{',0,a)]
# Production home and workspaces share the same kernel and session recovery.
material_end=engine.index('})();',engine.index('app.packetMaterial=Object.freeze'))+len('})();')
material_engine=engine[:material_end]
workspace_engine='mountMaterialFoundation(element,scope);\n'+engine[material_end:]

def write_material_runtime(folder):
    source=material_engine.replace("document.getElementById('hop-app-composition')",'element')
    (folder/'material-runtime.js').write_text('// Generated from the approved shared packet material.\nexport function mountMaterialFoundation(element,scope){\nconst {document,window,matchMedia,requestAnimationFrame,cancelAnimationFrame,ResizeObserver,MutationObserver}=scope;\n'+source+'\n}\n')
record_start=script.index("(()=>{\n'use strict';\nconst root=document.getElementById('hop-app-composition');\nconst owners=")
records=script[record_start:]
records=records.replace("const owners=[...root.querySelectorAll('[data-ui-surface=\"record\"]')];", "let owners=[...root.querySelectorAll('[data-ui-surface=\"record\"]')];")
records=records.replace('function paint(){\n frame=0;', 'function paint(){\n frame=0;syncOwners();')
records=records.replace('function invalidate(){for(const e of entries.values())', '''function syncOwners(){const next=[...root.querySelectorAll('[data-ui-surface="record"]')],set=new Set(next);for(const [owner,entry]of entries)if(!set.has(owner)){resize.unobserve?.(owner);entry.canvas.remove();entries.delete(owner);}for(const owner of next)if(!owners.includes(owner))resize.observe(owner);owners=next;}
function invalidate(){for(const e of entries.values())''')

reader=script[script.index('// BEGIN ADAPTIVE ENGINE'):script.index('let scene=null')]
reader=reader.split('\n',1)[1]
fit_start=script.index('const fitPolicy=')
attachment=script[fit_start:script.index('const appearanceProfile=',fit_start)]
helpers="(()=>{const root=document.getElementById('__ROOT__');\n"+reader+attachment+"\nroot.motionPlanner=Object.freeze({clamp,ease,mix,policy,coverage,makePlan,samplePlan,remapTime,fitPolicy,fitGeometry,makeAttachmentPlan,attachmentState});})();"
graph_start=script.index('function hash(s){',script.index("const root=document.getElementById('hop-router-integrated')"))
graph_end=script.index('const policy=Object.freeze({zoom:',graph_start)
graph_code=script[graph_start:graph_end]
graph_code=graph_code.replace('n.w=Math.max(48,Math.ceil((measure(n.label)+20)/16)*16);const box=measure.box?.(n.label);','const box=measure.box?.(n.label);n.w=Math.max(48,Math.ceil((box?.w??(measure(n.label)+20))/16)*16);n.radius=box?.radius??15;')
graph_code=graph_code.replace('(Math.max(n.sides[0].length,n.sides[2].length)+1)*STEP/16','(2*(Math.floor(Math.max(n.sides[0].length,n.sides[2].length)/2)*STEP+n.radius+4))/16').replace('(Math.max(n.sides[1].length,n.sides[3].length)+1)*STEP/16','(2*(Math.floor(Math.max(n.sides[1].length,n.sides[3].length)/2)*STEP+n.radius+4))/16')
graph_code=graph_code.replace('measure=s=>s.length*7){const p=baseLayout(graph,measure);','measure=s=>s.length*7,authored=null){const p=authored?{positions:graph.nodes.map(n=>({...n,x:(authored[n.id]?.x??50)*6,y:(authored[n.id]?.y??50)*6}))}:baseLayout(graph,measure);').replace('function candidate(graph,measure,scale,reverse){const world=layout(graph,scale,measure)', 'function candidate(graph,measure,scale,reverse,authored=null){const world=layout(graph,scale,measure,authored)').replace('async function buildAsync(graph,measure,onProgress=()=>{})', 'async function buildAsync(graph,measure,onProgress=()=>{},authored=null)').replace('candidate(graph,measure,scale,reverse);if(c)options.push(c);', 'candidate(graph,measure,scale,reverse,typeof authored===\"undefined\"?null:authored);if(c)options.push(c);')
graph_helper="(()=>{const root=document.getElementById('__ROOT__');\n"+graph_code+"\nroot.networkPlanner=Object.freeze({build,buildAsync,layout,solve,audit,canonical});})();"
vertex=re.findall(r'const vertex=`(.*?)`;',base,re.S)[-1]
fragment=re.findall(r'const fragment=`(.*?)`;',base,re.S)[-1]

def assemble(kind,root_id,path,data):
    markup=header_markup(kind,Path(f'complete-review/{kind}.html').read_text())
    runtime=Path(f'complete-review/{kind}.js').read_text().replace('__VERTEX__','`'+vertex+'`').replace('__FRAGMENT__','`'+fragment.replace('hop-app-composition',root_id)+'`')
    material=Path('complete-review/shared-painter.js').read_text().replace('__VERTEX__','`'+vertex+'`').replace('__FRAGMENT__','`'+fragment.replace('hop-app-composition',root_id)+'`')
    replacements={'__ROOT__':root_id,'__SHARED_CSS__':shared_rules(css).replace('hop-app-composition',root_id),'__CSS__':Path('complete-review/review.css').read_text().replace('__ROOT__',root_id),
       '__SHARED__':engine.replace('hop-app-composition',root_id),'__HELPERS__':(helpers+graph_helper+Path('complete-review/shared-geometry.js').read_text().replace('export function','function')+Path('complete-review/shared-ui.js').read_text()+Path('complete-review/shared-network.js').read_text()+Path('complete-review/shared-reservation.js').read_text()+Path('complete-review/shared-bytes.js').read_text()).replace('hop-app-composition',root_id),'__PAINTER__':material,
       '__DATA__':Path('complete-review/shared-presentation.js').read_text()+"\n(()=>{const root=document.getElementById('__ROOT__');\n"+Path('complete-review/source-adapters.js').read_text().replace('export { journeyFrames, dnsFrames, providerFrames };','root.sourcePresentation=Object.freeze({journeyFrames,dnsFrames,providerFrames});')+"\n})();\ndocument.getElementById('__ROOT__').reviewData="+json.dumps(data,separators=(',',':'))+';',
       '__CONNECTED_CSS__':Path('complete-review/connected.css').read_text().replace('__ROOT__',root_id) if kind=='connected' else '',
       '__GEO__':Path('complete-review/d3-array.min.js').read_text()+'\n'+Path('complete-review/d3-geo.min.js').read_text() if kind=='evidence' else '', '__RUNTIME__':runtime,'__RECORDS__':records.replace('hop-app-composition',root_id),'__DOMAIN__':Path('complete-review/domain.bundle.js').read_text() if kind=='workbench' else Path('complete-review/evidence-domain.bundle.js').read_text() if kind=='evidence' else Path('complete-review/entry-domain.bundle.js').read_text() if kind=='connected' else ''}
    for k,v in replacements.items():markup=markup.replace(k,v)
    markup=markup.replace('__ROOT__',root_id)
    Path(path).write_text(markup)
    Path(f'complete-review/{kind}-compiled.js').write_text(re.search(r'<script>(.*?)</script>',markup,re.S)[1])
    return {'path':path,'bytes':len(markup.encode()),'sha256':hashlib.sha256(markup.encode()).hexdigest()}

def presentation_models(data):
    models=json.loads(Path('workspace-reference-models.json').read_text())['models']
    for model in models:
        key=model['id'];source=data.get(key,{})
        events=(source.get('miss',{}) if key=='dns' else source).get('frames',[])
        for index,frame in enumerate(model.get('frames',[])):
            event=events[index].get('event',{}) if index<len(events) else {}
            physical=key in ('packet','capture')
            if key in ('tcp','tls'):physical=event.get('direction') in ('client-to-server','server-to-client')
            if key=='dns':physical=bool(event) and event.get('from')!=event.get('to') and event.get('from')!='local' and not event.get('kind','').startswith('cache')
            frame['materialRole']='packet' if physical else 'operation'
            frame['protocolIdentity']=frame.get('objectTitle') if key in ('packet','capture') else event.get('protocol') or key
    return models

def integrated_runtime():
    """Compile the same renderer as a mountable module, without fixture data."""
    folder=Path('../../src/redesign')
    folder.mkdir(exist_ok=True)
    markup=header_markup('motion',Path('complete-review/motion.html').read_text())
    template=re.search(r'<section class="rv-shell">(.*?)</section>\s*<script>',markup,re.S)[0].rsplit('<script>',1)[0]
    template=template.replace('data-theme="light"','')
    material=Path('complete-review/shared-painter.js').read_text().replace('__VERTEX__','`'+vertex+'`').replace('__FRAGMENT__','`'+fragment+'`')
    runtime=Path('complete-review/motion.js').read_text()
    runtime=production_lifecycle(runtime)
    adapters="(()=>{const root=document.getElementById('__ROOT__');\n"+Path('complete-review/source-adapters.js').read_text().replace('export { journeyFrames, dnsFrames, providerFrames };','root.sourcePresentation=Object.freeze({journeyFrames,dnsFrames,providerFrames});')+'\n})();'
    code='\n'.join([workspace_engine,helpers,Path('complete-review/shared-geometry.js').read_text().replace('export function','function'),*[Path('complete-review/'+name).read_text() for name in ['shared-ui.js','shared-reservation.js','shared-bytes.js','shared-presentation.js']],adapters,material,runtime,records])
    for identity in ['__ROOT__','hop-app-composition']:
        code=code.replace("document.getElementById('"+identity+"')",'element')
    code=code.replace('root.addEventListener(','scope.listen(element,')
    prelude="""// Generated by npm run review:build from the reviewed source. No fixture data.
import {createRuntimeScope} from '../../design-review/source/complete-review/integration-scope.js';
import {mountMaterialFoundation} from './material-runtime.js';
export function mountLifecycle(element,data){
const originalKeys=new Set(Reflect.ownKeys(element));
const scope=createRuntimeScope(element),{document,window,matchMedia,requestAnimationFrame,cancelAnimationFrame,ResizeObserver,MutationObserver}=scope;
element.innerHTML=__TEMPLATE__;
element.reviewData=data; element.dataset.integrated='false';
""".replace('__TEMPLATE__',json.dumps(template))
    (folder/'lifecycle-runtime.js').write_text(prelude+code+"\nconst api=element.causalStudy,ownedKeys=Reflect.ownKeys(element).filter(key=>!originalKeys.has(key));let disposed=false;return {api,stats:scope.stats,dispose(){if(disposed)return;disposed=true;api.dispose();scope.dispose();for(const key of ownedKeys)Reflect.deleteProperty(element,key);element.replaceChildren();}};\n}\n")
    styles=shared_rules(css).replace('#hop-app-composition','.review-runtime')+'\n'+Path('complete-review/review.css').read_text().replace('#__ROOT__','.review-runtime')
    (folder/'lifecycle-runtime.css').write_text(styles+'\n')

if __name__=='__main__':
    data=json.loads(Path('complete-review/source-data.json').read_text())
    motion_data={k:data[k] for k in ['baseline','tcp','failure','packetVariants','packetOperations','packet','dns','tls','http','journey','provider']}
    motion_data['referenceModels']=presentation_models(data)
    configs=[('motion','hop-causal-review','../dist/fragment-hopscotch-causal-lifecycle.html',motion_data)]
    if Path('complete-review/workbench.html').exists():configs.append(('workbench','hop-builder-review','../dist/fragment-hopscotch-builder-workbench.html',{k:data[k] for k in ['baseline','builder','provider','ipv6Control','challenges']}))
    if Path('complete-review/evidence.html').exists():configs.append(('evidence','hop-evidence-review','../dist/fragment-hopscotch-evidence-workspaces.html',{k:data[k] for k in ['baseline','measured','observed','physical','captureMulti','captureNg','captureTruncated','captureMultiBytes','captureNgBytes','captureTruncatedBytes','internet']}))
    if Path('complete-review/connected.html').exists():configs.append(('connected','hop-connected-review','../dist/fragment-hopscotch-connected-workspaces.html',{'baseline':data['baseline'],'referenceModels':presentation_models(data),'captureMulti':data['captureMulti'],'captureMultiBytes':data['captureMultiBytes']}))
    for config in configs:
        if config[0]=='evidence':config[3]['world']=json.loads(Path('complete-review/world-110m.topojson').read_text())
    receipts=[assemble(*config) for config in configs]
    Path('complete-review/source-manifest.json').write_text(json.dumps(receipts,indent=2))
    exec(Path("complete-review/production-runtime.py").read_text())
    integrated_runtime()
    print(json.dumps(receipts,indent=2))
