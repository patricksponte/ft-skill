#!/usr/bin/env bash
# FieldTwin AI Agent Toolkit — Project Installer (Linux / macOS)
# Downloads agent files from GitHub and places them in the correct locations
# for each AI coding tool you use in this project.

REPO_BASE="https://raw.githubusercontent.com/patricksponte/ft-skill/main"
ARCHIVE_URL="https://codeload.github.com/patricksponte/ft-skill/tar.gz/refs/heads/main"
SKILLS=(create-fieldtwin-integration develop-fieldtwin-integration)

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
DIM='\033[2m'
NC='\033[0m'

installed=()
skipped=()

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
  local prompt="$1"
  local answer
  printf "  %s [y/N] " "$prompt"
  read -r answer
  [[ "$answer" =~ ^[Yy]$ ]]
}

guard() {
  local file="$1"
  if [[ -f "$file" ]]; then
    echo -e "  ${YELLOW}Already exists: $file${NC}"
    ask "Overwrite?" || return 1
  fi
  return 0
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

# ── Header ────────────────────────────────────────────────────────────────────

echo ""
echo -e "${BOLD}  FieldTwin AI Agent Toolkit — Project Installer${NC}"
separator
echo -e "  Installing into: ${CYAN}$(pwd)${NC}"
echo ""
echo "  This script downloads the FieldTwin AI Agent Toolkit from GitHub"
echo "  and sets it up for the AI tools you use in this project."
echo "  You will be asked before anything is written to disk."
separator
echo ""

# ── [1/7] Claude Code ─────────────────────────────────────────────────────────

echo -e "${BOLD}  [1/7] Claude Code${NC}"
echo ""
echo "  Installs the FieldTwin Agent Skills. Claude Code loads them"
echo "  automatically when you work on a FieldTwin integration."
echo ""
echo -e "  ${DIM}Directories that will be created:${NC}"
echo "    .claude/skills/create-fieldtwin-integration/   ← scaffold, Hello World, hosting"
echo "    .claude/skills/develop-fieldtwin-integration/  ← bridge, messages, API catalogs"
echo ""
if ask "Set up for Claude Code?"; then
  ok=true
  for skill in "${SKILLS[@]}"; do guard ".claude/skills/$skill/SKILL.md" || ok=false; done
  $ok && install_skills ".claude/skills" || ok=false
  if $ok; then
    echo -e "  ${GREEN}✓ Done. Ask Claude Code about your FieldTwin integration; the skills load on demand.${NC}"
    installed+=("Claude Code")
  fi
else
  echo "  Skipped."
  skipped+=("Claude Code")
fi
echo ""

# ── [2/7] GitHub Copilot ──────────────────────────────────────────────────────

echo -e "${BOLD}  [2/7] GitHub Copilot${NC}"
echo ""
echo "  Adds .github/copilot-instructions.md so Copilot reads the FieldTwin"
echo "  toolkit automatically for everyone working on this repository."
echo ""
echo -e "  ${DIM}Files that will be created:${NC}"
echo "    .github/copilot-instructions.md"
echo ""
if ask "Set up for GitHub Copilot?"; then
  if guard ".github/copilot-instructions.md"; then
    download "platforms/copilot-instructions.md" ".github/copilot-instructions.md" && {
      echo -e "  ${GREEN}✓ Done. Commit the file so the whole team gets the toolkit.${NC}"
      installed+=("GitHub Copilot")
    }
  else
    skipped+=("GitHub Copilot")
  fi
else
  echo "  Skipped."
  skipped+=("GitHub Copilot")
fi
echo ""

# ── [3/7] Cursor / Windsurf ───────────────────────────────────────────────────

echo -e "${BOLD}  [3/7] Cursor / Windsurf${NC}"
echo ""
echo "  Adds .cursorrules to the project root. Both Cursor and Windsurf"
echo "  read this file automatically — no extra setup needed."
echo ""
echo -e "  ${DIM}Files that will be created:${NC}"
echo "    .cursorrules"
echo ""
if ask "Set up for Cursor / Windsurf?"; then
  if guard ".cursorrules"; then
    download "platforms/.cursorrules" ".cursorrules" && {
      echo -e "  ${GREEN}✓ Done. Open or restart Cursor/Windsurf in this folder.${NC}"
      installed+=("Cursor / Windsurf")
    }
  else
    skipped+=("Cursor / Windsurf")
  fi
else
  echo "  Skipped."
  skipped+=("Cursor / Windsurf")
fi
echo ""

# ── [4/7] Cline ───────────────────────────────────────────────────────────────

echo -e "${BOLD}  [4/7] Cline (VS Code)${NC}"
echo ""
echo "  Adds .clinerules with the full FieldTwin Agent. Cline injects it"
echo "  as a system prompt for every conversation in this workspace."
echo ""
echo -e "  ${DIM}Files that will be created:${NC}"
echo "    .clinerules"
echo ""
if ask "Set up for Cline?"; then
  if guard ".clinerules"; then
    download "fieldtwin-instructions.md" ".clinerules" && {
      echo -e "  ${GREEN}✓ Done. Open VS Code with Cline in this folder.${NC}"
      installed+=("Cline")
    }
  else
    skipped+=("Cline")
  fi
else
  echo "  Skipped."
  skipped+=("Cline")
fi
echo ""

# ── [5/7] Aider ───────────────────────────────────────────────────────────────

echo -e "${BOLD}  [5/7] Aider${NC}"
echo ""
echo "  Creates CONVENTIONS.md with the FieldTwin Agent. Aider reads this"
echo "  file automatically on startup in the current directory."
echo ""
echo -e "  ${DIM}Files that will be created:${NC}"
echo "    CONVENTIONS.md"
echo ""
if ask "Set up for Aider?"; then
  if guard "CONVENTIONS.md"; then
    download "fieldtwin-instructions.md" "CONVENTIONS.md" && {
      echo -e "  ${GREEN}✓ Done. Run aider in this directory to activate the toolkit.${NC}"
      installed+=("Aider")
    }
  else
    skipped+=("Aider")
  fi
else
  echo "  Skipped."
  skipped+=("Aider")
fi
echo ""

# ── [6/7] Antigravity CLI ─────────────────────────────────────────────────────

echo -e "${BOLD}  [6/7] Antigravity CLI${NC}"
echo ""
echo "  Creates .antigravity.md with the FieldTwin Agent. Antigravity CLI"
echo "  reads this file automatically when you run 'agy' in this directory."
echo "  (Replaces Gemini CLI, discontinued June 18, 2026)"
echo ""
echo -e "  ${DIM}Files that will be created:${NC}"
echo "    .antigravity.md"
echo ""
if ask "Set up for Antigravity CLI?"; then
  if guard ".antigravity.md"; then
    download "platforms/antigravity.md" ".antigravity.md" && {
      echo -e "  ${GREEN}✓ Done. Run agy in this directory to activate the toolkit.${NC}"
      installed+=("Antigravity CLI")
    }
  else
    skipped+=("Antigravity CLI")
  fi
else
  echo "  Skipped."
  skipped+=("Antigravity CLI")
fi
echo ""

# ── [7/7] OpenCode ────────────────────────────────────────────────────────────

echo -e "${BOLD}  [7/7] OpenCode${NC}"
echo ""
echo "  Creates .opencode/agents/fieldtwin.md — a dedicated FieldTwin agent"
echo "  available inside OpenCode for any of its 75+ supported AI providers."
echo ""
echo -e "  ${DIM}Files that will be created:${NC}"
echo "    .opencode/agents/fieldtwin.md   ← /fieldtwin agent"
echo "    .opencode.json                  ← project config (instructions + MCP)"
echo ""
if ask "Set up for OpenCode?"; then
  ok=true
  guard ".opencode/agents/fieldtwin.md" || ok=false
  $ok && download "platforms/opencode.md" ".opencode/agents/fieldtwin.md" || ok=false
  if $ok; then
    echo ""
    if ask "Also create .opencode.json with instructions + MCP config?"; then
      if guard ".opencode.json"; then
        download "platforms/opencode.json" ".opencode.json" && {
          echo -e "  ${YELLOW}Edit .opencode.json: set the absolute path to packages/fieldtwin-mcp/index.js and your API token.${NC}"
        }
      fi
    fi
    echo -e "  ${GREEN}✓ Done. Run opencode in this directory. Use /fieldtwin to activate the agent.${NC}"
    installed+=("OpenCode")
  fi
else
  echo "  Skipped."
  skipped+=("OpenCode")
fi
echo ""

# ── Updater script ───────────────────────────────────────────────────────────

if [[ ! -f "update.sh" ]]; then
  download "update.sh" "update.sh" && chmod +x "update.sh" \
    && echo -e "  ${GREEN}✓${NC} update.sh added — run ${CYAN}bash update.sh${NC} anytime to refresh agent files."
fi
echo ""

# ── Summary ───────────────────────────────────────────────────────────────────

separator
echo -e "${BOLD}  Summary${NC}"
separator
echo ""
if [[ ${#installed[@]} -gt 0 ]]; then
  echo -e "  ${GREEN}Installed:${NC}"
  for t in "${installed[@]}"; do echo "    ✓  $t"; done
  echo ""
fi
if [[ ${#skipped[@]} -gt 0 ]]; then
  echo "  Skipped:"
  for t in "${skipped[@]}"; do echo "    -  $t"; done
  echo ""
fi
echo -e "  ${DIM}Source: $REPO_BASE${NC}"
echo ""
