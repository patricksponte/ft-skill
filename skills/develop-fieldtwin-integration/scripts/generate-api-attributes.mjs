#!/usr/bin/env node

import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { register } from 'node:module'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url))
const DEFAULT_OUTPUT = path.resolve(SCRIPT_DIRECTORY, '..', 'references')

/**
 * Read one named command-line option.
 *
 * @param {string} name
 * @param {string|undefined} fallback
 * @returns {string|undefined}
 */
function option(name, fallback) {
  const index = process.argv.indexOf(name)
  if (index === -1) {
    return fallback
  }
  return process.argv[index + 1]
}

const sourceRoot = option('--source')
const outputDirectory = path.resolve(option('--output', DEFAULT_OUTPUT))

if (!sourceRoot) {
  throw new Error('Usage: generate-api-attributes.mjs --source <FieldTwin source checkout> [--output <directory>]')
}

const resolvedSourceRoot = path.resolve(sourceRoot)
register(new URL('./schema-loader.mjs', import.meta.url), import.meta.url)

/**
 * Import a module from the FieldTwin source checkout.
 *
 * @param {...string} segments
 * @returns {Promise<Record<string, unknown>>}
 */
function importSource(...segments) {
  return import(pathToFileURL(path.join(resolvedSourceRoot, ...segments)).href)
}

/**
 * Remove undefined values recursively so generated output is stable and compact.
 *
 * @param {unknown} value
 * @returns {unknown}
 */
function compact(value) {
  if (Array.isArray(value)) {
    return value.map(compact)
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, child]) => child !== undefined)
        .map(([key, child]) => [key, compact(child)])
    )
  }
  return value
}

/**
 * Sort attributes by path and remove exact duplicates.
 *
 * @param {Array<Record<string, unknown>>} attributes
 * @returns {Array<Record<string, unknown>>}
 */
function normalizeAttributes(attributes) {
  const unique = new Map()
  for (const attribute of attributes) {
    const key = `${attribute.location || ''}:${attribute.mediaType || ''}:${attribute.variant || ''}:${attribute.path}`
    unique.set(key, compact(attribute))
  }
  return [...unique.values()].sort((left, right) =>
    String(left.path).localeCompare(String(right.path))
  )
}

/**
 * Resolve one local OpenAPI component reference.
 *
 * @param {Record<string, unknown>} document
 * @param {string} reference
 * @returns {Record<string, unknown>}
 */
function resolveOpenApiReference(document, reference) {
  if (!reference.startsWith('#/')) {
    return {}
  }
  return reference
    .slice(2)
    .split('/')
    .reduce((value, segment) => value?.[segment.replaceAll('~1', '/').replaceAll('~0', '~')], document) || {}
}

/**
 * Flatten a complete OpenAPI schema, following local refs and composition.
 *
 * @param {Record<string, unknown>} schema
 * @param {Record<string, unknown>} document
 * @param {string} prefix
 * @param {Set<string>} seenReferences
 * @returns {Array<Record<string, unknown>>}
 */
function flattenOpenApiSchema(schema, document, prefix = '$', seenReferences = new Set()) {
  if (!schema || typeof schema !== 'object') {
    return []
  }
  if (schema.$ref) {
    if (seenReferences.has(schema.$ref)) {
      return []
    }
    const nextSeen = new Set(seenReferences)
    nextSeen.add(schema.$ref)
    return flattenOpenApiSchema(
      { ...resolveOpenApiReference(document, schema.$ref), ...schema, $ref: undefined },
      document,
      prefix,
      nextSeen
    )
  }

  const attributes = []
  const variants = [...(schema.allOf || []), ...(schema.oneOf || []), ...(schema.anyOf || [])]
  for (let index = 0; index < variants.length; index += 1) {
    attributes.push(
      ...flattenOpenApiSchema(variants[index], document, prefix, seenReferences).map(
        (attribute) => ({ ...attribute, variant: attribute.variant || String(index + 1) })
      )
    )
  }

  for (const [name, childSchema] of Object.entries(schema.properties || {})) {
    const attributePath = prefix === '$' ? name : `${prefix}.${name}`
    const resolvedChild = childSchema.$ref
      ? { ...resolveOpenApiReference(document, childSchema.$ref), ...childSchema }
      : childSchema
    const variantTypes = [
      ...(resolvedChild.oneOf || []),
      ...(resolvedChild.anyOf || []),
    ]
      .map((variant) => variant.type)
      .filter(Boolean)
    attributes.push({
      path: attributePath,
      type: variantTypes.length
        ? [...new Set(variantTypes)].join('|')
        : resolvedChild.type || (resolvedChild.properties ? 'object' : 'unknown'),
      required: (schema.required || []).includes(name),
      description: resolvedChild.description,
      allowedValues: resolvedChild.enum,
      default: resolvedChild.default,
    })
    attributes.push(
      ...flattenOpenApiSchema(resolvedChild, document, attributePath, seenReferences)
    )
  }

  if (schema.items) {
    attributes.push(...flattenOpenApiSchema(schema.items, document, `${prefix}[]`, seenReferences))
  }
  if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
    attributes.push(
      ...flattenOpenApiSchema(
        schema.additionalProperties,
        document,
        `${prefix}{}`,
        seenReferences
      )
    )
  }
  if (prefix === '$' && !schema.properties && !variants.length) {
    attributes.push({
      path: '$',
      type: schema.type || 'unknown',
      description: schema.description,
      allowedValues: schema.enum,
    })
  }
  return normalizeAttributes(attributes)
}

