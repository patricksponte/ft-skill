# FieldTwin API attribute catalog

Use this reference whenever a task asks which fields an API operation returns or accepts. The
catalog distinguishes response attributes from request attributes and keeps v2 stream-specific
schemas separate. Do not infer write access from a GET response or reuse one stream's schema in a
different stream.

## Catalog files

- `api-attributes-v1.10.json` contains every field documented on the effective v1.10 operation
  surface: headers, path parameters, query parameters, request bodies, and success responses.
  Operations implemented by v1.9 and inherited by v1.10 are normalized to the v1.10 URL and marked
  `inherited`.
- `api-attributes-v2.0.json` contains every readable resource attribute from the events manifest,
  stream-specific GET additions/exclusions, and every POST, PATCH, and DELETE request field from
  the per-stream Joi contracts. It also flattens every standard stream envelope and specialized
  v2 endpoint from the generated OpenAPI document, including path/query/header/body/response
  attributes and media-type variants.

The JSON files are generated artifacts. Query them with `scripts/query-api-attributes.py` instead
of opening an entire catalog in the model context.

## Fast lookup

Run commands from the `develop-fieldtwin-integration` skill directory.

```bash
python3 scripts/query-api-attributes.py --version v2.0 --list-resources
python3 scripts/query-api-attributes.py --version v2.0 --stream subProjects --resource stagedAssets --method get
python3 scripts/query-api-attributes.py --version v2.0 --stream subProjects --resource stagedAssets --method post
python3 scripts/query-api-attributes.py --version v2.0 --stream accounts --resource users --method post
python3 scripts/query-api-attributes.py --version v2.0 --list-operations
python3 scripts/query-api-attributes.py --version v2.0 --path /schematics --method post
python3 scripts/query-api-attributes.py --version v1.10 --resource stagedAsset --method get --list-operations
python3 scripts/query-api-attributes.py --version v1.10 --path /stagedAsset/:stagedAssetId --method get
python3 scripts/query-api-attributes.py --version v1.10 --group StagedAssets --field initialState
```

Add `--field <substring>` to narrow nested attributes, `--location body` or `--location response`
for v1.10, and `--json` when another tool must consume the result.

For v2, resource queries expose the reusable read/write model; `--path` exposes the complete
OpenAPI operation including stream envelopes, specialized endpoint fields, and non-JSON response
variants. Use both views when implementing a full request.

## Interpret the results

### v1.10

Each operation owns its attribute list. A field has one of these locations:

| Location | Meaning |
| --- | --- |
| `header` | Accepted request header documented by the operation. |
| `path` | URL path parameter. |
| `query` | Query-string parameter. |
| `body` | Request-body field. |
| `response` | Successful response field. |

`optional: false` on a body/path/query/header field means the ApiDoc contract did not wrap the
field in brackets. It does not override conditional requirements explained in the description.
Nested paths use dots exactly as the public operation documentation does.

The effective v1.10 catalog starts with v1.9 operations because v1.10 inherits that surface, then
applies v1.10 definitions and operation replacements. `sourceVersion` and `inherited` preserve
that provenance.

### v2.0 reads

The base readable resource field set comes from the events manifest. Query with `--method get` and
the stream whenever the real call is known, because response transformations can:

- remove a manifest attribute;
- add calculated attributes to the root resource;
- add calculated attributes to a related resource; or
- synthesize a relationship collection in the stream envelope.

Path notation is:

| Notation | Meaning |
| --- | --- |
| `a.b` | Property `b` nested in object `a`. |
| `items[].id` | Property `id` on each array item. |
| `resources{}.name` | Property `name` on each value of an ID-keyed map. |

`readOnly: true` is an explicit manifest restriction. Fields with `documented: false` are present
in the manifest but lack a public description; report that fact instead of inventing semantics.

### v2.0 writes

POST, PATCH, and DELETE fields are derived from the exact Joi schema for a `(stream,
resourceType, method)` tuple. Always name all four parts in an implementation or review. The same
resource type can have different fields in different streams; for example, account-scoped user
creation adds account membership fields that the standalone users stream does not accept.

`required` reflects the Joi presence rule for that operation. `allowedValues`, defaults, and
validation rules are included when the schema exposes them. PATCH is not assumed to be POST with
every field optional: query PATCH separately.

User-role `userRights` is an open object because integrations may receive tab-specific keys. The
catalog also expands every concrete built-in right available in the source contract as
`userRights.can...` boolean paths; it preserves the documented dynamic
`canEditTab{customTabId}`/`canViewTab{customTabId}` convention without inventing instance IDs.

## Batch payloads

Attribute availability inside batch requests is unchanged by batching:

- v1.10 `/batch` items use the body attributes documented for the corresponding resource
  operation, plus the batch envelope and globals described in `backend-api-batch.md`.
- v2.0 type-keyed POST/PATCH/DELETE batches use the catalog entry for that stream, method, and
  resource type. The top-level type key is an envelope key, not a resource attribute.

Do not include calculated GET-only attributes in POST or PATCH payloads. Do not include IDs inside
v2 POST objects unless the queried POST schema explicitly exposes an ID field.

## Regenerate after an API contract change

From this skill directory, point the generator at a FieldTwin source checkout:

```bash
node scripts/generate-api-attributes.mjs --source /path/to/FieldTwin
```

The generator executes schema construction without starting services or connecting to data
stores. Review the summary counts, query representative root/related resources in every stream,
and run the package validator. Commit both generated JSON files with the source documentation or
schema change so the skill never describes a newer or older contract than its catalogs.
