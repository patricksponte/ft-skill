# Documentation map

Use this page to choose a source before implementing a FieldTwin integration.

This bundle was verified against the FieldTwin integration guide revision 58 on 2026-08-19 and
the public API guidance plus current v1.10/v2.0 server contracts on 2026-08-22. Treat those dates as
provenance, not as a promise that every deployment exposes the same revision.

## Source priority

1. The contract documented for the FieldTwin environment the user is integrating with.
2. Current public FieldTwin documentation:
   - [FieldTwin documentation center](https://docs.fieldtwin.com/)
   - [FieldTwin API documentation](https://api.fieldtwin.com/)
   - [FieldTwin Admin integration configuration](https://docs.fieldtwin.com/admin/b_integrations/)
3. The user's working integration code, tests, and captured messages.
4. These bundled references and fictional samples.

FieldTwin deployments can differ by release and configuration. If a current documented message differs from this bundle, follow the deployed contract and update tests and documentation together.

## Bundled references

| Need | Read |
| --- | --- |
| End-to-end development, Tilt/Helm, local HTTP, bootstrap/auth diagnosis | `development-workflow.md` |
| Static manifest, dynamic pages, placement, background behavior, pop-outs | `manifest-and-loading.md` |
| Secure `postMessage` bridge, `loaded`, token refresh, API calls, teardown | `bridge-and-api.md` |
| Backend/API authentication, version choice, URL safety, readiness, errors | `backend-api.md` |
| v1.10 account/configuration and subproject endpoint catalog | `backend-api-v1.10.md` |
| v2.0 stream CRUD, GET filters, resource ownership, specialized endpoints | `backend-api-v2.0.md` |
| v1.10 and v2.0 batch envelopes, ordering, failure and recovery | `backend-api-batch.md` |
| Complete readable/writable API field catalog and narrow lookup commands | `api-attributes.md` |
| Complete bidirectional postMessage event/field catalog and narrow lookup commands | `postmessage-attributes.md` |
| Common event names and payload placement, automation descriptors and attribute webhooks | `message-catalog.md` |
| Complete integration-to-host event matrix and canonical resource-type values | `integration-to-host-events.md` |
| Operation Search, actions, filters, menus, panels, time series | `operation-mode.md` |
| Host-side system highlighting, metadata-backed connection bundles, multi-channel flow and direction | `system-highlighting.md` |
| Resource queries, selection, focus, settings, notifications, automation participation | `recipes.md` |
| Threat model, review checklist, automated/manual tests | `security-and-testing.md` |

## Protocol invariants

- Messages are structured-cloneable objects with an `event` string.
- FieldTwin sends the initial `loaded` event; an integration does not need to announce readiness first.
- Treat the host origin, source window, JWT, project identifiers, user attributes, and resource payloads as security-sensitive.
- Keep the JWT only in memory and replace it on `tokenRefresh`.
- Use the trusted `backendUrl` and `APIVersion`; preserve a backend path and do not silently upgrade
  a tenant from v1.10 to v2.0.
- Keep API-token and bearer-JWT authentication mutually exclusive. Browser integrations use the
  short-lived JWT, never an account API token.
- v1.10 resource endpoints and v2.0 stream CRUD are different contracts. Do not translate their
  paths, bodies, or response containers by naming symmetry.
- API fields are operation-specific. Query the attribute catalog and keep GET responses, POST,
  PATCH, DELETE, and v2 stream variants separate.
- Message fields are direction-, event-, variant-, surface-, and delivery-specific. Query the
  postMessage catalog before building or reviewing an envelope.
- A mutation batch belongs to one stream. A response batch ID is correlation, not idempotency.
- Pin the exact host origin and source window after a trusted bootstrap.
- Embedded integrations use a parent window; pop-outs use an opener window.
- Some fields are top-level and others are inside `data`. Preserve the documented shape exactly.
- `customTabId` distinguishes integration instances. Do not broadcast instance-specific actions to every integration.
- Selection and camera focus are different operations. Use `focusSelection: false` for selection-only requests.
- Use only documented correlation fields. Current common examples are `queryId` for resource queries and `reqId` for time-series data.

## Public-sample policy

Every bundled domain, token, identifier, tag, coordinate, asset name, and measurement is fictional. Replace placeholders through deployment configuration; do not hard-code a production tenant or customer value into reusable integration code.

Do not copy examples that:

- send normal production messages with `targetOrigin: '*'`;
- accept origins with substring or prefix matching;
- decode a JWT without verifying it when authorization depends on its claims;
- print or persist a JWT;
- place a JWT or user identifier in an iframe URL;
- leave listeners, timers, or pending-request maps alive after unmount.
