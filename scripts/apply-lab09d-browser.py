from pathlib import Path

path = Path('scripts/performance-profile.mjs')
text = path.read_text()

replacements = [
    (
        "const reportPath = resolve(root, process.env.HOPSCOTCH_REPORT_PATH?.trim() || 'artifacts/performance-profile.json');\n",
        "const reportPath = resolve(root, process.env.HOPSCOTCH_REPORT_PATH?.trim() || 'artifacts/performance-profile.json');\nconst measuredFixturePath = resolve(root, 'scripts/fixtures/measured-workspace-v2.json');\nconst measuredInvalidFixturePath = resolve(root, 'scripts/fixtures/measured-workspace-invalid.json');\n",
    ),
    (
        "profiles.push(\n  { id: 'stress-as-canvas', stress: true, width: 1440, height: 1000, reducedMotion: true, query: query({ stress: 'as-density' }), readySelector: '.internet-scale', expected: ['POLICY MAKES', 'SIMULATED WINNER'], stressExpected: { profile: 'as-density', asNodes: 160, asRelationships: 220 } },\n  { id: 'stress-builder-ceiling', stress: true, width: 1440, height: 1000, reducedMotion: true, query: query({ stress: 'builder-density' }), readySelector: '.builder-workspace', expected: ['32 NODES · 96 LINKS', 'ROUTE INSTALLED'], stressExpected: { profile: 'builder-density', builderNodes: 32, builderLinks: 96 } },\n  { id: 'stress-physical-webgl', stress: true, width: 1440, height: 1000, reducedMotion: true, query: query({ stress: 'physical-density' }), readySelector: '.physical-globe', expected: gpuMode === 'disabled' ? ['SIMULATED · STRESS FIXTURE', 'SIMULATED STRESS POINTS · NOT PUBLIC DATA', 'FALLBACK', 'WEBGL 2 UNAVAILABLE'] : ['SIMULATED · STRESS FIXTURE', 'SIMULATED STRESS POINTS · NOT PUBLIC DATA', 'WEBGL 2'], stressExpected: { profile: 'physical-density', physicalPoints: 2000, webgl: gpuMode !== 'disabled' }, allowExpectedWebglFailure: gpuMode === 'disabled' },\n);\n",
        "profiles.push(\n  { id: 'stress-as-canvas', stress: true, width: 1440, height: 1000, reducedMotion: true, query: query({ stress: 'as-density' }), readySelector: '.internet-scale', expected: ['POLICY MAKES', 'SIMULATED WINNER'], stressExpected: { profile: 'as-density', asNodes: 160, asRelationships: 220 } },\n  { id: 'stress-builder-ceiling', stress: true, width: 1440, height: 1000, reducedMotion: true, query: query({ stress: 'builder-density' }), readySelector: '.builder-workspace', expected: ['32 NODES · 96 LINKS', 'ROUTE INSTALLED'], stressExpected: { profile: 'builder-density', builderNodes: 32, builderLinks: 96 } },\n  { id: 'stress-physical-webgl', stress: true, width: 1440, height: 1000, reducedMotion: true, query: query({ stress: 'physical-density' }), readySelector: '.physical-globe', expected: gpuMode === 'disabled' ? ['SIMULATED · STRESS FIXTURE', 'SIMULATED STRESS POINTS · NOT PUBLIC DATA', 'FALLBACK', 'WEBGL 2 UNAVAILABLE'] : ['SIMULATED · STRESS FIXTURE', 'SIMULATED STRESS POINTS · NOT PUBLIC DATA', 'WEBGL 2'], stressExpected: { profile: 'physical-density', physicalPoints: 2000, webgl: gpuMode !== 'disabled' }, allowExpectedWebglFailure: gpuMode === 'disabled' },\n);\n\nif (compatibility) profiles.push(\n  { id: 'measured-workspace-desktop', width: 1440, height: 1000, reducedMotion: false, query: '', readySelector: '.overview-scene', measuredWorkspace: true, expected: ['LOCAL MEASURED · BOUNDED · NOT GLOBAL', 'Network Diagnostics Engine', '500 Mbps', 'NOT PROMOTED TO LOCAL MEASURED'] },\n  { id: 'measured-workspace-mobile', width: 390, height: 844, reducedMotion: false, query: '', readySelector: '.overview-scene', measuredWorkspace: true, expected: ['LOCAL MEASURED · BOUNDED · NOT GLOBAL', 'Network Diagnostics Engine', '500 Mbps'], assertMeasuredMobile: true },\n  { id: 'measured-workspace-reduced-motion', width: 1280, height: 900, reducedMotion: true, query: '', readySelector: '.overview-scene', measuredWorkspace: true, expected: ['LOCAL MEASURED · BOUNDED · NOT GLOBAL', 'Network Diagnostics Engine', '500 Mbps'] },\n);\n",
    ),
]

