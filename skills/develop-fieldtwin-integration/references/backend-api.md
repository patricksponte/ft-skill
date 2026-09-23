# FieldTwin backend API: authentication, routing, readiness, and errors

Use the REST API for FieldTwin data and configuration. Use `postMessage` for browser-to-browser
coordination with the open FieldTwin client. These are separate trust boundaries even when one UI
action uses both.

This reference covers the rules shared by API v1.10 and v2.0. Continue with
[backend-api-v1.10.md](backend-api-v1.10.md), [backend-api-v2.0.md](backend-api-v2.0.md), and
[backend-api-batch.md](backend-api-batch.md) for their exact shapes. Use
[api-attributes.md](api-attributes.md) for the generated, operation-specific list of every request
and response field.

## Choose the deployed contract first

The integration receives `backendUrl` and `APIVersion` in the trusted `loaded` message. Treat them
as deployment data, not constants:

- preserve the complete `backendUrl`, including a path such as `/backend`;
- accept HTTP only in an explicitly configured local-development mode;
- use the supplied `APIVersion` by default;
- do not silently replace `v1.10` with `v2.0` because v2 exists in another tenant or branch;
- before opting into v2, verify that the target tenant serves its v2 OpenAPI document and that the
  required operations are present.

As verified on 2026-08-22, the public roadmap describes v1.10 as the generally supported version
and v2.0 as the normalized API arriving with FieldTwin 8.3. Tenant rollout can differ. The target
tenant's live contract wins.

| Need | v1.10 | v2.0 |
| --- | --- | --- |
| Existing integrations and widest deployed compatibility | Preferred | Verify availability |
| Individual resource CRUD | Dedicated singular/plural routes | Use stream batch CRUD |
| Multi-type subproject changes | `/batch` | Built into every stream mutation |
| Consistent GET envelope | Endpoint-dependent | Type maps keyed by resource ID |
| Exact request/response schemas | Live v1.10 API portal | Tenant OpenAPI document |

The bundled attribute catalogs make the verified source contract searchable offline. The target
tenant's live portal/OpenAPI still wins when its deployed release differs.

Public sources:

- [FieldTwin API documentation](https://api.fieldtwin.com/)
- [API basics and authentication](https://docs.fieldtwin.com/developer-portal/apibasics/)
- [API roadmap and lifecycle](https://docs.fieldtwin.com/developer-portal/xroadmap/)
- [Official curl and Postman examples](https://docs.fieldtwin.com/developer-portal/postman/)

## Construct the API root without losing a base path

Do not derive the backend from the FieldTwin frontend hostname. Do not reduce `backendUrl` to
`url.origin`: a reverse proxy may intentionally supply a base path.

```javascript
function buildApiRoot(backendUrl, apiVersion) {
  if (!/^v\d+(?:\.\d+)*$/.test(apiVersion)) {
    throw new Error('Invalid FieldTwin API version')
  }

  const base = new URL(backendUrl)
  base.pathname = `${base.pathname.replace(/\/$/, '')}/API/${apiVersion}/`
  base.search = ''
  base.hash = ''
  return base
}

function buildApiUrl(apiRoot, relativePath) {
  if (typeof relativePath !== 'string' || relativePath.startsWith('//')) {
    throw new Error('Use a relative FieldTwin API path')
  }

  const endpoint = new URL(relativePath.replace(/^\/+/, ''), apiRoot)
  if (endpoint.origin !== apiRoot.origin || !endpoint.pathname.startsWith(apiRoot.pathname)) {
    throw new Error('FieldTwin API path escaped its configured root')
  }
  return endpoint
}
```

Build every path segment with `encodeURIComponent`. Build query strings with `URLSearchParams`.
Do not concatenate untrusted resource IDs into query syntax.

## Authentication profiles

The API supports two mutually exclusive authentication profiles:

| Profile | Header | Intended use |
| --- | --- | --- |
| Integration/user JWT | `Authorization: Bearer <JWT>` | Interactive integrations acting with the current user's scope and rights |
| Account API token | `token: <API token>` | Server-to-server or non-interactive administration configured by an account administrator |

For a custom-tab integration, use the JWT received through trusted bootstrap. Do not also send the
`token` header. API tokens commonly live longer and may be unrestricted unless assigned a role;
never put one in browser code.

Build `Authorization` immediately before each request so `tokenRefresh` takes effect. Keep both
credential types out of URLs, browser storage, DOM, logs, analytics, error text, source control,
and cached request objects.

The gateway validates the credential, tenant/account scope, user license, project/subproject
membership, and operation rights before forwarding the call. `canEdit` from `loaded` is only a UI
hint. A true value does not authorize a request, and a false value should disable integration edit
controls even though the API still makes the final decision.

Do not send or trust internal context headers such as `ft-account-id`, `ft-project-id`,
`ft-sub-project-id`, `ft-user-id`, or `ft-request-tab`. The authenticated FieldTwin gateway derives
and replaces that context. A client-supplied value is not an authorization mechanism.

## Minimal request helper

```javascript
async function fieldTwinFetch({ apiRoot, getToken, path, init = {} }) {
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${getToken()}`)

  if (init.body !== undefined &&
      !(init.body instanceof FormData) &&
      !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(buildApiUrl(apiRoot, path), {
    ...init,
    headers,
    redirect: 'error',
  })

  if (!response.ok) {
    throw await readFieldTwinError(response)
  }
  return response
}

async function readFieldTwinError(response) {
  const contentType = response.headers.get('content-type') || ''
  let details
  if (contentType.includes('application/json')) {
    details = await response.json().catch(() => null)
  } else {
    details = await response.text().catch(() => '')
  }

  const message = details && typeof details === 'object'
    ? details.message ||
      (typeof details.error === 'string' ? details.error : null) ||
      `FieldTwin API returned ${response.status}`
    : details || `FieldTwin API returned ${response.status}`
  const error = new Error(message)
  error.status = response.status
  error.retryAfter = response.headers.get('retry-after')
  error.details = details
  return error
}
```

Do not set `Content-Type` for `FormData`; the browser must add the multipart boundary. An endpoint
that returns SVG, a file, or an empty body must not be parsed unconditionally as JSON.

## Account routes versus subproject routes

FieldTwin can serve account data from an always-available account API process while dynamically
loading a subproject API process for layout data.

Account-side examples include account configuration, users, projects, workflow tasks, and v2
subproject `summary`, `vendorAttributes`, and `viewOnlies`. Subproject-side examples include layout
resources, geometry, height samples, crossings, and schematics.

Consequences:

- `APIServerIsReady` and `apiPodIsReady` matter for subproject work, not every account call;
- the first subproject call can take time while its data is loaded;
- a v2 `GET /subProjects/{id}/summary` is intentionally cheaper than loading the complete layout;
- readiness is not authorization and does not make a previously rejected credential valid.

## Readiness and bounded retry

Use host lifecycle signals first. When the API returns `503`, honor `Retry-After` when present and
retry with a bounded delay plus jitter. Stop on teardown, navigation to a different project, or a
new bootstrap session.

```javascript
async function waitForReady(operation, { attempts = 6, signal } = {}) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation()
    } catch (error) {
      if (error.status !== 503 || attempt === attempts - 1) {
        throw error
      }

      const retrySeconds = Number.parseInt(error.retryAfter || '0', 10)
      const baseDelay = retrySeconds > 0 ? retrySeconds * 1000 : 500 * 2 ** attempt
      const delay = Math.min(baseDelay, 10_000) + Math.floor(Math.random() * 200)
      await new Promise((resolve, reject) => {
        let timer

        function abort() {
          clearTimeout(timer)
          reject(signal.reason || new DOMException('Aborted', 'AbortError'))
        }

        if (signal?.aborted) {
          abort()
          return
        }

        timer = setTimeout(() => {
          signal?.removeEventListener('abort', abort)
          resolve()
        }, delay)
        signal?.addEventListener('abort', abort, { once: true })
      })
    }
  }
}
```

Only automatically retry reads. A timed-out POST may have committed even when the response was
lost. No generally available request idempotency key is documented, and `ft-batch-id` is a response
correlation header, not an idempotency key. Reconcile state before retrying a create.

## Status and error handling

Handle status codes by meaning, not by parsing one exact message:

| Status | Meaning and client action |
| --- | --- |
| `200` | Success. The body may be JSON, another media type, or empty depending on the endpoint. |
| `400` | Invalid query/path option, including an unknown v2 `resourceTypes` value. Fix the request. |
| `401` | Missing, expired, malformed, or unacceptable credential. Await refresh or reconnect. |
| `403` | Authenticated but not allowed by account/project/type rights or license. Do not retry unchanged. |
| `404` | Route or resource not found. Check version, casing, scope, and ID. |
| `409` | State conflict. Refresh the relevant data before deciding whether to retry. |
| `410` | API version discontinued. Move to a live version advertised by the tenant. |
| `421` | The requested subproject is not loaded by that directly addressed API process. Use the public backend/gateway URL. |
| `422` | Payload or domain validation failed, or required subproject data could not be prepared. Show actionable validation details. |
| `500` | Unexpected server failure. Report a sanitized correlation/context and allow a manual retry. |
| `501` | Operation or resource shape is not implemented for this version. Use the live docs to choose an alternative. |
| `502` | A dependent FieldTwin instance/service failed, for example an external-parent summary. Do not use a partial result. |
| `503` | API or subproject data is not ready. Honor `Retry-After` with bounded retry. |

Production JSON errors normally expose `message` and may expose an `errors` array. Development
responses can contain more detail; never make production behavior depend on it. Proxy failures can
also use `{ status, message }`.

## Response-shaping headers

Only send an option when its endpoint documents it. Header names are case-insensitive; values and
presence rules are endpoint-specific.

| Header | Meaning |
| --- | --- |
| `sample-every` | Sample intermediary geometry every N units; minimum 0.1 where supported. |
| `simplify` | `true` simplifies returned line geometry. |
| `simplify-tolerance` | Numeric simplification tolerance. |
| `raw-intermediary` | `true` returns raw intermediary points. |
| `no-intermediary` | `true` omits intermediary points. |
| `no-metadata` | `true` omits calculated metadata. |
| `no-foreign` | `true` excludes foreign/linked subprojects. |
| `only-active` | Presence requests active resources only. |
| `basic` | `true` requests a reduced response where supported. |
| `include-visibility-settings` | `true` includes per-subproject user visibility settings. |
| `flat` | For hierarchy, defaults to flat; send `false` for a nested tree. |
| `use-depth` | For crossings, `true` includes depth in the calculation. |
| `depth-tolerance` | Crossing depth tolerance; documented default 0.01. |
| `use-foreign-connections` | Crossings include foreign connections unless set to `false`. |
| `cluster-distance` | Crossing point clustering distance; documented default 1. |
| `stream` | For crossings, `true` selects the chunked progress response. |

Other internal or legacy headers exist. Do not discover them by trial and treat them as public.
Use the live endpoint documentation for the exact allowed subset.

## Validation checklist

- Test against the same backend URL and API version sent by the target tenant.
- Confirm the current token is used after `tokenRefresh`.
- Confirm the token cannot leave the configured API root through a crafted relative path.
- Exercise one allowed and one forbidden operation with the integration user's real role.
- Exercise not-ready behavior and cancellation.
- Parse JSON, empty, SVG/file, and streaming responses according to `Content-Type`.
- Test qualified subproject IDs for the main stream and a non-main branch.
- Verify batch creation IDs and then read the created resources back.
- Confirm validation failures do not cause an automatic POST retry.
- Use only fictional data in public tests and documentation.
