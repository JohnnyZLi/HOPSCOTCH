"""Mount the complete reviewed workspaces against current production engines.

The design-review pages keep their explicit reference data. Application modules
receive canonical models and user imports; no reference snapshots are bundled.
"""
def complete_runtimes():
    folder=Path('../../src/redesign')
    common='\n'.join([engine,helpers,graph_helper,*[Path('complete-review/'+name).read_text() for name in ['shared-geometry.js','shared-ui.js','shared-network.js','shared-reservation.js','shared-bytes.js','shared-presentation.js']],Path('complete-review/shared-painter.js').read_text().replace('__VERTEX__','`'+vertex+'`').replace('__FRAGMENT__','`'+fragment+'`'),records])
    common=common.replace('export function','function')
    for identity in ['__ROOT__','hop-app-composition']:
        common=common.replace("document.getElementById('"+identity+"')",'element')
    common=common.replace('root.addEventListener(','scope.listen(element,')
    (folder/'foundation-runtime.js').write_text("// Generated from the approved composition. Shared material, geometry, and UI.\nimport {createRuntimeScope} from '../../design-review/source/complete-review/integration-scope.js';\nexport function mountFoundation(element){\nconst originalKeys=new Set(Reflect.ownKeys(element));\nconst scope=createRuntimeScope(element),{document,window,matchMedia,requestAnimationFrame,cancelAnimationFrame,ResizeObserver,MutationObserver}=scope;\n"+common+"\nreturn {scope,originalKeys};\n}\n")
    for kind,name,domain_key,api_key in [('workbench','builder','reviewDomain','builderStudy'),('evidence','evidence','evidenceDomain','evidenceStudy'),('connected','connected','entryDomain','connectedStudy')]:
        source=header_markup(kind,Path('complete-review/'+kind+'.html').read_text())
        template=re.search(r'<section class="rv-shell">.*?</section>\s*<script>',source,re.S)[0].rsplit('<script>',1)[0]
        style=re.search(r'<style>(.*?)</style>',source,re.S)[1].replace('__SHARED_CSS__','').replace('__CSS__','').replace('__CONNECTED_CSS__',Path('complete-review/connected.css').read_text() if kind=='connected' else '').replace('#__ROOT__','.review-runtime')
        (folder/(name+'-runtime.css')).write_text(style+'\n')
        runtime=Path('complete-review/'+kind+'.js').read_text().replace("document.getElementById('__ROOT__')",'element').replace('root.addEventListener(','scope.listen(element,')
        domain_source=Path('complete-review/'+('domain.mjs' if kind=='workbench' else 'evidence-domain.mjs' if kind=='evidence' else 'entry-domain.mjs')).read_text()
        domain_source=re.sub(r"'/workspace/scratch/[^']+/hopscotch/src/", "'../",domain_source)
        domain_source=domain_source.replace("'./entry-source/","'../")
        if kind=='connected':
            for file in ['presets.ts','model.ts','scenario.ts']:
                domain_source=domain_source.replace("'../"+file+"'","'../journey/"+file+"'")
            domain_source=domain_source.replace("'../catalog.ts'","'../scenarios/catalog.ts'")
        domain_source=re.sub(r"document.getElementById\('[^']+'\)\.[A-Za-z]+=",'export default ',domain_source)
        (folder/(name+'-domain.ts')).write_text(domain_source)
        if kind=='workbench':
            extensions="import {nextGeneratedNodeId,nextGeneratedLinkId,deterministicNewNodePoint,undirectedLinkExists} from '../builder/model';\nimport {reconcileBuilderLinkProfiles} from '../builder/link-characteristics';\nimport {reconcileBuilderHostedServices} from '../builder/application';\n"
            domain_source=extensions+domain_source.replace('Object.freeze({','Object.freeze({nextGeneratedNodeId,nextGeneratedLinkId,deterministicNewNodePoint,undirectedLinkExists,reconcileBuilderLinkProfiles,reconcileBuilderHostedServices,')
            (folder/(name+'-domain.ts')).write_text(domain_source)
            runtime=runtime.replace('d.builder.services','(input.services||d.builder.services)').replace('Source fixture','Initial network').replace('Design review network','My network').replace('design sandbox','current session')
            runtime=runtime.replace('root.builderStudy=Object.freeze({selectPage,',Path('complete-review/production-builder.js').read_text()+"\nroot.builderStudy=Object.freeze({dispose:disposeBuilder,restore:restoreBuilder,save:()=>({...root.builderStudy.snapshot(),selection:[...selection]}),selectPage,")
        if kind=='evidence':
            runtime=production_evidence(runtime)
            domain_source=domain_source.replace('export default ', "import {connectLoopbackBridge,fetchLoopbackBridgeReport} from '../measurement/loopbackBridge';\nimport {parseCaptureSessionAsync} from '../capture/parse-async';\nexport default " ).replace('Object.freeze({','Object.freeze({connectLoopbackBridge,fetchLoopbackBridgeReport,parseCaptureSessionAsync,')
            (folder/(name+'-domain.ts')).write_text(domain_source)
        if kind=='connected':
            start=runtime.index('function showLiveWorkspace(id){');end=runtime.index('function frame(){',start)
            runtime=runtime[:start]+"function showLiveWorkspace(id){root.appNavigate?.(id); }\n"+runtime[end:]
            runtime=runtime.replace('d.captureMulti.frames[0].record.id',"d.captureMulti.frames[0]?.record.id||''")
            runtime=runtime.replace("function openWorkspace(id){if(!catalog[id])return false;","function openWorkspace(id){if(!catalog[id])return false;if(root.appNavigate){root.appNavigate(id);return true;}")
            runtime=runtime.replace('function setScenario(value){const next=domain.normalizePortableJourneyScenario(value),built=domain.buildJourneyScenario(next.hostname,domain.scenarioConfigFromPortable(next));','function setScenario(value){const next=domain.normalizePortableJourneyScenario(value),built=domain.buildJourneyScenario(next.hostname,domain.scenarioConfigFromPortable(next));if(root.appNavigate){root.appNavigate(\'journey\',domain.encodeJourneyQuery(next));return;}')
        geo=''
        if kind=='evidence':
            geo='const d3={};\n'
            for library,args in [('d3-array.min.js','d3'),('d3-geo.min.js','d3,d3')]:
                bundled=Path('complete-review/'+library).read_text().strip()
                geo+=bundled[bundled.index('(function('):-2]+'('+args+');\n'
        args=',navigate' if kind=='connected' else ''
        extra='element.appNavigate=navigate;' if kind=='connected' else ''
        code="// Generated from the complete approved composition. Current domain engines.\nimport {mountFoundation} from './foundation-runtime.js';\nimport domain from './"+name+"-domain';\nimport './"+name+"-runtime.css';\nexport function mount"+name.title()+"(element,data"+args+"){\nelement.innerHTML="+json.dumps(template)+";\nelement.reviewData=data;element."+domain_key+"=domain;"+extra+"\nconst {scope,originalKeys}=mountFoundation(element),{document,window,matchMedia,requestAnimationFrame,cancelAnimationFrame,ResizeObserver,MutationObserver}=scope;\n"+geo+runtime+"\nconst api=element."+api_key+",ownedKeys=Reflect.ownKeys(element).filter(key=>!originalKeys.has(key));let disposed=false;return {api,dispose(){if(disposed)return;disposed=true;api?.pause?.();api?.dispose?.();element.reviewUI.settle();element.byteWindows.dispose();element.layoutReservation.dispose();scope.dispose();for(const key of ownedKeys)Reflect.deleteProperty(element,key);element.replaceChildren();}};\n}\n"
        (folder/(name+'-runtime.js')).write_text(code)

