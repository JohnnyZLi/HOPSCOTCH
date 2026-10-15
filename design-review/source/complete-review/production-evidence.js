// Production acquisition binds the reviewed evidence composition to real sources.
let acquisitionJob=0,acquisitionController=null,bridgeConnection=null;
function acquisitionControls(){
 if(workspace!=='observed'&&workspace!=='physical')return;
 const form=node('form','rv-toolbar');
 if(workspace==='observed'){const label=node('label','','Hostname'),input=node('input','ev-host');input.value=d.observed?.destination.hostname||'cloudflare.com';input.required=true;input.maxLength=253;label.append(input);form.append(label);}
 const request=node('button','',workspace==='physical'?'Load infrastructure':'Request snapshot');request.type='submit';request.dataset.actionRole='primary';form.append(request);form.addEventListener('submit',event=>{event.preventDefault();void acquire(workspace,form.querySelector('input')?.value);});q('.ev-controls').append(form);
}
async function acquire(kind,hostname){
 acquisitionController?.abort();acquisitionController=new AbortController();const token=++acquisitionJob,selectedWorkspace=workspace;
 mode='loading';status();
 try{
  const url=kind==='physical'?'/api/internet/infrastructure':'/api/internet/snapshot?host='+encodeURIComponent(hostname.trim());
  const response=await fetch(url,{signal:acquisitionController.signal,headers:{accept:'application/json'}}),value=await response.json();
  if(!response.ok||value.ok===false)throw Error(value.error||'Source request failed with HTTP '+response.status);
  if(value.schema!==(kind==='physical'?'hopscotch.internet-infrastructure':'hopscotch.internet-evidence'))throw Error('The source returned an unexpected schema.');
  if(token!==acquisitionJob||selectedWorkspace!==workspace)return false;
  if(kind==='physical'){
   if(!Array.isArray(value.facilities)||value.facilities.some(f=>!Number.isFinite(f.latitude)||!Number.isFinite(f.longitude)))throw Error('Facility coordinates are invalid.');
   d.physical=value;facilityId=value.facilities[0]?.id??null;const first=value.facilities[0];if(first)rotation=[-first.longitude,-first.latitude];
  }else d.observed=value;
  acquisitionErrors.delete(workspace);mode=kind==='physical'&&!d.physical.facilities.length?'empty':'populated';render();return true;
 }catch(error){if(token!==acquisitionJob||selectedWorkspace!==workspace)return false;mode='error';acquisitionErrors.set(workspace,error.message||String(error));render();return false;}
}
function setupBridge(){
 const host=q('.ev-setup .rv-record');host.querySelector('.ev-bridge-state')?.closest('.rv-toolbar')?.remove();
 const form=node('form','rv-toolbar'),label=node('label','','Bridge address'),origin=node('input');origin.value='http://127.0.0.1:8765';origin.setAttribute('aria-label','Local bridge address');label.append(origin);const connect=node('button','','Connect');connect.type='submit';const request=node('button','','Request one report');request.type='button';request.disabled=true;form.append(label,connect,request);host.append(form);
 form.addEventListener('submit',async event=>{event.preventDefault();const token=++acquisitionJob;connect.disabled=true;request.disabled=true;q('.ev-bridge-caption').textContent='Checking bridge capabilities…';try{const next=await domain.connectLoopbackBridge(origin.value);if(token!==acquisitionJob)return;bridgeConnection=next;request.disabled=false;q('.ev-bridge-caption').textContent='Connected · report-v2 supported. Request a report when ready.';}catch(error){if(token!==acquisitionJob)return;bridgeConnection=null;q('.ev-bridge-caption').textContent=error.message||String(error);}finally{if(token===acquisitionJob)connect.disabled=false;}});
 request.addEventListener('click',async()=>{if(!bridgeConnection)return;const token=++acquisitionJob;request.disabled=true;q('.ev-bridge-caption').textContent='Requesting one report…';try{const value=await domain.fetchLoopbackBridgeReport(bridgeConnection);if(token!==acquisitionJob)return;await importMeasuredText(JSON.stringify(value.snapshot));q('.ev-bridge-caption').textContent='Report imported · original host, targets, and capture times retained.';}catch(error){if(token!==acquisitionJob)return;q('.ev-bridge-caption').textContent=error.message||String(error);}finally{if(token===acquisitionJob)request.disabled=false;}});
}
function saveEvidence(){return {...root.evidenceStudy.snapshot(),observed:d.observed,physical:d.physical,importedMeasured,importedCapture};}
function restoreEvidence(saved){
 if(!saved)return;
 measured=saved.measured;capture=saved.capture;captureBytes=saved.captureBytes;d.observed=saved.observed;d.physical=saved.physical;importedMeasured=saved.importedMeasured;importedCapture=saved.importedCapture;captureKind=saved.captureKind;
 select(saved.workspace,{...saved,cam:saved.camera});
}
function disposeEvidence(){++fileEpoch;++acquisitionJob;++graphEpoch;acquisitionController?.abort();for(const animation of animations)animation.cancel();animations.clear();}
setupBridge();
