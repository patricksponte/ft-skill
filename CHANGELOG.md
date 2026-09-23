# Changelog

## 0.8.0 - 2026-09-18

- `updateTagStyles` rules now require a `category`. Users enable or disable whole categories from the
  Operation toolbar's *Integration tag styles* menu, so a rule the host cannot attribute to a category
  is dropped and counted in the reply's new `ignored` field.

## 0.7.0 - 2026-09-15

- `create-fieldtwin-integration` now chooses the integration shape before creating any file: a
  single self-contained `index.html` on a static host, or the full repository with Docker, Helm,
  Environment Modules, Tilt, and `build-pipeline.js`.
- The skill recommends one shape from what the integration actually needs, states the reason, and
  asks the user to confirm. Server-side secrets, OAuth, webhooks, automations, dynamic pages,
  Account Settings provider administration, persistence, and workers force the repository shape.
- Documented the single-page rules that differ: `useGET` with `noURLParams` because static hosts
  reject the default POST loading flow, a static `manifest.json`, a parser-time listener in
  `<head>`, and the origin/source pinning that becomes the only trust boundary when the host
  cannot set `frame-ancestors`.
- Documented promotion from a single page to a repository as a supported path, so the quick shape
  is not a dead end.

## 0.6.0 - 2026-08-22

- Added a generated, searchable host-client `postMessage` catalog with 94 message variants, 46
  distinct host-to-integration events, 47 distinct integration-to-host events, and 878 effective
  fields, including exact top-level/nested placement, required flags, allowed values, and notes.
- Kept shared event-name variants separate, including viewport versus Operation Search `select`,
  normal augmented host sends versus direct replies, bootstrap messages, and binary Blob replies.
- Covered bootstrap/token lifecycle, API readiness, selections, resource lifecycle and mutations,
  queries/replies, annotations, exports, settings, modal surfaces, Operation Mode, time series,
  Project Settings, and released automation supplements.
- Added a narrow query command for direction, event, variant, category, surface, delivery, and field;
  documented iframe parent versus pop-out opener routing, trusted source identity, and correlation.
- Added generator source-coverage checks against the main host dispatcher, package completeness
  validation, public-guide routing, and evaluation cases for bootstrap, replies, Operation Mode,
  pop-outs, and surface-specific messages.

## 0.5.0 - 2026-08-22

- Added generated, exhaustive API attribute catalogs: 275 effective v1.10 operations with 7,871
  documented header/path/query/body/response fields, plus 101 v2.0 readable resource types and
  every per-stream POST/PATCH/DELETE Joi field.
- Flattened all 32 v2 OpenAPI operations and 7,299 operation attributes, including standard stream
  envelopes, request headers and filters, uploads, summaries, hierarchy, crossings, height samples,
  schematics, and JSON/SVG response variants.
- Kept v2 response attributes, calculated stream additions, exclusions, and stream-specific write
  variants separate so GET-only fields are not presented as writable and one stream's schema is
  not silently reused by another.
- Added a standard-library lookup command for version, operation, path/group, stream, resource,
  method, location, and nested field searches without loading multi-megabyte catalogs into context.
- Added a reproducible generator, built-in user-right expansion, completeness checks in package
  validation, documentation routing, and evaluation cases for staged assets and user schemas.

## 0.4.0 - 2026-08-22

- Added a complete FieldTwin backend API guide covering trusted base URL/version selection,
  integration JWT versus server API-token authentication, gateway-derived scope, readiness,
  response headers, status handling, bounded retry, and mutation reconciliation.
- Added a v1.10 catalog for account/configuration, projects, qualified subproject branches,
  individual layout resources, specialized geometry/schematic operations, and both batch styles.
- Added a v2.0 guide for tenant OpenAPI discovery, normalized users/account/project/subproject/
  workflow streams, GET envelopes and filters, supported mutation families, root ownership,
  specialized endpoints, summary semantics, external parents, and non-JSON/streamed responses.
- Added shared batch documentation with POST/PATCH/DELETE envelopes, globals precedence,
  dependency order, one-stream constraints, transaction boundaries, batch correlation, sizing,
  uncertain-response recovery, and a focused validation matrix.
- Corrected the bridge API example to use a v1.10 project path with a qualified branch ID and fixed
  local-HTTP bootstrap parsing to consistently apply the configured scheme policy.

## 0.3.4 - 2026-08-22

- Added the HTTP response contract required by integrations that support both iframe and pop-out
  modes, including final-response checks through middleware, ingress, reverse proxies, and CDNs.
- Required the integration document to omit COOP or use `unsafe-none`, prohibited opener-severing
  `same-origin`/`noopener-allow-popups`, and documented the FieldTwin opener's matching policy.
