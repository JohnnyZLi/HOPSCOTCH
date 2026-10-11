import fs from 'node:fs';
import assert from 'node:assert/strict';
import {environment} from './check-complete.mjs';
let checks=0;const eq=(a,b,message)=>{assert.deepEqual(a,b,message);checks++;},ok=(a,message)=>{assert.ok(a,message);checks++;};
const cases=[];
for(const kind of ['workbench','evidence','connected'])for(const theme of ['light','dark']){
 const e=await environment(kind,390);e.change('.rv-theme',theme);await e.flush();
 const container=e.document.createElement('section'),pane=e.document.createElement('section');e.q('.rv-main').append(container);container.append(pane);
 container.fixtureRect={left:0,top:0,width:600,height:600};container.fixtureStyle={fontSize:'14px',paddingLeft:'0px',paddingRight:'0px',columnGap:'24px','--rv-primary-min':'32em','--rv-detail-min':'20em'};
 let measurements=0;const clone=pane.cloneNode.bind(pane);pane.cloneNode=deep=>{const p=clone(deep);p.getBoundingClientRect=()=>{measurements++;return {left:0,top:0,width:600,height:parseFloat(container.fixtureStyle.fontSize)*20};};return p;};
 e.root.layoutReservation.watch(container,{panes:[pane],names:['scene']});eq(container.style.minHeight,'280px','Initial reservation follows measured content');
 container.fixtureStyle.fontSize='20px';e.root.layoutReservation.fit(container);eq(container.style.minHeight,'400px','Same-width text scaling invalidates retained height');
 const before=measurements;for(let i=0;i<8;i++)e.root.layoutReservation.fit(container);eq(measurements,before,'Stationary fit does not remeasure hidden panes');
 e.viewport(400);await e.flush();eq(container.style.minHeight,'340px','A viewport resize event refreshes retained height without a width change');
 e.viewport(900);await e.flush();eq(container.style.minHeight,'400px','Taller viewport event restores content-derived reservation');
 container.fixtureStyle.fontSize='14px';container.fixtureRect.width=728;container.fixtureStyle.columnGap='0px';eq(e.root.layoutReservation.fit(container).mode,'parallel','An explicit zero gap remains zero');
 container.fixtureRect.width=800;container.fixtureStyle.columnGap='10%';eq(e.root.layoutReservation.fit(container).mode,'exclusive','Percentage gap resolves against actual usable content width');
 container.fixtureRect.width=808.9;eq(e.root.layoutReservation.fit(container).mode,'parallel','Percentage gap boundary is derived, not a fixed device breakpoint');
 container.fixtureStyle.columnGap='normal';container.fixtureRect.width=728;eq(e.root.layoutReservation.fit(container).mode,'parallel','Normal grid gap has zero used width');
 const source=JSON.stringify(e.root.reviewData),removed=[],resizeListeners=e.windowEvents.get('resize').size;const remove=e.document.fonts.removeEventListener;e.document.fonts.removeEventListener=(type,fn)=>{removed.push({type,fn});remove(type,fn);};e.root.layoutReservation.dispose();ok(removed.some(r=>r.type==='loadingdone'&&typeof r.fn==='function'),'Layout disposal releases its font listener');eq(e.windowEvents.get('resize').size,resizeListeners-1,'Layout disposal releases its viewport listener');
 e.root.layoutReservation.refresh();ok(!e.root.layoutReservation.stats().pending);eq(JSON.stringify(e.root.reviewData),source,'Layout changes preserve source state');
 cases.push({kind,theme,checks:'text metrics, viewport height, zero/percentage/normal gaps, stationary work, font cleanup and source preservation'});
}
const auditDir=process.env.HOPSCOTCH_AUDIT_DIR||'complete-review/layout-continuation-audit';fs.mkdirSync(auditDir,{recursive:true});fs.writeFileSync(auditDir+'/layout-contracts.json',JSON.stringify({kind:'Focused actual-runtime tests with explicit synthetic measured content; no browser layout claim',checks,cases,manifest:JSON.parse(fs.readFileSync('complete-review/source-manifest.json'))},null,2));console.log('PASS layout continuation',checks);
