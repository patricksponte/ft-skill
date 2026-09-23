# FieldTwin integration development workflow

Use this checklist for implementation and debugging. It connects the repository, local Kubernetes,
browser embedding, FieldTwin lifecycle, and server authentication into one path. Read the focused
references linked below when changing their contracts.

## 1. Establish the deployment contract

Before editing:

- read the deployed FieldTwin integration contract and this skill's
  [documentation map](documentation-map.md);
- inspect one maintained integration from the same organization for repository conventions;
- identify every FieldTwin surface: project tab, Account Settings, dynamic pages, background page,
  and pop-out;
- record local and shared public origins, the exact FieldTwin parent origins, TLS mode, namespaces,
  image repositories, persistence, and required external Secrets; and
- decide whether server JWT verification uses strict JWKS or an explicit legacy public-key profile.

Treat a peer repository as a convention source, not a template to copy blindly. Reject stale
ConfigMap references, generic image repositories, hard-coded HTTPS URLs, database dependencies the
integration does not need, and weaker iframe or message policies.

When starting a new integration, use `create-fieldtwin-integration` first: it chooses between a
single self-contained `index.html` and a full repository before any file is created. The
checklist below describes the full-repository shape; a single-page integration keeps only the
FieldTwin surface, bridge, and API sections. Keep these standard entrypoints aligned:

```text
npm start -> Tiltfile -> Dockerfile -> Helm chart -> Kubernetes
build-pipeline.js -> devops.sh build/push/deploy -> same Dockerfile and Helm chart
Environment Module -> Tilt/Helm values -> direct pod environment
```

Use a program-qualified OCI repository such as `equipment-insights-main`; `main` may be a build-bot
component key but is not a sufficient image name. Pass ordinary configuration directly as Helm
environment values. Require a ConfigMap only for a real independently managed or mounted file.

If the application intentionally stores configuration as JSON, mount a persistent directory and
keep all state beneath that configured root. Use atomic replace, bounded file sizes, explicit
schema validation, safe names, and process-safe locking. Do not retain SQL migrations, database
drivers, connection variables, or readiness checks after selecting file-backed persistence.

## 2. Make environment mode control every public URL

Define one exact public application origin per module. Generate the manifest URL, integration URL,
icon URL, dynamic-pages URL, settings URLs, OAuth callbacks, webhooks, and worker-facing URLs from
that value.

An explicit local mode may use HTTP. In that mode, change all related settings together:

- public application origin uses `http://`;
- ingress TLS and SSL redirect are disabled;
- Vite permits the exact local ingress hostname through `server.allowedHosts`;
- the exact HTTP FieldTwin parent is injected into the origin allowlist;
- the bridge may accept that parent and an HTTP `backendUrl`; and
- server key retrieval may use HTTP only when the same local-mode flag is enabled.

Shared and production modules must require HTTPS. Never infer local mode from a request hostname,
incoming message, referrer, or URL scheme.

Render every module before starting Tilt. Inspect the rendered image names, pod environment,
volumes, Secrets, optional worker resources, ingress TLS, and generated public origin. A local pod
must not reference a ConfigMap or Secret that the selected module does not render or provision.

## 3. Expose the correct FieldTwin surfaces

Serve a credential-free manifest with `GET` and `OPTIONS`, JSON content type, and public CORS. Build
all URLs from the configured public origin so the icon and page scheme match the active ingress.
See [manifest-and-loading.md](manifest-and-loading.md) for exact endpoint and iframe policy.

Put account-wide integration setup under `accountSettingsUrl`, not integration user settings.
Reserve user settings for individual preferences. An Account Settings page must still authorize
mutations on the server; a visible edit control or `canEdit` hint is not authorization.

Use `dynamicPagesUrl` to declare tenant-visible deployed applications. The endpoint must:

- authenticate the FieldTwin bearer token;
- derive tenant scope only from verified claims;
- return only ready and available deployments;
- use stable non-sensitive page paths and deployment URLs derived from trusted records;
- omit tokens, account identifiers, and project identifiers from iframe URLs; and
- implement exact-origin authenticated CORS for `POST` and `OPTIONS` with
  `Authorization, Content-Type` allowed and `Vary: Origin` returned.

## 4. Permit the iframe and preserve the pop-out opener

For HTTPS deployments, the integration response must use `Content-Security-Policy:
frame-ancestors` with the exact configured FieldTwin frontend origins. Do not emit
`X-Frame-Options: DENY` or `SAMEORIGIN`. An explicit HTTP-only local mode may omit only the child
`frame-ancestors` restriction; exact message checks remain mandatory.

Classify browser errors before changing policy:

| Browser failure | Owning layer | Correct action |
| --- | --- | --- |
| Child `frame-ancestors` or `X-Frame-Options` block | Integration response | Fix the built server or ingress response. |
| Parent `frame-src` block | FieldTwin host | Update the FieldTwin deployment policy. |
| HTTPS parent rejects HTTP child | Browser mixed-content policy | Use HTTPS, an approved proxy, or a documented local-only exception. |
| Manifest or dynamic-page CORS error | Endpoint or ingress | Fix that endpoint's production preflight/response headers. |

CORS does not grant iframe permission, and iframe headers do not grant cross-origin HTTP access.

The integration page is also the pop-out document when `allowPopout` is enabled. Inspect its final
response through the same deployed ingress that FieldTwin uses:

- omit `Cross-Origin-Opener-Policy` or set it to `unsafe-none`;
- reject a generic security preset that injects `Cross-Origin-Opener-Policy: same-origin` or
  `noopener-allow-popups` on the integration page;
- do not combine opener-isolating COOP with `Cross-Origin-Embedder-Policy` to make this bridge page
  cross-origin isolated; and
- do not treat `X-IFrame-Allow`, `X-Frame-Allow`, the iframe `allow` attribute, CORS, or
  `Permissions-Policy` as opener controls.

COOP compatibility depends on both documents. The FieldTwin host must use a policy that can retain
an external popup, and the integration document should remain `unsafe-none`. A host with
`same-origin` still severs an external integration even when the child is configured correctly.

| Browser failure | Owning layer | Correct action |
| --- | --- | --- |
| Pop-out has `window.opener === null` or its opener proxy immediately appears closed | FieldTwin or integration effective COOP, or `noopener` at open time | Inspect both final document responses and the host's `window.open` features; restore compatible opener policies. |
| `X-IFrame-Allow` is present but the iframe or pop-out still fails | Non-standard/custom header | Diagnose CSP, XFO, COOP, origin/source validation, and the actual platform convention instead. |

Verify both response headers and browser behavior. A header-only test catches proxy injection, while
only a real FieldTwin-opened pop-out proves that the two effective policies are compatible.

## 5. Capture `loaded` before SvelteKit starts

FieldTwin posts its one-shot `loaded` message from the parent iframe-load path and does not wait for
an integration readiness handshake. SvelteKit dynamically imports `hooks.client`; a listener there,
in `onMount`, or in a component can start too late.

For SvelteKit:

1. load a small parser-time module from `app.html` before `%sveltekit.body%`;
2. let it capture only a bounded number of top-level `event: 'loaded'` candidates in its private
   module closure;
3. create the full bridge, attach its live message listener, then import and drain the same module;
4. run every queued candidate through the normal exact origin, expected parent/opener, and payload
   validation; and
5. erase the queue and remove all listeners on teardown.

Never place the candidate, token, or queue on `window`, in a Svelte store, storage, the DOM, logs,
analytics, or hydration data. See [bridge-and-api.md](bridge-and-api.md) for the bridge pattern.

Validate only fields required by the active surface. Project pages may require `backendUrl`,
`APIVersion`, scope, and readiness. Account Settings can receive a top-level token and UI context
without project API fields. Accept that trusted bootstrap for same-origin authenticated requests,
while making FieldTwin project API helpers fail clearly until their context exists.

