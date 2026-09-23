# Secure bridge, bootstrap lifecycle, and API access

Install bootstrap capture from the earliest browser entrypoint, before the integration framework
mounts or hydrates. Create one full bridge for the page and dispose it when the page unmounts. The
bridge should own the FieldTwin host window, trusted origin, JWT, and optional API context so
feature code does not duplicate security-sensitive message handling.

The examples on this page use fictional `.example` origins. Supply the exact origins for the FieldTwin environments where the integration is installed.

## Bootstrap contract

FieldTwin sends `loaded` after the integration document has loaded. The integration does not need to send a readiness event first.

Use `loaded` to initialize only the runtime fields the integration needs:

| Field | Purpose |
| --- | --- |
| `token` | Current JWT for FieldTwin API requests. Keep it in memory only. |
| `backendUrl` | Backend base URL supplied by the trusted host. |
| `APIVersion` | API version such as `v1.10`. |
| `project`, `subProject`, `stream` | Current project scope. |
| `customTabId` | Identity of this integration instance. |
| `canEdit` | UI capability hint. The API still enforces authorization. |
| `APIServerIsReady` | Whether subproject API requests can start. |

Not every surface receives every field. Account Settings can be account-scoped and may provide a
token without `backendUrl`, `APIVersion`, project, subproject, or stream. Validate fields when they
are present, require only what the current page needs, and make project API helpers unavailable
until their backend/API context exists. Same-origin integration control-plane calls can still use
the trusted in-memory token.

Before accepting `loaded`, require both:

1. `event.origin` is an exact member of a deployment allowlist.
2. `event.source` is the expected host window: `window.parent` for an iframe or `window.opener` for a pop-out.

After accepting it, pin that exact origin and source pair. Every later inbound message and every outbound message must use the pinned pair. Do not infer trust from `document.referrer`, `backendUrl`, a substring match, or a value inside the message.

`postMessage` works in both layouts; the target window changes. In an embedded integration,
`window.parent` is the FieldTwin host. In a pop-out, `window.parent === window`, so sending to the
parent posts back to the integration itself. The FieldTwin host is `window.opener` there. Resolve
that distinction only while validating `loaded`, then send every later request through the pinned
`event.source`. Do not let feature code choose between parent and opener for each message.

## Register before framework mount

FieldTwin does not wait for a client readiness handshake. A bridge created only by `onMount`,
`useEffect`, or another component lifecycle can miss `loaded`. SvelteKit's `hooks.client` is also
dynamically imported and may run after the parent handles the iframe `load` event. Install a small
parser-time module from `app.html`, before `%sveltekit.body%`, and keep its bounded queue private to
that module closure. When the full bridge starts, import the same module instance and drain it:

```javascript
const MAX_PENDING_LOADED = 8
const captures = new WeakMap()

export function armEarlyFieldTwinMessages(targetWindow) {
  if (captures.has(targetWindow)) return

  const messages = []
  const receive = (event) => {
    const data = event.data
    if (!data || typeof data !== 'object' || Array.isArray(data) || data.event !== 'loaded') return
    messages.push(event)
    if (messages.length > MAX_PENDING_LOADED) messages.shift()
  }

  captures.set(targetWindow, { messages, receive })
  targetWindow.addEventListener('message', receive)
}

export function takeEarlyFieldTwinMessages(targetWindow) {
  const capture = captures.get(targetWindow)
  if (!capture) return []

  targetWindow.removeEventListener('message', capture.receive)
  captures.delete(targetWindow)
  return capture.messages.splice(0)
}
```

The temporary receiver only collects candidates; it does not trust them. The full bridge must
attach its listener first, drain each candidate through the same `receive` function, and clear the
capture on construction failure. Keep this queue in the parser module closure—never on `window`, in
framework state, browser storage, or hydration data. Test actual browser ordering: the parent posts
from the iframe `load` callback before SvelteKit's dynamic client imports complete.

## Vanilla JavaScript bridge

This dependency-free bridge consumes `loaded` and `tokenRefresh`, tracks API readiness, and exposes a sender and authenticated API helper. Create it from an early browser-only entrypoint or combine it with the bounded handoff above.

