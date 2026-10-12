"""Authoring build. Production serves checked-in pages and verifies their hashes."""
from pathlib import Path
import hashlib
import json
import shutil
import subprocess
import sys

project = Path(__file__).resolve().parent
repo = project.parent
(project / 'dist').mkdir(exist_ok=True)
subprocess.run([sys.executable, 'complete-review/assemble.py'], cwd=project / 'source', check=True)
subprocess.run([sys.executable, 'wrap-pages.py'], cwd=project, check=True)
shutil.copyfile(project / 'viewport.html', repo / 'public/review/viewport.html')

# Only active inputs: historical audit receipts and synthetic-test outputs are not
# dependencies of the served pages. Keep this list explicit and reviewable.
inputs = ['design-review/build.py', 'design-review/wrap-pages.py',
          'design-review/viewport.html', 'design-review/source/base-study.html',
          'design-review/source/workspace-reference-models.json']
inputs += ['design-review/source/complete-review/' + name for name in [
    'assemble.py', 'source-data.json', 'review.css', 'connected.css',
    'motion.html', 'motion.js', 'workbench.html', 'workbench.js',
    'evidence.html', 'evidence.js', 'connected.html', 'connected.js',
    'shared-painter.js', 'shared-ui.js', 'shared-network.js',
    'shared-reservation.js', 'shared-bytes.js', 'shared-presentation.js', 'source-adapters.js',
    'domain.bundle.js', 'evidence-domain.bundle.js', 'entry-domain.bundle.js',
    'd3-array.min.js', 'd3-geo.min.js', 'world-110m.topojson']]

def hashes(paths):
    return {path: hashlib.sha256((repo / path).read_bytes()).hexdigest() for path in sorted(paths)}

outputs = [str(path.relative_to(repo)) for path in (repo / 'public/review').glob('*.html')]
manifest = {'schema': 1, 'inputs': hashes(inputs), 'outputs': hashes(outputs)}
(project / 'build-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print('Recorded source/output integrity for', len(outputs), 'public review pages')