for old, new in replacements:
    if old not in text:
        raise SystemExit(f'Lab 09D performance-profile anchor missing: {old[:220]!r}')
    text = text.replace(old, new, 1)

wait_anchor = """async function loadProfile(cdp, artifact, profile) {
"""
helpers = r'''async function setFileInput(cdp, selector, filePath) {
  const document = await cdp.call('DOM.getDocument', { depth: 1 });
  const result = await cdp.call('DOM.querySelector', { nodeId: document.root.nodeId, selector });
  if (!result.nodeId) throw new Error(`Unable to find file input ${selector}.`);
  await cdp.call('DOM.setFileInputFiles', { nodeId: result.nodeId, files: [filePath] });
}

async function exerciseMeasuredWorkspace(cdp, profile) {
  const opened = await cdp.evaluate(`(()=>{
    const button=[...document.querySelectorAll('button')].find((candidate)=>candidate.textContent?.trim()==='Inspect measured report');
    if(!button)return false;
    button.click();
    return true;
  })()`);
  if (!opened) throw new Error(`${profile.id} could not find the measured workspace entry point.`);
  await waitForExpression(cdp, `Boolean(document.querySelector('.measured-workspace'))`);
  await waitForExpression(cdp, `document.body.innerText.includes('NO LOCAL MEASUREMENT LOADED')`);

  await setFileInput(cdp, '.measured-file-input', measuredFixturePath);
  await waitForExpression(cdp, `document.querySelector('.measured-workspace')?.getAttribute('data-measured-loaded')==='true'`, 8000);
  await waitForExpression(cdp, `document.body.innerText.includes('Network Diagnostics Engine') && document.body.innerText.includes('500 Mbps')`, 8000);
  const loaded = await cdp.evaluate(`(()=>({
    text:document.body.innerText,
    innerWidth,
    scrollWidth:document.documentElement.scrollWidth,
    scrollY,
    factCount:document.querySelectorAll('.measured-fact').length,
    categoryCount:document.querySelectorAll('.measured-categories button').length,
    loaded:document.querySelector('.measured-workspace')?.getAttribute('data-measured-loaded'),
  }))()`);
  if (loaded.scrollWidth > loaded.innerWidth) throw new Error(`${profile.id} measured workspace overflows after valid import: ${loaded.scrollWidth} > ${loaded.innerWidth}.`);
  if (loaded.scrollY !== 0) throw new Error(`${profile.id} measured workspace moved document scrollY to ${loaded.scrollY}.`);
  if (loaded.categoryCount !== 7) throw new Error(`${profile.id} expected 7 measured categories, found ${loaded.categoryCount}.`);
  if (loaded.factCount <= 0) throw new Error(`${profile.id} rendered no measured facts after valid import.`);
  for (const forbidden of ['DERIVED FINDING MUST NOT BECOME A FACT','BROWSER EDGE MUST NOT BECOME A FACT','UNKNOWN FIELD MUST NOT BECOME A FACT']) {
    if (loaded.text.includes(forbidden)) throw new Error(`${profile.id} leaked excluded report content into the visible measured workspace: ${forbidden}`);
  }

  await setFileInput(cdp, '.measured-file-input', measuredInvalidFixturePath);
  await waitForExpression(cdp, `document.body.innerText.includes('IMPORT REJECTED')`, 8000);
  const rejected = await cdp.evaluate(`(()=>({
    loaded:document.querySelector('.measured-workspace')?.getAttribute('data-measured-loaded'),
    text:document.body.innerText,
  }))()`);
  if (rejected.loaded !== 'true') throw new Error(`${profile.id} invalid replacement cleared the previous valid measured state.`);
  if (!rejected.text.includes('THE PREVIOUS VALID REPORT REMAINS ACTIVE.')) throw new Error(`${profile.id} did not preserve/restate previous-valid-report behavior.`);
  if (!rejected.text.includes('Network Diagnostics Engine')) throw new Error(`${profile.id} lost the previous valid report after a rejected replacement.`);

  const cleared = await cdp.evaluate(`(()=>{
    const button=document.querySelector('.measured-clear');
    if(!button)return false;
    button.click();
    return true;
  })()`);
  if (!cleared) throw new Error(`${profile.id} could not find the measured Clear action.`);
  await waitForExpression(cdp, `document.querySelector('.measured-workspace')?.getAttribute('data-measured-loaded')==='false'`);
  await waitForExpression(cdp, `document.body.innerText.includes('NO LOCAL MEASUREMENT LOADED')`);

  await setFileInput(cdp, '.measured-file-input', measuredFixturePath);
  await waitForExpression(cdp, `document.querySelector('.measured-workspace')?.getAttribute('data-measured-loaded')==='true'`, 8000);
  await waitForExpression(cdp, `document.body.innerText.includes('500 Mbps')`, 8000);
  return {
    validFactCount: loaded.factCount,
    categoryCount: loaded.categoryCount,
    rejectedReplacementPreserved: true,
    clearReturnedToEmpty: true,
  };
}

'''
if wait_anchor not in text:
    raise SystemExit('Lab 09D loadProfile anchor missing')
