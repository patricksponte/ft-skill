# FieldTwin Integration Kit — User Manual

The FieldTwin Integration Kit is a Visual Studio Code extension for building FieldTwin
integrations: web applications that run inside a FieldTwin tab, talk to FieldTwin over
`window.postMessage`, and read or change data through the FieldTwin REST API.

The extension gives you four things:

- a **wizard** that creates a new integration project;
- **AI assistant files**, so Copilot, Claude Code, Cursor and other assistants know how to
  build FieldTwin integrations securely;
- **FieldTwin in chat** and an **MCP server**, so an assistant can look up the API and work
  with your real project data;
- a **simulator** that plays the part of FieldTwin for protocol testing.

Everything the extension needs is inside it. It downloads nothing when it runs, so it works
offline and behind a corporate proxy.

---

## Contents

1. [Requirements](#1-requirements)
2. [Installing](#2-installing)
3. [Quick start](#3-quick-start)
4. [Creating an integration](#4-creating-an-integration)
5. [AI assistant files](#5-ai-assistant-files)
6. [FieldTwin in chat](#6-fieldtwin-in-chat)
7. [The MCP server](#7-the-mcp-server)
8. [The simulator](#8-the-simulator)
9. [Deploying to FieldTwin](#9-deploying-to-fieldtwin)
10. [Settings](#10-settings)
11. [Command reference](#11-command-reference)
12. [Security and privacy](#12-security-and-privacy)
13. [Troubleshooting](#13-troubleshooting)
14. [Updating and uninstalling](#14-updating-and-uninstalling)
15. [Building from source](#15-building-from-source)

---

## 1. Requirements

| Requirement | Why |
|---|---|
| Visual Studio Code 1.101 or later | Needed for the chat, language model tool and MCP APIs the extension uses. |
| Your FieldTwin address, e.g. `https://yourcompany.fieldtwin.com` | The integration accepts messages only from this exact address. |
| A FieldTwin API token (optional) | Only for the MCP server. Create one in FieldTwin under **Settings → API Tokens**. |
| GitHub Copilot Chat (optional) | For `@fieldtwin`, `#fieldtwinDocs` and `#fieldtwinApi`. |
| Node.js or Python (optional) | Only if you choose the Node.js or Python template. |

You do not need Node.js to run the MCP server: the extension starts it with the runtime
built into VS Code.

---

## 2. Installing

The extension is distributed as a `.vsix` file.

**From the Extensions view**

1. Open the **Extensions** view (`Ctrl+Shift+X`, or `Cmd+Shift+X` on macOS).
2. Click the **`…`** menu at the top of the view.
3. Choose **Install from VSIX…** and select `fieldtwin-integration-kit.vsix`.
4. Reload the window if asked.

**From a terminal**

```bash
code --install-extension fieldtwin-integration-kit.vsix
```

If `code` is not found on macOS, run **Shell Command: Install 'code' command in PATH** from
the Command Palette first.

To check the installation, open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and
type **FieldTwin**. You should see the commands listed in
[Command reference](#11-command-reference).

---

## 3. Quick start

1. Open the Command Palette and run **FieldTwin: New Integration…**.
2. Enter a name, choose a folder and a template, enter your FieldTwin address, and choose
   the AI assistants you use.
3. Open the new project when asked. `GETTING-STARTED.md` lists the next steps for your
   template.
4. Host the project over HTTPS (GitHub Pages works for the static template) and add it in
   FieldTwin under **Admin → Integrations → Create New Tab**.
5. Open the tab in FieldTwin. The Hello World shows **Connected** and a toast.
6. Ask your assistant, for example: *"Show every staged asset in the current subproject in a
   table, and zoom to one when I click it."*

---

## 4. Creating an integration

Run **FieldTwin: New Integration…**. The wizard has five steps.

| Step | What you enter |
|---|---|
| 1. Name | A display name, e.g. `Asset Inspector`. The folder name is derived from it (`asset-inspector`). |
| 2. Location | The parent folder. If the project folder already exists, you are asked before files are added to it. |
| 3. Template | Static page, Node.js or Python (see below). |
| 4. FieldTwin address | Your FieldTwin address. A pasted full URL is reduced to its origin, e.g. `https://yourcompany.fieldtwin.com/project/123` becomes `https://yourcompany.fieldtwin.com`. Only `https://` is accepted. You can leave it empty and set it later. |
| 5. AI assistants | The assistants to prepare. See [AI assistant files](#5-ai-assistant-files). |

### Templates

All three templates contain the same Hello World page, built on the secure FieldTwin bridge.

| Template | Files | When to choose it |
|---|---|---|
| Static page | `index.html` | No server code is needed. Host it anywhere, e.g. GitHub Pages. |
| Node.js | `public/index.html`, `server.js`, `package.json`, `.env.example` | You need npm packages or server routes. The Express server serves only `public/`. |
| Python | `public/index.html`, `app.py`, `requirements.txt`, `.env.example` | You need pip packages or server routes. The FastAPI server serves only `public/`. |

Every project also gets:

| File | Purpose |
|---|---|
| `fieldtwin.config.json` | Name, version and template. The extension uses it to recognise the folder as an integration. |
| `GETTING-STARTED.md` | The next steps for your template. |
| `.gitignore` | Ignores dependencies, virtual environments and `.env` files. |
| `.fieldtwin/` | The shared reference your AI assistants read. See [AI assistant files](#5-ai-assistant-files). |

### The allowed FieldTwin origin

The Hello World accepts the FieldTwin `loaded` message only from the addresses listed at the
top of the page:

```javascript
const ALLOWED_FIELDTWIN_ORIGINS = [
  'https://yourcompany.fieldtwin.com',
]
```

The wizard fills this in for you. If you skipped that step, replace the placeholder
`https://fieldtwin.example` yourself. If you are not sure of the address, open the page in
FieldTwin once: its **Troubleshoot** tab shows the address that tried to connect.

For the Node.js and Python templates, start the server with the same address so it sends a
`Content-Security-Policy: frame-ancestors` header that allows FieldTwin to embed the page:

```bash
FIELDTWIN_ORIGINS=https://yourcompany.fieldtwin.com npm start      # Node.js
FIELDTWIN_ORIGINS=https://yourcompany.fieldtwin.com python app.py  # Python
```

---

## 5. AI assistant files

AI assistants write better FieldTwin code when they have the FieldTwin reference in front of
them. The extension writes the right file for each assistant.

| Assistant | Files written |
|---|---|
| Any assistant that reads the open standard | `AGENTS.md` |
| GitHub Copilot | `.github/copilot-instructions.md`, `.github/instructions/fieldtwin.instructions.md` |
| Claude Code | `.claude/skills/create-fieldtwin-integration/`, `.claude/skills/develop-fieldtwin-integration/` |
| Cursor / Windsurf | `.cursor/rules/fieldtwin.mdc`, `.windsurf/rules/fieldtwin.md` |
| Cline / Roo Code | `.clinerules/fieldtwin.md` |
| Continue | `.continue/rules/fieldtwin.md` |
| Gemini CLI / Antigravity | `GEMINI.md`, `.antigravity.md` |
| Aider | `CONVENTIONS.md` |

Claude Code receives the two official FutureOn **Agent Skills**:

- `create-fieldtwin-integration` — choosing between a single page and a full repository, the
  Hello World, hosting, Docker, Helm and deployment;
- `develop-fieldtwin-integration` — the secure bridge, every host message and API field in
  searchable catalogs, Operation Mode, pop-outs and tests.

Every other assistant gets a rule file, and all of them share the reference written once to
`.fieldtwin/`:

| File | Content |
|---|---|
| `.fieldtwin/fieldtwin-instructions.md` | The complete integration guide. |
| `.fieldtwin/api-reference.json` | Every FieldTwin REST API v1.10 route, with the conventions for using them. |
| `.fieldtwin/api-quick-reference.md` | A compact cheat sheet. |

Commit these files, so everyone who works on the project gets the same guidance.

### Adding files to an existing project

Open the project folder and run **FieldTwin: Add AI Agent Files to Workspace**. Files that
already exist are left untouched, so your own edits are safe.

### Updating after an extension upgrade

Run **FieldTwin: Update AI Agent Files**. The assistants already set up in the project are
pre-selected. Their files are replaced with the versions from the installed extension.

Projects created with version 0.1.0 of the kit have a generated
`.claude/skills/fieldtwin/SKILL.md`. Updating Claude Code removes it, because the Agent Skills
replace it, but only if the file is unchanged. A file you have edited is never deleted.

---

## 6. FieldTwin in chat

These features need GitHub Copilot Chat.

### The `@fieldtwin` participant

Type `@fieldtwin` in the chat, followed by a question or a command:

| Command | What it does |
|---|---|
| `@fieldtwin /new` | Offers a button that starts the New Integration wizard. |
| `@fieldtwin /api stagedAssets` | Looks up REST routes and the conventions that apply. |
| `@fieldtwin /events` | Explains the messages FieldTwin and an integration exchange. |
| `@fieldtwin /debug` | Helps diagnose an integration that is not working. |
| `@fieldtwin <question>` | Answers any FieldTwin question. |

Answers are based on the bundled FieldTwin reference and follow the secure bridge rules.

### Tools for agent mode

Reference these from any chat prompt, including agent mode:

| Tool | What it returns |
|---|---|
| `#fieldtwinDocs` | Matching sections of the integration guide and of the Agent Skills' references (message catalog, Operation Mode, batch writes, security and testing). |
| `#fieldtwinApi` | Matching REST API v1.10 routes (method, path, summary) plus the conventions: API root, qualified subproject ID, encoding, authentication, and metadata or batch rules when relevant. |

In agent mode, the assistant can also call these tools on its own.

---

## 7. The MCP server

The MCP server lets an AI assistant call the FieldTwin REST API with your account. It has 96
tools covering projects, subprojects, staged assets, wells, well bores, connections, shapes,
overlays, annotations, layers, costs, tags, users and metadata definitions.

### Setting it up

1. Run **FieldTwin: Set API Token** and paste your API token.
2. Set `fieldtwin.backendUrl` if your backend is not `https://backend.fieldtwin.com`.
3. Optionally set `fieldtwin.projectId` and `fieldtwin.subProjectId` as defaults, so you
   do not have to give them in every request.
4. Open the chat in agent mode. The **FieldTwin** server appears in the tool list.

The server is registered with VS Code automatically: there is no configuration file to write.
If no token is set when the server starts, you are asked for one.

### Read-only by default

The server runs with your account's API token, so an assistant can only **read** data until
you allow changes. To let it create, update and delete data, turn on
`fieldtwin.mcp.allowWrites`. Turn it off again when you are done.

### Editors without automatic MCP registration

Some editors built on VS Code do not support MCP servers provided by extensions. There, run
**FieldTwin: Write MCP Server Config to Workspace**. It writes `.vscode/mcp.json`, which asks
for the token when the server starts instead of storing it.

The file contains the path of the editor on your machine, so it is specific to you. Do not
commit it; each person should generate their own.

---

## 8. The simulator

The simulator opens your integration in a panel that plays the part of FieldTwin. Use it to
test how your code handles FieldTwin messages without deploying anything.

### Opening it

Open the integration folder and run **FieldTwin: Preview Integration in Simulator**, or click
the preview button in the editor title bar while an HTML file is open.

- **Static template:** the extension serves the folder on a local port (`5174` by default).
- **Node.js and Python templates:** start your server first. The simulator looks for it at
  `http://localhost:3000`. If nothing is running there, you can enter another address or
  preview the files in `public/` directly.

Run **FieldTwin: Stop Preview Server** to close the panel and stop the local server.

### What it does

As soon as the page loads, the simulator sends `loaded` with the fields FieldTwin sends:
`token`, `backendUrl`, `APIVersion`, `project`, `subProject` (as `subProjectId:streamId`),
`stream`, `customTabId`, `canEdit` and `APIServerIsReady`. The values come from your settings.
The token is your API token if you have set one, otherwise a placeholder.

Buttons send the other FieldTwin events on demand:

| Button | Message sent |
|---|---|
| loaded | `loaded` again |
| tokenRefresh | a new token |
| apiPodIsReady | the API became available |
| select | one staged asset selected, with a cursor position |
| unselect | the selection was cleared |
| operationSearch | a search for `manifold` |
| visualFilterToggle | a visual filter switched on |

When your integration asks FieldTwin for data, the simulator answers with sample data, so
code that waits for a reply does not hang:

| Your integration sends | The simulator replies with |
|---|---|
| `getProjectData` | `projectData` |
| `getViewBox` | `viewBox` |
| `getVisibleResources` | `visibleResources` |
| `getResources` | `resources` |
| `getResourcesByTags` | `resourcesByTags` |

Replies include the `queryId` your request carried. Every message your integration sends is
listed in the panel, and `toast` messages appear as notifications. The page reloads when you
save a file (see `fieldtwin.preview.autoReload`), and the **FieldTwin** output channel logs
every message in both directions.

### Limitation: the simulator and the secure bridge

The simulator runs inside VS Code, at an address that starts with `vscode-webview://`. The
secure bridge in the Hello World, and in integrations built with the Agent Skills, accepts
`loaded` only from the `https://` FieldTwin addresses in `ALLOWED_FIELDTWIN_ORIGINS`. Those
integrations therefore ignore the simulator on purpose.

When nothing replies, the simulator tells you so and shows its own address. Use the simulator
for integrations without an address allowlist, and test the secure bridge in a real FieldTwin
tab.

---

## 9. Deploying to FieldTwin

1. Host the integration over **HTTPS** at an address FieldTwin can reach:
   - static template: any static host, such as GitHub Pages;
   - Node.js or Python: your own server, started with `FIELDTWIN_ORIGINS` set.
2. Check that `ALLOWED_FIELDTWIN_ORIGINS` contains your FieldTwin address.
3. In FieldTwin, go to **Admin → Integrations → Create New Tab** and enter the URL.
4. Open the tab. The Hello World shows **Connected** and a toast.

For production repositories with Docker, Helm and a build pipeline, ask Claude Code to use the
`create-fieldtwin-integration` skill.

---

## 10. Settings

Open **Settings** and search for **FieldTwin**, or edit `settings.json`.

| Setting | Default | Description |
|---|---|---|
| `fieldtwin.backendUrl` | `https://backend.fieldtwin.com` | FieldTwin backend URL, without a trailing slash. Used by the MCP server and the simulator. |
| `fieldtwin.projectId` | *(empty)* | Default project ID. Most subproject API calls need a real one. |
| `fieldtwin.subProjectId` | *(empty)* | Default subproject ID. A plain ID means the main stream (`{id}:{id}`); use `{id}:{streamId}` for a branch. |
| `fieldtwin.apiVersion` | `v1.10` | API version sent by the simulator as `APIVersion`. |
| `fieldtwin.mcp.enabled` | `true` | Offer the MCP server to chat clients. |
| `fieldtwin.mcp.allowWrites` | `false` | Let the MCP server create, update and delete data. |
| `fieldtwin.preview.port` | `5174` | Port for the preview server. If it is busy, the next free port is used. |
| `fieldtwin.preview.autoReload` | `true` | Reload the simulator when a file in the project changes. |

---

## 11. Command reference

All commands are in the Command Palette under **FieldTwin**.

| Command | What it does |
|---|---|
| **New Integration…** | Creates a new integration project. |
| **Add AI Agent Files to Workspace** | Adds assistant files to the open folder, leaving existing files untouched. |
| **Update AI Agent Files** | Replaces assistant files with the versions from the installed extension. |
| **Preview Integration in Simulator** | Opens the simulator for the open folder. |
| **Stop Preview Server** | Closes the simulator and stops the local server. |
| **Set API Token** | Stores your FieldTwin API token in the editor secret store. |
| **Clear API Token** | Removes the stored token. |
| **Open API Reference** | Opens the FieldTwin quick reference. |
| **Write MCP Server Config to Workspace** | Writes `.vscode/mcp.json` for editors without automatic MCP registration. |

---

## 12. Security and privacy

- **API token.** Stored in the editor's encrypted secret store. It is never written to
  `settings.json`, a `.env` file or any project file, and it is passed to the MCP server only
  when the server starts.
- **Read-only by default.** The MCP server refuses to create, update or delete data unless
  `fieldtwin.mcp.allowWrites` is on.
- **Secure bridge.** Generated projects accept FieldTwin messages only from your exact
  FieldTwin address and send replies only to it. The integration token stays in memory and
  never appears in URLs, storage, the page or logs.
- **No network access by the extension.** Nothing is downloaded at runtime. The only network
  calls are the ones the MCP server makes to your FieldTwin backend when an assistant uses it.
- **Local preview server.** It listens on `127.0.0.1` only and serves nothing outside the
  project folder.

---

## 13. Troubleshooting

| Symptom | What to do |
|---|---|
| No **FieldTwin** commands in the Command Palette | Check that the extension is installed and enabled, and that VS Code is 1.101 or later. Reload the window. |
| The Hello World in FieldTwin says *Connection rejected* | Your FieldTwin address is not in `ALLOWED_FIELDTWIN_ORIGINS`. The notice shows the address that tried to connect. If it is yours, add it and redeploy. |
| The Hello World in FieldTwin never connects | Check the page is served over HTTPS, and that the server does not send `X-Frame-Options`. For Node.js or Python, start it with `FIELDTWIN_ORIGINS` set. |
| The simulator says *No reply* | Expected for secure-bridge integrations (see [the limitation](#limitation-the-simulator-and-the-secure-bridge)). Otherwise, make sure the page listens for `loaded` in the first `<script>` in `<head>`. |
| The simulator cannot find a Node.js or Python server | Start the server first (`npm start` or `python app.py`), or enter its address when asked. |
| API calls return 401 | The token expired or the `Bearer ` prefix is missing. Wait for `tokenRefresh`. Never send `Authorization` and `token` headers together. |
| API calls return 404 | Check for a trailing slash in the backend URL, a wrong project ID, or a split subproject ID. Keep `subProjectId:streamId` whole and URL-encoded. |
| The MCP server does not appear in chat | Check `fieldtwin.mcp.enabled`. In editors without automatic registration, use **Write MCP Server Config to Workspace**. |
| The MCP server returns no data | Set a real `fieldtwin.projectId`; there is no project wildcard. Check the token and `fieldtwin.backendUrl`. |
| The MCP server says *write tools are disabled* | This is intended. Turn on `fieldtwin.mcp.allowWrites` if the assistant should change data. |
| `@fieldtwin` is not available | Install and sign in to GitHub Copilot Chat. |

For more detail, open **View → Output** and select **FieldTwin**.

---

## 14. Updating and uninstalling

**Updating.** Install the new `.vsix` the same way as the first time; it replaces the old
version. Then run **FieldTwin: Update AI Agent Files** in each project, so the assistants get
the latest reference.

**Uninstalling.** In the Extensions view, open the FieldTwin Integration Kit and click
**Uninstall**. Run **FieldTwin: Clear API Token** first if you also want to remove the stored
token. Files the extension wrote into your projects stay there; delete them yourself if you no
longer want them.

---

## 15. Building from source

The extension lives in `packages/vscode-extension/` of the
[ft-skill repository](https://github.com/patricksponte/ft-skill). Its Agent Skills, guides,
templates and MCP server are copied from the repository root at build time, so every build
contains the current repository content.

```bash
git clone https://github.com/patricksponte/ft-skill.git
cd ft-skill/packages/vscode-extension
npm ci
npm test          # copies the content, builds and runs every test suite
npm run package   # produces fieldtwin-integration-kit.vsix
```

To try changes without packaging, open `packages/vscode-extension` in VS Code and press
**F5**. A second window opens with the extension loaded from source.

See [README.md](README.md) for an overview and [CHANGELOG.md](CHANGELOG.md) for the version
history.
