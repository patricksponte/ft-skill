# Practical integration recipes

These recipes assume the integration uses the pinned bridge from [Secure bridge, bootstrap lifecycle, and API access](bridge-and-api.md). All identifiers and domains are fictional.

Follow the payload placement documented for the deployed FieldTwin release. In the current contract, resource request parameters belong in `data`, and their replies return the matching `queryId` in `data`.

## Correlate resource queries

FieldTwin can have several queries in flight at once. Give every request a unique `queryId`, retain the resolver in a bounded map, and match only the documented response event and ID. Always add a timeout and a disposal path.

```javascript
export function createResourceQueryClient(bridge, { timeoutMs = 15000 } = {}) {
  const pending = new Map()
  let disposed = false

  function request(eventName, responseEvent, data) {
    if (disposed) {
      return Promise.reject(new Error('Resource query client is disposed'))
    }

    const queryId = crypto.randomUUID()
    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => {
        pending.delete(queryId)
        reject(new Error(`${eventName} timed out`))
      }, timeoutMs)

      pending.set(queryId, { reject, resolve, responseEvent, timer })
      try {
        bridge.send({
          event: eventName,
          data: { ...data, queryId },
        })
      } catch (error) {
        window.clearTimeout(timer)
        pending.delete(queryId)
        reject(error)
      }
    })
  }

  function handleMessage(message) {
    const queryId = message.data?.queryId
    if (typeof queryId !== 'string') {
      return false
    }

    const entry = pending.get(queryId)
    if (!entry || message.event !== entry.responseEvent) {
      return false
    }

    window.clearTimeout(entry.timer)
    pending.delete(queryId)
    entry.resolve(message.data)
    return true
  }

  async function getResources(items) {
    const data = await request('getResources', 'resources', { items })
    return data.resources || []
  }

  async function getVisibleResources() {
    const data = await request('getVisibleResources', 'visibleResources', {})
    return data.resources || []
  }

  function dispose() {
    if (disposed) {
      return
    }

    disposed = true
    for (const entry of pending.values()) {
      window.clearTimeout(entry.timer)
      entry.reject(new Error('Resource query client was disposed'))
    }
    pending.clear()
  }

  return {
    dispose,
    getResources,
    getVisibleResources,
    handleMessage,
  }
}
```

Wire replies through the bridge's single event dispatcher:

```javascript
let resourceQueries

const bridge = createFieldTwinBridge({
  allowedHostOrigins: ['https://fieldtwin.example'],
  onEvent(message) {
    if (resourceQueries.handleMessage(message)) {
      return
    }

    handleUnsolicitedFieldTwinEvent(message)
  },
})

resourceQueries = createResourceQueryClient(bridge)
```

Request specific resources:

```javascript
const resources = await resourceQueries.getResources([
  {
    resourceType: 'stagedAssets',
    id: 'asset-example-001',
  },
])
```

Do not correlate a reply only by event name. That resolves the wrong promise when two requests overlap. Do not keep an unbounded pending map when a host reply never arrives.

## Persist namespaced user settings

`getUserSettings` returns `userSettings`; `setUserSettings` merges the supplied settings object and returns the updated `userSettings`. These events do not provide a query correlation field, so serialize settings operations.

Store integration preferences below a stable, integration-owned key. Do not use the JWT, project ID, user email, or `customTabId` as the persistent key. `customTabId` identifies the current integration instance and can still be retained separately when a deployed message contract explicitly calls for it.

```javascript
export function createSettingsClient(bridge, namespace, { timeoutMs = 10000 } = {}) {
  let pending = null

  function request(message) {
    if (pending) {
      return Promise.reject(new Error('A settings request is already in progress'))
    }

    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => {
        pending = null
        reject(new Error('Settings request timed out'))
      }, timeoutMs)

      pending = { reject, resolve, timer }
      try {
        bridge.send(message)
      } catch (error) {
        window.clearTimeout(timer)
        pending = null
        reject(error)
      }
    })
  }

  function handleMessage(message) {
    if (message.event !== 'userSettings' || !pending) {
      return false
    }

    const settings = message.data?.settings
    const value = settings && typeof settings === 'object' ? settings[namespace] : undefined
    window.clearTimeout(pending.timer)
    const resolve = pending.resolve
    pending = null
    resolve(value && typeof value === 'object' ? value : {})
    return true
  }

  function read() {
    return request({ event: 'getUserSettings' })
  }

  function write(value) {
    return request({
      event: 'setUserSettings',
      data: {
        settings: {
          [namespace]: value,
        },
      },
    })
  }

  async function update(patch) {
    const current = await read()
    return write({ ...current, ...patch })
  }

  function dispose() {
    if (!pending) {
      return
    }

    window.clearTimeout(pending.timer)
    pending.reject(new Error('Settings client was disposed'))
    pending = null
  }

  return {
    dispose,
    handleMessage,
    read,
    update,
    write,
  }
}
```

Use a stable namespace and store only non-sensitive preferences:

```javascript
const settings = createSettingsClient(bridge, 'exampleEquipmentInsights')

const preferences = await settings.read()
applyPreferences(preferences)

await settings.update({
  compactRows: true,
  preferredUnit: 'bar',
})
```

The host performs a top-level merge. Send the complete value for your namespace, as the example's read-modify-write helper does. If several integration windows can write the same namespace concurrently, define a conflict policy rather than assuming writes are transactional.

