#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const skillDirectory = path.dirname(scriptDirectory)
const outputPath = path.join(skillDirectory, 'references', 'postmessage-attributes.json')

function field(pathName, type, required, description, options = {}) {
  return { path: pathName, type, required, description, ...options }
}

const eventField = field('event', 'string', true, 'Exact case-sensitive event discriminator.')

const sendMessageFields = [
  field('isFrameActive', 'boolean', true, 'Whether the target iframe or pop-out is currently active.', { suppliedBy: 'host transport' }),
  field('isOperation', 'boolean', true, 'Whether the FieldTwin host is in Operation Mode.', { suppliedBy: 'host transport' }),
  field('APIServerIsReady', 'boolean', true, 'Whether the active subproject API pod is ready.', { suppliedBy: 'host transport' }),
  field('APIVersion', 'string', true, 'Current FieldTwin API version, for example v1.10.', { suppliedBy: 'host transport' }),
  field('siblingAPIServerAreReady', 'object<string, boolean>', true, 'Readiness by sibling subproject ID.', { suppliedBy: 'host transport' }),
]

const directReplyFields = [
  field('doNotProcessMessage', 'boolean', true, 'Prevents the host from reprocessing its own reply.', { suppliedBy: 'host reply transport', constant: true }),
  field('responseToEvent', 'string', true, 'The integration request event that produced this direct reply.', { suppliedBy: 'host reply transport' }),
  field('isOperation', 'boolean', true, 'Whether the FieldTwin host is in Operation Mode.', { suppliedBy: 'host reply transport' }),
]

function message(direction, event, variant, category, delivery, summary, fields, options = {}) {
  const augmentation = delivery === 'sendMessage' ? sendMessageFields : delivery === 'directReply' ? directReplyFields : []
  const effectiveFields = [...fields, ...augmentation].filter(
    (candidate, index, all) => all.findIndex((item) => item.path === candidate.path) === index,
  )
  return {
    direction,
    event,
    variant,
    category,
    delivery,
    summary,
    surfaces: options.surfaces || ['designer', 'presenter', 'pop-out'],
    correlation: options.correlation || 'none',
    reply: options.reply || null,
    notes: options.notes || [],
    fields: effectiveFields,
  }
}

const host = []
const integration = []

const loadedFields = [
  eventField,
  field('token', 'string (JWT)', true, 'Short-lived integration JWT. Keep only in memory.', { sensitive: true }),
  field('backendUrl', 'string (URL)', false, 'FieldTwin backend base URL. It can be absent on settings-only surfaces.'),
  field('APIVersion', 'string', false, 'API version selected by the host; commonly v1.10.'),
  field('APIServerIsReady', 'boolean', false, 'Initial active API-pod readiness.'),
  field('account', 'string', false, 'Current account ID.'),
  field('project', 'string', false, 'Current project ID; absent on Account Settings.'),
  field('subProject', 'string', false, 'Qualified current subproject/branch ID.'),
  field('stream', 'string', false, 'Current subproject stream ID.'),
  field('subProjectDocument', 'string', false, 'Current subproject document ID.'),
  field('designerUrl', 'string (URL)', true, 'FieldTwin Designer URL.'),
  field('dashboardUrl', 'string (URL)', true, 'FieldTwin Dashboard URL.'),
  field('frontendUrl', 'string (URL)', true, 'FieldTwin frontend base URL.'),
  field('projectorUrl', 'string (URL)', true, 'FieldTwin coordinate projector URL.'),
  field('customTabId', 'string', false, 'Unique integration instance ID; present on normal custom-tab surfaces.'),
  field('projectAllFromUser', 'boolean', false, 'Whether the token spans the user\'s projects.'),
  field('projectWideAccess', 'boolean', false, 'Whether the integration has project-wide access.'),
  field('canEdit', 'boolean', false, 'Host UI edit hint; server authorization remains authoritative.'),
  field('selection', 'array<object>', false, 'Initial selection snapshot.'),
  field('selection[].id', 'string', true, 'Selected resource ID.'),
  field('selection[].type', 'string', true, 'Singular selection/navigation resource type.'),
  field('theme', 'string', true, 'Active FieldTwin theme name.'),
  field('cssUrl', 'string (URL)', true, 'FieldTwin global CSS URL.'),
  field('cssThemeUrl', 'string (URL)', true, 'FieldTwin active-theme CSS URL.'),
  field('cloudType', 'string', true, 'Host cloud/deployment type.'),
  field('superAdmin', 'boolean', false, 'Whether the current user is a super administrator.'),
  field('sessionId', 'string', true, 'Session ID for this integration instance.'),
  field('globalSessionId', 'string', true, 'Session ID for the host data adapter.'),
  field('userId', 'string', false, 'Current user ID when exposed by the surface.'),
  field('userMail', 'string', false, 'Current user email when exposed by the surface.', { sensitive: true }),
  field('arguments', 'object', false, 'Manifest-configured Account Settings or Project Settings arguments.'),
  field('isOperation', 'boolean', true, 'Whether the host is in Operation Mode.'),
]

host.push(message('host-to-integration', 'loaded', 'bootstrap', 'lifecycle', 'bootstrapDirect', 'Initial trusted bootstrap for iframe or pop-out integrations.', loadedFields, {
  surfaces: ['designer', 'presenter', 'dashboard', 'account-settings', 'project-settings', 'pop-out'],
  notes: ['Field availability is surface-dependent. Account Settings can legitimately omit project API context.', 'In a pop-out, the sender is window.opener; in an iframe it is window.parent. Pin event.source and event.origin.'],
}))

host.push(message('host-to-integration', 'tokenRefresh', 'token-lifecycle', 'lifecycle', 'bootstrapDirect', 'Atomically replaces the integration JWT and refreshes API context.', [
  eventField,
  field('token', 'string (JWT)', true, 'Replacement integration JWT.', { sensitive: true }),
  field('APIServerIsReady', 'boolean', true, 'Active API-pod readiness.'),
  field('APIVersion', 'string', true, 'Current API version.'),
  field('subProject', 'string', false, 'Qualified active subproject ID.'),
  field('project', 'string', false, 'Current project ID.'),
  field('account', 'string', false, 'Current account ID.'),
  field('stream', 'string', false, 'Current stream ID.'),
  field('subProjectStreamId', 'string', false, 'Compatibility alias of stream.'),
  field('subProjectDocument', 'string', false, 'Current subproject document ID.'),
  field('designerUrl', 'string (URL)', true, 'Designer URL.'),
  field('dashboardUrl', 'string (URL)', true, 'Dashboard URL.'),
  field('backendUrl', 'string (URL)', true, 'Backend base URL.'),
  field('frontendUrl', 'string (URL)', true, 'Current host page URL.'),
  field('projectorUrl', 'string (URL)', true, 'Coordinate projector URL.'),
  field('customTabId', 'string', true, 'Integration instance ID.'),
  field('projectAllFromUser', 'boolean', true, 'User-project access flag.'),
  field('projectWideAccess', 'boolean', true, 'Project-wide access flag.'),
  field('siblingAPIServerAreReady', 'object<string, boolean>', true, 'Sibling readiness by subproject ID.'),
  field('isFrameActive', 'boolean', true, 'Whether this target is active.'),
  field('isOperation', 'boolean', true, 'Whether the host is in Operation Mode.'),
], { notes: ['Replace the token in memory and construct Authorization headers at request time.'] }))

