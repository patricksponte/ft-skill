---
name: create-fieldtwin-integration
description: Create and scaffold a FieldTwin external integration, either as a single self-contained index.html page or as a production-ready repository, including the web application, manifest and dynamic pages, Account Settings provider administration, Docker image, Helm chart, Environment Modules, Tilt local workflow, devops.sh commands, build-pipeline.js build-bot entrypoint, secrets boundary, and deployment validation. ALWAYS use when starting a new FieldTwin integration, choosing between a single-page and a full-repository integration, building a quick or demo integration as one static HTML file, converting a prototype into a deployable integration, promoting a single-page integration to a repository, or adding the standard FutureOn Kubernetes repository architecture to an integration.
license: ISC
metadata:
  author: FutureOn AS
  version: "0.4.0"
---

# Create FieldTwin Integrations

Create the smallest thing that works: a single static page when that is enough, otherwise one repository that developers, Tilt, the build bot, Helm, and FieldTwin can all use without maintaining separate deployment paths. Use `develop-fieldtwin-integration` alongside this skill for the browser bridge, manifest protocol, JWT lifecycle, messages, and protocol tests.

## 0. Choose the integration shape first

Decide this before creating any file, and state the decision to the user. Two shapes:

- **Single page**: one self-contained `index.html` served by any static host. No npm, no build
  step, no Docker, no Helm, no Tilt. Deploy by copying one file.
- **Full repository**: the application, Dockerfile, Helm chart, Environment Modules, Tilt,
  `devops.sh`, and `build-pipeline.js` described in sections 1-7.

Pick the recommendation from what the integration actually needs, then ask the user to confirm it
in one question with the reason. Proceed with the recommendation if the user does not care.

Recommend **single page** when the integration is a demo, prototype, proof of concept, internal
tool, or one panel that only reads host events and calls the FieldTwin API with the host-issued
token, and the user asks for something quick, simple, or easy to deploy.

Recommend **full repository** when any of these is in scope, because none of them can live in a
static file: a server-side secret or credential vault, an OAuth flow, an inbound webhook, an
automation `readUrl`/`invokeUrl`, a `dynamicPagesUrl` endpoint, Account Settings provider
administration, persistence, a background worker, a team deploying through Kubernetes or the build
bot, or a server-side JWT verification boundary.

When a single-page integration later needs one of those, promote it: re-run this skill for the
full repository shape and move the existing page into the application. The bridge, message
handling, and API code carry over unchanged, so starting single-page is not a dead end.

### Building the single-page shape

Everything in `develop-fieldtwin-integration` still applies: exact origin and source pinning, the
in-memory JWT, `tokenRefresh`, exact message shapes, and teardown. Sections 1-7 below do not.

- Write one `index.html` with inline `<style>` and an inline ES module. Load any library from a
  pinned CDN `<script src>`. Add a build step only when the user asks for one.
- Serve it over HTTPS from the static host; use HTTP only in an explicit local development mode.
- Set `useGET: true` in the manifest. The default POST loading flow needs a server that accepts
  POST, and static hosts answer it with 405. Add `noURLParams: true` and initialize from the
  `loaded` event so bootstrap fields stay out of the URL.
- Ship `manifest.json` as a second static file next to the page, with absolute URLs and
  `Access-Control-Allow-Origin: *`, or let the administrator enter the page URL directly when the
  host allows it. A manifest is the only file besides the page itself.
- Prefer a static host that can set response headers, so CSP `frame-ancestors` can name the exact
  FieldTwin origins. Where the host cannot set headers, the page is embeddable by anyone; the
  exact origin and source checks in the bridge are then the only trust boundary, so they are not
  optional.
- Register the message listener in the first inline script in `<head>`, before the body, so the
  one-shot `loaded` event cannot arrive before the listener exists.

Sections 1-7 describe the full-repository shape. Read
[references/repository-and-deployment.md](references/repository-and-deployment.md) before editing
it. Inspect one current integration for local conventions, but do not copy obsolete secrets,
generic image names, or required ConfigMaps without confirming they are needed.