/**
 * Flatten all request and successful-response fields for every v2 OpenAPI operation.
 *
 * @param {Record<string, unknown>} document
 * @returns {Array<Record<string, unknown>>}
 */
function v2OperationsFromOpenApi(document) {
  const operations = []
  for (const [operationPath, pathItem] of Object.entries(document.paths || {})) {
    const pathParameters = pathItem.parameters || []
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!['get', 'post', 'patch', 'delete', 'put'].includes(method)) {
        continue
      }
      const attributes = []
      for (const parameter of [...pathParameters, ...(operation.parameters || [])]) {
        attributes.push({
          location: parameter.in,
          path: parameter.name,
          type: parameter.schema?.type || 'unknown',
          required: Boolean(parameter.required),
          description: parameter.description,
          allowedValues: parameter.schema?.enum || parameter.schema?.items?.enum,
          default: parameter.schema?.default,
        })
      }
      for (const [mediaType, body] of Object.entries(operation.requestBody?.content || {})) {
        attributes.push(
          ...flattenOpenApiSchema(body.schema, document).map((attribute) => ({
            ...attribute,
            location: 'body',
            mediaType,
          }))
        )
      }
      const successfulResponse = operation.responses?.['200'] || operation.responses?.[200]
      const resolvedResponse = successfulResponse?.$ref
        ? resolveOpenApiReference(document, successfulResponse.$ref)
        : successfulResponse
      for (const [mediaType, response] of Object.entries(resolvedResponse?.content || {})) {
        attributes.push(
          ...flattenOpenApiSchema(response.schema, document).map((attribute) => ({
            ...attribute,
            location: 'response',
            mediaType,
          }))
        )
      }
      operations.push({
        method: method.toUpperCase(),
        path: `/API/v2.0${operationPath}`,
        summary: operation.summary,
        attributes: normalizeAttributes(attributes),
      })
    }
  }
  return operations.sort((left, right) =>
    `${left.path} ${left.method}`.localeCompare(`${right.path} ${right.method}`)
  )
}

/**
 * Flatten an events-manifest attribute map into searchable dotted paths.
 *
 * @param {Record<string, Record<string, unknown>>} source
 * @param {string} prefix
 * @returns {Array<Record<string, unknown>>}
 */
function flattenManifest(source, prefix = '') {
  const attributes = []
  for (const [name, descriptor] of Object.entries(source || {})) {
    if (!descriptor || typeof descriptor !== 'object') {
      continue
    }
    if (['isCollection', 'isGraphRoot', 'rootTypes'].includes(name)) {
      continue
    }
    const attributePath = prefix ? `${prefix}.${name}` : name
    let type = descriptor.type
    if (descriptor.isMany) {
      type = 'relationship[]'
    } else if (descriptor.isOne) {
      type = 'relationship'
    } else if (descriptor.isRelationship) {
      type = 'relationship'
    }
    attributes.push({
      path: attributePath,
      type: type || 'unknown',
      description: descriptor.description,
      documented: Boolean(descriptor.description),
      readOnly: Boolean(descriptor.readOnly),
      relationship: Boolean(descriptor.isRelationship),
      relatedResourceType: descriptor.resourceType,
      relatedResourceTypes: descriptor.resourceTypes,
      default: descriptor.defaultValue,
      arrayUpdateKey: descriptor.arrayUpdateKey,
    })
    if (descriptor.props) {
      attributes.push(...flattenManifest(descriptor.props, attributePath))
    }
    if (descriptor.items?.props) {
      attributes.push(...flattenManifest(descriptor.items.props, `${attributePath}[]`))
    }
  }
  return normalizeAttributes(attributes)
}

