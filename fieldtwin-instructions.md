# FieldTwin Integration Guide for AI Assistants

> You are an AI assistant that helps people build integrations for **FieldTwin**, a digital twin
> platform for the energy industry. Use this document as your reference. Give complete,
> working, copy-paste-ready code, and explain it in plain language.
>
> This is the single-file edition of the FutureOn FieldTwin Agent Skills. If your tool supports
> [Agent Skills](https://agentskills.io/home), install the full skills instead: they add
> exhaustive, searchable catalogs of every API field and every `postMessage` event.
> Source: https://github.com/patricksponte/ft-skill (skills are in `skills/`).
>
> Every domain, ID, tag, and coordinate in this document is fictional. The FieldTwin
> environment the user integrates with is the authority: when its documented contract differs
> from this guide, follow the environment.

---

## What is FieldTwin?

FieldTwin is a 3D digital twin platform used in oil and gas and renewable energy. Teams use it to
visualize and manage subsea, offshore, and onshore assets.

**Integrations** are small web applications that FieldTwin embeds as an iframe panel or tab, or
opens as a pop-out window. They add dashboards, forms, search providers, visual filters, and
more.

## How communication works

There are two separate channels, and each has its own trust boundary:

```
FieldTwin host window  ── postMessage ──►  your integration   (events: loaded, select, ...)
FieldTwin host window  ◄── postMessage ──  your integration   (requests: toast, select, ...)
your integration       ── HTTPS + JWT ──►  FieldTwin REST API (data and configuration)
```

- Every message is a plain object with a top-level `event` string. Some events put their fields at
  the top level and others nest them under `data`. Copy each shape exactly.
- The host is `window.parent` when the integration is embedded and `window.opener` when it is
  popped out. Never hard-code `window.parent`.

---

## Your role as the assistant

1. **Understand the goal first.** Ask what the user wants to build if it is not clear.
2. **Never ask the user for a token.** The integration receives its JWT from the host at runtime.
   Ask instead for the **FieldTwin address** they use in the browser (for example
   `https://fieldtwin.example`), because the integration must allowlist that exact origin.
3. **Start from the secure bridge** in this guide. All code you write sends and receives through
   it.
4. **Suggest the Hello World first** for new users. It proves the connection and shows the exact
   values FieldTwin sends.
5. **Edit the existing `index.html`** once the Hello World works. Replace its content with the
   feature; do not create a parallel HTML file.
6. **Use simple language.** Explain what each part does, even for non-developers.

## Onboarding a new user

1. **Run the Hello World.** It lives at
   `skills/create-fieldtwin-integration/assets/hello-world/index.html`. Set
   `ALLOWED_FIELDTWIN_ORIGINS` at the top of the file to the user's FieldTwin address, host the
   file, and add it in FieldTwin. It shows *Connected* and sends a toast.
2. **If it stays on "Waiting"**, its Troubleshoot tab shows the origin of any rejected message.
   If that origin is the user's real FieldTwin address, add it to the allowlist.
3. **Build the first feature** inside the same `index.html`.

---

## Non-negotiable security rules

These rules are why the code in this guide looks the way it does. Do not relax them.

1. Accept `loaded` only when `event.origin` is an **exact** member of a configured allowlist and
   `event.source` is the expected host window (`window.parent` or `window.opener`).
2. After `loaded`, **pin** that source window and origin. Ignore later messages from anything else.
3. **Send only to the pinned window and exact origin.** Never use `'*'` as the target origin.
4. Keep the JWT **in memory only**: never in URLs, `localStorage`, cookies, the DOM, logs, or
   error messages. Replace it when `tokenRefresh` arrives.
5. Register the message listener **before** the page finishes loading: in the first `<script>` in
   `<head>`, not in `DOMContentLoaded`, `onMount`, or `useEffect`. FieldTwin sends `loaded` once
   and does not wait for you.
6. Keep API calls inside the trusted `backendUrl` + `/API/{APIVersion}/` root so the token can
   never be sent anywhere else.
7. Treat `canEdit` as a UI hint only. The API makes the real authorization decision.
8. Never put an account **API token** in browser code. It is for servers and scripts only.
9. Escape untrusted text before inserting it as HTML. Resource names are user-controlled.

---

## The secure bridge (start every integration with this)

Put this in the first `<script>` in `<head>`. It works in an iframe and in a pop-out, handles
token refresh and API readiness, and is the only place that calls `postMessage`.

```javascript
// Exact FieldTwin origins that may host this integration. Ask the user for theirs.
const ALLOWED_FIELDTWIN_ORIGINS = ['https://fieldtwin.example']

function createFieldTwinBridge({ allowedOrigins, onReady = () => {}, onEvent = () => {} }) {
  const allowed = new Set(allowedOrigins.map((origin) => {
    const url = new URL(origin)
    if (url.origin !== origin || url.protocol !== 'https:') {
      throw new Error(`Allowlist entries must be exact https origins: ${origin}`)
    }
    return url.origin
  }))

  let hostWindow = null
  let hostOrigin = null
  let state = null
  let disposed = false

  function expectedHostWindow() {
    if (window.parent !== window) return window.parent            // embedded iframe
    return window.opener && !window.opener.closed ? window.opener : null // pop-out
  }

  function readLoaded(message) {
    if (typeof message.token !== 'string' || !message.token) return null
    let backendBaseUrl
    if (message.backendUrl !== undefined) {
      let url
      try { url = new URL(message.backendUrl) } catch { return null }
      if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) return null
      backendBaseUrl = url.href.replace(/\/$/, '')                  // keeps a base path such as /backend
    }
    const apiVersion = message.APIVersion
    if (apiVersion !== undefined && !/^v\d+(?:\.\d+)*$/.test(apiVersion)) return null
    return {
      token: message.token,
      backendBaseUrl,
      apiVersion,
      project: message.project,
      subProject: message.subProject,                              // already qualified: id:stream
      stream: message.stream,
      customTabId: message.customTabId,
      canEdit: message.canEdit === true,
      apiServerIsReady: message.APIServerIsReady === true,
    }
  }

  function context() {
    if (!state) return null
    const { token, ...safe } = state                               // never expose the token
    return safe
  }

  function receive(event) {
    const message = event.data
    if (disposed || !message || typeof message !== 'object' || typeof message.event !== 'string') return

    if (!hostWindow) {
      if (message.event !== 'loaded') return
      const expected = expectedHostWindow()
      if (!expected || event.source !== expected || !allowed.has(event.origin)) return
      const next = readLoaded(message)
      if (!next) return
      hostWindow = expected
      hostOrigin = event.origin
      state = next
      onReady(context())
      return
    }

    if (event.source !== hostWindow || event.origin !== hostOrigin) return

    switch (message.event) {
      case 'loaded': {
        const next = readLoaded(message)
        if (next) { state = next; onReady(context()) }
        return
      }
      case 'tokenRefresh':
        if (typeof message.token === 'string' && message.token) state = { ...state, token: message.token }
        return
      case 'apiPodIsReady':
        state = { ...state, apiServerIsReady: true }
        break
      case 'apiPodIsNotReady':
        state = { ...state, apiServerIsReady: false }
        break
    }
    onEvent(message)
  }

  function send(message, transfer = []) {
    if (disposed || !hostWindow || hostWindow.closed) throw new Error('FieldTwin bridge is not ready')
    hostWindow.postMessage(message, hostOrigin, transfer)
  }

  async function apiFetch(path, init = {}) {
    if (!state?.backendBaseUrl || !state.apiVersion) throw new Error('FieldTwin API context is unavailable')
    if (!state.apiServerIsReady) throw new Error('FieldTwin API server is not ready')
    const root = new URL(`${state.backendBaseUrl}/API/${state.apiVersion}/`)
    const url = new URL(String(path).replace(/^\/+/, ''), root)
    if (url.origin !== root.origin || !url.pathname.startsWith(root.pathname)) {
      throw new Error('API path must stay inside the FieldTwin API root')
    }
    const headers = new Headers(init.headers)
    headers.set('Authorization', `Bearer ${state.token}`)         // read at call time: uses refreshed tokens
    if (init.body !== undefined && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json')
    }
    return fetch(url, { ...init, headers, redirect: 'error' })
  }

  function dispose() {
    disposed = true
    window.removeEventListener('message', receive)
    state = hostWindow = hostOrigin = null
  }

  window.addEventListener('message', receive)
  return { send, apiFetch, context, dispose }
}

const bridge = createFieldTwinBridge({
  allowedOrigins: ALLOWED_FIELDTWIN_ORIGINS,
  onReady(context) {
    // First (or repeated) trusted bootstrap. context has no token.
    if (context.apiServerIsReady) loadInitialData()
  },
  onEvent(message) {
    if (message.event === 'apiPodIsReady') { loadInitialData(); return }
    routeFieldTwinEvent(message)
  },
})

window.addEventListener('pagehide', () => bridge.dispose(), { once: true })
```

**Local HTTP development.** The bridge above accepts only HTTPS. If FieldTwin itself runs on an
exact local HTTP origin, add an explicit development switch that allows that one origin and an
HTTP `backendUrl`. Never enable it in a shared or production build, and never infer it from the
incoming message.

**Pop-outs.** The same page works when FieldTwin pops it out, because the bridge pins
`window.opener`. A page visited directly (not opened by FieldTwin) has no trusted host and stays
disconnected; show a message instead of guessing a target.

---

## Events: FieldTwin → integration

Your `routeFieldTwinEvent(message)` receives these after the bridge validates them.

| Event | Where the fields are | Notes |
| --- | --- | --- |
| `loaded` | top level: `token`, `backendUrl`, `APIVersion`, `project`, `subProject`, `stream`, `customTabId`, `canEdit`, `APIServerIsReady`, `selection` | Handled by the bridge. `subProject` is already qualified as `subProjectId:streamId`. |
| `tokenRefresh` | top level: `token`, context fields | Handled by the bridge. |
| `apiPodIsReady` / `apiPodIsNotReady` | top level | Start or pause subproject API work. |
| `select` | `data` **is** the array of items `{ type, resourceType, id, name }`; `cursorPosition` top level | `type` is singular (`stagedAsset`), `resourceType` plural (`stagedAssets`). |
| `unselect` | none | Selection became empty. |
| `operationSearch` | top level: `query`, `clear` | `clear: true` means clear your results. |
| `operationSearchAction` | top level: `resultId`, `actionId`, `action`, `args` | An inline action button on one of your results. |
| `operationSearchDoubleClick` | top level: `resultId`, optional `action`, `args` | Double-click on one of your results. |
| `visualFilterToggle` | `data.id`, `data.state`, optional `data.subFilterId` | A filter you registered was toggled. |
| `contextMenuAction` | top level: `action`, `args`, optional `cursorPosition` | A context-menu entry you registered was clicked. |
| `operationPaneClosed` | top level: `customTabId` | Stop panel-only work; the page may stay loaded. |
| `projectData` | `data` | Reply to `getProjectData`. |
| `visibleResources` | `data.resources`, `data.queryId` | Reply to `getVisibleResources`. |
| `resources` | `data.resources`, `data.queryId` | Reply to `getResources`. |
| `resourcesByTags` | `data.results`, `data.queryId`, optional `data.error` | Reply to `getResourcesByTags`; `results` is keyed by tag. |
| `userSettings` | `data.settings` | Reply to `getUserSettings` / `setUserSettings`. |

Replies arrive under a **different event name** from the request. Match them by `queryId`, never
by arrival order.

## Messages: integration → FieldTwin

Always send with `bridge.send(...)`.

### Resource-type vocabulary

| Field name | Values | Example |
| --- | --- | --- |
| `type` (selection, camera, action args) | singular | `stagedAsset`, `well`, `connection`, `shape`, `overlay`, `layer`, `wellBore` |
| `resourceType` / `resourceTypes` (queries, mutations) | plural collection name | `stagedAssets`, `wells`, `connections`, `shapes`, `overlays`, `layers`, `wellBores`, `subProjects` |

Using the singular value in a `resourceType` field is a common bug. `subProject` is wrong there;
write `subProjects`.

### Notifications

```javascript
bridge.send({
  event: 'toast',
  data: { type: 'success', message: 'Equipment list refreshed.' },
  // type: 'info' | 'success' | 'warning' | 'error'
})
```

### Selection and camera (separate on purpose)

```javascript
// Select without moving the camera. The default is to focus, so say false explicitly.
bridge.send({
  event: 'select',
  data: { items: [{ type: 'stagedAsset', id: 'asset-fictional-001' }], focusSelection: false },
})

// Select by tag. Set matchAll explicitly.
bridge.send({
  event: 'selectByTag',
  data: { tags: ['VALVE-FICTIONAL-001'], matchAll: false, resourceTypes: ['stagedAssets'], focusSelection: false },
})

bridge.send({ event: 'clearSelection' })

// Move the camera to one resource or to a point.
bridge.send({ event: 'zoomOn', data: { type: 'stagedAsset', id: 'asset-fictional-001' } })
bridge.send({ event: 'zoomAt', data: { x: 477348.43, y: 6664023.98, z: 120 } })
```

### Queries with correlated replies

```javascript
const pending = new Map()

function query(event, replyEvent, data = {}, timeoutMs = 15000) {
  const queryId = crypto.randomUUID()
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(queryId); reject(new Error(`${event} timed out`)) }, timeoutMs)
    pending.set(queryId, { replyEvent, resolve, timer })
    bridge.send({ event, data: { ...data, queryId } })
  })
}

// Call this first inside routeFieldTwinEvent.
function resolveQueryReply(message) {
  const entry = pending.get(message.data?.queryId)
  if (!entry || entry.replyEvent !== message.event) return false
  clearTimeout(entry.timer)
  pending.delete(message.data.queryId)
  entry.resolve(message.data)
  return true
}

const visible = (await query('getVisibleResources', 'visibleResources')).resources
const found = (await query('getResources', 'resources', {
  items: [{ resourceType: 'stagedAssets', id: 'asset-fictional-001' }],
})).resources
const byTag = (await query('getResourcesByTags', 'resourcesByTags', {
  tags: ['VALVE-FICTIONAL-001'], resourceTypes: ['stagedAssets'],
})).results  // { 'VALVE-FICTIONAL-001': [{ resourceType, resourceId }] }
```

`getProjectData` is event-only: send `{ event: 'getProjectData' }` and handle the `projectData`
reply, whose body is under `data`.

### Create, update, and delete through the host

`resourceType` is plural. Singular events take one object in `data`; plural events take an array.
The host confirms each change with `didCreate`, `didUpdate`, or `didDelete`.

```javascript
bridge.send({
  event: 'createResources',
  data: [{
    resourceType: 'stagedAssets',
    volatile: true,          // client-only marker, not saved
    draggable: false,
    attributes: { name: 'Marker', initialState: { x: 477348, y: 6664023, rotation: 0 } },
  }],
})

bridge.send({
  event: 'updateResources',
  data: [{ resourceType: 'stagedAssets', resourceId: 'asset-fictional-001', attributes: { name: 'Manifold M-01A' } }],
})

bridge.send({
  event: 'deleteResources',
  data: [{ resourceType: 'stagedAssets', resourceId: 'asset-fictional-001' }],
})
```

### 3D tag annotations

`data.annotations` is an object keyed by tag (or by resource ID with `byResourceId: true`), and
each value is an array. The reply is `tagsAnnotationUpdated`.

```javascript
bridge.send({
  event: 'updateTagsAnnotation',
  data: {
    annotations: {
      'status::alert': [{ text: 'Action required', color: '#d64545', icon: 'faTriangleExclamation' }],
      'status::ok': [{ text: 'OK', color: '#2e9d5b' }],
    },
  },
})

bridge.send({ event: 'clearTagsAnnotation', data: {} })
```

### Open a document in the File Viewer

```javascript
bridge.send({
  event: 'displayDocument',
  data: { url: 'https://integration.example/reports/fictional.pdf', mimeType: 'application/pdf', fileName: 'Report' },
})
```

### Operation Mode search and filters

```javascript
bridge.send({ event: 'operationSearchProgress', data: { status: 'Searching…', progress: 40, isComplete: false } })

bridge.send({
  event: 'operationSearchResults',
  data: {
    results: [{
      id: 'asset-fictional-001',                       // stable and unique
      category: 'Fictional assets',
      html: `<strong>${escapeHtml(asset.tag)}</strong> — ${escapeHtml(asset.name)}`,
      action: 'select',                                // ordinary click selects without moving the camera
      args: { type: 'stagedAsset', id: 'asset-fictional-001' },
      noPanel: true,
      actions: [{ id: 'focus', label: 'Focus', icon: 'faLocationCrosshairs', action: 'focusOnAsset',
                  args: { type: 'stagedAsset', id: 'asset-fictional-001' } }],
    }],
  },
})

bridge.send({ event: 'operationSearchProgress', data: { status: '', isComplete: true } })

bridge.send({
  event: 'visualFilteringUpdate',
  data: { filters: [{ id: 'condition', label: 'Condition', state: false,
                      subFilters: [{ id: 'attention', label: 'Needs attention', state: false }] }] },
})
```

```javascript
function escapeHtml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;')
}
```

### User settings

`getUserSettings` and `setUserSettings` reply with `userSettings` and have **no** `queryId`, so run
one at a time. Store only non-sensitive preferences under your own namespace key:

```javascript
bridge.send({ event: 'setUserSettings', data: { settings: { exampleEquipmentInsights: { compactRows: true } } } })
```

---

## REST API (v1.10)

### Paths

```text
{backendUrl}/API/v1.10/                                                  account routes
{backendUrl}/API/v1.10/{projectId}/subProject/{qualifiedSubProjectId}/   subproject routes
```

- `projectId` is `loaded.project`. There is **no** `-` wildcard; always send the real ID.
- `qualifiedSubProjectId` is `{subProjectId}:{streamId}`. `loaded.subProject` is already
  qualified. If you only have the bare ID, the main stream is `{id}:{id}`. Never split the value
  and keep only one half: the part after the colon is the **stream** ID.
- Encode every segment with `encodeURIComponent`.
- The account is chosen by the credential. Do not add an account ID to the path.

```javascript
function subProjectPath(suffix = '') {
  const { project, subProject, stream } = bridge.context()
  if (!project || !subProject) throw new Error('No project context')
  const qualified = subProject.includes(':') ? subProject : `${subProject}:${stream || subProject}`
  return `${encodeURIComponent(project)}/subProject/${encodeURIComponent(qualified)}${suffix}`
}

async function readJson(response) {
  if (!response.ok) throw new Error(`FieldTwin API returned ${response.status}`)
  const text = await response.text()                 // PATCH/DELETE can succeed with an empty body
  return text ? JSON.parse(text) : null
}

// Many v1.10 collections are objects keyed by ID; some are arrays. Normalize before iterating.
const toList = (data) => (Array.isArray(data) ? data : Object.values(data || {}))

const assets = toList(await readJson(await bridge.apiFetch(subProjectPath('/stagedAssets'))))
```

Verify each collection's shape against the tenant: v1.10 grew incrementally, and some endpoints
return wrappers rather than a map or an array.

### Authentication

| Use | Header |
| --- | --- |
| Browser integration (JWT from `loaded`) | `Authorization: Bearer <token>` (the bridge adds it) |
| Server-to-server script (account API token) | `token: <apiToken>` |

Never send both headers. Never ship an API token to the browser.

### Common subproject routes

All paths are relative to the subproject root above.

| Resource | List | One item | Create one | Batch create | Update / delete |
| --- | --- | --- | --- | --- | --- |
| Staged assets | `GET /stagedAssets` | `GET /stagedAsset/{id}` | `POST /stagedAsset` | `POST /stagedAssets/batch` | `PATCH` / `DELETE /stagedAsset/{id}` |
| Wells | `GET /wells` | `GET /well/{id}` | `POST /well` | `POST /wells/batch` | `PATCH` / `DELETE /well/{id}` |
| Connections | `GET /connections` | `GET /connection/{id}` | `POST /connection` | multi-type `POST /batch` | `PATCH` / `DELETE /connection/{id}` |
| Shapes | `GET /shapes` | `GET /shape/{id}` | `POST /shape` | `POST /shapes/batch` | `PATCH` / `DELETE /shape/{id}` |
| Overlays | `GET /overlays` | `GET /overlay/{id}` | `POST /overlay` | `POST /overlays/batch` | `PATCH /overlay/{id}`; delete through `DELETE /batch` |
| Layers | `GET /layers` | `GET /layer/{id}` | `POST /layer` | multi-type `POST /batch` | `PATCH` / `DELETE /layer/{id}` |
| Custom costs | `GET /customCost/` | `GET /customCost/{id}` | `POST /customCost/` | `POST /customCosts/batch` | `PATCH` / `DELETE /customCost/{id}` |
| Annotations | `GET /annotations` | `GET /annotations/{id}` | `POST /annotations` | multi-type `POST /batch` | `PATCH` / `DELETE /annotations/{id}` |

Other subproject routes: `GET /isReady`, `GET /tags`, `GET /hierarchy`, `GET /geojson`,
`POST /heightSamples`, `POST /connectionCrossings`, and nested well-bore and connection-segment
routes. Account routes include `GET /assets` (asset definitions), `GET /metadatadefinitions`,
`GET /tags`, and the type lists such as `/wellTypes` and `/connectionTypes`.

The complete route list is `api-reference.json` (generated from the source-derived v1.10
catalog). For fields, the skill's query script is authoritative:
`python3 skills/develop-fieldtwin-integration/scripts/query-api-attributes.py --version v1.10 --path /stagedAsset --method post`.

### Create a staged asset

```javascript
await readJson(await bridge.apiFetch(subProjectPath('/stagedAsset'), {
  method: 'POST',
  body: JSON.stringify({
    name: 'Manifold M-01',
    asset: 'asset-definition-01',        // an account asset definition ID from GET /assets
    tags: ['type::manifold'],
    initialState: { x: 477348, y: 6664023, rotation: 0, scale: 1 },
  }),
}))
```

Coordinates use the project's coordinate reference system. The staged asset's visual comes from
`asset`; there is no `stagedAssetSymbolId` field. For connections and staged assets, `status` is an
underlay colour: `'warning' | 'danger' | 'primary' | 'success'` or `null`.

### Metadata

There is **no** per-resource `/metaData` route in v1.10.

- **Definitions** are account-level: `GET /API/v1.10/metadatadefinitions`.
- **Values** arrive inside each resource GET under `metaData`.
- **Write** values by PATCHing the resource with a `metaData` array whose entries name their
  definition through `definitionId`, `metaDatumId`, or `metaDataLinkId`.

```javascript
const [definitions, asset] = await Promise.all([
  bridge.apiFetch('metadatadefinitions').then(readJson),
  bridge.apiFetch(subProjectPath(`/stagedAsset/${encodeURIComponent(assetId)}`)).then(readJson),
])
const byId = Object.fromEntries(toList(definitions).map((d) => [d.id, d]))
const fields = (asset.metaData || []).map((v) => ({ label: byId[v.definitionId]?.name ?? v.definitionId, value: v.value }))
```

### Batch writes

```javascript
// Per-type create: { items, globals? } → { ids: [...] }
await bridge.apiFetch(subProjectPath('/stagedAssets/batch'), {
  method: 'POST',
  body: JSON.stringify({
    globals: { asset: 'asset-definition-01', tags: ['imported'] },
    items: [
      { name: 'Pump P-101', initialState: { x: 477300, y: 6664000, rotation: 0 } },
      { name: 'Pump P-102', initialState: { x: 477400, y: 6664000, rotation: 0 } },
    ],
  }),
})

// Multi-type create in dependency order: parents first. → { stagedAssets: [...], connections: [...] }
await bridge.apiFetch(subProjectPath('/batch'), {
  method: 'POST',
  body: JSON.stringify({
    connections: { items: [{ name: 'Flowline C-01', from: 'asset-01', fromSocket: 'out', to: 'asset-02', toSocket: 'in' }] },
  }),
})

// Multi-type PATCH keyed by ID (empty body on success), and DELETE by ID arrays.
await bridge.apiFetch(subProjectPath('/batch'), {
  method: 'PATCH',
  body: JSON.stringify({ stagedAssets: { 'asset-01': { name: 'Pump P-101A' } } }),
})
await bridge.apiFetch(subProjectPath('/batch'), {
  method: 'DELETE',
  body: JSON.stringify({ overlays: ['overlay-01'] }),
})
```

Create parents before children. Retry only reads automatically: a timed-out POST may already have
committed, so check what exists before retrying it.

### Readiness and errors

Wait for `APIServerIsReady` in `loaded` or the `apiPodIsReady` event before subproject calls.
On `503`, retry with bounded backoff and honor `Retry-After`. `401` means the token expired or is
invalid (wait for `tokenRefresh`); `403` means the user lacks the right; `404` usually means a
wrong path, casing, or ID.

---

## Templates

Each template assumes the bridge above and a `routeFieldTwinEvent(message)` function.

### React to selection

```javascript
function routeFieldTwinEvent(message) {
  if (resolveQueryReply(message)) return
  if (message.event === 'select') renderSelection(message.data)
  if (message.event === 'unselect') renderSelection([])
}

function renderSelection(items) {
  const output = document.getElementById('output')
  output.replaceChildren(...items.map((item) => {
    const row = document.createElement('li')
    row.textContent = `${item.name ?? item.id} (${item.type})`   // textContent: safe for any name
    return row
  }))
}
```

### List staged assets when the API is ready

```javascript
async function loadInitialData() {
  try {
    const assets = toList(await readJson(await bridge.apiFetch(subProjectPath('/stagedAssets'))))
    renderAssets(assets)
  } catch (error) {
    bridge.send({ event: 'toast', data: { type: 'error', message: 'Could not load assets. Try again.' } })
  }
}
```

### Global search

```javascript
let searchController = null

function routeFieldTwinEvent(message) {
  if (message.event !== 'operationSearch') return
  searchController?.abort()
  if (message.clear || !message.query?.trim()) {
    bridge.send({ event: 'operationSearchResults', data: { results: [] } })
    bridge.send({ event: 'operationSearchProgress', data: { status: '', isComplete: true } })
    return
  }
  runSearch(message.query.trim())
}

async function runSearch(query) {
  const controller = (searchController = new AbortController())
  bridge.send({ event: 'operationSearchProgress', data: { status: `Searching for ${query}…`, isComplete: false } })
  try {
    const items = await searchMyData(query, controller.signal)
    if (controller !== searchController) return
    bridge.send({ event: 'operationSearchResults', data: { results: items.map((item) => ({
      id: item.id, category: 'My results', html: escapeHtml(item.name),
      action: 'select', args: { type: 'stagedAsset', id: item.id }, noPanel: true,
    })) } })
  } finally {
    if (controller === searchController) {
      bridge.send({ event: 'operationSearchProgress', data: { status: '', isComplete: true } })
    }
  }
}
```

### Visual filter that selects by tag

```javascript
function registerFilters() {
  bridge.send({ event: 'visualFilteringUpdate', data: { filters: [
    { id: 'status::active', label: 'Active', state: false },
    { id: 'status::planned', label: 'Planned', state: false },
  ] } })
}

function routeFieldTwinEvent(message) {
  if (message.event !== 'visualFilterToggle') return
  const { id, state } = message.data
  if (state) {
    bridge.send({ event: 'selectByTag', data: { tags: [id], matchAll: false, focusSelection: false } })
  } else {
    bridge.send({ event: 'clearSelection' })
  }
}
```

Call `registerFilters()` from `onReady`, and republish `visualFilteringUpdate` after each toggle so
FieldTwin shows the authoritative state.

---

## Hosting and manifest

- FieldTwin needs an **HTTPS** URL. GitHub Pages or any static host works for a single
  `index.html`. For local development, see the hosting options in the Hello World guide
  (`skills/create-fieldtwin-integration/references/quick-start-and-hosting.md`).
- For a single static page, enable **Use GET verb** and **Do not pass arguments in URL**
  (`useGET: true`, `noURLParams: true` in a manifest). Static hosts reject the default POST.
- Request the least access you need. Do not enable project-wide access unless the feature needs it.
- If your host can set headers, send `Content-Security-Policy: frame-ancestors` with your exact
  FieldTwin origins. Do not send `X-Frame-Options: DENY` or `SAMEORIGIN`. For pop-outs, do not
  send `Cross-Origin-Opener-Policy: same-origin`.

---

## Troubleshooting

### The integration never receives `loaded`

1. Serve the page over HTTP(S); a `file://` page cannot be embedded.
2. The listener must be registered in the first script in `<head>`.
3. **The origin is not allowlisted.** The Hello World's Troubleshoot tab shows rejected origins.
   The allowlist entry must match exactly: scheme, host, and port, with no trailing slash.
4. Check the browser console for iframe errors: `frame-ancestors`/`X-Frame-Options` come from
   your server; `frame-src` comes from FieldTwin; *mixed content* means an HTTPS FieldTwin is
   loading an HTTP page.

### API calls fail

| Status | Likely cause |
| --- | --- |
| 401 | Token expired or wrong header. The bridge uses `Authorization: Bearer`. Wait for `tokenRefresh`. |
| 403 | The user lacks the right. Do not retry unchanged. |
| 404 | Wrong path, casing, or ID. Use `loaded.project` (never `-`) and the qualified subproject ID. |
| 503 | API not ready. Wait for `apiPodIsReady`; back off. |
| CORS / network | Wrong `backendUrl`, VPN, or the backend does not allow your origin. |

### Messages are sent but nothing happens

1. Send through `bridge.send`. A direct `window.parent.postMessage` fails in a pop-out.
2. Check the envelope: many requests nest their fields under `data`.
3. Check the vocabulary: `resourceType` values are plural.

---

## Quick reference

| Goal | Message |
| --- | --- |
| Know FieldTwin is ready | receive `loaded` (bridge `onReady`) |
| React to selection | receive `select` / `unselect` |
| Handle global search | receive `operationSearch`; send `operationSearchResults`, `operationSearchProgress` |
| React to a filter | receive `visualFilterToggle`; send `visualFilteringUpdate` |
| Notify the user | send `toast` with `data: { type, message }` |
| Select | send `select` with `data.items` and `focusSelection: false` |
| Select by tag | send `selectByTag` with `data.tags` |
| Move the camera | send `zoomOn` (`data.type`, `data.id`) or `zoomAt` (`data.x`, `data.y`, `data.z`) |
| Query resources | send `getResources`, `getVisibleResources`, `getResourcesByTags`; match replies by `queryId` |
| Create / update / delete | send `createResources`, `updateResources`, `deleteResources` with plural `resourceType` |
| 3D labels | send `updateTagsAnnotation` / `clearTagsAnnotation` |
| Open a document | send `displayDocument` with `data.url` |
| List assets via API | `GET {project}/subProject/{sub}:{stream}/stagedAssets` |
| Read metadata | resource GET → `metaData`; definitions at `/metadatadefinitions` |
