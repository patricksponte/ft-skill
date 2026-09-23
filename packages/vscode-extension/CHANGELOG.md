# Changelog

## 0.2.0

Synced with ft-skill `5914d6c`, which merged the official FutureOn FieldTwin Agent Skills
and moved every sample onto the secure bridge.

- **Agent Skills for Claude Code.** `create-fieldtwin-integration` and
  `develop-fieldtwin-integration` are bundled and installed whole into `.claude/skills/`,
  replacing the generated `.claude/skills/fieldtwin/SKILL.md`. Updating removes that file
  only when it is still the kit's own.
- **Secure Hello World.** The wizard asks for the FieldTwin address and writes it into
  `ALLOWED_FIELDTWIN_ORIGINS`. Node and Python projects put the page in `public/`, which
  is all their servers serve, and get a `.env.example` with `FIELDTWIN_ORIGINS`.
- **`#fieldtwinApi` / `/api`** read the new generated route list (275 v1.10 operations)
  and return the conventions that apply: API root, qualified subproject ID, encoding,
  authentication, and metadata or batch rules when the query touches them.
- **`#fieldtwinDocs`** also searches the Agent Skills' references (message catalog,
  Operation Mode, batch writes, security and testing).
- **`@fieldtwin`** follows the secure-bridge rules. It no longer tells the model to take
  the last segment of `subProject`, which gave the stream ID instead of the subproject.
- **Simulator** speaks the current host contract: `loaded` carries `APIVersion` and
  `stream`; replies are `projectData`, `viewBox`, `visibleResources`, `resources` and
  `resourcesByTags` with `data.queryId`; `visualFilterToggle` fields are under `data`;
  `tokenRefresh` and `unselect` added. Node/Python projects preview `public/`.
- **Lives in the ft-skill repository** as `packages/vscode-extension/`. `assets/` is
  generated from the repository root at build time instead of being copied in by hand,
  and the extension is licensed ISC like the rest of the repository.
- **Simulator** addresses the integration's exact origin instead of `'*'`.
- **MCP server 3.0** (96 tools). Read-only unless `fieldtwin.mcp.allowWrites` is on.
  `get_metadata` is gone: v1.10 has no per-resource metaData route.

### Known limitation

The simulator runs in a webview (`vscode-webview://…`), which a secure-bridge integration
never allowlists, so the Hello World ignores its `loaded`. The simulator now says so when
nothing replies.

## 0.1.0

First release.

- **New Integration** wizard — creates a FieldTwin integration project from the
  bundled static, Node.js or Python template, replacing the `create.sh` /
  `create.ps1` installer scripts.
- **Agent context files** for AGENTS.md, GitHub Copilot, Claude Code, Cursor,
  Windsurf, Cline, Roo Code, Continue, Gemini CLI, Antigravity and Aider. The
  reference material is written once into `.fieldtwin/` and every tool's rule
  file points at it, so the copies cannot drift apart.
- **MCP server** (105 tools over the FieldTwin REST API) registered
  automatically with the editor's chat clients. No absolute paths to edit, and
  the API token is kept in the editor secret store rather than a `.env` file.
- **`@fieldtwin` chat participant** with `/new`, `/api`, `/events` and `/debug`,
  plus the `#fieldtwinDocs` and `#fieldtwinApi` tools for agent mode.
- **FieldTwin Simulator** — runs the integration in a webview that plays the
  part of the FieldTwin host, so `loaded`, `select`, `operationSearch` and
  `visualFilterToggle` can be tested without deploying anything.

### Fixed from the shell installer

- The Claude Code skill was written to `.claude/skills/fieldtwin.md`, which
  Claude Code does not discover. It is now a proper
  `.claude/skills/fieldtwin/SKILL.md` with `name`/`description` frontmatter.
- `api-reference.json` was not valid JSON — a missing comma after the Overlays
  category note meant anything parsing the file failed.
