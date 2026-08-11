from pathlib import Path

path = Path('scripts/performance-profile.mjs')
text = path.read_text()

def replace_once(old: str, new: str) -> None:
    global text
    if old not in text:
        raise SystemExit(f'missing Lab 08B performance patch anchor: {old[:160]!r}')
    text = text.replace(old, new, 1)

replace_once(
    "];\n\nasync function waitForExpression(cdp, expression, timeoutMs = 5000) {",
    "];\n\nprofiles.push(\n  { id: 'stress-as-canvas', stress: true, width: 1440, height: 1000, reducedMotion: true, query: query({ stress: 'as-density' }), readySelector: '.internet-scale', expected: ['POLICY MAKES', 'SIMULATED WINNER'], stressExpected: { profile: 'as-density', asNodes: 160, asRelationships: 220 } },\n  { id: 'stress-builder-ceiling', stress: true, width: 1440, height: 1000, reducedMotion: true, query: query({ stress: 'builder-density' }), readySelector: '.builder-workspace', expected: ['32 NODES · 96 LINKS', 'ROUTE INSTALLED'], stressExpected: { profile: 'builder-density', builderNodes: 32, builderLinks: 96 } },\n  { id: 'stress-physical-webgl', stress: true, width: 1440, height: 1000, reducedMotion: true, query: query({ stress: 'physical-density' }), readySelector: '.physical-globe', expected: ['SIMULATED · STRESS FIXTURE', 'SIMULATED STRESS POINTS · NOT PUBLIC DATA', 'WEBGL 2'], stressExpected: { profile: 'physical-density', physicalPoints: 2000, webgl: true } },\n);\n\nasync function waitForExpression(cdp, expression, timeoutMs = 5000) {",
)
replace_once(
    "  await waitForExpression(cdp, 'Boolean(document.querySelector(\".journey-workspace\"))');",
    "  await waitForExpression(cdp, `Boolean(document.querySelector(${JSON.stringify(profile.readySelector ?? '.journey-workspace')}))`);",
)
replace_once(
    "      heading: document.querySelector('.journey-heading-actions > span')?.innerText ?? null,\n    };",
    "      heading: document.querySelector('.journey-heading-actions > span')?.innerText ?? null,\n      stress: {\n        profile: document.querySelector('[data-stress-profile]')?.getAttribute('data-stress-profile') ?? null,\n        asNodes: Number(document.querySelector('.internet-scale')?.getAttribute('data-node-count') ?? 0),\n        asRelationships: Number(document.querySelector('.internet-scale')?.getAttribute('data-relationship-count') ?? 0),\n        builderNodes: Number(document.querySelector('.builder-workspace')?.getAttribute('data-node-count') ?? 0),\n        builderLinks: Number(document.querySelector('.builder-workspace')?.getAttribute('data-link-count') ?? 0),\n        physicalPoints: Number(document.querySelector('.physical-globe')?.getAttribute('data-point-count') ?? 0),\n        webgl: Boolean(document.querySelector('.globe-render-host canvas')),\n        canvasBackingWidth: document.querySelector('.internet-scale canvas,.globe-render-host canvas')?.width ?? 0,\n        canvasBackingHeight: document.querySelector('.internet-scale canvas,.globe-render-host canvas')?.height ?? 0,\n      },\n    };",
)
replace_once(
    "  if (profile.assertMobileGrid) {",
    "  if (profile.stressExpected) {\n    for (const [key, value] of Object.entries(profile.stressExpected)) {\n      if (structural.stress[key] !== value) throw new Error(`${profile.id} stress invariant ${key}=${JSON.stringify(structural.stress[key])}; expected ${JSON.stringify(value)}.`);\n    }\n    if ((structural.stress.asNodes > 0 || structural.stress.physicalPoints > 0) && (structural.stress.canvasBackingWidth <= 0 || structural.stress.canvasBackingHeight <= 0)) throw new Error(`${profile.id} renderer canvas has invalid backing dimensions.`);\n  }\n\n  if (profile.assertMobileGrid) {",
)
replace_once(
    "    heading: structural.heading,\n    heapUsedBytes: heap.usedSize,",
    "    heading: structural.heading,\n    stress: structural.stress,\n    heapUsedBytes: heap.usedSize,",
)
replace_once(
    "async function seekStress(cdp, artifact) {\n  const profile = {\n    id: 'max-composed-seek-stress',",
    "async function seekStress(cdp, artifact, cycles = stressConfig.seekCycles, id = 'max-composed-seek-stress') {\n  const profile = {\n    id,",
)
replace_once(
    "    const cycles=${Number(stressConfig.seekCycles)};",
    "    const cycles=${Number(1)} * ${'${Number(cycles)}'};",
)
text = text.replace("const cycles=${Number(1)} * ${Number(cycles)};", "const cycles=${Number(cycles)};")
replace_once(
    "    cycles: stressConfig.seekCycles,",
    "    cycles,",
)
replace_once(
    "    report.seekStress = await seekStress(cdp, artifact);",
    "    report.seekStress = await seekStress(cdp, artifact);\n    report.highDensitySeekStress = await seekStress(cdp, artifact, 12, 'high-density-seek-stress');",
)
replace_once(
    "    for (const profile of report.profiles) {\n      addBudgetFailure(report.failures, profile.elementCount <= budgets.maxDomElements, `${profile.id} DOM ${profile.elementCount} exceeds ${budgets.maxDomElements}.`);\n      addBudgetFailure(report.failures, profile.heapUsedBytes <= budgets.maxHeapUsedBytes, `${profile.id} heap ${profile.heapUsedBytes} exceeds ${budgets.maxHeapUsedBytes}.`);\n    }",
    "    for (const profile of report.profiles) {\n      if (profile.stress?.profile) continue;\n      addBudgetFailure(report.failures, profile.elementCount <= budgets.maxDomElements, `${profile.id} DOM ${profile.elementCount} exceeds ${budgets.maxDomElements}.`);\n      addBudgetFailure(report.failures, profile.heapUsedBytes <= budgets.maxHeapUsedBytes, `${profile.id} heap ${profile.heapUsedBytes} exceeds ${budgets.maxHeapUsedBytes}.`);\n    }",
)
replace_once(
    "  if (report.seekStress) {\n    console.log(`seek stress: ${report.seekStress.cycles} × ${report.seekStress.eventsPerCycle} events · heap growth ${(report.seekStress.heapGrowthBytes / 1048576).toFixed(2)} MiB · ${report.seekStress.elapsedMs.toFixed(0)} ms diagnostic`);\n  }",
    "  if (report.seekStress) {\n    console.log(`seek stress: ${report.seekStress.cycles} × ${report.seekStress.eventsPerCycle} events · heap growth ${(report.seekStress.heapGrowthBytes / 1048576).toFixed(2)} MiB · ${report.seekStress.elapsedMs.toFixed(0)} ms diagnostic`);\n  }\n  if (report.highDensitySeekStress) {\n    console.log(`high-density seek stress: ${report.highDensitySeekStress.cycles} × ${report.highDensitySeekStress.eventsPerCycle} events · heap growth ${(report.highDensitySeekStress.heapGrowthBytes / 1048576).toFixed(2)} MiB · ${report.highDensitySeekStress.elapsedMs.toFixed(0)} ms diagnostic`);\n  }",
)

path.write_text(text)