for (const [event, sibling, ready] of [
  ['apiPodIsReady', false, true],
  ['apiPodIsNotReady', false, false],
  ['siblingApiPodIsReady', true, true],
  ['siblingApiPodIsNotReady', true, false],
]) {
  host.push(message('host-to-integration', event, 'api-readiness', 'lifecycle', 'sendMessage', `Reports that ${sibling ? 'a sibling' : 'the active'} API pod is ${ready ? 'ready' : 'not ready'}.`, [
    eventField,
    field('sibling', 'boolean', true, 'Whether the status concerns a sibling pod.', { constant: sibling }),
    field('subProject', 'string', true, 'Subproject ID whose pod changed.'),
    field('APIVersion', 'string', true, 'API version of the pod.'),
    field(sibling ? 'siblingAPIServerIsReady' : 'APIServerReady', 'boolean', true, 'Readiness value.', { constant: ready }),
    field(sibling ? 'siblingApiPodIsReady' : 'ApiPodIsReady', 'boolean', false, 'Compatibility readiness field.', { constant: ready }),
  ]))
}

const selectionItemFields = [
  field('data[]', 'object', true, 'One selected resource.'),
  field('data[].id', 'string', true, 'Resource ID.'),
  field('data[].type', 'string', true, 'Singular selection/navigation type.'),
  field('data[].name', 'string', false, 'Display name.'),
  field('data[].isForeign', 'boolean', true, 'Whether the resource belongs to another subproject.'),
  field('data[].subProject', 'string', false, 'Qualified active subproject ID.'),
  field('data[].stream', 'string', false, 'Active stream ID.'),
  field('data[].subProjectDocument', 'string', false, 'Active subproject document ID.'),
  field('data[].project', 'string', false, 'Owning project ID.'),
  field('data[].resourceType', 'string', true, 'Canonical plural collection name.'),
  field('data[].tags[]', 'string', false, 'Resource or selected model-part tags.'),
  field('data[].operatorTags[]', 'string', false, 'Operator tags.'),
  field('data[].vendorAttributes', 'object', false, 'Vendor attributes.'),
  field('data[].well', 'string', false, 'Parent well ID for a well bore.'),
  field('data[].connection', 'string', false, 'Parent connection ID for a connection segment.'),
  field('data[].wellBore', 'string', false, 'Parent well-bore ID for a well-bore segment.'),
  field('data[].metaDatumId', 'string', false, 'Metadata definition ID for a metadata value.'),
  field('data[].definitionId', 'string', false, 'Definition ID for a metadata value.'),
  field('data[].ownerId', 'string', false, 'Metadata owner ID.'),
  field('data[].ownerType', 'string', false, 'Metadata owner type.'),
  field('data[].selectedPartIndices[]', 'number', false, 'Selected Roberto model-part indices.'),
]

host.push(message('host-to-integration', 'select', 'viewport-selection', 'selection', 'sendMessage', 'Reports the current non-empty viewport selection.', [
  eventField,
  field('data', 'array<object>', true, 'Selected resource records.'),
  ...selectionItemFields,
  field('id', 'string', true, 'Compatibility ID of the first selected item.'),
  field('type', 'string', true, 'Compatibility singular type of the first selected item.'),
  field('cursorPosition', 'object', false, 'Last resolved project-space cursor position.'),
  field('cursorPosition.x', 'number', false, 'Project-space X.'),
  field('cursorPosition.y', 'number', false, 'Project-space Y.'),
  field('cursorPosition.z', 'number', false, 'Project-space Z.'),
  field('cursorPosition.intersection', 'object', false, 'Host-specific intersection detail.'),
  field('senderId', 'string', false, 'Echo from an integration-initiated selection.'),
  field('customTabId', 'string', false, 'Originating integration ID for an integration-initiated selection.'),
], { correlation: 'Optional senderId and customTabId echo an integration select/selectByTag request.' }))

host.push(message('host-to-integration', 'select', 'operation-result-selection', 'operation-mode', 'sendMessage', 'Delivers a clicked Operation Search result to its target/source integration.', [
  eventField,
  field('data', 'array<object>', true, 'An array containing the result args object.'),
  field('data[]', 'object', true, 'Integration-defined result args; commonly singular type and id.'),
], { notes: ['This variant does not imply the full viewport-selection item schema.'] }))

host.push(message('host-to-integration', 'unselect', 'viewport-selection-cleared', 'selection', 'sendMessage', 'Reports that the viewport selection is empty.', [
  eventField,
  field('cursorPosition', 'object', true, 'Last resolved cursor position; it can be empty.'),
  field('cursorPosition.x', 'number', false, 'Project-space X.'),
  field('cursorPosition.y', 'number', false, 'Project-space Y.'),
  field('cursorPosition.z', 'number', false, 'Project-space Z.'),
  field('cursorPosition.intersection', 'object', false, 'Host-specific intersection detail.'),
  field('senderId', 'string', false, 'Echo from an integration-initiated selection.'),
  field('customTabId', 'string', false, 'Originating integration ID.'),
]))

const lifecycleFields = [
  eventField,
  field('type', 'string', true, 'Singular resource type.'),
  field('id', 'string', true, 'Resource ID.'),
  field('isForeign', 'boolean', true, 'Whether the resource belongs to another subproject.'),
  field('stream', 'string', false, 'Active stream ID.'),
  field('subProjectDocument', 'string', false, 'Active subproject document ID.'),
  field('subProject', 'string', false, 'Qualified active subproject ID.'),
  field('project', 'string', false, 'Active project ID.'),
  field('resourceType', 'string', true, 'Canonical plural resource collection.'),
  field('data', 'object', true, 'Resource integration-event snapshot; fields depend on resourceType and release.'),
  field('previous', 'object', false, 'Previous resource snapshot for updates.'),
  field('diff', 'object', true, 'Changed-field map.'),
]
for (const event of ['didCreate', 'didUpdate', 'didDelete', 'didCreateFromNetwork', 'didUpdateFromNetwork', 'didDeleteFromNetwork']) {
  host.push(message('host-to-integration', event, event.endsWith('FromNetwork') ? 'network-change' : 'local-change', 'resource-lifecycle', 'sendMessage', 'Reports a saved resource lifecycle change.', lifecycleFields, {
    notes: ['The nested data/previous/diff resource fields are resource-specific. Query the backend API attribute catalog for released resource fields.'],
  }))
}

host.push(message('host-to-integration', 'didClone', 'clone-result', 'resource-lifecycle', 'sendMessage', 'Reports a project or subproject clone and its ID mapping.', [
  eventField,
  field('type', 'string', true, 'Cloned object type: project or subProject.'),
  field('id', 'string', true, 'New object ID.'),
  field('data', 'object', true, 'Old object JSON snapshot.'),
  field('idsMap', 'object<string, string>', true, 'Old-to-new ID mapping.'),
  field('project', 'string', true, 'New owning project ID.'),
  field('projectId', 'string', true, 'New owning project ID.'),
  field('projectName', 'string', true, 'New owning project name.'),
  field('subProjectId', 'string', false, 'New subproject ID for a subproject clone.'),
  field('fromSubProjectId', 'string', true, 'Source subproject ID.'),
  field('fromSubProjectName', 'string', true, 'Source subproject name.'),
  field('fromProjectId', 'string', true, 'Source project ID.'),
  field('fromProjectName', 'string', true, 'Source project name.'),
  field('fromAccountId', 'string', true, 'Source account ID.'),
  field('toSubProjectId', 'string', false, 'Destination subproject ID.'),
  field('toSubProjectName', 'string', false, 'Destination subproject name.'),
  field('toProjectId', 'string', true, 'Destination project ID.'),
  field('toProjectName', 'string', true, 'Destination project name.'),
  field('toAccountId', 'string', true, 'Destination account ID.'),
  field('toAcountId', 'string', true, 'Legacy misspelled compatibility alias for toAccountId.', { deprecated: true }),
  field('subProjects[]', 'object', false, 'Project-clone subproject mapping records.'),
  field('subProjects[].fromSubProjectId', 'string', true, 'Source qualified subproject ID.'),
  field('subProjects[].fromSubProjectName', 'string', false, 'Source subproject name.'),
  field('subProjects[].toSubProjectId', 'string', true, 'Destination qualified subproject ID.'),
  field('subProjects[].toSubProjectName', 'string', false, 'Destination subproject name.'),
]))

