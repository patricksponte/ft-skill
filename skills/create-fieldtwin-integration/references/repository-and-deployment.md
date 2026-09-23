# Repository and deployment reference

Use this reference to create or review the standard deployable repository surface. Adapt names and omit components the integration does not need; keep one build and deployment path.

## Canonical tree

```text
integration-repository/
├── AGENTS.md
├── README.md
├── package.json
├── package-lock.json
├── Tiltfile
├── devops.sh
├── build-pipeline.js
├── modules/
│   ├── localdev
│   ├── dev
│   └── shared-environment.example.com
├── helm/integration/
│   ├── Chart.yaml
│   ├── values.yaml
│   ├── values.schema.json
│   └── templates/
└── fullstacks/main/
    ├── Dockerfile
    ├── .dockerignore
    ├── package.json
    ├── package-lock.json
    ├── .env.example
    ├── migrations/
    ├── src/
    └── tests/
```

The component key `main` is an orchestration interface, not an acceptable global image name. Map it once:

```text
build component: main
source directory: fullstacks/main
OCI repository: equipment-insights-main
Helm workload: equipment-insights-main
```

## Root package contract

Use root scripts as stable developer entrypoints:

| Script | Purpose |
| --- | --- |
| `setup` | Install application dependencies. |
| `start` | Start Tilt for the loaded module. |
| `start:app` | Run the built Node application directly. |
| `build` / `build:all` | Build the application and optional worker. |
| `check` | Run framework and type diagnostics. |
| `lint` | Run formatting and static lint. |
| `test:unit` | Run deterministic unit tests once. |
| `tilt-down` | Remove resources managed by the Tilt session. |

Do not make `npm start` silently run a different deployment path than the rest of the team.

## Environment Modules contract

Modules may define:

- build target and tag strategy;
- image registry;
- Kubernetes context, control namespace, runtime namespace, and build namespace;
- Helm release and DNS domain;
- worker enablement;
- pull-secret names; and
- non-secret application settings encoded as Helm values.

Modules must not contain credentials. External Secret references may provide deployment bootstrap
credentials such as OAuth-session encryption and credential-vault access, but never tenant provider
client secrets, webhook signing secrets, or user OAuth tokens. A local module should run without
placeholder cluster objects. If it disables the worker, the rendered chart must also omit worker
Deployments, worker service accounts, worker RBAC, worker namespaces, build quotas, and credential
Secret references.

## Docker contract

Use stages for dependencies, development, build, and production where the stack benefits from them. The production image should:

- contain only production dependencies and compiled outputs;
- run as an unprivileged fixed UID/GID;
- listen on the documented container port;
- support a read-only root filesystem with explicit temporary mounts;
- contain both web and worker outputs when both use the same image; and
- expose a health check or work with Kubernetes HTTP probes.

Keep package-lock files synchronized and prefer deterministic installation such as `npm ci`.
Production pods should use a read-only root filesystem. A local Vite/Tilt development pod may set
it writable when live sync, Vite's temporary config bundle, or dependency installation writes under
the application directory; keep that exception in the local module rather than weakening shared
environments. Give the local development pod enough memory for dependency optimization and live
transforms; do not assume production server limits are sufficient for a development toolchain.

## Helm contract

The chart should render:

- web Deployment, Service, Ingress, optional disruption budget, and web service account;
- optional worker Deployment and only its required service account/RBAC;
- optional build/runtime namespace resources only when the worker is enabled;
- probes, resource requests/limits, security contexts, image pull secrets, and labels; and
- direct environment entries plus an optional deployment-bootstrap Secret reference.

Avoid required ConfigMaps for plain environment variables. Use a ConfigMap only when configuration has an independent lifecycle or must be mounted as a file. Never render empty `envFrom` entries.

## FieldTwin HTTP and CORS contract

FieldTwin administrators load a manifest from a different origin. Treat CORS as part of the
manifest contract rather than a development-server option:

- derive one exact public origin from the environment's ingress hostname and TLS mode, then use it
  for the manifest page, icon, dynamic-page endpoint, OAuth callbacks, webhooks, and worker config;
- allow an explicit HTTP-only local mode such as Tilt/minikube, but require HTTPS for shared and
  production environments; switch the ingress SSL redirect and generated scheme together;
- never force `https://` inside a manifest builder when Helm has selected an HTTP ingress.

- serve the manifest over HTTPS with `GET`, `Content-Type: application/json`, and an `OPTIONS`
  response;
