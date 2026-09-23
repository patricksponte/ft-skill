# Quick start, Hello World, and hosting

Use this reference for a first integration, a demo, or when a user needs to prove that FieldTwin
can reach their page before building anything. It covers the single-page shape only. Everything in
`develop-fieldtwin-integration` still applies; the Hello World is built on that skill's bridge.

## 1. Start from the Hello World

[assets/hello-world/index.html](../assets/hello-world/index.html) is one self-contained page with
three tabs:

| Tab | Shows |
| --- | --- |
| Session | Trusted `loaded` fields (token omitted), the pinned host origin, live events, and the current selection |
| API Test | Real v1.10 reads for staged assets, wells, connections, shapes, and metadata definitions, plus a test toast |
| Troubleshoot | Nine checks, each with a fix, including the origin of any rejected `loaded` message |

Copy it into the user's project as `index.html`, then change the one setting at the top:

```javascript
const ALLOWED_FIELDTWIN_ORIGINS = [
  'https://fieldtwin.example',   // replace with the user's FieldTwin address
]
```

Ask the user for the address they see in the browser while FieldTwin is open, and keep only the
origin: scheme, host, and port, with no path or trailing slash. If they are unsure, deploy the page
once and open it in FieldTwin. The page rejects the unknown origin and displays it, so the user can
confirm it is theirs and add it. Never widen the check to a wildcard, a suffix match, or
`document.referrer` to make the page connect.

When the Hello World shows **Connected**, build the requested feature in the same `index.html`,
keeping the bridge. Do not leave the Hello World beside a second page.

## 2. Register the page in FieldTwin

In **Admin → Integrations → Create New Tab**:

1. Enter a name and the page URL.
2. Enable **Use GET verb instead of POST** and **Do not pass arguments in URL for GET**. A static host
   answers FieldTwin's default POST with 405, and the page initializes from `loaded`, so no bootstrap
   data belongs in the URL. In a manifest these are `useGET: true` and `noURLParams: true`.
3. Request the least access the feature needs. Leave project-wide access off unless the integration
   must read other subprojects.
4. Save and open the tab. A success toast appears in FieldTwin.

## 3. Choose where to host it

FieldTwin runs over HTTPS, so browsers block an embedded `http://` page as mixed content.

| Situation | Hosting | Notes |
| --- | --- | --- |
| Hello World, demo, or single-page integration | GitHub Pages or another HTTPS static host | Permanent URL, works from restricted networks. Prefer a host that can set `Content-Security-Policy: frame-ancestors` with the exact FieldTwin origins. |
| Active development on one machine | `npx serve .` or `python3 -m http.server 3000` on `http://localhost` | Requires a local-only browser exception: in Chrome, FieldTwin → site settings → **Insecure content: Allow**. Revert it afterwards; never ask teammates or customers to do this. |
| Sharing work in progress | An HTTPS tunnel such as `ngrok http 3000` | The tunnel URL is public while it runs, so serve only the page, not a directory with secrets. Free URLs change on restart; update the integration URL. |
| A backend, secrets, OAuth, webhooks, or persistence | Promote to the full repository shape | Follow sections 1-7 of the create skill. |

The allowlist in the page is the trust boundary on every row. A host that cannot set headers lets
anyone embed the page, and the exact origin and source checks are what keep it safe.

## 4. Diagnose a page that will not connect

| Symptom | Cause | Fix |
| --- | --- | --- |
| Blank panel, console mentions mixed content | HTTPS FieldTwin loading an `http://` page | Host over HTTPS, or use the local-only browser exception |
| Console mentions `frame-ancestors` or `X-Frame-Options` | The page's server forbids embedding | Allow the exact FieldTwin origins in `frame-ancestors`; remove `X-Frame-Options: DENY`/`SAMEORIGIN` |
| Console mentions `frame-src` | FieldTwin's own policy does not allow the page's host | A FieldTwin administrator must allow it; the page cannot fix this |
| 405 when the tab opens | FieldTwin POSTs to a static host | Enable **Use GET verb** |
| Stays on "Waiting for FieldTwin" | Page opened standalone, or listener installed too late | Open it from FieldTwin; keep the listener in the first `<head>` script |
| "Connection rejected" with an origin | That origin is not in `ALLOWED_FIELDTWIN_ORIGINS` | If it is the user's FieldTwin, add that exact origin |
| API 404 | Wrong project or subproject in the path | Use `loaded.project` and the qualified `loaded.subProject` unchanged; there is no `-` wildcard |
| API 401 | Token expired | Wait for `tokenRefresh` or reopen the panel |
| API waits forever | `APIServerIsReady` is false | Wait for `apiPodIsReady` |

## 5. Optional local servers

The repository's `templates/node` (Express) and `templates/python` (FastAPI) serve the page from a
`public/` directory and add an API route for code that needs npm or pip packages. They set
`frame-ancestors` from the `FIELDTWIN_ORIGINS` environment variable. A server that holds secrets,
verifies FieldTwin JWTs, or receives webhooks belongs in the full repository shape instead.
