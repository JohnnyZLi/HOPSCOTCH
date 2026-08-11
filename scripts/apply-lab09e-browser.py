from pathlib import Path

path = Path('scripts/performance-profile.mjs')
text = path.read_text()

old_profiles = """if (compatibility) profiles.push(
  { id: 'measured-workspace-desktop', width: 1440, height: 1000, reducedMotion: false, query: '', readySelector: '.overview-scene', measuredWorkspace: true, expected: ['LOCAL MEASURED · BOUNDED · NOT GLOBAL', 'Network Diagnostics Engine', 'NOT PROMOTED TO LOCAL MEASURED'] },
  { id: 'measured-workspace-mobile', width: 390, height: 844, reducedMotion: false, query: '', readySelector: '.overview-scene', measuredWorkspace: true, expected: ['LOCAL MEASURED · BOUNDED · NOT GLOBAL', 'Network Diagnostics Engine'], assertMeasuredMobile: true },
  { id: 'measured-workspace-reduced-motion', width: 1280, height: 900, reducedMotion: true, query: '', readySelector: '.overview-scene', measuredWorkspace: true, expected: ['LOCAL MEASURED · BOUNDED · NOT GLOBAL', 'Network Diagnostics Engine'] },
);
"""
new_profiles = """if (compatibility) profiles.push(
  { id: 'measured-workspace-desktop', width: 1440, height: 1000, reducedMotion: false, query: '', readySelector: '.overview-scene', measuredWorkspace: true, expected: ['LOCAL MEASURED · BOUNDED · NOT GLOBAL', 'Network Diagnostics Engine', 'NOT PROMOTED TO LOCAL MEASURED'] },
  { id: 'measured-workspace-mobile', width: 390, height: 844, reducedMotion: false, query: '', readySelector: '.overview-scene', measuredWorkspace: true, expected: ['LOCAL MEASURED · BOUNDED · NOT GLOBAL', 'Network Diagnostics Engine'], assertMeasuredMobile: true },
  { id: 'measured-workspace-reduced-motion', width: 1280, height: 900, reducedMotion: true, query: '', readySelector: '.overview-scene', measuredWorkspace: true, expected: ['LOCAL MEASURED · BOUNDED · NOT GLOBAL', 'Network Diagnostics Engine'] },
  { id: 'measured-sidecars-desktop', width: 1440, height: 1000, reducedMotion: false, query: '', readySelector: '.overview-scene', measuredSidecars: true, expected: ['ONE REQUEST.', 'BREAK THE PATH.'] },
  { id: 'measured-sidecars-mobile', width: 390, height: 844, reducedMotion: false, query: '', readySelector: '.overview-scene', measuredSidecars: true, expected: ['ONE REQUEST.', 'BREAK THE PATH.'] },
  { id: 'measured-sidecars-reduced-motion', width: 1280, height: 900, reducedMotion: true, query: '', readySelector: '.overview-scene', measuredSidecars: true, expected: ['ONE REQUEST.', 'BREAK THE PATH.'] },
);
"""
if old_profiles not in text:
    raise SystemExit('Lab 09E compatibility profile anchor missing')
text = text.replace(old_profiles, new_profiles, 1)

