#!/usr/bin/env node
import { McpServer }           from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z }                   from 'zod';

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

const server = new McpServer({ name: 'fieldtwin', version: '2.1.0' });

// ==========================================================================
// PROJECTS
// ==========================================================================

server.tool(
  'list_projects',
  'List all FieldTwin projects in the account.',
  {},
  async () => ok(await api('GET', '/API/v1.10/'))
);

server.tool(
  'get_project',
  'Get details of a specific project.',
  { projectId: z.string().describe('Project ID') },
  async ({ projectId }) => ok(await api('GET', `/API/v1.10/${projectId}`))
);

server.tool(
  'create_project',
  'Create a new project.',
  {
    name:        z.string().describe('Project name'),
    description: z.string().optional()
  },
  async (body) => ok(await api('POST', '/API/v1.10/project', body))
);

server.tool(
  'update_project',
  'Update an existing project.',
  {
    projectId:   z.string().describe('Project ID'),
    name:        z.string().optional(),
    description: z.string().optional()
  },
  async ({ projectId, ...body }) => ok(await api('PATCH', `/API/v1.10/${projectId}`, body))
);

// ==========================================================================
// SUBPROJECTS
// ==========================================================================

server.tool(
  'list_subprojects',
  'List all subprojects inside a project.',
  {
    projectId: z.string().optional().describe('Project ID. Use "-" to list across all projects.')
  },
  async ({ projectId }) => ok(await api('GET', `/API/v1.10/${projectId || '-'}/subProjects`))
);

server.tool(
  'get_subproject',
  'Get details of a specific subproject.',
  {
    subProjectId: z.string().describe('SubProject ID'),
    projectId:    z.string().optional().describe('Project ID. Defaults to "-".')
  },
  async ({ projectId, subProjectId }) =>
    ok(await api('GET', `/API/v1.10/${projectId || '-'}/subProject/${subProjectId}`))
);

server.tool(
  'create_subproject',
  'Create a new subproject inside a project.',
  {
    userEmail:       z.string().describe('Email of the user making the request (required with API token).'),
    projectId:       z.string().optional().describe('Project ID. Defaults to "-".'),
    name:            z.string().optional(),
    description:     z.string().optional(),
    locked:          z.boolean().optional().describe('If true, the subproject cannot be edited.'),
    vendorAttributes:z.record(z.unknown()).optional(),
    folderHierarchy: z.array(z.string()).optional().describe('Path of folder names to nest the subproject in.')
  },
  async ({ projectId, ...body }) =>
    ok(await api('POST', `/API/v1.10/${projectId || '-'}/subProject`, body))
);

server.tool(
  'update_subproject',
  'Update an existing subproject.',
  {
    subProjectId:    z.string().describe('SubProject ID'),
    userEmail:       z.string().describe('Email of the user making the request (required with API token).'),
    projectId:       z.string().optional(),
    name:            z.string().optional(),
    description:     z.string().optional(),
    locked:          z.boolean().optional(),
    vendorAttributes:z.record(z.unknown()).optional()
  },
  async ({ projectId, subProjectId, ...body }) =>
    ok(await api('PATCH', `/API/v1.10/${projectId || '-'}/subProject/${subProjectId}`, body))
);

server.tool(
  'delete_subproject',
  'Delete a subproject permanently.',
  {
    subProjectId: z.string().describe('SubProject ID'),
    projectId:    z.string().optional()
  },
  async ({ projectId, subProjectId }) =>
    ok(await api('DELETE', `/API/v1.10/${projectId || '-'}/subProject/${subProjectId}`))
);

server.tool(
  'get_subproject_hierarchy',
  'Get the full resource hierarchy (tree structure) of a subproject.',
  { subProjectId: z.string().optional() },
  async ({ subProjectId }) => ok(await api('GET', `${BASE(subProjectId)}/hierarchy`))
);

server.tool(
  'get_subproject_is_ready',
  'Check whether a subproject is fully loaded and ready for API operations.',
  { subProjectId: z.string().optional() },
  async ({ subProjectId }) => ok(await api('GET', `${BASE(subProjectId)}/isReady`))
);

server.tool(
  'get_subproject_share_url',
  'Get a shareable URL for a subproject.',
  { subProjectId: z.string().optional() },
  async ({ subProjectId }) => ok(await api('GET', `${BASE(subProjectId)}/shareUrl`))
);

server.tool(
  'get_subproject_tags',
  'Get all tags currently in use within a subproject.',
  { subProjectId: z.string().optional() },
  async ({ subProjectId }) => ok(await api('GET', `${BASE(subProjectId)}/tags`))
);

// ==========================================================================
// STAGED ASSETS
// ==========================================================================

server.tool(
  'get_staged_assets',
  'List all staged assets (equipment, valves, manifolds, structures, etc.) in a subproject.',
  { subProjectId: z.string().optional().describe('SubProject ID. Falls back to FIELDTWIN_SUBPROJECT_ID env var.') },
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
    tags:                z.array(z.string()).optional().describe('Tags in key::value format'),
    stagedAssetSymbolId: z.string().optional().describe('ID of the 3D symbol to use. Call get_assets to list available symbols.'),
    vendorAttributes:    z.record(z.unknown()).optional(),
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
    return ok(await api('POST', `${BASE(subProjectId)}/stagedAsset`, body));
  }
);

