# FieldTwin AI Agent Toolkit

Teach any AI assistant to help you build FieldTwin integrations — in minutes.

This toolkit gives your AI assistant complete knowledge of the FieldTwin integration API (v1.10): how to communicate with the platform, how to create and manage resources, how to handle user interactions, and more.

---

## Navigation

| I want to... | Go to |
|---|---|
| Understand how FieldTwin integrations work | [How It Works](#how-it-works) |
| Set up my AI tool | [Platform Setup](#platform-setup) |
| Give the AI direct access to my live FieldTwin data | [MCP Server](#mcp-server-advanced) |
| Create a new integration project from scratch | [Scripts](#scripts) |
| Run the Hello World and verify my setup | [Hello World](#hello-world) |
| See example prompts | [Example Prompts](#example-prompts) |

---

## Quick Start (5 minutes)

**Starting a new integration from scratch?** Run the create script — it sets everything up for you:

```bash
# Linux / macOS
curl -sSfL https://raw.githubusercontent.com/patricksponte/ft-skill/main/create.sh | bash
```

```powershell
# Windows (PowerShell)
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/patricksponte/ft-skill/main/create.ps1" -OutFile create.ps1; .\create.ps1
```

Then:

1. **Pick your AI tool below** and add the agent context — takes 2 minutes
2. **Open the Hello World** (`index.html`) in FieldTwin as an integration — you should see "Connected!"
3. **Ask your AI:** `"I want to build a FieldTwin integration that shows a list of all assets in the current subproject."`

---

## How It Works

<details>
<summary><strong>What is a FieldTwin integration?</strong></summary>

A FieldTwin integration is a small web page that appears as a panel inside FieldTwin. FieldTwin loads it inside an **iFrame** — think of it as a browser tab embedded directly in the platform. Your integration can read data from FieldTwin, react to user actions, and send commands back (select assets, zoom the camera, show notifications, etc.).

</details>

<details>
<summary><strong>Two types of integrations</strong></summary>

**Type 1 — Frontend only**

Your entire integration is a single HTML file with JavaScript. It talks directly to the FieldTwin API from the browser.

```
FieldTwin  →  loads your HTML/JS page  →  page calls FieldTwin API
```

Good for: dashboards, asset lists, selection panels, search tools, simple forms.
No server required. Can be hosted for free on GitHub Pages.

---

**Type 2 — Frontend + Backend**

Your HTML/JS page is a thin interface. The real logic runs on a server you control — Python, Node.js, or any language. The page calls your server, your server does the work, and sends results back.

```
FieldTwin  →  loads your HTML/JS page  →  page calls YOUR server  →  server calls FieldTwin API or runs calculations
```

Good for: complex calculations, machine learning, data from external databases, heavy processing (e.g. Python packages for pipeline routing calculations).
Requires a running server (locally during development, deployed for production).

</details>

<details>
<summary><strong>The URL problem — and how to solve it</strong></summary>

FieldTwin needs a **public HTTPS URL** to load your integration. This means `http://localhost` does not work out of the box, because FieldTwin runs over HTTPS and browsers block HTTPS pages from loading HTTP content by default.

**Solution A — GitHub Pages** _(recommended for Type 1 integrations)_

Push your HTML file to GitHub and enable GitHub Pages. Your integration gets a permanent HTTPS URL instantly — no server, no configuration, works from any network including restricted corporate environments.

```
Your HTML file on GitHub  →  GitHub Pages serves it at https://your-org.github.io/your-repo/...
```

**Solution B — localhost with Chrome override** _(recommended for active development)_

1. Open FieldTwin in Chrome.
2. Click the **icon to the left of the URL bar** (lock or info icon).
3. Click **Site settings → Insecure content → Allow**.
4. Reload the page.

Chrome will now allow your FieldTwin session to load iFrames from `http://localhost`. This setting is saved for that FieldTwin URL.

**Solution C — ngrok** _(recommended for sharing with teammates or when Chrome override is blocked)_

ngrok creates a temporary public HTTPS URL that tunnels directly to your local server — no deploy, no configuration.

1. Install ngrok: [ngrok.com/download](https://ngrok.com/download)
2. Start your local server (`npm start` or `python app.py`)
3. In a new terminal: `ngrok http 3000`
4. Copy the `https://....ngrok-free.app` URL and use it in FieldTwin.

> Free tier: the URL changes every time you restart ngrok. Paid plans give you a fixed URL.

| Situation | Recommended solution |
|---|---|
| Testing the Hello World | GitHub Pages — use the link in this repo |
| Building a simple HTML/JS integration | GitHub Pages — push and share |
| Developing locally with live reload | localhost + Chrome override |
| Python/Node backend running locally | localhost + Chrome override |
| Sharing work-in-progress with teammates | ngrok |
| Restricted corporate network | GitHub Pages (frontend) + ngrok or cloud (backend) |
| Deploying to production | GitHub Pages (frontend) + your cloud provider (backend) |

</details>

<details>
<summary><strong>What you can ask your AI after setup</strong></summary>

- **Generate a complete integration from scratch** — just describe what you want to build
- **Run a Hello World** — verify your connection with one file and a built-in troubleshooter
- **Handle user selections** — react when the user clicks on an asset in the 3D view
- **Add global search** — integrate your data into the FieldTwin search bar
- **Create and manage resources** — add, update, or delete assets, wells, pipelines, shapes, overlays, frames, annotations
- **Show notifications** — send toast messages to FieldTwin
- **Control the camera** — zoom to specific assets or coordinates
- **Add visual filters** — place toggle buttons next to the FieldTwin search bar
- **Display 3D labels** — show status badges next to assets based on their tags
- **Call the FieldTwin REST API** — fetch, create, update, and delete any resource
- **Work with metadata** — read and write custom fields on any resource
- **Debug connection problems** — follow a guided troubleshooting checklist with live diagnostics

</details>

---

## Platform Setup

**Which file should I use?**

| File | Size | Best for |
|---|---|---|
| `fieldtwin-instructions.md` | ~19 KB | Models with large context windows (Claude, GPT-4o, Gemini 1.5+) |
| `platforms/copilot-instructions.md` | ~6 KB | GitHub Copilot, Cline, JetBrains AI, most local models |
| `api-quick-reference.md` | ~4 KB | Token-limited models, quick paste in any chat, small local models |
| `api-reference.json` | ~18 KB | Structured endpoint reference — attach as a file when the AI supports it |

> **Raw file URLs** (replace `patricksponte/ft-skill` with your GitHub repository):
> ```
> https://raw.githubusercontent.com/patricksponte/ft-skill/main/fieldtwin-instructions.md
> https://raw.githubusercontent.com/patricksponte/ft-skill/main/api-quick-reference.md
> https://raw.githubusercontent.com/patricksponte/ft-skill/main/platforms/copilot-instructions.md
> ```

---

### IDE Extensions

<details>
<summary><strong>GitHub Copilot</strong></summary>

**Best file:** `platforms/copilot-instructions.md`

GitHub Copilot automatically reads `.github/copilot-instructions.md` from the root of any repository.

1. In your integration project, create the file:
   ```bash
   mkdir -p .github
   curl -o .github/copilot-instructions.md \
     https://raw.githubusercontent.com/patricksponte/ft-skill/main/platforms/copilot-instructions.md
   ```
2. Commit and push:
   ```bash
   git add .github/copilot-instructions.md
   git commit -m "Add FieldTwin AI Agent Toolkit for GitHub Copilot"
   git push
   ```
3. The agent toolkit is now active for **everyone** working on that repository — no per-user setup needed.

> For the VS Code Copilot Chat panel, you can also open the command palette → **GitHub Copilot: Edit Settings** and point to the file manually.

</details>

<details>
<summary><strong>Cursor / Windsurf</strong></summary>

**Best file:** `platforms/.cursorrules`

Both Cursor and Windsurf automatically read `.cursorrules` from the project root.

1. Copy the rules file to your integration project root:
   ```bash
   curl -o .cursorrules \
     https://raw.githubusercontent.com/patricksponte/ft-skill/main/platforms/.cursorrules
   ```
2. Restart Cursor or Windsurf if it is already open.
3. No other setup needed — open the AI chat and start asking.

> **Windsurf note:** Windsurf also supports `.windsurfrules` in the project root. You can copy the same file under that name as a fallback.

</details>

<details>
<summary><strong>Cline (VS Code)</strong></summary>

**Best file:** `fieldtwin-instructions.md`

Cline is a VS Code extension that supports custom system prompts per project via `.clinerules`.

1. Install the [Cline extension](https://marketplace.visualstudio.com/items?itemName=saoudrizwan.claude-dev) in VS Code.
2. Create a `.clinerules` file in your integration project root:
   ```bash
   curl -o .clinerules \
     https://raw.githubusercontent.com/patricksponte/ft-skill/main/fieldtwin-instructions.md
   ```
3. Cline will automatically inject `.clinerules` as a system prompt for every conversation in that workspace.

> **Alternative:** In the Cline panel, click the **⚙ Settings** icon → **Custom Instructions** and paste the contents of `api-quick-reference.md` for a global (non-project) setup.

</details>

<details>
<summary><strong>Continue.dev</strong></summary>

**Best file:** `fieldtwin-instructions.md` or `platforms/copilot-instructions.md`

Continue.dev is an open-source AI coding assistant for VS Code and JetBrains. It supports custom system prompts and context documents.

**Option A — System prompt (recommended):**

Edit `.continue/config.json` in your project (or `~/.continue/config.json` globally):

```json
{
  "models": [...],
  "systemMessage": "PASTE THE CONTENTS OF fieldtwin-instructions.md HERE"
}
```

**Option B — Context document:**

Add the raw GitHub URL as a documentation source so Continue.dev can fetch it on demand:

```json
{
  "docs": [
    {
      "title": "FieldTwin Integration API",
      "startUrl": "https://raw.githubusercontent.com/patricksponte/ft-skill/main/fieldtwin-instructions.md",
      "rootUrl": "https://raw.githubusercontent.com/patricksponte/ft-skill/main/"
    }
  ]
}
```

Then type `@FieldTwin` in the Continue.dev chat to include the reference in any message.

</details>

<details>
<summary><strong>JetBrains AI Assistant</strong></summary>

**Best file:** `platforms/copilot-instructions.md`

JetBrains AI Assistant (available in IntelliJ IDEA, PyCharm, WebStorm, etc.) supports custom prompts via the IDE settings.

1. Open **Settings → Tools → AI Assistant → Prompt Library**.
2. Click **+** to create a new prompt.
3. Name it `FieldTwin Agent` and paste the contents of `platforms/copilot-instructions.md`.
4. Save the prompt.
5. In the AI chat panel, type `/FieldTwin Agent` at the start of a conversation to activate it.

> **Alternative:** For a per-project setup, some versions of JetBrains AI Assistant read `.jb-ai-instructions.md` from the project root — paste the contents of `platforms/copilot-instructions.md` into that file.

</details>

---

### CLI Tools

<details>
<summary><strong>Claude Code</strong></summary>

**Best file:** `fieldtwin-instructions.md` + `api-reference.json`

1. Clone or download this repository.
2. Copy the agent file to your integration project:
   ```bash
   mkdir -p .claude/skills
   cp /path/to/fieldtwin-ai-agent-toolkit/platforms/claude-code.md .claude/skills/fieldtwin.md
   ```
3. Copy the full reference for inline access:
   ```bash
   cp /path/to/fieldtwin-ai-agent-toolkit/fieldtwin-instructions.md .claude/
   cp /path/to/fieldtwin-ai-agent-toolkit/api-reference.json .claude/
   ```
4. In Claude Code, type `/fieldtwin` to activate the toolkit in any conversation.

> The agent file registers `/fieldtwin` as a slash command. Once activated, Claude Code will use `fieldtwin-instructions.md` and `api-reference.json` as its reference for the entire conversation.

</details>

<details>
<summary><strong>Antigravity CLI</strong></summary>

**Best file:** `platforms/antigravity.md` (copy to `.antigravity.md`)

[Antigravity CLI](https://antigravity.google) (`agy`) is Google's terminal-based AI coding agent and the official replacement for Gemini CLI (discontinued June 18, 2026). It reads `.antigravity.md` from the current project directory automatically — the same pattern as Claude Code's `CLAUDE.md`.

> **Gemini CLI users:** Gemini CLI stopped serving requests on June 18, 2026 for all free, Pro, and Ultra users. Migrate by installing Antigravity CLI and copying `.antigravity.md` instead of `GEMINI.md`. The agent content is identical.

1. Install Antigravity CLI:
   ```bash
   # macOS / Linux
   curl -fsSL https://antigravity.google/cli/install.sh | bash
   # macOS (Homebrew)
   brew install --cask antigravity-cli
   ```
2. Copy the agent file to your integration project:
   ```bash
   curl -o .antigravity.md \
     https://raw.githubusercontent.com/patricksponte/ft-skill/main/platforms/antigravity.md
   ```
3. Optionally copy the full reference and endpoint list:
   ```bash
   curl -o fieldtwin-instructions.md \
     https://raw.githubusercontent.com/patricksponte/ft-skill/main/fieldtwin-instructions.md
   curl -o api-reference.json \
     https://raw.githubusercontent.com/patricksponte/ft-skill/main/api-reference.json
   ```
4. Run `agy` in your project folder — the toolkit is active automatically.

> `.antigravity.md` is loaded as context for every session in that directory. You can commit it to your repository so the whole team gets the toolkit automatically. `GEMINI.md` also works as a backward-compatible fallback.

</details>

<details>
<summary><strong>Aider</strong></summary>

**Best file:** `fieldtwin-instructions.md`

[Aider](https://aider.chat) is a CLI coding assistant. You can inject instructions via a conventions file or by passing a file directly.

**Option A — CONVENTIONS.md (auto-loaded):**

```bash
curl -o CONVENTIONS.md \
  https://raw.githubusercontent.com/patricksponte/ft-skill/main/fieldtwin-instructions.md
```

Aider reads `CONVENTIONS.md` from the current directory automatically on startup.

**Option B — Pass as a read-only context file:**

```bash
aider --read fieldtwin-instructions.md --read api-reference.json
```

**Option C — System prompt flag:**

```bash
aider --system-prompt "$(curl -s https://raw.githubusercontent.com/patricksponte/ft-skill/main/api-quick-reference.md)"
```

</details>

<details>
<summary><strong>OpenCode</strong></summary>

**Best file:** `fieldtwin-instructions.md` + MCP server

[OpenCode](https://opencode.ai) is an open-source terminal-based AI coding agent from the SST team. Its biggest advantage for FieldTwin users is **model flexibility**: you can use Claude, GPT-4o, Gemini, or any model hosted by NVIDIA NIM (Llama, DeepSeek, Qwen, Gemma, Mistral, and more) — all with the same agent file and MCP server. Switch models without changing anything in the agent context.

**Option A — Agent context only (instructions always active):**

1. Install OpenCode:
   ```bash
   curl -fsSL https://opencode.ai/install | bash
   ```
2. Copy the instructions file to your integration project:
   ```bash
   curl -o fieldtwin-instructions.md \
     https://raw.githubusercontent.com/patricksponte/ft-skill/main/fieldtwin-instructions.md
   ```
3. Create `.opencode.json` in your project root:
   ```json
   {
     "$schema": "https://opencode.ai/config.json",
     "instructions": ["fieldtwin-instructions.md"]
   }
   ```
4. Run `opencode` in your project folder — the toolkit is active for every session.

---

**Option B — Custom `/fieldtwin` agent:**

Copy the agent file so a dedicated `fieldtwin` agent is available inside OpenCode:

```bash
mkdir -p .opencode/agents
curl -o .opencode/agents/fieldtwin.md \
  https://raw.githubusercontent.com/patricksponte/ft-skill/main/platforms/opencode.md
```

Switch to the agent inside OpenCode with the `/fieldtwin` command in the prompt.

> The agent defaults to Claude Sonnet. To use a different model, edit the `model:` field in `.opencode/agents/fieldtwin.md` — for example `nvidia/deepseek-r1` or `openrouter/meta-llama/llama-3.3-70b-instruct`.

---

**Option C — Full setup (agent context + MCP server):**

The MCP server gives OpenCode direct access to your live FieldTwin data — no code generation required.

1. Copy the example project config:
   ```bash
   curl -o .opencode.json \
     https://raw.githubusercontent.com/patricksponte/ft-skill/main/platforms/opencode.json
   ```
2. Edit `.opencode.json` and replace:
   - `/ABSOLUTE/PATH/TO/fieldtwin-ai-agent-toolkit/mcp-server/index.js` — absolute path on your machine
   - `your-api-token-here` — your FieldTwin API Token (Settings → API Tokens)
   - `FIELDTWIN_BACKEND_URL` — your FieldTwin backend URL
3. Install MCP server dependencies (once):
   ```bash
   cd /path/to/fieldtwin-ai-agent-toolkit/mcp-server && npm install
   ```
4. Run `opencode` — the FieldTwin tools are available to any model you choose.

> The `instructions` field and the `mcp` block can coexist in the same `.opencode.json`. Use both together for the best experience: the agent toolkit teaches the model FieldTwin patterns, and the MCP server lets it act on your live data.

</details>

---

### Web AI

<details>
<summary><strong>Claude.ai Projects</strong></summary>

**Best file:** `fieldtwin-instructions.md`

Claude.ai Projects let you define a persistent system prompt and attach files that stay active across all conversations in that project.

1. Go to [claude.ai](https://claude.ai) and click **Projects → New Project**.
2. Name it `FieldTwin Development`.
3. Under **Project Instructions**, paste the contents of `fieldtwin-instructions.md`.
4. Under **Project Knowledge**, upload `api-reference.json`.
5. Every new conversation in this project will have the toolkit active automatically.

> **Context window tip:** Claude supports large context windows, so you can paste the full `fieldtwin-instructions.md` without truncating it.

</details>

<details>
<summary><strong>ChatGPT Custom GPT</strong></summary>

**Best file:** `fieldtwin-instructions.md`

1. Go to [chat.openai.com](https://chat.openai.com) → **Explore GPTs → Create**.
2. In the **Instructions** field, paste the contents of `fieldtwin-instructions.md`.
3. Under **Knowledge**, upload `api-reference.json` as a reference file.
4. Name it `FieldTwin Assistant` and save.
5. Use this Custom GPT for all FieldTwin development work.

> **No Custom GPT plan?** Start any conversation with:
> ```
> I'm sharing instructions for a FieldTwin integration agent. Please follow them for this conversation:
>
> [paste contents of api-quick-reference.md]
> ```

</details>

<details>
<summary><strong>ChatGPT Projects</strong></summary>

**Best file:** `fieldtwin-instructions.md`

ChatGPT Projects (available on Plus/Pro) let you define custom instructions scoped to a project.

1. Go to [chat.openai.com](https://chat.openai.com) → **Projects → New Project**.
2. Click the project name → **Customize** → **Instructions**.
3. Paste the contents of `fieldtwin-instructions.md`.
4. Upload `api-reference.json` as a project file (click the paperclip icon in the project sidebar).
5. All chats in this project will have the toolkit active.

</details>

<details>
<summary><strong>Gemini Gems</strong></summary>

**Best file:** `platforms/copilot-instructions.md`

1. Go to [gemini.google.com](https://gemini.google.com) → **Gems → New Gem**.
2. Name it `FieldTwin Assistant`.
3. In the **Instructions** field, paste the contents of `platforms/copilot-instructions.md`.
4. Save the Gem and use it for FieldTwin development.

> **Context limit note:** Gemini Gems have a system prompt character limit. If the instructions are truncated, use `api-quick-reference.md` instead, which is more compact.

</details>

<details>
<summary><strong>Google AI Studio</strong></summary>

**Best file:** `fieldtwin-instructions.md`

Google AI Studio lets you create prompts with a persistent system instruction and test them with any Gemini model.

1. Go to [aistudio.google.com](https://aistudio.google.com) → **Create new prompt**.
2. In the **System instructions** field, paste the contents of `fieldtwin-instructions.md`.
3. Upload `api-reference.json` as a file attachment (click the paperclip icon).
4. Save as a **Saved prompt** named `FieldTwin Agent`.
5. Use this prompt as your starting point for all FieldTwin work.

> AI Studio also supports sharing prompts via URL — share yours with your team to give everyone the same starting point.

</details>

<details>
<summary><strong>Mistral Le Chat</strong></summary>

**Best file:** `api-quick-reference.md`

[Le Chat](https://chat.mistral.ai) by Mistral supports custom assistants with system prompts.

1. Go to [chat.mistral.ai](https://chat.mistral.ai) → **Assistants → New Assistant**.
2. Name it `FieldTwin Assistant`.
3. In the **System prompt** field, paste the contents of `api-quick-reference.md`.
4. Save and use the assistant for FieldTwin work.

> **Ad-hoc use:** Start any Le Chat conversation by pasting `api-quick-reference.md` as the first message.

</details>

<details>
<summary><strong>Amazon Q Developer</strong></summary>

**Best file:** `platforms/copilot-instructions.md`

Amazon Q Developer (available in VS Code, JetBrains, and the AWS console) supports workspace context through a `.amazonq` folder.

1. In your integration project, create the instructions file:
   ```bash
   mkdir -p .amazonq
   curl -o .amazonq/rules.md \
     https://raw.githubusercontent.com/patricksponte/ft-skill/main/platforms/copilot-instructions.md
   ```
2. Amazon Q Developer will include this file as context in inline suggestions and chat responses.
3. In the Q chat panel, you can also type `/dev` followed by your question to use the full context.

</details>

---

### Local Models

> **Model recommendations for best results:**
> - Code tasks: `deepseek-coder-v2`, `qwen2.5-coder:32b`, `codestral`
> - General: `llama3.1:70b`, `mistral-large`, `gemma3:27b`
> - Low RAM: `qwen2.5-coder:7b`, `llama3.2:3b` with `api-quick-reference.md`

<details>
<summary><strong>Ollama + Open WebUI</strong></summary>

**Best file:** `fieldtwin-instructions.md` or `api-quick-reference.md` depending on the model's context window.

**Open WebUI (recommended UI for Ollama):**

1. Install [Ollama](https://ollama.com) and pull a model:
   ```bash
   ollama pull qwen2.5-coder:32b
   ```
2. Install [Open WebUI](https://openwebui.com):
   ```bash
   docker run -d -p 3000:80 --add-host=host.docker.internal:host-gateway \
     -v open-webui:/app/backend/data ghcr.io/open-webui/open-webui:main
   ```
3. Open `http://localhost:3000` → **Workspace → Modelfiles → New Modelfile**.
4. Create a Modelfile for FieldTwin:
   ```
   FROM qwen2.5-coder:32b
   SYSTEM """
   PASTE THE CONTENTS OF fieldtwin-instructions.md HERE
   """
   ```
5. Save as `fieldtwin-dev` and select it in any chat.

**Ollama CLI (direct):**

```bash
cat > Modelfile << 'EOF'
FROM qwen2.5-coder:32b
SYSTEM """
$(curl -s https://raw.githubusercontent.com/patricksponte/ft-skill/main/api-quick-reference.md)
"""
EOF

ollama create fieldtwin-dev -f Modelfile
ollama run fieldtwin-dev
```

**Ollama API (for integrating with other tools):**

```bash
curl http://localhost:11434/api/chat -d '{
  "model": "qwen2.5-coder:32b",
  "messages": [
    {"role": "system", "content": "PASTE api-quick-reference.md CONTENTS HERE"},
    {"role": "user",   "content": "Build me a FieldTwin integration that lists all assets"}
  ]
}'
```

</details>

<details>
<summary><strong>LM Studio</strong></summary>

**Best file:** `api-quick-reference.md` (for most models) or `fieldtwin-instructions.md` (for models with 32k+ context)

1. Install [LM Studio](https://lmstudio.ai) and download a model (recommended: `Qwen2.5-Coder-32B-Instruct`).
2. In the **Chat** tab, click the **System Prompt** field at the top.
3. Paste the contents of `fieldtwin-instructions.md` (or `api-quick-reference.md` for smaller models).
4. Start chatting — the toolkit is active for this session.

**For persistent setup:**

1. Go to **My Models → Edit Preset** for your chosen model.
2. In **System Prompt**, paste the instructions.
3. Save the preset. The toolkit will be loaded every time you use that preset.

**LM Studio local server (OpenAI-compatible API):**

```python
from openai import OpenAI

client = OpenAI(base_url="http://localhost:1234/v1", api_key="lm-studio")
system_prompt = open("api-quick-reference.md").read()

response = client.chat.completions.create(
    model="qwen2.5-coder-32b",
    messages=[
        {"role": "system", "content": system_prompt},
        {"role": "user",   "content": "Build a FieldTwin integration that shows selected assets"}
    ]
)
print(response.choices[0].message.content)
```

Any local model you load in LM Studio (Llama 3, DeepSeek, Qwen, Gemma, Mistral, etc.) will have access to all 105 FieldTwin tools — as long as the model supports tool calling (most 7B+ models do).

</details>

<details>
<summary><strong>Jan.ai</strong></summary>

**Best file:** `api-quick-reference.md`

[Jan.ai](https://jan.ai) is an open-source local AI assistant with a ChatGPT-like interface.

1. Install Jan.ai and download a model from the Hub (recommended: `Qwen2.5-Coder-7B-Instruct` or `Codestral-22B`).
2. Go to **Settings → My Models → [your model] → Edit**.
3. In the **System Prompt** field, paste the contents of `api-quick-reference.md`.
4. Save — the toolkit is now active every time you use that model in Jan.

**Jan API (OpenAI-compatible):**

```bash
curl http://localhost:1337/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen2.5-coder-7b-instruct",
    "messages": [
      {"role": "system", "content": "PASTE api-quick-reference.md CONTENTS HERE"},
      {"role": "user",   "content": "How do I listen for asset selection in FieldTwin?"}
    ]
  }'
```

</details>

<details>
<summary><strong>AnythingLLM</strong></summary>

**Best file:** `fieldtwin-instructions.md` + `api-reference.json`

[AnythingLLM](https://anythingllm.com) supports workspaces with custom system prompts and document ingestion — ideal for this toolkit.

1. Install AnythingLLM (Desktop or Docker) and connect it to Ollama, LM Studio, or any OpenAI-compatible backend.
2. Create a **New Workspace** named `FieldTwin`.
3. In **Workspace Settings → Prompt**, set the **System Prompt** to the contents of `fieldtwin-instructions.md`.
4. In the workspace **Documents** section, upload `api-reference.json` — AnythingLLM will chunk and embed it for RAG.
5. Start chatting in the `FieldTwin` workspace.

> **RAG tip:** Uploading `api-reference.json` as a document lets AnythingLLM retrieve specific endpoints even when they don't fit in the active context window.

</details>

<details>
<summary><strong>Aider with Local Models</strong></summary>

**Best file:** `fieldtwin-instructions.md` via `CONVENTIONS.md`

Aider works with any OpenAI-compatible API, including Ollama and LM Studio.

```bash
# With Ollama
aider --model ollama/qwen2.5-coder:32b \
      --read fieldtwin-instructions.md \
      --read api-reference.json

# With LM Studio
aider --openai-api-base http://localhost:1234/v1 \
      --openai-api-key lm-studio \
      --model openai/qwen2.5-coder-32b \
      --read fieldtwin-instructions.md

# With CONVENTIONS.md (auto-loaded, no flag needed)
cp fieldtwin-instructions.md CONVENTIONS.md
aider --model ollama/qwen2.5-coder:32b
```

</details>

<details>
<summary><strong>Continue.dev with Local Models</strong></summary>

Continue.dev works with Ollama, LM Studio, and any OpenAI-compatible server.

Edit `~/.continue/config.json`:

```json
{
  "models": [
    {
      "title": "FieldTwin Dev (Ollama)",
      "provider": "ollama",
      "model": "qwen2.5-coder:32b",
      "systemMessage": "PASTE THE CONTENTS OF fieldtwin-instructions.md HERE"
    },
    {
      "title": "FieldTwin Dev (LM Studio)",
      "provider": "openai",
      "apiBase": "http://localhost:1234/v1",
      "apiKey": "lm-studio",
      "model": "qwen2.5-coder-32b",
      "systemMessage": "PASTE THE CONTENTS OF api-quick-reference.md HERE"
    }
  ]
}
```

Restart VS Code after saving. The toolkit-enabled model will appear in the Continue.dev model picker.

</details>

---

## MCP Server (Advanced)

The MCP (Model Context Protocol) server gives any compatible AI client **direct access to your FieldTwin data** — no code generation required. Instead of asking the AI to write API calls for you to run, it can execute them directly and show you live results in the conversation.

<details>
<summary><strong>Agent Toolkit vs MCP Server — which one do I need?</strong></summary>

| | Agent Toolkit | MCP Server |
|---|---|---|
| **What it does** | Teaches the AI how to write FieldTwin integration code | Gives the AI tools to call the FieldTwin API directly |
| **Who runs the code** | You (AI writes it, you run it) | The AI (executes API calls autonomously) |
| **Output** | Working code you can put in your integration | Live data from your FieldTwin account |
| **Best for** | Building new integrations | Querying data, bulk changes, exploring your project |
| **Requires** | Any AI assistant | A MCP-compatible client + Node.js + FieldTwin API Token |
| **Works offline** | Yes (just instructions) | No (makes real API calls) |

**Use the Agent Toolkit when you want code.** Use the MCP server when you want the AI to query or act on your live FieldTwin data directly. Both can be active at the same time — they complement each other.

</details>

**Requirements:**
- [Node.js](https://nodejs.org) 18 or later
- A FieldTwin **API Token** (Settings → API Tokens)
- A MCP-compatible client:

| Client | Models you can use | MCP support |
|---|---|---|
| **Claude Code** | Claude | Native |
| **Cursor** | GPT-4o, Claude, Gemini, DeepSeek, any | Yes |
| **Windsurf** | GPT-4o, Claude, Gemini, any | Yes |
| **Cline** (VS Code) | Any model via API key | Yes |
| **Continue.dev** | Ollama, LM Studio, any OpenAI-compat. | Yes |
| **Antigravity CLI** | Gemini | Yes |
| **OpenCode** | Claude, GPT-4o, Gemini, DeepSeek, Llama, 75+ providers | Yes |
| **LM Studio** | Llama, Qwen, DeepSeek, Gemma, any local | Yes (v0.3.5+) |
| **AnythingLLM** | Any local or cloud model | Yes |

> The API Token is **not** the same as the JWT token from the `loaded` event. It is account-level and stays on your machine — never put it in your integration's HTML/JS code.

**Step 0 — Install dependencies (run once):**

```bash
cd mcp-server && npm install
```

---

<details>
<summary><strong>Setup — Claude Code</strong></summary>

Create or edit `.claude/settings.json` in your project directory. For a global setup (available in all projects), use `~/.claude/settings.json` instead.

```json
{
  "mcpServers": {
    "fieldtwin": {
      "command": "node",
      "args": ["/absolute/path/to/fieldtwin-ai-agent-toolkit/mcp-server/index.js"],
      "env": {
        "FIELDTWIN_BACKEND_URL": "https://backend.fieldtwin.com",
        "FIELDTWIN_API_TOKEN": "your-api-token-here",
        "FIELDTWIN_SUBPROJECT_ID": "optional-default-subproject-id"
      }
    }
  }
}
```

Replace `/absolute/path/to/fieldtwin-ai-agent-toolkit` with the actual path on your machine. Restart Claude Code after saving.

</details>

<details>
<summary><strong>Setup — Cursor</strong></summary>

Cursor reads MCP servers from `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (per-project). You can also add them via **Cursor Settings → MCP → Add server**.

```json
{
  "mcpServers": {
    "fieldtwin": {
      "command": "node",
      "args": ["/absolute/path/to/fieldtwin-ai-agent-toolkit/mcp-server/index.js"],
      "env": {
        "FIELDTWIN_BACKEND_URL": "https://backend.fieldtwin.com",
        "FIELDTWIN_API_TOKEN": "your-api-token-here",
        "FIELDTWIN_SUBPROJECT_ID": "optional-default-subproject-id"
      }
    }
  }
}
```

Once configured, any model in Cursor (GPT-4o, Claude, Gemini, DeepSeek, etc.) will have access to the FieldTwin tools.

</details>

<details>
<summary><strong>Setup — LM Studio</strong></summary>

LM Studio 0.3.5+ supports MCP natively.

1. Open LM Studio → click the **Developer** tab (or plug icon in the sidebar).
2. Select **MCP Servers → Add server**.
3. Fill in:
   - **Name:** `fieldtwin`
   - **Command:** `node`
   - **Args:** `/absolute/path/to/fieldtwin-ai-agent-toolkit/mcp-server/index.js`
   - **Environment variables:** `FIELDTWIN_BACKEND_URL`, `FIELDTWIN_API_TOKEN`, `FIELDTWIN_SUBPROJECT_ID`
4. Click **Save**. The server starts automatically when you open a chat.

</details>

<details>
<summary><strong>Setup — Antigravity CLI</strong></summary>

Create `.agents/mcp_config.json` in your project root for a workspace-specific setup. For a global setup (all projects), use `~/.gemini/antigravity-cli/mcp_config.json`.

```json
{
  "mcpServers": {
    "fieldtwin": {
      "command": "node",
      "args": ["/absolute/path/to/fieldtwin-ai-agent-toolkit/mcp-server/index.js"],
      "env": {
        "FIELDTWIN_BACKEND_URL": "https://backend.fieldtwin.com",
        "FIELDTWIN_API_TOKEN": "your-api-token-here",
        "FIELDTWIN_SUBPROJECT_ID": "optional-default-subproject-id"
      }
    }
  }
}
```

Run `agy` in your project folder. Type `/mcp` inside the session to verify the `fieldtwin` server is connected.

</details>

<details>
<summary><strong>Setup — Cline (VS Code)</strong></summary>

1. Open VS Code → click the Cline icon in the sidebar.
2. Click **MCP Servers → Configure MCP Servers**.
3. Add the `fieldtwin` entry to `cline_mcp_settings.json`:

```json
{
  "mcpServers": {
    "fieldtwin": {
      "command": "node",
      "args": ["/absolute/path/to/fieldtwin-ai-agent-toolkit/mcp-server/index.js"],
      "env": {
        "FIELDTWIN_BACKEND_URL": "https://backend.fieldtwin.com",
        "FIELDTWIN_API_TOKEN": "your-api-token-here",
        "FIELDTWIN_SUBPROJECT_ID": "optional-default-subproject-id"
      }
    }
  }
}
```

Save the file. Cline will connect to the server immediately — no restart needed.

</details>

<details>
<summary><strong>Setup — Continue.dev</strong></summary>

Edit `~/.continue/config.json` and add an `mcpServers` block:

```json
{
  "models": [...],
  "mcpServers": [
    {
      "name": "fieldtwin",
      "command": "node",
      "args": ["/absolute/path/to/fieldtwin-ai-agent-toolkit/mcp-server/index.js"],
      "env": {
        "FIELDTWIN_BACKEND_URL": "https://backend.fieldtwin.com",
        "FIELDTWIN_API_TOKEN": "your-api-token-here",
        "FIELDTWIN_SUBPROJECT_ID": "optional-default-subproject-id"
      }
    }
  ]
}
```

Restart VS Code after saving. Continue.dev will expose the FieldTwin tools to whichever model you have active — including local models via Ollama or LM Studio.

</details>

<details>
<summary><strong>Setup — OpenCode</strong></summary>

OpenCode reads MCP configuration from `.opencode.json` in the project root. Copy the template and edit the path and token:

```bash
curl -o .opencode.json \
  https://raw.githubusercontent.com/patricksponte/ft-skill/main/platforms/opencode.json
```

Then edit `.opencode.json`: set the absolute path to `mcp-server/index.js` and your API token. See **OpenCode** in the CLI Tools section above for the full setup walkthrough.

</details>

**Verify (all clients)** — ask your AI:

> "List all my FieldTwin projects"

The AI will call the MCP server and show you live results from your account.

---

<details>
<summary><strong>Available tools (105)</strong></summary>

| Category | Tools |
|---|---|
| **Projects** | `list_projects`, `get_project`, `create_project`, `update_project` |
| **SubProjects** | `list_subprojects`, `get_subproject`, `create_subproject`, `update_subproject`, `delete_subproject`, `get_subproject_hierarchy`, `get_subproject_is_ready`, `get_subproject_share_url`, `get_subproject_tags` |
| **Staged Assets** | `get_staged_assets`, `get_staged_asset`, `create_staged_asset`, `create_staged_assets_batch`, `update_staged_asset`, `delete_staged_asset` |
| **Wells** | `get_wells`, `get_well`, `create_well`, `create_wells_batch`, `update_well`, `delete_well` |
| **Well Bores** | `get_well_bores`, `get_well_bore`, `create_well_bore`, `update_well_bore`, `delete_well_bore`, `get_well_bore_segments`, `update_well_bore_segment`, `delete_well_bore_segment` |
| **Connections** | `get_connections`, `get_connection`, `create_connection`, `create_connections_batch`, `update_connection`, `delete_connection` |
| **Connection Segments** | `get_connection_segments`, `create_connection_segment`, `update_connection_segment`, `delete_connection_segment` |
| **Shapes** | `get_shapes`, `get_shape`, `create_shape`, `create_shapes_batch`, `update_shape`, `delete_shape` |
| **Overlays** | `get_overlays`, `get_overlay`, `create_overlay`, `create_overlays_batch`, `update_overlay` _(no delete — not available in API)_ |
| **Frames** | `get_frames`, `get_frame`, `create_frame`, `update_frame`, `delete_frame` |
| **Annotations** | `get_annotations`, `get_annotation`, `create_annotation`, `update_annotation`, `delete_annotation` |
| **Layers** | `get_layers`, `get_layer`, `create_layer`, `update_layer`, `delete_layer` |
| **Custom Costs** | `get_custom_costs`, `get_custom_cost`, `create_custom_cost`, `create_custom_costs_batch`, `update_custom_cost`, `delete_custom_cost` |
| **Subproject Documents** | `get_subproject_documents`, `upload_subproject_document`, `delete_subproject_document` |
| **Metadata** | `get_metadata_definitions`, `get_account_metadata_definitions`, `get_metadata`, `add_metadata`, `update_metadata`, `delete_metadata` |
| **Type Lookups** | `get_assets`, `get_well_types`, `get_well_bore_types`, `get_annotation_types`, `get_shape_types`, `get_layer_types`, `get_connection_types`, `get_connection_type`, `get_connection_categories`, `get_connection_segment_types`, `get_well_bore_segment_types` |
| **Tags** | `get_tags`, `get_tag`, `create_tag`, `update_tag`, `delete_tag` |
| **Account** | `get_users`, `get_user`, `get_usage`, `get_account_logs`, `get_integrations` |

**Example prompts:**

```
"List all staged assets in subproject abc123"
"How many connections are in my project?"
"Find all assets with status Planned and change them to Installed"
"Create a new well at x=665000, y=400000 named Production Well 1"
"Show me the custom metadata fields defined in this project"
"Delete all staged assets tagged type::temporary"
"What assets are closest to coordinates 665000, 400000?"
```

</details>

<details>
<summary><strong>How the MCP server works internally</strong></summary>

The server runs as a local process via **stdio transport** — your MCP client spawns it automatically. There is no web server, no open port, and no network exposure beyond the calls it makes to the FieldTwin API. All credentials stay in your client's config file, which you should keep out of version control.

```
AI Client  ──stdin/stdout──  mcp-server/index.js  ──HTTPS──  FieldTwin API
```

</details>

---

## Scripts

There are two scripts depending on your situation:

| Script | When to use |
|---|---|
| `create` | Starting a new integration from scratch |
| `install` | Adding the agent toolkit to a project that already exists |

### create — new integration from scratch

Run this script anywhere on your machine. It asks four questions and creates a ready-to-run integration project in the folder of your choice.

**Linux / macOS:**

```bash
curl -sSfL https://raw.githubusercontent.com/patricksponte/ft-skill/main/create.sh | bash
```

**Windows (PowerShell):**

```powershell
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/patricksponte/ft-skill/main/create.ps1" -OutFile create.ps1
.\create.ps1
```

The script asks four questions:

1. **Integration name** — becomes the project folder name
2. **Where to save** — press Enter for the current directory, or type any path
3. **Template** — choose the starting point for your project:
   - **Static page** — a single HTML file, no server needed. Host for free on GitHub Pages.
   - **Node.js** — adds an Express backend so you can use npm packages and external JS libraries.
   - **Python** — adds a FastAPI backend so you can use pip packages and external Python libraries.
4. **AI tools** — which tools to pre-configure (Claude Code, Copilot, Cursor, Cline, Aider, Antigravity CLI, OpenCode)

The Hello World frontend is the same regardless of the template chosen. The backend (Node.js / Python) is where you add your own logic.

**What gets created:**

| File | Description |
|---|---|
| `index.html` | Hello World — open this in FieldTwin to confirm it works |
| `fieldtwin.config.json` | Project metadata |
| `.gitignore` | Ignores `node_modules/`, `.env`, `__pycache__/` |
| `server.js` + `package.json` | Node.js only — run with `npm install && npm start` |
| `app.py` + `requirements.txt` | Python only — run with `pip install -r requirements.txt && python app.py` |
| Agent files | One file per selected AI tool, placed in the right location |

> The script checks what is installed and tells you what to install if anything is missing — it never installs anything automatically.

<details>
<summary><strong>install — add the toolkit to an existing project</strong></summary>

Run this script inside your existing integration project directory.

**Linux / macOS:**

```bash
curl -sSfL https://raw.githubusercontent.com/patricksponte/ft-skill/main/install.sh | bash
```

**Windows (PowerShell):**

```powershell
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/patricksponte/ft-skill/main/install.ps1" -OutFile install.ps1
.\install.ps1
```

> **Windows note:** If PowerShell blocks the script, run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once and retry.

Covers: **Claude Code · GitHub Copilot · Cursor / Windsurf · Cline · Aider · Antigravity CLI · OpenCode**

For each tool: shows what will be installed, asks for confirmation, warns before overwriting existing files.

</details>

---

## Hello World

The Hello World is a single self-contained HTML file. When opened inside FieldTwin as an integration, it:

- Connects to FieldTwin and displays your session info (SubProject ID, Backend URL, Tab ID, API readiness)
- Sends a success toast notification: "Hello from FieldTwin AI Agent Toolkit!"
- Logs every event received from FieldTwin in real time
- Shows which items are currently selected in the 3D view

| Tab | What it does |
|---|---|
| **Session** | Live session info and real-time event log |
| **API Test** | Makes real REST API calls (Assets, Wells, Connections, Shapes, Metadata) and shows the raw JSON response |
| **Troubleshoot** | Runs 8 automated checks with a specific fix for each failure |

**File:** `examples/hello-world/index.html`

**How to run it:**

```bash
# Option A — local server (fastest)
npx serve examples/hello-world
# then open http://localhost:3000 in FieldTwin as an integration
```

Option B — GitHub Pages: enable Pages in your repo settings, then use `https://patricksponte.github.io/ft-skill/examples/hello-world/`

Option C — Any web server: copy `index.html` to your server. The file is completely self-contained.

**How to add it to FieldTwin:**

1. Go to **Admin → Integrations → Create New Tab**
2. Enter a name and the URL
3. Enable: **Use Get Verb Instead of Post** · **Do not pass arguments in URL for Get request** · **Allow Access to Whole Project**
4. Save — you should see "Connected to FieldTwin!"

![FieldTwin integration configuration](docs/images/fieldtwin-integration-config.png)

---

## Repository Structure

```
fieldtwin-ai-agent-toolkit/
│
├── README.md                         ← You are here
├── fieldtwin-instructions.md         ← Full agent reference — large context models
├── api-reference.json                ← All 120+ REST endpoints (v1.10), structured JSON
├── api-quick-reference.md            ← Compact reference — token-limited models
├── create.sh / create.ps1            ← Create a new integration project from scratch
├── install.sh / install.ps1          ← Add the agent toolkit to an existing project
│
├── platforms/
│   ├── claude-code.md          ← Claude Code /fieldtwin command
│   ├── copilot-instructions.md       ← GitHub Copilot, Cline, JetBrains AI
│   ├── antigravity.md                ← Antigravity CLI (copy to .antigravity.md)
│   ├── gemini-cli.md                 ← Gemini CLI legacy (discontinued June 2026)
│   ├── opencode.md                   ← OpenCode agent (copy to .opencode/agents/fieldtwin.md)
│   ├── opencode.json                 ← OpenCode project config template (copy to .opencode.json)
│   └── .cursorrules                  ← Cursor / Windsurf
│
├── mcp-server/
│   ├── index.js                      ← MCP server — 105 tools for direct FieldTwin API access
│   ├── package.json                  ← Node.js dependencies (@modelcontextprotocol/sdk, zod)
│   └── .env.example                  ← Environment variable template
│
└── examples/
    └── hello-world/
        └── index.html                ← Test integration: session info, API test, troubleshooter
```

---

## Example Prompts

**Getting started**
> "Walk me through building my first FieldTwin integration."

**Hello World**
> "Show me the Hello World integration and explain how to run it."

**Selection handling**
> "Build an integration that shows the name and type of whatever the user selects in the 3D view."

**Search integration**
> "Add global search support to my integration. When the user searches, query my REST API and return the results."

**Resource creation**
> "Write code to place a temporary marker at coordinates x=665000, y=400000 when the user clicks a button."

**Visual filters**
> "Add two filter buttons to the FieldTwin search bar: 'Active' and 'Planned'. When toggled, select the matching assets."

**REST API — read**
> "Fetch all staged assets from the current subproject and display them in a list."

**REST API — write**
> "Write code to update the status of a staged asset to 'Installed' using the REST API."

**Metadata**
> "Show me how to read and display custom metadata fields from a selected asset."

**Batch operations**
> "I need to create 50 connections at once. Show me how to use the batch endpoint."

**Troubleshooting**
> "My integration is not receiving the loaded event. Help me debug this."

---

## Contributing

Found something missing or incorrect? Please open an issue or submit a pull request.

For questions about FieldTwin integrations, refer to the [FieldTwin API documentation](https://api.fieldtwin.com).

OpenAPI spec: https://api-qa.fieldtwin.com/oas3.json

---

## License

MIT
