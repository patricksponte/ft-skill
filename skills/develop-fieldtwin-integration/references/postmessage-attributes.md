# Host-client postMessage attributes

Use this reference when a task asks which fields a FieldTwin host or integration can send, which
side owns a message, whether a field is top-level or under `data`, how a response is correlated, or
whether a message works in an iframe and a pop-out.

The generated catalog in [postmessage-attributes.json](postmessage-attributes.json) contains 94
message variants, 46 distinct host-to-integration event names, 47 distinct integration-to-host
event names, and 879 effective fields. A variant is a distinct wire shape sharing an event name:
for example, host `select` has separate viewport-selection and Operation Search result-selection
variants. Direct replies also remain distinct from normal host notifications.

Do not load the JSON catalog wholesale. Query only the event, direction, variant, surface, or field
needed by the task:

```bash
python3 skills/develop-fieldtwin-integration/scripts/query-postmessage-attributes.py \
  --direction host-to-integration \
  --event loaded

python3 skills/develop-fieldtwin-integration/scripts/query-postmessage-attributes.py \
  --direction integration-to-host \
  --event select \
  --variant select-resources

python3 skills/develop-fieldtwin-integration/scripts/query-postmessage-attributes.py \
  --event timeSeries \
  --field reqId

python3 skills/develop-fieldtwin-integration/scripts/query-postmessage-attributes.py \
  --surface pop-out \
  --list-events
```

Available filters are:

| Filter | Meaning |
| --- | --- |
| `--direction` | `host-to-integration` or `integration-to-host` |
| `--event` | Exact or partial case-insensitive event name |
| `--variant` | One specific wire shape of an event |
| `--category` | Lifecycle, selection, query, mutation, Operation Mode, modal, settings, automation, and so on |
| `--surface` | Designer, Presenter, Dashboard, Account Settings, Project Settings, modal, pop-out, or automation-enabled host |
| `--delivery` | Normal augmented host send, bootstrap send, direct reply, or integration send |
| `--field` | Nested field-path substring such as `selectedPartIndices`, `queryId`, or `data.results[].actions` |
| `--list-events` | Compact event/variant index instead of field tables |
| `--json` | Machine-readable filtered output |

## Read a result correctly

Every result identifies:

- direction, exact case-sensitive event name, and variant;
- eligible host surfaces and transport/delivery path;
- every effective field with its exact top-level or nested path, type, required flag, allowed or
  constant value, transport-supplied status, sensitive status, and description;
- correlation rule, direct/asynchronous/binary reply, and routing notes.

`sendMessage` host notifications acquire `isFrameActive`, `isOperation`, `APIServerIsReady`,
`APIVersion`, and `siblingAPIServerAreReady`. JSON replies sent directly to `event.source` acquire
`doNotProcessMessage`, `responseToEvent`, and `isOperation`. A direct `Blob` reply is the exception:
it has no JSON event or reply decorators. The catalog materializes these transport fields in each
affected variant so an event query returns the complete received shape.

## Iframe and pop-out transport

The message objects are the same in an iframe and a pop-out; only the trusted target window changes.
An embedded integration targets its pinned `window.parent`. A popped-out integration targets its
pinned `window.opener`. Accept `loaded` only from the expected window and an allowlisted exact
origin, then pin both `event.source` and `event.origin` for every later receive and send.

Do not call `window.parent.postMessage` from feature code. In a pop-out, `window.parent` is the
integration window itself. Route all outbound messages through the bridge. Never use `*` for the
JWT or normal production messages. A pop-out also requires an effective HTTP response policy that
preserves `window.opener`; read [manifest-and-loading.md](manifest-and-loading.md) and
[security-and-testing.md](security-and-testing.md) for CSP, X-Frame-Options, COOP/COEP, ingress,
and the non-standard status of `X-IFrame-Allow`.

## Identity and correlation are not interchangeable

For normal integration-to-host messages, FieldTwin derives the sender from the registered source
window. Do not invent or trust a client-supplied `integrationId` or `customTabId` unless the selected
event variant explicitly lists that field. Host targeting metadata such as the `integrationId` on an
Operation Search action describes the trusted result owner; it is not a general request ID.

Use only the correlation field listed by the selected variant:

- `queryId` for resource, cost, annotation, and GeoJSON request/reply pairs that document it;
- `senderId` plus the host-derived `customTabId` for later `select`/`unselect` echoes;
- `requestId` for `requestTagsInfos` → `updateTagStyles`;
- `reqId` for `getTimeSeriesData` → `timeSeriesData`;
- `responseToEvent` only to identify the request class for an otherwise uncorrelated direct reply.

Do not invent a request ID for events whose released reply does not echo one. Serialize competing
uncorrelated settings operations or maintain one in-flight request per event class.

## Resource-specific nested objects

The catalog enumerates every protocol field. A few protocol fields intentionally contain a
resource-specific object whose nested resource attributes vary by resource type and release:

- lifecycle `data`, `previous`, and `diff`;
- `resources.data.resources[]` returned by `getResources`;
- mutation `attributes` objects;
- `didDrag.resources[]` integration-event snapshots.

For those objects, query [api-attributes.md](api-attributes.md) for the exact backend API version,
stream, resource, and method. Do not present every readable API field as writable through a host
mutation, and do not assume a resource snapshot has fields that its released resource class does
not expose.

## Regeneration and source coverage

Regenerate after a host protocol change and point the generator at a FieldTwin checkout:

```bash
node skills/develop-fieldtwin-integration/scripts/generate-postmessage-catalog.mjs \
  --source /path/to/fieldtwin-host-checkout
```

The generator fails if any event in the main integration-message dispatch map is absent from the
catalog. It also includes host direct replies, host notifications emitted outside the central
integration transport, modal messages, Account/Project Settings variants, and released automation
supplements. Those distributed surfaces still need focused source and protocol tests because they
do not share one central dispatch table.

When reviewing or adding a protocol message, verify all of the following:

1. direction, surface, event spelling, and variant;
2. top-level versus `data` placement and every nested field;
3. normal send, bootstrap, direct reply, or binary reply augmentation;
4. trusted source-window identity, target-instance routing, and exact origin;
5. documented correlation and late/duplicate reply behavior;
6. iframe and real FieldTwin-opened pop-out behavior;
7. malformed structured-clone input, teardown, and two simultaneous integration instances.
