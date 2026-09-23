# FieldTwin AI Agent Toolkit — Integration Creator (Windows / PowerShell)
# Creates a new FieldTwin integration project from scratch,
# with the AI Agent Toolkit pre-configured and the Hello World ready to run.
#
# Usage: .\create.ps1

$RepoBase   = "https://raw.githubusercontent.com/patricksponte/ft-skill/main"
$ArchiveUrl = "https://codeload.github.com/patricksponte/ft-skill/zip/refs/heads/main"
$Skills     = @("create-fieldtwin-integration", "develop-fieldtwin-integration")
$HelloWorld = "skills/create-fieldtwin-integration/assets/hello-world/index.html"

$installed = @()

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

function Separator { Write-Host "  $('─' * 54)" -ForegroundColor DarkGray }

# Install the canonical Agent Skills (skills\<name>\SKILL.md + references) into a directory.
function Install-Skills($dest) {
    $tmp = Join-Path ([System.IO.Path]::GetTempPath()) ("ft-skill-" + [guid]::NewGuid())
    New-Item -ItemType Directory -Path $tmp | Out-Null
    try {
        $zip = Join-Path $tmp "skills.zip"
        Invoke-WebRequest -Uri $ArchiveUrl -OutFile $zip -UseBasicParsing -ErrorAction Stop
        Expand-Archive -Path $zip -DestinationPath $tmp -Force
        $root = Get-ChildItem -Path $tmp -Directory | Select-Object -First 1
        if (-not (Test-Path $dest)) { New-Item -ItemType Directory -Path $dest -Force | Out-Null }
        foreach ($skill in $Skills) {
            $src = Join-Path $root.FullName "skills\$skill"
            if (-not (Test-Path (Join-Path $src "SKILL.md"))) { throw "Skill missing from archive: $skill" }
            $target = Join-Path $dest $skill
            if (Test-Path $target) { Remove-Item -Recurse -Force $target }
            Copy-Item -Recurse -Path $src -Destination $target
        }
        return $true
    } catch {
        Write-Host "  [ERROR] Skills download failed: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    } finally {
        Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
    }
}

# ── Prerequisite check — download tool ───────────────────────────────────────

if (-not (Get-Command curl -ErrorAction SilentlyContinue) -and
    -not (Get-Command wget -ErrorAction SilentlyContinue) -and
    -not (Get-Command Invoke-WebRequest -ErrorAction SilentlyContinue)) {
    Write-Host ""
    Write-Host "  Error: no download tool found (curl, wget, or Invoke-WebRequest required)." -ForegroundColor Red
    Write-Host ""
    Write-Host "  Install curl from https://curl.se and run this script again."
    Write-Host ""
    exit 1
}

# ── Header ────────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "  FieldTwin AI Agent Toolkit — Integration Creator" -ForegroundColor White
Separator
Write-Host "  Creates a new FieldTwin integration project on your machine."
Write-Host "  The Hello World will be ready to open in FieldTwin immediately."
Separator
Write-Host ""

# ── Step 1 — Project name ─────────────────────────────────────────────────────

Write-Host "  Step 1 — Project name" -ForegroundColor White
Write-Host ""

$RawName = ""
while ([string]::IsNullOrWhiteSpace($RawName)) {
    $RawName = Read-Host "  Integration name (e.g. my-integration)"
    if ([string]::IsNullOrWhiteSpace($RawName)) {
        Write-Host "  Name is required." -ForegroundColor Red
    }
}

$ProjectFolder = $RawName.ToLower() -replace ' ', '-' -replace '[^a-z0-9\-_]', ''

if ([string]::IsNullOrWhiteSpace($ProjectFolder)) {
    Write-Host "  Invalid name. Use letters, numbers, hyphens, or underscores." -ForegroundColor Red
    exit 1
}

Write-Host ""

# ── Step 2 — Save location ────────────────────────────────────────────────────

Write-Host "  Step 2 — Save location" -ForegroundColor White
Write-Host ""
Write-Host "  Where should the project be created?"
Write-Host "  Press Enter to use the current directory: " -NoNewline
Write-Host (Get-Location) -ForegroundColor Cyan
Write-Host ""
$SavePath = Read-Host "  Path (or Enter for current directory)"

if ([string]::IsNullOrWhiteSpace($SavePath)) {
    $SavePath = (Get-Location).Path
}

$ProjectDir = Join-Path $SavePath $ProjectFolder