## 1. Establish names and boundaries

- Choose a lowercase hyphenated integration slug such as `equipment-insights`.
- Keep the build-bot component key stable, commonly `main`, while giving every OCI repository a program-qualified name such as `equipment-insights-main`. Never publish a generic `main` image.
- Define the Helm release, control namespace, runtime namespace, DNS domain, service names, container port, and local forward port once and reuse them.
- Define one public application origin from the environment's ingress hostname and TLS mode. Derive
  manifest, icon, dynamic-page, OAuth callback, webhook, and worker URLs from it; never hard-code
  `https://` into individual URLs. Permit HTTP only in an explicit local development mode.
- Configure the FieldTwin parent-origin allowlist per environment. The local module must name the
  actual exact HTTP parent origin used by local FieldTwin, and the bridge/server may accept it only
  when that same explicit local HTTP mode is enabled. Shared environments remain HTTPS-only.
- Separate ordinary environment values from credentials. Put non-secret configuration in module-selected Helm `environment` values. Reference an externally managed Secret only for deployment bootstrap credentials such as OAuth-session encryption and vault access. Store tenant provider client secrets, webhook signing secrets, and user tokens in the encrypted credential vault; never load them from pod environment variables.
- Do not require a ConfigMap merely to start a pod. Add one only for a real mounted or independently managed configuration artifact.

## 2. Create the repository skeleton

Create the applicable paths from the reference tree. At minimum include:

- the application under `fullstacks/main/` with its own package lock and Dockerfile;
- a root package with operational aliases;
- `helm/integration/` as the Kubernetes source of truth;
- `modules/localdev`, `modules/dev`, and the shared-environment module when used;
- `Tiltfile`, `devops.sh`, and `build-pipeline.js` at repository root;
- `.dockerignore`, environment inventory, migrations, and operational documentation when required.

Use the latest stable version of the user-selected framework. For SvelteKit, use Svelte 5, the current SvelteKit release, `adapter-node`, and a Node production server. Keep framework code inside the application directory; keep deployment orchestration at the root.

## 3. Implement the FieldTwin surface

- Serve a stable manifest endpoint and integration page.
- Generate every manifest URL from the configured public origin so HTTP-only Tilt environments and
  HTTPS shared environments remain internally consistent.
- Make the public manifest cross-origin readable: support `GET` and `OPTIONS`, return JSON, and set
  `Access-Control-Allow-Origin: *` when the response is credential-free, or echo a validated exact
  origin when deployment policy requires an allowlist. Test with the actual FieldTwin Admin origin.
- Add `dynamicPagesUrl` when page availability depends on deployed or tenant-scoped state. Authenticate dynamic-page requests and derive project scope only from verified claims.
- When the integration participates in FieldTwin automations, declare capabilities with the
  `automationDescriptor` postMessage after `loaded`, serve the declared `readUrl`/`invokeUrl`
  endpoints over HTTPS with FieldTwin JWT verification, and signal attribute changes from the
  integration backend via `POST /automation/event` (see the develop skill's message catalog and
  "Participate in FieldTwin automations" recipe).
- If FieldTwin fetches dynamic pages from the browser, handle `OPTIONS` and allow `POST`,
  `Authorization`, and `Content-Type`. Echo only a configured exact FieldTwin origin and send
  `Vary: Origin`; never use wildcard origin with browser credentials.
- Treat CORS response headers and iframe CSP `frame-ancestors` as separate controls. Configure and
  test both through the production server and ingress, not only the framework development server.
- For shared and production HTTPS deployments, allow iframe embedding with CSP `frame-ancestors`
  set to the configured exact FieldTwin frontend origins. Do not emit `X-Frame-Options: DENY` or
  `SAMEORIGIN`. An explicitly enabled local HTTP mode may omit the child `frame-ancestors`
  restriction to match the standard local integration workflow; never carry that relaxation into
  HTTPS deployments.