## Show actionable notifications

Use `toast` for the result of a user-triggered operation. Keep the text useful and free of tokens, personal data, raw response bodies, and internal diagnostics.

```javascript
bridge.send({
  event: 'toast',
  data: {
    type: 'success',
    message: 'Equipment preferences were saved.',
  },
})
```

For a recoverable failure:

```javascript
bridge.send({
  event: 'toast',
  data: {
    type: 'error',
    message: 'Equipment data could not be loaded. Try again.',
  },
})
```

Common documented levels are `info`, `success`, `warning`, and `error`. Use the values supported by the target FieldTwin release.

## Keep selection separate from camera focus

The `select` command focuses the camera by default when `focusSelection` is omitted. Set the field explicitly so an ordinary click does not unexpectedly zoom.

Selection only, suitable for a single-click row interaction:

```javascript
function selectResource(resource) {
  bridge.send({
    event: 'select',
    data: {
      items: [
        {
          type: resource.type,
          id: resource.id,
        },
      ],
      focusSelection: false,
    },
  })
}
```

Explicit focus, suitable for a double-click or a labelled focus action:

```javascript
function focusResource(resource, distance) {
  const data = {
    type: resource.type,
    id: resource.id,
  }

  if (Number.isFinite(distance)) {
    data.distance = distance
  }

  bridge.send({
    event: 'zoomOn',
    data,
  })
}
```

If the user explicitly asks to select and focus in one command, send `select` with `focusSelection: true`. Clear selection independently:

```javascript
bridge.send({ event: 'clearSelection' })
```

For Operation Search, map the row's ordinary selection handler to `focusSelection: false`, then map `operationSearchDoubleClick` or an inline Font Awesome focus action to `zoomOn`. This makes the camera movement discoverable and intentional.

## Handle API failures and cancellation

Create an `AbortController` for work owned by the mounted integration. The bridge adds the current JWT; feature code handles HTTP status and user feedback.

```javascript
const requestController = new AbortController()

async function refreshEquipment() {
  const context = bridge.getContext()
  if (!context?.subProject || !context.apiServerIsReady) {
    return
  }

  try {
    const subProjectId = encodeURIComponent(context.subProject)
    const response = await bridge.apiFetch(`subprojects/${subProjectId}/stagedAssets`, {
      signal: requestController.signal,
    })

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`)
    }

    renderEquipment(await response.json())
  } catch (error) {
    if (error.name === 'AbortError') {
      return
    }

    bridge.send({
      event: 'toast',
      data: {
        type: 'error',
        message: 'Equipment data could not be refreshed. Try again.',
      },
    })
  }
}
```

Do not include the response body or authorization headers in a user-facing error.

## Dispose the complete integration

Release feature clients before the bridge so their pending operations can finish cleanup without using an already-disposed sender.

```javascript
function disposeIntegration() {
  requestController.abort()
  resourceQueries.dispose()
  settings.dispose()
  bridge.dispose()
}

window.addEventListener('pagehide', disposeIntegration, { once: true })
```

Framework integrations should call the same cleanup from their unmount lifecycle. Also clear intervals, observers, and any listeners created outside the bridge.

## Participate in FieldTwin automations

An integration joins the automation graph in three steps. Declare capabilities after `loaded`, serve the declared endpoints from the integration backend, and signal attribute changes through the webhook.

Declare once per session, and re-send only when the declaration changes:

```javascript
bridge.send({
  event: 'automationDescriptor',
  attributes: [
    {
      id: 'fictional.inspectionCount',
      label: 'Fictional inspection count',
      type: 'number',
      readUrl: 'https://integration.example.com/automation/inspection-count',
    },
  ],
  functions: [
    {
      id: 'fictional.scheduleInspection',
      label: 'Schedule fictional inspection',
      params: [
        { id: 'date', type: 'date' },
        { id: 'target', type: 'resource', optional: true },
      ],
      returns: 'string',
      invokeUrl: 'https://integration.example.com/automation/schedule-inspection',
    },
  ],
})
```

Every `type` and `returns` value must come from the released automation value-type vocabulary in the message catalog (`string`, `number`, `boolean`, `date`, `tags`, `resource`, `resources`, `object`, `any`); the host drops entries declaring anything else. A `resource` value travels as `{ id, type }` with the plural collection name.

A function may declare multiple named outputs instead of a single return - `returns: [{ id: 'reportUrl', type: 'string' }, { id: 'pageCount', type: 'number' }]` - and must then respond with an object keyed by output id. Each named output becomes its own wireable port in the FieldTwin automation editor. See the message catalog for the exact response contract.

The automation service calls `readUrl`/`invokeUrl` with POST and a short-lived FieldTwin JWT. Verify the JWT before acting, exactly as for API-bound tokens. Entries without a URL are usable only while a client is open - the FieldTwin editor labels automations that depend on them, and unattended runs fail with an explicit error.

Signal attribute changes from the integration backend, never once per open tab:

```javascript
await fetch(`${backendUrl}/automation/event`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${integrationJwt}`,
  },
  body: JSON.stringify({
    customTabId,
    attributeId: 'fictional.inspectionCount',
    scope: { accountId, subProjectId },
    value: 17,
  }),
})
```

Optionally mirror the new value into open clients with the `attributeUpdated` postMessage; that call updates UI caches only and never starts a run.