if (Test-Path $ProjectDir) {
    Write-Host ""
    Write-Host "  Directory '$ProjectDir' already exists." -ForegroundColor Yellow
    if (-not (Ask "Add files into it anyway?")) {
        Write-Host "  Cancelled."
        exit 0
    }
}

Write-Host ""

# ── Step 3 — Template ─────────────────────────────────────────────────────────

Write-Host "  Step 3 — Template" -ForegroundColor White
Write-Host ""
Write-Host "  Choose how you want to build this integration:"
Write-Host ""
Write-Host "    [1] Static page  — HTML/JS only. No server needed."
Write-Host "                       Host for free on GitHub Pages."
Write-Host ""
Write-Host "    [2] Node.js      — Adds an Express server so you can install"
Write-Host "                       npm packages and use external JS libraries."
Write-Host ""
Write-Host "    [3] Python       — Adds a FastAPI server so you can install"
Write-Host "                       pip packages and use external Python libraries."
Write-Host ""
Write-Host "  The Hello World frontend is the same for all options."
Write-Host "  The backend (Node.js / Python) is where you add your own logic."
Write-Host ""
$TemplateChoice = Read-Host "  Choose [1/2/3]"

$Template = switch ($TemplateChoice) {
    "2" { "node" }
    "3" { "python" }
    default { "static" }
}

# Prerequisite check — Node.js / Python
if ($Template -eq "node") {
    if (-not (Get-Command node -ErrorAction SilentlyContinue) -or
        -not (Get-Command npm  -ErrorAction SilentlyContinue)) {
        Write-Host ""
        Write-Host "  Error: Node.js and npm are required for this template." -ForegroundColor Red
        Write-Host ""
        Write-Host "  Install Node.js (includes npm) from https://nodejs.org"
        Write-Host "  Then run this script again."
        Write-Host ""
        exit 1
    }
}

if ($Template -eq "python") {
    $pyFound  = (Get-Command python3 -ErrorAction SilentlyContinue) -or (Get-Command python -ErrorAction SilentlyContinue)
    $pipFound = (Get-Command pip3   -ErrorAction SilentlyContinue) -or (Get-Command pip    -ErrorAction SilentlyContinue)
    if (-not $pyFound) {
        Write-Host ""
        Write-Host "  Error: Python is required for this template." -ForegroundColor Red
        Write-Host ""
        Write-Host "  Install Python from https://python.org"
        Write-Host "  Then run this script again."
        Write-Host ""
        exit 1
    }
    if (-not $pipFound) {
        Write-Host ""
        Write-Host "  Error: pip is required for this template." -ForegroundColor Red
        Write-Host ""
        Write-Host "  pip is usually included with Python. If missing, run:"
        Write-Host "    python -m ensurepip --upgrade"
        Write-Host "  Then run this script again."
        Write-Host ""
        exit 1
    }
}

Write-Host ""

# ── Step 4 — FieldTwin address ────────────────────────────────────────────────

Write-Host "  Step 4 — FieldTwin address" -ForegroundColor White
Write-Host ""
Write-Host "  The integration only accepts messages from your exact FieldTwin origin."
Write-Host "  Copy it from the browser address bar while FieldTwin is open."
Write-Host "  Example: https://yourcompany.fieldtwin.com   (Enter to set it later)" -ForegroundColor DarkGray
Write-Host ""
$FieldTwinOrigin = ""
while ($true) {
    $inputOrigin = Read-Host "  FieldTwin address"
    if ([string]::IsNullOrWhiteSpace($inputOrigin)) {
        Write-Host "  Skipped. Edit ALLOWED_FIELDTWIN_ORIGINS in index.html before opening it in FieldTwin." -ForegroundColor Yellow
        break
    }
    # Keep only scheme://host[:port]; drop any path or query. Only https is accepted.
    $candidate = $inputOrigin.Trim() -replace '^(https://[^/?]+).*$', '$1'
    if ($candidate -match '^https://[A-Za-z0-9.-]+(:[0-9]{1,5})?$') {
        $FieldTwinOrigin = $candidate
        Write-Host "  Allowed origin: $FieldTwinOrigin" -ForegroundColor Green
        break
    }
    Write-Host "  Use an https:// address such as https://yourcompany.fieldtwin.com" -ForegroundColor Red
}

Write-Host ""

# ── Step 5 — AI tools ─────────────────────────────────────────────────────────