/**
 * Return a useful type for a Joi description.
 *
 * @param {Record<string, unknown>} descriptor
 * @returns {string}
 */
function joiType(descriptor) {
  if (descriptor.type !== 'alternatives') {
    return String(descriptor.type || 'unknown')
  }
  const alternatives = descriptor.matches || []
  const types = alternatives
    .map((match) => match.schema?.type || match.then?.type || match.otherwise?.type)
    .filter(Boolean)
  return types.length ? [...new Set(types)].join('|') : 'alternatives'
}

/**
 * Flatten a Joi describe() tree into searchable dotted paths.
 *
 * @param {Record<string, unknown>} descriptor
 * @param {string} prefix
 * @returns {Array<Record<string, unknown>>}
 */
function flattenJoi(descriptor, prefix = '') {
  const attributes = []
  const keys = descriptor.keys || {}
  for (const [name, child] of Object.entries(keys)) {
    const attributePath = prefix ? `${prefix}.${name}` : name
    const flags = child.flags || {}
    const rules = (child.rules || []).map((rule) => compact({ name: rule.name, args: rule.args }))
    const allowedValues = (child.allow || []).filter(
      (value) => value !== '' && typeof value !== 'object'
    )
    attributes.push({
      path: attributePath,
      type: joiType(child),
      required: flags.presence === 'required',
      forbidden: flags.presence === 'forbidden',
      description: flags.description,
      default: flags.default,
      allowedValues: allowedValues.length ? allowedValues : undefined,
      rules: rules.length ? rules : undefined,
    })
    if (child.keys) {
      attributes.push(...flattenJoi(child, attributePath))
    }
    for (const item of child.items || []) {
      if (item.keys) {
        attributes.push(...flattenJoi(item, `${attributePath}[]`))
      }
    }
    for (const match of child.matches || []) {
      for (const variant of [match.schema, match.then, match.otherwise]) {
        if (variant?.keys) {
          attributes.push(...flattenJoi(variant, attributePath))
        }
      }
    }
  }
  return normalizeAttributes(attributes)
}

/**
 * Flatten OpenAPI-style properties used by response massage configuration.
 *
 * @param {Record<string, unknown>} properties
 * @param {string} prefix
 * @returns {Array<Record<string, unknown>>}
 */
function flattenOpenApi(properties, prefix = '') {
  const attributes = []
  for (const [name, descriptor] of Object.entries(properties || {})) {
    const attributePath = prefix ? `${prefix}.${name}` : name
    const anyTypes = (descriptor.anyOf || []).map((variant) => variant.type).filter(Boolean)
    attributes.push({
      path: attributePath,
      type: anyTypes.length ? anyTypes.join('|') : descriptor.type || 'unknown',
      description: descriptor.description,
      calculated: true,
    })
    if (descriptor.properties) {
      attributes.push(...flattenOpenApi(descriptor.properties, attributePath))
    }
    if (descriptor.items?.properties) {
      attributes.push(...flattenOpenApi(descriptor.items.properties, `${attributePath}[]`))
    }
    if (descriptor.additionalProperties?.properties) {
      attributes.push(
        ...flattenOpenApi(descriptor.additionalProperties.properties, `${attributePath}{}`)
      )
    }
  }
  return normalizeAttributes(attributes)
}

/**
 * Read the concrete built-in user-right keys without executing the data layer.
 *
 * @returns {Promise<string[]>}
 */
async function readDefaultUserRights() {
  const source = await readFile(
    path.join(resolvedSourceRoot, 'common', 'libraries', 'defaults', 'user-rights.js'),
    'utf8'
  )
  const block = source.match(/const defaultRights\s*=\s*\{([\s\S]*?)\n\}/)?.[1] || ''
  return [...block.matchAll(/^\s*(can[A-Za-z0-9]+)\s*:/gm)]
    .map((match) => match[1])
    .sort()
}

