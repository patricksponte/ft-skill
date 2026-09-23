---
name: develop-fieldtwin-integration
description: Develop, run, debug, test, and review FieldTwin external integrations embedded as custom-tab iframes. ALWAYS use for FieldTwin manifests, Account Settings, dynamic pages, local Tilt or Kubernetes integration debugging, HTTP/HTTPS URL generation, HTTP server or ingress response headers, CSP frame-ancestors, X-Frame-Options, X-IFrame-Allow, COOP/COEP, iframe policy, loaded or tokenRefresh lifecycle, FieldTwin JWT verification, REST backend API calls, API attributes or fields, resource schemas, v1.10 or v2.0 routes, OpenAPI, batch CRUD, parent/opener postMessage events, customTabId routing, pop-outs, Operation Mode, integration settings, automation descriptors and attribute webhooks, or protocol tests. Also use for FieldTwin Operation Mode's built-in system highlighting when work involves metadata-backed connection bundles, simultaneous system lanes or colors, per-channel flow direction, graph continuity, or multi-channel connection rendering.
license: ISC
metadata:
  author: FutureOn AS
  version: "0.6.0"
---

# Develop FieldTwin Integrations

Build secure, portable integration clients and protocol changes from released FieldTwin contracts. Keep ordinary selection, camera focus, panel navigation, and integration-defined actions separate so user interactions do not acquire surprising side effects.

## Choose the relevant references

Read the public [integration guide](integration/README.md) and [references/documentation-map.md](references/documentation-map.md) first. For implementation, local development, deployment diagnosis, or an integration that remains stuck loading, read [references/development-workflow.md](references/development-workflow.md) next. Then read only what the task needs:

- [references/development-workflow.md](references/development-workflow.md) for the end-to-end repository, Environment Module, Tilt, Helm, browser, bootstrap, server-authentication, and live-debug checklist.
- [references/manifest-and-loading.md](references/manifest-and-loading.md) for manifests, dynamic pages, background behavior, iframe loading, and pop-outs.
- [references/bridge-and-api.md](references/bridge-and-api.md) for a secure browser bridge, `loaded`, `tokenRefresh`, API calls, replies, and teardown.
- [references/backend-api.md](references/backend-api.md) for API version selection, URL construction, JWT/API-token profiles, authorization, readiness, errors, retries, and response headers.
- [references/backend-api-v1.10.md](references/backend-api-v1.10.md) for the v1.10 account/configuration and project/subproject endpoint catalog.
- [references/backend-api-v2.0.md](references/backend-api-v2.0.md) for normalized stream CRUD, GET envelopes and filters, specialized endpoints, and tenant OpenAPI discovery.
- [references/backend-api-batch.md](references/backend-api-batch.md) for v1.10 and v2.0 POST/PATCH/DELETE batch envelopes, stream ownership, ordering, atomicity boundaries, and recovery.
- [references/api-attributes.md](references/api-attributes.md) whenever the task asks which fields are readable, accepted by POST/PATCH/DELETE, required, nested, read-only, or stream-specific. Use its query script instead of loading the generated catalogs wholesale.
- [references/postmessage-attributes.md](references/postmessage-attributes.md) whenever the task asks which host-client event fields exist, where they are placed, whether they are required, which variant/surface sends them, or how request/reply correlation and pop-out delivery work. Use its query script instead of loading the generated catalog wholesale.
- [references/message-catalog.md](references/message-catalog.md) for common host-to-integration and integration-to-host envelopes, including automation descriptors and attribute update signals.
- [references/integration-to-host-events.md](references/integration-to-host-events.md) for the complete integration-to-host event matrix, canonical resource-type values, accepted aliases, replies, and `getResources` qualified-ID rules.
- [references/operation-mode.md](references/operation-mode.md) for search, progress, inline actions, double-click, filters, context menus, panels, and time series.
- [references/system-highlighting.md](references/system-highlighting.md) when host-side Highlight systems must classify metadata-backed connection bundles, render several service channels on one line, or preserve independent flow directions.
- [references/recipes.md](references/recipes.md) for copy-ready selection, resource-query, settings, notification, focus, and automation-participation recipes.
- [references/security-and-testing.md](references/security-and-testing.md) before implementing message code and before handoff.

When the user's repository also contains an integration guide, read the relevant sections and reconcile them with the current public FieldTwin documentation. A deployed environment's released contract wins over bundled examples. Never infer a new protocol field from naming symmetry.

## Classify the task

Identify which side owns the behavior before editing:

- **Integration client**: consume host events, call the API, render integration UI, publish results or filters, and manage local state.
- **FieldTwin host**: validate, route, render, or execute a documented integration payload.
- **Protocol change**: add or change an event, field, reply, targeting rule, or interaction. Implement every in-scope side, preserve compatible legacy behavior, update public documentation, and add protocol tests.

Trace selection and focus independently. A click may select a resource while a separate explicit action or double-click moves the camera.

Treat the built-in Highlight systems renderer as host behavior, not as an integration message contract. Metadata-backed connection channels must not be smuggled through `visualFilteringUpdate`: visual filters remain integration-owned tag/filter state unless the released protocol explicitly adds a system-channel payload.

## Build the integration in this order

### 1. Establish the trust boundary

- Configure an exact allowlist of approved FieldTwin frontend origins for the target deployment.
- Require HTTPS origins except when the deployment explicitly selects local HTTP mode. In that
  mode, allow only the exact configured HTTP FieldTwin parent origin; do not infer it from the
  message, referrer, request host, or a wildcard.
- Configure the integration page's HTTPS response with CSP `frame-ancestors` for those exact
  origins, and do not emit `X-Frame-Options: DENY` or `SAMEORIGIN`. An explicitly enabled local HTTP
  mode may omit only the child `frame-ancestors` restriction; keep message origin/source checks.
- Make the effective integration-document response compatible with pop-outs. Omit
  `Cross-Origin-Opener-Policy` or set it to `unsafe-none`; generic security middleware, ingress, or
  CDN rules must not replace it with `same-origin` or `noopener-allow-popups`, which can sever the
  cross-origin opener used by the bridge. Inspect both the FieldTwin opener response and the final
  integration response through ingress.
- Do not rely on `X-IFrame-Allow` or `X-Frame-Allow`. They are not standard browser response
  headers. The iframe `allow` attribute and `Permissions-Policy` grant individual capabilities;
  they do not permit embedding or preserve a pop-out opener.
- Accept the initial `loaded` message only from an expected `window.parent` or `window.opener` and an allowlisted exact origin.
- Pin both `event.source` and `event.origin` after bootstrap; reject later messages that do not match both.
- Send only to the pinned host window and exact origin. Never use `*` for credentials, project data, or normal production messages.
- Never let feature code send with `window.parent.postMessage(...)`. In a pop-out, `window.parent`
  is the integration window itself. Route every integration-to-host message through the bridge so
  the pinned iframe parent or pop-out opener is used consistently.

### 2. Keep bootstrap state durable and private

- Initialize from the host-sent `loaded` event.
- Register a minimal message receiver before the document-load boundary. FieldTwin does not wait
  for an integration readiness handshake, so a listener installed only from `onMount`,
  `useEffect`, or an asynchronously imported SvelteKit `hooks.client` can miss the one bootstrap
  event. In SvelteKit, install a parser-time capture module from `app.html` before the body.
- When framework setup and the bridge are separate, hand early `loaded` candidates through a
  bounded module-closure queue. Add the bridge listener before draining it, validate every queued
  event through the normal exact-origin/source/payload boundary, then clear the queue.
- Keep the JWT in instance memory. Do not place it in URLs, browser storage, DOM, logs, analytics, errors, or source control.
- Replace the token atomically on `tokenRefresh`; build request headers at call time so future calls use the current token.
- Validate the fields required by the current page instead of assuming every surface has project
  API context. Account Settings can receive a token without `backendUrl`, `APIVersion`, project,
  subproject, or stream; accept that bootstrap for same-origin authenticated control-plane calls
  and fail API helpers explicitly until their API context exists.
- Apply the same explicit TLS/local-development scheme policy to a supplied `backendUrl`. Accept
  exact HTTP only in local mode and preserve any backend base path; never discard `/backend` by
  reducing the trusted URL to its origin.
- Use `window.opener` in a pop-out and `window.parent` in an iframe through one pinned bridge abstraction.
- Treat a top-level integration without a live `window.opener` as unbootstrapped. A direct page
  visit or a popup opened with `noopener` cannot establish the FieldTwin message bridge.
- Remove listeners and cancel pending work during teardown.

### 3. Call the FieldTwin API deliberately

- When the page calls the FieldTwin project API, derive `backendUrl`, `APIVersion`, project scope,
  and the current token from trusted bootstrap state.
- Send `Authorization: Bearer <token>` and let the API enforce resource rights.
- Preserve a backend base path and keep relative paths inside the selected `/API/{version}/` root.
- Use the host-supplied version by default. Verify the tenant's live OpenAPI before opting into
  v2.0; do not silently translate a v1.10 route or payload into v2.
- Before constructing or reviewing a payload, query `references/api-attributes.md` for the exact
  version, operation, stream, resource type, and method. Never assume that a GET field is writable,
  that PATCH equals optional POST, or that one v2 stream accepts another stream's resource shape.