Write-Host "  Step 5 — AI tools" -ForegroundColor White
Write-Host ""
Write-Host "  Which AI tools do you use? agent files will be placed"
Write-Host "  in the right location for each one."
Write-Host ""

$AiTools = @()

if (Ask "Claude Code?")       { $AiTools += "claude-code" }
if (Ask "GitHub Copilot?")    { $AiTools += "copilot" }
if (Ask "Cursor / Windsurf?") { $AiTools += "cursor" }
if (Ask "Cline (VS Code)?")   { $AiTools += "cline" }
if (Ask "Aider?")             { $AiTools += "aider" }
if (Ask "Antigravity CLI?")   { $AiTools += "antigravity" }
if (Ask "OpenCode?")          { $AiTools += "opencode" }

Write-Host ""

# ── Create project ────────────────────────────────────────────────────────────

Separator
Write-Host "  Creating $ProjectDir ..." -ForegroundColor White
Separator
Write-Host ""

New-Item -ItemType Directory -Path $ProjectDir -Force | Out-Null

# Hello World — a static page is served from the project root; the Node/Python servers serve public\ only
$Page = if ($Template -eq "static") { "index.html" } else { "public\index.html" }
$PagePath = Join-Path $ProjectDir $Page
if (Download-File $HelloWorld $PagePath) {
    if ($FieldTwinOrigin) {
        # Read and write UTF-8 explicitly: Windows PowerShell 5.1 would otherwise mangle non-ASCII text.
        $content = [System.IO.File]::ReadAllText($PagePath, [System.Text.Encoding]::UTF8)
        $content = $content.Replace("      'https://fieldtwin.example',", "      '$FieldTwinOrigin',")
        [System.IO.File]::WriteAllText($PagePath, $content, (New-Object System.Text.UTF8Encoding($false)))
    }
    Write-Host "  + $Page" -ForegroundColor Green
}

# Updater script
if (Download-File "update.ps1" "$ProjectDir\update.ps1") {
    Write-Host "  + update.ps1  (run anytime to refresh agent files)" -ForegroundColor Green
}

# fieldtwin.config.json
@"
{
  "name": "$RawName",
  "version": "1.0.0",
  "template": "$Template"
}
"@ | Set-Content "$ProjectDir\fieldtwin.config.json" -Encoding UTF8
Write-Host "  + fieldtwin.config.json" -ForegroundColor Green

# .gitignore
@"
node_modules/
.env
.env.local
__pycache__/
*.pyc
.venv/
.claude/settings.local.json
"@ | Set-Content "$ProjectDir\.gitignore" -Encoding UTF8
Write-Host "  + .gitignore" -ForegroundColor Green

# Server environment example (origins for CSP frame-ancestors)
if ($Template -ne "static") {
    $exampleOrigin = if ($FieldTwinOrigin) { $FieldTwinOrigin } else { "https://yourcompany.fieldtwin.com" }
    "FIELDTWIN_ORIGINS=$exampleOrigin" | Set-Content "$ProjectDir\.env.example" -Encoding ASCII
    Write-Host "  + .env.example" -ForegroundColor Green
}

# Backend files
if ($Template -eq "node") {
    if (Download-File "templates/node/server.js"    "$ProjectDir\server.js")    { Write-Host "  + server.js"    -ForegroundColor Green }
    if (Download-File "templates/node/package.json" "$ProjectDir\package.json") { Write-Host "  + package.json" -ForegroundColor Green }
} elseif ($Template -eq "python") {
    if (Download-File "templates/python/app.py"           "$ProjectDir\app.py")           { Write-Host "  + app.py"           -ForegroundColor Green }
    if (Download-File "templates/python/requirements.txt" "$ProjectDir\requirements.txt") { Write-Host "  + requirements.txt" -ForegroundColor Green }
    $py = if (Get-Command python3 -ErrorAction SilentlyContinue) { "python3" } else { "python" }
    & $py -m venv "$ProjectDir\.venv" | Out-Null
    Write-Host "  + .venv\  (virtual environment)" -ForegroundColor Green
}

# ── AI Agent Toolkit files ────────────────────────────────────────────────────────────