- for a public, credential-free manifest, return `Access-Control-Allow-Origin: *` and allow
  `GET, OPTIONS` plus the request headers needed by the importer; a wildcard header grant is safe
  only for this credential-free public endpoint. Otherwise validate and echo an exact origin;
- verify the headers using a request with the actual FieldTwin Admin `Origin` through the deployed
  ingress, because an ingress or proxy can alter application response headers.

Dynamic pages are authenticated and need a narrower browser CORS policy:

- allow `POST, OPTIONS` and explicitly allow `Authorization, Content-Type`;
- echo only an exact configured FieldTwin frontend origin and include `Vary: Origin`;
- do not add `Access-Control-Allow-Credentials` unless the protocol actually uses browser cookies,
  and never combine credentialed requests with wildcard origin;
- keep CORS independent from `Content-Security-Policy: frame-ancestors`: CORS controls browser HTTP
  access, while `frame-ancestors` controls which origins may embed the integration.

Add server-hook or endpoint tests for manifest GET/preflight, an allowed dynamic-page origin, a
look-alike rejected origin, required request headers, and an unrelated route that receives no CORS
grant. Do not rely on Vite's development CORS setting as proof of production behavior.

## FieldTwin iframe and pop-out document contract

The integration page is the iframe child. Its production response must permit only the configured
exact FieldTwin frontend origins with `Content-Security-Policy: frame-ancestors ...`. Do not send
`X-Frame-Options: DENY` or `X-Frame-Options: SAMEORIGIN`; those legacy values override the intended
cross-origin embedding behavior in browsers that enforce them.

The same HTML document can also be opened as a cross-origin top-level pop-out. Its bridge depends
on the opener relationship, so the effective document response must not isolate the integration
into a different browsing-context group. Use this response-header contract:

| Header or policy | Integration document requirement | Why |
| --- | --- | --- |
| `Content-Security-Policy: frame-ancestors ...` | Include the exact FieldTwin frontend origins in HTTPS deployments | Permits only approved iframe ancestors; it does not control a top-level pop-out. |
| `X-Frame-Options` | Omit it; never send `DENY` or `SAMEORIGIN` | Those values block the required cross-origin iframe. |
| `Cross-Origin-Opener-Policy` | Omit it or send `unsafe-none` | Preserves compatibility with the cross-origin FieldTwin opener. `same-origin` and `noopener-allow-popups` can sever the opener bridge. |
| `Cross-Origin-Embedder-Policy` | Do not combine it with opener-isolating COOP on the bridge page | Cross-origin isolation and a cross-origin opener bridge are incompatible under this protocol. |
| CSP `sandbox` | Do not apply an opaque-origin or script-blocking sandbox to the integration document | The bridge needs script execution and an exact non-opaque message origin. |
| `X-IFrame-Allow` / `X-Frame-Allow` | Do not rely on it | These are not standard browser response headers. A private proxy convention is only additive. |
| iframe `allow` / `Permissions-Policy` | Grant only capabilities the integration needs | These control features such as clipboard access, not embedding or opener retention. |

The safest integration-document COOP value is `unsafe-none`, including when the FieldTwin host
uses `same-origin-allow-popups` to retain cross-origin pop-outs. Do not set
`same-origin-allow-popups` on the cross-origin integration response by symmetry: compatibility is
determined from both the opener and opened-document policies and origins.

The standard explicitly enabled HTTP-only local mode may omit `frame-ancestors`, matching existing
FutureOn local integrations. Keep the rest of the CSP and the application-level exact-origin/source
checks. HTTPS, shared, and production modes must retain the exact `frame-ancestors` allowlist and
fail closed when it is unavailable.

Local HTTP changes the parent message origin as well as the child iframe URL. The local module must
configure the actual exact HTTP FieldTwin parent origin. Permit that HTTP entry in the client bridge
and authenticated CORS validation only when the same explicit deployment TLS switch selects local
HTTP. Never derive trust from `event.origin`, `document.referrer`, the request host, or a wildcard;
shared and production modes must reject HTTP parent origins.

Classify a browser block before changing policy:

- a child response CSP `frame-ancestors` or `X-Frame-Options` error belongs to the integration;
- a parent response CSP `frame-src` error belongs to the FieldTwin deployment;
- an HTTPS FieldTwin page refusing an HTTP integration is mixed-content enforcement and cannot be
  repaired with child CORS or CSP headers. Use local HTTPS, an approved FieldTwin proxy path, or a
  clearly documented local-only browser exception.

