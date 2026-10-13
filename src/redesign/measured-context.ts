import {measuredSession} from './measurement-session';
import {measuredEvidenceForScene,type MeasuredSceneKind} from '../measurement/sceneEvidence';
import type {NativeMeasurementFact} from '../measurement/native';

export function attachMeasuredContext(element:HTMLElement,hostname:string,destinationAddress:string) {
 const report=measuredSession();if(!report)return()=>{};
 const details=document.createElement('details'),summary=document.createElement('summary'),body=document.createElement('section');details.className='measured-context';summary.textContent='Imported local evidence · separate capture time';details.append(summary,body);element.querySelector('.rv-main')!.append(details);
 let scene:MeasuredSceneKind='routing';
 function draw(){body.replaceChildren();if(!details.open)return;const projection=measuredEvidenceForScene(report!,{scene,hostname,destinationAddress});const note=document.createElement('p');note.textContent='LOCAL MEASURED · local host, not a global path · '+report!.snapshot.capture.completedAt+' · target matches do not establish this simulated path.';body.append(note);
  for(const [label,facts] of [['Matched target',projection.matchedTarget],['Local context',projection.localContext],['Other target',projection.otherTarget]] as [string,NativeMeasurementFact[]][]){const group=document.createElement('details'),heading=document.createElement('summary');heading.textContent=label+' · '+facts.length+' facts';group.append(heading);group.addEventListener('toggle',()=>{group.querySelector('dl')?.remove();if(!group.open)return;const list=document.createElement('dl');list.className='rv-facts';for(const fact of label==='Other target'?[]:facts.slice(0,3)){const row=document.createElement('div');row.className='rv-fact';const term=document.createElement('dt'),value=document.createElement('dd');term.textContent=fact.subject;value.textContent=String(fact.value??'Not available')+(fact.unit?' '+fact.unit:'')+' · '+fact.availability;row.append(term,value);list.append(row);}group.append(list);});body.append(group);}
 }
 const changed=(event:Event)=>{const {eventId}=(event as CustomEvent<{eventId:string}>).detail;const next:MeasuredSceneKind=eventId.startsWith('dns')?'dns':/tcp|transport|quic|tls|http/.test(eventId)?'transport':'routing';if(next!==scene){scene=next;draw();}};
 element.addEventListener('app-source-change',changed);details.addEventListener('toggle',draw);
 return()=>element.removeEventListener('app-source-change',changed);
}