host.push(message('host-to-integration', 'didDrag', 'viewport-drag', 'resource-lifecycle', 'sendMessage', 'Reports resources while or after the user drags them.', [
  eventField,
  field('resources', 'array<object>', true, 'Integration-event snapshots for transformed resources.'),
  field('resources[]', 'object', true, 'Resource-specific integration-event data.'),
]))

host.push(message('host-to-integration', 'requestInfo', 'document-count-request', 'information', 'sendMessage', 'Requests integration document-count information for up to 100 resources.', [
  eventField,
  field('data', 'object', true, 'Request container.'),
  field('data.items', 'array<object>', true, 'Resources to describe; maximum 100.'),
  field('data.items[].id', 'string', true, 'Resource ID.'),
  field('data.items[].type', 'string', true, 'Canonical plural resource collection.'),
], { reply: { event: 'replyInfo', kind: 'uncorrelated command' } }))

host.push(message('host-to-integration', 'requestTagsInfos', 'document-tag-style-request', 'information', 'sendMessage', 'Requests visual styles for tags extracted from an opened document.', [
  eventField,
  field('data.documentUrl', 'string (URL)', true, 'Opened document URL.'),
  field('data.tags', 'array<object>', true, 'Extracted document tags.'),
  field('data.tags[].text', 'string', true, 'Tag text.'),
  field('data.tags[].source', 'string', true, 'Extraction source.'),
  field('data.tags[].confidence', 'number', false, 'Extraction confidence.'),
  field('data.subProject', 'string', false, 'Qualified active subproject ID.'),
  field('data.project', 'string', false, 'Active project ID.'),
  field('data.stream', 'string', false, 'Active stream ID.'),
  field('data.subProjectDocument', 'string', false, 'Active subproject document ID.'),
  field('data.requestId', 'string', true, 'Correlation ID to echo in updateTagStyles.'),
], { correlation: 'data.requestId', reply: { event: 'updateTagStyles', kind: 'command with echoed requestId' } }))

const operationHostMessages = [
  ['operationSearch', 'search-query', 'broadcast', [field('query', 'string', true, 'Submitted query; empty when cleared.'), field('clear', 'boolean', true, 'Whether integrations must clear their result/progress state.')]],
  ['operationSearchAction', 'inline-action', 'targeted', [field('integrationId', 'string', true, 'Integration that supplied the result.'), field('resultId', 'string|null', true, 'Stable result ID.'), field('actionId', 'string', true, 'Stable inline action ID.'), field('action', 'string', true, 'Integration-defined action name.'), field('args', 'object', true, 'Structured-cloneable action arguments.')]],
  ['operationSearchDoubleClick', 'double-click', 'targeted', [field('integrationId', 'string', true, 'Integration that supplied the result.'), field('resultId', 'string|null', true, 'Stable result ID.'), field('action', 'string', false, 'Declared double-click action.'), field('args', 'object', true, 'Declared double-click args or fallback row args.')]],
  ['visualFilterToggle', 'filter-toggle', 'targeted', [field('data.id', 'string', true, 'Parent filter ID.'), field('data.state', 'boolean', true, 'Requested state.'), field('data.subFilterId', 'string|null', false, 'Subfilter ID; omitted/null for a parent toggle.')]],
  ['contextMenuAction', 'context-menu-action', 'targeted', [field('integrationId', 'string', true, 'Integration that supplied the entry.'), field('action', 'string', false, 'Integration-defined action.'), field('args', 'object', false, 'Integration-defined arguments.'), field('cursorPosition', 'object', false, 'Resolved cursor location.'), field('cursorPosition.x', 'number', true, 'Project-space X.'), field('cursorPosition.y', 'number', true, 'Project-space Y.'), field('cursorPosition.z', 'number', true, 'Project-space Z.'), field('cursorPosition.latitude', 'number', false, 'WGS84 latitude when reprojection succeeds.'), field('cursorPosition.longitude', 'number', false, 'WGS84 longitude when reprojection succeeds.')]],
  ['operationPaneClosed', 'panel-closed', 'targeted', [field('customTabId', 'string', true, 'Closed integration panel ID.')]],
  ['getTimeSeriesData', 'window-request', 'targeted', [field('data.seriesId', 'string', true, 'Integration-local series ID.'), field('data.reqId', 'string', true, 'Opaque request ID to echo exactly.'), field('data.xMin', 'number', true, 'Requested lower X bound.'), field('data.xMax', 'number', true, 'Requested upper X bound.'), field('data.sampleCount', 'number', true, 'Requested sample count.')]],
  ['timeSeriesMarkerClick', 'marker-click', 'targeted', [field('data.id', 'string', true, 'Marker ID.'), field('data.timestamp', 'number', true, 'Marker timestamp.')]],
]
for (const [event, variant, targeting, fields] of operationHostMessages) {
  host.push(message('host-to-integration', event, variant, 'operation-mode', 'sendMessage', `Operation Mode ${variant.replaceAll('-', ' ')} message.`, [eventField, ...fields], {
    correlation: event === 'getTimeSeriesData' ? 'data.reqId' : 'none',
    notes: [targeting === 'targeted' ? 'The host targets only the contributing integration instance.' : 'The host broadcasts this message to loaded integration instances.'],
  }))
}

host.push(message('host-to-integration', 'action', 'modal-footer-action', 'modal', 'sendMessage', 'Reports that the user activated an integration-defined modal footer action.', [
  eventField,
  field('data', 'object', true, 'The action descriptor previously supplied through setupActions.'),
  field('data.id', 'string', false, 'Integration-defined action ID.'),
  field('data.label', 'string', false, 'Action label.'),
  field('data.icon', 'string', false, 'Supported modal icon name: cancel, import, or export.'),
  field('data.align', 'string', false, 'Footer alignment: left or right.'),
], { surfaces: ['modal'] }))

function addHostReply(event, variant, summary, fields, options = {}) {
  host.push(message('host-to-integration', event, variant, options.category || 'reply', 'directReply', summary, [eventField, ...fields], {
    correlation: options.correlation || 'responseToEvent only',
    surfaces: options.surfaces,
    notes: options.notes,
  }))
}

