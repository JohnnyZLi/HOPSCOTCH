import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, isAbsolute, relative, resolve } from 'node:path';

function mimeType(path) {
  return ({
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.json': 'application/json; charset=utf-8',
  })[extname(path)] ?? 'application/octet-stream';
}

export async function serveProductionArtifact(distDirectory) {
  const distDir = resolve(distDirectory);
  const indexPath = resolve(distDir, 'index.html');
  if (!existsSync(indexPath)) throw new Error('dist/index.html is missing. Run `npm run build` first.');

  const server = createServer((request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://127.0.0.1').pathname);
      const candidate = resolve(distDir, pathname.replace(/^[/\\]+/, '') || 'index.html');
      const fromDist = relative(distDir, candidate);
      const withinDist = fromDist !== '' && !fromDist.startsWith('..') && !isAbsolute(fromDist);
      const safeCandidate = withinDist ? candidate : indexPath;
      const filePath = existsSync(safeCandidate) && statSync(safeCandidate).isFile() ? safeCandidate : indexPath;
      const headers = { 'content-type': mimeType(filePath), 'cache-control': 'no-store' };
      if (filePath === indexPath) {
        // Production-artifact profiles are independent test cases. Real HTTP navigation gives the app
        // a persistent origin and makes prior documents eligible for Chrome's back/forward cache, so
        // clear browser-owned profile state before the next app boot while preserving real chunk loading.
        headers['clear-site-data'] = '"cache", "storage"';
      }
      response.writeHead(200, headers);
      response.end(readFileSync(filePath));
    } catch (error) {
      response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      response.end(error instanceof Error ? error.message : String(error));
    }
  });

  await new Promise((resolvePromise, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolvePromise);
  });
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  return { server, origin: `http://127.0.0.1:${address.port}` };
}
