import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import net from 'node:net';
import { performance } from 'node:perf_hooks';

const reportPath = resolve(process.cwd(), process.env.HOPSCOTCH_FIREFOX_REPORT_PATH?.trim() || 'artifacts/firefox-capability.json');
const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

function executableFromPath(command) {
  const result = spawnSync(process.platform === 'win32' ? 'where' : 'which', [command], { encoding: 'utf8' });
  if (result.status !== 0) return null;
  return result.stdout.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? null;
}

function firstExecutable(commands, fallbackPaths = []) {
  for (const command of commands) {
    const found = executableFromPath(command);
    if (found) return found;
  }
  return fallbackPaths.find((candidate) => existsSync(candidate)) ?? null;
}

function commandVersion(executable, args = ['--version']) {
  if (!executable) return null;
  const result = spawnSync(executable, args, { encoding: 'utf8', timeout: 10000 });
  return {
    status: result.status,
    stdout: result.stdout?.trim() || null,
    stderr: result.stderr?.trim() || null,
  };
}

async function freePort() {
  const server = net.createServer();
  await new Promise((resolvePromise, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolvePromise);
  });
  const address = server.address();
  if (!address || typeof address !== 'object') throw new Error('Unable to allocate local probe port.');
  const port = address.port;
  await new Promise((resolvePromise) => server.close(resolvePromise));
  return port;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text || null; }
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}: ${typeof body === 'string' ? body : JSON.stringify(body)}`);
  return body;
}

async function waitForGeckoDriver(port, timeoutMs = 10000) {
  const deadline = performance.now() + timeoutMs;
  let lastError = null;
  while (performance.now() < deadline) {
    try {
      return await fetchJson(`http://127.0.0.1:${port}/status`);
    } catch (error) {
      lastError = error;
      await sleep(100);
    }
  }
  throw new Error(`GeckoDriver did not become ready: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

const firefox = firstExecutable(
  ['firefox', 'firefox-esr'],
  process.platform === 'darwin' ? ['/Applications/Firefox.app/Contents/MacOS/firefox'] : ['/usr/bin/firefox', '/usr/bin/firefox-esr'],
);
const geckodriver = firstExecutable(['geckodriver'], process.platform === 'win32' ? [] : ['/usr/bin/geckodriver']);

const report = {
  schema: 'hopscotch.firefox-capability',
  version: 1,
  generatedAt: new Date().toISOString(),
  firefox: {
    path: firefox,
    version: commandVersion(firefox),
  },
  geckodriver: {
    path: geckodriver,
    version: commandVersion(geckodriver),
  },
  webdriver: {
    ready: false,
    sessionCreated: false,
    userAgent: null,
    error: null,
  },
};

let driver = null;
let sessionId = null;
try {
  if (!firefox) throw new Error('Firefox executable is not installed on this runner.');
  if (!geckodriver) throw new Error('GeckoDriver is not installed on this runner.');
  const port = await freePort();
  let stderr = '';
  driver = spawn(geckodriver, ['--host', '127.0.0.1', '--port', String(port)], { stdio: ['ignore', 'ignore', 'pipe'] });
  driver.stderr.setEncoding('utf8');
  driver.stderr.on('data', (chunk) => { stderr = `${stderr}${chunk}`.slice(-16000); });
  const status = await waitForGeckoDriver(port);
  report.webdriver.ready = Boolean(status?.value?.ready ?? true);

  const session = await fetchJson(`http://127.0.0.1:${port}/session`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      capabilities: {
        alwaysMatch: {
          browserName: 'firefox',
          acceptInsecureCerts: true,
          'moz:firefoxOptions': { args: ['-headless'] },
        },
      },
    }),
  });
  sessionId = session?.value?.sessionId ?? session?.sessionId ?? null;
  if (!sessionId) throw new Error(`GeckoDriver did not return a session id: ${JSON.stringify(session)}`);
  report.webdriver.sessionCreated = true;

  await fetchJson(`http://127.0.0.1:${port}/session/${sessionId}/url`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: 'about:blank' }),
  });
  const userAgent = await fetchJson(`http://127.0.0.1:${port}/session/${sessionId}/execute/sync`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ script: 'return navigator.userAgent;', args: [] }),
  });
  report.webdriver.userAgent = userAgent?.value ?? null;
  report.webdriver.driverStderrTail = stderr || null;
} catch (error) {
  report.webdriver.error = error instanceof Error ? error.message : String(error);
} finally {
  if (driver && sessionId) {
    try {
      const portMatch = driver.spawnargs?.findIndex((arg) => arg === '--port');
      const port = portMatch >= 0 ? driver.spawnargs[portMatch + 1] : null;
      if (port) await fetch(`http://127.0.0.1:${port}/session/${sessionId}`, { method: 'DELETE' });
    } catch { /* probe cleanup only */ }
  }
  if (driver && !driver.killed) driver.kill('SIGKILL');
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
}

console.log(`Firefox: ${report.firefox.version?.stdout ?? report.firefox.path ?? 'not installed'}`);
console.log(`GeckoDriver: ${report.geckodriver.version?.stdout ?? report.geckodriver.path ?? 'not installed'}`);
console.log(`WebDriver session: ${report.webdriver.sessionCreated ? 'available' : 'unavailable'}`);
if (report.webdriver.userAgent) console.log(`User agent: ${report.webdriver.userAgent}`);
if (report.webdriver.error) console.log(`Probe limitation: ${report.webdriver.error}`);
console.log(`Report: ${reportPath}`);
