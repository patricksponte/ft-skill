# Operation Mode integrations

Operation Mode lets integrations contribute searchable content, progress, visual
filters, viewport context-menu commands, panels, and time-series data. FieldTwin
routes user interactions back only to the integration instance that contributed
the relevant result, filter, menu entry, or series.

Read [message-catalog.md](message-catalog.md) for the base envelopes and
[bridge-and-api.md](bridge-and-api.md) for a secure `sendToHost(message,
transferables?)` implementation. The samples below assume messages are already
received through a bridge that pins both the exact host origin and source window.

## Exact envelope map

Operation Mode deliberately mixes top-level and nested fields:

| Direction | Event | Exact field location |
| --- | --- | --- |
| Host → integration | `operationSearch` | `query` and `clear` are top-level |
| Integration → host | `operationSearchResults` | `data.results` |
| Integration → host | `operationSearchProgress` | `data.status`, `data.progress`, `data.isComplete` |
| Host → integration | `operationSearchAction` | `integrationId`, `resultId`, `actionId`, `action`, and `args` are top-level |
| Host → integration | `operationSearchDoubleClick` | `integrationId`, `resultId`, optional `action`, and `args` are top-level |
| Integration → host | `visualFilteringUpdate` | `data.filters` |
| Host → integration | `visualFilterToggle` | `data.id`, `data.state`, optional `data.subFilterId` |
| Integration → host | `visualLegendUpdate` | optional `data.title`, `data.position`, `data.items`, and `data.visible` |
| Integration → host | `contextMenuUpdate` | `data.entries` |
| Host → integration | `contextMenuAction` | `integrationId`, `action`, `args`, and optional `cursorPosition` are top-level |
| Integration → host | `openOperationPanel` | `data.integrationId` and `data.path` |
| Host → integration | `operationPaneClosed` | `customTabId` is top-level |
| Integration → host | `displayTimeSeries` | event-only |
| Integration → host | `timeSeriesInfo` | `data.series` and optional `data.replaceExisting` |
| Host → integration | `getTimeSeriesData` | request fields are under `data` |
| Integration → host | `timeSeriesData` | reply fields are under `data` |

Do not include a client-supplied integration identity unless an event explicitly
documents one. The host derives the sender from its registered source window and
uses that identity to scope results and replies.

## Search lifecycle

The host broadcasts `operationSearch` when the user submits a query. Clearing the
input, or submitting an empty input, sends the same event with `query: ''` and
`clear: true`.

```javascript
{
  event: 'operationSearch',
  query: 'fictional valve',
  clear: false
}
```

```javascript
{
  event: 'operationSearch',
  query: '',
  clear: true
}
```

On clear, cancel outstanding search work and publish an empty result set. Also mark
progress complete if the integration had published progress:

```javascript
function clearOperationSearch() {
  searchAbortController?.abort()
  searchAbortController = null

  sendToHost({
    event: 'operationSearchResults',
    data: {
      results: []
    }
  })

  sendToHost({
    event: 'operationSearchProgress',
    data: {
      status: '',
      isComplete: true
    }
  })
}
```

Progress is scoped to the sending integration and expires automatically after 30
seconds without an update. Send explicit completion instead of waiting for expiry:

```javascript
sendToHost({
  event: 'operationSearchProgress',
  data: {
    status: 'Searching fictional maintenance records…',
    progress: 35,
    isComplete: false
  }
})
```

## Result schema

An `operationSearchResults` message replaces the previous result tree from the
sending integration:

```javascript
sendToHost({
  event: 'operationSearchResults',
  data: {
    results: []
  }
})
```

Each result can contain:

