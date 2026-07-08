#!/usr/bin/env bash
# FieldTwin AI Agent Toolkit — Updater (Linux / macOS)
# Run inside your integration project to refresh agent files to the latest version.
# Only updates files that already exist — never overwrites your own code.

REPO_BASE="https://raw.githubusercontent.com/patricksponte/ft-skill/main"

exec < /dev/tty  # allow input when piped via curl | bash

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
DIM='\033[2m'
NC='\033[0m'

separator() { echo -e "${DIM}  ──────────────────────────────────────────────────────${NC}"; }

download() {
  local src="$1" dst="$2"
  mkdir -p "$(dirname "$dst")"
  if command -v curl &>/dev/null; then
    curl -sSfL "$REPO_BASE/$src" -o "$dst"
  elif command -v wget &>/dev/null; then
    wget -qO "$dst" "$REPO_BASE/$src"
  else
    echo -e "  ${RED}Error: curl or wget is required.${NC}"
    exit 1
  fi
}

echo ""
echo -e "${BOLD}  FieldTwin AI Agent Toolkit — Updater${NC}"
separator
echo "  Updates agent files in this project to the latest version."
echo "  Your own code (index.html, app.py, server.js, etc.) is never touched."
separator
echo ""

# ── File map: "local:remote" pairs ───────────────────────────────────────────

FILES=(
  ".claude/fieldtwin-instructions.md:fieldtwin-instructions.md"
  ".claude/skills/fieldtwin.md:platforms/claude-code.md"
  ".claude/api-reference.json:api-reference.json"
  ".github/copilot-instructions.md:platforms/copilot-instructions.md"
  ".cursorrules:platforms/.cursorrules"
  ".clinerules:fieldtwin-instructions.md"
  "CONVENTIONS.md:fieldtwin-instructions.md"
  ".antigravity.md:platforms/antigravity.md"
  ".opencode/agents/fieldtwin.md:platforms/opencode.md"
)

updated=0
skipped=0
failed=0

for entry in "${FILES[@]}"; do
  local="${entry%%:*}"
  remote="${entry#*:}"
  if [[ -f "$local" ]]; then
    if download "$remote" "$local"; then
      echo -e "  ${GREEN}✓${NC} $local"
      updated=$((updated + 1))
    else
      echo -e "  ${RED}✗${NC} $local  (download failed)"
      failed=$((failed + 1))
    fi
  else
    echo -e "  ${DIM}—  $local  (not in this project, skipped)${NC}"
    skipped=$((skipped + 1))
  fi
done

echo ""
separator
if [[ $failed -gt 0 ]]; then
  echo -e "  ${updated} updated · ${skipped} skipped · ${RED}${failed} failed${NC}"
else
  echo -e "  ${GREEN}${updated} file(s) updated${NC} · ${skipped} skipped"
fi
separator
echo ""
