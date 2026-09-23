# FieldTwin API v1.10

Use v1.10 for the widest current tenant compatibility and when an integration needs a dedicated
resource endpoint not yet exposed by the target tenant's v2 contract. v1.10 grew incrementally,
so response containers and singular/plural route aliases are not uniform. The live API portal is
the schema authority.

Read [backend-api.md](backend-api.md) first for authentication, URL safety, readiness, errors, and
retry rules. Read [backend-api-batch.md](backend-api-batch.md) before a batch mutation. Query
[api-attributes.md](api-attributes.md) for every documented field on a specific v1.10 operation.

## Public path model

The public gateway selects the account from the credential. Do not add an account ID immediately
after `v1.10` even though account data is account-scoped.

```text
{backendUrl}/API/v1.10/
{backendUrl}/API/v1.10/{projectId}/subProject/{qualifiedSubProjectId}/...
```

Both `subProject` and `subProjects` route aliases can exist. Prefer the spelling shown by the
tenant's API portal and keep it consistent in one client.

A FieldTwin 8 branch is identified by a qualified subproject ID:

```text
{subProjectDocumentId}:{streamId}
```

When `loaded` provides the two fields separately, qualify once:

```javascript
function qualifySubProjectId(subProject, stream) {
  if (subProject.includes(':')) {
    return subProject
  }
  return `${subProject}:${stream || subProject}`
}

function v110SubProjectPath(context, suffix = '') {
  const project = encodeURIComponent(context.project)
  const subProject = encodeURIComponent(
    qualifySubProjectId(context.subProject, context.stream),
  )
  return `${project}/subProject/${subProject}${suffix}`
}
```

The main stream commonly uses `{id}:{id}`. Do not discard a different `stream` or silently fall
back from one branch to another.

## Discover the exact released surface

