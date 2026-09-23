/**
 * Keep API schema extraction independent from runtime data-layer initialisation.
 *
 * The intercepted modules provide constants and validation callbacks used while Joi schemas are
 * constructed. They do not change the fields described by those schemas.
 */

export async function load(url, context, nextLoad) {
  if (url.endsWith('/routes/API.utils.middleware.js')) {
    return {
      format: 'module',
      shortCircuit: true,
      source: `
        const singularNames = {
          users: 'user',
          accounts: 'account',
          projects: 'project',
          subProjects: 'subProject',
          workflowTasks: 'workflowTask',
        }
        export default {
          singular: (resourceType) => singularNames[resourceType] || resourceType,
          asyncMiddleware: (handler) => handler,
        }
      `,
    }
  }

  if (url.endsWith('/routes/API.utils.resourceFiltering.js')) {
    return {
      format: 'module',
      shortCircuit: true,
      source: `
        export default {
          getValidFilterResourceTypesForRoot: (rootType, relationships) =>
            new Set([rootType, ...Object.keys(relationships)]),
          splitCommaSeparated: (value) => String(value).split(','),
        }
      `,
    }
  }

  if (url.endsWith('/routes/API.utils.workflow.js')) {
    return {
      format: 'module',
      shortCircuit: true,
      source: `
        import Joi from 'joi'
        export const workflowTaskQueryParamsSchema = Joi.object({
          assignedUsers: Joi.array().items(Joi.string()).description('Comma-separated user ids; include tasks assigned to any of these users.'),
          column: Joi.string().description('Workflow column id; include tasks in this column.'),
          linkedResources: Joi.array().items(Joi.string()).description('Comma-separated resource ids; include tasks linked to these resources.'),
          tags: Joi.array().items(Joi.string()).description('Comma-separated tags; include tasks carrying any of these tags.'),
          startDate: Joi.number().integer().description('Unix timestamp; include tasks starting on or after this date.'),
          endDate: Joi.number().integer().description('Unix timestamp; include tasks ending on or before this date.'),
          done: Joi.boolean().description('Filter tasks by completion state.'),
          project: Joi.string().description('Project id; include tasks belonging to this project.'),
          subProject: Joi.string().description('Sub-project id; include tasks belonging to this sub-project.'),
        })
      `,
    }
  }

  if (url.endsWith('/routes/API.utils.documents.js')) {
    return {
      format: 'module',
      shortCircuit: true,
      source: `
        export const DOCUMENT_UPLOAD_FORM_FIELDS = {
          description: { schema: { type: 'string' }, description: 'Description of the document revision.' },
          creator: { schema: { type: 'string' }, description: 'Email of the creator (if no JWT is provided).' },
          vendorId: { schema: { type: 'string' }, description: 'User defined string, stored inside the created revision.' },
          vendorAttributes: { schema: { type: 'object' }, description: 'User defined JSON object (as a string), stored inside the created revision.' },
          documentVendorId: { schema: { type: 'string' }, description: 'User defined string, stored inside the document.' },
          documentVendorAttributes: { schema: { type: 'object' }, description: 'User defined JSON object (as a string), stored inside the document.' },
          tags: { schema: { type: 'array', items: { type: 'string' } }, description: 'Array of tags.' },
          documentGroupId: { schema: { type: 'string' }, description: 'Used to link multiple documents together so they can be deleted together.' },
          relateToId: { schema: { type: 'string' }, includeRelateTo: true, description: 'If specified, link the document to a given element within the sub project.' },
          relateToType: { schema: { type: 'string' }, includeRelateTo: true, description: 'If relateToId is specified, the element resource type.' },
        }
      `,
    }
  }

  if (url.endsWith('/routes/API.utils.connectionCrossings.js')) {
    return {
      format: 'module',
      shortCircuit: true,
      source: `
        import Joi from 'joi'
        export const crossingsSchema = Joi.object({
          connections: Joi.array().items(Joi.string()).description('Connection ids to include in the search. If omitted, all crossings are returned.'),
          inclusive: Joi.boolean().default(false).description('When true, a crossing is reported only if both crossing connections are present in the connections list.'),
          viewBox: Joi.array().optional().items(Joi.number()).length(4).description('Optional [minX, minY, maxX, maxY] bounding box; only crossings within it are returned.'),
        })
      `,
    }
  }

  if (url.endsWith('/routes/API.utils.schematics.js')) {
    return {
      format: 'module',
      shortCircuit: true,
      source: `
        import Joi from 'joi'
        export const schematicsSchema = Joi.object({
          stagedAssetFrom: Joi.string().description('Staged asset id to start schematic generation from.'),
          flowDirection: Joi.string().valid('UP', 'DOWN', 'LEFT', 'RIGHT').description('Direction of the generated schematic from the root staged asset.'),
          edgeType: Joi.string().valid('straight', 'curved1', 'curved2', 'orthogonal').description('Presentation of the edges.'),
          removeOneToOnePlets: Joi.boolean().description('If true, one-to-one PLETs are removed from the schematic.'),
          showEdgeDirections: Joi.boolean().description('If true, edge directions are displayed.'),
          edgeOutlinesEnabled: Joi.boolean().description('If true, edge outlines are displayed.'),
          useLegacyGeneration: Joi.boolean().description('If true, the legacy schematic generation is used.'),
          showEmptySockets: Joi.boolean().description('If true, empty sockets are displayed.'),
          constrainSocketPositions: Joi.boolean().description('If true, socket positions are constrained.'),
          directGraphViaConnections: Joi.boolean().description('If true, the graph is directed via connections.'),
          excludeConnectionTypes: Joi.array().items(Joi.object()).description('Connection types to exclude from the schematic.'),
          includeConnectionTypes: Joi.array().items(Joi.object()).description('Connection types to restrict the schematic to.'),
          excludeConnectionCategories: Joi.array().items(Joi.object()).description('Connection categories to exclude from the schematic.'),
          includeConnectionCategories: Joi.array().items(Joi.object()).description('Connection categories to restrict the schematic to.'),
          excludeTags: Joi.array().items(Joi.object()).description('Tags to exclude from the schematic.'),
          includeTags: Joi.array().items(Joi.object()).description('Tags to restrict the schematic to.'),
        }).description('Schematic generation options')
      `,
    }
  }

  if (url.endsWith('/libraries/generators/connection/generator.js')) {
    return {
      format: 'module',
      shortCircuit: true,
      source: `
        export const DESIGN_NONE = 'Standard'
        export const DESIGN_RIZER_LAZYWAVE = 'Riser - Lazy Wave'
        export const DESIGN_RIZER_CATENARY = 'Riser - Catenary'
        export const DESIGN_RIZER_TAUT = 'Riser - Taut'
        export const DESIGN_JUMPER_HORIZONTAL_Z = 'Jumper - Horizontal Z'
        export const DESIGN_JUMPER_VERTICAL_M = 'Jumper - Vertical M'
        export const DESIGN_JUMPER_VERTICAL_N = 'Jumper - Vertical N'
        export const DESIGN_IMPORTED = 'Imported'
        export const Designs = [
          DESIGN_NONE,
          DESIGN_RIZER_LAZYWAVE,
          DESIGN_RIZER_CATENARY,
          DESIGN_RIZER_TAUT,
          DESIGN_JUMPER_HORIZONTAL_Z,
          DESIGN_JUMPER_VERTICAL_M,
          DESIGN_JUMPER_VERTICAL_N,
        ]
        export const defaultParams = () => ({})
        export const generateConnection = () => ({})
        export const changeRadiusOfMbrPointWhilePreservingInputAndOutputDir = () => undefined
        export const getMbrIntersectionPoint = () => undefined
        export const isImported = (type) => type === DESIGN_IMPORTED
        export const isJumperHorizontal = () => false
        export const isJumperVertical = () => false
        export const isRiser = () => false
      `,
    }
  }

  if (url.endsWith('/routes/API.utils.validation.js')) {
    return {
      format: 'module',
      shortCircuit: true,
      source: `
        const identity = (value) => value
        const noop = () => undefined
        export default {
          vendorAttributeCustomValidator: identity,
          validateCountryName: identity,
          checkIfResourcesForRelationShipsExists: noop,
          validateVisibleVisualisationMapId: noop,
          validateSegmentsFitInParents: noop,
          SEGMENT_PARENT_ATTRIBUTE: {},
        }
      `,
    }
  }

  if (url.endsWith('/routes/API.utils.metaData.js')) {
    return {
      format: 'module',
      shortCircuit: true,
      source: `
        export default {
          ALLOWED_RELATE_TO_TYPE: [
            'asset',
            'virtualAsset',
            'connection',
            'connectionSegment',
            'well',
            'well-bore',
            'well-bore-segment',
            'layer',
            'connector',
            'shape',
          ],
        }
      `,
    }
  }

  if (url.endsWith('/libraries/defaults/licenses.js')) {
    return {
      format: 'module',
      shortCircuit: true,
      source: `
        export const LICENSE_TYPE_VIEW = 'view'
        export const LICENSE_TYPE_PRO = 'pro'
        export const LICENSE_TYPE_DESIGN = 'design'
        export const createDefaultLicenseConfiguration = () => ({})
      `,
    }
  }

  if (url.endsWith('/libraries/defaults/user-rights.js')) {
    return {
      format: 'module',
      shortCircuit: true,
      source: `
        export const USER_ROLE_SYSTEM_VIEWER = '__System_Viewer__'
        export const DEFAULT_RIGHTS = { get: () => ({}) }
        export const USER_RIGHTS_TYPES = { get: () => [] }
        export const DEFAULT_ROLES = { get: () => [], find: () => undefined }
        export const SYSTEM_DEFAULT_ROLES = { get: () => [] }
      `,
    }
  }

  return nextLoad(url, context)
}
