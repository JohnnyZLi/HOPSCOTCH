import assert from 'node:assert/strict';

// Browser-contract evidence for the shared renderer, not visual acceptance.
export async function reviewedSceneGeometry(cdp, label, expectedEvent) {
  const deadline=Date.now()+5000;
  while(Date.now()<deadline){
    const ready=await cdp.evaluate(`(()=>{
      const root=document.querySelector('.review-runtime'),snapshot=root?.causalStudy?.snapshot();
      const actor=root?.querySelector('.rv-actor[aria-hidden="false"]');
      return Boolean(snapshot?.plan&&snapshot.at&&actor?.getBoundingClientRect().width>0&&
        (!${JSON.stringify(expectedEvent??null)}||snapshot.frames[snapshot.at.index].id===${JSON.stringify(expectedEvent??null)}));
    })()`);
    if(ready)break;
    await new Promise(resolve=>setTimeout(resolve,30));
  }
  const geometry = await cdp.evaluate(`(()=>{
    const root=document.querySelector('.review-runtime'),snapshot=root?.causalStudy?.snapshot();
    if(!root||!snapshot?.plan)return null;
    const frame=snapshot.frames[snapshot.at.index],plan=snapshot.plan;
    const stage=root.querySelector('.rv-stage'),path=root.querySelector('.rv-path');
    const actor=root.querySelector('.rv-actor[aria-hidden="false"]');
    const rect=node=>{if(!node)return null;const r=node.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}};
    const peers=[...root.querySelectorAll('.rv-endpoint')].map(node=>({text:node.textContent,box:rect(node),font:parseFloat(getComputedStyle(node).fontSize)}));
    return {event:frame.id,sourceTime:frame.at,kind:frame.kind,local:frame.local,
      sourceUnchanged:frame.event?.id===frame.id&&frame.event?.atMs===frame.at,
      endpoints:frame.endpoints,peers,stage:rect(stage),path:rect(path),actor:rect(actor),
      ports:plan.ports,compactWidth:plan.compactW,
      fields:[...(actor?.querySelectorAll('.rv-field')??[])].filter(n=>!n.hidden).map(n=>({id:n.dataset.field,label:n.querySelector('.rv-field-label')?.textContent,value:n.querySelector('.rv-field-value')?.textContent,font:parseFloat(getComputedStyle(n.querySelector('.rv-field-value')).fontSize)})),
      sourceFields:frame.fields,scrollWidth:document.documentElement.scrollWidth,viewport:innerWidth,
      budgets:plan.starts.map((start,i)=>(plan.starts[i+1]??plan.total)-start),
    };
  })()`);
  assert.ok(geometry?.actor && geometry.path && geometry.stage, `${label}: reviewed scene is not measurable.`);
  if (expectedEvent) assert.equal(geometry.event, expectedEvent, `${label}: source selection changed.`);
  assert.equal(geometry.sourceUnchanged, true, `${label}: presentation changed the source event/time.`);
  assert.deepEqual(geometry.peers.map(peer=>peer.text), geometry.endpoints, `${label}: wire endpoints disagree with the source projection.`);
  assert.ok(geometry.peers.every(peer=>peer.font>=12&&peer.box.left>=geometry.stage.left-1&&peer.box.right<=geometry.stage.right+1), `${label}: peer labels are small or clipped.`);
  const left=geometry.stage.left+geometry.ports.a.x+geometry.compactWidth/2;
  const right=geometry.stage.left+geometry.ports.b.x+geometry.compactWidth/2;
  assert.ok(Math.abs(geometry.path.left-left)<=.75&&Math.abs(geometry.path.right-right)<=.75, `${label}: path misses the measured compact endpoints.`);
  assert.ok(geometry.actor.left>=geometry.stage.left-1&&geometry.actor.right<=geometry.stage.right+1, `${label}: active object escapes its horizontal stage.`);
  assert.ok(geometry.fields.length>0&&geometry.fields.every(field=>field.font>=12), `${label}: actual fields are missing or unreadably small.`);
  assert.deepEqual(geometry.fields.map(({id,label,value})=>({id,label,value})), geometry.sourceFields.map(({id,label,value})=>({id,label,value:String(value)})), `${label}: visible object fields disagree with the source projection.`);
  assert.ok(geometry.budgets.every(value=>Number.isFinite(value)&&value>0), `${label}: measured reading budget is invalid.`);
  assert.ok(geometry.scrollWidth<=geometry.viewport+1, `${label}: document horizontally overflows.`);
  return geometry;
}

export async function seekReviewedSource(cdp, timeMs) {
  assert.equal(await cdp.evaluate(`(()=>{
    const play=document.querySelector('.visual-time-rail__controls button');
    if(play?.getAttribute('aria-label')==='Pause scenario')play.click();
    const input=document.querySelector('input[aria-label="Scenario time"]');if(!input)return false;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(String(timeMs))});
    input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));return true;
  })()`),true,'Source time control is unavailable.');
}