/**
 * Generate the v2 resource and stream catalogs.
 *
 * @returns {Promise<Record<string, unknown>>}
 */
async function generateV2Catalog() {
  const manifestModule = await importSource(
    'backends',
    'events',
    'src',
    'Handlers',
    'ManifestHandler.js'
  )
  manifestModule.buildManifest()
  let serializedManifest = ''
  const response = {
    header() {
      return this
    },
    status() {
      return this
    },
    send(value) {
      serializedManifest = value
      return this
    },
  }
  manifestModule.queryManifest({}, response)
  const manifest = JSON.parse(serializedManifest)
  const version = manifest._metaData?.fieldtwinVersion || 'development'
  delete manifest._metaData

  const schemaModule = await importSource(
    'backends',
    'fieldtwinapi',
    'routes',
    'API.v2.0',
    'schemas',
    'streams',
    'index.js'
  )
  const massageModule = await importSource(
    'backends',
    'fieldtwinapi',
    'routes',
    'API.v2.0',
    'API.utils.v2.0.massageManifest.js'
  )

  const resources = {}
  for (const [resourceType, descriptor] of Object.entries(manifest)) {
    resources[resourceType] = {
      isCollection: Boolean(descriptor.isCollection),
      isGraphRoot: Boolean(descriptor.isGraphRoot),
      rootTypes: descriptor.rootTypes || [],
      attributes: flattenManifest(descriptor),
    }
  }

  const defaultRights = await readDefaultUserRights()
  const streams = {}
  for (const method of ['post', 'patch', 'delete']) {
    for (const [stream, schemas] of Object.entries(schemaModule.default[method])) {
      streams[stream] ||= { get: {}, post: {}, patch: {}, delete: {} }
      for (const [resourceType, schema] of Object.entries(schemas)) {
        const attributes = flattenJoi(schema.describe())
        if (resourceType === 'userRoles' && ['post', 'patch'].includes(method)) {
          for (const right of defaultRights) {
            attributes.push({
              path: `userRights.${right}`,
              type: 'boolean',
              required: false,
              description: 'Built-in FieldTwin user right.',
            })
          }
        }
        streams[stream][method][resourceType] = {
          attributes: normalizeAttributes(attributes),
        }
      }
    }
  }

  for (const [stream, configuration] of Object.entries(
    massageModule.massageAttributesForStreams
  )) {
    streams[stream] ||= { get: {}, post: {}, patch: {}, delete: {} }
    const get = {
      rootAdditionalAttributes: flattenOpenApi(
        configuration.additionalAttributes?.properties || {}
      ),
      additionalRelationships: {},
      resourceOverrides: {},
    }
    for (const [resourceType, relationshipProperties] of Object.entries(
      configuration.additionalRelationships || {}
    )) {
      get.additionalRelationships[resourceType] = {
        attributes: flattenOpenApi(relationshipProperties),
      }
    }
    for (const [resourceType, override] of Object.entries(configuration)) {
      if (!override || typeof override !== 'object' || Array.isArray(override)) {
        continue
      }
      if (!override.additionalAttributes && !override.excludeAttributesFromGet) {
        continue
      }
      get.resourceOverrides[resourceType] = {
        excludedAttributes: override.excludeAttributesFromGet || [],
        additionalAttributes: flattenOpenApi(
          override.additionalAttributes?.properties || {}
        ),
      }
    }
    streams[stream].get = get
  }

  const originalFetch = globalThis.fetch
  const originalLog = console.log
  globalThis.fetch = async () => ({ ok: true, json: async () => manifest })
  console.log = () => undefined
  let apiDocument
  try {
    const apiDocModule = await importSource(
      'backends',
      'fieldtwinapi',
      'utils',
      'buildApiDoc.js'
    )
    await apiDocModule.buildAPIDocResponsesSchemas()
    const paths = {}
    apiDocModule.addRootPath('users', paths, { noParameters: true })
    apiDocModule.addRootPath('accounts', paths)
    apiDocModule.addRootPath('projects', paths)
    apiDocModule.addRootPath('subProjects', paths)
    apiDocModule.addRootPath('workflowTasks', paths, { noParameters: true })
    apiDocModule.addCustomPaths(paths)
    apiDocModule.buildAPIDocRequestPath(paths)
    apiDocument = apiDocModule.oas3
  } finally {
    globalThis.fetch = originalFetch
    console.log = originalLog
  }

  return {
    catalogVersion: 1,
    apiVersion: 'v2.0',
    fieldtwinVersion: version,
    generatedOn: new Date().toISOString().slice(0, 10),
    contract: {
      read: 'Events manifest plus stream-specific response transformations.',
      write: 'Per-stream Joi request schemas for POST, PATCH, and DELETE.',
      pathNotation: 'Dots indicate nested properties, [] an array item, and {} a dynamic map value.',
    },
    resources,
    streams,
    operations: v2OperationsFromOpenApi(apiDocument),
  }
}

