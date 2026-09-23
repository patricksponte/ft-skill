# Integration-to-host event reference

Use this reference when an integration sends a message to the FieldTwin host. It
lists the released host-handled events, exact payload location, direct reply when
one exists, and the resource-type vocabulary that each field expects. The
deployed environment's released documentation still wins when it differs.

For host-to-integration events such as `loaded`, `tokenRefresh`, `select`, and
query replies, read [message-catalog.md](message-catalog.md). For Operation Mode
result, filter, menu, panel, and time-series shapes, also read
[operation-mode.md](operation-mode.md).

## Transport in an iframe and a pop-out

`postMessage` supports both integration layouts, but `window.parent` does not identify FieldTwin
in both of them:

| Integration layout | FieldTwin host window |
| --- | --- |
| Embedded iframe, where `window.parent !== window` | `window.parent` |
| Popped-out top-level window, where `window.parent === window` | `window.opener` |

Do not implement `sendToHost` as `window.parent.postMessage(...)`. That sends to FieldTwin only
while embedded and posts back to the integration itself after pop-out. During the trusted `loaded`
bootstrap, require `event.source` to match the expected parent or opener and `event.origin` to match
an exact allowed FieldTwin origin. Pin both values and make every sample on this page send through
that bridge-owned pair:

```javascript
let hostWindow = null
let hostOrigin = null

function expectedHostWindow() {
  if (window.parent !== window) {
    return window.parent
  }

  return window.opener && !window.opener.closed ? window.opener : null
}

function acceptLoaded(event, allowedOrigins) {
  const expectedWindow = expectedHostWindow()
  if (
    event.data?.event !== 'loaded' ||
    !expectedWindow ||
    event.source !== expectedWindow ||
    !allowedOrigins.has(event.origin)
  ) {
    return false
  }

  hostWindow = expectedWindow
  hostOrigin = event.origin
  return true
}

function sendToHost(message, transfer = []) {
  if (!hostWindow || hostWindow.closed || !hostOrigin) {
    throw new Error('FieldTwin bridge is not ready')
  }

  hostWindow.postMessage(message, hostOrigin, transfer)
}
```

Use the complete implementation in [bridge-and-api.md](bridge-and-api.md), which also validates
payloads, handles token refresh, captures early bootstrap, and tears down state. A pop-out without
a live opener cannot authenticate its host; keep it disconnected and show a recovery path instead
of guessing a target.

## Rules that apply to every request

- Send a structured-cloneable plain object with a top-level `event` string.
- Put fields under `data` unless the table explicitly says the request is
  event-only or names a top-level field.
- Send through the pinned host window and exact trusted origin. Never use `*`.
- The host identifies the sending integration from the source window. Do not add
  `customTabId` or `integrationId` unless that event's released contract asks for
  it.
- Use only a documented correlation field. Resource-query replies echo `queryId`
  under `data`; time-series replies use `reqId`.
- Use the exact resource vocabulary for the field. Similar-looking singular and
  plural values are not interchangeable contract documentation.

## Resource-type vocabularies

FieldTwin exposes a singular object-type vocabulary and a plural collection-name
vocabulary. Choose by field name, not by intuition:

- `type` in `select`, `zoomOn`, selection notifications, and action arguments is
  singular.
- `resourceType` and entries in `resourceTypes` are canonical plural collection
  names with exact casing.
- `getResources.data.items[].type` is a compatibility alias for
  `items[].resourceType`. Prefer `resourceType` and do not send both.
- Some hosts normalize singular aliases for compatibility. Do not generate those
  aliases in `resourceType` or `resourceTypes`; another release or consumer may
  require the canonical collection name.

