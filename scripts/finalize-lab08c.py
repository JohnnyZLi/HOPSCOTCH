from pathlib import Path
import json

root = Path('.')

package_path = root / 'package.json'
package = json.loads(package_path.read_text())
scripts = package['scripts']
scripts['compatibility:chrome'] = 'node scripts/performance-profile.mjs --compatibility'
scripts['compatibility:firefox'] = 'node scripts/firefox-compatibility.mjs'
package_path.write_text(json.dumps(package, indent=2) + '\n')

for relative in [
    'scripts/apply-lab08c.py',
    'scripts/apply-lab08c-firefox.py',
    'scripts/firefox-capability-probe.mjs',
    'scripts/finalize-lab08c.py',
]:
    path = root / relative
    if path.exists():
        path.unlink()
