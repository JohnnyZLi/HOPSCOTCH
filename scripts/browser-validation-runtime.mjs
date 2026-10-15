import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import net from 'node:net';
import { performance } from 'node:perf_hooks';
import { serveProductionArtifact } from './production-artifact-server.mjs';

const enforce = process.argv.includes('--enforce');
const compatibility = process.argv.includes('--compatibility');
const phase3VisualReview = process.argv.includes('--visual-review');
const phase4VisualReview = process.argv.includes('--phase4-visual-review');
const visualReview = phase3VisualReview || phase4VisualReview;
const gpuMode = process.env.HOPSCOTCH_GPU_MODE?.trim() || 'default';
if (!['default', 'swiftshader', 'disabled'].includes(gpuMode)) throw new Error(`Unsupported HOPSCOTCH_GPU_MODE: ${gpuMode}`);
const root = process.cwd();
const distDir = resolve(root, 'dist');
const budgetPath = resolve(root, 'config/performance-budget.json');
const defaultVisualDirectory = phase4VisualReview ? 'artifacts/phase4-visual-review' : 'artifacts/phase3-visual-review';
const reportPath = resolve(root, process.env.HOPSCOTCH_REPORT_PATH?.trim() || (visualReview ? `${defaultVisualDirectory}/${phase4VisualReview ? 'evidence-report.json' : 'worlds-report.json'}` : 'artifacts/performance-profile.json'));
const visualReviewDirectory = resolve(root, process.env.HOPSCOTCH_VISUAL_REVIEW_DIR?.trim() || defaultVisualDirectory);
const measuredFixturePath = resolve(root, 'scripts/fixtures/measured-workspace-v2.json');
const measuredInvalidFixturePath = resolve(root, 'scripts/fixtures/measured-workspace-invalid.json');
const budgetDocument = JSON.parse(readFileSync(budgetPath, 'utf8'));
const budgets = budgetDocument.budgets;
const stressBudgets = budgetDocument.stressBudgets ?? {};
const stressConfig = budgetDocument.stress;

const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

function executableFromPath(command) {
  const result = spawnSync(process.platform === 'win32' ? 'where' : 'which', [command], { encoding: 'utf8' });
  if (result.status !== 0) return null;
  return result.stdout.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? null;
}

function findChrome() {
  const explicit = process.env.CHROME_PATH?.trim();
  if (explicit) {
    if (!existsSync(explicit)) throw new Error(`CHROME_PATH does not exist: ${explicit}`);
    return explicit;
  }

  const commandCandidates = process.platform === 'win32'
    ? ['chrome', 'msedge']
    : ['google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser'];
  for (const command of commandCandidates) {
    const found = executableFromPath(command);
    if (found) return found;
  }

  const pathCandidates = process.platform === 'darwin'
    ? [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Chromium.app/Contents/MacOS/Chromium',
        '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      ]
    : process.platform === 'win32'
      ? [
          'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
          'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
          'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        ]
      : ['/usr/bin/google-chrome-stable', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
  for (const candidate of pathCandidates) if (existsSync(candidate)) return candidate;
  throw new Error('Chrome/Chromium not found. Set CHROME_PATH to an installed Chrome-compatible browser.');
}

async function freePort() {
  const server = net.createServer();
  await new Promise((resolvePromise, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolvePromise);
  });
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const port = address.port;
  await new Promise((resolvePromise) => server.close(resolvePromise));
  return port;
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return response.json();
}

async function waitForDevTools(port, timeoutMs = 12000) {
  const deadline = performance.now() + timeoutMs;
  let lastError = null;
  while (performance.now() < deadline) {
    try {
      return await fetchJson(`http://127.0.0.1:${port}/json/version`);
    } catch (error) {
      lastError = error;
      await sleep(100);
    }
  }
  throw new Error(`Chrome DevTools did not become ready within ${timeoutMs} ms: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}


function chromeGpuArgs(mode) {
  if (mode === 'swiftshader') return ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
  if (mode === 'disabled') return ['--disable-webgl', '--disable-webgl2'];
  return [];
}

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
    chromeArgs.splice(chromeArgs.length - 1, 0, ...chromeGpuArgs(gpuMode));
    const state = { stderr: '', exitCode: null, exitSignal: null, spawnError: null };
    const chrome = spawn(chromePath, chromeArgs, { stdio: ['ignore', 'ignore', 'pipe'] });
    chrome.stderr.setEncoding('utf8');
    chrome.stderr.on('data', (chunk) => { state.stderr = `${state.stderr}${chunk}`.slice(-24000); });
    chrome.once('exit', (code, signal) => { state.exitCode = code; state.exitSignal = signal; });
    chrome.once('error', (error) => { state.spawnError = error instanceof Error ? error.message : String(error); });
    try {
      const version = await waitForDevTools(port, 8000);
      return { chrome, port, userDataDir, version, state, attempts, args: chromeArgs };
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

class CdpClient {
  constructor(url) {
    this.url = url;
    this.nextId = 0;
    this.pending = new Map();
    this.events = [];
    this.socket = new WebSocket(url);
    this.ready = new Promise((resolvePromise, reject) => {
      this.socket.addEventListener('open', resolvePromise, { once: true });
      this.socket.addEventListener('error', () => reject(new Error(`Unable to open CDP WebSocket ${url}`)), { once: true });
    });
    this.socket.addEventListener('message', async (message) => {
      const raw = typeof message.data === 'string'
        ? message.data
        : Buffer.from(await message.data.arrayBuffer()).toString('utf8');
      const payload = JSON.parse(raw);
      if (payload.id !== undefined) {
        const waiter = this.pending.get(payload.id);
        if (!waiter) return;
        this.pending.delete(payload.id);
        clearTimeout(waiter.timer);
        if (payload.error) waiter.reject(new Error(`${waiter.method}: ${payload.error.message}`));
        else waiter.resolve(payload.result ?? {});
        return;
      }
      if (payload.method === 'Runtime.consoleAPICalled') {
        const message = payload.params?.args?.map(arg => arg.value ?? '').join(' ') ?? '';
        if (message.startsWith('[hopscotch-seek]')) console.log(message);
      }
      this.events.push(payload);
    });
  }

  async call(method, params = {}) {
    await this.ready;
    const id = ++this.nextId;
    const promise = new Promise((resolvePromise, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method} did not respond within its diagnostic deadline.`));
      }, method === 'Browser.close' ? 3000 : method === 'Runtime.evaluate' ? 300000 : 120000);
      this.pending.set(id, { resolve: resolvePromise, reject, method, timer });
    });
    this.socket.send(JSON.stringify({ id, method, params }));
    return promise;
  }

  async evaluate(expression) {
    const result = await this.call('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) {
      const text = result.exceptionDetails.exception?.description ?? result.exceptionDetails.text ?? 'Runtime evaluation failed';
      throw new Error(text);
    }
    return result.result?.value;
  }

  clearEvents() {
    this.events.length = 0;
  }

  async close() {
    try { this.socket.close(); } catch { /* noop */ }
  }
}


export {findChrome,launchChrome,fetchJson,CdpClient,sleep};
