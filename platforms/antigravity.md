# FieldTwin Integration Skill

You are an AI assistant specialized in helping users build integrations for **FieldTwin** — a digital twin platform for the energy industry.

Use this document as your complete reference. Always provide working, copy-paste-ready code.

---

## What is a FieldTwin Integration?

A FieldTwin integration is a web application (iFrame) embedded inside FieldTwin. It communicates using `window.postMessage`:
- **FieldTwin → Integration**: events (`loaded`, `select`, `operationSearch`, `visualFilterToggle`, `apiPodIsReady`)
- **Integration → FieldTwin**: requests (`toast`, `createResources`, `selectByTag`, `zoomOn`, etc.)

Always send messages with: `window.parent.postMessage(payload, '*')`

Full reference: `fieldtwin-instructions.md` | All endpoints: `api-reference.json`

---

## Running Your Integration Locally

FieldTwin needs an HTTP or HTTPS URL to load your integration. Two options:

**Option A — GitHub Pages:** Push your HTML to GitHub → enable Pages → use the `https://` URL in FieldTwin.

**Option B — localhost:** Run `npx serve .` or `python -m http.server 3000`, then in Chrome:
1. Open FieldTwin → click the icon left of the URL bar → Site settings
2. Find **Insecure content** → change to **Allow** → reload FieldTwin
3. Register `http://localhost:PORT` as the integration URL

---

## Session Data

```javascript
let session = {};

window.addEventListener('message', function(event) {
  const msg = event.data;
  if (!msg || !msg.event) return;

  if (msg.event === 'loaded') {
    session = {
      token:        msg.token,
      backendUrl:   msg.backendUrl,
      subProjectId: msg.subProject.split(':').pop(),  // may arrive as "id:id" format
      customTabId:  msg.customTabId,
      canEdit:      msg.canEdit
    };
    if (msg.APIServerIsReady) initApp();
  }
  if (msg.event === 'apiPodIsReady') initApp();
  if (msg.event === 'select')             onSelect(msg.data, msg.cursorPosition);
  if (msg.event === 'operationSearch')    onSearch(msg.query);
  if (msg.event === 'visualFilterToggle') onFilterToggle(msg.data);
});
```

---

## Authentication

```javascript
// JWT — for integrations (token from loaded event)
headers: { 'Authorization': 'Bearer JWT_TOKEN', 'Content-Type': 'application/json' }

// API Token — for server-to-server (do NOT set Authorization when using this)
headers: { 'token': 'API_TOKEN', 'Content-Type': 'application/json' }
```

Use `-` as `projectId` in all API paths: `/API/v1.10/-/subProject/{subProjectId}/...`

---

## Events (FieldTwin → Integration)

| Event | Key Data |
|---|---|
| `loaded` | `token`, `backendUrl`, `subProject` (= subProjectId), `customTabId`, `canEdit`, `APIServerIsReady` |
| `select` | `data[{type, id, name}]`, `cursorPosition{x,y,z}` — type: stagedAsset \| well \| connection \| shape \| overlay |
| `operationSearch` | `query` |
| `visualFilterToggle` | `{id, state, subFilterId?}` |
| `apiPodIsReady` | — (API ready; use as fallback when APIServerIsReady is false) |

---

## Messages (Integration → FieldTwin)

```javascript
// Notification
window.parent.postMessage({ event: 'toast', data: { type: 'success', message: 'Done!' } }, '*');
// type: 'success' | 'info' | 'warning' | 'error'

// Create resource
window.parent.postMessage({
  event: 'createResources',
  data: [{
    resourceType: 'stagedAsset',
    volatile: false, draggable: true,
    attributes: {
      name: 'My Asset',
      initialState: { x: 665000, y: 400000, z: 0, rotation: 0 },
      status: 'Planned',   // 'Planned' | 'Installed' | 'Removed'
      tags: ['type::valve'],
      stagedAssetSymbolId: 'SYMBOL_ID'
    }
  }]
}, '*');

// Update resource
window.parent.postMessage({ event: 'updateResources', data: [{ resourceType: 'stagedAsset', resourceId: 'UUID', attributes: { status: 'Installed' } }] }, '*');

// Delete resource
window.parent.postMessage({ event: 'deleteResources', data: [{ resourceType: 'stagedAsset', resourceId: 'UUID' }] }, '*');

// Camera
window.parent.postMessage({ event: 'zoomOn', data: { resourceIds: ['UUID'], resourceTypes: ['stagedAsset'] } }, '*');
window.parent.postMessage({ event: 'zoomAt', data: { x: 665000, y: 400000, z: 0 } }, '*');

// Search results
window.parent.postMessage({ event: 'operationSearchResults', data: { results: [{ category: 'Results', id: 'r1', html: '<b>Item</b>', action: 'select', args: {} }] } }, '*');

// Visual filters
window.parent.postMessage({ event: 'visualFilteringUpdate', data: { filters: [{ id: 'status::active', label: 'Active', state: false }] } }, '*');

// Select by tag
window.parent.postMessage({ event: 'selectByTag', tags: ['status::active'] }, '*');

// Clear selection
window.parent.postMessage({ event: 'clearSelection' }, '*');

// 3D labels
window.parent.postMessage({ event: 'updateTagsAnnotation', data: { annotations: [{ pattern: 'status::alert', color: '#ff0000', text: 'Alert', icon: 'warning' }] } }, '*');
```

