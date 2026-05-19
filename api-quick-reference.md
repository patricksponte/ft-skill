# FieldTwin API Quick Reference

> Compact reference for AI models with limited context windows.
> Full documentation: `fieldtwin-instructions.md` | All endpoints: `api-reference.json`

---

## Setup

```javascript
let session = {};
window.addEventListener('message', function(event) {
  const msg = event.data;
  if (!msg || !msg.event) return;
  if (msg.event === 'loaded') {
    session = { token: msg.token, backendUrl: msg.backendUrl, subProjectId: msg.subProject, customTabId: msg.customTabId, canEdit: msg.canEdit };
    if (msg.APIServerIsReady) init();
  }
  if (msg.event === 'apiPodIsReady') init();
});
```

**Always use** `window.parent.postMessage(payload, '*')` to send messages.

**API base path:** `{backendUrl}/API/v1.10/project/-/subProject/{subProjectId}/`

**Auth header:** `Authorization: Bearer {token}` — or `token: {apiToken}` for server-to-server.

---

## Events: FieldTwin → Integration

| Event | Key fields |
|---|---|
| `loaded` | `token`, `backendUrl`, `subProject` (= subProjectId), `customTabId`, `canEdit`, `APIServerIsReady` |
| `select` | `data[{type, id, name}]`, `cursorPosition{x,y,z}` |
| `operationSearch` | `query` |
| `visualFilterToggle` | `data{id, state, subFilterId?}` |
| `apiPodIsReady` | — (API is now ready, use as fallback) |

---

## Messages: Integration → FieldTwin

| Message | Payload |
|---|---|
| `toast` | `{type: 'success'\|'info'\|'warning'\|'error', message: '...'}` |
| `selectByTag` | `{tags: ['key::value']}` |
| `operationSearchResults` | `{results: [{category, id, html, action, args, subItems?}]}` |
| `operationSearchProgress` | `{status, progress?, isComplete}` |
| `visualFilteringUpdate` | `{filters: [{id, label, state, subFilters?}]}` |
| `createResources` | `[{resourceType, volatile, draggable, attributes, projectTreeViewCustomPath?}]` |
| `updateResources` | `[{resourceType, resourceId, attributes}]` |
| `deleteResources` | `[{resourceType, resourceId}]` |
| `zoomOn` | `{resourceIds: [], resourceTypes: []}` |
| `zoomAt` | `{x, y, z}` |
| `updateTagsAnnotation` | `{annotations: [{pattern, color, text, icon?}]}` |
| `clearTagsAnnotation` | — |
| `clearSelection` | — |
| `displayDocument` | `{id, revisionId}` |
| `getResourcesByTags` | `{tags, resourceTypes, queryId?}` |
| `getVisibleResources` | `{resourceTypes}` |
| `getProjectData` | — |

---

## REST API Endpoints (v1.10)

All paths below are relative to `{backendUrl}/API/v1.10/project/-/subProject/{subProjectId}/`

| Resource | GET list | GET one | POST | PATCH | DELETE |
|---|---|---|---|---|---|
| stagedAssets | `/stagedAssets` | `/stagedAsset/{id}` | `/stagedAssets` | `/stagedAsset/{id}` | `/stagedAsset/{id}` |
| wells | `/wells` | `/well/{id}` | `/wells` | `/well/{id}` | `/well/{id}` |
| connections | `/connections` | `/connection/{id}` | `/connection` | `/connection/{id}` | `/connection/{id}` |
| shapes | `/shapes` | `/shape/{id}` | `/shape` | `/shape/{id}` | `/shape/{id}` |
| overlays | `/overlays` | `/overlay/{id}` | `/overlay` | `/overlay/{id}` | `/overlay/{id}` |
| frames | `/frames` | `/frame/{id}` | `/frame` | `/frame/{id}` | `/frame/{id}` |
| annotations | `/annotations` | `/annotations/{id}` | `/annotations` | `/annotations/{id}` | `/annotations/{id}` |
| metaData | `/{resourceId}/metaData` | — | `/{resourceId}/metaData` | `/{resourceId}/metaData/{id}` | `/{resourceId}/metaData/{id}` |
| customCosts | `/customCost/` | `/customCost/{id}` | `/customCost/` | `/customCost/{id}` | `/customCost/{id}` |

**Project-level paths** (not subProject-scoped):

| Resource | Path |
|---|---|
| metaDataDefinitions | `{backendUrl}/API/v1.10/project/-/metaDataDefinitions` |
| subProjects | `{backendUrl}/API/v1.10/{projectId}/subProjects` |
| projects | `{backendUrl}/API/v1.10/` |

**Batch endpoints:**

| Resource | Path |
|---|---|
| connections batch | `POST /connections/batch` |
| customCosts batch | `POST /customCosts/batch` |

---

## Resource Attributes

```
stagedAsset  name*, initialState{x,y,z,rotation}*, status(Planned|Installed|Removed), tags[], stagedAssetSymbolId, visible, vendorAttributes
well         name*, x*, y*, radius, color(hex), kind(typeId), tags[]
connection   name*, fromCoordinate{x,y,z}, toCoordinate{x,y,z}, intermediaryPoints[], params{width}, status
shape        name*, x,y,z, shapeType(Sphere|Box|Line|Polygon|Cylinder), color(hex), linePoints[]
overlay      name*, x,y,z, text, width, height
```
*required

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| No `loaded` event | Serve page via HTTP/HTTPS (not `file://`); embed in FieldTwin as iFrame |
| API 401 | Token expired; use `Authorization: Bearer {token}` (space, not colon) |
| API 404 | No trailing slash on `backendUrl`; use `-` as projectId; check `subProjectId` (from `msg.subProject`) |
| Messages ignored | Use `window.parent.postMessage`; page must be inside FieldTwin iFrame |
| `APIServerIsReady` false | Listen for `apiPodIsReady` event before making API calls |
| `customTabId` undefined | Don't use it before the `loaded` event fires |
| CORS error | FieldTwin backend must allow the origin; check with FieldTwin admin |
