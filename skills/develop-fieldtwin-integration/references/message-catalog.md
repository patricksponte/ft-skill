# Message catalog

FieldTwin integrations exchange structured-cloneable objects with the host. Every
message has a top-level `event` string, but the rest of the contract intentionally
uses a mixture of top-level fields and a nested `data` object. Preserve each
envelope exactly; do not move fields merely to make different events look alike.

Resource fields use two distinct vocabularies. A selection/navigation field named
`type` uses a singular value such as `stagedAsset`; a collection field named
`resourceType` or `resourceTypes` uses the exact plural camel-case value such as
`stagedAssets` or `subProjects`. Read
[integration-to-host-events.md](integration-to-host-events.md) before generating a
resource request.

This is a practical catalog of the released integration contract, not a substitute
for the current [FieldTwin integration guide](https://docs.fieldtwin.com/). If a
deployed FieldTwin release documents a different shape, its released contract wins.
For an exhaustive, searchable list of every host-client event variant and effective
field, including transport-added reply fields, use
[postmessage-attributes.md](postmessage-attributes.md).

## Secure transport assumed by the samples

The examples call `sendToHost(message, transferables?)`. Use the pinned-window,
exact-origin implementation in [bridge-and-api.md](bridge-and-api.md): accept
bootstrap only from an allowlisted exact origin and the expected parent or opener,
then pin both `event.source` and `event.origin`. Never replace the exact target
origin with `*` when sending credentials, project data, or production messages.

## Envelope rules at a glance

| Direction | Event | Exact payload location |
| --- | --- | --- |
| Host → integration | `loaded` | bootstrap fields are top-level |
| Host → integration | `tokenRefresh` | refreshed token and context fields are top-level |
| Host → integration | `select` | selected items are the `data` array; correlation fields are top-level |
| Host → integration | `unselect` | no `data` payload is required |
| Host → integration | `projectData` | project snapshot is under `data` |
| Host → integration | `requestInfo` | requested items are under `data.items` |
| Host → integration | `viewBox` | bounds are under `data.viewBox` |
| Host → integration | `visibleResources` | resources and `queryId` are under `data` |
| Host → integration | `resources` | resources and `queryId` are under `data` |
| Host → integration | `resourcesByTags` | grouped results, `queryId`, and any error are under `data` |
| Integration → host | `select` | request fields are under `data` |
| Integration → host | `selectByTag` | request fields are under `data` |
| Integration → host | `getResources` | items and `queryId` are under `data` |
| Integration → host | `getVisibleResources` | `queryId` is under `data` |
| Integration → host | `getResourcesByTags` | tags, type filter, and `queryId` are under `data` |
| Integration → host | `zoomAt` / `zoomOn` | focus parameters are under `data` |
| Integration → host | `toast` | notification type and text are under `data` |
| Integration → host | `getProjectData` / `getViewBox` / `clearSelection` | event-only request |

Operation Mode adds several intentionally different envelopes. See
[operation-mode.md](operation-mode.md) for their full shapes. In particular,
`operationSearch`, `operationSearchAction`, `operationSearchDoubleClick`, and
`contextMenuAction` carry their fields at the top level, while search results,
progress, filter registration, context-menu registration, panel navigation, and
time-series payloads use `data`.

## Host → integration

### Bootstrap and token lifecycle

`loaded` is the initialization event for the live integration document. Important
fields are top-level:

```javascript
{
  event: 'loaded',
  token: '<short-lived-jwt>',
  backendUrl: 'https://fieldtwin-host.example',
  APIVersion: 'v1.10',
  project: 'project-fictional-001',
  subProject: 'subproject-fictional-001',
  stream: 'stream-fictional-main',
  customTabId: 'asset-inspector-fictional',
  canEdit: true,
  APIServerIsReady: true
}
```

Keep the JWT in instance memory. When `tokenRefresh` arrives, replace the in-memory
value atomically and build API request headers from the current value at request
time:

```javascript
{
  event: 'tokenRefresh',
  token: '<replacement-short-lived-jwt>',
  backendUrl: 'https://fieldtwin-host.example',
  project: 'project-fictional-001',
  subProject: 'subproject-fictional-001',
  isFrameActive: true
}
```

API readiness updates also use top-level fields:

```javascript
{
  event: 'apiPodIsReady',
  subProject: 'subproject-fictional-001',
  APIServerReady: true,
  APIVersion: 'v1.10'
}
```

The unavailable form is `apiPodIsNotReady` with `APIServerReady: false`.

### Selection notifications

The host's `select` notification uses `data` itself as the selected-item array; it
is not `{ data: { items: [...] } }`:

```javascript
{
  event: 'select',
  isFrameActive: true,
  data: [
    {
      type: 'stagedAsset',
      resourceType: 'stagedAssets',
      id: 'asset-fictional-001',
      name: 'Fictional Water Injection Valve'
    }
  ],
  cursorPosition: {
    x: 477348.43,
    y: 6664023.98,
    z: -107.04
  }
}
```

When the notification is the response to the integration's own `select` or
`selectByTag` request, the host can echo `senderId` and `customTabId` as top-level
fields. Treat them as correlation metadata; selections made directly in the host
UI do not carry them.

The host sends an event-only `unselect` notification when the selection becomes
empty, optionally with top-level `isFrameActive` and `cursorPosition`:

```javascript
{
  event: 'unselect',
  isFrameActive: true
}
```

### Query replies

`projectData`, `viewBox`, `visibleResources`, `resources`, and `resourcesByTags`
place their reply body under `data`.

```javascript
{
  event: 'viewBox',
  isFrameActive: true,
  data: {
    viewBox: {
      x1: 470000,
      y1: 6660000,
      x2: 485000,
      y2: 6675000
    }
  }
}
```

```javascript
{
  event: 'visibleResources',
  data: {
    resources: [
      {
        type: 'stagedAsset',
        id: 'asset-fictional-001',
        name: 'Fictional Water Injection Valve'
      }
    ],
    queryId: 'visible-fictional-001'
  }
}
```

```javascript
{
  event: 'resources',
  data: {
    resources: [
      {
        id: 'asset-fictional-001',
        name: 'Fictional Water Injection Valve',
        tags: ['VALVE-FICTIONAL-001']
      }
    ],
    queryId: 'resources-fictional-001'
  }
}
```

```javascript
{
  event: 'resourcesByTags',
  data: {
    results: {
      'VALVE-FICTIONAL-001': [
        {
          resourceType: 'stagedAssets',
          resourceId: 'asset-fictional-001'
        }
      ]
    },
    queryId: 'tags-fictional-001'
  }
}
```

If a tag query is invalid, `resourcesByTags.data.error` contains the error and
`data.results` is an empty object. Correlate with the echoed `data.queryId` instead
of reply order.

### Information and resource-change events

`requestInfo` asks an integration to provide supplemental information for up to
100 resources. Its requested items are under `data.items`:

```javascript
{
  event: 'requestInfo',
  isFrameActive: true,
  data: {
    items: [
      {
        type: 'stagedAssets',
        id: 'asset-fictional-001'
      }
    ]
  }
}
```

Resource lifecycle notifications use event names such as `didCreate`, `didUpdate`,
and `didDelete`. Their detailed resource shapes vary by resource type and release;
use the current FieldTwin integration and API documentation instead of inventing a
generic resource schema.

## Integration → host

### Selection without an implicit camera move

The integration's `select` command uses a `data` object with `items`. The documented
default is to focus, so explicitly send `focusSelection: false` for an ordinary
selection:

```javascript
sendToHost({
  event: 'select',
  data: {
    items: [
      {
        type: 'stagedAsset',
        id: 'asset-fictional-001'
      }
    ],
    focusSelection: false,
    senderId: 'select-fictional-001'
  }
})
```

Use an event-only request to clear selection:

```javascript
sendToHost({ event: 'clearSelection' })
```

`selectByTag` also nests its request under `data`:

```javascript
sendToHost({
  event: 'selectByTag',
  data: {
    tags: ['VALVE-FICTIONAL-001', 'READY'],
    matchAll: true,
    resourceTypes: ['stagedAssets'],
    focusSelection: false,
    senderId: 'select-tags-fictional-001'
  }
})
```

### Explicit camera focus

Camera movement is a separate command. Focus a resource with `zoomOn`:

```javascript
sendToHost({
  event: 'zoomOn',
  data: {
    type: 'stagedAsset',
    id: 'asset-fictional-001'
  }
})
```

Or focus a project-space point with `zoomAt`:

```javascript
sendToHost({
  event: 'zoomAt',
  data: {
    x: 477348.43,
    y: 6664023.98,
    z: 120
  }
})
```

Keeping `select` and `zoomOn` separate prevents a normal row click from unexpectedly
moving the camera.

### Query commands and correlation

Event-only queries:

```javascript
sendToHost({ event: 'getProjectData' })
sendToHost({ event: 'getViewBox' })
```

Resource queries use `data` and should include an opaque `queryId` when the reply
supports it:

```javascript
sendToHost({
  event: 'getResources',
  data: {
    items: [
      {
        resourceType: 'stagedAssets',
        id: 'asset-fictional-001'
      }
    ],
    queryId: 'resources-fictional-001'
  }
})

sendToHost({
  event: 'getVisibleResources',
  data: {
    queryId: 'visible-fictional-001'
  }
})

sendToHost({
  event: 'getResourcesByTags',
  data: {
    tags: ['VALVE-FICTIONAL-001'],
    resourceTypes: ['stagedAssets'],
    queryId: 'tags-fictional-001'
  }
})
```

Do not add a correlation field to an event unless the released host contract echoes
it.

### User-visible notification

`toast` uses a nested `data` object. Supported released types include `danger`,
`warning`, `info`, and `success`:

```javascript
sendToHost({
  event: 'toast',
  data: {
    type: 'success',
    message: 'Fictional valve status refreshed.'
  }
})
```

### Resource mutations

The resource mutation event names are:

- `createResource` and `createResources`
- `updateResource` and `updateResources`
- `deleteResource` and `deleteResources`

Their payload is under `data`; singular commands use an object and bulk commands use
an array. Resource attributes and permissions are versioned API contracts, so copy
their released shapes from the current FieldTwin integration documentation. Honor
`canEdit` in the UI, but always rely on host/API authorization for enforcement.

### Automation declarations

`automationDescriptor` declares the attributes and functions this integration
exposes to the FieldTwin automation graph. The host derives the integration
identity from the registered source window, validates every entry, and persists
the declaration so backend-triggered automation runs can use it after the iframe
is gone. Send it once after `loaded`, and again whenever the declaration changes -
the host only writes when the content differs.

```javascript
sendToHost({
  event: 'automationDescriptor',
  attributes: [
    {
      id: 'fictional.valveCount',
      label: 'Fictional valve count',
      type: 'number',
      readUrl: 'https://integration.example.com/automation/valve-count'
    }
  ],
  functions: [
    {
      id: 'fictional.generateReport',
      label: 'Generate fictional report',
      params: [{ id: 'from', type: 'date' }],
      returns: 'string',
      invokeUrl: 'https://integration.example.com/automation/generate-report'
    }
  ]
})
```

Contract rules the host enforces:

- `readUrl` and `invokeUrl` must be `https:` URLs; entries with other schemes are
  dropped.
- An entry **without** a URL is authoring-only: it can never be reached by a
  backend-triggered run, and automations that depend on it run only while a
  client is open. Declare a URL for anything an unattended automation needs.
- Attribute `type`, function `params[].type`, and function `returns` must come
  from the released value-type vocabulary below; entries declaring anything else
  are dropped.
- Entry counts and total descriptor size are capped; oversized declarations are
  rejected with `success: false`.

#### Automation value types

The complete released vocabulary. Declared types describe the JSON the endpoint
exchanges - the host does not coerce values:

| Type | JSON wire shape | Notes |
| --- | --- | --- |
| `string` | string | |
| `number` | finite number | JSON cannot carry `NaN` or `Infinity` |
| `boolean` | boolean | |
| `date` | ISO-8601 string | `'2026-08-14T09:30:00Z'`; prefer UTC |
| `tags` | array of strings | matches FieldTwin tag arrays |
| `resource` | `{ id, type }` | `type` is the plural collection name, for example `'wells'` or `'stagedAssets'` |
| `resources` | array of `{ id, type }` | |
| `object` | free-form JSON object | run history truncates stored output, keep it small |
| `any` | anything JSON-serializable | the default when a type is omitted |

Attribute reads must respond with the declared attribute type. Function invokes
receive `args` values shaped by the declared parameter types and must respond
with the declared `returns` shape. A function parameter may also declare
`optional: true`. Do not invent additional type names - undeclared-type entries
never reach the automation editor.

#### Multiple function outputs

`returns` is either a single type name (one anonymous output; respond with a bare
JSON value) or an array of named outputs (respond with an object keyed by output
id). Each named output becomes a separate wireable port in the automation editor,
so one invocation can feed several downstream nodes:

```javascript
{
  id: 'fictional.generateReport',
  label: 'Generate fictional report',
  params: [{ id: 'from', type: 'date' }],
  returns: [
    { id: 'reportUrl', type: 'string' },
    { id: 'pageCount', type: 'number' }
  ],
  invokeUrl: 'https://integration.example.com/automation/generate-report'
}
```

The endpoint for this declaration must respond:

```json
{ "reportUrl": "https://integration.example.com/reports/fictional.pdf", "pageCount": 12 }
```

Output ids must be unique within a function and each type must come from the
vocabulary above. Responding with a non-object when named outputs are declared
fails the automation run with an explicit error; a missing key yields `undefined`
downstream.

At run time the automation service POSTs to `readUrl`/`invokeUrl` with a
short-lived FieldTwin JWT in `Authorization: Bearer` scoped to the automation's
account. Verify that JWT the same way as any other FieldTwin token before acting.
The body carries `{ attributeId }` or `{ functionId, args }` plus
`resource: { id, type }` when the run targets a resource.

### Attribute update signals

Two channels, different purposes - use both:

- `attributeUpdated` (postMessage) refreshes the cached value in **open clients**
  only. It never starts an automation run.
- `POST <backendUrl>/automation/event` (webhook, integration JWT in
  `Authorization`) is what fires attribute-triggered automations, and works with
  no client open. Body:
  `{ customTabId, attributeId, scope: { accountId, projectId, subProjectId }, value }`.
  The scope account must match the account the JWT was issued for.

```javascript
sendToHost({
  event: 'attributeUpdated',
  data: {
    resourceType: 'stagedAssets',
    resourceId: 'fictional-asset-001',
    attributeId: 'fictional.valveCount',
    value: 42
  }
})
```

Do not fire the webhook from browser code once per open tab - send it from the
integration backend when the underlying value actually changes.

## Receiver pattern

The bridge must validate and pin the source window and origin before this dispatcher
runs:

```javascript
function handleTrustedHostMessage(message) {
  switch (message.event) {
    case 'loaded': {
      initializeFromLoaded(message)
      break
    }
    case 'tokenRefresh': {
      replaceToken(message.token)
      break
    }
    case 'select': {
      renderSelection(message.data)
      break
    }
    case 'unselect': {
      renderSelection([])
      break
    }
    case 'resources': {
      resolveResourceQuery(message.data.queryId, message.data.resources)
      break
    }
    case 'visibleResources': {
      resolveVisibleQuery(message.data.queryId, message.data.resources)
      break
    }
    case 'resourcesByTags': {
      resolveTagQuery(message.data.queryId, message.data.results, message.data.error)
      break
    }
    default: {
      handleFeatureMessage(message)
    }
  }
}
```

Validate external payloads before using them. Required internal application values
should still fail fast; defensive parsing belongs at the message trust boundary.
