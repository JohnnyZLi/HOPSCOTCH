import { useState } from 'react';
import type { BuilderDeviceOption, BuilderDeviceRef, BuilderDeviceWorkbenchSnapshot, BuilderWorkbenchRow } from './builder/device-workbench.ts';
import './BuilderDeviceWorkbench.css';

type WorkbenchTab = 'config' | 'state' | 'events';

function keyFor(ref:BuilderDeviceRef):string{return`${ref.plane}:${ref.id}`;}

function Why({row}:{row:BuilderWorkbenchRow}){
  if(row.why.length===0)return null;
  return <details className="device-workbench-why"><summary>WHY?</summary><div>{row.why.map((step)=><p key={step.id}><span>{step.source}</span><strong>{step.label}</strong><small>{step.detail}</small></p>)}</div></details>;
}

export function BuilderDeviceWorkbench({snapshot,options,onSelect}:{snapshot:BuilderDeviceWorkbenchSnapshot;options:BuilderDeviceOption[];onSelect:(ref:BuilderDeviceRef)=>void;}){
  const [tab,setTab]=useState<WorkbenchTab>('state');
  const sections=tab==='config'?snapshot.configSections:snapshot.stateSections;
  return <section className="builder-device-workbench" data-device-plane={snapshot.device.plane} data-device-id={snapshot.device.id}>
    <div className="control-title"><span>DEVICE WORKBENCH</span><strong>CONFIG / STATE / EVENTS</strong></div>
    <label>DEVICE<select value={keyFor(snapshot.device)} onChange={(event)=>{const [plane,id]=event.currentTarget.value.split(':',2);onSelect({plane:plane as BuilderDeviceRef['plane'],id});}}>{['ROUTED GRAPH','ETHERNET FABRIC'].map((group)=><optgroup key={group} label={group}>{options.filter((option)=>option.group===group).map((option)=><option key={keyFor(option)} value={keyFor(option)}>{option.label} · {option.kind}</option>)}</optgroup>)}</select></label>
    <div className="device-workbench-identity"><span>{snapshot.device.group}</span><strong>{snapshot.device.label}</strong><small>{snapshot.device.kind} · {snapshot.device.id}</small></div>
    <div className="device-workbench-tabs" role="tablist" aria-label="Device workbench view">
      <button type="button" role="tab" aria-selected={tab==='config'} className={tab==='config'?'active':''} onClick={()=>setTab('config')}>CONFIG <b>{snapshot.configRowCount}</b></button>
      <button type="button" role="tab" aria-selected={tab==='state'} className={tab==='state'?'active':''} onClick={()=>setTab('state')}>STATE <b>{snapshot.stateRowCount}</b></button>
      <button type="button" role="tab" aria-selected={tab==='events'} className={tab==='events'?'active':''} onClick={()=>setTab('events')}>EVENTS <b>{snapshot.events.length}</b></button>
    </div>
    {tab==='events'?<div className="device-workbench-events">{snapshot.events.length===0?<small>NO SESSION EVENTS FOR THIS DEVICE</small>:snapshot.events.map((event)=><article key={event.id} className={`category-${event.category}`}><div><span>#{String(event.sequence).padStart(3,'0')} · {event.category.toUpperCase()}</span>{event.causeId&&<i>CAUSE {event.causeId.replace('wb-event-','#')}</i>}</div><strong>{event.summary}</strong><p>{event.detail}</p>{event.causeChain.length>1&&<details><summary>CAUSAL CHAIN · {event.causeChain.length} EVENTS</summary><div className="device-workbench-event-chain">{event.causeChain.map((step)=><small key={step.id}><b>{step.label}</b>{step.detail}</small>)}</div></details>}</article>)}</div>:<div className="device-workbench-sections">{sections.map((section)=><section key={section.id}><div className="device-workbench-section-title"><span>{section.title}</span><strong>{section.summary}</strong></div>{section.rows.length===0?<small className="device-workbench-empty">{section.summary}</small>:section.rows.map((entry)=><article key={entry.id} className={`status-${entry.status}`}><div><span>{entry.label}</span><strong>{entry.value}</strong></div><p>{entry.detail}</p><Why row={entry}/></article>)}</section>)}</div>}
    <small className="builder-routing-note device-workbench-boundary">CONFIG IS PERSISTED CANONICAL TRUTH · STATE + EVENTS ARE DERIVED / SESSION-ONLY · WHY CHAINS FOLLOW STRUCTURED MODEL CAUSALITY, NOT GENERATED GUESSES.</small>
  </section>;
}