- In v1.10, qualify subproject branches as `{subProject}:{stream}` and use the dedicated resource
  or explicit `/batch` contract. In v2.0, choose one users/account/project/subproject/workflow
  stream and use its normalized type-keyed CRUD envelope.
- Keep each mutation batch in one stream, create parents before dependent children, and reconcile
  after an ambiguous network failure instead of blindly retrying POST.
- Never send gateway-derived `ft-*` context headers. Do not treat the response `ft-batch-id` as an
  idempotency key.
- Honor `canEdit` in the integration UI without treating it as a replacement for server authorization.
- Respect API readiness signals and use bounded backoff rather than tight polling.
- Parse by status and response `Content-Type`; successful PATCH/DELETE can have an empty body, and
  specialized endpoints can return SVG, multipart/file data, or a chunked feed.
- Surface user-triggered failures with a useful recovery path. Automatically retry only safe reads;
  a timed-out mutation may already have committed.

### 4. Preserve exact message shapes

- Before constructing or reviewing a message, query `references/postmessage-attributes.md` for the
  direction, event, variant, surface, and field. Do not merge variants merely because they share an
  event name; host `select` notifications and Operation Search `select` actions have different shapes.
- Use structured-cloneable plain objects with an `event` string.
- Check whether fields are top-level or nested under `data`; FieldTwin uses both forms.
- Keep resource vocabularies field-specific: selection/navigation `type` values are singular, while `resourceType` and `resourceTypes` use exact plural collection names such as `stagedAssets` and `subProjects`.
- Include `customTabId` only where the documented protocol needs it. The host can derive the sending integration from its registered source window.
- Correlate only with documented fields such as `queryId` or `reqId`. Do not invent a request ID that the host will not echo.
- Target integration-specific host messages to the instance that produced the data.
- Declare a `category` on every `updateTagStyles` rule. Users enable or disable whole categories from the Operation toolbar, so an uncategorized rule is dropped; check the reply's `ignored` count and group rules by meaning rather than one category per rule.

### 5. Validate observable behavior

Test bootstrap, exact origin/source rejection, token replacement, parent and pop-out routing,
effective document headers through ingress, exact envelopes, correlation, malformed external input,
multiple integration instances, and complete teardown. For tag styles, test that an uncategorized rule
is rejected and reported through `ignored`, and that disabling a category removes exactly that
category's Roberto outlines and File Viewer styling. Prove a real FieldTwin-opened pop-out retains
its opener and completes bidirectional messaging; a direct top-level load is not an equivalent
test. For backend API work, test tenant/version discovery, qualified branch IDs, user-right denial,
not-ready retry/cancellation, v1.10 endpoint-specific response shapes, v2 filters/root inclusion,
batch dependency order, returned IDs, empty success bodies, and reconciliation after an ambiguous
mutation response. For Operation Mode, test normal click, double-click, keyboard activation, inline actions,
clearing, progress completion, and selection without focus.

For provider administration, expose account-wide setup only from authenticated Account Settings.
Return public identifiers and secret-presence booleans, never secrets or masked values. Empty or
omitted secret fields preserve the current value, while nonempty whitespace-only values fail.
Secrets are opaque: after only provider-defined canonicalization, compare bytes or fixed-length
digests in constant time; never trim, case-fold, or Unicode-normalize them. Avoid vault,
persistence, timestamp, and revision writes when unchanged. Store provider secrets and user OAuth
tokens only behind the credential-vault boundary. Route webhooks through a stable random
account/provider key; the full derived URL is safe-to-display routing metadata, not authentication,
and the raw key is not a separate DTO field. Resolve the account before decrypting one signing
secret. For GitHub, use a standard OAuth App user flow, verify the distinct raw-body
`X-Hub-Signature-256` HMAC, and reconcile/remove normal repository hooks with scopes adequate for
cleanup; do not require a GitHub App installation. For GitLab, pin an exact allowlisted HTTPS SaaS
or self-managed origin, use state/S256 PKCE with `api read_repository`, vault and atomically refresh
the access/refresh pair, bound discovery to Maintainer-or-Owner projects, reconcile/remove project
hooks, and persist an explicit versioned Standard Webhooks signature or legacy
`X-Gitlab-Token` profile without header-driven downgrade.

## Handoff format

Report:

- **Reason**: the integration or protocol problem.
- **Change**: client, host, documentation, and compatibility changes.
- **Validation**: focused tests and the relevant production/manual path.
- **Security**: origin/source policy, credential handling, and cleanup.
- **Migration**: any legacy field retained or behavior integrations must change.