def production_evidence(runtime):
    runtime=runtime.replace('facility:fs.slice()', 'facility:fs.slice()').replace('[0]};})();','[0]||{id:null}};})();',1)
    runtime=runtime.replace('measured=domain.projectMeasuredSnapshot(d.measured.snapshot)','measured=d.measured?domain.projectMeasuredSnapshot(d.measured.snapshot):null',1).replace('selectedFact=measured.snapshot.facts[0].id',"selectedFact=measured?.snapshot.facts[0]?.id||''")
    runtime=runtime.replace('parsed=domain.parseCaptureSession(buffer)','parsed=await domain.parseCaptureSessionAsync(buffer)')
    runtime=runtime.replace("let workspace='measured',mode='populated'","let workspace='measured',mode='empty'")
    runtime=runtime.replace("else{mode='populated';pane='scene';","else{mode=id==='internet'||(id==='measured'&&measured)||(id==='capture'&&capture.frames.length)||(id==='physical'&&d.physical.facilities.length)||(id==='observed'&&d.observed)?'populated':'empty';pane='scene';")
    runtime=runtime.replace("select('measured');","select(d.bootstrapWorkspace||'measured');")
    runtime=runtime.replace("q('.rv-main').insertBefore(q('.ev-review-states'),q('.ev-setup'));","q('.ev-review-states').hidden=true;")
    runtime=runtime.replace("selectControl(controls,'Capture','ev-capture-kind',[['pcap','PCAP · 9 frames'],['pcapng','PCAPNG · 2 frames'],['truncated','Truncated · 32 of 54 B']],importedCapture?'imported':captureKind,v=>loadCapture(v));",'')
    runtime=runtime.replace("if(importedCapture){const select=q('.ev-capture-kind'),o=node('option','','Imported capture');o.value='imported';select.append(o);select.value='imported';}",'')
    runtime=runtime.replace("q('.ev-clock').textContent='Fixture observation · '+o.generatedAt","q('.ev-clock').textContent='Observation · '+o.generatedAt")
    runtime=runtime.replace("Repository report fixture · LOCAL MEASURED schema · not a measurement of your device.","Import a local report to inspect its original host and run.")
    runtime=runtime.replace("Repository generated capture fixture · CAPTURED schema · not traffic from your device.","Import a PCAP or PCAPNG to inspect the exact captured bytes.")
    runtime=runtime.replace("Repository synthetic observation fixture · not live edge or collector evidence.","Explicit snapshot · edge, destination, and public collectors retain separate provenance.")
    runtime=runtime.replace("Repository synthetic facility fixture · not real infrastructure. Basemap: Natural Earth via D3 world-atlas.","Source facility records · geography does not establish a forwarding path. Basemap: Natural Earth.")
    runtime=runtime.replace('synthetic repository fixture coordinates','source facility coordinates').replace('Fixture points are facilities','These points are facilities').replace('fixture coordinates','source coordinates')
    runtime=re.sub(r"q\('\.ev-bridge-state'\).addEventListener[^\n]+",'',runtime)
    runtime=runtime.replace("q('.ev-content').replaceChildren();q('.ev-detail-content').replaceChildren();", "q('.ev-content').replaceChildren();q('.ev-detail-content').replaceChildren();acquisitionControls();")
    runtime=runtime.replace("root.evidenceStudy=Object.freeze({select,",Path('complete-review/production-evidence.js').read_text()+"\nroot.evidenceStudy=Object.freeze({save:saveEvidence,restore:restoreEvidence,dispose:disposeEvidence,acquire,select,")
    runtime=runtime.replace("Import a report or use the reference snapshot.","Import a report.")
    runtime=runtime.replace("if(mode==='empty'){empty();","if(mode==='empty'||(workspace==='measured'&&!measured)||(workspace==='capture'&&!capture.frames.length)||(workspace==='observed'&&!d.observed)||(workspace==='physical'&&!d.physical.facilities.length)){empty();")
    runtime=runtime.replace("importedMeasured=true;render();return true;","importedMeasured=true;root.dispatchEvent(new CustomEvent('app-measured-change',{detail:measured}));render();return true;")
    runtime=runtime.replace('Fixture city','City').replace('Fixture country','Country').replace('Fixture latitude','Latitude').replace('Fixture longitude','Longitude').replace('Repository synthetic fixture','PUBLIC DATA').replace('Fixture snapshot','Source snapshot').replace('synthetic fixture facilities','source facilities').replace('synthetic facility fixture','source facilities')
    runtime=runtime.replace("function prepareAs(){\n", "function prepareAs(){\n if(d.internet.graph.nodes.length>48){if(!graphPlan){graphPlan=densityAsPlan();frameAs();focusAs();}else paintAs();return;}\n")
    runtime=runtime.replace("function paintAs(){\n", "function paintAs(){\n if(d.internet.graph.nodes.length>48&&graphPlan&&workspace==='internet'&&q('.ev-map')){paintDensityAs();return;}\n")
    runtime=runtime.replace("selectControl(controls,'Source AS','ev-as-source',items,asSource", "selectControl(controls,'Source AS','ev-as-source',boundedOptions(items,asSource),asSource").replace("selectControl(controls,'Destination AS','ev-as-destination',items,asDestination", "selectControl(controls,'Destination AS','ev-as-destination',boundedOptions(items,asDestination),asDestination").replace("selectControl(controls,'Inspect AS','ev-as-selected',items,asSelected", "selectControl(controls,'Inspect AS','ev-as-selected',boundedOptions(items,asSelected),asSelected")
    runtime=runtime.replace("d.internet.graph.relationships.map(r=>[r.id,r.id]),relationshipId", "boundedOptions(d.internet.graph.relationships.map(r=>[r.id,r.id]),relationshipId),relationshipId")
    runtime=runtime.replace(" const candidates=paths();", " graphSearch(controls);const candidates=paths();")
    runtime=runtime.replace("facilities.map(f=>[f.id,f.name]),facilityId", "boundedOptions(facilities.map(f=>[f.id,f.name]),facilityId),facilityId")
    a=runtime.index('function renderGlobe(){');b=runtime.index('function rotateGlobe(',a);runtime=runtime[:a]+"function renderGlobe(){productionGlobe();}\n"+runtime[b:]
    runtime=runtime.replace("root.evidenceStudy=Object.freeze",Path('complete-review/production-density.js').read_text()+"\nroot.evidenceStudy=Object.freeze")
    runtime=runtime.replace("['Provenance','PUBLIC DATA']","['Provenance',d.physical.provenance||'PUBLIC DATA']")
    return runtime