| Resource | Singular `type` | Canonical `resourceType` / `resourceTypes` |
| --- | --- | --- |
| Account | not selectable | `accounts` |
| Project | not selectable | `projects` |
| Subproject | not selectable | `subProjects` |
| Staged asset | `stagedAsset` | `stagedAssets` |
| Connection | `connection` | `connections` |
| Connection segment | `connectionSegment` | `connectionSegments` |
| Well | `well` | `wells` |
| Well bore | `wellBore` | `wellBores` |
| Well-bore segment | `wellBoreSegment` | `wellBoreSegments` |
| Layer | `layer` | `layers` |
| Overlay | `overlay` | `overlays` |
| Shape | `shape` | `shapes` |
| Metadata value | `metaDatumValue` | `metaDatumValues` |
| Tag | `tag` | `tags` |
| Document | not normally selectable | `documents` |
| Document revision | not normally selectable | `documentRevisions` |
| Bookmark | not normally selectable | `bookmarks` |
| Custom cost | not normally selectable | `customCosts` |

Other collections are release- and manifest-dependent. Use a value outside this
table only when the target deployment's integration or API documentation names
that exact collection. In particular, write `subProjects`, never `subProject`,
when the field is named `resourceType` or `resourceTypes`.

A live host `select` notification can provide both forms on each selected item:
singular `data[].type` for selection/navigation and plural `data[].resourceType`
for collection queries. Preserve the plural field when passing that item to
`getResources`; do not copy the singular `type` value into `resourceType`.

## Selection and camera events

| Event | Request payload | Direct reply or effect |
| --- | --- | --- |
| `select` | `data.items[]` with singular `type` and `id`; optional `partIndex` or `selectedPartIndices` for staged-asset parts; optional `data.focusSelection` and `data.senderId` | Selection changes. The later host `select` notification can echo top-level `senderId` and `customTabId`. |
| `selectByTag` | `data.tags[]`; optional plural `data.resourceTypes[]`, `data.matchAll`, `data.focusSelection`, and `data.senderId` | Selection changes and is reported through `select` or `unselect`. Set `matchAll` explicitly: `true` requires every tag and `false` accepts any tag. Do not rely on an omitted-field default across releases. |
| `clearSelection` | Event-only | Clears the host selection; no direct response body. |
| `zoomOn` | `data.type` (singular), `data.id`, optional positive `data.distance` | Focuses one resource; no direct response body. |
| `zoomAt` | Numeric `data.x`, `data.y`, and optional `data.z` height offset | Focuses a project-space point; no direct response body. |

Selection focuses by default. Set `focusSelection: false` for an ordinary click
that should not move the camera. Use `zoomOn` for a separate explicit focus
interaction.

```javascript
sendToHost({
  event: 'select',
  data: {
    items: [{ type: 'stagedAsset', id: 'asset-fictional-001' }],
    focusSelection: false,
    senderId: 'select-fictional-001'
  }
})
```

## Resource query events

| Event | Request payload | Reply |
| --- | --- | --- |
| `getResources` | `data.items[]`, `data.queryId` | `resources.data.resources[]`, echoed `resources.data.queryId` |
| `getVisibleResources` | Optional `data.queryId` | `visibleResources.data.resources[]`, echoed `visibleResources.data.queryId` |
| `getResourcesByTags` | Non-empty `data.tags[]`; optional plural `data.resourceTypes[]` and `data.queryId` | `resourcesByTags.data.results`, `queryId`, and optional `error` |
| `getResourceAttributesBulk` | `data.attributes[]`; optional plural `data.resourceTypes[]` and `data.queryId` | `resourceAttributesBulk.data.results`, echoed `queryId` |
| `getProjectData` | Event-only | `projectData.data` |
| `getCostQuery` | Optional `data.queryId` and `data.removeEmptyItem` | `costQuery.data.query`, echoed `costQuery.data.queryId` |
| `getViewBox` | Event-only | `viewBox.data.viewBox` |
| `computeCostUsingServer` | Event-only | Starts the configured server computation; no correlated direct result. |

### `getResources` exact contract

Each `data.items` entry contains:

| Field | Required | Contract |
| --- | --- | --- |
| `id` | Yes | Short resource ID or a supported fully qualified root-resource ID. |
| `resourceType` | Yes unless `type` is used | Canonical plural collection name, for example `stagedAssets` or `subProjects`. |
| `type` | Alias | Compatibility alias for `resourceType`. Prefer `resourceType`; never send conflicting fields. |

