# FieldTwin Quick Reference

> Compact reference for models with small context windows. Full guide: `fieldtwin-instructions.md`.
> Route list: `api-reference.json`. All IDs and domains below are fictional.

## Rules

1. Accept `loaded` only from an **exact allowlisted origin** and the expected host window
   (`window.parent` in an iframe, `window.opener` in a pop-out). Then pin both.
2. Send only to the pinned window and origin. **Never use `'*'`.**
3. JWT in memory only; replace it on `tokenRefresh`.
4. Register the listener in the first `<script>` in `<head>`.
5. `resourceType(s)` values are plural (`stagedAssets`); `type` values are singular (`stagedAsset`).

## Minimal bridge

```javascript
const ALLOWED = new Set(['https://fieldtwin.example'])   // the user's exact FieldTwin origin
let host = null, hostOrigin = null, session = null

function expectedHost() {
  return window.parent !== window ? window.parent : (window.opener && !window.opener.closed ? window.opener : null)
}

window.addEventListener('message', (event) => {
  const msg = event.data
  if (!msg || typeof msg.event !== 'string') return
  if (!host) {
    if (msg.event !== 'loaded' || event.source !== expectedHost() || !ALLOWED.has(event.origin)) return
    host = event.source; hostOrigin = event.origin
  } else if (event.source !== host || event.origin !== hostOrigin) return

  if (msg.event === 'loaded') {
    if (typeof msg.token !== 'string' || !/^https:\/\//.test(msg.backendUrl || '')) return
    session = { token: msg.token, backendUrl: msg.backendUrl.replace(/\/$/, ''), apiVersion: msg.APIVersion,
                project: msg.project, subProject: msg.subProject, canEdit: msg.canEdit === true,
                apiReady: msg.APIServerIsReady === true }
    if (session.apiReady) init()
  } else if (msg.event === 'tokenRefresh' && msg.token) session.token = msg.token
  else if (msg.event === 'apiPodIsReady') { session.apiReady = true; init() }
  else onFieldTwinEvent(msg)
})

function send(message) { host.postMessage(message, hostOrigin) }

function api(path, init = {}) {   // path relative to /API/{version}/
  const headers = { ...init.headers, Authorization: `Bearer ${session.token}` }
  return fetch(`${session.backendUrl}/API/${session.apiVersion}/${path}`, { ...init, headers, redirect: 'error' })
}

// loaded.subProject is already qualified as subProjectId:streamId. Do not split it.
const sub = (suffix) =>
  `${encodeURIComponent(session.project)}/subProject/${encodeURIComponent(session.subProject)}${suffix}`
```

## Host → integration

| Event | Fields |
| --- | --- |
| `loaded` | top level: `token`, `backendUrl`, `APIVersion`, `project`, `subProject` (qualified), `stream`, `customTabId`, `canEdit`, `APIServerIsReady` |
| `tokenRefresh` | top level: `token` |
| `apiPodIsReady` / `apiPodIsNotReady` | top level |
| `select` | `data` = array of `{ type, resourceType, id, name }`; `cursorPosition` |
| `unselect` | none |
| `operationSearch` | top level: `query`, `clear` |
| `visualFilterToggle` | `data.id`, `data.state`, `data.subFilterId?` |
| `operationSearchAction` / `operationSearchDoubleClick` | top level: `resultId`, `action`, `args` |
| replies | `projectData` (`data`), `resources`, `visibleResources` (`data.resources`, `data.queryId`), `resourcesByTags` (`data.results`, `data.queryId`) |

## Integration → host (send with `send(...)`)

