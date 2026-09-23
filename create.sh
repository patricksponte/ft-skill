#!/usr/bin/env bash
# FieldTwin AI Agent Toolkit — Integration Creator (Linux / macOS)
# Creates a new FieldTwin integration project from scratch,
# with the AI Agent Toolkit pre-configured and the Hello World ready to run.

REPO_BASE="https://raw.githubusercontent.com/patricksponte/ft-skill/main"
ARCHIVE_URL="https://codeload.github.com/patricksponte/ft-skill/tar.gz/refs/heads/main"
HELLO_WORLD="skills/create-fieldtwin-integration/assets/hello-world/index.html"
SKILLS=(create-fieldtwin-integration develop-fieldtwin-integration)

# Allow interactive input even when piped via curl | bash
exec < /dev/tty

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

# Install the canonical Agent Skills (skills/<name>/SKILL.md + references) into a directory.
install_skills() {
  local dest="$1" tmp root skill
  tmp="$(mktemp -d)" || return 1
  if command -v curl &>/dev/null; then
    curl -sSfL "$ARCHIVE_URL" | tar -xz -C "$tmp"
  else
    wget -qO- "$ARCHIVE_URL" | tar -xz -C "$tmp"
  fi || { rm -rf "$tmp"; echo -e "  ${RED}Download failed: skills archive${NC}"; return 1; }
  root="$(find "$tmp" -mindepth 1 -maxdepth 1 -type d | head -1)"
  mkdir -p "$dest"
  for skill in "${SKILLS[@]}"; do
    if [[ ! -f "$root/skills/$skill/SKILL.md" ]]; then
      rm -rf "$tmp"; echo -e "  ${RED}Skill missing from archive: $skill${NC}"; return 1
    fi
    rm -rf "${dest:?}/$skill"
    cp -R "$root/skills/$skill" "$dest/$skill"
  done
  rm -rf "$tmp"
}

# ── Prerequisite check — curl or wget ────────────────────────────────────────

if ! command -v curl &>/dev/null && ! command -v wget &>/dev/null; then
  echo ""
  echo -e "  ${RED}Error: curl or wget is required to download files.${NC}"
  echo ""
  echo "  Install one of them and run this script again:"
  echo "    macOS:  brew install curl"
  echo "    Ubuntu: sudo apt install curl"
  echo ""
  exit 1
fi

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

# Prerequisite check — Node.js / Python
if [[ "$TEMPLATE" == "node" ]]; then
  if ! command -v node &>/dev/null || ! command -v npm &>/dev/null; then
    echo ""
    echo -e "  ${RED}Error: Node.js and npm are required for this template.${NC}"
    echo ""
    echo "  Install Node.js (includes npm) from https://nodejs.org"
    echo "  Then run this script again."
    echo ""
    exit 1
  fi
fi

if [[ "$TEMPLATE" == "python" ]]; then
  if ! command -v python3 &>/dev/null && ! command -v python &>/dev/null; then
    echo ""
    echo -e "  ${RED}Error: Python is required for this template.${NC}"
    echo ""
    echo "  Install Python from https://python.org"
    echo "  Then run this script again."
    echo ""
    exit 1
  fi
  if ! command -v pip3 &>/dev/null && ! command -v pip &>/dev/null; then
    echo ""
    echo -e "  ${RED}Error: pip is required for this template.${NC}"
    echo ""
    echo "  pip is usually included with Python. If missing:"
    echo "    python3 -m ensurepip --upgrade"
    echo "  Then run this script again."
    echo ""
    exit 1
  fi
fi

echo ""

# ── Step 4 — FieldTwin address ────────────────────────────────────────────────