- Keep the integration document compatible with a cross-origin FieldTwin pop-out. Configure the
  application server, security middleware, ingress, and CDN so the final response omits
  `Cross-Origin-Opener-Policy` or sends `unsafe-none`; do not inject `same-origin` or
  `noopener-allow-popups`. Do not invent or rely on `X-IFrame-Allow`/`X-Frame-Allow`; browsers do
  not use those headers to allow embedding or retain an opener.
- Diagnose iframe failures by layer: the integration controls `frame-ancestors` and
  `X-Frame-Options`; FieldTwin controls its parent-page `frame-src`; the browser controls mixed
  content. Relaxing child response headers cannot make an HTTPS parent embed an HTTP child.
- Install the `loaded` receiver before the browser reaches the document-load boundary, not merely
  from a framework client hook. SvelteKit dynamically imports `hooks.client`, so that hook can run
  after FieldTwin's iframe `load` callback has already posted the one-shot bootstrap. Use a
  parser-time module from `app.html`, keep its bounded queue in that module's closure, attach the
  bridge listener before draining it, and revalidate origin, source, and payload.
- Accept the bootstrap fields required by each page. In particular, an Account Settings page may
  receive a token without project API fields; it can use that token for an authenticated
  same-origin control-plane endpoint, while its FieldTwin API helper must remain unavailable until
  `backendUrl` and `APIVersion` are present.
- Validate a host-supplied `backendUrl` under the same deployment scheme policy as the parent
  origin. Exact HTTP is permitted only in explicit local mode; shared and production deployments
  remain HTTPS-only. Preserve its base path when constructing FieldTwin API URLs.
- Implement exact-origin and exact-source `loaded`/`tokenRefresh` handling with the JWT kept in memory.
- Keep tokens, account IDs, and project IDs out of page URLs, logs, storage, and analytics.
- Test iframe and pop-out lifecycle, effective response headers through ingress, opener retention,
  teardown, malformed input, and token refresh using `develop-fieldtwin-integration`.
- Put account-wide provider application setup under `accountSettingsUrl` and authorize reads and writes with a verified account-admin claim. Return an exact public DTO containing public identifiers, derived callback/webhook URLs, a revision, and secret-presence booleans only. Keep every secret input empty on reload.
- Treat an omitted or exactly empty secret field as “preserve the saved value,” while rejecting a
  nonempty whitespace-only replacement. Secrets are opaque: after only canonicalization explicitly
  required by the provider, compare bytes with a constant-time primitive or constant-time digest;
  never trim, case-fold, or Unicode-normalize them. When unchanged, skip vault, JSON, timestamp,
  and revision writes.
- For GitHub, use a standard OAuth App user authorization flow rather than a GitHub App
  installation. Vault the authorized user's token, expose only repositories where that user can
  administer hooks, and reconcile one normal repository webhook per watch. Verify GitHub's
  `X-Hub-Signature-256` as an HMAC over the raw body. Request `admin:repo_hook` (or the broader
  `repo`) when unwatch/disconnect must delete hooks; `write:repo_hook` alone does not cover the
  complete cleanup lifecycle.
- For GitLab, accept only an exact deployment-allowlisted HTTPS origin (`https://gitlab.com` or an
  explicitly approved self-managed origin). Use state plus S256 PKCE, request and verify `api` and
  `read_repository`, vault the access/refresh-token pair, refresh it with a single-flight atomic
  replacement, bound project discovery to Maintainer-or-Owner projects, and reconcile project
  hooks. Persist an explicit versioned GitLab webhook verification profile; never infer a legacy
  fallback from a missing signature header.
- Give each FieldTwin account/provider a stable random opaque webhook route. The derived full URL
  is safe-to-display routing metadata but not authentication; expose no separate raw route-key DTO
  field. Resolve one account before decrypting its signing secret, authenticate the provider's
  exact webhook envelope, and keep repository matching within that account.

## 4. Build one image consistently