/**
 * Recursively list files below a directory.
 *
 * @param {string} directory
 * @returns {Promise<string[]>}
 */
async function listFiles(directory) {
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const child = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await listFiles(child)))
    } else {
      files.push(child)
    }
  }
  return files
}

/**
 * Extract documentation comments from source text.
 *
 * @param {string} source
 * @returns {string[]}
 */
function documentationComments(source) {
  return [...source.matchAll(/\/\*\*([\s\S]*?)\*\//g)].map((match) =>
    match[1]
      .split('\n')
      .map((line) => line.replace(/^\s*\*?\s?/, ''))
      .join('\n')
  )
}

/**
 * Parse one ApiDoc field directive.
 *
 * @param {string} line
 * @returns {Record<string, unknown>|null}
 */
function parseApiField(line) {
  const match = line.match(
    /^@api(Success|Body|Param|Query|Header)\s+(?:\(([^)]+)\)\s+)?\{([^}]+)\}\s+(\[[^\]]+\]|\S+)(?:\s+(.*))?$/
  )
  if (!match) {
    return null
  }
  let rawPath = match[4]
  let optional = false
  let defaultValue
  if (rawPath.startsWith('[') && rawPath.endsWith(']')) {
    optional = true
    rawPath = rawPath.slice(1, -1)
  }
  const equalsIndex = rawPath.indexOf('=')
  if (equalsIndex !== -1) {
    defaultValue = rawPath.slice(equalsIndex + 1)
    rawPath = rawPath.slice(0, equalsIndex)
  }
  const locationByDirective = {
    Success: 'response',
    Body: 'body',
    Param: 'path',
    Query: 'query',
    Header: 'header',
  }
  return compact({
    location: locationByDirective[match[1]],
    group: match[2],
    path: rawPath,
    type: match[3],
    optional,
    default: defaultValue,
    description: match[5],
  })
}

/**
 * Parse every field directive in a documentation comment.
 *
 * @param {string} comment
 * @returns {Array<Record<string, unknown>>}
 */
function parseApiFields(comment) {
  return comment
    .split('\n')
    .map((line) => parseApiField(line.trim()))
    .filter(Boolean)
}

/**
 * Load ApiDoc comments and definitions for one source API version.
 *
 * @param {string} sourceVersion
 * @returns {Promise<{comments: string[], definitions: Map<string, Array<Record<string, unknown>>>}>}
 */
async function loadApiDocVersion(sourceVersion) {
  const directory = path.join(
    resolvedSourceRoot,
    'backends',
    'fieldtwinapi',
    'routes',
    `API.${sourceVersion}`
  )
  const files = (await listFiles(directory)).filter((file) => file.endsWith('.documentation.js'))
  const comments = []
  const definitions = new Map()
  for (const file of files.sort()) {
    for (const comment of documentationComments(await readFile(file, 'utf8'))) {
      comments.push(comment)
      const definitionName = comment.match(/@apiDefine\s+(\S+)/)?.[1]
      if (definitionName) {
        definitions.set(definitionName, parseApiFields(comment))
      }
    }
  }
  return { comments, definitions }
}

/**
 * Normalize inherited paths to the effective public v1.10 root.
 *
 * @param {string} apiPath
 * @returns {string}
 */
function normalizeV110Path(apiPath) {
  return apiPath.replace('/API/v1.9', '/API/v1.10')
}

/**
 * Parse operations for one ApiDoc source version.
 *
 * @param {string} sourceVersion
 * @param {string[]} comments
 * @param {Map<string, Array<Record<string, unknown>>>} definitions
 * @returns {{operations: Array<Record<string, unknown>>, unresolvedUses: string[]}}
 */
