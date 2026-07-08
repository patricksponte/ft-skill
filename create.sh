#!/usr/bin/env bash
# FieldTwin AI Agent Toolkit — Integration Creator (Linux / macOS)
# Creates a new FieldTwin integration project from scratch,
# with the AI Agent Toolkit pre-configured and the Hello World ready to run.

REPO_BASE="https://raw.githubusercontent.com/YOUR_ORG/YOUR_REPO/main"

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
DIM='\033[2m'
NC='\033[0m'

# ── Helpers ───────────────────────────────────────────────────────────────────

download() {
  local src="$1" dst="$2"
  mkdir -p "$(dirname "$dst")"
  if command -v curl &>/dev/null; then
    curl -sSfL "$REPO_BASE/$src" -o "$dst" || { echo -e "  ${RED}Download failed: $src${NC}"; return 1; }
  elif command -v wget &>/dev/null; then
    wget -qO "$dst" "$REPO_BASE/$src" || { echo -e "  ${RED}Download failed: $src${NC}"; return 1; }
  else
    echo -e "  ${RED}Error: curl or wget is required but neither was found.${NC}"
    exit 1
  fi
}

ask() {
  local answer
  printf "  %s [y/N] " "$1"
  read -r answer
  [[ "$answer" =~ ^[Yy]$ ]]
}

separator() { echo -e "${DIM}  ──────────────────────────────────────────────────────${NC}"; }

# ── Header ────────────────────────────────────────────────────────────────────

echo ""
echo -e "${BOLD}  FieldTwin AI Agent Toolkit — Integration Creator${NC}"
separator
echo "  Creates a new FieldTwin integration project on your machine."
echo "  The Hello World will be ready to open in FieldTwin immediately."
separator
echo ""

# ── Step 1 — Project name ─────────────────────────────────────────────────────

echo -e "${BOLD}  Step 1 — Project name${NC}"
echo ""
while true; do
  printf "  Integration name (e.g. my-integration): "
  read -r RAW_NAME
  [[ -n "$RAW_NAME" ]] && break
  echo -e "  ${RED}Name is required.${NC}"
done

PROJECT_FOLDER=$(echo "$RAW_NAME" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | tr -cd '[:alnum:]-_')

if [[ -z "$PROJECT_FOLDER" ]]; then
  echo -e "  ${RED}Invalid name. Use letters, numbers, hyphens, or underscores.${NC}"
  exit 1
fi

echo ""

# ── Step 2 — Save location ────────────────────────────────────────────────────

echo -e "${BOLD}  Step 2 — Save location${NC}"
echo ""
echo -e "  Where should the project be created?"
echo -e "  Press Enter to use the current directory: ${CYAN}$(pwd)${NC}"
echo ""
printf "  Path (or Enter for current directory): "
read -r SAVE_PATH

if [[ -z "$SAVE_PATH" ]]; then
  SAVE_PATH="$(pwd)"
else
  SAVE_PATH="${SAVE_PATH/#\~/$HOME}"  # expand ~ if present
fi

PROJECT_DIR="$SAVE_PATH/$PROJECT_FOLDER"

if [[ -d "$PROJECT_DIR" ]]; then
  echo -e ""
  echo -e "  ${YELLOW}Directory '$PROJECT_DIR' already exists.${NC}"
  if ! ask "Add files into it anyway?"; then
    echo "  Cancelled."
    exit 0
  fi
fi

echo ""

# ── Step 3 — Template ─────────────────────────────────────────────────────────

echo -e "${BOLD}  Step 3 — Template${NC}"
echo ""
echo "  Choose how you want to build this integration:"
echo ""
echo "    [1] Static page  — HTML/JS only. No server needed."
echo "                       Host for free on GitHub Pages."
echo ""
echo "    [2] Node.js      — Adds an Express server so you can install"
echo "                       npm packages and use external JS libraries."
echo ""
echo "    [3] Python       — Adds a FastAPI server so you can install"
echo "                       pip packages and use external Python libraries."
echo ""
echo "  The Hello World frontend is the same for all options."
echo "  The backend (Node.js / Python) is where you add your own logic."
echo ""
printf "  Choose [1/2/3]: "
read -r TEMPLATE_CHOICE

case "$TEMPLATE_CHOICE" in
  2) TEMPLATE="node" ;;
  3) TEMPLATE="python" ;;
  *) TEMPLATE="static" ;;
esac

echo ""

# ── Step 3 — AI tools ─────────────────────────────────────────────────────────

echo -e "${BOLD}  Step 4 — AI tools${NC}"
echo ""
echo "  Which AI tools do you use? agent files will be placed"
echo "  in the right location for each one."
echo ""

AI_TOOLS=()

ask "Claude Code?"       && AI_TOOLS+=("claude-code")
ask "GitHub Copilot?"    && AI_TOOLS+=("copilot")
ask "Cursor / Windsurf?" && AI_TOOLS+=("cursor")
ask "Cline (VS Code)?"   && AI_TOOLS+=("cline")
ask "Aider?"             && AI_TOOLS+=("aider")
ask "Antigravity CLI?"   && AI_TOOLS+=("antigravity")
ask "OpenCode?"          && AI_TOOLS+=("opencode")

echo ""

# ── Create project ────────────────────────────────────────────────────────────

separator
echo -e "  Creating ${BOLD}${CYAN}$PROJECT_DIR${NC} ..."
separator
echo ""

mkdir -p "$PROJECT_DIR"

# Hello World
download "examples/hello-world/index.html" "$PROJECT_DIR/index.html" \
  && echo -e "  ${GREEN}✓${NC} index.html"

