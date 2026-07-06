# FieldTwin AI Skill — Project Installer (Windows / PowerShell)
# Downloads skill files from GitHub and places them in the correct locations
# for each AI coding tool you use in this project.
#
# Usage: Right-click this file and choose "Run with PowerShell"
#        or run from a terminal: .\install.ps1

$RepoBase = "https://raw.githubusercontent.com/YOUR_ORG/YOUR_REPO/main"

$installed = @()
$skipped   = @()

# ── Helpers ───────────────────────────────────────────────────────────────────

function Download-File($src, $dst) {
    $dir = Split-Path $dst -Parent
    if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
    try {
        Invoke-WebRequest -Uri "$RepoBase/$src" -OutFile $dst -UseBasicParsing -ErrorAction Stop
        return $true
    } catch {
        Write-Host "  [ERROR] Download failed: $src" -ForegroundColor Red
        return $false
    }
}

function Ask($prompt) {
    $answer = Read-Host "  $prompt [y/N]"
    return $answer -match '^[Yy]$'
}

function Guard($file) {
    if (Test-Path $file) {
        Write-Host "  Already exists: $file" -ForegroundColor Yellow
        return Ask "Overwrite?"
    }
    return $true
}

function Separator { Write-Host "  $('─' * 54)" -ForegroundColor DarkGray }

# ── Header ────────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "  FieldTwin AI Skill — Project Installer" -ForegroundColor White
Separator
Write-Host "  Installing into: " -NoNewline
Write-Host (Get-Location) -ForegroundColor Cyan
Write-Host ""
Write-Host "  This script downloads the FieldTwin AI Skill from GitHub"
Write-Host "  and sets it up for the AI tools you use in this project."
Write-Host "  You will be asked before anything is written to disk."
Separator
Write-Host ""

# ── [1/7] Claude Code ─────────────────────────────────────────────────────────

Write-Host "  [1/7] Claude Code" -ForegroundColor White
Write-Host ""
Write-Host "  Registers a /fieldtwin slash command in Claude Code and places"
Write-Host "  the full API reference where the command can read it."
Write-Host ""
Write-Host "  Files that will be created:" -ForegroundColor DarkGray
Write-Host "    .claude\skills\fieldtwin.md        <- /fieldtwin slash command"
Write-Host "    .claude\fieldtwin-instructions.md  <- complete skill reference"
Write-Host "    .claude\api-reference.json         <- all 120+ REST endpoints"
Write-Host ""
if (Ask "Set up for Claude Code?") {
    $ok = Guard ".claude\skills\fieldtwin.md"
    if ($ok) { $ok = Download-File "platforms/claude-code-skill.md"  ".claude\skills\fieldtwin.md" }
    if ($ok) { $ok = Download-File "fieldtwin-instructions.md"       ".claude\fieldtwin-instructions.md" }
    if ($ok) { $ok = Download-File "api-reference.json"              ".claude\api-reference.json" }
    if ($ok) {
        Write-Host "  Done. Type /fieldtwin in Claude Code to activate the skill." -ForegroundColor Green
        $installed += "Claude Code"
    }
} else {
    Write-Host "  Skipped."
    $skipped += "Claude Code"
}
Write-Host ""

# ── [2/7] GitHub Copilot ──────────────────────────────────────────────────────

Write-Host "  [2/7] GitHub Copilot" -ForegroundColor White
Write-Host ""
Write-Host "  Adds .github\copilot-instructions.md so Copilot reads the FieldTwin"
Write-Host "  skill automatically for everyone working on this repository."
Write-Host ""
Write-Host "  Files that will be created:" -ForegroundColor DarkGray
Write-Host "    .github\copilot-instructions.md"
Write-Host ""
if (Ask "Set up for GitHub Copilot?") {
    if (Guard ".github\copilot-instructions.md") {
        if (Download-File "platforms/copilot-instructions.md" ".github\copilot-instructions.md") {
            Write-Host "  Done. Commit the file so the whole team gets the skill." -ForegroundColor Green
            $installed += "GitHub Copilot"
        }
    } else { $skipped += "GitHub Copilot" }
} else {
    Write-Host "  Skipped."
    $skipped += "GitHub Copilot"
}
Write-Host ""

# ── [3/7] Cursor / Windsurf ───────────────────────────────────────────────────

Write-Host "  [3/7] Cursor / Windsurf" -ForegroundColor White
Write-Host ""
Write-Host "  Adds .cursorrules to the project root. Both Cursor and Windsurf"
Write-Host "  read this file automatically — no extra setup needed."
Write-Host ""
Write-Host "  Files that will be created:" -ForegroundColor DarkGray
Write-Host "    .cursorrules"
Write-Host ""
if (Ask "Set up for Cursor / Windsurf?") {
    if (Guard ".cursorrules") {
        if (Download-File "platforms/.cursorrules" ".cursorrules") {
            Write-Host "  Done. Open or restart Cursor/Windsurf in this folder." -ForegroundColor Green
            $installed += "Cursor / Windsurf"
        }
    } else { $skipped += "Cursor / Windsurf" }
} else {
    Write-Host "  Skipped."
    $skipped += "Cursor / Windsurf"
}
Write-Host ""