- Browse [the public FieldTwin API portal](https://api.fieldtwin.com/).
- On a tenant, `GET /API/v1.10/route-list` returns its account and subproject route/method list when
  an API process is available.
- Use the endpoint-specific request and response schema from that tenant release.
- Treat old sample code as a path example, not proof that every field remains writable.

The route list describes paths and methods, not authorization or full payload schemas. A route
being present does not mean the current integration JWT may use it.

## Account and configuration surface

The following catalog groups the v1.10 public surface. Individual create/update/delete support
varies by family; inspect the live operation before sending a mutation.

| Family | Common path names | Capabilities |
| --- | --- | --- |
| Account | `/`, `/vendorAttributes`, `/usage`, `/logs` | Read/update account settings and inspect account-level attributes/reporting where authorized |
| Projects | `/projects`, `/project/{id}`, `/{projectId}`, `/projects/{id}/basic`, `/projects/{id}/stats`, `/projects/{id}/vendorAttributes`, `/projects/{id}/logs` | List, create, read, update, and delete projects; reduced/statistics/attribute views |
| Subprojects from account/project | `/{projectId}/subProjects`, `/{projectId}/subProjects/{id}`, `.../changes`, `.../vendorAttributes`, `.../shareUrl` | Create/link/update/delete subprojects, activity/change data, attributes, and view-only link generation |
| Users and roles | `/users` (including its `basic` view), `/user/{id}`, `/userRoles`, `/userRoles/{id}` | User membership, reduced user views, role configuration, and account assignments |
| Asset definitions | `/assets`, `/assets/{id}` | Physical/virtual asset definitions available to staged assets |
| Connection definitions | `/connections`, `/connections/{id}`, `/connectionTypes`, `/connectionCategories`, `/allowedConnectionTypes`, `/connectors` | Connection definitions, design/segment rules, categories, compatibility, and connectors |
| Type definitions | `/connectionSegmentTypes`, `/layerTypes`, `/reservoirTypes`, `/pointCloudTypes`, `/shapeTypes`, `/wellTypes`, `/wellBoreTypes`, `/wellBoreSegmentTypes`, `/annotationTypes` | Account/project resource classification and rendering/configuration definitions |
| Metadata | `/metadatadefinitions`, `/metadatagroups`, `/metadatumlinks`, `/metadatagrouplinks` | Definitions, groups, resource links, group links, ordering, and tag-restricted reads |
| Tags and folders | `/tags`, `/treeViewFolders` | Account tags and tree-view organization |
| Documents | `/documents`, `/documents/{id}`, nested `/documentRevisions/{id}` | Account document upload, read, patch, delete, and revision operations |
| Integrations | `/integrations`, `/integrations/{id}`, `/integrations/manifest` | Installed custom tabs/integrations and manifest administration |
| Customers | `/customers`, `/customers/{id}` | Account customer configuration |
| Workflow definitions | `/workflowTemplates`, `/workflowColumns`, `/workflowTaskTemplateGroups`, `/workflowTaskTemplates`, `/workflowTaskTemplateLinks`, `/workflowTaskTemplateGroupLinks` | Workflow/template/column/group/link configuration |
| Workflow tasks | `/workflowTasks`, `/workflowTasks/{id}`, nested `/comments` and `/documents` | Task CRUD, comments, attachments, and revisions with task-specific rights |

Several route families accept both singular and plural aliases. Do not generate a path by naïvely
singularizing a collection name: names such as `metaData`, `metadatumlinks`, and workflow routes
have historical spelling. Copy the released path.

## Subproject layout surface

Base path:

```text
/API/v1.10/{projectId}/subProject/{qualifiedSubProjectId}
```

### Read layout resources

| Resource | Collection | One resource / nested resource |
| --- | --- | --- |
| Staged assets | `/stagedAssets` | `/stagedAsset/{id}` |
| Connections | `/connections` | `/connection/{id}` |
| Connection segments | `/connectionSegments` | `/connection/{parentId}/connectionSegments`, `/connectionSegment/{id}` where documented |
| Layers | `/layers` | `/layer/{id}` |
| Overlays | `/overlays` | `/overlay/{id}` |
| Shapes | `/shapes` | `/shape/{id}` |
| Custom costs | `/customCosts` | `/customCost/{id}` |
| Wells | `/wells` | `/well/{id}` |
| Well bores | `/wellBores` or nested through a well | `/well/{parentId}/wellBores`, `/wellBore/{id}` where documented |
| Well-bore segments | `/wellBoreSegments` | `/wellBore/{parentId}/wellBoreSegments`, `/wellBoreSegment/{id}` where documented |
| Documents | `/documents` | `/document/{id}` and nested revisions |
| Document revisions | `/documentRevisions` | `/documentRevision/{id}` |
| Annotations | `/annotations` | `/annotation/{id}` |

Collection response shapes are historical and can be maps, arrays, or resource-specific wrappers.
Do not write one generic v1.10 collection parser without verifying each endpoint.

### Individual mutations

Dedicated POST endpoints exist for staged assets, connections, layers, overlays, custom costs,
shapes, wells, annotations, documents, and nested well bores/connection segments/well-bore
segments. Dedicated PATCH/DELETE support covers most of the same families, with revision and
parent paths where required.

Use singular item routes for one item. Use the explicit batch routes for imports or coordinated
multi-resource changes. Do not send a v2 ID-keyed PATCH envelope to a v1.10 singular PATCH route.

### Special subproject operations

| Method and suffix | Purpose and important response behavior |
| --- | --- |
| `GET /isReady` | Check whether the qualified subproject data and its layers are ready. |
| `GET /tags` | Tags currently used by layout resources. |
| `GET /hierarchy` | Local/foreign subproject hierarchy; the `flat` option controls flat versus nested output where supported. |
| `GET /geojson` | GeoJSON representation of the layout. |
| `POST /heightSamples` | Sample points against project layers. Use the endpoint schema for coordinate/body shape. |
| `POST /connectionCrossings` | Detect connection crossings. Optional sampling/depth/foreign/stream headers affect calculation and response mode. |
| `POST /connectionCrossings/v2` | Newer crossing calculation contract within API v1.10; do not confuse this suffix with API version v2.0. |
| `POST /schematics` | Generate a layout schematic using the documented request fields and media type. |
| `GET /connection/{id}/segmentsAboveSurface` | Return portions of a connection that are above the surface. |
| `GET` on the base path | Return the subproject/layout representation using v1.10's endpoint-specific shape. |

Administrative `reload` and data-loading routes can also exist. Do not call them as a normal
readiness strategy; they require elevated rights and can disrupt shared work.

## v1.10 batch routes

| Method/path suffix | Body | Success body |
| --- | --- | --- |
| `POST /batch` | Resource-type objects with `items`, optional `globals`, optional `totalNumberOfItems`; optional top-level `globals` | Resource-type keys mapped to created ID arrays |
| `PATCH /batch` | Resource-type objects keyed by resource ID plus optional `globals` | Empty body |
| `DELETE /batch` | Resource-type keys mapped to ID arrays | Empty body |
| `POST /{pluralType}/batch` | One `{ items, globals?, totalNumberOfItems? }` object | `{ "ids": [...] }` |

See [backend-api-batch.md](backend-api-batch.md) for supported keys, dependency order, mutation
semantics, and complete examples.

## Example: read staged assets

```javascript
async function getStagedAssets(bridge) {
  const context = bridge.getContext()
  if (!context?.project || !context?.subProject || !context.apiServerIsReady) {
    throw new Error('FieldTwin subproject API context is unavailable')
  }

  const path = v110SubProjectPath(context, '/stagedAssets')
  const response = await bridge.apiFetch(path)
  if (!response.ok) {
    throw await readFieldTwinError(response)
  }
  return response.json()
}
```

## Example: create one staged asset

```javascript
const path = v110SubProjectPath(context, '/stagedAsset')
const response = await bridge.apiFetch(path, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Manifold M-01',
    asset: 'asset-definition-01',
    tags: [],
    initialState: {
      x: 100,
      y: 200,
      rotation: 0,
      scale: 1,
    },
  }),
})
```

Coordinate values use the project's coordinate reference system. Asset IDs refer to account asset
definitions, not staged-asset instance IDs.

## Metadata and relationships

- Resource relationships use FieldTwin IDs, not expanded embedded resources unless the endpoint
  explicitly returns an expansion.
- `metaData` payloads refer to definitions or links through fields such as `metaDatumId`,
  `definitionId`, or `metaDatumLinkId`; use the endpoint schema to select the accepted identifier.
- Metadata values can be recursive and control-type-specific. Preserve unknown documented fields
  when round-tripping only if the PATCH contract accepts them.
- A connection's `from`, `fromSocket`, `to`, and `toSocket` must resolve to valid compatible
  endpoints. A connection segment belongs to a connection; a well bore belongs to a well; a
  well-bore segment belongs to a well bore.
- `vendorAttributes` is for stable external-system correlation where the tenant contract permits
  it. Names are display labels and are not safe unique keys.

## Response options and historical reads

Resource reads can support headers such as `sample-every`, `simplify`, `no-intermediary`,
`raw-intermediary`, `no-metadata`, `no-foreign`, `only-active`, and `basic`. Only send headers
listed on the operation. The `at` query parameter can select an allowed historical time on
supported subproject reads; confirm its format and cost in the tenant docs before using it.

## v1.10 validation checklist

- Confirm the public base omits the internal account path segment.
- Test the main stream and a qualified non-main stream.
- Read the live route/schema before choosing singular versus plural spelling.
- Parse each collection using its documented response shape.
- Verify every write with the integration user's actual type-level permissions.
- Test connection/well child relationship validation.
- Test geometry option headers only on endpoints that advertise them.
- Exercise `/batch` and per-type batch as different response contracts.
- Treat `connectionCrossings/v2` as a v1.10 operation suffix, not API v2.0.
- Never use an account API token in browser code.