Test the built server through ingress in both modes. Inspect the final integration-page response,
not only application middleware: local HTTP must have no child iframe-denial header, while HTTPS
must contain only the configured exact FieldTwin origins. In both modes, assert COOP is absent or
`unsafe-none`; check that the Node server, framework adapter, security middleware, ingress, reverse
proxy, and CDN did not append a second conflicting value. Treat `X-IFrame-Allow` as irrelevant to
this assertion.

Then load the page in a real FieldTwin iframe and pop it out. Confirm the iframe has no embedding
policy error, the pop-out observes a live `window.opener`, the trusted `loaded` event comes from
that opener, and a message sent through the pinned bridge reaches FieldTwin. Opening the page
directly in a new tab does not exercise the pop-out contract.

## FieldTwin bootstrap contract

FieldTwin posts the initial `loaded` event after the integration document loads and does not wait
for a client readiness handshake. Install a minimal receiver before the document-load boundary,
before framework components mount or hydrate. SvelteKit's `hooks.client` belongs to its dynamically
imported client graph and is not parser-time; a fast iframe can finish loading and receive
FieldTwin's one-shot post before that hook runs. Load a small module from `app.html` before
`%sveltekit.body%`, then let the later bridge import and drain that same module instance.

When the full bridge is constructed later, preserve early `loaded` candidates in a bounded
module-closure queue only. Register the bridge listener first, remove the temporary listener, drain
every candidate through the same exact-origin, expected-source, and payload validation, then clear
the queue. Never put the token or queued message on `window`, in a Svelte store, browser storage,
DOM, logs, or serialized hydration state.

Require only the bootstrap fields the current surface uses. Project pages that call the FieldTwin
API need a valid `backendUrl`, `APIVersion`, and relevant project scope. Account Settings can be
account-scoped and may receive only the integration token plus UI hints. Such a page can
authenticate same-origin control-plane calls with the in-memory token, while its project API
helper must fail clearly until API context is available.

When `backendUrl` is present, validate its scheme under the same explicit deployment TLS mode as
the trusted parent. A local HTTP FieldTwin host commonly supplies an HTTP backend URL with a base
path such as `/backend`; allow it only in explicit local mode and preserve that path. Reject HTTP in
shared or production mode.

## Provider administration and repository-hook contract

Declare provider application setup through the manifest's `accountSettingsUrl`. Require a verified
FieldTwin account-administrator claim on the server before reading or changing it; a client-side
edit hint is not authorization. Keep this account-wide setup separate from each user's provider
authorization and connection status.

Use an exact secret-safe control-plane contract:

- `GET` returns only allowlisted public identifiers, derived callback URLs, the derived full
  account-keyed webhook URL, an optimistic revision, update time, and one configured boolean per
  secret. The full opaque webhook URL is safe-to-display routing metadata, but it is not an
  authenticator;
- never return a secret, token, masked placeholder, suffix, account identifier, credential or vault
  reference, or the internal raw webhook route key as a separate DTO field;
- render secret controls empty on every load and explain that an unchanged empty control preserves
  the saved value;
- `PATCH` requires the expected revision and sends only secret controls the user deliberately
  changed;
- an omitted field or a raw string whose length is exactly zero preserves the saved value; reject a
  nonempty whitespace-only, malformed, unknown, or oversized replacement before transformation;
  and
- treat every secret as opaque bytes. Apply only canonicalization explicitly required by the
  provider contract; never trim, case-fold, or Unicode-normalize a secret. Compare the candidate
  byte-for-byte with a constant-time primitive, or compare fixed-length cryptographic digests in
  constant time. If unchanged, do not write the vault, account JSON, update time, or revision.

Persist only public provider metadata, secret-presence booleans, stable opaque routing information,
and opaque vault references in the FieldTwin account JSON document. Persist provider application secret
bundles and user OAuth tokens only through the credential-vault abstraction. Use an external HTTPS
vault by default; a deliberately selected single-node development file vault must encrypt and
authenticate every value with an independent deployment key. Use revision compare-and-swap and
copy-on-write so a stale editor cannot activate a partial secret bundle. Bind pending OAuth state to
the account, provider, exact callback, selected provider origin, provider-configuration revision,
and one-time PKCE verifier. Revoke existing connections when identity-defining OAuth metadata
changes.

