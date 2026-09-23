# fieldtwin-mcp

An optional [Model Context Protocol](https://modelcontextprotocol.io) server that lets an MCP
client (Claude Code, Cursor, Cline, VS Code, LM Studio, and others) call the FieldTwin API v1.10
directly.

This package is **separate from the FieldTwin Agent Skills** in `skills/`. The skills are
documentation only: they make no network requests and collect no credentials. This server is
the opposite: it runs locally, holds an account-level API token, and calls your FieldTwin
backend. Install it only where that is acceptable.

## Safety defaults

- **Read-only by default.** Every POST, PATCH, and DELETE is refused unless
  `FIELDTWIN_MCP_ALLOW_WRITES=true`. Turn writes on only for the session that needs them.
- **Account API token, not the integration JWT.** It is sent only in the `token` header, never
  together with `Authorization`. Keep it in your MCP client config, never in browser code or Git.
- **No wildcard project.** Subproject tools need a real project ID, from a tool argument or
  `FIELDTWIN_PROJECT_ID`.
- **Qualified branches.** An unqualified subproject ID targets the main stream as `{id}:{id}`.
  Pass `{subProjectId}:{streamId}` to target another branch.
- Every path segment is URL-encoded, redirects are refused, and responses are parsed by
  `Content-Type` so empty PATCH/DELETE bodies do not fail.

## Install

Requires Node.js 18 or later.

```bash
cd packages/fieldtwin-mcp
npm install
```

## Configure

| Variable | Required | Purpose |
| --- | --- | --- |
| `FIELDTWIN_BACKEND_URL` | Yes | Backend URL, no trailing slash |
| `FIELDTWIN_API_TOKEN` | Yes | Account API token (Settings → API Tokens) |
| `FIELDTWIN_PROJECT_ID` | No | Default project for subproject tools |
| `FIELDTWIN_SUBPROJECT_ID` | No | Default subproject, optionally `{id}:{streamId}` |
| `FIELDTWIN_MCP_ALLOW_WRITES` | No | `true` enables create/update/delete tools |

Most MCP clients use the same shape. For example, Claude Code (`.mcp.json`) or Cursor
(`.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "fieldtwin": {
      "command": "node",
      "args": ["/absolute/path/to/ft-skill/packages/fieldtwin-mcp/index.js"],
      "env": {
        "FIELDTWIN_BACKEND_URL": "https://backend.fieldtwin.example",
        "FIELDTWIN_API_TOKEN": "<your-api-token>",
        "FIELDTWIN_PROJECT_ID": "<optional-default-project-id>",
        "FIELDTWIN_MCP_ALLOW_WRITES": "false"
      }
    }
  }
}
```

Ask your AI "List my FieldTwin projects" to verify the connection.

## Tools (96)

| Category | Tools |
| --- | --- |
| Projects | `list_projects`, `get_project`, `create_project`, `update_project` |
| Subprojects | `list_subprojects`, `get_subproject`, `create_subproject`, `update_subproject`, `delete_subproject`, `get_subproject_hierarchy`, `get_subproject_is_ready`, `get_subproject_share_url`, `get_subproject_tags` |
| Staged assets | `get_staged_assets`, `get_staged_asset`, `create_staged_asset`, `create_staged_assets_batch`, `update_staged_asset`, `delete_staged_asset` |
| Wells | `get_wells`, `get_well`, `create_well`, `create_wells_batch`, `update_well`, `delete_well` |
| Well bores | `get_well_bores`, `get_well_bore`, `create_well_bore`, `update_well_bore`, `delete_well_bore`, `get_well_bore_segments`, `update_well_bore_segment`, `delete_well_bore_segment` |
| Connections | `get_connections`, `get_connection`, `create_connection`, `create_connections_batch`, `update_connection`, `delete_connection` |
| Connection segments | `get_connection_segments`, `create_connection_segment`, `update_connection_segment`, `delete_connection_segment` |
| Shapes | `get_shapes`, `get_shape`, `create_shape`, `create_shapes_batch`, `update_shape`, `delete_shape` |
| Overlays | `get_overlays`, `get_overlay`, `create_overlay`, `create_overlays_batch`, `update_overlay` |
| Annotations | `get_annotations`, `get_annotation`, `create_annotation`, `update_annotation`, `delete_annotation` |
| Layers | `get_layers`, `get_layer`, `create_layer`, `update_layer`, `delete_layer` |
| Custom costs | `get_custom_costs`, `get_custom_cost`, `create_custom_cost`, `create_custom_costs_batch`, `update_custom_cost`, `delete_custom_cost` |
| Subproject documents | `get_subproject_documents`, `upload_subproject_document`, `delete_subproject_document` |
| Metadata | `get_account_metadata_definitions`, `set_resource_metadata` |
| Type lookups | `get_assets`, `get_well_types`, `get_well_bore_types`, `get_annotation_types`, `get_shape_types`, `get_layer_types`, `get_connection_types`, `get_connection_type`, `get_connection_categories`, `get_connection_segment_types`, `get_well_bore_segment_types` |
| Tags | `get_tags`, `get_tag`, `create_tag`, `update_tag`, `delete_tag` |
| Account | `get_users`, `get_user`, `get_usage`, `get_account_logs`, `get_integrations` |

Routes follow the generated v1.10 catalog in
`skills/develop-fieldtwin-integration/references/api-attributes-v1.10.json`. Four read routes
are not in that catalog but are listed in the v1.10 guide as documented where available:
`get_well_bores`, `get_well_bore`, `list_subprojects`, and `create_connections_batch`. Check
them against your tenant's API portal before relying on them.

## Changes in 3.0.0

- Moved from `mcp-server/` to `packages/fieldtwin-mcp/`. Update the path in your MCP config.
- Write tools are disabled unless `FIELDTWIN_MCP_ALLOW_WRITES=true`.
- Removed the `-` project fallback. A real project ID is required.
- Subproject IDs are qualified as `{id}:{streamId}`.
- Batch tools send the documented `{ "items": [...] }` envelope instead of a bare array.
- Staged assets use the documented `asset` field instead of `stagedAssetSymbolId`.
- `status` accepts the documented underlay values `warning`, `danger`, `primary`, `success`,
  or `null`. `create_connection` no longer sends `status: 'Planned'` by default.
- Removed 10 tools whose routes are not in the v1.10 contract: the five `frames` tools, the
  four `/{resourceId}/metaData` tools, and `get_metadata_definitions` (`project/-/...`). Use
  `get_account_metadata_definitions`, read values from each resource's `metaData` field, and
  write them with `set_resource_metadata`.