- Use a multi-stage Dockerfile with deterministic dependency installation, application and worker builds, a minimal non-root production stage, a read-only-compatible filesystem, and a health check.
- Keep the production root filesystem read-only, but make the local development stage writable when Vite, live update, or dependency refresh must write under the application directory.
- Use the same program-qualified image repository in Tilt, `devops.sh`, Helm values/templates, documentation, and registry examples.
- Keep the build-bot component key separate from the OCI repository name. `build-pipeline.js` may ask `devops.sh` to build `main`; `devops.sh` maps `main` to `<integration>-main`.
- Make `npm start` invoke the root Tilt workflow. Provide a distinct command such as `npm run start:app` for running the built Node application directly.

## 5. Make Kubernetes environments explicit

- Render non-secret module parameters directly into pod environment variables through Helm.
- Make the ingress TLS switch control the public-origin scheme and SSL-redirect behavior together.
  Inject the same public origin into every web or worker process that generates external URLs.
- Keep credential values out of modules, Helm values, Docker build arguments, and source control. Reference a Secret managed by the cluster's approved secret system only for deployment bootstrap credentials. Provider application credentials configured in Account Settings belong in the server-side vault.
- Make optional workers and their namespaces, service accounts, RBAC, quotas, and limits conditional on one `worker.enabled` value.
- Disable credential-dependent workers in local development unless the local module also provisions every dependency. A web/demo mode must not reference missing Secrets or ConfigMaps.
- Use least-privilege service accounts, no default service-account token for the web pod, restricted pod security, probes, resources, and immutable image tags or digests in shared environments.
- Keep Helm authoritative. Do not add a competing raw-YAML deployment path.

## 6. Wire local and automated workflows

- Modules select registry, Kubernetes context, namespaces, release, DNS domain, build target, worker state, pull-secret names, and non-secret Helm environment values.
- Tilt builds the same Dockerfile and image repository as CI, renders the same Helm chart, registers the rendered resource names, and supports live update.
- `devops.sh` exposes build, push, deploy, render, lint, status, logs, restart, and teardown operations. It creates or copies only resources enabled for the selected environment.
- `build-pipeline.js` builds each component, pushes it, then deploys. Do not duplicate build logic in the pipeline file.
- Ensure a stale local shell cannot accidentally enable production-only resources. Derive safe defaults from the selected local module and validate booleans.

## 7. Validate the complete path

For a single-page integration, validate only what it has: manifest GET and OPTIONS from a
cross-origin request, `useGET` loading, iframe and pop-out lifecycle, exact origin and source
rejection, token refresh, the authenticated API boundary, and teardown.

For a full repository, before handoff:

- lint the Helm chart;
- render every committed module and inspect image names, environment values, Secret/ConfigMap references, replicas, and optional resources;
- run Kubernetes client-side dry-run on rendered manifests;
- evaluate the Tiltfile using the local module and confirm the expected image and resources;
- run format, lint, type checks, tests, and both application and worker production builds;
- build the Docker image when a daemon is available;
- confirm `npm start` reaches Tilt and the direct application command remains separate;
- verify manifest GET and OPTIONS from a cross-origin request, dynamic-pages preflight and response,
  iframe response headers in local and HTTPS modes, FieldTwin lifecycle, and the authenticated API
  boundary;
- verify provider Account Settings safe GET/PATCH behavior, admin authorization, empty-secret
  preservation, whitespace-only rejection, opaque unchanged-secret no-op persistence, vault-only
  provider/user credentials, GitHub and GitLab OAuth/token lifecycles, per-repository/project hook
  reconciliation and cleanup, account-keyed routing, and provider-specific webhook verification;
- report missing live-cluster, registry, database, or migration validation explicitly.

## Handoff

Report the chosen shape and why it was chosen. For a single page, report the file, the manifest URL, the static host, the header situation, and what would force a promotion to a repository. For a repository, report the chosen component-to-image mapping, module behavior, deployment bootstrap Secrets, Account Settings provider boundary, callback and tenant webhook endpoints, validation results, and exact commands for local start and deployment. Call out any compatibility or migration step for an existing integration.
