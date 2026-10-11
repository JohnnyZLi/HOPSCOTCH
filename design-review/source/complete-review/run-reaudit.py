from pathlib import Path
import concurrent.futures, hashlib, json, os, subprocess, time

base = Path('complete-review/reaudit-20261006')
base.mkdir(exist_ok=True)
manifest = Path('complete-review/source-manifest.json').read_bytes()
names = ['check-complete', 'check-connected', 'check-dense', 'check-followup',
         'check-shared-builder', 'check-audit-lifecycle', 'check-audit-adaptation',
         'check-adaptive-presentation', 'check-refinement', 'check-layout-continuation',
         'check-reaudit-cleanup']

def run(name):
    path = base / (name + '-verified.log')
    start = time.monotonic()
    with path.open('w') as stream:
        result = subprocess.run(['node', 'complete-review/' + name + '.mjs'],
                                stdout=stream, stderr=subprocess.STDOUT,
                                env={**os.environ, 'HOPSCOTCH_AUDIT_DIR': str(base)})
    lines = path.read_text().strip().splitlines()
    record = {'suite': name, 'exit_code': result.returncode, 'log': str(path),
              'completion': lines[-1] if lines else '',
              'seconds': round(time.monotonic() - start, 2),
              'log_sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
    print(json.dumps(record), flush=True)
    return record

with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    results = list(pool.map(run, names))
assert Path('complete-review/source-manifest.json').read_bytes() == manifest
for item in json.loads(manifest):
    assert hashlib.sha256(Path(item['path']).read_bytes()).hexdigest() == item['sha256']
assert all(r['exit_code'] == 0 for r in results), results
(base / 'functional-verification.json').write_text(json.dumps({
    'kind': 'Fresh full eleven-suite rerun on a frozen manifest; synthetic runtime contracts, not browser acceptance',
    'manifest': json.loads(manifest), 'suites': results,
    'browser_verified': False, 'production_changed': False}, indent=2) + '\n')
print('PASS fresh frozen eleven-suite re-audit', flush=True)