addHostReply('viewBox', 'getViewBox-reply', 'Returns the current camera view box.', [field('data.viewBox', 'object', true, 'Camera-derived view box.')])
addHostReply('resourcesByTags', 'getResourcesByTags-reply', 'Returns resource IDs grouped by requested tag.', [field('data.results', 'object<string, array<object>>', true, 'Matches keyed by requested tag.'), field('data.results.*[].resourceType', 'string', true, 'Canonical plural collection.'), field('data.results.*[].resourceId', 'string', true, 'Matched resource ID.'), field('data.queryId', 'string', false, 'Echoed query ID.'), field('data.error', 'string', false, 'Validation error.')], { correlation: 'data.queryId' })
addHostReply('resourceAttributesBulk', 'getResourceAttributesBulk-reply', 'Returns selected attributes keyed by resource ID.', [field('data.results', 'object<string, object>', true, 'Results keyed by resource ID.'), field('data.results.*.resourceType', 'string', true, 'Canonical plural collection.'), field('data.results.*.*', 'unknown|null', false, 'Each requested attribute value.'), field('data.queryId', 'string', false, 'Echoed query ID.')], { correlation: 'data.queryId' })
addHostReply('projectData', 'getProjectData-reply', 'Returns active project context and selected project resource summaries.', [field('data.project', 'object', true, 'Project summary.'), field('data.project.subProjectTags[]', 'string', true, 'All active subproject tags.'), field('data.project.subProjectName', 'string', false, 'Subproject name.'), field('data.project.developmentLocation', 'string', false, 'Project country.'), field('data.project.toSeabed', 'number', false, 'Absolute seabed level.'), field('data.project.CRS', 'string', false, 'Project coordinate reference system.'), field('data.connections[]', 'object', false, 'Connection summaries from related layouts.'), field('data.connectionSegments[]', 'object', false, 'Connection-segment summaries.'), field('data.customCosts[]', 'object', false, 'Custom-cost summaries.'), field('data.layers[]', 'object', false, 'Layer summaries.'), field('data.shapes[]', 'object', false, 'Shape summaries.'), field('data.stagedAssets[]', 'object', false, 'Staged-asset summaries.'), field('data.wells[]', 'object', false, 'Well summaries.'), field('data.wellBores[]', 'object', false, 'Well-bore summaries.'), field('data.wellBoreSegments[]', 'object', false, 'Well-bore-segment summaries.'), field('data.*[].id', 'string', true, 'Resource ID.'), field('data.*[].name', 'string', true, 'Resource display name.'), field('data.*[].tags[]', 'string', false, 'Resource tags.'), field('data.*[].metaData', 'object', true, 'Metadata snapshot.'), field('data.*[].type', 'string', false, 'Asset kind where applicable.'), field('data.*[].connectionId', 'string', false, 'Parent connection ID.'), field('data.*[].wellId', 'string', false, 'Parent well ID.'), field('data.*[].wellBoreId', 'string', false, 'Parent well-bore ID.'), field('data.*[].length', 'number', false, 'Computed resource length.')])
addHostReply('costQuery', 'getCostQuery-reply', 'Returns the current cost-query tree.', [field('data.query', 'object|array', true, 'Cost query.'), field('data.queryId', 'string', false, 'Echoed query ID.')], { correlation: 'data.queryId' })
addHostReply('resources', 'getResources-reply', 'Returns resolved resources in request order, omitting misses.', [field('data.resources', 'array<object>', true, 'Released resource snapshots.'), field('data.resources[].metaData', 'object', true, 'Metadata snapshot.'), field('data.resources[].tags[]', 'string', false, 'Tags.'), field('data.resources[].length', 'number', false, 'Computed length.'), field('data.resources[].connectionType', 'string', false, 'Calculated connection type.'), field('data.queryId', 'string', false, 'Echoed query ID.')], { correlation: 'data.queryId', notes: ['Resource-specific fields come from copyAttributes(); query the backend API attribute catalog for released schemas.'] })
addHostReply('visibleResources', 'getVisibleResources-reply', 'Returns the current in-viewport selection-shaped resources.', [field('data.resources', 'array<object>', true, 'Selection-shaped visible resources.'), ...selectionItemFields.map((item) => ({ ...item, path: item.path.replace(/^data\[\]/, 'data.resources[]') })), field('data.queryId', 'string', false, 'Echoed query ID.')], { correlation: 'data.queryId' })
addHostReply('tagsAnnotationUpdated', 'updateTagsAnnotation-reply', 'Reports annotation update completion or supersession.', [field('data.success', 'boolean', true, 'Whether the request was accepted.'), field('data.queryId', 'string', false, 'Echoed query ID.'), field('data.annotatedTags[]', 'string', true, 'Tags/resource IDs annotated before completion.'), field('data.superseded', 'boolean', false, 'Whether a newer request superseded this run.'), field('data.error', 'string', false, 'Validation or processing error.')], { correlation: 'data.queryId' })
addHostReply('tagsAnnotationCleared', 'clearTagsAnnotation-reply', 'Reports annotation clear completion.', [field('data.success', 'boolean', true, 'Whether the clear succeeded.'), field('data.queryId', 'string', false, 'Echoed query ID.'), field('data.clearedTags[]', 'string', true, 'Cleared tags.')], { correlation: 'data.queryId' })
addHostReply('exportToGeoJSON', 'exportToGeoJSON-reply', 'Returns exported GeoJSON when queryId was supplied.', [field('data.GeoJSON', 'object|string', true, 'GeoJSON export result.'), field('data.queryId', 'string', true, 'Echoed query ID.')], { correlation: 'data.queryId' })
addHostReply('userSettings', 'settings-reply', 'Returns merged persisted integration user settings.', [field('data.settings', 'object', true, 'Complete persisted settings object.')])
addHostReply('displayDocument', 'displayDocument-reply', 'Reports whether the host opened a document.', [field('success', 'boolean', true, 'Whether the document was opened.'), field('error', 'string|null', true, 'Failure reason, or null on success.')])
addHostReply('createChart', 'createChart-reply', 'Reports chart creation/update.', [field('success', 'boolean', true, 'Whether the chart operation succeeded.'), field('chartId', 'string', false, 'Created or updated chart ID.'), field('updated', 'boolean', false, 'Whether an existing chart was updated.'), field('error', 'string', false, 'Failure reason.')])
addHostReply('deleteChart', 'deleteChart-reply', 'Reports chart deletion.', [field('success', 'boolean', true, 'Whether deletion succeeded.'), field('chartId', 'string', false, 'Deleted chart ID.'), field('error', 'string', false, 'Failure reason.')])
addHostReply('updateTagStyles', 'updateTagStyles-reply', 'Acknowledges document/model tag-style updates.', [field('success', 'boolean', true, 'Whether styles were applied.'), field('requestId', 'string', false, 'Echoed requestTagsInfos correlation ID.'), field('ignored', 'number', false, 'Rules dropped because their category was missing, invalid, or user-disabled.'), field('error', 'string', false, 'Failure reason.')], { correlation: 'requestId and responseToEvent' })
for (const event of ['timeSeriesInfo', 'timeSeriesData', 'timeSeriesMarkers', 'displayTimeSeries']) {
  addHostReply(event, `${event}-ack`, `Acknowledges ${event}.`, [field('success', 'boolean', true, 'Acknowledgement status.')], { category: 'operation-mode' })
}

const request = (event, variant, category, summary, fields, options = {}) => integration.push(message('integration-to-host', event, variant, category, 'integrationSend', summary, [eventField, ...fields], options))