server.tool(
  'create_staged_assets_batch',
  'Create multiple staged assets in one request.',
  {
    assets: z.array(z.object({
      name:                z.string(),
      initialState:        z.object({ x: z.number(), y: z.number(), z: z.number().optional().default(0), rotation: z.number().optional().default(0) }),
      status:              z.enum(['Planned', 'Installed', 'Removed']).optional(),
      tags:                z.array(z.string()).optional(),
      stagedAssetSymbolId: z.string().optional(),
      vendorAttributes:    z.record(z.unknown()).optional()
    })).describe('Array of staged assets to create'),
    subProjectId: z.string().optional()
  },
  async ({ assets, subProjectId }) =>
    ok(await api('POST', `${BASE(subProjectId)}/stagedAssets/batch`, assets))
);

server.tool(
  'update_staged_asset',
  'Update an existing staged asset. Only the fields you provide will be changed.',
  {
    id:               z.string().describe('Staged asset ID'),
    name:             z.string().optional(),
    status:           z.enum(['Planned', 'Installed', 'Removed']).optional(),
    visible:          z.boolean().optional(),
    tags:             z.array(z.string()).optional(),
    vendorAttributes: z.record(z.unknown()).optional(),
    x:                z.number().optional(),
    y:                z.number().optional(),
    z:                z.number().optional(),
    rotation:         z.number().optional(),
    subProjectId:     z.string().optional()
  },
  async ({ id, subProjectId, x, y, z: zCoord, rotation, ...rest }) => {
    const body = { ...rest };
    if (x !== undefined || y !== undefined || zCoord !== undefined || rotation !== undefined) {
      body.initialState = {
        ...(x        !== undefined ? { x }         : {}),
        ...(y        !== undefined ? { y }         : {}),
        ...(zCoord   !== undefined ? { z: zCoord } : {}),
        ...(rotation !== undefined ? { rotation }  : {})
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
    name:             z.string(),
    x:                z.number(),
    y:                z.number(),
    radius:           z.number().optional().default(5),
    color:            z.string().optional().describe('Hex color e.g. #FF0000'),
    kind:             z.string().optional().describe('Well type ID. Call get_well_types to see available types.'),
    tags:             z.array(z.string()).optional(),
    vendorAttributes: z.record(z.unknown()).optional(),
    subProjectId:     z.string().optional()
  },
  async ({ subProjectId, ...body }) =>
    ok(await api('POST', `${BASE(subProjectId)}/well`, body))
);

server.tool(
  'create_wells_batch',
  'Create multiple wells in one request.',
  {
    wells: z.array(z.object({
      name:   z.string(),
      x:      z.number(),
      y:      z.number(),
      radius: z.number().optional(),
      color:  z.string().optional(),
      kind:   z.string().optional(),
      tags:   z.array(z.string()).optional()
    })).describe('Array of wells to create'),
    subProjectId: z.string().optional()
  },
  async ({ wells, subProjectId }) =>
    ok(await api('POST', `${BASE(subProjectId)}/wells/batch`, wells))
);

server.tool(
  'update_well',
  'Update an existing well.',
  {
    id:               z.string(),
    name:             z.string().optional(),
    x:                z.number().optional(),
    y:                z.number().optional(),
    radius:           z.number().optional(),
    color:            z.string().optional(),
    tags:             z.array(z.string()).optional(),
    vendorAttributes: z.record(z.unknown()).optional(),
    subProjectId:     z.string().optional()
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
// WELL BORES
// ==========================================================================

server.tool(
  'create_well_bore',
  'Create a well bore (trajectory/path) inside an existing well.',
  {
    wellId:      z.string().describe('Well ID to add bore to'),
    name:        z.string().describe('Well bore name'),
    kind:        z.string().optional().describe('Well bore type ID. Call get_well_bore_types to see available types.'),
    description: z.string().optional(),
    source:      z.string().optional(),
    tags:        z.array(z.string()).optional(),
    path:        z.array(z.object({
      x:  z.number(),
      y:  z.number(),
      z:  z.number(),
      md: z.number().optional().describe('Measured depth')
    })).optional().describe('Well bore trajectory as array of 3D points'),
    targets:           z.array(z.unknown()).optional().describe('Array of target formation objects'),
    casingShoes:       z.array(z.unknown()).optional().describe('Array of casing shoe objects'),
    visualisationMaps: z.array(z.unknown()).optional(),
    subProjectId:      z.string().optional()
  },
  async ({ wellId, subProjectId, ...body }) =>
    ok(await api('POST', `${BASE(subProjectId)}/well/${wellId}/wellBore/`, body))
);

server.tool(
  'update_well_bore',
  'Update an existing well bore.',
  {
    wellBoreId:  z.string().describe('Well bore ID'),
    name:        z.string().optional(),
    kind:        z.string().optional(),
    description: z.string().optional(),
    source:      z.string().optional(),
    tags:        z.array(z.string()).optional(),
    path:        z.array(z.object({
      x: z.number(), y: z.number(), z: z.number(), md: z.number().optional()
    })).optional(),
    targets:           z.array(z.unknown()).optional(),
    casingShoes:       z.array(z.unknown()).optional(),
    parentBore:        z.string().optional().describe('Parent well bore ID for directional wells'),
    subProjectId:      z.string().optional()
  },
  async ({ wellBoreId, subProjectId, ...body }) =>
    ok(await api('PATCH', `${BASE(subProjectId)}/wellBore/${wellBoreId}`, body))
);

server.tool(
  'delete_well_bore',
  'Delete a well bore.',
  {
    wellBoreId:   z.string().describe('Well bore ID'),
    subProjectId: z.string().optional()
  },
  async ({ wellBoreId, subProjectId }) =>
    ok(await api('DELETE', `${BASE(subProjectId)}/wellBore/${wellBoreId}`))
);

server.tool(
  'get_well_bore_segments',
  'List all segments of a well bore.',
  {
    wellBoreId:   z.string().describe('Well bore ID'),
    subProjectId: z.string().optional()
  },
  async ({ wellBoreId, subProjectId }) =>
    ok(await api('GET', `${BASE(subProjectId)}/wellBore/${wellBoreId}/wellBoreSegments/`))
);

server.tool(
  'update_well_bore_segment',
  'Update a well bore segment.',
  {
    wellBoreId:          z.string().describe('Well bore ID'),
    wellBoreSegmentId:   z.string().describe('Well bore segment ID'),
    name:                z.string().optional(),
    description:         z.string().optional(),
    startOffset:         z.number().optional(),
    length:              z.number().optional(),
    relativeToEnd:       z.boolean().optional(),
    kind:                z.string().optional().describe('Well bore segment type ID'),
    visible:             z.boolean().optional(),
    thickness:           z.number().optional(),
    opacity:             z.number().optional(),
    tags:                z.array(z.string()).optional(),
    vendorAttributes:    z.record(z.unknown()).optional(),
    subProjectId:        z.string().optional()
  },
  async ({ wellBoreId, wellBoreSegmentId, subProjectId, ...body }) =>
    ok(await api('PATCH', `${BASE(subProjectId)}/wellBore/${wellBoreId}/wellBoreSegments/${wellBoreSegmentId}`, body))
);

server.tool(
  'delete_well_bore_segment',
  'Delete a well bore segment.',
  {
    wellBoreSegmentId: z.string().describe('Well bore segment ID'),
    subProjectId:      z.string().optional()
  },
  async ({ wellBoreSegmentId, subProjectId }) =>
    ok(await api('DELETE', `${BASE(subProjectId)}/wellBoreSegment/${wellBoreSegmentId}`))
);

// ==========================================================================
// CONNECTIONS
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
    name:             z.string(),
    fromX:            z.number().describe('Start X coordinate'),
    fromY:            z.number().describe('Start Y coordinate'),
    fromZ:            z.number().optional().default(0),
    toX:              z.number().describe('End X coordinate'),
    toY:              z.number().describe('End Y coordinate'),
    toZ:              z.number().optional().default(0),
    status:           z.enum(['Planned', 'Installed', 'Removed']).optional().default('Planned'),
    width:            z.number().optional().describe('Connection width'),
    tags:             z.array(z.string()).optional(),
    vendorAttributes: z.record(z.unknown()).optional(),
    subProjectId:     z.string().optional()
  },
  async ({ name, fromX, fromY, fromZ, toX, toY, toZ, status, width, tags, vendorAttributes, subProjectId }) => {
    const body = {
      name,
      fromCoordinate: { x: fromX, y: fromY, z: fromZ ?? 0 },
      toCoordinate:   { x: toX,   y: toY,   z: toZ   ?? 0 },
      status,
      ...(width            ? { params: { width } } : {}),
      ...(tags             ? { tags }               : {}),
      ...(vendorAttributes ? { vendorAttributes }   : {})
    };
    return ok(await api('POST', `${BASE(subProjectId)}/connection`, body));
  }
);

server.tool(
  'create_connections_batch',
  'Create multiple connections in one request — more efficient than calling create_connection repeatedly.',
  {
    connections: z.array(z.object({
      name:           z.string(),
      fromCoordinate: z.object({ x: z.number(), y: z.number(), z: z.number().optional().default(0) }),
      toCoordinate:   z.object({ x: z.number(), y: z.number(), z: z.number().optional().default(0) }),
      status:         z.enum(['Planned', 'Installed', 'Removed']).optional(),
      tags:           z.array(z.string()).optional(),
      vendorAttributes: z.record(z.unknown()).optional()
    })).describe('Array of connection objects to create'),
    subProjectId: z.string().optional()
  },
  async ({ connections, subProjectId }) =>
    ok(await api('POST', `${BASE(subProjectId)}/connections/batch`, connections))
);

server.tool(
  'update_connection',
  'Update an existing connection.',
  {
    id:               z.string(),
    name:             z.string().optional(),
    status:           z.enum(['Planned', 'Installed', 'Removed']).optional(),
    tags:             z.array(z.string()).optional(),
    vendorAttributes: z.record(z.unknown()).optional(),
    subProjectId:     z.string().optional()
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
// CONNECTION SEGMENTS
// ==========================================================================

server.tool(
  'get_connection_segments',
  'List all segments of a connection.',
  {
    connectionId: z.string().describe('Connection ID'),
    subProjectId: z.string().optional()
  },
  async ({ connectionId, subProjectId }) =>
    ok(await api('GET', `${BASE(subProjectId)}/connections/${connectionId}/connectionSegments/`))
);

server.tool(
  'create_connection_segment',
  'Add a segment to a connection. Segments define sections with a specific type, offset, length, and visual properties.',
  {
    connectionId:     z.string().describe('Connection ID'),
    name:             z.string().optional(),
    description:      z.string().optional(),
    startOffset:      z.number().optional().describe('Offset from start (or from end if relativeToEnd=true)'),
    length:           z.number().optional(),
    relativeToEnd:    z.boolean().optional(),
    kind:             z.string().optional().describe('Connection segment type ID. Call get_connection_segment_types to see available types.'),
    visible:          z.boolean().optional(),
    thickness:        z.number().optional(),
    opacity:          z.number().optional(),
    tags:             z.array(z.string()).optional(),
    vendorAttributes: z.record(z.unknown()).optional(),
    subProjectId:     z.string().optional()
  },
  async ({ connectionId, subProjectId, ...body }) =>
    ok(await api('POST', `${BASE(subProjectId)}/connection/${connectionId}/connectionSegment`, body))
);

server.tool(
  'update_connection_segment',
  'Update a connection segment.',
  {
    connectionId:        z.string().describe('Connection ID'),
    connectionSegmentId: z.string().describe('Segment ID'),
    name:             z.string().optional(),
    description:      z.string().optional(),
    startOffset:      z.number().optional(),
    length:           z.number().optional(),
    relativeToEnd:    z.boolean().optional(),
    kind:             z.string().optional(),
    visible:          z.boolean().optional(),
    thickness:        z.number().optional(),
    opacity:          z.number().optional(),
    tags:             z.array(z.string()).optional(),
    vendorAttributes: z.record(z.unknown()).optional(),
    subProjectId:     z.string().optional()
  },
  async ({ connectionId, connectionSegmentId, subProjectId, ...body }) =>
    ok(await api('PATCH', `${BASE(subProjectId)}/connection/${connectionId}/connectionSegment/${connectionSegmentId}`, body))
);

server.tool(
  'delete_connection_segment',
  'Delete a connection segment.',
  {
    connectionSegmentId: z.string().describe('Segment ID'),
    subProjectId:        z.string().optional()
  },
  async ({ connectionSegmentId, subProjectId }) =>
    ok(await api('DELETE', `${BASE(subProjectId)}/connectionSegments/${connectionSegmentId}`))
);

// ==========================================================================
// SHAPES
// ==========================================================================

server.tool(
  'get_shapes',
  'List all shapes (zones, areas, polygons, spheres, boxes, etc.) in a subproject.',
  { subProjectId: z.string().optional() },
  async ({ subProjectId }) => ok(await api('GET', `${BASE(subProjectId)}/shapes`))
);

server.tool(
  'get_shape',
  'Get a single shape by ID.',
  { id: z.string(), subProjectId: z.string().optional() },
  async ({ id, subProjectId }) => ok(await api('GET', `${BASE(subProjectId)}/shape/${id}`))
);

server.tool(
  'create_shape',
  'Create a new shape. ShapeType options: Sphere, Box, Line, Polygon, Cylinder, Circle, Rectangle, Cone, Ring, Torus, Triangle, FlatTube, Tube.',
  {
    name:          z.string(),
    shapeType:     z.string().describe('Geometry type. Call get_shape_types to see configured types.'),
    x:             z.number(),
    y:             z.number(),
    z:             z.number().optional().default(0),
    color:         z.string().optional().describe('HTML/CSS color e.g. #FF0000'),
    opacity:       z.number().optional().describe('Opacity between 0 and 1'),
    visible:       z.boolean().optional().default(true),
    description:   z.string().optional(),
    tags:          z.array(z.string()).optional(),
    kind:          z.string().optional().describe('Shape type ID to link to'),
    sphereRadius:  z.number().optional(),
    boxWidth:      z.number().optional(),
    boxHeight:     z.number().optional(),
    boxDepth:      z.number().optional(),
    circleRadius:  z.number().optional(),
    cylinderRadiusTop:    z.number().optional(),
    cylinderRadiusBottom: z.number().optional(),
    cylinderHeight:       z.number().optional(),
    polyOuterRing: z.array(z.number()).optional().describe('Flat [x1,y1,x2,y2,...] array for Polygon outer ring'),
    subProjectId:  z.string().optional()
  },
  async ({ subProjectId, ...body }) =>
    ok(await api('POST', `${BASE(subProjectId)}/shape`, body))
);

server.tool(
  'create_shapes_batch',
  'Create multiple shapes in one request.',
  {
    shapes: z.array(z.object({
      name:      z.string(),
      shapeType: z.string(),
      x:         z.number(),
      y:         z.number(),
      z:         z.number().optional(),
      color:     z.string().optional(),
      opacity:   z.number().optional(),
      tags:      z.array(z.string()).optional()
    })).describe('Array of shapes to create'),
    subProjectId: z.string().optional()
  },
  async ({ shapes, subProjectId }) =>
    ok(await api('POST', `${BASE(subProjectId)}/shapes/batch`, shapes))
);

server.tool(
  'update_shape',
  'Update an existing shape.',
  {
    id:          z.string(),
    name:        z.string().optional(),
    shapeType:   z.string().optional(),
    x:           z.number().optional(),
    y:           z.number().optional(),
    z:           z.number().optional(),
    color:       z.string().optional(),
    opacity:     z.number().optional(),
    visible:     z.boolean().optional(),
    description: z.string().optional(),
    tags:        z.array(z.string()).optional(),
    kind:        z.string().optional(),
    subProjectId:z.string().optional()
  },
  async ({ id, subProjectId, ...body }) =>
    ok(await api('PATCH', `${BASE(subProjectId)}/shape/${id}`, body))
);

server.tool(
  'delete_shape',
  'Delete a shape.',
  { id: z.string(), subProjectId: z.string().optional() },
  async ({ id, subProjectId }) => ok(await api('DELETE', `${BASE(subProjectId)}/shape/${id}`))
);

// ==========================================================================
// OVERLAYS
// Note: the FieldTwin API does not expose a DELETE endpoint for overlays.
// ==========================================================================

server.tool(
  'get_overlays',
  'List all overlays (2D labels rendered in the 3D scene) in a subproject.',
  { subProjectId: z.string().optional() },
  async ({ subProjectId }) => ok(await api('GET', `${BASE(subProjectId)}/overlays`))
);

server.tool(
  'get_overlay',
  'Get a single overlay by ID.',
  { id: z.string(), subProjectId: z.string().optional() },
  async ({ id, subProjectId }) => ok(await api('GET', `${BASE(subProjectId)}/overlay/${id}`))
);

server.tool(
  'create_overlay',
  'Create a new 2D overlay label at a position in the 3D scene.',
  {
    name:             z.string(),
    x:                z.number(),
    y:                z.number(),
    z:                z.number().optional().default(0),
    text:             z.string().optional().describe('Label text content'),
    width:            z.number().optional(),
    height:           z.number().optional(),
    visible:          z.boolean().optional().default(true),
    tags:             z.array(z.string()).optional(),
    vendorAttributes: z.record(z.unknown()).optional(),
    subProjectId:     z.string().optional()
  },
  async ({ subProjectId, ...body }) =>
    ok(await api('POST', `${BASE(subProjectId)}/overlay`, body))
);

server.tool(
  'create_overlays_batch',
  'Create multiple overlays in one request.',
  {
    overlays: z.array(z.object({
      name:    z.string(),
      x:       z.number(),
      y:       z.number(),
      z:       z.number().optional(),
      text:    z.string().optional(),
      visible: z.boolean().optional(),
      tags:    z.array(z.string()).optional()
    })).describe('Array of overlays to create'),
    subProjectId: z.string().optional()
  },
  async ({ overlays, subProjectId }) =>
    ok(await api('POST', `${BASE(subProjectId)}/overlays/batch`, overlays))
);

server.tool(
  'update_overlay',
  'Update an existing overlay.',
  {
    id:               z.string(),
    name:             z.string().optional(),
    x:                z.number().optional(),
    y:                z.number().optional(),
    z:                z.number().optional(),
    text:             z.string().optional(),
    width:            z.number().optional(),
    height:           z.number().optional(),
    visible:          z.boolean().optional(),
    tags:             z.array(z.string()).optional(),
    vendorAttributes: z.record(z.unknown()).optional(),
    subProjectId:     z.string().optional()
  },
  async ({ id, subProjectId, ...body }) =>
    ok(await api('PATCH', `${BASE(subProjectId)}/overlay/${id}`, body))
);

// ==========================================================================
// ANNOTATIONS
// ==========================================================================

server.tool(
  'get_annotations',
  'List all annotations in a subproject.',
  { subProjectId: z.string().optional() },
  async ({ subProjectId }) => ok(await api('GET', `${BASE(subProjectId)}/annotations`))
);

server.tool(
  'get_annotation',
  'Get a single annotation by ID.',
  { id: z.string(), subProjectId: z.string().optional() },
  async ({ id, subProjectId }) => ok(await api('GET', `${BASE(subProjectId)}/annotations/${id}`))
);

server.tool(
  'create_annotation',
  'Create a new annotation at a position. Annotations can be attached to resources (assets, wells, connections). Call get_annotation_types to see available kinds.',
  {
    name:             z.string(),
    x:                z.number(),
    y:                z.number(),
    z:                z.number().optional().default(0),
    description:      z.string().optional(),
    icon:             z.string().optional().describe('Font-Awesome icon in camelCase e.g. "faCartPlus"'),
    color:            z.string().optional().describe('Hex color e.g. #FF0000'),
    visible:          z.boolean().optional().default(true),
    kind:             z.string().optional().describe('Annotation type ID'),
    resources:        z.array(z.object({
      id:   z.string(),
      type: z.string().describe('stagedAsset | well | connection | shape | overlay')
    })).optional().describe('Resources to attach this annotation to'),
    vendorAttributes: z.record(z.unknown()).optional(),
    subProjectId:     z.string().optional()
  },
  async ({ subProjectId, ...body }) =>
    ok(await api('POST', `${BASE(subProjectId)}/annotations`, body))
);

server.tool(
  'update_annotation',
  'Update an existing annotation.',
  {
    id:               z.string(),
    name:             z.string().optional(),
    x:                z.number().optional(),
    y:                z.number().optional(),
    z:                z.number().optional(),
    description:      z.string().optional(),
    icon:             z.string().optional(),
    color:            z.string().optional(),
    visible:          z.boolean().optional(),
    kind:             z.string().optional(),
    vendorAttributes: z.record(z.unknown()).optional(),
    subProjectId:     z.string().optional()
  },
  async ({ id, subProjectId, ...body }) =>
    ok(await api('PATCH', `${BASE(subProjectId)}/annotations/${id}`, body))
);

server.tool(
  'delete_annotation',
  'Delete an annotation.',
  { id: z.string(), subProjectId: z.string().optional() },
  async ({ id, subProjectId }) => ok(await api('DELETE', `${BASE(subProjectId)}/annotations/${id}`))
);

// ==========================================================================
// LAYERS
// ==========================================================================

server.tool(
  'get_layers',
  'List all layers (bathymetry, WMS, image layers, etc.) in a subproject.',
  { subProjectId: z.string().optional() },
  async ({ subProjectId }) => ok(await api('GET', `${BASE(subProjectId)}/layers`))
);

server.tool(
  'get_layer',
  'Get a single layer by ID.',
  { id: z.string(), subProjectId: z.string().optional() },
  async ({ id, subProjectId }) => ok(await api('GET', `${BASE(subProjectId)}/layer/${id}`))
);

server.tool(
  'create_layer',
  'Create a new layer in a subproject (e.g. a bathymetry, WMS, or image overlay layer).',
  {
    name:         z.string(),
    url:          z.string().optional().describe('URL to the layer data (WMS URL, image URL, etc.)'),
    kind:         z.string().optional().describe('Layer type ID. Call get_layer_types to see available types.'),
    x:            z.number().optional(),
    y:            z.number().optional(),
    z:            z.number().optional(),
    rotation:     z.number().optional(),
    scale:        z.number().optional(),
    visible:      z.boolean().optional().default(true),
    opacity:      z.number().optional().describe('Opacity between 0 and 1'),
    description:  z.string().optional(),
    isWMS:        z.boolean().optional().describe('Set to true if this is a WMS layer'),
    isBathymetry: z.boolean().optional().describe('Set to true if this is a bathymetry layer'),
    tags:         z.array(z.string()).optional(),
    subProjectId: z.string().optional()
  },
  async ({ subProjectId, ...body }) =>
    ok(await api('POST', `${BASE(subProjectId)}/layer`, body))
);

server.tool(
  'update_layer',
  'Update an existing layer.',
  {
    id:          z.string(),
    name:        z.string().optional(),
    url:         z.string().optional(),
    kind:        z.string().optional(),
    x:           z.number().optional(),
    y:           z.number().optional(),
    z:           z.number().optional(),
    rotation:    z.number().optional(),
    scale:       z.number().optional(),
    visible:     z.boolean().optional(),
    opacity:     z.number().optional(),
    description: z.string().optional(),
    tags:        z.array(z.string()).optional(),
    subProjectId:z.string().optional()
  },
  async ({ id, subProjectId, ...body }) =>
    ok(await api('PATCH', `${BASE(subProjectId)}/layer/${id}`, body))
);

server.tool(
  'delete_layer',
  'Delete a layer.',
  { id: z.string(), subProjectId: z.string().optional() },
  async ({ id, subProjectId }) => ok(await api('DELETE', `${BASE(subProjectId)}/layer/${id}`))
);

// ==========================================================================
// CUSTOM COSTS
// ==========================================================================

server.tool(
  'get_custom_costs',
  'List all custom cost entries in a subproject.',
  { subProjectId: z.string().optional() },
  async ({ subProjectId }) => ok(await api('GET', `${BASE(subProjectId)}/customCost/`))
);

server.tool(
  'get_custom_cost',
  'Get a single custom cost entry by ID.',
  { id: z.string(), subProjectId: z.string().optional() },
  async ({ id, subProjectId }) => ok(await api('GET', `${BASE(subProjectId)}/customCost/${id}`))
);

server.tool(
  'create_custom_cost',
  'Create a new custom cost entry in a subproject.',
  {
    id:             z.string().describe('Unique ID for this cost entry'),
    assetName:      z.string().describe('Name of the asset this cost is associated with'),
    kind:           z.string().describe('Cost category: SPS | SPP | platform | vessel | rig | piping | umbilical | operation | generic'),
    vendorId:       z.string().describe('Vendor ID for the cost'),
    isValidForCost: z.boolean().describe('Whether this cost entry is included in cost calculations'),
    costObject: z.object({
      cost:              z.string().describe('Cost type'),
      item:              z.string().describe('Cost item name'),
      notes:             z.string(),
      value:             z.number().describe('Cost value'),
      ownerType:         z.string(),
      costByLength:      z.boolean().describe('If true, value is multiplied by resource length'),
      costPerLengthUnit: z.number(),
      entries:           z.string(),
      quantity:          z.string(),
      description:       z.string()
    }),
    tags:         z.array(z.string()).optional(),
    subProjectId: z.string().optional()
  },
  async ({ subProjectId, ...body }) =>
    ok(await api('POST', `${BASE(subProjectId)}/customCost/`, body))
);

server.tool(
  'create_custom_costs_batch',
  'Create multiple custom cost entries in one request.',
  {
    costs:        z.array(z.record(z.unknown())).describe('Array of cost entry objects'),
    subProjectId: z.string().optional()
  },
  async ({ costs, subProjectId }) =>
    ok(await api('POST', `${BASE(subProjectId)}/customCosts/batch`, costs))
);

server.tool(
  'update_custom_cost',
  'Update an existing custom cost entry.',
  {
    id:             z.string(),
    assetName:      z.string().optional(),
    kind:           z.string().optional(),
    vendorId:       z.string().optional(),
    isValidForCost: z.boolean().optional(),
    costObject:     z.record(z.unknown()).optional(),
    tags:           z.array(z.string()).optional(),
    subProjectId:   z.string().optional()
  },
  async ({ id, subProjectId, ...body }) =>
    ok(await api('PATCH', `${BASE(subProjectId)}/customCost/${id}`, body))
);

server.tool(
  'delete_custom_cost',
  'Delete a custom cost entry.',
  { id: z.string(), subProjectId: z.string().optional() },
  async ({ id, subProjectId }) => ok(await api('DELETE', `${BASE(subProjectId)}/customCost/${id}`))
);

// ==========================================================================
// SUBPROJECT DOCUMENTS
// ==========================================================================

server.tool(
  'get_subproject_documents',
  'List all documents attached to a subproject.',
  { subProjectId: z.string().optional() },
  async ({ subProjectId }) => ok(await api('GET', `${BASE(subProjectId)}/documents`))
);

server.tool(
  'upload_subproject_document',
  'Upload a document to a subproject (provide a URL pointing to the file).',
  {
    url:          z.string().describe('URL of the document to upload'),
    name:         z.string().optional().describe('Display name for the document'),
    subProjectId: z.string().optional()
  },
  async ({ subProjectId, ...body }) =>
    ok(await api('POST', `${BASE(subProjectId)}/documents`, body))
);

server.tool(
  'delete_subproject_document',
  'Delete a document from a subproject.',
  {
    documentId:   z.string().describe('Document ID'),
    subProjectId: z.string().optional()
  },
  async ({ documentId, subProjectId }) =>
    ok(await api('DELETE', `${BASE(subProjectId)}/documents/${documentId}`))
);

// ==========================================================================
// METADATA
// ==========================================================================

server.tool(
  'get_metadata_definitions',
  'List all metadata field definitions (shows what custom fields exist and their types). Use "-" as projectId to get account-wide definitions.',
  {
    projectId: z.string().optional().describe('Project ID. Defaults to "-" (account-level).')
  },
  async ({ projectId }) =>
    ok(await api('GET', `/API/v1.10/project/${projectId || '-'}/metaDataDefinitions`))
);

server.tool(
  'get_account_metadata_definitions',
  'List all account-level metadata definitions.',
  {},
  async () => ok(await api('GET', '/API/v1.10/metadatadefinitions'))
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
    resourceId:           z.string().describe('ID of the resource'),
    metaDataDefinitionId: z.string().describe('ID of the metadata field definition'),
    value:                z.unknown().describe('The value to store'),
    subProjectId:         z.string().optional()
  },
  async ({ resourceId, subProjectId, metaDataDefinitionId, value }) =>
    ok(await api('POST', `${BASE(subProjectId)}/${resourceId}/metaData`, { metaDataDefinitionId, value }))
);

server.tool(
  'update_metadata',
  'Update an existing metadata value on a resource.',
  {
    resourceId:   z.string().describe('ID of the resource'),
    metaDataId:   z.string().describe('ID of the specific metadata entry to update'),
    value:        z.unknown().describe('New value to store'),
    subProjectId: z.string().optional()
  },
  async ({ resourceId, metaDataId, value, subProjectId }) =>
    ok(await api('PATCH', `${BASE(subProjectId)}/${resourceId}/metaData/${metaDataId}`, { value }))
);

server.tool(
  'delete_metadata',
  'Delete a metadata value from a resource.',
  {
    resourceId:   z.string().describe('ID of the resource'),
    metaDataId:   z.string().describe('ID of the specific metadata entry to delete'),
    subProjectId: z.string().optional()
  },
  async ({ resourceId, metaDataId, subProjectId }) =>
    ok(await api('DELETE', `${BASE(subProjectId)}/${resourceId}/metaData/${metaDataId}`))
);

// ==========================================================================
// REFERENCE / TYPE LOOKUPS
// (These are account-level definitions used as "kind" IDs when creating resources)
// ==========================================================================

server.tool(
  'get_assets',
  'List all virtual asset definitions (3D symbols/models) available in the account. The returned IDs can be used as stagedAssetSymbolId when creating staged assets.',
  {},
  async () => ok(await api('GET', '/API/v1.10/assets'))
);

server.tool(
  'get_well_types',
  'List all well type definitions in the account. Use the returned IDs as the "kind" parameter when creating wells.',
  {},
  async () => ok(await api('GET', '/API/v1.10/wellTypes'))
);

server.tool(
  'get_well_bore_types',
  'List all well bore type definitions in the account. Use the returned IDs as the "kind" parameter when creating well bores.',
  {},
  async () => ok(await api('GET', '/API/v1.10/wellBoreTypes'))
);

server.tool(
  'get_annotation_types',
  'List all annotation type definitions in the account. Use the returned IDs as the "kind" parameter when creating annotations.',
  {},
  async () => ok(await api('GET', '/API/v1.10/annotationTypes'))
);

server.tool(
  'get_shape_types',
  'List all shape type definitions in the account. Use the returned IDs as the "kind" parameter when creating shapes.',
  {},
  async () => ok(await api('GET', '/API/v1.10/shapeTypes'))
);

server.tool(
  'get_layer_types',
  'List all layer type definitions in the account.',
  {},
  async () => ok(await api('GET', '/API/v1.10/layerTypes'))
);

server.tool(
  'get_connection_types',
  'List all connection type definitions in the account (pipeline types, cable types, etc.).',
  {},
  async () => ok(await api('GET', '/API/v1.10/connectionTypes'))
);

server.tool(
  'get_connection_type',
  'Get details of a specific connection type.',
  { id: z.string().describe('Connection type ID') },
  async ({ id }) => ok(await api('GET', `/API/v1.10/connectionTypes/${id}`))
);

server.tool(
  'get_connection_categories',
  'List all connection categories defined in the account.',
  {},
  async () => ok(await api('GET', '/API/v1.10/connectionCategories'))
);

server.tool(
  'get_connection_segment_types',
  'List all connection segment type definitions in the account. Use the returned IDs as the "kind" parameter when creating connection segments.',
  {},
  async () => ok(await api('GET', '/API/v1.10/connectionSegmentTypes'))
);

server.tool(
  'get_well_bore_segment_types',
  'List all well bore segment type definitions in the account.',
  {},
  async () => ok(await api('GET', '/API/v1.10/wellBoreSegmentTypes'))
);

// ==========================================================================
// ACCOUNT-LEVEL TAGS
// ==========================================================================

server.tool(
  'get_tags',
  'List all account-level tag definitions. Tags are hierarchical and used to categorize and filter resources.',
  {},
  async () => ok(await api('GET', '/API/v1.10/tags'))
);

server.tool(
  'get_tag',
  'Get details of a specific tag.',
  { id: z.string() },
  async ({ id }) => ok(await api('GET', `/API/v1.10/tags/${id}`))
);

server.tool(
  'create_tag',
  'Create a new account-level tag.',
  {
    id:     z.string().describe('Unique tag ID'),
    label:  z.string().describe('Display label for the tag'),
    color:  z.string().describe('CSS hex color e.g. #FF0000'),
    parent: z.string().optional().describe('Parent tag ID for hierarchical nesting')
  },
  async (body) => ok(await api('POST', '/API/v1.10/tags', body))
);

server.tool(
  'update_tag',
  'Update an existing tag.',
  {
    id:     z.string(),
    label:  z.string().optional(),
    color:  z.string().optional(),
    parent: z.string().optional()
  },
  async ({ id, ...body }) => ok(await api('PATCH', `/API/v1.10/tags/${id}`, body))
);

server.tool(
  'delete_tag',
  'Delete a tag.',
  { id: z.string() },
  async ({ id }) => ok(await api('DELETE', `/API/v1.10/tags/${id}`))
);

// ==========================================================================
// ACCOUNT INFO
// ==========================================================================

server.tool(
  'get_users',
  'List all users in the account.',
  {},
  async () => ok(await api('GET', '/API/v1.10/users'))
);

server.tool(
  'get_user',
  'Get details of a specific user.',
  { userId: z.string().describe('User ID') },
  async ({ userId }) => ok(await api('GET', `/API/v1.10/user/${userId}`))
);

server.tool(
  'get_usage',
  'Get account usage statistics.',
  {},
  async () => ok(await api('GET', '/API/v1.10/usage'))
);

server.tool(
  'get_account_logs',
  'Get account activity logs.',
  {},
  async () => ok(await api('GET', '/API/v1.10/logs'))
);

server.tool(
  'get_integrations',
  'List all integrations (iFrame apps) registered in the account.',
  {},
  async () => ok(await api('GET', '/API/v1.10/integrations'))
);

// ==========================================================================
// Start
// ==========================================================================

const transport = new StdioServerTransport();
await server.connect(transport);