The reply preserves the request order among resources that resolve. Unknown IDs
and unknown collections are omitted; the reply does not insert `null` or a
per-item error. Returned resources contain their released attributes plus host
query decorations such as `metaData`, `tags`, and applicable length or connection
type values.

Account, project, and subproject IDs may be fully qualified as
`resourceId:streamId`. When a root resource is in its main stream,
`streamId === resourceId`; the host can resolve the short-ID resource even when
the request sends `resourceId:resourceId`. A different stream ID resolves only an
exact qualified resource and must not fall back to the short ID.

```javascript
sendToHost({
  event: 'getResources',
  data: {
    items: [
      {
        resourceType: 'accounts',
        id: 'account-fictional-001:account-fictional-001'
      },
      {
        resourceType: 'projects',
        id: 'project-fictional-001:project-fictional-001'
      },
      {
        resourceType: 'subProjects',
        id: 'subproject-fictional-001:subproject-fictional-001'
      },
      {
        resourceType: 'stagedAssets',
        id: 'asset-fictional-001'
      }
    ],
    queryId: 'resources-fictional-001'
  }
})
```

Match only the corresponding reply:

```javascript
function isRequestedResourcesReply(message) {
  return (
    message.event === 'resources' &&
    message.data?.queryId === 'resources-fictional-001' &&
    Array.isArray(message.data.resources)
  )
}
```

## Resource mutation events

Singular mutation events put one object under `data`; plural events put an array
under `data`.

| Event | Per-resource fields | Completion signal |
| --- | --- | --- |
| `createResource` / `createResources` | Canonical plural `resourceType`, `attributes`; optional `volatile`, `draggable`, `projectTreeViewCustomPath` | Host lifecycle `didCreate` event for each created resource. |
| `updateResource` / `updateResources` | Canonical plural `resourceType`, `resourceId`, `attributes`; optional `projectTreeViewCustomPath` | Host lifecycle `didUpdate` event for each updated resource. |
| `deleteResource` / `deleteResources` | Canonical plural `resourceType`, `resourceId` | Host lifecycle `didDelete` event for each deleted resource. |

The current released allowlist for persisted creates and for updates/deletes is
`bookmarks`, `connections`, `connectionSegments`, `customCosts`, `documents`,
`documentRevisions`, `layers`, `metaDatumValues`, `overlays`, `shapes`,
`stagedAssets`, `wells`, `wellBores`, and `wellBoreSegments`. Volatile creation is
local to the client but still needs a manifest-defined resource type. Permissions,
locks, time travel, linked-version ownership, and the target release can further
restrict a mutation. `canEdit` is UI guidance; the host remains the authorization
boundary.

Create attributes must not include project ownership as a client authority; the
host scopes created design resources to the active subproject. Updates ignore
system identity and ownership attributes. Use the FieldTwin API when the public
API contract is a better fit than UI-mediated mutations.

## Information, annotation, export, settings, and UI events