| Field | Purpose |
| --- | --- |
| `id` | Stable ID unique within the integration's current result tree; required for interactive results |
| `category` | Category grouping when `tags` is absent |
| `tags` | Optional tag group names |
| `html` | Display markup; the host sanitizes it, but the integration must still escape untrusted values |
| `action` | Legacy normal-row action; `select` links a normal click to selection |
| `args` | Arguments for the row interaction and generic double-click fallback |
| `actions` | Short list of inline icon-button descriptors |
| `doubleClickAction` | Optional `{ action, args }` descriptor returned on double-click |
| `target` | Optional `core` for a legacy host action; otherwise an integration event |
| `noPanel` | If `true`, an ordinary row click does not open/focus the integration panel |
| `subItems` | Nested result rows supporting the same interaction fields |

Child-row `icon` is a row decoration and accepts `file`, `cube`, `cloud`, or
`circle` (default). It is separate from the Font Awesome icon used by an inline
action.

Each inline action has:

```javascript
{
  id: 'focus',
  label: 'Focus on valve',
  icon: 'faLocationCrosshairs',
  action: 'focusOnValve',
  args: {
    type: 'stagedAsset',
    id: 'asset-fictional-001'
  }
}
```

`id`, `label`, `icon`, and `action` must be non-empty strings. `icon` is a Font
Awesome name such as `faLocationCrosshairs`, `faFileLines`, or the equivalent
kebab-case spelling. Unknown icons and incomplete descriptors are ignored. Send
only the icon name; never send SVG or icon HTML.

## Keep the three row interactions separate

### 1. Ordinary click: select without focus

A result linked to a FieldTwin graph resource can use the legacy `select` row
action. The host selects the linked resource without moving the camera. `noPanel`
keeps a compact search-only click from opening the integration panel.

```javascript
{
  id: 'asset-fictional-001',
  category: 'Fictional assets',
  html: '<strong>V-001</strong> — Water injection valve',
  action: 'select',
  args: {
    type: 'stagedAsset',
    id: 'asset-fictional-001'
  },
  noPanel: true
}
```

For integration-initiated selection elsewhere, make the same intent explicit:

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
    focusSelection: false
  }
})
```

Do not use camera movement as an incidental consequence of ordinary selection.

### 2. Inline button: an explicit secondary command

Inline buttons do not also trigger the row click and do not open the panel. When the
user clicks one, the contributing integration receives this top-level envelope:

```javascript
{
  event: 'operationSearchAction',
  integrationId: 'asset-inspector-fictional',
  resultId: 'asset-fictional-001',
  actionId: 'focus',
  action: 'focusOnValve',
  args: {
    type: 'stagedAsset',
    id: 'asset-fictional-001'
  }
}
```

Handle the integration-defined action, then request focus explicitly:

```javascript
function handleOperationSearchAction(message) {
  if (message.action !== 'focusOnValve') {
    return
  }

  sendToHost({
    event: 'zoomOn',
    data: {
      type: message.args.type,
      id: message.args.id
    }
  })
}
```

This is the preferred pattern for a visible “focus” affordance: the row remains an
ordinary selection, while the crosshair button owns camera movement.

### 3. Double-click: focus or open

Double-clicking a row sends a separate top-level event. If the result links to a
FieldTwin graph resource, the host also selects and focuses that resource. The
second browser click is suppressed so the legacy normal-row action is not repeated.

With a declared `doubleClickAction`:

```javascript
{
  event: 'operationSearchDoubleClick',
  integrationId: 'asset-inspector-fictional',
  resultId: 'asset-fictional-001',
  action: 'openValveDetails',
  args: {
    valveId: 'external-valve-fictional-001'
  }
}
```

Without a declared descriptor, `action` is omitted and `args` falls back to the
result's ordinary `args`:

```javascript
{
  event: 'operationSearchDoubleClick',
  integrationId: 'asset-inspector-fictional',
  resultId: 'asset-fictional-001',
  args: {
    type: 'stagedAsset',
    id: 'asset-fictional-001'
  }
}
```

Use `doubleClickAction` when a double-click has integration-specific behavior, such
as opening details for an external record. Do not send a second `zoomOn` for a
linked FieldTwin graph resource unless a different camera behavior is intentional.

## Complete fictional search implementation

The following client handles search, clear, inline focus, double-click, and progress.
It assumes `sendToHost` comes from the secure bridge and that `fetchFictionalAssets`
is the integration's own data function.

```javascript
let searchAbortController = null

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function toSearchResult(asset) {
  const displayTag = escapeHtml(asset.tag)
  const displayName = escapeHtml(asset.name)

  return {
    id: asset.fieldTwinId,
    category: 'Fictional assets',
    tags: asset.groups,
    html: `<strong>${displayTag}</strong> — ${displayName}`,
    action: 'select',
    args: {
      type: 'stagedAsset',
      id: asset.fieldTwinId
    },
    noPanel: true,
    actions: [
      {
        id: 'focus',
        label: `Focus on ${asset.tag}`,
        icon: 'faLocationCrosshairs',
        action: 'focusOnAsset',
        args: {
          type: 'stagedAsset',
          id: asset.fieldTwinId
        }
      },
      {
        id: 'open-record',
        label: `Open record for ${asset.tag}`,
        icon: 'faFileLines',
        action: 'openAssetRecord',
        args: {
          externalId: asset.externalId
        }
      }
    ],
    doubleClickAction: {
      action: 'openAssetRecord',
      args: {
        externalId: asset.externalId
      }
    },
    subItems: asset.documents.map((document) => ({
      id: `document:${document.id}`,
      html: escapeHtml(document.name),
      icon: 'file',
      noPanel: true,
      actions: [
        {
          id: 'open-document',
          label: `Open ${document.name}`,
          icon: 'faFileLines',
          action: 'openAssetDocument',
          args: {
            documentId: document.id
          }
        }
      ]
    }))
  }
}