| Event | Payload |
| --- | --- |
| `toast` | `data: { type: 'info'\|'success'\|'warning'\|'error', message }` |
| `select` | `data: { items: [{ type, id }], focusSelection: false }` |
| `selectByTag` | `data: { tags: [...], matchAll, resourceTypes?, focusSelection? }` |
| `clearSelection` | event only |
| `zoomOn` | `data: { type, id, distance? }` |
| `zoomAt` | `data: { x, y, z? }` |
| `getProjectData` | event only → `projectData` |
| `getResources` | `data: { items: [{ resourceType, id }], queryId }` → `resources` |
| `getVisibleResources` | `data: { queryId }` → `visibleResources` |
| `getResourcesByTags` | `data: { tags, resourceTypes?, queryId }` → `resourcesByTags` |
| `createResources` | `data: [{ resourceType, attributes, volatile?, draggable?, projectTreeViewCustomPath? }]` |
| `updateResources` | `data: [{ resourceType, resourceId, attributes }]` |
| `deleteResources` | `data: [{ resourceType, resourceId }]` |
| `updateTagsAnnotation` | `data: { annotations: { '<tag>': [{ text, color?, icon? }] } }` |
| `clearTagsAnnotation` | `data: { tags? }` |
| `displayDocument` | `data: { url, mimeType?, fileName? }` |
| `operationSearchResults` | `data: { results: [{ id, category, html, action, args, actions?, subItems? }] }` |
| `operationSearchProgress` | `data: { status, progress?, isComplete }` |
| `visualFilteringUpdate` | `data: { filters: [{ id, label, state, subFilters? }] }` |

## REST API v1.10

Paths are relative to `{backendUrl}/API/v1.10/`.

| Scope | Path |
| --- | --- |
| Subproject root | `{projectId}/subProject/{subProjectId}:{streamId}/` — projectId is `loaded.project`; no `-` wildcard |
| Account routes | `assets`, `metadatadefinitions`, `tags`, `users`, `wellTypes`, `connectionTypes` |

| Resource | List | One | Create | Update / delete |
| --- | --- | --- | --- | --- |
| stagedAssets | `/stagedAssets` | `/stagedAsset/{id}` | `POST /stagedAsset` | `/stagedAsset/{id}` |
| wells | `/wells` | `/well/{id}` | `POST /well` | `/well/{id}` |
| connections | `/connections` | `/connection/{id}` | `POST /connection` | `/connection/{id}` |
| shapes | `/shapes` | `/shape/{id}` | `POST /shape` | `/shape/{id}` |
| overlays | `/overlays` | `/overlay/{id}` | `POST /overlay` | `PATCH /overlay/{id}`; delete via `DELETE /batch` |
| layers | `/layers` | `/layer/{id}` | `POST /layer` | `/layer/{id}` |
| customCosts | `/customCost/` | `/customCost/{id}` | `POST /customCost/` | `/customCost/{id}` |
| annotations | `/annotations` | `/annotations/{id}` | `POST /annotations` | `/annotations/{id}` |

- Per-type batch: `POST /{stagedAssets|wells|shapes|overlays|customCosts}/batch` with `{ items, globals? }` → `{ ids }`.
- Multi-type: `POST|PATCH|DELETE /batch` with type-keyed bodies. PATCH/DELETE succeed with an empty body.
- Staged asset visual: `asset` (definition ID from `GET assets`). `status` is `warning|danger|primary|success|null`.
- Metadata: no `/metaData` route. Values are in each resource GET under `metaData`; write by PATCHing the resource with `metaData`.
- Collections may be maps keyed by ID: normalize with `Array.isArray(d) ? d : Object.values(d)`.
- Auth: browser `Authorization: Bearer <jwt>`; server scripts `token: <apiToken>`. Never both.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| No `loaded` | Serve over HTTP(S), not `file://`; listener in `<head>`; origin must exactly match the allowlist |
| API 401 | Token expired: wait for `tokenRefresh`; header is `Authorization: Bearer` |
| API 404 | Use `loaded.project` (not `-`) and the qualified `subProject` unchanged |
| API 503 | Wait for `apiPodIsReady` and back off |
| Messages ignored | Send via the pinned host (works in pop-outs); check `data` nesting and plural `resourceType` |
