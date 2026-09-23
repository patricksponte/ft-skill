# FieldTwin AI Agent Toolkit — Updater (Windows / PowerShell)
# Run inside your integration project to refresh agent files to the latest version.
# Only updates files that already exist — never overwrites your own code.
#
# Usage: .\update.ps1

$RepoBase   = "https://raw.githubusercontent.com/patricksponte/ft-skill/main"
$ArchiveUrl = "https://codeload.github.com/patricksponte/ft-skill/zip/refs/heads/main"
$Skills     = @("create-fieldtwin-integration", "develop-fieldtwin-integration")
$HelloWorld = "skills/create-fieldtwin-integration/assets/hello-world/index.html"

function Download-File($src, $dst) {
    $dir = Split-Path $dst -Parent
    if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
    try {
        Invoke-WebRequest -Uri "$RepoBase/$src" -OutFile $dst -UseBasicParsing -ErrorAction Stop
        return $true
    } catch {
        return $false
    }
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

Write-Host ""
Write-Host "  FieldTwin AI Agent Toolkit — Updater" -ForegroundColor White
Separator
Write-Host "  Updates agent files in this project to the latest version."
Write-Host "  Your own code (index.html, app.py, server.js, etc.) is never touched."
Separator
Write-Host ""

# ── File map: local path → remote path ───────────────────────────────────────

$Files = @{
    ".claude\fieldtwin-instructions.md"  = "fieldtwin-instructions.md"
    ".claude\skills\fieldtwin.md"        = "platforms/claude-code.md"
    ".claude\api-reference.json"         = "api-reference.json"
    ".github\copilot-instructions.md"    = "platforms/copilot-instructions.md"
    ".cursorrules"                       = "platforms/.cursorrules"
    ".clinerules"                        = "fieldtwin-instructions.md"
    "CONVENTIONS.md"                     = "fieldtwin-instructions.md"
    ".antigravity.md"                    = "platforms/antigravity.md"
    ".opencode\agents\fieldtwin.md"      = "platforms/opencode.md"
}

$updated = 0
$skipped = 0
$failed  = 0

foreach ($local in $Files.Keys) {
    $remote = $Files[$local]
    if (Test-Path $local) {
        if (Download-File $remote $local) {
            Write-Host "  + $local" -ForegroundColor Green
            $updated++
        } else {
            Write-Host "  x $local  (download failed)" -ForegroundColor Red
            $failed++
        }
    } else {
        Write-Host "  - $local  (not in this project, skipped)" -ForegroundColor DarkGray
        $skipped++
    }
}

# Installed Agent Skills are refreshed as whole directories.
foreach ($skillsDir in @(".claude\skills", ".agents\skills")) {
    $present = $Skills | Where-Object { Test-Path (Join-Path $skillsDir "$_\SKILL.md") }
    if ($present) {
        if (Install-Skills $skillsDir) {
            Write-Host "  + $skillsDir\ ($($Skills -join ', '))" -ForegroundColor Green
            $updated++
        } else {
            Write-Host "  x $skillsDir\  (download failed)" -ForegroundColor Red
            $failed++
        }
    }
}

Write-Host ""
Separator
if ($failed -gt 0) {
    Write-Host "  $updated updated · $skipped skipped · $failed failed" -ForegroundColor Red
} else {
    Write-Host "  $updated file(s) updated · $skipped skipped" -ForegroundColor Green
}
Separator
Write-Host ""