async function runOperationSearch(query) {
  searchAbortController?.abort()
  const controller = new AbortController()
  searchAbortController = controller

  sendToHost({
    event: 'operationSearchProgress',
    data: {
      status: 'Searching fictional asset records…',
      progress: 10,
      isComplete: false
    }
  })

  try {
    const assets = await fetchFictionalAssets(query, {
      signal: controller.signal
    })

    if (controller !== searchAbortController) {
      return
    }

    sendToHost({
      event: 'operationSearchResults',
      data: {
        results: assets.map(toSearchResult)
      }
    })
  } catch (error) {
    if (controller === searchAbortController && error.name !== 'AbortError') {
      sendToHost({
        event: 'toast',
        data: {
          type: 'danger',
          message: 'The fictional asset search could not be completed.'
        }
      })
    }
  } finally {
    if (controller === searchAbortController) {
      searchAbortController = null
      sendToHost({
        event: 'operationSearchProgress',
        data: {
          status: '',
          isComplete: true
        }
      })
    }
  }
}

function clearOperationSearch() {
  searchAbortController?.abort()
  searchAbortController = null

  sendToHost({
    event: 'operationSearchResults',
    data: {
      results: []
    }
  })

  sendToHost({
    event: 'operationSearchProgress',
    data: {
      status: '',
      isComplete: true
    }
  })
}