When `backendUrl` is present, validate it using the deployment TLS policy and preserve a base path
such as `/backend`. Reducing it to its origin silently builds the wrong API URL.

## 6. Select the matching server JWT profile

Do not assume every FieldTwin deployment publishes JWKS or standard issuer/audience claims.

| Profile | Required verification |
| --- | --- |
| JWKS | Exact issuer, audience, asymmetric algorithm allowlist, signature, expiry, stable subject, and tenant claim. Use exactly one pinned inline or HTTPS JWKS source. |
| Legacy public key | Explicit profile selection, exact key endpoint, no redirects, bounded response/time/cache, endpoint algorithm matching the configured asymmetric allowlist and JWT header, signature, expiry, stable subject, and tenant claim. |

A common legacy endpoint returns JSON containing a PEM `publicKey` and `algorithm` at a path such as
`/backend/token/publicKey`; it is not a JWKS document. Legacy tokens may omit issuer and audience,
so omit those checks only in the explicit public-key profile. Configure claim names for the actual
deployment, commonly `userId` for subject and `accountId` for tenant. Treat a top-level account-admin
claim as authority only when its exact name is explicitly configured. Keep nested rights validation
when the deployed contract provides it.

Permit an HTTP key endpoint only in explicit local mode. Never forward the integration bearer token
to the key endpoint, follow redirects, accept a key-selected algorithm outside the allowlist, decode
without verifying, or expose authentication details in error messages.

## 7. Configure provider connections

Put account-wide provider application setup in FieldTwin Account Settings and require a verified
account-administrator claim on the server before reading or changing it. Keep provider setup
separate from a user's provider authorization and connection status.

Use a secret-safe Account Settings contract:

- `GET` returns only allowlisted public identifiers, derived callback URLs, the full derived
  account-keyed webhook URL, an optimistic revision, and a boolean for each configured secret. The
  full opaque URL is safe-to-display routing metadata, not an authenticator;
- never return a secret, token, masked placeholder, last characters, account identifier,
  credential reference, vault reference, or opaque internal routing key as its own DTO field;
- render secret inputs empty with a clear "leave empty to keep the saved value" explanation;
- `PATCH` accepts an expected revision and only the secret fields the user changed;
- an omitted field or raw string with length zero preserves the stored value, while a nonempty
  whitespace-only or malformed replacement fails validation before transformation; and
- treat secret values as opaque bytes. Apply only canonicalization explicitly defined by the
  provider; never trim, case-fold, or Unicode-normalize. Compare byte-for-byte with a constant-time
  primitive, or compare fixed-length cryptographic digests in constant time. Do not write the
  vault, JSON document, timestamp, or revision when unchanged.

Persist public metadata, secret-presence booleans, and opaque vault references in the account JSON
document. Persist complete provider-application secret bundles and user OAuth tokens only in the
credential vault. Use copy-on-write plus revision compare-and-swap so a failed race cannot corrupt
the active configuration. Revoke existing connections when identity-defining public OAuth values
change, and bind every pending callback session to the FieldTwin account, provider, exact callback,
selected provider origin, provider-configuration revision, one-time state, and S256 PKCE verifier.

Before enabling a provider button, validate the OAuth-session encryption key, selected credential
vault, and the tenant's complete provider application record without network or filesystem
mutation. Return a sanitized `provider_not_configured` response and do not create pending JSON
state when any required piece is absent. Surface that response as actionable guidance instead of a
generic 500.

Mount only deployment bootstrap credentials—for example the OAuth-session key and the external
vault service token or independent file-vault key—through Helm's external Secret reference in
every enabled environment, including local Tilt. Provider client secrets and webhook signing
secrets entered in Account Settings belong in the vault, not pod environment, modules, Helm
values, source control, or browser state.

Preserve the production callback cookie policy: host-only `__Host-` name, `Secure`, `HttpOnly`,
`SameSite=Lax`, and path `/`. If the standard local workflow explicitly permits HTTP, select a
different non-`__Host` host-only name with `Secure=false` only from that same deployment flag. Use
the configured policy consistently for intent, callback, and deletion; never
derive it from the callback request scheme.