def production_lifecycle(runtime):
    runtime=runtime.replace("function render(){\n if(!plan)return;const at=locate(clock),f=frames[at.index];", "function render(){\n if(!plan)return;const at=locate(clock),f=frames[at.index];root.dispatchEvent(new CustomEvent('app-source-change',{detail:{eventId:f.id,sourceMs:f.at??0}}));")
    runtime=runtime.replace('root.causalStudy=Object.freeze({select,seek,', "function save(){return {position:currentPosition(),variant,dnsMode,byte,speed:q('.rv-speed').value};}\nfunction restore(value){if(!value)return;if(!plan){scope.listen(element,'review-plan-ready',()=>restore(value),{once:true});return;}pause();variant=value.variant??variant;dnsMode=value.dnsMode??dnsMode;byte=value.byte??byte;memories.set(sceneId,{...value});q('.rv-speed').value=value.speed||'1';select(sceneId);pause();}\nroot.causalStudy=Object.freeze({save,restore,select,seek,")
    runtime=runtime.replace("select(data.bootstrapScene||'tcp');", "select(data.bootstrapScene||'tcp');if(data.bootstrapSourceTime!==undefined){const boot=()=>{if(!plan)return;presentSource(data.bootstrapSourceTime,data.journey.frames.at(-1).event.atMs,true);root.removeEventListener('review-plan-ready',boot);};root.addEventListener('review-plan-ready',boot);boot();}")
    return runtime

complete_runtimes()
