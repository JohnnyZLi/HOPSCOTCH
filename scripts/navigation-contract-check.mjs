import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WORKSPACE_COUNT, WORKSPACE_IDS, WORKSPACE_PATHS } from '../src/workspace-catalog.ts';
import {
  DESTINATION_PATHS,
  canonicalUrlForRoute,
  pathForDestination,
  resolveAppRoute,
} from '../src/navigation.ts';

const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const wrangler = readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8');

assert.equal(WORKSPACE_COUNT, 13);
assert.deepEqual(DESTINATION_PATHS, WORKSPACE_PATHS, 'navigation must consume canonical workspace paths');

for (const destination of WORKSPACE_IDS) {
  const path = WORKSPACE_PATHS[destination];
  assert.equal(pathForDestination(destination), path);
  const route = resolveAppRoute(path, '');
  assert.equal(route.kind, 'lab');
  assert.equal(route.destination, destination);
  assert.equal(route.canonicalPath, path);
  assert.equal(canonicalUrlForRoute(route, ''), path);

  const trailing = resolveAppRoute(`${path}/`, '');
  assert.equal(trailing.destination, destination);
  assert.equal(trailing.canonicalPath, path);
}

const overview = resolveAppRoute('/', '');
assert.equal(overview.kind, 'overview');
assert.equal(overview.destination, null);
assert.equal(canonicalUrlForRoute(overview, ''), '/');

const legacyShare = '?journey=2&host=example.test&transport=tcp-h2&dns=cache-miss&mods=&t=0';
const legacy = resolveAppRoute('/', legacyShare);
assert.equal(legacy.kind, 'legacy-journey');
assert.equal(legacy.destination, 'journey');
assert.equal(canonicalUrlForRoute(legacy, legacyShare), `/journey${legacyShare}`);

const canonicalShare = resolveAppRoute('/journey', legacyShare);
assert.equal(canonicalShare.kind, 'lab');
assert.equal(canonicalShare.destination, 'journey');
assert.equal(canonicalUrlForRoute(canonicalShare, legacyShare), `/journey${legacyShare}`);

const unknown = resolveAppRoute('/definitely-not-a-hopscotch-route', '?x=1');
assert.equal(unknown.kind, 'unknown');
assert.equal(unknown.destination, null);
assert.equal(canonicalUrlForRoute(unknown, '?x=1'), '/');

assert.match(wrangler, /"not_found_handling"\s*:\s*"single-page-application"/);
assert.match(wrangler, /"run_worker_first"\s*:\s*\["\/api\/\*"\]/);

assert.match(app, /window\.location\.protocol === 'http:' \|\| window\.location\.protocol === 'https:'/);
assert.match(app, /resolveAppRoute\('\/', typeof window === 'undefined' \? '' : window\.location\.search\)/);
assert.match(app, /window\.history\.pushState/);
assert.match(app, /window\.history\.replaceState/);
assert.match(app, /addEventListener\('popstate'/);
assert.match(app, /resolveAppRoute\(window\.location\.pathname, window\.location\.search\)/);
assert.match(app, /pathForDestination\(/);

console.log(`Navigation contract OK: ${WORKSPACE_COUNT} catalog-backed canonical deep links, legacy Journey migration, SPA fallback, and browser history wiring.`);