For GitHub, scaffold a standard OAuth App and normal repository webhooks, not a GitHub App
installation flow. The account administrator supplies the OAuth client ID and client secret through
Account Settings. A user connects through authorization code, state, and S256 PKCE; the server
validates the GitHub user, bounds repository pagination, retains only repositories where GitHub
proves that user may administer hooks, and vaults the user token. Scope for the whole lifecycle:
`write:repo_hook` covers read/write/ping, while a promised unwatch or disconnect cleanup requires
`admin:repo_hook` (or the broader `repo`, which is also required when private repository discovery,
cloning, or content access needs it). Verify the returned grant before activating the connection.
When a watch is enabled, list and reconcile exactly one application-managed push webhook by stored
repository and hook IDs plus the exact account webhook URL; do not adopt or modify an unrelated
hook. Verify `X-Hub-Signature-256` as GitHub's `sha256=<hex>` HMAC-SHA256 over the unmodified raw
body with constant-time comparison. This GitHub raw-body HMAC is distinct from both GitLab
verification profiles. Do not request an installation ID, App private key, or installation token.

For GitLab, make the provider origin account-visible public metadata but accept it only when it is
an exact deployment-allowlisted HTTPS origin: `https://gitlab.com` for SaaS or one explicitly
approved self-managed origin. Parse and serialize it as an origin; reject userinfo, non-root paths,
queries, fragments, HTTP, look-alike suffixes, and arbitrary account-supplied hosts. Derive
`/oauth/authorize`, `/oauth/token`, and `/api/v4` only from that validated origin, pin every provider
HTTP request to it, and reject cross-origin redirects.

Store the GitLab Application ID as allowlisted public metadata and its Application Secret only in
the vault; register and send the one exact derived HTTPS callback URL. Use GitLab authorization
code with one-time state and S256 PKCE. Request and verify both `api` and
`read_repository`: `api` is required for project and project-hook APIs, while `read_repository`
permits private repository reads and Git-over-HTTPS. Validate the authenticated user before
activation. Discover projects with bounded pages/items and a server-side Maintainer-or-Owner
filter, such as `membership=true&min_access_level=40`; re-check access when a project is selected.
Vault the access token, refresh token, expiry, granted scopes, provider origin, and provider user ID
as one versioned connection bundle. GitLab refresh invalidates both old tokens and returns a new
pair, so serialize refresh per connection and atomically replace the whole vaulted bundle with
compare-and-swap before making the new access token active. A refresh race or failed persistence
must fail closed and require retry or reconnection, never leave a mixed token pair.

For each watched GitLab project, list and reconcile one application-managed push hook by stored
project and hook IDs, exact account webhook URL, event set, TLS verification, and explicitly
selected verification profile. Persist one of these versioned profiles with the hook record:

- `gitlab-standard-webhooks-v1`: use only when the configured instance supports GitLab signing
  tokens (introduced in 19.0 behind `webhook_signing_token`, generally available in 19.1). Configure
  a `whsec_<base64>` signing token encoding a 32-byte key. Require `webhook-id`,
  `webhook-timestamp`, and `webhook-signature`; enforce a bounded timestamp skew and delivery-ID
  replay cache; compute HMAC-SHA256 over
  `{webhook-id}.{webhook-timestamp}.{raw-body}`; base64-encode it as `v1,<signature>`; and compare
  every received signature candidate in constant time.
- `gitlab-legacy-x-gitlab-token-v1`: select only for an older or explicitly incompatible
  self-managed instance. Configure the legacy secret token and compare the plaintext
  `X-Gitlab-Token` value to the vaulted token in constant time. This profile is weaker because the
  token is not a signature over the body; do not describe it as HMAC verification.

