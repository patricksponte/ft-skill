# FieldTwin batch requests in v1.10 and v2.0

Batch requests reduce round trips and allow related changes to be validated together. They do not
remove relationship ordering, stream ownership, authorization, or uncertain-response concerns.
Use [api-attributes.md](api-attributes.md) to validate each item against its version, operation,
stream, resource type, and method before placing it in a batch envelope.

## The two batch models

| Version | Endpoint model | Scope |
| --- | --- | --- |
| v1.10 | Explicit `POST`, `PATCH`, and `DELETE .../batch` under one subproject | Layout resources in one subproject stream |
| v1.10 | Per-type `POST .../{resourceType}/batch` | Several new resources of one type |
| v2.0 | `POST`, `PATCH`, and `DELETE` on a stream root | Every supported resource type owned by that users/account/project/subproject/workflow stream |

All examples use fictional IDs.

## POST envelope

The common create collection is:

```json
{
  "items": [
    { "name": "Pump P-101" },
    { "name": "Pump P-102", "tags": ["priority"] }
  ],
  "totalNumberOfItems": 2,
  "globals": {
    "tags": ["imported"]
  }
}
```

`globals` supplies defaults. An item field overrides the same global field. Do not assume nested
objects are deeply merged; provide the complete endpoint-valid nested value when that distinction
matters.

`totalNumberOfItems` is optional. When greater than `items.length`, FieldTwin attempts to create
additional resources using only `globals` and schema defaults. Use it only when an empty per-item
body plus globals is valid. Keep it equal to or greater than `items.length`; normally omit it when
no generated empty items are required.

### v1.10 multi-type POST

`POST /API/v1.10/{projectId}/subProject/{qualifiedSubProjectId}/batch`

```json
{
  "globals": {
    "tags": ["concept-a"]
  },
  "stagedAssets": {
    "items": [
      {
        "name": "Manifold M-01",
        "asset": "asset-definition-01",
        "initialState": { "x": 100, "y": 200, "rotation": 0, "scale": 1 }
      }
    ]
  },
  "connections": {
    "globals": { "showFlow": true },
    "items": [
      {
        "name": "Flowline C-01",
        "from": "existing-asset-01",
        "fromSocket": "out",
        "to": "existing-asset-02",
        "toSocket": "in"
      }
    ]
  }
}
```

The top-level `globals` apply to every resource type. A type's `globals` then apply to that type,
and the item wins last. The response maps each requested resource type to its created IDs:

```json
{
  "stagedAssets": ["created-asset-01"],
  "connections": ["created-connection-01"]
}
```

Supported v1.10 multi-type POST keys are `stagedAssets`, `connections`, `connectionSegments`,
`wells`, `wellBores`, `wellBoreSegments`, `layers`, `overlays`, `customCosts`, `shapes`, and
`annotations`.

Creation order follows the object key order supplied by the request. Put parents before dependent
resources:

1. staged assets before connections that reference them;
2. connections before their connection segments;
3. wells before their well bores;
4. well bores before their well-bore segments.

When a newly created child needs a newly created parent ID, the client must know or obtain the
identifier shape accepted by that endpoint. Do not invent temporary-ID substitution: it is not a
documented general batch feature.

### v1.10 per-type POST

The following plural per-type routes accept the unwrapped collection envelope shown first:

- `stagedAssets/batch`
- `connections/batch`
- `layers/batch`
- `overlays/batch`
- `customCosts/batch`
- `shapes/batch`
- `wells/batch`

For example:

```http
POST /API/v1.10/{projectId}/subProject/{qualifiedSubProjectId}/stagedAssets/batch
```

The response is `{ "ids": ["...", "..."] }`, not the multi-type response envelope.

### v2.0 POST

`POST /API/v2.0/{rootType}/{rootId}` or, for root types without an ID,
`POST /API/v2.0/users` and `POST /API/v2.0/workflowTasks`.

```json
{
  "stagedAssets": {
    "globals": { "tags": ["imported"] },
    "items": [
      {
        "name": "Manifold M-01",
        "asset": "asset-definition-01",
        "x": 100,
        "y": 200,
        "rotation": 0,
        "scale": 1
      }
    ]
  },
  "connections": {
    "items": [
      {
        "name": "Flowline C-01",
        "from": "existing-asset-01",
        "fromSocket": "out",
        "to": "existing-asset-02",
        "toSocket": "in"
      }
    ]
  }
}
```

The v2 response is the resource-type-to-ID-array envelope used by v1.10 multi-type POST. v2 does
not have a separate per-type batch route.

## PATCH envelope

PATCH bodies key changes by resource ID. `globals` is a sibling of those IDs:

```json
{
  "stagedAssets": {
    "globals": {
      "tags": ["reviewed"]
    },
    "asset-01": {
      "name": "Pump P-101A"
    },
    "asset-02": {
      "name": "Pump P-102A",
      "tags": ["exception"]
    }
  },
  "connections": {
    "connection-01": {
      "showFlow": true
    }
  }
}
```

- v1.10: `PATCH /API/v1.10/{projectId}/subProject/{qualifiedSubProjectId}/batch`
- v2.0: `PATCH /API/v2.0/{rootType}/{rootId}` or the no-ID root path

A successful batch PATCH normally returns `200` with an empty body. Do not call `response.json()`
without checking the response content type or length.

PATCH is partial at the resource level, but some nested values have endpoint-specific merge or
replacement behavior. In particular, metadata, vendor attributes, costs, visualisation maps, and
custom results have domain handling. Use the live schema and test the exact field rather than
assuming JSON Merge Patch or JSON Patch semantics; neither wire format is the contract.

Supported v1.10 multi-type PATCH keys are `connections`, `stagedAssets`, `wells`, `layers`,
`overlays`, `customCosts`, `shapes`, `wellBores`, `documents`, `connectionSegments`,
`wellBoreSegments`, and `annotations`.

## DELETE envelope

DELETE uses resource-type keys with arrays of IDs:

```json
{
  "connectionSegments": ["segment-01", "segment-02"],
  "connections": ["connection-01"],
  "stagedAssets": ["asset-01"]
}
```

- v1.10: `DELETE /API/v1.10/{projectId}/subProject/{qualifiedSubProjectId}/batch`
- v2.0: `DELETE /API/v2.0/{rootType}/{rootId}` or the no-ID root path

Delete children before parents when both are explicitly present. Domain cascading can exist for a
specific relationship, such as document revisions, but do not generalize it to every resource.

Supported v1.10 DELETE keys are `stagedAssets`, `connections`, `connectionSegments`, `wells`,
`wellBores`, `wellBoreSegments`, `layers`, `customCosts`, `overlays`, `shapes`, `documents`,
`bookmarks`, and `annotations`.

## Stream ownership in v2

The URL selects one event stream. Every resource in the body must be writable from that stream.
The root resource itself is generally created or deleted from its parent's stream:

- create/delete a project with `POST`/`DELETE /accounts/{accountId}`;
- create/delete a subproject with `POST`/`DELETE /projects/{projectId}`;
- do not create/delete a project through `/projects/{projectId}`;
- do not create/delete a subproject through `/subProjects/{subProjectId}`.

PATCH can include the stream's root resource where the live schema exposes it. v2 rejects bodies
that would require one request to commit resources across different streams.

## Validation, save behavior, and atomicity boundary

For one accepted stream batch, FieldTwin validates the envelope, validates resource schemas and
relationships, applies domain transformations, validates dependent segments, and then persists the
change. Handler/save failures revert the request's collected local changes.

Do not describe this as a distributed transaction:

- a v2 operation is intentionally restricted to one stream;
- linked external FieldTwin instances are not part of the transaction;
- notifications, event delivery, and client observation happen after persistence and can lag;
- a network failure can hide a successful commit from the caller.

The response can include `ft-batch-id`, which FieldTwin uses to correlate persistence with its
realtime view before the gateway returns many mutations. Treat it as diagnostics/correlation only.
It is not a request idempotency token, and browser code may not be able to read it unless the
deployment exposes that header through CORS.

## Batch sizing and failure strategy

There is no universal public maximum item count. Limits depend on payload size, resource schemas,
geometry, metadata, deployment timeouts, and tenant release. Prefer bounded chunks for large
imports and preserve relationship groups in the same chunk when the domain requires joint
validation.

For each chunk:

1. validate all IDs and required relationship data locally;
2. send one stream only;
3. record the returned IDs without recording credentials;
4. read back or reconcile critical results;
5. stop on the first validation failure and show its resource type/chunk position;
6. after an ambiguous network failure, query by known IDs or stable vendor identifiers before
   retrying a POST.

Do not run dozens of mutation chunks concurrently against the same stream. It increases conflict
risk and defeats ordering. Parallelize independent reads; sequence dependent writes.

## Batch test matrix

- Empty body and unknown resource type are rejected.
- POST item attributes override globals.
- Type globals override v1.10 top-level globals.
- `totalNumberOfItems` creates the intended count only with valid defaults.
- Parent-before-child creation succeeds; reversed dependency order fails cleanly.
- One invalid item prevents a partial local batch result.
- PATCH updates only intended fields and tests nested-field semantics.
- Cross-subproject or cross-stream IDs are rejected.
- DELETE rejects missing IDs and handles explicit child/parent order.
- POST response IDs are read back and belong to the selected stream.
- Empty PATCH/DELETE success bodies are not parsed as JSON.
- Timeout after a mutation triggers reconciliation, not a blind POST retry.
- A refreshed JWT is used by the next chunk.
