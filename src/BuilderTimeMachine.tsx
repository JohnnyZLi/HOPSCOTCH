import { useEffect, useState } from 'react';
import { builderTimelineSnapshotAtSequence, type BuilderTimeline } from './builder/timeline.ts';
import './BuilderTimeMachine.css';

function formatTime(ms:number):string{const total=Math.max(0,Math.round(ms));const minutes=Math.floor(total/60000);const seconds=Math.floor((total%60000)/1000);const millis=total%1000;return String(minutes).padStart(2,'0')+':'+String(seconds).padStart(2,'0')+'.'+String(millis).padStart(3,'0');}

export function BuilderTimeMachine({timeline,cursor,onSeek}:{timeline:BuilderTimeline;cursor:number|null;onSeek:(sequence:number|null)=>void;}){
  const [playing,setPlaying]=useState(false);
  const snapshots=timeline.snapshots;
  const latest=snapshots.at(-1)??null;
  const selected=cursor==null?latest:builderTimelineSnapshotAtSequence(timeline,cursor);
  const selectedIndex=selected?snapshots.findIndex((snapshot)=>snapshot.sequence===selected.sequence):-1;
  const isLive=cursor==null;

  useEffect(()=>{
    if(!playing||snapshots.length<2)return;
    const timer=window.setInterval(()=>{
      const current=cursor==null?0:Math.max(0,snapshots.findIndex((snapshot)=>snapshot.sequence===cursor));
      const nextIndex=cursor==null?0:current+1;
      if(nextIndex>=snapshots.length){setPlaying(false);onSeek(null);return;}
      onSeek(snapshots[nextIndex].sequence);
    },650);
    return()=>window.clearInterval(timer);
  },[playing,cursor,snapshots,onSeek]);

  if(!latest||!selected)return <section className="builder-time-machine"><div className="control-title"><span>BUILDER TIME MACHINE</span><strong>CAPTURING</strong></div><small className="builder-routing-note">WAITING FOR THE INITIAL CANONICAL SNAPSHOT.</small></section>;

  const previous=selectedIndex>0?snapshots[selectedIndex-1]:null;
  const next=selectedIndex>=0&&selectedIndex<snapshots.length-1?snapshots[selectedIndex+1]:null;
  const startPlayback=()=>{if(snapshots.length<2)return;if(isLive)onSeek(snapshots[0].sequence);setPlaying(true);};

  return <section className={`builder-time-machine ${isLive?'is-live':'is-history'}`} data-builder-timeline-sequence={selected.sequence}>
    <div className="control-title"><span>BUILDER TIME MACHINE</span><strong>{isLive?'LIVE':`HISTORY · #${String(selected.sequence).padStart(3,'0')}`}</strong></div>
    <div className="builder-time-readout"><span>EVENT CLOCK</span><strong>{formatTime(selected.atMs)}</strong><small>#{String(selected.sequence).padStart(3,'0')} · {selected.category.toUpperCase()} · {selected.kind.toUpperCase().replaceAll('-', ' ')}</small></div>
    <div className="builder-time-event"><strong>{selected.summary}</strong><p>{selected.detail}</p></div>
    <input aria-label="Builder historical event timeline" type="range" min={snapshots[0].sequence} max={latest.sequence} step="1" value={selected.sequence} onChange={(event)=>{setPlaying(false);onSeek(Number(event.currentTarget.value));}} disabled={snapshots.length<2}/>
    <div className="builder-time-controls">
      <button type="button" disabled={!previous} onClick={()=>{setPlaying(false);if(previous)onSeek(previous.sequence);}}>←</button>
      <button type="button" disabled={snapshots.length<2} onClick={()=>playing?setPlaying(false):startPlayback()}>{playing?'Ⅱ':'▶'}</button>
      <button type="button" disabled={!next} onClick={()=>{setPlaying(false);if(next)onSeek(next.sequence);}}>→</button>
      <button type="button" className={isLive?'active':''} onClick={()=>{setPlaying(false);onSeek(null);}}>LIVE</button>
    </div>
    <div className="builder-time-markers" aria-hidden="true">{snapshots.slice(-20).map((snapshot)=><i key={snapshot.eventId} className={snapshot.sequence<=selected.sequence?'passed':''} title={`#${snapshot.sequence} ${snapshot.kind.toUpperCase()} · ${snapshot.summary}`}/>)}</div>
    <small className="builder-routing-note">DETERMINISTIC EVENT CLOCK · THE ENTIRE BUILDER SCENE IS PROJECTED FROM THIS SNAPSHOT · AUTHORING IS LOCKED UNTIL LIVE.</small>
  </section>;
}