Do not choose or downgrade a GitLab profile from whichever headers happen to arrive. Verify the
instance capability before hook creation and persist the choice. If a no-downtime migration needs
both mechanisms, make a separate explicit, time-bounded migration profile and remove legacy
acceptance after every managed hook is reconciled. Current profile details were checked against
the official [GitLab webhook guide](https://docs.gitlab.com/user/project/integrations/webhooks/)
and [project webhooks API](https://docs.gitlab.com/api/project_webhooks/) on 2026-08-13; re-check the
configured self-managed version before implementation. Use the official
[OAuth flow](https://docs.gitlab.com/api/oauth2/), [scope table](https://docs.gitlab.com/integration/oauth_provider/),
and [Projects API](https://docs.gitlab.com/api/projects/) for the rest of the contract.

Give every FieldTwin account/provider a stable random opaque webhook route. Resolve exactly one
account from it before decrypting one signing secret, authenticate the bounded provider-specific
envelope, and match repositories/projects and watches only inside that account. The derived full
URL may be returned to the authenticated account administrator and sent to the provider, but route
possession never replaces GitHub or GitLab webhook verification. Never use one global signing
secret, scan all accounts, expose the internal route key separately, or choose account scope from
an unverified payload.

Own the complete hook lifecycle. Reconcile on watch enable and provider-secret or webhook-URL
rotation. Stage a new signing secret, update every managed hook while the required user credential
and scope still exist, permit only a bounded old/new verification overlap for in-flight delivery,
then retire the old secret. On unwatch, delete the provider hook before discarding its watch record.
On disconnect, remove every managed hook before revoking the OAuth connection and vaulted tokens.
If role or token loss prevents cleanup, disable local processing, retain a non-secret cleanup
tombstone with provider/project/hook IDs, and surface exact manual remediation; do not silently
claim success. Provider update APIs can clear secrets: resend GitHub's secret on full hook updates,
and resend GitLab's selected token whenever its URL/profile is changed.

Treat browser callback and webhook reachability as separate checks. A local browser hostname
usually needs an approved HTTPS tunnel or shared ingress before either provider can deliver hooks.

Only deployment bootstrap credentials belong in Kubernetes pod environment variables: the OAuth
session/state encryption key and the selected vault's service credential or independent file-vault
encryption key. Provider client secrets, signing secrets, and user tokens must never appear in
Environment Modules, Helm values, ConfigMaps, pod environment, build arguments, or browser state.

## Tilt contract

Tilt should:

1. require a selected context and namespace;
2. use a program-qualified image repository;
3. build the application Dockerfile with the module-selected target;
4. pass the same image repository and tag to Helm;
5. parse module Helm values without losing string intent;
6. register only resources the chart renders;
7. create only enabled namespaces; and
8. live-sync only paths compatible with the selected Docker stage.

Local defaults must be safe if an old terminal lacks a newly introduced module variable. For example, a minikube development context should default an optional credential-dependent worker to disabled.

## Build-bot contract

Keep `build-pipeline.js` declarative. Its component list calls:

```text
devops.sh build <component>
devops.sh push <component>
devops.sh deploy
```

`devops.sh` owns tag generation, component-to-image mapping, Docker paths, Helm values, namespace setup, and registry-secret handling. The pipeline must not reimplement them.

## Validation matrix

| Surface | Required evidence |
| --- | --- |
| Local module | One expected web workload, program-qualified image, direct non-secret env, no missing object references. |
| Worker module | Worker plus scoped RBAC/limits, external credential Secret reference, build/runtime configuration. |
| Helm | Lint succeeds; each module renders; schema rejects invalid types. |
| Kubernetes | Client dry-run accepts every rendered object. |
| Tilt | Evaluation names the expected Dockerfile, OCI repository, and Kubernetes resources. |
| Application | Format, lint, type checks, tests, web build, and worker build pass. |
| Container | Image builds and starts as non-root when a Docker daemon is available. |
| FieldTwin | Manifest GET/preflight works cross-origin; dynamic-page CORS is exact-origin and permits authorization; local HTTP names and accepts only its exact parent origin under the explicit mode flag; HTTPS rejects HTTP parents and uses exact `frame-ancestors`; `loaded` sent before framework mount is recovered and revalidated; Account Settings accepts a minimal trusted bootstrap; `tokenRefresh` works; dynamic pages are authenticated and tenant-scoped. |
| Provider administration | Account-admin authorization precedes access; GET is an exact secret-free DTO containing the full derived account webhook URL but no separate route key; omitted/exactly-empty secrets preserve; whitespace-only replacements fail; opaque unchanged replacements produce no vault or JSON write; stale revisions fail closed; persisted JSON contains no provider or user credential. |
| GitHub connection | Standard OAuth App user flow validates state/PKCE, user identity, and lifecycle-adequate scopes; vaults the token; bounds admin-capable repositories; reconciles/deletes one managed hook per watch; and verifies the distinct raw-body `X-Hub-Signature-256` HMAC through one account-keyed route. |
| GitLab connection | Exact allowlisted HTTPS SaaS/self-managed origin; state/S256 PKCE; verified `api read_repository`; atomic vaulted access/refresh rotation; bounded Maintainer-or-Owner project discovery; project-hook reconcile/delete; explicit standard-signed or legacy-token profile; and account-scoped delivery verification. |
| Hook lifecycle | Enable is idempotent; rotation has bounded old/new overlap; unwatch and disconnect remove provider hooks before credential revocation; partial cleanup remains visible and retryable. |

Do not mutate a shared or production cluster merely to prove rendering. Deploy only when the user asks or the existing workflow clearly authorizes it.
