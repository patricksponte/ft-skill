# FieldTwin Integration Kit

Build [FieldTwin](https://www.futureon.com) integrations without leaving VS Code — and
teach whichever AI assistant you use how to build them with you.

A FieldTwin integration is a web app shown in an iframe inside the FieldTwin digital twin
platform. It talks to the host over `window.postMessage` and to the backend over the
FieldTwin REST API. This extension packages everything you need for that: the project
scaffold, the official FutureOn FieldTwin Agent Skills, the reference material your AI
assistant reads, a FieldTwin MCP server, and a simulator for the host protocol.

Everything ships inside the extension. Nothing is downloaded at runtime, so it works
offline and behind a corporate proxy.

The [user manual](MANUAL.md) covers installation, every feature, settings and
troubleshooting step by step.

---

## Start here

1. Run **FieldTwin: New Integration…** from the Command Palette (`Ctrl/Cmd+Shift+P`).
2. Pick a template, enter your FieldTwin address (for example
   `https://yourcompany.fieldtwin.com`) and pick the AI assistants you use.
3. Host the Hello World over HTTPS and add it in FieldTwin under
   **Admin → Integrations → Create New Tab**. You should see *Connected* and a toast.

The Hello World is built on the secure bridge: it accepts `loaded` only from the exact
FieldTwin origin you entered. See [The simulator](#the-simulator) for what that means
for local testing.

---

## What you get

### The scaffolder

**FieldTwin: New Integration…** creates the project folder, the Hello World integration
with your FieldTwin origin already in `ALLOWED_FIELDTWIN_ORIGINS`, and a
`GETTING-STARTED.md` with the next steps for your template:

| Template | What it adds |
|---|---|
| Static page | `index.html` only. Host it free on GitHub Pages. |
| Node.js | An Express server that serves `public/` only and sends CSP `frame-ancestors` from `FIELDTWIN_ORIGINS`. |
| Python | A FastAPI server that serves `public/` only and sends CSP `frame-ancestors` from `FIELDTWIN_ORIGINS`. |

### Context for your AI assistant

Claude Code gets the official FutureOn Agent Skills, copied whole:
`create-fieldtwin-integration` and `develop-fieldtwin-integration`, with their references
and searchable catalogs of every API field and `postMessage` event.

For every other assistant, the complete integration guide, the v1.10 route list and a
cheat sheet are written once into `.fieldtwin/`, and each assistant gets its own rule file
pointing at them:

| Assistant | File written |
|---|---|
| Any (open standard) | `AGENTS.md` |
| GitHub Copilot | `.github/copilot-instructions.md`, `.github/instructions/fieldtwin.instructions.md` |
| Claude Code | `.claude/skills/create-fieldtwin-integration/`, `.claude/skills/develop-fieldtwin-integration/` |
| Cursor / Windsurf | `.cursor/rules/fieldtwin.mdc`, `.windsurf/rules/fieldtwin.md` |
| Cline / Roo Code | `.clinerules/fieldtwin.md` |
| Continue | `.continue/rules/fieldtwin.md` |
| Gemini CLI / Antigravity | `GEMINI.md`, `.antigravity.md` |
| Aider | `CONVENTIONS.md` |

Use **FieldTwin: Add AI Agent Files to Workspace** on a project you already have, and
**FieldTwin: Update AI Agent Files** after upgrading the extension. Updating a Claude Code
project from kit 0.1.0 also removes the `.claude/skills/fieldtwin/SKILL.md` the kit
generated then — only if it is still the kit's own unedited file.

### The simulator

**FieldTwin: Preview Integration in Simulator** opens your integration in a panel that
plays the part of the FieldTwin host.

The simulator:

- sends `loaded` automatically as soon as the page loads, with every field of the
  message catalog: `APIVersion`, `stream`, and `subProject` qualified as
  `subProjectId:streamId`;
- fires `tokenRefresh`, `apiPodIsReady`, `select`, `unselect`, `operationSearch` and
  `visualFilterToggle` on demand, in the shapes the catalog documents;
- logs every message your integration posts back, and renders `toast` the way FieldTwin
  does;
- answers `getProjectData`, `getViewBox`, `getVisibleResources`, `getResources` and
  `getResourcesByTags` with `projectData`, `viewBox`, `visibleResources`, `resources` and
  `resourcesByTags`, echoing `data.queryId`, so an integration that waits on a reply does
  not hang;
- reloads when you save a file.

> **Known limitation.** The panel is a VS Code webview, so its origin is
> `vscode-webview://…`. An integration built on the secure bridge — including the
> Hello World — accepts `loaded` only from an allowlisted **https** FieldTwin origin, so it
> ignores the simulator. The simulator says so, and shows its origin, when nothing
> replies. Use it for integrations without an origin allowlist, and test the secure
> bridge in a real FieldTwin tab.

### FieldTwin in chat

Type `@fieldtwin` in Copilot Chat:

| Command | What it does |
|---|---|
| `/new` | Scaffold an integration |
| `/api` | Look up a REST endpoint |
| `/events` | Explain the postMessage events and messages |
| `/debug` | Diagnose an integration that is not working |

Every answer is grounded in the bundled reference rather than the model's memory. From any
chat prompt — including agent mode — you can also reference `#fieldtwinDocs` and
`#fieldtwinApi` directly.

### The MCP server

96 tools over the FieldTwin REST API v1.10 — projects, subprojects, staged assets, wells,
well bores, connections, shapes, overlays, annotations, layers, costs, tags, users and
metadata definitions — so your assistant can work with your real project data.

The server is **read-only by default**: it runs with an account-level API token, so
create, update and delete tools are refused until you turn on `fieldtwin.mcp.allowWrites`.

It is registered with the editor automatically; there is no config file to write and no
absolute path to fix up. Run **FieldTwin: Set API Token** once, and the token is held in
the editor's encrypted secret store and handed to the server only when it starts. It is
never written to `settings.json`, a `.env` file, or anything you might commit.

> For editors that do not yet support extension-provided MCP servers, run
> **FieldTwin: Write MCP Server Config to Workspace** to get a `.vscode/mcp.json` that
> prompts for the token instead of storing it.

---

## Settings

| Setting | Default | What it is for |
|---|---|---|
| `fieldtwin.backendUrl` | `https://backend.fieldtwin.com` | Backend base URL, no trailing slash |
| `fieldtwin.projectId` | — | Default project ID. Most subproject calls need a real one |
| `fieldtwin.subProjectId` | — | Default subproject ID. A bare ID targets the main stream (`{id}:{id}`) |
| `fieldtwin.apiVersion` | `v1.10` | API version used in generated code |
| `fieldtwin.mcp.enabled` | `true` | Offer the MCP server to chat clients |
| `fieldtwin.mcp.allowWrites` | `false` | Let the MCP server create, update and delete data |
| `fieldtwin.preview.port` | `5174` | Preview server port; the next free one is used if busy |
| `fieldtwin.preview.autoReload` | `true` | Reload the simulator on save |

---

## Deploying to FieldTwin

Once the integration works in the simulator, host it anywhere your FieldTwin instance can
reach — GitHub Pages for a static page, your own server otherwise. Then in FieldTwin go to
**Admin → Integrations → Create New Tab** and point it at the URL.

---

## Troubleshooting

| Symptom | Cause |
|---|---|
| Hello World says *Connection rejected* | The FieldTwin origin is not in `ALLOWED_FIELDTWIN_ORIGINS`. The notice shows the origin that tried to connect; add it if it is yours. |
| Simulator says *No reply* | The page allowlists FieldTwin origins (see the simulator's known limitation), or it is not listening for `loaded` in the first `<script>` in `<head>`. |
| API calls return 401 | Token expired, or the `Bearer ` prefix is missing. Wait for `tokenRefresh`. Never set `Authorization` and `token` together. |
| API calls return 404 | A trailing slash on `backendUrl`, a split `subProject` (keep `subProjectId:streamId` whole and URL-encoded), or a wrong `projectId`. |
| MCP server has no data | Set a real `fieldtwin.projectId` — there is no project wildcard. |
| MCP says *write tools are disabled* | Intended. Turn on `fieldtwin.mcp.allowWrites` if the assistant should change data. |

The **FieldTwin** output channel logs every message in both directions.

---

## For maintainers

The extension lives in `packages/vscode-extension/` of the
[`ft-skill`](https://github.com/patricksponte/ft-skill) repository. Its Agent Skills,
knowledge, templates and MCP server are not duplicated here: `scripts/sync-assets.sh`
copies them from the repository root into the gitignored `assets/` folder, and `npm test`,
`npm run watch` and packaging run it first. A change to the skills or guides therefore
reaches the next build of the extension with nothing to copy by hand.

```bash
cd packages/vscode-extension
npm ci
npm test          # syncs assets, builds, runs every suite
npm run package   # produces fieldtwin-integration-kit.vsix
```

Press **F5** with `packages/vscode-extension` open to run the extension in a development host.