request('zoomAt', 'camera-point', 'selection', 'Moves the camera to a project-space point.', [field('data.x', 'number', true, 'Project-space X.'), field('data.y', 'number', true, 'Project-space Y.'), field('data.z', 'number', false, 'Positive height offset; defaults to 100.')])
request('zoomOn', 'camera-resource', 'selection', 'Focuses one resource.', [field('data.type', 'string', true, 'Singular selection/navigation type.'), field('data.id', 'string', true, 'Resource ID.'), field('data.distance', 'number', false, 'Positive camera distance.')])
request('select', 'select-resources', 'selection', 'Selects one or more resources.', [field('data.id', 'string', false, 'Single-resource shorthand ID.'), field('data.type', 'string', false, 'Single-resource shorthand singular type.'), field('data.items', 'array<object>', false, 'Resources to select.'), field('data.items[].id', 'string', true, 'Resource ID.'), field('data.items[].type', 'string', true, 'Singular selection type.'), field('data.items[].partIndex', 'number', false, 'Single staged-asset model-part index.'), field('data.items[].selectedPartIndices[]', 'number', false, 'Staged-asset model-part indices.'), field('data.focusSelection', 'boolean', false, 'Whether to focus; defaults to true.'), field('data.senderId', 'string', false, 'Opaque selection correlation value echoed later.')], { correlation: 'Optional data.senderId is echoed by a later select/unselect.', reply: { event: 'select or unselect', kind: 'asynchronous notification' } })
request('selectByTag', 'select-tags', 'selection', 'Selects resources/model parts matching tags.', [field('data.tags[]', 'string', true, 'Non-empty tag list.'), field('data.resourceTypes[]', 'string', false, 'Canonical plural collections to search.'), field('data.matchAll', 'boolean', false, 'true requires all tags; false accepts any. Set explicitly.'), field('data.focusSelection', 'boolean', false, 'Whether to focus matches.'), field('data.senderId', 'string', false, 'Opaque selection correlation value.')], { correlation: 'Optional data.senderId is echoed by a later select/unselect.', reply: { event: 'select or unselect', kind: 'asynchronous notification' } })
request('clearSelection', 'clear-selection', 'selection', 'Clears the viewport selection.', [], { reply: { event: 'unselect', kind: 'asynchronous notification' } })

request('getResourcesByTags', 'tag-query', 'query', 'Finds resource IDs grouped by tag.', [field('data.tags[]', 'string', true, 'Non-empty tags to search.'), field('data.resourceTypes[]', 'string', false, 'Canonical plural collections; all when omitted.'), field('data.queryId', 'string', false, 'Opaque correlation ID.')], { correlation: 'data.queryId', reply: { event: 'resourcesByTags', kind: 'direct reply' } })
request('getResourceAttributesBulk', 'attribute-query', 'query', 'Reads named attributes for resources in bulk.', [field('data.attributes[]', 'string', false, 'Attribute names to include.'), field('data.resourceTypes[]', 'string', false, 'Canonical plural collections; all when omitted.'), field('data.queryId', 'string', false, 'Opaque correlation ID.')], { correlation: 'data.queryId', reply: { event: 'resourceAttributesBulk', kind: 'direct reply' } })
request('getProjectData', 'project-query', 'query', 'Reads active project context and resource summaries.', [], { reply: { event: 'projectData', kind: 'direct reply' } })
request('getCostQuery', 'cost-query', 'query', 'Reads the current cost query.', [field('data.queryId', 'string', false, 'Opaque correlation ID.'), field('data.removeEmptyItem', 'boolean', false, 'Whether empty cost items are omitted.')], { correlation: 'data.queryId', reply: { event: 'costQuery', kind: 'direct reply' } })
request('computeCostUsingServer', 'compute-cost', 'query', 'Starts server-side cost computation.', [], { reply: null })
request('getViewBox', 'view-box-query', 'query', 'Reads the current camera view box.', [], { reply: { event: 'viewBox', kind: 'direct reply' } })
request('getResources', 'resource-query', 'query', 'Reads specific resources by ID and collection.', [field('data.items', 'array<object>', true, 'Resources to resolve.'), field('data.items[].id', 'string', true, 'Short or supported qualified resource ID.'), field('data.items[].resourceType', 'string', false, 'Preferred canonical plural collection.'), field('data.items[].type', 'string', false, 'Compatibility alias for resourceType.'), field('data.queryId', 'string', false, 'Opaque correlation ID.'), field('data.fromViewPorts', 'boolean', false, 'Legacy accepted field; currently has no effect.')], { correlation: 'data.queryId', reply: { event: 'resources', kind: 'direct reply' } })
request('getVisibleResources', 'visible-query', 'query', 'Reads resources currently visible in viewports.', [field('data.queryId', 'string', false, 'Opaque correlation ID.')], { correlation: 'data.queryId', reply: { event: 'visibleResources', kind: 'direct reply' }, notes: ['Send data as an object even when queryId is omitted.'] })

const mutationCommon = [field('resourceType', 'string', true, 'Canonical plural collection.'), field('resourceId', 'string', false, 'Existing resource ID for update/delete.'), field('attributes', 'object', false, 'Create/update attributes; use the API catalog for resource-specific writable fields.'), field('volatile', 'boolean', false, 'Create a client-local volatile resource.'), field('draggable', 'boolean', false, 'Mark a created volatile resource draggable.'), field('projectTreeViewCustomPath[]', 'string', false, 'Custom project-tree path.')]
for (const event of ['createResource', 'updateResource', 'deleteResource']) {
  request(event, 'single-mutation', 'mutation', `${event.replace(/([A-Z])/g, ' $1').toLowerCase()} through the host.`, mutationCommon.map((item) => ({ ...item, path: `data.${item.path}` })), { reply: { event: event.replace('Resource', '').replace('create', 'didCreate').replace('update', 'didUpdate').replace('delete', 'didDelete'), kind: 'asynchronous lifecycle event per changed resource' } })
}
for (const event of ['createResources', 'updateResources', 'deleteResources']) {
  request(event, 'bulk-mutation', 'mutation', `${event.replace(/([A-Z])/g, ' $1').toLowerCase()} through the host.`, [field('data', 'array<object>', true, 'Resource mutation descriptors.'), ...mutationCommon.map((item) => ({ ...item, path: `data[].${item.path}` }))], { reply: { event: event.startsWith('create') ? 'didCreate' : event.startsWith('update') ? 'didUpdate' : 'didDelete', kind: 'asynchronous lifecycle event per changed resource' } })
}

request('replyInfo', 'document-count-reply', 'information', 'Reports per-resource document counts and integration tags.', [field('data.items[]', 'object', false, 'Document-count records.'), field('data.items[].type', 'string', true, 'Singular resource type.'), field('data.items[].id', 'string', true, 'Resource ID.'), field('data.items[].documentCount', 'number', true, 'Finite document count; invalid values become zero.'), field('data.tags[]', 'string', false, 'Integration-provided transient tags.')], { notes: ['The host derives integration identity from the registered source window.'] })
request('updateTagsAnnotation', 'annotation-update', 'annotation', 'Creates/replaces volatile annotations by tag or resource ID.', [field('data.annotations', 'object<string, array<object>>', true, 'Annotation definitions keyed by tag or resource ID.'), field('data.annotations.*[].count', 'number', false, 'Count to display.'), field('data.annotations.*[].icon', 'string', false, 'Font Awesome icon name.'), field('data.annotations.*[].text', 'string', false, 'Text to display.'), field('data.annotations.*[].color', 'string', false, 'Annotation color.'), field('data.annotations.*[].x', 'number', false, 'Project-space X.'), field('data.annotations.*[].y', 'number', false, 'Project-space Y.'), field('data.annotations.*[].z', 'number', false, 'Project-space Z.'), field('data.annotations.*[].outlineOverride', 'boolean', false, 'Whether annotation outline behavior is overridden.'), field('data.annotations.*[].vendorAttributes', 'object', false, 'Integration data attached to the annotation.'), field('data.annotations.*[].tags[]', 'string', false, 'Explicit annotation tags.'), field('data.groupByTag', 'boolean', false, 'Create a group for each tag.'), field('data.byResourceId', 'boolean', false, 'Interpret annotations keys as resource IDs.'), field('data.types', 'object<string, string>', false, 'Resource-ID-to-canonical-plural-type map in resource-ID mode.'), field('data.queryId', 'string', false, 'Opaque correlation ID.')], { correlation: 'data.queryId', reply: { event: 'tagsAnnotationUpdated', kind: 'direct reply' } })
request('clearTagsAnnotation', 'annotation-clear', 'annotation', 'Clears integration-created volatile annotations.', [field('data.tags[]', 'string', false, 'Tags to clear; omission clears all for this integration.'), field('data.queryId', 'string', false, 'Opaque correlation ID.')], { correlation: 'data.queryId', reply: { event: 'tagsAnnotationCleared', kind: 'direct reply' } })