# ── [4/7] Cline ───────────────────────────────────────────────────────────────

Write-Host "  [4/7] Cline (VS Code)" -ForegroundColor White
Write-Host ""
Write-Host "  Adds .clinerules with the full FieldTwin skill. Cline injects it"
Write-Host "  as a system prompt for every conversation in this workspace."
Write-Host ""
Write-Host "  Files that will be created:" -ForegroundColor DarkGray
Write-Host "    .clinerules"
Write-Host ""
if (Ask "Set up for Cline?") {
    if (Guard ".clinerules") {
        if (Download-File "fieldtwin-instructions.md" ".clinerules") {
            Write-Host "  Done. Open VS Code with Cline in this folder." -ForegroundColor Green
            $installed += "Cline"
        }
    } else { $skipped += "Cline" }
} else {
    Write-Host "  Skipped."
    $skipped += "Cline"
}
Write-Host ""

# ── [5/7] Aider ───────────────────────────────────────────────────────────────

Write-Host "  [5/7] Aider" -ForegroundColor White
Write-Host ""
Write-Host "  Creates CONVENTIONS.md with the FieldTwin skill. Aider reads this"
Write-Host "  file automatically on startup in the current directory."
Write-Host ""
Write-Host "  Files that will be created:" -ForegroundColor DarkGray
Write-Host "    CONVENTIONS.md"
Write-Host ""
if (Ask "Set up for Aider?") {
    if (Guard "CONVENTIONS.md") {
        if (Download-File "fieldtwin-instructions.md" "CONVENTIONS.md") {
            Write-Host "  Done. Run aider in this directory to activate the skill." -ForegroundColor Green
            $installed += "Aider"
        }
    } else { $skipped += "Aider" }
} else {
    Write-Host "  Skipped."
    $skipped += "Aider"
}
Write-Host ""

# ── [6/7] Gemini CLI ──────────────────────────────────────────────────────────

Write-Host "  [6/7] Gemini CLI" -ForegroundColor White
Write-Host ""
Write-Host "  Creates GEMINI.md with the FieldTwin skill. The Gemini CLI reads"
Write-Host "  this file automatically when you run 'gemini' in this directory."
Write-Host ""
Write-Host "  Files that will be created:" -ForegroundColor DarkGray
Write-Host "    GEMINI.md"
Write-Host ""
if (Ask "Set up for Gemini CLI?") {
    if (Guard "GEMINI.md") {
        if (Download-File "platforms/gemini-cli.md" "GEMINI.md") {
            Write-Host "  Done. Run gemini in this directory to activate the skill." -ForegroundColor Green
            $installed += "Gemini CLI"
        }
    } else { $skipped += "Gemini CLI" }
} else {
    Write-Host "  Skipped."
    $skipped += "Gemini CLI"
}
Write-Host ""

# ── [7/7] OpenCode ────────────────────────────────────────────────────────────

Write-Host "  [7/7] OpenCode" -ForegroundColor White
Write-Host ""
Write-Host "  Creates .opencode\agents\fieldtwin.md — a dedicated FieldTwin agent"
Write-Host "  available inside OpenCode for any of its 75+ supported AI providers."
Write-Host ""
Write-Host "  Files that will be created:" -ForegroundColor DarkGray
Write-Host "    .opencode\agents\fieldtwin.md   <- /fieldtwin agent"
Write-Host "    .opencode.json                  <- project config (instructions + MCP)"
Write-Host ""
if (Ask "Set up for OpenCode?") {
    $ok = Guard ".opencode\agents\fieldtwin.md"
    if ($ok) { $ok = Download-File "platforms/opencode.md" ".opencode\agents\fieldtwin.md" }
    if ($ok) {
        Write-Host ""
        if (Ask "Also create .opencode.json with instructions + MCP config?") {
            if (Guard ".opencode.json") {
                if (Download-File "platforms/opencode.json" ".opencode.json") {
                    Write-Host "  Edit .opencode.json: set the absolute path to mcp-server/index.js and your API token." -ForegroundColor Yellow
                }
            }
        }
        Write-Host "  Done. Run opencode in this directory. Use /fieldtwin to activate the agent." -ForegroundColor Green
        $installed += "OpenCode"
    }
} else {
    Write-Host "  Skipped."
    $skipped += "OpenCode"
}
Write-Host ""

# ── Summary ───────────────────────────────────────────────────────────────────

Separator
Write-Host "  Summary" -ForegroundColor White
Separator
Write-Host ""
if ($installed.Count -gt 0) {
    Write-Host "  Installed:" -ForegroundColor Green
    foreach ($t in $installed) { Write-Host "    checkmark  $t" }
    Write-Host ""
}
if ($skipped.Count -gt 0) {
    Write-Host "  Skipped:"
    foreach ($t in $skipped) { Write-Host "    -  $t" }
    Write-Host ""
}
Write-Host "  Source: $RepoBase" -ForegroundColor DarkGray
Write-Host ""
