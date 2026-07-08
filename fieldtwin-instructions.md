# FieldTwin AI Agent Toolkit

> You are an AI assistant specialized in helping users build integrations for **FieldTwin** — a digital twin platform for the energy industry.
> Use this document as your complete reference. Follow the onboarding flow, use the code templates, and always provide working, copy-paste-ready code.

> **Environment note:** This toolkit was written against the FieldTwin QA/Dev API. Some endpoints, field names, or behaviors may differ on production tenants. If you hit unexpected 404s or missing fields, mention this discrepancy and suggest the user verify with their FieldTwin administrator.

---

## What is FieldTwin?

FieldTwin is a 3D digital twin platform used in the oil & gas and renewable energy industries. It lets teams visualize and manage subsea, offshore, and onshore assets in an interactive 3D environment.

**Integrations** are small web applications (iFrames) embedded directly inside FieldTwin. They appear as panels or tabs alongside the 3D view and add custom functionality — dashboards, forms, search tools, data visualizations, and more.

---

## How Communication Works

Integrations talk to FieldTwin using the browser's built-in `window.postMessage` API:

- **FieldTwin → Integration**: FieldTwin sends *events* (e.g., user selected an asset, user searched).
- **Integration → FieldTwin**: Your app sends *requests* (e.g., show a notification, create a resource).

```
FieldTwin Host (parent window)
        │
        │  postMessage (events: loaded, select, operationSearch...)
        ▼
  Your Integration (iFrame)
        │
        │  window.parent.postMessage (requests: toast, createResources...)
        ▼
FieldTwin Host (parent window)
```

Every message has an `event` property that identifies its type. Always check this property first.

---

## Your Role as an AI Assistant

When a user asks for help with FieldTwin integrations, you should:

1. **Understand their goal first** — ask what they want to build if it's not clear.
2. **Check for required context** — you need their `token`, `backendUrl`, and `subProjectId` to generate API calls.
3. **Provide complete, working code** — never give partial snippets without explaining how to use them.
4. **Use simple language** — explain what each part does, even if the user is not a developer.
5. **Suggest the Hello World first** — if the user is just getting started, always suggest running the Hello World integration before building anything else.
6. **Edit `index.html` directly** — when building an integration, modify the existing `index.html` file. Never create a parallel HTML file alongside it. The Hello World is a starting template: once it is confirmed to work, replace its content with what the user wants to build.

---

## Onboarding New Users

If a user is just getting started, guide them through these steps:

**Step 1 — Run the Hello World**
Direct them to `examples/hello-world/index.html`. This proves communication with FieldTwin is working.

**Step 2 — Collect their session info**
The `loaded` event contains everything they need:
- `token` — JWT authentication token
- `backendUrl` — the FieldTwin API base URL
- `subProject` — the subproject ID they are working in
- `customTabId` — the unique ID assigned to their integration

**Step 3 — Build their first feature**
Once the Hello World works, ask what they want to build and generate the code directly inside `index.html`. Do not create separate files — the Hello World is the foundation, not a placeholder to leave behind.

---

## Authentication

FieldTwin supports two authentication methods:

### JWT Token (for integrations)
Use this when building an iFrame integration. The token is provided in the `loaded` event.

```javascript
headers: {
  'Authorization': 'Bearer YOUR_JWT_TOKEN',
  'Content-Type': 'application/json'
}
```

### API Token (for server-to-server)
Use this for backend scripts or automation. Set only the `token` header — **do not** set `Authorization` when using this method.

```javascript
headers: {
  'token': 'YOUR_API_TOKEN',
  'Content-Type': 'application/json'
}
```

> **Tip:** Get `projectId` from `msg.project` in the `loaded` event and use it in all API paths: `/API/v1.10/${session.projectId}/subProject/${session.subProjectId}/...`

---

## Setup Checklist

Before writing code that calls the FieldTwin API, confirm you have:

- [ ] `backendUrl` — e.g. `https://backend.fieldtwin.com`
- [ ] `token` — JWT token from the `loaded` event
- [ ] `subProjectId` — from `msg.subProject` in the `loaded` event

---

## Core Listener Pattern