request('toast', 'notification', 'ui', 'Displays a host notification.', [field('data.message', 'string', true, 'Notification text.'), field('data.type', 'string', false, 'info, success, warning, error, or legacy danger.', { allowedValues: ['info', 'success', 'warning', 'error', 'danger'] })], { surfaces: ['designer', 'presenter', 'dashboard', 'account-settings', 'pop-out'] })
request('exportToGLTF', 'gltf-export', 'export', 'Exports selected project resources as GLTF/GLB.', [field('data.queryId', 'string', false, 'Accepted legacy field; Blob replies are not JSON-correlated.'), field('data.centerAroundZero', 'boolean', false, 'Center export around zero; defaults true.'), field('data.types[]', 'string', false, 'Subset of wells, wellBores, connections, stagedAssets, shapes, layers.'), field('data.fileName', 'string', false, 'Filename template supporting %project% and %subProject%.'), field('data.resourceIds[]', 'string', false, 'Resource ID filter.'), field('data.mergeParentProjects', 'boolean', false, 'false restricts to the active subproject.'), field('data.excludeFutureOnLogo', 'boolean', false, 'Exclude FutureOn logo.'), field('data.excludeInfiniteSeabed', 'boolean', false, 'Exclude infinite seabed.'), field('data.excludeWater', 'boolean', false, 'Exclude water.'), field('data.exportBinary', 'boolean', false, 'Export binary GLB when true.')], { reply: { event: null, kind: 'Blob direct reply' }, notes: ['Blob replies do not carry event, queryId, responseToEvent, or reply decorators.'] })
request('exportToGeoJSON', 'geojson-export', 'export', 'Exports selected project resources as GeoJSON.', [field('data.queryId', 'string', true, 'Required to receive the JSON reply.'), field('data.mergeParentProjects', 'boolean', false, 'false restricts to active subproject.'), field('data.types[]', 'string', false, 'Subset of supported export collections.'), field('data.resourceIds[]', 'string', false, 'Resource ID filter.'), field('data.disableConvertion', 'boolean', false, 'Legacy spelling: disable coordinate conversion.'), field('data.exportMetaData', 'boolean', false, 'Include metadata; defaults true.'), field('data.onlyPublicMetaData', 'boolean', false, 'Restrict metadata to public definitions.'), field('data.onlyStdMetaData', 'boolean', false, 'Restrict metadata to standard definitions.'), field('data.filterMetaDataByTags[]', 'string', false, 'Metadata tag filter.'), field('data.simplify', 'boolean', false, 'Simplify exported geometry.'), field('data.simplifyTolerance', 'number', false, 'Geometry simplification tolerance.'), field('data.exportLayerAsContour', 'boolean', false, 'Export layers as contours.'), field('data.contourNumberOfPlanes', 'number', false, 'Contour plane count; defaults 10.')], { correlation: 'data.queryId', reply: { event: 'exportToGeoJSON', kind: 'direct reply' } })
request('getUserSettings', 'settings-read', 'settings', 'Reads persisted integration user settings.', [], { reply: { event: 'userSettings', kind: 'direct reply' } })
request('setUserSettings', 'settings-write', 'settings', 'Merges and persists integration user settings.', [field('data.settings', 'object', true, 'Settings patch to merge.')], { reply: { event: 'userSettings', kind: 'direct reply' } })
request('displayDocument', 'open-document', 'ui', 'Opens a URL in a FieldTwin file viewer.', [field('data.url', 'string (URL)', true, 'Document URL.'), field('data.fileType', 'string', false, 'File-type hint.'), field('data.mimeType', 'string', false, 'MIME-type hint.'), field('data.fileName', 'string', false, 'File Viewer tab-label override; it does not determine the viewer type.'), field('data.tabId', 'string', false, 'Specific file-viewer tab ID.')], { reply: { event: 'displayDocument', kind: 'direct reply' } })
request('createChart', 'chart-create-update', 'ui', 'Creates or updates a Chart.js billboard.', [field('data.title', 'string', false, 'Chart title.'), field('data.type', 'string', false, 'Chart.js type; defaults line.'), field('data.labels[]', 'unknown', true, 'X-axis labels.'), field('data.datasets[]', 'object', true, 'Chart.js dataset descriptors.'), field('data.xAxisLabel', 'string', false, 'X-axis title.'), field('data.yAxisLabel', 'string', false, 'Y-axis title.'), field('data.position.x', 'number', false, 'World X; defaults zero.'), field('data.position.y', 'number', false, 'World Y; defaults zero.'), field('data.position.z', 'number', false, 'World Z; defaults zero.'), field('data.width', 'number', false, 'Billboard width; defaults 2.'), field('data.height', 'number', false, 'Billboard height; defaults 1.5.'), field('data.id', 'string', false, 'Stable ID; updates existing chart when found.')], { reply: { event: 'createChart', kind: 'direct reply' } })
request('deleteChart', 'chart-delete', 'ui', 'Deletes an integration chart billboard.', [field('data.id', 'string', true, 'Chart ID.')], { reply: { event: 'deleteChart', kind: 'direct reply' } })
request('updateTagStyles', 'tag-style-update', 'ui', 'Applies styles to document tags or model-part tags.', [field('data.tagStyles', 'array<object>', true, 'Tag style rules.'), field('data.tagStyles[].pattern', 'string', false, 'Tag matching pattern.'), field('data.tagStyles[].category', 'string', true, 'User-toggleable style category (1-64 characters after trimming). A rule without one is ignored.'), field('data.tagStyles[].style', 'object', false, 'CSS-like style declaration.'), ...['color', 'backgroundColor', 'backgroundImage', 'backgroundRepeat', 'backgroundPosition', 'backgroundSize', 'border', 'borderRadius', 'fontWeight', 'fontStyle', 'fontSize', 'textDecoration', 'padding', 'margin'].map((name) => field(`data.tagStyles[].style.${name}`, 'string', false, `${name} style value.`)), field('data.tagStyles[].style.opacity', 'string|number', false, 'Opacity style value.'), field('data.requestId', 'string', false, 'Echoed requestTagsInfos request ID.')], { correlation: 'data.requestId', reply: { event: 'updateTagStyles', kind: 'direct reply' }, notes: ['Every rule must declare data.tagStyles[].category. Users enable or disable whole categories from the Operation toolbar, and rules with a missing, blank, non-string, or over-long category are dropped.', 'The updateTagStyles reply carries an ignored count of the rules dropped because their category was missing or user-disabled.'] })

