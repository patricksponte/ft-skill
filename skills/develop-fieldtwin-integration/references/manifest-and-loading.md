# Manifest, loading, dynamic pages, and pop-outs

Use a manifest when administrators should be able to import an integration configuration from a
stable endpoint. Require HTTPS for shared and production environments; an explicit local
development mode may use HTTP. An integration may expose a single static page, dynamic pages,
background behavior, or a combination.

## Static manifest example

Serve a JSON response from the environment's configured public origin:

```json
{
  "name": "Equipment Insights",
  "url": "https://integration.example/app",
  "logo": "https://integration.example/assets/logo.png",
  "tabPosition": "property-panel",
  "showInDesigner": true,
  "showInOperation": true,
  "resourceTypes": ["stagedAssets"],
  "projectWideAccess": false,
  "allowAccessToClipboard": false,
  "allowPopout": true
}
```

Common fields:

| Field | Meaning |
| --- | --- |
| `name` | Required display name. |
| `url` | Main integration entry point. It may be omitted when visible pages come entirely from `dynamicPagesUrl`. |
| `logo` | HTTPS URL for the integration logo. |
| `tabPosition` | `bottom`, `property-panel`, `hidden`, `global`, or `main-toolbar-dialog`. |
| `showInDesigner` | Availability outside Operation Mode, including Designer and Presenter. Defaults to `true`. |
| `showInOperation` | Availability in Operation Mode. Defaults to `true`. |
| `resourceTypes` | Resource types relevant to a property-panel integration. |
| `projectWideAccess` | Requests project-wide API scope when the administrator allows it. Prefer least privilege. |
| `projectAllFromUser` | Requests access across user-visible projects. Use only when the workflow genuinely needs it. |
| `allowAccessToClipboard` | Enables iframe clipboard permission. Keep `false` unless required. |
| `allowPopout` | Allows a panel to become a separate top-level window. |
| `useGET` | Loads the integration with GET instead of the default POST flow. |
| `noURLParams` | With GET loading, avoids placing bootstrap fields in the URL; initialize from `loaded` instead. |
| `dynamicPagesUrl` | HTTPS endpoint returning dynamic page descriptors. |
| `runInBackground` | Loads a hidden background copy of the parent integration. |
| `backgroundUrl` | Optional page for the hidden copy; otherwise `url` is used. |
| `doNotUseSubprojectApiEndpoints` | Indicates the integration does not depend on subproject API readiness. |
| `projectSettingsUrl` | Optional project-settings page. |
| `accountSettingsUrl` | Optional account-settings page. |

Request the narrowest access and browser permissions possible. Manifest flags are not substitutes for backend authorization.

## Cross-origin endpoint requirements

FieldTwin Admin normally imports the manifest from a different browser origin. Serve the public,
credential-free manifest with `GET` and `OPTIONS`, `Content-Type: application/json`, and
`Access-Control-Allow-Origin: *`. Allow `GET, OPTIONS` and any importer request headers the endpoint
actually needs. If a manifest response is credentialed, do not use wildcard origin; validate and
echo an exact configured origin instead.

Build `url`, `logo`, `dynamicPagesUrl`, settings URLs, callbacks, and webhook URLs from one exact
public application origin. The origin scheme must follow the deployment mode: an explicitly
HTTP-only local ingress produces HTTP URLs, while shared and production deployments require HTTPS.
Do not hard-code HTTPS in the manifest when the development ingress serves only HTTP.

When the browser calls `dynamicPagesUrl`, handle preflight separately because this endpoint carries
an integration JWT. Allow `POST, OPTIONS` and explicitly allow `Authorization, Content-Type`. Echo
only a configured exact FieldTwin frontend origin and include `Vary: Origin`. Do not enable browser
credentials unless the released contract requires cookies.

