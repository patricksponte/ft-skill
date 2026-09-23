import { StaticServer, isReachable } from '../src/preview/server';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as http from 'http';

function get(url: string): Promise<{ status: number; type: string; body: string }> {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () =>
        resolve({ status: res.statusCode!, type: String(res.headers['content-type'] ?? ''), body }),
      );
    }).on('error', reject);
  });
}

(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ftsrv-'));
  fs.writeFileSync(path.join(root, 'index.html'), '<h1>hello integration</h1>');
  fs.writeFileSync(path.join(root, 'app.js'), 'console.log(1)');
  fs.mkdirSync(path.join(root, 'sub'));
  fs.writeFileSync(path.join(root, 'sub', 'index.html'), '<h1>sub</h1>');
  // A file that must never be reachable through the server.
  fs.writeFileSync(path.join(root, '..', 'ftsrv-secret.txt'), 'SECRET');

  const checks: Array<[string, boolean, string]> = [];
  const ok = (n: string, c: boolean, note = '') => checks.push([n, c, note]);

  const server = new StaticServer(root);
  const url = await server.start(5599);
  ok('server starts and reports a url', /^http:\/\/localhost:\d+$/.test(url), url);
  ok('server reports running', server.running);

  const index = await get(url + '/');
  ok('serves index.html at /', index.status === 200 && index.body.includes('hello integration'), String(index.status));
  ok('index.html has html content type', index.type.includes('text/html'), index.type);

  const js = await get(url + '/app.js');
  ok('serves js with a js content type', js.status === 200 && js.type.includes('javascript'), js.type);

  const sub = await get(url + '/sub/');
  ok('serves index.html inside a directory', sub.status === 200 && sub.body.includes('sub'), String(sub.status));

  const missing = await get(url + '/nope.html');
  ok('404s on a missing file', missing.status === 404, String(missing.status));

  const cacheHeaders = await new Promise<string>((resolve) => {
    http.get(url + '/index.html', (res) => { res.resume(); resolve(String(res.headers['cache-control'])); });
  });
  ok('sets no-store so reloads are never stale', cacheHeaders.includes('no-store'), cacheHeaders);

  // Path traversal, raw and encoded.
  const esc1 = await get(url + '/../ftsrv-secret.txt');
  const esc2 = await get(url + '/%2e%2e/ftsrv-secret.txt');
  const esc3 = await get(url + '/sub/../../ftsrv-secret.txt');
  ok('blocks ../ traversal', !esc1.body.includes('SECRET'), `${esc1.status} ${esc1.body.slice(0,40)}`);
  ok('blocks encoded traversal', !esc2.body.includes('SECRET'), `${esc2.status} ${esc2.body.slice(0,40)}`);
  ok('blocks nested traversal', !esc3.body.includes('SECRET'), `${esc3.status} ${esc3.body.slice(0,40)}`);

  // Port fallback when the preferred one is taken.
  const second = new StaticServer(root);
  const url2 = await second.start(server.port);
  ok('falls back to the next free port', second.port !== server.port, `${server.port} vs ${second.port}`);
  second.dispose();

  ok('isReachable is true for a live server', await isReachable(url));
  ok('isReachable is false for a dead port', !(await isReachable('http://localhost:5987')));

  server.dispose();
  ok('dispose stops the server', !server.running);
  ok('port is released after dispose', !(await isReachable(url)));

  let failed = 0;
  for (const [n, c, note] of checks) {
    console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${c || !note ? '' : `\n        ${note}`}`);
    if (!c) failed++;
  }
  console.log(`\n${checks.length - failed}/${checks.length} passed`);
  fs.rmSync(path.join(root, '..', 'ftsrv-secret.txt'), { force: true });
  fs.rmSync(root, { recursive: true, force: true });
  process.exit(failed ? 1 : 0);
})();
