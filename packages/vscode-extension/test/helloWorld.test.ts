/**
 * Runs the real bridge from the bundled Hello World (the first <script> in
 * <head>) against the `loaded` the simulator sends, so a change on either
 * side of the secure-bridge contract shows up here.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as vm from 'vm';
import { loadedPayload } from '../src/preview/simulator';
import { applyOrigin, normalizeOrigin, PLACEHOLDER_ORIGIN } from '../src/scaffold/wizard';

const ROOT = process.cwd();
const checks: Array<[string, boolean, string]> = [];
const ok = (n: string, c: boolean, note = '') => checks.push([n, c, note]);

const template = (t: string) => fs.readFileSync(path.join(ROOT, 'assets', 'templates', t, 'index.html'), 'utf8');
const page = template('static');

/** Boot the page's bridge in a fake browser window and return a handle. */
function boot(html: string) {
  const bridgeScript = /<head>[\s\S]*?<script>([\s\S]*?)<\/script>/.exec(html)![1];
  const listeners: Array<(e: unknown) => void> = [];
  const posted: Array<[unknown, string]> = [];
  const parent = { postMessage: (m: unknown, origin: string) => posted.push([m, origin]), closed: false };
  const window: Record<string, unknown> = {
    addEventListener: (type: string, fn: (e: unknown) => void) => { if (type === 'message') listeners.push(fn); },
    removeEventListener: () => {},
    parent,
    opener: null,
  };
  const ctx = vm.createContext({ window, URL, Headers, Set, Object, JSON, String, console });
  vm.runInContext(bridgeScript, ctx);
  return {
    parent,
    posted,
    deliver: (origin: string, data: unknown, source: unknown = parent) =>
      listeners.forEach((fn) => fn({ origin, data, source })),
    eval: (code: string) => vm.runInContext(code, ctx),
  };
}

const settings = {
  backendUrl: 'https://backend.fieldtwin.com', projectId: 'proj-1', subProjectId: 'sub-1',
  apiVersion: 'v1.10', previewPort: 5174, autoReload: true, mcpEnabled: true, mcpAllowWrites: false,
};
const loaded = { event: 'loaded', ...loadedPayload(settings, 'TOK') };

// ── the template the wizard writes ─────────────────────────────────────
ok('all three templates ship the same Hello World', template('node') === page && template('python') === page);
ok('template still carries the placeholder the wizard replaces', page.includes(`      '${PLACEHOLDER_ORIGIN}',\n`));

ok('normalizeOrigin keeps an exact https origin', normalizeOrigin('https://acme.fieldtwin.com') === 'https://acme.fieldtwin.com');
ok('normalizeOrigin strips a pasted path', normalizeOrigin(' https://acme.fieldtwin.com/project/123?x=1 ') === 'https://acme.fieldtwin.com');
ok('normalizeOrigin keeps a port', normalizeOrigin('https://acme.example:8443/') === 'https://acme.example:8443');
ok('normalizeOrigin rejects http', normalizeOrigin('http://acme.fieldtwin.com') === undefined);
ok('normalizeOrigin rejects junk', normalizeOrigin('acme') === undefined && normalizeOrigin('') === undefined);

const configured = applyOrigin(page, 'https://acme.fieldtwin.com');
ok('applyOrigin replaces the placeholder', configured.includes("      'https://acme.fieldtwin.com',\n") && !configured.includes(`'${PLACEHOLDER_ORIGIN}',\n    ]`));

// ── simulator payload against the secure bridge ────────────────────────
for (const field of ['token', 'backendUrl', 'APIVersion', 'project', 'subProject', 'stream', 'customTabId', 'canEdit', 'APIServerIsReady']) {
  ok(`simulator loaded carries ${field}`, (loaded as Record<string, unknown>)[field] !== undefined);
}

{
  // A VS Code webview can never be an allowlisted https FieldTwin origin.
  const hw = boot(configured);
  hw.deliver('vscode-webview://0a1b2c', loaded);
  ok('bridge ignores loaded from the webview origin', hw.eval('bridge.context()') === null);
  ok('and reports it as origin-not-allowlisted',
     JSON.stringify(hw.eval('earlyNotices')).includes('origin-not-allowlisted'));
}

{
  const hw = boot(configured);
  hw.deliver('https://acme.fieldtwin.com', loaded, { postMessage() {} });
  ok('bridge ignores loaded from a window that is not the host', hw.eval('bridge.context()') === null);
}

{
  const hw = boot(configured);
  hw.deliver('https://acme.fieldtwin.com', loaded);
  const context = hw.eval('bridge.context()');
  ok('bridge accepts the simulator payload from the allowlisted origin', context !== null);
  ok('bridge pins the host origin', context?.hostOrigin === 'https://acme.fieldtwin.com');
  ok('bridge never exposes the token', context && !('token' in context) && context.hasToken === true);
  ok('bridge reads the qualified subProject unchanged', context?.subProject === 'sub-1:sub-1', String(context?.subProject));
  ok('APIVersion lets the bridge build API URLs',
     String(hw.eval("bridge.apiUrl('proj-1/subProject/sub-1%3Asub-1/stagedAssets')")) ===
       'https://backend.fieldtwin.com/API/v1.10/proj-1/subProject/sub-1%3Asub-1/stagedAssets');

  hw.eval("bridge.send({ event: 'toast', data: { type: 'info', message: 'hi' } })");
  const [, target] = hw.posted.at(-1) ?? [];
  ok("replies go to the pinned origin, never '*'", target === 'https://acme.fieldtwin.com', String(target));
}

{
  // What 0.1.0 sent: no APIVersion, so the bridge had no API root.
  const { APIVersion: _dropped, ...old } = loaded;
  const hw = boot(configured);
  hw.deliver('https://acme.fieldtwin.com', old);
  let threw = false;
  try { hw.eval("bridge.apiUrl('x')"); } catch { threw = true; }
  ok('without APIVersion the bridge refuses to build API URLs', threw);
}

let failed = 0;
for (const [n, c, note] of checks) {
  console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${c || !note ? '' : `\n        ${note}`}`);
  if (!c) failed++;
}
console.log(`\n${checks.length - failed}/${checks.length} passed`);
process.exit(failed ? 1 : 0);