const resultFields = [field('data.results', 'array<object>', true, 'Replacement result tree for the sending integration.'), field('data.results[].id', 'string', false, 'Stable result ID; required for interactive results.'), field('data.results[].category', 'string', false, 'Category when tags is absent.'), field('data.results[].tags[]', 'string', false, 'Group names.'), field('data.results[].html', 'string', false, 'Sanitized display markup; escape untrusted values before sending.'), field('data.results[].icon', 'string', false, 'Child-row decoration: file, cube, cloud, or circle.'), field('data.results[].action', 'string', false, 'Legacy row action; select links to graph selection.'), field('data.results[].args', 'object', false, 'Row action and fallback double-click args.'), field('data.results[].actions', 'array<object>', false, 'Inline action descriptors.'), field('data.results[].actions[].id', 'string', true, 'Stable inline action ID.'), field('data.results[].actions[].label', 'string', true, 'Plain-text accessible label.'), field('data.results[].actions[].icon', 'string', true, 'Font Awesome icon name.'), field('data.results[].actions[].action', 'string', true, 'Integration-defined action name.'), field('data.results[].actions[].args', 'object', false, 'Action arguments.'), field('data.results[].doubleClickAction.action', 'string', true, 'Double-click action name.'), field('data.results[].doubleClickAction.args', 'object', false, 'Double-click args.'), field('data.results[].target', 'string', false, 'core for a legacy host action; otherwise integration-owned.'), field('data.results[].noPanel', 'boolean', false, 'Do not open/focus a panel on ordinary click.'), field('data.results[].dynamicPath', 'string', false, 'One dynamic page path.'), field('data.results[].dynamicPagePath', 'string', false, 'Compatibility alias for dynamicPath.'), field('data.results[].dynamicPaths[]', 'string', false, 'Several dynamic page paths.'), field('data.results[].subItems[]', 'object', false, 'Nested rows with the same recursive shape; maximum depth 8 and 5000 total nodes.')]
request('operationSearchResults', 'search-results', 'operation-mode', 'Replaces this integration\'s Operation Search result tree.', resultFields)
request('operationSearchProgress', 'search-progress', 'operation-mode', 'Publishes or completes Operation Search progress.', [field('data.name', 'string', false, 'Integration/source display name.'), field('data.status', 'string', true, 'Status text.'), field('data.progress', 'number', false, 'Progress percentage, conventionally 0-100.'), field('data.isComplete', 'boolean', false, 'true clears this integration\'s progress.')])
request('visualFilteringUpdate', 'filter-registration', 'operation-mode', 'Registers/replaces integration-owned visual filters.', [field('data.filters', 'array<object>', true, 'Filter descriptors.'), field('data.filters[].id', 'string', true, 'Stable filter ID.'), field('data.filters[].label', 'string', true, 'Filter label.'), field('data.filters[].state', 'boolean', false, 'Current parent state.'), field('data.filters[].subFilters[]', 'object', false, 'Subfilters.'), field('data.filters[].subFilters[].id', 'string', true, 'Stable subfilter ID.'), field('data.filters[].subFilters[].label', 'string', true, 'Subfilter label.'), field('data.filters[].subFilters[].state', 'boolean', false, 'Current subfilter state.')])
request('visualLegendUpdate', 'legend-registration', 'operation-mode', 'Registers/replaces or clears an integration-owned visual legend.', [field('data.title', 'string', false, 'Legend title.'), field('data.position', 'string', false, 'top-left, top-right, bottom-left, or bottom-right.', { allowedValues: ['top-left', 'top-right', 'bottom-left', 'bottom-right'] }), field('data.items[]', 'object', false, 'Legend items; empty clears the legend.'), field('data.items[].id', 'string', false, 'Stable item ID; label/index fallback is used.'), field('data.items[].label', 'string', true, 'Legend label.'), field('data.items[].color', 'string', false, 'CSS color; defaults white.'), field('data.visible', 'boolean', false, 'false clears the legend.')])
request('contextMenuUpdate', 'menu-registration', 'operation-mode', 'Registers/replaces viewport context-menu entries.', [field('data.entries', 'array<object>', true, 'Top-level menu entries.'), field('data.entries[].id', 'string', false, 'Stable entry ID.'), field('data.entries[].label', 'string', true, 'Entry label.'), field('data.entries[].tooltip', 'string', false, 'Tooltip.'), field('data.entries[].icon', 'string', false, 'Font Awesome icon name.'), field('data.entries[].action', 'string', false, 'Integration-defined action.'), field('data.entries[].args', 'object', false, 'Action arguments.'), field('data.entries[].subItems[]', 'object', false, 'Nested entries with the same recursive shape.')])
request('openOperationPanel', 'panel-open', 'operation-mode', 'Opens/focuses a standard or dynamic Operation Mode integration panel.', [field('data.integrationId', 'string', false, 'Target integration; defaults to the trusted sender.'), field('data.path', 'string', false, 'Dynamic-page path.')])
request('timeSeriesInfo', 'series-registration', 'operation-mode', 'Registers time-series metadata.', [field('data.replaceExisting', 'boolean', false, 'Clear this integration\'s previous series first.'), field('data.series', 'array<object>', true, 'Series metadata.'), field('data.series[].id', 'string', true, 'Integration-local series ID.'), field('data.series[].name', 'string', true, 'Series display name.'), field('data.series[].unit', 'string', true, 'Y-value unit.'), field('data.series[].xAxisTitle', 'string', true, 'X-axis title.'), field('data.series[].yAxisTitle', 'string', true, 'Y-axis title.'), field('data.series[].xMin', 'number', true, 'Full lower X bound.'), field('data.series[].xMax', 'number', true, 'Full upper X bound.'), field('data.series[].sampleCount', 'number', true, 'Full-resolution sample count.'), field('data.series[].color', 'string', false, 'CSS color; host palette fallback.')], { reply: { event: 'timeSeriesInfo', kind: 'direct acknowledgement' } })
request('timeSeriesData', 'series-window-reply', 'operation-mode', 'Returns requested binary time-series samples.', [field('data.reqId', 'string', true, 'Exact getTimeSeriesData request ID.'), field('data.buffer', 'ArrayBuffer', true, 'Transferred Float64 sample buffer.'), field('data.stride', 'number', false, '2 for [x,y], 4 for [x,mean,min,max]; default 2.', { allowedValues: [2, 4] })], { correlation: 'data.reqId', reply: { event: 'timeSeriesData', kind: 'direct acknowledgement' }, notes: ['Transfer the ArrayBuffer; the integration-side buffer becomes detached.'] })
request('timeSeriesMarkers', 'marker-registration', 'operation-mode', 'Replaces this integration\'s time-series markers.', [field('data.markers', 'array<object>', true, 'Markers; empty clears them.'), field('data.markers[].id', 'string', true, 'Stable marker ID.'), field('data.markers[].timestamp', 'number', true, 'Marker X/timestamp.'), field('data.markers[].description', 'string', true, 'Marker description.'), field('data.markers[].color', 'string', false, 'CSS marker color.')], { reply: { event: 'timeSeriesMarkers', kind: 'direct acknowledgement' } })
request('displayTimeSeries', 'panel-display', 'operation-mode', 'Opens the Operation Mode time-series panel.', [], { reply: { event: 'displayTimeSeries', kind: 'direct acknowledgement' } })