function handleTrustedOperationMessage(message) {
  switch (message.event) {
    case 'operationSearch': {
      if (message.clear) {
        clearOperationSearch()
        return
      }
      if (typeof message.query !== 'string') {
        return
      }

      const query = message.query.trim()
      if (!query) {
        clearOperationSearch()
        return
      }

      void runOperationSearch(query)
      return
    }
    case 'operationSearchAction': {
      if (message.action === 'focusOnAsset') {
        sendToHost({
          event: 'zoomOn',
          data: {
            type: message.args.type,
            id: message.args.id
          }
        })
      } else if (message.action === 'openAssetRecord') {
        openFictionalAssetRecord(message.args.externalId)
      } else if (message.action === 'openAssetDocument') {
        openFictionalAssetDocument(message.args.documentId)
      }
      return
    }
    case 'operationSearchDoubleClick': {
      if (message.action === 'openAssetRecord') {
        openFictionalAssetRecord(message.args.externalId)
      }
      return
    }
  }
}
```

Every interactive parent and child result has a stable `id`. Inline action IDs are
stable within their result. Untrusted names are HTML-escaped before inclusion in
`html`; action labels remain plain text even though FieldTwin sanitizes displayed
HTML.

## Host system highlights are not visual filters

Operation Mode's built-in Highlight systems renderer is host-owned. When one physical connection contains several metadata-selected connection definitions, use [system-highlighting.md](system-highlighting.md) to model logical channels, independent directions, flow phases, and multi-band rendering.

Do not overload `visualFilteringUpdate` with those channels. Visual filters remain integration-owned filter state and optional tag highlights; they do not redefine a physical connection as a multi-color bundle.

## Visual filters

Register or replace the sending integration's filters with `data.filters`:

```javascript
sendToHost({
  event: 'visualFilteringUpdate',
  data: {
    filters: [
      {
        id: 'fictional-condition',
        label: 'Condition',
        state: true,
        subFilters: [
          {
            id: 'healthy',
            label: 'Healthy',
            state: true
          },
          {
            id: 'attention',
            label: 'Needs attention',
            state: false
          }
        ]
      }
    ]
  }
})
```

The host returns the requested state under `data` and targets only the contributing
integration:

```javascript
{
  event: 'visualFilterToggle',
  data: {
    id: 'fictional-condition',
    state: true,
    subFilterId: 'attention'
  }
}
```

Update the integration's filter state, apply the visual effect, then republish
`visualFilteringUpdate` so the host reflects the authoritative state. Omit
`subFilterId` for a parent filter toggle.

## Viewport context menu

Publish integration-defined entries under `data.entries`. Entries can have nested
`subItems` with the same shape:

```javascript
sendToHost({
  event: 'contextMenuUpdate',
  data: {
    entries: [
      {
        id: 'fictional-asset-tools',
        label: 'Fictional asset tools',
        tooltip: 'Commands supplied by the fictional integration',
        icon: 'faWrench',
        subItems: [
          {
            id: 'create-inspection',
            label: 'Create inspection',
            icon: 'faClipboardCheck',
            action: 'createInspection',
            args: {
              templateId: 'inspection-template-fictional-001'
            }
          }
        ]
      }
    ]
  }
})
```

Clicking an entry returns top-level fields:

```javascript
{
  event: 'contextMenuAction',
  integrationId: 'asset-inspector-fictional',
  action: 'createInspection',
  args: {
    templateId: 'inspection-template-fictional-001'
  },
  cursorPosition: {
    x: 477348.43,
    y: 6664023.98,
    z: -107.04,
    latitude: 60.1234,
    longitude: 4.5678
  }
}
```

`cursorPosition` can be omitted when no point is resolved. `latitude` and
`longitude` are optional and appear only when WGS84 reprojection succeeds. Do not
assume geographic coordinates are always present.

## Operation panels

Open or focus a panel with a nested `data` object. Omit `integrationId` to target the
sending integration. For a dynamic page, `path` must match the path published by
the dynamic-pages endpoint:

```javascript
sendToHost({
  event: 'openOperationPanel',
  data: {
    integrationId: 'asset-inspector-fictional',
    path: 'asset-details'
  }
})
```

When the right-side panel closes, the owning integration receives:

```javascript
{
  event: 'operationPaneClosed',
  customTabId: 'asset-inspector-fictional'
}
```

Stop polling, subscriptions, and panel-only rendering work on this event. The
integration document may remain loaded, so do not confuse panel closure with full
bridge teardown.

## Time series

Time series use a metadata registration followed by windowed binary requests.

### Register and display series

Publish metadata under `data.series`. `replaceExisting: true` first removes series
previously registered by this integration; the default `false` merges by series ID.

```javascript
sendToHost({
  event: 'timeSeriesInfo',
  data: {
    replaceExisting: true,
    series: [
      {
        id: 'fictional-wellhead-pressure',
        name: 'Fictional wellhead pressure',
        unit: 'bar',
        xMin: 0,
        xMax: 86400,
        sampleCount: 86401,
        xAxisTitle: 'Time (s)',
        yAxisTitle: 'Pressure',
        color: '#2f80ed'
      }
    ]
  }
})

