import {buildJourneyScenario,type JourneyModifierId,type JourneyTransportProfile,type JourneyDnsProfile} from '../journey/model';
import {createPortableJourneyScenario,decodeJourneyQuery,scenarioConfigFromPortable,encodeJourneyQuery} from '../journey/scenario';
import {SCENARIO_PRESET_CARDS} from '../scenarios/catalog';
import {scenarioForPreset} from '../journey/presets';
import {impairmentProfileForModifiers} from '../journey/modifiers';
import {WORKSPACE_CATALOG,type ExploreDestination} from '../workspace-catalog';

export function attachJourneyControls(element:HTMLElement,search:string,navigate:(id:ExploreDestination|null,search?:string)=>void,inspect:(id:ExploreDestination)=>void) {
 const portable=decodeJourneyQuery(search)??createPortableJourneyScenario({hostname:'example.test',config:{transportProfile:'tcp-h2',dnsProfile:'cache-miss',impairmentProfile:'clean'},timeMs:0});
 const config=scenarioConfigFromPortable(portable),scenario=buildJourneyScenario(portable.hostname,config);
 const details=document.createElement('details');details.className='journey-configuration';
 const summary=document.createElement('summary');summary.textContent='Edit request';details.append(summary);
 const form=document.createElement('form');form.className='rv-toolbar';details.append(form);
 function select(label:string,items:readonly (readonly [string,string])[],value:string){const wrapper=document.createElement('label'),control=document.createElement('select');wrapper.append(label,control);control.setAttribute('aria-label',label);for(const [id,text] of items){const option=document.createElement('option');option.value=id;option.textContent=text;control.append(option);}control.value=value;form.append(wrapper);return control;}
 const hostLabel=document.createElement('label'),hostname=document.createElement('input');hostname.value=portable.hostname;hostname.maxLength=253;hostname.required=true;hostLabel.append('Hostname',hostname);form.append(hostLabel);
 const transport=select('Transport',[['tcp-h2','TCP · HTTP/2'],['quic-h3','QUIC · HTTP/3']],portable.transportProfile),dns=select('DNS',[['cache-miss','Cache miss'],['cache-hit','Cache hit']],portable.dnsProfile);
 const presets=select('Scenario',[['custom','Current configuration'],...SCENARIO_PRESET_CARDS.map(card=>[card.id,card.title] as const)],'custom');
 const modifiers=document.createElement('fieldset');modifiers.className='journey-modifiers';const legend=document.createElement('legend');legend.textContent='Conditions';modifiers.append(legend);
 const names:[JourneyModifierId,string][]=[['dns-failure','DNS failure'],['route-failure','Route failure'],['route-leak','Route leak'],['server-failure','Server failure'],['single-loss','Packet loss'],['path-outage','Path outage'],['latency-spike','Latency spike'],['congestion','Congestion'],['partition','Partition']];
 for(const [id,text] of names){const label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.value=id;check.checked=config.modifierIds?.includes(id)??config.impairmentProfile===id;label.append(check,text);modifiers.append(label);}details.append(modifiers);
 const run=document.createElement('button');run.type='submit';run.dataset.actionRole='primary';run.textContent='Build request';form.append(run);
 const error=document.createElement('p');error.setAttribute('role','alert');error.hidden=true;details.append(error);
 form.addEventListener('submit',event=>{event.preventDefault();try{const modifierIds=[...modifiers.querySelectorAll<HTMLInputElement>('input:checked')].map(check=>check.value as JourneyModifierId);const next=createPortableJourneyScenario({hostname:hostname.value,config:{transportProfile:transport.value as JourneyTransportProfile,dnsProfile:dns.value as JourneyDnsProfile,modifierIds,impairmentProfile:impairmentProfileForModifiers(modifierIds)},timeMs:0});navigate('journey',encodeJourneyQuery(next));}catch(failure){error.textContent=failure instanceof Error?failure.message:String(failure);error.hidden=false;}});
 presets.addEventListener('change',()=>{const preset=SCENARIO_PRESET_CARDS.find(card=>card.id===presets.value);if(preset)navigate('journey',encodeJourneyQuery(scenarioForPreset(preset.id)));});
 element.querySelector('.rv-main')!.insertBefore(details,element.querySelector('.rv-local-controls'));
 const actions=document.createElement('div');actions.className='rv-toolbar journey-context-actions';const detail=document.createElement('button'),share=document.createElement('input'),shareDetails=document.createElement('details'),shareSummary=document.createElement('summary');detail.type='button';share.readOnly=true;share.setAttribute('aria-label','Share this paused request');shareSummary.textContent='Share request';shareDetails.className='journey-share';shareDetails.append(shareSummary,share);actions.append(detail,shareDetails);element.querySelector('.rv-console')!.append(actions);
 let currentDetail:ExploreDestination|null=null;
 detail.addEventListener('click',()=>{if(currentDetail)inspect(currentDetail);});
 const update=(event:Event)=>{const {eventId,sourceMs}=(event as CustomEvent<{eventId:string;sourceMs:number}>).detail,source=scenario.events.find(e=>e.id===eventId);currentDetail=source?.detailLab??null;detail.hidden=!currentDetail;detail.textContent=currentDetail?'Inspect '+WORKSPACE_CATALOG[currentDetail].name:'';share.value=location.origin+'/journey'+encodeJourneyQuery({...portable,timeMs:Math.round(sourceMs)});};
 element.addEventListener('app-source-change',update);
 return()=>element.removeEventListener('app-source-change',update);
}