Keep provider credentials outside tenant control-plane JSON. Use an external HTTPS vault by
default. An explicit single-node file-vault mode may store authenticated ciphertext beneath the
persistent configuration root when it uses a dedicated independent 32-byte key, random opaque
references and filenames, authenticated encryption bound to the reference and schema, private
permissions, atomic writes, strict bounds, and validation on both write and read. Never reuse the
OAuth state key, persist plaintext provider tokens, or make file mode the shared/production default.

For a standard GitHub OAuth App, use the authorization-code flow with state and S256 PKCE. Resolve
the account's client ID and secret only on the server, validate the returned user through GitHub,
paginate the authenticated user's repositories with strict bounds, and retain only repositories
where GitHub proves the user can administer a repository webhook. Store the user token only in the
vault. Choose scopes for the complete product lifecycle: `write:repo_hook` covers
read/write/ping, but deleting a repository hook during unwatch or disconnect requires
`admin:repo_hook` (or `repo`, the broader grant also needed for private repository discovery,
cloning, or content access). Verify the returned scope before activating the connection; do not
promise cleanup with only the write scope. When a selected repository starts being watched, list
and reconcile exactly one application-managed push hook by the stored repository/hook IDs and
exact account webhook URL. Do not adopt or alter an unrelated hook that happens to share a URL.
Verify `X-Hub-Signature-256` as `sha256=<hex>` HMAC-SHA256 over the unmodified raw body with a
constant-time comparison. GitHub's raw-body HMAC construction is not GitLab Standard Webhooks.

For GitLab, accept an account's provider origin only when it exactly matches a deployment allowlist:
`https://gitlab.com` for SaaS or an explicitly approved HTTPS self-managed origin. Parse the input
as an origin and reject userinfo, non-root paths, query, fragment, HTTP, look-alike suffixes, and
arbitrary account-supplied hosts. Derive `/oauth/authorize`, `/oauth/token`, and `/api/v4` only from
the validated origin. Pin all server-side provider requests to that origin and reject cross-origin
HTTP redirects.

Keep the GitLab Application ID as allowlisted public metadata and its Application Secret only in
the vault; register and send the one exact derived HTTPS callback URL. Use one-time state and S256
PKCE for the GitLab authorization-code flow. Request and verify both
`api` and `read_repository`: the former permits project-hook API mutations and the latter permits
private repository reads and Git-over-HTTPS. Validate the authenticated GitLab user before
activation. Discover selectable projects through bounded pagination with a Maintainer-or-Owner
filter such as `membership=true&min_access_level=40`, then re-check current access before a hook
mutation. Store only opaque credential references in account state.

Vault each GitLab access token, refresh token, expiry, scopes, exact provider origin, and provider
user ID as one versioned bundle. A GitLab refresh invalidates the prior access and refresh tokens
and returns a new pair. Claim a distributed per-connection single-flight lease or compare-and-swap
state before calling `/oauth/token`; a losing worker must not exchange and instead waits for or
re-reads the winner's committed bundle. The winner exchanges once and atomically replaces the
entire vaulted bundle before publishing the new access token. If durable replacement fails after
exchange, fail closed and require controlled retry or reconnection rather than combining an old
refresh token with a new access token. Build API authorization from the current committed bundle
at request time.

For each watched GitLab project, list and reconcile one application-managed push hook using the
stored project and hook IDs, exact account webhook URL, enabled event set, TLS verification, and a
persisted versioned verification profile:

- `gitlab-standard-webhooks-v1` requires signing-token capability (introduced in GitLab 19.0
  behind `webhook_signing_token`, generally available in 19.1). Configure a signing token in
  `whsec_<base64>` form encoding a 32-byte key. Require `webhook-id`, `webhook-timestamp`, and
  `webhook-signature`; reject stale/future timestamps and replayed delivery IDs; calculate
  HMAC-SHA256 over `{webhook-id}.{webhook-timestamp}.{raw-body}`; encode it as
  `v1,<base64-signature>`; and compare every space-separated received candidate in constant time.
