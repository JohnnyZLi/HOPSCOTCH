import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {WORKSPACE_IDS,WORKSPACE_CATALOG} from '../src/workspace-catalog.ts';
import {resolveAppRoute} from '../src/navigation.ts';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

export function checkCompletePresentation(){
 const entry=read('src/main.tsx'),app=read('src/App.tsx'),workspace=read('src/redesign/CompleteWorkspace.tsx'),lifecycle=read('src/redesign/lifecycle-runtime.js'),builder=read('src/redesign/builder-runtime.js'),evidence=read('src/redesign/evidence-runtime.js'),home=read('src/redesign/home-runtime.js'),models=read('src/redesign/lifecycle-data.ts');
 assert.deepEqual([...entry.matchAll(/import '([^']+\.css)'/g)].map(match=>match[1]),['./redesign/app.css','./redesign/lifecycle-runtime.css'],'The approved composition must own the complete stylesheet entry.');
 assert.doesNotMatch(app+entry+workspace,/KineticOverview|CornerNavigator|VisualWorkspaceShell|ReviewedScene|reviewed-primary|SiteEditorial|JourneyDefaultLight/,'Legacy presentation must not remain mounted behind the replacement.');
 assert.match(app,/resolveAppRoute\(url.pathname,url.search\)/);assert.match(app,/addEventListener\('popstate'/);assert.match(app,/history.pushState/);assert.match(app,/history.replaceState/);assert.match(app,/document.title=/);
 for(const id of WORKSPACE_IDS)assert.equal(resolveAppRoute(WORKSPACE_CATALOG[id].path).destination,id);
 for(const name of ['mountLifecycle','mountBuilder','mountEvidence','mountHome'])assert.ok(workspace.includes(name),'Missing complete workspace '+name);
 for(const token of ['rv-header-identity','rv-header-tools','rv-title','rv-subtitle','rv-console','rv-event-picker','rv-speed','rv-scrub'])assert.ok(lifecycle.includes(token),'Approved lifecycle composition lost '+token);
 assert.ok(lifecycle.includes("dataset.integrated='false'"));assert.doesNotMatch(workspace,/data-integrated="true"/);
 for(const source of [lifecycle,builder,evidence,home])assert.ok(source.includes('scope.dispose()'),'A complete mount must dispose owned graphics, frames, listeners, and observers.');
 assert.match(lifecycle,/function save\(\)/);assert.match(lifecycle,/function restore\(value\)/);assert.match(workspace,/api.save/);assert.match(workspace,/api.restore/);assert.match(app,/Return to paused Journey/);
 for(const source of ['tcpStateAt','dnsStateAt','tlsStateAt','httpComparisonStateAt','lab01StateAt','journeyStateAt','buildPacket','createProviderData'])assert.ok(models.includes(source),'Production source missing '+source);
 assert.doesNotMatch(models,/source-data\.json|workspace-reference-models|referenceModels:\s*\[[^\]]/);
 assert.match(evidence,/parseCaptureSessionAsync\(buffer\)/);assert.match(evidence,/record.bytes.copy\(\)/);assert.match(evidence,/capturedLength/);assert.match(evidence,/fileEpoch/);assert.match(evidence,/importedCapture=true/);
 assert.doesNotMatch(evidence,/function showLiveWorkspace|iframe/);assert.doesNotMatch(home,/createElement\('iframe'\)|node\('iframe'/);
 assert.match(evidence,/connectLoopbackBridge/);assert.match(evidence,/fetchLoopbackBridgeReport/);assert.match(evidence,/\/api\/internet\/infrastructure/);assert.match(evidence,/\/api\/internet\/snapshot\?host=/);
 assert.match(evidence,/app-measured-change/);assert.match(evidence,/saveEvidence/);assert.match(evidence,/restoreEvidence/);assert.match(builder,/restoreBuilder/);assert.match(builder,/reconcileConfiguration/);
 const session=read('src/redesign/measurement-session.ts'),context=read('src/redesign/measured-context.ts');assert.match(session,/MeasuredSnapshotState\|null/);assert.doesNotMatch(session,/localStorage|sessionStorage|NativeMeasurementSnapshot|NetworkDiagnosticsIngestion/);assert.match(context,/measuredEvidenceForScene/);assert.match(context,/separate capture time/);assert.doesNotMatch(models,/measuredSession|measurement\//);
 const initial=read('src/redesign/evidence-data.ts');assert.match(initial,/measured:null,observed:null/);assert.match(initial,/frames:\[\]/);assert.doesNotMatch(initial,/source-data\.json|fixtures\/measured/);
 const appearance=read('src/redesign/appearance.ts'),html=read('index.html');assert.match(appearance,/return 'light'/);assert.match(appearance,/media.addEventListener\('change'/);assert.ok(html.indexOf('hopscotch.appearance')<html.indexOf('id="root"'),'Appearance must resolve before the app paints.');
 const controls=read('src/redesign/journey-controls.ts'),surface=read('src/redesign/surface.js');assert.match(controls,/SCENARIO_PRESET_CARDS/);assert.match(controls,/encodeJourneyQuery/);assert.match(controls,/decodeJourneyQuery/);assert.match(controls,/modifierIds/);assert.match(home,/mountSurface/);assert.match(surface,/WORKSPACE_CATALOG/);assert.match(surface,/navigate\(destinations.get\(path\)/);assert.match(surface,/mountDisclosureMenus/);assert.match(surface,/applyAppearance/);assert.doesNotMatch(read('src/redesign/home.html')+read('src/redesign/surface.html'),/<select|target=|https:\/\//);
 assert.doesNotMatch(app,/className="app-navigation"/,'One shared header owns app navigation.');
 assert.match(workspace,/mountWorkspaceSurface/);assert.match(workspace,/surface\?\.dispose\(\)/);
 console.log('Complete presentation contract passed: approved compositions own all routes; current model clocks, imports, session evidence, memory, and resource disposal remain bound.');
}
