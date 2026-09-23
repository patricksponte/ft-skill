#!/usr/bin/env bash
# Copies the canonical knowledge, Agent Skills, templates and MCP server
# from the ft-skill repository root into assets/. assets/ is generated and
# gitignored, so the extension always ships what the repository holds.
# npm test and packaging run this first.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="${1:-$ROOT/../..}"

[[ -f "$SRC/fieldtwin-instructions.md" ]] || { echo "ft-skill not found at $SRC — pass its path as \$1"; exit 1; }
mkdir -p "$ROOT/assets/knowledge/platforms" "$ROOT/assets/mcp-server" \
         "$ROOT/assets/templates/static" "$ROOT/assets/templates/node" "$ROOT/assets/templates/python"

HELLO_WORLD="$SRC/skills/create-fieldtwin-integration/assets/hello-world/index.html"
SKILLS=(create-fieldtwin-integration develop-fieldtwin-integration)

cp "$SRC/fieldtwin-instructions.md" "$ROOT/assets/knowledge/"
cp "$SRC/api-reference.json"        "$ROOT/assets/knowledge/"
cp "$SRC/api-quick-reference.md"    "$ROOT/assets/knowledge/"
cp "$SRC/platforms/"*.md            "$ROOT/assets/knowledge/platforms/"
cp "$SRC/platforms/.cursorrules"    "$ROOT/assets/knowledge/platforms/cursorrules.md"
cp "$SRC/platforms/opencode.json"   "$ROOT/assets/knowledge/platforms/opencode.json"

# The Agent Skills are copied whole: SKILL.md loads its references on demand.
rm -rf "$ROOT/assets/skills"
mkdir -p "$ROOT/assets/skills"
for s in "${SKILLS[@]}"; do
  [[ -f "$SRC/skills/$s/SKILL.md" ]] || { echo "missing skill: $s"; exit 1; }
  cp -R "$SRC/skills/$s" "$ROOT/assets/skills/$s"
done

# One Hello World for every template: a static page lives at the project
# root, while the Node/Python servers serve public/ only.
for t in static node python; do
  cp "$HELLO_WORLD" "$ROOT/assets/templates/$t/index.html"
done
cp "$SRC/templates/node/"*   "$ROOT/assets/templates/node/"
cp "$SRC/templates/python/"* "$ROOT/assets/templates/python/"

cp "$SRC/packages/fieldtwin-mcp/index.js"     "$ROOT/assets/mcp-server/"
cp "$SRC/packages/fieldtwin-mcp/package.json" "$ROOT/assets/mcp-server/"

node -e "JSON.parse(require('fs').readFileSync('$ROOT/assets/knowledge/api-reference.json','utf8'))" \
  && echo "api-reference.json parses"

echo "assets synced from $SRC ($(git -C "$SRC" rev-parse --short HEAD 2>/dev/null || echo 'no git'))"