# fieldtwin.config.json
cat > "$PROJECT_DIR/fieldtwin.config.json" << EOF
{
  "name": "$RAW_NAME",
  "version": "1.0.0",
  "template": "$TEMPLATE"
}
EOF
echo -e "  ${GREEN}✓${NC} fieldtwin.config.json"

# .gitignore
cat > "$PROJECT_DIR/.gitignore" << 'EOF'
node_modules/
.env
.env.local
__pycache__/
*.pyc
EOF
echo -e "  ${GREEN}✓${NC} .gitignore"

# Backend files
case "$TEMPLATE" in
  node)
    download "templates/node/server.js"    "$PROJECT_DIR/server.js"    && echo -e "  ${GREEN}✓${NC} server.js"
    download "templates/node/package.json" "$PROJECT_DIR/package.json" && echo -e "  ${GREEN}✓${NC} package.json"
    ;;
  python)
    download "templates/python/app.py"           "$PROJECT_DIR/app.py"           && echo -e "  ${GREEN}✓${NC} app.py"
    download "templates/python/requirements.txt" "$PROJECT_DIR/requirements.txt" && echo -e "  ${GREEN}✓${NC} requirements.txt"
    ;;
esac

# ── AI Agent Toolkit files ────────────────────────────────────────────────────────────

if [[ ${#AI_TOOLS[@]} -gt 0 ]]; then
  echo ""
  echo -e "  ${DIM}AI Agent Toolkit files:${NC}"
  echo ""

  for tool in "${AI_TOOLS[@]}"; do
    case "$tool" in
      claude-code)
        download "platforms/claude-code.md"  "$PROJECT_DIR/.claude/skills/fieldtwin.md" \
        && download "fieldtwin-instructions.md"    "$PROJECT_DIR/.claude/fieldtwin-instructions.md" \
        && download "api-reference.json"           "$PROJECT_DIR/.claude/api-reference.json" \
        && echo -e "  ${GREEN}✓${NC} Claude Code  (.claude/)"
        ;;
      copilot)
        download "platforms/copilot-instructions.md" "$PROJECT_DIR/.github/copilot-instructions.md" \
        && echo -e "  ${GREEN}✓${NC} GitHub Copilot  (.github/copilot-instructions.md)"
        ;;
      cursor)
        download "platforms/.cursorrules" "$PROJECT_DIR/.cursorrules" \
        && echo -e "  ${GREEN}✓${NC} Cursor / Windsurf  (.cursorrules)"
        ;;
      cline)
        download "fieldtwin-instructions.md" "$PROJECT_DIR/.clinerules" \
        && echo -e "  ${GREEN}✓${NC} Cline  (.clinerules)"
        ;;
      aider)
        download "fieldtwin-instructions.md" "$PROJECT_DIR/CONVENTIONS.md" \
        && echo -e "  ${GREEN}✓${NC} Aider  (CONVENTIONS.md)"
        ;;
      antigravity)
        download "platforms/antigravity.md" "$PROJECT_DIR/.antigravity.md" \
        && echo -e "  ${GREEN}✓${NC} Antigravity CLI  (.antigravity.md)"
        ;;
      opencode)
        download "platforms/opencode.md"   "$PROJECT_DIR/.opencode/agents/fieldtwin.md" \
        && download "platforms/opencode.json" "$PROJECT_DIR/.opencode.json" \
        && echo -e "  ${GREEN}✓${NC} OpenCode  (.opencode/)"
        echo -e "    ${YELLOW}→ Edit .opencode.json: set mcp-server path and API token${NC}"
        ;;
    esac
  done
fi

# ── Git init ──────────────────────────────────────────────────────────────────

echo ""
if ask "Initialize a git repository?"; then
  git -C "$PROJECT_DIR" init -q \
  && git -C "$PROJECT_DIR" add . \
  && git -C "$PROJECT_DIR" commit -q -m "Initial commit" \
  && echo -e "  ${GREEN}✓${NC} Git repository initialized"
fi

# ── Summary ───────────────────────────────────────────────────────────────────

echo ""
separator
echo -e "${BOLD}  Done! Your integration is ready.${NC}"
separator
echo ""
echo -e "  Location: ${CYAN}$PROJECT_DIR${NC}"
echo ""
echo "  Next steps:"
echo ""
echo "  1. Open the project in your AI-enabled editor"
echo ""

case "$TEMPLATE" in
  node)
    echo "  2. Install dependencies and start the server:"
    echo -e "     ${CYAN}cd \"$PROJECT_DIR\" && npm install && npm start${NC}"
    echo ""
    echo "  3. In FieldTwin: Admin → Integrations → Create New Tab"
    echo "     Use http://localhost:3000 as the URL"
    echo ""
    echo "  4. Add your logic in server.js — install any npm package you need."
    ;;
  python)
    echo "  2. Install dependencies and start the server:"
    echo -e "     ${CYAN}cd \"$PROJECT_DIR\" && pip install -r requirements.txt && python app.py${NC}"
    echo ""
    echo "  3. In FieldTwin: Admin → Integrations → Create New Tab"
    echo "     Use http://localhost:3000 as the URL"
    echo ""
    echo "  4. Add your logic in app.py — install any pip package you need."
    ;;
  *)
    echo "  2. In FieldTwin: Admin → Integrations → Create New Tab"
    echo "     Use your hosted URL (e.g. GitHub Pages)."
    ;;
esac

echo ""
echo -e "  Open the integration in FieldTwin — you should see ${GREEN}Connected to FieldTwin!${NC}"
echo ""
echo -e "  ${DIM}Source: $REPO_BASE${NC}"
echo ""
