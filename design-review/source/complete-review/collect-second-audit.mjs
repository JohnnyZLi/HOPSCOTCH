import fs from 'node:fs';
import assert from 'node:assert/strict';
import {environment} from './check-complete.mjs';
const models=[],clean=x=>JSON.parse(JSON.stringify(x));
const auditDir=process.env.HOPSCOTCH_AUDIT_DIR||'complete-review/second-audit';fs.mkdirSync(auditDir,{recursive:true});
function tree(e){
 if(e?.classList.contains('ev-globe'))return {tag:'graphic',kind:'globe'};
 if(!e||e.hidden||['canvas','script','style','svg'].includes(e.tag)||e.classList.contains('rv-status-copy')||e.classList.contains('rv-disclosure-icon'))return null;
 return {tag:e.tag,cls:e.className,text:e._text,attrs:{...e.attrs,...Object.fromEntries(Object.entries(e.dataset).map(([k,v])=>['data-'+k,v])),...(e.dataset.materialRole==='packet'?{'data-packetHue':parseFloat(e.style.getPropertyValue('--rv-packet-hue'))||0}:{})},open:Boolean(e.open),value:e.value,children:e.children.map(tree).filter(Boolean)};
}
async function settle(e){
 for(let i=0;i<70;i++){for(const a of e.animationJobs)if(!a.cancelled)a.finish();await e.flush();const states=[e.root.builderStudy?.snapshot(),e.root.evidenceStudy?.snapshot(),e.root.connectedStudy?.snapshot()].filter(Boolean);if(states.every(s=>!s.graphPending&&!s.animations))break;}
 e.root.reviewUI.settle();
 assert(!e.root.querySelector('.cx-transfer-ghost'),'Resting analytical exports must wait for source-anchor arrival/fade cleanup');
}
function openAll(e,container){e.root.disclosures.upgrade(container);for(const d of container.querySelectorAll('details'))if(!d.closest('.wb-source-inspection'))e.root.disclosures.set(d,true,false);}
async function capture(e,family,id,selector='.rv-main',extra={}){
 await settle(e);const body=tree(e.q(selector));assert(body);
 const s=e.root.builderStudy?.snapshot()||e.root.evidenceStudy?.snapshot();
 const network=s?.graphPlan?{plan:clean(s.graphPlan),camera:clean(s.camera),viewport:clean(s.viewport),selected:s.selected?.id||String(s.asSelected),selectedLinks:e.root.evidenceStudy?clean(e.root.evidenceStudy.paths()[s.asPath]?.relationshipIds||[]):[],edgeStates:Object.fromEntries(e.root.querySelectorAll('[data-edge]').map(n=>[n.dataset.edge,n.dataset.networkState])),boundaryNodes:e.root.querySelectorAll('.wb-node').filter(n=>n.dataset.boundary==='true').map(n=>n.dataset.node),pathNodes:e.root.querySelectorAll('.wb-node').filter(n=>n.dataset.forwarding==='true').map(n=>n.dataset.node)}:null;
 const globe=e.root.evidenceStudy&&s.workspace==='physical'?e.root.querySelector('.ev-globe')?.children.map(n=>({tag:n.tag,attrs:n.attrs,text:n.textContent}))||null:null;
 const layout=e.root.querySelector('.wb-viewport')||e.root.querySelector('.ev-layout')||e.root.querySelector('.cx-content-layout');const paneMode=layout?e.context.getComputedStyle(layout).getPropertyValue('--rv-pane-mode'):null;
 models.push({family,id,width:e.width,header:tree(e.q('.rv-header')),body,network,globe,paneMode,pane:layout?.dataset.pane||s?.pane,...extra});
}
for(const width of [390,1024]){
 const c=await environment('connected',width),ca=c.root.connectedStudy;
 await capture(c,'connected','overview');ca.openCatalog();openAll(c,c.q('.cx-catalog'));await capture(c,'connected','catalog');
 ca.launch();ca.seek(ca.snapshot().scenario.events.find(e=>e.detailLab==='tcp').atMs);await capture(c,'connected','journey');ca.openDetail('tcp');await capture(c,'connected','journey-tcp-detail');ca.returnContext();
 ca.launch('path-outage');ca.seek(13250);await capture(c,'connected','path-outage');ca.launch('route-leak');ca.seek(4200);await capture(c,'connected','route-leak');
 ca.openWorkspace('capture');ca.chooseFrame('frame-000005');await capture(c,'connected','capture');ca.selectByte(22);ca.openMicroscope();ca.selectByte(34);await capture(c,'connected','microscope');ca.returnContext();await capture(c,'connected','captured-return');
 ca.openWorkspace('tls');await capture(c,'connected','tls-message');c.change('.cx-model-frame',6);await capture(c,'connected','tls-validation');

 const b=await environment('workbench',width),ba=b.root.builderStudy;
 ba.runPing();openAll(b,b.q('.wb-topology'));await capture(b,'builder','topology');b.q('.wb-mobile-panes').children.find(n=>n.dataset.pane==='workbench').click();await capture(b,'builder','topology-inspector');b.q('.wb-mobile-panes').children.find(n=>n.dataset.pane==='canvas').click();
 ba.selectPage('systems');for(const system of ba.snapshot().systems){ba.selectSystem(system.id,0);if(['addressing','routing','provider'].includes(system.id))await capture(b,'builder','summary-'+system.id,'.wb-systems');openAll(b,b.q('.wb-systems-content'));await capture(b,'builder','systems-'+system.id,'.wb-systems');}
 for(const [id,index]of [['routing',1],['ipv6',1]]){ba.selectSystem(id,index);openAll(b,b.q('.wb-systems-content'));await capture(b,'builder','systems-'+id+'-alternate','.wb-systems');}
 ba.selectPage('cli');ba.runCommand('show route');openAll(b,b.q('.wb-command-result'));await capture(b,'builder','cli','.wb-cli');
 ba.selectPage('history');await capture(b,'builder','history','.wb-history');
 ba.loadChallenge(0);ba.selectPage('challenge');ba.runPing();await capture(b,'builder','challenge-broken','.wb-challenge');ba.repairChallenge();ba.runPing();await capture(b,'builder','challenge-repaired','.wb-challenge');
 ba.selectPage('scenario');await capture(b,'builder','scenario','.wb-scenario');

 const e=await environment('evidence',width),ea=e.root.evidenceStudy;
 for(const id of ['measured','capture','observed','physical','internet']){
  ea.select(id);await capture(e,'evidence',id);
  for(const mode of ['empty','partial','error']){ea.setState(mode);await capture(e,'evidence',id+'-'+mode);}
  ea.setState('populated');
 }
 ea.select('measured');e.change('.ev-category','route');await capture(e,'evidence','measured-route');
 ea.select('capture');ea.loadCapture('pcapng');ea.inspectByte(22);openAll(e,e.q('.ev-content'));await capture(e,'evidence','capture-opened');e.q('.ev-mobile-panes').children.find(n=>n.dataset.pane==='detail').click();await capture(e,'evidence','capture-inspector');
 console.log('Exported current DOM families at',width);
}
for(const width of [760,761,800]){
 const b=await environment('workbench',width);b.root.builderStudy.runPing();await capture(b,'builder','pane-boundary');
 const e=await environment('evidence',width);e.root.evidenceStudy.select('capture');e.root.evidenceStudy.inspectByte(50);openAll(e,e.q('.ev-content'));await capture(e,'evidence','pane-boundary');
}
fs.writeFileSync(auditDir+'/compositions.json',JSON.stringify({kind:'Fresh current emitted-runtime trees; native analytical rendering only, no cached Builder views or direct native-open shortcuts',manifest:JSON.parse(fs.readFileSync('complete-review/source-manifest.json')),models},null,2));
console.log('Current DOM selections',models.length);