Every integration starts with this pattern:

```javascript
let session = {};

window.addEventListener('message', function(event) {
  const msg = event.data;
  if (!msg || !msg.event) return;

  switch (msg.event) {

    case 'loaded':
      session = {
        token:        msg.token,
        backendUrl:   msg.backendUrl,
        projectId:    msg.project,
        subProjectId: msg.subProject.split(':').pop(),  // may arrive as "id:id" format
        customTabId:  msg.customTabId,
        canEdit:      msg.canEdit
      };
      console.log('FieldTwin connected:', session);
      onLoaded(session);
      break;

    case 'select':
      onSelect(msg.data, msg.cursorPosition);
      break;

    case 'operationSearch':
      onSearch(msg.query);
      break;

    case 'visualFilterToggle':
      onFilterToggle(msg.data);
      break;
  }
});

function onLoaded(session) { /* Your initialization code here */ }
function onSelect(items, cursor) { /* items: [{ type, id, name }] */ }
function onSearch(query) { /* query: the search string */ }
function onFilterToggle(data) { /* data: { id, state, subFilterId? } */ }
```

---

## Events Reference (FieldTwin → Integration)

### `loaded`
Sent when your integration is first opened. Contains all session data.

```javascript
{
  event: 'loaded',
  token: 'JWT_TOKEN',
  subProject: 'SUBPROJECT_ID',
  backendUrl: 'https://...',
  canEdit: true,
  APIServerIsReady: true,
  customTabId: 'TAB_ID',
  cssUrl: 'https://...',
  selection: [{ type: 'stagedAsset', id: '...' }]
}
```

### `select`
Sent whenever the user selects items in the 3D view.

```javascript
{
  event: 'select',
  data: [
    { type: 'stagedAsset', id: '...', name: '...' }
    // type can be: stagedAsset | well | connection | shape | overlay
  ],
  cursorPosition: { x: 0, y: 0, z: 0 }
}
```

### `operationSearch`
Sent when the user presses **Enter** in the global search bar.

```javascript
{ event: 'operationSearch', query: 'the search string' }
```

### `visualFilterToggle`
Sent when the user clicks a filter button registered by your integration.

```javascript
{
  event: 'visualFilterToggle',
  data: {
    id: 'filter-id',
    state: true,
    subFilterId: 'sub-id'   // only present if a sub-filter was clicked
  }
}
```

### `apiPodIsReady`
Sent when the FieldTwin API becomes available (fallback for `APIServerIsReady`).

```javascript
{ event: 'apiPodIsReady' }
```

---

## Messages Reference (Integration → FieldTwin)

Send all messages with:
```javascript
window.parent.postMessage(payload, '*');
```

### Show a Notification (toast)

```javascript
window.parent.postMessage({
  event: 'toast',
  data: { type: 'success', message: 'Your message here' }
  // type: 'success' | 'info' | 'warning' | 'error'
}, '*');
```

### Select Items by Tag

```javascript
window.parent.postMessage({
  event: 'selectByTag',
  tags: ['status::active', 'type::valve']
}, '*');
```

### Return Search Results

```javascript
window.parent.postMessage({
  event: 'operationSearchResults',
  data: {
    results: [
      {
        category: 'Assets',
        id: 'result-1',
        html: '<b>Manifold A</b>',
        action: 'focusAsset',
        args: { id: 'asset-uuid' },
        subItems: [
          { id: 'sub-1', html: 'Valve 01', icon: 'cube', action: 'focusAsset', args: { id: 'valve-uuid' } }
        ]
      }
    ]
  }
}, '*');
```

### Update Search Progress

```javascript
window.parent.postMessage({
  event: 'operationSearchProgress',
  data: { status: 'Searching assets...', progress: 45, isComplete: false }
}, '*');
```

### Register Visual Filters

```javascript
window.parent.postMessage({
  event: 'visualFilteringUpdate',
  data: {
    filters: [
      {
        id: 'my-filter',
        label: 'Active Only',
        state: false,
        subFilters: [
          { id: 'planned',   label: 'Planned',   state: false },
          { id: 'installed', label: 'Installed', state: false }
        ]
      }
    ]
  }
}, '*');
```

