import { lazy, Suspense, useEffect, useState } from 'react';
import type { BuilderDeviceOption, BuilderDeviceRef, BuilderDeviceWorkbenchSnapshot, BuilderWorkbenchRow } from './builder/device-workbench.ts';
import type { BuilderTimelineDeviceDiff } from './builder/timeline.ts';
import './BuilderDeviceWorkbench.css';

const BuilderWorkbenchDepthPanel = lazy(() => import('./BuilderWorkbenchDepthPanel.tsx').then((module) => ({ default: module.BuilderWorkbenchDepthPanel })));

type WorkbenchTab = 'config' | 'state' | 'events';

function keyFor(ref:BuilderDeviceRef):string{return`${ref.plane}:${ref.id}`;}

function Why({row}:{row:BuilderWorkbenchRow}){
  if(row.why.length===0)return null;
  return <details className="device-workbench-why"><summary>WHY?</summary><div>{row.why.map((step)=><p key={step.id}><span>{step.source}</span><strong>{step.label}</strong><small>{step.detail}</small></p>)}</div></details>;
}

function Diff({diff}:{diff:BuilderTimelineDeviceDiff|null}){
  if(!diff)return null;
  return <div className="device-workbench-diff"><div><span>CHANGESET</span><strong>{diff.previousSequence==null?'INITIAL SNAPSHOT':`#${String(diff.previousSequence).padStart(3,'0')} → #${String(diff.sequence).padStart(3,'0')}`}</strong><small>{diff.configChanges} CONFIG · {diff.stateChanges} STATE</small></div>{diff.entries.length===0?<p>NO CONFIG OR STATE CHANGES FOR THIS DEVICE AT THIS EVENT.</p>:<div className="device-workbench-diff-list">{diff.entries.slice(0,10).map((entry)=><span key={entry.id} className={`change-${entry.change}`}><b>{entry.truth} · {entry.change.toUpperCase()}</b><strong>{entry.label}</strong><small>{entry.before??'∅'} → {entry.after??'∅'}</small></span>)}{diff.entries.length>10&&<small>+ {diff.entries.length-10} MORE CHANGES</small>}</div>}</div>;
}

export function BuilderDeviceWorkbench({snapshot,options,onSelect,historicalSequence=null,diff=null}:{snapshot:BuilderDeviceWorkbenchSnapshot;options:BuilderDeviceOption[];onSelect:(ref:BuilderDeviceRef)=>void;historicalSequence?:number|null;diff?:BuilderTimelineDeviceDiff|null;}){
  const [tab,setTab]=useState<WorkbenchTab>('state');
  const [depthRowCount,setDepthRowCount]=useState(0);
  const sections=tab==='config'?snapshot.configSections:snapshot.stateSections;
  const historical=historicalSequence!=null;
  useEffect(()=>setDepthRowCount(0),[snapshot.device.plane,snapshot.device.id,historicalSequence]);
  return <section className={`builder-device-workbench ${historical?'is-historical':''}`} data-device-plane={snapshot.device.plane} data-device-id={snapshot.device.id} data-history-sequence={historicalSequence??'live'}>
    <div className="control-title"><span>DEVICE WORKBENCH</span><strong>{historical?`HISTORICAL #${String(historicalSequence).padStart(3,'0')}`:'CONFIG / STATE / EVENTS'}</strong></div>
    <label>DEVICE<select value={keyFor(snapshot.device)} onChange={(event)=>{const [plane,id]=event.currentTarget.value.split(':',2);setDepthRowCount(0);onSelect({plane:plane as BuilderDeviceRef['plane'],id});}}>{['ROUTED GRAPH','ETHERNET FABRIC'].map((group)=><optgroup key={group} label={group}>{options.filter((option)=>option.group===group).map((option)=><option key={keyFor(option)} value={keyFor(option)}>{option.label} · {option.kind}</option>)}</optgroup>)}</select></label>
    <div className="device-workbench-identity"><span>{snapshot.device.group}</span><strong>{snapshot.device.label}</strong><small>{snapshot.device.kind} · {snapshot.device.id}{historical?` · READ-ONLY SNAPSHOT #${historicalSequence}`:''}</small></div>
    {historical&&<Diff diff={diff}/>} 
    <div className="device-workbench-tabs" role="tablist" aria-label="Device workbench view">
      <button type="button" role="tab" aria-selected={tab==='config'} className={tab==='config'?'active':''} onClick={()=>setTab('config')}>CONFIG <b>{snapshot.configRowCount}</b></button>
      <button type="button" role="tab" aria-selected={tab==='state'} className={tab==='state'?'active':''} onClick={()=>setTab('state')}>STATE <b>{snapshot.stateRowCount+depthRowCount}</b></button>
      <button type="button" role="tab" aria-selected={tab==='events'} className={tab==='events'?'active':''} onClick={()=>setTab('events')}>EVENTS <b>{snapshot.events.length}</b></button>
    </div>
    {tab==='events'?<div className="device-workbench-events">{snapshot.events.length===0?<small>NO SESSION EVENTS FOR THIS DEVICE</small>:snapshot.events.map((event)=><article key={event.id} className={`category-${event.category}`}><div><span>#{String(event.sequence).padStart(3,'0')} · {event.category.toUpperCase()}</span>{event.causeId&&<i>CAUSE {event.causeId.replace('wb-event-','#')}</i>}</div><strong>{event.summary}</strong><p>{event.detail}</p>{event.causeChain.length>1&&<details><summary>CAUSAL CHAIN · {event.causeChain.length} EVENTS</summary><div className="device-workbench-event-chain">{event.causeChain.map((step)=><small key={step.id}><b>{step.label}</b>{step.detail}</small>)}</div></details>}</article>)}</div>:<div className="device-workbench-sections">{sections.map((section)=><section key={section.id}><div className="device-workbench-section-title"><span>{section.title}</span><strong>{section.summary}</strong></div>{section.rows.length===0?<small className="device-workbench-empty">{section.summary}</small>:section.rows.map((entry)=><article key={entry.id} className={`status-${entry.status}`}><div><span>{entry.label}</span><strong>{entry.value}</strong></div><p>{entry.detail}</p><Why row={entry}/></article>)}</section>)}{tab==='state'&&<Suspense fallback={null}><BuilderWorkbenchDepthPanel input={snapshot.depthInput} device={snapshot.device} onRowCount={setDepthRowCount}/></Suspense>}</div>}
    <small className="builder-routing-note device-workbench-boundary">{historical?'HISTORICAL CONFIG / STATE / EVENTS COME FROM ONE IMMUTABLE CANONICAL SNAPSHOT · RETURN LIVE BEFORE EDITING.':'CONFIG IS PERSISTED CANONICAL TRUTH · STATE + EVENTS ARE DERIVED / SESSION-ONLY · WHY CHAINS FOLLOW STRUCTURED MODEL CAUSALITY, NOT GENERATED GUESSES.'}</small>
  </section>;
}