Test manifest GET/preflight and dynamic-page preflight through the production server and deployed
ingress using real `Origin` headers. Development-server CORS is not evidence that the built server
or ingress preserves these headers. Keep CORS separate from CSP `frame-ancestors`: CORS governs
cross-origin HTTP reads, while `frame-ancestors` governs iframe embedding.

## Iframe response policy

For HTTPS, shared, and production deployments, send `Content-Security-Policy: frame-ancestors`
with only the configured exact FieldTwin frontend origins. Do not send `X-Frame-Options: DENY` or
`SAMEORIGIN`, because the integration is intentionally embedded cross-origin. Fail closed if the
production allowlist is absent or invalid.

An explicitly enabled HTTP-only local mode may omit `frame-ancestors` from the child response to
match the standard local Kubernetes workflow. Keep the remaining CSP directives and keep exact
origin/source validation in the postMessage bridge. Never infer this relaxation from the request
host or scheme; enable it only through the same deployment flag that selects local HTTP URLs.

Browser errors identify the owning layer:

- `frame-ancestors` and `X-Frame-Options` on the child response are controlled by the integration;
- `frame-src` on the parent response is controlled by FieldTwin;
- HTTPS-parent/HTTP-child mixed-content blocking is controlled by the browser and cannot be fixed
  by CORS or by relaxing the child's CSP. Use local HTTPS, an approved proxy, or an explicit
  local-only browser exception.

Inspect the final page response through ingress in both local and HTTPS modes, and complete one
real iframe load. A direct top-level page load does not validate iframe permission.

## Dynamic pages

Set `dynamicPagesUrl` when the visible tabs depend on user permissions, external configuration, or available workflows. The endpoint accepts an authenticated POST and returns a JSON array.

```json
[
  {
    "title": "Overview",
    "iframeUrl": "https://integration.example/pages/overview",
    "path": "overview",
    "tabPosition": "bottom",
    "showInDesigner": true,
    "showInOperation": true
  },
  {
    "title": "Maintenance",
    "iframeUrl": "https://integration.example/pages/maintenance",
    "path": "maintenance"
  }
]
```

Page fields:

| Field | Required | Meaning |
| --- | --- | --- |
| `title` | Yes | Tab label. |
| `iframeUrl` | Yes | Full HTTPS page URL. |
| `path` | No | Stable page identity. When omitted, FieldTwin can generate an order-based path such as `page-1`. Explicit stable paths are preferable. |
| `tabPosition` | No | Page override, then manifest value, then `bottom`. |
| `showInDesigner` | No | Page override, then manifest value, then `true`. |
| `showInOperation` | No | Page override, then manifest value, then `true`. |

The endpoint receives `Authorization: Bearer <integration JWT>`. Verify the JWT before using claims to choose pages. Never put the JWT or personal identifiers into `iframeUrl` query parameters.

```javascript
app.post('/fieldtwin/dynamic-pages', async (request, response) => {
  const token = readBearerToken(request.headers.authorization)
  if (!token) {
    response.status(401).json({ error: 'Missing authorization' })
    return
  }

  const claims = await verifyFieldTwinJwt(token)
  const pages = buildAuthorizedPages(claims)
  response.json(pages)
})
```

`verifyFieldTwinJwt` must validate signature, issuer/audience when specified for the deployment, and expiry. A decode-only helper is not authorization.

## Parent and dynamic-page behavior

Dynamic pages replace the visible default tab, but the parent definition can still control headless/background behavior:

- `runInBackground: true` loads a hidden parent instance.
- `backgroundUrl` selects the hidden page; otherwise the parent `url` is used.
- `hidden` and `global` parents can remain headless even when they provide visible dynamic pages.
- Use explicit `path` values when another integration will call `openOperationPanel` for a page.

## Bootstrap loading

FieldTwin can initially load an integration by POST or GET depending on configuration. Modern single-page integrations should treat the trusted host-sent `loaded` message as their runtime bootstrap because the same message path works for iframe reloads and pop-outs.

