# Metadata-backed connection system highlighting

Use this reference when editing FieldTwin host behavior for Operation Mode's built-in **Highlight systems** feature. It covers physical connections whose metadata selects one or more additional connection definitions, such as a bundle containing Oil and Gas lines.

This is host rendering and data-model guidance. It does not add an integration event, a `postMessage` field, or a new meaning for `visualFilteringUpdate`. If integrations must control these channels, treat that as a separate protocol proposal and update every in-scope contract and test deliberately.

## Model a physical line and its logical channels separately

A physical connection has geometry, ordered `from`/`to` endpoints, and one primary connection definition. A metadata value whose kind is `connection` selects another connection definition; several direct metadata slots may coexist on the same physical connection.

Normalize those inputs into logical channels before flow or rendering code runs:

```javascript
{
  channelId,
  connectionId,
  sourceValueId,
  categoryId,
  direction
}
```

Follow these rules:

- Preserve the primary connection category so ordinary connections retain their current behavior.
- Treat each effective direct metadata value of kind `connection` as an additional channel. Effective defaults count, but reading a default for highlighting must not create or save a metadata-value resource.
- Resolve selected connection definitions through the owning project/account view so project overrides, translations, and string-versus-number IDs behave like the property editor.
- Keep a stable `channelId`, preferably based on the metadata-value identity or definition path. Two channels of the same category must not overwrite one another because their directions may differ.
- Sort deterministically by metadata-definition order and then stable ID so lateral bands do not swap between renders.
- Ignore unresolved or deleted definitions without breaking the whole highlight, and expose useful diagnostics without logging customer metadata values.
- In the first implementation, count only metadata values directly owned by the physical connection. Do not recursively reinterpret connection-kind descendants as parallel bundle members unless the product defines that contract; child metadata normally describes the selected member.

Keep classification pure. Feed the resolver effective metadata and a connection-definition lookup instead of importing rendering or web state into the classifier. This makes defaults, missing references, repeated categories, and scope rules straightforward to test.

## Give each metadata channel an explicit direction

There is no safe generic way to infer a constituent's authored direction from a customer-defined metadata name. Normalize each channel at runtime to either along or against the physical connection's authored `from` to `to` geometry.

When the host data model already exposes a per-value direction, use it. If it does not, define and document a host-side persistence contract before adding an editor. Do not guess an internal field name, publish it as an integration API, or match a customer-defined display label.

Interpret explicit direction relative to the physical connection's current ordered endpoints:

- Along follows the physical connection geometry.
- Against runs against it.
- Reversing the physical connection swaps its endpoints and geometry but leaves each relative metadata value unchanged, so every constituent reverses in world space while retaining its relationship to the parent.

Use this precedence when old data has no value:

1. an explicit per-channel direction;
2. recognized service/topology semantics, such as production away from wells and injection toward wells;
3. authored `from` to `to` for services without a reliable semantic rule.

Keep the primary physical channel's existing authored-direction behavior for backward compatibility. Do not match a metadata field by display name, and do not assume every future connection category belongs in the current production/injection table.

When the host model has a persisted direction contract, expose a small direction control alongside each connection-kind metadata editor if users are expected to author it. Use clear endpoint-relative labels and the host's standard select/icon components; do not encode direction with an unexplained color alone.

## Compute flow per logical channel

Expand each physical connection into virtual graph edges, one for every active logical channel. Key internal results by channel identity and group the output for rendering:

```javascript
Map<connectionId, ChannelFlow[]>
```

Each `ChannelFlow` carries its category, direction, phase offset, color, and stable channel identity. This allows Oil and Gas to share one geometry, allows equal-category channels to run in opposite directions, and prevents a later channel from overwriting an earlier one.

Compute network distance and phase independently per service/category. Preserve continuity through ordinary-to-bundle-to-ordinary paths. Where connection segments restart their arc-length counters, shift every channel's phase by the segment offset, including segments measured relative to the parent end.

Any asset-side flow-port logic must iterate all active channel flows rather than asking for a single connection flow. Keep a scalar compatibility wrapper only where it helps ordinary-line callers migrate without changing their behavior.

## Render bands in one line pass

Represent simultaneous channels as stable, equal-width lateral bands across the existing screen-space line ribbon:

- Each band uses its service color.
- Each band has its own direction and phase.
- Keep a static tint and a directional comet or chevron when animation is paused or reduced motion is requested; stopping motion must not erase direction.
- Preserve the established single-channel appearance exactly.
- For multiple channels, use a neutral halo/presence cue rather than blending the colors or choosing the first channel as the outline color. Selection remains the highest-precedence outline.
- Compose the band effect after the authored dash/texture color is evaluated while preserving alpha discard, lighting, clipping, depth/normal rendering, and scene effects.
- Increase the highlighted ribbon's minimum screen width enough to keep bands readable. Validate the policy against representative maximum bundle sizes and never silently discard logical channels.

Prefer one shader pass with packed channel descriptors over cloned overlay geometry or one draw call per constituent. A small descriptor texture or equivalent buffer avoids multiplying geometry and can avoid a hard channel limit. If fixed uniform arrays are chosen instead, first establish a real domain maximum and define tested overflow behavior.

Keep descriptor allocation outside the frame loop. Rebuild only when the active systems, constituent metadata, directions, or referenced definitions change. Dispose or clear GPU resources when highlighting clears, a mesh regenerates, or the representation is destroyed.

## Reapply on every relevant lifecycle event

Coalesce reapplication to once per frame when any of these change:

- metadata-value create, update, or delete for a connection;
- a referenced connection definition or category;
- physical endpoints, reversed geometry, length, or segments;
- active highlighted systems or animation preference;
- selection state when selection supplies a highlight color.

Do not rebuild metadata trees during animation ticks. Store the last channel-flow arrays in the existing highlight registry so newly created connection and segment representations can restore the full active state after regeneration.

## Required regression coverage

Cover observable behavior rather than private shader state:

- an ordinary single-category connection remains visually and directionally unchanged;
- a bundle with Oil and Gas shows one active channel, both channels, and neither channel correctly;
- two channels on one geometry can move in opposite directions;
- repeated same-category channels with opposite directions remain distinct;
- effective defaults are read without being materialized or saved;
- nested, missing, translated, hidden, and conditional metadata follow the documented constituent rule;
- phase stays continuous across ordinary and bundled connections;
- segment offsets work for both directions and end-relative segments;
- reversing the parent follows the documented relative-direction semantics;
- metadata add/change/delete and definition-category edits refresh without a reload;
- regenerated meshes restore every active channel;
- paused/reduced-motion rendering retains static color and direction cues;
- selection, annotation, status, and disconnected outline precedence is restored after clearing;
- dashed and textured lines, 2D/3D cameras, clipping, depth/normal passes, and large bundles remain correct;
- clearing and destruction release descriptor resources and return lines to normal clustering.

## Handoff

State explicitly that this is host-only unless a protocol change was requested. Report the constituent scope rule, direction fallback, rendering policy for large bundles, single-line compatibility, lifecycle invalidation, focused tests, and the representative performance path used for validation.