echo -e "${BOLD}  Step 4 — FieldTwin address${NC}"
echo ""
echo "  The integration only accepts messages from your exact FieldTwin origin."
echo "  Copy it from the browser address bar while FieldTwin is open."
echo -e "  ${DIM}Example: https://yourcompany.fieldtwin.com   (Enter to set it later)${NC}"
echo ""
FIELDTWIN_ORIGIN=""
while true; do
  printf "  FieldTwin address: "
  read -r FIELDTWIN_ORIGIN
  if [[ -z "$FIELDTWIN_ORIGIN" ]]; then
    echo -e "  ${YELLOW}Skipped. Edit ALLOWED_FIELDTWIN_ORIGINS in index.html before opening it in FieldTwin.${NC}"
    break
  fi
  # Keep only scheme://host[:port]; drop any path or query. Only https is accepted.
  FIELDTWIN_ORIGIN="$(printf '%s' "$FIELDTWIN_ORIGIN" | sed -E 's#^(https://[^/?]+).*#\1#')"
  if [[ "$FIELDTWIN_ORIGIN" =~ ^https://[A-Za-z0-9.-]+(:[0-9]{1,5})?$ ]]; then
    echo -e "  ${GREEN}Allowed origin: $FIELDTWIN_ORIGIN${NC}"
    break
  fi
  FIELDTWIN_ORIGIN=""
  echo -e "  ${RED}Use an https:// address such as https://yourcompany.fieldtwin.com${NC}"
done

echo ""

# ── Step 5 — AI tools ─────────────────────────────────────────────────────────

echo -e "${BOLD}  Step 5 — AI tools${NC}"
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

# Hello World — a static page is served from the project root; the Node/Python servers serve public/ only
if [[ "$TEMPLATE" == "static" ]]; then PAGE="index.html"; else PAGE="public/index.html"; fi
if download "$HELLO_WORLD" "$PROJECT_DIR/$PAGE"; then
  if [[ -n "$FIELDTWIN_ORIGIN" ]]; then
    sed -i.bak -E "s#^      'https://fieldtwin\.example',\$#      '${FIELDTWIN_ORIGIN}',#" "$PROJECT_DIR/$PAGE" \
      && rm -f "$PROJECT_DIR/$PAGE.bak"
  fi
  echo -e "  ${GREEN}✓${NC} $PAGE"
fi

# Updater script
download "update.sh" "$PROJECT_DIR/update.sh" \
  && chmod +x "$PROJECT_DIR/update.sh" \
  && echo -e "  ${GREEN}✓${NC} update.sh  (run anytime to refresh agent files)"

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
.venv/
.claude/settings.local.json
EOF
echo -e "  ${GREEN}✓${NC} .gitignore"

# Server environment example (origins for CSP frame-ancestors)
if [[ "$TEMPLATE" != "static" ]]; then
  printf 'FIELDTWIN_ORIGINS=%s\n' "${FIELDTWIN_ORIGIN:-https://yourcompany.fieldtwin.com}" > "$PROJECT_DIR/.env.example"
  echo -e "  ${GREEN}✓${NC} .env.example"
fi

# Backend files
case "$TEMPLATE" in
  node)
    download "templates/node/server.js"    "$PROJECT_DIR/server.js"    && echo -e "  ${GREEN}✓${NC} server.js"
    download "templates/node/package.json" "$PROJECT_DIR/package.json" && echo -e "  ${GREEN}✓${NC} package.json"
    ;;
  python)
    download "templates/python/app.py"           "$PROJECT_DIR/app.py"           && echo -e "  ${GREEN}✓${NC} app.py"
    download "templates/python/requirements.txt" "$PROJECT_DIR/requirements.txt" && echo -e "  ${GREEN}✓${NC} requirements.txt"
    PY=$(command -v python3 || command -v python)
    "$PY" -m venv "$PROJECT_DIR/.venv" && echo -e "  ${GREEN}✓${NC} .venv/  (virtual environment)"
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
        install_skills "$PROJECT_DIR/.claude/skills" \
        && echo -e "  ${GREEN}✓${NC} Claude Code  (.claude/skills/: ${SKILLS[*]})"
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
        echo -e "    ${YELLOW}→ Edit .opencode.json: set the packages/fieldtwin-mcp path and API token${NC}"
        ;;
    esac
  done
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
    echo -e "     ${CYAN}cd \"$PROJECT_DIR\" && npm install && FIELDTWIN_ORIGINS=${FIELDTWIN_ORIGIN:-<your-fieldtwin-origin>} npm start${NC}"
    echo ""
    echo "  3. In FieldTwin: Admin → Integrations → Create New Tab"
    echo "     Use http://localhost:3000 as the URL"
    echo ""
    echo "  4. Add your logic in server.js; the page lives in public/index.html."
    ;;
  python)
    echo "  2. Activate the virtual environment and install dependencies:"
    echo -e "     ${CYAN}cd \"$PROJECT_DIR\"${NC}"
    echo -e "     ${CYAN}source .venv/bin/activate${NC}"
    echo -e "     ${CYAN}pip install -r requirements.txt${NC}"
    echo ""
    echo "  3. Start the server:"
    echo -e "     ${CYAN}FIELDTWIN_ORIGINS=${FIELDTWIN_ORIGIN:-<your-fieldtwin-origin>} python app.py${NC}"
    echo ""
    echo "  4. In FieldTwin: Admin → Integrations → Create New Tab"
    echo "     Use http://localhost:3000 as the URL"
    echo ""
    echo "  5. Add your logic in app.py; the page lives in public/index.html."
    ;;
  *)
    echo "  2. Host index.html over HTTPS (for example GitHub Pages), then"
    echo "     in FieldTwin: Admin → Integrations → Create New Tab with that URL."
    ;;
esac

echo ""
echo "  In the FieldTwin tab settings, enable \"Use GET verb\" and"
echo "  \"Do not pass arguments in URL\". Grant only the access you need."
if [[ -z "$FIELDTWIN_ORIGIN" ]]; then
  echo -e "  ${YELLOW}Remember: set ALLOWED_FIELDTWIN_ORIGINS in $PAGE to your FieldTwin address.${NC}"
fi

echo ""
echo -e "  Open the integration in FieldTwin — you should see ${GREEN}Connected to FieldTwin!${NC}"
echo ""
echo -e "  ${DIM}Source: $REPO_BASE${NC}"
echo ""
