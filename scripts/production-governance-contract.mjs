import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workflowsDir = join(repoRoot, '.github', 'workflows');

const requiredWorkflows = [
  { file: 'ci.yml', name: 'CI', job: 'build' },
  { file: 'performance.yml', name: 'Performance', job: 'production-profile' },
  { file: 'compatibility.yml', name: 'Compatibility', job: 'compatibility-gate' }
];

const compatibilityDependencies = [
  'chrome-gpu-matrix',
  'firefox-semantic',
  'capture-replay',
  'phase3-visual-review',
  'phase4-visual-review',
  'timeline-visual-review',
  'journey-annotation-visual-review',
  'kinetic-overview-visual-review'
];

function fail(message) {
  console.error(`Production governance contract failed: ${message}`);
  process.exitCode = 1;
}

function requireCondition(condition, message) {
  if (!condition) fail(message);
}

function workflowEventBlock(text) {
  const start = text.indexOf('on:\n');
  const end = text.indexOf('\npermissions:', start);
  if (start < 0 || end < 0) return '';
  return text.slice(start, end);
}

function jobsBlock(text) {
  const start = text.indexOf('\njobs:\n');
  return start < 0 ? '' : text.slice(start + 1);
}

function readWorkflow(file) {
  return readFileSync(join(workflowsDir, file), 'utf8');
}

for (const expectation of requiredWorkflows) {
  const text = readWorkflow(expectation.file);
  const events = workflowEventBlock(text);
  const jobs = jobsBlock(text);

  requireCondition(
    new RegExp(`^name: ${expectation.name}$`, 'm').test(text),
    `${expectation.file} must retain workflow name ${expectation.name}.`
  );
  requireCondition(
    /^  pull_request:\s*$/m.test(events),
    `${expectation.file} must run for pull requests.`
  );
  requireCondition(
    /^  merge_group:\s*$/m.test(events),
    `${expectation.file} must run for merge queue groups.`
  );
  requireCondition(
    /^  push:\s*$/m.test(events) && /^    branches: \[main\]\s*$/m.test(events),
    `${expectation.file} must revalidate the exact main commit after merge.`
  );
  requireCondition(
    /^permissions:\s*\n  contents: read\s*$/m.test(text),
    `${expectation.file} must remain read-only.`
  );
  requireCondition(
    new RegExp(`^  ${expectation.job}:\\s*$`, 'm').test(jobs),
    `${expectation.file} must retain stable required-check job id ${expectation.job}.`
  );
}

const ci = readWorkflow('ci.yml');
requireCondition(
  /npm audit --audit-level=high/.test(ci),
  'CI must enforce the high-severity npm audit.'
);
requireCondition(
  /node scripts\/production-governance-contract\.mjs/.test(ci),
  'CI must execute this production governance contract.'
);

const compatibility = readWorkflow('compatibility.yml');
const gateStart = compatibility.indexOf('\n  compatibility-gate:\n');
requireCondition(gateStart >= 0, 'Compatibility must define compatibility-gate.');
if (gateStart >= 0) {
  const gate = compatibility.slice(gateStart);
  requireCondition(/^    if: always\(\)\s*$/m.test(gate), 'compatibility-gate must run even when a dependency fails.');
  for (const dependency of compatibilityDependencies) {
    requireCondition(
      new RegExp(`^      - ${dependency}\\s*$`, 'm').test(gate),
      `compatibility-gate must depend on ${dependency}.`
    );
  }
}

const workflowFiles = readdirSync(workflowsDir).filter((name) => /\.ya?ml$/i.test(name));
const deploymentMarkers = [
  { pattern: /\bwrangler\s+deploy\b/i, label: 'wrangler deploy' },
  { pattern: /\bnpm\s+run\s+deploy\b/i, label: 'npm run deploy' },
  { pattern: /cloudflare\/wrangler-action@/i, label: 'cloudflare/wrangler-action' },
  { pattern: /cloudflare\/pages-action@/i, label: 'cloudflare/pages-action' },
  { pattern: /api\.cloudflare\.com/i, label: 'Cloudflare API call' },
  { pattern: /CLOUDFLARE_API_TOKEN/i, label: 'Cloudflare API token' },
  { pattern: /CLOUDFLARE_ACCOUNT_ID/i, label: 'Cloudflare account id' },
  { pattern: /^\s*environment:\s*production\s*$/im, label: 'production environment deployment' },
  { pattern: /^\s*permissions:\s*write-all\s*$/im, label: 'write-all permissions' },
  { pattern: /^\s*(?:contents|deployments|id-token):\s*write\s*$/im, label: 'deployment-capable write permission' }
];

for (const file of workflowFiles) {
  const text = readWorkflow(file);
  for (const marker of deploymentMarkers) {
    requireCondition(
      !marker.pattern.test(text),
      `${file} contains ${marker.label}; GitHub Actions must not become a second production deployer.`
    );
  }
}

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log(
  'Production governance contract passed: stable merge gates are intact and GitHub Actions remains validation-only.'
);
