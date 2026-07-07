#!/usr/bin/env bash
# FieldTwin AI Skill — Integration Creator (Linux / macOS)
# Creates a new FieldTwin integration project from scratch,
# with the AI skill pre-configured and the Hello World ready to run.

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
echo -e "${BOLD}  FieldTwin AI Skill — Integration Creator${NC}"
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

PROJECT_DIR=$(echo "$RAW_NAME" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | tr -cd '[:alnum:]-_')

if [[ -z "$PROJECT_DIR" ]]; then
  echo -e "  ${RED}Invalid name. Use letters, numbers, hyphens, or underscores.${NC}"
  exit 1
fi

if [[ -d "$PROJECT_DIR" ]]; then
  echo -e ""
  echo -e "  ${YELLOW}Directory '$PROJECT_DIR' already exists.${NC}"
  if ! ask "Add files into it anyway?"; then
    echo "  Cancelled."
    exit 0
  fi
fi

echo ""

# ── Step 2 — Hosting ──────────────────────────────────────────────────────────

echo -e "${BOLD}  Step 2 — Hosting${NC}"
echo ""
echo "  How do you plan to host this integration?"
echo ""
echo "    [1] GitHub Pages  — free static hosting, no server required"
echo "    [2] Localhost     — local dev server (npx serve)"
echo "    [3] Decide later  — just create the files"
echo ""
printf "  Choose [1/2/3]: "
read -r HOSTING_CHOICE

case "$HOSTING_CHOICE" in
  1) HOSTING="github-pages" ;;
  2) HOSTING="localhost" ;;
  *) HOSTING="undecided" ;;
esac

echo ""

# ── Step 3 — AI tools ─────────────────────────────────────────────────────────

echo -e "${BOLD}  Step 3 — AI tools${NC}"
echo ""
echo "  Which AI tools do you use? Skill files will be placed"
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

# fieldtwin.config.json — reserved for future FuturOn tenant deployment
cat > "$PROJECT_DIR/fieldtwin.config.json" << EOF
{
  "name": "$RAW_NAME",
  "version": "1.0.0",
  "hosting": "$HOSTING"
}
EOF
echo -e "  ${GREEN}✓${NC} fieldtwin.config.json"

# .gitignore
cat > "$PROJECT_DIR/.gitignore" << 'EOF'
node_modules/
.env
.env.local
EOF
echo -e "  ${GREEN}✓${NC} .gitignore"

# Hosting-specific files
if [[ "$HOSTING" == "localhost" ]]; then
  cat > "$PROJECT_DIR/package.json" << EOF
{
  "name": "$(echo "$PROJECT_DIR" | tr '[:upper:]' '[:lower:]')",
  "version": "1.0.0",
  "scripts": {
    "start": "npx serve ."
  }
}
EOF
  echo -e "  ${GREEN}✓${NC} package.json  (run: npm start)"
fi

# ── AI skill files ────────────────────────────────────────────────────────────

if [[ ${#AI_TOOLS[@]} -gt 0 ]]; then
  echo ""
  echo -e "  ${DIM}AI skill files:${NC}"
  echo ""

  for tool in "${AI_TOOLS[@]}"; do
    case "$tool" in
      claude-code)
        download "platforms/claude-code-skill.md"  "$PROJECT_DIR/.claude/skills/fieldtwin.md" \
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
echo -e "  Location: ${CYAN}$(pwd)/$PROJECT_DIR${NC}"
echo ""
echo "  Next steps:"
echo ""
echo "  1. Open the project in your AI-enabled editor"
echo ""

if [[ "$HOSTING" == "localhost" ]]; then
  echo "  2. Start the local server:"
  echo -e "     ${CYAN}cd $PROJECT_DIR && npm start${NC}"
  echo ""
  echo "  3. In FieldTwin: Admin → Integrations → Create New Tab"
  echo "     Use http://localhost:3000 as the URL"
elif [[ "$HOSTING" == "github-pages" ]]; then
  echo "  2. Push to GitHub and enable GitHub Pages:"
  echo "     Settings → Pages → Deploy from main"
  echo ""
  echo "  3. In FieldTwin: Admin → Integrations → Create New Tab"
  echo "     Use your GitHub Pages URL"
else
  echo "  2. In FieldTwin: Admin → Integrations → Create New Tab"
  echo "     Enter the URL where your integration is hosted"
fi

echo ""
echo -e "  Open the integration in FieldTwin — you should see ${GREEN}Connected to FieldTwin!${NC}"
echo ""
echo -e "  ${DIM}Source: $REPO_BASE${NC}"
echo ""