```javascript
import { takeEarlyFieldTwinMessages } from './early-fieldtwin-messages.js'

const API_VERSION_PATTERN = /^v\d+(?:\.\d+)*$/

function normalizeHostOrigin(value, allowInsecureHttp) {
  const url = new URL(value)
  if (url.origin !== value ||
      (url.protocol !== 'https:' && !(allowInsecureHttp && url.protocol === 'http:'))) {
    throw new Error('FieldTwin host origins must be exact HTTPS origins unless local HTTP mode is enabled')
  }
  return url.origin
}

function isMessage(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && typeof value.event === 'string'
}

function getExpectedHostWindow() {
  if (window.parent !== window) {
    return window.parent
  }

  return window.opener && !window.opener.closed ? window.opener : null
}

function readLoadedState(message, allowInsecureHttp) {
  if (typeof message.token !== 'string' || message.token.length === 0) {
    return null
  }

  let backendBaseUrl
  if (message.backendUrl !== undefined) {
    if (typeof message.backendUrl !== 'string') return null
    let backendUrl
    try {
      backendUrl = new URL(message.backendUrl)
    } catch {
      return null
    }
    if ((backendUrl.protocol !== 'https:' &&
         !(allowInsecureHttp && backendUrl.protocol === 'http:')) ||
        backendUrl.username || backendUrl.password || backendUrl.search || backendUrl.hash) return null
    backendBaseUrl = backendUrl.href.replace(/\/$/, '')
  }

  const apiVersion = message.APIVersion
  if (apiVersion !== undefined &&
      (typeof apiVersion !== 'string' || !API_VERSION_PATTERN.test(apiVersion))) return null

  return {
    token: message.token,
    ...(backendBaseUrl ? { backendBaseUrl } : {}),
    ...(apiVersion ? { apiVersion } : {}),
    project: message.project,
    subProject: message.subProject,
    stream: message.stream,
    customTabId: message.customTabId,
    canEdit: message.canEdit === true,
    apiServerIsReady: message.APIServerIsReady === true,
  }
}

export function createFieldTwinBridge({
  allowedHostOrigins,
  allowInsecureHttp = false,
  onReady = () => {},
  onEvent = () => {},
}) {
  if (!Array.isArray(allowedHostOrigins) || allowedHostOrigins.length === 0) {
    throw new Error('Configure at least one exact FieldTwin host origin')
  }

  const allowedOrigins = new Set(
    allowedHostOrigins.map((origin) => normalizeHostOrigin(origin, allowInsecureHttp)),
  )
  let hostWindow = null
  let hostOrigin = null
  let state = null
  let disposed = false

  function getContext() {
    if (!state) {
      return null
    }

    return {
      backendBaseUrl: state.backendBaseUrl,
      apiVersion: state.apiVersion,
      project: state.project,
      subProject: state.subProject,
      stream: state.stream,
      customTabId: state.customTabId,
      canEdit: state.canEdit,
      apiServerIsReady: state.apiServerIsReady,
    }
  }

  function acceptBootstrap(event, message) {
    const expectedHostWindow = getExpectedHostWindow()
    if (!expectedHostWindow ||
        !allowedOrigins.has(event.origin) ||
        event.source !== expectedHostWindow) {
      return false
    }

    const nextState = readLoadedState(message, allowInsecureHttp)
    if (!nextState) {
      return false
    }

    hostWindow = expectedHostWindow
    hostOrigin = event.origin
    state = nextState
    onReady(getContext())
    return true
  }

  function receive(event) {
    if (disposed || !isMessage(event.data)) {
      return
    }

    const message = event.data
    if (!hostWindow) {
      if (message.event === 'loaded') {
        acceptBootstrap(event, message)
      }
      return
    }

    if (event.source !== hostWindow || event.origin !== hostOrigin) {
      return
    }

    if (message.event === 'loaded') {
      const nextState = readLoadedState(message, allowInsecureHttp)
      if (nextState) {
        state = nextState
        onReady(getContext())
      }
      return
    }

    if (message.event === 'tokenRefresh') {
      if (typeof message.token === 'string' && message.token.length > 0) {
        state = { ...state, token: message.token }
      }
      return
    }

    if (message.event === 'apiPodIsReady') {
      state = { ...state, apiServerIsReady: true }
    } else if (message.event === 'apiPodIsNotReady') {
      state = { ...state, apiServerIsReady: false }
    }

    onEvent(message)
  }

  function send(message, transfer = []) {
    if (disposed || !hostWindow || hostWindow.closed || !hostOrigin) {
      throw new Error('FieldTwin bridge is not ready')
    }
    if (!isMessage(message)) {
      throw new Error('FieldTwin messages require an event string')
    }

    hostWindow.postMessage(message, hostOrigin, transfer)
  }

  async function apiFetch(path, init = {}) {
    if (disposed || !state) {
      throw new Error('FieldTwin bridge is not ready')
    }
    if (!state.backendBaseUrl || !state.apiVersion) {
      throw new Error('FieldTwin API context is unavailable')
    }
    if (!state.apiServerIsReady) {
      throw new Error('FieldTwin API server is not ready')
    }
    if (typeof path !== 'string' || path.startsWith('//')) {
      throw new Error('Use a relative FieldTwin API path')
    }

    const apiRoot = new URL(`${state.backendBaseUrl}/API/${state.apiVersion}/`)
    const endpoint = new URL(path.replace(/^\/+/, ''), apiRoot)
    if (endpoint.origin !== apiRoot.origin || !endpoint.pathname.startsWith(apiRoot.pathname)) {
      throw new Error('API path must stay inside the configured FieldTwin API root')
    }

    const headers = new Headers(init.headers)
    headers.set('Authorization', `Bearer ${state.token}`)

    return fetch(endpoint, {
      ...init,
      headers,
      redirect: 'error',
    })
  }

  function dispose() {
    if (disposed) {
      return
    }

    disposed = true
    window.removeEventListener('message', receive)
    state = null
    hostWindow = null
    hostOrigin = null
  }

  window.addEventListener('message', receive)
  for (const event of takeEarlyFieldTwinMessages(window)) receive(event)

  return {
    apiFetch,
    dispose,
    getContext,
    send,
  }
}
```

