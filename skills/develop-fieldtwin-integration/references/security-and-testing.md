# Security and testing

Treat a FieldTwin integration as a separate web application crossing two trust boundaries: browser messaging with the FieldTwin host and authenticated HTTP calls to the FieldTwin API. Secure both boundaries independently and test the observable protocol rather than relying on implementation details.

Read [documentation-map.md](documentation-map.md) before using this guide. Deployed, released FieldTwin documentation takes precedence over these portable examples.

## Security model

### Pin the host window and origin

Configure the exact origins that are allowed to host the integration. Require HTTPS except in an
explicitly selected local HTTP deployment. That local exception must still name the actual exact
FieldTwin parent origin and must never accept arbitrary HTTP origins. During bootstrap, accept
`loaded` only when both conditions hold:

1. `event.origin` is an exact member of the configured allowlist.
2. `event.source` is the expected `window.parent` for an iframe or `window.opener` for a pop-out.

After bootstrap, pin that source window and origin. Accept later messages only when both still match, and send every reply to the pinned origin. Origin substring, suffix, and regular-expression matches are unsafe because an attacker can register a look-alike hostname. A wildcard target origin is also inappropriate for authenticated or project-scoped messages.

If an integration is deployed to more than one FieldTwin environment, inject the allowlist through deployment configuration. Do not infer an allowed origin from an arbitrary query parameter or from the first message received.

Drive both the application URL scheme and the bridge's HTTP exception from the same deployment TLS
mode. A local application at `http://integration.local.example` embedded by
`http://fieldtwin.local.example` needs the latter exact origin in its allowlist. A production or
shared deployment must reject that HTTP entry even if it is accidentally configured.

Apply the same exact allowlist to the HTTPS page response's CSP `frame-ancestors` directive. Do not
send `X-Frame-Options: DENY` or `SAMEORIGIN`. If the deployment explicitly selects HTTP-only local
development, the child response may omit `frame-ancestors`; this does not relax the bridge checks
above and must not be enabled for shared or production deployments.

### Keep the document response compatible with pop-outs

FieldTwin and the integration are normally cross-origin. The popped-out integration therefore
needs to remain in a browsing-context group that retains its opener. On the integration document,
omit `Cross-Origin-Opener-Policy` or set it to `unsafe-none`. Do not use `same-origin` or
`noopener-allow-popups`, and do not enable cross-origin isolation with an opener-isolating COOP plus
`Cross-Origin-Embedder-Policy`. If the integration genuinely requires cross-origin isolation, the
opener-based bridge protocol needs an architectural change rather than a header workaround.

The opener's effective policy matters too. FieldTwin may use `unsafe-none` or a compatible
`same-origin-allow-popups` policy when opening an `unsafe-none` integration, but `same-origin`
severs an external opener relationship. Validate both final HTML responses rather than assuming
the integration server alone controls the result.

`X-IFrame-Allow` and `X-Frame-Allow` are not standard response headers, and browsers do not use
them to permit an iframe or preserve `window.opener`. Likewise, the standard iframe `allow`
attribute and `Permissions-Policy` control capabilities such as clipboard access. Keep those
concepts separate from CSP `frame-ancestors`, `X-Frame-Options`, and COOP.

### Keep credentials ephemeral

- Keep the integration JWT in instance memory only.
- Start bootstrap capture before framework mount. If a later bridge needs a handoff, keep at most a
  small bounded number of `loaded` candidates in a module closure, never on a global or serializable
  store. Drain them through the normal trust boundary and erase them immediately.
- For SvelteKit, install that closure-private capture from a parser-time module in `app.html`.
  `hooks.client` is asynchronously imported and is not sufficient to win the iframe-load race.
- Replace it atomically on `tokenRefresh`.
- Build the `Authorization` header when each API request starts so it uses the current token.
- Never place the JWT in a URL, browser storage, DOM attribute, log, analytics event, error report, screenshot, or repository.
- Clear the in-memory reference during teardown and cancel requests that no longer belong to the active integration instance.

For server-rendered dynamic pages, verify the JWT signature, expiry, stable subject and tenant
claims, and every constraint supported by the issuer profile before using any claim. Modern JWKS
profiles must pin issuer, audience, and algorithm. Legacy FieldTwin integration tokens may omit
issuer and audience; support them only through an explicit public-key profile that pins the exact
key endpoint and returned algorithm. Merely decoding the JWT is not authentication.