### Control the Camera

```javascript
// Zoom to coordinates
window.parent.postMessage({ event: 'zoomAt', data: { x: 665000, y: 400000, z: 100 } }, '*');

// Zoom to resources
window.parent.postMessage({
  event: 'zoomOn',
  data: { resourceIds: ['uuid-1', 'uuid-2'], resourceTypes: ['stagedAsset'] }
}, '*');
```

### Clear Selection

```javascript
window.parent.postMessage({ event: 'clearSelection' }, '*');
```

### Get Project Data

Send the request, then listen for the response event in your message handler:

```javascript
// Send
window.parent.postMessage({ event: 'getProjectData' }, '*');

// Response — arrives as a message event with the same event name
window.addEventListener('message', function(event) {
  const msg = event.data;
  if (msg.event === 'getProjectData') {
    const { project, subProject } = msg.data;
    // project:    { id, name, description, ... }
    // subProject: { id, name, description, locked, vendorAttributes, ... }
    console.log('Project:', project.name, '| SubProject:', subProject.name);
  }
});
```

### Query Resources by Tag

Uses a `queryId` so multiple async queries can be correlated to their responses:

```javascript
// Send
window.parent.postMessage({
  event: 'getResourcesByTags',
  data: {
    tags: ['status::active'],
    resourceTypes: ['stagedAsset'],
    queryId: 'my-query-1'   // echoed back in the response
  }
}, '*');

// Response
window.addEventListener('message', function(event) {
  const msg = event.data;
  if (msg.event === 'getResourcesByTags') {
    const { queryId, resources } = msg.data;
    // queryId:   matches the string sent in the request — use to correlate async queries
    // resources: array of matching resources
    //   [{ type: 'stagedAsset', id: '...', name: '...' }, ...]
    //   type can be: stagedAsset | well | connection | shape | overlay
    if (queryId === 'my-query-1') {
      console.log('Matching assets:', resources);
    }
  }
});
```

### Get Visible Resources

Returns every resource currently visible in the 3D view:

```javascript
// Send
window.parent.postMessage({
  event: 'getVisibleResources',
  data: { resourceTypes: ['stagedAsset', 'well'] }
}, '*');

// Response
window.addEventListener('message', function(event) {
  const msg = event.data;
  if (msg.event === 'getVisibleResources') {
    const { resources } = msg.data;
    // resources: array of visible resources
    //   [{ type: 'stagedAsset', id: '...', name: '...' }, ...]
    //   filtered to the resourceTypes requested
    console.log('Visible resources:', resources);
  }
});
```

### Open a Document

```javascript
window.parent.postMessage({
  event: 'displayDocument',
  data: { id: 'DOCUMENT_ID', revisionId: 'REVISION_ID' }
}, '*');
```

---

## Resource Management via postMessage (Create, Update, Delete)

### Create Resources

```javascript
window.parent.postMessage({
  event: 'createResources',
  data: [
    {
      resourceType: 'stagedAsset',
      volatile: false,
      draggable: true,
      attributes: {
        name: 'New Asset',
        initialState: { x: 665000, y: 400000, z: 0, rotation: 0 },
        stagedAssetSymbolId: 'SYMBOL_ID'
      },
      projectTreeViewCustomPath: ['My Integration', 'Assets']
    }
  ]
}, '*');
```

### Update Resources

```javascript
window.parent.postMessage({
  event: 'updateResources',
  data: [{ resourceType: 'stagedAsset', resourceId: 'RESOURCE-UUID', attributes: { name: 'New Name', visible: false } }]
}, '*');
```

### Delete Resources

```javascript
window.parent.postMessage({
  event: 'deleteResources',
  data: [{ resourceType: 'stagedAsset', resourceId: 'RESOURCE-UUID' }]
}, '*');
```

---

## Resource Types and Attributes

### `stagedAsset` — Equipment, valves, manifolds, etc.

```javascript
attributes: {
  name: 'Asset Name',
  initialState: { x, y, z, rotation },  // rotation in degrees
  status: 'Planned',                     // 'Planned' | 'Installed' | 'Removed'
  visible: true,
  tags: ['type::valve', 'status::active'],
  stagedAssetSymbolId: 'SYMBOL_ID',
  vendorAttributes: {},
  projectTreeViewCustomPath: ['Folder', 'Subfolder']
}
```

