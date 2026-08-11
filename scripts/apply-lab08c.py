from pathlib import Path

path = Path('scripts/performance-profile.mjs')
text = path.read_text()


def replace_once(old: str, new: str) -> None:
    global text
    if old not in text:
        raise SystemExit(f'missing Lab 08C profiler patch anchor: {old[:180]!r}')
    text = text.replace(old, new, 1)


replace_once(
    "const enforce = process.argv.includes('--enforce');\nconst root = process.cwd();",
    "const enforce = process.argv.includes('--enforce');\nconst compatibility = process.argv.includes('--compatibility');\nconst gpuMode = process.env.HOPSCOTCH_GPU_MODE?.trim() || 'default';\nif (!['default', 'swiftshader', 'disabled'].includes(gpuMode)) throw new Error(`Unsupported HOPSCOTCH_GPU_MODE: ${gpuMode}`);\nconst root = process.cwd();",
)
replace_once(
    "const reportPath = resolve(root, 'artifacts/performance-profile.json');",
    "const reportPath = resolve(root, process.env.HOPSCOTCH_REPORT_PATH?.trim() || 'artifacts/performance-profile.json');",
)
replace_once(
    "\nasync function launchChrome(chromePath, maxAttempts = 3) {",
    "\nfunction chromeGpuArgs(mode) {\n  if (mode === 'swiftshader') return ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];\n  if (mode === 'disabled') return ['--disable-webgl', '--disable-webgl2'];\n  return [];\n}\n\nasync function launchChrome(chromePath, maxAttempts = 3) {",
)
replace_once(
    "      `--user-data-dir=${userDataDir}`,\n      'about:blank',\n    ];\n    const state =",
    "      `--user-data-dir=${userDataDir}`,\n      'about:blank',\n    ];\n    chromeArgs.splice(chromeArgs.length - 1, 0, ...chromeGpuArgs(gpuMode));\n    const state =",
)
replace_once(
    "      return { chrome, port, userDataDir, version, state, attempts };",
    "      return { chrome, port, userDataDir, version, state, attempts, args: chromeArgs };",
)
replace_once(
    "  { id: 'stress-physical-webgl', stress: true, width: 1440, height: 1000, reducedMotion: true, query: query({ stress: 'physical-density' }), readySelector: '.physical-globe', expected: ['SIMULATED · STRESS FIXTURE', 'SIMULATED STRESS POINTS · NOT PUBLIC DATA', 'WEBGL 2'], stressExpected: { profile: 'physical-density', physicalPoints: 2000, webgl: true } },",
    "  { id: 'stress-physical-webgl', stress: true, width: 1440, height: 1000, reducedMotion: true, query: query({ stress: 'physical-density' }), readySelector: '.physical-globe', expected: gpuMode === 'disabled' ? ['SIMULATED · STRESS FIXTURE', 'SIMULATED STRESS POINTS · NOT PUBLIC DATA', 'FALLBACK', 'WEBGL 2 UNAVAILABLE'] : ['SIMULATED · STRESS FIXTURE', 'SIMULATED STRESS POINTS · NOT PUBLIC DATA', 'WEBGL 2'], stressExpected: { profile: 'physical-density', physicalPoints: 2000, webgl: gpuMode !== 'disabled' }, allowExpectedWebglFailure: gpuMode === 'disabled' },",
)
replace_once(
    "    if ((structural.stress.asNodes > 0 || structural.stress.physicalPoints > 0) && (structural.stress.canvasBackingWidth <= 0 || structural.stress.canvasBackingHeight <= 0)) throw new Error(`${profile.id} renderer canvas has invalid backing dimensions.`);",
    "    if ((structural.stress.asNodes > 0 || structural.stress.webgl) && (structural.stress.canvasBackingWidth <= 0 || structural.stress.canvasBackingHeight <= 0)) throw new Error(`${profile.id} renderer canvas has invalid backing dimensions.`);",
)
replace_once(
    "  const pageErrors = cdp.events.filter((event) =>\n    event.method === 'Runtime.exceptionThrown'\n    || (event.method === 'Log.entryAdded' && event.params?.entry?.level === 'error')\n    || (event.method === 'Runtime.consoleAPICalled' && event.params?.type === 'error'));\n  if (pageErrors.length > 0) throw new Error(`${profile.id} emitted ${pageErrors.length} runtime/console error event(s).`);",
    "  const pageErrors = cdp.events.filter((event) =>\n    event.method === 'Runtime.exceptionThrown'\n    || (event.method === 'Log.entryAdded' && event.params?.entry?.level === 'error')\n    || (event.method === 'Runtime.consoleAPICalled' && event.params?.type === 'error'));\n  const unexpectedPageErrors = profile.allowExpectedWebglFailure\n    ? pageErrors.filter((event) => !/(webgl|webglrenderer|context)/i.test(JSON.stringify(event)))\n    : pageErrors;\n  if (unexpectedPageErrors.length > 0) throw new Error(`${profile.id} emitted ${unexpectedPageErrors.length} unexpected runtime/console error event(s).`);",
)
replace_once(
    "    enforce,\n    budgetDocument,\n    browser: { path: chromePath },",
    "    enforce,\n    compatibility,\n    gpuMode,\n    budgetDocument,\n    browser: { path: chromePath },",
)
replace_once(
    "    report.browser.version = launch.version.Browser ?? null;\n    report.browser.launchAttempts = launch.attempts;",
    "    report.browser.version = launch.version.Browser ?? null;\n    report.browser.launchAttempts = launch.attempts;\n    report.browser.args = launch.args;",
)
replace_once(
    "    report.seekStress = await seekStress(cdp, artifact);\n    report.highDensitySeekStress = await seekStress(cdp, artifact, stressBudgets.highDensitySeek?.cycles ?? 12, 'high-density-seek-stress');\n\n    addBudgetFailure(report.failures, artifact.bundle.jsGzipBytes <= budgets.maxJsGzipBytes, `JS gzip ${artifact.bundle.jsGzipBytes} exceeds ${budgets.maxJsGzipBytes}.`);",
    "    if (!compatibility) {\n      report.seekStress = await seekStress(cdp, artifact);\n      report.highDensitySeekStress = await seekStress(cdp, artifact, stressBudgets.highDensitySeek?.cycles ?? 12, 'high-density-seek-stress');\n\n    addBudgetFailure(report.failures, artifact.bundle.jsGzipBytes <= budgets.maxJsGzipBytes, `JS gzip ${artifact.bundle.jsGzipBytes} exceeds ${budgets.maxJsGzipBytes}.`);",
)
replace_once(
    "      addBudgetFailure(report.failures, report.highDensitySeekStress.heapGrowthBytes <= highDensitySeekBudget.maxHeapGrowthBytes, `high-density seek heap growth ${report.highDensitySeekStress.heapGrowthBytes} exceeds stress budget ${highDensitySeekBudget.maxHeapGrowthBytes}.`);\n    }\n  } catch (error) {",
    "      addBudgetFailure(report.failures, report.highDensitySeekStress.heapGrowthBytes <= highDensitySeekBudget.maxHeapGrowthBytes, `high-density seek heap growth ${report.highDensitySeekStress.heapGrowthBytes} exceeds stress budget ${highDensitySeekBudget.maxHeapGrowthBytes}.`);\n    }\n    }\n  } catch (error) {",
)
replace_once(
    "  console.log(`HOPSCOTCH production performance profile (${report.browser.version ?? 'browser unknown'})`);",
    "  console.log(`HOPSCOTCH production ${compatibility ? 'compatibility' : 'performance'} profile (${report.browser.version ?? 'browser unknown'})`);\n  console.log(`GPU mode: ${gpuMode}`);",
)
replace_once(
    "    console.log('Stable performance and high-density stress budgets passed.');",
    "    console.log(compatibility ? `Compatibility semantic profile passed for GPU mode ${gpuMode}.` : 'Stable performance and high-density stress budgets passed.');",
)

path.write_text(text)
