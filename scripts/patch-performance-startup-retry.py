from pathlib import Path

path = Path('scripts/performance-profile.mjs')
text = path.read_text()

def replace_once(old: str, new: str) -> None:
    global text
    if old not in text:
        raise SystemExit(f'missing startup-retry patch anchor: {old[:160]!r}')
    text = text.replace(old, new, 1)

launch_function = r'''
async function launchChrome(chromePath, maxAttempts = 3) {
  const attempts = [];
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const port = await freePort();
    const userDataDir = mkdtempSync(join(tmpdir(), `hopscotch-perf-${attempt}-`));
    const chromeArgs = [
      '--headless=new',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-networking',
      '--disable-default-apps',
      '--disable-extensions',
      '--disable-sync',
      '--metrics-recording-only',
      '--mute-audio',
      '--remote-debugging-address=127.0.0.1',
      `--remote-debugging-port=${port}`,
      '--remote-allow-origins=*',
      `--user-data-dir=${userDataDir}`,
      'about:blank',
    ];
    const state = { stderr: '', exitCode: null, exitSignal: null, spawnError: null };
    const chrome = spawn(chromePath, chromeArgs, { stdio: ['ignore', 'ignore', 'pipe'] });
    chrome.stderr.setEncoding('utf8');
    chrome.stderr.on('data', (chunk) => { state.stderr = `${state.stderr}${chunk}`.slice(-24000); });
    chrome.once('exit', (code, signal) => { state.exitCode = code; state.exitSignal = signal; });
    chrome.once('error', (error) => { state.spawnError = error instanceof Error ? error.message : String(error); });
    try {
      const version = await waitForDevTools(port, 8000);
      return { chrome, port, userDataDir, version, state, attempts };
    } catch (error) {
      await sleep(100);
      if (!chrome.killed) chrome.kill('SIGKILL');
      attempts.push({
        attempt,
        port,
        error: error instanceof Error ? error.message : String(error),
        exitCode: state.exitCode,
        exitSignal: state.exitSignal,
        spawnError: state.spawnError,
        stderrTail: state.stderr || null,
      });
      rmSync(userDataDir, { recursive: true, force: true });
    }
  }
  const launchError = new Error(`Chrome DevTools did not start after ${maxAttempts} attempts.`);
  launchError.launchAttempts = attempts;
  throw launchError;
}

'''
replace_once('class CdpClient {', launch_function + 'class CdpClient {')

old_setup = '''  const artifact = readProductionArtifact();
  const chromePath = findChrome();
  const port = await freePort();
  const userDataDir = mkdtempSync(join(tmpdir(), 'hopscotch-perf-'));
  const chromeArgs = [
    '--headless=new',
    '--no-sandbox',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-default-apps',
    '--disable-extensions',
    '--disable-sync',
    '--metrics-recording-only',
    '--mute-audio',
    `--remote-debugging-port=${port}`,
    '--remote-allow-origins=*',
    `--user-data-dir=${userDataDir}`,
    'about:blank',
  ];
  let chromeStderr = '';
  const chrome = spawn(chromePath, chromeArgs, { stdio: ['ignore', 'ignore', 'pipe'] });
  chrome.stderr.setEncoding('utf8');
  chrome.stderr.on('data', (chunk) => { chromeStderr = `${chromeStderr}${chunk}`.slice(-24000); });
  let cdp = null;
'''
new_setup = '''  const artifact = readProductionArtifact();
  const chromePath = findChrome();
  let launch = null;
  let cdp = null;
'''
replace_once(old_setup, new_setup)

replace_once(
    "  try {\n    const version = await waitForDevTools(port);\n    report.browser.version = version.Browser ?? null;\n    const targets = await fetchJson(`http://127.0.0.1:${port}/json`);",
    "  try {\n    launch = await launchChrome(chromePath);\n    report.browser.version = launch.version.Browser ?? null;\n    report.browser.launchAttempts = launch.attempts;\n    const targets = await fetchJson(`http://127.0.0.1:${launch.port}/json`);",
)
replace_once(
    "  } catch (error) {\n    report.fatalError = error instanceof Error ? error.stack ?? error.message : String(error);\n  } finally {",
    "  } catch (error) {\n    if (error && typeof error === 'object' && 'launchAttempts' in error) report.browser.launchAttempts = error.launchAttempts;\n    report.fatalError = error instanceof Error ? error.stack ?? error.message : String(error);\n  } finally {",
)
replace_once(
    "    if (!chrome.killed) chrome.kill('SIGKILL');\n    rmSync(userDataDir, { recursive: true, force: true });\n    report.browser.stderrTail = chromeStderr || null;",
    "    if (launch?.chrome && !launch.chrome.killed) launch.chrome.kill('SIGKILL');\n    if (launch?.userDataDir) rmSync(launch.userDataDir, { recursive: true, force: true });\n    report.browser.stderrTail = launch?.state.stderr || null;",
)

path.write_text(text)