- Clarified that `X-IFrame-Allow` and `X-Frame-Allow` are non-standard, while iframe `allow` and
  `Permissions-Policy` control capabilities rather than embedding or opener retention.
- Added response-header and real FieldTwin pop-out evaluation cases covering CSP, XFO, COOP/COEP,
  opener retention, bidirectional messaging, teardown, and proxy-injected conflicts.

## 0.3.3 - 2026-08-22

- Clarified that `postMessage` supports pop-outs while an iframe-only
  `window.parent.postMessage(...)` sender does not: pop-outs must target their trusted opener.
- Updated the bridge guidance to resolve parent versus opener during `loaded`, pin the exact source
  window and origin, and route every outbound message through that pair.
- Documented fail-closed behavior for direct top-level visits, severed openers, and incompatible
  opener policy, with focused iframe, pop-out, missing-opener, and outbound-routing tests.

## 0.3.2 - 2026-08-20

- Added host-side Operation Mode guidance for resolving direct connection-kind metadata as stable
  logical channels on a physical connection, including defaults, project overrides, repeated
  categories, and an explicit non-recursive constituent scope.
- Defined per-channel direction precedence and endpoint-relative semantics so one metadata-backed
  bundle can display Oil and Gas flowing independently without matching customer-defined labels.
- Documented single-pass lateral-band rendering, segment phase propagation, live metadata
  invalidation, regeneration/disposal behavior, large-bundle policy, and focused regression tests.
- Clarified that built-in system highlighting is host-owned and must not overload
  `visualFilteringUpdate` or silently create a new integration protocol contract.

## 0.3.1 - 2026-08-19

- Added a complete integration-to-host event matrix with exact payload placement, reply events,
  correlation fields, and links to the deeper Operation Mode contracts.
- Distinguished singular selection/navigation `type` values such as `stagedAsset` from canonical
  plural collection values such as `stagedAssets` and `subProjects` used by `resourceType` and
  `resourceTypes` fields.
- Documented `getResources` aliases, missing-resource behavior, canonical root-resource values,
  and fully qualified `resourceId:streamId` handling, including the main-stream short-ID fallback.
- Corrected existing resource-query examples and added an evaluation that rejects `subProject` and
  `stagedAsset` when used as collection `resourceType` values.

## 0.3.0 - 2026-08-14

- Documented the FieldTwin automation contract for integrations: the `automationDescriptor`
  declaration (attributes and functions with https-only `readUrl`/`invokeUrl`, entry and size
  caps, authoring-only entries without a URL), the short-lived JWT the automation service sends
  when invoking declared endpoints, and the `POST /automation/event` webhook that fires
  attribute-triggered automations without an open client.
- Added the `attributeUpdated` postMessage (client cache refresh only - never starts a run) and
  a copy-ready "Participate in FieldTwin automations" recipe covering declaration, endpoint
  serving, and backend-originated webhook signalling.
- Documented the complete automation value-type vocabulary (`string`, `number`, `boolean`,
  `date`, `tags`, `resource`, `resources`, `object`, `any`) with JSON wire shapes for attribute
  types, function parameter types, and function returns; the host drops entries declaring
  anything outside it.
- Documented multi-output automation functions: `returns` as an array of unique named
  `{ id, type }` outputs, the object-keyed response contract, per-output wiring in the
  automation editor, and the explicit failure when a declared multi-output function responds
  with a non-object.

## 0.2.9 - 2026-08-13

- Added a complete GitLab provider contract with exact allowlisted HTTPS SaaS/self-managed origins,
  state and S256 PKCE, `api read_repository`, atomic vaulted access/refresh rotation, bounded
  Maintainer project discovery, and project-hook lifecycle reconciliation.
- Versioned GitLab Standard Webhooks HMAC verification separately from legacy plaintext
  `X-Gitlab-Token`, kept GitHub's raw-body `X-Hub-Signature-256` construction distinct, and added
  rotation, unwatch, disconnect, replay, and partial-cleanup requirements.
- Clarified that full account-keyed webhook URLs are displayable routing metadata rather than
  authentication, corrected exactly-empty versus whitespace-only secret behavior, and required
  opaque constant-time secret comparison without trimming, case folding, or Unicode normalization.
- Expanded create/develop evaluations for both GitHub and GitLab provider, token, webhook, routing,
  and cleanup lifecycles.

## 0.2.8 - 2026-08-13

- Added the account-scoped provider administration contract: exact safe DTOs, blank secret inputs,
  configured booleans, dirty-only PATCH, server-side semantic comparison, revision CAS, and no-op
  persistence when a submitted secret is unchanged.
- Replaced the GitHub App installation recipe with a standard GitHub OAuth App user flow using
  state, S256 PKCE, vaulted user tokens, bounded admin-capable repository discovery, and
  per-repository webhook reconciliation.
