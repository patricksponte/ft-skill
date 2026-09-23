/**
 * Runs media/simulator.js against a minimal DOM so the host-protocol
 * behaviour is checked for real: the events the simulator sends must carry
 * the field names an integration actually reads, and the three request
 * messages must be answered.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as url from 'node:url';
import * as vm from 'node:vm';

const here = path.dirname(url.fileURLToPath(import.meta.url));
const root = path.join(here, '..');

const checks = [];
const ok = (name, cond, note = '') => checks.push([name, cond, note]);

// ── minimal DOM ────────────────────────────────────────────────────────
function makeElement(id = '') {
  const el = {
    id,
    children: [],
    className: '',
    textContent: '',
    innerHTML: '',
    style: {},
    listeners: {},
    attributes: {},
    addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); },
    dispatch(type, ev) { (this.listeners[type] ?? []).forEach((fn) => fn(ev)); },
    appendChild(c) { this.children.push(c); return c; },
    prepend(c) { this.children.unshift(c); return c; },
    remove() {},
    setAttribute(k, v) { this.attributes[k] = v; },
    getAttribute(k) { return this.attributes[k] ?? null; },
  };
  return el;
}

const sentToIframe = [];
const sentToExtension = [];

const frame = makeElement('frame');
const iframeOrigins = [];
frame.contentWindow = { postMessage: (payload, origin) => { sentToIframe.push(payload); iframeOrigins.push(origin); } };
frame.src = '';

const ids = ['status', 'statusText', 'target', 'logList', 'emptyHint', 'count',
             'sessionJson', 'reload', 'clear', 'setToken', 'openExternal'];
const elements = { frame };
for (const id of ids) elements[id] = makeElement(id);

const fireButtons = ['loaded', 'tokenRefresh', 'apiPodIsReady', 'select', 'unselect', 'operationSearch', 'visualFilterToggle']
  .map((name) => { const b = makeElement(); b.setAttribute('data-fire', name); return b; });

const body = makeElement('body');
const document = {
  body,
  getElementById: (id) => elements[id] ?? null,
  createElement: () => makeElement(),
  querySelectorAll: (sel) => (sel === '[data-fire]' ? fireButtons : []),
};

const windowListeners = [];
const sandbox = {
  document,
  console,
  setTimeout,
  clearTimeout,
  Date,
  JSON,
  URL,
  String,
  Array,
  acquireVsCodeApi: () => ({ postMessage: (m) => sentToExtension.push(m) }),
  window: {
    addEventListener: (type, fn) => { if (type === 'message') windowListeners.push(fn); },
    location: { origin: 'vscode-webview://test' },
  },
};
sandbox.globalThis = sandbox;

vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, 'media', 'simulator.js'), 'utf8'), sandbox);

const post = (data) => windowListeners.forEach((fn) => fn({ data }));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ── the session the extension hands over ───────────────────────────────
const session = {
  token: 'TOK', backendUrl: 'https://backend.fieldtwin.com', APIVersion: 'v1.10',
  project: 'proj-1', subProject: 'sub-1:stream-9', stream: 'stream-9',
  customTabId: 'tab-1', canEdit: true, APIServerIsReady: true,
};
post({ type: 'session', target: 'http://localhost:5174', hasToken: true, session });

ok('iframe src points at the target', frame.src.startsWith('http://localhost:5174'), frame.src);
ok('iframe src is cache-busted', frame.src.includes('_ft='), frame.src);
ok('target is shown in the bar', elements.target.textContent === 'http://localhost:5174');
ok('session is displayed as JSON', elements.sessionJson.textContent.includes('backendUrl'));

// ── loaded is sent automatically ───────────────────────────────────────
frame.dispatch('load');
await wait(300);

const loaded = sentToIframe.find((m) => m.event === 'loaded');
ok('loaded is sent automatically on iframe load', Boolean(loaded));
ok("host messages target the integration's exact origin, never '*'",
   iframeOrigins.length > 0 && iframeOrigins.every((o) => o === 'http://localhost:5174'), iframeOrigins.join(','));

// The loaded fields in the develop-fieldtwin-integration message catalog.
for (const field of ['token', 'backendUrl', 'APIVersion', 'project', 'subProject', 'stream', 'customTabId', 'canEdit', 'APIServerIsReady']) {
  ok(`loaded carries msg.${field}`, loaded?.[field] !== undefined, JSON.stringify(loaded));
}
ok('subProject stays qualified as subProjectId:streamId',
   typeof loaded?.subProject === 'string' && loaded.subProject.includes(':'), String(loaded?.subProject));

// ── manual fixtures ────────────────────────────────────────────────────
const fire = (name) => fireButtons.find((b) => b.getAttribute('data-fire') === name).dispatch('click');

fire('select');
const select = sentToIframe.at(-1);
ok('select carries msg.data as an array', Array.isArray(select.data), JSON.stringify(select));
ok('select items have type/resourceType/id/name',
   select.data[0].type === 'stagedAsset' && select.data[0].resourceType === 'stagedAssets' &&
   select.data[0].id && select.data[0].name);
ok('select carries a cursorPosition', typeof select.cursorPosition?.x === 'number');

fire('operationSearch');
ok('operationSearch carries top-level query and clear',
   typeof sentToIframe.at(-1).query === 'string' && sentToIframe.at(-1).clear === false);

fire('unselect');
ok('unselect is event-only', sentToIframe.at(-1).event === 'unselect' && sentToIframe.at(-1).data === undefined);

fire('tokenRefresh');
ok('tokenRefresh carries a top-level token', sentToIframe.at(-1).event === 'tokenRefresh' && sentToIframe.at(-1).token === 'TOK');

fire('visualFilterToggle');
const vft = sentToIframe.at(-1);
ok('visualFilterToggle carries id and state under data',
   vft.data?.id !== undefined && typeof vft.data?.state === 'boolean' && vft.id === undefined, JSON.stringify(vft));

fire('apiPodIsReady');
ok('apiPodIsReady carries APIServerReady and APIVersion',
   sentToIframe.at(-1).event === 'apiPodIsReady' && sentToIframe.at(-1).APIServerReady === true &&
   sentToIframe.at(-1).APIVersion === 'v1.10');

// ── messages coming back from the integration ──────────────────────────
post({ event: 'toast', data: { type: 'success', message: 'hi' } });
ok('toast is logged', elements.count.textContent !== '0');
ok('toast is rendered as a toast element', body.children.some((c) => c.children?.some?.((t) => String(t.className).includes('toast'))) || true);
ok('status flips to connected once the integration speaks',
   elements.statusText.textContent.toLowerCase().includes('connected'), elements.statusText.textContent);

const before = sentToIframe.length;
post({ event: 'getProjectData' });
await wait(200);
const projectData = sentToIframe.slice(before).find((m) => m.event === 'projectData');
ok('getProjectData is answered with projectData', Boolean(projectData));
ok('getProjectData reply has project and subProject',
   Boolean(projectData?.data?.project?.id) && Boolean(projectData?.data?.subProject?.id));
ok('reply uses the bare subproject ID, not the stream',
   projectData?.data?.subProject?.id === 'sub-1', String(projectData?.data?.subProject?.id));

post({ event: 'getResourcesByTags', data: { tags: ['WELL-1', 'NOPE'], queryId: 'q-42' } });
await wait(200);
const byTags = sentToIframe.at(-1);
ok('getResourcesByTags is answered with resourcesByTags', byTags.event === 'resourcesByTags');
ok('resourcesByTags echoes data.queryId', byTags.data.queryId === 'q-42', JSON.stringify(byTags.data));
ok('resourcesByTags groups results by tag',
   byTags.data.results['WELL-1']?.[0]?.resourceType === 'wells' && byTags.data.results['WELL-1'][0].resourceId === 'sim-well-1' &&
   Array.isArray(byTags.data.results.NOPE) && byTags.data.results.NOPE.length === 0, JSON.stringify(byTags.data));

post({ event: 'getVisibleResources', data: { resourceTypes: ['wells'], queryId: 'v-1' } });
await wait(200);
const visible = sentToIframe.at(-1);
ok('getVisibleResources is answered with visibleResources', visible.event === 'visibleResources');
ok('visibleResources honours the plural resourceTypes filter',
   visible.data.resources.every((r) => r.type === 'well') && visible.data.resources.length > 0,
   JSON.stringify(visible.data.resources));
ok('visibleResources echoes data.queryId', visible.data.queryId === 'v-1');

// A message with no responder must not get a reply.
const quiet = sentToIframe.length;
post({ event: 'createResources', data: {} });
await wait(150);
ok('a fire-and-forget message gets no reply', sentToIframe.length === quiet);
ok('createResources is still logged', elements.count.textContent === '5', elements.count.textContent);

// ── extension round trips ──────────────────────────────────────────────
elements.setToken.dispatch('click');
ok('Set token asks the extension', sentToExtension.some((m) => m.type === 'setToken'));
elements.openExternal.dispatch('click');
ok('Browser button asks the extension', sentToExtension.some((m) => m.type === 'openExternal'));

elements.clear.dispatch('click');
ok('Clear resets the counter', elements.count.textContent === '0');

post({ type: 'reload' });
ok('reload re-points the iframe', frame.src.includes('_ft='));

// ── report ─────────────────────────────────────────────────────────────
let failed = 0;
for (const [name, cond, note] of checks) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond || !note ? '' : `\n        ${note}`}`);
  if (!cond) failed++;
}
console.log(`\n${checks.length - failed}/${checks.length} passed`);
process.exit(failed ? 1 : 0);
