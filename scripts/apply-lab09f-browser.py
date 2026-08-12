from pathlib import Path

path = Path('scripts/performance-profile.mjs')
source = path.read_text()

helper_anchor = "async function exerciseMeasuredWorkspace(cdp, profile) {\n"
if helper_anchor not in source:
    raise SystemExit('exerciseMeasuredWorkspace anchor missing')
if 'async function exerciseLoopbackBridgeWorkspace' in source:
    raise SystemExit('Lab 09F browser helper already present')

helper = r'''async function exerciseLoopbackBridgeWorkspace(cdp, profile) {
  const bridgeReport = JSON.parse(readFileSync(measuredFixturePath, 'utf8'));
  const handshake = {
    schema: 'hopscotch.network-diagnostics-bridge',
    version: 1,
    application: 'Network Diagnostics Suite',
    reportSchemaVersion: '2.0',
    reportPath: '/api/hopscotch/v1/report',
    bridgeVersion: '0.1.0-ci',
    capabilities: ['report-v2'],
  };

  await cdp.evaluate(`(()=>{
    const handshake=${JSON.stringify(handshake)};
    const report=${JSON.stringify(bridgeReport)};
    const originalFetch=globalThis.fetch;
    const mock={mode:'network-error',calls:[],handshake,report,originalFetch};
    globalThis.__hopscotchBridgeMock=mock;
    globalThis.fetch=async(input,init={})=>{
      const url=typeof input==='string'?input:(input?.url??String(input));
      mock.calls.push({url,method:init.method??null,mode:init.mode??null,credentials:init.credentials??null,cache:init.cache??null,redirect:init.redirect??null});
      if(mock.mode==='network-error')throw new TypeError('Failed to fetch');
      if(url.endsWith('/api/hopscotch/v1/handshake')){
        const body=mock.mode==='bad-handshake'?{...handshake,schema:'wrong.bridge'}:handshake;
        return new Response(JSON.stringify(body),{status:200,headers:{'content-type':'application/json'}});
      }
      if(url.endsWith('/api/hopscotch/v1/report')){
        const body=mock.mode==='invalid-report'?{schemaVersion:'99.0'}:report;
        return new Response(JSON.stringify(body),{status:200,headers:{'content-type':'application/json'}});
      }
      throw new Error('Unexpected bridge URL: '+url);
    };
    return true;
  })()`);

  const setOrigin = async (value) => {
    const changed = await cdp.evaluate(`(()=>{
      const input=document.querySelector('.measured-bridge-origin input');
      if(!input)return false;
      const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;
      setter?.call(input,${JSON.stringify(value)});
      input.dispatchEvent(new Event('input',{bubbles:true}));
      return true;
    })()`);
    if (!changed) throw new Error(`${profile.id} could not set the loopback bridge origin.`);
  };

  const setMode = async (mode) => cdp.evaluate(`(()=>{globalThis.__hopscotchBridgeMock.mode=${JSON.stringify(mode)};return true})()`);
  const callCount = async () => cdp.evaluate(`globalThis.__hopscotchBridgeMock.calls.length`);
  const workspaceState = async () => cdp.evaluate(`(()=>({
    status:document.querySelector('.measured-workspace')?.getAttribute('data-bridge-status')??null,
    measured:document.querySelector('.measured-workspace')?.getAttribute('data-measured-loaded')??null,
    text:document.querySelector('.measured-workspace')?.innerText??'',
    innerWidth,
    scrollWidth:document.documentElement.scrollWidth,
    scrollY,
  }))()`);
  const assertViewport = async (label) => {
    const state = await workspaceState();
    if (state.scrollWidth > state.innerWidth) throw new Error(`${profile.id} ${label} horizontally overflows: ${state.scrollWidth} > ${state.innerWidth}.`);
    if (state.scrollY !== 0) throw new Error(`${profile.id} ${label} moved document scrollY to ${state.scrollY}.`);
    return state;
  };

  await setOrigin('http://192.168.1.50:8765');
  await measuredClickButton(cdp, '.measured-bridge-actions button', 'CONNECT');
  await waitForExpression(cdp, `document.querySelector('.measured-workspace')?.getAttribute('data-bridge-status')==='unavailable'`, 8000);
  if (await callCount() !== 0) throw new Error(`${profile.id} non-loopback input reached fetch instead of failing before network access.`);
  let state = await assertViewport('private-LAN rejection');
  if (state.measured !== 'false') throw new Error(`${profile.id} private-LAN rejection changed measured state.`);

  await setOrigin('http://127.0.0.1:8765');
  await setMode('network-error');
  await measuredClickButton(cdp, '.measured-bridge-actions button', 'CONNECT');
  await waitForExpression(cdp, `document.querySelector('.measured-workspace')?.getAttribute('data-bridge-status')==='unavailable'`, 8000);
  if (await callCount() !== 1) throw new Error(`${profile.id} network-error connect did not perform exactly one handshake attempt.`);
  state = await assertViewport('network-error bridge');
  if (state.measured !== 'false') throw new Error(`${profile.id} network-error connect changed measured state.`);

  await setMode('bad-handshake');
  await measuredClickButton(cdp, '.measured-bridge-actions button', 'CONNECT');
  await waitForExpression(cdp, `document.querySelector('.measured-workspace')?.getAttribute('data-bridge-status')==='rejected'`, 8000);
  if (await callCount() !== 2) throw new Error(`${profile.id} bad-handshake connect did not perform exactly one request.`);
  state = await assertViewport('bad-handshake bridge');
  if (state.measured !== 'false') throw new Error(`${profile.id} rejected handshake changed measured state.`);

  await setMode('good');
  await measuredClickButton(cdp, '.measured-bridge-actions button', 'CONNECT');
  await waitForExpression(cdp, `document.querySelector('.measured-workspace')?.getAttribute('data-bridge-status')==='connected'`, 8000);
  if (await callCount() !== 3) throw new Error(`${profile.id} successful Connect performed more than the one handshake request.`);
  state = await assertViewport('connected bridge');
  if (state.measured !== 'false') throw new Error(`${profile.id} Connect created measured truth before Refresh Report.`);
  if (!state.text.includes('Network Diagnostics Suite') || !state.text.includes('0.1.0-ci')) throw new Error(`${profile.id} did not show validated bridge identity/version after Connect.`);

  await measuredClickButton(cdp, '.measured-bridge-actions button', 'REFRESH REPORT');
  await waitForExpression(cdp, `document.querySelector('.measured-workspace')?.getAttribute('data-measured-loaded')==='true'`, 8000);
  await waitForExpression(cdp, `document.body.innerText.includes('Network Diagnostics Engine')`, 8000);
  if (await callCount() !== 4) throw new Error(`${profile.id} first Refresh Report did not perform exactly one report request.`);
  state = await assertViewport('valid bridge refresh');
  if (state.status !== 'connected') throw new Error(`${profile.id} valid report refresh changed bridge connection state.`);
  if (!state.text.includes('LOCAL BRIDGE · REPORT V2')) throw new Error(`${profile.id} valid bridge refresh was not identified as the local bridge report.`);

  await setMode('invalid-report');
  await measuredClickButton(cdp, '.measured-bridge-actions button', 'REFRESH REPORT');
  await waitForExpression(cdp, `document.body.innerText.includes('PREVIOUS VALID MEASUREMENT REMAINS ACTIVE.')`, 8000);
  if (await callCount() !== 5) throw new Error(`${profile.id} invalid report refresh did not perform exactly one request.`);
  state = await assertViewport('invalid bridge refresh');
  if (state.status !== 'connected' || state.measured !== 'true') throw new Error(`${profile.id} invalid report refresh discarded connection or previous valid measurement.`);
  if (!state.text.includes('Network Diagnostics Engine')) throw new Error(`${profile.id} invalid report refresh lost the previous valid report.`);

  await measuredClickButton(cdp, '.measured-heading-actions button', 'CLEAR');
  await waitForExpression(cdp, `document.querySelector('.measured-workspace')?.getAttribute('data-measured-loaded')==='false'`, 8000);
  state = await assertViewport('clear while connected');
  if (state.status !== 'connected') throw new Error(`${profile.id} Clear silently disconnected the bridge.`);

  await setMode('good');
  await measuredClickButton(cdp, '.measured-bridge-actions button', 'REFRESH REPORT');
  await waitForExpression(cdp, `document.querySelector('.measured-workspace')?.getAttribute('data-measured-loaded')==='true'`, 8000);
  if (await callCount() !== 6) throw new Error(`${profile.id} re-refresh after Clear did not issue exactly one report request.`);
  await measuredClickButton(cdp, '.measured-bridge-actions button', 'DISCONNECT');
  await waitForExpression(cdp, `document.querySelector('.measured-workspace')?.getAttribute('data-bridge-status')==='disconnected'`, 8000);
  state = await assertViewport('disconnect with measured report');
  if (state.measured !== 'true') throw new Error(`${profile.id} Disconnect erased the last valid measured report.`);

  await measuredClickButton(cdp, '.measured-heading-actions button', 'CLEAR');
  await waitForExpression(cdp, `document.querySelector('.measured-workspace')?.getAttribute('data-measured-loaded')==='false'`, 8000);
  state = await assertViewport('bridge flow reset');
  if (state.status !== 'disconnected') throw new Error(`${profile.id} Clear mutated disconnected bridge state.`);

  const requests = await cdp.evaluate(`globalThis.__hopscotchBridgeMock.calls`);
  for (const request of requests) {
    if (!request.url.endsWith('/api/hopscotch/v1/handshake') && !request.url.endsWith('/api/hopscotch/v1/report')) {
      throw new Error(`${profile.id} bridge browser flow used an unexpected URL: ${request.url}`);
    }
    if (request.credentials !== 'omit' || request.mode !== 'cors' || request.cache !== 'no-store' || request.redirect !== 'error') {
      throw new Error(`${profile.id} bridge browser request lost bounded CORS/no-credential/no-cache/no-redirect options.`);
    }
  }

  await cdp.evaluate(`(()=>{const mock=globalThis.__hopscotchBridgeMock;if(mock?.originalFetch)globalThis.fetch=mock.originalFetch;delete globalThis.__hopscotchBridgeMock;return true})()`);
  return {
    privateLanRejectedBeforeFetch: true,
    networkFailureSurfaced: true,
    badHandshakeRejected: true,
    connectDidNotMeasure: true,
    validRefreshLoaded: true,
    invalidRefreshPreservedPrevious: true,
    clearKeptConnection: true,
    disconnectKeptMeasurement: true,
    requestCount: requests.length,
  };
}

'''
source = source.replace(helper_anchor, helper + helper_anchor, 1)

flow_anchor = "  await waitForExpression(cdp, `document.body.innerText.includes('NO LOCAL MEASUREMENT LOADED')`);\n\n  await setFileInput(cdp, '.measured-file-input', measuredFixturePath);"
if flow_anchor not in source:
    raise SystemExit('measured workspace flow anchor missing')
source = source.replace(
    flow_anchor,
    "  await waitForExpression(cdp, `document.body.innerText.includes('NO LOCAL MEASUREMENT LOADED')`);\n\n  const bridgeInteraction = await exerciseLoopbackBridgeWorkspace(cdp, profile);\n\n  await setFileInput(cdp, '.measured-file-input', measuredFixturePath);",
    1,
)

return_anchor = "  return {\n    validFactCount: loaded.factCount,"
if return_anchor not in source:
    raise SystemExit('measured workspace return anchor missing')
source = source.replace(
    return_anchor,
    "  return {\n    bridge: bridgeInteraction,\n    validFactCount: loaded.factCount,",
    1,
)

path.write_text(source)
print('Applied Lab 09F mocked loopback bridge coverage to production compatibility profiles.')