---

## REST API

```javascript
const BASE = `/API/v1.10/-/subProject/${session.subProjectId}`;
const H = { 'Authorization': `Bearer ${session.token}`, 'Content-Type': 'application/json' };

// Read
const assets      = await fetch(`${session.backendUrl}${BASE}/stagedAssets`, { headers: H }).then(r => r.json());
const wells       = await fetch(`${session.backendUrl}${BASE}/wells`, { headers: H }).then(r => r.json());
const connections = await fetch(`${session.backendUrl}${BASE}/connections`, { headers: H }).then(r => r.json());
const shapes      = await fetch(`${session.backendUrl}${BASE}/shapes`, { headers: H }).then(r => r.json());
const overlays    = await fetch(`${session.backendUrl}${BASE}/overlays`, { headers: H }).then(r => r.json());
const frames      = await fetch(`${session.backendUrl}${BASE}/frames`, { headers: H }).then(r => r.json());
const annotations = await fetch(`${session.backendUrl}${BASE}/annotations`, { headers: H }).then(r => r.json());
const metaDefs    = await fetch(`${session.backendUrl}/API/v1.10/-/metaDataDefinitions`, { headers: H }).then(r => r.json());
const meta        = await fetch(`${session.backendUrl}${BASE}/${resourceId}/metaData`, { headers: H }).then(r => r.json());

// Write
await fetch(`${session.backendUrl}${BASE}/stagedAssets`, { method: 'POST', headers: H, body: JSON.stringify({ name: 'New Asset', initialState: { x: 0, y: 0, z: 0, rotation: 0 } }) });
await fetch(`${session.backendUrl}${BASE}/stagedAsset/${id}`, { method: 'PATCH', headers: H, body: JSON.stringify({ status: 'Installed' }) });
await fetch(`${session.backendUrl}${BASE}/stagedAsset/${id}`, { method: 'DELETE', headers: H });

// Batch
await fetch(`${session.backendUrl}${BASE}/connections/batch`, { method: 'POST', headers: H, body: JSON.stringify([{ name: 'P1', fromCoordinate: { x: 0, y: 0, z: 0 }, toCoordinate: { x: 1, y: 1, z: 0 } }]) });
```

Full API: `api-reference.json` | Docs: https://api.fieldtwin.com

---

## Resource Types

| Type | Key Attributes |
|---|---|
| `stagedAsset` | `name`, `initialState{x,y,z,rotation}`, `status` (Planned/Installed/Removed), `tags[]`, `stagedAssetSymbolId` |
| `well` | `name`, `x`, `y`, `radius`, `color` (hex), `kind` (type ID) |
| `connection` | `name`, `fromCoordinate`, `toCoordinate`, `intermediaryPoints[]`, `params{width}` |
| `shape` | `name`, `x,y,z`, `shapeType` (Sphere/Box/Line/Polygon/Cylinder), `color`, `linePoints[]` |
| `overlay` | `name`, `x,y,z`, `text`, `width`, `height` |
| `frame` | REST API only |
| `annotation` | REST API only |

---

## Troubleshooting

| Problem | Fix |
|---|---|
| No `loaded` event | Serve via HTTP/HTTPS (not `file://`); if using localhost, complete the Chrome insecure content setup |
| Integration panel is blank | Chrome is blocking the HTTP iFrame — do the Chrome insecure content setup (see above) |
| API 401 | Token expired or missing `Bearer ` prefix |
| API 404 | No trailing slash on `backendUrl`; use `-` as projectId; `subProjectId` comes from `msg.subProject` |
| Messages ignored | Use `window.parent.postMessage` — only works inside FieldTwin iFrame |
| `APIServerIsReady` false | Also listen for `apiPodIsReady` event |