sendToHost({ event: 'displayTimeSeries' })
```

### Receive a window request

The host targets only the integration that owns the requested series:

```javascript
{
  event: 'getTimeSeriesData',
  data: {
    seriesId: 'fictional-wellhead-pressure',
    reqId: 'fictional-wellhead-pressure::request-001',
    xMin: 3600,
    xMax: 7200,
    sampleCount: 1200
  }
}
```

Echo `data.reqId` exactly. Never correlate time-series responses by arrival order.

### Return a transferable binary buffer

Stride 2 encodes `[x, y]` pairs. Stride 4 encodes `[x, mean, min, max]` envelopes.
The latter preserves peaks after downsampling.

```javascript
function buildFictionalPressureEnvelope(xMin, xMax, sampleCount) {
  const count = Math.max(1, Math.min(4096, Math.floor(sampleCount)))
  const samples = new Float64Array(count * 4)
  const step = count === 1 ? 0 : (xMax - xMin) / (count - 1)

  for (let index = 0; index < count; index += 1) {
    const x = xMin + index * step
    const mean = 145 + Math.sin(x / 900) * 4
    const spread = 0.8 + Math.abs(Math.cos(x / 600))
    const offset = index * 4

    samples[offset] = x
    samples[offset + 1] = mean
    samples[offset + 2] = mean - spread
    samples[offset + 3] = mean + spread
  }

  return samples.buffer
}

function handleTimeSeriesRequest(message) {
  if (
    message.event !== 'getTimeSeriesData' ||
    !message.data ||
    typeof message.data !== 'object'
  ) {
    return
  }

  const { seriesId, reqId, xMin, xMax, sampleCount } = message.data
  if (
    seriesId !== 'fictional-wellhead-pressure' ||
    typeof reqId !== 'string' ||
    !Number.isFinite(xMin) ||
    !Number.isFinite(xMax) ||
    !Number.isFinite(sampleCount) ||
    sampleCount <= 0
  ) {
    return
  }

  const buffer = buildFictionalPressureEnvelope(xMin, xMax, sampleCount)
  sendToHost(
    {
      event: 'timeSeriesData',
      data: {
        reqId,
        buffer,
        stride: 4
      }
    },
    [buffer]
  )
}
```

Transfer the `ArrayBuffer` instead of copying it. The integration must not reuse a
transferred buffer because its local instance becomes detached. Validate request
numbers and cap generated samples to a documented local limit; this sample uses
4096 to prevent an untrusted request from allocating an arbitrarily large buffer.

## Validation checklist

- Submit and clear search; stale results and progress disappear.
- Verify ordinary click selects a linked resource without moving the camera.
- Verify keyboard Enter/Space on a row follows ordinary-click behavior.
- Verify an inline button sends exactly one `operationSearchAction` and no row click.
- Verify double-click sends exactly one `operationSearchDoubleClick`, does not repeat
  the legacy row action, and focuses linked graph resources.
- Test stable IDs for parent and child results across refreshed result sets.
- Test unknown or incomplete Font Awesome action descriptors are ignored safely.
- Test filter and context-menu actions are routed only to the contributing instance.
- Test a context-menu action both with and without geographic coordinates.
- Test dynamic and standard panel opening, panel closure cleanup, and pop-out routing.
- Test time-series request correlation, stride 2 and stride 4 decoding, timeout/error
  behavior, and transferred-buffer ownership.
- Test two instances of the same integration so their results, filters, actions,
  menus, and series cannot cross-route.
