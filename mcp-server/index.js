#!/usr/bin/env node
import { McpServer }          from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z }                  from 'zod';

// ---- Configuration --------------------------------------------------------

const BACKEND_URL = (process.env.FIELDTWIN_BACKEND_URL || '').replace(/\/$/, '');
const API_TOKEN   = process.env.FIELDTWIN_API_TOKEN   || '';
const DEFAULT_SUB = process.env.FIELDTWIN_SUBPROJECT_ID || '';

function checkEnv() {
  if (!BACKEND_URL) throw new Error('FIELDTWIN_BACKEND_URL is not set. Add it to your MCP server env config.');
  if (!API_TOKEN)   throw new Error('FIELDTWIN_API_TOKEN is not set. Add it to your MCP server env config.');
}

// ---- API helper -----------------------------------------------------------

async function api(method, path, body) {
  checkEnv();
  const opts = {
    method,
    headers: { token: API_TOKEN, 'Content-Type': 'application/json' }
  };
  if (body !== undefined) opts.body = JSON.stringify(body);

  const res = await fetch(`${BACKEND_URL}${path}`, opts);

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`FieldTwin API ${res.status} ${res.statusText}: ${text}`);
  }
  return res.status === 204 ? { success: true } : res.json();
}

function resolveSub(subProjectId) {
  const id = subProjectId || DEFAULT_SUB;
  if (!id) throw new Error(
    'subProjectId is required. Either pass it as a tool argument or set FIELDTWIN_SUBPROJECT_ID in the server env.'
  );
  return id;
}

const BASE = (subProjectId) =>
  `/API/v1.10/project/-/subProject/${resolveSub(subProjectId)}`;

