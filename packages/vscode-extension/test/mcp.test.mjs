/** The bundled MCP server must start and speak MCP without any node_modules. */
import { spawn } from 'node:child_process';
import * as path from 'node:path';
import * as url from 'node:url';
import * as fs from 'node:fs';

const root = path.join(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const bundle = path.join(root, 'out', 'mcp', 'index.mjs');

const checks = [];
const ok = (n, c, note = '') => checks.push([n, c, note]);

ok('mcp bundle exists — run `npm run compile` first', fs.existsSync(bundle), bundle);
if (!fs.existsSync(bundle)) { report(); process.exit(1); }

const child = spawn(process.execPath, [bundle], {
  env: { ...process.env, FIELDTWIN_BACKEND_URL: 'https://backend.fieldtwin.com', FIELDTWIN_API_TOKEN: 'test-token' },
  stdio: ['pipe', 'pipe', 'pipe'],
});

const send = (msg) => child.stdin.write(JSON.stringify(msg) + '\n');
const pending = new Map();
let buffer = '';

child.stdout.on('data', (chunk) => {
  buffer += chunk.toString();
  const lines = buffer.split('\n');
  buffer = lines.pop() ?? '';
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    } catch { /* not a complete json line */ }
  }
});

let nextId = 1;
const request = (method, params) =>
  new Promise((resolve, reject) => {
    const id = nextId++;
    const timer = setTimeout(() => reject(new Error(`timeout on ${method}`)), 8000);
    pending.set(id, (msg) => { clearTimeout(timer); resolve(msg); });
    send({ jsonrpc: '2.0', id, method, params });
  });

try {
  const init = await request('initialize', {
    protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '1' },
  });
  ok('server answers initialize', Boolean(init.result), JSON.stringify(init).slice(0, 120));
  ok('server identifies as fieldtwin', init.result?.serverInfo?.name === 'fieldtwin',
     JSON.stringify(init.result?.serverInfo));

  send({ jsonrpc: '2.0', method: 'notifications/initialized' });

  const list = await request('tools/list', {});
  const tools = list.result?.tools ?? [];
  ok('server exposes its tools', tools.length > 90, `${tools.length} tools`);
  ok('every tool has a name and schema',
     tools.every((t) => t.name && t.inputSchema),
     tools.filter((t) => !t.name || !t.inputSchema).map((t) => t.name).join(','));

  for (const expected of ['get_staged_assets', 'get_wells', 'get_connections', 'list_projects', 'list_subprojects']) {
    ok(`exposes ${expected}`, tools.some((t) => t.name === expected));
  }
  // v1.10 has no per-resource metaData route; values arrive on each resource.
  ok('no get_metadata tool for a route that does not exist', !tools.some((t) => t.name === 'get_metadata'));

  // Writes are refused before any request is made unless explicitly enabled.
  const del = tools.find((t) => t.name === 'delete_staged_asset');
  ok('exposes delete_staged_asset', Boolean(del));
  const refused = await request('tools/call', {
    name: 'delete_staged_asset',
    arguments: { projectId: 'p', subProjectId: 's', id: 'a' },
  });
  const text = JSON.stringify(refused);
  ok('write tools are refused by default', /write tools are disabled/.test(text), text.slice(0, 300));
} catch (err) {
  ok('mcp session completed', false, String(err));
}

child.kill();
report();

function report() {
  let failed = 0;
  for (const [n, c, note] of checks) {
    console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${c || !note ? '' : `\n        ${note}`}`);
    if (!c) failed++;
  }
  console.log(`\n${checks.length - failed}/${checks.length} passed`);
  process.exit(failed ? 1 : 0);
}