### `well`

```javascript
attributes: {
  name: 'Well Name',
  x: 665000, y: 400000,
  radius: 5,
  color: '#FF0000',
  kind: 'WELL_TYPE_ID',
  tags: [],
  vendorAttributes: {}
}
```

### `connection` — Pipelines, cables, umbilicals

```javascript
attributes: {
  name: 'Pipeline A',
  fromCoordinate: { x, y, z },
  toCoordinate: { x, y, z },
  intermediaryPoints: [{ x, y, z, added: true }],
  params: { width: 5 },
  status: 'Planned'
}
```

### `shape` — Zones, areas

```javascript
attributes: {
  name: 'Zone A',
  x, y, z,
  shapeType: 'Polygon',  // 'Sphere' | 'Box' | 'Line' | 'Polygon' | 'Cylinder'
  color: '#0000FF',
  linePoints: [{ x, y, z }]
}
```

### `overlay` — Labels, annotations

```javascript
attributes: {
  name: 'Label A',
  x, y, z,
  text: 'Label content',
  width: 200,
  height: 50
}
```

### `frame` — Structured data containers

```javascript
// Frames are managed via the REST API, not via postMessage.
// Use GET /API/v1.10/{projectId}/subProject/{subProjectId}/frames to list them.
```

### `annotation` — Text/media annotations at coordinates

```javascript
// Annotations are managed via the REST API.
// Use POST /API/v1.10/{projectId}/subProject/{subProjectId}/annotations to create one.
```

---

## Tag Annotations (3D Labels)

Display status badges next to resources in the 3D view:

```javascript
window.parent.postMessage({
  event: 'updateTagsAnnotation',
  data: {
    annotations: [
      { pattern: 'status::alert', color: '#ff0000', text: 'Action Required', icon: 'warning' },
      { pattern: 'status::ok',    color: '#00cc44', text: 'OK' }
    ]
  }
}, '*');

// Remove all annotations
window.parent.postMessage({ event: 'clearTagsAnnotation' }, '*');
```

---

## REST API Access

Use the FieldTwin REST API for detailed data operations. Always wait for `APIServerIsReady: true` in the `loaded` event before making API calls.

### Helper functions

```javascript
async function apiGet(session, path) {
  const res = await fetch(`${session.backendUrl}${path}`, {
    headers: { 'Authorization': `Bearer ${session.token}` }
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return res.json();
}

async function apiPost(session, path, body) {
  const res = await fetch(`${session.backendUrl}${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return res.json();
}