FieldTwin does not wait for a client readiness event before posting `loaded`. Register a minimal
message receiver before the document-load boundary, before framework mount or hydration. A
listener created only in a route/component lifecycle hook—or in SvelteKit's asynchronously imported
`hooks.client`—can lose the one bootstrap message and leave the page permanently waiting. For
SvelteKit, load a parser-time capture module from `app.html` before `%sveltekit.body%`.

If the full bridge cannot be created that early, capture only bounded `loaded` candidates in a
module-private closure. The bridge must attach its normal listener before removing the temporary
listener, drain each candidate through the same exact-origin, expected-source, and payload
validation, and erase the queue. Never expose the candidate or token through `window`, framework
stores, browser storage, the DOM, logs, or hydration data.

Do not render a token, copy it into page state that devtools serializes, or echo it into HTML. Keep only the fields the integration needs.

Typical `loaded` fields include:

| Field | Use |
| --- | --- |
| `token` | Current JWT for API requests; memory only. |
| `backendUrl` | API base supplied by the host. |
| `APIVersion` | API version such as `v1.10`. |
| `project`, `subProject`, `stream` | Current FieldTwin scope. |
| `customTabId` | Integration-instance identity. |
| `canEdit` | UI capability hint; backend rights still apply. |
| `APIServerIsReady` | Whether subproject API calls can start. |
| `selection` | Current selection snapshot. |
| `cssUrl`, `cssThemeUrl` | Optional host styling context. |
| `sessionId` | Current integration instance session. |

Treat any additional user or project fields as sensitive and retain them only when the integration workflow requires them.

The payload depends on the FieldTwin surface. A project page may need `backendUrl`, `APIVersion`,
project, subproject, and readiness before it can call the FieldTwin API. Account Settings is
account-scoped and may omit those project API fields. Accept a trusted Account Settings bootstrap
when the token and the fields that page actually needs are valid; allow same-origin authenticated
control-plane calls, and make the FieldTwin API helper fail explicitly until backend/API context is
present. Do not reject the entire bootstrap merely because an unused project field is absent.
When `backendUrl` is present, accept HTTP only in explicit local mode and preserve a supplied base
path such as `/backend` when constructing FieldTwin API URLs.

## Pop-out windows

With `allowPopout: true`, the same page can run in two topologies:

| State | Host window |
| --- | --- |
| Embedded iframe | `window.parent`, with `window.parent !== window` |
| Popped-out top-level window | `window.opener`, with `window.parent === window` |

Do not choose a target window independently for every message after bootstrap. Accept `loaded` only from an expected parent/opener, then pin the exact `event.source` and `event.origin`. Use that stored pair until teardown or a full re-bootstrap.

`postMessage` remains the transport in both states. What fails in a pop-out is an iframe-only
sender such as `window.parent.postMessage(...)`: the pop-out is top-level, so its parent is itself.
Send through the bridge's pinned host window, which is the opener for the pop-out. FieldTwin must
retain that opener relationship; a direct navigation, `noopener`, or an incompatible
`Cross-Origin-Opener-Policy` leaves no trusted host and must fail closed.

The integration HTTP server and every response-mutating deployment layer participate in this
contract. On the integration document, omit `Cross-Origin-Opener-Policy` or send `unsafe-none`.
Do not let a generic security preset inject `same-origin` or `noopener-allow-popups`. Keep the HTTPS
`frame-ancestors` allowlist and omit blocking `X-Frame-Options` for iframe mode; these framing
controls do not preserve the opener. `X-IFrame-Allow` and `X-Frame-Allow` are non-standard and have
no browser-defined role here, while the iframe `allow` attribute and `Permissions-Policy` control
individual capabilities rather than framing or opener access.

When the host sends `operationPaneClosed`, stop polling and release work tied to panel visibility. Unmounting the integration should also remove listeners and cancel timers, requests, and pending reply promises.
