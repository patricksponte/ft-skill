# FieldTwin Integration Skill

Use this skill when the user is building, debugging, or asking questions about a FieldTwin integration.

A FieldTwin integration is a web application (iFrame) embedded inside the FieldTwin digital twin platform. It communicates with FieldTwin using `window.postMessage`. The complete reference is in `fieldtwin-instructions.md`. The full API endpoint list is in `api-reference.json`.

## When to Use This Skill

- User mentions FieldTwin, digital twin, subsea assets, or offshore project integrations
- User is working with `window.postMessage` in a FieldTwin context
- User wants to react to asset selection, global search, or visual filters in FieldTwin
- User wants to create, update, or delete resources in a FieldTwin subproject
- User wants to call the FieldTwin REST API

---

## Onboarding Flow

If the user is new, always suggest running the Hello World first:

> "Before we build anything, let's confirm your integration is connected to FieldTwin. Try running the Hello World — it's a single HTML file with a built-in connection troubleshooter. You'll see a 'Connected!' message and a toast notification in FieldTwin."

The Hello World file is at: `examples/hello-world/index.html`

To host it: run `npx serve .` in the project folder, or use any static file server.

---

## Authentication

Two methods supported:

| Method | Header | Value | Use when |
|---|---|---|---|
| JWT | `Authorization` | `Bearer {token}` | Inside an iFrame integration (token from `loaded` event) |
| API Token | `token` | `{apiToken}` | Server-to-server / backend scripts |

**Never set both headers at the same time.**

> Use `-` as `projectId` in API paths — e.g. `/API/v1.10/project/-/subProject/{subProjectId}/stagedAssets`

---

## Session Data (from `loaded` event)

Always wait for `loaded` before doing anything:

```javascript
let session = {};

window.addEventListener('message', function(event) {
  const msg = event.data;
  if (!msg || !msg.event) return;

  if (msg.event === 'loaded') {
    session = {
      token:        msg.token,
      backendUrl:   msg.backendUrl,
      subProjectId: msg.subProject,   // Note: msg.subProject, not msg.subProjectId
      customTabId:  msg.customTabId,
      canEdit:      msg.canEdit
    };
    if (msg.APIServerIsReady) initApp();
  }
  if (msg.event === 'apiPodIsReady') initApp();
});
```

---

## Key Events (FieldTwin → Integration)

| Event | When | Key Data |
|---|---|---|
| `loaded` | Integration opens | token, backendUrl, subProject, customTabId, canEdit, APIServerIsReady |
| `select` | User clicks in 3D view | data[{type, id, name}], cursorPosition |
| `operationSearch` | User presses Enter in search | query |
| `visualFilterToggle` | User clicks a filter button | {id, state, subFilterId?} |
| `apiPodIsReady` | API becomes available (fallback) | — |

---

## Key Messages (Integration → FieldTwin)

All messages use: `window.parent.postMessage(payload, '*')`

| Message | Purpose |
|---|---|
| `toast` | Show a notification (success/info/warning/error) |
| `selectByTag` | Select resources matching tags |
| `operationSearchResults` | Return search results |
| `operationSearchProgress` | Update search progress indicator |
| `visualFilteringUpdate` | Register filter buttons |
| `createResources` | Create new resources |
| `updateResources` | Update existing resources |
| `deleteResources` | Remove resources |
| `zoomOn` / `zoomAt` | Move the camera |
| `updateTagsAnnotation` | Add 3D labels to tagged resources |
| `clearTagsAnnotation` | Remove all 3D labels |
| `clearSelection` | Clear the current selection |
| `displayDocument` | Open a document in the viewer |
| `getResourcesByTags` | Query resources by tag |
| `getVisibleResources` | Get resources visible in the viewport |
| `getProjectData` | Get full project data |

---

## REST API Helpers

```javascript
const BASE = `/API/v1.10/project/-/subProject/${session.subProjectId}`;
const HEADERS = { 'Authorization': `Bearer ${session.token}`, 'Content-Type': 'application/json' };

async function apiGet(path) {
  const res = await fetch(`${session.backendUrl}${path}`, { headers: HEADERS });
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return res.json();
}

async function apiPost(path, body) {
  const res = await fetch(`${session.backendUrl}${path}`, { method: 'POST', headers: HEADERS, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return res.json();
}

async function apiPatch(path, body) {
  const res = await fetch(`${session.backendUrl}${path}`, { method: 'PATCH', headers: HEADERS, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return res.json();
}

async function apiDelete(path) {
  const res = await fetch(`${session.backendUrl}${path}`, { method: 'DELETE', headers: HEADERS });
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return res.status === 204 ? null : res.json();
}

// Usage examples
const assets      = await apiGet(`${BASE}/stagedAssets`);
const wells       = await apiGet(`${BASE}/wells`);
const connections = await apiGet(`${BASE}/connections`);
const shapes      = await apiGet(`${BASE}/shapes`);
const overlays    = await apiGet(`${BASE}/overlays`);
const frames      = await apiGet(`${BASE}/frames`);
const annotations = await apiGet(`${BASE}/annotations`);
const metaDefs    = await apiGet(`/API/v1.10/project/-/metaDataDefinitions`);
const meta        = await apiGet(`${BASE}/${resourceId}/metaData`);

await apiPost(`${BASE}/stagedAssets`, { name: 'My Asset', initialState: { x: 665000, y: 400000, z: 0, rotation: 0 } });
await apiPatch(`${BASE}/stagedAsset/${id}`, { status: 'Installed' });
await apiDelete(`${BASE}/stagedAsset/${id}`);
```

---

## Resource Types Summary

| Type | Key Attributes |
|---|---|
| `stagedAsset` | `name`, `initialState: {x,y,z,rotation}`, `status` (Planned/Installed/Removed), `tags`, `stagedAssetSymbolId`, `vendorAttributes` |
| `well` | `name`, `x`, `y`, `radius`, `color` (hex), `kind` (type ID), `tags` |
| `connection` | `name`, `fromCoordinate`, `toCoordinate`, `intermediaryPoints`, `params: {width}`, `status` |
| `shape` | `name`, `x,y,z`, `shapeType` (Sphere/Box/Line/Polygon/Cylinder), `color`, `linePoints` |
| `overlay` | `name`, `x,y,z`, `text`, `width`, `height` |
| `frame` | Managed via REST API only |
| `annotation` | Managed via REST API only |

---

## Quick Troubleshooting

| Problem | Check |
|---|---|
| No `loaded` event | Page must be served via HTTP/HTTPS — not `file://` |
| API 401 | Token expired or missing `Bearer ` prefix |
| API 404 | No trailing slash on `backendUrl`; use `-` as projectId; check `subProjectId` |
| Messages not working | Use `window.parent.postMessage` — only works inside FieldTwin iFrame |
| `APIServerIsReady` false | Also listen for `apiPodIsReady` event |
| `customTabId` undefined | Wait for `loaded` event |

---

## Full Reference

- Complete documentation: `fieldtwin-instructions.md`
- All API endpoints: `api-reference.json`
- Compact quick reference: `api-quick-reference.md`
- API docs: https://api.fieldtwin.com