### Validate every external message

The message event is untrusted input even after its origin and source are accepted. Validate at the boundary:

- require a plain structured-cloneable object and a known `event` string;
- validate required fields, limits, identifiers, and nested shapes for that event;
- reject or ignore unknown events without executing values from the payload;
- keep top-level fields and `data` fields in the exact location documented for the event;
- correlate replies only through documented fields such as `queryId` and `reqId`;
- never execute payload strings as JavaScript or use them to construct code.

Validate untrusted URLs before opening or fetching them. Permit only the schemes and destinations required by the feature. Render external text as text. If a documented result field permits markup, sanitize it with the application's established sanitizer. Treat a Font Awesome icon name as an identifier selected from a supported allowlist, not as arbitrary HTML.

### Enforce authorization at the API

`canEdit` helps the integration present the correct UI, but it is not an authorization boundary. Every create, update, and delete request must be authorized by the FieldTwin API using the current bearer token. Scope requests to the project, subproject, and stream received from the trusted bootstrap state; do not accept ownership or scope solely from user-controlled input.

Handle readiness and request failures explicitly. Use bounded retries with cancellation for transient readiness, and present a useful error when a user action fails. Do not retry authorization or validation failures in a loop.

### Minimize exposed data

Send only fields needed by the receiving feature. Avoid embedding personal data or credentials in search-result markup, notifications, analytics, or settings. Namespace persisted settings by integration instance where the protocol requires `customTabId`, and never use settings storage for secrets.

### Tear down completely

An integration may be reloaded, hidden, popped out, or opened more than once. A teardown operation should:

- remove the single message listener;
- abort active HTTP requests;
- reject or clear pending correlated requests;
- clear timeouts, intervals, and retry timers;
- release references to the host window, origin, token, and integration state;
- prevent stale asynchronous work from publishing into a new session.

Make setup and teardown idempotent so framework remounts do not create duplicate listeners.

## Test strategy

Use small unit tests for bridge and validation functions, integration tests for browser-message and API boundaries, and a short manual pass inside an authorized FieldTwin environment. Test the protocol in both directions and assert exact envelopes.

### Bridge unit tests

Cover at least these cases:

| Case | Expected result |
| --- | --- |
| `loaded` from the configured origin and expected parent | Bootstrap state is stored and the host is pinned |
| Valid `loaded` posted before framework mount | The early candidate is drained once through normal validation and bootstrap completes |
| SvelteKit parent posts from iframe `load` before dynamic client imports | Parser-time capture retains the candidate and the page advances |
| Early `loaded` from a wrong origin or source | The queued candidate is rejected and a later trusted live message can still bootstrap |
| Account Settings `loaded` without project API fields | Same-origin authenticated calls are available; project API calls fail closed until API context exists |
| Exact local HTTP parent with explicit local mode | Bootstrap succeeds and pins that exact HTTP origin |
| Local HTTP `backendUrl` with explicit local mode | Bootstrap succeeds; the backend base path is preserved |
| HTTP `backendUrl` outside explicit local mode | Bootstrap or API context fails closed |
| HTTP parent without explicit local mode | Configuration or bootstrap fails closed |
| `loaded` from a look-alike or unconfigured origin | Message is rejected and no state is stored |
| Message from the right origin but a different window | Message is rejected |
| Message from the pinned window but a different origin | Message is rejected |
| Valid `tokenRefresh` | The in-memory token is replaced and the next request uses it |
| Malformed or unknown event | No handler side effect occurs |
| Pop-out bootstrap | The opener is pinned instead of the integration's own top-level window |
| Outbound request after pop-out bootstrap | The request is posted to the pinned opener and exact origin, never to `window.parent` or the integration itself |
| Top-level page without a live opener | Bootstrap remains unavailable and outbound sends fail closed |
| Teardown followed by a message | No handler runs and pending work is settled |

Use reserved example domains and synthetic identifiers in fixtures. Never copy a real token or production payload into a test. A useful harness constructs message events with explicit `origin`, `source`, and `data`, then observes only public callbacks and outbound messages.

Also assert that the early queue is bounded, removed after handoff or construction failure, and not
reachable through public context, globals, storage, logs, or serialized framework state.

### HTTP response and browser tests