function parseOperations(sourceVersion, comments, definitions) {
  const operations = []
  const unresolvedUses = new Set()
  for (const comment of comments) {
    const api = comment.match(/@api\s+\{([^}]+)\}\s+(\S+)\s*([^\n]*)/)
    if (!api) {
      continue
    }
    const fields = parseApiFields(comment)
    for (const use of comment.matchAll(/@apiUse\s+(\S+)/g)) {
      const definedFields = definitions.get(use[1])
      if (definedFields) {
        fields.push(...definedFields)
      } else {
        unresolvedUses.add(use[1])
      }
    }
    const method = api[1].toUpperCase()
    const effectivePath = normalizeV110Path(api[2])
    const name = comment.match(/@apiName\s+([^\s]+)/)?.[1]
    operations.push({
      method,
      path: effectivePath,
      title: api[3].trim(),
      name,
      group: comment.match(/@apiGroup\s+([^\n]+)/)?.[1]?.trim(),
      sourceVersion,
      inherited: sourceVersion === 'v1.9',
      attributes: normalizeAttributes(fields),
    })
  }
  return { operations, unresolvedUses: [...unresolvedUses].sort() }
}

/**
 * Generate the effective v1.10 operation and attribute catalog.
 *
 * @returns {Promise<Record<string, unknown>>}
 */
async function generateV110Catalog() {
  const v19 = await loadApiDocVersion('v1.9')
  const v110 = await loadApiDocVersion('v1.10')
  const parsed19 = parseOperations('v1.9', v19.comments, v19.definitions)
  const combinedDefinitions = new Map([...v19.definitions, ...v110.definitions])
  const parsed110 = parseOperations('v1.10', v110.comments, combinedDefinitions)
  const effective = new Map()
  for (const operation of parsed19.operations) {
    effective.set(`${operation.method} ${operation.path} ${operation.name || ''}`, operation)
  }
  for (const operation of parsed110.operations) {
    effective.set(`${operation.method} ${operation.path} ${operation.name || ''}`, operation)
  }
  const operations = [...effective.values()].sort((left, right) =>
    `${left.path} ${left.method} ${left.name || ''}`.localeCompare(
      `${right.path} ${right.method} ${right.name || ''}`
    )
  )
  return {
    catalogVersion: 1,
    apiVersion: 'v1.10',
    generatedOn: new Date().toISOString().slice(0, 10),
    contract: {
      source: 'Effective v1.10 ApiDoc annotations, including v1.9 operations inherited by v1.10.',
      pathNotation: 'Dots indicate nested properties. Optional attributes are marked explicitly.',
      limitation: 'The catalog records the documented public contract; undocumented runtime fields are not inferred.',
    },
    unresolvedApiUses: [...new Set([...parsed19.unresolvedUses, ...parsed110.unresolvedUses])],
    operations,
  }
}

const [v110Catalog, v2Catalog] = await Promise.all([
  generateV110Catalog(),
  generateV2Catalog(),
])

await mkdir(outputDirectory, { recursive: true })
await Promise.all([
  writeFile(
    path.join(outputDirectory, 'api-attributes-v1.10.json'),
    `${JSON.stringify(v110Catalog, null, 2)}\n`
  ),
  writeFile(
    path.join(outputDirectory, 'api-attributes-v2.0.json'),
    `${JSON.stringify(v2Catalog, null, 2)}\n`
  ),
])

const v110AttributeCount = v110Catalog.operations.reduce(
  (count, operation) => count + operation.attributes.length,
  0
)
const v2ReadCount = Object.values(v2Catalog.resources).reduce(
  (count, resource) => count + resource.attributes.length,
  0
)
const v2WriteCount = Object.values(v2Catalog.streams).reduce(
  (streamCount, stream) =>
    streamCount +
    ['post', 'patch', 'delete'].reduce(
      (methodCount, method) =>
        methodCount +
        Object.values(stream[method]).reduce(
          (resourceCount, resource) => resourceCount + resource.attributes.length,
          0
        ),
      0
    ),
  0
)

console.log(
  JSON.stringify(
    {
      v110: { operations: v110Catalog.operations.length, attributes: v110AttributeCount },
      v2: {
        resources: Object.keys(v2Catalog.resources).length,
        streams: Object.keys(v2Catalog.streams).length,
        operations: v2Catalog.operations.length,
        readAttributes: v2ReadCount,
        writeAttributes: v2WriteCount,
      },
    },
    null,
    2
  )
)