- `gitlab-legacy-x-gitlab-token-v1` is only for an older or explicitly incompatible self-managed
  instance. Compare the plaintext `X-Gitlab-Token` header against the vaulted token in constant
  time. This token is not a signature over the body and must not be described as raw-body HMAC.

Select and persist the GitLab profile after an explicit instance-version/capability check before
creating the hook. Never infer or downgrade the profile because a delivery omits a signature
header. A no-downtime migration may deliberately select a separate time-bounded dual profile while
both GitLab tokens are configured; remove legacy acceptance after reconciling every managed hook.
These details were verified on 2026-08-13 against GitLab's official
[webhook guide](https://docs.gitlab.com/user/project/integrations/webhooks/) and
[project webhooks API](https://docs.gitlab.com/api/project_webhooks/). Re-check the configured
self-managed version, plus the current [OAuth flow](https://docs.gitlab.com/api/oauth2/),
[OAuth scopes](https://docs.gitlab.com/integration/oauth_provider/), and
[Projects API](https://docs.gitlab.com/api/projects/), when implementing.

Give each FieldTwin account/provider a stable random opaque webhook route. Resolve exactly one
account configuration from the route before decrypting one signing secret, then verify the exact
provider envelope and resolve targets only inside that account. The full derived URL may be
returned to the authenticated account administrator and registered with the provider, but it is
safe-to-display routing metadata rather than authentication; never expose its internal raw key as a
separate DTO field. Do not use a global shared webhook secret, scan/decrypt every account secret,
trust an account identifier in an unverified payload, or share verification code between GitHub
and GitLab profiles.

Own hook cleanup while the user credential and required scope still exist:

1. On watch enable, create or reconcile one managed hook idempotently and persist its provider hook
   ID only after provider success.
2. On signing-secret, profile, or webhook-URL rotation, stage a new secret, update every managed
   hook, accept old and new verification only for a bounded in-flight overlap, then retire the old
   secret. Resend GitHub's secret on a full hook update; changing a GitLab hook URL resets its
   legacy secret token, so resend the selected token/profile material.
3. On unwatch, delete the managed provider hook before removing the watch record.
4. On disconnect, delete all managed hooks before revoking/deleting the vaulted connection. If a
   revoked token or lost role prevents cleanup, disable local processing, retain a non-secret
   cleanup tombstone containing provider/project/hook IDs, and show exact manual remediation rather
   than claiming success.

Test GitHub's complete OAuth path, lifecycle-adequate scope, bounded admin-capable discovery,
create/reconcile/rotate/delete behavior, and raw-body signature verification. Test GitLab's exact
origin rejection, state/PKCE, exact scopes, bounded Maintainer project list, access/refresh bundle
CAS, refresh races/failure, project-hook lifecycle, both explicitly selected verification profiles,
timestamp/replay rejection for the signed profile, and no header-driven downgrade. For both,
exercise missing configuration, both cookie modes, vault failure, state replay/mismatch, revision
drift, account-route isolation, safe URL/no raw route-key DTO shape, and no partial store mutation.

Separate browser callback reachability from webhook reachability. A browser may return to a local
hostname that a provider cannot call from the public internet. Use a reviewed HTTPS tunnel or
shared test ingress, and update the exact callback and managed webhook URLs together before
claiming commit-triggered deployment works end to end.

## 8. Run and verify the real path

Load the local Environment Module, install dependencies, then use the root `npm start`. It must start
Tilt; keep a separate command for running the built application directly. Confirm Tilt builds the
program-qualified image and applies the same Helm chart used by deployment automation.

Verify through the deployed ingress, not only through Vite:

1. manifest `GET` and `OPTIONS` with the actual FieldTwin Admin `Origin`;
2. icon and every generated URL use the active HTTP/HTTPS scheme;
3. integration response has the correct iframe headers and no blocking `X-Frame-Options`;
4. Account Settings or project iframe loads in FieldTwin;
5. the parser-time capture asset loads before the framework client graph;
6. the first authenticated integration endpoint returns success after `loaded`;
7. dynamic-page preflight and authenticated response work and are tenant-scoped;
8. `tokenRefresh` changes the bearer used by the next request; and
9. refresh, remount, pop-out, and teardown do not leak or duplicate listeners;
10. each enabled provider completes state/PKCE, exact-scope validation, bounded repository/project
    discovery, and vaulted token handling through its exact configured origin; and
11. managed hooks reconcile, authenticate through the selected provider profile, rotate, unwatch,
    and disconnect without orphaning silent cleanup failures.

Do not log the `loaded` payload or token while debugging. Use request chronology, status codes,
configured non-secret origins, response headers, and synthetic tests.

## Diagnostic matrix

| Symptom | Inspect first | Frequent cause |
| --- | --- | --- |
| Page remains “Connecting” and no integration API request appears | Parser/bootstrap request order and bridge acceptance | `loaded` arrived before framework listener; wrong exact origin/source; HTTP parent or backend rejected. |
| Page advances but the first authenticated request is 401/500 | Server auth profile and non-secret verifier environment | JWKS configured for a PEM endpoint; wrong claims or algorithm; missing local auth environment. |
| Manifest imports fail | Manifest response through ingress | Missing production CORS/preflight; testing only Vite. |
| Icon or iframe URL fails only locally | Generated public origin | Individual URL hard-coded to HTTPS while Tilt ingress is HTTP. |
| Browser refuses to embed | Console error and final child/parent headers | Wrong `frame-ancestors`, blocking `X-Frame-Options`, parent `frame-src`, or mixed content. |
| Pod reports a missing ConfigMap | Rendered workload and selected module | Chart retained `envFrom` although values are direct environment entries. |
| Pod uses a generic image name | Tilt, `devops.sh`, and Helm mapping | Build component key leaked into the OCI repository name. |
| Configuration disappears after restart | Volume mount and file-store root | JSON store writes outside the persistent mount or performs non-atomic writes. |
| Provider setup reload exposes a secret or mask | Account Settings GET mapper and DTO | Persistence record was serialized directly instead of mapped through an exact public allowlist. |
| Saving an unchanged secret rotates state | PATCH dirty fields, opaque-byte comparison, and revision | Client resent a placeholder or server wrote before comparing the exact secret bytes or digest. |
| Connect provider returns 500 before redirect | Provider readiness and bootstrap Secret inventory | Missing OAuth-session key, account OAuth setup, or credential-vault configuration. |
| GitHub OAuth returns `provider_connection_failed` locally | Callback cookie in the browser | HTTP local mode issued a production `Secure`/`__Host-` cookie, or callback origin differs from the OAuth App registration. |
| GitLab connects but hook delivery fails | Stored hook profile, instance capability, raw headers/body, and token-bundle revision | Standard Webhooks selected on an unsupported instance; legacy fallback inferred from a missing signature; payload parsed before verification; or a refresh race stored a mixed token pair. |

## 9. Completion gate

Do not hand off until the relevant evidence is green:

- format, lint, framework/type checks, unit tests, production web and worker builds;
- Helm lint and rendered modules with no dangling object references;
- Tilt evaluation with expected image/workload names;
- parser-order, wrong-origin/source, token-refresh, local-HTTP, Account Settings minimal-bootstrap,
  provider-secret non-disclosure/no-op rotation, GitHub/GitLab OAuth and token lifecycle,
  account-keyed provider routing, explicit provider signature profiles, hook reconcile/rotation/
  cleanup, server-auth-profile, CORS, iframe-policy, dynamic-page tenant-scope, and teardown tests;
- one live iframe path through ingress, including the first authenticated request.

If a live check cannot run, state exactly which boundary remains unverified. Use
[security-and-testing.md](security-and-testing.md) for the complete security and protocol matrix.
