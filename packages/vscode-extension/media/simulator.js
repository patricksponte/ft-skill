// @ts-check
/**
 * The simulator plays the part of the FieldTwin host: it sends the events the
 * platform would send, and shows everything the integration posts back. The
 * integration under test needs no changes — it talks to `window.parent`
 * exactly as it does in production.
 */
(function () {
  const vscode = acquireVsCodeApi();

  const frame = /** @type {HTMLIFrameElement} */ (document.getElementById('frame'));
  const statusDot = document.getElementById('status');
  const statusText = document.getElementById('statusText');
  const targetLabel = document.getElementById('target');
  const logList = document.getElementById('logList');
  const emptyHint = document.getElementById('emptyHint');
  const countBadge = document.getElementById('count');
  const sessionJson = document.getElementById('sessionJson');

  const toasts = document.createElement('div');
  toasts.id = 'toasts';
  document.body.appendChild(toasts);

  /** @type {Record<string, any>} */
  let session = {};
  let targetUrl = '';
  let count = 0;
  let sawFirstMessage = false;

  // ── host → integration ──────────────────────────────────────────────

  function send(payload) {
    if (!frame.contentWindow || !targetUrl) return;
    // Like the real host, address the integration's exact origin.
    frame.contentWindow.postMessage(payload, new URL(targetUrl).origin);
    vscode.postMessage({ type: 'log', text: `host → integration: ${payload.event}` });
  }

  // Shapes follow the develop-fieldtwin-integration message catalog: most
  // host events carry their fields at the top level, visualFilterToggle
  // carries them under `data`, and select uses `data` as the item array.
  const FIXTURES = {
    loaded: () => ({ event: 'loaded', ...session }),
    tokenRefresh: () => ({
      event: 'tokenRefresh',
      token: session.token,
      backendUrl: session.backendUrl,
      project: session.project,
      subProject: session.subProject,
      isFrameActive: true,
    }),
    apiPodIsReady: () => ({
      event: 'apiPodIsReady',
      subProject: session.subProject,
      APIServerReady: true,
      APIVersion: session.APIVersion,
    }),
    select: () => ({
      event: 'select',
      isFrameActive: true,
      data: [
        { type: 'stagedAsset', resourceType: 'stagedAssets', id: 'sim-asset-1', name: 'Simulated Manifold A' },
      ],
      cursorPosition: { x: 665120, y: 400340, z: -1180 },
    }),
    unselect: () => ({ event: 'unselect', isFrameActive: true }),
    operationSearch: () => ({ event: 'operationSearch', query: 'manifold', clear: false }),
    visualFilterToggle: () => ({
      event: 'visualFilterToggle',
      data: { id: 'sim-filter-1', state: true },
    }),
  };

  document.querySelectorAll('[data-fire]').forEach((button) => {
    button.addEventListener('click', () => {
      const name = button.getAttribute('data-fire');
      const fixture = FIXTURES[name];
      if (fixture) send(fixture());
    });
  });

  // ── integration → host ──────────────────────────────────────────────

  const POOL = [
    { type: 'stagedAsset', resourceType: 'stagedAssets', id: 'sim-asset-1', name: 'Simulated Manifold A', tags: ['MANIFOLD-A'] },
    { type: 'stagedAsset', resourceType: 'stagedAssets', id: 'sim-asset-2', name: 'Simulated Manifold B', tags: ['MANIFOLD-B'] },
    { type: 'well', resourceType: 'wells', id: 'sim-well-1', name: 'Simulated Well 1', tags: ['WELL-1'] },
    { type: 'connection', resourceType: 'connections', id: 'sim-conn-1', name: 'Simulated Flowline', tags: ['FLOWLINE-1'] },
  ];

  /** `resourceTypes` filters are plural (stagedAssets); `type` is singular. */
  const ofTypes = (types) => (Array.isArray(types) && types.length ? POOL.filter((r) => types.includes(r.resourceType)) : POOL);

  /**
   * Some messages are requests. Each reply has its own event name
   * (getProjectData → projectData) with the body under `data`, and echoes
   * `data.queryId` where the host contract does. Answering them with
   * plausible fixtures keeps a real integration from hanging.
   */
  const RESPONDERS = {
    getProjectData: () => ({
      event: 'projectData',
      data: {
        project: { id: session.project, name: 'Simulated Project', description: 'FieldTwin Simulator' },
        subProject: {
          // loaded.subProject is qualified as subProjectId:streamId.
          id: String(session.subProject || '').split(':')[0],
          name: 'Simulated SubProject',
          description: '',
          locked: false,
          vendorAttributes: {},
        },
      },
    }),
    getViewBox: () => ({
      event: 'viewBox',
      isFrameActive: true,
      data: { viewBox: { x1: 660000, y1: 395000, x2: 670000, y2: 405000 } },
    }),
    getVisibleResources: (msg) => ({
      event: 'visibleResources',
      data: {
        resources: ofTypes(msg && msg.data && msg.data.resourceTypes).map(({ type, id, name }) => ({ type, id, name })),
        queryId: msg && msg.data ? msg.data.queryId : undefined,
      },
    }),
    getResources: (msg) => {
      const wanted = (msg && msg.data && msg.data.items) || [];
      return {
        event: 'resources',
        data: {
          resources: POOL.filter((r) => wanted.some((w) => w.id === r.id)).map(({ id, name, tags }) => ({ id, name, tags })),
          queryId: msg && msg.data ? msg.data.queryId : undefined,
        },
      };
    },
    getResourcesByTags: (msg) => {
      const data = (msg && msg.data) || {};
      const results = {};
      for (const tag of data.tags || []) {
        results[tag] = ofTypes(data.resourceTypes)
          .filter((r) => r.tags.includes(tag))
          .map((r) => ({ resourceType: r.resourceType, resourceId: r.id }));
      }
      return { event: 'resourcesByTags', data: { results, queryId: data.queryId } };
    },
  };

  window.addEventListener('message', (event) => {
    const msg = event.data;
    if (!msg || typeof msg !== 'object') return;

    // Messages from the extension host, not from the integration.
    if (msg.type === 'session') {
      session = msg.session;
      targetUrl = msg.target;
      targetLabel.textContent = msg.target;
      sessionJson.textContent = JSON.stringify(session, null, 2);
      if (!msg.hasToken) {
        setStatus('waiting', 'No API token set — REST calls will fail');
      }
      load();
      return;
    }
    if (msg.type === 'reload') {
      load();
      return;
    }

    if (!msg.event) return;

    if (!sawFirstMessage) {
      sawFirstMessage = true;
      setStatus('ok', 'Integration connected');
    }

    const responder = RESPONDERS[msg.event];
    record(msg, Boolean(responder));

    if (msg.event === 'toast') showToast(msg.data || msg);
    if (responder) {
      // A real host takes a beat; answering synchronously can land before the
      // integration has finished registering its listener.
      setTimeout(() => send(responder(msg)), 60);
    }
  });

  // ── rendering ───────────────────────────────────────────────────────

  function record(msg, replied) {
    count += 1;
    countBadge.textContent = String(count);
    emptyHint.style.display = 'none';

    const time = new Date().toLocaleTimeString(undefined, { hour12: false });
    const item = document.createElement('li');
    const details = document.createElement('details');
    const summary = document.createElement('summary');

    const name = document.createElement('span');
    name.className = 'event';
    name.textContent = msg.event;
    summary.appendChild(name);

    if (replied) {
      const badge = document.createElement('span');
      badge.className = 'replied';
      badge.textContent = 'replied';
      summary.appendChild(badge);
    }

    const stamp = document.createElement('span');
    stamp.className = 'time';
    stamp.textContent = time;
    summary.appendChild(stamp);

    const body = document.createElement('pre');
    body.textContent = safeStringify(msg);

    details.appendChild(summary);
    details.appendChild(body);
    item.appendChild(details);
    logList.prepend(item);

    vscode.postMessage({ type: 'log', text: `integration → host: ${msg.event}` });
  }

  function safeStringify(value) {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  function showToast(data) {
    const el = document.createElement('div');
    const kind = (data && data.type) || 'info';
    el.className = `toast toast--${kind}`;
    el.textContent = (data && (data.message || data.text)) || 'toast';
    toasts.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }

  function setStatus(kind, text) {
    statusDot.className = `status status--${kind}`;
    statusText.textContent = text;
  }

  // ── iframe lifecycle ────────────────────────────────────────────────

  function load() {
    if (!targetUrl) return;
    sawFirstMessage = false;
    setStatus('waiting', 'Loading the integration…');
    // Cache-bust so a reload always fetches the edited file.
    frame.src = `${targetUrl}${targetUrl.includes('?') ? '&' : '?'}_ft=${Date.now()}`;
  }

  frame.addEventListener('load', () => {
    setStatus('waiting', 'Loaded — sending the loaded event…');
    // FieldTwin sends `loaded` once the tab is mounted; mimic that automatically
    // so the common case needs no clicking at all.
    setTimeout(() => {
      send(FIXTURES.loaded());
      setTimeout(() => {
        if (!sawFirstMessage) {
          // The secure bridge ignores `loaded` from any origin that is not in
          // its allowlist, and a webview can never be an https FieldTwin origin.
          setStatus(
            'bad',
            `No reply. Is the integration listening for loaded? If it allowlists ` +
              `FieldTwin origins, it ignores this simulator (${window.location.origin}).`,
          );
        }
      }, 2500);
    }, 150);
  });

  document.getElementById('reload').addEventListener('click', load);
  document.getElementById('clear').addEventListener('click', () => {
    logList.innerHTML = '';
    count = 0;
    countBadge.textContent = '0';
    emptyHint.style.display = '';
  });
  document.getElementById('setToken').addEventListener('click', () =>
    vscode.postMessage({ type: 'setToken' }),
  );
  document.getElementById('openExternal').addEventListener('click', () =>
    vscode.postMessage({ type: 'openExternal' }),
  );
})();