Example setup:

```javascript
import { createFieldTwinBridge } from './fieldtwin-bridge.js'

let bridge

bridge = createFieldTwinBridge({
  allowedHostOrigins: ['https://fieldtwin.example'],
  onReady(context) {
    renderEditingControls(context.canEdit)
    if (context.apiServerIsReady) {
      void loadInitialData()
    }
  },
  onEvent(message) {
    if (message.event === 'apiPodIsReady') {
      void loadInitialData()
      return
    }

    routeFieldTwinEvent(message)
  },
})
```

Configure the allowlist outside the message itself, for example through a deployment-specific build
setting. A self-hosted installation should add its own exact host origin rather than weakening the
comparison. Require HTTPS by default. If local FieldTwin itself runs at an HTTP origin, enable the
HTTP exception only from the same explicit local deployment mode that selected an HTTP integration
origin, and list that exact parent (for example `http://fieldtwin.local.example`). Never infer this
exception from the incoming message or referrer, and never enable it in shared environments.

For a pop-out, FieldTwin must open the integration without severing `window.opener`. A directly
navigated integration page, or one opened with `noopener` or an incompatible
`Cross-Origin-Opener-Policy`, has no trusted host window and must remain disconnected rather than
falling back to `window.parent`, `window.top`, a wildcard target, or a guessed origin.

## Authenticated API requests

`apiFetch` constructs the API root from the trusted `loaded` context and reads the current in-memory token for every request. A request made after `tokenRefresh` therefore uses the new JWT rather than a token captured during initial setup.

The helper intentionally uses the trusted `APIVersion`. Do not make it silently reinterpret a
v1.10 relative path as v2.0. Read [backend-api.md](backend-api.md) for common authentication,
readiness, error, and retry behavior; use [backend-api-v1.10.md](backend-api-v1.10.md) or
[backend-api-v2.0.md](backend-api-v2.0.md) for the selected version and
[backend-api-batch.md](backend-api-batch.md) for mutations.

Use endpoint paths from the [FieldTwin API documentation](https://api.fieldtwin.com/). This illustrative request uses only fictional identifiers:

```javascript
async function loadInitialData() {
  const context = bridge.getContext()
  if (!context || !context.subProject || !context.apiServerIsReady) {
    return
  }

  if (context.apiVersion !== 'v1.10' || !context.project) {
    throw new Error('This example requires FieldTwin API v1.10 project context')
  }

  const qualifiedId = context.subProject.includes(':')
    ? context.subProject
    : `${context.subProject}:${context.stream || context.subProject}`
  const projectId = encodeURIComponent(context.project)
  const subProjectId = encodeURIComponent(qualifiedId)
  const response = await bridge.apiFetch(
    `${projectId}/subProject/${subProjectId}/stagedAssets`,
  )

  if (!response.ok) {
    throw new Error(`FieldTwin request failed with status ${response.status}`)
  }

  const stagedAssets = await response.json()
  renderStagedAssets(stagedAssets)
}
```

Important API rules:

- Build the `Authorization` header immediately before each request.
- Use the supplied API version. Verify the tenant's live v2 OpenAPI contract before selecting v2.
- In v1.10, include the project and qualified `{subProject}:{stream}` in subproject paths. In v2,
  use the normalized `/subProjects/{qualifiedId}` stream endpoint and type filters.
- Do not put the JWT in a URL, storage API, log, error report, analytics event, or serialized application state.
- Treat `canEdit` as a way to disable editing controls, not as authorization. The API remains authoritative.
- Wait for `APIServerIsReady` or `apiPodIsReady` before subproject API work. Back off when `apiPodIsNotReady` arrives.
- Keep API paths relative to the trusted backend root so the bearer token cannot be sent to an unrelated origin.
- Parse success bodies by `Content-Type`; PATCH/DELETE can be empty and specialized endpoints can
  return SVG, files, or streaming data.
- Automatically retry only reads. Reconcile an ambiguous mutation before retrying it.
- Surface user-triggered failures with a useful message and retry path; do not include credentials in the message.

## Teardown

Call `bridge.dispose()` when the integration unmounts or the pop-out closes. This removes the message listener and releases the in-memory JWT and pinned window references.

The bridge cannot know about work created by feature code. The integration must also:

- abort in-flight fetches;
- clear polling intervals and retry timers;
- reject or cancel pending request promises;
- remove feature-level event listeners;
- stop work tied to a panel after `operationPaneClosed` when applicable.

See [Practical recipes](recipes.md) for query cleanup, settings, notifications, and selection-versus-focus patterns.