| Event | Request payload | Direct reply or effect |
| --- | --- | --- |
| `replyInfo` | `data.items[]` with singular `type`, `id`, finite `documentCount`; optional `data.tags[]` and top-level `integrationId` | Updates integration document counts and transient tags; no direct reply. Use a stable `integrationId` so counts from separate integrations do not overwrite each other. |
| `updateTagsAnnotation` | `data.annotations`; optional `data.groupByTag`, `data.byResourceId`, `data.types` lookup map with canonical plural values, and `data.queryId` | `tagsAnnotationUpdated.data` with `success`, `queryId`, `annotatedTags`, and optional `error` or `superseded`. |
| `clearTagsAnnotation` | Optional `data.tags[]` and `data.queryId` | `tagsAnnotationCleared.data` with `success`, `queryId`, and `clearedTags`. |
| `exportToGLTF` | `data` export options; optional `queryId` | A `Blob`; handle it separately from JSON replies. |
| `exportToGeoJSON` | `data.queryId` plus documented filter/export options | `exportToGeoJSON.data.GeoJSON` and echoed `queryId` when a query ID is supplied. |
| `getUserSettings` | Event-only | `userSettings.data.settings`. No query correlation field. |
| `setUserSettings` | `data.settings` object | Merged `userSettings.data.settings`. Serialize competing writes. |
| `toast` | `data.message`; optional `data.type` of `info`, `success`, `warning`, or `error` | Displays a notification; no direct reply. |
| `displayDocument` | `data.url`; optional `data.mimeType`, `data.fileType`, display-only `data.fileName` tab-label override, and target `data.tabId` | Top-level `displayDocument` result with `success` and `error`. |
| `createChart` | `data.labels[]`, `data.datasets[]`; optional chart title, type, axes, position, size, and `id` | Top-level `createChart` result with `success`, `chartId`, and `updated` or `error`. |
| `deleteChart` | `data.id` | Top-level `deleteChart` result with `success`, `chartId`, or `error`. |
| `updateTagStyles` | `data.tagStyles` with a required `category` on every rule; optional `data.requestId` | Top-level `updateTagStyles` result with `success`, `requestId`, `ignored`, or `error`. |

Every `updateTagStyles` rule must declare `category`, a short human-readable name such as
`Valve status` or `Inspection`. The category is the unit the user enables or disables from the
Operation toolbar's *Integration tag styles* menu, so a rule the host cannot attribute to a
category cannot be controlled and is dropped: a missing, non-string, blank, or over-64-character
`category` removes that rule while the rest of the message still applies. The reply's `ignored`
count reports how many rules were dropped, which is the fastest way to notice a missing category
during development. Group rules by meaning, not one category per rule; at most 64 distinct
categories are listed per session, and the user's choice persists per category name. Disabling a
category re-filters the contribution the host already holds, so an integration does not resend
anything, and `category` never replaces `requestId` as the delivery scope.

For `updateTagsAnnotation` in resource-ID mode, `data.annotations` is keyed by
resource ID and `data.types` maps each same ID to its canonical plural collection
name. In tag mode, `data.annotations` is keyed by tag. Do not mix the two modes.

## Operation Mode and time-series events

The host also handles these integration-to-host events:

| Event | Exact request payload |
| --- | --- |
| `operationSearchResults` | `data.results[]` |
| `operationSearchProgress` | `data.status`; optional `data.name`, `data.progress`, and `data.isComplete` |
| `visualFilteringUpdate` | `data.filters[]` with filter IDs, labels, states, and optional `subFilters[]` |
| `visualLegendUpdate` | Optional `data.title`, `data.position`, `data.items[]`, and `data.visible`; `visible: false` or an empty item list clears the legend |
| `contextMenuUpdate` | `data.entries[]` with stable IDs, labels, actions, optional Font Awesome icons, arguments, and nested `subItems[]` |
| `openOperationPanel` | Optional `data.integrationId` and dynamic-page `data.path` |
| `timeSeriesInfo` | `data.series[]` and optional `data.replaceExisting` |
| `timeSeriesData` | `data.reqId` and transferable `data.buffer` |
| `displayTimeSeries` | Event-only |

Their nested result/action/filter/marker shapes and instance-targeting rules are
substantial. Read [operation-mode.md](operation-mode.md) rather than inferring
their fields from the names. Keep the integration identity supplied by trusted
bootstrap state where that released envelope requires it, and test two instances
to catch cross-routing mistakes.

## Contract tests

For each event an integration uses, assert:

1. the exact event name and top-level-versus-`data` placement;
2. singular `type` versus canonical plural `resourceType` values;
3. the documented reply event and correlation field;
4. malformed items, unknown resources, and unsupported resource types;
5. exact trusted origin and source-window rejection;
6. two simultaneous requests and two integration instances;
7. timeout, late-reply, and teardown behavior.

For `getResources`, include `subProjects` as a positive collection value and
`subProject` as a negative generated value. Also test `id:id`, `id:other-stream`,
an exact qualified branch resource, a missing ID, and overlapping `queryId`
requests.