request('setupTitle', 'modal-title', 'modal', 'Sets an integration modal title.', [field('data.title', 'string', true, 'Modal title; sanitized by the host.')], { surfaces: ['modal'] })
request('setupActions', 'modal-actions', 'modal', 'Defines integration modal footer actions.', [field('data.actions', 'array<object>', true, 'Footer action descriptors.'), field('data.actions[].id', 'string', false, 'Action ID.'), field('data.actions[].label', 'string', false, 'Button label.'), field('data.actions[].icon', 'string', false, 'cancel, import, or export.'), field('data.actions[].align', 'string', false, 'left or right.')], { surfaces: ['modal'], reply: { event: 'action', kind: 'later targeted user action' } })
request('closeModal', 'modal-close', 'modal', 'Closes the integration modal.', [], { surfaces: ['modal'] })
request('setProjectVendorAttributes', 'project-settings-write', 'settings', 'Writes one vendor-attribute group/hash on the current project.', [field('data.group', 'string', true, 'Vendor-attribute group key.'), field('data.hash', 'unknown', true, 'Value stored for the group.')], { surfaces: ['project-settings'], notes: ['This surface-specific message does not use the main Designer dispatcher.'] })

request('automationDescriptor', 'automation-declaration', 'automation', 'Declares attributes and functions exposed to FieldTwin automations.', [field('attributes', 'array<object>', false, 'Automation attributes.'), field('attributes[].id', 'string', true, 'Stable attribute ID.'), field('attributes[].label', 'string', true, 'Editor label.'), field('attributes[].type', 'string', false, 'Declared value type.', { allowedValues: ['string', 'number', 'boolean', 'date', 'tags', 'resource', 'resources', 'object', 'any'] }), field('attributes[].readUrl', 'string (HTTPS URL)', false, 'Backend read endpoint; omission makes the attribute authoring-only.'), field('functions', 'array<object>', false, 'Automation functions.'), field('functions[].id', 'string', true, 'Stable function ID.'), field('functions[].label', 'string', true, 'Editor label.'), field('functions[].params[]', 'object', false, 'Function parameters.'), field('functions[].params[].id', 'string', true, 'Parameter ID.'), field('functions[].params[].type', 'string', true, 'Parameter value type.'), field('functions[].params[].optional', 'boolean', false, 'Whether the parameter is optional.'), field('functions[].returns', 'string|array<object>', false, 'One anonymous output type or named outputs.'), field('functions[].returns[].id', 'string', true, 'Named output ID.'), field('functions[].returns[].type', 'string', true, 'Named output value type.'), field('functions[].invokeUrl', 'string (HTTPS URL)', false, 'Backend invoke endpoint; omission makes the function authoring-only.')], { surfaces: ['automation-enabled-host'], notes: ['This released supplemental contract can be handled outside the main Designer dispatcher in some deployments.'] })
request('attributeUpdated', 'client-cache-refresh', 'automation', 'Refreshes an open client\'s cached automation attribute value.', [field('data.resourceType', 'string', true, 'Canonical plural resource collection.'), field('data.resourceId', 'string', true, 'Resource ID.'), field('data.attributeId', 'string', true, 'Declared automation attribute ID.'), field('data.value', 'unknown', true, 'New value matching the declared type.')], { surfaces: ['automation-enabled-host'], notes: ['This does not trigger an automation run; use the backend automation event webhook for that.'] })

const mainDispatchEvents = integration
  .filter((item) => !['setupTitle', 'setupActions', 'closeModal', 'setProjectVendorAttributes', 'automationDescriptor', 'attributeUpdated'].includes(item.event))
  .map((item) => item.event)

function readDispatchEvents(sourceRoot) {
  const sourcePath = path.join(sourceRoot, 'common', 'libraries', 'actions', `handle${'TabMessage'}.js`)
  const source = fs.readFileSync(sourcePath, 'utf8')
  const dispatchStart = source.indexOf('const messages = {', source.indexOf('export async function handleTabMessage'))
  const dispatchEnd = source.indexOf('\n  }', dispatchStart)
  if (dispatchStart < 0 || dispatchEnd < 0) {
    throw new Error(`Could not locate integration dispatch map in ${sourcePath}`)
  }
  const block = source.slice(dispatchStart, dispatchEnd)
  return [...block.matchAll(/^\s{4}([A-Za-z][A-Za-z0-9]*):/gm)].map((match) => match[1]).sort()
}

function parseArguments() {
  const args = process.argv.slice(2)
  const sourceIndex = args.indexOf('--source')
  return {
    sourceRoot: sourceIndex >= 0 ? path.resolve(args[sourceIndex + 1]) : null,
    check: args.includes('--check'),
  }
}

const arguments_ = parseArguments()
let sourceCoverage = null
if (arguments_.sourceRoot) {
  const dispatchEvents = readDispatchEvents(arguments_.sourceRoot)
  const documented = new Set(mainDispatchEvents)
  const missing = dispatchEvents.filter((event) => !documented.has(event))
  if (missing.length) {
    throw new Error(`Undocumented main integration-to-host events: ${missing.join(', ')}`)
  }
  sourceCoverage = {
    mainDispatchEvents: dispatchEvents,
    mainDispatchEventCount: dispatchEvents.length,
    undocumentedMainDispatchEvents: missing,
  }
}

const allMessages = [...host, ...integration].sort((left, right) =>
  [left.direction, left.event, left.variant].join(':').localeCompare([right.direction, right.event, right.variant].join(':')),
)
const catalog = {
  catalogVersion: 1,
  generatedOn: new Date().toISOString().slice(0, 10),
  protocol: 'FieldTwin host client postMessage',
  transport: {
    iframeTarget: 'window.parent',
    popoutTarget: 'window.opener',
    trustBoundary: 'Pin the source window and exact origin from the trusted loaded event; never use * for credentials or normal messages.',
    hostSendMessageAugmentation: sendMessageFields,
    directReplyAugmentation: directReplyFields,
    binaryReplyException: 'A Blob response has no event or JSON reply decorators.',
  },
  counts: {
    messages: allMessages.length,
    hostToIntegrationVariants: host.length,
    integrationToHostVariants: integration.length,
    distinctHostToIntegrationEvents: new Set(host.map((item) => item.event)).size,
    distinctIntegrationToHostEvents: new Set(integration.map((item) => item.event)).size,
    fields: allMessages.reduce((total, item) => total + item.fields.length, 0),
  },
  sourceCoverage,
  messages: allMessages,
}

const serialized = `${JSON.stringify(catalog, null, 2)}\n`
if (arguments_.check) {
  const current = fs.readFileSync(outputPath, 'utf8')
  const normalizedCurrent = current.replace(/"generatedOn": "[^"]+"/, `"generatedOn": "${catalog.generatedOn}"`)
  if (normalizedCurrent !== serialized) {
    throw new Error(`Generated catalog is stale: ${outputPath}`)
  }
  console.log(`PostMessage catalog is current: ${catalog.counts.messages} variants, ${catalog.counts.fields} fields.`)
} else {
  fs.writeFileSync(outputPath, serialized)
  console.log(`Wrote ${outputPath}`)
  console.log(`${catalog.counts.hostToIntegrationVariants} host→integration variants, ${catalog.counts.integrationToHostVariants} integration→host variants, ${catalog.counts.fields} fields`)
}