text = text.replace(wait_anchor, helpers + wait_anchor, 1)

old_sleep = """  await waitForExpression(cdp, `Boolean(document.querySelector(${JSON.stringify(profile.readySelector ?? '.journey-workspace')}))`);
  await sleep(550);
  const readyMs = performance.now() - startedAt;
  const bodyText = await cdp.evaluate('document.body.innerText');
"""
new_sleep = """  await waitForExpression(cdp, `Boolean(document.querySelector(${JSON.stringify(profile.readySelector ?? '.journey-workspace')}))`);
  await sleep(550);
  const measuredInteraction = profile.measuredWorkspace ? await exerciseMeasuredWorkspace(cdp, profile) : null;
  const readyMs = performance.now() - startedAt;
  const bodyText = await cdp.evaluate('document.body.innerText');
"""
if old_sleep not in text:
    raise SystemExit('Lab 09D loadProfile interaction anchor missing')
text = text.replace(old_sleep, new_sleep, 1)

old_structural = """      modifierControls: controls,
      heading: document.querySelector('.journey-heading-actions > span')?.innerText ?? null,
      stress: {
"""
new_structural = """      modifierControls: controls,
      heading: document.querySelector('.journey-heading-actions > span')?.innerText ?? null,
      measured: {
        loaded: document.querySelector('.measured-workspace')?.getAttribute('data-measured-loaded') ?? null,
        categoryButtons: document.querySelectorAll('.measured-categories button').length,
        visibleFacts: document.querySelectorAll('.measured-fact').length,
      },
      stress: {
"""
if old_structural not in text:
    raise SystemExit('Lab 09D structural anchor missing')
text = text.replace(old_structural, new_structural, 1)

old_mobile = """  if (profile.assertMobileGrid) {
"""
new_mobile = """  if (profile.assertMeasuredMobile) {
    if (structural.measured.loaded !== 'true') throw new Error(`${profile.id} mobile measured workspace did not remain loaded.`);
    if (structural.measured.categoryButtons !== 7) throw new Error(`${profile.id} mobile measured category count ${structural.measured.categoryButtons}; expected 7.`);
    if (structural.measured.visibleFacts <= 0) throw new Error(`${profile.id} mobile measured workspace rendered no facts.`);
  }

  if (profile.assertMobileGrid) {
"""
if old_mobile not in text:
    raise SystemExit('Lab 09D mobile assertion anchor missing')
text = text.replace(old_mobile, new_mobile, 1)

old_return = """    heading: structural.heading,
    stress: structural.stress,
    heapUsedBytes: heap.usedSize,
"""
new_return = """    heading: structural.heading,
    stress: structural.stress,
    measured: measuredInteraction,
    heapUsedBytes: heap.usedSize,
"""
if old_return not in text:
    raise SystemExit('Lab 09D result anchor missing')
text = text.replace(old_return, new_return, 1)

old_enable = """    await cdp.call('Page.enable');
    await cdp.call('Runtime.enable');
"""
new_enable = """    await cdp.call('Page.enable');
    await cdp.call('DOM.enable');
    await cdp.call('Runtime.enable');
"""
if old_enable not in text:
    raise SystemExit('Lab 09D DOM enable anchor missing')
text = text.replace(old_enable, new_enable, 1)

path.write_text(text)