Fetch the integration document through every deployed ingress/proxy path and assert:

- HTTPS CSP contains the exact expected `frame-ancestors` origins;
- `X-Frame-Options` is absent;
- enforced `Cross-Origin-Opener-Policy` is absent or exactly `unsafe-none`, with no duplicate or
  comma-merged conflicting value;
- no CSP `sandbox` makes the document opaque-origin or blocks its scripts; and
- the test does not count `X-IFrame-Allow` or `X-Frame-Allow` as evidence of compatibility.

Then run a browser test from the real FieldTwin host. Exercise embedded load, FieldTwin's pop-out
action, `window.opener` retention, trusted `loaded`, one integration-to-host request, one
host-to-integration event, close/teardown, and reopening. Repeat against the built production
server through ingress; a framework development server is not representative when proxies or
security middleware mutate headers.

### API tests

Stub the network boundary and assert:

- the URL is derived from trusted bootstrap scope;
- the current token is read at request time;
- authorization, validation, not-found, readiness, and server errors are distinguished;
- an aborted or stale request cannot update the active UI;
- write controls honor `canEdit`, while the server remains the final authority;
- user-triggered failures produce a recoverable user-facing result without exposing credentials.

For a dynamic page endpoint, add server-side tests for a missing token, invalid signature, wrong issuer or audience, expired token, insufficient rights, and the valid least-privilege case.

For provider administration, test the exact safe GET shape and assert that no secret, token,
placeholder, account ID, credential reference, vault reference, or internal webhook key as a
separate field can appear. The derived full account-keyed webhook URL is expected safe-to-display
routing metadata; assert that possession of it never bypasses signature/token verification. Require
account-administrator authorization before store or vault access. Test PATCH create, omitted and
raw-length-zero secret preservation, nonempty whitespace-only rejection, one dirty secret merged
with untouched server values, and an unchanged opaque replacement as a complete no-op. For every
secret, prove the server never trims, case-folds, or Unicode-normalizes it and compares only exact
provider-defined canonical bytes through a constant-time primitive or constant-time digest. Test
stale revision with no mutation, strict unknown/whitespace-only/oversize rejection, and secret-free
errors. Inspect persisted JSON to prove it holds only public metadata, booleans, routing metadata,
and opaque references.

For provider connections, test configuration readiness before state mutation. Missing session,
tenant OAuth setup, or credential-store configuration must produce a sanitized unavailable
response without creating an intent or cookie. Exercise the full standard GitHub OAuth App flow
with state and S256 PKCE: exchange, authenticated-user validation, bounded repository pagination,
returned scope adequate for the advertised lifecycle (`admin:repo_hook` or `repo` when delete is
required), admin-capability filtering, and server-only user-token storage. Assert
that production uses a `Secure` `__Host-` cookie, an explicitly selected HTTP-only local mode uses a
distinct non-`__Host` non-Secure cookie, and request scheme cannot choose between them. Verify
state replay rejection, provider-configuration revision drift, opaque-only control-plane
persistence, vault failure, repository-hook create/reconcile/rotate/delete, callback teardown, and
the distinct `X-Hub-Signature-256` raw-body HMAC. A test with a valid GitLab signature construction
must not pass GitHub verification.

Exercise the GitLab flow independently. Reject every provider URL except `https://gitlab.com` or an
exact deployment-allowlisted HTTPS self-managed origin, including HTTP, userinfo, subpaths,
look-alike hosts, and redirect escapes. Test one-time state, S256 PKCE, authenticated-user
validation, exact `api read_repository` grant validation, bounded project pagination with
Maintainer-or-Owner access, and re-authorization checks before hook mutation. Prove that access and
refresh tokens, expiry, scopes, origin, and user identity are vaulted as one versioned bundle.
Exercise concurrent refresh, compare-and-swap loss, storage failure after exchange, expiry, and
revocation; assert that a worker which loses the pre-exchange single-flight claim never calls the
token endpoint. No result may expose a new access token with an old refresh token or activate a
non-durable pair.

For webhooks, route by a stable random account/provider key, resolve exactly one configuration,
decrypt only its secret, authenticate the bounded provider-specific envelope, and resolve
applications only inside that account. Test unknown/wrong routes, cross-account repository/project
IDs, signature failure, duplicate delivery, and that global secret scanning or payload-selected
account scope is impossible. Keep provider verifiers separate:

- GitHub requires a constant-time `X-Hub-Signature-256` HMAC over the unchanged raw body.
- `gitlab-standard-webhooks-v1` requires the configured `whsec_` signing key, the Standard Webhooks
  `webhook-id`, `webhook-timestamp`, and `webhook-signature` construction, bounded clock skew,
  delivery replay rejection, and constant-time comparison of all `v1` signature candidates.
- `gitlab-legacy-x-gitlab-token-v1` requires an exact constant-time comparison of the plaintext
  `X-Gitlab-Token`; it is not raw-body HMAC. Test that the persisted profile is explicitly selected
  from verified instance capability and cannot downgrade because a signature header is absent.

Test the complete managed-hook lifecycle for both providers: idempotent create/reconcile, stored
provider hook IDs, no adoption of unrelated hooks, secret/profile/URL rotation with a bounded
old/new verification overlap, and provider-side deletion before unwatch or disconnect discards the
credential. Simulate insufficient scope, lost role, revoked token, partial multi-hook rotation, and
delete failure. Each failure must disable unsafe local processing, preserve retryable non-secret
cleanup state, and report manual remediation rather than silently orphaning a hook.

If an explicit encrypted file credential store exists for single-node development, test reload,
wrong key, tampering, reference swapping, symlink/path attacks, bounds, file permissions, atomic
no-overwrite creation, aborts, and absence of plaintext credentials or identifiers at rest. Keep the
external HTTPS vault as the default profile.

### Message contract tests

For every supported event, assert the exact event name and whether each field is top-level or nested under `data`. Include correlation identifiers only where the released protocol defines them. Exercise multiple integration instances so a result, filter, panel request, or reply cannot cross instance boundaries.

When adding or changing a protocol event, test both the producing and consuming side. Retain a compatibility test for any legacy field or behavior that remains supported.

### Operation Mode tests

Operation Mode interactions need separate assertions because selection, focus, and integration actions have different intent:

- a normal result-row click performs the documented selection behavior without moving the camera;
- a double-click emits `operationSearchDoubleClick` once with the stable result ID and configured action arguments;
- an inline Font Awesome button emits `operationSearchAction` and does not also trigger the row interaction;
- keyboard activation matches the documented click or action behavior;
- explicit focus sends the focus message, while selection-only paths do not;
- clearing a query clears results and finishes or clears progress;
- category, tag, and nested-item IDs remain stable across updates;
- markup and labels containing hostile input are rendered safely;
- filter toggles and time-series replies return only to the originating integration instance;
- a late progress or time-series response from a disposed instance is ignored.

### Manual verification

Before release, verify the integration in an authorized test environment:

1. Inspect the integration page through ingress: HTTPS has exact `frame-ancestors`, explicit local
   HTTP has no child iframe-denial header, and neither emits blocking `X-Frame-Options`. Then load it
   in an iframe and, when supported, a pop-out.
2. Confirm refresh and remount do not duplicate messages.
3. Confirm a token refresh is used without reloading the integration.
4. Exercise read and permitted write calls, readiness, and one recoverable failure.
5. Exercise ordinary selection, explicit focus, inline actions, double-click, query clearing, filters, panels, and time series that the integration supports.
6. Inspect browser storage, URLs, console output, and network-error UI for credential leakage.
7. Close the integration and confirm listeners, requests, and timers stop.

If embedding still fails, classify the browser console error before editing policy. A FieldTwin
parent `frame-src` error needs a host configuration change. An HTTPS-parent/HTTP-child mixed-content
error needs HTTPS, an approved proxy, or an explicit local-only browser exception; child CORS and
`frame-ancestors` changes cannot bypass it.

## Public sample and release checklist

Before publishing integration code or this skill package:

- use only fictional `.example` hosts, synthetic IDs, and placeholder credentials in samples;
- remove organization-specific paths, unreleased event names, private endpoints, captured payloads, and internal architecture notes;
- confirm every local documentation link resolves;
- confirm skill metadata and changelog versions agree;
- run `python3 scripts/validate_package.py` from the package root;
- review generated package contents, not only the source directory;
- document the supported FieldTwin release or the date public documentation was last verified.

The package validator catches common publication mistakes, but it does not replace code review, threat modeling, or testing against the released FieldTwin contract.