anchor = """async function loadProfile(cdp, artifact, profile) {
"""
helper = r'''async function measuredClickButton(cdp, selector, text) {
  const clicked = await cdp.evaluate(`(()=>{
    const button=[...document.querySelectorAll(${JSON.stringify(selector)})].find((candidate)=>candidate.textContent?.includes(${JSON.stringify(text)}));
    if(!button)return false;
    button.click();
    return true;
  })()`);
  if (!clicked) throw new Error(`Unable to click ${selector} containing ${JSON.stringify(text)}.`);
}

async function measuredViewportState(cdp) {
  return cdp.evaluate(`(()=>({
    innerWidth,
    scrollWidth:document.documentElement.scrollWidth,
    scrollY,
    sidecar:document.querySelector('.journey-measured-sidecar')?.innerText ?? null,
    compatibility:document.querySelector('.journey-measured-sidecar')?.getAttribute('data-measured-compatibility') ?? null,
    scene:document.querySelector('.journey-measured-sidecar')?.getAttribute('data-measured-scene') ?? null,
    activeEvent:document.querySelector('.journey-event.current strong')?.textContent ?? null,
  }))()`);
}

function assertMeasuredViewport(profile, state, label) {
  if (state.scrollWidth > state.innerWidth) throw new Error(`${profile.id} ${label} horizontally overflows: ${state.scrollWidth} > ${state.innerWidth}.`);
  if (state.scrollY !== 0) throw new Error(`${profile.id} ${label} moved document scrollY to ${state.scrollY}.`);
}

async function exerciseMeasuredJourneySidecars(cdp, profile) {
  await measuredClickButton(cdp, 'button', 'Inspect measured report');
  await waitForExpression(cdp, `Boolean(document.querySelector('.measured-workspace'))`);
  await setFileInput(cdp, '.measured-file-input', measuredFixturePath);
  await waitForExpression(cdp, `document.querySelector('.measured-workspace')?.getAttribute('data-measured-loaded')==='true'`, 8000);
  await measuredClickButton(cdp, '.measured-heading-actions button', 'EXIT LAB');
  await waitForExpression(cdp, `Boolean(document.querySelector('.overview-scene'))`);
  await measuredClickButton(cdp, 'button', 'Play URL journey');
  await waitForExpression(cdp, `Boolean(document.querySelector('.journey-workspace'))`, 8000);

  await measuredClickButton(cdp, '.journey-event', 'Default gateway selected');
  await waitForExpression(cdp, `document.querySelector('.journey-measured-sidecar')?.getAttribute('data-measured-compatibility')==='local-context'`, 8000);
  const routing = await measuredViewportState(cdp);
  assertMeasuredViewport(profile, routing, 'routing sidecar');
  if (routing.scene !== 'routing' || routing.activeEvent !== 'Default gateway selected') throw new Error(`${profile.id} did not bind LOCAL CONTEXT to the routing phase.`);
  if (!routing.sidecar?.includes('LOCAL MEASURED') || !routing.sidecar.includes('LOCAL CONTEXT') || !routing.sidecar.includes('SIMULATED STORY UNCHANGED')) throw new Error(`${profile.id} routing sidecar lost provenance/boundary language.`);

  await measuredClickButton(cdp, '.journey-event', 'Stub asks recursive resolver');
  await waitForExpression(cdp, `document.querySelector('.journey-measured-sidecar')?.getAttribute('data-measured-compatibility')==='matched-target'`, 8000);
  const dns = await measuredViewportState(cdp);
  assertMeasuredViewport(profile, dns, 'DNS sidecar');
  if (dns.scene !== 'dns' || !dns.sidecar?.includes('MATCHED TARGET') || !dns.sidecar.includes('8 ms')) throw new Error(`${profile.id} DNS sidecar did not expose exact-target measured DNS context.`);

  await measuredClickButton(cdp, '.journey-event', 'TCP connection established');
  await waitForExpression(cdp, `document.querySelector('.journey-measured-sidecar')?.getAttribute('data-measured-compatibility')==='matched-target'`, 8000);
  const transport = await measuredViewportState(cdp);
  assertMeasuredViewport(profile, transport, 'transport sidecar');
  if (transport.scene !== 'transport' || !transport.sidecar?.includes('MATCHED TARGET')) throw new Error(`${profile.id} transport sidecar did not expose exact-target context.`);
  if (transport.sidecar.includes('500 Mbps')) throw new Error(`${profile.id} leaked other-target speed-test throughput into matched Journey transport evidence.`);
  if (!transport.sidecar.includes('OTHER-TARGET FACT')) throw new Error(`${profile.id} did not disclose that other-target transport facts were hidden.`);

  const changedHost = await cdp.evaluate(`(()=>{
    const input=document.querySelector('.journey-config input');
    const form=document.querySelector('.journey-config');
    if(!input||!form)return false;
    const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;
    setter?.call(input,'other.test');
    input.dispatchEvent(new Event('input',{bubbles:true}));
    form.requestSubmit();
    return true;
  })()`);
  if (!changedHost) throw new Error(`${profile.id} could not change Journey hostname for mismatch validation.`);
  await waitForExpression(cdp, `document.querySelector('.journey-config input')?.value==='other.test'`, 8000);
  await measuredClickButton(cdp, '.journey-event', 'TCP connection established');
  await waitForExpression(cdp, `document.querySelector('.journey-measured-sidecar')?.getAttribute('data-measured-compatibility')==='other-target'`, 8000);
  const mismatch = await measuredViewportState(cdp);
  assertMeasuredViewport(profile, mismatch, 'mismatched transport sidecar');
  if (!mismatch.sidecar?.includes('NO COMPATIBLE TRANSPORT TARGET') || !mismatch.sidecar.includes('OTHER TARGET')) throw new Error(`${profile.id} mismatched target did not fail closed visibly.`);
  if (mismatch.sidecar.includes('500 Mbps') || mismatch.sidecar.includes('24 ms') || mismatch.sidecar.includes('17 ms')) throw new Error(`${profile.id} rendered mismatched measured values as Journey evidence.`);

  await measuredClickButton(cdp, '.journey-heading-actions button', 'EXIT JOURNEY');
  await waitForExpression(cdp, `Boolean(document.querySelector('.overview-scene'))`);
  await measuredClickButton(cdp, 'button', 'Inspect measured report');
  await waitForExpression(cdp, `document.querySelector('.measured-workspace')?.getAttribute('data-measured-loaded')==='true'`, 8000);
  await measuredClickButton(cdp, '.measured-clear', 'CLEAR');
  await waitForExpression(cdp, `document.querySelector('.measured-workspace')?.getAttribute('data-measured-loaded')==='false'`, 8000);
  await measuredClickButton(cdp, '.measured-heading-actions button', 'EXIT LAB');
  await waitForExpression(cdp, `Boolean(document.querySelector('.overview-scene'))`);
  await measuredClickButton(cdp, 'button', 'Play URL journey');
  await waitForExpression(cdp, `Boolean(document.querySelector('.journey-workspace'))`, 8000);
  await measuredClickButton(cdp, '.journey-event', 'Default gateway selected');
  await sleep(120);
  if (await cdp.evaluate(`Boolean(document.querySelector('.journey-measured-sidecar'))`)) throw new Error(`${profile.id} measured sidecar survived explicit Lab 09 Clear.`);
  const cleared = await measuredViewportState(cdp);
  assertMeasuredViewport(profile, cleared, 'cleared Journey');

  return {
    routingCompatibility: routing.compatibility,
    dnsCompatibility: dns.compatibility,
    transportCompatibility: transport.compatibility,
    mismatchCompatibility: mismatch.compatibility,
    otherTargetValuesHidden: true,
    clearRemovedSidecars: true,
  };
}

'''
if anchor not in text:
    raise SystemExit('Lab 09E loadProfile anchor missing')
text = text.replace(anchor, helper + anchor, 1)

old_interaction = """  const measuredInteraction = profile.measuredWorkspace ? await exerciseMeasuredWorkspace(cdp, profile) : null;
  const readyMs = performance.now() - startedAt;
"""
new_interaction = """  const measuredInteraction = profile.measuredWorkspace
    ? await exerciseMeasuredWorkspace(cdp, profile)
    : profile.measuredSidecars
      ? await exerciseMeasuredJourneySidecars(cdp, profile)
      : null;
  const readyMs = performance.now() - startedAt;
"""
if old_interaction not in text:
    raise SystemExit('Lab 09E measured interaction anchor missing')
text = text.replace(old_interaction, new_interaction, 1)

path.write_text(text)