- Added per-tenant opaque webhook routing, server-only signing-secret resolution, and regression
  requirements for secret non-disclosure, cross-tenant isolation, revision drift, and vault safety.

## 0.2.7 - 2026-08-13

- Added provider readiness validation before intent/state mutation, sanitized unavailable errors,
  and external Secret wiring requirements for local Tilt as well as shared deployments.
- Documented production `Secure` `__Host-` callback cookies and the separate, explicitly selected
  non-Secure host-only cookie required by an HTTP-only local workflow.
- Added the complete two-stage GitHub App installation/user-OAuth validation path and an optional
  encrypted single-node file-vault contract with security and regression requirements.
- Distinguished browser callback reachability from GitHub webhook reachability for local ingress
  and required exact App URL updates when an HTTPS tunnel is used.

## 0.2.6 - 2026-08-13

- Updated the creation skill to scaffold Account Settings provider administration, deployment-
  bootstrap-only Kubernetes Secrets, standard GitHub OAuth user authorization, normal
  per-repository hooks, tenant-scoped webhook routing, and vault-only provider credentials.
- Added one end-to-end FieldTwin development workflow connecting repository conventions,
  Environment Modules, Tilt, Helm, program-qualified images, file-backed persistence, public URL
  generation, CORS, iframe policy, Account Settings, dynamic pages, bootstrap, and server auth.
- Added a symptom-first diagnostic matrix for missed `loaded`, verifier failures, local scheme
  mismatches, iframe blocks, missing ConfigMaps, generic images, and persistent-volume mistakes.
- Expanded the development skill trigger and evaluation set so local Kubernetes and Account
  Settings failures select and exercise the complete workflow.

## 0.2.5 - 2026-08-13

- Corrected SvelteKit bootstrap guidance: `hooks.client` is dynamically imported and can run after
  FieldTwin posts from the iframe `load` callback, so capture must start from a parser-time module
  loaded by `app.html` before the framework body/bootstrap.
- Required the bounded token-bearing queue to remain in that module's private closure and added a
  real browser-order regression case.
- Applied explicit local-HTTP policy to the host-supplied `backendUrl`, required preservation of
  backend base paths, and documented the legacy FieldTwin public-key JWT profile.

## 0.2.4 - 2026-08-13

- Documented that local HTTP changes the trusted FieldTwin parent message origin as well as the
  generated integration URL.
- Required local modules to configure the actual exact HTTP parent and gate acceptance through the
  same explicit TLS/development mode, while keeping shared and production origins HTTPS-only.
- Added regression requirements for accepted explicit local HTTP parents and fail-closed HTTP
  configuration outside local mode.

## 0.2.3 - 2026-08-13

- Required `loaded` capture before framework mount or hydration because FieldTwin has no client
  readiness handshake, with a bounded module-private handoff that reuses normal trust validation.
- Documented page-specific bootstrap validation so Account Settings can authenticate same-origin
  control-plane requests without unused project API fields while API helpers remain fail-closed.
- Added regression coverage requirements for early trusted and untrusted bootstrap messages,
  minimal Account Settings payloads, cleanup, and token non-disclosure.

## 0.2.2 - 2026-08-12

- Added mode-aware iframe response guidance: exact `frame-ancestors` for HTTPS deployments and a
  narrowly scoped omission for explicitly enabled local HTTP mode.
- Added diagnosis for child `frame-ancestors`/`X-Frame-Options`, parent `frame-src`, and browser
  mixed-content blocking, with ingress-header and real-iframe validation requirements.

## 0.2.1 - 2026-08-12

- Added production manifest and dynamic-page CORS requirements to both integration skills,
  including preflight behavior, exact-origin guidance for authenticated endpoints, and validation
  through the deployed ingress.
- Clarified that CORS and iframe `frame-ancestors` are independent browser security controls.
- Added one-origin URL generation guidance so HTTP-only Tilt environments and HTTPS deployments
  consistently generate manifest, icon, dynamic-page, callback, webhook, and worker URLs.

## 0.2.0 - 2026-08-12

- Added `create-fieldtwin-integration` for repository scaffolding, program-qualified image naming,
  Docker, Helm, Environment Modules, Tilt, build-bot, secrets, and deployment validation workflows.
- Generalized package validation and documentation for multiple complementary skills.

## 0.1.0 - 2026-08-12

- Initial public Agent Skill following the open Agent Skills specification.
- Added secure iframe bootstrap, token refresh, API, and pop-out guidance.
- Added manifests, dynamic pages, common message recipes, and testing guidance.
- Added Operation Search results, progress, Font Awesome actions, double-click actions, visual filters, context menus, navigation, and time-series examples.