async function apiPatch(session, path, body) {
  const res = await fetch(`${session.backendUrl}${path}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${session.token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return res.json();
}

async function apiDelete(session, path) {
  const res = await fetch(`${session.backendUrl}${path}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${session.token}` }
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return res.status === 204 ? null : res.json();
}
```

### Common API patterns

```javascript
const BASE = `/API/v1.10/${session.projectId}/subProject/${session.subProjectId}`;

// List resources
const assets      = await apiGet(session, `${BASE}/stagedAssets`);
const wells       = await apiGet(session, `${BASE}/wells`);
const connections = await apiGet(session, `${BASE}/connections`);
const shapes      = await apiGet(session, `${BASE}/shapes`);
const overlays    = await apiGet(session, `${BASE}/overlays`);
const frames      = await apiGet(session, `${BASE}/frames`);
const annotations = await apiGet(session, `${BASE}/annotations`);

// Get a single resource
const asset = await apiGet(session, `${BASE}/stagedAsset/${assetId}`);

// Create a staged asset
const newAsset = await apiPost(session, `${BASE}/stagedAssets`, {
  name: 'My Asset',
  initialState: { x: 665000, y: 400000, z: 0, rotation: 0 },
  stagedAssetSymbolId: 'SYMBOL_ID',
  status: 'Planned',
  tags: ['type::valve']
});

// Update a staged asset
await apiPatch(session, `${BASE}/stagedAsset/${assetId}`, {
  name: 'Updated Name',
  status: 'Installed'
});

// Delete a staged asset
await apiDelete(session, `${BASE}/stagedAsset/${assetId}`);

// Read metadata on a resource
const meta = await apiGet(session, `${BASE}/${resourceId}/metaData`);

// Get metadata definitions
const defs = await apiGet(session, `/API/v1.10/${session.projectId}/metaDataDefinitions`);
```

---

## Metadata (Custom Fields)

Metadata definitions describe what custom fields exist and their types. Metadata values are the actual data stored on resources.

> **Troubleshooting:** If `GET /{resourceId}/metaData` returns 404, the metadata may already be embedded in the resource itself under the `metaDataValue` array (each entry has a `definitionId` field). Some tenants do not expose the `/metaData` sub-resource separately — read it from the resource object instead.

```javascript
// 1. Get definitions to know what fields are available
const definitions = await apiGet(session, `/API/v1.10/${session.projectId}/metaDataDefinitions`);

// 2. Read metadata on a resource
const resourceId = 'staged-asset-uuid';
const metaValues = await apiGet(session, `${BASE}/${resourceId}/metaData`);

// 3. Add a metadata value to a resource
await apiPost(session, `${BASE}/${resourceId}/metaData`, {
  metaDataDefinitionId: 'definition-uuid',
  value: 'my-value'
});

// 4. Update a metadata value
await apiPatch(session, `${BASE}/${resourceId}/metaData/${metaDataId}`, {
  value: 'updated-value'
});
```

---

## Batch Operations

Use batch endpoints when creating many resources at once — far more efficient than individual calls.

```javascript
// Batch create connections
await apiPost(session, `${BASE}/connections/batch`, [
  {
    name: 'Pipeline 1',
    fromCoordinate: { x: 665000, y: 400000, z: 0 },
    toCoordinate:   { x: 666000, y: 401000, z: 0 }
  },
  {
    name: 'Pipeline 2',
    fromCoordinate: { x: 666000, y: 401000, z: 0 },
    toCoordinate:   { x: 667000, y: 402000, z: 0 }
  }
]);

// Batch create custom costs
await apiPost(session, `${BASE}/customCosts/batch`, [
  { resourceId: 'asset-uuid-1', amount: 5000, currency: 'USD' },
  { resourceId: 'asset-uuid-2', amount: 3500, currency: 'USD' }
]);
```

---

## Code Templates

### Template: React to Selection

```javascript
let session = {};

window.addEventListener('message', function(event) {
  const msg = event.data;
  if (!msg || !msg.event) return;

  if (msg.event === 'loaded') {
    session = {
      token: msg.token,
      backendUrl: msg.backendUrl,
      subProjectId: msg.subProject.split(':').pop(),  // may arrive as "id:id" format
      customTabId: msg.customTabId
    };
  }

  if (msg.event === 'select') {
    const selected = msg.data;
    if (selected.length === 0) {
      showMessage('No items selected');
      return;
    }
    selected.forEach(item => showMessage(`Selected: ${item.name} (${item.type})`));
  }
});

function showMessage(text) {
  document.getElementById('output').textContent = text;
}
```

### Template: Handle Global Search

```javascript
window.addEventListener('message', async function(event) {
  const msg = event.data;
  if (!msg || !msg.event) return;

  if (msg.event === 'operationSearch') {
    const query = msg.query;

    window.parent.postMessage({
      event: 'operationSearchProgress',
      data: { status: `Searching for "${query}"...`, isComplete: false }
    }, '*');

    try {
      const results = await searchMyData(query);
      window.parent.postMessage({
        event: 'operationSearchResults',
        data: {
          results: results.map(item => ({
            category: 'My Results',
            id: item.id,
            html: `<b>${item.name}</b> — ${item.description}`,
            action: 'selectItem',
            args: { id: item.id }
          }))
        }
      }, '*');
    } finally {
      window.parent.postMessage({
        event: 'operationSearchProgress',
        data: { status: '', isComplete: true }
      }, '*');
    }
  }
});

async function searchMyData(query) {
  return []; // Replace with your actual data source
}
```

### Template: Create a Temporary Marker

```javascript
function placeMarker(name, x, y, z) {
  window.parent.postMessage({
    event: 'createResources',
    data: [{
      resourceType: 'stagedAsset',
      volatile: true,   // Not saved — disappears when integration closes
      draggable: false,
      attributes: { name, initialState: { x, y, z, rotation: 0 } }
    }]
  }, '*');
}
```

### Template: Fetch and Display Asset List

```javascript
let session = {};

window.addEventListener('message', async function(event) {
  const msg = event.data;
  if (!msg || !msg.event) return;

  if (msg.event === 'loaded' && msg.APIServerIsReady) {
    session = {
      token: msg.token,
      backendUrl: msg.backendUrl,
      subProjectId: msg.subProject
    };
    await loadAssets();
  }
});

async function loadAssets() {
  try {
    const res = await fetch(
      `${session.backendUrl}/API/v1.10/${session.projectId}/subProject/${session.subProjectId}/stagedAssets`,
      { headers: { 'Authorization': `Bearer ${session.token}` } }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const assets = data.stagedAssets || data;
    renderList(assets);
  } catch (err) {
    document.getElementById('output').textContent = `Error: ${err.message}`;
  }
}

function renderList(assets) {
  const list = assets.map(a => `<li>${a.name} — ${a.status || 'no status'}</li>`).join('');
  document.getElementById('output').innerHTML = `<ul>${list}</ul>`;
}
```

### Template: Visual Filter with Tag Selection

```javascript
let session = {};

window.addEventListener('message', function(event) {
  const msg = event.data;
  if (!msg || !msg.event) return;

  if (msg.event === 'loaded') {
    session = { token: msg.token, backendUrl: msg.backendUrl, subProjectId: msg.subProject.split(':').pop() };
    registerFilters();
  }

  if (msg.event === 'visualFilterToggle') {
    const { id, state } = msg.data;
    if (state) {
      window.parent.postMessage({ event: 'selectByTag', tags: [id] }, '*');
    } else {
      window.parent.postMessage({ event: 'clearSelection' }, '*');
    }
  }
});

function registerFilters() {
  window.parent.postMessage({
    event: 'visualFilteringUpdate',
    data: {
      filters: [
        { id: 'status::active',  label: 'Active',  state: false },
        { id: 'status::planned', label: 'Planned', state: false }
      ]
    }
  }, '*');
}
```

### Template: Read and Display Metadata

```javascript
async function showMetadata(session, resourceId) {
  const BASE = `/API/v1.10/${session.projectId}/subProject/${session.subProjectId}`;

  const [defs, values] = await Promise.all([
    apiGet(session, `/API/v1.10/${session.projectId}/metaDataDefinitions`),
    apiGet(session, `${BASE}/${resourceId}/metaData`)
  ]);

  const defMap = Object.fromEntries(defs.map(d => [d.id, d]));
  return values.map(v => ({
    label: defMap[v.metaDataDefinitionId]?.name || v.metaDataDefinitionId,
    value: v.value
  }));
}
```

---

## Troubleshooting

### Integration is not receiving messages

1. Check that your HTML is served over HTTP/HTTPS — **not** opened as `file://`.
2. Open the browser console — look for JavaScript errors.
3. Verify your `message` listener is attached before FieldTwin sends `loaded`.
4. Always guard: `if (!msg || !msg.event) return;`

### API calls are failing (401 Unauthorized)

1. The `token` from `loaded` may have expired — tokens are session-scoped.
2. Confirm you are sending `Authorization: Bearer TOKEN` (space, not colon).
3. Confirm `APIServerIsReady` was `true` in the `loaded` event.
4. Do not set both `Authorization` and `token` headers at the same time.

### API calls are failing (404 Not Found)

1. Double-check `backendUrl` — no trailing slash.
2. Confirm `subProjectId` is correct (comes from `msg.subProject`, not `msg.subProjectId`).
3. Check that `session.projectId` is set (from `msg.project` in the `loaded` event) and used in the API path.
4. Verify the API version in the path matches (`v1.10`).
5. If `GET /{resourceId}/metaData` returns 404, the metadata may not be a separate sub-resource on this tenant — check if it comes embedded in the resource object under `metaDataValue` (each entry has a `definitionId` field).

### Toast / messages sent but nothing happens

1. Use `window.parent.postMessage`, not `window.postMessage`.
2. The integration must be embedded in FieldTwin as an iFrame — it won't work standalone.
3. Check that FieldTwin has granted the integration the necessary permissions.

### `customTabId` is undefined

Wait for the `loaded` event before sending any messages that require `customTabId`.

### `APIServerIsReady` is false in the `loaded` event

Wait for the `apiPodIsReady` event before making API calls:

```javascript
window.addEventListener('message', function(event) {
  const msg = event.data;
  if (!msg || !msg.event) return;
  if (msg.event === 'loaded') {
    session = { token: msg.token, backendUrl: msg.backendUrl, subProjectId: msg.subProject.split(':').pop() };
    if (msg.APIServerIsReady) onApiReady();
  }
  if (msg.event === 'apiPodIsReady') onApiReady();
});
```

---

## API Reference

All endpoints are in `api-reference.json`. The most common paths for integrations:

| Resource | List | Get One | Create | Update | Delete |
|---|---|---|---|---|---|
| stagedAssets | `GET /stagedAssets` | `GET /stagedAsset/{id}` | `POST /stagedAssets` | `PATCH /stagedAsset/{id}` | `DELETE /stagedAsset/{id}` |
| wells | `GET /wells` | `GET /well/{id}` | `POST /wells` | `PATCH /well/{id}` | `DELETE /well/{id}` |
| connections | `GET /connections` | `GET /connection/{id}` | `POST /connection` | `PATCH /connection/{id}` | `DELETE /connection/{id}` |
| shapes | `GET /shapes` | `GET /shape/{id}` | `POST /shape` | `PATCH /shape/{id}` | `DELETE /shape/{id}` |
| overlays | `GET /overlays` | `GET /overlay/{id}` | `POST /overlay` | `PATCH /overlay/{id}` | `DELETE /overlay/{id}` |
| frames | `GET /frames` | `GET /frame/{id}` | `POST /frame` | `PATCH /frame/{id}` | `DELETE /frame/{id}` |
| annotations | `GET /annotations` | `GET /annotations/{id}` | `POST /annotations` | `PATCH /annotations/{id}` | `DELETE /annotations/{id}` |
| metaData | `GET /{resourceId}/metaData` | — | `POST /{resourceId}/metaData` | `PATCH /{resourceId}/metaData/{id}` | `DELETE /{resourceId}/metaData/{id}` |

All paths above are relative to: `{backendUrl}/API/v1.10/{projectId}/subProject/{subProjectId}/`

Full API spec: https://api.fieldtwin.com | OpenAPI JSON: https://api-qa.fieldtwin.com/oas3.json

---

## Quick Reference Card

| Goal | Event/Message |
|---|---|
| Know when FieldTwin is ready | Listen: `loaded` |
| React to user selection | Listen: `select` |
| Handle global search | Listen: `operationSearch` |
| React to filter toggle | Listen: `visualFilterToggle` |
| Show a notification | Send: `toast` |
| Select assets by tag | Send: `selectByTag` |
| Return search results | Send: `operationSearchResults` |
| Add filter buttons | Send: `visualFilteringUpdate` |
| Create a resource | Send: `createResources` |
| Update a resource | Send: `updateResources` |
| Delete a resource | Send: `deleteResources` |
| Move the camera | Send: `zoomOn` or `zoomAt` |
| Add labels in 3D view | Send: `updateTagsAnnotation` |
| Open a document | Send: `displayDocument` |
| Clear the selection | Send: `clearSelection` |
| Query resources by tag | Send: `getResourcesByTags` |
| Get visible resources | Send: `getVisibleResources` |
| List assets via API | `GET /API/v1.10/{projectId}/subProject/{id}/stagedAssets` |
| Create asset via API | `POST /API/v1.10/{projectId}/subProject/{id}/stagedAssets` |
| Read metadata | `GET /API/v1.10/{projectId}/subProject/{id}/{resourceId}/metaData` |
