from pathlib import Path
import concurrent.futures,json,hashlib,subprocess

base=Path('complete-review/layout-continuation-audit');base.mkdir(exist_ok=True)
manifest=Path('complete-review/source-manifest.json').read_bytes()
names=['check-complete','check-connected','check-dense','check-followup','check-shared-builder','check-audit-lifecycle','check-audit-adaptation','check-adaptive-presentation','check-refinement','check-layout-continuation']
def run(name):
    path=base/(name+'-verified.log')
    with path.open('w') as stream:result=subprocess.run(['node','complete-review/'+name+'.mjs'],stdout=stream,stderr=subprocess.STDOUT,env={**__import__('os').environ,'HOPSCOTCH_AUDIT_DIR':str(base)})
    tail=path.read_text().strip().splitlines()[-1]
    return {'suite':name,'exit_code':result.returncode,'log':str(path),'completion':tail,'log_sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
    results=list(pool.map(run,names))
assert Path('complete-review/source-manifest.json').read_bytes()==manifest,'Source changed during the frozen audit run'
assert all(r['exit_code']==0 for r in results),results
for item in json.loads(manifest):assert hashlib.sha256(Path(item['path']).read_bytes()).hexdigest()==item['sha256']
ledger={'kind':'Ten regression, refinement and layout-continuation suites on an unchanged emitted manifest, synthetic DOM/font/GL geometry only','manifest':json.loads(manifest),'suites':results,'browser_verified':False,'production_changed':False}
(base/'functional-verification.json').write_text(json.dumps(ledger,indent=2))
print('PASS frozen continuation suites',len(results),flush=True)
for r in results:print(r['suite'],r['completion'],flush=True)