if ($AiTools.Count -gt 0) {
    Write-Host ""
    Write-Host "  AI Agent Toolkit files:" -ForegroundColor DarkGray
    Write-Host ""

    foreach ($tool in $AiTools) {
        switch ($tool) {
            "claude-code" {
                if (Install-Skills "$ProjectDir\.claude\skills") {
                    Write-Host "  + Claude Code  (.claude\skills\: $($Skills -join ', '))" -ForegroundColor Green
                }
            }
            "copilot" {
                if (Download-File "platforms/copilot-instructions.md" "$ProjectDir\.github\copilot-instructions.md") {
                    Write-Host "  + GitHub Copilot  (.github\copilot-instructions.md)" -ForegroundColor Green
                }
            }
            "cursor" {
                if (Download-File "platforms/.cursorrules" "$ProjectDir\.cursorrules") {
                    Write-Host "  + Cursor / Windsurf  (.cursorrules)" -ForegroundColor Green
                }
            }
            "cline" {
                if (Download-File "fieldtwin-instructions.md" "$ProjectDir\.clinerules") {
                    Write-Host "  + Cline  (.clinerules)" -ForegroundColor Green
                }
            }
            "aider" {
                if (Download-File "fieldtwin-instructions.md" "$ProjectDir\CONVENTIONS.md") {
                    Write-Host "  + Aider  (CONVENTIONS.md)" -ForegroundColor Green
                }
            }
            "antigravity" {
                if (Download-File "platforms/antigravity.md" "$ProjectDir\.antigravity.md") {
                    Write-Host "  + Antigravity CLI  (.antigravity.md)" -ForegroundColor Green
                }
            }
            "opencode" {
                $ok = Download-File "platforms/opencode.md"   "$ProjectDir\.opencode\agents\fieldtwin.md"
                $ok = $ok -and (Download-File "platforms/opencode.json" "$ProjectDir\.opencode.json")
                if ($ok) {
                    Write-Host "  + OpenCode  (.opencode\)" -ForegroundColor Green
                    Write-Host "    -> Edit .opencode.json: set the packages/fieldtwin-mcp path and API token" -ForegroundColor Yellow
                }
            }
        }
    }
}


# ── Summary ───────────────────────────────────────────────────────────────────

Write-Host ""
Separator
Write-Host "  Done! Your integration is ready." -ForegroundColor White
Separator
Write-Host ""
Write-Host "  Location: " -NoNewline
Write-Host $ProjectDir -ForegroundColor Cyan
Write-Host ""
$ShownOrigin = if ($FieldTwinOrigin) { $FieldTwinOrigin } else { "<your-fieldtwin-origin>" }
Write-Host "  Next steps:"
Write-Host ""
Write-Host "  1. Open the project in your AI-enabled editor"
Write-Host ""

if ($Template -eq "node") {
    Write-Host "  2. Install dependencies and start the server:"
    Write-Host "     cd `"$ProjectDir`" ; npm install ; `$env:FIELDTWIN_ORIGINS='$ShownOrigin' ; npm start" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  3. In FieldTwin: Admin -> Integrations -> Create New Tab"
    Write-Host "     Use http://localhost:3000 as the URL"
    Write-Host ""
    Write-Host "  4. Add your logic in server.js; the page lives in public\index.html."
} elseif ($Template -eq "python") {
    Write-Host "  2. Activate the virtual environment and install dependencies:"
    Write-Host "     cd `"$ProjectDir`"" -ForegroundColor Cyan
    Write-Host "     .venv\Scripts\Activate.ps1" -ForegroundColor Cyan
    Write-Host "     pip install -r requirements.txt" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  3. Start the server:"
    Write-Host "     `$env:FIELDTWIN_ORIGINS='$ShownOrigin' ; python app.py" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  4. In FieldTwin: Admin -> Integrations -> Create New Tab"
    Write-Host "     Use http://localhost:3000 as the URL"
    Write-Host ""
    Write-Host "  5. Add your logic in app.py; the page lives in public\index.html."
} else {
    Write-Host "  2. Host index.html over HTTPS (for example GitHub Pages), then"
    Write-Host "     in FieldTwin: Admin -> Integrations -> Create New Tab with that URL."
}

Write-Host ""
Write-Host "  In the FieldTwin tab settings, enable 'Use GET verb' and"
Write-Host "  'Do not pass arguments in URL'. Grant only the access you need."
if (-not $FieldTwinOrigin) {
    Write-Host "  Remember: set ALLOWED_FIELDTWIN_ORIGINS in $Page to your FieldTwin address." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "  Open the integration in FieldTwin — you should see 'Connected to FieldTwin!'" -ForegroundColor Green
Write-Host ""
Write-Host "  Source: $RepoBase" -ForegroundColor DarkGray
Write-Host ""