function ok(data) {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

// ---- Server ---------------------------------------------------------------

const server = new McpServer({ name: 'fieldtwin', version: '1.0.0' });

// ==========================================================================
// PROJECTS & SUBPROJECTS
// ==========================================================================

server.tool(
  'list_projects',
  'List all FieldTwin projects in the account.',
  {},
  async () => ok(await api('GET', '/API/v1.10/'))
);

server.tool(
  'list_subprojects',
  'List all subprojects inside a project.',
  {
    projectId: z.string().optional().describe('Project ID. Use "-" to list subprojects across all projects.')
  },
  async ({ projectId }) => ok(await api('GET', `/API/v1.10/${projectId || '-'}/subProjects`))
);

// ==========================================================================
// STAGED ASSETS
// ==========================================================================

server.tool(
  'get_staged_assets',
  'List all staged assets (equipment, valves, manifolds, structures, etc.) in a subproject.',
  {
    subProjectId: z.string().optional().describe('SubProject ID. Falls back to FIELDTWIN_SUBPROJECT_ID env var.')
  },
  async ({ subProjectId }) => ok(await api('GET', `${BASE(subProjectId)}/stagedAssets`))
);

server.tool(
  'get_staged_asset',
  'Get a single staged asset by ID.',
  {
    id:           z.string().describe('Staged asset ID'),
    subProjectId: z.string().optional()
  },
  async ({ id, subProjectId }) => ok(await api('GET', `${BASE(subProjectId)}/stagedAsset/${id}`))
);

server.tool(
  'create_staged_asset',
  'Create a new staged asset in a subproject.',
  {
    name:                z.string().describe('Asset name'),
    x:                   z.number().describe('X coordinate'),
    y:                   z.number().describe('Y coordinate'),
    z:                   z.number().optional().default(0).describe('Z coordinate'),
    rotation:            z.number().optional().default(0).describe('Rotation in degrees'),
    status:              z.enum(['Planned', 'Installed', 'Removed']).optional().default('Planned'),
    tags:                z.array(z.string()).optional().describe('Tags in key::value format, e.g. ["type::valve"]'),
    stagedAssetSymbolId: z.string().optional().describe('ID of the 3D symbol/model to use'),
    vendorAttributes:    z.record(z.unknown()).optional().describe('Custom data object'),
    subProjectId:        z.string().optional()
  },
  async ({ name, x, y, z: zCoord, rotation, status, tags, stagedAssetSymbolId, vendorAttributes, subProjectId }) => {
    const body = {
      name,
      initialState: { x, y, z: zCoord ?? 0, rotation: rotation ?? 0 },
      status,
      ...(tags                ? { tags }                : {}),
      ...(stagedAssetSymbolId ? { stagedAssetSymbolId } : {}),
      ...(vendorAttributes    ? { vendorAttributes }    : {})
    };
    return ok(await api('POST', `${BASE(subProjectId)}/stagedAssets`, body));
  }
);

server.tool(
  'update_staged_asset',
  'Update an existing staged asset. Only the fields you provide will be changed.',
  {
    id:              z.string().describe('Staged asset ID'),
    name:            z.string().optional(),
    status:          z.enum(['Planned', 'Installed', 'Removed']).optional(),
    visible:         z.boolean().optional(),
    tags:            z.array(z.string()).optional(),
    vendorAttributes:z.record(z.unknown()).optional(),
    x:               z.number().optional().describe('New X coordinate'),
    y:               z.number().optional().describe('New Y coordinate'),
    z:               z.number().optional().describe('New Z coordinate'),
    rotation:        z.number().optional().describe('New rotation in degrees'),
    subProjectId:    z.string().optional()
  },
  async ({ id, subProjectId, x, y, z: zCoord, rotation, ...rest }) => {
    const body = { ...rest };
    if (x !== undefined || y !== undefined || zCoord !== undefined || rotation !== undefined) {
      body.initialState = {
        ...(x        !== undefined ? { x }        : {}),
        ...(y        !== undefined ? { y }        : {}),
        ...(zCoord   !== undefined ? { z: zCoord } : {}),
        ...(rotation !== undefined ? { rotation } : {})
      };
    }
    return ok(await api('PATCH', `${BASE(subProjectId)}/stagedAsset/${id}`, body));
  }
);

server.tool(
  'delete_staged_asset',
  'Delete a staged asset permanently.',
  {
    id:           z.string().describe('Staged asset ID'),
    subProjectId: z.string().optional()
  },
  async ({ id, subProjectId }) => ok(await api('DELETE', `${BASE(subProjectId)}/stagedAsset/${id}`))
);

// ==========================================================================
// WELLS
// ==========================================================================

server.tool(
  'get_wells',
  'List all wells in a subproject.',
  { subProjectId: z.string().optional() },
  async ({ subProjectId }) => ok(await api('GET', `${BASE(subProjectId)}/wells`))
);

server.tool(
  'get_well',
  'Get a single well by ID.',
  { id: z.string(), subProjectId: z.string().optional() },
  async ({ id, subProjectId }) => ok(await api('GET', `${BASE(subProjectId)}/well/${id}`))
);

server.tool(
  'create_well',
  'Create a new well.',
  {
    name:         z.string(),
    x:            z.number(),
    y:            z.number(),
    radius:       z.number().optional().default(5),
    color:        z.string().optional().describe('Hex color e.g. #FF0000'),
    kind:         z.string().optional().describe('Well type ID'),
    tags:         z.array(z.string()).optional(),
    subProjectId: z.string().optional()
  },
  async ({ subProjectId, ...body }) =>
    ok(await api('POST', `${BASE(subProjectId)}/wells`, body))
);

server.tool(
  'update_well',
  'Update an existing well.',
  {
    id:           z.string(),
    name:         z.string().optional(),
    x:            z.number().optional(),
    y:            z.number().optional(),
    radius:       z.number().optional(),
    color:        z.string().optional(),
    tags:         z.array(z.string()).optional(),
    subProjectId: z.string().optional()
  },
  async ({ id, subProjectId, ...body }) =>
    ok(await api('PATCH', `${BASE(subProjectId)}/well/${id}`, body))
);

server.tool(
  'delete_well',
  'Delete a well.',
  { id: z.string(), subProjectId: z.string().optional() },
  async ({ id, subProjectId }) => ok(await api('DELETE', `${BASE(subProjectId)}/well/${id}`))
);

// ==========================================================================
// CONNECTIONS (pipelines, cables, umbilicals)
// ==========================================================================

server.tool(
  'get_connections',
  'List all connections (pipelines, cables, umbilicals) in a subproject.',
  { subProjectId: z.string().optional() },
  async ({ subProjectId }) => ok(await api('GET', `${BASE(subProjectId)}/connections`))
);

server.tool(
  'get_connection',
  'Get a single connection by ID.',
  { id: z.string(), subProjectId: z.string().optional() },
  async ({ id, subProjectId }) => ok(await api('GET', `${BASE(subProjectId)}/connection/${id}`))
);

server.tool(
  'create_connection',
  'Create a new connection between two coordinates.',
  {
    name:         z.string(),
    fromX:        z.number().describe('Start X coordinate'),
    fromY:        z.number().describe('Start Y coordinate'),
    fromZ:        z.number().optional().default(0).describe('Start Z coordinate'),
    toX:          z.number().describe('End X coordinate'),
    toY:          z.number().describe('End Y coordinate'),
    toZ:          z.number().optional().default(0).describe('End Z coordinate'),
    status:       z.enum(['Planned', 'Installed', 'Removed']).optional().default('Planned'),
    width:        z.number().optional().describe('Connection width'),
    tags:         z.array(z.string()).optional(),
    subProjectId: z.string().optional()
  },
  async ({ name, fromX, fromY, fromZ, toX, toY, toZ, status, width, tags, subProjectId }) => {
    const body = {
      name,
      fromCoordinate: { x: fromX, y: fromY, z: fromZ ?? 0 },
      toCoordinate:   { x: toX,   y: toY,   z: toZ   ?? 0 },
      status,
      ...(width ? { params: { width } } : {}),
      ...(tags  ? { tags }              : {})
    };
    return ok(await api('POST', `${BASE(subProjectId)}/connection`, body));
  }
);

server.tool(
  'update_connection',
  'Update an existing connection.',
  {
    id:           z.string(),
    name:         z.string().optional(),
    status:       z.enum(['Planned', 'Installed', 'Removed']).optional(),
    tags:         z.array(z.string()).optional(),
    subProjectId: z.string().optional()
  },
  async ({ id, subProjectId, ...body }) =>
    ok(await api('PATCH', `${BASE(subProjectId)}/connection/${id}`, body))
);

server.tool(
  'delete_connection',
  'Delete a connection.',
  { id: z.string(), subProjectId: z.string().optional() },
  async ({ id, subProjectId }) => ok(await api('DELETE', `${BASE(subProjectId)}/connection/${id}`))
);

// ==========================================================================
// OTHER RESOURCES (read)
// ==========================================================================

server.tool(
  'get_shapes',
  'List all shapes (zones, areas, polygons) in a subproject.',
  { subProjectId: z.string().optional() },
  async ({ subProjectId }) => ok(await api('GET', `${BASE(subProjectId)}/shapes`))
);

server.tool(
  'get_overlays',
  'List all overlays (2D labels and annotations) in a subproject.',
  { subProjectId: z.string().optional() },
  async ({ subProjectId }) => ok(await api('GET', `${BASE(subProjectId)}/overlays`))
);

server.tool(
  'get_frames',
  'List all frames in a subproject.',
  { subProjectId: z.string().optional() },
  async ({ subProjectId }) => ok(await api('GET', `${BASE(subProjectId)}/frames`))
);

server.tool(
  'get_annotations',
  'List all annotations in a subproject.',
  { subProjectId: z.string().optional() },
  async ({ subProjectId }) => ok(await api('GET', `${BASE(subProjectId)}/annotations`))
);

// ==========================================================================
// METADATA
// ==========================================================================

server.tool(
  'get_metadata_definitions',
  'List all metadata field definitions for a project (shows what custom fields exist and their types).',
  {
    projectId: z.string().optional().describe('Project ID. Uses "-" if not provided.')
  },
  async ({ projectId }) =>
    ok(await api('GET', `/API/v1.10/project/${projectId || '-'}/metaDataDefinitions`))
);

server.tool(
  'get_metadata',
  'Get all custom metadata values attached to a specific resource.',
  {
    resourceId:   z.string().describe('ID of the resource (stagedAsset, well, connection, etc.)'),
    subProjectId: z.string().optional()
  },
  async ({ resourceId, subProjectId }) =>
    ok(await api('GET', `${BASE(subProjectId)}/${resourceId}/metaData`))
);

server.tool(
  'add_metadata',
  'Add a metadata value to a resource.',
  {
    resourceId:           z.string().describe('ID of the resource to attach metadata to'),
    metaDataDefinitionId: z.string().describe('ID of the metadata field definition'),
    value:                z.unknown().describe('The value to store'),
    subProjectId:         z.string().optional()
  },
  async ({ resourceId, subProjectId, metaDataDefinitionId, value }) =>
    ok(await api('POST', `${BASE(subProjectId)}/${resourceId}/metaData`, { metaDataDefinitionId, value }))
);

// ==========================================================================
// Start
// ==========================================================================

const transport = new StdioServerTransport();
await server.connect(transport);
